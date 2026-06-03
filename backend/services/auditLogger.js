const AuditLog = require('../models/AuditLogModel');

/**
 * Utility tool to handle fire-and-forget background audit operations
 */
const logActivity = async ({ userId, action, entityType, entityId, oldValues = null, newValues = null, ipAddress = null }) => {
    try {
        await AuditLog.create({
            userId,
            action: action.toUpperCase(),
            entityType: entityType.toLowerCase(),
            entityId,
            oldValues,
            newValues,
            ipAddress
        });
    } catch (err) {
        // Prevent audit logging failures from throwing a 500 error on core client updates
        console.error('Audit Trail capturing encountered an error:', err.message);
    }
};

module.exports = { logActivity };