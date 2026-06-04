import { cn } from "@/lib/utils"

/**
 * Fits the full image inside a fixed viewport using object-contain.
 * Portrait gets side margins; landscape gets top/bottom margins.
 */
export function AnnouncementPhoto({
  src,
  alt = "",
  className,
  frameClassName,
  loading = "lazy",
  plain = false,
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center",
        !plain && "bg-slate-100/90",
        frameClassName,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn("max-h-full max-w-full object-contain", className)}
      />
    </div>
  )
}
