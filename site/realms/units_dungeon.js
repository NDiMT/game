import * as THREE from 'three';
import { BONE } from './rig.js?v=1.9';

// =====================================================================
// HEX REALMS: Dungeon (warlock underworld) creatures, round 6.
// dungeonModel(id) -> { body, glow } (cached) for the 7 base creatures
// troglodyte, harpy, beholder, medusa, minotaur, manticore, blackdragon and
// their upgrades infernaltrog, harpyhag, evileye, medusaqueen, minotaurking,
// scorpicore, reddragon. Facing +z, base at y = 0.
// dungeonBuild(baseId, up) builds a creature; an upgrade is the same builder
// with up = true (same silhouette, grander: gold trims, crowns, bigger
// wings / weapons, hotter glows).
//
// Look: violet / teal underworld with bright accents (magenta, gold, teal
// glows). Never murky: the "black" dragon is a rich violet-plum with magenta
// spines, teal horns and glowing eyes.
// Readability (Round 4): chunky, 1-2 exaggerated identity features each
// (blind lizard head + spear, wing-arms + talons, one huge eye + stalks,
// snake coil + snake hair + bow, bull head + double axe, mane + bat wings +
// scorpion tail, dragon wings), 2-3 colour blocks + one accent, no micro parts.
// Rig (Round 5): every part carries aBone/aPivot via k.bone(bone, pivot, fn)
// (kit shared with units_haven.js). +x = *_R (weapon side); quadrupeds use
// LEG_FL/FR/BL/BR, flyers WING_L/R, tails TAIL, beholder eye-stalks are HEAD
// bones with their own pivots, the medusa coil is BODY with its tail on TAIL.
// Detail (Round 7): a secondary layer for close-ups that leaves the silhouettes
// alone: real eyes (white / iris / pupil / glint), teeth, nostrils, brows,
// claws on hands and feet, banded scales / horn ridges / grip wraps (wraps,
// stripes), plate and scale patterns sunk into the hide (platesOn), belts with
// buckles, pouches, straps, embroidered hems, quivers and fletching, layered
// feather rows on the harpy wings, veined / panelled bat-wing membranes with
// knuckled fingers, finer lathes / spheres on the big curved forms.
// Budgets: ~3.7-5.4k tris per creature, dragons ~6k.
// =====================================================================

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UPV = new THREE.Vector3(0, 1, 0);
const L3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------------------------------------------------------------- palette
// violet / teal underworld, bright accents; darks are plum, never black
const VIO = 0x9a5ae6, VIO_D = 0x7442c8, VIO_L = 0xc49cf8;
const TEAL = 0x2ec8bc, TEAL_D = 0x20a0a0, TEAL_L = 0x86f2e6;
const MAG = 0xf04ab8, MAG_L = 0xff8ad8;
const GOLD = 0xf6c232, GOLD_L = 0xffe27a;
const STEEL = 0xd2d9e6, STEEL_D = 0x9ea8c0, STEEL_L = 0xf0f4ff;
const SKIN = 0xf2c4b0;
const LEATHER = 0xa8642e, WOOD = 0xb07a48;
const WHITE = 0xfbf8f0, CREAM = 0xf3e8cc, BONEC = 0xf4e6c4;
const INK = 0x3a2a62, MOUTH = 0x6a2464;
// glows
const G_TEAL = 0x5afff0, G_MAG = 0xff5ae0, G_GOLD = 0xffd84a, G_RED = 0xff4a3a, G_LIME = 0xb8ff5a;
// ---------------------------------------------------------------- kit
const SWAP = { [BONE.ARM_L]: BONE.ARM_R, [BONE.ARM_R]: BONE.ARM_L, [BONE.LEG_FL]: BONE.LEG_FR, [BONE.LEG_FR]: BONE.LEG_FL,
  [BONE.LEG_BL]: BONE.LEG_BR, [BONE.LEG_BR]: BONE.LEG_BL, [BONE.WING_L]: BONE.WING_R, [BONE.WING_R]: BONE.WING_L };
