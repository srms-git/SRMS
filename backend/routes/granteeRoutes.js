const express = require('express');
const router = express.Router();
const granteeController = require('../controllers/granteeController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

const staffRoles = ['osgfa', 'cashier'];
const osgfaOnly = requireRole('osgfa');
const staffAuth = [authenticate, requireRole(...staffRoles)];

// BATCH OPERATIONS - POST: Process and bulk upsert converted Excel rows
router.post('/batch-save', authenticate, osgfaOnly, granteeController.batchSaveGrantees);

// BATCH OPERATIONS - PATCH: Update batch number, program, and academic year for all grantees in a batch
router.patch('/batch-update', authenticate, osgfaOnly, granteeController.batchUpdateGrantees);

// BATCH OPERATIONS - POST/PATCH: Set active/inactive status for one or more grantees
router.post('/bulk-active', authenticate, osgfaOnly, granteeController.bulkUpdateGranteeActive);
router.patch('/bulk-active', authenticate, osgfaOnly, granteeController.bulkUpdateGranteeActive);

// CREATE - POST: Add a new student record manually
router.post('/', authenticate, osgfaOnly, granteeController.createGrantee);

// READ ALL - GET: View all students in the system
router.get('/', ...staffAuth, granteeController.getAllGrantees);

// READ ONE - GET: View a specific student by their Database ID
router.get('/:id', ...staffAuth, granteeController.getGranteeById);

// UPDATE - PUT: Edit a specific student's information
router.put('/:id', ...staffAuth, granteeController.updateGrantee);

// DELETE - DELETE: Remove a student record from the system
router.delete('/:id', authenticate, osgfaOnly, granteeController.deleteGrantee);

module.exports = router;
