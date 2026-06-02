import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CircleCheck,
  CircleDashed,
  Fingerprint,
  GraduationCap,
  Layers,
  MoreHorizontal,
  Receipt,
  Search,
  SlidersHorizontal,
  User,
} from "lucide-react"

import { loadMergedBeneficiaryRecords, saveBeneficiaryRecords } from "@/lib/beneficiariesStore"
import { fetchGranteesForBatch } from "@/lib/granteesApi"
import { SemesterClaimCell } from "@/components/grantee/semester-claim-display"
import { useLandingPagePrivacy } from "@/lib/landingPageSettings"
import {
  ensureSemesterClaimTimestamps,
  semesterClaimsForRow,
} from "@/lib/granteeSemesterClaims"
import {
  formatRequirementCompletedAt,
  normalizeRequirementChecklistByYearSem,
  requirementYearSemProgress,
} from "@/lib/granteeRequirementsChecklist"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const REDACTED_PLACEHOLDER = "••••"

/** Same shapes as BatchInfo mock + academicYear for URL filtering when no stored records match. */
const MOCK_BATCH_TABLE_ROWS = [
  {
    batchNo: "20.1",
    seqNo: "00001",
    studentId: "23B2149",
    awardNumber: "TES-20241128-1432480000000-006931",
    fullName: "BAÑARES, KEVIN",
    enrolledProgram: "BSN",
    yearLevel: "1st Year",
    status: "Claimed",
    academicYear: "2024-2025",
  },
  {
    batchNo: "20.1",
    seqNo: "00002",
    studentId: "22B2666",
    awardNumber: "TES-20241009-1432480000000-002355",
    fullName: "BARLITA, GELINE LOTO",
    enrolledProgram: "BSSW",
    yearLevel: "3rd Year",
    status: "Unclaimed",
    academicYear: "2024-2025",
  },
  {
    batchNo: "21.1",
    seqNo: "01001",
    studentId: "24C1001",
    awardNumber: "TES-20260501-1432480000000-010001",
    fullName: "DELA CRUZ, MARIA",
    enrolledProgram: "BSIT",
    yearLevel: "2nd Year",
    status: "Claimed",
    academicYear: "2025-2026",
  },
  {
    batchNo: "21.2",
    seqNo: "01002",
    studentId: "24C1002",
    awardNumber: "TDP-20260502-1432480000000-010002",
    fullName: "SANTOS, JOSE",
    enrolledProgram: "BSED",
    yearLevel: "1st Year",
    status: "Unclaimed",
    academicYear: "2025-2026",
  },
  {
    batchNo: "20.2",
    seqNo: "00901",
    studentId: "23C2001",
    awardNumber: "TES-20250502-1432480000000-009001",
    fullName: "REYES, ANA",
    enrolledProgram: "BSBA",
    yearLevel: "4th Year",
    status: "Claimed",
    academicYear: "2024-2025",
  },
  {
    batchNo: "20.3",
    seqNo: "00902",
    studentId: "23C2002",
    awardNumber: "TDP-20250503-1432480000000-009002",
    fullName: "GARCIA, LUIS",
    enrolledProgram: "BSOA",
    yearLevel: "3rd Year",
    status: "Unclaimed",
    academicYear: "2024-2025",
  },
  {
    batchNo: "19.4",
    seqNo: "00801",
    studentId: "22D3001",
    awardNumber: "TES-20240428-1432480000000-008001",
    fullName: "TORRES, MICHAEL",
    enrolledProgram: "BSHM",
    yearLevel: "2nd Year",
    status: "Claimed",
    academicYear: "2023-2024",
  },
]

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"]

const TES_GRANTEE_REQUIREMENTS = [
  { id: "cor", label: "Certificate of Registration (COR) for the current semester" },
  { id: "rog", label: "Official report of grades from the previous semester" },
  { id: "scholarship_disclosure", label: "Disclosure or certificate regarding other scholarships or financial assistance, if required" },
  { id: "id_email", label: "Valid school ID and updated school email on file" },
  { id: "acknowledgment", label: "Signed TES acknowledgment and parent/guardian consent, where applicable" },
]

