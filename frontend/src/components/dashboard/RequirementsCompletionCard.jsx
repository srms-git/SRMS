import { useMemo, useState } from "react"

import { RequirementsCompletionScale } from "@/components/dashboard/RequirementsCompletionScale"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  REQUIREMENTS_SCALE_FILTER_ALL,
  REQUIREMENTS_SEM_FILTER_ALL,
  REQUIREMENTS_SEM_FILTER_FIRST,
  REQUIREMENTS_SEM_FILTER_SECOND,
  buildRequirementsCompletionBars,
  requirementsCompletionSubtitle,
} from "@/lib/dashboardRequirementsScale"
import { cn } from "@/lib/utils"

const requirementsChartConfig = {
  value: { label: "Total grantees", color: "#10b981" },
}

export function RequirementsCompletionCard({
  records,
  activePrograms = [],
  hideSensitiveStats = false,
  isLoading = false,
  skeletonLeaving = false,
  chartId,
  className,
  style,
}) {
  const [programFilter, setProgramFilter] = useState(REQUIREMENTS_SCALE_FILTER_ALL)
  const [semesterFilter, setSemesterFilter] = useState(REQUIREMENTS_SEM_FILTER_ALL)

  const requirementBars = useMemo(
    () => buildRequirementsCompletionBars(records, { programFilter, semesterFilter }),
    [records, programFilter, semesterFilter],
  )

  const subtitle = useMemo(
    () => requirementsCompletionSubtitle({ programFilter, semesterFilter, activePrograms }),
    [programFilter, semesterFilter, activePrograms],
  )

  const programOptions = useMemo(
    () =>
      (activePrograms ?? [])
        .filter((p) => p && p.active !== false && String(p.code ?? "").trim())
        .map((p) => {
          const code = String(p.code).trim().toUpperCase()
          const name = String(p.name ?? code).trim() || code
          return { code, label: name !== code ? `${name} (${code})` : code }
        }),
    [activePrograms],
  )

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-white/5 dark:ring-white/6",
        className,
      )}
      style={style}
    >
      <div className="mb-3 shrink-0 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Requirements completion scale</p>
          <p className="text-xs text-slate-500 dark:text-slate-300">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger
              size="sm"
              className="h-9 w-full rounded-full border-slate-300/90 bg-white/90 px-3 text-xs font-medium shadow-sm transition hover:border-slate-400 hover:bg-white dark:border-white/15 dark:bg-white/5 sm:min-w-[10.5rem] sm:flex-1"
              aria-label="Filter by program"
            >
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Program:</span>
              <SelectValue placeholder="All programs" />
            </SelectTrigger>
            <SelectContent align="start" className="rounded-xl">
              <SelectItem value={REQUIREMENTS_SCALE_FILTER_ALL}>All programs</SelectItem>
              {programOptions.map(({ code, label }) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger
              size="sm"
              className="h-9 w-full rounded-full border-slate-300/90 bg-white/90 px-3 text-xs font-medium shadow-sm transition hover:border-slate-400 hover:bg-white dark:border-white/15 dark:bg-white/5 sm:min-w-[10.5rem] sm:flex-1"
              aria-label="Filter by semester"
            >
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Semester:</span>
              <SelectValue placeholder="All semesters" />
            </SelectTrigger>
            <SelectContent align="start" className="rounded-xl">
              <SelectItem value={REQUIREMENTS_SEM_FILTER_ALL}>All semesters</SelectItem>
              <SelectItem value={REQUIREMENTS_SEM_FILTER_FIRST}>1st semester</SelectItem>
              <SelectItem value={REQUIREMENTS_SEM_FILTER_SECOND}>2nd semester</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <RequirementsCompletionScale
        className="min-h-0 flex-1"
        chartId={chartId}
        bars={requirementBars}
        chartConfig={requirementsChartConfig}
        hideSensitiveStats={hideSensitiveStats}
        isLoading={isLoading}
        skeletonLeaving={skeletonLeaving}
      />
    </div>
  )
}
