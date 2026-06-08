const LandingSettings = require('../models/LandingSettingsModel');

const SETTINGS_KEY = 'default';

const DEFAULT_WORKFLOW_STEP_COLOR = '#081F5C';
const DEFAULT_WORKFLOW_STEP_COLOR_LIGHT = '#1447a6';

const ALLOWED_WORKFLOW_ICONS = new Set([
    'ListChecks',
    'CalendarClock',
    'Clock',
    'ClipboardList',
    'FileCheck',
    'Search',
    'UserCheck',
    'Upload',
    'Send',
    'Inbox',
    'BookOpen',
    'GraduationCap',
    'Bell',
    'Megaphone',
    'Mail',
    'MapPin',
    'Building2',
    'Banknote',
    'Wallet',
    'HandCoins',
    'CheckCircle2',
    'HelpCircle',
]);

const DEFAULT_PROCESS_WORKFLOW_STEPS = [
    {
        id: 'workflow-step-1',
        step: '01',
        title: 'Verify Your Name on the Final List',
        description:
            'Check the officially announced final list for the TES/TDP program to confirm if you are included as a beneficiary.',
        icon: 'ListChecks',
        color: DEFAULT_WORKFLOW_STEP_COLOR,
        colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
    {
        id: 'workflow-step-2',
        step: '02',
        title: 'Wait for the Submission Schedule Announcement',
        description:
            'Monitor announcements regarding the schedule assigned to your batch for the submission of the required documents.',
        icon: 'CalendarClock',
        color: DEFAULT_WORKFLOW_STEP_COLOR,
        colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
    {
        id: 'workflow-step-3',
        step: '03',
        title: 'Submit the Required Documents',
        description:
            'Submit all required requirements at the Office of Scholarships, Grants, and Financial Assistance, located at the 3rd Floor, Auxiliary Building.',
        icon: 'ClipboardList',
        color: DEFAULT_WORKFLOW_STEP_COLOR,
        colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
    {
        id: 'workflow-step-4',
        step: '04',
        title: 'Wait for the Payout Schedule Announcement',
        description:
            'After submitting your requirements, wait for the official payout schedule announcement posted by the Office of Scholarships, Grants, and Financial Assistance.',
        icon: 'Bell',
        color: DEFAULT_WORKFLOW_STEP_COLOR,
        colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
    {
        id: 'workflow-step-5',
        step: '05',
        title: 'Claim Your Financial Assistance',
        description:
            "Once the payout schedule for your batch is announced, proceed to the Cashier's Office, located on the 1st Floor of the Auxiliary Building, to claim your financial assistance.",
        icon: 'Banknote',
        color: DEFAULT_WORKFLOW_STEP_COLOR,
        colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    },
];

const DEFAULT_PRIVACY = {
    maskBatchNumberInPublicList: false,
    hideGranteeCountInPublicList: false,
    showProgramTag: true,
    showAcademicYear: true,
    showDateAdded: true,
    showViewAllBatchesLink: true,
    showStudentIdInLandingBatchList: true,
    showAwardNumberInLandingBatchList: true,
    showFullNameInLandingBatchList: true,
    showEnrolledProgramInLandingBatchList: true,
    showYearLevelInLandingBatchList: true,
};

const DEFAULT_CONTACT_INFO = {
    emailAddress: 'scholarships@msu.edu.ph',
    contactNumber: '(042) 000-0000',
    officeAddress: 'Marinduque State University, Boac, Marinduque',
};

function normalizePrivacy(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        maskBatchNumberInPublicList: Boolean(source.maskBatchNumberInPublicList),
        hideGranteeCountInPublicList: Boolean(source.hideGranteeCountInPublicList),
        showProgramTag: source.showProgramTag !== false,
        showAcademicYear: source.showAcademicYear !== false,
        showDateAdded: source.showDateAdded !== false,
        showViewAllBatchesLink: source.showViewAllBatchesLink !== false,
        showStudentIdInLandingBatchList: source.showStudentIdInLandingBatchList !== false,
        showAwardNumberInLandingBatchList: source.showAwardNumberInLandingBatchList !== false,
        showFullNameInLandingBatchList: source.showFullNameInLandingBatchList !== false,
        showEnrolledProgramInLandingBatchList: source.showEnrolledProgramInLandingBatchList !== false,
        showYearLevelInLandingBatchList: source.showYearLevelInLandingBatchList !== false,
    };
}

function normalizeContactInfo(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalizeText = (value, fallback) => {
        const text = String(value ?? '').trim();
        return text || fallback;
    };
    return {
        emailAddress: normalizeText(source.emailAddress, DEFAULT_CONTACT_INFO.emailAddress),
        contactNumber: normalizeText(source.contactNumber, DEFAULT_CONTACT_INFO.contactNumber),
        officeAddress: normalizeText(source.officeAddress, DEFAULT_CONTACT_INFO.officeAddress),
    };
}

function createWorkflowStepId() {
    return `workflow-step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeWorkflowStep(raw, index) {
    const icon = ALLOWED_WORKFLOW_ICONS.has(String(raw?.icon ?? '').trim())
        ? String(raw.icon).trim()
        : 'ListChecks';
    return {
        id: String(raw?.id ?? createWorkflowStepId()).trim() || createWorkflowStepId(),
        step: String(index + 1).padStart(2, '0'),
        title: String(raw?.title ?? '').trim(),
        description: String(raw?.description ?? '').trim(),
        icon,
        color: DEFAULT_WORKFLOW_STEP_COLOR,
        colorLight: DEFAULT_WORKFLOW_STEP_COLOR_LIGHT,
    };
}

const PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER = ['TES', 'TDP'];

function buildDefaultWorkflowStepsForProgram(programCode) {
    const code = String(programCode ?? '').trim().toUpperCase() || 'TES';
    return DEFAULT_PROCESS_WORKFLOW_STEPS.map((step, index) =>
        sanitizeWorkflowStep(
            {
                ...step,
                id: `workflow-${code.toLowerCase()}-${index + 1}`,
                description:
                    index === 0
                        ? `Check the officially announced final list for the ${code} program to confirm if you are included as a beneficiary.`
                        : step.description,
            },
            index,
        ),
    );
}

function buildDefaultProcessWorkflowByProgram(programCodes = PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER) {
    const codes = [...new Set((Array.isArray(programCodes) ? programCodes : []).map((code) => String(code ?? '').trim().toUpperCase()).filter(Boolean))];
    const list = codes.length ? codes : [...PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER];
    return Object.fromEntries(list.map((code) => [code, { steps: buildDefaultWorkflowStepsForProgram(code) }]));
}

function buildLegacyByProgramFromSteps(steps) {
    const normalized = steps.map((step, index) => sanitizeWorkflowStep(step, index));
    return Object.fromEntries(
        PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER.map((code) => [code, { steps: normalized }]),
    );
}

function normalizeProcessWorkflowByProgram(rawByProgram, programCodes = PROCESS_WORKFLOW_DEFAULT_PROGRAM_ORDER) {
    const defaults = buildDefaultProcessWorkflowByProgram(programCodes);
    const source = rawByProgram && typeof rawByProgram === 'object' ? rawByProgram : {};

    return Object.fromEntries(
        Object.keys(defaults).map((code) => {
            const entry = source[code];
            const stepsInput = Array.isArray(entry?.steps) ? entry.steps : Array.isArray(entry) ? entry : [];
            return [
                code,
                {
                    steps:
                        stepsInput.length > 0
                            ? stepsInput.map((step, index) => sanitizeWorkflowStep(step, index))
                            : defaults[code].steps,
                },
            ];
        }),
    );
}

function normalizeProcessWorkflow(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};

    if (source.byProgram && typeof source.byProgram === 'object') {
        const byProgram = normalizeProcessWorkflowByProgram(source.byProgram);
        if (Object.keys(byProgram).length > 0) {
            return { byProgram };
        }
    }

    const stepsInput = Array.isArray(source.steps) ? source.steps : [];
    const steps =
        stepsInput.length > 0
            ? stepsInput.map((step, index) => sanitizeWorkflowStep(step, index))
            : DEFAULT_PROCESS_WORKFLOW_STEPS.map((step, index) => sanitizeWorkflowStep(step, index));

    return { byProgram: buildLegacyByProgramFromSteps(steps) };
}

function normalizeBatchKeys(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean);
}

async function getOrCreateSettings() {
    let doc = await LandingSettings.findOne({ key: SETTINGS_KEY });
    if (!doc) {
        doc = await LandingSettings.create({ key: SETTINGS_KEY, publishedBatchKeys: [] });
    }
    return doc;
}

exports.getPublishedBatchKeys = async (req, res) => {
    try {
        const doc = await getOrCreateSettings();
        return res.status(200).json({
            keys: normalizeBatchKeys(doc.publishedBatchKeys),
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to load landing batch visibility.',
        });
    }
};

function hasCustomProcessWorkflow(doc) {
    const workflow = doc?.processWorkflow;
    if (workflow?.byProgram && typeof workflow.byProgram === 'object') {
        return Object.values(workflow.byProgram).some(
            (entry) => Array.isArray(entry?.steps) && entry.steps.length > 0,
        );
    }
    return Array.isArray(workflow?.steps) && workflow.steps.length > 0;
}

exports.getProcessWorkflow = async (req, res) => {
    try {
        const doc = await getOrCreateSettings();
        if (!hasCustomProcessWorkflow(doc)) {
            return res.status(200).json({ customized: false, byProgram: {} });
        }
        return res.status(200).json({
            customized: true,
            byProgram: normalizeProcessWorkflow(doc.processWorkflow).byProgram,
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to load process workflow settings.',
        });
    }
};

exports.updateProcessWorkflow = async (req, res) => {
    try {
        const processWorkflow = normalizeProcessWorkflow(
            req.body?.byProgram ? { byProgram: req.body.byProgram } : { steps: req.body?.steps },
        );
        const doc = await LandingSettings.findOneAndUpdate(
            { key: SETTINGS_KEY },
            { $set: { processWorkflow } },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        return res.status(200).json({
            customized: true,
            byProgram: normalizeProcessWorkflow(doc.processWorkflow).byProgram,
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to save process workflow settings.',
        });
    }
};

exports.getPageSettings = async (req, res) => {
    try {
        const doc = await getOrCreateSettings();
        return res.status(200).json({
            privacy: normalizePrivacy(doc.privacy),
            contactInfo: normalizeContactInfo(doc.contactInfo),
            processWorkflow: normalizeProcessWorkflow(doc.processWorkflow),
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to load landing page settings.',
        });
    }
};

exports.updatePageSettings = async (req, res) => {
    try {
        const updates = {};
        if (req.body?.privacy !== undefined) {
            updates.privacy = normalizePrivacy(req.body.privacy);
        }
        if (req.body?.contactInfo !== undefined) {
            updates.contactInfo = normalizeContactInfo(req.body.contactInfo);
        }
        if (req.body?.processWorkflow !== undefined) {
            updates.processWorkflow = normalizeProcessWorkflow(req.body.processWorkflow);
        }
        if (!Object.keys(updates).length) {
            return res.status(400).json({ message: 'No landing page settings were provided to save.' });
        }

        const doc = await LandingSettings.findOneAndUpdate(
            { key: SETTINGS_KEY },
            { $set: updates },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        return res.status(200).json({
            privacy: normalizePrivacy(doc.privacy),
            contactInfo: normalizeContactInfo(doc.contactInfo),
            processWorkflow: normalizeProcessWorkflow(doc.processWorkflow),
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to save landing page settings.',
        });
    }
};

exports.updatePublishedBatchKeys = async (req, res) => {
    try {
        const keys = normalizeBatchKeys(req.body?.keys);
        const doc = await LandingSettings.findOneAndUpdate(
            { key: SETTINGS_KEY },
            { $set: { publishedBatchKeys: keys } },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        return res.status(200).json({
            keys: normalizeBatchKeys(doc.publishedBatchKeys),
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to save landing batch visibility.',
        });
    }
};
