import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  HelpCircle,
  Lock,
  Plus,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  User,
  XCircle,
} from "lucide-react"
import PasswordField from "@/components/PasswordField"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { OSGFA_SETTINGS_CHANGED_EVENT, readStoredSettings, writeStoredSettings } from "@/lib/osgfaSettings"
import { cn } from "@/lib/utils"
import {
  createEmptyWorkflowStep,
  DEFAULT_PROCESS_WORKFLOW,
  DEFAULT_WORKFLOW_STEP_COLOR,
  DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
  normalizeProcessWorkflowSteps,
  PROCESS_WORKFLOW_ICON_OPTIONS,
  loadProcessWorkflow,
  persistProcessWorkflow,
  PROCESS_WORKFLOW_CHANGED_EVENT,
  readStoredProcessWorkflow,
  validateProcessWorkflow,
  WORKFLOW_ICON_MAP,
} from "@/lib/processWorkflowSettings"
import {
  LANDING_PAGE_SETTINGS_CHANGED_EVENT,
  loadLandingPageSettings,
  persistLandingPageSettings,
  readStoredLandingPageSettings,
} from "@/lib/landingPageSettings"
import authService from "@/services/authService"

const SECTIONS = {
  PROFILE: "profile",
  PASSWORD: "password",
  WORKFLOW: "workflow",
  LANDING_SETTINGS: "landing-settings",
  NOTIFICATIONS: "notifications",
  OSGFA_PRIVACY: "osgfa-privacy",
  SUPPORT: "support",
}