// bodyPivot: pivot of the default BODY bone (everything not tagged otherwise)
function makeKit(seed, bodyPivot = [0, 0.42, 0]) {
  const parts = [];
  const stack = [new THREE.Matrix4()];
  let rig = { b: BONE.BODY, p: bodyPivot }, mir = false;
  const k = {
    get M() { return stack[stack.length - 1]; },
    // run fn with an extra transform applied to everything it adds
    with(m, fn) { stack.push(k.M.clone().multiply(m)); fn(); stack.pop(); },
    at(p, r = [0, 0, 0], s = 1, fn) { k.with(mat(p, r, s), fn); },
    // run fn twice, the second time mirrored across x = 0
    sym(fn) { fn(1); const pm = mir; mir = !mir; k.with(new THREE.Matrix4().makeScale(-1, 1, 1), () => fn(-1)); mir = pm; },
    // tag everything fn adds with a rig bone; pivot is in the current frame
    // (b == null: keep the current bone)
    bone(b, p, fn) {
      if (b == null) return fn();
      const prev = rig;
      rig = { b: mir ? (SWAP[b] ?? b) : b, p: V3(p).applyMatrix4(k.M).toArray() };
      fn(); rig = prev;
    },
    add(g, col, o = {}) {
      let ng = g.index ? g.toNonIndexed() : g;
      ng.deleteAttribute('normal'); ng.deleteAttribute('uv');
      ng.applyMatrix4(k.M);
      if (k.M.determinant() < 0) flip(ng);
      const pr = { bone: rig.b, pivot: rig.p, col: new THREE.Color(col), grad: o.grad ?? [0.9, 1.06], glow: !!o.glow, ao: o.ao ?? true, noise: o.noise ?? 0.025, top: o.top };
      parts.push({ g: ng, ...pr });
      // two-sided sheet (capes, pennants): add a back face, nudged inward a hair
      if (o.both) { const bg = ng.clone(); flip(bg); parts.push({ g: bg, ...pr }); }
    },
    // geometry primitives, all placed at p with euler r and scale s
    box(w, h, d, p, col, o = {}) { k.add(new THREE.BoxGeometry(w, h, d).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    // Round 7: big ellipsoids get a finer sphere so curved forms look sculpted
    ell(rx, ry, rz, p, col, o = {}) { k.add(new THREE.IcosahedronGeometry(1, o.d ?? (Math.max(rx, ry, rz) >= 0.12 ? 2 : 1)).scale(rx, ry, rz).applyMatrix4(mat(p, o.r)), col, o); },
    ball(r, p, col, o = {}) { k.ell(r, r, r, p, col, o); },
    lathe(prof, p, col, o = {}) {
      const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), o.seg ?? 8, o.phi ?? 0, o.len ?? Math.PI * 2);
      k.add(g.applyMatrix4(mat(p, o.r, o.s)), col, o);
    },
    cyl(r1, r2, h, p, col, o = {}) { k.add(new THREE.CylinderGeometry(r2, r1, h, o.seg ?? 8, 1, !!o.open).translate(0, h / 2, 0).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    cone(r, h, p, col, o = {}) { k.add(new THREE.ConeGeometry(r, h, o.seg ?? 6).translate(0, h / 2, 0).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    torus(R, t, p, col, o = {}) { k.add(new THREE.TorusGeometry(R, t, o.ts ?? 4, o.seg ?? 16, o.arc ?? Math.PI * 2).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    // a tapered rod from a to b
    limb(a, b, r1, r2, col, o = {}) {
      const va = V3(a), vb = V3(b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r2, r1, len, o.seg ?? 8, 1, !!o.open).translate(0, len / 2, 0);
      if (o.sz) g.scale(1, 1, o.sz);
      k.add(g.applyMatrix4(along(va, vb, o.roll ?? 0)), col, o);
    },
    // any geometry built along +y (0..len), stretched from a to b
    stick(g, a, b, col, o = {}) { k.add(g.applyMatrix4(along(V3(a), V3(b), o.roll ?? 0)), col, o); },
    // a feather: a flat tapered blade from a to b, w wide
    feather(a, b, w, col, o = {}) {
      const len = V3(a).distanceTo(V3(b)), t = o.t ?? 0.014;
      const s = new THREE.Shape();
      s.moveTo(-w * 0.35, 0); s.lineTo(w * 0.35, 0); s.lineTo(w * 0.5, len * 0.55); s.lineTo(w * 0.2, len); s.lineTo(-w * 0.3, len * 0.9); s.lineTo(-w * 0.5, len * 0.5);
      const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2);
      k.add(g.applyMatrix4(along(V3(a), V3(b), o.roll ?? 0)), col, o);
    },
    // a flat extruded outline in the xy plane (shield, blade, pennant)
    plate(pts, depth, p, col, o = {}) {
      const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -depth / 2);
      k.add(g.applyMatrix4(mat(p, o.r, o.s)), col, o);
    },
    done() { return finish(parts, seed); },
  };
  return k;
}
function mat(p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  const sc = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
  return new THREE.Matrix4().compose(V3(p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ')), sc);
}
function along(va, vb, roll) {
  const d = vb.clone().sub(va).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(UPV, d);
  // keep the local z axis pointing as close to world +z (or +y) as possible, then roll
  const zl = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  let want = new THREE.Vector3(0, 0, 1); if (Math.abs(d.z) > 0.9) want = new THREE.Vector3(0, 1, 0);
  want.sub(d.clone().multiplyScalar(want.dot(d))).normalize();
  let ang = Math.atan2(zl.clone().cross(want).dot(d), zl.dot(want));
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(d, ang + roll));
  return new THREE.Matrix4().compose(va, q, new THREE.Vector3(1, 1, 1));
}
function flip(g) {
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) { const t = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = t; }
}
const hash3 = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function finish(parts, seed) {
  // typed output sized up front (every vertex is kept): no growing JS arrays, no copy into the attributes
  let nB = 0, nG = 0;
  for (const pt of parts) { const l = pt.g.attributes.position.array.length; if (pt.glow) nG += l; else nB += l; }
  const mk = (n) => ({ p: new Float32Array(n), c: new Float32Array(n), b: new Float32Array(n / 3), v: new Float32Array(n), n: 0 });
  const out = { body: mk(nB), glow: mk(nG) };
  // whole-model value band: light top, mid body, softer underside (never dark)
  let gy1 = 0.5;
  for (const pt of parts) if (!pt.glow) { const P = pt.g.attributes.position.array; for (let i = 1; i < P.length; i += 3) gy1 = Math.max(gy1, P[i]); }
  for (const pt of parts) {
    const P = pt.g.attributes.position.array, dst = pt.glow ? out.glow : out.body;
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < P.length; i += 3) { y0 = Math.min(y0, P[i]); y1 = Math.max(y1, P[i]); }
    const span = Math.max(1e-4, y1 - y0);
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      // lift grads so the dark end never goes murky
      const g0 = 0.35 + 0.65 * pt.grad[0], g1 = pt.grad[1];
      let m = g0 + (g1 - g0) * ((y - y0) / span);
      // face normal of this vertex's triangle: up-facing surfaces catch the sun
      // (helps the steep battle camera), down-facing ones get a soft cool shade
      const t0 = i - (i % 9);
      _a.fromArray(P, t0); _b.fromArray(P, t0 + 3).sub(_a); _c.fromArray(P, t0 + 6).sub(_a);
      const ny = _b.cross(_c).normalize().y || 0;
      let ao = 1, cool = 0;
      if (!pt.glow) {
        m *= 1 + 0.12 * Math.max(0, ny) - 0.07 * Math.max(0, -ny);
        m *= 0.9 + 0.16 * Math.min(1, y / gy1);
        if (pt.ao) { const a = smooth(0, 0.28, y); ao = 0.8 + 0.2 * a; cool = (1 - a) * 0.06; }
      }
      m *= ao * (1 + (hash3(x + seed, y, z) - 0.5) * 2 * pt.noise);
      let c = pt.col;
      if (pt.top && y > y1 - span * pt.top[1]) c = pt.topC || (pt.topC = new THREE.Color(pt.top[0]));
      // coloured (blue-violet) shade near the ground instead of black
      const o = dst.n * 3;
      dst.p[o] = x; dst.p[o + 1] = y; dst.p[o + 2] = z;
      dst.c[o] = c.r * m + cool * 0.4; dst.c[o + 1] = c.g * m + cool * 0.5; dst.c[o + 2] = c.b * m + cool;
      dst.b[dst.n++] = pt.bone; dst.v[o] = pt.pivot[0]; dst.v[o + 1] = pt.pivot[1]; dst.v[o + 2] = pt.pivot[2];
    }
  }
  const build = ({ p, c, b, v }, uv) => {
    if (!p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aBone', new THREE.BufferAttribute(b, 1));
    g.setAttribute('aPivot', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    if (uv) {
      // box-projected uv per triangle, about 1 unit = 1 uv
      const n = g.attributes.normal.array, u = new Float32Array((p.length / 3) * 2);
      for (let t = 0; t < p.length; t += 9) {
        const ax = Math.abs(n[t]), ay = Math.abs(n[t + 1]), az = Math.abs(n[t + 2]);
        for (let v = 0; v < 3; v++) {
          const i = t + v * 3, o = (i / 3) * 2;
          if (ax >= ay && ax >= az) { u[o] = p[i + 2]; u[o + 1] = p[i + 1]; } else if (ay >= az) { u[o] = p[i]; u[o + 1] = p[i + 2]; } else { u[o] = p[i]; u[o + 1] = p[i + 1]; }
        }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
    }
    g.computeBoundingSphere();
    return g;
  };
  return { body: build(out.body, true), glow: build(out.glow, false) };
}

// ---------------------------------------------------------------- humanoid
// chunky heroic figure: head centre HY, radius HR (~1.35x a realistic head)
const HY = 0.8, HR = 0.135, SH = [0.2, 0.645, 0], SHL = [-0.2, 0.645, 0], NECK = [0, 0.7, 0], HIPS = [0, 0.42, 0];

// Two-bone arm reaching from shoulder s to hand h, elbow pushed toward a pole.
function arm(k, s, h, c) {
  const L1 = 0.175, L2 = 0.165, S = V3(s), H = V3(h);
  let d = S.distanceTo(H); const dir = H.clone().sub(S).normalize();
  d = Math.min(Math.max(d, 0.08), L1 + L2 - 0.005);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pole = new THREE.Vector3(0.8, -0.5, -0.6); pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a)).add(pole.multiplyScalar(hh));
  const Hh = S.clone().add(dir.clone().multiplyScalar(d));
  k.limb(s, E.toArray(), c.r1, c.r1 * 0.92, c.upper);
  k.ball(c.r1 * 0.95, E.toArray(), c.elbow ?? c.upper, { d: 0 });
  k.limb(E.toArray(), Hh.toArray(), c.r1 * 0.9, c.r2, c.fore);
  k.ball(c.hr, Hh.toArray(), c.hand, { d: 1 });
  c.elbowAt = E.toArray();
  return Hh.toArray();
}

function eyes(k, y = HY + 0.005, z = 0.128, col = INK) {
  k.sym(() => k.ell(0.025, 0.031, 0.014, [0.05, y, z], col, { d: 0, grad: [1, 1], ao: false }));
}

// Standing (or seated) figure ~0.95 tall to the crown. Returns hand positions.
function figure(k, o) {
  const legs = o.legs, boots = o.boots ?? LEATHER;
  // rig: standing legs LEG_FR (+x) / LEG_FL from the hip; a seated rider's legs
  // stay on the bone the caller set (RIDER); head on HEAD from the neck
  if (!o.robe) k.sym(() => k.bone(o.sit ? null : BONE.LEG_FR, [0.085, 0.42, 0], () => {
    if (o.sit) {
      k.limb([0.09, 0.4, 0], [0.16, 0.37, 0.19], 0.078, 0.066, legs);
      k.limb([0.16, 0.37, 0.19], [0.18, 0.15, 0.13], 0.062, 0.054, legs);
      k.ell(0.068, 0.062, 0.105, [0.18, 0.12, 0.17], boots, { d: 0 });
    } else {
      const st = o.stance ?? 0.1;
      k.limb([0.085, 0.42, 0], [st, 0.21, 0.02], 0.08, 0.068, legs);
      k.limb([st, 0.21, 0.02], [st, 0.08, 0.01], 0.066, 0.06, legs);
      if (o.knee) k.ball(0.072, [st, 0.215, 0.03], o.knee, { d: 0 });
      k.ell(0.076, 0.072, 0.118, [st, 0.06, 0.035], boots, { d: 1 });
    }
  }));
  k.ell(0.155, 0.085, 0.115, [0, 0.43, 0], o.hips ?? legs);
  k.lathe([[0.135, 0.4], [0.155, 0.48], [0.185, 0.56], [0.205, 0.63], [0.19, 0.69], [0.12, 0.73], [0.03, 0.745]], [0, 0, 0], o.torso, { s: [1, 1, 0.76], seg: 12, grad: o.torsoGrad ?? [0.82, 1.1] });
  if (o.belt) k.lathe([[0.158, 0.44], [0.162, 0.495]], [0, 0, 0], o.belt, { s: [1, 1, 0.8], seg: 10, grad: [1, 1] });
  if (o.head !== false) k.bone(BONE.HEAD, NECK, () => {
    k.ell(HR, HR * 1.02, HR * 0.98, [0, HY, 0.01], o.skin ?? SKIN, { grad: [0.95, 1.05] });
    if (o.eyes !== false) eyes(k);
  });
  if (o.pauldron) k.sym(() => {
    k.ell(0.118, 0.088, 0.118, [0.2, 0.675, 0], o.pauldron, { r: [0, 0, -0.38], grad: [0.85, 1.12] });
    if (o.pTrim) k.torus(0.105, 0.024, [0.205, 0.652, 0], o.pTrim, { r: [Math.PI / 2, 0, -0.38], seg: 8, ts: 3, grad: [1, 1] });
  });
  const ac = { upper: o.upper ?? o.torso, fore: o.fore ?? o.upper ?? o.torso, hand: o.hand ?? SKIN, elbow: o.elbow, r1: o.armR ?? 0.064, r2: o.foreR ?? 0.056, hr: o.handR ?? 0.058 };
  let R, RE; k.bone(BONE.ARM_R, SH, () => { R = arm(k, SH, o.rh ?? [0.24, 0.36, 0.06], ac); RE = ac.elbowAt; });
  const lh = o.lh ?? [-0.24, 0.36, 0.06];
  let Lm, LE; k.with(new THREE.Matrix4().makeScale(-1, 1, 1), () => k.bone(BONE.ARM_L, SH, () => { Lm = arm(k, SH, [-lh[0], lh[1], lh[2]], ac); LE = ac.elbowAt; }));
  // R/L hands, RE/LE elbows (model space, for bracers / claws)
  return { R, L: [-Lm[0], Lm[1], Lm[2]], RE, LE: [-LE[0], LE[1], LE[2]] };
}

// a cape hanging behind the shoulders: outer sheet, reversed lining (so it shows
// from the front too) and a gold hem. Lathe arc centred on -z.
function cape(k, o) {
  const { y0 = 0.22, y1 = 0.7, r0 = 0.27, r1 = 0.19, col = VIO, lin = GOLD, hem = GOLD, arc = 2.2, sz = 0.85, z = -0.01, seg = 7 } = o;
  const prof = [];
  for (let i = 0; i <= 3; i++) { const t = i / 3; prof.push([r0 + (r1 - r0) * Math.pow(t, 1.3), y0 + (y1 - y0) * t]); }
  const phi = Math.PI - arc / 2, at = [0, 0, z];
  k.bone(BONE.CLOTH, [0, y1, z - r1 * sz], () => {
  k.lathe(prof, at, col, { s: [1, 1, sz], seg, phi, len: arc, grad: [1.0, 1.18] });
  k.lathe(prof.map(([r, y]) => [r * 0.965, y]).reverse(), at, lin, { s: [1, 1, sz], seg, phi, len: arc, grad: [0.85, 1.05] });
  if (hem) {
    k.lathe([[r0 + 0.008, y0 - 0.005], [r0 * 0.99 + 0.006, y0 + 0.055]], at, hem, { s: [1, 1, sz], seg, phi: phi - 0.02, len: arc + 0.04, grad: [1, 1], ao: false });
    k.lathe([[r0 * 0.99 + 0.006, y0 + 0.055], [r0 + 0.008, y0 - 0.005]].map(([r, y]) => [r * 0.95, y]), at, hem, { s: [1, 1, sz], seg, phi: phi - 0.02, len: arc + 0.04, grad: [1, 1], ao: false });
  }
  });
}

// a crossed pair of leaf blades (reads from any yaw): spear and pike heads
function leafHead(k, p, len, w, col) {
  const leaf = [[-w * 0.6, 0], [w * 0.6, 0], [w, len * 0.3], [0, len], [-w, len * 0.3]];
  k.plate(leaf, 0.03, p, col, { r: [0, 0.6, 0], grad: [0.9, 1.15] });
  k.plate(leaf, 0.03, p, col, { r: [0, 0.6 + Math.PI / 2, 0], grad: [0.9, 1.15] });
}

// run fn in a frame whose +y runs along a pole from a toward b (returns the pole length)
function pole(k, a, b, fn) { const L = V3(a).distanceTo(V3(b)); k.with(along(V3(a), V3(b), 0), () => fn(L)); return L; }

// a big feathered wing: a solid two-layer fan from the arm (shoulder -> wrist -> tip)
// to a scalloped trailing edge in three colour bands, plus a few broad primaries.
const smoothU = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
function wing(k, shp, o) {
  const { W, T, len = 0.42, n = 8, col = WHITE, tip = GOLD_L, cov = WHITE, drop = [0, -1, -0.35], dropIn = drop, th = 0.016, prim = 3, bone = cov } = o;
  const S = V3(shp), wrist = S.clone().add(V3(W)), tipP = S.clone().add(V3(T));
  k.limb(S.toArray(), wrist.toArray(), 0.05, 0.04, bone, { seg: 5 });
  k.limb(wrist.toArray(), tipP.toArray(), 0.04, 0.022, bone, { seg: 5 });
  const D = V3(drop).normalize(), Din = V3(dropIn).normalize(), E = tipP.clone().sub(wrist).normalize();
  const tipDir = E.clone().multiplyScalar(0.75).add(D.clone().multiplyScalar(0.35)).normalize();
  const roots = [], ends = [], dirs = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = smoothU((t - 0.4) / 0.6);
    const root = t < 0.4 ? S.clone().lerp(wrist, t / 0.4) : wrist.clone().lerp(tipP, (t - 0.4) / 0.6);
    const dir = (t < 0.4 ? Din.clone().lerp(D, t / 0.4) : D.clone()).lerp(tipDir, u).normalize();
    const L = len * (t < 0.4 ? 0.6 + 0.4 * (t / 0.4) : 1 - 0.5 * u) * (i % 2 ? 0.86 : 1);
    roots.push(root); dirs.push(dir); ends.push(root.clone().add(dir.clone().multiplyScalar(L)));
  }
  const bands = [[0, 0.42, cov, [1.06, 1.0]], [0.42, 0.78, col, [1.02, 0.95]], [0.78, 1, tip, [1, 1]]];
  for (const [f0, f1, c, gr] of bands) {
    const P = [];
    const tri = (x, y, z) => P.push(...x.toArray(), ...y.toArray(), ...z.toArray());
    for (let i = 0; i < n; i++) {
      const q = (j, f) => roots[j].clone().lerp(ends[j], f);
      const a = q(i, f0), b = q(i + 1, f0), cc = q(i + 1, f1), d = q(i, f1);
      const nrm = b.clone().sub(a).cross(d.clone().sub(a)).normalize().multiplyScalar(th);
      tri(a, d, cc); tri(a, cc, b);
      const [a2, b2, c2, d2] = [a, b, cc, d].map((v) => v.clone().add(nrm));
      tri(a2, c2, d2); tri(a2, b2, c2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    k.add(g, c, { grad: gr, noise: 0.02 });
  }
  // Round 7: layered feather rows: pointed scallops overlapping each band edge,
  // on both faces (coverts over the secondaries, secondaries over the tips)
  if (o.rows) for (const [f0, f1, c] of o.rows) {
    const P = [];
    for (let i = 0; i < n; i++) {
      const q = (j, f) => roots[j].clone().lerp(ends[j], f);
      const a = q(i, f0), b = q(i + 1, f0), m = q(i, f1).lerp(q(i + 1, f1), 0.5);
      const nrm = b.clone().sub(a).cross(m.clone().sub(a)).normalize().multiplyScalar(th);
      for (const off of [1.7, -0.7]) P.push(...[a, m, b].flatMap((v) => v.clone().addScaledVector(nrm, off).toArray()));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    k.add(g, c, { both: true, grad: [0.95, 1.05], noise: 0.02 });
  }
  // clawed fingers at the wrist (harpies' hands)
  if (o.claw) for (let j = 0; j < 3; j++) {
    const d = V3([0.1 * (j - 1), -0.55, 0.85]).normalize(), a = wrist.clone().add(V3([0, -0.01, 0.02]));
    k.ball(0.026, a.clone().addScaledVector(d, 0.03).toArray(), o.hand ?? bone, { d: 0 });
    spike(k, a.clone().addScaledVector(d, 0.03).toArray(), a.clone().addScaledVector(d, 0.1).add(V3([0, -0.03, 0])).toArray(), 0.016, o.claw, { seg: 4 });
  }
  // a few broad primaries fanning past the tip
  for (let j = 0; j < prim; j++) {
    const i = n - j * 2, r0 = roots[Math.max(0, i)].clone();
    const dir = dirs[Math.max(0, i)].clone().lerp(E, 0.25 - j * 0.05).normalize();
    k.feather(r0.toArray(), r0.clone().add(dir.multiplyScalar(len * (0.72 + j * 0.1))).toArray(), 0.1, tip, { grad: [0.95, 1.08], t: 0.02 });
  }
}


// ---------------------------------------------------------------- tubes
// parallel-transport frames along a Catmull-Rom curve through pts (N segments)
function frames(pts, N) {
  const cv = new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal');
  const P = [], T = [], Nr = [], Bn = [];
  for (let i = 0; i <= N; i++) { P.push(cv.getPointAt(i / N)); T.push(cv.getTangentAt(i / N).normalize()); }
  const n = Math.abs(T[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion();
  for (let i = 0; i <= N; i++) {
    if (i) { q.setFromUnitVectors(T[i - 1], T[i]); n.applyQuaternion(q); }
    n.sub(T[i].clone().multiplyScalar(n.dot(T[i]))).normalize();
    Nr.push(n.clone()); Bn.push(T[i].clone().cross(n).normalize());
  }
  return { P, T, N: Nr, B: Bn, n: N };
}
// a tube over rings i0..i1 of F with radius rad(t), t = 0..1 along the whole curve
function tubeGeo(F, i0, i1, rad, seg = 7, flat = 1) {
  const pos = [], idx = [];
  for (let i = i0; i <= i1; i++) {
    const r = rad(i / F.n);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const v = F.P[i].clone().addScaledVector(F.N[i], Math.cos(a) * r).addScaledVector(F.B[i], Math.sin(a) * r * flat);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < i1 - i0; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}
// a tapered tube through pts; bands = [[t0, t1, col], ...] (default one colour), cap = ball at the start
function tube(k, pts, r0, r1, col, o = {}) {
  const N = o.n ?? Math.max(6, pts.length * 3), F = frames(pts, N);
  const rad = o.rad ?? ((t) => r0 + (r1 - r0) * Math.pow(t, o.pow ?? 1));
  const bands = o.bands ?? [[0, 1, col]];
  for (const [t0, t1, c] of bands) {
    const i0 = Math.round(t0 * N), i1 = Math.round(t1 * N);
    if (i1 > i0) k.add(tubeGeo(F, i0, i1, rad, o.seg ?? 7, o.flat ?? 1), c, { grad: o.grad ?? [0.9, 1.08], ao: o.ao, noise: o.noise });
  }
  if (o.cap) k.ball(r0 * 1.0, pts[0], o.capCol ?? col, { d: 1 });
  return F;
}
// split bands: main colour with narrow accent rings (snake scales)
function stripes(t0, t1, n, main, band, w = 0.35) {
  const out = [], d = (t1 - t0) / n;
  for (let i = 0; i < n; i++) { const a = t0 + i * d; out.push([a, a + d * (1 - w), main], [a + d * (1 - w), a + d, band]); }
  return out;
}

// a bat wing for the +x side (mirror with k.sym): bony arm root -> elbow -> wrist,
// fingers fanning to tips, a double-sided membrane with a scalloped edge
function batWing(k, o) {
  const { root, elbow, wrist, tips, back, mem, bone, r = 0.05, claw, edge, vein } = o;
  k.limb(root, elbow, r, r * 0.85, bone, { seg: 7 }); k.ball(r * 0.95, elbow, bone, { d: 1 });
  k.limb(elbow, wrist, r * 0.85, r * 0.7, bone, { seg: 7 }); k.ball(r * 0.85, wrist, bone, { d: 1 });
  if (claw) {
    // hooked thumb claw with a knuckle
    k.cone(r * 0.7, r * 2.6, wrist, claw, { r: [0, 0, -0.3], seg: 5 });
    k.ball(r * 0.5, L3(wrist, root, -0.04), bone, { d: 0 });
  }
  // finger bones: two phalanges with a knuckle, and a small claw tip
  for (const t of tips) {
    const j = L3(wrist, t, 0.52);
    k.limb(wrist, j, r * 0.55, r * 0.4, bone, { seg: 6 }); k.ball(r * 0.42, j, bone, { d: 0 });
    k.limb(j, t, r * 0.4, r * 0.2, bone, { seg: 5 });
    if (claw) spike(k, t, L3(wrist, t, 1.09), r * 0.22, claw, { seg: 4 });
  }
  const anchors = [...tips, back], P = [[], []], E = [];
  const tri = (A, a, b, c) => A.push(...a, ...b, ...c);
  const f = edge ? 0.16 : 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = L3(anchors[i], wrist, 0.03), b = L3(anchors[i + 1], wrist, 0.03);
    const m = L3(L3(a, b, 0.5), wrist, i === anchors.length - 2 ? 0.12 : 0.24);
    const ai = L3(a, wrist, f), mi = L3(m, wrist, f), bi = L3(b, wrist, f);
    // alternate membrane panels slightly (reads as stretched skin between fingers)
    tri(P[i % 2], wrist, ai, mi); tri(P[i % 2], wrist, mi, bi);
    // a bright trailing-edge band (reads as the wing's outline at phone size)
    if (edge) { tri(E, a, m, mi); tri(E, a, mi, ai); tri(E, m, b, bi); tri(E, m, bi, mi); }
    // secondary veins: from near the wrist out to the scallop's inner point
    if (vein) k.limb(L3(wrist, mi, 0.22), L3(mi, wrist, 0.02), r * 0.16, r * 0.1, vein, { seg: 4 });
  }
  tri(P[1], wrist, back, elbow); tri(P[0], elbow, back, root);
  if (vein) k.limb(L3(elbow, back, 0.1), L3(back, elbow, 0.12), r * 0.16, r * 0.1, vein, { seg: 4 });
  P.forEach((A, i) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(A, 3));
    k.add(g, i ? new THREE.Color(mem).multiplyScalar(0.9) : mem, { both: true, grad: [0.86, 1.12], noise: 0.02 });
  });
  if (edge) {
    const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(E, 3));
    k.add(ge, edge, { both: true, grad: [1, 1], noise: 0.01, ao: false });
  }
}

// ---------------------------------------------------------------- detail kit (Round 7)
const sh = (c, f) => new THREE.Color(c).multiplyScalar(f);
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
// euler (YXZ) that turns local +z toward direction D
const dirR = (D) => { const d = V3(D).normalize(); return [-Math.asin(Math.max(-1, Math.min(1, d.y))), Math.atan2(d.x, d.z), 0]; };
// a cone from a to b (claws, teeth, spikes)
function spike(k, a, b, r, col, o = {}) {
  const len = Math.max(1e-4, V3(a).distanceTo(V3(b)));
  k.stick(new THREE.ConeGeometry(r, len, o.seg ?? 4).translate(0, len / 2, 0), a, b, col, o);
}
// an eye: white, coloured iris, dark (or slit) pupil and a tiny glint, facing dir
function eyeBall(k, p, r, o = {}) {
  const dir = o.dir ?? [0, 0, 1], D = V3(dir).normalize(), rr = dirR(dir), P = V3(p), sy = o.sy ?? 1;
  const at = (f, dx = 0, dy = 0) => P.clone().addScaledVector(D, f).add(V3([dx, dy, 0])).toArray();
  k.ell(r, r * sy, r * 0.62, p, o.white ?? WHITE, { d: 1, r: rr, grad: [1, 1], ao: false, glow: !!o.wglow });
  k.ell(r * 0.68, r * 0.68 * Math.min(sy, 1.1), r * 0.3, at(r * 0.42), o.iris ?? 0x8a5a2a, { d: r >= 0.03 ? 1 : 0, r: rr, grad: [1, 1], ao: false, glow: !!o.glow });
  k.ell(r * (o.slit ? 0.13 : 0.32), r * (o.slit ? 0.6 : 0.34), r * 0.2, at(r * 0.56), o.pupil ?? INK, { d: 0, r: rr, ao: false, glow: !!o.glow });
  k.ell(r * 0.13, r * 0.13, r * 0.08, at(r * 0.62, r * 0.22, r * 0.24), WHITE, { d: 0, r: rr, glow: true });
}
// rings of colour wrapped round a shaft from a to b (grip wraps, horn ridges, shin scales)
function wraps(k, a, b, r, n, col, o = {}) {
  const w = o.w ?? 0.5;
  for (let i = 0; i < n; i++) { const t0 = (i + (1 - w) / 2) / n, t1 = t0 + w / n; k.limb(L3(a, b, t0), L3(a, b, t1), r, r * (o.taper ?? 1), col, { seg: o.seg ?? 6, open: true, grad: [1, 1] }); }
}
// a fan of n claws from p toward dir (len, base radius cr), spread across x
function claws(k, p, dir, n, len, cr, col, spread = 0.035) {
  const D = V3(dir).normalize();
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * spread, a = V3(p).add(V3([x, 0, 0]));
    spike(k, a.toArray(), a.clone().addScaledVector(D, len).add(V3([x * 0.4, 0, 0])).toArray(), cr, col, { seg: 4 });
  }
}
// small flattened plates scattered on an ellipsoid (scales, chitin, spots):
// C centre, R radii, list of [lon, lat] (lon 0 = +z front, PI/2 = +x)
function platesOn(k, C, R, list, size, cols, o = {}) {
  list.forEach(([lon, lat], i) => {
    const n = V3([Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat)]);
    const nn = V3([n.x / R[0], n.y / R[1], n.z / R[2]]).normalize();
    // sunk into the surface so only a low relief shows (keeps the ink hull from
    // ringing every plate with a dark outline)
    const t = (size[2] ?? size[0] * 0.3) * (o.sink ?? 0.6);
    const p = [C[0] + n.x * R[0] * (o.f ?? 1) - nn.x * t, C[1] + n.y * R[1] * (o.f ?? 1) - nn.y * t, C[2] + n.z * R[2] * (o.f ?? 1) - nn.z * t];
    k.ell(size[0], size[1], size[2] ?? size[0] * 0.3, p, cols[i % cols.length], { d: o.d ?? 0, r: dirR(nn.toArray()), grad: [1, 1], ao: o.ao ?? true });
  });
}

// ---------------------------------------------------------------- creatures
// Troglodyte: blind lavender lizard-man, big eyeless head with a teal crest,
// teal loincloth, back spikes, thick tail, a long spear with a pale flint head.
// Infernal troglodyte: rose-crimson hide, curled gold horns, violet loincloth,
// gold torque and a bone pauldron, a spear with a glowing magenta crystal.
function troglodyte(U) {
  const k = makeKit(U ? 103 : 101);
  const SK = U ? 0xe2687e : 0x9e8ad8, SK_D = U ? 0xc04a64 : 0x7e6ac4, BELLY = U ? 0xffc8a8 : 0xe6daf6;
  const CL = U ? VIO : TEAL, CREST = U ? GOLD : TEAL_L, CLAWC = U ? GOLD_L : BONEC, STRAP = U ? VIO_D : 0x8a5a34;
  const A = [0.16, 0.04, 0.03], B = [0.56, 0.92, 0.3], P = (t) => L3(A, B, t);
  const H = figure(k, {
    legs: SK, boots: SK_D, torso: SK, hips: SK_D, upper: SK, fore: SK, hand: SK_D, rh: P(0.4), lh: [-0.25, 0.44, 0.12],
    stance: 0.12, head: false, belt: U ? GOLD : TEAL_D, armR: 0.07, foreR: 0.062, handR: 0.066, torsoGrad: [0.86, 1.1],
  });
  // belly scutes: a pale plate crossed by soft darker bands
  k.ell(0.13, 0.17, 0.06, [0, 0.55, 0.125], BELLY, { r: [-0.12, 0, 0], grad: [0.95, 1.05], d: 1 });
  for (const y of [0.45, 0.52, 0.59, 0.66]) { const w = 0.125 * Math.sqrt(1 - ((y - 0.55) / 0.175) ** 2); k.ell(w, 0.011, 0.03, [0, y, 0.165 + (y - 0.55) * 0.12], mix(BELLY, SK, 0.45), { d: 1, grad: [1, 1], ao: false }); }
  // darker hide spots on shoulders / back, scale bands on the forearms
  platesOn(k, [0, 0.6, 0], [0.2, 0.12, 0.155], [[2.5, 0.3], [3.0, 0.9], [3.5, 0.4], [2.2, 1.0], [4.0, 1.0], [3.1, -0.2], [1.3, 0.9], [-1.3, 0.9]], [0.032, 0.026, 0.012], [SK_D]);
  k.bone(BONE.ARM_R, SH, () => wraps(k, L3(H.RE, H.R, 0.2), L3(H.RE, H.R, 0.75), 0.064, 3, SK_D, { w: 0.35 }));
  k.bone(BONE.ARM_L, SHL, () => {
    wraps(k, L3(H.LE, H.L, 0.2), L3(H.LE, H.L, 0.75), 0.064, 3, SK_D, { w: 0.35 });
    // splayed claws on the free hand
    claws(k, [H.L[0], H.L[1] - 0.035, H.L[2] + 0.03], [0, -0.7, 0.75], 3, 0.075, 0.016, CLAWC, 0.03);
  });
  // claws curled round the spear shaft
  k.bone(BONE.ARM_R, SH, () => claws(k, [H.R[0] - 0.02, H.R[1] + 0.01, H.R[2] + 0.05], [-0.6, -0.2, 0.75], 3, 0.05, 0.014, CLAWC, 0.026));
  // toe claws
  k.sym(() => k.bone(BONE.LEG_FR, [0.085, 0.42, 0], () => {
    claws(k, [0.12, 0.035, 0.13], [0, -0.35, 1], 3, 0.06, 0.016, CLAWC, 0.04);
    wraps(k, [0.12, 0.12, 0.012], [0.12, 0.3, 0.018], 0.07, 2, SK_D, { w: 0.3 });
  }));
  // loincloth skirt with a darker hem, front flap with a sigil, belt buckle, pouch
  k.lathe([[0.2, 0.27], [0.175, 0.36], [0.16, 0.45]], [0, 0, 0], CL, { s: [1, 1, 0.82], seg: 12, grad: [0.85, 1.05] });
  k.lathe([[0.205, 0.265], [0.198, 0.3]], [0, 0, 0], U ? GOLD : TEAL_D, { s: [1, 1, 0.82], seg: 12, grad: [1, 1] });
  k.box(0.13, 0.2, 0.03, [0, 0.3, 0.145], CL, { r: [-0.08, 0, 0] });
  k.box(0.135, 0.03, 0.036, [0, 0.215, 0.152], U ? GOLD : TEAL_D, { r: [-0.08, 0, 0] });
  k.plate([[0, -0.045], [0.035, 0], [0, 0.045], [-0.035, 0]], 0.04, [0, 0.31, 0.16], U ? GOLD_L : VIO_L, { r: [-0.08, 0, 0] });
  k.box(0.075, 0.06, 0.026, [0, 0.47, 0.178], U ? GOLD_L : BONEC, { grad: [0.95, 1.1] });
  k.box(0.035, 0.03, 0.02, [0, 0.47, 0.19], U ? MAG : TEAL_D, {});
  k.at([0.165, 0.39, 0.06], [0, 0.95, 0], 1, () => { k.box(0.08, 0.09, 0.05, [0, 0, 0], LEATHER, {}); k.box(0.085, 0.035, 0.056, [0, 0.032, 0.002], sh(LEATHER, 0.8), {}); k.ball(0.012, [0, 0.02, 0.03], U ? GOLD : BONEC, { d: 0 }); });
  // a strap across the chest (with studs or teeth)
  const strap = [[-0.18, 0.69, 0.06], [-0.07, 0.62, 0.175], [0.06, 0.53, 0.185], [0.17, 0.45, 0.12]];
  const SF = tube(k, strap, 0.017, 0.017, STRAP, { seg: 6, n: 8 });
  for (let i = 1; i < 8; i += 2) { const p = SF.P[i]; k.ball(0.016, [p.x, p.y, p.z + 0.012], U ? GOLD_L : BONEC, { d: 0 }); }
  // back spikes, two-tone (dark base, bright tip)
  for (let i = 0; i < 3; i++) {
    k.cone(0.05 - i * 0.006, 0.15 - i * 0.02, [0, 0.66 - i * 0.1, -0.13 + i * 0.005], CREST, { r: [-1.0, 0, 0], seg: 5 });
    k.cone(0.055 - i * 0.006, 0.05, [0, 0.66 - i * 0.1, -0.13 + i * 0.005], SK_D, { r: [-1.0, 0, 0], seg: 5 });
  }
  // thick banded tail with small spikes along the top
  k.bone(BONE.TAIL, [0, 0.4, -0.1], () => {
    const F = tube(k, [[0, 0.42, -0.08], [0, 0.26, -0.26], [0.05, 0.1, -0.42], [0.16, 0.04, -0.54]], 0.085, 0.012, SK, { seg: 8, n: 12, bands: [[0, 0.15, SK]].concat(stripes(0.15, 1, 5, SK, SK_D, 0.3)) });
    for (const i of [3, 6, 9]) { const p = F.P[i], r = 0.085 - 0.073 * (i / 12); spike(k, [p.x, p.y + r * 0.7, p.z], [p.x, p.y + r * 0.7 + 0.06 - i * 0.003, p.z - 0.04], 0.022, CREST, { seg: 4 }); }
  });
  if (U) {
    // gold torque with a magenta gem and dangling rings
    k.torus(0.13, 0.03, [0, 0.705, 0.0], GOLD, { r: [Math.PI / 2 + 0.15, 0, 0], seg: 14, ts: 5 });
    k.ell(0.03, 0.036, 0.02, [0, 0.69, 0.145], G_MAG, { glow: true, d: 1 });
    k.sym(() => k.torus(0.022, 0.006, [0.07, 0.665, 0.13], GOLD_L, { seg: 8, ts: 3, r: [0.2, 0, 0] }));
    k.bone(BONE.ARM_L, SHL, () => {
      k.ell(0.12, 0.08, 0.12, [-0.21, 0.69, 0], BONEC, { r: [0, 0, 0.4], d: 1 });
      k.torus(0.1, 0.012, [-0.205, 0.67, 0], sh(BONEC, 0.8), { r: [Math.PI / 2, 0, 0.4], seg: 12, ts: 3 });
      for (let i = 0; i < 3; i++) k.cone(0.035, 0.12 - i * 0.02, [-0.26 + i * 0.055, 0.74 - i * 0.012, -0.02], BONEC, { r: [0, 0, 0.6 - i * 0.35], seg: 5 });
    });
  } else {
    // a cord necklace of fangs
    k.torus(0.125, 0.01, [0, 0.7, 0.01], 0x8a5a34, { r: [Math.PI / 2 + 0.22, 0, 0], seg: 14, ts: 3 });
    for (let i = -2; i <= 2; i++) { const a = i * 0.32, x = Math.sin(a) * 0.125, z = Math.cos(a) * 0.11 + 0.015; spike(k, [x, 0.675 - Math.abs(i) * 0.006, z], [x * 1.05, 0.625 - Math.abs(i) * 0.008, z + 0.025], 0.012, BONEC, { seg: 4 }); }
  }
  // eyeless lizard head: cranium, long snout, pale jaw, a wide mouth slit with
  // little teeth, nostrils, sealed eye seams under heavy brows (blind), spots and a
  // banded crest frill (gold ridged horns when infernal)
  k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.15, 0.13, 0.15, [0, HY, 0], SK, { grad: [0.9, 1.1] });
    k.ell(0.115, 0.085, 0.18, [0, HY - 0.035, 0.16], SK, {});
    k.ell(0.1, 0.05, 0.16, [0, HY - 0.1, 0.14], BELLY, { d: 1 });
    k.box(0.18, 0.024, 0.2, [0, HY - 0.074, 0.15], MOUTH, { ao: false, grad: [1, 1] });
    k.sym(() => {
      for (let i = 0; i < 4; i++) spike(k, [0.088 - i * 0.004, HY - 0.064, 0.12 + i * 0.04], [0.09 - i * 0.004, HY - 0.092, 0.122 + i * 0.04], 0.011, WHITE, { seg: 3 });
      spike(k, [0.04, HY - 0.07, 0.3], [0.041, HY - 0.118, 0.305], 0.014, WHITE, { seg: 4 });
      k.ell(0.016, 0.011, 0.012, [0.032, HY - 0.008, 0.322], MOUTH, { d: 0, ao: false });
      k.ell(0.055, 0.032, 0.05, [0.07, HY + 0.035, 0.115], SK_D, { d: 1, r: [0, 0, -0.25] });
      k.ell(0.032, 0.007, 0.012, [0.074, HY + 0.012, 0.15], mix(SK, WHITE, 0.55), { d: 0, r: [0, 0.3, -0.15], ao: false });
      // head spots + cheek scales
      platesOn(k, [0, HY, 0], [0.15, 0.13, 0.15], [[0.9, 0.5], [1.5, 0.1], [2.2, 0.4]], [0.024, 0.02, 0.01], [SK_D]);
    });
    for (let i = 0; i < 3; i++) {
      k.cone(0.055 - i * 0.008, 0.18 - i * 0.03, [0, HY + 0.09 - i * 0.04, -0.03 - i * 0.07], CREST, { r: [-1.15 - i * 0.2, 0, 0], seg: 5 });
      k.cone(0.06 - i * 0.008, 0.06, [0, HY + 0.09 - i * 0.04, -0.03 - i * 0.07], U ? SK_D : TEAL_D, { r: [-1.15 - i * 0.2, 0, 0], seg: 5 });
    }
    if (U) k.sym(() => tube(k, [[0.08, HY + 0.08, 0.02], [0.17, HY + 0.13, -0.02], [0.2, HY + 0.22, 0.04]], 0.04, 0.008, GOLD_L, { seg: 6, n: 9, bands: stripes(0, 0.75, 3, GOLD_L, GOLD, 0.3).concat([[0.75, 1, GOLD_L]]) }));
  });
  // spear: wood shaft with a leather grip wrap, cord bindings, feather tassels and
  // a pale flint head with a ridge (infernal: a glowing crystal in gold prongs)
  k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (L) => {
    k.limb([0, 0, 0], [0, L, 0], 0.03, 0.026, WOOD, { seg: 7, grad: [0.88, 1.1] });
    wraps(k, [0, L * 0.3, 0], [0, L * 0.52, 0], 0.034, 5, U ? VIO_D : LEATHER, { w: 0.6 });
    k.ball(0.04, [0, 0.01, 0], U ? GOLD : BONEC, { d: 1 });
    k.cyl(0.044, 0.04, 0.08, [0, L - 0.06, 0], U ? GOLD : TEAL, { seg: 8 });
    wraps(k, [0, L - 0.11, 0], [0, L - 0.07, 0], 0.036, 2, U ? GOLD_L : 0x8a5a34, { w: 0.5 });
    k.sym(() => k.feather([0.03, L - 0.09, 0.01], [0.05, L - 0.2, 0.04], 0.035, U ? MAG : 0xe84aa8, { t: 0.012 }));
    if (U) {
      k.ell(0.055, 0.17, 0.055, [0, L + 0.13, 0], G_MAG, { glow: true, d: 1 });
      k.ell(0.03, 0.09, 0.03, [0.045, L + 0.07, 0.02], G_MAG, { glow: true, d: 0, r: [0, 0, -0.5] });
      k.ell(0.075, 0.06, 0.075, [0, L, 0], GOLD, { d: 1 });
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; spike(k, [Math.sin(a) * 0.05, L + 0.02, Math.cos(a) * 0.05], [Math.sin(a) * 0.06, L + 0.14, Math.cos(a) * 0.06], 0.014, GOLD_L, { seg: 4 }); }
    } else {
      leafHead(k, [0, L - 0.02, 0], 0.3, 0.085, BONEC);
      k.limb([0, L - 0.02, 0], [0, L + 0.25, 0], 0.016, 0.004, sh(BONEC, 0.82), { seg: 4 });
    }
  }));
  return k.done();
}

