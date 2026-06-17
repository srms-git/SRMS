import { useState } from "react"
import { HelpCircle, Loader2, MessageSquarePlus, Send } from "lucide-react"
import { getHelpCenterIntro, SUPPORT_TICKET_TYPES } from "@/lib/supportMockData"
import { cn } from "@/lib/utils"

const EMPTY_TICKET = {
  type: "report",
  subject: "",
  description: "",
}

export default function HelpCenterPanel({ workspace = "cashier" }) {
  const intro = getHelpCenterIntro(workspace)
  const [ticketForm, setTicketForm] = useState(EMPTY_TICKET)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState({ type: "", message: "" })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setNotice({ type: "", message: "" })

    if (!ticketForm.subject.trim()) {
      setNotice({ type: "error", message: "Subject is required." })
      return
    }
    if (!ticketForm.description.trim()) {
      setNotice({ type: "error", message: "Please describe your report, suggestion, or request." })
      return
    }

    setSubmitting(true)
    try {
      // Placeholder until support ticket API is connected.
      await new Promise((resolve) => setTimeout(resolve, 700))
      setTicketForm(EMPTY_TICKET)
      setNotice({
        type: "success",
        message:
          "Ticket saved locally for preview. Backend submission will be connected later—your message was not sent to support yet.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-blue-700" />
          <h3 className="text-base font-semibold text-gray-900">Help Center</h3>
        </div>
        <p className="mt-1 text-sm text-gray-700">{intro.summary}</p>
        <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {intro.tip}
        </div>
      </div>

      <div className="rounded-xl border border-[#081F5C]/10 bg-[#081F5C]/5 p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#081F5C] text-white shadow-sm">
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Submit a support ticket</h4>
            <p className="text-xs text-gray-600">
              Report a problem, share a suggestion, or request something you need from the SRMS team.
            </p>
          </div>
        </div>

        {notice.message && (
          <div
            className={cn(
              "mb-4 rounded-md border px-3 py-2 text-sm",
              notice.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {notice.message}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor={`support-ticket-type-${workspace}`} className="mb-1 block text-xs text-gray-600">
              Ticket type
            </label>
            <select
              id={`support-ticket-type-${workspace}`}
              value={ticketForm.type}
              onChange={(event) => setTicketForm((prev) => ({ ...prev, type: event.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {SUPPORT_TICKET_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`support-ticket-subject-${workspace}`} className="mb-1 block text-xs text-gray-600">
              Subject
            </label>
            <input
              id={`support-ticket-subject-${workspace}`}
              type="text"
              value={ticketForm.subject}
              onChange={(event) => setTicketForm((prev) => ({ ...prev, subject: event.target.value }))}
              maxLength={120}
              placeholder="Brief summary of your concern"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor={`support-ticket-description-${workspace}`} className="mb-1 block text-xs text-gray-600">
              Details
            </label>
            <textarea
              id={`support-ticket-description-${workspace}`}
              rows={5}
              value={ticketForm.description}
              onChange={(event) => setTicketForm((prev) => ({ ...prev, description: event.target.value }))}
              maxLength={2000}
              placeholder="Describe what happened, what you expected, and any batch or grantee details that may help."
              className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-right text-[11px] text-gray-400">{ticketForm.description.length}/2000</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Submission is preview-only until the support service is connected.</p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-linear-to-r from-[#04133d] to-[#0b2b73] px-4 py-2 text-sm text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden />
                  Submit ticket
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
