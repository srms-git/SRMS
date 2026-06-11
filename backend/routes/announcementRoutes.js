const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const announcementMaintenanceMiddleware = require('../middleware/announcementMaintenanceMiddleware');
const { runAnnouncementImageUpload } = require('../middleware/announcementUpload');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

router.use(announcementMaintenanceMiddleware);

router.get('/', announcementController.getAllAnnouncements);
router.get('/:id/images/:imageIndex', announcementController.getAnnouncementImage);
router.post('/', authenticate, requireRole('osgfa'), runAnnouncementImageUpload, announcementController.createAnnouncement);
router.put('/:id', authenticate, requireRole('osgfa'), runAnnouncementImageUpload, announcementController.updateAnnouncement);
router.patch('/:id/toggle', authenticate, requireRole('osgfa'), announcementController.toggleAnnouncementStatus);
router.delete('/:id', authenticate, requireRole('osgfa'), announcementController.deleteAnnouncement);

module.exports = router;
