import * as THREE from 'three';
import { BONE } from './rig.js?v=1.3';

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


// run fn in a frame whose +y runs along a pole from a toward b (returns the pole length)
function pole(k, a, b, fn) { const L = V3(a).distanceTo(V3(b)); k.with(along(V3(a), V3(b), 0), () => fn(L)); return L; }

// ---------------------------------------------------------------- inferno helpers
// a tapering curved horn: segs are successive offsets from p; the last one is the tip
function horn(k, p, segs, r, col, tip = col) {
  let a = V3(p); const n = segs.length;
  for (let i = 0; i < n; i++) {
    const b = a.clone().add(V3(segs[i]));
    const r0 = r * (1 - (i / n) * 0.8), r1 = i === n - 1 ? 0.004 : r * (1 - ((i + 1) / n) * 0.8);
    const c = i >= n - 1 ? tip : col;
    k.limb(a.toArray(), b.toArray(), r0, r1, c, { seg: 6, grad: [0.9, 1.1] });
    if (i < n - 1) k.ball(r1 * 1.02, b.toArray(), i >= n - 2 ? tip : col, { d: 0 });
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
  });
}
// devil head in its own frame (radius ~0.15 at s = 1): angry V brows, glowing
// eyes and mouth, pointed ears, big horns of a given type
function devilHead(k, c, o) {
  const { skin, brow = RED_D, horn: hc = HORN, tip = hc, type = 'bull', hk = 1, hr = 0.034, ears = true, eye = EYE, mouth = FIRE_O, jaw = skin } = o;
  k.at(c, o.rot ?? [0, 0, 0], o.s ?? 1, () => {
    k.ell(0.15, 0.15, 0.145, [0, 0, 0], skin, { grad: [0.9, 1.08] });
    k.ell(0.122, 0.085, 0.095, [0, -0.07, 0.065], jaw, { grad: [0.9, 1.0] });
    k.ball(0.04, [0, -0.012, 0.15], skin, { d: 0 }); // nose
    k.sym(() => {
      k.box(0.1, 0.038, 0.06, [0.055, 0.05, 0.12], brow, { r: [0, 0.25, 0.42], grad: [1, 1] });
      k.ell(0.032, 0.024, 0.016, [0.056, 0.02, 0.135], eye, { glow: true, d: 0 });
      if (ears) k.cone(0.045, 0.13, [0.13, 0.02, -0.01], skin, { r: [0, 0.3, -1.3], seg: 4 });
      if (type) horn(k, [0.075, 0.1, 0.0], HORNS[type].map((v) => v.map((x) => x * hk)), hr * hk, hc, tip);
    });
    if (mouth) k.ell(0.065, 0.018, 0.02, [0, -0.085, 0.145], mouth, { glow: true, d: 0 });
  });
}
// a leathery bat wing: arm to the wrist, fingers fanning out, a scalloped
// membrane between them (two-sided). Offsets relative to the root sh.
function batWing(k, sh, o) {
  const { W, F, low, col, edge, th = 0.014, pull = 0.32, r = 0.04 } = o;
  const S = V3(sh), Wp = S.clone().add(V3(W)), Fp = F.map((f) => S.clone().add(V3(f))), Lp = S.clone().add(V3(low));
  k.limb(S.toArray(), Wp.toArray(), r, r * 0.8, edge, { seg: 5 });
  k.ball(r * 0.95, Wp.toArray(), edge, { d: 0 });
  Fp.forEach((f, i) => k.limb(Wp.toArray(), f.toArray(), r * (i ? 0.55 : 0.7), 0.008, edge, { seg: 4 }));
  // claw on the wrist
  k.cone(r * 0.7, r * 2.6, Wp.toArray(), o.claw ?? HORN, { r: [0, 0, -0.5], seg: 4 });
  const E = [Fp[0]];
  const pts = [...Fp, Lp];
  for (let i = 1; i < pts.length; i++) {
    const m = pts[i - 1].clone().lerp(pts[i], 0.5).lerp(Wp, pull);
    E.push(m, pts[i]);
  }
  const P = [];
  const tri = (a, b, c) => {
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize().multiplyScalar(th);
    P.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    const [a2, b2, c2] = [a, b, c].map((v) => v.clone().add(n));
    P.push(...a2.toArray(), ...c2.toArray(), ...b2.toArray());
  };
  for (let i = 0; i < E.length - 1; i++) tri(Wp, E[i], E[i + 1]);
  tri(S, Wp, Lp);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  k.add(g, col, { grad: o.grad ?? [0.85, 1.1], noise: 0.02 });
}
// a spade-tipped devil tail on TAIL from root p through offsets
function devilTail(k, p, segs, r, col, tipCol, spade = 1) {
  k.bone(BONE.TAIL, p, () => {
    let a = V3(p);
    segs.forEach((d, i) => { const b = a.clone().add(V3(d)); k.limb(a.toArray(), b.toArray(), r * (1 - i * 0.18), r * (1 - (i + 1) * 0.18), col, { seg: 5 }); a = b; });
    const dir = V3(segs[segs.length - 1]).normalize();
    k.stick(new THREE.OctahedronGeometry(0.07 * spade, 0).scale(1, 1.4, 0.45).translate(0, 0.07 * spade, 0), a.toArray(), a.clone().add(dir).toArray(), tipCol, { roll: Math.PI / 2 });
  });
}
// three claws on a hand pointing along dir
function claws(k, h, col, s = 1) {
  for (let i = -1; i <= 1; i++) k.cone(0.026 * s, 0.1 * s, [h[0] + i * 0.03 * s, h[1] - 0.03 * s, h[2] + 0.04 * s], col, { r: [1.9, i * 0.25, 0], seg: 4 });
}

