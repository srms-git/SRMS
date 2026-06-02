const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true, // Prevents duplicate accounts
        lowercase: true, // Ensures 'Email@me.com' is saved as 'email@me.com'
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8 // Updated to 8 as requested
    },
    role: {
        type: String,
        enum: ['osgfa', 'cashier'],
        default: 'osgfa'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    resetPasswordToken: {
        type: String,
        select: false,
    },
    resetPasswordExpires: {
        type: Date,
        select: false,
    },
    passwordChangeOtpHash: {
        type: String,
        select: false,
    },
    passwordChangeOtpExpires: {
        type: Date,
        select: false,
    },
    cashierPrivacy: {
        maskStudentIdInLists: {
            type: Boolean,
            default: false,
        },
        hideSensitiveStatsFromSharedScreens: {
            type: Boolean,
            default: true,
        },
    },
    osgfaPrivacy: {
        maskStudentIdInLists: {
            type: Boolean,
            default: false,
        },
        hideSensitiveStatsFromSharedScreens: {
            type: Boolean,
            default: true,
        },
    },
}, {
    timestamps: true,
    collection: 'users',
});

// Virtual for getting the full name if you ever need it in the frontend
UserSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('User', UserSchema);