import * as THREE from 'three';

// =====================================================================
// HEX REALMS: Necropolis town-interior buildings (town view).
//   necroTownBuilding(id) -> { body, glow }
//   id: village, hall2, hall3, fort, market, tavern, mage1..mage3,
//       d1..d7, u1..u7   (unknown ids get a small crypt)
// Town-view units (1 unit ~ a small house), base at y = 0, front faces +Z.
// body: merged geometry with position, normal, color, uv (world-scaled).
// glow: emissive bits (green windows, fires, wisps, eyes).
// Palette: violet-grey stone, bone ivory, crimson banners, green glows,
// kept bright (no near-black surfaces).
// =====================================================================

export const NECRO_TOWN_IDS = ['village', 'hall2', 'hall3', 'fort', 'market', 'tavern', 'mage1', 'mage2', 'mage3',
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'];

const TAU = Math.PI * 2;
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const C = {
  stone: 0x948aaa, stoneL: 0xb2a6c2, stoneD: 0x7a6e92, trim: 0xccc0d8,
  roof: 0x62528a, roofL: 0x7a68a4,
  bone: 0xf4ead2, boneD: 0xcdbd9c,
  red: 0xd8283e, redD: 0xa41e32,
  green: 0x8dffa4, greenL: 0xd4ffb4, greenD: 0x46e07e, wisp: 0xb4fff0, violet: 0xc68cff,
  iron: 0x6c6484, wood: 0x8a6a52, woodD: 0x6c523f,
  ground: 0x8e8576, pave: 0x968ca0, dirt: 0x8a7258, moss: 0x86a862,
  door: 0x4a3c5e, horse: 0x55506e,
};

// ------------------------------------------------------------------ modelling kit with a transform stack
function makeKit(seed) {
  const r = rand(seed);
  const B = [], G = [];
  const M = new THREE.Matrix4(), stack = [];
  const tf = (g, o = {}) => {
    const sc = () => { if (o.s !== undefined) { const s = o.s; Array.isArray(s) ? g.scale(s[0], s[1], s[2]) : g.scale(s, s, s); } };
    if (!o.post) sc();
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    if (o.post) sc();
    return g;
  };
  const add = (g, c, o = {}) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('normal'); ng.deleteAttribute('uv');
    ng.applyMatrix4(M);
    (o.glow ? G : B).push({ g: ng, c, o });
    return ng;
  };
  const k = {
    r, B, G, add,
    // run fn with a local frame at (x, y, z), rotated ry about Y, uniformly scaled s
    at(x, y, z, ry, s, fn) {
      stack.push(M.clone());
      M.multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0), new THREE.Vector3(s || 1, s || 1, s || 1)));
      fn();
      M.copy(stack.pop());
    },
    box(w, h, d, x, y, z, c, o = {}) { return add(tf(new THREE.BoxGeometry(w, h, d), o).translate(x, y + h / 2, z), c, o); },
    cyl(rt, rb, h, x, y, z, c, seg = 8, o = {}) { return add(tf(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), o).translate(x, y + h / 2, z), c, o); },
    cone(rad, h, x, y, z, c, seg = 8, o = {}) { return add(tf(new THREE.ConeGeometry(rad, h, seg).translate(0, h / 2, 0), o).translate(x, y, z), c, o); },
    ball(rad, x, y, z, c, det = 1, o = {}) { return add(tf(new THREE.IcosahedronGeometry(rad, det), o).translate(x, y, z), c, o); },
    lathe(pts, x, y, z, c, seg = 8, o = {}) {
      const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(Math.max(a, 0.0001), b)), seg, o.phi || 0);
      return add(tf(g, o).translate(x, y, z), c, o);
    },
    limb(a, b, r1, r2, c, seg = 6, o = {}) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, false);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      return add(g, c, o);
    },
    tor(rad, tube, x, y, z, c, arc = TAU, o = {}) { return add(tf(new THREE.TorusGeometry(rad, tube, o.ts || 4, o.rs || 10, arc), o).translate(x, y, z), c, o); },
    // a flat polygon in the local XY plane facing +Z (single sided), pts [[x, y], ...]
    poly(pts, x, y, z, c, o = {}) {
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))));
      return add(tf(g, o).translate(x, y, z), c, { ao: false, ...o });
    },
    // gable roof: ridge along local x; slopes roofC, gable ends wallC
    gable(w, h, d, x, y, z, roofC, wallC, ry = 0, ov = 0.06) {
      const W = w / 2, D = d / 2 + ov, Wo = W + ov;
      const sl = [-Wo, 0, D, Wo, 0, D, Wo, h, 0, -Wo, 0, D, Wo, h, 0, -Wo, h, 0,
        Wo, 0, -D, -Wo, 0, -D, -Wo, h, 0, Wo, 0, -D, -Wo, h, 0, Wo, h, 0];
      const ge = [W, 0, d / 2, W, 0, -d / 2, W, h * (d / 2) / D, 0, -W, 0, -d / 2, -W, 0, d / 2, -W, h * (d / 2) / D, 0];
      const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(ge, 3));
      // underside so the eaves are not see-through
      const us = [-Wo, 0, D, Wo, h, 0, Wo, 0, D, -Wo, 0, D, -Wo, h, 0, Wo, h, 0, Wo, 0, -D, -Wo, h, 0, -Wo, 0, -D, Wo, 0, -D, Wo, h, 0, -Wo, h, 0];
      const g3 = new THREE.BufferGeometry(); g3.setAttribute('position', new THREE.Float32BufferAttribute(us, 3));
      add(g1.rotateY(ry).translate(x, y, z), roofC, { top: 1.25, bot: 0.85 });
      add(g2.rotateY(ry).translate(x, y, z), wallC, {});
      add(g3.rotateY(ry).translate(x, y - 0.005, z), roofC, { top: 0.8, bot: 0.8 });
    },
    // double-sided grid sheet: f(u, v) -> [x, y, z]
    sheet(nu, nv, f, c, o = {}) {
      const P = [], S = [];
      const pt = (i, j) => f(i / nu, j / nv), sh = (i, j) => (o.shade ? o.shade(i / nu, j / nv) : 1);
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        for (const t of [[0, 1, 2], [0, 2, 3]]) {
          const A = t.map((n) => new THREE.Vector3(...pt(...q[n])));
          for (let m = 0; m < 3; m++) { P.push(A[m].x, A[m].y, A[m].z); S.push(sh(...q[t[m]])); }
          if (o.double !== false) {
            const nn = new THREE.Vector3().subVectors(A[1], A[0]).cross(new THREE.Vector3().subVectors(A[2], A[0])).normalize().multiplyScalar(-(o.thick ?? 0.01));
            for (const m of [0, 2, 1]) { P.push(A[m].x + nn.x, A[m].y + nn.y, A[m].z + nn.z); S.push(sh(...q[t[m]]) * 0.85); }
          }
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      return add(g, c, { ...o, cols: S });
    },
  };
  return k;
}

