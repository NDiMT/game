import * as THREE from 'three';

// =====================================================================
// HEX REALMS: tactical battlefield environment, one look per terrain.
//   createBattlefield(THREE, terrainId, hexPos, COLS, ROWS)
//     -> { group, ground, overlay, sky, fog, lights, obstacleModel(kind) }
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
  1: { name: 'grass', sky: 0x8fc4ee, fog: [0xa9cde8, 15, 38], sun: [0xfff0d0, 2.5], hemi: [0xcfe6ff, 0x4a5a2a, 0.9], amb: [0x405070, 0.3], exposure: 1.05,
    tint: [0x6aa040, 0x4c8a34, 0x86a848], grid: [24, 52, 16], gridHi: [220, 255, 170], field: [255, 250, 200], water: 0x3a6a88, hill: 0.9 },
  2: { name: 'dirt', sky: 0xb8c8d8, fog: [0xc8b89e, 14, 36], sun: [0xffe2b0, 2.5], hemi: [0xe0e4f0, 0x5a4028, 0.85], amb: [0x504a60, 0.3], exposure: 1.05,
    tint: [0x9a7450, 0x7e5c3c, 0xa88660], grid: [52, 34, 18], gridHi: [255, 230, 190], field: [255, 230, 190], water: 0x4a5a5a, hill: 0.8 },
  3: { name: 'sand', sky: 0xf2dcae, fog: [0xf0d8a6, 14, 36], sun: [0xfff2d8, 2.7], hemi: [0xfff0d8, 0x8a6a3a, 0.85], amb: [0x605048, 0.3], exposure: 1.0,
    tint: [0xe0c080, 0xc8a464, 0xead098], grid: [110, 74, 32], gridHi: [255, 245, 215], field: [255, 245, 220], water: 0x3a8aa0, hill: 1.2 },
  4: { name: 'snow', sky: 0xc4d6ec, fog: [0xd2e0f0, 12, 34], sun: [0xe8f0ff, 2.2], hemi: [0xd8e8ff, 0x7a8aa8, 1.0], amb: [0x506080, 0.35], exposure: 0.95,
    tint: [0xf0f4fa, 0xd0dcee, 0xffffff], grid: [60, 80, 120], gridHi: [255, 255, 255], field: [190, 210, 240], water: 0x9ac0dc, hill: 1.0 },
  5: { name: 'swamp', sky: 0x7a8c78, fog: [0x71846e, 11, 32], sun: [0xf0f4c8, 2.3], hemi: [0xc8dcc0, 0x3a4a28, 1.0], amb: [0x405848, 0.4], exposure: 1.15,
    tint: [0x6a7a40, 0x58683a, 0x7a8a48], grid: [20, 30, 12], gridHi: [200, 230, 150], field: [190, 200, 120], water: 0x2a4a40, hill: 0.5 },
  6: { name: 'rough', sky: 0xa8b4c4, fog: [0xb4aea4, 14, 36], sun: [0xfff0dc, 2.5], hemi: [0xdce4f0, 0x4a4030, 0.85], amb: [0x484a58, 0.3], exposure: 1.05,
    tint: [0x9a8e76, 0x7a705e, 0xa89c84], grid: [40, 34, 26], gridHi: [255, 245, 225], field: [255, 245, 225], water: 0x4a6a7a, hill: 1.4 },
  7: { name: 'lava', sky: 0x4a2420, fog: [0x5a2a22, 11, 30], sun: [0xffb080, 2.0], hemi: [0xff9a70, 0x2a1010, 0.75], amb: [0x502020, 0.35], exposure: 1.1,
    tint: [0x3a2c28, 0x2a2020, 0x4a3430], grid: [8, 2, 0], gridHi: [255, 130, 60], hiA: 0.32, field: [255, 120, 60], water: 0x000000, hill: 1.3 },
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
        const ao = 1 - p.ao * 0.45 * (1 - smooth(0, 0.35, v.y));
        pos.push(v.x, v.y, v.z); col.push(base.r * j * ao, base.g * j * ao, base.b * j * ao);
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
  roundTree(m, leaf, leafTop, trunk = 0x5a3e26) {
    const h = m.rnd(0.85, 1.15), tx = m.rnd(-0.1, 0.1), tz = m.rnd(-0.1, 0.1);
    m.add(G.limb([0, 0, 0], [tx, h + 0.2, tz], 0.14, 0.08), trunk, { top: 0x7a5a3a, h0: 0, h1: h });
    for (let i = 0; i < 2; i++) { const a = m.rnd(0, 6.28); m.add(G.limb([tx * 0.6, h * 0.6, tz * 0.6], [Math.cos(a) * 0.4, h + 0.25, Math.sin(a) * 0.4], 0.06, 0.04, 5), trunk); }
    const n = 4 + ((m.r() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + m.rnd(0, 1), rr = i === 0 ? 0 : m.rnd(0.3, 0.5), rad = i === 0 ? m.rnd(0.6, 0.72) : m.rnd(0.42, 0.58);
      m.add(G.blob(rad, 1, 0.16, m.seed * 31 + i).translate(Math.cos(a) * rr, h + (i === 0 ? 0.75 : m.rnd(0.25, 0.6)), Math.sin(a) * rr), leaf, { top: leafTop, h0: h, h1: h + 1.3, jit: 0.09, ao: 0 });
    }
  },
  pine(m, col, top, snowy, k = 1) {
    m.add(G.cyl(0.09 * k, 0.13 * k, 0.6 * k, 6), 0x4a3424);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const r = (0.8 - i * 0.16) * k, h = (0.9 - i * 0.08) * k, y = (0.35 + i * 0.42) * k, rot = m.rnd(0, 1);
      m.add(G.cone(r, h, 7).rotateY(rot).translate(0, y, 0), col, { top, h0: 0.3, h1: 2.0, ao: 0, jit: 0.08 });
      if (snowy) m.add(G.cone(r * 0.82, h * 0.55, 7).rotateY(rot).translate(0, y + h * 0.45 + 0.01, 0), 0xf4f8ff, { top: 0xffffff, h0: 0.5, h1: 2, ao: 0, jit: 0.04 });
    }
  },
  deadTree(m, col = 0x4a3a2c, top = 0x7a6a58, h = 1.4) {
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
    m.add(G.limb([0, 0, 0], [0.1, 1.0, 0], 0.18, 0.11, 6), 0x3a3022, { top: 0x5a4a32 });
    m.add(G.blob(1, 1, 0.18, m.seed * 3).scale(0.95, 0.5, 0.95).translate(0.1, 1.45, 0), 0x4a5a24, { top: 0x7a8a3a, h0: 1.2, h1: 1.9, ao: 0 });
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + m.rnd(0, 0.4), rr = m.rnd(0.7, 0.85), l = m.rnd(0.6, 0.95);
      m.add(G.cone(0.13, l, 5).rotateX(Math.PI).translate(0.1 + Math.cos(a) * rr, 1.42, Math.sin(a) * rr), 0x56662a, { top: 0x6a7a34, h0: 0.6, h1: 1.4, ao: 0 });
    }
  },
  palm(m) {
    const bend = m.rnd(0.025, 0.05) * (m.r() < 0.5 ? -1 : 1), pts = [];
    for (let i = 0; i <= 5; i++) pts.push([bend * i * i, i * 0.38, 0]);
    for (let i = 0; i < 5; i++) m.add(G.limb(pts[i], pts[i + 1], 0.1 - i * 0.008, 0.085 - i * 0.008, 6), i % 2 ? 0x8a6a42 : 0x9e7c50);
    const t = pts[5];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.28 + m.rnd(0, 0.4), c = Math.cos(a), s = Math.sin(a), l1 = m.rnd(0.45, 0.6);
      const p1 = [t[0] + c * l1, t[1] + 0.18, t[2] + s * l1], p2 = [t[0] + c * (l1 + 0.5), t[1] - 0.25, t[2] + s * (l1 + 0.5)];
      m.add(G.leaf(t, p1, 0.32), 0x4a8a2e, { ao: 0 }); m.add(G.leaf(p1, p2, 0.28), 0x6aa03a, { ao: 0 });
    }
    for (let i = 0; i < 3; i++) m.add(G.blob(0.07, 0, 0.1, i).translate(t[0] + Math.cos(i * 2) * 0.1, t[1] - 0.08, t[2] + Math.sin(i * 2) * 0.1), 0x5a4020, { ao: 0 });
  },
  cactus(m) {
    const h = m.rnd(0.9, 1.2), c = 0x4a8a4a, o = { top: 0x7ab06a, h0: 0, h1: 1.3, jit: 0.05 };
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
  fence(m, wood = 0x7a5a36) {
    for (let i = 0; i < 3; i++) m.add(G.box(0.08, m.rnd(0.5, 0.6), 0.08).rotateZ(m.rnd(-0.08, 0.08)).translate((i - 1) * 0.6, 0, 0), wood, { top: 0x9a7a52, h0: 0, h1: 0.6 });
    for (const y of [0.2, 0.42]) m.add(G.box(1.3, 0.06, 0.04).rotateZ(m.rnd(-0.05, 0.05)).translate(0, y, 0.05), 0x8a6a42, { jit: 0.1 });
  },
  tuft(m, col, top, n = 6, h = 0.32) {
    for (let i = 0; i < n; i++) { const a = m.rnd(0, 6.28); m.add(G.cone(0.035, m.rnd(0.6, 1) * h, 3).rotateX(m.rnd(-0.4, 0.4)).rotateZ(m.rnd(-0.4, 0.4)).translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08), col, { top, h0: 0, h1: h, ao: 0.6 }); }
  },
  flowers(m, col) {
    P.tuft(m, 0x3a7a2a, 0x6aa84a, 5, 0.22);
    for (let i = 0; i < 4; i++) { const a = m.rnd(0, 6.28), rr = m.rnd(0.05, 0.18); m.add(G.blob(0.045, 0, 0, i).translate(Math.cos(a) * rr, m.rnd(0.14, 0.24), Math.sin(a) * rr), col, { ao: 0 }); }
  },
  reeds(m) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = m.rnd(0, 6.28), rr = m.rnd(0, 0.18), h = m.rnd(0.6, 1.05), lx = m.rnd(-0.1, 0.1), lz = m.rnd(-0.1, 0.1), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      m.add(G.limb([x, 0, z], [x + lx, h, z + lz], 0.018, 0.012, 3), 0x5a7a30, { top: 0x9aa050, h0: 0, h1: 1 });
      if (i % 2 === 0) m.add(G.cyl(0.035, 0.035, 0.16, 5).translate(x + lx * 0.9, h * 0.82, z + lz * 0.9), 0x5a3a20, { ao: 0 });
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
  crystals(m, col, glow, n = 5, s = 1, base = 0x5a5560) {
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
  log(m, wood = 0x5a4026, end = 0xb08a5a, moss = 0x4a7a2a, L = 1.0, r = 0.14) {
    const o = new THREE.Matrix4().makeRotationY(m.rnd(0, 6.28));
    m.add(G.cyl(r, r * 1.05, L, 8).rotateZ(Math.PI / 2).translate(L / 2, r * 0.9, 0).translate(-L / 2, 0, 0).applyMatrix4(o), wood, { cap: moss, capT: 0.9, jit: 0.1 });
    for (const sd of [-1, 1]) m.add(ni(new THREE.CircleGeometry(r * 0.96, 8)).rotateY(sd * Math.PI / 2).translate(sd * (L / 2 + 0.003), r * 0.9, 0).applyMatrix4(o), end, { fn: (v, c) => { const d = Math.hypot(v.y - r * 0.9, 0); if (d > r * 0.6) c.multiplyScalar(0.8); }, ao: 0 });
    m.add(G.limb([0.1, r * 1.4, 0], [0.25, r * 2.8, 0.1], 0.04, 0.025, 4).applyMatrix4(o), wood);
  },
  stump(m, wood = 0x5a4026, end = 0xc09a68) {
    m.add(G.cyl(0.2, 0.26, 0.3, 8), wood, { jit: 0.1 });
    m.add(ni(new THREE.CircleGeometry(0.2, 8)).rotateX(-Math.PI / 2).translate(0, 0.302, 0), end, { ao: 0 });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28 + m.rnd(0, 1); m.add(G.limb([0, 0.12, 0], [Math.cos(a) * 0.4, -0.02, Math.sin(a) * 0.4], 0.07, 0.03, 4), wood); }
  },
  mound(m, col, top, k = 1) { m.add(G.blob(1, 1, 0.12, m.seed).scale(m.rnd(0.5, 0.8) * k, m.rnd(0.18, 0.28) * k, m.rnd(0.4, 0.6) * k).translate(0, -0.02, 0), col, { top, h0: 0, h1: 0.2, ao: 0.4, jit: 0.04 }); },
  lavaPool(m, s = 1) {
    m.add(G.disc(0.85 * s, 14, 0.25, m.seed).translate(0, 0.03, 0), 0xffd040, { glow: true, ao: 0, jit: 0.05, fn: (v, c) => c.lerp(LIN(0xff3a08), smooth(0.15 * s, 0.8 * s, Math.hypot(v.x, v.z))) });
    m.add(G.disc(1.05 * s, 14, 0.2, m.seed).translate(0, 0.012, 0), 0x2a1a16, { ao: 0 });
    for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28 + m.rnd(0, 0.5), rr = m.rnd(0.85, 1.05) * s; m.add(G.rock(m.seed * 3 + i, 0.16 * s, 0.12 * s, 0.14 * s, 0).translate(Math.cos(a) * rr, 0, Math.sin(a) * rr), 0x3a2a26, { jit: 0.1 }); }
  },
  magmaRock(m, s = 1) {
    m.add(G.blob(0.24 * s, 1, 0.15, m.seed).translate(0, 0.22 * s, 0), 0xffb030, { glow: true, ao: 0, top: 0xff4a10, h0: 0.0, h1: 0.5 * s });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.28 + m.rnd(0, 0.5), rr = 0.17 * s;
      m.add(G.rock(m.seed * 7 + i, 0.22 * s, 0.32 * s, 0.2 * s, 1).rotateY(-a).translate(Math.cos(a) * rr, 0, Math.sin(a) * rr), 0x2e2422, { cap: 0x4a3a34, capT: 0.6, jit: 0.12, fn: (v, c) => { if (v.y < 0.1 * s) c.lerp(LIN(0x8a2a10), 0.5); } });
    }
  },
};

