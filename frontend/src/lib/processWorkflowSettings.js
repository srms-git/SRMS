import { useEffect, useState } from "react"

import apiClient from "@/lib/apiClient"
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

const PROCESS_WORKFLOW_API_PATH = "/landing-batches/process-workflow"

export const PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER = ["TES", "TDP"]

function parseProcessWorkflowResponse(data, programCodes) {
  if (!data || typeof data !== "object") return null

  if (data.byProgram && typeof data.byProgram === "object") {
    return {
      customized: Boolean(data.customized),
      byProgram: normalizeProcessWorkflowByProgram(data.byProgram, programCodes),
    }
  }

  if (Array.isArray(data.steps)) {
    const steps = normalizeProcessWorkflowSteps(data.steps)
    return {
      customized: Boolean(data.customized),
      byProgram: buildLegacyByProgramFromSteps(steps, programCodes),
    }
  }

  return null
}

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
    title: String(raw?.title ?? ""),
    description: String(raw?.description ?? ""),
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

export function finalizeProcessWorkflowSteps(steps) {
  return normalizeProcessWorkflowSteps(steps).map((step) => ({
    ...step,
    title: step.title.trim(),
    description: step.description.trim(),
  }))
}

export function resolveProcessWorkflowProgramCodes(programCodes) {
  const codes = [...new Set((Array.isArray(programCodes) ? programCodes : []).map((code) => String(code ?? "").trim().toUpperCase()).filter(Boolean))]
  return codes.length ? codes : [...PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER]
}

export function buildDefaultWorkflowStepsForProgram(programCode) {
  const code = String(programCode ?? "").trim().toUpperCase() || "TES"
  return normalizeProcessWorkflowSteps(
    DEFAULT_PROCESS_WORKFLOW.steps.map((step, index) => ({
      ...step,
      id: `workflow-${code.toLowerCase()}-${index + 1}`,
      description:
        index === 0
          ? `Check the officially announced final list for the ${code} program to confirm if you are included as a beneficiary.`
          : step.description,
    })),
  )
}

export function buildDefaultProcessWorkflowByProgram(programCodes) {
  const codes = resolveProcessWorkflowProgramCodes(programCodes)
  return Object.fromEntries(codes.map((code) => [code, { steps: buildDefaultWorkflowStepsForProgram(code) }]))
}

function buildLegacyByProgramFromSteps(steps, programCodes) {
  const codes = resolveProcessWorkflowProgramCodes(programCodes)
  const normalized = normalizeProcessWorkflowSteps(steps)
  return Object.fromEntries(codes.map((code) => [code, { steps: normalized }]))
}

export function normalizeProcessWorkflowByProgram(rawByProgram, programCodes) {
  const codes = resolveProcessWorkflowProgramCodes(programCodes)
  const defaults = buildDefaultProcessWorkflowByProgram(codes)
  const source = rawByProgram && typeof rawByProgram === "object" ? rawByProgram : {}

  return Object.fromEntries(
    codes.map((code) => {
      const entry = source[code]
      const stepsInput = Array.isArray(entry?.steps) ? entry.steps : Array.isArray(entry) ? entry : []
      return [
        code,
        {
          steps:
            stepsInput.length > 0
              ? normalizeProcessWorkflowSteps(stepsInput)
              : defaults[code]?.steps ?? buildDefaultWorkflowStepsForProgram(code),
        },
      ]
    }),
  )
}

function migrateStoredWorkflowPayload(parsed, programCodes) {
  if (parsed?.byProgram && typeof parsed.byProgram === "object") {
    return { byProgram: normalizeProcessWorkflowByProgram(parsed.byProgram, programCodes) }
  }

  if (Array.isArray(parsed)) {
    return { byProgram: buildLegacyByProgramFromSteps(parsed, programCodes) }
  }

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.steps)) {
    return { byProgram: buildLegacyByProgramFromSteps(parsed.steps, programCodes) }
  }

  return { byProgram: buildDefaultProcessWorkflowByProgram(programCodes) }
}

export function readStoredProcessWorkflow(programCodes) {
  const raw = localStorage.getItem(PROCESS_WORKFLOW_STORAGE_KEY)
  if (!raw) {
    return { byProgram: buildDefaultProcessWorkflowByProgram(programCodes) }
  }
  try {
    return migrateStoredWorkflowPayload(JSON.parse(raw), programCodes)
  } catch {
    return { byProgram: buildDefaultProcessWorkflowByProgram(programCodes) }
  }
}

