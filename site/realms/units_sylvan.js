import * as THREE from 'three';
import { BONE } from './rig.js?v=1.4';

// =====================================================================
// HEX REALMS: Sylvan (elven forest) creatures, round 6.
// sylvanModel(id) -> { body, glow } for centaur, dwarf, woodelf, pegasus,
// dendroid, unicorn, greendragon and their upgrades centaurcpt, battledwarf,
// grandelf, silverpegasus, dendroidsoldier, warunicorn, golddragon.
// Facing +z, base at y = 0. Results are cached per id (same object returned).
// sylvanBuild(baseId, up) builds a fresh model (upgrade = same builder, up=true).
//
// Built with the same kit and readability rules as units_haven.js (round 4):
// chunky silhouettes, 1-2 exaggerated identity features per creature, 2-3
// colour blocks + one accent, bright palette (no murk), no micro parts.
//  centaur  chestnut horse body + human torso, green jerkin, big javelin
//  dwarf    short and wide, huge orange beard, steel helm, big axe, round shield
//  woodelf  emerald hood + cloak, pointed ears, blond hair, tall longbow
//  pegasus  white horse, big feathered V wings with sky-blue tips
//  dendroid walking tree: bark trunk with a glowing-eyed face, root feet,
//           branch arms with club hands, a big leafy crown
//  unicorn  white horse, long golden spiral horn, rainbow mane and tail
//  greendragon bright green, yellow belly/spines, huge membrane wings
// Upgrades keep the silhouette and add gold trim, capes, crowns, armour,
// bigger wings / horns (gold dragon is gold all over).
//
// Round 5 rig (rig.js): every part carries aBone/aPivot via k.bone(bone, pivot, fn).
// Quadrupeds: LEG_FL/FR/BL/BR, TAIL, HEAD (neck), WING_L/R. Centaur: horse = BODY
// + legs, human torso and head = RIDER (bobs on the horse), arms ARM_L/ARM_R
// (follow the RIDER; the javelin is on ARM_R). Dendroid: roots = LEG_FL/FR,
// branches = ARM_L/ARM_R, crown = HEAD. +x = *_R (weapon side).
// Kit below: shared with units_haven.js (copied so this module stands alone).
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


// ---------------------------------------------------------------- sylvan palette
const LEAF = 0x4cc040, LEAF_D = 0x2f9a3a, LEAF_L = 0x9ae05a, EMER = 0x22a058, LIME = 0xb4e04a, MOSS = 0x8ccf4a;
const BARK = 0xb07a42, BARK_D = 0x8e5e32, BARK_L = 0xd09a5c, KNOT = 0x6e4628;
const HAIR_B = 0xffe07a, HAIR_BR = 0xa85a2c, BEARD = 0xf2702a, BEARD_L = 0xffa04a;
const SILVER = 0xdde6f4, SILVER_D = 0xb4c2da, SKY = 0x7cc8ff, SKY_D = 0x4a9ef0, VIOLET = 0xb07cff, PINK = 0xff86c0;
const MINT = 0x6ee0a8, SUN = 0xffd84a, ORANGE = 0xffa040, IVORY = 0xfff2d6;
const tup = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// round shield facing +z (in the frame at p, r): wooden or painted field, rim, boss
function roundShield(k, p, r, rad, field, rim, boss, emb) {
  k.at(p, r, 1, () => {
    k.cyl(rad, rad, 0.045, [0, 0, -0.025], field, { r: [Math.PI / 2, 0, 0], seg: 12, grad: [0.84, 1.12] });
    k.torus(rad, 0.03, [0, 0, 0.02], rim, { seg: 14, ts: 4, grad: [0.92, 1.08] });
    if (emb) emb();
    k.ell(rad * 0.3, rad * 0.3, 0.05, [0, 0, 0.03], boss, { grad: [0.9, 1.15] });
  });
}
// a bold leaf emblem (flat, facing +z)
function leafEmblem(k, p, s, col, r = [0, 0, 0]) {
  k.plate([[0, -0.12], [0.07, -0.04], [0.06, 0.06], [0, 0.13], [-0.06, 0.06], [-0.07, -0.04]].map(([x, y]) => [x * s, y * s]), 0.018, p, col, { r, grad: [0.95, 1.1] });
}

// ---------------------------------------------------------------- horse body
// Shared by centaur / pegasus / unicorn. Barrel + chest (BODY), four legs (LEG_*),
// tail (TAIL), neck + head + mane (HEAD). Head frame: o.headFx(k) is called in the
// head's local frame (origin between the eyes/forehead, +z = muzzle).
function horse(k, o) {
  const C = o.coat, CD = o.coatD ?? C, HOOF = o.hoof ?? 0xb08a64, SOCK = o.sock ?? CD;
  k.ell(0.2, 0.2, 0.4, [0, 0.64, -0.03], C, { grad: [0.84, 1.06] });
  k.ell(0.18, 0.21, 0.18, [0, 0.68, 0.24], C, {});
  k.ell(0.19, 0.2, 0.17, [0, 0.68, -0.3], C, {});
  const legsAt = [[0.1, 0.3, 0.12, BONE.LEG_FR], [-0.1, 0.24, -0.04, BONE.LEG_FL], [0.1, -0.3, -0.06, BONE.LEG_BR], [-0.1, -0.28, 0.06, BONE.LEG_BL]];
  for (const [x, z, sw, bn] of legsAt) k.bone(bn, [x, 0.6, z], () => {
    k.limb([x, 0.62, z], [x, 0.33, z + sw * 0.5], 0.085, 0.058, C, { seg: 6 });
    k.limb([x, 0.33, z + sw * 0.5], [x, 0.07, z + sw], 0.054, 0.046, CD, { seg: 6 });
    if (o.feath) k.cyl(0.07, 0.058, 0.07, [x, 0.06, z + sw], SOCK, { seg: 6 });
    k.cyl(0.06, 0.054, 0.075, [x, 0.0, z + sw], HOOF, { seg: 6, ao: false });
  });
  // tail: a single thick plume, or a fan of coloured strands
  const tc = o.tail ?? [CD];
  k.bone(BONE.TAIL, [0, 0.72, -0.42], () => tc.forEach((c, i) => {
    const x = (i - (tc.length - 1) / 2) * 0.045, r = tc.length > 1 ? 0.04 : 0.06;
    k.limb([0, 0.74, -0.42], [x, 0.6, -0.58], r, r * 0.95, c, { seg: 5 });
    k.limb([x, 0.6, -0.58], [x * 1.8, 0.3, -0.62], r * 0.95, r * 0.5, c, { seg: 5 });
  }));
  if (o.noHead) return;
  const mc = o.mane ?? [CD];
  k.bone(BONE.HEAD, [0, 0.76, 0.3], () => {
    k.limb([0, 0.72, 0.28], [0, 1.0, 0.47], 0.125, 0.092, C, { seg: 7 });
    // mane: big tufts sweeping back along the neck (rainbow when several colours)
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), p = tup([0, 0.8, 0.22], [0, 1.08, 0.42], t);
      k.cone(0.06, 0.2 - t * 0.03, p, mc[i % mc.length], { r: [-1.25 + t * 0.2, 0, 0], seg: 4, grad: [0.92, 1.08] });
    }
    k.at([0, 1.02, 0.52], [0.95, 0, 0], 1, () => {
      k.ell(0.086, 0.094, 0.19, [0, 0, 0.09], C, {});
      k.ell(0.076, 0.078, 0.085, [0, -0.015, 0.25], CD, {});
      k.sym(() => {
        k.cone(0.034, 0.11, [0.05, 0.06, -0.04], C, { r: [-0.5, 0, 0.25], seg: 4 });
        k.ell(0.026, 0.03, 0.02, [0.078, 0.03, 0.09], INK, { d: 0, grad: [1, 1], ao: false, r: [0, 0.9, 0] });
      });
      k.cone(0.045, 0.12, [0, 0.07, 0.02], mc[0], { r: [-1.9, 0, 0], seg: 4 }); // forelock
      if (o.headFx) o.headFx();
    });
    if (o.neckFx) o.neckFx();
  });
}

