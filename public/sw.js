// Procurement System - Service Worker (Simplified for Online-Only)
// Only caches static assets, no offline API support

const CACHE_NAME = 'procurement-v1';
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

  // For navigation requests (HTML pages), try network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Fallback to cache if network fails
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For other requests (assets), use cache-first strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      
      // Not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses for assets
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('Service Worker: Clearing old cache:', name);
            return caches.delete(name);
          });
      );
    }).then(() => {
      // Take control immediately
      return self.clients.claim();
    })
  );
});
