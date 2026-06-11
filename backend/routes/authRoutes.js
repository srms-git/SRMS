const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

router.post('/register', authenticate, requireRole('osgfa'), authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', authenticate, authController.getMe);
router.patch('/profile', authenticate, authController.updateProfile);
router.post('/change-password/request-otp', authenticate, authController.requestPasswordChangeOtp);
router.patch('/change-password', authenticate, authController.changePassword);
router.patch('/cashier-privacy', authenticate, requireRole('cashier'), authController.updateCashierPrivacy);
router.patch('/osgfa-privacy', authenticate, requireRole('osgfa'), authController.updateOsgfaPrivacy);

module.exports = router;