const tmpC = new THREE.Color();
function bake(parts, r, glow) {
  let n = 0;
  for (const p of parts) n += p.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uvs = glow ? null : new Float32Array(n * 2);
  let o = 0;
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const p of parts) {
    const P = p.g.attributes.position.array, cnt = P.length / 3;
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 1; i < P.length; i += 3) { ymin = Math.min(ymin, P[i]); ymax = Math.max(ymax, P[i]); }
    const span = Math.max(1e-4, ymax - ymin);
    const top = p.o.top ?? 1.06, bot = p.o.bot ?? 0.92, jit = p.o.j ?? (glow ? 0.0 : 0.05);
    const base = new THREE.Color(p.c);
    for (let t = 0; t < cnt; t += 3) {
      a.fromArray(P, t * 3); b.fromArray(P, t * 3 + 3); c.fromArray(P, t * 3 + 6);
      fn.crossVectors(e1.subVectors(c, b), e2.subVectors(a, b)).normalize();
      const jf = 1 + (r() - 0.5) * 2 * jit;
      for (let v = 0; v < 3; v++) {
        const vi = t + v, x = P[vi * 3], y = P[vi * 3 + 1], z = P[vi * 3 + 2];
        pos.set([x, y, z], o * 3); nor.set([fn.x, fn.y, fn.z], o * 3);
        let m = jf * (bot + (top - bot) * ((y - ymin) / span));
        if (p.o.cols) m *= p.o.cols[vi];
        // soft, light ground occlusion (never black)
        if (!glow && p.o.ao !== false) m *= 0.8 + 0.2 * smooth(-0.02, 0.45, y);
        tmpC.copy(base).multiplyScalar(m);
        // gentle warm-violet tint in the shade (coloured shadows)
        if (!glow && fn.y < -0.3) tmpC.lerp(new THREE.Color(0x8a78a8), 0.2);
        col.set([tmpC.r, tmpC.g, tmpC.b], o * 3);
        if (uvs) {
          const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
          if (ay >= ax && ay >= az) uvs.set([x, z], o * 2); else if (ax >= az) uvs.set([z, y], o * 2); else uvs.set([x, y], o * 2);
        }
        o++;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uvs) g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
const finish = (k) => ({ body: bake(k.B, k.r, false), glow: k.G.length ? bake(k.G, k.r, true) : null });

// ------------------------------------------------------------------ shared details
// pointed lancet outline (local XY), width w, straight height h
const lancetPts = (w, h, p = 0.75) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [w * 0.28, h + w * p * 0.7], [0, h + w * p], [-w * 0.28, h + w * p * 0.7], [-w / 2, h]];
// glowing lancet window with a bone frame, on a wall facing +Z at local z
function lancet(k, x, y, z, w, h, o = {}) {
  const fr = o.frame ?? 0.035;
  k.poly(lancetPts(w + fr * 2, h + fr, 0.8), x, y - fr, z + 0.004, o.frameC ?? C.trim);
  k.poly(lancetPts(w, h, 0.8), x, y, z + 0.012, o.c ?? C.green, { glow: true });
  if (o.bars !== false && w > 0.1) k.box(0.018, h * 0.95, 0.02, x, y, z + 0.016, C.iron, { ao: false });
}
// a door: frame, dark-violet leaves, green glow seam
function door(k, x, y, z, w, h, o = {}) {
  k.poly(lancetPts(w + 0.1, h + 0.05, 0.85), x, y, z + 0.004, o.frameC ?? C.bone);
  k.poly(lancetPts(w, h, 0.8), x, y, z + 0.012, o.c ?? C.door);
  k.box(0.02, h * 0.9, 0.02, x, y, z + 0.02, C.greenD, { glow: true });
  if (o.glowIn) k.poly(lancetPts(w * 0.7, h * 0.6, 0.6), x, y + h * 0.1, z + 0.016, C.greenD, { glow: true });
}
// round rose window facing +Z
function rose(k, x, y, z, rad) {
  k.cyl(rad, rad, 0.02, x, y, z + 0.01, C.green, 10, { rx: Math.PI / 2, glow: true });
  k.tor(rad, rad * 0.14, x, y, z + 0.02, C.bone, TAU, { rs: 12 });
  for (let i = 0; i < 4; i++) k.box(rad * 1.9, rad * 0.1, 0.012, x, y - rad * 0.05, z + 0.025, C.boneD, { rz: i * Math.PI / 4, ao: false });
}
// a skull ornament facing +Z, size s ~ head radius
function skull(k, x, y, z, s, o = {}) {
  k.ball(s, x, y, z, C.bone, 1, { s: [1, 0.92, 0.9], top: 1.1, bot: 0.85, ao: false });
  k.box(s * 1.1, s * 0.55, s * 0.8, x, y - s * 1.05, z + s * 0.1, C.boneD, { ao: false });
  for (const sx of [-1, 1]) k.ball(s * 0.26, x + sx * s * 0.38, y - s * 0.05, z + s * 0.78, o.eye ?? C.green, 0, { glow: true });
  if (o.horns) for (const sx of [-1, 1]) k.cone(s * 0.28, s * 1.4, x + sx * s * 0.85, y + s * 0.2, z - s * 0.1, C.boneD, 5, { rz: -sx * 0.9, top: 1.2 });
}
// crimson hanging banner (facing +Z), rod at top
function banner(k, x, ytop, z, w, h, o = {}) {
  k.sheet(2, 4, (u, v) => {
    const xx = x + (u - 0.5) * w, tail = v === 1 && Math.abs(u - 0.5) < 0.01 ? h * 0.18 : 0;
    return [xx, ytop - v * h + tail, z + Math.sin(v * 3.2 + x) * 0.03 * v];
  }, o.c ?? C.red, { top: 1.18, bot: 0.82, ao: false, j: 0.02 });
  k.limb([x - w * 0.62, ytop + 0.01, z + 0.01], [x + w * 0.62, ytop + 0.01, z + 0.01], 0.018, 0.018, C.bone, 5, { ao: false });
  // bone emblem: a small skull mark
  if (o.emblem !== false) {
    k.ball(w * 0.15, x, ytop - h * 0.36, z + 0.03, C.bone, 0, { s: [1, 1, 0.4], ao: false });
    k.box(w * 0.12, h * 0.25, 0.01, x, ytop - h * 0.72, z + 0.028, C.bone, { ao: false });
  }
}
// waving pennant from a pole top, flying in +X (dir=1) or -X
function pennant(k, x0, y0, z0, len, hgt, c, dir = 1) {
  k.sheet(6, 2, (u, v) => {
    const taper = 1 - u * 0.5, yy = (v - 0.5) * hgt * taper;
    let along = u * len - Math.max(0, 1 - Math.abs(v - 0.5) * 4) * 0.3 * len * smooth(0.5, 1, u);
    return [x0 + dir * along, y0 + yy - u * u * hgt * 0.25, z0 + Math.sin(u * 9) * 0.05 * u];
  }, c, { shade: (u) => 0.92 + 0.18 * Math.cos(u * 9), ao: false, j: 0.02 });
}
// a needle spire tower: hexagonal shaft, cornice, crown spikes, roof, green finial
function spire(k, x, y, z, rad, h, roofH, o = {}) {
  const seg = o.seg ?? 6;
  k.lathe([[rad * 1.25, 0], [rad * 1.12, 0.12], [rad, 0.22], [rad * 0.9, h], [rad * 1.25, h + 0.04], [rad * 1.25, h + 0.12], [rad * 0.8, h + 0.12]], x, y, z, o.c ?? C.stone, seg, { top: 1.12, bot: 0.86 });
  // bone band
  k.cyl(rad * 0.98, rad * 1.02, 0.05, x, y + h * 0.45, z, C.boneD, seg);
  const top = y + h + 0.12;
  if (o.spikes !== false) for (let s = 0; s < seg; s++) {
    const b = s / seg * TAU + Math.PI / seg;
    k.cone(rad * 0.18, rad * 0.8, x + Math.sin(b) * rad * 1.15, top - 0.02, z + Math.cos(b) * rad * 1.15, C.bone, 4, { rz: -Math.sin(b) * 0.35, rx: Math.cos(b) * 0.35, top: 1.15 });
  }
  k.cone(rad * 1.08, roofH, x, top, z, o.roof ?? C.roof, seg, { top: 1.5, bot: 0.9 });
  if (o.finial !== false) {
    k.ball(rad * 0.22, x, top + roofH + rad * 0.12, z, o.orb ?? C.green, 1, { glow: true });
    k.limb([x, top + roofH - 0.05, z], [x, top + roofH + rad * 0.55, z], 0.012, 0.006, C.bone, 4);
  }
  // windows: front, and the two front diagonals
  const wins = o.wins ?? [[0, 0.62], [0.9, 0.35], [-0.9, 0.35]];
  for (const [a, f] of wins) {
    const wy = y + h * f, rr = rad * (1 - 0.1 * f) * 0.98;
    k.at(x + Math.sin(a) * rr, wy, z + Math.cos(a) * rr, a, 1, () => { k.poly(lancetPts(rad * 0.38, rad * 0.75, 0.8), 0, 0, 0.01, C.green, { glow: true }); });
  }
  if (o.pennant) { const py = top + roofH, pl = Math.min(0.45, rad * 1.8); k.limb([x, py, z], [x, py + pl, z], 0.012, 0.01, C.bone, 4); pennant(k, x, py + pl * 0.8, z, pl, pl * 0.36, C.red, o.pennant); }
  return top + roofH;
}
// a green-flame brazier on a bone stand
function brazier(k, x, y, z, s = 1) {
  k.lathe([[0.07 * s, 0], [0.04 * s, 0.05 * s], [0.035 * s, 0.32 * s], [0.12 * s, 0.4 * s], [0.13 * s, 0.46 * s], [0.1 * s, 0.46 * s]], x, y, z, C.boneD, 6, { top: 1.15 });
  k.cone(0.1 * s, 0.24 * s, x, y + 0.42 * s, z, C.greenD, 5, { glow: true });
  k.cone(0.06 * s, 0.32 * s, x + 0.02 * s, y + 0.42 * s, z + 0.01 * s, C.greenL, 4, { glow: true });
}
// a lantern on a hook post
function lantern(k, x, y, z, h = 0.9) {
  k.limb([x, y, z], [x, y + h, z], 0.022, 0.018, C.iron, 5);
  k.limb([x, y + h, z], [x, y + h, z + 0.18], 0.012, 0.012, C.iron, 4);
  k.box(0.07, 0.1, 0.07, x, y + h - 0.15, z + 0.18, C.greenL, { glow: true });
  k.cone(0.06, 0.06, x, y + h - 0.05, z + 0.18, C.iron, 4, { ry: Math.PI / 4 });
}
function tomb(k, x, z, ry, s = 1, c = C.stoneL) {
  k.at(x, 0, z, ry, s, () => {
    const lean = (k.r() - 0.5) * 0.25;
    k.box(0.2, 0.22, 0.06, 0, 0, 0, c, { rz: lean, top: 1.2, bot: 0.85 });
    k.cyl(0.1, 0.1, 0.06, 0, 0.19, -0.03, c, 7, { rx: Math.PI / 2, rz: lean, top: 1.2 });
    k.box(0.24, 0.03, 0.12, 0, 0, 0.02, C.stone);
  });
}
function cross(k, x, z, ry, s = 1) {
  k.at(x, 0, z, ry, s, () => {
    k.box(0.05, 0.34, 0.05, 0, 0, 0, C.boneD, { rz: (k.r() - 0.5) * 0.2 });
    k.box(0.2, 0.05, 0.05, 0, 0.22, 0, C.boneD);
  });
}
function grave(k, x, z, ry, open = false) {
  k.at(x, 0, z, ry, 1, () => {
    k.box(0.24, 0.05, 0.42, 0, 0, 0.1, open ? C.dirt : C.moss, { top: 1.15, j: 0.12 });
    if (open) k.box(0.18, 0.02, 0.32, 0, 0.04, 0.1, C.greenD, { glow: true });
  });
  tomb(k, x - Math.sin(ry) * 0.12, z - Math.cos(ry) * 0.12, ry, 0.8);
}
function deadTree(k, x, z, s = 1) {
  const W = C.woodD;
  k.at(x, 0, z, k.r() * TAU, s, () => {
    k.limb([0, 0, 0], [0.04, 0.7, 0], 0.07, 0.04, W, 5);
    k.limb([0.03, 0.45, 0], [-0.25, 0.8, 0.05], 0.03, 0.012, W, 4);
    k.limb([0.04, 0.6, 0], [0.28, 0.95, -0.04], 0.03, 0.012, W, 4);
    k.limb([0.04, 0.7, 0], [0.02, 1.05, 0.12], 0.025, 0.01, W, 4);
  });
}
// a spear-topped iron fence from (ax, az) to (bx, bz)
function fence(k, ax, az, bx, bz, h = 0.4, step = 0.16) {
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    k.box(0.025, h, 0.025, x, 0, z, C.iron, { ao: false });
    k.cone(0.026, 0.07, x, h, z, i % 3 === 0 ? C.bone : C.iron, 4);
  }
  for (const yy of [h * 0.25, h * 0.8]) k.limb([ax, yy, az], [bx, yy, bz], 0.012, 0.012, C.iron, 4);
}
// flagstone base slab
function plinth(k, w, d, h = 0.08, c = C.pave) {
  k.box(w, h, d, 0, 0, 0, c, { top: 1.0, bot: 0.85, ao: false, j: 0.03 });
  k.box(w - 0.1, 0.02, d - 0.1, 0, h, 0, c, { j: 0.1, top: 1.05, ao: false });
}
// buttresses along a wall face (local), points [x...], at z, height h
function buttresses(k, xs, z, h, dz = 0.12) {
  for (const x of xs) {
    k.box(0.12, h, dz, x, 0, z + dz / 2, C.stoneD, { top: 1.12 });
    k.cone(0.085, 0.18, x, h, z + dz / 2, C.stone, 4, { ry: Math.PI / 4, s: [1, 1, dz / 0.12], post: true });
  }
}
// spikes along a wall top from x0 to x1 at local z, top y
function spikeRow(k, x0, x1, y, z, step = 0.2, c = C.bone, hh = 0.16) {
  const n = Math.max(1, Math.round((x1 - x0) / step));
  for (let i = 0; i <= n; i++) k.cone(0.035, hh * (0.8 + k.r() * 0.4), x0 + (x1 - x0) * i / n, y, z, c, 4, { top: 1.2 });
}
// floating ghost wisps
function wisps(k, pts, c = C.wisp) {
  for (const [x, y, z, s] of pts) {
    k.ball(0.06 * (s || 1), x, y, z, c, 0, { glow: true });
    k.cone(0.04 * (s || 1), 0.16 * (s || 1), x, y - 0.03, z - 0.02, c, 4, { glow: true, rx: Math.PI - 0.5 });
  }
}
// a nave/chapel block: walls w x d x h, steep roof, gable end facing +Z
function chapel(k, w, d, h, roofH, o = {}) {
  k.box(w, h, d, 0, 0, 0, o.c ?? C.stone, { top: 1.12, bot: 0.88 });
  k.box(w + 0.06, 0.06, d + 0.06, 0, h - 0.03, 0, C.trim);
  k.gable(d, roofH, w, 0, h + 0.03, 0, o.roof ?? C.roof, o.c ?? C.stone, Math.PI / 2, 0.07);
  // ridge spikes
  if (o.ridge !== false) for (let i = 0; i <= 3; i++) k.cone(0.03, 0.12, 0, h + 0.03 + roofH - 0.01, -d / 2 + d * i / 3, C.bone, 4);
}

