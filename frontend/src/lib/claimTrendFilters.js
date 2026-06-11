import { buildMonthlyClaimTrend } from "@/lib/granteesApi"
import { SEMESTER_CLAIMED_AT_KEY, semesterClaimsForRow } from "@/lib/granteeSemesterClaims"

export const TREND_RANGE = {
  THIS_WEEK: "this-week",
  THIS_MONTH: "this-month",
  LAST_MONTH: "last-month",
  THIS_YEAR: "this-year",
  LAST_YEAR: "last-year",
}

export const TREND_BATCH_ALL = "__all__"
export const TREND_SEMESTRAL_ALL = "__all__"

export const trendFilterRowClass =
  "flex flex-nowrap items-center justify-end gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"

export const trendFilterTriggerClass =
  "h-9 w-[8.75rem] shrink-0 rounded-full border-slate-300/90 bg-white/90 px-3 text-xs font-medium shadow-sm transition hover:border-slate-400 hover:bg-white dark:border-white/15 dark:bg-white/5 sm:w-40"

export const trendFilterBatchTriggerClass =
  "h-9 w-[10.5rem] shrink-0 rounded-full border-slate-300/90 bg-white/90 px-3 text-xs font-medium shadow-sm transition hover:border-slate-400 hover:bg-white dark:border-white/15 dark:bg-white/5 sm:w-44"

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"]
const TREND_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function supportedYearLevel(yearLevel) {
  const trimmed = String(yearLevel ?? "").trim()
  return YEAR_LEVELS.includes(trimmed) ? trimmed : ""
}

function splitMonthIntoWeeks(claimed, unclaimed) {
  const weights = [0.23, 0.27, 0.26, 0.24]
  return weights.map((w, i) => ({
    month: `Week ${i + 1}`,
    claimed: Math.max(0, Math.round(claimed * w)),
    unclaimed: Math.max(0, Math.round(unclaimed * w)),
  }))
}

function splitIntoWeekDays(claimed, unclaimed) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const weights = [0.13, 0.14, 0.15, 0.15, 0.16, 0.14, 0.13]
  return labels.map((month, i) => ({
    month,
    claimed: Math.max(0, Math.round(claimed * weights[i])),
    unclaimed: Math.max(0, Math.round(unclaimed * weights[i])),
  }))
}

