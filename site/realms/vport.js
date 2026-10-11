// =====================================================================
// ORBIS virtual viewport (agent "fullscreen", v2.2): the game is always presented in landscape.
//
// When the real viewport is portrait (a phone held upright with its rotation locked, iOS Safari, no orientation lock),
// the whole app is drawn into a landscape frame turned by 90 degrees: <body> becomes a fixed W x H box (W = the
// screen's height, H = its width) with transform: matrix(...) (transform-origin 0 0), so the player turns the phone
// sideways and sees a normal landscape game. A transformed body is also the containing block of every
// position: fixed descendant (HUD, dialogs, crown layers, loader), so the whole UI turns with it.
// A desktop browser with a portrait-shaped window is letterboxed instead (a landscape box scaled to the width).
//
// Everything that does manual coordinate maths reads this module instead of innerWidth / innerHeight / clientX:
//   VP.W, VP.H          the game's viewport in CSS px (== innerWidth / innerHeight when nothing is transformed)
//   toGame(cx, cy)      screen (client) px -> game px (shared result object: copy x / y out right away)
//   gRect(el)           getBoundingClientRect() mapped back into game px
//   landscape()         VP.W > VP.H (what CSS's (orientation: landscape) means for the game)
// CSS follows too: while the frame is transformed, every @media size / orientation condition in the same-origin
// style sheets is re-evaluated against VP.W x VP.H (rewritten to an always-true / always-false feature, the originals
// are kept and restored), viewport units (vw / vh / dvh / svh / vmin / vmax) read --vw1 / --vh1 (one game vw / vh in
// px), and the safe-area insets are re-mapped to the game's edges. All of this runs on a resize only, never per frame.
// URL override for testing: ?vp=rot | ?vp=rot-90 | ?vp=box | ?vp=off
// =====================================================================
const root = document.documentElement;
const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false, addEventListener() {} });
const coarse = mq('(pointer: coarse)'), noHover = mq('(hover: none)');
const force = (/[?&]vp=([\w-]+)/.exec(location.search) || [])[1] || '';

export const VP = { W: innerWidth, H: innerHeight, SW: innerWidth, SH: innerHeight, mode: '', rot: 0, s: 1, on: false, m: [1, 0, 0, 1, 0, 0], im: [1, 0, 0, 1, 0, 0] };
if (typeof window !== 'undefined') window.__vp = VP; // test hook
const _g = { x: 0, y: 0 };
/** screen (client) coordinates -> game coordinates. Returns a shared object: read x / y at once. */
export function toGame(cx, cy, out = _g) {
  const m = VP.im;
  out.x = m[0] * cx + m[2] * cy + m[4]; out.y = m[1] * cx + m[3] * cy + m[5];
  return out;
}
/** game coordinates -> screen (client) coordinates */
export function toScreen(gx, gy, out = { x: 0, y: 0 }) {
  const m = VP.m;
  out.x = m[0] * gx + m[2] * gy + m[4]; out.y = m[1] * gx + m[3] * gy + m[5];
  return out;
}
/** an element's bounding box in game coordinates (getBoundingClientRect is screen space) */
export function gRect(el) {
  const r = el.getBoundingClientRect();
  if (!VP.on) return r;
  const a = toGame(r.left, r.top), ax = a.x, ay = a.y, b = toGame(r.right, r.bottom);
  const left = Math.min(ax, b.x), right = Math.max(ax, b.x), top = Math.min(ay, b.y), bottom = Math.max(ay, b.y);
  return { left, top, right, bottom, x: left, y: top, width: right - left, height: bottom - top };
}
export const landscape = () => VP.W > VP.H;
export const isTouch = () => coarse.matches || (noHover.matches && navigator.maxTouchPoints > 0);
const subs = new Set();
/** fn(VP) after every change of the frame (mode, rotation or size) */
export function onViewport(fn) { subs.add(fn); return () => subs.delete(fn); }

// ---------------------------------------------------------------- CSS: viewport units and @media conditions
const UNIT = /(-?\d*\.?\d+)(d|s|l)?(vw|vh|vmin|vmax)\b/g;
const VAR = { vw: '--vw1', vh: '--vh1', vmin: '--vmin1', vmax: '--vmax1' };
const media = []; // [CSSMediaRule|MediaList owner, original text]
let cssDone = false;
function walk(rules, fn) {
  for (const r of rules) {
    fn(r);
    if (r.cssRules && r.type !== 7 /* keyframes are handled through fn */) { try { walk(r.cssRules, fn); } catch { /* cross-origin */ } }
  }
}
function prepCSS() {
  if (cssDone) return;
  cssDone = true;
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch { continue; } // cross-origin (Google Fonts): nothing of ours in there
    if (!rules) continue;
    walk(rules, (r) => {
      if (r.media && r.conditionText !== undefined && r.type === 4) media.push([r, r.media.mediaText]);
      const st = r.style; if (!st) { if (r.type === 7) for (const k of r.cssRules) fixStyle(k.style); return; }
      fixStyle(st);
    });
  }
}
function fixStyle(st) {
  if (!st) return;
  const t = st.cssText;
  if (!/\d(d|s|l)?(vw|vh|vmin|vmax)\b/.test(t)) return;
  // the fallback keeps the original unit, so nothing changes while the frame is not transformed
  const n = t.replace(UNIT, (m, num, pre, u) => `calc(${num} * var(${VAR[u]}, 1${pre || ''}${u}))`);
  if (n !== t) { try { st.cssText = n; } catch { /* keep it */ } }
}
const FEAT = /\(\s*(min-|max-)?(width|height|aspect-ratio|orientation)\s*:\s*([^)]+?)\s*\)/g;
const T_ = '(min-width: 0px)', F_ = '(max-width: 0.01px)';
const len = (v) => { const n = parseFloat(v); return /em\b/.test(v) ? n * 16 : n; };
function evalMedia(text) {
  const W = VP.W, H = VP.H;
  return text.replace(FEAT, (m, pre, name, val) => {
    let ok;
    if (name === 'orientation') ok = (val === 'landscape') === (W > H);
    else {
      let a, b;
      if (name === 'aspect-ratio') { const [p, q] = val.split('/').map(parseFloat); a = W / H; b = q ? p / q : p; }
      else { a = name === 'width' ? W : H; b = len(val); }
      ok = pre === 'min-' ? a >= b - 1e-6 : pre === 'max-' ? a <= b + 1e-6 : Math.abs(a - b) < 0.5;
    }
    return ok ? T_ : F_;
  });
}
function applyMedia(on) {
  for (const [r, orig] of media) {
    const want = on ? evalMedia(orig) : orig;
    if (r.media.mediaText !== want) { try { r.media.mediaText = want; } catch { /* keep */ } }
  }
}

