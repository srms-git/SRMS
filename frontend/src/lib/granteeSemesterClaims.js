import { formatRequirementCompletedAt } from "@/lib/granteeRequirementsChecklist"

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
    secondSemOtherName: claim?.secondSemOtherName ?? "",
    firstSemClaimedAt: typeof firstAt === "string" && firstAt.trim() ? firstAt.trim() : null,
    secondSemClaimedAt: typeof secondAt === "string" && secondAt.trim() ? secondAt.trim() : null,
  }
}

export function semesterClaimedAtForClaim(claim, semStatusKey) {
  const atKey = SEMESTER_CLAIMED_AT_KEY[semStatusKey]
  const raw = claim?.[atKey]
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

/**
 * @param {unknown} row
 * @param {string[]} yearLevels
 */
export function semesterClaimsForRow(row, yearLevels) {
  if (Array.isArray(row?.semesterClaims) && row.semesterClaims.length > 0) {
    return row.semesterClaims.map(normalizeSemesterClaim)
  }

  const n = yearLevelIndex(row?.yearLevel, yearLevels) + 1
  const rows = []
  for (let i = 0; i < n; i++) {
    const yl = yearLevels[i]
    const isCurrent = yl === row?.yearLevel
    if (!isCurrent) {
      rows.push(
        normalizeSemesterClaim({
          yearLevel: yl,
          firstSem: "Claimed",
          secondSem: "Claimed",
          firstSemClaimer: "Grantee",
          secondSemClaimer: "Grantee",
        }),
      )
    } else if (row?.status === "Claimed") {
      rows.push(
        normalizeSemesterClaim({
          yearLevel: yl,
          firstSem: "Claimed",
          secondSem: "Claimed",
          firstSemClaimer: "Grantee",
          secondSemClaimer: "Grantee",
        }),
      )
    } else {
      rows.push(
        normalizeSemesterClaim({
          yearLevel: yl,
          firstSem: "Claimed",
          secondSem: "Unclaimed",
          firstSemClaimer: "Grantee",
        }),
      )
    }
  }
  return rows
}

export function applySemesterClaimFieldChange(claim, semesterKey, value) {
  const next = { ...claim, [semesterKey]: value }

  if (semesterKey === "firstSem") {
    const existingAt = semesterClaimedAtForClaim(claim, "firstSem")
    if (value !== "Claimed") {
      next.firstSemClaimer = ""
      next.firstSemOtherName = ""
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
      if (existingAt) next.secondSemClaimedAt = existingAt
    } else {
      if (!next.secondSemClaimer) next.secondSemClaimer = "Grantee"
      next.secondSemClaimedAt = existingAt ?? new Date().toISOString()
    }
  }

  if (semesterKey === "firstSemClaimer" && value !== "Other") {
    next.firstSemOtherName = ""
  }

  if (semesterKey === "secondSemClaimer" && value !== "Other") {
    next.secondSemOtherName = ""
  }

  return next
}

export function mapSemesterClaimsWithFieldChange(claims, idx, semesterKey, value) {
  return claims.map((c, i) => (i !== idx ? c : applySemesterClaimFieldChange(c, semesterKey, value)))
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
