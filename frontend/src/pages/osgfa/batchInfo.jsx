import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  Download,
  Eye,
  Fingerprint,
  GraduationCap,
  Info,
  Landmark,
  Layers,
  Mail,
  MoreHorizontal,
  Pencil,
  Receipt,
  Search,
  SlidersHorizontal,
  User,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  ChartAreaSkeleton,
  ChartDonutSkeleton,
  GranteeTableRowSkeleton,
  SKELETON_ROW_COUNT,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"
import { useOsgfaPrivacySettings } from "@/hooks/useOsgfaPrivacySettings"
import {
  buildMonthlyClaimTrend,
  buildYearLevelDonut,
  fetchGranteeById,
  fetchGranteesForBatch,
  GRANTEE_UPDATED_EVENT,
  inferProgramFromRecord,
  mergeGranteeIntoRecords,
  recordMatchesProgram,
  updateGrantee,
} from "@/lib/granteesApi"
import {
  OtherPersonFields,
  SemesterClaimCell,
  SemesterClaimClaimerSelect,
  SemesterClaimedAtLabel,
  SemesterClaimStatusSelect,
  RequirementSubmittedByFields,
  RequirementSubmittedByInfo,
} from "@/components/grantee/semester-claim-display"
import {
  ensureSemesterClaimTimestamps,
  mapSemesterClaimsWithFieldChange,
  normalizeSemesterClaim,
  semesterClaimsForRow,
  yearLevelIndex as yearLevelIndexForLevels,
} from "@/lib/granteeSemesterClaims"
import {
  ensureRequirementSemCompletionTimestamps,
  formatRequirementCompletedAt,
  normalizeRequirementChecklistByYearSem,
  requirementCoverageStatusForRow,
  requirementSemOtherPerson,
  requirementSemSubmittedBy,
  requirementYearSemProgress,
  REQUIREMENT_SEM_LABEL,
  updateRequirementChecklistCheck,
  updateRequirementSemOtherPersonField,
  updateRequirementSemSubmittedBy,
} from "@/lib/granteeRequirementsChecklist"
import { getRequirementsForProgramCode } from "@/lib/osgfaPrograms"

/** Area chart: claimed = brand navy, unclaimed = red */
const CLAIM_STROKE = "#081F5C"
const UNCLAIM_STROKE = "#dc2626"

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"]

const TREND_RANGE = {
  THIS_WEEK: "this-week",
  THIS_MONTH: "this-month",
  LAST_MONTH: "last-month",
  THIS_YEAR: "this-year",
  LAST_YEAR: "last-year",
}

function yearLevelIndex(yearLevel) {
  return yearLevelIndexForLevels(yearLevel, YEAR_LEVELS)
}

function formatDisplayDate(iso) {
  if (!iso) return "—"
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
}

function computeStatusFromClaims(claims, yearLevel, fallbackStatus = "Unclaimed") {
  const current = claims.find((c) => c.yearLevel === yearLevel)
  if (!current) return fallbackStatus
  return current.firstSem === "Claimed" && current.secondSem === "Claimed" ? "Claimed" : "Unclaimed"
}

const SEMESTER_CLAIM_FIELD_SEM = {
  firstSem: "first",
  firstSemClaimer: "first",
  firstSemOtherName: "first",
  firstSemOtherRelation: "first",
  firstSemOtherContact: "first",
  secondSem: "second",
  secondSemClaimer: "second",
  secondSemOtherName: "second",
  secondSemOtherRelation: "second",
  secondSemOtherContact: "second",
}

function requirementChecklistForDraft(draft, requirementDefs, claimLevels) {
  const levels = claimLevels ?? semesterClaimsForRow(draft, YEAR_LEVELS).map((c) => c.yearLevel)
  const base = normalizeRequirementChecklistByYearSem(draft, requirementDefs, levels)
  return ensureRequirementSemCompletionTimestamps(base, requirementDefs, levels, draft?.lastUpdated)
}

function isSemesterClaimEditBlocked(draft, yearLevel, semKey, requirementDefs) {
  const checklist = requirementChecklistForDraft(draft, requirementDefs)
  return !requirementYearSemProgress(checklist, yearLevel, semKey, requirementDefs).isComplete
}

function semesterClaimBlockedMessage(yearLevel, semKey) {
  const semLabel = REQUIREMENT_SEM_LABEL[semKey] ?? semKey
  return `This student's requirements for ${yearLevel} (${semLabel}) are incomplete. Complete all required documents in the Requirements section before updating this semester's claim status.`
}

