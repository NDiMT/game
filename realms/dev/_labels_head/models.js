import * as THREE from 'three';

// =====================================================================
// HEX REALMS: low-poly models. Everything is built from simple shapes
// and merged into one vertex-coloured geometry per model. Creatures are
// about 1 unit tall, standing on y = 0 and facing +z.
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
export function kit(seed = 1) {
  const r = mulberry32(seed);
  const B = [], G = [];
  const add = (g, c, glow) => (glow ? G : B).push({ g, c });
  const k = {
    r, B, G,
    pick: (a) => a[(r() * a.length) | 0],
    add,
    box: (w, h, d, x, y, z, c, glow = false, ry = 0, rx = 0, rz = 0) => add(new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateZ(rz).rotateY(ry).translate(x, y + h / 2, z), c, glow),
    cyl: (r1, r2, h, x, y, z, c, s = 8, glow = false) => add(new THREE.CylinderGeometry(r1, r2, h, s).translate(x, y + h / 2, z), c, glow),
    // a limb: a cylinder from point a to point b
    limb(a, b, rad, c, s = 6) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(rad, rad * 0.85, len, s);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      add(g, c, false);
    },
    cone: (rad, h, x, y, z, c, s = 7, glow = false, rx = 0) => add(new THREE.ConeGeometry(rad, h, s).translate(0, h / 2, 0).rotateX(rx).translate(x, y, z), c, glow),
    ball: (rad, x, y, z, c, glow = false, d = 1, sy = 1) => add(new THREE.IcosahedronGeometry(rad, d).scale(1, sy, 1).translate(x, y, z), c, glow),
    egg: (rx_, ry_, rz_, x, y, z, c) => add(new THREE.IcosahedronGeometry(1, 1).scale(rx_, ry_, rz_).translate(x, y, z), c, false),
    roof: (w, h, d, x, y, z, c, ry = 0) => add(roofGeo().scale(w, h, d).rotateY(ry).translate(x, y, z), c, false),
    ring: (rad, tube, x, y, z, c, glow = true) => add(new THREE.TorusGeometry(rad, tube, 6, 20).rotateX(Math.PI / 2).translate(x, y, z), c, glow),
    // a flat wing: a fan of triangles
    wing(side, x, y, z, span, c, up = 0.35) {
      const s = side;
      const P = [0, 0, 0.1, s * span, up + 0.25, -0.05, s * span * 0.9, up - 0.1, -0.25, 0, 0, 0.1, s * span * 0.9, up - 0.1, -0.25, s * span * 0.45, -0.05, -0.3];
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      const g2 = g.clone(); const p2 = g2.attributes.position.array;
      for (let i = 0; i < p2.length; i += 9) { const t = [p2[i + 3], p2[i + 4], p2[i + 5]]; p2.set([p2[i + 6], p2[i + 7], p2[i + 8]], i + 3); p2.set(t, i + 6); }
      g.translate(x, y, z); g2.translate(x, y, z);
      add(g, c, false); add(g2, c, false);
    },
  };
  return k;
}
export const done = (k) => ({ body: mergeParts(k.B), glow: k.G.length ? mergeParts(k.G) : null });

