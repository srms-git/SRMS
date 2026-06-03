import { getApiClientBaseUrl } from "@/lib/apiConfig";

const API_BASE =
  getApiClientBaseUrl() ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "");

export function inferProgramFromRecord(row) {
  const direct = String(row?.program ?? "").trim().toUpperCase()
  if (direct) return direct

  const grantCycle = String(row?.grantCycle ?? "").trim().toUpperCase()
  if (grantCycle.startsWith("TES")) return "TES"
  if (grantCycle.startsWith("TDP")) return "TDP"

  const award = String(row?.awardNumber ?? "").trim().toUpperCase()
  if (award.startsWith("TES-")) return "TES"
  if (award.startsWith("TDP-")) return "TDP"

  return ""
}

/** True when a row belongs to the target scholarship program code. */
export function recordMatchesProgram(row, targetProgram) {
  const target = String(targetProgram ?? "").trim().toUpperCase()
  if (!target) return true

  const direct = String(row?.program ?? "").trim().toUpperCase()
  if (direct) return direct === target

  const inferred = inferProgramFromRecord(row)
  if (inferred) return inferred === target

  return false
}

export function filterGranteesByProgram(rows, targetProgram) {
  const target = String(targetProgram ?? "").trim().toUpperCase()
  if (!target) return rows ?? []
  return (rows ?? []).filter((row) => recordMatchesProgram(row, target))
}

/** Solid bar fills for program quantity scale (matches MAX_OS_GFA_PROGRAMS). */
export const PROGRAM_QUANTITY_BAR_COLORS = ["#1447a6", "#7c3aed", "#059669", "#0891b2", "#d97706"]

/**
 * Grantee counts per active program for dashboard quantity bars.
 * @param {Array} records Grantee rows
 * @param {Array<{ code?: string, name?: string, fullName?: string, active?: boolean, id?: string }>} programs Programs from OSGFA settings
 */
function countUniqueBatchesForProgram(records, programCode) {
  const keys = new Set()
  for (const row of records ?? []) {
    if (!recordMatchesProgram(row, programCode)) continue
    const batchNo = String(row?.batchNo ?? "").trim()
    const schoolYear = String(row?.academicYear ?? "").trim()
    if (!batchNo) continue
    keys.add(`${batchNo}|${programCode}|${schoolYear}`)
  }
  return keys.size
}

export function buildProgramQuantityBars(records, programs) {
  const activePrograms = (programs ?? []).filter((p) => p && p.active !== false && String(p.code ?? "").trim())
  const granteeTotal = records?.length ?? 0
  const scaleTotal = Math.max(granteeTotal, 1)

  return activePrograms.map((program, i) => {
    const code = String(program.code).trim().toUpperCase()
    let value = 0
    for (const row of records ?? []) {
      if (recordMatchesProgram(row, code)) value += 1
    }
    const name = String(program.name ?? code).trim() || code
    const fullName = String(program.fullName ?? "").trim()
    const batchCount = countUniqueBatchesForProgram(records, code)
    return {
      key: String(program.id ?? code),
      label: code,
      name,
      fullName: fullName && fullName !== name ? fullName : "",
      value,
      batchCount,
      width: (value / scaleTotal) * 100,
      percent: (value / scaleTotal) * 100,
      barColor: PROGRAM_QUANTITY_BAR_COLORS[i % PROGRAM_QUANTITY_BAR_COLORS.length],
    }
  })
}

export function programQuantityScaleSubtitle(programs) {
  const codes = (programs ?? [])
    .filter((p) => p && p.active !== false)
    .map((p) => String(p.code ?? "").trim().toUpperCase())
    .filter(Boolean)
  if (codes.length === 0) return "Grantee totals by program."
  if (codes.length === 1) return `Grantee total for ${codes[0]}.`
  if (codes.length <= 4) return `Visual comparison of ${codes.join(", ")} grantee totals.`
  return "Grantee totals across active programs."
}

