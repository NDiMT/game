import * as THREE from 'three';
import { BONE } from './rig.js?v=1.6';

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
const tup = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
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
      const pr = { bone: rig.b, pivot: rig.p, col: new THREE.Color(col), grad: o.grad ?? [0.9, 1.06], glow: !!o.glow, ao: o.ao ?? true, noise: o.noise ?? 0.025, top: o.top,
        under: o.under ?? 0, band: o.band, bandCol: o.bandCol != null ? new THREE.Color(o.bandCol) : null, mottle: o.mottle ?? 0 };
      parts.push({ g: ng, ...pr });
      // two-sided sheet (capes, pennants): add a back face, nudged inward a hair
      if (o.both) { const bg = ng.clone(); flip(bg); parts.push({ g: bg, ...pr }); }
    },
    // geometry primitives, all placed at p with euler r and scale s
    box(w, h, d, p, col, o = {}) { k.add(new THREE.BoxGeometry(w, h, d).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    // big ellipsoids get one more subdivision so heads and bodies look sculpted, not boxy
    ell(rx, ry, rz, p, col, o = {}) { k.add(new THREE.IcosahedronGeometry(1, o.d ?? (Math.max(rx, ry, rz) > 0.13 ? 2 : 1)).scale(rx, ry, rz).applyMatrix4(mat(p, o.r)), col, o); },
    ball(r, p, col, o = {}) { k.ell(r, r, r, p, col, o); },
    // a tiny rivet / bead / gem: an octahedron (8 tris)
    stud(r, p, col, o = {}) { k.add(new THREE.OctahedronGeometry(r, 0).applyMatrix4(mat(p, o.r, o.s)), col, { ao: false, grad: [1, 1.08], ...o }); },
    lathe(prof, p, col, o = {}) {
      // o.sub: split every profile segment into sub pieces (extra rings for banding / folds)
      if (o.sub > 1) { const q = []; for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < o.sub; j++) q.push(tup(prof[i], prof[i + 1], j / o.sub)); q.push(prof[prof.length - 1]); prof = q; }
      const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), o.seg ?? 8, o.phi ?? 0, o.len ?? Math.PI * 2);
      k.add(g.applyMatrix4(mat(p, o.r, o.s)), col, o);
    },
    cyl(r1, r2, h, p, col, o = {}) { k.add(new THREE.CylinderGeometry(r2, r1, h, o.seg ?? 8, o.hs ?? 1, !!o.open).translate(0, h / 2, 0).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    cone(r, h, p, col, o = {}) { k.add(new THREE.ConeGeometry(r, h, o.seg ?? 6).translate(0, h / 2, 0).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    torus(R, t, p, col, o = {}) { k.add(new THREE.TorusGeometry(R, t, o.ts ?? 4, o.seg ?? 16, o.arc ?? Math.PI * 2).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    // a tapered rod from a to b
    limb(a, b, r1, r2, col, o = {}) {
      const va = V3(a), vb = V3(b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r2, r1, len, o.seg ?? 8, o.hs ?? 1, !!o.open).translate(0, len / 2, 0);
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
      const fn = _b.cross(_c).normalize(), ny = fn.y || 0;
      // thin sheets (membranes): faces turned away from the sun get lifted so the shaded side never goes murky
      if (pt.under) { const sd = fn.x * 0.35 + fn.y * 0.87 + fn.z * 0.26; if (sd < 0.55) m *= 1 + pt.under * Math.min(1, (0.55 - sd) * 1.2); if (globalThis.__dbgUnder) m *= 3; }
      let ao = 1, cool = 0;
      if (!pt.glow) {
        m *= 1 + 0.12 * Math.max(0, ny) - 0.07 * Math.max(0, -ny);
        m *= 0.9 + 0.16 * Math.min(1, y / gy1);
        if (pt.ao) { const a = smooth(0, 0.28, y); ao = 0.8 + 0.2 * a; cool = (1 - a) * 0.06; }
      }
      m *= ao * (1 + (hash3(x + seed, y, z) - 0.5) * 2 * pt.noise);
      let c = pt.col;
      if (pt.top && y > y1 - span * pt.top[1]) c = new THREE.Color(pt.top[0]);
      // per-facet patterns (crisp with flat shading): band = [axis, freq, amp] stripes
      // (mail rings, belly plates, feather bars); bandCol swaps the colour instead;
      // mottle = per-facet value jitter (scales, bark)
      if (pt.band || pt.mottle) {
        const cx = (P[t0] + P[t0 + 3] + P[t0 + 6]) / 3, cy = (P[t0 + 1] + P[t0 + 4] + P[t0 + 7]) / 3, cz = (P[t0 + 2] + P[t0 + 5] + P[t0 + 8]) / 3;
        if (pt.band) {
          const [ax, fq, am] = pt.band, v = [cx, cy, cz][ax] * fq, odd = ((Math.floor(v) % 2) + 2) % 2;
          if (pt.bandCol) { if (odd) c = pt.bandCol; } else m *= odd ? 1 - am : 1 + am * 0.5;
        }
        if (pt.mottle) m *= 1 + (hash3(cx * 7.1 + seed, cy * 5.3, cz * 6.7) - 0.5) * 2 * pt.mottle;
      }
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
  // bracer / cuff: a wider band over the lower forearm, with a trim ring at the wrist
  if (c.cuff) {
    k.limb(tup(E.toArray(), Hh.toArray(), 0.42).map((v, i) => v), tup(E.toArray(), Hh.toArray(), 0.9), c.r1 * 0.98, c.r2 * 1.12, c.cuff, { grad: [0.9, 1.1], band: c.cuffBand });
    if (c.cuffTrim) k.limb(tup(E.toArray(), Hh.toArray(), 0.86), tup(E.toArray(), Hh.toArray(), 0.95), c.r2 * 1.2, c.r2 * 1.18, c.cuffTrim, { grad: [1, 1], ao: false });
  }
  k.ball(c.hr, Hh.toArray(), c.hand, { d: 1 });
  // a chunky thumb so the fist reads as a hand up close
  k.ell(c.hr * 0.42, c.hr * 0.42, c.hr * 0.7, Hh.clone().add(new THREE.Vector3(-0.02, 0.025, 0.035)).toArray(), c.hand, { d: 0 });
  return Hh.toArray();
}

function eyes(k, y = HY + 0.005, z = 0.128, col = INK) {
  k.sym(() => k.ell(0.025, 0.031, 0.014, [0.05, y, z], col, { d: 0, grad: [1, 1], ao: false }));
}

// Detailed eyes facing +z: whites, a coloured iris, a pupil, an optional brow and
// lid line. x = half spacing, slant tilts them (elves), yaw turns them around the head.
function face(k, o) {
  const { y, z, x = 0.05, w = 0.03, h = 0.026, iris = 0x3a78d0, white = 0xfdfaf0, brow = null, browT = 0.18, browW = 1, slant = 0, yaw = 0.3, pupil = INK, lid = null } = o;
  k.sym(() => k.at([x, y, z], [0, yaw, slant], 1, () => {
    k.ell(w, h, w * 0.45, [0, 0, 0], white, { d: 1, grad: [0.96, 1.04], ao: false, noise: 0 });
    k.ell(w * 0.6, h * 0.86, w * 0.3, [0.002, -0.002, w * 0.3], iris, { d: 0, grad: [0.85, 1.1], ao: false, noise: 0 });
    k.ell(w * 0.28, h * 0.42, w * 0.2, [0.002, -0.002, w * 0.5], pupil, { d: 0, grad: [1, 1], ao: false, noise: 0 });
    if (lid) k.ell(w * 1.08, h * 0.45, w * 0.5, [0, h * 0.62, 0.002], lid, { d: 0, grad: [1, 1], ao: false, noise: 0 });
    if (brow) k.box(w * 2.3 * browW, 0.018, 0.03, [0.004, h + 0.02, w * 0.1], brow, { r: [0, 0, browT], grad: [0.95, 1.05], ao: false });
  }));
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
      k.cyl(0.074, 0.08, 0.06, [st, 0.1, 0.012], o.bootCuff ?? boots, { seg: 10, grad: [0.95, 1.12] });
      k.ell(0.06, 0.03, 0.05, [st, 0.03, 0.12], o.toe ?? boots, { d: 0, grad: [0.9, 1.08] });
    }
  }));
  k.ell(0.155, 0.085, 0.115, [0, 0.43, 0], o.hips ?? legs);
  k.lathe([[0.135, 0.4], [0.155, 0.48], [0.185, 0.56], [0.205, 0.63], [0.19, 0.69], [0.12, 0.73], [0.03, 0.745]], [0, 0, 0], o.torso, { s: [1, 1, 0.76], seg: 12, sub: o.torsoBand ? 2 : 1, band: o.torsoBand, grad: o.torsoGrad ?? [0.82, 1.1] });
  if (o.belt) k.lathe([[0.158, 0.44], [0.162, 0.495]], [0, 0, 0], o.belt, { s: [1, 1, 0.8], seg: 10, grad: [1, 1] });
  if (o.head !== false) k.bone(BONE.HEAD, NECK, () => {
    k.ell(HR, HR * 1.02, HR * 0.98, [0, HY, 0.01], o.skin ?? SKIN, { grad: [0.95, 1.05] });
    if (o.eyes !== false) eyes(k);
  });
  if (o.pauldron) k.sym(() => {
    k.ell(0.118, 0.088, 0.118, [0.2, 0.675, 0], o.pauldron, { r: [0, 0, -0.38], grad: [0.85, 1.12] });
    if (o.pTrim) k.torus(0.105, 0.024, [0.205, 0.652, 0], o.pTrim, { r: [Math.PI / 2, 0, -0.38], seg: 8, ts: 3, grad: [1, 1] });
  });
  const ac = { upper: o.upper ?? o.torso, fore: o.fore ?? o.upper ?? o.torso, hand: o.hand ?? SKIN, elbow: o.elbow, r1: o.armR ?? 0.064, r2: o.foreR ?? 0.056, hr: o.handR ?? 0.058,
    cuff: o.cuff, cuffTrim: o.cuffTrim, cuffBand: o.cuffBand };
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
  // overlapping feather rows over each band edge (coverts over secondaries)
  if (o.rows !== false) for (const [f0, f1, c] of [[0.3, 0.56, cov], [0.64, 0.9, col]]) for (let i = 0; i < n; i++) {
    const a = roots[i].clone().lerp(ends[i], f0).lerp(roots[i + 1].clone().lerp(ends[i + 1], f0), 0.5);
    const b = roots[i].clone().lerp(ends[i], f1).lerp(roots[i + 1].clone().lerp(ends[i + 1], f1), 0.5);
    k.feather(a.toArray(), b.toArray(), len * 0.16, c, { grad: [0.92, 1.06], t: th * 2.2, noise: 0.01 });
  }
  // a few broad primaries fanning past the tip, barred near the end
  for (let j = 0; j < prim; j++) {
    const i = n - j * 2, r0 = roots[Math.max(0, i)].clone();
    const dir = dirs[Math.max(0, i)].clone().lerp(E, 0.25 - j * 0.05).normalize();
    k.feather(r0.toArray(), r0.clone().add(dir.multiplyScalar(len * (0.72 + j * 0.1))).toArray(), 0.1, tip, { grad: [0.95, 1.08], t: 0.02, band: o.bar ? [1, 22, 0.12] : null });
  }
}


// ---------------------------------------------------------------- sylvan palette
const LEAF = 0x4cc040, LEAF_D = 0x2f9a3a, LEAF_L = 0x9ae05a, EMER = 0x22a058, LIME = 0xb4e04a, MOSS = 0x8ccf4a;
const BARK = 0xb07a42, BARK_D = 0x8e5e32, BARK_L = 0xd09a5c, KNOT = 0x6e4628;
const HAIR_B = 0xffe07a, HAIR_BR = 0xa85a2c, BEARD = 0xf2702a, BEARD_L = 0xffa04a;
const SILVER = 0xdde6f4, SILVER_D = 0xb4c2da, SKY = 0x7cc8ff, SKY_D = 0x4a9ef0, VIOLET = 0xb07cff, PINK = 0xff86c0;
const MINT = 0x6ee0a8, SUN = 0xffd84a, ORANGE = 0xffa040, IVORY = 0xfff2d6;

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
  const CL = o.coatL ?? new THREE.Color(C).lerp(new THREE.Color(0xffffff), 0.28).getHex();
  k.ell(0.2, 0.2, 0.4, [0, 0.64, -0.03], C, { grad: [0.84, 1.06] });
  k.ell(0.18, 0.21, 0.18, [0, 0.68, 0.24], C, {});
  k.ell(0.19, 0.2, 0.17, [0, 0.68, -0.3], C, {});
  // sculpting: chest muscles, a paler belly, shoulder and haunch masses
  k.sym(() => {
    k.ell(0.085, 0.12, 0.08, [0.075, 0.6, 0.36], C, { d: 1, grad: [0.86, 1.08] });
    k.ell(0.08, 0.16, 0.15, [0.14, 0.66, -0.32], C, { d: 1, r: [-0.15, 0, -0.06], grad: [0.86, 1.1] });
  });
  k.ell(0.15, 0.08, 0.3, [0, 0.49, -0.02], CL, { d: 1, grad: [0.95, 1.02], ao: false });
  const legsAt = [[0.1, 0.3, 0.12, BONE.LEG_FR], [-0.1, 0.24, -0.04, BONE.LEG_FL], [0.1, -0.3, -0.06, BONE.LEG_BR], [-0.1, -0.28, 0.06, BONE.LEG_BL]];
  for (const [x, z, sw, bn] of legsAt) k.bone(bn, [x, 0.6, z], () => {
    const K = [x, 0.33, z + sw * 0.5], F = [x, 0.11, z + sw * 0.9];
    k.limb([x, 0.62, z], K, 0.085, 0.058, C, { seg: 8 });
    k.ball(0.06, K, C, { d: 0 }); // knee / hock
    k.limb(K, F, 0.05, 0.044, CD, { seg: 8 });
    k.ball(0.052, F, CD, { d: 0 }); // fetlock
    if (o.feath) {
      // feathering: a sock with a fringe of tufts falling over the hoof
      k.cyl(0.07, 0.056, 0.08, [x, 0.06, z + sw], SOCK, { seg: 8 });
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; k.cone(0.03, 0.06, [x + Math.sin(a) * 0.058, 0.09, z + sw + Math.cos(a) * 0.058], SOCK, { r: [Math.PI - 0.35 * Math.cos(a), 0, 0.35 * Math.sin(a)], seg: 3, grad: [0.92, 1.06] }); }
    } else k.limb(F, [x, 0.06, z + sw], 0.044, 0.05, CD, { seg: 8 });
    // hoof with a pale coronet band and a darker sole rim
    k.cyl(0.062, 0.056, 0.075, [x, 0.0, z + sw], HOOF, { seg: 10, ao: false, grad: [0.88, 1.06] });
    k.cyl(0.06, 0.06, 0.016, [x, 0.07, z + sw], o.coronet ?? CL, { seg: 10, ao: false, grad: [1, 1] });
  });
  // tail: a fan of locks, each ending in a tuft (several colours for the rainbow)
  const tc = o.tail ?? [CD, C, CD];
  k.bone(BONE.TAIL, [0, 0.72, -0.42], () => {
    k.ell(0.06, 0.06, 0.08, [0, 0.72, -0.43], tc[0], { d: 1 });
    tc.forEach((c, i) => {
      const x = (i - (tc.length - 1) / 2) * (tc.length > 3 ? 0.036 : 0.034), r = tc.length > 3 ? 0.04 : 0.052;
      const dz = (i % 2 ? 0.025 : -0.015);
      const M = [x, 0.66, -0.6 + dz], N = [x * 1.5, 0.5, -0.72 + dz], E = [x * 2, 0.32, -0.7 + dz * 1.5];
      k.limb([0, 0.74, -0.42], M, r, r, c, { seg: 6 });
      k.ball(r, M, c, { d: 0 });
      k.limb(M, N, r, r * 0.95, c, { seg: 6 });
      k.limb(N, E, r * 0.95, r * 0.7, c, { seg: 6 });
      k.cone(r * 0.75, 0.11, E, c, { r: [Math.PI - 0.15, 0, x * 3], seg: 6, grad: [0.9, 1.08] });
    });
  });
  if (o.noHead) return;
  const mc = o.mane ?? [CD];
  k.bone(BONE.HEAD, [0, 0.76, 0.3], () => {
    k.limb([0, 0.72, 0.28], [0, 1.0, 0.47], 0.125, 0.092, C, { seg: 10 });
    k.limb([0, 0.74, 0.36], [0, 0.98, 0.52], 0.07, 0.05, CL, { seg: 8, grad: [0.95, 1.04] }); // throat
    // mane: two staggered rows of tufts sweeping back (rainbow when several colours)
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), p = tup([0, 0.8, 0.22], [0, 1.08, 0.42], t);
      k.cone(0.06, 0.21 - t * 0.04, p, mc[i % mc.length], { r: [-1.25 + t * 0.2, 0, 0.12], seg: 5, grad: [0.9, 1.1] });
      if (i < n - 1) k.cone(0.045, 0.17 - t * 0.03, tup(p, [0, 1.08, 0.42], 0.08), mc[(i + 1) % mc.length], { r: [-1.35 + t * 0.2, 0, -0.35], seg: 4, grad: [0.92, 1.08] });
    }
    k.at([0, 1.02, 0.52], [0.95, 0, 0], 1, () => {
      k.ell(0.086, 0.094, 0.19, [0, 0, 0.09], C, {});
      k.ell(0.076, 0.078, 0.085, [0, -0.015, 0.25], CD, {});
      k.sym(() => {
        k.ell(0.03, 0.05, 0.07, [0.07, -0.03, 0.08], C, { d: 1 }); // cheek
        // ears with a pale inner
        k.cone(0.036, 0.12, [0.05, 0.06, -0.04], C, { r: [-0.5, 0, 0.25], seg: 5 });
        k.cone(0.02, 0.08, [0.05, 0.068, -0.03], o.earIn ?? 0xffb4b8, { r: [-0.5, 0, 0.25], seg: 4, grad: [1, 1] });
        // big dark-blue eye with a pale ring and a sparkle, lashes on the unicorn
        k.at([0.076, 0.03, 0.09], [0, 0.95, 0], 1, () => {
          k.ell(0.03, 0.033, 0.014, [0, 0, -0.004], CL, { d: 0, grad: [1, 1], ao: false });
          k.ell(0.024, 0.027, 0.014, [0, 0, 0.002], o.eye ?? INK, { d: 1, grad: [0.9, 1.15], ao: false, noise: 0 });
          k.ball(0.007, [0.007, 0.01, 0.014], 0xffffff, { d: 0, glow: true });
          if (o.lash) for (let j = 0; j < 3; j++) k.cone(0.007, 0.03, [-0.012 + j * 0.012, 0.024, 0.004], o.lash, { r: [0.1, 0, 0.5 - j * 0.4], seg: 3, grad: [1, 1], ao: false });
        });
        // nostril and a mouth line
        k.ell(0.016, 0.022, 0.012, [0.04, 0.0, 0.32], 0xc87a80, { d: 0, grad: [1, 1], ao: false, r: [0, 0.6, 0] });
        k.box(0.004, 0.012, 0.09, [0.05, -0.07, 0.26], 0xc87a80, { r: [0, 0.18, 0], ao: false });
      });
      k.cone(0.045, 0.12, [0, 0.07, 0.02], mc[0], { r: [-1.9, 0, 0], seg: 5 }); // forelock
      k.cone(0.035, 0.1, [0.02, 0.075, 0.0], mc[1 % mc.length], { r: [-2.0, 0, -0.35], seg: 4 });
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
// Round 7 detail: faces (eyes, brows, nose, mouth), braided pony-tail with wraps,
// laced jerkin, baldric + pouch, bracers, embroidered saddle cloth with a leaf
// border and tassels, grip-wrapped javelins with ribbed heads, layered plates.
function centaur(U) {
  const k = makeKit(U ? 131 : 127, [0, 0.64, -0.03]);
  const COAT = U ? 0xc4743a : 0xd08a44, COAT_D = U ? 0xa8602e : 0xb8743a, MANE = 0x9a522c, MANE_L = 0xc07040;
  const CLOTH = U ? EMER : LEAF_D, TRIM = U ? GOLD : LIME;
  // the horse half is a little shorter than a real horse: keeps the unit compact on its hex
  k.at([0, 0, 0], [0, 0, 0], [1.05, 1, 0.84], () => {
  horse(k, { coat: COAT, coatD: COAT_D, noHead: true, tail: [MANE, MANE_L, MANE], hoof: 0xa88462, sock: CREAM, feath: true, coronet: CREAM });
  // saddle cloth (green: the faction colour), a caparison when upgraded
  const y0 = U ? 0.42 : 0.56, SZ = U ? 1.35 : 1.15;
  k.lathe([[0.222, y0], [0.214, 0.6], [0.2, 0.7], [0.16, 0.8], [0.06, 0.85]], [0, 0, -0.14], CLOTH, { s: [1, 1, SZ], seg: 14, grad: [0.85, 1.08] });
  // embroidered border: gold hem, a lime/gold band above it and a row of little leaves
  k.lathe([[0.23, y0 - 0.02], [0.226, y0 + 0.04]], [0, 0, -0.14], GOLD, { s: [1, 1, SZ], seg: 14, grad: [1, 1] });
  k.lathe([[0.224, y0 + 0.07], [0.222, y0 + 0.095]], [0, 0, -0.14], TRIM, { s: [1, 1, SZ], seg: 14, grad: [1, 1], ao: false });
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i - 2.5) * 0.42;
    k.sym(() => leafEmblem(k, [Math.sin(a) * 0.229, y0 + 0.045, -0.14 + Math.cos(a) * 0.229 * SZ], 0.32, i % 2 ? GOLD_L : TRIM, [0, a, 0]));
  }
  // tassels hanging from the hem
  for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + (i - 1) * 0.8; k.sym(() => k.cone(0.022, 0.075, [Math.sin(a) * 0.232, y0 - 0.015, -0.14 + Math.cos(a) * 0.232 * SZ], GOLD, { r: [Math.PI, 0, 0], seg: 4, ao: false })); }
  if (U) k.sym(() => { leafEmblem(k, [0.229, 0.56, -0.16], 1.3, GOLD, [0, Math.PI / 2, -0.1]); k.ball(0.022, [0.236, 0.565, -0.16], 0x7affb0, { glow: true, d: 0 }); });
  // girth strap with a buckle
  k.lathe([[0.226, 0.6], [0.222, 0.64]], [0, 0, 0.05], LEATHER, { s: [1, 1, 1.1], seg: 12, grad: [1, 1] });
  k.box(0.035, 0.05, 0.03, [0.222, 0.62, 0.05], GOLD_L, { ao: false });
  // javelin quiver on the right flank: three shafts with leaf heads, rim and straps
  k.at([0.21, 0.66, -0.26], [0.35, 0, -0.3], 1, () => {
    k.cyl(0.06, 0.066, 0.3, [0, -0.18, 0], U ? GOLD : LEATHER, { seg: 10, grad: [0.85, 1.08] });
    k.cyl(0.07, 0.07, 0.03, [0, 0.1, 0], U ? EMER : 0x8a4c22, { seg: 10, grad: [1, 1] });
    k.cyl(0.07, 0.07, 0.025, [0, -0.12, 0], U ? EMER : 0x8a4c22, { seg: 10, grad: [1, 1] });
    if (!U) leafEmblem(k, [0, -0.02, 0.064], 0.5, LIME);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.035, y = 0.1 + (i % 2) * 0.03;
      k.limb([x, 0.05, 0], [x, y, 0], 0.012, 0.012, WOOD, { seg: 5 });
      k.cone(0.03, 0.1, [x, y, 0], STEEL_L, { seg: 4 });
    }
  });
  });
  // human torso, head and arms: RIDER pivots where the torso meets the horse
  const S = 0.9, F = [0, 0.74 - 0.42 * S, 0.22];
  k.at(F, [0.1, 0, 0], S, () => k.bone(BONE.RIDER, HIPS, () => {
    figure(k, {
      robe: true, torso: U ? GOLD : LEAF, hips: COAT, upper: SKIN, fore: SKIN, hand: SKIN, belt: U ? EMER : LEATHER, head: false,
      rh: [0.26, 0.84, -0.04], lh: [-0.17, 0.64, 0.27], pauldron: U ? GOLD_L : null, pTrim: U ? EMER : null, armR: 0.068, foreR: 0.06, torsoGrad: [0.86, 1.12],
      torsoBand: U ? [1, 26, 0.08] : null, cuff: U ? GOLD_L : LEATHER, cuffTrim: U ? EMER : GOLD,
    });
    // waist sash where man meets horse, a belt buckle and a pouch
    k.lathe([[0.16, 0.37], [0.165, 0.42], [0.16, 0.45]], [0, 0, 0], U ? EMER : LEATHER, { s: [1, 1, 0.8], seg: 12, grad: [0.9, 1.08] });
    k.box(0.07, 0.06, 0.03, [0, 0.465, 0.13], GOLD_L, { ao: false });
    k.box(0.035, 0.03, 0.035, [0, 0.465, 0.138], U ? EMER : LEATHER, { ao: false });
    k.box(0.08, 0.08, 0.05, [-0.13, 0.42, 0.09], U ? GOLD : 0x8a4c22, { r: [0, -0.6, 0] });
    if (U) {
      // breastplate: centre ridge, a gorget, layered plates (banded) and a leaf sigil
      k.box(0.06, 0.24, 0.03, [0, 0.58, 0.155], EMER, { r: [-0.1, 0, 0] });
      k.lathe([[0.15, 0.7], [0.13, 0.735], [0.09, 0.755]], [0, 0, 0], GOLD_L, { s: [1, 1, 0.8], seg: 12, grad: [0.95, 1.1] });
      leafEmblem(k, [0, 0.6, 0.17], 0.7, GOLD_L, [-0.1, 0, 0]);
      k.ball(0.02, [0, 0.61, 0.18], 0x7affb0, { glow: true, d: 0 });
      cape(k, { y0: 0.4, y1: 0.7, r0: 0.25, r1: 0.19, col: CAPE_G, lin: GOLD, hem: GOLD, arc: 2.1 });
    } else {
      // laced jerkin: a darker placket with criss-cross laces, collar, baldric strap
      k.box(0.05, 0.22, 0.02, [0, 0.58, 0.152], LEAF_D, { r: [-0.1, 0, 0] });
      for (let i = 0; i < 3; i++) for (const sg of [1, -1]) k.box(0.06, 0.012, 0.014, [0, 0.52 + i * 0.06, 0.162 - i * 0.004], CREAM, { r: [-0.1, 0, sg * 0.6], ao: false });
      k.lathe([[0.15, 0.7], [0.12, 0.74], [0.07, 0.755]], [0, 0, 0], LEAF_L, { s: [1, 1, 0.8], seg: 12, grad: [0.95, 1.08] });
      k.box(0.2, 0.05, 0.03, [0, 0.62, 0.15], LEATHER, { r: [-0.1, 0, -0.5] }); // strap
      k.box(0.034, 0.034, 0.02, [0.05, 0.6, 0.165], GOLD_L, { r: [-0.1, 0, -0.5], ao: false });
    }
    // head (on the RIDER, so it stays on the torso): face, brown hair, braided pony-tail
    k.at([0, HY, 0], [0, 0, 0], 1.12, () => k.at([0, -HY, 0], [0, 0, 0], 1, () => {
    k.ell(HR, HR * 1.02, HR * 0.98, [0, HY, 0.01], SKIN, { grad: [0.95, 1.05] });
    face(k, { y: HY + 0.005, z: 0.128, x: 0.05, iris: 0x5a8a3a, brow: MANE, browT: 0.22, lid: 0xe8a888 });
    k.ell(0.026, 0.04, 0.03, [0, HY - 0.035, 0.14], 0xf0b088, { d: 0 }); // nose
    k.box(0.045, 0.01, 0.02, [0, HY - 0.08, 0.118], 0xb85a50, { ao: false, r: [-0.4, 0, 0] }); // mouth
    k.sym(() => k.ell(0.025, 0.04, 0.02, [0.13, HY - 0.01, 0.0], SKIN, { d: 0 })); // ears
    k.ell(0.148, 0.12, 0.14, [0, HY + 0.045, -0.03], MANE, { grad: [0.9, 1.1] });
    // hair locks over the brow and temples
    // braided pony-tail: alternating lobes with leather wraps
    for (let i = 0; i < 6; i++) {
      const t = i / 5, P = tup([0, HY - 0.0, -0.15], [0, HY - 0.27, -0.25], t);
      k.ell(0.045 - t * 0.012, 0.035, 0.04 - t * 0.01, P, i % 2 ? MANE_L : MANE, { d: 0, r: [0, 0, i % 2 ? 0.4 : -0.4] });
    }
    k.torus(0.04, 0.013, [0, HY - 0.06, -0.19], U ? GOLD : LEATHER, { r: [Math.PI / 2 + 0.6, 0, 0], seg: 8, ts: 3 });
    k.cone(0.03, 0.08, [0, HY - 0.28, -0.25], MANE_L, { r: [Math.PI, 0, 0], seg: 4 });
    if (U) {
      k.lathe([[0.152, HY + 0.02], [0.158, HY + 0.08], [0.13, HY + 0.15], [0.06, HY + 0.185], [0, HY + 0.19]], [0, 0, -0.01], GOLD, { seg: 14, grad: [0.85, 1.15] });
      k.lathe([[0.162, HY + 0.01], [0.162, HY + 0.05]], [0, 0, -0.01], EMER, { seg: 14, grad: [1, 1] });
      // rivets on the band, cheek guards and a nasal
      for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.42; k.stud(0.013, [Math.sin(a) * 0.165, HY + 0.03, -0.01 + Math.cos(a) * 0.165], GOLD_L); }
      k.sym(() => k.plate([[0, 0], [0.05, 0.01], [0.04, -0.1], [0.01, -0.12]], 0.02, [0.12, HY + 0.02, 0.06], GOLD, { r: [0, 0.75, 0] }));
      k.box(0.03, 0.08, 0.02, [0, HY + 0.02, 0.15], GOLD_L, {});
      plume(k, [0, HY + 0.17, -0.03], [LEAF_L, EMER, LEAF_L], 1.2);
    } else {
      k.torus(0.142, 0.026, [0, HY + 0.05, -0.005], LEAF_D, { r: [Math.PI / 2, 0, 0], seg: 14, ts: 4 });
      leafEmblem(k, [0, HY + 0.06, 0.142], 0.3, LIME, [-0.15, 0, 0]);
      k.feather([0.12, HY + 0.06, -0.06], [0.2, HY + 0.28, -0.18], 0.09, LEAF_L, { t: 0.02 });
      k.feather([0.11, HY + 0.05, -0.08], [0.15, HY + 0.24, -0.22], 0.07, SUN, { t: 0.02 });
    }
    }));
    // javelin held overhand, pointing forward (ARM_R: the attack is a thrust)
    k.bone(BONE.ARM_R, SH, () => {
      const A = [0.27, 0.74, -0.36], B = [0.25, 1.0, 0.58 + (U ? 0.06 : 0)];
      k.limb(A, B, 0.028, 0.024, U ? GOLD_L : WOOD, { seg: 8, grad: [0.88, 1.1] });
      // grip wrap (banded), butt cap
      k.limb(tup(A, B, 0.0), tup(A, B, 0.1), 0.034, 0.034, U ? EMER : LEATHER, { seg: 8, hs: 5, band: [1, 60, 0.18] });
      k.ball(0.04, A, U ? GOLD : STEEL_D, { d: 0 });
      const d = V3(B).sub(V3(A)).normalize();
      pole(k, B, V3(B).add(d).toArray(), (L) => {
        const HL = U ? 0.28 : 0.25;
        k.cyl(0.034, 0.028, 0.06, [0, -0.06, 0], U ? GOLD : STEEL_D, { seg: 8 }); // socket
        leafHead(k, [0, -0.02, 0], HL, 0.075, U ? GOLD_L : STEEL_L);
        k.limb([0, 0.0, 0], [0, HL * 0.85, 0], 0.012, 0.004, U ? GOLD : STEEL_D, { seg: 4 }); // rib
        // a tuft of green streamers tied below the head
        for (let i = 0; i < 3; i++) k.cone(0.016, 0.1, [0, -0.07, 0], i % 2 ? LEAF_L : CLOTH, { r: [Math.PI - 0.5, i * 2.1, 0.3], seg: 3 });
      });
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
// Round 7 detail: blue eyes under bushy brows, big nose, rosy cheeks, a sweeping
// moustache, beard locks and two ringed braids; riveted helm with a crest ridge;
// mail rings (banded), a wide belt with a square buckle and pouches, bracers,
// boot cuffs; axe with grip wraps, rivets, bright edge bevel (glowing runes when
// upgraded); planked shield with rivets around the rim.
function dwarf(U) {
  const SC = [1.22, 0.84, 1.15];
  const k = makeKit(U ? 113 : 111, [0, 0.42 * SC[1], 0]);
  const MAIL = U ? 0xc8d2e2 : 0xbcc6d6, TROUS = U ? 0x3f9a44 : 0x5aa83e, BRONZE = 0xdc9a42, METAL = U ? GOLD : BRONZE;
  const w = (p) => [p[0] * SC[0], p[1] * SC[1], p[2] * SC[2]];
  let H;
  k.at([0, 0, 0], [0, 0, 0], SC, () => {
    H = figure(k, {
      legs: TROUS, boots: LEATHER, torso: MAIL, hips: LEATHER, upper: MAIL, fore: SKIN, hand: SKIN, belt: LEATHER, head: false, stance: 0.1,
      rh: [0.25, 0.5, 0.18], lh: [-0.22, 0.42, 0.16], pauldron: U ? STEEL_L : null, pTrim: U ? GOLD : null, armR: 0.072, foreR: 0.066, handR: 0.068,
      torsoBand: [1, 34, 0.1], cuff: U ? STEEL_L : LEATHER, cuffTrim: METAL, bootCuff: 0x8a4c22, toe: U ? STEEL_L : 0x8a4c22,
    });
    // tunic skirt with a lighter embroidered hem band
    k.lathe([[0.2, 0.3], [0.175, 0.38], [0.158, 0.45]], [0, 0, 0], U ? EMER : LEAF_D, { s: [1, 1, 0.8], seg: 12, sub: 2, grad: [0.85, 1.05] });
    k.lathe([[0.205, 0.296], [0.198, 0.325]], [0, 0, 0], U ? GOLD : LIME, { s: [1, 1, 0.8], seg: 12, grad: [1, 1], ao: false });
    // mail hem below the tunic edge
    k.lathe([[0.168, 0.43], [0.172, 0.46]], [0, 0, 0], MAIL, { s: [1, 1, 0.8], seg: 12, grad: [1, 1] });
    // wide belt, square buckle, two pouches
    k.lathe([[0.165, 0.45], [0.168, 0.51]], [0, 0, 0], LEATHER, { s: [1, 1, 0.82], seg: 12, grad: [0.95, 1.05] });
    k.box(0.11, 0.085, 0.03, [0, 0.48, 0.138], METAL, { grad: [1, 1.1] });
    k.box(0.055, 0.035, 0.034, [0, 0.48, 0.14], LEATHER, { ao: false });
    k.box(0.012, 0.05, 0.04, [0.005, 0.48, 0.145], METAL, { ao: false });
    k.sym(() => {
      k.box(0.07, 0.08, 0.05, [0.13, 0.41, 0.08], 0x8a4c22, { r: [0, 0.7, 0] });
      k.box(0.075, 0.03, 0.055, [0.13, 0.445, 0.08], LEATHER, { r: [0, 0.7, 0] });
      k.stud(0.014, [0.152, 0.435, 0.105], METAL);
    });
    if (U) {
      // second pauldron lames, a gorget
      k.sym(() => k.ell(0.1, 0.06, 0.1, [0.22, 0.6, 0.0], STEEL_L, { d: 1, r: [0, 0, -0.55], grad: [0.85, 1.1] }));
      k.lathe([[0.16, 0.68], [0.13, 0.72], [0.08, 0.735]], [0, 0, 0], STEEL_L, { s: [1, 1, 0.82], seg: 12, grad: [0.9, 1.1] });
      cape(k, { y0: 0.2, y1: 0.7, r0: 0.27, r1: 0.21, col: CAPE_G, lin: GOLD, hem: GOLD, arc: 2.1 });
    }
  });
  const NK = [0, 0.6, 0];
  k.bone(BONE.HEAD, NK, () => {
    const hy = 0.72;
    k.ell(0.15, 0.15, 0.145, [0, hy, 0.02], SKIN, { grad: [0.95, 1.05] });
    face(k, { y: hy + 0.008, z: 0.15, x: 0.056, w: 0.028, h: 0.024, iris: 0x3a86e0, yaw: 0.3 });
    // bushy brows (beard colour), big rosy nose, cheeks
    k.sym(() => k.ell(0.055, 0.025, 0.035, [0.06, hy + 0.05, 0.155], BEARD_L, { r: [0, 0.3, 0.25], d: 0 }));
    k.ell(0.045, 0.05, 0.045, [0, hy - 0.02, 0.17], 0xf4a080, { d: 1 }); // nose
    k.sym(() => k.ell(0.035, 0.025, 0.02, [0.09, hy - 0.02, 0.135], 0xf89a8a, { d: 0, ao: false }));
    k.sym(() => k.ell(0.025, 0.04, 0.025, [0.148, hy, 0.02], SKIN, { d: 0 })); // ears
    // the beard: the dwarf's identity, big and bright, with locks
    k.ell(0.16, 0.13, 0.1, [0, hy - 0.1, 0.11], BEARD, { grad: [0.9, 1.08] });
    k.cone(0.13, 0.26, [0, hy - 0.12, 0.13], BEARD, { r: [Math.PI - 0.25, 0, 0], seg: 8, grad: [0.85, 1.05] });
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32; k.cone(0.04, 0.2 - Math.abs(i - 2) * 0.03, [Math.sin(a) * 0.1, hy - 0.11, 0.16 + Math.cos(a) * 0.02], i % 2 ? BEARD_L : BEARD, { r: [Math.PI - 0.32, 0, a * 0.5], seg: 4, grad: [0.85, 1.1] }); }
    // moustache sweeping out to curled tips
    k.sym(() => {
      k.limb([0.01, hy - 0.05, 0.19], [0.09, hy - 0.07, 0.17], 0.03, 0.026, BEARD_L, { seg: 6 });
      k.limb([0.09, hy - 0.07, 0.17], [0.14, hy - 0.03, 0.14], 0.026, 0.01, BEARD_L, { seg: 6 });
    });
    // two braids with metal rings
    k.sym(() => {
      for (let i = 0; i < 4; i++) k.ell(0.03, 0.03, 0.028, [0.075, hy - 0.2 - i * 0.05, 0.16 - i * 0.012], i % 2 ? BEARD_L : BEARD, { d: 0, r: [0, 0, i % 2 ? 0.5 : -0.5] });
      k.cyl(0.03, 0.03, 0.025, [0.075, hy - 0.37, 0.115], METAL, { seg: 8, ao: false });
    });
    if (U) for (const y of [0.42, 0.5]) k.torus(0.035, 0.016, [0, y, 0.2], GOLD, { r: [Math.PI / 2 - 0.25, 0, 0], seg: 8, ts: 3 });
    // helm: dome, riveted band, a crest ridge front to back, nose guard
    const hh = hy + 0.03, HC = U ? STEEL_L : STEEL;
    k.lathe([[0.158, hh + 0.03], [0.165, hh + 0.08], [0.145, hh + 0.15], [0.085, hh + 0.195], [0, hh + 0.205]], [0, 0, 0.005], HC, { seg: 14, grad: [0.82, 1.15] });
    k.lathe([[0.17, hh + 0.02], [0.17, hh + 0.065]], [0, 0, 0.005], METAL, { seg: 14, grad: [1, 1] });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.stud(0.015, [Math.sin(a) * 0.174, hh + 0.043, 0.005 + Math.cos(a) * 0.174], U ? GOLD_L : STEEL_L); }
    k.torus(0.15, 0.014, [0, hh + 0.06, 0.005], METAL, { r: [0, Math.PI / 2, 0], seg: 12, ts: 3, arc: Math.PI, s: [1, 0.95, 1] });
    k.box(0.036, 0.075, 0.03, [0, hh + 0.012, 0.172], METAL, {});
    if (U) {
      k.sym(() => {
        // horns with ridged bands
        k.limb([0.15, hh + 0.07, 0], [0.25, hh + 0.13, -0.02], 0.045, 0.034, IVORY, { seg: 6, hs: 3, band: [0, 40, 0.1] });
        k.limb([0.25, hh + 0.13, -0.02], [0.28, hh + 0.27, -0.06], 0.034, 0.008, IVORY, { seg: 5, hs: 3, band: [1, 40, 0.1] });
        k.cyl(0.05, 0.05, 0.03, [0.155, hh + 0.07, 0], GOLD, { r: [0, 0, -1.0], seg: 8 });
      });
      k.cone(0.03, 0.08, [0, hh + 0.19, 0.005], GOLD_L, { seg: 4 });
      // glowing rune gem on the brow
      k.ball(0.022, [0, hh + 0.085, 0.165], 0x7affb0, { glow: true, d: 0 });
    } else k.ball(0.035, [0, hh + 0.2, 0.005], BRONZE, { d: 1 });
  });
  // axe in the right hand (ARM_R): haft through the fist, broad blade outward
  const R = w(H.R);
  k.bone(BONE.ARM_R, w(SH), () => {
    const A = [R[0] + 0.01, 0.16, R[2] + 0.06], B = [R[0] + 0.06, 0.98, R[2] - 0.06];
    pole(k, A, B, (L) => {
      k.limb([0, 0, 0], [0, L, 0], 0.032, 0.03, WOOD, { seg: 8, grad: [0.88, 1.1] });
      // grip wrap and pommel
      k.limb([0, 0.02, 0], [0, 0.3, 0], 0.037, 0.037, LEATHER, { seg: 6, hs: 6, band: [1, 50, 0.2] });
      k.cyl(0.046, 0.04, 0.05, [0, -0.02, 0], METAL, { seg: 8 });
      k.cyl(0.044, 0.04, 0.16, [0, L - 0.2, 0], U ? GOLD : STEEL_D, { seg: 8 });
      for (const y of [L - 0.17, L - 0.08]) k.sym(() => k.stud(0.016, [0.0, y, 0.042], STEEL_L));
      const blade = [[0, -0.08], [0.08, -0.1], [0.2, -0.2], [0.25, -0.06], [0.26, 0.08], [0.22, 0.22], [0.08, 0.12], [0, 0.09]];
      // a bright bevel along the cutting edge
      const edge = [[0.2, -0.2], [0.25, -0.06], [0.26, 0.08], [0.22, 0.22], [0.19, 0.17], [0.215, 0.07], [0.205, -0.05], [0.17, -0.14]];
      const sides = U ? [1, -1] : [1];
      for (const sd of sides) k.at([0.02 * sd, L - 0.12, 0], [0, 0, 0], [sd * 1.05, 1.05, 1], () => {
        if (U) k.plate(blade.map(([x, y]) => [x * 1.12 - 0.005, y * 1.12]), 0.024, [0, 0, 0], GOLD, { grad: [1, 1.05] });
        k.plate(blade, 0.04, [0, 0, 0], STEEL, { grad: [0.86, 1.12] });
        k.plate(edge, 0.046, [0, 0, 0], 0xf8fbff, { grad: [1, 1.08], ao: false });
        // fuller / rune line
        if (U) k.plate([[0.07, -0.03], [0.15, -0.06], [0.16, 0.06], [0.08, 0.04]], 0.05, [0, 0, 0], 0x7affb0, { glow: true });
        else k.plate([[0.07, -0.02], [0.15, -0.04], [0.155, 0.05], [0.08, 0.03]], 0.044, [0, 0, 0], STEEL_D, { grad: [1, 1] });
      });
      if (U) k.cone(0.03, 0.12, [0, L - 0.02, 0], STEEL_L, { seg: 4 });
    });
  });
  const L = w(H.L);
  k.bone(BONE.ARM_L, w(SHL), () => roundShield(k, [L[0] - 0.05, L[1] + 0.07, L[2] + 0.08], [0.05, -0.4, 0], 0.21,
    U ? EMER : 0xc8884a, U ? GOLD : STEEL, U ? GOLD_L : STEEL_L, () => {
      if (U) {
        for (let i = 0; i < 4; i++) leafEmblem(k, [Math.sin(i * Math.PI / 2) * 0.12, Math.cos(i * Math.PI / 2) * 0.12, 0.02], 0.7, GOLD);
        k.torus(0.1, 0.01, [0, 0, 0.022], GOLD_L, { seg: 14, ts: 3 });
        k.ball(0.022, [0, 0, 0.075], 0x7affb0, { glow: true, d: 0 });
      } else {
        // planks with seams, iron bands
        for (const x of [-0.105, -0.035, 0.035, 0.105]) k.box(0.008, 0.36 * Math.sqrt(1 - (x / 0.21) ** 2) * 1.1, 0.05, [x, 0, 0], 0x9a6030, { grad: [1, 1] });
        for (const x of [-0.07, 0.07]) k.box(0.022, 0.38, 0.052, [x, 0, 0], STEEL_D, { grad: [1, 1] });
      }
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; k.stud(0.017, [Math.sin(a) * 0.185, Math.cos(a) * 0.185, 0.03], U ? GOLD_L : STEEL_L); }
    }));
  return k.done();
}

// a leaf-shaped plate along +y (length len, width wd), facing +z, with a raised midrib
function leafPlate(k, p, r, len, wd, col, rib = null, t = 0.014) {
  k.at(p, r, 1, () => {
    k.plate([[0, 0], [wd * 0.5, len * 0.28], [wd * 0.42, len * 0.66], [0, len], [-wd * 0.42, len * 0.66], [-wd * 0.5, len * 0.28]], t, [0, 0, 0], col, { grad: [0.88, 1.1] });
    if (rib) k.box(wd * 0.1, len * 0.8, t * 1.6, [0, len * 0.42, 0], rib, { grad: [1, 1], ao: false });
  });
}

// Wood elf (round 7: made clearly unlike the Haven archer). Hood thrown back so
// the long swept ears and a mane of pale-gold hair read at once; armour of
// overlapping jade leaves with lime midribs (leaf pauldrons, leaf tassets), an
// ivory under-tunic, fawn leggings in tall russet boots, a deep teal cloak with
// an autumn-leaf hem (amber / orange / russet), a vine circlet, and a slender
// ivory-gold recurve bow with leaf tips and a wrapped grip; green-fletched arrows.
// Grand elf: gold-veined leaves, gold leaf diadem with a glowing gem, gold
// cloak hem and pauldron rims, white-gold hair, gilded bow, TWO nocked arrows.
function woodelf(U) {
  const k = makeKit(U ? 157 : 151);
  const JADE = U ? 0x24b07a : 0x2cc08a, JADE_D = U ? 0x1a9466 : 0x1fa070, RIB = U ? GOLD_L : LIME;
  const CLOAK = U ? 0x2a9a8a : 0x2a9a7a, TUNIC = 0xf6efd2, LEGS = 0xe6c890, BOOT = 0xa8562c, HAIR = U ? 0xfff6d0 : 0xffe48a, HAIR_D = U ? 0xf0dca0 : 0xf0c460;
  const AUT = [0xffa030, 0xf06a2a, 0xffd040];
  const bowP = [-0.17, 0.6, 0.24], draw = [0.04, 0.64, 0.06];
  figure(k, {
    legs: LEGS, boots: BOOT, torso: JADE, hips: JADE_D, upper: TUNIC, fore: TUNIC, hand: SKIN, belt: U ? GOLD : 0x8a4c22,
    rh: draw, lh: bowP, stance: 0.1, head: false, torsoGrad: [0.86, 1.12], cuff: U ? GOLD : 0x8a4c22, cuffTrim: U ? GOLD_L : LIME,
    bootCuff: 0xc87038, toe: BOOT,
  });
  // tall boots: a leaf flap over each knee
  k.sym(() => k.bone(BONE.LEG_FR, [0.085, 0.42, 0], () => {
    k.limb([0.1, 0.09, 0.015], [0.1, 0.2, 0.02], 0.07, 0.072, BOOT, { seg: 8 });
    leafPlate(k, [0.1, 0.19, 0.075], [-0.25, 0, Math.PI], 0.1, 0.075, JADE, RIB);
  }));
  // ivory under-tunic skirt below a ring of leaf tassets
  k.lathe([[0.2, 0.28], [0.175, 0.36], [0.155, 0.45]], [0, 0, 0], TUNIC, { s: [1, 1, 0.8], seg: 12, grad: [0.88, 1.05] });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    leafPlate(k, [Math.sin(a) * 0.17, 0.46, Math.cos(a) * 0.136], [-0.32, a, Math.PI], 0.17, 0.1, i % 2 ? JADE_D : JADE, RIB);
  }
  // leaf-scale cuirass: two staggered rows of leaves pointing down
  for (const [y, r, off, n] of [[0.68, 0.2, 0, 8], [0.585, 0.198, 0.5, 8]]) for (let i = 0; i < n; i++) {
    const a = ((i + off) / n) * Math.PI * 2;
    leafPlate(k, [Math.sin(a) * r, y, Math.cos(a) * r * 0.78], [-0.22, a, Math.PI], 0.15, 0.11, (i + off * 2) % 2 ? JADE : 0x48cc6a, RIB);
  }
  // belt with a leaf clasp and a pouch
  k.box(0.07, 0.07, 0.03, [0, 0.47, 0.13], U ? GOLD_L : LIME, { r: [0, 0, Math.PI / 4] });
  k.box(0.07, 0.08, 0.045, [0.12, 0.42, 0.09], 0x8a4c22, { r: [0, 0.7, 0] });
  // leaf pauldrons: three big leaves fanning over each shoulder
  k.sym(() => k.bone(BONE.ARM_R, SH, () => {
    for (let j = 0; j < 3; j++) leafPlate(k, [0.2 + j * 0.012, 0.72 - j * 0.02, 0.05 - j * 0.05], [-0.15, 0.3 + j * 0.45, Math.PI - 1.0], 0.17 - j * 0.015, 0.12, j === 1 ? JADE_D : JADE, U ? GOLD : RIB, 0.018);
  }));
  // cloak (CLOTH): deep teal with an autumn-leaf hem
  cape(k, { y0: 0.18, y1: 0.7, r0: 0.27, r1: 0.2, col: CLOAK, lin: U ? GOLD : 0x1f7a62, hem: U ? GOLD : null, arc: 2.2 });
  k.bone(BONE.CLOTH, [0, 0.7, -0.18], () => {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i - 3) * 0.32;
      leafPlate(k, [Math.sin(a) * 0.275, 0.25, Math.cos(a) * 0.235], [0.1, a, Math.PI], 0.13, 0.09, AUT[i % 3], null, 0.016);
    }
  });
  // hood thrown back: a soft cowl around the neck lying on the cloak
  k.torus(0.13, 0.035, [0, 0.72, -0.01], CLOAK, { r: [Math.PI / 2 + 0.15, 0, 0], seg: 14, ts: 5, s: [1, 0.85, 1] });
  k.ell(0.13, 0.08, 0.05, [0, 0.66, -0.17], CLOAK, { r: [0.3, 0, 0], d: 1, grad: [0.85, 1.05] });
  k.ell(0.07, 0.045, 0.03, [0, 0.64, -0.21], 0x1f7a62, { r: [0.3, 0, 0], d: 0 });
  k.bone(BONE.HEAD, NECK, () => {
    const hy = HY + 0.005;
    k.ell(0.122, 0.135, 0.12, [0, hy, 0.02], SKIN, { grad: [0.95, 1.05] });
    k.ell(0.07, 0.05, 0.05, [0, hy - 0.09, 0.07], SKIN, { d: 1 }); // pointed chin
    face(k, { y: hy - 0.005, z: 0.122, x: 0.048, w: 0.032, h: 0.022, iris: U ? 0x18b0a0 : 0x2ab45a, slant: 0.22, yaw: 0.32, brow: HAIR_D, browT: 0.32, browW: 0.9 });
    k.ell(0.016, 0.032, 0.02, [0, hy - 0.045, 0.14], 0xf0b48c, { d: 0 }); // nose
    k.box(0.032, 0.007, 0.012, [0, hy - 0.082, 0.118], 0xd06a6a, { ao: false, r: [-0.4, 0, 0] }); // mouth
    // hair: crown, a parted fringe and long locks falling down the back and over the shoulders
    k.ell(0.135, 0.12, 0.135, [0, hy + 0.05, -0.01], HAIR, { grad: [0.9, 1.1] });
    k.sym(() => k.ell(0.075, 0.04, 0.06, [0.055, hy + 0.1, 0.08], HAIR, { r: [0.3, 0, -0.4], d: 1 }));
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i - 3) * 0.3, x = Math.sin(a) * 0.1, z = Math.cos(a) * 0.08 - 0.02;
      k.limb([x, hy + 0.02, z], [x * 1.4, hy - 0.3 + Math.abs(i - 3) * 0.04, z - 0.07], 0.05, 0.025, i % 2 ? HAIR_D : HAIR, { seg: 6 });
    }
    k.sym(() => k.limb([0.1, hy, 0.05], [0.13, hy - 0.22, 0.08], 0.035, 0.018, HAIR_D, { seg: 6 }));
    // long ears swept up and back: the elf's identity
    k.sym(() => {
      k.cone(0.042, 0.24, [0.11, hy - 0.0, 0.0], SKIN, { r: [-0.5, 0, -1.05], seg: 6 });
      k.cone(0.022, 0.16, [0.118, hy + 0.005, 0.008], 0xf4a090, { r: [-0.5, 0, -1.05], seg: 4, grad: [1, 1] });
    });
    if (U) {
      // gold leaf diadem with a glowing gem
      k.torus(0.135, 0.016, [0, hy + 0.055, 0.01], GOLD, { r: [Math.PI / 2 - 0.25, 0, 0], seg: 14, ts: 4 });
      for (let i = -2; i <= 2; i++) leafPlate(k, [Math.sin(i * 0.35) * 0.13, hy + 0.08, 0.01 + Math.cos(i * 0.35) * 0.13], [0.3, i * 0.35, -i * 0.15], 0.09 - Math.abs(i) * 0.012, 0.05, GOLD_L, null, 0.012);
      k.ball(0.026, [0, hy + 0.1, 0.15], 0x7affb0, { glow: true, d: 0 });
    } else {
      // vine circlet with three leaves
      k.torus(0.135, 0.012, [0, hy + 0.055, 0.01], LEAF_D, { r: [Math.PI / 2 - 0.25, 0, 0], seg: 14, ts: 3 });
      for (const i of [-1, 0, 1]) leafPlate(k, [Math.sin(i * 0.5) * 0.135, hy + 0.07, 0.01 + Math.cos(i * 0.5) * 0.135], [0.4, i * 0.5, -i * 0.5], 0.07, 0.045, i ? LEAF : LIME, null, 0.012);
    }
  });
  // quiver on the back, over the cloak: green-fletched arrows
  k.at([0.12, 0.6, -0.22], [0.35, 0, -0.4], 1, () => {
    k.cyl(0.06, 0.066, 0.34, [0, -0.2, 0], U ? GOLD : 0x8a4c22, { seg: 8, grad: [0.85, 1.08] });
    k.cyl(0.068, 0.068, 0.03, [0, 0.11, 0], U ? GOLD_L : JADE, { seg: 8, grad: [1, 1] });
    for (let i = 0; i < 3; i++) k.feather([(i - 1) * 0.03, 0.1, (i % 2) * 0.02], [(i - 1) * 0.04, 0.26, (i % 2) * 0.02], 0.06, i === 1 ? WHITE : LEAF_L, { t: 0.016 });
  });
  // slender recurve bow (ARM_L) and nocked arrow(s) (ARM_R)
  const bowH = U ? 0.53 : 0.5, bend = 0.12, pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 4 - 1; pts.push([bowP[0], bowP[1] + t * bowH, bowP[2] + 0.02 - t * t * bend + Math.pow(Math.abs(t), 5) * 0.1]); }
  const R = [draw[0], draw[1], draw[2] - 0.02];
  k.bone(BONE.ARM_L, SHL, () => {
    for (let i = 0; i < 8; i++) {
      const r = 0.03 - Math.abs(i - 3.5) * 0.0024, c = i === 3 || i === 4 ? JADE_D : (U ? GOLD : 0xf4e0b0);
      k.limb(pts[i], pts[i + 1], r, r, c, { seg: 6, hs: i === 3 || i === 4 ? 3 : 1, band: i === 3 || i === 4 ? [1, 50, 0.18] : null });
    }
    // leaf tips curling forward, a little leaf on each limb
    for (const p of [pts[0], pts[8]]) leafPlate(k, p, [p === pts[0] ? Math.PI - 0.6 : -0.6, Math.PI / 2, 0], 0.1, 0.06, U ? GOLD_L : LEAF, null, 0.014);
    for (const j of [2, 6]) leafPlate(k, pts[j], [0, Math.PI / 2, j === 2 ? Math.PI - 0.5 : 0.5], 0.07, 0.045, U ? GOLD : LEAF_L, null, 0.012);
    k.limb(pts[8], R, 0.008, 0.008, CREAM, { seg: 3 });
    k.limb(pts[0], R, 0.008, 0.008, CREAM, { seg: 3 });
  });
  k.bone(BONE.ARM_R, SH, () => {
    for (const dy of U ? [0.03, -0.035] : [0]) {
      const r0 = [R[0], R[1] + dy, R[2]], tipA = [bowP[0] + 0.01, bowP[1] + 0.02 + dy * 1.6, bowP[2] + 0.22];
      k.limb(r0, tipA, 0.013, 0.013, CREAM, { seg: 4 });
      const dA = V3(tipA).sub(V3(r0)).normalize();
      k.stick(new THREE.ConeGeometry(0.032, 0.1, 4).translate(0, 0.05, 0), tipA, V3(tipA).add(dA).toArray(), U ? GOLD_L : STEEL_L, {});
      // fletching at the nock
      k.feather(V3(r0).add(dA.clone().multiplyScalar(0.01)).toArray(), V3(r0).add(dA.clone().multiplyScalar(0.11)).toArray(), 0.05, U ? GOLD_L : LEAF_L, { t: 0.012, roll: 0.8 });
    }
  });
  return k.done();
}

