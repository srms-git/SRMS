import { useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
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
import { ConnectionProblemState } from "@/components/ConnectionProblemState"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  MAX_ANNOUNCEMENT_IMAGE_MB,
  MAX_ANNOUNCEMENT_IMAGES,
  normalizeAnnouncementImages,
  prepareAnnouncementImageFiles,
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
import {
  formatBatchOptionLabel,
  formatLinkedBatchLabel,
  getLinkedBatchKey,
  isBatchLinkedAnnouncementType,
  isPayoutScheduleAnnouncementType,
} from "@/lib/announcementBatchLink"
import { usePublishedLandingBatches } from "@/lib/landingFeaturedBatches"
import { useAnnouncementsQuery } from "@/hooks/useSrmsQueries"
import { queryKeys } from "@/lib/queryKeys"
import { cn } from "@/lib/utils"

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

const MAX_ANNOUNCEMENT_IMAGE_BYTES = MAX_ANNOUNCEMENT_IMAGE_MB * 1024 * 1024
const ANNOUNCEMENT_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000
const ANNOUNCEMENT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

const formInputErrorClass =
  "border-red-500 focus:border-red-500 focus:ring-red-500/25 aria-invalid:border-red-500"

function FormFieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-xs font-medium leading-snug text-red-600">
      {message}
    </p>
  )
}

function focusAnnouncementFormField(fieldRefs, fieldKey) {
  requestAnimationFrame(() => {
    const section = fieldRefs.current[fieldKey]
    if (!section) return
    section.scrollIntoView({ behavior: "smooth", block: "center" })
    const focusable = section.querySelector(
      "input:not([type=hidden]):not([type=file]), select, textarea",
    )
    focusable?.focus({ preventScroll: true })
  })
}

function formatFileSizeMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function getAnnouncementImageFileError(file) {
  if (!file?.type?.startsWith("image/")) {
    return `"${file.name}" is not supported. Use JPEG, PNG, WebP, or GIF.`
  }
  if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
    return `"${file.name}" (${formatFileSizeMb(file.size)} MB) exceeds the ${MAX_ANNOUNCEMENT_IMAGE_MB} MB limit per picture.`
  }
  return ""
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

