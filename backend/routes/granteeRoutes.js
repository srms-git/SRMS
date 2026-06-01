const express = require('express');
const router = express.Router();
const granteeController = require('../controllers/granteeController');

// BATCH OPERATIONS - POST: Process and bulk upsert converted Excel rows
router.post('/batch-save', granteeController.batchSaveGrantees);

// BATCH OPERATIONS - PATCH: Update batch number, program, and academic year for all grantees in a batch
router.patch('/batch-update', granteeController.batchUpdateGrantees);

// CREATE - POST: Add a new student record manually
router.post('/', granteeController.createGrantee);

// READ ALL - GET: View all students in the system
router.get('/', granteeController.getAllGrantees);

// READ ONE - GET: View a specific student by their Database ID
router.get('/:id', granteeController.getGranteeById);

// UPDATE - PUT: Edit a specific student's information
router.put('/:id', granteeController.updateGrantee);

// DELETE - DELETE: Remove a student record from the system
router.delete('/:id', granteeController.deleteGrantee);

module.exports = router;