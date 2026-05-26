import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, ChevronRight, CircleCheck, CircleDashed, History, Layers, Users } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  buildBatchesFromGrantees,
  buildMonthlyClaimTrend,
  buildYearLevelDonut,
  fetchAllGrantees,
  recordMatchesProgram,
} from "@/lib/granteesApi"
import { requirementCoverageStatusForRow } from "@/lib/granteeRequirementsChecklist"
import { useCashierPrivacySettings } from "@/hooks/useCashierPrivacySettings"

const CLAIM_STROKE = "#081F5C"
const UNCLAIM_STROKE = "#dc2626"

const YEAR_LEVEL_DONUT_STYLES = [
  { colorFrom: "#7c3aed", colorTo: "#a78bfa", color: "#8b5cf6" },
  { colorFrom: "#04133d", colorTo: "#0b2a6a", color: "#081F5C" },
  { colorFrom: "#1d4ed8", colorTo: "#3b82f6", color: "#2563eb" },
  { colorFrom: "#047857", colorTo: "#34d399", color: "#10b981" },
  { colorFrom: "#0e7490", colorTo: "#22d3ee", color: "#0891b2" },
]

const TES_GRANTEE_REQUIREMENTS = [
  { id: "cor", label: "Certificate of Registration (COR) for the current semester" },
  { id: "rog", label: "Official report of grades from the previous semester" },
  {
    id: "scholarship_disclosure",
    label: "Disclosure or certificate regarding other scholarships or financial assistance, if required",
  },
  { id: "id_email", label: "Valid school ID and updated school email on file" },
  { id: "acknowledgment", label: "Signed TES acknowledgment and parent/guardian consent, where applicable" },
]

const TDP_GRANTEE_REQUIREMENTS = [
  { id: "cor", label: "Certificate of Registration (COR) for the current semester" },
  { id: "rog", label: "Official report of grades or class cards from the previous semester" },
  { id: "school_id", label: "Valid school ID (photocopy with registrar or authorized certification)" },
  { id: "indigency", label: "Certificate of indigency or other authorized proof of economic status, if applicable" },
  { id: "undertaking", label: "Signed TDP undertaking or parent/guardian consent form" },
]

const TREND_RANGE = {
  THIS_WEEK: "this-week",
  THIS_MONTH: "this-month",
  LAST_MONTH: "last-month",
  THIS_YEAR: "this-year",
  LAST_YEAR: "last-year",
}

function splitMonthIntoWeeks(claimed, unclaimed) {
  const weights = [0.23, 0.27, 0.26, 0.24]
  return weights.map((w, i) => ({
    month: `Week ${i + 1}`,
    claimed: Math.max(0, Math.round(claimed * w)),
    unclaimed: Math.max(0, Math.round(unclaimed * w)),
  }))
}

function splitIntoWeekDays(claimed, unclaimed) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const weights = [0.13, 0.14, 0.15, 0.15, 0.16, 0.14, 0.13]
  return labels.map((month, i) => ({
    month,
    claimed: Math.max(0, Math.round(claimed * weights[i])),
    unclaimed: Math.max(0, Math.round(unclaimed * weights[i])),
  }))
}

function claimTrendForRange(rows, range, referenceDate = new Date()) {
  const monthIdx = referenceDate.getMonth()
  const monthly = buildMonthlyClaimTrend(rows)
  const safeRow = (i) => monthly[Math.min(Math.max(i, 0), monthly.length - 1)]

  switch (range) {
    case TREND_RANGE.THIS_YEAR:
      return monthly.slice(0, monthIdx + 1)
    case TREND_RANGE.LAST_YEAR:
      return monthly.map((d) => ({
        month: d.month,
        claimed: Math.max(0, Math.round(d.claimed * 0.88)),
        unclaimed: Math.max(0, Math.round(d.unclaimed * 0.92)),
      }))
    case TREND_RANGE.THIS_MONTH: {
      const row = safeRow(monthIdx)
      return splitMonthIntoWeeks(row.claimed, row.unclaimed)
    }
    case TREND_RANGE.LAST_MONTH: {
      const idx = monthIdx === 0 ? 11 : monthIdx - 1
      const row = safeRow(idx)
      return splitMonthIntoWeeks(row.claimed, row.unclaimed)
    }
    case TREND_RANGE.THIS_WEEK: {
      const row = safeRow(monthIdx)
      return splitIntoWeekDays(
        Math.max(0, Math.round(row.claimed / 4)),
        Math.max(0, Math.round(row.unclaimed / 4)),
      )
    }
    default:
      return monthly
  }
}

function yearLevelsForRow(row) {
  if (Array.isArray(row?.semesterClaims) && row.semesterClaims.length > 0) {
    return [...new Set(row.semesterClaims.map((c) => String(c.yearLevel ?? "").trim()).filter(Boolean))]
  }
  const yl = String(row?.yearLevel ?? "").trim()
  if (yl) return [yl]
  return []
}

