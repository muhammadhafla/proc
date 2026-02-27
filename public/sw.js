// Procurement System - Service Worker (Simplified for Online-Only)
// Only caches static assets, no offline API support

const CACHE_NAME = 'procurement-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/128x128@2x.png',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching assets');
      return cache.addAll(ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Fetch event - for navigation, try network first
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests (API calls, uploads)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isExternal = url.origin !== self.location.origin;
  const isNavigation = event.request.mode === 'navigate';
  
  // For external requests, let browser handle them directly (don't intercept)
  if (isExternal) {
    return; // Let the browser handle external requests natively
  }
  
  // For navigation requests (HTML pages), try network first
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Fallback to cache if network fails
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For other requests (assets), use network-first strategy with fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for assets
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no cache, return a fallback for CSS/JS
          if (event.request.url.includes('.css')) {
            return new Response('', { status: 200, statusText: 'OK' });
          }
          // For other assets, just let it fail
          return new Response('Asset not available', { status: 404 });
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('Service Worker: Clearing old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control immediately
        return self.clients.claim();
      })
  );
});
