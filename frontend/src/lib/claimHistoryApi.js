import apiClient from "@/lib/apiClient";

function toDateOnly(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Map a ClaimHistory document (with populated granteeId) to the cashier UI row shape. */
export function mapClaimHistoryFromApi(doc) {
  if (!doc || typeof doc !== "object") return null

  const grantee = doc.granteeId && typeof doc.granteeId === "object" ? doc.granteeId : {}
  const claimDate = toDateOnly(doc.claimedAt)
  const lastUpdated = toDateOnly(grantee.updatedAt) ?? claimDate

  return {
    id: String(doc._id ?? ""),
    claimDate,
    program: String(doc.program ?? "").trim().toUpperCase(),
    batchNo: String(doc.batchNo ?? "").trim(),
    seqNo: String(grantee.seqNo ?? "").trim(),
    studentId: String(doc.studentId ?? "").trim(),
    awardNumber: String(grantee.awardNumber ?? "").trim(),
    fullName: String(doc.fullName ?? "").trim(),
    enrolledProgram: String(grantee.enrolledProgram ?? "").trim(),
    currentYearLevel: String(grantee.yearLevel ?? "").trim(),
    yearLevel: String(doc.yearLevelOnClaim ?? "").trim(),
    semester: String(doc.semester ?? "").trim(),
    academicYear: String(doc.academicYear ?? "").trim(),
    grantCycle: String(grantee.grantCycle ?? "").trim(),
    claimedBy: String(doc.claimedBy ?? "Grantee").trim(),
    otherName: String(doc.otherName ?? "").trim(),
    claimedAt: doc.claimedAt ?? null,
    email: String(grantee.email ?? "").trim(),
    phoneNumber: String(grantee.phoneNumber ?? "").trim(),
    bankAccount: String(grantee.bankAccount ?? "").trim(),
    lastUpdated,
  }
}

export async function fetchClaimHistory(query = {}) {
  const { program, batchNo, academicYear, semester, claimedBy, search } = query

  const params = {}
  if (program) params.program = String(program).trim().toUpperCase()
  if (batchNo) params.batchNo = String(batchNo).trim()
  if (academicYear) params.academicYear = String(academicYear).trim()
  if (semester) params.semester = String(semester).trim()
  if (claimedBy) params.claimedBy = String(claimedBy).trim()
  if (search) params.search = String(search).trim()

  const response = await apiClient.get("/claim-history", { params })
  const data = response.data
  if (!Array.isArray(data)) return []
  return data.map(mapClaimHistoryFromApi).filter(Boolean)
}
