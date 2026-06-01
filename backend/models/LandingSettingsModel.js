const mongoose = require('mongoose');

const WorkflowStepSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, trim: true },
        step: { type: String, default: '01', trim: true },
        title: { type: String, default: '', trim: true },
        description: { type: String, default: '', trim: true },
        icon: { type: String, default: 'ListChecks', trim: true },
        color: { type: String, default: '#081F5C', trim: true },
        colorLight: { type: String, default: '#1447a6', trim: true },
    },
    { _id: false },
);

const LandingSettingsSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            default: 'default',
            trim: true,
        },
        publishedBatchKeys: {
            type: [String],
            default: [],
        },
        privacy: {
            maskBatchNumberInPublicList: { type: Boolean, default: false },
            hideGranteeCountInPublicList: { type: Boolean, default: false },
            showProgramTag: { type: Boolean, default: true },
            showAcademicYear: { type: Boolean, default: true },
            showDateAdded: { type: Boolean, default: true },
            showViewAllBatchesLink: { type: Boolean, default: true },
            showStudentIdInLandingBatchList: { type: Boolean, default: true },
            showAwardNumberInLandingBatchList: { type: Boolean, default: true },
            showFullNameInLandingBatchList: { type: Boolean, default: true },
            showEnrolledProgramInLandingBatchList: { type: Boolean, default: true },
            showYearLevelInLandingBatchList: { type: Boolean, default: true },
        },
        processWorkflow: {
            steps: {
                type: [WorkflowStepSchema],
                default: [],
            },
        },
    },
    { timestamps: true },
);

module.exports = mongoose.model('LandingSettings', LandingSettingsSchema);
