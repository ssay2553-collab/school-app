// Enhanced service worker for EduEaz PWA with fresh data fetching
const CACHE_NAME = "edueaz-cache-v2";
const PRECACHE_URLS = ["/", "/index.html", "/offline.html"];

// API patterns that should always use network-first
const API_PATTERNS = [
  "/api/",
  "/firestore/",
  "/auth/",
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
];

// Static assets that can be cached longer
const STATIC_ASSET_PATTERNS = [
  ".js",
  ".css",
  ".woff",
  ".woff2",
  ".ttf",
  "/icons/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_CACHE") {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
          return null;
        }),
      ),
    ),
  );
  self.clients.claim();
});

// Helper to check if URL matches any pattern
function matchesPattern(url, patterns) {
  return patterns.some((pattern) => url.includes(pattern));
}

// Network-first strategy for API requests
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return offline page for navigation, empty response otherwise
    if (request.mode === "navigate") {
      return caches.match("/offline.html");
    }
    return new Response("", { status: 503 });
  }
}

// Cache-first strategy with revalidation for static assets
async function cacheFirstWithRevalidation(request) {
  const cached = await caches.match(request);

  // Start network request in background to update cache
  fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response);
      }
    })
    .catch(() => {
      // Silently fail background update
    });

  if (cached) return cached;

  // No cache, fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response("", { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Navigation requests - network first
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // API requests - always network first to ensure fresh data
  if (matchesPattern(url, API_PATTERNS)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - cache first with background revalidation
  if (matchesPattern(url, STATIC_ASSET_PATTERNS)) {
    event.respondWith(cacheFirstWithRevalidation(request));
    return;
  }

  // Default - network first for everything else
  event.respondWith(networkFirst(request));
});

// Background sync for offline actions (if supported)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-data") {
    event.waitUntil(
      // Process any pending offline actions
      Promise.resolve(),
    );
  }
});
