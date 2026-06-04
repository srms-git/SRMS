export const ANNOUNCEMENT_TYPE_LABELS = {
  new_batch: "New batch",
  requirement_schedule: "Requirement schedule",
  payout_schedule: "Payout schedule",
  unclaimed: "Unclaimed",
  opportunity: "Opportunity",
  advisory: "Advisory",
  other: "Other",
}

export const ANNOUNCEMENT_TYPE_FILTER_OPTIONS = [
  { value: "new_batch", label: "New batch" },
  { value: "requirement_schedule", label: "Requirement schedule" },
  { value: "payout_schedule", label: "Payout schedule" },
  { value: "unclaimed", label: "Unclaimed" },
  { value: "opportunity", label: "Opportunity" },
  { value: "advisory", label: "Advisory" },
  { value: "other", label: "Other" },
]

export function isOtherAnnouncementType(type) {
  return String(type ?? "").toLowerCase() === "other"
}

export function getAnnouncementTypeLabel(item) {
  if (!item) return "General"
  if (isOtherAnnouncementType(item.type)) {
    const custom = String(item.customType ?? "").trim()
    return custom || "Other"
  }
  return ANNOUNCEMENT_TYPE_LABELS[item.type] ?? "General"
}
