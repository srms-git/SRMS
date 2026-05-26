const mongoose = require('mongoose');

const ArchiveSchema = new mongoose.Schema({
    // Identifies what type of record was archived (allows system flexibility down the road)
    recordType: {
        type: String,
        required: true,
        default: 'Batch',
        enum: ['Batch']
    },
    // High-level batch identification fields for easy frontend rendering
    batchNo: {
        type: String,
        required: true,
        trim: true
    },
    schoolYear: {
        type: String,
        required: true,
        trim: true
    },
    // Optional but highly recommended: tracks if it's a TES, TDP, or other grant type
    grantType: {
        type: String,
        trim: true
    },
    // The exact original batch document properties (metadata, dates, configurations)
    batchDetails: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    // An array containing full snapshot objects of every single grantee that was inside this batch
    granteesSnapshot: {
        type: [mongoose.Schema.Types.Mixed],
        required: true,
        default: []
    },
    // Audit accountability fields (Highly necessary for institutional software)
    archivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Tracks which logged-in staff member performed the action
    },
    archiveReason: {
        type: String,
        trim: true,
        default: 'End of academic cycle / Processed'
    }
}, { 
    timestamps: true // Automatically creates 'createdAt' which handles your 'Archived Date'
});

// Indexes to keep your frontend Archive Page lightning fast when loading tables
ArchiveSchema.index({ batchNo: 1 });
ArchiveSchema.index({ schoolYear: 1 });
ArchiveSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Archive', ArchiveSchema);