import { useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Edit3,
  EyeOff,
  ImagePlus,
  Megaphone,
  MoreHorizontal,
  Newspaper,
  Plus,
  Radio,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"
import {
  AnnouncementImageGallery,
  AnnouncementPhotoFrame,
} from "@/components/AnnouncementImageGallery"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import apiClient from "@/lib/apiClient"
import {
  formatAnnouncementDurationLabel,
  getAnnouncementScheduleStatus,
  getMinimumEndDate,
  getTodayDateString,
  normalizeAnnouncementRecord,
  resolveAnnouncementDates,
  validateAnnouncementDurationInput,
} from "@/lib/announcementDates"
import {
  draftImagesToUploadFiles,
  MAX_ANNOUNCEMENT_IMAGES,
  normalizeAnnouncementImages,
} from "@/lib/announcementImages"
import {
  AnnouncementCardSkeleton,
  SummaryStatCardSkeleton,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"
import {
  ANNOUNCEMENT_TYPE_FILTER_OPTIONS,
  getAnnouncementTypeLabel,
  isOtherAnnouncementType,
} from "@/lib/announcementTypes"
import { cn } from "@/lib/utils"

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

const PAGE_SIZE = 3
const MAX_ANNOUNCEMENT_IMAGE_BYTES = 2 * 1024 * 1024
const ANNOUNCEMENT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

function validateAnnouncementImageFile(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Please choose a JPEG, PNG, WebP, or GIF image.")
  }
  if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
    throw new Error("Image must be 2 MB or smaller.")
  }
}

function revokeBlobPreviewUrl(url) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

function revokeDraftImagePreviews(images) {
  for (const image of images) {
    if (!image.isExisting) {
      revokeBlobPreviewUrl(image.previewUrl)
    }
  }
}

function buildAnnouncementFormData({
  title,
  description,
  type,
  customType,
  startDate,
  endDate,
  active,
  imageFiles = [],
  clearExistingImages,
}) {
  const formData = new FormData()
  formData.append("title", title)
  formData.append("description", description)
  formData.append("type", type)
  if (isOtherAnnouncementType(type)) {
    formData.append("customType", customType.trim())
  }
  formData.append("startDate", startDate)
  formData.append("endDate", endDate)
  if (active !== undefined) {
    formData.append("active", active ? "true" : "false")
  }
  for (const file of imageFiles) {
    formData.append("images", file)
  }
  if (clearExistingImages) {
    formData.append("clearExistingImages", "true")
  }
  return formData
}

function saveAnnouncementWithFormData(method, url, formData) {
  return apiClient.request({
    method,
    url,
    data: formData,
    transformRequest: [
      (data, headers) => {
        delete headers["Content-Type"]
        return data
      },
    ],
  })
}

const DATE_RANGE_OPTIONS = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
]

function isDateInRange(value, rangeKey) {
  if (!value || !rangeKey) return true
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return false

  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const start = startOfDay(now)
  const end = new Date(start)

  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1)
  const firstDayOfLastYear = new Date(now.getFullYear() - 1, 0, 1)
  const lastDayOfLastYear = new Date(now.getFullYear() - 1, 11, 31)

  const dayOfWeek = start.getDay()
  const startOfThisWeek = new Date(start)
  startOfThisWeek.setDate(start.getDate() - ((dayOfWeek + 6) % 7))
  const endOfThisWeek = new Date(startOfThisWeek)
  endOfThisWeek.setDate(startOfThisWeek.getDate() + 6)

  const startOfLastWeek = new Date(startOfThisWeek)
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7)
  const endOfLastWeek = new Date(startOfThisWeek)
  endOfLastWeek.setDate(startOfThisWeek.getDate() - 1)

  const rangeStart = new Date(0)
  const rangeEnd = new Date(0)

  switch (rangeKey) {
    case "this_week":
      rangeStart.setTime(startOfThisWeek.getTime())
      rangeEnd.setTime(endOfThisWeek.getTime())
      break
    case "last_week":
      rangeStart.setTime(startOfLastWeek.getTime())
      rangeEnd.setTime(endOfLastWeek.getTime())
      break
    case "this_month":
      rangeStart.setTime(firstDayOfMonth.getTime())
      rangeEnd.setTime(new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime())
      break
    case "last_month":
      rangeStart.setTime(firstDayOfLastMonth.getTime())
      rangeEnd.setTime(lastDayOfLastMonth.getTime())
      break
    case "this_year":
      rangeStart.setTime(firstDayOfYear.getTime())
      rangeEnd.setTime(new Date(now.getFullYear(), 11, 31).getTime())
      break
    case "last_year":
      rangeStart.setTime(firstDayOfLastYear.getTime())
      rangeEnd.setTime(lastDayOfLastYear.getTime())
      break
    default:
      return true
  }

  return date >= rangeStart && date <= rangeEnd
}

