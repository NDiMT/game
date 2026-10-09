import * as THREE from 'three';

// =====================================================================
// HEX REALMS: nature models for the adventure map (trees, bushes, tufts,
// rocks, peaks, crystals, mushrooms). Every model returns
// { body, glow } following the shared model contract: vertex colours,
// base at y = 0, +Y up. Painted with gradients, mottling and fake AO.
// =====================================================================

// ------------------------------------------------------------ utilities
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _c = new THREE.Color();
const L = (hex) => { _c.set(hex); return [_c.r, _c.g, _c.b]; }; // sRGB hex -> linear rgb
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
// a colour ramp over 0..1 from a list of hex stops
function ramp(...hex) {
  const s = hex.map(L);
  return (t) => {
    t = clamp01(t) * (s.length - 1);
    const i = Math.min(s.length - 2, Math.floor(t));
    return mix(s[i], s[i + 1], t - i);
  };
}
function h3(x, y, z) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
// smooth value noise in 0..1
function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm = (x, y, z) => noise(x, y, z) * 0.55 + noise(x * 2.1 + 5, y * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, y * 4.3 + 9, z * 4.3) * 0.15;

// ------------------------------------------------------------ geometry builder
// Builds a model from parts. Each part may be jittered (welded, position-based)
// and painted with a colour function (p, n) -> linear rgb.
class Build {
  constructor(seed) { this.r = rng(seed); this.B = []; this.G = []; this.seed = seed; }
  rand(a = 0, b = 1) { return a + (b - a) * this.r(); }
  part(geo, col, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position.array;
    if (o.jitter) {
      const f = o.jf || 4, a = o.jitter, s = (o.js ?? this.seed) * 1.37;
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i] * f + s, y = p[i + 1] * f, z = p[i + 2] * f;
        p[i] += (noise(x, y, z) - 0.5) * 2 * a;
        p[i + 1] += (noise(x + 31, y, z) - 0.5) * 2 * a * (o.jy ?? 1);
        p[i + 2] += (noise(x, y + 57, z) - 0.5) * 2 * a;
      }
    }
    if (o.floor !== undefined) for (let i = 1; i < p.length; i += 3) if (p[i] < o.floor) p[i] = o.floor;
    g.computeVertexNormals();
    const n = g.attributes.normal.array, c = new Float32Array(p.length);
    const fixed = typeof col === 'function' ? null : Array.isArray(col) ? col : L(col);
    const P = { x: 0, y: 0, z: 0 }, N = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < p.length; i += 3) {
      let cc = fixed;
      if (!cc) { P.x = p[i]; P.y = p[i + 1]; P.z = p[i + 2]; N.x = n[i]; N.y = n[i + 1]; N.z = n[i + 2]; cc = col(P, N); }
      c[i] = cc[0]; c[i + 1] = cc[1]; c[i + 2] = cc[2];
    }
    (o.glow ? this.G : this.B).push({ p, n, c });
    return this;
  }
  // sat: saturation kept (1 = as painted); tone: [rgb, amount] pulls the body towards one harmonising colour.
  // Round 3 (figure/ground): nature is part of the GROUND layer, so every model is calmed here.
  done({ ao = 0.55, aoH = 0.22, sat = 0.8, tone = null, gsat = 0.8 } = {}) {
    // the shared game material already adds its own height AO, so keep the baked one gentle
    ao = 0.55 + ao * 0.4;
    return { body: merge(this.B, ao, aoH, sat, tone), glow: this.G.length ? merge(this.G, 1, 1, gsat) : null };
  }
}
function merge(parts, ao, aoH, sat = 1, tone = null) {
  let len = 0;
  for (const q of parts) len += q.p.length;
  const pos = new Float32Array(len), nor = new Float32Array(len), col = new Float32Array(len), uv = new Float32Array((len / 3) * 2);
  let o = 0;
  for (const q of parts) { pos.set(q.p, o); nor.set(q.n, o); col.set(q.c, o); o += q.p.length; }
  for (let i = 0, j = 0; i < len; i += 3, j += 2) {
    // soft coloured occlusion: shade goes cool violet-blue near the ground, never black
    const y = pos[i + 1], f = ao + (1 - ao) * smooth(0, aoH, y);
    col[i] *= f; col[i + 1] *= f + (1 - f) * 0.15; col[i + 2] *= f + (1 - f) * 0.45;
    if (sat !== 1 || tone) {
      // desaturate around luminance (keeps brightness, removes loudness), then an optional tonal pull
      const lum = col[i] * 0.2126 + col[i + 1] * 0.7152 + col[i + 2] * 0.0722;
      for (let k = 0; k < 3; k++) {
        let v = lum + (col[i + k] - lum) * sat;
        if (tone) v += (tone[0][k] * (0.6 + lum * 1.2) - v) * tone[1];
        col[i + k] = v < 0 ? 0 : v;
      }
    }
    const ax = Math.abs(nor[i]), ay = Math.abs(nor[i + 1]), az = Math.abs(nor[i + 2]);
    if (ay >= ax && ay >= az) { uv[j] = pos[i]; uv[j + 1] = pos[i + 2]; }
    else if (ax >= az) { uv[j] = pos[i + 2]; uv[j + 1] = y; }
    else { uv[j] = pos[i]; uv[j + 1] = y; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}
// geometry from a list of closed rings (same vertex count), with optional end apexes
function ringsGeo(rings, { apexTop = null, apexBottom = null, flip = false } = {}) {
  const pos = [], idx = [], n = rings[0].length;
  for (const ring of rings) for (const v of ring) pos.push(v.x, v.y, v.z);
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) {
    const a = r * n + i, b = r * n + ((i + 1) % n), c = a + n, d = b + n;
    idx.push(a, b, d, a, d, c);
  }
  if (apexTop) {
    const t = pos.length / 3, last = (rings.length - 1) * n; pos.push(apexTop.x, apexTop.y, apexTop.z);
    for (let i = 0; i < n; i++) idx.push(last + i, last + ((i + 1) % n), t);
  }
  if (apexBottom) {
    const t = pos.length / 3; pos.push(apexBottom.x, apexBottom.y, apexBottom.z);
    for (let i = 0; i < n; i++) idx.push((i + 1) % n, i, t);
  }
  if (flip) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g.toNonIndexed();
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// a swept tube through points with per-point radii (parallel-transport frames). r = 0 at the end closes it.
function tubeGeo(pts, radii, segs = 6) {
  const rings = [];
  let nrm = null;
  for (let i = 0; i < pts.length; i++) {
    const t = (i === 0 ? pts[1].clone().sub(pts[0]) : i === pts.length - 1 ? pts[i].clone().sub(pts[i - 1]) : pts[i + 1].clone().sub(pts[i - 1])).normalize();
    if (!nrm) { nrm = Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0); }
    nrm = nrm.clone().sub(t.clone().multiplyScalar(nrm.dot(t))).normalize();
    const bin = t.clone().cross(nrm);
    if (radii[i] <= 0) break;
    const ring = [];
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      ring.push(pts[i].clone().addScaledVector(nrm, Math.cos(a) * radii[i]).addScaledVector(bin, Math.sin(a) * radii[i]));
    }
    rings.push(ring);
  }
  const lastI = rings.length;
  return ringsGeo(rings, { apexTop: lastI < pts.length ? pts[lastI] : null });
}
// a gently curved branch from a towards b, bending by `bend` (a vector), n segments
function branchPts(a, b, bend, n = 3) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(a.clone().lerp(b, t).addScaledVector(bend, Math.sin(t * Math.PI))); }
  return pts;
}
// double-sided triangle soup from flat positions
function twoSided(arr) {
  const back = arr.slice();
  for (let i = 0; i < back.length; i += 9) for (let k = 0; k < 3; k++) { const t = back[i + 3 + k]; back[i + 3 + k] = back[i + 6 + k]; back[i + 6 + k] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...arr, ...back], 3));
  return g;
}
// a star-shaped cone: fir tier with spiky drooping rim and concave underside
function starCone(r, h, n, inner = 0.72, droop = 0.05, rot = 0) {
  const tri = [], apex = [0, h, 0], under = [0, h * 0.18, 0], rim = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * inner : r;
    rim.push([Math.cos(a) * rr, i % 2 ? droop * 0.3 : -droop, Math.sin(a) * rr]);
  }
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i], b = rim[(i + 1) % rim.length];
    tri.push(...a, ...apex, ...b);
    tri.push(...b, ...under, ...a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  return g;
}
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

