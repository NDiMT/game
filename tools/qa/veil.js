/* Are particles fired while a sheet is open visible? #fx is z-index 9, .veil is 12. */
const { chromium } = require("playwright");
const URL = "file:///home/user/game/site/raise/index.html";
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForTimeout(500);
  await page.click("#start [data-random]");
  await page.waitForTimeout(600);
  await page.click("#bMenu");
  await page.waitForTimeout(500);
  const z = await page.evaluate(() => ({
    fx: getComputedStyle(document.getElementById("fx")).zIndex,
    veil: getComputedStyle(document.getElementById("veil")).zIndex,
    veilHidden: document.getElementById("veil").hidden,
  }));
  console.log("stacking: " + JSON.stringify(z));
  /* paint a big magenta block over the middle of the screen on the fx canvas, repeatedly */
  await page.evaluate(() => {
    const cv = document.getElementById("fx"), cx = cv.getContext("2d");
    const paint = () => { const d = Math.min(devicePixelRatio || 1, 2); cx.setTransform(d, 0, 0, d, 0, 0); cx.fillStyle = "#ff00ff"; cx.fillRect(0, innerHeight * 0.3, innerWidth, 120); requestAnimationFrame(paint); };
    paint();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/home/user/game/tools/qa/veilfx.png" });
  console.log("screenshot written; magenta band should cover the sheet if #fx were on top");
  await browser.close();
})();