// ---------------------------------------------------------------- creatures
const SKIN = 0xe8b890, DARK = 0x2a2a30, STEEL = 0xc8ccd4, WOOD = 0x7a5a3a, GOLD = 0xe8c050, BONE = 0xe8e0c8;
function biped(k, { body, legs = DARK, skin = SKIN, h = 1, wide = 1, head = true, helmet = null, bulk = 1 }) {
  const s = h;
  k.limb([-0.09 * wide, 0, 0], [-0.08 * wide, 0.42 * s, 0], 0.06 * bulk, legs);
  k.limb([0.09 * wide, 0, 0], [0.08 * wide, 0.42 * s, 0], 0.06 * bulk, legs);
  k.egg(0.17 * wide * bulk, 0.24 * s, 0.13 * bulk, 0, 0.6 * s, 0, body);
  k.limb([-0.17 * wide * bulk, 0.78 * s, 0], [-0.22 * wide * bulk, 0.5 * s, 0.08], 0.045 * bulk, body);
  k.limb([0.17 * wide * bulk, 0.78 * s, 0], [0.22 * wide * bulk, 0.5 * s, 0.1], 0.045 * bulk, body);
  if (head) k.ball(0.11 * bulk, 0, 0.92 * s, 0, skin, false, 1);
  if (helmet) k.cone(0.12 * bulk, 0.14, 0, 0.95 * s, 0, helmet, 8);
}
function quad(k, { body, legs, len = 0.7, high = 0.45, girth = 0.18, headCol = null, neck = 0.25 }) {
  for (const [x, z] of [[-0.12, len * 0.35], [0.12, len * 0.35], [-0.12, -len * 0.35], [0.12, -len * 0.35]]) k.limb([x, 0, z], [x * 0.9, high, z], 0.045, legs);
  k.egg(girth, girth * 0.95, len * 0.55, 0, high + girth * 0.5, 0, body);
  k.limb([0, high + girth * 0.8, len * 0.45], [0, high + girth + neck, len * 0.62], 0.07, body);
  k.egg(0.09, 0.08, 0.15, 0, high + girth + neck + 0.02, len * 0.7, headCol ?? body);
}
export function unitModel(id, col) {
  const k = kit(id.length * 7 + 3);
  switch (id) {
    case 'pikeman': biped(k, { body: col, helmet: STEEL }); k.limb([0.22, 0.1, 0.1], [0.22, 1.5, 0.15], 0.018, WOOD); k.cone(0.04, 0.14, 0.22, 1.48, 0.15, STEEL, 5); k.box(0.22, 0.28, 0.04, -0.26, 0.45, 0.12, STEEL); break;
    case 'archer': biped(k, { body: col, helmet: 0x3a6a3a }); k.add(new THREE.TorusGeometry(0.28, 0.015, 4, 16, Math.PI).rotateZ(Math.PI / 2).translate(-0.25, 0.65, 0.12), WOOD); k.box(0.07, 0.3, 0.07, 0.1, 0.55, -0.15, 0x6a4a2a); break;
    case 'griffin': quad(k, { body: 0xd8b04a, legs: 0xa8803a, headCol: 0xf2f0e8, len: 0.8, high: 0.35, neck: 0.2 }); k.cone(0.04, 0.12, 0, 0.86, 0.72, GOLD, 5, false, Math.PI / 2); k.wing(-1, -0.12, 0.62, 0, 0.9, 0xf0e2b0); k.wing(1, 0.12, 0.62, 0, 0.9, 0xf0e2b0); break;
    case 'swordsman': biped(k, { body: col, helmet: STEEL, bulk: 1.1 }); k.box(0.04, 0.6, 0.02, 0.26, 0.5, 0.18, STEEL); k.box(0.16, 0.03, 0.04, 0.26, 0.5, 0.18, GOLD); k.box(0.3, 0.38, 0.05, -0.28, 0.38, 0.12, 0x3a5ac8); k.box(0.08, 0.08, 0.06, -0.28, 0.55, 0.15, GOLD); break;
    case 'monk': biped(k, { body: 0xc89a5a, legs: 0xb08a4a }); k.cone(0.2, 0.45, 0, 0, 0, 0xc89a5a, 8); k.limb([0.24, 0.1, 0.1], [0.24, 1.25, 0.12], 0.02, WOOD); k.ball(0.06, 0.24, 1.28, 0.12, 0xffe27a, true); break;
    case 'cavalier': quad(k, { body: 0xf2f0ea, legs: 0xd8d4cc, len: 0.85, high: 0.45, neck: 0.22 }); k.box(0.32, 0.12, 0.55, 0, 0.62, 0, col); biped(k, { body: col, helmet: STEEL, h: 0.75 }); k.limb([0.2, 0.55, -0.2], [0.2, 0.9, 1.0], 0.025, WOOD); break;
    case 'angel': biped(k, { body: 0xf8f4ea, legs: 0xe8e0d0, h: 1.1 }); k.cone(0.22, 0.5, 0, 0, 0, 0xf8f4ea, 8); k.wing(-1, -0.08, 0.85, -0.08, 0.8, 0xffffff, 0.5); k.wing(1, 0.08, 0.85, -0.08, 0.8, 0xffffff, 0.5); k.ring(0.1, 0.015, 0, 1.18, 0, 0xffe27a); k.box(0.04, 0.7, 0.02, 0.26, 0.5, 0.18, 0xffe27a, true); break;
    case 'skeleton': biped(k, { body: BONE, legs: BONE, skin: BONE, bulk: 0.7 }); k.box(0.03, 0.45, 0.02, 0.2, 0.45, 0.15, 0x8a8a90); break;
    case 'zombie': biped(k, { body: 0x5a6a4a, legs: 0x4a4a3a, skin: 0x8aa07a, bulk: 1.1 }); k.limb([0.18, 0.75, 0], [0.2, 0.75, 0.35], 0.05, 0x8aa07a); k.limb([-0.18, 0.75, 0], [-0.2, 0.75, 0.35], 0.05, 0x8aa07a); break;
    case 'wight': k.cone(0.25, 0.9, 0, 0.05, 0, 0x9ab0c8, 7); k.ball(0.13, 0, 0.98, 0, 0xcfe0f0, false, 1); k.ball(0.03, -0.05, 1.0, 0.11, 0x6affff, true, 0); k.ball(0.03, 0.05, 1.0, 0.11, 0x6affff, true, 0); break;
    case 'vampire': biped(k, { body: 0x2a1a2a, skin: 0xd8d0d8 }); k.wing(-1, -0.1, 0.8, -0.1, 0.5, 0x8a2a3a, 0.2); k.wing(1, 0.1, 0.8, -0.1, 0.5, 0x8a2a3a, 0.2); k.box(0.3, 0.06, 0.02, 0, 0.98, -0.02, 0x8a2a3a); break;
    case 'lich': k.cone(0.24, 0.85, 0, 0, 0, 0x4a2a6a, 8); k.ball(0.11, 0, 0.95, 0, BONE, false, 1); k.cone(0.13, 0.25, 0, 0.98, -0.02, 0x4a2a6a, 8); k.limb([0.24, 0.1, 0.1], [0.24, 1.2, 0.12], 0.02, 0x3a3a3a); k.ball(0.07, 0.24, 1.25, 0.12, 0x9a6aff, true); break;
    case 'blackknight': quad(k, { body: 0x1a1a20, legs: 0x2a2a30, len: 0.85, high: 0.45 }); k.box(0.32, 0.12, 0.55, 0, 0.62, 0, 0x5a1a2a); biped(k, { body: 0x2a2a34, helmet: 0x1a1a20, h: 0.75 }); k.box(0.04, 0.6, 0.03, 0.22, 0.6, 0.25, 0x8a8a96); k.ball(0.03, -0.05, 1.15, 0.2, 0xff3a3a, true, 0); break;
    case 'bonedragon': quad(k, { body: BONE, legs: 0xc8c0a8, len: 1.2, high: 0.4, girth: 0.22, neck: 0.4 }); k.wing(-1, -0.15, 0.72, 0, 1.1, 0xb8b0a0, 0.4); k.wing(1, 0.15, 0.72, 0, 1.1, 0xb8b0a0, 0.4); k.limb([0, 0.6, -0.6], [0, 0.45, -1.1], 0.05, BONE); k.ball(0.03, 0.05, 1.09, 0.9, 0x6affaa, true, 0); break;
    case 'goblin': biped(k, { body: 0x8a6a3a, skin: 0x7ac04a, bulk: 0.75, h: 0.8 }); k.cone(0.03, 0.12, -0.1, 0.78, 0, 0x7ac04a, 4, false, -1.2); k.cone(0.03, 0.12, 0.1, 0.78, 0, 0x7ac04a, 4, false, -1.2); k.box(0.03, 0.3, 0.03, 0.18, 0.4, 0.12, WOOD); break;
    case 'wolf': quad(k, { body: 0x8a8a92, legs: 0x6a6a72, len: 0.7, high: 0.3, girth: 0.14, neck: 0.12 }); k.cone(0.03, 0.08, -0.05, 0.62, 0.42, 0x6a6a72, 4); k.cone(0.03, 0.08, 0.05, 0.62, 0.42, 0x6a6a72, 4); k.limb([0, 0.5, -0.35], [0, 0.4, -0.65], 0.04, 0x8a8a92); break;
    case 'orc': biped(k, { body: 0x6a4a2a, skin: 0x5a8a3a, bulk: 1.1 }); k.add(new THREE.TorusGeometry(0.25, 0.015, 4, 16, Math.PI).rotateZ(Math.PI / 2).translate(-0.27, 0.65, 0.12), WOOD); break;
    case 'ogre': biped(k, { body: 0x8a6a4a, skin: 0xb08a5a, bulk: 1.45, h: 1.2 }); k.limb([0.3, 0.6, 0.15], [0.3, 1.1, 0.3], 0.06, WOOD); k.ball(0.11, 0.3, 1.15, 0.32, WOOD, false, 0); break;
    case 'troll': biped(k, { body: 0x5a7a6a, skin: 0x6a8a7a, bulk: 1.3, h: 1.15 }); k.limb([0.28, 0.4, 0.1], [0.32, 0.05, 0.25], 0.07, 0x6a8a7a); break;
    case 'cyclops': biped(k, { body: 0x8a5a3a, skin: 0xa86a4a, bulk: 1.5, h: 1.35 }); k.ball(0.06, 0, 1.3, 0.14, 0xffffff, false, 1); k.ball(0.03, 0, 1.3, 0.19, DARK, false, 0); k.ball(0.12, -0.3, 0.75, 0.2, 0x8a8a8a, false, 0); break;
    case 'hydra': k.egg(0.35, 0.28, 0.45, 0, 0.3, 0, 0x3a8a6a); for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4, tip = [Math.sin(a) * 0.35, 0.95 + (i % 2) * 0.12, 0.35 + Math.cos(a) * 0.15]; k.limb([Math.sin(a) * 0.12, 0.45, 0.25], tip, 0.05, 0x4a9a7a); k.egg(0.08, 0.07, 0.12, tip[0], tip[1], tip[2] + 0.05, 0x3a8a6a); } break;
    default: biped(k, { body: col });
  }
  return done(k);
}

