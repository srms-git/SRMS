import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Globe, LayoutList, ListChecks, Megaphone } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import picture1 from "@/assets/picture-1.png"
import picture2 from "@/assets/picture-2.png"
import picture3 from "@/assets/picture-3.png"
import picture4 from "@/assets/picture-4.png"
import marsuLogo from "@/assets/marsuLogo.png"
import navHeroBackground from "@/assets/navbackground.png"
import orgLogo from "@/assets/orgLogo.png"
import systemLogo from "@/assets/systemLogo.png"
import apiClient from "@/lib/apiClient"
import {
  formatAnnouncementDurationLabel,
  isAnnouncementVisibleOnLanding,
  resolveAnnouncementDates,
} from "@/lib/announcementDates"
import { getAnnouncementTypeLabel } from "@/lib/announcementTypes"
import { resolveAnnouncementImageUrls } from "@/lib/announcementImages"
import { useOsgfaPrograms } from "@/hooks/useOsgfaPrograms"
import {
  getBatchLandingKey,
  usePublishedLandingBatches,
} from "@/lib/landingFeaturedBatches"
import { isActiveProgramCode } from "@/lib/osgfaPrograms"
import { useLandingPageSettings, maskBatchNumber } from "@/lib/landingPageSettings"
import {
  getWorkflowStepsForProgram,
  hydrateProcessWorkflowSteps,
  LANDING_PROCESS_SECTION,
  PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER,
  useProcessWorkflowByProgram,
} from "@/lib/processWorkflowSettings"
import ProcessWorkflowProgramTabs, {
  orderWorkflowPrograms,
} from "@/components/settings/ProcessWorkflowProgramTabs"
import { AnnouncementImageGallery } from "@/components/AnnouncementImageGallery"
import { LandingPublicHeader } from "@/components/LandingPublicHeader"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Palette (3 pillars):
 * — Gradient navy blue
 * — Gradient light blue-violet
 * — White (+ navy-tinted text for readability on light areas)
 */
const navyDeep = "#04133d"
const navy = "#081F5C"
const navyMuted = "#0b2b73"
const navyBright = "#1447a6"
const navyGlow = "#2a63cc"

const bvIce = "#eef2ff"
const bvPeriwinkle = "#e0e7ff"
const bvLilac = "#e9e5ff"
const bvSoft = "#c7d2fe"
const bvViolet = "#a5b4fc"

const borderNavySoft = "rgba(8, 31, 92, 0.12)"
const borderBvSoft = "rgba(99, 102, 241, 0.18)"
const textBodyOnLight = "rgba(8, 31, 92, 0.72)"

/** Gradient navy blue — hero base, primary CTAs, footer base */
const gradientNavyBlue = `linear-gradient(135deg, ${navyDeep} 0%, ${navy} 35%, ${navyMuted} 62%, ${navyBright} 100%)`
const gradientNavyButton = `linear-gradient(135deg, ${navy} 0%, ${navyMuted} 42%, ${navyBright} 78%, ${navyGlow} 100%)`
const gradientNavyFooter = `linear-gradient(180deg, ${navyBright} 0%, ${navy} 45%, ${navyDeep} 100%)`

/** Gradient light blue-violet — soft section fills, secondary accents */
const gradientLightBlueViolet = `linear-gradient(155deg, #ffffff 0%, ${bvIce} 28%, ${bvPeriwinkle} 55%, ${bvLilac} 100%)`
const gradientBlueVioletButton = `linear-gradient(135deg, ${bvPeriwinkle} 0%, ${bvSoft} 45%, ${bvViolet} 100%)`

/** Hero mesh: navy atmosphere + light blue-violet glows */
const gradientHeroMesh = `
  radial-gradient(ellipse 85% 65% at 100% -8%, rgba(147, 197, 253, 0.28) 0%, transparent 52%),
  radial-gradient(ellipse 75% 55% at -5% 105%, rgba(167, 139, 250, 0.22) 0%, transparent 50%),
  radial-gradient(ellipse 55% 45% at 88% 92%, ${navyGlow}44 0%, transparent 52%),
  radial-gradient(ellipse 70% 50% at 15% 20%, rgba(255, 255, 255, 0.07) 0%, transparent 48%)
`

function HeroBackgroundLayers() {
  return (
    <>
      <img
        src={navHeroBackground}
        alt=""
        className="h-full w-full object-cover object-[center_88%]"
        decoding="async"
      />
      <div
        className="absolute inset-0"
        style={{
          background: `${gradientHeroMesh}, linear-gradient(180deg, rgba(4, 19, 61, 0.78) 0%, rgba(4, 19, 61, 0.68) 18%, rgba(8, 31, 92, 0.56) 42%, rgba(4, 19, 61, 0.45) 62%, rgba(4, 19, 61, 0.38) 78%, rgba(4, 19, 61, 0.32) 100%)`,
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-40 sm:h-52 lg:h-64"
        style={{
          background: `linear-gradient(to top, ${bvIce} 0%, rgba(224, 231, 255, 0.95) 10%, rgba(199, 210, 254, 0.82) 26%, rgba(139, 152, 206, 0.55) 48%, rgba(8, 31, 92, 0.42) 68%, rgba(4, 19, 61, 0.22) 86%, transparent 100%)`,
        }}
      />
    </>
  )
}

const HERO_TYPEWRITER_TITLES = [
  {
    line1: "Centralized Access to",
    line2: "Scholarship Information and Assistance. . .",
  },
  {
    line1: "Stay Updated with",
    line2: "Official Announcements and Batch Records. . .",
  },
]
const HERO_TYPEWRITER_CHAR_MS = 62
const HERO_TYPEWRITER_LINE_PAUSE_MS = 520
const HERO_TYPEWRITER_HOLD_MS = 10000
const HERO_TYPEWRITER_FADE_MS = 900

function HeroTypewriterCursor({ className = "text-white" }) {
  return (
    <span
      className={`ml-1 inline-block h-[0.72em] w-[1.5px] rounded-full bg-current animate-pulse align-middle motion-reduce:hidden shadow-[0_0_10px_currentColor] ${className}`}
      aria-hidden
    />
  )
}

function HeroTypewriterTitle() {
  const [titleIndex, setTitleIndex] = useState(0)
  const [line1Count, setLine1Count] = useState(0)
  const [line2Count, setLine2Count] = useState(0)
  const [phase, setPhase] = useState("typing1")
  const [reducedMotion, setReducedMotion] = useState(false)

  const currentTitle = HERO_TYPEWRITER_TITLES[titleIndex]

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const syncReducedMotion = () => setReducedMotion(mediaQuery.matches)
    syncReducedMotion()
    mediaQuery.addEventListener("change", syncReducedMotion)
    return () => mediaQuery.removeEventListener("change", syncReducedMotion)
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      setLine1Count(HERO_TYPEWRITER_TITLES[0].line1.length)
      setLine2Count(HERO_TYPEWRITER_TITLES[0].line2.length)
      setTitleIndex(0)
      setPhase("hold")
      return undefined
    }

    let timerId = 0
    const { line1: fullLine1, line2: fullLine2 } = currentTitle

    if (phase === "typing1") {
      if (line1Count < fullLine1.length) {
        timerId = window.setTimeout(() => setLine1Count((count) => count + 1), HERO_TYPEWRITER_CHAR_MS)
      } else {
        timerId = window.setTimeout(() => setPhase("typing2"), HERO_TYPEWRITER_LINE_PAUSE_MS)
      }
    } else if (phase === "typing2") {
      if (line2Count < fullLine2.length) {
        timerId = window.setTimeout(() => setLine2Count((count) => count + 1), HERO_TYPEWRITER_CHAR_MS)
      } else {
        timerId = window.setTimeout(() => setPhase("hold"), HERO_TYPEWRITER_LINE_PAUSE_MS)
      }
    } else if (phase === "hold") {
      timerId = window.setTimeout(() => setPhase("fadeOut"), HERO_TYPEWRITER_HOLD_MS)
    } else if (phase === "fadeOut") {
      timerId = window.setTimeout(() => {
        setLine1Count(0)
        setLine2Count(0)
        setTitleIndex((index) => (index + 1) % HERO_TYPEWRITER_TITLES.length)
        setPhase("typing1")
      }, HERO_TYPEWRITER_FADE_MS)
    }

    return () => window.clearTimeout(timerId)
  }, [phase, line1Count, line2Count, reducedMotion, currentTitle])

  const line1 = currentTitle.line1.slice(0, line1Count)
  const line2 = currentTitle.line2.slice(0, line2Count)
  const isFading = phase === "fadeOut"
  const showLine1Cursor = !reducedMotion && phase === "typing1"
  const showLine2Cursor = !reducedMotion && phase === "typing2"

  return (
    <h1
      className="text-[clamp(1.65rem,3.75vw,2.85rem)] font-extrabold leading-[1.12] tracking-tight text-white"
      aria-label={`${currentTitle.line1} ${currentTitle.line2}`}
    >
      <div
        className={`space-y-1 transition-opacity duration-[900ms] ease-out motion-reduce:transition-none sm:space-y-1.5 ${
          isFading ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="block font-extrabold text-white">
          {line1}
          {showLine1Cursor ? <HeroTypewriterCursor className="text-white" /> : null}
        </span>
        <span
          className="block min-h-[1.12em] bg-clip-text font-extrabold text-transparent"
          style={{
            backgroundImage: `linear-gradient(115deg, #ffffff 0%, ${bvPeriwinkle} 42%, ${bvSoft} 88%)`,
          }}
        >
          {line2}
          {showLine2Cursor ? <HeroTypewriterCursor className="text-sky-200" /> : null}
        </span>
      </div>
    </h1>
  )
}

/** Center-anchored slot: compact on mobile; full size from sm upward. */
const featuredBatchScrollerTrackClassName = "min-h-[7.75rem] items-center sm:min-h-[13rem]"

