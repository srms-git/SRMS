const path = require('path');

const HEARTBEAT_INTERVAL_MS = 30_000;

let maintenanceMode = false;
let maintenanceMessage = '';
let requestCount = 0;
let errorCount = 0;
let heartbeatIntervalId = null;

function getAppVersion() {
    const fromEnv = String(process.env.APP_VERSION || '').trim();
    if (fromEnv) return fromEnv;
    try {
        const pkg = require(path.join(__dirname, '../../frontend/package.json'));
        return pkg.version || 'unknown';
    } catch {
        return 'unknown';
    }
}

function isEnabled() {
    return Boolean(
        String(process.env.CONTROLLER_URL || '').trim() &&
            String(process.env.PROJECT_API_KEY || '').trim(),
    );
}

function getControllerUrl() {
    return String(process.env.CONTROLLER_URL || '').trim().replace(/\/$/, '');
}

function getProjectKey() {
    return String(process.env.PROJECT_API_KEY || '').trim();
}

function getMetrics() {
    return {
        uptime: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        requestCount,
        errorCount,
    };
}

function applyMaintenanceFromResponse(data) {
    if (!data || typeof data !== 'object') return;
    if (typeof data.maintenanceMode === 'boolean') {
        maintenanceMode = data.maintenanceMode;
    }
    if (typeof data.maintenanceMessage === 'string') {
        maintenanceMessage = data.maintenanceMessage;
    }
}

async function postHeartbeat() {
    const res = await fetch(`${getControllerUrl()}/api/heartbeat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-project-key': getProjectKey(),
        },
        body: JSON.stringify({
            version: getAppVersion(),
            metrics: getMetrics(),
        }),
    });

    if (!res.ok) {
        throw new Error(`Heartbeat failed with status ${res.status}`);
    }

    const data = await res.json();
    applyMaintenanceFromResponse(data);
    return data;
}

async function fetchControllerConfig() {
    const res = await fetch(`${getControllerUrl()}/api/heartbeat/config`, {
        headers: { 'x-project-key': getProjectKey() },
    });

    if (!res.ok) {
        throw new Error(`Config fetch failed with status ${res.status}`);
    }

    const data = await res.json();
    applyMaintenanceFromResponse(data);
    return data;
}

async function runHeartbeat() {
    try {
        await postHeartbeat();
    } catch (error) {
        console.error('Controller heartbeat failed:', error?.message || error);
    }
}

function startControllerHeartbeat() {
    if (!isEnabled()) {
        console.log('Controller integration disabled (set CONTROLLER_URL and PROJECT_API_KEY to enable).');
        return;
    }
    if (heartbeatIntervalId) return;

    console.log(`Controller heartbeat started (${getControllerUrl()})`);
    void runHeartbeat();
    heartbeatIntervalId = setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS);
    heartbeatIntervalId.unref?.();
}

function stopControllerHeartbeat() {
    if (!heartbeatIntervalId) return;
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
}

function incrementRequestCount() {
    requestCount += 1;
}

function incrementErrorCount() {
    errorCount += 1;
}

function getMaintenanceState() {
    return { maintenanceMode, maintenanceMessage };
}

function getHealthSnapshot() {
    return {
        status: maintenanceMode ? 'maintenance' : 'ok',
        version: getAppVersion(),
        maintenanceMode,
        maintenanceMessage,
        metrics: getMetrics(),
        controllerEnabled: isEnabled(),
    };
}

module.exports = {
    startControllerHeartbeat,
    stopControllerHeartbeat,
    fetchControllerConfig,
    incrementRequestCount,
    incrementErrorCount,
    getMaintenanceState,
    getHealthSnapshot,
};
