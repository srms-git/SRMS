import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Hash,
  Info,
  Layers,
  Loader2,
  TableProperties,
  UploadCloud,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import {
  batchSaveGrantees,
  buildBatchesFromGrantees,
  buildLatestBatchGranteeCards,
  fetchAllGrantees,
} from "@/lib/granteesApi"
import { isBatchVisibleOnLanding, useLandingBatchVisibility } from "@/lib/landingFeaturedBatches"
import { downloadGranteePdfAsXlsx, parseGranteeXlsxFromFile } from "@/lib/granteePdfConverterApi"
import { useOsgfaPrivacySettings } from "@/hooks/useOsgfaPrivacySettings"
import {
  BatchCardSkeleton,
  SummaryStatCardSkeleton,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"
import { cn } from "@/lib/utils"

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

const fieldLabelClass = "text-xs font-semibold text-slate-700 dark:text-slate-200"
const selectFieldClass =
  "h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/25 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100"
const inputFieldClass =
  "h-11 rounded-xl border-slate-200 bg-white pl-10 pr-3 text-sm shadow-sm focus-visible:ring-[#081F5C]/25 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100"

const osgfaCardClass =
  "relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/8"
const osgfaCardGlowClass =
  "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#081F5C]/8 blur-2xl dark:bg-[#1447a6]/12"
const osgfaIconWrapClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#081F5C]/12 text-[#081F5C] shadow-inner ring-1 ring-[#081F5C]/15 dark:bg-[#081F5C]/25 dark:text-sky-300 dark:ring-white/10"
const osgfaEyebrowClass = "text-[11px] font-bold uppercase tracking-[0.12em] text-[#081F5C] dark:text-sky-300"
const osgfaSubPanelClass =
  "rounded-xl border border-slate-200/80 bg-slate-50/70 dark:border-white/10 dark:bg-slate-950/30"
const osgfaUploadZoneClass =
  "group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-3 transition-colors hover:border-[#081F5C]/45 hover:bg-slate-100/80 dark:border-white/15 dark:bg-slate-950/30 dark:hover:border-[#081F5C]/40 dark:hover:bg-slate-900/50"
const osgfaPrimaryBtnClass = "bg-[#081F5C] hover:bg-[#0b2d83] dark:bg-[#081F5C] dark:hover:bg-[#0b2d83]"
const osgfaStepBadgeClass =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#04133d] via-[#081F5C] to-[#1447a6] text-[11px] font-bold text-white shadow-sm"

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
    if (variant === "warning") {
      return {
        Icon: CircleAlert,
        iconWrap: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-500/30",
        topBar: "from-amber-500 via-amber-600 to-orange-500",
        title: title || "Action required",
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

function FormNoticeBanner({ variant = "warning", title, message, onDismiss }) {
  const meta = useMemo(() => {
    if (variant === "success") {
      return {
        Icon: CircleCheck,
        iconWrap: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-500/30",
        box: "border-emerald-300/80 bg-emerald-50 ring-emerald-500/15 dark:border-emerald-500/35 dark:bg-emerald-950/40",
        titleClass: "text-emerald-950 dark:text-emerald-100",
        bodyClass: "text-emerald-900 dark:text-emerald-200/90",
      }
    }
    if (variant === "error") {
      return {
        Icon: CircleAlert,
        iconWrap: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-500/30",
        box: "border-red-300/80 bg-red-50 ring-red-500/15 dark:border-red-500/35 dark:bg-red-950/40",
        titleClass: "text-red-950 dark:text-red-100",
        bodyClass: "text-red-900 dark:text-red-200/90",
      }
    }
    if (variant === "info") {
      return {
        Icon: Info,
        iconWrap: "bg-[#081F5C]/8 text-[#081F5C] ring-[#081F5C]/15 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-500/30",
        box: "border-[#081F5C]/20 bg-slate-50 ring-[#081F5C]/10 dark:border-sky-500/25 dark:bg-slate-950/50",
        titleClass: "text-slate-900 dark:text-white",
        bodyClass: "text-slate-700 dark:text-slate-300",
      }
    }
    return {
      Icon: CircleAlert,
      iconWrap: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-500/30",
      box: "border-amber-300/90 bg-amber-50 ring-amber-500/20 dark:border-amber-500/40 dark:bg-amber-950/45",
      titleClass: "text-amber-950 dark:text-amber-50",
      bodyClass: "text-amber-900 dark:text-amber-100/90",
    }
  }, [variant])

  const Icon = meta.Icon

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm ring-1 ${meta.box}`}
    >
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${meta.iconWrap}`}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {title ? <p className={`text-sm font-semibold ${meta.titleClass}`}>{title}</p> : null}
        <p className={`text-sm leading-relaxed ${title ? "mt-0.5" : ""} ${meta.bodyClass}`}>{message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  )
}

function SummaryStatCard({ label, value, accentBar, glow, iconBg, Icon, className, style }) {
  return (
    <div
      className={cn(
        `group relative min-h-[124px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6 ${accentBar}`,
        className,
      )}
      style={style}
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

function SectionCardHeader({ eyebrow, title, description, icon: Icon, badge }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
      <div className={osgfaIconWrapClass} aria-hidden>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={osgfaEyebrowClass}>{eyebrow}</p>
          {badge ? badge : null}
        </div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {description ? (
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
  )
}

function UploadField({ id, label, hint, accept, icon: Icon, file, onChange, compact = false }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>

      <label htmlFor={id} className={`${osgfaUploadZoneClass} ${compact ? "min-h-0" : "min-h-[108px]"}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#081F5C]/10 text-[#081F5C] dark:text-sky-300">
          <Icon className="h-5 w-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <UploadCloud className="h-4 w-4 text-[#081F5C] dark:text-sky-300" aria-hidden />
            Click to upload file
          </p>
          {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
          <p className={`truncate text-xs font-medium text-slate-700 dark:text-slate-300 ${hint ? "mt-2" : "mt-1"}`}>
            {file ? file.name : "No file selected"}
          </p>
        </div>

        <span className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:border-white/15 dark:bg-slate-900 dark:text-slate-200">
          Browse
        </span>
      </label>

      <input id={id} type="file" accept={accept} className="hidden" onChange={onChange} />
    </div>
  )
}

const CONVERTER_STEPS = [
  { step: "1", title: "Upload PDF", detail: "Grantee list from CHED or source PDF" },
  { step: "2", title: "Convert & download", detail: "Get a formatted .xlsx file" },
  { step: "3", title: "Import below", detail: "Use the preview section to add grantees" },
]

function OptionalBadge() {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-300">
      Optional
    </span>
  )
}

function PdfToExcelConverterPanel({ file, loading, error, onFileChange, onConvert }) {
  return (
    <section
      aria-label="PDF to Excel converter"
      aria-busy={loading}
      className={`${osgfaCardClass} flex h-full min-h-0 flex-col p-4`}
    >
      <div className={osgfaCardGlowClass} aria-hidden />

      <div className="relative flex min-h-0 flex-1 flex-col space-y-4">
        <SectionCardHeader
          eyebrow="Step 1 · Prepare file"
          title="PDF to Excel converter"
          description="For PDF lists only — converts to .xlsx for Step 3. Does not save grantees."
          icon={FileText}
          badge={
            <>
              <OptionalBadge />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-300">
                <FileText className="h-3 w-3 text-[#081F5C] dark:text-sky-300" aria-hidden />
                PDF
                <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
                <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
                Excel
              </span>
            </>
          }
        />

        <div className="grid min-h-0 flex-1 min-w-0 gap-3 md:grid-cols-[minmax(0,168px)_minmax(0,1fr)] md:items-stretch">
          <ol className="flex flex-col gap-1.5 self-start">
            {CONVERTER_STEPS.map((item) => (
              <li key={item.step} className={`flex gap-2 p-2.5 ${osgfaSubPanelClass}`}>
                <span className={osgfaStepBadgeClass} aria-hidden>
                  {item.step}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className={`relative flex min-h-0 flex-1 flex-col space-y-2.5 p-3 ${osgfaSubPanelClass}`}>
            {loading ? (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/90 px-4 dark:bg-slate-950/85"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-8 w-8 animate-spin text-[#081F5C] dark:text-sky-300" aria-hidden />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Converting to Excel…</p>
              </div>
            ) : null}

            <label htmlFor="converterPdf" className={fieldLabelClass}>
              Grantee list PDF
            </label>

            <label
              htmlFor="converterPdf"
              className={
                file
                  ? `group flex min-h-[108px] flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-emerald-500/70 bg-emerald-50/90 px-3 py-3 ring-2 ring-emerald-500/20 transition-colors dark:border-emerald-400/50 dark:bg-emerald-950/35 dark:ring-emerald-400/15 ${loading ? "pointer-events-none opacity-50" : ""}`
                  : `${osgfaUploadZoneClass} min-h-[108px] flex-1 ${loading ? "pointer-events-none opacity-50" : ""}`
              }
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                  file
                    ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                    : "bg-[#081F5C]/10 text-[#081F5C] dark:text-sky-300"
                }`}
              >
                {file ? <FileText className="h-5 w-5" aria-hidden /> : <UploadCloud className="h-5 w-5" aria-hidden />}
              </div>
              <div className="min-w-0 flex-1">
                {file ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      PDF attached
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white" title={file.name}>
                      {file.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-700/90 dark:text-emerald-300/80">
                      Ready to convert — click Browse to replace
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Choose PDF file</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">No file selected</p>
                  </>
                )}
              </div>
              <span
                className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-sm ${
                  file
                    ? "border-emerald-300 bg-white text-emerald-900 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-200"
                    : "border-slate-300 bg-white text-slate-700 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                {file ? "Replace" : "Browse"}
              </span>
            </label>
            <input
              id="converterPdf"
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={loading}
              onChange={onFileChange}
            />

            <Button
              type="button"
              className={`w-full gap-2 ${osgfaPrimaryBtnClass}`}
              disabled={!file || loading}
              onClick={onConvert}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {loading ? "Converting…" : "Convert & download .xlsx"}
            </Button>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                The downloaded file works with the Excel preview uploader in Step 3.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function LatestBatchesAside({ loading, skeletonLeaving, contentRevealed, batches, onBatchClick }) {
  return (
    <aside className={`${osgfaCardClass} flex h-full min-h-0 flex-col p-4`}>
      <div className={osgfaCardGlowClass} aria-hidden />
      <div className="relative mb-3 shrink-0 border-b border-slate-100 pb-3 dark:border-white/10">
        {/* <p className={osgfaEyebrowClass}>Recent batches</p> */}
        <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">Latest added batches</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Click a batch to open its details.</p>
      </div>
      <div className="relative min-h-[8rem] flex-1">
        {(loading || skeletonLeaving) && (
          <div
            className={cn(
              "grid min-h-0 grid-cols-1 gap-2 overflow-y-auto pr-1 [scrollbar-gutter:stable] transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !loading && "pointer-events-none absolute inset-0 z-0 opacity-0",
            )}
            aria-busy={loading}
            aria-hidden={!loading}
            aria-label="Loading latest batches"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <BatchCardSkeleton key={index} />
            ))}
          </div>
        )}
        {!loading && (
          <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
            {batches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/30 dark:text-slate-300">
                No grantee batches saved yet. Add a batch to see it here.
              </p>
            ) : (
              batches.map((row, index) => (
                <div
                  key={`${row.batchNo}-${row.program}`}
                  className={revealItemClass(contentRevealed, index, 45)}
                  style={revealItemStyle(contentRevealed, index, 45)}
                >
                  <LatestBatchCard row={row} onClick={() => onBatchClick(row)} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
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
  const [formNotice, setFormNotice] = useState(null)
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
  const landingVisibility = useLandingBatchVisibility()

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
    const allBatches = buildBatchesFromGrantees(granteeRecords)
    let tesBatches = 0
    let tdpBatches = 0
    let publishedBatches = 0

    for (const batch of allBatches) {
      const program = String(batch.program ?? "").trim().toUpperCase()
      if (program === "TES") tesBatches += 1
      else if (program === "TDP") tdpBatches += 1
      if (isBatchVisibleOnLanding(batch, landingVisibility)) publishedBatches += 1
    }

    return {
      totalBatches: allBatches.length,
      tesBatches,
      tdpBatches,
      publishedBatches,
    }
  }, [granteeRecords, landingVisibility])

  const latestBatchGrantees = useMemo(
    () => buildLatestBatchGranteeCards(granteeRecords, 8),
    [granteeRecords]
  )

  const { contentRevealed, skeletonLeaving } = useContentReveal(granteesLoading)

  const statDisplay = (value, label) => formatStat(value, label)

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
    setFormNotice({
      variant: "info",
      title: "Saving grantees",
      message: "Saving batch records to the database…",
    })
    
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

      setFormNotice(null)
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

      setFormNotice({ variant: "error", title: friendlyTitle, message: friendlyMsg })
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
      const title = "Missing required fields"
      const message =
        "Please complete Program, Batch Number, Academic Year, and upload an Excel file (.xlsx) in the Preview section."
      setFormNotice({ variant: "warning", title, message })
      showAlert("warning", message, title)
      return
    }

    if (!hasRows) {
      const title = "No grantee rows found"
      const message = "No grantee rows loaded from the spreadsheet. Check column headers and try again."
      setFormNotice({ variant: "warning", title, message })
      showAlert("warning", message, title)
      return
    }

    setFormNotice(null)
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
        <FormNoticeBanner variant="warning" title="Could not load grantee records" message={granteesLoadError} />
      ) : null}

      {formNotice ? (
        <FormNoticeBanner
          variant={formNotice.variant}
          title={formNotice.title}
          message={formNotice.message}
          onDismiss={() => setFormNotice(null)}
        />
      ) : null}

      <div className="relative min-h-[124px]">
        {(granteesLoading || skeletonLeaving) && (
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !granteesLoading && "pointer-events-none absolute inset-0 z-0 opacity-0",
            )}
            aria-busy={granteesLoading}
            aria-hidden={!granteesLoading}
          >
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-[#081F5C]" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-emerald-500" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-amber-500" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-violet-500" />
          </div>
        )}
        {!granteesLoading && (
          <div className="relative z-10 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <SummaryStatCard
              label="Total Batches"
              value={statDisplay(summary.totalBatches, "Total Batches")}
              accentBar="border-l-[3px] border-l-[#081F5C]"
              glow="bg-[#081F5C]/25"
              iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
              Icon={TableProperties}
              className={revealItemClass(contentRevealed, 0, 60)}
              style={revealItemStyle(contentRevealed, 0, 60)}
            />
            <SummaryStatCard
              label="TES Records"
              value={statDisplay(summary.tesBatches, "TES Records")}
              accentBar="border-l-[3px] border-l-emerald-500"
              glow="bg-emerald-400/30"
              iconBg="bg-linear-to-br from-emerald-500 to-teal-600 text-white"
              Icon={CircleCheck}
              className={revealItemClass(contentRevealed, 1, 60)}
              style={revealItemStyle(contentRevealed, 1, 60)}
            />
            <SummaryStatCard
              label="TDP Records"
              value={statDisplay(summary.tdpBatches, "TDP Records")}
              accentBar="border-l-[3px] border-l-amber-500"
              glow="bg-amber-400/30"
              iconBg="bg-linear-to-br from-amber-500 to-orange-500 text-white"
              Icon={CircleDashed}
              className={revealItemClass(contentRevealed, 2, 60)}
              style={revealItemStyle(contentRevealed, 2, 60)}
            />
            <SummaryStatCard
              label="Published Batches"
              value={statDisplay(summary.publishedBatches, "Published Batches")}
              accentBar="border-l-[3px] border-l-violet-500"
              glow="bg-violet-400/30"
              iconBg="bg-linear-to-br from-violet-500 to-fuchsia-600 text-white"
              Icon={Layers}
              className={revealItemClass(contentRevealed, 3, 60)}
              style={revealItemStyle(contentRevealed, 3, 60)}
            />
          </div>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:items-stretch">
        <PdfToExcelConverterPanel
          file={converterPdfFile}
          loading={converterLoading}
          error={converterError}
          onFileChange={(event) => {
            setConverterError("")
            setConverterPdfFile(event.target.files?.[0] ?? null)
          }}
          onConvert={handleConvertAndDownload}
        />

        <LatestBatchesAside
          loading={granteesLoading}
          skeletonLeaving={skeletonLeaving}
          contentRevealed={contentRevealed}
          batches={latestBatchGrantees}
          onBatchClick={(row) => {
            const params = new URLSearchParams()
            params.set("batchNo", String(row?.batchNo ?? ""))
            if (row?.program) params.set("program", String(row.program))
            params.set("from", "add-grantees")
            navigate(`/osgfa/batch-info?${params.toString()}`)
          }}
        />
      </div>

      <form id="add-grantees-form" className="w-full min-w-0" onSubmit={handleSubmit}>
        <section
          aria-label="Add grantees batch details"
          className="w-full space-y-6 border-b border-slate-200/80 py-8 dark:border-white/10"
        >
          <SectionCardHeader
            eyebrow="Step 2 · Batch details"
            title="Add Grantees"
            description="Choose the program, batch number, and academic year for this import."
            icon={GraduationCap}
          />

          <div className="space-y-6">
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="program" className={fieldLabelClass}>
                Program
              </label>
              <div className="relative">
                <select
                  id="program"
                  value={program}
                  onChange={(event) => {
                    setFormNotice(null)
                    setProgram(event.target.value)
                  }}
                  className={selectFieldClass}
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
              <label htmlFor="batchNo" className={fieldLabelClass}>
                Batch Number
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  id="batchNo"
                  type="text"
                  placeholder="Enter batch number"
                  value={batchNo}
                  onChange={(event) => {
                    setFormNotice(null)
                    setBatchNo(event.target.value)
                  }}
                  className={inputFieldClass}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-[#081F5C] dark:text-sky-300" aria-hidden />
              <span className={fieldLabelClass}>Academic Year</span>
            </div>

            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="fromYear" className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  From
                </label>
                <div className="relative">
                  <select
                    id="fromYear"
                    value={fromYear}
                    onChange={(event) => {
                      setFormNotice(null)
                      const nextFrom = event.target.value
                      setFromYear(nextFrom)
                      setToYear(nextFrom ? String(Number(nextFrom) + 1) : "")
                    }}
                    className={selectFieldClass}
                  >
                    <option value="" disabled>
                      Select start year
                    </option>
                    {academicYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="toYear" className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  To
                </label>
                <div className="relative">
                  <select
                    id="toYear"
                    value={toYear}
                    onChange={(event) => {
                      setFormNotice(null)
                      setToYear(event.target.value)
                    }}
                    className={selectFieldClass}
                  >
                    <option value="" disabled>
                      Select end year
                    </option>
                    {academicYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Preview</span>
                <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm shadow-sm dark:border-white/10 dark:bg-slate-950/40">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">AY</span>
                  <span className="font-bold tabular-nums text-[#081F5C] dark:text-sky-300">
                    {fromYear && toYear ? `${fromYear}–${toYear}` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          </div>

        </section>
      </form>

      <section aria-label="Grantee preview from spreadsheet" className={osgfaCardClass}>
        <div className={osgfaCardGlowClass} aria-hidden />
        <div className="relative space-y-5">
          <SectionCardHeader
            eyebrow="Step 3 · Import & preview"
            title="Upload Excel & review rows"
            description="Upload the grantee spreadsheet (from Step 1 or your own file), review the table, then save when batch details are complete."
            icon={FileSpreadsheet}
          />

          <UploadField
            id="previewGranteesXlsx"
            label="Grantee list Excel (.xlsx)"
            hint="Accepted: .xlsx or .xls"
            accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            icon={FileSpreadsheet}
            file={previewExcelFile}
            onChange={(event) => {
              setFormNotice(null)
              setPreviewExcelFile(event.target.files?.[0] ?? null)
            }}
          />

        <div className="min-w-0 space-y-3">
          {!previewExcelFile ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/30 dark:text-slate-300">
              Choose an Excel file to load rows into the table below (for example after using the PDF converter above).
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

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <div className="min-w-0 flex-1 space-y-3">
              {formNotice && (formNotice.variant === "warning" || formNotice.variant === "error") ? (
                <FormNoticeBanner
                  variant={formNotice.variant}
                  title={formNotice.title}
                  message={formNotice.message}
                  onDismiss={() => setFormNotice(null)}
                />
              ) : null}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saves grantees using the batch details from Step 2.
              </p>
            </div>
            <Button form="add-grantees-form" type="submit" className={`shrink-0 ${osgfaPrimaryBtnClass}`}>
              Save Grantees
            </Button>
          </div>
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
                setFormNotice({
                  variant: "info",
                  title: "Submission cancelled",
                  message: "No grantees were saved.",
                })
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
