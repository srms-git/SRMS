import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarDays, GraduationCap, Layers, Search, SlidersHorizontal, TableProperties } from "lucide-react"

import { ConnectionProblemState } from "@/components/ConnectionProblemState"
import { PayoutScheduleBadge, PayoutScheduleDetailsDialog } from "@/components/PayoutScheduleBadge"
import { buildBatchesFromGrantees } from "@/lib/granteesApi"
import { useArchivedBatchesQuery, useAnnouncementsQuery, useGranteesQuery } from "@/hooks/useSrmsQueries"
import { buildPayoutScheduleByBatchKey, getOperationalBatchKey } from "@/lib/announcementBatchLink"
import {
  BATCH_FILTER_PLACEHOLDER,
  batchListFilterValueIsValid,
  buildBatchListFilterOptions,
  isUnsetBatchFilter,
  matchesBatchListRowFilters,
} from "@/lib/batchListFilters"
import { getTodayDateString } from "@/lib/announcementDates"
import { isBatchVisibleOnLanding, useLandingBatchVisibility } from "@/lib/landingFeaturedBatches"
import { useCashierModuleSettings } from "@/hooks/useCashierModuleSettings"
import {
  BatchCardSkeleton,
  BatchListTableRowSkeleton,
  SummaryStatCardSkeleton,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"
import { cn } from "@/lib/utils"

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

function formatCreatedAtDate(value) {
  if (!value) return "Date added: —"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date added: —"
  return `Date added: ${date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`
}

function SummaryStatCard({ label, value, accentBar, glow, iconBg, Icon, className, style }) {
  return (
    <div
      className={cn(
        `group relative min-h-[124px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6 ${accentBar}`,
        className,
      )}
      style={style}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-60 ${glow}`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1 pr-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{value}</p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-black/4 dark:ring-white/10 ${iconBg}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      </div>
    </div>
  )
}

export default function Batches() {
  const navigate = useNavigate()
  const modulePrefs = useCashierModuleSettings()

  const {
    data: granteesRawData = [],
    isLoading: granteesLoading,
    error: granteesError,
    refetch: refetchGrantees,
  } = useGranteesQuery()
  const {
    data: archivedBatches = [],
    isLoading: archivedLoading,
    error: archivedError,
    refetch: refetchArchived,
  } = useArchivedBatchesQuery()
  const {
    data: rawAnnouncements = [],
    isLoading: announcementsLoading,
  } = useAnnouncementsQuery()
  const isLoading = granteesLoading || archivedLoading || announcementsLoading
  const fetchError = granteesError?.message ?? archivedError?.message ?? null

  const [searchTerm, setSearchTerm] = useState("")
  const [batchFilter, setBatchFilter] = useState("__")
  const [programFilter, setProgramFilter] = useState("__")
  const [yearFilter, setYearFilter] = useState("__")
  const [sortMode, setSortMode] = useState("batch-asc")
  const [scheduleFilter, setScheduleFilter] = useState("__")
  const [scheduleDialogAnnouncement, setScheduleDialogAnnouncement] = useState(null)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [batchesView, setBatchesView] = useState(() => modulePrefs.defaultBatchesView || "grid")
  const archivedBatchCount = archivedBatches.length
  const landingVisibility = useLandingBatchVisibility()

  useEffect(() => {
    setBatchesView(modulePrefs.defaultBatchesView || "grid")
  }, [modulePrefs.defaultBatchesView])

  useEffect(() => {
    if (modulePrefs.defaultBatchFilter === "archived") {
      navigate("/cashier/archive", { replace: true })
    }
  }, [modulePrefs.defaultBatchFilter, navigate])

  const batches = useMemo(() => buildBatchesFromGrantees(granteesRawData), [granteesRawData])

  const publishedBatches = useMemo(
    () => batches.filter((row) => isBatchVisibleOnLanding(row, landingVisibility)),
    [batches, landingVisibility],
  )

  const payoutScheduleByBatchKey = useMemo(
    () => buildPayoutScheduleByBatchKey(rawAnnouncements, getTodayDateString()),
    [rawAnnouncements],
  )

  const openScheduleDetails = (announcement) => {
    setScheduleDialogAnnouncement(announcement)
    setScheduleDialogOpen(true)
  }

  // Count instances for each distinct operational subset card
  const granteeCountsByBatchProgram = useMemo(() => {
    const map = new Map()
    granteesRawData.forEach((item) => {
      const bNo = String(item.batchNo ?? "").trim()
      const prog = String(item.program ?? "").trim().toUpperCase()
      if (!bNo || !prog) return
      
      const key = `${bNo}|${prog}`
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return map
  }, [granteesRawData])

  const uniqueBatchNos = useMemo(
    () => [...new Set(publishedBatches.map((row) => String(row.batchNo ?? "").trim()).filter(Boolean))].sort(),
    [publishedBatches],
  )
  const uniqueYears = useMemo(
    () => [...new Set(publishedBatches.map((row) => String(row.schoolYear ?? "").trim()).filter(Boolean))].sort(),
    [publishedBatches],
  )
  const uniquePrograms = useMemo(
    () => [...new Set(publishedBatches.map((row) => String(row.program ?? "").trim()).filter(Boolean))].sort(),
    [publishedBatches],
  )

  const filteredBatches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return publishedBatches.filter((row) => {
      if (batchFilter !== "__" && batchFilter !== "" && String(row.batchNo ?? "") !== batchFilter) return false
      if (programFilter !== "__" && programFilter !== "" && String(row.program ?? "") !== programFilter) return false
      if (yearFilter !== "__" && yearFilter !== "" && String(row.schoolYear ?? "") !== yearFilter) return false
      if (scheduleFilter === "scheduled") {
        if (!payoutScheduleByBatchKey.get(getOperationalBatchKey(row))) return false
      }
      if (scheduleFilter === "none") {
        if (payoutScheduleByBatchKey.get(getOperationalBatchKey(row))) return false
      }
      if (!query) return true
      return (
        String(row.batchNo ?? "").toLowerCase().includes(query) ||
        String(row.schoolYear ?? "").toLowerCase().includes(query) ||
        String(row.program ?? "").toLowerCase().includes(query)
      )
    })
  }, [publishedBatches, batchFilter, programFilter, searchTerm, yearFilter, scheduleFilter, payoutScheduleByBatchKey])

  const summary = useMemo(() => {
    let publishedBatches = 0
    let hiddenBatches = 0

    for (const batch of batches) {
      if (isBatchVisibleOnLanding(batch, landingVisibility)) {
        publishedBatches += 1
      } else {
        hiddenBatches += 1
      }
    }

    return {
      totalBatches: batches.length,
      publishedBatches,
      hiddenBatches,
      archivedBatches: archivedBatchCount,
    }
  }, [archivedBatchCount, batches, landingVisibility])

  const sortedBatches = useMemo(() => {
    const getGrantees = (row) => {
      const programKey = String(row?.program ?? "").trim().toUpperCase()
      return granteeCountsByBatchProgram.get(`${row?.batchNo}|${programKey}`) ?? 0
    }

    const parseBatch = (row) => {
      const n = Number.parseFloat(String(row?.batchNo ?? "").trim())
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
    }

    const parseYear = (row) => {
      const text = String(row?.schoolYear ?? "").trim()
      const start = Number.parseInt(text.split("-")[0] ?? "", 10)
      return Number.isFinite(start) ? start : -Infinity
    }

    const rows = [...filteredBatches]
    rows.sort((a, b) => {
      if (sortMode === "most-grantees") {
        return getGrantees(b) - getGrantees(a) || parseBatch(a) - parseBatch(b)
      }
      if (sortMode === "academic-year") {
        return parseYear(b) - parseYear(a) || parseBatch(a) - parseBatch(b)
      }
      return parseBatch(a) - parseBatch(b) || String(a.batchNo).localeCompare(String(b.batchNo))
    })
    return rows
  }, [filteredBatches, granteeCountsByBatchProgram, sortMode])

  const { contentRevealed, skeletonLeaving } = useContentReveal(isLoading)

  return (
    <section className="w-full min-w-0 max-w-full space-y-4">
      <div className="relative min-h-[124px]">
        {(isLoading || skeletonLeaving) && (
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !isLoading && "pointer-events-none absolute inset-0 z-0 opacity-0",
            )}
            aria-busy={isLoading}
            aria-hidden={!isLoading}
          >
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-[#081F5C]" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-emerald-500" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-violet-500" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-amber-500" />
          </div>
        )}
        {!isLoading && (
          <div className="relative z-10 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <SummaryStatCard
              label="Total Batches"
              value={summary.totalBatches}
              accentBar="border-l-[3px] border-l-[#081F5C]"
              glow="bg-[#081F5C]/25"
              iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
              Icon={Layers}
              className={revealItemClass(contentRevealed, 0, 60)}
              style={revealItemStyle(contentRevealed, 0, 60)}
            />
            <SummaryStatCard
              label="Publish Batches"
              value={summary.publishedBatches}
              accentBar="border-l-[3px] border-l-emerald-500"
              glow="bg-emerald-400/30"
              iconBg="bg-linear-to-br from-emerald-500 to-teal-600 text-white"
              Icon={TableProperties}
              className={revealItemClass(contentRevealed, 1, 60)}
              style={revealItemStyle(contentRevealed, 1, 60)}
            />
            <SummaryStatCard
              label="Hidden Batches"
              value={summary.hiddenBatches}
              accentBar="border-l-[3px] border-l-violet-500"
              glow="bg-violet-400/30"
              iconBg="bg-linear-to-br from-violet-500 to-fuchsia-600 text-white"
              Icon={CalendarDays}
              className={revealItemClass(contentRevealed, 2, 60)}
              style={revealItemStyle(contentRevealed, 2, 60)}
            />
            <SummaryStatCard
              label="Archive Batches"
              value={summary.archivedBatches}
              accentBar="border-l-[3px] border-l-amber-500"
              glow="bg-amber-400/30"
              iconBg="bg-linear-to-br from-amber-500 to-orange-500 text-white"
              Icon={GraduationCap}
              className={revealItemClass(contentRevealed, 3, 60)}
              style={revealItemStyle(contentRevealed, 3, 60)}
            />
          </div>
        )}
      </div>

      {/* Control Filter Bar */}
      <div className="mb-4 grid min-w-0 w-full max-w-full gap-3 md:grid-cols-12 md:items-center">
        <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 md:col-span-7 lg:col-span-8">
          <div className="relative min-w-0 w-full">
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className={`${selectShellClass} ${batchFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="__" disabled hidden>
                Batch Number
              </option>
              <option value="">All Batches</option>
              {uniqueBatchNos.map((batchNo) => (
                <option key={batchNo} value={batchNo}>
                  {batchNo}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="relative min-w-0 w-full">
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className={`${selectShellClass} ${programFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="__" disabled hidden>
                Program
              </option>
              <option value="">All Programs</option>
              {uniquePrograms.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="relative min-w-0 w-full">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className={`${selectShellClass} ${yearFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="__" disabled hidden>
                Academic Year
              </option>
              <option value="">All Years</option>
              {uniqueYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="relative min-w-0 w-full">
            <select
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value)}
              className={`${selectShellClass} ${scheduleFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="__" disabled hidden>
                Payout schedule
              </option>
              <option value="">All batches</option>
              <option value="scheduled">Has payout schedule</option>
              <option value="none">No payout schedule</option>
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="relative min-w-0 w-full sm:col-span-2 lg:col-span-1">
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className={`${selectShellClass} ${sortMode ? "text-neutral-900" : "text-neutral-500"}`}
            >
              <option value="batch-asc">Sort: Batch number</option>
              <option value="most-grantees">Sort: Most grantees</option>
              <option value="academic-year">Sort: Academic year (newest)</option>
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>
        </div>

        <div className="relative min-w-0 w-full max-w-full md:col-span-5 lg:col-span-4">
          <div className="relative w-full min-w-0 max-w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="h-9 w-full min-w-0 rounded-lg border-none ring-0 bg-white/95 pr-12 pl-4 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"
            />
            <button
              type="button"
              className="absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-linear-to-r from-[#081F5C] to-[#1447a6] p-0 shadow-sm hover:opacity-95"
              aria-label="Search"
            >
              <Search className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative min-h-[8rem]">
        {(isLoading || skeletonLeaving) && (
          <div
            className={cn(
              "transition-opacity duration-300 ease-out motion-reduce:transition-none",
              batchesView === "list"
                ? "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40"
                : "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
              !isLoading && "pointer-events-none absolute inset-x-0 top-0 z-0 opacity-0",
            )}
            aria-busy={isLoading}
            aria-hidden={!isLoading}
            aria-label="Loading batches"
          >
            {batchesView === "list" ? (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Program</th>
                    <th className="px-4 py-3">Academic year</th>
                    <th className="px-4 py-3">Grantees</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_, index) => (
                    <BatchListTableRowSkeleton key={index} />
                  ))}
                </tbody>
              </table>
            ) : (
              Array.from({ length: 6 }, (_, index) => <BatchCardSkeleton key={index} />)
            )}
          </div>
        )}

        {!isLoading &&
          (fetchError ? (
            <ConnectionProblemState
              error={fetchError}
              onRetry={() => {
                void refetchGrantees()
                void refetchArchived()
              }}
              subject="batches"
              variant="card"
              className={cn("relative z-10", revealItemClass(contentRevealed, 0))}
              style={revealItemStyle(contentRevealed, 0)}
            />
          ) : batchesView === "list" ? (
          <div
            className={cn(
              "relative z-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40",
              revealItemClass(contentRevealed, 0),
            )}
            style={revealItemStyle(contentRevealed, 0)}
          >
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Academic year</th>
                  <th className="px-4 py-3">Grantees</th>
                </tr>
              </thead>
              <tbody>
                {sortedBatches.map((row, index) => {
                  const programKey = String(row.program ?? "").trim().toUpperCase()
                  const grantees = granteeCountsByBatchProgram.get(`${row.batchNo}|${programKey}`) ?? 0
                  const payoutAnnouncement = payoutScheduleByBatchKey.get(getOperationalBatchKey(row))

                  return (
                    <tr
                      key={`${row.batchNo}-${row.program}-${row.schoolYear}`}
                      className={cn(
                        "cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/80 last:border-0 dark:border-white/6 dark:hover:bg-white/5",
                        revealItemClass(contentRevealed, index),
                      )}
                      style={revealItemStyle(contentRevealed, index)}
                      onClick={() => {
                        const params = new URLSearchParams()
                        params.set("batchNo", String(row.batchNo ?? ""))
                        params.set("program", String(row.program ?? ""))
                        params.set("academicYear", String(row.schoolYear ?? ""))
                        navigate(`/cashier/batch-info?${params.toString()}`)
                      }}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>Batch {row.batchNo}</span>
                          <PayoutScheduleBadge announcement={payoutAnnouncement} onOpenDetails={openScheduleDetails} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.program || "—"}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.schoolYear || "—"}</td>
                      <td className="px-4 py-3 font-medium text-emerald-800 dark:text-emerald-200">{grantees}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {sortedBatches.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {publishedBatches.length === 0
                  ? "No published batch records found."
                  : "No batches match your current filters or search."}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="relative z-10 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedBatches.map((row, index) => {
              const programKey = String(row.program ?? "").trim().toUpperCase()
              const grantees = granteeCountsByBatchProgram.get(`${row.batchNo}|${programKey}`) ?? 0
              const payoutAnnouncement = payoutScheduleByBatchKey.get(getOperationalBatchKey(row))

              return (
                <button
                  type="button"
                  key={`${row.batchNo}-${row.program}-${row.schoolYear}`}
                  onClick={() => {
                    const params = new URLSearchParams()
                    params.set("batchNo", String(row.batchNo ?? ""))
                    params.set("program", String(row.program ?? ""))
                    params.set("academicYear", String(row.schoolYear ?? ""))
                    navigate(`/cashier/batch-info?${params.toString()}`)
                  }}
                  className={cn(
                    "group relative w-full text-left overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6",
                    revealItemClass(contentRevealed, index),
                  )}
                  style={revealItemStyle(contentRevealed, index)}
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#081F5C]/8 blur-2xl dark:bg-[#1447a6]/15" aria-hidden />

                  <div className="relative flex items-start gap-3">
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#04133d] via-[#081F5C] to-[#1447a6] text-sm font-bold tracking-tight text-white shadow-md shadow-[#081F5C]/20"
                      aria-hidden
                    >
                      {String(row.batchNo ?? "?").slice(0, 3)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {formatCreatedAtDate(row.createdAt)}
                      </p>
                      <h3 className="mt-1 text-base font-semibold leading-snug text-slate-900 dark:text-white">
                        Batch {row.batchNo}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                          Program: {row.program || "—"}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                          AY: {row.schoolYear || "—"}
                        </span>
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/12 dark:text-emerald-100">
                          Grantees: {grantees}
                        </span>
                        <PayoutScheduleBadge announcement={payoutAnnouncement} onOpenDetails={openScheduleDetails} />
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}

            {sortedBatches.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                {publishedBatches.length === 0
                  ? "No published batch records found."
                  : "No batches match your current filters or search."}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <PayoutScheduleDetailsDialog
        announcement={scheduleDialogAnnouncement}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
      />

    </section>
  )
}