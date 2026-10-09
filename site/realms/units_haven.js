import * as THREE from 'three';
import { BONE } from './rig.js?v=1.5';

// =====================================================================
// HEX REALMS: Haven (castle) creatures, round 4 "phone readability" pass.
// havenModel(id) -> { body, glow } for pikeman, archer, griffin,
// swordsman, monk, cavalier, angel. Facing +z, base at y = 0.
// havenBuild(id, true) builds the upgraded look of the same creature;
// units_haven_up.js maps halberdier..archangel onto it.
//
// Readability rules used here (a creature is only 40-90 px tall in game):
//  - chunky heroic build: head ~1.35x, thick limbs, big boots and hands
//  - 1-2 exaggerated identity features (kettle helm + pike, hood + longbow,
//    beak + V wings, shield + great helm, robe + orb staff, horse + lance,
//    halo + wings) and weapons/shields ~1.3x
//  - 2-3 large colour blocks plus one accent, light top / mid / soft underside
//  - no micro parts (rivets, fingers, thin straps, tiny sparkles)
//  - upgrades keep the silhouette and add gold trim, capes, crowns, bigger
//    plumes and wings
//
// Round 5 rig: every part carries aBone/aPivot (see rig.js). Parts are tagged
// while being added via k.bone(bone, pivot, fn); pivots are given in the frame
// current at that call and stored in model-local space. Side convention: the
// weapon hand is on +x, so +x parts are *_R (ARM_R, LEG_FR, LEG_BR, WING_R) and
// -x parts *_L; inside k.sym the mirrored pass swaps L/R automatically.
// =====================================================================

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UPV = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- palette
// bright, saturated, sunny: no near-black anywhere (eyes and slits are deep blue/plum)
const BLUE = 0x2f6cf2, BLUE_D = 0x2a54d0, BLUE_L = 0x78a8ff, ROYAL = 0x2c50d8;
const GOLD = 0xf6c232, GOLD_L = 0xffe27a;
const STEEL = 0xd2d9e6, STEEL_D = 0x9ea8c0, STEEL_L = 0xf0f4ff;
const SKIN = 0xf7c49c;
const LEATHER = 0xa8642e, WOOD = 0xb87a3c, TAN = 0xd8aa66, BROWN = 0x9a5e34;
const WHITE = 0xfbf8f0, CREAM = 0xf3e8cc;
const RED = 0xe43a2c, CRIMSON = 0xd8323c;
const GREEN = 0x4cb042, GREEN_D = 0x2f8c36;
const INK = 0x2e2c5a;
// capes are seen from behind (in shade) by the player's own army: paint them a step lighter
const CAPE_B = 0x86b2ff, CAPE_R = 0xff7c6c, CAPE_G = 0x8ee070;
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
    ell(rx, ry, rz, p, col, o = {}) { k.add(new THREE.IcosahedronGeometry(1, o.d ?? 1).scale(rx, ry, rz).applyMatrix4(mat(p, o.r)), col, o); },
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
      const g = new THREE.CylinderGeometry(r2, r1, len, o.seg ?? 6, 1, !!o.open).translate(0, len / 2, 0);
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
  const out = { body: { p: [], c: [], b: [], v: [] }, glow: { p: [], c: [], b: [], v: [] } };
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
      if (pt.top && y > y1 - span * pt.top[1]) c = new THREE.Color(pt.top[0]);
      // coloured (blue-violet) shade near the ground instead of black
      dst.p.push(x, y, z); dst.c.push(c.r * m + cool * 0.4, c.g * m + cool * 0.5, c.b * m + cool);
      dst.b.push(pt.bone); dst.v.push(pt.pivot[0], pt.pivot[1], pt.pivot[2]);
    }
  }
  const build = ({ p, c, b, v }, uv) => {
    if (!p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setAttribute('aBone', new THREE.Float32BufferAttribute(b, 1));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(v, 3));
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
  k.ball(c.hr, Hh.toArray(), c.hand, { d: 0 });
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
  k.lathe([[0.135, 0.4], [0.155, 0.48], [0.185, 0.56], [0.205, 0.63], [0.19, 0.69], [0.12, 0.73], [0.03, 0.745]], [0, 0, 0], o.torso, { s: [1, 1, 0.76], seg: 10, grad: o.torsoGrad ?? [0.82, 1.1] });
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
  let R; k.bone(BONE.ARM_R, SH, () => { R = arm(k, SH, o.rh ?? [0.24, 0.36, 0.06], ac); });
  const lh = o.lh ?? [-0.24, 0.36, 0.06];
  let Lm; k.with(new THREE.Matrix4().makeScale(-1, 1, 1), () => k.bone(BONE.ARM_L, SH, () => { Lm = arm(k, SH, [-lh[0], lh[1], lh[2]], ac); }));
  return { R, L: [-Lm[0], Lm[1], Lm[2]] };
}

// big heater shield in the xy plane, face toward +z; the back keeps the field colour
function shield(k, p, r, sc, field, rim, emblem, emb = rim) {
  const O = [[-0.2, 0.22], [0.2, 0.22], [0.2, 0.04], [0.14, -0.12], [0, -0.24], [-0.14, -0.12], [-0.2, 0.04]];
  k.at(p, r, sc, () => {
    k.plate(O, 0.036, [0, 0, 0], rim, { grad: [0.9, 1.08] });
    k.plate(O.map(([x, y]) => [x * 0.8, y * 0.8 + 0.008]), 0.02, [0, 0, 0.02], field, { grad: [0.86, 1.1] });
    k.plate(O.map(([x, y]) => [x * 0.86, y * 0.86]), 0.02, [0, 0, -0.02], field, { grad: [0.8, 0.95] });
    if (emblem === 'cross') {
      k.box(0.075, 0.34, 0.02, [0, -0.005, 0.032], emb, { grad: [0.95, 1.08] });
      k.box(0.25, 0.075, 0.02, [0, 0.07, 0.032], emb, { grad: [1, 1] });
    } else if (emblem === 'sun') {
      k.cyl(0.075, 0.075, 0.02, [0, 0.03, 0.022], emb, { r: [Math.PI / 2, 0, 0], seg: 8 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.cone(0.042, 0.075, [Math.sin(a) * 0.08, 0.03 + Math.cos(a) * 0.08, 0.032], emb, { r: [0, 0, -a], seg: 3 }); }
    }
  });
}

// a bold gold sunburst medallion facing +z with a glowing gem
function sunBadge(k, p, r, sc = 1, gem = 0x8ae0ff) {
  k.at(p, r, sc, () => {
    k.cyl(0.045, 0.045, 0.02, [0, 0, -0.005], GOLD_L, { r: [Math.PI / 2, 0, 0], seg: 6, grad: [1, 1], ao: false });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.cone(0.024, 0.045, [Math.sin(a) * 0.042, Math.cos(a) * 0.042, 0], GOLD, { r: [0, 0, -a], seg: 3, ao: false }); }
    k.ball(0.025, [0, 0, 0.016], gem, { glow: true, d: 0 });
  });
}

