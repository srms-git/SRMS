const AuditLog = require('../models/AuditLogModel');
const { escapeRegex } = require('../utils/escapeRegex');
const { isValidObjectId, queryString } = require('../utils/validateObjectId');
const User = require('../models/UserModel');

const CASHIER_ENTITY_TYPES = ['users', 'grantees', 'claims', 'archives'];

async function appendCashierScopeConditions(andConditions, entityType) {
    const cashierUsers = await User.find({ role: 'cashier' }).select('_id').lean();
    const cashierIds = cashierUsers.map((user) => user._id);

    andConditions.push({
        $or: [
            { userId: { $in: cashierIds } },
            { action: 'UPDATE_CASHIER_PRIVACY' },
        ],
    });

    if (!entityType) {
        andConditions.push({ entityType: { $in: CASHIER_ENTITY_TYPES } });
    }
}

function logMatchesCashierScope(log, cashierIdSet) {
    const userId = log.userId?._id ?? log.userId;
    const userIdStr = userId ? String(userId) : '';
    const matchesActor = cashierIdSet.has(userIdStr) || log.action === 'UPDATE_CASHIER_PRIVACY';
    const matchesEntity = CASHIER_ENTITY_TYPES.includes(String(log.entityType ?? '').toLowerCase());
    return matchesActor && matchesEntity;
}

/**
 * Get all system audit logs with filtering, optional search, and pagination
 * @route GET /api/audit-logs
 */
const getAuditLogs = async (req, res) => {
    try {
        const entityType = queryString(req.query.entityType);
        const action = queryString(req.query.action);
        const userId = queryString(req.query.userId);
        const search = queryString(req.query.search);
        const requestedScope = queryString(req.query.scope);
        const page = queryString(req.query.page) || '1';
        const limit = queryString(req.query.limit) || '10';
        const isCashierUser = String(req.userRole ?? '').toLowerCase() === 'cashier';
        const scope = isCashierUser ? 'cashier' : requestedScope;
        
        // Build the dynamic filter query
        const query = {};
        const andConditions = [];
        
        if (entityType) {
            query.entityType = entityType.toLowerCase();
        }
        if (action) {
            query.action = action.toUpperCase();
        }
        if (userId) {
            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid userId filter.',
                });
            }
            query.userId = userId;
        }

        if (scope.toLowerCase() === 'cashier') {
            await appendCashierScopeConditions(andConditions, entityType);
        }

        // Add regular expression text search for actions, codes, or custom changes
        if (search) {
            const safeSearch = escapeRegex(String(search).trim());
            andConditions.push({
                $or: [
                    { action: { $regex: safeSearch, $options: 'i' } },
                    { entityType: { $regex: safeSearch, $options: 'i' } },
                    { entityId: { $regex: safeSearch, $options: 'i' } }
                ],
            });
        }

        if (andConditions.length === 1) {
            Object.assign(query, andConditions[0]);
        } else if (andConditions.length > 1) {
            query.$and = andConditions;
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

        if (String(req.userRole ?? '').toLowerCase() === 'cashier') {
            const cashierUsers = await User.find({ role: 'cashier' }).select('_id').lean();
            const cashierIdSet = new Set(cashierUsers.map((user) => String(user._id)));
            if (!logMatchesCashierScope(log, cashierIdSet)) {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to view this audit log entry.',
                });
            }
        }

        return res.status(200).json({ 
            success: true, 
            data: log 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: 'Server error retrieving audit log detail description.',
        });
    }
};

module.exports = {
    getAuditLogs,
    getAuditLogById
};