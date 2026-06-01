export const LANDING_PAGE_SETTINGS_STORAGE_KEY = "srmsLandingPageSettings"
export const LANDING_PAGE_SETTINGS_CHANGED_EVENT = "srms-landing-page-settings-changed"

export const DEFAULT_LANDING_PAGE_SETTINGS = {
  privacy: {
    maskBatchNumberInPublicList: false,
    hideGranteeCountInPublicList: false,
    showProgramTag: true,
    showAcademicYear: true,
    showDateAdded: true,
    showViewAllBatchesLink: true,
    showStudentIdInLandingBatchList: true,
    showAwardNumberInLandingBatchList: true,
    showFullNameInLandingBatchList: true,
    showEnrolledProgramInLandingBatchList: true,
    showYearLevelInLandingBatchList: true,
  },
}

export function readStoredLandingPageSettings() {
  const raw = localStorage.getItem(LANDING_PAGE_SETTINGS_STORAGE_KEY)
  if (!raw) return DEFAULT_LANDING_PAGE_SETTINGS
  try {
    const parsed = JSON.parse(raw)
    return {
      privacy: {
        ...DEFAULT_LANDING_PAGE_SETTINGS.privacy,
        ...(parsed?.privacy || {}),
      },
    }
  } catch {
    return DEFAULT_LANDING_PAGE_SETTINGS
  }
}

export function writeStoredLandingPageSettings(settings) {
  localStorage.setItem(LANDING_PAGE_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent(LANDING_PAGE_SETTINGS_CHANGED_EVENT))
}

export function readLandingPagePrivacyPreferences() {
  return readStoredLandingPageSettings().privacy
}

export function maskBatchNumber(batchNo) {
  const raw = String(batchNo ?? "").trim()
  if (!raw) return "?"
  let visibleCount = 0
  return raw
    .split("")
    .map((char) => {
      if (!/\d/.test(char)) return char
      visibleCount += 1
      return visibleCount === 1 ? char : "*"
    })
    .join("")
}
