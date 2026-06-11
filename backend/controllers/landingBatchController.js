const LandingBatch = require('../models/LandingBatchModel');
const LandingSettings = require('../models/LandingSettingsModel');
const Grantee = require('../models/GranteeModel');

const SETTINGS_KEY = 'default';

function normalizeBatchFields(body = {}) {
    const batchNo = String(body.batchNo ?? '').trim();
    const program = String(body.program ?? '').trim().toUpperCase();
    const academicYear = String(body.academicYear ?? body.schoolYear ?? '').trim();
    return { batchNo, program, academicYear };
}

const PROGRAM_CODE_PATTERN = /^[A-Z0-9]{2,12}$/;

function isValidBatchFields({ batchNo, program, academicYear }) {
    if (!batchNo || !program || !academicYear) return false;
    return PROGRAM_CODE_PATTERN.test(program);
}

function serializeLandingBatch(doc) {
    return {
        id: String(doc._id),
        batchNo: doc.batchNo,
        program: doc.program,
        academicYear: doc.academicYear,
        schoolYear: doc.academicYear,
        published: Boolean(doc.published),
        granteeCount: Number(doc.granteeCount) || 0,
        grantees: Number(doc.granteeCount) || 0,
        publishedAt: doc.publishedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

async function countGranteesForBatch({ batchNo, program, academicYear }) {
    return Grantee.countDocuments({
        batchNo,
        program,
        academicYear,
        active: { $ne: false },
    });
}

async function migrateLegacyPublishedKeys() {
    const existingCount = await LandingBatch.countDocuments({ published: true });
    if (existingCount > 0) return;

    const settings = await LandingSettings.findOne({ key: SETTINGS_KEY });
    const keys = Array.isArray(settings?.publishedBatchKeys) ? settings.publishedBatchKeys : [];
    if (!keys.length) return;

    for (const key of keys) {
        const parts = String(key).split('|');
        if (parts.length < 3) continue;
        const [batchNo, program, academicYear] = parts;
        if (!isValidBatchFields({ batchNo, program, academicYear })) continue;

        const granteeCount = await countGranteesForBatch({ batchNo, program, academicYear });
        await LandingBatch.findOneAndUpdate(
            { batchNo, program, academicYear },
            {
                $set: {
                    published: true,
                    granteeCount,
                    publishedAt: new Date(),
                },
            },
            { upsert: true, setDefaultsOnInsert: true },
        );
    }
}

exports.listLandingBatches = async (req, res) => {
    try {
        if (!req.userId && req.query.published !== 'true') {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        await migrateLegacyPublishedKeys();

        const filter = {};
        if (req.query.published === 'true') {
            filter.published = true;
        }

        const rows = await LandingBatch.find(filter)
            .sort({ publishedAt: -1, updatedAt: -1 })
            .lean();

        const payload = await Promise.all(
            rows.map(async (row) => {
                const granteeCount = await countGranteesForBatch({
                    batchNo: row.batchNo,
                    program: row.program,
                    academicYear: row.academicYear,
                });
                return serializeLandingBatch({ ...row, granteeCount });
            }),
        );

        if (req.query.published === 'true') {
            return res.status(200).json(payload.filter((row) => row.granteeCount > 0));
        }

        return res.status(200).json(payload);
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to load landing batches.',
        });
    }
};

exports.publishLandingBatch = async (req, res) => {
    try {
        const fields = normalizeBatchFields(req.body);
        if (!isValidBatchFields(fields)) {
            return res.status(400).json({
                message: 'batchNo, program, and academicYear are required.',
            });
        }

        let granteeCount = Number(req.body?.granteeCount);
        if (!Number.isFinite(granteeCount) || granteeCount < 0) {
            granteeCount = await countGranteesForBatch(fields);
        }

        const doc = await LandingBatch.findOneAndUpdate(
            fields,
            {
                $set: {
                    published: true,
                    granteeCount,
                    publishedAt: new Date(),
                },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );

        return res.status(200).json(serializeLandingBatch(doc));
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to publish landing batch.',
        });
    }
};

exports.unpublishLandingBatch = async (req, res) => {
    try {
        const fields = normalizeBatchFields(req.body);
        if (!isValidBatchFields(fields)) {
            return res.status(400).json({
                message: 'batchNo, program, and academicYear are required.',
            });
        }

        const doc = await LandingBatch.findOneAndUpdate(
            fields,
            {
                $set: {
                    published: false,
                    publishedAt: null,
                },
            },
            { new: true },
        );

        if (!doc) {
            return res.status(200).json({ unpublished: false });
        }

        return res.status(200).json(serializeLandingBatch(doc));
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to unpublish landing batch.',
        });
    }
};

exports.renameLandingBatch = async (req, res) => {
    try {
        const original = normalizeBatchFields(req.body?.original ?? req.body);
        const updated = normalizeBatchFields(req.body?.updated ?? {});

        if (!isValidBatchFields(original) || !isValidBatchFields(updated)) {
            return res.status(400).json({
                message: 'Original and updated batchNo, program, and academicYear are required.',
            });
        }

        const existing = await LandingBatch.findOne(original);
        if (!existing) {
            return res.status(200).json({ renamed: false });
        }

        const granteeCount = await countGranteesForBatch(updated);
        const doc = await LandingBatch.findOneAndUpdate(
            { _id: existing._id },
            {
                $set: {
                    batchNo: updated.batchNo,
                    program: updated.program,
                    academicYear: updated.academicYear,
                    granteeCount,
                },
            },
            { new: true },
        );

        return res.status(200).json({ renamed: true, batch: serializeLandingBatch(doc) });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({
                message: 'A landing batch with the updated identifiers already exists.',
            });
        }
        return res.status(500).json({
            message: error.message || 'Failed to rename landing batch.',
        });
    }
};
