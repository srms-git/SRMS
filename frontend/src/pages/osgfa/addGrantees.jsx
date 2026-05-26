import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileText,
  Hash,
  Info,
  Layers,
  TableProperties,
  UploadCloud,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import {
  batchSaveGrantees,
  buildBatchesFromGrantees,
  buildLatestBatchGranteeCards,
  fetchAllGrantees,
  recordMatchesProgram,
} from "@/lib/granteesApi"
import { downloadGranteePdfAsXlsx, parseGranteeXlsxFromFile } from "@/lib/granteePdfConverterApi"
import { useOsgfaPrivacySettings } from "@/hooks/useOsgfaPrivacySettings"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

function academicYearOptions() {
  const currentYear = new Date().getFullYear()
  const start = 1990
  const end = currentYear + 10
  const options = []
  for (let y = start; y <= end; y++) {
    options.push(String(y))
  }
  return options
}

function formatCardDate(value) {
  if (!value) return "No date"
  const parsed = Date.parse(String(value))
  if (Number.isNaN(parsed)) return "No date"
  return new Date(parsed).toLocaleDateString()
}

/** Same page size as `landingpageBatch` grantee table. */
const PREVIEW_PAGE_SIZE = 100

function newRowId() {
  return globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function buildDraftRowsFromParsed(parsedRows, formBatch) {
  const pb = String(formBatch).trim()
  return parsedRows.map((row) => ({
    rid: newRowId(),
    batchNo: String(row.batchNo ?? "").trim() || pb,
    seqNo: String(row.seqNo ?? "").trim(),
    studentId: String(row.studentId ?? "").trim(),
    awardNumber: String(row.awardNumber ?? "").trim(),
    fullName: String(row.fullName ?? "").trim(),
    enrolledProgram: String(row.enrolledProgram ?? "").trim(),
    yearLevel: String(row.yearLevel ?? "").trim(),
  }))
}

function previewRowKey(row, index) {
  return (
    String(row?.seqNo ?? "")
      .trim() ||
    String(row?.awardNumber ?? "")
      .trim() ||
    `${String(row?.studentId ?? "").trim()}-${String(row?.fullName ?? "").trim()}-${index}`
  )
}

function AlertModal({ open, onOpenChange, variant = "info", title, message }) {
  const meta = useMemo(() => {
    if (variant === "success") {
      return {
        Icon: CircleCheck,
        iconWrap: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        topBar: "from-emerald-500 via-emerald-600 to-teal-600",
        title: title || "Success",
      }
    }
    if (variant === "error") {
      return {
        Icon: CircleAlert,
        iconWrap: "bg-red-50 text-red-700 ring-red-200",
        topBar: "from-red-600 via-rose-600 to-orange-600",
        title: title || "Something went wrong",
      }
    }
    return {
      Icon: Info,
      iconWrap: "bg-[#081F5C]/8 text-[#081F5C] ring-[#081F5C]/15",
      topBar: "from-[#04133d] via-[#081F5C] to-[#1447a6]",
      title: title || "Notice",
    }
  }, [variant, title])

  const Icon = meta.Icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative w-[min(92vw,34rem)] max-w-none overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
        <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r ${meta.topBar}`} aria-hidden />
        <DialogHeader className="relative shrink-0 pt-1">
          <DialogTitle className="flex items-center gap-3">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.iconWrap}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">{meta.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{message || "—"}</div>

        <DialogFooter className="mt-2 sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)} className="bg-[#081F5C] hover:bg-[#0b2d83]">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SummaryStatCard({ label, value, accentBar, glow, iconBg, Icon }) {
  return (
    <div
      className={`group relative min-h-[124px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6 ${accentBar}`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-60 ${glow}`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1 pr-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{value}</p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-black/4 dark:ring-white/10 ${iconBg}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      </div>
    </div>
  )
}

function UploadField({ id, label, hint, accept, icon: Icon, file, onChange }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">
        {label}
      </label>

      <label
        htmlFor={id}
        className="group flex min-h-[118px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-3 transition-colors hover:border-[#081F5C]/45 hover:bg-slate-100/80"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#081F5C]/10 text-[#081F5C]">
          <Icon className="h-5 w-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UploadCloud className="h-4 w-4" aria-hidden />
            Click to upload file
          </p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
          <p className="mt-3 truncate text-xs font-medium text-slate-700">
            {file ? file.name : "No file selected"}
          </p>
        </div>

        <span className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
          Browse
        </span>
      </label>

      <input id={id} type="file" accept={accept} className="hidden" onChange={onChange} />
    </div>
  )
}

