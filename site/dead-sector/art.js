// Procedural pixel art: wall/floor textures, enemy sprites, weapon view
// models and the status-bar face. Everything is drawn once at startup.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// Canvas -> { w, h, data: Uint32Array } in the same byte order as ImageData.
export function toImage(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, data: new Uint32Array(d.data.buffer.slice(0)) };
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const css = ([r, g, b], f = 1) =>
  `rgb(${Math.max(0, Math.min(255, r * f)) | 0},${Math.max(0, Math.min(255, g * f)) | 0},${Math.max(0, Math.min(255, b * f)) | 0})`;

function noise(g, x0, y0, w, h, base, amt, rng) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      g.fillStyle = css(base, 1 + (rng() - 0.5) * amt);
      g.fillRect(x, y, 1, 1);
    }
}
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

// ---------- Sector themes ----------
export const THEMES = [
  { name: 'Αποθήκες', wall: 0x5b6275, wall2: 0x464b59, accent: 0x3fd0ff, floor: 0x3a3d45, ceil: 0x24272e, crate: 0x6d5c3c, fog: [8, 10, 16] },
  { name: 'Χυτήριο', wall: 0x6e3b2a, wall2: 0x552d22, accent: 0xff6a1a, floor: 0x3b2620, ceil: 0x21150f, crate: 0x5d4a32, fog: [18, 6, 2] },
  { name: 'Βιοεργαστήριο', wall: 0x42604a, wall2: 0x33493a, accent: 0x7dff4a, floor: 0x2c3a2f, ceil: 0x151f17, crate: 0x4f5b3a, fog: [4, 14, 6] },
];

// ---------- Textures (64x64) ----------
function panelTex(t, rng) {
  const [c, g] = mk(64, 64);
  const base = hex(t.wall);
  noise(g, 0, 0, 64, 64, base, 0.14, rng);
  const dark = css(base, 0.45), light = css(base, 1.35);
  for (const y of [0, 31]) { rect(g, 0, y, 64, 1, dark); rect(g, 0, y + 1, 64, 1, light); }
  rect(g, 0, 0, 1, 31, dark); rect(g, 32, 32, 1, 32, dark);
  rect(g, 1, 0, 1, 31, light); rect(g, 33, 32, 1, 32, light);
  for (const [x, y] of [[4, 4], [27, 4], [4, 26], [27, 26], [36, 36], [59, 36], [36, 58], [59, 58], [5, 36], [5, 58]]) {
    rect(g, x, y, 2, 2, dark); rect(g, x, y, 1, 1, light);
  }
  // Warning light strip
  const acc = hex(t.accent);
  rect(g, 40, 12, 16, 5, css(base, 0.3));
  rect(g, 41, 13, 14, 3, css(acc, 0.8));
  rect(g, 43, 14, 10, 1, css(acc, 1.3));
  // Grime
  for (let i = 0; i < 30; i++) rect(g, rng() * 64 | 0, 50 + rng() * 14 | 0, 1, 1 + rng() * 3 | 0, css(base, 0.6));
  return toImage(c);
}

function pipeTex(t, rng) {
  const [c, g] = mk(64, 64);
  const base = hex(t.wall2);
  noise(g, 0, 0, 64, 64, base, 0.12, rng);
  for (let y = 2; y < 64; y += 4) rect(g, 0, y, 64, 1, css(base, 0.6));
  const pipe = hex(t.wall);
  for (const px of [5, 25, 45]) {
    for (let i = 0; i < 12; i++) {
      const f = 0.55 + Math.sin((i / 11) * Math.PI) * 0.75;
      rect(g, px + i, 0, 1, 64, css(pipe, f));
    }
    for (const by of [10, 40]) {
      rect(g, px - 1, by, 14, 4, css(pipe, 0.5));
      rect(g, px - 1, by, 14, 1, css(pipe, 1.4));
    }
  }
  rect(g, 0, 0, 64, 1, css(base, 0.35));
  rect(g, 0, 63, 64, 1, css(base, 0.35));
  return toImage(c);
}

