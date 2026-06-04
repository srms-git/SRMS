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

export const CASHIER_AUDIT_ENTITY_TYPES = [
  { value: "", label: "All types" },
  { value: "users", label: "Users" },
  { value: "grantees", label: "Grantees" },
  { value: "claims", label: "Claims" },
  { value: "archives", label: "Archives" },
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

const MONGO_OBJECT_ID_RE = /^[a-f0-9]{24}$/i

const HIDDEN_FIELD_KEYS = new Set([
  "_id",
  "__v",
  "id",
  "password",
  "passwordhash",
  "token",
  "otp",
  "otpcode",
  "otpexpiresat",
  "resettoken",
  "resettokenexpires",
])

const FIELD_LABELS = {
  fullname: "Full name",
  firstname: "First name",
  lastname: "Last name",
  email: "Email",
  role: "Role",
  studentid: "Student ID",
  awardnumber: "Award number",
  batchno: "Batch number",
  program: "Program",
  academicyear: "Academic year",
  schoolyear: "School year",
  enrolledprogram: "Enrolled program",
  yearlevel: "Year level",
  title: "Title",
  message: "Message",
  type: "Type",
  active: "Active",
  isactive: "Active",
  status: "Status",
  code: "Program code",
  slug: "Program slug",
  name: "Name",
  loginat: "Signed in at",
  changedat: "Changed at",
  verifiedviaotp: "Verified with email code",
  maskstudentidinlists: "Mask student ID in lists",
  hidesensitivestatsfromsharedscreens: "Hide sensitive stats on shared screens",
  originalbatchno: "Previous batch number",
  originalprogram: "Previous program",
  originalacademicyear: "Previous academic year",
  totalrecordsaffected: "Records updated",
  totalinserted: "Records added",
  logsdispatched: "Claim updates recorded",
  recordsreturned: "Records shown",
  filtersapplied: "Filters used",
  totalrequirements: "Requirement items",
  migratedreferences: "Related records updated",
  reason: "Reason",
  condition: "Condition",
  synchronized: "Synced automatically",
  event: "Event",
  context: "Context",
}

const ENTITY_TYPE_LABELS = {
  users: "User account",
  grantees: "Grantee record",
  programs: "Scholarship program",
  archives: "Archived batch",
  announcements: "Announcement",
  claims: "Claim history",
}

function isMongoObjectId(value) {
  return MONGO_OBJECT_ID_RE.test(String(value ?? "").trim())
}

function normalizeFieldKey(key) {
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function humanizeFieldKey(key) {
  const normalized = normalizeFieldKey(key)
  if (FIELD_LABELS[normalized]) return FIELD_LABELS[normalized]
  return String(key ?? "")
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatRoleLabel(role) {
  const value = String(role ?? "").trim().toLowerCase()
  if (value === "osgfa") return "OSGFA"
  if (value === "cashier") return "Cashier"
  if (value === "superadmin") return "Super Admin"
  if (!value) return "—"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatPrimitiveValue(value, key) {
  if (value == null || value === "") return null
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)

  const normalizedKey = normalizeFieldKey(key)
  if (normalizedKey === "role") return formatRoleLabel(value)

  if (typeof value === "string") {
    if (isMongoObjectId(value)) return null
    const asDate = new Date(value)
    if (
      (normalizedKey.includes("at") || normalizedKey.includes("date")) &&
      !Number.isNaN(asDate.getTime()) &&
      value.includes("-")
    ) {
      return formatAuditTimestamp(value)
    }
    if (value === "hard_deleted") return "Permanently removed"
    if (value === "token_dispatched") return "Reset link sent"
    if (value === "otp_dispatched") return "Verification code sent"
    if (value === "reset_via_token_success") return "Password reset completed"
    if (value === "global_ledger") return "All claim records"
    return value
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatPrimitiveValue(item, key))
      .filter((item) => item != null && item !== "")
    return items.length ? items.join(", ") : null
  }

  return null
}

function collectFriendlyRows(source, labelPrefix = "") {
  if (source == null) return []
  if (typeof source !== "object" || Array.isArray(source)) {
    const value = formatPrimitiveValue(source, labelPrefix)
    return value ? [{ label: labelPrefix || "Details", value }] : []
  }

  const rows = []
  for (const [key, rawValue] of Object.entries(source)) {
    if (HIDDEN_FIELD_KEYS.has(normalizeFieldKey(key))) continue

    const label = labelPrefix ? `${labelPrefix} — ${humanizeFieldKey(key)}` : humanizeFieldKey(key)

    if (rawValue != null && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      const isDateLike =
        rawValue instanceof Date ||
        (typeof rawValue === "object" && "$date" in rawValue) ||
        false
      if (isDateLike) {
        const formatted = formatPrimitiveValue(rawValue, key)
        if (formatted) rows.push({ label, value: formatted })
        continue
      }
      rows.push(...collectFriendlyRows(rawValue, label))
      continue
    }

    const value = formatPrimitiveValue(rawValue, key)
    if (value != null && value !== "") rows.push({ label, value })
  }

  return rows
}

/** Plain-language rows for old/new value objects. */
export function auditValuesToFriendlyRows(value) {
  return collectFriendlyRows(value)
}

export function formatAuditEntityType(entityType) {
  const key = String(entityType ?? "").trim().toLowerCase()
  if (!key) return "—"
  return ENTITY_TYPE_LABELS[key] || humanizeFieldKey(key)
}

function pickEntityHint(log) {
  const sources = [log?.newValues, log?.oldValues].filter(Boolean)
  for (const source of sources) {
    if (!source || typeof source !== "object") continue

    const fullName = String(source.fullName ?? source.fullname ?? "").trim()
    if (fullName) return fullName

    const combinedName = `${String(source.firstName ?? source.firstname ?? "").trim()} ${String(source.lastName ?? source.lastname ?? "").trim()}`.trim()
    if (combinedName) return combinedName

    const title = String(source.title ?? source.name ?? "").trim()
    if (title) return title

    const code = String(source.code ?? "").trim()
    const batchNo = String(source.batchNo ?? source.batchno ?? "").trim()
    const program = String(source.program ?? "").trim()
    if (program && batchNo) return `${program} · Batch ${batchNo}`
    if (batchNo) return `Batch ${batchNo}`
    if (code) return code

    const studentId = String(source.studentId ?? source.studentid ?? "").trim()
    if (studentId) return `Student ${studentId}`

    const email = String(source.email ?? "").trim()
    if (email) return email
  }
  return ""
}

/** Entity label without internal database IDs. */
export function formatAuditEntityLabel(log) {
  const typeLabel = formatAuditEntityType(log?.entityType)
  const entityId = String(log?.entityId ?? "").trim()

  if (!entityId || isMongoObjectId(entityId)) {
    const hint = pickEntityHint(log)
    return hint ? `${typeLabel} (${hint})` : typeLabel
  }

  const friendlyId = entityId
    .replace(/_/g, " ")
    .replace(/-/g, " · ")
    .replace(/\s+/g, " ")
    .trim()

  if (/^global\s*ledger$/i.test(friendlyId)) {
    return `${typeLabel} (All claim records)`
  }

  return `${typeLabel} (${friendlyId})`
}

export async function fetchAuditLogs(query = {}) {
  const { page = 1, limit = 15, entityType, action, search, userId, scope } = query
  const params = {
    page: String(page),
    limit: String(limit),
  }
  if (entityType) params.entityType = String(entityType).trim().toLowerCase()
  if (action) params.action = String(action).trim().toUpperCase()
  if (search) params.search = String(search).trim()
  if (userId) params.userId = String(userId).trim()
  if (scope) params.scope = String(scope).trim().toLowerCase()

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
