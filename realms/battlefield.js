import * as THREE from 'three';

// =====================================================================
// HEX REALMS: tactical battlefield environment, one look per terrain.
//   createBattlefield(THREE, terrainId, hexPos, COLS, ROWS)
//     -> { group, ground, overlay, keepZone, sky, fog, lights, obstacleModel(kind) }
//   keepZone: border props on the siege keep's plot; set keepZone.visible = false during a siege.
//   wallModel / gateModel / towerModel / keepModel(fac), siegeLayout(hexPos, COLS, ROWS, defSide): siege set.
//   obstacleModel(terrainId, kind) -> { body, glow }  (model contract)
// Terrain ids: 1 grass, 2 dirt, 3 sand, 4 snow, 5 swamp, 6 rough, 7 lava;
// anything else is grass. Everything is procedural (canvas + geometry).
// Results are cached per terrain, so re-entering a battle is free.
// =====================================================================

const V3 = THREE.Vector3;

// ------------------------------------------------------------------ random & noise
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, 0, s), b = hash3(xi + 1, yi, 0, s), c = hash3(xi, yi + 1, 0, s), d = hash3(xi + 1, yi + 1, 0, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.5 + vnoise(x * 2.03, y * 2.03, s + 7) * 0.3 + vnoise(x * 4.1, y * 4.1, s + 13) * 0.2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ terrain palettes
const LIN = (h) => new THREE.Color(h);
const TERRAINS = {
  1: { name: 'grass', gk: 0.9, sky: 0x9fd2f6, fog: [0xc6e4f6, 23, 52], sun: [0xfff3d6, 2.6], hemi: [0xdcefff, 0x8ab060, 1.15], amb: [0x8a9ab8, 0.42], exposure: 1.05,
    tint: [0x74bc44, 0x58a63a, 0xa4cc58], grid: [36, 78, 22], gridHi: [236, 255, 190], field: [240, 250, 170], fieldA: 0.08, water: 0x4a9ac8, hill: 0.9, edge: [150, 130, 74], calm: [0.88, 0.8, 0.8], deco: [0.62, 0.16] },
  2: { name: 'dirt', gk: 0.82, sky: 0xb8daf4, fog: [0xecdcc0, 22, 50], sun: [0xffeac4, 2.75], hemi: [0xe8eefa, 0xb08a5c, 1.2], amb: [0x988a90, 0.45], exposure: 1.08,
    tint: [0xc49a68, 0xa87e52, 0xd2b07a], grid: [88, 58, 30], gridHi: [255, 236, 200], field: [255, 236, 196], water: 0x5a9ab0, hill: 0.8, edge: [120, 90, 54], calm: [0.95, 0.78, 0.82], deco: [0.66, 0.16] },
  3: { name: 'sand', gk: 0.8, sky: 0xa8d4f2, fog: [0xf4dcb0, 22, 50], sun: [0xfff0d4, 2.55], hemi: [0xf4f0e8, 0xb88a50, 1.0], amb: [0x988870, 0.38], exposure: 1.0,
    tint: [0xe8c27a, 0xd8a862, 0xf0d090], grid: [150, 104, 50], gridHi: [255, 250, 225], field: [255, 248, 226], water: 0x3aa8c0, hill: 1.2, edge: [196, 150, 90], calm: [1.0, 0.76, 0.86], deco: [0.7, 0.14] },
  4: { name: 'snow', gk: 0.9, sky: 0xb4d8f6, fog: [0xe0ecf8, 21, 48], sun: [0xfff4e4, 2.5], hemi: [0xe4f0ff, 0xa8c0e0, 1.3], amb: [0x8098c0, 0.45], exposure: 0.98,
    tint: [0xf4f8fc, 0xdce8f6, 0xffffff], grid: [90, 120, 170], gridHi: [255, 255, 255], field: [200, 222, 250], water: 0xa8d4f0, hill: 1.0, edge: [150, 176, 214], calm: [1.0, 0.8, 0.88], deco: [0.7, 0.12] },
  5: { name: 'swamp', gk: 0.88, sky: 0xa8cab0, fog: [0xb8d0b0, 21, 48], sun: [0xfff8d4, 2.6], hemi: [0xe4f4d4, 0x7a9450, 1.25], amb: [0x7a9a88, 0.48], exposure: 1.1,
    tint: [0x8aa850, 0x749440, 0xa0b858], grid: [40, 64, 24], gridHi: [220, 244, 170], field: [220, 230, 150], water: 0x3a8a78, hill: 0.5, edge: [96, 110, 50], calm: [0.9, 0.78, 0.8], deco: [0.5, 0.2] },
  6: { name: 'rough', gk: 0.74, sky: 0xb0d0ec, fog: [0xd8d2c4, 22, 50], sun: [0xfff0d8, 2.75], hemi: [0xe4ecf8, 0x9a8a68, 1.2], amb: [0x8a8a98, 0.45], exposure: 1.08,
    tint: [0xbcac88, 0xa49474, 0xcabc98], grid: [76, 64, 46], gridHi: [255, 248, 228], field: [255, 246, 226], water: 0x4a8aa8, hill: 1.4, edge: [130, 112, 84], calm: [1.3, 0.76, 0.8], deco: [0.66, 0.16] },
  7: { name: 'lava', gk: 0.9, sky: 0xb88a74, fog: [0xa87868, 20, 46], sun: [0xffdcb8, 2.5], hemi: [0xf0d0c0, 0x6a4a44, 1.05], amb: [0x8a6a70, 0.5], exposure: 1.05,
    tint: [0x8a7470, 0x7a6460, 0x9a8078], grid: [60, 24, 12], gridHi: [255, 206, 160], hiA: 0.18, field: [244, 216, 196], fieldA: 0.16, water: 0x000000, hill: 1.3, edge: [150, 116, 104], calm: [0.95, 0.8, 0.82], deco: [0.7, 0.12] },
};

// ------------------------------------------------------------------ geometry kit
// Parts are baked to flat, painterly vertex colours: per-face jitter,
// optional vertical gradient (top), optional cap colour on upward faces
// (moss, snow), fake ambient occlusion near the ground, or a custom fn.
const ni = (g) => (g.index ? g.toNonIndexed() : g);
function jitterGeo(g, amt, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = hash3(Math.round(x * 997), Math.round(y * 997), Math.round(z * 997), seed);
    const s = 1 + (k * 2 - 1) * amt;
    p.setXYZ(i, x * s, y * s, z * s);
  }
  return g;
}
const G = {
  cyl: (r1, r2, h, s = 8) => ni(new THREE.CylinderGeometry(r1, r2, h, s).translate(0, h / 2, 0)),
  cone: (r, h, s = 7) => ni(new THREE.ConeGeometry(r, h, s).translate(0, h / 2, 0)),
  box: (w, h, d) => ni(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0)),
  blob: (rad, detail, amt, seed) => jitterGeo(ni(new THREE.IcosahedronGeometry(1, detail)), amt, seed).scale(rad, rad, rad),
  limb(a, b, r1, r2 = r1 * 0.75, s = 6) {
    const va = new V3(...a), vb = new V3(...b), len = va.distanceTo(vb);
    const g = ni(new THREE.CylinderGeometry(r2, r1, len, s));
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), vb.clone().sub(va).normalize()));
    return g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
  },
  // a jagged rock sitting on y=0 (slightly sunk)
  rock(seed, sx, sy, sz, detail = 1, amt = 0.22) {
    const g = jitterGeo(ni(new THREE.IcosahedronGeometry(1, detail)), amt, seed).scale(sx, sy, sz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * 0.3);
    return g.translate(0, sy * 0.12, 0);
  },
  // a flat double-sided leaf from a to b
  leaf(a, b, w) {
    const va = new V3(...a), vb = new V3(...b), d = vb.clone().sub(va), side = new V3(-d.z, 0, d.x).normalize().multiplyScalar(w / 2);
    const m = va.clone().lerp(vb, 0.4).add(new V3(0, w * 0.15, 0)), m1 = m.clone().add(side), m2 = m.clone().sub(side);
    const P = [va, m1, vb, va, vb, m2, va, vb, m1, va, m2, vb].flatMap((v) => [v.x, v.y, v.z]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    return g;
  },
  disc(r, seg, amt, seed) {
    const g = ni(new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const a = Math.atan2(z, x); const s = 1 + (vnoise(Math.cos(a) * 2 + 3, Math.sin(a) * 2 + 3, seed) - 0.5) * amt * 2; p.setX(i, x * s); p.setZ(i, z * s); }
    return g;
  },
};

