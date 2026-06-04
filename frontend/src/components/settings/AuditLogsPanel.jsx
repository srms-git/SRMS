import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, ClipboardList, Loader2, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AUDIT_ENTITY_TYPES,
  CASHIER_AUDIT_ENTITY_TYPES,
  auditValuesToFriendlyRows,
  fetchAuditLogDetail,
  fetchAuditLogs,
  formatAuditAction,
  formatAuditEntityLabel,
  formatAuditTimestamp,
  formatAuditUser,
} from "@/lib/auditLogsApi"

function FriendlyChangesBlock({ label, value }) {
  const rows = auditValuesToFriendlyRows(value)
  if (!rows.length) return null

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <dl className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-gray-200 bg-gray-50/80 p-3">
        {rows.map((row, index) => (
          <div key={`${label}-${row.label}-${index}`} className="grid gap-0.5 sm:grid-cols-[minmax(0,38%)_1fr] sm:gap-3">
            <dt className="text-xs text-gray-500">{row.label}</dt>
            <dd className="text-sm text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function AuditLogsPanel({ workspaceLabel = "SRMS", scope }) {
  const isCashierScope = String(scope ?? "").trim().toLowerCase() === "cashier"
  const entityTypeOptions = isCashierScope ? CASHIER_AUDIT_ENTITY_TYPES : AUDIT_ENTITY_TYPES
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({
    totalItems: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 15,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [entityType, setEntityType] = useState("")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await fetchAuditLogs({
        page,
        limit: 15,
        entityType: entityType || undefined,
        search: search || undefined,
        scope: isCashierScope ? "cashier" : undefined,
      })
      setLogs(result.logs)
      setPagination(result.pagination)
    } catch (err) {
      setLogs([])
      setError(err.message || "Unable to load audit logs.")
    } finally {
      setLoading(false)
    }
  }, [entityType, isCashierScope, page, search])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const openDetail = async (log) => {
    const id = log?._id
    if (!id) return
    setDetailOpen(true)
    setDetailLoading(true)
    setSelectedLog(log)
    try {
      const detail = await fetchAuditLogDetail(id)
      setSelectedLog(detail)
    } catch (err) {
      setError(err.message || "Unable to load audit log details.")
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const canGoPrev = pagination.currentPage > 1
  const canGoNext = pagination.currentPage < pagination.totalPages

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-blue-700" />
        <div>
          <h3 className="text-base font-semibold text-gray-900">Audit Logs</h3>
          <p className="text-sm text-gray-600">
            {isCashierScope
              ? "Review sign-ins, profile and privacy updates, grantee claim changes, and claim history activity performed in the cashier workspace."
              : `Review recorded system activity for transparency across the ${workspaceLabel} workspace.`}
          </p>
        </div>
      </div>

      <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        {isCashierScope
          ? "Entries are limited to cashier account actions, grantee claim updates, claim history views, and related batch archives. Timestamps use your local timezone."
          : "Entries include sign-ins, profile and privacy updates, grantee changes, program edits, archives, and announcements. Timestamps use your local timezone."}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs text-gray-600">Entity type</label>
          <select
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value)
              setPage(1)
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {entityTypeOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <form className="min-w-0 flex-1" onSubmit={handleSearchSubmit}>
          <label className="mb-1 block text-xs text-gray-600">Search</label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by action or record type"
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-md border border-[#081F5C]/20 bg-white px-3 py-2 text-sm font-medium text-[#081F5C] transition hover:bg-[#081F5C]/5"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading audit logs…
          </div>
        ) : logs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-600">No audit log entries match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50/80">
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">
                      {formatAuditTimestamp(log.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-900">{formatAuditUser(log.userId)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{formatAuditAction(log.action)}</td>
                    <td className="px-3 py-2.5 text-gray-700">{formatAuditEntityLabel(log)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(log)}
                        className="text-xs font-medium text-[#081F5C] hover:underline"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && pagination.totalItems > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <p>
            Page {pagination.currentPage} of {pagination.totalPages} · {pagination.totalItems} entr
            {pagination.totalItems === 1 ? "y" : "ies"}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPage((prev) => prev + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border border-slate-200 bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit log details</DialogTitle>
            <DialogDescription>
              {selectedLog ? formatAuditTimestamp(selectedLog.createdAt) : "Loading…"}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading details…
            </div>
          ) : selectedLog ? (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                <dt className="text-gray-500">Performed by</dt>
                <dd className="font-medium text-gray-900">{formatAuditUser(selectedLog.userId)}</dd>
                <dt className="text-gray-500">Action</dt>
                <dd className="font-medium text-gray-900">{formatAuditAction(selectedLog.action)}</dd>
                <dt className="text-gray-500">Record</dt>
                <dd className="text-gray-900">{formatAuditEntityLabel(selectedLog)}</dd>
              </dl>
              <FriendlyChangesBlock label="Before" value={selectedLog.oldValues} />
              <FriendlyChangesBlock label="After" value={selectedLog.newValues} />
              {!auditValuesToFriendlyRows(selectedLog.oldValues).length &&
              !auditValuesToFriendlyRows(selectedLog.newValues).length ? (
                <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  No extra details were recorded for this entry.
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
