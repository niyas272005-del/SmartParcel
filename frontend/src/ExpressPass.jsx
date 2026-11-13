import React, { useEffect, useMemo, useState } from 'react';
import {
  Package, Clock, Truck, CheckCircle2, CalendarDays, Search, Boxes, ClipboardList,
  Sparkles, Trash2, Download, User, Check, AlertCircle, QrCode, ArrowRight, X, Bell,
  FileText, Hash, LogOut, KeyRound, Mail, Lock, Users, Eye, EyeOff, UserCheck,
  UserX, MessageSquare, Send, Plus, RefreshCw, Ticket, ChevronRight, Building2,
  Camera, UserPlus, Upload, ScanBarcode, ShieldCheck, Star, SlidersHorizontal,
  PlaneTakeoff, Smartphone, BellRing, ShieldAlert, AlertTriangle,
  BarChart3, Timer, TrendingUp, Zap, Flame, Activity, RotateCcw
} from 'lucide-react';
import {
  isSafeDropInstruction,
  getActivePassOtp,
  compressImageFileToDataUrl
} from './CameraTools';

export function DeliveryRatingBox({
  parcel,
  isRes,
  ratingDrafts,
  setRatingDrafts,
  ratingBusy,
  handleRateDelivery,
  RATING_TAGS = [],
  hideSubmitButton = false
}) {
  if (!parcel || parcel.status !== 'HANDED_OVER') return null;

  if (parcel.deliveryRating) {
    const tagItems = (parcel.ratingTags || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    return (
      <div className="ep-ratedSummaryBox">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12.5, color: '#92400e' }}>
            <Star size={14} fill="#f59e0b" color="#d97706" />
            <span>Rated {parcel.deliveryRating}.0 / 5</span>
          </span>
          <span style={{ fontSize: 11, color: '#78716c' }}>
            {parcel.ratedAt ? parcel.ratedAt.replace('T', ' ').slice(0, 16) : 'Submitted'}
          </span>
        </div>
        {tagItems.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {tagItems.map(tag => (
              <span key={tag} className="ep-trustTagPill">{tag}</span>
            ))}
          </div>
        )}
        {parcel.ratingComment && (
          <div style={{ fontSize: 12, color: '#5d5876' }}>&ldquo;{parcel.ratingComment}&rdquo;</div>
        )}
      </div>
    );
  }

  if (!isRes) return null;

  const draft = ratingDrafts?.[parcel.id] || { rating: 5, tags: [], comment: '' };
  const updateDraft = patch => {
    setRatingDrafts?.(prev => ({
      ...prev,
      [parcel.id]: { ...draft, ...patch }
    }));
  };

  const toggleTag = tag => {
    const has = draft.tags.includes(tag);
    updateDraft({
      tags: has ? draft.tags.filter(t => t !== tag) : [...draft.tags, tag]
    });
  };

  return (
    <div className="ep-ratingCard">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <b style={{ fontSize: 12.5, color: '#92400e' }}>Rate This Delivery</b>
        <span style={{ fontSize: 11, color: '#b45309' }}>Builds Agent Trust Score</span>
      </div>

      <div className="ep-ratingStarsRow">
        {[1, 2, 3, 4, 5].map(num => (
          <button
            key={num}
            type="button"
            className={`ep-starBtn ${draft.rating >= num ? 'filled' : ''}`}
            onClick={() => updateDraft({ rating: num })}
            title={`Rate ${num} star${num > 1 ? 's' : ''}`}
          >
            <Star size={16} fill={draft.rating >= num ? '#f59e0b' : 'none'} />
          </button>
        ))}
        <span style={{ marginLeft: 4, fontSize: 12, fontWeight: 700, color: '#92400e' }}>
          {draft.rating} / 5
        </span>
      </div>

      {RATING_TAGS.length > 0 && (
        <div className="instructionChips">
          {RATING_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              className={`ep-tagChip ${draft.tags.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        className="safeDropNoteInput"
        placeholder="Optional compliment or feedback..."
        value={draft.comment || ''}
        onChange={e => updateDraft({ comment: e.target.value })}
      />

      {!hideSubmitButton && (
        <button
          type="button"
          className="ep-btnPrimary"
          style={{ justifyContent: 'center' }}
          disabled={ratingBusy}
          onClick={() => handleRateDelivery?.(parcel, draft.rating, draft.tags, draft.comment)}
        >
          <Star size={14} />
          <span>{ratingBusy ? 'Submitting...' : `Submit ${draft.rating}★ Rating`}</span>
        </button>
      )}
    </div>
  );
}

export function IssueDisputeBox({
  parcel,
  isRes,
  isStaffAudit,
  withinWindow,
  openIssueModal,
  handleResolveIssue,
  issueBusy
}) {
  const [resolutionNote, setResolutionNote] = useState('');

  if (!parcel || parcel.status !== 'HANDED_OVER') return null;

  if (parcel.issueReported) {
    const resolved = parcel.issueStatus === 'RESOLVED';
    return (
      <div className={`ep-issueCard ${resolved ? 'resolved' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12.5, color: resolved ? '#047857' : '#b91c1c' }}>
            <ShieldAlert size={15} />
            <span>{parcel.issueCategory || 'Delivery Issue'}</span>
          </span>
          <span className={`ep-issueBadge ${resolved ? 'resolved' : ''}`}>
            {parcel.issueStatus || 'OPEN'}
          </span>
        </div>

        <div style={{ fontSize: 12.5, color: '#17132a', lineHeight: 1.45 }}>
          {parcel.issueNotes}
        </div>

        {parcel.issuePhotoUrl && (
          <img src={parcel.issuePhotoUrl} alt="Reported issue evidence" className="proofPhotoFullImg" />
        )}

        {parcel.issueResolutionNote && (
          <div style={{ fontSize: 12, color: resolved ? '#047857' : '#92400e', background: '#ffffff', padding: '7px 9px', borderRadius: 8, border: '1px solid #e6e3f3' }}>
            <b>Audit Resolution:</b> {parcel.issueResolutionNote}
          </div>
        )}

        {isStaffAudit && !resolved && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 2 }}>
            <input
              type="text"
              className="safeDropNoteInput"
              placeholder="Audit resolution note (e.g. Redelivered sealed unit)"
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {parcel.issueStatus !== 'INVESTIGATING' && (
                <button
                  type="button"
                  className="ep-btnGhost"
                  style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                  disabled={issueBusy}
                  onClick={() => handleResolveIssue?.(parcel, 'INVESTIGATING', resolutionNote)}
                >
                  Mark Investigating
                </button>
              )}
              <button
                type="button"
                className="ep-btnMint"
                style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                disabled={issueBusy}
                onClick={() => {
                  handleResolveIssue?.(parcel, 'RESOLVED', resolutionNote);
                  setResolutionNote('');
                }}
              >
                <CheckCircle2 size={13} />
                <span>Resolve Dispute</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isRes && withinWindow) {
    return (
      <button
        type="button"
        className="ep-reportIssueBtn"
        onClick={() => openIssueModal?.(parcel)}
      >
        <AlertTriangle size={14} />
        <span>Report Issue (7-day window)</span>
      </button>
    );
  }

  return null;
}

export function ExpressAuth({
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  showPassword,
  setShowPassword,
  busy,
  notice,
  handleAuthSubmit,
  handleQuickLogin,
  propertyTitle
}) {
  return (
    <div className="ep-shell ep-authPage">
      <div className="ep-authCard">
        <div className="ep-authBrand">
          <div className="ep-authBadge">
            <Ticket size={21} color="#ffffff" />
          </div>
          <h2>SmartParcel Express</h2>
          <p>{propertyTitle} · Direct Doorstep Pass &amp; Chat</p>
        </div>

        <div className="authTabGroup">
          <button
            type="button"
            className={`authTab ${authMode === 'login' ? 'active' : ''}`}
            onClick={() => setAuthMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`authTab ${authMode === 'register' ? 'active' : ''}`}
            onClick={() => setAuthMode('register')}
          >
            Create Account
          </button>
        </div>

        {notice.text && (
          <div className={`toastBanner ${notice.type}`} style={{ margin: '0 0 12px 0', borderRadius: '10px' }}>
            {notice.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{notice.text}</span>
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="authForm">
          {authMode === 'register' && (
            <div className="fieldGrid">
              <div className="fieldGroup">
                <label className="fieldLabel">Full Name</label>
                <div className="inputIconWrapper">
                  <User size={15} color="#908ba6" />
                  <input
                    type="text"
                    required
                    placeholder="Enter full name"
                    value={authForm.name}
                    onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="fieldGroup">
                <label className="fieldLabel">Account Role</label>
                <select
                  value={authForm.role}
                  onChange={e => setAuthForm({ ...authForm, role: e.target.value })}
                >
                  <option value="ROLE_RESIDENT">Apartment Resident</option>
                  <option value="ROLE_DELIVERY_AGENT">Delivery Agent / Courier Partner</option>
                  <option value="ROLE_ADMIN">Society Administrator</option>
                </select>
              </div>
            </div>
          )}

          <div className="fieldGroup">
            <label className="fieldLabel">Email Address</label>
            <div className="inputIconWrapper">
              <Mail size={15} color="#908ba6" />
              <input
                type="email"
                required
                placeholder="Enter your email address"
                value={authForm.email}
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>
          </div>

          <div className="fieldGroup">
            <label className="fieldLabel">Password</label>
            <div className="inputIconWrapper">
              <Lock size={15} color="#908ba6" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter your password"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
              />
              <button
                type="button"
                className="eyeBtn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {authMode === 'register' && authForm.role === 'ROLE_RESIDENT' && (
            <div className="fieldGrid">
              <div className="fieldGroup">
                <label className="fieldLabel">Flat / Door #</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A-101"
                  value={authForm.flatNumber}
                  onChange={e => setAuthForm({ ...authForm, flatNumber: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="fieldGroup">
                <label className="fieldLabel">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={authForm.phone}
                  onChange={e => setAuthForm({ ...authForm, phone: e.target.value })}
                />
              </div>
            </div>
          )}

          <button type="submit" className="ep-btnPrimary fullWidth" disabled={busy}>
            {busy ? <RefreshCw size={15} className="spin" /> : <ArrowRight size={15} />}
            <span>{authMode === 'login' ? 'Continue to Express Pass' : 'Create Pass Account'}</span>
          </button>
        </form>

        {authMode === 'login' && (
          <div className="quickLoginSection">
            <div className="dividerText"><span>OR 1-CLICK DEMO ACCESS</span></div>
            <div className="quickLoginButtons">
              <button
                type="button"
                className="quickBtn resident"
                onClick={() => handleQuickLogin('aarav@smartparcel.com', 'resident123')}
              >
                <User size={13} />
                <span>Resident A-101</span>
              </button>
              <button
                type="button"
                className="quickBtn neighbor"
                onClick={() => handleQuickLogin('rajesh@smartparcel.com', 'resident123')}
              >
                <UserPlus size={13} />
                <span>Neighbor A-102</span>
              </button>
              <button
                type="button"
                className="quickBtn agent"
                onClick={() => handleQuickLogin('agent@smartparcel.com', 'agent123')}
              >
                <Truck size={13} />
                <span>Delivery Agent</span>
              </button>
              <button
                type="button"
                className="quickBtn admin"
                onClick={() => handleQuickLogin('admin@smartparcel.com', 'admin123')}
              >
                <Users size={13} />
                <span>Administrator</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SLA_TARGET_MINUTES = 240;
const SLA_WARNING_MINUTES = 180;
const EXPRESS_FAST_MINUTES = 15;

export function formatDurationMinutes(totalMins) {
  const safe = Math.max(0, Math.round(totalMins || 0));
  if (safe < 60) return `${safe}m`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function computeLiveParcelSla(parcel, backendItem, nowMs) {
  if (!parcel) return null;
  const receivedMs = parcel.receivedAt ? new Date(parcel.receivedAt).getTime() : NaN;
  const deliveredMs = parcel.handedOverAt ? new Date(parcel.handedOverAt).getTime() : NaN;
  const isEscalated = Boolean(parcel.slaEscalated || backendItem?.isEscalated);

  if (parcel.status === 'HANDED_OVER') {
    const mins = !Number.isNaN(receivedMs) && !Number.isNaN(deliveredMs)
      ? Math.max(0, Math.round((deliveredMs - receivedMs) / 60000))
      : (backendItem?.durationMinutes ?? 0);
    const durLabel = formatDurationMinutes(mins);
    if (mins < EXPRESS_FAST_MINUTES) {
      return {
        tier: 'EXPRESS_15M',
        tone: 'fresh',
        elapsedMinutes: mins,
        remainingMinutes: Math.max(0, SLA_TARGET_MINUTES - mins),
        label: `Delivered in ${durLabel} · < 15m`,
        isUnder15m: true,
        isSlaRisk: false,
        isOverdue: false,
        isEscalated
      };
    }
    if (mins <= SLA_TARGET_MINUTES) {
      return {
        tier: 'ON_TIME',
        tone: 'ontrack',
        elapsedMinutes: mins,
        remainingMinutes: Math.max(0, SLA_TARGET_MINUTES - mins),
        label: `Delivered in ${durLabel}`,
        isUnder15m: false,
        isSlaRisk: false,
        isOverdue: false,
        isEscalated
      };
    }
    return {
      tier: 'DELAYED',
      tone: 'delayed',
      elapsedMinutes: mins,
      remainingMinutes: 0,
      label: `Delayed ${durLabel}`,
      isUnder15m: false,
      isSlaRisk: false,
      isOverdue: false,
      isEscalated
    };
  }

  if (parcel.status === 'RESCHEDULED') {
    return {
      tier: 'DEFERRED_HOLD',
      tone: 'delayed',
      elapsedMinutes: 0,
      remainingMinutes: SLA_TARGET_MINUTES,
      label: 'Deferred Hold',
      isUnder15m: false,
      isSlaRisk: false,
      isOverdue: false,
      isEscalated
    };
  }

  const elapsed = !Number.isNaN(receivedMs)
    ? Math.max(0, Math.round((nowMs - receivedMs) / 60000))
    : (backendItem?.elapsedMinutes ?? 0);
  const remaining = Math.max(0, SLA_TARGET_MINUTES - elapsed);

  if (elapsed >= SLA_TARGET_MINUTES) {
    return {
      tier: 'OVERDUE',
      tone: 'overdue',
      elapsedMinutes: elapsed,
      remainingMinutes: 0,
      label: `Pending > 4h (${formatDurationMinutes(elapsed)})`,
      isUnder15m: false,
      isSlaRisk: false,
      isOverdue: true,
      isEscalated
    };
  }
  if (elapsed >= SLA_WARNING_MINUTES) {
    return {
      tier: 'SLA_RISK',
      tone: 'risk',
      elapsedMinutes: elapsed,
      remainingMinutes: remaining,
      label: `SLA Risk · ${formatDurationMinutes(remaining)} left`,
      isUnder15m: false,
      isSlaRisk: true,
      isOverdue: false,
      isEscalated
    };
  }
  if (elapsed < EXPRESS_FAST_MINUTES) {
    return {
      tier: 'EXPRESS_FRESH',
      tone: 'fresh',
      elapsedMinutes: elapsed,
      remainingMinutes: remaining,
      label: `< 15m Fresh · ${formatDurationMinutes(remaining)} left`,
      isUnder15m: true,
      isSlaRisk: false,
      isOverdue: false,
      isEscalated
    };
  }
  return {
    tier: 'ON_TRACK',
    tone: 'ontrack',
    elapsedMinutes: elapsed,
    remainingMinutes: remaining,
    label: `Elapsed ${formatDurationMinutes(elapsed)} · ${formatDurationMinutes(remaining)} left`,
    isUnder15m: false,
    isSlaRisk: false,
    isOverdue: false,
    isEscalated
  };
}

export function CourierDonutChart({ breakdown = [], total = 0, getCourierColor }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;

  const slices = breakdown
    .filter(row => row.count > 0)
    .map(row => {
      const fraction = total > 0 ? row.count / total : 0;
      const strokeDasharray = `${(fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
      const strokeDashoffset = `${(-cumulativeFraction * circumference).toFixed(2)}`;
      cumulativeFraction += fraction;
      return {
        ...row,
        color: getCourierColor(row.courier),
        strokeDasharray,
        strokeDashoffset
      };
    });

  return (
    <div className="ep-donutWrap">
      <div className="ep-donutSvgBox">
        <svg viewBox="0 0 120 120" width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#f1effa"
            strokeWidth="18"
          />
          {slices.map(slice => (
            <circle
              key={slice.courier}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="18"
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
            />
          ))}
        </svg>
        <div className="ep-donutCenter">
          <b>{total}</b>
          <span>Parcels</span>
        </div>
      </div>

      <div className="ep-legendList">
        {slices.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#6b6684' }}>No courier volume recorded yet.</div>
        ) : (
          slices.map(slice => (
            <div key={slice.courier} className="ep-legendRow">
              <span className="ep-legendLeft">
                <span className="ep-legendSwatch" style={{ backgroundColor: slice.color }} />
                <span>{slice.courier}</span>
              </span>
              <span style={{ fontWeight: 700, color: '#5d5876' }}>
                {slice.count} <small style={{ fontWeight: 600 }}>({slice.percent}%)</small>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ExpressAnalyticsDashboard({
  opsStats,
  parcels = [],
  slaBusy,
  handleEscalateAllOverdue,
  handleEscalateSla,
  onOpenParcel,
  getCourierColor,
  getParcelSla
}) {
  const slaSummary = opsStats?.slaSummary || {};
  const courierBreakdown = opsStats?.courierBreakdown || [];
  const slotBreakdown = opsStats?.slotBreakdown || [];
  const dailyTrends = opsStats?.dailyTrends || [];
  const hourlyArrivals = opsStats?.hourlyArrivals || [];
  const rescheduleReasons = opsStats?.rescheduleReasons || [];
  const leaderboard = opsStats?.agentSpeedLeaderboard || [];

  const maxDailyCount = Math.max(
    1,
    ...dailyTrends.map(d => Math.max(d.dispatched || 0, d.delivered || 0, d.rescheduled || 0))
  );
  const maxHourlyCount = Math.max(1, ...hourlyArrivals.map(h => h.count || 0));

  const alertParcels = useMemo(() => {
    return parcels
      .filter(p => p.status !== 'HANDED_OVER' && p.status !== 'RESCHEDULED')
      .map(p => ({ parcel: p, sla: getParcelSla(p) }))
      .filter(row => row.sla && (row.sla.isOverdue || row.sla.isSlaRisk))
      .sort((a, b) => (b.sla?.elapsedMinutes || 0) - (a.sla?.elapsedMinutes || 0));
  }, [parcels, getParcelSla]);

  return (
    <section className="ep-insightsStack">
      <div className="ep-insightsHero">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#ddd6fe', marginBottom: 4 }}>
            <Activity size={13} />
            <span>Admin &amp; Operations Intelligence</span>
          </div>
          <h2>Express Analytics &amp; 4h SLA Command Center</h2>
          <p>
            Live handover speed (&lt; 15m express benchmark), pending &gt; 4h SLA risk monitor, courier volume share, and 7-day parcel trends.
          </p>
        </div>

        {(slaSummary.overdueCount || 0) > 0 ? (
          <button
            type="button"
            className="ep-btnDangerSm"
            disabled={slaBusy}
            onClick={handleEscalateAllOverdue}
            style={{ padding: '10px 16px', fontSize: 13 }}
          >
            <Flame size={15} />
            <span>{slaBusy ? 'Escalating...' : `Escalate ${slaSummary.overdueCount} Overdue (>4h)`}</span>
          </button>
        ) : (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(110, 231, 183, 0.45)', padding: '8px 14px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, color: '#ecfdf5' }}>
            <CheckCircle2 size={15} />
            <span>All Active Drops Within 4h SLA</span>
          </div>
        )}
      </div>

      {/* 4 KPI SUMMARY CARDS */}
      <div className="ep-kpiGrid">
        <div className="ep-kpiTile">
          <div className="ep-kpiLabel">
            <span>Avg Handover Time</span>
            <Zap size={14} color="#059669" />
          </div>
          <div className="ep-kpiValue">
            {opsStats?.avgHandoverMinutes != null ? `${opsStats.avgHandoverMinutes}m` : '—'}
          </div>
          <div className="ep-kpiSub">
            {opsStats?.under15MinCount || 0} fast drops &lt; 15m ({opsStats?.under15MinRatePercent || 0}%)
          </div>
        </div>

        <div className="ep-kpiTile">
          <div className="ep-kpiLabel">
            <span>SLA Risk &amp; Overdue (&gt;4h)</span>
            <Flame size={14} color={(slaSummary.overdueCount || 0) > 0 ? '#dc2626' : '#f59e0b'} />
          </div>
          <div className="ep-kpiValue" style={{ color: (slaSummary.overdueCount || 0) > 0 ? '#dc2626' : '#1e1b4b' }}>
            {slaSummary.overdueCount || 0} Overdue
          </div>
          <div className="ep-kpiSub">
            {slaSummary.atRiskCount || 0} at risk (3–4h) · {slaSummary.under15mActive || 0} fresh &lt; 15m
          </div>
        </div>

        <div className="ep-kpiTile">
          <div className="ep-kpiLabel">
            <span>Reschedule Frequency</span>
            <RefreshCw size={14} color="#5b21b6" />
          </div>
          <div className="ep-kpiValue">{opsStats?.rescheduleRatePercent || 0}%</div>
          <div className="ep-kpiSub">
            {opsStats?.rescheduledFrequencyCount || 0} holds out of {opsStats?.total || 0} parcels
          </div>
        </div>

        <div className="ep-kpiTile">
          <div className="ep-kpiLabel">
            <span>Peak Delivery Slot</span>
            <Clock size={14} color="#5b21b6" />
          </div>
          <div className="ep-kpiValue" style={{ fontSize: 17 }}>
            {opsStats?.peakSlot || 'No slots yet'}
          </div>
          <div className="ep-kpiSub">
            Peak arrival window: {opsStats?.peakArrivalHour || '—'}
          </div>
        </div>
      </div>

      {/* ROW 1: COURIER SHARE DONUT + PEAK DELIVERY TIME SLOTS */}
      <div className="ep-insightsGrid">
        <div className="ep-chartCard">
          <div className="ep-chartCardHead">
            <div>
              <h3>Courier Volume Share</h3>
              <small>Distribution across all logged parcels</small>
            </div>
            <BarChart3 size={17} color="#5b21b6" />
          </div>
          <CourierDonutChart
            breakdown={courierBreakdown}
            total={opsStats?.total || 0}
            getCourierColor={getCourierColor}
          />
        </div>

        <div className="ep-chartCard">
          <div className="ep-chartCardHead">
            <div>
              <h3>Peak Delivery Time Slots</h3>
              <small>Resident preferred window demand</small>
            </div>
            <CalendarDays size={17} color="#5b21b6" />
          </div>
          <div className="ep-hbarList">
            {slotBreakdown.map(slotRow => {
              const isPeak = slotRow.slot === opsStats?.peakSlot && slotRow.count > 0;
              return (
                <div key={slotRow.slot} className="ep-hbarRow">
                  <div className="ep-hbarTop">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span>{slotRow.slot}</span>
                      {isPeak && (
                        <span className="ep-slaBadge fresh" style={{ fontSize: 10, padding: '1px 7px' }}>
                          Peak
                        </span>
                      )}
                    </span>
                    <span>
                      {slotRow.count} ({slotRow.percent}%)
                    </span>
                  </div>
                  <div className="ep-hbarTrack">
                    <div
                      className={`ep-hbarFill ${isPeak ? 'peak' : ''}`}
                      style={{ width: `${Math.max(slotRow.count > 0 ? 6 : 0, slotRow.percent || 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROW 2: 7-DAY TIME TRENDS + HOURLY ARRIVALS & RESCHEDULE REASONS */}
      <div className="ep-insightsGrid">
        <div className="ep-chartCard">
          <div className="ep-chartCardHead">
            <div>
              <h3>7-Day Dispatch &amp; Handover Trend</h3>
              <small>Daily intake vs completed OTP handovers vs holds</small>
            </div>
            <TrendingUp size={17} color="#059669" />
          </div>

          <div className="ep-trendCols">
            {dailyTrends.map(day => (
              <div key={day.date} className="ep-trendDayCol" title={`${day.label}: ${day.dispatched} dispatched, ${day.delivered} delivered, ${day.rescheduled} held`}>
                <div className="ep-trendBars">
                  <div
                    className="ep-trendBar dispatched"
                    style={{ height: `${Math.max(4, Math.round((day.dispatched / maxDailyCount) * 98))}px` }}
                  />
                  <div
                    className="ep-trendBar delivered"
                    style={{ height: `${Math.max(4, Math.round((day.delivered / maxDailyCount) * 98))}px` }}
                  />
                  <div
                    className="ep-trendBar rescheduled"
                    style={{ height: `${Math.max(4, Math.round((day.rescheduled / maxDailyCount) * 98))}px` }}
                  />
                </div>
                <span className="ep-trendLabel">{day.label}</span>
              </div>
            ))}
          </div>

          <div className="ep-trendLegend">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span className="ep-legendSwatch" style={{ background: '#6d28d9' }} /> Dispatched
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span className="ep-legendSwatch" style={{ background: '#10b981' }} /> Delivered
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span className="ep-legendSwatch" style={{ background: '#f59e0b' }} /> Rescheduled Hold
            </span>
          </div>
        </div>

        <div className="ep-chartCard">
          <div className="ep-chartCardHead">
            <div>
              <h3>Hourly Arrival Windows &amp; Reschedule Causes</h3>
              <small>Gate check-in density + reasons residents hold deliveries</small>
            </div>
            <Timer size={17} color="#5b21b6" />
          </div>

          <div className="ep-hourCols">
            {hourlyArrivals.map(bucketRow => {
              const isPeakHour = bucketRow.bucket === opsStats?.peakArrivalHour && bucketRow.count > 0;
              return (
                <div key={bucketRow.bucket} className="ep-trendDayCol">
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: isPeakHour ? '#5b21b6' : '#6b6684' }}>
                    {bucketRow.count}
                  </span>
                  <div
                    className={`ep-hourBar ${isPeakHour ? 'peak' : ''}`}
                    style={{ height: `${Math.max(6, Math.round((bucketRow.count / maxHourlyCount) * 74))}px` }}
                  />
                  <span className="ep-trendLabel">{bucketRow.bucket}</span>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid #f0edf8', paddingTop: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#6b6684', textTransform: 'uppercase', marginBottom: 6 }}>
              Top Reschedule &amp; Vacation Reasons
            </div>
            {rescheduleReasons.length === 0 ? (
              <div style={{ fontSize: 12, color: '#6b6684' }}>No parcels have been rescheduled yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {rescheduleReasons.slice(0, 3).map(r => (
                  <div key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span style={{ color: '#312e53', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.reason}
                    </span>
                    <span className="ep-tabCount">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LIVE SLA OVERDUE & RISK WATCHLIST */}
      {alertParcels.length > 0 && (
        <div className="ep-chartCard" style={{ borderColor: '#fca5a5' }}>
          <div className="ep-chartCardHead">
            <div>
              <h3 style={{ color: '#991b1b' }}>Active SLA Overdue &amp; Risk Watchlist</h3>
              <small>Parcels waiting &ge; 3h since arrival (excludes intentional Vacation/tomorrow holds)</small>
            </div>
            <AlertTriangle size={17} color="#dc2626" />
          </div>
          <div className="tableWrapper">
            <table className="userTable">
              <thead>
                <tr>
                  <th>Tracking / Courier</th>
                  <th>Flat</th>
                  <th>SLA Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alertParcels.map(({ parcel, sla }) => (
                  <tr key={parcel.id}>
                    <td>
                      <b>{parcel.courier}</b> · <span className="ep-awbTag">{parcel.trackingNumber}</span>
                    </td>
                    <td><b>Flat {parcel.flatNumber}</b></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`ep-slaBadge ${sla.tone}`}>{sla.label}</span>
                        {sla.isEscalated && (
                          <span className="ep-slaBadge escalated">Escalated</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="ep-btnDangerSm"
                          disabled={slaBusy || sla.isEscalated}
                          onClick={() => handleEscalateSla(parcel)}
                        >
                          {sla.isEscalated ? 'Alert Sent' : 'Escalate SLA'}
                        </button>
                        <button
                          type="button"
                          className="ep-btnGhost"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          onClick={() => onOpenParcel(parcel)}
                        >
                          Open Drawer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AGENT HANDOVER SPEED LEADERBOARD */}
      <div className="ep-chartCard">
        <div className="ep-chartCardHead">
          <div>
            <h3>Agent Handover Speed &amp; SLA Leaderboard</h3>
            <small>Average arrival-to-handover duration, &lt; 15m express drops, and active SLA risks</small>
          </div>
          <Truck size={17} color="#5b21b6" />
        </div>
        <div className="tableWrapper">
          <table className="userTable">
            <thead>
              <tr>
                <th>Delivery Partner</th>
                <th>Completed</th>
                <th>Avg Handover Time</th>
                <th>&lt; 15m Express Drops</th>
                <th>Open SLA Risks</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: '#6b6684', textAlign: 'center' }}>
                    No delivery agents registered yet.
                  </td>
                </tr>
              ) : (
                leaderboard.map(row => (
                  <tr key={row.agentId}>
                    <td><b>{row.agentName}</b></td>
                    <td>{row.completedCount}</td>
                    <td>
                      {row.avgHandoverMinutes != null ? (
                        <span className={`ep-slaBadge ${row.avgHandoverMinutes <= 15 ? 'fresh' : 'ontrack'}`}>
                          {row.avgHandoverMinutes}m
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{row.under15MinCount}</td>
                    <td>
                      <span className={`ep-slaBadge ${row.openSlaRisks > 0 ? 'overdue' : 'fresh'}`}>
                        {row.openSlaRisks > 0 ? `${row.openSlaRisks} risk` : '0 risks'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function ExpressWorkspace({
  user,
  propertyTitle,
  parcels,
  selectedParcelId,
  setSelectedParcelId,
  search,
  setSearch,
  registeredUsers,
  busy,
  notice,
  setNotice,
  unreadCount,
  notifDrawerOpen,
  setNotifDrawerOpen,
  drawerOpen,
  setDrawerOpen,
  loadData,
  handleLogout,
  handleSeedDemoData,
  handleExportCsv,
  handleToggleUserActive,
  handleDeleteUser,
  handleDeleteParcel,
  handleBookSlot,
  handleSetInstruction,
  openRescheduleModal,
  handleRequestOtp,
  handleVerifyHandover,
  otpInputs,
  setOtpInputs,
  proofPhotos,
  setProofPhotos,
  proofNotes,
  setProofNotes,
  openScannerModal,
  openPhotoModal,
  openDelegateModal,
  handleRevokeDelegate,
  msgSummaries,
  chatMessages,
  chatInput,
  setChatInput,
  chatBusy,
  handleSendChatMessage,
  intakeForm,
  setIntakeForm,
  handleGenerateTracking,
  handleRegisterParcel,
  setSelectedPass,
  setSelectedReceipt,
  routeQueue,
  agentTrust,
  opsStats,
  slaBusy,
  handleEscalateSla,
  handleEscalateAllOverdue,
  openReturnModal,
  openBundleModal,
  handleBundleHandover,
  handleConfirmReturnPickup,
  bundleBusy,
  returnBusy,
  scheduleConfirmNotes,
  setScheduleConfirmNotes,
  scheduleConfirmBusy,
  handleConfirmSchedule,
  flatHintPref,
  openPreferencesModal,
  openIssueModal,
  handleResolveIssue,
  issueBusy,
  handleRateDelivery,
  ratingDrafts,
  setRatingDrafts,
  ratingBusy,
  RATING_TAGS,
  isWithinIssueWindow,
  installPromptEvent,
  isPwaInstalled,
  handleInstallApp,
  notifPermission,
  browserAlertsEnabled,
  handleToggleBrowserAlerts,
  COURIERS,
  CATEGORIES,
  TIME_SLOTS,
  DELIVERY_INSTRUCTIONS,
  AGENT_QUICK_REPLIES,
  RESIDENT_QUICK_REPLIES,
  formatDeliveryDate
}) {
  const [epTab, setEpTab] = useState('active'); // 'active' | 'delivered' | 'dispatch' | 'users' | 'insights'
  const [activeSubFilter, setActiveSubFilter] = useState('ALL'); // 'ALL' | 'RECEIVED' | 'SLOT_BOOKED' | 'RESCHEDULED' | 'SLA_RISK'
  const [deliveredFilter, setDeliveredFilter] = useState('ALL'); // 'ALL' | 'UNRATED' | 'DISPUTES'
  const [drawerTab, setDrawerTab] = useState('actions'); // 'actions' | 'chat'
  const [routeSortEnabled, setRouteSortEnabled] = useState(true);
  const [towerFilter, setTowerFilter] = useState('ALL');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const isRes = user.role === 'ROLE_RESIDENT';
  const isAgent = user.role === 'ROLE_DELIVERY_AGENT';
  const isAdmin = user.role === 'ROLE_ADMIN';
  const userFlatUpper = (user.flatNumber || '').trim().toUpperCase();

  function isDelegateReceiverFor(parcel) {
    return Boolean(
      isRes &&
      parcel?.delegated &&
      parcel?.delegateFlat &&
      userFlatUpper &&
      parcel.delegateFlat.trim().toUpperCase() === userFlatUpper &&
      parcel.flatNumber?.trim().toUpperCase() !== userFlatUpper
    );
  }

  const activeParcels = useMemo(() => parcels.filter(p => p.status !== 'HANDED_OVER'), [parcels]);
  const deliveredParcels = useMemo(() => parcels.filter(p => p.status === 'HANDED_OVER'), [parcels]);
  const openIssuesCount = useMemo(
    () => deliveredParcels.filter(p => p.issueReported && p.issueStatus !== 'RESOLVED').length,
    [deliveredParcels]
  );

  function getParcelSla(parcel) {
    if (!parcel) return null;
    const backendItem = opsStats?.slaSummary?.itemsByParcelId?.[String(parcel.id)];
    return computeLiveParcelSla(parcel, backendItem, nowMs);
  }

  const slaCounts = useMemo(() => {
    if (isRes) return { alerts: 0, overdue: 0, risk: 0 };
    let overdue = 0;
    let risk = 0;
    for (const p of activeParcels) {
      const s = computeLiveParcelSla(p, opsStats?.slaSummary?.itemsByParcelId?.[String(p.id)], nowMs);
      if (s?.isOverdue) overdue += 1;
      else if (s?.isSlaRisk) risk += 1;
    }
    return { alerts: overdue + risk, overdue, risk };
  }, [activeParcels, isRes, opsStats, nowMs]);

  const eligibleToBundle = useMemo(() => {
    if (!isRes) return [];
    return activeParcels.filter(p => !p.returnPickup && p.status !== 'RESCHEDULED' && !p.bundled);
  }, [isRes, activeParcels]);

  const doorstepArrivalParcel = useMemo(() => {
    if (!isRes) return null;
    return activeParcels.find(p => {
      const isAccepted = p.status === 'SLOT_BOOKED' || (Boolean(p.slot) && p.status !== 'RECEIVED');
      if (!isAccepted) return false;
      const q = routeQueue?.dropsByParcelId?.[p.id];
      return q && q.isDoorstepNow;
    });
  }, [isRes, activeParcels, routeQueue]);

  const nearbyArrivalParcel = useMemo(() => {
    if (!isRes || doorstepArrivalParcel) return null;
    return activeParcels.find(p => {
      const isAccepted = p.status === 'SLOT_BOOKED' || (Boolean(p.slot) && p.status !== 'RECEIVED');
      if (!isAccepted) return false;
      const q = routeQueue?.dropsByParcelId?.[p.id];
      return q && q.isNearby && q.dropsAhead > 0;
    });
  }, [isRes, activeParcels, routeQueue, doorstepArrivalParcel]);

  const myTrust = useMemo(() => {
    if (!agentTrust) return null;
    if (isAgent && user?.id && agentTrust.byAgentId?.[String(user.id)]) {
      return agentTrust.byAgentId[String(user.id)];
    }
    return agentTrust.overall || null;
  }, [agentTrust, isAgent, user?.id]);

  const towerBatches = routeQueue?.towerBatches || [];
  const effectiveTowerFilter =
    towerFilter === 'ALL' || towerBatches.some(tb => tb.tower === towerFilter)
      ? towerFilter
      : 'ALL';

  const displayedList = useMemo(() => {
    const base = epTab === 'delivered' ? deliveredParcels : activeParcels;
    const filtered = base.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || [
        p.trackingNumber,
        p.courier,
        p.flatNumber,
        p.delegateFlat,
        p.recipientName,
        p.description,
        p.category,
        p.issueCategory
      ].filter(Boolean).join(' ').toLowerCase().includes(q);
      const matchStatus =
        epTab === 'delivered' ||
        activeSubFilter === 'ALL' ||
        (activeSubFilter === 'SLA_RISK'
          ? (() => {
              const s = getParcelSla(p);
              return Boolean(s && (s.isOverdue || s.isSlaRisk));
            })()
          : p.status === activeSubFilter);
      const matchDeliveredFilter =
        epTab !== 'delivered' ||
        deliveredFilter === 'ALL' ||
        (deliveredFilter === 'UNRATED' && !p.deliveryRating) ||
        (deliveredFilter === 'DISPUTES' && Boolean(p.issueReported));
      const dropTower = routeQueue?.dropsByParcelId?.[p.id]?.tower;
      const matchTower =
        !isAgent ||
        epTab !== 'active' ||
        effectiveTowerFilter === 'ALL' ||
        dropTower === effectiveTowerFilter;
      return matchSearch && matchStatus && matchDeliveredFilter && matchTower;
    });

    if (isAgent && epTab === 'active' && !routeSortEnabled) {
      return [...filtered].sort((a, b) => new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0));
    }
    return filtered;
  }, [
    epTab,
    activeParcels,
    deliveredParcels,
    search,
    activeSubFilter,
    deliveredFilter,
    isAgent,
    effectiveTowerFilter,
    routeSortEnabled,
    routeQueue,
    opsStats,
    nowMs
  ]);

  // Spotlight parcel: follow top route stop for agent route mode, or active OTP / incoming parcel for residents
  const spotlightParcel = useMemo(() => {
    if (isAgent && routeSortEnabled && routeQueue?.orderedParcelIds?.length > 0) {
      const nextStopParcel = activeParcels.find(p => p.id === routeQueue.orderedParcelIds[0]);
      if (nextStopParcel) return nextStopParcel;
    }
    return (
      activeParcels.find(p => p.demoOtp) ||
      activeParcels.find(p => p.status === 'RECEIVED') ||
      activeParcels[0] ||
      null
    );
  }, [activeParcels, isAgent, routeSortEnabled, routeQueue]);

  const drawerParcel = useMemo(() => {
    if (!drawerOpen) return null;
    return parcels.find(p => p.id === selectedParcelId) || null;
  }, [drawerOpen, parcels, selectedParcelId]);

  function openParcelDrawer(parcel, tab = 'actions') {
    setSelectedParcelId(parcel.id);
    setDrawerTab(tab);
    setDrawerOpen(true);
  }

  function getCourierColor(courierName) {
    return COURIERS.find(c => c.name.toLowerCase() === (courierName || '').toLowerCase())?.color || '#5b21b6';
  }

  function statusLabel(st, parcel = null) {
    if (parcel?.returnPickup) {
      if (st === 'HANDED_OVER' || parcel.returnStatus === 'PICKED_UP') return 'Return Picked Up';
      return 'Return Scheduled';
    }
    if (st === 'RECEIVED') return 'Arriving';
    if (st === 'SLOT_BOOKED') return 'Window Booked';
    if (st === 'RESCHEDULED') return 'Rescheduled Hold';
    return 'Delivered';
  }

  return (
    <div className="ep-shell">
      {/* CLEAN STICKY HEADER WITH FOCUSED SEGMENTED TABS */}
      <header className="ep-header">
        <div className="ep-headerInner">
          <div className="ep-brand">
            <div className="ep-brandIcon">
              <Ticket size={19} color="#ffffff" />
            </div>
            <div>
              <b>SmartParcel</b>
              <small>{propertyTitle}</small>
            </div>
          </div>

          <nav className="ep-navTabs">
            <button
              type="button"
              className={`ep-navTab ${epTab === 'active' ? 'active' : ''}`}
              onClick={() => setEpTab('active')}
            >
              <span>Active</span>
              <span className="ep-tabCount">{activeParcels.length}</span>
            </button>
            <button
              type="button"
              className={`ep-navTab ${epTab === 'delivered' ? 'active' : ''}`}
              onClick={() => setEpTab('delivered')}
            >
              <span>Delivered</span>
              <span className="ep-tabCount">{deliveredParcels.length}</span>
              {(isAgent || isAdmin) && openIssuesCount > 0 && (
                <span className="ep-tabCount" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                  {openIssuesCount} dispute
                </span>
              )}
            </button>
            {isAgent && (
              <button
                type="button"
                className={`ep-navTab ${epTab === 'dispatch' ? 'active' : ''}`}
                onClick={() => setEpTab('dispatch')}
              >
                <Plus size={14} />
                <span>New Dispatch</span>
              </button>
            )}
            {isAdmin && (
              <>
                <button
                  type="button"
                  className={`ep-navTab ${epTab === 'insights' ? 'active' : ''}`}
                  onClick={() => setEpTab('insights')}
                >
                  <BarChart3 size={14} />
                  <span>Insights</span>
                  {slaCounts.alerts > 0 && (
                    <span className="ep-tabCount" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                      {slaCounts.alerts} SLA
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`ep-navTab ${epTab === 'users' ? 'active' : ''}`}
                  onClick={() => setEpTab('users')}
                >
                  <Users size={14} />
                  <span>Directory ({registeredUsers.length})</span>
                </button>
              </>
            )}
          </nav>

          <div className="ep-headerRight">
            {isRes && (
              <button
                type="button"
                className={`ep-headerPillBtn ${user.vacationMode ? 'vacation' : ''}`}
                onClick={openPreferencesModal}
                title="Default doorstep rules & Vacation Mode"
              >
                {user.vacationMode ? <PlaneTakeoff size={13} /> : <SlidersHorizontal size={13} />}
                <span className="ep-hideMobile">{user.vacationMode ? 'Vacation On' : 'Doorstep Rules'}</span>
              </button>
            )}
            <button
              type="button"
              className={`ep-headerPillBtn ${notifPermission === 'granted' && browserAlertsEnabled ? 'active' : ''}`}
              onClick={handleToggleBrowserAlerts}
              title="Enable background browser push notifications for arrivals & OTPs"
            >
              <BellRing size={13} />
              <span className="ep-hideMobile">
                {notifPermission === 'granted' && browserAlertsEnabled ? 'Alerts On' : 'Enable Alerts'}
              </span>
            </button>
            {isRes && (
              <button
                type="button"
                className="ep-headerPillBtn"
                onClick={() => openReturnModal()}
                title="Schedule a Customer Return Pickup"
              >
                <RotateCcw size={13} />
                <span className="ep-hideMobile">Schedule Return</span>
              </button>
            )}
            {!isPwaInstalled && (
              <button
                type="button"
                className={`ep-headerPillBtn ${installPromptEvent ? 'active' : ''}`}
                onClick={handleInstallApp}
                title="Install SmartParcel Express PWA on home screen"
              >
                <Smartphone size={13} />
                <span className="ep-hideMobile">Install App</span>
              </button>
            )}
            <button
              type="button"
              className="ep-bellBtn"
              onClick={loadData}
              disabled={busy}
              title="Refresh deliveries"
            >
              <RefreshCw size={15} className={busy ? 'spin' : ''} />
            </button>
            <button
              type="button"
              className="ep-bellBtn"
              onClick={() => setNotifDrawerOpen(!notifDrawerOpen)}
              title="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && <span className="notifBadge">{unreadCount}</span>}
            </button>
            <div className="ep-userChip">
              <div className="ep-userAvatar">{user.name.charAt(0)}</div>
              <span>{isRes ? `Flat ${user.flatNumber}` : user.name.split(' ')[0]}</span>
            </div>
            <button type="button" className="ep-iconLogout" onClick={handleLogout} title="Sign Out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* TOAST BANNER */}
      {notice.text && (
        <div className={`toastBanner ${notice.type}`}>
          {notice.type === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>{notice.text}</span>
          <button type="button" className="toastClose" onClick={() => setNotice({ text: '', type: 'info' })}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="ep-container">
        {/* RESIDENT DEFAULT PREFERENCES & VACATION STATUS STRIP */}
        {isRes && (user.vacationMode || user.defaultInstruction || user.defaultSlot || user.quietHoursEnabled) && epTab === 'active' && (
          <section className={`ep-statusStrip ${user.vacationMode ? 'vacation' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              {user.vacationMode ? <PlaneTakeoff size={16} /> : <SlidersHorizontal size={15} color="#5b21b6" />}
              <span>
                {user.vacationMode ? (
                  <>
                    <b>Vacation Mode Active</b>
                    {user.vacationFrom || user.vacationUntil
                      ? ` (${formatDeliveryDate(user.vacationFrom)} → ${formatDeliveryDate(user.vacationUntil)})`
                      : ''}
                    {' · Incoming deliveries auto-hold'}
                  </>
                ) : (
                  <>
                    <b>Saved Rule:</b> {user.defaultInstruction || 'Standard Handover'}
                    {user.quietHoursEnabled ? ` · Quiet Hours ${user.quietHoursStart || '20:00'}–${user.quietHoursEnd || '07:00'}` : ''}
                    {user.defaultSlot ? ` · Default Window ${user.defaultSlot}` : ''}
                  </>
                )}
              </span>
            </div>
            <button type="button" className="ep-btnGhost" style={{ padding: '5px 11px', fontSize: 12 }} onClick={openPreferencesModal}>
              Configure Rules
            </button>
          </section>
        )}

        {/* DELIVERY AGENT TRUST SCORE STRIP */}
        {isAgent && myTrust && (epTab === 'active' || epTab === 'delivered') && (
          <section className="ep-statusStrip trust">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span className="ep-trustScoreBadge">
                <Star size={12} fill="#f59e0b" color="#d97706" />
                <span>
                  {myTrust.averageRating != null
                    ? `${myTrust.averageRating} Trust Score (${myTrust.ratingCount})`
                    : `${myTrust.trustBadge || 'Verified Partner'}`}
                </span>
              </span>
              <span style={{ fontSize: 12.5, color: '#5d5876', fontWeight: 600 }}>
                {myTrust.completedDeliveries} completed deliver{myTrust.completedDeliveries === 1 ? 'y' : 'ies'}
              </span>
              {(myTrust.topTags || []).slice(0, 3).map(t => (
                <span key={t.tag} className="ep-trustTagPill">{t.tag} ({t.count})</span>
              ))}
            </div>
            {openIssuesCount > 0 && (
              <button
                type="button"
                className="ep-issueBadge"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setEpTab('delivered');
                  setDeliveredFilter('DISPUTES');
                }}
              >
                <ShieldAlert size={12} />
                <span>{openIssuesCount} Open Dispute{openIssuesCount > 1 ? 's' : ''} — Review</span>
              </button>
            )}
          </section>
        )}

        {/* AGENT & ADMIN SLA OVERDUE (> 4H) / RISK ESCALATION ALERT STRIP */}
        {(isAgent || isAdmin) && slaCounts.alerts > 0 && epTab === 'active' && (
          <section className="ep-statusStrip sla">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <Flame size={16} color="#dc2626" />
              <span>
                <b>{slaCounts.overdue > 0 ? `${slaCounts.overdue} Pending > 4h SLA` : `${slaCounts.risk} Approaching 4h SLA`}</b>
                {slaCounts.overdue > 0 && slaCounts.risk > 0 ? ` · ${slaCounts.risk} approaching limit (3–4h)` : ''}
                {' · Action needed to keep express < 15m standard.'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ep-btnGhost"
                style={{ padding: '6px 11px', fontSize: 12, borderColor: '#fca5a5', color: '#b91c1c' }}
                onClick={() => setActiveSubFilter(activeSubFilter === 'SLA_RISK' ? 'ALL' : 'SLA_RISK')}
              >
                <Timer size={13} />
                <span>{activeSubFilter === 'SLA_RISK' ? 'Show All Active' : `Filter SLA (${slaCounts.alerts})`}</span>
              </button>
              {slaCounts.overdue > 0 && (
                <button
                  type="button"
                  className="ep-btnDangerSm"
                  disabled={slaBusy}
                  onClick={handleEscalateAllOverdue}
                >
                  <AlertTriangle size={13} />
                  <span>{slaBusy ? 'Escalating...' : 'Escalate Overdue (>4h)'}</span>
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  className="ep-btnGhost"
                  style={{ padding: '6px 11px', fontSize: 12 }}
                  onClick={() => setEpTab('insights')}
                >
                  <BarChart3 size={13} />
                  <span>Open Insights</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* ADMIN OPEN DISPUTES AUDIT STRIP */}
        {isAdmin && openIssuesCount > 0 && epTab === 'active' && (
          <section className="ep-statusStrip" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} />
              <span><b>{openIssuesCount} Post-Delivery Issue{openIssuesCount > 1 ? 's' : ''}</b> flagged by residents awaiting audit review.</span>
            </div>
            <button
              type="button"
              className="ep-btnPrimary"
              style={{ background: '#dc2626', padding: '6px 12px', fontSize: 12 }}
              onClick={() => {
                setEpTab('delivered');
                setDeliveredFilter('DISPUTES');
              }}
            >
              Inspect Disputes
            </button>
          </section>
        )}

        {/* RESIDENT LIVE FLOOR-BY-FLOOR DOORSTEP & ETA ALERT STRIPS */}
        {isRes && epTab === 'active' && doorstepArrivalParcel && (() => {
          const q = routeQueue?.dropsByParcelId?.[doorstepArrivalParcel.id];
          return (
            <section className="ep-doorstepAlertStrip">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Zap size={20} color="#059669" />
                <div>
                  <b style={{ display: 'block', fontSize: 13.5 }}>🚪 Doorstep Arrival in ~1–2 Mins!</b>
                  <span style={{ fontSize: 12 }}>
                    Delivery Agent is arriving at Flat <b>{user.flatNumber}</b> for {doorstepArrivalParcel.courier} ({doorstepArrivalParcel.trackingNumber}). Please have your Digital Pass QR or 6-digit OTP open!
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="ep-btnMint"
                style={{ padding: '8px 14px', fontSize: 12.5, whiteSpace: 'nowrap' }}
                onClick={() => setSelectedPass(doorstepArrivalParcel)}
              >
                <QrCode size={14} />
                <span>Open Digital Pass</span>
              </button>
            </section>
          );
        })()}

        {isRes && epTab === 'active' && nearbyArrivalParcel && (() => {
          const q = routeQueue?.dropsByParcelId?.[nearbyArrivalParcel.id];
          return (
            <section className="ep-etaStrip">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Timer size={18} color="#2563eb" />
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>🏃 Agent is {q.dropsAhead} {q.dropsAhead === 1 ? 'drop' : 'drops'} away · {q.etaLabel}</b>
                  <span style={{ fontSize: 12 }}>
                    Currently on Floor {q.currentServingFloor || q.floor} (serving earlier flats). Get ready with your pass!
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="ep-btnGhost"
                style={{ padding: '6px 12px', fontSize: 12, borderColor: '#bfdbfe', color: '#1d4ed8' }}
                onClick={() => setSelectedPass(nearbyArrivalParcel)}
              >
                <KeyRound size={13} />
                <span>View Pass</span>
              </button>
            </section>
          );
        })()}

        {/* RESIDENT MULTI-PARCEL BUNDLING BANNER */}
        {isRes && epTab === 'active' && eligibleToBundle.length >= 2 && (
          <section className="ep-bundleBanner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Boxes size={20} color="#5b21b6" />
              <div>
                <b style={{ display: 'block', fontSize: 13.5, color: '#4c1d95' }}>
                  📦 Multi-Parcel Bundle Available ({eligibleToBundle.length} Incoming Parcels)
                </b>
                <span style={{ fontSize: 12, color: '#5d5876' }}>
                  You have deliveries from {eligibleToBundle.map(p => p.courier).join(', ')}. Group into 1 delivery window with a single Master Pass!
                </span>
              </div>
            </div>
            <button
              type="button"
              className="ep-btnPrimary"
              style={{ padding: '8px 14px', fontSize: 12.5, whiteSpace: 'nowrap' }}
              disabled={bundleBusy}
              onClick={() => openBundleModal(eligibleToBundle)}
            >
              <Boxes size={14} />
              <span>Bundle {eligibleToBundle.length} Parcels</span>
            </button>
          </section>
        )}

        {/* TAB 1 & 2: ACTIVE / DELIVERED PARCELS */}
        {(epTab === 'active' || epTab === 'delivered') && (
          <>
            {/* APPLE WALLET / ZEPTO SPOTLIGHT TICKET (ACTIVE TAB ONLY) */}
            {epTab === 'active' && spotlightParcel && (() => {
              const spotOtp = getActivePassOtp(spotlightParcel, user);
              const spotIsDelegateReceiver = isDelegateReceiverFor(spotlightParcel);
              const spotQueue = routeQueue?.dropsByParcelId?.[spotlightParcel.id];
              const isSpotAccepted = spotlightParcel.status === 'SLOT_BOOKED' || (Boolean(spotlightParcel.slot) && spotlightParcel.status !== 'RECEIVED');
              const showSpotQueue = Boolean(
                spotQueue &&
                spotlightParcel.status !== 'HANDED_OVER' &&
                spotlightParcel.status !== 'RESCHEDULED' &&
                (!isRes || isSpotAccepted)
              );
              return (
                <section className="ep-spotlightPass">
                  <div className="ep-spotLeft">
                    <div className="ep-spotEyebrow">
                      <Sparkles size={12} />
                      <span>
                        {isAgent && routeSortEnabled && showSpotQueue
                          ? `STOP #${spotQueue.stopNumber} OF ${spotQueue.totalStops} · TOWER ${spotQueue.tower} · FL ${spotQueue.floor}${spotlightParcel.delegated ? ` · Delegated → ${spotlightParcel.delegateFlat}` : ''}`
                          : spotIsDelegateReceiver
                          ? `Neighbor Delegate Pass · For Flat ${spotlightParcel.flatNumber}`
                          : spotlightParcel.delegated
                          ? `Delegated to ${spotlightParcel.delegateName} (Flat ${spotlightParcel.delegateFlat})`
                          : spotOtp
                          ? 'Handover OTP Ready'
                          : spotlightParcel.status === 'RESCHEDULED'
                          ? 'Rescheduled Next-Day Hold'
                          : 'Next Expected Delivery'}
                      </span>
                    </div>
                    <div className="ep-spotTitle">
                      {spotlightParcel.courier} · {spotlightParcel.trackingNumber}
                    </div>
                    <div className="ep-spotMeta">
                      <span><b>Flat {spotlightParcel.flatNumber}</b> ({spotlightParcel.recipientName || 'Resident'})</span>
                      <span>•</span>
                      <span>
                        {spotlightParcel.status === 'RESCHEDULED'
                          ? `${formatDeliveryDate(spotlightParcel.preferredDate)} · ${spotlightParcel.slot}`
                          : spotlightParcel.slot
                          ? `Window: ${spotlightParcel.slot}`
                          : 'Select delivery window or reschedule once'}
                      </span>
                      {isRes && showSpotQueue && (
                        <>
                          <span>•</span>
                          <span style={{ color: spotQueue.dropsAhead === 0 ? '#6ee7b7' : '#fde68a', fontWeight: 700 }}>
                            {spotQueue.queueMessage}
                          </span>
                        </>
                      )}
                    </div>
                    {spotlightParcel.agentScheduleConfirmed && (
                      <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(110, 231, 183, 0.45)', borderRadius: 10, padding: '4px 10px', fontSize: 12, color: '#ecfdf5', fontWeight: 600 }}>
                        <CheckCircle2 size={13} color="#6ee7b7" />
                        <span>{spotlightParcel.agentScheduleConfirmMessage || 'Schedule confirmed by Delivery Agent'}</span>
                      </div>
                    )}
                  </div>

                  <div className="ep-spotPerf" />

                  <div className="ep-spotRight">
                    {isRes && spotOtp ? (
                      <div className="ep-spotOtpBox">
                        <small>{spotIsDelegateReceiver ? 'Delegate Pickup OTP' : 'Your Doorstep OTP'}</small>
                        <b>{spotOtp}</b>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: '#ddd6fe' }}>
                        {spotlightParcel.deliveryInstruction
                          ? `Instruction: ${spotlightParcel.deliveryInstruction}`
                          : (() => {
                              const partnerTrust = spotlightParcel.agentId ? agentTrust?.byAgentId?.[String(spotlightParcel.agentId)] : null;
                              const ratingLabel = partnerTrust?.averageRating != null ? ` · ★ ${partnerTrust.averageRating}` : '';
                              return `Agent: ${spotlightParcel.agentName || 'Assigned Partner'}${ratingLabel}`;
                            })()}
                      </div>
                    )}

                    <button
                      type="button"
                      className="ep-spotAction"
                      onClick={() => openParcelDrawer(spotlightParcel, 'actions')}
                    >
                      <span>{isRes ? 'Manage Window & Chat' : 'Verify OTP & Chat'}</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </section>
              );
            })()}

            {/* AGENT ELEVATOR ROUTE BATCHING CARD */}
            {isAgent && epTab === 'active' && activeParcels.length > 0 && (
              <section className="ep-routeCard">
                <div className="ep-routeTop">
                  <div className="ep-routeTitle">
                    <Building2 size={16} color="#5b21b6" />
                    <span>Elevator Trip Batching</span>
                    <span className="ep-routeMetaPill">
                      {routeQueue?.totalStops || 0} stop{(routeQueue?.totalStops || 0) === 1 ? '' : 's'} · {routeQueue?.totalActiveDrops || 0} active drop{(routeQueue?.totalActiveDrops || 0) === 1 ? '' : 's'}
                      {(routeQueue?.totalHolds || 0) > 0 ? ` · ${routeQueue.totalHolds} tomorrow hold${routeQueue.totalHolds > 1 ? 's' : ''}` : ''}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`ep-routeSortToggle ${routeSortEnabled ? 'active' : ''}`}
                    onClick={() => setRouteSortEnabled(v => !v)}
                    title="Switch between Tower/Floor route order and newest dispatches first"
                  >
                    <Truck size={13} />
                    <span>{routeSortEnabled ? 'Route Order (Block → Floor)' : 'Recent Dispatches First'}</span>
                  </button>
                </div>

                {towerBatches.length > 0 && (
                  <div className="ep-towerPills">
                    <button
                      type="button"
                      className={`ep-towerBtn ${effectiveTowerFilter === 'ALL' ? 'active' : ''}`}
                      onClick={() => setTowerFilter('ALL')}
                    >
                      All Towers ({routeQueue?.totalActiveDrops || 0})
                    </button>
                    {towerBatches.map(tb => (
                      <button
                        key={tb.tower}
                        type="button"
                        className={`ep-towerBtn ${effectiveTowerFilter === tb.tower ? 'active' : ''}`}
                        onClick={() => setTowerFilter(prev => prev === tb.tower ? 'ALL' : tb.tower)}
                      >
                        Tower {tb.tower} · {tb.drops} drop{tb.drops > 1 ? 's' : ''} ({tb.stops} stop{tb.stops > 1 ? 's' : ''})
                      </button>
                    ))}
                  </div>
                )}

                {routeQueue?.routeStops?.length > 0 && (
                  <div className="ep-routeChain">
                    {routeQueue.routeStops
                      .filter(stop => effectiveTowerFilter === 'ALL' || stop.tower === effectiveTowerFilter)
                      .map((stop, idx) => {
                        const firstParcel = parcels.find(p => p.id === stop.parcelIds?.[0]);
                        return (
                          <span key={`${stop.stopNumber}-${stop.effectiveFlat}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {idx > 0 && <ArrowRight size={13} className="ep-routeArrow" />}
                            <button
                              type="button"
                              className={`ep-stopChip ${stop.stopNumber === 1 ? 'active' : ''}`}
                              onClick={() => firstParcel && openParcelDrawer(firstParcel, 'actions')}
                              title={`Open stop #${stop.stopNumber}: Flat ${stop.effectiveFlat}`}
                            >
                              <span className="ep-stopNum">#{stop.stopNumber}</span>
                              <span>
                                {stop.effectiveFlat} · Fl {stop.floor}
                                {stop.parcelCount > 1 ? ` (${stop.parcelCount}x)` : ''}
                              </span>
                            </button>
                          </span>
                        );
                      })}
                  </div>
                )}
              </section>
            )}

            {/* CLEAN SEARCH & SUB-FILTER BAR */}
            <div className="ep-toolbar">
              <div className="ep-search">
                <Search size={15} color="#908ba6" />
                <input
                  type="text"
                  placeholder="Search tracking #, courier, flat..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button type="button" className="clearBtn" onClick={() => setSearch('')}><X size={14} /></button>
                )}
              </div>

              {epTab === 'active' ? (
                <div className="ep-pills">
                  {isAgent && (
                    <button
                      type="button"
                      className="ep-btnPrimary"
                      style={{ padding: '7px 14px', fontSize: 12 }}
                      onClick={() => openScannerModal('pass-qr')}
                    >
                      <QrCode size={14} />
                      <span>Scan Pass QR</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`ep-pillBtn ${activeSubFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setActiveSubFilter('ALL')}
                  >
                    All Active ({activeParcels.length})
                  </button>
                  <button
                    type="button"
                    className={`ep-pillBtn ${activeSubFilter === 'RECEIVED' ? 'active' : ''}`}
                    onClick={() => setActiveSubFilter('RECEIVED')}
                  >
                    Arriving ({activeParcels.filter(p => p.status === 'RECEIVED').length})
                  </button>
                  <button
                    type="button"
                    className={`ep-pillBtn ${activeSubFilter === 'SLOT_BOOKED' ? 'active' : ''}`}
                    onClick={() => setActiveSubFilter('SLOT_BOOKED')}
                  >
                    Window Booked ({activeParcels.filter(p => p.status === 'SLOT_BOOKED').length})
                  </button>
                  <button
                    type="button"
                    className={`ep-pillBtn ${activeSubFilter === 'RESCHEDULED' ? 'active' : ''}`}
                    onClick={() => setActiveSubFilter('RESCHEDULED')}
                  >
                    Rescheduled ({activeParcels.filter(p => p.status === 'RESCHEDULED').length})
                  </button>
                  {(isAgent || isAdmin) && (
                    <button
                      type="button"
                      className={`ep-pillBtn slaAlert ${activeSubFilter === 'SLA_RISK' ? 'active' : ''}`}
                      onClick={() => setActiveSubFilter('SLA_RISK')}
                    >
                      SLA Risk ({slaCounts.alerts})
                    </button>
                  )}
                </div>
              ) : (
                <div className="ep-pills">
                  <button
                    type="button"
                    className={`ep-pillBtn ${deliveredFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setDeliveredFilter('ALL')}
                  >
                    All Delivered ({deliveredParcels.length})
                  </button>
                  {isRes && (
                    <button
                      type="button"
                      className={`ep-pillBtn ${deliveredFilter === 'UNRATED' ? 'active' : ''}`}
                      onClick={() => setDeliveredFilter('UNRATED')}
                    >
                      Need Rating ({deliveredParcels.filter(p => !p.deliveryRating).length})
                    </button>
                  )}
                  <button
                    type="button"
                    className={`ep-pillBtn ${deliveredFilter === 'DISPUTES' ? 'active' : ''}`}
                    onClick={() => setDeliveredFilter('DISPUTES')}
                  >
                    Issues / Disputes ({deliveredParcels.filter(p => p.issueReported).length})
                  </button>
                  <button type="button" className="ep-btnGhost" onClick={loadData} disabled={busy}>
                    <RefreshCw size={14} className={busy ? 'spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>
              )}
            </div>

            {/* UNCLUTTERED PARCEL TICKETS GRID */}
            {busy && parcels.length === 0 ? (
              <div className="card emptyState">
                <RefreshCw size={28} className="spin" color="#5b21b6" />
                <p>Loading your express parcel passes...</p>
              </div>
            ) : displayedList.length === 0 ? (
              <div className="card emptyState">
                <Boxes size={40} color="#908ba6" />
                <h3>{epTab === 'delivered' ? 'No delivered parcels yet' : 'No active parcels'}</h3>
                <p>
                  {isAgent && epTab === 'active'
                    ? 'Switch to "New Dispatch" in the top bar to alert a resident on arrival.'
                    : 'Everything is clear for now.'}
                </p>
              </div>
            ) : (
              <div className="ep-ticketGrid">
                {displayedList.map(parcel => {
                  const msgCount = msgSummaries[parcel.id]?.count || 0;
                  const reschedLocked = parcel.rescheduledOnce || parcel.status === 'RESCHEDULED';
                  const activeOtp = getActivePassOtp(parcel, user);
                  const delegateReceiver = isDelegateReceiverFor(parcel);
                  const safeDropReq = parcel.status !== 'HANDED_OVER' && isSafeDropInstruction(parcel.deliveryInstruction);
                  const isAccepted = parcel.status === 'SLOT_BOOKED' || (Boolean(parcel.slot) && parcel.status !== 'RECEIVED');
                  const qMeta = routeQueue?.dropsByParcelId?.[parcel.id];
                  const showQueueMeta = Boolean(
                    qMeta &&
                    parcel.status !== 'HANDED_OVER' &&
                    parcel.status !== 'RESCHEDULED' &&
                    (!isRes || isAccepted)
                  );
                  const vacationHold = Boolean(
                    parcel.status === 'RESCHEDULED' &&
                    parcel.rescheduleReason?.toLowerCase().includes('vacation')
                  );
                  const showDeliveredBadges =
                    parcel.status === 'HANDED_OVER' &&
                    (parcel.proofPhotoUrl || parcel.deliveryRating || parcel.issueReported);
                  const slaMeta = (isAgent || isAdmin) ? getParcelSla(parcel) : null;
                  const needsAgentConfirm =
                    (parcel.status === 'SLOT_BOOKED' || parcel.status === 'RESCHEDULED') &&
                    !parcel.agentScheduleConfirmed;
                  return (
                    <article key={parcel.id} className="ep-ticket">
                      <div className="ep-ticketHead">
                        <div className="ep-courierPill">
                          <span className="courierDot" style={{ backgroundColor: getCourierColor(parcel.courier) }} />
                          <span>{parcel.courier}</span>
                          <span className="ep-awbTag">{parcel.trackingNumber}</span>
                        </div>
                        <span className={`statusPill ${parcel.returnPickup ? 'return' : parcel.status.toLowerCase()}`}>
                          {statusLabel(parcel.status, parcel)}
                        </span>
                      </div>

                      <div className="ep-ticketBody">
                        <div className="ep-flatHeadline">
                          <b>{parcel.recipientName || 'Apartment Resident'}</b>
                          <span className="ep-flatChip">FLAT {parcel.flatNumber}</span>
                        </div>

                        {parcel.status === 'RESCHEDULED' ? (
                          <div className="ep-summaryLine locked">
                            {vacationHold ? <PlaneTakeoff size={13} /> : <Lock size={13} />}
                            <span>
                              {vacationHold ? 'Vacation Auto-Hold until ' : 'Hold until '}
                              {formatDeliveryDate(parcel.preferredDate)} · {parcel.slot}
                            </span>
                          </div>
                        ) : parcel.status === 'HANDED_OVER' ? (
                          <div className="ep-summaryLine" style={{ color: '#059669', fontWeight: 600 }}>
                            <CheckCircle2 size={13} />
                            <span>{parcel.verifiedMethod ? `Verified: ${parcel.verifiedMethod}` : 'Delivered directly via 6-digit OTP'}</span>
                          </div>
                        ) : parcel.returnPickup && isRes ? (
                          <div className="ep-summaryLine otp" style={{ color: '#c2410c' }}>
                            <RotateCcw size={13} />
                            <span>{activeOtp ? `Reverse OTP: ${activeOtp}` : 'Reverse Pickup Scheduled'}</span>
                          </div>
                        ) : activeOtp && isRes ? (
                          <div className="ep-summaryLine otp">
                            <KeyRound size={13} />
                            <span>{delegateReceiver ? `Delegate OTP: ${activeOtp}` : `OTP Ready: ${activeOtp}`}</span>
                          </div>
                        ) : (
                          <div className="ep-summaryLine">
                            <Clock size={13} />
                            <span>{parcel.slot ? `Window: ${parcel.slot}` : (parcel.description || 'Tap Manage to choose window')}</span>
                          </div>
                        )}

                        {(showQueueMeta || vacationHold || parcel.delegated || safeDropReq || showDeliveredBadges || Boolean(slaMeta) || needsAgentConfirm) && (
                          <div className="ep-badgeRow">
                            {needsAgentConfirm && (
                              <span className="ep-agentPendingBadge">
                                <Clock size={11} />
                                <span>{isAgent ? 'Needs Schedule Confirm' : 'Awaiting Agent Confirmation'}</span>
                              </span>
                            )}
                            {slaMeta && (
                              <span className={`ep-slaBadge ${slaMeta.tone}`}>
                                {slaMeta.tier === 'OVERDUE' ? (
                                  <Flame size={11} />
                                ) : slaMeta.tier === 'EXPRESS_15M' || slaMeta.tier === 'EXPRESS_FRESH' ? (
                                  <Zap size={11} />
                                ) : (
                                  <Timer size={11} />
                                )}
                                <span>{slaMeta.label}</span>
                              </span>
                            )}
                            {slaMeta?.isEscalated && parcel.status !== 'HANDED_OVER' && (
                              <span className="ep-slaBadge escalated">
                                <AlertTriangle size={11} />
                                <span>SLA Escalated</span>
                              </span>
                            )}
                            {showQueueMeta && isAgent && (
                              <span className="ep-stopBadge">
                                <Building2 size={11} />
                                <span>
                                  STOP #{qMeta.stopNumber} · TOWER {qMeta.tower} · FL {qMeta.floor}
                                  {qMeta.batchSize > 1 ? ` (${qMeta.batchSize}x)` : ''}
                                </span>
                              </span>
                            )}
                            {showQueueMeta && isRes && (
                              <span className={`ep-queueBadge ${qMeta.dropsAhead === 0 ? 'upnext' : ''}`}>
                                <Truck size={11} />
                                <span>{qMeta.queueMessage}</span>
                              </span>
                            )}
                            {showQueueMeta && isRes && qMeta.isDoorstepNow && (
                              <span className="ep-queueBadge doorstepNow">
                                <Zap size={11} />
                                <span>At Your Door (~1–2m)</span>
                              </span>
                            )}
                            {showQueueMeta && isRes && !qMeta.isDoorstepNow && qMeta.etaLabel && (
                              <span className="ep-queueBadge eta">
                                <Timer size={11} />
                                <span>ETA {qMeta.etaLabel}</span>
                              </span>
                            )}
                            {parcel.bundled && (
                              <span className="ep-bundleBadge">
                                <Boxes size={11} />
                                <span>Bundled ({parcel.bundleSize || 2} Drops)</span>
                              </span>
                            )}
                            {parcel.returnPickup && (
                              <span className="ep-returnBadge">
                                <RotateCcw size={11} />
                                <span>Return ({parcel.returnStatus || 'SCHEDULED'})</span>
                              </span>
                            )}
                            {showQueueMeta && isAdmin && (
                              <span className="ep-stopBadge">
                                <Building2 size={11} />
                                <span>STOP #{qMeta.stopNumber} · FL {qMeta.floor}</span>
                              </span>
                            )}
                            {vacationHold && (
                              <span className="ep-queueBadge" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fdba74' }}>
                                <PlaneTakeoff size={11} />
                                <span>Vacation Mode Auto-Hold</span>
                              </span>
                            )}
                            {parcel.delegated && (
                              <span className="ep-delegateTag">
                                <UserPlus size={11} />
                                <span>
                                  {delegateReceiver
                                    ? `Pickup for Flat ${parcel.flatNumber}`
                                    : `Delegate: ${parcel.delegateName} (Flat ${parcel.delegateFlat})`}
                                </span>
                              </span>
                            )}
                            {safeDropReq && (
                              <span className="ep-photoReqTag">
                                <Camera size={11} />
                                <span>Safe-Drop Photo Required</span>
                              </span>
                            )}
                            {parcel.status === 'HANDED_OVER' && parcel.proofPhotoUrl && (
                              <span className="ep-safeDropTag">
                                <Camera size={11} />
                                <span>Safe-Drop Photo Attached</span>
                              </span>
                            )}
                            {parcel.status === 'HANDED_OVER' && parcel.deliveryRating && (
                              <span className="ep-ratedBadge">
                                <Star size={11} fill="#f59e0b" color="#d97706" />
                                <span>{parcel.deliveryRating}.0 ★</span>
                              </span>
                            )}
                            {parcel.status === 'HANDED_OVER' && parcel.issueReported && (
                              <span className={`ep-issueBadge ${parcel.issueStatus === 'RESOLVED' ? 'resolved' : ''}`}>
                                <ShieldAlert size={11} />
                                <span>
                                  {parcel.issueStatus === 'RESOLVED'
                                    ? `Issue Resolved (${parcel.issueCategory})`
                                    : `Dispute ${parcel.issueStatus}: ${parcel.issueCategory}`}
                                </span>
                              </span>
                            )}
                          </div>
                        )}

                        {parcel.status !== 'HANDED_OVER' && parcel.agentScheduleConfirmed && (
                          <div className="ep-agentConfirmBanner">
                            <div className="ep-agentConfirmHead">
                              <CheckCircle2 size={13} />
                              <span>Agent Confirmed{parcel.agentScheduleConfirmedBy ? ` · ${parcel.agentScheduleConfirmedBy}` : ''}</span>
                            </div>
                            <span>{parcel.agentScheduleConfirmMessage}</span>
                          </div>
                        )}
                      </div>

                      <div className="ep-ticketPerforation">
                        <span style={{ fontSize: 11.5, color: '#5d5876', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {reschedLocked && parcel.status !== 'HANDED_OVER'
                            ? (vacationHold ? 'Vacation auto-reschedule' : '1-time reschedule finalized')
                            : parcel.deliveryInstruction || (() => {
                                const pt = parcel.agentId ? agentTrust?.byAgentId?.[String(parcel.agentId)] : null;
                                if (parcel.agentName) {
                                  return pt?.averageRating != null
                                    ? `Agent: ${parcel.agentName} · ★ ${pt.averageRating}`
                                    : `Agent: ${parcel.agentName}`;
                                }
                                return parcel.category || 'Package';
                              })()}
                        </span>

                        <div className="ep-ticketActions">
                          <button
                            type="button"
                            className="ep-chatMiniBtn"
                            onClick={() => openParcelDrawer(parcel, 'chat')}
                          >
                            <MessageSquare size={13} />
                            <span>Chat{msgCount > 0 ? ` (${msgCount})` : ''}</span>
                          </button>

                          {parcel.status === 'HANDED_OVER' ? (
                            <div style={{ display: 'inline-flex', gap: 5 }}>
                              {isRes && !parcel.returnPickup && (
                                <button
                                  type="button"
                                  className="ep-btnReturn"
                                  onClick={() => openReturnModal(parcel)}
                                  title="Schedule a return pickup for this item"
                                >
                                  <RotateCcw size={12} />
                                  <span>Return Item</span>
                                </button>
                              )}
                              {parcel.issueReported && (
                                <button
                                  type="button"
                                  className="ep-manageBtn"
                                  onClick={() => openParcelDrawer(parcel, 'actions')}
                                >
                                  <span>Dispute</span>
                                  <ChevronRight size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="ep-btnMint"
                                style={{ padding: '6px 11px', fontSize: 12 }}
                                onClick={() => setSelectedReceipt(parcel)}
                              >
                                <FileText size={13} />
                                <span>{parcel.returnPickup ? 'Return Receipt' : 'Receipt'}</span>
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: 5 }}>
                              {parcel.returnPickup && isRes && (
                                <button
                                  type="button"
                                  className="ep-btnMint"
                                  style={{ padding: '6px 10px', fontSize: 12 }}
                                  onClick={() => setSelectedPass(parcel)}
                                >
                                  <KeyRound size={13} />
                                  <span>Reverse Pass 🔑</span>
                                </button>
                              )}
                              {isAgent && needsAgentConfirm && (
                                <button
                                  type="button"
                                  className="ep-btnMint"
                                  style={{ padding: '6px 10px', fontSize: 12 }}
                                  disabled={scheduleConfirmBusy}
                                  onClick={() => handleConfirmSchedule(parcel, '')}
                                >
                                  <Check size={13} />
                                  <span>Confirm</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="ep-manageBtn"
                                onClick={() => openParcelDrawer(parcel, 'actions')}
                              >
                                <span>{parcel.returnPickup && isAgent ? 'Collect Return' : 'Manage'}</span>
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB 3 (DELIVERY AGENT): FOCUSED DISPATCH FORM */}
        {epTab === 'dispatch' && isAgent && (
          <section className="card ep-dispatchCard">
            <div className="cardHeader">
              <div className="cardHeaderIcon" style={{ background: '#f3efff', color: '#5b21b6' }}>
                <Truck size={18} />
              </div>
              <div>
                <h2 className="cardTitle">Dispatch New Parcel &amp; Alert Resident</h2>
                <p className="cardSubtitle">Log an arrival once and coordinate directly in chat or via OTP.</p>
              </div>
            </div>

            <form
              onSubmit={async e => {
                const ok = await handleRegisterParcel(e);
                if (ok) setEpTab('active');
              }}
              className="parcelForm"
            >
              <div className="fieldGroup">
                <label className="fieldLabel">Courier Partner</label>
                <div className="courierChips">
                  {COURIERS.map(c => (
                    <button
                      type="button"
                      key={c.name}
                      className={`courierChip ${intakeForm.courier === c.name ? 'selected' : ''}`}
                      onClick={() => setIntakeForm({ ...intakeForm, courier: c.name })}
                    >
                      <span className="courierDot" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fieldGrid">
                <div className="fieldGroup">
                  <label className="fieldLabel">
                    <span>Tracking Number / AWB</span>
                    <span className="ep-labelRowActions">
                      <button
                        type="button"
                        className="ep-scanInlineBtn"
                        onClick={() => openScannerModal('barcode')}
                      >
                        <ScanBarcode size={12} /> Scan Barcode
                      </button>
                      <button type="button" className="textBtn" onClick={handleGenerateTracking} style={{ color: '#5b21b6' }}>
                        <Sparkles size={12} /> Auto
                      </button>
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AMZ-8291"
                    value={intakeForm.trackingNumber}
                    onChange={e => setIntakeForm({ ...intakeForm, trackingNumber: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">Destination Flat #</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A-101"
                    value={intakeForm.flatNumber}
                    onChange={e => setIntakeForm({ ...intakeForm, flatNumber: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              {flatHintPref?.hasPreferences && (
                <div className={`ep-dispatchHintBox ${flatHintPref.vacationActiveToday ? 'vacation' : ''}`}>
                  {flatHintPref.vacationActiveToday ? <PlaneTakeoff size={16} style={{ flexShrink: 0 }} /> : <SlidersHorizontal size={16} style={{ flexShrink: 0 }} />}
                  <div>
                    {flatHintPref.vacationActiveToday ? (
                      <>
                        <b>Vacation Mode Active for Flat {flatHintPref.flatNumber}:</b> Incoming parcel will automatically hold &amp; reschedule{flatHintPref.vacationUntil ? ` until ${formatDeliveryDate(flatHintPref.vacationUntil)}` : ''}.
                      </>
                    ) : (
                      <>
                        <b>Resident Default Rule (Flat {flatHintPref.flatNumber}):</b>{' '}
                        {flatHintPref.defaultInstruction || 'Standard Handover'}
                        {flatHintPref.quietHoursEnabled ? ` · Quiet hours ${flatHintPref.quietHoursStart || '20:00'}–${flatHintPref.quietHoursEnd || '07:00'}` : ''}
                        {flatHintPref.defaultSlot ? ` · Preferred Window: ${flatHintPref.defaultSlot}` : ''}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="fieldGrid">
                <div className="fieldGroup">
                  <label className="fieldLabel">Resident Name</label>
                  <input
                    type="text"
                    placeholder="Resident Name"
                    value={intakeForm.recipientName}
                    onChange={e => setIntakeForm({ ...intakeForm, recipientName: e.target.value })}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">Resident Phone (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 12001"
                    value={intakeForm.recipientPhone}
                    onChange={e => setIntakeForm({ ...intakeForm, recipientPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="fieldGrid">
                <div className="fieldGroup">
                  <label className="fieldLabel">Package Category</label>
                  <select
                    value={intakeForm.category}
                    onChange={e => setIntakeForm({ ...intakeForm, category: e.target.value })}
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">Arrival Note</label>
                  <input
                    type="text"
                    placeholder="e.g. At main gate / lift lobby"
                    value={intakeForm.description}
                    onChange={e => setIntakeForm({ ...intakeForm, description: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="ep-btnPrimary fullWidth" disabled={busy}>
                <Send size={15} />
                <span>Send Arrival Alert &amp; Open Active Queue</span>
              </button>
            </form>
          </section>
        )}

        {/* TAB 4A (ADMIN): EXPRESS ANALYTICS DASHBOARD */}
        {epTab === 'insights' && isAdmin && (
          <ExpressAnalyticsDashboard
            opsStats={opsStats}
            parcels={parcels}
            slaBusy={slaBusy}
            handleEscalateAllOverdue={handleEscalateAllOverdue}
            handleEscalateSla={handleEscalateSla}
            onOpenParcel={p => openParcelDrawer(p, 'actions')}
            getCourierColor={getCourierColor}
            getParcelSla={getParcelSla}
          />
        )}

        {/* TAB 4 (ADMIN): COMMUNITY USER DIRECTORY + ADMIN TOOLS */}
        {epTab === 'users' && isAdmin && (
          <section className="card">
            <div className="cardHeader" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="cardHeaderIcon" style={{ background: '#f3efff', color: '#5b21b6' }}>
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="cardTitle">Community User Directory</h2>
                  <p className="cardSubtitle">Manage residents, delivery agents, and society audit tools.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="ep-btnGhost" onClick={() => setEpTab('insights')}>
                  <BarChart3 size={14} color="#5b21b6" />
                  <span>Analytics Insights</span>
                </button>
                <button type="button" className="ep-btnGhost" onClick={handleSeedDemoData} disabled={busy}>
                  <Sparkles size={14} color="#5b21b6" />
                  <span>Seed Demo</span>
                </button>
                <button type="button" className="ep-btnGhost" onClick={handleExportCsv}>
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="tableWrapper">
              <table className="userTable">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Flat</th>
                    <th>Trust / Rules</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredUsers.map(u => {
                    const trustRow = u.role === 'ROLE_DELIVERY_AGENT' ? agentTrust?.byAgentId?.[String(u.id)] : null;
                    return (
                    <tr key={u.id}>
                      <td>
                        <div className="userCol">
                          <div className="smallAvatar" style={{ background: '#f3efff', color: '#5b21b6' }}>{u.name.charAt(0)}</div>
                          <div>
                            <b>{u.name}</b>
                            {u.phone && <div style={{ fontSize: 11, color: '#5d5876' }}>{u.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`roleBadge ${u.role.toLowerCase()}`}>
                          {u.role.replace('ROLE_', '')}
                        </span>
                      </td>
                      <td><b>{u.flatNumber || '—'}</b></td>
                      <td>
                        {u.role === 'ROLE_DELIVERY_AGENT' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span className="ep-trustScoreBadge" style={{ width: 'fit-content' }}>
                              <Star size={11} fill="#f59e0b" color="#d97706" />
                              <span>
                                {trustRow?.averageRating != null
                                  ? `${trustRow.averageRating} (${trustRow.ratingCount})`
                                  : 'Unrated'}
                              </span>
                            </span>
                            {(trustRow?.openIssues || 0) > 0 && (
                              <span className="ep-issueBadge" style={{ width: 'fit-content' }}>
                                {trustRow.openIssues} open dispute
                              </span>
                            )}
                          </div>
                        ) : u.vacationMode ? (
                          <span className="ep-issueBadge" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fdba74' }}>
                            Vacation Mode
                          </span>
                        ) : u.defaultInstruction ? (
                          <span style={{ fontSize: 11.5, color: '#5b21b6', fontWeight: 600 }}>{u.defaultInstruction}</span>
                        ) : (
                          'Standard'
                        )}
                      </td>
                      <td>
                        <span className={`statusPill ${u.active ? 'active' : 'inactive'}`}>
                          {u.active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>
                        <div className="actionRow">
                          <button
                            type="button"
                            className="btn text"
                            onClick={() => handleToggleUserActive(u)}
                            title={u.active ? 'Deactivate' : 'Activate'}
                          >
                            {u.active ? <UserX size={15} color="#dc2626" /> : <UserCheck size={15} color="#16a34a" />}
                          </button>
                          <button
                            type="button"
                            className="btn dangerIcon"
                            onClick={() => handleDeleteUser(u)}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* SPACIOUS SLIDE-OVER SIDE SHEET (PROGRESSIVE DISCLOSURE DRAWER) */}
      {drawerParcel && (
        <div className="ep-drawerBackdrop" onClick={() => setDrawerOpen(false)}>
          <aside className="ep-sideDrawer" onClick={e => e.stopPropagation()}>
            <div className="ep-drawerTop">
              <div className="ep-drawerTitle">
                <h3>
                  <span className="courierDot" style={{ backgroundColor: getCourierColor(drawerParcel.courier), width: 10, height: 10 }} />
                  <span>{drawerParcel.courier} · {drawerParcel.trackingNumber}</span>
                </h3>
                <p>
                  Flat {drawerParcel.flatNumber} · {drawerParcel.recipientName || 'Resident'}
                  {drawerParcel.agentName ? ` · Agent: ${drawerParcel.agentName}` : ''}
                </p>
              </div>
              <button type="button" className="closeBtn" onClick={() => setDrawerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="ep-drawerTabs">
              <button
                type="button"
                className={`ep-drawerTab ${drawerTab === 'actions' ? 'active' : ''}`}
                onClick={() => setDrawerTab('actions')}
              >
                <Ticket size={14} />
                <span>Actions &amp; Pass</span>
              </button>
              <button
                type="button"
                className={`ep-drawerTab ${drawerTab === 'chat' ? 'active' : ''}`}
                onClick={() => setDrawerTab('chat')}
              >
                <MessageSquare size={14} />
                <span>Live Chat ({msgSummaries[drawerParcel.id]?.count || chatMessages.length})</span>
              </button>
            </div>

            {drawerTab === 'actions' ? (
              <div className="ep-drawerBody">
                {/* 3-Step Delivery Timeline */}
                {(() => {
                  const drawerQueue = routeQueue?.dropsByParcelId?.[drawerParcel.id];
                  const isDrawerAccepted = drawerParcel.status === 'SLOT_BOOKED' || (Boolean(drawerParcel.slot) && drawerParcel.status !== 'RECEIVED');
                  const showDrawerQueue = Boolean(
                    drawerQueue &&
                    drawerParcel.status !== 'HANDED_OVER' &&
                    drawerParcel.status !== 'RESCHEDULED' &&
                    (!isRes || isDrawerAccepted)
                  );
                  return (
                    <div className="ep-sectionBlock">
                      <h4>Delivery Stage</h4>
                      <div className="progressStepper" style={{ padding: 0 }}>
                        <div className={`step ${drawerParcel.status !== null ? 'done' : ''}`}>
                          <div className="stepCircle"><Check size={11} /></div>
                          <span>1. Alert Sent</span>
                        </div>
                        <div className="stepLine" />
                        <div className={`step ${drawerParcel.status === 'SLOT_BOOKED' || drawerParcel.status === 'RESCHEDULED' || drawerParcel.status === 'HANDED_OVER' ? 'done' : ''}`}>
                          <div className="stepCircle">
                            {drawerParcel.status === 'SLOT_BOOKED' || drawerParcel.status === 'RESCHEDULED' || drawerParcel.status === 'HANDED_OVER' ? <Check size={11} /> : '2'}
                          </div>
                          <span>{drawerParcel.status === 'RESCHEDULED' ? '2. Rescheduled' : '2. Plan Set'}</span>
                        </div>
                        <div className="stepLine" />
                        <div className={`step ${drawerParcel.status === 'HANDED_OVER' ? 'done' : ''}`}>
                          <div className="stepCircle">
                            {drawerParcel.status === 'HANDED_OVER' ? <Check size={11} /> : '3'}
                          </div>
                          <span>3. OTP Delivered</span>
                        </div>
                      </div>
                      {showDrawerQueue && (
                        <div className="ep-drawerQueueBox">
                          <Building2 size={15} color="#5b21b6" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1e1b4b' }}>
                              {isRes
                                ? drawerQueue.queueMessage
                                : `Stop #${drawerQueue.stopNumber} of ${drawerQueue.totalStops} · ${drawerQueue.dropsAhead} drop${drawerQueue.dropsAhead === 1 ? '' : 's'} ahead`}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#5d5876', marginTop: 2 }}>
                              Tower {drawerQueue.tower} · Floor {drawerQueue.floor} · {drawerQueue.stopsAhead === 0 ? 'Elevator priority stop' : `${drawerQueue.stopsAhead} flat stop${drawerQueue.stopsAhead === 1 ? '' : 's'} ahead`}
                            </div>
                          </div>
                        </div>
                      )}
                      {drawerParcel.description && (
                        <div className="parcelDesc">{drawerParcel.description}</div>
                      )}
                    </div>
                  );
                })()}

                {/* RESIDENT CONTROLS */}
                {isRes && drawerParcel.status !== 'HANDED_OVER' && (() => {
                  const reschedUsed = drawerParcel.rescheduledOnce || drawerParcel.status === 'RESCHEDULED';
                  const activeOtp = getActivePassOtp(drawerParcel, user);
                  const delegateReceiver = isDelegateReceiverFor(drawerParcel);
                  const isOwner = drawerParcel.flatNumber?.trim().toUpperCase() === userFlatUpper;

                  if (drawerParcel.returnPickup) {
                    return (
                      <>
                        {activeOtp && (
                          <div className="privateOtpCard" style={{ margin: 0, borderColor: '#fdba74', background: '#fff7ed' }}>
                            <div className="otpCardTop">
                              <RotateCcw size={15} color="#c2410c" />
                              <b style={{ color: '#9a3412' }}>Your Reverse-Handover OTP</b>
                            </div>
                            <div className="bigOtp" style={{ color: '#c2410c' }}>{activeOtp}</div>
                            <small style={{ color: '#7c2d12' }}>
                              Share this 6-digit Reverse OTP with the courier agent when handing over your return package.
                            </small>
                          </div>
                        )}

                        <div className="ep-sectionBlock" style={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 12, padding: '14px 16px' }}>
                          <h4 style={{ color: '#1c1917', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <RotateCcw size={14} color="#c2410c" />
                            <span>Return Item Summary</span>
                          </h4>
                          <div style={{ fontSize: 13, color: '#44403c', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#78716c' }}>Courier Partner:</span>
                              <b>{drawerParcel.courier}</b>
                            </div>
                            {drawerParcel.returnReason && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#78716c' }}>Return Reason:</span>
                                <b>{drawerParcel.returnReason}</b>
                              </div>
                            )}
                            {drawerParcel.returnOriginalTracking && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#78716c' }}>Original Order / AWB:</span>
                                <b style={{ fontFamily: 'monospace' }}>{drawerParcel.returnOriginalTracking}</b>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#78716c' }}>Pickup Window:</span>
                              <b>{formatDeliveryDate(drawerParcel.preferredDate)} · {drawerParcel.slot}</b>
                            </div>
                            {drawerParcel.deliveryInstruction && (
                              <div style={{ marginTop: 4, padding: '8px 12px', background: '#ffffff', borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 12 }}>
                                <span style={{ color: '#78716c', fontWeight: 600 }}>Note for Agent: </span>
                                <i>"{drawerParcel.deliveryInstruction}"</i>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="ep-btnMint"
                            style={{ width: '100%', marginTop: 14, justifyContent: 'center', background: '#c2410c', borderColor: '#c2410c', color: '#ffffff', padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
                            onClick={() => setSelectedPass(drawerParcel)}
                          >
                            <KeyRound size={14} />
                            <span>Show Reverse Digital Pass QR</span>
                          </button>
                        </div>
                      </>
                    );
                  }

                  return (
                    <>
                      {activeOtp && (
                        <div className="privateOtpCard" style={{ margin: 0 }}>
                          <div className="otpCardTop">
                            <KeyRound size={15} color="#d97706" />
                            <b>{delegateReceiver ? `Neighbor Delegate OTP (Flat ${drawerParcel.delegateFlat})` : 'Your Private Handover OTP'}</b>
                          </div>
                          <div className="bigOtp">{activeOtp}</div>
                          <small>
                            {delegateReceiver
                              ? `Share this OTP or open Pickup QR Pass to collect on behalf of Flat ${drawerParcel.flatNumber}.`
                              : 'Share with your Delivery Agent at handover or present Digital Pickup QR.'}
                          </small>
                        </div>
                      )}

                      {drawerParcel.delegated && (
                        <div className="delegateBanner">
                          <div className="delegateBannerTop">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#5b21b6' }}>
                              <UserPlus size={14} />
                              <span>
                                {delegateReceiver
                                  ? `Authorized Pickup for Flat ${drawerParcel.flatNumber}`
                                  : `Delegated to ${drawerParcel.delegateName} (Flat ${drawerParcel.delegateFlat})`}
                              </span>
                            </span>
                            {isOwner && (
                              <button
                                type="button"
                                className="textBtn"
                                style={{ color: '#dc2626' }}
                                onClick={() => handleRevokeDelegate(drawerParcel)}
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                          {drawerParcel.delegateOtp && (
                            <div className="delegateOtpPill">DELEGATE OTP: {drawerParcel.delegateOtp}</div>
                          )}
                          <small style={{ color: '#5d5876' }}>
                            Delivery Agent and Flat {drawerParcel.delegateFlat} have been notified.
                          </small>
                        </div>
                      )}

                      <div className="ep-sectionBlock">
                        <h4>Quick Instruction to Agent</h4>
                        <div className="instructionChips">
                          {DELIVERY_INSTRUCTIONS.map(inst => (
                            <button
                              key={inst}
                              type="button"
                              className={`instructionChip ${drawerParcel.deliveryInstruction === inst ? 'active' : ''}`}
                              onClick={() => handleSetInstruction(drawerParcel, inst)}
                            >
                              {inst}
                            </button>
                          ))}
                        </div>
                        {isSafeDropInstruction(drawerParcel.deliveryInstruction) && (
                          <div style={{ fontSize: 11.5, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Camera size={13} />
                            <span>Delivery agent must attach a doorstep Safe-Drop photo before closing handover.</span>
                          </div>
                        )}
                      </div>

                      <div className="ep-sectionBlock">
                        <h4>Delivery Schedule</h4>
                        {reschedUsed ? (
                          <>
                            <div className="rescheduleLockedBox">
                              <Lock size={14} color="#c2410c" />
                              <span>
                                One-time reschedule used — finalized for <b>{formatDeliveryDate(drawerParcel.preferredDate)} ({drawerParcel.slot})</b>.
                                {drawerParcel.rescheduleReason ? ` Note: "${drawerParcel.rescheduleReason}"` : ''}
                              </span>
                            </div>
                            {isOwner && !drawerParcel.delegated && (
                              <button
                                type="button"
                                className="ep-delegateCtaBtn"
                                onClick={() => openDelegateModal(drawerParcel)}
                              >
                                <UserPlus size={15} />
                                <span>Not available? Authorize Neighbor / Family</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="slotGrid">
                              {TIME_SLOTS.map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  className={`slotChip ${drawerParcel.slot === s ? 'active' : ''}`}
                                  onClick={() => handleBookSlot(drawerParcel, s)}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="btn rescheduleBtn"
                              style={{ justifyContent: 'center', marginTop: 4 }}
                              onClick={() => openRescheduleModal(drawerParcel)}
                            >
                              <CalendarDays size={14} />
                              <span>Not home today? Reschedule (1-Time Only)</span>
                            </button>
                            {isOwner && !drawerParcel.delegated && (
                              <button
                                type="button"
                                className="ep-delegateCtaBtn"
                                onClick={() => openDelegateModal(drawerParcel)}
                              >
                                <UserPlus size={14} />
                                <span>Or Pass to Trusted Neighbor / Family</span>
                              </button>
                            )}
                            {!drawerParcel.bundled && eligibleToBundle.length >= 2 && (
                              <button
                                type="button"
                                className="ep-btnPrimary"
                                style={{ justifyContent: 'center', marginTop: 6, width: '100%' }}
                                onClick={() => openBundleModal(eligibleToBundle)}
                              >
                                <Boxes size={14} />
                                <span>Bundle {eligibleToBundle.length} Deliveries into 1 Slot</span>
                              </button>
                            )}
                          </>
                        )}

                        {drawerParcel.agentScheduleConfirmed ? (
                          <div className="ep-agentConfirmBanner" style={{ marginTop: 4 }}>
                            <div className="ep-agentConfirmHead">
                              <CheckCircle2 size={13} />
                              <span>Delivery Agent Confirmed{drawerParcel.agentScheduleConfirmedBy ? ` · ${drawerParcel.agentScheduleConfirmedBy}` : ''}</span>
                            </div>
                            <span>{drawerParcel.agentScheduleConfirmMessage}</span>
                          </div>
                        ) : (drawerParcel.status === 'SLOT_BOOKED' || drawerParcel.status === 'RESCHEDULED') && (
                          <div className="ep-agentPendingBadge" style={{ width: 'fit-content', marginTop: 4 }}>
                            <Clock size={12} />
                            <span>Waiting for Delivery Agent to confirm your {drawerParcel.status === 'RESCHEDULED' ? 'reschedule' : 'slot'}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="ep-btnGhost"
                        style={{ justifyContent: 'center' }}
                        onClick={() => setSelectedPass(drawerParcel)}
                      >
                        <QrCode size={15} />
                        <span>View Scannable Digital Pickup Pass</span>
                      </button>
                    </>
                  );
                })()}

                {/* SLA COUNTDOWN & ESCALATION MONITOR (AGENT & ADMIN) */}
                {(isAgent || isAdmin) && drawerParcel.status !== 'HANDED_OVER' && drawerParcel.status !== 'RESCHEDULED' && (() => {
                  const drawerSla = getParcelSla(drawerParcel);
                  if (!drawerSla) return null;
                  const pct = Math.min(100, Math.max(4, Math.round((drawerSla.elapsedMinutes / SLA_TARGET_MINUTES) * 100)));
                  const fillColor = drawerSla.isOverdue
                    ? '#dc2626'
                    : drawerSla.isSlaRisk
                    ? '#f59e0b'
                    : drawerSla.isUnder15m
                    ? '#10b981'
                    : '#5b21b6';
                  return (
                    <div className={`ep-slaDrawerBox ${drawerSla.isOverdue ? 'overdue' : drawerSla.isSlaRisk ? 'risk' : ''}`}>
                      <div className="ep-slaDrawerTop">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12.5, color: '#1e1b4b' }}>
                          {drawerSla.isOverdue ? <Flame size={14} color="#dc2626" /> : <Timer size={14} color={fillColor} />}
                          <span>4h Handover SLA Countdown</span>
                        </span>
                        <span className={`ep-slaBadge ${drawerSla.tone}`}>{drawerSla.label}</span>
                      </div>
                      <div className="ep-slaProgressTrack">
                        <div className="ep-slaProgressFill" style={{ width: `${pct}%`, background: fillColor }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: '#5d5876' }}>
                        <span>Elapsed: <b>{formatDurationMinutes(drawerSla.elapsedMinutes)}</b> / 4h target</span>
                        <button
                          type="button"
                          className="ep-btnDangerSm"
                          style={{ padding: '5px 10px', fontSize: 11.5 }}
                          disabled={slaBusy || drawerSla.isEscalated}
                          onClick={() => handleEscalateSla(drawerParcel)}
                        >
                          <AlertTriangle size={12} />
                          <span>{drawerSla.isEscalated ? 'SLA Escalated' : 'Escalate SLA Priority'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* DELIVERY AGENT CONTROLS */}
                {isAgent && drawerParcel.status !== 'HANDED_OVER' && (() => {
                  const safeDropReq = isSafeDropInstruction(drawerParcel.deliveryInstruction);
                  const photoData = proofPhotos[drawerParcel.id] || '';
                  const noteVal = proofNotes[drawerParcel.id] || '';
                  return (
                    <div className="ep-sectionBlock">
                      <h4>Handover Terminal</h4>
                      {drawerParcel.status === 'RESCHEDULED' && (
                        <div className="agentHoldAlert">
                          <Clock size={14} color="#c2410c" />
                          <span>Hold today — Next attempt: <b>{formatDeliveryDate(drawerParcel.preferredDate)} ({drawerParcel.slot})</b></span>
                        </div>
                      )}
                      {(drawerParcel.status === 'SLOT_BOOKED' || drawerParcel.status === 'RESCHEDULED') && (
                        <div className={`ep-confirmTerminalCard ${drawerParcel.agentScheduleConfirmed ? 'confirmed' : ''}`}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12.5, color: drawerParcel.agentScheduleConfirmed ? '#047857' : '#4c1d95' }}>
                              <CheckCircle2 size={14} />
                              <span>
                                {drawerParcel.agentScheduleConfirmed
                                  ? 'Schedule Confirmed to Resident'
                                  : `Confirm Resident ${drawerParcel.status === 'RESCHEDULED' ? 'Reschedule' : 'Slot'}`}
                              </span>
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#5d5876' }}>
                              {formatDeliveryDate(drawerParcel.preferredDate)} · {drawerParcel.slot}
                            </span>
                          </div>
                          {drawerParcel.agentScheduleConfirmed && drawerParcel.agentScheduleConfirmMessage && (
                            <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                              Sent: &ldquo;{drawerParcel.agentScheduleConfirmMessage}&rdquo;
                            </div>
                          )}
                          <div className="ep-confirmQuickRow">
                            {[
                              'On my way in this slot!',
                              'Confirmed for tomorrow.',
                              'Will call 10 mins before arrival.'
                            ].map(preset => (
                              <button
                                key={preset}
                                type="button"
                                className="ep-confirmChipBtn"
                                onClick={() => setScheduleConfirmNotes(prev => ({ ...prev, [drawerParcel.id]: preset }))}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            className="safeDropNoteInput"
                            placeholder="Custom confirming message for resident (optional)"
                            value={scheduleConfirmNotes?.[drawerParcel.id] || ''}
                            onChange={e => setScheduleConfirmNotes(prev => ({
                              ...prev,
                              [drawerParcel.id]: e.target.value
                            }))}
                          />
                          <button
                            type="button"
                            className={drawerParcel.agentScheduleConfirmed ? 'ep-btnGhost' : 'ep-btnMint'}
                            style={{ justifyContent: 'center', width: '100%' }}
                            disabled={scheduleConfirmBusy}
                            onClick={() => handleConfirmSchedule(drawerParcel)}
                          >
                            <CheckCircle2 size={14} />
                            <span>
                              {scheduleConfirmBusy
                                ? 'Sending Confirmation...'
                                : drawerParcel.agentScheduleConfirmed
                                ? 'Send Updated Confirmation Message'
                                : 'Confirm & Notify Resident'}
                            </span>
                          </button>
                        </div>
                      )}
                      {drawerParcel.delegated && (
                        <div className="delegateBanner">
                          <div className="delegateBannerTop">
                            <span style={{ fontWeight: 700, color: '#5b21b6', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <UserPlus size={14} />
                              <span>Authorized Neighbor: {drawerParcel.delegateName} (Flat {drawerParcel.delegateFlat})</span>
                            </span>
                          </div>
                          <small style={{ color: '#5d5876' }}>
                            Verify either the Resident OTP or the Delegate Neighbor OTP below.
                          </small>
                        </div>
                      )}
                      {drawerParcel.deliveryInstruction && (
                        <div className="instructionBanner">
                          <ClipboardList size={14} color="#047857" />
                          <span>Resident Instruction: <b>{drawerParcel.deliveryInstruction}</b></span>
                        </div>
                      )}

                      <div className={`safeDropCard ${safeDropReq ? 'required' : ''}`}>
                        <div className="safeDropHead">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Camera size={14} color={safeDropReq ? '#b45309' : '#5b21b6'} />
                            <span>Doorstep Photo Proof {safeDropReq ? '(Required)' : '(Optional)'}</span>
                          </span>
                          {photoData && (
                            <span style={{ color: '#047857', fontSize: 11 }}>Attached</span>
                          )}
                        </div>

                        {photoData ? (
                          <div className="safeDropPreviewWrap">
                            <img src={photoData} alt="Safe-Drop preview" className="safeDropPreviewImg" />
                            <button
                              type="button"
                              className="safeDropRemoveBtn"
                              onClick={() => setProofPhotos(prev => {
                                const next = { ...prev };
                                delete next[drawerParcel.id];
                                return next;
                              })}
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        ) : (
                          <div className="safeDropActionsRow">
                            <button
                              type="button"
                              className="ep-btnGhost"
                              style={{ justifyContent: 'center', padding: '7px 8px', fontSize: 12 }}
                              onClick={() => openPhotoModal(drawerParcel)}
                            >
                              <Camera size={13} />
                              <span>Snap Camera</span>
                            </button>
                            <label
                              className="ep-btnGhost"
                              style={{ justifyContent: 'center', padding: '7px 8px', fontSize: 12, cursor: 'pointer' }}
                            >
                              <Upload size={13} />
                              <span>Upload Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={async e => {
                                  const f = e.target.files?.[0];
                                  e.target.value = '';
                                  if (!f) return;
                                  try {
                                    const compressed = await compressImageFileToDataUrl(f);
                                    setProofPhotos(prev => ({ ...prev, [drawerParcel.id]: compressed }));
                                  } catch (err) {
                                    setNotice({ text: err.message || 'Could not process image', type: 'error' });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}

                        <input
                          type="text"
                          className="safeDropNoteInput"
                          placeholder="Doorstep note (e.g. Left outside main door mat)"
                          value={noteVal}
                          onChange={e => setProofNotes(prev => ({ ...prev, [drawerParcel.id]: e.target.value }))}
                        />
                      </div>

                      <div className="safeDropActionsRow">
                        <button
                          type="button"
                          className="ep-btnGhost"
                          style={{ justifyContent: 'center', fontSize: 12 }}
                          onClick={() => handleRequestOtp(drawerParcel)}
                        >
                          <KeyRound size={14} />
                          <span>Send OTP</span>
                        </button>
                        <button
                          type="button"
                          className="ep-btnGhost"
                          style={{ justifyContent: 'center', fontSize: 12, borderColor: '#d8ccff', color: '#5b21b6' }}
                          onClick={() => openScannerModal('pass-qr', drawerParcel.id)}
                        >
                          <QrCode size={14} />
                          <span>Scan Pass QR</span>
                        </button>
                      </div>

                      {drawerParcel.bundled && (
                        <div className="ep-bundleBanner" style={{ margin: '8px 0', padding: '10px 12px' }}>
                          <div>
                            <b style={{ color: '#4c1d95', fontSize: 12 }}>📦 Bundled Drop ({drawerParcel.bundleSize || 2} Parcels)</b>
                            <div style={{ fontSize: 11, color: '#5d5876' }}>Master Pass: {drawerParcel.bundleCode}</div>
                          </div>
                          <button
                            type="button"
                            className="ep-btnPrimary"
                            style={{ fontSize: 11.5, padding: '6px 11px' }}
                            disabled={bundleBusy}
                            onClick={() => handleBundleHandover({
                              bundleCode: drawerParcel.bundleCode,
                              otp: otpInputs[drawerParcel.id] || drawerParcel.demoOtp || '',
                              proofPhotoUrl: photoData,
                              proofNote: noteVal,
                              verifiedMethod: 'MASTER_PASS',
                              agentName: user.name
                            })}
                          >
                            <Boxes size={13} />
                            <span>Deliver All ({drawerParcel.bundleSize || 2})</span>
                          </button>
                        </div>
                      )}

                      <div className="otpSubmitGroup" style={{ marginTop: 4 }}>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder={drawerParcel.returnPickup ? '6-Digit Reverse OTP' : '6-Digit OTP'}
                          className="otpInputField"
                          style={{ flex: 1 }}
                          value={otpInputs[drawerParcel.id] || ''}
                          onChange={e => setOtpInputs({
                            ...otpInputs,
                            [drawerParcel.id]: e.target.value.replace(/\D/g, '').slice(0, 6)
                          })}
                        />
                        <button
                          type="button"
                          className={drawerParcel.returnPickup ? 'ep-btnReturn' : 'ep-btnPrimary'}
                          style={drawerParcel.returnPickup ? { padding: '9px 16px', fontSize: 13 } : {}}
                          onClick={() => {
                            if (drawerParcel.returnPickup) {
                              handleConfirmReturnPickup(drawerParcel, otpInputs[drawerParcel.id], 'MANUAL_OTP');
                            } else {
                              handleVerifyHandover(drawerParcel);
                            }
                          }}
                        >
                          {drawerParcel.returnPickup ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />}
                          <span>{drawerParcel.returnPickup ? 'Collect Return' : 'Verify & Deliver'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {drawerParcel.status === 'HANDED_OVER' && (
                  <div className="ep-sectionBlock">
                    <h4>Handover Completed</h4>
                    <div className="completedBadge">
                      <CheckCircle2 size={16} color="#16a34a" />
                      <span>
                        {drawerParcel.verifiedMethod
                          ? `${drawerParcel.verifiedMethod}`
                          : 'Verified & Delivered Directly'}
                      </span>
                    </div>
                    {drawerParcel.handedOverTo && (
                      <div style={{ fontSize: 12, color: '#5d5876' }}>
                        Received by: <b>{drawerParcel.handedOverTo}</b>
                      </div>
                    )}
                    {drawerParcel.proofPhotoUrl && (
                      <div className="drawerPhotoProof">
                        <div className="drawerPhotoProofHeader">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <ShieldCheck size={14} />
                            <span>Doorstep Safe-Drop Photo</span>
                          </span>
                          <span style={{ fontSize: 11, color: '#5d5876', fontWeight: 500 }}>
                            {drawerParcel.proofCapturedAt ? drawerParcel.proofCapturedAt.replace('T', ' ').slice(0, 16) : 'Verified'}
                          </span>
                        </div>
                        <img
                          src={drawerParcel.proofPhotoUrl}
                          alt="Doorstep proof of delivery"
                          className="proofPhotoFullImg"
                        />
                        {drawerParcel.proofNote && (
                          <div style={{ fontSize: 11.5, color: '#5d5876' }}>
                            Note: <b>{drawerParcel.proofNote}</b>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className="ep-btnMint"
                      style={{ justifyContent: 'center' }}
                      onClick={() => setSelectedReceipt(drawerParcel)}
                    >
                      <FileText size={15} />
                      <span>Open Handover Receipt</span>
                    </button>

                    {drawerParcel.deliveryRating && (
                      <DeliveryRatingBox
                        parcel={drawerParcel}
                        isRes={isRes}
                        ratingDrafts={ratingDrafts}
                        setRatingDrafts={setRatingDrafts}
                        ratingBusy={ratingBusy}
                        handleRateDelivery={handleRateDelivery}
                        RATING_TAGS={RATING_TAGS}
                      />
                    )}

                    <IssueDisputeBox
                      parcel={drawerParcel}
                      isRes={isRes}
                      isStaffAudit={isAdmin || isAgent}
                      withinWindow={isWithinIssueWindow?.(drawerParcel)}
                      openIssueModal={openIssueModal}
                      handleResolveIssue={handleResolveIssue}
                      issueBusy={issueBusy}
                    />
                  </div>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    className="btn dangerSoft"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      handleDeleteParcel(drawerParcel);
                      setDrawerOpen(false);
                    }}
                  >
                    <Trash2 size={15} />
                    <span>Delete Parcel Record</span>
                  </button>
                )}
              </div>
            ) : (
              /* LIVE CHAT TAB INSIDE SLIDE-OVER DRAWER */
              <div className="ep-drawerChatWrap">
                {drawerParcel.deliveryInstruction && (
                  <div className="chatInstructionBar">
                    <ClipboardList size={14} color="#047857" />
                    <span>Instruction: <b>{drawerParcel.deliveryInstruction}</b></span>
                  </div>
                )}

                <div className="chatMessagesList">
                  {chatMessages.length === 0 ? (
                    <div className="emptyChatNotice">
                      <MessageSquare size={26} color="#908ba6" />
                      <p>No messages yet. Tap a quick reply below or start chatting directly.</p>
                    </div>
                  ) : (
                    chatMessages.map(msg => {
                      const isMine = msg.senderRole === user.role;
                      return (
                        <div key={msg.id} className={`chatBubbleWrapper ${isMine ? 'mine' : 'theirs'}`}>
                          <div className="chatSenderMeta">
                            <b>{msg.senderName}</b>
                            <span>{msg.senderRole === 'ROLE_DELIVERY_AGENT' ? 'Delivery Agent' : msg.senderRole === 'ROLE_RESIDENT' ? 'Resident' : 'Admin'}</span>
                          </div>
                          <div className={`chatBubble ${isMine ? 'mine' : 'theirs'}`}>
                            {msg.message}
                          </div>
                          <span className="chatTime">
                            {msg.createdAt ? msg.createdAt.replace('T', ' ').slice(11, 16) : 'Now'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {drawerParcel.status !== 'HANDED_OVER' && (
                  <div className="chatQuickChips">
                    {(isAgent ? AGENT_QUICK_REPLIES : RESIDENT_QUICK_REPLIES).map(qr => (
                      <button
                        key={qr}
                        type="button"
                        className="chatQuickChip"
                        disabled={chatBusy}
                        onClick={() => handleSendChatMessage(qr, drawerParcel)}
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                )}

                <form
                  className="chatInputForm"
                  onSubmit={e => {
                    e.preventDefault();
                    handleSendChatMessage(undefined, drawerParcel);
                  }}
                >
                  <input
                    type="text"
                    placeholder={isAgent ? 'Message resident directly...' : 'Message delivery agent directly...'}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    disabled={chatBusy}
                  />
                  <button type="submit" className="ep-btnPrimary" disabled={chatBusy || !chatInput.trim()}>
                    <Send size={14} />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            )}
          </aside>
        </div>
      )}

      <footer className="footer">
        <Building2 size={15} />
        <span>{propertyTitle}</span>
        <span>•</span>
        <span>SmartParcel Express Pass &amp; Direct Delivery Platform</span>
      </footer>
    </div>
  );
}