export function writeStoredProcessWorkflow(config, programCodes) {
  const byProgram = config?.byProgram
    ? normalizeProcessWorkflowByProgram(config.byProgram, programCodes)
    : migrateStoredWorkflowPayload(config, programCodes).byProgram
  localStorage.setItem(PROCESS_WORKFLOW_STORAGE_KEY, JSON.stringify({ byProgram }))
  window.dispatchEvent(new CustomEvent(PROCESS_WORKFLOW_CHANGED_EVENT))
  return { byProgram }
}

export function getWorkflowStepsForProgram(config, programCode) {
  const code = String(programCode ?? "").trim().toUpperCase()
  return config?.byProgram?.[code]?.steps ?? buildDefaultWorkflowStepsForProgram(code)
}

export async function loadProcessWorkflow(programCodes) {
  const cached = readStoredProcessWorkflow(programCodes)
  try {
    const response = await apiClient.get(PROCESS_WORKFLOW_API_PATH)
    const parsed = parseProcessWorkflowResponse(response.data, programCodes)
    if (!parsed) return cached
    if (!parsed.customized) return cached
    return writeStoredProcessWorkflow({ byProgram: parsed.byProgram }, programCodes)
  } catch (error) {
    console.error("Failed to load process workflow from server:", error)
    return cached
  }
}

export async function persistProcessWorkflow(config, programCodes) {
  const { valid, errors, normalized } = validateProcessWorkflow(config, programCodes)
  if (!valid) {
    const validationError = new Error(errors.join(" "))
    validationError.errors = errors
    throw validationError
  }

  const sentPrograms = Object.keys(normalized.byProgram)
  let response
  try {
    response = await apiClient.put(PROCESS_WORKFLOW_API_PATH, { byProgram: normalized.byProgram })
  } catch (error) {
    const status = error?.response?.status
    if (status === 404) {
      throw new Error(
        "The API does not support workflow saving yet. Stop any old backend on port 5000, restart with npm run dev, then try again.",
      )
    }
    throw error
  }

  const parsed = parseProcessWorkflowResponse(response.data, programCodes)
  const savedPrograms = parsed?.byProgram ? Object.keys(parsed.byProgram) : []
  if (!parsed?.customized || savedPrograms.length !== sentPrograms.length) {
    throw new Error(
      "The server did not confirm your workflow steps. Restart the backend (npm run dev in the backend folder) and try again.",
    )
  }

  return writeStoredProcessWorkflow({ byProgram: parsed.byProgram }, programCodes)
}

export function useProcessWorkflowByProgram(programCodes) {
  const codes = resolveProcessWorkflowProgramCodes(programCodes)
  const codesKey = codes.join(",")
  const [byProgram, setByProgram] = useState(() => readStoredProcessWorkflow(codes).byProgram)

  useEffect(() => {
    let cancelled = false

    loadProcessWorkflow(codes).then((config) => {
      if (!cancelled) setByProgram(config.byProgram)
    })

    const sync = () => setByProgram(readStoredProcessWorkflow(codes).byProgram)
    window.addEventListener(PROCESS_WORKFLOW_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)

    return () => {
      cancelled = true
      window.removeEventListener(PROCESS_WORKFLOW_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [codesKey])

  return byProgram
}

/** @deprecated Use useProcessWorkflowByProgram instead. */
export function useProcessWorkflowSteps(programCode = PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER[0]) {
  const byProgram = useProcessWorkflowByProgram()
  return getWorkflowStepsForProgram({ byProgram }, programCode)
}

export function hydrateProcessWorkflowSteps(steps) {
  return normalizeProcessWorkflowSteps(steps).map((item) => ({
    ...item,
    icon: WORKFLOW_ICON_MAP[item.icon] ?? ListChecks,
  }))
}

export function validateProcessWorkflow(config, programCodes) {
  const byProgram = config?.byProgram
    ? normalizeProcessWorkflowByProgram(config.byProgram, programCodes)
    : migrateStoredWorkflowPayload(config, programCodes).byProgram
  const errors = []
  const finalizedByProgram = {}

  for (const [programCode, { steps }] of Object.entries(byProgram)) {
    const finalizedSteps = finalizeProcessWorkflowSteps(steps)
    finalizedByProgram[programCode] = { steps: finalizedSteps }

    if (!finalizedSteps.length) {
      errors.push(`${programCode}: add at least one timeline step before saving.`)
      continue
    }

    finalizedSteps.forEach((step, index) => {
      const label = `${programCode} — Step ${index + 1}`
      if (!step.title) errors.push(`${label}: add a heading.`)
      if (!step.description) errors.push(`${label}: add instructions for students.`)
    })
  }

  return { valid: errors.length === 0, errors, normalized: { byProgram: finalizedByProgram } }
}
