/* Minimal offline cache for the game (cache-first for same-origin assets). */
const CACHE = 'snowman-v1';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/main.js', './js/game.js', './js/ui.js', './js/audio.js', './js/levels.js',
  './assets/sprites/snowman.svg', './assets/sprites/snowman_throw.svg', './assets/sprites/snowman_scarf.svg',
  './assets/sprites/snowball.svg', './assets/sprites/target_bullseye.svg', './assets/sprites/target_can.svg',
  './assets/sprites/target_ice.svg', './assets/sprites/target_star.svg', './assets/sprites/scarf.svg',
  './assets/sprites/background.svg', './assets/icons/icon-192.svg',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  })));
});
