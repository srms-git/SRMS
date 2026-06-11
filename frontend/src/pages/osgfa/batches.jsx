import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Archive,
  CalendarDays,
  ChevronDown,
  EyeOff,
  Globe,
  GraduationCap,
  Hash,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react"

import { ConnectionProblemState } from "@/components/ConnectionProblemState"
import { FeedbackModal } from "@/components/FeedbackModal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  batchNumberConflictsInProgram,
  isGranteeRecordActive,
  updateBatchMetadata,
} from "@/lib/granteesApi"
import { useArchivedBatchesQuery, useGranteesQuery, useInvalidateGranteeCaches } from "@/hooks/useSrmsQueries"
import {
  isBatchVisibleOnLanding,
  renameLandingBatchVisibility,
  setLandingBatchVisibility,
  useLandingBatchVisibility,
} from "@/lib/landingFeaturedBatches"
import { useOsgfaPrograms } from "@/hooks/useOsgfaPrograms"
import { buildActiveProgramCodeSet } from "@/lib/osgfaPrograms"
import { cn } from "@/lib/utils"

const SKELETON_EXIT_MS = 280
const revealItemClass = (revealed, index, stepMs = 45) =>
  cn(
    "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:translate-y-0",
    revealed ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
  )
const revealItemStyle = (revealed, index, stepMs = 45) => ({
  transitionDelay: revealed ? `${Math.min(index, 12) * stepMs}ms` : "0ms",
})

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