// Harpy: emerald-teal feathered woman, wings for arms (violet tips), wild
// magenta hair, big yellow bird legs with hooked talons.
// Harpy hag: plum feathers with hot-magenta tips, silver wild hair, gold
// necklace, glowing red eyes, bigger wings and talons.
function harpy(U) {
  const k = makeKit(U ? 113 : 111, [0, 0.45, 0]);
  const FE = U ? 0xa244a6 : 0x2fb48c, FE_D = U ? 0x7e3088 : 0x23947a, TIP = U ? MAG : 0x8a5ae0, FE_L = mix(FE, WHITE, 0.22);
  const SKN = U ? 0xdcbce6 : 0xf4c8b4, HAIR = U ? 0xeef0ff : 0xe84aa8, HAIR_D = U ? 0xb8b4d8 : 0xb8307e, TAL = 0xf6c040, TAL_D = 0xd8962a, CLAW = U ? 0xffe8f0 : 0x7a5aa8;
  // bird legs: feathered thighs with a fringe, scaly banded shins, knuckled
  // talons with hooked claws, one back toe
  k.sym(() => k.bone(BONE.LEG_FR, [0.09, 0.42, 0], () => {
    k.ell(0.095, 0.13, 0.105, [0.1, 0.34, 0.0], FE, { grad: [0.88, 1.08], d: 2 });
    for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6; spike(k, [0.1 + Math.sin(a) * 0.075, 0.27, Math.cos(a) * 0.08], [0.1 + Math.sin(a) * 0.09, 0.2, Math.cos(a) * 0.095], 0.032, i % 2 ? FE_D : TIP, { seg: 4 }); }
    k.limb([0.11, 0.25, 0.0], [0.12, 0.06, 0.03], 0.042, 0.036, TAL);
    wraps(k, [0.11, 0.24, 0.0], [0.12, 0.08, 0.028], 0.045, 4, TAL_D, { w: 0.3, taper: 0.95 });
    const ts = U ? 1.15 : 1;
    for (const t of [-1, 0, 1]) {
      k.cone(0.032 * ts, 0.14 * ts, [0.12 + t * 0.034, 0.045, 0.04], TAL, { r: [Math.PI / 2 - 0.25, 0, -t * 0.4], seg: 5 });
      k.ball(0.026 * ts, [0.12 + t * 0.055, 0.04, 0.11 * ts], TAL_D, { d: 0 });
      k.cone(0.022 * ts, 0.07 * ts, [0.12 + t * 0.07, 0.04, 0.17 * ts], CLAW, { r: [Math.PI - 0.6, 0, -t * 0.4], seg: 4 });
    }
    k.cone(0.03, 0.11, [0.12, 0.05, 0.0], TAL, { r: [-Math.PI / 2 - 0.3, 0, 0], seg: 4 });
    k.cone(0.02, 0.06, [0.12, 0.03, -0.1], CLAW, { r: [-Math.PI / 2 - 0.9, 0, 0], seg: 4 });
  }));
  // feather skirt + a tail fan of banded feathers
  k.ell(0.16, 0.11, 0.13, [0, 0.45, 0], FE_D, {});
  for (let i = 0; i < 7; i++) { const a = -1.4 + i * 0.47; spike(k, [Math.sin(a) * 0.15, 0.42, Math.cos(a) * 0.12], [Math.sin(a) * 0.17, 0.33, Math.cos(a) * 0.14], 0.04, i % 2 ? FE : FE_D, { seg: 4 }); }
  k.bone(BONE.TAIL, [0, 0.44, -0.1], () => {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2), a = [x * 0.02, 0.44, -0.1], b = [x * 0.075, 0.3 - Math.abs(x) * 0.02, -0.38 + Math.abs(x) * 0.03];
      k.feather(a, b, 0.1, i % 2 ? FE_D : FE, { t: 0.02 });
      k.feather(L3(a, b, 0.62), L3(a, b, 1.04), 0.085, TIP, { t: 0.026 });
    }
  });
  // feathered body with rows of scalloped feathers, skin shoulders / neck, a
  // two-layer ruff of tip-coloured feathers
  k.lathe([[0.135, 0.4], [0.155, 0.48], [0.18, 0.56], [0.19, 0.63], [0.17, 0.69], [0.1, 0.73], [0.03, 0.745]], [0, 0, 0], FE, { s: [1, 1, 0.78], seg: 12, grad: [0.84, 1.1] });
  const rows = [];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) rows.push([-1.35 + (i + (r % 2) * 0.5) * 0.42, -0.55 + r * 0.32]);
  platesOn(k, [0, 0.53, 0], [0.17, 0.13, 0.135], rows, [0.035, 0.03, 0.012], [FE_L, FE, FE_D], { f: 1.0 });
  k.lathe([[0.165, 0.6], [0.2, 0.64], [0.19, 0.69], [0.11, 0.73], [0.04, 0.745]], [0, 0, 0.005], SKN, { s: [1, 1, 0.8], seg: 12, grad: [0.92, 1.05] });
  for (let i = 0; i < 6; i++) { const a = -1.1 + (i / 5) * 2.2; k.cone(0.05, 0.1, [Math.sin(a) * 0.17, 0.6, Math.cos(a) * 0.13], TIP, { r: [Math.PI - 0.5, a, 0], seg: 5 }); }
  for (let i = 0; i < 5; i++) { const a = -0.88 + (i / 4) * 1.76; k.cone(0.042, 0.08, [Math.sin(a) * 0.18, 0.575, Math.cos(a) * 0.14], FE_D, { r: [Math.PI - 0.6, a, 0], seg: 4 }); }
  if (U) {
    // gold necklace with a glowing pendant and two bone charms
    k.torus(0.12, 0.024, [0, 0.69, 0.02], GOLD, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 14, ts: 4 });
    k.ell(0.026, 0.034, 0.016, [0, 0.645, 0.145], G_MAG, { glow: true, d: 1 });
    k.torus(0.03, 0.007, [0, 0.645, 0.14], GOLD_L, { seg: 10, ts: 3, r: [0.25, 0, 0] });
    k.sym(() => spike(k, [0.06, 0.67, 0.12], [0.07, 0.625, 0.135], 0.012, BONEC, { seg: 4 }));
  } else {
    k.torus(0.115, 0.01, [0, 0.69, 0.02], TEAL_D, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 14, ts: 3 });
    k.feather([0, 0.67, 0.14], [0.015, 0.6, 0.16], 0.03, TIP, { t: 0.01 });
  }
  // head: face with real eyes, nose, lips, fierce brows, earrings, a headband and
  // a big mane of wild hair in two tones, locks framing the face
  k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.125, 0.13, 0.12, [0, HY, 0.02], SKN, { grad: [0.95, 1.05] });
    k.sym(() => {
      eyeBall(k, [0.048, HY + 0.008, 0.118], 0.026, U ? { iris: G_RED, glow: true, white: 0xfff0c8, slit: true } : { iris: 0xe8a020 });
      k.box(0.07, 0.022, 0.03, [0.05, HY + 0.045, 0.125], U ? 0x9a8ab8 : 0xa83a7a, { r: [0, 0, -0.35] });
      k.ell(0.022, 0.012, 0.01, [0.068, HY - 0.035, 0.122], mix(SKN, MAG, 0.25), { d: 0, ao: false });
      k.torus(0.016, 0.005, [0.12, HY - 0.045, 0.02], GOLD, { seg: 8, ts: 3, r: [0, Math.PI / 2, 0] });
    });
    k.ell(0.014, 0.022, 0.02, [0, HY - 0.012, 0.142], sh(SKN, 0.92), { d: 0 });
    k.ell(0.036, 0.011, 0.014, [0, HY - 0.055, 0.128], U ? 0x8a3a6a : 0xd04a6a, { d: 0, ao: false });
    if (U) k.sym(() => spike(k, [0.018, HY - 0.055, 0.135], [0.02, HY - 0.078, 0.137], 0.007, WHITE, { seg: 3 }));
    k.ell(0.145, 0.15, 0.13, [0, HY + 0.06, -0.07], HAIR, { grad: [0.88, 1.12] });
    k.torus(0.128, 0.012, [0, HY + 0.07, -0.01], U ? GOLD : TEAL, { r: [Math.PI / 2 + 0.5, 0, 0], seg: 14, ts: 3 });
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.45;
      k.cone(0.065, 0.24, [Math.sin(a) * 0.08, HY + 0.09, -0.08], i % 2 ? HAIR_D : HAIR, { r: [-2.0 + Math.abs(i - 2) * 0.15, 0, a * 0.9], seg: 5 });
    }
    for (let i = 0; i < 4; i++) { const a = (i - 1.5) * 0.55; k.cone(0.045, 0.2, [Math.sin(a) * 0.1, HY + 0.02, -0.11], i % 2 ? HAIR : HAIR_D, { r: [-2.35, 0, a * 0.8], seg: 4 }); }
    k.sym(() => k.cone(0.035, 0.15, [0.105, HY + 0.03, 0.05], HAIR, { r: [Math.PI - 0.15, 0, -0.25], seg: 4 }));
    k.feather([-0.07, HY + 0.1, 0.0], [-0.17, HY + 0.24, -0.05], 0.05, TIP, { t: 0.012 });
  });
  // wings for arms (shoulder -> wrist -> tip), raised in a V, with layered feather
  // rows and clawed fingers at the wrist
  k.sym(() => k.bone(BONE.WING_R, [0.16, 0.64, -0.02], () => wing(k, [0.16, 0.64, -0.02], {
    W: [0.2, 0.24, 0.0], T: U ? [0.46, 0.6, -0.16] : [0.42, 0.55, -0.14], len: U ? 0.42 : 0.38, drop: [0.15, -0.3, -1], dropIn: [0.05, -1, -0.3],
    n: 8, col: FE, tip: TIP, cov: FE_D, bone: SKN, prim: 3, th: 0.018,
    rows: [[0.02, 0.5, FE_L], [0.42, 0.86, mix(FE, TIP, 0.35)]], claw: CLAW, hand: SKN,
  })));
  return k.done();
}