function SummaryStatCard({ label, value, accentBar, glow, iconBg, Icon, className, style }) {
  return (
    <div
      className={cn(
        `group relative min-h-[124px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 dark:border-white/10 dark:bg-slate-900/40 dark:ring-white/6 ${accentBar}`,
        className,
      )}
      style={style}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-60 ${glow}`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1 pr-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-black/4 dark:ring-white/10 ${iconBg}`}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      </div>
    </div>
  )
}

function paginateList(items, page) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * PAGE_SIZE
  return {
    page: safePage,
    pageCount,
    items: items.slice(start, start + PAGE_SIZE),
  }
}

function AnnouncementSectionPagination({ page, pageCount, total, onPageChange, noun = "announcement" }) {
  if (total <= PAGE_SIZE) return null

  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)
  const plural = total === 1 ? noun : `${noun}s`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
      <p className="text-slate-600">
        Showing{" "}
        <span className="font-semibold text-[#081F5C]">
          {start}-{end}
        </span>{" "}
        of <span className="font-semibold text-slate-900">{total}</span> {plural}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 shadow-sm transition hover:border-[#081F5C]/30 hover:text-[#081F5C] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>
        <span className="tabular-nums text-slate-600">
          Page <span className="font-semibold text-[#081F5C]">{page}</span> / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 shadow-sm transition hover:border-[#081F5C]/30 hover:text-[#081F5C] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function AnnouncementsEmptyState({ variant, errorMessage, onClearFilters, onCreate, onRetry, className, style }) {
  if (variant === "error") {
    return (
      <div
        className={cn(
          "flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-red-200/80 bg-red-50/50 px-6 py-12 text-center",
          className,
        )}
        style={style}
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <Megaphone className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-semibold text-slate-900">Couldn&apos;t load announcements</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          {errorMessage || "Something went wrong while fetching the list. Check your connection and try again."}
        </p>
        <Button type="button" variant="outline" className="mt-6" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  }

  if (variant === "filtered") {
    return (
      <div
        className={cn(
          "flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-slate-900/40",
          className,
        )}
        style={style}
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
          <SearchX className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No matching announcements</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Nothing matches your current search or filters. Try different keywords, or reset the filters to see all
          announcements.
        </p>
        <Button type="button" variant="outline" className="mt-6" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-slate-900/40",
        className,
      )}
      style={style}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#081F5C]/8 text-[#081F5C] dark:bg-[#1447a6]/20 dark:text-sky-200">
        <Megaphone className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No announcements yet</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Publish notices for new batches, requirement schedules, payouts, and other updates. They appear on the landing
        page while active and within their date range.
      </p>
      <Button type="button" className="mt-6 bg-[#081F5C] hover:bg-[#0b2d83]" onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" aria-hidden />
        Create announcement
      </Button>
    </div>
  )
}

function AnnouncementSectionEmpty({ message, variant = "active" }) {
  const isActive = variant === "active"
  return (
    <div
      className={cn(
        "flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center",
        isActive ? "border-[#081F5C]/20 bg-[#081F5C]/5" : "border-slate-200 bg-slate-50/80",
      )}
    >
      <span
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-lg",
          isActive ? "bg-[#081F5C]/10 text-[#081F5C]" : "bg-slate-200/80 text-slate-500",
        )}
      >
        {isActive ? <Radio className="h-5 w-5" aria-hidden /> : <EyeOff className="h-5 w-5" aria-hidden />}
      </span>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">{message}</p>
    </div>
  )
}

