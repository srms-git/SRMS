const express = require('express');
const cors = require('cors');

const requireDatabase = require('./middleware/requireDatabase');

const granteeRoutes = require('./routes/granteeRoutes');
const authRoutes = require('./routes/authRoutes');
const archiveRoutes = require('./routes/archiveRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const claimHistoryRoutes = require('./routes/claimHistoryRoutes');

const app = express();

const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (origin === frontendOrigin) return callback(null, true);
            return callback(null, true);
        },
    }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/grantees', requireDatabase, granteeRoutes);
app.use('/api/archive', requireDatabase, archiveRoutes);
app.use('/api/announcements', requireDatabase, announcementRoutes);
app.use('/api/notifications', requireDatabase, notificationRoutes);
app.use('/api/claim-history', requireDatabase, claimHistoryRoutes);

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/', (req, res) => {
    res.send('SRMS Backend is Running!');
});

module.exports = app;