// ---------------------------------------------------------------- creatures
// Imp: a little red devil with a big head, ivory horns, tiny bat wings, spade
// tail and a big iron pitchfork. Familiar: orange-red, gold horns and collar,
// bigger wings, a gold fork with flaming prongs and a fireball in the off hand.
function imp(U) {
  const k = makeKit(U ? 103 : 101);
  const SK = U ? 0xff6a3a : RED, SK_D = U ? 0xe8503a : RED_D, BELLY = U ? 0xffa060 : RED_L;
  const A = [0.22, 0.03, 0.1], B = [0.34, 1.02, 0.24], P = (t) => A.map((v, i) => v + (B[i] - v) * t);
  const { L } = figure(k, {
    legs: SK_D, boots: HOOF, torso: SK, hips: PLUM, upper: SK, fore: SK, hand: SK_D, armR: 0.06, foreR: 0.055, handR: 0.06,
    rh: P(0.42), lh: U ? [-0.25, 0.56, 0.18] : [-0.25, 0.42, 0.1], head: false, stance: 0.12,
  });
  k.ell(0.16, 0.14, 0.13, [0, 0.5, 0.06], BELLY, { grad: [0.95, 1.05] }); // pot belly
  if (U) k.torus(0.12, 0.03, [0, 0.72, 0], GOLD, { r: [Math.PI / 2, 0, 0], seg: 10, ts: 4, grad: [1, 1] });
  k.bone(BONE.HEAD, [0, 0.7, 0], () => devilHead(k, [0, 0.86, 0.02], {
    skin: SK, brow: SK_D, s: 1.28, type: 'up', hk: U ? 1.35 : 1.05, hr: 0.036, horn: U ? GOLD : HORN, tip: U ? GOLD_L : HORN_D,
  }));
  k.sym(() => k.bone(BONE.WING_R, [0.08, 0.64, -0.1], () => batWing(k, [0.08, 0.64, -0.1], U ? {
    W: [0.15, 0.13, -0.06], F: [[0.36, 0.32, -0.1], [0.4, 0.1, -0.14], [0.28, -0.08, -0.14]], low: [0.02, -0.18, -0.04], col: 0xff7a48, edge: SK_D, r: 0.03,
  } : {
    W: [0.12, 0.1, -0.05], F: [[0.27, 0.24, -0.08], [0.3, 0.06, -0.1], [0.2, -0.07, -0.1]], low: [0.02, -0.15, -0.03], col: 0xf06a4a, edge: SK_D, r: 0.026,
  })));
  devilTail(k, [0, 0.4, -0.1], [[0, -0.1, -0.12], [0, 0.0, -0.14], [0, 0.14, -0.06]], 0.028, SK_D, U ? GOLD : SK_D, 1.1);
  k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (Lp) => {
    k.limb([0, 0, 0], [0, Lp - 0.12, 0], 0.026, 0.024, U ? BRONZE : WOOD, { seg: 5 });
    const M = U ? GOLD : IRON_L;
    k.box(0.26, 0.05, 0.05, [0, Lp - 0.12, 0], M, {});
    for (const x of [-0.11, 0, 0.11]) {
      k.limb([x, Lp - 0.12, 0], [x, Lp + (x ? 0.04 : 0.08), 0], 0.024, 0.02, M, { seg: 4 });
      k.cone(0.034, 0.1, [x, Lp + (x ? 0.03 : 0.07), 0], M, { seg: 4 });
      if (U) flame(k, [x, Lp + (x ? 0.1 : 0.14), 0], 0.42);
    }
  }));
  if (U) k.bone(BONE.ARM_L, SHL, () => { k.ball(0.07, [L[0], L[1] + 0.08, L[2] + 0.02], FIRE_O, { glow: true, d: 1 }); flame(k, [L[0], L[1] + 0.1, L[2] + 0.02], 0.5); });
  return k.done();
}

