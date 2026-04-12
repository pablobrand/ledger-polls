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
const isDevelopment = process.env.NODE_ENV !== 'production';

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

function buildWalletLoginMessage(nonce) {
  return `Ledger Polls login nonce: ${nonce}`;
}

function toNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length ? v : null;
}

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function toAgeFromBirthYear(birthYear) {
  const year = toInt(birthYear);
  if (!year) return null;
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  return age >= 0 && age <= 120 ? age : null;
}

function ageBand(age) {
  if (age == null) return 'Unknown';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  if (age < 65) return '55-64';
  return '65+';
}

function tally(values) {
  const map = new Map();
  for (const value of values) {
    const key = toNonEmptyString(value) || 'Unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function extractProfileFromMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;

  if (meta.profile && typeof meta.profile === 'object') return meta.profile;
  if (meta.profileForm && typeof meta.profileForm === 'object') return meta.profileForm;
  if (meta.attributes && typeof meta.attributes === 'object') return meta.attributes;

  const directKeys = ['city', 'state', 'country', 'birthYear', 'sex', 'educationLevel'];
  const hasDirectShape = directKeys.some((key) => key in meta);
  return hasDirectShape ? meta : null;
}

async function getLatestPersonaRecord(userId) {
  const [blob, wrap] = await prisma.$transaction([
    prisma.encryptedBlob.findFirst({
      where: { ownerUserId: userId, kind: 'persona' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userKeyWrap.findFirst({
      where: { userId, purpose: 'persona' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { blob, wrap };
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
  const { walletAddress, walletProvider, walletPublicKey, authMode } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });

  const mode = authMode === 'signup' ? 'signup' : 'signin';

  try {
    // generate a nonce (server-challenge). Use 24 bytes base64 to include enough entropy.
    const nonce = crypto.randomBytes(24).toString('base64');

    // Resolve user based on explicit auth mode.
    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (mode === 'signin' && !user) {
      return res.status(404).json({ error: 'Wallet not registered. Please use Sign Up first.' });
    }

    let created = false;
    if (!user && mode === 'signup') {
      user = await prisma.user.create({
        data: {
          walletAddress,
          generatedUserId: makeGeneratedUserId(),
        },
      });
      created = true;
    }

    // Store each nonce as its own row so verification can match the exact challenge
    // even if multiple login requests are issued quickly.
    await prisma.walletAuth.create({
      data: {
        userId: user.id,
        walletAddress,
        provider: walletProvider ?? 'phantom',
        lastNonce: nonce,
      },
    });

    return res.json({ ok: true, nonce, mode, created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// Step 2: Verify signature over the nonce and establish a session.
// POST /api/auth/verify
// Body: { walletAddress, signature (base64), publicKey (base58) }
app.post('/api/auth/verify', async (req, res) => {
  const { walletAddress, signature, publicKey, nonce } = req.body;
  if (!walletAddress || !signature || !publicKey || !nonce) {
    return res.status(400).json({ error: 'walletAddress, signature, publicKey, and nonce required' });
  }

  try {
    const wa = await prisma.walletAuth.findFirst({
      where: { walletAddress, lastNonce: nonce },
      orderBy: { createdAt: 'desc' },
    });
    if (!wa || !wa.lastNonce) return res.status(400).json({ error: 'nonce not found for this walletAddress; call /api/auth/login first' });

    // Prepare candidate messages.
    // - Legacy format: raw bytes decoded from base64 nonce.
    // - Current format: readable UTF-8 challenge string.
    const legacyMessage = Buffer.from(nonce, 'base64');
    const currentMessage = Buffer.from(buildWalletLoginMessage(nonce), 'utf8');
    // signature expected as base64
    const sig = Buffer.from(signature, 'base64');
    let pubkey;

    try {
      // publicKey expected as base58 (Solana)
      pubkey = bs58.decode(publicKey);
    } catch {
      return res.status(400).json({ error: 'publicKey must be a valid base58 string' });
    }

    if (!sig.length) {
      return res.status(400).json({ error: 'signature must be valid base64 data' });
    }

    if (isDevelopment) {
      try {
        console.debug('[DEV] verify attempt for', walletAddress);
        console.debug('[DEV] verifyNonce (b64):', nonce);
      } catch (logErr) {
        console.error('error logging debug info', logErr);
      }
    }

    const verified =
      nacl.sign.detached.verify(new Uint8Array(currentMessage), new Uint8Array(sig), new Uint8Array(pubkey)) ||
      nacl.sign.detached.verify(new Uint8Array(legacyMessage), new Uint8Array(sig), new Uint8Array(pubkey));
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

  // Clear this nonce on matching rows to prevent replay.
  await prisma.walletAuth.updateMany({
    where: { walletAddress, lastNonce: nonce },
    data: { lastSignedAt: now, lastNonce: null },
  });

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

    const user = await prisma.user.findFirst({
      where: { sessionToken: token },
      orderBy: { dateLogged: 'desc' },
    });
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
    const { blob } = await getLatestPersonaRecord(user.id);
    const consents = await prisma.consent.findMany({ where: { userId: user.id } });
    return res.json({
      ok: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        generatedUserId: user.generatedUserId,
        walletProvider: user.walletProvider,
      },
      hasPersona: !!blob,
      personaCreatedAt: blob?.createdAt ?? null,
      consents,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

app.get('/api/user/persona', authenticate, async (req, res) => {
  try {
    const { blob, wrap } = await getLatestPersonaRecord(req.user.id);

    if (!blob || !wrap) {
      return res.status(404).json({ error: 'persona not found' });
    }

    return res.json({
      ok: true,
      persona: {
        envelope: blob.envelope,
        meta: blob.meta,
        createdAt: blob.createdAt,
      },
      wrappedKey: {
        wrappedKey: wrap.wrappedKey,
        wrapMeta: wrap.wrapMeta,
        createdAt: wrap.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// Audience estimation endpoint based on non-PII profile snapshot metadata.
// Query params: educationLevel, minAge, maxAge, country, state, city, sex
async function handleAudienceSummary(req, res) {
  try {
    const filters = {
      educationLevel: toNonEmptyString(req.query.educationLevel),
      country: toNonEmptyString(req.query.country),
      state: toNonEmptyString(req.query.state),
      city: toNonEmptyString(req.query.city),
      sex: toNonEmptyString(req.query.sex),
      minAge: toInt(req.query.minAge),
      maxAge: toInt(req.query.maxAge),
    };

    const blobs = await prisma.encryptedBlob.findMany({
      where: { kind: 'persona' },
      orderBy: { createdAt: 'desc' },
      select: {
        ownerUserId: true,
        meta: true,
        createdAt: true,
      },
    });

    // Latest persona per user
    const latestByUser = new Map();
    for (const blob of blobs) {
      if (!latestByUser.has(blob.ownerUserId)) {
        latestByUser.set(blob.ownerUserId, blob);
      }
    }

    const profiles = [];
    for (const blob of latestByUser.values()) {
      const profile = extractProfileFromMeta(blob?.meta);
      if (!profile || typeof profile !== 'object') continue;
      const normalized = {
        ownerUserId: blob.ownerUserId,
        city: toNonEmptyString(profile.city),
        state: toNonEmptyString(profile.state),
        country: toNonEmptyString(profile.country),
        birthYear: toNonEmptyString(profile.birthYear),
        sex: toNonEmptyString(profile.sex),
        educationLevel: toNonEmptyString(profile.educationLevel),
      };
      profiles.push({
        ...normalized,
        age: toAgeFromBirthYear(normalized.birthYear),
      });
    }

    const filtered = profiles.filter((p) => {
      if (filters.educationLevel && p.educationLevel !== filters.educationLevel) return false;
      if (filters.country && p.country !== filters.country) return false;
      if (filters.state && p.state !== filters.state) return false;
      if (filters.city && p.city !== filters.city) return false;
      if (filters.sex && p.sex !== filters.sex) return false;
      if (filters.minAge != null && (p.age == null || p.age < filters.minAge)) return false;
      if (filters.maxAge != null && (p.age == null || p.age > filters.maxAge)) return false;
      return true;
    });

    return res.json({
      ok: true,
      totals: {
        totalProfiles: profiles.length,
        matchedProfiles: filtered.length,
      },
      distributions: {
        education: tally(filtered.map((p) => p.educationLevel)),
        sex: tally(filtered.map((p) => p.sex)),
        country: tally(filtered.map((p) => p.country)),
        ageBand: tally(filtered.map((p) => ageBand(p.age))),
      },
      preview: filtered.slice(0, 10).map((p) => ({
        ownerUserId: p.ownerUserId,
        educationLevel: p.educationLevel || 'Unknown',
        age: p.age,
        sex: p.sex || 'Unknown',
        city: p.city || 'Unknown',
        state: p.state || 'Unknown',
        country: p.country || 'Unknown',
      })),
      filters,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
}

app.get('/api/audience/summary', authenticate, handleAudienceSummary);
app.get('/api/public/audience/summary', handleAudienceSummary);

// Store encrypted persona envelope and wrapped DEK
// Body: { envelope: { alg, ct, iv, tag, v }, wrappedKey: { alg, ct, iv, tag, v }, wrapMeta }
app.post('/api/user/persona', authenticate, async (req, res) => {
  const { envelope, wrappedKey, wrapMeta, meta } = req.body;
  if (!envelope || !wrappedKey) return res.status(400).json({ error: 'envelope and wrappedKey required' });

  try {
    const personaMeta = {
      ...(meta ?? {}),
      fieldCount: Array.isArray(meta?.fields) ? meta.fields.length : undefined,
    };

    const result = await prisma.$transaction(async (tx) => {
      await tx.userKeyWrap.deleteMany({ where: { userId: req.user.id, purpose: 'persona' } });
      await tx.encryptedBlob.deleteMany({ where: { ownerUserId: req.user.id, kind: 'persona' } });

      const newWrap = await tx.userKeyWrap.create({
        data: {
          userId: req.user.id,
          wrappedKey,
          wrapMeta: wrapMeta ?? {},
          purpose: (wrapMeta && wrapMeta.purpose) || 'persona',
        },
      });

      const newBlob = await tx.encryptedBlob.create({
        data: {
          ownerUserId: req.user.id,
          kind: 'persona',
          envelope,
          meta: personaMeta,
        },
      });

      return { newWrap, newBlob };
    });

    return res.json({ ok: true, personaCreatedAt: result.newBlob.createdAt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});