class Mk {
  constructor(seed) { this.r = mulberry32(seed * 7919 + 13); this.B = []; this.G = []; this.seed = seed; }
  rnd(a, b) { return a + this.r() * (b - a); }
  pick(a) { return a[(this.r() * a.length) | 0]; }
  add(g, c, o = {}) {
    (o.glow ? this.G : this.B).push({ g: ni(g), c: LIN(c), top: o.top != null ? LIN(o.top) : null, h0: o.h0 ?? 0, h1: o.h1 ?? 1,
      cap: o.cap != null ? LIN(o.cap) : null, capT: o.capT ?? 0.6, ao: o.ao ?? 1, jit: o.jit ?? 0.07, fn: o.fn || null });
    return this;
  }
  bake() { return { B: bake(this.B, this.r), G: bake(this.G, this.r) }; }
}
function bake(parts, rng) {
  const pos = [], col = [];
  const a = new V3(), b = new V3(), c = new V3(), e1 = new V3(), e2 = new V3(), n = new V3(), base = new THREE.Color();
  for (const p of parts) {
    const arr = p.g.attributes.position.array;
    for (let i = 0; i + 8 < arr.length; i += 9) {
      a.fromArray(arr, i); b.fromArray(arr, i + 3); c.fromArray(arr, i + 6);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
      const j = 1 + (rng() * 2 - 1) * p.jit;
      for (const v of [a, b, c]) {
        base.copy(p.c);
        if (p.top) base.lerp(p.top, smooth(p.h0, p.h1, v.y));
        if (p.cap && n.y > p.capT) base.lerp(p.cap, smooth(p.capT, p.capT + 0.15, n.y));
        if (p.fn) p.fn(v, base, n);
        // soft, coloured ground occlusion (a cool violet tint, never black) + a sunny lift on upward faces
        const k = p.ao * 0.26 * (1 - smooth(0, 0.3, v.y)), lift = 1 + Math.max(0, n.y) * 0.08;
        pos.push(v.x, v.y, v.z);
        col.push(base.r * j * lift * (1 - k), base.g * j * lift * (1 - k * 1.05), base.b * j * lift * (1 - k * 0.6));
      }
    }
  }
  return { pos, col };
}
function toGeo(d) {
  if (!d.pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(d.col, 3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
const modelOf = (m) => { const d = m.bake(); return { body: toGeo(d.B), glow: toGeo(d.G) }; };

// ------------------------------------------------------------------ props (model space, base at y=0)
const P = {
  roundTree(m, leaf, leafTop, trunk = 0x7e5636) {
    const h = m.rnd(0.85, 1.15), tx = m.rnd(-0.1, 0.1), tz = m.rnd(-0.1, 0.1);
    m.add(G.limb([0, 0, 0], [tx, h + 0.2, tz], 0.14, 0.08), trunk, { top: 0xa07a50, h0: 0, h1: h });
    for (let i = 0; i < 2; i++) { const a = m.rnd(0, 6.28); m.add(G.limb([tx * 0.6, h * 0.6, tz * 0.6], [Math.cos(a) * 0.4, h + 0.25, Math.sin(a) * 0.4], 0.06, 0.04, 5), trunk); }
    const n = 4 + ((m.r() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + m.rnd(0, 1), rr = i === 0 ? 0 : m.rnd(0.3, 0.5), rad = i === 0 ? m.rnd(0.6, 0.72) : m.rnd(0.42, 0.58);
      m.add(G.blob(rad, 1, 0.16, m.seed * 31 + i).translate(Math.cos(a) * rr, h + (i === 0 ? 0.75 : m.rnd(0.25, 0.6)), Math.sin(a) * rr), leaf, { top: leafTop, h0: h, h1: h + 1.3, jit: 0.09, ao: 0 });
    }
  },
  pine(m, col, top, snowy, k = 1) {
    m.add(G.cyl(0.09 * k, 0.13 * k, 0.6 * k, 6), 0x7a5434, { top: 0x946a40, h1: 0.6 * k });
    const n = 4;
    for (let i = 0; i < n; i++) {
      const r = (0.8 - i * 0.16) * k, h = (0.9 - i * 0.08) * k, y = (0.35 + i * 0.42) * k, rot = m.rnd(0, 1);
      m.add(G.cone(r, h, 7).rotateY(rot).translate(0, y, 0), col, { top, h0: 0.3, h1: 2.0, ao: 0, jit: 0.08 });
      if (snowy) m.add(G.cone(r * 0.82, h * 0.55, 7).rotateY(rot).translate(0, y + h * 0.45 + 0.01, 0), 0xf4f8ff, { top: 0xffffff, h0: 0.5, h1: 2, ao: 0, jit: 0.04 });
    }
  },
  deadTree(m, col = 0x7a644c, top = 0xa89478, h = 1.4) {
    const tx = m.rnd(-0.15, 0.15), tz = m.rnd(-0.15, 0.15);
    m.add(G.limb([0, -0.05, 0], [tx, h, tz], 0.12, 0.05, 6), col, { top, h0: 0, h1: h });
    const nb = 4 + ((m.r() * 2) | 0);
    for (let i = 0; i < nb; i++) {
      const t = m.rnd(0.4, 0.9), a = m.rnd(0, 6.28), s = [tx * t, h * t, tz * t], l = m.rnd(0.35, 0.6) * (1.2 - t * 0.5);
      const e = [s[0] + Math.cos(a) * l, s[1] + m.rnd(0.2, 0.45), s[2] + Math.sin(a) * l];
      m.add(G.limb(s, e, 0.05, 0.025, 5), col, { top, h0: 0, h1: h });
      const a2 = a + m.rnd(-0.9, 0.9);
      m.add(G.limb(e, [e[0] + Math.cos(a2) * 0.22, e[1] + m.rnd(0.1, 0.25), e[2] + Math.sin(a2) * 0.22], 0.025, 0.012, 4), top);
    }
    for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.28 + m.rnd(0, 1); m.add(G.limb([0, 0.15, 0], [Math.cos(a) * 0.3, -0.02, Math.sin(a) * 0.3], 0.06, 0.03, 4), col); }
  },
  willow(m) {
    m.add(G.limb([0, 0, 0], [0.1, 1.0, 0], 0.18, 0.11, 6), 0x6a5638, { top: 0x8a7448 });
    m.add(G.blob(1, 1, 0.18, m.seed * 3).scale(0.95, 0.5, 0.95).translate(0.1, 1.45, 0), 0x5a8a30, { top: 0xa0c050, h0: 1.2, h1: 1.9, ao: 0 });
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + m.rnd(0, 0.4), rr = m.rnd(0.7, 0.85), l = m.rnd(0.6, 0.95);
      m.add(G.cone(0.13, l, 5).rotateX(Math.PI).translate(0.1 + Math.cos(a) * rr, 1.42, Math.sin(a) * rr), 0x6a9a34, { top: 0x8ab444, h0: 0.6, h1: 1.4, ao: 0 });
    }
  },
  palm(m) {
    const bend = m.rnd(0.025, 0.05) * (m.r() < 0.5 ? -1 : 1), pts = [];
    for (let i = 0; i <= 5; i++) pts.push([bend * i * i, i * 0.38, 0]);
    for (let i = 0; i < 5; i++) m.add(G.limb(pts[i], pts[i + 1], 0.1 - i * 0.008, 0.085 - i * 0.008, 6), i % 2 ? 0xa88458 : 0xc09a68);
    const t = pts[5];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.28 + m.rnd(0, 0.4), c = Math.cos(a), s = Math.sin(a), l1 = m.rnd(0.45, 0.6);
      const p1 = [t[0] + c * l1, t[1] + 0.18, t[2] + s * l1], p2 = [t[0] + c * (l1 + 0.5), t[1] - 0.25, t[2] + s * (l1 + 0.5)];
      m.add(G.leaf(t, p1, 0.32), 0x5aa83a, { ao: 0 }); m.add(G.leaf(p1, p2, 0.28), 0x8ac84a, { ao: 0 });
    }
    for (let i = 0; i < 3; i++) m.add(G.blob(0.07, 0, 0.1, i).translate(t[0] + Math.cos(i * 2) * 0.1, t[1] - 0.08, t[2] + Math.sin(i * 2) * 0.1), 0x8a6030, { ao: 0 });
  },
  cactus(m) {
    const h = m.rnd(0.9, 1.2), c = 0x5aa858, o = { top: 0x9ad07a, h0: 0, h1: 1.3, jit: 0.05 };
    m.add(G.cyl(0.13, 0.15, h, 8), c, o); m.add(G.blob(0.13, 1, 0, 1).scale(1, 0.8, 1).translate(0, h, 0), c, o);
    for (const sd of [-1, 1]) {
      if (m.r() < 0.25) continue;
      const y = m.rnd(0.35, 0.6) * h, up = m.rnd(0.25, 0.45);
      m.add(G.limb([0, y, 0], [sd * 0.3, y + 0.04, 0], 0.075, 0.075, 6), c, o);
      m.add(G.cyl(0.075, 0.075, up, 6).translate(sd * 0.3, y, 0), c, o);
      m.add(G.blob(0.075, 0, 0, 2).translate(sd * 0.3, y + up, 0), c, o);
    }
    m.add(G.blob(0.05, 0, 0, 3).translate(0, h + 0.1, 0), 0xf06a8a, { ao: 0 });
  },
  bush(m, col, top) {
    const n = 3 + ((m.r() * 2) | 0);
    for (let i = 0; i < n; i++) { const a = m.rnd(0, 6.28), rr = i ? m.rnd(0.15, 0.3) : 0; m.add(G.blob(m.rnd(0.22, 0.36), 1, 0.18, m.seed + i).translate(Math.cos(a) * rr, m.rnd(0.15, 0.28), Math.sin(a) * rr), col, { top, h0: 0, h1: 0.6, jit: 0.1 }); }
  },
  rock(m, col, cap, sx = 1, sy = 0.7, detail = 1) {
    m.add(G.rock(m.seed, sx * m.rnd(0.8, 1.1), sy * m.rnd(0.8, 1.2), sx * m.rnd(0.7, 1), detail).rotateY(m.rnd(0, 6.28)), col, { cap, capT: 0.55, jit: 0.1 });
  },
  rockPile(m, col, cap, s = 1) {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + m.rnd(0, 1), rr = i ? 0.32 * s : 0, sc = (i ? m.rnd(0.18, 0.26) : m.rnd(0.3, 0.36)) * s;
      m.add(G.rock(m.seed * 5 + i, sc * 1.1, sc * m.rnd(0.8, 1.1), sc, 1).rotateY(m.rnd(0, 6)).translate(Math.cos(a) * rr, 0, Math.sin(a) * rr), col, { cap, capT: 0.55, jit: 0.1 });
    }
  },
  spire(m, col, cap, h = 2.2) {
    m.add(G.rock(m.seed, 0.45, h * 0.55, 0.42, 1, 0.25).translate(0, h * 0.25, 0), col, { cap, capT: 0.5, top: cap ?? col, h0: h * 0.3, h1: h * 1.3, jit: 0.1 });
    for (let i = 0; i < 2; i++) { const a = m.rnd(0, 6.28); m.add(G.rock(m.seed + 9 + i, 0.28, h * 0.25, 0.25, 1).translate(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42), col, { cap, capT: 0.5, jit: 0.1 }); }
  },
  column(m, stone, top, h) {
    m.add(G.box(0.55, 0.14, 0.55), stone, { jit: 0.05 });
    m.add(G.cyl(0.17, 0.19, h, 10).translate(0, 0.14, 0), stone, { top, h0: 0, h1: 1.6, jit: 0.04 });
    if (h > 1.2) m.add(G.box(0.48, 0.12, 0.48).translate(0, 0.14 + h, 0), top, { jit: 0.05 });
    else m.add(G.cone(0.17, 0.16, 10).rotateX(Math.PI).rotateZ(0.5).translate(0.02, 0.14 + h + 0.06, 0), top, { jit: 0.1 });
  },
  fallenColumn(m, stone, top) {
    m.add(G.cyl(0.17, 0.17, 1.1, 10).rotateZ(Math.PI / 2).translate(0.55, 0.15, 0).rotateY(m.rnd(0, 6)), stone, { top, h0: 0, h1: 0.4 });
    m.add(G.rock(m.seed, 0.16, 0.12, 0.14, 0).translate(0.5, 0, 0.45), stone);
  },
  ruinWall(m, stone, top, moss) {
    const rows = 4, cols = 4, bw = 0.38;
    for (let r = 0; r < rows; r++) {
      const maxc = r < 2 ? cols : cols - ((m.r() * 3) | 0) - (r - 1);
      for (let c = 0; c < maxc; c++) {
        if (r > 0 && m.r() < 0.12) continue;
        const x = (c - (cols - 1) / 2) * bw + (r % 2 ? bw / 2 : 0) - 0.1;
        m.add(G.box(bw * 0.94, 0.22, 0.32).rotateY(m.rnd(-0.06, 0.06)).translate(x, r * 0.23, m.rnd(-0.03, 0.03)), m.r() < 0.5 ? stone : top, { cap: moss, capT: 0.8, jit: 0.1, ao: 0.6 });
      }
    }
    for (let i = 0; i < 3; i++) m.add(G.box(0.3, 0.18, 0.26).rotateY(m.rnd(0, 3)).rotateZ(m.rnd(-0.3, 0.3)).translate(m.rnd(-0.8, 0.8), 0, m.rnd(0.3, 0.6)), stone, { cap: moss, capT: 0.8, jit: 0.1 });
  },
  fence(m, wood = 0x9a7448) {
    for (let i = 0; i < 3; i++) m.add(G.box(0.08, m.rnd(0.5, 0.6), 0.08).rotateZ(m.rnd(-0.08, 0.08)).translate((i - 1) * 0.6, 0, 0), wood, { top: 0xc09a68, h0: 0, h1: 0.6 });
    for (const y of [0.2, 0.42]) m.add(G.box(1.3, 0.06, 0.04).rotateZ(m.rnd(-0.05, 0.05)).translate(0, y, 0.05), 0xb08a5a, { jit: 0.1 });
  },
  tuft(m, col, top, n = 6, h = 0.32) {
    for (let i = 0; i < n; i++) { const a = m.rnd(0, 6.28); m.add(G.cone(0.035, m.rnd(0.6, 1) * h, 3).rotateX(m.rnd(-0.4, 0.4)).rotateZ(m.rnd(-0.4, 0.4)).translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08), col, { top, h0: 0, h1: h, ao: 0.6 }); }
  },
  flowers(m, col) {
    P.tuft(m, 0x4a9a34, 0x8ccc5a, 5, 0.22);
    for (let i = 0; i < 4; i++) { const a = m.rnd(0, 6.28), rr = m.rnd(0.05, 0.18); m.add(G.blob(0.045, 0, 0, i).translate(Math.cos(a) * rr, m.rnd(0.14, 0.24), Math.sin(a) * rr), col, { ao: 0 }); }
  },
  reeds(m) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = m.rnd(0, 6.28), rr = m.rnd(0, 0.18), h = m.rnd(0.6, 1.05), lx = m.rnd(-0.1, 0.1), lz = m.rnd(-0.1, 0.1), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      m.add(G.limb([x, 0, z], [x + lx, h, z + lz], 0.018, 0.012, 3), 0x6a9a3a, { top: 0xc0c860, h0: 0, h1: 1 });
      if (i % 2 === 0) m.add(G.cyl(0.035, 0.035, 0.16, 5).translate(x + lx * 0.9, h * 0.82, z + lz * 0.9), 0x8a5a30, { ao: 0 });
    }
  },
  mushrooms(m, cap = 0x8a3a8a, glow = 0x7aff9a, n = 3, k = 1) {
    for (let i = 0; i < n; i++) {
      const a = m.rnd(0, 6.28), rr = (i ? m.rnd(0.12, 0.22) : 0) * (k < 1 ? 2 : 1), h = (i ? m.rnd(0.12, 0.2) : 0.28) * k, r = (i ? m.rnd(0.09, 0.13) : 0.18) * k, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      m.add(G.cyl(r * 0.28, r * 0.38, h, 6).translate(x, 0, z), 0xe0d8c0, { ao: 0.5 });
      m.add(ni(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2)).scale(1, 0.75, 1).translate(x, h, z), cap, { top: 0xffffff, h0: h + r * 0.5, h1: h + r * 3, ao: 0 });
      if (glow) for (let k = 0; k < 3; k++) { const b = (k / 3) * 6.28 + i; m.add(G.blob(r * 0.16, 0, 0, k).translate(x + Math.cos(b) * r * 0.55, h + r * 0.5, z + Math.sin(b) * r * 0.55), glow, { glow: true, ao: 0 }); }
    }
  },
  crystals(m, col, glow, n = 5, s = 1, base = 0x8a8494) {
    m.add(G.rock(m.seed, 0.32 * s, 0.14 * s, 0.28 * s, 0), base, { jit: 0.1 });
    for (let i = 0; i < n; i++) {
      const a = m.rnd(0, 6.28), rr = i ? m.rnd(0.08, 0.2) * s : 0, h = (i ? m.rnd(0.25, 0.45) : 0.65) * s, r = (i ? m.rnd(0.05, 0.08) : 0.1) * s;
      const g = G.cyl(r, r * 0.8, h, 6); const tip = G.cone(r, r * 2.4, 6).translate(0, h, 0);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(m.rnd(-0.5, 0.5) * (i ? 1 : 0.3), m.rnd(0, 6), m.rnd(-0.5, 0.5) * (i ? 1 : 0.3)));
      for (const gg of [g, tip]) { gg.applyQuaternion(q).translate(Math.cos(a) * rr, 0.04 * s, Math.sin(a) * rr); m.add(gg, col, { glow: !!glow, top: glow || col, h0: 0, h1: 0.8 * s, ao: 0, jit: 0.15 }); }
    }
  },
  bones(m) {
    const bc = 0xe8dcc0;
    m.add(G.limb([-0.45, 0.06, 0], [0.4, 0.08, 0], 0.035, 0.03, 5), bc);
    for (let i = 0; i < 5; i++) {
      const x = -0.3 + i * 0.13, r = 0.2 - Math.abs(i - 1.5) * 0.02;
      m.add(ni(new THREE.TorusGeometry(r, 0.022, 4, 8, Math.PI)).rotateY(Math.PI / 2).translate(x, 0.05, 0), bc, { ao: 0.5 });
    }
    m.add(G.blob(0.13, 1, 0.05, 4).scale(1.2, 0.9, 1).translate(0.52, 0.11, 0.02), bc, { ao: 0.5 });
    m.add(G.cone(0.04, 0.3, 5).rotateZ(-1.0).rotateY(0.6).translate(0.55, 0.18, 0.08), 0xd8c8a0, { ao: 0 });
    m.add(G.cone(0.04, 0.3, 5).rotateZ(-1.0).rotateY(-0.6).translate(0.55, 0.18, -0.06), 0xd8c8a0, { ao: 0 });
  },
  log(m, wood = 0x8a6038, end = 0xe0b880, moss = 0x6aa83a, L = 1.0, r = 0.14) {
    const o = new THREE.Matrix4().makeRotationY(m.rnd(0, 6.28));
    m.add(G.cyl(r, r * 1.05, L, 8).rotateZ(Math.PI / 2).translate(L / 2, r * 0.9, 0).translate(-L / 2, 0, 0).applyMatrix4(o), wood, { cap: moss, capT: 0.9, jit: 0.1 });
    for (const sd of [-1, 1]) m.add(ni(new THREE.CircleGeometry(r * 0.96, 8)).rotateY(sd * Math.PI / 2).translate(sd * (L / 2 + 0.003), r * 0.9, 0).applyMatrix4(o), end, { fn: (v, c) => { const d = Math.hypot(v.y - r * 0.9, 0); if (d > r * 0.6) c.multiplyScalar(0.8); }, ao: 0 });
    m.add(G.limb([0.1, r * 1.4, 0], [0.25, r * 2.8, 0.1], 0.04, 0.025, 4).applyMatrix4(o), wood);
  },
  stump(m, wood = 0x8a6038, end = 0xe8c48a) {
    m.add(G.cyl(0.2, 0.26, 0.3, 8), wood, { jit: 0.1 });
    m.add(ni(new THREE.CircleGeometry(0.2, 8)).rotateX(-Math.PI / 2).translate(0, 0.302, 0), end, { ao: 0 });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28 + m.rnd(0, 1); m.add(G.limb([0, 0.12, 0], [Math.cos(a) * 0.4, -0.02, Math.sin(a) * 0.4], 0.07, 0.03, 4), wood); }
  },
  mound(m, col, top, k = 1) { m.add(G.blob(1, 1, 0.12, m.seed).scale(m.rnd(0.5, 0.8) * k, m.rnd(0.18, 0.28) * k, m.rnd(0.4, 0.6) * k).translate(0, -0.02, 0), col, { top, h0: 0, h1: 0.2, ao: 0.4, jit: 0.04 }); },
  lavaPool(m, s = 1) {
    m.add(G.disc(0.85 * s, 14, 0.25, m.seed).translate(0, 0.03, 0), 0xffe070, { glow: true, ao: 0, jit: 0.05, fn: (v, c) => c.lerp(LIN(0xff5a10), smooth(0.15 * s, 0.8 * s, Math.hypot(v.x, v.z))) });
    m.add(G.disc(1.05 * s, 14, 0.2, m.seed).translate(0, 0.012, 0), 0x8a4a34, { ao: 0, fn: (v, c) => c.lerp(LIN(0xd86a30), 1 - smooth(0.8 * s, 1.05 * s, Math.hypot(v.x, v.z))) });
    for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28 + m.rnd(0, 0.5), rr = m.rnd(0.85, 1.05) * s; m.add(G.rock(m.seed * 3 + i, 0.16 * s, 0.12 * s, 0.14 * s, 0).translate(Math.cos(a) * rr, 0, Math.sin(a) * rr), 0x7a5a4c, { cap: 0xa88470, capT: 0.6, jit: 0.1, fn: (v, c) => { if (v.y < 0.05 * s) c.lerp(LIN(0xe0602a), 0.5); } }); }
  },
  magmaRock(m, s = 1) {
    m.add(G.blob(0.24 * s, 1, 0.15, m.seed).translate(0, 0.22 * s, 0), 0xffc040, { glow: true, ao: 0, top: 0xff5a18, h0: 0.0, h1: 0.5 * s });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.28 + m.rnd(0, 0.5), rr = 0.17 * s;
      m.add(G.rock(m.seed * 7 + i, 0.22 * s, 0.32 * s, 0.2 * s, 1).rotateY(-a).translate(Math.cos(a) * rr, 0, Math.sin(a) * rr), 0x6a4c42, { cap: 0x9a786a, capT: 0.6, jit: 0.12, fn: (v, c) => { if (v.y < 0.12 * s) c.lerp(LIN(0xe8602a), 0.55); } });
    }
  },
  // a charred tree with glowing ember tips (lava)
  emberTree(m, h = 1.0) {
    P.deadTree(m, 0x5a4440, 0x8a6a60, h);
    for (let i = 0; i < 5; i++) { const a = m.rnd(0, 6.28), r = m.rnd(0.15, 0.45); m.add(G.blob(0.035, 0, 0, i).translate(Math.cos(a) * r, h * m.rnd(0.7, 1.15), Math.sin(a) * r), 0xffa040, { glow: true, ao: 0 }); }
    for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.28 + m.rnd(0, 1); m.add(G.disc(0.08, 6, 0.3, i).translate(Math.cos(a) * 0.32, 0.015, Math.sin(a) * 0.32), 0xff7a2a, { glow: true, ao: 0 }); }
  },
  // a mossy boulder with a skirt of grass and a few flowers
  mossyBoulder(m, stone = 0xa8a294, moss = 0x7ab84a, flower = 0xffe060) {
    m.add(G.rock(m.seed, m.rnd(0.34, 0.4), m.rnd(0.32, 0.4), m.rnd(0.3, 0.36), 1, 0.2).rotateY(m.rnd(0, 6)), stone, { cap: moss, capT: 0.55, jit: 0.08, top: 0xd0ccc0, h0: 0, h1: 0.5 });
    m.add(G.rock(m.seed + 3, 0.18, 0.16, 0.16, 1).translate(0.34, 0, 0.18), stone, { cap: moss, capT: 0.6, jit: 0.08 });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28 + m.rnd(0, 1); m.add(G.cone(0.03, m.rnd(0.14, 0.24), 3).translate(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38), 0x5aa83a, { top: 0xa8dc68, h1: 0.24, ao: 0.4 }); }
    for (let i = 0; i < 4; i++) { const a = m.rnd(0, 6.28), r = m.rnd(0.36, 0.46); m.add(G.blob(0.04, 0, 0, i).translate(Math.cos(a) * r, 0.12, Math.sin(a) * r), i % 2 ? flower : 0xffffff, { ao: 0 }); }
  },
  // a round flowering bush
  flowerBush(m, leaf = 0x4caa38, top = 0x9ad85a, flower = 0xff8ac0, k = 1) {
    P.bush(m, leaf, top);
    for (let i = 0; i < 9; i++) { const a = m.rnd(0, 6.28), e = m.rnd(0.3, 1.2), r = 0.32 * k; m.add(G.blob(0.045, 0, 0, i).translate(Math.cos(a) * r * Math.cos(e * 0.6), 0.22 + Math.sin(e) * 0.28, Math.sin(a) * r * Math.cos(e * 0.6)), i % 3 ? flower : 0xfff4c0, { ao: 0 }); }
  },
  fern(m, col = 0x4a9a34, top = 0x9ad060, n = 6) {
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + m.rnd(0, 0.5), l = m.rnd(0.2, 0.3); m.add(G.leaf([0, 0.02, 0], [Math.cos(a) * l, m.rnd(0.18, 0.3), Math.sin(a) * l], 0.14), col, { top, h0: 0, h1: 0.3, ao: 0.3 }); }
  },
  // pale blue ice shards (snow)
  iceShards(m, s = 1) {
    m.add(G.blob(1, 1, 0.12, m.seed).scale(0.42 * s, 0.1 * s, 0.38 * s), 0xf4f8ff, { ao: 0.2 });
    P.crystals(m, 0xbfe6ff, null, 6, s, 0xdde8f6);
  },
  // a sandstone cairn / standing stone
  standingStone(m, stone = 0xc8b494, top = 0xe8d8b8, h = 0.9) {
    m.add(G.box(0.3, h, 0.2).rotateY(m.rnd(-0.3, 0.3)).rotateZ(m.rnd(-0.08, 0.08)), stone, { top, h0: 0, h1: h, jit: 0.06 });
    m.add(G.rock(m.seed, 0.16, 0.12, 0.14, 0).translate(0.3, 0, 0.12), stone, { jit: 0.1 });
    m.add(G.rock(m.seed + 1, 0.12, 0.09, 0.11, 0).translate(-0.26, 0, 0.18), top, { jit: 0.1 });
  },
  skull(m, x, z, s = 1, bc = 0xf4ead0) {
    m.add(G.blob(0.11 * s, 1, 0.04, 9).scale(1, 0.9, 1.15).translate(x, 0.09 * s, z), bc, { ao: 0.4 });
    for (const sx of [-1, 1]) m.add(G.blob(0.03 * s, 0, 0, 2).translate(x + sx * 0.045 * s, 0.1 * s, z + 0.11 * s), 0x8a6a5a, { ao: 0 });
  },
  lilyPads(m, n = 5, r = 0.5) {
    for (let i = 0; i < n; i++) { const a = m.rnd(0, 6.28), rr = m.rnd(0.1, r); m.add(G.disc(m.rnd(0.06, 0.1), 7, 0.1, i).translate(Math.cos(a) * rr, 0.075, Math.sin(a) * rr), 0x6ab848, { ao: 0, jit: 0.12 }); if (i % 2) m.add(G.blob(0.03, 0, 0, i).translate(Math.cos(a) * rr, 0.1, Math.sin(a) * rr), 0xffb0d8, { ao: 0 }); }
  },
};

