import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, fetchAudienceSummary, fetchCurrentUser, fetchPersonaRecord, getSessionToken } from '../utils/session';
import { decryptWithDEK, importRawKey } from '../utils/crypto';
import { profileFieldLabels, profileOptions } from '../utils/profileTemplate';

function base64ToUint8Array(b64) {
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function DistributionBars({ title, items, colorClass }) {
  const max = items?.length ? Math.max(...items.map((i) => i.count), 1) : 1;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
      {!items?.length && <p className="mt-3 text-xs text-slate-400">No data yet.</p>}
      <div className="mt-3 space-y-2">
        {(items || []).map((item) => {
          const width = `${Math.max((item.count / max) * 100, 6)}%`;
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 rounded bg-slate-800">
                <div className={`h-2 rounded ${colorClass}`} style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Welcome() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [personaMeta, setPersonaMeta] = useState(null);
  const [decryptedProfile, setDecryptedProfile] = useState(null);
  const [audienceSummary, setAudienceSummary] = useState(null);
  const [audienceStatus, setAudienceStatus] = useState('Loading audience insights...');
  const [audienceError, setAudienceError] = useState('');
  const [filters, setFilters] = useState({
    educationLevel: '',
    minAge: '',
    maxAge: '',
    country: '',
    state: '',
    city: '',
    sex: '',
  });
  const [status, setStatus] = useState('Loading your account...');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      if (!getSessionToken()) {
        navigate('/');
        return;
      }

      try {
        const me = await fetchCurrentUser();
        setProfile(me);

        if (me.hasPersona) {
          try {
            const persona = await fetchPersonaRecord();
            setPersonaMeta(persona.persona);

            const rawStored = localStorage.getItem('dek_raw_b64');
            if (rawStored && persona?.persona?.envelope) {
              const raw = base64ToUint8Array(rawStored);
              const dek = await importRawKey(raw);
              const plain = await decryptWithDEK(dek, persona.persona.envelope);
              setDecryptedProfile(plain);
            }
          } catch (personaError) {
            console.warn('failed to load persona details', personaError);
          }
        }

        setStatus('Account loaded.');
      } catch (loadError) {
        setError(loadError.message);
        setStatus('Could not load your account.');
        if (/session/i.test(loadError.message) || /authorization/i.test(loadError.message)) {
          clearSession();
          navigate('/');
        }
      }
    }

    loadDashboard();
  }, [navigate]);

  async function loadAudience(filtersToApply = filters) {
    try {
      setAudienceError('');
      setAudienceStatus('Calculating reachable audience...');
      const payload = await fetchAudienceSummary(filtersToApply);
      setAudienceSummary(payload);
      setAudienceStatus('Audience estimate updated.');
    } catch (loadErr) {
      setAudienceError(loadErr.message);
      setAudienceStatus('Could not load audience insights.');
    }
  }

  useEffect(() => {
    loadAudience();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleLogout() {
    clearSession();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-8 shadow-2xl">
          <h2 className="text-3xl font-semibold">Welcome</h2>
          <p className="mt-2 text-slate-300">{status}</p>
        </div>

        {error && <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">{error}</div>}

        {profile?.user && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <h3 className="text-xl font-semibold">Account</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><span className="text-slate-400">Wallet:</span> {profile.user.walletAddress}</div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><span className="text-slate-400">Provider:</span> {profile.user.walletProvider || 'unknown'}</div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:col-span-2"><span className="text-slate-400">Generated user id:</span> {profile.user.generatedUserId}</div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><span className="text-slate-400">Encrypted profile:</span> {profile.hasPersona ? 'saved' : 'not saved yet'}</div>
              {profile.personaCreatedAt && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><span className="text-slate-400">Saved at:</span> {new Date(profile.personaCreatedAt).toLocaleString()}</div>
              )}
            </div>
          </div>
        )}

        {decryptedProfile && (
          <div className="rounded-3xl border border-green-500/30 bg-green-500/5 p-6">
            <h3 className="text-xl font-semibold text-green-200">Survey Pool Attributes</h3>
            <p className="mt-2 text-sm text-green-100/80">Non-PII segmentation details available for survey targeting.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(decryptedProfile)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-green-500/20 bg-slate-900/60 p-3 text-sm text-slate-200">
                    <span className="text-green-200">{profileFieldLabels[key] || key}:</span> {String(value)}
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <h3 className="text-xl font-semibold text-blue-200">Audience Reach Estimator</h3>
          <p className="mt-2 text-sm text-slate-300">
            Estimate the number of participants you can reach using non-PII filters like education, age band, sex, and location.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Education Level</label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={filters.educationLevel}
                onChange={(e) => updateFilter('educationLevel', e.target.value)}
              >
                <option value="">Any</option>
                {profileOptions.educationLevel.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Sex</label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={filters.sex}
                onChange={(e) => updateFilter('sex', e.target.value)}
              >
                <option value="">Any</option>
                {profileOptions.sex.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Min Age</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={filters.minAge}
                onChange={(e) => updateFilter('minAge', e.target.value)}
                placeholder="30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Max Age</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={filters.maxAge}
                onChange={(e) => updateFilter('maxAge', e.target.value)}
                placeholder="40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Country</label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={filters.country}
                onChange={(e) => updateFilter('country', e.target.value)}
                placeholder="United States"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">State/Region</label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={filters.state}
                onChange={(e) => updateFilter('state', e.target.value)}
                placeholder="Texas"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">City</label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={filters.city}
                onChange={(e) => updateFilter('city', e.target.value)}
                placeholder="Austin"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => loadAudience(filters)}
              >
                Apply Filters
              </button>
              <button
                className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm"
                onClick={() => {
                  const cleared = {
                    educationLevel: '', minAge: '', maxAge: '', country: '', state: '', city: '', sex: '',
                  };
                  setFilters(cleared);
                  loadAudience(cleared);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-green-200">Matched Reach</p>
              <p className="mt-1 text-3xl font-semibold text-white">{audienceSummary?.totals?.matchedProfiles ?? 0}</p>
            </div>
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-blue-200">Total Available Profiles</p>
              <p className="mt-1 text-3xl font-semibold text-white">{audienceSummary?.totals?.totalProfiles ?? 0}</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400">{audienceStatus}</p>
          {audienceError && <div className="mt-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">{audienceError}</div>}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <DistributionBars title="Education Distribution" items={audienceSummary?.distributions?.education || []} colorClass="bg-blue-500" />
            <DistributionBars title="Age Band Distribution" items={audienceSummary?.distributions?.ageBand || []} colorClass="bg-green-500" />
            <DistributionBars title="Country Distribution" items={audienceSummary?.distributions?.country || []} colorClass="bg-blue-400" />
            <DistributionBars title="Sex Distribution" items={audienceSummary?.distributions?.sex || []} colorClass="bg-green-400" />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <h4 className="text-sm font-semibold text-slate-100">Matched Profile Preview (DB)</h4>
            <p className="mt-1 text-xs text-slate-400">Shows up to 10 records from the current DB query.</p>
            {(!audienceSummary?.preview || audienceSummary.preview.length === 0) && (
              <p className="mt-3 text-xs text-slate-400">No matching records for current filters.</p>
            )}
            {audienceSummary?.preview?.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-300">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="px-2 py-2">User</th>
                      <th className="px-2 py-2">Education</th>
                      <th className="px-2 py-2">Age</th>
                      <th className="px-2 py-2">Sex</th>
                      <th className="px-2 py-2">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audienceSummary.preview.map((row) => (
                      <tr key={`${row.ownerUserId}-${row.city}-${row.educationLevel}`} className="border-t border-slate-800">
                        <td className="px-2 py-2">{row.ownerUserId}</td>
                        <td className="px-2 py-2">{row.educationLevel}</td>
                        <td className="px-2 py-2">{row.age ?? 'Unknown'}</td>
                        <td className="px-2 py-2">{row.sex}</td>
                        <td className="px-2 py-2">{row.city}, {row.state}, {row.country}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {personaMeta?.meta?.fields?.length > 0 && !decryptedProfile && (
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
            Encrypted fields: {personaMeta.meta.fields.join(', ')}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
            onClick={() => navigate('/persona')}
          >
          {profile?.hasPersona ? 'Update persona' : 'Create persona'}
        </button>
          <button
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm"
            onClick={() => window.location.reload()}
          >
          Refresh status
        </button>
          <button
            className="rounded-xl bg-green-500 px-5 py-3 text-sm font-semibold text-slate-950"
            onClick={handleLogout}
          >
          Log out
        </button>
        </div>
      </div>
    </div>
  );
}

export default Welcome;
