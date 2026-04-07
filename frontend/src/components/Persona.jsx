import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { generateDEK, exportRawKey, importRawKey, encryptWithDEK, deriveKEKFromSignature, wrapDEK } from '../utils/crypto';

function arrayToBase64(arr) {
  return window.btoa(String.fromCharCode(...arr));
}

function base64ToUint8Array(b64) {
  const binary = window.atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function Persona() {
  const { publicKey, signMessage } = useWallet();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [status, setStatus] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    if (!publicKey) return alert('Please connect wallet');
    if (!signMessage) return alert('Wallet does not support signMessage');

    setStatus('Generating DEK...');
    // simple DEK storage for demo (NOT secure). In prod, store in IndexedDB WebCrypto key storage.
    let dekKey = null;
    const rawStored = localStorage.getItem('dek_raw_b64');
    if (rawStored) {
      const raw = base64ToUint8Array(rawStored);
      dekKey = await importRawKey(raw);
    } else {
      dekKey = await generateDEK();
      const raw = await exportRawKey(dekKey);
      localStorage.setItem('dek_raw_b64', arrayToBase64(raw));
    }

    setStatus('Encrypting persona...');
    const envelope = await encryptWithDEK(dekKey, { firstName, lastName });

    // request a fresh nonce to derive KEK and wrap DEK
    setStatus('Requesting nonce...');
    const walletAddress = publicKey.toString();
    const nonceResp = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ walletAddress }) }).then(r => r.json());
    if (!nonceResp || !nonceResp.nonce) return setStatus('failed to get nonce');

    // sign nonce
    setStatus('Signing nonce...');
    const encoder = new TextEncoder();
    const sig = await signMessage(encoder.encode(nonceResp.nonce));
    const sigBytes = sig instanceof Uint8Array ? sig : sig.signature || sig;

    // derive KEK and wrap DEK
    setStatus('Deriving KEK and wrapping DEK...');
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const kek = await deriveKEKFromSignature(sigBytes, salt);
    const wrapped = await wrapDEK(kek, dekKey);

    // prepare payload
    const payload = {
      envelope,
      wrappedKey: wrapped,
      wrapMeta: { kdf: 'HKDF-SHA256', salt: Array.from(salt), purpose: 'persona' },
      meta: { client: 'web' },
    };

    setStatus('Uploading persona...');
    const sessionToken = localStorage.getItem('sessionToken');
    const res = await fetch('/api/user/persona', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` }, body: JSON.stringify(payload) });
    if (res.ok) {
      setStatus('Persona uploaded');
    } else {
      const text = await res.text();
      setStatus('Upload failed: ' + text);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto' }}>
      <h2>Create Persona</h2>
      <form onSubmit={onSubmit}>
        <div>
          <label>First name</label>
          <input value={firstName} onChange={e => setFirstName(e.target.value)} />
        </div>
        <div>
          <label>Last name</label>
          <input value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
        <button type="submit">Save Persona</button>
      </form>
      <div style={{ marginTop: 12 }}>{status}</div>
    </div>
  );
}
