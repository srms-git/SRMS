import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"

import landingLogo from "@/assets/landingpageLogo.png"
import { cn } from "@/lib/utils"

export const LANDING_PUBLIC_NAV_ITEMS = [
  { label: "Home", target: "hero" },
  { label: "About", target: "about" },
  { label: "Announcements", target: "announcements" },
  { label: "Batch List", target: "batch-list" },
  { label: "Process", target: "process" },
]

const INDICATOR_TRANSITION = "left 420ms cubic-bezier(0.22, 1, 0.36, 1), width 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease, background-color 300ms ease, box-shadow 300ms ease"

/**
 * Shared public top bar for the landing page, login, and other marketing routes.
 * Pass `onSectionNavigate` on the landing page for in-page smooth scroll; omit on other pages to link to `/#section`.
 * Use `variant="cover"` on the landing page for a transparent bar over the hero that becomes solid glass on scroll.
 */
export function LandingPublicHeader({ onSectionNavigate, variant = "default" }) {
  const isCover = variant === "cover"
  const isInPage = typeof onSectionNavigate === "function"
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState("hero")
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  const navRef = useRef(null)
  const itemRefs = useRef({})
  const navLockTargetRef = useRef(null)
  const sectionVisibilityRef = useRef(new Map())

  const isSolid = !isCover || scrolled
  const showSolidNav = isInPage || isSolid

  const updateIndicator = useCallback((targetId) => {
    const navEl = navRef.current
    const itemEl = itemRefs.current[targetId]
    if (!navEl || !itemEl) return

    const navRect = navEl.getBoundingClientRect()
    const itemRect = itemEl.getBoundingClientRect()

    setIndicator({
      left: itemRect.left - navRect.left,
      width: itemRect.width,
      ready: true,
    })
  }, [])

  useEffect(() => {
    if (!isCover) return undefined

    const onScroll = () => {
      setScrolled(window.scrollY > 64)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [isCover])

  useEffect(() => {
    if (!isInPage) return undefined

    const sectionElements = LANDING_PUBLIC_NAV_ITEMS.map((item) => document.getElementById(item.target)).filter(
      Boolean,
    )

    if (sectionElements.length === 0) return undefined

    sectionVisibilityRef.current = new Map(sectionElements.map((element) => [element.id, 0]))

    const pickActiveFromVisibility = () => {
      const lock = navLockTargetRef.current
      if (lock) {
        const lockedRatio = sectionVisibilityRef.current.get(lock) ?? 0
        if (lockedRatio >= 0.28) {
          navLockTargetRef.current = null
        } else {
          return
        }
      }

      let bestId = null
      let bestRatio = 0
      sectionVisibilityRef.current.forEach((ratio, id) => {
        if (ratio > bestRatio) {
          bestRatio = ratio
          bestId = id
        }
      })

      if (bestId && bestRatio > 0) {
        setActiveSection(bestId)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          sectionVisibilityRef.current.set(
            entry.target.id,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          )
        })
        pickActiveFromVisibility()
      },
      { rootMargin: "-42% 0px -48% 0px", threshold: [0, 0.1, 0.25, 0.4, 0.55, 0.7] },
    )

    sectionElements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [isInPage])

  useEffect(() => {
    if (!isInPage) return undefined

    let unlockTimerId = 0

    const onScroll = () => {
      const lock = navLockTargetRef.current
      if (!lock) return

      window.clearTimeout(unlockTimerId)
      unlockTimerId = window.setTimeout(() => {
        const lockedRatio = sectionVisibilityRef.current.get(lock) ?? 0
        if (lockedRatio >= 0.15) {
          navLockTargetRef.current = null
        }
      }, 120)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.clearTimeout(unlockTimerId)
    }
  }, [isInPage])

  useLayoutEffect(() => {
    if (!isInPage) return
    updateIndicator(activeSection)
  }, [activeSection, isSolid, isInPage, updateIndicator])

  useEffect(() => {
    if (!isInPage) return undefined

    const handleResize = () => updateIndicator(activeSection)
    window.addEventListener("resize", handleResize)

    const navEl = navRef.current
    let resizeObserver
    if (navEl && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateIndicator(activeSection))
      resizeObserver.observe(navEl)
    }

    return () => {
      window.removeEventListener("resize", handleResize)
      resizeObserver?.disconnect()
    }
  }, [activeSection, isInPage, updateIndicator])

  const handleNavClick = (target) => {
    navLockTargetRef.current = target
    setActiveSection(target)
    onSectionNavigate(target)
    requestAnimationFrame(() => updateIndicator(target))

    window.setTimeout(() => {
      if (navLockTargetRef.current === target) {
        navLockTargetRef.current = null
      }
    }, 1400)
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 pt-3 sm:pt-4">
      <div className="pointer-events-auto mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-8">
        <div className="justify-self-start">
          {isInPage ? (
            <button
              type="button"
              className="flex shrink-0 items-center rounded-lg transition hover:opacity-90"
              aria-label="SRMS — scroll to top"
              onClick={() => handleNavClick("hero")}
            >
              <img
                src={landingLogo}
                alt="Scholarship Records Management System"
                className="h-7 w-auto max-h-9 max-w-[min(72vw,260px)] object-contain object-left sm:h-9"
                decoding="async"
              />
            </button>
          ) : (
            <Link to="/" className="flex shrink-0 items-center rounded-lg transition hover:opacity-90" aria-label="SRMS home">
              <img
                src={landingLogo}
                alt="Scholarship Records Management System"
                className="h-7 w-auto max-h-9 max-w-[min(72vw,260px)] object-contain object-left sm:h-9"
                decoding="async"
              />
            </Link>
          )}
        </div>

        <nav
          ref={navRef}
          className={cn(
            "relative hidden items-center justify-self-center gap-3.5 rounded-full px-2.5 py-1.5 lg:flex xl:gap-4.5",
            showSolidNav
              ? "border border-slate-200/55 bg-white/72 shadow-[0_10px_40px_rgba(8,31,92,0.08)] backdrop-blur-2xl ring-1 ring-white/50"
              : "border border-white/20 bg-white/8 shadow-[0_10px_40px_rgba(4,19,61,0.16)] backdrop-blur-2xl ring-1 ring-white/10",
          )}
          aria-label="Landing page sections"
        >
          {isInPage ? (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1 bottom-1 rounded-full",
                indicator.ready ? "opacity-100" : "opacity-0",
                showSolidNav
                  ? "bg-gradient-to-br from-[#081F5C] via-[#0b2b73] to-[#1447a6] shadow-[0_4px_14px_rgba(8,31,92,0.35)]"
                  : "bg-white/28 shadow-[0_4px_16px_rgba(0,0,0,0.12)] ring-1 ring-white/35",
              )}
              style={{
                left: indicator.left,
                width: indicator.width,
                transition: INDICATOR_TRANSITION,
              }}
            />
          ) : null}

          {LANDING_PUBLIC_NAV_ITEMS.map((item) => {
            const isActive = isInPage && activeSection === item.target

            const itemClassName = cn(
              "relative z-10 rounded-full px-4 py-1.5 text-[0.8125rem] font-medium tracking-wide transition-all duration-300 ease-out xl:px-5",
              showSolidNav
                ? isActive
                  ? "font-semibold text-white"
                  : "text-black/75 hover:text-[#081F5C] hover:shadow-[0_0_12px_rgba(8,31,92,0.45),0_0_22px_rgba(8,31,92,0.22)] hover:[text-shadow:0_0_8px_rgba(8,31,92,0.5)]"
                : isActive
                  ? "font-semibold text-white"
                  : "text-white/88 hover:text-white hover:shadow-[0_0_14px_rgba(8,31,92,0.55),0_0_26px_rgba(8,31,92,0.28)] hover:[text-shadow:0_0_10px_rgba(8,31,92,0.65),0_0_18px_rgba(8,31,92,0.35)]",
            )

            return isInPage ? (
              <button
                key={item.label}
                ref={(node) => {
                  if (node) itemRefs.current[item.target] = node
                }}
                type="button"
                className={itemClassName}
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleNavClick(item.target)}
              >
                {item.label}
              </button>
            ) : (
              <Link key={item.label} to={`/#${item.target}`} className={itemClassName}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="justify-self-end" aria-hidden="true" />
      </div>
    </header>
  )
}
