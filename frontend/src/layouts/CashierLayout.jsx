import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { Archive, Bell, History, Layers, LayoutDashboard, LogOut, Settings, User } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import sgfaLogo from "@/assets/srmslogo.png"
import srmsTextLogo from "@/assets/srmstextlogo.png"
import apiClient from "@/lib/apiClient"
import {
  CASHIER_SETTINGS_CHANGED_EVENT,
  isCashierRelevantNotification,
  shouldShowNotification,
} from "@/lib/cashierSettings"
import authService, { USER_UPDATED_EVENT } from "@/services/authService"

function getUserDisplayName(user) {
  if (!user) return "Cashier"
  const fullName = String(user.fullName ?? "").trim()
  if (fullName) return fullName
  const combined = `${String(user.firstName ?? "").trim()} ${String(user.lastName ?? "").trim()}`.trim()
  if (combined) return combined
  return "Cashier"
}

function getUserRoleLabel(user) {
  const role = String(user?.role ?? "cashier").toLowerCase()
  if (role === "osgfa") return "OSGFA"
  if (role === "cashier") return "Cashier"
  if (role === "superadmin") return "Super Admin"
  return "Administrator"
}

function getUserInitial(user) {
  const source = getUserDisplayName(user) || user?.email || "C"
  return source.trim().charAt(0).toUpperCase() || "C"
}

const navyDeep = "#04133d"
const navy = "#081F5C"
const navyMuted = "#0b2b73"
const navyBright = "#1447a6"
const pageBaseNavyGradient = `linear-gradient(145deg, ${navyDeep} 0%, ${navy} 35%, ${navyMuted} 65%, ${navyBright} 100%)`

const sidebarMenuButtonClass =
  "h-9 items-center justify-start gap-2 rounded-lg px-2 text-white !transition-none hover:bg-white/20 hover:text-white data-[active=true]:bg-white data-[active=true]:text-black ml-2 group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!min-w-9 group-data-[collapsible=icon]:!max-w-9 group-data-[collapsible=icon]:!shrink-0 group-data-[collapsible=icon]:!justify-start group-data-[collapsible=icon]:!px-2 [&>span:last-child]:overflow-visible [&>span:last-child]:text-clip [&>span:last-child]:whitespace-nowrap"

const DEFAULT_CASHIER_HEADER = {
  title: "Cashier",
  description: "Scholarship Records Management System.",
}

const CASHIER_PAGE_META = {
  "/cashier/dashboard": {
    title: "Dashboard",
    description: "Overview of the Scholarship Records Management System.",
  },
  "/cashier/batches": {
    title: "Batches",
    description: "Create and manage scholarship batches.",
  },
  "/cashier/batch-info": {
    title: "Batch Info",
    description: "Grantee records, claims, and requirements for this batch.",
  },
  "/cashier/archive": {
    title: "Archive",
    description: "Archived records and historical scholarship data.",
  },
  "/cashier/archive-batch": {
    title: "Archive Batch",
    description: "Archived batch details and fully claimed records.",
  },
  "/cashier/claim-history": {
    title: "Claim History",
    description: "View past scholarship claims and disbursement activity.",
  },
  "/cashier/notification": {
    title: "Notifications",
    description: "View latest alerts, reminders, and system updates.",
  },
  "/cashier/setting": {
    title: "Settings",
    description: "Manage your account preferences.",
  },
}

function CashierMobileNav() {
  const { isMobile, setOpenMobile } = useSidebar()
  if (!isMobile) return null
  return (
    <button
      type="button"
      className="-ml-1 mr-2 shrink-0 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
      onClick={() => setOpenMobile(true)}
    >
      Menu
    </button>
  )
}

