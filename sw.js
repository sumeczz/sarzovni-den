const CACHE_VERSION = "sarzovni-mobile-v1.4.1";
const PRECACHE = [
  "./", "./index.html", "./manifest.webmanifest", "./css/mobile-app.css", "./js/mobile-app.js",
  "./pwa/index.html", "./pwa/app.js", "./pwa/store.js", "./pwa/styles.css",
  "./pwa/big.html", "./pwa/big.js", "./pwa/manifest.webmanifest",
  "./creator.html", "./workbench.html", "./settings.html", "./print.html",
  "./css/creator.css", "./css/workbench.css", "./css/workbench-extra.css", "./css/menu.css",
  "./css/settings.css", "./css/print.css",
  "./js/core.js", "./js/code128.js", "./js/label.js", "./js/storage.js", "./js/config.js",
  "./js/print.js", "./js/creator.js", "./js/workbench.js", "./js/settings.js",
  "./js/sap-import.js", "./js/xlsx-import.js", "./js/label-model.js", "./js/quality.js",
  "./js/qr-svg.js", "./js/gs1.js", "./js/menu.js",
  "./js/vendor/qr/index.js", "./js/vendor/qr/QR8bitByte.js", "./js/vendor/qr/QRBitBuffer.js",
  "./js/vendor/qr/QRErrorCorrectLevel.js", "./js/vendor/qr/QRMaskPattern.js",
  "./js/vendor/qr/QRMath.js", "./js/vendor/qr/QRMode.js", "./js/vendor/qr/QRPolynomial.js",
  "./js/vendor/qr/QRRSBlock.js", "./js/vendor/qr/QRUtil.js",
  "./icons/icon48.png", "./icons/icon192.png", "./icons/icon512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(PRECACHE.map((path) => cache.add(path).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("sarzovni-") && name !== CACHE_VERSION).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          const key = new URL(url.href);
          key.search = "";
          await cache.put(new Request(key.href, { method: "GET" }), response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_VERSION);
        const cleanUrl = new URL(url.href);
        cleanUrl.search = "";
        const exact = await cache.match(cleanUrl.href);
        if (exact) return exact;
        // A query-based import / barcode view may be offline; show the app home.
        return (await cache.match("./index.html")) || (await cache.match("./pwa/index.html")) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});