// Hell Hound: a crimson hound with a plum back, a crest of fire from head to
// rump, glowing eyes and jaws, a flaming tail. Cerberus: three heads (each its
// own HEAD with a neck pivot) in gold spiked collars, bigger fire.
function hound(k, x, z, yaw, s, U, FUR, FUR_D) {
  const base = [x, 0.6, z];
  k.bone(BONE.HEAD, base, () => k.at(base, [0, yaw, 0], s, () => {
    k.limb([0, 0, 0], [0, 0.17, 0.13], 0.1, 0.085, FUR, { seg: 7 });
    if (U) {
      k.torus(0.09, 0.03, [0, 0.07, 0.05], GOLD, { r: [Math.PI / 2 - 0.65, 0, 0], seg: 10, ts: 4, grad: [1, 1] });
      for (const a of [-1, 0, 1]) k.cone(0.022, 0.07, [Math.sin(a) * 0.1, 0.1, 0.05 - Math.cos(a) * 0.08], GOLD_L, { r: [-0.8, 0, -a], seg: 4 });
    }
    const h = [0, 0.2, 0.2];
    k.ell(0.11, 0.105, 0.12, h, FUR, { grad: [0.9, 1.08] });
    k.ell(0.065, 0.05, 0.11, [0, h[1] - 0.005, h[2] + 0.12], FUR, {}); // snout
    k.ell(0.058, 0.03, 0.1, [0, h[1] - 0.07, h[2] + 0.1], FUR_D, { r: [0.35, 0, 0] }); // open jaw
    k.ell(0.05, 0.026, 0.08, [0, h[1] - 0.045, h[2] + 0.11], FIRE_O, { glow: true, d: 0, r: [0.2, 0, 0] }); // fiery maw
    k.ball(0.028, [0, h[1] + 0.015, h[2] + 0.23], PLUM_D, { d: 0 }); // nose
    k.sym(() => {
      k.ell(0.026, 0.02, 0.014, [0.05, h[1] + 0.035, h[2] + 0.1], EYE, { glow: true, d: 0 });
      k.box(0.07, 0.03, 0.05, [0.05, h[1] + 0.065, h[2] + 0.085], FUR_D, { r: [0, 0.2, 0.4] });
      k.cone(0.045, 0.13, [0.06, h[1] + 0.08, h[2] - 0.04], FUR_D, { r: [-0.5, 0, -0.35], seg: 4 });
    });
    flame(k, [0, h[1] + 0.06, h[2] - 0.08], U ? 0.55 : 0.5, { r: [-0.7, 0, 0] });
  }));
}
function hellhound(U) {
  const k = makeKit(U ? 113 : 109, [0, 0.46, -0.05]);
  const FUR = U ? 0xc8402e : 0xbc3a30, FUR_D = PLUM, BELLY = RED_L;
  k.ell(U ? 0.19 : 0.17, 0.16, 0.34, [0, 0.46, -0.05], FUR, { grad: [0.82, 1.08] });
  k.ell(0.13, 0.08, 0.3, [0, 0.56, -0.07], FUR_D, { grad: [0.95, 1.1] }); // plum back
  k.ell(U ? 0.2 : 0.17, 0.19, 0.17, [0, 0.5, 0.2], FUR, {}); // chest
  k.ell(0.12, 0.08, 0.2, [0, 0.36, 0.0], BELLY, { grad: [1, 1] });
  // legs: thighs, shins, plum paws
  for (const [x, z, bn, fr] of [[0.1, 0.22, BONE.LEG_FR, 1], [-0.1, 0.22, BONE.LEG_FL, 1], [0.1, -0.28, BONE.LEG_BR, 0], [-0.1, -0.28, BONE.LEG_BL, 0]]) {
    const xx = x * (U ? 1.12 : 1);
    k.bone(bn, [xx, 0.46, z], () => {
      k.ell(0.075, 0.13, 0.1, [xx, 0.38, z], FUR, {});
      if (fr) k.limb([xx, 0.32, z + 0.01], [xx, 0.05, z + 0.03], 0.055, 0.042, FUR);
      else { k.limb([xx, 0.32, z - 0.02], [xx, 0.17, z - 0.07], 0.058, 0.045, FUR); k.limb([xx, 0.17, z - 0.07], [xx, 0.05, z - 0.03], 0.045, 0.04, FUR); }
      k.ell(0.055, 0.04, 0.075, [xx, 0.035, z + 0.04], FUR_D, { d: 0 });
    });
  }
  // fire crest along the spine
  for (let i = 0; i < 3; i++) flame(k, [0, 0.6 - i * 0.01, 0.08 - i * 0.14], (U ? 0.62 : 0.55) - i * 0.06, { r: [-0.6, 0, 0] });
  // tail with a burning tip
  k.bone(BONE.TAIL, [0, 0.52, -0.36], () => {
    k.limb([0, 0.52, -0.36], [0, 0.6, -0.5], 0.04, 0.03, FUR_D);
    k.limb([0, 0.6, -0.5], [0, 0.72, -0.56], 0.03, 0.022, FUR_D);
    flame(k, [0, 0.74, -0.56], 0.55, { r: [-0.4, 0, 0] });
  });
  if (U) { hound(k, 0, 0.27, 0, 0.92, U, FUR, FUR_D); hound(k, 0.15, 0.22, 0.45, 0.86, U, FUR, FUR_D); hound(k, -0.15, 0.22, -0.45, 0.86, U, FUR, FUR_D); }
  else hound(k, 0, 0.27, 0, 1.1, U, FUR, FUR_D);
  return k.done();
}