// ---------------------------------------------------------------- creatures
// Centaur: chestnut horse body, human torso in a green jerkin with a headband
// and pony-tail, a huge javelin poised overhand, javelin quiver on the flank.
// Centaur captain: gold-trimmed breastplate, gold helm with a green crest,
// green cape, a long green caparison with gold hem, gilded javelin + pennant.
function centaur(U) {
  const k = makeKit(U ? 131 : 127, [0, 0.64, -0.03]);
  const COAT = U ? 0xc4743a : 0xd08a44, COAT_D = U ? 0xa8602e : 0xb8743a, MANE = 0x9a522c;
  // the horse half is a little shorter than a real horse: keeps the unit compact on its hex
  k.at([0, 0, 0], [0, 0, 0], [1.05, 1, 0.84], () => {
  horse(k, { coat: COAT, coatD: COAT_D, noHead: true, tail: [MANE], hoof: 0xa88462, sock: CREAM, feath: true });
  // saddle cloth (green: the faction colour), a caparison when upgraded
  const y0 = U ? 0.42 : 0.56;
  k.lathe([[0.222, y0], [0.214, 0.6], [0.2, 0.7], [0.16, 0.8], [0.06, 0.85]], [0, 0, -0.14], U ? EMER : LEAF_D, { s: [1, 1, U ? 1.35 : 1.15], seg: 10, grad: [0.85, 1.08] });
  k.lathe([[0.23, y0 - 0.02], [0.226, y0 + 0.04]], [0, 0, -0.14], GOLD, { s: [1, 1, U ? 1.35 : 1.15], seg: 10, grad: [1, 1] });
  if (U) k.sym(() => leafEmblem(k, [0.225, 0.56, -0.16], 1.3, GOLD, [0, Math.PI / 2, -0.1]));
  // javelin quiver on the right flank
  k.at([0.2, 0.66, -0.26], [0.35, 0, -0.3], 1, () => {
    k.cyl(0.06, 0.066, 0.3, [0, -0.18, 0], U ? GOLD : LEATHER, { seg: 7, grad: [0.85, 1.08] });
    for (let i = 0; i < 3; i++) k.cone(0.03, 0.1, [(i - 1) * 0.035, 0.1 + (i % 2) * 0.03, 0], STEEL_L, { seg: 4 });
  });
  });
  // human torso, head and arms: RIDER pivots where the torso meets the horse
  const S = 0.9, F = [0, 0.74 - 0.42 * S, 0.22];
  k.at(F, [0.1, 0, 0], S, () => k.bone(BONE.RIDER, HIPS, () => {
    figure(k, {
      robe: true, torso: U ? GOLD : LEAF, hips: COAT, upper: SKIN, fore: SKIN, hand: SKIN, belt: U ? EMER : LEATHER, head: false,
      rh: [0.26, 0.84, -0.04], lh: [-0.17, 0.64, 0.27], pauldron: U ? GOLD_L : null, pTrim: U ? EMER : null, armR: 0.068, foreR: 0.06, torsoGrad: [0.86, 1.12],
    });
    // jerkin laces / breastplate centre
    if (U) { k.box(0.06, 0.24, 0.03, [0, 0.58, 0.155], EMER, { r: [-0.1, 0, 0] }); cape(k, { y0: 0.4, y1: 0.7, r0: 0.25, r1: 0.19, col: CAPE_G, lin: GOLD, hem: GOLD, arc: 2.1 }); }
    else k.box(0.2, 0.05, 0.03, [0, 0.62, 0.15], LEATHER, { r: [-0.1, 0, -0.5] }); // strap
    // head (on the RIDER, so it stays on the torso): face, brown hair, pony-tail
    k.at([0, HY, 0], [0, 0, 0], 1.12, () => k.at([0, -HY, 0], [0, 0, 0], 1, () => {
    k.ell(HR, HR * 1.02, HR * 0.98, [0, HY, 0.01], SKIN, { grad: [0.95, 1.05] });
    eyes(k);
    k.ell(0.148, 0.12, 0.14, [0, HY + 0.045, -0.03], MANE, { grad: [0.9, 1.1] });
    k.limb([0, HY + 0.02, -0.13], [0, HY - 0.08, -0.25], 0.055, 0.05, MANE, { seg: 5 });
    k.limb([0, HY - 0.08, -0.25], [0, HY - 0.26, -0.24], 0.05, 0.02, MANE, { seg: 5 });
    if (U) {
      k.lathe([[0.152, HY + 0.02], [0.158, HY + 0.08], [0.13, HY + 0.15], [0.06, HY + 0.185], [0, HY + 0.19]], [0, 0, -0.01], GOLD, { seg: 10, grad: [0.85, 1.15] });
      k.lathe([[0.162, HY + 0.01], [0.162, HY + 0.05]], [0, 0, -0.01], EMER, { seg: 10, grad: [1, 1] });
      plume(k, [0, HY + 0.17, -0.03], [LEAF_L, EMER, LEAF_L], 1.2);
    } else {
      k.torus(0.142, 0.026, [0, HY + 0.05, -0.005], LEAF_D, { r: [Math.PI / 2, 0, 0], seg: 12, ts: 4 });
      k.feather([0.12, HY + 0.06, -0.06], [0.2, HY + 0.28, -0.18], 0.09, LEAF_L, { t: 0.02 });
    }
    }));
    // javelin held overhand, pointing forward (ARM_R: the attack is a thrust)
    k.bone(BONE.ARM_R, SH, () => {
      const A = [0.27, 0.74, -0.36], B = [0.25, 1.0, 0.58 + (U ? 0.06 : 0)];
      k.limb(A, B, 0.028, 0.024, U ? GOLD_L : WOOD, { seg: 6, grad: [0.88, 1.1] });
      k.ball(0.045, tup(A, B, 0.04), U ? GOLD : LEATHER, { d: 0 });
      const d = V3(B).sub(V3(A)).normalize();
      pole(k, B, V3(B).add(d).toArray(), () => leafHead(k, [0, -0.02, 0], U ? 0.28 : 0.25, 0.075, U ? GOLD_L : STEEL_L));
      if (U) {
        const ang = Math.atan2(B[1] - A[1], B[2] - A[2]);
        k.plate([[0, 0], [0, 0.13], [0.28, 0.1], [0.18, 0.065], [0.28, 0.03]], 0.012, tup(A, B, 0.8), EMER, { r: [-ang + Math.PI / 2, Math.PI / 2 + 0.25, Math.PI], grad: [0.9, 1.08], both: true });
      }
    });
  }));
  return k.done();
}