function AnnouncementSectionHeader({ title, description, count, variant }) {
  const isActive = variant === "active"
  return (
    <div
      className={`rounded-2xl border px-4 py-3 shadow-sm ring-1 ring-slate-900/3 ${
        isActive
          ? "border-[#081F5C]/15 bg-linear-to-r from-[#081F5C]/6 via-white to-white"
          : "border-slate-200/80 bg-linear-to-r from-slate-100/90 via-white to-white"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-black/4 ${
            isActive
              ? "bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
              : "bg-linear-to-br from-slate-400 to-slate-600 text-white"
          }`}
          aria-hidden
        >
          {isActive ? <Radio className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                isActive ? "bg-[#081F5C]/10 text-[#081F5C]" : "bg-slate-200/80 text-slate-700"
              }`}
            >
              {count}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  )
}

const SCHEDULE_STATUS_META = {
  live: { label: "Live", className: "bg-emerald-400/90 text-white" },
  scheduled: { label: "Scheduled", className: "bg-amber-400/90 text-slate-900" },
  ended: { label: "Ended", className: "bg-slate-400/90 text-white" },
  inactive: { label: "Inactive", className: "bg-slate-500/80 text-white" },
}

function AnnouncementCard({ item, onEdit, onDelete, onToggleActive, muted = false }) {
  const photoCount = item.imageUrls?.length ?? 0
  const hasPhotos = photoCount > 0
  const isSinglePhoto = photoCount === 1
  const { startDate, endDate } = resolveAnnouncementDates(item)
  const scheduleStatus = getAnnouncementScheduleStatus(item)
  const scheduleMeta = SCHEDULE_STATUS_META[scheduleStatus] ?? SCHEDULE_STATUS_META.inactive

  return (
    <li
      className={cn(
        "flex h-full w-full overflow-hidden rounded-xl shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-px hover:shadow-[0_16px_36px_rgba(15,23,42,0.09)]",
        hasPhotos ? "min-h-[300px]" : "min-h-[220px]",
        muted && "opacity-90",
      )}
    >
      <div
        className={`flex h-full w-full flex-col rounded-xl p-px ${
          muted
            ? "bg-gradient-to-r from-slate-500 via-slate-400 to-slate-500"
            : "bg-gradient-to-r from-[#081F5C] via-[#0f4a86] to-[#0b3b66]"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[0.68rem] bg-white">
          <div
            className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/50 px-3 py-2.5 sm:px-4 ${
              muted
                ? "bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600"
                : "bg-gradient-to-r from-[#081F5C] via-[#0f4a86] to-[#0b3b66]"
            }`}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${item && item.active === false ? "bg-slate-400" : "bg-emerald-400"}`}
                aria-hidden
              />
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                {getAnnouncementTypeLabel(item)}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${scheduleMeta.className}`}>
                {scheduleMeta.label}
              </span>
              <time className="text-[11px] text-slate-300" title="Posting duration">
                {formatAnnouncementDurationLabel(startDate, endDate)}
              </time>
              <span className="hidden items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/90 sm:inline-flex">
                <Megaphone className="h-3 w-3" aria-hidden />
                OSGFA
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center p-0 text-white hover:text-white/90"
                  aria-label="Open announcement options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[170px]">
                <DropdownMenuItem className="gap-2" onSelect={() => onEdit(item)}>
                  <Edit3 className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => onToggleActive && onToggleActive(item)}>
                  <CheckCircle className="h-4 w-4" />
                  {item && item.active === false ? "Active" : "Inactive"}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-destructive" onSelect={() => onDelete(item)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4">
            <div className="shrink-0 space-y-2">
              <h3 className="line-clamp-2 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                {item.title}
              </h3>
              {item.description?.trim() ? (
                <p
                  className={cn(
                    "text-sm leading-relaxed text-slate-600",
                    hasPhotos ? "line-clamp-2" : "line-clamp-4 flex-1",
                  )}
                >
                  {item.description}
                </p>
              ) : null}
            </div>
            {hasPhotos ? (
              <div className="mt-3 shrink-0">
                <AnnouncementImageGallery
                  urls={item.imageUrls}
                  maxVisible={isSinglePhoto ? 1 : 3}
                  compact
                  layout="strip"
                  borderless
                  singleFullWidth={isSinglePhoto}
                  className="w-full"
                  stripHeightClass={isSinglePhoto ? "h-40 sm:h-44" : "h-32 sm:h-36"}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}

export default function AnnouncementPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [dateRange, setDateRange] = useState("__")
  const [announcements, setAnnouncements] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftType, setDraftType] = useState("new_batch")
  const [draftCustomType, setDraftCustomType] = useState("")
  const [typeError, setTypeError] = useState("")
  const [draftStartDate, setDraftStartDate] = useState(() => getTodayDateString())
  const [draftEndDate, setDraftEndDate] = useState("")
  const [durationError, setDurationError] = useState("")
  const [draftImages, setDraftImages] = useState([])
  const [draftImagesDirty, setDraftImagesDirty] = useState(false)
  const [imageError, setImageError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [activePage, setActivePage] = useState(1)
  const [inactivePage, setInactivePage] = useState(1)

  const normalizeAnnouncement = (item) => normalizeAnnouncementImages(normalizeAnnouncementRecord(item))

  const minimumEndDate = useMemo(
    () => getMinimumEndDate(draftStartDate),
    [draftStartDate],
  )

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true)
      setError("")
      const response = await apiClient.get("/announcements")
      const fetched = Array.isArray(response.data) ? response.data.map(normalizeAnnouncement) : []
      setAnnouncements(fetched)
    } catch (err) {
      console.error("Failed to load announcements:", err)
      setError(
        err?.userMessage ||
          err?.response?.data?.message ||
          "Failed to load announcements. Please try again.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAnnouncements()
  }, [])

  const { contentRevealed, skeletonLeaving } = useContentReveal(isLoading)

  const resetDraft = () => {
    setDraftImages((prev) => {
      revokeDraftImagePreviews(prev)
      return []
    })
    setEditingId(null)
    setDraftTitle("")
    setDraftDescription("")
    setDraftType("new_batch")
    setDraftCustomType("")
    const today = getTodayDateString()
    setDraftStartDate(today)
    setDraftEndDate("")
    setDraftImagesDirty(false)
    setImageError("")
    setDurationError("")
    setTypeError("")
  }

  const openEditAnnouncement = (item) => {
    const imageUrls = item.imageUrls ?? []
    setEditingId(item.id)
    setDraftTitle(item.title)
    setDraftDescription(item.description)
    setDraftType(item.type || "new_batch")
    setDraftCustomType(isOtherAnnouncementType(item.type) ? String(item.customType ?? "").trim() : "")
    const { startDate, endDate } = resolveAnnouncementDates(item)
    setDraftStartDate(startDate)
    setDraftEndDate(endDate)
    setDraftImages(
      imageUrls.map((previewUrl, index) => ({
        key: `existing-${index}`,
        previewUrl,
        fileName: item.images?.[index]?.fileName || `Picture ${index + 1}`,
        isExisting: true,
      })),
    )
    setDraftImagesDirty(false)
    setImageError("")
    setDurationError("")
    setTypeError("")
    setDialogOpen(true)
  }

  const handleImageFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!selectedFiles.length) return

    try {
      setImageError("")
      const availableSlots = MAX_ANNOUNCEMENT_IMAGES - draftImages.length
      if (availableSlots <= 0) {
        throw new Error(`You can upload up to ${MAX_ANNOUNCEMENT_IMAGES} pictures per announcement.`)
      }

      const nextFiles = selectedFiles.slice(0, availableSlots)
      if (selectedFiles.length > availableSlots) {
        setImageError(`Only ${availableSlots} more picture${availableSlots === 1 ? "" : "s"} can be added (max ${MAX_ANNOUNCEMENT_IMAGES}).`)
      }

      const additions = []
      for (const file of nextFiles) {
        validateAnnouncementImageFile(file)
        additions.push({
          key: `new-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          previewUrl: URL.createObjectURL(file),
          file,
          fileName: file.name,
          isExisting: false,
        })
      }

      setDraftImages((prev) => [...prev, ...additions])
      setDraftImagesDirty(true)
    } catch (err) {
      setImageError(err?.message || "Invalid image file.")
    }
  }

  const removeDraftImage = (key) => {
    setDraftImages((prev) => {
      const target = prev.find((image) => image.key === key)
      if (target && !target.isExisting) {
        revokeBlobPreviewUrl(target.previewUrl)
      }
      return prev.filter((image) => image.key !== key)
    })
    setDraftImagesDirty(true)
    setImageError("")
  }

  const handleDeleteAnnouncement = (item) => {
    if (!item?.id) return

    const doDelete = async () => {
      try {
        setError("")
        await apiClient.delete(`/announcements/${item.id}`)
        const nextAnnouncements = announcements.filter((announcement) => announcement.id !== item.id)
        setAnnouncements(nextAnnouncements)
      } catch (err) {
        console.error("Failed to delete announcement:", err)
        setError("Failed to delete announcement. Please try again.")
      }
    }

    void doDelete()
  }

  const handleCreateAnnouncement = (event) => {
    event.preventDefault()
    const title = draftTitle.trim()
    const description = draftDescription.trim()
    if (!title || !draftStartDate || isSaving) return
    const durationValidationMessage = validateAnnouncementDurationInput(draftStartDate, draftEndDate)
    if (durationValidationMessage) {
      setDurationError(durationValidationMessage)
      return
    }
    setDurationError("")
    if (isOtherAnnouncementType(draftType) && !draftCustomType.trim()) {
      setTypeError("Please enter a type when Other is selected.")
      return
    }
    setTypeError("")

    const existingActive = editingId ? announcements.find((a) => a.id === editingId)?.active ?? true : true
    const existingRecord = editingId ? announcements.find((a) => a.id === editingId) : null
    const hadImages = Boolean(existingRecord?.imageUrls?.length)

    const submit = async () => {
      try {
        setIsSaving(true)
        setError("")

        let imageFiles = []
        let clearExistingImages = false

        if (!editingId) {
          imageFiles = draftImages.filter((image) => image.file).map((image) => image.file)
        } else if (draftImages.length === 0 && hadImages) {
          clearExistingImages = true
        } else if (draftImagesDirty) {
          imageFiles = await draftImagesToUploadFiles(draftImages)
        }

        const formData = buildAnnouncementFormData({
          title,
          description,
          type: draftType,
          customType: draftCustomType,
          startDate: draftStartDate,
          endDate: draftEndDate,
          active: editingId ? existingActive : true,
          imageFiles,
          clearExistingImages,
        })

        let saved

        if (editingId) {
          const response = await saveAnnouncementWithFormData("put", `/announcements/${editingId}`, formData)
          saved = normalizeAnnouncement(response.data)
          setAnnouncements((prev) =>
            prev.map((announcement) => (announcement.id === editingId ? saved : announcement)),
          )
        } else {
          const response = await saveAnnouncementWithFormData("post", "/announcements", formData)
          saved = normalizeAnnouncement(response.data)
          setAnnouncements((prev) => [...prev, saved])
        }

        setDialogOpen(false)
        resetDraft()
        setSearchTerm("")
        setTypeFilter("all")
        setDateRange("__")
      } catch (err) {
        console.error("Failed to save announcement:", err)
        setError("Failed to save announcement. Please try again.")
      } finally {
        setIsSaving(false)
      }
    }

    void submit()
  }

  const toggleActive = (item) => {
    if (!item?.id) return

    const toggle = async () => {
      try {
        setError("")
        const response = await apiClient.patch(`/announcements/${item.id}/toggle`)
        const updated = normalizeAnnouncement(response.data)
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a)),
        )
      } catch (err) {
        console.error("Failed to toggle announcement status:", err)
        setError("Failed to toggle announcement status. Please try again.")
      }
    }

    void toggle()
  }

  const filteredAnnouncements = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return announcements.filter((item) => {
      if (typeFilter !== "all" && typeFilter !== "" && item.type !== typeFilter) return false
      const { startDate, endDate } = resolveAnnouncementDates(item)
      if (dateRange && dateRange !== "__" && !isDateInRange(startDate, dateRange)) return false
      if (!query) return true
      const typeLabel = getAnnouncementTypeLabel(item).toLowerCase()
      const durationLabel = formatAnnouncementDurationLabel(startDate, endDate).toLowerCase()
      return (
        String(item.title ?? "").toLowerCase().includes(query) ||
        String(item.description ?? "").toLowerCase().includes(query) ||
        String(startDate ?? "").toLowerCase().includes(query) ||
        String(endDate ?? "").toLowerCase().includes(query) ||
        durationLabel.includes(query) ||
        typeLabel.includes(query)
      )
    })
  }, [announcements, searchTerm, typeFilter, dateRange])

  const activeFiltered = useMemo(
    () => filteredAnnouncements.filter((item) => item.active !== false),
    [filteredAnnouncements],
  )

  const inactiveFiltered = useMemo(
    () => filteredAnnouncements.filter((item) => item.active === false),
    [filteredAnnouncements],
  )

  const isAnnouncementActive = (item) => item?.active !== false

  const hasActiveFilters = searchTerm.trim() !== "" || typeFilter !== "all" || (dateRange !== "__" && dateRange !== "")

  const resetFilters = () => {
    setSearchTerm("")
    setTypeFilter("all")
    setDateRange("__")
  }

  const openCreateDialog = () => {
    resetDraft()
    setDialogOpen(true)
  }

  const stats = useMemo(
    () => ({
      total: announcements.length,
      active: announcements.filter(isAnnouncementActive).length,
      inactive: announcements.filter((item) => !isAnnouncementActive(item)).length,
      thisMonth: announcements.filter((item) => isDateInRange(resolveAnnouncementDates(item).startDate, "this_month")).length,
    }),
    [announcements],
  )

  const activePagination = useMemo(() => paginateList(activeFiltered, activePage), [activeFiltered, activePage])
  const inactivePagination = useMemo(() => paginateList(inactiveFiltered, inactivePage), [inactiveFiltered, inactivePage])

  useEffect(() => {
    setActivePage(1)
    setInactivePage(1)
  }, [searchTerm, typeFilter, dateRange])

  useEffect(() => {
    setActivePage((prev) => {
      const next = Math.min(Math.max(1, prev), activePagination.pageCount)
      return next === prev ? prev : next
    })
  }, [activePagination.pageCount, activeFiltered.length])

  useEffect(() => {
    setInactivePage((prev) => {
      const next = Math.min(Math.max(1, prev), inactivePagination.pageCount)
      return next === prev ? prev : next
    })
  }, [inactivePagination.pageCount, inactiveFiltered.length])

  const renderAnnouncementList = (items, { muted = false } = {}) => (
    <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <AnnouncementCard
          key={item.id}
          item={item}
          muted={muted}
          onEdit={openEditAnnouncement}
          onDelete={handleDeleteAnnouncement}
          onToggleActive={toggleActive}
        />
      ))}
    </ul>
  )


  return (
    <section className="w-full min-w-0 max-w-full space-y-4">
      <div className="relative min-h-[124px]">
        {(isLoading || skeletonLeaving) && (
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !isLoading && "pointer-events-none absolute inset-0 z-0 opacity-0",
            )}
            aria-busy={isLoading}
            aria-hidden={!isLoading}
          >
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-[#081F5C]" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-[#0f766e]" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-slate-500" />
            <SummaryStatCardSkeleton accentBar="border-l-[3px] border-l-violet-500" />
          </div>
        )}
        {!isLoading && (
          <div className="relative z-10 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStatCard
              label="Total announcements"
              value={stats.total}
              accentBar="border-l-[3px] border-l-[#081F5C]"
              glow="bg-[#081F5C]/25"
              iconBg="bg-linear-to-br from-[#04133d]/90 via-[#081F5C] to-[#1447a6] text-white"
              Icon={Newspaper}
              className={revealItemClass(contentRevealed, 0, 60)}
              style={revealItemStyle(contentRevealed, 0, 60)}
            />
            <SummaryStatCard
              label="Active (live)"
              value={stats.active}
              accentBar="border-l-[3px] border-l-[#0f766e]"
              glow="bg-emerald-400/30"
              iconBg="bg-linear-to-br from-emerald-500 to-teal-600 text-white"
              Icon={Radio}
              className={revealItemClass(contentRevealed, 1, 60)}
              style={revealItemStyle(contentRevealed, 1, 60)}
            />
            <SummaryStatCard
              label="Inactive (hidden)"
              value={stats.inactive}
              accentBar="border-l-[3px] border-l-slate-500"
              glow="bg-slate-400/30"
              iconBg="bg-linear-to-br from-slate-500 to-slate-700 text-white"
              Icon={EyeOff}
              className={revealItemClass(contentRevealed, 2, 60)}
              style={revealItemStyle(contentRevealed, 2, 60)}
            />
            <SummaryStatCard
              label="Posted this month"
              value={stats.thisMonth}
              accentBar="border-l-[3px] border-l-violet-500"
              glow="bg-violet-400/30"
              iconBg="bg-linear-to-br from-violet-500 to-fuchsia-600 text-white"
              Icon={CalendarDays}
              className={revealItemClass(contentRevealed, 3, 60)}
              style={revealItemStyle(contentRevealed, 3, 60)}
            />
          </div>
        )}
      </div>

      <div className="mb-4 grid min-w-0 w-full max-w-full gap-3 md:grid-cols-12 md:items-center">
        <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-6 lg:col-span-5">
          <div className="relative min-w-0 w-full">
            <select
              id="announcement-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`${selectShellClass} ${typeFilter === "all" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="all" disabled hidden>
                Type
              </option>
              <option value="all">All types</option>
              {ANNOUNCEMENT_TYPE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="relative min-w-0 w-full">
            <select
              id="announcement-date-range-filter"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className={`${selectShellClass} ${dateRange === "__" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="__" disabled hidden>
                Date Range
              </option>
              <option value="">All dates</option>
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>
        </div>

        <div className="min-w-0 w-full md:col-span-2 lg:col-span-3">
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#081F5C]/30 hover:text-[#081F5C] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Reset all filters"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Reset filters
          </button>
        </div>

        <div className="relative min-w-0 w-full max-w-full md:col-span-4 lg:col-span-4">
          <div className="relative w-full min-w-0 max-w-full">
            <Input
              id="announcement-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title or description..."
              className="h-9 w-full min-w-0 rounded-lg border-none ring-0 bg-white/95 pr-12 pl-4 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"
            />
            
            <button
              type="button"
              className="absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-linear-to-r from-[#081F5C] to-[#1447a6] p-0 shadow-sm hover:opacity-95"
              aria-label="Search"
            >
              <Search className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

      </div>

      {error && announcements.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading || skeletonLeaving ? (
        <div className="relative min-h-[280px]">
          <ul
            className={cn(
              "grid min-w-0 list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !isLoading && "pointer-events-none absolute inset-x-0 top-0 opacity-0",
            )}
            aria-busy={isLoading}
            aria-hidden={!isLoading}
            aria-label="Loading announcements"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <AnnouncementCardSkeleton key={index} />
            ))}
          </ul>
        </div>
      ) : error && announcements.length === 0 ? (
        <AnnouncementsEmptyState
          variant="error"
          errorMessage={error}
          onRetry={() => void loadAnnouncements()}
          className={revealItemClass(contentRevealed, 0)}
          style={revealItemStyle(contentRevealed, 0)}
        />
      ) : announcements.length === 0 ? (
        <AnnouncementsEmptyState
          variant="empty"
          onCreate={openCreateDialog}
          className={revealItemClass(contentRevealed, 0)}
          style={revealItemStyle(contentRevealed, 0)}
        />
      ) : filteredAnnouncements.length === 0 ? (
        <AnnouncementsEmptyState
          variant="filtered"
          onClearFilters={resetFilters}
          className={revealItemClass(contentRevealed, 0)}
          style={revealItemStyle(contentRevealed, 0)}
        />
      ) : (
        <div
          className={cn("flex min-w-0 flex-col gap-6", revealItemClass(contentRevealed, 0))}
          style={revealItemStyle(contentRevealed, 0)}
        >
          <section className="flex min-w-0 flex-col gap-4 pb-2" aria-labelledby="active-announcements-heading">
            <AnnouncementSectionHeader
              title="Active announcements"
              description="Marked active and within their start–end duration on the landing page."
              count={activeFiltered.length}
              variant="active"
            />
            {activeFiltered.length > 0 ? (
              <div className="flex flex-col gap-4">
                {renderAnnouncementList(activePagination.items)}
                <AnnouncementSectionPagination
                  page={activePagination.page}
                  pageCount={activePagination.pageCount}
                  total={activeFiltered.length}
                  onPageChange={setActivePage}
                />
              </div>
            ) : (
              <AnnouncementSectionEmpty
                variant="active"
                message={
                  hasActiveFilters
                    ? "No active announcements match your filters."
                    : "No active announcements right now. Inactive or ended notices appear below."
                }
              />
            )}
          </section>

          <section className="flex min-w-0 flex-col gap-4 border-t border-slate-200/80 pt-10" aria-labelledby="inactive-announcements-heading">
            <AnnouncementSectionHeader
              title="Inactive announcements"
              description="Hidden from the landing page — manually inactive or past the end date. Removed automatically after 3 days inactive."
              count={inactiveFiltered.length}
              variant="inactive"
            />
            {inactiveFiltered.length > 0 ? (
              <div className="flex flex-col gap-4">
                {renderAnnouncementList(inactivePagination.items, { muted: true })}
                <AnnouncementSectionPagination
                  page={inactivePagination.page}
                  pageCount={inactivePagination.pageCount}
                  total={inactiveFiltered.length}
                  onPageChange={setInactivePage}
                />
              </div>
            ) : (
              <AnnouncementSectionEmpty
                variant="inactive"
                message={
                  hasActiveFilters
                    ? "No inactive announcements match your filters."
                    : "No inactive announcements. Manually hidden or past end date notices appear here."
                }
              />
            )}
          </section>
        </div>
      )}

      {announcements.length > 0 ? (
        <button
          type="button"
          onClick={openCreateDialog}
          className="group fixed bottom-8 right-8 z-50 inline-flex h-12 w-12 items-center justify-center gap-0 overflow-hidden rounded-full bg-linear-to-r from-[#081F5C] to-[#1447a6] px-0 text-white shadow-lg shadow-[#081F5C]/25 transition-all duration-200 hover:-translate-y-0.5 hover:w-52 hover:justify-start hover:gap-2 hover:px-3 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          aria-label="Add announcement"
          title="Add announcement"
        >
          <Plus className="size-5 shrink-0 text-white" strokeWidth={3} aria-hidden />
          <span className="pointer-events-none max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-200 group-hover:max-w-[190px] group-hover:opacity-100 group-focus-visible:max-w-[190px] group-focus-visible:opacity-100">
            Add Announcement
          </span>
        </button>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetDraft()
        }}
      >
        <DialogContent className="!flex max-h-[min(92vh,900px)] flex-col gap-0 overflow-hidden border border-slate-200 bg-white p-0 shadow-xl sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-4">
            <DialogTitle>{editingId ? "Edit announcement" : "Create announcement"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the announcement details and save your changes."
                : "Fill in the announcement details and save it to publish."}
            </DialogDescription>
          </DialogHeader>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleCreateAnnouncement}>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-2">
              <label htmlFor="announcement-type" className="text-sm font-semibold text-slate-700">
                Type
              </label>
              <div className="relative">
                <select
                  id="announcement-type"
                  value={draftType}
                  onChange={(event) => {
                    const nextType = event.target.value
                    setDraftType(nextType)
                    if (!isOtherAnnouncementType(nextType)) {
                      setDraftCustomType("")
                    }
                    setTypeError("")
                  }}
                  className="h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white px-2.5 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#081F5C] focus:ring-2 focus:ring-[#081F5C]/20"
                >
                  {ANNOUNCEMENT_TYPE_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
              {isOtherAnnouncementType(draftType) ? (
                <div className="grid gap-1.5">
                  <label htmlFor="announcement-custom-type" className="text-xs font-medium text-slate-600">
                    Custom type
                  </label>
                  <Input
                    id="announcement-custom-type"
                    type="text"
                    value={draftCustomType}
                    onChange={(event) => {
                      setDraftCustomType(event.target.value)
                      setTypeError("")
                    }}
                    placeholder="Enter announcement type"
                    maxLength={80}
                    className="h-8"
                  />
                </div>
              ) : null}
              {typeError ? <p className="text-xs text-red-600">{typeError}</p> : null}
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-700">Date duration</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label htmlFor="announcement-start-date" className="text-xs font-medium text-slate-600">
                    Start
                  </label>
                  <Input
                    id="announcement-start-date"
                    type="date"
                    value={draftStartDate}
                    onChange={(event) => {
                      const nextStart = event.target.value
                      setDraftStartDate(nextStart)
                      const nextMinEnd = getMinimumEndDate(nextStart)
                      if (draftEndDate && draftEndDate < nextMinEnd) {
                        setDraftEndDate("")
                      }
                      setDurationError("")
                    }}
                    className="h-8"
                  />
                  <p className="text-[11px] leading-snug text-slate-500">
                    When this appears on the landing page.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="announcement-end-date" className="text-xs font-medium text-slate-600">
                    End
                  </label>
                  <Input
                    id="announcement-end-date"
                    type="date"
                    value={draftEndDate}
                    min={minimumEndDate}
                    onChange={(event) => {
                      setDraftEndDate(event.target.value)
                      setDurationError("")
                    }}
                    className="h-8"
                  />
                  <p className="text-[11px] leading-snug text-slate-500">
                    The announcement auto-inactivates after this date.
                  </p>
                </div>
              </div>
              {durationError ? <p className="text-xs text-red-600">{durationError}</p> : null}
            </div>

            <div className="grid gap-2">
              <label htmlFor="announcement-title" className="text-sm font-semibold text-slate-700">
                Title
              </label>
              <Input
                id="announcement-title"
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Enter announcement title"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label htmlFor="announcement-description" className="text-sm font-semibold text-slate-700">
                  Description
                </label>
                <span className="text-xs text-slate-500">Optional</span>
              </div>
              <textarea
                id="announcement-description"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                rows={4}
                className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#081F5C] focus:ring-2 focus:ring-[#081F5C]/20"
                placeholder="Enter announcement details (optional)"
              />
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label htmlFor="announcement-images" className="text-sm font-semibold text-slate-700">
                  Pictures
                </label>
                <span className="text-xs text-slate-500">
                  Optional · up to {MAX_ANNOUNCEMENT_IMAGES} · max 2 MB each
                </span>
              </div>

              {draftImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                  {draftImages.map((image) => (
                    <div key={image.key} className="relative aspect-[3/4] w-full">
                      <AnnouncementPhotoFrame
                        url={image.previewUrl}
                        alt={image.fileName || "Announcement preview"}
                        compact
                        interactive={false}
                        className="h-full w-full"
                      />
                      <button
                        type="button"
                        onClick={() => removeDraftImage(image.key)}
                        className="absolute top-1 right-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-700/90 text-white transition hover:bg-slate-800"
                        aria-label={`Remove ${image.fileName || "picture"}`}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {draftImages.length < MAX_ANNOUNCEMENT_IMAGES ? (
                <label
                  htmlFor="announcement-images"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 transition hover:border-[#081F5C]/35 hover:bg-[#081F5C]/[0.03] sm:px-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#081F5C]/10 text-[#081F5C]">
                    <ImagePlus className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      <UploadCloud className="h-4 w-4 text-[#081F5C]" aria-hidden />
                      {draftImages.length > 0 ? "Add more pictures" : "Upload pictures"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {draftImages.length}/{MAX_ANNOUNCEMENT_IMAGES} selected · JPEG, PNG, WebP, GIF
                    </p>
                  </div>
                  <span className="hidden shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 sm:inline">
                    Browse
                  </span>
                </label>
              ) : (
                <p className="text-xs font-medium text-slate-500">
                  Maximum of {MAX_ANNOUNCEMENT_IMAGES} pictures reached.
                </p>
              )}

              <input
                id="announcement-images"
                type="file"
                accept={ANNOUNCEMENT_IMAGE_ACCEPT}
                multiple
                className="hidden"
                onChange={handleImageFileChange}
              />

              {imageError ? (
                <p className="text-xs text-red-600">{imageError}</p>
              ) : null}
            </div>
            </div>

            <DialogFooter className="-mx-0 -mb-0 mt-0 shrink-0 gap-2 rounded-none border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#081F5C] px-4 text-sm font-semibold text-white transition hover:bg-[#0b2f6a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving…" : editingId ? "Save changes" : "Create announcement"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
