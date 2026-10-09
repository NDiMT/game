// =====================================================================
// HEX REALMS: unit fitting. Measures each creature model and returns
// the scale and offsets that make it sit nicely on a hex, whatever the
// raw size the artist gave it.
//
//   unitFit(id, model, kind)  kind = 'battle' | 'map'
//     -> { scale, y, labelY, x, z, height, top, base }
//
//   scale   uniform scale for the unit's group
//   y       world-units lift so the lowest point (feet, hooves, robe,
//           tail) touches y = 0: no floating, no sinking
//   x, z    world-units shift (model-local frame, before the group's
//           yaw) that puts the centre of the feet on the hex centre
//   labelY  world height above the hex where the count badge should be
//           anchored: just over the head (thin spears/lances ignored)
//   height  fitted "body" height in world units (spear tips excluded)
//   top     fitted full height including spears, wings etc.
//
//   applyFit(group, fit) sets group.scale and offsets the group's child
//   meshes so x/y/z are baked in. The group's own position stays free
//   for the game (hex position, idle bob, flight arcs).
//
// Pure math on the position arrays: no THREE import, results cached.
// =====================================================================
import { UNITS } from './data.js?v=1.1';

// battle: hex corner-to-corner = 2 * HS = 1.0 world unit, flat width 0.866,
// rows 0.75 apart. Target body heights per tier, in world units.
const BATTLE_H = [0.86, 0.9, 0.96, 1.02, 1.08, 1.14, 1.24]; // ~+12%: creatures fill more of their hex
// the "core" (90% of the surface) must stay near the hex; thin or flat
// extremities (wings, lances, tails) may overhang a bit more
const BATTLE_CORE = { x: [0.40, 0.40, 0.46, 0.44, 0.44, 0.48, 0.52], z: [0.42, 0.44, 0.44, 0.44, 0.46, 0.52, 0.62] };
const BATTLE_FULL = { x: [0.62, 0.62, 0.8, 0.72, 0.72, 0.8, 0.86], z: [0.62, 0.66, 0.7, 0.7, 0.7, 0.85, 0.95] };
const UP_K = 1.05; // upgraded creatures read a touch grander
// map guard: a planet hex is ~0.376 world units across (icosphere(4), R = 5)
const MAP_HEX = 0.376;
const MAP_H = [0.24, 0.25, 0.26, 0.27, 0.29, 0.305, 0.325]; // a touch bigger so map guards read as figures
const MAP_CORE = 0.15, MAP_FULL = 0.26;
const LABEL_PAD = { battle: 0.07, map: 0.03 };

const statCache = new WeakMap();
const fitCache = new Map();

function addTris(pos, w, T) {
  const a = pos.array;
  for (let i = 0; i + 8 < a.length; i += 9) {
    const ax = a[i], ay = a[i + 1], az = a[i + 2], bx = a[i + 3], by = a[i + 4], bz = a[i + 5], cx = a[i + 6], cy = a[i + 7], cz = a[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const ar = 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz) * w;
    if (!(ar > 1e-9)) continue;
    T.push({ ar, x: (ax + bx + cx) / 3, y: (ay + by + cy) / 3, z: (az + bz + cz) / 3, y0: Math.min(ay, by, cy), y1: Math.max(ay, by, cy),
      xs: [ax, bx, cx], zs: [az, bz, cz] });
  }
}
const nonIndexed = (g) => {
  if (!g || !g.attributes?.position) return null;
  if (!g.index) return g.attributes.position;
  const p = g.attributes.position.array, idx = g.index.array, out = new Float32Array(idx.length * 3);
  for (let i = 0; i < idx.length; i++) { out[i * 3] = p[idx[i] * 3]; out[i * 3 + 1] = p[idx[i] * 3 + 1]; out[i * 3 + 2] = p[idx[i] * 3 + 2]; }
  return { array: out };
};
// area-weighted percentile of a value over triangles
function wpct(T, f, q) {
  const v = T.map((t) => [f(t), t.ar]).sort((a, b) => a[0] - b[0]);
  const tot = v.reduce((s, e) => s + e[1], 0);
  let acc = 0;
  for (const [x, w] of v) { acc += w; if (acc >= q * tot) return x; }
  return v.length ? v[v.length - 1][0] : 0;
}

