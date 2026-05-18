const { captureCurrentMonitorPng } = require('./screenshotCapture');
const { getDefaultDeviceId, getWorkStatus, uploadScreenshot } = require('./screenshotUploader');
const { describeHttpError } = require('./httpError');

const IS_DEV = process.env.NODE_ENV === 'development';
const DEFAULT_SCREENSHOT_INTERVAL_MS = 10 * 60 * 1000;
const MIN_SCREENSHOT_INTERVAL_SECS = 60;
const MAX_SCREENSHOT_INTERVAL_SECS = 3600;

let authToken = null;
let timer = null;
let running = false;
let tickInFlight = false;
let screenshotIntervalMs = DEFAULT_SCREENSHOT_INTERVAL_MS;
let firstCaptureAfterAuth = false;
let lastSuccessAt = null;
let lastFailureAt = null;
let lastFailureMessage = null;

const deviceId = getDefaultDeviceId();

function describeInterval(ms) {
    if (ms >= 60_000) return `${Math.round(ms / 60_000)} minute(s)`;
    return `${Math.round(ms / 1000)} second(s)`;
}

function normalizeIntervalSecs(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
    const rounded = Math.round(seconds);
    if (rounded < MIN_SCREENSHOT_INTERVAL_SECS || rounded > MAX_SCREENSHOT_INTERVAL_SECS) return null;
    return rounded;
}

function clearTimer() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
}

function scheduleNextTick() {
    clearTimer();
    if (!running) return;

    const delayMs = firstCaptureAfterAuth ? Math.min(10_000, screenshotIntervalMs) : screenshotIntervalMs;
    firstCaptureAfterAuth = false;

    timer = setTimeout(async () => {
        await runCaptureCycle();
        scheduleNextTick();
    }, delayMs);
}

async function runCaptureCycle() {
    if (tickInFlight) return;
    if (!authToken) {
        console.log('[Screenshot] Skipping cycle: auth token missing');
        return;
    }

    tickInFlight = true;
    try {
        const status = await getWorkStatus(authToken);
        if (status !== 'working') {
            console.log(`[Screenshot] Skipping cycle: shift status is '${status || 'unknown'}'`);
            return;
        }

        const capture = await captureCurrentMonitorPng();
        const payload = {
            capturedAt: new Date().toISOString(),
            deviceId,
            display: capture.display,
            imageBase64: capture.imageBuffer.toString('base64'),
        };

        const response = await uploadScreenshot(authToken, payload);
        const screenshot = response?.data?.screenshot;
        const fileId = screenshot?.id;
        const requestId = screenshot?.requestId;
        const rowId = screenshot?.rowId;

        if (fileId && requestId && rowId) {
            console.log(
                `[Screenshot] Upload confirmed end-to-end. requestId=${requestId}, rowId=${rowId}, oneDriveFileId=${fileId}`
            );
        } else if (fileId) {
            console.log(`[Screenshot] Upload success. OneDrive file id: ${fileId}`);
        } else {
            console.log('[Screenshot] Upload success.');
        }
        lastSuccessAt = new Date().toISOString();
        lastFailureMessage = null;
    } catch (err) {
        const statusCode = err?.response?.status;
        const msg = describeHttpError(err, 'Unknown screenshot error');
        lastFailureAt = new Date().toISOString();
        lastFailureMessage = msg;
        if (statusCode === 503) {
            console.log('[Screenshot] Upload rejected: admin drive is disconnected |', msg);
        } else if (statusCode === 401) {
            console.log('[Screenshot] Upload skipped: auth token expired |', msg);
        } else {
            console.log('[Screenshot] Capture/upload failed:', msg);
        }
    } finally {
        tickInFlight = false;
    }
}

function setAuthToken(token) {
    if (typeof token !== 'string') {
        authToken = null;
        return;
    }
    const normalized = token.trim().replace(/^Bearer\s+/i, '');
    authToken = normalized || null;

    // Take the first screenshot shortly after login in dev/local testing instead
    // of waiting a full admin interval before anything appears on the dashboard.
    firstCaptureAfterAuth = !!authToken;
    if (running) scheduleNextTick();
}

function clearAuthToken() {
    authToken = null;
}

function setIntervalSecs(seconds) {
    const normalized = normalizeIntervalSecs(seconds);
    if (!normalized) return;

    const nextIntervalMs = normalized * 1000;
    if (nextIntervalMs === screenshotIntervalMs) return;

    screenshotIntervalMs = nextIntervalMs;
    console.log(`[Screenshot] Interval updated to ${describeInterval(screenshotIntervalMs)}`);

    if (running) scheduleNextTick();
}

function start() {
    if (running) return;
    running = true;
    scheduleNextTick();
    console.log(`[Screenshot] Scheduler started (${describeInterval(screenshotIntervalMs)} interval, mode=${IS_DEV ? 'dev' : 'prod'})`);
}

function stop() {
    running = false;
    clearTimer();
    console.log('[Screenshot] Scheduler stopped');
}

function getHealth() {
    return {
        running,
        tickInFlight,
        intervalMs: screenshotIntervalMs,
        hasAuthToken: !!authToken,
        lastSuccessAt,
        lastFailureAt,
        lastFailureMessage,
    };
}

module.exports = {
    start,
    stop,
    setAuthToken,
    clearAuthToken,
    setIntervalSecs,
    getHealth,
};
