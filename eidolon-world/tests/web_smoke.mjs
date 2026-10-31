// EIDOLON web smoke test (Playwright + SwiftShader, mobile 390x844 DPR 2). Run through tests/smoke.sh, or:
//   flock /home/user/game/realms/dev/.shotlock timeout 600 node tests/web_smoke.mjs --url <index url> [--out <dir>] [--tag smoke]
// Checks: load + title within a timeout, 0 console errors, 0 WebGL errors, default tier HIGH on a fresh profile,
// music RMS above -40 dBFS in >= 3 rooms (AnalyserNode spliced before the destination), the audio state dump,
// one screenshot per Chapter I space (sanity: not black / white / blank) and a puzzle solve that counts the jingle.
// The game renders at ~1 fps under SwiftShader, so everything goes through the dev hooks (window.ewCmd / ewState).
// Exit 0 = all checks pass. A JSON summary is printed on the last line, prefixed "SMOKE_JSON ".
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
// the walk-through renders on this tier (after the default-tier check): SwiftShader at DPR 2 on High (full-res,
// MSAA, 4096 shadow atlas) takes minutes per frame-heavy room; Low keeps the run inside the time budget
const RENDER_TIER = arg('--tier', 'low');
const SHOT_SCALE = arg('--shot-scale', 'css');       // css = 390x844 PNGs (4x cheaper to encode than DPR 2), device
const BUDGET = +arg('--budget', 430) * 1000;        // the room loop stops here (the solve + checks must still fit in 10 min)
const W = 390, H = 844;
const HIGH_ROOMS = arg('--high-rooms', 'shard_gallery').split(',').filter(Boolean);
const HIGH_WAIT = +arg('--high-wait', 5000);
const ROOMS = ['waking_pool', 'stair_breath', 'hall_glass', 'shard_gallery', 'garden_veiled', 'hollow_walk', 'court_light',
  'mist_maze', 'echo_corridor', 'scales', 'eidolon_ledge', 'gate_four', 'first_shrine'];
// (v0.8.5: main.gd ROOM_ENTRY.mist_maze now lands inside the maze doorway at (12.0, -28.0): no nudge needed)
const ENTRY_NUDGE = {};
fs.mkdirSync(OUT, { recursive: true });

const T0 = Date.now();
const el = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';
const results = [];            // {name, pass, detail}
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