// Dwarf: short and very wide, huge orange beard, steel cap with a bronze band
// and nose guard, mail shirt, green trousers, a big bearded axe, wooden round shield.
// Battle dwarf: horned gold-rimmed helm, steel pauldrons with gold trim, green
// cape, double-bitted gilded axe, green shield with gold rim and leaf, beard rings.
function dwarf(U) {
  const SC = [1.22, 0.84, 1.15];
  const k = makeKit(U ? 113 : 111, [0, 0.42 * SC[1], 0]);
  const MAIL = U ? 0xc8d2e2 : 0xbcc6d6, TROUS = U ? 0x3f9a44 : 0x5aa83e;
  const w = (p) => [p[0] * SC[0], p[1] * SC[1], p[2] * SC[2]];
  let H;
  k.at([0, 0, 0], [0, 0, 0], SC, () => {
    H = figure(k, {
      legs: TROUS, boots: LEATHER, torso: MAIL, hips: LEATHER, upper: MAIL, fore: SKIN, hand: SKIN, belt: LEATHER, head: false, stance: 0.1,
      rh: [0.25, 0.5, 0.18], lh: [-0.22, 0.42, 0.16], pauldron: U ? STEEL_L : null, pTrim: U ? GOLD : null, armR: 0.072, foreR: 0.066, handR: 0.068,
    });
    // big belt buckle and a short tunic skirt
    k.lathe([[0.2, 0.3], [0.175, 0.38], [0.158, 0.45]], [0, 0, 0], U ? EMER : LEAF_D, { s: [1, 1, 0.8], seg: 10, grad: [0.85, 1.05] });
    k.box(0.1, 0.08, 0.04, [0, 0.47, 0.135], GOLD, { grad: [1, 1.1] });
    if (U) cape(k, { y0: 0.2, y1: 0.7, r0: 0.27, r1: 0.21, col: CAPE_G, lin: GOLD, hem: GOLD, arc: 2.1 });
  });
  const NK = [0, 0.6, 0];
  k.bone(BONE.HEAD, NK, () => {
    const hy = 0.72;
    k.ell(0.15, 0.15, 0.145, [0, hy, 0.02], SKIN, { grad: [0.95, 1.05] });
    eyes(k, hy + 0.012, 0.15);
    k.ball(0.045, [0, hy - 0.015, 0.165], 0xf4a884, { d: 0 }); // nose
    // the beard: the dwarf's identity, big and bright
    k.ell(0.16, 0.13, 0.1, [0, hy - 0.1, 0.11], BEARD, { grad: [0.9, 1.08] });
    k.cone(0.13, 0.26, [0, hy - 0.12, 0.13], BEARD, { r: [Math.PI - 0.25, 0, 0], seg: 6, grad: [0.85, 1.05] });
    k.sym(() => k.ell(0.075, 0.035, 0.045, [0.055, hy - 0.05, 0.17], BEARD_L, { r: [0, 0, -0.35], d: 0 }));
    if (U) for (const y of [0.42, 0.5]) k.torus(0.035, 0.016, [0, y, 0.2], GOLD, { r: [Math.PI / 2 - 0.25, 0, 0], seg: 8, ts: 3 });
    // helm
    const HC = U ? STEEL_L : STEEL;
    k.lathe([[0.158, hy + 0.03], [0.165, hy + 0.08], [0.145, hy + 0.15], [0.085, hy + 0.195], [0, hy + 0.205]], [0, 0, 0.005], HC, { seg: 10, grad: [0.82, 1.15] });
    k.lathe([[0.17, hy + 0.02], [0.17, hy + 0.065]], [0, 0, 0.005], U ? GOLD : 0xdc9a42, { seg: 10, grad: [1, 1] });
    k.box(0.04, 0.1, 0.03, [0, hy + 0.0, 0.165], U ? GOLD : STEEL_D, {});
    if (U) {
      k.sym(() => {
        k.limb([0.15, hy + 0.07, 0], [0.25, hy + 0.13, -0.02], 0.045, 0.034, IVORY, { seg: 5 });
        k.limb([0.25, hy + 0.13, -0.02], [0.28, hy + 0.27, -0.06], 0.034, 0.008, IVORY, { seg: 5 });
      });
      k.cone(0.03, 0.08, [0, hy + 0.19, 0.005], GOLD_L, { seg: 4 });
    } else k.ball(0.035, [0, hy + 0.2, 0.005], 0xdc9a42, { d: 0 });
  });
  // axe in the right hand (ARM_R): haft through the fist, broad blade outward
  const R = w(H.R);
  k.bone(BONE.ARM_R, w(SH), () => {
    const A = [R[0] + 0.01, 0.16, R[2] + 0.06], B = [R[0] + 0.06, 0.98, R[2] - 0.06];
    pole(k, A, B, (L) => {
      k.limb([0, 0, 0], [0, L, 0], 0.032, 0.03, WOOD, { seg: 6, grad: [0.88, 1.1] });
      k.cyl(0.042, 0.042, 0.06, [0, 0.0, 0], LEATHER, { seg: 6 });
      k.cyl(0.044, 0.04, 0.16, [0, L - 0.2, 0], U ? GOLD : STEEL_D, { seg: 6 });
      const blade = [[0, -0.08], [0.08, -0.1], [0.2, -0.2], [0.25, -0.06], [0.26, 0.08], [0.22, 0.22], [0.08, 0.12], [0, 0.09]];
      const sides = U ? [1, -1] : [1];
      for (const s of sides) k.at([0.02 * s, L - 0.12, 0], [0, 0, 0], [s * 1.05, 1.05, 1], () => {
        if (U) k.plate(blade.map(([x, y]) => [x * 1.12 - 0.005, y * 1.12]), 0.024, [0, 0, 0], GOLD, { grad: [1, 1.05] });
        k.plate(blade, 0.04, [0, 0, 0], STEEL_L, { grad: [0.86, 1.18] });
      });
      if (U) k.cone(0.03, 0.12, [0, L - 0.02, 0], STEEL_L, { seg: 4 });
    });
  });
  const L = w(H.L);
  k.bone(BONE.ARM_L, w(SHL), () => roundShield(k, [L[0] - 0.05, L[1] + 0.07, L[2] + 0.08], [0.05, -0.4, 0], 0.21,
    U ? EMER : 0xc8884a, U ? GOLD : STEEL, U ? GOLD_L : STEEL_L, () => {
      if (U) for (let i = 0; i < 4; i++) leafEmblem(k, [Math.sin(i * Math.PI / 2) * 0.12, Math.cos(i * Math.PI / 2) * 0.12, 0.02], 0.7, GOLD);
      else for (const x of [-0.07, 0.07]) k.box(0.016, 0.38, 0.05, [x, 0, 0], 0xa86a38, { grad: [1, 1] });
    }));
  return k.done();
}

