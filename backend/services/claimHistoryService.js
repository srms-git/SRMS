const Grantee = require('../models/GranteeModel');
const ClaimHistory = require('../models/ClaimHistoryModel');

const GRANTEE_POPULATE_FIELDS =
    'seqNo awardNumber enrolledProgram yearLevel email phoneNumber bankAccount grantCycle updatedAt';

function buildProgramFilter(program) {
    if (program === 'TES') {
        return {
            $or: [
                { program: 'TES' },
                { awardNumber: { $regex: '^TES-', $options: 'i' } },
            ],
        };
    }
    if (program === 'TDP') {
        return {
            $or: [
                { program: 'TDP' },
                { awardNumber: { $regex: '^TDP-', $options: 'i' } },
            ],
        };
    }
    if (program) {
        return { program };
    }
    return {};
}

function buildGranteeFilterFromQuery(query = {}) {
    const parts = [];
    const program = String(query.program ?? '').trim().toUpperCase();
    const programFilter = buildProgramFilter(program);
    if (Object.keys(programFilter).length > 0) {
        parts.push(programFilter);
    }

    const batchNo = String(query.batchNo ?? '').trim();
    if (batchNo) {
        parts.push({ batchNo });
    }

    const academicYear = String(query.academicYear ?? '').trim();
    if (academicYear) {
        parts.push({ academicYear });
    }

    if (parts.length === 0) return {};
    if (parts.length === 1) return parts[0];
    return { $and: parts };
}

function buildClaimHistoryFilters(query = {}) {
    const filters = {};
    const program = String(query.program ?? '').trim().toUpperCase();
    const batchNo = String(query.batchNo ?? '').trim();
    const academicYear = String(query.academicYear ?? '').trim();

    if (program) filters.program = program;
    if (batchNo) filters.batchNo = batchNo;
    if (academicYear) filters.academicYear = academicYear;

    return filters;
}

function parseClaimedAt(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function matchesSearch(row, query) {
    const q = String(query ?? '').trim().toLowerCase();
    if (!q) return true;

    const grantee = row.granteeId && typeof row.granteeId === 'object' ? row.granteeId : {};
    const haystack = [
        row.fullName,
        row.studentId,
        row.batchNo,
        row.program,
        grantee.awardNumber,
        grantee.seqNo,
        grantee.enrolledProgram,
        row.yearLevelOnClaim,
        row.semester,
        row.claimedBy,
        row.otherName,
        row.academicYear,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return haystack.includes(q);
}

function matchesRowFilters(row, query = {}) {
    const semester = String(query.semester ?? '').trim();
    if (semester && row.semester !== semester) return false;

    const claimedBy = String(query.claimedBy ?? '').trim();
    if (claimedBy && row.claimedBy !== claimedBy) return false;

    return true;
}

/**
 * Only semesters with an explicit claimed-at timestamp count as real claim events.
 * UI may mark prior year levels "Claimed" without a timestamp (synthetic progression).
 */
function timestampedSemesterEvents(grantee) {
    const events = [];
    const claims = Array.isArray(grantee.semesterClaims) ? grantee.semesterClaims : [];

    for (const claim of claims) {
        const yearLevelOnClaim = String(claim.yearLevel ?? '').trim();
        if (!yearLevelOnClaim) continue;

        const firstAt = parseClaimedAt(claim.firstSemClaimedAt);
        if (claim.firstSem === 'Claimed' && firstAt) {
            events.push({
                yearLevelOnClaim,
                semester: '1st Semester',
                claimedBy: String(claim.firstSemClaimer ?? '').trim() || 'Grantee',
                otherName: claim.firstSemOtherName ?? '',
                claimedAt: firstAt,
            });
        }

        const secondAt = parseClaimedAt(claim.secondSemClaimedAt);
        if (claim.secondSem === 'Claimed' && secondAt) {
            events.push({
                yearLevelOnClaim,
                semester: '2nd Semester',
                claimedBy: String(claim.secondSemClaimer ?? '').trim() || 'Grantee',
                otherName: claim.secondSemOtherName ?? '',
                claimedAt: secondAt,
            });
        }
    }

    return events;
}

function buildUpsertPayload(grantee, event) {
    return {
        granteeId: grantee._id,
        studentId: grantee.studentId,
        fullName: grantee.fullName,
        program: String(grantee.program ?? '').trim().toUpperCase(),
        batchNo: grantee.batchNo,
        academicYear: grantee.academicYear,
        yearLevelOnClaim: event.yearLevelOnClaim,
        semester: event.semester,
        claimedBy: event.claimedBy,
        otherName: event.otherName,
        claimedAt: event.claimedAt,
    };
}

/** Backfill ledger rows for grantees that have real claim timestamps but no history document yet. */
async function syncTimestampedClaimHistory(granteeFilter = {}) {
    const grantees = await Grantee.find(granteeFilter).lean();
    const ops = [];

    for (const grantee of grantees) {
        for (const event of timestampedSemesterEvents(grantee)) {
            const payload = buildUpsertPayload(grantee, event);
            ops.push({
                updateOne: {
                    filter: {
                        granteeId: grantee._id,
                        yearLevelOnClaim: event.yearLevelOnClaim,
                        semester: event.semester,
                    },
                    update: { $setOnInsert: payload },
                    upsert: true,
                },
            });
        }
    }

    if (ops.length === 0) return { upserted: 0 };
    const result = await ClaimHistory.bulkWrite(ops, { ordered: false });
    return { upserted: result.upsertedCount ?? 0 };
}

async function fetchClaimHistory(query = {}) {
    const granteeFilter = buildGranteeFilterFromQuery(query);
    const historyFilters = buildClaimHistoryFilters(query);

    await syncTimestampedClaimHistory(granteeFilter);

    let historyLogs = await ClaimHistory.find(historyFilters)
        .populate('granteeId', GRANTEE_POPULATE_FIELDS)
        .sort({ claimedAt: -1 })
        .lean();

    historyLogs = historyLogs.filter((row) => matchesRowFilters(row, query));

    if (query.search) {
        historyLogs = historyLogs.filter((row) => matchesSearch(row, query.search));
    }

    return historyLogs;
}

module.exports = {
    GRANTEE_POPULATE_FIELDS,
    buildGranteeFilterFromQuery,
    buildClaimHistoryFilters,
    timestampedSemesterEvents,
    syncTimestampedClaimHistory,
    fetchClaimHistory,
    matchesSearch,
    matchesRowFilters,
};