function LatestBatchCard({ row, onClick }) {
  const program = String(row?.program ?? "").trim().toUpperCase()
  const grantees = row?.grantees ?? row?.total ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 text-left shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#081F5C]/8 blur-2xl" aria-hidden />
      <div className="relative flex items-center gap-2.5">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-[#04133d] via-[#081F5C] to-[#1447a6] text-[11px] font-bold tracking-tight text-white shadow-sm shadow-[#081F5C]/20"
          aria-hidden
        >
          {String(row?.batchNo ?? "?").slice(0, 3)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold leading-tight text-slate-900">Batch {row?.batchNo || "—"}</h3>
            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-px text-[9px] font-semibold text-slate-600">
              {formatCardDate(row?.addedAt)}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {program === "TDP" ? (
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-semibold text-slate-800">
                TDP
              </span>
            ) : (
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-semibold text-slate-800">
                TES
              </span>
            )}
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[10px] font-semibold text-emerald-900">
              Total: {grantees}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

export default function AddGrantees() {
  const { formatStudentId, formatStat } = useOsgfaPrivacySettings()
  const navigate = useNavigate()
  const [program, setProgram] = useState("")
  const [batchNo, setBatchNo] = useState("")
  const [fromYear, setFromYear] = useState("")
  const [toYear, setToYear] = useState("")
  const [converterPdfFile, setConverterPdfFile] = useState(null)
  const [converterLoading, setConverterLoading] = useState(false)
  const [converterError, setConverterError] = useState("")
  const [previewExcelFile, setPreviewExcelFile] = useState(null)
  const [notice, setNotice] = useState("")
  const [parsedPreviewRows, setParsedPreviewRows] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")
  const [previewPage, setPreviewPage] = useState(1)
  const [draftGranteeRows, setDraftGranteeRows] = useState([])
  const [savedGranteeRows, setSavedGranteeRows] = useState([])
  const [importNotice, setImportNotice] = useState("")
  const [importDirty, setImportDirty] = useState(false)
  const [editorPage, setEditorPage] = useState(1)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [granteeRecords, setGranteeRecords] = useState([])
  const [granteesLoading, setGranteesLoading] = useState(true)
  const [granteesLoadError, setGranteesLoadError] = useState("")
  const [alertState, setAlertState] = useState({ open: false, variant: "info", title: "", message: "" })

  const showAlert = (variant, message, title = "") => {
    setAlertState({ open: true, variant, title, message })
  }

  const reloadGranteeRecords = async () => {
    try {
      setGranteesLoading(true)
      setGranteesLoadError("")
      const rows = await fetchAllGrantees()
      setGranteeRecords(rows)
    } catch (err) {
      console.error("Failed to load grantee records:", err)
      setGranteeRecords([])
      setGranteesLoadError(String(err?.message ?? err ?? "Could not load grantee records."))
    } finally {
      setGranteesLoading(false)
    }
  }

  useEffect(() => {
    reloadGranteeRecords()
  }, [])

  useEffect(() => {
    let cancelled = false

    const finish = (rows) => {
      if (cancelled) return
      setParsedPreviewRows(rows)
      const drafted = buildDraftRowsFromParsed(rows, batchNo)
      setDraftGranteeRows(drafted)
      setSavedGranteeRows(drafted.map((r) => ({ ...r })))
      setImportNotice("")
      setImportDirty(false)
      setEditorPage(1)
      setPreviewPage(1)
      setPreviewLoading(false)
    }

    const fail = (message) => {
      if (cancelled) return
      setParsedPreviewRows([])
      setDraftGranteeRows([])
      setSavedGranteeRows([])
      setImportNotice("")
      setImportDirty(false)
      setPreviewError(message)
      setPreviewLoading(false)
    }

    if (previewExcelFile) {
      setPreviewLoading(true)
      setPreviewError("")
      parseGranteeXlsxFromFile(previewExcelFile)
        .then((rows) => {
          if (cancelled) return
          finish(rows)
        })
        .catch((err) => {
          if (cancelled) return
          fail(String(err?.message ?? err ?? "Could not read the spreadsheet."))
        })
      return () => {
        cancelled = true
      }
    }

    setParsedPreviewRows([])
    setDraftGranteeRows([])
    setSavedGranteeRows([])
    setPreviewError("")
    setPreviewLoading(false)
    setImportNotice("")
    setImportDirty(false)
    return undefined
  }, [previewExcelFile])

  useEffect(() => {
    if (parsedPreviewRows.length === 0) return
    const drafted = buildDraftRowsFromParsed(parsedPreviewRows, batchNo)
    setDraftGranteeRows(drafted)
    setSavedGranteeRows(drafted.map((r) => ({ ...r })))
    setPreviewPage(1)
  }, [batchNo, parsedPreviewRows])

  useEffect(() => {
    setPreviewPage(1)
  }, [savedGranteeRows])

  useEffect(() => {
    setEditorPage(1)
  }, [parsedPreviewRows])

  const previewTableRows = useMemo(() => {
    const pb = String(batchNo).trim()
    return savedGranteeRows.map((row) => ({
      rid: row.rid,
      batchNo: String(row.batchNo ?? "").trim() || pb,
      seqNo: String(row.seqNo ?? "").trim(),
      studentId: String(row.studentId ?? "").trim(),
      awardNumber: String(row.awardNumber ?? "").trim(),
      fullName: String(row.fullName ?? "").trim(),
      enrolledProgram: String(row.enrolledProgram ?? "").trim(),
      yearLevel: String(row.yearLevel ?? "").trim(),
    }))
  }, [savedGranteeRows, batchNo])

  const editorPageCount = useMemo(() => Math.max(1, Math.ceil(draftGranteeRows.length / PREVIEW_PAGE_SIZE)), [draftGranteeRows.length])

  const editorPagedRows = useMemo(() => {
    const start = (editorPage - 1) * PREVIEW_PAGE_SIZE
    return draftGranteeRows.slice(start, start + PREVIEW_PAGE_SIZE)
  }, [editorPage, draftGranteeRows])

  const previewPageCount = useMemo(() => Math.max(1, Math.ceil(previewTableRows.length / PREVIEW_PAGE_SIZE)), [previewTableRows.length])

  const previewPagedRows = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE
    return previewTableRows.slice(start, start + PREVIEW_PAGE_SIZE)
  }, [previewPage, previewTableRows])

  const updateDraftCell = (rid, field, value) => {
    setImportDirty(true)
    setImportNotice("")
    setDraftGranteeRows((prev) => prev.map((r) => (r.rid === rid ? { ...r, [field]: value } : r)))
  }

  const removeDraftRow = (rid) => {
    setImportDirty(true)
    setImportNotice("")
    setDraftGranteeRows((prev) => {
      const next = prev.filter((r) => r.rid !== rid)
      setEditorPage((p) => {
        const maxPage = Math.max(1, Math.ceil(next.length / PREVIEW_PAGE_SIZE))
        return Math.min(p, maxPage)
      })
      return next
    })
  }

  const resetDraftFromParsed = () => {
    setDraftGranteeRows(buildDraftRowsFromParsed(parsedPreviewRows, batchNo))
    setImportDirty(true)
    setImportNotice("")
    setEditorPage(1)
  }

  const saveImportChanges = () => {
    setSavedGranteeRows(draftGranteeRows.map((r) => ({ ...r })))
    setImportDirty(false)
    setImportNotice("Saved. The read-only preview below matches this table.")
    setPreviewPage(1)
  }

  const summary = useMemo(() => {
    const total = granteeRecords.length
    const tes = granteeRecords.filter((row) => recordMatchesProgram(row, "TES")).length
    const tdp = granteeRecords.filter((row) => recordMatchesProgram(row, "TDP")).length
    const batches = buildBatchesFromGrantees(granteeRecords).length
    return { total, tes, tdp, batches }
  }, [granteeRecords])

  const latestBatchGrantees = useMemo(
    () => buildLatestBatchGranteeCards(granteeRecords, 8),
    [granteeRecords]
  )

  const statDisplay = (value, label) => {
    if (granteesLoading) return "…"
    return formatStat(value, label)
  }

  const handleConvertAndDownload = async () => {
    if (!converterPdfFile) {
      setConverterError("Select a PDF first.")
      showAlert("error", "Please select a PDF first before converting.")
      return
    }
    setConverterError("")
    setConverterLoading(true)
    try {
      await downloadGranteePdfAsXlsx(converterPdfFile)
      showAlert("success", "Conversion completed. Your Excel file download should start automatically.", "PDF converted")
    } catch (err) {
      const msg = String(err?.message ?? err ?? "Conversion failed.")
      setConverterError(msg)
      showAlert("error", msg, "Conversion failed")
    } finally {
      setConverterLoading(false)
    }
  }

  // UPDATED: Directly maps raw Excel fullName straight to the simplified MongoDB schema
  const finalizeSubmit = async () => {
    setNotice("Saving batch records to MongoDB database...")
    
    try {
      const mappedRows = savedGranteeRows.map(row => ({
        seqNo: row.seqNo,
        studentId: row.studentId,
        awardNumber: row.awardNumber,
        fullName: row.fullName ? String(row.fullName).trim() : "Unknown", // Passed directly without splitting strings
        enrolledProgram: row.enrolledProgram,
        yearLevel: row.yearLevel
      }));

      const data = await batchSaveGrantees({
        program,
        batchNo,
        academicYear: `${fromYear}-${toYear}`,
        granteeRows: mappedRows,
      })

      await reloadGranteeRecords()

      setNotice(`Successfully saved ${data.count ?? mappedRows.length} grantee(s) to MongoDB.`)
      showAlert("success", `Successfully saved ${data.count ?? mappedRows.length} grantee(s) to MongoDB.`, "Grantees added")
      setProgram("")
      setBatchNo("")
      setFromYear("")
      setToYear("")
      setConverterPdfFile(null)
      setPreviewExcelFile(null)
      setParsedPreviewRows([])
      setDraftGranteeRows([])
      setSavedGranteeRows([])
      setImportNotice("")
      setImportDirty(false)

    } catch (err) {
      console.error("Submission failed:", err)
      const rawMsg = String(err?.message ?? err ?? "Database save error.")

      // Keep backend details out of the UI. This is shown to users, not developers.
      const normalized = rawMsg.toLowerCase()
      let friendlyMsg = "We couldn't save the grantees. Please try again."
      let friendlyTitle = "Save failed"

      if (normalized.includes("duplicate") || normalized.includes("e11000")) {
        friendlyMsg =
          "Some of these grantee entries already exist for this batch. Please review the list and try again (for example, avoid uploading the same file twice)."
        friendlyTitle = "Duplicate grantee data"
      }

      setNotice(friendlyMsg)
      showAlert("error", friendlyMsg, friendlyTitle)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const hasRows = savedGranteeRows.length > 0

    if (
      !String(program).trim() ||
      !String(batchNo).trim() ||
      !String(fromYear).trim() ||
      !String(toYear).trim() ||
      !previewExcelFile
    ) {
      setNotice(
        "Please complete Program, Batch Number, Academic Year, and upload an Excel file (.xlsx) in the Preview section."
      )
      return
    }

    if (!hasRows) {
      setNotice("No grantee rows loaded from the spreadsheet. Check column headers and try again.")
      return
    }

    setNotice("")
    setConfirmOpen(true)
  }

  return (
    <section className="w-full min-w-0 max-w-full space-y-4">
      <AlertModal
        open={alertState.open}
        onOpenChange={(open) => setAlertState((prev) => ({ ...prev, open }))}
        variant={alertState.variant}
        title={alertState.title}
        message={alertState.message}
      />
      {granteesLoadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {granteesLoadError}
        </p>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          label="Total Records"
          value={statDisplay(summary.total, "Total Records")}
          accentBar="border-l-[3px] border-l-[#081F5C]"
          glow="bg-[#081F5C]/25"
          iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
          Icon={TableProperties}
        />
        <SummaryStatCard
          label="TES Records"
          value={statDisplay(summary.tes, "TES Records")}
          accentBar="border-l-[3px] border-l-emerald-500"
          glow="bg-emerald-400/30"
          iconBg="bg-linear-to-br from-emerald-500 to-teal-600 text-white"
          Icon={CircleCheck}
        />
        <SummaryStatCard
          label="TDP Records"
          value={statDisplay(summary.tdp, "TDP Records")}
          accentBar="border-l-[3px] border-l-amber-500"
          glow="bg-amber-400/30"
          iconBg="bg-linear-to-br from-amber-500 to-orange-500 text-white"
          Icon={CircleDashed}
        />
        <SummaryStatCard
          label="Active Batches"
          value={statDisplay(summary.batches)}
          accentBar="border-l-[3px] border-l-violet-500"
          glow="bg-violet-400/30"
          iconBg="bg-linear-to-br from-violet-500 to-fuchsia-600 text-white"
          Icon={Layers}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] xl:items-start">
        <form id="add-grantees-form" className="min-w-0 space-y-4 xl:mt-1" onSubmit={handleSubmit}>
          <section
            aria-label="PDF to Excel converter"
            className="min-w-0 space-y-4 rounded-2xl border border-slate-200/90 bg-linear-to-br from-slate-50/95 via-white to-[#081F5C]/5 p-5 shadow-sm ring-1 ring-slate-900/5 dark:border-white/10 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-[#081F5C]/15 dark:ring-white/8"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#081F5C]/12 text-[#081F5C] shadow-inner ring-1 ring-[#081F5C]/15 dark:bg-[#081F5C]/25 dark:text-sky-300 dark:ring-white/10"
                  aria-hidden
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#081F5C] dark:text-sky-300">
                    PDF to Excel
                  </p>
                  <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">PDF to Excel converter</h2>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200">
                <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                  <FileText className="h-4 w-4 shrink-0 text-[#081F5C]" aria-hidden />
                  PDF
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  Excel
                </span>
              </div>
            </div>

            <UploadField
              id="converterPdf"
              label="Grantee list PDF"
              hint=""
              accept=".pdf,application/pdf"
              icon={FileText}
              file={converterPdfFile}
              onChange={(event) => {
                setConverterError("")
                setConverterPdfFile(event.target.files?.[0] ?? null)
              }}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-slate-200 sm:w-auto"
                disabled={!converterPdfFile || converterLoading}
                onClick={handleConvertAndDownload}
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                {converterLoading ? "Converting…" : "Convert & download"}
              </Button>
              {converterError ? (
                <p className="text-sm text-red-700 dark:text-red-400">{converterError}</p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">Downloads as .xlsx (same format as converter output).</p>
              )}
            </div>
          </section>

          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-slate-900 md:text-lg">Add Grantees</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="program" className="text-xs font-semibold text-slate-700">
                Program
              </label>
              <div className="relative">
                <select
                  id="program"
                  value={program}
                  onChange={(event) => setProgram(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25"
                >
                  <option value="" disabled>
                    Select program
                  </option>
                  <option value="TES">TES</option>
                  <option value="TDP">TDP</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="batchNo" className="text-xs font-semibold text-slate-700">
                Batch Number
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="batchNo"
                  type="text"
                  placeholder="Enter batch number"
                  value={batchNo}
                  onChange={(event) => setBatchNo(event.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-3 text-sm shadow-sm focus-visible:ring-[#081F5C]/25"
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Academic Year</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="relative">
                  <select
                    value={fromYear}
                    onChange={(event) => {
                      const nextFrom = event.target.value
                      setFromYear(nextFrom)
                      setToYear(nextFrom ? String(Number(nextFrom) + 1) : "")
                    }}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25"
                  >
                    <option value="" disabled>
                      From
                    </option>
                    {academicYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                </div>
                <div className="relative">
                  <select
                    value={toYear}
                    onChange={(event) => setToYear(event.target.value)}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25"
                  >
                    <option value="" disabled>
                      To
                    </option>
                    {academicYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                </div>
                <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900">
                  <span className="text-xs font-medium text-slate-500">Preview</span>
                  <span className="tabular-nums">{fromYear && toYear ? `${fromYear}-${toYear}` : "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {notice ? <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{notice}</p> : null}

        </form>

        <div className="flex min-w-0 h-[400px] flex-col overflow-y-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 xl:min-w-[340px]">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Latest added Batch Grantees</h3>
          <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1">
            {granteesLoading ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-center text-sm text-slate-600">
                Loading batches…
              </p>
            ) : latestBatchGrantees.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-center text-sm text-slate-600">
                No grantee batches saved yet. Add a batch to see it here.
              </p>
            ) : (
              latestBatchGrantees.map((row) => (
                <LatestBatchCard
                  key={`${row.batchNo}-${row.program}`}
                  row={row}
                  onClick={() => {
                    const params = new URLSearchParams()
                    params.set("batchNo", String(row?.batchNo ?? ""))
                    if (row?.program) params.set("program", String(row.program))
                    params.set("from", "add-grantees")
                    navigate(`/osgfa/batch-info?${params.toString()}`)
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <section
        aria-label="Grantee preview from spreadsheet"
        className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6"
      >
        <div className="min-w-0 space-y-4 border-b border-slate-100 pb-4 dark:border-white/10">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Preview — rows to be added</h2>
          </div>

          <UploadField
            id="previewGranteesXlsx"
            label="Upload Excel for preview"
            hint=""
            accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            icon={FileSpreadsheet}
            file={previewExcelFile}
            onChange={(event) => {
              setNotice("")
              setPreviewExcelFile(event.target.files?.[0] ?? null)
            }}
          />
        </div>

        <div className="min-w-0 space-y-3 pt-4">
          {!previewExcelFile ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/30 dark:text-slate-300">
              Choose an Excel file to load rows into the table below (for example after using Convert &amp; download).
            </p>
          ) : previewLoading ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/30 dark:text-slate-300">
              Reading spreadsheet…
            </p>
          ) : previewError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">{previewError}</p>
          ) : previewTableRows.length > 0 ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6">
                <div className="max-h-[min(420px,55vh)] overflow-auto [scrollbar-gutter:stable]">
                  <table className="w-full min-w-[900px] text-xs sm:text-sm [&_th]:px-2 [&_th]:py-2.5 [&_td]:px-2 [&_td]:py-2.5 sm:[&_th]:px-3 sm:[&_td]:px-3">
                    <thead className="sticky top-0 z-1 bg-slate-100/95 text-slate-700 backdrop-blur-sm dark:bg-slate-900/90 dark:text-slate-200">
                      <tr className="[&>th]:border-b [&>th]:border-slate-200/90 [&>th]:text-left [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide dark:[&>th]:border-white/10">
                        <th className="w-[90px]">Batch no.</th>
                        <th className="w-[80px]">Seq no</th>
                        <th className="w-[110px]">Student ID</th>
                        <th className="w-[260px]">Award number</th>
                        <th className="w-[240px]">Fullname</th>
                        <th className="w-[140px]">Enrolled program</th>
                        <th className="w-[120px]">Year level</th>
                      </tr>
                    </thead>

                    <tbody className="[&>tr:nth-child(even)]:bg-slate-50/80 dark:[&>tr:nth-child(even)]:bg-white/3">
                      {previewPagedRows.map((row, index) => (
                        <tr
                          key={previewRowKey(row, index)}
                          className="border-t border-slate-200/80 transition-colors hover:bg-slate-100/60 dark:border-white/8 dark:hover:bg-white/5"
                        >
                          <td className="w-[90px] whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">
                            {row.batchNo || "—"}
                          </td>
                          <td className="w-[80px] whitespace-nowrap font-medium text-pink-600 dark:text-pink-400">{row.seqNo || "—"}</td>
                          <td className="w-[110px] whitespace-nowrap text-blue-600 dark:text-sky-300">
                            {formatStudentId(row.studentId, "listCard")}
                          </td>
                          <td className="w-[260px] max-w-[260px] truncate whitespace-nowrap font-mono text-xs sm:text-sm">
                            {row.awardNumber || "—"}
                          </td>
                          <td className="w-[240px] max-w-[240px] truncate whitespace-nowrap font-medium">{row.fullName || "—"}</td>
                          <td className="w-[140px] max-w-[140px] truncate whitespace-nowrap">{row.enrolledProgram || "—"}</td>
                          <td className="w-[120px] whitespace-nowrap">{row.yearLevel || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-xs">
                <p className="text-slate-600 dark:text-slate-300">
                  Showing{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {(previewPage - 1) * PREVIEW_PAGE_SIZE + 1}-{Math.min(previewPage * PREVIEW_PAGE_SIZE, previewTableRows.length)}
                  </span>{" "}
                  of <span className="font-semibold text-slate-900 dark:text-white">{previewTableRows.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    disabled={previewPage <= 1}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-700 shadow-sm transition disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                  >
                    Prev
                  </button>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">
                    Page <span className="font-semibold text-slate-900 dark:text-white">{previewPage}</span> / {previewPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewPage((p) => Math.min(previewPageCount, p + 1))}
                    disabled={previewPage >= previewPageCount}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-700 shadow-sm transition disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/35 dark:text-amber-100">
              No recognizable grantee rows in the first sheet. Use headers such as Batch No, Seq No, Student ID, Award Number, Full Name, Program / Course, and Year Level.
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button form="add-grantees-form" type="submit" className="bg-[#081F5C] hover:bg-[#0b2d83]">
              Save Grantees
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm adding batch grantees</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <p>Are you sure you want to add this batch of grantees?</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-slate-900/40">
              <p>
                <span className="font-semibold">Batch:</span> {String(batchNo).trim() || "—"}
              </p>
              <p>
                <span className="font-semibold">Rows:</span> {savedGranteeRows.length}
              </p>
              <p>
                <span className="font-semibold">Program:</span> {String(program).trim() || "—"}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmOpen(false)
                setNotice("Submission cancelled.")
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#081F5C] hover:bg-[#0b2d83]"
              onClick={() => {
                setConfirmOpen(false)
                finalizeSubmit()
              }}
            >
              Yes, add grantees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
