import { sanitizeContactNumber } from "@/lib/contactNumber"

/** @typedef {{ id: string, label: string }} RequirementDef */

/**
 * @param {RequirementDef[]} defs
 */
function emptyFlagsForDefs(defs) {
  return Object.fromEntries(defs.map((d) => [d.id, false]))
}

/**
 * @param {string[]} yearLevels
 * @param {RequirementDef[]} defs
 * @returns {Record<string, { first: Record<string, boolean>, second: Record<string, boolean> }>}
 */
export const REQUIREMENT_SEM_COMPLETED_AT_KEY = {
  first: "firstCompletedAt",
  second: "secondCompletedAt",
}

export const REQUIREMENT_SEM_SUBMITTED_BY_KEY = {
  first: "firstSubmittedBy",
  second: "secondSubmittedBy",
}

export const REQUIREMENT_SEM_OTHER_PERSON_KEY = {
  first: {
    name: "firstSubmittedOtherName",
    relation: "firstSubmittedOtherRelation",
    contact: "firstSubmittedOtherContact",
  },
  second: {
    name: "secondSubmittedOtherName",
    relation: "secondSubmittedOtherRelation",
    contact: "secondSubmittedOtherContact",
  },
}

export function buildEmptyRequirementChecklistByYearSem(yearLevels, defs) {
  const flags = emptyFlagsForDefs(defs)
  const out = {}
  for (const yl of yearLevels) {
    out[yl] = {
      first: { ...flags },
      second: { ...flags },
      firstCompletedAt: null,
      secondCompletedAt: null,
      firstSubmittedBy: "",
      firstSubmittedOtherName: "",
      firstSubmittedOtherRelation: "",
      firstSubmittedOtherContact: "",
      secondSubmittedBy: "",
      secondSubmittedOtherName: "",
      secondSubmittedOtherRelation: "",
      secondSubmittedOtherContact: "",
    }
  }
  return out
}

/**
 * Merges stored data for the given year levels only (drops rows not in `yearLevels`).
 * Migrates legacy `requirementChecklistBySem` into the grantee's **current** `row.yearLevel` if present.
 *
 * @param {unknown} row
 * @param {RequirementDef[]} defs
 * @param {string[]} yearLevels
 */
export function normalizeRequirementChecklistByYearSem(row, defs, yearLevels) {
  const levels = [...new Set(yearLevels.map((s) => String(s ?? "").trim()).filter(Boolean))]
  if (levels.length === 0) return {}

  const base = buildEmptyRequirementChecklistByYearSem(levels, defs)

  const raw = row?.requirementChecklistByYearSem
  if (raw && typeof raw === "object") {
    for (const yl of levels) {
      const slice = raw[yl]
      if (!slice || typeof slice !== "object") continue
      for (const sem of ["first", "second"]) {
        const semObj = slice[sem]
        if (!semObj || typeof semObj !== "object") continue
        for (const d of defs) {
          if (typeof semObj[d.id] === "boolean") base[yl][sem][d.id] = semObj[d.id]
        }
      }
      for (const atKey of Object.values(REQUIREMENT_SEM_COMPLETED_AT_KEY)) {
        const rawAt = slice[atKey]
        if (typeof rawAt === "string" && rawAt.trim()) base[yl][atKey] = rawAt.trim()
      }
      for (const semKey of ["first", "second"]) {
        const submittedByKey = REQUIREMENT_SEM_SUBMITTED_BY_KEY[semKey]
        const rawSubmittedBy = slice[submittedByKey]
        if (typeof rawSubmittedBy === "string") base[yl][submittedByKey] = rawSubmittedBy.trim()
        for (const personKey of Object.values(REQUIREMENT_SEM_OTHER_PERSON_KEY[semKey])) {
          const rawPerson = slice[personKey]
          if (typeof rawPerson === "string") {
            base[yl][personKey] =
              personKey.endsWith("Contact") ? sanitizeContactNumber(rawPerson) : rawPerson.trim()
          }
        }
      }
    }
  }

  const legacy = row?.requirementChecklistBySem
  const currentYl = String(row?.yearLevel ?? "").trim()
  if (legacy && typeof legacy === "object" && currentYl && base[currentYl]) {
    for (const sem of ["first", "second"]) {
      const semObj = legacy[sem]
      if (!semObj || typeof semObj !== "object") continue
      for (const d of defs) {
        if (typeof semObj[d.id] === "boolean") base[currentYl][sem][d.id] = semObj[d.id]
      }
    }
  }

  return base
}

