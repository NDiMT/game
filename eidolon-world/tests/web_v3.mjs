// EIDOLON v3 web touch test (Playwright + SwiftShader, mobile 390x844 DPR 2) on a v3 export (scenes/main3.tscn as the
// main scene). Real touch for Act 1's first beats, the dev hooks only to READ the state (window.ewState) and to frame
// the prologue's shots (they run on real time at ~1 fps otherwise):
//   load + title, 0 console / WebGL errors; tap -> the cards + the prologue; its first view cannot be skipped (a long
//   press does nothing); two prologue frames (CineFx: letterbox, vignette, fog cards; her world in the planar water);
//   once seen, a long press skips it into play at the shore;
//   I.1: the thumb walks her onto the plate in the water -> the door opens (no hook);
//   I.2: walk to the bell, tap the button -> it rings (she reaches);
//   I.3: walk to the pane, tap -> the glass opens; trace her stroke with a finger -> the bars rise;
//   I.4: walk to the slab, tap twice -> the bridge forms; walk across it.
// Usage: flock /home/user/game/realms/dev/.shotlock timeout 900 node tests/web_v3.mjs --url <index url> [--out <dir>]
// Exit 0 = all pass. Last line: "WEB3_JSON {...}".
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
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
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
  const p = `${OUT}web3-${name}.png`;
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

try {
  await page.goto(URL);
  const t0 = await waitFor((s) => s.mode === 'title', 240000);
  ok('loads to the title', t0, `${el()}`);
  await wait(1500);
  await page.touchscreen.tap(W / 2, H / 2);
  const c0 = await waitFor((s) => s.mode === 'cine', 60000);
  ok('a tap starts the cards + the prologue', c0);
  await longPress(9000);
  await wait(1500);
  let s = await st();
  ok('the first view cannot be skipped', s.mode === 'cine' && !s.seen.prologue, `mode ${s.mode}`);
  await cmd('cine_at:3'); await wait(2500); await shot('prologue-03');
  await cmd('cine_at:55'); await wait(2500); await shot('prologue-55');
  await cmd('seen:1');
  // (under SwiftShader a prologue frame takes seconds: the thumb stays down until the game has seen the hold)
  await touch('touchStart', W / 2, H / 2);
  s = await waitFor((s) => s.mode === 'play', 90000);
  await touch('touchEnd');
  ok('once seen, a long press skips it into play at the shore', s && near(s, -4.6, 31.3, 1.5) && s.items.includes('comb'), s ? JSON.stringify(s.pos) : 'no');
  await cmd('quality:low');          // (the walk-through renders on Low under SwiftShader, as web_smoke does)
  await wait(1500);
  await shot('shore');
  // I.1: onto the plate that only her reflection treads
  await walk([[0.8, 33.0], [3.5, 32.0], [6.0, 28.5]], 0.3);
  s = await waitFor((s) => pz(s, 'I1'), 30000);
  ok('I.1: standing on the plate in the water opens the door', s);
  await shot('i1');
  // I.2: the bell
  await walk([[9.0, 29.0], [11.2, 29.0], [12.5, 27.5]], 0.35);
  await tapButton();
  s = await waitFor((s) => pz(s, 'I2'), 30000);
  ok('I.2: a tap rings the bell', s);
  await wait(2500);
  // I.3: the pane
  await walk([[14.0, 28.4], [16.2, 27.5], [18.8, 23.0]], 0.3);
  await tapButton();
  s = await waitFor((s) => s.mode === 'glass' && s.glass && s.glass.phase === 'waiting', 90000);
  ok('I.3: a tap opens the glass and she writes', s, s ? s.glass.phase : '');
  if (s) {
    await shot('i3-glass');
    const px = s.glass.px, sc = W / s.glass.vp[0];
    await touch('touchStart', px[0][0] * sc, px[0][1] * sc);
    for (const q of px.slice(1)) { await touch('touchMove', q[0] * sc, q[1] * sc); await wait(60); }
    await touch('touchEnd');
  }
  s = await waitFor((s) => pz(s, 'I3'), 60000);
  ok('I.3: tracing her stroke raises the bars', s);
  await waitFor((s) => s.mode === 'play', 30000);
  await wait(2500);
  // I.4: the one slab
  await walk([[18.2, 21.0], [17.5, 17.2], [17.5, 15.0], [15.2, 13.0], [10.45, 13.5]], 0.3);
  for (let i = 0; i < 2 && !pz(await st(), 'I4'); i++) { await tapButton(); await waitFor((s) => !s.acting, 20000); await wait(1500); }
  s = await waitFor((s) => pz(s, 'I4'), 30000);
  ok('I.4: two taps turn the slab to meet her half', s);
  await wait(2000);
  await shot('i4');
  const crossed = await walk([[8.9, 13.5], [7.0, 13.5]], 0.4, 120000);
  s = await st();
  ok('I.4: the bridge carries her across', crossed && s.pos[0] < 7.6, JSON.stringify(s.pos));
} catch (e) {
  ok('run', false, String(e));
}
const gl = errors.filter((e) => /webgl|gl_|shader/i.test(e));
ok('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
ok('no WebGL / shader errors', gl.length === 0);
const pass = checks.every((c) => c.pass);
console.log('WEB3_JSON ' + JSON.stringify({ pass, secs: (Date.now() - T0) / 1000, failed: checks.filter((c) => !c.pass).map((c) => c.name) }));
await browser.close();
process.exit(pass ? 0 : 1);
