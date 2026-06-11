const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

const staffAuth = [authenticate, requireRole('osgfa', 'cashier')];

router.get('/', ...staffAuth, notificationController.getNotifications);
router.patch('/mark-all', ...staffAuth, notificationController.markAllAsRead);
router.patch('/:id/read', ...staffAuth, notificationController.markAsRead);

module.exports = router;
