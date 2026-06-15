import { CalendarClock } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatLinkedBatchLabel, formatScheduleSummary } from "@/lib/announcementBatchLink"
import { cn } from "@/lib/utils"

export function PayoutScheduleBadge({ announcement, className, onOpenDetails }) {
  if (!announcement) return null

  const summary = formatScheduleSummary(announcement)
  const label = summary || "Payout scheduled"

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onOpenDetails?.(announcement)
      }}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 transition hover:border-amber-300 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-100 dark:hover:bg-amber-500/18",
        className,
      )}
      aria-label={`Payout scheduled. ${label}. Open details.`}
      title={label}
    >
      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">Payout scheduled</span>
    </button>
  )
}

export function PayoutSchedulePanel({ announcement, className }) {
  if (!announcement) return null

  const scheduleSummary = formatScheduleSummary(announcement)
  const description = String(announcement.description ?? "").trim()
  const title = String(announcement.title ?? "Payout schedule").trim()

  return (
    <section
      className={cn(
        "rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 shadow-sm ring-1 ring-amber-200/50 dark:border-amber-500/25 dark:bg-amber-500/10 dark:ring-amber-500/20",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
          <CalendarClock className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800/80 dark:text-amber-100/80">
            Payout schedule
          </p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          {scheduleSummary ? <p className="text-sm text-slate-700 dark:text-slate-200">{scheduleSummary}</p> : null}
          {description ? (
            <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{description}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function PayoutScheduleDetailsDialog({ announcement, open, onOpenChange }) {
  if (!announcement) return null

  const batchLabel = formatLinkedBatchLabel(announcement)
  const scheduleSummary = formatScheduleSummary(announcement)
  const description = String(announcement.description ?? "").trim()
  const title = String(announcement.title ?? "Payout schedule").trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          {batchLabel ? (
            <p>
              <span className="font-semibold text-slate-900 dark:text-white">Batch: </span>
              {batchLabel}
            </p>
          ) : null}
          {scheduleSummary ? (
            <p>
              <span className="font-semibold text-slate-900 dark:text-white">Schedule: </span>
              {scheduleSummary}
            </p>
          ) : null}
          {description ? (
            <p className="whitespace-pre-wrap rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              {description}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