/**
 * @param {Record<string, { first: Record<string, boolean>, second: Record<string, boolean> }>} checklist
 * @param {string} yearLevel
 * @param {"first"|"second"} semKey
 * @param {RequirementDef[]} defs
 */
export function requirementSemSubmittedBy(checklist, yearLevel, semKey) {
  const key = REQUIREMENT_SEM_SUBMITTED_BY_KEY[semKey]
  const raw = checklist?.[yearLevel]?.[key]
  return typeof raw === "string" ? raw.trim() : ""
}

export function requirementSemOtherPerson(checklist, yearLevel, semKey) {
  const keys = REQUIREMENT_SEM_OTHER_PERSON_KEY[semKey]
  return {
    name: String(checklist?.[yearLevel]?.[keys.name] ?? "").trim(),
    relation: String(checklist?.[yearLevel]?.[keys.relation] ?? "").trim(),
    contact: String(checklist?.[yearLevel]?.[keys.contact] ?? "").trim(),
  }
}

/**
 * @param {Record<string, unknown>} checklist
 * @param {string} yearLevel
 * @param {"first"|"second"} semKey
 * @param {string} submittedBy
 */
export function updateRequirementSemSubmittedBy(checklist, yearLevel, semKey, submittedBy) {
  const submittedByKey = REQUIREMENT_SEM_SUBMITTED_BY_KEY[semKey]
  const personKeys = REQUIREMENT_SEM_OTHER_PERSON_KEY[semKey]
  const yearSlice = { ...(checklist?.[yearLevel] ?? {}) }
  yearSlice[submittedByKey] = submittedBy
  if (submittedBy !== "Other") {
    yearSlice[personKeys.name] = ""
    yearSlice[personKeys.relation] = ""
    yearSlice[personKeys.contact] = ""
  }
  return { ...checklist, [yearLevel]: yearSlice }
}

/**
 * @param {Record<string, unknown>} checklist
 * @param {string} yearLevel
 * @param {"first"|"second"} semKey
 * @param {"name"|"relation"|"contact"} field
 * @param {string} value
 */
export function updateRequirementSemOtherPersonField(checklist, yearLevel, semKey, field, value) {
  const personKeys = REQUIREMENT_SEM_OTHER_PERSON_KEY[semKey]
  const key = personKeys[field]
  if (!key) return checklist
  const storedValue = field === "contact" ? sanitizeContactNumber(value) : value
  const yearSlice = { ...(checklist?.[yearLevel] ?? {}), [key]: storedValue }
  return { ...checklist, [yearLevel]: yearSlice }
}

/** Preserve checklist metadata and normalize contact numbers before API save. */
export function sanitizeRequirementChecklistForSave(checklist) {
  if (!checklist || typeof checklist !== "object") return {}

  const out = {}
  for (const [yearLevel, slice] of Object.entries(checklist)) {
    if (!slice || typeof slice !== "object") continue
    const nextSlice = { ...slice }
    for (const semKey of ["first", "second"]) {
      for (const personKey of Object.values(REQUIREMENT_SEM_OTHER_PERSON_KEY[semKey])) {
        if (typeof nextSlice[personKey] === "string" && personKey.endsWith("Contact")) {
          nextSlice[personKey] = sanitizeContactNumber(nextSlice[personKey])
        }
      }
    }
    out[yearLevel] = nextSlice
  }
  return out
}

