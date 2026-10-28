const { URL } = require('url');

const HANDOFF_CODE_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Build the one-time, fragment-based browser handoff URL for a verified
 * desktop employee session. Keeping the grant in the fragment prevents it
 * from being sent in browser requests or server logs.
 */
function buildDashboardHandoffUrl(webBase, handoffCode) {
    if (typeof handoffCode !== 'string' || !HANDOFF_CODE_PATTERN.test(handoffCode)) {
        throw new Error('Invalid dashboard handoff code');
    }

    const url = new URL('/desktop/dashboard', webBase);
    url.hash = new URLSearchParams({ handoff: handoffCode }).toString();
    return url.toString();
}

module.exports = { buildDashboardHandoffUrl };
