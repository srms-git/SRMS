import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Bell,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  GripVertical,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Settings,
  Trash2,
  User,
  UserPlus,
} from "lucide-react"

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
} from "@/components/ui/sidebar"
import {
  AdminSidebarMobileClose,
  AdminSidebarMobileToggle,
  CloseAdminSidebarOnNavigate,
} from "@/components/AdminSidebarMobile"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FeedbackModal } from "@/components/FeedbackModal"
import { Input } from "@/components/ui/input"
import sgfaLogo from "@/assets/srmslogo.png"
import srmsTextLogo from "@/assets/srmstextlogo.png"
import apiClient from "@/lib/apiClient"
import {
  findProgramBySlug,
  normalizeRequirementDraftRows,
  programRoutePath,
  slugFromCode,
  validateProgramRequirements,
} from "@/lib/osgfaPrograms"
import { unpublishLandingBatchesForProgram } from "@/lib/landingFeaturedBatches"
import { programErrorMessage } from "@/lib/programFeedbackMessages"
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

const programDialogShellClass =
  "relative max-w-none overflow-hidden border-[#081F5C]/14 bg-white p-0 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] duration-300 ease-out data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none"
const programRequirementRowClass =
  "grid gap-3 rounded-2xl border border-slate-200/85 bg-white p-3 shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 ease-out sm:grid-cols-[auto_1fr_auto] sm:items-center dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/5"
const programRequirementRowMovedClass =
  "border-[#081F5C]/35 bg-[#081F5C]/5 ring-[#081F5C]/15 dark:border-blue-500/35 dark:bg-blue-950/40"
const programDialogAccentClass =
  "pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6]"
const programDialogBodyClass = "space-y-6 px-8 pb-8 pt-8"
const programFieldLabelClass = "text-xs font-semibold text-slate-700 dark:text-slate-200"
const programFieldInputClass =
  "h-11 rounded-xl border-slate-200 bg-white text-sm shadow-sm focus-visible:ring-[#081F5C]/25 dark:border-white/15 dark:bg-slate-950/50"
const programSectionClass =
  "space-y-4 rounded-2xl border border-slate-200/85 bg-linear-to-br from-slate-50/90 via-white to-violet-50/30 p-5 shadow-sm ring-1 ring-slate-900/3 dark:border-white/10 dark:from-slate-900/55 dark:via-slate-950/40 dark:to-indigo-950/25 dark:ring-white/5"
const programSectionTitleClass =
  "flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#081F5C] dark:text-blue-200"
const programDialogFooterClass =
  "flex flex-col-reverse gap-2 border-t border-slate-200/80 pt-5 sm:flex-row sm:justify-end dark:border-white/10"
const programDialogCancelClass =
  "rounded-xl border-[#081F5C]/20 text-[#081F5C] hover:bg-[#081F5C]/5 hover:text-[#081F5C] dark:text-blue-100 dark:hover:bg-blue-950/30"
