import {
  getTodayDateString,
  isAnnouncementVisibleOnLanding,
  normalizeAnnouncementRecord,
} from "@/lib/announcementDates"

export const PAYOUT_SCHEDULE_TYPE = "payout_schedule"

export const PAYOUT_INDICATOR_STATUS = {
  SCHEDULED: "scheduled",
  READY: "ready",
}

export function isPayoutScheduleAnnouncement(item) {
  return String(item?.type ?? "").toLowerCase() === PAYOUT_SCHEDULE_TYPE
}

export function normalizePayoutBatchKey(batchNo, program) {
  const normalizedBatch = String(batchNo ?? "").trim()
  const normalizedProgram = String(program ?? "").trim().toUpperCase()
  if (!normalizedBatch || !normalizedProgram) return ""
  return `${normalizedBatch}|${normalizedProgram}`
}

export function announcementMatchesBatch(announcement, batch) {
  if (!isPayoutScheduleAnnouncement(announcement)) return false
  const key = normalizePayoutBatchKey(announcement.payoutBatchNo, announcement.payoutProgram)
  const batchKey = normalizePayoutBatchKey(batch?.batchNo ?? batch?.payoutBatchNo, batch?.program ?? batch?.payoutProgram)
  return Boolean(key) && key === batchKey
}

export function isPayoutDateSet(payoutDate) {
  return typeof payoutDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payoutDate.trim())
}

export function isPayoutDateMet(payoutDate, today = getTodayDateString()) {
  if (!isPayoutDateSet(payoutDate)) return false
  return today >= payoutDate.trim()
}

export function getPayoutIndicatorStatus(announcement, today = getTodayDateString()) {
  if (!isPayoutDateSet(announcement?.payoutDate)) return null
  return isPayoutDateMet(announcement.payoutDate, today)
    ? PAYOUT_INDICATOR_STATUS.READY
    : PAYOUT_INDICATOR_STATUS.SCHEDULED
}

export function isActivePayoutScheduleAnnouncement(announcement, today = getTodayDateString()) {
  if (!isPayoutScheduleAnnouncement(announcement)) return false
  return isAnnouncementVisibleOnLanding(announcement, today)
}

export function shouldShowPayoutScheduleBadge(announcement, batch, today = getTodayDateString()) {
  if (!isActivePayoutScheduleAnnouncement(announcement, today)) return false
  if (!announcementMatchesBatch(announcement, batch)) return false
  return isPayoutDateSet(announcement.payoutDate)
}

export function findPayoutScheduleAnnouncementsForBatch(announcements, batch, { activeOnly = true, today = getTodayDateString() } = {}) {
  const list = Array.isArray(announcements) ? announcements : []
  return list.filter((item) => {
    const record = normalizeAnnouncementRecord(item)
    if (!isPayoutScheduleAnnouncement(record)) return false
    if (!announcementMatchesBatch(record, batch)) return false
    if (activeOnly && !isActivePayoutScheduleAnnouncement(record, today)) return false
    return true
  })
}

export function batchHasPayoutScheduleBadge(announcements, batch, today = getTodayDateString()) {
  return findPayoutScheduleAnnouncementsForBatch(announcements, batch, { activeOnly: true, today }).some((item) =>
    shouldShowPayoutScheduleBadge(item, batch, today),
  )
}

export function buildPayoutScheduleBadgeLookup(announcements, today = getTodayDateString()) {
  const lookup = new Map()
  for (const item of announcements ?? []) {
    const record = normalizeAnnouncementRecord(item)
    if (!shouldShowPayoutScheduleBadge(record, { batchNo: record.payoutBatchNo, program: record.payoutProgram }, today)) {
      continue
    }
    const key = normalizePayoutBatchKey(record.payoutBatchNo, record.payoutProgram)
    if (!key) continue
    const status = getPayoutIndicatorStatus(record, today)
    if (!status) continue
    const existing = lookup.get(key)
    if (!existing || (status === PAYOUT_INDICATOR_STATUS.READY && existing.status === PAYOUT_INDICATOR_STATUS.SCHEDULED)) {
      lookup.set(key, { record, status })
    }
  }
  return lookup
}

export function getPayoutIndicatorForBatch(lookup, batch) {
  const key = normalizePayoutBatchKey(batch?.batchNo, batch?.program)
  if (!key) return null
  return lookup.get(key) ?? null
}

export function formatPayoutDateLabel(isoDate) {
  if (!isPayoutDateSet(isoDate)) return "—"
  const date = new Date(`${isoDate.trim()}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
}
