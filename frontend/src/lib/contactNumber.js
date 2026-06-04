/** Keep digits only for stored contact numbers. */
export function sanitizeContactNumber(value) {
  return String(value ?? "").replace(/\D/g, "")
}