const programDialogSaveClass = "rounded-xl bg-[#081F5C] text-white hover:bg-[#0b2b73] dark:bg-[#1447a6] dark:hover:bg-[#1a5fd4]"

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
    title: "Bulletin",
    description: "Create and manage official bulletin posts for students and campus updates.",
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

  const {
    programs,
    addProgram,
    setProgramActive,
    renameProgram,
    updateProgramRequirements,
    canAddMore,
    maxPrograms,
    loading: programsLoading,
  } = useOsgfaPrograms()
  const [programsOpen, setProgramsOpen] = useState(isProgramsGroupActive)
  const [addProgramWarningOpen, setAddProgramWarningOpen] = useState(false)
  const [addProgramWarningAcknowledged, setAddProgramWarningAcknowledged] = useState(false)
  const [addProgramOpen, setAddProgramOpen] = useState(false)
  const [newProgramCode, setNewProgramCode] = useState("")
  const [newProgramFullName, setNewProgramFullName] = useState("")
  const [newProgramDescription, setNewProgramDescription] = useState("")
  const [addProgramSaving, setAddProgramSaving] = useState(false)
  const [programActionId, setProgramActionId] = useState("")
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackVariant, setFeedbackVariant] = useState("info")
  const [feedbackTitle, setFeedbackTitle] = useState("")
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [renameProgramOpen, setRenameProgramOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameProgramName, setRenameProgramName] = useState("")
  const [renameProgramFullName, setRenameProgramFullName] = useState("")
  const [renameProgramDescription, setRenameProgramDescription] = useState("")
  const [renameProgramSaving, setRenameProgramSaving] = useState(false)
  const [requirementsProgramOpen, setRequirementsProgramOpen] = useState(false)
  const [requirementsTarget, setRequirementsTarget] = useState(null)
  const [requirementsDraft, setRequirementsDraft] = useState([])
  const [requirementsSaving, setRequirementsSaving] = useState(false)
  const [movedRequirementKey, setMovedRequirementKey] = useState("")
  const [programMenuOpenId, setProgramMenuOpenId] = useState("")
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)

  /** Keep hover-expanded sidebar open while program menus/dialogs are in use (dropdown portals sit outside the sidebar DOM). */
  const sidebarPinned = useMemo(
    () =>
      Boolean(programMenuOpenId)
      || renameProgramOpen
      || requirementsProgramOpen
      || addProgramWarningOpen
      || addProgramOpen
      || deactivateConfirmOpen
      || Boolean(programActionId),
    [programMenuOpenId, renameProgramOpen, requirementsProgramOpen, addProgramWarningOpen, addProgramOpen, deactivateConfirmOpen, programActionId],
  )

  const showFeedback = useCallback((variant, title, message) => {
    setFeedbackVariant(variant)
    setFeedbackTitle(title)
    setFeedbackMessage(message)
    setFeedbackOpen(true)
  }, [])

  useEffect(() => {
    if (isProgramsGroupActive) setProgramsOpen(true)
  }, [isProgramsGroupActive])

  useEffect(() => {
    if (programMenuOpenId) setProgramsOpen(true)
  }, [programMenuOpenId])

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
        return { title: program.fullName || program.name, description: program.description }
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
    setNewProgramFullName("")
    setNewProgramDescription("")
  }

  const openAddProgramWarning = () => {
    setSidebarOpen(true)
    setProgramsOpen(true)
    setAddProgramWarningOpen(true)
  }

  const handleAddProgramWarningOpenChange = (open) => {
    setAddProgramWarningOpen(open)
    if (!open) setAddProgramWarningAcknowledged(false)
  }

  const proceedToAddProgram = () => {
    setAddProgramWarningOpen(false)
    handleAddProgramOpenChange(true)
  }

  const handleAddProgramOpenChange = (open) => {
    setAddProgramOpen(open)
    if (open) {
      setSidebarOpen(true)
      setProgramsOpen(true)
    }
    if (!open) resetAddProgramForm()
  }

  const handleAddProgramSubmit = async (event) => {
    event.preventDefault()
    setAddProgramSaving(true)
    const result = await addProgram({
      code: newProgramCode,
      name: newProgramCode,
      fullName: newProgramFullName,
      description: newProgramDescription,
    })
    setAddProgramSaving(false)
    if (!result.ok) {
      showFeedback("warning", "Could not add program", programErrorMessage(result.error))
      return
    }
    const label = result.program.fullName || result.program.name
    handleAddProgramOpenChange(false)
    setProgramsOpen(true)
    navigate(programRoutePath(result.program))
    showFeedback(
      "success",
      "Program added",
      `${label} is now in your Programs list. Open it from the sidebar when you are ready.`,
    )
  }

  const openDeactivateProgramConfirm = (program) => {
    setSidebarOpen(true)
    setProgramsOpen(true)
    setDeactivateTarget(program)
    setDeactivateConfirmOpen(true)
  }

  const handleDeactivateConfirmOpenChange = (open) => {
    setDeactivateConfirmOpen(open)
    if (!open) setDeactivateTarget(null)
  }

  const applyProgramActiveChange = async (program, nextActive) => {
    const label = program.fullName || program.name
    setProgramActionId(program.id)
    const result = await setProgramActive(program.id, nextActive)
    setProgramActionId("")
    if (!result.ok) {
      showFeedback(
        "warning",
        nextActive ? "Could not turn program on" : "Could not turn program off",
        programErrorMessage(result.error),
      )
      return
    }
    if (!nextActive && activeProgramSlug === program.slug) {
      navigate("/osgfa/dashboard")
    }

    let unpublishedLandingCount = 0
    if (!nextActive) {
      try {
        unpublishedLandingCount = await unpublishLandingBatchesForProgram(program.code)
      } catch (error) {
        console.error("Failed to unpublish landing batches for disabled program:", error)
      }
    }

    showFeedback(
      "success",
      nextActive ? "Program is on" : "Program is off",
      nextActive
        ? `${label} shows in the sidebar and Batches again. Re-publish any batches you want on the landing page.`
        : unpublishedLandingCount > 0
          ? `${label} is hidden from Batches and the landing page. ${unpublishedLandingCount} published batch${unpublishedLandingCount === 1 ? "" : "es"} for this program ${unpublishedLandingCount === 1 ? "was" : "were"} turned off. Archived records are unchanged.`
          : `${label} is hidden from Batches and the landing page. Archived records are unchanged—you can turn it back on anytime.`,
    )
  }

  const handleActivateProgram = (program) => {
    applyProgramActiveChange(program, true)
  }

  const handleConfirmDeactivateProgram = async () => {
    if (!deactivateTarget || programActionId === deactivateTarget.id) return
    await applyProgramActiveChange(deactivateTarget, false)
    handleDeactivateConfirmOpenChange(false)
  }

  const openRenameProgramDialog = (program) => {
    setSidebarOpen(true)
    setProgramsOpen(true)
    setRenameTarget(program)
    setRenameProgramName(program.code)
    setRenameProgramFullName(program.fullName ?? program.name)
    setRenameProgramDescription(program.description ?? "")
    setRenameProgramOpen(true)
  }

  const handleRenameProgramOpenChange = (open) => {
    setRenameProgramOpen(open)
    if (!open) {
      setRenameTarget(null)
      setRenameProgramName("")
      setRenameProgramFullName("")
      setRenameProgramDescription("")
    }
  }

  const renameIdentifierChanged = useMemo(() => {
    if (!renameTarget) return false
    const code = renameProgramName.trim().toUpperCase()
    const slug = slugFromCode(code)
    return code !== renameTarget.code || slug !== renameTarget.slug
  }, [renameTarget, renameProgramName])

  const requirementRowKey = (row, index) => row.clientKey || row.id || `row-${index}`

  const openRequirementsProgramDialog = (program) => {
    setSidebarOpen(true)
    setProgramsOpen(true)
    setRequirementsTarget(program)
    setRequirementsDraft(
      (program.requirements ?? []).map((item) => ({
        clientKey: item.id || `req-${crypto.randomUUID()}`,
        id: item.id,
        label: item.label,
      })),
    )
    setMovedRequirementKey("")
    setRequirementsProgramOpen(true)
  }

  const handleRequirementsProgramOpenChange = (open) => {
    setRequirementsProgramOpen(open)
    if (!open) {
      setRequirementsTarget(null)
      setRequirementsDraft([])
      setMovedRequirementKey("")
    }
  }

  const handleAddRequirementRow = () => {
    setRequirementsDraft((prev) => [
      ...prev,
      { clientKey: `req-${crypto.randomUUID()}`, id: "", label: "" },
    ])
  }

  const handleMoveRequirementRow = (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    const row = requirementsDraft[index]
    if (!row || targetIndex < 0 || targetIndex >= requirementsDraft.length) return
    setMovedRequirementKey(requirementRowKey(row, index))
    setRequirementsDraft((prev) => {
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  useEffect(() => {
    if (!movedRequirementKey) return undefined
    const timer = window.setTimeout(() => setMovedRequirementKey(""), 450)
    return () => window.clearTimeout(timer)
  }, [movedRequirementKey])

  const handleRequirementLabelChange = (index, label) => {
    setRequirementsDraft((prev) =>
      prev.map((row, i) => (i === index ? { ...row, label } : row)),
    )
  }

  const handleRemoveRequirementRow = (index) => {
    setRequirementsDraft((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRequirementsProgramSubmit = async (event) => {
    event.preventDefault()
    if (!requirementsTarget) return
    const validation = validateProgramRequirements(requirementsDraft)
    if (!validation.ok) {
      showFeedback("warning", "Could not save requirements", programErrorMessage(validation.error))
      return
    }
    setRequirementsSaving(true)
    const result = await updateProgramRequirements(requirementsTarget.id, validation.requirements)
    setRequirementsSaving(false)
    if (!result.ok) {
      showFeedback("warning", "Could not save requirements", programErrorMessage(result.error))
      return
    }
    const label = result.program.fullName || result.program.name
    handleRequirementsProgramOpenChange(false)
    showFeedback(
      "success",
      "Requirements saved",
      `${label} now shows ${validation.requirements.length} checklist item${validation.requirements.length === 1 ? "" : "s"} in View record (per year level and semester).`,
    )
  }

  const requirementsPreview = useMemo(
    () => normalizeRequirementDraftRows(requirementsDraft),
    [requirementsDraft],
  )

  const handleRenameProgramSubmit = async (event) => {
    event.preventDefault()
    if (!renameTarget) return
    setRenameProgramSaving(true)
    const oldSlug = renameTarget.slug
    const result = await renameProgram(renameTarget.id, {
      name: renameProgramName,
      fullName: renameProgramFullName,
      description: renameProgramDescription,
    })
    setRenameProgramSaving(false)
    if (!result.ok) {
      showFeedback("warning", "Could not save program", programErrorMessage(result.error))
      return
    }
    const label = result.program.fullName || result.program.name
    const slugChanged = result.program.slug !== oldSlug
    handleRenameProgramOpenChange(false)
    if (activeProgramSlug === oldSlug && slugChanged) {
      navigate(programRoutePath(result.program))
    }
    showFeedback(
      "success",
      "Program saved",
      slugChanged
        ? `${label} is updated. The workspace link changed—update any bookmarks you shared.`
        : `${label} is updated with your new details.`,
    )
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
          <CloseAdminSidebarOnNavigate />
          <Sidebar
            collapsible="icon"
            variant="inset"
            className="border-r-0"
            onMouseEnter={() => setSidebarOpen(true)}
            onMouseLeave={() => {
              if (!sidebarPinned) setSidebarOpen(false)
            }}
          >
            <SidebarHeader className="relative shrink-0 gap-2 border-b border-white/15 px-2 py-2 pr-12">
              <AdminSidebarMobileClose />
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
                          {programsLoading ? (
                            <li className="px-2 py-1 text-[11px] text-white/60 group-data-[collapsible=icon]:hidden">
                              Loading programs…
                            </li>
                          ) : null}
                          {programs.map((program) => {
                            const isProgramActive = program.active !== false
                            const isCurrent = activeProgramSlug === program.slug
                            const isActionBusy = programActionId === program.id

                            return (
                              <SidebarMenuSubItem key={program.id} className="group/program relative">
                                {isProgramActive ? (
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isCurrent}
                                    className={cn(sidebarSubMenuButtonClass, "pr-8")}
                                  >
                                    <NavLink to={programRoutePath(program)}>
                                      <span>{program.name}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                ) : (
                                  <SidebarMenuSubButton
                                    isActive={false}
                                    aria-disabled
                                    className={cn(
                                      sidebarSubMenuButtonClass,
                                      "cursor-not-allowed pr-8 opacity-45 saturate-50",
                                    )}
                                    title={`${program.name} is inactive — activate to open workspace`}
                                  >
                                    <span className="flex min-w-0 items-center gap-1.5">
                                      <AlertTriangle className="size-3.5 text-amber-300 dark:text-amber-200" aria-hidden />
                                      <span className="truncate text-white/70">{program.name}</span>
                                    </span>
                                    <span className="ml-1.5 rounded bg-white/15 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/80">
                                      Off
                                    </span>
                                  </SidebarMenuSubButton>
                                )}
                                <DropdownMenu
                                  modal={false}
                                  onOpenChange={(open) => {
                                    setProgramMenuOpenId(open ? program.id : "")
                                    if (open) {
                                      setSidebarOpen(true)
                                      setProgramsOpen(true)
                                    }
                                  }}
                                >
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      disabled={isActionBusy}
                                      aria-label={`Actions for ${program.name}`}
                                      onClick={(event) => event.stopPropagation()}
                                      className={cn(
                                        "absolute right-0.5 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-opacity disabled:opacity-40",
                                        "opacity-0 group-hover/program:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                                        !isProgramActive && "opacity-100 text-white/80 hover:bg-white/20 hover:text-white",
                                        isProgramActive && isCurrent && "text-[#081F5C]/70 opacity-100 hover:bg-[#081F5C]/10 hover:text-[#081F5C] data-[state=open]:text-[#081F5C]",
                                        isProgramActive && !isCurrent && "text-white/80 hover:bg-white/20 hover:text-white",
                                      )}
                                    >
                                      {isActionBusy ? (
                                        <span className="text-[9px] font-medium">…</span>
                                      ) : (
                                        <MoreHorizontal className="size-3.5" aria-hidden />
                                      )}
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" side="right" className="min-w-40">
                                    <DropdownMenuItem
                                      className="gap-2"
                                      disabled={!isProgramActive}
                                      title={!isProgramActive ? "Inactive program cannot be edited" : undefined}
                                      onSelect={() => openRenameProgramDialog(program)}
                                    >
                                      <Pencil className="size-4 opacity-70" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="gap-2"
                                      disabled={!isProgramActive}
                                      title={!isProgramActive ? "Inactive program requirements cannot be edited" : undefined}
                                      onSelect={() => openRequirementsProgramDialog(program)}
                                    >
                                      <ListChecks className="size-4 opacity-70" />
                                      Requirements
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {isProgramActive ? (
                                      <DropdownMenuItem
                                        className="gap-2 text-amber-700 focus:text-amber-700 dark:text-amber-200"
                                        onSelect={() => openDeactivateProgramConfirm(program)}
                                      >
                                        <PowerOff className="size-4 opacity-70" />
                                        Deactivate
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        className="gap-2"
                                        onSelect={() => handleActivateProgram(program)}
                                      >
                                        <Power className="size-4 opacity-70" />
                                        Activate
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </SidebarMenuSubItem>
                            )
                          })}
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
                                onClick={openAddProgramWarning}
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
                        tooltip="Bulletin"
                        className={sidebarMenuButtonClass}
                      >
                        <NavLink className="flex w-full min-w-0 items-center justify-start gap-2" to="/osgfa/announcement">
                          <Megaphone className="size-[22px] shrink-0 opacity-90" />
                          <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">Bulletin</span>
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
              <AdminSidebarMobileToggle />
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

      <AlertDialog open={deactivateConfirmOpen} onOpenChange={handleDeactivateConfirmOpenChange}>
        <AlertDialogContent className="max-w-lg rounded-2xl border border-amber-200/80 bg-white/95 shadow-sm backdrop-blur-md duration-300 ease-out data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 dark:border-amber-500/25 dark:bg-slate-950/50">
          <AlertDialogHeader className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                <AlertTriangle className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <AlertDialogTitle className="text-[#081F5C] dark:text-blue-100">
                  Deactivate {deactivateTarget?.name ?? "program"}?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                    <p>
                      This program will be turned off. Existing data is kept—you can activate it again later.
                    </p>
                    <ul className="list-disc space-y-1.5 pl-5 text-slate-600 dark:text-slate-300">
                      <li>Hidden from the Programs sidebar and Batches (no new batch work under this program)</li>
                      <li>Published landing-page batches for this program are unpublished automatically</li>
                      <li>Grantee records, archives, and program settings stay stored unchanged</li>
                      {deactivateTarget && activeProgramSlug === deactivateTarget.slug ? (
                        <li>You will leave this program&apos;s workspace and return to the dashboard</li>
                      ) : null}
                    </ul>
                  </div>
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel
              variant="outline"
              className="rounded-xl border-[#081F5C]/20 text-[#081F5C] hover:bg-[#081F5C]/5 hover:text-[#081F5C] dark:text-blue-100 dark:hover:bg-blue-950/30"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
              disabled={Boolean(deactivateTarget && programActionId === deactivateTarget.id)}
              onClick={(event) => {
                event.preventDefault()
                handleConfirmDeactivateProgram()
              }}
            >
              {deactivateTarget && programActionId === deactivateTarget.id ? "Deactivating…" : "Deactivate program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <Dialog open={renameProgramOpen} onOpenChange={handleRenameProgramOpenChange}>
        <DialogContent className={cn(programDialogShellClass, "w-[min(92vw,40rem)]")}>
          <div className={programDialogAccentClass} aria-hidden />
          <div className={programDialogBodyClass}>
            <DialogHeader className="space-y-4 text-left">
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#04133d] via-[#081F5C] to-[#1447a6] text-sm font-bold tracking-wide text-white shadow-md">
                  {(renameProgramName || renameTarget?.code || "—").slice(0, 4)}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <span className="h-7 w-1 shrink-0 rounded-full bg-linear-to-b from-[#04133d] via-[#081F5C] to-[#1447a6]" aria-hidden />
                    <DialogTitle className="text-xl font-semibold tracking-tight text-[#081F5C] dark:text-blue-100">
                      {renameProgramFullName.trim() || renameProgramName.trim() || "Edit program"}
                    </DialogTitle>
                    {renameProgramName.trim() ? (
                      <span className="rounded-lg bg-[#081F5C]/10 px-2.5 py-0.5 text-xs font-bold tracking-wide text-[#081F5C] dark:bg-blue-950/50 dark:text-blue-100">
                        {renameProgramName.trim().toUpperCase()}
                      </span>
                    ) : null}
                  </div>
                  <DialogDescription className="max-w-prose text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Update how this program appears in the sidebar and at the top of its workspace. Use{" "}
                    <span className="font-medium text-foreground">Requirements</span> in the menu for document checklists.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form className="space-y-6" onSubmit={handleRenameProgramSubmit}>
              <section className={cn(programSectionClass, "transition-opacity duration-300 ease-out")}>
                <p className={programSectionTitleClass}>
                  <span className="h-5 w-1 rounded-full bg-[#081F5C] dark:bg-blue-400" aria-hidden />
                  Program details
                </p>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="rename-program-name" className={programFieldLabelClass}>
                      Short name
                    </label>
                    <Input
                      id="rename-program-name"
                      value={renameProgramName}
                      onChange={(event) => setRenameProgramName(event.target.value.toUpperCase())}
                      placeholder="e.g. TES"
                      maxLength={12}
                      required
                      className={cn(programFieldInputClass, "uppercase transition-colors duration-200")}
                      aria-describedby="rename-program-name-hint"
                    />
                    <p id="rename-program-name-hint" className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Shown in the sidebar and stored on grantee records.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="rename-program-full-name" className={programFieldLabelClass}>
                      Full title
                    </label>
                    <Input
                      id="rename-program-full-name"
                      value={renameProgramFullName}
                      onChange={(event) => setRenameProgramFullName(event.target.value)}
                      placeholder="e.g. Tertiary Education Subsidy"
                      required
                      className={cn(programFieldInputClass, "transition-colors duration-200")}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="rename-program-description" className={programFieldLabelClass}>
                    Description <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="rename-program-description"
                    value={renameProgramDescription}
                    onChange={(event) => setRenameProgramDescription(event.target.value)}
                    rows={3}
                    placeholder="Short summary shown under the program name in the workspace header"
                    className={cn(
                      programFieldInputClass,
                      "min-h-[5.5rem] w-full resize-y px-3 py-2.5 transition-colors duration-200",
                    )}
                  />
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Appears below the program title when staff open this program&apos;s workspace.
                  </p>
                </div>
              </section>

              {renameIdentifierChanged ? (
                <div
                  role="alert"
                  className="flex gap-3 rounded-2xl border border-amber-200/90 bg-amber-50 px-4 py-3.5 text-sm text-amber-950 transition-all duration-300 ease-out dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50"
                >
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                  <p className="leading-relaxed">
                    <span className="font-semibold">Renaming the short name</span> updates linked grantee, batch, and archive data, and changes bookmarked workspace links.
                  </p>
                </div>
              ) : null}

              <DialogFooter className={programDialogFooterClass}>
                <Button
                  type="button"
                  variant="outline"
                  className={programDialogCancelClass}
                  onClick={() => handleRenameProgramOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={programDialogSaveClass}
                  disabled={
                    renameProgramSaving
                    || !renameProgramName.trim()
                    || !renameProgramFullName.trim()
                  }
                >
                  {renameProgramSaving ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={requirementsProgramOpen} onOpenChange={handleRequirementsProgramOpenChange}>
        <DialogContent
          className={cn(
            programDialogShellClass,
            "flex max-h-[min(92dvh,44rem)] w-[min(92vw,44rem)] flex-col",
          )}
        >
          <div className={programDialogAccentClass} aria-hidden />
          <div className="flex min-h-0 flex-1 flex-col">
            <div className={cn(programDialogBodyClass, "shrink-0 pb-4")}>
              <DialogHeader className="space-y-4 text-left">
                <div className="flex flex-wrap items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#04133d]/10 via-[#081F5C]/15 to-[#1447a6]/10 text-[#081F5C] ring-1 ring-[#081F5C]/15 dark:text-blue-100 dark:ring-blue-500/25">
                    <ListChecks className="size-6" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="h-7 w-1 shrink-0 rounded-full bg-linear-to-b from-[#04133d] via-[#081F5C] to-[#1447a6]" aria-hidden />
                      <DialogTitle className="text-xl font-semibold tracking-tight text-[#081F5C] dark:text-blue-100">
                        Requirements
                      </DialogTitle>
                      {requirementsTarget ? (
                        <span className="rounded-lg bg-[#081F5C]/10 px-2.5 py-0.5 text-xs font-bold tracking-wide text-[#081F5C] dark:bg-blue-950/50 dark:text-blue-100">
                          {requirementsTarget.code}
                        </span>
                      ) : null}
                    </div>
                    <DialogDescription className="max-w-prose text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      Build the document checklist staff see in grantee records. Order matters—use the arrows to reorder. Each item appears for every year level and semester.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="rounded-2xl border border-[#081F5C]/12 bg-linear-to-r from-[#081F5C]/5 via-transparent to-violet-100/40 px-4 py-3 transition-colors duration-300 ease-out dark:border-blue-500/20 dark:from-blue-950/40 dark:to-indigo-950/20">
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold text-[#081F5C] dark:text-blue-200">{requirementsPreview.length}</span>
                  {" "}
                  {requirementsPreview.length === 1 ? "document" : "documents"}
                  {" "}
                  in checklist · staff mark each as submitted when reviewing grantees
                </p>
              </div>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleRequirementsProgramSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto px-8 transition-opacity duration-300 ease-out [scrollbar-gutter:stable]">
                {requirementsDraft.length === 0 ? (
                  <div className="mb-4 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 px-4 py-8 text-center dark:border-white/15 dark:bg-slate-900/30">
                    <ListChecks className="mx-auto mb-2 size-8 text-[#081F5C]/40 dark:text-blue-300/50" aria-hidden />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No requirements yet</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add your first document below to get started.</p>
                  </div>
                ) : (
                  <ul className="space-y-2.5 pb-2" aria-label="Requirement checklist items">
                    {requirementsDraft.map((row, index) => {
                      const rowKey = requirementRowKey(row, index)
                      const isRecentlyMoved = movedRequirementKey === rowKey

                      return (
                        <li
                          key={rowKey}
                          className={cn(
                            programRequirementRowClass,
                            isRecentlyMoved && programRequirementRowMovedClass,
                          )}
                        >
                          <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:gap-1">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#081F5C]/8 text-sm font-bold text-[#081F5C] transition-colors duration-300 dark:bg-blue-950/50 dark:text-blue-100"
                              aria-hidden
                            >
                              {index + 1}
                            </span>
                            <GripVertical className="hidden size-4 text-slate-300 sm:block dark:text-slate-600" aria-hidden />
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`req-label-${rowKey}`} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:sr-only dark:text-slate-400">
                              Document {index + 1}
                            </label>
                            <Input
                              id={`req-label-${rowKey}`}
                              value={row.label}
                              onChange={(event) => handleRequirementLabelChange(index, event.target.value)}
                              placeholder="e.g. Certificate of Registration, Valid ID"
                              aria-label={`Requirement ${index + 1}`}
                              className={cn(programFieldInputClass, "min-h-11 transition-colors duration-200")}
                            />
                          </div>

                          <div className="flex items-center justify-end gap-1 sm:flex-col sm:justify-center">
                            <div className="flex gap-0.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-40 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
                                disabled={index === 0}
                                onClick={() => handleMoveRequirementRow(index, "up")}
                                aria-label={`Move requirement ${index + 1} up`}
                                title="Move up"
                              >
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-40 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
                                disabled={index === requirementsDraft.length - 1}
                                onClick={() => handleMoveRequirementRow(index, "down")}
                                aria-label={`Move requirement ${index + 1} down`}
                                title="Move down"
                              >
                                <ArrowDown className="size-3.5" />
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-lg border-slate-200 text-slate-500 transition-colors duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:border-white/15 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                              disabled={requirementsDraft.length <= 1}
                              onClick={() => handleRemoveRequirementRow(index)}
                              aria-label={`Remove requirement ${index + 1}`}
                              title="Remove"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="mb-2 h-11 w-full gap-2 rounded-xl border-dashed border-[#081F5C]/25 text-[#081F5C] transition-colors duration-200 hover:bg-[#081F5C]/5 dark:border-blue-500/30 dark:text-blue-200 dark:hover:bg-blue-950/30"
                  disabled={requirementsDraft.length >= 12}
                  onClick={handleAddRequirementRow}
                >
                  <Plus className="size-4" />
                  {requirementsDraft.length === 0 ? "Add first requirement" : "Add another requirement"}
                </Button>

                {requirementsPreview.length === 0 && requirementsDraft.length > 0 ? (
                  <p className="pb-4 text-sm text-amber-800 transition-opacity duration-300 dark:text-amber-200">
                    Each row needs a description before you can save.
                  </p>
                ) : null}
              </div>

              <DialogFooter className={cn(programDialogFooterClass, "shrink-0 px-8 pb-8")}>
                <Button
                  type="button"
                  variant="outline"
                  className={programDialogCancelClass}
                  onClick={() => handleRequirementsProgramOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={programDialogSaveClass}
                  disabled={requirementsSaving || requirementsPreview.length === 0}
                >
                  {requirementsSaving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={addProgramWarningOpen} onOpenChange={handleAddProgramWarningOpenChange}>
        <AlertDialogContent className="!w-[min(calc(100vw-1.5rem),36rem)] !max-w-none gap-0 overflow-hidden rounded-2xl border border-[#081F5C]/14 bg-white p-0 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] duration-300 ease-out data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[size=default]:!max-w-none data-[size=default]:sm:!max-w-none dark:border-[#081F5C]/25 dark:bg-slate-950">
          <div className={programDialogAccentClass} aria-hidden />
          <div className="px-6 py-6 sm:px-8 sm:py-7">
            <AlertDialogHeader className="mb-5 space-y-3 text-left sm:place-items-start">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#081F5C]/70 dark:text-blue-300/80">
                Step 1 of 2 · Review requirements
              </p>
              <div className="flex w-full items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                  <AlertTriangle className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <AlertDialogTitle className="text-lg font-semibold tracking-tight text-[#081F5C] dark:text-blue-100">
                    Before you add a program
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
                    New programs are permanent and must follow UniFAST import rules. Read both points below before continuing.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>

            <ol className="space-y-3" aria-label="Program requirements">
              <li className="flex gap-3.5 rounded-xl border border-slate-200/90 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-slate-900/50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-[#081F5C] shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-blue-100 dark:ring-white/10">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <Lock className="mt-0.5 size-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
                    <div className="min-w-0 text-sm leading-relaxed">
                      <p className="font-semibold text-[#081F5C] dark:text-blue-100">Programs cannot be deleted</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        Once saved, a program stays in the system. You can deactivate it to hide it from Batches and the sidebar, but records remain.
                      </p>
                    </div>
                  </div>
                </div>
              </li>

              <li className="flex gap-3.5 rounded-xl border border-amber-200/90 bg-amber-50/90 p-4 dark:border-amber-500/35 dark:bg-amber-950/35">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-900 dark:bg-amber-500/25 dark:text-amber-50">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-amber-800 dark:text-amber-200" aria-hidden />
                    <div className="min-w-0 text-sm leading-relaxed">
                      <p className="font-semibold text-amber-950 dark:text-amber-100">UniFAST format is required</p>
                      <p className="mt-1 text-amber-950/85 dark:text-amber-100/90">
                        Use the same spreadsheet layout as existing programs such as{" "}
                        <span className="font-medium">TES</span> or <span className="font-medium">TDP</span>.
                        Other formats will fail on imports and grantee records.
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            </ol>

            <label
              htmlFor="add-program-warning-ack"
              className={cn(
                "mt-5 flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors",
                addProgramWarningAcknowledged
                  ? "border-[#081F5C]/25 bg-[#081F5C]/5 dark:border-blue-500/30 dark:bg-blue-950/30"
                  : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-white/20",
              )}
            >
              <Checkbox
                id="add-program-warning-ack"
                checked={addProgramWarningAcknowledged}
                onCheckedChange={(checked) => setAddProgramWarningAcknowledged(checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                I understand that programs are permanent and must follow the UniFAST format before I add one.
              </span>
            </label>

            <AlertDialogFooter className="!-mx-0 !-mb-0 mt-5 !border-0 !bg-transparent !p-0 flex-col gap-3 border-t border-slate-200/70 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <p className="text-left text-xs leading-relaxed text-muted-foreground sm:max-w-[52%]">
                Not sure? Compare with a TES/TDP template or confirm with your coordinator first.
              </p>
              <div className="flex w-full shrink-0 flex-col-reverse gap-2.5 sm:w-auto sm:flex-row">
                <AlertDialogCancel variant="outline" className={cn(programDialogCancelClass, "h-10 px-5")}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    programDialogSaveClass,
                    "h-10 gap-1.5 px-5 disabled:pointer-events-none disabled:opacity-45",
                  )}
                  disabled={!addProgramWarningAcknowledged}
                  onClick={(event) => {
                    event.preventDefault()
                    proceedToAddProgram()
                  }}
                >
                  Continue to details
                  <ChevronRight className="size-4" aria-hidden />
                </AlertDialogAction>
              </div>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addProgramOpen} onOpenChange={handleAddProgramOpenChange}>
        <DialogContent className={cn(programDialogShellClass, "w-[min(92vw,40rem)]")}>
          <div className={programDialogAccentClass} aria-hidden />
          <div className={programDialogBodyClass}>
            <DialogHeader className="space-y-4 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#081F5C]/70 dark:text-blue-300/80">
                Step 2 of 2 · Program details
              </p>
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#04133d] via-[#081F5C] to-[#1447a6] text-sm font-bold tracking-wide text-white shadow-md">
                  {(newProgramCode || "—").slice(0, 4)}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <span className="h-7 w-1 shrink-0 rounded-full bg-linear-to-b from-[#04133d] via-[#081F5C] to-[#1447a6]" aria-hidden />
                    <DialogTitle className="text-xl font-semibold tracking-tight text-[#081F5C] dark:text-blue-100">
                      {newProgramFullName.trim() || newProgramCode.trim() || "Add program"}
                    </DialogTitle>
                    {newProgramCode.trim() ? (
                      <span className="rounded-lg bg-[#081F5C]/10 px-2.5 py-0.5 text-xs font-bold tracking-wide text-[#081F5C] dark:bg-blue-950/50 dark:text-blue-100">
                        {newProgramCode.trim().toUpperCase()}
                      </span>
                    ) : null}
                  </div>
                  <DialogDescription className="max-w-prose text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Enter the short name and full title for this scholarship program. You can set document requirements after it is created.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form className="space-y-6" onSubmit={handleAddProgramSubmit}>
              <div
                role="note"
                className="flex gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-50"
              >
                <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-amber-800 dark:text-amber-200" aria-hidden />
                <p className="leading-relaxed">
                  Imports and grantee records for this program must use the{" "}
                  <span className="font-medium">UniFAST format</span> (same layout as TES/TDP).
                </p>
              </div>

              <section className={cn(programSectionClass, "transition-opacity duration-300 ease-out")}>
                <p className={programSectionTitleClass}>
                  <span className="h-5 w-1 rounded-full bg-[#081F5C] dark:bg-blue-400" aria-hidden />
                  Program details
                </p>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="add-program-code" className={programFieldLabelClass}>
                      Short name
                    </label>
                    <Input
                      id="add-program-code"
                      value={newProgramCode}
                      onChange={(event) => setNewProgramCode(event.target.value.toUpperCase())}
                      placeholder="e.g. TES"
                      maxLength={12}
                      required
                      className={cn(programFieldInputClass, "uppercase transition-colors duration-200")}
                      aria-describedby="add-program-code-hint"
                    />
                    <p id="add-program-code-hint" className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Shown in the sidebar and stored on grantee records.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="add-program-full-name" className={programFieldLabelClass}>
                      Full title
                    </label>
                    <Input
                      id="add-program-full-name"
                      value={newProgramFullName}
                      onChange={(event) => setNewProgramFullName(event.target.value)}
                      placeholder="e.g. Tertiary Education Subsidy"
                      required
                      className={cn(programFieldInputClass, "transition-colors duration-200")}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="add-program-description" className={programFieldLabelClass}>
                    Description <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="add-program-description"
                    value={newProgramDescription}
                    onChange={(event) => setNewProgramDescription(event.target.value)}
                    rows={3}
                    placeholder="Short summary shown under the program name in the workspace header"
                    className={cn(
                      programFieldInputClass,
                      "min-h-[5.5rem] w-full resize-y px-3 py-2.5 transition-colors duration-200",
                    )}
                  />
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Appears below the program title when staff open this program&apos;s workspace.
                  </p>
                </div>
              </section>

              <DialogFooter className={programDialogFooterClass}>
                <Button
                  type="button"
                  variant="outline"
                  className={programDialogCancelClass}
                  onClick={() => handleAddProgramOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={programDialogSaveClass}
                  disabled={
                    !canAddMore
                    || addProgramSaving
                    || !newProgramCode.trim()
                    || !newProgramFullName.trim()
                  }
                >
                  {addProgramSaving ? "Saving…" : "Add program"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        variant={feedbackVariant}
        title={feedbackTitle}
        message={feedbackMessage}
      />
    </div>
  )
}
