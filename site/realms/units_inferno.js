import * as THREE from 'three';
import { BONE } from './rig.js?v=1.9';

// =====================================================================
// HEX REALMS: Inferno creatures (round 6), base and upgraded.
// infernoModel(id) -> { body, glow } for imp, hellhound, demon, succubus,
// efreet, nightmare, devil (Pit Lord) and the upgrades familiar, cerberus,
// horneddemon, succubusmistress, efreetsultan, hellcharger, archdevil.
// Facing +z, base at y = 0, ~1 unit tall (Pit Lord / Arch Devil ~1.5).
// Each upgrade is built by the same builder as its base creature with
// up = true (same silhouette, grander: gold, crowns, bigger horns / wings /
// flames). Results are cached per id (callers share the geometries).
//
// Look: bright crimson / orange / gold with glowing lava accents (the glow
// geometry: eyes, mouths, flames, weapon edges). Shadows are warm plum, never
// black; even the Nightmare is a lifted plum-charcoal lit by orange fire.
// Readability (Round 4): big heads, horns, wings and weapons; 2-3 colour
// blocks + one glowing accent per creature; no micro parts.
//
// Rig (Round 5): every part is tagged through k.bone(bone, pivot, fn) (kit
// shared with units_haven.js). +x is the weapon side (*_R). Quadrupeds use
// LEG_FL/FR/BL/BR; the Cerberus has three HEAD parts with their own neck
// pivots; wings WING_L/R; the Efreet's flame lower body is TAIL; skirts CLOTH.
// =====================================================================

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UPV = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- palette
// crimson / orange / gold, plum (not black) for the darks
const RED = 0xe8402e, RED_D = 0xc23432, RED_L = 0xff7a56, CRIMSON = 0xd42a3a;
const ORANGE = 0xff8a2a, ORANGE_D = 0xe8642a;
const GOLD = 0xf6c232, GOLD_L = 0xffe27a, BRONZE = 0xd8913a;
const HORN = 0xf6e6c4, HORN_D = 0xd8bc94;
const PLUM = 0x7a4068, PLUM_D = 0x5e3656, PLUM_L = 0x9a5a86;
const IRON = 0x9a8aa4, IRON_L = 0xd4c8dc;
const HOOF = 0x6e4660;
const LEATHER = 0x9a5a34, WOOD = 0xa8683a, SKIN = 0xf7c49c, INK = 0x4a2440;
// glow (unlit): lava / fire
const FIRE_R = 0xff5a1e, FIRE_O = 0xff9a26, FIRE_Y = 0xffe064, EYE = 0xfff27a, LAVA = 0xffb43a;

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
    // o.sm = [w, h] segments: a smooth UV ellipsoid for big sculpted forms (heads, torsos)
    ell(rx, ry, rz, p, col, o = {}) {
      const g = o.sm ? new THREE.SphereGeometry(1, o.sm[0], o.sm[1]) : new THREE.IcosahedronGeometry(1, o.d ?? (Math.max(rx, ry, rz) < 0.04 ? 0 : 1));
      k.add(g.scale(rx, ry, rz).applyMatrix4(mat(p, o.r)), col, o);
    },
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
    // a lathe whose radius ripples n times around (cloth folds, pleats, fur ruffs):
    // the ripple grows toward the hem (low y) by `hem` (0 = uniform)
    pleat(prof, p, col, o = {}) {
      const n = o.n ?? 8, amp = o.amp ?? 0.06, hem = o.hem ?? 1;
      const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), n * (o.per ?? 2), o.phi ?? 0, o.len ?? Math.PI * 2);
      const P = g.attributes.position; let y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < P.count; i++) { y0 = Math.min(y0, P.getY(i)); y1 = Math.max(y1, P.getY(i)); }
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), z = P.getZ(i), y = P.getY(i), a = Math.atan2(x, z);
        const w = 1 - hem + hem * (y1 - y) / Math.max(1e-4, y1 - y0);
        const f = 1 + amp * w * Math.cos(n * a + (o.ph ?? 0));
        P.setX(i, x * f); P.setZ(i, z * f);
      }
      k.add(g.applyMatrix4(mat(p, o.r, o.s)), col, o);
    },
    // a ring around the segment a->b at b (horn ridges, wraps, bands)
    ring(a, b, R, t, col, o = {}) {
      const g = new THREE.TorusGeometry(R, t, o.ts ?? 3, o.seg ?? 8).rotateX(Math.PI / 2);
      const d = V3(b).sub(V3(a)).normalize();
      k.add(g.applyMatrix4(along(V3(b), V3(b).add(d), 0)), col, o);
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
  if (c.bicep) k.stick(new THREE.SphereGeometry(1, 7, 5).scale(c.r1 * 1.12, L1 * 0.36, c.r1 * 1.05).translate(0, L1 * 0.5, c.r1 * 0.12), s, E.toArray(), c.bicep);
  if (c.armlet) k.ring(s, S.clone().lerp(E, 0.5).toArray(), c.r1 * 1.1, 0.014, c.armlet, { seg: 7, grad: [0.95, 1.15] });
  k.ball(c.r1 * 0.95, E.toArray(), c.elbow ?? c.upper, { d: 0 });
  k.limb(E.toArray(), Hh.toArray(), c.r1 * 0.9, c.r2, c.fore);
  if (c.bracer) { // a cuff on the forearm with rim bands and rivets
    const A = E.clone().lerp(Hh, 0.42), B = E.clone().lerp(Hh, 0.86);
    k.limb(A.toArray(), B.toArray(), c.r1 * 1.08, c.r2 * 1.16, c.bracer, { seg: 9 });
    k.ring(E.toArray(), A.toArray(), c.r1 * 1.1, 0.011, c.trim ?? shade(c.bracer, 0.8), { seg: 7, grad: [1, 1] });
    k.ring(E.toArray(), B.toArray(), c.r2 * 1.18, 0.011, c.trim ?? shade(c.bracer, 0.8), { seg: 7, grad: [1, 1] });
    if (c.spike) k.stick(new THREE.ConeGeometry(0.022, 0.07, 5).translate(0, 0.035, 0), A.clone().lerp(B, 0.5).toArray(), A.clone().lerp(B, 0.5).add(new THREE.Vector3(0.8, 0.3, -0.5)).toArray(), c.spike);
  }
  k.ball(c.hr, Hh.toArray(), c.hand, { d: 1 });
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
  k.ell(0.155, 0.085, 0.115, [0, 0.43, 0], o.hips ?? legs, { sm: [10, 6] });
  k.lathe([[0.135, 0.4], [0.155, 0.48], [0.185, 0.56], [0.205, 0.63], [0.19, 0.69], [0.12, 0.73], [0.03, 0.745]], [0, 0, 0], o.torso, { s: [1, 1, 0.76], seg: 14, grad: o.torsoGrad ?? [0.82, 1.1] });
  if (o.belt) {
    k.lathe([[0.158, 0.44], [0.162, 0.495]], [0, 0, 0], o.belt, { s: [1, 1, 0.8], seg: 14, grad: [1, 1] });
    k.lathe([[0.164, 0.448], [0.166, 0.456]], [0, 0, 0], shade(o.belt, 0.8), { s: [1, 1, 0.8], seg: 14, grad: [1, 1] }); // stitched edge
  }
  if (o.head !== false) k.bone(BONE.HEAD, NECK, () => {
    k.ell(HR, HR * 1.02, HR * 0.98, [0, HY, 0.01], o.skin ?? SKIN, { grad: [0.95, 1.05] });
    if (o.eyes !== false) eyes(k);
  });
  if (o.pauldron) k.sym(() => {
    k.ell(0.118, 0.088, 0.118, [0.2, 0.675, 0], o.pauldron, { r: [0, 0, -0.38], grad: [0.85, 1.12] });
    if (o.pTrim) k.torus(0.105, 0.024, [0.205, 0.652, 0], o.pTrim, { r: [Math.PI / 2, 0, -0.38], seg: 8, ts: 3, grad: [1, 1] });
  });
  const ac = { upper: o.upper ?? o.torso, fore: o.fore ?? o.upper ?? o.torso, hand: o.hand ?? SKIN, elbow: o.elbow, r1: o.armR ?? 0.064, r2: o.foreR ?? 0.056, hr: o.handR ?? 0.058,
    bicep: o.bicep, bracer: o.bracer, trim: o.bracerTrim, spike: o.bracerSpike, armlet: o.armlet };
  let R; k.bone(BONE.ARM_R, SH, () => { R = arm(k, SH, o.rh ?? [0.24, 0.36, 0.06], ac); });
  const lh = o.lh ?? [-0.24, 0.36, 0.06];
  let Lm; k.with(new THREE.Matrix4().makeScale(-1, 1, 1), () => k.bone(BONE.ARM_L, SH, () => { Lm = arm(k, SH, [-lh[0], lh[1], lh[2]], ac); }));
  return { R, L: [-Lm[0], Lm[1], Lm[2]] };
}


// run fn in a frame whose +y runs along a pole from a toward b (returns the pole length)
function pole(k, a, b, fn) { const L = V3(a).distanceTo(V3(b)); k.with(along(V3(a), V3(b), 0), () => fn(L)); return L; }

