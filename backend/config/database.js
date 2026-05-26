const mongoose = require('mongoose');

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

    const dbName = getDbName();
    await mongoose.connect(uri, { dbName });
    console.log(`Database connected (${dbName}) — collections include "users"`);
    return mongoose.connection;
}

module.exports = {
    connectDatabase,
    getDbName,
    isConnected,
};
