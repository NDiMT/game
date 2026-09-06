/* ANABASIS service worker.
   Κώδικας (HTML/JS/CSS): network-first, cache fallback — ώστε κάθε deploy να
   φτάνει στον παίκτη με το επόμενο άνοιγμα, και offline να παίζει από την cache.
   Εικονίδια/manifest: cache-first. Fonts: stale-while-revalidate.
   Το __BUILD__ αντικαθίσταται από το CI με το commit SHA: κάθε deploy = νέα
   cache, νέος worker, παλιές caches σβήνουν στο activate.
   ΠΡΟΣΟΧΗ: το `fetch()` ΜΕΣΑ σε service worker περνά κι αυτό από την HTTP cache του
   browser. Το GitHub Pages στέλνει max-age=600, άρα το «network-first» μπορούσε να
   φέρει αρχείο ΜΕΧΡΙ 10 ΛΕΠΤΑ ΠΑΛΙΟ — και μετά το ΚΑΡΦΩΝΕ στη δική μας cache, οπότε
   ένας παίκτης που άνοιγε το παιχνίδι στο λάθος λεπτό κόλλαγε σε παλιά έκδοση.
   Ο κώδικας ζητείται πλέον με `cache: "reload"`, που παρακάμπτει την HTTP cache. */
const V = "raise-__BUILD__";
const SHELL = ["./", "./index.html", "./app.css", "./game.js", "./fx.js", "./icons.js", "./ui.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png"];
const CODE = /\.(html|js|css)$|\/$/;
/* Ίδιο αίτημα, αλλά ΧΩΡΙΣ την HTTP cache του browser. */
function fresh(req) {
  try {
    return new Request(req.url, { cache: "reload", mode: req.mode === "navigate" ? "same-origin" : req.mode, credentials: req.credentials, redirect: "follow" });
  } catch (e) { return req; }
}

self.addEventListener("install", (e) => {
  /* Και το προ-γέμισμα της cache πρέπει να παρακάμπτει την HTTP cache, αλλιώς ο ΝΕΟΣ
     worker εγκαθιστά τα ΠΑΛΙΑ αρχεία και το προβλημα επιβιώνει το deploy. */
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== V + "-fonts").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    if (CODE.test(u.pathname) || e.request.mode === "navigate") {
      e.respondWith(fetch(fresh(e.request)).then((res) => {
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
