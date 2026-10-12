/* Weekly Quiz — Service Worker
 * Strategy:
 *  • Shell (HTML)  → Cache-first, background revalidate
 *  • Static assets → Cache-first
 *  • /api/*        → Network-only (never cache quiz data)
 *  • Offline       → Return cached shell so user sees a message, not a blank screen
 */
const CACHE = 'quiz-v1';
const SHELL  = ['/', '/manifest.json', '/icon.svg'];

/* ── Install: pre-cache the app shell ──────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: evict old caches ─────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ──────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API calls: always go to the network — never serve stale quiz data from cache.
  if (url.pathname.startsWith('/api/')) return;

  // Everything else: cache-first, fall back to network, fall back to cached shell.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Revalidate in the background so the next visit is fresh.
        fetch(request).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(request, res));
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => caches.match('/'));   // offline fallback → show shell
    })
  );
});
