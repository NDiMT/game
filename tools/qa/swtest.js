/* Service worker test: GitHub-Pages-like headers (max-age=600), offline load, update path. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const SRC = "/home/user/game/site/raise";
const ROOT = "/home/user/game/tools/qa/served";

fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });
for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(ROOT, f));
/* stamp build 1 */
function stamp(tag) {
  for (const f of ["sw.js", "index.html"]) {
    const p = path.join(ROOT, f);
    let s = fs.readFileSync(p, "utf8");
    s = s.replace(/__BUILD__|BUILD_[a-z0-9]+/g, "BUILD_" + tag);
    fs.writeFileSync(p, s);
  }
  /* a marker the page exposes so we can tell which build is running */
  const p = path.join(ROOT, "ui.js");
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(/window\.__BUILDMARK__\s*=\s*"[^"]*";\n?/, "");
  fs.writeFileSync(p, 'window.__BUILDMARK__ = "' + tag + '";\n' + s);
}
stamp("one");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
let hits = [];
let offline = false;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let p = u.pathname === "/" ? "/index.html" : u.pathname;
  hits.push({ p, cc: req.headers["cache-control"] || "", pragma: req.headers["pragma"] || "" });
  if (offline) { res.socket.destroy(); return; }
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("no"); return; }
  const ext = path.extname(file);
  /* GitHub Pages behaviour */
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "max-age=600" });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((r) => server.listen(8731, r));
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  pageerror: " + e.message));
  const base = "http://localhost:8731/";

  console.log("--- 1. first load, register SW");
  await page.goto(base);
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => console.log("  ! no controller after 15s"));
  await page.waitForTimeout(1500);
  console.log("  controller:", await page.evaluate(() => !!navigator.serviceWorker.controller));
  console.log("  buildmark:", await page.evaluate(() => window.__BUILDMARK__));
  console.log("  caches:", JSON.stringify(await page.evaluate(() => caches.keys())));
  console.log("  cached entries:", await page.evaluate(async () => { const ks = await caches.keys(); const out = {}; for (const k of ks) out[k] = (await (await caches.open(k)).keys()).map((r) => r.url.replace(/^http:\/\/localhost:8731/, "")); return out; }).then((o) => JSON.stringify(o)));
  console.log("  request cache-control headers seen:", JSON.stringify([...new Set(hits.map((h) => h.p + " cc=" + h.cc))].slice(0, 20), null, 1));

  console.log("--- 2. offline reload");
  hits = []; offline = true;
  await ctx.setOffline(true);
  let ok = true;
  try {
    await page.goto(base, { timeout: 20000 });
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => ({ mark: window.__BUILDMARK__, hasRAISE: !!window.RAISE, start: !!document.getElementById("start") && !document.getElementById("start").hidden }));
    console.log("  offline load:", JSON.stringify(state));
    if (!state.hasRAISE) { ok = false; console.log("  ! game code did not load offline"); }
  } catch (e) { ok = false; console.log("  ! offline navigation FAILED: " + e.message); }
  await ctx.setOffline(false); offline = false;

  console.log("--- 3. deploy build two, reload, check the new code arrives");
  stamp("two");
  hits = [];
  await page.goto(base);
  await page.waitForTimeout(3500);
  console.log("  buildmark after reload:", await page.evaluate(() => window.__BUILDMARK__));
  console.log("  caches:", JSON.stringify(await page.evaluate(() => caches.keys())));
  const cachedUi = await page.evaluate(async () => { const ks = await caches.keys(); for (const k of ks) { const c = await caches.open(k); const r = await c.match("/ui.js"); if (r) return (await r.text()).slice(0, 60); } return "MISS"; });
  console.log("  cached ui.js head:", JSON.stringify(cachedUi));

  console.log("--- 4. within the 10-minute HTTP cache window: does a fresh SW install pick up stale code?");
  /* simulate a rapid second deploy: the browser HTTP cache still holds build two for 600s */
  stamp("three");
  hits = [];
  await page.goto(base);
  await page.waitForTimeout(3500);
  console.log("  buildmark:", await page.evaluate(() => window.__BUILDMARK__));
  const cachedUi3 = await page.evaluate(async () => { const ks = await caches.keys(); for (const k of ks) { const c = await caches.open(k); const r = await c.match("/ui.js"); if (r) return (await r.text()).slice(0, 60); } return "MISS"; });
  console.log("  cached ui.js head:", JSON.stringify(cachedUi3));
  console.log("  hits during step 4:", JSON.stringify([...new Set(hits.map((h) => h.p))]));

  console.log("--- 5. query-string cache growth after Force update");
  await page.goto(base + "?fresh=111");
  await page.waitForTimeout(1500);
  await page.goto(base + "?fresh=222");
  await page.waitForTimeout(1500);
  console.log("  cached entries:", JSON.stringify(await page.evaluate(async () => { const ks = await caches.keys(); const out = {}; for (const k of ks) out[k] = (await (await caches.open(k)).keys()).map((r) => r.url.replace(/^http:\/\/localhost:8731/, "")); return out; })));

  await browser.close();
  server.close();
  process.exit(0);
})();
