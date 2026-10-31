// EIDOLON v1.1d: "Our Steps" played in the REAL web build with REAL touch input (Playwright + SwiftShader, mobile
// 390x844 DPR 2). Run through tests/smoke.sh (a required check), or:
//   flock /home/user/game/realms/dev/.shotlock timeout 900 node tests/web_oursteps.mjs --url <index url> [--out <dir>] [--tag v11d-os]
// The dev hooks only SET UP (jump to the room) and READ the state (window.ewState); every move on the board, the
// walk onto the floor and the walk out to the Court are synthetic touch drags on the on-screen joystick
// (CDP Input.dispatchTouchEvent: a thumb down on the left of the screen, dragged a little off-axis, released).
// The plan is solved HERE, in JS, from the board maps read out of scripts/our_steps.gd (an independent
// re-implementation of the rules): after every step the game's state must equal the predicted one.
// A screenshot after every move: <out>/<tag>-step-NN.png. Exit 0 = all checks pass; the last line is "OS_JSON {...}".
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:8123/eidolon-world/build/web/index.html');
const OUT = arg('--out', path.join(HERE, '../dev/shots/')).replace(/\/?$/, '/');
const TAG = arg('--tag', 'v11d-os');
const TIER = arg('--tier', 'low');
const LOAD_TIMEOUT = +arg('--load-timeout', 240) * 1000;
const W = 390, H = 844;
fs.mkdirSync(OUT, { recursive: true });

const T0 = Date.now();
const el = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const info = (...a) => console.log(`[${el()}]`, ...a);

