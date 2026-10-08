import * as THREE from 'three';

// =====================================================================
// Low-poly models for AEONS: settlements for every era (four sizes each),
// the seven wonders, people, planes, satellites, trees and clouds.
// Settlements sit on a small disc of the planet, local +Y pointing up.
// Each model has a "body" and a "glow" (fires, windows, neon) that lights
// up on the night side of the planet.
// =====================================================================

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
export function mergeParts(parts) {
  const pos = [], nor = [], col = [];
  for (const { g, c } of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.computeVertexNormals();
    const p = ng.attributes.position.array, n = ng.attributes.normal.array, cc = new THREE.Color(c);
    for (let k = 0; k < p.length; k += 3) { pos.push(p[k], p[k + 1], p[k + 2]); nor.push(n[k], n[k + 1], n[k + 2]); col.push(cc.r, cc.g, cc.b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
function roofGeo() {
  const P = [
    [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 1, 0],
    [0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 1, 0],
    [-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0], [0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, 0],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
  return g;
}
function kit(seed) {
  const r = mulberry32(seed);
  const B = [], G = [], smoke = [];
  const add = (g, c, glow) => (glow ? G : B).push({ g, c });
  const k = {
    r, B, G, smoke,
    pick: (a) => a[(r() * a.length) | 0],
    box: (w, h, d, x, y, z, c, glow = false, ry = 0) => add(new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y + h / 2, z), c, glow),
    cyl: (r1, r2, h, x, y, z, c, s = 8, glow = false) => add(new THREE.CylinderGeometry(r1, r2, h, s).translate(x, y + h / 2, z), c, glow),
    cone: (rad, h, x, y, z, c, s = 7, glow = false) => add(new THREE.ConeGeometry(rad, h, s).translate(x, y + h / 2, z), c, glow),
    ball: (rad, x, y, z, c, glow = false, d = 0) => add(new THREE.IcosahedronGeometry(rad, d).translate(x, y, z), c, glow),
    dome: (rad, x, y, z, c, glow = false) => add(new THREE.SphereGeometry(rad, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y, z), c, glow),
    ring: (rad, tube, x, y, z, c, glow = true) => add(new THREE.TorusGeometry(rad, tube, 6, 24).rotateX(Math.PI / 2).translate(x, y, z), c, glow),
    roof: (w, h, d, x, y, z, c, ry = 0) => add(roofGeo().scale(w, h, d).rotateY(ry).translate(x, y, z), c, false),
    pyr: (w, h, x, y, z, c) => add(new THREE.ConeGeometry(w * 0.71, h, 4).rotateY(Math.PI / 4).translate(x, y + h / 2, z), c, false),
    win: (w, h, x, y, z, ry, c) => add(new THREE.PlaneGeometry(w, h).rotateY(ry).translate(x, y, z), c, true),
    // a grid of lit windows on the four faces of a box
    windows(w, d, x, z, y0, floors, fh, cols, lit = 0.7) {
      for (let f = 0; f < floors; f++) {
        const y = y0 + f * fh + fh * 0.55;
        for (let face = 0; face < 4; face++) {
          const along = face % 2 ? d : w, n = face % 2 ? Math.max(1, Math.round((cols * d) / w)) : cols;
          for (let i = 0; i < n; i++) {
            const t = -along / 2 + (along / n) * (i + 0.5), c = r() < lit ? k.pick([0xffd98a, 0xffe7b0, 0xffc870]) : 0x243046;
            const ww = (along / n) * 0.55, wh = fh * 0.5;
            if (face === 0) k.win(ww, wh, x + t, y, z + d / 2 + 0.002, 0, c);
            else if (face === 2) k.win(ww, wh, x - t, y, z - d / 2 - 0.002, Math.PI, c);
            else if (face === 1) k.win(ww, wh, x + w / 2 + 0.002, y, z - t, Math.PI / 2, c);
            else k.win(ww, wh, x - w / 2 - 0.002, y, z + t, -Math.PI / 2, c);
          }
        }
      }
    },
  };
  return k;
}
const done = (k) => ({ body: mergeParts(k.B), glow: k.G.length ? mergeParts(k.G) : null, smoke: k.smoke });

// Building slots around a settlement centre, inner ring first.

export const ERA_STYLE = [
  { name: 'stone' }, { name: 'bronze' }, { name: 'classical' }, { name: 'medieval' }, { name: 'industrial' }, { name: 'modern' }, { name: 'space' },
];
function building(era, k, x, z, s, i) {
  const ry = era >= 3 ? 0 : Math.floor(k.r() * 4) * (Math.PI / 2);
  switch (era) {
    case 0: { // hide huts
      const c = k.pick([0x9a7a52, 0x8a6a48, 0xb08a5a]);
      k.cone(0.05 * s, 0.09 * s, x, 0, z, c, 7);
      k.box(0.02 * s, 0.035 * s, 0.01, x + 0.03 * s, 0, z + 0.025 * s, 0x3a2a1a, false, ry);
      break;
    }
    case 1: { // mud-brick houses
      const c = k.pick([0xd8b47a, 0xcfa86a, 0xe0c08a]);
      const w = 0.06 * s, h = 0.045 * s;
      k.box(w, h, w * 0.9, x, 0, z, c, false, ry);
      k.box(w * 1.05, 0.008, w, x, h, z, 0xb8925a, false, ry);
      k.win(0.015 * s, 0.02 * s, x, 0.015 * s, z + w * 0.46, 0, 0xffb860);
      break;
    }
    case 2: { // whitewashed houses with tiled roofs
      const w = 0.065 * s, h = 0.05 * s;
      k.box(w, h, w * 0.85, x, 0, z, k.pick([0xf2ede2, 0xe9e2d2, 0xf5f0e6]), false, ry);
      k.roof(w * 1.1, 0.03 * s, w * 0.95, x, h, z, k.pick([0xc0533a, 0xb0482f, 0xc8603f]), ry);
      k.win(0.014 * s, 0.018 * s, x, 0.022 * s, z + w * 0.43, 0, 0xffc870);
      break;
    }
    case 3: { // timber-framed houses
      const w = 0.06 * s, h = 0.07 * s;
      k.box(w, h, w, x, 0, z, 0xeee6d2, false, ry);
      k.box(w + 0.002, 0.006, w + 0.002, x, h * 0.5, z, 0x5a3a24, false, ry);
      k.roof(w * 1.1, 0.05 * s, w * 1.05, x, h, z, k.pick([0x6a4a3a, 0x5a5a62, 0x7a3a2a]), ry);
      k.windows(w, w, x, z, 0, 2, h / 2, 1, 0.6);
      break;
    }
    case 4: { // brick terraces and small factories
      if (i % 3 === 2) {
        k.box(0.085 * s, 0.06 * s, 0.07 * s, x, 0, z, 0x8a5a44, false, ry);
        k.cyl(0.008 * s, 0.01 * s, 0.11 * s, x + 0.03 * s, 0.06 * s, z, 0x6a4a3a, 6);
        k.smoke.push([x + 0.03 * s, 0.18 * s, z]);
        k.windows(0.085 * s, 0.07 * s, x, z, 0, 1, 0.06 * s, 3, 0.8);
      } else {
        const w = 0.08 * s, h = 0.07 * s;
        k.box(w, h, 0.05 * s, x, 0, z, k.pick([0xa85a44, 0x9a5040, 0xb5654a]), false, ry);
        k.roof(w, 0.025 * s, 0.055 * s, x, h, z, 0x5a5f68, ry);
        k.windows(w, 0.05 * s, x, z, 0, 2, h / 2, 3, 0.75);
      }
      break;
    }
    case 5: { // apartment blocks and glass towers
      const tall = s > 1.27;
      const w = 0.07 * s, floors = tall ? 6 + ((k.r() * 6) | 0) : 2 + ((k.r() * 3) | 0), fh = 0.022;
      const c = tall ? k.pick([0x6fa3d0, 0x5a8ab8, 0x8ab8d8]) : k.pick([0xe3dfd6, 0xd8d4cc, 0xc9c2b2]);
      k.box(w, floors * fh, w, x, 0, z, c);
      k.windows(w, w, x, z, 0, floors, fh, 2, 0.7);
      k.box(w * 0.4, 0.01, w * 0.4, x, floors * fh, z, 0x9aa0a8);
      break;
    }
    default: { // white domes and needle spires with neon rings
      if (i % 2) {
        const rad = 0.045 * s;
        k.dome(rad, x, 0, z, 0xf2f6fa);
        k.ring(rad * 1.02, 0.004, x, 0.004, z, k.pick([0x5ff0ff, 0xff5fd0, 0x8a7aff]));
        k.ball(0.008, x, rad, z, 0x9ff8ff, true);
      } else {
        const h = (0.14 + k.r() * 0.18) * s;
        k.cyl(0.006 * s, 0.022 * s, h, x, 0, z, 0xe6eef6, 8);
        k.ring(0.03 * s, 0.004, x, h * 0.62, z, k.pick([0x5ff0ff, 0xff5fd0, 0xffd25f]));
        k.ball(0.012 * s, x, h, z, 0x9ff8ff, true);
      }
    }
  }
}
function landmark(era, level, k) {
  switch (era) {
    case 0:
      k.cyl(0.035, 0.035, 0.01, 0, 0, 0, 0x6a6a6a, 8);
      k.ball(0.018, 0, 0.018, 0, 0xff8a2a, true);
      if (level >= 3) { for (let i = 0; i < 3; i++) k.cyl(0.011, 0.011, 0.04, -0.03, 0.04 * i, 0.06, [0xb05a3a, 0x3a6a8a, 0xd8b04a][i], 6); }
      if (level >= 4) { k.box(0.16, 0.05, 0.06, 0.02, 0, -0.07, 0x8a6a48); k.roof(0.17, 0.05, 0.07, 0.02, 0.05, -0.07, 0x6a5a3a); }
      break;
    case 1:
      if (level >= 3) { for (let i = 0; i < 3; i++) k.box(0.12 - i * 0.035, 0.03, 0.12 - i * 0.035, 0, i * 0.03, 0, 0xd0a868); k.box(0.03, 0.025, 0.03, 0, 0.09, 0, 0xb8864a); }
      else k.box(0.08, 0.006, 0.06, 0, 0, 0, 0xe6c85a);
      break;
    case 2:
      if (level >= 3) {
        k.box(0.12, 0.012, 0.08, 0, 0, 0, 0xe9e2d2);
        for (let i = 0; i < 5; i++) for (const zz of [-0.03, 0.03]) k.cyl(0.005, 0.005, 0.05, -0.048 + i * 0.024, 0.012, zz, 0xffffff, 6);
        k.roof(0.125, 0.025, 0.085, 0, 0.062, 0, 0xe9e2d2, Math.PI / 2 * 0);
      } else k.cyl(0.03, 0.03, 0.02, 0, 0, 0, 0xcfc8bb, 10);
      break;
    case 3:
      if (level >= 3) {
        k.box(0.06, 0.07, 0.11, 0, 0, 0, 0xcfc7b8); k.roof(0.065, 0.04, 0.115, 0, 0.07, 0, 0x5a5a62, Math.PI / 2);
        k.box(0.035, 0.14, 0.035, 0, 0, 0.065, 0xcfc7b8); k.cone(0.03, 0.07, 0, 0.14, 0.065, 0x5a5a62, 4);
        k.win(0.012, 0.02, 0, 0.1, 0.083, 0, 0xffd98a);
      }
      break;
    case 4:
      if (level >= 3) { k.box(0.035, 0.18, 0.035, 0, 0, 0, 0x8a5a44); k.cone(0.03, 0.04, 0, 0.18, 0, 0x5a5f68, 4); k.win(0.018, 0.018, 0, 0.15, 0.019, 0, 0xfff2d0); }
      break;
    case 5:
      if (level >= 3) { const f = level === 4 ? 18 : 12; k.box(0.07, f * 0.022, 0.07, 0, 0, 0, 0x5a8ab8); k.windows(0.07, 0.07, 0, 0, 0, f, 0.022, 2, 0.6); k.cyl(0.003, 0.003, 0.08, 0, f * 0.022, 0, 0xdddddd, 4); k.ball(0.006, 0, f * 0.022 + 0.08, 0, 0xff4040, true); }
      break;
    default:
      if (level >= 3) { k.dome(level === 4 ? 0.12 : 0.08, 0, 0, 0, 0xeef4fa); k.ring(level === 4 ? 0.122 : 0.082, 0.006, 0, 0.01, 0, 0x5ff0ff); k.cyl(0.004, 0.012, 0.32, 0, 0.05, 0, 0xe6eef6, 8); k.ball(0.014, 0, 0.37, 0, 0x9ff8ff, true); }
  }
}
// Towns are built from hex tiles: a centre tile with the town's landmark, and
// neighbourhood tiles around it (three variants per age, plus fields in the
// farming ages). A tile is about 0.4 units across.
const TRIO = [[0.085, 0], [-0.0425, 0.074], [-0.0425, -0.074]];
export function tileModel(era, variant) {
  const k = kit(era * 37 + variant * 11 + 5);
  if (variant === 3) {
    // crop rows
    const c = k.pick([0xe6c85a, 0x9ac84a, 0xd8b04a]), c2 = 0x6a8a3a;
    for (let r = 0; r < 4; r++) k.box(0.22, 0.012, 0.03, 0, 0, -0.07 + r * 0.047, r % 2 ? c : c2);
    if (era >= 2) k.box(0.03, 0.04, 0.03, 0.09, 0, 0.08, 0x8a6a48);
    return done(k);
  }
  if (variant === 4) {
    // a little park: lawn, trees and a fountain or statue
    k.cyl(0.15, 0.15, 0.006, 0, 0, 0, 0x6ab84a, 6);
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.1; k.cyl(0.006, 0.008, 0.04, x, 0, z, 0x6a4a2a, 5); k.ball(0.03 + (i % 2) * 0.008, x, 0.06, z, i % 2 ? 0x4a9a3a : 0x5aae44, false, 1); }
    if (era >= 2) { k.cyl(0.035, 0.04, 0.015, 0, 0, 0, 0xd8d0c0, 10); k.cyl(0.03, 0.03, 0.004, 0, 0.013, 0, 0x5fc8ff, 10, true); k.cyl(0.006, 0.006, 0.04, 0, 0.01, 0, 0xd8d0c0, 6); }
    else k.box(0.02, 0.05, 0.02, 0, 0, 0, 0x9a948a);
    return done(k);
  }
  if (variant === 11) {
    // a city block: houses shoulder to shoulder around the edge, a courtyard in the middle
    for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI * 2 + Math.PI / 6; building(era, k, Math.cos(an) * 0.098, Math.sin(an) * 0.098, (era >= 4 ? 1.05 : 0.95) + (i % 2) * 0.12, i + 4); }
    k.cyl(0.045, 0.045, 0.004, 0, 0, 0, era >= 4 ? 0x9aa0a8 : 0x8ab85a, 6);
    k.cyl(0.005, 0.007, 0.035, 0, 0, 0, 0x6a4a2a, 5); k.ball(0.024, 0, 0.05, 0, 0x5aa844, false, 1);
    return done(k);
  }
  if (variant === 5) {
    // a dense downtown block: four buildings, the middle one taller
    TRIO.forEach(([x, z], i) => building(era, k, x * 1.05, z * 1.05, 1.25 + k.r() * 0.2, i * 3 + 1));
    building(era, k, 0, 0, era >= 4 ? 1.5 : 1.15, 9);
    return done(k);
  }
  if (variant === 6) {
    // suburb: two homes with gardens, hedges and a tree
    const home = Math.min(era, 5) === 5 ? 3 : era;
    for (const [x, z, i] of [[0.075, 0.03, 0], [-0.06, -0.05, 1]]) {
      k.box(0.09, 0.004, 0.09, x, 0, z, 0x7ac05a);
      building(home === 6 ? 6 : home, k, x, z, 0.95, i + 2);
      if (era >= 1) k.box(0.09, 0.012, 0.006, x, 0, z + 0.045, 0x4a8a3a);
    }
    k.cyl(0.006, 0.008, 0.04, -0.07, 0, 0.08, 0x6a4a2a, 5); k.ball(0.03, -0.07, 0.06, 0.08, 0x5aa844, false, 1);
    if (era >= 5) k.box(0.03, 0.012, 0.018, 0.02, 0, -0.1, k.pick([0xd04a3a, 0x3a7ad0, 0xe0c040]));
    return done(k);
  }
  if (variant === 7) {
    // a market: stalls with coloured awnings (or neon-lit shops in later ages)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3, x = Math.cos(a) * 0.09, z = Math.sin(a) * 0.09, col = [0xd04a3a, 0x3a8ad0, 0xe0b030, 0x4ab06a, 0xb05ad0][i];
      if (era <= 3) { k.box(0.045, 0.03, 0.035, x, 0, z, 0x9a7a52, false, -a); k.roof(0.055, 0.02, 0.045, x, 0.03, z, col, -a); }
      else { k.box(0.05, 0.045, 0.04, x, 0, z, era >= 5 ? 0xe6eaf0 : 0xb89a7a, false, -a); k.box(0.052, 0.008, 0.004, x + Math.cos(a) * 0.022, 0.035, z + Math.sin(a) * 0.022, col, true, -a); }
    }
    k.cyl(0.03, 0.03, 0.005, 0, 0, 0, era >= 4 ? 0x9aa0a8 : 0xc8b890, 10);
    if (era >= 2) { k.cyl(0.004, 0.004, 0.06, 0, 0, 0, 0x5a5a62, 5); k.ball(0.01, 0, 0.065, 0, 0xffd27a, true); }
    return done(k);
  }
  if (variant === 8) {
    // a plaza with a monument of the age and benches
    k.cyl(0.13, 0.13, 0.006, 0, 0, 0, era >= 4 ? 0xc8ccd2 : 0xd8ccb0, 6);
    const mon = [0x8a8478, 0xc8a050, 0xf2ede2, 0xb8b0a0, 0x6a4a3a, 0x9fb8d8, 0xeef4fa][era];
    k.box(0.04, 0.025, 0.04, 0, 0, 0, 0xb8b0a0);
    if (era === 6) { k.ball(0.03, 0, 0.07, 0, 0x9ff8ff, true, 1); k.ring(0.045, 0.004, 0, 0.07, 0, 0x5ff0ff); }
    else if (era >= 4) k.cyl(0.008, 0.014, 0.12, 0, 0.025, 0, mon, 6);
    else { k.box(0.016, 0.05, 0.016, 0, 0.025, 0, mon); k.ball(0.014, 0, 0.085, 0, mon, false, 0); }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; k.box(0.035, 0.008, 0.01, Math.cos(a) * 0.08, 0.006, Math.sin(a) * 0.08, 0x6a4a2a, false, -a); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1; k.ball(0.022, Math.cos(a) * 0.11, 0.035, Math.sin(a) * 0.11, 0x5aa844, false, 1); }
    if (era >= 3) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.cyl(0.003, 0.003, 0.045, Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06, 0x3a3a40, 4); k.ball(0.007, Math.cos(a) * 0.06, 0.048, Math.sin(a) * 0.06, 0xffe0a0, true); }
    return done(k);
  }
  if (variant === 9) {
    // a working yard: a long workshop, crates, barrels and a cart
    k.box(0.16, 0.05, 0.07, -0.02, 0, -0.05, [0x9a7a52, 0xb08a5a, 0xd8d0c0, 0x8a7a6a, 0x8a5a44, 0xb8bcc4, 0xdfe6ee][era]);
    k.roof(0.17, 0.035, 0.08, -0.02, 0.05, -0.05, [0x7a5a3a, 0x8a6a48, 0xb0482f, 0x5a5a62, 0x5a5f68, 0x6a7078, 0x9fb8d8][era]);
    for (let i = 0; i < 4; i++) k.box(0.025, 0.025, 0.025, 0.06 + (i % 2) * 0.03, 0, 0.03 + Math.floor(i / 2) * 0.03, 0xa8824a);
    for (let i = 0; i < 3; i++) k.cyl(0.012, 0.012, 0.03, -0.08 + i * 0.03, 0, 0.07, 0x7a5a3a, 8);
    if (era >= 4) { k.cyl(0.008, 0.01, 0.1, -0.07, 0.05, -0.07, 0x6a4a3a, 6); k.smoke.push([-0.07, 0.16, -0.07]); }
    else { k.box(0.05, 0.015, 0.03, 0.02, 0.008, 0.1, 0x8a5a34); k.cyl(0.012, 0.012, 0.004, 0.0, 0.008, 0.1, 0x3a2a1a, 8); }
    return done(k);
  }
  if (variant === 10) {
    // a place of worship or learning for the age, with a little garden
    landmark(era, 3, k);
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.5; k.ball(0.022, Math.cos(a) * 0.12, 0.035, Math.sin(a) * 0.12, 0x5aa844, false, 1); }
    return done(k);
  }
  const s = 1.3;
  if (era === 5 && variant === 0) {
    // a tall tower in the middle of the block
    building(5, k, 0, 0, 1.4, 0);
    building(5, k, 0.1, 0.06, 0.9, 1);
  } else if (era === 6 && variant === 0) {
    building(6, k, 0, 0, 1.5, 0);
    building(6, k, 0.09, -0.05, 1.0, 1);
    building(6, k, -0.09, -0.05, 1.0, 3);
  } else {
    const rot = variant * 0.7;
    TRIO.forEach(([x, z], i) => {
      const c = Math.cos(rot), sn = Math.sin(rot);
      building(era, k, x * c - z * sn, x * sn + z * c, s * (0.9 + k.r() * 0.25), i + variant);
    });
    if (era <= 2 && variant === 1) k.ball(0.03, 0, 0.02, 0, 0x5a9a3a, false, 0);
    // later ages pack a fourth building into the middle of the block
    if (era >= 3 && variant !== 1) building(era, k, 0, 0, s * 0.85, 7 + variant);
    if (variant === 1) for (let i = 0; i < 3; i++) { const a = i * 2.1 + 1; k.ball(0.022, Math.cos(a) * 0.12, 0.04, Math.sin(a) * 0.12, 0x5aa844, false, 1); k.cyl(0.004, 0.005, 0.03, Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, 0x6a4a2a, 5); }
    if (era >= 4 && variant === 2) k.box(0.05, 0.004, 0.05, 0, 0, 0, 0x6aaa4a);
  }
  return done(k);
}
export function centerModel(era, level) {
  const k = kit(era * 53 + level * 7 + 3);
  landmark(era, level, k);
  // a few homes around a small square in young towns
  if (level <= 2) {
    const s = 0.95;
    const spots = level === 1 ? [[0.1, 0.05], [-0.09, 0.07]] : [[0.11, 0.04], [-0.1, 0.07], [0.0, -0.12]];
    spots.forEach(([x, z], i) => building(era, k, x, z, s, i));
  }
  return done(k);
}

