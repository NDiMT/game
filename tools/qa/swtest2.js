/* Does the post-deploy load already run the NEW code, and does the controllerchange
   reload eject the player from an in-progress round? */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const SRC = "/home/user/game/site/raise";
const ROOT = "/home/user/game/tools/qa/served2";
fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });
for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(ROOT, f));
function stamp(tag) {
  for (const f of ["sw.js", "index.html"]) {
    const p = path.join(ROOT, f);
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/__BUILD__|BUILD_[a-z0-9]+/g, "BUILD_" + tag));
  }
  const p = path.join(ROOT, "ui.js");
  const s = fs.readFileSync(p, "utf8").replace(/^window\.__BUILDMARK__[^\n]*\n/, "");
  fs.writeFileSync(p, 'window.__BUILDMARK__ = "' + tag + '"; window.__LOADS__=(+(sessionStorage.getItem("loads")||0)+1); sessionStorage.setItem("loads", window.__LOADS__);\n' + s);
}
stamp("one");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname === "/" ? "/index.html" : new URL(req.url, "http://x").pathname;
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("no"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "max-age=600" });
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise((r) => server.listen(8732, r));
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const base = "http://localhost:8732/";
  await page.goto(base);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  console.log("build one installed. mark:", await page.evaluate(() => window.__BUILDMARK__), "loads:", await page.evaluate(() => window.__LOADS__));

  /* deploy build two */
  stamp("two");
  const marks = [];
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) marks.push("nav @" + Date.now()); });
  const t0 = Date.now();
  await page.goto(base);
  const firstMark = await page.evaluate(() => window.__BUILDMARK__);
  console.log("first paint after deploy runs build:", firstMark, "(t+" + (Date.now() - t0) + "ms)");
  /* immediately start a run and play a hand, as a fast player would */
  await page.click("#start [data-random]");
  await page.waitForTimeout(300);
  const inRun = await page.evaluate(() => document.getElementById("start").hidden);
  console.log("in a run:", inRun);
  await page.waitForTimeout(15000);
  const after = await page.evaluate(() => ({
    mark: window.__BUILDMARK__, loads: window.__LOADS__,
    onStart: !document.getElementById("start").hidden,
    reloadedFlag: sessionStorage.getItem("raise.reloaded"),
  }));
  console.log("6s later:", JSON.stringify(after));
  console.log("navigations observed:", marks.length, marks.map(m=>m.replace(/nav @/,"")).map(t=>+t-t0).join(","));
  console.log("final:", JSON.stringify(await page.evaluate(() => ({mark:window.__BUILDMARK__, loads:window.__LOADS__, startHidden: document.getElementById("start").hidden, phase: (window.localStorage.getItem("raise.run.v13")||"").slice(0,40)}))));
  await browser.close(); server.close(); process.exit(0);
})();