function SemesterClaimEditSlot({
  yearLevel,
  semKey,
  progress,
  semStatus,
  claimer,
  otherName,
  otherRelation,
  otherContact,
  claimedAt,
  onStatusChange,
  onClaimerChange,
  onOtherNameChange,
  onOtherRelationChange,
  onOtherContactChange,
}) {
  const blocked = !progress.isComplete

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1.5">
        <SemesterClaimStatusSelect
          value={semStatus}
          onChange={onStatusChange}
          disabled={blocked}
          aria-disabled={blocked}
          title={blocked ? semesterClaimBlockedMessage(yearLevel, semKey) : undefined}
        />
        {blocked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-amber-700 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
                aria-label={`Requirements incomplete for ${yearLevel}, ${REQUIREMENT_SEM_LABEL[semKey]}`}
              >
                <Info className="size-4" strokeWidth={2.25} aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-left leading-snug">
              {semesterClaimBlockedMessage(yearLevel, semKey)}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {semStatus === "Claimed" ? (
        <div className={cn("space-y-2.5", blocked && "pointer-events-none opacity-60")}>
          <SemesterClaimedAtLabel claimedAt={claimedAt} />
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Who claimed?</span>
            <SemesterClaimClaimerSelect
              value={claimer || "Grantee"}
              onChange={onClaimerChange}
              disabled={blocked}
              aria-disabled={blocked}
            />
          </div>
          {claimer === "Other" ? (
            <OtherPersonFields
              name={otherName ?? ""}
              relation={otherRelation ?? ""}
              contact={otherContact ?? ""}
              onNameChange={onOtherNameChange}
              onRelationChange={onOtherRelationChange}
              onContactChange={onOtherContactChange}
              required={!blocked}
            />
          ) : null}
        </div>
      ) : null}
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

function sanitizeReqIdSegment(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
}

function RequirementSemesterCell({ progress, checklist, yearLevel, semKey }) {
  const completedWhen = progress.isComplete && progress.completedAt ? formatRequirementCompletedAt(progress.completedAt) : ""
  const submittedBy = requirementSemSubmittedBy(checklist, yearLevel, semKey)
  const otherPerson = requirementSemOtherPerson(checklist, yearLevel, semKey)

  return (
    <div className="space-y-1">
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
      {progress.done > 0 || submittedBy ? (
        <RequirementSubmittedByInfo
          submittedBy={submittedBy}
          otherName={otherPerson.name}
          otherRelation={otherPerson.relation}
          otherContact={otherPerson.contact}
        />
      ) : null}
    </div>
  )
}

function RequirementSemesterEditCell({
  yearLevel,
  semKey,
  progress,
  checklist,
  definitions,
  mode,
  onRequirementCheckChange,
  onRequirementSubmittedByChange,
}) {
  const semLabel = semKey === "first" ? "1st" : "2nd"
  const submittedBy = requirementSemSubmittedBy(checklist, yearLevel, semKey)
  const otherPerson = requirementSemOtherPerson(checklist, yearLevel, semKey)
  const selectId = `req-submitted-by-${mode}-${sanitizeReqIdSegment(yearLevel)}-${semKey}`

  return (
    <div className="min-w-[200px] space-y-2">
      <RequirementSemesterCell progress={progress} checklist={checklist} yearLevel={yearLevel} semKey={semKey} />
      <ul
        className="list-none space-y-2 border-t border-slate-200/80 pt-2 dark:border-white/10"
        aria-label={`Requirements for ${yearLevel}, ${semLabel} semester`}
      >
        {definitions.map(({ id, label }) => {
          const done = checklist[yearLevel]?.[semKey]?.[id] === true
          const inputId = `req-${mode}-${sanitizeReqIdSegment(yearLevel)}-${semKey}-${id}`
          return (
            <li key={id} className="flex items-start gap-2 text-[11px] leading-snug text-slate-700 dark:text-slate-200">
              <Checkbox
                id={inputId}
                checked={done}
                onCheckedChange={(v) => onRequirementCheckChange(yearLevel, semKey, id, v === true)}
                className="mt-0.5"
                aria-label={`Submitted: ${label}`}
              />
              <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                {label}
              </label>
            </li>
          )
        })}
      </ul>
      <RequirementSubmittedByFields
        selectId={selectId}
        submittedBy={submittedBy}
        otherName={otherPerson.name}
        otherRelation={otherPerson.relation}
        otherContact={otherPerson.contact}
        onSubmittedByChange={(e) => onRequirementSubmittedByChange(yearLevel, semKey, "submittedBy", e.target.value)}
        onOtherNameChange={(e) => onRequirementSubmittedByChange(yearLevel, semKey, "name", e.target.value)}
        onOtherRelationChange={(e) => onRequirementSubmittedByChange(yearLevel, semKey, "relation", e.target.value)}
        onOtherContactChange={(e) => onRequirementSubmittedByChange(yearLevel, semKey, "contact", e.target.value)}
      />
    </div>
  )
}

function GranteeRequirementsBlock({ definitions, dataRow, yearLevels, currentYearLevel, mode, onRequirementCheckChange, onRequirementSubmittedByChange }) {
  const levels = useMemo(() => [...new Set((yearLevels ?? []).map((s) => String(s ?? "").trim()).filter(Boolean))], [yearLevels])

  const levelListForNorm = levels.length > 0 ? levels : currentYearLevel ? [currentYearLevel] : []
  const checklist = useMemo(() => {
    const base = normalizeRequirementChecklistByYearSem(dataRow, definitions, levelListForNorm)
    return ensureRequirementSemCompletionTimestamps(base, definitions, levelListForNorm, dataRow?.lastUpdated)
  }, [dataRow, definitions, levels, currentYearLevel])
  const tableRows = levels.length > 0 ? levels : currentYearLevel ? [currentYearLevel] : []

  if (mode === "view") {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-slate-200/85 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-950/35 dark:ring-white/5">
          <div className="max-h-[min(320px,52vh)] overflow-auto [scrollbar-gutter:stable]">
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
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No year levels on record for requirements.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((yl) => {
                    const isCurrent = yl === currentYearLevel
                    const pFirst = requirementYearSemProgress(checklist, yl, "first", definitions)
                    const pSecond = requirementYearSemProgress(checklist, yl, "second", definitions)
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
                          <RequirementSemesterCell progress={pFirst} checklist={checklist} yearLevel={yl} semKey="first" />
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <RequirementSemesterCell progress={pSecond} checklist={checklist} yearLevel={yl} semKey="second" />
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
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200/85 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-950/35 dark:ring-white/5">
        <div className="max-h-[min(420px,56vh)] overflow-auto [scrollbar-gutter:stable]">
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
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No year levels on record for requirements.
                  </td>
                </tr>
              ) : (
                tableRows.map((yl) => {
                  const isCurrent = yl === currentYearLevel
                  const pFirst = requirementYearSemProgress(checklist, yl, "first", definitions)
                  const pSecond = requirementYearSemProgress(checklist, yl, "second", definitions)
                  return (
                    <tr
                      key={yl}
                      className={cn(
                        "border-t border-slate-100 transition-colors first:border-t-0 dark:border-white/8",
                        isCurrent && "bg-[#081F5C]/6 dark:bg-[#081F5C]/15",
                      )}
                    >
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">{yl}</span>
                          {isCurrent ? (
                            <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px] font-semibold text-[#081F5C] dark:text-[#9ec5ff]">
                              Current
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <RequirementSemesterEditCell
                          yearLevel={yl}
                          semKey="first"
                          progress={pFirst}
                          checklist={checklist}
                          definitions={definitions}
                          mode={mode}
                          onRequirementCheckChange={onRequirementCheckChange}
                          onRequirementSubmittedByChange={onRequirementSubmittedByChange}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <RequirementSemesterEditCell
                          yearLevel={yl}
                          semKey="second"
                          progress={pSecond}
                          checklist={checklist}
                          definitions={definitions}
                          mode={mode}
                          onRequirementCheckChange={onRequirementCheckChange}
                          onRequirementSubmittedByChange={onRequirementSubmittedByChange}
                        />
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
  )
}

function buildBatchEditChangeSummary(originalRow, draftRow, requirementDefs) {
  if (!originalRow || !draftRow) return []

  const changes = []
  const fieldLabels = [
    ["fullName", "Full name"],
    ["studentId", "Student ID"],
    ["batchNo", "Batch number"],
    ["awardNumber", "Award number"],
    ["enrolledProgram", "Enrolled program"],
    ["yearLevel", "Current year level"],
    ["academicYear", "Academic year"],
    ["phoneNumber", "Phone number"],
    ["email", "Email address"],
    ["bankAccount", "Bank account"],
    ["lastUpdated", "Record last updated"],
  ]

  for (const [field, label] of fieldLabels) {
    const before = String(originalRow[field] ?? "").trim()
    const after = String(draftRow[field] ?? "").trim()
    if (before !== after) {
      changes.push(`${label}: ${before || "—"} -> ${after || "—"}`)
    }
  }

  const beforeClaims = semesterClaimsForRow(originalRow, YEAR_LEVELS)
  const afterClaims = semesterClaimsForRow(draftRow, YEAR_LEVELS)
  const claimCount = Math.max(beforeClaims.length, afterClaims.length)

  for (let i = 0; i < claimCount; i++) {
    const before = beforeClaims[i]
    const after = afterClaims[i]
    if (!after) continue
    const year = after.yearLevel ?? before?.yearLevel ?? `Year row ${i + 1}`

    const bFirst = before?.firstSem ?? "Unclaimed"
    const aFirst = after.firstSem ?? "Unclaimed"
    if (bFirst !== aFirst) {
      changes.push(`${year} · 1st semester status: ${bFirst} -> ${aFirst}`)
    }

    const bSecond = before?.secondSem ?? "Unclaimed"
    const aSecond = after.secondSem ?? "Unclaimed"
    if (bSecond !== aSecond) {
      changes.push(`${year} · 2nd semester status: ${bSecond} -> ${aSecond}`)
    }

    const bFirstClaimer = before?.firstSemClaimer ?? ""
    const aFirstClaimer = after.firstSemClaimer ?? ""
    if (bFirstClaimer !== aFirstClaimer) {
      changes.push(`${year} · 1st semester claimed by: ${bFirstClaimer || "—"} -> ${aFirstClaimer || "—"}`)
    }

    const bSecondClaimer = before?.secondSemClaimer ?? ""
    const aSecondClaimer = after.secondSemClaimer ?? ""
    if (bSecondClaimer !== aSecondClaimer) {
      changes.push(`${year} · 2nd semester claimed by: ${bSecondClaimer || "—"} -> ${aSecondClaimer || "—"}`)
    }

    const bFirstOther = String(before?.firstSemOtherName ?? "").trim()
    const aFirstOther = String(after.firstSemOtherName ?? "").trim()
    if (bFirstOther !== aFirstOther) {
      changes.push(`${year} · 1st semester other claimer name: ${bFirstOther || "—"} -> ${aFirstOther || "—"}`)
    }

    const bFirstOtherRelation = String(before?.firstSemOtherRelation ?? "").trim()
    const aFirstOtherRelation = String(after.firstSemOtherRelation ?? "").trim()
    if (bFirstOtherRelation !== aFirstOtherRelation) {
      changes.push(`${year} · 1st semester other claimer relation: ${bFirstOtherRelation || "—"} -> ${aFirstOtherRelation || "—"}`)
    }

    const bFirstOtherContact = String(before?.firstSemOtherContact ?? "").trim()
    const aFirstOtherContact = String(after.firstSemOtherContact ?? "").trim()
    if (bFirstOtherContact !== aFirstOtherContact) {
      changes.push(`${year} · 1st semester other claimer contact: ${bFirstOtherContact || "—"} -> ${aFirstOtherContact || "—"}`)
    }

    const bSecondOther = String(before?.secondSemOtherName ?? "").trim()
    const aSecondOther = String(after.secondSemOtherName ?? "").trim()
    if (bSecondOther !== aSecondOther) {
      changes.push(`${year} · 2nd semester other claimer name: ${bSecondOther || "—"} -> ${aSecondOther || "—"}`)
    }

    const bSecondOtherRelation = String(before?.secondSemOtherRelation ?? "").trim()
    const aSecondOtherRelation = String(after.secondSemOtherRelation ?? "").trim()
    if (bSecondOtherRelation !== aSecondOtherRelation) {
      changes.push(`${year} · 2nd semester other claimer relation: ${bSecondOtherRelation || "—"} -> ${aSecondOtherRelation || "—"}`)
    }

    const bSecondOtherContact = String(before?.secondSemOtherContact ?? "").trim()
    const aSecondOtherContact = String(after.secondSemOtherContact ?? "").trim()
    if (bSecondOtherContact !== aSecondOtherContact) {
      changes.push(`${year} · 2nd semester other claimer contact: ${bSecondOtherContact || "—"} -> ${aSecondOtherContact || "—"}`)
    }
  }

  const levelsUnion = [
    ...new Set([
      ...semesterClaimsForRow(originalRow, YEAR_LEVELS).map((c) => c.yearLevel),
      ...semesterClaimsForRow(draftRow, YEAR_LEVELS).map((c) => c.yearLevel),
    ]),
  ]
  const beforeReq = normalizeRequirementChecklistByYearSem(originalRow, requirementDefs, levelsUnion)
  const afterReq = normalizeRequirementChecklistByYearSem(draftRow, requirementDefs, levelsUnion)
  for (const yl of levelsUnion) {
    for (const sem of ["first", "second"]) {
      const semLabel = REQUIREMENT_SEM_LABEL[sem]
      for (const d of requirementDefs) {
        const bi = beforeReq[yl]?.[sem]?.[d.id] === true
        const ai = afterReq[yl]?.[sem]?.[d.id] === true
        if (bi !== ai) {
          changes.push(
            `Requirements (${yl}, ${semLabel}) · ${d.label}: ${bi ? "Submitted" : "Not submitted"} -> ${ai ? "Submitted" : "Not submitted"}`,
          )
        }
      }

      const bSubmittedBy = requirementSemSubmittedBy(beforeReq, yl, sem) || "Grantee"
      const aSubmittedBy = requirementSemSubmittedBy(afterReq, yl, sem) || "Grantee"
      if (bSubmittedBy !== aSubmittedBy) {
        changes.push(`${yl} · ${semLabel} requirements submitted by: ${bSubmittedBy} -> ${aSubmittedBy}`)
      }

      const bOther = requirementSemOtherPerson(beforeReq, yl, sem)
      const aOther = requirementSemOtherPerson(afterReq, yl, sem)
      if (bOther.name !== aOther.name) {
        changes.push(`${yl} · ${semLabel} requirements other submitter name: ${bOther.name || "—"} -> ${aOther.name || "—"}`)
      }
      if (bOther.relation !== aOther.relation) {
        changes.push(`${yl} · ${semLabel} requirements other submitter relation: ${bOther.relation || "—"} -> ${aOther.relation || "—"}`)
      }
      if (bOther.contact !== aOther.contact) {
        changes.push(`${yl} · ${semLabel} requirements other submitter contact: ${bOther.contact || "—"} -> ${aOther.contact || "—"}`)
      }
    }
  }

  return changes
}

function BatchRecordView({ row, formatStudentId }) {
  const overallClaimed = row.status === "Claimed"
  const claims = ensureSemesterClaimTimestamps(semesterClaimsForRow(row, YEAR_LEVELS), row?.lastUpdated)
  const programInferred = inferProgramFromRecord(row)
  const requirementDefs = getRequirementsForProgramCode(programInferred)
  const granteeKindLabel =
    programInferred === "TDP" ? "TDP grantee" : programInferred === "TES" ? "TES grantee" : "Grantee"
  const detailItems = [
    { label: "Batch number", value: row.batchNo, icon: Layers },
    { label: "Student ID", value: row.studentId, icon: User },
    { label: "Sequence no.", value: row.seqNo, icon: Fingerprint },
    { label: "Award number", value: row.awardNumber, icon: Receipt, mono: true },
    { label: "Enrolled program", value: row.enrolledProgram, icon: BookOpen },
    { label: "Current year level", value: row.yearLevel, icon: GraduationCap },
    { label: "Academic year", value: row.academicYear ?? "—", icon: CalendarDays },
    { label: "Phone number", value: row.phoneNumber ?? "—", icon: Receipt },
    { label: "Email address", value: row.email ?? "—", icon: Mail, subtle: true },
    { label: "Bank account", value: row.bankAccount ?? "—", icon: Landmark, mono: true },
    { label: "Record last updated", value: formatDisplayDate(row.lastUpdated), icon: CalendarDays },
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
              {studentInitials(row.fullName)}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{granteeKindLabel}</p>
              <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">{row.fullName || "—"}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-700 dark:text-slate-200">Student ID</span>{" "}
                <span className="font-mono text-[13px] text-[#081F5C] dark:text-[#7eb0ff]">
                  {formatStudentId(row.studentId, "listCard")}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge
                  className={cn(
                    "h-6 gap-1.5 rounded-full px-2.5 text-[11px] font-semibold",
                    overallClaimed
                      ? "border-emerald-200/80 bg-emerald-50 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50"
                      : "border-amber-200/80 bg-amber-50 text-amber-950 hover:bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50",
                  )}
                  variant="outline"
                >
                  {overallClaimed ? (
                    <CircleCheck className="size-3.5 opacity-90" aria-hidden />
                  ) : (
                    <CircleDashed className="size-3.5 opacity-90" aria-hidden />
                  )}
                  Overall: {row.status || "—"}
                </Badge>
                <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-[11px] font-medium">
                  {row.enrolledProgram || "Program"}
                </Badge>
                <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                  {row.yearLevel || "Year level"}
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
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Requirements</h4>
            </div>
          </div>
        </div>

        <GranteeRequirementsBlock
          mode="view"
          definitions={requirementDefs}
          dataRow={row}
          yearLevels={claims.map((c) => c.yearLevel)}
          currentYearLevel={row.yearLevel}
        />
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
          <div className="max-h-[min(300px,46vh)] overflow-auto [scrollbar-gutter:stable]">
            <table className="w-full min-w-[440px] border-collapse text-sm">
              <thead className="sticky top-0 z-1 bg-slate-100/95 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:bg-slate-900/90 dark:text-slate-300">
                <tr className="[&>th]:border-b [&>th]:border-slate-200/90 [&>th]:px-3 [&>th]:py-2.5 dark:[&>th]:border-white/10">
                  <th scope="col" className="w-[108px] whitespace-nowrap">
                    Year level
                  </th>
                  <th scope="col" className="min-w-[200px] whitespace-nowrap">
                    1st semester
                  </th>
                  <th scope="col" className="min-w-[200px] whitespace-nowrap">
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
                      <td className="px-3 py-2.5 align-top">
                        <SemesterClaimCell
                          semStatus={c.firstSem}
                          claimerType={c.firstSemClaimer}
                          otherName={c.firstSemOtherName}
                          otherRelation={c.firstSemOtherRelation}
                          otherContact={c.firstSemOtherContact}
                          claimedAt={c.firstSemClaimedAt}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <SemesterClaimCell
                          semStatus={c.secondSem}
                          claimerType={c.secondSemClaimer}
                          otherName={c.secondSemOtherName}
                          otherRelation={c.secondSemOtherRelation}
                          otherContact={c.secondSemOtherContact}
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

function BatchRecordEdit({ draft, onChange, onSemesterChange, onRequirementCheckChange, onRequirementSubmittedByChange, onSubmit }) {
  const overallClaimed = draft.status === "Claimed"
  const programInferred = inferProgramFromRecord(draft)
  const requirementDefs = getRequirementsForProgramCode(programInferred)
  const granteeKindLabel =
    programInferred === "TDP" ? "TDP grantee" : programInferred === "TES" ? "TES grantee" : "Grantee"
  const claims = ensureSemesterClaimTimestamps(semesterClaimsForRow(draft, YEAR_LEVELS), draft?.lastUpdated)
  const claimsCountLabel = claims.length === 1 ? "1 year level" : `${claims.length} year levels`
  const claimLevelsKey = claims.map((c) => c.yearLevel).join("|")
  const requirementChecklist = useMemo(
    () => requirementChecklistForDraft(draft, requirementDefs, claims.map((c) => c.yearLevel)),
    [draft, requirementDefs, claimLevelsKey],
  )
  const fieldItems = [
    { id: "edit-batch", label: "Batch number", value: draft.batchNo ?? "", icon: Layers, keyName: "batchNo" },
    { id: "edit-student", label: "Student ID", value: draft.studentId ?? "", icon: User, keyName: "studentId" },
    { id: "edit-seq", label: "Sequence no.", value: draft.seqNo ?? "", icon: Fingerprint, keyName: "seqNo", readOnly: true },
    { id: "edit-award", label: "Award number", value: draft.awardNumber ?? "", icon: Receipt, keyName: "awardNumber", mono: true },
    { id: "edit-program", label: "Enrolled program", value: draft.enrolledProgram ?? "", icon: BookOpen, keyName: "enrolledProgram" },
    { id: "edit-year-level", label: "Current year level", value: draft.yearLevel ?? "", icon: GraduationCap, keyName: "yearLevel", type: "select-year-level" },
    { id: "edit-academic-year", label: "Academic year", value: draft.academicYear ?? "", icon: CalendarDays, keyName: "academicYear" },
    { id: "edit-phone", label: "Phone number", value: draft.phoneNumber ?? "", icon: Receipt, keyName: "phoneNumber" },
    { id: "edit-email", label: "Email address", value: draft.email ?? "", icon: Mail, keyName: "email", type: "email" },
    { id: "edit-bank-account", label: "Bank account", value: draft.bankAccount ?? "", icon: Landmark, keyName: "bankAccount", mono: true },
    { id: "edit-last-updated", label: "Record last updated", value: draft.lastUpdated ?? "", icon: CalendarDays, keyName: "lastUpdated", type: "date" },
  ]

  return (
    <form id="batch-record-edit-form" className="space-y-5" onSubmit={onSubmit}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/85 bg-linear-to-br from-white via-slate-50/40 to-[#081F5C]/7 p-4 shadow-sm ring-1 ring-slate-900/4 dark:border-white/10 dark:from-slate-950 dark:via-slate-900/50 dark:to-[#081F5C]/15 dark:ring-white/6">
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
              {studentInitials(draft.fullName)}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{granteeKindLabel}</p>
              <Input
                id="edit-name"
                value={draft.fullName ?? ""}
                onChange={(e) => onChange("fullName", e.target.value)}
                className="h-9 border-slate-300/80 bg-white/95 text-sm font-semibold dark:border-white/15 dark:bg-slate-900/55"
                required
              />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Student ID <span className="font-mono text-[13px] text-[#081F5C] dark:text-[#7eb0ff]">{draft.studentId || "—"}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge
                  className={cn(
                    "h-6 gap-1.5 rounded-full px-2.5 text-[11px] font-semibold",
                    overallClaimed
                      ? "border-emerald-200/80 bg-emerald-50 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50"
                      : "border-amber-200/80 bg-amber-50 text-amber-950 hover:bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50",
                  )}
                  variant="outline"
                >
                  {overallClaimed ? (
                    <CircleCheck className="size-3.5 opacity-90" aria-hidden />
                  ) : (
                    <CircleDashed className="size-3.5 opacity-90" aria-hidden />
                  )}
                  Overall: {draft.status || "—"}
                </Badge>
                <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-[11px] font-medium">
                  {draft.enrolledProgram || "Program"}
                </Badge>
                <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                  {draft.yearLevel || "Year level"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Profile & grant details</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {fieldItems.map(({ id, label, value, icon: Icon, keyName, readOnly, mono, type }) => (
            <label
              key={id}
              htmlFor={id}
              className="group flex gap-3 rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] transition-colors hover:border-[#081F5C]/20 hover:bg-white dark:border-white/10 dark:bg-slate-950/40 dark:hover:border-[#081F5C]/35"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
                <Icon className="size-4" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                {type === "select-year-level" ? (
                  <select
                    id={id}
                    value={value}
                    onChange={(e) => onChange(keyName, e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {YEAR_LEVELS.map((yl) => (
                      <option key={yl} value={yl}>
                        {yl}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={id}
                    type={type ?? "text"}
                    value={value}
                    readOnly={readOnly}
                    onChange={(e) => onChange(keyName, e.target.value)}
                    className={cn("h-9", readOnly && "bg-muted/50", mono && "font-mono text-[13px]")}
                    placeholder={keyName === "phoneNumber" ? "e.g. 09XXXXXXXXX" : undefined}
                    required={!readOnly}
                  />
                )}
              </div>
            </label>
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

        <GranteeRequirementsBlock
          mode="edit"
          definitions={requirementDefs}
          dataRow={draft}
          yearLevels={claims.map((c) => c.yearLevel)}
          currentYearLevel={draft.yearLevel}
          onRequirementCheckChange={onRequirementCheckChange}
          onRequirementSubmittedByChange={onRequirementSubmittedByChange}
        />
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
          <p className="text-[11px] font-medium text-muted-foreground">{claimsCountLabel} on record</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/85 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-950/35 dark:ring-white/5">
          <div className="max-h-[min(300px,46vh)] overflow-auto [scrollbar-gutter:stable]">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead className="sticky top-0 z-1 bg-slate-100/95 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:bg-slate-900/90 dark:text-slate-300">
                <tr className="[&>th]:border-b [&>th]:border-slate-200/90 [&>th]:px-3 [&>th]:py-2.5 dark:[&>th]:border-white/10">
                  <th scope="col" className="w-[108px]">
                    Year level
                  </th>
                  <th scope="col" className="min-w-[220px]">
                    1st semester
                  </th>
                  <th scope="col" className="min-w-[220px]">
                    2nd semester
                  </th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-slate-50/80 dark:[&>tr:nth-child(even)]:bg-white/3">
                {claims.map((c, idx) => {
                  const currentRow = c.yearLevel === draft.yearLevel
                  const firstProgress = requirementYearSemProgress(requirementChecklist, c.yearLevel, "first", requirementDefs)
                  const secondProgress = requirementYearSemProgress(requirementChecklist, c.yearLevel, "second", requirementDefs)
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
                      <td className="px-3 py-2.5 align-top">
                        <SemesterClaimEditSlot
                          yearLevel={c.yearLevel}
                          semKey="first"
                          progress={firstProgress}
                          semStatus={c.firstSem}
                          claimer={c.firstSemClaimer}
                          otherName={c.firstSemOtherName}
                          otherRelation={c.firstSemOtherRelation}
                          otherContact={c.firstSemOtherContact}
                          claimedAt={c.firstSemClaimedAt}
                          onStatusChange={(e) => onSemesterChange(idx, "firstSem", e.target.value)}
                          onClaimerChange={(e) => onSemesterChange(idx, "firstSemClaimer", e.target.value)}
                          onOtherNameChange={(e) => onSemesterChange(idx, "firstSemOtherName", e.target.value)}
                          onOtherRelationChange={(e) => onSemesterChange(idx, "firstSemOtherRelation", e.target.value)}
                          onOtherContactChange={(e) => onSemesterChange(idx, "firstSemOtherContact", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <SemesterClaimEditSlot
                          yearLevel={c.yearLevel}
                          semKey="second"
                          progress={secondProgress}
                          semStatus={c.secondSem}
                          claimer={c.secondSemClaimer}
                          otherName={c.secondSemOtherName}
                          otherRelation={c.secondSemOtherRelation}
                          otherContact={c.secondSemOtherContact}
                          claimedAt={c.secondSemClaimedAt}
                          onStatusChange={(e) => onSemesterChange(idx, "secondSem", e.target.value)}
                          onClaimerChange={(e) => onSemesterChange(idx, "secondSemClaimer", e.target.value)}
                          onOtherNameChange={(e) => onSemesterChange(idx, "secondSemOtherName", e.target.value)}
                          onOtherRelationChange={(e) => onSemesterChange(idx, "secondSemOtherRelation", e.target.value)}
                          onOtherContactChange={(e) => onSemesterChange(idx, "secondSemOtherContact", e.target.value)}
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
    </form>
  )
}

export default function BatchInfo() {
  const { formatStudentId, privacy } = useOsgfaPrivacySettings()
  const hideSensitiveStats = privacy.hideSensitiveStatsFromSharedScreens
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [trendRange, setTrendRange] = useState(TREND_RANGE.THIS_YEAR)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("__")
  const [semestralFilter, setSemestralFilter] = useState("__")
  const [requirementsCoverageFilter, setRequirementsCoverageFilter] = useState("__")
  const [exportOpen, setExportOpen] = useState(false)
  const [pendingExportFormat, setPendingExportFormat] = useState("")
  const [page, setPage] = useState(1)
  const [recordDialogOpen, setRecordDialogOpen] = useState(false)
  const [recordDialogMode, setRecordDialogMode] = useState("view")
  const [activeRowKey, setActiveRowKey] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [pendingSaveChanges, setPendingSaveChanges] = useState([])
  const [recordSaveNotice, setRecordSaveNotice] = useState("")

  const batchNo = String(params.get("batchNo") ?? "").trim()
  const program = String(params.get("program") ?? "").trim().toUpperCase()
  const academicYear = String(params.get("academicYear") ?? "").trim()

  useEffect(() => {
    // Ensure navigation lands at top (AdminLayout uses its own scroll container).
    const scroller = document.getElementById("admin-main-scroll")
    if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: "auto" })
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [batchNo, program, academicYear])

  const [records, setRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadRecords = async () => {
    if (!program) {
      setRecords([])
      setFetchError("Missing program in the URL. Open this page from Batches (TES or TDP).")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setFetchError(null)
      const rows = await fetchGranteesForBatch({ program, batchNo, academicYear })
      setRecords(rows)
    } catch (err) {
      console.error("Failed to load batch grantees:", err)
      setFetchError(err?.message ?? "Failed to load grantee records.")
      setRecords([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setSearchTerm("")
    setStatusFilter("__")
    setSemestralFilter("__")
    setRequirementsCoverageFilter("__")
    setPage(1)
    setActiveRowKey(null)
    setEditDraft(null)
    setRecordDialogOpen(false)
    loadRecords()
  }, [batchNo, program, academicYear])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && program) loadRecords()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [batchNo, program, academicYear])

  const { contentRevealed, skeletonLeaving } = useContentReveal(isLoading)

  const batchGrantees = useMemo(() => records, [records])
  const filtered = batchGrantees

  const claimTrend = useMemo(() => claimTrendForRange(filtered, trendRange), [filtered, trendRange])
  const yearLevelDonut = useMemo(() => buildYearLevelDonut(filtered), [filtered])
  const yearLevelTotal = useMemo(() => yearLevelDonut.reduce((s, d) => s + d.value, 0), [yearLevelDonut])
  const displayedRows = filtered
  const semestralOptions = useMemo(() => {
    const years = [...new Set(displayedRows.map((row) => String(row.academicYear ?? "").trim()).filter(Boolean))].sort()
    return years.flatMap((year) => [
      { value: `1st|${year}`, label: `1st Semester ${year}` },
      { value: `2nd|${year}`, label: `2nd Semester ${year}` },
    ])
  }, [displayedRows])
  const tableRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const matchesSemestralFilter = (row) => {
      if (semestralFilter === "__" || semestralFilter === "") return true
      const [semester, year] = String(semestralFilter).split("|")
      const rowYear = String(row.academicYear ?? "").trim()
      if (!semester || !year) return true
      return rowYear === year
    }
    return displayedRows.filter((row) => {
      if (statusFilter !== "__" && statusFilter !== "" && String(row.status ?? "") !== statusFilter) return false
      if (!matchesSemestralFilter(row)) return false
      if (requirementsCoverageFilter !== "__" && requirementsCoverageFilter !== "") {
        const levels = semesterClaimsForRow(row, YEAR_LEVELS).map((c) => c.yearLevel)
        const rowProgram = program || inferProgramFromRecord(row)
        const defs = getRequirementsForProgramCode(rowProgram)
        const cat = requirementCoverageStatusForRow(row, defs, levels)
        if (requirementsCoverageFilter === "incomplete" && cat !== "incomplete") return false
        if (requirementsCoverageFilter === "complete" && cat !== "complete") return false
      }
      if (!q) return true
      return (
        String(row.seqNo ?? "").toLowerCase().includes(q) ||
        String(row.studentId ?? "").toLowerCase().includes(q) ||
        String(row.awardNumber ?? "").toLowerCase().includes(q) ||
        String(row.fullName ?? "").toLowerCase().includes(q) ||
        String(row.batchNo ?? "").toLowerCase().includes(q) ||
        String(row.status ?? "").toLowerCase().includes(q) ||
        String(row.enrolledProgram ?? "").toLowerCase().includes(q) ||
        String(row.yearLevel ?? "").toLowerCase().includes(q)
      )
    })
  }, [displayedRows, searchTerm, statusFilter, semestralFilter, requirementsCoverageFilter])

  const PAGE_SIZE = 100
  const pageCount = useMemo(() => Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE)), [tableRows.length])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter, semestralFilter, requirementsCoverageFilter, displayedRows])

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), pageCount))
  }, [pageCount])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return tableRows.slice(start, start + PAGE_SIZE)
  }, [page, tableRows])
  const donutChartConfig = useMemo(
    () => Object.fromEntries(yearLevelDonut.map((d) => [d.name, { label: d.name, color: d.color }])),
    [yearLevelDonut],
  )

  const batchTitle = batchNo ? `Batch ${batchNo}` : "Batch details"
  const batchSubtitle = [
    program ? `Program: ${program}` : "Program: —",
    academicYear ? `Academic year: ${academicYear}` : "Academic year: —",
    !isLoading && program ? `${filtered.length} grantee${filtered.length === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

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

  const handleExport = (format) => {
    if (exportRows.length === 0) return

    if (format === "excel") {
      const headers = Object.keys(exportRows[0])
      const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
      const csv = [headers.join(","), ...exportRows.map((row) => headers.map((key) => escapeCsv(row[key])).join(","))].join(
        "\n",
      )
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${batchNo || "batch"}-records.csv`
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

  const rowKey = (row) => {
    const id = String(row?.id ?? "").trim()
    if (id) return id
    return (
      `${String(row?.batchNo ?? "").trim()}|${String(row?.program ?? "").trim()}|` +
      `${String(row?.seqNo ?? "").trim()}|${String(row?.studentId ?? "").trim()}`
    )
  }

  const requirementDefsForBatch = getRequirementsForProgramCode(program)

  const syncGranteeFromServer = useCallback(async (row) => {
    if (!row?.id) return row
    try {
      const fresh = await fetchGranteeById(row.id)
      setRecords((prev) => mergeGranteeIntoRecords(prev, fresh))
      return fresh
    } catch (err) {
      console.error("Failed to refresh grantee from server:", err)
      return row
    }
  }, [])

  const buildEditDraftFromRow = useCallback(
    (row) => {
      const claimsForRow = ensureSemesterClaimTimestamps(
        Array.isArray(row.semesterClaims) && row.semesterClaims.length > 0
          ? row.semesterClaims.map(normalizeSemesterClaim)
          : semesterClaimsForRow(row, YEAR_LEVELS),
        row.lastUpdated,
      )
      const { requirementChecklistBySem: _legacyFlat, ...rowRest } = row
      const rowProgram = program || inferProgramFromRecord(row)
      const claimLevels = claimsForRow.map((c) => c.yearLevel)
      const requirementChecklistByYearSem = ensureRequirementSemCompletionTimestamps(
        normalizeRequirementChecklistByYearSem(row, requirementDefsForBatch, claimLevels),
        requirementDefsForBatch,
        claimLevels,
        row.lastUpdated,
      )
      return {
        ...rowRest,
        program: rowProgram,
        batchNo: batchNo || rowRest.batchNo,
        academicYear: academicYear || rowRest.academicYear,
        semesterClaims: claimsForRow,
        requirementChecklistByYearSem,
      }
    },
    [program, batchNo, academicYear, requirementDefsForBatch],
  )

  const activeRow = useMemo(() => {
    if (!activeRowKey) return null
    return filtered.find((row) => rowKey(row) === activeRowKey) ?? null
  }, [activeRowKey, filtered])

  useEffect(() => {
    const handleGranteeUpdated = (event) => {
      const updated = event.detail
      if (!updated?.id) return
      void syncGranteeFromServer(updated)
    }
    window.addEventListener(GRANTEE_UPDATED_EVENT, handleGranteeUpdated)
    return () => window.removeEventListener(GRANTEE_UPDATED_EVENT, handleGranteeUpdated)
  }, [syncGranteeFromServer])

  useEffect(() => {
    if (!recordSaveNotice) return undefined
    const timer = setTimeout(() => setRecordSaveNotice(""), 4500)
    return () => clearTimeout(timer)
  }, [recordSaveNotice])

  const applyRecordSaveSuccess = useCallback((updated) => {
    setRecords((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
    setSaveConfirmOpen(false)
    setPendingSaveChanges([])
    setRecordDialogMode("view")
    setEditDraft(null)
    const name = String(updated?.fullName ?? "").trim()
    setRecordSaveNotice(
      name ? `Changes saved. ${name}'s record has been updated.` : "Changes saved. The record has been updated.",
    )
  }, [])

  const handleRecordDialogOpenChange = (open) => {
    setRecordDialogOpen(open)
    if (!open) {
      setRecordDialogMode("view")
      setActiveRowKey(null)
      setEditDraft(null)
      setSaveConfirmOpen(false)
      setPendingSaveChanges([])
      setRecordSaveNotice("")
    }
  }

  const openRecordView = (row) => {
    setRecordDialogMode("view")
    setActiveRowKey(rowKey(row))
    setEditDraft(null)
    setRecordSaveNotice("")
    setRecordDialogOpen(true)
    void syncGranteeFromServer(row)
  }

  const openRecordEdit = (row) => {
    if (program && !recordMatchesProgram(row, program)) return
    setRecordDialogMode("edit")
    setActiveRowKey(rowKey(row))
    setEditDraft(buildEditDraftFromRow(row))
    setRecordSaveNotice("")
    setRecordDialogOpen(true)
  }

  const handleEditFieldChange = (field, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev
      if (field === "yearLevel") {
        const targetClaimsLength = yearLevelIndex(value) + 1
        const existingClaims = semesterClaimsForRow(prev, YEAR_LEVELS)
        const nextClaims = []
        for (let i = 0; i < targetClaimsLength; i++) {
          nextClaims.push(existingClaims[i] ?? { yearLevel: YEAR_LEVELS[i], firstSem: "Unclaimed", secondSem: "Unclaimed" })
        }
        const withYear = { ...prev, yearLevel: value, semesterClaims: nextClaims }
        const levels = nextClaims.map((c) => c.yearLevel)
        const requirementChecklistByYearSem = normalizeRequirementChecklistByYearSem(
          withYear,
          requirementDefsForBatch,
          levels,
        )
        return {
          ...withYear,
          requirementChecklistByYearSem,
          status: computeStatusFromClaims(nextClaims, value, withYear.status),
        }
      }
      return { ...prev, [field]: value }
    })
  }

  const handleSemesterClaimChange = (idx, semesterKey, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev
      const baseClaims =
        Array.isArray(prev.semesterClaims) && prev.semesterClaims.length > 0
          ? prev.semesterClaims.map((c) => ({ ...c }))
          : semesterClaimsForRow(prev, YEAR_LEVELS)
      const semKey = SEMESTER_CLAIM_FIELD_SEM[semesterKey]
      if (semKey) {
        const yearLevel = baseClaims[idx]?.yearLevel
        if (yearLevel && isSemesterClaimEditBlocked(prev, yearLevel, semKey, requirementDefsForBatch)) {
          return prev
        }
      }
      const nextClaims = mapSemesterClaimsWithFieldChange(baseClaims, idx, semesterKey, value)
      return { ...prev, semesterClaims: nextClaims, status: computeStatusFromClaims(nextClaims, prev.yearLevel, prev.status) }
    })
  }

  const handleRequirementCheckChange = (yearLevel, semKey, reqId, checked) => {
    setEditDraft((prev) => {
      if (!prev) return prev
      const levels = semesterClaimsForRow(prev, YEAR_LEVELS).map((c) => c.yearLevel)
      const merged = normalizeRequirementChecklistByYearSem(prev, requirementDefsForBatch, levels)
      return {
        ...prev,
        requirementChecklistByYearSem: updateRequirementChecklistCheck(
          merged,
          yearLevel,
          semKey,
          reqId,
          checked,
          requirementDefsForBatch,
        ),
      }
    })
  }

  const handleRequirementSubmittedByChange = (yearLevel, semKey, field, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev
      const levels = semesterClaimsForRow(prev, YEAR_LEVELS).map((c) => c.yearLevel)
      const merged = normalizeRequirementChecklistByYearSem(prev, requirementDefsForBatch, levels)
      const nextChecklist =
        field === "submittedBy"
          ? updateRequirementSemSubmittedBy(merged, yearLevel, semKey, value)
          : updateRequirementSemOtherPersonField(merged, yearLevel, semKey, field, value)
      return {
        ...prev,
        requirementChecklistByYearSem: nextChecklist,
      }
    })
  }

  const requestSaveRecordEdit = () => {
    if (!editDraft || !activeRow) return
    const diffSummary = buildBatchEditChangeSummary(activeRow, editDraft, requirementDefsForBatch)
    setPendingSaveChanges(diffSummary)
    setSaveConfirmOpen(true)
  }

  const saveRecordEdit = async (e) => {
    e?.preventDefault?.()
    if (!editDraft) return
    const hasMissingOtherName = semesterClaimsForRow(editDraft, YEAR_LEVELS).some(
      (c) =>
        (c.firstSem === "Claimed" && c.firstSemClaimer === "Other" && !String(c.firstSemOtherName ?? "").trim()) ||
        (c.secondSem === "Claimed" && c.secondSemClaimer === "Other" && !String(c.secondSemOtherName ?? "").trim()),
    )
    if (hasMissingOtherName) {
      window.alert("Please enter the claimant name for every semester marked as Claimed by Other.")
      return
    }
    const levels = semesterClaimsForRow(editDraft, YEAR_LEVELS).map((c) => c.yearLevel)
    const normalizedReqChecklist = normalizeRequirementChecklistByYearSem(editDraft, requirementDefsForBatch, levels)
    const hasMissingReqOtherName = levels.some((yl) =>
      ["first", "second"].some((semKey) => {
        const submittedBy = requirementSemSubmittedBy(normalizedReqChecklist, yl, semKey)
        const otherName = requirementSemOtherPerson(normalizedReqChecklist, yl, semKey).name
        return submittedBy === "Other" && !otherName
      }),
    )
    if (hasMissingReqOtherName) {
      window.alert("Please enter the submitter name for every semester where requirements are marked as submitted by Other.")
      return
    }
    if (!editDraft.id) {
      window.alert("This record cannot be saved because it has no database id.")
      return
    }
    const savePayload = {
      ...editDraft,
      semesterClaims: ensureSemesterClaimTimestamps(
        editDraft.semesterClaims ?? semesterClaimsForRow(editDraft, YEAR_LEVELS),
        editDraft.lastUpdated,
      ),
      requirementChecklistByYearSem: ensureRequirementSemCompletionTimestamps(
        normalizeRequirementChecklistByYearSem(editDraft, requirementDefsForBatch, levels),
        requirementDefsForBatch,
        levels,
        editDraft.lastUpdated,
      ),
    }
    try {
      setIsSaving(true)
      const updated = await updateGrantee(editDraft.id, savePayload)
      applyRecordSaveSuccess(updated)
    } catch (err) {
      console.error("Failed to save grantee:", err)
      window.alert(err?.message ?? "Failed to save changes to the database.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="-mt-4 md:-mt-6 -mb-4 md:-mb-6 w-full min-w-0 max-w-full pt-2 md:pt-3 pb-2 md:pb-3">
      <div className="space-y-3">
        <div className="rounded-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6] p-4 text-white mb-3 shadow-md shadow-[#04133d]/20">
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

        {fetchError ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
            <p>{fetchError}</p>
            <button
              type="button"
              onClick={loadRecords}
              className="mt-2 text-xs font-semibold underline underline-offset-2"
            >
              Retry loading records
            </button>
          </div>
        ) : null}

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
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Claimed vs unclaimed trend</p>
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
                  id="batch-monthly-trend"
                  config={{
                    claimed: { label: "Claimed", color: CLAIM_STROKE },
                    unclaimed: { label: "Unclaimed", color: UNCLAIM_STROKE },
                  }}
                  className="aspect-auto h-[280px] w-full"
                >
                  <AreaChart data={claimTrend} margin={{ top: 1, right: 8, left: 2, bottom: -2 }}>
                    <defs>
                      <linearGradient id="batchTrendClaimed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CLAIM_STROKE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={CLAIM_STROKE} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="batchTrendUnclaimed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={UNCLAIM_STROKE} stopOpacity={0.32} />
                        <stop offset="100%" stopColor={UNCLAIM_STROKE} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(148 163 184 / 0.35)" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fontSize: 11, fontWeight: 500 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 11 }}
                      allowDecimals={false}
                      width={34}
                    />
                    <ChartTooltip
                      cursor={{ stroke: "rgb(148 163 184 / 0.55)", strokeWidth: 1 }}
                      content={<ChartTooltipContent />}
                    />
                    <Area
                      type="natural"
                      dataKey="unclaimed"
                      stroke={UNCLAIM_STROKE}
                      strokeWidth={1.5}
                      fill="url(#batchTrendUnclaimed)"
                      fillOpacity={1}
                      activeDot={{ r: 4, strokeWidth: 1.5, stroke: "#fff" }}
                    />
                    <Area
                      type="natural"
                      dataKey="claimed"
                      stroke={CLAIM_STROKE}
                      strokeWidth={2}
                      fill="url(#batchTrendClaimed)"
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
                <span className="inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                  <span className="size-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-800" style={{ backgroundColor: UNCLAIM_STROKE }} />
                  Unclaimed
                </span>
              </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6">
              <div className="mb-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Year level distribution</p>
              </div>
              <div className="relative mx-auto min-h-[220px] w-full max-w-[300px]">
                <ChartContainer id="batch-year-donut" config={donutChartConfig} className="aspect-auto h-[220px] w-full">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      {yearLevelDonut.map((entry, i) => (
                        <linearGradient key={entry.name} id={`batchDonutGrad-${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={entry.colorFrom ?? entry.color} stopOpacity={0.98} />
                          <stop offset="100%" stopColor={entry.colorTo ?? entry.color} stopOpacity={0.72} />
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
                        <Cell key={entry.name} fill={`url(#batchDonutGrad-${index})`} />
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
                  <div
                    key={row.name}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200/70 px-2 py-1.5 dark:border-white/10"
                  >
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
            <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-3 md:col-span-7 lg:col-span-8">
              <div className="relative min-w-0 w-full">
                <select
                  id="batch-status-filter"
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
                  id="semestral-filter"
                  value={semestralFilter}
                  onChange={(e) => setSemestralFilter(e.target.value)}
                  className={`${selectShellClass} ${semestralFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
                >
                  <option value="__" disabled hidden>
                    Semestral
                  </option>
                  <option value="">All Semesters</option>
                  {semestralOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              </div>

              <div className="relative min-w-0 w-full">
                <select
                  id="batch-requirements-coverage-filter"
                  value={requirementsCoverageFilter}
                  onChange={(e) => setRequirementsCoverageFilter(e.target.value)}
                  className={`${selectShellClass} ${requirementsCoverageFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
                >
                  <option value="__" disabled hidden>
                    Requirements
                  </option>
                  <option value="">All (requirements)</option>
                  <option value="incomplete">Incomplete requirements</option>
                  <option value="complete">Completed requirements</option>
                </select>
                <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              </div>
            </div>

            <div className="relative min-w-0 w-full max-w-full md:col-span-5 lg:col-span-4">
              <div className="relative w-full min-w-0 max-w-full">
                <input
                  id="batch-search"
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
                      key={row.id || String(row.seqNo ?? row.studentId ?? row.awardNumber ?? row.fullName)}
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
                      <td className="w-[260px] max-w-[260px] truncate whitespace-nowrap font-mono text-xs sm:text-sm">
                        {row.awardNumber || "—"}
                      </td>
                      <td className="w-[240px] max-w-[240px] truncate whitespace-nowrap font-medium">{row.fullName || "—"}</td>
                      <td className="w-[140px] max-w-[140px] truncate whitespace-nowrap">{row.enrolledProgram || "—"}</td>
                      <td className="w-[120px] whitespace-nowrap">{row.yearLevel || "—"}</td>
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
                          <DropdownMenuContent align="end" className="min-w-36">
                            <DropdownMenuItem className="gap-2" onSelect={() => openRecordView(row)}>
                              <Eye className="size-4 opacity-70" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onSelect={() => openRecordEdit(row)}>
                              <Pencil className="size-4 opacity-70" />
                              Edit
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
                            {!program
                              ? "Batch link incomplete"
                              : filtered.length === 0
                                ? `No ${program} grantees in this batch`
                                : "No matching grantees"}
                          </p>
                          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-300">
                            {!program
                              ? "Open this page from Batches and choose a TES or TDP batch."
                              : filtered.length === 0
                                ? `No grantees were found for batch ${batchNo || "—"}${academicYear ? ` (${academicYear})` : ""}.`
                                : "Try a different search term or adjust your filters."}
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

          <Dialog open={recordDialogOpen} onOpenChange={handleRecordDialogOpenChange}>
            <DialogContent className="relative flex h-[min(92vw,42rem,calc(100dvh-3rem))] w-[min(94vw,48rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6]"
                aria-hidden
              />
              <DialogHeader className="relative shrink-0 pt-1">
                <DialogTitle>{recordDialogMode === "edit" ? "Edit record" : "View record"}</DialogTitle>
              </DialogHeader>

              {recordSaveNotice ? (
                <div
                  role="status"
                  className="mt-3 flex shrink-0 items-start gap-2 rounded-lg border border-emerald-200/90 bg-emerald-50 px-3 py-2.5 text-sm leading-snug text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/12 dark:text-emerald-100"
                >
                  <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{recordSaveNotice}</span>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 pr-1 [scrollbar-gutter:stable]">
                {recordDialogMode === "view" && activeRow ? (
                  <BatchRecordView row={activeRow} formatStudentId={formatStudentId} />
                ) : null}
                {recordDialogMode === "edit" && editDraft ? (
                  <BatchRecordEdit
                    draft={editDraft}
                    onChange={handleEditFieldChange}
                    onSemesterChange={handleSemesterClaimChange}
                    onRequirementCheckChange={handleRequirementCheckChange}
                    onRequirementSubmittedByChange={handleRequirementSubmittedByChange}
                    onSubmit={saveRecordEdit}
                  />
                ) : null}
              </div>

              {recordDialogMode === "edit" && editDraft ? (
                <DialogFooter className="mt-4 shrink-0 gap-2 border-[#081F5C]/10 bg-slate-50/95 dark:border-[#081F5C]/18 dark:bg-slate-900/55 sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => handleRecordDialogOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={requestSaveRecordEdit} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save changes"}
                  </Button>
                </DialogFooter>
              ) : null}

              {recordDialogMode === "view" && activeRow ? (
                <DialogFooter className="mt-4 shrink-0 border-[#081F5C]/10 bg-slate-50/95 dark:border-[#081F5C]/18 dark:bg-slate-900/55 sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => handleRecordDialogOpenChange(false)}>
                    Close
                  </Button>
                  <Button type="button" onClick={() => openRecordEdit(activeRow)}>
                    Edit
                  </Button>
                </DialogFooter>
              ) : null}
            </DialogContent>
          </Dialog>

          <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Save Changes</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to save these changes?</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border bg-muted/40 p-3 text-xs">
                {pendingSaveChanges.length > 0 ? (
                  pendingSaveChanges.map((line, idx) => (
                    <p key={`${idx}-${line}`} className="text-foreground/90">
                      {idx + 1}. {line}
                    </p>
                  ))
                ) : (
                  <p className="text-muted-foreground">No field changes detected.</p>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={saveRecordEdit} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Yes, save changes"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </div>
  )
}