// ------------------------------------------------------------------ battlefield obstacles (fit one hex: ~0.85 wide)
// build fn's parts scaled by k about the origin (keeps obstacles short enough never to hide the unit behind)
const shrink = (m, k, fn) => { const n = m.B.length, ng = m.G.length; fn(m); for (const p of m.B.slice(n)) p.g.scale(k, k, k); for (const p of m.G.slice(ng)) p.g.scale(k, k, k); };
// Round 3: every obstacle contrasts with its ground in value AND hue (darker/stronger mass, a lit cap), so it
// reads as "blocked" at a glance; kept saturated while the border decor around the field is calmed.
const OBST = {
  1: [(m) => P.mossyBoulder(m, 0x7e7672, 0x5e9a34, 0xffe060), (m) => { P.log(m, 0x8a5a30, 0xeac48a, 0x5a9a34, 0.85, 0.15); P.mushrooms(m, 0xe84a32, null, 2, 0.6); P.fern(m, 0x3a8a30, 0x7ab84a, 3); },
    (m) => { P.bush(m, 0x2e7a2c, 0x5aa040); for (let i = 0; i < 5; i++) { const a = m.rnd(0, 6.28), e = m.rnd(0.4, 1.1); m.add(G.blob(0.04, 0, 0, i).translate(Math.cos(a) * 0.3 * Math.cos(e * 0.6), 0.22 + Math.sin(e) * 0.26, Math.sin(a) * 0.3 * Math.cos(e * 0.6)), 0xe83a3a, { ao: 0 }); } }],
  2: [(m) => { P.rockPile(m, 0x6e6058, 0xa89880); P.tuft(m, 0x6a7a2c, 0xa8b050, 4, 0.26); }, (m) => { shrink(m, 0.5, (m) => P.roundTree(m, 0xd8682a, 0xffb848, 0x6a4a30)); P.tuft(m, 0x8a8a40, 0xc8c070, 3, 0.22); }, (m) => { P.column(m, 0xe0d4bc, 0xf8f0dc, 0.55); m.add(G.rock(5, 0.14, 0.1, 0.12, 0).translate(0.32, 0, 0.2), 0x6e6058); m.add(G.rock(6, 0.1, 0.08, 0.1, 0).translate(-0.28, 0, 0.26), 0x84766a); }],
  3: [(m) => m.add(G.rock(m.seed, 0.4, 0.42, 0.34, 1, 0.2), 0xb86e48, { fn: (v, c) => c.multiplyScalar(0.92 + 0.14 * Math.sin(v.y * 22)), jit: 0.06, cap: 0xe0a070, capT: 0.7 }), (m) => { shrink(m, 0.82, (m) => P.cactus(m)); m.add(G.rock(m.seed, 0.12, 0.09, 0.1, 0).translate(0.3, 0, 0.15), 0xb07450); }, (m) => { P.bones(m); P.skull(m, -0.3, 0.3, 1.1); }],
  4: [(m) => P.rockPile(m, 0x7c8aa4, 0xe8f0fa), (m) => { m.add(G.blob(1, 1, 0.12, m.seed).scale(0.42, 0.1, 0.38), 0xc8d8ec, { ao: 0.2 }); P.crystals(m, 0x4aa0e0, null, 6, 1, 0x8a9ab4); }, (m) => { P.pine(m, 0x22684a, 0x4a9a70, true, 0.42); P.mound(m, 0xdce6f4, 0xf4f8ff, 0.6); }],
  5: [(m) => { P.log(m, 0x6a4a2c, 0xc8a878, 0x6aa838, 0.9, 0.15); P.mushrooms(m, 0xb04ac0, 0x9affc0, 2, 0.8); }, (m) => { P.deadTree(m, 0x5e4a34, 0x8a7a58, 0.75); P.fern(m, 0x3e7a2e, 0x7aa848, 4); }, (m) => P.mushrooms(m, 0xa04ad0, 0x9affc0, 4, 1.6)],
  6: [(m) => P.spire(m, 0x5a5466, 0x8a8494, 0.9), (m) => P.crystals(m, 0x3a62d8, 0x5a8aff, 6, 1, 0x5a5466), (m) => P.rockPile(m, 0x5e5866, 0x8e8898, 1.1)],
  7: [(m) => P.magmaRock(m), (m) => { P.spire(m, 0x4e3c3a, 0x8a6e64, 0.95); m.add(G.disc(0.3, 9, 0.2, 2).translate(0.25, 0.02, 0.2), 0xff8a30, { glow: true, ao: 0 }); }, (m) => P.emberTree(m, 0.75)],
};
const terId = (t) => (TERRAINS[t] ? t : 1);
const obstCache = new Map();
export function obstacleModel(terrainId, kind = 0) {
  const t = terId(terrainId), k = ((kind % 3) + 3) % 3, key = t * 10 + k;
  if (!obstCache.has(key)) { const m = new Mk(t * 100 + k * 7 + 3); OBST[t][k](m); obstCache.set(key, modelOf(m)); }
  return obstCache.get(key);
}

