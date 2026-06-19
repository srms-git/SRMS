import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Layers, Search, SlidersHorizontal } from "lucide-react"

import { useOsgfaPrograms } from "@/hooks/useOsgfaPrograms"
import { compareBatchesByBatchNo } from "@/lib/granteesApi"
import { usePublishedLandingBatches } from "@/lib/landingFeaturedBatches"
import { useLandingPageSettings, maskBatchNumber } from "@/lib/landingPageSettings"
import { isActiveProgramCode } from "@/lib/osgfaPrograms"
import {
  PublicBatchCardSkeleton,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"
import { cn } from "@/lib/utils"

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

const navyDeep = "#04133d"
const navy = "#081F5C"
const navyMuted = "#0b2b73"
const navyBright = "#1447a6"
const navyGlow = "#2a63cc"

const bvIce = "#eef2ff"
const bvPeriwinkle = "#e0e7ff"
const bvSoft = "#c7d2fe"
const bvViolet = "#a5b4fc"

const borderBvSoft = "rgba(99, 102, 241, 0.18)"
const textBodyOnLight = "rgba(8, 31, 92, 0.72)"

const gradientNavyButton = `linear-gradient(135deg, ${navy} 0%, ${navyMuted} 42%, ${navyBright} 78%, ${navyGlow} 100%)`
const gradientLightBlueViolet = `linear-gradient(155deg, #ffffff 0%, ${bvIce} 28%, ${bvPeriwinkle} 55%, #e9e5ff 100%)`
const gradientNavyHeader = `linear-gradient(135deg, ${navyDeep} 0%, ${navy} 35%, ${navyMuted} 62%, ${navyBright} 100%)`

function getBatchCardAccent(program) {
  const code = String(program ?? "").trim().toUpperCase()
  if (code === "TDP") {
    return { color: navyMuted, colorLight: navyGlow, label: "TDP" }
  }
  if (code === "TES") {
    return { color: navyDeep, colorLight: navyBright, label: "TES" }
  }
  return { color: navyBright, colorLight: bvViolet, label: code || "Program" }
}

function getBatchCardKey(batch) {
  return `${batch.batchNo}-${batch.program}-${batch.schoolYear}`
}

function BatchCard({ batch, privacy }) {
  const accent = getBatchCardAccent(batch.program)
  const rawBatchLabel = String(batch.batchNo ?? "?")
  const batchLabel = privacy.maskBatchNumberInPublicList ? maskBatchNumber(rawBatchLabel) : rawBatchLabel
  const granteeLabel = privacy.hideGranteeCountInPublicList ? "Hidden" : `${batch.grantees} grantees`

  return (
    <div
      className="group/batch h-full rounded-[1.35rem] p-[1.5px] shadow-[0_16px_40px_-20px_rgba(8,31,92,0.28)] transition-shadow duration-500 hover:shadow-[0_24px_48px_-18px_rgba(8,31,92,0.38)]"
      style={{
        backgroundImage: `linear-gradient(135deg, ${accent.color} 0%, ${accent.colorLight} 55%, ${bvViolet} 100%)`,
      }}
    >
      <Link
        to={`/landing-batch?${new URLSearchParams({
          batchNo: String(batch.batchNo ?? ""),
          program: String(batch.program ?? ""),
          academicYear: String(batch.schoolYear ?? ""),
        }).toString()}`}
        className="group/batch relative flex h-full min-h-[10.5rem] w-full flex-col overflow-hidden rounded-[1.2rem] bg-white/95 p-4 text-left backdrop-blur-md transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-16px_rgba(8,31,92,0.28)] sm:min-h-[11rem] sm:p-5"
        style={{ backgroundImage: `linear-gradient(160deg, #ffffff 0%, ${bvIce} 88%, ${bvPeriwinkle}33 100%)` }}
      >
        <span
          className="pointer-events-none absolute -right-1 -top-3 select-none font-black tabular-nums leading-none opacity-[0.07]"
          style={{ fontSize: "clamp(2.75rem, 8vw, 4.25rem)", color: accent.color }}
          aria-hidden
        >
          {batchLabel}
        </span>

        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
          style={{
            backgroundImage: `linear-gradient(90deg, transparent, ${accent.colorLight}88, transparent)`,
          }}
          aria-hidden
        />

        <div
          className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover/batch:opacity-100"
          style={{ background: `radial-gradient(circle, ${accent.colorLight}55 0%, transparent 68%)` }}
          aria-hidden
        />

        <div className="relative flex items-start gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold tracking-tight text-white shadow-[0_10px_24px_-8px_rgba(8,31,92,0.45)] ring-2 ring-white transition-transform duration-500 group-hover/batch:scale-105 sm:size-[3.25rem]"
            style={{
              backgroundImage: `linear-gradient(145deg, ${accent.color} 0%, ${accent.colorLight} 100%)`,
            }}
            aria-hidden
          >
            {batchLabel.slice(0, 3)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {privacy.showProgramTag ? (
                <span
                  className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundImage: gradientNavyButton }}
                >
                  {accent.label}
                </span>
              ) : null}
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ borderColor: borderBvSoft, color: textBodyOnLight }}
              >
                Batch
              </span>
            </div>

            <h2 className="mt-2 text-base font-bold leading-snug sm:text-lg" style={{ color: navy }}>
              Batch {batchLabel}
            </h2>
            {privacy.showDateAdded ? (
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: textBodyOnLight }}>
                {batch.createdAt}
              </p>
            ) : null}

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {privacy.showAcademicYear ? (
                <span
                  className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]"
                  style={{ borderColor: borderBvSoft, color: navy }}
                >
                  AY {batch.schoolYear || "—"}
                </span>
              ) : null}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white sm:text-[11px]"
                style={{ backgroundImage: `linear-gradient(135deg, ${accent.colorLight} 0%, #34d399 100%)` }}
              >
                <span className="size-1.5 rounded-full bg-white/90" aria-hidden />
                {granteeLabel}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default function ViewAllBatch() {
  const [searchTerm, setSearchTerm] = useState("")
  const [programFilter, setProgramFilter] = useState("__")
  const [academicYearFilter, setAcademicYearFilter] = useState("__")
  const [batchSeriesFilter, setBatchSeriesFilter] = useState("__")
  const { batches: publishedLandingBatches, loading: landingBatchesLoading } = usePublishedLandingBatches()
  const { programs } = useOsgfaPrograms()
  const landingPageSettings = useLandingPageSettings()
  const landingPrivacy = landingPageSettings.privacy
  const { contentRevealed, skeletonLeaving } = useContentReveal(landingBatchesLoading)

  const landingBatches = useMemo(
    () =>
      publishedLandingBatches.filter(
        (batch) =>
          isActiveProgramCode(batch.program, programs) && (Number(batch.grantees) || 0) > 0,
      ),
    [programs, publishedLandingBatches],
  )

  useLayoutEffect(() => {
    const scroller = document.getElementById("admin-main-scroll")
    if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: "auto" })
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [])

  const uniquePrograms = useMemo(
    () => [...new Set(landingBatches.map((batch) => String(batch.program ?? "").trim()).filter(Boolean))].sort(),
    [landingBatches],
  )

  const uniqueAcademicYears = useMemo(
    () => [...new Set(landingBatches.map((batch) => String(batch.schoolYear ?? "").trim()).filter(Boolean))].sort().reverse(),
    [landingBatches],
  )

  const uniqueBatchSeries = useMemo(
    () =>
      [
        ...new Set(
          landingBatches.map((batch) => String(batch.batchNo ?? "").split(".")[0]?.trim()).filter(Boolean),
        ),
      ].sort((a, b) => Number(b) - Number(a)),
    [landingBatches],
  )

  const filteredBatches = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return landingBatches
      .filter((batch) => {
        if (programFilter !== "__" && programFilter !== "" && String(batch.program ?? "") !== programFilter) return false
        if (academicYearFilter !== "__" && academicYearFilter !== "" && String(batch.schoolYear ?? "") !== academicYearFilter) {
          return false
        }
        if (batchSeriesFilter !== "__" && batchSeriesFilter !== "") {
          const series = String(batch.batchNo ?? "").split(".")[0]?.trim()
          if (series !== batchSeriesFilter) return false
        }
        if (!q) return true

        return (
          String(batch.batchNo ?? "").toLowerCase().includes(q) ||
          String(batch.program ?? "").toLowerCase().includes(q) ||
          String(batch.schoolYear ?? "").toLowerCase().includes(q) ||
          String(batch.createdAt ?? "").toLowerCase().includes(q) ||
          String(batch.grantees ?? "").includes(q)
        )
      })
      .sort(compareBatchesByBatchNo)
  }, [searchTerm, programFilter, academicYearFilter, batchSeriesFilter, landingBatches])

  return (
    <div className="min-h-screen w-full" style={{ backgroundImage: gradientLightBlueViolet, color: textBodyOnLight }}>
      <header className="sticky top-0 z-40 w-full border-b border-white/10 text-white shadow-md" style={{ backgroundImage: gradientNavyHeader }}>
        <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:gap-4 md:px-6 lg:px-8">
          <Link
            to="/#batch-list"
            className="inline-flex shrink-0 items-center justify-center p-0.5 text-white transition hover:text-white/80 sm:p-1"
            aria-label="Back to batch list section"
          >
            <ArrowLeft className="size-5 sm:size-6" aria-hidden />
          </Link>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-white/90 bg-white text-[#081F5C] sm:size-10">
            <Layers className="size-4 sm:size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight sm:text-lg md:text-xl">All batches</h1>
            <p className="truncate text-[10px] leading-snug text-sky-100/90 sm:text-xs">Published scholarship batches</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="mb-6 grid min-w-0 w-full max-w-full gap-3 max-md:grid-cols-1 md:grid-cols-12 md:items-center">
          <div className="grid min-w-0 w-full max-w-full grid-cols-3 gap-2 max-md:[&_select]:px-2 max-md:[&_select]:pr-7 max-md:[&_select]:text-[10px] sm:gap-3 md:col-span-7 lg:col-span-8">
            <div className="relative min-w-0 w-full">
              <select
                id="view-all-batch-program-filter"
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className={`${selectShellClass} ${programFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
              >
                <option value="__" disabled hidden>
                  Program
                </option>
                <option value="">All Programs</option>
                {uniquePrograms.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-neutral-400 md:right-2 md:size-4" />
            </div>

            <div className="relative min-w-0 w-full">
              <select
                id="view-all-batch-academic-year-filter"
                value={academicYearFilter}
                onChange={(e) => setAcademicYearFilter(e.target.value)}
                className={`${selectShellClass} ${academicYearFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
              >
                <option value="__" disabled hidden>
                  Academic Year
                </option>
                <option value="">All Years</option>
                {uniqueAcademicYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-neutral-400 md:right-2 md:size-4" />
            </div>

            <div className="relative min-w-0 w-full">
              <select
                id="view-all-batch-series-filter"
                value={batchSeriesFilter}
                onChange={(e) => setBatchSeriesFilter(e.target.value)}
                className={`${selectShellClass} ${batchSeriesFilter === "__" ? "text-neutral-500" : "text-neutral-900"}`}
              >
                <option value="__" disabled hidden>
                  Batch Series
                </option>
                <option value="">All Series</option>
                {uniqueBatchSeries.map((series) => (
                  <option key={series} value={series}>
                    {series}.x
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-neutral-400 md:right-2 md:size-4" />
            </div>
          </div>

          <div className="relative min-w-0 w-full max-w-full max-md:order-last md:col-span-5 lg:col-span-4">
            <div className="relative w-full min-w-0 max-w-full">
              <input
                id="view-all-batch-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search batch number, program, academic year..."
                className="h-9 w-full min-w-0 rounded-lg border-none ring-0 bg-white/95 pr-12 pl-4 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"
              />
              <span
                className="pointer-events-none absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-linear-to-r from-[#081F5C] to-[#1447a6] p-0 shadow-sm"
                aria-hidden
              >
                <Search className="h-4 w-4 text-white" />
              </span>
            </div>
          </div>
        </div>

        {landingBatchesLoading || skeletonLeaving ? (
          <div className="relative min-h-[12rem]">
            <div
              className={cn(
                "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                !landingBatchesLoading && "pointer-events-none absolute inset-x-0 top-0 z-0 opacity-0",
              )}
              aria-busy={landingBatchesLoading}
              aria-hidden={!landingBatchesLoading}
              aria-label="Loading published batches"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <PublicBatchCardSkeleton key={index} />
              ))}
            </div>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-10 text-center text-sm shadow-sm ring-1 ring-slate-900/3" style={{ color: textBodyOnLight }}>
            No batches match your filters or search.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBatches.map((batch, index) => (
              <div
                key={getBatchCardKey(batch)}
                className={revealItemClass(contentRevealed, index, 45)}
                style={revealItemStyle(contentRevealed, index, 45)}
              >
                <BatchCard batch={batch} privacy={landingPrivacy} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
