import { getOperationalBatchKey } from "@/lib/announcementBatchLink"

export const BATCH_FILTER_PLACEHOLDER = "__"

export function isUnsetBatchFilter(value) {
  return value === BATCH_FILTER_PLACEHOLDER || value === ""
}

export function matchesBatchListRowFilters(row, filters, options = {}) {
  const { exclude = [], payoutScheduleByBatchKey } = options
  const batchFilter = filters.batch ?? BATCH_FILTER_PLACEHOLDER
  const programFilter = filters.program ?? BATCH_FILTER_PLACEHOLDER
  const yearFilter = filters.year ?? BATCH_FILTER_PLACEHOLDER
  const scheduleFilter = filters.schedule ?? BATCH_FILTER_PLACEHOLDER

  if (!exclude.includes("batch") && !isUnsetBatchFilter(batchFilter) && String(row.batchNo ?? "") !== batchFilter) {
    return false
  }
  if (!exclude.includes("program") && !isUnsetBatchFilter(programFilter) && String(row.program ?? "") !== programFilter) {
    return false
  }
  if (!exclude.includes("year") && !isUnsetBatchFilter(yearFilter) && String(row.schoolYear ?? "") !== yearFilter) {
    return false
  }
  if (!exclude.includes("schedule") && payoutScheduleByBatchKey) {
    const hasSchedule = Boolean(payoutScheduleByBatchKey.get(getOperationalBatchKey(row)))
    if (scheduleFilter === "scheduled" && !hasSchedule) return false
    if (scheduleFilter === "none" && hasSchedule) return false
  }
  return true
}

export function buildBatchListFilterOptions(rows, filters, options = {}) {
  const { payoutScheduleByBatchKey } = options

  const batchRows = rows.filter((row) =>
    matchesBatchListRowFilters(row, filters, { exclude: ["batch"], payoutScheduleByBatchKey }),
  )
  const programRows = rows.filter((row) =>
    matchesBatchListRowFilters(row, filters, { exclude: ["program"], payoutScheduleByBatchKey }),
  )
  const yearRows = rows.filter((row) =>
    matchesBatchListRowFilters(row, filters, { exclude: ["year"], payoutScheduleByBatchKey }),
  )

  return {
    batchNos: [...new Set(batchRows.map((row) => String(row.batchNo ?? "").trim()).filter(Boolean))].sort(),
    programs: [...new Set(programRows.map((row) => String(row.program ?? "").trim()).filter(Boolean))].sort(),
    years: [...new Set(yearRows.map((row) => String(row.schoolYear ?? "").trim()).filter(Boolean))].sort(),
  }
}

export function batchListFilterValueIsValid(value, options) {
  return isUnsetBatchFilter(value) || options.includes(value)
}
