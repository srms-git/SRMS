const express = require('express');
const router = express.Router();
const { getAllPrograms, addProgram } = require('../controllers/programController');

// GET /api/programs - Fetch all programs dynamically from MongoDB
router.get('/', getAllPrograms);

// POST /api/programs - Create and save a new program to MongoDB
router.post('/', addProgram);

module.exports = router;