// ------------------------------------------------------------------ halls
function village() {
  const k = makeKit(101);
  plinth(k, 2.3, 2.3, 0.06, C.ground);
  const Y = 0.08;
  // central chapel of the dead
  k.at(0, Y, -0.15, 0, 1, () => {
    chapel(k, 1.1, 1.4, 0.95, 0.75);
    door(k, 0, 0, 0.7, 0.32, 0.38, { glowIn: true });
    rose(k, 0, 1.18, 0.7, 0.16);
    for (const x of [-0.36, 0.36]) lancet(k, x, 0.32, 0.7, 0.14, 0.34);
    for (const z of [-0.35, 0.25]) for (const s of [-1, 1]) k.at(s * 0.55, 0.3, z, s * Math.PI / 2, 1, () => lancet(k, 0, 0, 0, 0.12, 0.3));
    buttresses(k, [-0.55, 0.55], 0.7, 0.7);
  });
  // a small bell tower at the side
  spire(k, 0.72, Y, -0.55, 0.22, 1.35, 0.85, { pennant: 1 });
  // little crypts
  k.at(-0.78, Y, 0.45, 0.35, 1, () => {
    k.box(0.5, 0.42, 0.5, 0, 0, 0, C.stone, { top: 1.12 });
    k.cone(0.42, 0.42, 0, 0.42, 0, C.roof, 4, { ry: Math.PI / 4, top: 1.4 });
    door(k, 0, 0, 0.25, 0.16, 0.18, { glowIn: true });
    k.ball(0.04, 0, 0.88, 0, C.green, 0, { glow: true });
  });
  for (const [x, z, ry] of [[0.55, 0.75, -0.2], [0.85, 0.5, -0.4], [-0.35, 0.9, 0.15], [0.2, 0.95, 0]]) tomb(k, x, z, ry, 1);
  lantern(k, -0.28, Y, 0.65, 0.8); lantern(k, 0.28, Y, 0.65, 0.8);
  deadTree(k, -0.85, -0.6, 1.1);
  return finish(k);
}

function hall2() {
  const k = makeKit(102);
  plinth(k, 2.4, 2.4, 0.08);
  const Y = 0.1;
  // steps
  k.box(0.8, 0.06, 0.25, 0, Y, 0.95, C.trim);
  // nave
  k.at(0, Y, -0.25, 0, 1, () => {
    chapel(k, 1.2, 1.5, 1.25, 0.95);
    rose(k, 0, 1.55, 0.75, 0.2);
    buttresses(k, [-0.6, 0.6], 0.75, 1.0);
    for (const z of [-0.45, 0.2]) for (const s of [-1, 1]) k.at(s * 0.6, 0.4, z, s * Math.PI / 2, 1, () => lancet(k, 0, 0, 0, 0.14, 0.42));
  });
  // front porch tower (gate tower) with the entrance
  k.at(0, Y, 0.6, 0, 1, () => {
    k.box(0.7, 1.05, 0.35, 0, 0, 0, C.stone, { top: 1.12, bot: 0.88 });
    k.box(0.76, 0.06, 0.4, 0, 1.02, 0, C.trim);
    spikeRow(k, -0.32, 0.32, 1.08, 0.15, 0.16);
    door(k, 0, 0, 0.18, 0.34, 0.46, { glowIn: true });
    skull(k, 0, 0.82, 0.2, 0.09);
    for (const s of [-1, 1]) banner(k, s * 0.5, 1.0, 0.2, 0.22, 0.6);
  });
  // twin side spires
  for (const s of [-1, 1]) spire(k, s * 0.82, Y, 0.35, 0.26, 1.55 + (s > 0 ? 0.2 : 0), 1.0, { pennant: s });
  // side wing on the left with a low roof
  k.at(-0.85, Y, -0.55, 0, 1, () => {
    k.box(0.55, 0.7, 0.8, 0, 0, 0, C.stoneD, { top: 1.15 });
    k.gable(0.8, 0.35, 0.55, 0, 0.7, 0, C.roof, C.stoneD, Math.PI / 2);
    lancet(k, 0, 0.25, 0.4, 0.13, 0.25);
  });
  for (const x of [-0.55, 0.55]) brazier(k, x, Y, 1.0, 1.1);
  for (const [x, z, ry] of [[0.95, 0.95, -0.3], [-0.98, 0.85, 0.3]]) tomb(k, x, z, ry, 1);
  return finish(k);
}

function hall3() {
  const k = makeKit(103);
  plinth(k, 2.4, 2.4, 0.1);
  const Y = 0.12;
  k.box(1.0, 0.06, 0.3, 0, Y, 1.0, C.trim);
  k.box(0.8, 0.06, 0.2, 0, Y + 0.06, 0.95, C.trim);
  // nave
  k.at(0, Y, -0.3, 0, 1, () => {
    chapel(k, 1.15, 1.5, 1.35, 0.9);
    for (const z of [-0.45, 0.2]) for (const s of [-1, 1]) k.at(s * 0.58, 0.45, z, s * Math.PI / 2, 1, () => lancet(k, 0, 0, 0, 0.14, 0.45));
    buttresses(k, [-0.58, 0.58], 0.75, 1.05);
  });
  // facade between two front spires
  k.at(0, Y, 0.55, 0, 1, () => {
    k.box(0.9, 1.6, 0.3, 0, 0, 0, C.stone, { top: 1.12, bot: 0.88 });
    k.box(0.96, 0.06, 0.34, 0, 1.58, 0, C.trim);
    k.gable(0.34, 0.5, 0.96, 0, 1.64, 0, C.roof, C.stone, Math.PI / 2, 0.04);
    door(k, 0, 0, 0.16, 0.36, 0.52, { glowIn: true });
    rose(k, 0, 1.12, 0.15, 0.22);
    skull(k, 0, 1.9, 0.1, 0.08, { horns: true });
  });
  // front spires
  for (const s of [-1, 1]) {
    spire(k, s * 0.66, Y, 0.55, 0.28, 1.75, 1.0, { pennant: s });
    banner(k, s * 0.66, 1.65, 0.86, 0.26, 0.8);
  }
  // the great central spire over the crossing
  const cz = -0.45;
  k.lathe([[0.36, 0], [0.32, 1.0], [0.4, 1.06], [0.4, 1.16], [0.24, 1.16]], 0, Y + 1.25, cz, C.stone, 8, { top: 1.15, bot: 0.85 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.at(Math.sin(a) * 0.34, Y + 1.7, cz + Math.cos(a) * 0.34, a, 1, () => k.poly(lancetPts(0.12, 0.32), 0, 0, 0.01, C.green, { glow: true })); }
  for (let s = 0; s < 8; s++) { const b = s / 8 * TAU; k.cone(0.04, 0.22, Math.sin(b) * 0.4, Y + 2.4, cz + Math.cos(b) * 0.4, C.bone, 4, { rz: -Math.sin(b) * 0.3, rx: Math.cos(b) * 0.3 }); }
  k.cone(0.34, 0.6, 0, Y + 2.41, cz, C.roof, 8, { top: 1.6, bot: 0.9 });
  k.ball(0.09, 0, Y + 3.1, cz, C.green, 1, { glow: true });
  k.tor(0.15, 0.015, 0, Y + 3.1, cz, C.greenD, TAU, { glow: true, rx: 0.4, rs: 14 });
  // flying bone buttresses from the spires to the tower
  for (const s of [-1, 1]) {
    const P = []; for (let i = 0; i <= 4; i++) { const t = i / 4; P.push([s * (0.6 - t * 0.28), Y + 1.65 + Math.sin(t * Math.PI) * 0.15 + t * 0.35, 0.45 - t * 0.75]); }
    for (let i = 0; i < 4; i++) k.limb(P[i], P[i + 1], 0.035, 0.03, C.bone, 5);
  }
  // side chapels with small spires at the rear corners
  for (const s of [-1, 1]) {
    spire(k, s * 0.88, Y, -0.85, 0.2, 1.2, 0.7, { wins: [[0, 0.6]] });
    k.at(s * 0.85, Y, -0.25, 0, 1, () => { k.box(0.35, 0.6, 0.7, 0, 0, 0, C.stoneD, { top: 1.15 }); k.gable(0.7, 0.3, 0.35, 0, 0.6, 0, C.roof, C.stoneD, Math.PI / 2); });
    brazier(k, s * 0.5, Y, 1.05, 1.2);
    k.at(s * 0.95, Y, 0.95, 0, 1, () => { k.box(0.16, 0.5, 0.16, 0, 0, 0, C.stoneL, { top: 1.15 }); k.cone(0.12, 0.25, 0, 0.5, 0, C.roof, 4, { ry: Math.PI / 4 }); skull(k, 0, 0.62, 0.0, 0.07); });
  }
  wisps(k, [[-0.95, 2.3, 0.3, 1], [0.95, 2.6, -0.1, 0.8], [0.35, 2.8, 0.4, 0.7]]);
  return finish(k);
}

// ------------------------------------------------------------------ fort: wall and gatehouse, 9 x 1.2
function fort() {
  const k = makeKit(104);
  const H = 1.45, T = 0.55;
  const seg = (x0, x1) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    k.box(w, H, T, cx, 0, 0, C.stone, { top: 1.12, bot: 0.86, j: 0.04 });
    k.box(w, 0.08, T + 0.1, cx, H - 0.04, 0, C.trim);
    // stone courses
    k.box(w, 0.05, T + 0.02, cx, H * 0.45, 0, C.stoneL, { ao: false });
    spikeRow(k, x0 + 0.1, x1 - 0.1, H + 0.04, 0.22, 0.24, C.bone, 0.24);
    spikeRow(k, x0 + 0.1, x1 - 0.1, H + 0.04, -0.22, 0.32, C.stoneD, 0.18);
    // arrow slits
    for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.55) k.poly(lancetPts(0.06, 0.2), x, H * 0.62, T / 2 + 0.006, C.green, { glow: true });
  };
  seg(-4.3, -2.9); seg(-2.5, -0.85); seg(0.85, 2.5); seg(2.9, 4.3);
  // round towers
  const tower = (x, h) => {
    k.lathe([[0.42, 0], [0.38, 0.25], [0.34, h], [0.44, h + 0.06], [0.44, h + 0.2], [0.3, h + 0.2]], x, 0, 0, C.stone, 8, { top: 1.12, bot: 0.86 });
    k.cyl(0.35, 0.37, 0.06, x, h * 0.45, 0, C.boneD, 8);
    for (let s = 0; s < 8; s++) { const b = s / 8 * TAU + Math.PI / 8; k.cone(0.05, 0.26, x + Math.sin(b) * 0.42, h + 0.18, Math.cos(b) * 0.42, C.bone, 4, { rz: -Math.sin(b) * 0.3, rx: Math.cos(b) * 0.3 }); }
    k.cone(0.3, 0.45, x, h + 0.2, 0, C.roof, 8, { top: 1.5 });
    k.ball(0.06, x, h + 0.7, 0, C.green, 0, { glow: true });
    k.at(x, h * 0.66, 0.35, 0, 1, () => k.poly(lancetPts(0.1, 0.22), 0, 0, 0.01, C.green, { glow: true }));
    return h + 0.65;
  };
  for (const x of [-4.4, 4.4]) tower(x, 1.75);
  for (const s of [-1, 1]) { const top = tower(s * 2.7, 1.85); banner(k, s * 2.7, 1.55, 0.43, 0.3, 0.85); k.limb([s * 2.7, top, 0], [s * 2.7, top + 0.0, 0], 0.01, 0.01, C.bone, 3); }
  // gatehouse
  const gw = 1.7, gh = 1.85, gd = 0.9;
  k.box(gw, gh, gd, 0, 0, 0.05, C.stone, { top: 1.12, bot: 0.86 });
  k.box(gw + 0.1, 0.08, gd + 0.1, 0, gh - 0.04, 0.05, C.trim);
  spikeRow(k, -gw / 2 + 0.1, gw / 2 - 0.1, gh + 0.04, 0.42, 0.2, C.bone, 0.22);
  k.gable(gd + 0.1, 0.5, gw + 0.1, 0, gh + 0.04, 0.05, C.roof, C.stone, Math.PI / 2, 0.04);
  for (const s of [-1, 1]) {
    k.lathe([[0.24, 0], [0.22, 2.0], [0.28, 2.05], [0.28, 2.15], [0.18, 2.15]], s * 0.85, 0, 0.42, C.stoneL, 6, { top: 1.12, bot: 0.86 });
    k.cone(0.22, 0.3, s * 0.85, 2.15, 0.42, C.roof, 6, { top: 1.5 });
    k.ball(0.05, s * 0.85, 2.48, 0.42, C.green, 0, { glow: true });
    brazier(k, s * 1.15, 0, 0.85, 1.1);
  }
  // the portal: dark-violet gate with green glow behind a ribcage of bone arches
  const gz = 0.5;
  k.poly(lancetPts(0.85, 0.75, 0.75), 0, 0, gz + 0.004, C.door);
  k.poly(lancetPts(0.65, 0.65, 0.7), 0, 0.02, gz + 0.012, C.greenD, { glow: true });
  for (let i = 0; i < 7; i++) k.box(0.03, 1.05, 0.02, -0.3 + i * 0.1, 0, gz + 0.02, C.iron, { ao: false });
  for (let i = 0; i < 3; i++) {
    const rr = 0.48 + i * 0.07, zz = gz + 0.06 + i * 0.1;
    k.tor(rr, 0.045 - i * 0.006, 0, 0.75 - i * 0.03, zz, i === 1 ? C.boneD : C.bone, Math.PI, { rs: 10, ts: 5, top: 1.1 });
    for (const s of [-1, 1]) k.cyl(0.04, 0.05, 0.75 - i * 0.03, s * rr, 0, zz, C.bone, 5);
  }
  skull(k, 0, 1.45, gz + 0.12, 0.17, { horns: true });
  // dead trees and graves along the wall foot
  for (const [x, z] of [[-3.6, 0.5], [3.4, 0.5], [-1.6, 0.45], [1.8, 0.48]]) tomb(k, x, z, (k.r() - 0.5) * 0.5, 1.1);
  return finish(k);
}

