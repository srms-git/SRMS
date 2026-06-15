const BATCH_LINKED_TYPES = new Set(['payout_schedule', 'requirement_schedule']);

function trimString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function resolveLinkedBatchFields(body, type) {
    if (!BATCH_LINKED_TYPES.has(type)) {
        return {
            linkedBatchNo: '',
            linkedProgram: '',
            linkedAcademicYear: '',
        };
    }

    const linkedBatchNo = trimString(body?.linkedBatchNo);
    const linkedProgram = trimString(body?.linkedProgram).toUpperCase();
    const linkedAcademicYear = trimString(body?.linkedAcademicYear);

    if (!linkedBatchNo || !linkedProgram || !linkedAcademicYear) {
        const error = new Error('Program and target batch are required for this announcement type.');
        error.statusCode = 400;
        throw error;
    }

    return { linkedBatchNo, linkedProgram, linkedAcademicYear };
}

function resolveScheduleFields(body, type) {
    const scheduleDate = trimString(body?.scheduleDate);
    const scheduleTime = trimString(body?.scheduleTime);
    const scheduleLocation = trimString(body?.scheduleLocation);

    if (type === 'payout_schedule' && !scheduleDate) {
        const error = new Error('Payout date is required for payout schedule announcements.');
        error.statusCode = 400;
        throw error;
    }

    if (scheduleTime.length > 120) {
        const error = new Error('Schedule time must be 120 characters or fewer.');
        error.statusCode = 400;
        throw error;
    }

    if (scheduleLocation.length > 200) {
        const error = new Error('Schedule location must be 200 characters or fewer.');
        error.statusCode = 400;
        throw error;
    }

    if (!BATCH_LINKED_TYPES.has(type)) {
        return {
            scheduleDate: '',
            scheduleTime: '',
            scheduleLocation: '',
        };
    }

    return { scheduleDate, scheduleTime, scheduleLocation };
}

function resolveAnnouncementBatchLinkPayload(body, type) {
    const linked = resolveLinkedBatchFields(body, type);
    const schedule = resolveScheduleFields(body, type);
    return { ...linked, ...schedule };
}

function formatLinkedBatchLabel(record) {
    const batchNo = trimString(record?.linkedBatchNo);
    const program = trimString(record?.linkedProgram);
    const academicYear = trimString(record?.linkedAcademicYear);
    if (!batchNo || !program || !academicYear) return '';
    return `Batch ${batchNo} · ${program} · AY ${academicYear}`;
}

function formatScheduleSummary(record) {
    const parts = [];
    const scheduleDate = trimString(record?.scheduleDate);
    const scheduleTime = trimString(record?.scheduleTime);
    const scheduleLocation = trimString(record?.scheduleLocation);

    if (scheduleDate) {
        parts.push(`Date: ${scheduleDate}`);
    }
    if (scheduleTime) {
        parts.push(`Time: ${scheduleTime}`);
    }
    if (scheduleLocation) {
        parts.push(`Location: ${scheduleLocation}`);
    }

    return parts.join(' · ');
}

function buildPayoutScheduleNotificationMessage(record) {
    const batchLabel = formatLinkedBatchLabel(record);
    const scheduleSummary = formatScheduleSummary(record);
    const description = trimString(record?.description);
    const lines = [];

    if (batchLabel) {
        lines.push(batchLabel);
    }
    if (scheduleSummary) {
        lines.push(scheduleSummary);
    }
    if (description) {
        lines.push(description);
    }

    return lines.join('\n\n') || 'Review the payout schedule details for this batch.';
}

module.exports = {
    BATCH_LINKED_TYPES,
    resolveAnnouncementBatchLinkPayload,
    formatLinkedBatchLabel,
    formatScheduleSummary,
    buildPayoutScheduleNotificationMessage,
};
