import { getApiClientBaseUrl } from "@/lib/apiConfig";

const API_BASE =
  getApiClientBaseUrl() ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "");

export function mapArchivedBatchFromApi(doc) {
  if (!doc || typeof doc !== "object") return null

  return {
    id: doc._id,
    batchNo: String(doc.batchNo ?? "").trim(),
    schoolYear: String(doc.schoolYear ?? "").trim(),
    program: String(doc.program ?? doc.grantType ?? "").trim().toUpperCase(),
    totalGrantees: Number(doc.totalGrantees) || 0,
    fullyClaimedAt: doc.fullyClaimedAt ?? null,
    archivedAt: doc.archivedAt ?? doc.createdAt ?? null,
  }
}

export async function fetchArchivedBatches() {
  const response = await fetch(`${API_BASE}/archive/list`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || "Failed to load archived batches.")
  }
  const data = await response.json()
  if (!Array.isArray(data)) return []
  return data.map(mapArchivedBatchFromApi).filter(Boolean)
}

export async function fetchArchivedBatchDetail({ batchNo, program, academicYear }) {
  const params = new URLSearchParams()
  const batch = String(batchNo ?? "").trim()
  const prog = String(program ?? "").trim().toUpperCase()
  const year = String(academicYear ?? "").trim()
  if (batch) params.set("batchNo", batch)
  if (prog) params.set("program", prog)
  if (year) params.set("academicYear", year)

  const response = await fetch(`${API_BASE}/archive/detail?${params.toString()}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || "Failed to load archived batch details.")
  }
  return response.json()
}
