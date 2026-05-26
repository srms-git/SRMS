const nodemailer = require('nodemailer');

function env(name) {
    return String(process.env[name] || '').trim();
}

function getSmtpPassword() {
    return env('SMTP_PASS') || env('SMTP_PASSWORD') || env('EMAIL_PASS');
}

function isEmailConfigured() {
    const hasAuth = Boolean(env('SMTP_USER') && getSmtpPassword());
    return Boolean((env('SMTP_HOST') || env('SMTP_SERVICE')) && hasAuth);
}

function createTransporter() {
    if (!isEmailConfigured()) {
        throw new Error('Email service is not configured.');
    }

    const port = Number(env('SMTP_PORT')) || 587;
    const service = env('SMTP_SERVICE');
    const auth = {
        user: env('SMTP_USER'),
        pass: getSmtpPassword(),
    };

    if (service) {
        return nodemailer.createTransport({ service, auth });
    }

    return nodemailer.createTransport({
        host: env('SMTP_HOST'),
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth,
    });
}

async function verifyEmailConnection() {
    if (!isEmailConfigured()) {
        return { ok: false, reason: 'SMTP_USER and SMTP_PASS are required in backend/.env' };
    }

    const transporter = createTransporter();
    await transporter.verify();
    return { ok: true };
}

async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
    const transporter = createTransporter();
    const from = env('SMTP_FROM') || env('SMTP_USER');
    const appName = env('APP_NAME') || 'Scholarship Records Management System';

    await transporter.sendMail({
        from: `"${appName}" <${from}>`,
        to,
        subject: `Reset your ${appName} password`,
        text: [
            `Hello ${firstName || 'there'},`,
            '',
            'We received a request to reset your password.',
            'Use this link to choose a new password (valid for 1 hour):',
            resetUrl,
            '',
            'If you did not request this, you can ignore this email.',
        ].join('\n'),
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
                <p>Hello ${firstName || 'there'},</p>
                <p>We received a request to reset your password for <strong>${appName}</strong>.</p>
                <p>
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#081F5C;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
                        Reset password
                    </a>
                </p>
                <p style="font-size:14px;color:#475569;">This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
            </div>
        `,
    });
}

async function sendPasswordChangeOtpEmail({ to, firstName, otp }) {
    const transporter = createTransporter();
    const from = env('SMTP_FROM') || env('SMTP_USER');
    const appName = env('APP_NAME') || 'Scholarship Records Management System';

    await transporter.sendMail({
        from: `"${appName}" <${from}>`,
        to,
        subject: `Your ${appName} password change verification code`,
        text: [
            `Hello ${firstName || 'there'},`,
            '',
            'Use this one-time verification code to confirm your password change:',
            otp,
            '',
            'This code expires in 10 minutes.',
            'If you did not request this, secure your account and contact support.',
        ].join('\n'),
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
                <p>Hello ${firstName || 'there'},</p>
                <p>Use this one-time verification code to confirm your password change for <strong>${appName}</strong>:</p>
                <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #081F5C;">${otp}</p>
                <p style="font-size:14px;color:#475569;">This code expires in 10 minutes. If you did not request this, secure your account immediately.</p>
            </div>
        `,
    });
}

module.exports = {
    isEmailConfigured,
    verifyEmailConnection,
    sendPasswordResetEmail,
    sendPasswordChangeOtpEmail,
};