export default function CashierLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const [profileOpen, setProfileOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser())

  const handleLogout = () => {
    try {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    } catch {
      // ignore
    }
    navigate("/")
  }

  const isDashboardActive = location.pathname === "/cashier/dashboard"
  const isBatchesActive =
    location.pathname === "/cashier/batches" || location.pathname === "/cashier/batch-info"
  const isArchiveActive = location.pathname === "/cashier/archive" || location.pathname === "/cashier/archive-batch"
  const isClaimHistoryActive = location.pathname === "/cashier/claim-history"
  const isNotificationActive = location.pathname === "/cashier/notification"

  useEffect(() => {
    let cancelled = false

    async function loadUnreadCount() {
      try {
        const response = await apiClient.get("/notifications")
        if (cancelled) return
        const list = Array.isArray(response.data) ? response.data : []
        const count = list.filter(
          (item) => !item.read && isCashierRelevantNotification(item) && shouldShowNotification(item),
        ).length
        setUnreadNotificationCount(count)
      } catch {
        if (!cancelled) setUnreadNotificationCount(0)
      }
    }

    loadUnreadCount()
    const refresh = () => loadUnreadCount()
    window.addEventListener(CASHIER_SETTINGS_CHANGED_EVENT, refresh)
    window.addEventListener("storage", refresh)
    const interval = setInterval(loadUnreadCount, 60000)

    return () => {
      cancelled = true
      window.removeEventListener(CASHIER_SETTINGS_CHANGED_EVENT, refresh)
      window.removeEventListener("storage", refresh)
      clearInterval(interval)
    }
  }, [location.pathname])

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      if (!authService.isAuthenticated()) {
        if (!cancelled) setCurrentUser(null)
        return
      }

      try {
        const user = await authService.fetchProfile()
        if (!cancelled && user) setCurrentUser(user)
      } catch {
        if (!cancelled) {
          const stored = authService.getCurrentUser()
          setCurrentUser(stored)
        }
      }
    }

    loadUser()
    const syncStoredUser = () => setCurrentUser(authService.getCurrentUser())
    window.addEventListener("storage", syncStoredUser)
    window.addEventListener(USER_UPDATED_EVENT, syncStoredUser)

    return () => {
      cancelled = true
      window.removeEventListener("storage", syncStoredUser)
      window.removeEventListener(USER_UPDATED_EVENT, syncStoredUser)
    }
  }, [location.pathname])

  useEffect(() => {
    setProfileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!profileOpen) return

    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [profileOpen])

  const pageMeta = useMemo(() => {
    return CASHIER_PAGE_META[location.pathname] ?? DEFAULT_CASHIER_HEADER
  }, [location.pathname])

  const displayName = useMemo(() => getUserDisplayName(currentUser), [currentUser])
  const displayEmail = useMemo(() => String(currentUser?.email ?? "").trim(), [currentUser])
  const roleLabel = useMemo(() => getUserRoleLabel(currentUser), [currentUser])
  const userInitial = useMemo(() => getUserInitial(currentUser), [currentUser])

  const showBatchInfoBreadcrumb = location.pathname === "/cashier/batch-info"
  const showArchiveBatchBreadcrumb = location.pathname === "/cashier/archive-batch"

  return (
    <div
      className="h-svh max-h-svh min-h-0 w-full overflow-hidden"
      style={{ backgroundImage: pageBaseNavyGradient }}
    >
      <TooltipProvider delayDuration={0}>
        <SidebarProvider
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          className="h-svh max-h-svh min-h-0 w-full max-w-full overflow-hidden bg-transparent"
          style={{
            "--sidebar": "transparent",
            "--sidebar-width": "17.5rem",
            "--sidebar-width-icon": "3.75rem",
          }}
        >
          <Sidebar
            collapsible="icon"
            variant="inset"
            className="border-r-0"
            onMouseEnter={() => setSidebarOpen(true)}
            onMouseLeave={() => setSidebarOpen(false)}
          >
            <SidebarHeader className="shrink-0 gap-2 border-b border-white/15 px-2 py-2">
              <div className="flex items-center gap-2">
                <div className="size-14 min-h-14 min-w-14 max-h-14 max-w-14 shrink-0 [&_img]:pointer-events-none">
                  <img
                    src={sgfaLogo}
                    alt="Scholarship Grants and Financial Assistance Office — Marinduque State University"
                    className="box-border size-full rounded-full border border-white/20 bg-white/10 object-contain p-0.5"
                    height={56}
                    width={56}
                    decoding="async"
                  />
                </div>
                <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <img
                    src={srmsTextLogo}
                    alt="SRMS"
                    className="h-8 w-auto max-w-[140px] object-contain"
                    decoding="async"
                  />
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="gap-0 px-2 py-4">
              <SidebarGroup className="p-0">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-2.5">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isDashboardActive}
                        tooltip="Dashboard"
                        className={sidebarMenuButtonClass}
                      >
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/cashier/dashboard">
                          <LayoutDashboard className="size-[22px] shrink-0 opacity-90" />
                          <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">Dashboard</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isBatchesActive}
                        tooltip="Batches"
                        className={sidebarMenuButtonClass}
                      >
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/cashier/batches">
                          <Layers className="size-[22px] shrink-0 opacity-90" />
                          <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">Batches</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isClaimHistoryActive}
                        tooltip="Claim History"
                        className={sidebarMenuButtonClass}
                      >
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/cashier/claim-history">
                          <History className="size-[22px] shrink-0 opacity-90" />
                          <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">Claim History</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isArchiveActive}
                        tooltip="Archive"
                        className={sidebarMenuButtonClass}
                      >
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/cashier/archive">
                          <Archive className="size-[22px] shrink-0 opacity-90" />
                          <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">Archive</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarSeparator className="mx-0 bg-white/20" />

            <SidebarFooter className="gap-2 px-2 py-2">
              <div className="ml-2 flex items-center gap-2 overflow-hidden rounded-xl border border-white/15 bg-white/10 px-2.5 py-2 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:p-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#081F5C]">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-[11px] font-normal uppercase tracking-wide text-white/80">{roleLabel}</p>
                  <p className="truncate text-[11px] text-white/75" title={displayEmail || undefined}>
                    {displayEmail || displayName}
                  </p>
                </div>
              </div>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-linear-to-br from-blue-50 via-violet-100 to-indigo-100 dark:from-slate-900 dark:via-violet-950/40 dark:to-indigo-950/50">
            <header className="relative z-30 flex h-14 shrink-0 flex-none items-center gap-3 border-b border-border/60 bg-white/90 px-4 shadow-sm backdrop-blur-md dark:bg-background/95 md:px-6">
              <CashierMobileNav />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
                  {showBatchInfoBreadcrumb ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-muted-foreground">Batches</span>
                      <span className="text-muted-foreground/70">&gt;</span>
                      <span>Batch Info</span>
                    </span>
                  ) : showArchiveBatchBreadcrumb ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-muted-foreground">Archive</span>
                      <span className="text-muted-foreground/70">&gt;</span>
                      <span>Archive Batch</span>
                    </span>
                  ) : (
                    pageMeta.title
                  )}
                </h1>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{pageMeta.description}</p>
              </div>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  aria-label={
                    unreadNotificationCount > 0
                      ? `Notifications (${unreadNotificationCount} unread)`
                      : "Notifications"
                  }
                  title="Notifications"
                  onClick={() => navigate("/cashier/notification")}
                  className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                    isNotificationActive
                      ? "bg-[#081F5C] text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Bell className="size-5" />
                  {unreadNotificationCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                      {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                    </span>
                  ) : null}
                </button>

                <div ref={profileMenuRef} className="relative">
                  <button
                    type="button"
                    aria-label="Profile menu"
                    aria-expanded={profileOpen}
                    title="Profile"
                    onClick={() => setProfileOpen((prev) => !prev)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-[#04133d] via-[#081F5C] to-[#1447a6] text-white shadow-sm transition-colors hover:opacity-95"
                  >
                    <User className="size-5" />
                  </button>

                  {profileOpen ? (
                    <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-border/70 bg-background/95 backdrop-blur-md shadow-lg">
                      <div className="px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{roleLabel}</p>
                        <p className="mt-0.5 truncate text-sm font-medium text-foreground">{displayName}</p>
                        {displayEmail ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{displayEmail}</p>
                        ) : null}
                      </div>
                      <div className="h-px bg-border/60" />

                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false)
                          navigate("/cashier/setting")
                        }}
                        className="group flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-[#04133d]/10 via-[#081F5C]/10 to-[#1447a6]/10 text-[#081F5C] transition-colors group-hover:text-[#081F5C]">
                          <Settings className="h-4 w-4" />
                        </span>
                        <span className="flex-1">Settings</span>
                      </button>

                      <div className="h-px bg-border/60" />

                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false)
                          setLogoutConfirmOpen(true)
                        }}
                        className="group flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-colors dark:bg-red-950/20 dark:text-red-200 group-hover:text-red-600">
                          <LogOut className="h-4 w-4" />
                        </span>
                        <span className="flex-1">Log out</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            <div
              id="cashier-main-scroll"
              className="scrollbar-hidden flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain py-4 pl-4 pr-4 md:py-6 md:pl-6 md:pr-6"
            >
              <div className="w-full min-w-0 max-w-full flex-1">
                <Outlet />
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>

      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl border border-[#081F5C]/15 bg-white/95 backdrop-blur-md shadow-sm dark:bg-slate-950/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#081F5C] dark:text-blue-100">Confirm log out</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to log out? You will need to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              variant="outline"
              onClick={() => setLogoutConfirmOpen(false)}
              className="rounded-xl border-[#081F5C]/20 text-[#081F5C] hover:bg-[#081F5C]/5 hover:text-[#081F5C] dark:text-blue-100 dark:hover:bg-blue-950/30"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="rounded-xl"
              onClick={() => {
                setLogoutConfirmOpen(false)
                handleLogout()
              }}
            >
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Log out
              </span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