// ------------------------------------------------------------ painters
const SUNTINT = L(0xfff0b0);
// foliage: gradient by height in the canopy, darker inside, lighter on top-facing faces, mottled
function leafPaint(rmp, cx, cy, cz, R, y0, y1, mott = 0.14, sun = 0.06) {
  return (p, n) => {
    const t = (p.y - y0) / (y1 - y0);
    const d = Math.hypot(p.x - cx, (p.y - cy) * 1.2, p.z - cz) / R;
    const m = fbm(p.x * 4, p.y * 4, p.z * 4); // broad, soft mottling (no speckle)
    let c = rmp(0.15 + t * 0.5 + n.y * 0.12 + (m - 0.5) * mott);
    c = mix(mul(c, 0.86), c, smooth(0.3, 0.95, d)); // gently deeper inside the crown (cool, not black)
    // sun-kissed tops: warmer and more saturated, not whiter
    if (n.y > 0.25 && t > 0.35) c = mix(c, [c[0] * 1.08 + 0.01, c[1] * 1.08, c[2] * 0.95], sun * 2 * smooth(0.25, 0.9, n.y));
    return c;
  };
}
function barkPaint(rmp, top = 1, stripe = 0.25) {
  return (p) => {
    const a = Math.atan2(p.z, p.x);
    const s = noise(Math.cos(a) * 3 + 10, p.y * 9, Math.sin(a) * 3);
    return mul(rmp(p.y / top * 0.6 + s * 0.4), 1 - stripe + stripe * 2 * noise(p.x * 30, p.y * 6, p.z * 30));
  };
}
const BARK = ramp(0x6e5440, 0x8a6e52, 0xa88e72);