// ------------------------------------------------------------------ battlefield obstacles (fit one hex: ~0.85 wide)
const OBST = {
  1: [(m) => P.rockPile(m, 0x8a8478, 0x5a8a3a), (m) => { P.log(m, 0x6a4a2c, 0xc09a68, 0x5a7a2a, 0.85, 0.15); P.mushrooms(m, 0xc83a2a, null, 2, 0.6); }, (m) => { P.stump(m); P.tuft(m, 0x4a8a2a, 0x8ac04a, 5, 0.3); }],
  2: [(m) => P.rockPile(m, 0x8a7a66, 0xa89a80), (m) => P.deadTree(m, 0x4a3a2c, 0x7a6a58, 0.95), (m) => { P.column(m, 0xb0a48c, 0xd0c4a8, 0.55); m.add(G.rock(5, 0.14, 0.1, 0.12, 0).translate(0.32, 0, 0.2), 0xb0a48c); }],
  3: [(m) => m.add(G.rock(m.seed, 0.4, 0.42, 0.34, 1, 0.2), 0xc89a5a, { fn: (v, c) => c.multiplyScalar(0.88 + 0.18 * Math.sin(v.y * 22)), jit: 0.06, cap: 0xe8c890, capT: 0.7 }), (m) => P.cactus(m), (m) => P.bones(m)],
  4: [(m) => P.rockPile(m, 0x7a8494, 0xf4f8ff), (m) => P.crystals(m, 0xa8d8ff, null, 6, 1, 0x8a94a8), (m) => { P.pine(m, 0x24483a, 0x3a6a4a, true, 0.5); P.mound(m, 0xeef4fc, 0xffffff, 0.6); }],
  5: [(m) => { P.log(m, 0x3e3220, 0x8a7a50, 0x5a7a2a, 0.9, 0.15); P.mushrooms(m, 0x8a3a8a, 0x8affaa, 2, 0.8); }, (m) => P.deadTree(m, 0x2e2a20, 0x5a5a3a, 1.0), (m) => P.mushrooms(m, 0x7a3a9a, 0x8affaa, 4, 1.6)],
  6: [(m) => P.spire(m, 0x8a8070, 0xb0a890, 0.9), (m) => P.crystals(m, 0x5a7aff, 0x9ac0ff, 6, 1), (m) => P.rockPile(m, 0x7a7266, 0xa49a88, 1.1)],
  7: [(m) => P.magmaRock(m), (m) => { P.spire(m, 0x221c20, 0x3a3440, 0.95); m.add(G.disc(0.3, 9, 0.2, 2).translate(0.25, 0.02, 0.2), 0xff6a20, { glow: true, ao: 0 }); }, (m) => P.deadTree(m, 0x1e1614, 0x3a2a24, 0.95)],
};
const terId = (t) => (TERRAINS[t] ? t : 1);
const obstCache = new Map();
export function obstacleModel(terrainId, kind = 0) {
  const t = terId(terrainId), k = ((kind % 3) + 3) % 3, key = t * 10 + k;
  if (!obstCache.has(key)) { const m = new Mk(t * 100 + k * 7 + 3); OBST[t][k](m); obstCache.set(key, modelOf(m)); }
  return obstCache.get(key);
}

