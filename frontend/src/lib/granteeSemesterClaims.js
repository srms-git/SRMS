import { formatRequirementCompletedAt, requirementYearSemProgress } from "@/lib/granteeRequirementsChecklist"
import { sanitizeContactNumber } from "@/lib/contactNumber"

export const SEMESTER_CLAIMED_AT_KEY = {
  firstSem: "firstSemClaimedAt",
  secondSem: "secondSemClaimedAt",
}

export function formatSemesterClaimedAt(iso) {
  return formatRequirementCompletedAt(iso)
}

export function yearLevelIndex(yearLevel, yearLevels) {
  const i = yearLevels.indexOf(yearLevel)
  return i >= 0 ? i : 0
}

export function normalizeSemesterClaim(claim) {
  const firstSem = claim?.firstSem ?? "Unclaimed"
  const secondSem = claim?.secondSem ?? "Unclaimed"
  const firstAt = claim?.[SEMESTER_CLAIMED_AT_KEY.firstSem]
  const secondAt = claim?.[SEMESTER_CLAIMED_AT_KEY.secondSem]

  return {
    yearLevel: claim?.yearLevel,
    firstSem,
    secondSem,
    firstSemClaimer: claim?.firstSemClaimer ?? (firstSem === "Claimed" ? "Grantee" : ""),
    secondSemClaimer: claim?.secondSemClaimer ?? (secondSem === "Claimed" ? "Grantee" : ""),
    firstSemOtherName: claim?.firstSemOtherName ?? "",
    firstSemOtherRelation: claim?.firstSemOtherRelation ?? "",
    firstSemOtherContact: sanitizeContactNumber(claim?.firstSemOtherContact),
    secondSemOtherName: claim?.secondSemOtherName ?? "",
    secondSemOtherRelation: claim?.secondSemOtherRelation ?? "",
    secondSemOtherContact: sanitizeContactNumber(claim?.secondSemOtherContact),
    firstSemClaimedAt: typeof firstAt === "string" && firstAt.trim() ? firstAt.trim() : null,
    secondSemClaimedAt: typeof secondAt === "string" && secondAt.trim() ? secondAt.trim() : null,
  }
}

