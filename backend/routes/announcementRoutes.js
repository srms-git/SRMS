const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const announcementMaintenanceMiddleware = require('../middleware/announcementMaintenanceMiddleware');
const { runAnnouncementImageUpload } = require('../middleware/announcementUpload');

router.use(announcementMaintenanceMiddleware);

// Standard REST endpoints matching CRUD requirements

// Fetch all announcements archive or post a new announcement (up to 8 image attachments)
router.get('/', announcementController.getAllAnnouncements);
router.get('/:id/images/:imageIndex', announcementController.getAnnouncementImage);
router.post('/', runAnnouncementImageUpload, announcementController.createAnnouncement);

// Modify, toggle visibility states, or hard-delete announcement documents
router.put('/:id', runAnnouncementImageUpload, announcementController.updateAnnouncement);
router.patch('/:id/toggle', announcementController.toggleAnnouncementStatus);
router.delete('/:id', announcementController.deleteAnnouncement);

module.exports = router;