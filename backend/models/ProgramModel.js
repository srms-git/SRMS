const mongoose = require('mongoose');

const ProgramSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        uppercase: true,
        match: [/^[A-Z0-9]{2,12}$/, 'Program code must be 2–12 alphanumeric characters.']
    },
    slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    requirements: [
        {
            id: { type: String, required: true, trim: true },
            label: { type: String, required: true, trim: true }
        }
    ],
    builtIn: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Program', ProgramSchema);