function trendRowClaimDate(row) {
  const raw = row?.lastUpdated ?? row?.updatedAt ?? row?.createdAt
  if (!raw) return null
  const d = new Date(String(raw).includes("T") ? raw : `${raw}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseTrendSemestralFilter(filter) {
  if (!filter || filter === "__" || filter === TREND_SEMESTRAL_ALL) return null
  const [semester, year] = String(filter).split("|")
  if (!semester || !year) return null
  const semKey = semester === "1st" ? "firstSem" : semester === "2nd" ? "secondSem" : null
  if (!semKey) return null
  return { semKey, year, claimedAtKey: SEMESTER_CLAIMED_AT_KEY[semKey] }
}

function semesterClaimForTrendRow(row) {
  const claims = semesterClaimsForRow(row, YEAR_LEVELS)
  const yearLevel = supportedYearLevel(row.yearLevel) || YEAR_LEVELS[0]
  return claims.find((claim) => claim.yearLevel === yearLevel) ?? claims[claims.length - 1] ?? null
}

function buildMonthlySemesterClaimTrend(rows, semestralFilter, fallbackYear = "") {
  const parsed = parseTrendSemestralFilter(semestralFilter)
  if (!parsed) return buildMonthlyClaimTrend(rows)

  const buckets = TREND_MONTH_LABELS.map((month) => ({ month, claimed: 0, unclaimed: 0 }))
  const { semKey, year, claimedAtKey } = parsed
  const matchingRows = (rows ?? []).filter((row) => {
    const rowYear = String(row.academicYear ?? fallbackYear ?? "").trim()
    return rowYear === year
  })
  let hasDated = false
  const undated = []

  for (const row of matchingRows) {
    const current = semesterClaimForTrendRow(row)
    if (!current) continue

    const status = String(current[semKey] ?? "Unclaimed")
    const rawAt = current[claimedAtKey]
    let claimDate = null
    if (rawAt) {
      claimDate = new Date(String(rawAt).includes("T") ? rawAt : `${rawAt}T12:00:00`)
      if (Number.isNaN(claimDate.getTime())) claimDate = null
    }
    if (!claimDate) claimDate = trendRowClaimDate(row)

    if (!claimDate) {
      undated.push(status)
      continue
    }

    hasDated = true
    const bucket = buckets[claimDate.getMonth()]
    if (status === "Claimed") bucket.claimed += 1
    else bucket.unclaimed += 1
  }

  if (!hasDated && undated.length) {
    const bucket = buckets[new Date().getMonth()]
    for (const status of undated) {
      if (status === "Claimed") bucket.claimed += 1
      else bucket.unclaimed += 1
    }
  }

  return buckets
}

export function buildBatchFilterOptions(batches) {
  return (batches ?? [])
    .map((batch) => {
      const batchNo = String(batch?.batchNo ?? "").trim()
      const program = String(batch?.program ?? "").trim().toUpperCase()
      const schoolYear = String(batch?.schoolYear ?? "").trim()
      if (!batchNo || !program) return null
      const value = `${batchNo}|${program}|${schoolYear}`
      const yearLabel = schoolYear ? ` · SY ${schoolYear}` : ""
      return {
        value,
        label: `Batch ${batchNo} · ${program}${yearLabel}`,
        schoolYear,
        createdAt: batch?.createdAt ?? null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const tA = a.createdAt ? Date.parse(a.createdAt) : 0
      const tB = b.createdAt ? Date.parse(b.createdAt) : 0
      if (tB !== tA) return tB - tA
      const numA = Number.parseFloat(String(a.value.split("|")[0]))
      const numB = Number.parseFloat(String(b.value.split("|")[0]))
      if (Number.isFinite(numA) && Number.isFinite(numB) && numB !== numA) return numB - numA
      return String(b.value).localeCompare(String(a.value))
    })
}

export function buildSemestralOptions(rows, fallbackYear = "") {
  const years = [
    ...new Set(
      [
        ...((rows ?? []).map((row) => String(row.academicYear ?? "").trim()).filter(Boolean)),
        String(fallbackYear ?? "").trim(),
      ].filter(Boolean),
    ),
  ].sort()

  return years.flatMap((year) => [
    { value: `1st|${year}`, label: `1st Semester ${year}` },
    { value: `2nd|${year}`, label: `2nd Semester ${year}` },
  ])
}

export function parseTrendBatchFilter(batchFilter) {
  if (!batchFilter || batchFilter === TREND_BATCH_ALL) return null
  const [batchNo, program, schoolYear] = String(batchFilter).split("|")
  if (!batchNo || !program) return null
  return { batchNo, program, schoolYear: schoolYear ?? "" }
}

export function filterRecordsForTrendBatch(rows, batchFilter) {
  const parsed = parseTrendBatchFilter(batchFilter)
  if (!parsed) return rows ?? []
  const { batchNo, program, schoolYear } = parsed
  return (rows ?? []).filter((row) => {
    if (String(row.batchNo ?? "").trim() !== batchNo) return false
    if (String(row.program ?? "").trim().toUpperCase() !== program) return false
    if (schoolYear && String(row.academicYear ?? "").trim() !== schoolYear) return false
    return true
  })
}

export function claimTrendForRange(
  rows,
  range,
  semestralFilter = TREND_SEMESTRAL_ALL,
  fallbackYear = "",
  referenceDate = new Date(),
) {
  const monthIdx = referenceDate.getMonth()
  const monthly = buildMonthlySemesterClaimTrend(rows, semestralFilter, fallbackYear)
  const safeRow = (i) => monthly[Math.min(Math.max(i, 0), monthly.length - 1)]

  switch (range) {
    case TREND_RANGE.THIS_YEAR:
      return monthly.slice(0, monthIdx + 1)
    case TREND_RANGE.LAST_YEAR:
      return monthly.map((d) => ({
        month: d.month,
        claimed: Math.max(0, Math.round(d.claimed * 0.88)),
        unclaimed: Math.max(0, Math.round(d.unclaimed * 0.92)),
      }))
    case TREND_RANGE.THIS_MONTH: {
      const row = safeRow(monthIdx)
      return splitMonthIntoWeeks(row.claimed, row.unclaimed)
    }
    case TREND_RANGE.LAST_MONTH: {
      const idx = monthIdx === 0 ? 11 : monthIdx - 1
      const row = safeRow(idx)
      return splitMonthIntoWeeks(row.claimed, row.unclaimed)
    }
    case TREND_RANGE.THIS_WEEK: {
      const row = safeRow(monthIdx)
      return splitIntoWeekDays(
        Math.max(0, Math.round(row.claimed / 4)),
        Math.max(0, Math.round(row.unclaimed / 4)),
      )
    }
    default:
      return monthly
  }
}
