export const SUPPORT_TICKET_TYPES = [
  { value: "report", label: "Report an issue" },
  { value: "suggestion", label: "Suggestion" },
  { value: "request", label: "Request / Need something" },
]

const SHARED_FAQ = [
  {
    id: "login-access",
    category: "Account & Access",
    question: "I cannot sign in to SRMS. What should I do?",
    answer:
      "Confirm your registered email and password. If you recently changed your password, sign out everywhere and try again. Contact your OSGFA administrator if your account was deactivated or your role was changed.",
  },
  {
    id: "password-reset",
    category: "Account & Access",
    question: "How do I change my password?",
    answer:
      "Open Settings, go to Account, then Change Password. Enter your current password, request a verification code sent to your email, and submit the new password once verified.",
  },
  {
    id: "notifications",
    category: "Notifications",
    question: "Why am I not receiving certain alerts?",
    answer:
      "Some alerts can be turned off under System Preferences → Notifications. Password and security notices are always delivered. Check that the relevant notification toggles are enabled for your workspace.",
  },
]

const CASHIER_FAQ = [
  {
    id: "claim-batch",
    category: "Claims & Disbursement",
    question: "A grantee cannot be found in the active batch list.",
    answer:
      "Verify the batch number, program (TES/TDP), and spelling of the grantee name. The grantee may be in another batch or archived. Use search filters on the grantee list before submitting a support ticket.",
  },
  {
    id: "claim-status",
    category: "Claims & Disbursement",
    question: "How do I record a claim or disbursement?",
    answer:
      "Open the grantee record from the batch workspace, review semester claim details, then update the claim status following your office procedure. Include batch number and claim date when reporting discrepancies.",
  },
  {
    id: "privacy-mask",
    category: "Privacy",
    question: "Can student IDs be hidden on shared screens?",
    answer:
      "Yes. Under System Preferences → Privacy, enable masking options for list cards and sensitive statistics when presenting on shared displays.",
  },
]

const OSGFA_FAQ = [
  {
    id: "batch-create",
    category: "Batches & Programs",
    question: "How do I publish a new scholarship batch?",
    answer:
      "Create or import the batch from the program workspace, verify grantee rows, then publish when ready. Confirm landing page visibility settings if the batch should appear on the public list.",
  },
  {
    id: "landing-workflow",
    category: "Landing Page",
    question: "Where do I edit the public Process / Workflow steps?",
    answer:
      "Open Settings → System Preferences → Process / Workflow. Each program has its own timeline. Save changes to publish them on the landing page.",
  },
  {
    id: "archive",
    category: "Batches & Programs",
    question: "What happens when a batch is archived?",
    answer:
      "Archived batches remain searchable for reporting but are removed from active cashier workflows. Grantee history and audit entries are retained.",
  },
]

export const MOCK_USER_MANUAL = {
  title: "SRMS User Manual",
  version: "Draft 0.1 (preview)",
  lastUpdated: "June 2025",
  description:
    "Placeholder manual content for SRMS. Replace these sections with the official documentation when it is ready.",
  sections: [
    {
      id: "overview",
      title: "1. System Overview",
      content:
        "The Scholarship Records Management System (SRMS) supports scholarship batch management, grantee tracking, claim recording, and public landing page information for TES/TDP programs.\n\nThis preview section describes navigation, roles, and core modules. Final screenshots and step-by-step procedures will be added in the published manual.",
    },
    {
      id: "roles",
      title: "2. Roles & Permissions",
      content:
        "OSGFA staff manage batches, programs, landing page content, and system-wide settings. Cashiers process claims and disbursements within assigned batches.\n\nEach role sees a tailored workspace menu. Permissions determine which records can be viewed, edited, or exported.",
    },
    {
      id: "batches",
      title: "3. Working with Batches",
      content:
        "Batches group grantees under a program and academic period. OSGFA users create, import, validate, and publish batches. Cashiers work from active batches to locate grantees and update claim status.\n\nAlways note the batch number when coordinating with other offices or submitting support tickets.",
    },
    {
      id: "claims",
      title: "4. Claims & Disbursement",
      content:
        "Grantee records include semester-level claim information. Cashiers verify eligibility, record claims, and mark disbursements according to office policy.\n\nIf totals or statuses look incorrect, capture the batch number, grantee name, and affected semester before reporting the issue.",
    },
    {
      id: "support",
      title: "5. Getting Help",
      content:
        "Use Help Center to submit reports, suggestions, or requests. Check FAQ for common answers first.\n\nInclude clear context—batch number, program, screenshots if available—to help the support team respond faster.",
    },
  ],
}

export function getMockFaqItems(workspace = "cashier") {
  const roleSpecific = workspace === "osgfa" ? OSGFA_FAQ : CASHIER_FAQ
  return [...SHARED_FAQ, ...roleSpecific]
}

export function getHelpCenterIntro(workspace = "cashier") {
  if (workspace === "osgfa") {
    return {
      summary:
        "For SRMS concerns, coordinate with your school focal person or use the ticket form below to report issues, share suggestions, or request assistance with batches, landing page content, and system behavior.",
      tip: "Tip: Include batch number, program (TES/TDP), and a short description of what you expected versus what happened.",
    }
  }

  return {
    summary:
      "For SRMS cashier concerns, coordinate with your school focal person or the OSGFA office. Use the ticket form below to report issues, suggest improvements, or request help with claims and disbursement workflows.",
    tip: "Tip: Include batch number, grantee name, and claim date when reporting an issue for faster resolution.",
  }
}
