import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import authService from "@/services/authService"
import landingLogo from "@/assets/landingpageLogo.png"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const navy = "#081F5C"
const borderNavySoft = "rgba(8, 31, 92, 0.12)"
const gradientNavyButton = "linear-gradient(135deg, #081F5C 0%, #0b2b73 42%, #1447a6 78%, #2a63cc 100%)"

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = searchParams.get("token") ?? ""
  const email = searchParams.get("email") ?? ""

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorText, setErrorText] = useState("")
  const [successText, setSuccessText] = useState("")

  const linkInvalid = useMemo(() => !token || !email, [token, email])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorText("")
    setSuccessText("")

    const formData = new FormData(e.currentTarget)
    const password = formData.get("password")
    const confirmPassword = formData.get("confirmPassword")

    if (password !== confirmPassword) {
      setErrorText("Passwords do not match.")
      return
    }

    if (String(password).length < 8) {
      setErrorText("Password must be at least 8 characters.")
      return
    }

    setIsLoading(true)

    try {
      const result = await authService.resetPassword({ email, token, password })
      setSuccessText(result.message || "Password updated successfully.")
      setTimeout(() => {
        navigate("/login?status=password_reset")
      }, 1500)
    } catch (err) {
      setErrorText(err.message || "Password reset failed.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-blue-100">
      <header
        className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur-md"
        style={{ borderColor: borderNavySoft }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center" aria-label="SRMS home">
            <img
              src={landingLogo}
              alt="Scholarship Records Management System"
              className="h-9 w-auto max-h-11 max-w-[min(72vw,260px)] object-contain object-left sm:h-11"
              decoding="async"
            />
          </Link>
          <Button
            variant="outline"
            className="bg-white transition hover:bg-white"
            style={{ borderColor: borderNavySoft, color: navy }}
            asChild
          >
            <Link to="/login">Back to login</Link>
          </Button>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-8 sm:px-6">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <header>
            <p className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              Password Reset
            </p>
            <h1 className="mt-4 text-3xl font-bold text-slate-900">Set a new password</h1>
            <p className="mt-1 text-sm text-slate-500">Choose a strong password for your account.</p>
          </header>

          {linkInvalid ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                This reset link is invalid or incomplete. Please request a new one from the login page.
              </div>
              <Button className="h-10 w-full text-sm font-semibold" style={{ backgroundImage: gradientNavyButton }} asChild>
                <Link to="/login">Go to login</Link>
              </Button>
            </div>
          ) : (
            <>
              {successText && (
                <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {successText}
                </div>
              )}

              {errorText && (
                <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {errorText}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Email address</span>
                  <Input type="email" value={email} readOnly className="bg-slate-50" />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">New password</span>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Enter new password"
                      required
                      minLength={8}
                      className="pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Confirm password</span>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm new password"
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((prev) => !prev)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <Button
                  type="submit"
                  disabled={isLoading || Boolean(successText)}
                  className="h-10 w-full text-sm font-semibold transition-all active:scale-95"
                  style={{ backgroundImage: gradientNavyButton }}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating password...</span>
                    </div>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
