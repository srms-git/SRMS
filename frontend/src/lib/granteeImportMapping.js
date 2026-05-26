export function normalizeHeaderKey(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[#._]/g, " ")
    .replace(/\s+/g, " ")
}

/** Map a loose spreadsheet / table header to a canonical field name. */
export function canonicalFieldForHeader(headerNorm) {
  if (!headerNorm) return null
  const tests = [
    { field: "seqNo", patterns: ["seq no", "seqno", "sequence no", "sequence", "seq #", "seq"] },
    { field: "studentId", patterns: ["student id", "studentid", "stud id", "id number", "school id"] },
    { field: "fullName", patterns: ["full name", "fullname", "name", "grantee", "student name", "scholar name"] },
    { field: "awardNumber", patterns: ["award number", "award no", "award", "control no", "reference"] },
    { field: "enrolledProgram", patterns: ["enrolled program", "course", "degree", "program of study", "curriculum", "strand"] },
    { field: "yearLevel", patterns: ["year level", "yearlevel", "yr level", "level"] },
    { field: "status", patterns: ["status", "claim status"] },
    { field: "batchNo", patterns: ["batch no", "batch number", "batchno"] },
    { field: "program", patterns: ["scholarship program", "grant program", "program type", "tes tdp", "grant type"] },
  ]
  for (const { field, patterns } of tests) {
    for (const p of patterns) {
      if (headerNorm === p || headerNorm.includes(p) || p.includes(headerNorm)) {
        return field
      }
    }
  }
  return null
}

export function mapSheetRowToGranteeShape(rawRow) {
  const out = {}
  for (const [rawKey, value] of Object.entries(rawRow ?? {})) {
    const canon = canonicalFieldForHeader(normalizeHeaderKey(rawKey))
    if (!canon) continue
    const str = value === null || value === undefined ? "" : String(value).trim()
    if (!str && out[canon]) continue
    out[canon] = str
  }
  return out
}