// ---------------------------------------------------------------- inferno helpers
const shade = (c, f) => new THREE.Color(c).multiplyScalar(f).getHex();
const mix = (c1, c2, t) => new THREE.Color(c1).lerp(new THREE.Color(c2), t).getHex();
// a tapering curved horn: segs are successive offsets from p; the last one is the tip.
// Round 7: rounder segments and ridge rings (growth rings) at every joint and mid-segment.
function horn(k, p, segs, r, col, tip = col, o = {}) {
  let a = V3(p); const n = segs.length, rc = o.ridge ?? shade(col, 0.8);
  for (let i = 0; i < n; i++) {
    const b = a.clone().add(V3(segs[i]));
    const r0 = r * (1 - (i / n) * 0.8), r1 = i === n - 1 ? 0.004 : r * (1 - ((i + 1) / n) * 0.8);
    const c = i >= n - 1 ? tip : col;
    k.limb(a.toArray(), b.toArray(), r0, r1, c, { seg: 6, grad: [0.9, 1.1] });
    if (i < n - 1) {
      k.ball(r1 * 1.02, b.toArray(), i >= n - 2 ? tip : col, { d: 0 });
      if (o.ridges !== false) {
        k.ring(a.toArray(), b.toArray(), r1 * 1.03, r1 * 0.26, i >= n - 2 ? shade(tip, 0.82) : rc, { seg: 5, grad: [1, 1] });
        const m = a.clone().lerp(b, 0.5);
        if (n <= 3) k.ring(a.toArray(), m.toArray(), (r0 + r1) * 0.515, (r0 + r1) * 0.11, rc, { seg: 5, grad: [1, 1] });
      }
    }
    a = b;
  }
}
const HORNS = {
  ram: [[0.07, 0.08, -0.02], [0.07, 0.05, -0.08], [0.02, -0.03, -0.09], [-0.01, -0.08, 0.0], [0.0, -0.03, 0.06]],
  bull: [[0.1, 0.02, 0.01], [0.07, 0.07, 0.03], [0.01, 0.09, 0.05]],
  up: [[0.03, 0.08, -0.02], [0.04, 0.09, -0.05], [0.02, 0.08, -0.07]],
  back: [[0.04, 0.06, -0.05], [0.03, 0.04, -0.09], [0.0, 0.03, -0.09]],
};
// a fiery tongue cluster (glow): red base, orange tongues, yellow core leaning forward
function flame(k, p, s = 1, o = {}) {
  const c = o.cols ?? [FIRE_R, FIRE_O, FIRE_Y];
  k.at(p, o.r ?? [0, 0, 0], s, () => {
    k.cone(0.1, 0.3, [0, -0.02, 0], c[0], { glow: true, seg: 5 });
    k.cone(0.07, 0.4, [0.035, 0, 0], c[1], { glow: true, seg: 4, r: [0, 0, -0.28] });
    k.cone(0.07, 0.34, [-0.035, 0, -0.01], c[1], { glow: true, seg: 4, r: [0, 0, 0.32] });
    k.cone(0.055, 0.24, [0, 0.0, 0.05], c[2], { glow: true, seg: 4 });
    if (o.rich) { // extra licks for close-ups
      k.cone(0.045, 0.26, [0.05, -0.01, -0.04], c[1], { glow: true, seg: 4, r: [0.3, 0, -0.5] });
      k.cone(0.04, 0.22, [-0.05, -0.01, 0.03], c[2], { glow: true, seg: 4, r: [-0.2, 0, 0.55] });
    }
  });
}
// devil head in its own frame (radius ~0.15 at s = 1): sculpted skull, brow
// ridges, sunken sockets with glowing eyes and slit pupils, cheekbones, nose
// bridge + nostrils, chin, a glowing mouth with fangs (optional tusks), pointed
// ears with a lighter inner ear, and big ridged horns of a given type
function devilHead(k, c, o) {
  const { skin, brow = RED_D, horn: hc = HORN, tip = hc, type = 'bull', hk = 1, hr = 0.034, ears = true, eye = EYE, mouth = FIRE_O, jaw = skin } = o;
  const skL = mix(skin, 0xffd0a0, 0.28), skD = mix(skin, PLUM, 0.38), earIn = mix(skin, 0xffb090, 0.45);
  k.at(c, o.rot ?? [0, 0, 0], o.s ?? 1, () => {
    k.ell(0.15, 0.15, 0.145, [0, 0, 0], skin, { sm: [12, 9], grad: [0.9, 1.08] });
    k.ell(0.122, 0.085, 0.095, [0, -0.07, 0.065], jaw, { sm: [10, 7], grad: [0.9, 1.0] });
    k.ell(0.05, 0.04, 0.04, [0, -0.118, 0.1], jaw, { d: 0 }); // chin
    k.ell(0.026, 0.05, 0.03, [0, 0.025, 0.13], skin, { d: 0, r: [-0.35, 0, 0] }); // nose bridge
    k.ball(0.04, [0, -0.012, 0.15], skin, { d: 1 }); // nose
    k.sym(() => {
      k.ball(0.012, [0.018, -0.032, 0.18], skD, { d: 0, ao: false, grad: [1, 1] }); // nostril
      k.box(0.1, 0.038, 0.06, [0.055, 0.05, 0.12], brow, { r: [0, 0.25, 0.42], grad: [1, 1] });
      k.ell(0.041, 0.031, 0.02, [0.056, 0.018, 0.127], skD, { d: 0, ao: false, grad: [1, 1] }); // socket
      k.ell(0.032, 0.024, 0.016, [0.056, 0.02, 0.135], eye, { glow: true, d: 1 });
      k.ell(0.0075, 0.019, 0.006, [0.056, 0.02, 0.149], o.pupil ?? PLUM_D, { d: 0, ao: false, grad: [1, 1] }); // slit pupil
      k.ell(0.045, 0.024, 0.034, [0.085, -0.032, 0.095], skL, { d: 0 }); // cheekbone
      if (ears) {
        k.cone(0.045, 0.13, [0.13, 0.02, -0.01], skin, { r: [0, 0.3, -1.3], seg: 5 });
        k.cone(0.028, 0.1, [0.135, 0.022, 0.006], earIn, { r: [0, 0.3, -1.3], seg: 4, grad: [1, 1] });
        if (o.earring) k.torus(0.024, 0.007, [0.15, -0.03, 0.0], o.earring, { r: [0, 1.2, 0], seg: 8, ts: 3, grad: [1, 1] });
      }
      if (o.fangs !== false) k.cone(0.013, 0.042, [0.03, -0.066, 0.163], HORN, { r: [Math.PI, 0, 0], seg: 5, grad: [1, 1] });
      if (o.tusks) k.cone(0.022, 0.085, [0.07, -0.105, 0.115], HORN, { r: [0.3, 0, -0.4], seg: 6, grad: [0.9, 1.1] });
      if (type) horn(k, [0.075, 0.1, 0.0], HORNS[type].map((v) => v.map((x) => x * hk)), hr * hk, hc, tip);
    });
    if (mouth) {
      k.ell(0.065, 0.018, 0.02, [0, -0.085, 0.145], mouth, { glow: true, d: 1 });
      k.ell(0.06, 0.012, 0.02, [0, -0.106, 0.143], skD, { d: 0, grad: [1, 1] }); // lower lip
    }
  });
}
// a leathery bat wing: arm to the wrist, jointed fingers fanning out, a
// scalloped two-sided membrane between them, darker near the body and
// lighter (thinner) toward the trailing edge, with veins from the wrist to
// every scallop. Offsets relative to the root sh.
function batWing(k, sh, o) {
  const { W, F, low, col, edge, th = 0.014, pull = 0.32, r = 0.04 } = o;
  const S = V3(sh), Wp = S.clone().add(V3(W)), Fp = F.map((f) => S.clone().add(V3(f))), Lp = S.clone().add(V3(low));
  const vein = o.vein ?? mix(col, PLUM_D, 0.35);
  k.limb(S.toArray(), Wp.toArray(), r, r * 0.8, edge, { seg: 6 });
  k.ball(r * 0.95, Wp.toArray(), edge, { d: 0 });
  Fp.forEach((f, i) => {
    const rr = r * (i ? 0.55 : 0.7), mid = Wp.clone().lerp(f, 0.48);
    k.limb(Wp.toArray(), mid.toArray(), rr, rr * 0.7, edge, { seg: 5 });
    if (i < 2) k.ball(rr * 0.85, mid.toArray(), edge, { d: 0 }); // knuckle
    k.limb(mid.toArray(), f.toArray(), rr * 0.7, 0.008, edge, { seg: 4 });
  });
  // claw on the wrist (thumb)
  k.cone(r * 0.7, r * 2.6, Wp.toArray(), o.claw ?? HORN, { r: [0, 0, -0.5], seg: 5 });
  const E = [Fp[0]], M = [];
  const pts = [...Fp, Lp];
  for (let i = 1; i < pts.length; i++) {
    const m = pts[i - 1].clone().lerp(pts[i], 0.5).lerp(Wp, pull);
    E.push(m, pts[i]); M.push(m);
  }
  // veins: thin ribs from the wrist (and shoulder) into each scallop
  M.forEach((m) => k.limb(Wp.toArray(), Wp.clone().lerp(m, 0.9).toArray(), 0.007, 0.004, vein, { seg: 3, grad: [1, 1], ao: false }));
  k.limb(S.toArray(), S.clone().lerp(Lp, 0.5).lerp(Wp, 0.35).toArray(), 0.007, 0.004, vein, { seg: 3, grad: [1, 1], ao: false });
  // the sheet facing back (-z) is seen in shade by the player's own army: paint it lighter
  const colOut = o.outer ?? mix(col, 0xffc8a0, 0.22);
  const back = o.back ?? mix(col, 0xffb090, 0.25), backOut = mix(back, 0xffd8b8, 0.2);
  const PF = [[], []], PB = [[], []];
  const tri = (a, b, c, band) => {
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize().multiplyScalar(th);
    const [f, bk] = n.z >= 0 ? [PF, PB] : [PB, PF];
    f[band].push(...a.toArray(), ...b.toArray(), ...c.toArray());
    const [a2, b2, c2] = [a, b, c].map((v) => v.clone().sub(n)); // back sheet behind, facing -n
    bk[band].push(...a2.toArray(), ...c2.toArray(), ...b2.toArray());
  };
  // each fan triangle splits into an inner band and an outer (trailing edge) band
  const T = 0.62;
  for (let i = 0; i < E.length - 1; i++) {
    const a1 = Wp.clone().lerp(E[i], T), b1 = Wp.clone().lerp(E[i + 1], T);
    tri(Wp, a1, b1, 0); tri(a1, E[i], E[i + 1], 1); tri(a1, E[i + 1], b1, 1);
  }
  tri(S, Wp, Lp, 0);
  for (const [P, c] of [[PF[0], col], [PF[1], colOut], [PB[0], back], [PB[1], backOut]]) {
    if (!P.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    k.add(g, c, { grad: o.grad ?? [0.85, 1.1], noise: 0.02 });
  }
}
// a spade-tipped devil tail on TAIL from root p through offsets: rounder
// segments, ridge barbs along the top and a two-tone ridged spade
function devilTail(k, p, segs, r, col, tipCol, spade = 1, o = {}) {
  k.bone(BONE.TAIL, p, () => {
    let a = V3(p);
    segs.forEach((d, i) => {
      const b = a.clone().add(V3(d)), r0 = r * (1 - i * 0.18), r1 = r * (1 - (i + 1) * 0.18);
      k.limb(a.toArray(), b.toArray(), r0, r1, col, { seg: 7 });
      k.ball(r1 * 1.0, b.toArray(), col, { d: 0 });
      if (o.bands) k.ring(a.toArray(), b.toArray(), r1 * 1.04, r1 * 0.3, o.bands, { seg: 6, grad: [1, 1] });
      // a dorsal barb on each segment, pointing back along the tail
      const m = a.clone().lerp(b, 0.5), dir = V3(d).normalize();
      k.stick(new THREE.ConeGeometry(r0 * 0.45, r0 * 1.3, 4).translate(0, r0 * 0.65, 0), m.toArray(), m.clone().add(dir.clone().multiplyScalar(0.6)).add(new THREE.Vector3(0, 0.8, 0)).toArray(), o.barb ?? shade(col, 0.82));
      a = b;
    });
    const dir = V3(segs[segs.length - 1]).normalize();
    const g = new THREE.OctahedronGeometry(0.07 * spade, 0).scale(1, 1.4, 0.45).translate(0, 0.07 * spade, 0);
    k.stick(g, a.toArray(), a.clone().add(dir).toArray(), tipCol, { roll: Math.PI / 2 });
    const g2 = new THREE.OctahedronGeometry(0.045 * spade, 0).scale(0.55, 1.5, 0.7).translate(0, 0.075 * spade, 0);
    k.stick(g2, a.toArray(), a.clone().add(dir).toArray(), o.spadeIn ?? mix(tipCol, 0xffe0a0, 0.3), { roll: Math.PI / 2 });
  });
}
// three claws on a hand pointing along dir (+ knuckle ridge)
function claws(k, h, col, s = 1) {
  for (let i = -1; i <= 1; i++) {
    k.cone(0.026 * s, 0.1 * s, [h[0] + i * 0.03 * s, h[1] - 0.03 * s, h[2] + 0.04 * s], col, { r: [1.9, i * 0.25, 0], seg: 5 });
    k.ball(0.022 * s, [h[0] + i * 0.03 * s, h[1] - 0.02 * s, h[2] + 0.035 * s], shade(col, 0.85), { d: 0 });
  }
}
// six-pack abdomen + navel on the figure() torso (front surface z ~ 0.76 r)
function abs(k, col, o = {}) {
  const zs = o.z ?? 0;
  for (const [y, z] of [[0.475, 0.118], [0.525, 0.13], [0.572, 0.143]]) k.sym(() => k.ell(0.036, 0.022, 0.018, [0.036, y, z + zs], col, { d: 0, grad: [0.95, 1.05] }));
  k.ell(0.03, 0.12, 0.012, [0, 0.53, 0.128 + zs], shade(col, 0.82), { d: 0, grad: [1, 1] }); // linea alba
}
// a belt buckle at the front of figure()'s belt: plate, frame and a gem (or a skull)
function buckle(k, col, o = {}) {
  const z = o.z ?? 0.132, y = o.y ?? 0.467;
  if (o.skull) {
    k.ell(0.048, 0.044, 0.032, [0, y + 0.006, z + 0.01], HORN, { d: 1 });
    k.box(0.05, 0.022, 0.03, [0, y - 0.032, z + 0.006], HORN_D, {});
    k.sym(() => k.ell(0.013, 0.015, 0.008, [0.018, y + 0.004, z + 0.038], o.eye ?? FIRE_O, { glow: true, d: 0 }));
    return;
  }
  k.box(0.075, 0.06, 0.02, [0, y, z], col, { grad: [0.9, 1.15] });
  k.box(0.05, 0.036, 0.01, [0, y, z + 0.012], shade(col, 0.75), { grad: [1, 1] });
  if (o.gem) k.ell(0.018, 0.018, 0.01, [0, y, z + 0.019], o.gem, { glow: true, d: 0 });
}
// a belt pouch hanging at the hip
function pouch(k, x, col, flap) {
  k.at([x, 0.43, 0.06], [0, Math.sign(x) * 0.9, 0], 1, () => {
    k.box(0.06, 0.07, 0.04, [0, 0, 0.0], col, {});
    k.box(0.064, 0.03, 0.044, [0, 0.025, 0.002], flap, { r: [0.15, 0, 0] });
  });
}
// a cloth flap (loincloth / tabard) on CLOTH: folds, a hem trim stripe and an
// embroidered diamond; called inside the k.bone(CLOTH...)
function flap(k, w, h, p, col, trim, emb, o = {}) {
  k.at(p, o.r ?? [-0.08, 0, 0], 1, () => {
    k.add(new THREE.BoxGeometry(w, h, 0.03, 3, 3, 1), col, { grad: [0.85, 1.05] });
    k.sym(() => k.box(0.012, h * 0.85, 0.012, [w * 0.18, 0.01, 0.017], shade(col, 0.82), { grad: [1, 1] })); // folds
    k.box(w * 1.02, 0.03, 0.036, [0, -h / 2 + 0.015, 0], trim, { grad: [1, 1] });
    k.box(w * 1.02, 0.014, 0.034, [0, h / 2 - 0.02, 0], trim, { grad: [1, 1] });
    if (emb) k.add(new THREE.OctahedronGeometry(0.035, 0).scale(1, 1.3, 0.35).translate(0, h * 0.05, 0.016), emb, { grad: [1, 1], glow: !!o.embGlow });
  });
}
// a cloven hoof split + fetlock tuft on figure()'s hooves (st = stance)
function hoofDetail(k, st, fur) {
  k.sym(() => k.bone(BONE.LEG_FR, [0.085, 0.42, 0], () => {
    k.box(0.012, 0.06, 0.04, [st, 0.05, 0.142], PLUM_D, { grad: [1, 1], ao: false });
    k.pleat([[0.062, 0.17], [0.08, 0.135], [0.07, 0.115]], [st, 0, 0.02], fur, { n: 6, amp: 0.25 });
  }));
}

// ---------------------------------------------------------------- creatures
// Imp: a little red devil with a big head, ivory horns, tiny bat wings, spade
// tail and a big iron pitchfork. Familiar: orange-red, gold horns and collar,
// bigger wings, a gold fork with flaming prongs and a fireball in the off hand.
// Round 7 detail: banded pot belly + navel, spine nubs, biceps, cloven hooves
// with fetlock tufts, fanged face with slit pupils, veined wings, barbed tail,
// a leather-wrapped haft with an iron ferrule and barbed prongs; the Familiar
// adds gold bracers, earrings, a jewelled collar and a gold-banded tail.
function imp(U) {
  const k = makeKit(U ? 103 : 101);
  const SK = U ? 0xff6a3a : RED, SK_D = U ? 0xe8503a : RED_D, BELLY = U ? 0xffa060 : RED_L;
  const A = [0.22, 0.03, 0.1], B = [0.34, 1.02, 0.24], P = (t) => A.map((v, i) => v + (B[i] - v) * t);
  const { L } = figure(k, {
    legs: SK_D, boots: HOOF, torso: SK, hips: PLUM, upper: SK, fore: SK, hand: SK_D, armR: 0.06, foreR: 0.055, handR: 0.06,
    rh: P(0.42), lh: U ? [-0.25, 0.56, 0.18] : [-0.25, 0.42, 0.1], head: false, stance: 0.12, bicep: mix(SK, 0xffb080, 0.2), knee: SK,
    bracer: U ? GOLD : null, bracerTrim: GOLD_L,
  });
  hoofDetail(k, 0.12, SK_D);
  // pot belly with banded (scaly) plates and a navel
  k.ell(0.16, 0.14, 0.13, [0, 0.5, 0.06], BELLY, { sm: [10, 8], grad: [0.95, 1.05] });
  for (const y of [0.44, 0.5, 0.56]) {
    const f = Math.sqrt(1 - ((y - 0.5) / 0.14) ** 2);
    k.torus(0.16 * f, 0.008, [0, y, 0.06], shade(BELLY, 0.84), { arc: Math.PI, r: [Math.PI / 2, 0, 0], s: [1, 0.82, 1], seg: 6, ts: 3, grad: [1, 1] });
  }
  k.ball(0.012, [0, 0.47, 0.186], shade(BELLY, 0.7), { d: 0, ao: false });
  // spine nubs
  for (const [y, z] of [[0.52, -0.125], [0.6, -0.14], [0.68, -0.125]]) k.cone(0.022, 0.05, [0, y, z], SK_D, { r: [-1.0, 0, 0], seg: 5 });
  if (U) { // jewelled gold collar
    k.torus(0.12, 0.03, [0, 0.72, 0], GOLD, { r: [Math.PI / 2, 0, 0], seg: 12, ts: 4, grad: [1, 1] });
    k.ell(0.03, 0.036, 0.016, [0, 0.69, 0.125], GOLD_L, { d: 1 });
    k.ell(0.018, 0.024, 0.012, [0, 0.69, 0.136], 0xff3a5a, { glow: true, d: 0 });
  }
  k.bone(BONE.HEAD, [0, 0.7, 0], () => devilHead(k, [0, 0.86, 0.02], {
    skin: SK, brow: SK_D, s: 1.28, type: 'up', hk: U ? 1.35 : 1.05, hr: 0.036, horn: U ? GOLD : HORN, tip: U ? GOLD_L : HORN_D, earring: U ? GOLD : null,
  }));
  k.sym(() => k.bone(BONE.WING_R, [0.08, 0.64, -0.1], () => batWing(k, [0.08, 0.64, -0.1], U ? {
    W: [0.15, 0.13, -0.06], F: [[0.36, 0.32, -0.1], [0.4, 0.1, -0.14], [0.28, -0.08, -0.14]], low: [0.02, -0.18, -0.04], col: 0xff7a48, edge: SK_D, r: 0.03,
  } : {
    W: [0.12, 0.1, -0.05], F: [[0.27, 0.24, -0.08], [0.3, 0.06, -0.1], [0.2, -0.07, -0.1]], low: [0.02, -0.15, -0.03], col: 0xf06a4a, edge: SK_D, r: 0.026,
  })));
  devilTail(k, [0, 0.4, -0.1], [[0, -0.1, -0.12], [0, 0.0, -0.14], [0, 0.14, -0.06]], 0.028, SK_D, U ? GOLD : SK_D, 1.1, { bands: U ? GOLD : null });
  k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (Lp) => {
    const M = U ? GOLD : IRON_L, M_D = U ? BRONZE : IRON;
    k.limb([0, 0, 0], [0, Lp - 0.12, 0], 0.026, 0.024, U ? BRONZE : WOOD, { seg: 6 });
    k.cyl(0.03, 0.026, 0.06, [0, 0, 0], M_D, { seg: 6 }); // ferrule
    for (let i = 0; i < 3; i++) k.ring([0, 0, 0], [0, 0.35 * Lp + i * 0.035, 0], 0.028, 0.009, U ? CRIMSON : LEATHER, { seg: 6 }); // grip wraps
    k.cyl(0.034, 0.03, 0.05, [0, Lp - 0.17, 0], M_D, { seg: 6 }); // socket
    k.box(0.26, 0.05, 0.05, [0, Lp - 0.12, 0], M, {});
    k.box(0.27, 0.014, 0.054, [0, Lp - 0.1, 0], M_D, { grad: [1, 1] });
    if (U) k.ell(0.022, 0.022, 0.012, [0, Lp - 0.12, 0.028], 0xff3a5a, { glow: true, d: 0 });
    for (const x of [-0.11, 0, 0.11]) {
      k.limb([x, Lp - 0.12, 0], [x, Lp + (x ? 0.04 : 0.08), 0], 0.024, 0.02, M, { seg: 5 });
      k.cone(0.034, 0.1, [x, Lp + (x ? 0.03 : 0.07), 0], M, { seg: 5 });
      if (x) k.cone(0.016, 0.05, [x + Math.sign(x) * 0.022, Lp + 0.05, 0], M, { r: [0, 0, Math.sign(x) * 2.6], seg: 4 }); // barbs
      if (U) flame(k, [x, Lp + (x ? 0.1 : 0.14), 0], 0.42);
    }
  }));
  if (U) k.bone(BONE.ARM_L, SHL, () => { k.ball(0.07, [L[0], L[1] + 0.08, L[2] + 0.02], FIRE_O, { glow: true, d: 1 }); flame(k, [L[0], L[1] + 0.1, L[2] + 0.02], 0.5, { rich: true }); });
  return k.done();
}

