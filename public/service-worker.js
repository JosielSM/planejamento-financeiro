const SHELL_CACHE = "planejamento-financeiro-shell-v3";
const RUNTIME_CACHE = "planejamento-financeiro-runtime-v3";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/vendor/firebase/firebase-app-compat.js",
  "/vendor/firebase/firebase-auth-compat.js",
  "/css/base.css",
  "/css/dashboard.css",
  "/css/goals.css",
  "/css/transactions.css",
  "/css/dialogs.css",
  "/css/responsive.css",
  "/css/themes.css",
  "/js/01-foundation.js",
  "/js/02-data.js",
  "/js/03-dashboard.js",
  "/js/04-ui.js",
  "/js/05-reports.js",
  "/js/06-goal-form.js",
  "/js/07-events.js",
  "/js/08-pwa.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-64.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put("/", response.clone()));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  const cacheableLibrary = request.destination === "script"
    && ["cdn.jsdelivr.net", "unpkg.com"].includes(url.hostname);
  if (cacheableLibrary) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request)),
    );
  }
});
