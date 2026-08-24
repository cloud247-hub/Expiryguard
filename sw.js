'use strict';

const CACHE = 'expiryguard-v5-2-0-teams-notifications';
const STATIC_ASSETS = [
  './styles.css',
  './app.js',
  './i18n.js',
  './assets/cloud247-logo.svg',
  './assets/cloud247-mark.svg',
  './assets/favicon.svg'
];
const STATIC_URLS = new Set(STATIC_ASSETS.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {}));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('expiryguard-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // V5.2.0 security rule: never intercept/cache API calls, OAuth calls,
  // cross-origin traffic, navigations, config.js or authenticated requests.
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('Authorization')) return;
  if (request.mode === 'navigate' || request.destination === 'document') return;
  if (!STATIC_URLS.has(url.href)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { cacheName: CACHE });
    if (cached) return cached;
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  let target = new URL('./', self.registration.scope);
  try {
    const requested = new URL(event.notification?.data?.url || './', self.registration.scope);
    if (requested.origin === self.location.origin) target = requested;
  } catch {}

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) {
        client.navigate?.(target.href);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target.href);
  }));
});