const featuredBatchCardSlotClassName =
  "relative z-0 shrink-0 self-center w-[min(calc(100vw-2.5rem),218px)] h-[7.25rem] transition-[width,height] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none max-sm:hover:w-[min(calc(100vw-2.5rem),218px)] max-sm:hover:h-[7.25rem] sm:w-[300px] sm:h-[10.5rem] sm:hover:z-20 sm:hover:w-[368px] sm:hover:h-[12.75rem] md:w-[328px] md:h-[11rem] md:hover:w-[408px] md:hover:h-[13rem]"

const FEATURED_PROGRAM_DISPLAY_ORDER = ["TES", "TDP"]

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

function buildFeaturedBatchesByProgram(batches) {
  const byProgram = new Map()
  for (const batch of batches) {
    const code = String(batch.program ?? "").trim().toUpperCase()
    if (!code) continue
    if (!byProgram.has(code)) byProgram.set(code, [])
    byProgram.get(code).push(batch)
  }

  const orderedCodes = [
    ...FEATURED_PROGRAM_DISPLAY_ORDER.filter((code) => byProgram.has(code)),
    ...[...byProgram.keys()]
      .filter((code) => !FEATURED_PROGRAM_DISPLAY_ORDER.includes(code))
      .sort((a, b) => a.localeCompare(b)),
  ]

  return orderedCodes.map((programLabel) => ({
    programLabel,
    items: byProgram.get(programLabel) ?? [],
  }))
}

const FEATURED_SCROLL_SPEED_PX_S = 24
/** Brief pause after manual wheel/drag only — hover uses instant pause/resume. */
const FEATURED_SCROLL_INTERACTION_PAUSE_MS = 1200
/** Max delta-time per tick (~45fps cap) para hindi tumalon pag may frame drop. */
const FEATURED_SCROLL_MAX_DT = 1 / 45
/** Ms — programmatic scroll; mas maikli + queueMicrotask = mas kaunting false "user" scroll. */
const FEATURED_PROGRAMMATIC_GUARD_MS = 72

function getFeaturedBatchCardKey(batch, keyPrefix) {
  return `${keyPrefix}-${batch.batchNo}-${batch.program}-${batch.schoolYear}`
}

