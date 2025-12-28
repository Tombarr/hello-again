/**
 * Service Worker for Hello Again
 * Caches Mapbox API requests and image data for offline support
 */

const CACHE_VERSION = "v1";
const MAPBOX_CACHE = `mapbox-cache-${CACHE_VERSION}`;
const IMAGE_CACHE = `image-cache-${CACHE_VERSION}`;
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;

// Cache limits
const MAX_MAPBOX_ITEMS = 500; // Mapbox tiles
const MAX_IMAGE_ITEMS = 100; // Images
const MAX_AGE_DAYS = 7; // Cache expiry

/**
 * Install event - cache essential resources
 */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");

  event.waitUntil(
    Promise.all([
      caches.open(MAPBOX_CACHE),
      caches.open(IMAGE_CACHE),
      caches.open(STATIC_CACHE),
    ]).then(() => {
      console.log("[SW] Caches created");
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (
            cacheName.startsWith("mapbox-cache-") &&
            cacheName !== MAPBOX_CACHE
          ) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
          if (
            cacheName.startsWith("image-cache-") &&
            cacheName !== IMAGE_CACHE
          ) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
          if (
            cacheName.startsWith("static-cache-") &&
            cacheName !== STATIC_CACHE
          ) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - intercept and cache network requests
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  // Handle Mapbox API requests
  if (url.hostname.includes("api.mapbox.com")) {
    event.respondWith(handleMapboxRequest(request));
    return;
  }

  // Handle image requests
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // For other requests, use network-first strategy
  event.respondWith(
    fetch(request).catch(() => {
      // If offline, try to serve from cache
      return caches.match(request);
    })
  );
});

/**
 * Handle Mapbox API requests with cache-first strategy
 */
async function handleMapboxRequest(request) {
  const cache = await caches.open(MAPBOX_CACHE);

  // Try to get from cache first
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Check if cache is still fresh
    const cachedDate = new Date(
      cachedResponse.headers.get("sw-cached-date") || 0
    );
    const now = new Date();
    const ageInDays = (now - cachedDate) / (1000 * 60 * 60 * 24);

    if (ageInDays < MAX_AGE_DAYS) {
      console.log("[SW] Serving Mapbox from cache:", request.url);
      return cachedResponse;
    } else {
      // Cache expired, delete it
      await cache.delete(request);
    }
  }

  // Fetch from network
  try {
    console.log("[SW] Fetching Mapbox from network:", request.url);
    const response = await fetch(request);

    // Only cache successful responses
    if (response && response.status === 200) {
      // Clone the response and add cache date header
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set("sw-cached-date", new Date().toISOString());

      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });

      // Cache the response
      cache.put(request, modifiedResponse);

      // Limit cache size
      await limitCacheSize(MAPBOX_CACHE, MAX_MAPBOX_ITEMS);
    }

    return response;
  } catch (error) {
    console.error("[SW] Mapbox fetch failed:", error);
    // Return cached version even if expired
    return cachedResponse || new Response("Network error", { status: 503 });
  }
}

/**
 * Handle image requests with cache-first strategy
 */
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);

  // Try to get from cache first
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    console.log("[SW] Serving image from cache:", request.url);
    return cachedResponse;
  }

  // Fetch from network
  try {
    console.log("[SW] Fetching image from network:", request.url);
    const response = await fetch(request);

    // Only cache successful responses
    if (response && response.status === 200) {
      // Clone and cache the response
      cache.put(request, response.clone());

      // Limit cache size
      await limitCacheSize(IMAGE_CACHE, MAX_IMAGE_ITEMS);
    }

    return response;
  } catch (error) {
    console.error("[SW] Image fetch failed:", error);
    return new Response("Network error", { status: 503 });
  }
}

/**
 * Check if a request is for an image
 */
function isImageRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();

  // Check file extension
  if (
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  ) {
    return true;
  }

  // Check content-type header if available
  const contentType = request.headers.get("accept") || "";
  if (contentType.includes("image/")) {
    return true;
  }

  return false;
}

/**
 * Limit cache size by removing oldest items
 */
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    console.log(
      `[SW] Cache ${cacheName} exceeds ${maxItems} items, cleaning up...`
    );

    // Remove oldest items (FIFO)
    const itemsToDelete = keys.length - maxItems;
    for (let i = 0; i < itemsToDelete; i++) {
      await cache.delete(keys[i]);
    }
  }
}

/**
 * Message event - handle messages from clients
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_CACHE") {
    console.log("[SW] Clearing all caches...");

    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }

  if (event.data && event.data.type === "GET_CACHE_SIZE") {
    event.waitUntil(
      Promise.all([
        getCacheSize(MAPBOX_CACHE),
        getCacheSize(IMAGE_CACHE),
        getCacheSize(STATIC_CACHE),
      ]).then(([mapboxSize, imageSize, staticSize]) => {
        event.ports[0].postMessage({
          mapbox: mapboxSize,
          images: imageSize,
          static: staticSize,
          total: mapboxSize + imageSize + staticSize,
        });
      })
    );
  }
});

/**
 * Get cache size in bytes
 */
async function getCacheSize(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  let totalSize = 0;

  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }

  return totalSize;
}

console.log("[SW] Service Worker loaded");
