import { useQuery, useQueryClient } from "@tanstack/react-query"

import apiClient from "@/lib/apiClient"
import { fetchArchivedBatchDetail, fetchArchivedBatches } from "@/lib/archiveApi"
import { fetchClaimHistory } from "@/lib/claimHistoryApi"
import {
  fetchAllGrantees,
  fetchGranteesByProgram,
  fetchGranteesForBatch,
} from "@/lib/granteesApi"
import { queryKeys } from "@/lib/queryKeys"

async function fetchAnnouncements() {
  const response = await apiClient.get("/announcements")
  return Array.isArray(response.data) ? response.data : []
}

async function fetchNotifications() {
  const response = await apiClient.get("/notifications")
  return Array.isArray(response.data) ? response.data : []
}

export function useGranteesQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.grantees,
    queryFn: fetchAllGrantees,
    ...options,
  })
}

export function useArchivedBatchesQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.archivedBatches,
    queryFn: fetchArchivedBatches,
    ...options,
  })
}

export function useNotificationsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: fetchNotifications,
    ...options,
  })
}

export function useAnnouncementsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.announcements,
    queryFn: fetchAnnouncements,
    ...options,
  })
}

export function useClaimHistoryQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.claimHistory,
    queryFn: fetchClaimHistory,
    ...options,
  })
}

export function useProgramGranteesQuery(programCode, options = {}) {
  return useQuery({
    queryKey: queryKeys.programGrantees(programCode),
    queryFn: () => fetchGranteesByProgram(programCode),
    enabled: Boolean(programCode) && (options.enabled ?? true),
    ...options,
  })
}

export function useBatchGranteesQuery({ program, batchNo, academicYear }, options = {}) {
  const hasProgram = Boolean(String(program ?? "").trim())
  return useQuery({
    queryKey: queryKeys.batchGrantees(program, batchNo, academicYear),
    queryFn: () => fetchGranteesForBatch({ program, batchNo, academicYear }),
    enabled: hasProgram && (options.enabled ?? true),
    ...options,
  })
}

export function useArchivedBatchDetailQuery({ batchNo, program, academicYear }, options = {}) {
  const hasParams = Boolean(batchNo && program && academicYear)
  return useQuery({
    queryKey: queryKeys.archivedBatchDetail(batchNo, program, academicYear),
    queryFn: () => fetchArchivedBatchDetail({ batchNo, program, academicYear }),
    enabled: hasParams && (options.enabled ?? true),
    ...options,
  })
}

/** Invalidate grantee-related caches after create/update/delete operations. */
export function useInvalidateGranteeCaches() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.grantees })
    queryClient.invalidateQueries({ queryKey: ["programGrantees"] })
    queryClient.invalidateQueries({ queryKey: ["batchGrantees"] })
    queryClient.invalidateQueries({ queryKey: queryKeys.archivedBatches })
    queryClient.invalidateQueries({ queryKey: ["archivedBatchDetail"] })
    queryClient.invalidateQueries({ queryKey: queryKeys.claimHistory })
  }
}

function useCachedListSetter(cacheKey) {
  const queryClient = useQueryClient()
  return (updater) => {
    queryClient.setQueryData(cacheKey, (prev) => {
      const current = prev ?? []
      return typeof updater === "function" ? updater(current) : updater
    })
  }
}

/** Batch grantee list with React Query cache + local setRecords compatibility. */
export function useBatchGranteesRecords({ program, batchNo, academicYear }) {
  const hasProgram = Boolean(String(program ?? "").trim())
  const query = useBatchGranteesQuery({ program, batchNo, academicYear }, { enabled: hasProgram })
  const cacheKey = queryKeys.batchGrantees(program, batchNo, academicYear)
  const setRecords = useCachedListSetter(cacheKey)

  const fetchError = !hasProgram
    ? "Missing program in the URL. Open this page from Batches (TES or TDP)."
    : query.error?.message ?? null

  return {
    records: query.data ?? [],
    isLoading: hasProgram ? query.isLoading : false,
    fetchError,
    loadRecords: query.refetch,
    setRecords,
  }
}

/** Program grantee list with React Query cache + local setRecords compatibility. */
export function useProgramGranteesRecords(programCode) {
  const query = useProgramGranteesQuery(programCode)
  const cacheKey = queryKeys.programGrantees(programCode)
  const setRecords = useCachedListSetter(cacheKey)

  return {
    records: query.data ?? [],
    isLoading: query.isLoading,
    fetchError: query.error?.message ?? null,
    loadRecords: query.refetch,
    setRecords,
  }
}
