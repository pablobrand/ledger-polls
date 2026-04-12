export function getSessionToken() {
  return localStorage.getItem('sessionToken');
}

export function clearSession() {
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('walletAddress');
}

export async function authorizedFetch(url, options = {}) {
  const token = getSessionToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export async function fetchCurrentUser() {
  const response = await authorizedFetch('/api/user/me');
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load the current user.');
  }

  return payload;
}

export async function fetchPersonaRecord() {
  const response = await authorizedFetch('/api/user/persona');
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load the encrypted persona record.');
  }

  return payload;
}

export async function fetchAudienceSummary(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value).trim());
    }
  });

  const url = `/api/audience/summary${params.toString() ? `?${params.toString()}` : ''}`;
  let response = await authorizedFetch(url);
  let payload = await response.json().catch(() => null);

  // Fallback to public aggregate endpoint if session is stale.
  if (response.status === 401) {
    const publicUrl = `/api/public/audience/summary${params.toString() ? `?${params.toString()}` : ''}`;
    response = await fetch(publicUrl);
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load audience summary.');
  }

  return payload;
}