// ------------------------------------------------------------------ buildings the player places
// Each fits on one hex (about 0.3 units across) and faces the hex's first corner.
export function buildingModel(id) {
  const k = kit(id.length * 977 + id.charCodeAt(0) * 31);
  switch (id) {
    case 'hunt':
      k.cone(0.06, 0.1, -0.06, 0, -0.03, 0x9a7a52, 7); k.cone(0.05, 0.085, 0.05, 0, -0.07, 0x8a6a48, 7);
      for (const x of [-0.02, 0.06]) k.box(0.008, 0.07, 0.008, x, 0, 0.07, 0x5a3a24);
      k.box(0.1, 0.006, 0.006, 0.02, 0.065, 0.07, 0x5a3a24);
      for (let i = 0; i < 3; i++) k.box(0.012, 0.03, 0.004, -0.005 + i * 0.025, 0.035, 0.07, 0x8a3a2a);
      k.ball(0.016, 0.06, 0.016, 0.03, 0xff8a2a, true);
      break;
    case 'shrine':
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; k.box(0.025, 0.07 + (i % 2) * 0.02, 0.018, Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11, 0x9a948a, false, -a); }
      k.cyl(0.018, 0.022, 0.15, 0, 0, 0, 0x8a5a3a, 6);
      for (let i = 0; i < 3; i++) k.cyl(0.024, 0.024, 0.025, 0, 0.03 + i * 0.04, 0, [0xb05a3a, 0x3a6a8a, 0xd8b04a][i], 6);
      k.ball(0.012, 0, 0.17, 0, 0xffd27a, true);
      break;
    case 'farm':
      for (let r = 0; r < 5; r++) k.box(0.26, 0.012, 0.028, 0, 0, -0.12 + r * 0.045, r % 2 ? 0xe6c85a : 0x8ab84a);
      k.box(0.08, 0.06, 0.06, 0.08, 0, 0.1, 0xb0442f); k.roof(0.09, 0.04, 0.065, 0.08, 0.06, 0.1, 0x6a4a3a);
      k.cyl(0.022, 0.022, 0.11, -0.03, 0, 0.11, 0xd8d0c0, 10); k.dome(0.022, -0.03, 0.11, 0.11, 0xa8a090);
      break;
    case 'workshop':
      k.box(0.16, 0.06, 0.11, 0, 0, 0, 0xa87a54); k.roof(0.17, 0.05, 0.12, 0, 0.06, 0, 0x6a4a3a);
      k.cyl(0.013, 0.015, 0.13, 0.05, 0, -0.03, 0x6a6a6a, 6); k.smoke.push([0.05, 0.15, -0.03]);
      k.box(0.03, 0.03, 0.02, -0.03, 0.015, 0.056, 0xff9a40, true);
      k.box(0.05, 0.02, 0.03, -0.09, 0, 0.09, 0x4a4a52);
      break;
    case 'temple':
      k.box(0.2, 0.02, 0.14, 0, 0, 0, 0xe9e2d2); k.box(0.17, 0.015, 0.11, 0, 0.02, 0, 0xf2ede2);
      for (let i = 0; i < 6; i++) for (const z of [-0.045, 0.045]) k.cyl(0.008, 0.009, 0.08, -0.07 + i * 0.028, 0.035, z, 0xffffff, 8);
      k.box(0.18, 0.012, 0.12, 0, 0.115, 0, 0xe9e2d2); k.roof(0.18, 0.04, 0.12, 0, 0.127, 0, 0xd8cfbb, Math.PI / 2);
      k.box(0.02, 0.03, 0.02, 0, 0.035, 0, 0xffc860, true);
      break;
    case 'library':
      k.box(0.17, 0.08, 0.12, 0, 0, 0, 0xd8cfbb);
      for (let i = 0; i < 4; i++) k.cyl(0.008, 0.008, 0.07, -0.06 + i * 0.04, 0.005, 0.068, 0xf2ede2, 8);
      k.box(0.18, 0.012, 0.14, 0, 0.08, 0, 0xc8bfab); k.dome(0.05, 0, 0.092, 0, 0x7aa0a8);
      k.windows(0.17, 0.12, 0, 0, 0, 1, 0.07, 3, 0.9);
      break;
    case 'aqueduct':
      for (let i = 0; i < 5; i++) k.box(0.025, 0.11, 0.03, -0.12 + i * 0.06, 0, 0, 0xcfc4ac);
      k.box(0.28, 0.025, 0.04, 0, 0.11, 0, 0xcfc4ac); k.box(0.28, 0.006, 0.022, 0, 0.135, 0, 0x5fb8ff, true);
      k.cyl(0.05, 0.05, 0.025, 0.02, 0, 0.09, 0xcfc4ac, 12); k.cyl(0.042, 0.042, 0.004, 0.02, 0.022, 0.09, 0x5fb8ff, 12, true);
      break;
    case 'market':
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * 0.12 - 0.06, z = Math.floor(i / 2) * 0.12 - 0.06;
        k.box(0.07, 0.035, 0.05, x, 0, z, 0x9a7a52);
        k.roof(0.085, 0.025, 0.065, x, 0.035, z, [0xd04a3a, 0x3a8ad0, 0xe0b030, 0x4ab06a][i]);
      }
      k.cyl(0.02, 0.02, 0.012, 0, 0, 0, 0x8a8a8a, 10); k.ball(0.008, 0, 0.03, 0, 0xffd27a, true);
      break;
    case 'castle': {
      const c = 0xb8b0a0;
      k.box(0.09, 0.15, 0.09, 0, 0, 0, c); k.cone(0.07, 0.06, 0, 0.15, 0, 0x6a4a3a, 4);
      for (const [x, z] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]]) { k.cyl(0.025, 0.028, 0.11, x, 0, z, c, 8); k.cone(0.03, 0.05, x, 0.11, z, 0x5a5a62, 8); }
      for (const [w, d, x, z] of [[0.2, 0.014, 0, 0.1], [0.2, 0.014, 0, -0.1], [0.014, 0.2, 0.1, 0], [0.014, 0.2, -0.1, 0]]) k.box(w, 0.06, d, x, 0, z, c);
      k.win(0.02, 0.03, 0, 0.1, 0.046, 0, 0xffd98a);
      k.box(0.004, 0.05, 0.004, 0, 0.21, 0, 0x5a3a24); k.box(0.03, 0.018, 0.002, 0.016, 0.24, 0, 0xd03a3a);
      break;
    }
    case 'university':
      k.box(0.2, 0.08, 0.1, 0, 0, 0, 0xb89a7a); k.roof(0.21, 0.05, 0.11, 0, 0.08, 0, 0x5a5a62);
      k.box(0.045, 0.2, 0.045, 0.06, 0, 0.03, 0xb89a7a); k.cone(0.04, 0.08, 0.06, 0.2, 0.03, 0x5a5a62, 4);
      k.windows(0.2, 0.1, 0, 0, 0, 2, 0.04, 5, 0.8);
      k.ball(0.012, 0.06, 0.16, 0.055, 0xfff0c0, true);
      break;
    case 'factory':
      k.box(0.22, 0.07, 0.13, 0, 0, 0, 0x8a5a44);
      for (let i = 0; i < 4; i++) k.roof(0.055, 0.04, 0.13, -0.083 + i * 0.055, 0.07, 0, 0x5a5f68, Math.PI / 2);
      for (const x of [-0.06, 0.03]) { k.cyl(0.013, 0.017, 0.2, x, 0, -0.08, 0x6a4a3a, 6); k.smoke.push([x, 0.22, -0.08]); }
      k.windows(0.22, 0.13, 0, 0, 0, 1, 0.06, 6, 0.9);
      break;
    case 'railway':
      k.box(0.3, 0.004, 0.012, 0, 0, 0.07, 0x3a3030); k.box(0.3, 0.004, 0.012, 0, 0, 0.1, 0x3a3030);
      k.box(0.14, 0.06, 0.07, -0.02, 0, -0.06, 0xa85a44); k.roof(0.15, 0.035, 0.08, -0.02, 0.06, -0.06, 0x4a4f5a);
      k.windows(0.14, 0.07, -0.02, -0.06, 0, 1, 0.05, 4, 0.9);
      k.box(0.07, 0.045, 0.035, 0.08, 0.004, 0.085, 0x2a2a30); k.cyl(0.012, 0.012, 0.03, 0.1, 0.05, 0.085, 0x2a2a30, 6);
      k.box(0.06, 0.04, 0.035, 0.0, 0.004, 0.085, 0x3a6a4a); k.box(0.06, 0.04, 0.035, -0.07, 0.004, 0.085, 0x3a6a4a);
      k.smoke.push([0.1, 0.09, 0.085]);
      break;
    case 'hospital':
      k.box(0.18, 0.12, 0.12, 0, 0, 0, 0xf2f4f6); k.windows(0.18, 0.12, 0, 0, 0, 4, 0.03, 5, 0.8);
      k.box(0.06, 0.018, 0.018, 0, 0.122, 0, 0xe03a3a); k.box(0.018, 0.018, 0.06, 0, 0.122, 0, 0xe03a3a);
      k.cyl(0.03, 0.03, 0.004, 0.05, 0.12, 0.03, 0x4a4f5a, 12);
      break;
    case 'power':
      for (const x of [-0.07, 0.06]) { k.cyl(0.045, 0.06, 0.16, x, 0, -0.02, 0xd8d4cc, 14); k.smoke.push([x, 0.18, -0.02]); }
      k.box(0.12, 0.06, 0.06, 0, 0, 0.09, 0x8a8f96); k.windows(0.12, 0.06, 0, 0.09, 0, 1, 0.05, 4, 0.9);
      k.box(0.02, 0.02, 0.02, 0.07, 0.06, 0.09, 0x5fd0ff, true);
      break;
    case 'airport':
      k.box(0.3, 0.004, 0.06, 0, 0, 0.04, 0x3a3f48);
      for (let i = 0; i < 6; i++) k.box(0.025, 0.002, 0.006, -0.12 + i * 0.05, 0.004, 0.04, 0xffffff, true);
      k.cyl(0.012, 0.016, 0.12, -0.08, 0, -0.08, 0xd8d4cc, 8); k.cyl(0.026, 0.02, 0.025, -0.08, 0.12, -0.08, 0x5fb8ff, 8, true);
      k.box(0.13, 0.035, 0.05, 0.05, 0, -0.08, 0xe0e4ea); k.windows(0.13, 0.05, 0.05, -0.08, 0, 1, 0.03, 5, 0.9);
      k.box(0.06, 0.01, 0.012, 0.06, 0.01, 0.04, 0xf2f4f8); k.box(0.012, 0.004, 0.06, 0.065, 0.012, 0.04, 0xf2f4f8);
      break;
    case 'lab':
      k.cyl(0.12, 0.13, 0.025, 0, 0, 0, 0xdfe6ee, 16); k.dome(0.09, 0, 0.025, 0, 0xeef4fa);
      k.ring(0.095, 0.006, 0, 0.03, 0, 0x5ff0ff);
      k.cyl(0.004, 0.004, 0.1, 0.04, 0.09, 0, 0xcccccc, 4); k.dome(0.03, 0.04, 0.19, 0, 0xf2f6fa);
      k.ball(0.01, 0.04, 0.2, 0, 0xff5fd0, true);
      break;
    case 'fusion':
      k.cyl(0.13, 0.14, 0.03, 0, 0, 0, 0x8a96a8, 16);
      k.ring(0.09, 0.025, 0, 0.09, 0, 0x5ff0ff);
      k.ball(0.045, 0, 0.09, 0, 0xfff2a0, true, 1);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.cyl(0.01, 0.012, 0.09, Math.cos(a) * 0.09, 0.03, Math.sin(a) * 0.09, 0xdfe6ee, 6); }
      break;
    case 'arcology':
      for (let i = 0; i < 4; i++) { const w = 0.24 - i * 0.05, hh = 0.07; k.box(w, hh, w, 0, i * hh, 0, i % 2 ? 0xe6eef6 : 0xcfd8e2); k.windows(w, w, 0, 0, i * hh, 1, hh, 4, 0.8); k.box(w + 0.01, 0.008, w + 0.01, 0, (i + 1) * hh, 0, 0x6aba5a); }
      k.cyl(0.004, 0.008, 0.1, 0, 0.28, 0, 0xe6eef6, 6); k.ball(0.01, 0, 0.38, 0, 0x5ff0ff, true);
      break;
  }
  return done(k);
}

