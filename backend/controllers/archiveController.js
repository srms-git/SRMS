const {
    archiveBatchIfFullyClaimed,
    syncAllFullyClaimedBatches,
    listArchivedBatchSummaries,
    getArchivedBatchDetail,
} = require('../services/archiveService');
const { createInternalNotification } = require('./notificationController');

exports.archiveBatchAndGrantees = async (req, res) => {
    try {
        const { batchNo, program, academicYear, reason } = req.body;

        if (!batchNo || !program || !academicYear) {
            return res.status(400).json({
                message: 'batchNo, program, and academicYear are required to proceed with archiving.',
            });
        }

        const outcome = await archiveBatchIfFullyClaimed({
            batchNo,
            program,
            academicYear,
            reason,
            archivedBy: req.user?.id,
        });

        // 1. Case: Batch check ran, but skipped because there are still unclaimed payout structures
        if (!outcome.isArchived && outcome.message?.includes('not fully claimed')) {
            await createInternalNotification(
                `Unclaimed count alert on batch ${batchNo}`,
                `Automatic archiving skipped for ${program} (A.Y. ${academicYear}) because some grantees have not claimed their payouts yet. Consider sending a follow-up reminder.`,
                'reminder'
            );

            return res.status(200).json({
                message: `Batch ${batchNo} status checked. Automatic archiving skipped because some grantees have not claimed yet.`,
                isArchived: false,
            });
        }

        // 2. Case: Batch not found or has no active records mapping to it
        if (!outcome.isArchived && outcome.message?.includes('No active grantees')) {
            return res.status(404).json({ message: outcome.message });
        }

        // 3. Case: Success! The entire batch hit 100% claimed status and compressed to archives
        if (outcome.newlyArchived) {
            await createInternalNotification(
                `Batch ${batchNo} reached 100% claimed status`,
                `All grantees under ${program} batch ${batchNo} for Academic Year ${academicYear} are marked claimed. The system has automatically processed and finalized its archive allocation snapshot.`,
                'claim'
            );
        }

        return res.status(200).json({
            message: outcome.message,
            archivedId: outcome.archivedId,
            isArchived: outcome.isArchived,
        });
    } catch (error) {
        console.error('Error during batch archiving process:', error);
        return res.status(500).json({
            message: error.message || 'An internal error occurred while executing the archive operation.',
        });
    }
};

exports.getArchivedBatches = async (req, res) => {
    try {
        // Move any fully-claimed active batches into the archive collection first.
        await syncAllFullyClaimedBatches();

        const archivedList = await listArchivedBatchSummaries();
        return res.status(200).json(archivedList);
    } catch (error) {
        console.error('getArchivedBatches error:', error);
        return res.status(500).json({ message: error.message });
    }
};

exports.getArchivedBatchDetail = async (req, res) => {
    try {
        const batchNo = String(req.query.batchNo ?? '').trim();
        const program = String(req.query.program ?? '').trim();
        const academicYear = String(req.query.academicYear ?? req.query.schoolYear ?? '').trim();

        if (!batchNo || !program || !academicYear) {
            return res.status(400).json({
                message: 'batchNo, program, and academicYear query parameters are required.',
            });
        }

        // Ensure fully-claimed batches are archived before loading the snapshot.
        const outcome = await archiveBatchIfFullyClaimed({ batchNo, program, academicYear });
        
        if (outcome?.newlyArchived) {
            await createInternalNotification(
                `Batch ${batchNo} reached 100% claimed status`,
                `All grantees under ${program} batch ${batchNo} for Academic Year ${academicYear} are marked claimed. The system has automatically processed and finalized its archive allocation snapshot.`,
                'claim'
            );
        }

        let detail = await getArchivedBatchDetail({ batchNo, program, academicYear });
        if (!detail) {
            await syncAllFullyClaimedBatches();
            detail = await getArchivedBatchDetail({ batchNo, program, academicYear });
        }
        if (!detail) {
            return res.status(404).json({ message: 'Archived batch not found.' });
        }

        return res.status(200).json(detail);
    } catch (error) {
        console.error('getArchivedBatchDetail error:', error);
        return res.status(500).json({ message: error.message });
    }
};