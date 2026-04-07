// Minimal Web Crypto helpers for DEK generation, AES-GCM encrypt/decrypt, and HKDF-based KEK derivation.
// NOTE: This is demo code. For production, store keys in secure storage (IndexedDB/WebCrypto key storage) and review nonce & AAD handling.

export async function generateDEK() {
  return await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportRawKey(key) {
  const raw = await window.crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

export async function importRawKey(raw) {
  return await window.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function encryptWithDEK(key, plaintextJson) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(plaintextJson));
  const ct = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    alg: 'AES-GCM',
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ct)),
  };
}

export async function decryptWithDEK(key, envelope) {
  const iv = new Uint8Array(envelope.iv);
  const ct = new Uint8Array(envelope.ct);
  const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plain));
}

// Derive a KEK via HKDF from signature bytes and salt
export async function deriveKEKFromSignature(signatureBytes, saltBytes, info = new Uint8Array()) {
  // import signature as raw key material
  const baseKey = await window.crypto.subtle.importKey('raw', signatureBytes, 'HKDF', false, ['deriveKey']);
  const kek = await window.crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return kek;
}

// Wrap DEK by exporting raw DEK and encrypting with KEK (AES-GCM)
export async function wrapDEK(kek, dekKey) {
  const rawDek = await exportRawKey(dekKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ct = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, rawDek);
  return {
    alg: 'AES-GCM',
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ct)),
  };
}
