/* RAISE service worker.
   Κώδικας (HTML/JS/CSS): network-first, cache fallback — ώστε κάθε deploy να
   φτάνει στον παίκτη με το επόμενο άνοιγμα, και offline να παίζει από την cache.
   Εικονίδια/manifest: cache-first. Fonts: stale-while-revalidate.
   Το __BUILD__ αντικαθίσταται από το CI με το commit SHA: κάθε deploy = νέα
   cache, νέος worker, παλιές caches σβήνουν στο activate. */
const V = "raise-__BUILD__";
const SHELL = ["./", "./index.html", "./app.css", "./game.js", "./fx.js", "./ui.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png"];
const CODE = /\.(html|js|css)$|\/$/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== V + "-fonts").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    if (CODE.test(u.pathname) || e.request.mode === "navigate") {
      e.respondWith(fetch(e.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true })));
    } else {
      e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(e.request, copy)); }
        return res;
      })));
    }
    return;
  }
  if (u.hostname.endsWith("fonts.googleapis.com") || u.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.open(V + "-fonts").then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
