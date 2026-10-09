import * as THREE from 'three';
import { BONE } from './rig.js?v=1.5';

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
  const { root, elbow, wrist, tips, back, mem, bone, r = 0.05, claw, edge } = o;
  k.limb(root, elbow, r, r * 0.85, bone, { seg: 6 }); k.ball(r * 0.95, elbow, bone, { d: 0 });
  k.limb(elbow, wrist, r * 0.85, r * 0.7, bone, { seg: 6 }); k.ball(r * 0.85, wrist, bone, { d: 0 });
  if (claw) k.cone(r * 0.7, r * 2.6, wrist, claw, { r: [0, 0, -0.3], seg: 4 });
  for (const t of tips) k.limb(wrist, t, r * 0.55, r * 0.22, bone, { seg: 5 });
  const anchors = [...tips, back], P = [], E = [];
  const tri = (A, a, b, c) => A.push(...a, ...b, ...c);
  const f = edge ? 0.16 : 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = L3(anchors[i], wrist, 0.03), b = L3(anchors[i + 1], wrist, 0.03);
    const m = L3(L3(a, b, 0.5), wrist, i === anchors.length - 2 ? 0.12 : 0.24);
    const ai = L3(a, wrist, f), mi = L3(m, wrist, f), bi = L3(b, wrist, f);
    tri(P, wrist, ai, mi); tri(P, wrist, mi, bi);
    // a bright trailing-edge band (reads as the wing's outline at phone size)
    if (edge) { tri(E, a, m, mi); tri(E, a, mi, ai); tri(E, m, b, bi); tri(E, m, bi, mi); }
  }
  tri(P, wrist, back, elbow); tri(P, elbow, back, root);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  k.add(g, mem, { both: true, grad: [0.86, 1.12], noise: 0.02 });
  if (edge) {
    const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(E, 3));
    k.add(ge, edge, { both: true, grad: [1, 1], noise: 0.01, ao: false });
  }
}

// ---------------------------------------------------------------- creatures
// Troglodyte: blind lavender lizard-man, big eyeless head with a teal crest,
// teal loincloth, back spikes, thick tail, a long spear with a pale flint head.
// Infernal troglodyte: rose-crimson hide, curled gold horns, violet loincloth,
// gold torque and a bone pauldron, a spear with a glowing magenta crystal.
function troglodyte(U) {
  const k = makeKit(U ? 103 : 101);
  const SK = U ? 0xe2687e : 0x9e8ad8, SK_D = U ? 0xc04a64 : 0x7e6ac4, BELLY = U ? 0xffc8a8 : 0xe6daf6;
  const CL = U ? VIO : TEAL, CREST = U ? GOLD : TEAL_L;
  const A = [0.16, 0.04, 0.03], B = [0.56, 0.92, 0.3], P = (t) => L3(A, B, t);
  figure(k, {
    legs: SK, boots: SK_D, torso: SK, hips: SK_D, upper: SK, fore: SK, hand: SK_D, rh: P(0.4), lh: [-0.25, 0.44, 0.12],
    stance: 0.12, head: false, belt: U ? GOLD : TEAL_D, armR: 0.07, foreR: 0.062, handR: 0.066, torsoGrad: [0.86, 1.1],
  });
  k.ell(0.13, 0.17, 0.06, [0, 0.55, 0.125], BELLY, { r: [-0.12, 0, 0], grad: [0.95, 1.05] });
  // loincloth skirt with a front flap
  k.lathe([[0.2, 0.27], [0.175, 0.36], [0.16, 0.45]], [0, 0, 0], CL, { s: [1, 1, 0.82], seg: 9, grad: [0.85, 1.05] });
  k.box(0.13, 0.2, 0.03, [0, 0.3, 0.145], CL, { r: [-0.08, 0, 0] });
  // back spikes
  for (let i = 0; i < 3; i++) k.cone(0.05 - i * 0.006, 0.15 - i * 0.02, [0, 0.66 - i * 0.1, -0.13 + i * 0.005], CREST, { r: [-1.0, 0, 0], seg: 4 });
  // thick tail to the ground
  k.bone(BONE.TAIL, [0, 0.4, -0.1], () => tube(k, [[0, 0.42, -0.08], [0, 0.26, -0.26], [0.05, 0.1, -0.42], [0.16, 0.04, -0.54]], 0.085, 0.012, SK, { seg: 6, n: 9 }));
  if (U) {
    k.torus(0.13, 0.03, [0, 0.705, 0.0], GOLD, { r: [Math.PI / 2 + 0.15, 0, 0], seg: 10, ts: 4 });
    k.bone(BONE.ARM_L, SHL, () => {
      k.ell(0.12, 0.08, 0.12, [-0.21, 0.69, 0], BONEC, { r: [0, 0, 0.4] });
      for (let i = 0; i < 2; i++) k.cone(0.035, 0.12, [-0.24 + i * 0.06, 0.74, -0.02], BONEC, { r: [0, 0, 0.5 - i * 0.4], seg: 4 });
    });
  }
  // eyeless lizard head: cranium, long snout, pale jaw, a wide mouth slit, heavy
  // shut brows (blind) and a crest frill (gold horns when infernal)
  k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.15, 0.13, 0.15, [0, HY, 0], SK, { grad: [0.9, 1.1] });
    k.ell(0.115, 0.085, 0.18, [0, HY - 0.035, 0.16], SK, {});
    k.ell(0.1, 0.05, 0.16, [0, HY - 0.1, 0.14], BELLY, {});
    k.box(0.18, 0.024, 0.2, [0, HY - 0.074, 0.15], MOUTH, { ao: false, grad: [1, 1] });
    k.sym(() => k.ell(0.055, 0.032, 0.05, [0.07, HY + 0.035, 0.115], SK_D, { d: 0, r: [0, 0, -0.25] }));
    for (let i = 0; i < 3; i++) k.cone(0.055 - i * 0.008, 0.18 - i * 0.03, [0, HY + 0.09 - i * 0.04, -0.03 - i * 0.07], CREST, { r: [-1.15 - i * 0.2, 0, 0], seg: 4 });
    if (U) k.sym(() => tube(k, [[0.08, HY + 0.08, 0.02], [0.17, HY + 0.13, -0.02], [0.2, HY + 0.22, 0.04]], 0.04, 0.008, GOLD_L, { seg: 5, n: 6 }));
  });
  // spear: wood shaft, teal / gold binding, a pale flint (or glowing crystal) head
  k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (L) => {
    k.limb([0, 0, 0], [0, L, 0], 0.03, 0.026, WOOD, { seg: 6, grad: [0.88, 1.1] });
    k.cyl(0.044, 0.04, 0.08, [0, L - 0.06, 0], U ? GOLD : TEAL, { seg: 6 });
    if (U) {
      k.ell(0.055, 0.17, 0.055, [0, L + 0.13, 0], G_MAG, { glow: true, d: 0 });
      k.ell(0.075, 0.06, 0.075, [0, L, 0], GOLD, { d: 0 });
    } else leafHead(k, [0, L - 0.02, 0], 0.3, 0.085, BONEC);
  }));
  return k.done();
}

