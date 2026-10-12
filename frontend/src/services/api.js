import axios from 'axios';

/**
 * Centralised Axios instance.
 *
 * - Attaches `Authorization: Bearer <jwt>` to every request when a token exists.
 * - Unwraps the API envelope so callers get `{ data, meta, message }` directly.
 * - Normalises every failure into an `ApiError` shape that the UI can render.
 */

export const TOKEN_KEY = 'hrvip:token';
export const USER_KEY = 'hrvip:user';

// Resolution order:
//  1. VITE_API_BASE_URL - explicit API base. Local dev sets
//     `http://localhost:5000/api`; production on Vercel sets the relative
//     `/api` so calls follow the deployment's own origin.
//  2. VITE_API_URL      - legacy local-dev override.
//  3. `/api`            - same-origin relative path forwarded to the backend
//     by vercel.json when no `.env` is present.
//
// A relative `/api` route is intentional: hardcoding the Vercel domain (e.g.
// `hr-vip-idea-forge.vercel.app`) breaks preview deployments, custom domains and
// any renamed project, so we never bake a host - or its hyphens - into the build.
const trimTrailingSlashes = (value) => (value || '').replace(/\/+$/, '');

const BASE_URL =
  trimTrailingSlashes(import.meta.env.VITE_API_BASE_URL) ||
  trimTrailingSlashes(import.meta.env.VITE_API_URL) ||
  '/api';

const readStorage = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const tokenStore = {
  get: () => readStorage(TOKEN_KEY),
  getUser: () => {
    const raw = readStorage(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  set: (token, user) => {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* storage unavailable (private mode) - session stays in memory only */
    }
  },
  clear: () => {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    } catch {
      /* no-op */
    }
  },
};

/** Error thrown for any non-2xx response, with field-level details when present. */
export class ApiError extends Error {
  constructor(message, { status = 0, details = [], payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.payload = payload;
  }

  /** Map `{ field, message }[]` into a form-friendly object. */
  get fieldErrors() {
    return this.details.reduce((acc, item) => {
      if (item?.field) acc[item.field] = item.message;
      return acc;
    }, {});
  }
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Subscribers notified when the server rejects our token. */
const unauthorizedHandlers = new Set();
export const onUnauthorized = (handler) => {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
};

let isRedirecting = false;

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(new ApiError('Request cancelled', { status: 0 }));
    }

    if (error.response) {
      const { status, data } = error.response;
      const details = Array.isArray(data?.errors) ? data.errors : [];
      const message =
        data?.message ||
        (status === 401
          ? 'Your session has expired. Please log in again.'
          : status === 403
            ? 'You do not have permission to do that.'
            : status === 429
              ? 'Too many requests. Please slow down.'
              : `Request failed (${status})`);

      if (status === 401 && !error.config?.url?.includes('/auth/')) {
        tokenStore.clear();
        if (!isRedirecting) {
          isRedirecting = true;
          unauthorizedHandlers.forEach((handler) => handler());
          setTimeout(() => {
            isRedirecting = false;
          }, 1000);
        }
      }

      return Promise.reject(new ApiError(message, { status, details, payload: data }));
    }

    const offline =
      !error.response && typeof navigator !== 'undefined' && !navigator.onLine
        ? 'You appear to be offline. Check your connection and try again.'
        : 'Cannot reach the HR VIP IdeaForge API. Is the backend running?';

    return Promise.reject(new ApiError(offline, { status: 0 }));
  }
);

export const isNetworkError = (err) => err instanceof ApiError && err.status === 0;
export default api;
