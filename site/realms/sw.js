// ORBIS service worker: long-term caching that GitHub Pages' ~10 min Cache-Control cannot give.
//
// Rules (deliberately narrow, so a deploy can never be masked by a stale copy):
//  - HTML / navigations, version.json, sw.js and anything requested with cache:'no-store' are NOT touched:
//    the page's own self-update (index.html -> version.json -> reload with ?v=) works exactly as without a worker.
//  - versioned files whose ?v= equals this worker's build (registered as sw.js?b=<BUILD> by index.html), e.g.
//    main.js?v=1.10 under build 1.8: cache-first. A new build has a new ?v=, i.e. a new URL; older copies of the same
//    path are pruned when the new one is stored. A file whose ?v= was not bumped with the build stays on the network.
//  - big unversioned static payloads that practically never change (vendor/three.module.min.js, audio/**):
//    stale-while-revalidate (served from cache at once, refreshed in the background for the next visit).
//  - everything else: plain network (browser HTTP cache), as before.
// Kill switch: version.json { "sw": false } makes index.html unregister the worker and drop its caches.
const CACHE = 'orbis-rt-1'; // bump only when these rules change (old caches are deleted on activate)
const BUILD = new URL(self.location.href).searchParams.get('b') || '';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('orbis-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const ok = (r) => r && r.ok && r.type === 'basic' && r.status === 200;
async function put(req, res) {
  try {
    const c = await caches.open(CACHE), u = new URL(req.url);
    if (u.searchParams.has('v')) { // prune this path's other versions
      for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) c.delete(k); }
    }
    await c.put(req, res);
  } catch (e) { /* quota or private mode: just no caching */ }
}
async function cacheFirst(req, e) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (ok(res)) e.waitUntil(put(req, res.clone()));
  return res;
}
async function staleWhileRevalidate(req, e) {
  const hit = await caches.match(req);
  const net = fetch(req).then((res) => { if (ok(res)) return put(req, res.clone()).then(() => res); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode === 'navigate' || req.cache === 'no-store' || req.headers.has('range')) return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (/\/(version\.json|sw\.js)$/.test(u.pathname) || u.pathname.endsWith('.html') || u.pathname.endsWith('/')) return;
  if (BUILD && u.searchParams.get('v') === BUILD && !u.searchParams.has('t')) { e.respondWith(cacheFirst(req, e)); return; }
  if (!u.search && (/\/vendor\/[^/]+\.js$/.test(u.pathname) || /\/audio\//.test(u.pathname))) { e.respondWith(staleWhileRevalidate(req, e)); return; }
});