// ---------------------------------------------------------------- the frame
const SAFE = { // game edge <- screen edge, per rotation
  90: { t: 'right', r: 'bottom', b: 'left', l: 'top' },
  [-90]: { t: 'left', r: 'top', b: 'right', l: 'bottom' },
};
let sig = '';
function decide(sw, sh) {
  if (force === 'off') return '';
  if (force === 'rot' || force === 'rot-90' || force === 'box') return sh > sw ? force : '';
  if (sh <= sw) return '';
  return isTouch() ? 'rot' : 'box';
}
export function update() {
  const sw = innerWidth, sh = innerHeight;
  if (!sw || !sh) return;
  const mode = decide(sw, sh);
  let m, W = sw, H = sh, rot = 0, s = 1;
  if (mode === 'rot' || mode === 'rot-90') {
    // which way to turn: the sideways hold that matches the device's own report (an upside-down portrait flips it)
    const ang = (screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : +window.orientation || 0);
    rot = mode === 'rot-90' ? -90 : ((ang % 360) + 360) % 360 === 180 ? -90 : 90;
    W = sh; H = sw;
    // rotate(90deg): game (x, y) -> screen (sw - y, x): the game's top edge lies along the screen's right side
    m = rot === 90 ? [0, 1, -1, 0, sw, 0] : [0, -1, 1, 0, 0, sh];
  } else if (mode === 'box') {
    // desktop: a landscape box scaled to the window's width, centred (letterbox bars above and below)
    W = Math.max(sw, 640); H = Math.round(W * 9 / 16); s = sw / W;
    m = [s, 0, 0, s, 0, Math.round((sh - H * s) / 2)];
  } else m = [1, 0, 0, 1, 0, 0];
  const ns = `${mode}|${rot}|${sw}|${sh}|${W}|${H}`;
  if (ns === sig) return;
  sig = ns;
  const [a, b, c, d, e, f] = m, det = a * d - b * c;
  VP.W = W; VP.H = H; VP.SW = sw; VP.SH = sh; VP.mode = mode; VP.rot = rot; VP.s = s; VP.on = !!mode; VP.m = m;
  VP.im = [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
  const bs = document.body && document.body.style, rs = root.style;
  root.classList.toggle('vp-on', VP.on); root.classList.toggle('vp-rot', !!rot); root.classList.toggle('vp-box', mode === 'box');
  if (VP.on) {
    prepCSS();
    rs.setProperty('--vw1', `${W / 100}px`); rs.setProperty('--vh1', `${H / 100}px`);
    rs.setProperty('--vmin1', `${Math.min(W, H) / 100}px`); rs.setProperty('--vmax1', `${Math.max(W, H) / 100}px`);
    rs.setProperty('--vp-w', `${W}px`); rs.setProperty('--vp-h', `${H}px`);
    rs.setProperty('--vp-t', `matrix(${m.join(',')})`);
    const sm = SAFE[rot];
    for (const k of ['t', 'r', 'b', 'l']) { if (sm) rs.setProperty(`--safe-${k}`, `env(safe-area-inset-${sm[k]}, 0px)`); else rs.removeProperty(`--safe-${k}`); }
    if (bs) { bs.setProperty('width', `${W}px`, 'important'); bs.setProperty('height', `${H}px`, 'important'); }
  } else {
    for (const k of ['--vw1', '--vh1', '--vmin1', '--vmax1', '--vp-w', '--vp-h', '--vp-t', '--safe-t', '--safe-r', '--safe-b', '--safe-l']) rs.removeProperty(k);
    if (bs) { bs.removeProperty('width'); bs.removeProperty('height'); }
  }
  if (cssDone) applyMedia(VP.on);
  for (const fn of subs) { try { fn(VP); } catch (err) { console.warn(err); } }
}
// listeners registered here run before main.js's own resize handler (this module is evaluated first), so VP is
// already current when the game re-measures
addEventListener('resize', update);
addEventListener('orientationchange', () => { update(); setTimeout(update, 300); });
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => { update(); setTimeout(update, 300); });
coarse.addEventListener?.('change', update);
if (document.body) update(); else addEventListener('DOMContentLoaded', update, { once: true });
// a style sheet that finished loading after the first pass: prepare it once everything is in
addEventListener('load', () => { if (VP.on && !media.length) { cssDone = false; prepCSS(); applyMedia(true); } }, { once: true });
