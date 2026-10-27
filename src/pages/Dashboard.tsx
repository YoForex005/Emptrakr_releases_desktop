import { useState, useEffect, type ReactNode } from 'react';
import { useTimer, formatDuration } from '../hooks/useTimer';
import { useAppTracker } from '../hooks/useAppTracker';
import type { User } from '../types';

const APP_LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;

// ── Sub-components ────────────────────────────────────────────────────────────

/** Displays the current shift status as a coloured badge */
function StatusBadge({ status }: { status: string }) {
    const labels: Record<string, string> = {
        stopped: 'Not Clocked In',
        working: 'Working',
        on_break: 'On Break',
    };
    return (
        <span className={`status-badge ${status}`}>
            <span className="dot" />
            {labels[status] ?? status}
        </span>
    );
}

function CompanyBrandHeader({ user }: { user: User }) {
    const brandName = user.companyName?.trim() || 'EmpTrakr';
    const logoUrl = user.companyLogoUrl?.trim() || APP_LOGO_URL;

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 14, paddingTop: 4 }}>
            <div style={{ display: 'flex', minWidth: 0, maxWidth: '100%', alignItems: 'center', gap: 12 }}>
                {logoUrl && (
                    <div
                        style={{
                            display: 'flex',
                            flexShrink: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 52,
                            height: 52,
                            overflow: 'hidden',
                            borderRadius: 18,
                            border: '1px solid rgba(226, 232, 240, 0.8)',
                            background: 'rgba(248, 250, 252, 0.88)',
                            boxShadow: '0 8px 22px rgba(15, 23, 42, 0.08)',
                        }}
                    >
                        <img
                            src={logoUrl}
                            alt={`${brandName} logo`}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <div
                        title={brandName}
                        style={{
                            maxWidth: 250,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 18,
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                            color: 'var(--text-primary)',
                        }}
                    >
                        {brandName}
                    </div>
                    <div
                        style={{
                            marginTop: 2,
                            fontSize: 10,
                            fontWeight: 800,
                            color: 'var(--accent-dark)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            lineHeight: 1,
                        }}
                    >
                        Time Tracker
                    </div>
                    <div
                        style={{
                            marginTop: 4,
                            fontSize: 8,
                            fontWeight: 700,
                            color: 'rgba(71, 85, 105, 0.58)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            lineHeight: 1,
                        }}
                    >
                        Powered by EmpTrakr
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── ClockInLocationModal ──────────────────────────────────────────────────

type TimerActionButtonProps = {
    id: string;
    title: string;
    subtitle: string;
    tone: 'success' | 'warning' | 'danger';
    icon: ReactNode;
    disabled: boolean;
    onClick: () => void;
};

/** The three prominent timer actions used in the compact tracker view. */
function TimerActionButton({ id, title, subtitle, tone, icon, disabled, onClick }: TimerActionButtonProps) {
    const tones = {
        success: { border: '#bfdbfe', background: '#f8fbff', iconBackground: '#eff6ff', iconColor: '#2563eb', color: '#0f172a' },
        warning: { border: '#fde68a', background: '#fffbeb', iconBackground: '#fef3c7', iconColor: '#b45309', color: '#92400e' },
        danger: { border: '#fecaca', background: '#fff7f7', iconBackground: '#fee2e2', iconColor: '#dc2626', color: '#b91c1c' },
    } as const;
    const style = tones[tone];

    return (
        <button
            id={id}
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                display: 'flex', minWidth: 0, minHeight: 82, flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6, border: `1px solid ${style.border}`, borderRadius: 14, background: style.background, color: style.color,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.48 : 1, padding: '10px 6px', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={event => { if (!disabled) { event.currentTarget.style.transform = 'translateY(-1px)'; event.currentTarget.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.08)'; } }}
            onMouseLeave={event => { event.currentTarget.style.transform = 'none'; event.currentTarget.style.boxShadow = 'none'; }}
        >
            <span style={{ display: 'inline-flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: style.iconBackground, color: style.iconColor }}>
                {icon}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1 }}>{title}</span>
            <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.1, color: '#94a3b8' }}>{subtitle}</span>
        </button>
    );
}

function ClockInLocationModal({
    onSelect, onCancel
}: {
    onSelect: (location: 'wfh' | 'office') => void;
    onCancel: () => void;
}) {
    return (
        <div className="modal-overlay" style={{ background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(8px)' }}>
            <div className="modal" style={{ background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 24px 64px -12px rgba(0,0,0,0.15)' }}>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '28px',
                        background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                        boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto',
                        fontSize: 26,
                    }}>
                        📍
                    </div>
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
                    Where are you working today?
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', margin: '0 0 24px', fontWeight: 500 }}>
                    Select your work location before clocking in
                </p>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <button
                        onClick={() => onSelect('wfh')}
                        style={{
                            flex: 1, padding: '16px 12px', borderRadius: 12, border: '2px solid #dbeafe',
                            background: '#eff6ff', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 8, fontWeight: 700, color: '#1d4ed8', fontSize: 13,
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#dbeafe'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#93c5fd'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#dbeafe'; }}
                    >
                        <span style={{ fontSize: 28 }}>🏠</span>
                        Work From Home
                    </button>
                    <button
                        onClick={() => onSelect('office')}
                        style={{
                            flex: 1, padding: '16px 12px', borderRadius: 12, border: '2px solid #dcfce7',
                            background: '#f0fdf4', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 8, fontWeight: 700, color: '#15803d', fontSize: 13,
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#dcfce7'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#86efac'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#dcfce7'; }}
                    >
                        <span style={{ fontSize: 28 }}>🏢</span>
                        In Office
                    </button>
                </div>

                <button className="btn btn-ghost" onClick={onCancel} style={{ width: '100%', padding: '10px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8 }}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

const BREAK_REMINDER_THRESHOLD_SECS = 60;

/** A persistent reminder shown while a continuous break exceeds one minute. */
function BreakReminderModal({ breakSecs, onResume, resuming }: {
    breakSecs: number;
    onResume: () => void;
    resuming: boolean;
}) {
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="break-reminder-title" style={{ background: 'rgba(255, 255, 255, 0.34)', backdropFilter: 'blur(10px)' }}>
            <div className="modal" style={{ width: 'min(420px, calc(100vw - 40px))', background: 'rgba(255, 255, 255, 0.97)', border: '1px solid rgba(255, 255, 255, 0.72)', boxShadow: '0 28px 70px -18px rgba(15, 23, 42, 0.30)', padding: '32px 36px 36px' }}>
                <div style={{ display: 'flex', width: 76, height: 76, alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', borderRadius: '50%', background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', boxShadow: '0 12px 26px -12px rgba(234, 88, 12, 0.36)', fontSize: 38 }} role="img" aria-label="Break reminder">
                    ☕
                </div>
                <h2 id="break-reminder-title" style={{ margin: '0 0 12px', color: '#0f172a', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center' }}>
                    You are still on break
                </h2>
                <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: 15, fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
                    Your current break has been running for
                </p>
                <div style={{ marginBottom: 30, border: '1px solid #fdba74', borderRadius: 20, background: '#fffaf5', padding: '28px 20px', textAlign: 'center' }}>
                    <div style={{ color: '#ea580c', fontSize: 48, fontWeight: 800, letterSpacing: '-0.06em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        {formatDuration(breakSecs)}
                    </div>
                    <div style={{ marginTop: 12, color: '#9a3412', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        Break duration
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onResume}
                    disabled={resuming}
                    style={{ width: '100%', border: 'none', borderRadius: 14, background: '#475569', color: '#fff', cursor: resuming ? 'not-allowed' : 'pointer', opacity: resuming ? 0.65 : 1, padding: '16px 18px', fontSize: 16, fontWeight: 800, transition: 'background 0.15s ease' }}
                >
                    {resuming ? 'Resuming…' : 'Resume'}
                </button>
            </div>
        </div>
    );
}

// ── CheckoutWarningModal ──────────────────────────────────────────────────

function CheckoutWarningModal({
    remainingSecs, expectedWorkSecs, onProceed, onCancel
}: {
    remainingSecs: number;
    expectedWorkSecs: number;
    onProceed: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="modal-overlay" style={{ background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(8px)' }}>
            <div className="modal" style={{ background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 24px 64px -12px rgba(0,0,0,0.15)' }}>
                {/* Clock icon */}
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '28px',
                        background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                        boxShadow: '0 8px 16px -4px rgba(251, 191, 36, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto',
                        fontSize: 26,
                    }}>
                        ⏱️
                    </div>
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
                    Not enough work hours
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', margin: '0 0 20px', fontWeight: 500 }}>
                    Your {formatDuration(expectedWorkSecs)} work target has not been reached yet.
                </p>

                {/* Big remaining time display */}
                <div style={{
                    background: 'rgba(248, 250, 252, 0.5)',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: 16,
                    padding: '20px 24px',
                    textAlign: 'center',
                    marginBottom: 24,
                }}>
                    <div style={{ fontSize: 40, fontWeight: 800, color: '#ef4444', letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums', textShadow: '0 4px 16px rgba(239, 68, 68, 0.2)' }}>
                        {formatDuration(remainingSecs)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                        remaining today
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none' }}>
                        Keep Working
                    </button>
                    <button className="btn btn-danger" onClick={onProceed} style={{ flex: 1, padding: '12px' }}>
                        Clock Out Anyway
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── CloseWarningModal ───────────────────────────────────────────────────────

function CloseWarningModal({
    onProceed, onCancel
}: {
    onProceed: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="modal-overlay" style={{ background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(8px)' }}>
            <div className="modal" style={{ background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 24px 64px -12px rgba(0,0,0,0.15)' }}>
                {/* Warning icon */}
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '28px',
                        background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
                        boxShadow: '0 8px 16px -4px rgba(239, 68, 68, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto',
                        color: '#ef4444',
                        // feather-alert-triangle SVG inline
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
                    Closing App Before Clocking Out may cause your time to not be tracked !
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', margin: '0 0 24px', fontWeight: 500 }}>
                    Are you sure you want to close the app? This will automatically click Clock Out and stop tracking your time.
                </p>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none' }}>
                        Keep Working
                    </button>
                    <button className="btn btn-danger" onClick={onProceed} style={{ flex: 1, padding: '12px' }}>
                        Clock Out & Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

interface DashboardProps {
    view: string;
    user: User;
    onLogout: () => void;
}

export default function Dashboard({ view, user, onLogout }: DashboardProps) {
    const {
        status, loading, actionLoading, error,
        handleStart, handleBreak, handleStop,
        todayWorked, todayBreakSecs: _todayBreakSecs, todayBreaksCount, currentBreakSecs, todayIdleSecs: _todayIdleSecs,
        expectedWorkSecs, maxBreaks,
        workLocation,
    } = useTimer();

    // Clock-in location modal
    const [showLocationModal, setShowLocationModal] = useState(false);

    const handleClockInClick = () => setShowLocationModal(true);
    const handleLocationSelect = (location: 'wfh' | 'office') => {
        setShowLocationModal(false);
        handleStart(location);
    };

    // Checkout warning modal
    const [showWarning, setShowWarning] = useState(false);
    const [remainingSecs, setRemainingSecs] = useState(0);
    const [proceedingStop, setProceedingStop] = useState(false);
    const [completedShiftSecs, setCompletedShiftSecs] = useState<number | null>(null);

    // App close warning modal
    const [showCloseWarning, setShowCloseWarning] = useState(false);

    /** Called when user clicks "Check Out" button */
    const handleCheckoutClick = () => {
        const workShortfall = Math.max(0, expectedWorkSecs - todayWorked);
        if (workShortfall > 0) {
            setRemainingSecs(workShortfall);
            setShowWarning(true);
        } else {
            void stopAndShowFinalTime();
        }
    };

    const confirmStop = async () => {
        await stopAndShowFinalTime();
    };

    const stopAndShowFinalTime = async () => {
        const finalWorkedSecs = todayWorked;
        setProceedingStop(true);
        setShowWarning(false);
        const stopped = await handleStop();
        if (stopped) setCompletedShiftSecs(finalWorkedSecs);
        setProceedingStop(false);
    };

    const displayedTimerSecs = status === 'stopped' && completedShiftSecs !== null
        ? completedShiftSecs
        : todayWorked;
    const initial = user.name.trim().charAt(0).toUpperCase() || 'U';
    const breakReminderVisible = status === 'on_break' && currentBreakSecs >= BREAK_REMINDER_THRESHOLD_SECS;

    // Close window logic
    useEffect(() => {
        const handleAppClose = (e: Event) => {
            // Only stop if they are checked in
            if (status !== 'stopped') {
                e.preventDefault();
                setShowCloseWarning(true);
            }
        };

        window.addEventListener('request-app-close', handleAppClose);
        return () => window.removeEventListener('request-app-close', handleAppClose);
    }, [status]);

    useEffect(() => {
        const api = (window as any).electronAPI;
        if (!api?.onAppCloseRequest) return;

        api.onAppCloseRequest(() => {
            if (status !== 'stopped') {
                setShowCloseWarning(true);
            } else {
                api.forceClose?.();
            }
        });

        return () => api.removeAppCloseRequestListeners?.();
    }, [status]);

    const confirmAppClose = async () => {
        setProceedingStop(true);
        setShowCloseWarning(false);
        const stopped = await handleStop();
        if (!stopped) {
            setProceedingStop(false);
            return;
        }
        // Finally close after checkout
        (window as any).electronAPI?.forceClose?.();
    };

    // Initialize background app tracking sync
    useAppTracker();

    if (loading) {
        return (
            <div className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="main">
            {/* Clock-in location modal */}
            {showLocationModal && (
                <ClockInLocationModal
                    onSelect={handleLocationSelect}
                    onCancel={() => setShowLocationModal(false)}
                />
            )}

            {breakReminderVisible && (
                <BreakReminderModal
                    breakSecs={currentBreakSecs}
                    onResume={() => { void handleBreak(); }}
                    resuming={actionLoading}
                />
            )}

            {/* Checkout warning modal */}
            {showWarning && (
                <CheckoutWarningModal
                    remainingSecs={remainingSecs}
                    expectedWorkSecs={expectedWorkSecs}
                    onProceed={confirmStop}
                    onCancel={() => setShowWarning(false)}
                />
            )}

            {/* App close warning modal */}
            {showCloseWarning && (
                <CloseWarningModal
                    onProceed={confirmAppClose}
                    onCancel={() => setShowCloseWarning(false)}
                />
            )}

            {/* ── TRACKER VIEW ─────────────────────────────────────────────── */}
            {view === 'tracker' && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#0f172a', fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>
                                Good morning, <span style={{ color: '#10b981' }}>{user.name.split(' ')[0]}</span>
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, marginTop: 2 }}>Have a productive day ahead!</div>
                        </div>
                        <div aria-label={`${user.name} profile`} style={{ display: 'flex', width: 38, height: 38, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#10b981', color: '#fff', fontSize: 16, fontWeight: 800, boxShadow: '0 6px 14px rgba(16, 185, 129, 0.22)' }}>
                            {initial}
                        </div>
                    </div>
                    <CompanyBrandHeader user={user} />

                    {/* Timer Control Card */}
                    <div className="timer-card">
                        {status === 'working' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 4px 6px rgba(16, 185, 129, 0.3))' }}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </div>
                        ) : (
                            <StatusBadge status={status} />
                        )}

                        <div className={`timer-display ${status}`} id="timer-display" style={completedShiftSecs !== null && status === 'stopped' ? { color: '#10b981' } : undefined}>
                            {formatDuration(displayedTimerSecs)}
                        </div>

                        <div className="timer-sub">
                            {status === 'stopped' && completedShiftSecs !== null && 'Shift completed. Great work today!'}
                            {status === 'stopped' && completedShiftSecs === null && 'Ready to work. Clock in when you start.'}
                            {status === 'working' && 'Shift in progress. Stay productive!'}
                            {status === 'on_break' && "Break in progress. Relax!"}
                        </div>

                        {status !== 'stopped' && workLocation === 'wfh' && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 999 }}>
                                    🏠 Work From Home
                                </span>
                            </div>
                        )}

                        {error && <div className="form-error" style={{ width: '100%', textAlign: 'center' }}>{error}</div>}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, width: '100%', marginTop: 22 }}>
                            <TimerActionButton
                                id="btn-check-in"
                                title="Clock In"
                                subtitle="Start your shift"
                                tone="success"
                                onClick={handleClockInClick}
                                disabled={status !== 'stopped' || actionLoading}
                                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
                            />
                            <TimerActionButton
                                id="btn-break"
                                title={status === 'on_break' ? 'Resume' : 'Take Break'}
                                subtitle={status === 'on_break' ? 'Continue working' : todayBreaksCount >= maxBreaks ? 'Break limit reached' : 'Start a break'}
                                tone="warning"
                                onClick={handleBreak}
                                disabled={status === 'stopped' || actionLoading || (status !== 'on_break' && todayBreaksCount >= maxBreaks)}
                                icon={status === 'on_break'
                                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>}
                            />
                            <TimerActionButton
                                id="btn-check-out"
                                title="Clock Out"
                                subtitle="End your shift"
                                tone="danger"
                                onClick={handleCheckoutClick}
                                disabled={status === 'stopped' || actionLoading || proceedingStop}
                                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>}
                            />
                        </div>
                    </div>

                    {/* View Dashboard & Logout (Beneath the timer) */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
                        <button
                            className="btn"
                            onClick={() => (window.electronAPI as any)?.openDashboard?.()}
                            style={{ flex: 1, padding: '10px', fontSize: 13, background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                        >

                            View Dashboard
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={onLogout}
                            disabled={status !== 'stopped'}
                            title={status !== 'stopped' ? 'Please clock out before logging out' : 'Logout'}
                            style={{ flex: 1, padding: '10px', fontSize: 13, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Logout
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
