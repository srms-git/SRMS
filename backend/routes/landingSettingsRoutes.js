const express = require('express');
const router = express.Router();
const landingSettingsController = require('../controllers/landingSettingsController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

router.get('/page-settings', landingSettingsController.getPageSettings);
router.put('/page-settings', authenticate, requireRole('osgfa'), landingSettingsController.updatePageSettings);
router.get('/process-workflow', landingSettingsController.getProcessWorkflow);
router.put('/process-workflow', authenticate, requireRole('osgfa'), landingSettingsController.updateProcessWorkflow);
router.get('/batch-visibility', authenticate, requireRole('osgfa'), landingSettingsController.getPublishedBatchKeys);
router.put('/batch-visibility', authenticate, requireRole('osgfa'), landingSettingsController.updatePublishedBatchKeys);

module.exports = router;
