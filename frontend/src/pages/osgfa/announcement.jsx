import { useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Edit3,
  EyeOff,
  Megaphone,
  MoreHorizontal,
  Newspaper,
  Plus,
  Radio,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import apiClient from "@/lib/apiClient"
import {
  AnnouncementCardSkeleton,
  SummaryStatCardSkeleton,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"
import { cn } from "@/lib/utils"

const ANNOUNCER_TYPES = {
  all: "All",
  new_batch: "New batch",
  requirement_schedule: "Requirement schedule",
  payout_schedule: "Payout schedule",
  unclaimed: "Unclaimed",
  opportunity: "Opportunity",
  advisory: "Advisory",
}

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

const PAGE_SIZE = 3

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

function AnnouncementCard({ item, onEdit, onDelete, onToggleActive, muted = false }) {
  return (
    <li
      className={`flex h-full min-h-[220px] w-full overflow-hidden rounded-xl shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-px hover:shadow-[0_16px_36px_rgba(15,23,42,0.09)] ${muted ? "opacity-90" : ""}`}
    >
      <div
        className={`flex h-full min-h-[220px] w-full flex-col rounded-xl p-px ${
          muted
            ? "bg-gradient-to-r from-slate-500 via-slate-400 to-slate-500"
            : "bg-gradient-to-r from-[#081F5C] via-[#0f4a86] to-[#0b3b66]"
        }`}
      >
        <div className="flex h-full min-h-[218px] flex-col overflow-hidden rounded-[0.68rem] bg-white">
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
                {ANNOUNCER_TYPES[item.type] ?? "General"}
              </span>
              <time className="text-[11px] text-slate-300">{item.date}</time>
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

          <div className="flex flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4">
            <h3 className="line-clamp-2 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{item.title}</h3>
            <p className="mt-2 line-clamp-4 flex-1 text-sm leading-relaxed text-slate-600">{item.description}</p>
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
  const [draftDate, setDraftDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [activePage, setActivePage] = useState(1)
  const [inactivePage, setInactivePage] = useState(1)

  const normalizeAnnouncement = (item) => ({
    ...item,
    id: item.id || item._id,
  })

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setIsLoading(true)
        setError("")
        const response = await apiClient.get("/announcements")
        const fetched = Array.isArray(response.data) ? response.data.map(normalizeAnnouncement) : []
        setAnnouncements(fetched)
      } catch (err) {
        console.error("Failed to load announcements:", err)
        setError("Failed to load announcements. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnnouncements()
  }, [])

  const { contentRevealed, skeletonLeaving } = useContentReveal(isLoading)

  const resetDraft = () => {
    setEditingId(null)
    setDraftTitle("")
    setDraftDescription("")
    setDraftType("new_batch")
    setDraftDate(new Date().toISOString().slice(0, 10))
  }

  const openEditAnnouncement = (item) => {
    setEditingId(item.id)
    setDraftTitle(item.title)
    setDraftDescription(item.description)
    setDraftType(item.type || "new_batch")
    setDraftDate(item.date || new Date().toISOString().slice(0, 10))
    setDialogOpen(true)
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
    const date = draftDate
    if (!title || !description || !date) return

    const existingActive = editingId ? announcements.find((a) => a.id === editingId)?.active ?? true : true

    const submit = async () => {
      try {
        setError("")
        let saved

        if (editingId) {
          const response = await apiClient.put(`/announcements/${editingId}`, {
            title,
            description,
            type: draftType,
            date,
            active: existingActive,
          })
          saved = normalizeAnnouncement(response.data)
          setAnnouncements((prev) =>
            prev.map((announcement) => (announcement.id === editingId ? saved : announcement)),
          )
        } else {
          const response = await apiClient.post("/announcements", {
            title,
            description,
            type: draftType,
            date,
            active: true,
          })
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
      if (dateRange && dateRange !== "__" && !isDateInRange(item.date, dateRange)) return false
      if (!query) return true
      const typeLabel = (ANNOUNCER_TYPES[item.type] ?? "").toLowerCase()
      return (
        String(item.title ?? "").toLowerCase().includes(query) ||
        String(item.description ?? "").toLowerCase().includes(query) ||
        String(item.date ?? "").toLowerCase().includes(query) ||
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

  const stats = useMemo(
    () => ({
      total: announcements.length,
      active: announcements.filter(isAnnouncementActive).length,
      inactive: announcements.filter((item) => !isAnnouncementActive(item)).length,
      thisMonth: announcements.filter((item) => isDateInRange(item.date, "this_month")).length,
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
              <option value="new_batch">New batch</option>
              <option value="requirement_schedule">Requirement schedule</option>
              <option value="payout_schedule">Payout schedule</option>
              <option value="unclaimed">Unclaimed</option>
              <option value="opportunity">Opportunity</option>
              <option value="advisory">Advisory</option>
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

      {error ? (
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
      ) : announcements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">No announcements yet.</p>
          <p className="mt-2 text-sm text-slate-600">Create your first announcement to keep everyone informed.</p>
          <button
            type="button"
            onClick={() => {
              resetDraft()
              setDialogOpen(true)
            }}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#081F5C] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b2f6a]"
          >
            Create announcement
          </button>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600",
            revealItemClass(contentRevealed, 0),
          )}
          style={revealItemStyle(contentRevealed, 0)}
        >
          No announcements match your filter or search.
        </div>
      ) : (
        <div
          className={cn("flex min-w-0 flex-col gap-6", revealItemClass(contentRevealed, 0))}
          style={revealItemStyle(contentRevealed, 0)}
        >
          <section className="flex min-w-0 flex-col gap-4 pb-2" aria-labelledby="active-announcements-heading">
            <AnnouncementSectionHeader
              title="Active announcements"
              description="Visible on the public landing page and shown to students."
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
              <p className="min-h-[220px] rounded-xl border border-dashed border-[#081F5C]/20 bg-[#081F5C]/5 px-4 py-8 text-center text-sm text-slate-600">
                No active announcements match your filters.
              </p>
            )}
          </section>

          <section className="flex min-w-0 flex-col gap-4 border-t border-slate-200/80 pt-10" aria-labelledby="inactive-announcements-heading">
            <AnnouncementSectionHeader
              title="Inactive announcements"
              description="Hidden from the landing page until you mark them active again."
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
              <p className="min-h-[220px] rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600">
                No inactive announcements match your filters.
              </p>
            )}
          </section>
        </div>
      )}

      {announcements.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            resetDraft()
            setDialogOpen(true)
          }}
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
        <DialogContent className="border border-slate-200 bg-white p-6 shadow-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit announcement" : "Create announcement"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the announcement details and save your changes."
                : "Fill in the announcement details and save it to publish."}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleCreateAnnouncement}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="announcement-type" className="text-sm font-semibold text-slate-700">
                  Type
                </label>
                <div className="relative">
                  <select
                    id="announcement-type"
                    value={draftType}
                    onChange={(event) => setDraftType(event.target.value)}
                    className="h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white px-2.5 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#081F5C] focus:ring-2 focus:ring-[#081F5C]/20"
                  >
                    <option value="new_batch">New batch</option>
                    <option value="requirement_schedule">Requirement schedule</option>
                    <option value="payout_schedule">Payout schedule</option>
                    <option value="unclaimed">Unclaimed</option>
                    <option value="opportunity">Opportunity</option>
                    <option value="advisory">Advisory</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
              <div className="grid gap-2">
                <label htmlFor="announcement-date" className="text-sm font-semibold text-slate-700">
                  Date
                </label>
                <Input
                  id="announcement-date"
                  type="date"
                  value={draftDate}
                  onChange={(event) => setDraftDate(event.target.value)}
                  className="h-8"
                />
              </div>
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
              <label htmlFor="announcement-description" className="text-sm font-semibold text-slate-700">
                Description
              </label>
              <textarea
                id="announcement-description"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                rows={4}
                className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#081F5C] focus:ring-2 focus:ring-[#081F5C]/20"
                placeholder="Enter announcement details"
              />
            </div>

            <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#081F5C] px-4 text-sm font-semibold text-white transition hover:bg-[#0b2f6a]"
              >
                {editingId ? "Save changes" : "Create announcement"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
