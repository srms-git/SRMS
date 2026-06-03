/**
 * Turns API or validation errors into short, plain-language messages for staff.
 */
export function programErrorMessage(raw) {
  const msg = String(raw ?? "").trim()
  if (!msg) {
    return "We could not save your changes. Please try again in a moment."
  }
  if (/already exists/i.test(msg)) {
    if (/code|name/i.test(msg) && !/slug|url/i.test(msg)) {
      return "Another program already uses this short name. Please choose a different one."
    }
    if (/slug|url/i.test(msg)) {
      return "Another program already uses this workspace link. Try a different short name."
    }
    return "A program with these details already exists. Change the short name and try again."
  }
  if (/2.?12|letters or numbers/i.test(msg)) {
    return "The short name must be 2 to 12 letters or numbers only, like TES or TDP."
  }
  if (/empty|required|cannot be empty/i.test(msg)) {
    return "Please fill in the program name and full name."
  }
  if (/up to \d+ programs/i.test(msg)) {
    return msg.replace(/load testing is in progress\.?/i, "Remove or hide an unused program first, then try again.")
  }
  if (/at most 12|up to 12 requirement/i.test(msg)) {
    return "You can list up to 12 requirement items per program. Remove or combine items, then try again."
  }
  if (/at least one requirement/i.test(msg)) {
    return "Add at least one requirement with a clear description."
  }
  if (/duplicate requirement/i.test(msg)) {
    return "Two items share the same internal id. Edit the labels or remove a duplicate row."
  }
  if (/not found/i.test(msg)) {
    return "This program may have been removed. Refresh the page and try again."
  }
  if (/failed to|could not|couldn't/i.test(msg)) {
    return "We could not reach the server. Check your connection and try again."
  }
  return msg
}
