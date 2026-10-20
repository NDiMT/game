// Procedural texture recipes (pure JS, no DOM / THREE): runs in a Web Worker so environment textures
// are generated off the main thread. generate() returns RGBA colour, normal and roughness arrays.

function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
function vnoise(x, y, period, seed = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const P = (a) => ((a % period) + period) % period;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(P(xi), P(yi), seed), b = hash(P(xi + 1), P(yi), seed), c = hash(P(xi), P(yi + 1), seed), d = hash(P(xi + 1), P(yi + 1), seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
// tileable fbm: coordinates in "cells", period = cells per tile
function fbm(x, y, period, oct = 4, seed = 1) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, period * f, seed + i); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
// tileable Voronoi: returns [d1, d2, cellHash]
const VOR = [0, 0, 0];
function voronoi(x, y, period, seed = 1, jit = 0.85) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, px = ((cx % period) + period) % period, py = ((cy % period) + period) % period;
    const ox = cx + 0.5 + (hash(px, py, seed) - 0.5) * jit, oy = cy + 0.5 + (hash(px, py, seed + 7) - 0.5) * jit;
    const d = Math.hypot(x - ox, y - oy);
    if (d < d1) { d2 = d1; d1 = d; id = hash(px, py, seed + 13); } else if (d < d2) d2 = d;
  }
  VOR[0] = d1; VOR[1] = d2; VOR[2] = id;
  return VOR;
}

