const Announcement = require('../models/AnnouncementModel');
const { logActivity } = require('../services/auditLogger');
const { todayDateString } = require('./announcementDates');

const INACTIVE_DELETE_AFTER_DAYS = 3;
const INACTIVE_DELETE_AFTER_MS = INACTIVE_DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000;

function inactiveDeleteCutoffDate() {
    return new Date(Date.now() - INACTIVE_DELETE_AFTER_MS);
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

/** Records marked inactive before inactiveAt existed — use stable createdAt, not updatedAt. */
async function backfillInactiveTimestamps() {
    await Announcement.updateMany(
        {
            active: false,
            $or: [{ inactiveAt: null }, { inactiveAt: { $exists: false } }],
        },
        [{ $set: { inactiveAt: { $ifNull: ['$createdAt', new Date()] } } }],
        { updatePipeline: true }
    );
}

async function deleteStaleInactiveAnnouncements() {
    const cutoff = inactiveDeleteCutoffDate();

    const staleRecords = await Announcement.find({
        active: false,
        $or: [
            { inactiveAt: { $ne: null, $lte: cutoff } },
            {
                $and: [
                    { $or: [{ inactiveAt: null }, { inactiveAt: { $exists: false } }] },
                    { createdAt: { $lte: cutoff } },
                ],
            },
        ],
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

let maintenanceIntervalId = null;

function startAnnouncementMaintenanceSchedule(intervalMs = 60 * 60 * 1000) {
    if (maintenanceIntervalId) return;

    const run = async () => {
        try {
            const deleted = await runAnnouncementMaintenance();
            if (deleted > 0) {
                console.log(`Announcement maintenance: auto-deleted ${deleted} inactive record(s).`);
            }
        } catch (error) {
            console.error('Announcement maintenance failed:', error);
        }
    };

    void run();
    maintenanceIntervalId = setInterval(run, intervalMs);
    maintenanceIntervalId.unref?.();
}

function stopAnnouncementMaintenanceSchedule() {
    if (maintenanceIntervalId) {
        clearInterval(maintenanceIntervalId);
        maintenanceIntervalId = null;
    }
}

module.exports = {
    INACTIVE_DELETE_AFTER_DAYS,
    INACTIVE_DELETE_AFTER_MS,
    inactiveDeleteCutoffDate,
    expireEndedAnnouncements,
    backfillInactiveTimestamps,
    deleteStaleInactiveAnnouncements,
    runAnnouncementMaintenance,
    applyActiveState,
    startAnnouncementMaintenanceSchedule,
    stopAnnouncementMaintenanceSchedule,
};