// Demon: a big hunched red brute: wide shoulders, huge clawed hands, bull
// horns, plum loincloth, bronze bracers. Horned Demon: huge gold-tipped
// horns, spiked gold pauldrons and belt, a glowing lava sigil on the chest.
function demon(U) {
  const k = makeKit(U ? 127 : 121);
  const SK = U ? 0xe03a30 : RED, SK_D = RED_D;
  let H;
  k.at([0, 0, 0], [0, 0, 0], [1.18, 1, 1.1], () => {
    H = figure(k, {
      legs: SK_D, boots: HOOF, torso: SK, hips: PLUM, upper: SK, fore: U ? GOLD : BRONZE, hand: SK_D, elbow: SK,
      armR: 0.085, foreR: 0.08, handR: 0.078, rh: [0.3, 0.42, 0.17], lh: [-0.3, 0.42, 0.17], head: false, stance: 0.13,
      pauldron: U ? GOLD : SK, pTrim: U ? GOLD_L : null, belt: U ? GOLD : null,
    });
    // pecs and loincloth flap
    k.sym(() => k.ell(0.1, 0.075, 0.06, [0.075, 0.6, 0.11], RED_L, { r: [0, 0.3, 0] }));
    k.bone(BONE.CLOTH, [0, 0.44, 0.1], () => k.box(0.16, 0.2, 0.03, [0, 0.35, 0.12], PLUM_L, { r: [-0.08, 0, 0] }));
    if (U) {
      k.sym(() => { for (let i = 0; i < 2; i++) k.cone(0.035, 0.12, [0.19 + i * 0.05, 0.73, -0.02 + i * 0.02], GOLD_L, { r: [0, 0, -0.5 - i * 0.4], seg: 4 }); });
      k.ell(0.055, 0.075, 0.02, [0, 0.62, 0.155], LAVA, { glow: true, d: 0 });
      k.sym(() => k.box(0.025, 0.09, 0.02, [0.06, 0.6, 0.15], FIRE_O, { glow: true, r: [0, 0.3, 0.6] }));
    }
    k.bone(BONE.ARM_R, SH, () => claws(k, H.R, HORN, 1.25));
    k.bone(BONE.ARM_L, SHL, () => claws(k, H.L, HORN, 1.25));
  });
  devilTail(k, [0, 0.4, -0.12], [[0, -0.12, -0.12], [0, -0.04, -0.16], [0, 0.08, -0.08]], 0.034, SK_D, SK_D, 1.1);
  k.bone(BONE.HEAD, [0, 0.68, 0.02], () => devilHead(k, [0, 0.78, 0.07], {
    skin: SK, brow: SK_D, s: 1.08, type: 'bull', hk: U ? 1.6 : 1.15, hr: U ? 0.04 : 0.036, horn: HORN, tip: U ? GOLD : HORN_D,
  }));
  return k.done();
}

// Succubus: rose-skinned winged temptress in a magenta gown, deep plum hair,
// small swept horns, spade tail, a fire bolt blazing in her raised hand.
// Mistress: crimson-gold gown, gold tiara, bigger gold-boned wings, a fire
// staff crowned with a crescent and a second flame in her other hand.
function succubus(U) {
  const k = makeKit(U ? 137 : 131);
  const SKN = 0xffa08c, GOWN = U ? CRIMSON : 0xd8407e, GOWN_L = U ? 0xff6a7a : 0xf06a9a, HAIR = 0x8a2a6e, TRIM = U ? GOLD : 0xffb0d0;
  const { R, L } = figure(k, {
    robe: true, torso: GOWN, hips: GOWN, upper: SKN, fore: SKN, hand: SKN, belt: TRIM, armR: 0.056, foreR: 0.05, handR: 0.052,
    rh: U ? [0.26, 0.5, 0.12] : [0.24, 0.74, 0.18], lh: [-0.25, 0.48, 0.16], head: false,
  });
  k.bone(BONE.CLOTH, [0, 0.46, 0], () => {
    k.lathe([[0.25, 0.0], [0.235, 0.08], [0.19, 0.26], [0.155, 0.46]], [0, 0, 0], GOWN, { s: [1, 1, 0.86], seg: 10, grad: [0.86, 1.06] });
    k.lathe([[0.258, 0.0], [0.254, U ? 0.07 : 0.05]], [0, 0, 0], TRIM, { s: [1, 1, 0.86], seg: 10, grad: [1, 1] });
  });
  // bare shoulders / neckline
  k.ell(0.16, 0.06, 0.1, [0, 0.7, 0], SKN, {});
  if (U) k.lathe([[0.22, 0.6], [0.21, 0.645]], [0, 0, 0], GOLD, { s: [1, 1, 0.78], seg: 10, grad: [1, 1] });
  k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.155, 0.16, 0.15, [0, HY + 0.02, -0.03], HAIR, { grad: [0.9, 1.15] });
    k.ell(0.14, 0.22, 0.08, [0, HY - 0.12, -0.09], HAIR, {}); // long hair down the back
    k.ell(0.122, 0.13, 0.115, [0, HY - 0.005, 0.03], SKN, { grad: [0.95, 1.05] });
    k.sym(() => {
      k.ell(0.026, 0.024, 0.014, [0.05, HY + 0.005, 0.137], EYE, { glow: true, d: 0 });
      horn(k, [0.07, HY + 0.11, 0.0], HORNS.back.map((v) => v.map((x) => x * (U ? 1.2 : 1.0))), 0.03, U ? GOLD : HORN, U ? GOLD_L : HORN_D);
    });
    k.ell(0.03, 0.014, 0.012, [0, HY - 0.07, 0.137], CRIMSON, { d: 0 });
    if (U) {
      k.lathe([[0.158, HY + 0.05], [0.158, HY + 0.085]], [0, 0, -0.02], GOLD, { seg: 10, grad: [1, 1] });
      k.cone(0.035, 0.1, [0, HY + 0.08, 0.13], GOLD_L, { seg: 4 });
      k.ball(0.026, [0, HY + 0.08, 0.15], FIRE_O, { glow: true, d: 0 });
    }
  });
  k.sym(() => k.bone(BONE.WING_R, [0.07, 0.66, -0.1], () => batWing(k, [0.07, 0.66, -0.1], {
    W: [0.2, 0.2, -0.08], F: U ? [[0.56, 0.48, -0.16], [0.62, 0.2, -0.2], [0.5, -0.08, -0.2], [0.3, -0.24, -0.14]] : [[0.46, 0.4, -0.14], [0.52, 0.16, -0.18], [0.4, -0.08, -0.16]],
    low: [0.02, -0.3, -0.04], col: U ? 0xc23a8a : 0xb84a9a, edge: U ? GOLD : PLUM, r: 0.032,
  })));
  devilTail(k, [0, 0.42, -0.14], [[0, -0.14, -0.1], [0, -0.1, -0.14], [0, 0.04, -0.12]], 0.022, GOWN, TRIM, 1.0);
  if (U) {
    const SX = R[0] + 0.01, SZ = R[2];
    k.bone(BONE.ARM_R, SH, () => {
      k.limb([SX, 0.03, SZ], [SX, 0.9, SZ], 0.024, 0.022, PLUM_L, { seg: 5 });
      k.cyl(0.036, 0.04, 0.06, [SX, 0.86, SZ], GOLD, { seg: 6 });
      k.torus(0.09, 0.022, [SX, 1.0, SZ], GOLD, { seg: 12, arc: Math.PI * 1.4, r: [0, 0, -0.95 * Math.PI + 0.2] });
      k.ball(0.07, [SX, 1.0, SZ], FIRE_O, { glow: true, d: 1 });
      flame(k, [SX, 1.02, SZ], 0.5);
    });
    k.bone(BONE.ARM_L, SHL, () => flame(k, [L[0], L[1] + 0.04, L[2] + 0.03], 0.5));
  } else {
    k.bone(BONE.ARM_R, SH, () => { k.ball(0.075, [R[0], R[1] + 0.07, R[2] + 0.02], FIRE_O, { glow: true, d: 1 }); flame(k, [R[0], R[1] + 0.08, R[2] + 0.02], 0.62); });
  }
  return k.done();
}

