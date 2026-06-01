import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarDays,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  EyeOff,
  Globe,
  GraduationCap,
  Hash,
  Info,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  batchNumberConflictsInProgram,
  fetchAllGrantees,
  updateBatchMetadata,
} from "@/lib/granteesApi"
import {
  isBatchVisibleOnLanding,
  renameLandingBatchVisibility,
  setLandingBatchVisibility,
  useLandingBatchVisibility,
} from "@/lib/landingFeaturedBatches"

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

function academicYearOptions() {
  const currentYear = new Date().getFullYear()
  const start = 1990
  const end = currentYear + 10
  const options = []
  for (let y = start; y <= end; y++) {
    options.push(String(y))
  }
  return options
}

function parseAcademicYear(value) {
  const text = String(value ?? "").trim()
  const [fromYear = "", toYear = ""] = text.split("-")
  return { fromYear: fromYear.trim(), toYear: toYear.trim() }
}

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

function FeedbackModal({ open, onOpenChange, variant = "info", title, message }) {
  const meta = useMemo(() => {
    if (variant === "success") {
      return {
        Icon: CircleCheck,
        iconWrap: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        topBar: "from-emerald-500 via-emerald-600 to-teal-600",
        title: title || "Success",
      }
    }
    if (variant === "warning") {
      return {
        Icon: CircleAlert,
        iconWrap: "bg-amber-50 text-amber-700 ring-amber-200",
        topBar: "from-amber-500 via-orange-500 to-red-500",
        title: title || "Warning",
      }
    }
    return {
      Icon: Info,
      iconWrap: "bg-[#081F5C]/8 text-[#081F5C] ring-[#081F5C]/15",
      topBar: "from-[#04133d] via-[#081F5C] to-[#1447a6]",
      title: title || "Notice",
    }
  }, [variant, title])

  const Icon = meta.Icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative w-[min(92vw,34rem)] max-w-none overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
        <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r ${meta.topBar}`} aria-hidden />
        <DialogHeader className="relative shrink-0 pt-1">
          <DialogTitle className="flex items-center gap-3">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.iconWrap}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">{meta.title}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">{message || meta.title}</DialogDescription>
        </DialogHeader>

        <div className="py-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{message || "—"}</div>

        <DialogFooter className="mt-2 sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)} className="bg-[#081F5C] hover:bg-[#0b2d83]">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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

  const [granteesRawData, setGranteesRawData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [batchFilter, setBatchFilter] = useState("__")
  const [programFilter, setProgramFilter] = useState("__")
  const [yearFilter, setYearFilter] = useState("__")
  const [sortMode, setSortMode] = useState("batch-asc")

  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editBatchNo, setEditBatchNo] = useState("")
  const [editProgram, setEditProgram] = useState("")
  const [editFromYear, setEditFromYear] = useState("")
  const [editToYear, setEditToYear] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackVariant, setFeedbackVariant] = useState("info")
  const [feedbackTitle, setFeedbackTitle] = useState("")
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const landingVisibility = useLandingBatchVisibility()

  const showFeedback = useCallback((variant, title, message) => {
    setFeedbackVariant(variant)
    setFeedbackTitle(title)
    setFeedbackMessage(message)
    setFeedbackOpen(true)
  }, [])

  const loadGrantees = useCallback(async () => {
    try {
      setIsLoading(true)
      setFetchError(null)
      const data = await fetchAllGrantees()
      setGranteesRawData(data)
    } catch (err) {
      console.error("Error connecting batches layout:", err)
      setFetchError(err?.message ?? "Failed to load grantee records from the database.")
      setGranteesRawData([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGrantees()
  }, [loadGrantees])

  const batches = useMemo(() => {
    const uniqueMap = new Map()

    granteesRawData.forEach((item) => {
      const bNo = String(item.batchNo ?? "").trim()
      const prog = String(item.program ?? "").trim().toUpperCase()
      const ay = String(item.academicYear ?? "").trim()

      if (!bNo || !prog) return

      const key = `${bNo}|${prog}|${ay}`
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          batchNo: bNo,
          program: prog,
          schoolYear: ay,
          createdAt: item.createdAt || new Date().toISOString(),
        })
      }
    })

    return Array.from(uniqueMap.values())
  }, [granteesRawData])

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
    () => [...new Set(batches.map((row) => String(row.batchNo ?? "").trim()).filter(Boolean))].sort(),
    [batches],
  )
  const uniqueYears = useMemo(() => [...new Set(batches.map((row) => String(row.schoolYear ?? "").trim()).filter(Boolean))].sort(), [batches])
  const uniquePrograms = useMemo(() => [...new Set(batches.map((row) => String(row.program ?? "").trim()).filter(Boolean))].sort(), [batches])

  const filteredBatches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return batches.filter((row) => {
      if (batchFilter !== "__" && row.batchNo !== batchFilter) return false
      if (programFilter !== "__" && row.program !== programFilter) return false
      if (yearFilter !== "__" && row.schoolYear !== yearFilter) return false
      if (!query) return true
      return (
        String(row.batchNo ?? "").toLowerCase().includes(query) ||
        String(row.schoolYear ?? "").toLowerCase().includes(query) ||
        String(row.program ?? "").toLowerCase().includes(query)
      )
    })
  }, [batches, batchFilter, programFilter, searchTerm, yearFilter])

  const summary = useMemo(
    () => ({
      totalBatches: batches.length,
      visibleBatches: filteredBatches.length,
      totalYears: uniqueYears.length,
      totalSemesters: uniquePrograms.length,
    }),
    [batches.length, filteredBatches.length, uniquePrograms.length, uniqueYears.length],
  )

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

  const openBatchEdit = (row) => {
    const { fromYear, toYear } = parseAcademicYear(row.schoolYear)
    setEditTarget(row)
    setEditBatchNo(String(row.batchNo ?? ""))
    setEditProgram(String(row.program ?? "").trim().toUpperCase())
    setEditFromYear(fromYear)
    setEditToYear(toYear)
    setEditOpen(true)
  }

  const navigateToBatch = (row) => {
    const params = new URLSearchParams()
    params.set("batchNo", String(row.batchNo ?? ""))
    params.set("program", String(row.program ?? ""))
    params.set("academicYear", String(row.schoolYear ?? ""))
    navigate(`/osgfa/batch-info?${params.toString()}`)
  }

  const handleSaveBatchEdit = async () => {
    if (!editTarget) return

    const newBatchNo = String(editBatchNo).trim()
    const newProgram = String(editProgram).trim().toUpperCase()
    const newAcademicYear = editFromYear && editToYear ? `${editFromYear}-${editToYear}` : ""

    if (!newBatchNo || !newProgram || !newAcademicYear) {
      showFeedback("warning", "Missing fields", "Please fill in batch number, program, and academic year before saving.")
      return
    }

    const unchanged =
      newBatchNo === String(editTarget.batchNo ?? "").trim() &&
      newProgram === String(editTarget.program ?? "").trim().toUpperCase() &&
      newAcademicYear === String(editTarget.schoolYear ?? "").trim()

    if (unchanged) {
      setEditOpen(false)
      return
    }

    const hasConflict = batchNumberConflictsInProgram(granteesRawData, {
      batchNo: newBatchNo,
      program: newProgram,
      excludeBatch: {
        batchNo: editTarget.batchNo,
        program: editTarget.program,
        schoolYear: editTarget.schoolYear,
      },
    })

    if (hasConflict) {
      setEditOpen(false)
      showFeedback(
        "warning",
        "Duplicate batch number",
        `Batch number ${newBatchNo} is already in use for the ${newProgram} program. Choose a different batch number or program before saving.`,
      )
      return
    }

    try {
      setIsSaving(true)
      const result = await updateBatchMetadata({
        originalBatchNo: editTarget.batchNo,
        originalProgram: editTarget.program,
        originalAcademicYear: editTarget.schoolYear,
        newBatchNo,
        newProgram,
        newAcademicYear,
      })

      await renameLandingBatchVisibility(
        {
          batchNo: editTarget.batchNo,
          program: editTarget.program,
          schoolYear: editTarget.schoolYear,
        },
        {
          batchNo: newBatchNo,
          program: newProgram,
          schoolYear: newAcademicYear,
        },
      )

      setEditOpen(false)
      setEditTarget(null)
      await loadGrantees()

      showFeedback(
        "success",
        "Batch updated",
        `Batch details were saved. ${result.count ?? 0} grantee record${result.count === 1 ? "" : "s"} now reflect batch ${newBatchNo} (${newProgram}, AY ${newAcademicYear}).`,
      )
    } catch (err) {
      if (err?.status === 409 || err?.code === "BATCH_NUMBER_CONFLICT") {
        setEditOpen(false)
        showFeedback(
          "warning",
          "Duplicate batch number",
          err.message ||
            `Batch number ${newBatchNo} is already in use for the ${newProgram} program. Choose a different batch number or program before saving.`,
        )
        return
      }
      if (err?.status === 404) {
        setEditOpen(false)
        showFeedback(
          "warning",
          "Batch not found",
          err.message ||
            "No grantees matched this batch. Refresh the page and try again, or restart the backend if the problem continues.",
        )
        return
      }
      showFeedback("warning", "Update failed", err?.message ?? "Failed to save batch changes. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const editAcademicYearPreview = editFromYear && editToYear ? `${editFromYear}-${editToYear}` : "—"

  const handleToggleLandingVisibility = async (row) => {
    const currentlyVisible = isBatchVisibleOnLanding(row, landingVisibility)
    const programKey = String(row?.program ?? "").trim().toUpperCase()
    const granteeCount = granteeCountsByBatchProgram.get(`${row?.batchNo}|${programKey}`) ?? 0

    try {
      await setLandingBatchVisibility(row, !currentlyVisible, granteeCount)
      showFeedback(
        "success",
        currentlyVisible ? "Batch hidden" : "Batch published",
        currentlyVisible
          ? `Batch ${row.batchNo} is no longer shown on the landing page.`
          : `Batch ${row.batchNo} is now visible on the landing page.`,
      )
    } catch (error) {
      console.error("Failed to update landing batch visibility:", error)
      showFeedback(
        "warning",
        "Update failed",
        error?.response?.data?.message ??
          error?.message ??
          "Could not save landing batch visibility. Check that the backend is running.",
      )
    }
  }

  return (
    <section className="w-full min-w-0 max-w-full space-y-4">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          label="Total Batches"
          value={summary.totalBatches}
          accentBar="border-l-[3px] border-l-[#081F5C]"
          glow="bg-[#081F5C]/25"
          iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
          Icon={Layers}
        />
        <SummaryStatCard
          label="Active Batches"
          value={summary.visibleBatches}
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
          label="Semestral Labels"
          value={summary.totalSemesters}
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

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Syncing active server storage...
        </div>
      ) : fetchError ? (
        <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/50 p-10 text-center text-sm text-red-500">
          Error syncing dashboard: {fetchError}
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedBatches.map((row) => {
            const programKey = String(row.program ?? "").trim().toUpperCase()
            const grantees = granteeCountsByBatchProgram.get(`${row.batchNo}|${programKey}`) ?? 0
            const visibleOnLanding = isBatchVisibleOnLanding(row, landingVisibility)

            return (
              <div
                key={`${row.batchNo}-${row.program}-${row.schoolYear}`}
                className="group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#081F5C]/8 blur-2xl dark:bg-[#1447a6]/15" aria-hidden />

                <div className="absolute right-2 top-2 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for batch ${row.batchNo}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-36">
                      <DropdownMenuItem className="gap-2" onSelect={() => openBatchEdit(row)}>
                        <Pencil className="size-4 opacity-70" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onSelect={() => handleToggleLandingVisibility(row)}>
                        {visibleOnLanding ? (
                          <>
                            <EyeOff className="size-4 opacity-70" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Globe className="size-4 opacity-70" />
                            Publish
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <button
                  type="button"
                  onClick={() => navigateToBatch(row)}
                  className="relative w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25 rounded-xl"
                >
                  <div className="flex items-start gap-3 pr-8">
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
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            visibleOnLanding
                              ? "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/35 dark:bg-sky-500/12 dark:text-sky-100"
                              : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                          }`}
                        >
                          {visibleOnLanding ? "Published" : "Hidden"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )
          })}

          {sortedBatches.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No batch records found.
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="relative w-[min(92vw,34rem)] max-w-none overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6]" aria-hidden />
          <DialogHeader className="relative shrink-0 pt-1">
            <DialogTitle>Edit batch</DialogTitle>
            <DialogDescription>
              Update the batch number, program, or academic year. All grantees in this batch will be updated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="edit-batch-no" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Batch Number
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="edit-batch-no"
                  type="text"
                  value={editBatchNo}
                  onChange={(event) => setEditBatchNo(event.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-3 text-sm shadow-sm focus-visible:ring-[#081F5C]/25"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-program" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Program
              </label>
              <div className="relative">
                <select
                  id="edit-program"
                  value={editProgram}
                  onChange={(event) => setEditProgram(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25"
                >
                  <option value="" disabled>
                    Select program
                  </option>
                  <option value="TES">TES</option>
                  <option value="TDP">TDP</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Academic Year</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="relative">
                  <select
                    value={editFromYear}
                    onChange={(event) => {
                      const nextFrom = event.target.value
                      setEditFromYear(nextFrom)
                      setEditToYear(nextFrom ? String(Number(nextFrom) + 1) : "")
                    }}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25"
                  >
                    <option value="" disabled>
                      From
                    </option>
                    {academicYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                </div>
                <div className="relative">
                  <select
                    value={editToYear}
                    onChange={(event) => setEditToYear(event.target.value)}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25"
                  >
                    <option value="" disabled>
                      To
                    </option>
                    {academicYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                </div>
                <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 dark:bg-white/5 dark:text-white">
                  <span className="text-xs font-medium text-slate-500">Preview</span>
                  <span className="tabular-nums">{editAcademicYearPreview}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveBatchEdit} disabled={isSaving} className="bg-[#081F5C] hover:bg-[#0b2d83]">
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        variant={feedbackVariant}
        title={feedbackTitle}
        message={feedbackMessage}
      />

      <button
        type="button"
        onClick={() => navigate("/osgfa/add-grantees")}
        className="group fixed bottom-8 right-8 z-50 inline-flex h-12 w-12 items-center justify-center gap-0 overflow-hidden rounded-full bg-linear-to-r from-[#081F5C] to-[#1447a6] px-0 text-white shadow-lg shadow-[#081F5C]/25 transition-all duration-200 hover:-translate-y-0.5 hover:w-36 hover:justify-start hover:gap-2 hover:px-3 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        aria-label="Add new batch"
        title="Add new batch"
      >
        <Plus className="size-5 shrink-0 text-white" strokeWidth={3} aria-hidden />
        <span className="pointer-events-none max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-200 group-hover:max-w-[120px] group-hover:opacity-100 group-focus-visible:max-w-[120px] group-focus-visible:opacity-100">
          Add Batch
        </span>
      </button>
    </section>
  )
}
