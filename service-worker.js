const CACHE_NAME = 'trip-tally-static-v3';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './mobile.css',
  './app.js',
  './manifest.webmanifest',
  './icons/trip-tally-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('trip-tally-static-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(response => {
      if (!response || response.status !== 200 || response.type !== 'basic') return response;
      return caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()).then(() => response));
    }).catch(() => caches.match(event.request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error();
    }))
  );
});
