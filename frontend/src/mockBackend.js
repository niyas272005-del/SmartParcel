// SmartParcel Client-Side Standalone / Preview Mock Engine
// Activates seamlessly when deployed to static preview hosts (e.g. Vercel / GitHub Pages)
// where the Spring Boot Java backend is not yet attached or returns 404.

const SEED_USERS = [
  {
    id: 1,
    name: 'Society Administrator',
    email: 'admin@smartparcel.com',
    role: 'ROLE_ADMIN',
    phone: '+91 98765 00001',
    active: true
  },
  {
    id: 2,
    name: 'Ramesh Kumar (Delivery Agent)',
    email: 'agent@smartparcel.com',
    role: 'ROLE_DELIVERY_AGENT',
    phone: '+91 98765 00002',
    active: true
  },
  {
    id: 3,
    name: 'Aarav Sharma',
    email: 'aarav@smartparcel.com',
    flatNumber: 'A-101',
    role: 'ROLE_RESIDENT',
    phone: '+91 98765 12001',
    active: true
  },
  {
    id: 4,
    name: 'Rajesh Patel',
    email: 'rajesh@smartparcel.com',
    flatNumber: 'A-102',
    role: 'ROLE_RESIDENT',
    phone: '+91 98765 34102',
    active: true
  },
  {
    id: 5,
    name: 'Meera Nambiar',
    email: 'meera@smartparcel.com',
    flatNumber: 'B-202',
    role: 'ROLE_RESIDENT',
    phone: '+91 98765 77202',
    active: true
  }
];

function getInitialParcels() {
  const now = new Date().toISOString();
  return [
    {
      id: 101,
      trackingNumber: 'AMZ-4819',
      courier: 'Amazon',
      flatNumber: 'A-101',
      recipientName: 'Aarav Sharma',
      recipientPhone: '+91 98765 12001',
      category: 'Electronics',
      description: 'Smart Wireless Noise-Cancelling Headphones',
      receivedAt: now,
      status: 'SLOT_BOOKED',
      slot: '4:00 PM – 6:00 PM',
      preferredDate: 'Today',
      deliveryInstruction: 'Leave at doorstep',
      demoOtp: '582914',
      agentName: 'Ramesh Kumar (Delivery Agent)',
      agentScheduleConfirmed: true,
      agentScheduleConfirmMessage: 'Agent confirmed 4:00 PM – 6:00 PM slot'
    },
    {
      id: 102,
      trackingNumber: 'BLK-9218',
      courier: 'Blinkit',
      flatNumber: 'A-101',
      recipientName: 'Aarav Sharma',
      recipientPhone: '+91 98765 12001',
      category: 'Grocery & Fresh',
      description: 'Farm Fresh Organic Milk, Bread & Avocados',
      receivedAt: now,
      status: 'SLOT_BOOKED',
      slot: '4:00 PM – 6:00 PM',
      preferredDate: 'Today',
      deliveryInstruction: 'Hand over personally',
      demoOtp: '319402',
      agentName: 'Ramesh Kumar (Delivery Agent)',
      agentScheduleConfirmed: true,
      agentScheduleConfirmMessage: 'Agent confirmed 4:00 PM – 6:00 PM slot'
    },
    {
      id: 103,
      trackingNumber: 'MYN-6302',
      courier: 'Myntra',
      flatNumber: 'A-101',
      recipientName: 'Aarav Sharma',
      recipientPhone: '+91 98765 12001',
      category: 'Apparel',
      description: 'Casual Cotton Linen Shirt (Navy Blue)',
      receivedAt: now,
      status: 'RECEIVED',
      slot: null,
      preferredDate: 'Today',
      deliveryInstruction: null,
      demoOtp: '891045',
      agentName: 'Ramesh Kumar (Delivery Agent)'
    },
    {
      id: 104,
      trackingNumber: 'FK-3910',
      courier: 'Flipkart',
      flatNumber: 'B-202',
      recipientName: 'Meera Nambiar',
      recipientPhone: '+91 98765 77202',
      category: 'Home & Kitchen',
      description: 'Stainless Steel Induction Cookware Set',
      receivedAt: now,
      status: 'SLOT_BOOKED',
      slot: '1:00 PM – 3:00 PM',
      preferredDate: 'Today',
      deliveryInstruction: 'Drop with neighbor',
      demoOtp: '402851',
      agentName: 'Ramesh Kumar (Delivery Agent)'
    },
    {
      id: 105,
      trackingNumber: 'BLU-5521',
      courier: 'BlueDart',
      flatNumber: 'A-101',
      recipientName: 'Aarav Sharma',
      recipientPhone: '+91 98765 12001',
      category: 'Documents',
      description: 'Bank Statement & Passbook Consignment',
      receivedAt: now,
      handedOverAt: now,
      status: 'HANDED_OVER',
      slot: '10:00 AM – 12:00 PM',
      preferredDate: 'Today',
      verifiedMethod: 'OTP Handover',
      agentName: 'Ramesh Kumar (Delivery Agent)'
    }
  ];
}

