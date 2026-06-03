const { fetchClaimHistory } = require('../services/claimHistoryService');
const { logActivity } = require('../services/auditLogger');

exports.getGlobalClaimHistory = async (req, res) => {
    try {
        const historyLogs = await fetchClaimHistory(req.query);

        // Audit Trail tracking log for reading historical claim ledgers
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'VIEW_GLOBAL_CLAIM_HISTORY',
            entityType: 'claims',
            entityId: 'global_ledger',
            oldValues: null,
            newValues: { 
                filtersApplied: Object.keys(req.query || {}),
                recordsReturned: Array.isArray(historyLogs) ? historyLogs.length : 1 
            },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json(historyLogs);
    } catch (error) {
        console.error('getGlobalClaimHistory Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to fetch claim history records.' });
    }
};