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
  // Same-origin `/api` — Vite proxies to http://127.0.0.1:5000 in dev (see vite.config.js).
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
    return 'Start the API: from the frontend folder run "pnpm dev" (starts Vite + backend), or in a second terminal run "pnpm dev:api".';
  }
  return "Check that the backend is deployed and reachable at /api, or set VITE_API_URL and rebuild.";
}

/** User-facing message when the browser cannot reach the API (backend stopped or wrong port). */
export function getNetworkErrorMessage(error) {
  if (!error) return null
  const code = String(error?.code ?? "")
  const message = String(error?.message ?? "")
  const isNetworkFailure =
    code === "ERR_NETWORK" ||
    message.includes("Network Error") ||
    message.toLowerCase().includes("connection refused") ||
    !error?.response

  if (isNetworkFailure && !error?.response) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "No internet connection. Check your Wi‑Fi or mobile data, then try again."
    }
    if (import.meta.env.DEV) {
      return `Can't reach the server right now. ${getApiSetupHint()}`
    }
    return "Can't reach the server right now. Check your connection and try again in a moment."
  }
  return null
}
