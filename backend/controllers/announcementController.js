const Announcement = require('../models/AnnouncementModel');
const { createInternalNotification } = require('./notificationController');

/**
 * Helper to map announcement type tokens to structural notification group keys
 * to guarantee that the frontend rendering engine picks up the correct colors/icons.
 */
const mapAnnouncementToNotifType = (announcementType) => {
    switch (announcementType) {
        case 'new_batch':
            return 'batch';
        case 'requirement_schedule':
        case 'unclaimed':
            return 'reminder';
        case 'payout_schedule':
            return 'claim';
        case 'opportunity':
        default:
            return 'system';
    }
};

// 1. Fetch all announcements
exports.getAllAnnouncements = async (req, res) => {
    try {
        // Fetch all items from database, descending order by post date
        const announcements = await Announcement.find({}).sort({ date: -1, createdAt: -1 });
        return res.status(200).json(announcements);
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Error pulling announcements archive.' });
    }
};

// 2. Create a new announcement
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, description, type, date, active } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: 'Title and description fields cannot be blank.' });
        }

        const newAnnouncement = await Announcement.create({
            title: title.trim(),
            description: description.trim(),
            type: type || 'new_batch',
            date: date || new Date().toISOString().slice(0, 10),
            active: active !== undefined ? active : true,
            createdBy: req.user?.id || null // Captures user ref if using authentication middleware
        });

        // Trigger a real-time Notification Center entry whenever a public announcement drops
        const notifType = mapAnnouncementToNotifType(newAnnouncement.type);
        await createInternalNotification(
            newAnnouncement.title,
            newAnnouncement.description,
            notifType
        );

        return res.status(201).json(newAnnouncement);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 3. Update an existing announcement body
exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, type, date, active } = req.body;

        const updatedRecord = await Announcement.findByIdAndUpdate(
            id,
            {
                title: title?.trim(),
                description: description?.trim(),
                type,
                date,
                active
            },
            { new: true, runValidators: true } // Return modified version and ensure structural validation
        );

        if (!updatedRecord) {
            return res.status(404).json({ message: 'Target announcement record could not be found.' });
        }

        // Send out an amendment update notification trace if modified successfully
        const notifType = mapAnnouncementToNotifType(updatedRecord.type);
        await createInternalNotification(
            `Updated: ${updatedRecord.title}`,
            `The details for this notice have been modified. Review the announcements board for up-to-date adjustments.`,
            notifType
        );

        return res.status(200).json(updatedRecord);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 4. Toggle active/inactive state cleanly without altering body data
exports.toggleAnnouncementStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await Announcement.findById(id);
        if (!record) {
            return res.status(404).json({ message: 'Target announcement record could not be found.' });
        }

        // Flip the underlying state
        record.active = !record.active;
        await record.save();

        // Optional: Dispatches system alert tracking visibility configurations changes
        if (record.active) {
            const notifType = mapAnnouncementToNotifType(record.type);
            await createInternalNotification(
                `Notice Reactivated: ${record.title}`,
                `An update regarding ${record.title.toLowerCase()} is active and visible on your dashboard charts.`,
                notifType
            );
        }

        return res.status(200).json(record);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 5. Delete an announcement document
exports.deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedRecord = await Announcement.findByIdAndDelete(id);
        if (!deletedRecord) {
            return res.status(404).json({ message: 'Target announcement record could not be found.' });
        }

        return res.status(200).json({ message: 'Announcement deleted successfully.', id });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};