function SummaryStatCardSkeleton({ accentBar, className }) {
  return (
    <div
      className={cn(
        `relative min-h-[124px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6 ${accentBar}`,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3 pr-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-14" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
    </div>
  )
}

function BatchCardSkeleton({ className }) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6",
        className,
      )}
    >
      <div className="flex items-start gap-3 pr-8">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-3 w-36 max-w-full" />
          <Skeleton className="h-5 w-28 max-w-full" />
          <div className="flex flex-wrap gap-2 pt-0.5">
            <Skeleton className="h-5 w-[4.5rem] rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-[4.75rem] rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function BatchesEmptyState({ variant, onClearFilters, onAddBatch, className, style }) {
  if (variant === "filtered") {
    return (
      <div
        className={cn(
          "sm:col-span-2 lg:col-span-3 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-slate-900/40",
          className,
        )}
        style={style}
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
          <SearchX className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No matching batches</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Nothing matches your current search or filters. Try different keywords, or reset the filters to see all
          batches.
        </p>
        <Button type="button" variant="outline" className="mt-6" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "sm:col-span-2 lg:col-span-3 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-slate-900/40",
        className,
      )}
      style={style}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#081F5C]/8 text-[#081F5C] dark:bg-[#1447a6]/20 dark:text-sky-200">
        <Layers className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No batches yet</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Batches are created when you add grantees. Start by adding your first batch to organize scholars by program and
        academic year.
      </p>
      <Button type="button" className="mt-6 bg-[#081F5C] hover:bg-[#0b2d83]" onClick={onAddBatch}>
        <Plus className="mr-2 h-4 w-4" aria-hidden />
        Add batch
      </Button>
    </div>
  )
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
  const isLoading = granteesLoading || archivedLoading
  const fetchError =
    granteesError?.message ??
    archivedError?.message ??
    null

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

  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const landingVisibility = useLandingBatchVisibility()
  const { activePrograms, programs } = useOsgfaPrograms()
  const archivedBatchCount = archivedBatches.length

  const showFeedback = useCallback((variant, title, message) => {
    setFeedbackVariant(variant)
    setFeedbackTitle(title)
    setFeedbackMessage(message)
    setFeedbackOpen(true)
  }, [])

  const invalidateGranteeCaches = useInvalidateGranteeCaches()
  const loadGrantees = useCallback(async () => {
    invalidateGranteeCaches()
    await Promise.all([refetchGrantees(), refetchArchived()])
  }, [invalidateGranteeCaches, refetchGrantees, refetchArchived])

  const [contentRevealed, setContentRevealed] = useState(false)
  const [skeletonLeaving, setSkeletonLeaving] = useState(false)

  useEffect(() => {
    if (isLoading) {
      setContentRevealed(false)
      setSkeletonLeaving(false)
      return
    }

    setSkeletonLeaving(true)
    const revealFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setContentRevealed(true))
    })
    const hideSkeletonTimer = window.setTimeout(() => setSkeletonLeaving(false), SKELETON_EXIT_MS)

    return () => {
      cancelAnimationFrame(revealFrame)
      window.clearTimeout(hideSkeletonTimer)
    }
  }, [isLoading])

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

  const activeProgramCodes = useMemo(() => buildActiveProgramCodeSet(programs), [programs])

  const visibleBatches = useMemo(
    () => batches.filter((row) => activeProgramCodes.has(String(row.program ?? "").trim().toUpperCase())),
    [activeProgramCodes, batches],
  )

  useEffect(() => {
    if (programFilter !== "__" && programFilter !== "" && !activeProgramCodes.has(String(programFilter).trim().toUpperCase())) {
      setProgramFilter("__")
    }
  }, [activeProgramCodes, programFilter])

  const granteeCountsByBatchProgram = useMemo(() => {
    const map = new Map()
    granteesRawData.forEach((item) => {
      if (!isGranteeRecordActive(item)) return
      const bNo = String(item.batchNo ?? "").trim()
      const prog = String(item.program ?? "").trim().toUpperCase()
      const ay = String(item.academicYear ?? "").trim()
      if (!bNo || !prog) return

      const key = ay ? `${bNo}|${prog}|${ay}` : `${bNo}|${prog}`
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return map
  }, [granteesRawData])

  const uniqueBatchNos = useMemo(
    () => [...new Set(visibleBatches.map((row) => String(row.batchNo ?? "").trim()).filter(Boolean))].sort(),
    [visibleBatches],
  )
  const uniqueYears = useMemo(
    () => [...new Set(visibleBatches.map((row) => String(row.schoolYear ?? "").trim()).filter(Boolean))].sort(),
    [visibleBatches],
  )
  const uniquePrograms = useMemo(
    () => [...new Set(visibleBatches.map((row) => String(row.program ?? "").trim()).filter(Boolean))].sort(),
    [visibleBatches],
  )

  const filteredBatches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return visibleBatches.filter((row) => {
      if (batchFilter !== "__" && batchFilter !== "" && String(row.batchNo ?? "") !== batchFilter) return false
      if (programFilter !== "__" && programFilter !== "" && String(row.program ?? "") !== programFilter) return false
      if (yearFilter !== "__" && yearFilter !== "" && String(row.schoolYear ?? "") !== yearFilter) return false
      if (!query) return true
      return (
        String(row.batchNo ?? "").toLowerCase().includes(query) ||
        String(row.schoolYear ?? "").toLowerCase().includes(query) ||
        String(row.program ?? "").toLowerCase().includes(query)
      )
    })
  }, [visibleBatches, batchFilter, programFilter, searchTerm, yearFilter])

  const summary = useMemo(() => {
    let publishedBatches = 0
    let hiddenBatches = 0

    for (const batch of visibleBatches) {
      if (isBatchVisibleOnLanding(batch, landingVisibility)) {
        publishedBatches += 1
      } else {
        hiddenBatches += 1
      }
    }

    return {
      totalBatches: visibleBatches.length,
      publishedBatches,
      hiddenBatches,
      archivedBatches: archivedBatchCount,
    }
  }, [archivedBatchCount, landingVisibility, visibleBatches])

  const sortedBatches = useMemo(() => {
    const getGrantees = (row) => {
      const programKey = String(row?.program ?? "").trim().toUpperCase()
      const academicYear = String(row?.schoolYear ?? row?.academicYear ?? "").trim()
      return (
        granteeCountsByBatchProgram.get(`${row?.batchNo}|${programKey}|${academicYear}`)
        ?? granteeCountsByBatchProgram.get(`${row?.batchNo}|${programKey}`)
        ?? 0
      )
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
      showFeedback(
        "warning",
        "Incomplete batch details",
        "Enter a batch number, choose a program, and select the full academic year before saving.",
      )
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
        "Batch number already exists",
        `Batch ${newBatchNo} is already assigned to ${newProgram}. Use a different batch number, or pick another program if this is a separate cohort.`,
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
        "Changes saved",
        `Batch ${newBatchNo} (${newProgram}, AY ${newAcademicYear}) is updated. ${result.count ?? 0} grantee${result.count === 1 ? "" : "s"} now use these details.`,
      )
    } catch (err) {
      if (err?.status === 409 || err?.code === "BATCH_NUMBER_CONFLICT") {
        setEditOpen(false)
        showFeedback(
          "warning",
          "Batch number already exists",
          err.message ||
            `Batch ${newBatchNo} is already assigned to ${newProgram}. Use a different batch number, or pick another program if this is a separate cohort.`,
        )
        return
      }
      if (err?.status === 404) {
        setEditOpen(false)
        showFeedback(
          "warning",
          "Batch no longer available",
          err.message ||
            "This batch may have been removed or changed elsewhere. Refresh the page to see the latest list, then try your edit again.",
        )
        return
      }
      showFeedback(
        "warning",
        "Couldn't save changes",
        err?.message ?? "Something went wrong while saving. Wait a moment and try again.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const editAcademicYearPreview = editFromYear && editToYear ? `${editFromYear}-${editToYear}` : "—"

  const normalizeBatchRow = (row) => {
    const batchNo = String(row?.batchNo ?? "").trim()
    const program = String(row?.program ?? "").trim().toUpperCase()
    const academicYear = String(row?.schoolYear ?? row?.academicYear ?? "").trim()
    return { batchNo, program, schoolYear: academicYear, academicYear }
  }

  const handleToggleLandingVisibility = async (row) => {
    const batch = normalizeBatchRow(row)
    const currentlyVisible = isBatchVisibleOnLanding(batch, landingVisibility)
    const granteeCount =
      granteeCountsByBatchProgram.get(`${batch.batchNo}|${batch.program}|${batch.academicYear}`)
      ?? granteeCountsByBatchProgram.get(`${batch.batchNo}|${batch.program}`)
      ?? 0

    if (!batch.batchNo || !batch.program || !batch.academicYear) {
      showFeedback(
        "warning",
        "Can't update visibility",
        "This batch is missing a batch number, program, or academic year. Edit the batch or ensure grantees have complete details, then try again.",
      )
      return
    }

    try {
      await setLandingBatchVisibility(batch, !currentlyVisible, granteeCount)
      showFeedback(
        "success",
        currentlyVisible ? "Hidden from landing page" : "Published on landing page",
        currentlyVisible
          ? `Batch ${batch.batchNo} (${batch.program}) will no longer appear on the public landing page.`
          : `Batch ${batch.batchNo} (${batch.program}) is now visible to visitors on the landing page.`,
      )
    } catch (error) {
      console.error("Failed to update landing batch visibility:", error)
      showFeedback(
        "warning",
        "Couldn't update visibility",
        error?.response?.data?.message ??
          error?.message ??
          "We couldn't save whether this batch shows on the landing page. Make sure the server is running, then try again.",
      )
    }
  }

  const getBatchArchiveStats = useCallback(
    (row) => {
      const batchNo = String(row?.batchNo ?? "").trim()
      const program = String(row?.program ?? "").trim().toUpperCase()
      const academicYear = String(row?.schoolYear ?? row?.academicYear ?? "").trim()

      let total = 0
      let claimed = 0
      for (const item of granteesRawData) {
        if (!isGranteeRecordActive(item)) continue
        if (String(item.batchNo ?? "").trim() !== batchNo) continue
        if (String(item.program ?? "").trim().toUpperCase() !== program) continue
        if (String(item.academicYear ?? "").trim() !== academicYear) continue
        total += 1
        if (String(item.status ?? "").trim().toLowerCase() === "claimed") claimed += 1
      }

      return { total, claimed, unclaimed: Math.max(0, total - claimed) }
    },
    [granteesRawData],
  )

  const openArchiveConfirm = (row) => {
    const batch = normalizeBatchRow(row)
    if (!batch.batchNo || !batch.program || !batch.academicYear) {
      showFeedback(
        "warning",
        "Can't archive batch",
        "This batch is missing a batch number, program, or academic year. Edit the batch or ensure grantees have complete details, then try again.",
      )
      return
    }

    setArchiveTarget(batch)
    setArchiveConfirmOpen(true)
  }

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return

    const target = archiveTarget

    try {
      setIsArchiving(true)
      const { manualArchiveBatch } = await import("@/lib/archiveApi")
      const result = await manualArchiveBatch({
        batchNo: target.batchNo,
        program: target.program,
        academicYear: target.academicYear,
      })

      setArchiveConfirmOpen(false)
      setArchiveTarget(null)
      await loadGrantees()

      if (result?.newlyArchived === false && result?.isArchived) {
        showFeedback(
          "info",
          "Already archived",
          result.message || `Batch ${target.batchNo} is already in the archive.`,
        )
        return
      }

      showFeedback(
        "success",
        "Batch archived",
        result?.message ||
          `Batch ${target.batchNo} (${target.program}, AY ${target.academicYear}) has been moved to the archive.`,
      )
    } catch (err) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        "Something went wrong while archiving. Wait a moment and try again."
      showFeedback("warning", "Couldn't archive batch", message)
    } finally {
      setIsArchiving(false)
    }
  }

  const clearFilters = () => {
    setBatchFilter("__")
    setProgramFilter("__")
    setYearFilter("__")
    setSearchTerm("")
  }

  const archiveStats = archiveTarget ? getBatchArchiveStats(archiveTarget) : null

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

      <div className="relative min-h-[8rem]">
        {(isLoading || skeletonLeaving) && (
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !isLoading && "pointer-events-none absolute inset-x-0 top-0 z-0 opacity-0",
            )}
            aria-busy={isLoading}
            aria-hidden={!isLoading}
            aria-label="Loading batches"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <BatchCardSkeleton key={index} />
            ))}
          </div>
        )}

        {!isLoading &&
          (fetchError ? (
            <ConnectionProblemState
              error={fetchError}
              onRetry={loadGrantees}
              subject="batches"
              variant="card"
              className={revealItemClass(contentRevealed, 0)}
              style={revealItemStyle(contentRevealed, 0)}
            />
          ) : (
            <div className="relative z-10 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedBatches.map((row, index) => {
            const programKey = String(row.program ?? "").trim().toUpperCase()
            const academicYear = String(row.schoolYear ?? row.academicYear ?? "").trim()
            const grantees =
              granteeCountsByBatchProgram.get(`${row.batchNo}|${programKey}|${academicYear}`)
              ?? granteeCountsByBatchProgram.get(`${row.batchNo}|${programKey}`)
              ?? 0
            const visibleOnLanding = isBatchVisibleOnLanding(row, landingVisibility)

            return (
              <div
                key={`${row.batchNo}-${row.program}-${row.schoolYear}`}
                className={cn(
                  "group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6",
                  revealItemClass(contentRevealed, index),
                )}
                style={revealItemStyle(contentRevealed, index)}
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
                      <DropdownMenuItem
                        className="gap-2 text-amber-700 focus:text-amber-700 dark:text-amber-300 dark:focus:text-amber-300"
                        onSelect={() => openArchiveConfirm(row)}
                      >
                        <Archive className="size-4 opacity-70" />
                        Archive
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
            <BatchesEmptyState
              variant={visibleBatches.length === 0 ? "empty" : "filtered"}
              onClearFilters={clearFilters}
              onAddBatch={() => navigate("/osgfa/add-grantees")}
              className={revealItemClass(contentRevealed, 0)}
              style={revealItemStyle(contentRevealed, 0)}
            />
          ) : null}
            </div>
          ))}
      </div>

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
                  {activePrograms.map((program) => (
                    <option key={program.id ?? program.code} value={program.code}>
                      {program.code}
                      {program.name && program.name !== program.code ? ` — ${program.name}` : ""}
                    </option>
                  ))}
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

      {archiveTarget ? (
        <AlertDialog
          open={archiveConfirmOpen}
          onOpenChange={(open) => {
            setArchiveConfirmOpen(open)
            if (!open && !isArchiving) setArchiveTarget(null)
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Archive batch {archiveTarget.batchNo}?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Are you sure you want to archive{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Batch {archiveTarget.batchNo}
                    </span>{" "}
                    ({archiveTarget.program}, AY {archiveTarget.academicYear})? This will move all{" "}
                    {archiveStats?.total ?? 0} grantee{(archiveStats?.total ?? 0) === 1 ? "" : "s"} to the archive and
                    remove the batch from the active list.
                  </p>
                  {archiveStats?.unclaimed > 0 ? (
                    <p className="text-amber-700 dark:text-amber-300">
                      {archiveStats.unclaimed} grantee{archiveStats.unclaimed === 1 ? " has" : "s have"} not claimed
                      their payouts yet. You can still archive manually, but this batch will no longer appear in active
                      batches.
                    </p>
                  ) : null}
                  <p>This action cannot be undone from the batches page.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(event) => {
                  event.preventDefault()
                  void handleConfirmArchive()
                }}
                disabled={isArchiving}
              >
                {isArchiving ? "Archiving…" : "Archive batch"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

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