export function mapGranteeFromApi(doc) {
  if (!doc || typeof doc !== "object") return null

  const program = String(doc.program ?? "").trim().toUpperCase() || inferProgramFromRecord(doc)
  const academicYear = String(doc.academicYear ?? "").trim()
  const grantCycle =
    String(doc.grantCycle ?? "").trim() ||
    (program && academicYear ? `${program} · AY ${academicYear}` : "")

  const updatedAt = doc.updatedAt ?? doc.lastUpdated
  let lastUpdated = ""
  if (updatedAt) {
    const d = new Date(updatedAt)
    if (!Number.isNaN(d.getTime())) {
      lastUpdated = d.toISOString().slice(0, 10)
    }
  }

  return {
    id: String(doc._id ?? doc.id ?? ""),
    program,
    seqNo: String(doc.seqNo ?? "").trim(),
    studentId: String(doc.studentId ?? "").trim(),
    awardNumber: String(doc.awardNumber ?? "").trim(),
    fullName: String(doc.fullName ?? "").trim() || "Unknown",
    batchNo: String(doc.batchNo ?? "").trim(),
    status: String(doc.status ?? "Unclaimed").trim() || "Unclaimed",
    enrolledProgram: String(doc.enrolledProgram ?? "").trim(),
    yearLevel: String(doc.yearLevel ?? "").trim(),
    email: String(doc.email ?? "").trim(),
    phoneNumber: String(doc.phoneNumber ?? "").trim(),
    bankAccount: String(doc.bankAccount ?? "").trim(),
    academicYear,
    grantCycle,
    lastUpdated,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
    semesterClaims: Array.isArray(doc.semesterClaims) ? doc.semesterClaims : undefined,
    requirementChecklistByYearSem:
      doc.requirementChecklistByYearSem && typeof doc.requirementChecklistByYearSem === "object"
        ? doc.requirementChecklistByYearSem
        : undefined,
  }
}

export function mapGranteeToApi(row) {
  const program =
    String(row?.program ?? "").trim().toUpperCase() || inferProgramFromRecord(row) || "TDP"
  return {
    program,
    batchNo: String(row?.batchNo ?? "").trim(),
    academicYear: String(row?.academicYear ?? "").trim(),
    seqNo: String(row?.seqNo ?? "").trim(),
    studentId: String(row?.studentId ?? "").trim(),
    awardNumber: String(row?.awardNumber ?? "").trim(),
    fullName: String(row?.fullName ?? "").trim() || "Unknown",
    enrolledProgram: String(row?.enrolledProgram ?? "").trim(),
    yearLevel: String(row?.yearLevel ?? "").trim(),
    status: String(row?.status ?? "Unclaimed").trim() || "Unclaimed",
    email: String(row?.email ?? "").trim(),
    phoneNumber: String(row?.phoneNumber ?? "").trim(),
    bankAccount: String(row?.bankAccount ?? "").trim(),
    grantCycle: String(row?.grantCycle ?? "").trim(),
    semesterClaims: Array.isArray(row?.semesterClaims) ? row.semesterClaims : [],
    requirementChecklistByYearSem:
      row?.requirementChecklistByYearSem && typeof row.requirementChecklistByYearSem === "object"
        ? row.requirementChecklistByYearSem
        : {},
  }
}

export async function fetchGranteesByProgram(program = "TDP") {
  const prog = String(program).trim().toUpperCase()
  const url = prog ? `${API_BASE}/grantees?program=${encodeURIComponent(prog)}` : `${API_BASE}/grantees`
  const response = await fetch(url)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || "Failed to load grantee records from the database.")
  }
  const data = await response.json()
  if (!Array.isArray(data)) return []
  const mapped = data.map(mapGranteeFromApi).filter(Boolean)
  return prog ? filterGranteesByProgram(mapped, prog) : mapped
}

export async function fetchAllGrantees() {
  return fetchGranteesByProgram("")
}

/** Unique batch cards derived from grantee rows (TES/TDP kept separate via program). */
export function buildBatchesFromGrantees(records) {
  const uniqueMap = new Map()

  for (const item of records ?? []) {
    const batchNo = String(item.batchNo ?? "").trim()
    const program = String(item.program ?? "").trim().toUpperCase()
    const schoolYear = String(item.academicYear ?? "").trim()
    if (!batchNo || !program) continue

    const key = `${batchNo}|${program}|${schoolYear}`
    const createdAt = item.createdAt || item.updatedAt || ""
    const existing = uniqueMap.get(key)

    if (!existing) {
      uniqueMap.set(key, { batchNo, program, schoolYear, createdAt })
      continue
    }

    if (createdAt && (!existing.createdAt || new Date(createdAt) > new Date(existing.createdAt))) {
      uniqueMap.set(key, { batchNo, program, schoolYear, createdAt })
    }
  }

  return Array.from(uniqueMap.values())
}

export function sortGranteesBySeqNo(rows) {
  return [...(rows ?? [])].sort((a, b) => {
    const seqA = String(a?.seqNo ?? "").trim()
    const seqB = String(b?.seqNo ?? "").trim()
    const numA = Number.parseInt(seqA.replace(/\D/g, ""), 10)
    const numB = Number.parseInt(seqB.replace(/\D/g, ""), 10)
    const validA = !Number.isNaN(numA)
    const validB = !Number.isNaN(numB)
    if (validA && validB && numA !== numB) return numA - numB
    if (validA && !validB) return -1
    if (!validA && validB) return 1
    const bySeq = seqA.localeCompare(seqB, undefined, { numeric: true })
    if (bySeq !== 0) return bySeq
    return String(a?.fullName ?? "").localeCompare(String(b?.fullName ?? ""))
  })
}

