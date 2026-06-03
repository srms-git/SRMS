import { useMemo } from "react"
import { CircleAlert, CircleCheck, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Themed feedback dialog (success, warning, or info).
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, variant?: "success" | "warning" | "info", title?: string, message?: string }} props
 */
export function FeedbackModal({ open, onOpenChange, variant = "info", title, message }) {
  const meta = useMemo(() => {
    if (variant === "success") {
      return {
        Icon: CircleCheck,
        iconWrap: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
        topBar: "from-emerald-500 via-emerald-600 to-teal-600",
        title: title || "Done",
      }
    }
    if (variant === "warning") {
      return {
        Icon: CircleAlert,
        iconWrap: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
        topBar: "from-amber-500 via-orange-500 to-red-500",
        title: title || "Something went wrong",
      }
    }
    return {
      Icon: Info,
      iconWrap: "bg-[#081F5C]/8 text-[#081F5C] ring-[#081F5C]/15 dark:bg-[#081F5C]/20 dark:text-blue-100 dark:ring-[#081F5C]/30",
      topBar: "from-[#04133d] via-[#081F5C] to-[#1447a6]",
      title: title || "Notice",
    }
  }, [variant, title])

  const Icon = meta.Icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative w-[min(92vw,34rem)] max-w-none overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
        <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r ${meta.topBar}`} aria-hidden />
        <DialogHeader className="relative shrink-0 pt-1">
          <DialogTitle className="flex items-center gap-3 text-[#081F5C] dark:text-blue-100">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.iconWrap}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">{meta.title}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">{message || meta.title}</DialogDescription>
        </DialogHeader>

        <div className="py-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {message || "—"}
        </div>

        <DialogFooter className="mt-2 sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)} className="bg-[#081F5C] hover:bg-[#0b2d83]">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
