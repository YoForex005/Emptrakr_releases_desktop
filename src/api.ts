import { API_BASE } from './config';
import type { User } from './types';

export type CompanyBrandChangedDetail = {
    companyName: string;
    companyLogoUrl: string | null;
};

export type AttendanceSettingsChangedDetail = {
    maxBreaks?: number;
    expectedWorkSecs?: number;
    expectedActiveSecs?: number;
    screenshotIntervalSecs?: number;
    wfhScreenshotIntervalSecs?: number;
    wfhCaptureIntervalMs?: number;
    wfhScreenIdleThresholdSecs?: number;
    wfhThumbWidth?: number;
    wfhThumbHeight?: number;
};

/**
 * Thrown whenever the backend returns 401 Unauthorized.
 * App.tsx listens for the custom 'wf:session-expired' event to
 * clear state and redirect to the login screen automatically.
 */
export class SessionExpiredError extends Error {
    constructor() {
        super('Session expired — please log in again.');
        this.name = 'SessionExpiredError';
    }
}

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

function expireSavedSession(): never {
    localStorage.removeItem('wf_token');
    localStorage.removeItem('wf_user');
    localStorage.removeItem('wf_idle_threshold');
    window.dispatchEvent(new Event('wf:session-expired'));
    throw new SessionExpiredError();
}

/**
 * Central response handler for all authenticated API calls.
 * - 401 → clears localStorage, fires 'wf:session-expired', throws SessionExpiredError
 * - Other errors → throws with the server's error message
 */
async function handleResponse(res: Response) {
    const text = await res.text();
    let data: any = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { error: text };
        }
    }
    if (res.status === 401) {
        expireSavedSession();
    }
    if (res.status === 404 && typeof data.error === 'string' && /user not found/i.test(data.error)) {
        expireSavedSession();
    }
    if (!res.ok) {
        const fallback = res.status === 409
            ? 'Shift state changed. Syncing latest status.'
            : `Request failed with HTTP ${res.status}`;
        throw new ApiError(res.status, data.error || data.message || fallback);
    }
    return data;
}

function getToken(): string | null {
    return localStorage.getItem('wf_token');
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
    };
}


export async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    // NOTE: idleThresholdSecs is now returned by the backend (set by admin per user).
    // We persist it to localStorage so useAppTracker.ts can read it on every poll.
    if (data.user?.idleThresholdSecs !== undefined) {
        localStorage.setItem('wf_idle_threshold', String(data.user.idleThresholdSecs));
    }

    return data as { token: string; user: User & { idleThresholdSecs: number } };
}

export async function getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    const data = await handleResponse(res) as { user: User & { idleThresholdSecs?: number } };

    if (data.user?.idleThresholdSecs !== undefined) {
        localStorage.setItem('wf_idle_threshold', String(data.user.idleThresholdSecs));
    }

    return data.user;
}

export type ShiftTimer = {
    elapsedSecs: number;
    workSecs: number;
    breakSecs: number;
    idleSecs: number;
    activeSecs: number;
};

export type TimeStatusResponse = {
    status: 'stopped' | 'working' | 'on_break';
    shift: unknown;
    serverNow?: string;
    timer?: ShiftTimer;
    trackingLease?: { onlineUntil?: string | null };
    idleThresholdSecs: number;
    expectedWorkSecs: number;
    expectedActiveSecs: number;
    maxBreaks: number;
    screenshotIntervalSecs: number;
    wfhCaptureIntervalMs?: number;
    wfhScreenIdleThresholdSecs?: number;
    wfhThumbWidth?: number;
    wfhThumbHeight?: number;
};

export async function getStatus(): Promise<TimeStatusResponse> {
    const res = await fetch(`${API_BASE}/time/status`, { headers: authHeaders() });
    const data = await handleResponse(res);
    return data as TimeStatusResponse;
}

/** Create a short-lived grant that opens this desktop user's browser dashboard. */
export async function createDashboardHandoff(): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/dashboard-handoff`, {
        method: 'POST',
        headers: authHeaders(),
    });
    const data = await handleResponse(res) as { code?: unknown };
    if (typeof data.code !== 'string' || !/^[a-f0-9]{64}$/.test(data.code)) {
        throw new Error('Unable to prepare your dashboard. Please try again.');
    }
    return data.code;
}

export async function startShift(workLocation: 'wfh' | 'office', commandId = crypto.randomUUID()) {
    const res = await fetch(`${API_BASE}/time/start`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId, work_location: workLocation }),
    });
    return handleResponse(res);
}

export async function toggleBreak() {
    const res = await fetch(`${API_BASE}/time/break`, { method: 'POST', headers: authHeaders() });
    return handleResponse(res);
}

export type BreakSource = 'manual' | 'screen_lock' | 'sleep';

export async function startBreak(shiftId: string, source: BreakSource = 'manual', commandId = crypto.randomUUID()) {
    const res = await fetch(`${API_BASE}/time/break/start`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ commandId, shiftId, source }),
    });
    return handleResponse(res) as Promise<{
        message: string;
        status: 'on_break';
        break: { id: string; startTime: string; endTime: string | null; source?: BreakSource };
    }>;
}

export async function endBreak(
    shiftId: string,
    options: { source?: BreakSource; breakId?: string } = {},
    commandId = crypto.randomUUID(),
) {
    const res = await fetch(`${API_BASE}/time/break/end`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ commandId, shiftId, ...options }),
    });
    return handleResponse(res) as Promise<{
        message: string;
        status: 'working';
        alreadyEnded?: boolean;
        break?: { id: string; startTime: string; endTime: string | null; source?: BreakSource };
    }>;
}

export async function stopShift(shiftId: string, reason?: string, endTime?: string, commandId = crypto.randomUUID()) {
    const res = await fetch(`${API_BASE}/time/stop`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ commandId, shiftId, reason, endTime }),
    });
    return handleResponse(res);
}

export async function rolloverShift(shiftId: string, commandId = crypto.randomUUID()) {
    const res = await fetch(`${API_BASE}/time/rollover`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ commandId, shiftId }),
    });
    return handleResponse(res) as Promise<{
        message: string;
        rolledOver: boolean;
        status?: 'working' | 'on_break' | 'stopped';
        previousShift?: unknown;
        shift: unknown;
    }>;
}

export async function sendHeartbeat(shiftId: string, commandId = crypto.randomUUID()) {
    const res = await fetch(`${API_BASE}/time/heartbeat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ commandId, shiftId }),
    });
    return handleResponse(res);
}

