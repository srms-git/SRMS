const express = require('express');
const router = express.Router();
const landingBatchController = require('../controllers/landingBatchController');
const landingSettingsController = require('../controllers/landingSettingsController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const optionalAuthenticate = require('../middleware/optionalAuthenticate');

router.get('/page-settings', landingSettingsController.getPageSettings);
router.put('/page-settings', authenticate, requireRole('osgfa'), landingSettingsController.updatePageSettings);
router.get('/process-workflow', landingSettingsController.getProcessWorkflow);
router.put('/process-workflow', authenticate, requireRole('osgfa'), landingSettingsController.updateProcessWorkflow);

router.get('/', optionalAuthenticate, landingBatchController.listLandingBatches);
router.post('/publish', authenticate, requireRole('osgfa'), landingBatchController.publishLandingBatch);
router.post('/unpublish', authenticate, requireRole('osgfa'), landingBatchController.unpublishLandingBatch);
router.patch('/rename', authenticate, requireRole('osgfa'), landingBatchController.renameLandingBatch);

module.exports = router;