// ------------------------------------------------------------ trees
function roots(b, rad, col, n = 4) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + b.rand(0, 0.8), l = rad * b.rand(2.2, 3);
    b.part(tubeGeo([V(0, rad * 1.6, 0), V(Math.cos(a) * l * 0.6, rad * 0.5, Math.sin(a) * l * 0.6), V(Math.cos(a) * l, 0, Math.sin(a) * l)], [rad * 0.55, rad * 0.35, 0], 4), col);
  }
}
function canopy(b, blobs, rmp, opt = {}) {
  let y0 = Infinity, y1 = -Infinity, cx = 0, cy = 0, cz = 0;
  for (const [x, y, z, r, sy = 0.85] of blobs) { y0 = Math.min(y0, y - r * sy); y1 = Math.max(y1, y + r * sy); cx += x; cy += y; cz += z; }
  cx /= blobs.length; cy /= blobs.length; cz /= blobs.length;
  let R = 0;
  for (const [x, y, z, r] of blobs) R = Math.max(R, Math.hypot(x - cx, y - cy, z - cz) + r);
  const paint = leafPaint(rmp, cx, cy, cz, R, y0, y1, opt.mott, opt.sun);
  for (const [x, y, z, r, sy = 0.85] of blobs) b.part(ico(r, 1).scale(1, sy, 1).translate(x, y, z), paint, { jitter: r * 0.16, jf: 5 });
}
function oak(b) {
  const tr = barkPaint(BARK, 0.6);
  b.part(tubeGeo(branchPts(V(0, 0, 0), V(0.03, 0.5, -0.02), V(0.03, 0, 0.02), 3), [0.085, 0.066, 0.055, 0.045], 7), tr);
  roots(b, 0.06, tr);
  b.part(tubeGeo(branchPts(V(0.02, 0.36, 0), V(0.22, 0.58, 0.06), V(0, 0.04, 0), 2), [0.035, 0.026, 0.016], 5), tr);
  b.part(tubeGeo(branchPts(V(0.02, 0.4, 0), V(-0.18, 0.62, -0.1), V(0, 0.04, 0), 2), [0.032, 0.024, 0.015], 5), tr);
  const leaves = ramp(0x254f35, 0x326341, 0x48784a, 0x638d5a, 0x82a070);
  const bl = [[0, 0.66, 0, 0.3], [0.24, 0.58, 0.08, 0.2], [-0.22, 0.6, -0.1, 0.21], [0.05, 0.56, 0.24, 0.19], [-0.06, 0.58, -0.24, 0.2], [0.04, 0.86, -0.02, 0.2], [0.17, 0.78, -0.14, 0.15], [-0.15, 0.8, 0.12, 0.15]];
  canopy(b, bl, leaves, { sun: 0.06 });
}
function pineTree(b, snow) {
  const tr = barkPaint(ramp(0x5a3a24, 0x7a5434, 0x9a7048), 0.4);
  b.part(tubeGeo([V(0, 0, 0), V(0, 0.3, 0), V(0, 0.95, 0)], [0.06, 0.045, 0], 6), tr);
  roots(b, 0.045, tr, 3);
  const tiers = [[0.15, 0.36, 0.36], [0.34, 0.3, 0.34], [0.52, 0.23, 0.31], [0.69, 0.16, 0.36]];
  const green = snow ? ramp(0x24523e, 0x30664a, 0x4a7e5c, 0x76a083) : ramp(0x27583c, 0x356c46, 0x4e8452, 0x7aa266);
  const SN = ramp(0xc8d2e6, 0xe6ecf6, 0xf6f8fc);
  tiers.forEach(([y, r, h], i) => {
    const paint = (p, n) => {
      const t = (p.y - y) / h, d = Math.hypot(p.x, p.z) / r, m = noise(p.x * 14, p.y * 14, p.z * 14);
      let c = green(d * 0.55 + t * 0.25 + (m - 0.5) * 0.3 + i * 0.06);
      if (n.y < 0) c = green(0.12);
      if (snow && n.y > 0.2 && d < 0.34 + m * 0.4) c = SN(0.3 + n.y * 0.5 + (1 - d) * 0.3 + (m - 0.5) * 0.3);
      return c;
    };
    b.part(starCone(r, h, 8, 0.7, 0.055, i * 0.4 + b.rand()).translate(0, y, 0), paint, { jitter: 0.012, jf: 12 });
  });
  if (snow) b.part(ico(0.035, 0).translate(0, 1.03, 0), 0xeef2f8);
}
function birch(b) {
  const white = L(0xeeeae0), black = L(0x8a7a70), warm = L(0xd8ccb8);
  const tr = (p) => {
    const a = Math.atan2(p.z, p.x), s = noise(Math.cos(a) * 2.5, p.y * 16, Math.sin(a) * 2.5);
    return s > 0.68 ? black : mix(white, warm, noise(p.y * 4, 0, a) * 0.5 + (p.y < 0.08 ? 0.5 : 0));
  };
  b.part(tubeGeo(branchPts(V(0, 0, 0), V(-0.03, 0.82, 0.02), V(0.035, 0, 0), 4), [0.05, 0.042, 0.034, 0.026, 0.012], 6), tr);
  b.part(tubeGeo(branchPts(V(-0.01, 0.42, 0), V(0.14, 0.62, 0.05), V(0, 0.02, 0), 2), [0.018, 0.013, 0.008], 4), tr);
  b.part(tubeGeo(branchPts(V(-0.02, 0.5, 0), V(-0.15, 0.68, -0.06), V(0, 0.02, 0), 2), [0.016, 0.012, 0.007], 4), tr);
  const leaves = ramp(0x346339, 0x467645, 0x5e8952, 0x7a9b63, 0x96ae7e);
  canopy(b, [[-0.02, 0.7, 0, 0.21, 1.25], [0.15, 0.58, 0.05, 0.14, 1.2], [-0.16, 0.62, -0.06, 0.14, 1.2], [0.02, 0.6, 0.16, 0.14, 1.1], [0, 0.58, -0.16, 0.13, 1.1], [-0.02, 0.9, 0.01, 0.13, 1.2], [0.1, 0.8, -0.08, 0.1, 1.2]], leaves, { sun: 0.06 });
}
function willow(b) {
  const tr = barkPaint(ramp(0x5a4836, 0x7a6448, 0x9a8462), 0.5, 0.3);
  b.part(tubeGeo(branchPts(V(0, 0, 0), V(0.06, 0.5, 0), V(-0.06, 0, 0.03), 4), [0.1, 0.075, 0.06, 0.055, 0.05], 7), tr, { jitter: 0.012, jf: 14 });
  roots(b, 0.075, tr, 5);
  const leaves = ramp(0x2d533b, 0x3e6645, 0x557b52, 0x739269);
  const bl = [[0.05, 0.64, 0, 0.27, 0.62], [0.24, 0.58, 0.1, 0.17, 0.6], [-0.15, 0.6, -0.12, 0.18, 0.6], [-0.08, 0.6, 0.2, 0.16, 0.6], [0.16, 0.6, -0.2, 0.16, 0.6], [0.04, 0.78, 0.02, 0.17, 0.6]];
  canopy(b, bl, leaves, { mott: 0.3, sun: 0.06 });
  // hanging curtains of fronds
  const strand = ramp(0x345439, 0x4d7148, 0x6b8d61);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + b.rand(-0.15, 0.15), rr = b.rand(0.26, 0.36), y = b.rand(0.52, 0.6), l = b.rand(0.28, 0.42);
    const x = 0.04 + Math.cos(a) * rr, z = Math.sin(a) * rr, w = 0.05;
    const tx = -Math.sin(a) * w, tz = Math.cos(a) * w, ox = Math.cos(a) * 0.04, oz = Math.sin(a) * 0.04;
    const tri = [x - tx, y, z - tz, x + tx, y, z + tz, x + ox * 0.5, y - l, z + oz * 0.5,
      x + tx, y, z + tz, x + ox, y - l * 0.75, z + oz, x + ox * 0.5, y - l, z + oz * 0.5];
    b.part(twoSided(tri), (p) => strand((p.y - (y - l)) / l * 0.9 + noise(p.x * 9, p.y * 9, p.z * 9) * 0.3));
  }
}
function deadTree(b, burnt) {
  const tr = burnt ? barkPaint(ramp(0x4a4038, 0x665a4e, 0x887a6a), 0.7, 0.24) : barkPaint(ramp(0x786a58, 0x8c7e68, 0xa4967c), 0.7, 0.16);
  const top = burnt ? V(0.05, 0.72, 0.02) : V(0.04, 0.88, -0.02);
  b.part(tubeGeo(branchPts(V(0, 0, 0), top, V(0.07, 0, 0.04), 4), burnt ? [0.09, 0.07, 0.06, 0.05, 0.04] : [0.08, 0.06, 0.045, 0.03, 0], 6), tr, { jitter: 0.012, jf: 12 });
  if (burnt) b.part(new THREE.ConeGeometry(0.042, 0.1, 6).translate(top.x, top.y + 0.04, top.z), tr, { jitter: 0.02, jf: 20 });
  roots(b, 0.07, tr, 4);
  const br = burnt
    ? [[0.38, 0.0, 0.62, 0.2], [0.5, 2.6, 0.55, 0.16], [0.6, 4.4, 0.5, 0.14]]
    : [[0.4, 0.2, 0.75, 0.32], [0.52, 2.3, 0.8, 0.3], [0.64, 4.2, 0.95, 0.24], [0.72, 1.2, 0.95, 0.18], [0.3, 3.5, 0.5, 0.2]];
  for (const [y, a, y2, l] of br) {
    const s = V(0.04 * (y / 0.9), y, 0), e = V(Math.cos(a) * l, y2, Math.sin(a) * l);
    b.part(tubeGeo(branchPts(s, e, V(0, 0.05, 0), 2), [0.03, 0.02, 0], 4), tr);
    if (!burnt) {
      const e2 = e.clone().add(V(Math.cos(a + 0.9) * 0.1, 0.1, Math.sin(a + 0.9) * 0.1));
      const m = s.clone().lerp(e, 0.6);
      b.part(tubeGeo([m, m.clone().lerp(e2, 0.5).add(V(0, 0.03, 0)), e2], [0.014, 0.01, 0], 3), tr);
    }
  }
  if (burnt) {
    // glowing ember cracks and a smouldering ash ring
    const ember = ramp(0xd84010, 0xe8701c, 0xf0a040);
    for (let i = 0; i < 4; i++) {
      const y = b.rand(0.06, 0.6), a = b.rand(0, Math.PI * 2), r = 0.09 - y * 0.06 + 0.004;
      b.part(new THREE.BoxGeometry(0.012, b.rand(0.05, 0.12), 0.012).rotateZ(b.rand(-0.4, 0.4)).translate(Math.cos(a) * r + y * 0.05, y, Math.sin(a) * r), ember(b.r()), { glow: true });
    }
    const ash = ramp(0x6a625a, 0x8a8278, 0xaaa296);
    for (let i = 0; i < 6; i++) {
      const a = b.rand(0, Math.PI * 2), r = b.rand(0.14, 0.26);
      b.part(ico(b.rand(0.03, 0.05), 0).scale(1, 0.5, 1).translate(Math.cos(a) * r, 0.005, Math.sin(a) * r), (p, n) => ash(n.y * 0.6 + noise(p.x * 30, p.y * 30, p.z * 30) * 0.4), { floor: 0 });
    }
    for (let i = 0; i < 1; i++) { const a = b.rand(0, 6.28), r = b.rand(0.14, 0.24); b.part(ico(0.016, 0).translate(Math.cos(a) * r, 0.012, Math.sin(a) * r), ember(0.5 + b.r() * 0.5), { glow: true }); }
  }
}
function palm(b) {
  // ringed, curved trunk
  const pts = [], rad = [], n = 7;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(V(0.18 * t * t, 0.78 * t, 0.04 * t)); rad.push(0.065 - 0.025 * t); }
  const bands = ramp(0x8a6a44, 0xb08c5a, 0xdcbc84);
  b.part(tubeGeo(pts, rad, 7), (p) => bands(((p.y * 18) % 1) * 0.7 + noise(p.x * 20, p.y * 20, p.z * 20) * 0.3), { jitter: 0.005, jf: 30 });
  const top = pts[n];
  // fronds: V-folded, arched, tapering leaves
  const leaf = ramp(0x3a6a34, 0x52843e, 0x76a052, 0xa4bc72);
  const nf = 8;
  for (let f = 0; f < nf; f++) {
    const a = (f / nf) * Math.PI * 2 + b.rand(-0.2, 0.2), len = b.rand(0.42, 0.52), lift = b.rand(0.12, 0.2);
    const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
    const S = 6, sec = [];
    for (let i = 0; i <= S; i++) {
      const t = i / S, w = 0.075 * Math.sin(Math.min(1, t * 1.25) * Math.PI) + 0.004;
      const cx = top.x + dx * len * t, cy = top.y + lift * Math.sin(t * Math.PI * 0.75) - t * t * 0.32, cz = top.z + dz * len * t;
      sec.push([[cx + sx * w, cy - w * 0.45, cz + sz * w], [cx, cy + 0.012, cz], [cx - sx * w, cy - w * 0.45, cz - sz * w]]);
    }
    const tri = [];
    for (let i = 0; i < S; i++) {
      const A = sec[i], B = sec[i + 1];
      tri.push(...A[0], ...B[0], ...B[1], ...A[0], ...B[1], ...A[1]);
      tri.push(...A[1], ...B[1], ...B[2], ...A[1], ...B[2], ...A[2]);
    }
    b.part(twoSided(tri), (p, nn) => {
      const t = Math.hypot(p.x - top.x, p.z - top.z) / len;
      return mul(leaf(t * 0.8 + 0.15 + noise(p.x * 25, p.y * 25, p.z * 25) * 0.15), 0.88 + 0.2 * Math.abs(nn.y));
    });
  }
  const nut = L(0x8a5a2a);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.3; b.part(ico(0.035, 1).translate(top.x + Math.cos(a) * 0.045, top.y - 0.04, top.z + Math.sin(a) * 0.045), nut); }
}
function cactus(b) {
  const g1 = L(0x3a6a44), g2 = L(0x5e9058), g3 = L(0x96b882);
  const ribs = (cx, cz) => (p, n) => {
    const a = Math.atan2(p.z - cz, p.x - cx), s = Math.cos(a * 5) * 0.5 + 0.5;
    return mix(mix(g1, g2, s), g3, smooth(0.4, 1, n.y) * 0.55 + s * 0.15 + noise(p.x * 30, p.y * 30, p.z * 30) * 0.12);
  };
  const col = (r, h, x, y, z) => {
    b.part(new THREE.CylinderGeometry(r, r * 1.06, h, 10, 2).translate(x, y + h / 2, z), ribs(x, z));
    b.part(new THREE.SphereGeometry(r, 10, 3, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y + h, z), ribs(x, z));
  };
  col(0.095, 0.72, 0, 0, 0);
  // arms: elbow tube then upright column
  const arm = (side, y, out, up, r) => {
    b.part(tubeGeo([V(0, y, 0), V(side * out * 0.7, y + 0.01, 0), V(side * out, y + 0.08, 0)], [r, r, r], 8), (p, n) => mix(g1, g2, 0.4 + n.y * 0.5));
    col(r, up, side * out, y + 0.06, 0);
  };
  arm(1, 0.3, 0.2, 0.26, 0.06);
  arm(-1, 0.42, 0.18, 0.2, 0.055);
  // flowers
  const fl = L(0xc87a8e), fc = L(0xe8d088);
  b.part(new THREE.ConeGeometry(0.035, 0.04, 5).rotateX(Math.PI).translate(0.02, 0.83, 0.03), fl);
  b.part(ico(0.012, 0).translate(0.02, 0.84, 0.03), fc);
    // a small barrel cactus at the foot
  b.part(new THREE.SphereGeometry(0.07, 10, 4).scale(1, 1.1, 1).translate(0.16, 0.05, 0.12), ribs(0.16, 0.12), { floor: 0 });
  }

