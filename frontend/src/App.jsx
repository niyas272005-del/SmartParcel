import React, { useEffect, useRef, useState } from 'react';
import './express.css';
import { ExpressAuth, ExpressWorkspace, DeliveryRatingBox, IssueDisputeBox } from './ExpressPass';
import {
  PassQrCode,
  CameraScannerModal,
  PhotoCaptureModal,
  getActivePassOtp,
  encodePassQrPayload,
  parseScannedScanResult,
  isSafeDropInstruction,
  compressImageFileToDataUrl
} from './CameraTools';
import {
  getNotificationPermission,
  isStandalonePwa,
  requestBrowserNotificationPermission,
  dispatchPwaNotification
} from './pwaNotifications';
import {
  CalendarDays, Printer, AlertCircle, X, Bell, Camera, UserPlus, ShieldCheck,
  Star, AlertTriangle, SlidersHorizontal, PlaneTakeoff, Smartphone, BellRing, ShieldAlert, Upload, CheckCircle2, Trash2, FileText,
  Boxes, RotateCcw
} from 'lucide-react';
import { handleMockApi } from './mockBackend';

const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const PARCELS_API = `${API}/parcels`;
const AUTH_API = `${API}/auth`;
const NOTIFS_API = `${API}/notifications`;

const hasConfiguredBackend = Boolean(import.meta.env.VITE_API_URL);
const isLocalhost = Boolean(
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.startsWith('192.168.') ||
   window.location.hostname.startsWith('10.'))
);
const isStaticPreviewMode = !hasConfiguredBackend && !isLocalhost;

const TIME_SLOTS = [
  '8:00 AM – 10:00 AM',
  '10:00 AM – 12:00 PM',
  '1:00 PM – 3:00 PM',
  '4:00 PM – 6:00 PM',
  '7:00 PM – 9:00 PM'
];

const DELIVERY_INSTRUCTIONS = [
  'Hand over personally',
  'Leave at doorstep',
  'Contactless handover',
  'Call on arrival',
  'Drop with neighbor'
];

const AGENT_QUICK_REPLIES = [
  'Arrived at building entrance',
  'Coming up to your flat now',
  'Calling you for parcel handover',
  'Arriving in 10 minutes'
];

const RESIDENT_QUICK_REPLIES = [
  'Coming to the door now',
  'Please leave at doorstep',
  'Please call me on arrival',
  'Wait 5 minutes please'
];

const RESCHEDULE_REASONS = [
  'Not at home today',
  'Out of station',
  'Busy until tomorrow',
  'Prefer weekend delivery'
];

const RESIDENT_RULE_PRESETS = [
  'Always leave outside door after 8 PM',
  'Leave at doorstep',
  'Contactless handover',
  'Call on arrival',
  'Hand over personally'
];

const ISSUE_CATEGORIES = [
  'Damaged Box',
  'Wrong Item',
  'Never Received',
  'Left in Wrong Place',
  'Missing Contents'
];

const RATING_TAGS = [
  'Fast',
  'Polite',
  'Followed Instructions',
  'Safe Handling',
  'Careful Packaging'
];

function isWithinIssueWindow(parcel) {
  if (!parcel || parcel.status !== 'HANDED_OVER') return false;
  if (!parcel.handedOverAt) return true;
  const handedMs = new Date(parcel.handedOverAt).getTime();
  if (Number.isNaN(handedMs)) return true;
  return Date.now() - handedMs <= 7 * 24 * 60 * 60 * 1000;
}

