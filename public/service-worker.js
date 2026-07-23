const CACHE_VERSION = "planejamento-financeiro-pwa-v1.6.0";
const APP_SHELL = [
  "/", "/manifest.webmanifest", "/icons/apple-touch-icon.png", "/icons/favicon-64.png",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png",
  "/css/base.css", "/css/dashboard.css", "/css/dialogs.css", "/css/goals.css",
  "/css/responsive.css", "/css/themes.css", "/css/transactions.css",
  "/js/00-runtime.js", "/js/01-foundation.js", "/js/02-data.js", "/js/03-dashboard.js",
  "/js/04-ui.js", "/js/05-reports.js", "/js/06-goal-form.js", "/js/07-events.js", "/js/08-platform.js",
  "/vendor/firebase/firebase-app-compat.js", "/vendor/firebase/firebase-auth-compat.js",
  "/vendor/lucide/lucide.min.js", "/vendor/jspdf/jspdf.umd.min.js",
  "/vendor/jspdf-autotable/jspdf.plugin.autotable.min.js", "/vendor/exceljs/exceljs.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then(async (cache) => {
    await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  }));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("planejamento-financeiro-pwa-") && key !== CACHE_VERSION).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/download/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy));
      return response;
    }).catch(async () => (await caches.match("/")) || new Response("Aplicativo indisponível. Conecte-se à internet e tente novamente.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
