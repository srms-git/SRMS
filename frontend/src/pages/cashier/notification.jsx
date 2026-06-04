import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BellRing, CheckCheck, CheckCircle2, CircleAlert, Clock3, Info, Search, SlidersHorizontal } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import apiClient from "@/lib/apiClient"
import {
  CASHIER_SETTINGS_CHANGED_EVENT,
  isCashierRelevantNotification,
  readNotificationPreferences,
  shouldShowNotification,
} from "@/lib/cashierSettings"
import {
  NotificationCardSkeleton,
  revealItemClass,
  revealItemStyle,
  useContentReveal,
} from "@/lib/osgfaContentReveal"
import { cn } from "@/lib/utils"

const NOTIF_TYPES = {
  batch: {
    label: "Batch",
    icon: BellRing,
    pill: "border-[#081F5C]/20 bg-[#081F5C]/8 text-[#081F5C]",
  },
  claim: {
    label: "Claim",
    icon: CheckCircle2,
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  reminder: {
    label: "Reminder",
    icon: CircleAlert,
    pill: "border-amber-200 bg-amber-50 text-amber-700",
  },
  system: {
    label: "System",
    icon: Info,
    pill: "border-violet-200 bg-violet-50 text-violet-700",
  },
}

const PAGE_SIZE = 15

const selectShellClass =
  "h-9 w-full appearance-none rounded-lg border-none ring-0 bg-white/95 px-3 py-2 pr-8 text-xs sm:text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#081F5C]/20"

function formatDateTime(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export default function CashierNotificationPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [tab, setTab] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedNotificationId, setSelectedNotificationId] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [notificationPrefs, setNotificationPrefs] = useState(() => readNotificationPreferences())

  const normalizeNotification = useCallback((item) => {
    const rawType = typeof item?.type === "string" ? item.type.toLowerCase() : "system"
    const normalizedType = NOTIF_TYPES[rawType] ? rawType : "system"
    return {
      id: item?._id || item?.id,
      title: item?.title || "Untitled notification",
      message: item?.message || "",
      type: normalizedType,
      createdAt: item?.createdAt || item?.updatedAt || null,
      read: Boolean(item?.read),
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage("")
      const response = await apiClient.get("/notifications")
      const list = Array.isArray(response.data)
        ? response.data
            .filter(isCashierRelevantNotification)
            .filter((item) => shouldShowNotification(item, notificationPrefs))
            .map(normalizeNotification)
        : []
      setNotifications(list)
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Unable to load notifications.")
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [normalizeNotification, notificationPrefs])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    const syncPrefs = () => setNotificationPrefs(readNotificationPreferences())
    const refresh = () => loadNotifications()
    window.addEventListener(CASHIER_SETTINGS_CHANGED_EVENT, syncPrefs)
    window.addEventListener(CASHIER_SETTINGS_CHANGED_EVENT, refresh)
    window.addEventListener("storage", syncPrefs)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(CASHIER_SETTINGS_CHANGED_EVENT, syncPrefs)
      window.removeEventListener(CASHIER_SETTINGS_CHANGED_EVENT, refresh)
      window.removeEventListener("storage", syncPrefs)
      window.removeEventListener("storage", refresh)
    }
  }, [loadNotifications])

  const { contentRevealed, skeletonLeaving } = useContentReveal(loading)

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return notifications.filter((item) => {
      if (tab === "unread" && item.read) return false
      if (tab === "read" && !item.read) return false
      if (typeFilter !== "all" && typeFilter !== "" && item.type !== typeFilter) return false
      if (!query) return true
      return (
        String(item.title ?? "").toLowerCase().includes(query) ||
        String(item.message ?? "").toLowerCase().includes(query) ||
        String(item.type ?? "").toLowerCase().includes(query)
      )
    })
  }, [notifications, searchTerm, tab, typeFilter])

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, tab, typeFilter])

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), pageCount))
  }, [pageCount])

  const paginatedNotifications = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const markAllAsRead = async () => {
    const hasUnread = notifications.some((item) => !item.read)
    if (!hasUnread) return
    try {
      await apiClient.patch("/notifications/mark-all")
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Failed to mark all notifications as read.")
    }
  }

  const markOneAsRead = async (id) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`)
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)))
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Failed to update notification status.")
    }
  }

  const selectedNotification = useMemo(
    () => notifications.find((item) => item.id === selectedNotificationId) ?? null,
    [notifications, selectedNotificationId],
  )

  const openDetails = (item) => {
    setSelectedNotificationId(item.id)
    setDetailsOpen(true)
  }

  return (
    <section className="w-full min-w-0 max-w-full space-y-4">
      <div className="rounded-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6] p-5 text-white shadow-md shadow-[#04133d]/20">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate("/cashier/dashboard")}
            className="flex items-center gap-2 text-sm text-white/95 hover:text-white"
            aria-label="Back to dashboard"
          >
            <span className="text-lg leading-none">‹</span>
            <span>Back</span>
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/90 bg-white text-[#081F5C]">
                <BellRing className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Notification Center</h2>
                <p className="mt-1 text-xs text-sky-100/90">
                  Cashier alerts for batches, claims, reminders, and system activity.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 grid min-w-0 w-full max-w-full gap-3 md:grid-cols-12 md:items-center">
        <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-7 lg:col-span-8">
          <div className="relative min-w-0 w-full">
            <select
              id="cashier-notification-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className={`${selectShellClass} ${typeFilter === "all" ? "text-neutral-500" : "text-neutral-900"}`}
            >
              <option value="all">All Types</option>
              <option value="batch">Batch</option>
              <option value="claim">Claim</option>
              <option value="reminder">Reminder</option>
              <option value="system">System</option>
            </select>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`rounded-md px-3 py-1.5 transition ${tab === "all" ? "bg-white text-[#081F5C] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTab("unread")}
              className={`rounded-md px-3 py-1.5 transition ${tab === "unread" ? "bg-white text-[#081F5C] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Unread
            </button>
            <button
              type="button"
              onClick={() => setTab("read")}
              className={`rounded-md px-3 py-1.5 transition ${tab === "read" ? "bg-white text-[#081F5C] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Read
            </button>
          </div>
        </div>

        <div className="relative min-w-0 w-full max-w-full md:col-span-5 lg:col-span-4">
          <div className="relative w-full min-w-0 max-w-full">
            <input
              id="cashier-notification-search"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search notifications..."
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

      <div className="relative min-h-[12rem] space-y-3">
        {(loading || skeletonLeaving) && (
          <div
            className={cn(
              "space-y-3 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              !loading && "pointer-events-none absolute inset-x-0 top-0 opacity-0",
            )}
            aria-busy={loading}
            aria-hidden={!loading}
            aria-label="Loading notifications"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <NotificationCardSkeleton key={index} />
            ))}
          </div>
        )}

        {!loading &&
          (errorMessage ? (
            <div
              className={cn("space-y-3", revealItemClass(contentRevealed, 0))}
              style={revealItemStyle(contentRevealed, 0)}
            >
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
              <Button type="button" variant="outline" onClick={loadNotifications}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div
              className={cn(
                "rounded-2xl border border-dashed border-slate-300 bg-white/85 p-10 text-center text-sm text-slate-500",
                revealItemClass(contentRevealed, 0),
              )}
              style={revealItemStyle(contentRevealed, 0)}
            >
              No notifications matched your filters.
            </div>
          ) : (
          paginatedNotifications.map((item, index) => {
            const typeMeta = NOTIF_TYPES[item.type] || NOTIF_TYPES.system
            const TypeIcon = typeMeta.icon
            return (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => openDetails(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    openDetails(item)
                  }
                }}
                className={cn(
                  "group h-[8.75rem] overflow-hidden rounded-2xl border bg-white/95 p-4 shadow-sm ring-1 ring-slate-900/3 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8 dark:bg-slate-900/40",
                  item.read ? "border-slate-200/80 dark:border-white/10" : "border-[#081F5C]/25 dark:border-[#1447a6]/45",
                  revealItemClass(contentRevealed, index),
                )}
                style={revealItemStyle(contentRevealed, index)}
              >
                <div className="flex h-full items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#04133d] via-[#081F5C] to-[#1447a6] text-white shadow-sm">
                    <TypeIcon className="h-5 w-5" />
                  </span>

                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3
                        className="line-clamp-1 min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-white"
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                      <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeMeta.pill}`}>
                        {typeMeta.label}
                      </span>
                      {!item.read ? (
                        <span className="inline-flex shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-blue-700">
                          New
                        </span>
                      ) : null}
                    </div>
                    <p
                      className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
                      title={item.message}
                    >
                      {item.message}
                    </p>
                    <div className="mt-auto flex shrink-0 items-center justify-between gap-2 pt-1">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDateTime(item.createdAt)}
                      </span>
                      {!item.read ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            markOneAsRead(item.id)
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-[#081F5C]/30 hover:text-[#081F5C]"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Mark as read
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        ))}
      </div>

      {!loading && !errorMessage && filtered.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Showing{" "}
            <span className="font-semibold text-[#081F5C] dark:text-sky-200">
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)}
            </span>{" "}
            of <span className="font-semibold text-slate-900 dark:text-white">{filtered.length}</span> notification
            {filtered.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 shadow-sm transition hover:border-[#081F5C]/30 hover:text-[#081F5C] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:text-sky-200"
            >
              Prev
            </button>
            <span className="tabular-nums text-slate-600 dark:text-slate-300">
              Page <span className="font-semibold text-[#081F5C] dark:text-sky-200">{page}</span> / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 shadow-sm transition hover:border-[#081F5C]/30 hover:text-[#081F5C] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:text-sky-200"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="relative w-[min(92vw,34rem)] max-w-none overflow-hidden border-[#081F5C]/14 bg-white p-6 pt-8 shadow-[0_28px_56px_-16px_rgba(8,31,92,0.22)] dark:border-[#081F5C]/25 dark:bg-slate-950 sm:max-w-none">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 rounded-t-2xl bg-linear-to-r from-[#04133d] via-[#081F5C] to-[#1447a6]"
            aria-hidden
          />
          <DialogHeader className="relative shrink-0 pt-1">
            <DialogTitle>Notification Details</DialogTitle>
          </DialogHeader>

          {selectedNotification ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Title</p>
                <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-sm font-medium text-slate-900 dark:border-white/10 dark:bg-slate-900/40 dark:text-white">
                  {selectedNotification.title}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Type</p>
                  <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200">
                    {(NOTIF_TYPES[selectedNotification.type] || NOTIF_TYPES.system).label}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date & Time</p>
                  <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200">
                    {formatDateTime(selectedNotification.createdAt)}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Message</p>
                <div className="min-h-28 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-sm leading-relaxed text-slate-700 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200">
                  {selectedNotification.message}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="mt-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
