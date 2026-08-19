/**
 * KN Reminder — Service Worker
 * Version: 1.0.0
 *
 * Caching strategy:
 *   • Static assets (JS, CSS, fonts, icons) → Cache-First
 *   • API calls (/api/*)                    → Network-First (fallback to cache)
 *   • Navigation requests (HTML)            → Network-First (offline fallback: /index.html)
 *
 * Cache names are versioned — bump CACHE_VERSION to force a full cache refresh on deploy.
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE  = `kn-reminder-static-${CACHE_VERSION}`;
const API_CACHE     = `kn-reminder-api-${CACHE_VERSION}`;
const ALL_CACHES    = [STATIC_CACHE, API_CACHE];

// ─── Static assets to pre-cache on install ────────────────────────────────────
// Vite injects hashed filenames into /assets/ — we pre-cache the shell only.
// Vite-built assets are cached dynamically on first fetch.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing cache: ${STATIC_CACHE}`);
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => {
        // Skip waiting so the new SW activates immediately
        self.skipWaiting();
      })
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating — cleaning old caches`);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => {
              console.log(`[SW] Deleting old cache: ${key}`);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim()) // Take control of all open tabs immediately
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from our own origin or Google Fonts
  const isGoogleFont = url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com';
  
  if (request.method !== 'GET' || (url.origin !== self.location.origin && !isGoogleFont)) {
    return;
  }

  // ── API requests: Network-First ──────────────────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // ── Navigation (HTML) requests: Network-First, offline → /index.html ────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          return cache.match('/index.html');
        })
    );
    return;
  }

  // ── Static assets (JS/CSS/fonts/images): Cache-First ─────────────────────
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

/**
 * Cache-First: Serve from cache, fall back to network and then store in cache.
 * Best for versioned/hashed static assets that never change at a URL.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    // Only cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Return a generic offline response for images/assets
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

/**
 * Network-First: Try network, fall back to cache on failure.
 * Best for API data that should be fresh but still usable offline.
 *
 * @param {Request} request
 * @param {string}  cacheName
 * @param {number}  timeoutMs - Abort network if it takes longer than this (ms)
 */
async function networkFirst(request, cacheName, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    clearTimeout(timeoutId);
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return a structured offline JSON response for API calls
    return new Response(
      JSON.stringify({
        success: false,
        message: 'אין חיבור לאינטרנט — מציג נתונים מהמטמון',
        offline: true,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ─── Push notifications (future) ──────────────────────────────────────────────
// iOS 16.4+ supports Web Push for installed PWAs.
// The backend Agenda.js + Telegram Bot covers notifications for now.
// This handler is scaffolded for future native push support.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '🔔 תזכורת', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      vibrate: [200, 100, 200],
      tag: data.tag,
      renotify: Boolean(data.tag),
      timestamp: Date.now(),
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-actions') {
    // Send a message to all connected clients to trigger their queue processor
    // (since the DB is complex and we rely on React Query, we let the client tab do the work if it's open)
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(windowClients => {
        for (const client of windowClients) {
          client.postMessage({ type: 'SYNC_NOW' });
        }
      })
    );
  }
});