const TDP_GRANTEE_REQUIREMENTS = [
  { id: "cor", label: "Certificate of Registration (COR) for the current semester" },
  { id: "rog", label: "Official report of grades or class cards from the previous semester" },
  { id: "school_id", label: "Valid school ID (photocopy with registrar or authorized certification)" },
  { id: "indigency", label: "Certificate of indigency or other authorized proof of economic status, if applicable" },
  { id: "undertaking", label: "Signed TDP undertaking or parent/guardian consent form" },
]

function inferProgramFromRecord(row) {
  const direct = String(row?.program ?? "").trim().toUpperCase()
  if (direct === "TES" || direct === "TDP") return direct

  const grantCycle = String(row?.grantCycle ?? "").trim().toUpperCase()
  if (grantCycle.startsWith("TES")) return "TES"
  if (grantCycle.startsWith("TDP")) return "TDP"

  const award = String(row?.awardNumber ?? "").trim().toUpperCase()
  if (award.startsWith("TES-")) return "TES"
  if (award.startsWith("TDP-")) return "TDP"

  return ""
}

function rowKey(row) {
  return (
    String(row?.seqNo ?? "")
      .trim() ||
    String(row?.awardNumber ?? "")
      .trim() ||
    `${String(row?.studentId ?? "").trim()}-${String(row?.fullName ?? "").trim()}`
  )
}

function formatDisplayDate(iso) {
  if (!iso) return "—"
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
}

function studentInitials(fullName) {
  const cleaned = String(fullName ?? "").replace(/\s+/g, " ").trim()
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

function RequirementSemesterCell({ progress }) {
  const completedWhen = progress.isComplete && progress.completedAt ? formatRequirementCompletedAt(progress.completedAt) : ""

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <Badge
        variant="outline"
        className={cn(
          "h-7 w-fit shrink-0 rounded-full px-2.5 text-[11px] font-semibold",
          progress.isComplete
            ? "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50"
            : "border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50",
        )}
      >
        {progress.isComplete ? "Completed" : "Incomplete"}
      </Badge>
      {progress.isComplete && completedWhen ? (
        <span className="text-[11px] text-muted-foreground" title={progress.completedAt}>
          {completedWhen}
        </span>
      ) : null}
      {!progress.isComplete ? (
        <span className="text-[11px] text-muted-foreground">
          {progress.done}/{progress.total} submitted
        </span>
      ) : null}
    </div>
  )
}