// ------------------------------------------------------------------ siege: town wall segment, gate posts and arrow tower
// Optional nicer replacements for main.js's grey boxes, under the model contract ({ body, glow }).
//   wallModel(fac)  one wall hex: spans x -0.45..0.45 (adjacent hexes join seamlessly), z -0.27..0.27,
//                   walkway at y 0.68, merlons up to ~0.9. The visible (+Z) face looks at the camera.
//   gateModel(fac)  two short gate towers on the gate hex's left/right edges (x = +-0.45); nothing spans
//                   the hex itself, so units in the gateway are never hidden.
//   towerModel(fac) the arrow tower: radius ~0.6, crenellations at y ~2.0-2.3, roof tip ~3.2.
// fac: 'haven' (white limestone, blue roofs, gold), 'necro' (violet-grey stone, bone, crimson, green glow);
// anything else gets a neutral warm stone.
const SIEGE = {
  haven: { stone: 0xe4dac4, light: 0xfaf4e4, base: 0xc8bca2, roof: 0x3a7ae0, roofTop: 0x7ab4ff, trim: 0xe8c050, banner: 0x2a62d0, emblem: 0xf4d060, glow: 0xffd27a, moss: 0x8ab84a },
  necro: { stone: 0xa49ab4, light: 0xc8c0d6, base: 0x8a8098, roof: 0x8a2e6e, roofTop: 0xc85a9e, trim: 0xece0c4, banner: 0xb0263c, emblem: 0xece0c4, glow: 0x7affa8, moss: 0x7a9a5a },
  other: { stone: 0xd4c4a4, light: 0xeee2c6, base: 0xb8a684, roof: 0xc0603a, roofTop: 0xe8905a, trim: 0xf0d8a0, banner: 0xc04a3a, emblem: 0xf4e0a0, glow: 0xffc870, moss: 0x8ab84a },
};
const sfac = (fac) => SIEGE[fac] || SIEGE.other;
// a coursed band of jittered stone blocks between x0..x1, y0..y1, on a slab of depth d
function masonry(m, S, x0, x1, y0, y1, d, rows, perRow, z = 0) {
  const rh = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 0.5 : 0, bw = (x1 - x0) / perRow;
    for (let k = -1; k < perRow + 1; k++) {
      let a = x0 + (k + off) * bw, b = a + bw;
      a = Math.max(a, x0); b = Math.min(b, x1); if (b - a < 0.02) continue;
      const col = m.pick([S.stone, S.stone, S.light, S.base]);
      m.add(G.box((b - a) * 0.97, rh * 0.94, d + m.rnd(-0.01, 0.02)).translate((a + b) / 2, y0 + r * rh, z), col, { jit: 0.06, ao: r ? 0.2 : 1 });
    }
  }
}
const siegeCache = new Map();
const siegeModel = (key, f) => { if (!siegeCache.has(key)) { const m = new Mk(key.length * 13 + key.charCodeAt(0)); f(m); siegeCache.set(key, modelOf(m)); } return siegeCache.get(key); };
// The wall is deliberately low (merlons ~0.62) and sits WALL_Z toward the attackers (+Z), so defenders on
// the two rows behind it stay visible from the three-quarter battle camera instead of seeming to stand on it.
export const WALL_Z = 0.16;
export function wallModel(fac) {
  const S = sfac(fac);
  return siegeModel('wall' + fac, (m) => {
    const z = WALL_Z;
    m.add(G.box(0.92, 0.1, 0.5).translate(0, 0, z), S.base, { jit: 0.05 }); // plinth
    masonry(m, S, -0.45, 0.45, 0.08, 0.42, 0.4, 3, 3, z);
    m.add(G.box(0.92, 0.06, 0.46).translate(0, 0.41, z), S.light, { jit: 0.04, ao: 0 }); // walkway coping
    for (const x of [-0.29, 0, 0.29]) {
      m.add(G.box(0.19, 0.16, 0.16).translate(x, 0.46, z + 0.13), m.pick([S.stone, S.light]), { jit: 0.05, ao: 0 });
      m.add(G.box(0.21, 0.03, 0.18).translate(x, 0.61, z + 0.13), S.light, { ao: 0 });
    }
    // a hanging banner with the faction emblem on the attackers' (+Z) face
    m.add(G.box(0.2, 0.26, 0.012).translate(0, 0.12, z + 0.208), S.banner, { top: S.banner, ao: 0, jit: 0.03 });
    m.add(G.box(0.24, 0.025, 0.03).translate(0, 0.38, z + 0.212), S.trim, { ao: 0 });
    m.add(G.blob(0.04, 0, 0, 3).scale(1, 1, 0.35).translate(0, 0.26, z + 0.22), S.emblem, { ao: 0 });
    for (let i = 0; i < 5; i++) m.add(G.cone(0.03, m.rnd(0.08, 0.16), 3).translate(m.rnd(-0.42, 0.42), 0, z + m.rnd(0.22, 0.27)), S.moss, { ao: 0.3 });
  });
}
// The gatehouse: two slim towers with pointed faction roofs on the gate hex's left/right edges, an open pair of
// timber doors folded back toward the defenders and a raised portcullis bar. Nothing spans the hex at unit
// height, so a stack standing in the gateway is never hidden.
export function gateModel(fac) {
  const S = sfac(fac);
  return siegeModel('gate' + fac, (m) => {
    const z = WALL_Z;
    for (const sx of [-1, 1]) {
      const x = sx * 0.47;
      m.add(G.box(0.3, 0.1, 0.56).translate(x, 0, z), S.base, { jit: 0.05 });
      masonry(m, S, x - 0.13, x + 0.13, 0.08, 0.78, 0.5, 5, 1, z);
      m.add(G.box(0.34, 0.05, 0.54).translate(x, 0.78, z), S.trim, { ao: 0 });
      for (const dz of [-0.17, 0.17]) for (const dx of [-0.1, 0.1]) m.add(G.box(0.09, 0.1, 0.1).translate(x + dx, 0.82, z + dz), S.light, { ao: 0, jit: 0.05 });
      m.add(G.cone(0.2, 0.36, 4).rotateY(Math.PI / 4).translate(x, 0.84, z), S.roof, { top: S.roofTop, h0: 0.85, h1: 1.2, ao: 0, jit: 0.04 });
      m.add(G.cyl(0.01, 0.01, 0.16, 4).translate(x, 1.18, z), S.trim, { ao: 0 });
      m.add(G.box(0.012, 0.08, 0.14).translate(x, 1.27, z + 0.07), S.banner, { ao: 0 });
      m.add(G.box(0.05, 0.13, 0.015).translate(x, 0.5, z + 0.257), S.glow, { glow: true, ao: 0 }); // arrow slit glow
      m.add(G.box(0.04, 0.14, 0.02).translate(x - sx * 0.14, 0.62, z + 0.25), S.trim, { ao: 0 }); // gold hinge plate
      // an open door leaf swung back (toward -Z, the defenders' side)
      const door = G.box(0.32, 0.5, 0.035).translate(-sx * 0.16, 0, 0).rotateY(sx * 1.25).translate(x - sx * 0.14, 0.02, z - 0.2);
      m.add(door, 0x9a6a3c, { top: 0xc89660, h0: 0, h1: 0.5, ao: 0.3, jit: 0.05 });
    }
    // a gold arch-moulding on the ground line and a raised portcullis bar high above the gateway
    m.add(G.box(0.66, 0.025, 0.08).translate(0, 0.005, z + 0.24), S.trim, { ao: 0 });
    m.add(G.box(0.7, 0.07, 0.07).translate(0, 0.74, z + 0.22), S.trim, { ao: 0 });
    for (const dx of [-0.24, -0.08, 0.08, 0.24]) m.add(G.cone(0.02, 0.08, 4).rotateX(Math.PI).translate(dx, 0.74, z + 0.22), 0x8a8494, { ao: 0 });
  });
}
export function towerModel(fac) {
  const S = sfac(fac);
  return siegeModel('tower' + fac, (m) => {
    m.add(G.cyl(0.62, 0.68, 0.18, 12), S.base, { jit: 0.05 });
    // coursed round masonry: rings of slightly rotated segments
    const rings = 8, h0 = 0.16, h1 = 1.92, rh = (h1 - h0) / rings;
    for (let r = 0; r < rings; r++) {
      const rad = 0.56 - r * 0.012;
      m.add(G.cyl(rad, rad + 0.012, rh * 0.96, 12).rotateY((r % 2) * 0.26).translate(0, h0 + r * rh, 0), m.pick([S.stone, S.light, S.stone]), { jit: 0.07, ao: r ? 0.15 : 1 });
    }
    m.add(G.cyl(0.66, 0.6, 0.1, 12).translate(0, 1.9, 0), S.trim, { ao: 0 }); // corbel band
    m.add(G.cyl(0.66, 0.66, 0.14, 12).translate(0, 2.0, 0), S.light, { ao: 0 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; m.add(G.box(0.2, 0.18, 0.14).rotateY(-a + Math.PI / 2).translate(Math.cos(a) * 0.58, 2.14, Math.sin(a) * 0.58), S.stone, { jit: 0.05, ao: 0 }); }
    // conical roof with a gold finial and pennant
    m.add(G.cone(0.6, 0.95, 12).translate(0, 2.18, 0), S.roof, { top: S.roofTop, h0: 2.2, h1: 3.1, ao: 0, jit: 0.05 });
    m.add(G.cyl(0.62, 0.6, 0.05, 12).translate(0, 2.16, 0), S.trim, { ao: 0 });
    m.add(G.cyl(0.015, 0.015, 0.3, 4).translate(0, 3.08, 0), S.trim, { ao: 0 });
    m.add(G.blob(0.04, 0, 0, 1).translate(0, 3.12, 0), S.trim, { ao: 0 });
    m.add(G.box(0.012, 0.11, 0.26).translate(0, 3.24, 0.13), S.banner, { ao: 0 });
    // glowing windows and arrow slits all round (one faces the camera)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.283 + Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
      m.add(G.box(0.1, 0.2, 0.02).rotateY(-a + Math.PI / 2).translate(c * 0.565, 1.4, sn * 0.565), S.glow, { glow: true, ao: 0 });
      m.add(G.box(0.05, 0.18, 0.02).rotateY(-a + Math.PI / 2).translate(c * 0.57, 0.72, sn * 0.57), S.glow, { glow: true, ao: 0 });
      m.add(G.box(0.16, 0.04, 0.05).rotateY(-a + Math.PI / 2).translate(c * 0.58, 1.29, sn * 0.58), S.trim, { ao: 0 });
    }
    // a door at the foot and a banner on the face
    m.add(G.box(0.24, 0.36, 0.04).translate(0, 0.16, 0.56), 0x8a5a34, { top: 0xb07a48, ao: 0.4 });
    m.add(G.box(0.22, 0.42, 0.015).translate(0, 0.92, 0.585), S.banner, { ao: 0 });
    m.add(G.blob(0.05, 0, 0, 3).scale(1, 1, 0.35).translate(0, 1.16, 0.6), S.emblem, { ao: 0 });
    for (let i = 0; i < 7; i++) { const a = m.rnd(0, 6.28); m.add(G.cone(0.035, m.rnd(0.1, 0.2), 3).translate(Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68), S.moss, { ao: 0.3 }); }
  });
}

