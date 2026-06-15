const { getMaintenanceState } = require('../services/controllerIntegration');

const BYPASS_PATHS = new Set(['/internal/health']);

function controllerMaintenanceMiddleware(req, res, next) {
    if (BYPASS_PATHS.has(req.path)) {
        return next();
    }

    const { maintenanceMode, maintenanceMessage } = getMaintenanceState();
    if (!maintenanceMode) {
        return next();
    }

    return res.status(503).json({
        error: 'Service temporarily unavailable',
        maintenance: true,
        message:
            maintenanceMessage ||
            'The application is under maintenance. Please try again later.',
    });
}

module.exports = controllerMaintenanceMiddleware;
