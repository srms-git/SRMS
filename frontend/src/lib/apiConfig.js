/**
 * API base URL for production and development.
 *
 * - Default: `/api` (Vite proxy in dev; same-origin on Vercel).
 * - Override: set `VITE_API_URL` when the API is hosted elsewhere.
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  // In dev, call the Node API directly (avoids Vite proxy + stale port-5000 processes).
  if (import.meta.env.DEV) {
    return "http://127.0.0.1:5000";
  }
  return "/api";
}

/** Same as apiClient: ensures path ends with `/api`. */
export function getApiClientBaseUrl() {
  const raw = getApiBaseUrl();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    return /\/api$/i.test(raw) ? raw : `${raw.replace(/\/$/, "")}/api`;
  }
  return /\/api$/i.test(raw) ? raw : `${raw}/api`;
}

export function isApiConfigured() {
  return Boolean(getApiBaseUrl());
}

export function getApiSetupHint() {
  if (import.meta.env.DEV) {
    return 'Start the API with "pnpm dev" from the project root (or frontend folder).';
  }
  return "Check that the backend is deployed and reachable at /api, or set VITE_API_URL and rebuild.";
}
