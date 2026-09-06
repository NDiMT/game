const { chromium } = require("playwright");
const path = require("path");
const G = require("/home/user/game/site/raise/game.js");
const URL = "file:///home/user/game/site/raise/index.html";

/* build a Survival state sitting on a long chain */
function survState(chain) {
  const S = G.newRun("hudtest", [], "survival");
  S.chain = chain; S.rung = null; S.score = 250000; S.survEarned = 4; S.discMax = G.discMaxOf(S);
  S.stats.plays = 60; S.stats.maxChain = chain + 1;
  return G.serialize(S);
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

  /* ---------- 1. Survival HUD chain label ---------- */
  for (const chain of [5, 11, 30, 74]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.waitForTimeout(400);
    await page.evaluate((json) => { localStorage.setItem("raise.run.v13", json); localStorage.setItem("raise.deck.v1", "survival"); location.reload(); }, survState(chain));
    await page.waitForTimeout(900);
    await page.click("#start [data-continue]").catch(() => {});
    await page.waitForTimeout(700);
    const hud = await page.evaluate(() => ({
      chainN: document.getElementById("chainN").textContent,
      chainLabel: document.getElementById("chain").firstElementChild.textContent,
      tgt: document.getElementById("tgt").textContent,
      go: document.getElementById("bPlay").textContent,
      surv: document.body.classList.contains("surv"),
    }));
    const engine = (() => { const S = G.restore(survState(chain)); const pos = G.chainPos(S); const steps = pos - 1 + G.CFG.chainFloor; return { pos, mult: Math.round((1 + G.CFG.chainStep * steps) * 10) / 10 }; })();
    console.log("chain " + chain + " -> HUD " + JSON.stringify(hud.chainN) + " label " + JSON.stringify(hud.chainLabel) + " | engine pos x" + engine.pos + " real Mult x" + engine.mult + (hud.chainLabel !== "Mult ×" + engine.mult ? "   <-- HUD WRONG" : ""));
    await ctx.close();
  }

  /* ---------- 2. audio node accounting over a long session ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: [] });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__nodes = { created: 0, started: 0, stopped: 0, byType: {} };
      const AC = window.AudioContext;
      const wrap = (proto, name) => {
        const orig = proto[name];
        if (!orig) return;
        proto[name] = function () {
          const n = orig.apply(this, arguments);
          window.__nodes.created++;
          window.__nodes.byType[name] = (window.__nodes.byType[name] || 0) + 1;
          if (n && n.start) { const s = n.start.bind(n); n.start = function () { window.__nodes.started++; return s.apply(n, arguments); }; }
          if (n && n.stop) { const st = n.stop.bind(n); n.stop = function () { window.__nodes.stopped++; return st.apply(n, arguments); }; }
          return n;
        };
      };
      ["createGain", "createOscillator", "createBiquadFilter", "createBufferSource", "createDelay", "createStereoPanner", "createDynamicsCompressor", "createBuffer"].forEach((m) => wrap(AudioContext.prototype, m));
    });
    await page.goto(URL);
    await page.waitForTimeout(400);
    /* start audio with a gesture, then fire 300 effects */
    await page.mouse.click(195, 400);
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const FX = window.FX;
      FX.music.stop(0);
      const t0 = window.__nodes.created;
      for (let i = 0; i < 300; i++) {
        FX.sfx.tick(); FX.sfx.climb(1 + (i % 12)); FX.sfx.bomb(); FX.sfx.discard(); FX.sfx.draw(); FX.sfx.clear();
        if (i % 50 === 0) await new Promise((r2) => setTimeout(r2, 60));
      }
      await new Promise((r2) => setTimeout(r2, 1500));
      return { created: window.__nodes.created - t0, started: window.__nodes.started, stopped: window.__nodes.stopped, byType: window.__nodes.byType, acState: (window.FX.audioState && window.FX.audioState()) };
    });
    console.log("\naudio over 300x6 effects: created " + r.created + " nodes, sources started " + r.started + " stopped " + r.stopped + (r.started !== r.stopped ? "   <-- SOURCES NEVER STOPPED: " + (r.started - r.stopped) : "   (every source is stopped)"));
    console.log("  by type: " + JSON.stringify(r.byType));
    /* music-only leak check: run the music scheduler for 8s and count */
    const m = await page.evaluate(async () => {
      const a = window.__nodes.created;
      window.FX.music.start();
      await new Promise((r2) => setTimeout(r2, 6000));
      const b = window.__nodes.created;
      window.FX.music.stop(0);
      await new Promise((r2) => setTimeout(r2, 800));
      const c = window.__nodes.created;
      return { during: b - a, after: c - b, started: window.__nodes.started, stopped: window.__nodes.stopped };
    });
    console.log("  music 6s: " + m.during + " nodes created, " + m.after + " more after stop() (" + (m.during / 6).toFixed(1) + " nodes/s); sources started " + m.started + " stopped " + m.stopped);
    await ctx.close();
  }

  /* ---------- 3. prefers-reduced-motion ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(URL);
    await page.waitForTimeout(400);
    await page.evaluate(() => { localStorage.setItem("raise.music", "1"); location.reload(); });
    await page.waitForTimeout(700);
    await page.mouse.click(195, 700);
    await page.waitForTimeout(300);
    await page.click("#start [data-random]");
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => ({ RM: window.FX.RM, musicOn: window.FX.musicOn(), playing: window.FX.music.playing(), level: window.FX.musicLevel(), audio: window.FX.audioState(), score: document.getElementById("score").textContent }));
    console.log("\nreduced-motion: " + JSON.stringify(st));
    /* play a hand and confirm the score still updates and the callout still appears */
    const cards = await page.$$("#hand [data-i]");
    await page.evaluate(() => { const m = window.RAISE.suggest(JSON.parse(localStorage.getItem("raise.run.v13"))); return m ? m.idx : null; });
    for (const i of [0, 1]) if (cards[i]) await cards[i].click();
    await page.waitForTimeout(200);
    const btn = await page.evaluate(() => ({ disabled: document.getElementById("bPlay").disabled, text: document.getElementById("bPlay").textContent }));
    console.log("  play button after picking 2 cards: " + JSON.stringify(btn));
    if (!btn.disabled) { await page.click("#bPlay"); await page.waitForTimeout(1400); }
    console.log("  score after: " + await page.evaluate(() => document.getElementById("score").textContent) + " | callout: " + JSON.stringify(await page.evaluate(() => document.getElementById("callout").textContent)));
    if (errs.length) console.log("  ERRORS " + JSON.stringify(errs));
    await ctx.close();
  }

  await browser.close();
})();
