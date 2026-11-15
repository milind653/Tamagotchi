// Tamagotchi service worker: offline app shell, never caches the API.
const VERSION = 'v1';
const SHELL = `tama-shell-${VERSION}`;
const RUNTIME = `tama-runtime-${VERSION}`;
const PRECACHE = [
  '/', '/play', '/offline.html', '/style.css', '/app.css', '/landing.css',
  '/app.js', '/landing.js', '/pwa.js', '/sheet.js', '/sprites.js', '/pet3d.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, RUNTIME].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || (await cache.match(fallbackUrl));
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fresh;
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (/(^|\.)(googleapis|gstatic)\.com$/.test(url.hostname)) {
      event.respondWith(staleWhileRevalidate(request, RUNTIME));
    }
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'You appear to be offline.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/offline.html'));
    return;
  }
  if (url.pathname.startsWith('/vendor/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, SHELL));
});
