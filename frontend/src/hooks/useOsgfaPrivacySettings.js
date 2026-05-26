import { useCallback, useEffect, useState } from "react"
import {
  OSGFA_SETTINGS_CHANGED_EVENT,
  formatStatForDisplay,
  formatStudentIdForDisplay,
  readPrivacyPreferences,
} from "@/lib/osgfaSettings"

export function useOsgfaPrivacySettings() {
  const [privacy, setPrivacy] = useState(() => readPrivacyPreferences())

  useEffect(() => {
    const sync = () => setPrivacy(readPrivacyPreferences())
    window.addEventListener(OSGFA_SETTINGS_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(OSGFA_SETTINGS_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const formatStudentId = useCallback(
    (studentId, context = "default") => formatStudentIdForDisplay(studentId, context, privacy),
    [privacy],
  )

  const formatStat = useCallback(
    (value, label) => formatStatForDisplay(value, label, privacy),
    [privacy],
  )

  return { privacy, formatStudentId, formatStat }
}
