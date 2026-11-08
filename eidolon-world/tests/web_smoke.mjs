// EIDOLON web smoke test, v3 (Chapter I v3: scenes/main3.tscn is the main scene). Playwright + SwiftShader, mobile
// 390x844 DPR 2. Run through tests/smoke.sh, or:
//   flock /home/user/game/realms/dev/.shotlock timeout 900 node tests/web_smoke.mjs --url <index url> [--out <dir>] [--tag smoke]
// Checks: load + title, 0 console / WebGL errors, default tier HIGH on a fresh profile; a real tap starts the cards +
// the prologue (its first view cannot be skipped), a long press skips it once seen; I.1 by REAL TOUCH (the thumb walks
// her onto the plate only the water shows); one screenshot per landmark space of every part (sanity: not black /
// white / blank; music RMS above -40 dBFS in >= 3); a solve through the hooks counts the jingle (E.5); the Veiled Way
// opens on the three Beacons; THE CHAPTER'S END by touch (walk to the shrine's lip, tap: the film runs, a long press
// skips it: state.end); a High-tier stretch. Frames run at ~1 fps under SwiftShader: jumps and solves go through the
// dev hooks (window.ewCmd / ewState); the inputs that are tested are real touch.
// Exit 0 = all checks pass. Last lines: "WEB SMOKE OK|FAILED ..." and "SMOKE_JSON {...}".
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:8123/eidolon-world/build/web/index.html');
const OUT = arg('--out', '/home/user/game/eidolon-world/dev/shots/').replace(/\/?$/, '/');
const TAG = arg('--tag', 'smoke');
const LOAD_TIMEOUT = +arg('--load-timeout', 240) * 1000;
const ROOM_WAIT = +arg('--room-wait', 2500);
const RMS_MIN_DB = -40;
const RENDER_TIER = arg('--tier', 'low');
const SHOT_SCALE = arg('--shot-scale', 'css');
const BUDGET = +arg('--budget', 520) * 1000;        // the room loop stops here
const W = 390, H = 844;
const HIGH_WAIT = +arg('--high-wait', 5000);
// one landmark space per part (Map3 ids): the hub, the West, the North, the East, Act 3
const ROOMS = ['I3', 'A', 'W3', 'W5', 'N2', 'N4', 'E1', 'E2', 'E3', 'E5', 'EB', 'P', 'I21', 'I22', 'I23'];
fs.mkdirSync(OUT, { recursive: true });

const T0 = Date.now();
const el = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const info = (...a) => console.log(`[${el()}]`, ...a);

// ---------------------------------------------------------------- tiny PNG decoder (8-bit, non-interlaced)
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0, bd = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12]) throw new Error('interlaced png'); }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8) throw new Error('png bit depth ' + bd);
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]; const stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat)); const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = x >= bpp && y ? px[o - stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[o + x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
// luminance mean / std dev / near-black and near-white fractions, sampled on a 2 px grid
function imageStats(buf) {
  const { w, h, bpp, px } = decodePng(buf);
  let n = 0, s = 0, s2 = 0, blk = 0, wht = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * bpp; const L = bpp >= 3 ? 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] : px[i];
    n++; s += L; s2 += L * L; if (L < 8) blk++; if (L > 247) wht++;
  }
  const mean = s / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  return { w, h, mean: +mean.toFixed(1), sd: +sd.toFixed(1), black: +(blk / n).toFixed(3), white: +(wht / n).toFixed(3) };
}
const imageOk = (st) => st.mean > 6 && st.mean < 245 && st.sd > 8 && st.black < 0.97 && st.white < 0.9;