// a plume of big cones sweeping back from p
function plume(k, p, cols, sc = 1, spread = 0) {
  cols.forEach((c, i) => k.cone(0.065 * sc, (0.26 + i * 0.02) * sc, p, c, { r: [-0.3 - i * 0.42, 0, (i - (cols.length - 1) / 2) * spread], seg: 5, grad: [0.92, 1.08] }));
}

// a cape hanging behind the shoulders: outer sheet, reversed lining (so it shows
// from the front too) and a gold hem. Lathe arc centred on -z.
function cape(k, o) {
  const { y0 = 0.22, y1 = 0.7, r0 = 0.27, r1 = 0.19, col = BLUE, lin = GOLD, hem = GOLD, arc = 2.2, sz = 0.85, z = -0.01, seg = 7 } = o;
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
function wing(k, sh, o) {
  const { W, T, len = 0.42, n = 8, col = WHITE, tip = GOLD_L, cov = WHITE, drop = [0, -1, -0.35], dropIn = drop, th = 0.016, prim = 3, bone = cov } = o;
  const S = V3(sh), wrist = S.clone().add(V3(W)), tipP = S.clone().add(V3(T));
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
  // a few broad primaries fanning past the tip
  for (let j = 0; j < prim; j++) {
    const i = n - j * 2, r0 = roots[Math.max(0, i)].clone();
    const dir = dirs[Math.max(0, i)].clone().lerp(E, 0.25 - j * 0.05).normalize();
    k.feather(r0.toArray(), r0.clone().add(dir.multiplyScalar(len * (0.72 + j * 0.1))).toArray(), 0.1, tip, { grad: [0.95, 1.08], t: 0.02 });
  }
}

// ---------------------------------------------------------------- creatures
// Pikeman: blue soldier, wide steel kettle helm, red sash, huge pike.
// Halberdier: + gold-rimmed helm with crest and plume, gold pauldrons, sun badge,
// blue cape, a great gold-edged halberd.
function pikeman(U) {
  const k = makeKit(U ? 13 : 11);
  // the pole leans out to the side and a little forward: a long diagonal that
  // reads from the front and the back, without a tall thin spike that would
  // make the unit fitter shrink the whole figure
  const A = [0.15, 0.04, 0.0], B = [0.6, 0.88, 0.28], P = (t) => A.map((v, i) => v + (B[i] - v) * t);
  figure(k, {
    legs: BLUE_D, boots: LEATHER, torso: BLUE, hips: BLUE_D, upper: U ? STEEL : BLUE_L, fore: BLUE, hand: SKIN,
    rh: P(0.4), lh: [-0.23, 0.42, 0.08], pauldron: U ? STEEL_L : null, pTrim: U ? GOLD : null, stance: 0.1,
  });
  // tassets skirt and polished breastplate
  k.lathe([[0.225, 0.27], [0.19, 0.36], [0.16, 0.45]], [0, 0, 0], BLUE, { s: [1, 1, 0.8], seg: 10, grad: [0.85, 1.05] });
  if (U) k.lathe([[0.232, 0.262], [0.228, 0.31]], [0, 0, 0], GOLD, { s: [1, 1, 0.8], seg: 10, grad: [1, 1] });
  k.lathe([[0.165, 0.47], [0.195, 0.55], [0.215, 0.63], [0.2, 0.69], [0.125, 0.735], [0.04, 0.75]], [0, 0, 0.005], U ? STEEL_L : STEEL, { s: [1, 1, 0.8], seg: 10, grad: [0.85, 1.12] });
  if (U) {
    sunBadge(k, [0, 0.6, 0.17], [-0.25, 0, 0], 1.3);
    cape(k, { y0: 0.24, y1: 0.7, r0: 0.27, r1: 0.2, col: CAPE_B, lin: BLUE_L, hem: GOLD, arc: 2.1 });
  } else {
    k.box(0.08, 0.46, 0.37, [0, 0.58, 0], RED, { r: [0, 0, 0.78], grad: [0.95, 1.08] }); // the red sash: the accent
  }
  // kettle helm: a dome on a very wide brim (the pikeman's identity)
  k.bone(BONE.HEAD, NECK, () => {
  k.lathe([[0.13, HY + 0.02], [0.232, HY + 0.008], [0.236, HY + 0.045], [0.155, HY + 0.06], [0.158, HY + 0.11], [0.125, HY + 0.17], [0.06, HY + 0.2], [0, HY + 0.205]], [0, 0, 0], U ? STEEL_L : STEEL, { seg: 10, grad: [0.8, 1.15] });
  if (U) {
    k.lathe([[0.244, HY + 0.0], [0.244, HY + 0.05]], [0, 0, 0], GOLD, { seg: 10, grad: [1, 1] });
    k.plate([[-0.15, 0], [0.15, 0], [0.12, 0.08], [0.04, 0.12], [-0.06, 0.12], [-0.13, 0.07]], 0.035, [0, HY + 0.14, 0], GOLD, { r: [0, Math.PI / 2, 0] });
    plume(k, [0, HY + 0.2, -0.07], [WHITE, RED, WHITE], 1.15);
  }
  });
  // pole: a long pike, or the great halberd (held in the weapon hand: ARM_R)
  k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (L) => {
    k.limb([0, 0, 0], [0, L, 0], 0.032, 0.028, WOOD, { seg: 6, grad: [0.88, 1.1] });
    k.cyl(0.048, 0.042, 0.075, [0, L - 0.05, 0], GOLD, { seg: 6 });
    if (!U) {
      k.ball(0.06, [0, L - 0.09, 0], RED, { d: 0 });
      leafHead(k, [0, L, 0], 0.32, 0.08, STEEL_L);
    } else {
      for (const y of [0.45, 0.8]) k.cyl(0.042, 0.042, 0.05, [0, y, 0], GOLD, { seg: 6, grad: [1, 1] });
      const ax = [[0, 0.02], [0.09, -0.02], [0.17, -0.12], [0.25, -0.02], [0.28, 0.12], [0.25, 0.26], [0.17, 0.34], [0.09, 0.22], [0, 0.18]];
      k.at([-0.02, L - 0.3, 0], [0, 0, 0], [-1.05, 1.05, 1.05], () => { // blade toward the figure: keeps the unit narrow
        k.plate(ax.map(([x, y]) => [(x - 0.14) * 1.13 + 0.15, (y - 0.11) * 1.13 + 0.11]), 0.024, [0, 0, 0], GOLD, { grad: [1, 1.05] });
        k.plate(ax, 0.036, [0, 0, 0], STEEL_L, { grad: [0.88, 1.15] });
      });
      k.cone(0.042, 0.17, [0.01, L - 0.18, 0], STEEL, { r: [0, 0, -Math.PI / 2], seg: 4 });
      k.ball(0.06, [0, L - 0.36, 0], BLUE, { d: 0 });
      leafHead(k, [0, L, 0], 0.3, 0.07, STEEL_L);
    }
  }));
  return k.done();
}

