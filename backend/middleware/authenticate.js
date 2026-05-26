const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    const token = header.slice(7).trim();
    if (!token) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: 'Server auth is not configured (JWT_SECRET missing).' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        req.userRole = decoded.role;
        return next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

module.exports = authenticate;
