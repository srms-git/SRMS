const Program = require('../models/ProgramModel');
const { migrateProgramReferences } = require('../services/programReferenceMigration');
const { logActivity } = require('../services/auditLogger');

const TES_REQUIREMENTS = [
    { id: 'cor', label: 'Certificate of Registration (COR) for the current semester' },
    { id: 'rog', label: 'Official report of grades from the previous semester' },
    {
        id: 'scholarship_disclosure',
        label: 'Disclosure or certificate regarding other scholarships or financial assistance, if required',
    },
    { id: 'id_email', label: 'Valid school ID and updated school email on file' },
    { id: 'acknowledgment', label: 'Signed TES acknowledgment and parent/guardian consent, where applicable' },
];

const TDP_REQUIREMENTS = [
    { id: 'cor', label: 'Certificate of Registration (COR) for the current semester' },
    { id: 'rog', label: 'Official report of grades or class cards from the previous semester' },
    { id: 'school_id', label: 'Valid school ID (photocopy with registrar or authorized certification)' },
    {
        id: 'indigency',
        label: 'Certificate of indigency or other authorized proof of economic status, if applicable',
    },
    { id: 'undertaking', label: 'Signed TDP undertaking or parent/guardian consent form' },
];

const DEFAULT_GRANTEE_REQUIREMENTS = [
    { id: 'cor', label: 'Certificate of Registration (COR) for the current semester' },
    { id: 'rog', label: 'Official report of grades from the previous semester' },
    { id: 'school_id', label: 'Valid school ID on file' },
    { id: 'consent', label: 'Signed program acknowledgment or parent/guardian consent, where applicable' },
];

const BUILTIN_PROGRAMS = [
    {
        code: 'TES',
        slug: 'tes',
        name: 'TES',
        fullName: 'Tertiary Education Subsidy',
        description: 'Tertiary Education Subsidy — program workspace.',
        requirements: TES_REQUIREMENTS,
        builtIn: true,
        active: true,
    },
    {
        code: 'TDP',
        slug: 'tdp',
        name: 'TDP',
        fullName: 'Tulong Dunong Program',
        description: 'Tulong Dunong Program — program workspace.',
        requirements: TDP_REQUIREMENTS,
        builtIn: true,
        active: true,
    },
];

const generateSlug = (code) => {
    return String(code || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

async function seedDefaultProgramsIfEmpty() {
    const count = await Program.countDocuments();
    if (count > 0) return;
    await Program.insertMany(BUILTIN_PROGRAMS);
}

exports.getAllPrograms = async (req, res) => {
    try {
        await seedDefaultProgramsIfEmpty();
        const programs = await Program.find().sort({ active: -1, builtIn: -1, code: 1 });
        res.json(programs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve programs', error: err.message });
    }
};

exports.addProgram = async (req, res) => {
    try {
        const { code, name, fullName, description, requirements } = req.body;

        const cleanCode = String(code || '').trim().toUpperCase();
        const slug = generateSlug(cleanCode);

        if (!/^[A-Z0-9]{2,12}$/.test(cleanCode)) {
            return res.status(400).json({ message: 'Program code must be 2–12 letters or numbers (e.g. TES, TDP).' });
        }

        const existingProgram = await Program.findOne({ $or: [{ code: cleanCode }, { slug }] });
        if (existingProgram) {
            return res.status(400).json({ message: `A program with code "${cleanCode}" already exists.` });
        }

        const finalRequirements = Array.isArray(requirements) && requirements.length > 0
            ? requirements
            : DEFAULT_GRANTEE_REQUIREMENTS;

        const newProgram = new Program({
            code: cleanCode,
            slug,
            name: String(name || cleanCode).trim(),
            fullName: String(fullName || name || cleanCode).trim(),
            description: String(description || '').trim() || `${String(fullName || name || cleanCode).trim()} — program workspace.`,
            requirements: finalRequirements,
            builtIn: false,
            active: true,
        });

        await newProgram.save();

        // Audit trace logging for programmatic addition
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'PROGRAM_CREATED',
            entityType: 'programs',
            entityId: newProgram._id,
            oldValues: null,
            newValues: { code: cleanCode, slug, name: newProgram.name, totalRequirements: finalRequirements.length },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        res.status(201).json(newProgram);
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(400).json({ message: 'A program with this code already exists.' });
        }
        res.status(500).json({ message: 'Failed to save program', error: err.message });
    }
};

function normalizeSlugInput(slug, fallbackCode) {
    const raw = String(slug ?? generateSlug(fallbackCode) ?? '')
        .trim()
        .toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw)) {
        return { error: 'URL slug must use lowercase letters, numbers, and hyphens only.' };
    }
    return { slug: raw };
}