// Archer: green hood and capelet, tan legs, a huge longbow and a red-fletched quiver.
// Marksman: + steel gold-rimmed pauldrons, big red plume feather, green cape with
// gold hem, a gilded recurve bow.
function archer(U) {
  const k = makeKit(U ? 29 : 23);
  const bowP = [-0.17, 0.58, 0.24], draw = [0.04, 0.62, 0.06];
  figure(k, {
    legs: TAN, boots: LEATHER, torso: GREEN_D, hips: GREEN_D, upper: GREEN, fore: LEATHER, hand: SKIN,
    rh: draw, lh: bowP, belt: GOLD, stance: 0.11, head: false, pauldron: U ? STEEL_L : null, pTrim: U ? GOLD : null,
  });
  k.lathe([[0.215, 0.27], [0.18, 0.36], [0.155, 0.45]], [0, 0, 0], GREEN_D, { s: [1, 1, 0.8], seg: 10, grad: [0.85, 1.05] });
  if (U) k.lathe([[0.222, 0.262], [0.218, 0.31]], [0, 0, 0], GOLD, { s: [1, 1, 0.8], seg: 10, grad: [1, 1] });
  if (U) cape(k, { y0: 0.2, y1: 0.68, r0: 0.27, r1: 0.2, col: CAPE_G, lin: GOLD, hem: GOLD, arc: 2.0 });
  // capelet and big pointed hood
  k.lathe([[0.25, 0.55], [0.235, 0.6], [0.19, 0.67], [0.11, 0.73], [0.05, 0.75]], [0, 0, 0], GREEN, { s: [1, 1, 0.86], seg: 10, grad: [0.85, 1.1] });
  k.lathe([[0.258, 0.535], [0.254, 0.575]], [0, 0, 0], U ? GOLD : GREEN_D, { s: [1, 1, 0.86], seg: 10, grad: [1, 1] });
  k.bone(BONE.HEAD, NECK, () => {
  k.ell(0.16, 0.165, 0.16, [0, HY + 0.015, -0.025], GREEN, { grad: [0.88, 1.1] });
  k.cone(0.09, 0.22, [0, HY + 0.07, -0.12], GREEN, { r: [-2.1, 0, 0], seg: 5 });
  k.ell(0.122, 0.125, 0.1, [0, HY - 0.012, 0.06], SKIN, { grad: [0.95, 1.05] });
  eyes(k, HY - 0.005, 0.148);
  if (U) {
    k.feather([0.1, HY + 0.08, -0.04], [0.26, HY + 0.32, -0.2], 0.12, RED, { t: 0.024 });
    k.feather([0.08, HY + 0.08, -0.06], [0.16, HY + 0.3, -0.26], 0.09, WHITE, { t: 0.022 });
  }
  });
  // quiver on the back: a big leather tube crowned with red and white fletching
  k.at([0.1, 0.6, -0.17], [0.35, 0, -0.4], 1, () => {
    k.cyl(0.07, 0.076, 0.36, [0, -0.2, 0], U ? CRIMSON : LEATHER, { seg: 7, grad: [0.85, 1.08] });
    if (U) k.cyl(0.08, 0.08, 0.05, [0, 0.1, 0], GOLD, { seg: 7, grad: [1, 1] });
    k.box(0.13, 0.1, 0.05, [0, 0.2, 0], RED, { r: [0, 0.4, 0] });
    k.box(0.05, 0.11, 0.13, [0, 0.21, 0], WHITE, { r: [0, 0.4, 0] });
  });
  // longbow: thick limbs bowed back toward the archer (recurved, gilded tips when upgraded).
  // Rig: bow and string on the bow arm (ARM_L), the nocked arrow on the drawing arm (ARM_R)
  const bowH = U ? 0.47 : 0.43, bend = 0.12, pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 4 - 1; pts.push([bowP[0], bowP[1] + t * bowH, bowP[2] + 0.02 - t * t * bend + (U ? Math.pow(Math.abs(t), 5) * 0.09 : 0)]); }
  const R = [draw[0], draw[1], draw[2] - 0.02];
  k.bone(BONE.ARM_L, SHL, () => {
  for (let i = 0; i < 8; i++) {
    const r = 0.034 - Math.abs(i - 3.5) * 0.0028, c = i === 3 || i === 4 ? (U ? GOLD : RED) : (U && (i === 0 || i === 7) ? GOLD : WOOD);
    k.limb(pts[i], pts[i + 1], r, r, c, { seg: 5 });
  }
  k.ball(0.03, pts[0], GOLD, { d: 0 }); k.ball(0.03, pts[8], GOLD, { d: 0 });
  k.limb(pts[8], R, 0.008, 0.008, CREAM, { seg: 3 });
  k.limb(pts[0], R, 0.008, 0.008, CREAM, { seg: 3 });
  });
  // nocked arrow with a bold head
  const tipA = [bowP[0] + 0.01, bowP[1] + 0.02, bowP[2] + 0.2];
  k.bone(BONE.ARM_R, SH, () => {
  k.limb(R, tipA, 0.014, 0.014, CREAM, { seg: 4 });
  const dA = V3(tipA).sub(V3(R)).normalize();
  k.stick(new THREE.ConeGeometry(0.032, 0.09, 4).translate(0, 0.045, 0), tipA, V3(tipA).add(dA).toArray(), U ? GOLD_L : STEEL_L, {});
  });
  return k.done();
}

