
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletModalButton } from '@solana/wallet-adapter-react-ui';
import { getBrowserWalletProvider, getFriendlyWalletError, signNonceWithWallet } from '../utils/walletAuth';

async function requestNonce(walletAddress, authMode) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, authMode }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: payload?.error || 'Failed to request nonce.' };
    }
    return payload;
  } catch (err) {
    console.error('Failed to request nonce', err);
    return { ok: false, error: 'Failed to reach backend.' };
  }
}

async function verifySignatureWithServer(walletAddress, publicKey, signatureBase64, nonce) {
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, publicKey, signature: signatureBase64, nonce }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: payload?.error || 'Failed to verify wallet signature.' };
    }
    return payload;
  } catch (err) {
    console.error('Failed to verify signature with server', err);
    return { ok: false, error: 'Failed to reach the backend during signature verification.' };
  }
}

function Login() {
  const { connected, publicKey, signMessage, connect, wallet, connecting, readyState } = useWallet();
  const navigate = useNavigate();
  const [providerDetected, setProviderDetected] = useState(true);
  const [status, setStatus] = useState('Connect a wallet to begin.');
  const [error, setError] = useState('');
  const authInFlightRef = useRef(false);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    setProviderDetected(!!getBrowserWalletProvider());
  }, []);

  useEffect(() => {
    if (!connected) {
      setStatus('Connect a wallet to begin.');
      setError('');
    } else {
      setStatus('Wallet connected. Choose Sign Up or Sign In.');
    }
  }, [connected]);

  async function runAuth(authMode) {
    if (!publicKey || authInFlightRef.current) {
      return;
    }

    const walletAddress = publicKey.toString();
    authInFlightRef.current = true;
    setAuthBusy(true);
    setError('');

    setStatus(`Requesting ${authMode === 'signup' ? 'sign-up' : 'sign-in'} nonce...`);
    const nonceResp = await requestNonce(walletAddress, authMode);
    if (!nonceResp?.ok || !nonceResp?.nonce) {
      setError(nonceResp?.error || 'Could not get a nonce from the backend.');
      setStatus('Authentication failed.');
      authInFlightRef.current = false;
      setAuthBusy(false);
      return;
    }

    try {
      setStatus('Waiting for wallet signature...');
      const signed = await signNonceWithWallet({ nonce: nonceResp.nonce, signMessage });

      setStatus('Verifying signature with backend...');
      const verifyResp = await verifySignatureWithServer(
        walletAddress,
        walletAddress,
        signed.signatureBase64,
        nonceResp.nonce
      );

      if (verifyResp?.sessionToken) {
        localStorage.setItem('sessionToken', verifyResp.sessionToken);
        localStorage.setItem('walletAddress', walletAddress);
        setStatus('Wallet authenticated. Redirecting...');
        navigate('/welcome');
        return;
      }

      setError(verifyResp?.error || 'Wallet verification failed.');
      setStatus('Authentication failed.');
    } catch (err) {
      console.error('signMessage failed', err);
      setError(getFriendlyWalletError(err));
      setStatus('Authentication failed.');
    } finally {
      authInFlightRef.current = false;
      setAuthBusy(false);
    }
  }

  const trustedBrands = ['WalletConnect', 'ApeDAO', 'NovaChain', 'GreenNode', 'SurveyLabs', 'BlueMint'];

  const howItWorks = [
    {
      title: 'Connect & Verify Wallet',
      desc: 'Respondents authenticate using wallet signatures, reducing fake entries and improving trust.',
    },
    {
      title: 'Collect Non-PII Profile Data',
      desc: 'Capture segmentation-ready attributes like region, education, and device type without sensitive PII.',
    },
    {
      title: 'Build Reliable Survey Pools',
      desc: 'Match campaigns to relevant respondents using encrypted, consent-based profile attributes.',
    },
  ];

  const faqs = [
    {
      q: 'Do you store personal identifiers like names or emails?',
      a: 'No. The profile flow is designed for non-PII segmentation fields only.',
    },
    {
      q: 'How is profile data protected?',
      a: 'Profile data is encrypted on the client before upload and linked to wallet-authenticated sessions.',
    },
    {
      q: 'Why separate Sign Up and Sign In?',
      a: 'Sign Up registers a wallet for the first time. Sign In is for returning wallets and avoids ambiguous auth flows.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-10 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-300">Ledger Polls</p>
            <p className="text-sm text-slate-400">Web3 Survey Infrastructure</p>
          </div>
          <a href="#auth" className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200">
            Start Now
          </a>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-blue-950/30 to-green-950/20 p-8 shadow-2xl sm:p-10">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-200">
              Privacy-first Survey Platform
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              Launch engaging Web3 surveys with verifiable, reliable respondent pools.
            </h1>
            <p className="mt-5 text-base text-slate-300 sm:text-lg">
              Collect wallet-authenticated responses, segment by non-PII profile signals, and build trusted survey cohorts.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#auth" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">
                Connect Wallet
              </a>
              <a href="#how-it-works" className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200">
                See How It Works
              </a>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-400">Trusted by Web3 Teams</p>
          <div className="flex flex-wrap gap-2">
            {trustedBrands.map((brand) => (
              <span key={brand} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                {brand}
              </span>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mt-10">
          <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {howItWorks.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-lg font-semibold text-blue-200">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6">
            <h3 className="text-xl font-semibold text-green-200">Data Ownership by Design</h3>
            <p className="mt-2 text-sm text-green-100/90">
              Profile details are encrypted client-side before upload, supporting privacy and resilient survey operations.
            </p>
          </article>
          <article className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6">
            <h3 className="text-xl font-semibold text-blue-200">Template-Driven Segmentation</h3>
            <p className="mt-2 text-sm text-blue-100/90">
              Standardized non-PII fields make it easier to build repeatable targeting pipelines across campaigns.
            </p>
          </article>
        </section>

        <section id="auth" className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/85 p-8 shadow-xl backdrop-blur">
          <h2 className="text-2xl font-semibold">Wallet Authentication</h2>
          <p className="mt-2 text-sm text-slate-400">Connect Phantom and choose an action.</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <WalletModalButton className="!rounded-xl !bg-blue-500 !px-5 !py-3 !text-sm !font-semibold !text-white hover:!bg-blue-400" />
        <button
          onClick={async () => {
            try {
              setError('');
              setStatus('Opening wallet connection...');
              await connect();
            } catch (err) {
              console.error('connect() failed', err);
              setError(getFriendlyWalletError(err));
              setStatus('Connection failed.');
            }
          }}
          className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium hover:border-slate-500"
        >
          Connect
        </button>
        <button
          onClick={() => runAuth('signup')}
          disabled={!connected || authBusy}
          className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sign Up
        </button>
        <button
          onClick={() => runAuth('signin')}
          disabled={!connected || authBusy}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sign In
        </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">Adapter: {wallet?.adapter?.name ?? 'none'}</div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">Ready state: {readyState ?? 'unknown'}</div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">Connecting: {connecting ? 'yes' : 'no'}</div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">Connected: {connected ? 'yes' : 'no'}</div>
          </div>

      {!providerDetected && (
            <div className="mt-5 rounded-xl border border-blue-400/30 bg-blue-500/10 p-3 text-sm text-blue-100">
          No browser wallet provider was detected. Make sure Phantom is installed, enabled, and allowed on this site.
        </div>
      )}

          <div className="mt-5 min-h-6 text-sm text-slate-300">{status}</div>
      {error && (
            <div className="mt-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">
          {error}
        </div>
      )}
        </section>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((item) => (
              <details key={item.q} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-100">{item.q}</summary>
                <p className="mt-2 text-sm text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
