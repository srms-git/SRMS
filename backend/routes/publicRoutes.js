const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/grantees', publicController.getPublicBatchGrantees);

module.exports = router;
