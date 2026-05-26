const { isConnected } = require('../config/database');

function requireDatabase(req, res, next) {
    if (!isConnected()) {
        return res.status(503).json({
            message: 'Database is unavailable. Please try again in a moment.',
        });
    }
    return next();
}

module.exports = requireDatabase;
