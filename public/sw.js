const CACHE_NAME = 'kidlite-offline-v3';
const OFFLINE_ASSETS = ['/', '/index.html', '/styles.css', '/auth.css', '/app.js', '/auth.js', '/offline-games.js', '/manifest.json', '/icons/icon.svg', '/icons/maskable.svg', '/art/rhymes.svg', '/art/stories.svg', '/art/science.svg', '/art/shorts.svg', '/art/games.svg', '/art/offline.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }
  // Network-first for local shell assets so styling updates don't remain stuck in an older cache.
  event.respondWith(fetch(req).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(req, copy)));
    }
    return response;
  }).catch(() => caches.match(req)));
});
