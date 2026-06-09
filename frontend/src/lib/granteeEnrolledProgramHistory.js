import {
  countFullyClaimedYearLevels,
  isAddingSemesterClaim,
  isFullyClaimedYearLevel,
  normalizeSemesterClaim,
  semesterClaimsForRow,
} from "@/lib/granteeSemesterClaims"
import {
  normalizeRequirementChecklistByYearSem,
  sanitizeRequirementChecklistForSave,
} from "@/lib/granteeRequirementsChecklist"

const DEFAULT_YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"]

export const MAX_LIFETIME_CLAIMED_YEARS = 5
/** @deprecated Use MAX_LIFETIME_CLAIMED_YEARS */
export const MAX_LIFETIME_SEMESTER_CLAIMS = MAX_LIFETIME_CLAIMED_YEARS

export const FULLY_CLAIMED_INACTIVE_REMARKS =
  "Fully claimed — this student has received grants for all available year levels across enrolled programs."

export function lifetimeClaimLimitMessage() {
  return `A grantee may only claim up to ${MAX_LIFETIME_CLAIMED_YEARS} year levels in total (both semesters claimed per year), including prior enrolled programs.`
}

export function countLifetimeClaimedYearsFromRow(row, yearLevels = DEFAULT_YEAR_LEVELS) {
  const currentClaims = semesterClaimsForRow(row, yearLevels)
  const archives = normalizeEnrolledProgramArchives(row)
  const archivedYears = archives.reduce((sum, archive) => sum + countFullyClaimedYearLevels(archive.semesterClaims), 0)
  return countFullyClaimedYearLevels(currentClaims) + archivedYears
}

/** @deprecated Use countLifetimeClaimedYearsFromRow */
export function countLifetimeSemesterClaimsFromRow(row, yearLevels = DEFAULT_YEAR_LEVELS) {
  return countLifetimeClaimedYearsFromRow(row, yearLevels)
}

export function wouldExceedLifetimeYearClaimLimit(row, claims, idx, semesterKey, value, yearLevels = DEFAULT_YEAR_LEVELS) {
  if (!isAddingSemesterClaim(claims, idx, semesterKey, value)) return false

  const claim = claims[idx]
  if (!claim || isFullyClaimedYearLevel(claim)) return false

  const fullYearCount = countLifetimeClaimedYearsFromRow(row, yearLevels)
  if (fullYearCount >= MAX_LIFETIME_CLAIMED_YEARS) return true

  const otherSem = semesterKey === "firstSem" ? "secondSem" : "firstSem"
  if (claim[otherSem] === "Claimed") {
    return fullYearCount + 1 > MAX_LIFETIME_CLAIMED_YEARS
  }

  return false
}

/**
 * True when the grantee is at the highest year level in the system and every year
 * level on record (current program) is fully claimed — e.g. 4th Year with no 5th Year.
 */
export function hasExhaustedProgramYearClaims(row, yearLevels = DEFAULT_YEAR_LEVELS) {
  const maxYearLevel = yearLevels[yearLevels.length - 1] ?? ""
  const currentYearLevel = String(row?.yearLevel ?? "").trim()
  if (!currentYearLevel || currentYearLevel !== maxYearLevel) return false

  const currentClaims = semesterClaimsForRow(row, yearLevels)
  if (currentClaims.length === 0) return false

  return currentClaims.every(isFullyClaimedYearLevel)
}

export function isGranteeFullyClaimed(row, yearLevels = DEFAULT_YEAR_LEVELS) {
  if (countLifetimeClaimedYearsFromRow(row, yearLevels) >= MAX_LIFETIME_CLAIMED_YEARS) return true
  return hasExhaustedProgramYearClaims(row, yearLevels)
}

export function applyFullyClaimedInactiveState(row, yearLevels = DEFAULT_YEAR_LEVELS) {
  if (!isGranteeFullyClaimed(row, yearLevels)) return row
  return {
    ...row,
    active: false,
    inactiveRemarks: FULLY_CLAIMED_INACTIVE_REMARKS,
  }
}

/**
 * @param {unknown} row
 * @returns {Array<{ enrolledProgram: string, yearLevelAtArchive: string, archivedAt: string, semesterClaims: object[], requirementChecklistByYearSem: object }>}
 */
export function normalizeEnrolledProgramArchives(row) {
  const raw = row?.enrolledProgramArchives
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry) => {
      const enrolledProgram = String(entry?.enrolledProgram ?? "").trim()
      if (!enrolledProgram) return null
      const semesterClaims = Array.isArray(entry?.semesterClaims)
        ? entry.semesterClaims.map(normalizeSemesterClaim)
        : []
      const requirementChecklistByYearSem =
        entry?.requirementChecklistByYearSem && typeof entry.requirementChecklistByYearSem === "object"
          ? entry.requirementChecklistByYearSem
          : {}
      return {
        enrolledProgram,
        yearLevelAtArchive: String(entry?.yearLevelAtArchive ?? "").trim(),
        archivedAt: String(entry?.archivedAt ?? "").trim(),
        semesterClaims,
        requirementChecklistByYearSem,
      }
    })
    .filter(Boolean)
}

