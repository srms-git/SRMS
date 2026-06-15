const express = require('express');
const router = express.Router();
const { getAllPrograms, addProgram, updateProgram } = require('../controllers/programController');

// GET /api/programs - Fetch all programs dynamically from MongoDB
router.get('/', getAllPrograms);

// POST /api/programs - Create and save a new program to MongoDB
router.post('/', addProgram);

// PATCH /api/programs/:id - Update display fields and/or active status (code & slug unchanged)
router.patch('/:id', updateProgram);

module.exports = router;