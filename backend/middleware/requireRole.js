function requireRole(...roles) {
    const allowed = roles.map((role) => String(role).trim().toLowerCase()).filter(Boolean);

    return (req, res, next) => {
        if (!req.userId || !req.userRole) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        if (!allowed.includes(String(req.userRole).toLowerCase())) {
            return res.status(403).json({ message: 'You do not have permission to perform this action.' });
        }

        return next();
    };
}

module.exports = requireRole;
