// EIDOLON v3 web touch test for N.4 "The Still Room" (CH1_V3 §3) on the v3 export (build/web_v3), Playwright +
// SwiftShader, mobile 390x844 (DPR 1: the mirror renders twice, SwiftShader is slow). Setup by hook (past the prologue, a jump to the room's door); the puzzle itself by
// REAL TOUCH only, the hooks just READ the state (window.ewState):
//   Teach: the thumb walks her into bay C and lets go -> after 1 s her reflection breaks free and unties the C cleat
//          (the antechamber's bar lifts, its two gates sink);
//   Test:  walk into bay W, let go -> she unties W;
//   Twist: walk to the stone block, tap the button twice (it slides W -> C -> E on its rail), walk into bay E, let go ->
//          she unties E low, climbs the block's reflection and unties the high cleat -> the door opens; walk through.
// Usage: flock /home/user/game/realms/dev/.shotlock timeout 1800 node tests/web_still.mjs [--url <index url>] [--out <dir>]
// Exit 0 = all pass. Last line: "STILL_JSON {...}".
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:8123/eidolon-world/build/web_v3/index.html');
const OUT = arg('--out', '/home/user/game/eidolon-world/dev/shots/').replace(/\/?$/, '/');
const W = 390, H = 844;
const T0 = Date.now();
const el = () => ((Date.now() - T0) / 1000).toFixed(0) + 's';
const checks = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.setDefaultTimeout(180000);
const cdp = await ctx.newCDPSession(page);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const st = () => page.evaluate(() => window.ewState || null);
const cmd = (c) => page.evaluate((c) => window.ewCmd(c), c);
const wait = (ms) => page.waitForTimeout(ms);
async function waitFor(fn, ms) { const t = Date.now(); while (Date.now() - t < ms) { const s = await st().catch(() => null); if (s && fn(s)) return s; await wait(300); } return null; }
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
async function shot(name) {
  const p = `${OUT}web-still-${name}.png`;
  await page.screenshot({ path: p });
  const px = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; });
  return p;
}
// the camera never turns: screen right is world (+x, +z), screen up is world (+x, -z) (yaw -45 deg)
const screenDir = (dx, dz) => { const r = (dx + dz) * Math.SQRT1_2, u = (dx - dz) * Math.SQRT1_2; const l = Math.hypot(r, u) || 1; return [r / l, -u / l]; };
const BASE = [Math.round(W * 0.22), Math.round(H * 0.70)];
const REACH = 62;
// walk her along waypoints with the thumb (re-aimed every poll), easing off near each one
async function walk(pts, tol = 0.4, ms = 300000) {
  const t = Date.now();
  let down = false, polls = 0, last = null;
  for (const g of pts) {
    for (;;) {
      if (Date.now() - t > ms) { if (down) await touch('touchEnd'); console.log('  walk: out of time'); return false; }
      const s = await st();
      const dx = g[0] - s.pos[0], dz = g[1] - s.pos[2], d = Math.hypot(dx, dz);
      if (++polls % 8 === 0) console.log(`  walk ${el()} at ${s.pos[0].toFixed(2)},${s.pos[2].toFixed(2)} -> ${g} (${d.toFixed(2)} m) mode ${s.mode}`);
      if (d < tol) break;
      const sd = screenDir(dx, dz), k = d < 1.2 ? 0.55 : 1.0;
      const x = BASE[0] + sd[0] * REACH * k, y = BASE[1] + sd[1] * REACH * k;
      if (!down) { await touch('touchStart', BASE[0], BASE[1]); down = true; await wait(60); }
      if (!last || Math.hypot(x - last[0], y - last[1]) > 4) { await touch('touchMove', x, y); last = [x, y]; }
      await wait(150);
    }
  }
  if (down) await touch('touchEnd');
  await wait(400);
  return true;
}
const BTN = [W - 66, H - 118];
const tapButton = async () => { await touch('touchStart', BTN[0], BTN[1]); await wait(120); await touch('touchEnd'); };
async function longPress(ms) { await touch('touchStart', W / 2, H / 2); await wait(ms); await touch('touchEnd'); }
const pz = (s, id) => !!(s && s.pz && s.pz[id] && s.pz[id].done);
const near = (s, x, z, r) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < r;

const N4 = (s) => (s && s.pz && s.pz.N4) || {};
try {
  await page.goto(URL);
  const t0 = await waitFor((s) => s.mode === 'title', 240000);
  ok('loads to the title', t0, `${el()}`);
  await wait(1500);
  await page.touchscreen.tap(W / 2, H / 2);
  await waitFor((s) => s.mode === 'cine', 60000);
  await cmd('seen:1');
  await touch('touchStart', W / 2, H / 2);
  let s = await waitFor((s) => s.mode === 'play', 120000);
  await touch('touchEnd');
  ok('past the prologue into play', s);
  await cmd('quality:low');
  await cmd('give:lamp');
  await cmd('v3jump:N4');
  await wait(2500);
  s = await st();
  ok('at the Still Room door', s.space === 'N4' || s.space === 'N3', `${s.space} ${JSON.stringify(s.pos)}`);
  // Teach: into bay C, then let go
  await walk([[9.0, -30.6], [11.0, -31.3], [11.0, -33.6]], 0.3);
  s = await waitFor((s) => N4(s).c, 240000);
  ok('Teach: still in bay C, her reflection unties the C cleat (the antechamber opens)', s);
  await shot('teach');
  await wait(30000);          // (she walks back and rejoins you: at SwiftShader rates this takes a while)
  // Test: bay W, through the opened gate
  await walk([[10.0, -34.5], [8.9, -34.45], [7.3, -33.6]], 0.3);
  s = await waitFor((s) => N4(s).w, 240000);
  ok('Test: still in bay W, she unties W', s);
  await wait(30000);
  // Twist: the block, twice, from its west side
  await walk([[6.95, -34.3], [6.95, -35.0]], 0.25);
  await tapButton();
  s = await waitFor((s) => N4(s).slot === 1 && !s.acting, 20000);
  ok('Twist: a tap slides the block one slot (W -> C)', s, s ? '' : JSON.stringify(N4(await st())));
  await wait(1500);
  await walk([[8.9, -34.2], [9.95, -35.0]], 0.25);
  await tapButton();
  s = await waitFor((s) => N4(s).slot === 2 && !s.acting, 20000);
  ok('Twist: a second tap slides it into bay E', s);
  await wait(1500);
  await walk([[12.0, -34.95], [13.3, -34.95], [13.3, -33.5]], 0.3);
  s = await waitFor((s) => N4(s).done, 360000);
  ok('Twist: still in bay E, she unties E, climbs the block and unties the high cleat: the door opens', s, s ? '' : JSON.stringify(N4(await st())));
  await wait(2500);
  await shot('done');
  const out = await walk([[15.0, -33.9], [17.4, -34.2]], 0.4, 120000);
  s = await st();
  ok('the way out: she walks through the opened door', out && s.space === 'IBN', `${s.space} ${JSON.stringify(s.pos)}`);
} catch (e) {
  ok('run', false, String(e));
}
const gl = errors.filter((e) => /webgl|gl_|shader/i.test(e));
ok('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
ok('no WebGL / shader errors', gl.length === 0);
const pass = checks.every((c) => c.pass);
console.log('STILL_JSON ' + JSON.stringify({ pass, secs: (Date.now() - T0) / 1000, failed: checks.filter((c) => !c.pass).map((c) => c.name) }));
await browser.close();
process.exit(pass ? 0 : 1);
