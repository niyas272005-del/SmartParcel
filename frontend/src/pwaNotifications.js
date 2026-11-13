export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (err) {
    return null;
  }
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone === true
  );
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await Notification.requestPermission();
  } catch (err) {
    return 'denied';
  }
}

export async function dispatchPwaNotification({
  title,
  body,
  tag = 'smartparcel-alert',
  parcelId = null,
  requireInteraction = false
}) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        if (typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag,
            renotify: true,
            requireInteraction,
            data: { parcelId }
          });
          return true;
        }
        if (reg.active) {
          reg.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            payload: { title, body, tag, parcelId, requireInteraction }
          });
          return true;
        }
      }
    }
    const notif = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag
    });
    notif.onclick = () => {
      try {
        window.focus();
      } catch (e) {}
      notif.close();
    };
    return true;
  } catch (err) {
    return false;
  }
}