// Pegasus: white horse with big feathered V wings (sky-blue tips), sky mane.
// Silver pegasus: silver-blue coat, silver chanfron and breast collar with a
// gold star, bigger wings with royal-blue tips, silver-white mane.
// Round 7 detail: layered covert / secondary feather rows and barred primaries,
// sculpted horse body, eyes with a sparkle, nostrils, pale-inner ears, tufted
// tail; base: a sky ribbon braided in the mane with a little bell; silver: riveted
// chanfron with a crest ridge and a gem, a bridle, plated breast collar.
function pegasus(U) {
  const k = makeKit(U ? 167 : 163, [0, 0.64, -0.03]);
  const C = U ? 0xdfe8f8 : 0xfbf8f4, CD = U ? 0xc6d4ec : 0xe8e4e0;
  horse(k, {
    coat: C, coatD: CD, coatL: U ? 0xf4f8ff : 0xffffff, hoof: U ? SILVER_D : 0xc8a47a, coronet: U ? GOLD : SKY, eye: U ? 0x2c50d8 : 0x2a6ad0,
    mane: U ? [0xf6fbff, 0xb4dcff] : [SKY, 0xb0e0ff], tail: U ? [0xf6fbff, 0xb4dcff, 0xf6fbff] : [SKY, 0xb0e0ff, SKY],
    headFx: U ? () => {
      // chanfron: a shaped plate down the face with a ridge, rivets and a gem
      k.ell(0.066, 0.044, 0.17, [0, 0.062, 0.1], SILVER, { grad: [0.85, 1.12] });
      k.box(0.014, 0.02, 0.28, [0, 0.1, 0.1], GOLD, { r: [0.04, 0, 0] });
      for (const z of [0.0, 0.1, 0.2]) k.sym(() => k.stud(0.012, [0.05, 0.085, z], GOLD_L));
      k.cone(0.04, 0.09, [0, 0.07, -0.02], GOLD, { r: [-0.6, 0, 0], seg: 5 });
      k.ball(0.02, [0, 0.105, 0.05], 0xbfe4ff, { glow: true, d: 0 });
      // bridle: noseband and cheek straps
      k.torus(0.082, 0.012, [0, -0.02, 0.22], GOLD, { seg: 12, ts: 3, s: [1, 1.05, 1] });
    } : () => {
      // a sky ribbon tied in the forelock
      k.torus(0.03, 0.012, [0, 0.08, 0.0], SKY_D, { seg: 8, ts: 3, r: [0.5, 0, 0] });
    },
    neckFx: U ? null : () => {
      // braided ribbon with a little gold bell at the throat
      k.torus(0.112, 0.018, [0, 0.86, 0.375], SKY_D, { r: [-0.98, 0, 0], seg: 14, ts: 3 });
      k.ball(0.03, [0, 0.82, 0.48], GOLD, { d: 1 });
    },
  });
  if (U) {
    // plated breast collar with a gold star medallion
    k.torus(0.17, 0.035, [0, 0.72, 0.3], SILVER, { r: [Math.PI / 2 - 0.6, 0, 0], seg: 16, ts: 4 });
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.38; k.stud(0.016, [Math.sin(a) * 0.19, 0.72 - Math.cos(a) * 0.05 + 0.06 * (1 - Math.cos(a)), 0.3 + Math.cos(a) * 0.13], GOLD_L); }
    k.at([0, 0.62, 0.43], [0.4, 0, 0], 1.1, () => { k.ball(0.04, [0, 0, 0.015], 0xbfe4ff, { glow: true, d: 0 }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; k.cone(0.03, 0.06, [Math.sin(a) * 0.04, Math.cos(a) * 0.04, 0], GOLD, { r: [0, 0, -a], seg: 3 }); } });
    // a light silver saddle pad between the wings
    k.lathe([[0.205, 0.66], [0.19, 0.74], [0.14, 0.81], [0.05, 0.84]], [0, 0, -0.08], ROYAL, { s: [1, 1, 0.9], seg: 12, grad: [0.9, 1.08] });
    k.lathe([[0.21, 0.645], [0.207, 0.675]], [0, 0, -0.08], GOLD, { s: [1, 1, 0.9], seg: 12, grad: [1, 1] });
  } else k.torus(0.16, 0.026, [0, 0.72, 0.3], SKY_D, { r: [Math.PI / 2 - 0.6, 0, 0], seg: 14, ts: 4 });
  k.sym(() => k.bone(BONE.WING_R, [0.12, 0.8, 0.08], () => wing(k, [0.12, 0.8, 0.08], {
    W: [0.3, 0.22, -0.05], T: U ? [0.76, 0.46, -0.28] : [0.7, 0.42, -0.26], len: U ? 0.58 : 0.52, drop: [0.3, -0.75, -0.6], dropIn: [0.15, -1, -0.3],
    n: 8, col: U ? 0xe8f0ff : WHITE, tip: U ? ROYAL : SKY, cov: WHITE, bone: U ? SILVER : CREAM, prim: U ? 4 : 3, bar: true,
  })));
  return k.done();
}

