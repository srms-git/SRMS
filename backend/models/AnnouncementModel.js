const mongoose = require('mongoose');

const imageSubSchema = {
    data: {
        type: Buffer,
        required: false
    },
    contentType: {
        type: String,
        required: false
    },
    fileName: {
        type: String,
        trim: true
    }
};

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
        default: () => new Date().toISOString().slice(0, 10)
    },
    active: {
        type: Boolean,
        required: true,
        default: true
    },
    images: {
        type: [imageSubSchema],
        default: []
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

AnnouncementSchema.index({ type: 1 });
AnnouncementSchema.index({ date: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
