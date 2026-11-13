const CACHE_NAME = 'smartparcel-express-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(networkResp => {
        if (networkResp && networkResp.status === 200 && networkResp.type === 'basic') {
          const clone = networkResp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
        }
        return networkResp;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
  );
});

self.addEventListener('push', event => {
  let payload = {
    title: 'SmartParcel Express Update',
    body: 'Check your Express Pass for a live parcel or OTP update.'
  };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || 'smartparcel-push',
      renotify: true,
      data: payload.data || {}
    })
  );
});

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return;
  const payload = event.data.payload || {};
  event.waitUntil(
    self.registration.showNotification(payload.title || 'SmartParcel Alert', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || 'smartparcel-alert',
      renotify: true,
      requireInteraction: Boolean(payload.requireInteraction),
      data: { parcelId: payload.parcelId || null }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const parcelId = event.notification?.data?.parcelId || null;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (parcelId) {
            client.postMessage({ type: 'OPEN_PARCEL', parcelId });
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return null;
    })
  );
});