function crateTex(t, rng) {
  const [c, g] = mk(64, 64);
  const base = hex(t.crate);
  noise(g, 0, 0, 64, 64, base, 0.2, rng);
  const dark = css(base, 0.5), light = css(base, 1.35);
  rect(g, 0, 0, 64, 5, dark); rect(g, 0, 59, 64, 5, dark);
  rect(g, 0, 0, 5, 64, dark); rect(g, 59, 0, 5, 64, dark);
  rect(g, 5, 5, 54, 1, light); rect(g, 5, 5, 1, 54, light);
  for (let i = 0; i < 54; i++) {
    rect(g, 5 + i, 5 + i, 3, 3, dark);
    rect(g, 56 - i, 5 + i, 3, 3, dark);
  }
  // Hazard band
  for (let x = 0; x < 64; x++) rect(g, x, 28, 1, 8, ((x >> 2) & 1) ? '#1a1a1a' : '#d9b21c');
  return toImage(c);
}

function doorTex(t, open) {
  const [c, g] = mk(64, 64);
  const rng = mulberry32(99);
  noise(g, 0, 0, 64, 64, [70, 74, 82], 0.12, rng);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const edge = x < 6 || x > 57 || y < 6;
      if (edge) rect(g, x, y, 1, 1, (((x + y) >> 2) & 1) ? '#141414' : '#e0b21a');
    }
  rect(g, 31, 6, 2, 58, '#22252b');
  rect(g, 12, 20, 16, 30, '#3c4048'); rect(g, 36, 20, 16, 30, '#3c4048');
  rect(g, 12, 20, 16, 1, '#6a707c'); rect(g, 36, 20, 16, 1, '#6a707c');
  const lamp = open ? '#35ff6a' : '#ff2a2a';
  rect(g, 24, 9, 16, 7, '#111');
  rect(g, 25, 10, 14, 5, lamp);
  rect(g, 27, 11, 10, 1, '#fff');
  if (open) {
    // Arrow pointing forward
    g.fillStyle = '#35ff6a';
    for (let i = 0; i < 8; i++) g.fillRect(32 - i, 30 + i, i * 2, 1);
    g.fillRect(29, 38, 6, 8);
  }
  return toImage(c);
}

function floorTex(t, rng) {
  const [c, g] = mk(64, 64);
  const base = hex(t.floor);
  noise(g, 0, 0, 64, 64, base, 0.16, rng);
  for (let i = 0; i < 64; i += 16) {
    rect(g, i, 0, 1, 64, css(base, 0.55)); rect(g, 0, i, 64, 1, css(base, 0.55));
    rect(g, i + 1, 0, 1, 64, css(base, 1.25)); rect(g, 0, i + 1, 64, 1, css(base, 1.25));
  }
  for (let y = 20; y < 28; y += 2) for (let x = 36; x < 60; x += 2) rect(g, x, y, 1, 1, css(base, 0.4));
  for (let i = 0; i < 4; i++) {
    const sx = rng() * 56 | 0, sy = rng() * 56 | 0;
    for (let k = 0; k < 14; k++) rect(g, sx + rng() * 8 | 0, sy + rng() * 8 | 0, 1, 1, css(base, 0.65));
  }
  return toImage(c);
}

function ceilTex(t, rng) {
  const [c, g] = mk(64, 64);
  const base = hex(t.ceil);
  noise(g, 0, 0, 64, 64, base, 0.15, rng);
  rect(g, 0, 0, 64, 2, css(base, 0.5)); rect(g, 0, 0, 2, 64, css(base, 0.5));
  rect(g, 0, 32, 64, 1, css(base, 0.6)); rect(g, 32, 0, 1, 64, css(base, 0.6));
  const acc = hex(t.accent);
  rect(g, 10, 10, 14, 14, css(base, 0.4));
  rect(g, 11, 11, 12, 12, css([230, 235, 240], 0.9));
  rect(g, 13, 13, 8, 8, css([255, 255, 255], 1));
  rect(g, 42, 44, 12, 3, css(acc, 0.8));
  return toImage(c);
}

export function buildTextures(themeIndex) {
  const t = THEMES[themeIndex % THEMES.length];
  const rng = mulberry32(1234 + themeIndex);
  return {
    theme: t,
    // Index = map tile value
    walls: [null, panelTex(t, rng), pipeTex(t, rng), crateTex(t, rng), doorTex(t, false), doorTex(t, false)],
    doorOpen: doorTex(t, true),
    floor: floorTex(t, rng),
    ceil: ceilTex(t, rng),
  };
}