/** treeModel(kind): 'oak','pine','birch','snowpine','willow','dead','palm','cactus','burnt' (about 1 unit tall). */
export function treeModel(kind = 'oak') {
  const seeds = { oak: 101, pine: 102, birch: 103, snowpine: 104, willow: 105, dead: 106, palm: 107, cactus: 108, burnt: 109 };
  const b = new Build(seeds[kind] ?? 100);
  switch (kind) {
    case 'pine': pineTree(b, false); break;
    case 'snowpine': pineTree(b, true); break;
    case 'birch': birch(b); break;
    case 'willow': willow(b); break;
    case 'dead': deadTree(b, false); break;
    case 'burnt': deadTree(b, true); break;
    case 'palm': palm(b); break;
    case 'cactus': cactus(b); break;
    default: oak(b);
  }
  return b.done({ ao: 0.6, aoH: 0.18, sat: 0.85 });
}
export const TREE_KINDS = ['oak', 'pine', 'birch', 'snowpine', 'willow', 'dead', 'palm', 'cactus', 'burnt'];

// ------------------------------------------------------------ bushes
/** bushModel(i): 0 lush green, 1 berry, 2 flowering, 3 dry desert scrub, 4 snowy, 5 swamp fern (about 0.5 wide, 0.35 tall). */
export function bushModel(i = 0) {
  i = ((i % 6) + 6) % 6;
  const b = new Build(200 + i);
  const pal = [
    ramp(0x4a6a4a, 0x557854, 0x66885f, 0x7c9972),
    ramp(0x4b6348, 0x597152, 0x68805d, 0x7c9470), // berry: a faintly warmer, duskier leaf instead of red dots
    ramp(0x4b6b4a, 0x597954, 0x698961, 0x7f9b76),
    ramp(0x86785a, 0x988a66, 0xae9e78, 0xc8ba94),
    ramp(0x6a8480, 0x7c968e, 0x92aaa2, 0xb0c4be),
    ramp(0x3e5d41, 0x4b6d48, 0x5c7d56, 0x739069),
  ][i];
  if (i === 5) {
    // fern: arching fronds
    for (let f = 0; f < 9; f++) {
      const a = (f / 9) * Math.PI * 2 + b.rand(-0.2, 0.2), l = b.rand(0.22, 0.3), dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx, tri = [];
      let prev = null;
      for (let s = 0; s <= 5; s++) {
        const t = s / 5, w = 0.05 * Math.sin(t * Math.PI) + 0.003, cx = dx * l * t, cy = 0.02 + Math.sin(t * Math.PI * 0.8) * 0.2 - t * t * 0.08, cz = dz * l * t;
        const cur = [[cx + sx * w, cy, cz + sz * w], [cx, cy + 0.01, cz], [cx - sx * w, cy, cz - sz * w]];
        if (prev) tri.push(...prev[0], ...cur[0], ...cur[1], ...prev[0], ...cur[1], ...prev[1], ...prev[1], ...cur[1], ...cur[2], ...prev[1], ...cur[2], ...prev[2]);
        prev = cur;
      }
      b.part(twoSided(tri), (p) => pal(Math.hypot(p.x, p.z) / l * 0.6 + 0.2 + noise(p.x * 8, p.y * 8, p.z * 8) * 0.12));
    }
    return b.done({ ao: 0.8, aoH: 0.08, sat: 0.7 });
  }
  const n = i === 3 ? 4 : 5, bl = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + b.rand(0, 0.6), d = k === 0 ? 0 : b.rand(0.1, 0.16), r = k === 0 ? 0.16 : b.rand(0.09, 0.12);
    bl.push(k === 0 ? [0, 0.1, 0, r, 0.62] : [Math.cos(a) * d, r * 0.5, Math.sin(a) * d, r, 0.62]); // low, mounded
  }
  canopy(b, bl, pal, { mott: i === 3 ? 0.2 : 0.12, sun: 0.04 });
  if (i === 3) for (let k = 0; k < 5; k++) { const a = b.rand(0, 6.28); b.part(tubeGeo([V(0, 0.05, 0), V(Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12), V(Math.cos(a) * 0.2, 0.28, Math.sin(a) * 0.2)], [0.01, 0.006, 0], 3), 0xa08a6a); }
  // round 3: only a handful of soft, low-contrast blossoms on the flowering bush; no berries
  const dots = i === 2 ? [L(0xd8b8c0), L(0xe0d4c4)] : null;
  if (dots) {
    const cnt = 4;
    for (let k = 0; k < cnt; k++) {
      const [x, y, z, r] = bl[k % bl.length], u = b.rand(0, 6.28), v = b.rand(0.15, 1.3);
      b.part(ico(i === 1 ? 0.022 : 0.026, 0).translate(x + Math.cos(u) * Math.sin(v) * r * 1.02, y + Math.cos(v) * r * 0.87, z + Math.sin(u) * Math.sin(v) * r * 1.02), dots[k % dots.length]);
    }
  }
  if (i === 4) for (const [x, y, z, r] of bl) b.part(ico(r * 0.85, 1).scale(1.05, 0.3, 1.05).translate(x, y + r * 0.36, z), (p, nn) => mix(L(0xc4ccdc), L(0xeef0f4), clamp01(nn.y)), { jitter: r * 0.12, jf: 8 });
  return b.done({ ao: 0.8, aoH: 0.08, sat: 0.7 });
}

// ------------------------------------------------------------ tufts and flowers
/** tuftModel(i): 0 grass tuft, 1 meadow flowers, 2 reeds and cattails, 3 dry grass, 4 lava weed with embers (about 0.3 tall). */
export function tuftModel(i = 0) {
  i = ((i % 5) + 5) % 5;
  const b = new Build(300 + i);
  const blades = (n, h, w, rmp, spread = 0.12, curve = 0.08) => {
    const tri = [];
    for (let k = 0; k < n; k++) {
      const a = b.rand(0, 6.28), d = b.rand(0, spread), x = Math.cos(a) * d, z = Math.sin(a) * d, hh = h * b.rand(0.6, 1.1);
      const lean = b.rand(0, 6.28), lx = Math.cos(lean) * curve, lz = Math.sin(lean) * curve, tx = Math.cos(lean + 1.57) * w, tz = Math.sin(lean + 1.57) * w;
      tri.push(x - tx, 0, z - tz, x + tx, 0, z + tz, x + lx * 0.4 + tx * 0.6, hh * 0.55, z + lz * 0.4 + tz * 0.6);
      tri.push(x - tx, 0, z - tz, x + lx * 0.4 + tx * 0.6, hh * 0.55, z + lz * 0.4 + tz * 0.6, x + lx * 0.4 - tx * 0.6, hh * 0.55, z + lz * 0.4 - tz * 0.6);
      tri.push(x + lx * 0.4 - tx * 0.6, hh * 0.55, z + lz * 0.4 - tz * 0.6, x + lx * 0.4 + tx * 0.6, hh * 0.55, z + lz * 0.4 + tz * 0.6, x + lx, hh, z + lz);
    }
    b.part(twoSided(tri), (p) => rmp(p.y / h * 0.85 + noise(p.x * 9, 0, p.z * 9) * 0.12));
  };
  const GR = ramp(0x587a40, 0x668a4a, 0x7a9a58, 0x92aa6c); // close to the grass terrain
  if (i === 0) blades(16, 0.2, 0.026, GR, 0.15, 0.08);
  if (i === 1) {
    blades(12, 0.16, 0.022, GR, 0.15);
    // a few soft, pastel blooms that sit in the grass (no bright confetti)
    const cols = [0xd8cc9c, 0xc8b4cc, 0xdcd4c0];
    for (let k = 0; k < 3; k++) {
      const a = b.rand(0, 6.28), d = b.rand(0.02, 0.13), x = Math.cos(a) * d, z = Math.sin(a) * d, h = b.rand(0.12, 0.18);
      b.part(tubeGeo([V(x, 0, z), V(x + 0.01, h, z)], [0.006, 0.005], 3), 0x668a4a);
      b.part(new THREE.ConeGeometry(0.036, 0.024, 6).rotateX(Math.PI).translate(x + 0.01, h + 0.015, z), cols[k % cols.length]);
      b.part(ico(0.011, 0).translate(x + 0.01, h + 0.016, z), 0xd0b070);
    }
  }
  if (i === 2) {
    blades(12, 0.34, 0.02, ramp(0x56703e, 0x6e8a4c, 0x92a468), 0.12, 0.08);
    for (let k = 0; k < 3; k++) {
      const a = b.rand(0, 6.28), d = b.rand(0.02, 0.09), x = Math.cos(a) * d, z = Math.sin(a) * d, h = b.rand(0.3, 0.38);
      b.part(tubeGeo([V(x, 0, z), V(x + 0.02, h, z)], [0.006, 0.005], 3), 0x7a8a52);
      b.part(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 6).translate(x + 0.02, h - 0.02, z), (p) => mix(L(0x7a5a40), L(0x9a7a58), (p.y - h + 0.06) / 0.08));
    }
  }
  if (i === 3) blades(14, 0.2, 0.02, ramp(0x96845a, 0xa8966a, 0xbcac80, 0xcec096), 0.13, 0.1);
  if (i === 4) {
    blades(8, 0.16, 0.016, ramp(0x5e5248, 0x766858, 0x8e806a), 0.1, 0.1);
    { const a = b.rand(0, 6.28), d = b.rand(0.02, 0.1); b.part(ico(0.016, 0).translate(Math.cos(a) * d, b.rand(0.08, 0.14), Math.sin(a) * d), [0.85, 0.36, 0.08], { glow: true }); }
  }
  return b.done({ ao: 0.85, aoH: 0.06, sat: 0.65 });
}