// Wood elf: emerald hood + leaf cloak, lime tunic, long blond hair, pointed ears
// sticking out of the hood, a very tall pale-gold longbow.
// Grand elf: gold diadem with a glowing gem over the hood, gold-hemmed cloak,
// gilded recurve bow with TWO nocked arrows (shoots twice), gold quiver.
function woodelf(U) {
  const k = makeKit(U ? 157 : 151);
  const HOOD = U ? 0x1e9a58 : 0x28a446, TUN = U ? 0xd8f080 : LIME, LEGS = 0xb07a44;
  const bowP = [-0.17, 0.6, 0.24], draw = [0.04, 0.64, 0.06];
  figure(k, {
    legs: LEGS, boots: LEATHER, torso: TUN, hips: HOOD, upper: HOOD, fore: TUN, hand: SKIN, belt: U ? GOLD : LEATHER,
    rh: draw, lh: bowP, stance: 0.1, head: false, torsoGrad: [0.86, 1.12],
  });
  k.lathe([[0.205, 0.27], [0.175, 0.36], [0.155, 0.45]], [0, 0, 0], HOOD, { s: [1, 1, 0.8], seg: 10, grad: [0.85, 1.05] });
  // leaf cloak (CLOTH) with a zig-zag leaf hem
  cape(k, { y0: 0.16, y1: 0.7, r0: 0.27, r1: 0.2, col: U ? 0x52c470 : 0x5ccc5a, lin: U ? GOLD : LEAF_D, hem: U ? GOLD : null, arc: 2.2 });
  k.bone(BONE.CLOTH, [0, 0.7, -0.18], () => {
    for (let i = 0; i < 5; i++) { const a = Math.PI + (i - 2) * 0.42; k.cone(0.05, 0.12, [Math.sin(a) * 0.27, 0.2, Math.cos(a) * 0.23], U ? GOLD : LEAF_D, { r: [Math.PI, 0, 0], seg: 3 }); }
  });
  // capelet and the big hood
  k.lathe([[0.25, 0.55], [0.235, 0.6], [0.19, 0.67], [0.11, 0.73], [0.05, 0.75]], [0, 0, 0], HOOD, { s: [1, 1, 0.86], seg: 10, grad: [0.85, 1.1] });
  k.lathe([[0.258, 0.535], [0.254, 0.575]], [0, 0, 0], U ? GOLD : LEAF_L, { s: [1, 1, 0.86], seg: 10, grad: [1, 1] });
  k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.16, 0.168, 0.16, [0, HY + 0.015, -0.025], HOOD, { grad: [0.88, 1.12] });
    k.cone(0.09, 0.24, [0, HY + 0.07, -0.12], HOOD, { r: [-2.1, 0, 0], seg: 5 });
    k.ell(0.12, 0.125, 0.1, [0, HY - 0.012, 0.06], SKIN, { grad: [0.95, 1.05] });
    eyes(k, HY - 0.005, 0.148, 0x2a7a4a);
    // blond fringe and long locks down the front
    k.ell(0.12, 0.05, 0.07, [0, HY + 0.075, 0.07], HAIR_B, { r: [0.3, 0, 0] });
    k.sym(() => k.ell(0.05, 0.15, 0.045, [0.11, HY - 0.13, 0.07], HAIR_B, { r: [0.15, 0, -0.1] }));
    // pointed ears through the hood: the elf's identity
    k.sym(() => k.cone(0.04, 0.17, [0.135, HY - 0.0, 0.02], SKIN, { r: [0, 0, -1.2], seg: 4 }));
    if (U) {
      k.torus(0.155, 0.024, [0, HY + 0.07, 0.0], GOLD, { r: [Math.PI / 2 - 0.25, 0, 0], seg: 12, ts: 4 });
      k.sym(() => k.cone(0.03, 0.09, [0.08, HY + 0.11, 0.12], GOLD_L, { r: [0.3, 0, -0.3], seg: 3 }));
      k.ball(0.032, [0, HY + 0.11, 0.16], 0x7affb0, { glow: true, d: 0 });
    }
  });
  // quiver on the back
  k.at([0.1, 0.6, -0.17], [0.35, 0, -0.4], 1, () => {
    k.cyl(0.07, 0.076, 0.36, [0, -0.2, 0], U ? GOLD : LEATHER, { seg: 7, grad: [0.85, 1.08] });
    k.box(0.13, 0.1, 0.05, [0, 0.2, 0], WHITE, { r: [0, 0.4, 0] });
    k.box(0.05, 0.11, 0.13, [0, 0.21, 0], LEAF_L, { r: [0, 0.4, 0] });
  });
  // tall longbow (ARM_L) and nocked arrow(s) (ARM_R)
  const bowH = U ? 0.53 : 0.5, bend = 0.12, pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 4 - 1; pts.push([bowP[0], bowP[1] + t * bowH, bowP[2] + 0.02 - t * t * bend + (U ? Math.pow(Math.abs(t), 5) * 0.1 : 0)]); }
  const R = [draw[0], draw[1], draw[2] - 0.02];
  k.bone(BONE.ARM_L, SHL, () => {
    for (let i = 0; i < 8; i++) {
      const r = 0.034 - Math.abs(i - 3.5) * 0.0026, c = i === 3 || i === 4 ? LEAF_D : (U ? GOLD : 0xe8b868);
      k.limb(pts[i], pts[i + 1], r, r, c, { seg: 5 });
    }
    for (const p of [pts[0], pts[8]]) k.cone(0.03, 0.07, p, U ? GOLD_L : LEAF, { seg: 4, r: [p === pts[0] ? Math.PI : 0, 0, 0] });
    k.limb(pts[8], R, 0.008, 0.008, CREAM, { seg: 3 });
    k.limb(pts[0], R, 0.008, 0.008, CREAM, { seg: 3 });
  });
  k.bone(BONE.ARM_R, SH, () => {
    for (const dy of U ? [0.03, -0.035] : [0]) {
      const r0 = [R[0], R[1] + dy, R[2]], tipA = [bowP[0] + 0.01, bowP[1] + 0.02 + dy * 1.6, bowP[2] + 0.22];
      k.limb(r0, tipA, 0.014, 0.014, CREAM, { seg: 4 });
      const dA = V3(tipA).sub(V3(r0)).normalize();
      k.stick(new THREE.ConeGeometry(0.032, 0.09, 4).translate(0, 0.045, 0), tipA, V3(tipA).add(dA).toArray(), U ? GOLD_L : STEEL_L, {});
    }
  });
  return k.done();
}

