export const SETTINGS_STORAGE_KEY = "srmsOsgfaSettings"
export const LEGACY_SETTINGS_STORAGE_KEY = "srmsAdminSettings"
export const OSGFA_SETTINGS_CHANGED_EVENT = "srms-osgfa-settings-changed"

export const DEFAULT_SETTINGS = {
  modules: {
    defaultScholarshipView: "tes",
    defaultBatchFilter: "active",
    autoOpenLatestBatch: true,
  },
  notifications: {
    newBatchCreated: true,
    unclaimedThresholdAlert: true,
    archiveSummary: true,
  },
  privacy: {
    maskStudentIdInLists: false,
    hideSensitiveStatsFromSharedScreens: true,
  },
}

export function readStoredSettings() {
  const raw =
    localStorage.getItem(SETTINGS_STORAGE_KEY) || localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY)
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
  window.dispatchEvent(new CustomEvent(OSGFA_SETTINGS_CHANGED_EVENT))
}

export function readNotificationPreferences() {
  return readStoredSettings().notifications
}

export function readPrivacyPreferences() {
  return readStoredSettings().privacy
}

/** Mask middle characters; keeps short prefixes/suffixes for recognition. */
export function maskStudentId(studentId) {
  const raw = String(studentId ?? "").trim()
  if (!raw) return "—"
  if (raw.length <= 3) return "***"
  const visibleStart = Math.min(2, raw.length - 2)
  const visibleEnd = 1
  const maskLen = Math.max(raw.length - visibleStart - visibleEnd, 3)
  return `${raw.slice(0, visibleStart)}${"*".repeat(maskLen)}${raw.slice(-visibleEnd)}`
}

/**
 * @param {"listCard" | "default"} context — listCard applies maskStudentIdInLists when enabled.
 */
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
  return true
}