// Beholder: a floating magenta-violet orb with one huge white eye (glowing teal
// iris), a heavy lid, a wide toothy grin, six eye-stalks fanning up, three
// short tendrils hanging below.
// Evil eye: hotter crimson-violet, red iris, gold horn spikes, eight stalks.
function beholder(U) {
  const C = [0, 0.56, 0];
  const k = makeKit(U ? 127 : 121, C);
  const BOD = U ? 0xc8449c : 0xb460d8, LID = U ? 0x9a2c86 : 0x8a42b8, SCL = 0xfbf6ff, IRIS = U ? G_RED : G_TEAL, PUP = 0x3a1650;
  const IRIS_D = U ? 0xc8202a : 0x18a0b0, PLATE = U ? 0xa83486 : 0x9a4ec4, PLATE_L = U ? 0xe068b0 : 0xc888ee, VEIN = 0xe8607a;
  const R = 0.35;
  // the orb as a fine lathe (smooth silhouette for fewer triangles than a subdivided icosphere)
  const orb = []; for (let i = 0; i <= 12; i++) { const th = (i / 12) * Math.PI; orb.push([R * Math.sin(th), -R * 0.96 * Math.cos(th)]); }
  k.lathe(orb, C, BOD, { seg: 20, s: [1, 1, 0.95], grad: [0.78, 1.12] });
  // belly paler (value band)
  k.ell(R * 0.8, R * 0.5, R * 0.8, [0, C[1] - 0.12, 0.02], U ? 0xe27ab8 : 0xd292ec, { d: 2 });
  // chitin plates over the crown and back, in two tones (scale pattern), and
  // pale warts on the flanks
  const plates = [];
  for (const [lat, n, o] of [[1.25, 5, 0], [0.82, 8, 0.3], [0.38, 10, 0], [-0.02, 7, 0.5]]) for (let i = 0; i < n; i++) {
    const lon = Math.PI + ((i + o) / n - 0.5) * (lat > 1 ? 6.28 : 4.2);
    if (Math.cos(lon) > 0.35 && lat < 1.1) continue; // keep the face clear
    plates.push([lon, lat]);
  }
  platesOn(k, C, [R, R * 0.96, R * 0.95], plates, [0.085, 0.07, 0.03], [PLATE, PLATE_L], { f: 0.99, d: 0 });
  if (!U) platesOn(k, C, [R, R * 0.96, R * 0.95], [[1.5, -0.15], [-1.5, -0.15], [1.2, -0.55], [-1.2, -0.55], [2.3, -0.4], [-2.3, -0.4]], [0.025, 0.025, 0.014], [PLATE_L], { f: 1.0 });
  // the great eye: lid socket, sclera with red veins, two-tone iris, pupil, glint
  k.ell(0.21, 0.19, 0.1, [0, 0.61, 0.26], LID, { d: 1 });
  k.ell(0.175, 0.16, 0.09, [0, 0.6, 0.3], SCL, { d: 2, grad: [0.95, 1.05], ao: false });
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.3, pt = (u, w = 0) => { const x = Math.cos(a + w) * 0.175 * u, y = Math.sin(a + w) * 0.16 * u; return [x, 0.6 + y, 0.3 + 0.09 * Math.sqrt(Math.max(0, 1 - u * u)) + 0.004]; };
    tube(k, [pt(0.97), pt(0.82, 0.08), pt(0.66, -0.04)], 0.006, 0.003, VEIN, { seg: 3, n: 4, ao: false, grad: [1, 1] });
  }
  k.ell(0.105, 0.105, 0.03, [0, 0.6, 0.376], IRIS_D, { glow: true, d: 1 });
  k.ell(0.078, 0.078, 0.03, [0, 0.6, 0.383], IRIS, { glow: true, d: 1 });
  k.ell(0.032, 0.07, 0.02, [0, 0.6, 0.4], PUP, { glow: true, d: 1 });
  k.ell(0.02, 0.02, 0.01, [0.035, 0.635, 0.405], WHITE, { glow: true, d: 0 });
  // heavy angry upper lid with a pale rim, angled brow plates, a thin lower lid
  k.ell(0.21, 0.075, 0.12, [0, 0.745, 0.25], LID, { r: [0.35, 0, 0], d: 1 });
  k.ell(0.2, 0.022, 0.05, [0, 0.705, 0.335], PLATE_L, { r: [0.35, 0, 0], d: 1 });
  k.sym(() => k.ell(0.1, 0.03, 0.07, [0.1, 0.8, 0.25], PLATE, { r: [0.3, -0.2, -0.38], d: 1 }));
  k.ell(0.16, 0.026, 0.07, [0, 0.462, 0.32], LID, { r: [-0.3, 0, 0], d: 1 });
  // wide grin: dark mouth band with lips, a tongue, teeth top and bottom
  k.ell(0.24, 0.065, 0.1, [0, 0.39, 0.22], MOUTH, { r: [-0.25, 0, 0], ao: false, d: 1 });
  k.ell(0.25, 0.022, 0.08, [0, 0.435, 0.245], LID, { r: [-0.25, 0, 0], d: 1 });
  k.ell(0.1, 0.03, 0.07, [0.03, 0.37, 0.28], 0xf0709a, { r: [-0.4, 0.2, 0], d: 1 });
  const nT = U ? 9 : 7;
  for (let i = 0; i < nT; i++) {
    const a = (i / (nT - 1) - 0.5) * 1.5, x = Math.sin(a) * 0.23, z = Math.cos(a) * 0.29 - 0.03;
    k.cone(0.03, U ? 0.08 : 0.065, [x, 0.43, z], BONEC, { r: [Math.PI, 0, 0], seg: 5 });
    if (i % 2) k.cone(0.026, 0.05, [x, 0.35, z - 0.01], BONEC, { seg: 4 });
    else if (i > 0 && i < nT - 1) k.cone(0.018, 0.032, [x, 0.355, z - 0.01], BONEC, { seg: 4 });
  }
  // eye-stalks: each its own HEAD bone pivoting at its root on the orb; banded
  // stalks, little eyes with an iris, pupil and lid
  const nS = U ? 8 : 6;
  for (let i = 0; i < nS; i++) {
    const a = (i / (nS - 1) - 0.5) * (U ? 3.4 : 3.0);
    const dir = V3([Math.sin(a) * 0.62, 0.78, Math.cos(a) * 0.35 - 0.38]).normalize();
    const base = V3(C).addScaledVector(dir, R * 0.9);
    const out = V3([Math.sin(a), 0, Math.cos(a) * 0.5 - 0.2]).normalize();
    const len = 0.26 + (i % 2) * 0.06;
    const p1 = base.clone().addScaledVector(dir, len * 0.5).add(V3([0, 0.04, 0]));
    const tip = base.clone().addScaledVector(dir, len * 0.75).addScaledVector(out, 0.08).add(V3([0, 0.1, 0.06]));
    k.bone(BONE.HEAD, base.toArray(), () => {
      k.ell(0.05, 0.02, 0.05, base.clone().addScaledVector(dir, 0.01).toArray(), U ? GOLD : LID, { d: 0, r: dirR(dir.toArray()).map((v, j) => j === 0 ? v + Math.PI / 2 : v) });
      tube(k, [base.toArray(), p1.toArray(), tip.toArray()], 0.035, 0.026, BOD, { seg: 6, n: 6, bands: stripes(0, 0.9, 3, BOD, LID, 0.3).concat([[0.9, 1, BOD]]) });
      k.ball(0.058, tip.toArray(), SCL, { d: 1, ao: false });
      const fw = V3([out.x * 0.5, 0.1, 1]).normalize();
      k.ell(0.034, 0.034, 0.016, tip.clone().addScaledVector(fw, 0.046).toArray(), IRIS, { glow: true, d: 0, r: dirR(fw.toArray()) });
      k.ell(0.012, 0.024, 0.01, tip.clone().addScaledVector(fw, 0.058).toArray(), PUP, { glow: true, d: 0, r: dirR(fw.toArray()) });
      k.ell(0.066, 0.03, 0.066, tip.clone().add(V3([0, 0.035, -0.01])).toArray(), LID, { d: 0 });
      if (U) k.torus(0.03, 0.009, p1.toArray(), GOLD_L, { r: dirR(dir.toArray()), seg: 6, ts: 3 });
    });
  }
  if (U) for (let i = 0; i < 5; i++) { // ridged gold horn spikes around the back and sides
    const a = Math.PI * 0.5 + (i / 4) * Math.PI;
    const b = [Math.sin(a) * R * 0.92, 0.6 + (i % 2) * 0.06, Math.cos(a) * R * 0.92], o = [Math.sin(a), 0.25, Math.cos(a)];
    k.cone(0.05, 0.16, b, GOLD, { r: [Math.cos(a) * 1.3, 0, -Math.sin(a) * 1.3], seg: 6 });
    k.cone(0.06, 0.04, L3(b, C, 0.03), sh(GOLD, 0.82), { r: [Math.cos(a) * 1.3, 0, -Math.sin(a) * 1.3], seg: 6 });
  }
  if (U) {
    k.sym(() => k.cone(0.045, 0.14, [0.17, 0.76, 0.22], GOLD_L, { r: [0.4, 0, -0.7], seg: 5 }));
    // a glowing rune on the brow
    k.plate([[0, -0.04], [0.028, 0], [0, 0.04], [-0.028, 0]], 0.02, [0, 0.83, 0.3], G_GOLD, { glow: true, r: [-0.6, 0, 0] });
  }
  // tendrils hanging below (TAIL), reaching the ground, banded with sucker bulbs
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.9, x = Math.sin(a) * 0.12, z = Math.cos(a) * 0.08 - 0.06;
    k.bone(BONE.TAIL, [x, 0.27, z], () => {
      tube(k, [[x, 0.3, z], [x * 1.4, 0.16, z + 0.02], [x * 1.2 + 0.03, 0.02, z + 0.08]], 0.05, 0.012, LID, { seg: 7, n: 8, bands: stripes(0, 1, 3, LID, PLATE_L, 0.25) });
    });
  }
  return k.done();
}