exports.updateProgram = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Program.findById(id);

        if (!existing) {
            return res.status(404).json({ message: 'Program not found.' });
        }

        const updates = {};

        if (typeof req.body?.active === 'boolean') {
            updates.active = req.body.active;
        }
        if (req.body?.name != null) {
            const name = String(req.body.name).trim();
            if (!name) {
                return res.status(400).json({ message: 'Display name cannot be empty.' });
            }
            updates.name = name;
        }
        if (req.body?.fullName != null) {
            const fullName = String(req.body.fullName).trim();
            if (!fullName) {
                return res.status(400).json({ message: 'Full name cannot be empty.' });
            }
            updates.fullName = fullName;
        }
        if (req.body?.description != null) {
            updates.description = String(req.body.description).trim();
        }

        if (req.body?.requirements != null) {
            if (!Array.isArray(req.body.requirements)) {
                return res.status(400).json({ message: 'Requirements must be a list of checklist items.' });
            }
            if (req.body.requirements.length === 0) {
                return res.status(400).json({ message: 'Add at least one requirement item for this program.' });
            }
            if (req.body.requirements.length > 12) {
                return res.status(400).json({ message: 'A program can have at most 12 requirement items.' });
            }
            const seenIds = new Set();
            const normalizedRequirements = [];
            for (const item of req.body.requirements) {
                const idAttr = String(item?.id ?? '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
                const label = String(item?.label ?? '').trim();
                if (!idAttr || !/^[a-z][a-z0-9_]{0,31}$/.test(idAttr)) {
                    return res.status(400).json({
                        message: 'Each requirement needs a stable id (lowercase letters, numbers, underscores).',
                    });
                }
                if (!label) {
                    return res.status(400).json({ message: 'Each requirement needs a description label.' });
                }
                if (seenIds.has(idAttr)) {
                    return res.status(400).json({ message: `Duplicate requirement id "${idAttr}".` });
                }
                seenIds.add(idAttr);
                normalizedRequirements.push({ id: idAttr, label });
            }
            updates.requirements = normalizedRequirements;
        }

        const oldCode = existing.code;
        let nextCode = oldCode;

        if (req.body?.code != null) {
            const cleanCode = String(req.body.code).trim().toUpperCase();
            if (!/^[A-Z0-9]{2,12}$/.test(cleanCode)) {
                return res.status(400).json({ message: 'Program code must be 2–12 letters or numbers (e.g. TES, TDP).' });
            }
            const codeConflict = await Program.findOne({ code: cleanCode, _id: { $ne: id } });
            if (codeConflict) {
                return res.status(400).json({ message: `A program with code "${cleanCode}" already exists.` });
            }
            updates.code = cleanCode;
            nextCode = cleanCode;
        }

        if (req.body?.slug != null || updates.code) {
            const slugResult = normalizeSlugInput(
                req.body?.slug,
                updates.code ?? existing.code,
            );
            if (slugResult.error) {
                return res.status(400).json({ message: slugResult.error });
            }
            const slugConflict = await Program.findOne({ slug: slugResult.slug, _id: { $ne: id } });
            if (slugConflict) {
                return res.status(400).json({ message: `A program with URL slug "${slugResult.slug}" already exists.` });
            }
            updates.slug = slugResult.slug;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: 'Provide at least one field to update: active, name, fullName, description, code, slug, or requirements.',
            });
        }

        const program = await Program.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true },
        );

        let migrated = null;
        if (updates.code && updates.code !== oldCode) {
            migrated = await migrateProgramReferences(oldCode, updates.code);
        }

        // Audit configuration changes or cascading code refactoring jobs
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'PROGRAM_UPDATED',
            entityType: 'programs',
            entityId: id,
            oldValues: { code: oldCode, name: existing.name, active: existing.active },
            newValues: { code: nextCode, name: program.name, active: program.active, migratedReferences: !!migrated },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        res.json({ ...program.toObject(), migrated });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(400).json({ message: 'A program with this code or slug already exists.' });
        }
        res.status(500).json({ message: 'Failed to update program', error: err.message });
    }
};