// ------------------------------------------------------------------ market and tavern
function market() {
  const k = makeKit(105);
  plinth(k, 2.0, 2.0, 0.06, C.ground);
  const Y = 0.06;
  // arcade hall: back wall, open front with three pointed arches on bone columns
  k.at(0, Y, -0.3, 0, 1, () => {
    k.box(1.6, 1.0, 0.18, 0, 0, -0.4, C.stone, { top: 1.12 });
    for (const s of [-1, 1]) k.box(0.18, 1.0, 0.9, s * 0.71, 0, 0, C.stone, { top: 1.12 });
    k.box(1.6, 0.25, 0.15, 0, 0.82, 0.4, C.stone, { top: 1.1 });
    for (const x of [-0.27, 0.27]) k.cyl(0.06, 0.07, 0.82, x, 0, 0.4, C.bone, 6);
    for (const x of [-0.54, 0, 0.54]) k.poly([[-0.24, 0], [0.24, 0], [0.24, 0.14], [0, 0.28], [-0.24, 0.14]], x, 0.82, 0.48, C.stoneD);
    k.box(1.66, 0.06, 1.06, 0, 1.06, 0, C.trim);
    k.gable(1.7, 0.6, 1.0, 0, 1.08, 0, C.roof, C.stone, 0, 0.08);
    k.at(0, 1.18, 0.5, 0, 1, () => skull(k, 0, 0.12, 0.02, 0.09));
    // goods inside: crates, urns of bones, a glowing potion shelf
    k.box(1.2, 0.04, 0.2, 0, 0.55, -0.22, C.wood);
    for (let i = 0; i < 5; i++) k.box(0.07, 0.12, 0.07, -0.45 + i * 0.22, 0.59, -0.22, i % 2 ? C.green : C.violet, { glow: true });
    k.box(1.2, 0.35, 0.3, 0, 0, 0.0, C.wood, { top: 1.15 });
    for (let i = 0; i < 4; i++) k.ball(0.07, -0.42 + i * 0.28, 0.4, 0.0, i % 2 ? C.bone : C.red, 0, { s: [1, 0.8, 1] });
  });
  // stall with crimson awning on the right front
  k.at(0.55, Y, 0.62, -0.25, 1, () => {
    k.box(0.6, 0.35, 0.35, 0, 0, 0, C.wood, { top: 1.15 });
    for (const [x, z] of [[-0.28, -0.15], [0.28, -0.15], [-0.28, 0.17], [0.28, 0.17]]) k.limb([x, 0, z], [x, 0.75, z], 0.02, 0.02, C.woodD, 4);
    k.sheet(4, 1, (u, v) => [-0.36 + u * 0.72, 0.8 - v * 0.2 - (Math.sin(u * Math.PI * 4) * 0.02), -0.22 + v * 0.48], C.red, { shade: (u) => (Math.floor(u * 4 - 0.01) % 2 ? 1 : 0.75), ao: false });
    k.cyl(0.07, 0.08, 0.12, -0.15, 0.35, 0, C.boneD, 6); k.ball(0.06, 0.12, 0.4, 0.02, C.green, 0, { glow: true });
  });
  // barrels and crates on the left
  for (const [x, z] of [[-0.75, 0.55], [-0.55, 0.75]]) { k.cyl(0.13, 0.13, 0.32, x, Y, z, C.wood, 8, { top: 1.15 }); k.cyl(0.135, 0.135, 0.03, x, Y + 0.24, z, C.iron, 8); }
  k.box(0.26, 0.24, 0.26, -0.82, Y, 0.85, C.woodD, { ry: 0.3 });
  // a hanging scales sign on a post
  k.limb([-0.3, Y, 0.85], [-0.3, Y + 1.0, 0.85], 0.03, 0.025, C.iron, 5);
  k.limb([-0.3, Y + 1.0, 0.85], [-0.05, Y + 1.0, 0.85], 0.015, 0.015, C.iron, 4);
  k.box(0.3, 0.2, 0.03, -0.12, Y + 0.72, 0.85, C.red, { ao: false });
  k.ball(0.05, -0.12, Y + 0.82, 0.87, C.bone, 0, { ao: false });
  lantern(k, 0.85, Y, 0.1, 1.0);
  return finish(k);
}

function tavern() {
  const k = makeKit(106);
  plinth(k, 1.8, 1.8, 0.05, C.ground);
  const Y = 0.05;
  k.at(0, Y, -0.1, 0.06, 1, () => {
    // ground floor stone, upper floor timber-framed and jettied, slightly crooked
    k.box(1.2, 0.65, 1.0, 0, 0, 0, C.stone, { top: 1.1 });
    k.box(1.32, 0.6, 1.12, 0.02, 0.65, 0.02, C.boneD, { top: 1.12, rz: 0.02 });
    for (const x of [-0.6, -0.2, 0.2, 0.6]) k.box(0.05, 0.6, 0.02, x + 0.02, 0.65, 0.59, C.woodD, { ao: false });
    k.box(1.34, 0.05, 0.02, 0.02, 0.92, 0.59, C.woodD, { ao: false });
    k.gable(1.15, 0.7, 1.34, 0.02, 1.25, 0.02, C.roof, C.boneD, Math.PI / 2, 0.08);
    // dormer
    k.at(0.0, 1.35, 0.35, 0, 1, () => { k.box(0.3, 0.25, 0.3, 0, 0, 0, C.boneD); k.gable(0.3, 0.18, 0.3, 0, 0.25, 0, C.roofL, C.boneD, 0, 0.04); k.box(0.12, 0.13, 0.01, 0, 0.06, 0.155, C.green, { glow: true }); });
    // windows (warm green), door, sign
    for (const x of [-0.35, 0.35]) { k.box(0.2, 0.2, 0.02, x, 0.25, 0.51, C.green, { glow: true }); k.box(0.24, 0.03, 0.03, x, 0.24, 0.52, C.woodD); k.box(0.02, 0.2, 0.025, x, 0.25, 0.525, C.woodD, { ao: false }); }
    for (const x of [-0.42, 0.42]) k.box(0.18, 0.2, 0.02, x, 0.8, 0.6, C.greenL, { glow: true });
    door(k, 0, 0, 0.5, 0.24, 0.32, { frameC: C.wood, c: C.woodD });
    // chimney with green smoke
    k.box(0.2, 0.75, 0.2, 0.42, 1.25, -0.25, C.stoneD, { top: 1.15 });
    k.box(0.24, 0.05, 0.24, 0.42, 2.0, -0.25, C.trim);
    for (let i = 0; i < 3; i++) k.ball(0.07 + i * 0.03, 0.42 + i * 0.08, 2.15 + i * 0.18, -0.25, i ? C.wisp : C.greenL, 0, { glow: true });
  });
  // the sign: a tankard and skull on a bracket
  k.limb([-0.6, Y + 1.0, 0.45], [-0.95, Y + 1.0, 0.45], 0.02, 0.02, C.iron, 4);
  k.box(0.32, 0.28, 0.04, -0.85, Y + 0.68, 0.45, C.red, { ao: false });
  k.box(0.36, 0.03, 0.05, -0.85, Y + 0.96, 0.45, C.woodD);
  skull(k, -0.85, Y + 0.84, 0.48, 0.06);
  // benches, barrels, lantern
  for (const [x, z] of [[0.68, 0.6], [0.78, 0.25]]) { k.cyl(0.12, 0.12, 0.3, x, Y, z, C.wood, 8, { top: 1.15 }); k.cyl(0.125, 0.125, 0.03, x, Y + 0.22, z, C.iron, 8); }
  k.box(0.5, 0.06, 0.16, -0.35, Y + 0.18, 0.7, C.wood); for (const x of [-0.55, -0.15]) k.box(0.05, 0.18, 0.14, x, Y, 0.7, C.woodD);
  lantern(k, 0.45, Y, 0.75, 0.85);
  return finish(k);
}

