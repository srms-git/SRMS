import { cn } from "@/lib/utils"

function batchLabel(count) {
  return `${count} batch${count === 1 ? "" : "es"}`
}

function ProgramQuantityRow({ row }) {
  const barWidth = row.value > 0 ? Math.max(row.width, 3) : 0
  const displayName = row.fullName || row.name || row.label

  return (
    <li className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-900/2 transition-colors hover:border-slate-300/90 dark:border-white/10 dark:bg-slate-950/40 dark:ring-white/5 dark:hover:border-white/15">
      <div className="flex gap-3">
        <span
          className="flex h-9 min-w-[2.5rem] shrink-0 items-center justify-center self-center rounded-lg px-1.5 text-[11px] font-bold uppercase tracking-tight text-white shadow-sm"
          style={{ backgroundColor: row.barColor }}
          aria-hidden
        >
          {row.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-white">{row.label}</p>
              <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">{displayName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold leading-none tabular-nums text-slate-900 dark:text-white">{row.value}</p>
              <p
                className="mt-1 text-[10px] font-semibold tabular-nums text-slate-600 dark:text-slate-300"
                style={{ color: row.barColor }}
              >
                {row.percent.toFixed(1)}%
              </p>
            </div>
          </div>

          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
            role="progressbar"
            aria-valuenow={row.value}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${row.label} share of grantees`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${barWidth}%`, backgroundColor: row.barColor }}
            />
          </div>

          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">{batchLabel(row.batchCount ?? 0)}</span>
            <span> in this program</span>
          </p>
        </div>
      </div>
    </li>
  )
}

export function ProgramQuantityScale({
  rows,
  hideSensitiveStats = false,
  hiddenMessage = "Program totals are hidden while privacy mode is enabled.",
  emptyMessage = "No active programs configured.",
  className,
}) {
  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      {hideSensitiveStats ? (
        <p className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-7 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/5">
          {hiddenMessage}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-7 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/5">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <ProgramQuantityRow key={row.key} row={row} />
          ))}
        </ul>
      )}
    </div>
  )
}