// Hell Hound: a crimson hound with a plum back, a crest of fire from head to
// rump, glowing eyes and jaws, a flaming tail. Cerberus: three heads (each its
// own HEAD with a neck pivot) in gold spiked collars, bigger fire.
// Round 7 detail: plum tiger stripes, horn spine spikes between the flames,
// muscled shoulders/haunches, clawed toes, a fur ruff, fanged jaws with a
// tongue, slit pupils, inner ears, cheek tufts and a tufted tail.
function hound(k, x, z, yaw, s, U, FUR, FUR_D) {
  const base = [x, 0.6, z];
  k.bone(BONE.HEAD, base, () => k.at(base, [0, yaw, 0], s, () => {
    k.limb([0, 0, 0], [0, 0.17, 0.13], 0.1, 0.085, FUR, { seg: 9 });
    if (U) {
      k.torus(0.09, 0.03, [0, 0.07, 0.05], GOLD, { r: [Math.PI / 2 - 0.65, 0, 0], seg: 10, ts: 4, grad: [1, 1] });
      for (const a of [-1, 0, 1]) k.cone(0.022, 0.07, [Math.sin(a) * 0.1, 0.1, 0.05 - Math.cos(a) * 0.08], GOLD_L, { r: [-0.8, 0, -a], seg: 5 });
      k.torus(0.022, 0.007, [0, 0.03, 0.135], GOLD_L, { r: [0.3, 0, 0], seg: 8, ts: 3, grad: [1, 1] }); // tag ring
      k.ell(0.022, 0.026, 0.008, [0, 0.0, 0.14], 0xff3a5a, { glow: true, d: 0 });
    } else { // fur ruff
      for (let i = 0; i < 7; i++) {
        const a = ((i - 3) / 3) * 1.6;
        k.stick(new THREE.ConeGeometry(0.035, 0.09, 4).translate(0, 0.045, 0), [Math.sin(a) * 0.08, 0.08, 0.05 + Math.cos(a) * 0.06], [Math.sin(a) * 0.2, 0.02, Math.cos(a) * 0.05 - 0.1], FUR_D);
      }
    }
    const h = [0, 0.2, 0.2];
    k.ell(0.11, 0.105, 0.12, h, FUR, { sm: [10, 8], grad: [0.9, 1.08] });
    k.ell(0.065, 0.05, 0.11, [0, h[1] - 0.005, h[2] + 0.12], FUR, { sm: [8, 6] }); // snout
    k.ell(0.03, 0.02, 0.08, [0, h[1] + 0.035, h[2] + 0.1], mix(FUR, 0xffb080, 0.2), { d: 0 }); // muzzle ridge
    k.ell(0.058, 0.03, 0.1, [0, h[1] - 0.07, h[2] + 0.1], FUR_D, { r: [0.35, 0, 0] }); // open jaw
    k.ell(0.05, 0.026, 0.08, [0, h[1] - 0.045, h[2] + 0.11], FIRE_O, { glow: true, d: 0, r: [0.2, 0, 0] }); // fiery maw
    k.ell(0.03, 0.01, 0.055, [0, h[1] - 0.06, h[2] + 0.14], 0xff7a90, { d: 0, r: [0.3, 0, 0], grad: [1, 1] }); // tongue
    k.ball(0.028, [0, h[1] + 0.015, h[2] + 0.23], PLUM_D, { d: 0 }); // nose
    k.sym(() => {
      k.ell(0.026, 0.02, 0.014, [0.05, h[1] + 0.035, h[2] + 0.1], EYE, { glow: true, d: 0 });
      k.ell(0.006, 0.016, 0.005, [0.05, h[1] + 0.035, h[2] + 0.115], PLUM_D, { d: 0, ao: false, grad: [1, 1] });
      k.box(0.07, 0.03, 0.05, [0.05, h[1] + 0.065, h[2] + 0.085], FUR_D, { r: [0, 0.2, 0.4] });
      k.cone(0.045, 0.13, [0.06, h[1] + 0.08, h[2] - 0.04], FUR_D, { r: [-0.5, 0, -0.35], seg: 5 });
      k.cone(0.026, 0.09, [0.062, h[1] + 0.085, h[2] - 0.028], 0xff8a8a, { r: [-0.5, 0, -0.35], seg: 4, grad: [1, 1] }); // inner ear
      k.cone(0.012, 0.045, [0.035, h[1] - 0.02, h[2] + 0.2], HORN, { r: [Math.PI, 0, 0], seg: 5, grad: [1, 1] }); // upper fang
      k.cone(0.01, 0.035, [0.03, h[1] - 0.08, h[2] + 0.17], HORN, { r: [0.3, 0, 0], seg: 4, grad: [1, 1] }); // lower fang
      k.stick(new THREE.ConeGeometry(0.03, 0.09, 4).translate(0, 0.045, 0), [0.08, h[1] - 0.03, h[2] + 0.02], [0.2, h[1] - 0.06, h[2] - 0.08], FUR); // cheek tuft
    });
    if (!U || x === 0) flame(k, [0, h[1] + 0.06, h[2] - 0.08], U ? 0.6 : 0.5, { r: [-0.7, 0, 0], rich: true });
  }));
}
function hellhound(U) {
  const k = makeKit(U ? 113 : 109, [0, 0.46, -0.05]);
  const FUR = U ? 0xc8402e : 0xbc3a30, FUR_D = PLUM, BELLY = RED_L, FUR_L = mix(FUR, 0xffa070, 0.22);
  const RX = U ? 0.19 : 0.17;
  k.ell(RX, 0.16, 0.34, [0, 0.46, -0.05], FUR, { sm: [14, 10], grad: [0.82, 1.08] });
  k.ell(0.13, 0.08, 0.3, [0, 0.56, -0.07], FUR_D, { sm: [12, 7], grad: [0.95, 1.1] }); // plum back
  k.ell(U ? 0.2 : 0.17, 0.19, 0.17, [0, 0.5, 0.2], FUR, { sm: [12, 9] }); // chest
  k.ell(0.12, 0.08, 0.2, [0, 0.36, 0.0], BELLY, { grad: [1, 1] });
  // tiger stripes curling down the flanks from the plum back
  for (const z of [-0.3, -0.18, -0.06, 0.06]) k.sym(() => {
    const y = 0.5, f = Math.sqrt(Math.max(0, 1 - ((y - 0.46) / 0.16) ** 2 - ((z + 0.05) / 0.34) ** 2));
    k.ell(0.02, 0.085, 0.026, [RX * f - 0.004, y, z], FUR_D, { d: 0, r: [0.25, 0, 0.35], grad: [1, 1] });
  });
  // muscled shoulders and haunches
  k.sym(() => { k.ell(0.07, 0.11, 0.1, [0.12 * (U ? 1.1 : 1), 0.5, 0.17], FUR_L, { d: 1 }); k.ell(0.075, 0.12, 0.12, [0.11 * (U ? 1.1 : 1), 0.47, -0.27], FUR_L, { d: 1 }); });
  // legs: thighs, shins, plum paws with horn claws
  for (const [x, z, bn, fr] of [[0.1, 0.22, BONE.LEG_FR, 1], [-0.1, 0.22, BONE.LEG_FL, 1], [0.1, -0.28, BONE.LEG_BR, 0], [-0.1, -0.28, BONE.LEG_BL, 0]]) {
    const xx = x * (U ? 1.12 : 1);
    k.bone(bn, [xx, 0.46, z], () => {
      k.ell(0.075, 0.13, 0.1, [xx, 0.38, z], FUR, { sm: [8, 6] });
      if (fr) k.limb([xx, 0.32, z + 0.01], [xx, 0.05, z + 0.03], 0.055, 0.042, FUR);
      else { k.limb([xx, 0.32, z - 0.02], [xx, 0.17, z - 0.07], 0.058, 0.045, FUR); k.ball(0.046, [xx, 0.17, z - 0.07], FUR, { d: 0 }); k.limb([xx, 0.17, z - 0.07], [xx, 0.05, z - 0.03], 0.045, 0.04, FUR); }
      k.ell(0.055, 0.04, 0.075, [xx, 0.035, z + 0.04], FUR_D, { d: 0 });
      for (const dx of [-0.026, 0, 0.026]) k.cone(0.012, 0.045, [xx + dx, 0.025, z + 0.1], HORN, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 4, grad: [1, 1] });
    });
  }
  // fire crest along the spine, horn spikes between the flames
  for (let i = 0; i < (U ? 2 : 3); i++) flame(k, [0, 0.6 - i * 0.01, (U ? 0.0 : 0.08) - i * 0.14], (U ? 0.66 : 0.55) - i * 0.06, { r: [-0.6, 0, 0], rich: true });
  for (const z of (U ? [0.1, -0.07, -0.21, -0.31] : [0.15, 0.01, -0.13, -0.27])) k.cone(0.022, 0.07, [0, 0.62 - Math.abs(z + 0.07) * 0.18, z], HORN_D, { r: [-0.5, 0, 0], seg: 5 });
  // tail with fur tufts and a burning tip
  k.bone(BONE.TAIL, [0, 0.52, -0.36], () => {
    k.limb([0, 0.52, -0.36], [0, 0.6, -0.5], 0.04, 0.03, FUR_D);
    k.limb([0, 0.6, -0.5], [0, 0.72, -0.56], 0.03, 0.022, FUR_D);
    for (const [p, q] of [[[0, 0.56, -0.43], [0, 0.56, -0.56]], [[0, 0.64, -0.52], [0, 0.66, -0.64]]]) k.stick(new THREE.ConeGeometry(0.03, 0.08, 4).translate(0, 0.04, 0), p, q, FUR);
    flame(k, [0, 0.74, -0.56], 0.55, { r: [-0.4, 0, 0], rich: true });
  });
  if (U) { hound(k, 0, 0.27, 0, 1.08, U, FUR, FUR_D); hound(k, 0.16, 0.22, 0.5, 1.0, U, FUR, FUR_D); hound(k, -0.16, 0.22, -0.5, 1.0, U, FUR, FUR_D); }
  else hound(k, 0, 0.27, 0, 1.3, U, FUR, FUR_D);
  return k.done();
}

