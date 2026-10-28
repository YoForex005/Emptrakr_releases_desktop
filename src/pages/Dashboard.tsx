import { useState, useEffect, type ReactNode } from 'react';
import {
    createDashboardHandoff,
    getBreakCredits,
    requestBreakCredit,
    type BreakCreditEntry,
    type BreakCreditReason,
    type BreakCreditReviewedDetail,
} from '../api';
import { useTimer, formatDuration } from '../hooks/useTimer';
import { useAppTracker } from '../hooks/useAppTracker';
import type { User } from '../types';

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
        success: { border: '#d1fae5', background: '#f7fffb', iconBackground: '#dcfce7', iconColor: '#059669', color: '#065f46' },
        warning: { border: '#fde68a', background: '#fffdf5', iconBackground: '#fef3c7', iconColor: '#b45309', color: '#92400e' },
        danger: { border: '#fecaca', background: '#fff8f8', iconBackground: '#fee2e2', iconColor: '#dc2626', color: '#b91c1c' },
    } as const;
    const style = tones[tone];

    return (
        <button
            id={id}
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                display: 'flex', minWidth: 0, minHeight: 62, flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6, border: `1px solid ${style.border}`, borderRadius: 16, background: style.background, color: style.color,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.48 : 1, padding: '12px 6px', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
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
        <div className="modal-overlay break-reminder-overlay" role="dialog" aria-modal="true" aria-labelledby="break-reminder-title">
            <div className="modal break-reminder-modal">
                <div className="break-reminder-icon" role="img" aria-label="Break reminder">
                    ☕
                </div>
                <h2 id="break-reminder-title" className="break-reminder-title">
                    You are still on break
                </h2>
                <p className="break-reminder-description">
                    Your current break has been running for
                </p>
                <div className="break-reminder-duration">
                    <div className="break-reminder-duration__value">
                        {formatDuration(breakSecs)}
                    </div>
                    <div className="break-reminder-duration__label">
                        Break duration
                    </div>
                </div>
                <button
                    type="button"
                    className="break-reminder-resume"
                    onClick={onResume}
                    disabled={resuming}
                >
                    {resuming ? 'Resuming…' : 'Resume'}
                </button>
            </div>
        </div>
    );
}

// ── CheckoutWarningModal ──────────────────────────────────────────────────

const BREAK_CREDIT_REASONS: Array<{ value: BreakCreditReason; label: string }> = [
    { value: 'MEETING_DURING_BREAK', label: 'Meeting during break' },
    { value: 'CLIENT_CALL', label: 'Client call' },
    { value: 'URGENT_TASK', label: 'Urgent issue / task' },
    { value: 'MANAGER_REQUEST', label: 'Manager request' },
    { value: 'OTHER_WORK', label: 'Other work reason' },
];

function formatBreakTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Employee-only panel for claiming a completed break as working time. */
function BreakManagementModal({ onClose, onClaimSubmitted }: { onClose: () => void; onClaimSubmitted: () => void }) {
    const [breaks, setBreaks] = useState<BreakCreditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState<BreakCreditEntry | null>(null);
    const [reason, setReason] = useState<BreakCreditReason>('MEETING_DURING_BREAK');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let active = true;
        void getBreakCredits()
            .then((entries) => { if (active) setBreaks(entries); })
            .catch((requestError: unknown) => {
                if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load today\'s breaks.');
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const submit = async () => {
        if (!selected || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const updated = await requestBreakCredit(selected.id, reason);
            setBreaks((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
            setSelected(null);
            onClaimSubmitted();
        } catch (requestError: unknown) {
            setError(requestError instanceof Error ? requestError.message : 'Unable to submit this request.');
        } finally {
            setSubmitting(false);
        }
    };

    const totalBreakSecs = breaks.reduce((sum, entry) => sum + entry.durationSecs, 0);
    const requestedCount = breaks.filter((entry) => entry.creditStatus === 'PENDING').length;

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="break-management-title" style={{ background: 'rgba(15, 23, 42, 0.42)', backdropFilter: 'blur(7px)', padding: 12 }}>
            <section className="modal" style={{ width: 'min(100%, 368px)', maxHeight: 'calc(100vh - 24px)', overflow: 'hidden', borderRadius: 24, background: '#fff', padding: 18, boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)' }}>
                <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                    <div>
                        <h2 id="break-management-title" style={{ margin: 0, color: '#172033', fontSize: 17, fontWeight: 800 }}>Break Management</h2>
                        <p style={{ margin: '3px 0 0', color: '#71819e', fontSize: 11, fontWeight: 600 }}>Request work-time credit for a completed break.</p>
                    </div>
                    <button type="button" aria-label="Close break management" onClick={onClose} style={{ width: 30, height: 30, border: 'none', borderRadius: 10, background: '#f1f5f9', color: '#94a3b8', cursor: 'pointer', fontSize: 21, lineHeight: 1 }}>×</button>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ border: '1px solid #dbe4f0', borderRadius: 12, background: '#f8fafc', padding: '9px 10px' }}>
                        <div style={{ color: '#8190aa', fontSize: 10, fontWeight: 700 }}>Total break taken</div>
                        <div style={{ color: '#1e293b', fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatDuration(totalBreakSecs)}</div>
                    </div>
                    <div style={{ border: '1px solid #d1fae5', borderRadius: 12, background: '#f0fdf4', padding: '9px 10px' }}>
                        <div style={{ color: '#8190aa', fontSize: 10, fontWeight: 700 }}>Awaiting review</div>
                        <div style={{ color: '#059669', fontSize: 16, fontWeight: 800 }}>{requestedCount}</div>
                    </div>
                </div>

                {error && <div role="alert" style={{ marginBottom: 10, borderRadius: 10, background: '#fef2f2', color: '#b91c1c', padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>{error}</div>}

                {selected ? (
                    <div style={{ border: '1px solid #dbe4f0', borderRadius: 14, background: '#f8fafc', padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <strong style={{ color: '#172033', fontSize: 13 }}>Break claim</strong>
                            <button type="button" onClick={() => setSelected(null)} disabled={submitting} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Cancel</button>
                        </div>
                        <p style={{ margin: '6px 0 10px', color: '#64748b', fontSize: 11 }}>{formatBreakTime(selected.startTime)} – {formatBreakTime(selected.endTime)} · {formatDuration(selected.durationSecs)}</p>
                        <label htmlFor="break-credit-reason" style={{ display: 'block', color: '#475569', fontSize: 11, fontWeight: 700, marginBottom: 5 }}>Reason for work credit</label>
                        <select id="break-credit-reason" value={reason} onChange={(event) => setReason(event.target.value as BreakCreditReason)} disabled={submitting} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff', color: '#334155', padding: '9px', fontSize: 12, fontWeight: 600 }}>
                            {BREAK_CREDIT_REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                        <button type="button" onClick={() => { void submit(); }} disabled={submitting} style={{ width: '100%', marginTop: 10, border: 'none', borderRadius: 10, background: '#2563eb', color: '#fff', cursor: submitting ? 'wait' : 'pointer', padding: '10px 12px', fontSize: 12, fontWeight: 800, opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Submitting…' : 'Submit for admin approval'}</button>
                    </div>
                ) : (
                    <>
                        <p style={{ margin: '0 0 7px', color: '#8190aa', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em' }}>TODAY’S BREAK SESSIONS</p>
                        <div style={{ display: 'grid', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 2 }}>
                            {loading && <div style={{ color: '#64748b', fontSize: 12, padding: '16px 0', textAlign: 'center' }}>Loading breaks…</div>}
                            {!loading && breaks.length === 0 && <div style={{ color: '#64748b', fontSize: 12, padding: '16px 0', textAlign: 'center' }}>No completed manual breaks today.</div>}
                            {breaks.map((entry, index) => {
                                const canClaim = entry.creditStatus === 'NONE';
                                const statusLabel = entry.creditStatus === 'PENDING' ? 'Awaiting approval' : entry.creditStatus === 'APPROVED' ? 'Credited as work' : entry.creditStatus === 'REJECTED' ? 'Rejected' : '';
                                return <article key={entry.id} style={{ border: '1px solid #dbe4f0', borderRadius: 12, background: '#fff', padding: '9px 10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ color: '#1e293b', fontSize: 12, fontWeight: 800 }}>Break #{breaks.length - index} <span style={{ color: '#64748b', fontSize: 10, fontWeight: 700 }}>{formatDuration(entry.durationSecs)}</span></div>
                                            <div style={{ color: '#71819e', fontSize: 10, fontWeight: 600 }}>{formatBreakTime(entry.startTime)} – {formatBreakTime(entry.endTime)}</div>
                                        </div>
                                        {canClaim ? <button type="button" onClick={() => { setSelected(entry); setReason('MEETING_DURING_BREAK'); setError(''); }} style={{ border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer', padding: '7px 9px', fontSize: 10, fontWeight: 800 }}>Claim credit</button> : <span style={{ maxWidth: 94, color: entry.creditStatus === 'APPROVED' ? '#059669' : entry.creditStatus === 'REJECTED' ? '#dc2626' : '#b45309', fontSize: 10, fontWeight: 800, textAlign: 'right' }}>{statusLabel}</span>}
                                    </div>
                                </article>;
                            })}
                        </div>
                    </>
                )}
                {!selected && <button type="button" onClick={onClose} style={{ width: '100%', marginTop: 12, border: 'none', borderRadius: 10, background: '#f1f5f9', color: '#475569', cursor: 'pointer', padding: '10px 12px', fontSize: 12, fontWeight: 800 }}>Close</button>}
            </section>
        </div>
    );
}

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
    const [showBreakManagement, setShowBreakManagement] = useState(false);
    const [dashboardOpening, setDashboardOpening] = useState(false);
    const [dashboardError, setDashboardError] = useState('');
    const [dashboardNotice, setDashboardNotice] = useState('');

    useEffect(() => {
        const onBreakCreditReviewed = (event: Event) => {
            const detail = (event as CustomEvent<BreakCreditReviewedDetail>).detail;
            if (detail?.status === 'APPROVED') {
                setDashboardError('');
                setDashboardNotice('Your requested break time was approved and added to your working time.');
            } else if (detail?.status === 'REJECTED') {
                setDashboardNotice('');
                setDashboardError('Your break-time request was not approved by your company administrator.');
            }
        };
        window.addEventListener('wf:break-credit-reviewed', onBreakCreditReviewed);
        return () => window.removeEventListener('wf:break-credit-reviewed', onBreakCreditReviewed);
    }, []);

    // A review can happen while the desktop app is closed. On its next start,
    // show the same result for a completed break from the employee's current
    // day instead of leaving the older "request sent" notice on screen.
    useEffect(() => {
        let active = true;
        void getBreakCredits().then((entries) => {
            if (!active) return;
            const latestReviewed = entries
                .filter((entry) => entry.creditStatus === 'APPROVED' || entry.creditStatus === 'REJECTED')
                .sort((left, right) => new Date(right.creditReviewedAt ?? 0).getTime() - new Date(left.creditReviewedAt ?? 0).getTime())
                .at(0);
            if (latestReviewed?.creditStatus === 'APPROVED') {
                setDashboardError('');
                setDashboardNotice('Your requested break time was approved and added to your working time.');
            } else if (latestReviewed?.creditStatus === 'REJECTED') {
                setDashboardNotice('');
                setDashboardError('Your break-time request was not approved by your company administrator.');
            }
        }).catch(() => {
            // The regular dashboard remains usable if break-credit history is temporarily unavailable.
        });
        return () => { active = false; };
    }, []);

    const handleClockInClick = () => setShowLocationModal(true);
    const handleLocationSelect = (location: 'wfh' | 'office') => {
        setShowLocationModal(false);
        handleStart(location);
    };

    const handleOpenDashboard = async () => {
        if (dashboardOpening) return;
        if (!window.electronAPI?.openDashboard) {
            setDashboardError('Dashboard access is available from the desktop app only.');
            return;
        }

        setDashboardOpening(true);
        setDashboardError('');
        try {
            const handoffCode = await createDashboardHandoff();
            window.electronAPI.openDashboard(handoffCode);
        } catch (e: unknown) {
            setDashboardError(e instanceof Error ? e.message : 'Unable to open your dashboard.');
        } finally {
            setDashboardOpening(false);
        }
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

            {showBreakManagement && (
                <BreakManagementModal
                    onClose={() => setShowBreakManagement(false)}
                    onClaimSubmitted={() => setDashboardNotice('Break credit request sent to your company administrator.')}
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
                    <div className="tracker-greeting">
                        <div style={{ minWidth: 0 }}>
                            <div className="tracker-greeting__title">
                                Good morning, <span style={{ color: '#10b981' }}>{user.name.split(' ')[0]}</span>
                            </div>
                            <div className="tracker-greeting__subtitle">Have a productive day ahead!</div>
                        </div>
                        <div aria-label={`${user.name} profile`} className="tracker-profile">
                            {initial}
                        </div>
                    </div>
                    {/* Timer Control Card */}
                    <div className="timer-card">
                        <div className="tracker-timer-status">
                            <span className="tracker-timer-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="9"></circle>
                                    <polyline points="12 7 12 12 15.5 14"></polyline>
                                </svg>
                            </span>
                            <StatusBadge status={status} />
                        </div>

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

                        {status !== 'stopped' && workLocation === 'office' && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '5px 10px', borderRadius: 999 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></svg>
                                    Office Location
                                </span>
                            </div>
                        )}

                        {(error || dashboardError) && <div className="form-error" style={{ width: '100%', textAlign: 'center' }}>{error || dashboardError}</div>}
                        {dashboardNotice && <div className="form-success" style={{ width: '100%', textAlign: 'center' }}>{dashboardNotice}</div>}

                        <div className="tracker-actions">
                            <TimerActionButton
                                id="btn-check-in"
                                title={status === 'stopped' ? 'Clock In' : 'Manage Breaks'}
                                subtitle={status === 'stopped' ? 'Start your shift' : 'View & claim'}
                                tone="success"
                                onClick={status === 'stopped' ? handleClockInClick : () => { setDashboardError(''); setDashboardNotice(''); setShowBreakManagement(true); }}
                                disabled={actionLoading}
                                icon={status === 'stopped'
                                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" /><circle cx="7" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="10" cy="19" r="1" /></svg>}
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
                    {/* Secondary navigation actions */}
                    <div className="tracker-secondary-actions">
                        <button
                            onClick={() => { void handleOpenDashboard(); }}
                            disabled={dashboardOpening}
                            style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 9, border: '1px solid #d1fae5', borderRadius: 20, background: '#ffffff', color: '#1f2937', cursor: 'pointer', padding: '12px', textAlign: 'left', boxShadow: '0 3px 10px rgba(15, 23, 42, 0.04)' }}
                        >
                            <span style={{ display: 'inline-flex', width: 38, height: 38, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 13, background: '#ecfdf5', color: '#10b981' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                            </span>
                            <span style={{ minWidth: 0, flex: 1 }}>
                                <span style={{ display: 'block', fontSize: 11, fontWeight: 800, lineHeight: 1.1 }}>View Dashboard</span>
                                <span style={{ display: 'block', marginTop: 3, color: '#94a3b8', fontSize: 9, fontWeight: 600, lineHeight: 1 }}>Summary &amp; stats</span>
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                        </button>
                        <button
                            onClick={onLogout}
                            disabled={status !== 'stopped'}
                            title={status !== 'stopped' ? 'Please clock out before logging out' : 'Logout'}
                            style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 9, border: '1px solid #edf0f4', borderRadius: 20, background: '#fafbfc', color: '#94a3b8', cursor: status === 'stopped' ? 'pointer' : 'not-allowed', opacity: status === 'stopped' ? 1 : 0.72, padding: '12px', textAlign: 'left' }}
                        >
                            <span style={{ display: 'inline-flex', width: 38, height: 38, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 13, background: '#f1f5f9', color: '#94a3b8' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-6" /></svg>
                            </span>
                            <span style={{ minWidth: 0, flex: 1 }}>
                                <span style={{ display: 'block', fontSize: 11, fontWeight: 800, lineHeight: 1.1 }}>Logout</span>
                                <span style={{ display: 'block', marginTop: 3, fontSize: 9, fontWeight: 600, lineHeight: 1 }}>{status === 'stopped' ? 'End this session' : 'Clock out first'}</span>
                            </span>
                            {status !== 'stopped' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