/** Client-side guard: batch + program + academic year must all match when provided. */
export function filterGranteesForBatch(rows, { batchNo, program, academicYear } = {}) {
  const batch = String(batchNo ?? "").trim()
  const prog = String(program ?? "").trim().toUpperCase()
  const year = String(academicYear ?? "").trim()

  return (rows ?? []).filter((row) => {
    if (batch && String(row?.batchNo ?? "").trim() !== batch) return false
    if (prog && !recordMatchesProgram(row, prog)) return false
    if (year && String(row?.academicYear ?? "").trim() !== year) return false
    return true
  })
}

export async function fetchGranteesForBatch({ program, batchNo, academicYear } = {}) {
  const params = new URLSearchParams()
  const prog = String(program ?? "").trim().toUpperCase()
  if (prog) params.set("program", prog)
  const batch = String(batchNo ?? "").trim()
  if (batch) params.set("batchNo", batch)
  const year = String(academicYear ?? "").trim()
  if (year) params.set("academicYear", year)

  const qs = params.toString()
  const url = `${API_BASE}/grantees${qs ? `?${qs}` : ""}`
  const response = await fetch(url)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || "Failed to load grantee records from the database.")
  }
  const data = await response.json()
  if (!Array.isArray(data)) return []
  const mapped = data.map(mapGranteeFromApi).filter(Boolean)
  const byProgram = prog ? filterGranteesByProgram(mapped, prog) : mapped
  const byBatch = filterGranteesForBatch(byProgram, { batchNo: batch, program: prog, academicYear: year })
  return sortGranteesBySeqNo(byBatch)
}