// Medusa: a striped green-and-gold snake coil (BODY, tail on TAIL), a pale green
// woman with a violet top, a crown of green snakes with magenta heads, glowing
// petrifying eyes, a bow and nocked arrow.
// Medusa queen: teal coil with gold rings, gold breastplate, crown and bow,
// longer snake hair with gold heads.
function medusa(U) {
  const k = makeKit(U ? 139 : 137, [0, 0.25, 0]);
  const SC = U ? 0x22a8a0 : 0x3cb46a, BAND = U ? GOLD_L : 0xf2dc6a, SKN = U ? 0xb0ead8 : 0xa8e2b0, TOP = U ? GOLD : VIO;
  const SNK = U ? 0x2cb8a8 : 0x46b84a, SNK_D = U ? 0x1a8a84 : 0x2e8a3a, SNH = U ? GOLD : MAG, SC_D = sh(SC, 0.78), TRIM = U ? TEAL : GOLD;
  // coil: from the hips down and around, the tail curling up at the front-right;
  // banded, with a row of diamond scales along the spine and darker side scales
  const coil = [[0, 0.46, 0.0], [0, 0.3, 0.04], [0.12, 0.15, 0.13], [0.25, 0.09, 0.0], [0.18, 0.085, -0.19], [-0.02, 0.085, -0.25], [-0.21, 0.085, -0.14], [-0.24, 0.08, 0.06], [-0.09, 0.07, 0.21]];
  const tail = [[-0.09, 0.07, 0.21], [0.08, 0.06, 0.27], [0.24, 0.08, 0.22], [0.31, 0.17, 0.12], [0.3, 0.26, 0.04]];
  const crad = (t) => 0.14 - 0.06 * t;
  const CF = tube(k, coil, 0.135, 0.075, SC, { n: 28, seg: 10, bands: stripes(0.08, 1, 7, SC, BAND), rad: crad, cap: false });
  const onTube = (F, i, r, up = 0.92, side = 0) => {
    const T = F.T[i], u = V3([0, 1, 0]).sub(T.clone().multiplyScalar(T.y)).normalize(), sd = T.clone().cross(u).normalize();
    const n = u.clone().multiplyScalar(Math.cos(side)).addScaledVector(sd, Math.sin(side));
    return { p: F.P[i].clone().addScaledVector(n, r * up), n };
  };
  for (let i = 3; i < 28; i += 2) {
    const r = crad(i / 28), { p, n } = onTube(CF, i, r);
    k.ell(r * 0.42, r * 0.42, r * 0.16, p.toArray(), i % 4 === 1 ? BAND : SC_D, { d: 0, r: dirR(n.toArray()), grad: [1, 1] });
  }
  k.ell(0.13, 0.1, 0.13, [0, 0.44, 0], SC, { d: 1 });
  k.bone(BONE.TAIL, tail[0], () => {
    const F = tube(k, tail, 0.08, 0.01, SC, { n: 16, seg: 8, bands: stripes(0, 0.85, 4, SC, BAND).concat([[0.85, 1, BAND]]), rad: (t) => 0.08 * (1 - t) + 0.008 });
    // a little rattle / fin of scales at the tip
    for (let j = 0; j < 3; j++) { const p = F.P[12 + j]; k.ell(0.03 - j * 0.006, 0.02, 0.03 - j * 0.006, [p.x, p.y, p.z], j % 2 ? BAND : SC_D, { d: 0 }); }
    spike(k, F.P[15].toArray(), F.P[16].clone().add(F.T[16].clone().multiplyScalar(0.05)).toArray(), 0.016, BAND, { seg: 4 });
  });
  // torso + arms, bow pose like an archer; bracers on the forearms
  const bowP = [-0.27, 0.6, 0.2], draw = [0.02, 0.64, 0.1];
  const H = figure(k, { robe: true, torso: SKN, hips: SC, upper: SKN, fore: SKN, hand: SKN, rh: draw, lh: bowP, head: false, armR: 0.058, foreR: 0.052, handR: 0.054 });
  k.bone(BONE.ARM_R, SH, () => { k.limb(L3(H.RE, H.R, 0.45), L3(H.RE, H.R, 0.8), 0.06, 0.056, TRIM, { seg: 8 }); wraps(k, L3(H.RE, H.R, 0.45), L3(H.RE, H.R, 0.8), 0.062, 2, TOP, { w: 0.25 }); });
  k.bone(BONE.ARM_L, SHL, () => { k.limb(L3(H.LE, H.L, 0.45), L3(H.LE, H.L, 0.8), 0.06, 0.056, TRIM, { seg: 8 }); wraps(k, L3(H.LE, H.L, 0.45), L3(H.LE, H.L, 0.8), 0.062, 2, TOP, { w: 0.25 }); });
  // scaled hips blending into the coil (green scales over pale skin)
  if (!U) platesOn(k, [0, 0.45, 0], [0.155, 0.08, 0.12], [[0, 0.6], [0.7, 0.6], [-0.7, 0.6], [1.4, 0.6], [-1.4, 0.6], [0.35, 1.0], [-0.35, 1.0]], [0.035, 0.028, 0.012], [SC, SC_D]);
  // top with trims, a brooch and shoulder straps
  k.lathe([[0.17, 0.55], [0.19, 0.6], [0.2, 0.64], [0.16, 0.67]], [0, 0, 0.01], TOP, { s: [1, 1, 0.82], seg: 12, grad: [0.9, 1.08] });
  k.lathe([[0.173, 0.54], [0.18, 0.565]], [0, 0, 0.01], TRIM, { s: [1, 1, 0.84], seg: 12, grad: [1, 1] });
  k.lathe([[0.2, 0.635], [0.17, 0.67], [0.15, 0.675]], [0, 0, 0.012], TRIM, { s: [1, 1, 0.84], seg: 12, grad: [1, 1] });
  k.ell(0.03, 0.03, 0.016, [0, 0.635, 0.178], U ? G_TEAL : MAG_L, { d: 1, glow: !!U });
  k.torus(0.034, 0.008, [0, 0.635, 0.172], GOLD, { seg: 10, ts: 3 });
  k.sym(() => tube(k, [[0.1, 0.665, 0.1], [0.14, 0.72, 0.02], [0.11, 0.68, -0.1]], 0.012, 0.012, TRIM, { seg: 5, n: 5 }));
  if (U) {
    k.lathe([[0.165, 0.43], [0.16, 0.49]], [0, 0, 0], GOLD, { s: [1, 1, 0.82], seg: 12, grad: [1, 1] });
    k.torus(0.12, 0.022, [0, 0.705, 0.02], GOLD, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 14, ts: 4 });
    // scale-pattern breastplate
    const rows = []; for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) rows.push([-0.9 + (i + (r % 2) * 0.5) * 0.4, -0.3 + r * 0.35]);
    platesOn(k, [0, 0.61, 0.01], [0.2, 0.06, 0.165], rows, [0.03, 0.025, 0.01], [GOLD_L, sh(GOLD, 0.85)]);
  } else k.torus(0.115, 0.01, [0, 0.7, 0.02], GOLD, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 14, ts: 3 });
  // quiver on the back with fletched arrows
  k.at([0.02, 0.6, -0.16], [0.15, 0, 0.55], 1, () => {
    k.cyl(0.05, 0.055, 0.32, [0, -0.17, 0], U ? GOLD : LEATHER, { seg: 8 });
    k.cyl(0.058, 0.058, 0.03, [0, 0.12, 0], TRIM, { seg: 8 });
    k.cyl(0.058, 0.058, 0.025, [0, -0.15, 0], TRIM, { seg: 8 });
    for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.025; k.limb([x, 0.1, 0], [x, 0.2, 0], 0.007, 0.007, CREAM, { seg: 3 }); k.feather([x, 0.17, 0], [x, 0.24, 0], 0.03, U ? MAG : TEAL_L, { t: 0.01 }); }
  });
  // head: glowing eyes with dark lids, brows, nose, painted lips, gold earrings and
  // a crown of banded snakes with eyes and forked tongues (all HEAD)
  k.bone(BONE.HEAD, NECK, () => {
    k.ell(HR * 1.02, HR * 1.06, HR, [0, HY, 0.01], SKN, { grad: [0.95, 1.05] });
    k.sym(() => {
      k.ell(0.034, 0.024, 0.014, [0.05, HY + 0.005, 0.122], sh(SNK_D, 0.9), { d: 0 });
      k.ell(0.026, 0.018, 0.012, [0.05, HY + 0.005, 0.128], U ? G_MAG : G_GOLD, { glow: true, d: 1 });
      k.ell(0.006, 0.016, 0.006, [0.05, HY + 0.005, 0.138], 0x3a1650, { glow: true, d: 0 });
      k.box(0.06, 0.016, 0.02, [0.05, HY + 0.04, 0.124], SNK_D, { r: [0, 0, -0.3] });
      k.torus(0.016, 0.005, [0.128, HY - 0.05, 0.01], GOLD, { seg: 8, ts: 3, r: [0, Math.PI / 2, 0] });
      k.ball(0.011, [0.128, HY - 0.072, 0.01], U ? G_TEAL : MAG, { d: 0, glow: !!U });
    });
    k.ell(0.013, 0.024, 0.018, [0, HY - 0.02, 0.138], sh(SKN, 0.9), { d: 0 });
    k.ell(0.034, 0.012, 0.012, [0, HY - 0.058, 0.124], U ? 0x9a3a8a : 0xb43a7a, { d: 0, ao: false });
    k.ell(0.14, 0.12, 0.13, [0, HY + 0.05, -0.02], SNK, {});
    const nH = U ? 9 : 8;
    for (let i = 0; i < nH; i++) {
      const a = (i / nH) * Math.PI * 2 + 0.35, sx = Math.sin(a), cz = Math.cos(a);
      if (cz > 0.75) continue; // keep the face clear
      const b = [sx * 0.1, HY + 0.08, cz * 0.09 - 0.02];
      const m = [sx * 0.22, HY + 0.16 + (i % 2) * 0.05, cz * 0.18 - 0.05];
      const t = [sx * (U ? 0.3 : 0.27), HY + 0.12 + (i % 2) * 0.1, cz * 0.22 - 0.02 + 0.06];
      const F = tube(k, [b, m, t], 0.034, 0.026, SNK, { seg: 5, n: 6, bands: stripes(0, 1, 2, SNK, SNK_D, 0.35) });
      // snake head facing out along the curve's end, with eyes and a red tongue
      const D = F.T[6].clone(), Dr = dirR(D.toArray());
      k.ell(0.034, 0.03, 0.058, t, SNH, { d: 0, r: Dr });
      const side = V3([0, 1, 0]).cross(D).normalize();
      for (const sd of [-1, 1]) k.box(0.014, 0.012, 0.014, V3(t).addScaledVector(D, 0.025).addScaledVector(side, sd * 0.024).add(V3([0, 0.012, 0])).toArray(), U ? G_RED : G_LIME, { glow: true, r: Dr });
      const tg = V3(t).addScaledVector(D, 0.055).add(V3([0, -0.01, 0]));
      k.limb(tg.toArray(), tg.clone().addScaledVector(D, 0.035).toArray(), 0.005, 0.004, 0xe83a5a, { seg: 3 });
    }
    if (U) for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 1.6, hgt = 0.11 - Math.abs(i - 2) * 0.015, p = [Math.sin(a) * 0.12, HY + 0.12, Math.cos(a) * 0.08 + 0.02];
      k.cone(0.03, hgt, p, GOLD_L, { seg: 5 });
      if (i % 2 === 0) k.ball(0.014, [p[0], p[1] + hgt * 0.35, p[2] + 0.02], G_TEAL, { glow: true, d: 0 });
    }
    if (U) k.torus(0.125, 0.014, [0, HY + 0.11, 0.0], GOLD, { r: [Math.PI / 2 - 0.2, 0, 0], seg: 14, ts: 3 });
  });
  // bow (ARM_L) with a wrapped grip and curled tips, and a fletched arrow (ARM_R)
  const bowH = U ? 0.45 : 0.41, bend = 0.12, pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 4 - 1; pts.push([bowP[0], bowP[1] + t * bowH, bowP[2] + 0.02 - t * t * bend + (U ? Math.pow(Math.abs(t), 5) * 0.09 : 0)]); }
  const R = [draw[0], draw[1], draw[2] - 0.02];
  k.bone(BONE.ARM_L, SHL, () => {
    for (let i = 0; i < 8; i++) {
      const r = 0.034 - Math.abs(i - 3.5) * 0.0028, c = i === 3 || i === 4 ? (U ? VIO : GOLD) : (U ? GOLD : 0xc0884a);
      k.limb(pts[i], pts[i + 1], r, r, c, { seg: 6 });
    }
    wraps(k, pts[3], pts[5], 0.037, 4, U ? GOLD_L : LEATHER, { w: 0.45 });
    for (const j of [0, 8]) { k.ball(0.03, pts[j], U ? GOLD_L : TEAL, { d: 1 }); spike(k, pts[j], L3(pts[j], j ? pts[7] : pts[1], -0.55).map((v, q) => q === 2 ? v + 0.04 : v), 0.018, U ? GOLD_L : TEAL, { seg: 4 }); }
    k.limb(pts[8], R, 0.008, 0.008, CREAM, { seg: 3 });
    k.limb(pts[0], R, 0.008, 0.008, CREAM, { seg: 3 });
  });
  const tipA = [bowP[0] + 0.01, bowP[1] + 0.02, bowP[2] + 0.2];
  k.bone(BONE.ARM_R, SH, () => {
    k.limb(R, tipA, 0.014, 0.014, CREAM, { seg: 4 });
    const dA = V3(tipA).sub(V3(R)).normalize();
    k.stick(new THREE.ConeGeometry(0.034, 0.1, 4).translate(0, 0.05, 0), tipA, V3(tipA).add(dA).toArray(), U ? G_MAG : TEAL_L, { glow: U });
    // fletching: three vanes near the nock
    for (let j = 0; j < 3; j++) k.feather(V3(R).addScaledVector(dA, 0.02).toArray(), V3(R).addScaledVector(dA, 0.11).toArray(), 0.035, j ? (U ? MAG : TEAL) : WHITE, { t: 0.008, roll: j * 2.09 });
  });
  return k.done();
}

