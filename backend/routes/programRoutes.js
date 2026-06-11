const express = require('express');
const router = express.Router();
const { getAllPrograms, addProgram, updateProgram } = require('../controllers/programController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

router.get('/', getAllPrograms);
router.post('/', authenticate, requireRole('osgfa'), addProgram);
router.patch('/:id', authenticate, requireRole('osgfa'), updateProgram);

module.exports = router;
