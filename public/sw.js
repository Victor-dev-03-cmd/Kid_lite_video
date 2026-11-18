const CACHE_NAME = 'kidlite-offline-v17';
const OFFLINE_ASSETS = ['/', '/index.html', '/styles.css', '/auth.css', '/app.js', '/shorts.js', '/install.js', '/catalogue.js', '/freshness.js', '/auth.js', '/offline-games.js', '/manifest.json', '/icons/icon.svg', '/icons/maskable.svg', '/icons/kidlite-mark.svg', '/art/rhymes.svg', '/art/stories.svg', '/art/science.svg', '/art/shorts.svg', '/art/games.svg', '/art/offline.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Never cache YouTube, Clerk, API requests, or other origins.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') { event.respondWith(fetch(request).catch(() => caches.match('/index.html'))); return; }
  event.respondWith(fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy))); }
    return response;
  }).catch(() => caches.match(request)));
});
