import { TS, buildTextures, buildSprites, buildWeapons, buildFaces, mulberry32 } from './art.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ======================================================================
// Settings
// ======================================================================
const settings = Object.assign({
  sens: 1,
  assist: isTouch,
  autofire: isTouch,
  stickTurn: false,
  quality: 'auto',
}, store.get('ds.settings', {}));
const saveSettings = () => store.set('ds.settings', settings);

// ======================================================================
// Screen: low-res framebuffer upscaled with pixelated CSS
// ======================================================================
const QUALITY = { high: 300, mid: 240, low: 200 };
let H = 300, HUD_H = 48, VH = 252, W = 480, K = 1;
let autoLevel = 'mid';
const canvas = $('screen');
let ctx, img, buf, zbuf;

function currentHeight() {
  return QUALITY[settings.quality === 'auto' ? autoLevel : settings.quality];
}

function resize() {
  H = currentHeight();
  HUD_H = Math.round(H * 0.16);
  VH = H - HUD_H;
  K = H / 300;
  const aspect = window.innerWidth / window.innerHeight;
  W = Math.max(Math.round(H * 1.2), Math.min(Math.round(H * 2.4), Math.round((H * aspect) / 2) * 2));
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  img = ctx.createImageData(W, VH);
  buf = new Uint32Array(img.data.buffer);
  zbuf = new Float32Array(W);
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * scale)}px`;
  canvas.style.height = `${Math.floor(H * scale)}px`;
  document.documentElement.style.setProperty('--hud-h', `${Math.floor(HUD_H * scale)}px`);
  checkOrientation();
}

// ======================================================================
// Content
// ======================================================================
const WEAPONS = {
  pistol:   { name: 'Πιστόλι',    dmg: 14, rate: 0.32, pellets: 1, spread: 0.012, ammo: Infinity, kind: 'hit', sfx: 'pistol' },
  shotgun:  { name: 'Καραμπίνα',  dmg: 9,  rate: 0.85, pellets: 8, spread: 0.09,  ammo: 40,  kind: 'hit', sfx: 'shotgun' },
  chaingun: { name: 'Πολυβόλο',   dmg: 9,  rate: 0.085, pellets: 1, spread: 0.035, ammo: 300, kind: 'hit', sfx: 'chaingun' },
  plasma:   { name: 'Πλάσμα',     dmg: 24, rate: 0.15, pellets: 1, spread: 0.02,  ammo: 200, kind: 'proj', speed: 16, sprite: 'plasma', sfx: 'plasma' },
  rocket:   { name: 'Εκτοξευτής', dmg: 90, rate: 0.95, pellets: 1, spread: 0,     ammo: 30,  kind: 'proj', speed: 11, sprite: 'rocket', splash: 2.3, sfx: 'rocket' },
};
const EXTRA_WEAPONS = ['shotgun', 'chaingun', 'plasma', 'rocket'];

const ENEMIES = {
  drone:   { hp: 22,  speed: 2.6,  r: 0.25, h: 0.5,  z: 0.32, sprite: 'drone',   attack: 'bolt',   dmg: 6,  cd: 1.6, range: 12, pref: 5, cost: 1, wreck: 'wreck',    score: 10 },
  grunt:   { hp: 48,  speed: 1.7,  r: 0.3,  h: 0.92, z: 0,    sprite: 'grunt',   attack: 'bolt',   dmg: 9,  cd: 1.7, range: 14, pref: 6, cost: 2, wreck: 'wreck',    score: 20 },
  charger: { hp: 70,  speed: 2.1,  r: 0.35, h: 0.75, z: 0,    sprite: 'charger', attack: 'melee',  dmg: 16, cd: 0.9, range: 0.95, pref: 0, cost: 2, wreck: 'wreckRed', score: 25 },
  heavy:   { hp: 170, speed: 1.05, r: 0.45, h: 1.0,  z: 0,    sprite: 'heavy',   attack: 'spread', dmg: 10, cd: 2.3, range: 15, pref: 7, cost: 4, wreck: 'wreck',    score: 50 },
  boss:    { hp: 1500, speed: 0.9, r: 0.7,  h: 1.75, z: 0,    sprite: 'boss',    attack: 'boss',   dmg: 11, cd: 1.2, range: 40, pref: 6, cost: 99, wreck: 'wreckRed', score: 500 },
};

const AUGS = {
  fire:  { name: 'Εμπρηστικά βλήματα', tag: 'ΣΤΟΙΧΕΙΟ', max: 4, desc: (s) => `Κάθε βολή βάζει φωτιά: ${5 * s} ζημιά το δευτερόλεπτο για 3 δευτ.` },
  shock: { name: 'Ηλεκτρικό τόξο',     tag: 'ΣΤΟΙΧΕΙΟ', max: 4, desc: (s) => `${15 + 10 * s}% πιθανότητα ο κεραυνός να περάσει σε 2 κοντινούς εχθρούς.` },
  cryo:  { name: 'Κρυογονικά',         tag: 'ΣΤΟΙΧΕΙΟ', max: 3, desc: (s) => `Οι εχθροί που χτυπάς επιβραδύνονται ${25 + 10 * s}% για 2 δευτ.` },
  dmg:   { name: 'Διατρητικά',         tag: 'ΕΝΙΣΧΥΣΗ', max: 6, desc: () => '+15% ζημιά με όλα τα όπλα.' },
  rate:  { name: 'Υπερθέρμανση',       tag: 'ΕΝΙΣΧΥΣΗ', max: 5, desc: () => '+15% ρυθμός βολής.' },
  crit:  { name: 'Εύστοχη βολή',       tag: 'ΕΝΙΣΧΥΣΗ', max: 5, desc: (s) => `${5 + 10 * s}% πιθανότητα για διπλή ζημιά.` },
  vamp:  { name: 'Απορρόφηση',         tag: 'ΕΠΙΒΙΩΣΗ', max: 4, desc: (s) => `+${3 * s} υγεία για κάθε εξουδετέρωση.` },
  hp:    { name: 'Ενισχυμένο πλαίσιο', tag: 'ΕΠΙΒΙΩΣΗ', max: 5, desc: () => '+25 μέγιστη υγεία και επισκευή 25.' },
  armor: { name: 'Θωράκιση',           tag: 'ΕΠΙΒΙΩΣΗ', max: 99, desc: () => '+50 θωράκιση. Απορροφά το 1/3 της ζημιάς.' },
  boom:  { name: 'Αστάθεια πυρήνα',    tag: 'ΕΝΙΣΧΥΣΗ', max: 3, desc: (s) => `Οι εχθροί εκρήγνυνται όταν πέφτουν: ${25 * s} ζημιά γύρω τους.` },
  dash:  { name: 'Προωθητήρες',        tag: 'ΚΙΝΗΣΗ',   max: 3, desc: () => 'Η ορμή επαναφορτίζει 25% γρηγορότερα.' },
  speed: { name: 'Σερβοκινητήρες',     tag: 'ΚΙΝΗΣΗ',   max: 3, desc: () => '+10% ταχύτητα κίνησης.' },
};

const ROOMS_PER_SECTOR = 6; // the last one is the boss
const LM = 4; // lightmap cells per tile

// ======================================================================
// Assets
// ======================================================================
const SPR = buildSprites();
const WART = buildWeapons(Object.keys(WEAPONS));
const FACES = buildFaces();
let TEX = buildTextures(0);

// ======================================================================
// State
// ======================================================================
let mode = 'menu'; // menu | play | cards | transition | pause | dead
let attract = true;
let run, P, level;
let enemies = [], projectiles = [], pickups = [], decor = [], effects = [], bolts = [];
let pendingWaves = [];
let roomCleared = false;
let flashLight = 0, hurtTint = 0, pickupTint = 0, shake = 0, hurtDir = null;
let rng = Math.random;
let best = store.get('ds.best', { depth: 0, kills: 0 });

function newRun() {
  run = { sector: 1, room: 1, depth: 0, kills: 0, time: 0, score: 0, aug: {}, maxHp: 100 };
  P = {
    x: 0, y: 0, a: -Math.PI / 2, hp: 100, armor: 0,
    weapons: [{ id: 'pistol', lvl: 1, ammo: Infinity }], cur: 0,
    fireCd: 0, dashT: 0, dashCd: 0, dashX: 0, dashY: 0, inv: 0, turnT: 0,
    bob: 0, recoil: 0, muzzle: 0, ouch: 0, look: 0, lookT: 0,
  };
  TEX = buildTextures(0);
  enterRoom();
}

const aug = (id) => run.aug[id] || 0;
const dmgMul = () => 1 + 0.15 * aug('dmg');
const rateMul = () => 1 + 0.15 * aug('rate');
const critChance = () => (aug('crit') ? 0.05 + 0.1 * aug('crit') : 0.03);
const isBossRoom = () => run.room === ROOMS_PER_SECTOR;

// ======================================================================
// Level generation
// ======================================================================
function genRoom() {
  const boss = isBossRoom();
  const w = boss ? 19 : 13 + (rng() * 7 | 0);
  const h = boss ? 19 : 12 + (rng() * 6 | 0);
  const map = new Uint8Array(w * h);
  const cx = w >> 1;
  const at = (x, y) => y * w + x;

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (!edge) continue;
      const seg = ((x >> 2) + (y >> 2)) % 5;
      map[at(x, y)] = seg === 0 ? 2 : seg === 3 ? 6 : 1;
    }

  if (!boss)
    for (let i = 0; i < 3; i++) {
      if (rng() < 0.45) continue;
      const cw = 2 + (rng() * 3 | 0), ch = 2 + (rng() * 4 | 0);
      const left = rng() < 0.5;
      const x0 = left ? 1 : w - 1 - cw;
      if (left ? x0 + cw > cx - 3 : x0 < cx + 3) continue;
      const y0 = 2 + (rng() * (h - ch - 4) | 0);
      for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) map[at(x, y)] = 2;
    }

  const start = { x: cx + 0.5, y: h - 2 + 0.5 };
  const exit = { x: cx, y: 0 };
  map[at(cx, h - 1)] = 5;
  map[at(exit.x, exit.y)] = 4;

  const reachable = () => {
    const seen = new Uint8Array(w * h);
    const q = [at(start.x | 0, start.y | 0)];
    seen[q[0]] = 1;
    let found = false;
    while (q.length) {
      const i = q.pop();
      const x = i % w, y = (i / w) | 0;
      if (x === exit.x && y === exit.y + 1) found = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = at(x + dx, y + dy);
        if (!seen[j] && map[j] === 0) { seen[j] = 1; q.push(j); }
      }
    }
    return found;
  };

  const blocks = boss ? 5 : 5 + (rng() * 5 | 0);
  for (let i = 0; i < blocks; i++) {
    const bw = 1 + (rng() * 2 | 0), bh = 1 + (rng() * 2 | 0);
    const x0 = 2 + (rng() * (w - bw - 4) | 0), y0 = 3 + (rng() * (h - bh - 6) | 0);
    if (Math.abs(x0 - cx) < 2 && (y0 < 4 || y0 > h - 6)) continue;
    const tile = rng() < 0.6 ? 3 : (rng() < 0.5 ? 6 : 1);
    const saved = [];
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) { saved.push([at(x, y), map[at(x, y)]]); map[at(x, y)] = tile; }
    if (!saved.every(([, v]) => v === 0) || !reachable()) for (const [j, v] of saved) map[j] = v;
  }

  // Ceiling lamps on a loose grid, skipping tiles above cover.
  const lamps = [];
  const lampTile = new Uint8Array(w * h);
  const ox = 1 + (rng() * 3 | 0), oy = 1 + (rng() * 3 | 0);
  for (let y = oy; y < h - 1; y += 4)
    for (let x = ox; x < w - 1; x += 4) {
      if (map[at(x, y)] !== 0 || rng() < 0.2) continue;
      lampTile[at(x, y)] = 1;
      lamps.push({ x: x + 0.5, y: y + 0.5, i: 0.95 + rng() * 0.25, r: 5.5 });
    }
  lamps.push({ x: exit.x + 0.5, y: 1.2, i: 0.35, r: 3 });

  const lvl = { w, h, map, start, exit, open: false, flow: new Int16Array(w * h), flowFrom: -1, lamps, lampTile };
  bakeLight(lvl);
  return lvl;
}

// Static lightmap with soft occlusion; dynamic lights are added per frame.
function bakeLight(lvl) {
  const lw = lvl.w * LM, lh = lvl.h * LM;
  const light = new Float32Array(lw * lh);
  const prev = level;
  level = lvl; // rayWall reads the current level
  for (let j = 0; j < lh; j++)
    for (let i = 0; i < lw; i++) {
      const x = (i + 0.5) / LM, y = (j + 0.5) / LM;
      let L = 0.13;
      for (const l of lvl.lamps) {
        const dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy);
        if (d >= l.r) continue;
        let a = Math.pow(1 - d / l.r, 1.5) * l.i;
        if (d > 0.3 && rayWall(l.x, l.y, dx / d, dy / d, d) < d - 0.15) a *= 0.18;
        L += a;
      }
      light[j * lw + i] = L;
    }
  level = prev;
  lvl.lw = lw; lvl.lh = lh; lvl.light = light; lvl.dyn = new Float32Array(light.length);
}

function enterRoom() {
  rng = mulberry32((Date.now() ^ (run.depth * 7919)) >>> 0);
  level = genRoom();
  enemies = []; projectiles = []; pickups = []; decor = []; effects = []; bolts = [];
  roomCleared = false;
  P.x = level.start.x; P.y = level.start.y; P.a = -Math.PI / 2;
  P.dashT = 0; P.inv = 1.0;

  const depth = run.depth + (run.sector - 1) * 2;
  if (isBossRoom()) {
    pendingWaves = [{ list: ['boss'] }];
  } else {
    const types = ['drone', 'grunt'];
    if (depth >= 2) types.push('charger');
    if (depth >= 4) types.push('heavy');
    let budget = 5 + depth * 2.2;
    const list = [];
    while (budget > 0) {
      const t = types[rng() * types.length | 0];
      list.push(t);
      budget -= ENEMIES[t].cost;
    }
    const cut = Math.ceil(list.length * 0.55);
    pendingWaves = [{ list: list.slice(0, cut) }, { list: list.slice(cut) }];
  }
  spawnWave();
  const label = isBossRoom() ? 'Φύλακας του τομέα' : `Δωμάτιο ${run.room}/${ROOMS_PER_SECTOR}`;
  toast(`Τομέας ${run.sector} · ${TEX.theme.name} — ${label}`);
  updateFlow(true);
}

function freeTileFarFromPlayer(minDist) {
  for (let tries = 0; tries < 400; tries++) {
    const x = 1 + (rng() * (level.w - 2) | 0), y = 1 + (rng() * (level.h - 2) | 0);
    if (level.map[y * level.w + x] !== 0) continue;
    if (Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y) < minDist) continue;
    return { x: x + 0.5, y: y + 0.5 };
  }
  return { x: level.w / 2, y: 2.5 };
}

function makeEnemy(type, pos, spawnT, hpMul = 1) {
  const d = ENEMIES[type];
  return {
    type, d, x: pos.x, y: pos.y, hp: d.hp * hpMul, maxHp: d.hp * hpMul,
    cd: 1 + rng() * 1.5, spawnT, anim: rng() * 10, shootT: 0, hurt: 0,
    burnT: 0, burnDps: 0, slowT: 0, slow: 0, los: false, losT: 0, strafe: rng() < 0.5 ? 1 : -1,
    phase: 0, spawnedAdds: false,
  };
}

function spawnWave() {
  const wave = pendingWaves.shift();
  if (!wave) return;
  const hpMul = 1 + run.depth * 0.1 + (run.sector - 1) * 0.35;
  wave.list.forEach((type, i) => {
    const pos = type === 'boss' ? { x: level.w / 2, y: 4.5 } : freeTileFarFromPlayer(5);
    const e = makeEnemy(type, pos, 0.6 + i * 0.12, hpMul);
    enemies.push(e);
    effects.push({ kind: 'beam', x: e.x, y: e.y, t: 0, dur: 0.7 });
  });
  sfx.teleport();
}

// ======================================================================
// Map queries
// ======================================================================
function tileAt(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return 1;
  return level.map[ty * level.w + tx];
}

function blockedAt(x, y, r) {
  return tileAt(x - r, y - r) || tileAt(x + r, y - r) || tileAt(x - r, y + r) || tileAt(x + r, y + r);
}

function moveCircle(o, dx, dy, r, isPlayer) {
  const bx = blockedAt(o.x + dx, o.y, r);
  if (!bx) o.x += dx; else if (isPlayer && bx === 4 && level.open) return nextRoom();
  const by = blockedAt(o.x, o.y + dy, r);
  if (!by) o.y += dy; else if (isPlayer && by === 4 && level.open) return nextRoom();
  return false;
}

function rayWall(x, y, dx, dy, maxD = 64) {
  let mx = Math.floor(x), my = Math.floor(y);
  const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy);
  const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
  let sdx = dx < 0 ? (x - mx) * ddx : (mx + 1 - x) * ddx;
  let sdy = dy < 0 ? (y - my) * ddy : (my + 1 - y) * ddy;
  for (let i = 0; i < 128; i++) {
    let d;
    if (sdx < sdy) { d = sdx; sdx += ddx; mx += sx; } else { d = sdy; sdy += ddy; my += sy; }
    if (d > maxD) return maxD;
    if (mx < 0 || my < 0 || mx >= level.w || my >= level.h || level.map[my * level.w + mx]) return d;
  }
  return maxD;
}

function hasLOS(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  return rayWall(x0, y0, dx / d, dy / d, d + 1) >= d - 0.05;
}

function lightAt(x, y) {
  const i = Math.floor(x * LM), j = Math.floor(y * LM);
  if (i < 0 || j < 0 || i >= level.lw || j >= level.lh) return 0.13;
  return level.dyn[j * level.lw + i];
}

function updateFlow(force = false) {
  const { w, h, map, flow } = level;
  const pi = Math.floor(P.y) * w + Math.floor(P.x);
  if (!force && pi === level.flowFrom) return;
  level.flowFrom = pi;
  flow.fill(-1);
  flow[pi] = 0;
  const q = [pi];
  for (let head = 0; head < q.length; head++) {
    const i = q[head], x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (flow[j] !== -1 || map[j] !== 0) continue;
      flow[j] = flow[i] + 1;
      q.push(j);
    }
  }
}

// ======================================================================
// Input
// ======================================================================
const keys = new Set();
let mouseDX = 0, mouseDown = false, wantDash = false;
const touch = { mx: 0, my: 0, look: 0, fire: false, stickId: null, lookId: null, fireId: null, lastX: 0, sx: 0, sy: 0 };

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  const settingsOpen = !$('settings').hidden;
  if (mode === 'play') {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') { wantDash = true; e.preventDefault(); }
    if (/^Digit[1-9]$/.test(e.code)) selectWeapon(+e.code.slice(5) - 1);
    if (e.code === 'KeyQ') cycleWeapon(1);
    if (e.code === 'KeyE') quickTurn();
    if (e.code === 'Tab') e.preventDefault();
  } else if (mode === 'cards' && /^Digit[123]$/.test(e.code)) {
    pickCard(+e.code.slice(5) - 1);
  } else if ((mode === 'menu' || mode === 'dead') && e.code === 'Enter' && !settingsOpen) {
    startRun();
  } else if (mode === 'pause' && e.code === 'Enter' && !settingsOpen) {
    resume();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });

canvas.addEventListener('mousedown', (e) => {
  if (mode !== 'play' || isTouch) return;
  if (document.pointerLockElement !== canvas) { lockPointer(); return; }
  if (e.button === 0) mouseDown = true;
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) mouseDX += e.movementX;
});
window.addEventListener('wheel', (e) => { if (mode === 'play') cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });

function lockPointer() {
  if (isTouch) return;
  try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => {}); } catch { /* ignore */ }
}
let expectUnlock = false;
function releasePointer() {
  if (document.pointerLockElement === canvas) { expectUnlock = true; document.exitPointerLock?.(); }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) return;
  if (expectUnlock) { expectUnlock = false; return; }
  if (!isTouch && mode === 'play') pause();
});

// ---- Touch ----
// Left 40%: floating move stick. Anywhere else: drag to turn.
// The fire button also turns while you drag on it, so one thumb can aim and shoot.
function lookRadiansPerPixel() {
  return (Math.PI * 1.15 * settings.sens) / Math.max(320, window.innerWidth);
}

function setupTouch() {
  if (!isTouch) return;
  document.body.classList.add('touch');
  const stick = $('stick'), knob = $('knob');
  const area = $('touch-area');
  const R = 46;
  area.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.4 && touch.stickId === null) {
        touch.stickId = t.identifier;
        touch.sx = t.clientX; touch.sy = t.clientY;
        stick.style.left = `${t.clientX - 60}px`; stick.style.top = `${t.clientY - 60}px`;
        stick.hidden = false;
      } else if (touch.lookId === null) {
        touch.lookId = t.identifier; touch.lastX = t.clientX;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const move = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) {
        let dx = t.clientX - touch.sx, dy = t.clientY - touch.sy;
        const d = Math.hypot(dx, dy);
        // The stick follows the thumb when it drifts past the edge.
        if (d > R) {
          touch.sx += (dx / d) * (d - R); touch.sy += (dy / d) * (d - R);
          dx = (dx / d) * R; dy = (dy / d) * R;
          stick.style.left = `${touch.sx - 60}px`; stick.style.top = `${touch.sy - 60}px`;
        }
        // Small dead zone, then a gentle curve for fine control.
        const mag = Math.min(1, Math.hypot(dx, dy) / R);
        const curved = mag < 0.12 ? 0 : Math.pow((mag - 0.12) / 0.88, 1.3);
        const ang = Math.atan2(dy, dx);
        touch.mx = Math.cos(ang) * curved; touch.my = Math.sin(ang) * curved;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (t.identifier === touch.lookId || t.identifier === touch.fireId) {
        touch.look += t.clientX - touch.lastX;
        touch.lastX = t.clientX;
      }
    }
    e.preventDefault();
  };
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) {
        touch.stickId = null; touch.mx = touch.my = 0;
        knob.style.transform = ''; stick.hidden = true;
      } else if (t.identifier === touch.lookId) touch.lookId = null;
      if (t.identifier === touch.fireId) { touch.fireId = null; touch.fire = false; }
    }
  };
  for (const el of [area, $('t-fire')]) {
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }
  $('t-fire').addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touch.fireId = t.identifier; touch.fire = true; touch.lastX = t.clientX;
    touch.lookId = null;
    e.preventDefault(); e.stopPropagation();
  }, { passive: false });
  const tap = (el, fn) => el.addEventListener('touchstart', (e) => { fn(); e.preventDefault(); e.stopPropagation(); }, { passive: false });
  tap($('t-dash'), () => { wantDash = true; });
  tap($('t-swap'), () => cycleWeapon(1));
  tap($('t-turn'), quickTurn);
  tap($('t-pause'), pause);
}

// ---- Orientation (touch devices play in landscape) ----
function checkOrientation() {
  const portrait = isTouch && window.innerHeight > window.innerWidth;
  $('rotate').hidden = !portrait;
  if (portrait && mode === 'play') pause();
}

async function goFullscreenLandscape() {
  if (!isTouch) return;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  } catch { /* not allowed */ }
  try { await screen.orientation?.lock?.('landscape'); } catch { /* iOS and some browsers */ }
}

// ======================================================================
// Player
// ======================================================================
function selectWeapon(i) {
  if (i >= 0 && i < P.weapons.length && i !== P.cur) { P.cur = i; P.fireCd = Math.max(P.fireCd, 0.2); sfx.swap(); }
}
function cycleWeapon(dir) {
  selectWeapon((P.cur + dir + P.weapons.length) % P.weapons.length);
}
function quickTurn() {
  if (mode === 'play' && P.turnT <= 0) { P.turnT = 0.2; sfx.swap(); }
}

// Visible enemy closest to the crosshair: { e, diff, dist, half } or null.
function aimTarget(maxAngle) {
  let best = null;
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0 || !e.los) continue;
    const dx = e.x - P.x, dy = e.y - P.y, dist = Math.hypot(dx, dy);
    if (dist > 18) continue;
    let diff = Math.atan2(dy, dx) - P.a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const half = Math.atan2(e.d.r, dist);
    const score = Math.abs(diff) - half;
    if (score > maxAngle) continue;
    if (!best || score < best.score) best = { e, diff, dist, half, score };
  }
  return best;
}

function updatePlayer(dt) {
  // ---- Turning ----
  const target = settings.assist ? aimTarget(0.16) : null;
  // Aim friction: slow the look down while the crosshair crosses a target.
  const friction = target && Math.abs(target.diff) < target.half * 2.2 ? 0.55 : 1;
  P.a += mouseDX * 0.0026 * settings.sens;
  P.a += touch.look * lookRadiansPerPixel() * friction;
  mouseDX = 0; touch.look = 0;
  if (keys.has('ArrowLeft')) P.a -= 2.8 * dt;
  if (keys.has('ArrowRight')) P.a += 2.8 * dt;
  if (settings.stickTurn && isTouch) P.a += touch.mx * 3.0 * dt;
  if (P.turnT > 0) {
    const step = Math.min(P.turnT, dt);
    P.a += (Math.PI * step) / 0.2;
    P.turnT -= step;
  }
  // Aim magnetism on touch: gently pull toward a close target.
  if (target && isTouch && P.turnT <= 0) {
    const pull = Math.min(Math.abs(target.diff), 2.4 * dt * (1 - Math.min(1, Math.abs(target.diff) / 0.16) * 0.5));
    P.a += Math.sign(target.diff) * pull;
  }

  // ---- Movement ----
  const dirX = Math.cos(P.a), dirY = Math.sin(P.a);
  let fwd = 0, side = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
  if (keys.has('KeyD')) side += 1;
  if (keys.has('KeyA')) side -= 1;
  fwd -= touch.my;
  if (!(settings.stickTurn && isTouch)) side += touch.mx;
  let mx = dirX * fwd - dirY * side, my = dirY * fwd + dirX * side;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }

  const speed = 4.3 * (1 + 0.1 * aug('speed'));
  P.dashCd = Math.max(0, P.dashCd - dt);
  if (wantDash && P.dashCd <= 0) {
    const l = Math.hypot(mx, my);
    P.dashX = l > 0.1 ? mx / l : dirX; P.dashY = l > 0.1 ? my / l : dirY;
    P.dashT = 0.16; P.dashCd = 1.8 * Math.pow(0.75, aug('dash')); P.inv = Math.max(P.inv, 0.25);
    sfx.dash();
  }
  wantDash = false;

  let vx = mx * speed, vy = my * speed;
  if (P.dashT > 0) { P.dashT -= dt; vx = P.dashX * 17; vy = P.dashY * 17; }
  for (let i = 0; i < 3; i++) if (moveCircle(P, (vx * dt) / 3, (vy * dt) / 3, 0.24, true)) return;

  const moving = Math.hypot(vx, vy) > 0.5;
  P.bob += dt * (moving ? 10 : 2);
  P.inv = Math.max(0, P.inv - dt);
  P.recoil = Math.max(0, P.recoil - dt * 60);
  P.muzzle = Math.max(0, P.muzzle - dt);
  P.ouch = Math.max(0, P.ouch - dt);
  P.lookT -= dt;
  if (P.lookT <= 0) { P.look = [-1, 0, 0, 1][Math.random() * 4 | 0]; P.lookT = 0.8 + Math.random() * 1.5; }

  // ---- Shooting ----
  P.fireCd -= dt;
  let trigger = mouseDown || touch.fire || keys.has('ControlLeft') || keys.has('KeyF');
  if (!trigger && settings.autofire && isTouch) {
    const t = aimTarget(0);
    if (t && Math.abs(t.diff) < t.half * 1.1) trigger = true;
  }
  if (trigger && P.fireCd <= 0) fire();

  // ---- Pickups ----
  for (const p of pickups) {
    if (p.taken || Math.hypot(p.x - P.x, p.y - P.y) > 0.6) continue;
    if (p.kind === 'health' && P.hp < run.maxHp) { P.hp = Math.min(run.maxHp, P.hp + 15); p.taken = true; }
    if (p.kind === 'armor') { P.armor = Math.min(200, P.armor + 15); p.taken = true; }
    if (p.kind === 'ammo') {
      let got = false;
      for (const w of P.weapons) {
        const max = WEAPONS[w.id].ammo;
        if (max !== Infinity && w.ammo < max) { w.ammo = Math.min(max, w.ammo + Math.ceil(max * 0.3)); got = true; }
      }
      p.taken = got;
    }
    if (p.taken) { pickupTint = 0.25; sfx.pickup(); }
  }
  pickups = pickups.filter((p) => !p.taken);
}

function fire() {
  const w = P.weapons[P.cur];
  const def = WEAPONS[w.id];
  if (w.ammo <= 0) { selectWeapon(0); return; }
  if (w.ammo !== Infinity) w.ammo--;
  P.fireCd = def.rate / rateMul();
  P.muzzle = 0.07;
  P.recoil = w.id === 'shotgun' || w.id === 'rocket' ? 10 : 5;
  flashLight = 0.9;
  sfx[def.sfx]();
  const dmg = def.dmg * (1 + 0.25 * (w.lvl - 1)) * dmgMul();
  for (let i = 0; i < def.pellets; i++) {
    const ang = P.a + (Math.random() - 0.5) * 2 * def.spread;
    if (def.kind === 'hit') hitscan(ang, dmg);
    else {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      projectiles.push({
        x: P.x + dx * 0.3, y: P.y + dy * 0.3, vx: dx * def.speed, vy: dy * def.speed,
        dmg, owner: 'player', sprite: def.sprite, splash: def.splash || 0, life: 3, z: 0.38, h: 0.2,
        light: def.sprite === 'plasma' ? 0.5 : 0.6,
      });
    }
  }
  for (const e of enemies) e.losT = Math.min(e.losT, 0.05);
}

function hitscan(ang, dmg) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const wallD = rayWall(P.x, P.y, dx, dy);
  let best = null, bestT = wallD;
  for (const e of enemies) {
    if (e.spawnT > 0) continue;
    const ex = e.x - P.x, ey = e.y - P.y;
    const t = ex * dx + ey * dy;
    if (t <= 0 || t >= bestT) continue;
    const perp = Math.abs(ex * dy - ey * dx);
    if (perp < e.d.r + 0.06) { best = e; bestT = t; }
  }
  const hx = P.x + dx * (bestT - 0.05), hy = P.y + dy * (bestT - 0.05);
  effects.push({ kind: 'spark', x: hx, y: hy, z: best ? best.d.z + best.d.h * 0.5 : 0.45, t: 0, dur: 0.12 });
  if (best) damageEnemy(best, dmg, true);
}

function damagePlayer(amount, fromX, fromY) {
  if (P.inv > 0 || mode !== 'play') return;
  if (P.armor > 0) {
    const absorbed = Math.min(P.armor, Math.round(amount / 3));
    P.armor -= absorbed;
    amount -= absorbed;
  }
  P.hp -= amount;
  P.ouch = 0.5;
  hurtTint = Math.min(0.55, hurtTint + amount / 40);
  shake = Math.min(6, shake + amount / 4);
  if (fromX !== undefined) hurtDir = { a: Math.atan2(fromY - P.y, fromX - P.x), t: 0.9 };
  sfx.hurt();
  if (P.hp <= 0) { P.hp = 0; die(); }
}

// ======================================================================
// Enemies
// ======================================================================
function damageEnemy(e, dmg, primary) {
  if (e.dead || e.spawnT > 0) return;
  if (primary && Math.random() < critChance()) dmg *= 2;
  e.hp -= dmg;
  e.hurt = 0.09;
  if (primary) {
    if (aug('fire')) { e.burnT = 3; e.burnDps = 5 * aug('fire'); }
    if (aug('cryo')) { e.slowT = 2; e.slow = 0.25 + 0.1 * aug('cryo'); }
    if (aug('shock') && Math.random() < 0.15 + 0.1 * aug('shock')) {
      const near = enemies
        .filter((o) => o !== e && !o.dead && o.spawnT <= 0 && Math.hypot(o.x - e.x, o.y - e.y) < 5)
        .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
        .slice(0, 2);
      let from = e;
      for (const o of near) {
        bolts.push({ ax: from.x, ay: from.y, az: from.d.z + from.d.h * 0.5, bx: o.x, by: o.y, bz: o.d.z + o.d.h * 0.5, t: 0.15 });
        damageEnemy(o, dmg * 0.6, false);
        from = o;
      }
      if (near.length) sfx.zap();
    }
  }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  run.kills++;
  run.score += e.d.score;
  sfx.death(e.type === 'boss');
  decor.push({ x: e.x, y: e.y, img: SPR[e.d.wreck], h: e.type === 'boss' ? 0.55 : 0.28, z: 0 });
  effects.push({ kind: 'explosion', x: e.x, y: e.y, z: e.d.z + e.d.h * 0.3, t: 0, dur: 0.4, size: e.type === 'boss' ? 2.2 : 0.9 });
  if (aug('vamp')) P.hp = Math.min(run.maxHp, P.hp + 3 * aug('vamp'));
  if (aug('boom')) explode(e.x, e.y, 2, 25 * aug('boom'), true, e);
  const r = Math.random();
  if (e.type === 'boss') {
    pickups.push({ kind: 'health', x: e.x, y: e.y }, { kind: 'armor', x: e.x + 0.6, y: e.y }, { kind: 'ammo', x: e.x - 0.6, y: e.y });
  } else if (r < 0.16) pickups.push({ kind: 'health', x: e.x, y: e.y });
  else if (r < 0.38) pickups.push({ kind: 'ammo', x: e.x, y: e.y });
  else if (r < 0.44) pickups.push({ kind: 'armor', x: e.x, y: e.y });
}

function explode(x, y, radius, dmg, fromPlayer, skip) {
  effects.push({ kind: 'explosion', x, y, z: 0.3, t: 0, dur: 0.45, size: radius * 0.8 });
  sfx.explosion();
  shake = Math.min(8, shake + 3);
  for (const e of enemies) {
    if (e === skip || e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < radius) damageEnemy(e, dmg * (1 - (d / radius) * 0.5), false);
  }
  if (!fromPlayer) {
    const d = Math.hypot(P.x - x, P.y - y);
    if (d < radius) damagePlayer(dmg * (1 - d / radius), x, y);
  }
}

function enemyShoot(e, ang, speed = 7) {
  const dmgMulE = 1 + run.depth * 0.04 + (run.sector - 1) * 0.15;
  projectiles.push({
    x: e.x + Math.cos(ang) * (e.d.r + 0.1), y: e.y + Math.sin(ang) * (e.d.r + 0.1),
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, ox: e.x, oy: e.y,
    dmg: e.d.dmg * dmgMulE, owner: 'enemy', sprite: 'bolt', splash: 0, life: 5, z: e.d.z + e.d.h * 0.45, h: 0.24, light: 0.35,
  });
}

function updateEnemies(dt) {
  updateFlow();
  const { w, flow } = level;
  for (const e of enemies) {
    if (e.dead) continue;
    e.anim += dt;
    e.hurt = Math.max(0, e.hurt - dt);
    e.shootT = Math.max(0, e.shootT - dt);
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }

    if (e.burnT > 0) {
      e.burnT -= dt;
      e.hp -= e.burnDps * dt;
      if (Math.random() < dt * 8) effects.push({ kind: 'spark', x: e.x + (Math.random() - 0.5) * 0.3, y: e.y + (Math.random() - 0.5) * 0.3, z: e.d.z + Math.random() * e.d.h, t: 0, dur: 0.2 });
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    e.slowT = Math.max(0, e.slowT - dt);
    const slowMul = e.slowT > 0 ? 1 - e.slow : 1;

    const dx = P.x - e.x, dy = P.y - e.y, dist = Math.hypot(dx, dy);
    e.losT -= dt;
    if (e.losT <= 0) { e.los = hasLOS(e.x, e.y, P.x, P.y); e.losT = 0.2 + Math.random() * 0.1; }

    let mx = 0, my = 0, spd = e.d.speed * slowMul;
    if (e.type === 'charger' && e.los && dist < 7) {
      mx = dx / dist; my = dy / dist; spd *= 2.3;
    } else if (e.los && dist < e.d.pref) {
      mx = (-dy / dist) * e.strafe * 0.6; my = (dx / dist) * e.strafe * 0.6;
      if (Math.random() < dt * 0.5) e.strafe *= -1;
    } else {
      const tx = Math.floor(e.x), ty = Math.floor(e.y);
      let bestV = flow[ty * w + tx], bx = e.x, by = e.y;
      if (bestV < 0) bestV = 9999;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = tx + ox, ny = ty + oy;
        const v = flow[ny * w + nx];
        if (v < 0 || v >= bestV) continue;
        if (ox && oy && (level.map[ty * w + nx] || level.map[ny * w + tx])) continue;
        bestV = v; bx = nx + 0.5; by = ny + 0.5;
      }
      const ddx = bx - e.x, ddy = by - e.y, dl = Math.hypot(ddx, ddy);
      if (dl > 0.01) { mx = ddx / dl; my = ddy / dl; }
    }
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      const sx = e.x - o.x, sy = e.y - o.y, sd = Math.hypot(sx, sy), min = e.d.r + o.d.r;
      if (sd > 0.001 && sd < min) { mx += (sx / sd) * 0.8; my += (sy / sd) * 0.8; }
    }
    moveCircle(e, mx * spd * dt, my * spd * dt, e.d.r * 0.9, false);

    e.cd -= dt * slowMul;
    if (e.cd > 0) continue;
    const ang = Math.atan2(dy, dx);
    if (e.d.attack === 'melee') {
      if (dist < e.d.range) {
        damagePlayer(e.d.dmg * (1 + run.depth * 0.04), e.x, e.y);
        e.cd = e.d.cd; e.shootT = 0.2;
        sfx.melee();
      }
      continue;
    }
    if (!e.los || dist > e.d.range) continue;
    e.shootT = 0.25;
    if (e.d.attack === 'bolt') {
      enemyShoot(e, ang + (Math.random() - 0.5) * 0.08);
      e.cd = e.d.cd * (0.75 + Math.random() * 0.5);
      sfx.enemyShot();
    } else if (e.d.attack === 'spread') {
      for (const off of [-0.18, 0, 0.18]) enemyShoot(e, ang + off, 6.5);
      e.cd = e.d.cd * (0.8 + Math.random() * 0.4);
      sfx.enemyShot();
    } else if (e.d.attack === 'boss') {
      bossAttack(e, ang);
    }
  }
  enemies = enemies.filter((e) => !e.dead);
}

function bossAttack(e, ang) {
  const rage = e.hp < e.maxHp * 0.5;
  e.phase = (e.phase + 1) % 4;
  if (e.phase === 3) {
    const n = rage ? 18 : 12, off = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) enemyShoot(e, off + (i / n) * Math.PI * 2, 5.5);
    e.cd = rage ? 1.1 : 1.6;
  } else {
    for (const o of [-0.12, 0, 0.12]) enemyShoot(e, ang + o, 8.5);
    e.cd = rage ? 0.6 : 0.9;
  }
  sfx.enemyShot();
  if (rage && !e.spawnedAdds) {
    e.spawnedAdds = true;
    pendingWaves.push({ list: ['drone', 'drone', 'drone', 'grunt'] });
    spawnWave();
    toast('Ο φύλακας καλεί ενισχύσεις!');
  }
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.life -= dt;
    for (let i = 0; i < 4 && p.life > 0; i++) {
      p.x += (p.vx * dt) / 4; p.y += (p.vy * dt) / 4;
      if (tileAt(p.x, p.y)) {
        p.life = 0;
        if (p.splash) explode(p.x - p.vx * 0.01, p.y - p.vy * 0.01, p.splash, p.dmg, p.owner === 'player');
        else effects.push({ kind: 'spark', x: p.x - p.vx * 0.01, y: p.y - p.vy * 0.01, z: p.z, t: 0, dur: 0.12 });
        break;
      }
      if (p.owner === 'enemy') {
        if (Math.hypot(p.x - P.x, p.y - P.y) < 0.3) { damagePlayer(p.dmg, p.ox, p.oy); p.life = 0; }
      } else {
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.d.r + 0.12) {
            p.life = 0;
            if (p.splash) explode(p.x, p.y, p.splash, p.dmg, true);
            else damageEnemy(e, p.dmg, true);
            break;
          }
        }
      }
    }
  }
  projectiles = projectiles.filter((p) => p.life > 0);
}

// ======================================================================
// Room flow and upgrade cards
// ======================================================================
function checkRoom() {
  if (roomCleared) return;
  const alive = enemies.length;
  if (pendingWaves.length && alive <= 1) { spawnWave(); return; }
  if (!pendingWaves.length && alive === 0) {
    roomCleared = true;
    run.depth++;
    sfx.clear();
    toast(isBossRoom() ? 'Ο φύλακας έπεσε!' : 'Το δωμάτιο καθάρισε');
    setTimeout(showCards, 900);
  }
}

let currentCards = null;
function showCards() {
  if (mode !== 'play') return;
  currentCards = makeCards();
  mode = 'cards';
  releasePointer();
  mouseDown = false; touch.fire = false;
  const root = $('cards-list');
  root.innerHTML = '';
  currentCards.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = `card tag-${c.kind}`;
    b.innerHTML = `<span class="card-key">${i + 1}</span><span class="card-tag">${c.tag}</span><strong>${c.title}</strong><span class="card-desc">${c.desc}</span>`;
    b.addEventListener('click', () => pickCard(i));
    root.appendChild(b);
  });
  $('cards').hidden = false;
}

function pickCard(i) {
  const c = currentCards?.[i];
  if (!c || mode !== 'cards') return;
  c.apply();
  $('cards').hidden = true;
  currentCards = null;
  mode = 'play';
  level.open = true;
  sfx.door();
  toast('Η έξοδος άνοιξε — προχώρα στην πράσινη πόρτα');
  lockPointer();
}

function pickWeighted(pool, n) {
  const out = [];
  const list = pool.slice();
  while (out.length < n && list.length) {
    const total = list.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total, k = 0;
    while ((r -= list[k].w) > 0) k++;
    out.push(list[k].card);
    list.splice(k, 1);
  }
  return out;
}

function makeCards() {
  const pool = [];
  const owned = P.weapons.map((w) => w.id);
  const missing = EXTRA_WEAPONS.filter((id) => !owned.includes(id));
  if (missing.length) {
    const id = missing[Math.random() * missing.length | 0];
    const replace = P.weapons.length >= 3 ? P.weapons.slice(1).reduce((a, b) => (b.lvl < a.lvl ? b : a)) : null;
    pool.push({
      w: P.weapons.length === 1 ? 6 : 3,
      card: {
        kind: 'weapon', tag: 'ΟΠΛΟ', title: WEAPONS[id].name,
        desc: `${weaponBlurb(id)}${replace ? ` Αντικαθιστά: ${WEAPONS[replace.id].name}.` : ''}`,
        apply: () => {
          const wpn = { id, lvl: 1, ammo: WEAPONS[id].ammo };
          if (replace) P.weapons[P.weapons.indexOf(replace)] = wpn; else P.weapons.push(wpn);
          P.cur = P.weapons.indexOf(wpn);
        },
      },
    });
  }
  const up = P.weapons[Math.random() * P.weapons.length | 0];
  pool.push({
    w: 3,
    card: {
      kind: 'weapon', tag: 'ΟΠΛΟ', title: `${WEAPONS[up.id].name} Επ. ${up.lvl + 1}`,
      desc: '+25% ζημιά για αυτό το όπλο και γεμάτα πυρομαχικά.',
      apply: () => { up.lvl++; up.ammo = WEAPONS[up.id].ammo; },
    },
  });
  for (const [id, a] of Object.entries(AUGS)) {
    const s = aug(id);
    if (s >= a.max) continue;
    pool.push({
      w: id === 'armor' ? 1.5 : 2,
      card: {
        kind: 'aug', tag: a.tag, title: s ? `${a.name} ${'I'.repeat(s + 1)}` : a.name,
        desc: a.desc(s + 1),
        apply: () => {
          run.aug[id] = s + 1;
          if (id === 'hp') { run.maxHp += 25; P.hp = Math.min(run.maxHp, P.hp + 25); }
          if (id === 'armor') P.armor = Math.min(200, P.armor + 50);
        },
      },
    });
  }
  if (P.hp < run.maxHp * 0.65)
    pool.push({
      w: 5,
      card: { kind: 'heal', tag: 'ΕΠΙΣΚΕΥΗ', title: 'Νανο-επισκευή', desc: 'Επαναφέρει 50 υγεία.', apply: () => { P.hp = Math.min(run.maxHp, P.hp + 50); } },
    });
  return pickWeighted(pool, 3);
}

function weaponBlurb(id) {
  return {
    shotgun: 'Οκτώ σκάγια σε κοντινή απόσταση.',
    chaingun: 'Συνεχής βολή, μικρή ζημιά ανά σφαίρα.',
    plasma: 'Γρήγορες βολίδες ενέργειας.',
    rocket: 'Ρουκέτες με έκρηξη σε ακτίνα.',
  }[id];
}

function nextRoom() {
  if (mode !== 'play') return true;
  mode = 'transition';
  sfx.door();
  const fade = $('fade');
  fade.classList.add('on');
  setTimeout(() => {
    if (isBossRoom()) {
      run.sector++;
      run.room = 1;
      P.hp = run.maxHp;
      TEX = buildTextures(run.sector - 1);
    } else run.room++;
    enterRoom();
    mode = 'play';
    fade.classList.remove('on');
  }, 380);
  return true;
}

// ======================================================================
// Modes and menus
// ======================================================================
function startRun() {
  sfx.init();
  goFullscreenLandscape();
  attract = false;
  newRun();
  for (const id of ['menu', 'dead', 'pause', 'cards', 'settings']) $(id).hidden = true;
  mode = 'play';
  lockPointer();
  checkOrientation();
}
function pause() {
  if (mode !== 'play') return;
  mode = 'pause';
  mouseDown = false; touch.fire = false; touch.fireId = null;
  $('pause').hidden = false;
}
function resume() {
  if (isTouch && window.innerHeight > window.innerWidth) return;
  $('pause').hidden = true;
  mode = 'play';
  goFullscreenLandscape();
  lockPointer();
}
function die() {
  mode = 'dead';
  releasePointer();
  const reached = run.depth;
  const isBest = reached > best.depth || (reached === best.depth && run.kills > best.kills);
  if (isBest) { best = { depth: reached, kills: run.kills }; store.set('ds.best', best); }
  const mins = Math.floor(run.time / 60), secs = Math.floor(run.time % 60).toString().padStart(2, '0');
  $('dead-stats').innerHTML = `
    <div><span>Τομέας</span><b>${run.sector}</b></div>
    <div><span>Δωμάτια</span><b>${reached}</b></div>
    <div><span>Εξουδετερώσεις</span><b>${run.kills}</b></div>
    <div><span>Χρόνος</span><b>${mins}:${secs}</b></div>`;
  $('dead-best').textContent = isBest ? 'Νέο ρεκόρ!' : `Ρεκόρ: ${best.depth} δωμάτια, ${best.kills} εξουδετερώσεις`;
  setTimeout(() => { $('dead').hidden = false; }, 700);
  sfx.playerDeath();
}

// ---- Settings panel ----
let settingsReturn = null;
function openSettings(from) {
  settingsReturn = from;
  $(from).hidden = true;
  $('set-sens').value = settings.sens;
  $('set-sens-val').textContent = settings.sens.toFixed(1);
  $('set-assist').checked = settings.assist;
  $('set-auto').checked = settings.autofire;
  $('set-stickturn').checked = settings.stickTurn;
  $('set-quality').value = settings.quality;
  $('settings').hidden = false;
}
function closeSettings() {
  $('settings').hidden = true;
  if (settingsReturn) $(settingsReturn).hidden = false;
}
$('set-sens').addEventListener('input', (e) => {
  settings.sens = +e.target.value;
  $('set-sens-val').textContent = settings.sens.toFixed(1);
  saveSettings();
});
$('set-assist').addEventListener('change', (e) => { settings.assist = e.target.checked; saveSettings(); });
$('set-auto').addEventListener('change', (e) => { settings.autofire = e.target.checked; saveSettings(); });
$('set-stickturn').addEventListener('change', (e) => { settings.stickTurn = e.target.checked; saveSettings(); });
$('set-quality').addEventListener('change', (e) => { settings.quality = e.target.value; saveSettings(); resize(); });
$('settings-close').addEventListener('click', closeSettings);
$('menu-settings').addEventListener('click', () => openSettings('menu'));
$('pause-settings').addEventListener('click', () => openSettings('pause'));
if (!isTouch) for (const el of document.querySelectorAll('.touch-setting')) el.hidden = true;

$('start').addEventListener('click', startRun);
$('again').addEventListener('click', startRun);
$('resume').addEventListener('click', resume);
if (best.depth) $('menu-best').textContent = `Ρεκόρ: ${best.depth} δωμάτια · ${best.kills} εξουδετερώσεις`;
$('menu-controls').textContent = isTouch
  ? 'Αριστερά: κίνηση · Σύρε οπουδήποτε δεξιά για να στρίψεις · Το κουμπί βολής στρίβει κι αυτό όταν το σέρνεις · ⟲ γύρισμα 180°'
  : 'WASD κίνηση · Ποντίκι σκόπευση · Κλικ βολή · Shift/Space ορμή · E γύρισμα 180° · 1–3 / Q όπλα · Esc παύση';

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ======================================================================
// Rendering
// ======================================================================
const plane = () => 0.66 * (W / VH) / (320 / 168);

function updateDynamicLight() {
  const { light, dyn, lw, lh } = level;
  dyn.set(light);
  const add = (x, y, I, r) => {
    const i0 = Math.max(0, Math.floor((x - r) * LM)), i1 = Math.min(lw - 1, Math.ceil((x + r) * LM));
    const j0 = Math.max(0, Math.floor((y - r) * LM)), j1 = Math.min(lh - 1, Math.ceil((y + r) * LM));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot((i + 0.5) / LM - x, (j + 0.5) / LM - y);
        if (d < r) dyn[j * lw + i] += I * (1 - d / r) * (1 - d / r);
      }
  };
  if (flashLight > 0.05) add(P.x + Math.cos(P.a) * 0.6, P.y + Math.sin(P.a) * 0.6, flashLight * 0.8, 4.5);
  for (const p of projectiles) add(p.x, p.y, p.light, 2.2);
  for (const fx of effects) {
    if (fx.kind === 'explosion') add(fx.x, fx.y, 1.6 * (1 - fx.t / fx.dur), fx.size * 3 + 1);
    else if (fx.kind === 'beam') add(fx.x, fx.y, 0.8 * (1 - fx.t / fx.dur), 2.5);
  }
  if (level.open) add(level.exit.x + 0.5, 1.1, 0.5 + Math.sin(run.time * 4) * 0.15, 3);
}

function render() {
  updateDynamicLight();
  const t = TEX;
  const [fr, fg, fb] = t.theme.fog;
  const dirX = Math.cos(P.a), dirY = Math.sin(P.a);
  const pl = plane();
  const planeX = -dirY * pl, planeY = dirX * pl;
  const half = VH / 2;
  const { dyn, lw, lampTile, map, w: mw, h: mh } = level;
  const TM = TS - 1;

  // ---- Floor and ceiling ----
  const floor = t.floor.data, ceil = t.ceil.data, ceilL = t.ceilLamp.data;
  const rx0 = dirX - planeX, ry0 = dirY - planeY, rx1 = dirX + planeX, ry1 = dirY + planeY;
  for (let y = Math.floor(half) + 1; y < VH; y++) {
    const rowDist = half / (y - half);
    const att = 1 - Math.min(0.7, rowDist * 0.04);
    const stepX = (rowDist * (rx1 - rx0)) / W, stepY = (rowDist * (ry1 - ry0)) / W;
    let fx = P.x + rowDist * rx0, fy = P.y + rowDist * ry0;
    const rowF = y * W, rowC = (VH - 1 - y) * W;
    const attI = att * 256;
    for (let x = 0; x < W; x++) {
      // Positions inside the room are positive, so |0 is a fast floor.
      const cx = fx | 0, cy = fy | 0;
      const ti = ((((fy - cy) * TS) & TM) << 7) | (((fx - cx) * TS) & TM);
      let fi = ((dyn[((fy * LM) | 0) * lw + ((fx * LM) | 0)] || 0.1) * attI) | 0;
      if (fi > 256) fi = 256;
      const ii = 256 - fi, fR = fr * ii, fG = fg * ii, fB = fb * ii;
      fx += stepX; fy += stepY;
      let c = floor[ti];
      buf[rowF + x] = 0xff000000 | (((((c >> 16) & 255) * fi + fB) >> 8) << 16) | (((((c >> 8) & 255) * fi + fG) >> 8) << 8) | (((c & 255) * fi + fR) >> 8);
      c = (cx < mw && cy < mh && lampTile[cy * mw + cx]) ? ceilL[ti] : ceil[ti];
      if ((c >>> 24) === 254) buf[rowC + x] = c | 0xff000000;
      else buf[rowC + x] = 0xff000000 | (((((c >> 16) & 255) * fi + fB) >> 8) << 16) | (((((c >> 8) & 255) * fi + fG) >> 8) << 8) | (((c & 255) * fi + fR) >> 8);
    }
  }

  // ---- Walls ----
  for (let x = 0; x < W; x++) {
    const cam = (2 * x) / W - 1;
    const rdx = dirX + planeX * cam, rdy = dirY + planeY * cam;
    let mx = Math.floor(P.x), my = Math.floor(P.y);
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
    let sdx = rdx < 0 ? (P.x - mx) * ddx : (mx + 1 - P.x) * ddx;
    let sdy = rdy < 0 ? (P.y - my) * ddy : (my + 1 - P.y) * ddy;
    let side = 0, tile = 0;
    for (let i = 0; i < 96; i++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
      if (mx < 0 || my < 0 || mx >= mw || my >= mh) { tile = 1; break; }
      tile = map[my * mw + mx];
      if (tile) break;
    }
    const perp = side === 0 ? sdx - ddx : sdy - ddy;
    zbuf[x] = perp;
    let wallX = side === 0 ? P.y + perp * rdy : P.x + perp * rdx;
    wallX -= Math.floor(wallX);
    let texX = (wallX * TS) | 0;
    if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = TM - texX;
    const tex = tile === 4 && level.open ? t.doorOpen : t.walls[tile] || t.walls[1];
    const data = tex.data;
    // Light sampled just in front of the wall face.
    const back = 0.04 / Math.hypot(rdx, rdy);
    const lx = P.x + rdx * (perp - back), ly = P.y + rdy * (perp - back);
    const li = Math.floor(ly * LM) * lw + Math.floor(lx * LM);
    let fi = ((dyn[li] || 0.1) * (1 - Math.min(0.7, perp * 0.04)) * (side ? 0.82 : 1) * 256) | 0;
    if (fi > 256) fi = 256;
    const ii = 256 - fi, fR = fr * ii, fG = fg * ii, fB = fb * ii;
    const lineH = VH / perp;
    const top = half - lineH / 2;
    const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(VH, Math.ceil(top + lineH));
    const step = TS / lineH;
    let texPos = (y0 - top) * step;
    for (let y = y0, o = y0 * W + x; y < y1; y++, o += W) {
      const c = data[(((texPos | 0) & TM) << 7) | texX];
      texPos += step;
      if ((c >>> 24) === 254) buf[o] = c | 0xff000000;
      else buf[o] = 0xff000000 | (((((c >> 16) & 255) * fi + fB) >> 8) << 16) | (((((c >> 8) & 255) * fi + fG) >> 8) << 8) | (((c & 255) * fi + fR) >> 8);
    }
  }

  // ---- Sprites ----
  const sprites = [];
  for (const d of decor) sprites.push(d);
  for (const p of pickups) sprites.push({ x: p.x, y: p.y, img: SPR[p.kind], h: 0.3, z: 0.02 + Math.abs(Math.sin(run.time * 3 + p.x)) * 0.04 });
  for (const e of enemies) {
    if (e.spawnT > 0.25) continue;
    const frames = SPR[e.d.sprite];
    let fi = Math.floor(e.anim * 5) % Math.min(2, frames.length);
    if (e.type === 'grunt' && e.shootT > 0) fi = 2;
    const tint = e.hurt > 0 ? 'hurt' : e.slowT > 0 ? 'cold' : e.burnT > 0 ? 'burn' : null;
    const bobZ = e.type === 'drone' ? Math.sin(e.anim * 3) * 0.05 : 0;
    sprites.push({ x: e.x, y: e.y, img: frames[fi], h: e.d.h, z: e.d.z + bobZ, tint });
  }
  for (const p of projectiles) sprites.push({ x: p.x, y: p.y, img: SPR[p.sprite], h: p.h, z: p.z - p.h / 2, bright: true });
  for (const fx of effects) {
    if (fx.kind === 'explosion') {
      const fi = Math.min(4, Math.floor((fx.t / fx.dur) * 5));
      sprites.push({ x: fx.x, y: fx.y, img: SPR.explosion[fi], h: fx.size, z: fx.z - fx.size / 2, bright: true });
    } else if (fx.kind === 'spark') {
      sprites.push({ x: fx.x, y: fx.y, img: SPR.spark, h: 0.1, z: fx.z - 0.05, bright: true });
    } else if (fx.kind === 'beam') {
      sprites.push({ x: fx.x, y: fx.y, img: SPR.beam, h: 1.2 * (1 - fx.t / fx.dur), z: 0, bright: true });
    }
  }
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  for (const s of sprites) {
    const dx = s.x - P.x, dy = s.y - P.y;
    s.tx = invDet * (dirY * dx - dirX * dy);
    s.ty = invDet * (-planeY * dx + planeX * dy);
  }
  sprites.sort((a, b) => b.ty - a.ty);
  for (const s of sprites) drawSprite(s, fr, fg, fb);

  ctx.putImageData(img, 0, 0);

  // ---- Lightning arcs ----
  if (bolts.length) {
    ctx.strokeStyle = '#bff4ff';
    ctx.lineWidth = Math.max(1, K * 1.5);
    for (const b of bolts) {
      const a = project(b.ax, b.ay, b.az, dirX, dirY, planeX, planeY, invDet);
      const c = project(b.bx, b.by, b.bz, dirX, dirY, planeX, planeY, invDet);
      if (!a || !c) continue;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      for (let i = 1; i < 6; i++) {
        const k = i / 6;
        ctx.lineTo(a[0] + (c[0] - a[0]) * k + (Math.random() - 0.5) * 10 * K, a[1] + (c[1] - a[1]) * k + (Math.random() - 0.5) * 10 * K);
      }
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
    }
  }

  drawWeapon();
  drawCrosshair();

  if (hurtTint > 0) { ctx.fillStyle = `rgba(200,0,0,${hurtTint})`; ctx.fillRect(0, 0, W, VH); }
  if (pickupTint > 0) { ctx.fillStyle = `rgba(255,220,80,${pickupTint * 0.6})`; ctx.fillRect(0, 0, W, VH); }
  if (P.dashT > 0) { ctx.fillStyle = 'rgba(160,220,255,0.12)'; ctx.fillRect(0, 0, W, VH); }
  const vg = ctx.createRadialGradient(W / 2, VH / 2, VH * 0.35, W / 2, VH / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, VH);

  drawThreats(Math.atan(pl));
  drawMinimap();
  drawBossBar();
  drawHud();
}

function project(x, y, z, dirX, dirY, planeX, planeY, invDet) {
  const dx = x - P.x, dy = y - P.y;
  const tx = invDet * (dirY * dx - dirX * dy);
  const ty = invDet * (-planeY * dx + planeX * dy);
  if (ty < 0.2) return null;
  return [(W / 2) * (1 + tx / ty), VH / 2 - (z - 0.5) * (VH / ty)];
}

function drawSprite(s, fr, fg, fb) {
  if (s.ty < 0.15) return;
  const im = s.img;
  const scale = VH / s.ty;
  const hPx = s.h * scale, wPx = (hPx * im.w) / im.h;
  const sx = (W / 2) * (1 + s.tx / s.ty);
  const left = sx - wPx / 2;
  const top = VH / 2 - (s.z + s.h - 0.5) * scale;
  const x0 = Math.max(0, Math.ceil(left)), x1 = Math.min(W, Math.ceil(left + wPx));
  const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(VH, Math.ceil(top + hPx));
  if (x0 >= x1 || y0 >= y1) return;
  const f = s.bright ? 1 : Math.min(1, lightAt(s.x, s.y) * 1.1 * (1 - Math.min(0.7, s.ty * 0.04)) + 0.06);
  const inv = 1 - f;
  const data = im.data, iw = im.w, ih = im.h;
  const tint = s.tint;
  for (let x = x0; x < x1; x++) {
    if (s.ty >= zbuf[x]) continue;
    const texX = Math.min(iw - 1, (((x - left) / wPx) * iw) | 0);
    for (let y = y0; y < y1; y++) {
      const texY = Math.min(ih - 1, (((y - top) / hPx) * ih) | 0);
      const c = data[texY * iw + texX];
      const a = c >>> 24;
      if (a < 60) continue;
      let r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
      if (tint === 'hurt') { r = 255; g = 255; b = 255; }
      else if (tint === 'cold') { r = r * 0.6; g = g * 0.8 + 40; b = b * 0.6 + 110; }
      else if (tint === 'burn') { r = r * 0.7 + 90; g = g * 0.75 + 20; b *= 0.6; }
      const i = y * W + x;
      if (a === 254 || tint === 'hurt') {
        buf[i] = 0xff000000 | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r);
      } else if (a < 250) {
        const o = buf[i], k = a / 255;
        r = Math.min(255, (o & 255) + r * k); g = Math.min(255, ((o >> 8) & 255) + g * k); b = Math.min(255, ((o >> 16) & 255) + b * k);
        buf[i] = 0xff000000 | (b << 16) | (g << 8) | r;
      } else {
        buf[i] = 0xff000000 | ((Math.min(255, b) * f + fb * inv) << 16) | ((Math.min(255, g) * f + fg * inv) << 8) | (Math.min(255, r) * f + fr * inv);
      }
    }
  }
}

// Solid black silhouettes of the weapon art, used to shade the gun in dark rooms.
const shadowCache = new Map();
function shadowOf(art) {
  if (!shadowCache.has(art)) {
    const c = document.createElement('canvas');
    c.width = art.width; c.height = art.height;
    const g = c.getContext('2d');
    g.drawImage(art, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    shadowCache.set(art, c);
  }
  return shadowCache.get(art);
}

function drawWeapon() {
  const w = P.weapons[P.cur];
  const art = WART[w.id][P.muzzle > 0 ? 1 : 0];
  const bx = Math.sin(P.bob) * 7 * K, by = Math.abs(Math.cos(P.bob)) * 6 * K;
  const dw = Math.round(192 * K), dh = Math.round(144 * K);
  const x = Math.round(W / 2 - dw / 2 + bx), y = Math.round(VH - dh + 8 * K + by + P.recoil * K);
  ctx.drawImage(art, x, y, dw, dh);
  const L = Math.min(1, lightAt(P.x, P.y) + (P.muzzle > 0 ? 0.5 : 0));
  if (L < 0.9) {
    ctx.globalAlpha = (0.9 - L) * 0.8;
    ctx.drawImage(shadowOf(art), x, y, dw, dh);
    ctx.globalAlpha = 1;
  }
}

function drawCrosshair() {
  const cx = W >> 1, cy = VH >> 1;
  const t = settings.assist ? aimTarget(0) : null;
  const on = t && Math.abs(t.diff) < t.half * 1.1;
  ctx.fillStyle = on ? 'rgba(255,80,60,0.95)' : 'rgba(255,255,255,0.75)';
  const g = Math.round(3 * K), l = Math.round(4 * K);
  ctx.fillRect(cx - g - l, cy, l, 1); ctx.fillRect(cx + g + 1, cy, l, 1);
  ctx.fillRect(cx, cy - g - l, 1, l); ctx.fillRect(cx, cy + g + 1, 1, l);
}

// Red chevrons at the screen edge for enemies outside the view, plus the hit direction.
function drawThreats(halfFov) {
  const arrow = (side, y, alpha, size) => {
    const x = side < 0 ? 6 * K : W - 6 * K;
    ctx.fillStyle = `rgba(255,50,40,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - side * size, y - size);
    ctx.lineTo(x - side * size, y + size);
    ctx.closePath();
    ctx.fill();
  };
  for (const e of enemies) {
    if (e.spawnT > 0 || e.dead) continue;
    const dx = e.x - P.x, dy = e.y - P.y, dist = Math.hypot(dx, dy);
    let diff = Math.atan2(dy, dx) - P.a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) < halfFov) continue;
    if (dist > 10 && !e.los) continue;
    const y = VH / 2 + Math.max(-0.35, Math.min(0.35, (Math.abs(diff) - Math.PI / 2) / Math.PI)) * VH;
    arrow(Math.sign(diff), y, Math.max(0.35, 1 - dist / 12), (6 + Math.max(0, 8 - dist)) * K);
  }
  if (hurtDir && hurtDir.t > 0) {
    let diff = hurtDir.a - P.a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const cx = W / 2 + Math.sin(diff) * VH * 0.32, cy = VH / 2 - Math.cos(diff) * VH * 0.32;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(diff);
    ctx.fillStyle = `rgba(255,30,20,${Math.min(0.8, hurtDir.t)})`;
    ctx.fillRect(-18 * K, -3 * K, 36 * K, 6 * K);
    ctx.restore();
  }
}

