const assert = require('node:assert/strict');
const test = require('node:test');
const { buildScreenshotUploadPayload } = require('./screenshotUploader');

const EVENT_ID = 'c4c121a5-13ee-4e24-84ce-bc4b03a31b0f';
const SHIFT_ID = 'e73326e7-bc78-49c4-a0ee-8a6110a06218';

test('screenshot upload payload contains the current shift and a unique telemetry event ID', () => {
    const capturedAt = new Date('2026-11-03T10:00:00.000Z');
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const display = { id: 1, width: 1920, height: 1080 };

    const payload = buildScreenshotUploadPayload({
        shiftId: SHIFT_ID,
        capturedAt,
        display,
        imageBuffer,
        eventId: EVENT_ID,
    });

    assert.deepEqual(payload, {
        eventId: EVENT_ID,
        shiftId: SHIFT_ID,
        capturedAt: '2026-11-03T10:00:00.000Z',
        display,
        imageBase64: imageBuffer.toString('base64'),
    });
});

test('screenshot upload payload refuses captures without a valid shift context', () => {
    const validInput = {
        capturedAt: new Date('2026-11-03T10:00:00.000Z'),
        display: { id: 1 },
        imageBuffer: Buffer.from([1]),
        eventId: EVENT_ID,
    };

    assert.equal(buildScreenshotUploadPayload({ ...validInput, shiftId: '' }), null);
    assert.equal(buildScreenshotUploadPayload({ ...validInput, shiftId: SHIFT_ID, eventId: 'not-a-uuid' }), null);
});
