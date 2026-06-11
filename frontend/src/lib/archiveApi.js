import apiClient from "@/lib/apiClient";

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
  const response = await apiClient.get("/archive/list")
  const data = response.data
  if (!Array.isArray(data)) return []
  return data.map(mapArchivedBatchFromApi).filter(Boolean)
}

export async function manualArchiveBatch({ batchNo, program, academicYear }) {
  const response = await apiClient.post("/archive/manual", {
    batchNo: String(batchNo ?? "").trim(),
    program: String(program ?? "").trim().toUpperCase(),
    academicYear: String(academicYear ?? "").trim(),
  })
  return response.data
}

export async function fetchArchivedBatchDetail({ batchNo, program, academicYear }) {
  const batch = String(batchNo ?? "").trim()
  const prog = String(program ?? "").trim().toUpperCase()
  const year = String(academicYear ?? "").trim()
  const params = {}
  if (batch) params.batchNo = batch
  if (prog) params.program = prog
  if (year) params.academicYear = year

  const response = await apiClient.get("/archive/detail", { params })
  return response.data
}
