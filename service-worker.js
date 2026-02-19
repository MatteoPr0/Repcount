/* AuraFit Service Worker (v152)
   Strategy:
   - index.html / navigations: network-first (fresh), fallback to cache (offline)
   - other same-origin assets: cache-first
   - versioned cache + automatic cleanup (no need to clear app or lose data)
*/
const CACHE_NAME = 'aurafit-cache-v153';
const PRECACHE = ['./', './index.html', './manifest.json', './service-worker.js', './icon-192.png', './icon-512.png', './icon-512-maskable.png', './apple-touch-icon.png', './favicon-16.png', './favicon-32.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache core shell (best effort)
    await cache.addAll(PRECACHE);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.destination === 'document') ||
         (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations / index.html
  if (isNavigationRequest(req) || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        // fallback to cached index.html
        const cachedIndex = await caches.match('./index.html');
        return cachedIndex || Response.error();
      }
    })());
    return;
  }

  // Cache-first for other requests (GET only)
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    // Cache successful basic responses only
    try {
      if (res && res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
    } catch (e) {}
    return res;
  })());
});