export function semesterClaimedAtForClaim(claim, semStatusKey) {
  const atKey = SEMESTER_CLAIMED_AT_KEY[semStatusKey]
  const raw = claim?.[atKey]
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

function unclaimedSemesterClaim(yearLevel) {
  return normalizeSemesterClaim({ yearLevel, firstSem: "Unclaimed", secondSem: "Unclaimed" })
}

function claimedSemesterClaim(yearLevel) {
  return normalizeSemesterClaim({
    yearLevel,
    firstSem: "Claimed",
    secondSem: "Claimed",
    firstSemClaimer: "Grantee",
    secondSemClaimer: "Grantee",
  })
}

/**
 * Builds default semester claim rows through the grantee's current year level (all Unclaimed).
 *
 * @param {string} yearLevel
 * @param {string[]} yearLevels
 */
export function buildDefaultSemesterClaimsForYearLevel(yearLevel, yearLevels) {
  const n = yearLevelIndex(yearLevel, yearLevels) + 1
  const rows = []
  for (let i = 0; i < n; i++) {
    rows.push(unclaimedSemesterClaim(yearLevels[i]))
  }
  return rows
}

/**
 * @param {unknown} row
 * @param {string[]} yearLevels
 */
export function semesterClaimsForRow(row, yearLevels) {
  if (Array.isArray(row?.semesterClaims) && row.semesterClaims.length > 0) {
    return row.semesterClaims.map(normalizeSemesterClaim)
  }

  const overallClaimed = String(row?.status ?? "").trim() === "Claimed"
  const n = yearLevelIndex(row?.yearLevel, yearLevels) + 1
  const rows = []
  for (let i = 0; i < n; i++) {
    const yl = yearLevels[i]
    const isCurrent = yl === row?.yearLevel
    if (!overallClaimed) {
      rows.push(unclaimedSemesterClaim(yl))
    } else if (!isCurrent) {
      rows.push(claimedSemesterClaim(yl))
    } else {
      rows.push(claimedSemesterClaim(yl))
    }
  }
  return rows
}

export function applySemesterClaimFieldChange(claim, semesterKey, value) {
  const nextValue =
    semesterKey === "firstSemOtherContact" || semesterKey === "secondSemOtherContact"
      ? sanitizeContactNumber(value)
      : value
  const next = { ...claim, [semesterKey]: nextValue }

  if (semesterKey === "firstSem") {
    const existingAt = semesterClaimedAtForClaim(claim, "firstSem")
    if (value !== "Claimed") {
      next.firstSemClaimer = ""
      next.firstSemOtherName = ""
      next.firstSemOtherRelation = ""
      next.firstSemOtherContact = ""
      if (existingAt) next.firstSemClaimedAt = existingAt
    } else {
      if (!next.firstSemClaimer) next.firstSemClaimer = "Grantee"
      next.firstSemClaimedAt = existingAt ?? new Date().toISOString()
    }
  }

  if (semesterKey === "secondSem") {
    const existingAt = semesterClaimedAtForClaim(claim, "secondSem")
    if (value !== "Claimed") {
      next.secondSemClaimer = ""
      next.secondSemOtherName = ""
      next.secondSemOtherRelation = ""
      next.secondSemOtherContact = ""
      if (existingAt) next.secondSemClaimedAt = existingAt
    } else {
      if (!next.secondSemClaimer) next.secondSemClaimer = "Grantee"
      next.secondSemClaimedAt = existingAt ?? new Date().toISOString()
    }
  }

  if (semesterKey === "firstSemClaimer" && value !== "Other") {
    next.firstSemOtherName = ""
    next.firstSemOtherRelation = ""
    next.firstSemOtherContact = ""
  }

  if (semesterKey === "secondSemClaimer" && value !== "Other") {
    next.secondSemOtherName = ""
    next.secondSemOtherRelation = ""
    next.secondSemOtherContact = ""
  }

  return next
}

export function mapSemesterClaimsWithFieldChange(claims, idx, semesterKey, value) {
  return claims.map((c, i) => (i !== idx ? c : applySemesterClaimFieldChange(c, semesterKey, value)))
}

export function isFullyClaimedYearLevel(claim) {
  return claim?.firstSem === "Claimed" && claim?.secondSem === "Claimed"
}

/** A claimed year is both semesters marked Claimed for the same year level. */
export function countFullyClaimedYearLevels(claims) {
  return (claims ?? []).filter(isFullyClaimedYearLevel).length
}

export function countClaimedSemesters(claims) {
  return (claims ?? []).reduce((count, claim) => {
    if (claim?.firstSem === "Claimed") count += 1
    if (claim?.secondSem === "Claimed") count += 1
    return count
  }, 0)
}

export function isAddingSemesterClaim(claims, idx, semesterKey, value) {
  return (
    (semesterKey === "firstSem" || semesterKey === "secondSem") &&
    value === "Claimed" &&
    claims[idx]?.[semesterKey] !== "Claimed"
  )
}

const REQUIREMENT_SEM_TO_CLAIM_FIELD = {
  first: "firstSem",
  second: "secondSem",
}

/** Resets Claimed semesters to Unclaimed when that semester's requirements are incomplete. */
export function reconcileSemesterClaimsWithRequirementChecklist(claims, checklist, requirementDefs) {
  return (claims ?? []).map((claim) => {
    let row = claim
    for (const semKey of ["first", "second"]) {
      const field = REQUIREMENT_SEM_TO_CLAIM_FIELD[semKey]
      const progress = requirementYearSemProgress(checklist, row.yearLevel, semKey, requirementDefs)
      if (!progress.isComplete && row[field] === "Claimed") {
        row = applySemesterClaimFieldChange(row, field, "Unclaimed")
      }
    }
    return row
  })
}

/**
 * @param {Array<Record<string, unknown>>} claims
 * @param {string} [fallbackIso]
 */
export function ensureSemesterClaimTimestamps(claims, fallbackIso) {
  let fallback = new Date().toISOString()
  if (typeof fallbackIso === "string" && fallbackIso.trim()) {
    const trimmed = fallbackIso.trim()
    fallback = trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00.000Z`
  }

  return (claims ?? []).map((claim) => {
    let next = { ...claim }
    for (const sem of ["firstSem", "secondSem"]) {
      if (next[sem] === "Claimed" && !semesterClaimedAtForClaim(next, sem)) {
        next = { ...next, [SEMESTER_CLAIMED_AT_KEY[sem]]: fallback }
      }
    }
    return next
  })
}
