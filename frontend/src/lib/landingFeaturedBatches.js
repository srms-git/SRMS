import { useCallback, useEffect, useState } from "react"

import apiClient from "@/lib/apiClient"
import { buildBatchesFromGrantees, isGranteeRecordActive } from "@/lib/granteesApi"

export const LANDING_BATCH_VISIBILITY_STORAGE_KEY = "srmsLandingBatchVisibility"
export const LANDING_BATCH_VISIBILITY_CHANGED_EVENT = "srms-landing-batch-visibility-changed"
export const LANDING_BATCHES_CHANGED_EVENT = "srms-landing-batches-changed"

function notifyLandingBatchesChanged() {
  window.dispatchEvent(new CustomEvent(LANDING_BATCHES_CHANGED_EVENT))
  window.dispatchEvent(new CustomEvent(LANDING_BATCH_VISIBILITY_CHANGED_EVENT))
}

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

function writeStoredLandingBatchVisibility(keys) {
  const normalized = normalizeVisibilityKeys(keys)
  localStorage.setItem(LANDING_BATCH_VISIBILITY_STORAGE_KEY, JSON.stringify(normalized))
  return new Set(normalized)
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

export function mapLandingBatchRecordToCard(row) {
  return {
    batchNo: String(row?.batchNo ?? "").trim(),
    schoolYear: String(row?.academicYear ?? row?.schoolYear ?? "").trim(),
    program: String(row?.program ?? "").trim().toUpperCase(),
    createdAt: formatLandingBatchCreatedAt(row?.publishedAt ?? row?.createdAt),
    grantees: Number(row?.granteeCount ?? row?.grantees) || 0,
  }
}

function buildBatchPayload(batch, granteeCount) {
  return {
    batchNo: String(batch?.batchNo ?? "").trim(),
    program: String(batch?.program ?? "").trim().toUpperCase(),
    academicYear: String(batch?.schoolYear ?? batch?.academicYear ?? "").trim(),
    granteeCount: Number.isFinite(granteeCount) ? granteeCount : undefined,
  }
}

export async function fetchPublishedLandingBatches() {
  const response = await apiClient.get("/landing-batches", { params: { published: true } })
  const rows = Array.isArray(response.data) ? response.data : []
  return rows.map(mapLandingBatchRecordToCard)
}

export async function fetchPublishedLandingBatchKeys() {
  const cards = await fetchPublishedLandingBatches()
  return new Set(cards.map((batch) => getBatchLandingKey(batch)))
}

function updateCachedVisibility(batch, visible) {
  const key = getBatchLandingKey(batch)
  if (!key || key === "||") return readStoredLandingBatchVisibility()

  const cached = readStoredLandingBatchVisibility()
  if (visible) cached.add(key)
  else cached.delete(key)
  writeStoredLandingBatchVisibility([...cached])
  return cached
}

export async function publishLandingBatch(batch, granteeCount) {
  const payload = buildBatchPayload(batch, granteeCount)
  await apiClient.post("/landing-batches/publish", payload)
  updateCachedVisibility(batch, true)
  notifyLandingBatchesChanged()
}

export async function unpublishLandingBatch(batch) {
  const payload = buildBatchPayload(batch)
  await apiClient.post("/landing-batches/unpublish", payload)
  updateCachedVisibility(batch, false)
  notifyLandingBatchesChanged()
}

export async function unpublishLandingBatchesForProgram(programCode) {
  const code = String(programCode ?? "").trim().toUpperCase()
  if (!code) return 0

  const published = await fetchPublishedLandingBatches()
  const matches = published.filter((batch) => String(batch.program ?? "").trim().toUpperCase() === code)
  if (!matches.length) return 0

  for (const batch of matches) {
    await unpublishLandingBatch(batch)
  }

  return matches.length
}

export async function renameLandingBatchOnServer(originalBatch, updatedBatch) {
  await apiClient.patch("/landing-batches/rename", {
    original: {
      batchNo: originalBatch.batchNo,
      program: originalBatch.program,
      academicYear: originalBatch.schoolYear ?? originalBatch.academicYear,
    },
    updated: {
      batchNo: updatedBatch.batchNo,
      program: updatedBatch.program,
      academicYear: updatedBatch.schoolYear ?? updatedBatch.academicYear,
    },
  })
  notifyLandingBatchesChanged()
}

export function usePublishedLandingBatches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const published = await fetchPublishedLandingBatches()
      setBatches(published)
      writeStoredLandingBatchVisibility(published.map((batch) => getBatchLandingKey(batch)))
    } catch (error) {
      console.error("Failed to load published landing batches:", error)
      setBatches([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const published = await fetchPublishedLandingBatches()
        if (cancelled) return
        setBatches(published)
        writeStoredLandingBatchVisibility(published.map((batch) => getBatchLandingKey(batch)))
      } catch (error) {
        console.error("Failed to load published landing batches:", error)
        if (!cancelled) setBatches([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    const onChange = () => {
      void refresh()
    }
    window.addEventListener(LANDING_BATCHES_CHANGED_EVENT, onChange)
    window.addEventListener(LANDING_BATCH_VISIBILITY_CHANGED_EVENT, onChange)

    return () => {
      cancelled = true
      window.removeEventListener(LANDING_BATCHES_CHANGED_EVENT, onChange)
      window.removeEventListener(LANDING_BATCH_VISIBILITY_CHANGED_EVENT, onChange)
    }
  }, [refresh])

  return { batches, loading, refresh }
}

export function useLandingBatchVisibility() {
  const [landingVisibility, setLandingVisibility] = useState(() => readStoredLandingBatchVisibility())

  useEffect(() => {
    let cancelled = false

    fetchPublishedLandingBatchKeys()
      .then((keys) => {
        if (!cancelled) {
          writeStoredLandingBatchVisibility([...keys])
          setLandingVisibility(keys)
        }
      })
      .catch((error) => {
        console.error("Failed to load landing batch visibility:", error)
      })

    const sync = () => setLandingVisibility(readStoredLandingBatchVisibility())
    window.addEventListener(LANDING_BATCHES_CHANGED_EVENT, sync)
    window.addEventListener(LANDING_BATCH_VISIBILITY_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)

    return () => {
      cancelled = true
      window.removeEventListener(LANDING_BATCHES_CHANGED_EVENT, sync)
      window.removeEventListener(LANDING_BATCH_VISIBILITY_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return landingVisibility
}

export function isBatchVisibleOnLanding(batch, visibilitySet = readStoredLandingBatchVisibility()) {
  const key = getBatchLandingKey(batch)
  if (!key || key === "||") return false
  return visibilitySet.has(key)
}

export async function setLandingBatchVisibility(batch, visible, granteeCount) {
  const key = getBatchLandingKey(batch)
  if (!key || key === "||") return readStoredLandingBatchVisibility()

  if (visible) {
    await publishLandingBatch(batch, granteeCount)
  } else {
    await unpublishLandingBatch(batch)
  }

  try {
    return await fetchPublishedLandingBatchKeys()
  } catch {
    return readStoredLandingBatchVisibility()
  }
}

export async function renameLandingBatchVisibility(originalBatch, updatedBatch) {
  const oldKey = getBatchLandingKey(originalBatch)
  const newKey = getBatchLandingKey(updatedBatch)
  if (!oldKey || oldKey === "||" || !newKey || newKey === "||" || oldKey === newKey) {
    return readStoredLandingBatchVisibility()
  }

  const cached = readStoredLandingBatchVisibility()
  if (!cached.has(oldKey)) {
    return cached
  }

  await renameLandingBatchOnServer(originalBatch, updatedBatch)

  cached.delete(oldKey)
  cached.add(newKey)
  writeStoredLandingBatchVisibility([...cached])
  return cached
}

export async function toggleLandingBatchVisibility(batch, granteeCount) {
  const visible = isBatchVisibleOnLanding(batch)
  return setLandingBatchVisibility(batch, !visible, granteeCount)
}

/** @deprecated Prefer fetchPublishedLandingBatches() for the public landing batch list. */
export function buildLandingBatchCards(grantees, visibilitySet = readStoredLandingBatchVisibility()) {
  const batches = buildBatchesFromGrantees(grantees)
  const granteeCounts = new Map()
  const seen = new Set()

  for (const item of grantees ?? []) {
    if (!isGranteeRecordActive(item)) continue
    const batchNo = String(item.batchNo ?? "").trim()
    const program = String(item.program ?? "").trim().toUpperCase()
    const schoolYear = String(item.academicYear ?? "").trim()
    if (!batchNo || !program) continue
    const key = schoolYear ? `${batchNo}|${program}|${schoolYear}` : `${batchNo}|${program}`
    granteeCounts.set(key, (granteeCounts.get(key) ?? 0) + 1)
  }

  const cards = []
  for (const batch of batches) {
    if (!visibilitySet.has(getBatchLandingKey(batch))) continue

    const landingKey = getBatchLandingKey(batch)
    if (!landingKey || landingKey === "||" || seen.has(landingKey)) continue
    seen.add(landingKey)

    const program = String(batch.program ?? "").trim().toUpperCase()
    const schoolYear = String(batch.schoolYear ?? "").trim()
    const granteesCount =
      granteeCounts.get(`${batch.batchNo}|${program}|${schoolYear}`)
      ?? granteeCounts.get(`${batch.batchNo}|${program}`)
      ?? 0
    if (granteesCount <= 0) continue
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