// Dendroid: a walking oak. Bark trunk with a glowing-eyed face, two root legs
// with splayed root toes, branch arms with club hands and leafy twigs, a big
// leafy crown. Dendroid soldier: pink blossoms in the crown, thorny arms,
// bark shoulder plates, amber eyes, gold-leaf belt.
// Round 7 detail: mottled bark with deep grooves and knot holes, a climbing vine
// with leaves, moss patches and shelf fungus, heavy bark brows over deep sockets
// with bright pupils, a jagged mouth with wooden teeth and a hanging moss beard,
// twig fingers, rootlets, leaves breaking the crown outline; soldier: layered
// bark pauldrons, gold-leaf belt with a buckle, five-petal blossoms.
function dendroid(U) {
  const k = makeKit(U ? 179 : 173, [0, 0.42, 0]);
  const BK = U ? 0xa06e3c : BARK, EYE = U ? 0xffc040 : 0xd8ff5a, FUN = 0xffd890;
  // root legs (LEG_FR / LEG_FL) with toe roots and rootlets
  k.sym(() => k.bone(BONE.LEG_FR, [0.11, 0.4, 0], () => {
    k.limb([0.11, 0.44, 0], [0.15, 0.08, 0.03], 0.11, 0.09, BARK_D, { seg: 8, hs: 3, mottle: 0.08 });
    for (const [yaw, len] of [[-0.7, 0.2], [0, 0.24], [0.7, 0.2], [Math.PI, 0.14]]) {
      k.cone(0.05, len, [0.15, 0.06, 0.03], BARK_D, { r: [1.72, yaw, 0], seg: 5 });
      k.cone(0.02, len * 0.6, [0.15 + Math.sin(yaw) * len * 0.5, 0.03, 0.03 + Math.cos(yaw) * len * 0.5], BARK, { r: [1.9, yaw + 0.6, 0], seg: 3 });
    }
    k.ell(0.06, 0.03, 0.05, [0.13, 0.3, 0.1], MOSS, { d: 0 });
  }));
  // trunk with bold grooves, mottled bark
  k.lathe([[0.2, 0.28], [0.245, 0.4], [0.225, 0.55], [0.215, 0.7], [0.24, 0.86], [0.27, 0.96], [0.18, 1.04], [0.05, 1.06]], [0, 0, 0], BK, { s: [1, 1, 0.84], seg: 12, sub: 2, grad: [0.8, 1.1], mottle: 0.07 });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.3; if (Math.abs(Math.sin(a)) < 0.4 && Math.cos(a) > 0) continue;
    const h = 0.42 + (i % 3) * 0.06;
    k.box(0.055, h, 0.05, [Math.sin(a) * 0.225, 0.62 + (i % 2) * 0.05, Math.cos(a) * 0.19], i % 2 ? BARK_D : 0x9a663a, { r: [0, a, (i % 3 - 1) * 0.06], mottle: 0.06 });
  }
  // knot holes and shelf fungus
  for (const [x, y, z, r] of [[-0.19, 0.5, 0.12, 0.04], [0.16, 0.38, -0.15, 0.035], [-0.1, 0.8, -0.19, 0.04]]) {
    k.ell(r * 1.3, r * 1.5, r * 0.6, [x, y, z], BARK_L, { d: 1, r: [0, Math.atan2(x, z), 0] });
    k.ell(r * 0.8, r, r * 0.5, [x * 1.04, y, z * 1.04], KNOT, { d: 0, r: [0, Math.atan2(x, z), 0], ao: false, grad: [1, 1] });
  }
  for (const [y, s2] of [[0.46, 1], [0.54, 0.8]]) k.cyl(0.07 * s2, 0.06 * s2, 0.025, [-0.2, y, -0.06], FUN, { seg: 8, phi: 0, r: [0, 0, 0.1], grad: [0.95, 1.1] });
  // moss patches
  for (const [x, y, z] of [[0.15, 0.32, 0.13], [-0.2, 0.68, -0.05], [0.12, 0.6, -0.17]]) k.ell(0.07, 0.05, 0.05, [x, y, z], MOSS, { d: 1, r: [0, Math.atan2(x, z), 0] });
  // a climbing vine with leaves
  {
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, a = t * Math.PI * 2.2 + 2.2; pts.push(new THREE.Vector3(Math.sin(a) * 0.235, 0.3 + t * 0.6, Math.cos(a) * 0.2)); }
    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.014, 4, false), LEAF_D, { grad: [0.95, 1.05] });
    for (let i = 2; i < 16; i += 3) { const P = pts[i], a = Math.atan2(P.x, P.z); leafPlate(k, P.toArray(), [-0.4, a, (i % 2 ? 1 : -1) * 0.9], 0.08, 0.05, i % 2 ? LEAF : LEAF_L, null, 0.012); }
  }
  if (U) {
    // gold-leaf belt with a buckle
    k.lathe([[0.25, 0.42], [0.252, 0.48]], [0, 0, 0], GOLD, { s: [1, 1, 0.86], seg: 12, grad: [1, 1] });
    for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.45; leafEmblem(k, [Math.sin(a) * 0.255, 0.45, Math.cos(a) * 0.22], 0.35, i % 2 ? GOLD_L : LEAF_L, [0, a, Math.PI / 2]); }
    k.box(0.07, 0.07, 0.03, [0, 0.45, 0.225], GOLD_L, { r: [0, 0, Math.PI / 4] });
    k.ball(0.022, [0, 0.45, 0.24], 0xffc040, { glow: true, d: 0 });
  }
  // the face: heavy brows, deep sockets with glowing eyes and bright pupils, a knotted nose,
  // a jagged mouth with wooden teeth and a hanging moss beard
  k.sym(() => k.box(0.15, 0.06, 0.09, [0.07, 0.835, 0.17], BARK_L, { r: [0.25, -0.2, -0.22], mottle: 0.05 }));
  k.sym(() => {
    k.ell(0.058, 0.045, 0.03, [0.075, 0.775, 0.175], KNOT, { d: 1, grad: [1, 1], ao: false });
    k.ball(0.033, [0.075, 0.775, 0.192], EYE, { glow: true, d: 1 });
    k.ball(0.014, [0.075, 0.775, 0.222], 0xffffe0, { glow: true, d: 0 });
  });
  k.cone(0.045, 0.1, [0, 0.72, 0.18], BARK_L, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 5 });
  k.ell(0.1, 0.04, 0.035, [0, 0.64, 0.18], KNOT, { d: 1, grad: [1, 1], ao: false });
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.04;
    k.cone(0.014, 0.035, [x, 0.67, 0.2], 0xf0d8a0, { r: [Math.PI, 0, 0], seg: 3, ao: false });
    if (i < 3) k.cone(0.013, 0.03, [x + 0.02, 0.612, 0.2], 0xf0d8a0, { seg: 3, ao: false });
  }
  for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.04; k.cone(0.026, 0.12 + (i % 2) * 0.05, [x, 0.6, 0.18 - Math.abs(x) * 0.3], i % 2 ? MOSS : 0x7ab83e, { r: [Math.PI + 0.15, 0, x * 1.5], seg: 4 }); }
  // moss on the shoulders (bark pauldrons on the soldier)
  k.sym(() => {
    if (U) for (let j = 0; j < 2; j++) k.ell(0.13 - j * 0.015, 0.05, 0.14 - j * 0.015, [0.18 + j * 0.02, 0.97 - j * 0.05, 0], j % 2 ? BARK_L : 0xc08a50, { r: [0, 0, -0.45 - j * 0.12], d: 1, mottle: 0.06 });
    else k.ell(0.12, 0.06, 0.13, [0.17, 0.95, 0.0], MOSS, { r: [0, 0, -0.4] });
  });
  // branch arms (ARM_R / ARM_L) with club hands, twig fingers and a leafy twig
  k.sym(() => k.bone(BONE.ARM_R, [0.21, 0.88, 0], () => {
    const S0 = [0.2, 0.88, 0], E = [0.38, 0.68, 0.06], Hn = [0.44, 0.44, 0.14];
    k.limb(S0, E, 0.085, 0.066, BK, { seg: 7, hs: 2, mottle: 0.08 });
    k.ball(0.07, E, BK, { d: 1, mottle: 0.06 });
    k.limb(E, Hn, 0.066, 0.06, BK, { seg: 7, hs: 2, mottle: 0.08 });
    k.ell(0.1, 0.11, 0.1, Hn, BARK_L, { grad: [0.85, 1.1], mottle: 0.06 });
    for (const [yaw, dz] of [[-0.5, 0], [0.3, 0.04], [1.1, 0]]) {
      k.cone(0.034, 0.16, [Hn[0], Hn[1] - 0.06, Hn[2] + dz], BARK_D, { r: [Math.PI - 0.5, yaw, 0], seg: 5 });
    }
    k.cone(0.03, 0.12, [Hn[0] - 0.04, Hn[1] + 0.02, Hn[2] + 0.06], BARK_D, { r: [1.6, 0.3, 0.5], seg: 4 }); // thumb twig
    k.limb([0.31, 0.77, 0.03], [0.42, 0.97, -0.04], 0.034, 0.016, BK, { seg: 5 });
    k.ball(0.095, [0.43, 0.99, -0.04], LEAF, { top: [LEAF_L, 0.4] });
    for (let j = 0; j < 4; j++) { const a = j * 1.6; leafPlate(k, [0.43 + Math.sin(a) * 0.08, 0.99 + Math.cos(a) * 0.05, -0.04 + Math.cos(a) * 0.05], [0.3, a, -1.2 + j * 0.6], 0.09, 0.06, j % 2 ? LEAF_L : LEAF_D, null, 0.012); }
    if (U) for (const t of [0.2, 0.42, 0.65, 0.85]) { const p = tup(S0, Hn, t); k.cone(0.026, 0.1, p, 0xe8c080, { r: [0, 0, -1.3 - t], seg: 4 }); }
  }));
  // leafy crown (HEAD: rustles / looks around), branches poking through, loose leaves
  k.bone(BONE.HEAD, [0, 1.0, 0], () => {
    k.sym(() => k.limb([0.04, 0.98, 0], [0.22, 1.3, -0.06], 0.05, 0.03, BK, { seg: 6 }));
    const blobs = [[0, 1.22, -0.07, 0.3, LEAF], [0.25, 1.1, -0.05, 0.18, LEAF_D], [-0.25, 1.12, -0.06, 0.19, LEAF], [0.11, 1.4, -0.08, 0.18, LEAF], [-0.13, 1.36, 0.02, 0.16, LEAF_D], [0, 1.15, -0.3, 0.19, LEAF_D], [0.2, 1.28, -0.22, 0.15, LEAF]];
    for (const [x, y, z, r, c] of blobs) k.ell(r * 1.08, r * 0.9, r, [x, y, z], c, { top: [LEAF_L, 0.35], grad: [0.82, 1.1], d: r > 0.2 ? 2 : 1, mottle: 0.05 });
    // individual leaves breaking the outline of the crown
    const rnd = (i) => hash3(i * 1.7, 3.1, 0.7);
    for (let i = 0; i < 16; i++) {
      const [x, y, z, r] = blobs[i % blobs.length], a = rnd(i) * Math.PI * 2, e = (rnd(i + 9) - 0.3) * 1.4;
      const P = [x + Math.sin(a) * Math.cos(e) * r * 1.1, y + Math.sin(e) * r * 0.95, z + Math.cos(a) * Math.cos(e) * r * 1.08];
      leafPlate(k, P, [-0.6 + e, a, rnd(i + 4) * 2 - 1], 0.11, 0.07, i % 3 ? LEAF_L : LEAF, null, 0.014);
    }
    if (U) {
      // five-petal blossoms with sun-yellow hearts
      const bl = [[0.02, 1.5, 0.0], [0.24, 1.3, 0.05], [-0.24, 1.3, 0.04], [0.12, 1.3, 0.18], [-0.12, 1.28, 0.16], [0.3, 1.18, -0.14], [-0.33, 1.18, -0.06], [0.0, 1.38, -0.25], [-0.1, 1.48, -0.1]];
      bl.forEach((p, i) => {
        const dv = V3(p).sub(V3([0, 1.22, -0.07])).normalize(), a = Math.atan2(dv.x, dv.z), c = i % 3 ? PINK : WHITE;
        k.at(V3(p).add(dv.clone().multiplyScalar(0.07)).toArray(), [-Math.asin(dv.y), a, 0], 1.4, () => {
          for (let j = 0; j < 5; j++) { const b = j / 5 * Math.PI * 2; k.stud(1, [Math.sin(b) * 0.03, Math.cos(b) * 0.03, 0], c, { r: [0, 0, -b], s: [0.024, 0.034, 0.012] }); }
          k.stud(0.018, [0, 0, 0.012], SUN);
        });
      });
    }
  });
  return k.done();
}