/** Distinct year-level colors (brand navy + modern accents) for donut charts */
const YEAR_LEVEL_DONUT_PALETTE = [
  { color: "#8b5cf6", colorFrom: "#7c3aed", colorTo: "#a78bfa" },
  { color: "#081F5C", colorFrom: "#04133d", colorTo: "#1447a6" },
  { color: "#2563eb", colorFrom: "#1d4ed8", colorTo: "#60a5fa" },
  { color: "#10b981", colorFrom: "#047857", colorTo: "#34d399" },
  { color: "#0891b2", colorFrom: "#0e7490", colorTo: "#22d3ee" },
]
const YEAR_LEVEL_ORDER = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"]
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function rowClaimDate(row) {
  const raw = row?.lastUpdated ?? row?.updatedAt ?? row?.createdAt
  if (!raw) return null
  const d = new Date(String(raw).includes("T") ? raw : `${raw}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function buildYearLevelDonut(rows) {
  const counts = new Map()
  for (const row of rows ?? []) {
    const yl = String(row?.yearLevel ?? "").trim()
    if (!yl) continue
    counts.set(yl, (counts.get(yl) ?? 0) + 1)
  }

  const paletteForIndex = (i) => YEAR_LEVEL_DONUT_PALETTE[i % YEAR_LEVEL_DONUT_PALETTE.length]

  const entries = YEAR_LEVEL_ORDER.filter((yl) => counts.has(yl)).map((name, i) => {
    const { color, colorFrom, colorTo } = paletteForIndex(i)
    return { name, value: counts.get(name), color, colorFrom, colorTo }
  })

  for (const [name, value] of counts) {
    if (!YEAR_LEVEL_ORDER.includes(name)) {
      const { color, colorFrom, colorTo } = paletteForIndex(entries.length)
      entries.push({ name, value, color, colorFrom, colorTo })
    }
  }

  return entries
}

export function buildMonthlyClaimTrend(rows) {
  const buckets = MONTH_LABELS.map((month) => ({ month, claimed: 0, unclaimed: 0 }))
  let hasDated = false

  for (const row of rows ?? []) {
    const d = rowClaimDate(row)
    if (!d) continue
    hasDated = true
    const bucket = buckets[d.getMonth()]
    if (row.status === "Claimed") bucket.claimed += 1
    else bucket.unclaimed += 1
  }

  if (!hasDated && rows?.length) {
    const bucket = buckets[new Date().getMonth()]
    for (const row of rows) {
      if (row.status === "Claimed") bucket.claimed += 1
      else bucket.unclaimed += 1
    }
  }

  return buckets
}

function latestBatchTimestamp(row) {
  const dateCandidates = [row?.createdAt, row?.updatedAt, row?.lastUpdated]
  let best = 0
  for (const value of dateCandidates) {
    if (!value) continue
    const parsed = Date.parse(String(value))
    if (Number.isNaN(parsed)) continue
    best = Math.max(best, parsed)
  }
  return best > 0 ? new Date(best).toISOString() : null
}

/** Latest batch cards for add-grantees sidebar (aligned with Batches page grouping). */
export function buildLatestBatchGranteeCards(records, limit = 8) {
  const grouped = new Map()

  for (const row of records ?? []) {
    const batchNo = String(row?.batchNo ?? "").trim()
    const program = String(row?.program ?? "").trim().toUpperCase() || inferProgramFromRecord(row)
    const schoolYear = String(row?.academicYear ?? "").trim()
    if (!batchNo || !program) continue

    const key = `${batchNo}|${program}|${schoolYear}`
    const current = grouped.get(key) ?? {
      batchNo,
      program,
      schoolYear,
      grantees: 0,
      addedAt: null,
    }
    current.grantees += 1

    const rowAddedAt = latestBatchTimestamp(row)
    if (rowAddedAt) {
      const rowTs = Date.parse(rowAddedAt)
      const currentTs = current.addedAt ? Date.parse(current.addedAt) : 0
      if (!current.addedAt || rowTs > currentTs) {
        current.addedAt = rowAddedAt
      }
    }

    grouped.set(key, current)
  }

  const rows = [...grouped.values()]
  rows.sort((a, b) => {
    const tA = a.addedAt ? Date.parse(a.addedAt) : 0
    const tB = b.addedAt ? Date.parse(b.addedAt) : 0
    if (tB !== tA) return tB - tA
    const yearA = String(a.schoolYear ?? "").trim()
    const yearB = String(b.schoolYear ?? "").trim()
    if (yearB !== yearA) return yearB.localeCompare(yearA)
    const numA = Number.parseFloat(String(a.batchNo))
    const numB = Number.parseFloat(String(b.batchNo))
    const hasNumA = Number.isFinite(numA)
    const hasNumB = Number.isFinite(numB)
    if (hasNumA && hasNumB && numB !== numA) return numB - numA
    if (hasNumA && !hasNumB) return -1
    if (!hasNumA && hasNumB) return 1
    const progCmp = String(a.program).localeCompare(String(b.program))
    if (progCmp !== 0) return progCmp
    return String(b.batchNo).localeCompare(String(a.batchNo))
  })

  return rows.slice(0, limit)
}

export async function updateBatchMetadata({
  originalBatchNo,
  originalProgram,
  originalAcademicYear,
  newBatchNo,
  newProgram,
  newAcademicYear,
}) {
  const response = await fetch(`${API_BASE}/grantees/batch-update`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      originalBatchNo,
      originalProgram,
      originalAcademicYear,
      newBatchNo,
      newProgram,
      newAcademicYear,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    let message = data.message || "Failed to update batch details."
    if (response.status === 404 && !data.message) {
      message = "Batch update is unavailable. Restart the backend server and try again."
    }
    const err = new Error(message)
    err.code = data.code
    err.status = response.status
    throw err
  }
  return data
}

/** True when another batch already uses the same batch number within the same program. */
export function batchNumberConflictsInProgram(records, { batchNo, program, excludeBatch } = {}) {
  const targetBatchNo = String(batchNo ?? "").trim()
  const targetProgram = String(program ?? "").trim().toUpperCase()
  if (!targetBatchNo || !targetProgram) return false

  const excludeBatchNo = String(excludeBatch?.batchNo ?? "").trim()
  const excludeProgram = String(excludeBatch?.program ?? "").trim().toUpperCase()
  const excludeYear = String(excludeBatch?.academicYear ?? excludeBatch?.schoolYear ?? "").trim()

  const seen = new Set()
  for (const row of records ?? []) {
    const rowBatchNo = String(row?.batchNo ?? "").trim()
    const rowProgram = String(row?.program ?? "").trim().toUpperCase() || inferProgramFromRecord(row)
    const rowYear = String(row?.academicYear ?? "").trim()
    if (!rowBatchNo || !rowProgram) continue

    const key = `${rowBatchNo}|${rowProgram}|${rowYear}`
    if (seen.has(key)) continue
    seen.add(key)

    if (rowBatchNo !== targetBatchNo || rowProgram !== targetProgram) continue
    if (
      excludeBatchNo &&
      excludeProgram &&
      rowBatchNo === excludeBatchNo &&
      rowProgram === excludeProgram &&
      rowYear === excludeYear
    ) {
      continue
    }
    return true
  }
  return false
}

export async function batchSaveGrantees({ program, batchNo, academicYear, granteeRows }) {
  const response = await fetch(`${API_BASE}/grantees/batch-save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ program, batchNo, academicYear, granteeRows }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || "Failed to save grantee batch to the database.")
  }
  return data
}

export async function updateGrantee(id, row) {
  const granteeId = String(id ?? "").trim()
  if (!granteeId) {
    throw new Error("Cannot update grantee: missing database id.")
  }
  const response = await fetch(`${API_BASE}/grantees/${encodeURIComponent(granteeId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapGranteeToApi(row)),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || "Failed to save grantee changes to the database.")
  }
  return mapGranteeFromApi(data)
}