function FeaturedBatchScroller({ programLabel, items, scrollDirection = "left", privacy }) {
  const uniqueItems = useMemo(() => {
    const seen = new Set()
    return items.filter((batch) => {
      const key = getBatchLandingKey(batch)
      if (!key || key === "||" || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [items])

  const scrollRef = useRef(null)
  const stripRef = useRef(null)
  const chunkWidthRef = useRef(0)
  const shouldLoopRef = useRef(false)
  const [shouldLoop, setShouldLoop] = useState(false)
  const hoverPauseRef = useRef(false)
  const interactionPauseUntilRef = useRef(0)
  const programmaticRef = useRef(false)
  const lastProgrammaticScrollAtRef = useRef(0)
  const rafRef = useRef(0)
  /** Float position for smooth auto-scroll (avoids integer stepping from reading scrollLeft each frame). */
  const internalScrollPosRef = useRef(0)
  const scrollRightPrimedRef = useRef(false)

  const scrollRight = scrollDirection === "right"

  const isAutoScrollPaused = useCallback(() => {
    return hoverPauseRef.current || Date.now() < interactionPauseUntilRef.current
  }, [])

  useEffect(() => {
    scrollRightPrimedRef.current = false
  }, [uniqueItems, scrollDirection])

  const measureStrip = useCallback(() => {
    const el = scrollRef.current
    const strip = stripRef.current
    const next = strip?.nextElementSibling
    if (strip && next instanceof HTMLElement) {
      chunkWidthRef.current = next.offsetLeft - strip.offsetLeft
    } else if (strip) {
      chunkWidthRef.current = strip.offsetWidth
    } else {
      chunkWidthRef.current = 0
    }

    if (strip && el) {
      const nextShouldLoop = uniqueItems.length > 1 && strip.scrollWidth > el.clientWidth + 4
      shouldLoopRef.current = nextShouldLoop
      setShouldLoop((prev) => (prev === nextShouldLoop ? prev : nextShouldLoop))
    } else {
      shouldLoopRef.current = false
      setShouldLoop((prev) => (prev === false ? prev : false))
    }
  }, [uniqueItems.length])

  useLayoutEffect(() => {
    measureStrip()
    const strip = stripRef.current
    const el = scrollRef.current
    if (!strip || typeof ResizeObserver === "undefined") return undefined

    let debounceId = 0
    const scheduleMeasure = () => {
      window.clearTimeout(debounceId)
      debounceId = window.setTimeout(measureStrip, 300)
    }

    const ro = new ResizeObserver(scheduleMeasure)
    ro.observe(strip)
    if (el) ro.observe(el)

    const onTransitionEnd = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || !target.hasAttribute("data-batch-slot")) return
      if (event.propertyName === "width" || event.propertyName === "height") {
        measureStrip()
      }
    }
    strip.addEventListener("transitionend", onTransitionEnd, true)

    return () => {
      ro.disconnect()
      strip.removeEventListener("transitionend", onTransitionEnd, true)
      window.clearTimeout(debounceId)
    }
  }, [uniqueItems, measureStrip])

  useLayoutEffect(() => {
    if (shouldLoop) return
    const el = scrollRef.current
    if (!el) return
    internalScrollPosRef.current = 0
    el.scrollLeft = 0
  }, [shouldLoop, uniqueItems])

  const bumpInteractionPause = useCallback(() => {
    interactionPauseUntilRef.current = Date.now() + FEATURED_SCROLL_INTERACTION_PAUSE_MS
  }, [])

  const handleScrollerPointerOver = useCallback((event) => {
    hoverPauseRef.current = Boolean(event.target.closest("[data-batch-card]"))
  }, [])

  const handleScrollerPointerLeave = useCallback((event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      hoverPauseRef.current = false
    }
  }, [])

  const setScrollProgrammatically = useCallback((el, value) => {
    lastProgrammaticScrollAtRef.current = performance.now()
    programmaticRef.current = true
    internalScrollPosRef.current = value
    el.scrollLeft = value
    queueMicrotask(() => {
      programmaticRef.current = false
    })
  }, [])

  const normalizeLoop = useCallback(() => {
    if (!shouldLoopRef.current) return
    const el = scrollRef.current
    const chunk = chunkWidthRef.current
    if (!el || chunk <= 0) return
    if (el.scrollLeft >= chunk - 0.5) {
      setScrollProgrammatically(el, el.scrollLeft - chunk)
    } else if (el.scrollLeft <= 0) {
      setScrollProgrammatically(el, el.scrollLeft + chunk)
    }
  }, [setScrollProgrammatically])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    const chunk = chunkWidthRef.current
    const t = performance.now()
    const recentProgrammatic = t - lastProgrammaticScrollAtRef.current < FEATURED_PROGRAMMATIC_GUARD_MS
    if (!programmaticRef.current && !recentProgrammatic) {
      bumpInteractionPause()
      if (el) internalScrollPosRef.current = el.scrollLeft
    }
    if (!el || chunk <= 0) return
    const inStableMid = el.scrollLeft > 2 && el.scrollLeft < chunk - 2
    if (!recentProgrammatic || !inStableMid) {
      normalizeLoop()
    }
  }, [bumpInteractionPause, normalizeLoop])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    const pause = () => bumpInteractionPause()
    el.addEventListener("wheel", pause, { passive: true })
    el.addEventListener("pointerdown", pause)
    el.addEventListener("touchstart", pause, { passive: true })
    return () => {
      el.removeEventListener("wheel", pause)
      el.removeEventListener("pointerdown", pause)
      el.removeEventListener("touchstart", pause)
    }
  }, [bumpInteractionPause])

  useEffect(() => {
    if (uniqueItems.length === 0 || !shouldLoop) return undefined
    const el = scrollRef.current
    if (!el) return undefined

    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reducedMotion) return undefined

    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, FEATURED_SCROLL_MAX_DT)
      last = now
      const chunk = chunkWidthRef.current
      if (chunk > 0 && shouldLoopRef.current && !isAutoScrollPaused()) {
        if (scrollRight) {
          if (!scrollRightPrimedRef.current) {
            scrollRightPrimedRef.current = true
            internalScrollPosRef.current = chunk * 0.35
            setScrollProgrammatically(el, internalScrollPosRef.current)
          } else {
            internalScrollPosRef.current -= FEATURED_SCROLL_SPEED_PX_S * dt
            while (internalScrollPosRef.current < 0) internalScrollPosRef.current += chunk
            setScrollProgrammatically(el, internalScrollPosRef.current)
          }
        } else {
          internalScrollPosRef.current += FEATURED_SCROLL_SPEED_PX_S * dt
          if (internalScrollPosRef.current >= chunk) internalScrollPosRef.current -= chunk
          setScrollProgrammatically(el, internalScrollPosRef.current)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [uniqueItems, scrollDirection, shouldLoop, isAutoScrollPaused, setScrollProgrammatically, scrollRight])

  const renderCard = (batch, keyPrefix, duplicate) => {
    const cardKey = getFeaturedBatchCardKey(batch, keyPrefix)
    const accent = getBatchCardAccent(batch.program)
    const rawBatchLabel = String(batch.batchNo ?? "?")
    const batchLabel = privacy.maskBatchNumberInPublicList ? maskBatchNumber(rawBatchLabel) : rawBatchLabel
    const granteeLabel = privacy.hideGranteeCountInPublicList ? "Hidden" : `${batch.grantees} grantees`

    return (
      <div
        key={cardKey}
        data-batch-slot=""
        className={featuredBatchCardSlotClassName}
        aria-hidden={duplicate ? true : undefined}
      >
        <div
          className="group/batch h-full rounded-[1.05rem] p-px shadow-[0_10px_24px_-16px_rgba(8,31,92,0.28)] transition-shadow duration-500 sm:rounded-[1.35rem] sm:p-[1.5px] sm:shadow-[0_16px_40px_-20px_rgba(8,31,92,0.28)] hover:shadow-[0_24px_48px_-18px_rgba(8,31,92,0.38)]"
          style={{
            backgroundImage: `linear-gradient(135deg, ${accent.color} 0%, ${accent.colorLight} 55%, ${bvViolet} 100%)`,
          }}
        >
          <Link
            data-batch-card={cardKey}
            to={`/landing-batch?${new URLSearchParams({
              batchNo: String(batch.batchNo ?? ""),
              program: String(batch.program ?? ""),
              academicYear: String(batch.schoolYear ?? ""),
            }).toString()}`}
            className="group/batch relative flex h-full w-full flex-col justify-center overflow-hidden rounded-[0.95rem] bg-white/95 p-2.5 text-left backdrop-blur-md transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:justify-start sm:rounded-[1.2rem] sm:p-4 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_20px_40px_-16px_rgba(8,31,92,0.28)] md:p-5"
            style={{ backgroundImage: `linear-gradient(160deg, #ffffff 0%, ${bvIce} 88%, ${bvPeriwinkle}33 100%)` }}
            tabIndex={duplicate ? -1 : undefined}
          >
            <span
              className="pointer-events-none absolute -right-1 -top-2 select-none font-black tabular-nums leading-none opacity-[0.07] sm:-top-3"
              style={{ fontSize: "clamp(1.75rem, 6vw, 4.25rem)", color: accent.color }}
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

            <div className="relative flex items-center gap-2 sm:items-start sm:gap-3">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold tracking-tight text-white shadow-[0_8px_18px_-8px_rgba(8,31,92,0.45)] ring-1 ring-white transition-transform duration-500 sm:size-12 sm:rounded-2xl sm:text-sm sm:ring-2 sm:shadow-[0_10px_24px_-8px_rgba(8,31,92,0.45)] sm:group-hover/batch:scale-105 md:size-13"
                style={{
                  backgroundImage: `linear-gradient(145deg, ${accent.color} 0%, ${accent.colorLight} 100%)`,
                }}
                aria-hidden
              >
                {batchLabel.slice(0, 3)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                  {privacy.showProgramTag ? (
                    <span
                      className="inline-flex rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-white sm:px-2.5 sm:py-0.5 sm:text-[10px]"
                      style={{ backgroundImage: gradientNavyButton }}
                    >
                      {accent.label}
                    </span>
                  ) : null}
                  <span
                    className="rounded-full border px-1.5 py-px text-[8px] font-semibold uppercase tracking-[0.1em] sm:px-2 sm:py-0.5 sm:text-[10px] sm:tracking-[0.12em]"
                    style={{ borderColor: borderBvSoft, color: textBodyOnLight }}
                  >
                    Batch
                  </span>
                </div>

                <h3 className="mt-1 truncate text-xs font-bold leading-tight sm:mt-2 sm:text-base sm:leading-snug md:text-lg" style={{ color: navy }}>
                  Batch {batchLabel}
                </h3>
                {privacy.showDateAdded ? (
                  <p className="mt-px truncate text-[9px] font-medium uppercase tracking-[0.08em] sm:mt-1 sm:text-[11px] sm:tracking-[0.12em]" style={{ color: textBodyOnLight }}>
                    {batch.createdAt}
                  </p>
                ) : null}

                <div
                  className={cn(
                    "mt-1.5 grid gap-1 sm:mt-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5",
                    privacy.showAcademicYear ? "grid-cols-2" : "grid-cols-1",
                  )}
                >
                  {privacy.showAcademicYear ? (
                    <span
                      className="flex min-w-0 items-center justify-center rounded-full border px-1 py-px text-center text-[8px] font-semibold leading-tight sm:inline-flex sm:px-2 sm:py-0.5 sm:text-[10px] md:text-[11px]"
                      style={{ borderColor: borderBvSoft, color: navy }}
                    >
                      <span className="truncate">AY {batch.schoolYear || "—"}</span>
                    </span>
                  ) : null}
                  <span
                    className="flex min-w-0 items-center justify-center gap-0.5 rounded-full px-1 py-px text-[8px] font-bold text-white sm:inline-flex sm:gap-1 sm:px-2 sm:py-0.5 sm:text-[10px] md:text-[11px]"
                    style={{ backgroundImage: `linear-gradient(135deg, ${accent.colorLight} 0%, #34d399 100%)` }}
                  >
                    <span className="size-1 shrink-0 rounded-full bg-white/90 sm:size-1.5" aria-hidden />
                    <span className="truncate">{granteeLabel}</span>
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    )
  }

  if (uniqueItems.length === 0) return null

  return (
    <div className="overflow-x-hidden">
      <p
        className="mb-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-xs"
        style={{ borderColor: borderBvSoft, color: navy }}
      >
        {programLabel} batches
      </p>
      <div
        ref={scrollRef}
        onScroll={shouldLoop ? onScroll : undefined}
        onPointerOver={handleScrollerPointerOver}
        onPointerLeave={handleScrollerPointerLeave}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
            bumpInteractionPause()
          }
        }}
        className={`-mx-1 flex max-w-full gap-2.5 overflow-x-auto overflow-y-hidden px-1 py-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-4 sm:py-1 ${featuredBatchScrollerTrackClassName}`}
        tabIndex={0}
        role="region"
        aria-label={`${programLabel} batch list${shouldLoop ? ", auto-scrolling" : ""}`}
      >
        <div ref={stripRef} className="flex shrink-0 items-center gap-2.5 self-center sm:gap-4">
          {uniqueItems.map((batch) => renderCard(batch, "a", false))}
        </div>
        {shouldLoop ? (
          <div className="flex shrink-0 items-center gap-2.5 self-center sm:gap-4" aria-hidden>
            {uniqueItems.map((batch) => renderCard(batch, "b", true))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

const ANNOUNCEMENT_ROTATE_MS = 6000
/** Min wheel delta before advancing one slide (groups trackpad ticks into one step). */
const ABOUT_WHEEL_THRESHOLD = 85
/** Cooldown after each slide change — prevents double navigation per scroll. */
const ABOUT_WHEEL_COOLDOWN_MS = 1100

const aboutSlideshowSlides = [
  {
    src: picture1,
    alt: "OSGFA - banner",
    objectFit: "cover",
  },
  {
    src: picture2,
    alt: "Group Chat - QR",
    objectFit: "cover",
  },
  {
    src: picture3,
    alt: "Organization Activities - 1",
    objectFit: "cover",
  },
  {
    src: picture4,
    alt: "Organization Activities - 2",
    objectFit: "cover",
  },


]

function getCoverflowOffset(index, activeIndex, length) {
  let diff = index - activeIndex
  const half = length / 2
  if (diff > half) diff -= length
  if (diff < -half) diff += length
  return diff
}

function AboutImageSlideshow({ slides }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const wheelLockRef = useRef(false)
  const wheelAccumulatorRef = useRef(0)
  const wheelResetTimerRef = useRef(0)
  const containerRef = useRef(null)
  const touchStartXRef = useRef(null)

  const goTo = useCallback(
    (index) => {
      setActiveIndex((index + slides.length) % slides.length)
    },
    [slides.length],
  )

  const stepSlide = useCallback(
    (direction) => {
      setActiveIndex((prev) => (prev + direction + slides.length) % slides.length)
    },
    [slides.length],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el || slides.length <= 1) return undefined

    const onWheel = (event) => {
      event.preventDefault()
      event.stopPropagation()

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (delta === 0) return

      if (wheelLockRef.current) return

      wheelAccumulatorRef.current += delta

      window.clearTimeout(wheelResetTimerRef.current)
      wheelResetTimerRef.current = window.setTimeout(() => {
        wheelAccumulatorRef.current = 0
      }, 180)

      if (Math.abs(wheelAccumulatorRef.current) < ABOUT_WHEEL_THRESHOLD) return

      const direction = wheelAccumulatorRef.current > 0 ? 1 : -1
      wheelAccumulatorRef.current = 0
      wheelLockRef.current = true

      stepSlide(direction)

      window.setTimeout(() => {
        wheelLockRef.current = false
      }, ABOUT_WHEEL_COOLDOWN_MS)
    }

    el.addEventListener("wheel", onWheel, { passive: false, capture: true })
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true })
      window.clearTimeout(wheelResetTimerRef.current)
    }
  }, [slides.length, stepSlide])

  if (slides.length === 0) return null

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (event) => {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX == null) return

    const endX = event.changedTouches[0]?.clientX
    if (endX == null) return

    const delta = endX - startX
    if (Math.abs(delta) < 48) return
    stepSlide(delta > 0 ? -1 : 1)
  }

  return (
    <div
      ref={containerRef}
      className="relative order-1 w-full min-w-0 overflow-hidden overscroll-none outline-none touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:order-1 lg:w-full lg:touch-none"
      role="region"
      aria-label="About the organization photo slideshow"
      aria-roledescription="carousel"
      tabIndex={0}
      onMouseLeave={() => setHoveredIndex(null)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") stepSlide(1)
        if (e.key === "ArrowLeft") stepSlide(-1)
      }}
    >
      <div
        className="relative mx-auto h-[250px] w-full min-w-0 overflow-hidden px-1 outline-none min-[400px]:h-[270px] sm:h-[385px] sm:px-2 lg:mx-0 lg:h-[450px] lg:w-full lg:px-0 xl:h-[470px]"
        style={{ perspective: "1200px" }}
        aria-live="polite"
      >
        {slides.map((slide, index) => {
          const offset = getCoverflowOffset(index, activeIndex, slides.length)
          if (Math.abs(offset) > 1) return null

          const isCenter = offset === 0
          const isHovered = hoveredIndex === index
          const baseScale = isCenter ? 1.05 : 0.76
          const scale = isHovered ? (isCenter ? 1.08 : 0.84) : baseScale
          const zIndex = isHovered ? 30 : 20 - Math.abs(offset) * 5

          // Side cards sit further under the center so peeks stay inside padding and stay even.
          const spreadPct = offset === 0 ? 0 : offset * (isHovered ? 30 : 34)
          const slideTransform = `translate(-50%, -50%) translateX(${spreadPct}%) scale(${scale})`

          return (
            <article
              key={slide.alt}
              className={`absolute left-1/2 top-1/2 aspect-4/3 w-[min(68vw,248px)] overflow-hidden rounded-[1.25rem] transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] will-change-transform min-[400px]:w-[min(66vw,272px)] min-[400px]:rounded-[1.35rem] sm:w-[min(72%,320px)] sm:rounded-[1.4rem] lg:w-[min(82%,385px)] xl:w-[min(84%,405px)] ${
                !isCenter ? "cursor-pointer" : "cursor-default"
              }`}
              style={{
                transform: slideTransform,
                transformOrigin: "center center",
                zIndex,
                opacity: isCenter || isHovered ? 1 : 0.84,
                filter: isCenter ? "saturate(1.06)" : "saturate(0.95)",
              }}
              aria-hidden={!isCenter && !isHovered}
              onMouseEnter={() => setHoveredIndex(index)}
              onClick={() => {
                if (!isCenter) goTo(index)
              }}
            >
              <img
                src={slide.src}
                alt={isCenter ? slide.alt : ""}
                className={`h-full w-full transition-transform duration-700 ease-out ${isCenter ? "scale-[1.02]" : "scale-100"} ${slide.objectFit === "contain" ? "object-contain" : "object-cover"} ${slide.className ?? ""}`}
                decoding="async"
              />
              {!isCenter && !isHovered ? (
                <div
                  className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                  style={{ backgroundColor: "rgba(8, 31, 92, 0.45)" }}
                  aria-hidden
                />
              ) : null}
              {!isCenter && isHovered ? (
                <div
                  className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                  style={{ backgroundColor: "rgba(8, 31, 92, 0.12)" }}
                  aria-hidden
                />
              ) : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

/** Scroll focus band — step reveals only when it enters this viewport slice. */
const TIMELINE_SCROLL_ROOT_MARGIN = "-8% 0px -28% 0px"
const TIMELINE_SCROLL_THRESHOLDS = [0, 0.15, 0.35, 0.55, 0.75, 1]

function useTimelineScrollReveal(stepCount) {
  const [inFocus, setInFocus] = useState(() => new Set())
  const [activeIndex, setActiveIndex] = useState(-1)
  const [scrollDirection, setScrollDirection] = useState("down")
  const stepRefs = useRef([])
  const ratiosRef = useRef([])
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    lastScrollYRef.current = window.scrollY

    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastScrollYRef.current
      if (Math.abs(delta) >= 2) {
        setScrollDirection(delta > 0 ? "down" : "up")
      }
      lastScrollYRef.current = y
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const nodes = stepRefs.current.filter(Boolean)
    if (!nodes.length) return undefined

    ratiosRef.current = Array.from({ length: stepCount }, () => 0)

    const pickActiveIndex = () => {
      let best = -1
      let bestRatio = 0
      for (let i = 0; i < stepCount; i += 1) {
        const ratio = ratiosRef.current[i] ?? 0
        if (ratio > bestRatio) {
          bestRatio = ratio
          best = i
        }
      }
      return bestRatio >= 0.28 ? best : -1
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number(entry.target.getAttribute("data-step-index"))
          if (Number.isNaN(index)) continue
          ratiosRef.current[index] = entry.isIntersecting ? entry.intersectionRatio : 0
        }

        setInFocus((prev) => {
          const next = new Set(prev)
          let changed = false
          for (let i = 0; i < stepCount; i += 1) {
            const ratio = ratiosRef.current[i] ?? 0
            const focused = ratio >= 0.32
            if (focused && !next.has(i)) {
              next.add(i)
              changed = true
            } else if (!focused && next.has(i)) {
              next.delete(i)
              changed = true
            }
          }
          return changed ? next : prev
        })

        const nextActive = pickActiveIndex()
        setActiveIndex((prev) => (prev === nextActive ? prev : nextActive))
      },
      { threshold: TIMELINE_SCROLL_THRESHOLDS, rootMargin: TIMELINE_SCROLL_ROOT_MARGIN },
    )

    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [stepCount])

  const registerStepRef = useCallback((index) => {
    return (node) => {
      stepRefs.current[index] = node
    }
  }, [])

  const progress =
    stepCount <= 1 ? (activeIndex >= 0 ? 100 : 0) : activeIndex < 0 ? 0 : (activeIndex / (stepCount - 1)) * 100

  const animationMode = scrollDirection === "up" ? "fade" : "slide"

  return { inFocus, activeIndex, registerStepRef, progress, animationMode }
}

function ProcessWorkflowTimelineStepCard({
  item,
  index,
  total,
  isRevealed,
  isActive,
  cardSide = "right",
  animationMode = "slide",
}) {
  const [animRun, setAnimRun] = useState(0)
  const useFade = animationMode === "fade"

  useEffect(() => {
    if (isRevealed && !useFade) setAnimRun((n) => n + 1)
  }, [isRevealed, useFade])

  const enterClass = cardSide === "left" ? "timeline-card-enter-left" : "timeline-card-enter-right"
  const hiddenClass = cardSide === "left" ? "timeline-card-hidden-left" : "timeline-card-hidden-right"
  const motionClass = useFade
    ? isRevealed
      ? "timeline-card-fade-visible"
      : "timeline-card-fade-hidden"
    : isRevealed
      ? enterClass
      : hiddenClass

  return (
    <div
      key={useFade ? `timeline-card-fade-${index}` : isRevealed ? `timeline-card-in-${animRun}` : `timeline-card-out-${index}`}
      data-side={cardSide}
      className={`relative w-full ${useFade ? "" : "will-change-transform"} ${motionClass}`}
    >
      <div
        className="timeline-card-container rounded-[1.15rem] p-px shadow-[0_10px_28px_-18px_rgba(8,31,92,0.22)] transition-shadow duration-500 sm:rounded-[1.35rem] sm:p-[1.5px] sm:shadow-[0_20px_50px_-24px_rgba(8,31,92,0.35)]"
        style={{
          backgroundImage: isActive
            ? `linear-gradient(135deg, ${item.color} 0%, ${item.colorLight} 45%, ${bvViolet} 100%)`
            : `linear-gradient(135deg, ${item.color}88 0%, ${item.colorLight}66 100%)`,
        }}
      >
        <article
          className={`group relative min-w-0 overflow-hidden rounded-[1.05rem] bg-white/95 p-3.5 backdrop-blur-md transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:rounded-[1.2rem] sm:p-5 lg:p-6 ${
            isActive
              ? "-translate-y-0.5 shadow-[0_16px_36px_-18px_rgba(8,31,92,0.28)] sm:shadow-[0_24px_48px_-20px_rgba(8,31,92,0.35)]"
              : "shadow-[0_8px_24px_-16px_rgba(8,31,92,0.18)] sm:shadow-[0_12px_32px_-18px_rgba(8,31,92,0.2)]"
          } hover:-translate-y-1`}
          style={{ backgroundImage: `linear-gradient(160deg, #ffffff 0%, ${bvIce} 85%, ${bvPeriwinkle}33 100%)` }}
        >
          <span
            className="pointer-events-none absolute right-0 top-0 select-none font-black tabular-nums leading-none opacity-[0.06] sm:-right-3 sm:-top-6"
            style={{ fontSize: "clamp(2.5rem, 9vw, 6.5rem)", color: item.color }}
            aria-hidden
          >
            {item.step}
          </span>

          <div
            className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
            style={{ background: `radial-gradient(circle, ${item.colorLight}55 0%, transparent 68%)` }}
            aria-hidden
          />

          <div className="relative flex flex-wrap items-center gap-2">
            <span
              className="inline-flex rounded-full px-3 py-1 text-xs font-bold tabular-nums tracking-wide text-white shadow-md"
              style={{ backgroundImage: `linear-gradient(135deg, ${item.color} 0%, ${item.colorLight} 100%)` }}
            >
              {item.step}
            </span>
            <span
              className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] sm:text-xs"
              style={{ borderColor: borderBvSoft, color: textBodyOnLight }}
            >
              Step {index + 1} of {total}
            </span>
          </div>

          <h3 className="relative mt-3 text-[0.95rem] font-bold leading-snug sm:mt-4 sm:text-lg lg:text-xl" style={{ color: navy }}>
            {item.title}
          </h3>
          <p
            className="relative mt-2 text-justify text-xs leading-relaxed sm:mt-2.5 sm:text-sm lg:text-[0.95rem] lg:leading-relaxed"
            style={{ color: "#000" }}
          >
            {item.description}
          </p>
        </article>
      </div>
    </div>
  )
}

function ProcessWorkflowTimelineNode({
  item,
  isRevealed,
  isActive,
  animationMode = "slide",
  cardSide = "right",
  className = "",
}) {
  const Icon = item.icon
  const useFade = animationMode === "fade"
  const nodeMotionClass = useFade
    ? isRevealed
      ? "timeline-node-fade-visible"
      : "timeline-node-fade-hidden"
    : isRevealed
      ? "scale-100 opacity-100"
      : "pointer-events-none scale-75 opacity-0"

  return (
    <div
      data-side={cardSide}
      className={`relative z-20 flex shrink-0 flex-col items-center motion-reduce:transition-none ${useFade ? "" : "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"} ${className} ${nodeMotionClass}`}
    >
      <span
        className={`absolute inset-0 m-auto size-16 rounded-full motion-reduce:animate-none sm:size-18 ${
          isActive ? "animate-ping opacity-35" : "opacity-0"
        }`}
        style={{ backgroundColor: `${item.colorLight}77` }}
        aria-hidden
      />
      <div
        className={`relative flex size-12 items-center justify-center rounded-2xl shadow-[0_12px_28px_-12px_rgba(8,31,92,0.45)] ring-[3px] transition-[transform,box-shadow,ring-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:size-16 sm:shadow-[0_16px_36px_-12px_rgba(8,31,92,0.5)] sm:ring-4 ${
          isActive ? "scale-110 ring-white" : "scale-100 ring-white/90"
        }`}
        style={{
          backgroundImage: `linear-gradient(145deg, ${item.color} 0%, ${item.colorLight} 100%)`,
          boxShadow: isActive ? `0 0 0 6px ${item.colorLight}33, 0 16px 36px -12px rgba(8,31,92,0.5)` : undefined,
        }}
      >
        <Icon className="size-5 text-white sm:size-7" strokeWidth={1.6} aria-hidden />
      </div>
      <span
        className={`mt-2.5 text-[10px] font-bold tabular-nums tracking-[0.2em] sm:text-xs ${isRevealed ? "opacity-100" : "opacity-0"}`}
        style={{ color: item.color }}
      >
        {item.step}
      </span>
    </div>
  )
}

function ProcessWorkflowTimeline({ steps }) {
  const { inFocus, activeIndex, registerStepRef, progress, animationMode } = useTimelineScrollReveal(steps.length)

  return (
    <div
      className="relative mt-6 w-full sm:mt-8 lg:mt-12"
      role="list"
      aria-label="Scholarship application process steps"
    >
      <div
        className="pointer-events-none absolute bottom-4 left-[1.55rem] top-4 w-1 overflow-hidden rounded-full sm:left-[1.65rem] lg:inset-y-4 lg:left-1/2 lg:w-1.5 lg:-translate-x-1/2"
        aria-hidden
      >
        <div className="absolute inset-0 rounded-full bg-slate-200/80" />
        <div
          className="absolute inset-x-0 top-0 origin-top rounded-full transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            height: "100%",
            transform: `scaleY(${progress / 100})`,
            backgroundImage: `linear-gradient(180deg, ${navyDeep} 0%, ${navyBright} 42%, ${bvViolet} 88%, #c4b5fd 100%)`,
            boxShadow: `0 0 24px ${navyGlow}66`,
          }}
        />
      </div>

      <ol className="relative space-y-0">
          {steps.map((item, index) => {
            const isLast = index === steps.length - 1
            const isEven = index % 2 === 0
            const isRevealed = inFocus.has(index)
            const isActive = activeIndex === index

            return (
              <li
                key={item.id ?? item.step}
                ref={registerStepRef(index)}
                data-step-index={index}
                className={`group relative scroll-mt-20 grid grid-cols-[auto_minmax(0,1fr)] content-center items-center gap-x-3 py-3 sm:gap-x-4 sm:py-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-x-8 xl:gap-x-10 ${
                  isLast ? "pb-1" : "pb-2 sm:pb-3"
                }`}
              >
                <ProcessWorkflowTimelineNode
                  item={item}
                  isRevealed={isRevealed}
                  isActive={isActive}
                  animationMode={animationMode}
                  cardSide={isEven ? "left" : "right"}
                  className="col-start-1 row-start-1 lg:col-start-2 lg:justify-self-center"
                />

                <div
                  className={`col-start-2 row-start-1 w-full min-w-0 lg:max-w-lg xl:max-w-xl ${
                    isEven
                      ? "lg:col-start-1 lg:justify-self-end lg:pr-4"
                      : "lg:col-start-3 lg:justify-self-start lg:pl-4"
                  }`}
                >
                  <ProcessWorkflowTimelineStepCard
                    item={item}
                    index={index}
                    total={steps.length}
                    isRevealed={isRevealed}
                    isActive={isActive}
                    cardSide={isEven ? "left" : "right"}
                    animationMode={animationMode}
                  />
                </div>
              </li>
            )
          })}
      </ol>
    </div>
  )
}

