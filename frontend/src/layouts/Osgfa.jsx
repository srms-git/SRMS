import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { Archive, Bell, ChevronDown, ChevronRight, GraduationCap, Layers, LayoutDashboard, LogOut, Megaphone, Plus, Settings, User, UserPlus } from "lucide-react"

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import sgfaLogo from "@/assets/srmslogo.png"
import srmsTextLogo from "@/assets/srmstextlogo.png"
import apiClient from "@/lib/apiClient"
import { findProgramBySlug, programRoutePath } from "@/lib/osgfaPrograms"
import { OSGFA_SETTINGS_CHANGED_EVENT, shouldShowNotification } from "@/lib/osgfaSettings"
import { cn } from "@/lib/utils"
import { useOsgfaPrograms } from "@/hooks/useOsgfaPrograms"
import authService from "@/services/authService"

function getUserDisplayName(user) {
  if (!user) return "Admin"
  const fullName = String(user.fullName ?? "").trim()
  if (fullName) return fullName
  const combined = `${String(user.firstName ?? "").trim()} ${String(user.lastName ?? "").trim()}`.trim()
  if (combined) return combined
  return "Admin"
}

function getUserRoleLabel(user) {
  const role = String(user?.role ?? "osgfa").toLowerCase()
  if (role === "osgfa") return "OSGFA"
  if (role === "cashier") return "Cashier"
  if (role === "superadmin") return "Super Admin"
  return "Administrator"
}

function getUserInitial(user) {
  const source = getUserDisplayName(user) || user?.email || "A"
  return source.trim().charAt(0).toUpperCase() || "A"
}

const navyDeep = "#04133d"
const navy = "#081F5C"
const navyMuted = "#0b2b73"
const navyBright = "#1447a6"
const pageBaseNavyGradient = `linear-gradient(145deg, ${navyDeep} 0%, ${navy} 35%, ${navyMuted} 65%, ${navyBright} 100%)`

/** Identical horizontal inset open vs collapsed; no ml/pl tweaks only on icon mode (that shifts icons). */
const sidebarMenuButtonClass =
  "h-9 items-center justify-start gap-2 rounded-lg px-2 text-white !transition-none hover:bg-white/20 hover:text-white data-[active=true]:bg-white data-[active=true]:text-black ml-2 group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!min-w-9 group-data-[collapsible=icon]:!max-w-9 group-data-[collapsible=icon]:!shrink-0 group-data-[collapsible=icon]:!justify-start group-data-[collapsible=icon]:!px-2 [&>span:last-child]:overflow-visible [&>span:last-child]:text-clip [&>span:last-child]:whitespace-nowrap"

const sidebarSubMenuButtonClass =
  "min-w-max cursor-pointer overflow-visible pr-3 text-white hover:bg-white/20 hover:text-white data-[active=true]:bg-white data-[active=true]:text-black [&>svg]:text-current [&>span:last-child]:overflow-visible [&>span:last-child]:text-clip [&>span:last-child]:whitespace-nowrap"

const DEFAULT_ADMIN_HEADER = {
  title: "Admin",
  description: "Scholarship Records Management System.",
}

/** Header copy per admin route (works with BrowserRouter; avoid useMatches without createBrowserRouter). */
const ADMIN_PAGE_META = {
  "/osgfa/dashboard": {
    title: "Dashboard",
    description: "Overview of the Scholarship Records Management System.",
  },
  "/osgfa/batches": {
    title: "Batches",
    description: "Create and manage scholarship batches.",
  },
  "/osgfa/add-grantees": {
    title: "Add Grantees",
    description: "Register scholarship grantees.",
  },
  "/osgfa/announcement": {
    title: "Announcements",
    description: "Create and manage official announcement posts for students and campus updates.",
  },
  "/osgfa/archive": {
    title: "Archive",
    description: "Archived records and historical scholarship data.",
  },
  "/osgfa/archive-batch": {
    title: "Archive Batch",
    description: "Archived batch details and fully claimed records.",
  },
  "/osgfa/batch-info": {
    title: "Batch Info",
    description: "Batch summary and grantee list.",
  },
  "/osgfa/setting": {
    title: "Settings",
    description: "Manage your account preferences.",
  },
  "/osgfa/notification": {
    title: "Notifications",
    description: "View latest admin alerts, reminders, and system updates.",
  },
}

