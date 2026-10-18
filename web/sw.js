// Keeps a copy of the page on the tablet so it opens with no signal.
// Only used when the page is reached over https (browsers' rule).
const CACHE = 'roadtrip-v2';
const FILES = ['./', 'index.html', 'style.css', 'games.js', 'app.js', 'icon.svg', 'manifest.json', 'vendor/leaflet.js', 'vendor/leaflet.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Page files: try the server first (to pick up updates), fall back to the copy.
// The api is never cached; the page handles being offline itself.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