// ------------------------------------------------------------------ mage guilds (1.6 footprint)
function mage(level) {
  const k = makeKit(110 + level);
  plinth(k, 1.5, 1.5, 0.06);
  const Y = 0.06;
  // ground tier: an octagonal crypt base
  k.lathe([[0.62, 0], [0.6, 0.12], [0.55, 0.15], [0.52, 0.72], [0.6, 0.78], [0.6, 0.86], [0.4, 0.86]], 0, Y, 0, C.stone, 8, { top: 1.12, bot: 0.86 });
  k.cyl(0.535, 0.535, 0.05, 0, Y + 0.4, 0, C.boneD, 8);
  door(k, 0, Y + 0.12, 0.5, 0.22, 0.32, { glowIn: true });
  for (const a of [0.8, -0.8, 2.3, -2.3]) k.at(Math.sin(a) * 0.51, Y + 0.48, Math.cos(a) * 0.51, a, 1, () => k.poly(lancetPts(0.09, 0.2), 0, 0, 0.01, C.green, { glow: true }));
  // bone ribs climbing the base
  for (const a of [Math.PI / 8 + Math.PI / 4, -Math.PI / 8 - Math.PI / 4, Math.PI - Math.PI / 8, Math.PI + Math.PI / 8]) {
    const x = Math.sin(a), z = Math.cos(a);
    k.limb([x * 0.68, Y, z * 0.68], [x * 0.56, Y + 0.75, z * 0.56], 0.04, 0.03, C.bone, 5);
  }
  let y = Y + 0.86, r = 0.4, top;
  const tiers = [[0.85, 0.4], [0.68, 0.3], [0.72, 0.25]];
  for (let i = 0; i < level; i++) {
    const [h, rr] = tiers[i];
    k.lathe([[rr * 1.05, 0], [rr * 0.93, h], [rr * 1.25, h + 0.05], [rr * 1.25, h + 0.12], [rr * 0.7, h + 0.12]], 0, y, 0, i % 2 ? C.stoneL : C.stone, 8, { top: 1.12, bot: 0.88 });
    k.cyl(rr * 0.99, rr * 1.0, 0.05, 0, y + h * 0.3, 0, C.boneD, 8);
    for (let w = 0; w < 4; w++) { const a = w * Math.PI / 2 + (i % 2) * Math.PI / 4; k.at(Math.sin(a) * rr * 0.97, y + h * 0.42, Math.cos(a) * rr * 0.97, a, 1, () => k.poly(lancetPts(rr * 0.3, h * 0.32), 0, 0, 0.01, i === 2 ? C.violet : C.green, { glow: true })); }
    // a balcony ring of bones
    for (let s = 0; s < 8; s++) { const b = s / 8 * TAU; k.cone(0.03, 0.12, Math.sin(b) * rr * 1.2, y + h + 0.11, Math.cos(b) * rr * 1.2, C.bone, 4); }
    y += h + 0.12; r = rr;
  }
  const roofH = [0, 0.7, 0.62, 0.0][level];
  if (level < 3) {
    k.cone(r * 1.15, roofH, 0, y, 0, C.roof, 8, { top: 1.5, bot: 0.9 });
    top = y + roofH;
    k.ball(0.08, 0, top + 0.06, 0, C.green, 1, { glow: true });
  } else {
    // open crown of curved bone spikes cradling a floating orb with rings
    for (let s = 0; s < 6; s++) {
      const b = s / 6 * TAU, x = Math.sin(b), z = Math.cos(b);
      k.limb([x * r, y, z * r], [x * r * 1.3, y + 0.3, z * r * 1.3], 0.04, 0.03, C.bone, 4);
      k.limb([x * r * 1.3, y + 0.3, z * r * 1.3], [x * r * 0.8, y + 0.62, z * r * 0.8], 0.03, 0.01, C.bone, 4);
    }
    k.ball(0.17, 0, y + 0.55, 0, C.greenL, 1, { glow: true });
    k.tor(0.3, 0.018, 0, y + 0.55, 0, C.green, TAU, { glow: true, rx: 0.5, rs: 16 });
    k.tor(0.36, 0.014, 0, y + 0.55, 0, C.violet, TAU, { glow: true, rx: -0.7, rz: 0.4, rs: 16 });
    top = y + 0.75;
  }
  // side annex: book/coffin shelf with a small turret (level 2+), floating tomes (level 3)
  if (level >= 2) {
    spire(k, -0.58, Y, -0.35, 0.16, 0.7 + level * 0.15, 0.45, { wins: [[0, 0.55]] });
    banner(k, 0, Y + 1.0, 0.56, 0.24, 0.55);
  }
  if (level >= 3) {
    spire(k, 0.58, Y, -0.38, 0.14, 1.15, 0.42, { wins: [[0, 0.55]] });
    for (const [x, yy, z, c] of [[0.52, 2.4, 0.25, C.red], [-0.48, 2.8, 0.3, C.violet], [0.42, 3.15, -0.25, C.red]]) { k.box(0.16, 0.04, 0.12, x, yy, z, c, { ry: x, rz: 0.3 }); k.box(0.14, 0.02, 0.1, x, yy + 0.04, z, C.bone, { ry: x, rz: 0.3 }); }
  }
  brazier(k, 0.5, Y, 0.55, 0.8);
  if (level === 1) tomb(k, -0.5, 0.55, 0.2, 0.9);
  else brazier(k, -0.5, Y, 0.55, 0.8);
  return finish(k);
}

// ------------------------------------------------------------------ dwellings
// d1 cursed graveyard (skeletons) / u1 cursed temple
function d1(up) {
  const k = makeKit(201 + up);
  plinth(k, 1.8, 1.8, 0.05, C.ground);
  const Y = 0.05;
  // fenced graveyard
  k.at(0, Y, 0, 0, 1, () => {
    fence(k, -0.85, 0.85, -0.22, 0.85); fence(k, 0.22, 0.85, 0.85, 0.85);
    fence(k, -0.85, 0.85, -0.85, -0.2); fence(k, 0.85, 0.85, 0.85, -0.2);
    // gate arch of bone with skull
    for (const s of [-1, 1]) k.cyl(0.05, 0.06, 0.6, s * 0.24, 0, 0.85, C.stoneL, 6);
    k.tor(0.24, 0.035, 0, 0.6, 0.85, C.bone, Math.PI, { rs: 8, ts: 4 });
    skull(k, 0, 0.86, 0.87, 0.07);
  });
  // graves
  const G = up ? [[-0.55, 0.3, 0.1, false], [-0.25, 0.35, -0.05, true], [0.5, 0.35, -0.1, false], [-0.6, 0.0, 0.05, false]]
    : [[-0.55, 0.35, 0.1, false], [-0.25, 0.4, -0.05, true], [0.5, 0.38, -0.1, false], [0.22, 0.42, 0.08, false], [-0.6, -0.05, 0.05, false], [0.6, 0.0, 0, true]];
  for (const [x, z, ry, open] of G) grave(k, x, z, ry, open);
  // skeleton arm from an open grave
  k.limb([-0.25, Y + 0.05, 0.45], [-0.22, Y + 0.3, 0.5], 0.02, 0.015, C.bone, 4);
  k.ball(0.035, -0.21, Y + 0.33, 0.5, C.bone, 0);
  cross(k, 0.25, 0.1, 0.1); cross(k, -0.1, 0.05, -0.2, 0.9);
  if (!up) {
    // small cursed shrine at the back
    k.at(0.0, Y, -0.5, 0, 1, () => {
      k.box(0.7, 0.75, 0.55, 0, 0, 0, C.stone, { top: 1.12 });
      k.gable(0.55, 0.45, 0.7, 0, 0.75, 0, C.roof, C.stone, Math.PI / 2);
      door(k, 0, 0, 0.28, 0.2, 0.28, { glowIn: true });
      k.cone(0.04, 0.2, 0, 1.18, 0.33, C.bone, 4);
      k.ball(0.05, 0, 1.4, 0.33, C.green, 0, { glow: true });
    });
    deadTree(k, 0.6, -0.55, 1.0);
  } else {
    // the cursed temple: columned portico, steep roof and a bell spire
    k.at(0.0, Y, -0.45, 0, 1, () => {
      k.box(1.1, 0.06, 0.9, 0, 0, 0.05, C.trim);
      k.box(0.95, 0.95, 0.65, 0, 0.06, -0.08, C.stone, { top: 1.12 });
      k.gable(0.8, 0.5, 1.05, 0, 1.0, 0.0, C.roof, C.stone, Math.PI / 2);
      for (const x of [-0.4, -0.14, 0.14, 0.4]) k.cyl(0.045, 0.055, 0.94, x, 0.06, 0.38, C.bone, 6);
      k.box(1.05, 0.08, 0.14, 0, 0.98, 0.38, C.trim);
      door(k, 0, 0.06, 0.25, 0.24, 0.36, { glowIn: true });
      skull(k, 0, 1.25, 0.42, 0.08, { horns: true });
      for (const s of [-1, 1]) lancet(k, s * 0.3, 0.4, 0.25, 0.1, 0.25, { bars: false });
    });
    spire(k, 0.58, Y, -0.6, 0.15, 1.05, 0.55, { wins: [[0, 0.6]], pennant: 1 });
    for (const s of [-1, 1]) brazier(k, s * 0.42, Y, 0.62, 0.75);
    wisps(k, [[-0.5, 0.9, 0.2, 0.8], [0.35, 1.2, 0.1, 0.7]]);
  }
  return finish(k);
}

