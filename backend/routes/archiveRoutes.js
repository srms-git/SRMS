const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archiveController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

const staffAuth = [authenticate, requireRole('osgfa', 'cashier')];

router.post('/check-archive', authenticate, requireRole('osgfa'), archiveController.archiveBatchAndGrantees);
router.post('/manual', authenticate, requireRole('osgfa'), archiveController.manualArchiveBatch);
router.get('/list', ...staffAuth, archiveController.getArchivedBatches);
router.get('/detail', ...staffAuth, archiveController.getArchivedBatchDetail);

module.exports = router;
