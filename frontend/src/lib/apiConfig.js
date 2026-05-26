/**
 * API base URL for production and development.
 *
 * - Local dev: defaults to `/api` (Vite proxy → backend on :5000).
 * - Vercel/prod: set `VITE_API_URL` to your hosted API, e.g.
 *   https://your-api.onrender.com/api
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "/api";
  }
  return "";
}

/** Same as apiClient: ensures path ends with `/api`. */
export function getApiClientBaseUrl() {
  const raw = getApiBaseUrl();
  if (!raw) return "";
  return /\/api$/i.test(raw) ? raw : `${raw}/api`;
}

export function isApiConfigured() {
  return Boolean(getApiBaseUrl());
}

export function getApiSetupHint() {
  if (import.meta.env.DEV) {
    return 'Start the API with "npm run dev" from the frontend folder.';
  }
  return "Set VITE_API_URL in Vercel (e.g. https://your-backend.onrender.com/api) and redeploy.";
}
