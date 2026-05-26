const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archiveController');

// Route to handle checking and executing automatic batch archiving
// Expected payload body: { "batchNo": "18.2", "program": "TES", "academicYear": "2023-2024" }
router.post('/check-archive', archiveController.archiveBatchAndGrantees);

// Route to fetch all archived batches for your OSGFA and Registrar archive tables
router.get('/list', archiveController.getArchivedBatches);

// Archived batch grantee snapshot: ?batchNo=&program=&academicYear=
router.get('/detail', archiveController.getArchivedBatchDetail);

module.exports = router;