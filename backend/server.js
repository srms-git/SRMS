require('dotenv').config();

const app = require('./app');
const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Landing batches: http://127.0.0.1:${PORT}/api/landing-batches`);
    console.log(`Landing privacy: http://127.0.0.1:${PORT}/api/landing-batches/page-settings`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(
            `Port ${PORT} is already in use. Stop the other process (e.g. an old node server) and run "npm run dev" again.`,
        );
        process.exit(1);
    }
    throw err;
});
