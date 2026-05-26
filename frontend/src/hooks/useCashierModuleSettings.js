import { useEffect, useState } from "react"
import { CASHIER_SETTINGS_CHANGED_EVENT, readModulePreferences } from "@/lib/cashierSettings"

export function useCashierModuleSettings() {
  const [modules, setModules] = useState(() => readModulePreferences())

  useEffect(() => {
    const sync = () => setModules(readModulePreferences())
    window.addEventListener(CASHIER_SETTINGS_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(CASHIER_SETTINGS_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return modules
}
