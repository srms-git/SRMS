const Grantee = require('../models/GranteeModel');
const ClaimHistory = require('../models/ClaimHistoryModel');
const { archiveBatchIfFullyClaimed } = require('../services/archiveService');
const { createInternalNotification } = require('./notificationController');

function mapBatchRow(row, program, batchNo, academicYear) {
    return {
        program: String(program).trim().toUpperCase(),
        batchNo: String(batchNo).trim(),
        academicYear: String(academicYear).trim(),
        seqNo: String(row?.seqNo ?? '').trim(),
        studentId: String(row?.studentId ?? '').trim(),
        awardNumber: String(row?.awardNumber ?? '').trim(),
        fullName: String(row?.fullName ?? '').trim() || 'Unknown',
        enrolledProgram: String(row?.enrolledProgram ?? '').trim(),
        yearLevel: String(row?.yearLevel ?? '').trim(),
    };
}

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

    if (parts.length === 0) return {};
    if (parts.length === 1) return parts[0];
    return { $and: parts };
}

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

        const updateBody = { ...req.body };
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

        return res.status(200).json({ message: 'Grantee deleted successfully.' });
    } catch (error) {
        console.error('deleteGrantee error:', error);
        return res.status(500).json({ message: error.message || 'Failed to delete grantee.' });
    }
};