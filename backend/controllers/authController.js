const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');
const { findActiveUserByEmail } = require('../services/userService');
const {
    issuePasswordReset,
    completePasswordReset,
    applyNewPassword,
} = require('../services/passwordResetService');
const {
    issuePasswordChangeOtp,
    verifyPasswordChangeOtp,
    clearPasswordChangeOtp,
} = require('../services/passwordChangeOtpService');
const { isEmailConfigured } = require('../utils/emailService');
const { createInternalNotification } = require('./notificationController');
const { logActivity } = require('../services/auditLogger');

const FORGOT_PASSWORD_MESSAGE =
    'If an account exists for that email, check your inbox for reset instructions.';

function buildToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );
}

const DEFAULT_PRIVACY_PREFS = {
    maskStudentIdInLists: false,
    hideSensitiveStatsFromSharedScreens: true,
};

function formatPrivacyPrefs(stored = {}) {
    return {
        maskStudentIdInLists:
            stored.maskStudentIdInLists ?? DEFAULT_PRIVACY_PREFS.maskStudentIdInLists,
        hideSensitiveStatsFromSharedScreens:
            stored.hideSensitiveStatsFromSharedScreens
            ?? DEFAULT_PRIVACY_PREFS.hideSensitiveStatsFromSharedScreens,
    };
}

function formatCashierPrivacy(user) {
    return formatPrivacyPrefs(user?.cashierPrivacy);
}

function formatOsgfaPrivacy(user) {
    return formatPrivacyPrefs(user?.osgfaPrivacy);
}

function formatUser(user) {
    const firstName = String(user.firstName ?? '').trim();
    const lastName = String(user.lastName ?? '').trim();
    const fullName = `${firstName} ${lastName}`.trim();

    return {
        id: user._id,
        firstName,
        lastName,
        fullName,
        email: user.email,
        role: user.role,
        cashierPrivacy: formatCashierPrivacy(user),
        osgfaPrivacy: formatOsgfaPrivacy(user),
    };
}