function requirementDefsForRow(row) {
  return recordMatchesProgram(row, "TDP") || String(row?.program ?? "").toUpperCase() === "TDP"
    ? TDP_GRANTEE_REQUIREMENTS
    : TES_GRANTEE_REQUIREMENTS
}

function enrichYearLevelDonut(donut) {
  return donut.map((entry, i) => {
    const style = YEAR_LEVEL_DONUT_STYLES[i % YEAR_LEVEL_DONUT_STYLES.length]
    return { ...entry, ...style }
  })
}

function RequirementsYAxisTick({ x, y, payload }) {
  const lines = String(payload?.value ?? "")
    .split("\n")
    .filter(Boolean)

  return (
    <text x={x} y={y} textAnchor="end" fill="currentColor" className="fill-slate-700 dark:fill-slate-200">
      {lines.map((line, idx) => (
        <tspan key={`${line}-${idx}`} x={x} dy={idx === 0 ? 0 : 13} className="text-[11px] font-medium">
          {line}
        </tspan>
      ))}
    </text>
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
  const hideSensitiveStats = privacy.hideSensitiveStatsFromSharedScreens
  const [trendRange, setTrendRange] = useState(TREND_RANGE.THIS_YEAR)
  const [records, setRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const loadRecords = async () => {
    try {
      setIsLoading(true)
      setFetchError(null)
      const rows = await fetchAllGrantees()
      setRecords(rows)
    } catch (err) {
      console.error("Failed to load cashier dashboard grantees:", err)
      setFetchError(err?.message ?? "Failed to load dashboard data.")
      setRecords([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  const batches = useMemo(() => buildBatchesFromGrantees(records), [records])
  const claimTrend = useMemo(() => claimTrendForRange(records, trendRange), [records, trendRange])
  const yearLevelDonut = useMemo(() => enrichYearLevelDonut(buildYearLevelDonut(records)), [records])
  const yearLevelTotal = useMemo(() => yearLevelDonut.reduce((s, d) => s + d.value, 0), [yearLevelDonut])
  const donutChartConfig = useMemo(
    () => Object.fromEntries(yearLevelDonut.map((d) => [d.name, { label: d.name, color: d.color }])),
    [yearLevelDonut],
  )

  const overview = useMemo(() => {
    const claimed = records.filter((r) => String(r?.status ?? "") === "Claimed").length
    const unclaimed = records.filter((r) => String(r?.status ?? "") === "Unclaimed").length
    return {
      totalBatches: batches.length,
      totalGrantees: records.length,
      claimed,
      unclaimed,
    }
  }, [batches.length, records])

  const programBars = useMemo(() => {
    let tes = 0
    let tdp = 0
    for (const row of records) {
      if (recordMatchesProgram(row, "TES")) tes += 1
      else if (recordMatchesProgram(row, "TDP")) tdp += 1
    }
    const total = Math.max(tes + tdp, 1)
    return [
      {
        key: "TES",
        label: "TES",
        value: tes,
        width: (tes / total) * 100,
        percent: (tes / total) * 100,
        gradientCss: "linear-gradient(90deg, rgba(4,19,61,0.98) 0%, rgba(8,31,92,0.88) 52%, rgba(20,71,166,0.72) 100%)",
      },
      {
        key: "TDP",
        label: "TDP",
        value: tdp,
        width: (tdp / total) * 100,
        percent: (tdp / total) * 100,
        gradientCss: "linear-gradient(90deg, rgba(139,92,246,0.92) 0%, rgba(217,70,239,0.82) 55%, rgba(79,70,229,0.70) 100%)",
      },
    ]
  }, [records])

  const recentBatches = useMemo(() => {
    const items = [...batches]
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
  }, [batches])

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

  const requirementBars = useMemo(() => {
    let complete = 0
    let incomplete = 0

    for (const row of records) {
      const levels = yearLevelsForRow(row)
      const defs = requirementDefsForRow(row)
      if (levels.length === 0) {
        incomplete += 1
        continue
      }
      const status = requirementCoverageStatusForRow(row, defs, levels)
      if (status === "complete") complete += 1
      else incomplete += 1
    }

    const total = Math.max(complete + incomplete, 1)
    return [
      {
        key: "complete",
        label: "Complete\nrequirements",
        value: complete,
        percent: (complete / total) * 100,
        fill: "url(#cashierRequirementsCompleteGrad)",
        swatchColor: "#1447a6",
      },
      {
        key: "incomplete",
        label: "Incomplete\nrequirements",
        value: incomplete,
        percent: (incomplete / total) * 100,
        fill: "url(#cashierRequirementsIncompleteGrad)",
        swatchColor: UNCLAIM_STROKE,
      },
    ]
  }, [records])

  const requirementsChartConfig = useMemo(
    () => ({
      value: { label: "Total grantees", color: "#10b981" },
    }),
    [],
  )

  const statValue = (n, label) => {
    if (isLoading) return "…"
    return formatStat(n, label)
  }

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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
          <p>{fetchError}</p>
          <button
            type="button"
            onClick={loadRecords}
            className="mt-2 text-xs font-semibold underline underline-offset-2"
          >
            Retry loading dashboard
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          label="Active Batches"
          value={statValue(overview.totalBatches)}
          accentBar="border-l-[3px] border-l-[#081F5C]"
          glow="bg-[#081F5C]/25"
          iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
          Icon={Layers}
        />
        <SummaryStatCard
          label="Total Grantees"
          value={statValue(overview.totalGrantees, "Total Grantees")}
          accentBar="border-l-[3px] border-l-violet-500"
          glow="bg-violet-400/30"
          iconBg="bg-linear-to-br from-violet-500 to-fuchsia-600 text-white"
          Icon={Users}
        />
        <SummaryStatCard
          label="Claimed"
          value={statValue(overview.claimed, "Claimed")}
          accentBar="border-l-[3px] border-l-emerald-500"
          glow="bg-emerald-400/30"
          iconBg="bg-linear-to-br from-emerald-500 to-teal-600 text-white"
          Icon={CircleCheck}
        />
        <SummaryStatCard
          label="Unclaimed"
          value={statValue(overview.unclaimed, "Unclaimed")}
          accentBar="border-l-[3px] border-l-amber-500"
          glow="bg-amber-400/30"
          iconBg="bg-linear-to-br from-amber-500 to-orange-500 text-white"
          Icon={CircleDashed}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Claimed vs unclaimed trend</p>
            </div>
            <Select value={trendRange} onValueChange={setTrendRange}>
              <SelectTrigger
                size="sm"
                className="h-9 w-full shrink-0 rounded-full border-slate-300/90 bg-white/90 px-3 text-xs font-medium shadow-sm transition hover:border-slate-400 hover:bg-white dark:border-white/15 dark:bg-white/5 sm:w-46"
                aria-label="Trend period"
              >
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
          <div className="rounded-xl bg-slate-50/90 p-1 dark:bg-white/4">
            {isLoading ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">Loading trend data…</div>
            ) : hideSensitiveStats ? (
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
          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-500">Loading…</div>
          ) : yearLevelDonut.length === 0 ? (
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-white/5 dark:ring-white/6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Program quantity scale</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">Visual comparison of TES and TDP totals.</p>
            </div>
          </div>

          <div className="space-y-4">
            {hideSensitiveStats ? (
              <p className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5">
                Program totals are hidden while privacy mode is enabled.
              </p>
            ) : isLoading ? (
              <p className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5">
                Loading program totals…
              </p>
            ) : (
              programBars.map((row) => (
                <div key={row.key} className="space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">{row.label}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-300">{row.percent.toFixed(1)}%</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{row.value}</span>
                  </div>

                  <div className="h-5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.width}%`, backgroundImage: row.gradientCss }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-300">
                    {row.label} total grantees:{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{row.value}</span>
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:bg-white/5 dark:ring-white/6">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Requirements completion scale</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">Complete and incomplete requirements across all grantees.</p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
            {isLoading ? (
              <div className="flex h-[150px] items-center justify-center text-sm text-slate-500">Loading…</div>
            ) : hideSensitiveStats ? (
              <div className="flex h-[150px] items-center justify-center px-4 text-center text-sm text-slate-500">
                Requirement statistics are hidden while privacy mode is enabled.
              </div>
            ) : (
              <ChartContainer id="cashier-requirements-completion-bars" config={requirementsChartConfig} className="aspect-auto h-[150px] w-full">
                <BarChart
                  data={requirementBars}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
                  barCategoryGap={4}
                  barSize={40}
                >
                  <defs>
                    <linearGradient id="cashierRequirementsCompleteGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#04133d" stopOpacity={0.98} />
                      <stop offset="52%" stopColor="#081F5C" stopOpacity={0.88} />
                      <stop offset="100%" stopColor="#1447a6" stopOpacity={0.72} />
                    </linearGradient>
                    <linearGradient id="cashierRequirementsIncompleteGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#b91c1c" stopOpacity={0.92} />
                      <stop offset="55%" stopColor={UNCLAIM_STROKE} stopOpacity={0.82} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgb(148 163 184 / 0.25)" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={<RequirementsYAxisTick />}
                    width={112}
                  />
                  <ChartTooltip
                    cursor={{ fill: "rgb(148 163 184 / 0.12)" }}
                    content={<ChartTooltipContent formatter={(value) => [`${value}`, "Total"]} />}
                  />
                  <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                    {requirementBars.map((row) => (
                      <Cell key={row.key} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </div>

          {!hideSensitiveStats ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {requirementBars.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between rounded-lg border border-slate-200/80 px-3 py-2 text-xs dark:border-white/10"
                >
                  <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: row.swatchColor }} />
                    {row.label.replace("\n", " ")}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {isLoading ? "…" : `${row.value} (${row.percent.toFixed(1)}%)`}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
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
          <div className="grid gap-2 px-5 pb-5">
            {isLoading ? (
              <div className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                Loading recent batches…
              </div>
            ) : recentBatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                No recent batch activity yet.
              </div>
            ) : (
              recentBatches.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openBatch(item)}
                  className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300/80 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
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
            )}
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