// Demon: a big hunched red brute: wide shoulders, huge clawed hands, bull
// horns, plum loincloth, bronze bracers. Horned Demon: huge gold-tipped
// horns, spiked gold pauldrons and belt, a glowing lava sigil on the chest.
// Round 7 detail: tusks and fangs, biceps, six-pack, spine spikes, banded
// bracers (a broken shackle chain on the base), a leather belt with a skull
// buckle and pouch, a trimmed front and back loincloth, cloven hooves.
function demon(U) {
  const k = makeKit(U ? 127 : 121);
  const SK = U ? 0xe03a30 : RED, SK_D = RED_D;
  let H;
  k.at([0, 0, 0], [0, 0, 0], [1.18, 1, 1.1], () => {
    H = figure(k, {
      legs: SK_D, boots: HOOF, torso: SK, hips: PLUM, upper: SK, fore: SK, hand: SK_D, elbow: SK,
      armR: 0.085, foreR: 0.08, handR: 0.078, rh: [0.3, 0.42, 0.17], lh: [-0.3, 0.42, 0.17], head: false, stance: 0.13,
      pauldron: U ? GOLD : SK, pTrim: U ? GOLD_L : null, belt: U ? GOLD : LEATHER, bicep: RED_L, knee: SK,
      bracer: U ? GOLD : BRONZE, bracerTrim: U ? GOLD_L : 0xa86a2a, bracerSpike: U ? GOLD_L : null,
    });
    hoofDetail(k, 0.13, SK_D);
    // pecs, abs, spine spikes
    k.sym(() => k.ell(0.1, 0.075, 0.06, [0.075, 0.6, 0.11], RED_L, { r: [0, 0.3, 0] }));
    abs(k, RED_L);
    for (const [y, z] of [[0.5, -0.12], [0.58, -0.14], [0.66, -0.135]]) k.cone(0.026, 0.07, [0, y, z], HORN_D, { r: [-1.1, 0, 0], seg: 5 });
    buckle(k, GOLD, U ? { gem: LAVA } : { skull: true });
    pouch(k, -0.15, LEATHER, mix(LEATHER, 0xffc080, 0.2));
    k.bone(BONE.CLOTH, [0, 0.44, 0.1], () => flap(k, 0.16, 0.2, [0, 0.33, 0.125], PLUM_L, U ? GOLD : PLUM_D, U ? LAVA : BRONZE, { embGlow: U }));
    k.bone(BONE.CLOTH, [0, 0.44, -0.1], () => flap(k, 0.18, 0.16, [0, 0.35, -0.125], PLUM_L, U ? GOLD : PLUM_D, null, { r: [0.1, 0, 0] }));
    if (U) {
      k.sym(() => {
        for (let i = 0; i < 2; i++) k.cone(0.035, 0.12, [0.19 + i * 0.05, 0.73, -0.02 + i * 0.02], GOLD_L, { r: [0, 0, -0.5 - i * 0.4], seg: 5 });
        for (const a of [0.4, 1.2, 2.0]) k.ball(0.012, [0.2 + Math.cos(a) * 0.09, 0.655 + Math.sin(a) * 0.02, Math.sin(a) * 0.09], GOLD_L, { d: 0 }); // rivets
      });
      k.ell(0.055, 0.075, 0.02, [0, 0.62, 0.155], LAVA, { glow: true, d: 1 });
      k.sym(() => k.box(0.025, 0.09, 0.02, [0.06, 0.6, 0.15], FIRE_O, { glow: true, r: [0, 0.3, 0.6] }));
    }
    k.bone(BONE.ARM_R, SH, () => claws(k, H.R, HORN, 1.25));
    k.bone(BONE.ARM_L, SHL, () => {
      claws(k, H.L, HORN, 1.25);
      if (!U) { // broken shackle chain hanging from the left bracer
        const c = [H.L[0] - 0.01, H.L[1] - 0.04, H.L[2] - 0.06];
        for (let i = 0; i < 3; i++) k.torus(0.022, 0.007, [c[0], c[1] - i * 0.036, c[2] - 0.02], IRON_L, { r: [0, i % 2 ? Math.PI / 2 : 0, 0], seg: 8, ts: 3, grad: [1, 1] });
      }
    });
  });
  devilTail(k, [0, 0.4, -0.12], [[0, -0.12, -0.12], [0, -0.04, -0.16], [0, 0.08, -0.08]], 0.034, SK_D, U ? GOLD : SK_D, 1.1);
  k.bone(BONE.HEAD, [0, 0.68, 0.02], () => devilHead(k, [0, 0.78, 0.07], {
    skin: SK, brow: SK_D, s: 1.08, type: 'bull', hk: U ? 1.6 : 1.15, hr: U ? 0.04 : 0.036, horn: HORN, tip: U ? GOLD : HORN_D, tusks: true, fangs: false, earring: U ? GOLD : null,
  }));
  return k.done();
}

