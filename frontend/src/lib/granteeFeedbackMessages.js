/**
 * Plain-language feedback for grantee batch save flows (Add Grantees, etc.).
 */

function normalizeProgramLabel(program) {
  const code = String(program ?? "").trim().toUpperCase()
  return code || "the selected program"
}

function normalizeAcademicYear(fromYear, toYear, academicYear) {
  const direct = String(academicYear ?? "").trim()
  if (direct) return direct
  const from = String(fromYear ?? "").trim()
  const to = String(toYear ?? "").trim()
  if (from && to) return `${from}-${to}`
  return ""
}

export function granteeBatchSaveSuccessMessage({
  count = 0,
  program = "",
  batchNo = "",
  fromYear = "",
  toYear = "",
  academicYear = "",
} = {}) {
  const savedCount = Number(count) || 0
  const granteeWord = savedCount === 1 ? "grantee" : "grantees"
  const programLabel = normalizeProgramLabel(program)
  const batchLabel = String(batchNo ?? "").trim() || "this batch"
  const ay = normalizeAcademicYear(fromYear, toYear, academicYear)
  const ayPhrase = ay ? ` for school year ${ay}` : ""

  return `${savedCount} ${granteeWord} ${savedCount === 1 ? "was" : "were"} added to batch ${batchLabel} (${programLabel}${ayPhrase}). Open Batches anytime to review or publish this batch.`
}

export function granteeBatchSaveErrorMessage(raw) {
  const msg = String(raw ?? "").trim()
  const normalized = msg.toLowerCase()

  if (!msg) {
    return {
      title: "Could not save grantees",
      message: "Something went wrong while saving. Please wait a moment and try again.",
    }
  }

  if (
    normalized.includes("duplicate")
    || normalized.includes("e11000")
    || normalized.includes("already exist")
  ) {
    return {
      title: "Some grantees are already on file",
      message:
        "One or more rows in this upload match grantees already saved for this batch. Remove duplicates from your spreadsheet, or choose a different batch number or program if this is a new cohort.",
    }
  }

  if (
    normalized.includes("program")
    && normalized.includes("batchno")
    && normalized.includes("academicyear")
    && normalized.includes("required")
  ) {
    return {
      title: "Batch details incomplete",
      message: "Choose a program, enter a batch number, and select the full academic year before saving.",
    }
  }

  if (normalized.includes("granteerows") && normalized.includes("non-empty")) {
    return {
      title: "No grantees to save",
      message: "Your spreadsheet did not produce any grantee rows. Check the file and column headers, then try uploading again.",
    }
  }

  if (normalized.includes("legacy database indexes") || normalized.includes("restart the backend")) {
    return {
      title: "Could not save grantees",
      message:
        "Some grantee details in this file may already be saved. Review the list for duplicate student IDs or award numbers, then try again. If the problem continues, contact your system administrator.",
    }
  }

  if (/network|fetch failed|failed to fetch|connection/i.test(msg)) {
    return {
      title: "Connection problem",
      message: "We could not reach the server. Check your internet connection, make sure the app is running, and try again.",
    }
  }

  if (/failed to save|database|mongodb/i.test(normalized)) {
    return {
      title: "Could not save grantees",
      message: "We could not save this batch right now. Please try again in a moment.",
    }
  }

  if (/not found/i.test(normalized)) {
    return {
      title: "Batch no longer available",
      message: "This batch or program may have changed. Refresh the page and try again.",
    }
  }

  return {
    title: "Could not save grantees",
    message: "We could not complete the save. Review your batch details and spreadsheet, then try again.",
  }
}
