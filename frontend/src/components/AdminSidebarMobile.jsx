import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { X } from "lucide-react"

import { SheetClose } from "@/components/ui/sheet"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

/** Animated burger / close control for admin layouts (OSGFA & Cashier). */
export function AdminSidebarMobileToggle() {
  const { isMobile, openMobile, toggleSidebar } = useSidebar()
  if (!isMobile) return null

  return (
    <button
      type="button"
      aria-label={openMobile ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={openMobile}
      className="mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[#081F5C] transition-colors hover:bg-[#081F5C]/8 active:scale-95 md:hidden"
      onClick={toggleSidebar}
    >
      <span className="relative block h-4 w-5" aria-hidden>
        <span
          className={cn(
            "absolute left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            openMobile ? "top-[7px] rotate-45" : "top-0",
          )}
        />
        <span
          className={cn(
            "absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            openMobile ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100",
          )}
        />
        <span
          className={cn(
            "absolute left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            openMobile ? "top-[7px] -rotate-45" : "top-[14px]",
          )}
        />
      </span>
    </button>
  )
}

/** Close button rendered inside the mobile drawer header. */
export function AdminSidebarMobileClose() {
  const { isMobile } = useSidebar()
  if (!isMobile) return null

  return (
    <SheetClose asChild>
      <button
        type="button"
        className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15 active:scale-95"
        aria-label="Close navigation menu"
      >
        <X className="size-5" strokeWidth={2.25} aria-hidden />
      </button>
    </SheetClose>
  )
}

/** Auto-close the mobile drawer after route changes. */
export function CloseAdminSidebarOnNavigate() {
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [location.pathname, isMobile, setOpenMobile])

  return null
}