// Efreet: a muscular orange fire genie: bald horned head, pointed ears, gold
// armbands and sash, fists of fire, a lower body that dissolves into a curling
// flame tail (TAIL). Sultan: gold turban with a ruby, gold pauldrons, a big
// flaming scimitar, bigger yellow-gold flames.
function efreet(U) {
  const k = makeKit(U ? 149 : 139, [0, 0.46, 0]);
  const SK = U ? 0xffa040 : 0xff8436, SK_L = U ? 0xffc870 : 0xffaa5c, SK_D = U ? 0xf07a32 : 0xe8602e;
  const FC = U ? [ORANGE, 0xffc040, 0xfff2a0] : [FIRE_R, FIRE_O, FIRE_Y];
  const { R, L } = figure(k, {
    robe: true, torso: SK, hips: GOLD, upper: SK, fore: SK, hand: SK_D, belt: U ? GOLD : BRONZE, armR: 0.08, foreR: 0.074, handR: 0.07,
    rh: U ? [0.3, 0.6, 0.18] : [0.29, 0.74, 0.14], lh: [-0.29, 0.74, 0.14], head: false, pauldron: U ? GOLD : SK_L, pTrim: U ? GOLD_L : null,
  });
  k.at([0, 0, 0], [0, 0, 0], [1.12, 1, 1], () => k.sym(() => k.ell(0.1, 0.08, 0.06, [0.075, 0.6, 0.105], SK_L, { r: [0, 0.3, 0] })));
  // bracers
  k.bone(BONE.ARM_R, SH, () => k.ball(0.075, [R[0], R[1] - 0.06, R[2] - 0.03], U ? GOLD : BRONZE, { d: 1 }));
  k.bone(BONE.ARM_L, SHL, () => k.ball(0.075, [L[0], L[1] - 0.06, L[2] - 0.03], U ? GOLD : BRONZE, { d: 1 }));
  // flame lower body: tapering curl of orange-red flesh wrapped in fire
  k.bone(BONE.TAIL, [0, 0.44, 0], () => {
    k.limb([0, 0.46, 0], [0, 0.3, -0.03], 0.15, 0.125, SK_D, { seg: 8 });
    k.limb([0, 0.3, -0.03], [0.03, 0.16, -0.1], 0.125, 0.08, RED_L, { seg: 7 });
    k.limb([0.03, 0.16, -0.1], [0.08, 0.06, -0.2], 0.08, 0.035, RED, { seg: 6 });
    k.ball(0.125, [0, 0.3, -0.03], SK_D, { d: 1 });
    k.ball(0.08, [0.03, 0.16, -0.1], RED_L, { d: 0 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      flame(k, [Math.sin(a) * 0.11, 0.28, Math.cos(a) * 0.09 - 0.03], U ? 0.68 : 0.6, { r: [-Math.cos(a) * 0.5 - 0.3, 0, Math.sin(a) * 0.6], cols: FC });
    }
    flame(k, [0.04, 0.12, -0.08], 0.55, { r: [-1.2, 0, 0.3], cols: FC });
    flame(k, [0.09, 0.05, -0.2], 0.45, { r: [-1.6, 0, 0.2], cols: FC });
  });
  // head
  k.bone(BONE.HEAD, NECK, () => {
    devilHead(k, [0, HY + 0.01, 0.02], { skin: SK, brow: SK_D, s: 0.95, type: U ? null : 'up', hk: 0.9, hr: 0.034, horn: HORN, tip: HORN_D, mouth: FIRE_Y });
    if (U) { // turban
      k.ell(0.165, 0.11, 0.16, [0, HY + 0.1, 0.0], GOLD, { grad: [0.9, 1.12] });
      k.ell(0.13, 0.08, 0.13, [0, HY + 0.18, -0.01], 0xfff0c8, {});
      k.ball(0.04, [0, HY + 0.12, 0.155], CRIMSON, { glow: true, d: 0 });
      flame(k, [0, HY + 0.22, -0.02], 0.55, { cols: FC });
    } else {
      flame(k, [0, HY + 0.12, -0.03], 0.62, { cols: FC });
      k.ell(0.05, 0.05, 0.035, [0, HY - 0.13, 0.12], SK_D, {}); // goatee
    }
  });
  if (U) {
    // flaming scimitar in the weapon hand
    k.bone(BONE.ARM_R, SH, () => k.at(R, [0.5, 0, -0.25], 1.3, () => {
      k.box(0.18, 0.035, 0.05, [0, 0.03, 0], GOLD, {});
      k.limb([0, -0.08, 0], [0, 0.02, 0], 0.022, 0.022, CRIMSON, { seg: 5 });
      const bl = [[-0.04, 0], [0.04, 0], [0.08, 0.22], [0.06, 0.42], [-0.06, 0.56], [-0.01, 0.38], [-0.04, 0.2]];
      k.plate(bl.map(([x, y]) => [x * 1.35, y * 1.1 - 0.01]), 0.016, [0, 0.05, 0], FIRE_O, { glow: true, r: [0, 0.3, 0] });
      k.plate(bl, 0.032, [0, 0.05, 0], IRON_L, { r: [0, 0.3, 0], grad: [0.9, 1.2] });
    }));
    k.bone(BONE.ARM_L, SHL, () => { k.ball(0.07, [L[0], L[1] + 0.05, L[2]], 0xffc040, { glow: true, d: 1 }); flame(k, [L[0], L[1] + 0.07, L[2]], 0.55, { cols: FC }); });
  } else {
    k.bone(BONE.ARM_R, SH, () => { k.ball(0.07, [R[0], R[1] + 0.03, R[2]], FIRE_O, { glow: true, d: 1 }); flame(k, [R[0], R[1] + 0.06, R[2]], 0.55, { cols: FC }); });
    k.bone(BONE.ARM_L, SHL, () => { k.ball(0.07, [L[0], L[1] + 0.03, L[2]], FIRE_O, { glow: true, d: 1 }); flame(k, [L[0], L[1] + 0.06, L[2]], 0.55, { cols: FC }); });
  }
  return k.done();
}

// Nightmare: a plum-charcoal horse with a blazing mane and tail, burning hooves
// and glowing eyes. Hell Charger: crimson barding with a gold hem, a gold
// horned chanfron and spiked collar, taller yellow-white fire.
function nightmare(U) {
  const k = makeKit(U ? 163 : 157, [0, 0.64, -0.03]);
  const HORSE = 0x6e4870, HORSE_D = 0x5c3c60, HORSE_L = 0x8e6290;
  const FC = U ? [ORANGE, 0xffc040, 0xfff4b0] : [FIRE_R, FIRE_O, FIRE_Y];
  k.ell(0.2, 0.2, 0.4, [0, 0.64, -0.03], HORSE, { grad: [0.8, 1.12] });
  k.ell(0.18, 0.21, 0.18, [0, 0.68, 0.24], HORSE, { grad: [0.85, 1.1] });
  const legsAt = [[0.1, 0.3, 0.12, BONE.LEG_FR], [-0.1, 0.24, -0.04, BONE.LEG_FL], [0.1, -0.3, -0.06, BONE.LEG_BR], [-0.1, -0.28, 0.06, BONE.LEG_BL]];
  for (const [x, z, sw, bn] of legsAt) k.bone(bn, [x, 0.6, z], () => {
    k.limb([x, 0.6, z], [x, 0.33, z + sw * 0.5], 0.085, 0.058, HORSE, { seg: 6 });
    k.limb([x, 0.33, z + sw * 0.5], [x, 0.08, z + sw], 0.052, 0.046, HORSE_D, { seg: 5 });
    k.cyl(0.06, 0.054, 0.08, [x, 0.0, z + sw], HOOF, { seg: 6, ao: false });
    k.lathe([[0.075, 0.06], [0.055, 0.17], [0.0, 0.24]], [x, 0, z + sw], FC[0], { glow: true, seg: 6 });
    k.cone(0.045, 0.2, [x, 0.06, z + sw + 0.02], FC[1], { glow: true, seg: 4, r: [-0.4, 0, 0] });
  });
  k.bone(BONE.HEAD, [0, 0.76, 0.3], () => {
    k.limb([0, 0.74, 0.3], [0, 1.0, 0.47], 0.125, 0.092, HORSE, { seg: 7 });
    k.at([0, 1.02, 0.52], [0.95, 0, 0], 1, () => {
      k.ell(0.085, 0.092, 0.19, [0, 0, 0.09], HORSE_L, {});
      k.ell(0.074, 0.076, 0.08, [0, -0.015, 0.24], HORSE, {});
      k.sym(() => {
        k.ell(0.026, 0.03, 0.02, [0.07, 0.035, 0.07], EYE, { glow: true, d: 0, r: [0, 0.5, 0] });
        k.ball(0.022, [0.035, 0.0, 0.3], FIRE_O, { glow: true, d: 0 });
        k.cone(0.032, 0.11, [0.05, 0.06, -0.04], HORSE_D, { r: [-0.5, 0, 0.25], seg: 4 });
      });
      if (U) {
        k.ell(0.066, 0.045, 0.17, [0, 0.06, 0.1], GOLD, { grad: [0.85, 1.12] });
        k.sym(() => horn(k, [0.04, 0.08, 0.0], [[0.05, 0.08, -0.05], [0.03, 0.06, -0.09], [0.0, 0.03, -0.09]], 0.026, GOLD, GOLD_L));
      }
    });
    // burning mane along the neck
    for (let i = 0; i < 4; i++) flame(k, [0, 0.86 + i * 0.07, 0.25 + i * 0.065], (U ? 0.7 : 0.62) - i * 0.04, { r: [-0.9, 0, 0], cols: FC });
    if (U) { // spiked collar
      k.torus(0.13, 0.035, [0, 0.8, 0.34], GOLD, { r: [Math.PI / 2 - 0.6, 0, 0], seg: 12, ts: 4, grad: [1, 1] });
      for (const a of [-1.2, 0, 1.2]) k.cone(0.03, 0.09, [Math.sin(a) * 0.14, 0.82, 0.34 + Math.cos(a) * 0.08], GOLD_L, { r: [0.3, 0, -a], seg: 4 });
    }
  });
  k.bone(BONE.TAIL, [0, 0.72, -0.42], () => {
    k.limb([0, 0.72, -0.42], [0, 0.6, -0.52], 0.06, 0.045, HORSE_D);
    flame(k, [0, 0.66, -0.5], U ? 0.9 : 0.8, { r: [-1.9, 0, 0], cols: FC });
    flame(k, [0, 0.55, -0.55], U ? 0.7 : 0.62, { r: [-2.5, 0, 0.2], cols: FC });
  });
  if (U) {
    k.lathe([[0.226, 0.4], [0.216, 0.5], [0.2, 0.66], [0.16, 0.78], [0.06, 0.84]], [0, 0, -0.04], CRIMSON, { s: [1, 1, 2.0], seg: 10, grad: [0.84, 1.08] });
    k.lathe([[0.234, 0.37], [0.229, 0.43]], [0, 0, -0.04], GOLD, { s: [1, 1, 2.0], seg: 10, grad: [1, 1] });
    k.sym(() => k.ell(0.02, 0.07, 0.07, [0.222, 0.58, -0.08], LAVA, { glow: true, d: 0 }));
  } else {
    k.ell(0.14, 0.03, 0.2, [0, 0.83, -0.06], RED_D, { grad: [1, 1] }); // a crimson saddle-blanket accent
  }
  return k.done();
}

// Pit Lord: a huge red devil with ram horns, plum loincloth, big bat wings, a
// lava-edged great axe and a burning whip. Arch Devil: deep crimson, gold
// crown and spiked pauldrons, giant gold-boned wings, a flaming gold trident.
function devil(U) {
  const S = 1.42;
  const k = makeKit(U ? 181 : 173, HIPS.map((v) => v * S));
  const SK = U ? CRIMSON : RED, SK_D = U ? 0xb02438 : RED_D;
  let H;
  k.at([0, 0, 0], [0, 0, 0], S, () => {
    H = figure(k, {
      legs: SK_D, boots: HOOF, torso: SK, hips: PLUM, upper: SK, fore: SK, hand: SK_D, elbow: SK,
      armR: 0.08, foreR: 0.074, handR: 0.07, rh: [0.27, 0.46, 0.2], lh: [-0.27, 0.44, 0.16], head: false, stance: 0.12,
      pauldron: U ? GOLD : SK, pTrim: U ? GOLD_L : null, belt: U ? GOLD : BRONZE,
    });
    k.sym(() => k.ell(0.1, 0.075, 0.06, [0.075, 0.6, 0.11], RED_L, { r: [0, 0.3, 0] }));
    k.bone(BONE.CLOTH, [0, 0.44, 0.1], () => k.box(0.17, 0.22, 0.03, [0, 0.34, 0.12], U ? GOLD : PLUM_L, { r: [-0.08, 0, 0] }));
    k.ball(0.035, [0, 0.47, 0.165], LAVA, { glow: true, d: 0 });
    if (U) k.sym(() => { for (let i = 0; i < 3; i++) k.cone(0.03, 0.13 - i * 0.02, [0.15 + i * 0.05, 0.74 - i * 0.02, 0], GOLD_L, { r: [0, 0, -0.3 - i * 0.35], seg: 4 }); });
    k.bone(BONE.HEAD, NECK, () => {
      devilHead(k, [0, HY + 0.01, 0.03], { skin: SK, brow: SK_D, s: 1.02, type: 'ram', hk: U ? 1.25 : 1.15, hr: 0.042, horn: U ? HORN : HORN, tip: U ? GOLD : HORN_D });
      k.cone(0.04, 0.1, [0, HY - 0.1, 0.12], SK_D, { r: [Math.PI + 0.4, 0, 0], seg: 4 }); // goatee
      if (U) {
        k.lathe([[0.13, HY + 0.08], [0.14, HY + 0.13]], [0, 0, 0.0], GOLD, { seg: 10, grad: [1, 1] });
        for (let i = 0; i < 5; i++) { const a = ((i - 2) / 5) * Math.PI * 1.1; k.cone(0.026, 0.08, [Math.sin(a) * 0.135, HY + 0.12, Math.cos(a) * 0.135], GOLD_L, { seg: 4 }); }
        k.ball(0.025, [0, HY + 0.11, 0.14], FIRE_O, { glow: true, d: 0 });
      }
    });
    k.sym(() => k.bone(BONE.WING_R, [0.09, 0.66, -0.12], () => batWing(k, [0.09, 0.66, -0.12], {
      W: [0.24, 0.24, -0.1], F: U ? [[0.66, 0.58, -0.22], [0.76, 0.24, -0.26], [0.62, -0.1, -0.26], [0.38, -0.3, -0.2]] : [[0.56, 0.5, -0.2], [0.64, 0.2, -0.24], [0.52, -0.1, -0.24], [0.32, -0.28, -0.18]],
      low: [0.02, -0.34, -0.04], col: U ? 0xc02a48 : 0xb83048, edge: U ? GOLD : PLUM, r: 0.04,
    })));
    devilTail(k, [0, 0.4, -0.12], [[0, -0.14, -0.12], [0, -0.06, -0.16], [0, 0.08, -0.1]], 0.032, SK_D, U ? GOLD : SK_D, 1.2);
    if (!U) {
      // great axe: dark iron haft, steel crescent blade with a lava edge
      const A = [0.25, 0.04, 0.12], B = [0.38, 1.0, 0.28];
      k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (Lp) => {
        k.limb([0, 0, 0], [0, Lp, 0], 0.03, 0.028, PLUM_L, { seg: 6 });
        k.cone(0.04, 0.12, [0, Lp, 0], IRON_L, { seg: 4 });
        const ax = [[0, -0.02], [0.12, -0.08], [0.24, -0.16], [0.3, 0.02], [0.3, 0.2], [0.24, 0.36], [0.12, 0.28], [0, 0.22]];
        k.at([0.02, Lp - 0.32, 0], [0, 0, 0], 1, () => {
          k.plate(ax.map(([x, y]) => [(x - 0.15) * 1.14 + 0.15, (y - 0.1) * 1.12 + 0.1]), 0.018, [0, 0, 0], FIRE_O, { glow: true });
          k.plate(ax, 0.04, [0, 0, 0], IRON_L, { grad: [0.85, 1.15] });
        });
      }));
      // burning whip coiled from the off hand to the ground
      k.bone(BONE.ARM_L, SHL, () => {
        const h = H.L, pts = [h, [h[0] - 0.08, h[1] - 0.14, h[2] + 0.12], [h[0] - 0.02, h[1] - 0.28, h[2] + 0.24], [h[0] - 0.14, h[1] - 0.38, h[2] + 0.3], [h[0] - 0.22, h[1] - 0.34, h[2] + 0.16]];
        k.limb(h, [h[0], h[1] - 0.1, h[2]], 0.03, 0.03, PLUM_L, { seg: 5 });
        for (let i = 0; i < pts.length - 1; i++) k.limb(pts[i], pts[i + 1], 0.032 - i * 0.004, 0.028 - i * 0.004, i % 2 ? FIRE_O : FIRE_Y, { glow: true, seg: 5 });
        flame(k, pts[2], 0.4); flame(k, pts[4], 0.4);
      });
    } else {
      // gold trident with flaming prongs
      const A = [0.25, 0.04, 0.12], B = [0.34, 1.12, 0.26];
      k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (Lp) => {
        k.limb([0, 0, 0], [0, Lp - 0.14, 0], 0.03, 0.028, GOLD, { seg: 6, grad: [0.9, 1.12] });
        k.torus(0.12, 0.032, [0, Lp - 0.12, 0], GOLD, { arc: Math.PI, r: [0, 0, Math.PI], seg: 10, ts: 4 });
        for (const x of [-0.12, 0, 0.12]) {
          k.limb([x, Lp - 0.12 + (x ? 0 : -0.12), 0], [x, Lp + (x ? 0.04 : 0.1), 0], 0.026, 0.022, GOLD_L, { seg: 4 });
          k.cone(0.04, 0.11, [x, Lp + (x ? 0.03 : 0.09), 0], GOLD_L, { seg: 4 });
          flame(k, [x, Lp + (x ? 0.11 : 0.17), 0], 0.42);
        }
        k.ball(0.045, [0, Lp - 0.12, 0.02], FIRE_O, { glow: true, d: 0 });
      }));
      k.bone(BONE.ARM_L, SHL, () => { k.ball(0.07, [H.L[0], H.L[1] + 0.06, H.L[2]], FIRE_O, { glow: true, d: 1 }); flame(k, [H.L[0], H.L[1] + 0.08, H.L[2]], 0.6); });
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
