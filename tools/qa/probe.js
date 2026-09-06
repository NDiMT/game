const { chromium } = require("playwright");
const URL = "file:///home/user/game/site/raise/index.html";
const life = { runs: 214, wins: 3, best: 50, bestScore: 480000, bestSurv: 912345, gold: 40, silver: 60, quads: 30, chain7: 1, plays: 4000, aces: 500,
  seeds: { a1: { ante: 50, score: 480000, deck: "wild", at: 1 }, b2: { ante: 44, score: 300000, deck: "survival", at: 2 }, c3: { ante: 31, score: 120000, deck: "classic", at: 3 } } };
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR: " + e.stack));
  await page.goto(URL);
  await page.waitForTimeout(600);
  console.log("baseline: start hidden=", await page.evaluate(() => document.getElementById("start").hidden), " btns=", await page.evaluate(() => document.getElementById("startBtns").innerHTML.length));
  await page.evaluate((l) => { localStorage.setItem("raise.life.v1", JSON.stringify(l)); localStorage.removeItem("raise.run.v13"); }, life);
  await page.reload();
  await page.waitForTimeout(1500);
  console.log("after reload: start hidden=", await page.evaluate(() => document.getElementById("start").hidden),
    " btns=", await page.evaluate(() => document.getElementById("startBtns").innerHTML.length),
    " ledger=", await page.evaluate(() => document.getElementById("ledger").innerHTML.length),
    " RAISE=", await page.evaluate(() => !!window.RAISE), " FX=", await page.evaluate(() => !!window.FX), " ICONS=", await page.evaluate(() => !!window.ICONS));
  const m = await page.evaluate(() => {
    const s = document.getElementById("start");
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
    return { scrollable: s.scrollHeight > s.clientHeight + 1, sh: s.scrollHeight, ch: s.clientHeight,
      first: r(document.querySelector("#startBtns .big")), last: r(document.querySelector("#ledger .ledg:last-child")),
      stats: r(document.getElementById("stats")), vh: innerHeight };
  });
  console.log("layout: " + JSON.stringify(m));
  if (m.scrollable) {
    await page.evaluate(() => { document.getElementById("start").scrollTop = 99999; });
    await page.waitForTimeout(200);
    console.log("scrolled to bottom: " + JSON.stringify(await page.evaluate(() => {
      const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
      return { first: r(document.querySelector("#startBtns .big")), last: r(document.querySelector("#ledger .ledg:last-child")) };
    })));
  }
  await page.screenshot({ path: "/home/user/game/tools/qa/start360.png" });
  await browser.close();
})();