// Minotaur: huge chestnut bull-man, big cream horns, gold nose ring, violet
// loincloth with gold belt, a giant double axe raised in the right hand.
// Minotaur king: gold breastplate and pauldrons, gold-tipped horns, violet cape,
// glowing eyes, a gold-bladed axe with a teal rune gem.
function minotaur(U) {
  const S = 1.1;
  const k = makeKit(U ? 151 : 149, [0, 0.42 * S, 0]);
  const FUR = U ? 0xc06a36 : 0xb8683c, FUR_D = U ? 0x9a5030 : 0x94522e, CHEST = U ? 0xe0925a : 0xd8905e, MUZ = 0xe8b088, HORN = 0xf6ead0, HORN_D = 0xd8c49a, HOOF = 0x7a6a90, CL = VIO;
  const BRC = U ? GOLD : LEATHER, STUD = U ? GOLD_L : STEEL;
  let H;
  k.at([0, 0, 0], [0, 0, 0], S, () => {
    H = figure(k, {
      legs: FUR_D, boots: HOOF, torso: FUR, hips: CL, upper: FUR, fore: FUR, hand: FUR_D, rh: [0.29, 0.52, 0.16], lh: [-0.27, 0.42, 0.12],
      head: false, belt: GOLD, armR: 0.08, foreR: 0.07, handR: 0.072, pauldron: U ? GOLD : null, pTrim: U ? GOLD_L : null, stance: 0.12,
    });
    // hooves: a cloven split and a shaggy fetlock tuft
    k.sym(() => k.bone(BONE.LEG_FR, [0.085, 0.42, 0], () => {
      k.box(0.012, 0.06, 0.06, [0.12, 0.04, 0.12], 0x4e3e6e, { ao: false });
      for (let i = 0; i < 5; i++) { const a = -1.4 + i * 0.7; spike(k, [0.12 + Math.sin(a) * 0.06, 0.13, 0.03 + Math.cos(a) * 0.06], [0.12 + Math.sin(a) * 0.075, 0.075, 0.03 + Math.cos(a) * 0.08], 0.026, FUR_D, { seg: 4 }); }
      k.box(0.11, 0.035, 0.07, [0.12, 0.22, 0.06], BRC, { r: [0.15, 0, 0] });
    }));
    // leather (or gold) bracers with studs on both forearms
    const bracer = (E, Hd) => { k.limb(L3(E, Hd, 0.35), L3(E, Hd, 0.82), 0.082, 0.076, BRC, { seg: 8 }); for (let i = 0; i < 3; i++) { const p = L3(E, Hd, 0.45 + i * 0.15); k.ball(0.016, [p[0], p[1] + 0.02, p[2] + 0.07], STUD, { d: 0 }); } };
    k.bone(BONE.ARM_R, SH, () => bracer(H.RE, H.R));
    k.bone(BONE.ARM_L, SHL, () => bracer(H.LE, H.L));
    // chest muscles + abs and a fur V (or the king's segmented gold breastplate)
    if (U) {
      k.lathe([[0.17, 0.5], [0.2, 0.57], [0.215, 0.63], [0.2, 0.69], [0.12, 0.73]], [0, 0, 0.005], GOLD, { s: [1, 1, 0.8], seg: 12, grad: [0.86, 1.14] });
      for (const y of [0.565, 0.625]) k.lathe([[0.205 + (y - 0.565) * 0.15, y], [0.214 + (y - 0.565) * 0.05, y + 0.016]], [0, 0, 0.006], GOLD_L, { s: [1, 1, 0.81], seg: 12, phi: -1.2, len: 2.4, grad: [1, 1] });
      k.ell(0.04, 0.04, 0.02, [0, 0.64, 0.172], G_TEAL, { glow: true, d: 1 });
      k.torus(0.045, 0.01, [0, 0.64, 0.168], GOLD_L, { seg: 12, ts: 3 });
      k.sym(() => { for (let i = 0; i < 3; i++) k.ball(0.012, [0.07 + i * 0.045, 0.69 - i * 0.03, 0.115 - i * 0.02], GOLD_L, { d: 0 }); });
    } else {
      k.sym(() => k.ell(0.1, 0.085, 0.06, [0.08, 0.6, 0.125], CHEST, { d: 1 }));
      k.sym(() => { for (let i = 0; i < 2; i++) k.ell(0.042, 0.03, 0.025, [0.04, 0.51 - i * 0.055, 0.15], mix(FUR, CHEST, 0.6), { d: 0 }); });
      for (let i = 0; i < 3; i++) spike(k, [0, 0.69 - i * 0.03, 0.12], [0, 0.65 - i * 0.04, 0.145], 0.03 - i * 0.005, FUR_D, { seg: 4 });
    }
    // shoulder / neck mane of shaggy fur tufts
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i - 3) * 0.42; spike(k, [Math.sin(a) * 0.14, 0.72, Math.cos(a) * 0.1], [Math.sin(a) * 0.2, 0.64 - Math.abs(i - 3) * 0.015, Math.cos(a) * 0.17], 0.04, i % 2 ? FUR_D : FUR, { seg: 4 }); }
    // loincloth skirt with an embroidered hem, front flap with a sigil
    k.lathe([[0.215, 0.26], [0.18, 0.36], [0.16, 0.45]], [0, 0, 0], CL, { s: [1, 1, 0.82], seg: 12, grad: [0.85, 1.05] });
    k.lathe([[0.22, 0.255], [0.212, 0.29]], [0, 0, 0], GOLD, { s: [1, 1, 0.82], seg: 12, grad: [1, 1] });
    k.lathe([[0.2, 0.31], [0.196, 0.325]], [0, 0, 0], VIO_L, { s: [1, 1, 0.82], seg: 12, grad: [1, 1] });
    k.box(0.15, 0.22, 0.03, [0, 0.3, 0.15], U ? GOLD : VIO_L, { r: [-0.08, 0, 0] });
    k.box(0.155, 0.025, 0.036, [0, 0.205, 0.157], U ? VIO : GOLD, { r: [-0.08, 0, 0] });
    k.plate([[0, -0.05], [0.04, 0], [0, 0.05], [-0.04, 0]], 0.04, [0, 0.31, 0.165], U ? VIO : GOLD, { r: [-0.08, 0, 0] });
    k.ball(0.016, [0, 0.31, 0.188], U ? G_TEAL : TEAL, { d: 0, glow: !!U });
    // big belt buckle and a pouch
    k.box(0.09, 0.075, 0.03, [0, 0.468, 0.165], GOLD_L, { grad: [0.9, 1.1] });
    k.box(0.05, 0.035, 0.034, [0, 0.468, 0.168], U ? VIO : MAG, {});
    k.at([-0.17, 0.4, 0.07], [0, -0.95, 0], 1, () => { k.box(0.085, 0.09, 0.05, [0, 0, 0], LEATHER, {}); k.box(0.09, 0.035, 0.056, [0, 0.032, 0.002], sh(LEATHER, 0.8), {}); k.ball(0.012, [0, 0.02, 0.03], GOLD, { d: 0 }); });
    if (U) cape(k, { y0: 0.18, y1: 0.7, r0: 0.27, r1: 0.2, col: VIO_L, lin: VIO, hem: GOLD, arc: 2.1, seg: 9 });
    if (U) k.bone(BONE.CLOTH, [0, 0.7, -0.17], () => k.lathe([[0.27 * 0.99 + 0.006, 0.27], [0.272 + 0.006, 0.255]], [0, 0, -0.01], GOLD_L, { s: [1, 1, 0.85], seg: 9, phi: Math.PI - 1.05, len: 2.1, grad: [1, 1], ao: false }));
    // tail with a big tuft
    k.bone(BONE.TAIL, [0, 0.42, -0.12], () => {
      tube(k, [[0, 0.42, -0.12], [0, 0.3, -0.24], [0.04, 0.16, -0.28]], 0.025, 0.02, FUR_D, { seg: 6, n: 6 });
      k.ell(0.045, 0.075, 0.045, [0.04, 0.13, -0.28], FUR_D, { d: 1 });
      for (let i = 0; i < 4; i++) { const a = i * 1.57; spike(k, [0.04, 0.12, -0.28], [0.04 + Math.sin(a) * 0.04, 0.03, -0.28 + Math.cos(a) * 0.04], 0.03, i % 2 ? FUR : FUR_D, { seg: 4 }); }
    });
    // bull head: big skull, pale muzzle with nostrils and a mouth line, gold ring,
    // real eyes, heavy brows, cheek tufts, ears with pink insides, ridged horns
    k.bone(BONE.HEAD, NECK, () => {
      k.ell(0.155, 0.15, 0.15, [0, HY + 0.01, 0.0], FUR, { grad: [0.9, 1.1] });
      k.ell(0.11, 0.095, 0.11, [0, HY - 0.06, 0.13], MUZ, { grad: [0.95, 1.05] });
      k.ell(0.08, 0.008, 0.05, [0, HY - 0.105, 0.2], 0x8a4a5a, { d: 0, ao: false });
      k.sym(() => k.ell(0.022, 0.018, 0.012, [0.045, HY - 0.05, 0.235], MOUTH, { d: 0, ao: false }));
      k.torus(0.045, 0.014, [0, HY - 0.12, 0.215], GOLD, { seg: 12, ts: 4, r: [0.3, 0, 0] });
      k.sym(() => {
        eyeBall(k, [0.066, HY + 0.034, 0.122], 0.024, U ? { iris: G_RED, glow: true, white: 0xfff0d0, dir: [0.3, 0, 1] } : { iris: 0x6a3a1a, dir: [0.3, 0, 1] });
        k.box(0.085, 0.032, 0.045, [0.065, HY + 0.068, 0.12], FUR_D, { r: [0, 0, -0.3] });
        spike(k, [0.12, HY - 0.03, 0.06], [0.17, HY - 0.07, 0.07], 0.03, FUR_D, { seg: 4 });
        k.cone(0.045, 0.11, [0.15, HY + 0.02, -0.01], FUR_D, { r: [0, 0, -1.9], seg: 5 });
        k.ell(0.03, 0.012, 0.045, [0.2, HY + 0.008, -0.003], 0xe89a9a, { d: 0, r: [0, 0, 0.35] });
        tube(k, [[0.1, HY + 0.09, 0.0], [0.24, HY + 0.11, 0.02], [0.33, HY + 0.22, 0.06], [0.32, HY + 0.33, 0.13]], 0.052, 0.012, HORN,
          { seg: 7, n: 12, bands: stripes(0, 0.6, 4, HORN, HORN_D, 0.28).concat(U ? [[0.6, 1, GOLD]] : [[0.6, 1, HORN]]) });
      });
      k.cone(0.06, 0.1, [0, HY + 0.12, 0.02], FUR_D, { r: [0.4, 0, 0], seg: 5 });
      k.cone(0.045, 0.08, [0.03, HY + 0.11, 0.04], FUR, { r: [0.6, 0, -0.3], seg: 4 });
      if (U) { // a spiked gold circlet between the horns
        k.torus(0.13, 0.014, [0, HY + 0.075, 0.005], GOLD, { r: [Math.PI / 2 - 0.15, 0, 0], seg: 14, ts: 3 });
        for (let i = 0; i < 3; i++) { const a = (i - 1) * 0.55; k.cone(0.022, 0.06 - Math.abs(i - 1) * 0.015, [Math.sin(a) * 0.125, HY + 0.08, Math.cos(a) * 0.12], GOLD_L, { seg: 4, r: [0.2, 0, -a * 0.4] }); }
      }
    });
  });
  // the great double axe (ARM_R), blades in the picture plane: engraved inlays,
  // bright bevelled edges, a wrapped grip, a pommel and a leather tassel
  const rh = H.R.map((v) => v * S);
  const A = [rh[0] - 0.04, rh[1] - 0.36, rh[2] - 0.05], B = [rh[0] + 0.12, rh[1] + 0.62, rh[2] + 0.12];
  k.bone(BONE.ARM_R, SH.map((v) => v * S), () => pole(k, A, B, (L) => {
    k.limb([0, 0, 0], [0, L, 0], 0.034, 0.03, U ? 0x8a4ad0 : WOOD, { seg: 7, grad: [0.88, 1.1] });
    wraps(k, [0, 0.24, 0], [0, 0.5, 0], 0.038, 6, U ? GOLD : LEATHER, { w: 0.6 });
    k.cyl(0.05, 0.05, 0.06, [0, 0.12, 0], GOLD, { seg: 8 });
    k.ball(0.05, [0, 0.0, 0], GOLD, { d: 1 }); k.cone(0.03, 0.07, [0, -0.1, 0], GOLD_L, { r: [Math.PI, 0, 0], seg: 5 });
    const bl = [[0.02, -0.11], [0.1, -0.2], [0.22, -0.22], [0.27, -0.06], [0.27, 0.06], [0.22, 0.22], [0.1, 0.2], [0.02, 0.11]];
    const sc = U ? 1.18 : 1.05;
    k.at([0, L - 0.16, 0], [0, 0, 0], sc, () => {
      for (const sd of [1, -1]) {
        k.plate(bl.map(([x, y]) => [x * sd, y]), 0.036, [0, 0, 0], U ? GOLD : STEEL, { grad: [0.88, 1.14] });
        k.plate([[0.2 * sd, -0.2], [0.29 * sd, -0.07], [0.29 * sd, 0.07], [0.2 * sd, 0.2], [0.245 * sd, 0]], 0.042, [0, 0, 0], U ? GOLD_L : STEEL_L, { grad: [1, 1.1] });
        // engraved inlay (a crescent fuller) on both faces
        k.plate([[0.06 * sd, -0.08], [0.15 * sd, -0.13], [0.19 * sd, -0.05], [0.19 * sd, 0.05], [0.15 * sd, 0.13], [0.06 * sd, 0.08], [0.11 * sd, 0]], 0.044, [0, 0, 0], U ? VIO : STEEL_D, { grad: [1, 1] });
        k.ball(0.022, [0.14 * sd, 0, 0], U ? G_TEAL : TEAL, { d: 0, glow: !!U, s: [1, 1, 0.5] });
      }
      k.cyl(0.06, 0.06, 0.12, [0, -0.06, 0], U ? GOLD_L : STEEL_D, { seg: 8 });
      wraps(k, [0, -0.06, 0], [0, 0.06, 0], 0.064, 2, GOLD, { w: 0.3 });
      if (U) k.ball(0.045, [0, 0, 0.04], G_TEAL, { glow: true, d: 1 });
      k.cone(0.04, 0.12, [0, 0.06, 0], U ? GOLD_L : STEEL_L, { seg: 5 });
      tube(k, [[0.0, -0.1, 0.05], [0.03, -0.2, 0.07], [0.02, -0.3, 0.06]], 0.012, 0.01, U ? VIO_L : LEATHER, { seg: 4, n: 4 });
      k.ell(0.02, 0.05, 0.02, [0.02, -0.32, 0.06], U ? VIO_L : MAG, { d: 0 });
    });
  }));
  return k.done();
}

