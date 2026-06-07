require('dotenv').config();

const app = require('./app');
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

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
