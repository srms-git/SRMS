import { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export const SKELETON_EXIT_MS = 280
export const SKELETON_ROW_COUNT = 8

export function revealItemClass(revealed, index, stepMs = 45) {
  return cn(
    "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:translate-y-0",
    revealed ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
  )
}

export function revealItemStyle(revealed, index, stepMs = 45) {
  return {
    transitionDelay: revealed ? `${Math.min(index, 12) * stepMs}ms` : "0ms",
  }
}

export function useContentReveal(isLoading) {
  const [contentRevealed, setContentRevealed] = useState(false)
  const [skeletonLeaving, setSkeletonLeaving] = useState(false)

  useEffect(() => {
    if (isLoading) {
      setContentRevealed(false)
      setSkeletonLeaving(false)
      return
    }

    setSkeletonLeaving(true)
    const revealFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setContentRevealed(true))
    })
    const hideSkeletonTimer = window.setTimeout(() => setSkeletonLeaving(false), SKELETON_EXIT_MS)

    return () => {
      cancelAnimationFrame(revealFrame)
      window.clearTimeout(hideSkeletonTimer)
    }
  }, [isLoading])

  return { contentRevealed, skeletonLeaving }
}

export function SummaryStatCardSkeleton({ accentBar, className }) {
  return (
    <div
      className={cn(
        `relative min-h-[124px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6 ${accentBar}`,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3 pr-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-14" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
    </div>
  )
}

export function GranteeTableRowSkeleton({ className, style, yearLevelClassName = "w-[110px]" }) {
  return (
    <tr className={cn("border-t border-slate-200/80", className)} style={style}>
      <td className="w-[90px]">
        <Skeleton className="h-4 w-10" />
      </td>
      <td className="w-[80px]">
        <Skeleton className="h-4 w-12" />
      </td>
      <td className="w-[110px]">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="w-[260px]">
        <Skeleton className="h-4 w-44 max-w-full" />
      </td>
      <td className="w-[240px]">
        <Skeleton className="h-4 w-36 max-w-full" />
      </td>
      <td className="w-[140px]">
        <Skeleton className="h-4 w-24 max-w-full" />
      </td>
      <td className={yearLevelClassName}>
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="text-center">
        <Skeleton className="mx-auto h-8 w-8 rounded-md" />
      </td>
    </tr>
  )
}

export function BatchCardSkeleton({ className, style }) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6",
        className,
      )}
      style={style}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-3 w-40 max-w-full" />
          <Skeleton className="h-5 w-28 max-w-full" />
          <div className="flex flex-wrap gap-2 pt-0.5">
            <Skeleton className="h-5 w-[4.5rem] rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-[4.75rem] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ArchiveBatchCardSkeleton({ className, style }) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6",
        className,
      )}
      style={style}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-5 w-28" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-[4.5rem] rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-[4.75rem] rounded-full" />
          </div>
          <Skeleton className="mt-1 h-16 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function AnnouncementCardSkeleton({ className, style }) {
  return (
    <li
      className={cn(
        "flex h-full min-h-[220px] w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm",
        className,
      )}
      style={style}
    >
      <div className="flex h-full min-h-[220px] w-full flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/60 bg-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        <div className="flex flex-1 flex-col gap-3 px-4 py-4">
          <Skeleton className="h-6 w-3/4 max-w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3 max-w-full" />
        </div>
      </div>
    </li>
  )
}

export function NotificationCardSkeleton({ className, style }) {
  return (
    <article
      className={cn(
        "h-[8.75rem] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm ring-1 ring-slate-900/3",
        className,
      )}
      style={style}
    >
      <div className="flex h-full items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 flex-1 max-w-[60%]" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5 max-w-full" />
          <Skeleton className="mt-auto h-3 w-32" />
        </div>
      </div>
    </article>
  )
}

export function ChartAreaSkeleton({ className }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <Skeleton className="h-[280px] w-full rounded-xl" />
      <div className="mt-3 flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

export function ChartBarSkeleton({ className, chartClassName = "h-[150px]" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6",
        className,
      )}
    >
      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <Skeleton className={cn("w-full rounded-xl", chartClassName)} />
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function PublicBatchCardSkeleton({ className, style }) {
  return (
    <div
      className={cn(
        "h-full min-h-[10.5rem] rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm ring-1 ring-slate-900/3 sm:min-h-[11rem] sm:p-5",
        className,
      )}
      style={style}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 shrink-0 rounded-2xl sm:size-[3.25rem]" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-5 w-32 max-w-full" />
          <Skeleton className="h-3 w-24" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-[5.5rem] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChartDonutSkeleton({ className }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6",
        className,
      )}
    >
      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-48 max-w-full" />
      </div>
      <Skeleton className="mx-auto h-[220px] w-[220px] max-w-full rounded-full" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}

export function ClaimHistoryTableRowSkeleton({ className, style }) {
  return (
    <tr className={cn("border-t border-slate-200/80", className)} style={style}>
      <td className="w-[100px]">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="w-[70px]">
        <Skeleton className="h-5 w-10 rounded-full" />
      </td>
      <td className="w-[80px]">
        <Skeleton className="h-4 w-10" />
      </td>
      <td className="w-[100px]">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="w-[220px]">
        <Skeleton className="h-4 w-36 max-w-full" />
      </td>
      <td className="w-[240px]">
        <Skeleton className="h-4 w-44 max-w-full" />
      </td>
      <td className="w-[110px]">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="w-[110px]">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="w-[120px]">
        <Skeleton className="h-5 w-16 rounded-full" />
      </td>
      <td className="text-center">
        <Skeleton className="mx-auto h-8 w-8 rounded-md" />
      </td>
    </tr>
  )
}

export function BatchListTableRowSkeleton({ className, style }) {
  return (
    <tr className={cn("border-b border-slate-100", className)} style={style}>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-12" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-8" />
      </td>
    </tr>
  )
}

export function SettingsPageSkeleton() {
  return (
    <div className="grid min-h-0 flex-1 items-stretch grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
      <aside className="h-full min-h-full rounded-2xl border border-[#081F5C]/10 bg-white/90 p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-28 max-w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="mb-3 h-px w-full" />
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, section) => (
            <div key={section} className="space-y-2">
              <Skeleton className="h-9 w-full rounded-md" />
              <div className="space-y-2 pl-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                {section < 2 ? <Skeleton className="h-4 w-24" /> : null}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <div className="h-full min-h-full rounded-2xl border border-[#081F5C]/10 bg-white/90 p-4 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="mt-6 space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function RecentBatchItemSkeleton({ className, style }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/5",
        className,
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

export function QuickActionSkeleton({ className, style }) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5",
        className,
      )}
      style={style}
    >
      <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-40 max-w-full" />
      </div>
      <Skeleton className="h-4 w-4 shrink-0 rounded" />
    </div>
  )
}
