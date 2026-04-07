
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletModalButton } from '@solana/wallet-adapter-react-ui';

async function requestNonce(walletAddress) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.error('Failed to request nonce', err);
    return null;
  }
}

function toBase64(bytes) {
  // browser-safe base64 from Uint8Array
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

function base64ToUint8Array(b64) {
  const binary = window.atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifySignatureWithServer(walletAddress, publicKey, signatureBase64) {
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, publicKey, signature: signatureBase64 }),
    });
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.error('Failed to verify signature with server', err);
    return null;
  }
}

function Login() {
  const { connected, publicKey, signMessage, connect, wallet, connecting, readyState } = useWallet();
  const navigate = useNavigate();
  const [evalBlocked, setEvalBlocked] = useState(false);
  const [providerDetected, setProviderDetected] = useState(true);

  useEffect(() => {
    // quick automatic probe on mount: eval and provider
    async function autoProbe() {
      // CSP / eval probe
      try {
        // eslint-disable-next-line no-eval
        const r = eval('1+1');
        console.debug('auto eval probe result', r);
        setEvalBlocked(false);
      } catch (e) {
        console.warn('auto eval blocked', e && e.message ? e.message : e);
        setEvalBlocked(true);
      }

      // provider probe
      try {
        const hasProvider = typeof window !== 'undefined' && !!window.solana;
        setProviderDetected(!!hasProvider);
        console.debug('auto provider probe', { hasProvider });
      } catch (e) {
        setProviderDetected(false);
      }
    }
    autoProbe();

    async function onConnect() {
      if (!publicKey) return;
      const walletAddress = publicKey.toString();
      const nonceResp = await requestNonce(walletAddress);
      if (!nonceResp || !nonceResp.nonce) {
        console.error('no nonce from server');
        return;
      }

      // sign the nonce using the wallet (adapter must support signMessage)
      if (!signMessage) {
        console.error('wallet does not support signMessage');
        return;
      }

      const encoder = new TextEncoder();
      // nonceResp.nonce is base64-encoded random bytes from server; decode to raw bytes
      const message = base64ToUint8Array(nonceResp.nonce);
      try {
        let signed;
        // Try adapter signMessage first. Some adapters (or adapter wrappers) may throw
        // WalletSignMessageError when the underlying provider doesn't support signMessage.
        // If that happens, fall back to the in-page `window.solana.signMessage` when available.
        if (typeof signMessage === 'function') {
          try {
            signed = await signMessage(message);
          } catch (err) {
            // Known adapter error: try provider fallback
            console.debug('adapter.signMessage failed, attempting provider fallback', err?.message || err);
            if (window.solana && typeof window.solana.signMessage === 'function') {
              // Phantom provider expects (message, encoding) and returns { signature, publicKey }
              signed = await window.solana.signMessage(message, 'utf8');
            } else {
              throw err;
            }
          }
        } else if (window.solana && typeof window.solana.signMessage === 'function') {
          // Phantom in-page provider
          signed = await window.solana.signMessage(message, 'utf8');
        } else {
          throw new Error('wallet does not support signMessage');
        }

        // signMessage may return Uint8Array or an object with .signature
        const signature = signed instanceof Uint8Array ? signed : (signed && signed.signature) ? signed.signature : signed;
        const sigBytes = signature instanceof Uint8Array ? signature : new Uint8Array(signature);
        const sigBase64 = toBase64(sigBytes);

        console.debug('nonce (b64):', nonceResp.nonce);
        console.debug('signature (b64):', sigBase64);

        // Pass the actual publicKey string to the server (use the connected `publicKey` when available)
        const publicKeyString = publicKey ? publicKey.toString() : walletAddress;
        const verifyResp = await verifySignatureWithServer(walletAddress, publicKeyString, sigBase64);
        // NOTE: some providers return a publicKey alongside the signature when using
        // the in-page `window.solana.signMessage`. If available, prefer that value.
        const serverPublicKey = (signed && signed.publicKey) ? signed.publicKey.toString() : (publicKey ? publicKey.toString() : walletAddress);
        // If we passed a placeholder earlier, call verify again with correct publicKey
        if (verifyResp && !verifyResp.sessionToken && serverPublicKey && serverPublicKey !== walletAddress) {
          // retry with explicit publicKey
          const verifyResp2 = await verifySignatureWithServer(walletAddress, serverPublicKey, sigBase64);
          if (verifyResp2 && verifyResp2.sessionToken) {
            localStorage.setItem('sessionToken', verifyResp2.sessionToken);
            navigate('/welcome');
            return;
          }
        }
        if (verifyResp && verifyResp.sessionToken) {
          // store session token (consider httpOnly cookie in prod)
          localStorage.setItem('sessionToken', verifyResp.sessionToken);
          navigate('/welcome');
        } else {
          console.error('verify failed', verifyResp);
        }
      } catch (err) {
        console.error('signMessage failed', err);
      }
    }

    if (connected) onConnect();
  }, [connected, navigate]);

  function retryProbes() {
    try {
      // eval probe
      try {
        // eslint-disable-next-line no-eval
        const r = eval('1+1');
        console.debug('retry eval probe result', r);
        setEvalBlocked(false);
      } catch (e) {
        console.warn('retry eval blocked', e && e.message ? e.message : e);
        setEvalBlocked(true);
      }
      // provider probe
      const hasProvider = typeof window !== 'undefined' && !!window.solana;
      setProviderDetected(!!hasProvider);
      console.debug('retry provider probe', { hasProvider });
    } catch (err) {
      console.error('retry probes failed', err);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 100 }}>
      <h1 style={{ color: 'green', fontSize: 32 }}>Frontend is running!</h1>
      <h2>Login with Phantom Wallet</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <WalletModalButton style={{ padding: '10px 20px', fontSize: 18 }} />
        <button
          onClick={async () => {
            try {
              console.debug('manual connect clicked', { readyState, connecting, walletName: wallet?.adapter?.name });
              await connect();
            } catch (err) {
              console.error('connect() failed', err);
            }
          }}
          style={{ padding: '10px 12px' }}
        >
          Connect (manual)
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: '#444' }}>
        <div>Adapter: {wallet?.adapter?.name ?? 'none'}</div>
        <div>Ready state: {readyState ?? 'unknown'}</div>
        <div>Connecting: {connecting ? 'yes' : 'no'}</div>
        <div>Connected: {connected ? 'yes' : 'no'}</div>
      </div>
      {/* Banner to guide developer when CSP or provider prevents wallet injection */}
      { (evalBlocked || !providerDetected) && (
        <div style={{ marginTop: 12, padding: 12, background: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: 6, maxWidth: 720 }}>
          <strong>Wallet injection issue detected</strong>
          <div style={{ marginTop: 8 }}>
            { evalBlocked && <div>- Browser Content Security Policy appears to block dynamic evaluation (`eval`). This can prevent extensions from injecting providers.</div> }
            { !providerDetected && <div>- No `window.solana` provider detected. Ensure Phantom extension site access is set to <em>On all sites</em> and the extension is enabled.</div> }
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={retryProbes} style={{ padding: '6px 10px', marginRight: 8 }}>Retry probe</button>
            <button onClick={() => { window.location.reload(); }} style={{ padding: '6px 10px' }}>Reload page</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            Developer note: For local dev we relaxed the Vite dev server CSP to allow `'unsafe-eval'`. If this issue persists, try disabling other extensions (adblockers) or run in a fresh profile.
          </div>
        </div>
      ) }
      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => {
            try {
              console.log('window.solana:', window.solana);
              console.log('wallet.adapter:', wallet?.adapter);
              console.log('adapter readyState:', wallet?.adapter?.readyState);
              console.log('adapter publicKey:', wallet?.adapter?.publicKey?.toString?.());
              console.log('adapter signMessage exists:', typeof wallet?.adapter?.signMessage === 'function');
              console.log('useWallet signMessage exists:', typeof signMessage === 'function');
            } catch (err) {
              console.error('probe failed', err);
            }
          }}
          style={{ padding: '8px 10px', marginTop: 8 }}
        >
          Probe provider
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => {
            try {
              // quick eval probe to detect CSP blocking `eval`/string-eval
              try {
                // eslint-disable-next-line no-eval
                const r = eval('1+1');
                console.log('eval allowed, result:', r);
              } catch (e) {
                console.error('eval blocked by CSP or policy:', e && e.message ? e.message : e);
              }
            } catch (err) {
              console.error('CSP probe failed', err);
            }
          }}
          style={{ padding: '8px 10px', marginTop: 8 }}
        >
          Check CSP eval
        </button>
        <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
          If `eval` is blocked, extensions may be unable to inject needed scripts. Check Network → index.html response headers for `Content-Security-Policy`.
        </div>
      </div>
    </div>
  );
}

export default Login;
