export const SETTINGS_STORAGE_KEY = "srmsCashierSettings"
export const CASHIER_SETTINGS_CHANGED_EVENT = "srms-cashier-settings-changed"

export const DEFAULT_SETTINGS = {
  modules: {
    defaultBatchFilter: "active",
    autoOpenLatestBatch: true,
    defaultBatchesView: "grid",
  },
  notifications: {
    newBatchCreated: true,
    unclaimedThresholdAlert: true,
    archiveSummary: true,
    claimActivityAlert: true,
  },
  privacy: {
    maskStudentIdInLists: false,
    hideSensitiveStatsFromSharedScreens: true,
  },
}

export function readStoredSettings() {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (!raw) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(raw)
    return {
      modules: {
        ...DEFAULT_SETTINGS.modules,
        ...(parsed?.modules || {}),
      },
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        ...(parsed?.notifications || {}),
      },
      privacy: {
        ...DEFAULT_SETTINGS.privacy,
        ...(parsed?.privacy || {}),
      },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function writeStoredSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent(CASHIER_SETTINGS_CHANGED_EVENT))
}

/** Merge server-side privacy prefs into local storage (syncs across devices). */
export function applyServerPrivacy(privacy) {
  if (!privacy || typeof privacy !== "object") return
  const current = readStoredSettings()
  writeStoredSettings({
    ...current,
    privacy: {
      ...DEFAULT_SETTINGS.privacy,
      ...privacy,
    },
  })
}

export function readNotificationPreferences() {
  return readStoredSettings().notifications
}

export function readPrivacyPreferences() {
  return readStoredSettings().privacy
}

export function readModulePreferences() {
  return readStoredSettings().modules
}

export function maskStudentId(studentId) {
  const raw = String(studentId ?? "").trim()
  if (!raw) return "—"
  if (raw.length <= 3) return "***"
  const visibleStart = Math.min(2, raw.length - 2)
  const visibleEnd = 1
  const maskLen = Math.max(raw.length - visibleStart - visibleEnd, 3)
  return `${raw.slice(0, visibleStart)}${"*".repeat(maskLen)}${raw.slice(-visibleEnd)}`
}

export function formatStudentIdForDisplay(studentId, context = "default", prefs = readPrivacyPreferences()) {
  const raw = String(studentId ?? "").trim()
  if (!raw) return "—"
  if (context === "listCard" && prefs.maskStudentIdInLists) {
    return maskStudentId(raw)
  }
  return raw
}

const SENSITIVE_STAT_LABELS = new Set([
  "Total Records",
  "Total Grantees",
  "TES Records",
  "TDP Records",
  "Claimed",
  "Unclaimed",
  "Total Claims",
  "TES Claims",
  "TDP Claims",
  "Grantees",
  "Pending Claims",
])

export function formatStatForDisplay(value, label, prefs = readPrivacyPreferences()) {
  if (!prefs.hideSensitiveStatsFromSharedScreens) {
    return value
  }
  if (SENSITIVE_STAT_LABELS.has(label)) {
    return "—"
  }
  return value
}

function notificationText(item) {
  const title = String(item?.title ?? "").toLowerCase()
  const message = String(item?.message ?? "").toLowerCase()
  return { title, message, combined: `${title} ${message}` }
}

export function matchesNewBatchNotification(item) {
  const type = String(item?.type ?? "").toLowerCase()
  if (type === "batch") return true
  const { title } = notificationText(item)
  return title.includes("new batch")
}

export function matchesUnclaimedAlert(item) {
  const type = String(item?.type ?? "").toLowerCase()
  if (type === "unclaimed") return true
  const { title, message, combined } = notificationText(item)
  return (
    title.includes("unclaimed") ||
    message.includes("unclaimed") ||
    combined.includes("not claimed") ||
    combined.includes("have not claimed")
  )
}

export function matchesArchiveSummary(item) {
  const type = String(item?.type ?? "").toLowerCase()
  const { title, message, combined } = notificationText(item)
  if (type === "claim" && (title.includes("100% claimed") || combined.includes("archive"))) {
    return true
  }
  return title.includes("archive") || message.includes("archive allocation")
}

export function matchesClaimActivity(item) {
  const type = String(item?.type ?? "").toLowerCase()
  if (type === "claim") return true
  const { title, message, combined } = notificationText(item)
  return (
    title.includes("claim") ||
    message.includes("claim") ||
    combined.includes("disbursed") ||
    combined.includes("claimed")
  )
}

const NON_CASHIER_TITLE_PREFIXES = ["updated:", "notice reactivated:"]

function isNonCashierAdminTrace(item) {
  const { title } = notificationText(item)
  return (
    title.includes("new system account registered") ||
    title.includes("security alert") ||
    NON_CASHIER_TITLE_PREFIXES.some((prefix) => title.startsWith(prefix))
  )
}

/** Operational alerts for cashier workflows (batches, claims, unclaimed, payouts). */
export function isCashierRelevantNotification(item) {
  const type = String(item?.type ?? "").toLowerCase()
  if (type === "opportunity" || type === "announcement" || isNonCashierAdminTrace(item)) {
    return false
  }
  return (
    matchesNewBatchNotification(item) ||
    matchesUnclaimedAlert(item) ||
    matchesArchiveSummary(item) ||
    matchesClaimActivity(item)
  )
}

export function shouldShowNotification(item, prefs = readNotificationPreferences()) {
  if (!prefs.newBatchCreated && matchesNewBatchNotification(item)) {
    return false
  }
  if (!prefs.unclaimedThresholdAlert && matchesUnclaimedAlert(item)) {
    return false
  }
  if (!prefs.archiveSummary && matchesArchiveSummary(item)) {
    return false
  }
  if (!prefs.claimActivityAlert && matchesClaimActivity(item)) {
    return false
  }
  return true
}