// ---------- Sprites ----------
function metal(g, x, y, w, h, base, rng) {
  noise(g, x, y, w, h, base, 0.18, rng);
  rect(g, x, y, w, 1, css(base, 1.45));
  rect(g, x, y + h - 1, w, 1, css(base, 0.5));
}

function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    g.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

function drone(frame) {
  const [c, g] = mk(48, 48);
  const rng = mulberry32(7 + frame);
  const body = [120, 128, 140];
  rect(g, 4, 20, 10, 5, css(body, 0.7)); rect(g, 34, 20, 10, 5, css(body, 0.7));
  rect(g, 4, 20, 10, 1, css(body, 1.3)); rect(g, 34, 20, 10, 1, css(body, 1.3));
  disc(g, 24, 22, 13, css(body, 0.55));
  disc(g, 24, 21, 12, css(body, 0.95));
  disc(g, 21, 17, 5, css(body, 1.3));
  for (let i = 0; i < 25; i++) rect(g, 13 + rng() * 22 | 0, 12 + rng() * 20 | 0, 1, 1, css(body, 0.6));
  disc(g, 24, 23, 6, '#220000');
  disc(g, 24, 23, 4, frame ? '#ff4040' : '#d01010');
  rect(g, 23, 21, 2, 2, '#ffd0d0');
  const flame = frame ? 8 : 5;
  rect(g, 21, 35, 6, 3, '#555');
  for (let i = 0; i < flame; i++) rect(g, 22 + (i >> 2), 38 + i, 4 - (i >> 1), 1, i < 3 ? '#bfefff' : '#3aa0ff');
  return c;
}

function grunt(frame) {
  // frame 0/1 walk, 2 shoot
  const [c, g] = mk(48, 64);
  const rng = mulberry32(21 + frame);
  const armor = [96, 104, 88], dark = [50, 54, 48];
  const step = frame === 1 ? 3 : 0;
  // legs
  metal(g, 15, 42 - step, 7, 20 + step, dark, rng);
  metal(g, 26, 42 + step - 3, 7, 23 - step, dark, rng);
  rect(g, 13, 60, 10, 4, css(dark, 0.7)); rect(g, 25, 60, 10, 4, css(dark, 0.7));
  // torso
  metal(g, 12, 20, 24, 23, armor, rng);
  rect(g, 17, 26, 14, 8, css(armor, 0.6));
  rect(g, 18, 27, 12, 2, '#ffb000');
  // shoulders
  metal(g, 7, 18, 9, 9, armor, rng); metal(g, 32, 18, 9, 9, armor, rng);
  // head
  metal(g, 17, 7, 14, 13, armor, rng);
  rect(g, 18, 12, 12, 4, '#200');
  rect(g, 19, 13, 10, 2, frame === 2 ? '#ff8080' : '#ff2020');
  // gun arm
  metal(g, 34, 26, 7, 12, dark, rng);
  metal(g, 36, 34, 6, 14, [70, 70, 76], rng);
  rect(g, 37, 48, 4, 3, '#222');
  // left arm
  metal(g, 7, 26, 6, 16, dark, rng);
  if (frame === 2) {
    disc(g, 39, 53, 5, '#ffd040');
    disc(g, 39, 53, 3, '#ffffff');
  }
  return c;
}