// d2 zombie tomb (barrow) / u2 plague tomb with cauldron
function d2(up) {
  const k = makeKit(211 + up);
  plinth(k, 1.8, 1.8, 0.05, C.ground);
  const Y = 0.05;
  // grassy barrow mound
  k.lathe([[0.85, 0], [0.8, 0.25], [0.65, 0.55], [0.4, 0.75], [0.0, 0.82]], 0, Y, -0.3, C.moss, 9, { top: 1.25, bot: 0.8, s: [1, 1, 0.75] });
  // stone facade set into the mound
  k.at(0, Y, 0.05, 0, 1, () => {
    const w = up ? 1.15 : 0.95, h = up ? 0.85 : 0.65;
    k.box(w, h, 0.35, 0, 0, 0, C.stone, { top: 1.12 });
    k.box(w + 0.08, 0.06, 0.4, 0, h, 0, C.trim);
    k.gable(0.4, 0.3, w + 0.08, 0, h + 0.06, 0, C.roof, C.stone, Math.PI / 2, 0.04);
    for (const s of [-1, 1]) { k.box(0.15, h + 0.12, 0.42, s * (w / 2 + 0.02), 0, 0, C.stoneD, { top: 1.12 }); k.cone(0.06, 0.2, s * (w / 2 + 0.02), h + 0.12, 0, C.bone, 4); }
    // heavy door with boards and glowing gaps
    k.poly(lancetPts(0.42, 0.35, 0.6), 0, 0, 0.18, C.greenD, { glow: true });
    for (let i = 0; i < 4; i++) k.box(0.09, 0.42, 0.03, -0.15 + i * 0.1, 0, 0.19, C.wood, { rz: (i - 1.5) * 0.04 });
    k.box(0.44, 0.05, 0.035, 0, 0.12, 0.21, C.woodD, { rz: 0.15 });
    k.box(0.44, 0.05, 0.035, 0, 0.3, 0.21, C.woodD, { rz: -0.12 });
    skull(k, 0, h - 0.1, 0.2, 0.07);
  });
  // leaning coffins and dug graves
  k.at(-0.62, Y, 0.45, 0.3, 1, () => { k.box(0.2, 0.55, 0.1, 0, 0, 0, C.wood, { rx: -0.2, top: 1.15 }); k.box(0.12, 0.02, 0.02, 0, 0.38, 0.06, C.bone, { rx: -0.2 }); });
  k.at(0.65, Y, 0.55, -0.2, 1, () => { k.box(0.2, 0.08, 0.5, 0, 0, 0, C.wood, { top: 1.1 }); k.box(0.21, 0.04, 0.2, 0, 0.08, 0.12, C.woodD, { ry: 0.3 }); k.box(0.12, 0.02, 0.12, 0, 0.08, -0.05, C.greenD, { glow: true }); });
  for (const [x, z] of [[-0.3, 0.68], [0.25, 0.75]]) { k.box(0.24, 0.07, 0.36, x, Y, z, C.dirt, { j: 0.12, top: 1.2 }); }
  // a shovel stuck in the dirt
  k.limb([0.32, Y + 0.05, 0.72], [0.38, Y + 0.6, 0.66], 0.015, 0.015, C.wood, 4);
  k.box(0.1, 0.13, 0.02, 0.32, Y + 0.0, 0.73, C.iron, { rz: 0.1 });
  // reaching hands
  for (const [x, z] of [[-0.25, 0.68], [-0.38, 0.62]]) { k.limb([x, Y + 0.05, z], [x + 0.03, Y + 0.24, z + 0.04], 0.025, 0.02, 0xa8c890, 4); k.ball(0.035, x + 0.03, Y + 0.26, z + 0.04, 0xa8c890, 0); }
  deadTree(k, 0.65, -0.35, 0.9);
  if (up) {
    // plague cauldron bubbling with green ooze, chimney vent from the mound
    k.at(-0.55, Y, -0.05, 0, 1, () => {
      k.lathe([[0.15, 0], [0.24, 0.1], [0.25, 0.25], [0.21, 0.33], [0.19, 0.33]], 0, 0.08, 0, C.iron, 8, { top: 1.2 });
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; k.limb([Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15], [Math.sin(a) * 0.12, 0.12, Math.cos(a) * 0.12], 0.025, 0.02, C.iron, 4); }
      k.cyl(0.2, 0.2, 0.02, 0, 0.38, 0, C.green, 8, { glow: true });
      for (const [x, z, s] of [[0.05, 0.03, 1], [-0.08, -0.05, 0.7], [0.0, -0.1, 0.5]]) k.ball(0.06 * s, x, 0.4 + s * 0.04, z, C.greenL, 0, { glow: true });
      k.cone(0.14, 0.12, 0, 0, 0, C.greenD, 5, { glow: true });
    });
    k.cyl(0.11, 0.13, 0.45, 0.25, Y + 0.6, -0.45, C.stoneD, 6, { top: 1.15 });
    for (let i = 0; i < 3; i++) k.ball(0.07 + i * 0.03, 0.25 + i * 0.05, Y + 1.15 + i * 0.17, -0.45, i ? C.greenL : C.green, 0, { glow: true });
    banner(k, -0.38, Y + 0.85, 0.27, 0.18, 0.4, { emblem: false });
    banner(k, 0.38, Y + 0.85, 0.27, 0.18, 0.4, { emblem: false });
    for (const [x, z] of [[-0.2, -0.75], [0.0, -0.8], [0.2, -0.75]]) k.cone(0.04, 0.22, x, Y + 0.55, z, C.bone, 4);
  }
  return finish(k);
}

