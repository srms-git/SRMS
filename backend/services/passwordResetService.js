const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/UserModel');
const { findActiveUserByEmail } = require('./userService');
const { isEmailConfigured, sendPasswordResetEmail, verifyEmailConnection } = require('../utils/emailService');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashResetToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function buildResetUrl(resetToken, email) {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const normalizedEmail = String(email).trim().toLowerCase();
    return `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;
}

async function issuePasswordReset(email) {
    if (!isEmailConfigured()) {
        const error = new Error('Email service is not configured.');
        error.code = 'EMAIL_NOT_CONFIGURED';
        throw error;
    }

    const user = await findActiveUserByEmail(email);
    if (!user) {
        return { sent: false, userFound: false };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = hashResetToken(resetToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const resetUrl = buildResetUrl(resetToken, user.email);

    try {
        await sendPasswordResetEmail({
            to: user.email,
            firstName: user.firstName,
            resetUrl,
        });
    } catch (mailError) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        throw mailError;
    }

    return { sent: true, userFound: true };
}

async function completePasswordReset({ email, token }) {
    const normalizedEmail = String(email).trim().toLowerCase();
    return User.findOne({
        email: normalizedEmail,
        resetPasswordToken: hashResetToken(token),
        resetPasswordExpires: { $gt: new Date() },
        isActive: { $ne: false },
    }).select('+resetPasswordToken +resetPasswordExpires');
}

async function applyNewPassword(user, password) {
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
}

module.exports = {
    issuePasswordReset,
    completePasswordReset,
    applyNewPassword,
    verifyEmailConnection,
};