function charger(frame) {
  const [c, g] = mk(56, 56);
  const rng = mulberry32(33 + frame);
  const skin = [140, 44, 36];
  const off = frame ? 3 : 0;
  // legs
  metal(g, 8 + off, 40, 6, 14, [60, 30, 26], rng);
  metal(g, 42 - off, 40, 6, 14, [60, 30, 26], rng);
  metal(g, 18 - off, 42, 6, 12, [60, 30, 26], rng);
  metal(g, 32 + off, 42, 6, 12, [60, 30, 26], rng);
  // body
  for (let y = 0; y < 22; y++) {
    const w = 18 + Math.round(Math.sin((y / 21) * Math.PI) * 8);
    noise(g, 28 - w, 20 + y, w * 2, 1, skin, 0.25, rng);
  }
  // spikes
  for (let i = 0; i < 6; i++) {
    const x = 12 + i * 6;
    for (let k = 0; k < 7; k++) rect(g, x + (k >> 1), 20 - k, 3 - (k >> 1), 1, css([210, 200, 180], 1 - k * 0.06));
  }
  // head / jaw
  metal(g, 18, 28, 20, 12, [110, 34, 28], rng);
  rect(g, 20, 37, 16, 4, '#1a0000');
  for (let i = 0; i < 5; i++) rect(g, 21 + i * 3, 37, 1, 2, '#e8e0d0');
  rect(g, 21, 31, 4, 3, '#ffb020'); rect(g, 31, 31, 4, 3, '#ffb020');
  rect(g, 22, 32, 2, 1, '#fff'); rect(g, 32, 32, 2, 1, '#fff');
  // claws
  rect(g, 4, 30, 8, 3, '#d8d0c0'); rect(g, 44, 30, 8, 3, '#d8d0c0');
  return c;
}

function heavy(frame, boss = false) {
  const [c, g] = mk(64, 64);
  const rng = mulberry32((boss ? 91 : 51) + frame);
  const hull = boss ? [120, 40, 60] : [110, 104, 80];
  const dark = boss ? [60, 20, 30] : [58, 56, 44];
  // treads
  metal(g, 6, 48, 52, 14, dark, rng);
  for (let x = 8 + (frame ? 2 : 0); x < 58; x += 5) rect(g, x, 50, 2, 10, css(dark, 0.5));
  // hull
  metal(g, 10, 22, 44, 28, hull, rng);
  rect(g, 14, 28, 36, 2, css(hull, 0.5));
  // core
  disc(g, 32, 38, 7, '#1a0000');
  disc(g, 32, 38, 5, boss ? (frame ? '#ff60ff' : '#d020d0') : (frame ? '#ffa040' : '#ff6010'));
  rect(g, 31, 36, 2, 2, '#fff');
  // cannons
  metal(g, 0, 16, 12, 10, dark, rng); metal(g, 52, 16, 12, 10, dark, rng);
  rect(g, 0, 19, 4, 4, '#111'); rect(g, 60, 19, 4, 4, '#111');
  // head
  metal(g, 22, 8, 20, 14, hull, rng);
  rect(g, 25, 13, 14, 4, '#200');
  rect(g, 26, 14, 12, 2, '#ff3030');
  if (boss) {
    for (let k = 0; k < 8; k++) {
      rect(g, 20 - (k >> 1), 8 - k, 3, 1, '#e8e0d0');
      rect(g, 41 + (k >> 1), 8 - k, 3, 1, '#e8e0d0');
    }
  }
  return c;
}

function wreck(tint) {
  const [c, g] = mk(48, 24);
  const rng = mulberry32(tint[0]);
  for (let i = 0; i < 26; i++) {
    const w = 3 + rng() * 8 | 0, h = 2 + rng() * 5 | 0;
    noise(g, 4 + rng() * 36 | 0, 24 - h - (rng() * 8 | 0), w, h, tint, 0.3, rng);
  }
  for (let i = 0; i < 8; i++) rect(g, 10 + rng() * 28 | 0, 10 + rng() * 10 | 0, 1, 1, '#ffb040');
  return c;
}

function orb(r, core, glow) {
  const s = r * 2 + 4;
  const [c, g] = mk(s, s);
  disc(g, s / 2, s / 2, r + 1, glow);
  disc(g, s / 2, s / 2, r - 1, core);
  disc(g, s / 2, s / 2, Math.max(1, r - 3), '#ffffff');
  return c;
}

function rocket() {
  const [c, g] = mk(16, 16);
  disc(g, 8, 8, 7, '#ff7a10');
  disc(g, 8, 8, 5, '#ffd040');
  disc(g, 8, 8, 3, '#8a8a8a');
  return c;
}

