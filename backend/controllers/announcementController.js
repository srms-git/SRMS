const Announcement = require('../models/AnnouncementModel');
const { createInternalNotification } = require('./notificationController');
const { logActivity } = require('../services/auditLogger');
const {
    todayDateString,
    coerceDateString,
    resolveAnnouncementDates,
    validateDateRange,
    formatAnnouncementResponse,
} = require('../utils/announcementDates');
const { resolveAnnouncementTypePayload } = require('../utils/announcementTypes');
const { resolveContentKind, isFeaturedStoryRecord, MAX_FEATURED_STORY_IMAGES, MAX_FEATURED_STORIES_WITH_IMAGES, countFeaturedStoriesWithImages } = require('../utils/announcementContentKinds');
const { applyActiveState } = require('../utils/announcementMaintenance');
const { processUploadedAnnouncementImages } = require('../services/announcementImageProcessing');
const { MAX_ANNOUNCEMENT_IMAGE_COUNT } = require('../middleware/announcementUpload');

function parseAnnouncementDuration(body) {
    const today = todayDateString();
    const legacyDate = body?.date;
    const startDate = coerceDateString(body?.startDate || legacyDate, today);
    const endDateRaw = body?.endDate ?? (legacyDate && !body?.startDate ? legacyDate : '');
    const endDate = endDateRaw ? coerceDateString(endDateRaw, '') : '';
    validateDateRange(startDate, endDate, today);
    return { startDate, endDate, date: startDate };
}

/**
 * Helper function to downscale and highly compress image buffers
 * to ensure our MongoDB storage footprint remains small.
 */
function parseBoolean(value, defaultValue) {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return Boolean(value);
}

function stripImageBinary(doc) {
    const obj = doc?.toObject ? doc.toObject() : { ...doc };
    if (Array.isArray(obj.images)) {
        obj.images = obj.images.map(({ data, ...meta }) => meta);
    }
    return obj;
}

// 1. Fetch all announcements
exports.getAllAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find({})
            .select('-images.data')
            .sort({ startDate: -1, date: -1, createdAt: -1 });
        return res.status(200).json(announcements.map(formatAnnouncementResponse));
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Error pulling announcements archive.' });
    }
};

// 2. Create a new announcement
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, description, active } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ message: 'Title cannot be blank.' });
        }

        let duration;
        let typeFields;
        try {
            duration = parseAnnouncementDuration(req.body);
            typeFields = resolveAnnouncementTypePayload(req.body);
        } catch (validationError) {
            return res.status(validationError.statusCode || 400).json({ message: validationError.message });
        }

        const isActive = parseBoolean(active, true);
        const contentKind = resolveContentKind(req.body, typeFields);
        const isFeaturedStory = contentKind === 'featured_story';
        const incomingImageCount = Array.isArray(req.files) ? req.files.length : 0;

        if (isFeaturedStory && incomingImageCount > MAX_FEATURED_STORY_IMAGES) {
            return res.status(400).json({
                message: `Upload restriction exceeded. A maximum of ${MAX_FEATURED_STORY_IMAGES} images are allowed per featured story.`,
            });
        }

        if (isFeaturedStory && incomingImageCount > 0) {
            const existingWithImages = await countFeaturedStoriesWithImages(Announcement);
            if (existingWithImages >= MAX_FEATURED_STORIES_WITH_IMAGES) {
                return res.status(400).json({
                    message: `Featured story limit reached. You can have up to ${MAX_FEATURED_STORIES_WITH_IMAGES} featured stories with pictures (active or inactive). Delete an existing featured story with pictures to free space before creating another.`,
                });
            }
        }

        const announcementData = {
            title: title.trim(),
            description: (description || '').trim(),
            ...typeFields,
            contentKind,
            ...duration,
            active: isActive,
            inactiveAt: isActive ? null : new Date(),
            createdBy: req.user?.id || req.userId || null,
            images: []
        };

        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            if (req.files.length > MAX_ANNOUNCEMENT_IMAGE_COUNT) {
                return res.status(400).json({
                    message: `Upload restriction exceeded. A maximum of ${MAX_ANNOUNCEMENT_IMAGE_COUNT} images are allowed per announcement.`,
                });
            }

            announcementData.images = await processUploadedAnnouncementImages(req.files);
        }

        const newAnnouncement = await Announcement.create(announcementData);

        await createInternalNotification(
            newAnnouncement.title,
            newAnnouncement.description,
            'announcement'
        );

        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'CREATE_ANNOUNCEMENT',
            entityType: 'announcements',
            entityId: newAnnouncement._id,
            oldValues: null,
            newValues: newAnnouncement,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(201).json(formatAnnouncementResponse(stripImageBinary(newAnnouncement)));
    } catch (error) {
        const status = error.message?.includes('too large') ? 413 : 500;
        return res.status(status).json({ message: error.message || 'Failed to create announcement.' });
    }
};