// ---------------------------------------------------------------- the rules, re-implemented from the source
const SRC = fs.readFileSync(path.join(HERE, '../scripts/our_steps.gd'), 'utf8');
const num = (k) => +SRC.match(new RegExp(`const ${k} := ([-0-9.]+)`))[1];
const C = num('C'), R = num('R'), TILE = num('TILE'), GAP = num('GAP');
const GCm = SRC.match(/const GC := Vector3\(([-0-9.]+), ([-0-9.]+), ([-0-9.]+)\)/);
const GC = [+GCm[1], +GCm[2], +GCm[3]];
const ENTRY_COLS = JSON.parse(SRC.match(/const ENTRY_COLS := (\[[0-9, ]+\])/)[1]);
const BOARDS = [...SRC.matchAll(/\{"title": "([^"]+)", "par": (\d+), "map": \[([^\]]+)\]\}/g)]
  .map((m) => ({ title: m[1], par: +m[2], map: JSON.parse('[' + m[3] + ']') }));
const S2 = Math.SQRT1_2;
const U = [S2, 0, S2], V = [S2, 0, -S2];
const EDGE_V = -(GAP + R * TILE);
const key = (a) => a.join(',');
const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
function board(i) {
  const b = { you: [], her: [] };
  BOARDS[i].map.forEach((row, y) => [...row].forEach((ch, x) => {
    const mine = x < 3, c = [y, mine ? x : 5 - x];
    if (ch === '#') (mine ? b.you : b.her).push(key(c));
    else if ('PGAa'.includes(ch)) b[ch] = c;
  }));
  return b;
}
const inb = (c) => c[0] >= 0 && c[0] < C && c[1] >= 0 && c[1] < R;
function step(b, p, h, d) {
  let np = [p[0] + d[0], p[1] + d[1]]; if (!inb(np) || b.you.includes(key(np))) np = p;
  let nh = [h[0] + d[0], h[1] + d[1]]; if (!inb(nh) || b.her.includes(key(nh))) nh = h;
  return eq(np, p) && eq(nh, h) ? null : [np, nh];
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function solve(i) {
  const b = board(i), s0 = [b.P, b.A], seen = new Map([[key(s0.flat()), null]]), q = [s0];
  for (let qi = 0; qi < q.length; qi++) {
    const s = q[qi];
    if (eq(s[0], b.G) && eq(s[1], b.a)) {
      const out = []; let k = key(s.flat());
      while (seen.get(k)) { out.unshift(seen.get(k)[1]); k = seen.get(k)[0]; }
      return out;
    }
    for (const d of DIRS) { const t = step(b, s[0], s[1], d); if (t && !seen.has(key(t.flat()))) { seen.set(key(t.flat()), [key(s.flat()), d]); q.push(t); } }
  }
  return null;
}
// the frame: u along the glass (screen right), v toward it (screen up)
const at = (u, v) => [GC[0] + U[0] * u + V[0] * v, GC[2] + U[2] * u + V[2] * v];
const uv = (c) => [(c[0] - (C - 1) / 2) * TILE, -(GAP + TILE / 2 + (R - 1 - c[1]) * TILE)];
const tile = (c) => at(...uv(c));
// a world (x, z) direction -> the stick's screen direction (x right, y down): the camera never turns
const screenDir = (dx, dz) => { const sx = dx * U[0] + dz * U[2], sy = -(dx * V[0] + dz * V[2]); const l = Math.hypot(sx, sy) || 1; return [sx / l, sy / l]; };

// ---------------------------------------------------------------- browser
const isRemote = URL.startsWith('https');
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  proxy: isRemote && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.setDefaultTimeout(180000);
const cdp = await ctx.newCDPSession(page);
const errors = [], consoleLog = [];
page.on('console', (m) => { consoleLog.push(`[${el()} ${m.type()}] ${m.text()}`); if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => { consoleLog.push(`[${el()} pageerror] ${e.message}`); errors.push('pageerror: ' + e.message); });

const st = () => page.evaluate(() => window.ewState || null);
const cmd = (c) => page.evaluate((c) => window.ewCmd(c), c);
const wait = (ms) => page.waitForTimeout(ms);
async function waitFor(fn, ms) { const t = Date.now(); while (Date.now() - t < ms) { const s = await st().catch(() => null); if (s && fn(s)) return s; await wait(250); } return null; }

// the thumb: down on the left of the screen (the stick's half, clear of the hotbar and the button)
const BASE = [Math.round(W * 0.22), Math.round(H * 0.70)];
const REACH = 62;           // CSS px (the stick's radius is 54 canvas units, about 54 CSS px here)
let thumb = false;
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
async function thumbTo(sd, k = 1) {
  const x = BASE[0] + sd[0] * REACH * k, y = BASE[1] + sd[1] * REACH * k;
  if (!thumb) { await touch('touchStart', BASE[0], BASE[1]); thumb = true; await wait(60); await touch('touchMove', BASE[0] + (x - BASE[0]) * 0.4, BASE[1] + (y - BASE[1]) * 0.4); await wait(40); }
  await touch('touchMove', x, y);
}
async function thumbUp() { if (thumb) { await touch('touchEnd'); thumb = false; } }
const rot = (sd, deg) => { const a = deg * Math.PI / 180; return [sd[0] * Math.cos(a) - sd[1] * Math.sin(a), sd[0] * Math.sin(a) + sd[1] * Math.cos(a)]; };

let shotN = 0;
const shots = [];
async function shot(label) {
  const f = `${OUT}${TAG}-step-${String(shotN++).padStart(2, '0')}.png`;
  await page.screenshot({ path: f, timeout: 150000, scale: 'css' });
  shots.push({ file: f, label });
  info('shot', path.basename(f), label);
}
// walk (by the stick) to a world point; re-aims as it goes, eases off near it
async function walkTo(x, z, tol = 0.35, ms = 90000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const s = await st(); const dx = x - s.pos[0], dz = z - s.pos[2], d = Math.hypot(dx, dz);
    if (d < tol) { await thumbUp(); await waitFor((q) => q.speed < 0.05, 8000); return true; }
    await thumbTo(screenDir(dx, dz), d < 1.2 ? 0.55 : 1.0);
    await wait(250);
  }
  await thumbUp();
  return false;
}

let fatal = null;
const summary = { url: URL, boards: [], shots };
try {
  info('rules from our_steps.gd:', JSON.stringify({ C, R, TILE, GAP, GC, ENTRY_COLS, boards: BOARDS.map((b) => b.title) }));
  const plans = BOARDS.map((_, i) => solve(i));
  BOARDS.forEach((b, i) => check(`rules: board ${i + 1} '${b.title}' solvable in par ${b.par} (JS BFS)`, plans[i] && plans[i].length === b.par, JSON.stringify(plans[i])));
  // ---------------------------------------------------------------- load, start, jump
  await page.goto(URL, { waitUntil: 'load', timeout: LOAD_TIMEOUT });
  const title = await waitFor((s) => s.mode === 'title', LOAD_TIMEOUT);
  check('load: title screen reached', !!title, `${el()}`);
  if (!title) throw new Error('title never reached');
  await cmd('noauto'); await cmd('quality:' + TIER); await cmd('reset_save');
  await page.touchscreen.tap(W / 2, H / 2);
  if (!(await waitFor((s) => s.mode === 'wake' || s.mode === 'play', 60000))) await cmd('begin');
  await wait(800);
  await cmd('jump:hollow_walk');
  let s = await waitFor((q) => q.area === 'hollow_walk' && q.mode === 'play', 30000);
  check('jump: in Our Steps (hollow_walk), unsolved', s && s.steps && s.steps.done === false && s.steps.active === false, JSON.stringify(s?.steps));
  // ---------------------------------------------------------------- to the gap, by touch
  const nearE = at(0, EDGE_V - 0.9);
  const ok0 = await walkTo(nearE[0], nearE[1], 0.3);
  s = await st();
  check('touch: walked to the floor\'s gap', ok0, `pos ${s.pos}`);
  await wait(600);
  check('before stepping on: the glass is a plain mirror (her figure not in it)', s.steps.hold === false && s.steps.active === false, JSON.stringify(s.steps));
  await shot('before: the glass, only a mirror');
  // ---------------------------------------------------------------- onto the floor (one drag toward the glass)
  await thumbTo(rot(screenDir(V[0], V[2]), 7));
  s = await waitFor((q) => q.steps.active, 30000);
  await thumbUp();
  check('touch: onto the floor by the stick', !!s, '');
  s = await waitFor((q) => q.steps.active && !q.steps.moving, 20000);
  const b0 = board(0);
  check('on the floor: you on your start, she in the glass on hers', s && eq(s.steps.p, b0.P) && eq(s.steps.h, b0.A) && s.steps.hold === true, JSON.stringify(s?.steps));
  await wait(500);
  await shot('on: she appears in the glass');
  // ---------------------------------------------------------------- both boards, one touch drag per move
  const ERR = [9, -13, 4, -7, 12, -3];       // degrees off-axis: a thumb is never straight
  let n = 0;
  for (let bi = 0; bi < BOARDS.length; bi++) {
    const b = board(bi);
    let p = b.P, h = b.A;
    const rec = { title: BOARDS[bi].title, par: BOARDS[bi].par, moves: [] };
    for (let i = 0; i < plans[bi].length; i++) {
      const d = plans[bi][i];
      const [np, nh] = step(b, p, h, d);
      const s0 = await st();
      const m0 = s0.steps.moves;
      const err = ERR[n++ % ERR.length];
      await thumbTo(rot(screenDir(U[0] * d[0] + V[0] * d[1], U[2] * d[0] + V[2] * d[1]), err));
      const s1 = await waitFor((q) => q.steps.moves > m0 || q.steps.bi !== bi || q.steps.done || !q.steps.active, 30000);
      await thumbUp();
      const last = i === plans[bi].length - 1;
      const s2 = await waitFor((q) => last ? (q.steps.done || (q.steps.bi === bi + 1 && q.steps.between <= 0 && !q.steps.moving)) : (!q.steps.moving), 40000);
      const good = !!s1 && !!s2 && (last ? true : eq(s2.steps.p, np) && eq(s2.steps.h, nh) && s2.steps.moves === m0 + 1);
      check(`board ${bi + 1} move ${i + 1}/${plans[bi].length}: drag ${JSON.stringify(d)} (${err > 0 ? '+' : ''}${err} deg): you ${np} / her ${nh}`, good,
        s2 ? `game: p ${s2.steps.p} h ${s2.steps.h} moves ${s2.steps.moves} blocked ${s2.steps.blocked}` : 'timed out');
      rec.moves.push({ d, err, p: np, h: nh });
      p = np; h = nh;
      if (last && bi === 0) await wait(300);
      await shot(`board ${bi + 1} move ${i + 1}${last ? (bi + 1 < BOARDS.length ? ': answered, the next board rises' : ': SOLVED') : ''}`);
      if (!good) throw new Error(`board ${bi + 1} move ${i + 1} did not land`);
    }
    summary.boards.push(rec);
    if (bi + 1 < BOARDS.length) {
      const nb = board(bi + 1);
      s = await st();
      check(`board ${bi + 1} answered: board ${bi + 2} '${BOARDS[bi + 1].title}' up, both at its start`, s.steps.bi === bi + 1 && s.steps.boards_done === bi + 1 && eq(s.steps.p, nb.P) && eq(s.steps.h, nb.A), JSON.stringify(s.steps));
    }
  }
  s = await waitFor((q) => q.steps.done && q.chapter?.hollow_done, 10000);
  check('SOLVED: both boards answered by touch (hollow_done)', !!s, JSON.stringify((await st()).steps));
  s = await waitFor((q) => q.steps.hold === false, 10000);
  check('solved: the glass clears (a plain mirror again)', !!s, '');
  // ---------------------------------------------------------------- out, by touch, to the Court
  const t10 = tile([1, 0]);
  const route = [[t10, 'off the floor'], [nearE, 'the gap'], [[17.85, -10.3], 'the walk'], [[17.85, -11.8], 'by the gate']];
  for (const [pt, label] of route) {
    const ok = await walkTo(pt[0], pt[1], 0.4);
    check(`walk out (touch): ${label}`, ok, `pos ${(await st()).pos}`);
    if (!ok) throw new Error('walk out stuck at ' + label);
    await shot(`walk out: ${label}`);
  }
  s = await waitFor((q) => q.steps.gate_open, 15000);
  check('the exit opens (the gate rises)', !!s, '');
  await wait(1500);
  await shot('the gate open');
  for (const [pt, label] of [[[18.3, -13.0], 'through the gate'], [[18.5, -16.2], 'up the ramp'], [[17.6, -17.8], 'the top'], [[15.0, -18.4], 'the Court']]) {
    const ok = await walkTo(pt[0], pt[1], 0.45);
    if (!ok) { check(`walk out (touch): ${label}`, false, `pos ${(await st()).pos}`); throw new Error('walk stuck at ' + label); }
    if (label === 'the Court' || label === 'up the ramp') await shot(`walk out: ${label}`);
  }
  s = await waitFor((q) => q.area === 'court_light', 10000);
  check('reached the next area (Court of Light) on foot, by touch', !!s, `area ${(await st()).area}`);
} catch (e) {
  fatal = String(e && e.stack || e);
  check('harness: run completed without an exception', false, fatal.split('\n')[0]);
  await shot('at the failure').catch(() => {});
}
check('console: 0 errors', errors.length === 0, errors.length ? JSON.stringify(errors.slice(0, 5)) : '');
fs.writeFileSync(`${OUT}${TAG}-console.log`, consoleLog.join('\n') + '\n');
await browser.close().catch(() => {});
const failed = results.filter((r) => !r.pass);
summary.checks = results.length; summary.failed = failed.length; summary.wall_s = +((Date.now() - T0) / 1000).toFixed(1);
console.log(`WEB OURSTEPS ${failed.length ? 'FAILED' : 'OK'}  checks=${results.length}  failed=${failed.length}  shots=${shots.length}  wall=${summary.wall_s}s`);
console.log('OS_JSON ' + JSON.stringify(summary));
process.exit(failed.length ? 1 : 0);
