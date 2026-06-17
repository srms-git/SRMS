import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react"
import { AnnouncementPhoto } from "@/components/AnnouncementPhoto"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export const ANNOUNCEMENT_LIGHTBOX_VIEW_CLASS =
  "relative flex h-[min(calc(100dvh-7.5rem),calc(100vw-2.5rem),680px)] w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100/90 sm:h-[min(calc(100dvh-8rem),calc(100vw-4rem),680px)]"

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.2

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getTouchDistance(touches) {
  const a = touches[0]
  const b = touches[1]
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

function getTouchCenter(touches) {
  const a = touches[0]
  const b = touches[1]
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
}

function ZoomableLightboxImage({ src, alt = "" }) {
  const viewportRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isGesturing, setIsGesturing] = useState(false)
  const dragRef = useRef(null)
  const pinchRef = useRef(null)
  const lastTapRef = useRef(0)

  const resetTransform = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    resetTransform()
  }, [src, resetTransform])

  const setZoom = useCallback((nextScale) => {
    const clamped = clamp(nextScale, MIN_ZOOM, MAX_ZOOM)
    setScale(clamped)
    if (clamped === 1) setOffset({ x: 0, y: 0 })
  }, [])

  const zoomIn = useCallback(() => {
    setZoom(scale + ZOOM_STEP)
  }, [scale, setZoom])

  const zoomOut = useCallback(() => {
    setZoom(scale - ZOOM_STEP)
  }, [scale, setZoom])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined

    const onWheel = (event) => {
      event.preventDefault()
      const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      setScale((prev) => {
        const next = clamp(prev + delta, MIN_ZOOM, MAX_ZOOM)
        if (next === 1) setOffset({ x: 0, y: 0 })
        return next
      })
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [src])

  const onPointerDown = (event) => {
    if (scale <= 1 || event.pointerType === "touch") return
    viewportRef.current?.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: offset.x,
      baseY: offset.y,
    }
    setIsGesturing(true)
  }

  const onPointerMove = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    const dx = event.clientX - dragRef.current.startX
    const dy = event.clientY - dragRef.current.startY
    setOffset({
      x: dragRef.current.baseX + dx,
      y: dragRef.current.baseY + dy,
    })
  }

  const endPointerDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsGesturing(false)
  }

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined

    const onTouchStart = (event) => {
      if (event.touches.length === 2) {
        pinchRef.current = {
          distance: getTouchDistance(event.touches),
          startScale: scale,
          startOffset: { ...offset },
          center: getTouchCenter(event.touches),
        }
        dragRef.current = null
        setIsGesturing(true)
      } else if (event.touches.length === 1 && scale > 1) {
        dragRef.current = {
          pointerId: "touch",
          startX: event.touches[0].clientX,
          startY: event.touches[0].clientY,
          baseX: offset.x,
          baseY: offset.y,
        }
        setIsGesturing(true)
      }
    }

    const onTouchMove = (event) => {
      if (event.touches.length === 2 && pinchRef.current) {
        event.preventDefault()
        const distance = getTouchDistance(event.touches)
        const ratio = distance / pinchRef.current.distance
        const nextScale = clamp(pinchRef.current.startScale * ratio, MIN_ZOOM, MAX_ZOOM)
        setScale(nextScale)
        if (nextScale === 1) {
          setOffset({ x: 0, y: 0 })
        }
      } else if (event.touches.length === 1 && dragRef.current?.pointerId === "touch") {
        event.preventDefault()
        const touch = event.touches[0]
        const dx = touch.clientX - dragRef.current.startX
        const dy = touch.clientY - dragRef.current.startY
        setOffset({
          x: dragRef.current.baseX + dx,
          y: dragRef.current.baseY + dy,
        })
      }
    }

    const onTouchEnd = (event) => {
      if (event.touches.length < 2) pinchRef.current = null
      if (event.touches.length === 0) {
        dragRef.current = null
        setIsGesturing(false)

        const now = Date.now()
        if (now - lastTapRef.current < 300) {
          if (scale > 1) resetTransform()
          else setZoom(2)
          lastTapRef.current = 0
        } else {
          lastTapRef.current = now
        }
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd, { passive: true })
    el.addEventListener("touchcancel", onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [offset, resetTransform, scale, setZoom])

  const onDoubleClick = () => {
    if (scale > 1) resetTransform()
    else setZoom(2)
  }

  return (
    <div className={ANNOUNCEMENT_LIGHTBOX_VIEW_CLASS}>
      <div
        ref={viewportRef}
        className={cn(
          "relative h-full w-full touch-none select-none overflow-hidden",
          scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
        onDoubleClick={onDoubleClick}
      >
        <div
          className={cn(
            "flex h-full w-full items-center justify-center",
            !isGesturing && "transition-transform duration-150 ease-out",
          )}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        </div>
      </div>

      <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white/95 p-0.5 shadow-sm ring-1 ring-slate-200 sm:bottom-3 sm:gap-1 sm:p-1">
        <button
          type="button"
          onClick={zoomOut}
          disabled={scale <= MIN_ZOOM}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-[2.75rem] text-center text-[11px] font-semibold tabular-nums text-slate-600 sm:text-xs">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={scale >= MAX_ZOOM}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        {scale > 1 ? (
          <button
            type="button"
            onClick={resetTransform}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 sm:h-8 sm:w-8"
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
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
  variant,
  stripHeightClass,
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
  const resolvedStripHeightClass = stripHeightClass ?? "h-36 sm:h-40"
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
            !isSingleLarge && resolvedStripHeightClass,
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
          className="w-[calc(100vw-1rem)] max-h-[min(calc(100dvh-1rem),92vh)] gap-2 overflow-x-hidden overflow-y-auto border border-slate-200 bg-white p-2 shadow-xl sm:w-full sm:max-w-[min(calc(100vw-2rem),47.5rem)] sm:gap-3 sm:p-4"
        >
          <div className="relative min-w-0 w-full touch-manipulation">
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-1 right-1 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-200 sm:top-2 sm:right-2 sm:h-9 sm:w-9"
              aria-label="Close gallery"
            >
              <X className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" />
            </button>

            <ZoomableLightboxImage
              key={urls[lightboxIndex]}
              src={urls[lightboxIndex]}
              alt=""
            />

            {urls.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => goLightbox(-1)}
                  className="absolute top-1/2 left-1 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-white sm:left-3 sm:h-9 sm:w-9"
                  aria-label="Previous picture"
                >
                  <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => goLightbox(1)}
                  className="absolute top-1/2 right-1 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-white sm:right-3 sm:h-9 sm:w-9"
                  aria-label="Next picture"
                >
                  <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
                </button>
              </>
            ) : null}
          </div>

          {urls.length > 1 ? (
            <p className="text-center text-xs font-medium text-slate-500 tabular-nums sm:text-sm">
              {lightboxIndex + 1} / {urls.length}
            </p>
          ) : null}
          <p className="text-center text-[10px] text-slate-400 sm:text-xs">
            Pinch or scroll to zoom · double-tap to toggle · drag when zoomed
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
