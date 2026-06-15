const express = require('express');
const router = express.Router();
const landingBatchController = require('../controllers/landingBatchController');
const landingSettingsController = require('../controllers/landingSettingsController');

router.get('/page-settings', landingSettingsController.getPageSettings);
router.put('/page-settings', landingSettingsController.updatePageSettings);
router.get('/process-workflow', landingSettingsController.getProcessWorkflow);
router.put('/process-workflow', landingSettingsController.updateProcessWorkflow);

router.get('/', landingBatchController.listLandingBatches);
router.post('/publish', landingBatchController.publishLandingBatch);
router.post('/unpublish', landingBatchController.unpublishLandingBatch);
router.patch('/rename', landingBatchController.renameLandingBatch);

module.exports = router;
