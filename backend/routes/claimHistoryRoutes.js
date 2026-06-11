const express = require('express');
const router = express.Router();
const { getGlobalClaimHistory } = require('../controllers/claimHistoryController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

router.get('/', authenticate, requireRole('osgfa', 'cashier'), getGlobalClaimHistory);

module.exports = router;
