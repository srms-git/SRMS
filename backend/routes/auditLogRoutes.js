const express = require('express');
const router = express.Router();
const { getAuditLogs, getAuditLogById } = require('../controllers/auditLogController');

/**
 * @route   GET /api/audit-logs
 * @desc    Get a list of all system audit logs (supports pagination & filtering)
 */
router.get('/', getAuditLogs);

/**
 * @route   GET /api/audit-logs/:id
 * @desc    Get specific details of an audit log (including delta updates)
 */
router.get('/:id', getAuditLogById);

module.exports = router;