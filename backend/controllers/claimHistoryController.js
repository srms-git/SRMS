const { fetchClaimHistory } = require('../services/claimHistoryService');

exports.getGlobalClaimHistory = async (req, res) => {
    try {
        const historyLogs = await fetchClaimHistory(req.query);
        return res.status(200).json(historyLogs);
    } catch (error) {
        console.error('getGlobalClaimHistory Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to fetch claim history records.' });
    }
};