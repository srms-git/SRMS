const { resolveAnnouncementBatchLinkPayload } = require('./announcementBatchLink');

const KNOWN_TYPES = new Set([
    'new_batch',
    'requirement_schedule',
    'payout_schedule',
    'unclaimed',
    'opportunity',
    'advisory',
    'other',
]);

function resolveAnnouncementTypePayload(body, fallbackType = 'new_batch') {
    const type = body?.type || fallbackType;
    if (!KNOWN_TYPES.has(type)) {
        const error = new Error('Invalid announcement type.');
        error.statusCode = 400;
        throw error;
    }

    const customType = typeof body?.customType === 'string' ? body.customType.trim() : '';

    if (type === 'other') {
        if (!customType) {
            const error = new Error('Please enter a type when Other is selected.');
            error.statusCode = 400;
            throw error;
        }
        if (customType.length > 80) {
            const error = new Error('Custom type must be 80 characters or fewer.');
            error.statusCode = 400;
            throw error;
        }
        return {
            type: 'other',
            customType,
            ...resolveAnnouncementBatchLinkPayload({ type: 'other' }, 'other'),
        };
    }

    const batchFields = resolveAnnouncementBatchLinkPayload(body, type);
    return { type, customType: '', ...batchFields };
}

function getAnnouncementTypeLabel(record) {
    if (!record) return 'General';
    if (record.type === 'other') {
        const custom = typeof record.customType === 'string' ? record.customType.trim() : '';
        return custom || 'Other';
    }
    const labels = {
        new_batch: 'New batch',
        requirement_schedule: 'Requirement schedule',
        payout_schedule: 'Payout schedule',
        unclaimed: 'Unclaimed',
        opportunity: 'Opportunity',
        advisory: 'Advisory',
    };
    return labels[record.type] || 'General';
}

module.exports = {
    resolveAnnouncementTypePayload,
    getAnnouncementTypeLabel,
};
