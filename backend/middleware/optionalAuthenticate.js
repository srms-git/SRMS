const jwt = require('jsonwebtoken');

function optionalAuthenticate(req, res, next) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return next();
    }

    const token = header.slice(7).trim();
    if (!token || !process.env.JWT_SECRET) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        req.userRole = decoded.role;
        req.user = { id: decoded.id, role: decoded.role };
    } catch {
        // Ignore invalid tokens for optional auth routes.
    }

    return next();
}

module.exports = optionalAuthenticate;
