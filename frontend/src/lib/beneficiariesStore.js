const BENEFICIARIES_STORAGE_KEY = "srms-beneficiaries-records-v1"

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function dedupeBySeqNo(records) {
  const map = new Map()
  for (const row of records) {
    if (!row || !row.seqNo) continue
    map.set(String(row.seqNo), row)
  }
  return [...map.values()]
}

export function loadMergedBeneficiaryRecords(fallbackRecords = []) {
  if (!canUseStorage()) return fallbackRecords
  try {
    const raw = window.localStorage.getItem(BENEFICIARIES_STORAGE_KEY)
    if (!raw) return fallbackRecords
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return fallbackRecords
    return dedupeBySeqNo([...fallbackRecords, ...parsed])
  } catch {
    return fallbackRecords
  }
}

export function saveBeneficiaryRecords(records) {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(BENEFICIARIES_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // ignore storage failures
  }
}

export function appendBeneficiaryRecord(record) {
  if (!canUseStorage()) return
  const existing = loadMergedBeneficiaryRecords([])
  const next = dedupeBySeqNo([...existing, record])
  saveBeneficiaryRecords(next)
}