// Manticore: orange lion body, huge red mane around a snarling face, violet
// bat wings with a magenta edge, a segmented plum scorpion tail arched over the
// back with a glowing stinger.
// Scorpicore: redder fur, crimson mane with gold collar, teal wings with a gold
// edge, spiked tail and a big glowing lime stinger.
function manticore(U) {
  const k = makeKit(U ? 163 : 161, [0, 0.48, -0.05]);
  const FUR = U ? 0xee8044 : 0xeca456, FUR_D = U ? 0xc8603a : 0xcc8640, MANE = U ? 0xc82a4a : 0xd8502a, MANE_D = U ? 0x9a1e3e : 0xb03a22, MANE_L = U ? 0xe8506a : 0xf07a3a, FACE = U ? 0xf6b48a : 0xf6c890;
  const MEM = U ? 0x26b4ac : 0x9a52e0, EDGE = U ? GOLD_L : MAG_L, WB = U ? 0x1e8a8a : 0x7442b8, CAR = U ? 0xd84a3a : 0x8c44c0, CAR_L = U ? 0xf07a5a : 0xa868dc, STG = U ? G_LIME : G_MAG;
  k.ell(0.2, 0.19, 0.36, [0, 0.48, -0.05], FUR, { r: [0.05, 0, 0], grad: [0.84, 1.1] });
  k.ell(0.16, 0.12, 0.3, [0, 0.4, -0.02], FACE, {});
  // a darker dorsal stripe and soft flank shading, a belly fringe
  k.ell(0.07, 0.04, 0.3, [0, 0.66, -0.08], FUR_D, { r: [0.05, 0, 0], d: 1 });
  for (let i = 0; i < 6; i++) { const z = 0.16 - i * 0.075; spike(k, [0.0, 0.32, z], [0, 0.26, z - 0.02], 0.05, i % 2 ? FACE : mix(FACE, FUR, 0.5), { seg: 4 }); }
  // four lion legs: elbow tufts, toes and cream claws
  const legs = [[0.12, 0.2, BONE.LEG_FR, 0.03], [-0.12, 0.2, BONE.LEG_FL, -0.03], [0.13, -0.28, BONE.LEG_BR, -0.02], [-0.13, -0.28, BONE.LEG_BL, 0.02]];
  for (const [x, z, bn, sw] of legs) k.bone(bn, [x, 0.5, z], () => {
    const X = x * 1.05, fz = z + sw + 0.03;
    k.ell(0.09, 0.15, 0.12, [X, 0.38, z], FUR, { grad: [0.86, 1.06], d: 1 });
    k.limb([X, 0.3, z], [X, 0.06, z + sw], 0.062, 0.052, FUR_D);
    spike(k, [X, 0.28, z - 0.04], [X + Math.sign(x) * 0.02, 0.2, z - 0.1], 0.035, FUR_D, { seg: 4 });
    k.ell(0.068, 0.045, 0.088, [X, 0.04, fz], FUR_D, { d: 1 });
    for (const t of [-1, 0, 1]) {
      k.ball(0.024, [X + t * 0.034, 0.03, fz + 0.065], FUR, { d: 0 });
      spike(k, [X + t * 0.034, 0.03, fz + 0.08], [X + t * 0.042, 0.012, fz + 0.12], 0.012, BONEC, { seg: 4 });
    }
  });
  // scorpion tail arched over the back: segments with darker dorsal plates and
  // spines, a ridged bulb with a glowing venom sac and a barbed stinger
  const tp = [[0, 0.56, -0.38], [0, 0.78, -0.56], [0, 1.0, -0.52], [0, 1.14, -0.36], [0, 1.15, -0.18]];
  k.bone(BONE.TAIL, tp[0], () => {
    const F = frames(tp, 7);
    for (let i = 0; i <= 7; i++) {
      const r = 0.085 - i * 0.006, p = F.P[i].toArray(), out = F.P[i].clone().sub(V3([0, 0.8, -0.35])).normalize();
      k.ell(r, r, r * 1.1, p, i % 2 ? CAR : CAR_L, { d: 1 });
      k.ell(r * 0.85, r * 0.3, r * 0.9, V3(p).addScaledVector(out, r * 0.78).toArray(), sh(CAR, 0.8), { d: 0, r: dirR(F.T[i].toArray()).map((v, j) => j === 0 ? v + Math.PI / 2 : v) });
      if (i > 0 && i < 7) { const b = V3(p).addScaledVector(out, r * 0.95); spike(k, b.toArray(), b.clone().addScaledVector(out, U && i % 2 === 0 ? 0.09 : 0.045).toArray(), U && i % 2 === 0 ? 0.03 : 0.018, U ? GOLD_L : BONEC, { seg: 4 }); }
    }
    const end = F.P[7].toArray();
    k.ell(0.07, 0.065, 0.08, [end[0], end[1] - 0.02, end[2] + 0.05], STG, { glow: true, d: 1 });
    k.sym(() => k.ell(0.03, 0.06, 0.07, [end[0] + 0.05, end[1] - 0.02, end[2] + 0.05], CAR, { d: 1 }));
    k.cone(0.04, U ? 0.2 : 0.17, [end[0], end[1] - 0.04, end[2] + 0.1], BONEC, { r: [2.2, 0, 0], seg: 6 });
    k.cone(0.018, 0.05, [end[0], end[1] - 0.07, end[2] + 0.17], BONEC, { r: [0.9, 0, 0], seg: 4 });
  });
  // head: a two-ring mane of tufts in three tones, a chin beard, a lion-man face
  // with real eyes, whisker pads, a nose, an open snarl with fangs and a tongue
  k.bone(BONE.HEAD, [0, 0.6, 0.24], () => {
    k.ell(0.21, 0.21, 0.16, [0, 0.7, 0.3], MANE, { grad: [0.85, 1.1] });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cone(0.07, 0.15, [Math.sin(a) * 0.17, 0.7 + Math.cos(a) * 0.17, 0.27], i % 2 ? MANE_D : MANE, { r: [0, 0, -a], seg: 5 }); }
    for (let i = 0; i < 8; i++) { const a = ((i + 0.5) / 8) * Math.PI * 2; k.cone(0.05, 0.12, [Math.sin(a) * 0.15, 0.7 + Math.cos(a) * 0.15, 0.33], i % 2 ? MANE_L : MANE, { r: [0.35, 0, -a], seg: 4 }); }
    for (let i = 0; i < 6; i++) { const a = Math.PI + (i - 2.5) * 0.4; k.cone(0.05, 0.13, [Math.sin(a) * 0.12, 0.7 + Math.cos(a) * 0.12, 0.17], MANE_D, { r: [-0.6, 0, -a], seg: 4 }); }
    spike(k, [0, 0.58, 0.47], [0, 0.49, 0.47], 0.04, MANE, { seg: 5 });
    if (U) {
      k.torus(0.17, 0.03, [0, 0.66, 0.3], GOLD, { r: [Math.PI / 2 + 0.4, 0, 0], seg: 16, ts: 4 });
      for (let i = 0; i < 6; i++) { const a = (i / 5 - 0.5) * 2.4; k.cone(0.02, 0.05, [Math.sin(a) * 0.17, 0.66 - Math.cos(a) * 0.065, 0.3 + Math.cos(a) * 0.155], GOLD_L, { r: [Math.PI / 2 + 0.4, 0, -a * 0.3], seg: 4 }); }
    }
    k.ell(0.125, 0.135, 0.11, [0, 0.7, 0.42], FACE, { grad: [0.92, 1.06] });
    k.ell(0.075, 0.06, 0.07, [0, 0.64, 0.51], 0xfde0b8, { d: 1 });
    k.sym(() => { k.ell(0.035, 0.03, 0.03, [0.035, 0.635, 0.545], 0xfff0d8, { d: 1 }); });
    k.ell(0.03, 0.022, 0.02, [0, 0.672, 0.578], 0x8a3a5a, { d: 0 });
    k.ell(0.008, 0.03, 0.01, [0, 0.69, 0.555], sh(FACE, 0.85), { d: 0 });
    k.ell(0.065, 0.025, 0.04, [0, 0.6, 0.52], MOUTH, { ao: false });
    k.ell(0.035, 0.012, 0.025, [0, 0.592, 0.54], 0xe8607a, { d: 0, ao: false });
    k.sym(() => {
      k.cone(0.018, 0.06, [0.035, 0.62, 0.55], WHITE, { r: [Math.PI, 0, 0], seg: 4 });
      k.cone(0.012, 0.035, [0.03, 0.58, 0.545], WHITE, { seg: 3 });
      eyeBall(k, [0.05, 0.73, 0.515], 0.026, U ? { iris: G_GOLD, glow: true, slit: true, white: 0xfff4c0 } : { iris: 0xe0a020, slit: true });
      k.box(0.07, 0.022, 0.03, [0.05, 0.765, 0.515], FUR_D, { r: [0, 0, -0.35] });
      k.cone(0.045, 0.09, [0.11, 0.83, 0.36], FACE, { r: [-0.2, 0, -0.5], seg: 5 });
      k.ell(0.022, 0.04, 0.008, [0.112, 0.86, 0.372], 0xe89a9a, { d: 0, r: [-0.2, 0, -0.5] });
    });
  });
  // bat wings raised in a V from the shoulders, with veined membranes
  k.sym(() => k.bone(BONE.WING_R, [0.12, 0.62, 0.06], () => batWing(k, {
    root: [0.12, 0.62, 0.06], elbow: [0.32, 0.86, 0.02], wrist: [0.5, 1.08, -0.06],
    tips: U ? [[0.86, 0.98, -0.2], [0.78, 0.72, -0.3], [0.52, 0.56, -0.32]] : [[0.8, 0.94, -0.2], [0.72, 0.7, -0.3], [0.5, 0.56, -0.3]],
    back: [0.12, 0.56, -0.2], mem: MEM, bone: WB, r: 0.042, claw: BONEC, edge: EDGE, vein: mix(MEM, WB, 0.6),
  })));
  return k.done();
}