// ---------------------------------------------------------------- browser
const isRemote = URL.startsWith('https');
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  proxy: isRemote && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => {
  // an AnalyserNode spliced in before the AudioContext destination (everything audible passes through it)
  const orig = AudioNode.prototype.connect;
  window.__an = [];
  AudioNode.prototype.connect = function (dst, ...rest) {
    if (dst instanceof AudioDestinationNode) {
      const c = dst.context;
      if (!c.__an) { c.__an = c.createAnalyser(); c.__an.fftSize = 32768; orig.call(c.__an, dst); window.__an.push(c.__an); window.__ctx = c; }
      return orig.call(this, c.__an, ...rest);
    }
    return orig.call(this, dst, ...rest);
  };
});
const page = await ctx.newPage();
page.setDefaultTimeout(180000);
const cdp = await ctx.newCDPSession(page);
const consoleLog = [], errors = [], glErrors = [];
const GL_RX = /webgl|GL_INVALID|GL ERROR|CONTEXT_LOST|INVALID_(ENUM|VALUE|OPERATION|FRAMEBUFFER)/i;
page.on('console', (m) => {
  const line = `[${el()} ${m.type()}] ${m.text()}`; consoleLog.push(line);
  // (GL Driver Message "Performance" notes, e.g. "GPU stall due to ReadPixels" from screenshots, are not errors)
  if (GL_RX.test(m.text()) && (m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message \(OpenGL, Performance/.test(m.text())) glErrors.push(m.text());
  else if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => { consoleLog.push(`[${el()} pageerror] ${e.message}`); errors.push('pageerror: ' + e.message); });
page.on('requestfailed', (r) => { consoleLog.push(`[${el()} reqfail] ${r.url()} ${r.failure()?.errorText}`); errors.push('requestfailed: ' + r.url()); });
page.on('response', (r) => { if (r.status() >= 400) { consoleLog.push(`[${el()} http ${r.status()}] ${r.url()}`); if (!/favicon/.test(r.url())) errors.push(`http ${r.status()} ${r.url()}`); } });

const st = () => page.evaluate(() => window.ewState || null);
const cmd = (c) => page.evaluate((c) => window.ewCmd(c), c);
const wait = (ms) => page.waitForTimeout(ms);
async function waitFor(fn, ms) { const t = Date.now(); while (Date.now() - t < ms) { const s = await st().catch(() => null); if (s && fn(s)) return s; await wait(300); } return null; }
// music RMS from the analyser's last 32768 samples (~0.7 s): one snapshot per call; the page's main thread
// runs about one frame a second under SwiftShader, so a polling loop inside the page would starve
async function rms() {
  return page.evaluate(() => {
    let p = 0, n = 0, peak = 0;
    for (const an of window.__an) { const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b); for (const v of b) { p += v * v; peak = Math.max(peak, Math.abs(v)); } n += b.length; }
    return { p: n ? p / n : 0, peak, ctx: window.__ctx ? window.__ctx.state : 'no-ctx', analysers: window.__an.length };
  });
}
const dB = (x) => (x > 0 ? +(10 * Math.log10(x)).toFixed(1) : -200);   // (power -> dBFS)

const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
// the camera never turns: screen right is world (+x, +z), screen up is world (+x, -z)
const screenDir = (dx, dz) => { const r = (dx + dz) * Math.SQRT1_2, u = (dx - dz) * Math.SQRT1_2; const l = Math.hypot(r, u) || 1; return [r / l, -u / l]; };
const BASE = [Math.round(W * 0.22), Math.round(H * 0.70)];
const REACH = 62;
async function walk(pts, tol = 0.4, ms = 240000) {
  const t = Date.now(); let down = false, last = null;
  for (const g of pts) {
    for (;;) {
      if (Date.now() - t > ms) { if (down) await touch('touchEnd'); info('walk: out of time'); return false; }
      const s = await st();
      const dx = g[0] - s.pos[0], dz = g[1] - s.pos[2], d = Math.hypot(dx, dz);
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
const pz = (s, id) => !!(s && s.pz && s.pz[id] && s.pz[id].done);
const near = (s, x, z, r) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < r;
const BEATS = ['WS', 'I1', 'I2', 'I3', 'IB1', 'I4', 'I5', 'A', 'WR', 'W1', 'W2', 'W3', 'W4', 'W5', 'IBW', 'W6', 'WB', 'W7', 'N1', 'NG', 'N2', 'N3',
  'N4', 'IBN', 'N5', 'N6', 'N7', 'NB', 'ER', 'E1', 'E2', 'IBE', 'E3', 'E4', 'E5', 'EB', 'EH', 'VW', 'P', 'PW', 'I21', 'I22'];

let fatal = null;
const summary = { url: URL, rooms: {}, audio: {}, shots: [] };
try {
  // ---------------------------------------------------------------- load + title
  info('goto', URL);
  await page.goto(URL, { waitUntil: 'load', timeout: LOAD_TIMEOUT });
  const title = await waitFor((s) => s.mode === 'title', LOAD_TIMEOUT);
  summary.load_s = +((Date.now() - T0) / 1000).toFixed(1);
  check('load: title screen reached (v3)', !!title && Array.isArray(title.items) && title.pz && title.pz.I23, `in ${summary.load_s}s`);
  if (!title) throw new Error('title never reached');
  check('quality: default tier is HIGH on a fresh profile', title.tier === 'HIGH' && title.quality_high === true, `tier=${title.tier} quality_high=${title.quality_high}`);
  await cmd('noauto'); await cmd('quality:' + RENDER_TIER); await cmd('reset_save');
  // ---------------------------------------------------------------- a real tap: the cards + the prologue
  await page.touchscreen.tap(W / 2, H / 2);
  const c0 = await waitFor((s) => s.mode === 'cine', 60000);
  check('start: a tap on the title starts the cards + the prologue', !!c0, c0 ? '' : 'mode ' + (await st())?.mode);
  await touch('touchStart', W / 2, H / 2); await wait(5000); await touch('touchEnd'); await wait(1200);
  let s = await st();
  check('prologue: the first view cannot be skipped', s.mode === 'cine' && !s.seen.prologue, `mode ${s.mode}`);
  await cmd('seen:1');
  await touch('touchStart', W / 2, H / 2);
  s = await waitFor((s) => s.mode === 'play', 90000);
  await touch('touchEnd');
  check('prologue: once seen, a long press skips it into play at the shore with the comb', s && near(s, -4.6, 31.3, 1.5) && s.items.includes('comb'), s ? JSON.stringify(s.pos) : 'no');
  await wait(1500);
  // ---------------------------------------------------------------- I.1 by real touch
  await walk([[0.8, 33.0], [3.5, 32.0], [6.0, 28.5]], 0.3);
  s = await waitFor((s) => pz(s, 'I1'), 30000);
  check('I.1 (touch): standing on the plate the water shows opens the door', !!s);
  // ---------------------------------------------------------------- every part: a landmark space each, shot + music
  const loud = [];
  for (const room of ROOMS) {
    if (Date.now() - T0 > BUDGET) { check(`shot ${room}`, false, `skipped: time budget ${BUDGET / 1000}s used up`); continue; }
    if (room === 'P') { await cmd('pz_solve:P'); await wait(2500); await cmd('tp:-6.4:25.2:0'); }          // (the pool is water: on its risen road)
    else await cmd('v3jump:' + room);
    await waitFor((s) => s.space === room || s.space.startsWith(room + '~'), 20000);
    await wait(ROOM_WAIT);
    const path = `${OUT}${TAG}-${room}.png`;
    const r1 = await rms();
    const buf = await page.screenshot({ path, timeout: 120000, scale: SHOT_SCALE });
    const s2 = await st();
    const im = imageStats(buf);
    const r2 = await rms();
    const r = { rms_db: dB((r1.p + r2.p) / 2), max_db: dB(Math.max(r1.peak, r2.peak) ** 2), ctx: r2.ctx };
    summary.rooms[room] = { space: s2.space, pos: s2.pos, fps: s2.fps, music: s2.music, img: im, rms_db: r.rms_db };
    summary.shots.push(path);
    if (r.rms_db > RMS_MIN_DB) loud.push(room);
    check(`shot ${room}`, imageOk(im) && s2.space.split('~')[0] === room, `space=${s2.space} mean=${im.mean} sd=${im.sd} black=${im.black} white=${im.white} -> ${path}`);
    info(`room ${room}: music=${s2.music} rms=${r.rms_db} dBFS fps=${s2.fps} tier=${s2.tier}`);
  }
  check(`audio: music RMS > ${RMS_MIN_DB} dBFS in >= 3 rooms`, loud.length >= 3, `${loud.length}/${ROOMS.length}: ${loud.join(', ')}`);
  const a = await st();
  const beds = a.beds || {};
  const playingBeds = Object.keys(beds).filter((k) => Array.isArray(beds[k]) && beds[k][2] === true && beds[k][0] > -40);
  summary.audio = { sfx_ready: a.sfx_ready, music: a.music, drone: a.drone, played: a.played };
  check('audio: state dump (sfx ready, music set, an audible bed playing)', a.sfx_ready === true && !!a.music && playingBeds.length > 0,
    `sfx_ready=${a.sfx_ready} music=${a.music} beds=${playingBeds.join(',')}`);
  // ---------------------------------------------------------------- a solve through the hooks: the jingle (E.5, the Scales)
  await cmd('v3jump:E5'); await wait(1500);
  const j0 = (await st()).played?.jingle || 0;
  await cmd('pz_solve:E5');
  const jg = await waitFor((s) => pz(s, 'E5') && (s.played?.jingle || 0) > j0, 20000);
  check('puzzle: E.5 solves through the hooks and the jingle is counted', !!jg, `jingle ${j0} -> ${(await st()).played?.jingle || 0}`);
  // ---------------------------------------------------------------- the three Beacons open the Veiled Way; THE END by touch
  for (const b of BEATS) await cmd('pz_solve:' + b);
  await cmd('give:lamp');
  await wait(1500);
  await cmd('tp:-40.0:20.6:0');
  await waitFor((s) => s.space === 'I23', 20000);
  await wait(1500);
  await walk([[-40.0, 18.3]], 0.25, 90000);
  await tapButton();
  s = await waitFor((s) => s.mode === 'cine', 60000);
  check('the end (touch): at the shrine\'s lip a tap starts the film (I.23 done, saved)', !!s && pz(s, 'I23'), s ? `cine_t ${s.cine_t}` : 'mode ' + (await st()).mode);
  await wait(4000);
  const film = await page.screenshot({ path: `${OUT}${TAG}-end.png`, timeout: 120000, scale: SHOT_SCALE });
  summary.shots.push(`${OUT}${TAG}-end.png`);
  check('the end: the film frame is not blank', imageOk(imageStats(film)));
  await touch('touchStart', W / 2, H / 2);
  s = await waitFor((s) => s.mode === 'play' && s.end === true, 120000);
  await touch('touchEnd');
  check('the end: a long press skips the film; Chapter I is marked ended and she is free', !!s, s ? `end=${s.end} mode=${s.mode}` : JSON.stringify({ mode: (await st()).mode, end: (await st()).end }));
  // ---------------------------------------------------------------- a stretch on HIGH (for the console checks)
  await cmd('quality:high');
  await waitFor((s) => s.tier === 'HIGH', 90000);
  await cmd('v3jump:W5'); await wait(HIGH_WAIT);
  const sh = await st();
  check('quality: a High-tier stretch ran for the console checks', sh.tier === 'HIGH', `tier=${sh.tier} fps=${sh.fps}`);
  await cmd('quality:' + RENDER_TIER);
} catch (e) {
  fatal = String(e && e.stack || e);
  check('harness: run completed without an exception', false, fatal.split('\n')[0]);
}
// ---------------------------------------------------------------- console
check('console: 0 errors', errors.length === 0, errors.length ? JSON.stringify(errors.slice(0, 5)) : '');
check('console: 0 WebGL errors', glErrors.length === 0, glErrors.length ? JSON.stringify(glErrors.slice(0, 5)) : '');
const logPath = `${OUT}${TAG}-console.log`;
fs.writeFileSync(logPath, consoleLog.join('\n') + '\n');
summary.console_log = logPath; summary.console_lines = consoleLog.length;
await browser.close().catch(() => {});
const failed = results.filter((r) => !r.pass);
summary.checks = results.length; summary.failed = failed.length; summary.wall_s = +((Date.now() - T0) / 1000).toFixed(1);
summary.results = results;
console.log(`WEB SMOKE ${failed.length ? 'FAILED' : 'OK'}  checks=${results.length}  failed=${failed.length}  wall=${summary.wall_s}s  console_log=${logPath}`);
console.log('SMOKE_JSON ' + JSON.stringify(summary));
process.exit(failed.length ? 1 : 0);