function BatchRecordView({ row, landingPrivacy }) {
  const claimed = String(row?.status ?? "") === "Claimed"
  const claims = ensureSemesterClaimTimestamps(semesterClaimsForRow(row, YEAR_LEVELS), row?.lastUpdated)
  const programInferred = inferProgramFromRecord(row)
  const requirementDefs = programInferred === "TDP" ? TDP_GRANTEE_REQUIREMENTS : TES_GRANTEE_REQUIREMENTS
  const granteeKindLabel =
    programInferred === "TDP" ? "TDP grantee" : programInferred === "TES" ? "TES grantee" : "Grantee"
  const displayFullName = landingPrivacy.showFullNameInLandingBatchList ? row.fullName : REDACTED_PLACEHOLDER
  const displayStudentId = landingPrivacy.showStudentIdInLandingBatchList ? row.studentId : REDACTED_PLACEHOLDER
  const displayAwardNumber = landingPrivacy.showAwardNumberInLandingBatchList ? row.awardNumber : REDACTED_PLACEHOLDER
  const displayEnrolledProgram = landingPrivacy.showEnrolledProgramInLandingBatchList
    ? row.enrolledProgram
    : REDACTED_PLACEHOLDER
  const displayYearLevel = landingPrivacy.showYearLevelInLandingBatchList ? row.yearLevel : REDACTED_PLACEHOLDER
  const levelListForNorm = claims.map((c) => c.yearLevel)
  const requirementChecklist = normalizeRequirementChecklistByYearSem(row, requirementDefs, levelListForNorm)
  const requirementTableRows = levelListForNorm.length > 0 ? levelListForNorm : row?.yearLevel ? [row.yearLevel] : []
  const detailItems = [
    { label: "Batch number", value: row.batchNo, icon: Layers },
    { label: "Student ID", value: displayStudentId, icon: User },
    { label: "Sequence no.", value: row.seqNo, icon: Fingerprint },
    { label: "Award number", value: displayAwardNumber, icon: Receipt, mono: true },
    { label: "Enrolled program", value: displayEnrolledProgram, icon: BookOpen },
    { label: "Current year level", value: displayYearLevel, icon: GraduationCap },
    { label: "Academic year", value: row.academicYear ?? "—", icon: CalendarDays },
    { label: "Record last updated", value: formatDisplayDate(row.lastUpdated), icon: CalendarDays },
  ]

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/85 bg-linear-to-br from-white via-slate-50/40 to-[#081F5C]/[0.07] p-4 shadow-sm ring-1 ring-slate-900/4 dark:border-white/10 dark:from-slate-950 dark:via-slate-900/50 dark:to-[#081F5C]/15 dark:ring-white/6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-[#081F5C]/10 blur-3xl dark:bg-[#1447a6]/20" aria-hidden />
        <div className="relative flex min-w-0 items-start gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#04133d] via-[#081F5C] to-[#1447a6] text-base font-bold tracking-tight text-white shadow-md shadow-[#081F5C]/25">
            {studentInitials(row.fullName)}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{granteeKindLabel}</p>
            <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">
              {displayFullName || "—"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-700 dark:text-slate-200">Student ID</span>{" "}
              <span className="font-mono text-[13px] text-[#081F5C] dark:text-[#7eb0ff]">
                {displayStudentId || "—"}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Badge
                className={cn(
                  "h-6 gap-1.5 rounded-full px-2.5 text-[11px] font-semibold",
                  claimed
                    ? "border-emerald-200/80 bg-emerald-50 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50"
                    : "border-amber-200/80 bg-amber-50 text-amber-950 hover:bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50",
                )}
                variant="outline"
              >
                {claimed ? <CircleCheck className="size-3.5 opacity-90" aria-hidden /> : <CircleDashed className="size-3.5 opacity-90" aria-hidden />}
                Overall: {row.status || "—"}
              </Badge>
              <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-[11px] font-medium">
                {displayEnrolledProgram || "Program"}
              </Badge>
              <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {displayYearLevel || "Year level"}
              </Badge>
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
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Requirements</h4>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/85 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-950/35 dark:ring-white/5">
          <div className="max-h-[min(280px,48vh)] overflow-auto [scrollbar-gutter:stable]">
            <table className="w-full min-w-[420px] border-collapse text-sm" aria-label="Requirements by year level and semester">
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
                {requirementTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No year levels on record for requirements.
                    </td>
                  </tr>
                ) : (
                  requirementTableRows.map((yl) => {
                    const isCurrent = yl === row.yearLevel
                    const pFirst = requirementYearSemProgress(requirementChecklist, yl, "first", requirementDefs)
                    const pSecond = requirementYearSemProgress(requirementChecklist, yl, "second", requirementDefs)
                    return (
                      <tr
                        key={yl}
                        className={cn(
                          "border-t border-slate-100 transition-colors first:border-t-0 dark:border-white/8",
                          isCurrent && "bg-[#081F5C]/6 dark:bg-[#081F5C]/15",
                        )}
                      >
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">{yl}</span>
                            {isCurrent ? (
                              <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px] font-semibold text-[#081F5C] dark:text-[#9ec5ff]">
                                Current
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <RequirementSemesterCell progress={pFirst} />
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <RequirementSemesterCell progress={pSecond} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-200/80 dark:bg-white/10" />

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-7 w-1 shrink-0 rounded-full bg-linear-to-b from-[#04133d] via-[#081F5C] to-[#1447a6]" aria-hidden />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Semestral claim status</h4>
            </div>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">
            {claims.length} year level{claims.length === 1 ? "" : "s"} on record
          </p>
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
                {claims.map((c) => {
                  const currentRow = c.yearLevel === row.yearLevel
                  return (
                    <tr
                      key={c.yearLevel}
                      className={cn(
                        "border-t border-slate-100 transition-colors first:border-t-0 dark:border-white/8",
                        currentRow && "bg-[#081F5C]/6 dark:bg-[#081F5C]/15",
                      )}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">{c.yearLevel}</span>
                          {currentRow ? (
                            <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px] font-semibold text-[#081F5C] dark:text-[#9ec5ff]">
                              Current
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <SemesterClaimCell
                          semStatus={c.firstSem}
                          claimerType={c.firstSemClaimer}
                          otherName={c.firstSemOtherName}
                          claimedAt={c.firstSemClaimedAt}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <SemesterClaimCell
                          semStatus={c.secondSem}
                          claimerType={c.secondSemClaimer}
                          otherName={c.secondSemOtherName}
                          claimedAt={c.secondSemClaimedAt}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPageBatch() {
  const [params] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("__")
  const [programFilter, setProgramFilter] = useState("__")
  const [yearFilter, setYearFilter] = useState("__")
  const [page, setPage] = useState(1)
  const [recordDialogOpen, setRecordDialogOpen] = useState(false)
  const [activeRowKey, setActiveRowKey] = useState(null)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [didFetchRecords, setDidFetchRecords] = useState(false)
  const landingPrivacy = useLandingPagePrivacy()

  const batchNo = String(params.get("batchNo") ?? "").trim()
  const program = String(params.get("program") ?? "").trim().toUpperCase()
  const academicYear = String(params.get("academicYear") ?? "").trim()

  useEffect(() => {
    const scroller = document.getElementById("admin-main-scroll")
    if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: "auto" })
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [batchNo, program, academicYear])

  const [records, setRecords] = useState(() => loadMergedBeneficiaryRecords([]))

  useEffect(() => {
    let cancelled = false

    // Only require batchNo + program; academicYear can be optional and will widen results.
    const shouldFetch = Boolean(batchNo && program)
    if (!shouldFetch) {
      return
    }

    setLoadingRecords(true)
    setDidFetchRecords(false)

    const run = async () => {
      try {
        const rows = await fetchGranteesForBatch({ program, batchNo, academicYear })
        if (cancelled) return
        setRecords(rows)
        saveBeneficiaryRecords(rows)
      } catch (error) {
        // Fall back to any previously stored local data.
        console.error("Failed to load landing batch records:", error)
        if (cancelled) return
        setRecords(loadMergedBeneficiaryRecords([]))
      } finally {
        if (!cancelled) setDidFetchRecords(true)
        if (!cancelled) setLoadingRecords(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [batchNo, program, academicYear])

  const filteredStored = useMemo(() => {
    return records.filter((r) => {
      if (batchNo && String(r?.batchNo ?? "").trim() !== batchNo) return false
      if (program) {
        const p = inferProgramFromRecord(r)
        if (p && p !== program) return false
      }
      if (academicYear && String(r?.academicYear ?? "").trim() !== academicYear) return false
      return true
    })
  }, [records, batchNo, program, academicYear])

  const mockForParams = useMemo(() => {
    return MOCK_BATCH_TABLE_ROWS.filter((r) => {
      if (batchNo && String(r?.batchNo ?? "").trim() !== batchNo) return false
      if (program) {
        const p = inferProgramFromRecord(r)
        if (p && p !== program) return false
      }
      if (academicYear && String(r?.academicYear ?? "").trim() !== academicYear) return false
      return true
    })
  }, [batchNo, program, academicYear])

  const displayedRows =
    filteredStored.length > 0 ? filteredStored : loadingRecords ? [] : didFetchRecords ? [] : mockForParams
  const showingMockRows = !loadingRecords && !didFetchRecords && filteredStored.length === 0 && mockForParams.length > 0

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
      if (statusFilter !== "__" && statusFilter !== "" && String(row.status ?? "") !== statusFilter) return false
      if (programFilter !== "__" && programFilter !== "" && String(row.enrolledProgram ?? "") !== programFilter) return false
      if (yearFilter !== "__" && yearFilter !== "" && String(row.yearLevel ?? "") !== yearFilter) return false
      if (!q) return true
      return (
        String(row.seqNo ?? "").toLowerCase().includes(q) ||
        String(row.studentId ?? "").toLowerCase().includes(q) ||
        String(row.awardNumber ?? "").toLowerCase().includes(q) ||
        String(row.fullName ?? "").toLowerCase().includes(q) ||
        String(row.status ?? "").toLowerCase().includes(q) ||
        String(row.enrolledProgram ?? "").toLowerCase().includes(q) ||
        String(row.yearLevel ?? "").toLowerCase().includes(q)
      )
    })
  }, [displayedRows, searchTerm, statusFilter, programFilter, yearFilter])

  const PAGE_SIZE = 100
  const pageCount = useMemo(() => Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE)), [tableRows.length])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter, programFilter, yearFilter, displayedRows])

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), pageCount))
  }, [pageCount])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return tableRows.slice(start, start + PAGE_SIZE)
  }, [page, tableRows])
  const activeRow = useMemo(() => {
    if (!activeRowKey) return null
    return displayedRows.find((row) => rowKey(row) === activeRowKey) ?? null
  }, [activeRowKey, displayedRows])

  const batchTitle = batchNo ? `Batch ${batchNo}` : "Batch details"
  const batchSubtitle = [
    program ? `Program: ${program}` : "Program: —",
    academicYear ? `Academic year: ${academicYear}` : "Academic year: —",
  ].join(" · ")
  const handleRecordDialogOpenChange = (open) => {
    setRecordDialogOpen(open)
    if (!open) setActiveRowKey(null)
  }

  const openRecordView = (row) => {
    setActiveRowKey(rowKey(row))
    setRecordDialogOpen(true)
  }

  const colspan = 8

  return (
    <div className="min-h-screen w-full bg-white">
      <header
        className="sticky top-0 z-40 w-full border-b border-white/10 text-white shadow-md"
        style={{
          backgroundImage: "linear-gradient(135deg, #04133d 0%, #081F5C 35%, #0b2b73 62%, #1447a6 100%)",
        }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
          <Link
            to="/#batch-list"
            className="inline-flex shrink-0 items-center justify-center p-1 text-white transition hover:text-white/80"
            aria-label="Back to batch list section"
          >
            <ArrowLeft className="size-6" aria-hidden />
          </Link>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-white/90 bg-white text-[#081F5C]">
            <Layers className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold sm:text-xl">{batchTitle}</h1>
            <p className="truncate text-xs text-sky-100/90">{batchSubtitle}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="space-y-4">
          <div className="mb-3 grid min-w-0 w-full max-w-full gap-3 md:grid-cols-12 md:items-center">
            <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-3 md:col-span-7 lg:col-span-8">
              <div className="relative min-w-0 w-full">
                <select
                  id="landing-batch-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`${selectShellClass} ${statusFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
                >
                  <option value="__" disabled hidden>
                    Status
                  </option>
                  <option value="">All</option>
                  <option value="Claimed">Claimed</option>
                  <option value="Unclaimed">Unclaimed</option>
                </select>
                <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              </div>

              <div className="relative min-w-0 w-full">
                <select
                  id="landing-batch-program-filter"
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
                  id="landing-batch-year-filter"
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
                  id="landing-batch-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, student id, award number..."
                  className="h-9 w-full min-w-0 rounded-lg border-none ring-0 bg-white/95 pr-12 pl-4 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"
                />
                <span
                  className="pointer-events-none absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-linear-to-r from-[#081F5C] to-[#1447a6] p-0 shadow-sm"
                  aria-hidden
                >
                  <Search className="h-4 w-4 text-white" />
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6">
            <div className="max-h-[min(720px,72vh)] overflow-auto [scrollbar-gutter:stable]">
              <table className="w-full min-w-[900px] text-xs sm:text-sm [&_th]:px-2 [&_th]:py-2.5 [&_td]:px-2 [&_td]:py-2.5 sm:[&_th]:px-3 sm:[&_td]:px-3">
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
                  {loadingRecords ? (
                    <tr>
                      <td colSpan={colspan} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
                        Loading records for this batch…
                      </td>
                    </tr>
                  ) : null}
                  {pagedRows.map((row) => (
                    <tr
                      key={rowKey(row)}
                      className="border-t border-slate-200/80 transition-colors hover:bg-slate-100/60 dark:border-white/8 dark:hover:bg-white/5"
                    >
                      <td className="w-[90px] whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">
                        {row.batchNo || "—"}
                      </td>
                      <td className="w-[80px] whitespace-nowrap font-medium text-pink-600 dark:text-pink-400">{row.seqNo || "—"}</td>
                      <td className="w-[110px] whitespace-nowrap text-blue-600 dark:text-sky-300">
                        {landingPrivacy.showStudentIdInLandingBatchList ? row.studentId || "—" : REDACTED_PLACEHOLDER}
                      </td>
                      <td className="w-[260px] max-w-[260px] truncate whitespace-nowrap font-mono text-xs sm:text-sm">
                        {landingPrivacy.showAwardNumberInLandingBatchList ? row.awardNumber || "—" : REDACTED_PLACEHOLDER}
                      </td>
                      <td className="w-[240px] max-w-[240px] truncate whitespace-nowrap font-medium">
                        {landingPrivacy.showFullNameInLandingBatchList ? row.fullName || "—" : REDACTED_PLACEHOLDER}
                      </td>
                      <td className="w-[140px] max-w-[140px] truncate whitespace-nowrap">
                        {landingPrivacy.showEnrolledProgramInLandingBatchList ? row.enrolledProgram || "—" : REDACTED_PLACEHOLDER}
                      </td>
                      <td className="w-[120px] whitespace-nowrap">
                        {landingPrivacy.showYearLevelInLandingBatchList ? row.yearLevel || "—" : REDACTED_PLACEHOLDER}
                      </td>
                      <td className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${row.fullName || "record"}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-32">
                            <DropdownMenuItem
                              onSelect={() => {
                                openRecordView(row)
                              }}
                            >
                              View
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {showingMockRows && tableRows.length > 0 && page === 1 ? (
                    <tr>
                      <td colSpan={colspan} className="px-3 py-3 text-center text-xs text-amber-700 dark:text-amber-300">
                        Showing sample rows for this batch preview (no stored records matched yet).
                      </td>
                    </tr>
                  ) : null}
                  {!loadingRecords && tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={colspan} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
                        No records found for this batch or your current filters.
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

          <Dialog open={recordDialogOpen} onOpenChange={handleRecordDialogOpenChange}>
            <DialogContent className="relative flex h-[min(92vw,42rem,calc(100dvh-3rem))] w-[min(92vw,42rem,calc(100dvh-3rem))] max-w-none flex-col gap-0 overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6]"
                aria-hidden
              />
              <DialogHeader className="relative shrink-0 pt-1">
                <DialogTitle>View record</DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 pr-1 [scrollbar-gutter:stable]">
                {activeRow ? <BatchRecordView row={activeRow} landingPrivacy={landingPrivacy} /> : null}
              </div>

              {activeRow ? (
                <DialogFooter className="mt-4 shrink-0 border-[#081F5C]/10 bg-slate-50/95 dark:border-[#081F5C]/18 dark:bg-slate-900/55 sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => handleRecordDialogOpenChange(false)}>
                    Close
                  </Button>
                </DialogFooter>
              ) : null}
            </DialogContent>
          </Dialog>
        </section>
      </main>
    </div>
  )
}
