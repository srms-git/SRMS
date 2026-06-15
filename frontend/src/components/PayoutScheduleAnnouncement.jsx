import { BellRing, CalendarClock, Info, TriangleAlert } from "lucide-react"

import {
  formatPayoutDateLabel,
  getPayoutIndicatorStatus,
  PAYOUT_INDICATOR_STATUS,
} from "@/lib/payoutScheduleAnnouncements"
import { cn } from "@/lib/utils"

const BADGE_STYLES = {
  [PAYOUT_INDICATOR_STATUS.SCHEDULED]: {
    shell:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/35 dark:bg-sky-500/12 dark:text-sky-100",
    label: "Scheduled",
    title: "Payout scheduled for this batch",
  },
  [PAYOUT_INDICATOR_STATUS.READY]: {
    shell:
      "border-amber-200 bg-amber-50 text-amber-900 motion-safe:animate-pulse dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-100",
    label: "Payout due",
    title: "Scheduled payout date has been reached",
  },
}

const ALERT_STYLES = {
  [PAYOUT_INDICATOR_STATUS.SCHEDULED]: {
    Icon: Info,
    shell:
      "border-sky-300/90 bg-sky-50 text-sky-950 shadow-[inset_4px_0_0_0_#0ea5e9] dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-50",
    iconWrap: "bg-sky-100 text-sky-700 ring-sky-200/80 dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-500/35",
    eyebrow: "Scheduled payout notice",
    headline: "Payout scheduled for this batch",
    message:
      "A payout date has been posted for this batch. Grantees should prepare requirements and monitor this page for updates.",
    dateLabel: "Scheduled payout date",
    dateText: "text-sky-900 dark:text-sky-100",
  },
  [PAYOUT_INDICATOR_STATUS.READY]: {
    Icon: TriangleAlert,
    shell:
      "border-amber-300/90 bg-amber-50 text-amber-950 shadow-[inset_4px_0_0_0_#f59e0b] dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50",
    iconWrap: "bg-amber-100 text-amber-700 ring-amber-200/80 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-500/35",
    eyebrow: "Action required",
    headline: "Payout date reached — action needed",
    message:
      "The scheduled payout date for this batch is today or has passed. Coordinate with the Cashier's Office and inform affected grantees.",
    dateLabel: "Payout date",
    dateText: "text-amber-900 dark:text-amber-100",
  },
}

export function PayoutScheduleBadge({ status = PAYOUT_INDICATOR_STATUS.READY, className, compact = false }) {
  const meta = BADGE_STYLES[status] ?? BADGE_STYLES[PAYOUT_INDICATOR_STATUS.READY]
  const Icon = status === PAYOUT_INDICATOR_STATUS.SCHEDULED ? BellRing : CalendarClock

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        meta.shell,
        compact
          ? "px-1 py-px text-[8px] sm:px-2 sm:py-0.5 sm:text-[10px] md:text-[11px]"
          : "px-2 py-0.5 text-[11px]",
        className,
      )}
      title={meta.title}
    >
      <Icon className={cn("shrink-0", compact ? "size-2.5 sm:size-3" : "size-3")} aria-hidden />
      {meta.label}
    </span>
  )
}

export function PayoutScheduleAnnouncementCard({ announcement, className, variant = "default" }) {
  if (!announcement) return null

  const payoutDate = announcement.payoutDate
  const status = getPayoutIndicatorStatus(announcement) ?? PAYOUT_INDICATOR_STATUS.SCHEDULED
  const styles = ALERT_STYLES[status]
  const Icon = styles.Icon
  const program = String(announcement.payoutProgram ?? "").trim().toUpperCase()
  const batchNo = String(announcement.payoutBatchNo ?? "").trim()
  const isLanding = variant === "landing"

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5 text-sm shadow-sm",
        styles.shell,
        className,
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
            styles.iconWrap,
          )}
        >
          <Icon className="size-4" strokeWidth={2.25} aria-hidden />
        </span>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">System notice</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-90">{styles.eyebrow}</p>
            <p className="text-base font-semibold leading-snug">{announcement.title || styles.headline}</p>
            <p className="text-xs leading-relaxed opacity-90">
              {announcement.description?.trim() || styles.message}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-md border border-current/15 bg-white/70 px-2 py-1 text-[11px] font-semibold dark:bg-black/10">
              {program || "—"}
            </span>
            <span className="inline-flex rounded-md border border-current/15 bg-white/70 px-2 py-1 text-[11px] font-semibold dark:bg-black/10">
              Batch {batchNo || "—"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-current/20 px-2.5 py-1 text-[11px] font-bold",
                status === PAYOUT_INDICATOR_STATUS.READY ? "bg-amber-100/90 dark:bg-amber-500/15" : "bg-sky-100/90 dark:bg-sky-500/15",
              )}
            >
              <CalendarClock className="size-3.5 shrink-0" aria-hidden />
              <span className="font-semibold">{styles.dateLabel}:</span>
              <span className={styles.dateText}>{formatPayoutDateLabel(payoutDate)}</span>
            </span>
          </div>

          {isLanding && status === PAYOUT_INDICATOR_STATUS.READY ? (
            <p className="rounded-lg border border-amber-300/60 bg-amber-100/70 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-50">
              Proceed to the Cashier&apos;s Office on the 1st Floor of the Auxiliary Building to claim your financial
              assistance.
            </p>
          ) : null}

          {!isLanding && status === PAYOUT_INDICATOR_STATUS.SCHEDULED ? (
            <p className="text-[11px] font-medium leading-relaxed opacity-80">
              This notice stays visible while the payout announcement is active. A payout badge appears on batch lists
              when the scheduled date is reached.
            </p>
          ) : null}
        </div>

        <PayoutScheduleBadge status={status} className="hidden shrink-0 sm:inline-flex" />
      </div>
    </div>
  )
}