// Unicorn: white horse, long golden spiral horn, rainbow mane and tail.
// War unicorn: gold chanfron, white caparison with a violet band and gold hem,
// gold hooves, a longer glowing horn.
// Round 7 detail: ridged spiral horn with a gold base ring, lashed violet eyes,
// a goat beard, feathered fetlocks, layered rainbow mane and tufted tail; war
// unicorn: riveted chanfron with a gem, a violet noseband, a violet saddle, star-embroidered caparison with tassels.
function unicorn(U) {
  const k = makeKit(U ? 191 : 181, [0, 0.64, -0.03]);
  const RB = [PINK, ORANGE, SUN, MINT, SKY, VIOLET];
  horse(k, {
    coat: WHITE, coatD: 0xeee8f4, coatL: 0xffffff, hoof: U ? GOLD : 0xd8b07a, coronet: U ? GOLD_L : 0xffe0f0, mane: RB, tail: [PINK, SUN, MINT, SKY, VIOLET],
    feath: true, sock: 0xfff6fa, eye: 0x7a4ad0, lash: 0x6a4aa0, earIn: 0xffb4d8,
    headFx: () => {
      const L = U ? 0.4 : 0.34;
      k.at([0, 0.07, 0.06], [-0.55, 0, 0], 1, () => {
        k.cone(0.045, L, [0, 0, 0], GOLD_L, { seg: 8, grad: [0.9, 1.15], band: [1, 30, 0.08] });
        const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, a = t * Math.PI * 2 * 3.5, r = 0.046 * (1 - t) + 0.003; pts.push(new THREE.Vector3(Math.cos(a) * r, t * L * 0.92, Math.sin(a) * r)); }
        k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.012, 4, false), GOLD, { grad: [0.95, 1.05] });
        k.torus(0.05, 0.014, [0, 0.01, 0], U ? GOLD : 0xffe0f0, { r: [Math.PI / 2, 0, 0], seg: 10, ts: 3 });
        k.ball(U ? 0.05 : 0.035, [0, L, 0], 0xfff4b0, { glow: true, d: 1 });
        if (U) k.cone(0.03, 0.2, [0, L * 0.6, 0], 0xfff8d0, { glow: true, seg: 4 });
      });
      // goat beard under the chin
      k.cone(0.03, 0.11, [0, -0.08, 0.2], 0xfff6fa, { r: [Math.PI + 0.5, 0, 0], seg: 5 });
      if (U) {
        k.ell(0.066, 0.044, 0.17, [0, 0.062, 0.12], GOLD, { grad: [0.85, 1.12] });
        for (const z of [0.03, 0.13, 0.22]) k.sym(() => k.stud(0.012, [0.05, 0.085, z], GOLD_L));
        k.ball(0.022, [0, 0.105, 0.17], 0xe0a0ff, { glow: true, d: 0 });
        k.torus(0.082, 0.012, [0, -0.02, 0.22], VIOLET, { seg: 12, ts: 3 });
      }
    },
  });
  if (U) {
    k.lathe([[0.226, 0.4], [0.216, 0.5], [0.2, 0.66], [0.16, 0.78], [0.06, 0.84]], [0, 0, -0.04], WHITE, { s: [1, 1, 2.0], seg: 14, grad: [0.86, 1.06] });
    k.lathe([[0.232, 0.44], [0.228, 0.5]], [0, 0, -0.04], VIOLET, { s: [1, 1, 2.0], seg: 14, grad: [1, 1] });
    k.lathe([[0.236, 0.38], [0.232, 0.43]], [0, 0, -0.04], GOLD, { s: [1, 1, 2.0], seg: 14, grad: [1, 1] });
    // embroidered stars along the violet band, tassels on the hem
    for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + (i - 2) * 0.5; k.sym(() => k.at([Math.sin(a) * 0.236, 0.47, -0.04 + Math.cos(a) * 0.236 * 2.0], [0, a, 0], 1, () => { for (let j = 0; j < 4; j++) k.cone(0.012, 0.03, [0, 0, 0.004], GOLD_L, { r: [0, 0, j * Math.PI / 2], seg: 3, ao: false }); })); }
    for (let i = 0; i < 4; i++) { const a = Math.PI / 2 + (i - 1.5) * 0.55; k.sym(() => k.cone(0.02, 0.07, [Math.sin(a) * 0.238, 0.385, -0.04 + Math.cos(a) * 0.238 * 2.0], GOLD, { r: [Math.PI, 0, 0], seg: 4, ao: false })); }
    k.sym(() => sunBadge(k, [0.2, 0.62, -0.1], [0, Math.PI / 2, 0], 1.6, 0xe0a0ff));
    // violet saddle with a gold cantle
    k.lathe([[0.2, 0.8], [0.15, 0.85], [0.05, 0.87], [0, 0.872]], [0, 0, -0.06], VIOLET, { s: [1, 1, 1.3], seg: 12, grad: [0.9, 1.1] });
    k.torus(0.17, 0.035, [0, 0.72, 0.3], GOLD, { r: [Math.PI / 2 - 0.6, 0, 0], seg: 14, ts: 4 });
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.45; k.stud(0.016, [Math.sin(a) * 0.19, 0.72 + 0.06 * (1 - Math.cos(a)) - Math.cos(a) * 0.05, 0.3 + Math.cos(a) * 0.13], VIOLET); }
  }
  return k.done();
}

