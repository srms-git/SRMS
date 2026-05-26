import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Banknote, Bell, CalendarClock, ChevronRight, ClipboardList, ListChecks, Megaphone } from "lucide-react"
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
import { LANDING_FEATURED_BATCHES } from "@/lib/landingFeaturedBatches"
import { LandingPublicHeader } from "@/components/LandingPublicHeader"
import { Button } from "@/components/ui/button"

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

/** Center-anchored slot: height grows evenly toward top and bottom. */
const featuredBatchScrollerTrackClassName = "min-h-[12.25rem] items-center sm:min-h-[13rem]"

const featuredBatchCardSlotClassName =
  "relative z-0 shrink-0 self-center w-[300px] h-[10.5rem] transition-[width,height] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:z-20 hover:w-[368px] hover:h-[12.75rem] sm:w-[328px] sm:h-[11rem] sm:hover:w-[408px] sm:hover:h-[13rem]"

function getBatchCardAccent(program) {
  if (program === "TDP") {
    return { color: navyMuted, colorLight: navyGlow, label: "TDP" }
  }
  return { color: navyDeep, colorLight: navyBright, label: "TES" }
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

function FeaturedBatchScroller({ programLabel, items, scrollDirection = "left" }) {
  const scrollRef = useRef(null)
  const stripRef = useRef(null)
  const chunkWidthRef = useRef(0)
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
  }, [items, scrollDirection])

  const measureStrip = useCallback(() => {
    const strip = stripRef.current
    const next = strip?.nextElementSibling
    if (strip && next instanceof HTMLElement) {
      chunkWidthRef.current = next.offsetLeft - strip.offsetLeft
    } else if (strip) {
      chunkWidthRef.current = strip.offsetWidth
    } else {
      chunkWidthRef.current = 0
    }
  }, [])

  useLayoutEffect(() => {
    measureStrip()
    const strip = stripRef.current
    if (!strip || typeof ResizeObserver === "undefined") return undefined

    let debounceId = 0
    const scheduleMeasure = () => {
      window.clearTimeout(debounceId)
      debounceId = window.setTimeout(measureStrip, 300)
    }

    const ro = new ResizeObserver(scheduleMeasure)
    ro.observe(strip)

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
  }, [items, measureStrip])

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
    if (items.length === 0) return undefined
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
      if (chunk > 0 && !isAutoScrollPaused()) {
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
  }, [items, scrollDirection, isAutoScrollPaused, setScrollProgrammatically])

  const renderCard = (batch, keyPrefix, duplicate) => {
    const cardKey = getFeaturedBatchCardKey(batch, keyPrefix)
    const accent = getBatchCardAccent(batch.program)
    const batchLabel = String(batch.batchNo ?? "?")

    return (
      <div
        key={cardKey}
        data-batch-slot=""
        className={featuredBatchCardSlotClassName}
        aria-hidden={duplicate ? true : undefined}
      >
        <div
          className="group/batch h-full rounded-[1.35rem] p-[1.5px] shadow-[0_16px_40px_-20px_rgba(8,31,92,0.28)] transition-shadow duration-500 hover:shadow-[0_24px_48px_-18px_rgba(8,31,92,0.38)]"
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
            className="group/batch relative flex h-full w-full flex-col overflow-hidden rounded-[1.2rem] bg-white/95 p-4 text-left backdrop-blur-md transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-16px_rgba(8,31,92,0.28)] sm:p-5"
            style={{ backgroundImage: `linear-gradient(160deg, #ffffff 0%, ${bvIce} 88%, ${bvPeriwinkle}33 100%)` }}
            tabIndex={duplicate ? -1 : undefined}
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
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold tracking-tight text-white shadow-[0_10px_24px_-8px_rgba(8,31,92,0.45)] ring-2 ring-white transition-transform duration-500 group-hover/batch:scale-105 sm:size-13"
                style={{
                  backgroundImage: `linear-gradient(145deg, ${accent.color} 0%, ${accent.colorLight} 100%)`,
                }}
                aria-hidden
              >
                {batchLabel.slice(0, 3)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ backgroundImage: gradientNavyButton }}
                  >
                    {accent.label}
                  </span>
                  <span
                    className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ borderColor: borderBvSoft, color: textBodyOnLight }}
                  >
                    Batch
                  </span>
                </div>

                <h3 className="mt-2 text-base font-bold leading-snug sm:text-lg" style={{ color: navy }}>
                  Batch {batchLabel}
                </h3>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: textBodyOnLight }}>
                  {batch.createdAt}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]"
                    style={{ borderColor: borderBvSoft, color: navy }}
                  >
                    AY {batch.schoolYear || "—"}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white sm:text-[11px]"
                    style={{ backgroundImage: `linear-gradient(135deg, ${accent.colorLight} 0%, #34d399 100%)` }}
                  >
                    <span className="size-1.5 rounded-full bg-white/90" aria-hidden />
                    {batch.grantees} grantees
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div>
      <p
        className="mb-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-xs"
        style={{ borderColor: borderBvSoft, color: navy }}
      >
        {programLabel} batches
      </p>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onPointerOver={handleScrollerPointerOver}
        onPointerLeave={handleScrollerPointerLeave}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
            bumpInteractionPause()
          }
        }}
        className={`-mx-1 flex gap-4 overflow-x-auto overflow-y-visible px-1 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${featuredBatchScrollerTrackClassName}`}
        tabIndex={0}
        role="region"
        aria-label={`${programLabel} batch list, auto-scrolling`}
      >
        <div ref={stripRef} className="flex shrink-0 items-center gap-4 self-center">
          {items.map((batch) => renderCard(batch, "a", false))}
        </div>
        <div className="flex shrink-0 items-center gap-4 self-center" aria-hidden>
          {items.map((batch) => renderCard(batch, "b", true))}
        </div>
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

  return (
    <div
      ref={containerRef}
      className="relative order-2 w-full overflow-hidden overscroll-none touch-none outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:order-2"
      role="region"
      aria-label="About the organization photo slideshow"
      aria-roledescription="carousel"
      tabIndex={0}
      onMouseLeave={() => setHoveredIndex(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") stepSlide(1)
        if (e.key === "ArrowLeft") stepSlide(-1)
      }}
    >
      <div
        className="relative mx-auto h-[330px] w-full max-w-3xl overflow-hidden outline-none sm:h-[365px] lg:h-[420px] lg:max-w-4xl"
        style={{ perspective: "1200px" }}
        aria-live="polite"
      >
        <div
          className="pointer-events-none absolute -left-16 -top-16 size-36 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(20,71,166,0.35) 0%, transparent 72%)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-14 size-44 rounded-full opacity-55 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(165,180,252,0.42) 0%, transparent 74%)" }}
          aria-hidden
        />
        {slides.map((slide, index) => {
          const offset = getCoverflowOffset(index, activeIndex, slides.length)
          if (Math.abs(offset) > 1) return null

          const isCenter = offset === 0
          const isHovered = hoveredIndex === index
          const baseScale = isCenter ? 1.04 : 0.84
          const scale = isHovered ? (isCenter ? 1.1 : 0.95) : baseScale
          const translateX = offset * 38
          const zIndex = isHovered ? 30 : 20 - Math.abs(offset) * 5

          return (
            <article
              key={slide.alt}
              className={`absolute left-1/2 top-1/2 aspect-4/3 w-[min(84%,340px)] overflow-hidden rounded-[1.4rem] border border-white/50 transition-[transform,opacity,box-shadow,filter] duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] will-change-transform sm:w-[min(82%,360px)] lg:w-[min(80%,380px)] ${
                !isCenter ? "cursor-pointer" : "cursor-default"
              }`}
              style={{
                transform: `translate(-50%, -50%) translateX(${translateX}%) scale(${scale})`,
                zIndex,
                opacity: isCenter || isHovered ? 1 : 0.84,
                boxShadow: isCenter
                  ? "0 22px 50px -25px rgba(8,31,92,0.45)"
                  : "0 16px 35px -24px rgba(8,31,92,0.34)",
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
              {isCenter ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-[#04133d]/45 to-transparent"
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

const scholarshipProcessSteps = [
  {
    step: "01",
    title: "Verify Your Name on the Final List",
    description:
      "Check the officially announced final list for the TES/TDP program to confirm if you are included as a beneficiary.",
    icon: ListChecks,
    color: "#04133d",
    colorLight: "#0b2b73",
  },
  {
    step: "02",
    title: "Wait for the Submission Schedule Announcement",
    description:
      "Monitor announcements regarding the schedule assigned to your batch for the submission of the required documents.",
    icon: CalendarClock,
    color: "#0b2b73",
    colorLight: "#1447a6",
  },
  {
    step: "03",
    title: "Submit the Required Documents",
    description:
      "Submit all required requirements at the Office of Scholarships, Grants, and Financial Assistance, located at the 3rd Floor, Auxiliary Building.",
    icon: ClipboardList,
    color: "#1447a6",
    colorLight: "#2a63cc",
  },
  {
    step: "04",
    title: "Wait for the Payout Schedule Announcement",
    description:
      "After submitting your requirements, wait for the official payout schedule announcement posted by the Office of Scholarships, Grants, and Financial Assistance.",
    icon: Bell,
    color: "#1e52b0",
    colorLight: "#3d8fd4",
  },
  {
    step: "05",
    title: "Claim Your Financial Assistance",
    description:
      "Once the payout schedule for your batch is announced, proceed to the Cashier's Office, located on the 1st Floor of the Auxiliary Building, to claim your financial assistance.",
    icon: Banknote,
    color: "#2a63cc",
    colorLight: "#5ba8e8",
  },
]

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
        className="timeline-card-container rounded-[1.35rem] p-[1.5px] shadow-[0_20px_50px_-24px_rgba(8,31,92,0.35)] transition-shadow duration-500"
        style={{
          backgroundImage: isActive
            ? `linear-gradient(135deg, ${item.color} 0%, ${item.colorLight} 45%, ${bvViolet} 100%)`
            : `linear-gradient(135deg, ${item.color}88 0%, ${item.colorLight}66 100%)`,
        }}
      >
        <article
          className={`group relative min-w-0 overflow-hidden rounded-[1.2rem] bg-white/95 p-4 backdrop-blur-md transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:p-5 lg:p-6 ${
            isActive ? "-translate-y-0.5 shadow-[0_24px_48px_-20px_rgba(8,31,92,0.35)]" : "shadow-[0_12px_32px_-18px_rgba(8,31,92,0.2)]"
          } hover:-translate-y-1`}
          style={{ backgroundImage: `linear-gradient(160deg, #ffffff 0%, ${bvIce} 85%, ${bvPeriwinkle}33 100%)` }}
        >
          <span
            className="pointer-events-none absolute -right-2 -top-4 select-none font-black tabular-nums leading-none opacity-[0.06] sm:-right-3 sm:-top-6"
            style={{ fontSize: "clamp(3.5rem, 12vw, 6.5rem)", color: item.color }}
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
            {isActive ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white sm:text-xs"
                style={{ backgroundImage: gradientNavyButton }}
              >
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" aria-hidden />
                Now viewing
              </span>
            ) : null}
          </div>

          <h3 className="relative mt-4 text-base font-bold leading-snug sm:text-lg lg:text-xl" style={{ color: navy }}>
            {item.title}
          </h3>
          <p
            className="relative mt-2.5 text-justify text-xs leading-relaxed sm:text-sm lg:text-[0.95rem] lg:leading-relaxed"
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
        className={`relative flex size-14 items-center justify-center rounded-2xl shadow-[0_16px_36px_-12px_rgba(8,31,92,0.5)] ring-4 transition-[transform,box-shadow,ring-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:size-16 ${
          isActive ? "scale-110 ring-white" : "scale-100 ring-white/90"
        }`}
        style={{
          backgroundImage: `linear-gradient(145deg, ${item.color} 0%, ${item.colorLight} 100%)`,
          boxShadow: isActive ? `0 0 0 6px ${item.colorLight}33, 0 16px 36px -12px rgba(8,31,92,0.5)` : undefined,
        }}
      >
        <Icon className="size-6 text-white sm:size-7" strokeWidth={1.6} aria-hidden />
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
    <div className="relative mt-8 lg:mt-12">
      <div
        className="pointer-events-none absolute -inset-x-6 -top-8 bottom-0 rounded-[2rem] opacity-70 sm:-inset-x-10"
        style={{ backgroundImage: gradientLightBlueViolet }}
        aria-hidden
      />

      <div
        className="relative mx-auto w-full max-w-3xl overflow-visible lg:max-w-5xl xl:max-w-6xl"
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

        <ol className="relative space-y-0 overflow-visible">
          {steps.map((item, index) => {
            const isLast = index === steps.length - 1
            const isEven = index % 2 === 0
            const isRevealed = inFocus.has(index)
            const isActive = activeIndex === index

            return (
              <li
                key={item.step}
                ref={registerStepRef(index)}
                data-step-index={index}
                className={`group relative scroll-mt-20 grid grid-cols-[auto_1fr] content-center items-center gap-x-4 overflow-visible py-3 sm:gap-x-5 sm:py-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-x-8 xl:gap-x-10 ${
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
                  className={`col-start-2 row-start-1 w-full min-w-0 overflow-visible lg:max-w-lg xl:max-w-xl ${
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
    </div>
  )
}

const FACEBOOK_PAGE_URL = "https://www.facebook.com/marsuscholarship"
const ANNOUNCEMENT_TAGS = {
  new_batch: "New batch",
  requirement_schedule: "Requirement schedule",
  payout_schedule: "Payout schedule",
  unclaimed: "Unclaimed",
  opportunity: "Opportunity",
  advisory: "Advisory",
}

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

  const goTo = (index) => {
    if (!hasCarousel) return
    setActiveIndex((index + items.length) % items.length)
  }

  const isEmbed = Boolean(children)
  const contentPadding = isEmbed ? "p-0" : compact ? "px-4 py-10 sm:px-5 sm:py-12" : "px-5 py-10 sm:px-8 sm:py-12"

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
                : "min-h-[280px] justify-center sm:min-h-[320px] lg:min-h-[360px]"
            } ${contentPadding}`}
            style={{
              backgroundImage: isEmbed ? undefined : `linear-gradient(180deg, #ffffff 0%, ${bvIce} 100%)`,
              backgroundColor: isEmbed ? "#ffffff" : undefined,
            }}
          >
            {!isEmbed ? (
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
              <div className="relative w-full text-center">
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
                  className={`mt-3 leading-relaxed ${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}
                  style={{ color: textBodyOnLight }}
                >
                  Please check back later for official scholarship updates and notices.
                </p>
              </div>
            ) : (
              <div key={current.id} className="relative w-full text-center">
                <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ backgroundImage: gradientNavyButton }}
                  >
                    {current.tag}
                  </span>
                  <time className="text-xs font-medium" style={{ color: textBodyOnLight }} dateTime={current.dateIso}>
                    {current.dateLabel}
                  </time>
                </div>
                <h3
                  className={`font-bold leading-snug ${compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"}`}
                  style={{ color: navy }}
                >
                  {current.title}
                </h3>
                <p
                  className={`mt-3 leading-relaxed ${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}
                  style={{ color: textBodyOnLight }}
                >
                  {current.message}
                </p>
              </div>
            )}
          </div>

          {hasCarousel ? (
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
          .filter((item) => item && item.active !== false)
          .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))
          .map((item, index) => {
            const rawDate = item.date || item.createdAt
            const dateObj = rawDate ? new Date(rawDate) : null
            const hasValidDate = dateObj instanceof Date && !Number.isNaN(dateObj.getTime())
            return {
              id: item.id || item._id || `announcement-${index}`,
              tag: ANNOUNCEMENT_TAGS[item.type] || "General",
              dateIso: hasValidDate ? dateObj.toISOString().slice(0, 10) : "",
              dateLabel: hasValidDate
                ? dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : "No date",
              title: item.title || "Untitled announcement",
              message: item.description || "",
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

  const featuredBatchesByProgram = [
    { programLabel: "TES", items: LANDING_FEATURED_BATCHES.filter((b) => b.program === "TES") },
    { programLabel: "TDP", items: LANDING_FEATURED_BATCHES.filter((b) => b.program === "TDP") },
  ].filter((row) => row.items.length > 0)

  return (
    <div className="min-h-screen w-full min-w-0 bg-white" style={{ color: textBodyOnLight }}>
      <LandingPublicHeader onSectionNavigate={scrollToSection} />

      <main className="w-full min-w-0">
        <section
          id="hero"
          className="relative w-full min-h-[min(72vh,560px)] overflow-hidden text-white"
          style={{
            backgroundColor: navyDeep,
            backgroundImage: `url(${navHeroBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center bottom",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: `${gradientHeroMesh}, linear-gradient(180deg, rgba(4, 19, 61, 0.82) 0%, rgba(4, 19, 61, 0.48) 38%, rgba(4, 19, 61, 0.22) 62%, rgba(4, 19, 61, 0.5) 100%)`,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)",
              backgroundSize: "200% 200%",
            }}
            aria-hidden
          />
          <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-12 text-center sm:px-6 lg:px-8 lg:py-16">
            <div className="mx-auto space-y-5">
              <p
                className="mx-auto inline-flex rounded-full border border-white/35 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-sm"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${navyMuted}e6 0%, ${navy}cc 55%, ${navyBright}cc 100%)`,
                }}
              >
                Scholarship Records Management System (SRMS)
              </p>

              <h1 className="text-[clamp(0.95rem,2.6vw+0.5rem,3rem)] font-bold leading-tight text-white lg:leading-[1.15]">
                <span className="block whitespace-nowrap">
                  Centralized Access to Scholarship
                </span>
                <span
                  className="block whitespace-nowrap bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(120deg, #ffffff 0%, ${bvPeriwinkle} 55%, ${bvSoft} 100%)`,
                  }}
                >
                  Information and Assistance
                </span>
              </h1>

              <div className="mx-auto max-w-2xl space-y-2 text-sm text-white/75 sm:text-base">
                <p>Access scholarship announcements, application guidelines, batch information, and important updates from the MARSU - Office of the Scholarship Grants and Financial Assistance in one centralized platform.</p>
        
              </div>

              <div
                className="flex flex-wrap items-center justify-center gap-4 sm:gap-6"
                role="group"
                aria-label="Partner and institution logos"
              >
                <img
                  src={orgLogo}
                  alt="Scholarship Grants &amp; Financial Assistance Office, Marinduque State University"
                  className="h-16 w-16 object-contain drop-shadow-lg sm:h-20 sm:w-20"
                  decoding="async"
                />
                <img
                  src={marsuLogo}
                  alt="Marinduque State University seal"
                  className="h-16 w-16 object-contain drop-shadow-lg sm:h-20 sm:w-20"
                  decoding="async"
                />
                <img
                  src={systemLogo}
                  alt="Scholarship Records Management System emblem"
                  className="h-16 w-16 object-contain drop-shadow-lg sm:h-20 sm:w-20"
                  decoding="async"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 pt-4 text-center text-xs text-white/75 sm:grid-cols-2 sm:text-sm">
                <div className="rounded-xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
                  <p className="text-lg font-semibold text-white">Accessible</p>
                  <p>Quick access to scholarship information, announcements, and application updates</p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
                  <p className="text-lg font-semibold text-white">Organized</p>
                  <p>Centralized records and batch listings for easier student monitoring and reference.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="about"
          className="w-full scroll-mt-17 border-y"
          style={{ borderColor: borderNavySoft, backgroundImage: gradientLightBlueViolet }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
            <div className="grid items-center gap-8 overflow-visible lg:grid-cols-2 lg:gap-12">
              <AboutImageSlideshow slides={aboutSlideshowSlides} />

              <div className="order-1 lg:order-1">
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
          className="w-full scroll-mt-17 border-b bg-white py-10 sm:py-12 lg:py-14"
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
              <h2 className="relative mt-4 flex items-center gap-3 text-[clamp(1.65rem,3.5vw,2.75rem)] font-extrabold leading-[1.15] tracking-tight">
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
              <p className="mt-2 max-w-none text-sm leading-relaxed sm:text-base" style={{ color: "#000" }}>
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
          className="w-full py-10 sm:py-12 lg:py-14"
          style={{ backgroundImage: gradientLightBlueViolet }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div id="batch-list" className="mb-6 scroll-mt-28 overflow-visible">
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
                  <Link
                    to="/view-all-batches"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-white/90 px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-white sm:text-sm"
                    style={{ borderColor: borderBvSoft, color: navy }}
                  >
                    View all
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </div>
                <p className="mt-2 max-w-none text-sm leading-relaxed sm:text-base" style={{ color: "#000" }}>
                  View the list of scholarship batches and registered beneficiary records maintained within the Scholarship Records Management System for monitoring and reference purposes.
                </p>
              </div>

              <div className="space-y-4">
                {featuredBatchesByProgram.map(({ programLabel, items }) => (
                  <FeaturedBatchScroller
                    key={programLabel}
                    programLabel={programLabel}
                    items={items}
                    scrollDirection={programLabel === "TDP" ? "right" : "left"}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="process"
          className="relative w-full scroll-mt-17 overflow-visible border-y py-10 sm:py-12 lg:py-14"
          style={{ borderColor: borderNavySoft, backgroundImage: gradientLightBlueViolet }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 w-full lg:mb-8">
              <p
                className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ borderColor: borderBvSoft, color: navy }}
              >
                How it works
              </p>
              <h2 className="relative mt-4 flex items-center gap-3 text-[clamp(1.65rem,3.5vw,2.75rem)] font-extrabold leading-[1.15] tracking-tight">
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
              <p className="mt-2 max-w-none text-sm leading-relaxed sm:text-base" style={{ color: "#000" }}>
                Learn the step-by-step scholarship application process, from submission of requirements and
                verification to approval and payout coordination. This section helps students understand the
                procedures, requirements, and important stages of their scholarship application journey.
              </p>
            </div>

            <ProcessWorkflowTimeline steps={scholarshipProcessSteps} />
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-white/10 text-white" style={{ backgroundImage: gradientNavyFooter }}>
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
            <p className="mx-auto max-w-3xl text-xs leading-snug text-white/80 sm:mx-0 sm:text-sm">
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
                    <span className="block text-xs text-white/75 sm:text-sm">scholarships@msu.edu.ph</span>
                  </span>
                </li>
                <li className="flex gap-1.5">
                  <span className="shrink-0 text-white/60" aria-hidden>
                    •
                  </span>
                  <span>
                    <span className="font-medium text-white/90">Contact Number</span>
                    <span className="block text-xs text-white/75 sm:text-sm">(042) 000-0000</span>
                  </span>
                </li>
                <li className="flex gap-1.5">
                  <span className="shrink-0 text-white/60" aria-hidden>
                    •
                  </span>
                  <span>
                    <span className="font-medium text-white/90">Office Address</span>
                    <span className="block text-xs leading-snug text-white/75 sm:text-sm">
                      Marinduque State University, Boac, Marinduque
                    </span>
                  </span>
                </li>
              </ul>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold tracking-wide text-white sm:text-sm">Admin Login</p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">
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

          <p className="pt-5 text-center text-xs text-white/70">
            © 2026 Scholarship Records Management System. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
