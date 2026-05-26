const mongoose = require('mongoose');

const claimHistorySchema = new mongoose.Schema(
    {
        granteeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Grantee',
            required: true,
            index: true
        },
        studentId: { type: String, required: true },
        fullName: { type: String, required: true },
        program: { type: String, required: true, uppercase: true }, // TES or TDP
        batchNo: { type: String, required: true },
        academicYear: { type: String, required: true },
        yearLevelOnClaim: { type: String, required: true }, // e.g., "1st Year"
        semester: { type: String, required: true },         // "1st Semester" or "2nd Semester"
        claimedBy: { type: String, required: true, default: 'Grantee' }, // Grantee or Other
        otherName: { type: String, default: '' },           // Authorized representative name
        claimedAt: { type: Date, required: true, default: Date.now }
    },
    { timestamps: true }
);

claimHistorySchema.index({ program: 1, batchNo: 1, claimedAt: -1 });
claimHistorySchema.index(
    { granteeId: 1, yearLevelOnClaim: 1, semester: 1 },
    { unique: true },
);

module.exports = mongoose.model('ClaimHistory', claimHistorySchema);