// The keep: a faction castle silhouette standing behind the defenders, beyond the last row, as in HoMM3.
// About 5.8 wide x 2.6 deep, roof tips up to ~5.3; front (+Z) faces the field. Off the grid, never over units.
export function keepModel(fac) {
  const S = sfac(fac), necro = fac === 'necro';
  return siegeModel('keep' + fac, (m) => {
    const bone = 0xf0e6cc;
    // a banded stone block: courses of slightly varied colour, lighter towards the top
    const block = (w, h, d, x, z, y0 = 0) => {
      const n = Math.max(2, Math.round(h / 0.32));
      for (let i = 0; i < n; i++) m.add(G.box(w - (i % 2) * 0.02, (h / n) * 0.97, d - (i % 2) * 0.02).translate(x, y0 + (i * h) / n, z), m.pick([S.stone, S.stone, S.light, S.base]), { top: S.light, h0: y0, h1: y0 + h * 1.4, jit: 0.05, ao: i ? 0.15 : 1 });
    };
    const merlons = (x0, x1, y, z, d = 0.16) => {
      const n = Math.max(2, Math.round((x1 - x0) / 0.32));
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        m.add(G.box(0.17, 0.2, d).translate(x, y, z), m.pick([S.stone, S.light]), { ao: 0, jit: 0.05 });
        if (necro && i % 2 === 0) m.add(G.cone(0.05, 0.3, 4).rotateX(-0.25).translate(x, y + 0.18, z + 0.03), bone, { ao: 0 });
      }
    };
    const roofed = (x, z, r, h, rh, seg = 8) => {
      for (let i = 0, n = Math.max(3, Math.round(h / 0.35)); i < n; i++) m.add(G.cyl(r - i * 0.006, r - i * 0.006 + 0.01, (h / n) * 0.97, seg).rotateY((i % 2) * 0.3).translate(x, (i * h) / n, z), m.pick([S.stone, S.light, S.stone]), { top: S.light, h0: 0, h1: h * 1.3, jit: 0.06, ao: i ? 0.15 : 1 });
      m.add(G.cyl(r + 0.07, r, 0.1, seg).translate(x, h - 0.02, z), S.trim, { ao: 0 });
      for (let i = 0; i < seg; i++) { const a = (i / seg) * 6.283; m.add(G.box(0.12, 0.14, 0.1).rotateY(-a + Math.PI / 2).translate(x + Math.cos(a) * (r + 0.02), h + 0.08, z + Math.sin(a) * (r + 0.02)), S.light, { ao: 0, jit: 0.05 }); }
      if (necro) m.add(G.cone(r + 0.08, rh, seg).translate(x, h + 0.05, z), S.roof, { top: S.roofTop, h0: h, h1: h + rh, ao: 0, jit: 0.05, fn: (v, c) => { if (v.y < h + rh * 0.35) c.lerp(LIN(0x7a5a8a), 0.35); } });
      else m.add(G.cone(r + 0.1, rh, seg).translate(x, h + 0.05, z), S.roof, { top: S.roofTop, h0: h, h1: h + rh, ao: 0, jit: 0.05 });
      m.add(G.cyl(0.015, 0.015, 0.28, 4).translate(x, h + rh, z), S.trim, { ao: 0 });
      m.add(G.blob(0.045, 0, 0, 2).translate(x, h + rh + 0.05, z), necro ? bone : S.trim, { ao: 0 });
      m.add(G.box(0.012, 0.12, 0.3).translate(x, h + rh + 0.16, z + 0.15), S.banner, { ao: 0 });
      // two lit windows on the front
      for (const fy of [h * 0.45, h * 0.75]) m.add(G.box(0.1, 0.18, 0.02).translate(x, fy, z + r - 0.01), S.glow, { glow: true, ao: 0 });
    };
    // curtain wall with a grand central gate
    for (const sx of [-1, 1]) block(1.6, 1.25, 0.55, sx * 1.7, 0.5);
    block(1.8, 0.5, 0.55, 0, 0.5, 0.95);
    merlons(-2.4, 2.4, 1.3, 0.7);
    m.add(G.box(5.0, 0.06, 0.6).translate(0, 1.25, 0.5), S.trim, { ao: 0 });
    // the gateway: timber doors under a gold lintel, a lantern glow at the threshold
    m.add(G.box(0.96, 0.92, 0.04).translate(0, 0, 0.77), 0x8a5a34, { top: 0xc08a54, h0: 0, h1: 0.9, ao: 0.3, jit: 0.04 });
    for (const dx of [-0.24, 0, 0.24]) m.add(G.box(0.03, 0.9, 0.02).translate(dx, 0, 0.795), 0x6a4a3a, { ao: 0 });
    m.add(G.box(0.7, 0.05, 0.02).translate(0, 0.02, 0.8), necro ? S.glow : 0xffd27a, { glow: true, ao: 0 });
    m.add(G.box(1.18, 0.12, 0.08).translate(0, 0.95, 0.8), S.trim, { ao: 0 });
    for (const sx of [-1, 1]) {
      m.add(G.box(0.36, 0.5, 0.015).translate(sx * 1.6, 0.42, 0.785), S.banner, { top: S.banner, ao: 0 });
      m.add(G.blob(0.07, 0, 0, 3).scale(1, 1, 0.35).translate(sx * 1.6, 0.7, 0.8), S.emblem, { ao: 0 });
      roofed(sx * 2.55, 0.45, 0.42, 1.75, 0.85); // curtain corner turrets
      roofed(sx * 1.25, -0.55, 0.36, 3.0, 0.95); // keep turrets
    }
    // the great keep and its donjon
    block(2.1, 2.5, 1.5, 0, -0.75);
    merlons(-1.0, 1.0, 2.5, -0.06, 0.14);
    m.add(G.box(2.2, 0.08, 1.6).translate(0, 2.46, -0.75), S.trim, { ao: 0 });
    m.add(G.box(1.5, 0.8, 0.02).translate(0, 1.35, 0.005), S.banner, { top: S.banner, ao: 0 });
    m.add(G.blob(0.16, 1, 0, 4).scale(1, 1, 0.35).translate(0, 1.72, 0.03), S.emblem, { ao: 0 });
    if (necro) for (const sx of [-1, 1]) m.add(G.limb([sx * 0.25, 1.2, 0.03], [sx * 0.6, 2.0, 0.03], 0.04, 0.03, 4), bone, { ao: 0 }); // crossed bones
    for (const sx of [-0.55, 0.55]) m.add(G.box(0.14, 0.26, 0.02).translate(sx, 2.0, 0.01), S.glow, { glow: true, ao: 0 });
    roofed(0, -1.0, 0.6, 3.7, 1.55, 10);
    if (necro) for (const sx of [-1, 1]) m.add(G.blob(0.06, 0, 0, 5).translate(sx * 0.3, 3.0, -0.4), S.glow, { glow: true, ao: 0 }); // green spirit lights
    // a grassy mound at the foot so it sits on the land
    for (let i = 0; i < 14; i++) m.add(G.cone(0.05, m.rnd(0.12, 0.26), 3).translate(m.rnd(-3.5, 3.5), 0, m.rnd(0.78, 0.95)), S.moss, { ao: 0.3 });
  });
}
// Where the siege pieces go, in battle-scene units (hexPos is main.js's), for the defending side defSide.
//   walls: rotate wall/gate meshes by wallRotY (they face +Z: toward attackers when the defenders hold the top).
//   towers: two symmetric arrow towers, scaled towerScale, just outside the defenders' back corners, so they
//     frame the keep, stay inside a portrait phone's frame and never hide a unit. towers[0] is the shooter.
//   keep: behind the defenders' last row (null when the defenders hold the bottom, which faces the camera).
export function siegeLayout(hexPos, COLS, ROWS, defSide = 1) {
  const top = defSide === 1, back = top ? 0 : ROWS - 1, dir = top ? -1 : 1;
  let minX = Infinity, maxX = -Infinity;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = hexPos(c, r); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
  const cx = (minX + maxX) / 2, hx = (maxX - minX) / 2, zBack = hexPos(0, back).z;
  if (top) {
    const tz = zBack - 0.95, tx = hx + 0.25;
    return { wallRotY: 0, towerScale: 0.82, towers: [new V3(cx + tx, 0, tz), new V3(cx - tx, 0, tz)], keep: new V3(cx, 0, zBack - 2.7), keepScale: 0.85 };
  }
  // defenders at the bottom (facing the camera): there is no room beside the grid, so smaller towers stand
  // on the wall row's end hexes (walls anyway, never occupied) and the keep is skipped (it would fill the foreground)
  const zw = hexPos(0, ROWS - 3).z - 0.1;
  return { wallRotY: Math.PI, towerScale: 0.6, towers: [new V3(cx + hx - 0.45, 0, zw), new V3(cx - hx + 0.45, 0, zw)], keep: null, keepScale: 1 };
}

