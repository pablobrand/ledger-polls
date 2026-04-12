export function toBase64(bytes) {
  let binary = '';
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  for (let i = 0; i < buffer.byteLength; i += 1) {
    binary += String.fromCharCode(buffer[i]);
  }

  return window.btoa(binary);
}

export function base64ToUint8Array(b64) {
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function buildWalletLoginMessage(nonce) {
  return `Ledger Polls login nonce: ${nonce}`;
}

function normalizeSignatureBytes(signatureResult) {
  if (signatureResult instanceof Uint8Array) {
    return signatureResult;
  }

  if (signatureResult?.signature instanceof Uint8Array) {
    return signatureResult.signature;
  }

  if (signatureResult?.signature) {
    return new Uint8Array(signatureResult.signature);
  }

  return new Uint8Array(signatureResult);
}

export function getBrowserWalletProvider() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.phantom?.solana?.isPhantom) {
    return window.phantom.solana;
  }

  return window.solana ?? null;
}

export function getFriendlyWalletError(error) {
  const message = error?.message || 'Wallet authentication failed.';

  if (/User rejected|User declined|cancelled|canceled/i.test(message)) {
    return 'Wallet signature was cancelled. Please approve the message to continue.';
  }

  if (/sign solana transactions using sign message/i.test(message)) {
    return 'The connected wallet adapter rejected message signing. Reopen the wallet popup and try again, or reconnect Phantom.';
  }

  if (/wallet does not support signMessage/i.test(message)) {
    return 'This wallet does not support message signing.';
  }

  return message;
}

export async function signNonceWithWallet({ nonce, signMessage }) {
  const message = buildWalletLoginMessage(nonce);
  const messageBytes = new TextEncoder().encode(message);
  let signed;
  let usedFallback = false;

  if (typeof signMessage === 'function') {
    try {
      signed = await signMessage(messageBytes);
    } catch (error) {
      const provider = getBrowserWalletProvider();

      if (!provider || typeof provider.signMessage !== 'function') {
        throw error;
      }

      usedFallback = true;
      signed = await provider.signMessage(messageBytes, 'utf8');
    }
  } else {
    const provider = getBrowserWalletProvider();

    if (!provider || typeof provider.signMessage !== 'function') {
      throw new Error('wallet does not support signMessage');
    }

    usedFallback = true;
    signed = await provider.signMessage(messageBytes, 'utf8');
  }

  const signatureBytes = normalizeSignatureBytes(signed);
  const signedPublicKey = signed?.publicKey?.toString?.() ?? null;

  return {
    messageBytes,
    signatureBytes,
    signatureBase64: toBase64(signatureBytes),
    signedPublicKey,
    usedFallback,
  };
}