// ------------------------------------------------------------------ wonders
export const WONDERS = ['Stonehenge', 'Great Pyramid', 'Parthenon', 'Cathedral', 'Iron Tower', 'Sky Needle', 'Starship'];
export function wonderModel(era) {
  const k = kit(9000 + era);
  if (era === 0) {
    k.cyl(0.2, 0.2, 0.005, 0, 0, 0, 0x8aa86a, 20);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, x = Math.cos(a) * 0.15, z = Math.sin(a) * 0.15;
      k.box(0.03, 0.09, 0.02, x, 0, z, 0x9a9a92, false, -a);
      if (i % 2 === 0) { const a2 = a + Math.PI / 10; k.box(0.07, 0.018, 0.022, Math.cos(a2) * 0.15, 0.09, Math.sin(a2) * 0.15, 0x8a8a82, false, -a2 + Math.PI / 2); }
    }
    for (let i = 0; i < 3; i++) { const a = i * 2.1; k.box(0.025, 0.12, 0.02, Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06, 0xa2a29a, false, -a); }
  } else if (era === 1) {
    k.pyr(0.36, 0.26, 0, 0, 0, 0xe2c48a);
    k.pyr(0.06, 0.04, 0, 0.24, 0, 0xffe7a0);
    k.box(0.04, 0.03, 0.08, 0.22, 0, 0.12, 0xd8b47a); k.box(0.025, 0.025, 0.025, 0.22, 0.03, 0.16, 0xd8b47a);
  } else if (era === 2) {
    k.box(0.32, 0.02, 0.2, 0, 0, 0, 0xe9e2d2); k.box(0.3, 0.012, 0.18, 0, 0.02, 0, 0xf2ede2);
    for (let i = 0; i < 8; i++) for (const z of [-0.08, 0.08]) k.cyl(0.01, 0.011, 0.11, -0.14 + i * 0.04, 0.032, z, 0xffffff, 8);
    for (const x of [-0.14, 0.14]) for (let j = 1; j < 4; j++) k.cyl(0.01, 0.011, 0.11, x, 0.032, -0.08 + j * 0.04, 0xffffff, 8);
    k.box(0.31, 0.02, 0.19, 0, 0.142, 0, 0xf2ede2);
    k.roof(0.31, 0.04, 0.19, 0, 0.162, 0, 0xe9e2d2, Math.PI / 2 * 0);
  } else if (era === 3) {
    k.box(0.12, 0.13, 0.28, 0, 0, 0.02, 0xcfc7b8); k.roof(0.13, 0.07, 0.29, 0, 0.13, 0.02, 0x5a5a62, Math.PI / 2);
    for (const x of [-0.05, 0.05]) { k.box(0.05, 0.26, 0.05, x, 0, -0.14, 0xcfc7b8); k.cone(0.04, 0.1, x, 0.26, -0.14, 0x5a5a62, 4); }
    k.box(0.06, 0.22, 0.06, 0, 0, 0.12, 0xd8d0c0); k.cone(0.04, 0.18, 0, 0.22, 0.12, 0x5a5a62, 4);
    k.win(0.04, 0.04, 0, 0.17, -0.166, Math.PI, 0xff9a5a); k.win(0.025, 0.06, 0, 0.06, 0.161, 0, 0xffd98a);
    for (let i = 0; i < 4; i++) k.win(0.012, 0.05, 0.061, 0.05, -0.08 + i * 0.06, Math.PI / 2, 0x8ab8ff);
  } else if (era === 4) {
    const leg = (sx, sz) => k.B.push({ g: new THREE.CylinderGeometry(0.008, 0.02, 0.3, 4).translate(0, 0.15, 0).rotateZ(-sx * 0.28).rotateX(sz * 0.28).translate(sx * 0.06, 0, sz * 0.06), c: 0x6a5a4a });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(sx, sz);
    k.box(0.13, 0.012, 0.13, 0, 0.1, 0, 0x6a5a4a);
    k.cyl(0.008, 0.035, 0.32, 0, 0.12, 0, 0x6a5a4a, 4);
    k.box(0.06, 0.01, 0.06, 0, 0.27, 0, 0x6a5a4a);
    k.cyl(0.003, 0.005, 0.08, 0, 0.44, 0, 0x6a5a4a, 4);
    k.ball(0.01, 0, 0.53, 0, 0xffd98a, true);
    for (let i = 0; i < 6; i++) k.ball(0.006, Math.cos(i) * 0.05, 0.11, Math.sin(i) * 0.05, 0xffe7b0, true);
  } else if (era === 5) {
    k.cyl(0.05, 0.08, 0.04, 0, 0, 0, 0xcfd6df, 12);
    k.cyl(0.012, 0.025, 0.5, 0, 0.04, 0, 0xe6ecf2, 10);
    k.cyl(0.06, 0.05, 0.05, 0, 0.42, 0, 0xdfe5ec, 14);
    k.ring(0.061, 0.006, 0, 0.445, 0, 0x5fc8ff);
    k.cyl(0.004, 0.004, 0.16, 0, 0.47, 0, 0xffffff, 4);
    k.ball(0.008, 0, 0.64, 0, 0xff4040, true);
  } else {
    k.cyl(0.16, 0.17, 0.02, 0, 0, 0, 0x8a8f96, 16);
    k.box(0.02, 0.5, 0.02, 0.09, 0.02, 0, 0xd04a3a);
    for (let i = 1; i < 6; i++) k.box(0.05, 0.006, 0.01, 0.065, 0.02 + i * 0.08, 0, 0xd04a3a);
    // the ship itself is separate so it can lift off (see starshipModel)
  }
  return done(k);
}
export function starshipModel() {
  const k = kit(777);
  k.cyl(0.035, 0.04, 0.32, 0, 0.02, 0, 0xf2f4f7, 16);
  k.cone(0.035, 0.1, 0, 0.34, 0, 0xf2f4f7, 16);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; k.box(0.008, 0.08, 0.05, Math.cos(a) * 0.04, 0.02, Math.sin(a) * 0.04, 0x3a4250, false, -a); }
  k.ring(0.036, 0.004, 0, 0.26, 0, 0x5ff0ff);
  for (let i = 0; i < 4; i++) k.win(0.012, 0.012, 0, 0.18 + i * 0.03, 0.041, 0, 0x9ff8ff);
  k.cyl(0.03, 0.02, 0.02, 0, 0, 0, 0x5a5f68, 12);
  return done(k);
}

