const axios = require('axios');
const { randomUUID } = require('crypto');
const path = require('path');

function readRuntimeConfig() {
    try {
        return require(path.join(__dirname, '..', 'runtime-config.json'));
    } catch {
        return {};
    }
}

const runtimeConfig = readRuntimeConfig();
const API_BASE = process.env.API_BASE || (process.env.NODE_ENV === 'development'
    ? 'http://localhost:5005/api'
    : runtimeConfig.API_BASE || 'https://api.emptrakr.com/api');

async function getWorkStatus(authToken) {
    const res = await axios.get(`${API_BASE}/time/status`, {
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
        timeout: 10000,
    });
    return {
        status: res.data?.status ?? null,
        shiftId: typeof res.data?.shift?.id === 'string' ? res.data.shift.id : null,
    };
}

function buildScreenshotUploadPayload({ shiftId, capturedAt, display, imageBuffer, eventId = randomUUID() }) {
    if (typeof shiftId !== 'string' || !shiftId.trim()) return null;
    if (!(capturedAt instanceof Date) || Number.isNaN(capturedAt.getTime())) return null;
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) return null;
    if (typeof eventId !== 'string' || !/^[a-f0-9-]{36}$/i.test(eventId)) return null;

    return {
        eventId,
        shiftId,
        capturedAt: capturedAt.toISOString(),
        display,
        imageBase64: imageBuffer.toString('base64'),
    };
}

async function uploadScreenshot(authToken, payload) {
    return axios.post(`${API_BASE}/screenshots/upload`, payload, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
        },
        timeout: 30000,
    });
}

module.exports = {
    getWorkStatus,
    buildScreenshotUploadPayload,
    uploadScreenshot,
};