// ------------------------------------------------------------ rocks
const ROCK_PAL = [
  ramp(0x857a6a, 0x968a78, 0xa89c88, 0xbab09a), // warm grey-brown (round 3: narrow, mid-value, earth-toned)
  ramp(0x847a6c, 0x948a7a, 0xa69c8a, 0xb8ae9c),
  ramp(0xa48a72, 0xb49a7e, 0xc6ac8e, 0xd8c0a2), // sandstone
  ramp(0x828a98, 0x949caa, 0xa8b0bc, 0xbcc4ce), // cold slate
  ramp(0x7e806a, 0x8e9078, 0xa0a088, 0xb2b098), // mossy (sits on grass)
  ramp(0x828a98, 0x949caa, 0xa8b0bc, 0xbcc4ce),
  ramp(0x5e4c50, 0x6e5a5c, 0x806a68, 0x947c76), // basalt (violet-brown, never black)
];
function rockPaint(rmp, y1, moss = 0, snow = 0) {
  const M = ramp(0x5a7a44, 0x6a8a50, 0x84a066), S = ramp(0xc8d0e0, 0xe2e8f0, 0xf0f2f6), SH = L(0x7a7890);
  return (p, n) => {
    const m = fbm(p.x * 11 + 3, p.y * 11, p.z * 11), crack = noise(p.x * 22, p.y * 22, p.z * 22);
    let c = rmp(0.3 + n.y * 0.25 + (p.y / y1) * 0.2 + (m - 0.5) * 0.3);
    if (crack > 0.8) c = mix(c, mul(SH, c[1] * 1.6 + 0.2), 0.18); // cracks: soft violet shade
    c = mix(c, L(0xf0e6d0), smooth(0.55, 1, n.y) * 0.08); // gentle sunlit tops
    if (moss && n.y + (m - 0.5) * 0.9 > 0.45) c = M(n.y * 0.8 + (m - 0.4));
    if (snow && n.y + (m - 0.5) * 0.7 > 0.62) c = S(n.y * 0.8 + (m - 0.5) * 0.5);
    return c;
  };
}
function boulder(b, r, x, z, sy, paint, j = 0.28) {
  b.part(ico(r, 1).scale(1, sy, 1).translate(x, r * sy * 0.6, z), paint, { jitter: r * j * 1.25, jf: 1.4 / r, floor: 0 });
}
/** rockModel(i): 0 boulder, 1 boulder cluster, 2 tall shard, 3 sandstone slabs, 4 mossy boulder, 5 snowy rocks, 6 basalt with glowing cracks (about 0.6 wide). */
export function rockModel(i = 0) {
  i = ((i % 7) + 7) % 7;
  const b = new Build(400 + i), rmp = ROCK_PAL[i === 3 ? 2 : i === 2 ? 1 : i];
  if (i === 0) { const p = rockPaint(rmp, 0.4); boulder(b, 0.28, 0, 0, 0.8, p); boulder(b, 0.1, 0.26, 0.14, 0.7, p); }
  if (i === 1) { const p = rockPaint(rmp, 0.35); boulder(b, 0.2, -0.1, 0, 0.9, p); boulder(b, 0.16, 0.16, 0.08, 0.8, p); boulder(b, 0.12, 0.02, -0.18, 0.75, p); boulder(b, 0.07, 0.24, -0.12, 0.7, p); }
  if (i === 2 || i === 6) {
    const p = rockPaint(rmp, 0.7);
    const shard = (r, h, x, z, tx, tz) => b.part(new THREE.CylinderGeometry(r * 0.25, r, h, 5, 2).translate(0, h / 2, 0).rotateX(tx).rotateZ(tz).translate(x, 0, z), p, { jitter: r * 0.25, jf: 5, floor: 0 });
    shard(0.16, 0.7, 0, 0, 0.08, 0.1); shard(0.11, 0.45, 0.17, 0.08, -0.15, -0.35); shard(0.09, 0.32, -0.15, 0.1, 0.3, 0.3); boulder(b, 0.1, 0.05, -0.17, 0.7, p);
    if (i === 6) {
      const lava = ramp(0xa83410, 0xd8601a, 0xe89a40);
      for (let k = 0; k < 3; k++) { const a = b.rand(0, 6.28), y = b.rand(0.04, 0.4); b.part(new THREE.BoxGeometry(0.012, b.rand(0.06, 0.14), 0.014).rotateZ(b.rand(-0.5, 0.5)).translate(Math.cos(a) * (0.15 - y * 0.18), y, Math.sin(a) * (0.15 - y * 0.18)), lava(b.r()), { glow: true }); }
      b.part(new THREE.CircleGeometry(0.055, 7).rotateX(-Math.PI / 2).translate(-0.06, 0.012, 0.22), (p) => lava(0.8 - Math.hypot(p.x + 0.06, p.z - 0.22) * 8), { glow: true });
    }
  }
  if (i === 3) {
    const p = rockPaint(rmp, 0.4);
    const slab = (w, h, d, x, y, z, ry, rz) => b.part(new THREE.BoxGeometry(w, h, d, 2, 1, 2).rotateZ(rz).rotateY(ry).translate(x, y + h / 2, z), p, { jitter: 0.025, jf: 7, floor: 0 });
    slab(0.5, 0.12, 0.38, 0, 0, 0, 0.3, 0); slab(0.38, 0.1, 0.28, 0.03, 0.11, 0.01, 0.6, 0.04); slab(0.22, 0.09, 0.18, -0.02, 0.2, 0.02, 1.1, -0.05); boulder(b, 0.07, 0.28, 0.12, 0.7, p);
  }
  if (i === 4) { const p = rockPaint(rmp, 0.45, 1); boulder(b, 0.3, 0, 0, 0.85, p); boulder(b, 0.12, -0.27, 0.1, 0.75, p); }
  if (i === 5) { const p = rockPaint(rmp, 0.4, 0, 1); boulder(b, 0.24, -0.05, 0, 0.9, p); boulder(b, 0.15, 0.2, 0.08, 0.85, p); boulder(b, 0.09, 0.02, 0.22, 0.8, p); }
  return b.done({ ao: 0.8, aoH: 0.08, sat: 0.7 });
}

