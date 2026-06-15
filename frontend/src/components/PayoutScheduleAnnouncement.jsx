import { CalendarClock, Megaphone } from "lucide-react"

import { formatPayoutDateLabel, isPayoutDateMet } from "@/lib/payoutScheduleAnnouncements"
import { cn } from "@/lib/utils"

export function PayoutScheduleBadge({ className, compact = false }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-400 font-bold uppercase tracking-wide text-slate-900 shadow-sm ring-1 ring-amber-500/40",
        compact ? "px-1.5 py-px text-[8px] sm:px-2 sm:py-0.5 sm:text-[9px]" : "px-2 py-0.5 text-[10px]",
        className,
      )}
      title="Payout schedule date reached"
    >
      <CalendarClock className={compact ? "size-2.5 shrink-0 sm:size-3" : "size-3 shrink-0"} aria-hidden />
      Payout
    </span>
  )
}

export function PayoutScheduleAnnouncementCard({ announcement, className, variant = "default" }) {
  if (!announcement) return null

  const payoutDate = announcement.payoutDate
  const dateMet = isPayoutDateMet(payoutDate)
  const program = String(announcement.payoutProgram ?? "").trim().toUpperCase()
  const batchNo = String(announcement.payoutBatchNo ?? "").trim()

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm ring-1",
        dateMet
          ? "border-amber-200/80 bg-linear-to-r from-amber-50 via-white to-white ring-amber-200/60"
          : "border-[#081F5C]/15 bg-linear-to-r from-[#081F5C]/6 via-white to-white ring-[#081F5C]/10",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2.5",
          dateMet
            ? "border-amber-200/70 bg-linear-to-r from-amber-500/90 via-amber-400 to-amber-500 text-slate-900"
            : "border-[#081F5C]/10 bg-linear-to-r from-[#04133d]/95 via-[#081F5C] to-[#1447a6] text-white",
        )}
      >
        <Megaphone className="size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-90">Payout schedule</p>
          <p className="truncate text-sm font-semibold">{announcement.title || "Payout announcement"}</p>
        </div>
        {dateMet ? <PayoutScheduleBadge /> : null}
      </div>

      <div className="space-y-2 px-4 py-3">
        {announcement.description?.trim() ? (
          <p className="text-sm leading-relaxed text-slate-600">{announcement.description}</p>
        ) : null}
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Program</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{program || "—"}</dd>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Batch</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{batchNo ? `Batch ${batchNo}` : "—"}</dd>
          </div>
          <div
            className={cn(
              "rounded-lg border px-3 py-2",
              dateMet ? "border-amber-200 bg-amber-50/80" : "border-slate-200/80 bg-white/80",
            )}
          >
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payout date</dt>
            <dd className={cn("mt-0.5 font-semibold", dateMet ? "text-amber-900" : "text-slate-900")}>
              {formatPayoutDateLabel(payoutDate)}
            </dd>
          </div>
        </dl>
        {variant === "landing" && dateMet ? (
          <p className="text-xs font-medium text-amber-800">
            The scheduled payout date has been reached. Proceed to the Cashier&apos;s Office to claim your financial
            assistance.
          </p>
        ) : null}
      </div>
    </div>
  )
}
