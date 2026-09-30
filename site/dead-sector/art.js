// Procedural pixel art (v2, double detail): 128px wall/floor textures,
// shaded and outlined sprites, weapon view models and the status-bar face.
// Pixels that should glow in the dark (lamps, screens, eyes) are marked with
// alpha 254 so the renderer can draw them at full brightness.

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

export const TS = 128; // texture size

function surface(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g, w, h, emit: [] };
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const css = ([r, g, b], f = 1) => `rgb(${clamp(r * f)},${clamp(g * f)},${clamp(b * f)})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

// Mark a region as self-lit (drawn at full brightness in the dark).
function glow(s, x, y, w, h) { s.emit.push([x | 0, y | 0, Math.ceil(w), Math.ceil(h)]); }

// Metal plate: noise, top-lit gradient, bevel.
function plate(s, x, y, w, h, base, rng, { bevel = 1, noise = 0.12, grad = 0.3 } = {}) {
  const { g } = s;
  for (let j = 0; j < h; j++) {
    const f = 1 + grad / 2 - (j / Math.max(1, h - 1)) * grad;
    for (let i = 0; i < w; i++) px(g, x + i, y + j, css(base, f * (1 + (rng() - 0.5) * noise)));
  }
  if (bevel) {
    rect(g, x, y, w, bevel, css(base, 1.55));
    rect(g, x, y, bevel, h, css(base, 1.3));
    rect(g, x, y + h - bevel, w, bevel, css(base, 0.45));
    rect(g, x + w - bevel, y, bevel, h, css(base, 0.6));
  }
}

function rivet(s, x, y, base) {
  const { g } = s;
  rect(g, x, y, 3, 3, css(base, 0.55));
  px(g, x, y, css(base, 1.7));
  px(g, x + 1, y + 1, css(base, 1.1));
}

// Lit sphere (light from upper left).
function ball(s, cx, cy, r, base, { spec = true } = {}) {
  const { g } = s;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d2 = x * x + y * y;
      if (d2 > r * r) continue;
      const nz = Math.sqrt(1 - d2 / (r * r));
      const nx = x / r, ny = y / r;
      let l = 0.35 + 0.75 * Math.max(0, -0.45 * nx - 0.55 * ny + 0.7 * nz);
      if (spec && l > 1.02) l += 0.25;
      px(g, cx + x, cy + y, css(base, l));
    }
}

// Vertical cylinder shading across x.
function cyl(s, x, y, w, h, base, rng, noise = 0.08) {
  const { g } = s;
  for (let i = 0; i < w; i++) {
    const t = (i + 0.5) / w * 2 - 1;
    const f = 0.45 + 0.85 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.35 * t);
    for (let j = 0; j < h; j++) px(g, x + i, y + j, css(base, f * (1 + (rng() - 0.5) * noise)));
  }
}

function disc(s, cx, cy, r, color) {
  const { g } = s;
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

function toImage(s, { outline = false } = {}) {
  const { g, w, h } = s;
  const d = g.getImageData(0, 0, w, h);
  const data = new Uint32Array(d.data.buffer.slice(0));
  if (outline) {
    const src = data.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if ((src[i] >>> 24) > 100) continue;
        const solid = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && (src[yy * w + xx] >>> 24) > 200;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) data[i] = 0xff0c0a0a;
      }
  }
  for (const [x0, y0, ew, eh] of s.emit)
    for (let y = Math.max(0, y0); y < Math.min(h, y0 + eh); y++)
      for (let x = Math.max(0, x0); x < Math.min(w, x0 + ew); x++) {
        const i = y * w + x;
        if ((data[i] >>> 24) > 200) data[i] = (data[i] & 0x00ffffff) | (254 << 24);
      }
  return { w, h, data };
}

// Canvas version (for things drawn with ctx.drawImage: weapons, face).
function toCanvas(s, { outline = false } = {}) {
  if (outline) {
    const im = toImage(s, { outline: true });
    for (let i = 0; i < im.data.length; i++) if ((im.data[i] >>> 24) === 254) im.data[i] |= 0xff000000;
    const id = new ImageData(new Uint8ClampedArray(im.data.buffer), s.w, s.h);
    s.g.putImageData(id, 0, 0);
  }
  return s.c;
}

// ---------- Sector themes ----------
export const THEMES = [
  { name: 'Αποθήκες', wall: 0x5d6577, wall2: 0x454b59, trim: 0x8a8f98, accent: 0x3fd0ff, floor: 0x44474e, ceil: 0x2a2d34, crate: 0x6d5c3c, fog: [4, 6, 10], lamp: [255, 244, 225] },
  { name: 'Χυτήριο', wall: 0x70402d, wall2: 0x543023, trim: 0x9a7a5a, accent: 0xff6a1a, floor: 0x46302a, ceil: 0x251912, crate: 0x5d4a32, fog: [12, 4, 1], lamp: [255, 190, 120] },
  { name: 'Βιοεργαστήριο', wall: 0x456350, wall2: 0x344b3d, trim: 0x8aa08a, accent: 0x7dff4a, floor: 0x32403a, ceil: 0x18221b, crate: 0x4f5b3a, fog: [2, 10, 5], lamp: [210, 255, 215] },
];

// ---------- Textures (128x128) ----------
function grime(s, base, rng, y0 = 96) {
  for (let i = 0; i < 260; i++) {
    const x = rng() * TS | 0, y = y0 + (rng() * (TS - y0)) | 0;
    px(s.g, x, y, css(base, 0.45 + rng() * 0.25));
  }
  for (let i = 0; i < 10; i++) {
    const x = rng() * TS | 0, y = rng() * TS | 0, l = 4 + rng() * 14 | 0;
    for (let k = 0; k < l; k++) px(s.g, x + k, y + (k >> 2), css(base, 1.35));
  }
}

function panelTex(t, rng) {
  const s = surface(TS, TS);
  const base = hex(t.wall), trim = hex(t.trim), acc = hex(t.accent);
  plate(s, 0, 0, 128, 62, base, rng, { bevel: 2 });
  plate(s, 0, 66, 60, 62, base, rng, { bevel: 2 });
  plate(s, 64, 66, 64, 62, base, rng, { bevel: 2 });
  rect(s.g, 0, 62, 128, 4, css(base, 0.3));
  rect(s.g, 60, 66, 4, 62, css(base, 0.3));
  // Recessed grille
  rect(s.g, 14, 14, 48, 30, css(base, 0.35));
  for (let y = 16; y < 42; y += 3) { rect(s.g, 16, y, 44, 1, css(base, 0.15)); rect(s.g, 16, y + 1, 44, 1, css(base, 0.75)); }
  // Status light
  rect(s.g, 80, 18, 34, 12, css(trim, 0.4));
  rect(s.g, 82, 20, 30, 8, css(acc, 0.9)); glow(s, 82, 20, 30, 8);
  rect(s.g, 84, 22, 20, 2, css(acc, 1.4)); rect(s.g, 108, 22, 2, 4, '#ffffff');
  // Hazard strip
  for (let x = 0; x < 128; x++) rect(s.g, x, 52, 1, 6, ((x + 2) >> 3) & 1 ? '#1b1b1b' : '#caa21a');
  for (const [x, y] of [[5, 5], [120, 5], [5, 70], [52, 70], [5, 120], [52, 120], [69, 70], [120, 70], [69, 120], [120, 120]]) rivet(s, x, y, trim);
  grime(s, base, rng);
  return toImage(s);
}

function consoleTex(t, rng) {
  const s = surface(TS, TS);
  const base = hex(t.wall2), acc = hex(t.accent);
  plate(s, 0, 0, 128, 128, base, rng, { bevel: 2 });
  for (const [x, y, w, h] of [[10, 12, 52, 40], [70, 12, 48, 40]]) {
    rect(s.g, x - 3, y - 3, w + 6, h + 6, css(base, 0.35));
    rect(s.g, x, y, w, h, '#050b10');
    for (let i = 0; i < 6; i++) {
      const lw = 8 + rng() * (w - 14) | 0;
      rect(s.g, x + 3, y + 4 + i * 6, lw, 2, css(acc, 0.55 + rng() * 0.5));
    }
    rect(s.g, x + w - 12, y + h - 10, 8, 6, rng() < 0.5 ? '#ff4040' : css(acc, 1.3));
    glow(s, x, y, w, h);
  }
  // Keyboard ledge
  plate(s, 6, 66, 116, 16, hex(t.trim), rng, { bevel: 1 });
  for (let x = 10; x < 118; x += 6) for (let y = 69; y < 80; y += 5) rect(s.g, x, y, 4, 3, css(hex(t.trim), 0.55));
  // Cabinet with vents
  for (let y = 90; y < 122; y += 4) rect(s.g, 12, y, 104, 2, css(base, 0.4));
  grime(s, base, rng, 100);
  return toImage(s);
}

function pipeTex(t, rng) {
  const s = surface(TS, TS);
  const base = hex(t.wall2), pipe = hex(t.trim);
  plate(s, 0, 0, 128, 128, base, rng, { bevel: 0, grad: 0.1 });
  for (let y = 3; y < 128; y += 6) rect(s.g, 0, y, 128, 2, css(base, 0.5));
  for (const [px0, w] of [[8, 22], [44, 30], [90, 18], [114, 10]]) {
    cyl(s, px0, 0, w, 128, pipe, rng);
    for (const by of [18, 78]) {
      cyl(s, px0 - 3, by, w + 6, 9, mix(pipe, [60, 60, 60], 0.4), rng);
      rivet(s, px0 - 1, by + 3, pipe); rivet(s, px0 + w - 1, by + 3, pipe);
    }
  }
  // Leak stain
  for (let i = 0; i < 90; i++) px(s.g, 50 + rng() * 14 | 0, 87 + rng() * 40 | 0, css([30, 26, 20], 1));
  return toImage(s);
}

function crateTex(t, rng) {
  const s = surface(TS, TS);
  const base = hex(t.crate);
  plate(s, 0, 0, 128, 128, base, rng, { bevel: 3, noise: 0.18 });
  const dark = css(base, 0.5);
  for (const [x, y, w, h] of [[0, 0, 128, 10], [0, 118, 128, 10], [0, 0, 10, 128], [118, 0, 10, 128]]) plate(s, x, y, w, h, mix(base, [40, 40, 40], 0.35), rng, { bevel: 1 });
  for (let i = 0; i < 108; i++) {
    rect(s.g, 10 + i, 10 + i, 5, 5, dark); rect(s.g, 10 + i, 10 + i, 5, 1, css(base, 1.2));
    rect(s.g, 113 - i, 10 + i, 5, 5, dark);
  }
  for (let x = 10; x < 118; x++) rect(s.g, x, 58, 1, 12, ((x >> 3) & 1) ? '#161616' : '#d8b020');
  // Stencil number
  s.g.fillStyle = css(base, 1.45);
  s.g.font = 'bold 20px monospace';
  s.g.fillText('07', 20, 108);
  for (const [x, y] of [[3, 3], [122, 3], [3, 122], [122, 122]]) rivet(s, x, y, [170, 170, 170]);
  return toImage(s);
}

function doorTex(t, open) {
  const s = surface(TS, TS);
  const rng = mulberry32(99);
  const steel = [78, 82, 92];
  plate(s, 0, 0, 128, 128, steel, rng, { bevel: 0 });
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      if (x < 12 || x > 115 || y < 12) px(s.g, x, y, (((x + y) >> 3) & 1) ? '#141414' : '#e0b21a');
    }
  plate(s, 14, 14, 49, 114, steel, rng, { bevel: 2 });
  plate(s, 65, 14, 49, 114, steel, rng, { bevel: 2 });
  rect(s.g, 63, 14, 2, 114, '#15171b');
  for (const x of [22, 72]) { rect(s.g, x, 44, 34, 60, css(steel, 0.6)); rect(s.g, x, 44, 34, 1, css(steel, 1.5)); }
  const lamp = open ? [60, 255, 110] : [255, 40, 40];
  rect(s.g, 46, 18, 36, 14, '#0c0c0c');
  rect(s.g, 48, 20, 32, 10, css(lamp, 0.9)); rect(s.g, 52, 22, 20, 2, '#ffffff');
  glow(s, 48, 20, 32, 10);
  if (open) {
    s.g.fillStyle = css(lamp, 1);
    for (let i = 0; i < 18; i++) s.g.fillRect(64 - i, 50 + i, i * 2, 1);
    s.g.fillRect(57, 68, 14, 18);
    glow(s, 46, 50, 36, 36);
  }
  return toImage(s);
}

function floorTex(t, rng) {
  const s = surface(TS, TS);
  const base = hex(t.floor);
  for (const [x, y] of [[0, 0], [64, 0], [0, 64], [64, 64]]) {
    plate(s, x, y, 64, 64, base, rng, { bevel: 2, grad: 0.08, noise: 0.14 });
    // Diamond tread
    for (let j = 6; j < 58; j += 6)
      for (let i = 6 + ((j / 6) & 1) * 3; i < 58; i += 6) {
        px(s.g, x + i, y + j, css(base, 1.4)); px(s.g, x + i + 1, y + j + 1, css(base, 0.6));
      }
    for (const [rx, ry] of [[4, 4], [57, 4], [4, 57], [57, 57]]) rivet(s, x + rx, y + ry, base);
  }
  // Drain
  rect(s.g, 76, 76, 40, 40, css(base, 0.25));
  for (let i = 78; i < 116; i += 4) rect(s.g, i, 78, 2, 36, css(base, 0.8));
  for (let i = 0; i < 6; i++) {
    const sx = rng() * 110 | 0, sy = rng() * 110 | 0;
    for (let k = 0; k < 40; k++) px(s.g, sx + rng() * 16 | 0, sy + rng() * 16 | 0, css(base, 0.6));
  }
  return toImage(s);
}

function ceilTex(t, rng, lamp) {
  const s = surface(TS, TS);
  const base = hex(t.ceil);
  for (const [x, y] of [[0, 0], [64, 0], [0, 64], [64, 64]]) plate(s, x, y, 64, 64, base, rng, { bevel: 2, grad: 0.05 });
  if (lamp) {
    rect(s.g, 30, 30, 68, 68, css(base, 0.35));
    const L = t.lamp;
    for (let y = 34; y < 94; y++)
      for (let x = 34; x < 94; x++) {
        const d = Math.max(Math.abs(x - 63.5), Math.abs(y - 63.5)) / 30;
        px(s.g, x, y, css(L, 1.08 - d * 0.35));
      }
    for (let i = 34; i < 94; i += 12) rect(s.g, i, 34, 1, 60, css(L, 0.7));
    glow(s, 34, 34, 60, 60);
  } else {
    const acc = hex(t.accent);
    rect(s.g, 84, 20, 26, 4, css(acc, 0.8)); glow(s, 84, 20, 26, 4);
    for (let y = 40; y < 56; y += 3) rect(s.g, 12, y, 36, 1, css(base, 0.5));
  }
  return toImage(s);
}

export function buildTextures(themeIndex) {
  const t = THEMES[themeIndex % THEMES.length];
  const rng = mulberry32(1234 + themeIndex);
  const panel = panelTex(t, rng);
  return {
    theme: t,
    // Index = map tile value: 1 panel, 2 pipes, 3 crate, 4 exit door, 5 entry door, 6 console
    walls: [null, panel, pipeTex(t, rng), crateTex(t, rng), doorTex(t, false), doorTex(t, false), consoleTex(t, rng)],
    doorOpen: doorTex(t, true),
    floor: floorTex(t, rng),
    ceil: ceilTex(t, rng, false),
    ceilLamp: ceilTex(t, rng, true),
  };
}

// ---------- Sprites ----------
function drone(frame) {
  const s = surface(80, 80);
  const rng = mulberry32(7 + frame);
  const body = [128, 136, 150];
  // side pods
  for (const x of [12, 68]) { ball(s, x, 36, 8, [100, 106, 118]); rect(s.g, x - 1, 16, 2, 14, '#5a5f6a'); }
  rect(s.g, 12, 34, 56, 5, css(body, 0.55));
  ball(s, 40, 36, 22, body);
  // armor band
  for (let x = -22; x <= 22; x++) { const y = 36 + Math.round(Math.sqrt(Math.max(0, 484 - x * x)) * 0.18) + 6; rect(s.g, 40 + x, y, 1, 2, css(body, 0.45)); }
  for (let i = 0; i < 40; i++) px(s.g, 24 + rng() * 32 | 0, 20 + rng() * 30 | 0, css(body, 0.7));
  // eye
  disc(s, 40, 38, 10, '#1a0406');
  ball(s, 40, 38, 8, frame ? [255, 70, 60] : [220, 30, 30], { spec: false });
  disc(s, 40, 38, 3, '#ffe0d0');
  glow(s, 32, 30, 17, 17);
  // thruster
  rect(s.g, 34, 57, 12, 5, '#464a52');
  const flame = frame ? 16 : 10;
  for (let i = 0; i < flame; i++) {
    const w = Math.max(1, 8 - (i >> 1));
    rect(s.g, 40 - w / 2, 62 + i, w, 1, i < 4 ? '#e8faff' : i < 9 ? '#7ad0ff' : '#2a70ff');
  }
  glow(s, 30, 62, 20, 18);
  return toImage(s, { outline: true });
}

function grunt(frame) {
  // 0/1 walk, 2 shoot
  const s = surface(80, 112);
  const rng = mulberry32(21 + frame);
  const armor = [104, 112, 94], dark = [56, 60, 52], joint = [40, 40, 44];
  const step = frame === 1 ? 5 : 0;
  // legs
  plate(s, 24, 64 - step, 12, 22, dark, rng); ball(s, 30, 86 - step, 5, joint); plate(s, 25, 88 - step, 10, 18 + step, dark, rng);
  plate(s, 44, 64 + step - 5, 12, 22, dark, rng); ball(s, 50, 86, 5, joint); plate(s, 45, 88, 10, 18, dark, rng);
  plate(s, 20, 104, 18, 8, joint, rng); plate(s, 42, 104, 18, 8, joint, rng);
  // hips + torso
  plate(s, 22, 58, 36, 10, dark, rng);
  plate(s, 18, 28, 44, 32, armor, rng, { bevel: 2 });
  plate(s, 26, 34, 28, 16, mix(armor, [30, 30, 30], 0.4), rng);
  rect(s.g, 30, 38, 20, 6, '#1a0e00');
  rect(s.g, 31, 39, 18, 4, frame === 2 ? '#ffd060' : '#ff9a10'); glow(s, 31, 39, 18, 4);
  for (let y = 52; y < 58; y += 2) rect(s.g, 24, y, 32, 1, css(armor, 0.5));
  // shoulders
  ball(s, 16, 32, 10, armor); ball(s, 64, 32, 10, armor);
  // head
  plate(s, 29, 8, 22, 20, armor, rng, { bevel: 2 });
  rect(s.g, 29, 26, 22, 3, css(armor, 0.4));
  rect(s.g, 31, 15, 18, 6, '#1a0000');
  rect(s.g, 32, 16, 16, 4, frame === 2 ? '#ff9090' : '#ff2424'); glow(s, 32, 16, 16, 4);
  rect(s.g, 38, 4, 2, 5, '#444'); px(s.g, 38, 3, '#ff4040'); glow(s, 38, 3, 1, 1);
  // left arm
  plate(s, 8, 40, 10, 26, dark, rng); ball(s, 13, 68, 5, joint);
  // gun arm
  plate(s, 60, 40, 12, 18, dark, rng);
  cyl(s, 63, 56, 12, 26, [72, 74, 82], rng);
  rect(s.g, 65, 82, 8, 4, '#101010');
  if (frame === 2) {
    disc(s, 69, 92, 9, '#ffcc40'); disc(s, 69, 92, 6, '#fff4c0'); disc(s, 69, 92, 3, '#ffffff');
    glow(s, 58, 82, 22, 22);
  }
  return toImage(s, { outline: true });
}

function charger(frame) {
  const s = surface(96, 96);
  const rng = mulberry32(33 + frame);
  const flesh = [150, 48, 38], bone = [220, 208, 186], dark = [70, 28, 24];
  const off = frame ? 5 : 0;
  // legs
  for (const [x, o] of [[14, off], [74, -off], [30, -off], [58, off]]) {
    plate(s, x + o, 60, 10, 16, dark, rng);
    plate(s, x + o - 1, 76, 12, 14, mix(dark, [20, 10, 10], 0.3), rng);
    for (let k = 0; k < 3; k++) rect(s.g, x + o - 1 + k * 4, 90, 3, 4, css(bone, 0.9));
  }
  // body (ellipse)
  for (let y = -18; y <= 18; y++)
    for (let x = -34; x <= 34; x++) {
      const d = (x * x) / (34 * 34) + (y * y) / (18 * 18);
      if (d > 1) continue;
      const l = 0.5 + 0.7 * Math.max(0, 1 - d) * (1 - y / 40) + (rng() - 0.5) * 0.18;
      px(s.g, 48 + x, 46 + y, css(flesh, l));
    }
  // spikes
  for (let i = 0; i < 8; i++) {
    const x = 22 + i * 7;
    for (let k = 0; k < 12; k++) rect(s.g, x + (k >> 2), 30 - k, Math.max(1, 4 - (k >> 2)), 1, css(bone, 1 - k * 0.04));
  }
  // head
  plate(s, 32, 44, 32, 20, [120, 36, 30], rng, { bevel: 2 });
  rect(s.g, 34, 58, 28, 8, '#1a0000');
  for (let i = 0; i < 7; i++) { rect(s.g, 35 + i * 4, 58, 2, 4, '#efe6d6'); rect(s.g, 36 + i * 4, 63, 2, 3, '#efe6d6'); }
  for (const x of [36, 54]) { rect(s.g, x, 48, 7, 5, '#ffb020'); rect(s.g, x + 2, 49, 3, 2, '#ffffff'); glow(s, x, 48, 7, 5); }
  // claws
  for (const x of [4, 80]) for (let k = 0; k < 3; k++) rect(s.g, x + k * 4, 48 + k, 3, 10, css(bone, 1));
  return toImage(s, { outline: true });
}

function heavy(frame, boss = false) {
  const S = boss ? 128 : 112;
  const s = surface(S, S);
  const k = S / 112;
  const R = (v) => Math.round(v * k);
  const rng = mulberry32((boss ? 91 : 51) + frame);
  const hull = boss ? [130, 44, 70] : [118, 110, 84];
  const dark = boss ? [64, 20, 36] : [60, 58, 46];
  // treads
  plate(s, R(8), R(84), R(96), R(24), dark, rng, { bevel: 2 });
  for (let x = R(12) + (frame ? R(3) : 0); x < R(100); x += R(8)) rect(s.g, x, R(86), R(3), R(20), css(dark, 0.45));
  for (let i = 0; i < 5; i++) ball(s, R(20 + i * 18), R(96), R(6), [70, 70, 74]);
  // hull
  plate(s, R(16), R(40), R(80), R(46), hull, rng, { bevel: 2 });
  plate(s, R(22), R(46), R(68), R(8), mix(hull, [30, 30, 30], 0.4), rng);
  for (let y = R(70); y < R(84); y += R(3)) rect(s.g, R(22), y, R(68), 1, css(hull, 0.55));
  // core
  disc(s, R(56), R(64), R(11), '#140006');
  ball(s, R(56), R(64), R(8), boss ? (frame ? [255, 100, 255] : [220, 40, 220]) : (frame ? [255, 170, 70] : [255, 110, 20]), { spec: false });
  disc(s, R(56), R(64), R(3), '#ffffff');
  glow(s, R(45), R(53), R(22), R(22));
  // cannons
  for (const x of [0, 88]) {
    plate(s, R(x), R(26), R(24), R(22), dark, rng, { bevel: 2 });
    cyl(s, R(x + 6), R(8), R(12), R(22), [80, 80, 88], rng);
    disc(s, R(x + 12), R(10), R(4), '#0a0a0a');
  }
  // cockpit
  plate(s, R(38), R(14), R(36), R(28), hull, rng, { bevel: 2 });
  rect(s.g, R(42), R(22), R(28), R(8), '#1a0000');
  rect(s.g, R(44), R(24), R(24), R(4), boss ? '#ff50c0' : '#ff3030'); glow(s, R(44), R(24), R(24), R(4));
  if (boss) {
    for (let i = 0; i < 16; i++) {
      rect(s.g, R(36) - (i >> 1), R(14) - i, R(4), 1, css([226, 214, 196], 1 - i * 0.02));
      rect(s.g, R(72) + (i >> 1), R(14) - i, R(4), 1, css([226, 214, 196], 1 - i * 0.02));
    }
  }
  return toImage(s, { outline: true });
}

function wreck(tint) {
  const s = surface(80, 40);
  const rng = mulberry32(tint[0]);
  for (let i = 0; i < 34; i++) {
    const w = 5 + rng() * 14 | 0, h = 3 + rng() * 8 | 0;
    plate(s, 6 + rng() * 60 | 0, 40 - h - (rng() * 12 | 0), w, h, mix(tint, [255, 255, 255], rng() * 0.15), rng, { bevel: 1 });
  }
  for (let i = 0; i < 14; i++) { const x = 16 + rng() * 48 | 0, y = 16 + rng() * 18 | 0; px(s.g, x, y, '#ffb040'); glow(s, x, y, 1, 1); }
  return toImage(s, { outline: true });
}

function orb(r, core, halo) {
  const S = r * 2 + 8;
  const s = surface(S, S);
  const c = S / 2;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - c + 0.5, y - c + 0.5);
      if (d > c) continue;
      const a = Math.max(0, 1 - d / c);
      s.g.fillStyle = `rgba(${halo[0]},${halo[1]},${halo[2]},${(a * a * 0.8).toFixed(3)})`;
      s.g.fillRect(x, y, 1, 1);
    }
  ball(s, c, c, r, core, { spec: false });
  disc(s, c, c, Math.max(1, r - 3), '#ffffff');
  glow(s, 0, 0, S, S);
  return toImage(s);
}

function rocket() {
  const s = surface(24, 24);
  disc(s, 12, 12, 10, '#ff7a10');
  disc(s, 12, 12, 7, '#ffd040');
  ball(s, 12, 12, 4, [150, 150, 150], { spec: false });
  glow(s, 0, 0, 24, 24);
  return toImage(s);
}

function explosion(frame) {
  const s = surface(80, 80);
  const rng = mulberry32(300 + frame);
  const r = 12 + frame * 8;
  const cols = ['#fff8d0', '#ffe060', '#ff9a20', '#d04008', '#6a5048'];
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, d = rng() * r * 0.6;
    disc(s, 40 + Math.cos(a) * d | 0, 40 + Math.sin(a) * d | 0, Math.max(2, (r * (0.3 + rng() * 0.3)) | 0),
      cols[Math.min(cols.length - 1, frame + (rng() * 2 | 0))]);
  }
  return toImage(s);
}

function pickup(kind) {
  const s = surface(32, 26);
  const rng = mulberry32(kind.length);
  if (kind === 'health') {
    plate(s, 2, 4, 28, 22, [224, 224, 224], rng, { bevel: 1 });
    rect(s.g, 13, 7, 6, 16, '#d01010'); rect(s.g, 8, 12, 16, 6, '#d01010');
    rect(s.g, 12, 1, 8, 4, '#888');
  } else if (kind === 'ammo') {
    plate(s, 2, 10, 28, 16, [92, 98, 50], rng, { bevel: 1 });
    for (let i = 0; i < 5; i++) { cyl(s, 4 + i * 5, 1, 4, 10, [216, 176, 48], rng); rect(s.g, 4 + i * 5, 1, 4, 2, '#b07020'); }
    rect(s.g, 6, 16, 20, 3, '#2a2a10');
  } else {
    plate(s, 4, 2, 24, 22, [36, 160, 64], rng, { bevel: 1 });
    rect(s.g, 11, 2, 10, 6, 'rgba(0,0,0,0)');
    s.g.clearRect(11, 2, 10, 6);
    rect(s.g, 8, 12, 16, 2, '#0d5a20'); rect(s.g, 8, 17, 16, 2, '#0d5a20');
    rect(s.g, 14, 9, 4, 4, '#9aff9a'); glow(s, 14, 9, 4, 4);
  }
  return toImage(s, { outline: true });
}

function beam() {
  const s = surface(24, 96);
  for (let x = 0; x < 24; x++) {
    const f = 1 - Math.abs(x - 11.5) / 12;
    rect(s.g, x, 0, 1, 96, `rgba(${80 + 170 * f | 0},${180 + 75 * f | 0},255,${(f * f).toFixed(3)})`);
  }
  return toImage(s);
}

export function buildSprites() {
  return {
    drone: [drone(0), drone(1)],
    grunt: [grunt(0), grunt(1), grunt(2)],
    charger: [charger(0), charger(1)],
    heavy: [heavy(0), heavy(1)],
    boss: [heavy(0, true), heavy(1, true)],
    wreck: wreck([96, 98, 104]),
    wreckRed: wreck([126, 44, 36]),
    bolt: orb(6, [255, 60, 40], [255, 70, 30]),
    plasma: orb(6, [80, 160, 255], [60, 140, 255]),
    rocket: rocket(),
    explosion: [0, 1, 2, 3, 4].map(explosion),
    spark: orb(2, [255, 210, 80], [255, 200, 60]),
    health: pickup('health'), ammo: pickup('ammo'), armor: pickup('armor'),
    beam: beam(),
  };
}

// ---------- Weapon view models (192x144, designed for a 300px-tall screen) ----------
function hand(s, x, y, rng, flip = false) {
  const skin = [200, 140, 96];
  plate(s, x, y + 30, 36, 30, [58, 74, 44], rng, { bevel: 1 });
  for (let i = 0; i < 4; i++) {
    const fx = flip ? x + 26 - i * 8 : x + 2 + i * 8;
    plate(s, fx, y + (i === 0 ? 8 : 2), 8, 30, skin, rng, { bevel: 1, noise: 0.06 });
    rect(s.g, fx + 1, y + 14, 6, 1, css(skin, 0.7));
  }
  plate(s, x - 2, y + 26, 40, 8, skin, rng, { bevel: 1, noise: 0.05 });
}

function flash(s, x, y, r) {
  const { g } = s;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.fillStyle = 'rgba(255,200,60,0.85)';
    for (let k = 0; k < r * 1.3; k++) g.fillRect(x + Math.cos(a) * k, y + Math.sin(a) * k * 0.7, 2, 2);
  }
  disc(s, x, y, r, 'rgba(255,170,30,0.9)');
  disc(s, x, y, (r * 0.7) | 0, '#ffe890');
  disc(s, x, y, (r * 0.35) | 0, '#ffffff');
}

function weaponArt(id, firing) {
  const s = surface(192, 144);
  const rng = mulberry32(id.length * 17 + (firing ? 1 : 0));
  const steel = [96, 100, 110], dark = [52, 54, 60];
  if (id === 'pistol') {
    if (firing) flash(s, 96, 28, 22);
    plate(s, 82, 36, 28, 56, steel, rng, { bevel: 2 });
    rect(s.g, 88, 36, 16, 5, '#141414');
    for (let y = 44; y < 60; y += 4) rect(s.g, 84, y, 24, 1, css(steel, 0.6));
    plate(s, 78, 80, 36, 26, dark, rng, { bevel: 2 });
    hand(s, 78, 92, rng);
  } else if (id === 'shotgun') {
    if (firing) flash(s, 96, 18, 30);
    cyl(s, 80, 20, 16, 80, steel, rng);
    cyl(s, 96, 20, 16, 80, steel, rng);
    disc(s, 88, 22, 5, '#0a0a0a'); disc(s, 104, 22, 5, '#0a0a0a');
    plate(s, 74, 64, 44, 22, [120, 78, 44], rng, { bevel: 2 });
    for (let y = 68; y < 84; y += 3) rect(s.g, 76, y, 40, 1, css([120, 78, 44], 0.7));
    hand(s, 56, 94, rng); hand(s, 104, 98, rng, true);
  } else if (id === 'chaingun') {
    if (firing) flash(s, 96, 22, 24);
    for (let i = 0; i < 5; i++) cyl(s, 74 + i * 9, 26 + (firing && i % 2 ? 4 : 0), 8, 66, steel, rng);
    plate(s, 70, 56, 52, 10, dark, rng, { bevel: 1 });
    plate(s, 66, 80, 60, 26, [86, 86, 64], rng, { bevel: 2 });
    rect(s.g, 72, 86, 48, 3, '#caa21a');
    hand(s, 72, 98, rng);
  } else if (id === 'plasma') {
    if (firing) {
      disc(s, 96, 24, 24, 'rgba(80,160,255,0.85)'); disc(s, 96, 24, 14, '#bfe4ff'); disc(s, 96, 24, 7, '#ffffff');
    }
    plate(s, 70, 32, 52, 68, [72, 86, 116], rng, { bevel: 2 });
    rect(s.g, 78, 42, 36, 12, '#08142e');
    rect(s.g, 80, 44, 32, 8, firing ? '#d0ecff' : '#3a90ff'); glow(s, 80, 44, 32, 8);
    cyl(s, 84, 22, 24, 14, [60, 64, 72], rng);
    for (let y = 62; y < 92; y += 5) rect(s.g, 74, y, 44, 2, '#26304a');
    for (let i = 0; i < 4; i++) { rect(s.g, 76 + i * 11, 58, 6, 3, i < 3 ? '#40ff9a' : '#224'); if (i < 3) glow(s, 76 + i * 11, 58, 6, 3); }
    hand(s, 58, 96, rng); hand(s, 100, 96, rng, true);
  } else if (id === 'rocket') {
    if (firing) flash(s, 96, 22, 30);
    cyl(s, 66, 20, 60, 80, [88, 98, 70], rng);
    disc(s, 96, 30, 16, '#0a0a0a'); disc(s, 96, 30, 11, '#3a3a3a'); disc(s, 96, 30, 5, '#181818');
    rect(s.g, 66, 60, 60, 6, '#e0b21a');
    for (let x = 66; x < 126; x += 8) rect(s.g, x, 60, 4, 6, '#1a1a1a');
    plate(s, 86, 72, 20, 12, dark, rng);
    rect(s.g, 90, 75, 12, 5, '#ff3030'); glow(s, 90, 75, 12, 5);
    hand(s, 54, 96, rng); hand(s, 104, 98, rng, true);
  }
  return toCanvas(s, { outline: true });
}

export function buildWeapons(ids) {
  const out = {};
  for (const id of ids) out[id] = [weaponArt(id, false), weaponArt(id, true)];
  return out;
}

// ---------- Status-bar face (36x42): 4 health levels x (left, center, right, ouch) ----------
export function buildFaces() {
  const faces = [];
  for (let level = 0; level < 4; level++) {
    const row = [];
    for (const look of [-1, 0, 1, 2]) {
      const s = surface(36, 42);
      const rng = mulberry32(level * 10 + look + 5);
      const skin = [204, 144, 98], hair = [92, 58, 28];
      // neck + armor collar
      plate(s, 8, 36, 20, 6, [60, 76, 46], rng, { bevel: 1 });
      // face shape with shading
      for (let y = 6; y < 37; y++) {
        const w = y < 30 ? 13 : 13 - (y - 30);
        for (let x = -w; x < w; x++) {
          const l = 1.05 - Math.abs(x + 3) / 30 - (y > 28 ? 0.12 : 0) + (rng() - 0.5) * 0.08;
          px(s.g, 18 + x, y, css(skin, l));
        }
      }
      // hair
      for (let y = 2; y < 11; y++) for (let x = 5; x < 31; x++) if (y < 7 || x < 8 || x > 27) px(s.g, x, y, css(hair, 0.8 + rng() * 0.4));
      // brows, eyes
      const ex = look === 2 ? 0 : look;
      rect(s.g, 8, 14, 8, 2, css(hair, 0.7)); rect(s.g, 20, 14, 8, 2, css(hair, 0.7));
      if (look === 2) {
        rect(s.g, 9, 17, 7, 4, '#ffffff'); rect(s.g, 20, 17, 7, 4, '#ffffff');
        rect(s.g, 11, 18, 3, 2, '#1a1a1a'); rect(s.g, 22, 18, 3, 2, '#1a1a1a');
      } else {
        rect(s.g, 9, 17, 7, 4, '#f4f0ea'); rect(s.g, 20, 17, 7, 4, '#f4f0ea');
        rect(s.g, 11 + ex * 2, 17, 3, 4, '#3a5a9a'); rect(s.g, 22 + ex * 2, 17, 3, 4, '#3a5a9a');
        px(s.g, 12 + ex * 2, 18, '#000'); px(s.g, 23 + ex * 2, 18, '#000');
      }
      // nose + mouth
      rect(s.g, 17, 21, 2, 6, css(skin, 0.72)); rect(s.g, 16, 26, 4, 1, css(skin, 0.6));
      if (look === 2) rect(s.g, 13, 29, 10, 5, '#3a0a0a');
      else if (level < 2) { rect(s.g, 12, 30, 12, 1, '#7a3a2a'); rect(s.g, 13, 31, 10, 1, css(skin, 0.8)); }
      else rect(s.g, 12, 29, 12, 3, '#5a1a1a');
      // stubble / blood
      for (let i = 0; i < 30; i++) px(s.g, 8 + rng() * 20 | 0, 28 + rng() * 8 | 0, css(skin, 0.75));
      for (let i = 0; i < level * 14; i++) rect(s.g, 6 + rng() * 24 | 0, 8 + rng() * 28 | 0, 1, 1 + rng() * 4 | 0, '#a01010');
      row.push(toCanvas(s, { outline: true }));
    }
    faces.push(row);
  }
  return faces;
}