// ------------------------------------------------------------ mountain peaks
// a radial mound: rings of points with ridged angular noise; returns geometry and a surface sampler
function mound({ r0, h, segs = 12, rings = 8, seed = 1, rough = 0.28, sharp = 1.25, crater = 0, ox = 0, oz = 0, lean = [0, 0], maxR = 0, foot = null }) {
  // maxR: soft radial clamp (from the model origin) so the whole mountain stays inside its own hex
  const fit = (x, z) => {
    if (!maxR) return [x, z];
    const d = Math.hypot(x, z), k0 = maxR * 0.78;
    if (d <= k0) return [x, z];
    const d2 = k0 + (maxR - k0) * Math.tanh((d - k0) / (maxR - k0));
    return [x * d2 / d, z * d2 / d];
  };
  const surf = (a, t) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    const tt = crater ? t * (1 - crater) : t;
    const rad = r0 * Math.pow(1 - tt, sharp), y = h * t;
    const ridge = 1 - Math.abs(noise(ca * 1.6 + seed, sa * 1.6, t * 2.2) * 2 - 1);
    const k = 1 + rough * (ridge - 0.5) * 1.6 + rough * (noise(ca * 4 + seed, sa * 4, t * 5) - 0.5) * 0.8;
    const [x, z] = fit(ox + ca * rad * k + lean[0] * t * t, oz + sa * rad * k + lean[1] * t * t);
    return V(x, y, z);
  };
  // ring heights: optional tight rings at absolute heights near the foot (a crisp grass band), then even steps
  const ts = [0];
  if (foot) for (const y of foot) if (y / h < 1 / rings) ts.push(y / h);
  for (let i = 1; i < rings; i++) ts.push(i / rings);
  const rs = [];
  for (const t of ts) { const ring = []; for (let s = 0; s < segs; s++) ring.push(surf((s / segs) * Math.PI * 2, t)); rs.push(ring); }
  const g = crater ? (() => { const ring = []; for (let s = 0; s < segs; s++) ring.push(surf((s / segs) * Math.PI * 2, 1)); rs.push(ring); return ringsGeo(rs, { flip: true }); })()
    : ringsGeo(rs, { apexTop: V(...(() => { const [x, z] = fit(ox + lean[0], oz + lean[1]); return [x, h, z]; })()), flip: true });
  return { g, surf };
}
// the grass foot band: an opaque ring at the very base of every mountain, crisp edge just above FOOT_Y
const PEAK_R = 0.46, FOOT_Y = 0.05, FOOT_RINGS = [0.042, 0.062];
const ROCK_PEAK = ramp(0x7e6c60, 0x9a8676, 0xb8a490, 0xd2c0a8, 0xe8dcc6); // warm sandstone-grey, gently desaturated
const COLD_PEAK = ramp(0x6e7686, 0x848c9c, 0x9ea4b2, 0xb8bdc8, 0xd0d4dc); // pale blue-grey granite
const BASALT = ramp(0x664a46, 0x7e5c52, 0x987060, 0xb28a74, 0xc8a48c); // muted red-brown volcanic rock
const PEAK_SHADE = L(0x82828e); // painted shade colour: soft grey-violet, never black
function peakPaint(kind, H) {
  const rock = kind === 'snow' ? COLD_PEAK : kind === 'volcano' ? BASALT : ROCK_PEAK;
  const grass = kind === 'volcano' ? ramp(0x7a5a4a, 0x8e6a56) : kind === 'snow' ? ramp(0xc8d0e0, 0xe4e8f0) : ramp(0x667e4a, 0x7a9258);
  const SN = ramp(0xb4bed4, 0xd2d8e6, 0xeaeef4, 0xf6f8fa);
  const snowLine = kind === 'snow' ? 0.48 : 0.54;
  return (p, n) => {
    const m = fbm(p.x * 4 + 7, p.y * 4, p.z * 4), fine = noise(p.x * 14, p.y * 14, p.z * 14), t = p.y / H;
    const facing = n.x * 0.55 + n.z * 0.45; // painted key light so ridges read even in shade
    let c = rock(0.32 + t * 0.2 + (n.y - 0.3) * 0.2 + facing * 0.45 + (m - 0.5) * 0.45);
    // horizontal strata, painterly
    const strata = Math.sin(p.y * 38 + m * 5);
    c = mul(c, 0.94 + 0.08 * strata);
    // shaded faces lean violet instead of going dark
    const shade = smooth(0.15, -0.65, facing) * 0.3 + (fine > 0.74 ? 0.1 : 0);
    c = mix(c, mul(PEAK_SHADE, 0.6 + c[1] * 0.8), shade);
    // warm sun kiss on lit ridges
    c = mix(c, L(0xf4ead6), smooth(0.35, 0.9, facing) * 0.12);
    // opaque grass / snow / ash band at the very foot only: crisp edge, never a wash over the rock
    if (p.y < FOOT_Y) c = grass(m + Math.max(0, n.y) * 0.3);
    if (kind === 'volcano') {
      const heat = smooth(0.6, 0.97, t);
      c = mix(c, mix(L(0x9a5a40), L(0xe08a50), smooth(0.85, 1, t)), heat * 0.5 * (0.5 + m));
      // pale ash streaks near the top
      if (t > 0.5 && n.y > 0.3 && m > 0.62) c = mix(c, L(0xc8b4ac), 0.5);
    } else {
      const s = t + (m - 0.5) * 0.3 + (n.y - 0.5) * 1.1 - snowLine;
      if (s > 0) c = mix(c, SN(0.3 + n.y * 0.5 + facing * 0.3 + (fine - 0.5) * 0.2 + Math.min(0.3, s)), smooth(0, 0.06, s));
    }
    return c;
  };
}
// small pine trees growing on mountain feet (built as a separate Build and appended, scaled)
function addMiniTrees(b, kind, spots) {
  for (const [x, z, sc, y = 0] of spots) {
    const t = new Build(Math.floor(b.r() * 1e6));
    pineTree(t, kind === 'snow');
    // round 3: lift the little pines towards the rock tone so they read as texture, not dark specks
    const lift = kind === 'snow' ? L(0x8a9a94) : L(0xa0a48a);
    for (const part of t.B) {
      const pp = part.p, cc = part.c;
      for (let i = 0; i < cc.length; i++) cc[i] = cc[i] + (lift[i % 3] - cc[i]) * 0.3;
      for (let i = 0; i < pp.length; i += 3) { pp[i] = pp[i] * sc + x; pp[i + 1] = pp[i + 1] * sc + y; pp[i + 2] = pp[i + 2] * sc + z; }
      b.B.push(part);
    }
  }
}
/** peakModel(kind, variant): kind 'rock' | 'snow' | 'volcano', variant 0..3 changes the silhouette.
 *  Compact: footprint radius <= PEAK_R (about 0.92 wide) so at the game's fillScale (~0.36-0.41) it stays
 *  inside its own hex (circumradius ~0.2 world units); about 0.85 tall. */
