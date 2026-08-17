const CACHE = 'raincheck-v11';
const CORE = [
  './', './index.html', './manifest.json',
  './styles/base.css', './styles/components.css', './styles/responsive.css',
  './src/app.js?v=11.4.2', './src/core/config.js?v=11.4.2', './src/core/storage.js?v=11.4.2',
  './src/api/weather.js?v=11.4.2', './src/api/geocoding.js?v=11.4.2', './src/api/history.js?v=11.4.2',
  './src/features/intelligence.js?v=11.4.2', './src/features/notifications.js?v=11.4.2',
  './src/features/forecast.js?v=11.4.2', './src/features/timeline.js?v=11.4.2',
  './src/features/planner.js?v=11.4.2', './src/features/share.js?v=11.4.2', './src/features/map.js?v=11.4.2',
  './src/ui/render.js?v=11.4.2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('raincheck-') && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const request = event.request;
  const isNavigation = request.mode === 'navigate';
  const isCode = /\.(?:js|css)$/.test(url.pathname);

  // Always ask the network for HTML/JS/CSS first so releases cannot get stuck
  // behind a stale browser or service-worker cache. Cached copies are fallback only.
  if (isNavigation || isCode) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then(response => response || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      }))
      .catch(() => caches.match('./index.html'))
  );
});
