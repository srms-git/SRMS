const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const upload = require('../middleware/uploadMiddleware');

// Standard REST endpoints matching CRUD requirements

// Fetch all announcements archive or post a new announcement (up to 8 image attachments)
router.get('/', announcementController.getAllAnnouncements);
router.post('/', upload.array('images', 8), announcementController.createAnnouncement);

// Modify, toggle visibility states, or hard-delete announcement documents
router.put('/:id', upload.array('images', 8), announcementController.updateAnnouncement);
router.patch('/:id/toggle', announcementController.toggleAnnouncementStatus);
router.delete('/:id', announcementController.deleteAnnouncement);

module.exports = router;