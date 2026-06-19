const CACHE_NAME = 'megawash-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json',
  '/css/main.css',
  '/css/admin.css',
  '/css/employee.css',
  '/js/auth.js',
  '/js/i18n.js',
  '/employee/keypad.html',
  '/js/employee/keypad.js'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching critical assets.');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache.');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);

  // Bypass service worker caching for API calls
  if (reqUrl.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first with Cache-fallback for other static assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache new successful requests
        if (response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network is down/offline
        return caches.match(event.request);
      })
  );
});