// a dragon's membrane wing on the +x side: arm root -> elbow -> wrist, three
// fingers with claws, a scalloped two-layer membrane back to the flank, raised
// veins across the membrane and a darker trailing-edge band (banded per facet)
function dragonWing(k, o) {
  const { root, elbow, wrist, tips, back, bone, mem, mem2, th = 0.014 } = o;
  k.limb(root, elbow, 0.07, 0.055, bone, { seg: 7 });
  k.ball(0.06, elbow, bone, { d: 1 });
  k.limb(elbow, wrist, 0.055, 0.045, bone, { seg: 7 });
  k.ball(0.052, wrist, bone, { d: 1 });
  k.cone(0.04, 0.14, wrist, o.claw ?? IVORY, { r: [0, 0, -0.2], seg: 5 });
  for (const t of tips) {
    k.limb(wrist, t, 0.036, 0.014, bone, { seg: 6 });
    const d = V3(t).sub(V3(wrist)).normalize();
    k.stick(new THREE.ConeGeometry(0.018, 0.06, 4).translate(0, 0.03, 0), t, V3(t).add(d).toArray(), o.claw ?? IVORY, {});
  }
  const W = V3(wrist), anchors = [...tips, back];
  const P1 = [], P2 = [], PE = [], B1 = [], B2 = [], BE = [];
  const bk = new Map([[P1, B1], [P2, B2], [PE, BE]]);
  const tri = (P, a, b, c) => {
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize().multiplyScalar(th);
    P.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    bk.get(P).push(...a.clone().add(n).toArray(), ...c.clone().add(n).toArray(), ...b.clone().add(n).toArray());
  };
  // each panel: inner part (lighter) and an outer rim strip (edge colour) toward the scallop
  const panel = (P, A, B, C, f = 0.8) => {
    const B2 = A.clone().lerp(B, f), C2 = A.clone().lerp(C, f);
    tri(P, A, B2, C2); tri(PE, B2, B, C); tri(PE, B2, C, C2);
  };
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = V3(anchors[i]), b = V3(anchors[i + 1]);
    const m = a.clone().lerp(b, 0.5).lerp(W, i === anchors.length - 2 ? 0.08 : 0.2);
    const P = i < 1 ? P2 : P1;
    panel(P, W, a, m); panel(P, W, m, b);
  }
  tri(P1, W, V3(back), V3(elbow)); tri(P1, V3(elbow), V3(back), V3(root));
  for (const [P, c] of [[P1, mem], [P2, mem2 ?? mem], [PE, o.edge ?? mem2 ?? mem]]) for (const Q of [P, bk.get(P)]) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Q, 3));
    k.add(g, c, { grad: [0.9, 1.08], noise: 0.02, under: 0.9 });
  }
  // veins: thin ribs from the fingers' bases fanning into the membrane
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = V3(anchors[i]), b = V3(anchors[i + 1]), m = a.clone().lerp(b, 0.5).lerp(W, 0.25);
    k.limb(W.clone().lerp(m, 0.15).toArray(), m.toArray(), 0.012, 0.005, o.vein ?? bone, { seg: 4 });
  }
  k.limb(V3(elbow).lerp(V3(back), 0.1).toArray(), V3(elbow).lerp(V3(back), 0.75).toArray(), 0.012, 0.005, o.vein ?? bone, { seg: 4 });
}

