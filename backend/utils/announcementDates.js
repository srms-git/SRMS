function todayDateString() {
    return new Date().toISOString().slice(0, 10);
}

function coerceDateString(value, fallback) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
    }
    return fallback;
}

function resolveAnnouncementDates(record) {
    const legacy = record?.date;
    const fallback = legacy || todayDateString();
    const startDate = coerceDateString(record?.startDate, fallback);
    const endDate = coerceDateString(record?.endDate, legacy || startDate);
    return { startDate, endDate };
}

function addDaysToDateString(isoDate, days) {
    const date = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) return isoDate;
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function getMinimumEndDate(startDate, today = todayDateString()) {
    const dayAfterToday = addDaysToDateString(today, 1);
    if (!startDate) return dayAfterToday;
    return startDate > dayAfterToday ? startDate : dayAfterToday;
}

function validateDateRange(startDate, endDate, today = todayDateString()) {
    if (!endDate) {
        const error = new Error('End date is required.');
        error.statusCode = 400;
        throw error;
    }
    if (endDate < startDate) {
        const error = new Error('End date must be on or after the start date.');
        error.statusCode = 400;
        throw error;
    }
    if (endDate <= today) {
        const error = new Error('End date must be after today.');
        error.statusCode = 400;
        throw error;
    }
}

function isWithinVisibleWindow(startDate, endDate, today = todayDateString()) {
    return today >= startDate && today <= endDate;
}

function isVisibleOnLanding(record, today = todayDateString()) {
    if (!record || record.active === false) return false;
    const { startDate, endDate } = resolveAnnouncementDates(record);
    return isWithinVisibleWindow(startDate, endDate, today);
}

function formatAnnouncementResponse(doc) {
    const obj = doc?.toObject ? doc.toObject() : { ...doc };
    const { startDate, endDate } = resolveAnnouncementDates(obj);
    return {
        ...obj,
        startDate,
        endDate,
        date: startDate,
    };
}

module.exports = {
    todayDateString,
    coerceDateString,
    addDaysToDateString,
    getMinimumEndDate,
    resolveAnnouncementDates,
    validateDateRange,
    isWithinVisibleWindow,
    isVisibleOnLanding,
    formatAnnouncementResponse,
};
