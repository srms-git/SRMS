const mongoose = require('mongoose');

function isValidObjectId(value) {
    const text = String(value ?? '').trim();
    if (!text) return false;
    if (!mongoose.Types.ObjectId.isValid(text)) return false;
    return String(new mongoose.Types.ObjectId(text)) === text;
}

/** Reject objects/arrays from query strings (NoSQL operator injection). */
function queryString(value) {
    if (value == null) return '';
    if (typeof value === 'object') return '';
    return String(value).trim();
}

module.exports = {
    isValidObjectId,
    queryString,
};
