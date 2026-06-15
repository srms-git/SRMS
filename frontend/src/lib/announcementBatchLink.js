import { isAnnouncementVisibleOnLanding, resolveAnnouncementDates } from "@/lib/announcementDates"

export const BATCH_LINKED_ANNOUNCEMENT_TYPES = new Set(["payout_schedule", "requirement_schedule"])

export function isBatchLinkedAnnouncementType(type) {
  return BATCH_LINKED_ANNOUNCEMENT_TYPES.has(String(type ?? "").toLowerCase())
}

export function isPayoutScheduleAnnouncementType(type) {
  return String(type ?? "").toLowerCase() === "payout_schedule"
}

export function getLinkedBatchKey(record) {
  const batchNo = String(record?.linkedBatchNo ?? "").trim()
  const program = String(record?.linkedProgram ?? "").trim().toUpperCase()
  const academicYear = String(record?.linkedAcademicYear ?? "").trim()
  if (!batchNo || !program || !academicYear) return ""
  return `${batchNo}|${program}|${academicYear}`
}

export function getOperationalBatchKey(batch) {
  const batchNo = String(batch?.batchNo ?? "").trim()
  const program = String(batch?.program ?? "").trim().toUpperCase()
  const academicYear = String(batch?.schoolYear ?? batch?.academicYear ?? "").trim()
  if (!batchNo || !program || !academicYear) return ""
  return `${batchNo}|${program}|${academicYear}`
}

export function formatLinkedBatchLabel(record) {
  const batchNo = String(record?.linkedBatchNo ?? "").trim()
  const program = String(record?.linkedProgram ?? "").trim().toUpperCase()
  const academicYear = String(record?.linkedAcademicYear ?? "").trim()
  if (!batchNo || !program || !academicYear) return ""
  return `Batch ${batchNo} · ${program} · AY ${academicYear}`
}

export function formatBatchOptionLabel(batch) {
  const batchNo = String(batch?.batchNo ?? "").trim()
  const program = String(batch?.program ?? "").trim().toUpperCase()
  const academicYear = String(batch?.schoolYear ?? batch?.academicYear ?? "").trim()
  if (!batchNo || !program || !academicYear) return ""
  return `Batch ${batchNo} · ${program} · AY ${academicYear}`
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return ""
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatScheduleSummary(record) {
  const parts = []
  const scheduleDate = String(record?.scheduleDate ?? "").trim()
  const scheduleTime = String(record?.scheduleTime ?? "").trim()
  const scheduleLocation = String(record?.scheduleLocation ?? "").trim()

  if (scheduleDate) {
    parts.push(`Date: ${formatDisplayDate(scheduleDate)}`)
  }
  if (scheduleTime) {
    parts.push(`Time: ${scheduleTime}`)
  }
  if (scheduleLocation) {
    parts.push(`Location: ${scheduleLocation}`)
  }

  return parts.join(" · ")
}

export function isActiveLinkedAnnouncement(record, today) {
  if (!record || record.active === false) return false
  if (!isBatchLinkedAnnouncementType(record.type)) return false
  if (!getLinkedBatchKey(record)) return false
  return isAnnouncementVisibleOnLanding(record, today)
}

export function findActiveAnnouncementForBatch(announcements, batch, options = {}) {
  const { type = "payout_schedule", today } = options
  const targetKey = getOperationalBatchKey(batch)
  if (!targetKey) return null

  const matches = (announcements ?? []).filter((item) => {
    if (String(item?.type ?? "").toLowerCase() !== String(type).toLowerCase()) return false
    if (!isActiveLinkedAnnouncement(item, today)) return false
    return getLinkedBatchKey(item) === targetKey
  })

  if (!matches.length) return null

  return matches.sort((a, b) => {
    const aDates = resolveAnnouncementDates(a)
    const bDates = resolveAnnouncementDates(b)
    return String(bDates.startDate).localeCompare(String(aDates.startDate))
  })[0]
}

export function buildPayoutScheduleByBatchKey(announcements, today) {
  const map = new Map()
  for (const item of announcements ?? []) {
    if (!isPayoutScheduleAnnouncementType(item?.type)) continue
    if (!isActiveLinkedAnnouncement(item, today)) continue
    const key = getLinkedBatchKey(item)
    if (!key) continue
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
      continue
    }
    const existingDates = resolveAnnouncementDates(existing)
    const nextDates = resolveAnnouncementDates(item)
    if (String(nextDates.startDate).localeCompare(String(existingDates.startDate)) > 0) {
      map.set(key, item)
    }
  }
  return map
}

export function encodeBatchRouteParams(batch) {
  return {
    batchNo: String(batch?.batchNo ?? batch?.linkedBatchNo ?? "").trim(),
    program: String(batch?.program ?? batch?.linkedProgram ?? "").trim().toUpperCase(),
    academicYear: String(batch?.schoolYear ?? batch?.academicYear ?? batch?.linkedAcademicYear ?? "").trim(),
  }
}

export function buildCashierBatchInfoPath(batch) {
  const params = encodeBatchRouteParams(batch)
  const search = new URLSearchParams()
  if (params.batchNo) search.set("batchNo", params.batchNo)
  if (params.program) search.set("program", params.program)
  if (params.academicYear) search.set("academicYear", params.academicYear)
  return `/cashier/batch-info?${search.toString()}`
}