// Griffin: orange-gold lion body, white eagle head with a huge yellow beak,
// big V wings in cream / orange / rust.
// Royal griffin: + gold crown, royal-blue wing tips and saddle cloth, bigger wings.
function griffin(U) {
  const k = makeKit(U ? 39 : 37, [0, 0.43, -0.08]);
  const FUR = U ? 0xf6c24e : 0xeeaa3e, FUR_D = U ? 0xd89838 : 0xcc8430, FEATH = 0xfff8ec, BEAK = 0xffb41e, TAL = 0xf2bc3c, CLAW = 0x8a7a9a;
  k.ell(0.19, 0.17, 0.3, [0, 0.43, -0.08], FUR, { r: [0.1, 0, 0], grad: [0.84, 1.1] });
  k.sym(() => k.bone(BONE.LEG_BR, [0.12, 0.44, -0.25], () => {
    k.ell(0.1, 0.15, 0.14, [0.12, 0.36, -0.25], FUR, { grad: [0.84, 1.08] });
    k.limb([0.13, 0.28, -0.28], [0.14, 0.13, -0.35], 0.075, 0.055, FUR);
    k.limb([0.14, 0.13, -0.35], [0.14, 0.04, -0.29], 0.055, 0.048, FUR_D);
    k.ell(0.062, 0.042, 0.08, [0.14, 0.035, -0.26], FUR_D, { d: 0 });
  }));
  // tail with a big tuft
  k.bone(BONE.TAIL, [0, 0.5, -0.34], () => {
    k.limb([0, 0.5, -0.34], [0, 0.42, -0.52], 0.04, 0.032, FUR);
    k.limb([0, 0.42, -0.52], [0, 0.56, -0.66], 0.032, 0.028, FUR);
    k.ell(0.075, 0.1, 0.075, [0, 0.62, -0.7], U ? GOLD : 0xc0602a, { r: [-0.6, 0, 0] });
  });
  // white feathered chest and neck
  k.ell(0.18, 0.2, 0.18, [0, 0.5, 0.15], FEATH, { r: [-0.35, 0, 0], grad: [0.86, 1.06] });
  k.limb([0, 0.55, 0.22], [0, 0.72, 0.32], 0.135, 0.11, FEATH, { seg: 7 });
  // eagle front legs: feathered thighs, golden shins, two bold talons
  k.sym(() => k.bone(BONE.LEG_FR, [0.11, 0.44, 0.2], () => {
    k.ell(0.085, 0.12, 0.095, [0.11, 0.36, 0.22], FEATH, { r: [0.3, 0, 0] });
    k.limb([0.12, 0.3, 0.25], [0.13, 0.06, 0.3], 0.058, 0.046, TAL);
    k.ell(0.062, 0.04, 0.068, [0.13, 0.04, 0.32], TAL, { d: 0 });
    for (const t of [-1, 1]) k.cone(0.024, 0.08, [0.13 + t * 0.03, 0.035, 0.36], CLAW, { r: [Math.PI / 2 + 0.3, t * 0.3, 0], seg: 3 });
  }));
  if (U) { // royal saddle cloth
    k.lathe([[0.208, 0.36], [0.2, 0.46], [0.165, 0.56], [0.06, 0.6]], [0, 0, -0.1], ROYAL, { s: [1, 1, 1.2], seg: 10, grad: [0.85, 1.08] });
    k.lathe([[0.215, 0.345], [0.212, 0.395]], [0, 0, -0.1], GOLD, { s: [1, 1, 1.2], seg: 10, grad: [1, 1] });
  } else {
    k.torus(0.15, 0.03, [0, 0.47, 0.05], GOLD, { r: [Math.PI / 2 - 0.5, 0, 0], seg: 10 });
  }
  // big eagle head: white, huge hooked yellow beak, fierce orange brow, crest
  const hy = 0.8, hz = 0.4;
  k.bone(BONE.HEAD, [0, 0.66, 0.29], () => {
  k.ell(0.13, 0.13, 0.15, [0, hy, hz], FEATH, { grad: [0.9, 1.06] });
  k.cone(0.072, 0.18, [0, hy - 0.01, hz + 0.09], BEAK, { r: [Math.PI / 2 + 0.12, 0, 0], seg: 5, grad: [0.9, 1.1] });
  k.cone(0.036, 0.08, [0, hy - 0.04, hz + 0.26], BEAK, { r: [Math.PI - 0.35, 0, 0], seg: 4 });
  k.sym(() => {
    k.ell(0.03, 0.034, 0.02, [0.075, hy + 0.025, hz + 0.105], INK, { d: 0, grad: [1, 1], ao: false });
    k.box(0.085, 0.032, 0.055, [0.07, hy + 0.068, hz + 0.08], U ? GOLD : FUR_D, { r: [0, -0.25, -0.35] });
  });
  for (let i = 0; i < 3; i++) k.cone(0.05, 0.24 - Math.abs(i - 1) * 0.04, [(i - 1) * 0.045, hy + 0.06, hz - 0.08], i === 1 ? (U ? ROYAL : FUR) : FEATH, { r: [-1.8 - Math.abs(i - 1) * 0.15, (i - 1) * 0.35, 0], seg: 4 });
  if (U) { // a gold crown
    k.lathe([[0.088, hy + 0.085], [0.094, hy + 0.14]], [0, 0, hz - 0.01], GOLD, { seg: 8, grad: [1, 1] });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.cone(0.03, 0.08, [Math.sin(a) * 0.09, hy + 0.13, hz - 0.01 + Math.cos(a) * 0.09], GOLD_L, { seg: 4 }); }
  }
  });
  // great wings raised in a V so the head stays clear
  k.sym(() => k.bone(BONE.WING_R, [0.12, 0.6, 0.02], () => wing(k, [0.12, 0.6, 0.02], {
    W: [0.26, 0.24, -0.06], T: U ? [0.64, 0.5, -0.26] : [0.58, 0.46, -0.24], len: U ? 0.52 : 0.45, drop: [0.15, -0.25, -1], dropIn: [0.1, -0.9, -0.5],
    n: 8, col: U ? GOLD : 0xf0922c, tip: U ? ROYAL : 0xc8501e, cov: 0xfff0c8, bone: U ? GOLD_L : 0xf8dc90, prim: 3,
  })));
  return k.done();
}