function AdminMobileNav() {
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

export default function Osgfa() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const [profileOpen, setProfileOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const handleLogout = () => {
    try {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    } catch {
      // ignore
    }
    navigate("/")
  }

  const isDashboardActive = location.pathname === "/osgfa/dashboard"
  const isBatchesActive = location.pathname === "/osgfa/batches" || location.pathname === "/osgfa/add-batch-grantee"
  const isAddGranteesActive = location.pathname === "/osgfa/add-grantees" || location.pathname === "/osgfa/add-scholar"
  const isAnnouncementActive = location.pathname === "/osgfa/announcement"
  const isArchiveActive = location.pathname === "/osgfa/archive"
  const isNotificationActive = location.pathname === "/osgfa/notification"
  const activeProgramSlug = useMemo(() => {
    const match = location.pathname.match(/^\/osgfa\/programs\/([^/]+)$/)
    return match ? match[1] : ""
  }, [location.pathname])
  const isProgramsGroupActive = Boolean(activeProgramSlug)

  const { programs, addProgram, canAddMore, maxPrograms } = useOsgfaPrograms()
  const [programsOpen, setProgramsOpen] = useState(isProgramsGroupActive)
  const [addProgramOpen, setAddProgramOpen] = useState(false)
  const [newProgramCode, setNewProgramCode] = useState("")
  const [newProgramName, setNewProgramName] = useState("")
  const [newProgramDescription, setNewProgramDescription] = useState("")
  const [addProgramError, setAddProgramError] = useState("")
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)

  useEffect(() => {
    if (isProgramsGroupActive) setProgramsOpen(true)
  }, [isProgramsGroupActive])

  useEffect(() => {
    let cancelled = false

    async function loadUnreadCount() {
      try {
        const response = await apiClient.get("/notifications")
        if (cancelled) return
        const list = Array.isArray(response.data) ? response.data : []
        const count = list.filter((item) => !item.read && shouldShowNotification(item)).length
        setUnreadNotificationCount(count)
      } catch {
        if (!cancelled) setUnreadNotificationCount(0)
      }
    }

    loadUnreadCount()
    const refresh = () => loadUnreadCount()
    window.addEventListener(OSGFA_SETTINGS_CHANGED_EVENT, refresh)
    window.addEventListener("storage", refresh)
    const interval = setInterval(loadUnreadCount, 60000)

    return () => {
      cancelled = true
      window.removeEventListener(OSGFA_SETTINGS_CHANGED_EVENT, refresh)
      window.removeEventListener("storage", refresh)
      clearInterval(interval)
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
    if (activeProgramSlug) {
      const program = findProgramBySlug(activeProgramSlug)
      if (program) {
        return { title: program.name, description: program.description }
      }
    }
    return ADMIN_PAGE_META[location.pathname] ?? DEFAULT_ADMIN_HEADER
  }, [location.pathname, activeProgramSlug])

  const currentUser = useMemo(() => authService.getCurrentUser(), [location.pathname])
  const displayName = useMemo(() => getUserDisplayName(currentUser), [currentUser])
  const displayEmail = useMemo(() => String(currentUser?.email ?? "").trim(), [currentUser])
  const roleLabel = useMemo(() => getUserRoleLabel(currentUser), [currentUser])
  const userInitial = useMemo(() => getUserInitial(currentUser), [currentUser])

  const batchInfoSource = useMemo(() => {
    if (location.pathname !== "/osgfa/batch-info") return ""
    return String(new URLSearchParams(location.search).get("from") ?? "").trim().toLowerCase()
  }, [location.pathname, location.search])

  const showAddBatchBreadcrumb = location.pathname === "/osgfa/batch-info" && batchInfoSource !== "add-grantees"
  const showAddGranteesBreadcrumb = location.pathname === "/osgfa/batch-info" && batchInfoSource === "add-grantees"
  const showArchiveBatchBreadcrumb = location.pathname === "/osgfa/archive-batch"

  const resetAddProgramForm = () => {
    setNewProgramCode("")
    setNewProgramName("")
    setNewProgramDescription("")
    setAddProgramError("")
  }

  const handleAddProgramOpenChange = (open) => {
    setAddProgramOpen(open)
    if (!open) resetAddProgramForm()
  }

  const handleAddProgramSubmit = (event) => {
    event.preventDefault()
    setAddProgramError("")
    const result = addProgram({
      code: newProgramCode,
      name: newProgramName,
      fullName: newProgramName,
      description: newProgramDescription,
    })
    if (!result.ok) {
      setAddProgramError(result.error)
      return
    }
    handleAddProgramOpenChange(false)
    setProgramsOpen(true)
    navigate(programRoutePath(result.program))
  }

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
            /** Collapsed rail: ~logo (3.5rem) + tiny slack; wider values leave empty strip beside the seal */
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
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/osgfa/dashboard">
                          <LayoutDashboard className="size-[22px] shrink-0 opacity-90" />
                          <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">Dashboard</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isAddGranteesActive}
                        tooltip="Add Grantees"
                        className={sidebarMenuButtonClass}
                      >
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/osgfa/add-grantees">
                          <UserPlus className="size-[22px] shrink-0 opacity-90" />
                          <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">Add Grantees</span>
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
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/osgfa/batches">
                          <Layers className="size-[22px] shrink-0 opacity-90" />
                          <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">Batches</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={isProgramsGroupActive}
                        tooltip="Programs"
                        onClick={() => setProgramsOpen((open) => !open)}
                        className={`${sidebarMenuButtonClass} group-data-[collapsible=icon]:[&>svg:last-child]:hidden`}
                      >
                        <GraduationCap className="size-[22px] shrink-0 opacity-90" />
                        <span className="flex-1 whitespace-nowrap text-left group-data-[collapsible=icon]:hidden">Programs</span>
                        {programsOpen ? (
                          <ChevronDown className="size-4 shrink-0 opacity-90" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 opacity-90" aria-hidden />
                        )}
                      </SidebarMenuButton>
                      {programsOpen ? (
                        <SidebarMenuSub className="mx-2 ml-10 gap-2 overflow-visible border-white/25 px-1 py-0.5">
                          {programs.map((program) => (
                            <SidebarMenuSubItem key={program.id}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={activeProgramSlug === program.slug}
                                className={sidebarSubMenuButtonClass}
                              >
                                <NavLink to={programRoutePath(program)}>
                                  <span>{program.name}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton
                              asChild
                              className={cn(
                                sidebarSubMenuButtonClass,
                                "border border-dashed border-white/30 text-white/90 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50",
                              )}
                            >
                              <button
                                type="button"
                                disabled={!canAddMore}
                                onClick={() => handleAddProgramOpenChange(true)}
                                title={
                                  canAddMore
                                    ? "Add a scholarship program"
                                    : `Maximum of ${maxPrograms} programs reached`
                                }
                              >
                                <Plus className="size-3.5 shrink-0 opacity-90" aria-hidden />
                                <span>Add program</span>
                              </button>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          {!canAddMore ? (
                            <li className="px-2 pb-1 text-[10px] leading-snug text-white/60 group-data-[collapsible=icon]:hidden">
                              {programs.length} of {maxPrograms} programs (limit for stress testing)
                            </li>
                          ) : null}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isAnnouncementActive}
                        tooltip="Announcement"
                        className={sidebarMenuButtonClass}
                      >
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/osgfa/announcement">
                          <Megaphone className="size-[22px] shrink-0 opacity-90" />
                          <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">Announcement</span>
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
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/osgfa/archive">
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
              <AdminMobileNav />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
                  {showAddGranteesBreadcrumb ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-muted-foreground">Add Grantees</span>
                      <span className="text-muted-foreground/70">&gt;</span>
                      <span>Batch Info</span>
                    </span>
                  ) : showAddBatchBreadcrumb ? (
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
                  onClick={() => navigate("/osgfa/notification")}
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
                          navigate("/osgfa/setting")
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
              id="admin-main-scroll"
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

      <Dialog open={addProgramOpen} onOpenChange={handleAddProgramOpenChange}>
        <DialogContent className="max-w-md rounded-2xl border border-[#081F5C]/15 bg-white/95 backdrop-blur-md shadow-sm dark:bg-slate-950/50">
          <DialogHeader>
            <DialogTitle className="text-[#081F5C] dark:text-blue-100">Add program</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Register a scholarship program for the sidebar workspace. You can add up to {maxPrograms} programs while load testing is in progress.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAddProgramSubmit}>
            <div className="space-y-2">
              <label htmlFor="program-code" className="text-sm font-medium text-foreground">
                Program code
              </label>
              <Input
                id="program-code"
                value={newProgramCode}
                onChange={(event) => setNewProgramCode(event.target.value.toUpperCase())}
                placeholder="e.g. TES, TDP"
                maxLength={12}
                required
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">2–12 letters or numbers. Used in batch imports and grantee records.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="program-name" className="text-sm font-medium text-foreground">
                Display name
              </label>
              <Input
                id="program-name"
                value={newProgramName}
                onChange={(event) => setNewProgramName(event.target.value)}
                placeholder="e.g. Tertiary Education Subsidy"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="program-description" className="text-sm font-medium text-foreground">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="program-description"
                value={newProgramDescription}
                onChange={(event) => setNewProgramDescription(event.target.value)}
                placeholder="Short summary shown in the page header"
              />
            </div>
            {addProgramError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                {addProgramError}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => handleAddProgramOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canAddMore}>
                Add program
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
