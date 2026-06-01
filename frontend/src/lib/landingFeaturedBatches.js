import { buildBatchesFromGrantees } from "@/lib/granteesApi"

export const LANDING_BATCH_VISIBILITY_STORAGE_KEY = "srmsLandingBatchVisibility"
export const LANDING_BATCH_VISIBILITY_CHANGED_EVENT = "srms-landing-batch-visibility-changed"

/** @deprecated Mock list kept for reference; landing page uses live grantee data + visibility settings. */
export const LANDING_FEATURED_BATCHES = [
  {
    batchNo: "21.1",
    schoolYear: "2025-2026",
    program: "TES",
    createdAt: "Date added: May 4, 2026",
    grantees: 512,
  },
  {
    batchNo: "21.3",
    schoolYear: "2025-2026",
    program: "TES",
    createdAt: "Date added: May 6, 2026",
    grantees: 478,
  },
  {
    batchNo: "21.4",
    schoolYear: "2025-2026",
    program: "TES",
    createdAt: "Date added: May 7, 2026",
    grantees: 391,
  },
  {
    batchNo: "20.1",
    schoolYear: "2024-2025",
    program: "TES",
    createdAt: "Date added: Apr 30, 2026",
    grantees: 502,
  },
  {
    batchNo: "20.2",
    schoolYear: "2024-2025",
    program: "TES",
    createdAt: "Date added: May 2, 2026",
    grantees: 438,
  },
  {
    batchNo: "20.4",
    schoolYear: "2024-2025",
    program: "TES",
    createdAt: "Date added: May 8, 2026",
    grantees: 455,
  },
  {
    batchNo: "19.4",
    schoolYear: "2023-2024",
    program: "TES",
    createdAt: "Date added: Apr 28, 2026",
    grantees: 620,
  },
  {
    batchNo: "19.2",
    schoolYear: "2023-2024",
    program: "TES",
    createdAt: "Date added: Apr 22, 2026",
    grantees: 588,
  },
  {
    batchNo: "19.1",
    schoolYear: "2023-2024",
    program: "TES",
    createdAt: "Date added: Apr 18, 2026",
    grantees: 540,
  },
  {
    batchNo: "18.3",
    schoolYear: "2022-2023",
    program: "TES",
    createdAt: "Date added: Apr 10, 2026",
    grantees: 497,
  },
  {
    batchNo: "21.2",
    schoolYear: "2025-2026",
    program: "TDP",
    createdAt: "Date added: May 5, 2026",
    grantees: 286,
  },
  {
    batchNo: "21.5",
    schoolYear: "2025-2026",
    program: "TDP",
    createdAt: "Date added: May 9, 2026",
    grantees: 312,
  },
  {
    batchNo: "21.6",
    schoolYear: "2025-2026",
    program: "TDP",
    createdAt: "Date added: May 10, 2026",
    grantees: 268,
  },
  {
    batchNo: "20.3",
    schoolYear: "2024-2025",
    program: "TDP",
    createdAt: "Date added: May 3, 2026",
    grantees: 194,
  },
  {
    batchNo: "20.5",
    schoolYear: "2024-2025",
    program: "TDP",
    createdAt: "Date added: May 11, 2026",
    grantees: 221,
  },
  {
    batchNo: "20.6",
    schoolYear: "2024-2025",
    program: "TDP",
    createdAt: "Date added: May 12, 2026",
    grantees: 205,
  },
  {
    batchNo: "19.5",
    schoolYear: "2023-2024",
    program: "TDP",
    createdAt: "Date added: Apr 26, 2026",
    grantees: 178,
  },
  {
    batchNo: "19.3",
    schoolYear: "2023-2024",
    program: "TDP",
    createdAt: "Date added: Apr 20, 2026",
    grantees: 163,
  },
  {
    batchNo: "18.2",
    schoolYear: "2022-2023",
    program: "TDP",
    createdAt: "Date added: Apr 8, 2026",
    grantees: 189,
  },
  {
    batchNo: "18.1",
    schoolYear: "2022-2023",
    program: "TDP",
    createdAt: "Date added: Apr 5, 2026",
    grantees: 201,
  },
]

