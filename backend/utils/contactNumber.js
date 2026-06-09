const PH_CONTACT_PREFIX = '+63';

/** National number digits only (max 10), without country code or leading 0. */
function extractPhilippineContactDigits(value) {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.startsWith('63')) {
        digits = digits.slice(2);
    }
    while (digits.startsWith('0')) {
        digits = digits.slice(1);
    }
    return digits.slice(0, 10);
}

function formatPhilippineContactNumber(value) {
    const digits = extractPhilippineContactDigits(value);
    if (!digits) return PH_CONTACT_PREFIX;

    let formatted = `${PH_CONTACT_PREFIX}(${digits.slice(0, 3)}`;
    if (digits.length >= 3) formatted += ')';
    if (digits.length > 3) formatted += `-${digits.slice(3, 6)}`;
    if (digits.length > 6) formatted += `-${digits.slice(6, 10)}`;
    return formatted;
}

/** Normalize contact numbers for storage/API payloads. */
function sanitizeContactNumber(value) {
    const digits = extractPhilippineContactDigits(value);
    if (!digits) return '';
    return formatPhilippineContactNumber(digits);
}

module.exports = {
    sanitizeContactNumber,
    formatPhilippineContactNumber,
    extractPhilippineContactDigits,
};
