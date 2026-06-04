import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { AnnouncementPhoto } from "@/components/AnnouncementPhoto"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export const ANNOUNCEMENT_LIGHTBOX_VIEW_CLASS =
  "flex h-[min(78vh,680px)] w-[min(92vw,720px)] items-center justify-center overflow-hidden rounded-lg bg-slate-100/90"

function AnnouncementLightboxImage({ src, alt = "" }) {
  return (
    <div className={ANNOUNCEMENT_LIGHTBOX_VIEW_CLASS}>
      <AnnouncementPhoto src={src} alt={alt} plain loading="eager" frameClassName="h-full w-full" />
    </div>
  )
}

export function AnnouncementPhotoFrame({
  url,
  alt = "",
  overflowCount = 0,
  onClick,
  className,
  compact = false,
  interactive = true,
  borderless = false,
}) {
  const Tag = interactive ? "button" : "div"

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={interactive ? onClick : undefined}
      className={cn(
        "group relative min-h-0 min-w-0 overflow-hidden",
        borderless
          ? "bg-transparent"
          : "rounded-lg bg-slate-100 ring-1 ring-slate-200/90",
        interactive &&
          !borderless &&
          "cursor-pointer transition hover:ring-slate-300 hover:shadow-sm",
        interactive && borderless && "cursor-pointer transition hover:opacity-95",
        className,
      )}
    >
      <AnnouncementPhoto src={url} alt={alt} plain frameClassName="h-full w-full" />
      {overflowCount > 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <span
            className={cn(
              "font-semibold text-white drop-shadow-sm",
              compact ? "text-base sm:text-lg" : "text-lg sm:text-xl",
            )}
          >
            +{overflowCount}
          </span>
        </div>
      ) : null}
    </Tag>
  )
}

/**
 * layout "strip" — equal-height row for cards & landing
 * layout "grid" — grid for form upload previews
 */
export function AnnouncementImageGallery({
  urls = [],
  className,
  frameClassName,
  maxVisible = 3,
  compact = false,
  layout = "strip",
  stripHeightClass = "h-36 sm:h-40",
  borderless = false,
  singleLarge = false,
  singleFullWidth = false,
  onIndexChange,
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  useEffect(() => {
    setLightboxIndex(0)
  }, [urls])

  const frames = useMemo(() => {
    if (!urls.length) return []

    const visibleCount = Math.min(urls.length, maxVisible)
    const overflowCount = urls.length > maxVisible ? urls.length - maxVisible : 0

    return Array.from({ length: visibleCount }, (_, slotIndex) => {
      const isLastSlot = slotIndex === visibleCount - 1
      return {
        url: urls[slotIndex],
        index: slotIndex,
        overflowCount: isLastSlot ? overflowCount : 0,
      }
    })
  }, [maxVisible, urls])

  if (!urls.length) return null

  const openLightbox = (index) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
    onIndexChange?.(index)
  }

  const goLightbox = (direction) => {
    setLightboxIndex((prev) => {
      const next = (prev + direction + urls.length) % urls.length
      onIndexChange?.(next)
      return next
    })
  }

  const isStrip = layout === "strip"
  const gapClass = compact ? "gap-2" : "gap-2.5 sm:gap-3"
  const isSingleLarge = singleLarge && frames.length === 1
  const isSingleFullWidth = singleFullWidth && frames.length === 1 && !isSingleLarge
  const useBorderless = borderless || isSingleLarge

  return (
    <>
      {isStrip ? (
        <div
          className={cn(
            "flex w-full items-stretch",
            gapClass,
            isSingleLarge ? "h-full min-h-0 justify-stretch" : "justify-center",
            !isSingleLarge && stripHeightClass,
            frameClassName,
            className,
          )}
        >
          {frames.map((frame) => (
            <AnnouncementPhotoFrame
              key={`${frame.url}-${frame.index}`}
              url={frame.url}
              alt=""
              overflowCount={frame.overflowCount}
              compact={compact}
              borderless={useBorderless}
              onClick={() => openLightbox(frame.index)}
              className={cn(
                "h-full",
                isSingleLarge && "w-full max-w-none flex-1",
                isSingleFullWidth && "w-full max-w-full",
                !isSingleLarge &&
                  !isSingleFullWidth &&
                  frames.length === 1 &&
                  "w-full max-w-[min(100%,14rem)]",
                frames.length === 2 && "max-w-[calc(50%-0.35rem)] flex-1",
                frames.length >= 3 && "max-w-[calc(33.333%-0.5rem)] flex-1",
              )}
            />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "grid w-full gap-3 sm:gap-4",
            frames.length === 1 && "grid-cols-1",
            frames.length === 2 && "grid-cols-2",
            frames.length >= 3 && "grid-cols-2 sm:grid-cols-3",
            frameClassName,
            className,
          )}
        >
          {frames.map((frame) => (
            <AnnouncementPhotoFrame
              key={`${frame.url}-${frame.index}`}
              url={frame.url}
              alt=""
              overflowCount={frame.overflowCount}
              compact={compact}
              onClick={() => openLightbox(frame.index)}
              className="aspect-[3/4] w-full"
            />
          ))}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          showCloseButton={false}
          className="gap-3 border border-slate-200 bg-white p-4 shadow-xl sm:max-w-[760px]"
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-2 right-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-200"
              aria-label="Close gallery"
            >
              <X className="h-4 w-4" />
            </button>

            <AnnouncementLightboxImage
              key={urls[lightboxIndex]}
              src={urls[lightboxIndex]}
              alt=""
            />

            {urls.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => goLightbox(-1)}
                  className="absolute top-1/2 left-3 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
                  aria-label="Previous picture"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => goLightbox(1)}
                  className="absolute top-1/2 right-3 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
                  aria-label="Next picture"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>

          {urls.length > 1 ? (
            <p className="text-center text-xs font-medium text-slate-500 tabular-nums">
              {lightboxIndex + 1} / {urls.length}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