// Succubus: rose-skinned winged temptress in a magenta gown, deep plum hair,
// small swept horns, spade tail, a fire bolt blazing in her raised hand.
// Mistress: crimson-gold gown, gold tiara, bigger gold-boned wings, a fire
// staff crowned with a crescent and a second flame in her other hand.
// Round 7 detail: a pleated skirt with a hem trim and embroidered diamonds, a
// laced bodice with a neckline trim, a pendant necklace, long cuffs, a made-up
// face (arched brows, lashes, cat-slit eyes, two-tone lips, blush), pointed
// ears, hair in bangs and locks, ridged horns, veined wings.
function succubus(U) {
  const k = makeKit(U ? 137 : 131);
  const SKN = 0xffa08c, GOWN = U ? CRIMSON : 0xd8407e, GOWN_L = U ? 0xff6a7a : 0xf06a9a, HAIR = 0x6e2254, HAIR_L = 0x963878, TRIM = U ? GOLD : 0xffb0d0;
  const GEM = U ? 0xff3a5a : 0xff6ad0, LASH = 0x4a1a3a;
  const { R, L } = figure(k, {
    robe: true, torso: GOWN, hips: GOWN, upper: SKN, fore: SKN, hand: SKN, belt: TRIM, armR: 0.056, foreR: 0.05, handR: 0.052,
    rh: U ? [0.26, 0.5, 0.12] : [0.24, 0.74, 0.18], lh: [-0.25, 0.48, 0.16], head: false,
    bracer: GOWN_L, bracerTrim: TRIM, armlet: U ? GOLD : null,
  });
  buckle(k, TRIM, { gem: GEM, z: 0.13 });
  k.bone(BONE.CLOTH, [0, 0.46, 0], () => {
    const prof = [[0.25, 0.0], [0.235, 0.08], [0.19, 0.26], [0.155, 0.46]];
    k.pleat(prof, [0, 0, 0], GOWN, { s: [1, 1, 0.86], n: 9, amp: 0.07, grad: [0.86, 1.06] });
    k.pleat([[0.262, 0.0], [0.256, U ? 0.07 : 0.05]], [0, 0, 0], TRIM, { s: [1, 1, 0.86], n: 9, amp: 0.07, hem: 0, grad: [1, 1] });
    // embroidered diamonds on the pleat crests above the hem
    for (let j = -2; j <= 2; j++) {
      const a = (j * 2 * Math.PI) / 9, y = U ? 0.115 : 0.095;
      k.at([Math.sin(a) * 0.252, y, Math.cos(a) * 0.252 * 0.86], [0, a, 0], 1, () => k.add(new THREE.OctahedronGeometry(0.024, 0).scale(1, 1.5, 0.4), TRIM, { grad: [1, 1] }));
    }
  });
  // bare shoulders, neckline trim, laced bodice, pendant necklace
  k.ell(0.16, 0.06, 0.1, [0, 0.7, 0], SKN, { sm: [10, 7] });
  if (U) k.lathe([[0.22, 0.6], [0.21, 0.645]], [0, 0, 0], GOLD, { s: [1, 1, 0.78], seg: 14, grad: [1, 1] });
  else k.lathe([[0.209, 0.632], [0.205, 0.66]], [0, 0, 0], TRIM, { s: [1, 1, 0.77], seg: 14, grad: [1, 1] });
  for (const y of [0.51, 0.555]) {
    const z = 0.128 + (y - 0.51) * 0.5;
    k.limb([-0.026, y - 0.018, z], [0.026, y + 0.018, z], 0.006, 0.006, TRIM, { seg: 4, grad: [1, 1] });
    k.limb([0.026, y - 0.018, z], [-0.026, y + 0.018, z], 0.006, 0.006, TRIM, { seg: 4, grad: [1, 1] });
  }
  k.torus(0.1, 0.008, [0, 0.71, 0.075], GOLD, { r: [-(Math.PI / 2 - 0.6), 0, 0], seg: 14, ts: 3, grad: [1, 1] });
  k.ell(0.026, 0.032, 0.01, [0, 0.635, 0.158], GOLD, {});
  k.ell(0.018, 0.024, 0.01, [0, 0.635, 0.165], GEM, { glow: true, d: 0 });
  k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.155, 0.16, 0.15, [0, HY + 0.02, -0.03], HAIR, { sm: [12, 9], grad: [0.9, 1.15] });
    k.ell(0.14, 0.22, 0.08, [0, HY - 0.12, -0.09], HAIR, { sm: [10, 7] }); // long hair down the back
    // locks over the back hair, alternating highlights
    for (let i = -2; i <= 2; i++) k.limb([i * 0.05, HY - 0.02, -0.12], [i * 0.07, HY - 0.3 - Math.abs(i) * 0.025, -0.12 - Math.abs(i) * 0.01], 0.04, 0.012, i % 2 ? HAIR_L : HAIR, { seg: 5 });
    k.ell(0.122, 0.13, 0.115, [0, HY - 0.005, 0.03], SKN, { sm: [12, 9], grad: [0.95, 1.05] });
    k.ell(0.012, 0.018, 0.01, [0, HY - 0.028, 0.146], SKN, {}); // nose
    k.sym(() => {
      k.ell(0.026, 0.024, 0.014, [0.05, HY + 0.005, 0.137], EYE, { glow: true, d: 1 });
      k.ell(0.006, 0.018, 0.005, [0.05, HY + 0.005, 0.151], HAIR, { d: 0, ao: false, grad: [1, 1] }); // cat-slit pupil
      k.ell(0.027, 0.006, 0.008, [0.054, HY + 0.027, 0.14], LASH, { r: [0, 0.35, 0.22], d: 0, grad: [1, 1], ao: false }); // lashes
      k.ell(0.028, 0.0065, 0.008, [0.052, HY + 0.056, 0.126], HAIR, { r: [0, 0.35, 0.3], d: 0, grad: [1, 1], ao: false }); // arched brow
      k.ell(0.026, 0.014, 0.008, [0.074, HY - 0.036, 0.121], 0xff7a90, { d: 0, grad: [1, 1] }); // blush
      k.cone(0.022, 0.08, [0.115, HY + 0.0, 0.02], SKN, { r: [0, 0.3, -1.3], seg: 4 }); // pointed ear
      k.ell(0.06, 0.03, 0.032, [0.042, HY + 0.1, 0.1], HAIR_L, { r: [0, 0, 0.45], d: 0 }); // bangs
      k.limb([0.11, HY + 0.05, 0.04], [0.135, HY - 0.12, 0.06], 0.032, 0.022, HAIR_L, { seg: 6 }); // front lock
      k.limb([0.135, HY - 0.12, 0.06], [0.12, HY - 0.24, 0.09], 0.022, 0.01, HAIR_L, { seg: 6 });
      horn(k, [0.07, HY + 0.11, 0.0], HORNS.back.map((v) => v.map((x) => x * (U ? 1.2 : 1.0))), 0.03, U ? GOLD : HORN, U ? GOLD_L : HORN_D);
    });
    k.ell(0.028, 0.009, 0.012, [0, HY - 0.066, 0.138], shade(CRIMSON, 0.85), { d: 0 }); // upper lip
    k.ell(0.026, 0.011, 0.012, [0, HY - 0.08, 0.135], 0xff5a7a, { d: 0 }); // lower lip
    if (U) {
      k.lathe([[0.158, HY + 0.05], [0.158, HY + 0.085]], [0, 0, -0.02], GOLD, { seg: 12, grad: [1, 1] });
      k.cone(0.035, 0.1, [0, HY + 0.08, 0.13], GOLD_L, { seg: 5 });
      k.ball(0.026, [0, HY + 0.08, 0.15], FIRE_O, { glow: true, d: 0 });
      k.sym(() => { k.cone(0.02, 0.06, [0.09, HY + 0.08, 0.1], GOLD_L, { seg: 4, r: [0, 0, -0.3] }); k.ball(0.014, [0.09, HY + 0.075, 0.117], GEM, { glow: true, d: 0 }); });
    }
  });
  k.sym(() => k.bone(BONE.WING_R, [0.07, 0.66, -0.1], () => batWing(k, [0.07, 0.66, -0.1], {
    W: [0.2, 0.2, -0.08], F: U ? [[0.56, 0.48, -0.16], [0.62, 0.2, -0.2], [0.5, -0.08, -0.2], [0.3, -0.24, -0.14]] : [[0.46, 0.4, -0.14], [0.52, 0.16, -0.18], [0.4, -0.08, -0.16]],
    low: [0.02, -0.3, -0.04], col: U ? 0xe0509a : 0xd860b0, edge: U ? GOLD : PLUM, r: 0.032,
  })));
  devilTail(k, [0, 0.42, -0.14], [[0, -0.14, -0.1], [0, -0.1, -0.14], [0, 0.04, -0.12]], 0.022, GOWN, TRIM, 1.0, { bands: U ? GOLD : null });
  if (U) {
    const SX = R[0] + 0.01, SZ = R[2];
    k.bone(BONE.ARM_R, SH, () => {
      k.limb([SX, 0.03, SZ], [SX, 0.9, SZ], 0.024, 0.022, PLUM_L, { seg: 6 });
      k.cyl(0.03, 0.026, 0.05, [SX, 0.0, SZ], GOLD, { seg: 6 }); // ferrule
      for (const y of [0.3, 0.6]) k.ring([SX, 0, SZ], [SX, y, SZ], 0.028, 0.01, GOLD_L, { seg: 6 });
      for (let i = 0; i < 3; i++) k.ring([SX, 0, SZ], [SX, R[1] - 0.06 + i * 0.03, SZ], 0.027, 0.009, CRIMSON, { seg: 6 }); // grip wrap
      k.cyl(0.036, 0.04, 0.06, [SX, 0.86, SZ], GOLD, { seg: 7 });
      k.torus(0.09, 0.022, [SX, 1.0, SZ], GOLD, { seg: 12, arc: Math.PI * 1.4, r: [0, 0, -0.95 * Math.PI + 0.2] });
      k.ball(0.07, [SX, 1.0, SZ], FIRE_O, { glow: true, d: 1 });
      flame(k, [SX, 1.02, SZ], 0.5, { rich: true });
    });
    k.bone(BONE.ARM_L, SHL, () => flame(k, [L[0], L[1] + 0.04, L[2] + 0.03], 0.5, { rich: true }));
  } else {
    k.bone(BONE.ARM_R, SH, () => { k.ball(0.075, [R[0], R[1] + 0.07, R[2] + 0.02], FIRE_O, { glow: true, d: 1 }); flame(k, [R[0], R[1] + 0.08, R[2] + 0.02], 0.62, { rich: true }); });
  }
  return k.done();
}

