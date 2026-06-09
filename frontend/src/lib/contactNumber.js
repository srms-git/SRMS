export const PH_CONTACT_PREFIX = "+63"
export const PH_CONTACT_PLACEHOLDER = "+63(000)-000-0000"
export const PH_CONTACT_MAX_LENGTH = 17

/** National number digits only (max 10), without country code or leading 0. */
export function extractPhilippineContactDigits(value) {
  let digits = String(value ?? "").replace(/\D/g, "")
  if (digits.startsWith("63")) {
    digits = digits.slice(2)
  }
  while (digits.startsWith("0")) {
    digits = digits.slice(1)
  }
  return digits.slice(0, 10)
}

/** Format national digits as +63(000)-000-0000 while typing. */
export function formatPhilippineContactNumber(value) {
  const digits = extractPhilippineContactDigits(value)
  if (!digits) return PH_CONTACT_PREFIX

  let formatted = `${PH_CONTACT_PREFIX}(${digits.slice(0, 3)}`
  if (digits.length >= 3) formatted += ")"
  if (digits.length > 3) formatted += `-${digits.slice(3, 6)}`
  if (digits.length > 6) formatted += `-${digits.slice(6, 10)}`
  return formatted
}

/** Read-only display; returns empty when no national digits are present. */
export function formatPhilippineContactDisplay(value) {
  const digits = extractPhilippineContactDigits(value)
  if (!digits) return ""
  return formatPhilippineContactNumber(digits)
}

/** Value shown in the contact input (keeps +63 visible when empty). */
export function getPhilippineContactInputValue(value) {
  const digits = extractPhilippineContactDigits(value)
  if (!digits) return PH_CONTACT_PREFIX
  return formatPhilippineContactNumber(digits)
}

/** Normalize contact numbers for storage/API payloads. */
export function sanitizeContactNumber(value) {
  const digits = extractPhilippineContactDigits(value)
  if (!digits) return ""
  return formatPhilippineContactNumber(digits)
}
