import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ChevronDown, Download, Eye, Layers, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildMonthlyClaimTrend, buildYearLevelDonut, mapGranteeFromApi } from "@/lib/granteesApi"
import { useArchivedBatchDetailQuery } from "@/hooks/useSrmsQueries"
import {
  ChartAreaSkeleton,
  ChartDonutSkeleton,
  GranteeTableRowSkeleton,
  SKELETON_ROW_COUNT,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"
import { cn } from "@/lib/utils"
import { useOsgfaPrivacySettings } from "@/hooks/useOsgfaPrivacySettings"

/** Area chart: claimed = brand navy, unclaimed = red */
const CLAIM_STROKE = "#081F5C"
const UNCLAIM_STROKE = "#dc2626"

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

const TREND_RANGE = {
  THIS_WEEK: "this-week",
  THIS_MONTH: "this-month",
  LAST_MONTH: "last-month",
  THIS_YEAR: "this-year",
  LAST_YEAR: "last-year",
}

function ArchiveBatchRecordView({ row, formatStudentId }) {
  if (!row) return null

  const detailItems = [
    { label: "Batch number", value: row.batchNo },
    { label: "Sequence no.", value: row.seqNo },
    { label: "Student ID", value: row.studentId },
    { label: "Award number", value: row.awardNumber, mono: true },
    { label: "Enrolled program", value: row.enrolledProgram },
    { label: "Year level", value: row.yearLevel },
    { label: "Status", value: row.status },
  ]

  const initials =
    typeof row.fullName === "string" && row.fullName.trim()
      ? row.fullName
          .split(/[ ,]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase()
      : "AB"

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/85 bg-linear-to-br from-white via-slate-50/40 to-[#081F5C]/[0.07] p-4 shadow-sm ring-1 ring-slate-900/4 dark:border-white/10 dark:from-slate-950 dark:via-slate-900/50 dark:to-[#081F5C]/15 dark:ring-white/6">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-[#081F5C]/10 blur-3xl dark:bg-[#1447a6]/20"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#04133d] via-[#081F5C] to-[#1447a6] text-base font-bold tracking-tight text-white shadow-md shadow-[#081F5C]/25"
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Archived grantee
              </p>
              <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">
                {row.fullName || "—"}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-700 dark:text-slate-200">Student ID</span>{" "}
                <span className="font-mono text-[13px] text-[#081F5C] dark:text-[#7eb0ff]">
                  {formatStudentId(row.studentId, "listCard")}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge
                  className={
                    row.status === "Claimed"
                      ? "h-6 gap-1.5 rounded-full px-2.5 text-[11px] font-semibold border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50"
                      : "h-6 gap-1.5 rounded-full px-2.5 text-[11px] font-semibold border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50"
                  }
                  variant="outline"
                >
                  Overall: {row.status || "Claimed"}
                </Badge>
                {row.enrolledProgram ? (
                  <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-[11px] font-medium">
                    {row.enrolledProgram}
                  </Badge>
                ) : null}
                {row.yearLevel ? (
                  <Badge
                    variant="outline"
                    className="h-6 rounded-full px-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-200"
                  >
                    {row.yearLevel}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Profile & batch details
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {detailItems.map(({ label, value, mono }) => (
            <div
              key={label}
              className="group flex gap-3 rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] transition-colors hover:border-[#081F5C]/20 hover:bg-white dark:border-white/10 dark:bg-slate-950/40 dark:hover:border-[#081F5C]/35"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p
                  className={
                    mono
                      ? "break-all font-mono text-[13px] text-slate-900 dark:text-slate-50"
                      : "text-sm font-medium leading-snug text-foreground"
                  }
                >
                  {value || "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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

function claimTrendForRange(rows, range, referenceDate = new Date()) {
  const monthIdx = referenceDate.getMonth()
  const monthly = buildMonthlyClaimTrend(rows)
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

export default function ArchiveBatch() {
  const { formatStudentId, privacy } = useOsgfaPrivacySettings()
  const hideSensitiveStats = privacy.hideSensitiveStatsFromSharedScreens
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [trendRange, setTrendRange] = useState(TREND_RANGE.THIS_YEAR)
  const [searchTerm, setSearchTerm] = useState("")
  const [programFilter, setProgramFilter] = useState("__")
  const [yearFilter, setYearFilter] = useState("__")
  const [exportOpen, setExportOpen] = useState(false)
  const [pendingExportFormat, setPendingExportFormat] = useState("")
  const [page, setPage] = useState(1)
  const [recordDialogOpen, setRecordDialogOpen] = useState(false)
  const [activeSeqNo, setActiveSeqNo] = useState("")
  const batchNo = String(params.get("batchNo") ?? "").trim()
  const program = String(params.get("program") ?? "").trim().toUpperCase()
  const academicYear = String(params.get("academicYear") ?? "").trim()
  const hasBatchParams = Boolean(batchNo && program && academicYear)

  const {
    data: archivedDetail,
    isLoading,
    error: archiveDetailError,
  } = useArchivedBatchDetailQuery(
    { batchNo, program, academicYear },
    { enabled: hasBatchParams },
  )

  const granteeRows = useMemo(() => {
    if (!hasBatchParams) return []
    const rows = Array.isArray(archivedDetail?.grantees)
      ? archivedDetail.grantees.map(mapGranteeFromApi).filter(Boolean)
      : []
    return rows
  }, [archivedDetail, hasBatchParams])

  const fetchError = !hasBatchParams
    ? "Missing batch parameters. Open this page from the archive list."
    : archiveDetailError?.message || null

  const { contentRevealed, skeletonLeaving } = useContentReveal(isLoading)

  const displayedRows = useMemo(() => granteeRows, [granteeRows])

  const claimTrend = useMemo(() => claimTrendForRange(displayedRows, trendRange), [displayedRows, trendRange])
  const yearLevelDonut = useMemo(() => buildYearLevelDonut(displayedRows), [displayedRows])
  const yearLevelTotal = useMemo(() => yearLevelDonut.reduce((s, d) => s + d.value, 0), [yearLevelDonut])
  const donutChartConfig = useMemo(
    () => Object.fromEntries(yearLevelDonut.map((d) => [d.name, { label: d.name, color: d.color }])),
    [yearLevelDonut],
  )

  const uniquePrograms = useMemo(
    () => [...new Set(displayedRows.map((row) => String(row.enrolledProgram ?? "").trim()).filter(Boolean))].sort(),
    [displayedRows],
  )
  const uniqueYearLevels = useMemo(
    () => [...new Set(displayedRows.map((row) => String(row.yearLevel ?? "").trim()).filter(Boolean))].sort(),
    [displayedRows],
  )

  const tableRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return displayedRows.filter((row) => {
      if (programFilter !== "__" && programFilter !== "" && String(row.enrolledProgram ?? "") !== programFilter) return false
      if (yearFilter !== "__" && yearFilter !== "" && String(row.yearLevel ?? "") !== yearFilter) return false
      if (!q) return true
      return (
        String(row.seqNo ?? "").toLowerCase().includes(q) ||
        String(row.studentId ?? "").toLowerCase().includes(q) ||
        String(row.awardNumber ?? "").toLowerCase().includes(q) ||
        String(row.fullName ?? "").toLowerCase().includes(q) ||
        String(row.batchNo ?? "").toLowerCase().includes(q) ||
        String(row.enrolledProgram ?? "").toLowerCase().includes(q) ||
        String(row.yearLevel ?? "").toLowerCase().includes(q)
      )
    })
  }, [displayedRows, searchTerm, programFilter, yearFilter])

  const PAGE_SIZE = 100
  const pageCount = useMemo(() => Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE)), [tableRows.length])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, programFilter, yearFilter, displayedRows])

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), pageCount))
  }, [pageCount])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return tableRows.slice(start, start + PAGE_SIZE)
  }, [page, tableRows])

  const batchTitle = batchNo ? `Batch ${batchNo}` : "Archive batch details"
  const batchSubtitle = [
    "Status: Fully claimed",
    program ? `Program: ${program}` : "Program: —",
    academicYear ? `Academic year: ${academicYear}` : "Academic year: —",
  ].join(" · ")

  const exportRows = useMemo(
    () =>
      tableRows.map((row) => ({
        "Batch no.": row.batchNo || "—",
        "Seq no.": row.seqNo || "—",
        "Student ID": row.studentId || "—",
        "Award number": row.awardNumber || "—",
        Fullname: row.fullName || "—",
        "Enrolled program": row.enrolledProgram || "—",
        "Year level": row.yearLevel || "—",
      })),
    [tableRows],
  )

  const activeRow = useMemo(
    () => (activeSeqNo ? tableRows.find((row) => row.seqNo === activeSeqNo) ?? null : null),
    [tableRows, activeSeqNo],
  )

  const handleRecordDialogOpenChange = (open) => {
    setRecordDialogOpen(open)
    if (!open) {
      setActiveSeqNo("")
    }
  }

  const openRecordView = (row) => {
    setActiveSeqNo(row.seqNo)
    setRecordDialogOpen(true)
  }

  const handleExport = (format) => {
    if (exportRows.length === 0) return

    if (format === "excel") {
      const headers = Object.keys(exportRows[0])
      const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
      const csv = [headers.join(","), ...exportRows.map((row) => headers.map((key) => escapeCsv(row[key])).join(","))].join("\n")
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${batchNo || "archive-batch"}-records.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setExportOpen(false)
      return
    }

    const htmlRows = exportRows
      .map(
        (row) =>
          `<tr>${Object.values(row)
            .map((cell) => `<td style="border:1px solid #e2e8f0;padding:8px;text-align:left;">${String(cell)}</td>`)
            .join("")}</tr>`,
      )
      .join("")
    const htmlHeader = Object.keys(exportRows[0])
      .map((head) => `<th style="border:1px solid #cbd5e1;padding:8px;text-align:left;background:#f1f5f9;">${head}</th>`)
      .join("")
    const printWindow = window.open("", "_blank", "width=1100,height=800")
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>${batchTitle} Export</title>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 16px;">
          <h2 style="margin: 0 0 6px;">${batchTitle}</h2>
          <p style="margin: 0 0 14px; color: #475569;">${batchSubtitle}</p>
          <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead><tr>${htmlHeader}</tr></thead>
            <tbody>${htmlRows}</tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
    setExportOpen(false)
  }

  const openExportConfirm = (format) => {
    setPendingExportFormat(format)
    setExportOpen(false)
  }

  return (
    <>
      <section className="w-full min-w-0 max-w-full space-y-4">
        {fetchError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-100">
            {fetchError}
          </div>
        ) : null}

        <div className="rounded-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6] p-4 text-white shadow-md shadow-[#04133d]/20">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-white/95 hover:text-white"
              aria-label="Back"
            >
              <span className="text-lg leading-none">‹</span>
              <span>Back</span>
            </button>
            <div className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-white/90 bg-white text-[#081F5C]">
                <Layers className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold">{batchTitle}</h1>
                <p className="text-xs text-sky-100/90">{batchSubtitle}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <div className="relative min-h-[320px]">
            {(isLoading || skeletonLeaving) && (
              <div
                className={cn(
                  "grid grid-cols-1 gap-3 lg:grid-cols-3 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                  !isLoading && "pointer-events-none absolute inset-0 z-0 opacity-0",
                )}
                aria-busy={isLoading}
                aria-hidden={!isLoading}
              >
                <ChartAreaSkeleton className="lg:col-span-2" />
                <ChartDonutSkeleton />
              </div>
            )}
            {!isLoading && (
          <div
            className={cn(
              "relative z-10 grid grid-cols-1 gap-3 lg:grid-cols-3",
              revealItemClass(contentRevealed, 0),
            )}
            style={revealItemStyle(contentRevealed, 0)}
          >
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Claim completion trend</p>
                  <p className="text-xs text-muted-foreground">All records are fully claimed for archived batches.</p>
                </div>
                <Select value={trendRange} onValueChange={setTrendRange}>
                  <SelectTrigger
                    size="sm"
                    className="h-9 w-full shrink-0 rounded-full border-slate-300/90 bg-white/90 px-3 text-xs font-medium shadow-sm transition hover:border-slate-400 hover:bg-white dark:border-white/15 dark:bg-white/5 sm:w-46"
                    aria-label="Trend period"
                  >
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Range:</span>
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent align="end" className="rounded-xl">
                    <SelectItem value={TREND_RANGE.THIS_WEEK}>This week</SelectItem>
                    <SelectItem value={TREND_RANGE.THIS_MONTH}>This month</SelectItem>
                    <SelectItem value={TREND_RANGE.LAST_MONTH}>Last month</SelectItem>
                    <SelectItem value={TREND_RANGE.THIS_YEAR}>This year</SelectItem>
                    <SelectItem value={TREND_RANGE.LAST_YEAR}>Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl bg-slate-50/90 p-1 dark:bg-white/4">
                {hideSensitiveStats ? (
                  <div className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-slate-500">
                    Claim statistics are hidden while privacy mode is enabled.
                  </div>
                ) : (
                <ChartContainer
                  id="archive-batch-monthly-trend"
                  config={{
                    claimed: { label: "Claimed", color: CLAIM_STROKE },
                    unclaimed: { label: "Unclaimed", color: UNCLAIM_STROKE },
                  }}
                  className="aspect-auto h-[280px] w-full"
                >
                  <AreaChart data={claimTrend} margin={{ top: 1, right: 8, left: 2, bottom: -2 }}>
                    <defs>
                      <linearGradient id="archiveBatchTrendClaimed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CLAIM_STROKE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={CLAIM_STROKE} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="archiveBatchTrendUnclaimed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={UNCLAIM_STROKE} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={UNCLAIM_STROKE} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(148 163 184 / 0.35)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11, fontWeight: 500 }} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} allowDecimals={false} width={34} />
                    <ChartTooltip cursor={{ stroke: "rgb(148 163 184 / 0.55)", strokeWidth: 1 }} content={<ChartTooltipContent />} />
                    <Area
                      type="natural"
                      dataKey="unclaimed"
                      stroke={UNCLAIM_STROKE}
                      strokeWidth={1.2}
                      fill="url(#archiveBatchTrendUnclaimed)"
                      fillOpacity={1}
                      activeDot={{ r: 3.5, strokeWidth: 1.5, stroke: "#fff" }}
                    />
                    <Area
                      type="natural"
                      dataKey="claimed"
                      stroke={CLAIM_STROKE}
                      strokeWidth={2}
                      fill="url(#archiveBatchTrendClaimed)"
                      fillOpacity={1}
                      activeDot={{ r: 4, strokeWidth: 1.5, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ChartContainer>
                )}
              </div>
              {!hideSensitiveStats ? (
              <div className="mt-2 flex flex-wrap items-center justify-start gap-x-6 gap-y-2 text-xs">
                <span className="inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                  <span className="size-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-800" style={{ backgroundColor: CLAIM_STROKE }} />
                  Claimed
                </span>
              </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6">
              <div className="mb-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Year level distribution</p>
                <p className="text-xs text-muted-foreground">Grantee count by year level in this archived batch.</p>
              </div>
              <div className="relative mx-auto min-h-[220px] w-full max-w-[300px]">
                <ChartContainer id="archive-batch-year-donut" config={donutChartConfig} className="aspect-auto h-[220px] w-full">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      {yearLevelDonut.map((entry, i) => (
                        <linearGradient key={entry.name} id={`archiveBatchDonutGrad-${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.65} />
                        </linearGradient>
                      ))}
                    </defs>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={yearLevelDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="92%"
                      paddingAngle={3.5}
                      cornerRadius={7}
                      dataKey="value"
                      nameKey="name"
                      stroke="rgb(255 255 255 / 0.9)"
                      strokeWidth={2}
                    >
                      {yearLevelDonut.map((entry, index) => (
                        <Cell key={entry.name} fill={`url(#archiveBatchDonutGrad-${index})`} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{yearLevelTotal}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {yearLevelDonut.map((row) => (
                  <div key={row.name} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200/70 px-2 py-1.5 dark:border-white/10">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                    <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{row.name}</span>
                    <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
            )}
          </div>

          <div className="mb-2 flex justify-end">
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((prev) => !prev)}
                disabled={exportRows.length === 0}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-linear-to-r from-[#081F5C] to-[#1447a6] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Download className="size-4" />
                Export
                <ChevronDown className="size-4 opacity-90" />
              </button>

              {exportOpen ? (
                <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => openExportConfirm("pdf")}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
                  >
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => openExportConfirm("excel")}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
                  >
                    Export as Excel
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {pendingExportFormat ? (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/45 px-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Confirm export</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Are you sure you want to export the current records as{" "}
                  <span className="font-semibold uppercase text-slate-900 dark:text-white">{pendingExportFormat}</span>?
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This action will download the filtered table data.</p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingExportFormat("")}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleExport(pendingExportFormat)
                      setPendingExportFormat("")
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-linear-to-r from-[#081F5C] to-[#1447a6] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
                  >
                    Confirm export
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mb-3 grid min-w-0 w-full max-w-full gap-3 md:grid-cols-12 md:items-center">
            <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-7 lg:col-span-8">
              <div className="relative min-w-0 w-full">
                <select
                  id="archive-batch-program-filter"
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  className={`${selectShellClass} ${programFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
                >
                  <option value="__" disabled hidden>
                    Program
                  </option>
                  <option value="">All Programs</option>
                  {uniquePrograms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              </div>

              <div className="relative min-w-0 w-full">
                <select
                  id="archive-batch-year-filter"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className={`${selectShellClass} ${yearFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
                >
                  <option value="__" disabled hidden>
                    Year Level
                  </option>
                  <option value="">All Years</option>
                  {uniqueYearLevels.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              </div>
            </div>

            <div className="relative min-w-0 w-full max-w-full md:col-span-5 lg:col-span-4">
              <div className="relative w-full min-w-0 max-w-full">
                <input
                  id="archive-batch-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, student id, award number..."
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

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6">
            <div className="max-h-[min(420px,55vh)] overflow-auto [scrollbar-gutter:stable]">
              <table className="w-full min-w-[980px] text-xs sm:text-sm [&_th]:px-2 [&_th]:py-2.5 [&_td]:px-2 [&_td]:py-2.5 sm:[&_th]:px-3 sm:[&_td]:px-3">
                <thead className="sticky top-0 z-1 bg-slate-100/95 text-slate-700 backdrop-blur-sm dark:bg-slate-900/90 dark:text-slate-200">
                  <tr className="[&>th]:border-b [&>th]:border-slate-200/90 [&>th]:text-left [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide dark:[&>th]:border-white/10">
                    <th className="w-[90px]">Batch no.</th>
                    <th className="w-[80px]">Seq no</th>
                    <th className="w-[110px]">Student ID</th>
                    <th className="w-[260px]">Award number</th>
                    <th className="w-[240px]">Fullname</th>
                    <th className="w-[140px]">Enrolled program</th>
                    <th className="w-[120px]">Year level</th>
                    <th className="w-[76px] text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="[&>tr:nth-child(even)]:bg-slate-50/80 dark:[&>tr:nth-child(even)]:bg-white/3">
                  {(isLoading || skeletonLeaving) &&
                    Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                      <GranteeTableRowSkeleton
                        key={`skeleton-${index}`}
                        yearLevelClassName="w-[120px]"
                        className={cn(
                          "transition-opacity duration-300 ease-out motion-reduce:transition-none",
                          !isLoading && "pointer-events-none opacity-0",
                        )}
                      />
                    ))}
                  {!isLoading &&
                    pagedRows.map((row, index) => (
                    <tr
                      key={String(row.seqNo ?? row.studentId ?? row.awardNumber ?? row.fullName ?? Math.random())}
                      className={cn(
                        "border-t border-slate-200/80 transition-colors hover:bg-slate-100/60 dark:border-white/8 dark:hover:bg-white/5",
                        revealItemClass(contentRevealed, index, 35),
                      )}
                      style={revealItemStyle(contentRevealed, index, 35)}
                    >
                      <td className="w-[90px] whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{row.batchNo || "—"}</td>
                      <td className="w-[80px] whitespace-nowrap font-medium text-pink-600 dark:text-pink-400">{row.seqNo || "—"}</td>
                      <td className="w-[110px] whitespace-nowrap text-blue-600 dark:text-sky-300">
                        {formatStudentId(row.studentId, "listCard")}
                      </td>
                      <td className="w-[260px] max-w-[260px] truncate whitespace-nowrap font-mono text-xs sm:text-sm">{row.awardNumber || "—"}</td>
                      <td className="w-[240px] max-w-[240px] truncate whitespace-nowrap font-medium">{row.fullName || "—"}</td>
                      <td className="w-[140px] max-w-[140px] truncate whitespace-nowrap">{row.enrolledProgram || "—"}</td>
                      <td className="w-[120px] whitespace-nowrap">{row.yearLevel || "—"}</td>
                      <td className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${row.fullName || "record"}`}
                              title="Actions"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-32">
                            <DropdownMenuItem className="gap-2 text-xs" onSelect={() => openRecordView(row)}>
                              <Eye className="size-3.5 opacity-75" />
                              View
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && tableRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className={cn("px-3 py-12 text-center", revealItemClass(contentRevealed, 0))}
                        style={revealItemStyle(contentRevealed, 0)}
                      >
                        <div className="mx-auto max-w-md space-y-2">
                          <p className="text-base font-semibold text-slate-800 dark:text-white">
                            {fetchError ? "Couldn't load records" : "No matching grantees"}
                          </p>
                          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-300">
                            {fetchError
                              ? "Check the batch link or try opening this page again from the archive list."
                              : "Adjust your search or filters to find grantees in this archived batch."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {tableRows.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Showing{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, tableRows.length)}
                </span>{" "}
                of <span className="font-semibold text-slate-900 dark:text-white">{tableRows.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-700 shadow-sm transition disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                >
                  Prev
                </button>
                <span className="tabular-nums text-slate-600 dark:text-slate-300">
                  Page <span className="font-semibold text-slate-900 dark:text-white">{page}</span> / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-700 shadow-sm transition disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </section>

      <Dialog open={recordDialogOpen} onOpenChange={handleRecordDialogOpenChange}>
        <DialogContent className="relative flex h-[min(92vw,34rem,calc(100dvh-3rem))] w-[min(92vw,38rem,calc(100dvh-3rem))] max-w-none flex-col gap-0 overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_24px_48px_-18px_rgba(8,31,92,0.25)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6]"
            aria-hidden
          />
          <DialogHeader className="relative shrink-0 pt-1">
            <DialogTitle>View record</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 pr-1 [scrollbar-gutter:stable]">
            {activeRow ? <ArchiveBatchRecordView row={activeRow} formatStudentId={formatStudentId} /> : null}
          </div>

          <DialogFooter className="mt-4 shrink-0 border-[#081F5C]/10 bg-slate-50/95 dark:border-[#081F5C]/18 dark:bg-slate-900/55 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleRecordDialogOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