function explosion(frame) {
  const [c, g] = mk(48, 48);
  const rng = mulberry32(300 + frame);
  const r = 8 + frame * 5;
  const cols = ['#fff6c0', '#ffd040', '#ff8a10', '#c03a08', '#5a4a44'];
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2, d = rng() * r * 0.6;
    disc(g, 24 + Math.cos(a) * d | 0, 24 + Math.sin(a) * d | 0, Math.max(2, (r * (0.35 + rng() * 0.3)) | 0),
      cols[Math.min(cols.length - 1, frame + (rng() * 2 | 0))]);
  }
  return c;
}

function pickup(kind) {
  const [c, g] = mk(20, 16);
  if (kind === 'health') {
    rect(g, 1, 3, 18, 13, '#dcdcdc'); rect(g, 1, 3, 18, 1, '#fff'); rect(g, 1, 15, 18, 1, '#888');
    rect(g, 8, 5, 4, 9, '#d01010'); rect(g, 5, 8, 10, 3, '#d01010');
  } else if (kind === 'ammo') {
    rect(g, 1, 6, 18, 10, '#5a6030'); rect(g, 1, 6, 18, 1, '#8a9050');
    for (let i = 0; i < 4; i++) { rect(g, 3 + i * 4, 1, 3, 6, '#d8b030'); rect(g, 3 + i * 4, 1, 3, 1, '#fff0a0'); }
    rect(g, 3, 10, 14, 2, '#2a2a10');
  } else {
    rect(g, 3, 2, 14, 13, '#1f9a3a'); rect(g, 7, 2, 6, 4, '#000');
    rect(g, 3, 2, 14, 1, '#6aff8a'); rect(g, 5, 8, 10, 1, '#0d5a20'); rect(g, 5, 11, 10, 1, '#0d5a20');
  }
  return c;
}

function beam() {
  const [c, g] = mk(16, 64);
  for (let x = 0; x < 16; x++) {
    const f = 1 - Math.abs(x - 7.5) / 8;
    rect(g, x, 0, 1, 64, `rgba(${80 + 170 * f | 0},${180 + 75 * f | 0},255,${f * f})`);
  }
  return c;
}

export function buildSprites() {
  const I = (c) => toImage(c);
  return {
    drone: [I(drone(0)), I(drone(1))],
    grunt: [I(grunt(0)), I(grunt(1)), I(grunt(2))],
    charger: [I(charger(0)), I(charger(1))],
    heavy: [I(heavy(0)), I(heavy(1))],
    boss: [I(heavy(0, true)), I(heavy(1, true))],
    wreck: I(wreck([90, 92, 96])),
    wreckRed: I(wreck([120, 40, 34])),
    bolt: I(orb(5, '#ff3020', 'rgba(255,60,20,0.55)')),
    plasma: I(orb(5, '#40a0ff', 'rgba(60,140,255,0.55)')),
    rocket: I(rocket()),
    explosion: [0, 1, 2, 3, 4].map((f) => I(explosion(f))),
    spark: I(orb(2, '#ffd040', 'rgba(255,200,60,0.6)')),
    health: I(pickup('health')), ammo: I(pickup('ammo')), armor: I(pickup('armor')),
    beam: I(beam()),
  };
}

// ---------- Weapon view models (drawn straight onto the low-res screen) ----------
function hand(g, x, y) {
  rect(g, x, y, 14, 20, '#c68a5c');
  rect(g, x, y, 14, 2, '#e0a878');
  rect(g, x + 2, y + 4, 10, 1, '#9a6440');
  rect(g, x - 2, y + 16, 18, 10, '#3a4a2a');
}

function flash(g, x, y, r) {
  disc(g, x, y, r, 'rgba(255,190,40,0.9)');
  disc(g, x, y, (r * 0.65) | 0, '#fff2a0');
  disc(g, x, y, (r * 0.3) | 0, '#ffffff');
}

