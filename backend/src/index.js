import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
// Enable CORS so the frontend (dev server or production origin) can call the API.
// Use BACKEND_CORS_ORIGIN or allow all during development.
const corsOrigin = process.env.BACKEND_CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

// helper to generate a session token
function makeSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function makeGeneratedUserId() {
  // 16-byte hex id (32 chars) prefixed for clarity
  return 'uid_' + crypto.randomBytes(16).toString('hex');
}

app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

// Login/upsert endpoint: accepts { walletAddress }
// Step 1: Issue a server nonce for the client to sign with their Phantom wallet.
// POST /api/auth/login
// Body: { walletAddress, walletProvider?, walletPublicKey? }
// Response: { ok: true, nonce }
app.post('/api/auth/login', async (req, res) => {
  const { walletAddress, walletProvider, walletPublicKey } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });

  try {
    // generate a nonce (server-challenge). Use 24 bytes base64 to include enough entropy.
    const nonce = crypto.randomBytes(24).toString('base64');

    // ensure a user row exists (create minimal row if missing)
    const generatedUserId = makeGeneratedUserId();
    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress,
          generatedUserId,
        },
      });
    }

    // Store or update WalletAuth record to store the nonce for verification and provider info
    const existingWa = await prisma.walletAuth.findFirst({ where: { walletAddress } });
    if (existingWa) {
      await prisma.walletAuth.update({ where: { id: existingWa.id }, data: { lastNonce: nonce, provider: walletProvider ?? 'phantom', walletAddress, lastSignedAt: null } });
    } else {
      await prisma.walletAuth.create({ data: { userId: user.id, walletAddress, provider: walletProvider ?? 'phantom', lastNonce: nonce } });
    }

    return res.json({ ok: true, nonce });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// Step 2: Verify signature over the nonce and establish a session.
// POST /api/auth/verify
// Body: { walletAddress, signature (base64), publicKey (base58) }
app.post('/api/auth/verify', async (req, res) => {
  const { walletAddress, signature, publicKey } = req.body;
  if (!walletAddress || !signature || !publicKey) {
    return res.status(400).json({ error: 'walletAddress, signature, and publicKey required' });
  }

  try {
    const wa = await prisma.walletAuth.findFirst({ where: { walletAddress } });
  if (!wa || !wa.lastNonce) return res.status(400).json({ error: 'no nonce found for this walletAddress; call /api/auth/login first' });

    // prepare bytes
    const message = Buffer.from(wa.lastNonce, 'base64');
    // signature expected as base64
    const sig = Buffer.from(signature, 'base64');
    // publicKey expected as base58 (Solana)
    const pubkey = bs58.decode(publicKey);

    // DEV-DEBUG: log stored nonce and received signature (base64) to help debug signing mismatches
    // NOTE: remove these logs in production.
    try {
      console.debug('[DEV] verify attempt for', walletAddress);
      console.debug('[DEV] storedNonce (b64):', wa.lastNonce);
      console.debug('[DEV] received signature (base64):', signature);
    } catch (logErr) {
      console.error('error logging debug info', logErr);
    }

    const verified = nacl.sign.detached.verify(new Uint8Array(message), new Uint8Array(sig), new Uint8Array(pubkey));
    if (!verified) return res.status(401).json({ error: 'signature verification failed' });

    // signature valid — create session and update user
    const sessionToken = makeSessionToken();
    const now = new Date();
    const dateExpire = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days

    // ensure user exists
    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await prisma.user.create({ data: { walletAddress, generatedUserId: makeGeneratedUserId() } });
    }

    user = await prisma.user.update({
      where: { walletAddress },
      data: {
        sessionToken,
        dateLogged: now,
        dateExpire,
        walletPublicKey: publicKey,
        walletProvider: wa.provider ?? 'phantom',
      },
    });

  // update walletAuth lastSignedAt and clear lastNonce (use id since walletAddress isn't unique)
  await prisma.walletAuth.update({ where: { id: wa.id }, data: { lastSignedAt: now, lastNonce: null } });

    return res.json({ ok: true, user, sessionToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// --- Authentication middleware ---
async function authenticate(req, res, next) {
  try {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth) return res.status(401).json({ error: 'missing authorization header' });
    const parts = auth.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : auth;
    if (!token) return res.status(401).json({ error: 'invalid authorization header' });

    const user = await prisma.user.findUnique({ where: { sessionToken: token } });
    if (!user) return res.status(401).json({ error: 'invalid session token' });
    // optional: check expiry
    if (user.dateExpire && new Date(user.dateExpire) < new Date()) {
      return res.status(401).json({ error: 'session expired' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('auth middleware error', err);
    return res.status(500).json({ error: 'internal error' });
  }
}

// Protected: get current user (non-sensitive fields only)
app.get('/api/user/me', authenticate, async (req, res) => {
  try {
    const user = req.user;
    // compute whether user has persona/encrypted blobs
    const blobCount = await prisma.encryptedBlob.count({ where: { ownerUserId: user.id, kind: 'persona' } });
    const consents = await prisma.consent.findMany({ where: { userId: user.id } });
    return res.json({ ok: true, user: { id: user.id, walletAddress: user.walletAddress, generatedUserId: user.generatedUserId, walletProvider: user.walletProvider }, hasPersona: blobCount > 0, consents });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// Store encrypted persona envelope and wrapped DEK
// Body: { envelope: { alg, ct, iv, tag, v }, wrappedKey: { alg, ct, iv, tag, v }, wrapMeta }
app.post('/api/user/persona', authenticate, async (req, res) => {
  const { envelope, wrappedKey, wrapMeta, meta } = req.body;
  if (!envelope || !wrappedKey) return res.status(400).json({ error: 'envelope and wrappedKey required' });

  try {
    // store wrapped key
    await prisma.userKeyWrap.create({
      data: {
        userId: req.user.id,
        wrappedKey,
        wrapMeta: wrapMeta ?? {},
        purpose: (wrapMeta && wrapMeta.purpose) || 'persona',
      },
    });

    // store encrypted blob
    await prisma.encryptedBlob.create({
      data: {
        ownerUserId: req.user.id,
        kind: 'persona',
        envelope: envelope,
        meta: meta ?? {},
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});