// each recipe: (u, v, o) with u, v in [0,1) tile coordinates; fills o.r/g/b (0..1), o.h (height), o.ro (roughness)
export const RECIPES = {
  grass: { normal: 1.6, fn(u, v, o) {
    const n = fbm(u * 8, v * 8, 8, 4, 5), b = hash((u * 256) | 0, (v * 256) | 0, 9), bl = fbm(u * 64, v * 22, 64, 2, 13);
    const c = fbm(u * 3, v * 3, 3, 2, 17);
    const val = 0.3 + n * 0.3 + bl * 0.16 + (b > 0.97 ? 0.1 : 0);
    o.r = val * (0.55 + c * 0.15); o.g = val * 0.9; o.b = val * 0.36; o.h = bl * 0.6 + n * 0.2; o.ro = 0.95;
  } },
  patio: { normal: 3, fn(u, v, o) {
    const [d1, d2, id] = voronoi(u * 5, v * 5, 5, 3, 0.7);
    const edge = clamp((d2 - d1) * 9, 0, 1), n = fbm(u * 16, v * 16, 16, 3, 4), sp = hash((u * 512) | 0, (v * 512) | 0, 6);
    const base = 0.56 + id * 0.16 + n * 0.12 - (sp > 0.96 ? 0.08 : 0);
    const g = edge < 0.25 ? 1 : 0;
    o.r = g ? 0.3 : base * 1.02; o.g = g ? 0.36 : base * 0.97; o.b = g ? 0.22 : base * 0.9;
    o.h = g ? 0 : 0.6 + n * 0.3 - (1 - edge) * 0.2; o.ro = g ? 1 : 0.78 + n * 0.15;
  } },
  sand: { normal: 2, fn(u, v, o) {
    const n = fbm(u * 6, v * 6, 6, 4, 21), r = Math.sin((v * 40 + fbm(u * 4, v * 4, 4, 2, 22) * 6) * 6.283) * 0.5 + 0.5, g = hash((u * 512) | 0, (v * 512) | 0, 23);
    const val = 0.78 + n * 0.14 + r * 0.05 + (g - 0.5) * 0.08;
    o.r = val; o.g = val * 0.86; o.b = val * 0.66; o.h = r * 0.35 + n * 0.3 + g * 0.1; o.ro = 0.95;
  } },
  cracked: { normal: 3, fn(u, v, o) {
    const [d1, d2] = voronoi(u * 7, v * 7, 7, 31, 0.9), crack = clamp((d2 - d1) * 14, 0, 1), n = fbm(u * 12, v * 12, 12, 3, 32);
    const val = (0.62 + n * 0.16) * (crack < 0.2 ? 0.45 : 1);
    o.r = val; o.g = val * 0.8; o.b = val * 0.62; o.h = crack < 0.2 ? 0 : 0.6 + n * 0.3 - (d1 * 0.3); o.ro = 0.95;
  } },
  wetroof: { normal: 1.2, fn(u, v, o) {
    const n = fbm(u * 10, v * 10, 10, 3, 41), sp = hash((u * 512) | 0, (v * 512) | 0, 42), pud = fbm(u * 3, v * 3, 3, 3, 43);
    const wet = clamp((pud - 0.48) * 8, 0, 1);
    const val = (0.16 + n * 0.08 + (sp > 0.9 ? 0.06 : 0)) * (1 - wet * 0.45);
    o.r = val; o.g = val; o.b = val * 1.08; o.h = (1 - wet) * (n * 0.4 + sp * 0.2); o.ro = lerp(0.6 + n * 0.2, 0.04, wet);
  } },
  snow: { normal: 1.4, fn(u, v, o) {
    const n = fbm(u * 6, v * 6, 6, 4, 51), f = fbm(u * 30, v * 30, 30, 2, 52), s = hash((u * 512) | 0, (v * 512) | 0, 53);
    const val = 0.86 + n * 0.1 + f * 0.04;
    o.r = val * 0.96; o.g = val * 0.98; o.b = val; o.h = n * 0.7 + f * 0.2; o.ro = s > 0.985 ? 0.15 : 0.75;
  } },
  deck: { normal: 2.5, fn(u, v, o) {
    const row = Math.floor(v * 8), off = hash(row, 1, 61), pu = (u + off) % 1, seam = (pu * 2) % 1;
    const gap = (v * 8) % 1 < 0.06 || seam < 0.012;
    const grain = fbm(pu * 4, v * 64, 4, 3, 62 + row), ring = Math.sin(v * 8 * 40 + grain * 10) * 0.5 + 0.5;
    const tone = 0.62 + hash(row, Math.floor(pu * 2), 63) * 0.15;
    const val = gap ? 0.18 : tone + grain * 0.15 + ring * 0.05;
    o.r = val; o.g = val * 0.74; o.b = val * 0.52; o.h = gap ? 0 : 0.6 + ring * 0.15; o.ro = gap ? 1 : 0.7 + grain * 0.2;
  } },
  floor: { normal: 1, fn(u, v, o) {
    const n = fbm(u * 6, v * 6, 6, 4, 71), f = fbm(u * 60, v * 60, 60, 2, 72), st = fbm(u * 2, v * 2, 2, 3, 73);
    const joint = (u * 2) % 1 < 0.004 || (v * 2) % 1 < 0.004;
    const val = (0.52 + n * 0.12 + f * 0.05 - st * 0.12) * (joint ? 0.6 : 1);
    o.r = val; o.g = val * 0.99; o.b = val * 0.97; o.h = f * 0.2 - (joint ? 0.5 : 0); o.ro = 0.35 + st * 0.3 + f * 0.1;
  } },
  corrugated: { normal: 5, fn(u, v, o) {
    const r = Math.sin(u * 64 * 6.283) * 0.5 + 0.5, n = fbm(u * 8, v * 8, 8, 3, 81), rust = clamp((fbm(u * 5, v * 5, 5, 3, 82) - 0.62) * 5, 0, 1) * clamp(1 - v * 1.5, 0, 1);
    const val = 0.6 + r * 0.1 + n * 0.1;
    o.r = lerp(val * 0.92, 0.45, rust); o.g = lerp(val * 0.95, 0.25, rust); o.b = lerp(val, 0.15, rust); o.h = r; o.ro = lerp(0.45 + n * 0.2, 0.9, rust);
  } },
  rock: { normal: 3, fn(u, v, o) {
    const n = fbm(u * 6, v * 6, 6, 5, 91), strata = Math.sin((v * 30 + n * 3) * 6.283) * 0.5 + 0.5;
    const val = 0.55 + n * 0.25 + strata * 0.08;
    o.r = val; o.g = val * 0.62; o.b = val * 0.42; o.h = n * 0.8 + strata * 0.2; o.ro = 0.9;
  } },
};

export function generate(name, w, h) {
  const R = RECIPES[name];
  const col = new Uint8Array(w * h * 4), nor = new Uint8Array(w * h * 4), rough = new Uint8Array(w * h * 4), H = new Float32Array(w * h);
  const o = { r: 0, g: 0, b: 0, h: 0, ro: 0.8 };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    R.fn(x / w, y / h, o);
    const i = y * w + x;
    col[i * 4] = clamp(o.r, 0, 1) * 255; col[i * 4 + 1] = clamp(o.g, 0, 1) * 255; col[i * 4 + 2] = clamp(o.b, 0, 1) * 255; col[i * 4 + 3] = 255;
    H[i] = o.h;
    rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = clamp(o.ro, 0, 1) * 255; rough[i * 4 + 3] = 255;
  }
  const s = R.normal;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xm = (x - 1 + w) % w, xp = (x + 1) % w, ym = (y - 1 + h) % h, yp = (y + 1) % h;
    const dx = (H[y * w + xp] - H[y * w + xm]) * s, dy = (H[yp * w + x] - H[ym * w + x]) * s;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    nor[i] = (-dx / l * 0.5 + 0.5) * 255; nor[i + 1] = (dy / l * 0.5 + 0.5) * 255; nor[i + 2] = (1 / l * 0.5 + 0.5) * 255; nor[i + 3] = 255;
  }
  return { w, h, col, nor, rough };
}
