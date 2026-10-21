const CACHE_NAME = "ubsi-pwa-v2";
const PRECACHE_URLS = ["/offline.html", "/manifest.webmanifest", "/pwa/icon-192.png", "/pwa/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/dashboard") || url.pathname === "/login") return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/pwa/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || fetched;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
  }
});

// W3C Web Push: tampilkan notifikasi native saat push masuk di background
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "UBSI API", body: event.data ? event.data.text() : "Notifikasi baru" };
  }
  const title = payload.title || "UBSI API";
  const options = {
    body: payload.body || "",
    icon: "/pwa/icon-192.png",
    badge: "/pwa/icon-192.png",
    tag: payload.tag || "ubsi-general",
    renotify: true,
    vibrate: [120, 60, 120],
    timestamp: Date.now(),
    // Pengingat absen tetap di layar sampai disentuh, supaya tidak terlewat.
    requireInteraction: typeof payload.tag === "string" && payload.tag.indexOf("absen-") === 0,
    data: { url: payload.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url ? event.notification.data.url : "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
