const AuditLog = require('../models/AuditLogModel');

/**
 * Get all system audit logs with filtering, optional search, and pagination
 * @route GET /api/audit-logs
 */
const getAuditLogs = async (req, res) => {
    try {
        const { entityType, action, userId, search, page = 1, limit = 10 } = req.query;
        
        // Build the dynamic filter query
        const query = {};
        
        if (entityType) {
            query.entityType = entityType.toLowerCase();
        }
        if (action) {
            query.action = action.toUpperCase();
        }
        if (userId) {
            query.userId = userId;
        }

        // Add regular expression text search for actions, codes, or custom changes
        if (search) {
            query.$or = [
                { action: { $regex: search, $options: 'i' } },
                { entityType: { $regex: search, $options: 'i' } },
                { entityId: { $regex: search, $options: 'i' } }
            ];
        }

        // Parse pagination properties safely
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (parsedPage - 1) * parsedLimit;

        // Execute concurrent tracking counts and page boundaries 
        const [logs, totalItems] = await Promise.all([
            AuditLog.find(query)
                .populate('userId', 'firstName lastName email role')
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(parsedLimit),
            AuditLog.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                totalItems,
                currentPage: parsedPage,
                totalPages: Math.ceil(totalItems / parsedLimit),
                limit: parsedLimit
            }
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: 'Server error retrieving audit logs.',
            details: error.message 
        });
    }
};

/**
 * Get full details for a single audit log row
 * @route GET /api/audit-logs/:id
 */
const getAuditLogById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Audit log id is required.' 
            });
        }

        const log = await AuditLog.findById(id).populate('userId', 'firstName lastName email role');

        if (!log) {
            return res.status(404).json({ 
                success: false, 
                error: 'Audit log entry not found in the database layer.' 
            });
        }

        return res.status(200).json({ 
            success: true, 
            data: log 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: 'Server error retrieving audit log detail description.',
            details: error.message 
        });
    }
};

module.exports = {
    getAuditLogs,
    getAuditLogById
};