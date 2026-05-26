import { Link } from "react-router-dom"

import landingLogo from "@/assets/landingpageLogo.png"

const navy = "#081F5C"
const borderNavySoft = "rgba(8, 31, 92, 0.12)"

export const LANDING_PUBLIC_NAV_ITEMS = [
  { label: "Home", target: "hero" },
  { label: "About", target: "about" },
  { label: "Announcements", target: "announcements" },
  { label: "Batch List", target: "batch-list" },
  { label: "Process", target: "process" },
]

const navLinkClassName =
  "rounded-full px-4 py-2 text-sm font-medium transition hover:bg-slate-100/80"

/**
 * Shared public top bar for the landing page, login, and other marketing routes.
 * Pass `onSectionNavigate` on the landing page for in-page smooth scroll; omit on other pages to link to `/#section`.
 */
export function LandingPublicHeader({ onSectionNavigate }) {
  const isInPage = typeof onSectionNavigate === "function"

  return (
    <header
      className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur-md"
      style={{ borderColor: borderNavySoft }}
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-3 sm:px-6 lg:px-8">
        <div className="justify-self-start">
          {isInPage ? (
            <button
              type="button"
              className="flex shrink-0 items-center"
              aria-label="SRMS — scroll to top"
              onClick={() => {
                onSectionNavigate("hero")
              }}
            >
              <img
                src={landingLogo}
                alt="Scholarship Records Management System"
                className="h-7 w-auto max-h-9 max-w-[min(72vw,260px)] object-contain object-left sm:h-10"
                decoding="async"
              />
            </button>
          ) : (
            <Link to="/" className="flex shrink-0 items-center" aria-label="SRMS home">
              <img
                src={landingLogo}
                alt="Scholarship Records Management System"
                className="h-7 w-auto max-h-9 max-w-[min(72vw,260px)] object-contain object-left sm:h-10"
                decoding="async"
              />
            </Link>
          )}
        </div>

        <nav className="hidden items-center justify-self-center gap-1 lg:flex">
          {LANDING_PUBLIC_NAV_ITEMS.map((item) =>
            isInPage ? (
              <button
                key={item.label}
                type="button"
                className={navLinkClassName}
                style={{ color: navy }}
                onClick={() => {
                  onSectionNavigate(item.target)
                }}
              >
                {item.label}
              </button>
            ) : (
              <Link
                key={item.label}
                to={`/#${item.target}`}
                className={navLinkClassName}
                style={{ color: navy }}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="justify-self-end" aria-hidden="true" />
      </div>
    </header>
  )
}
