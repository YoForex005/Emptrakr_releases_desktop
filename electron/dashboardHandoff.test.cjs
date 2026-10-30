const assert = require('node:assert/strict');
const test = require('node:test');
const { buildDashboardHandoffUrl } = require('./dashboardHandoff');

const code = 'a'.repeat(64);

test('buildDashboardHandoffUrl keeps a local development handoff on localhost', () => {
    const url = new URL(buildDashboardHandoffUrl('http://localhost:3000', code));

    assert.equal(url.origin, 'http://localhost:3000');
    assert.equal(url.pathname, '/desktop/dashboard');
    assert.equal(url.search, '');
    assert.equal(url.hash, `#handoff=${code}`);
});

test('buildDashboardHandoffUrl rejects malformed handoff codes', () => {
    assert.throws(() => buildDashboardHandoffUrl('http://localhost:3000', 'invalid'));
});