// ---------------------------------------------------------------- heroes and map objects (built ~1 unit wide, scaled down on the map)
export function heroModel(col) {
  const k = kit(5);
  quad(k, { body: 0x6a4a3a, legs: 0x4a3a2a, len: 0.8, high: 0.42, neck: 0.22, headCol: 0x5a3a2a });
  k.box(0.34, 0.1, 0.5, 0, 0.6, 0, col);
  biped(k, { body: col, helmet: GOLD, h: 0.75 });
  k.limb([-0.15, 0.7, -0.1], [-0.15, 1.6, -0.15], 0.015, WOOD);
  k.box(0.02, 0.28, 0.32, -0.15, 1.28, -0.32, col);
  return done(k);
}
export function flagModel() {
  const k = kit(9);
  k.limb([0, 0, 0], [0, 1, 0], 0.03, 0x5a4a3a);
  k.box(0.02, 0.3, 0.45, 0, 0.66, 0.22, 0xffffff);
  return done(k);
}
export function townModel(fac) {
  const k = kit(fac === 'haven' ? 11 : 13);
  const wall = fac === 'haven' ? 0xd8d0c0 : 0x4a4450, roof = fac === 'haven' ? 0x3a6ad8 : 0x6a2a3a, acc = fac === 'haven' ? GOLD : 0x8aff9a;
  // a ring of walls with towers
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, x = Math.cos(a) * 0.55, z = Math.sin(a) * 0.55;
    k.cyl(0.11, 0.12, 0.45, x, 0, z, wall, 8);
    if (fac === 'haven') k.cone(0.14, 0.22, x, 0.45, z, roof, 8); else k.cone(0.12, 0.3, x, 0.45, z, roof, 4);
    const b = a + Math.PI / 6;
    k.box(0.5, 0.3, 0.08, Math.cos(b) * 0.5, 0, Math.sin(b) * 0.5, wall, false, -b + Math.PI / 2);
  }
  // the keep
  k.box(0.42, 0.75, 0.42, 0, 0, 0, wall);
  k.cyl(0.13, 0.13, 1.15, 0.12, 0, 0.12, wall, 8);
  if (fac === 'haven') { k.roof(0.5, 0.25, 0.5, 0, 0.75, 0, roof); k.cone(0.17, 0.4, 0.12, 1.15, 0.12, roof, 8); k.ball(0.04, 0.12, 1.58, 0.12, acc, true, 0); }
  else { k.cone(0.3, 0.5, 0, 0.75, 0, roof, 4); k.cone(0.15, 0.55, 0.12, 1.15, 0.12, roof, 4); k.ball(0.06, 0.12, 1.75, 0.12, acc, true, 0); }
  // windows that glow at night
  for (let i = 0; i < 4; i++) k.box(0.05, 0.08, 0.01, -0.1 + (i % 2) * 0.2, 0.35 + Math.floor(i / 2) * 0.2, 0.215, 0xffd27a, true);
  return done(k);
}
export function objectModel(id) {
  const k = kit(id.length * 13 + 1);
  switch (id) {
    case 'gold': for (let i = 0; i < 7; i++) k.cyl(0.08, 0.08, 0.03, (i % 3 - 1) * 0.12, Math.floor(i / 3) * 0.03, ((i * 7) % 3 - 1) * 0.08, GOLD, 10); break;
    case 'wood': for (let i = 0; i < 5; i++) k.add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6).rotateZ(Math.PI / 2).translate(0, 0.05 + Math.floor(i / 3) * 0.09, (i % 3 - 1) * 0.1 + (i >= 3 ? 0.05 : 0)), 0x8a5a3a); break;
    case 'ore': for (let i = 0; i < 5; i++) k.ball(0.11 + (i % 2) * 0.04, (i % 3 - 1) * 0.15, 0.08, ((i * 5) % 3 - 1) * 0.12, 0x6a6a72, false, 0); break;
    case 'gems': for (let i = 0; i < 4; i++) k.add(new THREE.OctahedronGeometry(0.1, 0).scale(1, 1.8, 1).translate((i % 2 - 0.5) * 0.15, 0.15, (Math.floor(i / 2) - 0.5) * 0.15), [0xff4a8a, 0x4affd8, 0xb04aff, 0x4a9aff][i]); break;
    case 'chest': k.box(0.4, 0.22, 0.28, 0, 0, 0, 0x8a5a2a); k.box(0.42, 0.06, 0.3, 0, 0.22, 0, 0x6a4a2a); k.box(0.06, 0.08, 0.02, 0, 0.17, 0.15, GOLD); k.ball(0.06, 0, 0.32, 0, GOLD, true, 0); break;
    case 'artifact': k.cyl(0.18, 0.22, 0.12, 0, 0, 0, 0x8a8278, 8); k.add(new THREE.OctahedronGeometry(0.13, 0).translate(0, 0.38, 0), 0xffe27a); k.ring(0.2, 0.02, 0, 0.38, 0, 0xffe27a); break;
    case 'campfire': for (let i = 0; i < 4; i++) k.add(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 5).rotateZ(Math.PI / 2).rotateY(i * 0.8).translate(0, 0.03, 0), 0x5a3a2a); k.cone(0.12, 0.3, 0, 0.03, 0, 0xff8a2a, 6, true); break;
    case 'goldmine': case 'orepit': case 'gemmine': {
      k.cone(0.55, 0.6, 0, 0, 0, id === 'gemmine' ? 0x6a6a8a : 0x8a7a6a, 7);
      k.box(0.32, 0.3, 0.1, 0, 0, 0.42, 0x2a2228); k.box(0.38, 0.05, 0.12, 0, 0.3, 0.43, WOOD); k.box(0.05, 0.3, 0.1, -0.17, 0, 0.43, WOOD); k.box(0.05, 0.3, 0.1, 0.17, 0, 0.43, WOOD);
      const c = id === 'goldmine' ? GOLD : id === 'gemmine' ? 0xb04aff : 0x9a9aa2;
      for (let i = 0; i < 3; i++) k.ball(0.06, -0.2 + i * 0.2, 0.05, 0.6, c, id !== 'orepit', 0);
      break;
    }
    case 'sawmill': k.box(0.6, 0.3, 0.4, 0, 0, 0, 0x9a6a3a); k.roof(0.66, 0.2, 0.46, 0, 0.3, 0, 0x6a4a2a); k.add(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 12).rotateX(Math.PI / 2).translate(0.35, 0.25, 0), STEEL); for (let i = 0; i < 3; i++) k.add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6).rotateZ(Math.PI / 2).translate(-0.05, 0.05 + i * 0.05, -0.35), 0x8a5a3a); break;
    case 'arena': for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; k.box(0.12, 0.3, 0.06, Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45, 0xd8c8a8, false, -a); } k.cyl(0.35, 0.35, 0.02, 0, 0, 0, 0xc8a870, 12); k.box(0.04, 0.4, 0.04, 0, 0, 0, 0x8a2a2a); break;
    case 'tower': k.cyl(0.14, 0.2, 1.1, 0, 0, 0, 0x8a8ab8, 8); k.cone(0.2, 0.3, 0, 1.1, 0, 0x4a4a9a, 8); k.ball(0.07, 0, 1.45, 0, 0x9ad8ff, true, 0); break;
    case 'library': k.box(0.6, 0.4, 0.4, 0, 0, 0, 0xd8c8a8); k.roof(0.66, 0.22, 0.46, 0, 0.4, 0, 0x8a3a2a); for (let i = 0; i < 4; i++) k.cyl(0.03, 0.03, 0.4, -0.22 + i * 0.15, 0, 0.23, 0xf0e8d8, 6); break;
    case 'stone': case 'obelisk': k.box(0.22, id === 'obelisk' ? 1 : 0.6, 0.22, 0, 0, 0, 0x8a8a92); k.box(0.1, 0.1, 0.01, 0, id === 'obelisk' ? 0.6 : 0.35, 0.115, 0x6affff, true); break;
    case 'shrine': k.cyl(0.4, 0.42, 0.08, 0, 0, 0, 0xd8d0c0, 6); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; k.cyl(0.04, 0.04, 0.55, Math.cos(a) * 0.28, 0.08, Math.sin(a) * 0.28, 0xf0e8d8, 6); } k.cone(0.42, 0.25, 0, 0.63, 0, 0x9a4ad8, 4); k.ball(0.08, 0, 0.35, 0, 0xc89aff, true, 0); break;
    case 'well': k.cyl(0.25, 0.27, 0.22, 0, 0, 0, 0x9a948a, 10); k.cyl(0.2, 0.2, 0.02, 0, 0.21, 0, 0x5fc8ff, 10, true); k.limb([-0.22, 0.2, 0], [-0.22, 0.6, 0], 0.02, WOOD); k.limb([0.22, 0.2, 0], [0.22, 0.6, 0], 0.02, WOOD); k.roof(0.6, 0.18, 0.3, 0, 0.6, 0, 0x8a3a2a); break;
    case 'windmill': k.cyl(0.18, 0.25, 0.7, 0, 0, 0, 0xe8dcc0, 8); k.cone(0.22, 0.25, 0, 0.7, 0, 0x8a3a2a, 8); for (let i = 0; i < 4; i++) k.box(0.06, 0.5, 0.01, 0, 0.75, 0.26, 0xf0e8d8, false, 0, 0, i * Math.PI / 2); break;
    case 'stables': k.box(0.7, 0.3, 0.35, 0, 0, 0, 0x9a6a3a); k.roof(0.75, 0.18, 0.4, 0, 0.3, 0, 0x6a4a2a); k.box(0.5, 0.15, 0.02, 0, 0, 0.3, WOOD); break;
    case 'dwelling': k.cone(0.4, 0.55, 0, 0, 0, 0x8a6a3a, 7); k.box(0.16, 0.22, 0.02, 0, 0, 0.36, DARK); k.ball(0.05, 0, 0.6, 0, 0xffb84a, true, 0); break;
    default: k.box(0.3, 0.3, 0.3, 0, 0, 0, 0xff00ff);
  }
  return done(k);
}
export function treeModel(kind) {
  const k = kit(17 + kind);
  if (kind === 0) { k.cyl(0.05, 0.07, 0.3, 0, 0, 0, 0x6a4a2a, 5); k.cone(0.28, 0.5, 0, 0.22, 0, 0x2f7a3a, 7); k.cone(0.22, 0.4, 0, 0.5, 0, 0x3a8a42, 7); }
  else if (kind === 1) { k.cyl(0.05, 0.07, 0.35, 0, 0, 0, 0x6a4a2a, 5); k.ball(0.3, 0, 0.55, 0, 0x5aa83a, false, 1); }
  else if (kind === 2) { k.cyl(0.04, 0.06, 0.4, 0, 0, 0, 0x5a4a3a, 5); k.cone(0.25, 0.55, 0, 0.3, 0, 0xe8f0f4, 7); }
  else { k.cyl(0.04, 0.05, 0.5, 0, 0, 0, 0x4a3a2a, 5); k.ball(0.2, 0, 0.55, 0, 0x4a5a2a, false, 0); }
  return done(k);
}
export function rockModel(kind) {
  const k = kit(23 + kind);
  const c = [0x8a8278, 0x7a7068, 0x5a4a48, 0xb8b4b0][kind % 4];
  for (let i = 0; i < 3; i++) k.ball(0.25 - i * 0.05, (i - 1) * 0.2, 0.12, ((i * 3) % 3 - 1) * 0.12, c, false, 0, 1.2);
  return done(k);
}
export function peakModel(snowy) {
  const k = kit(29);
  k.cone(0.5, 0.95, 0, 0, 0, 0x7a6e64, 6);
  k.cone(0.32, 0.6, 0.28, 0, 0.18, 0x8a7e72, 5);
  k.cone(0.3, 0.5, -0.3, 0, -0.12, 0x6e645a, 5);
  if (snowy) k.cone(0.2, 0.32, 0, 0.66, 0, 0xf4f8fb, 6);
  return done(k);
}
// the battlefield: an obstacle rock and a dead tree
export function obstacleModel(kind) {
  const k = kit(31 + kind);
  if (kind === 0) for (let i = 0; i < 3; i++) k.ball(0.32 - i * 0.07, (i - 1) * 0.22, 0.2, ((i * 2) % 3 - 1) * 0.15, 0x7a7068, false, 0, 1.2);
  else { k.limb([0, 0, 0], [0.05, 0.9, 0], 0.07, 0x4a3a2a); k.limb([0.04, 0.6, 0], [0.35, 0.95, 0.1], 0.04, 0x4a3a2a); k.limb([0.03, 0.5, 0], [-0.3, 0.85, -0.05], 0.035, 0x4a3a2a); }
  return done(k);
}