// ------------------------------------------------------------------ small things
// ------------------------------------------------------------------ city life and scenery
const white = (g) => ({ g, c: 0xffffff });
export function roadGeo() { return mergeParts([white(new THREE.BoxGeometry(1, 0.006, 1).translate(0, 0.003, 0))]); }
export function laneGeo() { return mergeParts([white(new THREE.BoxGeometry(1, 0.002, 1).translate(0, 0.007, 0))]); }
export function lampGeos() {
  return {
    post: mergeParts([{ g: new THREE.CylinderGeometry(0.003, 0.004, 0.06, 4).translate(0, 0.03, 0), c: 0x2a2a30 }]),
    light: mergeParts([{ g: new THREE.IcosahedronGeometry(0.012, 0).translate(0, 0.064, 0), c: 0xffffff }]),
  };
}
export function carGeo() {
  return mergeParts([
    white(new THREE.BoxGeometry(0.026, 0.01, 0.014).translate(0, 0.009, 0)),
    { g: new THREE.BoxGeometry(0.014, 0.008, 0.012).translate(-0.002, 0.018, 0), c: 0xbfd8f0 },
    ...[[-0.008, 0.007], [0.008, 0.007], [-0.008, -0.007], [0.008, -0.007]].map(([x, z]) => ({ g: new THREE.CylinderGeometry(0.004, 0.004, 0.003, 6).rotateX(Math.PI / 2).translate(x, 0.004, z), c: 0x1a1a1e })),
  ]);
}
export function podGeo() {
  return mergeParts([{ g: new THREE.SphereGeometry(0.011, 10, 6).scale(1.6, 0.7, 1).translate(0, 0.03, 0), c: 0xffffff }]);
}
export function boatGeos() {
  return {
    sail: mergeParts([
      { g: new THREE.BoxGeometry(0.07, 0.016, 0.025).translate(0, 0.008, 0), c: 0x8a5a34 },
      { g: new THREE.CylinderGeometry(0.002, 0.002, 0.08, 4).translate(0, 0.05, 0), c: 0x5a3a24 },
      { g: new THREE.ConeGeometry(0.026, 0.065, 3).rotateY(Math.PI / 2).scale(0.25, 1, 1).translate(0.006, 0.05, 0), c: 0xf4efe2 },
    ]),
    ship: mergeParts([
      { g: new THREE.BoxGeometry(0.12, 0.022, 0.034).translate(0, 0.011, 0), c: 0x2a3a5a },
      { g: new THREE.BoxGeometry(0.12, 0.004, 0.034).translate(0, 0.024, 0), c: 0xb83a2a },
      { g: new THREE.BoxGeometry(0.03, 0.022, 0.026).translate(-0.035, 0.034, 0), c: 0xf2f2f2 },
      ...[0, 1, 2].map((i) => ({ g: new THREE.BoxGeometry(0.02, 0.012, 0.024).translate(0.005 + i * 0.022, 0.032, 0), c: [0xd04a3a, 0x3a7ad0, 0xe0b030][i] })),
    ]),
  };
}
export function birdGeo() {
  // a little chevron: two wings
  return mergeParts([
    { g: new THREE.BoxGeometry(0.03, 0.002, 0.008).rotateY(0.6).translate(-0.01, 0, 0.008), c: 0x2a2a30 },
    { g: new THREE.BoxGeometry(0.03, 0.002, 0.008).rotateY(-0.6).translate(-0.01, 0, -0.008), c: 0x2a2a30 },
  ]);
}
export function sceneryGeos() {
  return {
    tuft: mergeParts([0, 1, 2].map((i) => ({ g: new THREE.ConeGeometry(0.006, 0.025, 3).rotateZ((i - 1) * 0.35).translate((i - 1) * 0.006, 0.012, 0), c: 0x5a9a3a }))),
    flower: mergeParts([{ g: new THREE.CylinderGeometry(0.001, 0.001, 0.02, 3).translate(0, 0.01, 0), c: 0x4a8a3a }, white(new THREE.IcosahedronGeometry(0.006, 0).translate(0, 0.022, 0))]),
    rock: mergeParts([{ g: new THREE.DodecahedronGeometry(0.022, 0).scale(1, 0.6, 1).translate(0, 0.008, 0), c: 0x8a8478 }, { g: new THREE.DodecahedronGeometry(0.013, 0).translate(0.022, 0.006, 0.01), c: 0x9a948a }]),
  };
}
export function personGeo() {
  return mergeParts([
    { g: new THREE.CylinderGeometry(0.009, 0.012, 0.028, 6).translate(0, 0.014, 0), c: 0xffffff },
    { g: new THREE.IcosahedronGeometry(0.008, 0).translate(0, 0.036, 0), c: 0xf0c39a },
  ]);
}
export function planeGeo() {
  return mergeParts([
    { g: new THREE.CylinderGeometry(0.008, 0.006, 0.08, 6).rotateX(Math.PI / 2), c: 0xf2f4f7 },
    { g: new THREE.BoxGeometry(0.09, 0.003, 0.02).translate(0, 0, 0.004), c: 0xdfe5ec },
    { g: new THREE.BoxGeometry(0.03, 0.002, 0.012).translate(0, 0, -0.035), c: 0xdfe5ec },
    { g: new THREE.BoxGeometry(0.002, 0.018, 0.012).translate(0, 0.009, -0.035), c: 0x3b82f6 },
  ]);
}
export function satelliteGeo() {
  return mergeParts([
    { g: new THREE.BoxGeometry(0.03, 0.03, 0.04), c: 0xe6c85a },
    { g: new THREE.BoxGeometry(0.1, 0.002, 0.03).translate(0.07, 0, 0), c: 0x2a4a8a },
    { g: new THREE.BoxGeometry(0.1, 0.002, 0.03).translate(-0.07, 0, 0), c: 0x2a4a8a },
  ]);
}
export function treeGeos() {
  return [
    mergeParts([{ g: new THREE.CylinderGeometry(0.007, 0.01, 0.04, 5).translate(0, 0.02, 0), c: 0x6b4a2b }, { g: new THREE.ConeGeometry(0.035, 0.07, 6).translate(0, 0.065, 0), c: 0x2f7d3a }, { g: new THREE.ConeGeometry(0.025, 0.05, 6).translate(0, 0.1, 0), c: 0x3d9848 }]),
    mergeParts([{ g: new THREE.CylinderGeometry(0.007, 0.01, 0.045, 5).translate(0, 0.022, 0), c: 0x7a5232 }, { g: new THREE.IcosahedronGeometry(0.035, 0).translate(0, 0.07, 0), c: 0x4c9a3a }]),
  ];
}
export function cloudGeo() {
  const r = mulberry32(5), parts = [];
  // a soft cumulus: a row of puffs, biggest in the middle, flattened underneath
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 0.075 + (r() - 0.5) * 0.03, size = 0.09 + (1 - Math.abs(i - 4) / 4) * 0.08 + r() * 0.03;
    parts.push({ g: new THREE.SphereGeometry(size, 12, 8).scale(1, 0.8, 1).translate(x, size * 0.35 + r() * 0.03, (r() - 0.5) * 0.12), c: 0xffffff });
  }
  for (let i = 0; i < 4; i++) parts.push({ g: new THREE.SphereGeometry(0.07 + r() * 0.03, 10, 6).scale(1, 0.75, 1).translate((r() - 0.5) * 0.35, 0.02, (r() - 0.5) * 0.25), c: 0xeef2f8 });
  return mergeParts(parts);
}
