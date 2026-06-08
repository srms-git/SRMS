const Grantee = require('../models/GranteeModel');
const ClaimHistory = require('../models/ClaimHistoryModel');
const { archiveBatchIfFullyClaimed } = require('../services/archiveService');
const { createInternalNotification } = require('./notificationController');
const { logActivity } = require('../services/auditLogger');
const { sanitizeGranteeOtherPersonFields } = require('../utils/granteeOtherPersonFields');

const DEFAULT_YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

function yearLevelIndexForDefaults(yearLevel) {
    const i = DEFAULT_YEAR_LEVELS.indexOf(String(yearLevel ?? '').trim());
    return i >= 0 ? i : 0;
}

function buildDefaultSemesterClaims(yearLevel) {
    const count = yearLevelIndexForDefaults(yearLevel) + 1;
    return DEFAULT_YEAR_LEVELS.slice(0, count).map((yl) => ({
        yearLevel: yl,
        firstSem: 'Unclaimed',
        secondSem: 'Unclaimed',
    }));
}

function mapBatchRow(row, program, batchNo, academicYear) {
    const yearLevel = String(row?.yearLevel ?? '').trim();
    return {
        program: String(program).trim().toUpperCase(),
        batchNo: String(batchNo).trim(),
        academicYear: String(academicYear).trim(),
        seqNo: String(row?.seqNo ?? '').trim(),
        studentId: String(row?.studentId ?? '').trim(),
        awardNumber: String(row?.awardNumber ?? '').trim(),
        fullName: String(row?.fullName ?? '').trim() || 'Unknown',
        enrolledProgram: String(row?.enrolledProgram ?? '').trim(),
        yearLevel,
        status: 'Unclaimed',
        active: true,
        semesterClaims: buildDefaultSemesterClaims(yearLevel),
    };
}

function buildOriginalBatchFilter(originalBatchNo, originalProgram, originalAcademicYear) {
    const parts = [
        { batchNo: String(originalBatchNo).trim() },
        buildProgramFilter(String(originalProgram).trim().toUpperCase()),
    ];

    const academicYear = String(originalAcademicYear ?? '').trim();
    if (academicYear) {
        parts.push({ academicYear });
    }

    const filtered = parts.filter((part) => Object.keys(part).length > 0);
    if (filtered.length === 0) return {};
    if (filtered.length === 1) return filtered[0];
    return { $and: filtered };
}

exports.batchUpdateGrantees = async (req, res) => {
    try {
        const {
            originalBatchNo,
            originalProgram,
            originalAcademicYear,
            newBatchNo,
            newProgram,
            newAcademicYear,
        } = req.body;

        if (!originalBatchNo || !originalProgram || !originalAcademicYear) {
            return res.status(400).json({
                message: 'originalBatchNo, originalProgram, and originalAcademicYear are required.',
            });
        }

        if (!newBatchNo || !newProgram || !newAcademicYear) {
            return res.status(400).json({
                message: 'newBatchNo, newProgram, and newAcademicYear are required.',
            });
        }

        const normalizedNewProgram = String(newProgram).trim().toUpperCase();
        const normalizedNewBatchNo = String(newBatchNo).trim();
        const normalizedNewAcademicYear = String(newAcademicYear).trim();
        const grantCycle = `${normalizedNewProgram} · AY ${normalizedNewAcademicYear}`;

        const originalFilter = buildOriginalBatchFilter(
            originalBatchNo,
            originalProgram,
            originalAcademicYear,
        );
        const granteesToUpdate = await Grantee.find(originalFilter);

        if (granteesToUpdate.length === 0) {
            return res.status(404).json({ message: 'No grantees found for the specified batch.' });
        }

        const granteeIds = granteesToUpdate.map((doc) => doc._id);
        const duplicate = await Grantee.findOne({
            batchNo: normalizedNewBatchNo,
            ...buildProgramFilter(normalizedNewProgram),
            _id: { $nin: granteeIds },
        }).select('_id');

        if (duplicate) {
            return res.status(409).json({
                message: `Batch number ${normalizedNewBatchNo} already exists for the ${normalizedNewProgram} program.`,
                code: 'BATCH_NUMBER_CONFLICT',
            });
        }

        await Grantee.updateMany(
            { _id: { $in: granteeIds } },
            {
                $set: {
                    batchNo: normalizedNewBatchNo,
                    program: normalizedNewProgram,
                    academicYear: normalizedNewAcademicYear,
                    grantCycle,
                },
            },
        );

        await ClaimHistory.updateMany(
            { granteeId: { $in: granteeIds } },
            {
                $set: {
                    batchNo: normalizedNewBatchNo,
                    program: normalizedNewProgram,
                    academicYear: normalizedNewAcademicYear,
                },
            },
        );

        // Audit the complete batch transfer sequence
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'BATCH_GRANTEES_METADATA_UPDATED',
            entityType: 'grantees',
            entityId: `${normalizedNewProgram}-${normalizedNewBatchNo}`.toLowerCase(),
            oldValues: { originalBatchNo, originalProgram, originalAcademicYear },
            newValues: { batchNo: normalizedNewBatchNo, program: normalizedNewProgram, academicYear: normalizedNewAcademicYear, totalRecordsAffected: granteesToUpdate.length },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json({
            message: 'Batch details updated successfully.',
            count: granteesToUpdate.length,
            batchNo: normalizedNewBatchNo,
            program: normalizedNewProgram,
            academicYear: normalizedNewAcademicYear,
        });
    } catch (error) {
        console.error('batchUpdateGrantees error:', error);
        const status = error?.statusCode ?? 500;
        return res.status(status).json({
            message: error.message || 'Failed to update batch details.',
        });
    }
};