function readStoredUser() {
  const raw = localStorage.getItem("user")
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getUserDisplayName(user) {
  if (!user) return ""
  const fullName = String(user.fullName ?? "").trim()
  if (fullName) return fullName
  const combined = `${String(user.firstName ?? "").trim()} ${String(user.lastName ?? "").trim()}`.trim()
  return combined
}

function getUserRoleLabel(user) {
  const role = String(user?.role ?? "osgfa").toLowerCase()
  if (role === "osgfa") return "OSGFA"
  if (role === "cashier") return "Cashier"
  if (role === "superadmin") return "Super Admin"
  return "Administrator"
}

function getUserInitial(user) {
  const source = getUserDisplayName(user) || user?.email || ""
  return source.trim().charAt(0).toUpperCase() || "?"
}

function buildProfileForm(user) {
  return {
    fullName: getUserDisplayName(user),
    email: user?.email || "",
    role: user?.role || "osgfa",
  }
}

function captureWorkflowStepPositions(container) {
  if (!container) return new Map()
  const positions = new Map()
  for (const child of container.children) {
    const id = child.getAttribute("data-workflow-step-id")
    if (id) positions.set(id, child.getBoundingClientRect())
  }
  return positions
}

function playWorkflowStepFlip(container, beforePositions) {
  if (!container || !beforePositions?.size) return
  requestAnimationFrame(() => {
    for (const child of container.children) {
      const id = child.getAttribute("data-workflow-step-id")
      const first = id ? beforePositions.get(id) : null
      if (!first) continue
      const last = child.getBoundingClientRect()
      const deltaY = first.top - last.top
      if (Math.abs(deltaY) < 1) continue
      child.style.transform = `translateY(${deltaY}px)`
      child.style.transition = "transform 0s"
      requestAnimationFrame(() => {
        child.style.transition = "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)"
        child.style.transform = "translateY(0)"
        const clearInlineStyles = () => {
          child.style.transition = ""
          child.style.transform = ""
          child.removeEventListener("transitionend", clearInlineStyles)
        }
        child.addEventListener("transitionend", clearInlineStyles)
      })
    }
  })
}

function WorkflowStepEditor({
  step,
  index,
  total,
  isEditing,
  onStartEdit,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  canRemove,
}) {
  const StepIcon = WORKFLOW_ICON_MAP[step.icon] ?? WORKFLOW_ICON_MAP.ListChecks
  const headingPreview = step.title.trim() || "New step (add a heading)"

  return (
    <article
      data-workflow-step-id={step.id}
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-sm",
        isEditing ? "border-[#081F5C]/35 shadow-md ring-1 ring-[#081F5C]/15" : "border-[#081F5C]/12 shadow-sm",
      )}
    >
      <header
        className={cn(
          "flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-300",
          isEditing ? "border-b border-[#081F5C]/8" : "",
        )}
        style={{ backgroundImage: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)" }}
      >
        <button
          type="button"
          onClick={onStartEdit}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={isEditing}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-[#081F5C]/60 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isEditing && "rotate-90",
            )}
            aria-hidden
          />
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
            style={{
              backgroundImage: `linear-gradient(135deg, ${DEFAULT_WORKFLOW_STEP_COLOR} 0%, ${DEFAULT_WORKFLOW_STEP_COLOR_LIGHT} 100%)`,
            }}
          >
            <StepIcon className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#081F5C]/60">
              Step {index + 1} of {total}
            </span>
            <span className="block truncate text-sm font-semibold text-gray-900">{headingPreview}</span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={(event) => {
              event.stopPropagation()
              onMoveUp()
            }}
            title="Move step up"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
            <span className="sr-only">Move up</span>
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={(event) => {
              event.stopPropagation()
              onMoveDown()
            }}
            title="Move step down"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            <span className="sr-only">Move down</span>
          </button>
          <button
            type="button"
            disabled={!canRemove}
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            title="Remove step"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Remove</span>
          </button>
        </div>
      </header>

      <div
        className={cn("workflow-step-panel grid", isEditing ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
        aria-hidden={!isEditing}
      >
        <div className={cn("min-h-0 overflow-hidden", !isEditing && "pointer-events-none")}>
          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-dashed border-[#081F5C]/15 bg-slate-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#081F5C]/55">Preview</p>
              <p className="mt-1 text-sm font-semibold text-[#081F5C]">{headingPreview}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-600">
                {step.description.trim() || "Instructions will appear here once you add them."}
              </p>
            </div>

            <div>
              <label htmlFor={`workflow-title-${step.id}`} className="mb-1 block text-sm font-medium text-gray-800">
                Step heading
              </label>
              <input
                id={`workflow-title-${step.id}`}
                type="text"
                value={step.title}
                onChange={(event) => onChange({ title: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[#1447a6] focus:ring-2 focus:ring-[#1447a6]/20"
                placeholder="e.g. Submit the required documents"
                maxLength={120}
              />
            </div>

            <div>
              <label htmlFor={`workflow-desc-${step.id}`} className="mb-1 block text-sm font-medium text-gray-800">
                Instructions for students
              </label>
              <textarea
                id={`workflow-desc-${step.id}`}
                rows={3}
                value={step.description}
                onChange={(event) => onChange({ description: event.target.value })}
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-[#1447a6] focus:ring-2 focus:ring-[#1447a6]/20"
                placeholder="What should students do at this stage?"
                maxLength={600}
              />
              <p className="mt-1 text-right text-[11px] text-gray-400">{step.description.length}/600</p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-700">Icon</p>
              <div className="flex flex-wrap gap-1">
                {PROCESS_WORKFLOW_ICON_OPTIONS.map((option) => {
                  const Icon = WORKFLOW_ICON_MAP[option.value]
                  const selected = step.icon === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      title={option.label}
                      onClick={() => onChange({ icon: option.value })}
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-md border transition",
                        selected
                          ? "border-[#081F5C] bg-[#081F5C]/10 text-[#081F5C] ring-1 ring-[#081F5C]/30"
                          : "border-gray-200 bg-white text-gray-500 hover:border-[#081F5C]/25 hover:bg-slate-50",
                      )}
                      aria-pressed={selected}
                      aria-label={option.label}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function Setting() {
  const navigate = useNavigate()
  const [active, setActive] = useState(SECTIONS.PROFILE)
  const [openAccount, setOpenAccount] = useState(true)
  const [openSystem, setOpenSystem] = useState(true)
  const [openSupport, setOpenSupport] = useState(false)

  const [user, setUser] = useState(() => readStoredUser())
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpEmail, setOtpEmail] = useState("")
  const [passwordOtp, setPasswordOtp] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [profileForm, setProfileForm] = useState(() => buildProfileForm(readStoredUser()))
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [settings, setSettings] = useState(() => readStoredSettings())
  const [landingSettings, setLandingSettings] = useState(() => readStoredLandingPageSettings())
  const [profileNotice, setProfileNotice] = useState({ type: "", message: "" })
  const [passwordNotice, setPasswordNotice] = useState({ type: "", message: "" })
  const [settingsNotice, setSettingsNotice] = useState({ type: "", message: "" })
  const [workflowDraft, setWorkflowDraft] = useState(() => readStoredProcessWorkflow())
  const [editingWorkflowStepId, setEditingWorkflowStepId] = useState(null)
  const workflowListRef = useRef(null)
  const workflowFlipBeforeRef = useRef(null)
  const workflowShouldFlipRef = useRef(false)
  const [workflowSaving, setWorkflowSaving] = useState(false)
  const [workflowAlert, setWorkflowAlert] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  })

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!authService.isAuthenticated()) {
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)
      try {
        const fetchedUser = await authService.fetchProfile()
        if (cancelled || !fetchedUser) return
        setUser(fetchedUser)
        setProfileForm(buildProfileForm(fetchedUser))
      } catch {
        if (cancelled) return
        const storedUser = readStoredUser()
        if (storedUser) {
          setUser(storedUser)
          setProfileForm(buildProfileForm(storedUser))
        }
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!settingsNotice.message) return undefined
    const timer = setTimeout(() => {
      setSettingsNotice({ type: "", message: "" })
    }, 3500)
    return () => clearTimeout(timer)
  }, [settingsNotice.message])

  useEffect(() => {
    const syncSettings = () => setSettings(readStoredSettings())
    window.addEventListener(OSGFA_SETTINGS_CHANGED_EVENT, syncSettings)
    window.addEventListener("storage", syncSettings)
    return () => {
      window.removeEventListener(OSGFA_SETTINGS_CHANGED_EVENT, syncSettings)
      window.removeEventListener("storage", syncSettings)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadLandingPageSettings().then((settings) => {
      if (!cancelled) setLandingSettings(settings)
    })

    const syncLandingSettings = () => setLandingSettings(readStoredLandingPageSettings())
    window.addEventListener(LANDING_PAGE_SETTINGS_CHANGED_EVENT, syncLandingSettings)
    window.addEventListener("storage", syncLandingSettings)

    return () => {
      cancelled = true
      window.removeEventListener(LANDING_PAGE_SETTINGS_CHANGED_EVENT, syncLandingSettings)
      window.removeEventListener("storage", syncLandingSettings)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadProcessWorkflow().then((config) => {
      if (cancelled) return
      setWorkflowDraft(config)
      setEditingWorkflowStepId((currentId) => {
        if (currentId && config.steps.some((step) => step.id === currentId)) return currentId
        return config.steps[0]?.id ?? null
      })
    })

    const syncWorkflow = () => {
      const draft = readStoredProcessWorkflow()
      setWorkflowDraft(draft)
      setEditingWorkflowStepId((currentId) => {
        if (currentId && draft.steps.some((step) => step.id === currentId)) return currentId
        return draft.steps[0]?.id ?? null
      })
    }
    window.addEventListener(PROCESS_WORKFLOW_CHANGED_EVENT, syncWorkflow)
    window.addEventListener("storage", syncWorkflow)

    return () => {
      cancelled = true
      window.removeEventListener(PROCESS_WORKFLOW_CHANGED_EVENT, syncWorkflow)
      window.removeEventListener("storage", syncWorkflow)
    }
  }, [])

  useEffect(() => {
    if (active !== SECTIONS.WORKFLOW) return
    const draft = readStoredProcessWorkflow()
    setWorkflowDraft(draft)
    setEditingWorkflowStepId((currentId) => {
      if (currentId && draft.steps.some((step) => step.id === currentId)) return currentId
      return draft.steps[0]?.id ?? null
    })
  }, [active])

  useLayoutEffect(() => {
    if (!workflowShouldFlipRef.current) return
    workflowShouldFlipRef.current = false
    playWorkflowStepFlip(workflowListRef.current, workflowFlipBeforeRef.current)
    workflowFlipBeforeRef.current = null
  }, [workflowDraft.steps])

  const displayName = useMemo(() => getUserDisplayName(user), [user])
  const initials = useMemo(() => getUserInitial(user), [user])
  const roleLabel = useMemo(() => getUserRoleLabel(user), [user])

  const showWorkflowAlert = (type, title, message) => {
    setWorkflowAlert({ open: true, type, title, message })
  }

  const updateWorkflowStep = (index, patch) => {
    setWorkflowDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)),
    }))
  }

  const moveWorkflowStep = (index, direction) => {
    workflowFlipBeforeRef.current = captureWorkflowStepPositions(workflowListRef.current)
    workflowShouldFlipRef.current = true
    setWorkflowDraft((prev) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.steps.length) return prev
      const steps = [...prev.steps]
      const [moved] = steps.splice(index, 1)
      steps.splice(nextIndex, 0, moved)
      return { steps: normalizeProcessWorkflowSteps(steps) }
    })
  }

  const removeWorkflowStep = (index) => {
    setWorkflowDraft((prev) => {
      const removedId = prev.steps[index]?.id
      const steps = normalizeProcessWorkflowSteps(prev.steps.filter((_, stepIndex) => stepIndex !== index))
      setEditingWorkflowStepId((currentId) => {
        if (currentId !== removedId) return currentId
        const nextIndex = Math.min(index, Math.max(0, steps.length - 1))
        return steps[nextIndex]?.id ?? null
      })
      return { steps }
    })
  }

  const addWorkflowStep = () => {
    const newStep = createEmptyWorkflowStep(workflowDraft.steps.length)
    setWorkflowDraft((prev) => ({
      steps: normalizeProcessWorkflowSteps([...prev.steps, newStep]),
    }))
    setEditingWorkflowStepId(newStep.id)
  }

  const handleResetWorkflow = () => {
    const steps = DEFAULT_PROCESS_WORKFLOW.steps.map((step) => ({ ...step }))
    setWorkflowDraft({ steps })
    setEditingWorkflowStepId(steps[0]?.id ?? null)
    showWorkflowAlert(
      "info",
      "Defaults loaded",
      "The default timeline steps are loaded in the editor. Click Save changes to publish them on the landing page.",
    )
  }

  const handleSaveWorkflow = async (event) => {
    event.preventDefault()
    const { valid, errors, normalized } = validateProcessWorkflow(workflowDraft)
    if (!valid) {
      showWorkflowAlert("error", "Could not save", errors.join(" "))
      return
    }

    setWorkflowSaving(true)
    try {
      const saved = await persistProcessWorkflow(normalized)
      setWorkflowDraft(saved)
      showWorkflowAlert(
        "success",
        "Changes saved",
        "Process / Workflow content was updated. Visitors will see the new steps on the public landing page.",
      )
    } catch (error) {
      showWorkflowAlert(
        "error",
        "Save failed",
        error?.response?.data?.message ??
          error?.message ??
          "Unable to save workflow settings. Check that the backend is running and try again.",
      )
    } finally {
      setWorkflowSaving(false)
    }
  }

  const saveSettings = (nextSettings, noticeMessage = "System settings saved.") => {
    setSettings(nextSettings)
    writeStoredSettings(nextSettings)
    setSettingsNotice({ type: "success", message: noticeMessage })
  }

  const saveLandingSettings = async (nextSettings, noticeMessage = "Landing page settings saved.") => {
    setLandingSettings(nextSettings)
    try {
      await persistLandingPageSettings(nextSettings)
      setSettingsNotice({ type: "success", message: noticeMessage })
    } catch (error) {
      console.error("Failed to save landing page settings:", error)
      setSettingsNotice({
        type: "error",
        message:
          error?.response?.data?.message ??
          error?.message ??
          "Could not save landing page settings. Check that the backend is running.",
      })
    }
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    setProfileNotice({ type: "", message: "" })

    if (!profileForm.fullName.trim()) {
      setProfileNotice({ type: "error", message: "Full name is required." })
      return
    }

    setProfileSaving(true)
    try {
      const result = await authService.updateProfile({ fullName: profileForm.fullName.trim() })
      const updatedUser = result?.user
      if (updatedUser) {
        setUser(updatedUser)
        setProfileForm(buildProfileForm(updatedUser))
      }
      setProfileNotice({ type: "success", message: result?.message || "Profile details updated." })
    } catch (error) {
      setProfileNotice({ type: "error", message: error.message || "Unable to update profile." })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleRequestPasswordOtp = async () => {
    setPasswordNotice({ type: "", message: "" })

    if (!passwordForm.currentPassword) {
      setPasswordNotice({ type: "error", message: "Enter your current password before requesting a code." })
      return
    }

    setOtpSending(true)
    try {
      const result = await authService.requestPasswordChangeOtp({
        currentPassword: passwordForm.currentPassword,
      })
      setOtpSent(true)
      setOtpEmail(result?.email || user?.email || "")
      setPasswordNotice({
        type: "success",
        message: result?.message || "Verification code sent to your email.",
      })
    } catch (error) {
      setPasswordNotice({
        type: "error",
        message: error.message || "Unable to send verification code.",
      })
    } finally {
      setOtpSending(false)
    }
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    setPasswordNotice({ type: "", message: "" })

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordNotice({ type: "error", message: "Please complete all password fields." })
      return
    }
    if (!otpSent) {
      setPasswordNotice({
        type: "error",
        message: "Request an email verification code before updating your password.",
      })
      return
    }
    if (!/^\d{6}$/.test(passwordOtp.trim())) {
      setPasswordNotice({ type: "error", message: "Enter the 6-digit verification code from your email." })
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordNotice({ type: "error", message: "New password must be at least 8 characters." })
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordNotice({ type: "error", message: "New password and confirmation do not match." })
      return
    }

    setPasswordSaving(true)
    try {
      const result = await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        otp: passwordOtp.trim(),
      })
      setPasswordNotice({
        type: "success",
        message: result?.message || "Password updated successfully.",
      })
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setPasswordOtp("")
      setOtpSent(false)
      setOtpEmail("")
    } catch (error) {
      setPasswordNotice({
        type: "error",
        message: error.message || "Unable to update password.",
      })
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="rounded-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6] p-4 text-white shadow-md shadow-[#04133d]/20">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-white/95 hover:text-white"
              aria-label="Back"
            >
              <span className="text-lg leading-none">‹</span>
              <span>Back</span>
            </button>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/90 bg-white text-[#081F5C]">
                <SettingsIcon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold">OSGFA Settings</h2>
                <p className="truncate text-xs text-sky-100/90">
                  Manage your account, security, and SRMS system preferences.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 items-stretch grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
          <aside className="h-full min-h-full rounded-2xl border border-[#081F5C]/10 bg-white/90 p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-[#04133d] to-[#0b2b73] text-lg font-semibold text-white">
              {profileLoading ? "…" : initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {profileLoading ? "Loading account…" : displayName || user?.email || "—"}
              </p>
              <p className="truncate text-xs text-gray-600">{profileLoading ? "…" : roleLabel}</p>
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          <nav className="mt-3 space-y-2 text-sm">
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-3 py-2 font-medium text-gray-800 hover:bg-gray-100"
                onClick={() => setOpenAccount((prev) => !prev)}
              >
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>Account</span>
                </span>
                {openAccount ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {openAccount && (
                <div className="mt-2 space-y-2 pl-10">
                  <button
                    type="button"
                    onClick={() => setActive(SECTIONS.PROFILE)}
                    className={`block w-full rounded-md py-1 text-left transition ${
                      active === SECTIONS.PROFILE ? "font-semibold text-[#081F5C]" : "text-gray-700 hover:text-[#081F5C]"
                    }`}
                  >
                    Profile Information
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive(SECTIONS.PASSWORD)}
                    className={`block w-full rounded-md py-1 text-left transition ${
                      active === SECTIONS.PASSWORD ? "font-semibold text-[#081F5C]" : "text-gray-700 hover:text-[#081F5C]"
                    }`}
                  >
                    Change Password
                  </button>
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-3 py-2 font-medium text-gray-800 hover:bg-gray-100"
                onClick={() => setOpenSystem((prev) => !prev)}
              >
                <span className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  <span>System Preferences</span>
                </span>
                {openSystem ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {openSystem && (
                <div className="mt-2 space-y-2 pl-10">
                  <button
                    type="button"
                    onClick={() => setActive(SECTIONS.WORKFLOW)}
                    className={`block w-full rounded-md py-1 text-left transition ${
                      active === SECTIONS.WORKFLOW
                        ? "font-semibold text-[#081F5C]"
                        : "text-gray-700 hover:text-[#081F5C]"
                    }`}
                  >
                    Process / Workflow
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive(SECTIONS.LANDING_SETTINGS)}
                    className={`block w-full rounded-md py-1 text-left transition ${
                      active === SECTIONS.LANDING_SETTINGS
                        ? "font-semibold text-[#081F5C]"
                        : "text-gray-700 hover:text-[#081F5C]"
                    }`}
                  >
                    Landing Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive(SECTIONS.OSGFA_PRIVACY)}
                    className={`block w-full rounded-md py-1 text-left transition ${
                      active === SECTIONS.OSGFA_PRIVACY
                        ? "font-semibold text-[#081F5C]"
                        : "text-gray-700 hover:text-[#081F5C]"
                    }`}
                  >
                    OSGFA Privacy
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive(SECTIONS.NOTIFICATIONS)}
                    className={`block w-full rounded-md py-1 text-left transition ${
                      active === SECTIONS.NOTIFICATIONS
                        ? "font-semibold text-[#081F5C]"
                        : "text-gray-700 hover:text-[#081F5C]"
                    }`}
                  >
                    Notifications
                  </button>
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-3 py-2 font-medium text-gray-800 hover:bg-gray-100"
                onClick={() => setOpenSupport((prev) => !prev)}
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  <span>Support</span>
                </span>
                {openSupport ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {openSupport && (
                <div className="mt-2 space-y-2 pl-10">
                  <button
                    type="button"
                    onClick={() => setActive(SECTIONS.SUPPORT)}
                    className={`block w-full rounded-md py-1 text-left transition ${
                      active === SECTIONS.SUPPORT ? "font-semibold text-[#081F5C]" : "text-gray-700 hover:text-[#081F5C]"
                    }`}
                  >
                    Help Center
                  </button>
                </div>
              )}
            </div>
          </nav>
          </aside>

          <div className="h-full min-h-full overflow-y-auto rounded-2xl border border-[#081F5C]/10 bg-white/90 p-4 shadow-sm">
          {active === SECTIONS.PROFILE && (
            <section className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Profile Information</h3>
                <p className="text-sm text-gray-600">Update your account display details.</p>
              </div>

              {profileNotice.message && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    profileNotice.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {profileNotice.message}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSaveProfile}>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.fullName}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">Email</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      disabled
                      className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">Role</label>
                    <input
                      type="text"
                      value={roleLabel}
                      disabled
                      className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={profileSaving || profileLoading}
                  className="rounded-md bg-linear-to-r from-[#04133d] to-[#0b2b73] px-4 py-2 text-sm text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {profileSaving ? "Saving…" : "Save Profile"}
                </button>
              </form>
            </section>
          )}

          {active === SECTIONS.PASSWORD && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-700" />
                <h3 className="text-base font-semibold text-gray-900">Change Password</h3>
              </div>

              {passwordNotice.message && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    passwordNotice.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {passwordNotice.message}
                </div>
              )}

              <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                For security, confirm your current password and verify with a one-time code sent to your registered
                email before the new password is saved.
              </p>

              <form className="space-y-4" onSubmit={handleChangePassword}>
                <PasswordField
                  label="Current Password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => {
                    setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                    setOtpSent(false)
                    setPasswordOtp("")
                  }}
                  placeholder="Current password"
                  show={showCurrentPassword}
                  onToggleShow={() => setShowCurrentPassword((prev) => !prev)}
                  autoComplete="current-password"
                />

                <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-700">Email verification</p>
                    <button
                      type="button"
                      onClick={handleRequestPasswordOtp}
                      disabled={otpSending || passwordSaving}
                      className="rounded-md border border-[#081F5C]/20 bg-white px-3 py-1.5 text-xs font-medium text-[#081F5C] transition hover:bg-[#081F5C]/5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {otpSending ? "Sending code…" : otpSent ? "Resend code" : "Send verification code"}
                    </button>
                  </div>
                  {otpSent && (
                    <p className="text-xs text-gray-600">
                      Code sent to <span className="font-medium text-gray-800">{otpEmail || user?.email}</span>. Expires
                      in 10 minutes.
                    </p>
                  )}
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">6-digit verification code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={passwordOtp}
                      onChange={(event) => setPasswordOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full max-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm tracking-[0.3em] outline-none focus:border-blue-500"
                      placeholder="000000"
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>

                <PasswordField
                  label="New Password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                  placeholder="New password"
                  show={showNewPassword}
                  onToggleShow={() => setShowNewPassword((prev) => !prev)}
                  autoComplete="new-password"
                />
                <PasswordField
                  label="Confirm New Password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  placeholder="Confirm new password"
                  show={showConfirmPassword}
                  onToggleShow={() => setShowConfirmPassword((prev) => !prev)}
                  autoComplete="new-password"
                />

                <button
                  type="submit"
                  disabled={passwordSaving || !otpSent}
                  className="rounded-md bg-linear-to-r from-[#04133d] to-[#0b2b73] px-4 py-2 text-sm text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {passwordSaving ? "Updating…" : "Update Password"}
                </button>
              </form>
            </section>
          )}

          {active === SECTIONS.WORKFLOW && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-blue-700" />
                <h3 className="text-base font-semibold text-gray-900">Landing Page — Process / Workflow</h3>
              </div>
              <p className="text-sm text-gray-600">
                Manage the timeline steps students see under <span className="font-medium">Process / Workflow</span> on
                the public landing page. The section heading and intro text are fixed; only the steps below can be
                changed.
              </p>

              <form className="space-y-4" onSubmit={handleSaveWorkflow}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#081F5C]/10 bg-[#081F5C]/5 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {workflowDraft.steps.length} timeline step{workflowDraft.steps.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-gray-500">Click a step to edit it. Use the arrows to reorder.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addWorkflowStep}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#081F5C] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0b2b73]"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add step
                  </button>
                </div>

                <div ref={workflowListRef} className="workflow-step-list space-y-3">
                  {workflowDraft.steps.map((step, index) => (
                    <WorkflowStepEditor
                      key={step.id}
                      step={step}
                      index={index}
                      total={workflowDraft.steps.length}
                      isEditing={editingWorkflowStepId === step.id}
                      onStartEdit={() => setEditingWorkflowStepId((currentId) => (currentId === step.id ? null : step.id))}
                      canRemove={workflowDraft.steps.length > 1}
                      onChange={(patch) => updateWorkflowStep(index, patch)}
                      onMoveUp={() => moveWorkflowStep(index, -1)}
                      onMoveDown={() => moveWorkflowStep(index, 1)}
                      onRemove={() => removeWorkflowStep(index)}
                    />
                  ))}
                </div>

                <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap gap-2 rounded-xl border border-[#081F5C]/10 bg-white/95 px-3 py-3 shadow-[0_-8px_24px_-12px_rgba(8,31,92,0.15)] backdrop-blur-sm">
                  <button
                    type="submit"
                    disabled={workflowSaving}
                    className="rounded-lg bg-linear-to-r from-[#04133d] to-[#0b2b73] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {workflowSaving ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetWorkflow}
                    disabled={workflowSaving}
                    className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset to defaults
                  </button>
                </div>
              </form>

              <Dialog open={workflowAlert.open} onOpenChange={(open) => setWorkflowAlert((prev) => ({ ...prev, open }))}>
                <DialogContent className="border border-slate-200 bg-white sm:max-w-md">
                  <DialogHeader className="items-center text-center sm:items-center sm:text-center">
                    <div
                      className={`mb-1 flex size-12 items-center justify-center rounded-full ${
                        workflowAlert.type === "success"
                          ? "bg-green-100 text-green-700"
                          : workflowAlert.type === "error"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {workflowAlert.type === "success" ? (
                        <CheckCircle2 className="size-7" aria-hidden />
                      ) : workflowAlert.type === "error" ? (
                        <XCircle className="size-7" aria-hidden />
                      ) : (
                        <AlertCircle className="size-7" aria-hidden />
                      )}
                    </div>
                    <DialogTitle>{workflowAlert.title}</DialogTitle>
                    <DialogDescription className="text-center">{workflowAlert.message}</DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="sm:justify-center">
                    <button
                      type="button"
                      onClick={() => setWorkflowAlert((prev) => ({ ...prev, open: false }))}
                      className="rounded-md bg-linear-to-r from-[#04133d] to-[#0b2b73] px-4 py-2 text-sm text-white transition hover:brightness-110"
                    >
                      OK
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </section>
          )}

          {active === SECTIONS.NOTIFICATIONS && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-700" />
                <h3 className="text-base font-semibold text-gray-900">Notification Preferences</h3>
              </div>
              <p className="text-sm text-gray-600">
                Choose which alert types appear in the Notification Center and unread badge. Other system notices
                (password changes, announcements) are always shown.
              </p>

              {settingsNotice.message && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {settingsNotice.message}
                </div>
              )}

              <div className="space-y-3">
                <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <span>Notify when new batch is created</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.newBatchCreated}
                    onChange={(event) =>
                      saveSettings(
                        {
                          ...settings,
                          notifications: { ...settings.notifications, newBatchCreated: event.target.checked },
                        },
                        "Notification preferences saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <span>Alert when unclaimed grantees are high</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.unclaimedThresholdAlert}
                    onChange={(event) =>
                      saveSettings(
                        {
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            unclaimedThresholdAlert: event.target.checked,
                          },
                        },
                        "Notification preferences saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <span>Show archive summary reminders</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.archiveSummary}
                    onChange={(event) =>
                      saveSettings(
                        {
                          ...settings,
                          notifications: { ...settings.notifications, archiveSummary: event.target.checked },
                        },
                        "Notification preferences saved.",
                      )
                    }
                  />
                </label>
              </div>
            </section>
          )}

          {active === SECTIONS.LANDING_SETTINGS && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-700" />
                <h3 className="text-base font-semibold text-gray-900">Landing Settings</h3>
              </div>
              <p className="text-sm text-gray-600">
                Manage what visitors see in the public landing page batch list. Changes apply for all visitors once
                saved.
              </p>

              {settingsNotice.message && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    settingsNotice.type === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-green-200 bg-green-50 text-green-700"
                  }`}
                >
                  {settingsNotice.message}
                </div>
              )}

              <div className="space-y-3 rounded-xl border border-[#081F5C]/10 bg-[#081F5C]/5 p-4">
                <p className="text-sm font-semibold text-gray-900">Public Batch List privacy</p>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Mask batch numbers in the public list</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.maskBatchNumberInPublicList}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            maskBatchNumberInPublicList: event.target.checked,
                          },
                        },
                        "Landing page privacy settings saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Hide grantee counts in the public list</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.hideGranteeCountInPublicList}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            hideGranteeCountInPublicList: event.target.checked,
                          },
                        },
                        "Landing page privacy settings saved.",
                      )
                    }
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                <p className="text-sm font-semibold text-gray-900">Batch list display</p>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Show program tags (TES/TDP)</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.showProgramTag}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            showProgramTag: event.target.checked,
                          },
                        },
                        "Landing page settings saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Show academic year badge</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.showAcademicYear}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            showAcademicYear: event.target.checked,
                          },
                        },
                        "Landing page settings saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Show date added label</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.showDateAdded}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            showDateAdded: event.target.checked,
                          },
                        },
                        "Landing page settings saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Show student ID in landing batch list</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.showStudentIdInLandingBatchList}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            showStudentIdInLandingBatchList: event.target.checked,
                          },
                        },
                        "Landing page privacy settings saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Show award number in landing batch list</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.showAwardNumberInLandingBatchList}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            showAwardNumberInLandingBatchList: event.target.checked,
                          },
                        },
                        "Landing page privacy settings saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Show fullname in landing batch list</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.showFullNameInLandingBatchList}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            showFullNameInLandingBatchList: event.target.checked,
                          },
                        },
                        "Landing page privacy settings saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Show enrolled program in landing batch list</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.showEnrolledProgramInLandingBatchList}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            showEnrolledProgramInLandingBatchList: event.target.checked,
                          },
                        },
                        "Landing page privacy settings saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Show year level in landing batch list</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.showYearLevelInLandingBatchList}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            showYearLevelInLandingBatchList: event.target.checked,
                          },
                        },
                        "Landing page privacy settings saved.",
                      )
                    }
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                <p className="text-sm font-semibold text-gray-900">Navigation</p>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Show "View all" button</span>
                  <input
                    type="checkbox"
                    checked={landingSettings.privacy.showViewAllBatchesLink}
                    onChange={(event) =>
                      saveLandingSettings(
                        {
                          ...landingSettings,
                          privacy: {
                            ...landingSettings.privacy,
                            showViewAllBatchesLink: event.target.checked,
                          },
                        },
                        "Landing page settings saved.",
                      )
                    }
                  />
                </label>
              </div>
            </section>
          )}

          {active === SECTIONS.OSGFA_PRIVACY && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-700" />
                <h3 className="text-base font-semibold text-gray-900">OSGFA Privacy</h3>
              </div>
              <p className="text-sm text-gray-600">
                Control privacy behavior for internal OSGFA workspace pages on this device.
              </p>

              {settingsNotice.message && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {settingsNotice.message}
                </div>
              )}

              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                <p className="text-sm font-semibold text-gray-900">OSGFA workspace privacy</p>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Mask student ID in list cards</span>
                  <input
                    type="checkbox"
                    checked={settings.privacy.maskStudentIdInLists}
                    onChange={(event) =>
                      saveSettings(
                        {
                          ...settings,
                          privacy: { ...settings.privacy, maskStudentIdInLists: event.target.checked },
                        },
                        "OSGFA privacy preferences saved.",
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Hide sensitive statistics on shared screens</span>
                  <input
                    type="checkbox"
                    checked={settings.privacy.hideSensitiveStatsFromSharedScreens}
                    onChange={(event) =>
                      saveSettings(
                        {
                          ...settings,
                          privacy: {
                            ...settings.privacy,
                            hideSensitiveStatsFromSharedScreens: event.target.checked,
                          },
                        },
                        "OSGFA privacy preferences saved.",
                      )
                    }
                  />
                </label>
              </div>
            </section>
          )}

          {active === SECTIONS.SUPPORT && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-blue-700" />
                <h3 className="text-base font-semibold text-gray-900">Help Center</h3>
              </div>
              <p className="text-sm text-gray-700">
                For SRMS concerns, coordinate with your school focal person or open the internal support channel for
                TES/TDP reporting issues.
              </p>
              <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Tip: Include batch number and scholarship type when reporting an issue for faster resolution.
              </div>
            </section>
          )}
          </div>
        </div>
      </div>
    </section>
  )
}
