const { runAnnouncementMaintenance } = require('../utils/announcementMaintenance');

async function announcementMaintenanceMiddleware(req, res, next) {
    try {
        await runAnnouncementMaintenance();
    } catch (error) {
        console.error('Announcement maintenance middleware failed:', error);
    }
    next();
}

module.exports = announcementMaintenanceMiddleware;
