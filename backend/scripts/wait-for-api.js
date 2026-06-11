/**
 * Waits until the SRMS API accepts TCP connections (used before starting Vite).
 * Usage: node scripts/wait-for-api.js [port]
 */
const net = require('net');

const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.argv[2] || process.env.PORT || 5000);
const timeoutMs = Number(process.env.API_WAIT_TIMEOUT_MS || 60000);
const intervalMs = Number(process.env.API_WAIT_INTERVAL_MS || 250);

function probe() {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.once('connect', () => {
            socket.destroy();
            resolve();
        });
        socket.once('error', (err) => {
            socket.destroy();
            reject(err);
        });
        socket.once('timeout', () => {
            socket.destroy();
            reject(new Error('timeout'));
        });
        socket.connect(port, host);
    });
}

async function waitForApi() {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        try {
            await probe();
            console.log(`API ready on ${host}:${port}`);
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
    }

    console.error(`Timed out waiting for API on ${host}:${port}`);
    process.exit(1);
}

void waitForApi();
