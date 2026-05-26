const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Notification title is required.'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'Notification message description is required.'],
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['batch', 'claim', 'reminder', 'system', 'unclaimed', 'opportunity'],
        default: 'system'
    },
    read: {
        type: Boolean,
        required: true,
        default: false
    },
    // Optional: References a specific user if the notification is user-dependent (e.g. Registrar or Cashier views)
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true // Automatically sets 'createdAt' and 'updatedAt'
});

// Optimization indexes for the layout filter pipelines
NotificationSchema.index({ recipientId: 1, read: 1 });
NotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);