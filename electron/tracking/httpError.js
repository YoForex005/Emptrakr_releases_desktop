function stringifyResponseBody(data) {
    if (data === undefined || data === null) return '';
    if (typeof data === 'string') return data.trim();
    if (Buffer.isBuffer(data)) return data.toString('utf8').trim();

    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
}

function describeHttpError(error, fallback = 'Request failed') {
    const status = error?.response?.status;
    const statusText = error?.response?.statusText;
    const method = error?.config?.method ? String(error.config.method).toUpperCase() : '';
    const url = error?.config?.url || '';
    const code = error?.code || '';
    const responseBody = stringifyResponseBody(error?.response?.data);
    const message = error?.message || '';

    const parts = [];
    if (status) parts.push(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`);
    if (code) parts.push(`code=${code}`);
    if (method || url) parts.push(`${method} ${url}`.trim());
    if (responseBody) parts.push(`response=${responseBody}`);
    if (message && !parts.some((part) => part.includes(message))) parts.push(`message=${message}`);

    return parts.length ? parts.join(' | ') : fallback;
}

module.exports = {
    describeHttpError,
};
