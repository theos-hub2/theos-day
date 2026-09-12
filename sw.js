/* theo's day — service worker
   Bump CACHE_VERSION whenever you change index.html so the new version installs. */

const CACHE_VERSION = 'v46';
const SHELL_CACHE = `td-shell-${CACHE_VERSION}`;
const FONT_CACHE = 'td-fonts';
const COVER_CACHE = 'td-covers';

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app-core.js',
  './app-hobbies.js',
  './app-reading.js',
  './app-drawing.js',
  './app-gym.js',
  './app-sync.js',
  './app-boot.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png'
];

// ── INSTALL: pre-cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll fails all-or-nothing, so add individually and tolerate misses
      .then(cache => Promise.all(
        SHELL_ASSETS.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: drop old shell caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.map(k => {
          if (k.startsWith('td-shell-') && k !== SHELL_CACHE) return caches.delete(k);
          return null;
        })
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google Fonts: stale-while-revalidate so the app still looks right offline
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  // Book covers — cache once so the shelf works offline and doesn't re-fetch
  if (url.hostname === 'covers.openlibrary.org') {
    event.respondWith(staleWhileRevalidate(req, COVER_CACHE));
    return;
  }

  // Anything else cross-origin (e.g. api.chess.com) — always live, never cached.
  // If it fails offline the app already handles that gracefully.
  if (url.origin !== self.location.origin) return;

  // Navigations: serve the cached shell instantly, refresh in the background
  if (req.mode === 'navigate') {
    event.respondWith(
      staleWhileRevalidate(req, SHELL_CACHE)
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin assets
  event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
});

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);

      return cached || network;
    })
  );
}

// ── PUSH NOTIFICATIONS ──

self.addEventListener('push', event => {
  let data = { title: 'Time to check in', body: '' };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (e) {}
  // an empty body means one bold line under the app name, rather than two
  if (!data.title) { data.title = data.body || 'Time to check in'; data.body = ''; }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag || 'theos-day',
      renotify: true,
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

// Allow the page to trigger an immediate update
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