// Swordsman: steel plate, blue tabard and cape with gold crosses, great helm,
// huge blue shield with a gold cross, broad sword.
// Crusader: white surcoat and shield with crimson cross, crimson cape, gold crown and plume.
function swordsman(U) {
  const k = makeKit(U ? 43 : 41);
  const TAB = U ? WHITE : BLUE, CROSS = U ? CRIMSON : GOLD, CAPE = U ? CAPE_R : CAPE_B;
  const { R, L } = figure(k, {
    legs: STEEL, boots: STEEL_D, torso: STEEL, hips: STEEL_D, upper: STEEL, fore: STEEL_L, hand: STEEL_D, elbow: STEEL_L, knee: U ? GOLD : null,
    rh: [0.27, 0.56, 0.2], lh: [-0.22, 0.46, 0.2], pauldron: STEEL_L, pTrim: U ? GOLD : null, stance: 0.105, head: false, armR: 0.066,
  });
  cape(k, { y0: 0.16, y1: 0.7, r0: 0.26, r1: 0.2, col: CAPE, lin: U ? GOLD : BLUE_L, hem: GOLD, arc: 2.2 });
  k.bone(BONE.CLOTH, [0, 0.7, -0.01 - 0.2 * 0.85], () => { // the cross on the cape moves with it
    k.box(0.065, 0.3, 0.03, [0, 0.42, -0.215], GOLD, { r: [0.05, 0, 0] });
    k.box(0.2, 0.065, 0.03, [0, 0.49, -0.212], GOLD, { r: [0.05, 0, 0] });
  });
  // tabard with a bold cross
  k.box(0.26, 0.43, 0.03, [0, 0.47, 0.162], TAB, { r: [-0.1, 0, 0], grad: [0.85, 1.06] });
  k.box(0.065, 0.26, 0.02, [0, 0.49, 0.182], CROSS, { r: [-0.1, 0, 0] });
  k.box(0.19, 0.065, 0.02, [0, 0.54, 0.177], CROSS, { r: [-0.1, 0, 0] });
  if (U) k.box(0.27, 0.045, 0.036, [0, 0.27, 0.142], GOLD, { r: [-0.1, 0, 0], grad: [1, 1] });
  // great helm: bucket with a bold T visor
  k.bone(BONE.HEAD, NECK, () => {
  k.lathe([[0, HY - 0.13], [0.135, HY - 0.13], [0.15, HY - 0.07], [0.15, HY + 0.07], [0.13, HY + 0.13], [0, HY + 0.15]], [0, 0, 0], U ? STEEL_L : STEEL, { seg: 10, grad: [0.8, 1.15] });
  k.box(0.22, 0.036, 0.03, [0, HY + 0.02, 0.145], INK, { grad: [1, 1], ao: false });
  k.box(0.038, 0.12, 0.03, [0, HY - 0.05, 0.146], U ? GOLD : STEEL_D, { grad: [1, 1] });
  if (U) {
    k.lathe([[0.158, HY + 0.06], [0.158, HY + 0.115]], [0, 0, 0], GOLD, { seg: 10, grad: [1, 1] });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.cone(0.032, 0.08, [Math.sin(a) * 0.15, HY + 0.11, Math.cos(a) * 0.15], GOLD_L, { seg: 4 }); }
    plume(k, [0, HY + 0.15, -0.03], [WHITE, CRIMSON, WHITE], 1.25);
  } else {
    plume(k, [0, HY + 0.14, -0.02], [BLUE_L, WHITE], 0.95);
  }
  });
  // broad sword raised in the right hand, flat facing the camera
  k.bone(BONE.ARM_R, SH, () => k.at(R, [0.35, 0, -0.2], U ? 1.38 : 1.25, () => {
    k.box(0.22, 0.04, 0.05, [0, 0.03, 0], GOLD, { grad: [0.95, 1.08] });
    k.limb([0, -0.08, 0], [0, 0.02, 0], 0.022, 0.022, U ? CRIMSON : LEATHER, { seg: 5 });
    k.ball(0.034, [0, -0.09, 0], U ? 0xff6a5a : GOLD, { d: 0, glow: U });
    k.plate([[-0.046, 0], [0.046, 0], [0.04, 0.48], [0, 0.58], [-0.04, 0.48]], 0.022, [0, 0.05, 0], STEEL_L, { r: [0, 0.3, 0], grad: [0.9, 1.2] });
  }));
  k.bone(BONE.ARM_L, SHL, () => shield(k, [L[0] - 0.04, L[1] + 0.03, L[2] + 0.07], [0.05, -0.35, 0.04], 1.08, U ? WHITE : BLUE, GOLD, 'cross', U ? CRIMSON : GOLD));
  return k.done();
}