// Pegasus: white horse with big feathered V wings (sky-blue tips), sky mane.
// Silver pegasus: silver-blue coat, silver chanfron and breast collar with a
// gold star, bigger wings with royal-blue tips, silver-white mane.
function pegasus(U) {
  const k = makeKit(U ? 167 : 163, [0, 0.64, -0.03]);
  const C = U ? 0xdfe8f8 : 0xfbf8f4, CD = U ? 0xc6d4ec : 0xe8e4e0;
  horse(k, {
    coat: C, coatD: CD, hoof: U ? SILVER_D : 0xc8a47a, mane: U ? [0xf6fbff, 0xb4dcff] : [SKY, 0xb0e0ff], tail: U ? [0xf6fbff, 0xb4dcff, 0xf6fbff] : [SKY, 0xb0e0ff, SKY],
    headFx: U ? () => {
      k.ell(0.066, 0.044, 0.17, [0, 0.062, 0.1], SILVER, { grad: [0.85, 1.12] });
      k.cone(0.04, 0.09, [0, 0.07, -0.02], GOLD, { r: [-0.6, 0, 0], seg: 4 });
    } : null,
  });
  if (U) {
    k.torus(0.17, 0.035, [0, 0.72, 0.3], SILVER, { r: [Math.PI / 2 - 0.6, 0, 0], seg: 12, ts: 4 });
    k.at([0, 0.62, 0.43], [0.4, 0, 0], 1.1, () => { k.ball(0.04, [0, 0, 0.015], 0xbfe4ff, { glow: true, d: 0 }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; k.cone(0.03, 0.06, [Math.sin(a) * 0.04, Math.cos(a) * 0.04, 0], GOLD, { r: [0, 0, -a], seg: 3 }); } });
  } else k.torus(0.16, 0.026, [0, 0.72, 0.3], SKY_D, { r: [Math.PI / 2 - 0.6, 0, 0], seg: 12, ts: 4 });
  k.sym(() => k.bone(BONE.WING_R, [0.12, 0.8, 0.08], () => wing(k, [0.12, 0.8, 0.08], {
    W: [0.3, 0.22, -0.05], T: U ? [0.76, 0.46, -0.28] : [0.7, 0.42, -0.26], len: U ? 0.58 : 0.52, drop: [0.3, -0.75, -0.6], dropIn: [0.15, -1, -0.3],
    n: 8, col: U ? 0xe8f0ff : WHITE, tip: U ? ROYAL : SKY, cov: WHITE, bone: U ? SILVER : CREAM, prim: 3,
  })));
  return k.done();
}

