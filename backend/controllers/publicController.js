const Grantee = require('../models/GranteeModel');
const LandingBatch = require('../models/LandingBatchModel');
const LandingSettings = require('../models/LandingSettingsModel');

const SETTINGS_KEY = 'default';
const REDACTED = '••••';

const DEFAULT_PRIVACY = {
    showStudentIdInLandingBatchList: false,
    showAwardNumberInLandingBatchList: false,
    showFullNameInLandingBatchList: false,
    showEnrolledProgramInLandingBatchList: false,
    showYearLevelInLandingBatchList: false,
};

const PROGRAM_CODE_PATTERN = /^[A-Z0-9]{2,12}$/;

function normalizePrivacy(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        showStudentIdInLandingBatchList:
            source.showStudentIdInLandingBatchList ?? DEFAULT_PRIVACY.showStudentIdInLandingBatchList,
        showAwardNumberInLandingBatchList:
            source.showAwardNumberInLandingBatchList ?? DEFAULT_PRIVACY.showAwardNumberInLandingBatchList,
        showFullNameInLandingBatchList:
            source.showFullNameInLandingBatchList ?? DEFAULT_PRIVACY.showFullNameInLandingBatchList,
        showEnrolledProgramInLandingBatchList:
            source.showEnrolledProgramInLandingBatchList ?? DEFAULT_PRIVACY.showEnrolledProgramInLandingBatchList,
        showYearLevelInLandingBatchList:
            source.showYearLevelInLandingBatchList ?? DEFAULT_PRIVACY.showYearLevelInLandingBatchList,
    };
}

async function loadLandingPrivacy() {
    const doc = await LandingSettings.findOne({ key: SETTINGS_KEY }).lean();
    return normalizePrivacy(doc?.privacy);
}

function redactField(value, allowed) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return allowed ? text : REDACTED;
}

function sanitizePublicSemesterClaims(claims = []) {
    if (!Array.isArray(claims)) return [];
    return claims.map((claim) => ({
        yearLevel: String(claim?.yearLevel ?? '').trim(),
        firstSem: String(claim?.firstSem ?? 'Unclaimed').trim() || 'Unclaimed',
        secondSem: String(claim?.secondSem ?? 'Unclaimed').trim() || 'Unclaimed',
    }));
}

function serializePublicGrantee(doc, privacy) {
    const updatedAt = doc.updatedAt ?? doc.createdAt;
    let lastUpdated = '';
    if (updatedAt) {
        const d = new Date(updatedAt);
        if (!Number.isNaN(d.getTime())) {
            lastUpdated = d.toISOString().slice(0, 10);
        }
    }

    const program = String(doc.program ?? '').trim().toUpperCase();
    const academicYear = String(doc.academicYear ?? '').trim();

    return {
        _id: doc._id,
        id: String(doc._id),
        program,
        seqNo: String(doc.seqNo ?? '').trim(),
        studentId: redactField(doc.studentId, privacy.showStudentIdInLandingBatchList),
        awardNumber: redactField(doc.awardNumber, privacy.showAwardNumberInLandingBatchList),
        fullName: redactField(doc.fullName, privacy.showFullNameInLandingBatchList) || 'Unknown',
        batchNo: String(doc.batchNo ?? '').trim(),
        status: String(doc.status ?? 'Unclaimed').trim() || 'Unclaimed',
        active: doc.active !== false,
        enrolledProgram: redactField(doc.enrolledProgram, privacy.showEnrolledProgramInLandingBatchList),
        yearLevel: redactField(doc.yearLevel, privacy.showYearLevelInLandingBatchList),
        academicYear,
        grantCycle:
            String(doc.grantCycle ?? '').trim() ||
            (program && academicYear ? `${program} · AY ${academicYear}` : ''),
        lastUpdated,
        updatedAt: doc.updatedAt ?? null,
        createdAt: doc.createdAt ?? null,
        semesterClaims: sanitizePublicSemesterClaims(doc.semesterClaims),
    };
}

exports.getPublicBatchGrantees = async (req, res) => {
    try {
        const batchNo = String(req.query.batchNo ?? '').trim();
        const program = String(req.query.program ?? '').trim().toUpperCase();
        const academicYear = String(req.query.academicYear ?? '').trim();

        if (!batchNo || !program || !academicYear) {
            return res.status(400).json({
                message: 'batchNo, program, and academicYear are required.',
            });
        }

        if (!PROGRAM_CODE_PATTERN.test(program)) {
            return res.status(400).json({ message: 'Invalid program code.' });
        }

        const publishedBatch = await LandingBatch.findOne({
            batchNo,
            program,
            academicYear,
            published: true,
        }).lean();

        if (!publishedBatch) {
            return res.status(404).json({ message: 'Published batch not found.' });
        }

        const privacy = await loadLandingPrivacy();
        const grantees = await Grantee.find({
            batchNo,
            program,
            academicYear,
            active: { $ne: false },
        })
            .sort({ seqNo: 1 })
            .lean();

        return res.status(200).json(grantees.map((doc) => serializePublicGrantee(doc, privacy)));
    } catch (error) {
        console.error('getPublicBatchGrantees error:', error);
        return res.status(500).json({ message: 'Failed to load published batch grantees.' });
    }
};
