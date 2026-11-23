// web_check.js <outdir> <level> (tools/web_build.sh runs it for every level): open the web build (http://127.0.0.1:$PORT/) in a headless browser, skip the film, and on
// the start screen touch PLAY (level 1) or the level's number (2..NLEV, which jumps straight into that level); wait for
// it to start and run a while; print "LEVEL <n> logs <count> bad <errors> reached <what>" first, then every log line.
const { chromium } = require('playwright');
const out = process.argv[2], lv = parseInt(process.argv[3] || '1'), port = process.env.PORT || '8791';
const nlev = parseInt(process.env.NLEV || '5');
const W = 400, H = 711;      // (a phone's 9:16; the game's 720x1280 scaled to it)
const t0 = Date.now(); const logs = []; let bad = 0;
const sec = () => Math.round((Date.now() - t0) / 1000);
const BAD = /SCRIPT ERROR|USER SCRIPT ERROR|USER ERROR|Parse Error|Uncaught|Failed to load resource|RuntimeError|Aborted/i;
function log(kind, text) { logs.push(`  LOG ${sec()}s ${kind}: ${text}`); }
function seen(re) { return logs.some(l => re.test(l)); }
async function until(re, ms) { const end = Date.now() + ms; while (Date.now() < end) { if (seen(re)) return true; await new Promise(r => setTimeout(r, 500)); } return false; }
(async () => {
  let reached = 'false';
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('console', m => { const t = m.text(); log(m.type(), t); if (m.type() === 'error' || BAD.test(t)) bad++; });
    page.on('pageerror', e => { log('pageerror', String(e)); bad++; });
    page.on('requestfailed', r => { log('requestfailed', r.url()); bad++; });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 120000 });
    // the film starts by itself: wait for the engine, then a touch shows "tap to skip" and a second skips it
    await until(/Build configuration|Godot Engine/i, 180000);
    await new Promise(r => setTimeout(r, 20000));
    for (let i = 0; i < 6 && !seen(/IV the start screen/); i++) {
      await page.mouse.click(W / 2, H / 2); await new Promise(r => setTimeout(r, 700)); await page.mouse.click(W / 2, H / 2);
      if (await until(/IV the start screen/, 25000)) break;
    }
    if (!seen(/IV the start screen/)) { reached = 'no-menu'; throw new Error('no start screen'); }
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: `${out}/menu_${lv}.png` });
    if (lv <= 1) {
      await page.mouse.click(W / 2, H * 0.5); log('---', 'played');
      reached = (await until(/IV play/, 60000)) ? 'play' : 'false';
    } else {
      const k = lv; const x = 360 + (k - 1 - (nlev - 1) * 0.5) * 720 * (nlev <= 3 ? 0.2 : (nlev == 4 ? 0.17 : 0.15)), y = 1280 * 0.405;
      await page.mouse.click(x * W / 720, y * H / 1280); log('---', `picked ${k}`);
      reached = (await until(/IV start at the level/, 120000)) ? 'true' : 'false';
    }
    await new Promise(r => setTimeout(r, 45000));      // (the level runs a while: errors in its making or its first moves show)
    await page.screenshot({ path: `${out}/level_${lv}.png` });
  } catch (e) { log('check', String(e)); }
  await browser.close();
  console.log(`LEVEL ${lv} logs ${logs.length} bad ${bad} reached ${reached}`);
  for (const l of logs) console.log(l);
})();
