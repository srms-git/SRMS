import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, ChevronRight, CircleCheck, CircleDashed, History, Layers, Users } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { ConnectionProblemState } from "@/components/ConnectionProblemState"
import { ProgramQuantityScale } from "@/components/dashboard/ProgramQuantityScale"
import { RequirementsCompletionCard } from "@/components/dashboard/RequirementsCompletionCard"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  buildBatchesFromGrantees,
  buildProgramQuantityBars,
  buildYearLevelDonut,
  programQuantityScaleSubtitle,
} from "@/lib/granteesApi"
import {
  buildBatchFilterOptions,
  buildSemestralOptions,
  claimTrendForRange,
  filterRecordsForTrendBatch,
  parseTrendBatchFilter,
  TREND_BATCH_ALL,
  TREND_RANGE,
  TREND_SEMESTRAL_ALL,
  trendFilterBatchTriggerClass,
  trendFilterRowClass,
  trendFilterTriggerClass,
} from "@/lib/claimTrendFilters"
import { useGranteesQuery } from "@/hooks/useSrmsQueries"
import { useCashierPrivacySettings } from "@/hooks/useCashierPrivacySettings"
import { useOsgfaPrograms } from "@/hooks/useOsgfaPrograms"
import { getBatchLandingKey, isBatchVisibleOnLanding, useLandingBatchVisibility } from "@/lib/landingFeaturedBatches"
import {
  ChartAreaSkeleton,
  ChartDonutSkeleton,
  RecentBatchItemSkeleton,
  SummaryStatCardSkeleton,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"
import { cn } from "@/lib/utils"

const CLAIM_STROKE = "#081F5C"
const UNCLAIM_STROKE = "#dc2626"

const YEAR_LEVEL_DONUT_STYLES = [
  { colorFrom: "#7c3aed", colorTo: "#a78bfa", color: "#8b5cf6" },
  { colorFrom: "#04133d", colorTo: "#0b2a6a", color: "#081F5C" },
  { colorFrom: "#1d4ed8", colorTo: "#3b82f6", color: "#2563eb" },
  { colorFrom: "#047857", colorTo: "#34d399", color: "#10b981" },
  { colorFrom: "#0e7490", colorTo: "#22d3ee", color: "#0891b2" },
]

function enrichYearLevelDonut(donut) {
  return donut.map((entry, i) => {
    const style = YEAR_LEVEL_DONUT_STYLES[i % YEAR_LEVEL_DONUT_STYLES.length]
    return { ...entry, ...style }
  })
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
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

export default function CashierDashboard() {
  const navigate = useNavigate()
  const { formatStat, privacy } = useCashierPrivacySettings()
  const { activePrograms } = useOsgfaPrograms()
  const hideSensitiveStats = privacy.hideSensitiveStatsFromSharedScreens
  const [trendBatchFilter, setTrendBatchFilter] = useState(TREND_BATCH_ALL)
  const [trendSemestralFilter, setTrendSemestralFilter] = useState(TREND_SEMESTRAL_ALL)
  const [trendRange, setTrendRange] = useState(TREND_RANGE.THIS_YEAR)
  const {
    data: records = [],
    isLoading,
    error: granteesError,
    refetch: loadRecords,
  } = useGranteesQuery()
  const fetchError = granteesError?.message ?? null
  const landingVisibility = useLandingBatchVisibility()

  const { contentRevealed, skeletonLeaving } = useContentReveal(isLoading)

  const batches = useMemo(() => buildBatchesFromGrantees(records), [records])
  const publishedBatches = useMemo(
    () => batches.filter((batch) => isBatchVisibleOnLanding(batch, landingVisibility)),
    [batches, landingVisibility],
  )
  const publishedRecords = useMemo(() => {
    const publishedKeys = new Set(publishedBatches.map((batch) => getBatchLandingKey(batch)))
    return records.filter((row) =>
      publishedKeys.has(
        getBatchLandingKey({
          batchNo: row?.batchNo,
          program: row?.program,
          schoolYear: row?.academicYear ?? row?.schoolYear,
        }),
      ),
    )
  }, [records, publishedBatches])

  useEffect(() => {
    setTrendSemestralFilter(TREND_SEMESTRAL_ALL)
  }, [trendBatchFilter])

  const batchFilterOptions = useMemo(() => buildBatchFilterOptions(publishedBatches), [publishedBatches])
  const trendRows = useMemo(
    () => filterRecordsForTrendBatch(publishedRecords, trendBatchFilter),
    [publishedRecords, trendBatchFilter],
  )
  const selectedBatchYear = useMemo(() => parseTrendBatchFilter(trendBatchFilter)?.schoolYear ?? "", [trendBatchFilter])
  const semestralOptions = useMemo(
    () => buildSemestralOptions(trendRows, selectedBatchYear),
    [trendRows, selectedBatchYear],
  )
  const claimTrend = useMemo(
    () => claimTrendForRange(trendRows, trendRange, trendSemestralFilter, selectedBatchYear),
    [trendRows, trendRange, trendSemestralFilter, selectedBatchYear],
  )
  const yearLevelDonut = useMemo(() => enrichYearLevelDonut(buildYearLevelDonut(publishedRecords)), [publishedRecords])
  const yearLevelTotal = useMemo(() => yearLevelDonut.reduce((s, d) => s + d.value, 0), [yearLevelDonut])
  const donutChartConfig = useMemo(
    () => Object.fromEntries(yearLevelDonut.map((d) => [d.name, { label: d.name, color: d.color }])),
    [yearLevelDonut],
  )

  const overview = useMemo(() => {
    const claimed = publishedRecords.filter((r) => String(r?.status ?? "") === "Claimed").length
    const unclaimed = publishedRecords.filter((r) => String(r?.status ?? "") === "Unclaimed").length
    return {
      totalBatches: publishedBatches.length,
      totalGrantees: publishedRecords.length,
      claimed,
      unclaimed,
    }
  }, [publishedBatches.length, publishedRecords])

  const programBars = useMemo(
    () => buildProgramQuantityBars(publishedRecords, activePrograms),
    [publishedRecords, activePrograms],
  )
  const programScaleSubtitle = useMemo(
    () => programQuantityScaleSubtitle(activePrograms),
    [activePrograms],
  )

  const recentBatches = useMemo(() => {
    const items = [...publishedBatches]
      .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
      .slice(0, 4)

    return items.map((b, idx) => {
      const programLabel = String(b?.program ?? "—").trim().toUpperCase()
      const schoolYear = String(b?.schoolYear ?? "—").trim()
      const batchNo = String(b?.batchNo ?? "—").trim()
      const createdAt = b?.createdAt ? new Date(b.createdAt) : null
      const when = createdAt
        ? createdAt.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" })
        : `Record ${idx + 1}`

      return {
        key: `${batchNo}|${programLabel}|${schoolYear}`,
        title: `Batch ${batchNo}`,
        program: programLabel,
        schoolYear,
        batchNo,
        tone: "linear-gradient(145deg, rgba(4,19,61,0.98) 0%, rgba(8,31,92,0.88) 52%, rgba(20,71,166,0.72) 100%)",
        when,
      }
    })
  }, [publishedBatches])

  const quickActions = useMemo(
    () => [
      {
        key: "batches",
        label: "Batches",
        desc: "View and manage scholarship batches",
        Icon: Layers,
        tone: "linear-gradient(145deg, rgba(4,19,61,0.98) 0%, rgba(8,31,92,0.88) 52%, rgba(20,71,166,0.72) 100%)",
        onClick: () => navigate("/cashier/batches"),
      },
      {
        key: "claim-history",
        label: "Claim history",
        desc: "Review past scholarship claims",
        Icon: History,
        tone: "linear-gradient(145deg, rgba(4,120,87,0.95) 0%, rgba(16,185,129,0.82) 55%, rgba(52,211,153,0.72) 100%)",
        onClick: () => navigate("/cashier/claim-history"),
      },
      {
        key: "archive",
        label: "Archive",
        desc: "Browse archived batches",
        Icon: Archive,
        tone: "linear-gradient(145deg, rgba(185,28,28,0.92) 0%, rgba(220,38,38,0.82) 55%, rgba(239,68,68,0.70) 100%)",
        onClick: () => navigate("/cashier/archive"),
      },
    ],
    [navigate],
  )

  const statValue = (n, label) => formatStat(n, label)

  const openBatch = (item) => {
    const params = new URLSearchParams()
    params.set("batchNo", String(item.batchNo ?? ""))
    params.set("program", String(item.program ?? ""))
    params.set("academicYear", String(item.schoolYear ?? ""))
    navigate(`/cashier/batch-info?${params.toString()}`)
  }

  return (
    <section className="w-full min-w-0 max-w-full space-y-4">
      <div className="rounded-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6] p-5 text-white shadow-md shadow-[#04133d]/20">
        <h1 className="text-xl font-bold tracking-tight">Cashier Dashboard</h1>
        <p className="mt-1 text-sm text-sky-100/90">
          Overview of grantees, claim status, program activity, and quick access to cashier workspaces.
        </p>
      </div>

      {fetchError ? (
        <ConnectionProblemState
          error={fetchError}
          onRetry={loadRecords}
          subject="dashboard"
        />
      ) : null}

      <div className="relative min-h-[124px]">
        {(isLoading || skeletonLeaving) && (
          <div
            className={cn(
              "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !isLoading && "pointer-events-none absolute inset-0 z-0 opacity-0",
            )}
            aria-busy={isLoading}
            aria-hidden={!isLoading}
          >
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-[#081F5C]" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-violet-500" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-emerald-500" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-amber-500" />
          </div>
        )}
        {!isLoading && (
          <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryStatCard
              label="Active Batches"
              value={statValue(overview.totalBatches)}
              accentBar="border-l-[3px] border-l-[#081F5C]"
              glow="bg-[#081F5C]/25"
              iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
              Icon={Layers}
              className={revealItemClass(contentRevealed, 0, 60)}
              style={revealItemStyle(contentRevealed, 0, 60)}
            />
            <SummaryStatCard
              label="Total Grantees"
              value={statValue(overview.totalGrantees, "Total Grantees")}
              accentBar="border-l-[3px] border-l-violet-500"
              glow="bg-violet-400/30"
              iconBg="bg-linear-to-br from-violet-500 to-fuchsia-600 text-white"
              Icon={Users}
              className={revealItemClass(contentRevealed, 1, 60)}
              style={revealItemStyle(contentRevealed, 1, 60)}
            />
            <SummaryStatCard
              label="Claimed"
              value={statValue(overview.claimed, "Claimed")}
              accentBar="border-l-[3px] border-l-emerald-500"
              glow="bg-emerald-400/30"
              iconBg="bg-linear-to-br from-emerald-500 to-teal-600 text-white"
              Icon={CircleCheck}
              className={revealItemClass(contentRevealed, 2, 60)}
              style={revealItemStyle(contentRevealed, 2, 60)}
            />
            <SummaryStatCard
              label="Unclaimed"
              value={statValue(overview.unclaimed, "Unclaimed")}
              accentBar="border-l-[3px] border-l-amber-500"
              glow="bg-amber-400/30"
              iconBg="bg-linear-to-br from-amber-500 to-orange-500 text-white"
              Icon={CircleDashed}
              className={revealItemClass(contentRevealed, 3, 60)}
              style={revealItemStyle(contentRevealed, 3, 60)}
            />
          </div>
        )}
      </div>

      <div className="relative min-h-[320px]">
        {(isLoading || skeletonLeaving) && (
          <div
            className={cn(
              "grid grid-cols-1 gap-3 lg:grid-cols-3 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !isLoading && "pointer-events-none absolute inset-0 z-0 opacity-0",
            )}
            aria-busy={isLoading}
            aria-hidden={!isLoading}
          >
            <ChartAreaSkeleton className="lg:col-span-2" />
            <ChartDonutSkeleton />
          </div>
        )}
        {!isLoading && (
      <div
        className={cn(
          "relative z-10 grid grid-cols-1 gap-3 lg:grid-cols-3",
          revealItemClass(contentRevealed, 0),
        )}
        style={revealItemStyle(contentRevealed, 0)}
      >
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Claimed vs unclaimed trend</p>
            </div>
            <div className={trendFilterRowClass}>
              <Select value={trendBatchFilter} onValueChange={setTrendBatchFilter}>
                <SelectTrigger size="sm" className={trendFilterBatchTriggerClass} aria-label="Trend batch filter">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Batch:</span>
                  <SelectValue placeholder="All batches" />
                </SelectTrigger>
                <SelectContent align="end" className="rounded-xl">
                  <SelectItem value={TREND_BATCH_ALL}>All batches</SelectItem>
                  {batchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={trendSemestralFilter} onValueChange={setTrendSemestralFilter}>
                <SelectTrigger size="sm" className={trendFilterTriggerClass} aria-label="Trend semester filter">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Semester:</span>
                  <SelectValue placeholder="All semesters" />
                </SelectTrigger>
                <SelectContent align="end" className="rounded-xl">
                  <SelectItem value={TREND_SEMESTRAL_ALL}>All semesters</SelectItem>
                  {semestralOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={trendRange} onValueChange={setTrendRange}>
                <SelectTrigger size="sm" className={trendFilterTriggerClass} aria-label="Trend period">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Range:</span>
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent align="end" className="rounded-xl">
                  <SelectItem value={TREND_RANGE.THIS_WEEK}>This week</SelectItem>
                  <SelectItem value={TREND_RANGE.THIS_MONTH}>This month</SelectItem>
                  <SelectItem value={TREND_RANGE.LAST_MONTH}>Last month</SelectItem>
                  <SelectItem value={TREND_RANGE.THIS_YEAR}>This year</SelectItem>
                  <SelectItem value={TREND_RANGE.LAST_YEAR}>Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50/90 p-1 dark:bg-white/4">
            {hideSensitiveStats ? (
              <div className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-slate-500">
                Claim statistics are hidden while privacy mode is enabled.
              </div>
            ) : (
              <ChartContainer
                id="cashier-dashboard-monthly-trend"
                config={{
                  claimed: { label: "Claimed", color: CLAIM_STROKE },
                  unclaimed: { label: "Unclaimed", color: UNCLAIM_STROKE },
                }}
                className="aspect-auto h-[280px] w-full"
              >
                <AreaChart data={claimTrend} margin={{ top: 1, right: 8, left: 2, bottom: -2 }}>
                  <defs>
                    <linearGradient id="cashierDashboardTrendClaimed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CLAIM_STROKE} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CLAIM_STROKE} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="cashierDashboardTrendUnclaimed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={UNCLAIM_STROKE} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={UNCLAIM_STROKE} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(148 163 184 / 0.35)" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tick={{ fontSize: 11, fontWeight: 500 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                    width={34}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "rgb(148 163 184 / 0.55)", strokeWidth: 1 }}
                    content={<ChartTooltipContent />}
                  />
                  <Area
                    type="natural"
                    dataKey="unclaimed"
                    stroke={UNCLAIM_STROKE}
                    strokeWidth={1.5}
                    fill="url(#cashierDashboardTrendUnclaimed)"
                    fillOpacity={1}
                    activeDot={{ r: 4, strokeWidth: 1.5, stroke: "#fff" }}
                  />
                  <Area
                    type="natural"
                    dataKey="claimed"
                    stroke={CLAIM_STROKE}
                    strokeWidth={2}
                    fill="url(#cashierDashboardTrendClaimed)"
                    fillOpacity={1}
                    activeDot={{ r: 4, strokeWidth: 1.5, stroke: "#fff" }}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-start gap-x-6 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
              <span
                className="size-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-800"
                style={{ backgroundColor: CLAIM_STROKE }}
              />
              Claimed
            </span>
            <span className="inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
              <span
                className="size-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-800"
                style={{ backgroundColor: UNCLAIM_STROKE }}
              />
              Unclaimed
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6">
          <div className="mb-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Year level distribution</p>
          </div>
          {yearLevelDonut.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-500">
              No grantee year levels on record yet.
            </div>
          ) : (
            <>
              <div className="relative mx-auto min-h-[220px] w-full max-w-[300px]">
                <ChartContainer id="cashier-dashboard-year-donut" config={donutChartConfig} className="aspect-auto h-[220px] w-full">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      {yearLevelDonut.map((entry, i) => (
                        <linearGradient key={entry.name} id={`cashierDonutGrad-${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={entry.colorFrom} stopOpacity={0.98} />
                          <stop offset="100%" stopColor={entry.colorTo} stopOpacity={0.72} />
                        </linearGradient>
                      ))}
                    </defs>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={yearLevelDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="92%"
                      paddingAngle={3.5}
                      cornerRadius={7}
                      dataKey="value"
                      nameKey="name"
                      stroke="rgb(255 255 255 / 0.9)"
                      strokeWidth={2}
                    >
                      {yearLevelDonut.map((entry, index) => (
                        <Cell key={entry.name} fill={`url(#cashierDonutGrad-${index})`} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{yearLevelTotal}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {yearLevelDonut.map((row) => (
                  <div
                    key={row.name}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200/70 px-2 py-1.5 dark:border-white/10"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                    <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{row.name}</span>
                    <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
        <div
          className={cn(
            "flex h-full w-full flex-col rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-white/5 dark:ring-white/6",
            revealItemClass(contentRevealed, 1),
          )}
          style={revealItemStyle(contentRevealed, 1)}
        >
          <div className="mb-3 shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Program quantity scale</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">{programScaleSubtitle}</p>
            </div>
          </div>

          <ProgramQuantityScale
            className="min-h-0 flex-1"
            rows={programBars}
            hideSensitiveStats={hideSensitiveStats}
          />
        </div>

        <RequirementsCompletionCard
          records={publishedRecords}
          activePrograms={activePrograms}
          hideSensitiveStats={hideSensitiveStats}
          isLoading={isLoading}
          skeletonLeaving={skeletonLeaving}
          chartId="cashier-requirements-completion-bars"
          className={revealItemClass(contentRevealed, 2)}
          style={revealItemStyle(contentRevealed, 2)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-white/5 dark:ring-white/6 lg:col-span-3">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Recent batches</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">Latest batch activity across TES and TDP.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/cashier/batches")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="relative min-h-[6rem] grid gap-2 px-5 pb-5">
            {(isLoading || skeletonLeaving) && (
              <div
                className={cn(
                  "grid gap-2 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                  !isLoading && "pointer-events-none absolute inset-x-5 top-0 opacity-0",
                )}
                aria-hidden={!isLoading}
              >
                {Array.from({ length: 3 }, (_, index) => (
                  <RecentBatchItemSkeleton key={index} />
                ))}
              </div>
            )}
            {!isLoading && recentBatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                No published batches are available yet.
              </div>
            ) : !isLoading ? (
              recentBatches.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openBatch(item)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300/80 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8",
                    revealItemClass(contentRevealed, index),
                  )}
                  style={revealItemStyle(contentRevealed, index)}
                >
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/40 to-transparent opacity-70 dark:from-white/10" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                        style={{ backgroundImage: item.tone }}
                        aria-hidden
                      >
                        <Layers className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                          <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                            {item.program}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                            SY {item.schoolYear}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-300">
                          Batch no: <span className="font-semibold text-slate-700 dark:text-slate-200">{item.batchNo}</span>
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-xs font-medium tabular-nums text-slate-500 dark:text-slate-300">{item.when}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 transition group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
                        Open
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              ))
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-white/5 dark:ring-white/6 lg:col-span-2">
          <div className="mb-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Quick actions</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">Shortcuts to common cashier tasks.</p>
          </div>
          <div className="space-y-2">
            {quickActions.map(({ key, label, desc, Icon, tone, onClick }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                className="group flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-left transition hover:border-slate-300/90 hover:bg-white hover:shadow-sm dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundImage: tone }}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-300">{desc}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
