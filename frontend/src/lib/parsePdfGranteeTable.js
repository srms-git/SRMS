import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/build/pdf.mjs"
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url"

import { canonicalFieldForHeader, mapSheetRowToGranteeShape, normalizeHeaderKey } from "@/lib/granteeImportMapping"

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const PDF_MAX_PAGES = 25

function bucketY(y, step) {
  return Math.round(y / step) * step
}

function mergeFragmentsOnLine(fragments) {
  const sorted = [...fragments].sort((a, b) => a.x - b.x)
  const gapMerge = 4
  const out = []
  for (const f of sorted) {
    const prev = out[out.length - 1]
    const xEnd = f.x + f.w
    if (prev && f.x - prev.xEnd <= gapMerge) {
      prev.text = `${prev.text} ${f.text}`.trim()
      prev.xEnd = Math.max(prev.xEnd, xEnd)
    } else {
      out.push({ x: f.x, xEnd, w: f.w, text: f.text.trim() })
    }
  }
  return out
}

function cellsFromFragments(fragments) {
  const fr = mergeFragmentsOnLine(fragments)
  if (fr.length === 0) return []
  if (fr.length === 1) return [fr[0].text]

  const gaps = []
  for (let i = 1; i < fr.length; i++) {
    gaps.push(fr[i].x - fr[i - 1].xEnd)
  }
  gaps.sort((a, b) => a - b)
  const med = gaps[Math.floor(gaps.length / 2)] ?? 10
  const threshold = Math.max(med * 1.75, 14, Math.min(56, med * 3.2))

  const cells = []
  let buf = fr[0].text
  let end = fr[0].xEnd
  for (let i = 1; i < fr.length; i++) {
    const g = fr[i].x - end
    if (g > threshold) {
      cells.push(buf.trim())
      buf = fr[i].text
      end = fr[i].xEnd
    } else {
      buf = `${buf} ${fr[i].text}`.trim()
      end = fr[i].xEnd
    }
  }
  cells.push(buf.trim())
  return cells.filter(Boolean)
}

function headerMatchScore(cells) {
  let s = 0
  for (const c of cells) {
    if (canonicalFieldForHeader(normalizeHeaderKey(c))) s += 1
  }
  return s
}

export async function parsePdfToGranteeRows(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocument({ data }).promise
  const pageCount = Math.min(pdf.numPages, PDF_MAX_PAGES)

  const yBuckets = new Map()

  for (let pi = 1; pi <= pageCount; pi++) {
    const page = await pdf.getPage(pi)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if (!item || typeof item.str !== "string") continue
      const t = item.str.trim()
      if (!t) continue
      const tr = item.transform
      if (!tr || tr.length < 6) continue

      const x = tr[4]
      const y = tr[5]
      const scaleY = Math.abs(tr[3]) || 10
      const scaleX = Math.abs(tr[0]) || scaleY
      const w =
        typeof item.width === "number" && item.width > 0
          ? item.width
          : Math.max(scaleX * t.length * 0.45, t.length * 3.2)

      const yk = bucketY(y, 2.4)
      const list = yBuckets.get(yk) ?? []
      list.push({ x, y, w, text: t })
      yBuckets.set(yk, list)
    }
  }

  const yKeys = [...yBuckets.keys()].sort((a, b) => b - a)
  const linesAsCells = yKeys.map((yk) => cellsFromFragments(yBuckets.get(yk) ?? [])).filter((row) => row.length > 0)

  if (linesAsCells.length === 0) return []

  let headerIdx = 0
  let bestScore = -1
  const scan = Math.min(linesAsCells.length, 55)
  for (let i = 0; i < scan; i++) {
    const sc = headerMatchScore(linesAsCells[i])
    if (sc > bestScore) {
      bestScore = sc
      headerIdx = i
    }
    if (sc >= 4) break
  }

  if (bestScore < 2) {
    headerIdx = linesAsCells.reduce((best, row, i) => (row.length > linesAsCells[best].length ? i : best), 0)
  }

  const headerCells = linesAsCells[headerIdx] ?? []
  if (headerCells.length === 0) return []

  const out = []
  for (let r = headerIdx + 1; r < linesAsCells.length; r++) {
    const cells = linesAsCells[r]
    if (!cells.some((c) => String(c).trim())) continue

    const raw = {}
    for (let i = 0; i < headerCells.length; i++) {
      const key = String(headerCells[i] ?? "").trim() || `Column ${i + 1}`
      raw[key] = String(cells[i] ?? "").trim()
    }
    const mapped = mapSheetRowToGranteeShape(raw)
    if (Object.keys(mapped).length === 0) continue
    out.push(mapped)
  }

  return out
}