// Dendroid: a walking oak. Bark trunk with a glowing-eyed face, two root legs
// with splayed root toes, branch arms with club hands and leafy twigs, a big
// leafy crown. Dendroid soldier: pink blossoms in the crown, thorny arms,
// bark shoulder plates, amber eyes, gold-leaf belt.
function dendroid(U) {
  const k = makeKit(U ? 179 : 173, [0, 0.42, 0]);
  const BK = U ? 0xa06e3c : BARK;
  // root legs (LEG_FR / LEG_FL)
  k.sym(() => k.bone(BONE.LEG_FR, [0.11, 0.4, 0], () => {
    k.limb([0.11, 0.44, 0], [0.15, 0.08, 0.03], 0.11, 0.09, BARK_D, { seg: 6 });
    for (const [yaw, len] of [[-0.7, 0.2], [0, 0.24], [0.7, 0.2], [Math.PI, 0.14]]) k.cone(0.05, len, [0.15, 0.06, 0.03], BARK_D, { r: [1.72, yaw, 0], seg: 4 });
  }));
  // trunk with bold ridges
  k.lathe([[0.2, 0.28], [0.245, 0.4], [0.225, 0.55], [0.215, 0.7], [0.24, 0.86], [0.27, 0.96], [0.18, 1.04], [0.05, 1.06]], [0, 0, 0], BK, { s: [1, 1, 0.84], seg: 8, grad: [0.8, 1.1] });
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.45; if (Math.abs(Math.sin(a)) < 0.35 && Math.cos(a) > 0) continue; k.box(0.06, 0.5, 0.05, [Math.sin(a) * 0.22, 0.66, Math.cos(a) * 0.185], BARK_D, { r: [0, a, 0] }); }
  if (U) k.lathe([[0.25, 0.42], [0.252, 0.48]], [0, 0, 0], GOLD, { s: [1, 1, 0.86], seg: 8, grad: [1, 1] });
  // the face: brow, glowing eyes, a knotted nose and a mouth crack
  k.box(0.26, 0.055, 0.08, [0, 0.83, 0.17], BARK_L, { r: [0.25, 0, 0] });
  k.sym(() => {
    k.ell(0.055, 0.042, 0.03, [0.075, 0.775, 0.175], KNOT, { grad: [1, 1], ao: false });
    k.ball(0.032, [0.075, 0.775, 0.195], U ? 0xffc040 : 0xd8ff5a, { glow: true, d: 0 });
  });
  k.cone(0.04, 0.09, [0, 0.72, 0.18], BARK_L, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 4 });
  k.ell(0.085, 0.024, 0.03, [0, 0.64, 0.18], KNOT, { grad: [1, 1], ao: false });
  // moss on the shoulders
  k.sym(() => k.ell(0.12, 0.06, 0.13, [0.17, 0.95, 0.0], U ? BARK_L : MOSS, { r: [0, 0, -0.4] }));
  // branch arms (ARM_R / ARM_L) with big club hands, root fingers and a leafy twig
  k.sym(() => k.bone(BONE.ARM_R, [0.21, 0.88, 0], () => {
    const S0 = [0.2, 0.88, 0], E = [0.38, 0.68, 0.06], Hn = [0.44, 0.44, 0.14];
    k.limb(S0, E, 0.085, 0.066, BK, { seg: 6 });
    k.limb(E, Hn, 0.066, 0.06, BK, { seg: 6 });
    k.ell(0.1, 0.11, 0.1, Hn, BARK_L, { grad: [0.85, 1.1] });
    for (const [yaw, dz] of [[-0.5, 0], [0.3, 0.04], [1.1, 0]]) k.cone(0.034, 0.16, [Hn[0], Hn[1] - 0.06, Hn[2] + dz], BARK_D, { r: [Math.PI - 0.5, yaw, 0], seg: 4 });
    k.limb([0.31, 0.77, 0.03], [0.42, 0.97, -0.04], 0.034, 0.016, BK, { seg: 4 });
    k.ball(0.095, [0.43, 0.99, -0.04], LEAF, { top: [LEAF_L, 0.4] });
    if (U) for (const t of [0.3, 0.65]) { const p = tup(S0, Hn, t); k.cone(0.03, 0.1, p, BARK_L, { r: [0, 0, -1.3 - t], seg: 3 }); }
  }));
  // leafy crown (HEAD: rustles / looks around), a few branches poking through
  k.bone(BONE.HEAD, [0, 1.0, 0], () => {
    k.sym(() => k.limb([0.04, 0.98, 0], [0.22, 1.3, -0.06], 0.05, 0.03, BK, { seg: 5 }));
    const blobs = [[0, 1.22, -0.07, 0.3, LEAF], [0.25, 1.1, -0.05, 0.18, LEAF_D], [-0.25, 1.12, -0.06, 0.19, LEAF], [0.11, 1.4, -0.08, 0.18, LEAF], [-0.13, 1.36, 0.02, 0.16, LEAF_D], [0, 1.15, -0.3, 0.19, LEAF_D], [0.2, 1.28, -0.22, 0.15, LEAF]];
    for (const [x, y, z, r, c] of blobs) k.ell(r * 1.08, r * 0.9, r, [x, y, z], c, { top: [LEAF_L, 0.35], grad: [0.82, 1.1] });
    if (U) {
      const bl = [[0.02, 1.5, 0.0], [0.24, 1.3, 0.05], [-0.24, 1.3, 0.04], [0.12, 1.3, 0.18], [-0.12, 1.28, 0.16], [0.3, 1.18, -0.14], [-0.33, 1.18, -0.06], [0.0, 1.38, -0.25], [-0.1, 1.48, -0.1]];
      bl.forEach((p, i) => k.ball(0.055, p, i % 3 ? PINK : WHITE, { d: 0, grad: [1, 1.05], ao: false }));
    }
  });
  return k.done();
}