export function peakModel(kind = 'rock', variant = 0) {
  if (kind === true) kind = 'snow'; else if (kind === false) kind = 'rock';
  const seed = 500 + variant * 13 + (kind === 'snow' ? 3 : kind === 'volcano' ? 7 : 0);
  const b = new Build(seed), H = 0.85, paint = peakPaint(kind, H);
  const R = b.r, v = variant % 4;
  if (kind === 'volcano') {
    const crater = 0.35, main = mound({ r0: 0.44, h: 0.7, segs: 14, rings: 9, seed: seed * 0.1, rough: 0.16, sharp: 1.15, crater, maxR: PEAK_R, foot: FOOT_RINGS });
    b.part(main.g, paint);
    // crater inner wall going down to a lava pool
    const rimR = 0.44 * Math.pow(crater, 1.15), segs = 14, inner = [], floorR = rimR * 0.55, floorY = 0.61;
    const rimRing = [], innerRing = [];
    for (let s = 0; s < segs; s++) { const a = (s / segs) * Math.PI * 2; rimRing.push(main.surf(a, 1)); innerRing.push(V(Math.cos(a) * floorR, floorY, Math.sin(a) * floorR)); }
    const wall = ringsGeo([rimRing, innerRing], { flip: true });
    b.part(wall, (p) => mix(L(0x8a4028), L(0xff6a1a), smooth(0.68, 0.62, p.y)));
    const lava = ramp(0xc03010, 0xe8681c, 0xf0b048, 0xf8e0a0);
    b.part(new THREE.CircleGeometry(floorR * 1.02, segs).rotateX(-Math.PI / 2).translate(0, floorY + 0.005, 0), (p) => lava(1 - Math.hypot(p.x, p.z) / floorR * 0.8 + noise(p.x * 30, 0, p.z * 30) * 0.3), { glow: true });
    // lava streams down the flanks
    const flows = [0.4 + v, 2.3 + v * 0.7, 4.4 - v * 0.3];
    for (const a0 of flows) {
      const tri = [], N = 7, w0 = 0.036;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const t = 1 - (i / N) * 0.82, a = a0 + Math.sin(i * 1.3) * 0.08;
        const p = main.surf(a, t * 0.999), pn = main.surf(a + 0.01, t * 0.999);
        const outward = V(p.x, 0, p.z).normalize().multiplyScalar(0.012);
        const side = pn.clone().sub(p).normalize().multiplyScalar(w0 * (1 - i / N * 0.5));
        const c = p.clone().add(outward), cur = [c.clone().sub(side), c.clone().add(side)];
        if (prev) tri.push(prev[0].x, prev[0].y, prev[0].z, cur[0].x, cur[0].y, cur[0].z, cur[1].x, cur[1].y, cur[1].z, prev[0].x, prev[0].y, prev[0].z, cur[1].x, cur[1].y, cur[1].z, prev[1].x, prev[1].y, prev[1].z);
        prev = cur;
      }
      b.part(twoSided(tri), (p) => lava(smooth(0.07, 0.68, p.y) * 0.85 + 0.05), { glow: true });
    }
    // side vents and a smoke plume
    const side1 = mound({ r0: 0.22, h: 0.28, segs: 9, rings: 5, seed: seed * 0.2, rough: 0.3, ox: 0.24 * Math.cos(v + 1), oz: 0.24 * Math.sin(v + 1), maxR: PEAK_R, foot: FOOT_RINGS });
    b.part(side1.g, paint);
    return b.done({ ao: 0.75, aoH: 0.1, sat: 0.8 });
  }
  // rock / snow: one tall main spire plus 2-3 lower shoulders
  const layouts = [
    [[0, 0, 0.42, 0.85, 1.3], [0.22, 0.07, 0.26, 0.5, 1.2], [-0.21, -0.08, 0.26, 0.43, 1.2], [0.03, 0.23, 0.21, 0.31, 1.1]],
    [[-0.05, 0, 0.4, 0.82, 1.45], [0.21, -0.08, 0.28, 0.65, 1.3], [-0.17, 0.18, 0.21, 0.33, 1.1]],
    [[0.03, -0.03, 0.43, 0.85, 1.15], [-0.23, 0.08, 0.25, 0.47, 1.25], [0.21, 0.17, 0.2, 0.33, 1.1], [0.14, -0.21, 0.2, 0.37, 1.2]],
    [[0, 0, 0.38, 0.85, 1.65], [0.23, 0.06, 0.24, 0.56, 1.4], [-0.18, 0.1, 0.24, 0.52, 1.4], [-0.06, -0.22, 0.22, 0.4, 1.3]],
  ][v];
  layouts.forEach(([x, z, r0, h, sharp], i) => {
    const m = mound({ r0, h, segs: i ? 9 : 12, rings: i ? 6 : 9, seed: seed * 0.1 + i * 3.7, rough: 0.32, sharp, ox: x, oz: z, lean: [(R() - 0.5) * 0.08, (R() - 0.5) * 0.08], maxR: PEAK_R, foot: FOOT_RINGS });
    b.part(m.g, paint, { jitter: 0.025, jf: 6, jy: 0.3, floor: 0 });
  });
  // scree boulders and a few small pines at the foot
  const sp = rockPaint(kind === 'snow' ? ROCK_PAL[3] : ROCK_PAL[0], 0.3, 0, kind === 'snow' ? 1 : 0);
  const a0 = R() * 6.28;
  for (let k = 0; k < 2; k++) { const a = a0 + k * 2.4; boulder(b, 0.045 + R() * 0.03, Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.75, sp); }
  const tr = [];
  // rough analytic ground height of the mounds, so the trees sit on the slope
  const hAt = (x, z) => layouts.reduce((mx, [ox, oz, r0, h, sharp]) => { const d = Math.hypot(x - ox, z - oz) / (r0 * 0.9); return d >= 1 ? mx : Math.max(mx, h * (1 - Math.pow(d, 1 / sharp))); }, 0);
  for (let k = 0; k < 3; k++) { const a = a0 + 1.2 + k * 1.9 + R() * 0.4, d = 0.31 + R() * 0.05, x = Math.cos(a) * d, z = Math.sin(a) * d; tr.push([x, z, 0.19 + R() * 0.06, Math.max(0, hAt(x, z) - 0.03)]); }
  addMiniTrees(b, kind, tr);
  return b.done({ ao: 0.75, aoH: 0.1, sat: 0.8 });
}

// ------------------------------------------------------------ crystals
/** crystalModel(i): 0 ice blue, 1 amethyst, 2 emerald, 3 fire ruby. A glowing cluster about 0.5 tall. */
export function crystalModel(i = 0) {
  i = ((i % 4) + 4) % 4;
  const b = new Build(600 + i);
  const pal = [ramp(0x4a6a9a, 0x6a96c4, 0x9cc0dc, 0xc8dcea), ramp(0x6a4a96, 0x8c6abc, 0xb096d4, 0xd0c0e4), ramp(0x3a7a62, 0x54a07e, 0x84c0a2, 0xb8dcc8), ramp(0x8a3a34, 0xb4523e, 0xd0805a, 0xe0b090)][i];
  const glowC = [[0.35, 0.6, 0.85], [0.6, 0.4, 0.85], [0.35, 0.8, 0.55], [0.85, 0.4, 0.15]][i];
  const rock = rockPaint(ROCK_PAL[i === 3 ? 6 : 3], 0.2);
  boulder(b, 0.17, 0, 0, 0.45, rock, 0.3);
  const shards = [[0, 0, 0.07, 0.5, 0, 0], [0.1, 0.04, 0.05, 0.32, -0.1, -0.45], [-0.09, 0.05, 0.05, 0.3, 0.2, 0.5], [0.02, -0.1, 0.045, 0.26, -0.5, 0.1], [0.05, 0.11, 0.035, 0.2, 0.55, -0.2]];
  for (const [x, z, r, h, rx, rz] of shards) {
    const geo = new THREE.CylinderGeometry(r, r * 0.9, h * 0.75, 6).translate(0, h * 0.375, 0);
    const tip = new THREE.ConeGeometry(r, h * 0.25, 6).translate(0, h * 0.75 + h * 0.125, 0);
    const paint = (p, n) => pal(clamp01(0.15 + (p.y / h) * 0.55 + Math.max(0, n.x * 0.5 + n.z * 0.3) * 0.35));
    for (const g of [geo, tip]) b.part(g.rotateX(rx).rotateZ(rz).translate(x, 0.04, z), paint);
  }
  // sparkles
  for (let k = 0; k < 2; k++) { const a = b.rand(0, 6.28); b.part(new THREE.OctahedronGeometry(0.014).translate(Math.cos(a) * 0.2, b.rand(0.1, 0.45), Math.sin(a) * 0.2), glowC, { glow: true }); }
  // round 3: no glowing chips scattered on the ground (they read as pickups)
  return b.done({ ao: 0.7, aoH: 0.1, sat: 0.8, gsat: 0.7 });
}

// ------------------------------------------------------------ mushrooms
/** mushroomModel(i): 0 red toadstools, 1 brown forest caps, 2 glowing swamp caps (about 0.35 tall). */
export function mushroomModel(i = 0) {
  i = ((i % 3) + 3) % 3;
  const b = new Build(700 + i);
  const cap = [ramp(0x8a4a3c, 0xa45e48, 0xbc7a5e), ramp(0x8a6a4a, 0xa4825a, 0xbca078), ramp(0x4a7088, 0x5a8aa0, 0x80aab8)][i];
  const stem = ramp(0xc8c0ae, 0xe2dccc);
  const set = [[0, 0, 0.11, 0.26], [0.13, 0.07, 0.075, 0.17], [-0.1, 0.09, 0.06, 0.12], [0.03, -0.13, 0.05, 0.1]];
  for (const [x, z, r, h] of set) {
    b.part(tubeGeo([V(x, 0, z), V(x + 0.01, h * 0.5, z), V(x, h, z)], [r * 0.38, r * 0.3, r * 0.28], 6), (p) => stem(p.y / h));
    b.part(new THREE.SphereGeometry(r, 9, 4, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.75, 1).translate(x, h - 0.01, z), (p, n) => cap(0.3 + n.y * 0.55 + noise(p.x * 10, p.y * 10, p.z * 10) * 0.1));
    b.part(new THREE.CircleGeometry(r, 9).rotateX(Math.PI / 2).translate(x, h - 0.01, z), L(0xcec2aa));
    if (i === 0 && r > 0.07) for (let k = 0; k < 3; k++) { const a = k * 1.3 + x * 10, el = 0.5 + (k % 3) * 0.3; b.part(ico(r * 0.13, 0).scale(1, 0.5, 1).translate(x + Math.cos(a) * Math.cos(el) * r, h - 0.01 + Math.sin(el) * r * 0.75, z + Math.sin(a) * Math.cos(el) * r), 0xd8ccb8); }
    if (i === 2) { for (let k = 0; k < 2; k++) { const a = k * 1.6 + x * 10, el = 0.6 + (k % 2) * 0.35; b.part(ico(r * 0.15, 0).translate(x + Math.cos(a) * Math.cos(el) * r, h - 0.01 + Math.sin(el) * r * 0.75, z + Math.sin(a) * Math.cos(el) * r), [0.4, 0.8, 0.75], { glow: true }); } b.part(new THREE.CircleGeometry(r * 0.9, 9).rotateX(Math.PI / 2).translate(x, h - 0.012, z), [0.2, 0.55, 0.6], { glow: true }); }
  }
  return b.done({ ao: 0.75, aoH: 0.08, sat: 0.75 });
}

