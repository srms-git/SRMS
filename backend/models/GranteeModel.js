const mongoose = require('mongoose');

const GranteeSchema = new mongoose.Schema({
    program: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
    },
    batchNo: {
        type: String,
        required: true,
        trim: true,
    },
    academicYear: {
        type: String,
        required: true,
        trim: true,
    },
    seqNo: {
        type: String,
        trim: true,
    },
    studentId: {
        type: String,
        trim: true,
    },
    awardNumber: {
        type: String,
        trim: true,
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    enrolledProgram: {
        type: String,
        trim: true,
    },
    yearLevel: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        default: 'Unclaimed',
        trim: true,
    },
    email: {
        type: String,
        trim: true,
        default: '',
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: '',
    },
    bankAccount: {
        type: String,
        trim: true,
        default: '',
    },
    grantCycle: {
        type: String,
        trim: true,
        default: '',
    },
    semesterClaims: {
        type: [
            {
                yearLevel: { type: String, trim: true },
                firstSem: { type: String, trim: true, default: 'Unclaimed' },
                secondSem: { type: String, trim: true, default: 'Unclaimed' },
                firstSemClaimer: { type: String, trim: true, default: '' },
                secondSemClaimer: { type: String, trim: true, default: '' },
                firstSemOtherName: { type: String, trim: true, default: '' },
                firstSemOtherRelation: { type: String, trim: true, default: '' },
                firstSemOtherContact: { type: String, trim: true, default: '' },
                secondSemOtherName: { type: String, trim: true, default: '' },
                secondSemOtherRelation: { type: String, trim: true, default: '' },
                secondSemOtherContact: { type: String, trim: true, default: '' },
                firstSemClaimedAt: { type: Date, default: null },
                secondSemClaimedAt: { type: Date, default: null },
            },
        ],
        default: undefined,
    },
    requirementChecklistByYearSem: {
        type: mongoose.Schema.Types.Mixed,
        default: undefined,
    },
}, {
    timestamps: true,
});

const Grantee = mongoose.model('Grantee', GranteeSchema);

/** Remove indexes left from an older schema that used unique `rid` (client row keys). */
Grantee.dropLegacyIndexes = async function dropLegacyIndexes() {
    const legacyIndexNames = ['rid_1'];
    for (const name of legacyIndexNames) {
        try {
            await this.collection.dropIndex(name);
            console.log(`Dropped legacy grantees index: ${name}`);
        } catch (err) {
            const notFound =
                err?.code === 27 ||
                err?.codeName === 'IndexNotFound' ||
                /index not found/i.test(String(err?.message ?? ''));
            if (!notFound) {
                console.warn(`Could not drop legacy grantees index ${name}:`, err.message);
            }
        }
    }
};

module.exports = Grantee;