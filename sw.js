// Service Worker for RainCheck Weather App — Auto-Update Edition
const CACHE_NAME = 'raincheck-v7';
const APP_SHELL = [
    './',
    './index.html',
    './styles.css?v=5.1',
    './script.js?v=5.1',
    './manifest.json'
];
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap'
];

// Install — cache app shell immediately
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            // Cache CDN assets (best-effort)
            CDN_ASSETS.forEach(url => cache.add(url).catch(() => {}));
            // Cache app shell
            return cache.addAll(APP_SHELL).catch(() => Promise.resolve());
        })
    );
    // Activate immediately, don't wait for old tabs to close
    self.skipWaiting();
});

// Activate — delete ALL old caches and take control
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            );
        }).then(function() {
            // Notify all open tabs that an update is ready
            return self.clients.matchAll({ type: 'window' }).then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
                });
            });
        })
    );
    return self.clients.claim();
});

// Fetch — NETWORK FIRST for app files, CACHE FIRST for CDN/fonts/images
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // For our own app files (HTML, CSS, JS) — always try network first
    const isAppFile = url.origin === self.location.origin;

    if (isAppFile) {
        event.respondWith(
            fetch(event.request).then(function(response) {
                // Got fresh response — update cache
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(function() {
                // Network failed — serve from cache (offline support)
                return caches.match(event.request).then(function(cached) {
                    return cached || new Response('Offline — please reconnect', {
                        status: 503, statusText: 'Offline'
                    });
                });
            })
        );
    } else {
        // CDN assets (fonts, icons, tiles) — cache first for speed
        event.respondWith(
            caches.match(event.request).then(function(cached) {
                return cached || fetch(event.request).then(function(response) {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    }
                    return response;
                }).catch(function() {
                    return new Response('', { status: 408 });
                });
            })
        );
    }
});

// Listen for skip-waiting messages from the app
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});