const User = require('../models/UserModel');

/**
 * Look up an active account in the MongoDB `users` collection by email.
 */
async function findActiveUserByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;

    return User.findOne({
        email: normalized,
        isActive: { $ne: false },
    }).select('+password +resetPasswordToken +resetPasswordExpires');
}

module.exports = {
    findActiveUserByEmail,
};
