export const PROGRAMS_STORAGE_KEY = "srmsOsgfaPrograms"
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
  },
]

function slugFromCode(code) {
  return String(code ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeProgram(raw) {
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
    id: String(raw?.id ?? slug).trim() || slug,
    slug,
    code,
    name,
    fullName,
    description,
    requirements,
    builtIn: Boolean(raw?.builtIn),
  }
}

export function readStoredPrograms() {
  const raw = localStorage.getItem(PROGRAMS_STORAGE_KEY)
  if (!raw) return DEFAULT_PROGRAMS.map(normalizeProgram)
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PROGRAMS.map(normalizeProgram)
    }
    return parsed.slice(0, MAX_OS_GFA_PROGRAMS).map(normalizeProgram)
  } catch {
    return DEFAULT_PROGRAMS.map(normalizeProgram)
  }
}

export function writeStoredPrograms(programs) {
  const normalized = programs.slice(0, MAX_OS_GFA_PROGRAMS).map(normalizeProgram)
  localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(OSGFA_PROGRAMS_CHANGED_EVENT))
}

export function findProgramBySlug(slug) {
  const key = String(slug ?? "").trim().toLowerCase()
  if (!key) return null
  return readStoredPrograms().find((p) => p.slug === key) ?? null
}

export function findProgramByCode(code) {
  const key = String(code ?? "").trim().toUpperCase()
  if (!key) return null
  return readStoredPrograms().find((p) => p.code === key) ?? null
}

export function programRoutePath(program) {
  return `/osgfa/programs/${program.slug}`
}

/**
 * @param {{ code: string, name: string, fullName?: string, description?: string }} input
 * @returns {{ ok: true, program: object } | { ok: false, error: string }}
 */
export function addProgram(input) {
  const programs = readStoredPrograms()
  if (programs.length >= MAX_OS_GFA_PROGRAMS) {
    return { ok: false, error: `You can add up to ${MAX_OS_GFA_PROGRAMS} programs. Remove or archive programs later when the limit is raised.` }
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
  if (programs.some((p) => p.code === code)) {
    return { ok: false, error: `A program with code "${code}" already exists.` }
  }

  const slug = slugFromCode(code)
  if (!slug) {
    return { ok: false, error: "Could not derive a valid URL slug from the program code." }
  }
  if (programs.some((p) => p.slug === slug)) {
    return { ok: false, error: `A program with slug "${slug}" already exists.` }
  }

  const program = normalizeProgram({
    id: slug,
    slug,
    code,
    name,
    fullName,
    description: description || `${fullName} — program workspace.`,
    requirements: DEFAULT_GRANTEE_REQUIREMENTS,
    builtIn: false,
  })

  writeStoredPrograms([...programs, program])
  return { ok: true, program }
}
