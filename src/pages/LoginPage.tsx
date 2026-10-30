/**
  * LoginPage.tsx - Desktop browser-based login flow.
  *
  * Flow:
  * 1. Desktop generates a one-time UUID (deviceCode).
  * 2. User clicks "Open Login in Browser".
  * 3. Website logs in user and POSTs desktop session to backend by deviceCode.
  * 4. Desktop polls /api/auth/desktop-session/:code until session is ready.
  * 5. Desktop stores token/user and enters authenticated app state.
  */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../types';

interface LoginPageProps {
    onLogin: (user: User, token: string) => void;
}

import { API_BASE, WEB_BASE } from '../config';

const APP_LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;

interface DesktopSessionPayload extends User {
    token: string;
    idleThresholdSecs: number;
}

interface PairingInitResponse {
    secret: string;
}

const DEVICE_ID_STORAGE_KEY = 'wf_pairing_device_id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAIRING_SECRET_PATTERN = /^[a-f0-9]{64}$/;

function getOrCreateDeviceId(): string {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && UUID_PATTERN.test(existing)) return existing;

    const deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
}

async function initializePairing(code: string, deviceId: string): Promise<string> {
    const response = await fetch(`${API_BASE}/auth/desktop-session/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, deviceId }),
    });
    const payload = await response.json().catch(() => null) as PairingInitResponse | { error?: string } | null;
    if (!response.ok || !payload || !('secret' in payload) || !PAIRING_SECRET_PATTERN.test(payload.secret)) {
        const message = payload && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Unable to start secure desktop sign-in. Please try again.';
        throw new Error(message);
    }
    return payload.secret;
}

async function acknowledgePairing(code: string, secret: string, token: string): Promise<void> {
    await fetch(`${API_BASE}/auth/desktop-session/${code}/ack`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'x-pairing-secret': secret,
        },
    });
}

export default function LoginPage({ onLogin }: LoginPageProps) {
    const deviceCode = useRef<string>(crypto.randomUUID());
    const deviceId = useRef<string>(getOrCreateDeviceId());
    const pairingSecret = useRef<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sessionConsumedRef = useRef(false);

    const [waiting, setWaiting] = useState(false);
    const [expired, setExpired] = useState(false);
    const [starting, setStarting] = useState(false);
    const [pairingError, setPairingError] = useState<string | null>(null);

    const clearPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const completeLogin = useCallback(
        (data: DesktopSessionPayload, code: string, secret: string) => {
            if (sessionConsumedRef.current) return;
            sessionConsumedRef.current = true;
            clearPolling();

            localStorage.setItem('wf_token', data.token);
            const user: User = {
                id: data.id,
                name: data.name,
                email: data.email,
                companyId: data.companyId,
                companyName: data.companyName,
                companyLogoUrl: data.companyLogoUrl ?? null,
            };

            localStorage.setItem('wf_user', JSON.stringify(user));

            const threshold = data.idleThresholdSecs ?? 60;
            localStorage.setItem('wf_idle_threshold', String(threshold));

            const api = window.electronAPI as {
                setIdleThreshold?: (s: number) => void;
                setTrackerAuthToken?: (t: string) => void;
            } | undefined;
            api?.setIdleThreshold?.(threshold);
            api?.setTrackerAuthToken?.(data.token);

            void acknowledgePairing(code, secret, data.token).catch(() => {
                // Login remains valid if acknowledgement is interrupted; the server
                // expires the short-lived pairing record automatically.
            });
            onLogin(user, data.token);
        },
        [clearPolling, onLogin]
    );

    const pollDesktopSession = useCallback(
        async (code: string) => {
            if (sessionConsumedRef.current) return;
            const secret = pairingSecret.current;
            if (!secret) return;
            try {
                const res = await fetch(`${API_BASE}/auth/desktop-session/${code}`, {
                    headers: { 'x-pairing-secret': secret },
                });
                if (res.status === 404) return;
                if (res.status === 410) {
                    clearPolling();
                    pairingSecret.current = null;
                    setExpired(true);
                    setWaiting(false);
                    return;
                }
                if (!res.ok) {
                    clearPolling();
                    pairingSecret.current = null;
                    setPairingError('Secure desktop sign-in could not continue. Start a new sign-in from the desktop app.');
                    setWaiting(false);
                    return;
                }
                const data = (await res.json()) as DesktopSessionPayload;
                completeLogin(data, code, secret);
            } catch {
                // Retry on next tick.
            }
        },
        [clearPolling, completeLogin]
    );

    useEffect(() => {
        if (!waiting) return;
        setExpired(false);
        sessionConsumedRef.current = false;
        const code = deviceCode.current;
        // First check immediately, then poll every 2s
        void pollDesktopSession(code);
        pollRef.current = setInterval(() => {
            void pollDesktopSession(code);
        }, 2_000);
        return () => clearPolling();
    }, [waiting, pollDesktopSession, clearPolling]);

    // Browser deep-link callback (emptrakr://...) triggers immediate re-check.
    useEffect(() => {
        const api = window.electronAPI as {
            onAuthCallback?: (cb: (_payload: { url?: string }) => void) => void;
            removeAuthCallbackListeners?: () => void;
        } | undefined;
        if (!api?.onAuthCallback) return;
        const onAuthCallback = () => {
            if (!waiting || expired) return;
            void pollDesktopSession(deviceCode.current);
        };
        api.onAuthCallback(onAuthCallback);
        return () => api.removeAuthCallbackListeners?.();
    }, [waiting, expired, pollDesktopSession]);

    const handleOpenBrowser = async () => {
        if (starting) return;

        setStarting(true);
        clearPolling();
        setPairingError(null);
        setExpired(false);
        sessionConsumedRef.current = false;

        try {
            const code = crypto.randomUUID();
            const secret = await initializePairing(code, deviceId.current);
            deviceCode.current = code;
            pairingSecret.current = secret;

            const api = window.electronAPI as { openLogin?: (deviceCode: string) => void } | undefined;
            if (api?.openLogin) {
                api.openLogin(code);
            } else {
                window.open(
                    `${WEB_BASE}/login?desktopCode=${encodeURIComponent(code)}&returnTo=desktop`,
                    '_blank'
                );
            }
            setWaiting(true);
        } catch (error) {
            pairingSecret.current = null;
            setPairingError(error instanceof Error ? error.message : 'Unable to start desktop sign-in.');
        } finally {
            setStarting(false);
        }
    };

    const handleRetry = () => {
        clearPolling();
        deviceCode.current = crypto.randomUUID();
        pairingSecret.current = null;
        sessionConsumedRef.current = false;
        setExpired(false);
        setPairingError(null);
        setWaiting(false);
    };

    return (
        <div className="login-page">
            <div className="login-card" style={{ textAlign: 'center', maxWidth: 380, background: 'rgba(255, 255, 255, 0.65)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.8)' }}>
                <div className="login__brand">
                    <img
                        src={APP_LOGO_URL}
                        alt="EmpTrakr logo"
                        style={{
                            width: 150,
                            height: 70,
                            objectFit: 'contain',
                            display: 'block',
                            margin: '0 auto 10px',
                            borderRadius: 16,
                        }}
                    />
                    <h1 style={{ letterSpacing: '0.15em', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EmpTrakr</h1>
                    <p>Time Tracker Widget</p>
                </div>

                {pairingError && (
                    <div style={{ fontSize: 13, color: 'var(--danger)', margin: '0 0 18px' }}>
                        {pairingError}
                    </div>
                )}

                {expired ? (
                    <>
                        <div style={{ fontSize: 13, color: 'var(--danger)', margin: '0 0 18px' }}>
                            Login session expired (5 minutes). Please try again.
                        </div>
                        <button
                            id="btn-retry-login"
                            className="btn btn-primary"
                            onClick={handleRetry}
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            Try Again
                        </button>
                    </>
                ) : waiting ? (
                    <>
                        <div
                            style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                borderRadius: 12,
                                padding: '14px 16px',
                                marginBottom: 20,
                                fontSize: 13,
                                color: 'var(--accent-dark)',
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            Browser opened. Sign in on the website and this window will update automatically.
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                            Waiting for authentication...
                        </div>
                        <button
                            className="btn"
                            style={{
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-hover)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '6px 12px',
                                cursor: 'pointer',
                            }}
                            onClick={() => {
                                clearPolling();
                                setWaiting(false);
                            }}
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <>
                        <p
                            style={{
                                fontSize: 13,
                                color: 'var(--text-secondary)',
                                margin: '0 0 24px',
                                lineHeight: 1.6,
                            }}
                        >
                            Authentication happens in your browser. Click below and you will be signed in here
                            automatically.
                        </p>

                        <button
                            id="btn-open-login"
                            className="btn btn-primary"
                            onClick={handleOpenBrowser}
                            disabled={starting}
                            style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 15 }}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            {starting ? 'Preparing secure sign-in...' : 'Open Login in Browser'}
                        </button>

                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14 }}>
                            Opens <strong>{new URL(WEB_BASE).host}/login</strong> in your default browser
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
