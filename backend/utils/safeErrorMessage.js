function safeErrorMessage(error, fallback = 'An unexpected error occurred.') {
    if (!error) return fallback;
    if (error.name === 'ValidationError' || error.name === 'CastError') {
        return 'Invalid request data.';
    }
    if (error.code === 11000) {
        return 'A record with the same unique value already exists.';
    }
    return fallback;
}

module.exports = {
    safeErrorMessage,
};
