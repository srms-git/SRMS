const Announcement = require('../models/AnnouncementModel');
const { logActivity } = require('../services/auditLogger');
const { todayDateString } = require('./announcementDates');

const INACTIVE_DELETE_AFTER_DAYS = 3;

function inactiveDeleteCutoffDate() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVE_DELETE_AFTER_DAYS);
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
}

async function expireEndedAnnouncements() {
    const today = todayDateString();
    const now = new Date();
    await Announcement.updateMany(
        {
            active: true,
            $or: [
                { endDate: { $exists: true, $ne: '', $lt: today } },
                {
                    $and: [
                        { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: '' }] },
                        { date: { $exists: true, $ne: '', $lt: today } },
                    ],
                },
            ],
        },
        { $set: { active: false, inactiveAt: now } }
    );
}

async function backfillInactiveTimestamps() {
    await Announcement.updateMany(
        {
            active: false,
            $or: [{ inactiveAt: null }, { inactiveAt: { $exists: false } }],
        },
        [{ $set: { inactiveAt: { $ifNull: ['$updatedAt', '$createdAt'] } } }]
    );
}

async function deleteStaleInactiveAnnouncements() {
    const cutoff = inactiveDeleteCutoffDate();
    const staleRecords = await Announcement.find({
        active: false,
        inactiveAt: { $ne: null, $lte: cutoff },
    });

    if (staleRecords.length === 0) {
        return 0;
    }

    for (const record of staleRecords) {
        logActivity({
            userId: null,
            action: 'AUTO_DELETE_ANNOUNCEMENT',
            entityType: 'announcements',
            entityId: record._id,
            oldValues: record.toObject ? record.toObject() : record,
            newValues: null,
            ipAddress: null,
        });
    }

    const ids = staleRecords.map((record) => record._id);
    await Announcement.deleteMany({ _id: { $in: ids } });
    return staleRecords.length;
}

async function runAnnouncementMaintenance() {
    await expireEndedAnnouncements();
    await backfillInactiveTimestamps();
    return deleteStaleInactiveAnnouncements();
}

function applyActiveState(record, nextActive) {
    record.active = nextActive;
    if (nextActive) {
        record.inactiveAt = null;
    } else {
        record.inactiveAt = new Date();
    }
}

module.exports = {
    INACTIVE_DELETE_AFTER_DAYS,
    inactiveDeleteCutoffDate,
    expireEndedAnnouncements,
    backfillInactiveTimestamps,
    deleteStaleInactiveAnnouncements,
    runAnnouncementMaintenance,
    applyActiveState,
};