function getStoredParcels() {
  try {
    const raw = localStorage.getItem('smartparcel_mock_parcels');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  const initial = getInitialParcels();
  saveStoredParcels(initial);
  return initial;
}

function saveStoredParcels(parcels) {
  try {
    localStorage.setItem('smartparcel_mock_parcels', JSON.stringify(parcels));
  } catch (_) {}
}

function getStoredUsers() {
  try {
    const raw = localStorage.getItem('smartparcel_mock_users');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return SEED_USERS;
}

function saveStoredUsers(users) {
  try {
    localStorage.setItem('smartparcel_mock_users', JSON.stringify(users));
  } catch (_) {}
}

function buildMockRouteQueue(parcels) {
  const active = parcels.filter(p => p.status !== 'HANDED_OVER');
  const dropsByParcelId = {};
  active.forEach((p, idx) => {
    const floor = parseInt(p.flatNumber?.replace(/\D/g, '') || '101', 10) >= 200 ? 2 : 1;
    const tower = p.flatNumber?.toUpperCase().startsWith('B') ? 'B' : 'A';
    dropsByParcelId[p.id] = {
      parcelId: p.id,
      stopNumber: idx + 1,
      totalStops: active.length,
      tower,
      floor,
      dropsAhead: idx,
      stopsAhead: idx,
      etaMinutes: (idx + 1) * 3,
      etaLabel: idx === 0 ? '~1–2 mins' : `~${(idx + 1) * 3} mins`,
      isDoorstepNow: idx === 0,
      isNearby: idx <= 2,
      doorstepNudge: idx === 0 ? 'Reaching your door in ~1–2 mins' : null,
      currentServingFloor: floor,
      queueMessage: idx === 0 ? `Next up for Flat ${p.flatNumber} (Stop #1 of ${active.length})` : `Agent is ${idx} drop${idx === 1 ? '' : 's'} away · ~${idx * 3} mins`,
      batchSize: 1
    };
  });
  return {
    totalActiveDrops: active.length,
    totalStops: active.length,
    totalHolds: parcels.filter(p => p.status === 'RESCHEDULED').length,
    towerBatches: [
      { tower: 'A', drops: active.filter(p => !p.flatNumber?.toUpperCase().startsWith('B')).length, stops: 1 },
      { tower: 'B', drops: active.filter(p => p.flatNumber?.toUpperCase().startsWith('B')).length, stops: 1 }
    ],
    dropsByParcelId,
    routeStops: active.map((p, idx) => ({
      stopNumber: idx + 1,
      flatNumber: p.flatNumber,
      recipientName: p.recipientName,
      courier: p.courier,
      tower: p.flatNumber?.toUpperCase().startsWith('B') ? 'B' : 'A',
      floor: parseInt(p.flatNumber?.replace(/\D/g, '') || '101', 10) >= 200 ? 2 : 1,
      parcelIds: [p.id],
      isDone: false
    })),
    orderedParcelIds: active.map(p => p.id)
  };
}

export async function handleMockApi(url, method = 'GET', body = null) {
  let cleanPath = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  if (cleanPath.startsWith('/api')) {
    cleanPath = cleanPath.slice(4);
  }
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  const queryStr = url.includes('?') ? url.split('?')[1] : '';
  const query = new URLSearchParams(queryStr);
  const parcels = getStoredParcels();
  const users = getStoredUsers();

  // 1. AUTH: LOGIN
  if (cleanPath === '/auth/login' && method === 'POST') {
    const email = (body?.email || '').trim().toLowerCase();
    const matched = users.find(u => u.email.toLowerCase() === email) || {
      id: Math.floor(Math.random() * 9000) + 1000,
      name: email.includes('admin') ? 'Society Administrator' : email.includes('agent') ? 'Delivery Agent Partner' : `Resident (${email.split('@')[0]})`,
      email,
      role: email.includes('admin') ? 'ROLE_ADMIN' : email.includes('agent') ? 'ROLE_DELIVERY_AGENT' : 'ROLE_RESIDENT',
      flatNumber: email.includes('102') ? 'A-102' : email.includes('202') ? 'B-202' : 'A-101',
      active: true
    };
    return { token: 'mock-jwt-token-smartparcel', user: matched };
  }

  // 2. AUTH: REGISTER
  if (cleanPath === '/auth/register' && method === 'POST') {
    const newUser = {
      id: users.length + 10,
      name: body.name || 'New User',
      email: body.email,
      role: body.role || 'ROLE_RESIDENT',
      flatNumber: body.flatNumber || 'A-101',
      phone: body.phone || '',
      active: true
    };
    users.push(newUser);
    saveStoredUsers(users);
    return { token: 'mock-jwt-token-smartparcel', user: newUser };
  }

  // 3. AUTH: NEIGHBORS
  if (cleanPath === '/auth/neighbors') {
    const exclude = query.get('excludeFlat')?.toUpperCase() || '';
    return users.filter(u => u.role === 'ROLE_RESIDENT' && u.flatNumber?.toUpperCase() !== exclude);
  }

  // 4. AUTH: USERS
  if (cleanPath === '/auth/users') {
    return users;
  }

  // 5. PARCELS LIST
  if (cleanPath === '/parcels' && method === 'GET') {
    const role = query.get('role');
    const flat = query.get('flatNumber')?.toUpperCase();
    if (role === 'RESIDENT' && flat) {
      return parcels.filter(p => p.flatNumber?.toUpperCase() === flat || (p.delegated && p.delegateFlat?.toUpperCase() === flat));
    }
    return parcels;
  }

  // 6. ROUTE QUEUE
  if (cleanPath === '/parcels/route-queue') {
    return buildMockRouteQueue(parcels);
  }

  // 7. AGENT TRUST
  if (cleanPath === '/parcels/agent-trust') {
    return {
      overall: { averageRating: 4.9, totalRatings: 28, onTimePercentage: 98, totalDeliveries: 42 },
      byAgentId: {
        '2': { averageRating: 4.9, totalRatings: 28, onTimePercentage: 98, totalDeliveries: 42 }
      }
    };
  }

  // 8. STATS
  if (cleanPath === '/parcels/stats') {
    const total = parcels.length;
    const active = parcels.filter(p => p.status !== 'HANDED_OVER').length;
    const delivered = parcels.filter(p => p.status === 'HANDED_OVER').length;
    return {
      total,
      active,
      delivered,
      pending: active,
      courierBreakdown: [
        { courier: 'Amazon', count: parcels.filter(p => p.courier === 'Amazon').length },
        { courier: 'Blinkit', count: parcels.filter(p => p.courier === 'Blinkit').length },
        { courier: 'Myntra', count: parcels.filter(p => p.courier === 'Myntra').length },
        { courier: 'Flipkart', count: parcels.filter(p => p.courier === 'Flipkart').length },
        { courier: 'BlueDart', count: parcels.filter(p => p.courier === 'BlueDart').length }
      ],
      slaSummary: { totalCount: active, overdueCount: 0, expressFreshCount: 1, express15mCount: 1, itemsByParcelId: {} }
    };
  }

  // 9. MESSAGES SUMMARY
  if (cleanPath === '/parcels/messages-summary') {
    return {};
  }

  // 10. NOTIFICATIONS
  if (cleanPath === '/notifications' && method === 'GET') {
    return [
      {
        id: 1,
        title: 'Welcome to SmartParcel Preview',
        message: 'Standalone demo preview is active. Full offline interactivity is enabled for this deployment.',
        type: 'SYSTEM',
        read: false,
        createdAt: new Date().toISOString()
      }
    ];
  }
  if (cleanPath === '/notifications/unread-count') {
    return { count: 1 };
  }
  if (cleanPath === '/notifications/read-all') {
    return { message: 'All marked read' };
  }

  // 11. BUNDLE PARCELS
  if (cleanPath === '/parcels/bundle' && method === 'POST') {
    const ids = body?.parcelIds || [];
    const bCode = 'BDL-' + Math.floor(1000 + Math.random() * 9000);
    const mOtp = String(Math.floor(100000 + Math.random() * 900000));
    parcels.forEach(p => {
      if (ids.includes(p.id)) {
        p.bundled = true;
        p.bundleCode = bCode;
        p.bundleSize = ids.length;
        p.masterOtp = mOtp;
        p.slot = body.slot || p.slot;
        p.preferredDate = body.preferredDate || p.preferredDate;
        p.deliveryInstruction = body.deliveryInstruction || p.deliveryInstruction;
        p.status = 'SLOT_BOOKED';
      }
    });
    saveStoredParcels(parcels);
    return {
      message: `Bundled ${ids.length} parcels into Master Pass`,
      bundleCode: bCode,
      bundleSize: ids.length,
      masterOtp: mOtp,
      parcels: parcels.filter(p => ids.includes(p.id))
    };
  }

  // 12. BUNDLE HANDOVER
  if (cleanPath === '/parcels/bundle-handover' && method === 'POST') {
    const bCode = body?.bundleCode;
    const updated = [];
    parcels.forEach(p => {
      if (p.bundleCode === bCode) {
        p.status = 'HANDED_OVER';
        p.handedOverAt = new Date().toISOString();
        p.verifiedMethod = body.verifiedMethod || 'MASTER_PASS';
        updated.push(p);
      }
    });
    saveStoredParcels(parcels);
    return { message: `Handover completed for ${updated.length} bundled parcels`, count: updated.length, parcels: updated, verifiedMethod: body.verifiedMethod || 'MASTER_PASS' };
  }

  // 13. RETURN PICKUP
  if (cleanPath === '/parcels/return-pickup' && method === 'POST') {
    const returnOtp = String(Math.floor(100000 + Math.random() * 900000));
    const newReturn = {
      id: Date.now(),
      trackingNumber: 'RET-' + (body.courier || 'AMZ').toUpperCase().slice(0, 4) + '-' + Math.floor(10000 + Math.random() * 90000),
      courier: body.courier || 'Amazon',
      flatNumber: body.flatNumber || 'A-101',
      recipientName: body.recipientName || 'Resident',
      category: 'Return Package',
      description: `Customer Return (${body.returnReason || 'Size mismatch'})`,
      returnPickup: true,
      returnReason: body.returnReason || 'Size mismatch',
      returnOriginalTracking: body.originalTrackingNumber || '',
      returnStatus: 'SCHEDULED',
      returnOtp,
      demoOtp: returnOtp,
      slot: body.slot || '1:00 PM – 3:00 PM',
      preferredDate: body.preferredDate || 'Today',
      deliveryInstruction: body.deliveryInstruction || 'Hand over return package at doorstep',
      status: 'SLOT_BOOKED',
      receivedAt: new Date().toISOString()
    };
    parcels.unshift(newReturn);
    saveStoredParcels(parcels);
    return newReturn;
  }

  // 14. CONFIRM RETURN PICKUP
  const confirmReturnMatch = cleanPath.match(/^\/parcels\/(\d+)\/confirm-return-pickup$/);
  if (confirmReturnMatch && method === 'POST') {
    const id = parseInt(confirmReturnMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.status = 'HANDED_OVER';
      target.returnStatus = 'PICKED_UP';
      target.handedOverAt = new Date().toISOString();
      target.verifiedMethod = 'Reverse-Handover OTP';
      saveStoredParcels(parcels);
      return { message: 'Return parcel collected successfully', parcel: target, verifiedMethod: 'Reverse-Handover OTP' };
    }
  }

  // 15. BOOK SLOT
  const slotMatch = cleanPath.match(/^\/parcels\/(\d+)\/slot$/);
  if (slotMatch && method === 'POST') {
    const id = parseInt(slotMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.slot = body.slot;
      target.status = 'SLOT_BOOKED';
      saveStoredParcels(parcels);
      return target;
    }
  }

  // 16. RESCHEDULE
  const reschedMatch = cleanPath.match(/^\/parcels\/(\d+)\/reschedule$/);
  if (reschedMatch && method === 'POST') {
    const id = parseInt(reschedMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.slot = body.slot;
      target.preferredDate = body.preferredDate;
      target.rescheduleReason = body.rescheduleReason;
      target.status = 'RESCHEDULED';
      target.rescheduledOnce = true;
      saveStoredParcels(parcels);
      return target;
    }
  }

  // 17. HANDOVER / DELIVER
  const handoverMatch = cleanPath.match(/^\/parcels\/(\d+)\/handover$/);
  if (handoverMatch && method === 'POST') {
    const id = parseInt(handoverMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.status = 'HANDED_OVER';
      target.handedOverAt = new Date().toISOString();
      target.verifiedMethod = body.verifiedMethod || '6-Digit OTP';
      saveStoredParcels(parcels);
      return target;
    }
  }

  // 18. DELEGATE
  const delegateMatch = cleanPath.match(/^\/parcels\/(\d+)\/delegate$/);
  if (delegateMatch && method === 'POST') {
    const id = parseInt(delegateMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.delegated = true;
      target.delegateFlat = body.delegateFlat;
      target.delegateName = body.delegateName;
      target.delegatePhone = body.delegatePhone;
      target.delegateOtp = String(Math.floor(100000 + Math.random() * 900000));
      saveStoredParcels(parcels);
      return target;
    }
  }

  // 19. INSTRUCTION
  const instMatch = cleanPath.match(/^\/parcels\/(\d+)\/instruction$/);
  if (instMatch && method === 'POST') {
    const id = parseInt(instMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.deliveryInstruction = body.deliveryInstruction;
      saveStoredParcels(parcels);
      return target;
    }
  }

  // 20. RATE
  const rateMatch = cleanPath.match(/^\/parcels\/(\d+)\/rate$/);
  if (rateMatch && method === 'POST') {
    const id = parseInt(rateMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.deliveryRating = body.rating;
      target.ratingComment = body.comment;
      target.ratingTags = body.tags ? body.tags.join(',') : '';
      target.ratedAt = new Date().toISOString();
      saveStoredParcels(parcels);
      return target;
    }
  }

  // 21. CREATE PARCEL
  if (cleanPath === '/parcels' && method === 'POST') {
    const newP = {
      id: Date.now(),
      trackingNumber: body.trackingNumber || 'PKG-' + Math.floor(1000 + Math.random() * 9000),
      courier: body.courier || 'Amazon',
      flatNumber: body.flatNumber || 'A-101',
      recipientName: body.recipientName || 'Resident',
      category: body.category || 'General Package',
      description: body.description || '',
      status: 'RECEIVED',
      slot: null,
      demoOtp: String(Math.floor(100000 + Math.random() * 900000)),
      receivedAt: new Date().toISOString()
    };
    parcels.unshift(newP);
    saveStoredParcels(parcels);
    return newP;
  }

  // 22. USER PREFERENCES
  if (cleanPath.includes('/preferences')) {
    return {
      defaultInstruction: 'Hand over personally',
      defaultSlot: '4:00 PM – 6:00 PM',
      quietHoursEnabled: false,
      vacationMode: false
    };
  }

  // 23. CONFIRM SCHEDULE
  const confirmSchedMatch = cleanPath.match(/^\/parcels\/(\d+)\/confirm-schedule$/);
  if (confirmSchedMatch && method === 'POST') {
    const id = parseInt(confirmSchedMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.agentScheduleConfirmed = true;
      target.agentScheduleConfirmedAt = new Date().toISOString();
      target.agentScheduleConfirmMessage = body?.note || 'Schedule confirmed by Delivery Agent';
      saveStoredParcels(parcels);
      return target;
    }
  }

  // 24. ISSUE REPORTING & DISPUTES
  const issueMatch = cleanPath.match(/^\/parcels\/(\d+)\/issue$/);
  if (issueMatch && method === 'POST') {
    const id = parseInt(issueMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.issueReported = true;
      target.issueCategory = body?.issueCategory || 'Package issue';
      target.issueNotes = body?.issueNotes || '';
      target.issueStatus = 'OPEN';
      saveStoredParcels(parcels);
      return target;
    }
  }

  const resolveMatch = cleanPath.match(/^\/parcels\/(\d+)\/resolve-issue$/);
  if (resolveMatch && method === 'POST') {
    const id = parseInt(resolveMatch[1], 10);
    const target = parcels.find(p => p.id === id);
    if (target) {
      target.issueStatus = 'RESOLVED';
      saveStoredParcels(parcels);
      return target;
    }
  }

  // 25. CHAT MESSAGES
  const msgMatch = cleanPath.match(/^\/parcels\/(\d+)\/messages$/);
  if (msgMatch) {
    if (method === 'GET') return [];
    if (method === 'POST') {
      return { id: Date.now(), parcelId: parseInt(msgMatch[1], 10), content: body?.content || '', senderName: body?.senderName || 'User', createdAt: new Date().toISOString() };
    }
  }

  // 26. SLA ESCALATION
  if (cleanPath.includes('escalate')) {
    return { message: 'SLA escalated successfully', count: 1 };
  }

  // Default empty object
  return {};
}

