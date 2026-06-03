import apiClient from "@/lib/apiClient"

export const OSGFA_PROGRAMS_CHANGED_EVENT = "srms-osgfa-programs-changed"
export const MAX_OS_GFA_PROGRAMS = 5

const TES_REQUIREMENTS = [
  { id: "cor", label: "Certificate of Registration (COR) for the current semester" },
  { id: "rog", label: "Official report of grades from the previous semester" },
  {
    id: "scholarship_disclosure",
    label: "Disclosure or certificate regarding other scholarships or financial assistance, if required",
  },
  { id: "id_email", label: "Valid school ID and updated school email on file" },
  { id: "acknowledgment", label: "Signed TES acknowledgment and parent/guardian consent, where applicable" },
]

const TDP_REQUIREMENTS = [
  { id: "cor", label: "Certificate of Registration (COR) for the current semester" },
  { id: "rog", label: "Official report of grades or class cards from the previous semester" },
  { id: "school_id", label: "Valid school ID (photocopy with registrar or authorized certification)" },
  {
    id: "indigency",
    label: "Certificate of indigency or other authorized proof of economic status, if applicable",
  },
  { id: "undertaking", label: "Signed TDP undertaking or parent/guardian consent form" },
]

/** Default checklist for newly added programs (generic scholarship requirements). */
export const DEFAULT_GRANTEE_REQUIREMENTS = [
  { id: "cor", label: "Certificate of Registration (COR) for the current semester" },
  { id: "rog", label: "Official report of grades from the previous semester" },
  { id: "school_id", label: "Valid school ID on file" },
  { id: "consent", label: "Signed program acknowledgment or parent/guardian consent, where applicable" },
]

export const DEFAULT_PROGRAMS = [
  {
    id: "tes",
    slug: "tes",
    code: "TES",
    name: "TES",
    fullName: "Tertiary Education Subsidy",
    description: "Tertiary Education Subsidy — program workspace.",
    requirements: TES_REQUIREMENTS,
    builtIn: true,
    active: true,
  },
  {
    id: "tdp",
    slug: "tdp",
    code: "TDP",
    name: "TDP",
    fullName: "Tulong Dunong Program",
    description: "Tulong Dunong Program — program workspace.",
    requirements: TDP_REQUIREMENTS,
    builtIn: true,
    active: true,
  },
]

let programsCache = DEFAULT_PROGRAMS.map(normalizeProgram)