// Green dragon: bright green with a yellow belly, yellow spines and fins, ivory
// horns, huge yellow-green membrane wings, glowing eyes and a hint of fire.
// Gold dragon: gold all over, cream belly, orange-gold membranes, a crown of
// horns, red-glowing eyes, bigger wings.
// Round 7 detail: mottled scales, banded belly plates (chest, neck, tail),
// ridged horns, brow ridges, nostrils, rows of teeth and a tongue in the open
// jaw, slit pupils, chin frills, knee spurs and big ivory claws, finger claws,
// veined membranes with a darker scalloped edge; gold dragon: a forehead jewel.
function greendragon(U) {
  const k = makeKit(U ? 211 : 199, [0, 0.62, -0.04]);
  const G = U ? 0xf6c43a : 0x44c43c, GD = U ? 0xe0a028 : 0x2fa83a, BELLY = U ? 0xfff0b0 : 0xe8ee6a, SP = U ? 0xffe890 : SUN;
  const MEM = U ? 0xffcc5a : 0xbcee56, MEM2 = U ? 0xffb04a : 0x98e048, EDGE = U ? 0xff9a3a : 0x84d040, HORN = IVORY, EYE = U ? 0xff5a3a : 0xffe040;
  const SCL = { mottle: 0.08 }, BB = { band: [2, 22, 0.1] };
  // body
  k.ell(0.25, 0.24, 0.42, [0, 0.62, -0.04], G, { grad: [0.82, 1.08], ...SCL });
  k.ell(0.2, 0.17, 0.36, [0, 0.52, 0.02], BELLY, { grad: [0.9, 1.05], ...BB });
  k.ell(0.22, 0.25, 0.21, [0, 0.7, 0.26], G, SCL);
  k.ell(0.17, 0.2, 0.12, [0, 0.64, 0.36], BELLY, { r: [-0.3, 0, 0], band: [1, 24, 0.1] });
  // dorsal spines with a darker ridge
  for (let i = 0; i < 5; i++) {
    const P = [0, 0.86 - i * 0.025, 0.18 - i * 0.13];
    k.cone(0.06, 0.15 - i * 0.015, P, SP, { r: [-0.5, 0, 0], seg: 4, band: [1, 40, 0.08] });
  }
  // legs with knee spurs and big claws
  k.sym(() => {
    k.bone(BONE.LEG_BR, [0.17, 0.62, -0.28], () => {
      k.ell(0.11, 0.19, 0.17, [0.18, 0.52, -0.28], G, { grad: [0.84, 1.08], ...SCL });
      k.limb([0.2, 0.4, -0.34], [0.21, 0.12, -0.42], 0.075, 0.058, GD, { seg: 7, hs: 3, mottle: 0.06 });
      k.cone(0.03, 0.09, [0.2, 0.38, -0.4], SP, { r: [-2.2, 0, 0], seg: 4 }); // spur
      k.ell(0.08, 0.05, 0.13, [0.21, 0.045, -0.34], GD, { d: 1 });
      for (const t of [-1, 0, 1]) k.cone(0.026, 0.09, [0.21 + t * 0.04, 0.03, -0.24], HORN, { r: [Math.PI / 2 + 0.3, t * 0.3, 0], seg: 4 });
    });
    k.bone(BONE.LEG_FR, [0.15, 0.64, 0.3], () => {
      k.limb([0.15, 0.66, 0.3], [0.2, 0.38, 0.34], 0.085, 0.065, G, { seg: 7, ...SCL });
      k.ball(0.065, [0.2, 0.38, 0.34], G, { d: 1 });
      k.limb([0.2, 0.38, 0.34], [0.2, 0.08, 0.4], 0.062, 0.05, GD, { seg: 7, hs: 3, mottle: 0.06 });
      k.cone(0.026, 0.08, [0.22, 0.38, 0.3], SP, { r: [-2.3, 0, -0.3], seg: 4 }); // elbow spur
      k.ell(0.072, 0.045, 0.11, [0.2, 0.04, 0.45], GD, { d: 1 });
      for (const t of [-1, 0, 1]) k.cone(0.024, 0.085, [0.2 + t * 0.035, 0.03, 0.53], HORN, { r: [Math.PI / 2 + 0.3, t * 0.3, 0], seg: 4 });
    });
  });
  // tail with spines, banded underside and a spade tip
  k.bone(BONE.TAIL, [0, 0.6, -0.42], () => {
    const tp = [[0, 0.62, -0.38], [0, 0.48, -0.66], [0.1, 0.3, -0.9], [0.26, 0.2, -1.06], [0.42, 0.18, -1.12]], tr = [0.15, 0.11, 0.075, 0.05, 0.03];
    for (let i = 0; i < tp.length - 1; i++) {
      k.limb(tp[i], tp[i + 1], tr[i], tr[i + 1], G, { seg: 8, hs: 2, ...SCL });
      k.limb(tup(tp[i], [tp[i][0], tp[i][1] - tr[i] * 0.55, tp[i][2]], 1), [tp[i + 1][0], tp[i + 1][1] - tr[i + 1] * 0.55, tp[i + 1][2]], tr[i] * 0.6, tr[i + 1] * 0.6, BELLY, { seg: 6, hs: 3, band: [2, 18, 0.1] });
      k.ball(tr[i + 1], tp[i + 1], G, { d: 1 });
      if (i < 3) k.cone(0.05 - i * 0.01, 0.12 - i * 0.02, [tp[i + 1][0], tp[i + 1][1] + tr[i + 1] * 0.8, tp[i + 1][2]], SP, { r: [-0.6, 0, 0], seg: 4 });
    }
    k.plate([[0, 0], [0.1, 0.06], [0.04, 0.22], [0, 0.26], [-0.04, 0.22], [-0.1, 0.06]], 0.03, [0.42, 0.18, -1.12], SP, { r: [-Math.PI / 2, 0.9, 0] });
    k.plate([[0, 0.02], [0.05, 0.07], [0, 0.2], [-0.05, 0.07]], 0.036, [0.42, 0.18, -1.12], EDGE, { r: [-Math.PI / 2, 0.9, 0] });
  });
  // wings
  const S = U ? 1.1 : 1;
  k.sym(() => k.bone(BONE.WING_R, [0.12, 0.84, 0.12], () => dragonWing(k, {
    root: [0.12, 0.84, 0.12], elbow: [0.42 * S, 1.12 * S, 0.04], wrist: [0.66 * S, 1.36 * S, -0.1],
    tips: [[1.0 * S, 1.14 * S, -0.3], [0.92 * S, 0.84, -0.44], [0.66 * S, 0.66, -0.5]], back: [0.14, 0.72, -0.36],
    bone: GD, mem: MEM, mem2: MEM2, edge: EDGE, claw: HORN, vein: U ? 0xf0a030 : 0x5cb83a,
  })));
  // neck and head (HEAD)
  k.bone(BONE.HEAD, [0, 0.76, 0.34], () => {
    k.limb([0, 0.72, 0.32], [0, 0.98, 0.47], 0.15, 0.115, G, { seg: 10, ...SCL });
    k.ball(0.115, [0, 0.98, 0.47], G, { d: 1 });
    k.limb([0, 0.98, 0.47], [0, 1.18, 0.55], 0.115, 0.095, G, { seg: 10, ...SCL });
    k.limb([0, 0.7, 0.42], [0, 1.12, 0.6], 0.09, 0.07, BELLY, { seg: 7, hs: 6, band: [1, 22, 0.12] });
    for (let i = 0; i < 4; i++) k.cone(0.05, 0.12, tup([0, 0.92, 0.33], [0, 1.27, 0.48], i / 3), SP, { r: [-1.0, 0, 0], seg: 4 });
    k.at([0, 1.25, 0.62], [0.25, 0, 0], 1.15, () => {
      k.ell(0.12, 0.11, 0.14, [0, 0, 0], G, { grad: [0.88, 1.1], ...SCL });
      k.ell(0.085, 0.07, 0.17, [0, -0.025, 0.16], G, SCL);
      // open lower jaw with a tongue, the fire in the maw, rows of teeth
      k.ell(0.075, 0.035, 0.15, [0, -0.085, 0.13], BELLY, { r: [0.3, 0, 0] });
      k.ell(0.04, 0.012, 0.09, [0, -0.07, 0.15], 0xff7a9a, { d: 1, r: [0.25, 0, 0] });
      k.ell(0.05, 0.02, 0.08, [0, -0.06, 0.2], 0xff7a3a, { glow: true, d: 0 });
      k.sym(() => {
        for (let j = 0; j < 4; j++) {
          k.cone(0.011, 0.04, [0.055 - j * 0.006, -0.06, 0.12 + j * 0.05], IVORY, { r: [Math.PI, 0, 0], seg: 3, ao: false });
          k.cone(0.01, 0.032, [0.05 - j * 0.006, -0.09 + j * 0.006, 0.1 + j * 0.045], IVORY, { r: [0.25, 0, 0], seg: 3, ao: false });
        }
        // brow ridge, eye with a slit pupil
        k.box(0.08, 0.035, 0.1, [0.065, 0.065, 0.06], GD, { r: [0, -0.2, -0.3] });
        k.ball(0.03, [0.08, 0.035, 0.1], EYE, { glow: true, d: 1 });
        k.box(0.008, 0.04, 0.01, [0.094, 0.035, 0.115], U ? 0x8a1a2a : 0x2a5a1a, { r: [0, 0.9, 0], ao: false, grad: [1, 1] });
        // ridged horns
        k.limb([0.07, 0.07, -0.05], [0.12, 0.15, -0.2], 0.042, 0.03, HORN, { seg: 6, hs: 4, band: [1, 60, 0.1] });
        k.limb([0.12, 0.15, -0.2], [0.13, 0.18, -0.32], 0.03, 0.006, HORN, { seg: 6, hs: 3, band: [2, 60, 0.1] });
        k.plate([[0, 0], [0.12, 0.06], [0.1, -0.03]], 0.014, [0.1, -0.01, -0.03], SP, { r: [0, -0.5, 0] }); // cheek fin
        k.plate([[0, 0], [0.08, -0.04], [0.04, -0.09]], 0.012, [0.05, -0.1, 0.02], SP, { r: [0, -0.4, 0] }); // chin frill
        k.ell(0.016, 0.01, 0.014, [0.03, 0.0, 0.32], INK, { d: 0, ao: false, r: [0, 0.5, 0] }); // nostril
      });
      if (U) {
        for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32; k.cone(0.028, 0.12, [Math.sin(a) * 0.08, 0.1, -0.03 - Math.cos(a) * 0.02], HORN, { r: [-0.5, 0, -a], seg: 4 }); }
        k.stud(0.026, [0, 0.085, 0.1], 0xff5a7a, { glow: true });
      }
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
