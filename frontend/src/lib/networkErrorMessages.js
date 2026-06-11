import { getApiSetupHint } from "@/lib/apiConfig"

const NETWORK_MESSAGE_PATTERNS = [
  /network error/i,
  /err_network/i,
  /connection refused/i,
  /failed to fetch/i,
  /fetch failed/i,
  /network request failed/i,
  /cannot connect to the api/i,
  /cannot reach the server/i,
  /could not reach the server/i,
  /check your (internet )?connection/i,
  /load failed/i,
]

function errorText(error) {
  if (!error) return ""
  if (typeof error === "string") return error.trim()
  return String(
    error?.userMessage ||
      error?.response?.data?.message ||
      error?.message ||
      "",
  ).trim()
}

export function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

export function isNetworkConnectivityError(error) {
  if (isBrowserOffline()) return true

  const text = errorText(error)
  if (!text) {
    if (error && typeof error === "object" && !error?.response) {
      const code = String(error?.code ?? "")
      if (code === "ERR_NETWORK" || code === "ECONNABORTED") return true
    }
    return false
  }

  if (NETWORK_MESSAGE_PATTERNS.some((pattern) => pattern.test(text))) {
    return true
  }

  if (error && typeof error === "object" && !error?.response) {
    const code = String(error?.code ?? "")
    if (code === "ERR_NETWORK" || code === "ECONNABORTED") return true
  }

  return false
}

const SUBJECT_LABELS = {
  dashboard: "dashboard data",
  batches: "batches",
  batch: "batch records",
  notifications: "notifications",
  announcements: "announcements",
  archive: "archived records",
  "claim history": "claim history",
  records: "records",
  programs: "program records",
}

function subjectLabel(subject) {
  const key = String(subject ?? "").trim().toLowerCase()
  return SUBJECT_LABELS[key] || (key ? key : "this page")
}

/**
 * User-facing copy for failed loads. Connection problems use amber-style guidance;
 * other errors keep a clearer, non-technical message.
 */
export function resolveFetchErrorDisplay(error, { subject } = {}) {
  const rawMessage = errorText(error)
  const label = subjectLabel(subject)

  if (isBrowserOffline()) {
    return {
      kind: "offline",
      title: "No internet connection",
      message: `Your device appears to be offline, so we could not load ${label}. Check your Wi‑Fi or mobile data, then try again.`,
      actionLabel: "Try again when online",
    }
  }

  if (isNetworkConnectivityError(error)) {
    const serverHint = import.meta.env.DEV
      ? getApiSetupHint()
      : "If the problem continues, contact your system administrator."

    return {
      kind: "server",
      title: "Can't reach the server",
      message: `We could not connect to SRMS to load ${label}. This is usually a connection or server issue—not a problem with your data. ${serverHint}`,
      actionLabel: "Try again",
    }
  }

  return {
    kind: "other",
    title: `Couldn't load ${label}`,
    message:
      rawMessage ||
      "Something unexpected happened while loading. Please try again in a moment.",
    actionLabel: "Try again",
  }
}