export function slugFromCode(code) {
  return String(code ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function normalizeProgram(raw) {
  const mongoId = raw?._id != null ? String(raw._id) : ""
  const code = String(raw?.code ?? "").trim().toUpperCase()
  const slug = String(raw?.slug ?? slugFromCode(code)).trim().toLowerCase()
  const name = String(raw?.name ?? code).trim() || code
  const fullName = String(raw?.fullName ?? name).trim() || name
  const description =
    String(raw?.description ?? "").trim() || `${fullName} — program workspace.`
  const requirements = Array.isArray(raw?.requirements) && raw.requirements.length > 0
    ? raw.requirements.map((r) => ({
        id: String(r?.id ?? "").trim(),
        label: String(r?.label ?? "").trim(),
      })).filter((r) => r.id && r.label)
    : DEFAULT_GRANTEE_REQUIREMENTS

  return {
    id: mongoId || String(raw?.id ?? slug).trim() || slug,
    slug,
    code,
    name,
    fullName,
    description,
    requirements,
    builtIn: Boolean(raw?.builtIn),
    active: raw?.active !== false,
  }
}

function notifyProgramsChanged() {
  window.dispatchEvent(new CustomEvent(OSGFA_PROGRAMS_CHANGED_EVENT))
}

export function getCachedPrograms() {
  return programsCache
}

export function setCachedPrograms(programs) {
  programsCache = programs.map(normalizeProgram)
  notifyProgramsChanged()
}

export function findProgramBySlug(slug) {
  const key = String(slug ?? "").trim().toLowerCase()
  if (!key) return null
  return getCachedPrograms().find((p) => p.slug === key) ?? null
}

export function findProgramByCode(code) {
  const key = String(code ?? "").trim().toUpperCase()
  if (!key) return null
  return getCachedPrograms().find((p) => p.code === key) ?? null
}

/** Checklist definitions used in view/edit record and batch screens for a program code. */
export function getRequirementsForProgramCode(code) {
  const program = findProgramByCode(code)
  if (program?.requirements?.length) return program.requirements
  const upper = String(code ?? "").trim().toUpperCase()
  const fallback = DEFAULT_PROGRAMS.find((p) => p.code === upper)
  return fallback?.requirements ?? DEFAULT_GRANTEE_REQUIREMENTS
}

export function requirementIdFromLabel(label, usedIds = new Set()) {
  let base = String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
  if (!base || !/^[a-z]/.test(base)) base = `req_${base || "item"}`.replace(/^_+/, "")
  let id = base
  let suffix = 2
  while (usedIds.has(id)) {
    id = `${base}_${suffix}`
    suffix += 1
  }
  return id
}

export function normalizeRequirementDraftRows(rows) {
  const used = new Set()
  const normalized = []
  for (const row of rows ?? []) {
    const label = String(row?.label ?? "").trim()
    if (!label) continue
    let id = String(row?.id ?? "").trim().toLowerCase()
    if (!id || !/^[a-z][a-z0-9_]{0,31}$/.test(id)) {
      id = requirementIdFromLabel(label, used)
    }
    if (used.has(id)) continue
    used.add(id)
    normalized.push({ id, label })
  }
  return normalized
}

export function validateProgramRequirements(requirements) {
  const list = normalizeRequirementDraftRows(requirements)
  if (list.length === 0) {
    return { ok: false, error: "Add at least one requirement item." }
  }
  if (list.length > 12) {
    return { ok: false, error: "You can add up to 12 requirement items per program." }
  }
  return { ok: true, requirements: list }
}

/** Set of uppercase program codes that are currently enabled in OSGFA. */
export function buildActiveProgramCodeSet(programs = getCachedPrograms()) {
  return new Set(
    programs
      .filter((program) => program.active !== false)
      .map((program) => String(program.code ?? "").trim().toUpperCase())
      .filter(Boolean),
  )
}

/** Unknown codes (not in the program list) are treated as active for backward compatibility. */
export function isActiveProgramCode(code, programs = getCachedPrograms()) {
  const normalized = String(code ?? "").trim().toUpperCase()
  if (!normalized) return false
  const match = programs.find(
    (program) => String(program.code ?? "").trim().toUpperCase() === normalized,
  )
  if (!match) return true
  return match.active !== false
}

export function filterRowsByActiveProgram(rows, programs = getCachedPrograms(), programField = "program") {
  const activeCodes = buildActiveProgramCodeSet(programs)
  return (rows ?? []).filter((row) => {
    const code = String(row?.[programField] ?? "").trim().toUpperCase()
    return code && activeCodes.has(code)
  })
}

export function programRoutePath(program) {
  return `/osgfa/programs/${program.slug}`
}

function extractErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message
    ?? error?.response?.data?.error
    ?? error?.message
    ?? fallback
  )
}

export async function fetchProgramsFromApi() {
  const response = await apiClient.get("/programs")
  const list = Array.isArray(response.data) ? response.data : []
  const normalized = list.map(normalizeProgram)
  setCachedPrograms(normalized.length > 0 ? normalized : DEFAULT_PROGRAMS)
  return getCachedPrograms()
}

/**
 * @param {{ code: string, name: string, fullName?: string, description?: string }} input
 * @returns {Promise<{ ok: true, program: object } | { ok: false, error: string }>}
 */
