const { chromium } = require("playwright");
const fs = require("fs");
const URL = "file:///home/user/game/site/raise/index.html";
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  for (const dpr of [1, 2]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.FX.embers(false);
      const cv = document.getElementById("fx"), cx = cv.getContext("2d");
      cv.style.zIndex = 9999;
      const paint = () => {
        const d = Math.min(devicePixelRatio || 1, 2);
        cx.setTransform(d, 0, 0, d, 0, 0);
        cx.fillStyle = "#ff00ff";
        /* four 30px markers at the logical viewport corners, inset 10px */
        cx.fillRect(10, 10, 30, 30);
        cx.fillRect(innerWidth - 40, 10, 30, 30);
        cx.fillRect(10, innerHeight - 40, 30, 30);
        cx.fillRect(innerWidth - 40, innerHeight - 40, 30, 30);
        requestAnimationFrame(paint);
      };
      paint();
    });
    await page.waitForTimeout(300);
    const shot = await page.screenshot();
    fs.writeFileSync("/home/user/game/tools/qa/corners" + dpr + ".png", shot);
    /* count magenta pixels per quadrant using a raw decode via the page itself */
    const q = await page.evaluate(async () => {
      const cv = document.getElementById("fx");
      /* sample the composited page is not possible; instead report where the canvas box sits */
      const b = cv.getBoundingClientRect();
      return { box: [b.left, b.top, b.width, b.height], vp: [innerWidth, innerHeight] };
    });
    console.log("DPR " + dpr + " " + JSON.stringify(q));
    await ctx.close();
  }
  await browser.close();
})();
