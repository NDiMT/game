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
import { UNITS } from './data.js?v=1.9';

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

// triangles as struct-of-arrays: area weight, centroid, y range (vertex x/z read from the source arrays)
function triTable(parts) {
  let n = 0;
  for (const [pos] of parts) n += Math.floor(pos.array.length / 9);
  const T = { n: 0, ar: new Float64Array(n), x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n), y0: new Float64Array(n), y1: new Float64Array(n), src: new Array(n), off: new Int32Array(n) };
  for (const [pos, w] of parts) {
    const a = pos.array;
    for (let i = 0; i + 8 < a.length; i += 9) {
      const ax = a[i], ay = a[i + 1], az = a[i + 2], bx = a[i + 3], by = a[i + 4], bz = a[i + 5], cx = a[i + 6], cy = a[i + 7], cz = a[i + 8];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const ar = 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz) * w;
      if (!(ar > 1e-9)) continue;
      const j = T.n++;
      T.ar[j] = ar; T.x[j] = (ax + bx + cx) / 3; T.y[j] = (ay + by + cy) / 3; T.z[j] = (az + bz + cz) / 3;
      T.y0[j] = Math.min(ay, by, cy); T.y1[j] = Math.max(ay, by, cy); T.src[j] = a; T.off[j] = i;
    }
  }
  return T;
}
const nonIndexed = (g) => {
  if (!g || !g.attributes?.position) return null;
  if (!g.index) return g.attributes.position;
  const p = g.attributes.position.array, idx = g.index.array, out = new Float32Array(idx.length * 3);
  for (let i = 0; i < idx.length; i++) { out[i * 3] = p[idx[i] * 3]; out[i * 3 + 1] = p[idx[i] * 3 + 1]; out[i * 3 + 2] = p[idx[i] * 3 + 2]; }
  return { array: out };
};
// area-weighted percentiles of v[] (one value per triangle) for each q in qs, from one sort;
// same order and sums as a stable sort of [value, weight] pairs
function wpcts(T, v, qs) {
  const n = T.n, ix = new Uint32Array(n);
  for (let i = 0; i < n; i++) ix[i] = i;
  ix.sort((a, b) => v[a] - v[b] || a - b);
  let tot = 0;
  for (let i = 0; i < n; i++) tot += T.ar[ix[i]];
  return qs.map((q) => {
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += T.ar[ix[i]]; if (acc >= q * tot) return v[ix[i]]; }
    return n ? v[ix[n - 1]] : 0;
  });
}

// raw measurements in model units
export function measureModel(model) {
  const key = model.body || model;
  if (statCache.has(key)) return statCache.get(key);
  const bp = nonIndexed(model.body), gp = nonIndexed(model.glow);
  const parts = []; if (bp) parts.push([bp, 1]); if (gp) parts.push([gp, 0.6]);
  const T = triTable(parts), n = T.n;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { minY = Math.min(minY, T.y0[i]); maxY = Math.max(maxY, T.y1[i]); }
  if (!n) { const s = { minY: 0, maxY: 1, top: 1, cx: 0, cz: 0, core: { x: 0.3, z: 0.3 }, full: { x: 0.4, z: 0.4 } }; statCache.set(key, s); return s; }
  const N = 48, H = Math.max(1e-4, maxY - minY), D = new Float64Array(N);
  for (let t = 0; t < n; t++) {
    const i0 = Math.max(0, Math.min(N - 1, Math.floor(((T.y0[t] - minY) / H) * N)));
    const i1 = Math.max(0, Math.min(N - 1, Math.floor(((T.y1[t] - minY) / H) * N)));
    const share = T.ar[t] / (i1 - i0 + 1);
    for (let i = i0; i <= i1; i++) D[i] += share;
  }
  const sorted = [...D].filter((d) => d > 0).sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1] || 0;
  let topI = N - 1;
  while (topI > 0 && D[topI] < med * 0.22) topI--;
  const top = minY + ((topI + 1) / N) * H;
  const footY = minY + (top - minY) * 0.14;
  let sx = 0, sz = 0, sw = 0;
  for (let t = 0; t < n; t++) if (T.y[t] < footY) { sx += T.x[t] * T.ar[t]; sz += T.z[t] * T.ar[t]; sw += T.ar[t]; }
  if (sw < 1e-6) for (let t = 0; t < n; t++) { sx += T.x[t] * T.ar[t]; sz += T.z[t] * T.ar[t]; sw += T.ar[t]; }
  const lim = 0.3 * (top - minY);
  const cx = Math.max(-lim, Math.min(lim, sx / sw)), cz = Math.max(-lim, Math.min(lim, sz / sw));
  const dx = new Float64Array(n), dz = new Float64Array(n);
  for (let t = 0; t < n; t++) { dx[t] = Math.abs(T.x[t] - cx); dz[t] = Math.abs(T.z[t] - cz); }
  const [px9, px995] = wpcts(T, dx, [0.9, 0.995]), [pz9, pz995] = wpcts(T, dz, [0.9, 0.995]);
  const core = { x: px9, z: pz9 };
  let fx = 0, fz = 0;
  for (let t = 0; t < n; t++) { const a = T.src[t], o = T.off[t]; for (let k = 0; k < 9; k += 3) { fx = Math.max(fx, Math.abs(a[o + k] - cx)); fz = Math.max(fz, Math.abs(a[o + k + 2] - cz)); } }
  const full = { x: Math.max(core.x, px995, fx * 0.8), z: Math.max(core.z, pz995, fz * 0.8) };
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
