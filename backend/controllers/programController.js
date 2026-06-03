const Program = require('../models/ProgramModel');

// Helper to generate a standardized URL slug
const generateSlug = (code) => {
    return String(code || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

exports.getAllPrograms = async (req, res) => {
    try {
        const programs = await Program.find().sort({ builtIn: -1, code: 1 });
        res.json(programs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve programs', error: err.message });
    }
};

exports.addProgram = async (req, res) => {
    try {
        const { code, name, fullName, description, requirements } = req.body;
        
        const cleanCode = String(code || '').trim().toUpperCase();
        const slug = generateSlug(cleanCode);

        // Check if program code already exists
        const existingProgram = await Program.findOne({ $or: [{ code: cleanCode }, { slug }] });
        if (existingProgram) {
            return res.status(400).json({ message: `A program with code or slug "${cleanCode}" already exists.` });
        }

        const newProgram = new Program({
            code: cleanCode,
            slug,
            name: String(name || cleanCode).trim(),
            fullName: String(fullName || name || cleanCode).trim(),
            description: String(description || '').trim(),
            requirements: Array.isArray(requirements) ? requirements : [],
            builtIn: false
        });

        await newProgram.save();
        res.status(201).json(newProgram);
    } catch (err) {
        res.status(500).json({ message: 'Failed to save program', error: err.message });
    }
};