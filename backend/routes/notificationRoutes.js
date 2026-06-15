const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Standard REST setup mapping to the frontend interactive methods
router.get('/', notificationController.getNotifications);
router.patch('/mark-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;