// Black dragon: a big rich violet-plum dragon (never murky): lilac belly plates,
// hot-magenta spines and wing edges, teal horns and claws, glowing teal eyes and
// a magenta breath glow in an open jaw, huge raised bat wings.
// Red dragon: scarlet with a gold belly, gold horns and spines, orange wings,
// glowing yellow eyes and fire in the jaw.
function dragon(U) {
  const k = makeKit(U ? 181 : 179, [0, 0.58, -0.1]);
  const BD = U ? 0xe0442e : 0x6e3aa8, BD_D = U ? 0xb83226 : 0x58308c, BD_L = U ? 0xf06a44 : 0x8a52c8, BEL = U ? 0xffb84a : 0xc69af0, BEL_D = U ? 0xe8963a : 0xa87ad8;
  const SP = U ? GOLD : MAG, HRN = U ? GOLD_L : TEAL_L, HRN_D = U ? GOLD : TEAL, CLAW = U ? 0xfff0c8 : TEAL;
  const MEM = U ? 0xf6782e : 0xb44ac0, EDGE = U ? GOLD_L : TEAL_L, WB = U ? 0xc03a28 : 0x5e3296, EYE = U ? G_GOLD : G_TEAL, BR = U ? 0xffa030 : G_MAG;
  // body, chest, belly
  k.ell(0.25, 0.24, 0.42, [0, 0.6, -0.12], BD, { grad: [0.82, 1.12] });
  k.ell(0.22, 0.24, 0.2, [0, 0.66, 0.18], BD, {});
  k.ell(0.19, 0.15, 0.4, [0, 0.5, -0.04], BEL, { r: [-0.08, 0, 0], grad: [0.9, 1.06] });
  // pale chest plate crossed by transverse scute bands
  k.at([0, 0.64, 0.3], [-0.25, 0, 0], 1, () => {
    k.ell(0.15, 0.2, 0.08, [0, 0, 0], BEL, { d: 2 });
    for (let i = -3; i <= 3; i++) { const v = i / 4, c = Math.sqrt(1 - v * v); k.ell(0.15 * c, 0.012, 0.025, [0, v * 0.2, 0.08 * c - 0.012], BEL_D, { d: 0, grad: [1, 1], ao: false }); }
  });
  // scale pattern on the flanks (two tones) and small spines between the big ones
  const sc = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { const lon = 1.25 + i * 0.36 + (r % 2) * 0.18, lat = 0.1 + r * 0.28; sc.push([lon, lat], [-lon, lat]); }
  platesOn(k, [0, 0.6, -0.12], [0.25, 0.24, 0.42], sc, [0.05, 0.04, 0.014], [BD_D, BD_D, BD_L, BD_L]);
  for (let i = 0; i < 4; i++) {
    k.cone(0.06 - i * 0.004, 0.16, [0, 0.83 - i * 0.025, 0.12 - i * 0.16], SP, { r: [-0.6, 0, 0], seg: 5 });
    k.cone(0.07 - i * 0.004, 0.04, [0, 0.83 - i * 0.025, 0.12 - i * 0.16], BD_D, { r: [-0.6, 0, 0], seg: 5 });
    if (i < 3) k.cone(0.03, 0.07, [0, 0.83 - i * 0.025, 0.04 - i * 0.16], SP, { r: [-0.6, 0, 0], seg: 4 });
  }
  // legs: knee / elbow spikes, banded shins, knuckled toes, curved claws
  const legs = [[0.17, -0.3, BONE.LEG_BR, true], [-0.17, -0.3, BONE.LEG_BL, true], [0.15, 0.22, BONE.LEG_FR, false], [-0.15, 0.22, BONE.LEG_FL, false]];
  for (const [x, z, bn, back] of legs) k.bone(bn, [x, 0.6, z], () => {
    const s = Math.sign(x);
    if (back) {
      k.ell(0.11, 0.18, 0.17, [x + s * 0.04, 0.45, z], BD, { grad: [0.86, 1.06], d: 1 });
      k.limb([x + s * 0.05, 0.32, z - 0.04], [x + s * 0.05, 0.07, z + 0.0], 0.07, 0.058, BD_D);
      wraps(k, [x + s * 0.05, 0.3, z - 0.035], [x + s * 0.05, 0.1, z - 0.005], 0.071, 3, BD, { w: 0.3, taper: 0.9 });
      spike(k, [x + s * 0.1, 0.42, z - 0.12], [x + s * 0.13, 0.42, z - 0.24], 0.035, SP, { seg: 4 });
    } else {
      k.ell(0.09, 0.14, 0.11, [x + s * 0.03, 0.5, z], BD, { d: 1 });
      k.limb([x + s * 0.04, 0.42, z], [x + s * 0.05, 0.07, z + 0.1], 0.062, 0.05, BD_D);
      wraps(k, [x + s * 0.04, 0.38, z + 0.01], [x + s * 0.05, 0.1, z + 0.08], 0.063, 3, BD, { w: 0.3, taper: 0.9 });
      spike(k, [x + s * 0.07, 0.42, z - 0.04], [x + s * 0.1, 0.38, z - 0.14], 0.028, SP, { seg: 4 });
    }
    const fz = back ? z + 0.03 : z + 0.13;
    k.ell(0.075, 0.05, 0.1, [x + s * 0.05, 0.045, fz], BD_D, { d: 1 });
    for (const t of [-1, 0, 1]) {
      k.ball(0.026, [x + s * 0.05 + t * 0.04, 0.035, fz + 0.075], BD, { d: 0 });
      spike(k, [x + s * 0.05 + t * 0.04, 0.035, fz + 0.09], [x + s * 0.05 + t * 0.05, 0.005, fz + 0.16], 0.02, CLAW, { seg: 4 });
    }
  });
  // tail: banded, with spines and a veined spade tip
  const tp = [[0, 0.58, -0.46], [0, 0.42, -0.74], [0.1, 0.2, -0.96], [0.3, 0.08, -1.06], [0.48, 0.06, -1.02]];
  k.bone(BONE.TAIL, tp[0], () => {
    const F = tube(k, tp, 0.15, 0.025, BD, { n: 15, seg: 9, pow: 0.8, bands: [[0, 0.1, BD]].concat(stripes(0.1, 1, 6, BD, BD_D, 0.3)) });
    for (let i = 2; i < 14; i += 3) { const p = F.P[i]; k.cone(0.045 - i * 0.0018, 0.12 - i * 0.004, [p.x, p.y + 0.11 - i * 0.0065, p.z], SP, { r: [-0.6, 0, 0], seg: 5 }); }
    k.plate([[0, -0.03], [0.1, -0.1], [0.2, 0], [0.1, 0.1], [0, 0.03]], 0.03, [0.46, 0.07, -1.03], SP, { r: [Math.PI / 2, 0, 0.1] });
    k.at([0.46, 0.07, -1.03], [Math.PI / 2, 0, 0.1], 1, () => {
      for (const e of [[0.2, 0], [0.1, 0.085], [0.1, -0.085]]) k.limb([0.01, 0, 0], [e[0] * 0.92, e[1] * 0.92, 0], 0.008, 0.004, sh(SP, 0.72), { seg: 4, s: 1 });
      k.limb([0.01, 0, -0.02], [0.18, 0, -0.02], 0.02, 0.006, sh(SP, 0.72), { seg: 4 });
    });
  });
  // neck + head (HEAD from the chest)
  k.bone(BONE.HEAD, [0, 0.74, 0.26], () => {
    const F = tube(k, [[0, 0.7, 0.22], [0, 0.92, 0.36], [0, 1.12, 0.44], [0, 1.2, 0.5]], 0.13, 0.085, BD, { n: 10, seg: 10 });
    k.at([0, 0.9, 0.44], [-0.55, 0, 0], 1, () => {
      k.ell(0.09, 0.2, 0.08, [0, 0, 0], BEL, { d: 2 });
      for (let i = -3; i <= 3; i++) { const v = i / 4, c = Math.sqrt(1 - v * v); k.ell(0.09 * c, 0.01, 0.024, [0, v * 0.2, 0.08 * c - 0.01], BEL_D, { d: 0, grad: [1, 1], ao: false }); }
    });
    for (let i = 2; i < 10; i += 2) { const p = F.P[i]; k.cone(0.045, 0.12, [p.x, p.y + 0.06, p.z - 0.09], SP, { r: [-1.2, 0, 0], seg: 5 }); }
    const hc = [0, 1.22, 0.56];
    // the head is drawn 1.3x around its centre so it reads at phone size
    const HM = new THREE.Matrix4().makeTranslation(...hc).multiply(new THREE.Matrix4().makeScale(1.3, 1.3, 1.3)).multiply(new THREE.Matrix4().makeTranslation(-hc[0], -hc[1], -hc[2]));
    k.with(HM, () => {
    k.ell(0.135, 0.11, 0.15, hc, BD, { grad: [0.9, 1.1] });
    k.ell(0.095, 0.07, 0.16, [0, 1.19, 0.71], BD, {});
    k.ell(0.085, 0.04, 0.15, [0, 1.09, 0.66], BEL, { r: [0.25, 0, 0], d: 1 });
    k.ell(0.07, 0.035, 0.12, [0, 1.13, 0.68], BR, { glow: true, d: 1 });
    // snout ridge plates
    for (let i = 0; i < 3; i++) k.ell(0.04 - i * 0.006, 0.014, 0.035, [0, 1.258 - i * 0.012, 0.62 + i * 0.07], BD_L, { d: 0, r: [0.25, 0, 0] });
    k.sym(() => {
      // eye with a slit pupil, heavy brow, nostril, teeth rows, cheek frill
      k.ell(0.036, 0.028, 0.022, [0.075, 1.255, 0.66], EYE, { glow: true, d: 1 });
      k.ell(0.006, 0.022, 0.008, [0.082, 1.255, 0.678], 0x2a1040, { glow: true, d: 0 });
      k.box(0.08, 0.03, 0.06, [0.075, 1.29, 0.64], BD_D, { r: [0, -0.3, -0.3] });
      k.ell(0.016, 0.01, 0.014, [0.036, 1.222, 0.85], 0x3a1a4a, { d: 0, ao: false });
      k.ell(0.026, 0.02, 0.03, [0.036, 1.226, 0.83], BD_L, { d: 0 });
      for (let i = 0; i < 4; i++) spike(k, [0.072 - i * 0.008, 1.14, 0.6 + i * 0.065], [0.074 - i * 0.008, 1.1, 0.605 + i * 0.065], 0.012, WHITE, { seg: 3 });
      for (let i = 0; i < 3; i++) spike(k, [0.06 - i * 0.008, 1.1, 0.63 + i * 0.065], [0.061 - i * 0.008, 1.13, 0.64 + i * 0.065], 0.01, WHITE, { seg: 3 });
      spike(k, [0.11, 1.16, 0.55], [0.2, 1.13, 0.46], 0.025, SP, { seg: 4 });
      spike(k, [0.1, 1.2, 0.52], [0.19, 1.22, 0.42], 0.022, SP, { seg: 4 });
      tube(k, [[0.07, 1.28, 0.52], [0.14, 1.36, 0.42], [0.17, 1.4, 0.26]], 0.05, 0.01, HRN, { seg: 6, n: 10, bands: stripes(0, 0.7, 4, HRN, HRN_D, 0.3).concat([[0.7, 1, HRN]]) });
      k.cone(0.03, 0.09, [0.12, 1.2, 0.5], HRN, { r: [-1.2, 0, -1.0], seg: 4 });
      k.cone(0.02, 0.06, [0.05, 1.3, 0.45], HRN, { r: [-1.3, 0, -0.3], seg: 4 });
    });
    spike(k, [0, 1.07, 0.6], [0, 1.03, 0.54], 0.02, SP, { seg: 4 });
    });
  });
  // huge bat wings raised high, veined membranes
  const Sw = U ? 1.0 : 0.93;
  k.sym(() => k.bone(BONE.WING_R, [0.13, 0.82, 0.02], () => batWing(k, {
    root: [0.13, 0.82, 0.02], elbow: [0.42 * Sw, 1.12 * Sw, -0.04], wrist: [0.66 * Sw, 1.4 * Sw, -0.12],
    tips: [[1.02 * Sw, 1.2 * Sw, -0.3], [0.94 * Sw, 0.86, -0.42], [0.66 * Sw, 0.62, -0.46]],
    back: [0.14, 0.66, -0.32], mem: MEM, bone: WB, r: 0.06, claw: HRN, edge: EDGE, vein: mix(MEM, WB, 0.55),
  })));
  return k.done();
}

// ---------------------------------------------------------------- exports
const BUILDERS = { troglodyte, harpy, beholder, medusa, minotaur, manticore, blackdragon: dragon };
const UP_OF = { infernaltrog: 'troglodyte', harpyhag: 'harpy', evileye: 'beholder', medusaqueen: 'medusa', minotaurking: 'minotaur', scorpicore: 'manticore', reddragon: 'blackdragon' };
export const DUNGEON_BASE_IDS = Object.keys(BUILDERS);
export const DUNGEON_UP_IDS = Object.keys(UP_OF);
export const DUNGEON_IDS = [...DUNGEON_BASE_IDS, ...DUNGEON_UP_IDS];
// dungeonBuild(baseId, up) -> fresh { body, glow } or null
export function dungeonBuild(id, up = false) {
  const f = BUILDERS[id];
  return f ? f(!!up) : null;
}
const cache = new Map();
// dungeonModel(id) -> cached { body, glow } for any of the 14 Dungeon ids (base or upgrade), else null
export function dungeonModel(id) {
  if (cache.has(id)) return cache.get(id);
  const base = BUILDERS[id] ? id : UP_OF[id];
  const m = base ? dungeonBuild(base, !BUILDERS[id]) : null;
  cache.set(id, m);
  return m;
}