exports.batchSaveGrantees = async (req, res) => {
    try {
        const { program, batchNo, academicYear, granteeRows } = req.body;

        if (!program || !batchNo || !academicYear) {
            return res.status(400).json({ message: 'program, batchNo, and academicYear are required.' });
        }

        if (!Array.isArray(granteeRows) || granteeRows.length === 0) {
            return res.status(400).json({ message: 'granteeRows must be a non-empty array.' });
        }

        const docs = granteeRows.map((row) => mapBatchRow(row, program, batchNo, academicYear));
        const inserted = await Grantee.insertMany(docs);

        // Dispatch notification indicating a brand-new batch cluster has successfully landed
        await createInternalNotification(
            `New batch ${batchNo} is now available`,
            `A new ${program.toUpperCase()} batch was added for School Year ${academicYear} containing ${inserted.length} records and is ready for grantee encoding.`,
            'batch'
        );

        // Log mass import action to audit logs
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'BATCH_GRANTEES_BULK_UPLOADED',
            entityType: 'grantees',
            entityId: `${program}-${batchNo}`.toLowerCase(),
            oldValues: null,
            newValues: { program, batchNo, academicYear, totalInserted: inserted.length },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(201).json({
            message: 'Batch saved successfully.',
            count: inserted.length,
        });
    } catch (error) {
        console.error('batchSaveGrantees error:', error);
        const message =
            error?.code === 11000
                ? 'Duplicate grantee data. If this persists, restart the backend so legacy database indexes can be removed.'
                : error.message || 'Failed to save grantee batch.';
        return res.status(500).json({ message });
    }
};

exports.createGrantee = async (req, res) => {
    try {
        const grantee = await Grantee.create(req.body);

        // Log standalone individual creation events
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'GRANTEE_RECORD_CREATED',
            entityType: 'grantees',
            entityId: grantee._id,
            oldValues: null,
            newValues: { studentId: grantee.studentId, fullName: grantee.fullName, program: grantee.program, batchNo: grantee.batchNo },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(201).json(grantee);
    } catch (error) {
        console.error('createGrantee error:', error);
        return res.status(400).json({ message: error.message || 'Failed to create grantee.' });
    }
};

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

function buildGranteeListQuery(req) {
    const parts = [];
    const program = String(req.query.program ?? '').trim().toUpperCase();
    const programFilter = buildProgramFilter(program);
    if (Object.keys(programFilter).length > 0) {
        parts.push(programFilter);
    }

    const batchNo = String(req.query.batchNo ?? '').trim();
    if (batchNo) {
        parts.push({ batchNo });
    }

    const academicYear = String(req.query.academicYear ?? '').trim();
    if (academicYear) {
        parts.push({ academicYear });
    }

    if (String(req.query.activeOnly ?? '').trim().toLowerCase() === 'true') {
        parts.push({ active: { $ne: false } });
    }

    if (parts.length === 0) return {};
    if (parts.length === 1) return parts[0];
    return { $and: parts };
}

