/* theo's day — service worker
   Bump CACHE_VERSION whenever you change index.html so the new version installs. */

const CACHE_VERSION = 'v11';
const SHELL_CACHE = `td-shell-${CACHE_VERSION}`;
const FONT_CACHE = 'td-fonts';

const SHELL_ASSETS = [
  './',
  './index.html',
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

// Allow the page to trigger an immediate update
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
