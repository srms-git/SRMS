import { useCallback, useEffect, useState } from "react"
import {
  CASHIER_SETTINGS_CHANGED_EVENT,
  formatStatForDisplay,
  formatStudentIdForDisplay,
  readPrivacyPreferences,
} from "@/lib/cashierSettings"

export function useCashierPrivacySettings() {
  const [privacy, setPrivacy] = useState(() => readPrivacyPreferences())

  useEffect(() => {
    const sync = () => setPrivacy(readPrivacyPreferences())
    window.addEventListener(CASHIER_SETTINGS_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(CASHIER_SETTINGS_CHANGED_EVENT, sync)
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
