const { connectDatabase } = require('../config/database');

async function requireDatabase(req, res, next) {
    try {
        await connectDatabase();
        return next();
    } catch (err) {
        console.error('Database connection failed:', err?.message || err);
        return res.status(503).json({
            message: 'Database is unavailable. Please try again in a moment.',
        });
    }
}

module.exports = requireDatabase;