// ------------------------------------------------------------------ border decoration per terrain
// [builder, weight, zone, [minScale, maxScale], footprint radius]
// zone: 'tall' only far/side (never in front of the camera), 'low' anywhere, 'scatter' small filler.
const DECO = {
  1: [
    [(m) => P.roundTree(m, m.pick([0x4aa232, 0x56ae38, 0x3e9a34]), m.pick([0xa8dc58, 0xb8e060])), 6, 'tall', [1.2, 1.6], 1.0],
    [(m) => P.pine(m, 0x2e7a3a, 0x5ab050), 1.2, 'tall', [1.1, 1.4], 0.8],
    [(m) => P.flowerBush(m, 0x4caa38, 0x9ad85a, m.pick([0xff8ac0, 0xffe060, 0xffffff])), 0.7, 'low', [1, 1.4], 0.5],
    [(m) => P.bush(m, 0x48a434, 0x9ad04a), 2.5, 'low', [1, 1.5], 0.5],
    [(m) => P.mossyBoulder(m), 1.6, 'low', [0.9, 1.4], 0.5],
    [(m) => P.stump(m), 0.5, 'low', [1, 1.2], 0.4],
    [(m) => P.flowers(m, m.pick([0xffe060, 0xffffff, 0xff8ac0])), 0.8, 'scatter', [1, 1.3], 0.25],
    [(m) => P.tuft(m, 0x4a9a34, 0x9ad060), 4, 'scatter', [1, 1.5], 0.2],
    [(m) => P.fern(m), 1.5, 'scatter', [1, 1.3], 0.3],
  ],
  2: [
    [(m) => P.roundTree(m, m.pick([0xe0782a, 0xd0602a, 0xe0a830]), 0xffd060, 0x8a6040), 4, 'tall', [1.1, 1.5], 1.0],
    [(m) => P.deadTree(m, 0x8a7258, 0xb8a488, 1.5), 1.2, 'tall', [1.1, 1.5], 0.6],
    [(m) => P.ruinWall(m, 0xd0c0a0, 0xe8dcc0, 0x8aa84a), 1.2, 'tall', [1, 1.3], 0.9],
    [(m) => P.column(m, 0xd4c4a4, 0xf0e4c8, m.rnd(0.6, 1.8)), 1.2, 'tall', [1, 1.3], 0.4],
    [(m) => P.fallenColumn(m, 0xd4c4a4, 0xf0e4c8), 0.8, 'low', [1, 1.2], 0.7],
    [(m) => P.rock(m, 0xb8a080, 0xd8c4a0, 0.5, 0.4), 2.5, 'low', [0.8, 1.6], 0.5],
    [(m) => P.bush(m, 0xa8982e, 0xe0c040), 2, 'low', [0.8, 1.2], 0.45],
    [(m) => P.tuft(m, 0xa89a48, 0xe0d070), 4, 'scatter', [1, 1.4], 0.2],
    [(m) => P.flowers(m, m.pick([0xffe060, 0xff9a40, 0xffffff])), 0.5, 'scatter', [1, 1.3], 0.25],
  ],
  3: [
    [(m) => P.palm(m), 3, 'tall', [1.2, 1.6], 0.8],
    [(m) => P.cactus(m), 2.5, 'tall', [1.2, 1.7], 0.4],
    [(m) => P.spire(m, 0xe0a868, 0xf8d498, 2.0), 1.5, 'tall', [1, 1.5], 0.8],
    [(m) => P.column(m, 0xf0dcb0, 0xfff0d0, m.rnd(0.5, 1.8)), 1.2, 'tall', [1, 1.3], 0.4],
    [(m) => P.standingStone(m, 0xe8c48a, 0xfce4b0, m.rnd(0.6, 1.0)), 1, 'low', [1, 1.3], 0.4],
    [(m) => P.rock(m, 0xe0ae6a, 0xf8dca0, 0.55, 0.45), 2.5, 'low', [0.8, 1.6], 0.5],
    [(m) => { P.bones(m); P.skull(m, -0.3, 0.3); }, 0.6, 'low', [1, 1.3], 0.6],
    [(m) => P.tuft(m, 0xb0b050, 0xe8d880, 5, 0.26), 2.5, 'scatter', [1, 1.4], 0.2],
  ],
  4: [
    [(m) => P.pine(m, 0x2e7a5a, 0x5aa880, true), 7, 'tall', [1.1, 1.7], 0.85],
    [(m) => P.deadTree(m, 0x8a7a6c, 0xf4f8ff, 1.4), 0.8, 'tall', [1.1, 1.4], 0.6],
    [(m) => P.iceShards(m, 1.5), 1, 'low', [1, 1.3], 0.5],
    [(m) => P.rock(m, 0xa8b4c8, 0xfafcff, 0.55, 0.45), 3, 'low', [0.8, 1.6], 0.5],
    [(m) => P.mound(m, 0xf0f6fe, 0xffffff), 2.5, 'low', [1, 2], 0.6],
    [(m) => P.rock(m, 0x9aa8bc, 0xf0f6ff, 0.18, 0.12, 0), 3, 'scatter', [1, 1.5], 0.2],
  ],
  5: [
    [(m) => P.willow(m), 5, 'tall', [1.2, 1.6], 1.0],
    [(m) => P.deadTree(m, 0x7a6a48, 0xa8a070, 1.6), 1.5, 'tall', [1.1, 1.5], 0.6],
    [(m) => P.reeds(m), 4, 'low', [0.9, 1.3], 0.3],
    [(m) => P.mushrooms(m, 0xa04ad0, 0x9affc0, 3), 1.6, 'low', [1.2, 1.8], 0.3],
    [(m) => P.log(m, 0x7a6038, 0xc8b080, 0x7ac040, 1.2, 0.16), 1, 'low', [1, 1.2], 0.7],
    [(m) => P.bush(m, 0x5a9a3a, 0x9ac050), 2, 'low', [0.9, 1.3], 0.45],
    [(m) => P.tuft(m, 0x6a9a3a, 0xa8c860, 6, 0.35), 4, 'scatter', [1, 1.4], 0.2],
    [(m) => P.fern(m, 0x5a9a3a, 0xa0c860), 2, 'scatter', [1, 1.3], 0.3],
  ],
  6: [
    [(m) => P.spire(m, 0xa89c84, 0xccc0a4, 2.4), 3.5, 'tall', [1, 1.5], 0.8],
    [(m) => P.deadTree(m, 0x8a7258, 0xb8a488, 1.4), 1, 'tall', [1.1, 1.4], 0.6],
    [(m) => P.pine(m, 0x3a7a4a, 0x6aa860), 1, 'tall', [1, 1.3], 0.8],
    [(m) => P.ruinWall(m, 0xb8b0a0, 0xd4ccbc, 0x8aa84a), 0.8, 'tall', [1, 1.2], 0.9],
    [(m) => P.rock(m, 0xa89c84, 0xccc0a4, 0.6, 0.5), 5, 'low', [0.8, 1.8], 0.55],
    [(m) => P.crystals(m, 0x6a9aff, 0xa8d0ff, 5, 1.3, 0xa49c8c), 0.8, 'low', [1, 1.3], 0.4],
    [(m) => P.rock(m, 0xb4a890, 0xd8cdb0, 0.2, 0.15, 0), 4, 'scatter', [1, 1.5], 0.2],
    [(m) => P.tuft(m, 0x8a9a4a, 0xc8c870, 4, 0.24), 1.5, 'scatter', [1, 1.3], 0.2],
  ],
  7: [
    [(m) => P.spire(m, 0x6a5450, 0x9a7e74, 2.6), 4, 'tall', [1, 1.5], 0.8],
    [(m) => P.emberTree(m, 1.5), 2, 'tall', [1.1, 1.4], 0.6],
    [(m) => P.lavaPool(m), 2, 'low', [0.8, 1.4], 1.1],
    [(m) => P.magmaRock(m, 1.4), 1, 'low', [1, 1.3], 0.5],
    [(m) => P.rock(m, 0x7a5a4c, 0xa88470, 0.5, 0.45), 3, 'low', [0.8, 1.6], 0.5],
    [(m) => P.crystals(m, 0xff7a3a, 0xff9a4a, 5, 1.2, 0x7a5a4c), 0.7, 'low', [1, 1.3], 0.4],
    [(m) => P.rock(m, 0x8a6454, 0xb08a74, 0.2, 0.15, 0), 3, 'scatter', [1, 1.5], 0.2],
  ],
};

// ------------------------------------------------------------------ canvas painting
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// draw fn at (x,y) and at its wrapped copies so the texture tiles
function wrap(S, x, y, r, fn) { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) if (x + dx + r > 0 && x + dx - r < S && y + dy + r > 0 && y + dy - r < S) fn(x + dx, y + dy); }
function wrap9(ctx, S, fn) { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); } }
function blobs(ctx, S, R, n, cols, a, r0, r1, sy = 1) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, r = r0 + R() * (r1 - r0), c = cols[(R() * cols.length) | 0];
    wrap(S, x, y, r, (X, Y) => { const g = ctx.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X, Y, r, r * sy, 0, 0, 6.29); ctx.fill(); });
  }
}
function strokes(ctx, S, R, n, cols, a, l0, l1, w) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, l = l0 + R() * (l1 - l0), ang = R() * 6.28, c = cols[(R() * cols.length) | 0];
    wrap(S, x, y, l, (X, Y) => { ctx.strokeStyle = rgba(c, a); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + Math.cos(ang + 0.5) * l * 0.5, Y + Math.sin(ang + 0.5) * l * 0.5, X + Math.cos(ang) * l, Y + Math.sin(ang) * l); ctx.stroke(); });
  }
}
function pebbles(ctx, S, R, n, cols, r0, r1, sh = 0.3, shc = [90, 70, 90]) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, r = r0 + R() * (r1 - r0), c = cols[(R() * cols.length) | 0], ry = r * (0.6 + R() * 0.3), rot = R() * 3;
    wrap(S, x, y, r + 3, (X, Y) => {
      ctx.fillStyle = rgba(shc, sh); ctx.beginPath(); ctx.ellipse(X + r * 0.25, Y + r * 0.3, r, ry, rot, 0, 6.29); ctx.fill();
      ctx.fillStyle = rgba(c, 1); ctx.beginPath(); ctx.ellipse(X, Y, r, ry, rot, 0, 6.29); ctx.fill();
      ctx.fillStyle = rgba(mixc(c, [255, 255, 255], 0.35), 0.8); ctx.beginPath(); ctx.ellipse(X - r * 0.25, Y - ry * 0.3, r * 0.45, ry * 0.4, rot, 0, 6.29); ctx.fill();
    });
  }
}
function cracks(ctx, S, R, n, steps, len, draw) {
  const paths = [];
  for (let i = 0; i < n; i++) {
    let x = R() * S, y = R() * S, a = R() * 6.28; const pts = [[x, y]];
    for (let k = 0; k < steps; k++) { a += (R() - 0.5) * 1.4; x += Math.cos(a) * len; y += Math.sin(a) * len; pts.push([x, y]); if (R() < 0.15) paths.push(branchFrom(R, x, y, a + (R() < 0.5 ? 1 : -1), steps / 2, len * 0.8)); }
    paths.push(pts);
  }
  wrap9(ctx, S, () => { for (const p of paths) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (const q of p) ctx.lineTo(q[0], q[1]); draw(); } });
}
function branchFrom(R, x, y, a, steps, len) { const pts = [[x, y]]; for (let k = 0; k < steps; k++) { a += (R() - 0.5) * 1.2; x += Math.cos(a) * len; y += Math.sin(a) * len; pts.push([x, y]); } return pts; }

