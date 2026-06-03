import apiClient from "@/lib/apiClient"

export const AUDIT_ENTITY_TYPES = [
  { value: "", label: "All types" },
  { value: "users", label: "Users" },
  { value: "grantees", label: "Grantees" },
  { value: "programs", label: "Programs" },
  { value: "archives", label: "Archives" },
  { value: "announcements", label: "Announcements" },
  { value: "claims", label: "Claims" },
]

function parseApiError(error, fallback) {
  const message =
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  return new Error(message)
}

export function formatAuditUser(user) {
  if (!user || typeof user !== "object") return "System"
  const name = `${String(user.firstName ?? "").trim()} ${String(user.lastName ?? "").trim()}`.trim()
  if (name) return name
  const email = String(user.email ?? "").trim()
  if (email) return email
  return "System"
}

export function formatAuditTimestamp(value) {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatAuditAction(action) {
  return String(action ?? "")
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export async function fetchAuditLogs(query = {}) {
  const { page = 1, limit = 15, entityType, action, search, userId } = query
  const params = {
    page: String(page),
    limit: String(limit),
  }
  if (entityType) params.entityType = String(entityType).trim().toLowerCase()
  if (action) params.action = String(action).trim().toUpperCase()
  if (search) params.search = String(search).trim()
  if (userId) params.userId = String(userId).trim()

  try {
    const response = await apiClient.get("/audit-logs", { params })
    const body = response.data
    if (!body?.success) {
      throw new Error(body?.error || "Failed to load audit logs.")
    }
    return {
      logs: Array.isArray(body.data) ? body.data : [],
      pagination: body.pagination ?? {
        totalItems: 0,
        currentPage: 1,
        totalPages: 1,
        limit: Number(limit) || 15,
      },
    }
  } catch (error) {
    throw parseApiError(error, "Failed to load audit logs.")
  }
}

export async function fetchAuditLogDetail(id) {
  const logId = String(id ?? "").trim()
  if (!logId) throw new Error("Audit log id is required.")

  try {
    const response = await apiClient.get(`/audit-logs/${encodeURIComponent(logId)}`)
    const body = response.data
    if (!body?.success) {
      throw new Error(body?.error || "Failed to load audit log details.")
    }
    return body.data
  } catch (error) {
    throw parseApiError(error, "Failed to load audit log details.")
  }
}
