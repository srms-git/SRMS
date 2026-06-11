import * as XLSX from "xlsx"

import authService from "@/services/authService"
import { mapSheetRowToGranteeShape } from "@/lib/granteeImportMapping"

/**
 * Base URL for the PDF converter (no trailing slash).
 * - Dev: Vite proxies `/api/pdf-converter` → Node API (auth required) → Flask PDF service
 * - Prod: set `VITE_PDF_CONVERTER_URL` to your backend base + `/api/pdf-converter`, or leave default
 */
export function getPdfConverterBaseUrl() {
  const raw = import.meta.env.VITE_PDF_CONVERTER_URL
  if (raw && String(raw).trim()) return String(raw).replace(/\/$/, "")
  return "/api/pdf-converter"
}

function buildPdfConverterUnavailableMessage(base, status) {
  const usingDefaultLocalProxy = base === "/api/pdf-converter"
  if (status === 404 && usingDefaultLocalProxy) {
    return "PDF converter service is not available in production. Set VITE_PDF_CONVERTER_URL in your Vercel project to the deployed Python converter API URL."
  }
  if (status === 404) {
    return `PDF converter endpoint not found (404): ${base}/upload`
  }
  return `Server conversion failed (${status}).`
}

function normalizeBackendImportRow(rawRow) {
  const shaped = mapSheetRowToGranteeShape(rawRow)
  if (shaped.program && !shaped.enrolledProgram) {
    shaped.enrolledProgram = shaped.program
    delete shaped.program
  }
  return shaped
}

/** Download .xlsx from Flask `/upload`; does not parse in JS. */
export async function downloadGranteePdfAsXlsx(file) {
  const base = getPdfConverterBaseUrl()
  const form = new FormData()
  form.append("pdf", file, file.name)

  const token = authService.getToken()
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${base}/upload`, {
    method: "POST",
    body: form,
    headers,
  })

  if (!res.ok) {
    let message = buildPdfConverterUnavailableMessage(base, res.status)
    const ct = res.headers.get("content-type") ?? ""
    try {
      if (ct.includes("application/json")) {
        const j = await res.json()
        if (j?.error) message = String(j.error)
        if (j?.hint) message = `${message} ${String(j.hint)}`
      } else {
        const t = await res.text()
        if (t?.trim()) message = t.trim().slice(0, 400)
      }
    } catch {
      /* keep generic */
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const cd = res.headers.get("Content-Disposition") ?? ""
  const m = cd.match(/filename\*?=(?:UTF-8''|")?([^";\r\n]+)/i)
  let downloadName = (file.name.replace(/\.pdf$/i, "") || "converted") + ".xlsx"
  if (m?.[1]) {
    downloadName = decodeURIComponent(m[1].replace(/^"|"$/g, "").trim())
  }

  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = url
    a.download = downloadName
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * First sheet → grantee-shaped rows (.xlsx / .xls / .csv).
 * @param {File} file
 * @returns {Promise<Record<string, string>[]>}
 */
export async function parseGranteeXlsxFromFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: "array" })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const ws = wb.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" })
  if (!Array.isArray(json)) return []

  return json
    .map((row) => normalizeBackendImportRow(row))
    .filter((row) => Object.keys(row).length > 0)
}
