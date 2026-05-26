const crypto = require('crypto');
const { isEmailConfigured, sendPasswordChangeOtpEmail } = require('../utils/emailService');

const OTP_TTL_MS = 10 * 60 * 1000;

function hashOtp(otp) {
    return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

async function issuePasswordChangeOtp(user) {
    if (!isEmailConfigured()) {
        const error = new Error('Email service is not configured. Contact your administrator.');
        error.code = 'EMAIL_NOT_CONFIGURED';
        throw error;
    }

    const otp = generateOtp();
    user.passwordChangeOtpHash = hashOtp(otp);
    user.passwordChangeOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    await user.save();

    await sendPasswordChangeOtpEmail({
        to: user.email,
        firstName: user.firstName,
        otp,
    });

    return { sent: true, expiresInMinutes: OTP_TTL_MS / 60000 };
}

function verifyPasswordChangeOtp(user, otp) {
    const normalized = String(otp ?? '').trim();
    if (!/^\d{6}$/.test(normalized)) {
        return false;
    }
    if (!user.passwordChangeOtpHash || !user.passwordChangeOtpExpires) {
        return false;
    }
    if (user.passwordChangeOtpExpires <= new Date()) {
        return false;
    }
    return user.passwordChangeOtpHash === hashOtp(normalized);
}

function clearPasswordChangeOtp(user) {
    user.passwordChangeOtpHash = undefined;
    user.passwordChangeOtpExpires = undefined;
}

module.exports = {
    issuePasswordChangeOtp,
    verifyPasswordChangeOtp,
    clearPasswordChangeOtp,
};
