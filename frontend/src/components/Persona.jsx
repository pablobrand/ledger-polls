import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { generateDEK, exportRawKey, importRawKey, encryptWithDEK, deriveKEKFromSignature, wrapDEK } from '../utils/crypto';
import { getFriendlyWalletError, signNonceWithWallet } from '../utils/walletAuth';
import { fetchPersonaRecord, getSessionToken } from '../utils/session';
import {
  birthMonthOptions,
  birthYearOptions,
  defaultSurveyProfile,
  profileFieldLabels,
  profileOptions,
} from '../utils/profileTemplate';

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
  const navigate = useNavigate();
  const [profileForm, setProfileForm] = useState(defaultSurveyProfile);
  const [status, setStatus] = useState('Load or create your encrypted persona.');
  const [error, setError] = useState('');
  const [existingPersona, setExistingPersona] = useState(null);

  function updateField(field, value) {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    async function loadExistingPersona() {
      const sessionToken = getSessionToken();

      if (!sessionToken) {
        navigate('/');
        return;
      }

      try {
        const payload = await fetchPersonaRecord();
        setExistingPersona(payload.persona);
        setStatus('An encrypted persona already exists. Saving again will replace it.');
      } catch (loadError) {
        if (/persona not found/i.test(loadError.message)) {
          setStatus('No encrypted persona found yet.');
          return;
        }

        setError(loadError.message);
      }
    }

    loadExistingPersona();
  }, [navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!publicKey) return alert('Please connect wallet');
    setError('');

    try {
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
      const envelope = await encryptWithDEK(dekKey, profileForm);

      setStatus('Requesting nonce...');
      const walletAddress = publicKey.toString();
      const nonceResp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      }).then((r) => r.json());

      if (!nonceResp || !nonceResp.nonce) {
        setStatus('Failed to get a nonce from the backend.');
        return;
      }

      setStatus('Signing nonce...');
      const signed = await signNonceWithWallet({ nonce: nonceResp.nonce, signMessage });

      setStatus('Deriving KEK and wrapping DEK...');
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const kek = await deriveKEKFromSignature(signed.signatureBytes, salt);
      const wrapped = await wrapDEK(kek, dekKey);

      const payload = {
        envelope,
        wrappedKey: wrapped,
        wrapMeta: { kdf: 'HKDF-SHA256', salt: Array.from(salt), purpose: 'persona' },
        meta: {
          client: 'web',
          fields: Object.keys(profileForm),
          // Non-PII snapshot used for audience estimation and filtering.
          profile: profileForm,
        },
      };

      setStatus('Uploading persona...');
      const sessionToken = getSessionToken();
      const res = await fetch('/api/user/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const responsePayload = await res.json().catch(() => null);
        setExistingPersona({ createdAt: responsePayload?.personaCreatedAt ?? new Date().toISOString() });
        setStatus('Persona uploaded successfully. Redirecting...');
        navigate('/welcome');
      } else {
        const text = await res.text();
        setStatus('Upload failed: ' + text);
      }
    } catch (error) {
      console.error('persona upload failed', error);
      setError(getFriendlyWalletError(error));
      setStatus('Persona upload failed.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        <h2 className="text-2xl font-semibold">Survey Profile (Non-PII)</h2>
        <p className="mt-2 text-sm text-slate-400">
          This profile stores segmentation attributes only. Avoid names, emails, phone numbers, and exact street addresses.
        </p>
      {existingPersona?.createdAt && (
          <div className="mt-5 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-100">
          Existing encrypted persona found on the server from {new Date(existingPersona.createdAt).toLocaleString()}.
        </div>
      )}

        <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-300">City</label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={profileForm.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="Example: Austin"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">State/Region</label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={profileForm.state}
              onChange={(e) => updateField('state', e.target.value)}
              placeholder="Example: Texas"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Country</label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={profileForm.country}
              onChange={(e) => updateField('country', e.target.value)}
              placeholder="Example: United States"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Sex</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={profileForm.sex}
              onChange={(e) => updateField('sex', e.target.value)}
            >
              <option value="">Select</option>
              {profileOptions.sex.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Birth Year</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={profileForm.birthYear}
              onChange={(e) => updateField('birthYear', e.target.value)}
            >
              <option value="">Select year</option>
              {birthYearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Birth Month</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={profileForm.birthMonth}
              onChange={(e) => updateField('birthMonth', e.target.value)}
            >
              <option value="">Select month</option>
              {birthMonthOptions.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          {[
            'educationLevel',
            'employmentStatus',
            'householdIncomeBracket',
            'maritalStatus',
            'primaryDeviceType',
            'internetAccessType',
            'surveyAvailability',
            'participationFrequency',
          ].map((fieldKey) => (
            <div key={fieldKey}>
              <label className="mb-2 block text-sm text-slate-300">{profileFieldLabels[fieldKey]}</label>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={profileForm[fieldKey]}
                onChange={(e) => updateField(fieldKey, e.target.value)}
              >
                <option value="">Select</option>
                {profileOptions[fieldKey].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          ))}

          <div className="sm:col-span-2 mt-2 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-green-500 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Save Encrypted Profile
            </button>
            <button
              type="button"
              onClick={() => navigate('/welcome')}
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium"
            >
              Back to Welcome
            </button>
          </div>
        </form>

        <div className="mt-5 text-sm text-slate-300">{status}</div>
        {error && <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">{error}</div>}
        </div>
    </div>
  );
}