exports.register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, role } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'firstName, lastName, email, and password are required.' });
        }

        const existing = await User.findOne({ email: String(email).trim().toLowerCase() });
        if (existing) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const assignedRole = (role && ['osgfa', 'cashier'].includes(role.toLowerCase()))
            ? role.toLowerCase()
            : 'osgfa';

        const user = await User.create({
            firstName: String(firstName).trim(),
            lastName: String(lastName).trim(),
            email: String(email).trim().toLowerCase(),
            password: hashedPassword,
            role: assignedRole,
        });

        // Track registration within the system notifications audit trail
        await createInternalNotification(
            'New System Account Registered',
            `Account created for ${user.firstName} ${user.lastName} (${user.email}) with role level [${user.role.toUpperCase()}].`,
            'system'
        );

        // Audit Trail tracking log
        logActivity({
            userId: user._id,
            action: 'USER_REGISTERED',
            entityType: 'users',
            entityId: user._id,
            oldValues: null,
            newValues: { id: user._id, email: user.email, role: user.role },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(201).json({
            message: 'User registered successfully.',
            user: formatUser(user),
        });
    } catch (error) {
        console.error('register error:', error);
        return res.status(500).json({ message: error.message || 'Registration failed.' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const user = await findActiveUserByEmail(email);
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: 'Server auth is not configured (JWT_SECRET missing).' });
        }

        // Audit Trail tracking log
        logActivity({
            userId: user._id,
            action: 'USER_LOGIN',
            entityType: 'users',
            entityId: user._id,
            oldValues: null,
            newValues: { loginAt: new Date(), role: user.role },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json({
            token: buildToken(user),
            user: formatUser(user),
        });
    } catch (error) {
        console.error('login error:', error);
        return res.status(500).json({ message: error.message || 'Login failed.' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        try {
            const result = await issuePasswordReset(email);
            if (!result.userFound) {
                console.info('forgotPassword: no active user in users collection for', String(email).trim().toLowerCase());
            } else {
                // Audit password reset issue request activity
                logActivity({
                    userId: result.userId || null,
                    action: 'PASSWORD_RESET_REQUESTED',
                    entityType: 'users',
                    entityId: result.userId || null,
                    oldValues: null,
                    newValues: { email: String(email).trim().toLowerCase(), status: 'token_dispatched' },
                    ipAddress: req.ip || req.headers['x-forwarded-for'] || null
                });
            }
        } catch (error) {
            if (error.code === 'EMAIL_NOT_CONFIGURED') {
                return res.status(503).json({
                    message: 'Password reset email is not configured. Set SMTP_PASS in backend/.env (Gmail App Password).',
                });
            }
            console.error('forgotPassword email error:', error);
            return res.status(503).json({
                message: 'Unable to send reset email. Please try again later.',
            });
        }

        return res.status(200).json({ message: FORGOT_PASSWORD_MESSAGE });
    } catch (error) {
        console.error('forgotPassword error:', error);
        return res.status(500).json({ message: error.message || 'Password reset request failed.' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        return res.status(200).json({ user: formatUser(user) });
    } catch (error) {
        console.error('getMe error:', error);
        return res.status(500).json({ message: error.message || 'Unable to load profile.' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const oldValuesSnapshot = { firstName: user.firstName, lastName: user.lastName };

        let firstName = String(req.body.firstName ?? '').trim();
        let lastName = String(req.body.lastName ?? '').trim();

        if (!firstName && !lastName && req.body.fullName) {
            const parts = String(req.body.fullName).trim().split(/\s+/);
            firstName = parts.shift() || '';
            lastName = parts.join(' ');
        }

        if (firstName && !lastName) {
            lastName = firstName;
        }

        if (!firstName || !lastName) {
            return res.status(400).json({ message: 'First and last name are required.' });
        }

        user.firstName = firstName;
        user.lastName = lastName;
        await user.save();

        // Audit profile details mutation action
        logActivity({
            userId: req.userId,
            action: 'UPDATE_PROFILE',
            entityType: 'users',
            entityId: user._id,
            oldValues: oldValuesSnapshot,
            newValues: { firstName: user.firstName, lastName: user.lastName },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        const formatted = formatUser(user);
        return res.status(200).json({
            message: 'Profile updated successfully.',
            user: formatted,
        });
    } catch (error) {
        console.error('updateProfile error:', error);
        return res.status(500).json({ message: error.message || 'Profile update failed.' });
    }
};

exports.requestPasswordChangeOtp = async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword ?? '');

        if (!currentPassword) {
            return res.status(400).json({ message: 'Current password is required to request a verification code.' });
        }

        if (!isEmailConfigured()) {
            return res.status(503).json({
                message: 'Email verification is not configured. Set SMTP_PASS in backend/.env.',
            });
        }

        const user = await User.findById(req.userId);
        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const passwordMatches = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        await issuePasswordChangeOtp(user);

        // Track OTP generation request footprint inside log activity logs
        logActivity({
            userId: req.userId,
            action: 'PASSWORD_CHANGE_OTP_REQUESTED',
            entityType: 'users',
            entityId: user._id,
            oldValues: null,
            newValues: { email: user.email, event: 'otp_dispatched' },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json({
            message: `Verification code sent to ${user.email}.`,
            email: user.email,
            expiresInMinutes: 10,
        });
    } catch (error) {
        if (error.code === 'EMAIL_NOT_CONFIGURED') {
            return res.status(503).json({ message: error.message });
        }
        console.error('requestPasswordChangeOtp error:', error);
        return res.status(500).json({ message: error.message || 'Unable to send verification code.' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword ?? '');
        const newPassword = String(req.body.newPassword ?? '');
        const otp = String(req.body.otp ?? '').trim();

        if (!currentPassword || !newPassword || !otp) {
            return res.status(400).json({
                message: 'Current password, new password, and email verification code are required.',
            });
        }

        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({ message: 'Verification code must be a 6-digit number.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters.' });
        }

        const user = await User.findById(req.userId).select(
            '+passwordChangeOtpHash +passwordChangeOtpExpires',
        );
        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const passwordMatches = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        if (!verifyPasswordChangeOtp(user, otp)) {
            return res.status(400).json({
                message: 'Invalid or expired verification code. Request a new code from your email.',
            });
        }

        const samePassword = await bcrypt.compare(newPassword, user.password);
        if (samePassword) {
            return res.status(400).json({ message: 'New password must be different from your current password.' });
        }

        await applyNewPassword(user, newPassword);
        clearPasswordChangeOtp(user);
        await user.save();

        await createInternalNotification(
            'Security Alert: Password Updated',
            `The login password for ${user.email} was changed from account settings with email verification.`,
            'reminder'
        );

        // Audit password reset completion mutation footprint
        logActivity({
            userId: req.userId,
            action: 'PASSWORD_CHANGED_VIA_SETTINGS',
            entityType: 'users',
            entityId: user._id,
            oldValues: null,
            newValues: { changedAt: new Date(), verifiedViaOtp: true },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('changePassword error:', error);
        return res.status(500).json({ message: error.message || 'Password change failed.' });
    }
};

exports.updateCashierPrivacy = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const oldValuesSnapshot = formatCashierPrivacy(user);

        const incoming = req.body?.privacy ?? req.body ?? {};
        const maskStudentIdInLists = incoming.maskStudentIdInLists;
        const hideSensitiveStatsFromSharedScreens = incoming.hideSensitiveStatsFromSharedScreens;

        if (typeof maskStudentIdInLists !== 'boolean' && typeof hideSensitiveStatsFromSharedScreens !== 'boolean') {
            return res.status(400).json({ message: 'At least one privacy preference must be provided.' });
        }

        if (!user.cashierPrivacy) {
            user.cashierPrivacy = { ...DEFAULT_PRIVACY_PREFS };
        }

        if (typeof maskStudentIdInLists === 'boolean') {
            user.cashierPrivacy.maskStudentIdInLists = maskStudentIdInLists;
        }
        if (typeof hideSensitiveStatsFromSharedScreens === 'boolean') {
            user.cashierPrivacy.hideSensitiveStatsFromSharedScreens = hideSensitiveStatsFromSharedScreens;
        }

        user.markModified('cashierPrivacy');
        await user.save();

        const privacy = formatCashierPrivacy(user);

        // Track privacy mutations in audit log trace entries
        logActivity({
            userId: req.userId,
            action: 'UPDATE_CASHIER_PRIVACY',
            entityType: 'users',
            entityId: user._id,
            oldValues: oldValuesSnapshot,
            newValues: privacy,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json({
            message: 'Privacy preferences saved.',
            privacy,
            user: formatUser(user),
        });
    } catch (error) {
        console.error('updateCashierPrivacy error:', error);
        return res.status(500).json({ message: error.message || 'Unable to save privacy preferences.' });
    }
};

exports.updateOsgfaPrivacy = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const oldValuesSnapshot = formatOsgfaPrivacy(user);

        const incoming = req.body?.privacy ?? req.body ?? {};
        const maskStudentIdInLists = incoming.maskStudentIdInLists;
        const hideSensitiveStatsFromSharedScreens = incoming.hideSensitiveStatsFromSharedScreens;

        if (typeof maskStudentIdInLists !== 'boolean' && typeof hideSensitiveStatsFromSharedScreens !== 'boolean') {
            return res.status(400).json({ message: 'At least one privacy preference must be provided.' });
        }

        if (!user.osgfaPrivacy) {
            user.osgfaPrivacy = { ...DEFAULT_PRIVACY_PREFS };
        }

        if (typeof maskStudentIdInLists === 'boolean') {
            user.osgfaPrivacy.maskStudentIdInLists = maskStudentIdInLists;
        }
        if (typeof hideSensitiveStatsFromSharedScreens === 'boolean') {
            user.osgfaPrivacy.hideSensitiveStatsFromSharedScreens = hideSensitiveStatsFromSharedScreens;
        }

        user.markModified('osgfaPrivacy');
        await user.save();

        const privacy = formatOsgfaPrivacy(user);

        // Track privacy mutations in audit log trace entries
        logActivity({
            userId: req.userId,
            action: 'UPDATE_OSGFA_PRIVACY',
            entityType: 'users',
            entityId: user._id,
            oldValues: oldValuesSnapshot,
            newValues: privacy,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json({
            message: 'Privacy preferences saved.',
            privacy,
            user: formatUser(user),
        });
    } catch (error) {
        console.error('updateOsgfaPrivacy error:', error);
        return res.status(500).json({ message: error.message || 'Unable to save privacy preferences.' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, token, password } = req.body;

        if (!email || !token || !password) {
            return res.status(400).json({ message: 'Email, token, and new password are required.' });
        }

        if (String(password).length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        const user = await completePasswordReset({ email, token });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
        }

        await applyNewPassword(user, password);

        // Security trace notification dispatch to log credential shifts
        await createInternalNotification(
            'Security Alert: Password Updated',
            `The login password credentials for ${user.email} were successfully updated via password reset validation.`,
            'reminder'
        );

        // Audit external forgotten password recovery execution sequence complete
        logActivity({
            userId: user._id,
            action: 'PASSWORD_RESET_COMPLETED',
            entityType: 'users',
            entityId: user._id,
            oldValues: null,
            newValues: { email: user.email, event: 'reset_via_token_success' },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json({ message: 'Password updated successfully. You can now log in.' });
    } catch (error) {
        console.error('resetPassword error:', error);
        return res.status(500).json({ message: error.message || 'Password reset failed.' });
    }
};