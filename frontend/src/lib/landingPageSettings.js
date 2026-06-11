import { useEffect, useState } from "react"

import apiClient from "@/lib/apiClient"

export const LANDING_PAGE_SETTINGS_STORAGE_KEY = "srmsLandingPageSettings"
export const LANDING_PAGE_SETTINGS_CHANGED_EVENT = "srms-landing-page-settings-changed"

const LANDING_PAGE_SETTINGS_API_PATH = "/landing-batches/page-settings"

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
  contactInfo: {
    emailAddress: "scholarships@msu.edu.ph",
    contactNumber: "(042) 000-0000",
    officeAddress: "Marinduque State University, Boac, Marinduque",
  },
}

function mergeLandingPageSettings(parsed) {
  return {
    privacy: {
      ...DEFAULT_LANDING_PAGE_SETTINGS.privacy,
      ...(parsed?.privacy || {}),
    },
    contactInfo: {
      ...DEFAULT_LANDING_PAGE_SETTINGS.contactInfo,
      ...(parsed?.contactInfo || {}),
    },
  }
}

export function readStoredLandingPageSettings() {
  const raw = localStorage.getItem(LANDING_PAGE_SETTINGS_STORAGE_KEY)
  if (!raw) return DEFAULT_LANDING_PAGE_SETTINGS
  try {
    return mergeLandingPageSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_LANDING_PAGE_SETTINGS
  }
}

export function writeStoredLandingPageSettings(settings) {
  const merged = mergeLandingPageSettings(settings)
  localStorage.setItem(LANDING_PAGE_SETTINGS_STORAGE_KEY, JSON.stringify(merged))
  window.dispatchEvent(new CustomEvent(LANDING_PAGE_SETTINGS_CHANGED_EVENT))
  return merged
}

export async function loadLandingPageSettings() {
  const cached = readStoredLandingPageSettings()
  try {
    const response = await apiClient.get(LANDING_PAGE_SETTINGS_API_PATH)
    const serverSettings = response?.data ?? {}
    const settings = mergeLandingPageSettings({
      privacy: {
        ...cached.privacy,
        ...(serverSettings?.privacy || {}),
      },
      contactInfo: {
        ...cached.contactInfo,
        ...(serverSettings?.contactInfo || {}),
      },
    })
    return writeStoredLandingPageSettings(settings)
  } catch (error) {
    console.error("Failed to load landing page settings from server:", error)
    return cached
  }
}

export async function persistLandingPageSettings(settings) {
  const merged = writeStoredLandingPageSettings(settings)
  await apiClient.put(LANDING_PAGE_SETTINGS_API_PATH, merged)
  return merged
}

export function readLandingPagePrivacyPreferences() {
  return readStoredLandingPageSettings().privacy
}

export function useLandingPagePrivacy() {
  const [privacy, setPrivacy] = useState(() => readLandingPagePrivacyPreferences())

  useEffect(() => {
    let cancelled = false

    loadLandingPageSettings().then((settings) => {
      if (!cancelled) setPrivacy(settings.privacy)
    })

    const sync = () => setPrivacy(readLandingPagePrivacyPreferences())
    window.addEventListener(LANDING_PAGE_SETTINGS_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)

    return () => {
      cancelled = true
      window.removeEventListener(LANDING_PAGE_SETTINGS_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return privacy
}

export function useLandingPageSettings() {
  const [settings, setSettings] = useState(() => readStoredLandingPageSettings())

  useEffect(() => {
    let cancelled = false

    loadLandingPageSettings().then((settings) => {
      if (!cancelled) setSettings(settings)
    })

    const sync = () => setSettings(readStoredLandingPageSettings())
    window.addEventListener(LANDING_PAGE_SETTINGS_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)

    return () => {
      cancelled = true
      window.removeEventListener(LANDING_PAGE_SETTINGS_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return settings
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