const FACEBOOK_PAGE_URL = "https://www.facebook.com/marsuscholarship"
function FacebookPageEmbed({ pageUrl }) {
  const containerRef = useRef(null)
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    let frameId = 0
    let debounceId = 0

    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      const w = Math.floor(width)
      const h = Math.floor(height)
      if (w <= 0 || h <= 0) return
      setFrameSize((prev) => {
        if (Math.abs(prev.width - w) >= 12 || Math.abs(prev.height - h) >= 12) {
          return { width: w, height: h }
        }
        return prev.width > 0 ? prev : { width: w, height: h }
      })
    }

    const schedule = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        window.clearTimeout(debounceId)
        debounceId = window.setTimeout(measure, 120)
      })
    }

    measure()
    const observer = new ResizeObserver(schedule)
    observer.observe(el)
    window.addEventListener("resize", schedule, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", schedule)
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(debounceId)
    }
  }, [])

  const embedSrc = useMemo(() => {
    if (frameSize.width <= 0 || frameSize.height <= 0) return null
    return `https://www.facebook.com/plugins/page.php?${new URLSearchParams({
      href: pageUrl,
      tabs: "timeline",
      width: String(frameSize.width),
      height: String(frameSize.height),
      small_header: "true",
      adapt_container_width: "true",
      hide_cover: "true",
      show_facepile: "false",
    }).toString()}`
  }, [frameSize.height, frameSize.width, pageUrl])

  return (
    <div ref={containerRef} className="h-full min-h-0 w-full flex-1">
      {embedSrc ? (
        <iframe
          key={embedSrc}
          title="MARSU Scholarship Facebook page"
          src={embedSrc}
          className="block h-full w-full border-0"
          scrolling="no"
          allow="encrypted-media"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full min-h-[280px] w-full items-center justify-center text-sm text-slate-500 sm:min-h-[320px] lg:min-h-[360px]">
          Loading Facebook page…
        </div>
      )}
    </div>
  )
}

