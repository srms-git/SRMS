const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');

// Standard REST endpoints matching CRUD requirements
router.get('/', announcementController.getAllAnnouncements);
router.post('/', announcementController.createAnnouncement);
router.put('/:id', announcementController.updateAnnouncement);
router.patch('/:id/toggle', announcementController.toggleAnnouncementStatus);
router.delete('/:id', announcementController.deleteAnnouncement);

module.exports = router;