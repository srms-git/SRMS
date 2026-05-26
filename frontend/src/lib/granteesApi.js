const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

export function inferProgramFromRecord(row) {
  const direct = String(row?.program ?? "").trim().toUpperCase()
  if (direct === "TES" || direct === "TDP") return direct

  const grantCycle = String(row?.grantCycle ?? "").trim().toUpperCase()
  if (grantCycle.startsWith("TES")) return "TES"
  if (grantCycle.startsWith("TDP")) return "TDP"

  const award = String(row?.awardNumber ?? "").trim().toUpperCase()
  if (award.startsWith("TES-")) return "TES"
  if (award.startsWith("TDP-")) return "TDP"

  return ""
}

/** True when a row belongs to TES or TDP (used to keep modules separated). */
export function recordMatchesProgram(row, targetProgram) {
  const target = String(targetProgram ?? "").trim().toUpperCase()
  if (!target) return true

  const direct = String(row?.program ?? "").trim().toUpperCase()
  if (direct === "TES" || direct === "TDP") {
    return direct === target
  }

  const inferred = inferProgramFromRecord(row)
  if (inferred === "TES" || inferred === "TDP") {
    return inferred === target
  }

  return false
}

export function filterGranteesByProgram(rows, targetProgram) {
  const target = String(targetProgram ?? "").trim().toUpperCase()
  if (!target) return rows ?? []
  return (rows ?? []).filter((row) => recordMatchesProgram(row, target))
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

const YEAR_LEVEL_CHART_COLORS = ["#04133d", "#081F5C", "#1447a6", "#3b82f6", "#60a5fa"]
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

  const entries = YEAR_LEVEL_ORDER.filter((yl) => counts.has(yl)).map((name, i) => ({
    name,
    value: counts.get(name),
    color: YEAR_LEVEL_CHART_COLORS[i % YEAR_LEVEL_CHART_COLORS.length],
  }))

  for (const [name, value] of counts) {
    if (!YEAR_LEVEL_ORDER.includes(name)) {
      entries.push({
        name,
        value,
        color: YEAR_LEVEL_CHART_COLORS[entries.length % YEAR_LEVEL_CHART_COLORS.length],
      })
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

/** Latest batch+program cards for add-grantees sidebar (newest first, no mock padding). */
export function buildLatestBatchGranteeCards(records, limit = 8) {
  const grouped = new Map()

  for (const row of records ?? []) {
    const batchNo = String(row?.batchNo ?? "").trim()
    if (!batchNo) continue

    const program = String(row?.program ?? "").trim().toUpperCase() || inferProgramFromRecord(row)
    if (program !== "TES" && program !== "TDP") continue

    const key = `${batchNo}|${program}`
    const current = grouped.get(key) ?? {
      batchNo,
      program,
      grantees: 0,
      schoolYear: "",
      addedAt: null,
    }
    current.grantees += 1

    const dateCandidates = [row?.createdAt, row?.updatedAt, row?.lastUpdated]
    for (const value of dateCandidates) {
      if (!value) continue
      const parsed = Date.parse(String(value))
      if (Number.isNaN(parsed)) continue
      const iso = new Date(parsed).toISOString()
      if (!current.addedAt || Date.parse(iso) > Date.parse(current.addedAt)) {
        current.addedAt = iso
        const ay = String(row?.academicYear ?? "").trim()
        if (ay) current.schoolYear = ay
      }
      break
    }

    if (!current.schoolYear) {
      const ay = String(row?.academicYear ?? "").trim()
      if (ay) current.schoolYear = ay
    }

    grouped.set(key, current)
  }

  const rows = [...grouped.values()]
  rows.sort((a, b) => {
    const tA = a.addedAt ? Date.parse(a.addedAt) : 0
    const tB = b.addedAt ? Date.parse(b.addedAt) : 0
    if (tB !== tA) return tB - tA
    const numA = Number.parseFloat(String(a.batchNo))
    const numB = Number.parseFloat(String(b.batchNo))
    const hasNumA = Number.isFinite(numA)
    const hasNumB = Number.isFinite(numB)
    if (hasNumA && hasNumB && numB !== numA) return numB - numA
    if (hasNumA && !hasNumB) return -1
    if (!hasNumA && hasNumB) return 1
    const progOrder = (p) => (p === "TES" ? 0 : p === "TDP" ? 1 : 2)
    const po = progOrder(a.program) - progOrder(b.program)
    if (po !== 0) return po
    return String(b.batchNo).localeCompare(String(a.batchNo))
  })

  return rows.slice(0, limit)
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