// 3. Update an existing announcement body
exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, active, clearExistingImages, startDate, endDate, date } = req.body;

        const oldRecord = await Announcement.findById(id);
        if (!oldRecord) {
            return res.status(404).json({ message: 'Target announcement record could not be found.' });
        }

        const updates = {
            title: title?.trim(),
            description: description?.trim(),
        };

        if (
            req.body.type !== undefined ||
            req.body.customType !== undefined ||
            req.body.payoutProgram !== undefined ||
            req.body.payoutBatchNo !== undefined ||
            req.body.payoutDate !== undefined
        ) {
            try {
                Object.assign(
                    updates,
                    resolveAnnouncementTypePayload(
                        {
                            type: req.body.type ?? oldRecord.type,
                            customType: req.body.customType ?? oldRecord.customType,
                            payoutProgram: req.body.payoutProgram ?? oldRecord.payoutProgram,
                            payoutBatchNo: req.body.payoutBatchNo ?? oldRecord.payoutBatchNo,
                            payoutDate: req.body.payoutDate ?? oldRecord.payoutDate,
                        },
                        oldRecord.type
                    )
                );
            } catch (validationError) {
                return res.status(validationError.statusCode || 400).json({ message: validationError.message });
            }
        }
        if (
            req.body.contentKind !== undefined ||
            req.body.type !== undefined ||
            req.body.customType !== undefined
        ) {
            updates.contentKind = resolveContentKind(req.body, {
                type: updates.type ?? oldRecord.type,
                customType: updates.customType ?? oldRecord.customType,
            });
        }
        if (startDate !== undefined || endDate !== undefined || date !== undefined) {
            try {
                const duration = parseAnnouncementDuration({
                    startDate: startDate ?? oldRecord.startDate ?? oldRecord.date,
                    endDate: endDate ?? oldRecord.endDate ?? oldRecord.date,
                    date: date ?? oldRecord.date,
                });
                Object.assign(updates, duration);
            } catch (durationError) {
                return res.status(durationError.statusCode || 400).json({ message: durationError.message });
            }
        }
        if (active !== undefined) {
            const nextActive = parseBoolean(active, oldRecord.active);
            updates.active = nextActive;
            if (nextActive) {
                updates.inactiveAt = null;
            } else if (oldRecord.active !== false) {
                updates.inactiveAt = new Date();
            }
        }

        if (req.files && Array.isArray(req.files)) {
            const resolvedContentKind = updates.contentKind ?? oldRecord.contentKind;
            const isFeaturedStory = isFeaturedStoryRecord({ ...oldRecord.toObject(), contentKind: resolvedContentKind });

            if (isFeaturedStory && req.files.length > MAX_FEATURED_STORY_IMAGES) {
                return res.status(400).json({
                    message: `Upload restriction exceeded. A maximum of ${MAX_FEATURED_STORY_IMAGES} images are allowed per featured story.`,
                });
            }

            const willHaveImages =
                req.files.length > 0 ||
                (clearExistingImages !== 'true' && Array.isArray(oldRecord.images) && oldRecord.images.length > 0);

            if (isFeaturedStory && willHaveImages && req.files.length > 0) {
                const hadImages = Array.isArray(oldRecord.images) && oldRecord.images.length > 0;
                if (!hadImages) {
                    const existingWithImages = await countFeaturedStoriesWithImages(Announcement, id);
                    if (existingWithImages >= MAX_FEATURED_STORIES_WITH_IMAGES) {
                        return res.status(400).json({
                            message: `Featured story limit reached. You can have up to ${MAX_FEATURED_STORIES_WITH_IMAGES} featured stories with pictures (active or inactive). Delete an existing featured story with pictures to free space before adding pictures.`,
                        });
                    }
                }
            }

            if (req.files.length > MAX_ANNOUNCEMENT_IMAGE_COUNT) {
                return res.status(400).json({
                    message: `Upload restriction exceeded. A maximum of ${MAX_ANNOUNCEMENT_IMAGE_COUNT} images are allowed per announcement.`,
                });
            }

            if (req.files.length > 0) {
                updates.images = await processUploadedAnnouncementImages(req.files);
            } else if (clearExistingImages === 'true') {
                updates.images = [];
            }
        }

        const updatedRecord = await Announcement.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );

        await createInternalNotification(
            `Updated: ${updatedRecord.title}`,
            `The details for this notice have been modified. Review the announcements board for up-to-date adjustments.`,
            'announcement'
        );

        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'UPDATE_ANNOUNCEMENT',
            entityType: 'announcements',
            entityId: updatedRecord._id,
            oldValues: oldRecord,
            newValues: updatedRecord,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json(formatAnnouncementResponse(stripImageBinary(updatedRecord)));
    } catch (error) {
        const status = error.message?.includes('too large') ? 413 : 500;
        return res.status(status).json({ message: error.message || 'Failed to update announcement.' });
    }
};

// Serve a single stored image (list/detail responses omit binary payloads)
exports.getAnnouncementImage = async (req, res) => {
    try {
        const { id, imageIndex } = req.params;
        const index = Number.parseInt(imageIndex, 10);
        if (!Number.isInteger(index) || index < 0) {
            return res.status(400).json({ message: 'Invalid image index.' });
        }

        const record = await Announcement.findById(id).select('images');
        if (!record?.images?.[index]?.data) {
            return res.status(404).json({ message: 'Image not found.' });
        }

        const image = record.images[index];
        res.set('Content-Type', image.contentType || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(image.data);
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

        const oldValuesSnapshot = record.toObject ? record.toObject() : { ...record._doc };

        applyActiveState(record, !record.active);
        await record.save();

        if (record.active) {
            await createInternalNotification(
                `Notice Reactivated: ${record.title}`,
                `An update regarding ${record.title.toLowerCase()} is active and visible on your dashboard charts.`,
                'announcement'
            );
        }

        logActivity({
            userId: req.user?.id || req.userId || null,
            action: 'TOGGLE_ANNOUNCEMENT_STATUS',
            entityType: 'announcements',
            entityId: record._id,
            oldValues: oldValuesSnapshot,
            newValues: record,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        });

        return res.status(200).json(formatAnnouncementResponse(record));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 5. Delete an announcement document
exports.deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        const recordToDelete = await Announcement.findById(id);
        if (!recordToDelete) {
            return res.status(404).json({ message: 'Target announcement record could not be found.' });
        }

        await Announcement.findByIdAndDelete(id);

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