export async function createProgramViaApi(input) {
  const programs = getCachedPrograms()
  if (programs.length >= MAX_OS_GFA_PROGRAMS) {
    return {
      ok: false,
      error: `You can add up to ${MAX_OS_GFA_PROGRAMS} programs. Deactivate unused programs or raise the limit later.`,
    }
  }

  const code = String(input?.code ?? "").trim().toUpperCase()
  const name = String(input?.name ?? "").trim()
  const fullName = String(input?.fullName ?? name).trim() || name
  const description = String(input?.description ?? "").trim()

  if (!/^[A-Z0-9]{2,12}$/.test(code)) {
    return { ok: false, error: "Program code must be 2–12 letters or numbers (e.g. TES, TDP)." }
  }
  if (!name) {
    return { ok: false, error: "Program name is required." }
  }

  try {
    const response = await apiClient.post("/programs", {
      code,
      name,
      fullName,
      description,
      requirements: DEFAULT_GRANTEE_REQUIREMENTS,
    })
    const program = normalizeProgram(response.data)
    setCachedPrograms([...getCachedPrograms(), program])
    return { ok: true, program }
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error, "Failed to save program.") }
  }
}

function applyProgramPatchToCache(program) {
  setCachedPrograms(
    getCachedPrograms().map((item) => (item.id === program.id ? program : item)),
  )
}

/**
 * @param {string} programId
 * @param {{ active?: boolean, name?: string, fullName?: string, description?: string }} patch
 * @returns {Promise<{ ok: true, program: object } | { ok: false, error: string }>}
 */
export async function updateProgramViaApi(programId, patch) {
  const id = String(programId ?? "").trim()
  if (!id) {
    return { ok: false, error: "Program id is missing." }
  }

  const body = {}
  if (typeof patch?.active === "boolean") body.active = patch.active
  if (patch?.name != null) body.name = String(patch.name).trim()
  if (patch?.fullName != null) body.fullName = String(patch.fullName).trim()
  if (patch?.description != null) body.description = String(patch.description).trim()
  if (patch?.code != null) body.code = String(patch.code).trim().toUpperCase()
  if (patch?.slug != null) body.slug = String(patch.slug).trim().toLowerCase()
  if (patch?.requirements != null) body.requirements = patch.requirements

  if (Object.keys(body).length === 0) {
    return { ok: false, error: "No changes to save." }
  }

  try {
    const response = await apiClient.patch(`/programs/${id}`, body)
    const program = normalizeProgram(response.data)
    applyProgramPatchToCache(program)
    const migrated = response.data?.migrated ?? null
    return { ok: true, program: migrated ? { ...program, migrated } : program }
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error, "Failed to update program.") }
  }
}

/**
 * @param {string} programId
 * @param {boolean} active
 * @returns {Promise<{ ok: true, program: object } | { ok: false, error: string }>}
 */
export async function setProgramActiveViaApi(programId, active) {
  return updateProgramViaApi(programId, { active })
}

/**
 * @param {string} programId
 * @param {{ name: string, fullName?: string, description?: string }} input
 */
export async function renameProgramViaApi(programId, input) {
  const code = String(input?.name ?? "").trim().toUpperCase()
  const name = code
  const fullName = String(input?.fullName ?? "").trim() || name
  const description = String(input?.description ?? "").trim()
  const slug = slugFromCode(code)

  if (!code) {
    return { ok: false, error: "Program name is required." }
  }
  if (!/^[A-Z0-9]{2,12}$/.test(code)) {
    return { ok: false, error: "Program name must be 2–12 letters or numbers (e.g. TES, TDP)." }
  }
  if (!slug) {
    return { ok: false, error: "Could not derive a valid URL slug from the program name." }
  }
  if (!fullName) {
    return { ok: false, error: "Full name is required." }
  }

  return updateProgramViaApi(programId, {
    name,
    fullName,
    description,
    code,
    slug,
  })
}

/**
 * @param {string} programId
 * @param {Array<{ id?: string, label: string }>} requirements
 */
export async function updateProgramRequirementsViaApi(programId, requirements) {
  const validation = validateProgramRequirements(requirements)
  if (!validation.ok) {
    return { ok: false, error: validation.error }
  }
  return updateProgramViaApi(programId, { requirements: validation.requirements })
}
