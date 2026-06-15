const express = require('express');
const router = express.Router();
const { getGlobalClaimHistory } = require('../controllers/claimHistoryController');

router.get('/', getGlobalClaimHistory);

module.exports = router;