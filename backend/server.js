require('dotenv').config();

const app = require('./app');
const { connectDatabase } = require('./config/database');
const { startAnnouncementMaintenanceSchedule } = require('./utils/announcementMaintenance');
const PORT = Number(process.env.PORT) || 5000;

let server;

function shutdown(signal) {
    if (!server) {
        process.exit(0);
        return;
    }
    console.log(`${signal}: closing server on port ${PORT}...`);
    server.close((err) => {
        if (err) {
            console.error('Error while closing server:', err);
            process.exit(1);
            return;
        }
        process.exit(0);
    });
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 5000).unref();
}

async function start() {
    const jwtSecret = String(process.env.JWT_SECRET || '').trim();
    if (process.env.NODE_ENV === 'production') {
        if (!jwtSecret || jwtSecret.length < 32 || /change-me/i.test(jwtSecret)) {
            console.error('Refusing to start: set a strong JWT_SECRET (32+ chars) in production.');
            process.exit(1);
        }
    }

    try {
        await connectDatabase();
        console.log('Database connected');
    } catch (err) {
        console.error('Failed to connect to database:', err?.message || err);
        process.exit(1);
    }

    server = app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log(`Landing batches: http://127.0.0.1:${PORT}/api/landing-batches`);
        console.log(`Landing privacy: http://127.0.0.1:${PORT}/api/landing-batches/page-settings`);
        startAnnouncementMaintenanceSchedule();
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(
                `Port ${PORT} is already in use. Run "pnpm free-port" in the backend folder (or stop the other Node process), then start again.`,
            );
            process.exit(1);
        }
        throw err;
    });
}

void start();

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
