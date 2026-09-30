/* Music scheduler: node creation rate over a long session, and clipping headroom. */
const { chromium } = require("playwright");
const URL = "file:///home/user/game/site/raise/index.html";
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__n = { created: 0, started: 0, stopped: 0 };
    ["createGain", "createOscillator", "createBiquadFilter", "createBufferSource", "createDelay", "createStereoPanner", "createDynamicsCompressor"].forEach((m) => {
      const o = AudioContext.prototype[m]; if (!o) return;
      AudioContext.prototype[m] = function () {
        const n = o.apply(this, arguments); window.__n.created++;
        if (n.start) { const s = n.start.bind(n); n.start = function () { window.__n.started++; return s.apply(n, arguments); }; }
        if (n.stop) { const t = n.stop.bind(n); n.stop = function () { window.__n.stopped++; return t.apply(n, arguments); }; }
        return n;
      };
    });
  });
  await page.goto(URL);
  await page.evaluate(() => { localStorage.setItem("raise.music", "2"); });
  await page.reload();
  await page.waitForTimeout(900);
  await page.mouse.click(195, 780);
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    window.FX.music.start(); window.FX.music.chain(6, 6);
    const a = window.__n.created; const t0 = performance.now();
    await new Promise((r2) => setTimeout(r2, 20000));
    const b = window.__n.created; const dt = (performance.now() - t0) / 1000;
    /* now stop and see whether anything keeps being created */
    window.FX.music.stop(0.1);
    await new Promise((r2) => setTimeout(r2, 3000));
    const c = window.__n.created;
    return { rate: ((b - a) / dt).toFixed(1), during: b - a, afterStop: c - b, started: window.__n.started, stopped: window.__n.stopped, playing: window.FX.music.playing() };
  });
  console.log("music at full intensity: " + JSON.stringify(r));
  console.log("  every source stopped: " + (r.started === r.stopped));

  /* clipping: measure the peak of a bomb + climb + clear + full music through an OfflineAudioContext copy is not
     possible against the live graph, so instead read the compressor reduction and the summed gains. */
  const peak = await page.evaluate(async () => {
    /* tap the destination with an analyser to sample the real output */
    const ac = (function () { /* reach the FX AudioContext via a fresh node */ return null; })();
    return null;
  });

  await browser.close();
})();
