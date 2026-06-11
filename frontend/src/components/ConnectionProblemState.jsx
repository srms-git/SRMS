import { useMemo } from "react"
import { CircleAlert, RefreshCw, ServerOff, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { resolveFetchErrorDisplay } from "@/lib/networkErrorMessages"
import { cn } from "@/lib/utils"

const KIND_STYLES = {
  offline: {
    Icon: WifiOff,
    shell:
      "border-amber-200/90 bg-amber-50/80 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50",
    iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
    message: "text-amber-900/90 dark:text-amber-100/90",
    button: "border-amber-300/80 hover:bg-amber-100/80 dark:border-amber-500/40 dark:hover:bg-amber-500/15",
  },
  server: {
    Icon: ServerOff,
    shell:
      "border-amber-200/90 bg-amber-50/80 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50",
    iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
    message: "text-amber-900/90 dark:text-amber-100/90",
    button: "border-amber-300/80 hover:bg-amber-100/80 dark:border-amber-500/40 dark:hover:bg-amber-500/15",
  },
  other: {
    Icon: CircleAlert,
    shell:
      "border-red-200/90 bg-red-50/80 text-red-950 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-50",
    iconWrap: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-200",
    message: "text-red-800/90 dark:text-red-100/90",
    button: "border-red-200 hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/15",
  },
}

/**
 * Friendly load-failure state for connection issues (amber) and other errors (red).
 */
export function ConnectionProblemState({
  error,
  onRetry,
  subject,
  variant = "banner",
  className,
  style,
}) {
  const isOnline = useOnlineStatus()
  const display = useMemo(
    () => resolveFetchErrorDisplay(error, { subject }),
    [error, subject, isOnline],
  )
  const styles = KIND_STYLES[display.kind] ?? KIND_STYLES.other
  const Icon = styles.Icon

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center",
          styles.shell,
          className,
        )}
        style={style}
        role="alert"
      >
        <span
          className={cn(
            "inline-flex h-12 w-12 items-center justify-center rounded-xl",
            styles.iconWrap,
          )}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-semibold">{display.title}</p>
        <p className={cn("mt-2 max-w-md text-sm leading-relaxed", styles.message)}>
          {display.message}
        </p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            className={cn("mt-6 gap-2", styles.button)}
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {display.actionLabel}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn("rounded-xl border px-4 py-3 text-sm", styles.shell, className)}
      style={style}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            styles.iconWrap,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{display.title}</p>
          <p className={cn("mt-1 text-[13px] leading-relaxed", styles.message)}>
            {display.message}
          </p>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("mt-3 h-8 gap-1.5 px-3 text-xs", styles.button)}
              onClick={onRetry}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {display.actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