export function buildFreshFirstYearSemesterClaims(yearLevels = DEFAULT_YEAR_LEVELS) {
  const firstYear = yearLevels[0] ?? "1st Year"
  return [{ yearLevel: firstYear, firstSem: "Unclaimed", secondSem: "Unclaimed" }]
}

/**
 * When a grantee switches enrolled program, archive prior requirements and claims,
 * then reset progress under the new program at 1st Year.
 *
 * @param {object} draft
 * @param {string} newEnrolledProgram
 * @param {{ requirementDefs: import("@/lib/granteeRequirementsChecklist").RequirementDef[], yearLevels?: string[] }} options
 */
export function applyEnrolledProgramChange(draft, newEnrolledProgram, options) {
  const yearLevels = options?.yearLevels ?? DEFAULT_YEAR_LEVELS
  const requirementDefs = options?.requirementDefs ?? []
  const oldProgram = String(draft?.enrolledProgram ?? "").trim()
  const newProgram = String(newEnrolledProgram ?? "").trim()

  if (!newProgram) {
    return { ...draft, enrolledProgram: newProgram }
  }
  if (oldProgram === newProgram) {
    return { ...draft, enrolledProgram: newProgram }
  }

  const archives = normalizeEnrolledProgramArchives(draft)
  const currentClaims = semesterClaimsForRow(draft, yearLevels)
  const currentChecklist = draft?.requirementChecklistByYearSem ?? {}

  const hasArchiveableData =
    oldProgram.length > 0 ||
    currentClaims.some((c) => c.firstSem !== "Unclaimed" || c.secondSem !== "Unclaimed") ||
    Object.keys(currentChecklist).length > 0

  if (hasArchiveableData) {
    archives.push({
      enrolledProgram: oldProgram || "Previous enrolled program",
      yearLevelAtArchive: String(draft?.yearLevel ?? "").trim(),
      archivedAt: new Date().toISOString(),
      semesterClaims: currentClaims.map((c) => normalizeSemesterClaim({ ...c })),
      requirementChecklistByYearSem: sanitizeRequirementChecklistForSave(currentChecklist),
    })
  }

  const firstYear = yearLevels[0] ?? "1st Year"
  const freshClaims = buildFreshFirstYearSemesterClaims(yearLevels)
  const freshChecklist = normalizeRequirementChecklistByYearSem(
    { requirementChecklistByYearSem: {} },
    requirementDefs,
    [firstYear],
  )

  return {
    ...draft,
    enrolledProgram: newProgram,
    yearLevel: firstYear,
    semesterClaims: freshClaims,
    requirementChecklistByYearSem: freshChecklist,
    enrolledProgramArchives: archives,
    status: "Unclaimed",
  }
}

/** Scholarship/grant program codes — never valid enrolled degree programs. */
export const SCHOLARSHIP_PROGRAM_CODES = new Set(["TES", "TDP"])

/**
 * @param {unknown} code
 * @param {Iterable<string>} [additionalCodes] OSGFA program codes from settings
 */
export function isScholarshipProgramCode(code, additionalCodes = []) {
  const normalized = String(code ?? "").trim().toUpperCase()
  if (!normalized) return false
  if (SCHOLARSHIP_PROGRAM_CODES.has(normalized)) return true
  for (const entry of additionalCodes) {
    if (String(entry ?? "").trim().toUpperCase() === normalized) return true
  }
  return false
}

/**
 * Distinct enrolled (degree/course) programs for dropdowns.
 * Uses current grantee enrolledProgram values only — not scholarship program codes.
 *
 * @param {unknown[]} rows
 * @param {string[]} [extraPrograms]
 * @param {{ scholarshipCodes?: Iterable<string>, includeArchives?: boolean }} [options]
 */
export function collectEnrolledProgramOptions(rows, extraPrograms = [], options = {}) {
  const scholarshipCodes = options.scholarshipCodes ?? []
  const includeArchives = options.includeArchives === true
  const set = new Set()

  const addIfValid = (program) => {
    const trimmed = String(program ?? "").trim()
    if (!trimmed || isScholarshipProgramCode(trimmed, scholarshipCodes)) return
    set.add(trimmed)
  }

  for (const program of extraPrograms) addIfValid(program)
  for (const row of rows ?? []) {
    addIfValid(row?.enrolledProgram)
    if (includeArchives) {
      for (const archive of normalizeEnrolledProgramArchives(row)) {
        addIfValid(archive.enrolledProgram)
      }
    }
  }

  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

export function sanitizeEnrolledProgramArchivesForSave(archives) {
  return normalizeEnrolledProgramArchives({ enrolledProgramArchives: archives }).map((entry) => ({
    enrolledProgram: entry.enrolledProgram,
    yearLevelAtArchive: entry.yearLevelAtArchive,
    archivedAt: entry.archivedAt || new Date().toISOString(),
    semesterClaims: entry.semesterClaims.map(normalizeSemesterClaim),
    requirementChecklistByYearSem: sanitizeRequirementChecklistForSave(entry.requirementChecklistByYearSem),
  }))
}
