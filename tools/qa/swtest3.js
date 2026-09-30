/* When exactly does the post-deploy reload fire, and what does the player lose? */
const http = require("http"); const fs = require("fs"); const path = require("path");
const { chromium } = require("playwright");
const SRC = "/home/user/game/site/raise";
const ROOT = "/home/user/game/tools/qa/served3";
fs.rmSync(ROOT, { recursive: true, force: true }); fs.mkdirSync(ROOT, { recursive: true });
for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(ROOT, f));
function stamp(tag) {
  for (const f of ["sw.js", "index.html"]) { const p = path.join(ROOT, f); fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/__BUILD__|BUILD_[a-z0-9]+/g, "BUILD_" + tag)); }
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
  await new Promise((r) => server.listen(8733, r));
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const base = "http://localhost:8733/";
  await page.goto(base);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  console.log("build one controlling.");

  stamp("two");
  const navs = [];
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) navs.push(Date.now()); });
  /* record the moment of controllerchange inside the page, in localStorage so it survives the reload */
  await page.addInitScript(() => {
    try { localStorage.removeItem("cc.log"); } catch (e) {}
    addEventListener("DOMContentLoaded", () => {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        try { localStorage.setItem("cc.log", (localStorage.getItem("cc.log") || "") + "cc@" + Math.round(performance.now()) + "ms;"); } catch (e) {}
      });
    });
  });
  const t0 = Date.now();
  await page.goto(base, { waitUntil: "commit" });
  await page.waitForTimeout(20000);
  const log = await page.evaluate(() => ({ cc: localStorage.getItem("cc.log"), startHidden: document.getElementById("start").hidden, run: (localStorage.getItem("raise.run.v13") || "").length }));
  console.log("navigations after deploy at +ms:", navs.map((t) => t - t0).join(", "));
  console.log("controllerchange log:", JSON.stringify(log));
  await browser.close(); server.close(); process.exit(0);
})();
