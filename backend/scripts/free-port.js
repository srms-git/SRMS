/**
 * Frees a TCP port on Windows by stopping processes in LISTENING state.
 * Usage: node scripts/free-port.js [port]
 */
const { execSync } = require('child_process');

const port = String(process.argv[2] || process.env.PORT || 5000).trim();

function findListeningPids(targetPort) {
    let output = '';
    try {
        output = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8' });
    } catch {
        return [];
    }

    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
    }
    return [...pids];
}

const pids = findListeningPids(port);
if (pids.length === 0) {
    console.log(`Port ${port} is free.`);
    process.exit(0);
}

for (const pid of pids) {
    try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
        console.log(`Stopped process ${pid} on port ${port}.`);
    } catch (err) {
        console.warn(`Could not stop PID ${pid}:`, err.message || err);
    }
}
