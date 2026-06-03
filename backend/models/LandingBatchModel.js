const mongoose = require('mongoose');

const LandingBatchSchema = new mongoose.Schema(
    {
        batchNo: {
            type: String,
            required: true,
            trim: true,
        },
        program: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: [/^[A-Z0-9]{2,12}$/, 'Program code must be 2–12 alphanumeric characters.'],
        },
        academicYear: {
            type: String,
            required: true,
            trim: true,
        },
        published: {
            type: Boolean,
            default: false,
            index: true,
        },
        granteeCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        publishedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

LandingBatchSchema.index(
    { batchNo: 1, program: 1, academicYear: 1 },
    { unique: true },
);

module.exports = mongoose.model('LandingBatch', LandingBatchSchema);