function getIsoDateOffset(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDeliveryDate(isoDate) {
  if (!isoDate) return 'Today';
  if (isoDate === getIsoDateOffset(0)) return 'Today';
  if (isoDate === getIsoDateOffset(1)) return 'Tomorrow';
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const COURIERS = [
  { name: 'Amazon', color: '#ff9900' },
  { name: 'Flipkart', color: '#2874f0' },
  { name: 'Delhivery', color: '#d32f2f' },
  { name: 'BlueDart', color: '#002979' },
  { name: 'India Post', color: '#b71c1c' },
  { name: 'DTDC', color: '#e65100' },
  { name: 'Other', color: '#455a64' }
];

const CATEGORIES = ['Box', 'Fragile', 'Document', 'Electronics', 'Apparel', 'Perishable'];

export default function App() {
  // Current authenticated user (persisted in localStorage)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('smartparcel_user');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed.role === 'ROLE_SECURITY') {
      return { ...parsed, role: 'ROLE_DELIVERY_AGENT' };
    }
    return parsed;
  });

  // Auth Screen State
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    flatNumber: 'A-101',
    role: 'ROLE_RESIDENT'
  });
  const [showPassword, setShowPassword] = useState(false);

  // App State
  const [propertyTitle, setPropertyTitle] = useState(() => {
    return localStorage.getItem('smartparcel_society') || 'Palm Meadows Towers';
  });
  const [parcels, setParcels] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ text: '', type: 'info' });
  const [search, setSearch] = useState('');

  // Intake Form State (Delivery Agent)
  const [intakeForm, setIntakeForm] = useState({
    trackingNumber: '',
    courier: 'Amazon',
    flatNumber: 'A-101',
    recipientName: '',
    recipientPhone: '',
    category: 'Box',
    description: ''
  });

  // OTP Verification & Safe-Drop Proof state (Delivery Agent)
  const [otpInputs, setOtpInputs] = useState({});
  const [proofPhotos, setProofPhotos] = useState({});
  const [proofNotes, setProofNotes] = useState({});

  // Trusted Neighbors & Camera/Scanner Modals
  const [trustedNeighbors, setTrustedNeighbors] = useState([]);
  const [scannerModal, setScannerModal] = useState(null); // { mode: 'barcode' | 'pass-qr', targetParcelId?: number }
  const [photoModalParcel, setPhotoModalParcel] = useState(null);
  const [delegateParcel, setDelegateParcel] = useState(null);
  const [delegateForm, setDelegateForm] = useState({
    delegateFlat: '',
    delegateName: '',
    delegatePhone: '',
    note: ''
  });
  const [delegateBusy, setDelegateBusy] = useState(false);
  const [qrPassActivating, setQrPassActivating] = useState(false);
  const [routeQueue, setRouteQueue] = useState({
    totalActiveDrops: 0,
    totalStops: 0,
    totalHolds: 0,
    towerBatches: [],
    dropsByParcelId: {},
    routeStops: [],
    orderedParcelIds: []
  });

  // Resident Preferences & Vacation Mode
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const [prefsForm, setPrefsForm] = useState({
    defaultInstruction: '',
    defaultSlot: '',
    quietHoursEnabled: false,
    quietHoursStart: '20:00',
    quietHoursEnd: '07:00',
    vacationMode: false,
    vacationFrom: getIsoDateOffset(0),
    vacationUntil: getIsoDateOffset(2)
  });
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [flatHintPref, setFlatHintPref] = useState(null);

  // Post-Delivery Issue / Dispute Flag
  const [issueParcel, setIssueParcel] = useState(null);
  const [issueForm, setIssueForm] = useState({
    category: ISSUE_CATEGORIES[0],
    notes: '',
    photoUrl: ''
  });
  const [issueBusy, setIssueBusy] = useState(false);

  // 5-Star Delivery Rating & Agent Trust Score
  const [agentTrust, setAgentTrust] = useState({
    byAgentId: {},
    agents: [],
    overall: { averageRating: null, ratingCount: 0, completedDeliveries: 0, openIssues: 0 }
  });
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingModalParcel, setRatingModalParcel] = useState(null);

  // Admin & Operations Intelligence: SLA Alerts + Express Analytics
  const emptyOpsStats = () => ({
    total: 0,
    pending: 0,
    slotted: 0,
    rescheduled: 0,
    completed: 0,
    openIssues: 0,
    activeAtDesk: 0,
    courierShare: {},
    courierBreakdown: [],
    slotBreakdown: [],
    peakSlot: null,
    rescheduledFrequencyCount: 0,
    rescheduleRatePercent: 0,
    rescheduleReasons: [],
    avgHandoverMinutes: null,
    under15MinCount: 0,
    under15MinRatePercent: 0,
    agentSpeedLeaderboard: [],
    dailyTrends: [],
    hourlyArrivals: [],
    peakArrivalHour: null,
    slaSummary: {
      slaTargetMinutes: 240,
      under15mActive: 0,
      onTrackCount: 0,
      atRiskCount: 0,
      overdueCount: 0,
      totalAlertsCount: 0,
      escalatedCount: 0,
      overdueParcelIds: [],
      atRiskParcelIds: [],
      itemsByParcelId: {}
    }
  });
  const [opsStats, setOpsStats] = useState(emptyOpsStats);
  const [slaBusy, setSlaBusy] = useState(false);

  // Delivery Agent Confirmation of Resident Slot / Reschedule
  const [scheduleConfirmNotes, setScheduleConfirmNotes] = useState({});
  const [scheduleConfirmBusy, setScheduleConfirmBusy] = useState(false);

  // PWA Installability & Browser Push Notifications
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(() => isStandalonePwa());
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission());
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(() => {
    return localStorage.getItem('smartparcel_browser_alerts') !== 'false';
  });
  const seenNotifIdsRef = useRef(null);

  // Direct Delivery Agent <-> Resident Chat State
  const [msgSummaries, setMsgSummaries] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  // Reschedule Modal State
  const [rescheduleParcel, setRescheduleParcel] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    preferredDate: '',
    slot: TIME_SLOTS[3],
    reason: ''
  });
  const [rescheduleBusy, setRescheduleBusy] = useState(false);

  // Multi-Parcel Bundling
  const [bundleModalParcels, setBundleModalParcels] = useState(null);
  const [bundleForm, setBundleForm] = useState({
    slot: TIME_SLOTS[3],
    preferredDate: '',
    deliveryInstruction: ''
  });
  const [bundleBusy, setBundleBusy] = useState(false);

  // Reverse Pickup (Customer Returns)
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({
    courier: 'Amazon',
    flatNumber: '',
    recipientName: '',
    recipientPhone: '',
    returnReason: 'Size mismatch',
    originalTrackingNumber: '',
    slot: TIME_SLOTS[2],
    preferredDate: '',
    deliveryInstruction: 'Hand over return package to agent at doorstep'
  });
  const [returnBusy, setReturnBusy] = useState(false);

  // Slide-Over Drawer & Modals
  const [selectedParcelId, setSelectedParcelId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  function notify(text, type = 'info') {
    setNotice({ text, type });
    if (type !== 'error') {
      setTimeout(() => {
        setNotice(prev => (prev.text === text ? { text: '', type: 'info' } : prev));
      }, 5000);
    }
  }

  function syncParcelUpdated(updated) {
    if (!updated?.id) return;
    setParcels(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    setSelectedReceipt(prev => (prev && prev.id === updated.id ? updated : prev));
    setSelectedPass(prev => (prev && prev.id === updated.id ? updated : prev));
  }

  function processBrowserNotifications(notifList) {
    if (!Array.isArray(notifList)) return;
    if (seenNotifIdsRef.current === null) {
      seenNotifIdsRef.current = new Set(notifList.map(n => n.id));
      return;
    }
    const pushAllowed = browserAlertsEnabled && getNotificationPermission() === 'granted';
    for (const n of notifList) {
      if (!seenNotifIdsRef.current.has(n.id)) {
        seenNotifIdsRef.current.add(n.id);
        if (!n.read && pushAllowed) {
          dispatchPwaNotification({
            title: n.title || 'SmartParcel Update',
            body: n.message || '',
            tag: `smartparcel-notif-${n.id}`,
            parcelId: n.parcelId || null,
            requireInteraction: n.type === 'OTP_DISPATCHED' || n.type === 'PARCEL_ARRIVED'
          });
        }
      }
    }
  }

  async function request(url, method = 'GET', body) {
    // If running in static cloud preview mode (e.g. Vercel preview without a custom backend),
    // immediately serve via client-side mock engine to prevent 404 / 405 Method Not Allowed errors.
    if (isStaticPreviewMode) {
      return await handleMockApi(url, method, body);
    }

    let res;
    let networkFailed = false;
    try {
      res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (_) {
      networkFailed = true;
    }

    // Seamless fallback to client-side mock engine if remote backend is unreachable or returns an error status
    if (networkFailed || (res && !res.ok && (res.status === 404 || res.status === 405 || res.status === 502 || res.status === 504))) {
      try {
        return await handleMockApi(url, method, body);
      } catch (mockErr) {
        throw new Error(mockErr.message || 'Request failed');
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  }

  // Save auth user
  function handleLoginSuccess(userData) {
    seenNotifIdsRef.current = null;
    setUser(userData);
    localStorage.setItem('smartparcel_user', JSON.stringify(userData));
    notify(`Welcome to SmartParcel, ${userData.name}!`, 'success');
  }

  function handleLogout() {
    seenNotifIdsRef.current = null;
    setUser(null);
    localStorage.removeItem('smartparcel_user');
    setParcels([]);
    setSelectedParcelId(null);
    setDrawerOpen(false);
    setNotifications([]);
    setMsgSummaries({});
    setChatMessages([]);
    setTrustedNeighbors([]);
    setProofPhotos({});
    setProofNotes({});
    setSelectedPass(null);
    setSelectedReceipt(null);
    setDelegateParcel(null);
    setScannerModal(null);
    setPhotoModalParcel(null);
    setPrefsModalOpen(false);
    setIssueParcel(null);
    setFlatHintPref(null);
    setBundleModalParcels(null);
    setReturnModalOpen(false);
    setRatingDrafts({});
    setRatingModalParcel(null);
    setScheduleConfirmNotes({});
    setOpsStats(emptyOpsStats());
    setRouteQueue({
      totalActiveDrops: 0,
      totalStops: 0,
      totalHolds: 0,
      towerBatches: [],
      dropsByParcelId: {},
      routeStops: [],
      orderedParcelIds: []
    });
    notify('You have been logged out successfully.', 'info');
  }

  // Load Data
  async function loadData() {
    if (!user) return;
    setBusy(true);
    try {
      // 1. Load parcels (sorted by Block & Floor route for Delivery Agents)
      let q = '';
      let rq = '';
      if (user.role === 'ROLE_RESIDENT') {
        const flatParam = encodeURIComponent(user.flatNumber || '');
        q = `?role=RESIDENT&flatNumber=${flatParam}`;
        rq = `?role=RESIDENT&flatNumber=${flatParam}`;
      } else if (user.role === 'ROLE_DELIVERY_AGENT') {
        q = '?role=DELIVERY_AGENT&sort=route';
        rq = '?role=DELIVERY_AGENT';
      } else {
        q = '?role=ADMIN';
        rq = '?role=ADMIN';
      }
      const pData = await request(PARCELS_API + q);
      const safeParcels = Array.isArray(pData) ? pData : [];
      setParcels(safeParcels);
      maybeTriggerRatingPopup(safeParcels, user);

      // 2. Load Elevator Route Batching & Queue Position + Agent Trust Score
      const rQueue = await request(`${PARCELS_API}/route-queue${rq}`).catch(() => null);
      if (rQueue) setRouteQueue(rQueue);

      const trustData = await request(`${PARCELS_API}/agent-trust`).catch(() => null);
      if (trustData) setAgentTrust(trustData);

      if (user.role === 'ROLE_ADMIN' || user.role === 'ROLE_DELIVERY_AGENT') {
        const statsData = await request(`${PARCELS_API}/stats`).catch(() => null);
        if (statsData) setOpsStats(statsData);
      }

      // 3. Load Direct Message Summaries
      const mSummary = await request(`${PARCELS_API}/messages-summary`).catch(() => ({}));
      setMsgSummaries(mSummary || {});

      // 4. Load Notifications for current user
      const nData = await request(`${NOTIFS_API}?userId=${user.id}`).catch(() => []);
      const safeNotifs = Array.isArray(nData) ? nData : [];
      setNotifications(safeNotifs);
      processBrowserNotifications(safeNotifs);
      const uCount = await request(`${NOTIFS_API}/unread-count?userId=${user.id}`).catch(() => ({ count: 0 }));
      setUnreadCount(uCount.count || 0);

      // 5. Role-specific directory & preferences sync
      if (user.role === 'ROLE_ADMIN') {
        const uList = await request(`${AUTH_API}/users`).catch(() => []);
        setRegisteredUsers(Array.isArray(uList) ? uList : []);
      } else if (user.role === 'ROLE_RESIDENT') {
        const neighbors = await request(
          `${AUTH_API}/neighbors?excludeFlat=${encodeURIComponent(user.flatNumber || '')}`
        ).catch(() => []);
        setTrustedNeighbors(Array.isArray(neighbors) ? neighbors : []);
        const freshPrefs = await request(`${AUTH_API}/users/${user.id}/preferences`).catch(() => null);
        if (freshPrefs) {
          setUser(prev => {
            if (!prev) return prev;
            const merged = {
              ...prev,
              defaultInstruction: freshPrefs.defaultInstruction ?? null,
              defaultSlot: freshPrefs.defaultSlot ?? null,
              quietHoursEnabled: Boolean(freshPrefs.quietHoursEnabled),
              quietHoursStart: freshPrefs.quietHoursStart ?? null,
              quietHoursEnd: freshPrefs.quietHoursEnd ?? null,
              vacationMode: Boolean(freshPrefs.vacationMode),
              vacationFrom: freshPrefs.vacationFrom ?? null,
              vacationUntil: freshPrefs.vacationUntil ?? null
            };
            localStorage.setItem('smartparcel_user', JSON.stringify(merged));
            return merged;
          });
        }
      }
    } catch (err) {
      notify('Connection error: ' + err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [user]);

  // AUTH ACTIONS
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (authMode === 'login') {
        const res = await request(`${AUTH_API}/login`, 'POST', {
          email: authForm.email,
          password: authForm.password
        });
        handleLoginSuccess(res.user);
      } else {
        const res = await request(`${AUTH_API}/register`, 'POST', authForm);
        handleLoginSuccess(res.user);
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // Quick 1-click Demo Account Logins
  async function handleQuickLogin(email, password) {
    setBusy(true);
    try {
      const res = await request(`${AUTH_API}/login`, 'POST', { email, password });
      handleLoginSuccess(res.user);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // Notification read
  async function handleMarkAllNotificationsRead() {
    if (!user) return;
    try {
      await request(`${NOTIFS_API}/read-all?userId=${user.id}`, 'PATCH');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleNotificationClick(notif) {
    if (!notif.read) {
      await request(`${NOTIFS_API}/${notif.id}/read`, 'PATCH').catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    }
    if (notif.parcelId) {
      const linked = parcels.find(p => p.id === notif.parcelId);
      if (linked) {
        setNotifDrawerOpen(false);
        if (user?.role === 'ROLE_RESIDENT' && linked.status === 'HANDED_OVER' && !linked.deliveryRating) {
          setRatingModalParcel(linked);
        } else {
          setSelectedParcelId(linked.id);
          setDrawerOpen(true);
        }
      }
    }
  }

  // DIRECT CHAT & INSTRUCTIONS
  async function handleSendChatMessage(textOverride, parcelOverride) {
    const targetParcel = parcelOverride;
    if (!targetParcel || !user) return;
    const messageText = (typeof textOverride === 'string' ? textOverride : chatInput).trim();
    if (!messageText) return;

    setChatBusy(true);
    try {
      const saved = await request(`${PARCELS_API}/${targetParcel.id}/messages`, 'POST', {
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        message: messageText
      });
      setChatMessages(prev => [...prev, saved]);
      if (typeof textOverride !== 'string') setChatInput('');
      const mSummary = await request(`${PARCELS_API}/messages-summary`).catch(() => null);
      if (mSummary) setMsgSummaries(mSummary);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setChatBusy(false);
    }
  }

  async function handleSetInstruction(parcel, instruction) {
    try {
      const updated = await request(`${PARCELS_API}/${parcel.id}/instruction`, 'PATCH', {
        instruction,
        residentName: user?.name || 'Resident'
      });
      setParcels(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      notify(`Instruction "${instruction}" shared directly with your Delivery Agent.`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  // PARCEL OPERATIONS
  function handleGenerateTracking() {
    const prefix = intakeForm.courier.slice(0, 3).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setIntakeForm(prev => ({ ...prev, trackingNumber: `${prefix}-${randomNum}` }));
  }

  async function handleRegisterParcel(e) {
    e.preventDefault();
    if (!intakeForm.trackingNumber) {
      notify('Please enter or generate a tracking number.', 'error');
      return false;
    }
    try {
      const payload = {
        ...intakeForm,
        agentId: user?.id || null,
        agentName: user?.name || null,
        agentPhone: user?.phone || null
      };
      const created = await request(PARCELS_API, 'POST', payload);
      if (created?.id) {
        setSelectedParcelId(created.id);
      }
      if (created?.status === 'RESCHEDULED') {
        notify(
          `Flat ${intakeForm.flatNumber} has Vacation Mode active — parcel auto-held until ${formatDeliveryDate(created.preferredDate)}.`,
          'info'
        );
      } else {
        notify(`Arrival alert & chat sent directly to Flat ${intakeForm.flatNumber} resident!`, 'success');
      }
      setIntakeForm({
        trackingNumber: '',
        courier: intakeForm.courier,
        flatNumber: 'A-101',
        recipientName: '',
        recipientPhone: '',
        category: 'Box',
        description: ''
      });
      loadData();
      return true;
    } catch (err) {
      notify(err.message, 'error');
      return false;
    }
  }

  async function handleBookSlot(parcel, slot) {
    try {
      await request(`${PARCELS_API}/${parcel.id}/slot`, 'PATCH', {
        slot,
        preferredDate: getIsoDateOffset(0)
      });
      notify(`Today's window "${slot}" shared directly with your Delivery Agent.`, 'success');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  function openRescheduleModal(parcel) {
    if (parcel.rescheduledOnce || parcel.status === 'RESCHEDULED') {
      notify('Only one reschedule is allowed per parcel. Delivery schedule is already finalized.', 'error');
      return;
    }
    const tomorrow = getIsoDateOffset(1);
    const initialDate = parcel.preferredDate && parcel.preferredDate > getIsoDateOffset(0)
      ? parcel.preferredDate
      : tomorrow;
    setRescheduleParcel(parcel);
    setRescheduleForm({
      preferredDate: initialDate,
      slot: parcel.slot || TIME_SLOTS[3],
      reason: parcel.rescheduleReason || ''
    });
  }

  async function handleRescheduleSubmit(e) {
    e.preventDefault();
    if (!rescheduleParcel || !rescheduleForm.preferredDate || !rescheduleForm.slot) return;
    setRescheduleBusy(true);
    try {
      await request(`${PARCELS_API}/${rescheduleParcel.id}/reschedule`, 'PATCH', {
        preferredDate: rescheduleForm.preferredDate,
        slot: rescheduleForm.slot,
        reason: rescheduleForm.reason
      });
      notify(
        `Delivery rescheduled to ${formatDeliveryDate(rescheduleForm.preferredDate)} (${rescheduleForm.slot}). Delivery Agent alerted.`,
        'success'
      );
      setRescheduleParcel(null);
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setRescheduleBusy(false);
    }
  }

  // Resident can activate live QR pickup pass if agent has not sent OTP yet
  async function handleActivatePassQr(parcel) {
    if (!parcel) return;
    setQrPassActivating(true);
    try {
      const data = await request(`${PARCELS_API}/${parcel.id}/generate-otp`, 'POST');
      if (data.demoOtp) {
        setSelectedPass(prev => (prev && prev.id === parcel.id ? { ...prev, demoOtp: data.demoOtp } : prev));
        setParcels(prev => prev.map(p => (p.id === parcel.id ? { ...p, demoOtp: data.demoOtp } : p)));
      }
      notify('Live scannable Pickup QR Pass is ready for handover!', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setQrPassActivating(false);
    }
  }

  // Resident Delegate Authorization ("Pass to Neighbor / Family")
  function openDelegateModal(parcel) {
    const firstNeighbor = trustedNeighbors[0];
    setDelegateParcel(parcel);
    setDelegateForm({
      delegateFlat: parcel.delegateFlat || firstNeighbor?.flatNumber || '',
      delegateName: parcel.delegateName || firstNeighbor?.name || '',
      delegatePhone: parcel.delegatePhone || firstNeighbor?.phone || '',
      note: ''
    });
  }

  async function handleAuthorizeDelegate(e) {
    e.preventDefault();
    if (!delegateParcel) return;
    setDelegateBusy(true);
    try {
      const updated = await request(`${PARCELS_API}/${delegateParcel.id}/delegate`, 'POST', delegateForm);
      notify(
        `Authorized ${updated.delegateName} (Flat ${updated.delegateFlat}). Delegate OTP ${updated.delegateOtp} issued & alerts sent!`,
        'success'
      );
      setDelegateParcel(null);
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDelegateBusy(false);
    }
  }

  async function handleRevokeDelegate(parcel) {
    if (!window.confirm(`Revoke neighbor delegate pass for ${parcel.delegateName} (Flat ${parcel.delegateFlat})?`)) return;
    try {
      await request(`${PARCELS_API}/${parcel.id}/delegate`, 'DELETE');
      notify('Neighbor delegate authorization cancelled.', 'info');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  function openScannerModal(mode, targetParcelId = null) {
    setScannerModal({ mode, targetParcelId });
  }

  function openPhotoModal(parcel) {
    setPhotoModalParcel(parcel);
  }

  async function handleScannerDetected(rawText) {
    if (!scannerModal) return;
    const mode = scannerModal.mode;
    const targetHintId = scannerModal.targetParcelId;
    const parsed = parseScannedScanResult(rawText, mode);

    if (mode === 'barcode') {
      setScannerModal(null);
      if (!parsed.valid || !parsed.trackingNumber) {
        notify('Could not extract a tracking code from scan.', 'error');
        return;
      }
      setIntakeForm(prev => ({ ...prev, trackingNumber: parsed.trackingNumber }));
      notify(`Scanned parcel tracking ID: ${parsed.trackingNumber}`, 'success');
      return;
    }

    // Master Bundle QR Scan
    if (parsed.kind === 'BUNDLE_QR' && parsed.bundleCode) {
      setScannerModal(null);
      const bundledList = parcels.filter(p => p.bundleCode === parsed.bundleCode);
      if (bundledList.length === 0) {
        notify(`Scanned Master Bundle ${parsed.bundleCode}, but no matching parcels were found.`, 'error');
        return;
      }
      notify(`Master Bundle QR detected (${parsed.bundleCode})! Auto-verifying handover...`, 'info');
      await handleBundleHandover({
        bundleCode: parsed.bundleCode,
        otp: parsed.otp,
        verifiedMethod: 'MASTER_QR',
        agentName: user?.name
      });
      return;
    }

    // Pass QR scanning for automatic OTP verification
    const targetParcel =
      (parsed.parcelId && parcels.find(p => p.id === parsed.parcelId)) ||
      (parsed.trackingNumber && parcels.find(p => p.trackingNumber.toUpperCase() === parsed.trackingNumber)) ||
      (targetHintId && parcels.find(p => p.id === targetHintId));

    if (!targetParcel) {
      notify('Scanned pass does not match an active parcel in your queue.', 'error');
      setScannerModal(null);
      return;
    }

    // Return Pickup QR Auto-Verification
    if (targetParcel.returnPickup) {
      setScannerModal(null);
      notify(`Scanned Reverse Handover QR for return ${targetParcel.trackingNumber}. Auto-verifying collection...`, 'info');
      await handleConfirmReturnPickup(targetParcel, parsed.otp, 'QR_SCAN');
      return;
    }

    setScannerModal(null);
    setSelectedParcelId(targetParcel.id);
    setDrawerOpen(true);

    if (!parsed.otp || parsed.otp.length !== 6) {
      notify(`Matched parcel ${targetParcel.trackingNumber}, but no 6-digit OTP was inside the QR.`, 'info');
      return;
    }

    setOtpInputs(prev => ({ ...prev, [targetParcel.id]: parsed.otp }));

    if (isSafeDropInstruction(targetParcel.deliveryInstruction) && !proofPhotos[targetParcel.id]) {
      notify(
        `QR Pass matched ${targetParcel.trackingNumber} (OTP ${parsed.otp}). Capture doorstep Safe-Drop photo to complete handover.`,
        'info'
      );
      return;
    }

    await handleVerifyHandover(targetParcel, parsed.otp, 'QR_SCAN');
  }

  // Delivery Agent triggers OTP dispatch to resident
  async function handleRequestOtp(parcel) {
    try {
      const data = await request(`${PARCELS_API}/${parcel.id}/generate-otp`, 'POST');
      notify(`Handover OTP dispatched directly to Flat ${parcel.flatNumber} resident.`, 'success');
      if (data.demoOtp) {
        setOtpInputs(prev => ({ ...prev, [parcel.id]: data.demoOtp }));
      }
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  // Delivery Agent confirms handover with OTP + optional/required Safe-Drop photo proof
  async function handleVerifyHandover(parcel, otpOverride = null, verificationSource = 'MANUAL_OTP') {
    const otp = (otpOverride ?? otpInputs[parcel.id] ?? '').trim();
    if (!otp || otp.length !== 6) {
      notify('Please enter the 6-digit OTP shared by the resident or authorized neighbor.', 'error');
      return;
    }
    try {
      const res = await request(`${PARCELS_API}/${parcel.id}/handover`, 'POST', {
        otp,
        proofPhotoUrl: proofPhotos[parcel.id] || null,
        proofNote: proofNotes[parcel.id] || null,
        verificationSource
      });
      notify(
        `Handover verified (${res.verifiedMethod || 'OTP'})! Parcel ${parcel.trackingNumber} marked delivered.`,
        'success'
      );
      setOtpInputs(prev => {
        const next = { ...prev };
        delete next[parcel.id];
        return next;
      });
      setProofPhotos(prev => {
        const next = { ...prev };
        delete next[parcel.id];
        return next;
      });
      setProofNotes(prev => {
        const next = { ...prev };
        delete next[parcel.id];
        return next;
      });
      loadData();
      setSelectedReceipt(
        res.parcel || {
          ...parcel,
          status: 'HANDED_OVER',
          handedOverAt: res.handedOverAt || new Date().toISOString(),
          verifiedMethod: res.verifiedMethod,
          handedOverTo: res.handedOverTo,
          proofPhotoUrl: proofPhotos[parcel.id] || null,
          proofNote: proofNotes[parcel.id] || null
        }
      );
    } catch (err) {
      notify(err.message, 'error');
      setSelectedParcelId(parcel.id);
      setDrawerOpen(true);
    }
  }

  async function handleDeleteParcel(parcel) {
    if (!window.confirm(`Delete record for tracking #${parcel.trackingNumber}?`)) return;
    try {
      await request(`${PARCELS_API}/${parcel.id}`, 'DELETE');
      notify(`Parcel ${parcel.trackingNumber} deleted.`, 'info');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleToggleUserActive(targetUser) {
    try {
      await request(`${AUTH_API}/users/${targetUser.id}/toggle-active`, 'PATCH');
      notify(`User ${targetUser.name} active status updated.`, 'success');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleDeleteUser(targetUser) {
    if (!window.confirm(`Delete account for ${targetUser.name} (${targetUser.email})?`)) return;
    try {
      await request(`${AUTH_API}/users/${targetUser.id}`, 'DELETE');
      notify(`User ${targetUser.name} deleted.`, 'info');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function handleSeedDemoData() {
    try {
      setBusy(true);
      const res = await request(`${PARCELS_API}/seed`, 'POST');
      notify(res.message || 'Demo data loaded successfully!', 'success');
      loadData();
    } catch (err) {
      notify('Failed to seed: ' + err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // Resident Default Preferences & Vacation Mode Handlers
  function openPreferencesModal() {
    if (!user) return;
    setPrefsForm({
      defaultInstruction: user.defaultInstruction || '',
      defaultSlot: user.defaultSlot || '',
      quietHoursEnabled: Boolean(user.quietHoursEnabled),
      quietHoursStart: user.quietHoursStart || '20:00',
      quietHoursEnd: user.quietHoursEnd || '07:00',
      vacationMode: Boolean(user.vacationMode),
      vacationFrom: user.vacationFrom || getIsoDateOffset(0),
      vacationUntil: user.vacationUntil || getIsoDateOffset(2)
    });
    setPrefsModalOpen(true);
  }

  async function handleSavePreferences(e) {
    e.preventDefault();
    if (!user) return;
    setPrefsBusy(true);
    try {
      const payload = {
        defaultInstruction: prefsForm.defaultInstruction,
        defaultSlot: prefsForm.defaultSlot,
        quietHoursEnabled: Boolean(prefsForm.quietHoursEnabled),
        quietHoursStart: prefsForm.quietHoursStart,
        quietHoursEnd: prefsForm.quietHoursEnd,
        vacationMode: Boolean(prefsForm.vacationMode),
        vacationFrom: prefsForm.vacationMode ? prefsForm.vacationFrom : null,
        vacationUntil: prefsForm.vacationMode ? prefsForm.vacationUntil : null
      };
      const res = await request(`${AUTH_API}/users/${user.id}/preferences`, 'PUT', payload);
      if (res.user) {
        setUser(res.user);
        localStorage.setItem('smartparcel_user', JSON.stringify(res.user));
      }
      setPrefsModalOpen(false);
      notify(res.message || 'Preferences saved!', 'success');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setPrefsBusy(false);
    }
  }

  // Post-Delivery Issue / Dispute Handlers
  function openIssueModal(parcel) {
    if (!parcel) return;
    setIssueParcel(parcel);
    setIssueForm({
      category: ISSUE_CATEGORIES[0],
      notes: '',
      photoUrl: ''
    });
  }

  async function handleSubmitIssue(e) {
    e.preventDefault();
    if (!issueParcel || !issueForm.notes.trim()) return;
    setIssueBusy(true);
    try {
      const updated = await request(`${PARCELS_API}/${issueParcel.id}/issue`, 'POST', {
        category: issueForm.category,
        notes: issueForm.notes.trim(),
        photoUrl: issueForm.photoUrl || null,
        reportedBy: user?.name || 'Resident'
      });
      syncParcelUpdated(updated);
      setIssueParcel(null);
      notify(`Dispute "${updated.issueCategory}" logged and synced to Agent & Admin audit view.`, 'success');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setIssueBusy(false);
    }
  }

  async function handleResolveIssue(parcel, nextStatus = 'RESOLVED', resolutionNote = '') {
    if (!parcel) return;
    setIssueBusy(true);
    try {
      const updated = await request(`${PARCELS_API}/${parcel.id}/issue/resolve`, 'PATCH', {
        status: nextStatus,
        resolutionNote: resolutionNote?.trim() || (nextStatus === 'RESOLVED' ? 'Verified & resolved in SmartParcel audit' : 'Under agent & admin review'),
        resolvedBy: user?.name || 'SmartParcel Audit'
      });
      syncParcelUpdated(updated);
      notify(
        nextStatus === 'RESOLVED'
          ? `Dispute on ${parcel.trackingNumber} marked Resolved.`
          : `Dispute on ${parcel.trackingNumber} marked Investigating.`,
        'success'
      );
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setIssueBusy(false);
    }
  }

  // Post-Delivery Rating Popup Helpers (appears as popup/notification prompt once delivered, not static on page)
  function getPromptedRatingSet(userId) {
    if (!userId) return new Set();
    try {
      const raw = localStorage.getItem(`smartparcel_rating_prompted_${userId}`);
      return new Set(Array.isArray(JSON.parse(raw)) ? JSON.parse(raw).map(String) : []);
    } catch {
      return new Set();
    }
  }

  function markRatingPrompted(userId, parcelId) {
    if (!userId || !parcelId) return;
    const set = getPromptedRatingSet(userId);
    set.add(String(parcelId));
    try {
      localStorage.setItem(`smartparcel_rating_prompted_${userId}`, JSON.stringify([...set]));
    } catch {}
  }

  function maybeTriggerRatingPopup(parcelList, activeUser) {
    if (!activeUser || activeUser.role !== 'ROLE_RESIDENT' || !Array.isArray(parcelList)) return;
    const prompted = getPromptedRatingSet(activeUser.id);
    const pendingToRate = parcelList.find(
      p => p.status === 'HANDED_OVER' && !p.deliveryRating && !prompted.has(String(p.id))
    );
    if (pendingToRate) {
      markRatingPrompted(activeUser.id, pendingToRate.id);
      setRatingModalParcel(prev => prev || pendingToRate);
    }
  }

  function dismissRatingModal() {
    if (ratingModalParcel?.id && user?.id) {
      markRatingPrompted(user.id, ratingModalParcel.id);
    }
    setRatingModalParcel(null);
  }

  // 5-Star Delivery Rating Handler
  async function handleRateDelivery(parcel, ratingVal, tagsList = [], commentText = '') {
    if (!parcel || !ratingVal) return;
    setRatingBusy(true);
    try {
      const res = await request(`${PARCELS_API}/${parcel.id}/rate`, 'POST', {
        rating: ratingVal,
        tags: tagsList,
        comment: commentText?.trim() || null
      });
      markRatingPrompted(user?.id, parcel.id);
      setRatingModalParcel(prev => (prev && prev.id === parcel.id ? null : prev));
      if (res.parcel) {
        syncParcelUpdated(res.parcel);
      }
      if (res.agentTrust) {
        setAgentTrust(res.agentTrust);
      }
      notify(`Thank you! Rated ${ratingVal}★ for delivery ${parcel.trackingNumber}.`, 'success');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setRatingBusy(false);
    }
  }

  // PWA Install & Browser Push Notification Handlers
  async function handleInstallApp() {
    if (installPromptEvent) {
      try {
        installPromptEvent.prompt();
        const choice = await installPromptEvent.userChoice;
        if (choice?.outcome === 'accepted') {
          setIsPwaInstalled(true);
          notify('SmartParcel installed on your device!', 'success');
        }
        setInstallPromptEvent(null);
      } catch (err) {
        setInstallHelpOpen(true);
      }
      return;
    }
    setInstallHelpOpen(true);
  }

  async function handleToggleBrowserAlerts() {
    const current = getNotificationPermission();
    setNotifPermission(current);
    if (current === 'unsupported') {
      notify('This browser does not support desktop/mobile push notifications.', 'info');
      return;
    }
    if (current === 'denied') {
      notify('Browser notifications are blocked in your site settings. Allow notifications to receive background OTP alerts.', 'error');
      return;
    }
    if (current === 'default') {
      const result = await requestBrowserNotificationPermission();
      setNotifPermission(result);
      if (result === 'granted') {
        setBrowserAlertsEnabled(true);
        localStorage.setItem('smartparcel_browser_alerts', 'true');
        await dispatchPwaNotification({
          title: 'SmartParcel Alerts Active',
          body: 'Parcel arrivals & private handover OTPs will notify you even when minimized.'
        });
        notify('Browser push alerts enabled! Background OTP alerts are active.', 'success');
      } else {
        notify('Permission not granted for push notifications.', 'info');
      }
      return;
    }
    const nextEnabled = !browserAlertsEnabled;
    setBrowserAlertsEnabled(nextEnabled);
    localStorage.setItem('smartparcel_browser_alerts', nextEnabled ? 'true' : 'false');
    notify(nextEnabled ? 'Browser push alerts enabled.' : 'Browser push alerts muted.', 'info');
  }

  async function handleSendTestPush() {
    let perm = getNotificationPermission();
    if (perm === 'default') {
      perm = await requestBrowserNotificationPermission();
      setNotifPermission(perm);
    }
    if (perm !== 'granted') {
      notify('Allow notifications in browser first to test background alerts.', 'error');
      return;
    }
    setBrowserAlertsEnabled(true);
    localStorage.setItem('smartparcel_browser_alerts', 'true');
    const ok = await dispatchPwaNotification({
      title: 'SmartParcel Express · Sample OTP Alert',
      body: 'Amazon AMZ-8201 arrived at Flat ' + (user?.flatNumber || 'A-101') + ' · Private OTP: 482910',
      tag: 'smartparcel-test-' + Date.now()
    });
    if (ok) {
      notify('Test browser push notification sent via Service Worker!', 'success');
    } else {
      notify('Unable to dispatch Service Worker notification in this browser window.', 'info');
    }
  }

  async function handleEscalateSla(parcel) {
    if (!parcel?.id || !user) return;
    setSlaBusy(true);
    try {
      const actor = encodeURIComponent(user.name || 'Ops Supervisor');
      const res = await request(`${PARCELS_API}/${parcel.id}/escalate-sla?actorName=${actor}`, 'POST');
      notify(res?.message || `SLA alert dispatched for #${parcel.trackingNumber}.`, 'success');
      await loadData();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSlaBusy(false);
    }
  }

  async function handleEscalateAllOverdue() {
    if (!user) return;
    setSlaBusy(true);
    try {
      const actor = encodeURIComponent(user.name || 'Ops Supervisor');
      const res = await request(`${PARCELS_API}/escalate-overdue?actorName=${actor}`, 'POST');
      notify(res?.message || 'Overdue SLA alerts escalated.', 'success');
      await loadData();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSlaBusy(false);
    }
  }

  async function handleConfirmSchedule(parcel, customMessage) {
    if (!parcel?.id || !user) return;
    setScheduleConfirmBusy(true);
    try {
      const noteText =
        customMessage !== undefined
          ? String(customMessage)
          : (scheduleConfirmNotes[parcel.id] || '');
      const res = await request(`${PARCELS_API}/${parcel.id}/confirm-schedule`, 'POST', {
        agentName: user.name,
        message: noteText.trim() || null
      });
      if (res?.parcel) {
        syncParcelUpdated(res.parcel);
      }
      setScheduleConfirmNotes(prev => {
        const next = { ...prev };
        delete next[parcel.id];
        return next;
      });
      notify(res?.message || `Confirmation sent to Flat ${parcel.flatNumber} resident.`, 'success');
      await loadData();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setScheduleConfirmBusy(false);
    }
  }

  // Multi-Parcel Bundling Handlers
  function openBundleModal(parcelsToBundle) {
    if (!parcelsToBundle || parcelsToBundle.length < 2) {
      notify('Select at least 2 parcels to bundle into 1 delivery.', 'info');
      return;
    }
    const sample = parcelsToBundle[0];
    setBundleModalParcels(parcelsToBundle);
    setBundleForm({
      slot: sample.slot || TIME_SLOTS[3],
      preferredDate: sample.preferredDate || getIsoDateOffset(0),
      deliveryInstruction: sample.deliveryInstruction || ''
    });
  }

  async function handleBundleSubmit(e) {
    e.preventDefault();
    if (!bundleModalParcels || bundleModalParcels.length < 2) return;
    setBundleBusy(true);
    try {
      const flat = user?.flatNumber || bundleModalParcels[0]?.flatNumber;
      const res = await request(`${PARCELS_API}/bundle`, 'POST', {
        flatNumber: flat,
        parcelIds: bundleModalParcels.map(p => p.id),
        slot: bundleForm.slot,
        preferredDate: bundleForm.preferredDate,
        deliveryInstruction: bundleForm.deliveryInstruction
      });
      notify(
        `Grouped ${res.bundleSize} parcels under Master Pass (${res.bundleCode})! Single Master OTP: ${res.masterOtp}.`,
        'success'
      );
      setBundleModalParcels(null);
      await loadData();
      if (res.parcels && res.parcels.length > 0) {
        setSelectedPass(res.parcels[0]);
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBundleBusy(false);
    }
  }

  async function handleBundleHandover({ bundleCode, otp, proofPhotoUrl, proofNote, verifiedMethod = 'MASTER_OTP', agentName }) {
    if (!bundleCode) return;
    setBundleBusy(true);
    try {
      const res = await request(`${PARCELS_API}/bundle-handover`, 'POST', {
        bundleCode,
        otp: otp?.trim() || null,
        proofPhotoUrl: proofPhotoUrl || null,
        proofNote: proofNote || null,
        verifiedMethod,
        agentName: agentName || user?.name || 'Delivery Partner'
      });
      notify(
        `Master Handover completed! All ${res.count} parcels marked delivered via ${res.verifiedMethod}.`,
        'success'
      );
      setDrawerOpen(false);
      await loadData();
      if (res.parcels && res.parcels.length > 0) {
        setSelectedReceipt(res.parcels[0]);
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBundleBusy(false);
    }
  }

  // Reverse Pickup (Customer Returns) Handlers
  function openReturnModal(prefillParcel = null) {
    const defaultCourier = typeof COURIERS[0] === 'string' ? COURIERS[0] : COURIERS[0]?.name || 'Amazon';
    setReturnForm({
      courier: prefillParcel?.courier || defaultCourier,
      flatNumber: user?.flatNumber || prefillParcel?.flatNumber || '101',
      recipientName: user?.name || prefillParcel?.recipientName || 'Resident',
      recipientPhone: user?.phone || prefillParcel?.recipientPhone || '',
      returnReason: 'Size mismatch',
      originalTrackingNumber: prefillParcel?.trackingNumber || '',
      slot: TIME_SLOTS[2] || '1:00 PM – 3:00 PM',
      preferredDate: getIsoDateOffset(0),
      deliveryInstruction: 'Hand over return package to agent at doorstep'
    });
    setReturnModalOpen(true);
  }

  async function handleScheduleReturnSubmit(e) {
    e.preventDefault();
    const courier = typeof returnForm.courier === 'string' ? returnForm.courier.trim() : returnForm.courier?.name || 'Amazon';
    const flat = (returnForm.flatNumber || user?.flatNumber || '101').toString().trim().toUpperCase();
    if (!courier || !flat) {
      notify('Courier partner and flat number are required.', 'error');
      return;
    }
    setReturnBusy(true);
    try {
      const payload = {
        ...returnForm,
        courier,
        flatNumber: flat,
        preferredDate: returnForm.preferredDate || getIsoDateOffset(0),
        slot: returnForm.slot || TIME_SLOTS[2] || '1:00 PM – 3:00 PM'
      };
      const created = await request(`${PARCELS_API}/return-pickup`, 'POST', payload);
      notify(
        `Return pickup scheduled for ${created.courier} (Return ID: ${created.trackingNumber})! Reverse OTP: ${created.returnOtp || created.demoOtp}`,
        'success'
      );
      setReturnModalOpen(false);
      await loadData();
      setSelectedPass(created);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setReturnBusy(false);
    }
  }

  async function handleConfirmReturnPickup(parcel, otpOverride = null, verificationSource = 'MANUAL_OTP') {
    if (!parcel?.id) return;
    const otp = (otpOverride ?? otpInputs[parcel.id] ?? '').trim();
    if (!otp && verificationSource !== 'QR_SCAN') {
      notify('Please enter the 6-digit Reverse-Handover OTP from resident.', 'error');
      return;
    }
    setReturnBusy(true);
    try {
      const res = await request(`${PARCELS_API}/${parcel.id}/confirm-return-pickup`, 'POST', {
        otp,
        proofPhotoUrl: proofPhotos[parcel.id] || null,
        proofNote: proofNotes[parcel.id] || null,
        verificationSource
      });
      notify(
        `Return parcel collected for ${parcel.courier}! Marked picked up via ${res.verifiedMethod}.`,
        'success'
      );
      setDrawerOpen(false);
      await loadData();
      if (res.parcel) {
        setSelectedReceipt(res.parcel);
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setReturnBusy(false);
    }
  }

  function handleExportCsv() {
    if (parcels.length === 0) {
      notify('No parcels available to export.', 'info');
      return;
    }
    const headers = ['ID', 'Tracking Number', 'Courier', 'Flat', 'Recipient Name', 'Phone', 'Category', 'Status', 'Preferred Date', 'Slot', 'Reschedule Reason', 'Rating', 'Rating Tags', 'Issue Category', 'Issue Status', 'Received At', 'Handed Over At'];
    const rows = parcels.map(p => [
      p.id,
      p.trackingNumber,
      p.courier,
      p.flatNumber,
      `"${p.recipientName || ''}"`,
      `"${p.recipientPhone || ''}"`,
      p.category || 'Box',
      p.status,
      `"${p.preferredDate || ''}"`,
      `"${p.slot || ''}"`,
      `"${p.rescheduleReason || ''}"`,
      p.deliveryRating || '',
      `"${p.ratingTags || ''}"`,
      `"${p.issueCategory || ''}"`,
      `"${p.issueStatus || ''}"`,
      `"${p.receivedAt || ''}"`,
      `"${p.handedOverAt || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartparcel_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Society parcel audit log downloaded as CSV.', 'success');
  }

  // PWA Installability & Service Worker Notification Click Listener
  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setInstallPromptEvent(e);
    }
    function onAppInstalled() {
      setInstallPromptEvent(null);
      setIsPwaInstalled(true);
    }
    function onSwMessage(event) {
      if (event?.data?.type === 'OPEN_PARCEL' && event.data.parcelId) {
        setSelectedParcelId(event.data.parcelId);
        setDrawerOpen(true);
      }
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    navigator.serviceWorker?.addEventListener?.('message', onSwMessage);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      navigator.serviceWorker?.removeEventListener?.('message', onSwMessage);
    };
  }, []);

  // Agent Dispatch: Look up Resident Default Doorstep Rule & Vacation Mode for typed Flat
  useEffect(() => {
    if (!user || user.role !== 'ROLE_DELIVERY_AGENT') {
      setFlatHintPref(null);
      return;
    }
    const cleanFlat = (intakeForm.flatNumber || '').trim();
    if (cleanFlat.length < 2) {
      setFlatHintPref(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      request(`${AUTH_API}/flat-preferences?flatNumber=${encodeURIComponent(cleanFlat)}`)
        .then(data => {
          if (!cancelled) setFlatHintPref(data);
        })
        .catch(() => {
          if (!cancelled) setFlatHintPref(null);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, intakeForm.flatNumber]);

  // Load live chat messages when opening Slide-Over Drawer in Express Pass UX
  useEffect(() => {
    if (!user || !drawerOpen || !selectedParcelId) return;
    let cancelled = false;
    setChatBusy(true);
    request(`${PARCELS_API}/${selectedParcelId}/messages`)
      .then(msgs => {
        if (!cancelled) setChatMessages(Array.isArray(msgs) ? msgs : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChatBusy(false);
      });
    return () => { cancelled = true; };
  }, [user, drawerOpen, selectedParcelId]);

  // Periodic polling for notifications, background PWA alerts, trust score & chat
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const nData = await request(`${NOTIFS_API}?userId=${user.id}`);
        const safeNotifs = Array.isArray(nData) ? nData : [];
        setNotifications(safeNotifs);
        processBrowserNotifications(safeNotifs);
        if (user.role === 'ROLE_RESIDENT') {
          const flatParam = encodeURIComponent(user.flatNumber || '');
          const pData = await request(`${PARCELS_API}?role=RESIDENT&flatNumber=${flatParam}`).catch(() => null);
          if (Array.isArray(pData)) {
            setParcels(pData);
            maybeTriggerRatingPopup(pData, user);
          }
        } else if (user.role === 'ROLE_DELIVERY_AGENT') {
          const pData = await request(`${PARCELS_API}?role=DELIVERY_AGENT&sort=route`).catch(() => null);
          if (Array.isArray(pData)) setParcels(pData);
        }
        const uCount = await request(`${NOTIFS_API}/unread-count?userId=${user.id}`);
        setUnreadCount(uCount.count || 0);
        const mSummary = await request(`${PARCELS_API}/messages-summary`).catch(() => null);
        if (mSummary) setMsgSummaries(mSummary);
        const rqUrl = user.role === 'ROLE_RESIDENT'
          ? `${PARCELS_API}/route-queue?role=RESIDENT&flatNumber=${encodeURIComponent(user.flatNumber || '')}`
          : `${PARCELS_API}/route-queue?role=DELIVERY_AGENT`;
        const rQueue = await request(rqUrl).catch(() => null);
        if (rQueue) setRouteQueue(rQueue);
        const trustData = await request(`${PARCELS_API}/agent-trust`).catch(() => null);
        if (trustData) setAgentTrust(trustData);
        if (user.role === 'ROLE_ADMIN' || user.role === 'ROLE_DELIVERY_AGENT') {
          const statsData = await request(`${PARCELS_API}/stats`).catch(() => null);
          if (statsData) setOpsStats(statsData);
        }
        if (drawerOpen && selectedParcelId) {
          const msgs = await request(`${PARCELS_API}/${selectedParcelId}/messages`).catch(() => null);
          if (Array.isArray(msgs)) setChatMessages(msgs);
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [user, drawerOpen, selectedParcelId, browserAlertsEnabled]);

  // =========================================================================
  // VIEW 1: AUTHENTICATION SCREEN (EXPRESS PASS)
  // =========================================================================
  if (!user) {
    return (
      <ExpressAuth
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        busy={busy}
        notice={notice}
        handleAuthSubmit={handleAuthSubmit}
        handleQuickLogin={handleQuickLogin}
        propertyTitle={propertyTitle}
      />
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED APPLICATION
  // =========================================================================
  return (
    <>
      <ExpressWorkspace
          user={user}
          propertyTitle={propertyTitle}
          parcels={parcels}
          selectedParcelId={selectedParcelId}
          setSelectedParcelId={setSelectedParcelId}
          search={search}
          setSearch={setSearch}
          registeredUsers={registeredUsers}
          busy={busy}
          notice={notice}
          setNotice={setNotice}
          unreadCount={unreadCount}
          notifDrawerOpen={notifDrawerOpen}
          setNotifDrawerOpen={setNotifDrawerOpen}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          loadData={loadData}
          handleLogout={handleLogout}
          handleSeedDemoData={handleSeedDemoData}
          handleExportCsv={handleExportCsv}
          handleToggleUserActive={handleToggleUserActive}
          handleDeleteUser={handleDeleteUser}
          handleDeleteParcel={handleDeleteParcel}
          handleBookSlot={handleBookSlot}
          handleSetInstruction={handleSetInstruction}
          openRescheduleModal={openRescheduleModal}
          handleRequestOtp={handleRequestOtp}
          handleVerifyHandover={handleVerifyHandover}
          otpInputs={otpInputs}
          setOtpInputs={setOtpInputs}
          routeQueue={routeQueue}
          proofPhotos={proofPhotos}
          setProofPhotos={setProofPhotos}
          proofNotes={proofNotes}
          setProofNotes={setProofNotes}
          openScannerModal={openScannerModal}
          openPhotoModal={openPhotoModal}
          openDelegateModal={openDelegateModal}
          handleRevokeDelegate={handleRevokeDelegate}
          msgSummaries={msgSummaries}
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatBusy={chatBusy}
          handleSendChatMessage={handleSendChatMessage}
          intakeForm={intakeForm}
          setIntakeForm={setIntakeForm}
          handleGenerateTracking={handleGenerateTracking}
          handleRegisterParcel={handleRegisterParcel}
          setSelectedPass={setSelectedPass}
          setSelectedReceipt={setSelectedReceipt}
          agentTrust={agentTrust}
          opsStats={opsStats}
          slaBusy={slaBusy}
          handleEscalateSla={handleEscalateSla}
          handleEscalateAllOverdue={handleEscalateAllOverdue}
          openReturnModal={openReturnModal}
          openBundleModal={openBundleModal}
          handleBundleHandover={handleBundleHandover}
          handleConfirmReturnPickup={handleConfirmReturnPickup}
          bundleBusy={bundleBusy}
          returnBusy={returnBusy}
          scheduleConfirmNotes={scheduleConfirmNotes}
          setScheduleConfirmNotes={setScheduleConfirmNotes}
          scheduleConfirmBusy={scheduleConfirmBusy}
          handleConfirmSchedule={handleConfirmSchedule}
          flatHintPref={flatHintPref}
          openPreferencesModal={openPreferencesModal}
          openIssueModal={openIssueModal}
          handleResolveIssue={handleResolveIssue}
          issueBusy={issueBusy}
          handleRateDelivery={handleRateDelivery}
          ratingDrafts={ratingDrafts}
          setRatingDrafts={setRatingDrafts}
          ratingBusy={ratingBusy}
          RATING_TAGS={RATING_TAGS}
          isWithinIssueWindow={isWithinIssueWindow}
          installPromptEvent={installPromptEvent}
          isPwaInstalled={isPwaInstalled}
          handleInstallApp={handleInstallApp}
          notifPermission={notifPermission}
          browserAlertsEnabled={browserAlertsEnabled}
          handleToggleBrowserAlerts={handleToggleBrowserAlerts}
          COURIERS={COURIERS}
          CATEGORIES={CATEGORIES}
          TIME_SLOTS={TIME_SLOTS}
          DELIVERY_INSTRUCTIONS={DELIVERY_INSTRUCTIONS}
          AGENT_QUICK_REPLIES={AGENT_QUICK_REPLIES}
          RESIDENT_QUICK_REPLIES={RESIDENT_QUICK_REPLIES}
          formatDeliveryDate={formatDeliveryDate}
      />

      {/* Slide-out Notification Drawer */}
      {notifDrawerOpen && (
        <aside className="notifDrawer" style={{ top: 61 }}>
          <div className="drawerHeader">
            <div className="drawerTitle">
              <Bell size={18} color="#5b21b6" />
              <h3>Notification Center</h3>
            </div>
            <div className="drawerActions">
              {unreadCount > 0 && (
                <button className="textBtn" onClick={handleMarkAllNotificationsRead}>
                  Mark all read
                </button>
              )}
              <button className="closeBtn" onClick={() => setNotifDrawerOpen(false)}>
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="drawerBody">
            {notifications.length === 0 ? (
              <div className="emptyState" style={{ padding: '40px 16px' }}>
                <Bell size={32} color="#cbd5e1" />
                <p>No notifications yet. Inward alerts and private OTPs will appear here.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`notifItem ${n.read ? 'read' : 'unread'} type-${n.type.toLowerCase()}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="notifTop">
                    <span className="notifTypeBadge">{n.type.replace('_', ' ')}</span>
                    <span className="notifTime">{n.createdAt ? n.createdAt.replace('T', ' ').slice(11, 16) : 'Now'}</span>
                  </div>
                  <b className="notifItemTitle">{n.title}</b>
                  <p className="notifItemMsg">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Reschedule Delivery Modal */}
      {rescheduleParcel && (
        <div className="modalOverlay" onClick={() => setRescheduleParcel(null)}>
          <div className="modalContent rescheduleModal" onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <h3>Reschedule Delivery · {rescheduleParcel.trackingNumber}</h3>
                <p className="chatSubHeader">
                  {rescheduleParcel.courier} · Alert {rescheduleParcel.agentName || 'Delivery Agent'} you&apos;re unavailable today
                </p>
              </div>
              <button className="closeBtn" onClick={() => setRescheduleParcel(null)}><X size={18} /></button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="rescheduleForm">
              <div className="rescheduleLimitNotice">
                <AlertCircle size={15} color="#b45309" />
                <span>One-time reschedule: Once confirmed, delivery date &amp; time cannot be changed again.</span>
              </div>

              <div className="fieldGroup">
                <label className="fieldLabel">Choose Delivery Day</label>
                <div className="dayQuickChips">
                  {[1, 2, 3].map(offset => {
                    const iso = getIsoDateOffset(offset);
                    const label = offset === 1 ? 'Tomorrow' : formatDeliveryDate(iso);
                    return (
                      <button
                        key={offset}
                        type="button"
                        className={`dayChip ${rescheduleForm.preferredDate === iso ? 'active' : ''}`}
                        onClick={() => setRescheduleForm(prev => ({ ...prev, preferredDate: iso }))}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="date"
                  required
                  min={getIsoDateOffset(1)}
                  value={rescheduleForm.preferredDate}
                  onChange={e => setRescheduleForm(prev => ({ ...prev, preferredDate: e.target.value }))}
                />
              </div>

              <div className="fieldGroup">
                <label className="fieldLabel">Preferred Time Window</label>
                <select
                  value={rescheduleForm.slot}
                  onChange={e => setRescheduleForm(prev => ({ ...prev, slot: e.target.value }))}
                >
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="fieldGroup">
                <label className="fieldLabel">Reason / Note for Delivery Agent (Optional)</label>
                <div className="instructionChips">
                  {RESCHEDULE_REASONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      className={`instructionChip ${rescheduleForm.reason === r ? 'active' : ''}`}
                      onClick={() => setRescheduleForm(prev => ({ ...prev, reason: r }))}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or write a custom note (e.g. Back home tomorrow evening)"
                  value={rescheduleForm.reason}
                  onChange={e => setRescheduleForm(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>

              <div className="modalFooter" style={{ padding: '12px 0 0', background: 'transparent', borderTop: 'none' }}>
                <button type="button" className="btn secondary" onClick={() => setRescheduleParcel(null)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={rescheduleBusy}>
                  <CalendarDays size={15} />
                  <span>Confirm Reschedule & Alert Agent</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Pass Modal (Real Scannable QR Pass) */}
      {selectedPass && (() => {
        const activeOtp = getActivePassOtp(selectedPass, user);
        const qrPayload = encodePassQrPayload(selectedPass, activeOtp);
        const passQueueInfo = routeQueue?.dropsByParcelId?.[selectedPass.id];
        const bundledInSamePass = selectedPass.bundled && selectedPass.bundleCode
          ? parcels.filter(p => p.bundleCode === selectedPass.bundleCode)
          : [];
        return (
          <div className="modalOverlay" onClick={() => setSelectedPass(null)}>
            <div className="modalContent" onClick={e => e.stopPropagation()}>
              <div className="modalHeader">
                <h3>
                  {selectedPass.returnPickup
                    ? '🔄 Customer Return Handover Pass'
                    : selectedPass.bundled
                    ? '📦 Master Multi-Parcel Delivery Pass'
                    : 'Digital Delivery Verification Pass'}
                </h3>
                <button className="closeBtn" onClick={() => setSelectedPass(null)}><X size={18} /></button>
              </div>
              <div className="modalBody passBody">
                <div className="passMeta">
                  <div
                    className="passBadge"
                    style={
                      selectedPass.returnPickup
                        ? { background: '#ffedd5', color: '#c2410c', borderColor: '#fed7aa' }
                        : selectedPass.bundled
                        ? { background: '#ede9fe', color: '#5b21b6', borderColor: '#c4b5fd' }
                        : {}
                    }
                  >
                    {selectedPass.returnPickup
                      ? 'CUSTOMER RETURN PICKUP'
                      : selectedPass.bundled
                      ? `MASTER BUNDLE · ${selectedPass.bundleSize || bundledInSamePass.length} PARCELS`
                      : selectedPass.delegated
                      ? 'SMARTPARCEL DELEGATE PASS'
                      : 'SMARTPARCEL VERIFIED'}
                  </div>
                  <h2>Flat {selectedPass.flatNumber}</h2>
                  <p>
                    Resident: <b>{selectedPass.recipientName || user.name}</b>
                    {selectedPass.delegated && (
                      <> · Delegate: <b>{selectedPass.delegateName} (Flat {selectedPass.delegateFlat})</b></>
                    )}
                  </p>
                </div>

                <div className="passBox">
                  <div><span>Courier:</span> <b>{selectedPass.courier}</b></div>
                  <div><span>Tracking / Return ID:</span> <b>{selectedPass.trackingNumber}</b></div>
                  {selectedPass.returnPickup && selectedPass.returnReason && (
                    <div><span>Return Reason:</span> <b>{selectedPass.returnReason}</b></div>
                  )}
                  {selectedPass.returnOriginalTracking && (
                    <div><span>Original Order ID:</span> <b>{selectedPass.returnOriginalTracking}</b></div>
                  )}
                  {bundledInSamePass.length > 1 && (
                    <div style={{ gridColumn: '1 / -1', background: '#f5f3ff', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd6fe' }}>
                      <span style={{ color: '#4c1d95', fontWeight: 700 }}>Bundled Parcels ({bundledInSamePass.length}):</span>
                      <b style={{ display: 'block', fontSize: 12, color: '#3730a3', marginTop: 3 }}>
                        {bundledInSamePass.map(p => `${p.courier} (${p.trackingNumber})`).join(' + ')}
                      </b>
                    </div>
                  )}
                  <div><span>Delivery Agent:</span> <b>{selectedPass.agentName || 'Assigned Partner'}</b></div>
                  <div><span>Scheduled Slot:</span> <b>{selectedPass.slot || 'Pending Booking'}</b></div>
                  <div><span>Instruction:</span> <b>{selectedPass.deliveryInstruction || 'Standard Handover'}</b></div>
                  {passQueueInfo && (user?.role !== 'ROLE_RESIDENT' || selectedPass.status === 'SLOT_BOOKED' || (Boolean(selectedPass.slot) && selectedPass.status !== 'RECEIVED')) && (
                    <div>
                      <span>Elevator Route Queue:</span>
                      <b>{passQueueInfo.queueMessage} (Tower {passQueueInfo.tower} · Floor {passQueueInfo.floor})</b>
                    </div>
                  )}
                  {selectedPass.delegated && (
                    <div><span>Authorized Neighbor:</span> <b>{selectedPass.delegateName} (Flat {selectedPass.delegateFlat})</b></div>
                  )}
                </div>

                <PassQrCode
                  payload={qrPayload}
                  trackingNumber={selectedPass.trackingNumber}
                  activeOtp={activeOtp}
                  onActivateQr={() => handleActivatePassQr(selectedPass)}
                  activating={qrPassActivating}
                />
              </div>
              <div className="modalFooter">
                <button className="btn secondary fullWidth" onClick={() => setSelectedPass(null)}>Close Pass</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Authorize Neighbor / Delegate Modal */}
      {delegateParcel && (
        <div className="modalOverlay" onClick={() => setDelegateParcel(null)}>
          <div className="modalContent rescheduleModal" onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <h3>Authorize Neighbor / Family · {delegateParcel.trackingNumber}</h3>
                <p className="chatSubHeader">
                  Pass {delegateParcel.courier} delivery to a trusted flat or family member with a Delegate OTP
                </p>
              </div>
              <button className="closeBtn" onClick={() => setDelegateParcel(null)}><X size={18} /></button>
            </div>

            <form onSubmit={handleAuthorizeDelegate} className="rescheduleForm">
              {trustedNeighbors.length > 0 && (
                <div className="fieldGroup">
                  <label className="fieldLabel">1-Tap Trusted Community Neighbors</label>
                  <div className="delegateCardGrid">
                    {trustedNeighbors.map(n => {
                      const isPicked = delegateForm.delegateFlat === n.flatNumber && delegateForm.delegateName === n.name;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          className={`neighborChip ${isPicked ? 'active' : ''}`}
                          onClick={() => setDelegateForm(prev => ({
                            ...prev,
                            delegateFlat: n.flatNumber,
                            delegateName: n.name,
                            delegatePhone: n.phone || ''
                          }))}
                        >
                          <span>FLAT {n.flatNumber}</span>
                          <b>{n.name}</b>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="fieldGrid">
                <div className="fieldGroup">
                  <label className="fieldLabel">Delegate Flat #</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A-102"
                    value={delegateForm.delegateFlat}
                    onChange={e => setDelegateForm(prev => ({ ...prev, delegateFlat: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">Recipient Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Neighbor or family member"
                    value={delegateForm.delegateName}
                    onChange={e => setDelegateForm(prev => ({ ...prev, delegateName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="fieldGrid">
                <div className="fieldGroup">
                  <label className="fieldLabel">Delegate Phone (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 34102"
                    value={delegateForm.delegatePhone}
                    onChange={e => setDelegateForm(prev => ({ ...prev, delegatePhone: e.target.value }))}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">Note to Agent (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Collect at next door flat"
                    value={delegateForm.note}
                    onChange={e => setDelegateForm(prev => ({ ...prev, note: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modalFooter" style={{ padding: '12px 0 0', background: 'transparent', borderTop: 'none' }}>
                <button type="button" className="btn secondary" onClick={() => setDelegateParcel(null)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={delegateBusy}>
                  <UserPlus size={15} />
                  <span>{delegateBusy ? 'Issuing Pass...' : 'Authorize & Issue Delegate OTP'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Handover Receipt Modal */}
      {selectedReceipt && (
        <div className="modalOverlay" onClick={() => setSelectedReceipt(null)}>
          <div className="modalContent" onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>
                {selectedReceipt.returnPickup
                  ? 'Customer Return Collection Slip'
                  : selectedReceipt.bundled
                  ? 'Master Bundled Handover Confirmation'
                  : 'Direct Handover Confirmation Slip'}
              </h3>
              <button className="closeBtn" onClick={() => setSelectedReceipt(null)}><X size={18} /></button>
            </div>
            <div className="modalBody receiptBody">
              <div
                className="receiptStamp"
                style={
                  selectedReceipt.returnPickup
                    ? { color: '#c2410c', borderColor: '#c2410c' }
                    : selectedReceipt.bundled
                    ? { color: '#5b21b6', borderColor: '#5b21b6' }
                    : {}
                }
              >
                {selectedReceipt.returnPickup
                  ? 'VERIFIED CUSTOMER RETURN PICKUP'
                  : selectedReceipt.bundled
                  ? 'VERIFIED MASTER BUNDLED HANDOVER'
                  : 'VERIFIED DIRECT HANDOVER'}
              </div>
              <div className="receiptField">
                <span>Receipt Ref ID:</span>
                <b>SP-REC-{selectedReceipt.id}</b>
              </div>
              <div className="receiptField">
                <span>{selectedReceipt.returnPickup ? 'Return ID / Tracking:' : 'Package Tracking ID:'}</span>
                <b>{selectedReceipt.trackingNumber}</b>
              </div>
              {selectedReceipt.returnReason && (
                <div className="receiptField">
                  <span>Return Reason:</span>
                  <b>{selectedReceipt.returnReason}</b>
                </div>
              )}
              {selectedReceipt.returnOriginalTracking && (
                <div className="receiptField">
                  <span>Original Order Ref:</span>
                  <b>{selectedReceipt.returnOriginalTracking}</b>
                </div>
              )}
              {selectedReceipt.bundled && (
                <div className="receiptField">
                  <span>Master Bundle Code:</span>
                  <b>{selectedReceipt.bundleCode} ({selectedReceipt.bundleSize || 2} Parcels Handed Over Together)</b>
                </div>
              )}
              <div className="receiptField">
                <span>Courier Service:</span>
                <b>{selectedReceipt.courier}</b>
              </div>
              <div className="receiptField">
                <span>Apartment Suite:</span>
                <b>Flat {selectedReceipt.flatNumber}</b>
              </div>
              <div className="receiptField">
                <span>{selectedReceipt.returnPickup ? 'Handed Over By / To:' : 'Handed Over To:'}</span>
                <b>{selectedReceipt.handedOverTo || selectedReceipt.recipientName || 'Resident'}</b>
              </div>
              <div className="receiptField">
                <span>Verification Method:</span>
                <b>{selectedReceipt.verifiedMethod || '6-Digit Agent-Resident OTP Verified'}</b>
              </div>
              <div className="receiptField">
                <span>{selectedReceipt.returnPickup ? 'Collection Time:' : 'Handover Time:'}</span>
                <b>{selectedReceipt.handedOverAt ? selectedReceipt.handedOverAt.replace('T', ' ').slice(0, 19) : new Date().toLocaleString()}</b>
              </div>

              {selectedReceipt.proofPhotoUrl && (
                <div className="receiptPhotoProof">
                  <div className="drawerPhotoProofHeader">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Camera size={14} />
                      <span>Doorstep Safe-Drop Photo Proof</span>
                    </span>
                    <ShieldCheck size={14} color="#047857" />
                  </div>
                  <img
                    src={selectedReceipt.proofPhotoUrl}
                    alt="Delivered parcel doorstep proof"
                    className="proofPhotoFullImg"
                  />
                  {selectedReceipt.proofNote && (
                    <div style={{ fontSize: 12, color: '#5d5876' }}>
                      Agent Note: <b>{selectedReceipt.proofNote}</b>
                    </div>
                  )}
                </div>
              )}

              <DeliveryRatingBox
                parcel={selectedReceipt}
                isRes={user.role === 'ROLE_RESIDENT'}
                ratingDrafts={ratingDrafts}
                setRatingDrafts={setRatingDrafts}
                ratingBusy={ratingBusy}
                handleRateDelivery={handleRateDelivery}
                RATING_TAGS={RATING_TAGS}
              />

              <IssueDisputeBox
                parcel={selectedReceipt}
                isRes={user.role === 'ROLE_RESIDENT'}
                isStaffAudit={user.role === 'ROLE_ADMIN' || user.role === 'ROLE_DELIVERY_AGENT'}
                withinWindow={isWithinIssueWindow(selectedReceipt)}
                openIssueModal={openIssueModal}
                handleResolveIssue={handleResolveIssue}
                issueBusy={issueBusy}
              />
            </div>
            <div className="modalFooter">
              <button className="btn secondary" onClick={() => window.print()}>
                <Printer size={15} /> Print Slip
              </button>
              <button className="btn primary" onClick={() => setSelectedReceipt(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resident Default Doorstep Rules & Vacation Mode Modal */}
      {prefsModalOpen && (
        <div className="modalOverlay" onClick={() => setPrefsModalOpen(false)}>
          <div className="modalContent rescheduleModal" onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <h3>Doorstep Rules &amp; Vacation Mode</h3>
                <p className="chatSubHeader">
                  Flat {user.flatNumber} · Automatically applied whenever a delivery arrives
                </p>
              </div>
              <button className="closeBtn" onClick={() => setPrefsModalOpen(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSavePreferences} className="rescheduleForm">
              <div className="fieldGroup">
                <label className="fieldLabel">Default Doorstep Instruction</label>
                <div className="instructionChips">
                  {RESIDENT_RULE_PRESETS.map(rule => (
                    <button
                      key={rule}
                      type="button"
                      className={`instructionChip ${prefsForm.defaultInstruction === rule ? 'active' : ''}`}
                      onClick={() => setPrefsForm(prev => ({
                        ...prev,
                        defaultInstruction: prev.defaultInstruction === rule ? '' : rule
                      }))}
                    >
                      {rule}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Always leave outside door after 8 PM"
                  value={prefsForm.defaultInstruction}
                  onChange={e => setPrefsForm(prev => ({ ...prev, defaultInstruction: e.target.value }))}
                />
              </div>

              <div className="fieldGroup">
                <label className="fieldLabel">Preferred Default Time Window (Optional)</label>
                <select
                  value={prefsForm.defaultSlot}
                  onChange={e => setPrefsForm(prev => ({ ...prev, defaultSlot: e.target.value }))}
                >
                  <option value="">Choose per parcel on arrival</option>
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="ep-toggleRow">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#17132a' }}>Quiet Hours Mode</div>
                  <div style={{ fontSize: 11.5, color: '#5d5876' }}>
                    Instruct delivery agents not to ring bell during quiet hours
                  </div>
                </div>
                <button
                  type="button"
                  className={`ep-toggleSwitch ${prefsForm.quietHoursEnabled ? 'on' : ''}`}
                  onClick={() => setPrefsForm(prev => ({ ...prev, quietHoursEnabled: !prev.quietHoursEnabled }))}
                  aria-label="Toggle quiet hours"
                />
              </div>

              {prefsForm.quietHoursEnabled && (
                <div className="fieldGrid">
                  <div className="fieldGroup">
                    <label className="fieldLabel">Quiet Hours From</label>
                    <input
                      type="time"
                      value={prefsForm.quietHoursStart}
                      onChange={e => setPrefsForm(prev => ({ ...prev, quietHoursStart: e.target.value }))}
                    />
                  </div>
                  <div className="fieldGroup">
                    <label className="fieldLabel">Quiet Hours Until</label>
                    <input
                      type="time"
                      value={prefsForm.quietHoursEnd}
                      onChange={e => setPrefsForm(prev => ({ ...prev, quietHoursEnd: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="ep-toggleRow" style={{ background: prefsForm.vacationMode ? '#fff7ed' : '#faf9fe', borderColor: prefsForm.vacationMode ? '#fdba74' : '#e6e3f3' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: prefsForm.vacationMode ? '#9a3412' : '#17132a', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <PlaneTakeoff size={14} />
                    <span>Vacation Mode Auto-Hold</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#5d5876' }}>
                    Automatically flags incoming dispatches for reschedule while you are away
                  </div>
                </div>
                <button
                  type="button"
                  className={`ep-toggleSwitch ${prefsForm.vacationMode ? 'on' : ''}`}
                  onClick={() => setPrefsForm(prev => ({ ...prev, vacationMode: !prev.vacationMode }))}
                  aria-label="Toggle vacation mode"
                />
              </div>

              {prefsForm.vacationMode && (
                <div className="fieldGrid">
                  <div className="fieldGroup">
                    <label className="fieldLabel">Away From</label>
                    <input
                      type="date"
                      required
                      value={prefsForm.vacationFrom}
                      onChange={e => setPrefsForm(prev => ({ ...prev, vacationFrom: e.target.value }))}
                    />
                  </div>
                  <div className="fieldGroup">
                    <label className="fieldLabel">Back On (Auto-reschedules to day after)</label>
                    <input
                      type="date"
                      required
                      min={prefsForm.vacationFrom || getIsoDateOffset(0)}
                      value={prefsForm.vacationUntil}
                      onChange={e => setPrefsForm(prev => ({ ...prev, vacationUntil: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="modalFooter" style={{ padding: '12px 0 0', background: 'transparent', borderTop: 'none' }}>
                <button type="button" className="btn secondary" onClick={() => setPrefsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={prefsBusy}>
                  <SlidersHorizontal size={15} />
                  <span>{prefsBusy ? 'Saving...' : 'Save Default Rules'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post-Delivery Issue / Dispute Report Modal */}
      {issueParcel && (
        <div className="modalOverlay" onClick={() => setIssueParcel(null)}>
          <div className="modalContent rescheduleModal" onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <h3>Report Delivery Issue · {issueParcel.trackingNumber}</h3>
                <p className="chatSubHeader">
                  {issueParcel.courier} · Syncs directly with Admin &amp; Delivery Agent audit view
                </p>
              </div>
              <button className="closeBtn" onClick={() => setIssueParcel(null)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmitIssue} className="rescheduleForm">
              <div className="fieldGroup">
                <label className="fieldLabel">Issue Type</label>
                <div className="instructionChips">
                  {ISSUE_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`instructionChip ${issueForm.category === cat ? 'active' : ''}`}
                      onClick={() => setIssueForm(prev => ({ ...prev, category: cat }))}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fieldGroup">
                <label className="fieldLabel">What happened?</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the issue (e.g. Outer box dented, seal broken, item missing or never received)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--ep-border)',
                    fontFamily: 'inherit',
                    fontSize: 13
                  }}
                  value={issueForm.notes}
                  onChange={e => setIssueForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="fieldGroup">
                <label className="fieldLabel">Evidence Photo (Optional)</label>
                {issueForm.photoUrl ? (
                  <div className="safeDropPreviewWrap">
                    <img src={issueForm.photoUrl} alt="Issue evidence preview" className="safeDropPreviewImg" />
                    <button
                      type="button"
                      className="safeDropRemoveBtn"
                      onClick={() => setIssueForm(prev => ({ ...prev, photoUrl: '' }))}
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="safeDropActionsRow">
                    <button
                      type="button"
                      className="ep-btnGhost"
                      style={{ justifyContent: 'center', fontSize: 12 }}
                      onClick={() => openPhotoModal('ISSUE')}
                    >
                      <Camera size={13} />
                      <span>Snap Camera</span>
                    </button>
                    <label className="ep-btnGhost" style={{ justifyContent: 'center', fontSize: 12, cursor: 'pointer' }}>
                      <Upload size={13} />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async e => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          try {
                            const compressed = await compressImageFileToDataUrl(f);
                            setIssueForm(prev => ({ ...prev, photoUrl: compressed }));
                          } catch (err) {
                            notify(err.message || 'Could not process image', 'error');
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="modalFooter" style={{ padding: '12px 0 0', background: 'transparent', borderTop: 'none' }}>
                <button type="button" className="btn secondary" onClick={() => setIssueParcel(null)}>Cancel</button>
                <button type="submit" className="btn primary" style={{ background: '#dc2626' }} disabled={issueBusy}>
                  <ShieldAlert size={15} />
                  <span>{issueBusy ? 'Submitting Dispute...' : 'Submit Issue Flag'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Automatic Post-Delivery Rating Popup Modal */}
      {ratingModalParcel && (
        <div className="modalOverlay" onClick={dismissRatingModal}>
          <div className="modalContent" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Star size={19} fill="#f59e0b" color="#d97706" />
                </div>
                <div>
                  <h3>Parcel Delivered! Rate Your Delivery</h3>
                  <p className="chatSubHeader">
                    {ratingModalParcel.courier} · {ratingModalParcel.trackingNumber}
                    {ratingModalParcel.agentName ? ` · Partner: ${ratingModalParcel.agentName}` : ''}
                  </p>
                </div>
              </div>
              <button className="closeBtn" onClick={dismissRatingModal}><X size={18} /></button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#5d5876', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                Verified handover{ratingModalParcel.verifiedMethod ? ` via ${ratingModalParcel.verifiedMethod}` : ''}. Your feedback updates the delivery partner&apos;s trust score!
              </div>
              <DeliveryRatingBox
                parcel={ratingModalParcel}
                isRes={user.role === 'ROLE_RESIDENT'}
                ratingDrafts={ratingDrafts}
                setRatingDrafts={setRatingDrafts}
                ratingBusy={ratingBusy}
                handleRateDelivery={handleRateDelivery}
                RATING_TAGS={RATING_TAGS}
                hideSubmitButton
              />
            </div>
            <div className="modalFooter">
              <button type="button" className="btn secondary" onClick={dismissRatingModal}>
                Maybe Later
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  const target = ratingModalParcel;
                  dismissRatingModal();
                  setSelectedReceipt(target);
                }}
              >
                <FileText size={14} /> View Receipt
              </button>
              {user.role === 'ROLE_RESIDENT' && !ratingModalParcel.deliveryRating && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={ratingBusy}
                  onClick={() => {
                    const draft = ratingDrafts?.[ratingModalParcel.id] || { rating: 5, tags: [], comment: '' };
                    handleRateDelivery(ratingModalParcel, draft.rating, draft.tags, draft.comment);
                  }}
                >
                  <CheckCircle2 size={14} />
                  {ratingBusy ? 'Submitting...' : `Confirm & Submit (${ratingDrafts?.[ratingModalParcel.id]?.rating || 5}★)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PWA Install & Push Notifications Guide Modal */}
      {installHelpOpen && (
        <div className="modalOverlay" onClick={() => setInstallHelpOpen(false)}>
          <div className="modalContent" onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>Install SmartParcel App &amp; Alerts</h3>
              <button className="closeBtn" onClick={() => setInstallHelpOpen(false)}><X size={18} /></button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="ep-statusStrip trust">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <Smartphone size={16} color="#5b21b6" />
                  <span>PWA Web App Manifest &amp; Service Worker Active</span>
                </span>
                <span className="ep-trustTagPill">{isPwaInstalled ? 'Installed' : 'Ready'}</span>
              </div>
              <div style={{ fontSize: 13, color: '#5d5876', lineHeight: 1.55 }}>
                <b>Install on Phone / Desktop:</b><br />
                • <b>Chrome / Edge:</b> Click the install icon in the browser address bar or tap <i>Menu → Install App</i>.<br />
                • <b>iPhone / iPad Safari:</b> Tap <i>Share → Add to Home Screen</i> for standalone full-screen mode.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="ep-btnPrimary" onClick={handleSendTestPush}>
                  <BellRing size={14} />
                  <span>Test Background Push Alert</span>
                </button>
                <button type="button" className="ep-btnGhost" onClick={handleToggleBrowserAlerts}>
                  <CheckCircle2 size={14} />
                  <span>Permission: {notifPermission}</span>
                </button>
              </div>
            </div>
            <div className="modalFooter">
              <button className="btn primary" onClick={() => setInstallHelpOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Parcel Bundling Modal */}
      {bundleModalParcels && (
        <div className="modalOverlay" onClick={() => setBundleModalParcels(null)}>
          <div
            className="modalContent"
            style={{
              maxWidth: 'min(440px, 94vw)',
              width: '100%',
              maxHeight: 'min(88vh, 580px)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 16,
              boxShadow: '0 20px 48px -12px rgba(23, 19, 42, 0.22), 0 0 0 1px rgba(91, 33, 182, 0.08)',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="modalHeader"
              style={{
                padding: '14px 18px',
                background: 'linear-gradient(180deg, #fbfaff 0%, #ffffff 100%)',
                borderBottom: '1px solid #ede9fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                    color: '#5b21b6',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(91, 33, 182, 0.12)'
                  }}
                >
                  <Boxes size={18} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#17132a',
                      letterSpacing: '-0.015em',
                      margin: 0,
                      fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)"
                    }}
                  >
                    Bundle {bundleModalParcels.length} Incoming Deliveries
                  </h3>
                  <p
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      marginTop: 2,
                      lineHeight: 1.35,
                      fontFamily: "var(--font-body, 'Inter', sans-serif)"
                    }}
                  >
                    1 slot &amp; 1 Master Pass for Flat <b>{user?.flatNumber || bundleModalParcels[0]?.flatNumber}</b>
                  </p>
                </div>
              </div>
              <button className="closeBtn" onClick={() => setBundleModalParcels(null)}><X size={18} /></button>
            </div>
            <form
              onSubmit={handleBundleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              <div
                className="modalBody"
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                  fontFamily: "var(--font-body, 'Inter', sans-serif)"
                }}
              >
                <div
                  style={{
                    background: '#fbfaff',
                    border: '1px solid #ede9fe',
                    borderRadius: 10,
                    padding: '10px 12px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#5b21b6',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                      }}
                    >
                      Included Deliveries
                    </span>
                    <span
                      style={{
                        background: '#ede9fe',
                        color: '#5b21b6',
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 10
                      }}
                    >
                      {bundleModalParcels.length} Parcels
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      maxHeight: 100,
                      overflowY: 'auto'
                    }}
                  >
                    {bundleModalParcels.map(p => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#ffffff',
                          border: '1px solid #f1eff9',
                          borderRadius: 8,
                          padding: '6px 10px',
                          boxShadow: '0 1px 2px rgba(23, 19, 42, 0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor:
                                p.courier?.toLowerCase() === 'amazon' ? '#ff9900' :
                                p.courier?.toLowerCase() === 'blinkit' ? '#eab308' :
                                p.courier?.toLowerCase() === 'myntra' ? '#ec4899' :
                                p.courier?.toLowerCase() === 'flipkart' ? '#2563eb' :
                                p.courier?.toLowerCase() === 'bluedart' ? '#0284c7' : '#7c3aed',
                              flexShrink: 0
                            }}
                          />
                          <b style={{ fontSize: 12.5, color: '#17132a' }}>{p.courier}</b>
                        </div>
                        <span
                          style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: 11,
                            color: '#64748b',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            padding: '2px 6px',
                            borderRadius: 5,
                            letterSpacing: '0.02em'
                          }}
                        >
                          {p.trackingNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#475569',
                      marginBottom: 4
                    }}
                  >
                    Combined Delivery Window
                  </label>
                  <select
                    value={bundleForm.slot}
                    onChange={e => setBundleForm(prev => ({ ...prev, slot: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13,
                      fontFamily: "var(--font-body, 'Inter', sans-serif)",
                      color: '#1e293b',
                      background: '#ffffff',
                      outline: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box'
                    }}
                  >
                    {TIME_SLOTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#475569',
                      marginBottom: 4
                    }}
                  >
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13,
                      fontFamily: "var(--font-body, 'Inter', sans-serif)",
                      color: '#1e293b',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    value={bundleForm.preferredDate || getIsoDateOffset(0)}
                    onChange={e => setBundleForm(prev => ({ ...prev, preferredDate: e.target.value }))}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#475569',
                      marginBottom: 4
                    }}
                  >
                    Doorstep Instruction for Agent (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Leave all parcels outside door together"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13,
                      fontFamily: "var(--font-body, 'Inter', sans-serif)",
                      color: '#1e293b',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    value={bundleForm.deliveryInstruction}
                    onChange={e => setBundleForm(prev => ({ ...prev, deliveryInstruction: e.target.value }))}
                  />
                </div>
              </div>
              <div
                className="modalFooter"
                style={{
                  padding: '12px 18px',
                  background: 'var(--bg-ivory, #faf9fe)',
                  borderTop: '1px solid #ede9fe',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  flexShrink: 0
                }}
              >
                <button
                  type="button"
                  className="btn secondary"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-body, 'Inter', sans-serif)"
                  }}
                  onClick={() => setBundleModalParcels(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "var(--font-body, 'Inter', sans-serif)",
                    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                    boxShadow: '0 2px 8px rgba(91, 33, 182, 0.22)'
                  }}
                  disabled={bundleBusy}
                >
                  <Boxes size={14} />
                  <span>{bundleBusy ? 'Generating Master Pass...' : `Confirm & Bundle (${bundleModalParcels.length} Drops)`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Return Pickup Modal */}
      {returnModalOpen && (
        <div className="modalOverlay" onClick={() => setReturnModalOpen(false)}>
          <div
            className="modalContent"
            style={{
              maxWidth: 'min(440px, 94vw)',
              width: '100%',
              maxHeight: 'min(88vh, 580px)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 16,
              boxShadow: '0 20px 48px -12px rgba(23, 19, 42, 0.22), 0 0 0 1px rgba(194, 65, 12, 0.1)',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="modalHeader"
              style={{
                padding: '14px 18px',
                background: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 100%)',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: '#ffedd5',
                    color: '#c2410c',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(194, 65, 12, 0.15)'
                  }}
                >
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#17132a',
                      letterSpacing: '-0.015em',
                      margin: 0,
                      fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)"
                    }}
                  >
                    Schedule Return Pickup
                  </h3>
                  <p
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      marginTop: 2,
                      lineHeight: 1.35,
                      fontFamily: "var(--font-body, 'Inter', sans-serif)"
                    }}
                  >
                    Reverse-Handover Pass &amp; OTP for courier collection
                  </p>
                </div>
              </div>
              <button className="closeBtn" onClick={() => setReturnModalOpen(false)}><X size={18} /></button>
            </div>
            <form
              onSubmit={handleScheduleReturnSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              <div
                className="modalBody"
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                  fontFamily: "var(--font-body, 'Inter', sans-serif)"
                }}
              >
                <div className="fieldGrid">
                  <div className="fieldGroup">
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: 4 }}>
                      Courier Partner
                    </label>
                    <select
                      value={returnForm.courier}
                      onChange={e => setReturnForm(prev => ({ ...prev, courier: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: 13,
                        color: '#1e293b',
                        background: '#ffffff',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box'
                      }}
                    >
                      {COURIERS.map(c => {
                        const name = typeof c === 'string' ? c : c.name;
                        return <option key={name} value={name}>{name}</option>;
                      })}
                    </select>
                  </div>
                  <div className="fieldGroup">
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: 4 }}>
                      Pickup Flat Number
                    </label>
                    <input
                      type="text"
                      required
                      value={returnForm.flatNumber}
                      onChange={e => setReturnForm(prev => ({ ...prev, flatNumber: e.target.value.toUpperCase() }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: 13,
                        color: '#1e293b',
                        background: '#ffffff',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div className="fieldGroup">
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: 4 }}>
                    Return Reason
                  </label>
                  <select
                    value={returnForm.returnReason}
                    onChange={e => setReturnForm(prev => ({ ...prev, returnReason: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13,
                      color: '#1e293b',
                      background: '#ffffff',
                      outline: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Size mismatch">Size mismatch / Doesn't fit</option>
                    <option value="Defective or damaged">Defective or damaged on arrival</option>
                    <option value="Wrong item delivered">Wrong item delivered</option>
                    <option value="Quality not as expected">Quality not as expected</option>
                    <option value="Changed mind">Changed mind / No longer needed</option>
                  </select>
                </div>

                <div className="fieldGroup">
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: 4 }}>
                    Original Tracking / Order ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AMZ-88912 or order #12345"
                    value={returnForm.originalTrackingNumber}
                    onChange={e => setReturnForm(prev => ({ ...prev, originalTrackingNumber: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13,
                      color: '#1e293b',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="fieldGrid">
                  <div className="fieldGroup">
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: 4 }}>
                      Pickup Window
                    </label>
                    <select
                      value={returnForm.slot}
                      onChange={e => setReturnForm(prev => ({ ...prev, slot: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: 13,
                        color: '#1e293b',
                        background: '#ffffff',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box'
                      }}
                    >
                      {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="fieldGroup">
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: 4 }}>
                      Pickup Date
                    </label>
                    <input
                      type="date"
                      value={returnForm.preferredDate || getIsoDateOffset(0)}
                      onChange={e => setReturnForm(prev => ({ ...prev, preferredDate: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: 13,
                        color: '#1e293b',
                        background: '#ffffff',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div className="fieldGroup">
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: 4 }}>
                    Doorstep Package Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Return package sealed with barcode label"
                    value={returnForm.deliveryInstruction}
                    onChange={e => setReturnForm(prev => ({ ...prev, deliveryInstruction: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13,
                      color: '#1e293b',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
              <div
                className="modalFooter"
                style={{
                  padding: '12px 18px',
                  background: 'var(--bg-ivory, #faf9fe)',
                  borderTop: '1px solid #fed7aa',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  flexShrink: 0
                }}
              >
                <button
                  type="button"
                  className="btn secondary"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-body, 'Inter', sans-serif)"
                  }}
                  onClick={() => setReturnModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "var(--font-body, 'Inter', sans-serif)",
                    background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                    borderColor: '#c2410c',
                    boxShadow: '0 2px 8px rgba(194, 65, 12, 0.25)'
                  }}
                  disabled={returnBusy}
                >
                  <RotateCcw size={14} />
                  <span>{returnBusy ? 'Scheduling Pickup...' : 'Schedule Pickup & Get Reverse Pass'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Barcode / Digital Pass QR Scanner Modal */}
      <CameraScannerModal
        open={Boolean(scannerModal)}
        mode={scannerModal?.mode || 'barcode'}
        onClose={() => setScannerModal(null)}
        onDetected={handleScannerDetected}
      />

      {/* Live Camera Photo Proof Modal (Safe-Drop OR Issue Evidence) */}
      <PhotoCaptureModal
        open={Boolean(photoModalParcel)}
        title={
          photoModalParcel === 'ISSUE'
            ? 'Dispute Evidence Photo'
            : photoModalParcel
            ? `Safe-Drop Photo · ${photoModalParcel.trackingNumber}`
            : 'Doorstep Photo'
        }
        onClose={() => setPhotoModalParcel(null)}
        onCaptured={dataUrl => {
          if (photoModalParcel === 'ISSUE') {
            setIssueForm(prev => ({ ...prev, photoUrl: dataUrl }));
            notify('Evidence photo attached to issue report.', 'success');
          } else if (photoModalParcel) {
            setProofPhotos(prev => ({ ...prev, [photoModalParcel.id]: dataUrl }));
            notify(`Safe-drop snapshot attached for ${photoModalParcel.trackingNumber}.`, 'success');
          }
        }}
      />
    </>
  );
}