// ------------------------------------------------------------ scattering table
// key grammar for natureModel(): 'oak' (any TREE_KINDS entry), 'bush:N', 'tuft:N',
// 'rock:N', 'crystal:N', 'mushroom:N', 'peak:<rock|snow|volcano>:<variant>'.
const _cache = new Map();
/** natureModel(key): builds (and caches) the model for a FLORA_FOR_TERRAIN key. */
export function natureModel(key) {
  if (_cache.has(key)) return _cache.get(key);
  const [a, b, c] = key.split(':');
  const n = +b || 0;
  const m = a === 'bush' ? bushModel(n) : a === 'tuft' ? tuftModel(n) : a === 'rock' ? rockModel(n) : a === 'crystal' ? crystalModel(n)
    : a === 'mushroom' ? mushroomModel(n) : a === 'peak' ? peakModel(b || 'rock', +c || 0) : treeModel(a);
  _cache.set(key, m);
  return m;
}
/**
 * FLORA_FOR_TERRAIN[terrainId] = {
 *   fill:    [{ key, w }]  weighted pick for tiles that are fully covered (forest trees, mountain peaks),
 *   count:   [min, max]    how many fill models per tile,
 *   fillScale:             suggested instance scale for fill models (main.js units, tree 1u -> ~0.2),
 *   scatter: [{ key, p, s }]  decoration: each entry independently appears on a tile with probability p,
 *                             at suggested scale s. Skip tiles holding objects/roads.
 *                             Optional per entry: avoid: [terrainIds] -> skip the entry when any neighbour has one of
 *                             these terrains; maxLat -> skip when |latitude| (|DIRS[v].y|) is above it.
 *                             (keeps palms/cacti off snow edges and swamp/forest borders, snowy pines off sand)
 * }
 * Forest (9) and mountain (8) also have biome variants in FOREST_BY_BIOME / PEAK_BY_BIOME.
 */
// desert plants never grow next to snow, swamp or forest
const DESERT_AVOID = [4, 5, 9];
export const FLORA_FOR_TERRAIN = {
  0: { scatter: [] },
  1: { scatter: [{ key: 'tuft:0', p: 0.45, s: 0.152 }, { key: 'tuft:1', p: 0.3, s: 0.152 }, { key: 'oak', p: 0.1, s: 0.21 }, { key: 'birch', p: 0.05, s: 0.21 }, { key: 'bush:0', p: 0.075, s: 0.16 }, { key: 'bush:2', p: 0.035, s: 0.16 }, { key: 'bush:1', p: 0.025, s: 0.16 }, { key: 'rock:4', p: 0.05, s: 0.136 }, { key: 'mushroom:0', p: 0.03, s: 0.139 }] },
  2: { scatter: [{ key: 'tuft:3', p: 0.35, s: 0.152 }, { key: 'bush:3', p: 0.15, s: 0.16 }, { key: 'rock:0', p: 0.08, s: 0.136 }, { key: 'rock:1', p: 0.07, s: 0.136 }, { key: 'dead', p: 0.06, s: 0.21 }, { key: 'mushroom:1', p: 0.04, s: 0.139 }] },
  3: { scatter: [{ key: 'cactus', p: 0.1, s: 0.21, avoid: DESERT_AVOID, maxLat: 0.68 }, { key: 'palm', p: 0.07, s: 0.21, avoid: DESERT_AVOID, maxLat: 0.68 }, { key: 'tuft:3', p: 0.2, s: 0.144 }, { key: 'rock:3', p: 0.08, s: 0.136 }, { key: 'bush:3', p: 0.06, s: 0.136 }] },
  4: { scatter: [{ key: 'snowpine', p: 0.14, s: 0.21, avoid: [3, 7] }, { key: 'rock:5', p: 0.12, s: 0.136 }, { key: 'bush:4', p: 0.08, s: 0.152 }, { key: 'crystal:0', p: 0.02, s: 0.16 }] },
  5: { scatter: [{ key: 'tuft:2', p: 0.45, s: 0.167 }, { key: 'willow', p: 0.14, s: 0.21 }, { key: 'dead', p: 0.035, s: 0.21 }, { key: 'bush:5', p: 0.12, s: 0.16 }, { key: 'mushroom:2', p: 0.08, s: 0.139 }] },
  6: { scatter: [{ key: 'rock:0', p: 0.13, s: 0.152 }, { key: 'rock:1', p: 0.12, s: 0.152 }, { key: 'rock:2', p: 0.07, s: 0.152 }, { key: 'rock:3', p: 0.06, s: 0.136 }, { key: 'tuft:3', p: 0.2, s: 0.144 }, { key: 'bush:3', p: 0.08, s: 0.152 }, { key: 'pine', p: 0.05, s: 0.21 }, { key: 'crystal:1', p: 0.02, s: 0.16 }] },
  7: { scatter: [{ key: 'rock:6', p: 0.1, s: 0.152 }, { key: 'burnt', p: 0.07, s: 0.21 }, { key: 'tuft:4', p: 0.12, s: 0.144 }, { key: 'crystal:3', p: 0.04, s: 0.16 }] },
  8: { fill: [{ key: 'peak:rock:0', w: 1 }, { key: 'peak:rock:1', w: 1 }, { key: 'peak:rock:2', w: 1 }, { key: 'peak:rock:3', w: 1 }], count: [1, 1], fillScale: 0.36, scatter: [] },
  9: { fill: [{ key: 'oak', w: 0.5 }, { key: 'pine', w: 0.3 }, { key: 'birch', w: 0.2 }], count: [3, 5], fillScale: 0.21, scatter: [{ key: 'bush:0', p: 0.3, s: 0.152 }, { key: 'mushroom:0', p: 0.08, s: 0.131 }] },
};
// forests and mountains take the look of their surroundings (choose by latitude / neighbouring terrain)
export const FOREST_BY_BIOME = {
  temperate: [{ key: 'oak', w: 0.5 }, { key: 'pine', w: 0.3 }, { key: 'birch', w: 0.2 }],
  cold: [{ key: 'snowpine', w: 0.75 }, { key: 'pine', w: 0.25 }],
  boreal: [{ key: 'pine', w: 0.6 }, { key: 'snowpine', w: 0.25 }, { key: 'birch', w: 0.15 }],
  swamp: [{ key: 'willow', w: 0.6 }, { key: 'dead', w: 0.4 }],
  dry: [{ key: 'pine', w: 0.4 }, { key: 'dead', w: 0.3 }, { key: 'oak', w: 0.3 }],
  sand: [{ key: 'palm', w: 0.7 }, { key: 'cactus', w: 0.3 }],
  lava: [{ key: 'burnt', w: 0.8 }, { key: 'dead', w: 0.2 }],
};
export const PEAK_BY_BIOME = {
  temperate: ['peak:rock:0', 'peak:rock:1', 'peak:rock:2', 'peak:rock:3'],
  boreal: ['peak:snow:0', 'peak:rock:1', 'peak:snow:2', 'peak:rock:3'],
  cold: ['peak:snow:0', 'peak:snow:1', 'peak:snow:2', 'peak:snow:3'],
  lava: ['peak:volcano:0', 'peak:volcano:1', 'peak:volcano:2'],
};
/** biomeOf(terrainIds): picks a FOREST_BY_BIOME / PEAK_BY_BIOME key from the terrain ids around a tile, plus |latitude| 0..1. */
export function biomeOf(neighbourTerrains, lat = 0) {
  const c = new Array(10).fill(0);
  for (const t of neighbourTerrains) c[t]++;
  if (c[7] > 0) return 'lava';
  // snowy pines and snow peaks: touching snow, or within about one ring of the snow line (|lat| > 0.8)
  if (c[4] >= 2 || lat > 0.76) return 'cold';
  if (c[4] > 0) return 'boreal'; // single snow neighbour: mostly green pines with a few frosted ones
  if (c[5] >= 2) return 'swamp';
  // palms and cacti only in real desert: mostly sand around, hardly any lush grass/forest, not polar
  if (c[3] >= 3 && c[1] + c[9] <= 1 && lat < 0.68) return 'sand';
  if (c[3] + c[2] + c[6] >= 2) return 'dry';
  return 'temperate';
}