// Unicorn: white horse, long golden spiral horn, rainbow mane and tail.
// War unicorn: gold chanfron, white caparison with a violet band and gold hem,
// gold hooves, a longer glowing horn.
function unicorn(U) {
  const k = makeKit(U ? 191 : 181, [0, 0.64, -0.03]);
  const RB = [PINK, ORANGE, SUN, MINT, SKY, VIOLET];
  horse(k, {
    coat: WHITE, coatD: 0xeee8f4, hoof: U ? GOLD : 0xd8b07a, mane: RB, tail: [PINK, SUN, MINT, SKY, VIOLET],
    headFx: () => {
      const L = U ? 0.4 : 0.34;
      k.at([0, 0.07, 0.06], [-0.55, 0, 0], 1, () => {
        k.cone(0.045, L, [0, 0, 0], GOLD_L, { seg: 6, grad: [0.9, 1.15] });
        const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, a = t * Math.PI * 2 * 3.5, r = 0.046 * (1 - t) + 0.003; pts.push(new THREE.Vector3(Math.cos(a) * r, t * L * 0.92, Math.sin(a) * r)); }
        k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.012, 4, false), GOLD, { grad: [0.95, 1.05] });
        k.ball(U ? 0.05 : 0.035, [0, L, 0], 0xfff4b0, { glow: true, d: 0 });
        if (U) k.cone(0.03, 0.2, [0, L * 0.6, 0], 0xfff8d0, { glow: true, seg: 4 });
      });
      if (U) k.ell(0.066, 0.044, 0.17, [0, 0.062, 0.12], GOLD, { grad: [0.85, 1.12] });
    },
  });
  if (U) {
    k.lathe([[0.226, 0.4], [0.216, 0.5], [0.2, 0.66], [0.16, 0.78], [0.06, 0.84]], [0, 0, -0.04], WHITE, { s: [1, 1, 2.0], seg: 10, grad: [0.86, 1.06] });
    k.lathe([[0.232, 0.44], [0.228, 0.5]], [0, 0, -0.04], VIOLET, { s: [1, 1, 2.0], seg: 10, grad: [1, 1] });
    k.lathe([[0.236, 0.38], [0.232, 0.43]], [0, 0, -0.04], GOLD, { s: [1, 1, 2.0], seg: 10, grad: [1, 1] });
    k.sym(() => sunBadge(k, [0.2, 0.62, -0.1], [0, Math.PI / 2, 0], 1.6, 0xe0a0ff));
    k.torus(0.17, 0.035, [0, 0.72, 0.3], GOLD, { r: [Math.PI / 2 - 0.6, 0, 0], seg: 12, ts: 4 });
  }
  return k.done();
}

// a dragon's membrane wing on the +x side: arm root -> elbow -> wrist, three
// fingers, a scalloped two-layer membrane back to the flank
function dragonWing(k, o) {
  const { root, elbow, wrist, tips, back, bone, mem, mem2, th = 0.014 } = o;
  k.limb(root, elbow, 0.07, 0.055, bone, { seg: 6 });
  k.ball(0.06, elbow, bone, { d: 0 });
  k.limb(elbow, wrist, 0.055, 0.045, bone, { seg: 6 });
  k.ball(0.052, wrist, bone, { d: 0 });
  k.cone(0.04, 0.14, wrist, o.claw ?? IVORY, { r: [0, 0, -0.2], seg: 4 });
  for (const t of tips) k.limb(wrist, t, 0.036, 0.014, bone, { seg: 5 });
  const W = V3(wrist), anchors = [...tips, back];
  const P1 = [], P2 = [];
  const tri = (P, a, b, c) => {
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize().multiplyScalar(th);
    P.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    P.push(...a.clone().add(n).toArray(), ...c.clone().add(n).toArray(), ...b.clone().add(n).toArray());
  };
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = V3(anchors[i]), b = V3(anchors[i + 1]);
    const m = a.clone().lerp(b, 0.5).lerp(W, i === anchors.length - 2 ? 0.08 : 0.2);
    const P = i < 1 ? P2 : P1;
    tri(P, W, a, m); tri(P, W, m, b);
  }
  tri(P1, W, V3(back), V3(elbow)); tri(P1, V3(elbow), V3(back), V3(root));
  for (const [P, c] of [[P1, mem], [P2, mem2 ?? mem]]) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    k.add(g, c, { grad: [0.9, 1.08], noise: 0.02 });
  }
}

