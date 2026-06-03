import { recordMatchesProgram } from "@/lib/granteesApi"
import { requirementCoverageStatusForRow } from "@/lib/granteeRequirementsChecklist"

const TES_GRANTEE_REQUIREMENTS = [
  { id: "cor", label: "Certificate of Registration (COR) for the current semester" },
  { id: "rog", label: "Official report of grades from the previous semester" },
  {
    id: "scholarship_disclosure",
    label: "Disclosure or certificate regarding other scholarships or financial assistance, if required",
  },
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

export const REQUIREMENTS_SCALE_FILTER_ALL = "__all__"
export const REQUIREMENTS_SEM_FILTER_ALL = "__all__"
export const REQUIREMENTS_SEM_FILTER_FIRST = "first"
export const REQUIREMENTS_SEM_FILTER_SECOND = "second"

const INCOMPLETE_SWATCH = "#dc2626"

export function yearLevelsForRow(row) {
  if (Array.isArray(row?.semesterClaims) && row.semesterClaims.length > 0) {
    return [...new Set(row.semesterClaims.map((c) => String(c.yearLevel ?? "").trim()).filter(Boolean))]
  }
  const yl = String(row?.yearLevel ?? "").trim()
  if (yl) return [yl]
  return []
}

export function requirementDefsForRow(row) {
  return recordMatchesProgram(row, "TDP") || String(row?.program ?? "").toUpperCase() === "TDP"
    ? TDP_GRANTEE_REQUIREMENTS
    : TES_GRANTEE_REQUIREMENTS
}

function semestersForFilter(semesterFilter) {
  if (semesterFilter === REQUIREMENTS_SEM_FILTER_FIRST) return ["first"]
  if (semesterFilter === REQUIREMENTS_SEM_FILTER_SECOND) return ["second"]
  return ["first", "second"]
}

/**
 * @param {Array} records
 * @param {{ programFilter?: string, semesterFilter?: string }} filters
 */
export function buildRequirementsCompletionBars(records, { programFilter, semesterFilter } = {}) {
  const prog = String(programFilter ?? REQUIREMENTS_SCALE_FILTER_ALL).trim()
  const semKeys = semestersForFilter(semesterFilter)

  let complete = 0
  let incomplete = 0

  for (const row of records ?? []) {
    if (prog !== REQUIREMENTS_SCALE_FILTER_ALL && !recordMatchesProgram(row, prog)) continue

    const levels = yearLevelsForRow(row)
    const defs = requirementDefsForRow(row)
    if (levels.length === 0) {
      incomplete += 1
      continue
    }
    const status = requirementCoverageStatusForRow(row, defs, levels, { semesters: semKeys })
    if (status === "complete") complete += 1
    else incomplete += 1
  }

  const total = Math.max(complete + incomplete, 1)
  return [
    {
      key: "complete",
      label: "Complete requirements",
      chartLabel: "Complete",
      value: complete,
      percent: (complete / total) * 100,
      swatchColor: "#10b981",
    },
    {
      key: "incomplete",
      label: "Incomplete requirements",
      chartLabel: "Incomplete",
      value: incomplete,
      percent: (incomplete / total) * 100,
      swatchColor: INCOMPLETE_SWATCH,
    },
  ]
}

export function requirementsCompletionSubtitle({ programFilter, semesterFilter, activePrograms }) {
  const prog = String(programFilter ?? REQUIREMENTS_SCALE_FILTER_ALL).trim()
  const sem = String(semesterFilter ?? REQUIREMENTS_SEM_FILTER_ALL).trim()

  let programPart = "all programs"
  if (prog !== REQUIREMENTS_SCALE_FILTER_ALL) {
    const match = (activePrograms ?? []).find((p) => String(p.code ?? "").trim().toUpperCase() === prog)
    programPart = match?.name ? `${match.name} (${prog})` : prog
  }

  let semesterPart = "both semesters"
  if (sem === REQUIREMENTS_SEM_FILTER_FIRST) semesterPart = "1st semester"
  else if (sem === REQUIREMENTS_SEM_FILTER_SECOND) semesterPart = "2nd semester"

  return `Complete and incomplete requirements for ${programPart}, ${semesterPart}.`
}
