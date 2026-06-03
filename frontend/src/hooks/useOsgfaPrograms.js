import { useCallback, useEffect, useMemo, useState } from "react"

import {
  createProgramViaApi,
  fetchProgramsFromApi,
  getCachedPrograms,
  MAX_OS_GFA_PROGRAMS,
  OSGFA_PROGRAMS_CHANGED_EVENT,
  renameProgramViaApi,
  setProgramActiveViaApi,
  updateProgramRequirementsViaApi,
} from "@/lib/osgfaPrograms"

export function useOsgfaPrograms() {
  const [programs, setPrograms] = useState(getCachedPrograms)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refreshFromCache = useCallback(() => {
    setPrograms(getCachedPrograms())
  }, [])

  const loadPrograms = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      await fetchProgramsFromApi()
      refreshFromCache()
    } catch (err) {
      setError(err?.message ?? "Failed to load programs.")
      refreshFromCache()
    } finally {
      setLoading(false)
    }
  }, [refreshFromCache])

  useEffect(() => {
    loadPrograms()
    const refresh = () => refreshFromCache()
    window.addEventListener(OSGFA_PROGRAMS_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(OSGFA_PROGRAMS_CHANGED_EVENT, refresh)
  }, [loadPrograms, refreshFromCache])

  const addProgram = useCallback(async (input) => {
    const result = await createProgramViaApi(input)
    if (result.ok) refreshFromCache()
    return result
  }, [refreshFromCache])

  const setProgramActive = useCallback(async (programId, active) => {
    const result = await setProgramActiveViaApi(programId, active)
    if (result.ok) refreshFromCache()
    return result
  }, [refreshFromCache])

  const renameProgram = useCallback(async (programId, input) => {
    const result = await renameProgramViaApi(programId, input)
    if (result.ok) refreshFromCache()
    return result
  }, [refreshFromCache])

  const updateProgramRequirements = useCallback(async (programId, requirements) => {
    const result = await updateProgramRequirementsViaApi(programId, requirements)
    if (result.ok) refreshFromCache()
    return result
  }, [refreshFromCache])

  const activePrograms = useMemo(
    () => programs.filter((program) => program.active !== false),
    [programs],
  )

  return {
    programs,
    activePrograms,
    loading,
    error,
    reloadPrograms: loadPrograms,
    addProgram,
    setProgramActive,
    renameProgram,
    updateProgramRequirements,
    canAddMore: programs.length < MAX_OS_GFA_PROGRAMS,
    maxPrograms: MAX_OS_GFA_PROGRAMS,
  }
}