// Monk: long cream robe, blue scapular, bald head with brown fringe and beard,
// a staff crowned by a big caged golden orb.
// Zealot: crimson robe and pointed hood, gold stole and broad hem, white beard,
// a gold sun-ring staff and a holy flame in the free hand.
function monk(U) {
  const k = makeKit(U ? 59 : 53);
  const ROBE = U ? CRIMSON : CREAM, SCAP = U ? GOLD : BLUE;
  const SX = 0.27, SZ = 0.1;
  const { L } = figure(k, {
    robe: true, torso: ROBE, hips: ROBE, upper: ROBE, fore: ROBE, hand: SKIN, belt: GOLD, armR: 0.068, foreR: 0.08,
    rh: [SX - 0.035, 0.5, SZ], lh: [-0.2, 0.56, 0.2], head: !U,
  });
  // robe to the ground with a broad hem (CLOTH, hung from the waist)
  k.bone(BONE.CLOTH, [0, 0.5, 0], () => {
    k.lathe([[0.26, 0.0], [0.25, 0.06], [0.205, 0.25], [0.165, 0.42], [0.15, 0.5]], [0, 0, 0], ROBE, { s: [1, 1, 0.88], seg: 10, grad: [0.84, 1.04] });
    k.lathe([[0.268, 0.0], [0.264, U ? 0.075 : 0.055]], [0, 0, 0], U ? GOLD : BLUE, { s: [1, 1, 0.88], seg: 10, grad: [1, 1] });
  });
  // scapular / stole down the front and back
  const scap = [[0.27, 0.05], [0.258, 0.09], [0.213, 0.25], [0.173, 0.42], [0.163, 0.5], [0.172, 0.56], [0.2, 0.63], [0.21, 0.69], [0.13, 0.74]];
  for (const ph of [0, Math.PI]) k.lathe(scap, [0, 0, 0], SCAP, { s: [1, 1, 0.9], seg: 2, phi: ph - 0.3, len: 0.6, grad: [0.85, 1.08] });
  if (U) {
    sunBadge(k, [0, 0.6, 0.19], [-0.25, 0, 0], 1.35, 0xff6a5a);
    // raised pointed hood, face, white beard, gold rim around the face
    k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.16, 0.165, 0.16, [0, HY + 0.015, -0.025], CRIMSON, { grad: [0.88, 1.1] });
    k.cone(0.09, 0.22, [0, HY + 0.08, -0.08], CRIMSON, { r: [-0.6, 0, 0], seg: 5 });
    k.ell(0.122, 0.125, 0.1, [0, HY - 0.012, 0.06], SKIN, { grad: [0.95, 1.05] });
    eyes(k, HY + 0.005, 0.148);
    k.torus(0.125, 0.026, [0, HY - 0.005, 0.085], GOLD, { seg: 12, ts: 4, s: [1, 1.08, 1] });
    k.ell(0.09, 0.095, 0.055, [0, HY - 0.085, 0.13], WHITE, { d: 1 });
    });
  } else {
    k.torus(0.135, 0.06, [0, 0.725, -0.01], BLUE, { r: [Math.PI / 2 + 0.2, 0, 0], seg: 10, ts: 5 }); // cowl
    k.bone(BONE.HEAD, NECK, () => {
      k.ell(0.142, 0.095, 0.13, [0, HY - 0.012, -0.03], BROWN, {}); // tonsure fringe
      k.ell(0.085, 0.08, 0.055, [0, HY - 0.085, 0.105], BROWN, { d: 1 }); // beard
    });
  }
  // staff in the right hand (ARM_R); the free hand's holy light rides ARM_L
  const top = U ? 0.86 : 0.88;
  k.bone(BONE.ARM_R, SH, () => {
  k.limb([SX, 0.02, SZ], [SX, top, SZ], 0.028, 0.024, U ? CREAM : WOOD, { seg: 6, grad: [0.85, 1.12] });
  k.cyl(0.042, 0.048, 0.07, [SX, top - 0.03, SZ], GOLD, { seg: 6 });
  if (!U) {
    k.ball(0.1, [SX, top + 0.1, SZ], 0xffd050, { glow: true, d: 1 });
    k.torus(0.112, 0.02, [SX, top + 0.1, SZ], GOLD, { r: [0, 0.6, 0], seg: 12 });
    k.torus(0.112, 0.02, [SX, top + 0.1, SZ], GOLD, { r: [0, 0.6 + Math.PI / 2, 0], seg: 12 });
    k.bone(BONE.ARM_L, SHL, () => k.ball(0.055, [L[0], L[1] + 0.08, L[2] + 0.02], 0xffe080, { glow: true, d: 1 }));
  } else {
    const c = [SX, top + 0.12, SZ];
    k.torus(0.105, 0.026, c, GOLD, { seg: 14, grad: [0.95, 1.08] });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cone(0.03, 0.065, [c[0] + Math.sin(a) * 0.12, c[1] + Math.cos(a) * 0.12, c[2]], GOLD_L, { r: [0, 0, -a], seg: 3 }); }
    k.ball(0.08, c, 0xffc040, { glow: true, d: 1 });
    k.ball(0.05, [c[0], c[1], c[2] + 0.05], 0xfff4c0, { glow: true, d: 0 });
    k.bone(BONE.ARM_L, SHL, () => {
      k.ball(0.05, [L[0], L[1] + 0.06, L[2] + 0.02], 0xffa030, { glow: true, d: 0 });
      k.cone(0.04, 0.13, [L[0], L[1] + 0.07, L[2] + 0.02], 0xfff0a0, { glow: true, seg: 4 });
    });
  }
  });
  return k.done();
}