let fatal = null;
const summary = { url: URL, rooms: {}, audio: {}, shots: [] };
try {
  // ---------------------------------------------------------------- load + title
  info('goto', URL);
  await page.goto(URL, { waitUntil: 'load', timeout: LOAD_TIMEOUT });
  const title = await waitFor((s) => s.mode === 'title', LOAD_TIMEOUT);
  summary.load_s = +((Date.now() - T0) / 1000).toFixed(1);
  check('load: title screen reached', !!title, `in ${summary.load_s}s (limit ${LOAD_TIMEOUT / 1000}s)`);
  if (!title) throw new Error('title never reached');
  // ---------------------------------------------------------------- default quality on a fresh profile
  check('quality: default tier is HIGH on a fresh profile', title.tier === 'HIGH' && title.quality_high === true, `tier=${title.tier} quality_high=${title.quality_high}`);
  // the walk-through tier (frames on High at DPR 2 take many seconds under SwiftShader), set before the tap
  await cmd('noauto'); await cmd('quality:' + RENDER_TIER);
  // ---------------------------------------------------------------- start (a real tap: unlocks audio)
  await cmd('reset_save');
  await page.touchscreen.tap(W / 2, H / 2);
  // (the tap starts the waking cinematic: mode "wake", then "play"; the jumps below put it in play directly)
  const play = await waitFor((s) => s.mode === 'wake' || s.mode === 'play', 60000);
  check('start: a tap on the title starts the game', !!play, play ? `mode=${play.mode} music=${play.music}` : 'mode stayed ' + (await st())?.mode);
  if (!play) { info('tap did not start the game; falling back to the begin hook'); await cmd('begin'); }
  await wait(1000);
  info('walk-through tier', (await st()).tier);
  // ---------------------------------------------------------------- every Chapter I space: screenshot + music RMS
  const loud = [];
  for (const room of ROOMS) {
    if (Date.now() - T0 > BUDGET) { check(`shot ${room}`, false, `skipped: time budget ${BUDGET / 1000}s used up`); continue; }
    await cmd('jump:' + room);
    if (ENTRY_NUDGE[room]) { await wait(800); await cmd(`tp:${ENTRY_NUDGE[room][0]}:${ENTRY_NUDGE[room][1]}`); }
    await wait(ROOM_WAIT);
    const path = `${OUT}${TAG}-${room}.png`;
    const r1 = await rms();
    const buf = await page.screenshot({ path, timeout: 120000, scale: SHOT_SCALE });
    const s = await st();
    const im = imageStats(buf);
    const r2 = await rms();
    const r = { rms_db: dB((r1.p + r2.p) / 2), max_db: dB(Math.max(r1.peak, r2.peak) ** 2), ctx: r2.ctx };
    summary.rooms[room] = { area: s.area, pos: s.pos, fps: s.fps, music: s.music, img: im, rms_db: r.rms_db, peak_db: r.max_db, ctx: r.ctx };
    summary.shots.push(path);
    if (r.rms_db > RMS_MIN_DB) loud.push(room);
    check(`shot ${room}`, imageOk(im) && s.area === room, `area=${s.area} mean=${im.mean} sd=${im.sd} black=${im.black} white=${im.white} -> ${path}`);
    info(`room ${room}: music=${s.music} rms=${r.rms_db} dBFS peak=${r.max_db} ctx=${r.ctx} fps=${s.fps} tier=${s.tier}`);
  }
  check(`audio: music RMS > ${RMS_MIN_DB} dBFS in >= 3 rooms`, loud.length >= 3, `${loud.length}/${ROOMS.length} rooms: ${loud.join(', ')}`);
  // ---------------------------------------------------------------- audio state dump
  const a = await st();
  const beds = a.beds || {};
  const bedFiles = Object.keys(beds).filter((k) => Array.isArray(beds[k]));
  const playingBeds = bedFiles.filter((k) => beds[k][2] === true && beds[k][0] > -40);
  summary.audio = { sfx_ready: a.sfx_ready, music: a.music, drone: a.drone, buses: a.buses, beds, played: a.played };
  check('audio: state dump (sfx ready, music set, an audible bed playing)', a.sfx_ready === true && !!a.music && playingBeds.length > 0,
    `sfx_ready=${a.sfx_ready} music=${a.music} drone=${a.drone} beds=${bedFiles.length} audible+playing=${playingBeds.join(',')} jingle_duck=${beds.jingle_duck} bed_restart=${a.played?.bed_restart || 0}`);
  // ---------------------------------------------------------------- one puzzle solve through the hooks: the shadow chamber
  info('solve: jump to the shadow chamber');
  await cmd('jump:shard_gallery'); await wait(2000);
  const j0 = (await st()).played?.jingle || 0;
  for (const b of [3, 0, 1, 4]) { await cmd('call:toggle_brazier:' + b); await wait(800); }
  const solved = await waitFor((s) => s.chapter?.gallery === true, 30000);
  const jg = await waitFor((s) => (s.played?.jingle || 0) > j0, 15000);
  const rj = await rms(); rj.rms_db = dB(rj.p);
  info('solve: done');
  const sj = await st();
  check('puzzle: shadow chamber solves via hooks and the jingle is counted', !!solved && !!jg,
    `gallery=${sj.chapter?.gallery} jingle ${j0} -> ${sj.played?.jingle || 0} rms_during=${rj.rms_db} dBFS duck=${sj.beds?.jingle_duck}`);
  summary.solve = { gallery: sj.chapter?.gallery, jingle_before: j0, jingle_after: sj.played?.jingle || 0, rms_during: rj.rms_db };
  // ---------------------------------------------------------------- (QA_V11 P1-1) a stretch on HIGH: the console check must see
  // the High-tier passes too (the flame shadows flooded it there and nowhere else); no shots (frames are slow on High)
  if (HIGH_ROOMS.length) {
    await cmd('quality:high');
    // (after the solve: the chamber's braziers are lit, so the shadowed key flame renders)
    for (const room of HIGH_ROOMS) { if (room !== 'shard_gallery') await cmd('jump:' + room); await wait(HIGH_WAIT); }
    const sh = await st();
    check('quality: a High-tier stretch ran (flames, shadows) for the console checks', sh.tier === 'HIGH', `tier=${sh.tier} rooms=${HIGH_ROOMS.join(',')} fps=${sh.fps}`);
    await cmd('quality:' + RENDER_TIER);
  }
  if (argv.includes('--solve-shot')) {        // (opt-in: the first frames after this solve take ~1.5 min under SwiftShader)
    await page.screenshot({ path: `${OUT}${TAG}-solve-shard_gallery.png`, timeout: 150000, scale: SHOT_SCALE });
    info('solve: shot saved');
  }
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
