const Archive = require('../models/ArchiveModel');
const Grantee = require('../models/GranteeModel');

function isClaimedStatus(status) {
    return String(status ?? '').trim().toLowerCase() === 'claimed';
}

function buildBatchFilter(batchNo, program, academicYear) {
    return {
        batchNo: String(batchNo).trim(),
        program: String(program).trim().toUpperCase(),
        academicYear: String(academicYear).trim(),
    };
}

function resolveFullyClaimedAt(grantees) {
    let maxTime = 0;
    for (const grantee of grantees) {
        const candidate = grantee.updatedAt || grantee.createdAt;
        const time = candidate ? new Date(candidate).getTime() : 0;
        if (Number.isFinite(time) && time > maxTime) {
            maxTime = time;
        }
    }
    return maxTime > 0 ? new Date(maxTime) : new Date();
}

function mapArchivedBatchSummary(doc) {
    const batchDetails = doc.batchDetails && typeof doc.batchDetails === 'object' ? doc.batchDetails : {};
    const snapshotCount = Array.isArray(doc.granteesSnapshot) ? doc.granteesSnapshot.length : 0;

    return {
        _id: doc._id,
        batchNo: doc.batchNo,
        schoolYear: doc.schoolYear,
        program: doc.grantType || batchDetails.program || '',
        grantType: doc.grantType,
        totalGrantees: batchDetails.totalGrantees ?? snapshotCount,
        fullyClaimedAt: batchDetails.fullyClaimedAt ?? null,
        archivedAt: doc.createdAt,
        createdAt: doc.createdAt,
        archiveReason: doc.archiveReason,
    };
}

async function archiveGranteeGroup(filter, relatedGrantees, options = {}) {
    const fullyClaimedAt =
        options.fullyClaimedAt !== undefined ? options.fullyClaimedAt : resolveFullyClaimedAt(relatedGrantees);
    const batchDetails = {
        batchNo: filter.batchNo,
        program: filter.program,
        academicYear: filter.academicYear,
        schoolYear: filter.academicYear,
        grantType: filter.program,
        totalGrantees: relatedGrantees.length,
        fullyClaimedAt,
    };

    const archivedRecord = await Archive.create({
        recordType: 'Batch',
        batchNo: filter.batchNo,
        schoolYear: filter.academicYear,
        grantType: filter.program,
        batchDetails,
        granteesSnapshot: relatedGrantees.map((grantee) =>
            typeof grantee.toObject === 'function' ? grantee.toObject() : grantee
        ),
        archivedBy: options.archivedBy,
        archiveReason: options.reason || 'All grantees confirmed claimed (Automatic System Archive)',
    });

    await Grantee.deleteMany(filter);

    return archivedRecord;
}

/**
 * Archives a batch when every grantee in the group has status "claimed".
 * Returns { isArchived, newlyArchived, archivedId?, message }.
 * newlyArchived is true only when a new archive record was created (not when already archived).
 */
async function archiveBatchIfFullyClaimed({ batchNo, program, academicYear, reason, archivedBy }) {
    if (!batchNo || !program || !academicYear) {
        return {
            isArchived: false,
            newlyArchived: false,
            message: 'batchNo, program, and academicYear are required.',
        };
    }

    const filter = buildBatchFilter(batchNo, program, academicYear);

    const existingArchive = await Archive.findOne({
        recordType: 'Batch',
        batchNo: filter.batchNo,
        grantType: filter.program,
        schoolYear: filter.academicYear,
    });
    if (existingArchive) {
        return {
            isArchived: true,
            newlyArchived: false,
            archivedId: existingArchive._id,
            message: `Batch ${filter.batchNo} is already archived.`,
        };
    }

    const relatedGrantees = await Grantee.find(filter).sort({ seqNo: 1, createdAt: -1 });

    if (relatedGrantees.length === 0) {
        return {
            isArchived: false,
            newlyArchived: false,
            message: `No active grantees found for batch ${filter.batchNo}.`,
        };
    }

    const allGranteesClaimed = relatedGrantees.every((grantee) => isClaimedStatus(grantee.status));

    if (!allGranteesClaimed) {
        return {
            isArchived: false,
            newlyArchived: false,
            message: `Batch ${filter.batchNo} has grantees that are not fully claimed yet.`,
        };
    }

    const archivedRecord = await archiveGranteeGroup(filter, relatedGrantees, { reason, archivedBy });

    return {
        isArchived: true,
        newlyArchived: true,
        archivedId: archivedRecord._id,
        message: `Batch ${filter.batchNo} archived with ${relatedGrantees.length} grantees.`,
    };
}