exports.bulkUpdateGranteeActive = async (req, res) => {
    try {
        const { ids, active } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'ids must be a non-empty array.' });
        }

        if (typeof active !== 'boolean') {
            return res.status(400).json({ message: 'active must be a boolean.' });
        }

        const normalizedIds = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))];
        if (normalizedIds.length === 0) {
            return res.status(400).json({ message: 'ids must contain at least one valid grantee id.' });
        }

        const remarks = String(req.body?.remarks ?? req.body?.inactiveRemarks ?? '').trim();
        if (!active && !remarks) {
            return res.status(400).json({ message: 'Remarks are required when marking grantees inactive.' });
        }

        const updateSet = { active };
        updateSet.inactiveRemarks = active ? '' : remarks;

        const result = await Grantee.updateMany({ _id: { $in: normalizedIds } }, { $set: updateSet });
        const updatedGrantees = await Grantee.find({ _id: { $in: normalizedIds } }).sort({ seqNo: 1, createdAt: -1 });

        logActivity({
            userId: req.user?.id || req.userId || null,
            action: active ? 'GRANTEE_RECORDS_ACTIVATED' : 'GRANTEE_RECORDS_DEACTIVATED',
            entityType: 'grantees',
            entityId: normalizedIds.join(','),
            oldValues: null,
            newValues: {
                active,
                inactiveRemarks: active ? '' : remarks,
                totalRecordsAffected: result.modifiedCount,
            },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        });

        return res.status(200).json({
            message: active
                ? `${result.modifiedCount} grantee record(s) marked active.`
                : `${result.modifiedCount} grantee record(s) marked inactive.`,
            count: result.modifiedCount,
            grantees: updatedGrantees,
        });
    } catch (error) {
        console.error('bulkUpdateGranteeActive error:', error);
        return res.status(500).json({ message: error.message || 'Failed to update grantee record status.' });
    }
};

exports.getAllGrantees = async (req, res) => {
    try {
        const filter = buildGranteeListQuery(req);
        const grantees = await Grantee.find(filter).sort({ seqNo: 1, createdAt: -1 });
        return res.status(200).json(grantees);
    } catch (error) {
        console.error('getAllGrantees error:', error);
        return res.status(500).json({ message: error.message || 'Failed to fetch grantees.' });
    }
};

exports.getGranteeById = async (req, res) => {
    try {
        const grantee = await Grantee.findById(req.params.id);
        if (!grantee) {
            return res.status(404).json({ message: 'Grantee not found.' });
        }
        return res.status(200).json(grantee);
    } catch (error) {
        console.error('getGranteeById error:', error);
        return res.status(500).json({ message: error.message || 'Failed to fetch grantee.' });
    }
};