// Efreet: a muscular orange fire genie: bald horned head, pointed ears, gold
// armbands and sash, fists of fire, a lower body that dissolves into a curling
// flame tail (TAIL). Sultan: gold turban with a ruby, gold pauldrons, a big
// flaming scimitar, bigger yellow-gold flames.
// Round 7 detail: biceps with armlets, banded bracers, six-pack, a jewelled
// buckle and a knotted crimson sash, hoop earrings, fangs and slit pupils; the
// Sultan's turban gets crossed wraps, a set ruby and a plume, and the scimitar
// a fuller, curled quillons, a wrapped grip and a jewelled pommel.
function efreet(U) {
  const k = makeKit(U ? 149 : 139, [0, 0.46, 0]);
  const SK = U ? 0xffa040 : 0xff8436, SK_L = U ? 0xffc870 : 0xffaa5c, SK_D = U ? 0xf07a32 : 0xe8602e;
  const FC = U ? [ORANGE, 0xffc040, 0xfff2a0] : [FIRE_R, FIRE_O, FIRE_Y];
  const MET = U ? GOLD : BRONZE, RUBY = 0xff4a7a;
  const { R, L } = figure(k, {
    robe: true, torso: SK, hips: GOLD, upper: SK, fore: SK, hand: SK_D, belt: MET, armR: 0.08, foreR: 0.074, handR: 0.07,
    rh: U ? [0.3, 0.6, 0.18] : [0.29, 0.74, 0.14], lh: [-0.29, 0.74, 0.14], head: false, pauldron: U ? GOLD : SK_L, pTrim: U ? GOLD_L : null,
    bicep: SK_L, armlet: MET, bracer: MET, bracerTrim: U ? GOLD_L : GOLD,
  });
  k.at([0, 0, 0], [0, 0, 0], [1.12, 1, 1], () => k.sym(() => k.ell(0.1, 0.08, 0.06, [0.075, 0.6, 0.105], SK_L, { r: [0, 0.3, 0] })));
  abs(k, SK_L);
  buckle(k, MET, { gem: U ? RUBY : FIRE_Y, z: 0.128 });
  // knotted crimson sash at the hip with two hanging tails
  k.ell(0.045, 0.038, 0.035, [0.12, 0.455, 0.085], CRIMSON, {});
  k.bone(BONE.CLOTH, [0.12, 0.45, 0.09], () => {
    k.box(0.04, 0.17, 0.016, [0.13, 0.36, 0.1], CRIMSON, { r: [0.1, 0, 0.12], grad: [0.85, 1.05] });
    k.box(0.036, 0.14, 0.016, [0.165, 0.375, 0.07], shade(CRIMSON, 0.9), { r: [0.05, 0.5, 0.3], grad: [0.85, 1.05] });
    k.box(0.042, 0.02, 0.02, [0.13, 0.28, 0.108], MET, { r: [0.1, 0, 0.12], grad: [1, 1] });
  });
  // flame lower body: tapering curl of orange-red flesh wrapped in fire
  k.bone(BONE.TAIL, [0, 0.44, 0], () => {
    k.limb([0, 0.46, 0], [0, 0.3, -0.03], 0.15, 0.125, SK_D, { seg: 10 });
    k.limb([0, 0.3, -0.03], [0.03, 0.16, -0.1], 0.125, 0.08, RED_L, { seg: 9 });
    k.limb([0.03, 0.16, -0.1], [0.08, 0.06, -0.2], 0.08, 0.035, RED, { seg: 8 });
    k.ball(0.125, [0, 0.3, -0.03], SK_D, { d: 1 });
    k.ball(0.08, [0.03, 0.16, -0.1], RED_L, { d: 1 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      flame(k, [Math.sin(a) * 0.11, 0.28, Math.cos(a) * 0.09 - 0.03], U ? 0.68 : 0.6, { r: [-Math.cos(a) * 0.5 - 0.3, 0, Math.sin(a) * 0.6], cols: FC, rich: i % 2 === 0 });
    }
    flame(k, [0.04, 0.12, -0.08], 0.55, { r: [-1.2, 0, 0.3], cols: FC, rich: true });
    flame(k, [0.09, 0.05, -0.2], 0.45, { r: [-1.6, 0, 0.2], cols: FC });
  });
  // head
  k.bone(BONE.HEAD, NECK, () => {
    devilHead(k, [0, HY + 0.01, 0.02], { skin: SK, brow: SK_D, s: 0.95, type: U ? null : 'up', hk: 0.9, hr: 0.034, horn: HORN, tip: HORN_D, mouth: FIRE_Y, earring: GOLD });
    if (U) { // turban: gold base, crimson crown, crossed wraps, a set ruby and a plume
      k.ell(0.165, 0.11, 0.16, [0, HY + 0.1, 0.0], GOLD, { sm: [12, 8], grad: [0.9, 1.12] });
      k.ell(0.135, 0.09, 0.135, [0, HY + 0.17, -0.01], CRIMSON, { sm: [12, 8], grad: [0.9, 1.15] });
      k.sym(() => k.torus(0.15, 0.018, [0, HY + 0.12, -0.005], GOLD_L, { r: [Math.PI / 2, 0.0, 0.3], s: [1, 1.0, 1], seg: 14, ts: 3, grad: [1, 1] }));
      k.torus(0.05, 0.012, [0, HY + 0.12, 0.148], GOLD_L, { seg: 10, ts: 3, grad: [1, 1] });
      k.ball(0.045, [0, HY + 0.12, 0.155], RUBY, { glow: true, d: 1 });
      k.feather([0, HY + 0.15, 0.12], [0.0, HY + 0.29, -0.03], 0.06, 0xffd870, { t: 0.016 });
      flame(k, [0, HY + 0.22, -0.02], 0.55, { cols: FC, rich: true });
    } else {
      flame(k, [0, HY + 0.12, -0.03], 0.62, { cols: FC, rich: true });
      k.ell(0.05, 0.05, 0.035, [0, HY - 0.13, 0.12], SK_D, {}); // goatee
      k.cone(0.03, 0.07, [0, HY - 0.15, 0.13], SK_D, { r: [Math.PI + 0.3, 0, 0], seg: 5 });
      k.torus(0.03, 0.008, [0, HY - 0.16, 0.13], GOLD, { r: [Math.PI / 2 + 0.3, 0, 0], seg: 8, ts: 3, grad: [1, 1] }); // goatee ring
    }
  });
  if (U) {
    // flaming scimitar in the weapon hand
    k.bone(BONE.ARM_R, SH, () => k.at(R, [0.5, 0, -0.25], 1.3, () => {
      k.box(0.12, 0.035, 0.05, [0, 0.03, 0], GOLD, {});
      k.sym(() => k.torus(0.03, 0.011, [0.075, 0.05, 0], GOLD, { arc: Math.PI * 1.3, r: [0, 0, -0.6], seg: 8, ts: 3 })); // curled quillons
      k.ell(0.02, 0.02, 0.012, [0, 0.03, 0.026], RUBY, { glow: true, d: 0 });
      k.limb([0, -0.08, 0], [0, 0.02, 0], 0.022, 0.022, CRIMSON, { seg: 6 });
      for (let i = 0; i < 3; i++) k.ring([0, -0.1, 0], [0, -0.065 + i * 0.03, 0], 0.024, 0.006, GOLD_L, { seg: 6 });
      k.ball(0.03, [0, -0.095, 0], GOLD, { d: 0 }); // pommel
      const bl = [[-0.04, 0], [0.04, 0], [0.08, 0.22], [0.06, 0.42], [-0.06, 0.56], [-0.01, 0.38], [-0.04, 0.2]];
      k.plate(bl.map(([x, y]) => [x * 1.35, y * 1.1 - 0.01]), 0.016, [0, 0.05, 0], FIRE_O, { glow: true, r: [0, 0.3, 0] });
      k.plate(bl, 0.032, [0, 0.05, 0], IRON_L, { r: [0, 0.3, 0], grad: [0.9, 1.2] });
      k.plate([[-0.022, 0.03], [-0.004, 0.03], [0.022, 0.2], [0.016, 0.36], [0.002, 0.36], [-0.014, 0.2]], 0.038, [0, 0.05, 0], shade(IRON_L, 0.78), { r: [0, 0.3, 0], grad: [1, 1] }); // fuller
    }));
    k.bone(BONE.ARM_L, SHL, () => { k.ball(0.07, [L[0], L[1] + 0.05, L[2]], 0xffc040, { glow: true, d: 1 }); flame(k, [L[0], L[1] + 0.07, L[2]], 0.55, { cols: FC, rich: true }); });
  } else {
    k.bone(BONE.ARM_R, SH, () => { k.ball(0.07, [R[0], R[1] + 0.03, R[2]], FIRE_O, { glow: true, d: 1 }); flame(k, [R[0], R[1] + 0.06, R[2]], 0.55, { cols: FC, rich: true }); });
    k.bone(BONE.ARM_L, SHL, () => { k.ball(0.07, [L[0], L[1] + 0.03, L[2]], FIRE_O, { glow: true, d: 1 }); flame(k, [L[0], L[1] + 0.06, L[2]], 0.55, { cols: FC, rich: true }); });
  }
  return k.done();
}

// Nightmare: a plum-charcoal horse with a blazing mane and tail, burning hooves
// and glowing eyes. Hell Charger: crimson barding with a gold hem, a gold
// horned chanfron and spiked collar, taller yellow-white fire.
// Round 7 detail: sculpted shoulders and haunches, knees, horseshoes, a crimson
// bridle (noseband, cheek straps, bit rings), brow ridges, slit pupils, inner
// ears, a forelock flame, a dark mane ridge, a trimmed saddle blanket and
// branching lava veins; the Charger's barding gets plate bands and gold rivets,
// the chanfron a ridge and a ruby.
function nightmare(U) {
  const k = makeKit(U ? 163 : 157, [0, 0.64, -0.03]);
  const HORSE = 0x5e4664, HORSE_D = 0x503a56, HORSE_L = 0x7c5e80;
  const FC = U ? [ORANGE, 0xffc040, 0xfff4b0] : [FIRE_R, FIRE_O, FIRE_Y];
  const STRAP = U ? CRIMSON : RED_D, RINGC = U ? GOLD : IRON_L;
  k.ell(0.2, 0.2, 0.4, [0, 0.64, -0.03], HORSE, { sm: [14, 10], grad: [0.8, 1.12] });
  k.ell(0.18, 0.21, 0.18, [0, 0.68, 0.24], HORSE, { sm: [12, 9], grad: [0.85, 1.1] });
  k.sym(() => { // shoulder and haunch muscles
    k.ell(0.07, 0.15, 0.12, [0.15, 0.63, 0.2], HORSE_L, { r: [0.25, 0, 0] });
    k.ell(0.09, 0.15, 0.15, [0.13, 0.64, -0.27], HORSE_L, { r: [-0.2, 0, 0] });
  });
  const legsAt = [[0.1, 0.3, 0.12, BONE.LEG_FR], [-0.1, 0.24, -0.04, BONE.LEG_FL], [0.1, -0.3, -0.06, BONE.LEG_BR], [-0.1, -0.28, 0.06, BONE.LEG_BL]];
  for (const [x, z, sw, bn] of legsAt) k.bone(bn, [x, 0.6, z], () => {
    k.limb([x, 0.6, z], [x, 0.33, z + sw * 0.5], 0.085, 0.058, HORSE, { seg: 8 });
    k.ball(0.06, [x, 0.33, z + sw * 0.5], HORSE_L, { d: 0 }); // knee
    k.limb([x, 0.33, z + sw * 0.5], [x, 0.08, z + sw], 0.052, 0.046, HORSE_D, { seg: 7 });
    k.cyl(0.06, 0.054, 0.08, [x, 0.0, z + sw], HOOF, { seg: 8, ao: false });
    k.torus(0.058, 0.012, [x, 0.012, z + sw], RINGC, { r: [Math.PI / 2, 0, 0], seg: 10, ts: 3, grad: [1, 1], ao: false }); // horseshoe
    k.lathe([[0.075, 0.06], [0.055, 0.17], [0.0, 0.24]], [x, 0, z + sw], FC[0], { glow: true, seg: 6 });
    k.cone(0.045, 0.2, [x, 0.06, z + sw + 0.02], FC[1], { glow: true, seg: 4, r: [-0.4, 0, 0] });
    k.cone(0.035, 0.16, [x, 0.06, z + sw - 0.03], FC[2], { glow: true, seg: 4, r: [0.4, 0, 0] });
  });
  k.bone(BONE.HEAD, [0, 0.76, 0.3], () => {
    k.limb([0, 0.74, 0.3], [0, 1.0, 0.47], 0.125, 0.092, HORSE, { seg: 10 });
    k.limb([0, 0.84, 0.22], [0, 1.07, 0.43], 0.045, 0.035, HORSE_D, { seg: 6 }); // mane ridge
    k.at([0, 1.02, 0.52], [0.95, 0, 0], 1.15, () => {
      k.ell(0.085, 0.092, 0.19, [0, 0, 0.09], HORSE_L, { sm: [10, 8] });
      k.ell(0.074, 0.076, 0.08, [0, -0.015, 0.24], HORSE, { sm: [10, 7] });
      k.ell(0.055, 0.03, 0.1, [0, -0.07, 0.17], HORSE, {}); // chin / lower lip
      k.torus(0.08, 0.011, [0, -0.012, 0.19], STRAP, { seg: 12, ts: 3, grad: [1, 1] }); // noseband
      k.sym(() => {
        k.ell(0.026, 0.03, 0.02, [0.07, 0.035, 0.07], EYE, { glow: true, d: 0, r: [0, 0.5, 0] });
        k.ell(0.007, 0.02, 0.005, [0.08, 0.035, 0.088], PLUM_D, { d: 0, ao: false, r: [0, 0.5, 0], grad: [1, 1] }); // slit pupil
        k.box(0.055, 0.016, 0.04, [0.066, 0.064, 0.075], HORSE_D, { r: [0, 0.5, 0.3] }); // brow ridge
        k.ball(0.022, [0.035, 0.0, 0.3], FIRE_O, { glow: true, d: 0 });
        k.cone(0.032, 0.11, [0.05, 0.06, -0.04], HORSE_D, { r: [-0.5, 0, 0.25], seg: 5 });
        k.cone(0.02, 0.085, [0.051, 0.064, -0.03], 0xb05a7a, { r: [-0.5, 0, 0.25], seg: 4, grad: [1, 1] }); // inner ear
        k.limb([0.078, -0.01, 0.19], [0.075, 0.03, -0.02], 0.009, 0.009, STRAP, { seg: 4, grad: [1, 1] }); // cheek strap
        k.torus(0.02, 0.006, [0.08, -0.045, 0.22], RINGC, { r: [0, Math.PI / 2, 0], seg: 8, ts: 3, grad: [1, 1] }); // bit ring
      });
      k.torus(0.075, 0.009, [0, 0.03, -0.02], STRAP, { r: [0, 0, 0], arc: Math.PI, seg: 10, ts: 3, grad: [1, 1] }); // browband / headstall
      flame(k, [0, 0.07, 0.0], 0.34, { r: [-0.4, 0, 0], cols: FC }); // forelock
      if (U) {
        k.ell(0.066, 0.045, 0.17, [0, 0.06, 0.1], GOLD, { grad: [0.85, 1.12] });
        k.limb([0, 0.1, 0.0], [0, 0.085, 0.24], 0.012, 0.01, GOLD_L, { seg: 5 }); // chanfron ridge
        k.ell(0.026, 0.026, 0.014, [0, 0.105, 0.12], GOLD_L, { d: 0 });
        k.ball(0.018, [0, 0.11, 0.128], 0xff3a5a, { glow: true, d: 0 });
        k.sym(() => horn(k, [0.04, 0.08, 0.0], [[0.05, 0.08, -0.05], [0.03, 0.06, -0.09], [0.0, 0.03, -0.09]], 0.026, GOLD, GOLD_L));
      }
    });
    // burning mane along the neck
    for (let i = 0; i < 4; i++) flame(k, [0, 0.86 + i * 0.07, 0.25 + i * 0.065], (U ? 0.7 : 0.62) - i * 0.04, { r: [-0.9, 0, 0], cols: FC, rich: true });
    if (U) { // spiked collar
      k.torus(0.13, 0.035, [0, 0.8, 0.34], GOLD, { r: [Math.PI / 2 - 0.6, 0, 0], seg: 14, ts: 4, grad: [1, 1] });
      for (const a of [-1.2, 0, 1.2]) k.cone(0.03, 0.09, [Math.sin(a) * 0.14, 0.82, 0.34 + Math.cos(a) * 0.08], GOLD_L, { r: [0.3, 0, -a], seg: 5 });
    }
  });
  k.bone(BONE.TAIL, [0, 0.72, -0.42], () => {
    k.limb([0, 0.72, -0.42], [0, 0.6, -0.52], 0.06, 0.045, HORSE_D);
    flame(k, [0, 0.66, -0.5], U ? 0.9 : 0.8, { r: [-1.9, 0, 0], cols: FC, rich: true });
    flame(k, [0, 0.55, -0.55], U ? 0.7 : 0.62, { r: [-2.5, 0, 0.2], cols: FC, rich: true });
  });
  if (U) {
    k.lathe([[0.226, 0.4], [0.216, 0.5], [0.2, 0.66], [0.16, 0.78], [0.06, 0.84]], [0, 0, -0.04], CRIMSON, { s: [1, 1, 2.0], seg: 14, grad: [0.84, 1.08] });
    k.lathe([[0.234, 0.37], [0.229, 0.43]], [0, 0, -0.04], GOLD, { s: [1, 1, 2.0], seg: 14, grad: [1, 1] });
    k.lathe([[0.224, 0.555], [0.222, 0.575]], [0, 0, -0.04], shade(CRIMSON, 0.78), { s: [1, 1, 2.0], seg: 14, grad: [1, 1] }); // plate band
    k.lathe([[0.19, 0.69], [0.184, 0.71]], [0, 0, -0.04], shade(CRIMSON, 0.78), { s: [1, 1, 2.0], seg: 14, grad: [1, 1] });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; k.ball(0.012, [Math.sin(a) * 0.238, 0.44, Math.cos(a) * 0.238 * 2 - 0.04], GOLD_L, { d: 0 }); } // rivets
    k.sym(() => k.ell(0.02, 0.07, 0.07, [0.222, 0.58, -0.08], LAVA, { glow: true, d: 0 }));
  } else {
    // a crimson saddle blanket with an orange hem
    k.lathe([[0.2, 0.73], [0.18, 0.77], [0.13, 0.82], [0.06, 0.845], [0, 0.853]], [0, 0, -0.04], RED_D, { s: [1, 1, 0.8], seg: 14, grad: [0.85, 1.05] });
    k.lathe([[0.206, 0.72], [0.201, 0.742]], [0, 0, -0.04], ORANGE_D, { s: [1, 1, 0.8], seg: 14, grad: [1, 1] });
    k.sym(() => { // glowing lava cracks on the flanks, branching
      k.box(0.03, 0.2, 0.035, [0.19, 0.58, -0.12], LAVA, { glow: true, r: [0.5, 0, 0.12] });
      k.box(0.024, 0.09, 0.03, [0.188, 0.53, -0.2], FIRE_O, { glow: true, r: [-0.5, 0, 0.12] });
      k.box(0.03, 0.14, 0.035, [0.195, 0.6, 0.04], FIRE_O, { glow: true, r: [-0.6, 0, 0.1] });
      k.box(0.022, 0.08, 0.03, [0.2, 0.55, 0.1], LAVA, { glow: true, r: [0.7, 0, 0.1] });
      k.box(0.024, 0.1, 0.03, [0.165, 0.6, -0.36], FIRE_O, { glow: true, r: [0.3, -0.4, 0.2] });
    });
  }
  return k.done();
}

