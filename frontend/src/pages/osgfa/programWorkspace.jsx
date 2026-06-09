import { useCallback, useEffect, useMemo, useState } from "react"
import { Navigate, useParams } from "react-router-dom"
import {
  BookOpen,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  CircleCheck,
  CircleDashed,
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
  TableProperties,
  TriangleAlert,
  User,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { Checkbox } from "@/components/ui/checkbox"
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
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
  fetchGranteesByProgram,
  filterGranteesByProgram,
  granteeInactiveRemarks,
  granteeRecordStatusLabel,
  isGranteeRecordActive,
  updateGrantee,
} from "@/lib/granteesApi"
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
import { normalizeEnrolledProgramArchives } from "@/lib/granteeEnrolledProgramHistory"
import { cn } from "@/lib/utils"
import { useOsgfaPrivacySettings } from "@/hooks/useOsgfaPrivacySettings"
import { useOsgfaPrograms } from "@/hooks/useOsgfaPrograms"

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"]

function yearLevelIndex(yearLevel) {
  return yearLevelIndexForLevels(yearLevel, YEAR_LEVELS)
}

function studentInitials(fullName) {
  const cleaned = fullName.replace(/\s+/g, " ").trim()
  if (!cleaned) return "?"
  if (cleaned.includes(",")) {
    const [last, rest] = cleaned.split(",").map((s) => s.trim())
    const first = (rest ?? "").split(/\s+/)[0] ?? ""
    const a = last.charAt(0)
    const b = first.charAt(0)
    return `${a}${b}`.toUpperCase() || "?"
  }
  const bits = cleaned.split(/\s+/).filter(Boolean)
  if (bits.length === 1) return bits[0].slice(0, 2).toUpperCase()
  return `${bits[0].charAt(0)}${bits[bits.length - 1].charAt(0)}`.toUpperCase()
}

