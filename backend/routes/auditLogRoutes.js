const express = require('express');
const router = express.Router();
const { getAuditLogs, getAuditLogById } = require('../controllers/auditLogController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

const staffAuth = [authenticate, requireRole('osgfa', 'cashier')];

router.get('/', ...staffAuth, getAuditLogs);
router.get('/:id', ...staffAuth, getAuditLogById);

module.exports = router;