function drawMinimap() {
  const s = Math.max(2, Math.round(3 * K)), pad = Math.round(6 * K);
  const mw = level.w * s, mh = level.h * s;
  const ox = W - mw - pad, oy = pad;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#000';
  ctx.fillRect(ox - 2, oy - 2, mw + 4, mh + 4);
  for (let y = 0; y < level.h; y++)
    for (let x = 0; x < level.w; x++) {
      const v = level.map[y * level.w + x];
      if (!v) continue;
      ctx.fillStyle = v === 4 ? (level.open ? '#35ff6a' : '#ff3030') : v === 3 ? '#7a6a40' : '#5a6070';
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
  ctx.fillStyle = '#ff4040';
  for (const e of enemies) ctx.fillRect(ox + e.x * s - 1, oy + e.y * s - 1, 3, 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(ox + P.x * s - 1, oy + P.y * s - 1, 3, 3);
  ctx.strokeStyle = '#ffe060';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox + P.x * s, oy + P.y * s);
  ctx.lineTo(ox + (P.x + Math.cos(P.a) * 2) * s, oy + (P.y + Math.sin(P.a) * 2) * s);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBossBar() {
  const boss = enemies.find((e) => e.type === 'boss');
  if (!boss) return;
  const bw = Math.min(300 * K, W - 120 * K), x = (W - bw) / 2, y = 12 * K;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, bw + 4, 10 * K + 4);
  ctx.fillStyle = '#5a0a1a'; ctx.fillRect(x, y, bw, 10 * K);
  ctx.fillStyle = '#ff2050'; ctx.fillRect(x, y, bw * Math.max(0, boss.hp / boss.maxHp), 10 * K);
  text('ΦΥΛΑΚΑΣ', W / 2, y + 10 * K + 14, 8, '#ffb0c0', 'center');
}

const FONT = '"Press Start 2P", monospace';
function text(s, x, y, size, color, align = 'left') {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.fillText(s, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function bevel(x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#34373b'); g.addColorStop(1, '#1f2124');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#62666c'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = '#0e0f10'; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
}

function drawHud() {
  const y = VH;
  const plateG = ctx.createLinearGradient(0, y, 0, H);
  plateG.addColorStop(0, '#565a60'); plateG.addColorStop(1, '#303236');
  ctx.fillStyle = plateG; ctx.fillRect(0, y, W, HUD_H);
  for (let i = 3; i < W; i += 9) { ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(i, y, 1, HUD_H); }
  ctx.fillStyle = '#80848b'; ctx.fillRect(0, y, W, 1);
  for (const rx of [4, W - 7]) { ctx.fillStyle = '#222'; ctx.fillRect(rx, y + 4, 3, 3); ctx.fillStyle = '#9a9ea5'; ctx.fillRect(rx, y + 4, 1, 1); }

  const w = P.weapons[P.cur];
  const faceW = Math.round(40 * K) + 4;
  const sectionW = Math.floor((W - faceW - 20) / 4);
  const inner = HUD_H - 6;
  const numSize = H >= 270 ? 24 : 16;
  const big = (s) => (s.length * numSize <= sectionW - 6 ? numSize : s.length * 16 <= sectionW - 6 ? 16 : 8);
  const numY = y + 3 + Math.round(inner * 0.62);
  const labY = y + inner;
  let x = 10;
  const section = (value, label, color) => {
    bevel(x, y + 3, sectionW, inner);
    text(value, x + sectionW / 2, numY, big(value), color, 'center');
    text(label, x + sectionW / 2, labY, 8, '#b8b8b8', 'center');
    x += sectionW + 1;
  };
  section(w.ammo === Infinity ? '--' : String(w.ammo), 'AMMO', '#e01010');
  section(`${Math.ceil(P.hp)}%`, 'HEALTH', P.hp < 30 ? '#ff5050' : '#e01010');
  bevel(x, y + 3, faceW, inner);
  const lvl = P.hp > 75 ? 0 : P.hp > 50 ? 1 : P.hp > 25 ? 2 : 3;
  const look = P.ouch > 0 ? 3 : P.look + 1;
  const fh = Math.min(inner - 2, Math.round(42 * K)), fw = Math.round((fh * 36) / 42);
  ctx.drawImage(FACES[lvl][look], Math.round(x + (faceW - fw) / 2), Math.round(y + 3 + (inner - fh) / 2), fw, fh);
  x += faceW + 1;
  section(`${Math.ceil(P.armor)}%`, 'ARMOR', '#e01010');
  const rw = W - x - 10;
  bevel(x, y + 3, rw, inner);
  P.weapons.forEach((wp, i) => text(String(i + 1), x + 10 + i * 14, y + 16, 8, i === P.cur ? '#ffe060' : '#8a8a8a'));
  const dashMax = 1.8 * Math.pow(0.75, aug('dash'));
  const ready = Math.min(1, 1 - P.dashCd / dashMax);
  ctx.fillStyle = '#111'; ctx.fillRect(x + 8, y + 21, rw - 16, 4);
  ctx.fillStyle = ready >= 1 ? '#40c0ff' : '#2a5a7a';
  ctx.fillRect(x + 8, y + 21, (rw - 16) * ready, 4);
  text(`S${run.sector}-${run.room}`, x + rw / 2, labY, 8, '#b8b8b8', 'center');
}

// ======================================================================
// Loop
// ======================================================================
let last = performance.now();
let frameAvg = 16, slowFrames = 0, autoLocked = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'play') {
    run.time += dt;
    updatePlayer(dt);
    if (mode === 'play') {
      updateEnemies(dt);
      updateProjectiles(dt);
      checkRoom();
    }
    // Automatic quality: step down when frames are consistently slow.
    // Automatic quality: step down when frames are slow, up when there is headroom.
    frameAvg = frameAvg * 0.95 + dt * 1000 * 0.05;
    if (settings.quality === 'auto') {
      const order = ['low', 'mid', 'high'];
      const i = order.indexOf(autoLevel);
      if (frameAvg > 24 && i > 0) slowFrames++;
      else if (frameAvg < 13 && i < 2 && !autoLocked) slowFrames--;
      else slowFrames = 0;
      if (slowFrames > 90 || slowFrames < -240) {
        if (slowFrames > 0) autoLocked = true; // never climb back after a drop
        autoLevel = order[i + (slowFrames > 0 ? -1 : 1)];
        slowFrames = 0; frameAvg = 16; resize();
      }
    }
  }
  if (mode !== 'menu' && mode !== 'pause') {
    for (const fx of effects) fx.t += dt;
    effects = effects.filter((fx) => fx.t < fx.dur);
    for (const b of bolts) b.t -= dt;
    bolts = bolts.filter((b) => b.t > 0);
    if (hurtDir) hurtDir.t -= dt;
  }
  flashLight = Math.max(0, flashLight - dt * 8);
  hurtTint = Math.max(0, hurtTint - dt * 1.2);
  pickupTint = Math.max(0, pickupTint - dt);
  shake = Math.max(0, shake - dt * 20);
  canvas.style.transform = shake > 0.2 ? `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)` : '';
  if (attract) drawAttract(now); else render();
  requestAnimationFrame(frame);
}

// Title screen background: a slowly rotating view of a demo room.
function drawAttract(now) {
  if (!drawAttract.ready) {
    run = { sector: 1, room: 2, depth: 3, kills: 0, time: 0, score: 0, aug: {}, maxHp: 100 };
    P = { x: 0, y: 0, a: 0, hp: 100, armor: 0, weapons: [{ id: 'shotgun', lvl: 1, ammo: 40 }], cur: 0, bob: 0, recoil: 0, muzzle: 0, ouch: 0, look: 0, dashT: 0, dashCd: 0, inv: 0 };
    rng = mulberry32(42);
    level = genRoom();
    P.x = level.w / 2; P.y = level.h / 2;
    enemies = []; pendingWaves = [];
    rng = mulberry32(7);
    for (const type of ['grunt', 'drone', 'heavy', 'charger']) enemies.push(makeEnemy(type, freeTileFarFromPlayer(3), 0));
    drawAttract.ready = true;
  }
  P.a = now / 5000;
  for (const e of enemies) e.anim += 0.016;
  run.time = now / 1000;
  render();
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();
setupTouch();
(document.fonts?.load(`8px ${FONT}`) ?? Promise.resolve()).catch(() => {}).finally(() => requestAnimationFrame(frame));

// ======================================================================
// Sound (WebAudio, synthesized)
// ======================================================================
const sfx = (() => {
  let ac = null, noiseBuf = null, master = null;
  const init = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; }
  };
  const noise = (dur, freq, vol, type = 'lowpass', q = 1) => {
    if (!ac) return;
    const t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur);
  };
  const tone = (f0, f1, dur, type, vol, delay = 0) => {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  return {
    init,
    pistol: () => { noise(0.12, 3000, 0.5); tone(300, 80, 0.08, 'square', 0.15); },
    shotgun: () => { noise(0.35, 1800, 0.9); tone(120, 40, 0.2, 'sawtooth', 0.25); },
    chaingun: () => { noise(0.07, 3500, 0.35); tone(220, 90, 0.05, 'square', 0.08); },
    plasma: () => { tone(400, 1600, 0.12, 'sawtooth', 0.12); tone(900, 2400, 0.1, 'sine', 0.08); },
    rocket: () => { noise(0.5, 900, 0.6); tone(90, 40, 0.4, 'sawtooth', 0.2); },
    explosion: () => { noise(0.8, 700, 1.0); tone(70, 30, 0.6, 'sine', 0.4); },
    enemyShot: () => tone(700, 200, 0.12, 'square', 0.06),
    melee: () => { noise(0.15, 1200, 0.5, 'bandpass', 2); tone(160, 60, 0.15, 'square', 0.12); },
    hurt: () => { tone(180, 60, 0.25, 'sawtooth', 0.22); noise(0.1, 800, 0.3); },
    death: (big) => { noise(big ? 1.2 : 0.4, 1200, big ? 1 : 0.5); tone(big ? 120 : 320, 40, big ? 1 : 0.3, 'square', 0.12); },
    pickup: () => [660, 880, 1320].forEach((f, i) => tone(f, f, 0.08, 'triangle', 0.12, i * 0.05)),
    swap: () => tone(500, 300, 0.06, 'square', 0.06),
    dash: () => noise(0.25, 2500, 0.35, 'bandpass', 0.8),
    zap: () => { noise(0.15, 5000, 0.3, 'highpass'); tone(1800, 600, 0.1, 'sawtooth', 0.06); },
    teleport: () => { tone(200, 1200, 0.4, 'sine', 0.08); tone(300, 1800, 0.4, 'triangle', 0.05); },
    door: () => { noise(0.6, 400, 0.4); tone(90, 60, 0.5, 'sawtooth', 0.12); },
    clear: () => [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.18, 'square', 0.07, i * 0.09)),
    playerDeath: () => { tone(300, 40, 1.2, 'sawtooth', 0.25); noise(1, 600, 0.6); },
  };
})();

// Exposed for automated testing.
window.__ds = {
  get state() { return { mode, run, P, level, enemies, projectiles, pickups, settings, W, H }; },
  startRun, pickCard, nextRoom, damageEnemy, damagePlayer, resize,
};