// d3 wight crypt / u3 wraith crypt with twin towers
function d3(up) {
  const k = makeKit(221 + up);
  plinth(k, 1.8, 1.8, 0.05, C.ground);
  const Y = 0.05;
  const crypt = (x, z, w, h, roofH) => k.at(x, Y, z, 0, 1, () => {
    k.box(w + 0.1, 0.1, w + 0.1, 0, 0, 0, C.trim);
    k.box(w, h, w, 0, 0.1, 0, C.stone, { top: 1.12 });
    k.box(w + 0.06, 0.06, w + 0.06, 0, 0.1 + h, 0, C.trim);
    k.cone(w * 0.78, roofH, 0, 0.16 + h, 0, C.roof, 4, { ry: Math.PI / 4, top: 1.5 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { k.box(0.1, h + 0.05, 0.1, sx * w / 2, 0.1, sz * w / 2, C.stoneL, { top: 1.12 }); k.cone(0.06, 0.25, sx * w / 2, 0.15 + h, sz * w / 2, C.bone, 4, { ry: Math.PI / 4 }); }
    door(k, 0, 0.1, w / 2, w * 0.38, h * 0.45, { glowIn: true });
    lancet(k, 0, 0.1 + h * 0.62, w / 2, w * 0.18, h * 0.18, { bars: false });
    for (const s of [-1, 1]) k.at(s * w / 2, 0.1 + h * 0.45, 0, s * Math.PI / 2, 1, () => lancet(k, 0, 0, 0, w * 0.18, h * 0.25, { bars: false }));
    k.ball(0.06, 0, 0.16 + h + roofH + 0.05, 0, C.wisp, 0, { glow: true });
  });
  if (!up) {
    crypt(0, -0.2, 0.75, 1.0, 0.85);
    wisps(k, [[-0.55, 0.9, 0.0, 1], [0.6, 1.3, -0.3, 0.9], [0.4, 0.6, 0.45, 0.7], [-0.3, 1.6, -0.5, 0.8]]);
  } else {
    crypt(0, -0.25, 0.8, 1.2, 1.0);
    for (const s of [-1, 1]) spire(k, s * 0.66, Y, -0.35, 0.17, 1.25, 0.6, { wins: [[0, 0.6]], orb: C.wisp, pennant: s });
    // spectral ring floating above the crypt
    k.tor(0.42, 0.025, 0, 2.55, -0.25, C.wisp, TAU, { glow: true, rx: 0.35, rs: 18 });
    wisps(k, [[-0.4, 2.45, -0.1, 0.8], [0.42, 2.65, -0.4, 0.8], [0, 2.75, 0.1, 0.7], [-0.6, 1.0, 0.35, 1], [0.6, 0.8, 0.45, 0.9]]);
    for (const s of [-1, 1]) brazier(k, s * 0.38, Y, 0.55, 0.7);
  }
  // obelisks and tombs in front
  for (const s of [-1, 1]) { k.box(0.12, 0.45, 0.12, s * 0.7, Y, 0.6, C.stoneL, { top: 1.15 }); k.cone(0.09, 0.15, s * 0.7, Y + 0.45, 0.6, C.stoneL, 4, { ry: Math.PI / 4 }); }
  tomb(k, -0.35, 0.68, 0.15, 0.9); tomb(k, 0.32, 0.72, -0.1, 0.85);
  return finish(k);
}

// d4 vampire mansion / u4 grander estate
function d4(up) {
  const k = makeKit(231 + up);
  plinth(k, 2.0, 2.0, 0.05, C.ground);
  const Y = 0.05;
  const W = up ? 1.5 : 1.2, D = 0.8, H = up ? 1.05 : 0.95;
  k.at(0, Y, -0.3, 0, 1, () => {
    // main house: two storeys, steep roof, dormers
    k.box(W, H, D, 0, 0, 0, C.stone, { top: 1.12 });
    k.box(W + 0.06, 0.05, D + 0.06, 0, H * 0.48, 0, C.trim);
    k.box(W + 0.08, 0.06, D + 0.08, 0, H, 0, C.trim);
    k.gable(W, 0.75, D, 0, H + 0.03, 0, C.roof, C.stone, 0, 0.08);
    for (let i = 0; i <= 4; i++) k.cone(0.025, 0.12, -W / 2 + W * i / 4, H + 0.77, 0, C.bone, 4);
    const nx = up ? 4 : 3;
    for (let i = 0; i < nx; i++) {
      const x = -W / 2 + W * (i + 0.5) / nx;
      if (Math.abs(x) < 0.15) continue;
      for (const [y, h] of [[0.12, 0.22], [H * 0.56, 0.2]]) lancet(k, x, y, D / 2, 0.1, h, { bars: false, c: y > 0.3 ? C.green : 0xff7a8a });
    }
    for (const x of up ? [-0.45, 0.45] : [-0.32, 0.32]) k.at(x, H + 0.2, D / 2 - 0.1, 0, 1, () => {
      k.box(0.2, 0.25, 0.25, 0, 0, 0, C.stone); k.gable(0.2, 0.2, 0.25, 0, 0.25, 0, C.roof, C.stone, Math.PI / 2, 0.03);
      k.box(0.09, 0.14, 0.01, 0, 0.05, 0.128, C.green, { glow: true });
    });
    // chimneys
    for (const s of [-1, 1]) { k.box(0.14, 0.55, 0.14, s * (W / 2 - 0.15), H + 0.3, -0.1, C.stoneD, { top: 1.12 }); k.box(0.18, 0.04, 0.18, s * (W / 2 - 0.15), H + 0.85, -0.1, C.trim); }
  });
  // entrance tower with a balcony, crimson banners
  k.at(0, Y, 0.18, 0, 1, () => {
    k.box(0.44, H + 0.5, 0.4, 0, 0, 0, C.stoneL, { top: 1.12 });
    k.box(0.5, 0.05, 0.46, 0, H + 0.48, 0, C.trim);
    k.cone(0.38, 0.75, 0, H + 0.53, 0, C.roof, 4, { ry: Math.PI / 4, top: 1.5 });
    k.limb([0, H + 1.2, 0], [0, H + 1.55, 0], 0.012, 0.01, C.bone, 4); pennant(k, 0, H + 1.48, 0, 0.4, 0.14, C.red, 1);
    door(k, 0, 0, 0.2, 0.2, 0.3, { c: C.redD });
    rose(k, 0, H + 0.22, 0.2, 0.1);
    // balcony
    k.box(0.5, 0.04, 0.18, 0, H * 0.52, 0.27, C.trim);
    for (let i = 0; i < 5; i++) k.box(0.02, 0.12, 0.02, -0.2 + i * 0.1, H * 0.52 + 0.04, 0.35, C.iron, { ao: false });
    k.poly(lancetPts(0.14, 0.18), 0, H * 0.52 + 0.04, 0.2 + 0.01, 0xff7a8a, { glow: true });
  });
  for (const s of [-1, 1]) banner(k, s * 0.36, Y + H + 0.02, 0.12, 0.17, 0.5, { emblem: false });
  if (up) {
    // corner turrets and a walled rose garden with dead roses
    for (const s of [-1, 1]) spire(k, s * 0.82, Y, -0.1, 0.2, 1.4, 0.75, { orb: 0xff6a7a, pennant: s, wins: [[0, 0.6], [s * 1.2, 0.35]] });
    for (const s of [-1, 1]) k.at(s * 0.55, Y, 0.65, 0, 1, () => { k.box(0.35, 0.12, 0.35, 0, 0, 0, C.stoneL); k.box(0.28, 0.02, 0.28, 0, 0.12, 0, C.dirt); for (const [x, z] of [[-0.07, -0.05], [0.08, 0.05], [0.0, 0.08]]) { k.limb([x, 0.12, z], [x, 0.3, z], 0.012, 0.01, C.woodD, 3); k.ball(0.04, x, 0.31, z, C.red, 0); } });
    fence(k, -0.95, 0.95, -0.2, 0.95, 0.35); fence(k, 0.2, 0.95, 0.95, 0.95, 0.35);
    for (const s of [-1, 1]) { k.cyl(0.06, 0.07, 0.5, s * 0.2, Y, 0.95, C.stoneL, 6); k.ball(0.07, s * 0.2, Y + 0.56, 0.95, C.bone, 0); }
  } else {
    for (const s of [-1, 1]) lantern(k, s * 0.4, Y, 0.55, 0.75);
    deadTree(k, -0.75, 0.55, 0.9);
  }
  // bats
  for (const [x, y, z] of up ? [[0.5, 2.6, 0.2], [-0.4, 2.75, 0.0], [0.15, 2.95, -0.2]] : [[0.4, 2.2, 0.1], [-0.35, 2.4, 0.0]]) {
    k.ball(0.035, x, y, z, C.horse, 0);
    for (const s of [-1, 1]) k.cone(0.07, 0.14, x + s * 0.08, y, z, C.horse, 3, { rz: s * Math.PI / 2, s: [1, 1, 0.2] });
  }
  return finish(k);
}

// d5 lich mausoleum / u5 grand mausoleum with obelisks
function d5(up) {
  const k = makeKit(241 + up);
  plinth(k, 2.0, 2.0, 0.05, C.ground);
  const Y = 0.05;
  // stepped base
  for (let i = 0; i < 3; i++) k.box(1.6 - i * 0.18, 0.1, 1.5 - i * 0.18, 0, Y + i * 0.1, -0.1, i % 2 ? C.trim : C.stoneL);
  const B = Y + 0.3, w = up ? 1.1 : 0.95, h = up ? 0.9 : 0.75;
  k.box(w, h, w * 0.85, 0, B, -0.2, C.stone, { top: 1.12 });
  // portico: bone columns, pediment
  for (const x of [-0.36, -0.12, 0.12, 0.36].map((v) => v * w / 0.95)) k.cyl(0.045, 0.055, h, x, B, 0.3, C.bone, 6);
  k.box(w + 0.08, 0.08, 0.3, 0, B + h, 0.25, C.trim);
  k.box(w + 0.1, 0.06, w * 0.85 + 0.1, 0, B + h, -0.2, C.trim);
  k.gable(0.3, 0.25, w + 0.08, 0, B + h + 0.08, 0.25, C.trim, C.stone, Math.PI / 2, 0.03);
  door(k, 0, B, w * 0.85 * 0.5 - 0.2 + 0.01, 0.26, 0.38, { glowIn: true });
  skull(k, 0, B + h + 0.18, 0.34, 0.06);
  // stepped pyramid roof
  let y = B + h + 0.06;
  for (let i = 0; i < 3; i++) { const s = w * (0.9 - i * 0.22); k.box(s, 0.14, s * 0.85, 0, y, -0.2, i % 2 ? C.stoneL : C.stone, { top: 1.15 }); y += 0.14; }
  k.cone(w * 0.25, 0.35, 0, y, -0.2, C.roof, 4, { ry: Math.PI / 4, top: 1.5 });
  // the floating soul crystal
  const cy = y + (up ? 0.75 : 0.6);
  k.ball(up ? 0.16 : 0.12, 0, cy, -0.2, C.violet, 0, { glow: true, s: [0.7, 1.6, 0.7] });
  k.tor(up ? 0.28 : 0.22, 0.016, 0, cy, -0.2, C.green, TAU, { glow: true, rx: 0.5, rs: 16 });
  if (up) k.tor(0.36, 0.012, 0, cy, -0.2, C.violet, TAU, { glow: true, rx: -0.6, rz: 0.5, rs: 16 });
  for (const s of [-1, 1]) for (const z of [-0.45, -0.1]) k.at(s * w / 2, B + h * 0.35, z, s * Math.PI / 2, 1, () => lancet(k, 0, 0, 0, 0.09, 0.2, { bars: false, c: C.violet }));
  if (up) {
    // corner obelisks with violet flames, and a lich statue
    for (const [x, z] of [[-0.85, 0.75], [0.85, 0.75], [-0.85, -0.85], [0.85, -0.85]]) {
      k.box(0.18, 0.08, 0.18, x, Y, z, C.trim);
      k.box(0.12, 1.0, 0.12, x, Y + 0.08, z, C.stoneL, { top: 1.12, s: [1, 1, 1] });
      k.cone(0.09, 0.2, x, Y + 1.08, z, C.roof, 4, { ry: Math.PI / 4 });
      k.cone(0.06, 0.2, x, Y + 1.28, z, C.violet, 4, { glow: true });
    }
    k.at(0.55, Y + 0.3, 0.55, -0.4, 1, () => { k.cone(0.12, 0.5, 0, 0, 0, C.stoneL, 6, { top: 1.1 }); k.ball(0.07, 0, 0.55, 0, C.bone, 0); k.limb([0.1, 0.1, 0.05], [0.12, 0.75, 0.05], 0.012, 0.012, C.iron, 4); k.ball(0.04, 0.12, 0.78, 0.05, C.violet, 0, { glow: true }); });
    brazier(k, -0.55, Y + 0.3, 0.55, 0.75);
  } else {
    for (const s of [-1, 1]) brazier(k, s * 0.62, Y + 0.3, 0.45, 0.65);
    tomb(k, 0.75, 0.75, -0.2, 0.9); tomb(k, -0.75, 0.78, 0.2, 0.85);
  }
  return finish(k);
}

// d6 black knight stables (hall of darkness) / u6 dread stables
function d6(up) {
  const k = makeKit(251 + up);
  plinth(k, 2.4, 2.4, 0.05, C.ground);
  const Y = 0.05;
  // long stable hall, ridge along x
  const L = up ? 1.6 : 1.5, D = 0.85, H = 0.75;
  k.at(up ? 0.2 : 0.1, Y, -0.45, 0, 1, () => {
    k.box(L, H, D, 0, 0, 0, C.stone, { top: 1.12 });
    k.box(L + 0.06, 0.05, D + 0.06, 0, H, 0, C.trim);
    k.gable(L, 0.55, D, 0, H + 0.03, 0, C.roof, C.stone, 0, 0.1);
    for (let i = 0; i <= 5; i++) k.cone(0.03, 0.14, -L / 2 + L * i / 5, H + 0.57, 0, C.bone, 4);
    // stall doors with horses peeking out, red-eyed
    const n = 3;
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + L * (i + 0.5) / n;
      k.poly([[-0.17, 0], [0.17, 0], [0.17, 0.42], [0, 0.55], [-0.17, 0.42]], x, 0, D / 2 + 0.005, C.bone);
      k.poly([[-0.14, 0], [0.14, 0], [0.14, 0.4], [0, 0.5], [-0.14, 0.4]], x, 0, D / 2 + 0.012, C.door);
      k.box(0.3, 0.26, 0.04, x, 0, D / 2 + 0.02, C.wood, { top: 1.1 });
      k.box(0.3, 0.03, 0.05, x, 0.13, D / 2 + 0.03, C.woodD, { rz: 0.6, s: [1, 1, 1] });
      // horse head
      k.box(0.12, 0.14, 0.14, x, 0.3, D / 2 + 0.08, C.horse, { rx: 0.4 });
      k.box(0.09, 0.09, 0.14, x, 0.27, D / 2 + 0.18, C.horse, { rx: 0.5 });
      for (const s of [-1, 1]) { k.cone(0.02, 0.07, x + s * 0.04, 0.42, D / 2 + 0.06, C.horse, 3); k.ball(0.014, x + s * 0.062, 0.36, D / 2 + 0.13, 0xff4a4a, 0, { glow: true }); }
      k.box(0.03, 0.12, 0.08, x, 0.38, D / 2 + 0.04, C.red, { rx: 0.4, ao: false });
    }
    // horse skull over the middle door
    k.at(0, H - 0.18, D / 2 + 0.05, 0, 1, () => { k.box(0.1, 0.1, 0.22, 0, 0, 0, C.bone, { rx: -1.1 }); for (const s of [-1, 1]) k.ball(0.018, s * 0.035, 0.08, 0.06, C.green, 0, { glow: true }); });
  });
  // tower at the left end
  const tx = up ? -0.78 : -0.76;
  spire(k, tx, Y, -0.55, up ? 0.28 : 0.24, up ? 1.85 : 1.35, up ? 1.0 : 0.75, { pennant: -1 });
  // paddock: fence, water trough, armour stand
  fence(k, -1.1, 1.1, 1.1, 1.1, 0.35, 0.2);
  fence(k, -1.1, 1.1, -1.1, 0.15, 0.35, 0.2);
  fence(k, 1.1, 1.1, 1.1, 0.15, 0.35, 0.2);
  k.box(0.6, 0.18, 0.2, 0.55, Y, 0.55, C.wood, { top: 1.15 }); k.box(0.52, 0.02, 0.14, 0.55, Y + 0.17, 0.55, C.greenD, { glow: true });
  k.box(0.3, 0.4, 0.3, -0.5, Y, 0.45, C.boneD, { top: 1.15 }); k.box(0.32, 0.04, 0.32, -0.5, Y + 0.4, 0.45, C.woodD);
  for (const s of [-1, 1]) brazier(k, s * 0.25, Y, 0.85, 0.7);
  if (up) {
    // dread knight's armour on a stand, crimson banners and spiked roof crest
    k.at(-0.2, Y, 0.35, 0, 1, () => {
      k.limb([0, 0, 0], [0, 0.75, 0], 0.025, 0.025, C.wood, 4);
      k.box(0.24, 0.28, 0.12, 0, 0.35, 0, C.iron, { top: 1.3 });
      k.ball(0.08, 0, 0.72, 0, C.iron, 0, { s: [1, 1.2, 1] }); k.box(0.1, 0.02, 0.02, 0, 0.72, 0.075, 0xff4a4a, { glow: true });
      k.cone(0.03, 0.2, 0, 0.8, -0.03, C.red, 4, { rx: -0.6 });
      k.box(0.03, 0.6, 0.02, 0.2, 0.05, 0.05, C.trim);
    });
    for (const x of [-0.15, 0.65]) banner(k, x, Y + 0.75, -0.02, 0.2, 0.42, { emblem: false });
    k.at(0.9, Y, -0.9, 0, 1, () => spire(k, 0, 0, 0, 0.18, 1.1, 0.55, { wins: [[0, 0.6]] }));
  }
  return finish(k);
}

// d7 dragon vault (bone pit) / u7 grand vault with bone wings
function d7(up) {
  const k = makeKit(261 + up);
  plinth(k, 2.8, 2.8, 0.06, C.ground);
  const Y = 0.06;
  // the vault: a domed rotunda behind the skull
  k.at(0, Y, -0.55, 0, 1, () => {
    k.lathe([[1.0, 0], [0.95, 0.15], [0.9, 1.0], [0.98, 1.06], [0.98, 1.14], [0.85, 1.14], [0.8, 1.4], [0.62, 1.75], [0.35, 1.95], [0.0, 2.02]], 0, 0, 0, C.stone, 10, { top: 1.15, bot: 0.86 });
    // dome ribs of bone
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.26;
      const P = [[0.88, 1.14], [0.82, 1.4], [0.64, 1.75], [0.36, 1.96], [0.02, 2.03]].map(([r, y]) => [Math.sin(a) * (r + 0.03), y, Math.cos(a) * (r + 0.03)]);
      for (let j = 0; j < 4; j++) k.limb(P[j], P[j + 1], 0.04, 0.035, C.bone, 4);
    }
    for (const a of [1.1, -1.1, 2.3, -2.3]) k.at(Math.sin(a) * 0.91, 0.4, Math.cos(a) * 0.91, a, 1, () => k.poly(lancetPts(0.14, 0.32), 0, 0, 0.01, C.green, { glow: true }));
    k.ball(0.12, 0, 2.2, 0, C.green, 1, { glow: true });
    k.limb([0, 2.0, 0], [0, 2.4, 0], 0.03, 0.015, C.bone, 4);
  });
  // the giant dragon skull gate: the open mouth is the vault entrance
  const taper = (rt, rb, len, sy) => new THREE.CylinderGeometry(rt, rb, len, 4, 1).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(1, sy, 1);
  k.at(0, Y, 0.35, 0, 1, () => {
    // cranium and brow
    k.ball(0.58, 0, 1.3, -0.25, C.bone, 1, { s: [1.05, 0.78, 1.0], top: 1.12, bot: 0.86 });
    for (const s of [-1, 1]) k.box(0.42, 0.1, 0.32, s * 0.27, 1.42, 0.12, C.boneD, { rz: s * 0.28, ry: -s * 0.2 });
    // eye sockets glowing
    for (const s of [-1, 1]) k.ball(0.13, s * 0.29, 1.27, 0.17, C.green, 1, { glow: true, s: [1, 0.72, 0.6] });
    // upper jaw: a long tapered snout, nostrils at the tip, fangs hanging
    k.add(taper(0.2, 0.42, 0.95, 0.5).translate(0, 1.07, 0.42), C.bone, { top: 1.1, bot: 0.86 });
    for (const s of [-1, 1]) k.ball(0.05, s * 0.1, 1.12, 0.86, C.greenD, 0, { glow: true, s: [1, 0.6, 0.6] });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const z = 0.75 - i * 0.18, x = s * (0.14 + i * 0.05);
      k.cone(0.045 - i * 0.004, 0.24 - i * 0.02, x, 0.98, z, C.bone, 4, { rx: Math.PI });
    }
    // lower jaw resting on the ground, teeth up
    k.add(taper(0.17, 0.36, 0.9, 0.42).translate(0, 0.12, 0.48), C.boneD, { top: 1.15, bot: 0.9 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) k.cone(0.04, 0.18 - i * 0.02, s * (0.12 + i * 0.05), 0.2, 0.78 - i * 0.18, C.bone, 4);
    // cheekbones framing the mouth
    for (const s of [-1, 1]) { k.limb([s * 0.4, 1.12, 0.0], [s * 0.38, 0.12, 0.08], 0.1, 0.08, C.bone, 5); k.ball(0.12, s * 0.4, 0.14, 0.08, C.boneD, 0); }
    // the dark throat with green glow
    k.box(0.68, 0.9, 0.1, 0, 0.1, -0.05, C.door, { ao: false });
    k.poly(lancetPts(0.5, 0.55, 0.6), 0, 0.12, 0.01, C.greenD, { glow: true });
    // horns sweeping back
    for (const s of [-1, 1]) {
      const P = [[s * 0.42, 1.48, -0.2], [s * 0.62, 1.72, -0.45], [s * 0.68, 2.0, -0.8], [s * 0.6, 2.25, -1.05]];
      for (let j = 0; j < 3; j++) k.limb(P[j], P[j + 1], 0.12 - j * 0.035, 0.09 - j * 0.035, C.boneD, 5);
      k.cone(0.04, 0.2, P[3][0], P[3][1], P[3][2], C.bone, 5, { rx: -0.5 });
    }
  });
  // spine and ribs running back from the skull
  for (let i = 0; i < (up ? 4 : 3); i++) {
    const z = -0.05 - i * 0.32, rr = 0.75 - i * 0.07;
    for (const s of [-1, 1]) {
      const P = [[0, 1.75 + Y - i * 0.1, z], [s * rr * 0.75, 1.55 - i * 0.1, z + 0.05], [s * rr * 1.2, 0.8, z + 0.1], [s * rr * 1.25, 0.1, z + 0.08]];
      for (let j = 0; j < 3; j++) k.limb(P[j], P[j + 1], 0.05, 0.04, C.bone, 4);
    }
  }
  // bone pit fires and scattered bones
  for (const s of [-1, 1]) {
    brazier(k, s * 0.9, Y, 1.1, 1.1);
    k.limb([s * 1.05, Y + 0.02, 0.55], [s * 0.75, Y + 0.05, 0.8], 0.04, 0.035, C.bone, 4);
    k.ball(0.09, s * 1.1, Y + 0.08, 0.3, C.bone, 0, { s: [1, 0.85, 1.1] });
  }
  if (up) {
    // great bone wings spread behind the vault
    for (const s of [-1, 1]) {
      const sh = [s * 0.65, 1.9, -1.0];
      const tips = [[s * 1.15, 3.25, -1.2], [s * 1.38, 2.75, -1.15], [s * 1.4, 2.2, -1.1], [s * 1.32, 1.6, -1.05]];
      k.limb([s * 0.35, 1.6, -0.9], sh, 0.07, 0.06, C.bone, 5);
      k.limb(sh, [s * 0.95, 3.0, -1.15], 0.06, 0.05, C.bone, 5);
      for (const t of tips) k.limb([s * 0.95, 3.0, -1.15], t, 0.035, 0.02, C.boneD, 4);
      // membrane: ghostly translucent-looking pale violet
      k.sheet(4, 1, (u, v) => {
        const i = Math.min(3, Math.floor(u * 4)), f = u * 4 - i;
        const a = i === 0 ? [s * 0.95, 3.0, -1.15] : tips[i - 1], b = tips[Math.min(3, i)];
        const p = v === 0 ? sh : [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - Math.sin(f * Math.PI) * 0.12, a[2] + (b[2] - a[2]) * f];
        return v === 0 ? [sh[0], sh[1] - 0.1 + u * 0.2, sh[2] - 0.05] : p;
      }, 0xb8a8d8, { top: 1.1, bot: 0.9, ao: false });
    }
    // flanking spires
    for (const s of [-1, 1]) spire(k, s * 1.08, Y, -0.35, 0.2, 1.55, 0.85, { pennant: s, wins: [[0, 0.6], [s * 1.0, 0.35]] });
    // ghostly flames in the eye sockets rise as wisps
    wisps(k, [[-0.4, 2.1, 0.7, 0.9], [0.45, 2.3, 0.6, 0.8], [0.0, 2.9, -0.4, 1.0]]);
    for (const s of [-1, 1]) banner(k, s * 0.62, Y + 1.0, 0.15, 0.24, 0.6);
  }
  return finish(k);
}

// fallback: a small crypt
function fallback() {
  const k = makeKit(300);
  plinth(k, 1.4, 1.4, 0.05);
  k.box(0.8, 0.7, 0.8, 0, 0.05, 0, C.stone, { top: 1.12 });
  k.cone(0.68, 0.55, 0, 0.75, 0, C.roof, 4, { ry: Math.PI / 4, top: 1.5 });
  door(k, 0, 0.05, 0.4, 0.22, 0.3, { glowIn: true });
  return finish(k);
}

const BUILD = {
  village, hall2, hall3, fort, market, tavern,
  mage1: () => mage(1), mage2: () => mage(2), mage3: () => mage(3),
  d1: () => d1(0), u1: () => d1(1), d2: () => d2(0), u2: () => d2(1), d3: () => d3(0), u3: () => d3(1),
  d4: () => d4(0), u4: () => d4(1), d5: () => d5(0), u5: () => d5(1), d6: () => d6(0), u6: () => d6(1), d7: () => d7(0), u7: () => d7(1),
};
// Returns a fresh { body, glow } on every call (the caller owns and may dispose it).
export function necroTownBuilding(id) {
  return (BUILD[id] || fallback)();
}
