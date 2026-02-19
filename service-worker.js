/* AuraFit Service Worker (simple precache) */
const CACHE_NAME = 'aurafit-cache-v4';
const PRECACHE_URLS = [
  './index.html?ver=8',
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon-16.png',
  'https://unpkg.com/react@18/umd/react.production.min.js', 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', 'https://unpkg.com/@babel/standalone/babel.min.js', 'https://cdn.tailwindcss.com', 'https://unpkg.com/lucide@0.542.0', 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Use no-cors so CDN requests can be cached as opaque responses
    await Promise.allSettled(PRECACHE_URLS.map(async (url) => {
      try {
        const req = new Request(url, { mode: 'no-cors' });
        const res = await fetch(req);
        await cache.put(url, res);
      } catch (e) {
        // best effort
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GET
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Cache same-origin assets
      const url = new URL(req.url);
      if (url.origin === location.origin) {
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      // Fallback to app shell
      const shell = await cache.match('./index.html');
      return shell || new Response('Offline', { status: 503, headers: { 'Content-Type':'text/plain' } });
    }
  })());
});