exports.updateGrantee = async (req, res) => {
    try {
        const previousState = await Grantee.findById(req.params.id);
        if (!previousState) {
            return res.status(404).json({ message: 'Grantee not found.' });
        }

        const updateBody = sanitizeGranteeOtherPersonFields({ ...req.body });
        const historyCreates = [];

        if (updateBody.semesterClaims && Array.isArray(updateBody.semesterClaims)) {
            const timestamp = new Date();

            updateBody.semesterClaims = updateBody.semesterClaims.map((newClaim) => {
                const oldClaim = (previousState.semesterClaims ?? []).find(
                    (c) => c.yearLevel === newClaim.yearLevel
                );
                const clonedClaim = { ...newClaim };

                if (oldClaim && oldClaim.firstSem !== 'Claimed' && clonedClaim.firstSem === 'Claimed') {
                    clonedClaim.firstSemClaimedAt = timestamp;
                    historyCreates.push({
                        yearLevelOnClaim: clonedClaim.yearLevel,
                        semester: '1st Semester',
                        claimedBy: clonedClaim.firstSemClaimer || 'Grantee',
                        otherName: clonedClaim.firstSemOtherName || '',
                        claimedAt: timestamp,
                    });
                } else if (oldClaim?.firstSemClaimedAt) {
                    clonedClaim.firstSemClaimedAt = oldClaim.firstSemClaimedAt;
                }

                if (oldClaim && oldClaim.secondSem !== 'Claimed' && clonedClaim.secondSem === 'Claimed') {
                    clonedClaim.secondSemClaimedAt = timestamp;
                    historyCreates.push({
                        yearLevelOnClaim: clonedClaim.yearLevel,
                        semester: '2nd Semester',
                        claimedBy: clonedClaim.secondSemClaimer || 'Grantee',
                        otherName: clonedClaim.secondSemOtherName || '',
                        claimedAt: timestamp,
                    });
                } else if (oldClaim?.secondSemClaimedAt) {
                    clonedClaim.secondSemClaimedAt = oldClaim.secondSemClaimedAt;
                }

                return clonedClaim;
            });
        }

        const grantee = await Grantee.findByIdAndUpdate(req.params.id, updateBody, {
            new: true,
            runValidators: true,
        });

        for (const event of historyCreates) {
            try {
                await ClaimHistory.updateOne(
                    {
                        granteeId: grantee._id,
                        yearLevelOnClaim: event.yearLevelOnClaim,
                        semester: event.semester,
                    },
                    {
                        $setOnInsert: {
                            granteeId: grantee._id,
                            studentId: grantee.studentId,
                            fullName: grantee.fullName,
                            program: grantee.program,
                            batchNo: grantee.batchNo,
                            academicYear: grantee.academicYear,
                            yearLevelOnClaim: event.yearLevelOnClaim,
                            semester: event.semester,
                            claimedBy: event.claimedBy,
                            otherName: event.otherName,
                            claimedAt: event.claimedAt,
                        },
                    },
                    { upsert: true }
                );
            } catch (err) {
                console.error('Error logging claim history line:', err);
            }
        }

        // Audit the details/claims modification transaction snapshot
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'GRANTEE_RECORD_MUTATED',
            entityType: 'grantees',
            entityId: grantee._id,
            oldValues: { fullName: previousState.fullName, studentId: previousState.studentId, semesterClaimsCount: (previousState.semesterClaims || []).length },
            newValues: { fullName: grantee.fullName, studentId: grantee.studentId, logsDispatched: historyCreates.length },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        try {
            const outcome = await archiveBatchIfFullyClaimed({
                batchNo: grantee.batchNo,
                program: grantee.program,
                academicYear: grantee.academicYear,
            });

            if (outcome?.newlyArchived) {
                await createInternalNotification(
                    `Batch ${grantee.batchNo} reached 100% claimed status`,
                    `All grantees under ${grantee.program} batch ${grantee.batchNo} are officially marked claimed following latest allocation updates.`,
                    'claim'
                );
            }
        } catch (archiveError) {
            console.error('Auto-archive after grantee update failed:', archiveError);
        }

        return res.status(200).json(grantee);
    } catch (error) {
        console.error('updateGrantee error:', error);
        return res.status(400).json({ message: error.message || 'Failed to update grantee.' });
    }
};

exports.deleteGrantee = async (req, res) => {
    try {
        const grantee = await Grantee.findByIdAndDelete(req.params.id);
        if (!grantee) {
            return res.status(404).json({ message: 'Grantee not found.' });
        }
        
        // Cascade delete permanent ledger history lines if raw grantee is permanently erased
        await ClaimHistory.deleteMany({ granteeId: req.params.id });

        // Record erasure signature inside the audit records
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'GRANTEE_RECORD_PURGED',
            entityType: 'grantees',
            entityId: req.params.id,
            oldValues: { studentId: grantee.studentId, fullName: grantee.fullName, program: grantee.program, batchNo: grantee.batchNo },
            newValues: { status: 'hard_deleted', cascadedLedgerLogsRemoved: true },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json({ message: 'Grantee deleted successfully.' });
    } catch (error) {
        console.error('deleteGrantee error:', error);
        return res.status(500).json({ message: error.message || 'Failed to delete grantee.' });
    }
};