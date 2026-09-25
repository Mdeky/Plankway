/* Bridgle service worker. The bridgle-sw plugin in vite.config.ts fills in the two
 * placeholders below with the build hash and the list of built files. */
const VERSION = __VERSION__;
const PRECACHE = __PRECACHE__;
const STATIC_CACHE = `bridgle-static-${VERSION}`;
const DAILY_CACHE = 'bridgle-daily-v1';

self.addEventListener('install', (event) => {
  // Everything the app needs to run offline, including the endless generator worker.
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('bridgle-static-') && k !== STATIC_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// The page asks the waiting worker to take over when the player taps "reload".
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ads, analytics: straight to the network

  if (url.pathname.startsWith('/api/')) {
    // Daily puzzles never change once published: network first, cached copy offline.
    if (url.pathname.startsWith('/api/daily/')) event.respondWith(networkFirst(req, DAILY_CACHE));
    return; // everything else under /api: network only
  }

  if (req.mode === 'navigate') {
    // Fresh HTML when online, the cached app shell when offline.
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('/index.html', { cacheName: STATIC_CACHE, ignoreVary: true })) || Response.error()),
    );
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  // ignoreVary: module scripts are requested with an Origin header, precaching without one;
  // servers that send 'Vary: Origin' would otherwise never match.
  const cached = await caches.match(req, { cacheName: STATIC_CACHE, ignoreVary: true });
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreVary: true })) || Response.error();
  }
}