// Pit Lord: a huge red devil with ram horns, plum loincloth, big bat wings, a
// lava-edged great axe and a burning whip. Arch Devil: deep crimson, gold
// crown and spiked pauldrons, giant gold-boned wings, a flaming gold trident.
// Round 7 detail: biceps, spiked banded bracers, six-pack, spine spikes, a
// skull belt buckle (Arch Devil: a lava-gem gold buckle), trimmed front/back
// loincloths, cloven hooves, a ringed goatee and fangs, veined wings; the axe
// gets a wrapped haft, langets, a back spike, a rune channel and a pommel, the
// whip a wrapped handle; the crown gems, the trident ringed bands and barbs.
function devil(U) {
  const S = 1.42;
  const k = makeKit(U ? 181 : 173, HIPS.map((v) => v * S));
  const SK = U ? CRIMSON : RED, SK_D = U ? 0xb02438 : RED_D;
  let H;
  k.at([0, 0, 0], [0, 0, 0], S, () => {
    H = figure(k, {
      legs: SK_D, boots: HOOF, torso: SK, hips: PLUM, upper: SK, fore: SK, hand: SK_D, elbow: SK,
      armR: 0.08, foreR: 0.074, handR: 0.07, rh: [0.27, 0.46, 0.2], lh: [-0.27, 0.44, 0.16], head: false, stance: 0.12,
      pauldron: U ? GOLD : SK, pTrim: U ? GOLD_L : null, belt: U ? GOLD : BRONZE, bicep: RED_L, knee: SK,
      bracer: U ? GOLD : BRONZE, bracerTrim: U ? GOLD_L : 0xa86a2a, bracerSpike: U ? GOLD_L : IRON_L,
    });
    hoofDetail(k, 0.12, SK_D);
    k.sym(() => k.ell(0.1, 0.075, 0.06, [0.075, 0.6, 0.11], RED_L, { r: [0, 0.3, 0] }));
    abs(k, RED_L);
    for (const [y, z] of [[0.5, -0.12], [0.58, -0.14], [0.66, -0.135]]) k.cone(0.024, 0.065, [0, y, z], HORN_D, { r: [-1.1, 0, 0], seg: 5 });
    buckle(k, GOLD, U ? { gem: LAVA } : { skull: true });
    k.bone(BONE.CLOTH, [0, 0.44, 0.1], () => flap(k, 0.17, 0.22, [0, 0.33, 0.125], U ? GOLD : PLUM_L, U ? CRIMSON : PLUM_D, U ? LAVA : BRONZE, { embGlow: U }));
    k.bone(BONE.CLOTH, [0, 0.44, -0.1], () => flap(k, 0.19, 0.18, [0, 0.34, -0.125], U ? GOLD : PLUM_L, U ? CRIMSON : PLUM_D, null, { r: [0.1, 0, 0] }));
    if (U) k.sym(() => {
      for (let i = 0; i < 3; i++) k.cone(0.03, 0.13 - i * 0.02, [0.15 + i * 0.05, 0.74 - i * 0.02, 0], GOLD_L, { r: [0, 0, -0.3 - i * 0.35], seg: 5 });
      for (const a of [0.4, 1.2, 2.0]) k.ball(0.011, [0.2 + Math.cos(a) * 0.09, 0.655 + Math.sin(a) * 0.02, Math.sin(a) * 0.09], GOLD_L, { d: 0 }); // rivets
    });
    k.bone(BONE.HEAD, NECK, () => {
      devilHead(k, [0, HY + 0.01, 0.03], { skin: SK, brow: SK_D, s: 1.02, type: 'ram', hk: U ? 1.25 : 1.15, hr: 0.042, horn: HORN, tip: U ? GOLD : HORN_D, earring: U ? GOLD : null });
      k.cone(0.04, 0.1, [0, HY - 0.1, 0.12], SK_D, { r: [Math.PI + 0.4, 0, 0], seg: 6 }); // goatee
      k.torus(0.03, 0.009, [0, HY - 0.165, 0.145], U ? GOLD : BRONZE, { r: [Math.PI / 2 + 0.4, 0, 0], seg: 8, ts: 3, grad: [1, 1] }); // goatee ring
      if (U) {
        k.lathe([[0.13, HY + 0.08], [0.14, HY + 0.13]], [0, 0, 0.0], GOLD, { seg: 12, grad: [1, 1] });
        for (let i = 0; i < 5; i++) {
          const a = ((i - 2) / 5) * Math.PI * 1.1;
          k.cone(0.026, 0.08, [Math.sin(a) * 0.135, HY + 0.12, Math.cos(a) * 0.135], GOLD_L, { seg: 5 });
          if (i !== 2) k.ball(0.012, [Math.sin(a) * 0.142, HY + 0.103, Math.cos(a) * 0.142], 0xff3a5a, { glow: true, d: 0 });
        }
        k.ball(0.025, [0, HY + 0.11, 0.14], FIRE_O, { glow: true, d: 0 });
      }
    });
    k.sym(() => k.bone(BONE.WING_R, [0.09, 0.66, -0.12], () => batWing(k, [0.09, 0.66, -0.12], {
      W: [0.24, 0.24, -0.1], F: U ? [[0.66, 0.58, -0.22], [0.76, 0.24, -0.26], [0.62, -0.1, -0.26], [0.38, -0.3, -0.2]] : [[0.56, 0.5, -0.2], [0.64, 0.2, -0.24], [0.52, -0.1, -0.24], [0.32, -0.28, -0.18]],
      low: [0.02, -0.34, -0.04], col: U ? 0xdc3c56 : 0xd8485a, edge: U ? GOLD : PLUM, r: 0.04,
    })));
    devilTail(k, [0, 0.4, -0.12], [[0, -0.14, -0.12], [0, -0.06, -0.16], [0, 0.08, -0.1]], 0.032, SK_D, U ? GOLD : SK_D, 1.2, { bands: U ? GOLD : null });
    if (!U) {
      // great axe: dark iron haft, steel crescent blade with a lava edge
      const A = [0.25, 0.04, 0.12], B = [0.38, 1.0, 0.28];
      k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (Lp) => {
        k.limb([0, 0, 0], [0, Lp, 0], 0.03, 0.028, PLUM_L, { seg: 7 });
        k.ball(0.04, [0, 0.0, 0], IRON_L, { d: 0 }); // pommel
        for (let i = 0; i < 3; i++) k.ring([0, 0, 0], [0, Lp * 0.38 + i * 0.035, 0], 0.031, 0.01, LEATHER, { seg: 6 }); // grip wrap
        k.box(0.012, 0.22, 0.066, [0, Lp - 0.33, 0], IRON, {}); // langets
        k.cone(0.04, 0.12, [0, Lp, 0], IRON_L, { seg: 5 });
        k.cone(0.03, 0.1, [-0.02, Lp - 0.2, 0], IRON_L, { r: [0, 0, Math.PI / 2], seg: 5 }); // back spike
        const ax = [[0, -0.02], [0.12, -0.08], [0.24, -0.16], [0.3, 0.02], [0.3, 0.2], [0.24, 0.36], [0.12, 0.28], [0, 0.22]];
        k.at([0.02, Lp - 0.32, 0], [0, 0, 0], 1, () => {
          k.plate(ax.map(([x, y]) => [(x - 0.15) * 1.14 + 0.15, (y - 0.1) * 1.12 + 0.1]), 0.018, [0, 0, 0], FIRE_O, { glow: true });
          k.plate(ax, 0.04, [0, 0, 0], IRON_L, { grad: [0.85, 1.15] });
          k.plate([[0.02, 0.02], [0.12, -0.02], [0.2, -0.06], [0.2, 0.22], [0.12, 0.2], [0.02, 0.18]], 0.046, [0, 0, 0], IRON, { grad: [1, 1] }); // rune channel
          for (const [x, y] of [[0.07, 0.1], [0.12, 0.04], [0.16, 0.12]]) k.box(0.022, 0.05, 0.05, [x, y, 0], FIRE_O, { glow: true, r: [0, 0, x * 6] }); // runes
        });
      }));
      // burning whip coiled from the off hand to the ground
      k.bone(BONE.ARM_L, SHL, () => {
        const h = H.L, pts = [h, [h[0] - 0.08, h[1] - 0.14, h[2] + 0.12], [h[0] - 0.02, h[1] - 0.28, h[2] + 0.24], [h[0] - 0.14, h[1] - 0.38, h[2] + 0.3], [h[0] - 0.22, h[1] - 0.34, h[2] + 0.16]];
        k.limb(h, [h[0], h[1] - 0.1, h[2]], 0.03, 0.03, PLUM_L, { seg: 6 });
        for (let i = 0; i < 2; i++) k.ring(h, [h[0], h[1] - 0.04 - i * 0.04, h[2]], 0.032, 0.008, BRONZE, { seg: 6 });
        k.ball(0.036, [h[0], h[1] + 0.03, h[2]], BRONZE, { d: 0 });
        for (let i = 0; i < pts.length - 1; i++) k.limb(pts[i], pts[i + 1], 0.032 - i * 0.004, 0.028 - i * 0.004, i % 2 ? FIRE_O : FIRE_Y, { glow: true, seg: 5 });
        flame(k, pts[2], 0.4, { rich: true }); flame(k, pts[4], 0.4, { rich: true });
      });
    } else {
      // gold trident with flaming prongs
      const A = [0.25, 0.04, 0.12], B = [0.34, 1.12, 0.26];
      k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (Lp) => {
        k.limb([0, 0, 0], [0, Lp - 0.14, 0], 0.03, 0.028, GOLD, { seg: 7, grad: [0.9, 1.12] });
        k.cone(0.045, 0.08, [0, 0.075, 0], GOLD_L, { r: [Math.PI, 0, 0], seg: 5 }); // butt spike
        for (const y of [0.15, Lp * 0.62]) k.ring([0, 0, 0], [0, y, 0], 0.033, 0.01, GOLD_L, { seg: 7 });
        for (let i = 0; i < 3; i++) k.ring([0, 0, 0], [0, Lp * 0.38 + i * 0.035, 0], 0.031, 0.01, CRIMSON, { seg: 6 }); // grip wrap
        k.torus(0.12, 0.032, [0, Lp - 0.12, 0], GOLD, { arc: Math.PI, r: [0, 0, Math.PI], seg: 12, ts: 4 });
        for (const x of [-0.12, 0, 0.12]) {
          k.limb([x, Lp - 0.12 + (x ? 0 : -0.12), 0], [x, Lp + (x ? 0.04 : 0.1), 0], 0.026, 0.022, GOLD_L, { seg: 5 });
          k.cone(0.04, 0.11, [x, Lp + (x ? 0.03 : 0.09), 0], GOLD_L, { seg: 5 });
          if (x) k.cone(0.018, 0.055, [x + Math.sign(x) * 0.024, Lp + 0.05, 0], GOLD_L, { r: [0, 0, Math.sign(x) * 2.6], seg: 4 }); // barbs
          if (!x) flame(k, [x, Lp + 0.17, 0], 0.55, { rich: true });
        }
        k.ball(0.045, [0, Lp - 0.12, 0.02], FIRE_O, { glow: true, d: 1 });
      }));
      k.bone(BONE.ARM_L, SHL, () => { k.ball(0.07, [H.L[0], H.L[1] + 0.06, H.L[2]], FIRE_O, { glow: true, d: 1 }); flame(k, [H.L[0], H.L[1] + 0.08, H.L[2]], 0.6, { rich: true }); });
    }
  });
  return k.done();
}

const BUILDERS = { imp, hellhound, demon, succubus, efreet, nightmare, devil };
const BASE_OF = { familiar: 'imp', cerberus: 'hellhound', horneddemon: 'demon', succubusmistress: 'succubus', efreetsultan: 'efreet', hellcharger: 'nightmare', archdevil: 'devil' };
export const INFERNO_BASE_IDS = Object.keys(BUILDERS);
export const INFERNO_UP_IDS = Object.keys(BASE_OF);
export const INFERNO_IDS = [...INFERNO_BASE_IDS, ...INFERNO_UP_IDS];
// infernoBuild(baseId, upgraded) -> a fresh { body, glow } or null
export function infernoBuild(id, up = false) {
  const f = BUILDERS[id];
  return f ? f(!!up) : null;
}
const cache = new Map();
// infernoModel(id) -> cached { body, glow } for any of the 14 Inferno ids, or null
export function infernoModel(id) {
  if (cache.has(id)) return cache.get(id);
  const m = BUILDERS[id] ? infernoBuild(id, false) : BASE_OF[id] ? infernoBuild(BASE_OF[id], true) : null;
  if (m) cache.set(id, m);
  return m;
}