function getAnnouncementSaveError(err) {
  if (err?.code === "ECONNABORTED") {
    return "Upload timed out. Try fewer pictures at once or wait and try again."
  }
  if (err?.response?.status === 413) {
    return err?.response?.data?.message || "One or more images are too large to upload."
  }
  return (
    err?.response?.data?.message ||
    err?.userMessage ||
    "Failed to save announcement. Please try again."
  )
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
  linkedBatchNo,
  linkedProgram,
  linkedAcademicYear,
  scheduleDate,
  scheduleTime,
  scheduleLocation,
}) {
  const formData = new FormData()
  formData.append("title", title)
  formData.append("description", description)
  formData.append("type", type)
  if (isOtherAnnouncementType(type)) {
    formData.append("customType", customType.trim())
  }
  if (isBatchLinkedAnnouncementType(type)) {
    formData.append("linkedBatchNo", linkedBatchNo)
    formData.append("linkedProgram", linkedProgram)
    formData.append("linkedAcademicYear", linkedAcademicYear)
    formData.append("scheduleDate", scheduleDate)
    formData.append("scheduleTime", scheduleTime)
    formData.append("scheduleLocation", scheduleLocation)
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
    timeout: ANNOUNCEMENT_UPLOAD_TIMEOUT_MS,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
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

function AnnouncementsEmptyState({ variant, errorMessage, onClearFilters, onCreate, onRetry, className, style }) {
  if (variant === "error") {
    return (
      <ConnectionProblemState
        error={errorMessage}
        onRetry={onRetry}
        subject="announcements"
        variant="card"
        className={cn("min-h-[280px] justify-center", className)}
        style={style}
      />
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

const INACTIVE_AUTO_DELETE_DAYS = 3
const INACTIVE_AUTO_DELETE_MS = INACTIVE_AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000

function getInactiveAutoDeleteLabel(item) {
  if (item?.active !== false || !item?.inactiveAt) return null
  const inactiveMs = new Date(item.inactiveAt).getTime()
  if (Number.isNaN(inactiveMs)) return null
  const msLeft = inactiveMs + INACTIVE_AUTO_DELETE_MS - Date.now()
  if (msLeft <= 0) return "Removing soon"
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000))
  return daysLeft === 1 ? "Auto-deletes in 1 day" : `Auto-deletes in ${daysLeft} days`
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
              {(() => {
                const autoDeleteLabel = muted ? getInactiveAutoDeleteLabel(item) : null
                return autoDeleteLabel ? (
                  <span
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-amber-100"
                    title="Inactive announcements are removed automatically after 3 days"
                  >
                    {autoDeleteLabel}
                  </span>
                ) : null
              })()}
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
  const queryClient = useQueryClient()
  const {
    data: rawAnnouncements = [],
    isLoading,
    error: announcementsQueryError,
    refetch: loadAnnouncements,
  } = useAnnouncementsQuery()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [dateRange, setDateRange] = useState("__")
  const [error, setError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftType, setDraftType] = useState("new_batch")
  const [draftCustomType, setDraftCustomType] = useState("")
  const [typeError, setTypeError] = useState("")
  const [linkError, setLinkError] = useState("")
  const [titleError, setTitleError] = useState("")
  const [draftLinkedProgram, setDraftLinkedProgram] = useState("")
  const [draftLinkedBatchKey, setDraftLinkedBatchKey] = useState("")
  const [draftScheduleDate, setDraftScheduleDate] = useState("")
  const [draftScheduleTime, setDraftScheduleTime] = useState("")
  const [draftScheduleLocation, setDraftScheduleLocation] = useState("")
  const { batches: publishedLandingBatches, loading: publishedBatchesLoading } = usePublishedLandingBatches()
  const [draftStartDate, setDraftStartDate] = useState(() => getTodayDateString())
  const [draftEndDate, setDraftEndDate] = useState("")
  const [startDateError, setStartDateError] = useState("")
  const [durationError, setDurationError] = useState("")
  const formFieldRefs = useRef({})
  const [draftImages, setDraftImages] = useState([])
  const [draftImagesDirty, setDraftImagesDirty] = useState(false)
  const [imageError, setImageError] = useState("")
  const [isPreparingImages, setIsPreparingImages] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const normalizeAnnouncement = (item) => normalizeAnnouncementImages(normalizeAnnouncementRecord(item))

  const minimumEndDate = useMemo(
    () => getMinimumEndDate(draftStartDate),
    [draftStartDate],
  )

  const publishedPrograms = useMemo(
    () =>
      [...new Set(publishedLandingBatches.map((batch) => String(batch.program ?? "").trim().toUpperCase()).filter(Boolean))].sort(),
    [publishedLandingBatches],
  )

  const publishedBatchesForProgram = useMemo(() => {
    const program = String(draftLinkedProgram ?? "").trim().toUpperCase()
    if (!program) return []
    return publishedLandingBatches
      .filter((batch) => String(batch.program ?? "").trim().toUpperCase() === program)
      .sort((a, b) => {
        const parseBatch = (row) => {
          const n = Number.parseFloat(String(row?.batchNo ?? "").trim())
          return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
        }
        return parseBatch(a) - parseBatch(b)
      })
  }, [draftLinkedProgram, publishedLandingBatches])

  const announcements = useMemo(
    () => rawAnnouncements.map(normalizeAnnouncement),
    [rawAnnouncements],
  )

  const loadError =
    announcementsQueryError?.userMessage ||
    announcementsQueryError?.response?.data?.message ||
    announcementsQueryError?.message ||
    ""

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
    setDraftLinkedProgram("")
    setDraftLinkedBatchKey("")
    setDraftScheduleDate("")
    setDraftScheduleTime("")
    setDraftScheduleLocation("")
    const today = getTodayDateString()
    setDraftStartDate(today)
    setDraftEndDate("")
    setDraftImagesDirty(false)
    setImageError("")
    setDurationError("")
    setStartDateError("")
    setTypeError("")
    setLinkError("")
    setTitleError("")
  }

  const resolveDraftLinkedBatchFields = () => {
    const program = String(draftLinkedProgram ?? "").trim().toUpperCase()
    if (!program || !draftLinkedBatchKey) {
      return { linkedBatchNo: "", linkedProgram: "", linkedAcademicYear: "" }
    }
    const match = publishedBatchesForProgram.find(
      (batch) =>
        `${String(batch.batchNo ?? "").trim()}|${String(batch.program ?? "").trim().toUpperCase()}|${String(batch.schoolYear ?? "").trim()}` ===
        draftLinkedBatchKey,
    )
    if (!match) {
      if (draftLinkedBatchKey.includes("|")) {
        const [linkedBatchNo, linkedProgram, linkedAcademicYear] = draftLinkedBatchKey.split("|")
        if (linkedBatchNo && linkedProgram && linkedAcademicYear) {
          return {
            linkedBatchNo: String(linkedBatchNo).trim(),
            linkedProgram: String(linkedProgram).trim().toUpperCase(),
            linkedAcademicYear: String(linkedAcademicYear).trim(),
          }
        }
      }
      return { linkedBatchNo: "", linkedProgram: program, linkedAcademicYear: "" }
    }
    return {
      linkedBatchNo: String(match.batchNo ?? "").trim(),
      linkedProgram: String(match.program ?? "").trim().toUpperCase(),
      linkedAcademicYear: String(match.schoolYear ?? "").trim(),
    }
  }

  const openEditAnnouncement = (item) => {
    const imageUrls = item.imageUrls ?? []
    setEditingId(item.id)
    setDraftTitle(item.title)
    setDraftDescription(item.description)
    setDraftType(item.type || "new_batch")
    setDraftCustomType(isOtherAnnouncementType(item.type) ? String(item.customType ?? "").trim() : "")
    setDraftLinkedProgram(String(item.linkedProgram ?? "").trim().toUpperCase())
    setDraftLinkedBatchKey(getLinkedBatchKey(item))
    setDraftScheduleDate(String(item.scheduleDate ?? "").trim())
    setDraftScheduleTime(String(item.scheduleTime ?? "").trim())
    setDraftScheduleLocation(String(item.scheduleLocation ?? "").trim())
    const { startDate, endDate } = resolveAnnouncementDates(item)
    setDraftStartDate(startDate)
    setDraftEndDate(endDate)
    setDraftImages(
      imageUrls.map((previewUrl, index) => ({
        key: `existing-${index}`,
        existingIndex: index,
        previewUrl,
        fileName: item.images?.[index]?.fileName || `Picture ${index + 1}`,
        isExisting: true,
      })),
    )
    setDraftImagesDirty(false)
    setImageError("")
    setDurationError("")
    setStartDateError("")
    setTypeError("")
    setLinkError("")
    setTitleError("")
    setDialogOpen(true)
  }

  const handleImageFileChange = async (event) => {
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

      const fileErrors = []
      const validFiles = []
      for (const file of nextFiles) {
        const fileError = getAnnouncementImageFileError(file)
        if (fileError) {
          fileErrors.push(fileError)
          continue
        }
        validFiles.push(file)
      }

      if (!validFiles.length) {
        if (fileErrors.length) {
          setImageError(fileErrors.join(" "))
          focusAnnouncementFormField(formFieldRefs, "images")
        }
        return
      }

      setIsPreparingImages(true)
      const optimizedFiles = await prepareAnnouncementImageFiles(validFiles)

      const additions = []
      for (const file of optimizedFiles) {
        const fileError = getAnnouncementImageFileError(file)
        if (fileError) {
          fileErrors.push(fileError)
          continue
        }
        additions.push({
          key: `new-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          previewUrl: URL.createObjectURL(file),
          file,
          fileName: file.name,
          isExisting: false,
        })
      }

      if (fileErrors.length) {
        setImageError(fileErrors.join(" "))
        focusAnnouncementFormField(formFieldRefs, "images")
      }

      if (additions.length) {
        setDraftImages((prev) => [...prev, ...additions])
        setDraftImagesDirty(true)
      }
    } catch (err) {
      setImageError(err?.message || "Invalid image file.")
      focusAnnouncementFormField(formFieldRefs, "images")
    } finally {
      setIsPreparingImages(false)
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

  const openDeleteConfirm = (item) => {
    if (!item?.id) return
    setConfirmAction({ type: "delete", item })
    setConfirmOpen(true)
  }

  const openToggleActiveConfirm = (item) => {
    if (!item?.id) return
    setConfirmAction({ type: "toggle", item })
    setConfirmOpen(true)
  }

  const handleConfirmAnnouncementAction = async () => {
    const item = confirmAction?.item
    if (!item?.id || !confirmAction?.type) return

    try {
      setIsConfirming(true)
      setError("")

      if (confirmAction.type === "delete") {
        await apiClient.delete(`/announcements/${item.id}`)
      } else {
        await apiClient.patch(`/announcements/${item.id}/toggle`)
      }

      await loadAnnouncements()
      setConfirmOpen(false)
      setConfirmAction(null)
    } catch (err) {
      console.error("Failed to confirm announcement action:", err)
      if (confirmAction.type === "delete") {
        setError("Failed to delete announcement. Please try again.")
      } else {
        setError("Failed to toggle announcement status. Please try again.")
      }
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCreateAnnouncement = (event) => {
    event.preventDefault()
    if (isSaving) return

    const title = draftTitle.trim()
    const description = draftDescription.trim()

    setTitleError("")
    setStartDateError("")
    setDurationError("")
    setTypeError("")
    setLinkError("")

    let firstInvalidField = null
    const markInvalid = (field) => {
      if (!firstInvalidField) firstInvalidField = field
    }

    if (isOtherAnnouncementType(draftType) && !draftCustomType.trim()) {
      setTypeError("Please enter a custom type. This field is required when Other is selected.")
      markInvalid("type")
    }

    if (isBatchLinkedAnnouncementType(draftType)) {
      const linkedFields = resolveDraftLinkedBatchFields()
      if (!draftLinkedProgram.trim()) {
        setLinkError("Please select a program.")
        markInvalid("batchLink")
      } else if (!linkedFields.linkedBatchNo || !linkedFields.linkedAcademicYear) {
        setLinkError("Please select a target batch.")
        markInvalid("batchLink")
      } else if (isPayoutScheduleAnnouncementType(draftType) && !String(draftScheduleDate ?? "").trim()) {
        setLinkError("Please enter the payout date.")
        markInvalid("batchLink")
      }
    }

    if (!String(draftStartDate ?? "").trim()) {
      setStartDateError("Please select a start date.")
      markInvalid("duration")
    } else {
      const durationValidationMessage = validateAnnouncementDurationInput(draftStartDate, draftEndDate)
      if (durationValidationMessage) {
        setDurationError(durationValidationMessage)
        markInvalid("duration")
      }
    }

    if (!title) {
      setTitleError("Please enter a title. This field is required.")
      markInvalid("title")
    }

    if (firstInvalidField) {
      focusAnnouncementFormField(formFieldRefs, firstInvalidField)
      return
    }

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
          imageFiles = await draftImagesToUploadFiles(draftImages, editingId)
        }

        const linkedFields = resolveDraftLinkedBatchFields()
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
          linkedBatchNo: linkedFields.linkedBatchNo,
          linkedProgram: linkedFields.linkedProgram,
          linkedAcademicYear: linkedFields.linkedAcademicYear,
          scheduleDate: draftScheduleDate.trim(),
          scheduleTime: draftScheduleTime.trim(),
          scheduleLocation: draftScheduleLocation.trim(),
        })

        let saved

        if (editingId) {
          const response = await saveAnnouncementWithFormData("put", `/announcements/${editingId}`, formData)
          saved = normalizeAnnouncement(response.data)
          queryClient.setQueryData(queryKeys.announcements, (prev) =>
            (prev ?? []).map((announcement) => {
              const announcementId = announcement?.id || announcement?._id
              return announcementId === editingId ? response.data : announcement
            }),
          )
        } else {
          const response = await saveAnnouncementWithFormData("post", "/announcements", formData)
          saved = normalizeAnnouncement(response.data)
          queryClient.setQueryData(queryKeys.announcements, (prev) => [...(prev ?? []), response.data])
        }

        setDialogOpen(false)
        resetDraft()
        setSearchTerm("")
        setTypeFilter("all")
        setDateRange("__")
      } catch (err) {
        console.error("Failed to save announcement:", err)
        const message = getAnnouncementSaveError(err)
        setError(message)
        if (
          err?.response?.status === 413 ||
          err?.code === "ECONNABORTED" ||
          /image|upload|too large/i.test(message)
        ) {
          setImageError(message)
          focusAnnouncementFormField(formFieldRefs, "images")
        }
      } finally {
        setIsSaving(false)
      }
    }

    void submit()
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

  const renderAnnouncementList = (items, { muted = false } = {}) => (
    <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <AnnouncementCard
          key={item.id}
          item={item}
          muted={muted}
          onEdit={openEditAnnouncement}
          onDelete={openDeleteConfirm}
          onToggleActive={openToggleActiveConfirm}
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
          {error || loadError}
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
          errorMessage={error || loadError}
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
              renderAnnouncementList(activeFiltered)
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
              renderAnnouncementList(inactiveFiltered, { muted: true })
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
            <div
              ref={(node) => {
                formFieldRefs.current.type = node
              }}
              className="grid gap-2"
            >
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
                    if (!isBatchLinkedAnnouncementType(nextType)) {
                      setDraftLinkedProgram("")
                      setDraftLinkedBatchKey("")
                      setDraftScheduleDate("")
                      setDraftScheduleTime("")
                      setDraftScheduleLocation("")
                    }
                    setTypeError("")
                    setLinkError("")
                  }}
                  aria-invalid={Boolean(typeError)}
                  aria-describedby={typeError ? "announcement-type-error" : undefined}
                  className={cn(
                    "h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white px-2.5 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#081F5C] focus:ring-2 focus:ring-[#081F5C]/20",
                    typeError && formInputErrorClass,
                  )}
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
                    aria-invalid={Boolean(typeError)}
                    aria-describedby={typeError ? "announcement-type-error" : undefined}
                    className={cn("h-8", typeError && formInputErrorClass)}
                  />
                </div>
              ) : null}
              <FormFieldError id="announcement-type-error" message={typeError} />
            </div>

            {isBatchLinkedAnnouncementType(draftType) ? (
              <div
                ref={(node) => {
                  formFieldRefs.current.batchLink = node
                }}
                className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-700">Target batch</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    Link this announcement to a published landing-page batch so cashiers can see the schedule on that batch.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label htmlFor="announcement-linked-program" className="text-xs font-medium text-slate-600">
                      Program <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="announcement-linked-program"
                        value={draftLinkedProgram}
                        onChange={(event) => {
                          setDraftLinkedProgram(event.target.value)
                          setDraftLinkedBatchKey("")
                          setLinkError("")
                        }}
                        disabled={publishedBatchesLoading}
                        aria-invalid={Boolean(linkError)}
                        className={cn(
                          "h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white px-2.5 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#081F5C] focus:ring-2 focus:ring-[#081F5C]/20",
                          linkError && formInputErrorClass,
                        )}
                      >
                        <option value="">Select program</option>
                        {publishedPrograms.map((program) => (
                          <option key={program} value={program}>
                            {program}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <label htmlFor="announcement-linked-batch" className="text-xs font-medium text-slate-600">
                      Batch <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="announcement-linked-batch"
                        value={draftLinkedBatchKey}
                        onChange={(event) => {
                          setDraftLinkedBatchKey(event.target.value)
                          setLinkError("")
                        }}
                        disabled={!draftLinkedProgram || publishedBatchesLoading}
                        aria-invalid={Boolean(linkError)}
                        className={cn(
                          "h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white px-2.5 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#081F5C] focus:ring-2 focus:ring-[#081F5C]/20 disabled:cursor-not-allowed disabled:bg-slate-100",
                          linkError && formInputErrorClass,
                        )}
                      >
                        <option value="">
                          {!draftLinkedProgram
                            ? "Select a program first"
                            : publishedBatchesForProgram.length
                              ? "Select batch"
                              : "No published batches for this program"}
                        </option>
                        {publishedBatchesForProgram.map((batch) => {
                          const optionKey = `${String(batch.batchNo ?? "").trim()}|${String(batch.program ?? "").trim().toUpperCase()}|${String(batch.schoolYear ?? "").trim()}`
                          return (
                            <option key={optionKey} value={optionKey}>
                              {formatBatchOptionLabel(batch)}
                            </option>
                          )
                        })}
                        {draftLinkedBatchKey &&
                        !publishedBatchesForProgram.some(
                          (batch) =>
                            `${String(batch.batchNo ?? "").trim()}|${String(batch.program ?? "").trim().toUpperCase()}|${String(batch.schoolYear ?? "").trim()}` ===
                            draftLinkedBatchKey,
                        ) ? (
                          <option value={draftLinkedBatchKey}>
                            {formatLinkedBatchLabel({
                              linkedBatchNo: draftLinkedBatchKey.split("|")[0],
                              linkedProgram: draftLinkedBatchKey.split("|")[1],
                              linkedAcademicYear: draftLinkedBatchKey.split("|")[2],
                            }) || draftLinkedBatchKey}
                          </option>
                        ) : null}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>
                </div>

                {isPayoutScheduleAnnouncementType(draftType) ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5 sm:col-span-1">
                      <label htmlFor="announcement-schedule-date" className="text-xs font-medium text-slate-600">
                        Payout date <span className="text-red-600">*</span>
                      </label>
                      <Input
                        id="announcement-schedule-date"
                        type="date"
                        value={draftScheduleDate}
                        onChange={(event) => {
                          setDraftScheduleDate(event.target.value)
                          setLinkError("")
                        }}
                        aria-invalid={Boolean(linkError)}
                        className={cn("h-8", linkError && formInputErrorClass)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label htmlFor="announcement-schedule-time" className="text-xs font-medium text-slate-600">
                        Time window
                      </label>
                      <Input
                        id="announcement-schedule-time"
                        type="text"
                        value={draftScheduleTime}
                        onChange={(event) => setDraftScheduleTime(event.target.value)}
                        placeholder="e.g. 9:00 AM – 3:00 PM"
                        maxLength={120}
                        className="h-8"
                      />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-1">
                      <label htmlFor="announcement-schedule-location" className="text-xs font-medium text-slate-600">
                        Location
                      </label>
                      <Input
                        id="announcement-schedule-location"
                        type="text"
                        value={draftScheduleLocation}
                        onChange={(event) => setDraftScheduleLocation(event.target.value)}
                        placeholder="Cashier Office, Aux Building"
                        maxLength={200}
                        className="h-8"
                      />
                    </div>
                  </div>
                ) : null}

                <FormFieldError id="announcement-batch-link-error" message={linkError} />
              </div>
            ) : null}

            <div
              ref={(node) => {
                formFieldRefs.current.duration = node
              }}
              className="grid gap-2"
            >
              <p className="text-sm font-semibold text-slate-700">
                Date duration <span className="font-normal text-slate-500">(required)</span>
              </p>
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
                      setStartDateError("")
                      setDurationError("")
                    }}
                    aria-invalid={Boolean(startDateError)}
                    aria-describedby={startDateError ? "announcement-start-date-error" : undefined}
                    className={cn("h-8", startDateError && formInputErrorClass)}
                  />
                  <p className="text-[11px] leading-snug text-slate-500">
                    When this appears on the landing page.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="announcement-end-date" className="text-xs font-medium text-slate-600">
                    End <span className="text-red-600">*</span>
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
                    aria-invalid={Boolean(durationError)}
                    aria-describedby={durationError ? "announcement-end-date-error" : undefined}
                    className={cn("h-8", durationError && formInputErrorClass)}
                  />
                  <p className="text-[11px] leading-snug text-slate-500">
                    The announcement auto-inactivates after this date.
                  </p>
                </div>
              </div>
              <FormFieldError id="announcement-start-date-error" message={startDateError} />
              <FormFieldError id="announcement-end-date-error" message={durationError} />
            </div>

            <div
              ref={(node) => {
                formFieldRefs.current.title = node
              }}
              className="grid gap-2"
            >
              <label htmlFor="announcement-title" className="text-sm font-semibold text-slate-700">
                Title <span className="font-normal text-red-600">*</span>
              </label>
              <Input
                id="announcement-title"
                type="text"
                value={draftTitle}
                onChange={(event) => {
                  setDraftTitle(event.target.value)
                  setTitleError("")
                }}
                placeholder="Enter announcement title"
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? "announcement-title-error" : undefined}
                className={cn(titleError && formInputErrorClass)}
              />
              <FormFieldError id="announcement-title-error" message={titleError} />
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

            <div
              ref={(node) => {
                formFieldRefs.current.images = node
              }}
              className={cn(
                "space-y-3 rounded-xl border bg-slate-50/40 p-3 sm:p-4",
                imageError ? "border-red-300 bg-red-50/30" : "border-slate-200",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label htmlFor="announcement-images" className="text-sm font-semibold text-slate-700">
                  Pictures
                </label>
                <span className="text-xs text-slate-500">
                  Optional · up to {MAX_ANNOUNCEMENT_IMAGES} · max {MAX_ANNOUNCEMENT_IMAGE_MB} MB each
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
                disabled={isPreparingImages || isSaving}
                onChange={handleImageFileChange}
              />

              {isPreparingImages ? (
                <p className="text-xs font-medium text-[#081F5C]">Preparing pictures for upload…</p>
              ) : null}

              <FormFieldError id="announcement-images-error" message={imageError} />
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
                disabled={isSaving || isPreparingImages}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#081F5C] px-4 text-sm font-semibold text-white transition hover:bg-[#0b2f6a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPreparingImages
                  ? "Preparing pictures…"
                  : isSaving
                    ? "Uploading…"
                    : editingId
                      ? "Save changes"
                      : "Create announcement"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmAction ? (
        <AlertDialog
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open)
            if (!open && !isConfirming) setConfirmAction(null)
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction.type === "delete"
                  ? "Delete announcement?"
                  : confirmAction.item?.active === false
                    ? "Mark as active?"
                    : "Mark as inactive?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction.type === "delete" ? (
                  <>
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-slate-900">
                      {confirmAction.item?.title || "this announcement"}
                    </span>
                    ? This action cannot be undone.
                  </>
                ) : confirmAction.item?.active === false ? (
                  <>
                    Are you sure you want to mark{" "}
                    <span className="font-semibold text-slate-900">
                      {confirmAction.item?.title || "this announcement"}
                    </span>{" "}
                    as active? It will be eligible to appear on the landing page within its date range.
                  </>
                ) : (
                  <>
                    Are you sure you want to mark{" "}
                    <span className="font-semibold text-slate-900">
                      {confirmAction.item?.title || "this announcement"}
                    </span>{" "}
                    as inactive? It will be hidden from the landing page.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant={confirmAction.type === "delete" ? "destructive" : "default"}
                onClick={(event) => {
                  event.preventDefault()
                  void handleConfirmAnnouncementAction()
                }}
                disabled={isConfirming}
              >
                {isConfirming
                  ? "Please wait…"
                  : confirmAction.type === "delete"
                    ? "Delete"
                    : confirmAction.item?.active === false
                      ? "Mark active"
                      : "Mark inactive"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </section>
  )
}
