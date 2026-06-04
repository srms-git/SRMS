import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bell,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Lock,
  Settings as SettingsIcon,
  Shield,
  User,
} from "lucide-react"
import PasswordField from "@/components/PasswordField"
import AuditLogsPanel from "@/components/settings/AuditLogsPanel"
import {
  CASHIER_SETTINGS_CHANGED_EVENT,
  readStoredSettings,
  writeStoredSettings,
} from "@/lib/cashierSettings"
import authService from "@/services/authService"
import { SettingsPageSkeleton, useContentReveal } from "@/lib/osgfaContentReveal"
import { cn } from "@/lib/utils"

const SECTIONS = {
  PROFILE: "profile",
  PASSWORD: "password",
  NOTIFICATIONS: "notifications",
  PRIVACY: "privacy",
  SUPPORT: "support",
  AUDIT_LOGS: "audit-logs",
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
  const role = String(user?.role ?? "cashier").toLowerCase()
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
    role: user?.role || "cashier",
  }
}

export default function CashierSetting() {
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
  const [privacySaving, setPrivacySaving] = useState(false)
  const [profileNotice, setProfileNotice] = useState({ type: "", message: "" })
  const [passwordNotice, setPasswordNotice] = useState({ type: "", message: "" })
  const [settingsNotice, setSettingsNotice] = useState({ type: "", message: "" })

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
        setSettings(readStoredSettings())
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
    window.addEventListener(CASHIER_SETTINGS_CHANGED_EVENT, syncSettings)
    window.addEventListener("storage", syncSettings)
    return () => {
      window.removeEventListener(CASHIER_SETTINGS_CHANGED_EVENT, syncSettings)
      window.removeEventListener("storage", syncSettings)
    }
  }, [])

  const { contentRevealed, skeletonLeaving } = useContentReveal(profileLoading)

  const displayName = useMemo(() => getUserDisplayName(user), [user])
  const initials = useMemo(() => getUserInitial(user), [user])
  const roleLabel = useMemo(() => getUserRoleLabel(user), [user])

  const saveSettings = (updater, noticeMessage = "System settings saved.") => {
    setSettings((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      writeStoredSettings(next)
      return next
    })
    setSettingsNotice({ type: "success", message: noticeMessage })
  }

  const savePrivacySettings = async (updater, noticeMessage = "Privacy preferences saved.") => {
    const previous = settings
    const next = typeof updater === "function" ? updater(previous) : updater

    setSettings(next)
    writeStoredSettings(next)
    setPrivacySaving(true)
    setSettingsNotice({ type: "", message: "" })

    try {
      await authService.updateCashierPrivacy(next.privacy)
      setSettingsNotice({ type: "success", message: noticeMessage })
    } catch (error) {
      setSettings(previous)
      writeStoredSettings(previous)
      setSettingsNotice({
        type: "error",
        message: error.message || "Unable to save privacy preferences.",
      })
    } finally {
      setPrivacySaving(false)
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
                <h2 className="truncate text-xl font-bold">Cashier Settings</h2>
                <p className="truncate text-xs text-sky-100/90">
                  Manage your account, security, and cashier workspace preferences.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          {(profileLoading || skeletonLeaving) && (
            <div
              className={cn(
                "transition-opacity duration-300 ease-out motion-reduce:transition-none",
                !profileLoading && "pointer-events-none absolute inset-0 z-0 opacity-0",
              )}
              aria-busy={profileLoading}
              aria-hidden={!profileLoading}
              aria-label="Loading settings"
            >
              <SettingsPageSkeleton />
            </div>
          )}

          {!profileLoading && (
        <div
          className={cn(
            "relative z-10 grid min-h-0 flex-1 items-stretch grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]",
            "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
            contentRevealed ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
        >
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
                        active === SECTIONS.PROFILE
                          ? "font-semibold text-[#081F5C]"
                          : "text-gray-700 hover:text-[#081F5C]"
                      }`}
                    >
                      Profile Information
                    </button>
                    <button
                      type="button"
                      onClick={() => setActive(SECTIONS.PASSWORD)}
                      className={`block w-full rounded-md py-1 text-left transition ${
                        active === SECTIONS.PASSWORD
                          ? "font-semibold text-[#081F5C]"
                          : "text-gray-700 hover:text-[#081F5C]"
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
                      onClick={() => setActive(SECTIONS.NOTIFICATIONS)}
                      className={`block w-full rounded-md py-1 text-left transition ${
                        active === SECTIONS.NOTIFICATIONS
                          ? "font-semibold text-[#081F5C]"
                          : "text-gray-700 hover:text-[#081F5C]"
                      }`}
                    >
                      Notifications
                    </button>
                    <button
                      type="button"
                      onClick={() => setActive(SECTIONS.PRIVACY)}
                      className={`block w-full rounded-md py-1 text-left transition ${
                        active === SECTIONS.PRIVACY
                          ? "font-semibold text-[#081F5C]"
                          : "text-gray-700 hover:text-[#081F5C]"
                      }`}
                    >
                      Privacy
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
                        active === SECTIONS.SUPPORT
                          ? "font-semibold text-[#081F5C]"
                          : "text-gray-700 hover:text-[#081F5C]"
                      }`}
                    >
                      Help Center
                    </button>
                    <button
                      type="button"
                      onClick={() => setActive(SECTIONS.AUDIT_LOGS)}
                      className={`block w-full rounded-md py-1 text-left transition ${
                        active === SECTIONS.AUDIT_LOGS
                          ? "font-semibold text-[#081F5C]"
                          : "text-gray-700 hover:text-[#081F5C]"
                      }`}
                    >
                      Audit Logs
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
                        Code sent to <span className="font-medium text-gray-800">{otpEmail || user?.email}</span>.
                        Expires in 10 minutes.
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
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
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

            {active === SECTIONS.NOTIFICATIONS && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-700" />
                  <h3 className="text-base font-semibold text-gray-900">Notification Preferences</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Choose which alert types appear in the Notification Center and unread badge. Other system notices
                  (password changes, reminders) are always shown.
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
                          (prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, newBatchCreated: event.target.checked },
                          }),
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
                          (prev) => ({
                            ...prev,
                            notifications: {
                              ...prev.notifications,
                              unclaimedThresholdAlert: event.target.checked,
                            },
                          }),
                          "Notification preferences saved.",
                        )
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                    <span>Show claim and disbursement activity alerts</span>
                    <input
                      type="checkbox"
                      checked={settings.notifications.claimActivityAlert}
                      onChange={(event) =>
                        saveSettings(
                          (prev) => ({
                            ...prev,
                            notifications: {
                              ...prev.notifications,
                              claimActivityAlert: event.target.checked,
                            },
                          }),
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
                          (prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, archiveSummary: event.target.checked },
                          }),
                          "Notification preferences saved.",
                        )
                      }
                    />
                  </label>
                </div>
              </section>
            )}

            {active === SECTIONS.PRIVACY && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-700" />
                  <h3 className="text-base font-semibold text-gray-900">Privacy and Display</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Control how grantee identifiers and summary counts appear across cashier grantee lists, record cards,
                  claim history, and dashboard stat panels. Preferences are saved to your account and sync across devices.
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

                <div className="space-y-3">
                  <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                    <span>Mask student ID in list cards</span>
                    <input
                      type="checkbox"
                      disabled={privacySaving}
                      checked={settings.privacy.maskStudentIdInLists}
                      onChange={(event) =>
                        savePrivacySettings((prev) => ({
                          ...prev,
                          privacy: { ...prev.privacy, maskStudentIdInLists: event.target.checked },
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                    <span>Hide sensitive statistics on shared screens</span>
                    <input
                      type="checkbox"
                      disabled={privacySaving}
                      checked={settings.privacy.hideSensitiveStatsFromSharedScreens}
                      onChange={(event) =>
                        savePrivacySettings((prev) => ({
                          ...prev,
                          privacy: {
                            ...prev.privacy,
                            hideSensitiveStatsFromSharedScreens: event.target.checked,
                          },
                        }))
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
                  For SRMS cashier concerns, coordinate with your school focal person or the OSGFA office for batch,
                  claim, and disbursement issues.
                </p>
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Tip: Include batch number, grantee name, and claim date when reporting an issue for faster resolution.
                </div>
              </section>
            )}

            {active === SECTIONS.AUDIT_LOGS && <AuditLogsPanel workspaceLabel="cashier" scope="cashier" />}
          </div>
        </div>
          )}
        </div>
      </div>
    </section>
  )
}
