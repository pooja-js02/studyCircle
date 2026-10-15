export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const TOKEN_KEY = 'studycircle.token';

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // private mode: the session lasts for this tab only
    }
  },
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'Something went wrong. Please try again.');
    this.status = status;
    this.code = body?.error?.code || 'error';
    this.details = body?.error?.details;
    this.field = body?.error?.details?.field;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

/** Absolute URL for avatars and other server paths */
export const assetUrl = (path) => (path && path.startsWith('/') ? `${API_URL}${path}` : path);

async function request(method, path, { body, form, signal, raw } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, { error: { code: 'network', message: 'Could not reach StudyCircle. Check your connection and try again.' } });
  }

  if (raw && res.ok) return res;
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new ApiError(res.status, data);
    // FR-AUTH-07: an invalid or expired token sends the user back to login
    if (res.status === 401 && token && error.code === 'token_invalid') onUnauthorized();
    if (res.status === 403 && error.code === 'banned') onUnauthorized(error.message);
    throw error;
  }
  return data;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, body, opts) => request('DELETE', path, { ...opts, body }),
  upload: (path, form, opts) => request('POST', path, { ...opts, form }),
  /** Fetches a protected file as a blob (for the in-app viewer and downloads). */
  async blob(path) {
    const res = await request('GET', path, { raw: true });
    return res.blob();
  },
};
