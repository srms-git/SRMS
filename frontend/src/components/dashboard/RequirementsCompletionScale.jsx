import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ChartBarSkeleton } from "@/lib/osgfaContentReveal"
import { cn } from "@/lib/utils"

function RequirementsYAxisTick({ x, y, payload }) {
  const text = String(payload?.value ?? "").trim()
  if (!text) return null

  return (
    <text x={x} y={y} textAnchor="end" fill="currentColor" className="fill-slate-700 dark:fill-slate-200">
      <tspan x={x} dy={0} className="text-[10px] font-medium sm:text-[11px]">
        {text}
      </tspan>
    </text>
  )
}

export function RequirementsCompletionScale({
  bars,
  chartId,
  chartConfig,
  hideSensitiveStats = false,
  isLoading = false,
  skeletonLeaving = false,
  hiddenMessage = "Requirement statistics are hidden while privacy mode is enabled.",
  className,
}) {
  const completeGradId = `${chartId}-complete`
  const incompleteGradId = `${chartId}-incomplete`

  const chartBars = bars.map((row) => ({
    ...row,
    chartLabel: row.chartLabel ?? row.label?.replace(/\n/g, " ") ?? row.key,
    fill: row.key === "complete" ? `url(#${completeGradId})` : `url(#${incompleteGradId})`,
  }))

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="relative flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
        {(isLoading || skeletonLeaving) && (
          <div
            className={cn(
              "flex min-h-[140px] flex-1 flex-col transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !isLoading && "pointer-events-none absolute inset-0 z-0 opacity-0",
            )}
            aria-busy={isLoading}
            aria-hidden={!isLoading}
          >
            <ChartBarSkeleton className="h-full min-h-[140px] flex-1 border-0 bg-transparent p-0 shadow-none ring-0" chartClassName="h-full min-h-[140px]" />
          </div>
        )}

        {!isLoading && (
          <div className="relative z-10 flex min-h-[140px] flex-1 flex-col">
            {hideSensitiveStats ? (
              <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
                {hiddenMessage}
              </div>
            ) : (
              <ChartContainer
                id={chartId}
                config={chartConfig}
                className="h-full min-h-[140px] w-full flex-1 aspect-auto [&_.recharts-responsive-container]:!h-full"
                initialDimension={{ width: 400, height: 200 }}
              >
                <BarChart
                  data={chartBars}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  barCategoryGap="28%"
                  barSize={32}
                >
                  <defs>
                    <linearGradient id={completeGradId} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#047857" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id={incompleteGradId} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#b91c1c" stopOpacity={0.92} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0.82} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgb(148 163 184 / 0.25)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    domain={[0, "auto"]}
                  />
                  <YAxis
                    type="category"
                    dataKey="chartLabel"
                    tickLine={false}
                    axisLine={false}
                    tick={<RequirementsYAxisTick />}
                    width={96}
                  />
                  <ChartTooltip
                    cursor={{ fill: "rgb(148 163 184 / 0.12)" }}
                    content={
                      <ChartTooltipContent
                        formatter={(value, _name, item) => [
                          `${value} (${Number(item?.payload?.percent ?? 0).toFixed(1)}%)`,
                          item?.payload?.label ?? "Grantees",
                        ]}
                      />
                    }
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {chartBars.map((row) => (
                      <Cell key={row.key} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </div>
        )}
      </div>

      {!hideSensitiveStats && !isLoading ? (
        <div className="mt-2 grid shrink-0 grid-cols-1 gap-1.5 sm:grid-cols-2">
          {bars.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between rounded-lg border border-slate-200/80 px-2.5 py-1.5 text-[11px] dark:border-white/10"
            >
              <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: row.swatchColor }} />
                <span className="truncate">{row.label?.replace(/\n/g, " ") ?? row.key}</span>
              </span>
              <span className="ml-2 shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">
                {row.value} ({row.percent.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
