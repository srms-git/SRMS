const Announcement = require('../models/AnnouncementModel');
const { createInternalNotification } = require('./notificationController');
const { logActivity } = require('../services/auditLogger');
const sharp = require('sharp');

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

/**
 * Helper function to downscale and highly compress image buffers 
 * to ensure our MongoDB storage footprint remains small.
 */
async function compressImage(fileBuffer) {
    try {
        return await sharp(fileBuffer)
            .resize({ width: 800, withoutEnlargement: true }) // Downscale wide resolution profiles
            .jpeg({ quality: 65, progressive: true })       // High compression ratio to yield minimal byte sizes
            .toBuffer();
    } catch (error) {
        console.error('Image compression sub-process failed:', error);
        throw new Error('Failed to process and compress target image attachment.');
    }
}

// 1. Fetch all announcements
exports.getAllAnnouncements = async (req, res) => {
    try {
        // Exclude the heavy raw binary data array from list view queries to maximize network response speed
        const announcements = await Announcement.find({})
            .select('-images.data')
            .sort({ date: -1, createdAt: -1 });
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

        const announcementData = {
            title: title.trim(),
            description: description.trim(),
            type: type || 'new_batch',
            date: date || new Date().toISOString().slice(0, 10),
            active: active !== undefined ? active : true,
            createdBy: req.user?.id || req.userId || null, // Handles either req mutation variant from auth layer
            images: []
        };

        // If files are provided via Multer array payload (e.g., upload.array('images', 8))
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            // Strict enforcement of a maximum of 8 images
            if (req.files.length > 8) {
                return res.status(400).json({ 
                    message: 'Upload restriction exceeded. A maximum of 8 images are allowed per announcement.' 
                });
            }

            // Process and compress image files concurrently
            announcementData.images = await Promise.all(
                req.files.map(async (file) => {
                    const compressedBuffer = await compressImage(file.buffer);
                    return {
                        data: compressedBuffer,
                        contentType: 'image/jpeg', // Uniformly force JPEG content type following sharp encoding
                        fileName: file.originalname || 'attachment.jpg'
                    };
                })
            );
        }

        const newAnnouncement = await Announcement.create(announcementData);

        // Trigger a real-time Notification Center entry whenever a public announcement drops
        const notifType = mapAnnouncementToNotifType(newAnnouncement.type);
        await createInternalNotification(
            newAnnouncement.title,
            newAnnouncement.description,
            notifType
        );

        // Capture creation action to the audit logs
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'CREATE_ANNOUNCEMENT',
            entityType: 'announcements',
            entityId: newAnnouncement._id,
            oldValues: null,
            newValues: newAnnouncement,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(201).json(newAnnouncement);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 3. Update an existing announcement body
exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, type, date, active, clearExistingImages } = req.body;

        // Fetch the record before updating to capture data modification deltas
        const oldRecord = await Announcement.findById(id);
        if (!oldRecord) {
            return res.status(404).json({ message: 'Target announcement record could not be found.' });
        }

        const updates = {
            title: title?.trim(),
            description: description?.trim(),
            type,
            date,
            active
        };

        // Handle image mutations if new sets are provided via Multi-part request streams
        if (req.files && Array.isArray(req.files)) {
            if (req.files.length > 8) {
                return res.status(400).json({ 
                    message: 'Upload restriction exceeded. A maximum of 8 images are allowed per announcement.' 
                });
            }

            if (req.files.length > 0) {
                updates.images = await Promise.all(
                    req.files.map(async (file) => {
                        const compressedBuffer = await compressImage(file.buffer);
                        return {
                            data: compressedBuffer,
                            contentType: 'image/jpeg',
                            fileName: file.originalname || 'attachment.jpg'
                        };
                    })
                );
            } else if (clearExistingImages === 'true') {
                // If no new images are supplied but explicitly marked to drop existing array records
                updates.images = [];
            }
        }

        const updatedRecord = await Announcement.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true } // Return modified version and ensure structural validation
        );

        // Send out an amendment update notification trace if modified successfully
        const notifType = mapAnnouncementToNotifType(updatedRecord.type);
        await createInternalNotification(
            `Updated: ${updatedRecord.title}`,
            `The details for this notice have been modified. Review the announcements board for up-to-date adjustments.`,
            notifType
        );

        // Capture data modification delta states to audit logs
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'UPDATE_ANNOUNCEMENT',
            entityType: 'announcements',
            entityId: updatedRecord._id,
            oldValues: oldRecord,
            newValues: updatedRecord,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

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

        // Deep-clone or transform Mongoose document snapshot before making alterations
        const oldValuesSnapshot = record.toObject ? record.toObject() : { ...record._doc };

        // Flip the underlying state
        record.active = !record.active;
        await record.save();

        // Dispatches system alert tracking visibility configurations changes
        if (record.active) {
            const notifType = mapAnnouncementToNotifType(record.type);
            await createInternalNotification(
                `Notice Reactivated: ${record.title}`,
                `An update regarding ${record.title.toLowerCase()} is active and visible on your dashboard charts.`,
                notifType
            );
        }

        // Capture state visibility mutation inside audit logs
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'TOGGLE_ANNOUNCEMENT_STATUS',
            entityType: 'announcements',
            entityId: record._id,
            oldValues: oldValuesSnapshot,
            newValues: record,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json(record);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 5. Delete an announcement document
exports.deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        // Pull document prior to deletion to preserve field context for systemic history trackers
        const recordToDelete = await Announcement.findById(id);
        if (!recordToDelete) {
            return res.status(404).json({ message: 'Target announcement record could not be found.' });
        }

        await Announcement.findByIdAndDelete(id);

        // Record full document data snapshot inside the oldValues parameter for destruction records
        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'DELETE_ANNOUNCEMENT',
            entityType: 'announcements',
            entityId: id,
            oldValues: recordToDelete,
            newValues: null,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json({ message: 'Announcement deleted successfully.', id });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};