// Minimal service worker for development/testing
const CACHE_NAME = 'edueaz-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

// Simple fetch handler: network-first for navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // For navigation requests, try network first then fallback to cache/offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // For other requests, try cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          // Optionally cache new resources
          if (!request.url.startsWith('http')) return res;
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match('/offline.html'));
    })
  );
});
