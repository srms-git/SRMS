const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectDatabase } = require('./config/database');
const { verifyEmailConnection } = require('./utils/emailService');
const requireDatabase = require('./middleware/requireDatabase');

const granteeRoutes = require('./routes/granteeRoutes');
const authRoutes = require('./routes/authRoutes');
const archiveRoutes = require('./routes/archiveRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const claimHistoryRoutes = require('./routes/claimHistoryRoutes');
const Grantee = require('./models/GranteeModel');
const User = require('./models/UserModel');

const app = express();
const PORT = process.env.PORT || 5000;

const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (origin === frontendOrigin) return callback(null, true);
            callback(null, true);
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

app.get('/', (req, res) => {
    res.send('SRMS Backend is Running!');
});

async function start() {
    try {
        await connectDatabase();
        await Grantee.dropLegacyIndexes();

        const userCount = await User.countDocuments();
        console.log(`Users collection: ${userCount} account(s) loaded from MongoDB`);

        const emailStatus = await verifyEmailConnection();
        if (emailStatus.ok) {
            console.log('SMTP: ready to send password reset emails');
        } else {
            console.warn(`SMTP: ${emailStatus.reason}`);
            console.warn('Password reset emails will not send until SMTP_PASS is set in backend/.env');
        }

        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
