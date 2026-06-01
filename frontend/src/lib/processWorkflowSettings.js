import {
  Banknote,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck,
  GraduationCap,
  HandCoins,
  HelpCircle,
  Inbox,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  Search,
  Send,
  Upload,
  UserCheck,
  Wallet,
} from "lucide-react"

export const DEFAULT_WORKFLOW_STEP_COLOR = "#081F5C"
export const DEFAULT_WORKFLOW_STEP_COLOR_LIGHT = "#1447a6"

export const PROCESS_WORKFLOW_STORAGE_KEY = "srmsProcessWorkflow"
export const PROCESS_WORKFLOW_CHANGED_EVENT = "srms-process-workflow-changed"

export const PROCESS_WORKFLOW_ICON_OPTIONS = [
  { value: "ListChecks", label: "Checklist" },
  { value: "CalendarClock", label: "Schedule" },
  { value: "Clock", label: "Waiting" },
  { value: "ClipboardList", label: "Documents" },
  { value: "FileCheck", label: "Verification" },
  { value: "Search", label: "Search / verify" },
  { value: "UserCheck", label: "Identity check" },
  { value: "Upload", label: "Upload" },
  { value: "Send", label: "Submit" },
  { value: "Inbox", label: "Inbox" },
  { value: "BookOpen", label: "Requirements" },
  { value: "GraduationCap", label: "Student" },
  { value: "Bell", label: "Announcement" },
  { value: "Megaphone", label: "Megaphone" },
  { value: "Mail", label: "Email" },
  { value: "MapPin", label: "Location" },
  { value: "Building2", label: "Office" },
  { value: "Banknote", label: "Payout" },
  { value: "Wallet", label: "Wallet" },
  { value: "HandCoins", label: "Claim funds" },
  { value: "CheckCircle2", label: "Approved" },
  { value: "HelpCircle", label: "Help" },
]

export const WORKFLOW_ICON_MAP = {
  ListChecks,
  CalendarClock,
  Clock,
  ClipboardList,
  FileCheck,
  Search,
  UserCheck,
  Upload,
  Send,
  Inbox,
  BookOpen,
  GraduationCap,
  Bell,
  Megaphone,
  Mail,
  MapPin,
  Building2,
  Banknote,
  Wallet,
  HandCoins,
  CheckCircle2,
  HelpCircle,
}

/** Fixed landing section intro — not editable in OSGFA settings. */
export const LANDING_PROCESS_SECTION = {
  badge: "How it works",
  description:
    "Learn the step-by-step scholarship application process, from submission of requirements and verification to approval and payout coordination. This section helps students understand the procedures, requirements, and important stages of their scholarship application journey.",
}

export const DEFAULT_PROCESS_WORKFLOW = {
  steps: [
    {
      id: "workflow-step-1",
      step: "01",
      title: "Verify Your Name on the Final List",
      description:
        "Check the officially announced final list for the TES/TDP program to confirm if you are included as a beneficiary.",
      icon: "ListChecks",
      color: DEFAULT_WORKFLOW_STEP_COLOR,
      colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
    {
      id: "workflow-step-2",
      step: "02",
      title: "Wait for the Submission Schedule Announcement",
      description:
        "Monitor announcements regarding the schedule assigned to your batch for the submission of the required documents.",
      icon: "CalendarClock",
      color: DEFAULT_WORKFLOW_STEP_COLOR,
      colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
    {
      id: "workflow-step-3",
      step: "03",
      title: "Submit the Required Documents",
      description:
        "Submit all required requirements at the Office of Scholarships, Grants, and Financial Assistance, located at the 3rd Floor, Auxiliary Building.",
      icon: "ClipboardList",
      color: DEFAULT_WORKFLOW_STEP_COLOR,
      colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
    {
      id: "workflow-step-4",
      step: "04",
      title: "Wait for the Payout Schedule Announcement",
      description:
        "After submitting your requirements, wait for the official payout schedule announcement posted by the Office of Scholarships, Grants, and Financial Assistance.",
      icon: "Bell",
      color: DEFAULT_WORKFLOW_STEP_COLOR,
      colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
    {
      id: "workflow-step-5",
      step: "05",
      title: "Claim Your Financial Assistance",
      description:
        "Once the payout schedule for your batch is announced, proceed to the Cashier's Office, located on the 1st Floor of the Auxiliary Building, to claim your financial assistance.",
      icon: "Banknote",
      color: DEFAULT_WORKFLOW_STEP_COLOR,
      colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
  ],
}

function createStepId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `workflow-step-${crypto.randomUUID()}`
  }
  return `workflow-step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createEmptyWorkflowStep(index = 0) {
  const stepNumber = String(index + 1).padStart(2, "0")
  return {
    id: createStepId(),
    step: stepNumber,
    title: "",
    description: "",
    icon: "ListChecks",
    color: DEFAULT_WORKFLOW_STEP_COLOR,
    colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
  }
}

function sanitizeStep(raw, index) {
  const icon =
    PROCESS_WORKFLOW_ICON_OPTIONS.some((option) => option.value === raw?.icon) ? raw.icon : "ListChecks"
  return {
    id: String(raw?.id ?? createStepId()),
    step: String(raw?.step ?? String(index + 1).padStart(2, "0")),
    title: String(raw?.title ?? "").trim(),
    description: String(raw?.description ?? "").trim(),
    icon,
    color: DEFAULT_WORKFLOW_STEP_COLOR,
    colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
  }
}

export function normalizeProcessWorkflowSteps(steps) {
  return (Array.isArray(steps) ? steps : []).map((step, index) => ({
    ...sanitizeStep(step, index),
    step: String(index + 1).padStart(2, "0"),
  }))
}

function extractStepsFromStoragePayload(parsed) {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.steps)) return parsed.steps
  return DEFAULT_PROCESS_WORKFLOW.steps
}

export function readStoredProcessWorkflow() {
  const raw = localStorage.getItem(PROCESS_WORKFLOW_STORAGE_KEY)
  if (!raw) {
    return { steps: normalizeProcessWorkflowSteps(DEFAULT_PROCESS_WORKFLOW.steps) }
  }
  try {
    return { steps: normalizeProcessWorkflowSteps(extractStepsFromStoragePayload(JSON.parse(raw))) }
  } catch {
    return { steps: normalizeProcessWorkflowSteps(DEFAULT_PROCESS_WORKFLOW.steps) }
  }
}

export function writeStoredProcessWorkflow(config) {
  const steps = normalizeProcessWorkflowSteps(config?.steps ?? [])
  localStorage.setItem(PROCESS_WORKFLOW_STORAGE_KEY, JSON.stringify({ steps }))
  window.dispatchEvent(new CustomEvent(PROCESS_WORKFLOW_CHANGED_EVENT))
  return { steps }
}

export function hydrateProcessWorkflowSteps(steps) {
  return normalizeProcessWorkflowSteps(steps).map((item) => ({
    ...item,
    icon: WORKFLOW_ICON_MAP[item.icon] ?? ListChecks,
  }))
}

export function validateProcessWorkflow(config) {
  const steps = normalizeProcessWorkflowSteps(config?.steps ?? [])
  const errors = []

  if (!steps.length) {
    errors.push("Add at least one timeline step before saving.")
  }

  steps.forEach((step, index) => {
    const label = `Step ${index + 1}`
    if (!step.title) errors.push(`${label}: add a heading.`)
    if (!step.description) errors.push(`${label}: add instructions for students.`)
  })

  return { valid: errors.length === 0, errors, normalized: { steps } }
}