// desaturate + compress contrast around the mean + scale value (sat, con, val); returns the mean sRGB colour
function calmCanvas(x, S, [sat, con, val] = [1, 1, 1]) {
  const im = x.getImageData(0, 0, S, S), d = im.data, n = S * S;
  let mr = 0, mg = 0, mb = 0;
  for (let i = 0; i < d.length; i += 4) { mr += d[i]; mg += d[i + 1]; mb += d[i + 2]; }
  mr /= n; mg /= n; mb /= n;
  const ml = 0.299 * mr + 0.587 * mg + 0.114 * mb;
  const tr = ml + (mr - ml) * sat, tg = ml + (mg - ml) * sat, tb = ml + (mb - ml) * sat;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], l = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i] = (tr + (l + (r - l) * sat - tr) * con) * val; d[i + 1] = (tg + (l + (g - l) * sat - tg) * con) * val; d[i + 2] = (tb + (l + (b - l) * sat - tb) * con) * val;
  }
  x.putImageData(im, 0, 0);
  return [tr * val, tg * val, tb * val];
}
// ground detail texture (tiles every TILE world units)
const TILE = 4;
function paintGround(t) {
  const S = 512, c = mkCanvas(S, S), x = c.getContext('2d'), R = mulberry32(t * 911 + 5);
  let em = null;
  const fill = (col) => { x.fillStyle = rgba(col, 1); x.fillRect(0, 0, S, S); };
  // soft sunny dapples: big warm light pools and cool coloured shade pools, never black
  const dapple = (light, shade, n = 26, a = 0.16) => { blobs(x, S, R, n, [light], a, 40, 110, 0.7); blobs(x, S, R, (n * 0.6) | 0, [shade], a * 0.8, 40, 100, 0.7); };
  // Round 3 (figure/ground): the ground is a calm backdrop. Large soft tonal shapes carry the look; the
  // high-frequency confetti (flowers, pebbles, specks, blade strokes) is sparse and low-contrast, and the
  // whole canvas is desaturated / contrast-compressed at the end (pal.calm) so the units pop on top of it.
  if (t === 1) {
    fill([104, 164, 64]);
    blobs(x, S, R, 70, [[88, 146, 58], [124, 178, 76], [96, 156, 62], [138, 184, 86]], 0.32, 60, 150, 0.8);
    blobs(x, S, R, 120, [[90, 150, 56], [126, 182, 76]], 0.22, 18, 50);
    dapple([206, 222, 140], [74, 128, 86], 20, 0.13);
    strokes(x, S, R, 700, [[80, 138, 52], [88, 146, 56]], 0.28, 4, 9, 1.4);
    strokes(x, S, R, 500, [[160, 200, 112]], 0.26, 3, 8, 1.2);
    blobs(x, S, R, 14, [[176, 160, 110]], 0.12, 14, 30);
    // a few muted flower specks only
    for (let i = 0; i < 16; i++) { const px = R() * S, py = R() * S, fc = [[236, 226, 160], [236, 236, 226], [226, 190, 206]][(R() * 3) | 0]; wrap(S, px, py, 4, (X, Y) => { x.fillStyle = rgba(fc, 0.55); x.beginPath(); x.arc(X, Y, 1.8, 0, 6.29); x.fill(); }); }
  } else if (t === 2) {
    fill([182, 146, 104]);
    blobs(x, S, R, 70, [[166, 130, 92], [200, 166, 122], [158, 124, 88], [192, 158, 114]], 0.34, 60, 150, 0.8);
    blobs(x, S, R, 100, [[170, 134, 94], [196, 160, 116]], 0.24, 18, 50);
    dapple([226, 202, 156], [146, 118, 112], 20, 0.13);
    x.lineCap = 'round'; cracks(x, S, R, 8, 9, 9, () => { x.strokeStyle = 'rgba(130,96,66,0.26)'; x.lineWidth = 1.6; x.stroke(); });
    strokes(x, S, R, 260, [[156, 120, 84]], 0.22, 3, 7, 1.3);
    pebbles(x, S, R, 60, [[200, 182, 156], [184, 164, 138]], 1.5, 4, 0.16, [130, 100, 84]);
    strokes(x, S, R, 140, [[150, 156, 90], [170, 170, 96]], 0.32, 4, 8, 1.4);
  } else if (t === 3) {
    fill([230, 198, 140]);
    blobs(x, S, R, 60, [[218, 182, 124], [240, 214, 164], [224, 190, 132]], 0.36, 60, 160, 0.7);
    dapple([250, 236, 200], [208, 172, 144], 16, 0.12);
    x.lineCap = 'round';
    for (let k = 0; k < 12; k++) {
      const y0 = (k * S) / 12 + R() * 10, ph = R() * 6.28, amp = 5 + R() * 6, n = 1 + ((R() * 2) | 0);
      for (const [off, col, a, w] of [[4, [206, 166, 116], 0.2, 5], [0, [252, 236, 200], 0.28, 3]]) {
        wrap9(x, S, () => { x.beginPath(); for (let px = 0; px <= S; px += 8) { const py = y0 + off + Math.sin((px / S) * 6.283 * n + ph) * amp; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.strokeStyle = rgba(col, a); x.lineWidth = w; x.stroke(); });
      }
    }
    pebbles(x, S, R, 16, [[214, 184, 144], [200, 168, 130]], 1.5, 3.5, 0.14, [190, 150, 110]);
  } else if (t === 4) {
    fill([232, 238, 248]);
    blobs(x, S, R, 70, [[214, 226, 244], [244, 248, 254], [204, 218, 240], [226, 234, 248]], 0.4, 60, 160, 0.6);
    dapple([252, 248, 236], [186, 204, 238], 16, 0.16);
    strokes(x, S, R, 50, [[206, 220, 242]], 0.2, 30, 70, 5);
    strokes(x, S, R, 40, [[252, 253, 255]], 0.3, 25, 60, 4);
    pebbles(x, S, R, 10, [[160, 170, 188]], 1.5, 3.5, 0.1, [150, 170, 220]);
    for (let i = 0; i < 120; i++) { const px = R() * S, py = R() * S; x.fillStyle = `rgba(255,255,255,${0.25 + R() * 0.3})`; x.fillRect(px, py, 1.4, 1.4); }
  } else if (t === 5) {
    fill([128, 150, 84]);
    blobs(x, S, R, 70, [[112, 136, 74], [148, 168, 96], [108, 134, 84], [138, 146, 90]], 0.36, 60, 150, 0.8);
    blobs(x, S, R, 110, [[116, 140, 76], [144, 162, 92]], 0.24, 18, 50);
    dapple([196, 212, 132], [86, 120, 110], 20, 0.13);
    for (let i = 0; i < 2; i++) {
      const px = R() * S, py = R() * S, rx = 22 + R() * 26, ry = rx * (0.5 + R() * 0.4), rot = R() * 3;
      wrap(S, px, py, rx + 8, (X, Y) => {
        x.fillStyle = 'rgba(104,124,72,0.4)'; x.beginPath(); x.ellipse(X, Y, rx + 6, ry + 6, rot, 0, 6.29); x.fill();
        const g = x.createRadialGradient(X, Y, 0, X, Y, rx); g.addColorStop(0, 'rgba(98,140,124,1)'); g.addColorStop(1, 'rgba(118,148,108,1)');
        x.fillStyle = g; x.beginPath(); x.ellipse(X, Y, rx, ry, rot, 0, 6.29); x.fill();
        x.strokeStyle = 'rgba(220,240,230,0.3)'; x.lineWidth = 2; x.beginPath(); x.ellipse(X - rx * 0.2, Y - ry * 0.3, rx * 0.5, ry * 0.3, rot, 3.6, 5.2); x.stroke();
      });
    }
    strokes(x, S, R, 500, [[104, 130, 66], [160, 180, 104]], 0.26, 4, 10, 1.4);
    blobs(x, S, R, 30, [[164, 188, 100]], 0.18, 4, 10);
  } else if (t === 6) {
    fill([186, 172, 144]);
    blobs(x, S, R, 70, [[170, 156, 128], [204, 192, 164], [176, 162, 136]], 0.36, 60, 150, 0.8);
    dapple([236, 224, 196], [154, 144, 150], 20, 0.13);
    for (let i = 0; i < 300; i++) { const px = R() * S, py = R() * S, g = 160 + R() * 50; x.fillStyle = `rgba(${g},${g * 0.94},${g * 0.84},0.28)`; x.fillRect(px, py, 2, 2); }
    // a few big, soft-edged flat slabs (no bright bevels)
    for (let i = 0; i < 12; i++) {
      const l = 0.96 + R() * 0.1, px = R() * S, py = R() * S, r = 22 + R() * 30, n = 6 + ((R() * 3) | 0), base = [196 * l, 184 * l, 158 * l], pts = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + R() * 0.4; pts.push([Math.cos(a) * r * (0.7 + R() * 0.3), Math.sin(a) * r * (0.6 + R() * 0.3)]); }
      wrap(S, px, py, r + 4, (X, Y) => {
        const path = () => { x.beginPath(); pts.forEach((p, k) => (k ? x.lineTo(X + p[0], Y + p[1]) : x.moveTo(X + p[0], Y + p[1]))); x.closePath(); };
        x.save(); x.translate(1.5, 2); path(); x.fillStyle = 'rgba(130,112,104,0.18)'; x.fill(); x.restore();
        path(); x.fillStyle = rgba(base, 0.7); x.fill();
      });
    }
    x.lineCap = 'round'; cracks(x, S, R, 6, 8, 10, () => { x.strokeStyle = 'rgba(128,112,92,0.24)'; x.lineWidth = 1.4; x.stroke(); });
    strokes(x, S, R, 90, [[146, 156, 96], [170, 174, 110]], 0.3, 3, 7, 1.3);
  } else if (t === 7) {
    fill([140, 116, 108]);
    blobs(x, S, R, 70, [[126, 102, 96], [158, 130, 116], [120, 98, 98], [166, 134, 118]], 0.38, 60, 150, 0.8);
    dapple([212, 172, 140], [116, 96, 112], 20, 0.13);
    pebbles(x, S, R, 50, [[128, 106, 102], [148, 124, 116]], 2, 5, 0.18, [96, 72, 78]);
    em = mkCanvas(S, S); const e = em.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
    const R2 = mulberry32(77), R3 = mulberry32(77);
    x.lineCap = e.lineCap = 'round'; x.lineJoin = e.lineJoin = 'round';
    // fewer, thinner, dimmer magma veins: a hint of heat, not a light show under the units
    cracks(x, S, R2, 3, 10, 11, () => { x.strokeStyle = 'rgba(104,64,54,0.6)'; x.lineWidth = 5; x.stroke(); x.strokeStyle = 'rgba(200,96,50,0.85)'; x.lineWidth = 2; x.stroke(); });
    cracks(e, S, R3, 3, 10, 11, () => { e.strokeStyle = 'rgba(255,70,10,0.12)'; e.lineWidth = 6; e.stroke(); e.strokeStyle = 'rgba(255,100,24,0.55)'; e.lineWidth = 1.6; e.stroke(); });
  }
  const mean = calmCanvas(x, S, TERRAINS[t].calm);
  const tex = (cv) => { const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; };
  return { map: tex(c), emissive: em ? tex(em) : null, mean };
}

// painted hex grid overlay, mapped exactly over the field
function paintGrid(t, hexPos, COLS, ROWS, HS, bounds) {
  const pal = TERRAINS[t], { x0, z0, W, D } = bounds;
  const CH = 1024, CW = Math.round((CH * W) / D), sx = CW / W, sz = CH / D, R = mulberry32(t * 31 + 1);
  const c = mkCanvas(CW, CH), x = c.getContext('2d');
  const toC = (px, pz) => [(px - x0) * sx, (pz - z0) * sz];
  const corner = (p, i, s = 1) => toC(p.x + Math.sin((i / 6) * Math.PI * 2) * HS * s, p.z + Math.cos((i / 6) * Math.PI * 2) * HS * s);
  const hexPath = (p, s) => { x.beginPath(); for (let i = 0; i < 6; i++) { const q = corner(p, i, s); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); } x.closePath(); };
  const cells = [];
  for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) cells.push(hexPos(cc, r));
  // a soft painted frame: the field reads as a sunlit, slightly trodden clearing whose rim melts into the land
  x.filter = 'blur(14px)';
  for (const p of cells) { hexPath(p, 1.25); x.fillStyle = rgba(pal.edge, 0.2); x.fill(); }
  x.filter = 'blur(6px)';
  for (const p of cells) { hexPath(p, 1.02); x.fillStyle = rgba(pal.field, (pal.fieldA ?? 0.14) * 0.5); x.fill(); }
  x.filter = 'none';
  // a faint varied tint per hex
  for (const p of cells) { hexPath(p, 1); x.fillStyle = rgba(pal.field, 0.02 + R() * 0.04); x.fill(); }
  // unique edges
  const edges = new Map();
  for (const p of cells) for (let i = 0; i < 6; i++) {
    const a = corner(p, i), b = corner(p, i + 1), k = `${Math.round((a[0] + b[0]) * 2)},${Math.round((a[1] + b[1]) * 2)}`;
    if (!edges.has(k)) edges.set(k, [a, b, 0.7 + R() * 0.3]);
  }
  x.lineCap = 'round';
  const pass = (col, a, w, blur) => {
    x.filter = blur ? `blur(${blur}px)` : 'none';
    for (const [p, q, f] of edges.values()) { x.strokeStyle = rgba(col, a * f); x.lineWidth = w; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); }
    x.filter = 'none';
  };
  pass(pal.grid, 0.3, 7, 3);
  pass(pal.grid, 0.66, 2.2, 0);
  // inner bevel highlight, like a gently painted tile edge
  for (const p of cells) { hexPath(p, 0.9); x.strokeStyle = rgba(pal.gridHi, (pal.hiA ?? 0.16) + R() * 0.06); x.lineWidth = 1.8; x.stroke(); }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  return tx;
}

