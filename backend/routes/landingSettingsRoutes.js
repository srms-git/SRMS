const express = require('express');
const router = express.Router();
const landingSettingsController = require('../controllers/landingSettingsController');

router.get('/page-settings', landingSettingsController.getPageSettings);
router.put('/page-settings', landingSettingsController.updatePageSettings);
router.get('/process-workflow', landingSettingsController.getProcessWorkflow);
router.put('/process-workflow', landingSettingsController.updateProcessWorkflow);
router.get('/batch-visibility', landingSettingsController.getPublishedBatchKeys);
router.put('/batch-visibility', landingSettingsController.updatePublishedBatchKeys);

module.exports = router;