export async function getHistory() {
    const res = await fetch(`${API_BASE}/time/history`, { headers: authHeaders() });
    const data = await handleResponse(res);
    return data.shifts as Array<{
        id: string;
        startTime: string;
        endTime: string | null;
        checkoutType?: 'manual' | 'auto_shutdown';
        checkoutReason?: string | null;
        graceAppliedSecs?: number;
        timeAdjustmentSecs?: number;
        breaks: Array<{ id: string; startTime: string; endTime: string | null }>;
    }>;
}


// ─────────────────────────────────────────────────────────────────────────────
// Idle Session API
// The desktop calls these when it detects inactivity / activity resumption.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify the server that the user has gone idle.
 * @param startTime - The exact ISO timestamp when idleness began
 *                    (i.e., when the configured idle threshold was reached).
 * @param shiftId - The active shift that owns the idle interval.
 */
export async function startIdleSession(startTime: string, shiftId: string) {
    const res = await fetch(`${API_BASE}/time/idle/start`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ commandId: crypto.randomUUID(), shiftId, startTime }),
    });
    return handleResponse(res);
}

export async function endIdleSession(shiftId: string) {
    const res = await fetch(`${API_BASE}/time/idle/end`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ commandId: crypto.randomUUID(), shiftId }),
    });
    return handleResponse(res);
}

export async function getTodayIdleSecs(): Promise<number> {
    const res = await fetch(`${API_BASE}/time/idle/today`, { headers: authHeaders() });
    const data = await handleResponse(res);
    return (data as { totalIdleSecs: number }).totalIdleSecs;
}


/**
 * Open a Server-Sent Events connection to receive real-time threshold changes.
 *
 * The backend pushes an `idle-threshold-changed` event every time an admin
 * saves a new idleThresholdSecs for this user — arrives in milliseconds.
 *
 * EventSource does NOT support custom Authorization headers, so we pass the
 * token as a query param. The backend auth middleware already accepts this.
 * EventSource auto-reconnects on network drops.
 *
 * @param onThresholdChange  Called with the new threshold (seconds) on change
 * @returns                  Cleanup function — call on component unmount
 */
export function subscribeToThresholdEvents(
    onThresholdChange: (secs: number) => void,
    onAttendanceSettingsChange?: (settings: AttendanceSettingsChangedDetail) => void,
): () => void {
    const token = getToken();
    if (!token) return () => { }; // not logged in

    const url = `${API_BASE}/time/events?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.addEventListener('idle-threshold-changed', (e: MessageEvent) => {
        try {
            const { idleThresholdSecs } = JSON.parse(e.data) as { idleThresholdSecs: number };
            if (typeof idleThresholdSecs === 'number') {
                onThresholdChange(idleThresholdSecs);
            }
        } catch { /* malformed event — ignore */ }
    });

    source.addEventListener('company-brand-changed', (e: MessageEvent) => {
        try {
            const payload = JSON.parse(e.data) as Partial<CompanyBrandChangedDetail>;
            if (typeof payload.companyName !== 'string') return;

            window.dispatchEvent(new CustomEvent<CompanyBrandChangedDetail>('wf:company-brand-changed', {
                detail: {
                    companyName: payload.companyName,
                    companyLogoUrl: typeof payload.companyLogoUrl === 'string' ? payload.companyLogoUrl : null,
                },
            }));
        } catch { /* malformed event - ignore */ }
    });

    source.addEventListener('attendance-settings-changed', (e: MessageEvent) => {
        try {
            const parsed: unknown = JSON.parse(e.data);
            if (!parsed || typeof parsed !== 'object') return;
            onAttendanceSettingsChange?.(parsed as AttendanceSettingsChangedDetail);
        } catch { /* malformed event - ignore */ }
    });

    source.onerror = () => {
        // EventSource will auto-reconnect; no action needed
    };

    return () => source.close();
}