function formatDisplayDate(iso) {
  if (!iso) return "—"
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
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

function requirementChecklistForArchive(archive, requirementDefs, claimLevels) {
  const levels = claimLevels ?? (archive?.semesterClaims ?? []).map((c) => c.yearLevel)
  const base = normalizeRequirementChecklistByYearSem(
    { requirementChecklistByYearSem: archive?.requirementChecklistByYearSem },
    requirementDefs,
    levels,
  )
  return ensureRequirementSemCompletionTimestamps(base, requirementDefs, levels, archive?.archivedAt)
}

function isArchiveSemesterClaimEditBlocked(archive, yearLevel, semKey, requirementDefs) {
  const checklist = requirementChecklistForArchive(archive, requirementDefs)
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

function EnrolledProgramArchiveSections({
  archives,
  requirementDefs,
  mode = "view",
  onArchiveRequirementCheckChange,
  onArchiveRequirementSubmittedByChange,
  onArchiveSemesterChange,
}) {
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())

  if (!archives?.length) return null

  const toggleExpanded = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {archives.map((archive, idx) => {
        const sectionKey = `${archive.enrolledProgram}-${archive.archivedAt || idx}`
        const isExpanded = expandedKeys.has(sectionKey)
        const claims = ensureSemesterClaimTimestamps(
          archive.semesterClaims?.length ? archive.semesterClaims : [],
          archive.archivedAt,
        )
        const archiveRow = {
          requirementChecklistByYearSem: archive.requirementChecklistByYearSem,
          yearLevel: archive.yearLevelAtArchive,
          lastUpdated: archive.archivedAt,
        }
        const archiveChecklist = requirementChecklistForArchive(archive, requirementDefs, claims.map((c) => c.yearLevel))

        return (
          <div
            key={sectionKey}
            className="overflow-hidden rounded-xl border border-dashed border-slate-300/90 bg-slate-50/50 dark:border-white/15 dark:bg-slate-900/25"
          >
            <button
              type="button"
              onClick={() => toggleExpanded(sectionKey)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-white/5"
              aria-expanded={isExpanded}
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{archive.enrolledProgram || "Unknown program"}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {archive.yearLevelAtArchive ? <span>Last year level: {archive.yearLevelAtArchive}</span> : null}
                  {archive.yearLevelAtArchive && archive.archivedAt ? <span aria-hidden>·</span> : null}
                  {archive.archivedAt ? <span>Archived {formatDisplayDate(archive.archivedAt)}</span> : null}
                  {!isExpanded ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Tap to view requirements and claim status</span>
                  ) : null}
                </div>
              </div>
              <ChevronDown
                className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")}
                aria-hidden
              />
            </button>

            {isExpanded ? (
              <div className="space-y-4 border-t border-dashed border-slate-300/90 px-3 pb-3 pt-3 dark:border-white/15">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Requirements</p>
                  <GranteeRequirementsBlock
                    mode={mode}
                    definitions={requirementDefs}
                    dataRow={archiveRow}
                    yearLevels={claims.map((c) => c.yearLevel)}
                    currentYearLevel={archive.yearLevelAtArchive}
                    onRequirementCheckChange={
                      mode === "edit" && onArchiveRequirementCheckChange
                        ? (yearLevel, semKey, reqId, checked) =>
                            onArchiveRequirementCheckChange(idx, yearLevel, semKey, reqId, checked)
                        : undefined
                    }
                    onRequirementSubmittedByChange={
                      mode === "edit" && onArchiveRequirementSubmittedByChange
                        ? (yearLevel, semKey, field, value) =>
                            onArchiveRequirementSubmittedByChange(idx, yearLevel, semKey, field, value)
                        : undefined
                    }
                  />
                </div>

                <div className="space-y-2 border-t border-slate-200/80 pt-4 dark:border-white/10">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Semestral claim status</p>
                  <div className="overflow-hidden rounded-xl border border-slate-200/85 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-950/35 dark:ring-white/5">
                    <div className="max-h-[min(260px,40vh)] overflow-auto [scrollbar-gutter:stable]">
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
                          {claims.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-3 py-5 text-center text-xs text-muted-foreground">
                                No semester claims archived for this program.
                              </td>
                            </tr>
                          ) : mode === "edit" && onArchiveSemesterChange ? (
                            claims.map((c, claimIdx) => {
                              const firstProgress = requirementYearSemProgress(archiveChecklist, c.yearLevel, "first", requirementDefs)
                              const secondProgress = requirementYearSemProgress(archiveChecklist, c.yearLevel, "second", requirementDefs)
                              return (
                                <tr key={c.yearLevel} className="border-t border-slate-100 first:border-t-0 dark:border-white/8">
                                  <td className="px-3 py-2.5 align-middle">
                                    <span className="font-semibold text-slate-900 dark:text-white">{c.yearLevel}</span>
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
                                      onStatusChange={(e) => onArchiveSemesterChange(idx, claimIdx, "firstSem", e.target.value)}
                                      onClaimerChange={(e) => onArchiveSemesterChange(idx, claimIdx, "firstSemClaimer", e.target.value)}
                                      onOtherNameChange={(e) => onArchiveSemesterChange(idx, claimIdx, "firstSemOtherName", e.target.value)}
                                      onOtherRelationChange={(e) => onArchiveSemesterChange(idx, claimIdx, "firstSemOtherRelation", e.target.value)}
                                      onOtherContactChange={(e) => onArchiveSemesterChange(idx, claimIdx, "firstSemOtherContact", e.target.value)}
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
                                      onStatusChange={(e) => onArchiveSemesterChange(idx, claimIdx, "secondSem", e.target.value)}
                                      onClaimerChange={(e) => onArchiveSemesterChange(idx, claimIdx, "secondSemClaimer", e.target.value)}
                                      onOtherNameChange={(e) => onArchiveSemesterChange(idx, claimIdx, "secondSemOtherName", e.target.value)}
                                      onOtherRelationChange={(e) => onArchiveSemesterChange(idx, claimIdx, "secondSemOtherRelation", e.target.value)}
                                      onOtherContactChange={(e) => onArchiveSemesterChange(idx, claimIdx, "secondSemOtherContact", e.target.value)}
                                    />
                                  </td>
                                </tr>
                              )
                            })
                          ) : (
                            claims.map((c) => (
                              <tr key={c.yearLevel} className="border-t border-slate-100 first:border-t-0 dark:border-white/8">
                                <td className="px-3 py-2.5 align-middle">
                                  <span className="font-semibold text-slate-900 dark:text-white">{c.yearLevel}</span>
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
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
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
        <div className="max-h-[min(360px,52vh)] overflow-auto [scrollbar-gutter:stable]">
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

function GranteeInactiveStatusIndicator({ row, iconClassName = "size-3.5" }) {
  if (isGranteeRecordActive(row)) return null

  const remarks = granteeInactiveRemarks(row)
  const label = remarks ? `Inactive: ${remarks}` : "Inactive record"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-6 shrink-0 items-center justify-center self-center rounded-md text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-400 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
          aria-label={label}
        >
          <TriangleAlert className={iconClassName} strokeWidth={2.25} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        sideOffset={8}
        className="max-w-[280px] flex-col items-start gap-0 border border-amber-200/90 bg-white px-0 py-0 text-left text-slate-800 shadow-lg dark:border-amber-500/35 dark:bg-slate-900 dark:text-slate-100 [&>svg]:fill-white dark:[&>svg]:fill-slate-900"
      >
        <div className="flex w-full items-start gap-2.5 px-3 py-2.5">
          <span
            className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
            aria-hidden
          >
            <TriangleAlert className="size-3.5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold leading-none text-amber-800 dark:text-amber-200">Inactive record</p>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {remarks || "No remarks on file."}
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function GranteeRecordView({ row, formatStudentId, programCode, requirements }) {
  const claims = ensureSemesterClaimTimestamps(semesterClaimsForRow(row, YEAR_LEVELS), row?.lastUpdated)
  const enrolledProgramArchives = normalizeEnrolledProgramArchives(row)
  const overallClaimed = row.status === "Claimed"
  const recordIsActive = isGranteeRecordActive(row)
  const inactiveRemarks = granteeInactiveRemarks(row)

  const detailItems = [
    {
      label: "Record status",
      value: granteeRecordStatusLabel(row),
      icon: CheckCircle,
    },
    {
      label: "Batch number",
      value: row.batchNo,
      icon: Layers,
    },
    {
      label: "Student ID",
      value: row.studentId,
      icon: User,
    },
    {
      label: "Sequence no.",
      value: row.seqNo,
      icon: Fingerprint,
    },
    {
      label: "Award number",
      value: row.awardNumber,
      icon: Receipt,
      mono: true,
    },
    {
      label: "Enrolled program",
      value: row.enrolledProgram,
      icon: BookOpen,
    },
    {
      label: "Current year level",
      value: row.yearLevel,
      icon: GraduationCap,
    },
    {
      label: "Academic year",
      value: row.academicYear ?? "—",
      icon: CalendarDays,
    },
    {
      label: "Phone number",
      value: row.phoneNumber ?? "—",
      icon: Receipt,
    },
    {
      label: "Email address",
      value: row.email ?? "—",
      icon: Mail,
      subtle: true,
    },
    {
      label: "Bank account",
      value: row.bankAccount ?? "—",
      icon: Landmark,
      mono: true,
    },
    {
      label: "Record last updated",
      value: formatDisplayDate(row.lastUpdated),
      icon: CalendarDays,
    },
  ]

  return (
    <div className="space-y-5">
      {!recordIsActive ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-50"
        >
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-500/35">
            <TriangleAlert className="size-4" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold leading-snug">This grantee record is inactive</p>
            <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/90">
              {inactiveRemarks || "No inactive remarks were recorded for this grantee."}
            </p>
          </div>
        </div>
      ) : null}

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
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {programCode} grantee
              </p>
              <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">{row.fullName}</h3>
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
                  Overall: {row.status}
                </Badge>
                <Badge
                  className={cn(
                    "h-6 gap-1.5 rounded-full px-2.5 text-[11px] font-semibold",
                    recordIsActive
                      ? "border-sky-200/80 bg-sky-50 text-sky-900 hover:bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-50"
                      : "border-amber-200/80 bg-amber-50 text-amber-950 hover:bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50",
                  )}
                  variant="outline"
                >
                  {recordIsActive ? (
                    <CheckCircle className="size-3.5 opacity-90" aria-hidden />
                  ) : (
                    <TriangleAlert className="size-3.5 opacity-90" aria-hidden />
                  )}
                  Record: {granteeRecordStatusLabel(row)}
                </Badge>
                <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-[11px] font-medium">
                  {row.enrolledProgram}
                </Badge>
                <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                  {row.yearLevel}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!recordIsActive && inactiveRemarks ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">
                Inactive remarks
              </p>
              <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-50">{inactiveRemarks}</p>
            </div>
          </div>
        </div>
      ) : null}

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
                  {value}
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
          definitions={requirements}
          dataRow={row}
          yearLevels={claims.map((c) => c.yearLevel)}
          currentYearLevel={row.yearLevel}
        />

        <div className="space-y-3 border-t border-slate-200/80 pt-4 dark:border-white/10">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h5 className="text-sm font-semibold text-slate-900 dark:text-white">Semestral claim status</h5>
              <p className="text-[11px] text-muted-foreground">Current enrolled program: {row.enrolledProgram || "—"}</p>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">{claims.length} year level{claims.length === 1 ? "" : "s"} on record</p>
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
                            otherRelation={c.firstSemOtherRelation}
                            otherContact={c.firstSemOtherContact}
                            claimedAt={c.firstSemClaimedAt}
                          />
                        </td>
                        <td className="px-3 py-2.5 align-middle">
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

      {enrolledProgramArchives.length > 0 ? (
        <>
          <Separator className="bg-slate-200/80 dark:bg-white/10" />
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-7 w-1 shrink-0 rounded-full bg-linear-to-b from-[#04133d] via-[#081F5C] to-[#1447a6]" aria-hidden />
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Previous enrolled program{enrolledProgramArchives.length === 1 ? "" : "s"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Claim and requirement history from before the current program ({row.enrolledProgram || "—"}).
                  </p>
                </div>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                {enrolledProgramArchives.length} archived program{enrolledProgramArchives.length === 1 ? "" : "s"}
              </p>
            </div>
            <EnrolledProgramArchiveSections archives={enrolledProgramArchives} requirementDefs={requirements} />
          </div>
        </>
      ) : null}
    </div>
  )
}

function computeStatusFromClaims(claims, yearLevel, fallbackStatus = "Unclaimed") {
  const current = claims.find((c) => c.yearLevel === yearLevel)
  if (!current) return fallbackStatus
  return current.firstSem === "Claimed" && current.secondSem === "Claimed" ? "Claimed" : "Unclaimed"
}

function buildEditChangeSummary(originalRow, draftRow, requirements) {
  if (!originalRow || !draftRow) return []

  const changes = []
  const fieldLabels = [
    ["enrolledProgram", "Enrolled program"],
    ["yearLevel", "Current year level"],
    ["phoneNumber", "Phone number"],
    ["email", "Email address"],
    ["bankAccount", "Bank account"],
  ]

  for (const [field, label] of fieldLabels) {
    const before = String(originalRow[field] ?? "").trim()
    const after = String(draftRow[field] ?? "").trim()
    if (before !== after) {
      changes.push(`${label}: ${before || "—"} -> ${after || "—"}`)
    }
  }

  const beforeArchives = normalizeEnrolledProgramArchives(originalRow)
  const afterArchives = normalizeEnrolledProgramArchives(draftRow)
  const archiveCount = Math.max(beforeArchives.length, afterArchives.length)
  for (let ai = 0; ai < archiveCount; ai++) {
    const beforeArchive = beforeArchives[ai]
    const afterArchive = afterArchives[ai]
    if (!afterArchive) continue
    const archiveLabel = afterArchive.enrolledProgram || `Archive ${ai + 1}`

    const beforeArchiveClaims = beforeArchive?.semesterClaims ?? []
    const afterArchiveClaims = afterArchive.semesterClaims ?? []
    const archiveClaimCount = Math.max(beforeArchiveClaims.length, afterArchiveClaims.length)
    for (let ci = 0; ci < archiveClaimCount; ci++) {
      const before = beforeArchiveClaims[ci]
      const after = afterArchiveClaims[ci]
      if (!after) continue
      const year = after.yearLevel ?? before?.yearLevel ?? `Year row ${ci + 1}`

      const bFirst = before?.firstSem ?? "Unclaimed"
      const aFirst = after.firstSem ?? "Unclaimed"
      if (bFirst !== aFirst) {
        changes.push(`Archived ${archiveLabel} · ${year} · 1st semester status: ${bFirst} -> ${aFirst}`)
      }

      const bSecond = before?.secondSem ?? "Unclaimed"
      const aSecond = after.secondSem ?? "Unclaimed"
      if (bSecond !== aSecond) {
        changes.push(`Archived ${archiveLabel} · ${year} · 2nd semester status: ${bSecond} -> ${aSecond}`)
      }
    }

    const archiveLevels = [...new Set(afterArchiveClaims.map((c) => c.yearLevel))]
    const beforeArchiveReq = normalizeRequirementChecklistByYearSem(
      { requirementChecklistByYearSem: beforeArchive?.requirementChecklistByYearSem },
      requirements,
      archiveLevels,
    )
    const afterArchiveReq = normalizeRequirementChecklistByYearSem(
      { requirementChecklistByYearSem: afterArchive.requirementChecklistByYearSem },
      requirements,
      archiveLevels,
    )
    for (const yl of archiveLevels) {
      for (const sem of ["first", "second"]) {
        const semLabel = REQUIREMENT_SEM_LABEL[sem]
        for (const d of requirements) {
          const bi = beforeArchiveReq[yl]?.[sem]?.[d.id] === true
          const afterChecked = afterArchiveReq[yl]?.[sem]?.[d.id] === true
          if (bi !== afterChecked) {
            changes.push(
              `Archived ${archiveLabel} · Requirements (${yl}, ${semLabel}) · ${d.label}: ${bi ? "Submitted" : "Not submitted"} -> ${afterChecked ? "Submitted" : "Not submitted"}`,
            )
          }
        }
      }
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
  const beforeReq = normalizeRequirementChecklistByYearSem(originalRow, requirements, levelsUnion)
  const afterReq = normalizeRequirementChecklistByYearSem(draftRow, requirements, levelsUnion)
  for (const yl of levelsUnion) {
    for (const sem of ["first", "second"]) {
      const semLabel = REQUIREMENT_SEM_LABEL[sem]
      for (const d of requirements) {
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

function GranteeRecordEdit({
  draft,
  onChange,
  onSemesterChange,
  onRequirementCheckChange,
  onRequirementSubmittedByChange,
  onArchiveRequirementCheckChange,
  onArchiveRequirementSubmittedByChange,
  onArchiveSemesterChange,
  onSubmit,
  programCode,
  requirements,
}) {
  const claims = ensureSemesterClaimTimestamps(semesterClaimsForRow(draft, YEAR_LEVELS), draft?.lastUpdated)
  const enrolledProgramArchives = normalizeEnrolledProgramArchives(draft)
  const overallClaimed = draft.status === "Claimed"
  const claimsCountLabel = claims.length === 1 ? "1 year level" : `${claims.length} year levels`
  const claimLevelsKey = claims.map((c) => c.yearLevel).join("|")
  const requirementChecklist = useMemo(
    () => requirementChecklistForDraft(draft, requirements, claims.map((c) => c.yearLevel)),
    [draft, requirements, claimLevelsKey],
  )

  const fieldItems = [
    { id: "edit-batch", label: "Batch number", value: draft.batchNo, icon: Layers, keyName: "batchNo", readOnly: true },
    { id: "edit-student", label: "Student ID", value: draft.studentId, icon: User, keyName: "studentId", readOnly: true },
    { id: "edit-seq", label: "Sequence no.", value: draft.seqNo, icon: Fingerprint, keyName: "seqNo", readOnly: true },
    { id: "edit-award", label: "Award number", value: draft.awardNumber, icon: Receipt, keyName: "awardNumber", mono: true, readOnly: true },
    { id: "edit-program", label: "Enrolled program", value: draft.enrolledProgram, icon: BookOpen, keyName: "enrolledProgram" },
    { id: "edit-year-level", label: "Current year level", value: draft.yearLevel, icon: GraduationCap, keyName: "yearLevel", type: "select-year-level" },
    { id: "edit-academic-year", label: "Academic year", value: draft.academicYear ?? "", icon: CalendarDays, keyName: "academicYear", readOnly: true },
    { id: "edit-phone", label: "Phone number", value: draft.phoneNumber ?? "", icon: Receipt, keyName: "phoneNumber" },
    { id: "edit-email", label: "Email address", value: draft.email ?? "", icon: Mail, keyName: "email", type: "email" },
    { id: "edit-bank-account", label: "Bank account", value: draft.bankAccount ?? "", icon: Landmark, keyName: "bankAccount", mono: true },
    {
      id: "edit-last-updated",
      label: "Record last updated",
      value: formatDisplayDate(draft.lastUpdated),
      icon: CalendarDays,
      keyName: "lastUpdated",
      readOnly: true,
      type: "display",
    },
  ]

  return (
    <form id="tes-record-edit-form" className="space-y-5" onSubmit={onSubmit}>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {programCode} grantee
              </p>
              <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">{draft.fullName || "—"}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Student ID <span className="font-mono text-[13px] text-[#081F5C] dark:text-[#7eb0ff]">{draft.studentId}</span>
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
                  {overallClaimed ? <CircleCheck className="size-3.5 opacity-90" aria-hidden /> : <CircleDashed className="size-3.5 opacity-90" aria-hidden />}
                  Overall: {draft.status}
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
            <div
              key={id}
              className={cn(
                "group flex gap-3 rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] transition-colors dark:border-white/10 dark:bg-slate-950/40",
                !readOnly && "hover:border-[#081F5C]/20 hover:bg-white dark:hover:border-[#081F5C]/35",
                readOnly && "bg-muted/30 dark:bg-slate-900/50",
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
                <Icon className="size-4" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                {type === "display" ? (
                  <p className="text-sm font-medium leading-snug text-foreground">{value || "—"}</p>
                ) : type === "select-year-level" ? (
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
                    disabled={readOnly}
                    onChange={(e) => onChange(keyName, e.target.value)}
                    className={cn("h-9", readOnly && "cursor-not-allowed bg-muted/50 opacity-90", mono && "font-mono text-[13px]")}
                    required={!readOnly}
                  />
                )}
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
          mode="edit"
          definitions={requirements}
          dataRow={draft}
          yearLevels={claims.map((c) => c.yearLevel)}
          currentYearLevel={draft.yearLevel}
          onRequirementCheckChange={onRequirementCheckChange}
          onRequirementSubmittedByChange={onRequirementSubmittedByChange}
        />

        <div className="space-y-3 border-t border-slate-200/80 pt-4 dark:border-white/10">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h5 className="text-sm font-semibold text-slate-900 dark:text-white">Semestral claim status</h5>
              <p className="text-[11px] text-muted-foreground">Current enrolled program: {draft.enrolledProgram || "—"}</p>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">{claimsCountLabel} on record</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/85 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-950/35 dark:ring-white/5">
            <div className="max-h-[min(240px,40vh)] overflow-auto [scrollbar-gutter:stable]">
              <table className="w-full min-w-[360px] border-collapse text-sm">
                <thead className="sticky top-0 z-1 bg-slate-100/95 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:bg-slate-900/90 dark:text-slate-300">
                  <tr className="[&>th]:border-b [&>th]:border-slate-200/90 [&>th]:px-3 [&>th]:py-2.5 dark:[&>th]:border-white/10">
                    <th scope="col">Year level</th>
                    <th scope="col">1st semester</th>
                    <th scope="col">2nd semester</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:nth-child(even)]:bg-slate-50/80 dark:[&>tr:nth-child(even)]:bg-white/3">
                  {claims.map((c, idx) => {
                    const currentRow = c.yearLevel === draft.yearLevel
                    const firstProgress = requirementYearSemProgress(requirementChecklist, c.yearLevel, "first", requirements)
                    const secondProgress = requirementYearSemProgress(requirementChecklist, c.yearLevel, "second", requirements)
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
      </div>

      {enrolledProgramArchives.length > 0 ? (
        <>
          <Separator className="bg-slate-200/80 dark:bg-white/10" />
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-7 w-1 shrink-0 rounded-full bg-linear-to-b from-[#04133d] via-[#081F5C] to-[#1447a6]" aria-hidden />
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Previous enrolled program{enrolledProgramArchives.length === 1 ? "" : "s"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Claim and requirement history from before the current program ({draft.enrolledProgram || "—"}).
                  </p>
                </div>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                {enrolledProgramArchives.length} archived program{enrolledProgramArchives.length === 1 ? "" : "s"}
              </p>
            </div>
            <EnrolledProgramArchiveSections
              archives={enrolledProgramArchives}
              requirementDefs={requirements}
              mode="edit"
              onArchiveRequirementCheckChange={onArchiveRequirementCheckChange}
              onArchiveRequirementSubmittedByChange={onArchiveRequirementSubmittedByChange}
              onArchiveSemesterChange={onArchiveSemesterChange}
            />
          </div>
        </>
      ) : null}
    </form>
  )
}

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

const SKELETON_EXIT_MS = 280
const SKELETON_ROW_COUNT = 8
const revealItemClass = (revealed, index, stepMs = 45) =>
  cn(
    "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:translate-y-0",
    revealed ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
  )
const revealItemStyle = (revealed, index, stepMs = 45) => ({
  transitionDelay: revealed ? `${Math.min(index, 12) * stepMs}ms` : "0ms",
})

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

function GranteeTableRowSkeleton({ className, style }) {
  return (
    <tr className={cn("border-t border-slate-200/80", className)} style={style}>
      <td className="w-[90px]">
        <Skeleton className="h-4 w-10" />
      </td>
      <td className="w-[80px]">
        <Skeleton className="h-4 w-12" />
      </td>
      <td className="w-[110px]">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="w-[260px]">
        <Skeleton className="h-4 w-44 max-w-full" />
      </td>
      <td className="w-[240px]">
        <Skeleton className="h-4 w-36 max-w-full" />
      </td>
      <td className="w-[140px]">
        <Skeleton className="h-4 w-24 max-w-full" />
      </td>
      <td className="w-[110px]">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="text-center">
        <Skeleton className="mx-auto h-8 w-8 rounded-md" />
      </td>
    </tr>
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
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

export default function ProgramWorkspace() {
  const { programSlug } = useParams()
  const { programs, loading: programsLoading } = useOsgfaPrograms()
  const program = useMemo(
    () => programs.find((item) => item.slug === String(programSlug ?? "").trim().toLowerCase()) ?? null,
    [programs, programSlug],
  )
  const programCode = program?.code ?? ""
  const requirements = program?.requirements ?? []
  const { formatStudentId, formatStat } = useOsgfaPrivacySettings()
  const PAGE_SIZE = 100
  const [records, setRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [batchFilter, setBatchFilter] = useState("__")
  const [statusFilter, setStatusFilter] = useState("__")
  const [semestralFilter, setSemestralFilter] = useState("__")
  const [requirementsCoverageFilter, setRequirementsCoverageFilter] = useState("__")
  const [page, setPage] = useState(1)
  const [recordDialogOpen, setRecordDialogOpen] = useState(false)
  const [recordDialogMode, setRecordDialogMode] = useState("view")
  const [activeSeqNo, setActiveSeqNo] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [pendingSaveChanges, setPendingSaveChanges] = useState([])

  const loadRecords = async () => {
    try {
      setIsLoading(true)
      setFetchError(null)
      const rows = await fetchGranteesByProgram(programCode)
      setRecords(filterGranteesByProgram(rows, programCode))
    } catch (err) {
      console.error(`Failed to load ${programCode} grantees:`, err)
      setFetchError(err?.message ?? "Failed to load program records.")
      setRecords([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!programCode) return
    loadRecords()
  }, [programCode])

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

  const uniqueBatches = useMemo(
    () => [...new Set(records.map((row) => row.batchNo).filter(Boolean))].sort(),
    [records],
  )
  const semestralOptions = useMemo(() => {
    const years = [...new Set(records.map((row) => String(row.academicYear ?? "").trim()).filter(Boolean))].sort()
    return years.flatMap((year) => [
      { value: `1st|${year}`, label: `1st Semester ${year}` },
      { value: `2nd|${year}`, label: `2nd Semester ${year}` },
    ])
  }, [records])
  const summary = useMemo(() => {
    const total = records.length
    const claimed = records.filter((row) => row.status === "Claimed").length
    const unclaimed = records.filter((row) => row.status === "Unclaimed").length
    const batches = uniqueBatches.length
    return { total, claimed, unclaimed, batches }
  }, [records, uniqueBatches.length])

  const activeRow = useMemo(
    () => (activeSeqNo ? records.find((row) => row.seqNo === activeSeqNo) ?? null : null),
    [records, activeSeqNo],
  )

  const handleRecordDialogOpenChange = (open) => {
    setRecordDialogOpen(open)
    if (!open) {
      setActiveSeqNo(null)
      setEditDraft(null)
      setSaveConfirmOpen(false)
      setPendingSaveChanges([])
    }
  }

  const openRecordView = (row) => {
    setRecordDialogMode("view")
    setActiveSeqNo(row.seqNo)
    setEditDraft(null)
    setRecordDialogOpen(true)
  }

  const openRecordEdit = (row) => {
    if (!isGranteeRecordActive(row)) return
    setRecordDialogMode("edit")
    setActiveSeqNo(row.seqNo)
    const claimsForRow = ensureSemesterClaimTimestamps(
      Array.isArray(row.semesterClaims) && row.semesterClaims.length > 0
        ? row.semesterClaims.map(normalizeSemesterClaim)
        : semesterClaimsForRow(row, YEAR_LEVELS),
      row.lastUpdated,
    )
    const { requirementChecklistBySem: _legacyFlat, ...rowRest } = row
    const claimLevels = claimsForRow.map((c) => c.yearLevel)
    const requirementChecklistByYearSem = ensureRequirementSemCompletionTimestamps(
      normalizeRequirementChecklistByYearSem(row, requirements, claimLevels),
      requirements,
      claimLevels,
      row.lastUpdated,
    )
    setEditDraft({
      ...rowRest,
      program: programCode,
      semesterClaims: claimsForRow,
      requirementChecklistByYearSem,
      enrolledProgramArchives: normalizeEnrolledProgramArchives(row),
    })
    setRecordDialogOpen(true)
  }

  const updateArchiveInDraft = useCallback((prev, archiveIdx, updater) => {
    if (!prev) return prev
    const archives = normalizeEnrolledProgramArchives(prev).map((archive) => ({
      ...archive,
      semesterClaims: archive.semesterClaims.map((claim) => ({ ...claim })),
      requirementChecklistByYearSem: { ...archive.requirementChecklistByYearSem },
    }))
    const archive = archives[archiveIdx]
    if (!archive) return prev
    const nextArchive = updater(archive)
    if (!nextArchive) return prev
    archives[archiveIdx] = nextArchive
    return { ...prev, enrolledProgramArchives: archives }
  }, [])

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
          requirements,
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
        if (yearLevel) {
          const checklist = requirementChecklistForDraft(prev, requirements)
          if (!requirementYearSemProgress(checklist, yearLevel, semKey, requirements).isComplete) {
            return prev
          }
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
      const merged = normalizeRequirementChecklistByYearSem(prev, requirements, levels)
      return {
        ...prev,
        requirementChecklistByYearSem: updateRequirementChecklistCheck(
          merged,
          yearLevel,
          semKey,
          reqId,
          checked,
          requirements,
        ),
      }
    })
  }

  const handleRequirementSubmittedByChange = (yearLevel, semKey, field, value) => {
    setEditDraft((prev) => {
      if (!prev) return prev
      const levels = semesterClaimsForRow(prev, YEAR_LEVELS).map((c) => c.yearLevel)
      const merged = normalizeRequirementChecklistByYearSem(prev, requirements, levels)
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

  const handleArchiveRequirementCheckChange = (archiveIdx, yearLevel, semKey, reqId, checked) => {
    setEditDraft((prev) =>
      updateArchiveInDraft(prev, archiveIdx, (archive) => {
        const levels = archive.semesterClaims.map((c) => c.yearLevel)
        const merged = normalizeRequirementChecklistByYearSem(
          { requirementChecklistByYearSem: archive.requirementChecklistByYearSem },
          requirements,
          levels,
        )
        return {
          ...archive,
          requirementChecklistByYearSem: updateRequirementChecklistCheck(
            merged,
            yearLevel,
            semKey,
            reqId,
            checked,
            requirements,
          ),
        }
      }),
    )
  }

  const handleArchiveRequirementSubmittedByChange = (archiveIdx, yearLevel, semKey, field, value) => {
    setEditDraft((prev) =>
      updateArchiveInDraft(prev, archiveIdx, (archive) => {
        const levels = archive.semesterClaims.map((c) => c.yearLevel)
        const merged = normalizeRequirementChecklistByYearSem(
          { requirementChecklistByYearSem: archive.requirementChecklistByYearSem },
          requirements,
          levels,
        )
        const nextChecklist =
          field === "submittedBy"
            ? updateRequirementSemSubmittedBy(merged, yearLevel, semKey, value)
            : updateRequirementSemOtherPersonField(merged, yearLevel, semKey, field, value)
        return {
          ...archive,
          requirementChecklistByYearSem: nextChecklist,
        }
      }),
    )
  }

  const handleArchiveSemesterChange = (archiveIdx, claimIdx, semesterKey, value) => {
    setEditDraft((prev) =>
      updateArchiveInDraft(prev, archiveIdx, (archive) => {
        const semKey = SEMESTER_CLAIM_FIELD_SEM[semesterKey]
        if (semKey) {
          const yearLevel = archive.semesterClaims[claimIdx]?.yearLevel
          if (yearLevel && isArchiveSemesterClaimEditBlocked(archive, yearLevel, semKey, requirements)) {
            return null
          }
        }
        return {
          ...archive,
          semesterClaims: mapSemesterClaimsWithFieldChange(archive.semesterClaims, claimIdx, semesterKey, value),
        }
      }),
    )
  }

  const saveRecordEdit = async (e) => {
    e?.preventDefault?.()
    if (!editDraft) return
    const hasMissingOtherName = semesterClaimsForRow(editDraft, YEAR_LEVELS).some(
      (c) =>
        (c.firstSem === "Claimed" && c.firstSemClaimer === "Other" && !String(c.firstSemOtherName ?? "").trim()) ||
        (c.secondSem === "Claimed" && c.secondSemClaimer === "Other" && !String(c.secondSemOtherName ?? "").trim()),
    )
    const hasMissingArchiveOtherName = normalizeEnrolledProgramArchives(editDraft).some((archive) =>
      archive.semesterClaims.some(
        (c) =>
          (c.firstSem === "Claimed" && c.firstSemClaimer === "Other" && !String(c.firstSemOtherName ?? "").trim()) ||
          (c.secondSem === "Claimed" && c.secondSemClaimer === "Other" && !String(c.secondSemOtherName ?? "").trim()),
      ),
    )
    if (hasMissingOtherName || hasMissingArchiveOtherName) {
      window.alert("Please enter the claimant name for every semester marked as Claimed by Other.")
      return
    }
    const levels = semesterClaimsForRow(editDraft, YEAR_LEVELS).map((c) => c.yearLevel)
    const normalizedReqChecklist = normalizeRequirementChecklistByYearSem(editDraft, requirements, levels)
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
    const payload = {
      ...editDraft,
      semesterClaims: ensureSemesterClaimTimestamps(
        editDraft.semesterClaims ?? semesterClaimsForRow(editDraft, YEAR_LEVELS),
        editDraft.lastUpdated,
      ),
      requirementChecklistByYearSem: ensureRequirementSemCompletionTimestamps(
        normalizeRequirementChecklistByYearSem(editDraft, requirements, levels),
        requirements,
        levels,
        editDraft.lastUpdated,
      ),
    }
    try {
      setIsSaving(true)
      const updated = await updateGrantee(editDraft.id, payload)
      setRecords((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setSaveConfirmOpen(false)
      setPendingSaveChanges([])
      handleRecordDialogOpenChange(false)
    } catch (err) {
      console.error(`Failed to save ${programCode} grantee:`, err)
      window.alert(err?.message ?? "Failed to save changes to the database.")
    } finally {
      setIsSaving(false)
    }
  }

  const requestSaveRecordEdit = () => {
    if (!editDraft || !activeRow) return
    const diffSummary = buildEditChangeSummary(activeRow, editDraft, requirements)
    setPendingSaveChanges(diffSummary)
    setSaveConfirmOpen(true)
  }

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const matchesSemestralFilter = (row) => {
      if (semestralFilter === "__" || semestralFilter === "") return true
      const [semester, year] = String(semestralFilter).split("|")
      const rowYear = String(row.academicYear ?? "").trim()
      if (!semester || !year) return true
      return rowYear === year
    }

    return records.filter((row) => {
      if (batchFilter !== "__" && batchFilter !== "" && String(row.batchNo ?? "") !== batchFilter) return false
      if (statusFilter !== "__" && statusFilter !== "" && String(row.status ?? "") !== statusFilter) return false
      if (!matchesSemestralFilter(row)) return false
      if (requirementsCoverageFilter !== "__" && requirementsCoverageFilter !== "") {
        const levels = semesterClaimsForRow(row, YEAR_LEVELS).map((c) => c.yearLevel)
        const cat = requirementCoverageStatusForRow(row, requirements, levels)
        if (requirementsCoverageFilter === "incomplete" && cat !== "incomplete") return false
        if (requirementsCoverageFilter === "complete" && cat !== "complete") return false
      }

      if (!query) return true
      return (
        String(row.seqNo ?? "").toLowerCase().includes(query) ||
        String(row.studentId ?? "").toLowerCase().includes(query) ||
        String(row.awardNumber ?? "").toLowerCase().includes(query) ||
        String(row.fullName ?? "").toLowerCase().includes(query) ||
        String(row.batchNo ?? "").toLowerCase().includes(query) ||
        String(row.status ?? "").toLowerCase().includes(query) ||
        String(row.enrolledProgram ?? "").toLowerCase().includes(query) ||
        String(row.yearLevel ?? "").toLowerCase().includes(query)
      )
    })
  }, [batchFilter, records, statusFilter, semestralFilter, searchTerm, requirementsCoverageFilter, requirements])

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE)), [filteredRecords.length])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, batchFilter, statusFilter, semestralFilter, requirementsCoverageFilter])

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), pageCount))
  }, [pageCount])

  const pagedRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredRecords.slice(start, start + PAGE_SIZE)
  }, [filteredRecords, page])

  if (!programsLoading && (!program || program.active === false)) {
    return <Navigate to="/osgfa/dashboard" replace />
  }

  if (programsLoading || !program) {
    return (
      <section className="w-full min-w-0 max-w-full space-y-4">
        <div className="rounded-xl border border-[#081F5C]/15 bg-white/80 px-4 py-8 text-sm text-muted-foreground dark:bg-slate-950/40">
          Loading program workspace…
        </div>
      </section>
    )
  }

  return (
    <section className="w-full min-w-0 max-w-full space-y-4">
      {fetchError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
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
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-amber-500" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-violet-500" />
          </div>
        )}
        {!isLoading && (
          <div className="relative z-10 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <SummaryStatCard
              label="Total Records"
              value={formatStat(summary.total, "Total Records")}
              accentBar="border-l-[3px] border-l-[#081F5C]"
              glow="bg-[#081F5C]/25"
              iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
              Icon={TableProperties}
              className={revealItemClass(contentRevealed, 0, 60)}
              style={revealItemStyle(contentRevealed, 0, 60)}
            />
            <SummaryStatCard
              label="Claimed"
              value={formatStat(summary.claimed, "Claimed")}
              accentBar="border-l-[3px] border-l-emerald-500"
              glow="bg-emerald-400/30"
              iconBg="bg-linear-to-br from-emerald-500 to-teal-600 text-white"
              Icon={CircleCheck}
              className={revealItemClass(contentRevealed, 1, 60)}
              style={revealItemStyle(contentRevealed, 1, 60)}
            />
            <SummaryStatCard
              label="Unclaimed"
              value={formatStat(summary.unclaimed, "Unclaimed")}
              accentBar="border-l-[3px] border-l-amber-500"
              glow="bg-amber-400/30"
              iconBg="bg-linear-to-br from-amber-500 to-orange-500 text-white"
              Icon={CircleDashed}
              className={revealItemClass(contentRevealed, 2, 60)}
              style={revealItemStyle(contentRevealed, 2, 60)}
            />
            <SummaryStatCard
              label="Total Batches"
              value={summary.batches}
              accentBar="border-l-[3px] border-l-violet-500"
              glow="bg-violet-400/30"
              iconBg="bg-linear-to-br from-violet-500 to-fuchsia-600 text-white"
              Icon={Layers}
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
              id="batch-filter"
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
              id="status-filter"
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
              id="requirements-coverage-filter"
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
              id="tes-search"
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

      <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[1080px] text-xs sm:text-sm [&_th]:px-2 [&_th]:py-2.5 [&_td]:px-2 [&_td]:py-2.5 sm:[&_th]:px-3 sm:[&_td]:px-3">
            <thead className="bg-slate-100 text-slate-700">
              <tr className="[&>th]:text-left [&>th]:font-semibold">
                <th className="w-[90px]">BATCH NO.</th>
                <th className="w-[80px]">SEQ NO</th>
                <th className="w-[110px]">STUDENT ID</th>
                <th className="w-[260px]">AWARD NUMBER</th>
                <th className="w-[240px]">FULLNAME</th>
                <th className="w-[140px]">ENROLLED PROGRAM</th>
                <th className="w-[110px]">YEAR LEVEL</th>
                <th className="w-[76px] text-center">ACTIONS</th>
              </tr>
            </thead>

            <tbody className="[&>tr:nth-child(even)]:bg-slate-50">
              {(isLoading || skeletonLeaving) &&
                Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                  <GranteeTableRowSkeleton
                    key={`skeleton-${index}`}
                    className={cn(
                      "transition-opacity duration-300 ease-out motion-reduce:transition-none",
                      !isLoading && "pointer-events-none opacity-0",
                    )}
                  />
                ))}
              {!isLoading &&
                pagedRecords.map((row, index) => {
                  const recordIsActive = isGranteeRecordActive(row)
                  return (
                <tr
                  key={row.id || row.seqNo}
                  className={cn(
                    "border-t border-slate-200/80 transition-colors hover:bg-slate-100/60",
                    !recordIsActive && "bg-amber-50/35 dark:bg-amber-500/8",
                    revealItemClass(contentRevealed, index, 35),
                  )}
                  style={revealItemStyle(contentRevealed, index, 35)}
                >
                  <td className="w-[90px] whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate">{row.batchNo || "—"}</span>
                      <GranteeInactiveStatusIndicator row={row} iconClassName="size-3.5" />
                    </div>
                  </td>
                  <td className="w-[80px] whitespace-nowrap font-medium text-pink-600">
                    {row.seqNo}
                  </td>
                  <td className="w-[110px] whitespace-nowrap text-blue-600">
                    {formatStudentId(row.studentId, "listCard")}
                  </td>
                  <td className="w-[260px] max-w-[260px] truncate whitespace-nowrap font-mono text-xs sm:text-sm" title={row.awardNumber}>
                    {row.awardNumber}
                  </td>
                  <td className="w-[240px] max-w-[240px] truncate whitespace-nowrap font-medium" title={row.fullName}>
                    {row.fullName}
                  </td>
                  <td className="w-[140px] max-w-[140px] truncate whitespace-nowrap" title={row.enrolledProgram}>
                    {row.enrolledProgram}
                  </td>
                  <td className="w-[110px] whitespace-nowrap">{row.yearLevel}</td>
                  <td className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${row.fullName}`}
                          title="Actions"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-36">
                        <DropdownMenuItem className="gap-2" onSelect={() => openRecordView(row)}>
                          <Eye className="size-4 opacity-70" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2"
                          disabled={!recordIsActive}
                          title={!recordIsActive ? "Inactive records cannot be edited" : undefined}
                          onSelect={() => openRecordEdit(row)}
                        >
                          <Pencil className="size-4 opacity-70" />
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )})}
              {!isLoading && filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className={cn("py-12 text-center", revealItemClass(contentRevealed, 0))}
                    style={revealItemStyle(contentRevealed, 0)}
                  >
                    <div className="mx-auto max-w-md space-y-2">
                      <p className="text-base font-semibold text-slate-800">
                        {records.length === 0 ? `No ${programCode} grantees yet` : "No matching grantees"}
                      </p>
                      <p className="text-sm leading-relaxed text-slate-500">
                        {records.length === 0
                          ? "Add grantees from Batches to start tracking scholars for this program here."
                          : "Try a different search term or adjust your filters to find grantees."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-xs">
          <p className="text-slate-600">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredRecords.length)}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{filteredRecords.length}</span>
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

      <Dialog open={recordDialogOpen} onOpenChange={handleRecordDialogOpenChange}>
        <DialogContent className="relative flex h-[min(92vw,42rem,calc(100dvh-3rem))] w-[min(92vw,42rem,calc(100dvh-3rem))] max-w-none flex-col gap-0 overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6]"
            aria-hidden
          />
          <DialogHeader className="relative shrink-0 pt-1">
            <DialogTitle>{recordDialogMode === "edit" ? "Edit record" : "View record"}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 pr-1 [scrollbar-gutter:stable]">
            {recordDialogMode === "view" && activeRow ? (
              <GranteeRecordView row={activeRow} formatStudentId={formatStudentId} programCode={programCode} requirements={requirements} />
            ) : null}

            {recordDialogMode === "edit" && editDraft ? (
              <GranteeRecordEdit
                draft={editDraft}
                programCode={programCode}
                requirements={requirements}
                onChange={handleEditFieldChange}
                onSemesterChange={handleSemesterClaimChange}
                onRequirementCheckChange={handleRequirementCheckChange}
                onRequirementSubmittedByChange={handleRequirementSubmittedByChange}
                onArchiveRequirementCheckChange={handleArchiveRequirementCheckChange}
                onArchiveRequirementSubmittedByChange={handleArchiveRequirementSubmittedByChange}
                onArchiveSemesterChange={handleArchiveSemesterChange}
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
              <Button
                type="button"
                disabled={!isGranteeRecordActive(activeRow)}
                title={!isGranteeRecordActive(activeRow) ? "Inactive records cannot be edited" : undefined}
                onClick={() => openRecordEdit(activeRow)}
              >
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
            <AlertDialogDescription>
              Are you sure you want to save these changes?
            </AlertDialogDescription>
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
  )
}