export function requirementSemCompletedAt(checklist, yearLevel, semKey) {
  const atKey = REQUIREMENT_SEM_COMPLETED_AT_KEY[semKey]
  const raw = checklist?.[yearLevel]?.[atKey]
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

export function requirementYearSemProgress(checklist, yearLevel, semKey, defs) {
  const bucket = checklist?.[yearLevel]?.[semKey] ?? {}
  const total = defs.length
  const done = defs.filter((d) => bucket[d.id] === true).length
  const isComplete = total > 0 && done === total
  return {
    total,
    done,
    isComplete,
    completedAt: isComplete ? requirementSemCompletedAt(checklist, yearLevel, semKey) : null,
  }
}

/**
 * Apply a single requirement checkbox change and set/clear semester completion timestamp.
 *
 * @param {Record<string, unknown>} checklist
 * @param {string} yearLevel
 * @param {"first"|"second"} semKey
 * @param {string} reqId
 * @param {boolean} checked
 * @param {RequirementDef[]} defs
 */
export function updateRequirementChecklistCheck(checklist, yearLevel, semKey, reqId, checked, defs) {
  const atKey = REQUIREMENT_SEM_COMPLETED_AT_KEY[semKey]
  const yearSlice = checklist?.[yearLevel] ?? {}
  const existingCompletedAt = requirementSemCompletedAt(checklist, yearLevel, semKey)
  const nextSem = { ...(yearSlice[semKey] ?? {}), [reqId]: checked }
  const nextYear = {
    ...yearSlice,
    [semKey]: nextSem,
  }
  const draft = { ...checklist, [yearLevel]: nextYear }
  const progress = requirementYearSemProgress(draft, yearLevel, semKey, defs)
  if (progress.isComplete) {
    nextYear[atKey] = existingCompletedAt ?? new Date().toISOString()
  } else if (existingCompletedAt) {
    nextYear[atKey] = existingCompletedAt
  }
  return { ...draft, [yearLevel]: nextYear }
}

/**
 * Ensures every fully-complete semester has a stored completion timestamp (does not overwrite existing).
 *
 * @param {Record<string, unknown>} checklist
 * @param {RequirementDef[]} defs
 * @param {string[]} yearLevels
 * @param {string} [fallbackIso] e.g. grantee lastUpdated when backfilling legacy complete rows
 */
export function ensureRequirementSemCompletionTimestamps(checklist, defs, yearLevels, fallbackIso) {
  const levels = [...new Set(yearLevels.map((s) => String(s ?? "").trim()).filter(Boolean))]
  if (levels.length === 0) return checklist ?? {}

  let fallback = new Date().toISOString()
  if (typeof fallbackIso === "string" && fallbackIso.trim()) {
    const trimmed = fallbackIso.trim()
    fallback = trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00.000Z`
  }

  const out = { ...checklist }
  for (const yl of levels) {
    const slice = out[yl]
    if (!slice || typeof slice !== "object") continue
    let nextSlice = { ...slice }

    for (const sem of ["first", "second"]) {
      const atKey = REQUIREMENT_SEM_COMPLETED_AT_KEY[sem]
      const draftForProgress = { ...out, [yl]: nextSlice }
      if (
        requirementYearSemProgress(draftForProgress, yl, sem, defs).isComplete &&
        !requirementSemCompletedAt(draftForProgress, yl, sem)
      ) {
        nextSlice = { ...nextSlice, [atKey]: fallback }
      }
    }

    out[yl] = nextSlice
  }

  return out
}

export function formatRequirementCompletedAt(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * "complete" if every (year level × semester) bucket has all requirements checked.
 * "incomplete" if any bucket is missing a checked item (or has zero defs — treated incomplete only if total>0 fails).
 * @param {unknown} row
 * @param {RequirementDef[]} defs
 * @param {string[]} yearLevels
 * @param {{ semesters?: ("first"|"second")[] }} [options] Defaults to both semesters.
 * @returns {"complete"|"incomplete"}
 */
export function requirementCoverageStatusForRow(row, defs, yearLevels, options) {
  const levels = [...new Set(yearLevels.map((s) => String(s ?? "").trim()).filter(Boolean))]
  if (levels.length === 0) return "complete"
  const semKeys =
    Array.isArray(options?.semesters) && options.semesters.length > 0
      ? options.semesters.filter((s) => s === "first" || s === "second")
      : ["first", "second"]
  const checklist = normalizeRequirementChecklistByYearSem(row, defs, levels)
  for (const yl of levels) {
    for (const sem of semKeys) {
      if (!requirementYearSemProgress(checklist, yl, sem, defs).isComplete) return "incomplete"
    }
  }
  return "complete"
}

export const REQUIREMENT_SEM_LABEL = {
  first: "1st semester",
  second: "2nd semester",
}
