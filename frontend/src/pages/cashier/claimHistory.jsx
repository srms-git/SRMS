import { useMemo, useState } from "react"
import {
  BookOpen,
  CalendarDays,
  CircleCheck,
  Eye,
  Fingerprint,
  GraduationCap,
  History,
  Landmark,
  Layers,
  Mail,
  MoreHorizontal,
  Receipt,
  Search,
  SlidersHorizontal,
  TableProperties,
  User,
} from "lucide-react"

import { SemesterClaimCell } from "@/components/grantee/semester-claim-display"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useClaimHistoryQuery } from "@/hooks/useSrmsQueries"
import { useCashierPrivacySettings } from "@/hooks/useCashierPrivacySettings"
import {
  ClaimHistoryTableRowSkeleton,
  SKELETON_ROW_COUNT,
  SummaryStatCardSkeleton,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"

const PAGE_SIZE = 100

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

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

function formatDisplayDate(iso) {
  if (!iso) return "—"
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
}

function studentInitials(fullName) {
  const cleaned = fullName.replace(/\s+/g, " ").trim()
  if (!cleaned) return "?"
  if (cleaned.includes(",")) {
    const [last, rest] = cleaned.split(",").map((s) => s.trim())
    const first = (rest ?? "").split(/\s+/)[0] ?? ""
    return `${last.charAt(0)}${first.charAt(0)}`.toUpperCase() || "?"
  }
  const bits = cleaned.split(/\s+/).filter(Boolean)
  if (bits.length === 1) return bits[0].slice(0, 2).toUpperCase()
  return `${bits[0].charAt(0)}${bits[bits.length - 1].charAt(0)}`.toUpperCase()
}

function ClaimHistoryDetailView({ entry, formatStudentId }) {
  const granteeKindLabel =
    entry.program === "TDP" ? "TDP grantee" : entry.program === "TES" ? "TES grantee" : "Grantee"
  const isFirstSemClaim = entry.semester === "1st Semester"
  const isSecondSemClaim = entry.semester === "2nd Semester"
  const isCurrentYearLevel = entry.yearLevel === entry.currentYearLevel

  const detailItems = [
    { label: "Batch number", value: entry.batchNo, icon: Layers },
    { label: "Student ID", value: entry.studentId, icon: User },
    { label: "Sequence no.", value: entry.seqNo, icon: Fingerprint },
    { label: "Award number", value: entry.awardNumber, icon: Receipt, mono: true },
    { label: "Enrolled program", value: entry.enrolledProgram, icon: BookOpen },
    { label: "Current year level", value: entry.currentYearLevel ?? entry.yearLevel, icon: GraduationCap },
    { label: "Academic year", value: entry.academicYear ?? "—", icon: CalendarDays },
    { label: "Phone number", value: entry.phoneNumber ?? "—", icon: Receipt },
    { label: "Email address", value: entry.email ?? "—", icon: Mail, subtle: true },
    { label: "Bank account", value: entry.bankAccount ?? "—", icon: Landmark, mono: true },
    { label: "Record last updated", value: formatDisplayDate(entry.lastUpdated), icon: CalendarDays },
  ]

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
              {studentInitials(entry.fullName)}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {granteeKindLabel}
              </p>
              <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">{entry.fullName || "—"}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-700 dark:text-slate-200">Student ID</span>{" "}
                <span className="font-mono text-[13px] text-[#081F5C] dark:text-[#7eb0ff]">
                  {formatStudentId(entry.studentId, "listCard")}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge
                  className="h-6 gap-1.5 rounded-full border-emerald-200/80 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50"
                  variant="outline"
                >
                  <CircleCheck className="size-3.5 opacity-90" aria-hidden />
                  Claimed
                </Badge>
                <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-[11px] font-medium">
                  {entry.enrolledProgram || "Program"}
                </Badge>
                <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                  {entry.currentYearLevel || entry.yearLevel || "Year level"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Profile & grant details</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {detailItems.map(({ label, value, icon: Icon, mono, subtle }) => (
            <div
              key={label}
              className="group flex gap-3 rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] transition-colors hover:border-[#081F5C]/20 hover:bg-white dark:border-white/10 dark:bg-slate-950/40 dark:hover:border-[#081F5C]/35"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
                <Icon className="size-4" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p
                  className={cn(
                    "text-sm font-medium leading-snug text-foreground",
                    mono && "break-all font-mono text-[13px]",
                    subtle &&
                      "overflow-x-auto whitespace-nowrap text-muted-foreground [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                  )}
                >
                  {value || "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-slate-200/80 dark:bg-white/10" />

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-7 w-1 shrink-0 rounded-full bg-linear-to-b from-[#04133d] via-[#081F5C] to-[#1447a6]" aria-hidden />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Claim record</h4>
            </div>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">{formatDisplayDate(entry.claimDate)}</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/85 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-950/35 dark:ring-white/5">
          <div className="max-h-[min(240px,40vh)] overflow-auto [scrollbar-gutter:stable]">
            <table className="w-full min-w-[320px] border-collapse text-sm">
              <thead className="sticky top-0 z-1 bg-slate-100/95 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:bg-slate-900/90 dark:text-slate-300">
                <tr className="[&>th]:border-b [&>th]:border-slate-200/90 [&>th]:px-3 [&>th]:py-2.5 dark:[&>th]:border-white/10">
                  <th scope="col" className="whitespace-nowrap">
                    Year level
                  </th>
                  <th scope="col" className="whitespace-nowrap">
                    1st semester
                  </th>
                  <th scope="col" className="whitespace-nowrap">
                    2nd semester
                  </th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-slate-50/80 dark:[&>tr:nth-child(even)]:bg-white/3">
                <tr
                  className={cn(
                    "border-t border-slate-100 transition-colors first:border-t-0 dark:border-white/8",
                    "bg-[#081F5C]/6 dark:bg-[#081F5C]/15",
                  )}
                >
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{entry.yearLevel}</span>
                      {isCurrentYearLevel ? (
                        <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px] font-semibold text-[#081F5C] dark:text-[#9ec5ff]">
                          Current
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    {isFirstSemClaim ? (
                      <SemesterClaimCell
                        semStatus="Claimed"
                        claimerType={entry.claimedBy}
                        otherName={entry.otherName}
                        claimedAt={entry.claimedAt}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    {isSecondSemClaim ? (
                      <SemesterClaimCell
                        semStatus="Claimed"
                        claimerType={entry.claimedBy}
                        otherName={entry.otherName}
                        claimedAt={entry.claimedAt}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CashierClaimHistory() {
  const { formatStudentId, formatStat } = useCashierPrivacySettings()
  const {
    data: claimEntries = [],
    isLoading,
    error: claimHistoryError,
  } = useClaimHistoryQuery()
  const fetchError = claimHistoryError?.message ?? null
  const [searchTerm, setSearchTerm] = useState("")
  const [batchFilter, setBatchFilter] = useState("__")
  const [programFilter, setProgramFilter] = useState("__")
  const [yearFilter, setYearFilter] = useState("__")
  const [semesterFilter, setSemesterFilter] = useState("__")
  const [claimedByFilter, setClaimedByFilter] = useState("__")
  const [page, setPage] = useState(1)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeEntryId, setActiveEntryId] = useState(null)

  const { contentRevealed, skeletonLeaving } = useContentReveal(isLoading)

  const uniqueBatches = useMemo(
    () => [...new Set(claimEntries.map((e) => e.batchNo).filter(Boolean))].sort(),
    [claimEntries],
  )
  const uniqueYears = useMemo(
    () => [...new Set(claimEntries.map((e) => String(e.academicYear ?? "").trim()).filter(Boolean))].sort(),
    [claimEntries],
  )
  const uniqueClaimedBy = useMemo(
    () => [...new Set(claimEntries.map((e) => e.claimedBy).filter(Boolean))].sort(),
    [claimEntries],
  )

  const summary = useMemo(() => {
    const total = claimEntries.length
    const tes = claimEntries.filter((e) => e.program === "TES").length
    const tdp = claimEntries.filter((e) => e.program === "TDP").length
    const grantees = new Set(claimEntries.map((e) => e.studentId).filter(Boolean)).size
    return { total, tes, tdp, grantees }
  }, [claimEntries])

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const matchesSelect = (filterVal, entryVal) => filterVal === "__" || !filterVal || entryVal === filterVal
    return claimEntries.filter((entry) => {
      if (!matchesSelect(batchFilter, entry.batchNo)) return false
      if (!matchesSelect(programFilter, entry.program)) return false
      if (!matchesSelect(yearFilter, entry.academicYear)) return false
      if (!matchesSelect(semesterFilter, entry.semester)) return false
      if (!matchesSelect(claimedByFilter, entry.claimedBy)) return false
      if (!query) return true
      return (
        String(entry.seqNo ?? "").toLowerCase().includes(query) ||
        String(entry.studentId ?? "").toLowerCase().includes(query) ||
        String(entry.awardNumber ?? "").toLowerCase().includes(query) ||
        String(entry.fullName ?? "").toLowerCase().includes(query) ||
        String(entry.batchNo ?? "").toLowerCase().includes(query) ||
        String(entry.program ?? "").toLowerCase().includes(query) ||
        String(entry.enrolledProgram ?? "").toLowerCase().includes(query) ||
        String(entry.yearLevel ?? "").toLowerCase().includes(query) ||
        String(entry.semester ?? "").toLowerCase().includes(query) ||
        String(entry.claimedBy ?? "").toLowerCase().includes(query) ||
        String(entry.otherName ?? "").toLowerCase().includes(query)
      )
    })
  }, [batchFilter, claimEntries, claimedByFilter, programFilter, searchTerm, semesterFilter, yearFilter])

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE)), [filteredEntries.length])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, batchFilter, programFilter, yearFilter, semesterFilter, claimedByFilter])

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), pageCount))
  }, [pageCount])

  const pagedEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredEntries.slice(start, start + PAGE_SIZE)
  }, [page, filteredEntries])

  const activeEntry = useMemo(
    () => (activeEntryId ? claimEntries.find((e) => e.id === activeEntryId) ?? null : null),
    [activeEntryId, claimEntries],
  )

  const openDetail = (entry) => {
    setActiveEntryId(entry.id)
    setDetailOpen(true)
  }

  const handleDetailOpenChange = (open) => {
    setDetailOpen(open)
    if (!open) setActiveEntryId(null)
  }

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
              label="Total Claims"
              value={formatStat(summary.total, "Total Claims")}
              accentBar="border-l-[3px] border-l-[#081F5C]"
              glow="bg-[#081F5C]/25"
              iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
              Icon={History}
              className={revealItemClass(contentRevealed, 0, 60)}
              style={revealItemStyle(contentRevealed, 0, 60)}
            />
            <SummaryStatCard
              label="TES Claims"
              value={formatStat(summary.tes, "TES Claims")}
              accentBar="border-l-[3px] border-l-emerald-500"
              glow="bg-emerald-400/30"
              iconBg="bg-linear-to-br from-emerald-500 to-teal-600 text-white"
              Icon={CircleCheck}
              className={revealItemClass(contentRevealed, 1, 60)}
              style={revealItemStyle(contentRevealed, 1, 60)}
            />
            <SummaryStatCard
              label="TDP Claims"
              value={formatStat(summary.tdp, "TDP Claims")}
              accentBar="border-l-[3px] border-l-violet-500"
              glow="bg-violet-400/30"
              iconBg="bg-linear-to-br from-violet-500 to-fuchsia-600 text-white"
              Icon={GraduationCap}
              className={revealItemClass(contentRevealed, 2, 60)}
              style={revealItemStyle(contentRevealed, 2, 60)}
            />
            <SummaryStatCard
              label="Grantees"
              value={formatStat(summary.grantees, "Grantees")}
              accentBar="border-l-[3px] border-l-amber-500"
              glow="bg-amber-400/30"
              iconBg="bg-linear-to-br from-amber-500 to-orange-500 text-white"
              Icon={TableProperties}
              className={revealItemClass(contentRevealed, 3, 60)}
              style={revealItemStyle(contentRevealed, 3, 60)}
            />
          </div>
        )}
      </div>

      <div className="mb-4 grid min-w-0 w-full max-w-full gap-3 md:grid-cols-12 md:items-center">
        <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 md:col-span-7 lg:col-span-8">
          <div className="relative min-w-0 w-full">
            <select
              id="claim-batch-filter"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className={`${selectShellClass} ${batchFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="__" disabled hidden>
                Batch
              </option>
              <option value="">All Batches</option>
              {uniqueBatches.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="relative min-w-0 w-full">
            <select
              id="claim-program-filter"
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className={`${selectShellClass} ${programFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="__" disabled hidden>
                Program
              </option>
              <option value="">All Programs</option>
              <option value="TES">TES</option>
              <option value="TDP">TDP</option>
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="relative min-w-0 w-full">
            <select
              id="claim-year-filter"
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
              id="claim-semester-filter"
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className={`${selectShellClass} ${semesterFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="__" disabled hidden>
                Semester
              </option>
              <option value="">All Semesters</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="relative min-w-0 w-full">
            <select
              id="claim-claimed-by-filter"
              value={claimedByFilter}
              onChange={(e) => setClaimedByFilter(e.target.value)}
              className={`${selectShellClass} ${claimedByFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="__" disabled hidden>
                Claimed By
              </option>
              <option value="">All</option>
              {uniqueClaimedBy.map((who) => (
                <option key={who} value={who}>
                  {who}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>
        </div>

        <div className="relative min-w-0 w-full max-w-full md:col-span-5 lg:col-span-4">
          <div className="relative w-full min-w-0 max-w-full">
            <input
              id="claim-history-search"
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

      {fetchError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{fetchError}</p>
      ) : null}

      <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[1180px] text-xs sm:text-sm [&_th]:px-2 [&_th]:py-2.5 [&_td]:px-2 [&_td]:py-2.5 sm:[&_th]:px-3 sm:[&_td]:px-3">
            <thead className="bg-slate-100 text-slate-700">
              <tr className="[&>th]:text-left [&>th]:font-semibold">
                <th className="w-[100px]">DATE</th>
                <th className="w-[70px]">PROGRAM</th>
                <th className="w-[80px]">BATCH</th>
                <th className="w-[100px]">STUDENT ID</th>
                <th className="w-[220px]">FULLNAME</th>
                <th className="w-[240px]">AWARD NUMBER</th>
                <th className="w-[110px]">YEAR LEVEL</th>
                <th className="w-[110px]">SEMESTER</th>
                <th className="w-[120px]">CLAIMED BY</th>
                <th className="w-[76px] text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-slate-50">
              {(isLoading || skeletonLeaving) &&
                Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                  <ClaimHistoryTableRowSkeleton
                    key={`skeleton-${index}`}
                    className={!isLoading ? "opacity-0" : undefined}
                  />
                ))}
              {!isLoading && !fetchError
                ? pagedEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-slate-200/80 transition-colors hover:bg-slate-100/60"
                >
                  <td className="whitespace-nowrap text-slate-700">{formatDisplayDate(entry.claimDate)}</td>
                  <td className="whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                        entry.program === "TDP"
                          ? "border-violet-200 bg-violet-50 text-violet-900"
                          : "border-sky-200 bg-sky-50 text-sky-900",
                      )}
                    >
                      {entry.program}
                    </span>
                  </td>
                  <td className="whitespace-nowrap font-medium text-slate-700">{entry.batchNo}</td>
                  <td className="whitespace-nowrap text-blue-600">{formatStudentId(entry.studentId, "listCard")}</td>
                  <td className="max-w-[220px] truncate whitespace-nowrap font-medium" title={entry.fullName}>
                    {entry.fullName}
                  </td>
                  <td className="max-w-[240px] truncate whitespace-nowrap font-mono text-xs sm:text-sm" title={entry.awardNumber}>
                    {entry.awardNumber}
                  </td>
                  <td className="whitespace-nowrap">{entry.yearLevel}</td>
                  <td className="whitespace-nowrap">{entry.semester}</td>
                  <td className="whitespace-nowrap">
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      {entry.claimedBy === "Other" && entry.otherName ? `Other` : entry.claimedBy}
                    </span>
                  </td>
                  <td className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`View claim for ${entry.fullName}`}
                          title="Actions"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-36">
                        <DropdownMenuItem className="gap-2" onSelect={() => openDetail(entry)}>
                          <Eye className="size-4 opacity-70" />
                          View
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
                ))
                : null}
              {!isLoading && !fetchError && filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-slate-500">
                    No claim history found for your current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {filteredEntries.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-xs">
          <p className="text-slate-600">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredEntries.length)}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{filteredEntries.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-700 shadow-sm transition disabled:opacity-50"
            >
              Prev
            </button>
            <span className="tabular-nums text-slate-600">
              Page <span className="font-semibold text-slate-900">{page}</span> / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-700 shadow-sm transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <Dialog open={detailOpen} onOpenChange={handleDetailOpenChange}>
        <DialogContent className="relative flex h-[min(92vw,42rem,calc(100dvh-3rem))] w-[min(92vw,42rem,calc(100dvh-3rem))] max-w-none flex-col gap-0 overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6]"
            aria-hidden
          />
          <DialogHeader className="relative shrink-0 pt-1">
            <DialogTitle>Claim details</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 pr-1 [scrollbar-gutter:stable]">
            {activeEntry ? <ClaimHistoryDetailView entry={activeEntry} formatStudentId={formatStudentId} /> : null}
          </div>
          <DialogFooter className="mt-4 shrink-0 border-[#081F5C]/10 bg-slate-50/95 dark:border-[#081F5C]/18 dark:bg-slate-900/55 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleDetailOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
