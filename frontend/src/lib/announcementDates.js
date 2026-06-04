export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysToDateString(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getMinimumEndDate(startDate, today = getTodayDateString()) {
  const dayAfterToday = addDaysToDateString(today, 1)
  if (!startDate) return dayAfterToday
  return startDate > dayAfterToday ? startDate : dayAfterToday
}

export function validateAnnouncementDurationInput(startDate, endDate, today = getTodayDateString()) {
  if (!String(endDate ?? "").trim()) {
    return "Please select an end date."
  }
  if (endDate <= today) {
    return "End date must be after today."
  }
  if (endDate < startDate) {
    return "End date must be on or after the start date."
  }
  return ""
}

export function resolveAnnouncementDates(item) {
  const legacy = item?.date
  const fallback = legacy || getTodayDateString()
  const startDate =
    typeof item?.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.startDate.trim())
      ? item.startDate.trim()
      : fallback
  const endDate =
    typeof item?.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.endDate.trim())
      ? item.endDate.trim()
      : legacy || startDate
  return { startDate, endDate }
}

export function isWithinVisibleWindow(startDate, endDate, today = getTodayDateString()) {
  return today >= startDate && today <= endDate
}

export function isAnnouncementVisibleOnLanding(item, today = getTodayDateString()) {
  if (!item || item.active === false) return false
  const { startDate, endDate } = resolveAnnouncementDates(item)
  return isWithinVisibleWindow(startDate, endDate, today)
}

export function getAnnouncementScheduleStatus(item, today = getTodayDateString()) {
  if (item?.active === false) return "inactive"
  const { startDate, endDate } = resolveAnnouncementDates(item)
  if (today < startDate) return "scheduled"
  if (today > endDate) return "ended"
  return "live"
}

function formatDisplayDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function formatAnnouncementDurationLabel(startDate, endDate) {
  if (!startDate && !endDate) return "No duration"
  if (startDate === endDate) return formatDisplayDate(startDate)
  return `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`
}

export function normalizeAnnouncementRecord(item) {
  const id = item?.id || item?._id
  const { startDate, endDate } = resolveAnnouncementDates(item)
  return {
    ...item,
    id,
    startDate,
    endDate,
    date: startDate,
  }
}