/**
 * Archives a batch on demand, regardless of individual grantee claim status.
 * Returns { isArchived, newlyArchived, archivedId?, message }.
 */
async function archiveBatchManually({ batchNo, program, academicYear, reason, archivedBy }) {
    if (!batchNo || !program || !academicYear) {
        return {
            isArchived: false,
            newlyArchived: false,
            message: 'batchNo, program, and academicYear are required.',
        };
    }

    const filter = buildBatchFilter(batchNo, program, academicYear);

    const existingArchive = await Archive.findOne({
        recordType: 'Batch',
        batchNo: filter.batchNo,
        grantType: filter.program,
        schoolYear: filter.academicYear,
    });
    if (existingArchive) {
        return {
            isArchived: true,
            newlyArchived: false,
            archivedId: existingArchive._id,
            message: `Batch ${filter.batchNo} is already archived.`,
        };
    }

    const relatedGrantees = await Grantee.find(filter).sort({ seqNo: 1, createdAt: -1 });

    if (relatedGrantees.length === 0) {
        return {
            isArchived: false,
            newlyArchived: false,
            message: `No active grantees found for batch ${filter.batchNo}.`,
        };
    }

    const allGranteesClaimed = relatedGrantees.every((grantee) => isClaimedStatus(grantee.status));
    const fullyClaimedAt = allGranteesClaimed ? resolveFullyClaimedAt(relatedGrantees) : null;

    const archivedRecord = await archiveGranteeGroup(filter, relatedGrantees, {
        reason: reason || 'Manual archive by OSGFA staff',
        archivedBy,
        fullyClaimedAt,
    });

    return {
        isArchived: true,
        newlyArchived: true,
        archivedId: archivedRecord._id,
        message: `Batch ${filter.batchNo} manually archived with ${relatedGrantees.length} grantees.`,
    };
}

/**
 * Scans all active grantee batches and archives any where every student is claimed.
 */
async function syncAllFullyClaimedBatches() {
    const eligibleGroups = await Grantee.aggregate([
        {
            $group: {
                _id: {
                    batchNo: '$batchNo',
                    program: '$program',
                    academicYear: '$academicYear',
                },
                total: { $sum: 1 },
                claimed: {
                    $sum: {
                        $cond: [
                            {
                                $eq: [
                                    { $toLower: { $trim: { input: { $ifNull: ['$status', ''] } } } },
                                    'claimed',
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
        {
            $match: {
                $expr: {
                    $and: [{ $gt: ['$total', 0] }, { $eq: ['$total', '$claimed'] }],
                },
            },
        },
    ]);

    const results = [];
    for (const group of eligibleGroups) {
        const batchNo = group?._id?.batchNo;
        const program = group?._id?.program;
        const academicYear = group?._id?.academicYear;
        if (!batchNo || !program || !academicYear) continue;

        const outcome = await archiveBatchIfFullyClaimed({ batchNo, program, academicYear });
        results.push({ batchNo, program, academicYear, ...outcome });
    }

    return results;
}

async function listArchivedBatchSummaries() {
    const archivedList = await Archive.find({ recordType: 'Batch' })
        .select('batchNo schoolYear grantType createdAt archiveReason batchDetails granteesSnapshot')
        .sort({ createdAt: -1 })
        .lean();

    return archivedList.map(mapArchivedBatchSummary);
}

async function getArchivedBatchDetail({ batchNo, program, academicYear }) {
    if (!batchNo || !program || !academicYear) {
        return null;
    }

    const filter = buildBatchFilter(batchNo, program, academicYear);
    const doc = await Archive.findOne({
        recordType: 'Batch',
        batchNo: filter.batchNo,
        grantType: filter.program,
        schoolYear: filter.academicYear,
    }).lean();

    if (!doc) {
        return null;
    }

    return {
        ...mapArchivedBatchSummary(doc),
        grantees: Array.isArray(doc.granteesSnapshot) ? doc.granteesSnapshot : [],
    };
}

module.exports = {
    archiveBatchIfFullyClaimed,
    archiveBatchManually,
    syncAllFullyClaimedBatches,
    listArchivedBatchSummaries,
    getArchivedBatchDetail,
    mapArchivedBatchSummary,
    isClaimedStatus,
};
