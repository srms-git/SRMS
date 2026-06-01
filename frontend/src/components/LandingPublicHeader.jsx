import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  ChevronRight,
  ClipboardList,
  Home,
  Info,
  ListChecks,
  Megaphone,
  X,
} from "lucide-react"

import landingLogo from "@/assets/landingpageLogo.png"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export const LANDING_PUBLIC_NAV_ITEMS = [
  { label: "Home", target: "hero", icon: Home },
  { label: "About", target: "about", icon: Info },
  { label: "Announcements", target: "announcements", icon: Megaphone },
  { label: "Batch List", target: "batch-list", icon: ListChecks },
  { label: "Process", target: "process", icon: ClipboardList },
]

const MOBILE_MENU_ACTIVE_GRADIENT =
  "linear-gradient(135deg, #04133d 0%, #081F5C 38%, #0b2b73 68%, #1447a6 100%)"

const INDICATOR_TRANSITION = "left 420ms cubic-bezier(0.22, 1, 0.36, 1), width 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease, background-color 300ms ease, box-shadow 300ms ease"

function MobileMenuToggle({ open, onClick }) {
  return (
    <button
      type="button"
      className="pointer-events-auto absolute right-4 top-3 z-10 inline-flex size-10 items-center justify-center rounded-xl text-black transition hover:bg-black/5 active:scale-95 sm:right-6 sm:top-4 lg:hidden"
      aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="relative block h-4 w-5" aria-hidden>
        <span
          className={cn(
            "absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            open ? "top-[7px] rotate-45" : "top-0",
          )}
        />
        <span
          className={cn(
            "absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100",
          )}
        />
        <span
          className={cn(
            "absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            open ? "top-[7px] -rotate-45" : "top-[14px]",
          )}
        />
      </span>
    </button>
  )
}

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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

  const handleMobileNavClick = (target) => {
    setMobileNavOpen(false)
    if (isInPage) {
      handleNavClick(target)
    }
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 pt-3 sm:pt-4">
      <MobileMenuToggle open={mobileNavOpen} onClick={() => setMobileNavOpen((prev) => !prev)} />

      <div className="pointer-events-auto mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center lg:grid-cols-[1fr_auto_1fr]">
          <div className="justify-self-start pr-12 lg:pr-0">
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

          <div className="hidden lg:block" aria-hidden />
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          overlayClassName="bg-[#04133d]/45 backdrop-blur-none supports-backdrop-filter:backdrop-blur-none"
          className="flex h-full w-[min(100vw-1.25rem,21.5rem)] flex-col gap-0 overflow-hidden rounded-l-xl border-0 p-0 shadow-[0_24px_80px_rgba(4,19,61,0.28)]"
          style={{
            backgroundImage:
              "linear-gradient(165deg, #ffffff 0%, #eef2ff 42%, #e0e7ff 72%, #e9e5ff 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-80"
            style={{
              background:
                "radial-gradient(ellipse 90% 80% at 100% 0%, rgba(20,71,166,0.18) 0%, transparent 70%)",
            }}
            aria-hidden
          />

          <SheetHeader className="relative border-b border-[#081F5C]/10 px-5 pb-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <img
                src={landingLogo}
                alt="Scholarship Records Management System"
                className="h-8 w-auto max-w-[140px] object-contain object-left"
                decoding="async"
              />
              <SheetClose asChild>
                <button
                  type="button"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#081F5C]/12 bg-white/80 text-[#081F5C] transition hover:bg-white hover:shadow-sm active:scale-95"
                  aria-label="Close navigation menu"
                >
                  <X className="size-4" strokeWidth={2.25} aria-hidden />
                </button>
              </SheetClose>
            </div>
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          </SheetHeader>

          <nav className="relative flex flex-col gap-2 px-4 py-5" aria-label="Mobile landing page sections">
            {LANDING_PUBLIC_NAV_ITEMS.map((item, index) => {
              const isActive = isInPage && activeSection === item.target
              const Icon = item.icon
              const mobileItemClassName = cn(
                "group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition-all duration-300 ease-out",
                isActive
                  ? "border-transparent text-white shadow-[0_12px_28px_rgba(8,31,92,0.28)]"
                  : "border-[#081F5C]/10 bg-white/70 text-[#081F5C] shadow-sm hover:-translate-y-0.5 hover:border-[#081F5C]/18 hover:bg-white hover:shadow-[0_10px_24px_rgba(8,31,92,0.12)]",
              )

              const content = (
                <>
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                      isActive
                        ? "bg-white/18 text-white ring-1 ring-white/25"
                        : "bg-[#081F5C]/8 text-[#081F5C] group-hover:bg-[#081F5C]/12",
                    )}
                  >
                    <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] opacity-60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={cn("block text-sm font-semibold", isActive ? "text-white" : "text-[#081F5C]")}>
                      {item.label}
                    </span>
                  </span>
                  <ChevronRight
                    className={cn(
                      "size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5",
                      isActive ? "text-white/90" : "text-[#081F5C]/45",
                    )}
                    aria-hidden
                  />
                </>
              )

              return isInPage ? (
                <button
                  key={item.label}
                  type="button"
                  className={mobileItemClassName}
                  style={isActive ? { backgroundImage: MOBILE_MENU_ACTIVE_GRADIENT } : undefined}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handleMobileNavClick(item.target)}
                >
                  {content}
                </button>
              ) : (
                <Link
                  key={item.label}
                  to={`/#${item.target}`}
                  className={mobileItemClassName}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {content}
                </Link>
              )
            })}
          </nav>

          <div className="relative mt-auto border-t border-[#081F5C]/10 px-5 py-4">
            <p className="text-center text-[11px] font-medium tracking-wide text-[#081F5C]/50">
              Scholarship Records Management System
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