function weaponArt(id, firing) {
  const [c, g] = mk(96, 72);
  const rng = mulberry32(id.length * 17 + (firing ? 1 : 0));
  const steel = [92, 96, 104];
  if (id === 'pistol') {
    if (firing) flash(g, 48, 14, 11);
    metal(g, 42, 18, 12, 30, steel, rng);
    rect(g, 44, 18, 8, 3, '#222');
    metal(g, 40, 40, 16, 12, [60, 60, 66], rng);
    hand(g, 41, 50);
  } else if (id === 'shotgun') {
    if (firing) flash(g, 48, 8, 16);
    metal(g, 41, 12, 7, 40, steel, rng);
    metal(g, 48, 12, 7, 40, steel, rng);
    rect(g, 42, 12, 5, 3, '#111'); rect(g, 49, 12, 5, 3, '#111');
    metal(g, 38, 34, 20, 10, [110, 72, 40], rng);
    hand(g, 30, 48); hand(g, 52, 50);
  } else if (id === 'chaingun') {
    if (firing) flash(g, 48, 10, 13);
    for (let i = 0; i < 4; i++) metal(g, 39 + i * 5, 14 + (firing && i % 2 ? 2 : 0), 4, 34, steel, rng);
    metal(g, 36, 30, 24, 6, [70, 70, 76], rng);
    metal(g, 34, 42, 28, 12, [80, 80, 60], rng);
    hand(g, 36, 52);
  } else if (id === 'plasma') {
    if (firing) { disc(g, 48, 12, 12, 'rgba(80,160,255,0.85)'); disc(g, 48, 12, 6, '#e0f0ff'); }
    metal(g, 36, 16, 24, 34, [70, 84, 110], rng);
    rect(g, 40, 22, 16, 6, '#0a1a3a');
    rect(g, 41, 23, 14, 4, firing ? '#bfe4ff' : '#3a90ff');
    rect(g, 44, 14, 8, 4, '#222');
    for (let y = 32; y < 46; y += 3) rect(g, 38, y, 20, 1, '#2a3448');
    hand(g, 32, 50); hand(g, 50, 50);
  } else if (id === 'rocket') {
    if (firing) flash(g, 48, 10, 15);
    metal(g, 34, 12, 28, 40, [88, 96, 70], rng);
    disc(g, 48, 16, 8, '#111');
    disc(g, 48, 16, 5, '#3a3a3a');
    rect(g, 34, 30, 28, 3, '#e0b21a');
    hand(g, 30, 50); hand(g, 52, 50);
  }
  return c;
}

export function buildWeapons(ids) {
  const out = {};
  for (const id of ids) out[id] = [weaponArt(id, false), weaponArt(id, true)];
  return out;
}

// ---------- Status-bar face (24x28) ----------
export function buildFaces() {
  const faces = [];
  // level 0..3 (healthy..near death), look -1/0/1, plus "ouch"
  for (let level = 0; level < 4; level++) {
    const row = [];
    for (const look of [-1, 0, 1, 2]) {
      const [c, g] = mk(24, 28);
      const rng = mulberry32(level * 10 + look + 5);
      noise(g, 3, 4, 18, 22, [198, 138, 92], 0.12, rng);
      rect(g, 3, 1, 18, 6, '#5a3a1a');
      rect(g, 2, 4, 2, 10, '#5a3a1a'); rect(g, 20, 4, 2, 10, '#5a3a1a');
      const ex = look === 2 ? 0 : look;
      // eyes
      rect(g, 6, 11, 5, 3, '#fff'); rect(g, 13, 11, 5, 3, '#fff');
      if (look === 2) { rect(g, 6, 11, 5, 3, '#fff'); rect(g, 7, 12, 3, 1, '#222'); rect(g, 14, 12, 3, 1, '#222'); }
      else { rect(g, 8 + ex, 11, 2, 3, '#2a4a8a'); rect(g, 15 + ex, 11, 2, 3, '#2a4a8a'); }
      rect(g, 6, 9, 5, 1, '#5a3a1a'); rect(g, 13, 9, 5, 1, '#5a3a1a');
      rect(g, 11, 14, 2, 4, '#a86a40');
      // mouth
      if (look === 2) { rect(g, 9, 20, 6, 4, '#3a0a0a'); }
      else if (level < 2) { rect(g, 8, 21, 8, 1, '#7a3a2a'); }
      else { rect(g, 8, 20, 8, 2, '#5a1a1a'); }
      // blood
      for (let i = 0; i < level * 7; i++) rect(g, 3 + rng() * 18 | 0, 6 + rng() * 20 | 0, 1, 1 + rng() * 3 | 0, '#a01010');
      rect(g, 5, 26, 14, 2, '#3a4a2a');
      row.push(c);
    }
    faces.push(row);
  }
  return faces;
}