// Harpy: emerald-teal feathered woman, wings for arms (violet tips), wild
// magenta hair, big yellow bird legs with hooked talons.
// Harpy hag: plum feathers with hot-magenta tips, silver wild hair, gold
// necklace, glowing red eyes, bigger wings and talons.
function harpy(U) {
  const k = makeKit(U ? 113 : 111, [0, 0.45, 0]);
  const FE = U ? 0xa244a6 : 0x2fb48c, FE_D = U ? 0x7e3088 : 0x23947a, TIP = U ? MAG : 0x8a5ae0;
  const SKN = U ? 0xdcbce6 : 0xf4c8b4, HAIR = U ? 0xeef0ff : 0xe84aa8, TAL = 0xf6c040, CLAW = U ? 0xffe8f0 : 0x7a5aa8;
  // bird legs: feathered thighs, scaly yellow shins, three big forward talons + one back
  k.sym(() => k.bone(BONE.LEG_FR, [0.09, 0.42, 0], () => {
    k.ell(0.095, 0.13, 0.105, [0.1, 0.34, 0.0], FE, { grad: [0.88, 1.08] });
    k.limb([0.11, 0.25, 0.0], [0.12, 0.06, 0.03], 0.042, 0.036, TAL);
    const ts = U ? 1.15 : 1;
    for (const t of [-1, 0, 1]) {
      k.cone(0.032 * ts, 0.14 * ts, [0.12 + t * 0.034, 0.045, 0.04], TAL, { r: [Math.PI / 2 - 0.25, 0, -t * 0.4], seg: 4 });
      k.cone(0.022 * ts, 0.07 * ts, [0.12 + t * 0.07, 0.04, 0.17 * ts], CLAW, { r: [Math.PI - 0.6, 0, -t * 0.4], seg: 4 });
    }
    k.cone(0.03, 0.11, [0.12, 0.05, 0.0], TAL, { r: [-Math.PI / 2 - 0.3, 0, 0], seg: 4 });
  }));
  // feather skirt + tail fan
  k.ell(0.16, 0.11, 0.13, [0, 0.45, 0], FE_D, {});
  k.bone(BONE.TAIL, [0, 0.44, -0.1], () => {
    for (let i = 0; i < 3; i++) k.feather([(i - 1) * 0.04, 0.44, -0.1], [(i - 1) * 0.13, 0.3, -0.38], 0.12, i === 1 ? TIP : FE, { t: 0.02 });
  });
  // feathered body, skin shoulders / neck, a ruff of tip-coloured feathers
  k.lathe([[0.135, 0.4], [0.155, 0.48], [0.18, 0.56], [0.19, 0.63], [0.17, 0.69], [0.1, 0.73], [0.03, 0.745]], [0, 0, 0], FE, { s: [1, 1, 0.78], seg: 10, grad: [0.84, 1.1] });
  k.lathe([[0.165, 0.6], [0.2, 0.64], [0.19, 0.69], [0.11, 0.73], [0.04, 0.745]], [0, 0, 0.005], SKN, { s: [1, 1, 0.8], seg: 10, grad: [0.92, 1.05] });
  for (let i = 0; i < 6; i++) { const a = -1.1 + (i / 5) * 2.2; k.cone(0.05, 0.1, [Math.sin(a) * 0.17, 0.6, Math.cos(a) * 0.13], TIP, { r: [Math.PI - 0.5, a, 0], seg: 4 }); }
  if (U) k.torus(0.12, 0.024, [0, 0.69, 0.02], GOLD, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 10, ts: 4 });
  // head: face, fierce brows, a big mane of wild hair sweeping back
  k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.125, 0.13, 0.12, [0, HY, 0.02], SKN, { grad: [0.95, 1.05] });
    if (U) k.sym(() => k.ell(0.026, 0.026, 0.014, [0.05, HY + 0.005, 0.13], G_RED, { glow: true, d: 0 }));
    else eyes(k, HY + 0.005, 0.128);
    k.sym(() => k.box(0.07, 0.022, 0.03, [0.05, HY + 0.045, 0.125], HAIR === 0xeef0ff ? 0x9a8ab8 : 0xa83a7a, { r: [0, 0, -0.35] }));
    k.ell(0.145, 0.15, 0.13, [0, HY + 0.06, -0.07], HAIR, { grad: [0.88, 1.12] });
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.45;
      k.cone(0.065, 0.24, [Math.sin(a) * 0.08, HY + 0.09, -0.08], HAIR, { r: [-2.0 + Math.abs(i - 2) * 0.15, 0, a * 0.9], seg: 4 });
    }
  });
  // wings for arms (shoulder -> wrist -> tip), raised in a V
  k.sym(() => k.bone(BONE.WING_R, [0.16, 0.64, -0.02], () => wing(k, [0.16, 0.64, -0.02], {
    W: [0.2, 0.24, 0.0], T: U ? [0.46, 0.6, -0.16] : [0.42, 0.55, -0.14], len: U ? 0.42 : 0.38, drop: [0.15, -0.3, -1], dropIn: [0.05, -1, -0.3],
    n: 8, col: FE, tip: TIP, cov: FE_D, bone: SKN, prim: 3, th: 0.018,
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
  const R = 0.35;
  k.ell(R, R * 0.96, R * 0.95, C, BOD, { d: 2, grad: [0.78, 1.12] });
  // belly paler (value band)
  k.ell(R * 0.8, R * 0.5, R * 0.8, [0, C[1] - 0.12, 0.02], U ? 0xe27ab8 : 0xd292ec, { d: 1 });
  // the great eye
  k.ell(0.21, 0.19, 0.1, [0, 0.61, 0.26], LID, { d: 1 });
  k.ell(0.175, 0.16, 0.09, [0, 0.6, 0.3], SCL, { d: 1, grad: [0.95, 1.05], ao: false });
  k.ell(0.1, 0.1, 0.03, [0, 0.6, 0.378], IRIS, { glow: true, d: 1 });
  k.ell(0.032, 0.07, 0.02, [0, 0.6, 0.398], PUP, { glow: true, d: 0 });
  // heavy angry upper lid
  k.ell(0.21, 0.075, 0.12, [0, 0.745, 0.25], LID, { r: [0.35, 0, 0] });
  // wide grin: dark mouth band, teeth top and bottom
  k.ell(0.24, 0.065, 0.1, [0, 0.39, 0.22], MOUTH, { r: [-0.25, 0, 0], ao: false });
  const nT = U ? 9 : 7;
  for (let i = 0; i < nT; i++) {
    const a = (i / (nT - 1) - 0.5) * 1.5, x = Math.sin(a) * 0.23, z = Math.cos(a) * 0.29 - 0.03;
    k.cone(0.03, U ? 0.08 : 0.065, [x, 0.43, z], BONEC, { r: [Math.PI, 0, 0], seg: 4 });
    if (i % 2) k.cone(0.026, 0.05, [x, 0.35, z - 0.01], BONEC, { seg: 4 });
  }
  // eye-stalks: each its own HEAD bone pivoting at its root on the orb
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
      tube(k, [base.toArray(), p1.toArray(), tip.toArray()], 0.035, 0.026, BOD, { seg: 6, n: 5 });
      k.ball(0.058, tip.toArray(), SCL, { d: 1, ao: false });
      const fw = V3([out.x * 0.5, 0.1, 1]).normalize();
      k.ball(0.032, tip.clone().addScaledVector(fw, 0.042).toArray(), IRIS, { glow: true, d: 0 });
      k.ell(0.064, 0.03, 0.064, tip.clone().add(V3([0, 0.035, -0.01])).toArray(), LID, { d: 0 });
    });
  }
  if (U) for (let i = 0; i < 5; i++) { // gold horn spikes around the back and sides
    const a = Math.PI * 0.5 + (i / 4) * Math.PI;
    k.cone(0.05, 0.16, [Math.sin(a) * R * 0.92, 0.6 + (i % 2) * 0.06, Math.cos(a) * R * 0.92], GOLD, { r: [Math.cos(a) * 1.3, 0, -Math.sin(a) * 1.3], seg: 4 });
  }
  if (U) k.sym(() => k.cone(0.045, 0.14, [0.17, 0.76, 0.22], GOLD_L, { r: [0.4, 0, -0.7], seg: 4 }));
  // tendrils hanging below (TAIL), reaching the ground
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.9, x = Math.sin(a) * 0.12, z = Math.cos(a) * 0.08 - 0.06;
    k.bone(BONE.TAIL, [x, 0.27, z], () => tube(k, [[x, 0.3, z], [x * 1.4, 0.16, z + 0.02], [x * 1.2 + 0.03, 0.02, z + 0.08]], 0.05, 0.012, LID, { seg: 5, n: 6 }));
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
  const SNK = U ? 0x2cb8a8 : 0x46b84a, SNH = U ? GOLD : MAG;
  // coil: from the hips down and around, the tail curling up at the front-right
  const coil = [[0, 0.46, 0.0], [0, 0.3, 0.04], [0.12, 0.15, 0.13], [0.25, 0.09, 0.0], [0.18, 0.085, -0.19], [-0.02, 0.085, -0.25], [-0.21, 0.085, -0.14], [-0.24, 0.08, 0.06], [-0.09, 0.07, 0.21]];
  const tail = [[-0.09, 0.07, 0.21], [0.08, 0.06, 0.27], [0.24, 0.08, 0.22], [0.31, 0.17, 0.12], [0.3, 0.26, 0.04]];
  tube(k, coil, 0.135, 0.075, SC, { n: 28, seg: 8, bands: stripes(0.08, 1, 7, SC, BAND), rad: (t) => 0.14 - 0.06 * t, cap: false });
  k.ell(0.13, 0.1, 0.13, [0, 0.44, 0], SC, { d: 1 });
  k.bone(BONE.TAIL, tail[0], () => tube(k, tail, 0.08, 0.01, SC, { n: 14, seg: 7, bands: stripes(0, 0.85, 3, SC, BAND).concat([[0.85, 1, BAND]]), rad: (t) => 0.08 * (1 - t) + 0.008 }));
  // torso + arms, bow pose like an archer
  const bowP = [-0.27, 0.6, 0.2], draw = [0.02, 0.64, 0.1];
  figure(k, { robe: true, torso: SKN, hips: SC, upper: SKN, fore: SKN, hand: SKN, rh: draw, lh: bowP, head: false, armR: 0.058, foreR: 0.052, handR: 0.054 });
  k.lathe([[0.17, 0.55], [0.19, 0.6], [0.2, 0.64], [0.16, 0.67]], [0, 0, 0.01], TOP, { s: [1, 1, 0.82], seg: 10, grad: [0.9, 1.08] });
  if (U) { k.lathe([[0.165, 0.43], [0.16, 0.49]], [0, 0, 0], GOLD, { s: [1, 1, 0.82], seg: 10, grad: [1, 1] }); k.torus(0.12, 0.022, [0, 0.705, 0.02], GOLD, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 10, ts: 4 }); }
  // head with glowing eyes and a crown of snakes (all HEAD)
  k.bone(BONE.HEAD, NECK, () => {
    k.ell(HR * 1.02, HR * 1.06, HR, [0, HY, 0.01], SKN, { grad: [0.95, 1.05] });
    k.sym(() => k.ell(0.03, 0.022, 0.014, [0.05, HY + 0.005, 0.124], U ? G_MAG : G_GOLD, { glow: true, d: 0 }));
    k.ell(0.14, 0.12, 0.13, [0, HY + 0.05, -0.02], SNK, {});
    const nH = U ? 9 : 8;
    for (let i = 0; i < nH; i++) {
      const a = (i / nH) * Math.PI * 2 + 0.35, sx = Math.sin(a), cz = Math.cos(a);
      if (cz > 0.75) continue; // keep the face clear
      const b = [sx * 0.1, HY + 0.08, cz * 0.09 - 0.02];
      const m = [sx * 0.22, HY + 0.16 + (i % 2) * 0.05, cz * 0.18 - 0.05];
      const t = [sx * (U ? 0.3 : 0.27), HY + 0.12 + (i % 2) * 0.1, cz * 0.22 - 0.02 + 0.06];
      tube(k, [b, m, t], 0.034, 0.026, SNK, { seg: 5, n: 5 });
      k.ell(0.042, 0.032, 0.055, t, SNH, { d: 0 });
    }
    if (U) for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 1.6; k.cone(0.03, 0.11 - Math.abs(i - 2) * 0.015, [Math.sin(a) * 0.12, HY + 0.12, Math.cos(a) * 0.08 + 0.02], GOLD_L, { seg: 4 }); }
  });
  // bow (ARM_L) and nocked arrow (ARM_R)
  const bowH = U ? 0.45 : 0.41, bend = 0.12, pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 4 - 1; pts.push([bowP[0], bowP[1] + t * bowH, bowP[2] + 0.02 - t * t * bend + (U ? Math.pow(Math.abs(t), 5) * 0.09 : 0)]); }
  const R = [draw[0], draw[1], draw[2] - 0.02];
  k.bone(BONE.ARM_L, SHL, () => {
    for (let i = 0; i < 8; i++) {
      const r = 0.034 - Math.abs(i - 3.5) * 0.0028, c = i === 3 || i === 4 ? (U ? VIO : GOLD) : (U ? GOLD : 0xc0884a);
      k.limb(pts[i], pts[i + 1], r, r, c, { seg: 5 });
    }
    k.ball(0.03, pts[0], U ? GOLD_L : TEAL, { d: 0 }); k.ball(0.03, pts[8], U ? GOLD_L : TEAL, { d: 0 });
    k.limb(pts[8], R, 0.008, 0.008, CREAM, { seg: 3 });
    k.limb(pts[0], R, 0.008, 0.008, CREAM, { seg: 3 });
  });
  const tipA = [bowP[0] + 0.01, bowP[1] + 0.02, bowP[2] + 0.2];
  k.bone(BONE.ARM_R, SH, () => {
    k.limb(R, tipA, 0.014, 0.014, CREAM, { seg: 4 });
    const dA = V3(tipA).sub(V3(R)).normalize();
    k.stick(new THREE.ConeGeometry(0.034, 0.1, 4).translate(0, 0.05, 0), tipA, V3(tipA).add(dA).toArray(), U ? G_MAG : TEAL_L, { glow: U });
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
  const FUR = U ? 0xc06a36 : 0xb8683c, FUR_D = U ? 0x9a5030 : 0x94522e, CHEST = U ? 0xe0925a : 0xd8905e, MUZ = 0xe8b088, HORN = 0xf6ead0, HOOF = 0x7a6a90, CL = VIO;
  let H;
  k.at([0, 0, 0], [0, 0, 0], S, () => {
    H = figure(k, {
      legs: FUR_D, boots: HOOF, torso: FUR, hips: CL, upper: FUR, fore: FUR, hand: FUR_D, rh: [0.29, 0.52, 0.16], lh: [-0.27, 0.42, 0.12],
      head: false, belt: GOLD, armR: 0.08, foreR: 0.07, handR: 0.072, pauldron: U ? GOLD : null, pTrim: U ? GOLD_L : null, stance: 0.12,
    });
    // chest muscles (or the king's gold breastplate)
    if (U) k.lathe([[0.17, 0.5], [0.2, 0.57], [0.215, 0.63], [0.2, 0.69], [0.12, 0.73]], [0, 0, 0.005], GOLD, { s: [1, 1, 0.8], seg: 10, grad: [0.86, 1.14] });
    else k.sym(() => k.ell(0.1, 0.085, 0.06, [0.08, 0.6, 0.125], CHEST, { d: 1 }));
    // loincloth skirt + front flap
    k.lathe([[0.215, 0.26], [0.18, 0.36], [0.16, 0.45]], [0, 0, 0], CL, { s: [1, 1, 0.82], seg: 9, grad: [0.85, 1.05] });
    k.box(0.15, 0.22, 0.03, [0, 0.3, 0.15], U ? GOLD : VIO_L, { r: [-0.08, 0, 0] });
    if (U) cape(k, { y0: 0.18, y1: 0.7, r0: 0.27, r1: 0.2, col: VIO_L, lin: VIO, hem: GOLD, arc: 2.1 });
    // tail with a tuft
    k.bone(BONE.TAIL, [0, 0.42, -0.12], () => { tube(k, [[0, 0.42, -0.12], [0, 0.3, -0.24], [0.04, 0.16, -0.28]], 0.025, 0.02, FUR_D, { seg: 5, n: 5 }); k.ell(0.04, 0.07, 0.04, [0.04, 0.13, -0.28], FUR_D, { d: 0 }); });
    // bull head: big skull, pale muzzle, gold ring, ears, huge horns
    k.bone(BONE.HEAD, NECK, () => {
      k.ell(0.155, 0.15, 0.15, [0, HY + 0.01, 0.0], FUR, { grad: [0.9, 1.1] });
      k.ell(0.11, 0.095, 0.11, [0, HY - 0.06, 0.13], MUZ, { grad: [0.95, 1.05] });
      k.sym(() => k.ell(0.022, 0.018, 0.012, [0.045, HY - 0.05, 0.235], MOUTH, { d: 0, ao: false }));
      k.torus(0.045, 0.014, [0, HY - 0.12, 0.215], GOLD, { seg: 10, ts: 4, r: [0.3, 0, 0] });
      if (U) k.sym(() => k.ell(0.03, 0.022, 0.014, [0.065, HY + 0.035, 0.13], G_RED, { glow: true, d: 0 }));
      else eyes(k, HY + 0.035, 0.125);
      k.sym(() => k.box(0.08, 0.03, 0.04, [0.065, HY + 0.07, 0.12], FUR_D, { r: [0, 0, -0.3] }));
      k.sym(() => k.cone(0.045, 0.11, [0.15, HY + 0.02, -0.01], FUR_D, { r: [0, 0, -1.9], seg: 4 }));
      k.cone(0.06, 0.1, [0, HY + 0.12, 0.02], FUR_D, { r: [0.4, 0, 0], seg: 4 });
      k.sym(() => tube(k, [[0.1, HY + 0.09, 0.0], [0.24, HY + 0.11, 0.02], [0.33, HY + 0.22, 0.06], [0.32, HY + 0.33, 0.13]], 0.052, 0.012, HORN,
        { seg: 6, n: 9, bands: U ? [[0, 0.62, HORN], [0.62, 1, GOLD]] : [[0, 1, HORN]] }));
    });
  });
  // the great double axe (ARM_R), blades in the picture plane
  const rh = H.R.map((v) => v * S);
  const A = [rh[0] - 0.04, rh[1] - 0.36, rh[2] - 0.05], B = [rh[0] + 0.12, rh[1] + 0.62, rh[2] + 0.12];
  k.bone(BONE.ARM_R, SH.map((v) => v * S), () => pole(k, A, B, (L) => {
    k.limb([0, 0, 0], [0, L, 0], 0.034, 0.03, U ? 0x8a4ad0 : WOOD, { seg: 6, grad: [0.88, 1.1] });
    k.cyl(0.05, 0.05, 0.06, [0, 0.12, 0], GOLD, { seg: 6 });
    const bl = [[0.02, -0.11], [0.1, -0.2], [0.22, -0.22], [0.27, -0.06], [0.27, 0.06], [0.22, 0.22], [0.1, 0.2], [0.02, 0.11]];
    const sc = U ? 1.18 : 1.05;
    k.at([0, L - 0.16, 0], [0, 0, 0], sc, () => {
      for (const sd of [1, -1]) {
        k.plate(bl.map(([x, y]) => [x * sd, y]), 0.036, [0, 0, 0], U ? GOLD : STEEL, { grad: [0.88, 1.14] });
        k.plate([[0.2 * sd, -0.2], [0.29 * sd, -0.07], [0.29 * sd, 0.07], [0.2 * sd, 0.2], [0.245 * sd, 0]], 0.042, [0, 0, 0], U ? GOLD_L : STEEL_L, { grad: [1, 1.1] });
      }
      k.cyl(0.06, 0.06, 0.12, [0, -0.06, 0], U ? GOLD_L : STEEL_D, { seg: 6 });
      if (U) k.ball(0.045, [0, 0, 0.04], G_TEAL, { glow: true, d: 0 });
      k.cone(0.04, 0.12, [0, 0.06, 0], U ? GOLD_L : STEEL_L, { seg: 4 });
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
  const FUR = U ? 0xee8044 : 0xeca456, FUR_D = U ? 0xc8603a : 0xcc8640, MANE = U ? 0xc82a4a : 0xd8502a, FACE = U ? 0xf6b48a : 0xf6c890;
  const MEM = U ? 0x26b4ac : 0x9a52e0, EDGE = U ? GOLD_L : MAG_L, WB = U ? 0x1e8a8a : 0x7442b8, CAR = U ? 0xd84a3a : 0x8c44c0, STG = U ? G_LIME : G_MAG;
  k.ell(0.2, 0.19, 0.36, [0, 0.48, -0.05], FUR, { r: [0.05, 0, 0], grad: [0.84, 1.1] });
  k.ell(0.16, 0.12, 0.3, [0, 0.4, -0.02], FACE, {});
  // four lion legs
  const legs = [[0.12, 0.2, BONE.LEG_FR, 0.03], [-0.12, 0.2, BONE.LEG_FL, -0.03], [0.13, -0.28, BONE.LEG_BR, -0.02], [-0.13, -0.28, BONE.LEG_BL, 0.02]];
  for (const [x, z, bn, sw] of legs) k.bone(bn, [x, 0.5, z], () => {
    k.ell(0.09, 0.15, 0.12, [x * 1.05, 0.38, z], FUR, { grad: [0.86, 1.06] });
    k.limb([x * 1.05, 0.3, z], [x * 1.05, 0.06, z + sw], 0.062, 0.052, FUR_D);
    k.ell(0.065, 0.045, 0.085, [x * 1.05, 0.04, z + sw + 0.03], FUR_D, { d: 0 });
  });
  // scorpion tail arched over the back
  const tp = [[0, 0.56, -0.38], [0, 0.78, -0.56], [0, 1.0, -0.52], [0, 1.14, -0.36], [0, 1.15, -0.18]];
  k.bone(BONE.TAIL, tp[0], () => {
    const F = frames(tp, 7);
    for (let i = 0; i <= 7; i++) {
      const r = 0.085 - i * 0.006, p = F.P[i].toArray();
      k.ell(r, r, r * 1.1, p, i % 2 ? CAR : (U ? 0xf07a5a : 0xa868dc), { d: 1 });
      if (U && i % 2 === 0 && i > 1) k.cone(0.03, 0.09, [p[0], p[1] + r * 0.8, p[2]], GOLD_L, { seg: 4 });
    }
    const end = F.P[7].toArray();
    k.ell(0.07, 0.065, 0.08, [end[0], end[1] - 0.02, end[2] + 0.05], STG, { glow: true, d: 1 });
    k.cone(0.04, U ? 0.2 : 0.17, [end[0], end[1] - 0.04, end[2] + 0.1], BONEC, { r: [2.2, 0, 0], seg: 5 });
  });
  // head: big mane (with tufts) and a lion-man face with fangs
  k.bone(BONE.HEAD, [0, 0.6, 0.24], () => {
    k.ell(0.21, 0.21, 0.16, [0, 0.7, 0.3], MANE, { grad: [0.85, 1.1] });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cone(0.07, 0.15, [Math.sin(a) * 0.17, 0.7 + Math.cos(a) * 0.17, 0.27], MANE, { r: [0, 0, -a], seg: 4 }); }
    if (U) k.torus(0.17, 0.03, [0, 0.66, 0.3], GOLD, { r: [Math.PI / 2 + 0.4, 0, 0], seg: 12, ts: 4 });
    k.ell(0.125, 0.135, 0.11, [0, 0.7, 0.42], FACE, { grad: [0.92, 1.06] });
    k.ell(0.075, 0.06, 0.07, [0, 0.64, 0.51], 0xfde0b8, {});
    k.ell(0.03, 0.022, 0.02, [0, 0.672, 0.578], 0x8a3a5a, { d: 0 });
    k.ell(0.065, 0.025, 0.04, [0, 0.6, 0.52], MOUTH, { ao: false });
    k.sym(() => k.cone(0.018, 0.06, [0.035, 0.62, 0.55], WHITE, { r: [Math.PI, 0, 0], seg: 3 }));
    k.sym(() => { k.ell(0.026, 0.024, 0.014, [0.05, 0.73, 0.52], U ? G_GOLD : INK, { d: 0, glow: U }); k.box(0.07, 0.022, 0.03, [0.05, 0.765, 0.515], FUR_D, { r: [0, 0, -0.35] }); });
    k.sym(() => k.cone(0.045, 0.09, [0.11, 0.83, 0.36], FACE, { r: [-0.2, 0, -0.5], seg: 4 }));
  });
  // bat wings raised in a V from the shoulders
  k.sym(() => k.bone(BONE.WING_R, [0.12, 0.62, 0.06], () => batWing(k, {
    root: [0.12, 0.62, 0.06], elbow: [0.32, 0.86, 0.02], wrist: [0.5, 1.08, -0.06],
    tips: U ? [[0.86, 0.98, -0.2], [0.78, 0.72, -0.3], [0.52, 0.56, -0.32]] : [[0.8, 0.94, -0.2], [0.72, 0.7, -0.3], [0.5, 0.56, -0.3]],
    back: [0.12, 0.56, -0.2], mem: MEM, bone: WB, r: 0.042, claw: BONEC, edge: EDGE,
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
  const BD = U ? 0xe0442e : 0x6e3aa8, BD_D = U ? 0xb83226 : 0x58308c, BEL = U ? 0xffb84a : 0xc69af0;
  const SP = U ? GOLD : MAG, HRN = U ? GOLD_L : TEAL_L, CLAW = U ? 0xfff0c8 : TEAL;
  const MEM = U ? 0xf6782e : 0xb44ac0, EDGE = U ? GOLD_L : TEAL_L, WB = U ? 0xc03a28 : 0x5e3296, EYE = U ? G_GOLD : G_TEAL, BR = U ? 0xffa030 : G_MAG;
  // body, chest, belly
  k.ell(0.25, 0.24, 0.42, [0, 0.6, -0.12], BD, { grad: [0.82, 1.12] });
  k.ell(0.22, 0.24, 0.2, [0, 0.66, 0.18], BD, {});
  k.ell(0.19, 0.15, 0.4, [0, 0.5, -0.04], BEL, { r: [-0.08, 0, 0], grad: [0.9, 1.06] });
  for (let i = 0; i < 4; i++) k.cone(0.06 - i * 0.004, 0.16, [0, 0.83 - i * 0.025, 0.12 - i * 0.16], SP, { r: [-0.6, 0, 0], seg: 4 });
  // legs
  const legs = [[0.17, -0.3, BONE.LEG_BR, true], [-0.17, -0.3, BONE.LEG_BL, true], [0.15, 0.22, BONE.LEG_FR, false], [-0.15, 0.22, BONE.LEG_FL, false]];
  for (const [x, z, bn, back] of legs) k.bone(bn, [x, 0.6, z], () => {
    const s = Math.sign(x);
    if (back) {
      k.ell(0.11, 0.18, 0.17, [x + s * 0.04, 0.45, z], BD, { grad: [0.86, 1.06] });
      k.limb([x + s * 0.05, 0.32, z - 0.04], [x + s * 0.05, 0.07, z + 0.0], 0.07, 0.058, BD_D);
    } else {
      k.ell(0.09, 0.14, 0.11, [x + s * 0.03, 0.5, z], BD, {});
      k.limb([x + s * 0.04, 0.42, z], [x + s * 0.05, 0.07, z + 0.1], 0.062, 0.05, BD_D);
    }
    const fz = back ? z + 0.03 : z + 0.13;
    k.ell(0.075, 0.05, 0.1, [x + s * 0.05, 0.045, fz], BD_D, { d: 0 });
    for (const t of [-1, 0, 1]) k.cone(0.022, 0.07, [x + s * 0.05 + t * 0.04, 0.03, fz + 0.08], CLAW, { r: [Math.PI / 2, 0, -t * 0.3], seg: 4 });
  });
  // tail with spines and a spade tip
  const tp = [[0, 0.58, -0.46], [0, 0.42, -0.74], [0.1, 0.2, -0.96], [0.3, 0.08, -1.06], [0.48, 0.06, -1.02]];
  k.bone(BONE.TAIL, tp[0], () => {
    const F = tube(k, tp, 0.15, 0.025, BD, { n: 12, seg: 7, pow: 0.8 });
    for (let i = 2; i < 11; i += 3) { const p = F.P[i]; k.cone(0.045 - i * 0.002, 0.12 - i * 0.005, [p.x, p.y + 0.11 - i * 0.008, p.z], SP, { r: [-0.6, 0, 0], seg: 4 }); }
    k.plate([[0, -0.03], [0.1, -0.1], [0.2, 0], [0.1, 0.1], [0, 0.03]], 0.03, [0.46, 0.07, -1.03], SP, { r: [Math.PI / 2, 0, 0.1] });
  });
  // neck + head (HEAD from the chest)
  k.bone(BONE.HEAD, [0, 0.74, 0.26], () => {
    const F = tube(k, [[0, 0.7, 0.22], [0, 0.92, 0.36], [0, 1.12, 0.44], [0, 1.2, 0.5]], 0.13, 0.085, BD, { n: 8, seg: 7 });
    k.ell(0.09, 0.2, 0.08, [0, 0.9, 0.44], BEL, { r: [-0.55, 0, 0] });
    for (let i = 2; i < 8; i += 2) { const p = F.P[i]; k.cone(0.045, 0.12, [p.x, p.y + 0.06, p.z - 0.09], SP, { r: [-1.2, 0, 0], seg: 4 }); }
    const hc = [0, 1.22, 0.56];
    // the head is drawn 1.3x around its centre so it reads at phone size
    const HM = new THREE.Matrix4().makeTranslation(...hc).multiply(new THREE.Matrix4().makeScale(1.3, 1.3, 1.3)).multiply(new THREE.Matrix4().makeTranslation(-hc[0], -hc[1], -hc[2]));
    k.with(HM, () => {
    k.ell(0.135, 0.11, 0.15, hc, BD, { grad: [0.9, 1.1] });
    k.ell(0.095, 0.07, 0.16, [0, 1.19, 0.71], BD, {});
    k.ell(0.085, 0.04, 0.15, [0, 1.09, 0.66], BEL, { r: [0.25, 0, 0] });
    k.ell(0.07, 0.035, 0.12, [0, 1.13, 0.68], BR, { glow: true, d: 1 });
    k.sym(() => {
      k.ell(0.036, 0.028, 0.022, [0.075, 1.255, 0.66], EYE, { glow: true, d: 0 });
      k.box(0.08, 0.03, 0.06, [0.075, 1.29, 0.64], BD_D, { r: [0, -0.3, -0.3] });
      tube(k, [[0.07, 1.28, 0.52], [0.14, 1.36, 0.42], [0.17, 1.4, 0.26]], 0.05, 0.01, HRN, { seg: 5, n: 7 });
      k.cone(0.03, 0.09, [0.12, 1.2, 0.5], HRN, { r: [-1.2, 0, -1.0], seg: 4 });
    });
    });
  });
  // huge bat wings raised high
  const Sw = U ? 1.0 : 0.93;
  k.sym(() => k.bone(BONE.WING_R, [0.13, 0.82, 0.02], () => batWing(k, {
    root: [0.13, 0.82, 0.02], elbow: [0.42 * Sw, 1.12 * Sw, -0.04], wrist: [0.66 * Sw, 1.4 * Sw, -0.12],
    tips: [[1.02 * Sw, 1.2 * Sw, -0.3], [0.94 * Sw, 0.86, -0.42], [0.66 * Sw, 0.62, -0.46]],
    back: [0.14, 0.66, -0.32], mem: MEM, bone: WB, r: 0.06, claw: HRN, edge: EDGE,
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
