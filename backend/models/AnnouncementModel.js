const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Announcement title is required.'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Announcement description is required.'],
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['new_batch', 'requirement_schedule', 'payout_schedule', 'unclaimed', 'opportunity', 'advisory'],
        default: 'new_batch'
    },
    date: {
        type: String,
        required: true,
        default: () => new Date().toISOString().slice(0, 10) // YYYY-MM-DD formatting string
    },
    active: {
        type: Boolean,
        required: true,
        default: true
    },
    // Optional audit trail to track which administrative staff member created the record
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true // Tracks database insertion dates automatically
});

// Create index for fast date retrieval and type querying
AnnouncementSchema.index({ type: 1 });
AnnouncementSchema.index({ date: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);