// ------------------------------------------------------------------ border decoration per terrain
// [builder, weight, zone, [minScale, maxScale], footprint radius]
// zone: 'tall' only far/side (never in front of the camera), 'low' anywhere, 'scatter' small filler.
const DECO = {
  1: [
    [(m) => P.roundTree(m, 0x3e8a2a, 0x8ac840), 6, 'tall', [1.2, 1.6], 1.0],
    [(m) => P.pine(m, 0x2a5a2a, 0x4a8a3a), 1.5, 'tall', [1.1, 1.4], 0.8],
    [(m) => P.bush(m, 0x3a7a28, 0x7ab840), 3, 'low', [1, 1.5], 0.5],
    [(m) => P.rock(m, 0x8a8478, 0x5a8a3a, 0.5, 0.4), 2, 'low', [0.8, 1.6], 0.5],
    [(m) => P.stump(m), 0.6, 'low', [1, 1.2], 0.4],
    [(m) => P.flowers(m, m.pick([0xffe060, 0xffffff, 0xff8ac0, 0xa0a0ff])), 4, 'scatter', [1, 1.4], 0.25],
    [(m) => P.tuft(m, 0x3a7a2a, 0x8ac04a), 4, 'scatter', [1, 1.5], 0.2],
  ],
  2: [
    [(m) => P.roundTree(m, m.pick([0xc0601a, 0xb04a1a, 0xc8901a]), 0xffc040, 0x4a3424), 4, 'tall', [1.1, 1.5], 1.0],
    [(m) => P.deadTree(m, 0x4a3a2c, 0x7a6a58, 1.5), 2, 'tall', [1.1, 1.5], 0.6],
    [(m) => P.ruinWall(m, 0xa89a80, 0xc4b69a, 0x6a7a3a), 1.2, 'tall', [1, 1.3], 0.9],
    [(m) => P.column(m, 0xb0a48c, 0xd0c4a8, m.rnd(0.6, 1.8)), 1.2, 'tall', [1, 1.3], 0.4],
    [(m) => P.fallenColumn(m, 0xb0a48c, 0xd0c4a8), 0.8, 'low', [1, 1.2], 0.7],
    [(m) => P.rock(m, 0x8a7a66, 0xa89a80, 0.5, 0.4), 2.5, 'low', [0.8, 1.6], 0.5],
    [(m) => P.bush(m, 0x7a6a2a, 0xb0902a), 2, 'low', [0.8, 1.2], 0.45],
    [(m) => P.tuft(m, 0x8a7a3a, 0xc0b060), 4, 'scatter', [1, 1.4], 0.2],
  ],
  3: [
    [(m) => P.palm(m), 3, 'tall', [1.2, 1.6], 0.8],
    [(m) => P.cactus(m), 2.5, 'tall', [1.2, 1.7], 0.4],
    [(m) => P.spire(m, 0xc08a50, 0xe0b878, 2.0), 1.5, 'tall', [1, 1.5], 0.8],
    [(m) => P.column(m, 0xd8c098, 0xf0dcb0, m.rnd(0.5, 1.8)), 1.2, 'tall', [1, 1.3], 0.4],
    [(m) => P.rock(m, 0xc89a5a, 0xe8c890, 0.55, 0.45), 2.5, 'low', [0.8, 1.6], 0.5],
    [(m) => P.bones(m), 0.6, 'low', [1, 1.3], 0.6],
    [(m) => P.tuft(m, 0x9a9a4a, 0xd0c070, 5, 0.26), 2.5, 'scatter', [1, 1.4], 0.2],
  ],
  4: [
    [(m) => P.pine(m, 0x24483a, 0x3a6a4a, true), 7, 'tall', [1.1, 1.7], 0.85],
    [(m) => P.deadTree(m, 0x5a5048, 0xe8f0ff, 1.4), 1, 'tall', [1.1, 1.4], 0.6],
    [(m) => P.crystals(m, 0xa8d8ff, null, 6, 1.6, 0x8a94a8), 1, 'low', [1, 1.3], 0.5],
    [(m) => P.rock(m, 0x7a8494, 0xf4f8ff, 0.55, 0.45), 3, 'low', [0.8, 1.6], 0.5],
    [(m) => P.mound(m, 0xe8f0fa, 0xffffff), 2.5, 'low', [1, 2], 0.6],
    [(m) => P.rock(m, 0x5a6474, 0xdde8f8, 0.18, 0.12, 0), 3, 'scatter', [1, 1.5], 0.2],
  ],
  5: [
    [(m) => P.willow(m), 5, 'tall', [1.2, 1.6], 1.0],
    [(m) => P.deadTree(m, 0x2e2a20, 0x5a5a3a, 1.6), 2, 'tall', [1.1, 1.5], 0.6],
    [(m) => P.reeds(m), 4, 'low', [0.9, 1.3], 0.3],
    [(m) => P.mushrooms(m, 0x7a3a9a, 0x8affaa, 3), 1.6, 'low', [1.2, 1.8], 0.3],
    [(m) => P.log(m, 0x3e3220, 0x8a7a50, 0x5a7a2a, 1.2, 0.16), 1, 'low', [1, 1.2], 0.7],
    [(m) => P.bush(m, 0x3a4a22, 0x6a7a30), 2, 'low', [0.9, 1.3], 0.45],
    [(m) => P.tuft(m, 0x4a5a2a, 0x8a9a4a, 6, 0.35), 4, 'scatter', [1, 1.4], 0.2],
  ],
  6: [
    [(m) => P.spire(m, 0x7a7266, 0xa49a88, 2.4), 3.5, 'tall', [1, 1.5], 0.8],
    [(m) => P.deadTree(m, 0x4a3a2c, 0x7a6a58, 1.4), 1, 'tall', [1.1, 1.4], 0.6],
    [(m) => P.pine(m, 0x2e4a2e, 0x5a7a4a), 1, 'tall', [1, 1.3], 0.8],
    [(m) => P.ruinWall(m, 0x8a8478, 0xa49e90, 0x7a8a4a), 0.8, 'tall', [1, 1.2], 0.9],
    [(m) => P.rock(m, 0x7a7266, 0xa49a88, 0.6, 0.5), 5, 'low', [0.8, 1.8], 0.55],
    [(m) => P.crystals(m, 0x5a7aff, 0x9ac0ff, 5, 1.3), 0.8, 'low', [1, 1.3], 0.4],
    [(m) => P.rock(m, 0x8a8070, 0xb0a890, 0.2, 0.15, 0), 4, 'scatter', [1, 1.5], 0.2],
  ],
  7: [
    [(m) => P.spire(m, 0x221c20, 0x3a3440, 2.6), 4, 'tall', [1, 1.5], 0.8],
    [(m) => P.deadTree(m, 0x1e1614, 0x3a2a24, 1.5), 2, 'tall', [1.1, 1.4], 0.6],
    [(m) => P.lavaPool(m), 2, 'low', [0.8, 1.4], 1.1],
    [(m) => P.magmaRock(m, 1.4), 1, 'low', [1, 1.3], 0.5],
    [(m) => P.rock(m, 0x2e2422, 0x4a3a34, 0.5, 0.45), 3, 'low', [0.8, 1.6], 0.5],
    [(m) => P.crystals(m, 0xff5a2a, 0xff7a3a, 5, 1.2, 0x2a2024), 0.7, 'low', [1, 1.3], 0.4],
    [(m) => P.rock(m, 0x3a2a26, 0x5a4038, 0.2, 0.15, 0), 3, 'scatter', [1, 1.5], 0.2],
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
function pebbles(ctx, S, R, n, cols, r0, r1, sh = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, r = r0 + R() * (r1 - r0), c = cols[(R() * cols.length) | 0], ry = r * (0.6 + R() * 0.3), rot = R() * 3;
    wrap(S, x, y, r + 3, (X, Y) => {
      ctx.fillStyle = `rgba(0,0,0,${sh})`; ctx.beginPath(); ctx.ellipse(X + r * 0.25, Y + r * 0.3, r, ry, rot, 0, 6.29); ctx.fill();
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

// ground detail texture (tiles every TILE world units)
const TILE = 4;
function paintGround(t) {
  const S = 512, c = mkCanvas(S, S), x = c.getContext('2d'), R = mulberry32(t * 911 + 5);
  let em = null;
  const fill = (col) => { x.fillStyle = rgba(col, 1); x.fillRect(0, 0, S, S); };
  if (t === 1) {
    fill([82, 142, 50]);
    blobs(x, S, R, 260, [[62, 118, 38], [104, 160, 60], [72, 132, 44], [120, 168, 64]], 0.35, 20, 80);
    strokes(x, S, R, 2600, [[44, 96, 30], [52, 108, 32]], 0.55, 4, 9, 1.6);
    strokes(x, S, R, 1800, [[150, 200, 90], [128, 186, 72]], 0.5, 3, 8, 1.3);
    blobs(x, S, R, 30, [[150, 120, 70]], 0.18, 10, 24);
    for (let i = 0; i < 70; i++) { const px = R() * S, py = R() * S, fc = [[255, 236, 110], [255, 255, 255], [250, 160, 210], [180, 170, 255]][(R() * 4) | 0]; wrap(S, px, py, 4, (X, Y) => { x.fillStyle = 'rgba(0,40,0,0.35)'; x.beginPath(); x.arc(X + 1, Y + 1, 2.4, 0, 6.29); x.fill(); x.fillStyle = rgba(fc, 1); x.beginPath(); x.arc(X, Y, 2.2, 0, 6.29); x.fill(); }); }
  } else if (t === 2) {
    fill([132, 96, 62]);
    blobs(x, S, R, 260, [[112, 80, 50], [156, 118, 78], [98, 72, 46], [146, 110, 70]], 0.4, 20, 90);
    x.lineCap = 'round'; cracks(x, S, R, 18, 10, 9, () => { x.strokeStyle = 'rgba(60,38,20,0.45)'; x.lineWidth = 1.8; x.stroke(); });
    strokes(x, S, R, 900, [[96, 70, 44]], 0.4, 3, 7, 1.4);
    pebbles(x, S, R, 260, [[150, 132, 112], [120, 100, 80], [172, 150, 120]], 1.5, 5.5);
    strokes(x, S, R, 260, [[110, 120, 50], [140, 140, 60]], 0.6, 4, 8, 1.5);
  } else if (t === 3) {
    fill([224, 192, 130]);
    blobs(x, S, R, 220, [[208, 174, 112], [238, 210, 150], [214, 182, 118]], 0.4, 30, 110);
    x.lineCap = 'round';
    for (let k = 0; k < 24; k++) {
      const y0 = (k * S) / 24, ph = R() * 6.28, amp = 4 + R() * 4, n = 1 + ((R() * 3) | 0);
      for (const [off, col, a, w] of [[3, [176, 138, 82], 0.35, 3], [0, [250, 228, 178], 0.45, 2.2]]) {
        wrap9(x, S, () => { x.beginPath(); for (let px = 0; px <= S; px += 8) { const py = y0 + off + Math.sin((px / S) * 6.283 * n + ph) * amp; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.strokeStyle = rgba(col, a); x.lineWidth = w; x.stroke(); });
      }
    }
    pebbles(x, S, R, 40, [[190, 160, 120], [160, 130, 96]], 1.5, 4, 0.25);
  } else if (t === 4) {
    fill([234, 240, 248]);
    blobs(x, S, R, 260, [[206, 220, 240], [250, 252, 255], [196, 212, 236], [222, 232, 248]], 0.45, 30, 100, 0.6);
    strokes(x, S, R, 90, [[196, 210, 236]], 0.22, 30, 70, 4);
    strokes(x, S, R, 70, [[255, 255, 255]], 0.4, 25, 60, 3);
    pebbles(x, S, R, 30, [[100, 110, 126], [130, 136, 150]], 1.5, 4, 0.15);
    for (let i = 0; i < 500; i++) { const px = R() * S, py = R() * S; x.fillStyle = `rgba(255,255,255,${0.5 + R() * 0.5})`; x.fillRect(px, py, 1.4, 1.4); }
  } else if (t === 5) {
    fill([76, 90, 48]);
    blobs(x, S, R, 280, [[58, 58, 34], [92, 110, 54], [52, 72, 40], [70, 64, 38]], 0.45, 20, 90);
    for (let i = 0; i < 5; i++) {
      const px = R() * S, py = R() * S, rx = 24 + R() * 44, ry = rx * (0.5 + R() * 0.4), rot = R() * 3;
      wrap(S, px, py, rx + 6, (X, Y) => {
        x.fillStyle = 'rgba(40,40,22,0.6)'; x.beginPath(); x.ellipse(X, Y, rx + 5, ry + 5, rot, 0, 6.29); x.fill();
        const g = x.createRadialGradient(X, Y, 0, X, Y, rx); g.addColorStop(0, 'rgba(40,74,70,1)'); g.addColorStop(1, 'rgba(56,84,64,1)');
        x.fillStyle = g; x.beginPath(); x.ellipse(X, Y, rx, ry, rot, 0, 6.29); x.fill();
        x.strokeStyle = 'rgba(170,200,170,0.35)'; x.lineWidth = 1.5; x.beginPath(); x.ellipse(X - rx * 0.2, Y - ry * 0.3, rx * 0.5, ry * 0.3, rot, 3.6, 5.2); x.stroke();
      });
    }
    strokes(x, S, R, 1600, [[60, 80, 34], [110, 130, 60]], 0.5, 4, 10, 1.5);
    blobs(x, S, R, 120, [[120, 150, 60]], 0.3, 3, 10);
  } else if (t === 6) {
    fill([128, 118, 98]);
    blobs(x, S, R, 220, [[110, 100, 84], [150, 140, 120], [100, 92, 78]], 0.4, 20, 90);
    for (let i = 0; i < 1600; i++) { const px = R() * S, py = R() * S, g = 90 + R() * 80; x.fillStyle = `rgba(${g},${g * 0.95},${g * 0.85},0.6)`; x.fillRect(px, py, 2, 2); }
    for (let i = 0; i < 34; i++) {
      const l = 0.9 + R() * 0.25, px = R() * S, py = R() * S, r = 16 + R() * 26, n = 6 + ((R() * 3) | 0), base = [138 * l, 128 * l, 108 * l], pts = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + R() * 0.4; pts.push([Math.cos(a) * r * (0.7 + R() * 0.3), Math.sin(a) * r * (0.6 + R() * 0.3)]); }
      wrap(S, px, py, r + 4, (X, Y) => {
        const path = () => { x.beginPath(); pts.forEach((p, k) => (k ? x.lineTo(X + p[0], Y + p[1]) : x.moveTo(X + p[0], Y + p[1]))); x.closePath(); };
        x.save(); x.translate(2, 3); path(); x.fillStyle = 'rgba(40,34,26,0.4)'; x.fill(); x.restore();
        path(); x.fillStyle = rgba(base, 1); x.fill();
        x.save(); x.clip(); x.translate(-3, -3); path(); x.strokeStyle = rgba(mixc(base, [255, 250, 235], 0.4), 0.7); x.lineWidth = 3; x.stroke(); x.restore();
      });
    }
    x.lineCap = 'round'; cracks(x, S, R, 10, 8, 10, () => { x.strokeStyle = 'rgba(50,44,36,0.4)'; x.lineWidth = 1.5; x.stroke(); });
  } else if (t === 7) {
    fill([44, 34, 32]);
    blobs(x, S, R, 260, [[62, 48, 44], [30, 24, 24], [76, 58, 50], [40, 30, 34]], 0.5, 20, 80);
    pebbles(x, S, R, 160, [[70, 58, 56], [50, 42, 44]], 2, 7, 0.4);
    em = mkCanvas(S, S); const e = em.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
    const R2 = mulberry32(77), R3 = mulberry32(77);
    x.lineCap = e.lineCap = 'round'; x.lineJoin = e.lineJoin = 'round';
    cracks(x, S, R2, 5, 12, 11, () => { x.strokeStyle = 'rgba(20,10,8,0.9)'; x.lineWidth = 7; x.stroke(); x.strokeStyle = 'rgba(150,40,12,1)'; x.lineWidth = 3; x.stroke(); });
    cracks(e, S, R3, 5, 12, 11, () => { e.strokeStyle = 'rgba(255,60,10,0.25)'; e.lineWidth = 8; e.stroke(); e.strokeStyle = 'rgba(255,100,20,0.9)'; e.lineWidth = 2.2; e.stroke(); e.strokeStyle = 'rgba(255,220,120,1)'; e.lineWidth = 1; e.stroke(); });
  }
  const tex = (cv) => { const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; };
  return { map: tex(c), emissive: em ? tex(em) : null };
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
  // a faint trodden tint over the whole field, varying per hex
  for (const p of cells) { hexPath(p, 1); x.fillStyle = rgba(pal.field, 0.04 + R() * 0.06); x.fill(); }
  // unique edges
  const edges = new Map();
  for (const p of cells) for (let i = 0; i < 6; i++) {
    const a = corner(p, i), b = corner(p, i + 1), k = `${Math.round((a[0] + b[0]) * 2)},${Math.round((a[1] + b[1]) * 2)}`;
    if (!edges.has(k)) edges.set(k, [a, b, 0.65 + R() * 0.35]);
  }
  x.lineCap = 'round';
  const pass = (col, a, w, blur) => {
    x.filter = blur ? `blur(${blur}px)` : 'none';
    for (const [p, q, f] of edges.values()) { x.strokeStyle = rgba(col, a * f); x.lineWidth = w; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); }
    x.filter = 'none';
  };
  pass(pal.grid, 0.38, 7, 3);
  pass(pal.grid, 0.42, 1.8, 0);
  // inner bevel highlight, like a gently painted tile edge
  for (const p of cells) { hexPath(p, 0.9); x.strokeStyle = rgba(pal.gridHi, (pal.hiA ?? 0.13) + R() * 0.05); x.lineWidth = 1.6; x.stroke(); }
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
    const lum = 1.0 + (n2 - 0.5) * 0.18 + Math.min(h, 1.2) * 0.08;
    cols.push((tmp.r / c0.r) * lum, (tmp.g / c0.g) * lum, (tmp.b / c0.b) * lum);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(cols.map((v) => Math.min(v, 1.4)), 3));
  gg.computeVertexNormals();
  const gmat = new THREE.MeshStandardMaterial({ map: gt.map, vertexColors: true, roughness: 1, metalness: 0 });
  if (gt.emissive) { gmat.emissiveMap = gt.emissive; gmat.emissive.set(0xff7a30); gmat.emissiveIntensity = 1.0; }
  const ground = new THREE.Mesh(gg, gmat); ground.receiveShadow = true; ground.name = 'ground';
  group.add(ground);

  // grid overlay
  const b = { x0: cx - hx, z0: cz - hz, W: hx * 2, D: hz * 2 };
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
    placed.push([x, z, rad]); items.push([s, x, z, sc]); n++;
  }
  for (let i = 0, n = 0; i < 1500 && n < 70; i++) {
    const x = (R() * 2 - 1) * 14, z = -18 + R() * 25, e = outside(x, z);
    if (e < 0.1 || !inView(x, z)) continue;
    const s = choose('scatter'), sc = s[3][0] + R() * (s[3][1] - s[3][0]);
    if (!free(x, z, s[4] * sc)) continue;
    placed.push([x, z, s[4] * sc]); items.push([s, x, z, sc]); n++;
  }
  // fences framing the near corners (grass / dirt)
  if (t === 1 || t === 2) for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
    const x = cx + sx * (hx + 0.5 + k * 1.25), z = cz + hz + 0.35 - k * 0.5;
    placed.push([x, z, 0.7]); items.push([[(m) => P.fence(m), 0, 'low', [1, 1], 0.6], x, z, 1, sx * (0.25 + k * 0.35)]);
  }
  // low filler in front of the camera (this strip is a big part of a portrait screen)
  for (let i = 0, n = 0; i < 600 && n < 26; i++) {
    const x = cx + (R() * 2 - 1) * (hx + 2), z = cz + hz + 0.2 + R() * 4, e = outside(x, z);
    if (e < 0.15) continue;
    const s = R() < 0.75 ? choose('scatter') : choose('low');
    if (s[4] > 0.56) continue;
    const sc = (s[3][0] + R() * (s[3][1] - s[3][0])) * (s[2] === 'low' ? 0.6 : 1);
    if (!free(x, z, s[4] * sc)) continue;
    placed.push([x, z, s[4] * sc]); items.push([s, x, z, sc]); n++;
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
      n++;
    }
  }

  const all = { pos: [], col: [] }, glow = { pos: [], col: [] }, mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new V3();
  const append = (dst, src) => { for (let i = 0; i < src.pos.length; i += 3) { v.set(src.pos[i], src.pos[i + 1], src.pos[i + 2]).applyMatrix4(mtx); dst.pos.push(v.x, v.y, v.z); } for (const c of src.col) dst.col.push(c); };
  items.forEach(([s, x, z, sc, rot], i) => {
    const m = new Mk(t * 1000 + i * 17 + 1); s[0](m); const d = m.bake();
    // sink into slopes a little
    const y = Math.min(groundH(x, z), groundH(x + 0.4, z), groundH(x - 0.4, z), groundH(x, z + 0.4), groundH(x, z - 0.4)) - 0.02;
    q.setFromAxisAngle(new V3(0, 1, 0), rot ?? R() * 6.28);
    mtx.compose(new V3(x, y, z), q, new V3(sc, sc, sc));
    append(all, d.B); append(glow, d.G);
  });
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  const dg = toGeo(all);
  if (dg) { const dm = new THREE.Mesh(dg, bodyMat); dm.castShadow = dm.receiveShadow = true; dm.name = 'deco'; group.add(dm); }
  const gl = toGeo(glow);
  if (gl) { const gm = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); gm.color.setScalar(1.8); const m = new THREE.Mesh(gl, gm); m.name = 'decoGlow'; group.add(m); }
  if (waterParts.length) {
    const wg = new THREE.BufferGeometry(), wp = [];
    for (const g of waterParts) wp.push(...g.attributes.position.array);
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.computeVertexNormals();
    const wm = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: pal.water, roughness: t === 4 ? 0.25 : 0.08, metalness: 0.3, transparent: true, opacity: t === 4 ? 0.85 : 0.88 }));
    wm.receiveShadow = true; wm.name = 'water'; group.add(wm);
  }

  const res = {
    group, ground, overlay, name: pal.name,
    sky: pal.sky,
    fog: { color: pal.fog[0], near: pal.fog[1], far: pal.fog[2] },
    lights: { sun: { color: pal.sun[0], intensity: pal.sun[1] }, hemi: { sky: pal.hemi[0], ground: pal.hemi[1], intensity: pal.hemi[2] }, ambient: { color: pal.amb[0], intensity: pal.amb[1] }, exposure: pal.exposure },
    obstacleModel: (kind) => obstacleModel(t, kind),
    groundHeight: groundH,
  };
  fieldCache.set(t, res);
  return res;
}
