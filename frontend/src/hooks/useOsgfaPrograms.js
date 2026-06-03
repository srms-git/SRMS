import { useCallback, useEffect, useState } from "react"

import {
  addProgram as addProgramToStorage,
  MAX_OS_GFA_PROGRAMS,
  OSGFA_PROGRAMS_CHANGED_EVENT,
  readStoredPrograms,
} from "@/lib/osgfaPrograms"

export function useOsgfaPrograms() {
  const [programs, setPrograms] = useState(readStoredPrograms)

  useEffect(() => {
    const refresh = () => setPrograms(readStoredPrograms())
    window.addEventListener(OSGFA_PROGRAMS_CHANGED_EVENT, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(OSGFA_PROGRAMS_CHANGED_EVENT, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  const addProgram = useCallback((input) => {
    const result = addProgramToStorage(input)
    if (result.ok) setPrograms(readStoredPrograms())
    return result
  }, [])

  return {
    programs,
    addProgram,
    canAddMore: programs.length < MAX_OS_GFA_PROGRAMS,
    maxPrograms: MAX_OS_GFA_PROGRAMS,
  }
}