// raw measurements in model units
export function measureModel(model) {
  const key = model.body || model;
  if (statCache.has(key)) return statCache.get(key);
  const T = [];
  const bp = nonIndexed(model.body), gp = nonIndexed(model.glow);
  if (bp) addTris(bp, 1, T);
  if (gp) addTris(gp, 0.6, T);
  let minY = Infinity, maxY = -Infinity;
  for (const t of T) { minY = Math.min(minY, t.y0); maxY = Math.max(maxY, t.y1); }
  if (!T.length) { const s = { minY: 0, maxY: 1, top: 1, cx: 0, cz: 0, core: { x: 0.3, z: 0.3 }, full: { x: 0.4, z: 0.4 } }; statCache.set(key, s); return s; }
  // surface density per height slice; spear shafts are thin, so slices that
  // hold only a shaft carry little surface and do not count as "body"
  const N = 48, H = Math.max(1e-4, maxY - minY), D = new Float64Array(N);
  for (const t of T) {
    const i0 = Math.max(0, Math.min(N - 1, Math.floor(((t.y0 - minY) / H) * N)));
    const i1 = Math.max(0, Math.min(N - 1, Math.floor(((t.y1 - minY) / H) * N)));
    const share = t.ar / (i1 - i0 + 1);
    for (let i = i0; i <= i1; i++) D[i] += share;
  }
  const sorted = [...D].filter((d) => d > 0).sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1] || 0;
  let topI = N - 1;
  while (topI > 0 && D[topI] < med * 0.22) topI--;
  const top = minY + ((topI + 1) / N) * H;
  // the base: surface in the lowest 14% of the body (feet, hooves, robe hem)
  const footY = minY + (top - minY) * 0.14;
  let sx = 0, sz = 0, sw = 0;
  for (const t of T) if (t.y < footY) { sx += t.x * t.ar; sz += t.z * t.ar; sw += t.ar; }
  if (sw < 1e-6) for (const t of T) { sx += t.x * t.ar; sz += t.z * t.ar; sw += t.ar; }
  const lim = 0.3 * (top - minY);
  const cx = Math.max(-lim, Math.min(lim, sx / sw)), cz = Math.max(-lim, Math.min(lim, sz / sw));
  // horizontal reach around the base centre
  const core = { x: wpct(T, (t) => Math.abs(t.x - cx), 0.9), z: wpct(T, (t) => Math.abs(t.z - cz), 0.9) };
  let fx = 0, fz = 0;
  for (const t of T) for (let k = 0; k < 3; k++) { fx = Math.max(fx, Math.abs(t.xs[k] - cx)); fz = Math.max(fz, Math.abs(t.zs[k] - cz)); }
  const full = { x: Math.max(core.x, wpct(T, (t) => Math.abs(t.x - cx), 0.995), fx * 0.8), z: Math.max(core.z, wpct(T, (t) => Math.abs(t.z - cz), 0.995), fz * 0.8) };
  const s = { minY, maxY, top, cx, cz, core, full };
  statCache.set(key, s);
  return s;
}

export function unitFit(id, model, kind = 'battle', opts = {}) {
  const ck = kind + ':' + id;
  if (!opts.nocache && fitCache.has(ck)) return fitCache.get(ck);
  const u = UNITS[id] || {};
  const tier = Math.max(1, Math.min(7, opts.tier ?? u.tier ?? 3)), up = opts.up ?? !!u.up;
  const st = measureModel(model);
  const bodyH = Math.max(0.05, st.top - st.minY);
  const ti = tier - 1, k = up ? UP_K : 1;
  let scale;
  if (kind === 'map') {
    scale = Math.min((MAP_H[ti] * k) / bodyH, MAP_CORE / Math.max(st.core.x, st.core.z * 0.9), MAP_FULL / Math.max(st.full.x, st.full.z));
  } else {
    scale = Math.min((BATTLE_H[ti] * k) / bodyH,
      (BATTLE_CORE.x[ti] * k) / st.core.x, (BATTLE_CORE.z[ti] * k) / st.core.z,
      (BATTLE_FULL.x[ti] * k) / st.full.x, (BATTLE_FULL.z[ti] * k) / st.full.z);
  }
  const fit = {
    scale,
    y: -st.minY * scale,
    x: -st.cx * scale,
    z: -st.cz * scale,
    height: bodyH * scale,
    top: (st.maxY - st.minY) * scale,
    labelY: bodyH * scale + LABEL_PAD[kind === 'map' ? 'map' : 'battle'],
    base: { x: st.cx, z: st.cz },
  };
  fitCache.set(ck, fit);
  return fit;
}

// bakes a fit into a group built like main.js meshOf(): Group > [body, glow]
export function applyFit(group, fit) {
  group.scale.setScalar(fit.scale);
  for (const c of group.children) {
    if (c.userData.fitted) continue;
    c.position.set(fit.x / fit.scale, fit.y / fit.scale, fit.z / fit.scale);
    c.userData.fitted = true; c.userData.fitY = c.position.y;
  }
  group.userData.fit = fit;
  return group;
}

export const FIT_CONSTANTS = { BATTLE_H, BATTLE_CORE, BATTLE_FULL, UP_K, MAP_HEX, MAP_H, MAP_CORE, MAP_FULL };
export function clearFitCache() { fitCache.clear(); }
