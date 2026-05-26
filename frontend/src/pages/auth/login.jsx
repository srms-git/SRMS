import { useMemo, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { CheckCircle2, Eye, EyeOff, KanbanSquare, MonitorSmartphone, SquareCheckBig, Loader2 } from "lucide-react"

import authService from "@/services/authService"

import { LandingPublicHeader } from "@/components/LandingPublicHeader"
import orgLogo from "@/assets/orgLogo.png"
import marsuLogo from "@/assets/marsuLogo.png"
import systemLogo from "@/assets/systemLogo.png"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const STATUS_MESSAGES = {
  signup_success: {
    tone: "success",
    text: "Account created! Please check your email for the verification code.",
  },
  verified_pending_approval: {
    tone: "success",
    text: "Email verified! You can now log in to your account.",
  },
  verified: {
    tone: "success",
    text: "Email verified! You can now log in to your account.",
  },
  logged_out: {
    tone: "info",
    text: "You have been logged out.",
  },
  password_reset: {
    tone: "success",
    text: "Password updated successfully. You can now log in.",
  },
}

const ERROR_MESSAGES = {
  missing: "Please fill in all required fields.",
  invalid: "Invalid email or password.",
  mail_error: "Account created, but we couldn't send the OTP. Please contact management.",
}

const showcasePoints = [
  {
    icon: KanbanSquare,
    text: "Centralized project and scholarship monitoring",
  },
  {
    icon: SquareCheckBig,
    text: "Efficient review and record validation workflows",
  },
  {
    icon: MonitorSmartphone,
    text: "Responsive on desktop, tablet, and mobile",
  },
]

const gradientNavyButton = "linear-gradient(135deg, #081F5C 0%, #0b2b73 42%, #1447a6 78%, #2a63cc 100%)"
const loginLogos = [
  { src: orgLogo, alt: "Scholarship Grants and Financial Assistance Office" },
  { src: marsuLogo, alt: "Marinduque State University" },
  { src: systemLogo, alt: "Scholarship Records Management System" },
]

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // --- Logic States ---
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorText, setErrorText] = useState("")
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState("")
  const [forgotSuccess, setForgotSuccess] = useState("")

  const status = searchParams.get("status")
  const error = searchParams.get("error")
  const oldEmail = searchParams.get("email") ?? ""

  const statusMessage = useMemo(() => STATUS_MESSAGES[status], [status])
  const errorMessage = useMemo(() => ERROR_MESSAGES[error], [error])

  // --- Handle Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorText("")

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email")
    const password = formData.get("password")

    try {
      // Calls the authService login method which returns auth state payload
      const response = await authService.login(email, password)
      
      // Extract the role from response object
      const userRole = response?.user?.role || ""

      // Role-Based Dynamic Redirection Route Logic
      if (userRole === "cashier") {
        navigate("/cashier/dashboard")
      } else if (userRole === "osgfa") {
        navigate("/osgfa/dashboard")
      } else {
        // Fallback default routing path if role is missing or generic
        navigate("/osgfa/dashboard")
      }
    } catch (err) {
      // Displays the specific error from the backend or the default message
      setErrorText(err.message || ERROR_MESSAGES.invalid)
    } finally {
      setIsLoading(false)
    }
  }

  const openForgotDialog = () => {
    setForgotOpen(true)
    setForgotError("")
    setForgotSuccess("")
    setForgotEmail(oldEmail)
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotError("")
    setForgotSuccess("")

    try {
      const result = await authService.forgotPassword(forgotEmail)
      setForgotSuccess(
        result.message || "If an account exists for that email, check your inbox for reset instructions.",
      )
    } catch (err) {
      setForgotError(err.message || "Unable to send reset email.")
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-blue-100">
      <LandingPublicHeader />

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-5.5rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-2">
          <section className="hidden p-2 lg:block">
            <div className="flex items-center gap-3">
              {loginLogos.map((logo) => (
                <img
                  key={logo.alt}
                  src={logo.src}
                  alt={logo.alt}
                  className="h-16 w-16 rounded-full bg-white object-contain shadow-sm"
                  decoding="async"
                />
              ))}
            </div>
            <h1 className="mt-4 text-4xl leading-tight font-bold text-slate-900">
              Support educational programs with organized scholarship management
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Log in to access grantee submissions, review workflows, and progress updates in a clean and organized
              workspace.
            </p>

            <div className="mt-8 space-y-3">
              {showcasePoints.map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700 shadow-sm"
                >
                  <Icon className="h-5 w-5 text-blue-700" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <header>
              <p className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Account Access
              </p>
              <h2 className="mt-4 text-3xl font-bold text-slate-900">Welcome back</h2>
              <p className="mt-1 text-sm text-slate-500">Log in to your account</p>
            </header>

            {statusMessage && (
              <div
                className={`mt-5 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  statusMessage.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-sky-200 bg-sky-50 text-sky-700"
                }`}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Fixed Error Display: Shows URL errors OR login attempt errors */}
            {(errorText || errorMessage) && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {errorText || errorMessage}
              </div>
            )}

            {/* Added onSubmit handler */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Email address</span>
                <Input
                  type="email"
                  name="email"
                  placeholder="Enter email address"
                  defaultValue={oldEmail}
                  required
                  autoFocus
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowPassword((prev) => !prev)
                    }}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={openForgotDialog}
                  className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {/* Added disabled state and loading spinner for better UX */}
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="h-10 w-full text-sm font-semibold transition-all active:scale-95" 
                style={{ backgroundImage: gradientNavyButton }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  "Log in"
                )}
              </Button>
            </form>
          </section>
        </div>
      </main>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <p className="inline-flex w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              Account recovery
            </p>
            <DialogTitle className="text-2xl font-bold text-slate-900">Forgot password?</DialogTitle>
            <DialogDescription className="text-slate-500">
              Enter your registered email address and we will send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>

          {forgotSuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {forgotSuccess}
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              {forgotError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {forgotError}
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Email address</span>
                <Input
                  type="email"
                  name="forgotEmail"
                  placeholder="Enter your registered email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  autoFocus
                />
              </label>

              <Button
                type="submit"
                disabled={forgotLoading}
                className="h-10 w-full text-sm font-semibold"
                style={{ backgroundImage: gradientNavyButton }}
              >
                {forgotLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending link...</span>
                  </div>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}