export function getBatchLandingKey(batch) {
  const batchNo = String(batch?.batchNo ?? "").trim()
  const program = String(batch?.program ?? "").trim().toUpperCase()
  const schoolYear = String(batch?.schoolYear ?? batch?.academicYear ?? "").trim()
  return `${batchNo}|${program}|${schoolYear}`
}

function normalizeVisibilityKeys(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
}

export function readStoredLandingBatchVisibility() {
  const raw = localStorage.getItem(LANDING_BATCH_VISIBILITY_STORAGE_KEY)
  if (!raw) return new Set()
  try {
    const parsed = JSON.parse(raw)
    return new Set(normalizeVisibilityKeys(parsed))
  } catch {
    return new Set()
  }
}

export function writeStoredLandingBatchVisibility(keys) {
  const normalized = normalizeVisibilityKeys(keys)
  localStorage.setItem(LANDING_BATCH_VISIBILITY_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(LANDING_BATCH_VISIBILITY_CHANGED_EVENT))
  return new Set(normalized)
}

export function isBatchVisibleOnLanding(batch, visibilitySet = readStoredLandingBatchVisibility()) {
  const key = getBatchLandingKey(batch)
  if (!key || key === "||") return false
  return visibilitySet.has(key)
}

export function setLandingBatchVisibility(batch, visible) {
  const key = getBatchLandingKey(batch)
  if (!key || key === "||") return readStoredLandingBatchVisibility()

  const next = new Set(readStoredLandingBatchVisibility())
  if (visible) {
    next.add(key)
  } else {
    next.delete(key)
  }
  return writeStoredLandingBatchVisibility([...next])
}

export function renameLandingBatchVisibility(originalBatch, updatedBatch) {
  const oldKey = getBatchLandingKey(originalBatch)
  const newKey = getBatchLandingKey(updatedBatch)
  if (!oldKey || oldKey === "||" || !newKey || newKey === "||" || oldKey === newKey) {
    return readStoredLandingBatchVisibility()
  }

  const next = new Set(readStoredLandingBatchVisibility())
  if (next.has(oldKey)) {
    next.delete(oldKey)
    next.add(newKey)
  }
  return writeStoredLandingBatchVisibility([...next])
}

export function toggleLandingBatchVisibility(batch) {
  const visible = isBatchVisibleOnLanding(batch)
  return setLandingBatchVisibility(batch, !visible)
}

export function formatLandingBatchCreatedAt(value) {
  if (!value) return "Date added: —"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date added: —"
  return `Date added: ${date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`
}

export function buildLandingBatchCards(grantees, visibilitySet = readStoredLandingBatchVisibility()) {
  const batches = buildBatchesFromGrantees(grantees)
  const granteeCounts = new Map()
  const seen = new Set()

  for (const item of grantees ?? []) {
    const batchNo = String(item.batchNo ?? "").trim()
    const program = String(item.program ?? "").trim().toUpperCase()
    if (!batchNo || !program) continue
    const key = `${batchNo}|${program}`
    granteeCounts.set(key, (granteeCounts.get(key) ?? 0) + 1)
  }

  const cards = []
  for (const batch of batches) {
    if (!isBatchVisibleOnLanding(batch, visibilitySet)) continue

    const landingKey = getBatchLandingKey(batch)
    if (!landingKey || landingKey === "||" || seen.has(landingKey)) continue
    seen.add(landingKey)

    const program = String(batch.program ?? "").trim().toUpperCase()
    const granteesCount = granteeCounts.get(`${batch.batchNo}|${program}`) ?? 0
    cards.push({
      batchNo: batch.batchNo,
      schoolYear: batch.schoolYear,
      program,
      createdAt: formatLandingBatchCreatedAt(batch.createdAt),
      grantees: granteesCount,
    })
  }

  return cards
}
