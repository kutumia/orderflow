// OrderFlow Service Worker — cache static assets, network-first for API
const CACHE_NAME = "orderflow-v1";
const STATIC_ASSETS = ["/offline.html"];

// Install: pre-cache minimal offline fallback
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // API calls: network-first with cache fallback (menu data stays fresh)
  if (url.pathname.startsWith("/api/restaurants")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation: network-first, offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html"))
    );
  }
});

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "OrderFlow";
  const options = {
    body: data.body || "You have an update",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: data.url ? { url: data.url } : undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(self.clients.openWindow(url));
  }
});
