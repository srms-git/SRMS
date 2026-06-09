const mongoose = require('mongoose');

const globalCacheKey = '__srms_mongoose_cache__';
const globalCache = globalThis[globalCacheKey] || (globalThis[globalCacheKey] = { conn: null, promise: null });

function getDbName() {
    const fromEnv = String(process.env.MONGO_DB_NAME || '').trim();
    if (fromEnv) return fromEnv;

    const uri = String(process.env.MONGO_URI || '');
    const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/);
    if (match && match[2]) return match[2];

    return 'test';
}

function isConnected() {
    return mongoose.connection.readyState === 1;
}

async function connectDatabase() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('MONGO_URI is not set in environment.');
    }

    if (isConnected()) {
        return mongoose.connection;
    }

    if (globalCache.conn && !isConnected()) {
        globalCache.conn = null;
    }

    const dbName = getDbName();
    if (!globalCache.promise) {
        globalCache.promise = mongoose
            .connect(uri, { dbName })
            .then(() => mongoose.connection)
            .then((conn) => {
                globalCache.conn = conn;
                return conn;
            })
            .catch((err) => {
                globalCache.promise = null;
                globalCache.conn = null;
                throw err;
            });
    }

    return globalCache.promise;
}

module.exports = {
    connectDatabase,
    getDbName,
    isConnected,
};
