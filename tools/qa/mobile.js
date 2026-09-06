const { chromium } = require("playwright");
const URL = "file:///home/user/game/site/raise/index.html";
const SIZES = [[360, 640], [390, 844], [412, 732]];

async function measure(page, label) {
  return await page.evaluate((label) => {
    const out = { label, issues: [] };
    const de = document.documentElement;
    out.scrollW = de.scrollWidth; out.clientW = de.clientWidth;
    out.scrollH = de.scrollHeight; out.clientH = de.clientHeight;
    if (de.scrollWidth > de.clientWidth + 1) out.issues.push("horizontal scroll: scrollWidth " + de.scrollWidth + " > clientWidth " + de.clientWidth);
    /* find elements sticking out horizontally */
    const over = [];
    document.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.position === "fixed" && cs.opacity === "0") return;
      if (r.right > de.clientWidth + 1.5 || r.left < -1.5) {
        over.push({ sel: (el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + (el.className || "").toString().split(" ")[0]), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
      }
    });
    out.overflowX = over.slice(0, 12);
    /* interactive hit targets, measuring the ::after overlay too */
    const small = [];
    document.querySelectorAll("button, [role=button], input, a").forEach((el) => {
      if (el.disabled) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.pointerEvents === "none") return;
      let w = r.width, h = r.height;
      /* ::after / ::before hit expanders */
      for (const pe of ["::after", "::before"]) {
        const p = getComputedStyle(el, pe);
        if (!p || p.content === "none" || p.display === "none") continue;
        const ins = ["top", "right", "bottom", "left"].map((k) => parseFloat(p[k]));
        if (p.position === "absolute" && ins.every((v) => !isNaN(v))) {
          const ew = r.width - ins[1] - ins[3], eh = r.height - ins[0] - ins[2];
          if (ew > w) w = ew; if (eh > h) h = eh;
        }
      }
      if (w < 43.5 || h < 43.5) small.push({ sel: (el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + (el.className || "").toString().split(" ").slice(0, 2).join(".")), text: (el.textContent || "").trim().slice(0, 22), w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 });
    });
    out.smallTargets = small;
    /* clipped content: element taller than its scroll container with hidden overflow */
    const clipped = [];
    document.querySelectorAll("*").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.overflow === "hidden" || cs.overflowY === "hidden") {
        if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 20) clipped.push({ sel: (el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + (el.className || "").toString().split(" ")[0]), sh: el.scrollHeight, ch: el.clientHeight });
      }
    });
    out.clipped = clipped.slice(0, 10);
    return out;
  }, label);
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36" });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errs.push("console: " + m.text()); });
    await page.goto(URL);
    await page.waitForTimeout(700);
    console.log("\n===== " + w + "x" + h + " START SCREEN");
    console.log(JSON.stringify(await measure(page, "start"), null, 1));
    /* start a run */
    await page.click("#start [data-random]");
    await page.waitForTimeout(900);
    console.log("===== " + w + "x" + h + " TABLE");
    console.log(JSON.stringify(await measure(page, "table"), null, 1));
    /* select a couple of cards and open the menu sheet */
    const cards = await page.$$("#hand [data-i]");
    if (cards[0]) await cards[0].click();
    await page.waitForTimeout(200);
    await page.click("#bMenu");
    await page.waitForTimeout(500);
    console.log("===== " + w + "x" + h + " MENU SHEET");
    console.log(JSON.stringify(await measure(page, "menu"), null, 1));
    await page.click("#sheet [data-howto]");
    await page.waitForTimeout(400);
    console.log("===== " + w + "x" + h + " HOWTO SHEET");
    console.log(JSON.stringify(await measure(page, "howto"), null, 1));
    if (errs.length) console.log("ERRORS: " + JSON.stringify(errs, null, 1));
    await ctx.close();
  }
  await browser.close();
})();
