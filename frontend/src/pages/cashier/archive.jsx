import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, CalendarDays, GraduationCap, Search, SlidersHorizontal, TableProperties } from "lucide-react"

import { fetchArchivedBatches } from "@/lib/archiveApi"

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

function SummaryStatCard({ label, value, accentBar, glow, iconBg, Icon }) {
  return (
    <div
      className={`group relative min-h-[124px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6 ${accentBar}`}
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
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-black/4 dark:ring-white/10 ${iconBg}`}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      </div>
    </div>
  )
}

function formatDateTime(iso) {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })
  } catch {
    return "—"
  }
}

export default function CashierArchive() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [batchFilter, setBatchFilter] = useState("__")
  const [programFilter, setProgramFilter] = useState("__")
  const [yearFilter, setYearFilter] = useState("__")
  const [sortMode, setSortMode] = useState("claimed-newest")

  useEffect(() => {
    let cancelled = false

    const loadArchivedBatches = async () => {
      try {
        setIsLoading(true)
        setFetchError(null)
        const data = await fetchArchivedBatches()
        if (!cancelled) setRows(data)
      } catch (err) {
        if (!cancelled) {
          setFetchError(err.message || "Failed to load archived batches.")
          setRows([])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadArchivedBatches()
    return () => {
      cancelled = true
    }
  }, [])

  const uniqueBatchNos = useMemo(() => [...new Set(rows.map((r) => String(r.batchNo ?? "").trim()).filter(Boolean))].sort(), [rows])
  const uniqueYears = useMemo(() => [...new Set(rows.map((r) => String(r.schoolYear ?? "").trim()).filter(Boolean))].sort(), [rows])
  const uniquePrograms = useMemo(() => [...new Set(rows.map((r) => String(r.program ?? "").trim()).filter(Boolean))].sort(), [rows])

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return rows.filter((row) => {
      if (batchFilter !== "__" && String(row.batchNo) !== batchFilter) return false
      if (programFilter !== "__" && String(row.program) !== programFilter) return false
      if (yearFilter !== "__" && String(row.schoolYear) !== yearFilter) return false
      if (!query) return true
      return (
        String(row.batchNo ?? "").toLowerCase().includes(query) ||
        String(row.schoolYear ?? "").toLowerCase().includes(query) ||
        String(row.program ?? "").toLowerCase().includes(query)
      )
    })
  }, [batchFilter, programFilter, rows, searchTerm, yearFilter])

  const summary = useMemo(() => {
    const totalArchived = rows.length
    const visible = filteredRows.length
    const totalPrograms = uniquePrograms.length
    const totalYears = uniqueYears.length
    const totalGrantees = rows.reduce((acc, r) => acc + (Number(r.totalGrantees) || 0), 0)
    return { totalArchived, visible, totalPrograms, totalYears, totalGrantees }
  }, [filteredRows.length, rows, uniquePrograms.length, uniqueYears.length])

  const sortedRows = useMemo(() => {
    const list = [...filteredRows]
    const parseBatch = (row) => {
      const n = Number.parseFloat(String(row?.batchNo ?? "").trim())
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
    }
    const parseDate = (row) => {
      const t = new Date(row?.fullyClaimedAt ?? "").getTime()
      return Number.isFinite(t) ? t : 0
    }

    list.sort((a, b) => {
      if (sortMode === "batch-asc") return parseBatch(a) - parseBatch(b) || String(a.batchNo).localeCompare(String(b.batchNo))
      if (sortMode === "batch-desc") return parseBatch(b) - parseBatch(a) || String(b.batchNo).localeCompare(String(a.batchNo))
      if (sortMode === "claimed-oldest") return parseDate(a) - parseDate(b) || parseBatch(a) - parseBatch(b)
      // claimed-newest
      return parseDate(b) - parseDate(a) || parseBatch(a) - parseBatch(b)
    })
    return list
  }, [filteredRows, sortMode])

  return (
    <section className="w-full min-w-0 max-w-full space-y-4">
      {fetchError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-100">
          {fetchError}
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          label="Archived Batches"
          value={summary.totalArchived}
          accentBar="border-l-[3px] border-l-[#081F5C]"
          glow="bg-[#081F5C]/25"
          iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
          Icon={Archive}
        />
        <SummaryStatCard
          label="Visible Results"
          value={summary.visible}
          accentBar="border-l-[3px] border-l-emerald-500"
          glow="bg-emerald-400/30"
          iconBg="bg-linear-to-br from-emerald-500 to-teal-600 text-white"
          Icon={TableProperties}
        />
        <SummaryStatCard
          label="Academic Years"
          value={summary.totalYears}
          accentBar="border-l-[3px] border-l-violet-500"
          glow="bg-violet-400/30"
          iconBg="bg-linear-to-br from-violet-500 to-fuchsia-600 text-white"
          Icon={CalendarDays}
        />
        <SummaryStatCard
          label="Total Grantees"
          value={summary.totalGrantees}
          accentBar="border-l-[3px] border-l-amber-500"
          glow="bg-amber-400/30"
          iconBg="bg-linear-to-br from-amber-500 to-orange-500 text-white"
          Icon={GraduationCap}
        />
      </div>

      <div className="mb-4 grid min-w-0 w-full max-w-full gap-3 md:grid-cols-12 md:items-center">
        <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:col-span-7 lg:col-span-8">
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
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className={`${selectShellClass} ${sortMode ? "text-neutral-900" : "text-neutral-500"}`}
            >
              <option value="claimed-newest">Sort: Claimed (newest)</option>
              <option value="claimed-oldest">Sort: Claimed (oldest)</option>
              <option value="batch-asc">Sort: Batch number (asc)</option>
              <option value="batch-desc">Sort: Batch number (desc)</option>
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

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedRows.map((row) => (
          <button
            type="button"
            key={`${row.batchNo}-${row.program}-${row.schoolYear}`}
            onClick={() => {
              const params = new URLSearchParams()
              params.set("batchNo", String(row.batchNo ?? ""))
              params.set("program", String(row.program ?? ""))
              params.set("academicYear", String(row.schoolYear ?? ""))
              navigate(`/cashier/archive-batch?${params.toString()}`)
            }}
            className="group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6"
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Archived • Fully claimed</p>
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/12 dark:text-emerald-100">
                    Fully claimed
                  </span>
                </div>

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
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-100">
                    Grantees: {row.totalGrantees ?? 0}
                  </span>
                </div>

                <div className="mt-3 grid gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">Fully claimed at</span>
                    <span className="font-semibold tabular-nums">{formatDateTime(row.fullyClaimedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">Archived at</span>
                    <span className="font-semibold tabular-nums">{formatDateTime(row.archivedAt)}</span>
                  </div>
                </div>

              </div>
            </div>
          </button>
        ))}

        {isLoading ? (
          <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/40">
            Loading archived batches…
          </div>
        ) : null}

        {!isLoading && sortedRows.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No archived batches found.
          </div>
        ) : null}
      </div>
    </section>
  )
}
