const Notification = require('../models/NotificationModel');

// 1. Fetch notifications with fast matching
exports.getNotifications = async (req, res) => {
    try {
        // Optional: If you manage multi-tenant/staff logins, filter by req.user.id
        // const filter = { $or: [{ recipientId: req.user.id }, { recipientId: null }] };
        const filter = {}; 

        const notifications = await Notification.find(filter).sort({ createdAt: -1 });
        
        return res.status(200).json(notifications);
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Error fetching system updates.' });
    }
};

// 2. Mark a single notification document as read
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const updatedNotification = await Notification.findByIdAndUpdate(
            id,
            { read: true },
            { new: true }
        );

        if (!updatedNotification) {
            return res.status(404).json({ message: 'Target notification could not be found.' });
        }

        return res.status(200).json(updatedNotification);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 3. Global Bulk Patch: Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
    try {
        const filter = { read: false };
        
        // Optional account scoping:
        // if (req.user?.id) filter.recipientId = req.user.id;

        await Notification.updateMany(filter, { $set: { read: true } });

        return res.status(200).json({ message: 'All pending status markers updated to read.' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 4. Utility method for internal backend use across controllers (e.g., when a batch is archived or created)
exports.createInternalNotification = async (title, message, type, recipientId = null, meta = null) => {
    try {
        const payload = { title, message, type, recipientId };
        if (meta && typeof meta === 'object') {
            payload.meta = meta;
        }
        await Notification.create(payload);
        return true;
    } catch (error) {
        console.error('Failed to dispatch background system notification trace:', error);
        return false;
    }
};