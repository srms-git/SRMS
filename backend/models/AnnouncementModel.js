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
        trim: true,
        default: ''
    },
    type: {
        type: String,
        required: true,
        enum: ['new_batch', 'requirement_schedule', 'payout_schedule', 'unclaimed', 'opportunity', 'advisory', 'other'],
        default: 'new_batch'
    },
    customType: {
        type: String,
        trim: true,
        maxlength: 80,
        default: ''
    },
    linkedBatchNo: {
        type: String,
        trim: true,
        default: '',
    },
    linkedProgram: {
        type: String,
        trim: true,
        uppercase: true,
        default: '',
    },
    linkedAcademicYear: {
        type: String,
        trim: true,
        default: '',
    },
    scheduleDate: {
        type: String,
        trim: true,
        default: '',
    },
    scheduleTime: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
    },
    scheduleLocation: {
        type: String,
        trim: true,
        maxlength: 200,
        default: '',
    },
    startDate: {
        type: String,
        required: true,
        default: () => new Date().toISOString().slice(0, 10)
    },
    endDate: {
        type: String,
        required: true,
        default: () => new Date().toISOString().slice(0, 10)
    },
    /** @deprecated Use startDate — kept for records created before date duration */
    date: {
        type: String,
        required: false
    },
    active: {
        type: Boolean,
        required: true,
        default: true
    },
    inactiveAt: {
        type: Date,
        default: null
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
AnnouncementSchema.index({ startDate: -1 });
AnnouncementSchema.index({ endDate: 1, active: 1 });
AnnouncementSchema.index({ active: 1, inactiveAt: 1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