// Cavalier: white horse in a blue caparison with gold hem and crosses, a steel knight
// with a tricolour plume, couched lance and sun shield.
// Champion: royal caparison with gold suns, gilded armour and chanfron with a horn,
// crowned helm and a huge plume, gilded lance with a long pennant.
function cavalier(U) {
  const k = makeKit(U ? 71 : 67, [0, 0.64, -0.03]);
  const HORSE = 0xfbf8f2, HORSE_D = 0xe4ddd2, MANE = U ? 0xf6e2a8 : 0xf0dcb0, HOOF = 0xa07e5c, CAP = U ? ROYAL : BLUE;
  k.ell(0.2, 0.2, 0.4, [0, 0.64, -0.03], HORSE, { grad: [0.85, 1.06] });
  k.ell(0.18, 0.21, 0.18, [0, 0.68, 0.24], HORSE, {});
  const legsAt = [[0.1, 0.3, 0.12, BONE.LEG_FR], [-0.1, 0.24, -0.04, BONE.LEG_FL], [0.1, -0.3, -0.06, BONE.LEG_BR], [-0.1, -0.28, 0.06, BONE.LEG_BL]];
  for (const [x, z, sw, bn] of legsAt) k.bone(bn, [x, 0.6, z], () => {
    k.limb([x, 0.6, z], [x, 0.33, z + sw * 0.5], 0.08, 0.055, HORSE_D, { seg: 5 });
    k.limb([x, 0.33, z + sw * 0.5], [x, 0.06, z + sw], 0.05, 0.044, HORSE_D, { seg: 5 });
    k.cyl(0.056, 0.05, 0.075, [x, 0.0, z + sw], HOOF, { seg: 6, ao: false });
  });
  // neck, mane ridge, big head (+ the champion's crinet): HEAD from the withers
  k.bone(BONE.HEAD, [0, 0.76, 0.3], () => {
  k.limb([0, 0.74, 0.3], [0, 1.0, 0.47], 0.12, 0.09, HORSE, { seg: 7 });
  k.limb([0, 0.8, 0.235], [0, 1.07, 0.4], 0.055, 0.042, MANE, { seg: 5 });
  k.at([0, 1.02, 0.52], [0.95, 0, 0], 1, () => {
    k.ell(0.082, 0.09, 0.19, [0, 0, 0.09], HORSE, {});
    k.ell(0.072, 0.075, 0.08, [0, -0.015, 0.24], HORSE_D, {});
    k.ell(0.064, 0.042, 0.16, [0, 0.06, 0.1], U ? GOLD : STEEL, { grad: [0.85, 1.12] }); // chanfron
    if (U) k.cone(0.034, 0.16, [0, 0.09, 0.05], GOLD_L, { r: [-0.55, 0, 0], seg: 4 });
    k.sym(() => k.cone(0.032, 0.1, [0.05, 0.06, -0.04], HORSE, { r: [-0.5, 0, 0.25], seg: 4 }));
  });
  if (U) for (let i = 0; i < 2; i++) k.box(0.15, 0.05, 0.11, [0, 0.87 + i * 0.13, 0.33 + i * 0.09], GOLD, { r: [0.95, 0, 0] }); // gold crinet
  });
  // tail
  k.bone(BONE.TAIL, [0, 0.72, -0.42], () => {
    k.limb([0, 0.72, -0.42], [0, 0.55, -0.55], 0.06, 0.05, MANE);
    k.limb([0, 0.55, -0.55], [0, 0.28, -0.56], 0.05, 0.03, MANE);
  });
  // caparison with a broad gold hem and flank emblems
  k.lathe([[0.226, 0.4], [0.216, 0.5], [0.2, 0.66], [0.16, 0.78], [0.06, 0.84]], [0, 0, -0.04], CAP, { s: [1, 1, 2.0], seg: 10, grad: [0.84, 1.08] });
  k.lathe([[0.234, U ? 0.37 : 0.38], [0.229, 0.43]], [0, 0, -0.04], GOLD, { s: [1, 1, 2.0], seg: 10, grad: [1, 1] });
  k.sym(() => {
    if (U) sunBadge(k, [0.218, 0.57, -0.12], [0, Math.PI / 2, 0], 1.7);
    else { k.box(0.03, 0.17, 0.055, [0.218, 0.57, -0.12], GOLD, { r: [0, 0, 0.1] }); k.box(0.03, 0.055, 0.16, [0.215, 0.6, -0.12], GOLD, { r: [0, 0, 0.1] }); }
  });
  k.box(0.28, 0.06, 0.25, [0, 0.84, -0.04], RED, { grad: [0.92, 1.06] });
  k.box(0.22, 0.09, 0.05, [0, 0.88, -0.15], GOLD, {});
  // rider: RIDER pivoting at the saddle; its arms ARM_R / ARM_L, cape CLOTH
  let H;
  k.at([0, 0.47, -0.03], [0, 0, 0], 0.8, () => k.bone(BONE.RIDER, HIPS, () => {
    H = figure(k, {
      sit: true, legs: U ? GOLD : STEEL, boots: STEEL_D, torso: U ? GOLD : STEEL, hips: CAP, upper: STEEL, fore: U ? GOLD : STEEL, hand: STEEL_D, elbow: STEEL_L,
      pauldron: U ? GOLD : STEEL_L, pTrim: U ? GOLD_L : null, rh: [0.2, 0.5, 0.14], lh: [-0.2, 0.5, 0.2], head: false, armR: 0.066,
    });
    cape(k, { y0: 0.36, y1: 0.7, r0: 0.27, r1: 0.2, col: U ? 0x4a74f0 : CAPE_B, lin: GOLD, hem: GOLD, arc: 2.2 });
    k.box(0.25, 0.3, 0.03, [0, 0.55, 0.158], CAP, { r: [-0.1, 0, 0] });
    if (U) sunBadge(k, [0, 0.57, 0.178], [-0.1, 0, 0], 1.3);
    else { k.box(0.06, 0.2, 0.02, [0, 0.56, 0.175], GOLD, { r: [-0.1, 0, 0] }); k.box(0.16, 0.06, 0.02, [0, 0.6, 0.172], GOLD, { r: [-0.1, 0, 0] }); }
    k.lathe([[0, HY - 0.13], [0.135, HY - 0.13], [0.15, HY - 0.06], [0.15, HY + 0.06], [0.11, HY + 0.13], [0, HY + 0.15]], [0, 0, 0], U ? STEEL_L : STEEL, { seg: 10, grad: [0.8, 1.15] });
    k.box(0.21, 0.036, 0.03, [0, HY + 0.01, 0.146], INK, { grad: [1, 1], ao: false });
    if (U) {
      k.lathe([[0.158, HY + 0.04], [0.158, HY + 0.095]], [0, 0, 0], GOLD, { seg: 10, grad: [1, 1] });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.cone(0.032, 0.08, [Math.sin(a) * 0.15, HY + 0.09, Math.cos(a) * 0.15], GOLD_L, { seg: 4 }); }
      plume(k, [0, HY + 0.13, -0.03], [WHITE, CRIMSON, WHITE], 1.5);
    } else {
      plume(k, [0, HY + 0.13, -0.03], [WHITE, BLUE_L, RED], 1.25);
    }
  }));
  const toW = (p) => [p[0] * 0.8, 0.47 + p[1] * 0.8, -0.03 + p[2] * 0.8];
  const rh = toW(H.R), lhw = toW(H.L);
  k.bone(BONE.ARM_R, toW(SH), () => {
  // couched lance, thick, with coloured bands, vamplate and a big pennant
  const a = [rh[0] + 0.03, rh[1] - 0.05, rh[2] - 0.3], b = [rh[0] + 0.1, rh[1] + 0.28, rh[2] + (U ? 1.0 : 0.92)];
  const pt = (t) => a.map((v, j) => v + (b[j] - v) * t);
  k.limb(a, b, 0.042, 0.015, U ? GOLD_L : WHITE, { seg: 6, grad: [0.95, 1.08] });
  for (let i = 0; i < 2; i++) { const t = 0.42 + i * 0.16; k.limb(pt(t), pt(t + 0.06), 0.033 - i * 0.004, 0.031 - i * 0.004, U ? ROYAL : BLUE, { seg: 6 }); }
  k.stick(new THREE.ConeGeometry(0.085, 0.13, 8).rotateX(Math.PI).translate(0, 0.065, 0), [rh[0] + 0.03, rh[1] - 0.04, rh[2] + 0.03], [rh[0] + 0.033, rh[1] - 0.03, rh[2] + 0.16], U ? GOLD : STEEL_L, {});
  const ang = Math.atan2(b[1] - a[1], b[2] - a[2]);
  k.plate(U ? [[0, 0], [0, 0.17], [0.36, 0.13], [0.24, 0.085], [0.36, 0.04]] : [[0, 0], [0, 0.16], [0.28, 0.12], [0.18, 0.08], [0.28, 0.04]], 0.012, pt(0.86), CAP, { r: [-ang + Math.PI / 2, Math.PI / 2 + 0.25, Math.PI], grad: [0.9, 1.08], both: true });
  });
  k.bone(BONE.ARM_L, toW(SHL), () => shield(k, [lhw[0] - 0.04, lhw[1], lhw[2] + 0.03], [0.05, -0.5, 0.04], 0.85, CAP, GOLD, 'sun'));
  return k.done();
}