// Green dragon: bright green with a yellow belly, yellow spines and fins, ivory
// horns, huge yellow-green membrane wings, glowing eyes and a hint of fire.
// Gold dragon: gold all over, cream belly, orange-gold membranes, a crown of
// horns, red-glowing eyes, bigger wings.
function greendragon(U) {
  const k = makeKit(U ? 211 : 199, [0, 0.62, -0.04]);
  const G = U ? 0xf6c43a : 0x44c43c, GD = U ? 0xe0a028 : 0x2fa83a, BELLY = U ? 0xfff0b0 : 0xe8ee6a, SP = U ? 0xffe890 : SUN;
  const MEM = U ? 0xffbe48 : 0xb4e84a, MEM2 = U ? 0xffa23a : 0x8ad83a, HORN = IVORY, EYE = U ? 0xff5a3a : 0xffe040;
  // body
  k.ell(0.25, 0.24, 0.42, [0, 0.62, -0.04], G, { grad: [0.82, 1.08] });
  k.ell(0.2, 0.17, 0.36, [0, 0.52, 0.02], BELLY, { grad: [0.9, 1.05] });
  k.ell(0.22, 0.25, 0.21, [0, 0.7, 0.26], G, {});
  k.ell(0.17, 0.2, 0.12, [0, 0.64, 0.36], BELLY, { r: [-0.3, 0, 0] });
  for (let i = 0; i < 4; i++) k.cone(0.06, 0.15 - i * 0.015, [0, 0.86 - i * 0.02, 0.18 - i * 0.16], SP, { r: [-0.5, 0, 0], seg: 3 });
  // legs
  k.sym(() => {
    k.bone(BONE.LEG_BR, [0.17, 0.62, -0.28], () => {
      k.ell(0.11, 0.19, 0.17, [0.18, 0.52, -0.28], G, { grad: [0.84, 1.08] });
      k.limb([0.2, 0.4, -0.34], [0.21, 0.12, -0.42], 0.075, 0.058, GD, { seg: 6 });
      k.ell(0.08, 0.05, 0.13, [0.21, 0.045, -0.34], GD, { d: 0 });
      for (const t of [-1, 0, 1]) k.cone(0.026, 0.08, [0.21 + t * 0.04, 0.03, -0.24], HORN, { r: [Math.PI / 2 + 0.3, t * 0.3, 0], seg: 3 });
    });
    k.bone(BONE.LEG_FR, [0.15, 0.64, 0.3], () => {
      k.limb([0.15, 0.66, 0.3], [0.2, 0.38, 0.34], 0.085, 0.065, G, { seg: 6 });
      k.limb([0.2, 0.38, 0.34], [0.2, 0.08, 0.4], 0.062, 0.05, GD, { seg: 6 });
      k.ell(0.072, 0.045, 0.11, [0.2, 0.04, 0.45], GD, { d: 0 });
      for (const t of [-1, 0, 1]) k.cone(0.024, 0.075, [0.2 + t * 0.035, 0.03, 0.53], HORN, { r: [Math.PI / 2 + 0.3, t * 0.3, 0], seg: 3 });
    });
  });
  // tail with spines and a spade tip
  k.bone(BONE.TAIL, [0, 0.6, -0.42], () => {
    const tp = [[0, 0.62, -0.38], [0, 0.48, -0.66], [0.1, 0.3, -0.9], [0.26, 0.2, -1.06], [0.42, 0.18, -1.12]], tr = [0.15, 0.11, 0.075, 0.05, 0.03];
    for (let i = 0; i < tp.length - 1; i++) {
      k.limb(tp[i], tp[i + 1], tr[i], tr[i + 1], G, { seg: 6 });
      k.ball(tr[i + 1], tp[i + 1], G, { d: 0 });
      if (i < 3) k.cone(0.05 - i * 0.01, 0.12 - i * 0.02, [tp[i + 1][0], tp[i + 1][1] + tr[i + 1] * 0.8, tp[i + 1][2]], SP, { r: [-0.6, 0, 0], seg: 3 });
    }
    k.plate([[0, 0], [0.1, 0.06], [0.04, 0.22], [0, 0.26], [-0.04, 0.22], [-0.1, 0.06]], 0.03, [0.42, 0.18, -1.12], SP, { r: [-Math.PI / 2, 0.9, 0] });
  });
  // wings
  const S = U ? 1.1 : 1;
  k.sym(() => k.bone(BONE.WING_R, [0.12, 0.84, 0.12], () => dragonWing(k, {
    root: [0.12, 0.84, 0.12], elbow: [0.42 * S, 1.12 * S, 0.04], wrist: [0.66 * S, 1.36 * S, -0.1],
    tips: [[1.0 * S, 1.14 * S, -0.3], [0.92 * S, 0.84, -0.44], [0.66 * S, 0.66, -0.5]], back: [0.14, 0.72, -0.36],
    bone: GD, mem: MEM, mem2: MEM2, claw: HORN,
  })));
  // neck and head (HEAD)
  k.bone(BONE.HEAD, [0, 0.76, 0.34], () => {
    k.limb([0, 0.72, 0.32], [0, 0.98, 0.47], 0.15, 0.115, G, { seg: 7 });
    k.limb([0, 0.98, 0.47], [0, 1.18, 0.55], 0.115, 0.095, G, { seg: 7 });
    k.limb([0, 0.7, 0.42], [0, 1.12, 0.6], 0.09, 0.07, BELLY, { seg: 6 });
    for (let i = 0; i < 3; i++) k.cone(0.05, 0.12, tup([0, 0.94, 0.34], [0, 1.24, 0.47], i / 2), SP, { r: [-1.0, 0, 0], seg: 3 });
    k.at([0, 1.25, 0.62], [0.25, 0, 0], 1.15, () => {
      k.ell(0.12, 0.11, 0.14, [0, 0, 0], G, { grad: [0.88, 1.1] });
      k.ell(0.085, 0.07, 0.17, [0, -0.025, 0.16], G, {});
      k.ell(0.075, 0.035, 0.15, [0, -0.085, 0.13], BELLY, { r: [0.3, 0, 0] }); // open lower jaw
      k.ell(0.05, 0.02, 0.08, [0, -0.06, 0.2], 0xff7a3a, { glow: true, d: 0 });  // fire in the maw
      k.sym(() => {
        k.box(0.08, 0.035, 0.1, [0.065, 0.065, 0.06], GD, { r: [0, -0.2, -0.3] });
        k.ball(0.03, [0.08, 0.035, 0.1], EYE, { glow: true, d: 0 });
        k.limb([0.07, 0.07, -0.05], [0.12, 0.15, -0.2], 0.042, 0.03, HORN, { seg: 5 });
        k.limb([0.12, 0.15, -0.2], [0.13, 0.18, -0.32], 0.03, 0.006, HORN, { seg: 5 });
        k.plate([[0, 0], [0.12, 0.06], [0.1, -0.03]], 0.014, [0.1, -0.01, -0.03], SP, { r: [0, -0.5, 0] }); // cheek fin
        k.ball(0.014, [0.03, 0.0, 0.32], INK, { d: 0, ao: false });
      });
      if (U) for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32; k.cone(0.028, 0.12, [Math.sin(a) * 0.08, 0.1, -0.03 - Math.cos(a) * 0.02], HORN, { r: [-0.5, 0, -a], seg: 4 }); }
    });
  });
  return k.done();
}

const BUILDERS = { centaur, dwarf, woodelf, pegasus, dendroid, unicorn, greendragon };
const BASE_OF = { centaurcpt: 'centaur', battledwarf: 'dwarf', grandelf: 'woodelf', silverpegasus: 'pegasus', dendroidsoldier: 'dendroid', warunicorn: 'unicorn', golddragon: 'greendragon' };
export const SYLVAN_BASE_IDS = Object.keys(BUILDERS);
export const SYLVAN_UP_IDS = Object.keys(BASE_OF);
export const SYLVAN_IDS = [...SYLVAN_BASE_IDS, ...SYLVAN_UP_IDS];
// sylvanBuild(baseId, upgraded) -> fresh { body, glow } or null
export function sylvanBuild(id, up = false) {
  const f = BUILDERS[id];
  return f ? f(!!up) : null;
}
const cache = new Map();
// sylvanModel(id) -> { body, glow } (cached) for any of the 14 Sylvan ids, else null
export function sylvanModel(id) {
  if (cache.has(id)) return cache.get(id);
  const m = BUILDERS[id] ? sylvanBuild(id, false) : BASE_OF[id] ? sylvanBuild(BASE_OF[id], true) : null;
  if (m) cache.set(id, m);
  return m;
}