function BillboardAnnouncementSlide({ item, compact = false, variant = "text-only", children }) {
  const [expanded, setExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const [lockedImageHeight, setLockedImageHeight] = useState(null)
  const messageRef = useRef(null)
  const imageWrapRef = useRef(null)

  const message = String(item.message ?? "").trim()
  const hasMessage = Boolean(message)
  const isTextOnly = variant === "text-only"
  const isSingleImage = variant === "single-image"
  const hasImages = Boolean(children)

  const messageLineClamp = isTextOnly ? "line-clamp-4 sm:line-clamp-5" : "line-clamp-2"
  const messageTextClass = isTextOnly
    ? "text-sm sm:text-base"
    : compact
      ? "text-[11px]"
      : "text-xs sm:text-sm"
  const titleClass = isTextOnly
    ? compact
      ? "text-lg sm:text-xl"
      : "text-xl sm:text-2xl"
    : compact
      ? "text-sm sm:text-base"
      : "text-base sm:text-lg"
  const headerPadClass = isSingleImage
    ? "space-y-1 px-3 pt-3 pb-1.5 sm:px-4 sm:pt-3.5 sm:pb-2"
    : isTextOnly
      ? ""
      : "space-y-1 px-1 pb-0.5 sm:pb-1"
  const actionClassName = cn("font-semibold underline-offset-2 transition hover:underline", messageTextClass)

  useLayoutEffect(() => {
    setExpanded(false)
    setLockedImageHeight(null)
  }, [item.id])

  useLayoutEffect(() => {
    if (expanded || !hasImages) return undefined

    const el = imageWrapRef.current
    if (!el) return undefined

    const measureImageHeight = () => {
      const height = Math.round(el.getBoundingClientRect().height)
      if (height > 0) setLockedImageHeight(height)
    }

    measureImageHeight()
    const observer = new ResizeObserver(measureImageHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [item.id, expanded, hasImages, variant])

  useLayoutEffect(() => {
    if (!hasMessage) {
      setIsTruncated(false)
      return undefined
    }

    const el = messageRef.current
    if (!el) return undefined

    const checkTruncation = () => {
      if (expanded) return
      setIsTruncated(el.scrollHeight > el.clientHeight + 2)
    }

    checkTruncation()
    const observer = new ResizeObserver(checkTruncation)
    observer.observe(el)
    return () => observer.disconnect()
  }, [item.message, expanded, hasMessage, messageLineClamp])

  const imageWrapStyle =
    expanded && lockedImageHeight
      ? { height: lockedImageHeight, flexShrink: 0 }
      : undefined

  return (
    <div
      key={item.id}
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col text-center",
        expanded
          ? "overflow-y-auto overscroll-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5"
          : "overflow-hidden",
        isTextOnly && !expanded && "justify-center",
      )}
    >
      <div
        className={cn(
          "w-full",
          !expanded && hasImages && "flex h-full min-h-0 flex-col",
          !expanded && isTextOnly && "px-1",
          expanded && isTextOnly && "px-3 py-3 sm:px-4 sm:py-4",
        )}
      >
        <div
          className={cn(
            headerPadClass,
            "shrink-0",
            !expanded && isTextOnly && "mb-2",
          )}
        >
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span
              className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white sm:text-[10px]"
              style={{ backgroundImage: gradientNavyButton }}
            >
              {item.tag}
            </span>
            <time
              className={cn(
                "font-medium",
                isTextOnly ? "text-xs" : "text-[11px] sm:text-xs",
              )}
              style={{ color: textBodyOnLight }}
              dateTime={item.dateIso}
            >
              {item.dateLabel}
            </time>
          </div>
          <h3
            className={cn(
              "font-bold",
              !expanded && "line-clamp-2",
              isTextOnly ? "leading-snug" : "leading-tight",
              titleClass,
            )}
            style={{ color: navy }}
          >
            {item.title}
          </h3>
          {hasMessage ? (
            <div className={cn("relative w-full", !isTextOnly && "mt-0")}>
              <p
                ref={messageRef}
                className={cn(
                  "leading-snug",
                  "text-justify",
                  !isTruncated && "lg:text-center",
                  !expanded && messageLineClamp,
                  messageTextClass,
                  isTextOnly && !expanded && "mt-2",
                )}
                style={{ color: textBodyOnLight }}
              >
                {message}
                {expanded && isTruncated ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className={cn("inline align-baseline", actionClassName)}
                      style={{ color: navyBright }}
                      onClick={() => setExpanded(false)}
                    >
                      See less
                    </button>
                  </>
                ) : null}
              </p>
              {isTruncated && !expanded ? (
                <span className="absolute right-0 bottom-0 left-0 flex justify-end">
                  <span className="inline-flex max-w-full items-baseline bg-gradient-to-l from-white from-55% via-white/95 to-transparent pl-6 sm:pl-8">
                    <span className={messageTextClass} style={{ color: textBodyOnLight }} aria-hidden>
                      …{" "}
                    </span>
                    <button
                      type="button"
                      className={actionClassName}
                      style={{ color: navyBright }}
                      onClick={() => {
                        const el = imageWrapRef.current
                        if (el) {
                          const height = Math.round(el.getBoundingClientRect().height)
                          if (height > 0) setLockedImageHeight(height)
                        }
                        setExpanded(true)
                      }}
                    >
                      See more ...
                    </button>
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {hasImages ? (
          <div
            ref={imageWrapRef}
            className={cn(
              "relative w-full",
              !expanded && "min-h-0 flex-1 shrink-0",
              expanded && "shrink-0",
              variant === "multi-image" &&
                "mt-2.5 flex items-stretch justify-center px-1.5 pb-1.5 sm:mt-3 sm:px-2 sm:pb-2",
              variant === "single-image" && "px-2.5 pb-2.5 sm:px-3 sm:pb-3",
            )}
            style={imageWrapStyle}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function BillboardCard({
  title,
  subtitle,
  items = [],
  children,
  className = "",
  compact = false,
  slideAriaLabelPrefix = "slide",
  emptyMessage = "",
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const hasCarousel = items.length > 0

  useEffect(() => {
    if (!hasCarousel || items.length <= 1 || paused) return undefined
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length)
    }, ANNOUNCEMENT_ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [hasCarousel, items.length, paused])

  if (!hasCarousel && !children && !emptyMessage) return null

  const current = hasCarousel ? items[activeIndex] : null
  const isSingleImageSlide = (current?.imageUrls?.length ?? 0) === 1

  const goTo = (index) => {
    if (!hasCarousel) return
    setActiveIndex((index + items.length) % items.length)
  }

  const isEmbed = Boolean(children)
  const hasSlideImages = items.some((item) => item.imageUrls?.length > 0)
  const contentPadding = isEmbed
    ? "p-0"
    : isSingleImageSlide
      ? "p-0"
      : hasSlideImages
        ? compact
          ? "px-3 py-3 sm:px-4 sm:py-3"
          : "px-4 py-3 sm:px-5 sm:py-3"
        : compact
          ? "px-4 py-10 sm:px-5 sm:py-12"
          : "px-5 py-10 sm:px-8 sm:py-12"

  return (
    <div
      className={`relative flex h-full min-h-0 w-full flex-col ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
      }}
    >
      <div
        className="flex h-full min-h-0 flex-1 flex-col rounded-[1.35rem] p-[3px] shadow-2xl shadow-slate-900/20"
        style={{ backgroundImage: gradientNavyButton }}
      >
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[1.2rem] bg-white">
          <div
            className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-5"
            style={{ borderColor: borderNavySoft, backgroundImage: gradientNavyBlue }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" aria-hidden />
              <p
                className={`truncate font-bold uppercase tracking-[0.22em] text-white ${compact ? "text-[10px]" : "text-[11px] sm:text-xs"}`}
              >
                {title}
              </p>
            </div>
            <p
              className={`shrink-0 font-medium uppercase tracking-wider text-white/70 ${compact ? "text-[9px]" : "text-[10px] sm:text-[11px]"}`}
            >
              {subtitle}
            </p>
          </div>

          <div
            className={`relative flex flex-col ${
              isEmbed
                ? "min-h-[280px] flex-1 overflow-hidden sm:min-h-[320px] lg:min-h-[360px]"
                : "h-[280px] overflow-hidden sm:h-[320px] lg:h-[360px]"
            } ${contentPadding}`}
            style={{
              backgroundImage: isEmbed ? undefined : `linear-gradient(180deg, #ffffff 0%, ${bvIce} 100%)`,
              backgroundColor: isEmbed ? "#ffffff" : undefined,
            }}
          >
            {!isEmbed && !isSingleImageSlide ? (
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(8,31,92,0.35) 3px, rgba(8,31,92,0.35) 4px)",
                }}
                aria-hidden
              />
            ) : null}

            {children ? (
              <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">{children}</div>
            ) : !hasCarousel ? (
              <div className="relative flex h-full min-h-0 w-full flex-col justify-center text-center">
                <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ backgroundImage: gradientNavyButton }}
                  >
                    Notice
                  </span>
                  <span className="text-xs font-medium" style={{ color: textBodyOnLight }}>
                    Announcement feed
                  </span>
                </div>
                <h3
                  className={`font-bold leading-snug ${compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"}`}
                  style={{ color: navy }}
                >
                  {emptyMessage}
                </h3>
                <p
                  className={`mt-3 text-justify leading-relaxed lg:text-center ${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}
                  style={{ color: textBodyOnLight }}
                >
                  Please check back later for official scholarship updates and notices.
                </p>
              </div>
            ) : current.imageUrls?.length > 0 ? (
              <BillboardAnnouncementSlide
                item={current}
                compact={compact}
                variant={current.imageUrls.length === 1 ? "single-image" : "multi-image"}
              >
                <AnnouncementImageGallery
                  urls={current.imageUrls}
                  maxVisible={current.imageUrls.length === 1 ? 1 : 3}
                  compact
                  layout="strip"
                  singleLarge={current.imageUrls.length === 1}
                  borderless={current.imageUrls.length > 1}
                  className={current.imageUrls.length === 1 ? "h-full w-full" : "w-full"}
                  stripHeightClass={
                    current.imageUrls.length === 1
                      ? undefined
                      : "h-full min-h-[7.5rem] max-h-[10.5rem] sm:max-h-[11.5rem]"
                  }
                />
              </BillboardAnnouncementSlide>
            ) : (
              <BillboardAnnouncementSlide item={current} compact={compact} variant="text-only" />
            )}
          </div>

          {hasCarousel && items.length > 1 ? (
            <div
              className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3 ${compact ? "sm:px-4" : "sm:px-5"}`}
              style={{ borderColor: borderNavySoft, backgroundColor: "#f8fafc" }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold transition hover:bg-slate-50"
                  style={{ borderColor: borderNavySoft, color: navy }}
                  onClick={() => goTo(activeIndex - 1)}
                  aria-label={`Previous ${slideAriaLabelPrefix}`}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold transition hover:bg-slate-50"
                  style={{ borderColor: borderNavySoft, color: navy }}
                  onClick={() => goTo(activeIndex + 1)}
                  aria-label={`Next ${slideAriaLabelPrefix}`}
                >
                  Next
                </button>
              </div>
              <div className="flex items-center gap-1.5" role="tablist" aria-label={`${title} slides`}>
                {items.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={index === activeIndex}
                    aria-label={`Show ${slideAriaLabelPrefix}: ${item.title}`}
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: index === activeIndex ? "1.5rem" : "0.5rem",
                      backgroundColor: index === activeIndex ? navyBright : "rgba(8, 31, 92, 0.2)",
                    }}
                    onClick={() => goTo(index)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const location = useLocation()
  const [announcements, setAnnouncements] = useState([])
  const { batches: publishedLandingBatches, loading: landingBatchesLoading } = usePublishedLandingBatches()
  const { programs } = useOsgfaPrograms()
  const landingPageSettings = useLandingPageSettings()
  const landingPrivacy = landingPageSettings.privacy
  const landingContactInfo = landingPageSettings.contactInfo

  const workflowPrograms = useMemo(
    () => orderWorkflowPrograms(programs, PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER),
    [programs],
  )
  const workflowProgramCodes = useMemo(
    () => workflowPrograms.map((program) => String(program.code ?? "").trim().toUpperCase()).filter(Boolean),
    [workflowPrograms],
  )
  const workflowByProgram = useProcessWorkflowByProgram(workflowProgramCodes)
  const [activeWorkflowProgram, setActiveWorkflowProgram] = useState(
    () => workflowProgramCodes[0] ?? PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER[0],
  )

  useEffect(() => {
    if (!workflowProgramCodes.includes(activeWorkflowProgram)) {
      setActiveWorkflowProgram(workflowProgramCodes[0] ?? PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER[0])
    }
  }, [activeWorkflowProgram, workflowProgramCodes])

  const scholarshipProcessSteps = useMemo(
    () =>
      hydrateProcessWorkflowSteps(
        getWorkflowStepsForProgram({ byProgram: workflowByProgram }, activeWorkflowProgram),
      ),
    [workflowByProgram, activeWorkflowProgram],
  )

  useLayoutEffect(() => {
    const sectionId = location.hash.replace(/^#/, "")
    if (!sectionId) return

    const section = document.getElementById(sectionId)
    if (section) {
      section.scrollIntoView({ behavior: "auto", block: "start" })
    }
  }, [location.pathname, location.hash])

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await apiClient.get("/announcements")
        const fetched = Array.isArray(response.data) ? response.data : []
        const activeAnnouncements = fetched
          .filter((item) => item && isAnnouncementVisibleOnLanding(item))
          .sort((a, b) => {
            const aStart = resolveAnnouncementDates(a).startDate
            const bStart = resolveAnnouncementDates(b).startDate
            return new Date(bStart || b.createdAt || 0) - new Date(aStart || a.createdAt || 0)
          })
          .map((item, index) => {
            const { startDate, endDate } = resolveAnnouncementDates(item)
            const id = item.id || item._id || `announcement-${index}`
            const imageUrls = resolveAnnouncementImageUrls({ ...item, id })
            return {
              id,
              tag: getAnnouncementTypeLabel(item),
              dateIso: startDate || "",
              dateLabel: formatAnnouncementDurationLabel(startDate, endDate),
              title: item.title || "Untitled announcement",
              message: item.description || "",
              imageUrls,
              imageUrl: imageUrls[0] ?? null,
            }
          })
        setAnnouncements(activeAnnouncements)
      } catch (error) {
        console.error("Failed to load landing announcements:", error)
        setAnnouncements([])
      }
    }

    fetchAnnouncements()
  }, [])

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId)
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const publicLandingBatches = useMemo(
    () =>
      publishedLandingBatches.filter((batch) =>
        isActiveProgramCode(batch.program, programs),
      ),
    [programs, publishedLandingBatches],
  )

  const featuredBatchesByProgram = useMemo(
    () => buildFeaturedBatchesByProgram(publicLandingBatches),
    [publicLandingBatches],
  )

  const heroContent = (
    <div className="grid w-full items-center gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 xl:gap-16">
      <div className="mx-auto max-w-2xl space-y-4 text-center sm:space-y-6 lg:mx-0 lg:max-w-none lg:text-left">
        <p className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium tracking-wide text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md sm:px-3.5 sm:py-1.5 sm:text-xs lg:justify-start">
          Scholarship Records Management System (SRMS)
        </p>

        <HeroTypewriterTitle />

        <p className="text-pretty text-justify text-sm leading-relaxed text-white/80 sm:text-base lg:max-w-xl lg:text-left">
          Access scholarship announcements, application guidelines, batch information, and important updates
          from the MARSU – Office of the Scholarship Grants and Financial Assistance in one centralized
          platform.
        </p>

        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2 sm:gap-3 lg:mx-0 lg:flex lg:max-w-none lg:justify-start lg:gap-3">
          <Button
            type="button"
            className="h-auto min-h-11 w-full min-w-0 flex-row items-center justify-start gap-1.5 rounded-full border-0 px-2.5 py-2.5 text-left text-[11px] leading-snug font-semibold whitespace-normal text-white shadow-[0_12px_32px_rgba(8,31,92,0.45)] transition hover:-translate-y-0.5 hover:brightness-110 sm:gap-2 sm:px-4 sm:text-sm lg:h-11 lg:w-auto lg:justify-center lg:px-6"
            style={{ backgroundImage: gradientNavyButton }}
            onClick={() => scrollToSection("announcements")}
          >
            <Megaphone className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="min-w-0 flex-1">View announcements</span>
            <ChevronRight className="hidden h-4 w-4 shrink-0 opacity-90 sm:block" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-11 w-full min-w-0 flex-row items-center justify-start gap-1.5 rounded-full border-white/30 bg-white/10 px-2.5 py-2.5 text-left text-[11px] leading-snug font-semibold whitespace-normal text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/18 sm:gap-2 sm:px-4 sm:text-sm lg:h-11 lg:w-auto lg:justify-center lg:px-6"
            onClick={() => scrollToSection("batch-list")}
          >
            <ListChecks className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="min-w-0 flex-1">Browse batch list</span>
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md space-y-3 sm:space-y-4 lg:max-w-none">
        <div
          className="flex flex-wrap items-center justify-center gap-4 sm:gap-7"
          role="group"
          aria-label="Partner and institution logos"
        >
          <img
            src={orgLogo}
            alt="Scholarship Grants &amp; Financial Assistance Office, Marinduque State University"
            className="h-[4.25rem] w-[4.25rem] object-contain drop-shadow-lg sm:h-[6rem] sm:w-[6rem]"
            decoding="async"
          />
          <img
            src={marsuLogo}
            alt="Marinduque State University seal"
            className="h-[3.75rem] w-[3.75rem] object-contain drop-shadow-lg sm:h-[5.5rem] sm:w-[5.5rem]"
            decoding="async"
          />
          <img
            src={systemLogo}
            alt="Scholarship Records Management System emblem"
            className="h-[4.25rem] w-[4.25rem] object-contain drop-shadow-lg sm:h-[6rem] sm:w-[6rem]"
            decoding="async"
          />
        </div>

        <div className="flex flex-col gap-2.5 sm:gap-3">
          <div className="group flex items-start gap-3 rounded-2xl border border-sky-300/30 bg-white/[0.02] p-3.5 text-left shadow-[0_4px_24px_rgba(4,19,61,0.08)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/45 hover:bg-white/[0.04] sm:gap-3.5 sm:p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 ring-1 ring-sky-300/25 sm:size-[3.25rem]" aria-hidden>
              <Globe className="size-5 text-sky-200 sm:size-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white sm:text-base">Accessible</p>
              <p className="mt-1 text-justify text-xs leading-relaxed text-white/72 sm:text-sm">
                Quick access to scholarship information, announcements, and application updates.
              </p>
            </div>
          </div>
          <div className="group flex items-start gap-3 rounded-2xl border border-violet-300/30 bg-white/[0.02] p-3.5 text-left shadow-[0_4px_24px_rgba(4,19,61,0.08)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-violet-300/45 hover:bg-white/[0.04] sm:gap-3.5 sm:p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 ring-1 ring-violet-300/25 sm:size-[3.25rem]" aria-hidden>
              <LayoutList className="size-5 text-violet-200 sm:size-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white sm:text-base">Organized</p>
              <p className="mt-1 text-justify text-xs leading-relaxed text-white/72 sm:text-sm">
                Centralized records and batch listings for easier student monitoring and reference.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white" style={{ color: textBodyOnLight }}>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 hidden h-[min(88vh,680px)] overflow-hidden lg:block"
        style={{ backgroundColor: navyDeep }}
        aria-hidden
      >
        <HeroBackgroundLayers />
      </div>

      <LandingPublicHeader variant="cover" onSectionNavigate={scrollToSection} />

      <main className="relative w-full min-w-0 overflow-x-hidden">
        <section id="hero" className="relative w-full overflow-hidden lg:min-h-[min(88vh,680px)]">
          <div
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden lg:hidden"
            style={{ backgroundColor: navyDeep }}
            aria-hidden
          >
            <HeroBackgroundLayers />
          </div>

          <div className="relative z-10 text-white lg:pointer-events-none lg:fixed lg:inset-x-0 lg:top-0 lg:z-10 lg:h-[min(88vh,680px)]">
            <div className="pointer-events-auto mx-auto w-full max-w-7xl px-4 pb-6 pt-24 sm:px-6 sm:pb-8 sm:pt-28 lg:flex lg:h-full lg:items-center lg:px-8 lg:pb-16 lg:pt-36">
              {heroContent}
            </div>
          </div>

          <div className="hidden min-h-[min(88vh,680px)] lg:block" aria-hidden />

          <button
            type="button"
            onClick={() => scrollToSection("about")}
            className="relative z-20 mx-auto mb-1 flex text-white/90 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-reduce:animate-none sm:mb-2 lg:absolute lg:bottom-6 lg:left-1/2 lg:mb-0 lg:-translate-x-1/2"
            aria-label="Scroll to About the Organization"
          >
            <ChevronDown className="h-7 w-7 animate-bounce drop-shadow-[0_2px_8px_rgba(4,19,61,0.45)] sm:h-8 sm:w-8" aria-hidden />
          </button>
        </section>

        <section
          id="about"
          className="relative z-40 -mt-2 w-full scroll-mt-17 overflow-x-hidden border-b-0 sm:-mt-3 lg:mt-0 lg:border-b"
          style={{
            borderColor: borderNavySoft,
            backgroundImage: `linear-gradient(180deg, ${bvIce} 0%, ${bvIce} 14%, ${bvPeriwinkle} 42%, ${bvLilac} 100%)`,
          }}
        >
          <div className="relative z-10 mx-auto w-full max-w-7xl overflow-x-hidden px-4 pb-10 pt-3 sm:px-6 sm:pb-12 sm:pt-4 lg:px-8 lg:py-12">
            <div className="grid min-w-0 items-center gap-5 overflow-x-hidden lg:grid-cols-2 lg:gap-3 xl:gap-4">
              <div className="order-1 min-w-0 overflow-hidden lg:mx-0 lg:w-full">
                <AboutImageSlideshow slides={aboutSlideshowSlides} />
              </div>

              <div className="order-2 min-w-0 overflow-hidden lg:pl-0">
                <h2 className="relative text-[clamp(1.65rem,3.5vw,2.75rem)] font-extrabold leading-[1.15] tracking-tight">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage: `linear-gradient(105deg, ${navyDeep} 0%, ${navy} 32%, ${navyBright} 62%, ${bvViolet} 100%)`,
                    }}
                  >
                    About the Organization
                  </span>
                </h2>
                <p className="mt-4 text-justify text-sm leading-relaxed sm:text-base" style={{ color: "#000" }}>
                  The MARSU - Office of the Scholarship Grants and Financial Assistance is committed to providing
                  students with accessible scholarship opportunities and financial assistance programs through
                  partnerships with government agencies, private organizations, and sponsoring institutions.
                </p>
                <p className="mt-4 text-justify text-sm leading-relaxed sm:text-base" style={{ color: "#000" }}>
                  The office manages scholarship applications, student requirements verification, beneficiary monitoring,
                  announcements, and student inquiries to ensure an organized and efficient scholarship process. It also
                  coordinates payout verification and related documentation to support the proper distribution of
                  financial assistance to qualified beneficiaries.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="announcements"
          className="relative z-40 w-full scroll-mt-17 border-b bg-white py-10 sm:py-12 lg:py-14"
          style={{ borderColor: borderNavySoft }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 w-full">
              <p
                className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ borderColor: borderBvSoft, color: navy }}
              >
                Campus updates
              </p>
              <h2 className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[clamp(1.65rem,3.5vw,2.75rem)] font-extrabold leading-[1.15] tracking-tight">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(105deg, ${navyDeep} 0%, ${navy} 32%, ${navyBright} 62%, ${bvViolet} 100%)`,
                  }}
                >
                  Announcements
                </span>
                <span
                  className="relative inline-flex shrink-0 items-center justify-center self-center pl-0.5"
                  aria-hidden
                >
                  <svg className="absolute h-0 w-0" aria-hidden>
                    <defs>
                      <linearGradient
                        id="announcements-title-icon-gradient"
                        x1="0%"
                        y1="18%"
                        x2="100%"
                        y2="82%"
                      >
                        <stop offset="0%" stopColor={navy} />
                        <stop offset="48%" stopColor={navyBright} />
                        <stop offset="100%" stopColor={navyGlow} />
                      </linearGradient>
                      <linearGradient
                        id="announcements-title-icon-fill"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor={bvIce} />
                        <stop offset="100%" stopColor={bvPeriwinkle} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="announcements-megaphone-glow pointer-events-none absolute -inset-2 rounded-full" />
                  <span className="announcements-megaphone-ring pointer-events-none absolute -inset-1 rounded-full" />
                  <Megaphone
                    className="announcements-megaphone-icon relative size-[1.12em] w-[1.12em]"
                    stroke="url(#announcements-title-icon-gradient)"
                    fill="url(#announcements-title-icon-fill)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </span>
              </h2>
              <p className="mt-2 max-w-none text-justify text-sm leading-relaxed sm:text-base" style={{ color: "#000" }}>
                Access the latest scholarship announcements, application updates, schedules, and important notices posted by the MARSU - Office of the Scholarship Grants and Financial Assistance.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 items-stretch gap-3 sm:gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,19rem)] lg:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)] xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
              <BillboardCard
                title="Announcements"
                subtitle="Official notices"
                items={announcements}
                slideAriaLabelPrefix="announcement"
                emptyMessage="No active announcements at the moment."
                className="min-w-0 w-full"
              />
              <BillboardCard title="Facebook page" subtitle="Follow us" compact className="min-w-0 w-full">
                <FacebookPageEmbed pageUrl={FACEBOOK_PAGE_URL} />
              </BillboardCard>
            </div>
          </div>
        </section>

        <section
          id="contact"
          className="relative z-40 w-full py-10 sm:py-12 lg:py-14"
          style={{ backgroundImage: gradientLightBlueViolet }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div id="batch-list" className="mb-6 scroll-mt-28 overflow-x-hidden">
              <div className="mb-4 w-full lg:mb-5">
                <p
                  className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                  style={{ borderColor: borderBvSoft, color: navy }}
                >
                  Featured batches
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="relative text-[clamp(1.65rem,3.5vw,2.75rem)] font-extrabold leading-[1.15] tracking-tight">
                    <span
                      className="bg-clip-text text-transparent"
                      style={{
                        backgroundImage: `linear-gradient(105deg, ${navyDeep} 0%, ${navy} 32%, ${navyBright} 62%, ${bvViolet} 100%)`,
                      }}
                    >
                      Batch List
                    </span>
                  </h2>
                  {landingPrivacy.showViewAllBatchesLink ? (
                    <Link
                      to="/view-all-batches"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-white/90 px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-white sm:text-sm"
                      style={{ borderColor: borderBvSoft, color: navy }}
                    >
                      View all
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  ) : null}
                </div>
                <p className="mt-2 max-w-none text-justify text-sm leading-relaxed sm:text-base" style={{ color: "#000" }}>
                  View the list of scholarship batches and registered beneficiary records maintained within the Scholarship Records Management System for monitoring and reference purposes.
                </p>
              </div>

              <div className="space-y-4">
                {landingBatchesLoading ? (
                  <div
                    className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm"
                    style={{ borderColor: borderBvSoft, color: textBodyOnLight }}
                  >
                    Loading published batches…
                  </div>
                ) : featuredBatchesByProgram.length > 0 ? (
                  featuredBatchesByProgram.map(({ programLabel, items }, index) => (
                    <FeaturedBatchScroller
                      key={programLabel}
                      programLabel={programLabel}
                      items={items}
                      scrollDirection={programLabel === "TDP" || index % 2 === 1 ? "right" : "left"}
                      privacy={landingPrivacy}
                    />
                  ))
                ) : (
                  <div
                    className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm"
                    style={{ borderColor: borderBvSoft, color: textBodyOnLight }}
                  >
                    No batches are currently published on the landing page. OSGFA staff can enable batches from the Batches module.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          id="process"
          className="relative z-40 w-full scroll-mt-17 overflow-x-hidden border-y pt-10 pb-28 sm:pt-12 sm:pb-32 lg:pt-14 lg:pb-36"
          style={{ borderColor: borderNavySoft, backgroundImage: gradientLightBlueViolet }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 w-full lg:mb-8">
              <p
                className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ borderColor: borderBvSoft, color: navy }}
              >
                {LANDING_PROCESS_SECTION.badge}
              </p>
              <h2 className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[clamp(1.65rem,3.5vw,2.75rem)] font-extrabold leading-[1.15] tracking-tight">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-[0_8px_20px_-8px_rgba(8,31,92,0.45)] ring-2 ring-white/80 sm:size-11"
                  style={{ backgroundImage: gradientNavyButton }}
                  aria-hidden
                >
                  <ListChecks className="size-5 text-white sm:size-[1.35rem]" strokeWidth={1.75} />
                </span>
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(105deg, ${navyDeep} 0%, ${navy} 32%, ${navyBright} 62%, ${bvViolet} 100%)`,
                  }}
                >
                  Process / Workflow
                </span>
              </h2>
              <p className="mt-2 max-w-none text-justify text-sm leading-relaxed sm:text-base" style={{ color: "#000" }}>
                {LANDING_PROCESS_SECTION.description}
              </p>
            </div>

            <ProcessWorkflowProgramTabs
              programs={workflowPrograms}
              activeCode={activeWorkflowProgram}
              onChange={setActiveWorkflowProgram}
            />
            <div
              id={`workflow-panel-${activeWorkflowProgram}`}
              role="tabpanel"
              aria-labelledby={`workflow-tab-${activeWorkflowProgram}`}
            >
              <ProcessWorkflowTimeline key={activeWorkflowProgram} steps={scholarshipProcessSteps} />
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-40 w-full border-t border-white/10 text-white" style={{ backgroundImage: gradientNavyFooter }}>
        <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-8 lg:px-8">
          <div className="space-y-1.5 pb-6 text-center sm:text-left">
            <div
              className="flex flex-wrap items-center justify-center gap-3 sm:justify-start sm:gap-4"
              role="group"
              aria-label="Partner and institution logos"
            >
              <img
                src={orgLogo}
                alt="Scholarship Grants &amp; Financial Assistance Office, Marinduque State University"
                className="h-9 w-9 object-contain drop-shadow-lg sm:h-10 sm:w-10"
                decoding="async"
              />
              <img
                src={marsuLogo}
                alt="Marinduque State University seal"
                className="h-9 w-9 object-contain drop-shadow-lg sm:h-10 sm:w-10"
                decoding="async"
              />
              <img
                src={systemLogo}
                alt="Scholarship Records Management System emblem"
                className="h-9 w-9 object-contain drop-shadow-lg sm:h-10 sm:w-10"
                decoding="async"
              />
            </div>
            <p className="text-sm font-semibold sm:text-base">Scholarship Records Management System</p>
            <p className="mx-auto max-w-3xl text-justify text-xs leading-snug text-white/80 sm:mx-0 sm:text-left sm:text-sm">
              Digitizing scholarship record management through an organized and centralized platform.
            </p>
          </div>

          <div className="grid gap-6 pb-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-10">
            <div>
              <p className="text-xs font-semibold tracking-wide text-white sm:text-sm">Quick Links</p>
              <ul className="mt-2 space-y-1 text-sm text-white/85">
                {[
                  { label: "Home", target: "hero" },
                  { label: "About", target: "about" },
                  { label: "Announcements", target: "announcements" },
                  { label: "Batch List", target: "batch-list" },
                  { label: "Process", target: "process" },
                ].map((item) => (
                  <li key={item.target} className="flex gap-1.5">
                    <span className="text-white/60" aria-hidden>
                      •
                    </span>
                    <button
                      type="button"
                      className="text-left underline-offset-4 transition hover:text-white hover:underline"
                      onClick={() => {
                        scrollToSection(item.target)
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-wide text-white sm:text-sm">Contact Info</p>
              <ul className="mt-2 space-y-1.5 text-sm text-white/85">
                <li className="flex gap-1.5">
                  <span className="shrink-0 text-white/60" aria-hidden>
                    •
                  </span>
                  <span>
                    <span className="font-medium text-white/90">Email Address</span>
                    <span className="block text-xs text-white/75 sm:text-sm">
                      {landingContactInfo.emailAddress}
                    </span>
                  </span>
                </li>
                <li className="flex gap-1.5">
                  <span className="shrink-0 text-white/60" aria-hidden>
                    •
                  </span>
                  <span>
                    <span className="font-medium text-white/90">Contact Number</span>
                    <span className="block text-xs text-white/75 sm:text-sm">
                      {landingContactInfo.contactNumber}
                    </span>
                  </span>
                </li>
                <li className="flex gap-1.5">
                  <span className="shrink-0 text-white/60" aria-hidden>
                    •
                  </span>
                  <span>
                    <span className="font-medium text-white/90">Office Address</span>
                    <span className="block text-xs leading-snug text-white/75 sm:text-sm">
                      {landingContactInfo.officeAddress}
                    </span>
                  </span>
                </li>
              </ul>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold tracking-wide text-white sm:text-sm">Admin Login</p>
              <p className="mt-2 text-justify text-sm leading-relaxed text-white/85 sm:text-left">
                Authorized scholarship office personnel can sign in to manage batches, grantees, and reports in SRMS.
              </p>
              <div className="mt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-white/35 bg-white/12 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#081f5c]"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-white/20" aria-hidden />

          <p className="pt-5 text-justify text-xs text-white/70 sm:text-center">
            © 2026 Scholarship Records Management System. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