// Angel: golden armour, long white skirt, golden hair, glowing halo, big white
// wings with gold tips, a flaming sword.
// Archangel: royal-blue skirt with a broad gold hem, double halo, bigger wings
// with gold bands, a larger blazing sword.
function angel(U) {
  const ARM = 0xffc844, SKIRT = U ? ROYAL : WHITE, HAIR = 0xffd868, S = 1.2;
  const k = makeKit(U ? 83 : 79, HIPS.map((v) => v * S));
  let H;
  k.at([0, 0, 0], [0, 0, 0], S, () => {
    H = figure(k, {
      legs: ARM, boots: GOLD, torso: ARM, hips: SKIRT, upper: SKIN, fore: ARM, hand: SKIN, elbow: SKIN, pauldron: ARM, pTrim: U ? WHITE : null,
      belt: U ? GOLD_L : BLUE, rh: [0.26, 0.62, 0.2], lh: [-0.23, 0.4, 0.12], head: false, torsoGrad: [0.86, 1.14], stance: 0.07,
    });
    k.bone(BONE.CLOTH, [0, 0.46, 0], () => { // long skirt hung from the waist
      k.lathe([[0.215, 0.0], [0.205, 0.1], [0.17, 0.3], [0.15, 0.46]], [0, 0, 0], SKIRT, { s: [1, 1, 0.86], seg: 10, grad: [0.88, 1.05] });
      k.lathe([[0.222, 0.0], [0.218, U ? 0.07 : 0.05]], [0, 0, 0], U ? GOLD : BLUE, { s: [1, 1, 0.86], seg: 10, grad: [1, 1] });
    });
    // golden hair, face, circlet, halo(s): HEAD
    k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.152, 0.152, 0.152, [0, HY + 0.02, -0.025], HAIR, { grad: [0.85, 1.12] });
    k.ell(0.135, 0.17, 0.075, [0, HY - 0.1, -0.085], HAIR, {});
    k.ell(0.125, 0.13, 0.12, [0, HY - 0.005, 0.03], SKIN, { grad: [0.95, 1.05] });
    eyes(k, HY, 0.14, 0x3a5ab8);
    k.lathe([[0.156, HY + 0.035], [0.156, HY + 0.07]], [0, 0, -0.02], GOLD, { seg: 10, grad: [1, 1] });
    k.torus(0.13, 0.024, [0, HY + 0.25, -0.05], 0xffe070, { glow: true, r: [Math.PI / 2 - 0.25, 0, 0], seg: 16, ts: 4 });
    if (U) k.torus(0.18, 0.016, [0, HY + 0.23, -0.06], 0xfff6c0, { glow: true, r: [Math.PI / 2 - 0.25, 0, 0], seg: 18, ts: 3 });
    });
  });
  const rh = H.R.map((v) => v * S);
  // flaming sword raised forward
  k.bone(BONE.ARM_R, SH.map((v) => v * S), () => k.at(rh, [0.45, 0, -0.2], U ? 1.4 : 1.2, () => {
    k.box(0.22, 0.04, 0.05, [0, 0.03, 0], GOLD, {});
    k.limb([0, -0.08, 0], [0, 0.02, 0], 0.022, 0.022, U ? ROYAL : BLUE_D, { seg: 5 });
    k.ball(0.032, [0, -0.09, 0], GOLD, { d: 0 });
    k.plate([[-0.042, 0], [0.042, 0], [0.036, 0.48], [0, 0.58], [-0.036, 0.48]], 0.02, [0, 0.05, 0], 0xfff6d0, { r: [0, 0.3, 0], glow: true });
    for (let i = 0; i < 3; i++) {
      const sd = i % 2 ? 1 : -1;
      k.cone(0.05 - i * 0.006, 0.2, [0, 0.1 + i * 0.15, sd * 0.015], i % 2 ? 0xff7a1a : 0xffb030, { glow: true, r: [sd * 0.3, 0.3, sd * 0.12], seg: 4 });
    }
    k.cone(0.035, 0.18, [0, 0.52, 0], 0xffd050, { glow: true, seg: 4 });
  }));
  // great wings sweeping up from the shoulder blades
  k.sym(() => k.bone(BONE.WING_R, [0.1, 0.86, -0.14], () => wing(k, [0.1, 0.86, -0.14], {
    W: [0.32, 0.24, -0.12], T: U ? [0.74, 0.5, -0.32] : [0.66, 0.44, -0.3], len: U ? 0.72 : 0.6, n: 9,
    col: U ? 0xfff6e0 : 0xf6f4ff, tip: U ? GOLD : 0xffd060, cov: WHITE, bone: U ? GOLD_L : 0xfff4d0,
    drop: [0.08, -0.4, -1], dropIn: [0.05, -1, -0.45], prim: 3,
  })));
  return k.done();
}

const BUILDERS = { pikeman, archer, griffin, swordsman, monk, cavalier, angel };
export const HAVEN_IDS = Object.keys(BUILDERS);
// havenBuild(baseId, upgraded) -> { body, glow } or null; used by units_haven_up.js
export function havenBuild(id, up = false) {
  const f = BUILDERS[id];
  return f ? f(!!up) : null;
}
export function havenModel(id) {
  return havenBuild(id, false);
}