// ------------------------------------------------------------------ the battlefield
const fieldCache = new Map();
export function createBattlefield(_THREE, terrainId, hexPos, COLS, ROWS) {
  const t = terId(terrainId);
  if (fieldCache.has(t)) return fieldCache.get(t);
  const pal = TERRAINS[t], HS = 0.5;
  const group = new THREE.Group(); group.name = 'battlefield';

  // field bounds from the actual hex layout
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = hexPos(c, r); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, hx = (maxX - minX) / 2 + HS + 0.15, hz = (maxZ - minZ) / 2 + HS + 0.15;
  const outside = (x, z) => Math.hypot(Math.max(0, Math.abs(x - cx) - hx), Math.max(0, Math.abs(z - cz) - hz));
  const sd = t * 101;
  const groundH = (x, z) => {
    const e = outside(x, z), near = z > cz + hz ? 0.35 : 1; // keep the strip in front of the camera low
    return smooth(0.3, 4, e) * (0.15 + fbm(x * 0.13, z * 0.13, sd) * 1.1) * pal.hill * near - 0.02;
  };

  // ground: big displaced plane, tiled painted texture + low-frequency vertex tint
  const gt = paintGround(t);
  const gg = new THREE.PlaneGeometry(64, 56, 72, 64).rotateX(-Math.PI / 2).translate(0, 0, -6);
  const gp = gg.attributes.position, uv = gg.attributes.uv, cols = [], c0 = LIN(pal.tint[0]), c1 = LIN(pal.tint[1]), c2 = LIN(pal.tint[2]), tmp = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), h = groundH(x, z);
    gp.setY(i, h); uv.setXY(i, x / TILE, -z / TILE);
    const n = fbm(x * 0.18 + 5, z * 0.18, sd + 3), n2 = vnoise(x * 0.6, z * 0.6, sd + 9);
    tmp.copy(c0).lerp(c1, smooth(0.35, 0.7, n)).lerp(c2, smooth(0.55, 0.8, n2) * 0.6);
    // large soft tonal shapes (value, low frequency) with only half of the hue swing between the tints
    const lum = 1.0 + (n - 0.5) * 0.16 + (n2 - 0.5) * 0.08 + Math.min(h, 1.2) * 0.06;
    const rr = tmp.r / c0.r, rg = tmp.g / c0.g, rb = tmp.b / c0.b, ra = (rr + rg + rb) / 3;
    cols.push((ra + (rr - ra) * 0.5) * lum, (ra + (rg - ra) * 0.5) * lum, (ra + (rb - ra) * 0.5) * lum);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(cols.map((v) => Math.min(v, 1.4)), 3));
  gg.computeVertexNormals();
  const gmat = new THREE.MeshStandardMaterial({ map: gt.map, vertexColors: true, roughness: 1, metalness: 0 });
  gmat.color.setScalar(pal.gk ?? 1); // mid-value ground: the units and obstacles carry the light end of the range
  if (gt.emissive) { gmat.emissiveMap = gt.emissive; gmat.emissive.set(0xff7a30); gmat.emissiveIntensity = 1.0; }
  const ground = new THREE.Mesh(gg, gmat); ground.receiveShadow = true; ground.name = 'ground';
  group.add(ground);

  // grid overlay
  const MG = 0.8, b = { x0: cx - hx - MG, z0: cz - hz - MG, W: hx * 2 + MG * 2, D: hz * 2 + MG * 2 };
  const gridTex = paintGrid(t, hexPos, COLS, ROWS, HS, b);
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(b.W, b.D).rotateX(-Math.PI / 2).translate(cx, 0.004, cz),
    new THREE.MeshStandardMaterial({ map: gridTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  overlay.receiveShadow = true; overlay.renderOrder = -1; overlay.name = 'grid';
  group.add(overlay);

  // border decoration, merged into one body + one glow mesh
  const R = mulberry32(t * 7 + 99), spec = DECO[t], items = [];
  const tot = (z) => spec.filter((s) => (z === 'tall' ? s[2] !== 'scatter' : z === 'low' ? s[2] === 'low' : s[2] === 'scatter')).reduce((a, s) => a + s[1], 0);
  const choose = (zone) => { const list = spec.filter((s) => (zone === 'tall' ? s[2] !== 'scatter' : zone === 'low' ? s[2] === 'low' : s[2] === 'scatter')); let w = R() * tot(zone); for (const s of list) { w -= s[1]; if (w <= 0) return s; } return list[0]; };
  const placed = [];
  const free = (x, z, r) => placed.every((p) => Math.hypot(p[0] - x, p[1] - z) > (p[2] + r) * 0.8);
  const inView = (x, z) => z < 7.5 && Math.abs(x) < 7 + Math.max(0, -z) * 0.75 && z > -22;
  // keep the siege tower spots (beside the last column, top and bottom rows) clear
  for (const r of [0, ROWS - 1]) { const p = hexPos(COLS - 1, r); placed.push([p.x + 1.1, p.z, 1.0]); }
  for (const ds of [0, 1]) for (const p of siegeLayout(hexPos, COLS, ROWS, ds).towers) placed.push([p.x, p.z, 0.75]);
  // props on the keep's plot go in a separate mesh (res.keepZone) that main.js hides during a siege
  const kp = siegeLayout(hexPos, COLS, ROWS, 1).keep, inKeep = (x, z) => Math.abs(x - kp.x) < 4.4 && z < kp.z + 1.4 && z > kp.z - 2.4;
  // occlusion guard: a prop may never hide any part of a unit standing on any hex, from any battle camera
  // (yaw -0.6..0.6, distance 8..18, as main.js orbits it), so the border can never cover units.
  const cams = [];
  for (const yw of [-0.6, -0.3, 0, 0.3, 0.6]) for (const d of [8, 12.5, 18]) cams.push([Math.sin(yw) * d * 0.55, d, Math.cos(yw) * d * 0.55 + 0.4]);
  const targets = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = hexPos(c, r); for (const y of [0.1, 0.6, 1.1, 1.6]) targets.push([p.x, y, p.z]); }
  const hides = (x, z, rad, top) => {
    for (const C of cams) for (const Q of targets) {
      const dx = Q[0] - C[0], dz = Q[2] - C[2], fx = C[0] - x, fz = C[2] - z;
      const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), Cc = fx * fx + fz * fz - rad * rad, disc = B * B - 4 * A * Cc;
      if (disc <= 0) continue;
      const sq = Math.sqrt(disc), t0 = Math.max(0, (-B - sq) / (2 * A)), t1 = Math.min(1, (-B + sq) / (2 * A));
      if (t1 <= t0) continue;
      if (C[1] + (Q[1] - C[1]) * t1 < top) return true; // lowest point of the ray inside the prop is below its top
    }
    return false;
  };
  let seedN = 0;
  const tryPlace = (s, x, z, sc, rot) => {
    const m = new Mk(t * 1000 + (seedN++) * 17 + 1); s[0](m); const d = m.bake();
    let top = 0, rad = 0;
    for (let i = 0; i < d.B.pos.length; i += 3) { top = Math.max(top, d.B.pos[i + 1]); rad = Math.max(rad, Math.hypot(d.B.pos[i], d.B.pos[i + 2])); }
    for (let i = 0; i < d.G.pos.length; i += 3) { top = Math.max(top, d.G.pos[i + 1]); rad = Math.max(rad, Math.hypot(d.G.pos[i], d.G.pos[i + 2])); }
    if (hides(x, z, rad * sc * 0.9 + 0.22, top * sc - 0.02)) return false;
    placed.push([x, z, s[4] * sc]); items.push([d, x, z, sc, rot]);
    return true;
  };
  for (let i = 0, n = 0; i < 2500 && n < 95; i++) {
    const x = (R() * 2 - 1) * 20, z = -22 + R() * 30, e = outside(x, z);
    if (e < 0.25 || !inView(x, z)) continue;
    const front = z > cz + hz - 0.2 && Math.abs(x - cx) < hx + 1.8; // between camera and field: keep it low
    const dens = fbm(x * 0.22, z * 0.22, sd + 21);
    let s = choose(front || e < 1.2 ? 'low' : 'tall');
    if (front) { if (s[4] > 0.56 || R() < 0.5) continue; }
    if (s[2] === 'tall' && dens < 0.42) s = choose('low');
    if (s[2] === 'low' && R() > 0.55 + e * 0.1) continue;
    const sc = (s[3][0] + R() * (s[3][1] - s[3][0])) * (front ? 0.65 : 1), rad = s[4] * sc;
    if (e < rad * 0.6 || !free(x, z, rad)) continue;
    if (tryPlace(s, x, z, sc)) n++;
  }
  for (let i = 0, n = 0; i < 1500 && n < 80; i++) {
    const x = (R() * 2 - 1) * 14, z = -18 + R() * 25, e = outside(x, z);
    if (e < 0.1 || !inView(x, z)) continue;
    const s = choose('scatter'), sc = s[3][0] + R() * (s[3][1] - s[3][0]);
    if (!free(x, z, s[4] * sc)) continue;
    if (tryPlace(s, x, z, sc)) n++;
  }
  // fences framing the near corners (grass / dirt)
  if (t === 1 || t === 2) for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
    const x = cx + sx * (hx + 0.5 + k * 1.25), z = cz + hz + 0.35 - k * 0.5;
    tryPlace([(m) => P.fence(m), 0, 'low', [1, 1], 0.6], x, z, 1, sx * (0.25 + k * 0.35));
  }
  // low filler in front of the camera (this strip is a big part of a portrait screen)
  for (let i = 0, n = 0; i < 600 && n < 30; i++) {
    const x = cx + (R() * 2 - 1) * (hx + 2), z = cz + hz + 0.2 + R() * 4, e = outside(x, z);
    if (e < 0.15) continue;
    const s = R() < 0.75 ? choose('scatter') : choose('low');
    if (s[4] > 0.56) continue;
    const sc = (s[3][0] + R() * (s[3][1] - s[3][0])) * (s[2] === 'low' ? 0.6 : 1);
    if (!free(x, z, s[4] * sc)) continue;
    if (tryPlace(s, x, z, sc)) n++;
  }
  // water: ponds / puddles / ice sheets (not on lava)
  const waterParts = [];
  if (t !== 7) {
    const nW = t === 5 ? 9 : t === 3 || t === 6 || t === 2 ? 1 : 2;
    for (let i = 0, n = 0; i < 400 && n < nW; i++) {
      const x = (R() * 2 - 1) * 10, z = -16 + R() * 12, e = outside(x, z), r = t === 5 ? 0.8 + R() * 1.4 : 1.4 + R() * 1.2;
      if (e < r + 0.4 || !inView(x, z) || !free(x, z, r)) continue;
      placed.push([x, z, r]);
      waterParts.push(G.disc(r, 16, 0.3, i + t).scale(1, 1, 0.7 + R() * 0.3).rotateY(R() * 3).translate(x, groundH(x, z) + 0.06, z));
      if (t === 5 || t === 1) tryPlace([(m) => P.lilyPads(m, 6, r * 0.7), 0, 'low', [1, 1], 0], x, z, 1, 0);
      if (t !== 4) for (let k = 0; k < 4; k++) { const a = R() * 6.28; tryPlace([(m) => P.reeds(m), 0, 'low', [1, 1], 0.3], x + Math.cos(a) * r * 0.95, z + Math.sin(a) * r * 0.75, 0.8 + R() * 0.3); }
      n++;
    }
  }

  const all = { pos: [], col: [] }, glow = { pos: [], col: [] }, mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new V3();
  const append = (dst, src) => { for (let i = 0; i < src.pos.length; i += 3) { v.set(src.pos[i], src.pos[i + 1], src.pos[i + 2]).applyMatrix4(mtx); dst.pos.push(v.x, v.y, v.z); } for (const c of src.col) dst.col.push(c); };
  const kAll = { pos: [], col: [] }, kGlow = { pos: [], col: [] };
  // border decor recedes: desaturated and pulled a little toward the ground's mean colour, so it frames the field
  // without competing with the units and obstacles (obstacles inside the grid keep their full colour)
  const [dSat, dMix] = pal.deco, gm0 = new THREE.Color().setRGB(gt.mean[0] / 255, gt.mean[1] / 255, gt.mean[2] / 255, THREE.SRGBColorSpace);
  const recede = (src, glowy) => {
    const c = src.col;
    for (let i = 0; i < c.length; i += 3) {
      if (glowy) { c[i] *= 0.8; c[i + 1] *= 0.8; c[i + 2] *= 0.8; continue; }
      const l = c[i] * 0.2126 + c[i + 1] * 0.7152 + c[i + 2] * 0.0722;
      for (let k = 0; k < 3; k++) { const v0 = l + (c[i + k] - l) * dSat; c[i + k] = v0 + ([gm0.r, gm0.g, gm0.b][k] - v0) * dMix; }
    }
  };
  for (const it of items) { recede(it[0].B, false); recede(it[0].G, true); }
  items.forEach(([d, x, z, sc, rot]) => {
    // sink into slopes a little
    const y = Math.min(groundH(x, z), groundH(x + 0.4, z), groundH(x - 0.4, z), groundH(x, z + 0.4), groundH(x, z - 0.4)) - 0.02;
    q.setFromAxisAngle(new V3(0, 1, 0), rot ?? R() * 6.28);
    mtx.compose(new V3(x, y, z), q, new V3(sc, sc, sc));
    const k = inKeep(x, z);
    append(k ? kAll : all, d.B); append(k ? kGlow : glow, d.G);
  });
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  const gm = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); gm.color.setScalar(1.8);
  const keepZone = new THREE.Group(); keepZone.name = 'decoKeepZone'; group.add(keepZone);
  for (const [src, dst, glowy] of [[all, group, false], [glow, group, true], [kAll, keepZone, false], [kGlow, keepZone, true]]) {
    const g = toGeo(src); if (!g) continue;
    const mesh = new THREE.Mesh(g, glowy ? gm : bodyMat);
    if (!glowy) mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = (dst === keepZone ? 'decoKeep' : 'deco') + (glowy ? 'Glow' : '');
    dst.add(mesh);
  }
  if (waterParts.length) {
    const wg = new THREE.BufferGeometry(), wp = [];
    for (const g of waterParts) wp.push(...g.attributes.position.array);
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.computeVertexNormals();
    const wm = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: pal.water, roughness: t === 4 ? 0.25 : 0.08, metalness: 0.3, transparent: true, opacity: t === 4 ? 0.85 : 0.88 }));
    wm.receiveShadow = true; wm.name = 'water'; group.add(wm);
  }

  const res = {
    group, ground, overlay, keepZone, name: pal.name,
    sky: pal.sky,
    fog: { color: pal.fog[0], near: pal.fog[1], far: pal.fog[2] },
    lights: { sun: { color: pal.sun[0], intensity: pal.sun[1] }, hemi: { sky: pal.hemi[0], ground: pal.hemi[1], intensity: pal.hemi[2] }, ambient: { color: pal.amb[0], intensity: pal.amb[1] }, exposure: pal.exposure },
    obstacleModel: (kind) => obstacleModel(t, kind),
    groundHeight: groundH,
  };
  fieldCache.set(t, res);
  return res;
}
