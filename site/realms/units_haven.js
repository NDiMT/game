import * as THREE from 'three';
import { BONE } from './rig.js?v=1.8';

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
      const tc = ng.userData.tc ?? null;
      ng.applyMatrix4(k.M);
      if (k.M.determinant() < 0) flip(ng);
      const pr = { tc, bone: rig.b, pivot: rig.p, col: new THREE.Color(col), grad: o.grad ?? [0.9, 1.06], glow: !!o.glow, ao: o.ao ?? true, noise: o.noise ?? 0.025, top: o.top };
      parts.push({ g: ng, ...pr });
      // two-sided sheet (capes, pennants): add a back face, nudged inward a hair
      if (o.both) { const bg = ng.clone(); flip(bg); parts.push({ g: bg, ...pr }); }
    },
    // geometry primitives, all placed at p with euler r and scale s
    box(w, h, d, p, col, o = {}) { k.add(paint(new THREE.BoxGeometry(w, h, d), o).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    // d 0: a 20-face icosahedron for small knobs; d 1 / 2: smooth uv spheres (round 7: sculpted, not boxy)
    ell(rx, ry, rz, p, col, o = {}) {
      const d = o.d ?? (Math.max(rx, ry, rz) < 0.035 ? 0.5 : 1);
      const g = d === -1 ? new THREE.OctahedronGeometry(1, 0) : d === 0 ? new THREE.IcosahedronGeometry(1, 0) : d === 0.5 ? new THREE.SphereGeometry(1, 6, 4) : new THREE.SphereGeometry(1, d === 1 ? 9 : 12, d === 1 ? 6 : 9);
      k.add(paint(g, o, [rx, ry, rz]).applyMatrix4(mat(p, o.r)), col, o);
    },
    ball(r, p, col, o = {}) { k.ell(r, r, r, p, col, o); },
    lathe(prof, p, col, o = {}) {
      const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segUp(o.seg ?? 8, 8, 2), o.phi ?? 0, o.len ?? Math.PI * 2);
      k.add(paint(g, o).applyMatrix4(mat(p, o.r, o.s)), col, o);
    },
    cyl(r1, r2, h, p, col, o = {}) { k.add(paint(new THREE.CylinderGeometry(r2, r1, h, segUp(o.seg ?? 8, 6, 2), 1, !!o.open).translate(0, h / 2, 0), o).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    cone(r, h, p, col, o = {}) { k.add(new THREE.ConeGeometry(r, h, o.seg ?? 6).translate(0, h / 2, 0).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    torus(R, t, p, col, o = {}) { k.add(new THREE.TorusGeometry(R, t, o.ts ?? 4, o.seg ?? 16, o.arc ?? Math.PI * 2).applyMatrix4(mat(p, o.r, o.s)), col, o); },
    // a tapered rod from a to b
    limb(a, b, r1, r2, col, o = {}) {
      const va = V3(a), vb = V3(b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r2, r1, len, segUp(o.seg ?? 6, 5, 2), o.hs ?? 1, !!o.open).translate(0, len / 2, 0);
      if (o.sz) g.scale(1, 1, o.sz);
      k.add(paint(g, o, null, len).applyMatrix4(along(va, vb, o.roll ?? 0)), col, o);
    },
    // any geometry built along +y (0..len), stretched from a to b
    stick(g, a, b, col, o = {}) { k.add(g.applyMatrix4(along(V3(a), V3(b), o.roll ?? 0)), col, o); },
    // a feather: a flat tapered blade from a to b, w wide
    feather(a, b, w, col, o = {}) {
      const len = V3(a).distanceTo(V3(b)), t = o.t ?? 0.014;
      const s = new THREE.Shape();
      s.moveTo(-w * 0.35, 0); s.lineTo(w * 0.35, 0); s.lineTo(w * 0.5, len * 0.55); s.lineTo(w * 0.2, len); s.lineTo(-w * 0.3, len * 0.9); s.lineTo(-w * 0.5, len * 0.5);
      const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2);
      k.add(paint(g, o, null, len).applyMatrix4(along(V3(a), V3(b), o.roll ?? 0)), col, o);
    },
    // a flat extruded outline in the xy plane (shield, blade, pennant)
    plate(pts, depth, p, col, o = {}) {
      const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -depth / 2);
      k.add(paint(g, o).applyMatrix4(mat(p, o.r, o.s)), col, o);
    },
    done() { return finish(parts, seed); },
  };
  return k;
}
// round 7: curved primitives get more radial segments (only the ones that were already round)
const segUp = (n, min, add) => (n >= min ? n + add : n);
// per-triangle paint in the primitive's local frame: o.paint(x, y, z, len) -> colour | null
// (bands, scales, feather rows, embroidery). sc rescales a unit primitive first.
function paint(g, o, sc = null, len = 1) {
  if (sc) g.scale(sc[0], sc[1], sc[2]);
  if (!o.paint) return g;
  const ng = g.index ? g.toNonIndexed() : g, P = ng.attributes.position.array, tc = [];
  for (let i = 0; i < P.length; i += 9) {
    const c = o.paint((P[i] + P[i + 3] + P[i + 6]) / 3, (P[i + 1] + P[i + 4] + P[i + 7]) / 3, (P[i + 2] + P[i + 5] + P[i + 8]) / 3, len);
    tc.push(c == null ? null : new THREE.Color(c));
  }
  ng.userData.tc = tc;
  return ng;
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
      if (pt.tc && pt.tc[(i / 9) | 0]) c = pt.tc[(i / 9) | 0];
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
  // round 7: a flared cuff (gauntlet / bracer / sleeve) at the wrist and a rounder hand
  if (c.cuff) { const W = E.clone().lerp(Hh, 0.72); k.limb(W.toArray(), E.clone().lerp(Hh, 0.93).toArray(), c.r2 * 1.08, c.r2 * 1.32, c.cuff, { seg: 8, grad: [0.9, 1.1] }); }
  k.ell(c.hr, c.hr * 0.95, c.hr * 1.05, Hh.toArray(), c.hand, { d: 1 });
  return Hh.toArray();
}

function eyes(k, y = HY + 0.005, z = 0.128, col = INK) {
  k.sym(() => k.ell(0.025, 0.031, 0.014, [0.05, y, z], col, { d: 0, grad: [1, 1], ao: false }));
}

// ---------------------------------------------------------------- round 7 detail kit
const IRIS = 0x3a64c8, BROW = 0x8a5228, LIP = 0xd0605a, EYEW = 0xfffdf6, BLUSH = 0xf6a088;
// A face on an ellipsoid head (centre c, radii r): eye whites, big irises with a
// catch-light, brows, a nose and a mouth. Everything sits on the head's surface.
function face(k, c, r, o = {}) {
  const s = r[0] / HR, S = (x, y, dz = 0) => {
    const u = x / r[0], v = (y - c[1]) / r[1];
    return [x, y, c[2] + r[2] * Math.sqrt(Math.max(0.02, 1 - u * u - v * v)) + dz];
  };
  const ey = c[1] + (o.ey ?? 0.005) * s, ex = (o.ex ?? 0.05) * s;
  k.sym(() => {
    k.ell(0.03 * s, 0.034 * s, 0.012 * s, S(ex, ey, -0.006 * s), o.white ?? EYEW, { grad: [1, 1], ao: false, noise: 0, r: [0, 0.35, 0] });
    k.ell(0.02 * s, 0.026 * s, 0.01 * s, S(ex - 0.004 * s, ey - 0.002 * s, 0.002 * s), o.iris ?? IRIS, { d: 0.5, grad: [0.75, 1.1], ao: false, noise: 0, r: [0, 0.35, 0] });
    k.ell(0.011 * s, 0.014 * s, 0.006 * s, S(ex - 0.004 * s, ey - 0.003 * s, 0.009 * s), INK, { d: 0, grad: [1, 1], ao: false, noise: 0 });
    k.ball(0.0065 * s, S(ex + 0.004 * s, ey + 0.009 * s, 0.013 * s), 0xffffff, { d: 0, grad: [1, 1], ao: false, noise: 0 });
    if (o.brow !== false) k.box(0.058 * s, 0.015 * s, 0.018 * s, S(ex - 0.002 * s, ey + 0.044 * s, -0.002 * s), o.brow ?? BROW, { r: [0, 0.35, o.browA ?? 0.12], grad: [1, 1], ao: false });
    if (o.blush) k.ell(0.022 * s, 0.012 * s, 0.006 * s, S(ex + 0.022 * s, ey - 0.042 * s, -0.001), BLUSH, { d: 0, grad: [1, 1], ao: false, noise: 0 });
  });
  if (o.nose !== false) k.ell(0.02 * s, 0.026 * s, 0.022 * s, S(0, ey - 0.03 * s, -0.008 * s), o.skin ?? SKIN, { d: 0.5, grad: [0.92, 1.05] });
  if (o.mouth !== false) k.ell(0.026 * s, 0.009 * s, 0.008 * s, S(0, ey - 0.068 * s, -0.002 * s), o.lip ?? LIP, { d: 0, grad: [1, 1], ao: false });
}
// a ring of rivet studs (a torus-like row of knobs) around +y at radius R, height y
function rivets(k, n, R, y, col, o = {}) {
  const a0 = o.a0 ?? 0, arc = o.arc ?? Math.PI * 2, sz = o.sz ?? 1, rr = o.rr ?? 0.011;
  for (let i = 0; i < n; i++) { const a = a0 + (arc * (i + (arc < 6.2 ? 0.5 : 0))) / n; k.ball(rr, [Math.sin(a) * R, y, Math.cos(a) * R * sz], col, { d: -1, grad: [1, 1.1], ao: false }); }
}
// a belt (band around the waist) with a big square buckle at the front
function belt(k, y, r, h, col, buckle = GOLD, sz = 0.8) {
  k.lathe([[r, y - h / 2], [r + 0.004, y + h / 2]], [0, 0, 0], col, { s: [1, 1, sz], seg: 10, grad: [0.9, 1.05] });
  const z = r * sz + 0.006;
  k.box(0.07, h + 0.022, 0.016, [0, y, z], buckle, { grad: [0.95, 1.12], ao: false });
  k.box(0.036, h - 0.006, 0.02, [0, y, z + 0.002], col, { grad: [0.8, 0.9], ao: false });
  k.box(0.012, h - 0.004, 0.024, [0.008, y, z + 0.003], buckle, { grad: [1, 1], ao: false });
}
// hanging locks of hair / fur / beard: tapered cones from root points toward dir
function locks(k, roots, len, r, col, dir = [0, -1, 0], o = {}) {
  roots.forEach((p, i) => {
    const L = len * (o.var ? 1 + Math.sin(i * 2.7) * o.var : 1), d = V3(dir).normalize();
    const tip = V3(p).add(d.multiplyScalar(L)).add(new THREE.Vector3(o.curl ? Math.sin(i * 1.9) * o.curl : 0, 0, o.out ?? 0)).toArray();
    k.stick(new THREE.ConeGeometry(r, L, o.seg ?? 4).rotateX(Math.PI).translate(0, L / 2, 0), p, tip, i % 2 && o.alt ? o.alt : col, { grad: o.grad ?? [0.85, 1.1] });
  });
}
// a stripe band painter for o.paint: alternating colour every `per` along axis (0 x, 1 y, 2 z)
const stripes = (per, c2, axis = 1, duty = 0.5, off = 0) => (x, y, z) => { const v = [x, y, z][axis] / per + off; return v - Math.floor(v) < duty ? c2 : null; };

// Standing (or seated) figure ~0.95 tall to the crown. Returns hand positions.
function figure(k, o) {
  const legs = o.legs, boots = o.boots ?? LEATHER;
  // rig: standing legs LEG_FR (+x) / LEG_FL from the hip; a seated rider's legs
  // stay on the bone the caller set (RIDER); head on HEAD from the neck
  if (!o.robe) k.sym(() => k.bone(o.sit ? null : BONE.LEG_FR, [0.085, 0.42, 0], () => {
    if (o.sit) {
      k.limb([0.09, 0.4, 0], [0.16, 0.37, 0.19], 0.078, 0.066, legs);
      k.limb([0.16, 0.37, 0.19], [0.18, 0.15, 0.13], 0.062, 0.054, legs);
      k.ell(0.068, 0.062, 0.105, [0.18, 0.12, 0.17], boots, { d: 1 });
      k.cyl(0.064, 0.07, 0.03, [0.175, 0.17, 0.155], o.cuffB ?? boots, { seg: 8, grad: [1.05, 1.12] });
    } else {
      const st = o.stance ?? 0.1;
      k.limb([0.085, 0.42, 0], [st, 0.21, 0.02], 0.08, 0.068, legs);
      k.limb([st, 0.21, 0.02], [st, 0.08, 0.01], 0.066, 0.06, legs);
      if (o.knee) k.ball(0.072, [st, 0.215, 0.03], o.knee, { d: 0 });
      k.ell(0.076, 0.072, 0.118, [st, 0.06, 0.035], boots, { d: 1 });
      // sole, turned-down cuff and a toe cap: the boot reads as a boot up close
      k.ell(0.08, 0.022, 0.122, [st, 0.018, 0.037], o.sole ?? 0x7a5236, { d: 1, grad: [0.95, 1], ao: false });
      k.cyl(0.068, 0.074, 0.034, [st, 0.1, 0.012], o.cuffB ?? boots, { seg: 8, grad: [1.04, 1.14] });
      if (o.toe) k.ell(0.05, 0.03, 0.05, [st, 0.06, 0.11], o.toe, { d: 1, grad: [0.95, 1.12] });
    }
  }));
  k.ell(0.155, 0.085, 0.115, [0, 0.43, 0], o.hips ?? legs);
  k.lathe([[0.135, 0.4], [0.155, 0.48], [0.185, 0.56], [0.205, 0.63], [0.19, 0.69], [0.12, 0.73], [0.03, 0.745]], [0, 0, 0], o.torso, { s: [1, 1, 0.76], seg: 10, grad: o.torsoGrad ?? [0.82, 1.1] });
  if (o.belt) k.lathe([[0.158, 0.44], [0.162, 0.495]], [0, 0, 0], o.belt, { s: [1, 1, 0.8], seg: 10, grad: [1, 1] });
  if (o.head !== false) k.bone(BONE.HEAD, NECK, () => {
    k.ell(HR, HR * 1.02, HR * 0.98, [0, HY, 0.01], o.skin ?? SKIN, { d: 2, grad: [0.95, 1.05] });
    if (o.eyes !== false) face(k, [0, HY, 0.01], [HR, HR * 1.02, HR * 0.98], o.face ?? {});
    k.sym(() => k.ell(0.026, 0.04, 0.03, [0.132, HY - 0.005, 0.0], o.skin ?? SKIN, { d: 1 })); // ears
  });
  if (o.pauldron) k.sym(() => {
    k.ell(0.118, 0.088, 0.118, [0.2, 0.675, 0], o.pauldron, { r: [0, 0, -0.38], grad: [0.85, 1.12] });
    if (o.pTrim) k.torus(0.105, 0.024, [0.205, 0.652, 0], o.pTrim, { r: [Math.PI / 2, 0, -0.38], seg: 12, ts: 4, grad: [1, 1] });
    // round 7: a second lame under the cop and a rivet on top (layered plates)
    if (o.lame !== false) k.ell(0.1, 0.05, 0.106, [0.232, 0.6, 0], o.lame ?? o.pauldron, { r: [0, 0, -0.55], grad: [0.82, 1.05] });
    k.ball(0.016, [0.215, 0.755, 0.02], o.pTrim ?? STEEL_L, { d: 0, ao: false });
  });
  const ac = { cuff: o.cuff, upper: o.upper ?? o.torso, fore: o.fore ?? o.upper ?? o.torso, hand: o.hand ?? SKIN, elbow: o.elbow, r1: o.armR ?? 0.064, r2: o.foreR ?? 0.056, hr: o.handR ?? 0.058 };
  let R; k.bone(BONE.ARM_R, SH, () => { R = arm(k, SH, o.rh ?? [0.24, 0.36, 0.06], ac); });
  const lh = o.lh ?? [-0.24, 0.36, 0.06];
  let Lm; k.with(new THREE.Matrix4().makeScale(-1, 1, 1), () => k.bone(BONE.ARM_L, SH, () => { Lm = arm(k, SH, [-lh[0], lh[1], lh[2]], ac); }));
  return { R, L: [-Lm[0], Lm[1], Lm[2]] };
}

// big heater shield in the xy plane, face toward +z; the back keeps the field colour
function shield(k, p, r, sc, field, rim, emblem, emb = rim, o = {}) {
  const O = [[-0.2, 0.22], [0.2, 0.22], [0.2, 0.04], [0.14, -0.12], [0, -0.24], [-0.14, -0.12], [-0.2, 0.04]];
  k.at(p, r, sc, () => {
    // round 7: rivets around the rim (front), a leather grip and straps on the back
    for (let i = 0; i < O.length; i++) for (const t of [0.15, 0.5, 0.85]) {
      const a = O[i], b = O[(i + 1) % O.length], x = (a[0] + (b[0] - a[0]) * t) * 0.9, y = (a[1] + (b[1] - a[1]) * t) * 0.9;
      k.ball(0.013, [x, y, 0.024], o.rivet ?? rim, { d: -1, grad: [1, 1.1], ao: false });
    }
    k.box(0.05, 0.3, 0.02, [0, 0, -0.035], LEATHER, { grad: [0.9, 1] });
    k.box(0.3, 0.04, 0.02, [0, 0.08, -0.035], LEATHER, { grad: [0.9, 1] });
    k.plate(O, 0.036, [0, 0, 0], rim, { grad: [0.9, 1.08] });
    k.plate(O.map(([x, y]) => [x * 0.8, y * 0.8 + 0.008]), 0.02, [0, 0, 0.02], field, { grad: [0.86, 1.1] });
    k.plate(O.map(([x, y]) => [x * 0.86, y * 0.86]), 0.02, [0, 0, -0.02], field, { grad: [0.8, 0.95] });
    if (emblem === 'cross') {
      k.box(0.075, 0.34, 0.02, [0, -0.005, 0.032], emb, { grad: [0.95, 1.08] });
      k.box(0.25, 0.075, 0.02, [0, 0.07, 0.032], emb, { grad: [1, 1] });
      k.cyl(0.05, 0.05, 0.03, [0, 0.07, 0.03], rim, { r: [Math.PI / 2, 0, 0], seg: 10, grad: [1, 1.12] }); // boss
      k.ball(0.026, [0, 0.07, 0.05], o.gem ?? STEEL_L, { d: 1, glow: !!o.gem });
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
  const { y0 = 0.22, y1 = 0.7, r0 = 0.27, r1 = 0.19, col = BLUE, lin = GOLD, hem = GOLD, arc = 2.2, sz = 0.85, z = -0.01, seg = 12, emb = null } = o;
  const prof = [];
  for (let i = 0; i <= 3; i++) { const t = i / 3; prof.push([r0 + (r1 - r0) * Math.pow(t, 1.3), y0 + (y1 - y0) * t]); }
  const phi = Math.PI - arc / 2, at = [0, 0, z];
  k.bone(BONE.CLOTH, [0, y1, z - r1 * sz], () => {
  // round 7: soft fold shading, alternating per vertical strip
  const fold = new THREE.Color(col).multiplyScalar(0.88).getHex();
  k.lathe(prof, at, col, { s: [1, 1, sz], seg, phi, len: arc, grad: [1.0, 1.18], paint: (x, y, zz) => (Math.floor((Math.atan2(x, zz) + 9) / (arc / seg)) % 2 ? fold : null) });
  if (emb) { // an embroidered band above the hem: alternating gold blocks
    const yb = y0 + 0.085, pr = (t) => r0 + (r1 - r0) * Math.pow(Math.max(0, (t - y0) / (y1 - y0)), 1.3) + 0.006;
    k.lathe([[pr(yb), yb], [pr(yb + 0.03), yb + 0.03]], at, emb, { s: [1, 1, sz], seg: seg * 2, phi, len: arc, grad: [1, 1], ao: false, paint: (x, y, zz) => (Math.floor((Math.atan2(x, zz) + 9) / (arc / (seg * 2))) % 2 ? col : null) });
  }
  k.lathe(prof.map(([r, y]) => [r * 0.965, y]).reverse(), at, lin, { s: [1, 1, sz], seg, phi, len: arc, grad: [0.85, 1.05] });
  if (hem) {
    k.lathe([[r0 + 0.008, y0 - 0.005], [r0 * 0.99 + 0.006, y0 + 0.055]], at, hem, { s: [1, 1, sz], seg, phi: phi - 0.02, len: arc + 0.04, grad: [1, 1], ao: false });
    k.lathe([[r0 * 0.99 + 0.006, y0 + 0.055], [r0 + 0.008, y0 - 0.005]].map(([r, y]) => [r * 0.95, y]), at, hem, { s: [1, 1, sz], seg, phi: phi - 0.02, len: arc + 0.04, grad: [1, 1], ao: false });
  }
  });
}

// a crossed pair of leaf blades (reads from any yaw): spear and pike heads
function leafHead(k, p, len, w, col, fuller = null) {
  const leaf = [[-w * 0.6, 0], [w * 0.6, 0], [w, len * 0.3], [0, len], [-w, len * 0.3]];
  // round 7: a raised fuller ridge down the middle of each blade
  const pt = fuller ? (x, y) => (Math.abs(x) < w * 0.16 && y < len * 0.8 ? fuller : null) : undefined;
  k.plate(leaf, 0.03, p, col, { r: [0, 0.6, 0], grad: [0.9, 1.15], paint: pt });
  k.plate(leaf, 0.03, p, col, { r: [0, 0.6 + Math.PI / 2, 0], grad: [0.9, 1.15], paint: pt });
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
    // round 7: every other feather strip a shade darker so the fan reads as separate feathers
    const sh = new THREE.Color(c).multiplyScalar(o.stripe ?? 0.86);
    g.userData.tc = Array.from({ length: P.length / 9 }, (_, t) => ((t >> 2) % 2 ? sh : null));
    k.add(g, c, { grad: gr, noise: 0.02 });
  }
  // layered covert feathers over the band seams: rounded feather tips lying on the
  // fan, a hair above it, alternating shades (reads as rows of scales/feathers)
  for (const [f, c, sc] of o.layers ?? [[0.42, cov, 0.2], [0.78, col, 0.16]]) {
    const P = [], tc = [], sh = new THREE.Color(c).multiplyScalar(0.9);
    const tri = (x, y, z) => P.push(...x.toArray(), ...y.toArray(), ...z.toArray());
    for (let i = 0; i < n; i++) {
      const q = (j, t) => roots[j].clone().lerp(ends[j], t), mid = (t) => q(i, t).lerp(q(i + 1, t), 0.5);
      const a = q(i, f - sc).lerp(q(i + 1, f - sc), -0.08), b = q(i + 1, f - sc).lerp(q(i, f - sc), -0.08);
      const p1 = q(i, f + 0.02).lerp(q(i + 1, f + 0.02), 0.08), p2 = q(i + 1, f + 0.02).lerp(q(i, f + 0.02), 0.08), ap = mid(f + 0.07);
      const nrm = b.clone().sub(a).cross(ap.clone().sub(a)).normalize().multiplyScalar(th * 1.15);
      const pts = [a, b, p2, ap, p1].map((v) => v.clone().add(nrm)), back = [a, b, p2, ap, p1].map((v) => v.clone().sub(nrm).sub(nrm));
      const col2 = i % 2 ? sh : null;
      for (const [u, v, w] of [[0, 1, 2], [0, 2, 3], [0, 3, 4]]) { tri(pts[u], pts[v], pts[w]); tri(back[u], back[w], back[v]); tc.push(col2, col2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.userData.tc = tc;
    k.add(g, c, { grad: [0.95, 1.05], noise: 0.015 });
  }
  // a few broad primaries fanning past the tip
  for (let j = 0; j < prim; j++) {
    const i = n - j * 2, r0 = roots[Math.max(0, i)].clone();
    const dir = dirs[Math.max(0, i)].clone().lerp(E, 0.25 - j * 0.05).normalize();
    k.feather(r0.toArray(), r0.clone().add(dir.multiplyScalar(len * (0.72 + j * 0.1))).toArray(), 0.1, tip, { grad: [0.95, 1.08], t: 0.02, paint: (x, y, z, L) => (Math.abs(x) < 0.008 && y < L * 0.85 ? (o.shaft ?? cov) : null) });
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
  const HELM = U ? STEEL_L : STEEL;
  figure(k, {
    legs: BLUE_D, boots: LEATHER, torso: BLUE, hips: BLUE_D, upper: U ? STEEL : BLUE_L, fore: BLUE, hand: SKIN, cuff: U ? STEEL_L : LEATHER,
    rh: P(0.4), lh: [-0.23, 0.42, 0.08], pauldron: U ? STEEL_L : null, pTrim: U ? GOLD : null, stance: 0.1, knee: STEEL_L, toe: U ? STEEL_L : null,
    face: { brow: 0x9a5a2a, browA: 0.2 },
  });
  // a short soldier's moustache under the helm brim
  k.bone(BONE.HEAD, NECK, () => k.sym(() => k.ell(0.042, 0.014, 0.016, [0.026, HY - 0.052, 0.135], 0x9a5a2a, { d: 0.5, r: [0, 0.3, -0.25] })));
  // tassets skirt (banded lames) and polished breastplate with a centre ridge
  k.lathe([[0.225, 0.27], [0.19, 0.36], [0.16, 0.45]], [0, 0, 0], BLUE, { s: [1, 1, 0.8], seg: 10, grad: [0.85, 1.05], paint: stripes(0.06, BLUE_D, 1, 0.22, 0.1) });
  if (U) k.lathe([[0.232, 0.262], [0.228, 0.31]], [0, 0, 0], GOLD, { s: [1, 1, 0.8], seg: 10, grad: [1, 1] });
  k.lathe([[0.165, 0.47], [0.195, 0.55], [0.215, 0.63], [0.2, 0.69], [0.125, 0.735], [0.04, 0.75]], [0, 0, 0.005], HELM, { s: [1, 1, 0.8], seg: 10, grad: [0.85, 1.12] });
  k.lathe([[0.168, 0.475], [0.172, 0.5]], [0, 0, 0.005], U ? GOLD : STEEL_D, { s: [1, 1, 0.82], seg: 10, grad: [1, 1] }); // plate's lower rim
  rivets(k, 6, 0.185, 0.705, U ? GOLD : STEEL_D, { a0: -1.2, arc: 2.4, sz: 0.82, rr: 0.012 });
  belt(k, 0.44, 0.16, 0.045, LEATHER, U ? GOLD : 0xd8d0b8);
  // a pouch on the left hip and a short sword hilt on the right
  k.box(0.07, 0.08, 0.05, [-0.15, 0.38, 0.09], BROWN, { r: [0, -0.5, 0.05], grad: [0.85, 1.08] });
  k.box(0.074, 0.025, 0.054, [-0.15, 0.425, 0.09], LEATHER, { r: [0, -0.5, 0.05], grad: [1, 1.1] });
  k.at([0.17, 0.38, -0.08], [0.3, 0, -0.35], 1, () => {
    k.limb([0, -0.2, 0], [0, 0.0, 0], 0.03, 0.026, LEATHER, { seg: 6, paint: stripes(0.05, BROWN, 1, 0.3) });
    k.box(0.1, 0.022, 0.03, [0, 0.01, 0], GOLD, {});
    k.limb([0, 0.02, 0], [0, 0.08, 0], 0.014, 0.014, BROWN, { seg: 5 });
    k.ball(0.022, [0, 0.09, 0], GOLD, { d: 0 });
  });
  if (U) {
    sunBadge(k, [0, 0.6, 0.17], [-0.25, 0, 0], 1.3);
    cape(k, { y0: 0.24, y1: 0.7, r0: 0.27, r1: 0.2, col: CAPE_B, lin: BLUE_L, hem: GOLD, arc: 2.1, emb: GOLD_L });
  } else {
    // the red sash: the accent, with gold fringe at its knot
    k.box(0.08, 0.46, 0.37, [0, 0.58, 0], RED, { r: [0, 0, 0.78], grad: [0.95, 1.08], paint: (x, y) => (Math.abs(y) > 0.2 ? GOLD : null) });
    k.ell(0.05, 0.045, 0.04, [-0.15, 0.44, 0.13], RED, { d: 1 });
    locks(k, [[-0.16, 0.42, 0.14], [-0.14, 0.42, 0.15]], 0.09, 0.022, RED, [0.1, -1, 0.1], { alt: CRIMSON });
  }
  // kettle helm: a dome on a very wide brim (the pikeman's identity), rolled brim edge,
  // a raised comb, rivets around the skull and a chin strap
  k.bone(BONE.HEAD, NECK, () => {
  k.lathe([[0.13, HY + 0.02], [0.232, HY + 0.008], [0.236, HY + 0.045], [0.155, HY + 0.06], [0.158, HY + 0.11], [0.125, HY + 0.17], [0.06, HY + 0.2], [0, HY + 0.205]], [0, 0, 0], HELM, { seg: 10, grad: [0.8, 1.15] });
  k.torus(0.234, 0.013, [0, HY + 0.026, 0], U ? GOLD_L : STEEL_L, { r: [Math.PI / 2, 0, 0], seg: 20, ts: 4, grad: [1, 1.1] });
  k.lathe([[0.16, HY + 0.06], [0.162, HY + 0.08]], [0, 0, 0], U ? GOLD : STEEL_D, { seg: 10, grad: [1, 1] }); // skull band
  if (!U) rivets(k, 10, 0.163, HY + 0.07, STEEL_L, { rr: 0.012 });
  if (!U) k.plate([[-0.11, 0], [0.11, 0], [0.08, 0.05], [0.0, 0.07], [-0.08, 0.05]], 0.022, [0, HY + 0.15, 0], STEEL_L, { r: [0, Math.PI / 2, 0], grad: [0.9, 1.12] }); // comb
  k.sym(() => k.limb([0.118, HY + 0.02, 0.02], [0.06, HY - 0.11, 0.09], 0.011, 0.011, LEATHER, { seg: 4 })); // chin strap
  if (U) {
    k.lathe([[0.244, HY + 0.0], [0.244, HY + 0.05]], [0, 0, 0], GOLD, { seg: 10, grad: [1, 1] });
    k.plate([[-0.15, 0], [0.15, 0], [0.12, 0.08], [0.04, 0.12], [-0.06, 0.12], [-0.13, 0.07]], 0.035, [0, HY + 0.14, 0], GOLD, { r: [0, Math.PI / 2, 0] });
    plume(k, [0, HY + 0.2, -0.07], [WHITE, RED, WHITE], 1.15);
  }
  });
  // pole: a long pike, or the great halberd (held in the weapon hand: ARM_R)
  k.bone(BONE.ARM_R, SH, () => pole(k, A, B, (L) => {
    k.limb([0, 0, 0], [0, L, 0], 0.032, 0.028, WOOD, { seg: 6, grad: [0.88, 1.1], hs: 6, paint: (x, y) => (Math.abs(y - L * 0.4) < 0.07 ? (Math.floor(y / 0.022) % 2 ? LEATHER : BROWN) : null) }); // leather grip wrap
    k.cyl(0.048, 0.042, 0.075, [0, L - 0.05, 0], GOLD, { seg: 6 });
    k.cone(0.036, 0.06, [0, 0, 0], STEEL_D, { r: [Math.PI, 0, 0], seg: 6 }); // butt spike
    k.sym(() => k.box(0.012, 0.16, 0.034, [0.034, L - 0.15, 0], STEEL, { grad: [0.9, 1.1] })); // langets
    if (!U) {
      k.ball(0.06, [0, L - 0.09, 0], RED, { d: 1 });
      locks(k, [0, 1, 2, 3, 4, 5].map((i) => [Math.sin(i) * 0.04, L - 0.11, Math.cos(i) * 0.04]), 0.09, 0.02, RED, [0, -1, 0], { alt: GOLD, out: 0.02 }); // tassel
      leafHead(k, [0, L, 0], 0.32, 0.08, STEEL_L, STEEL);
    } else {
      for (const y of [0.45, 0.8]) k.cyl(0.042, 0.042, 0.05, [0, y, 0], GOLD, { seg: 6, grad: [1, 1] });
      const ax = [[0, 0.02], [0.09, -0.02], [0.17, -0.12], [0.25, -0.02], [0.28, 0.12], [0.25, 0.26], [0.17, 0.34], [0.09, 0.22], [0, 0.18]];
      k.at([-0.02, L - 0.3, 0], [0, 0, 0], [-1.05, 1.05, 1.05], () => { // blade toward the figure: keeps the unit narrow
        k.plate(ax.map(([x, y]) => [(x - 0.14) * 1.13 + 0.15, (y - 0.11) * 1.13 + 0.11]), 0.024, [0, 0, 0], GOLD, { grad: [1, 1.05] });
        k.plate(ax, 0.036, [0, 0, 0], STEEL_L, { grad: [0.88, 1.15] });
        // an etched sun and three rivets where the blade meets the socket
        k.cyl(0.04, 0.04, 0.042, [0.17, 0.12, -0.021], GOLD, { r: [Math.PI / 2, 0, 0], seg: 8 });
        for (const y of [0.02, 0.1, 0.17]) k.ball(0.013, [0.03, y, 0], GOLD_L, { d: 0, s: [1, 1, 2.2] });
      });
      k.cone(0.042, 0.17, [0.01, L - 0.18, 0], STEEL, { r: [0, 0, -Math.PI / 2], seg: 4 });
      k.ball(0.06, [0, L - 0.36, 0], BLUE, { d: 1 });
      locks(k, [0, 1, 2, 3, 4, 5].map((i) => [Math.sin(i) * 0.045, L - 0.38, Math.cos(i) * 0.045]), 0.1, 0.02, BLUE_L, [0, -1, 0], { alt: GOLD, out: 0.02 });
      leafHead(k, [0, L, 0], 0.3, 0.07, STEEL_L, GOLD_L);
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
  const HAIR = 0xc87a34;
  figure(k, {
    legs: TAN, boots: LEATHER, torso: GREEN_D, hips: GREEN_D, upper: GREEN, fore: LEATHER, hand: SKIN, cuff: U ? GOLD : BROWN,
    rh: draw, lh: bowP, stance: 0.11, head: false, pauldron: U ? STEEL_L : null, pTrim: U ? GOLD : null, cuffB: TAN,
  });
  belt(k, 0.465, 0.158, 0.05, BROWN, U ? GOLD : 0xe8c060);
  k.lathe([[0.215, 0.27], [0.18, 0.36], [0.155, 0.45]], [0, 0, 0], GREEN_D, { s: [1, 1, 0.8], seg: 10, grad: [0.85, 1.05] });
  // dagged hem on the tunic skirt: alternating leaf points
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; k.cone(0.03, 0.06, [Math.sin(a) * 0.206, 0.278, Math.cos(a) * 0.165], i % 2 ? GREEN : GREEN_D, { r: [Math.PI, a, 0], seg: 3, grad: [0.9, 1.05] }); }
  if (U) k.lathe([[0.222, 0.262], [0.218, 0.31]], [0, 0, 0], GOLD, { s: [1, 1, 0.8], seg: 10, grad: [1, 1] });
  if (U) cape(k, { y0: 0.2, y1: 0.68, r0: 0.27, r1: 0.2, col: CAPE_G, lin: GOLD, hem: GOLD, arc: 2.0, emb: GOLD_L });
  // laced jerkin front: three tan cross-ties
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) k.box(0.05, 0.012, 0.014, [0, 0.505 + i * 0.035, 0.155 - i * 0.004], TAN, { r: [-0.25, 0, sd * 0.55], grad: [1, 1.1], ao: false });
  // belt pouch
  k.box(0.075, 0.085, 0.05, [0.15, 0.4, 0.09], BROWN, { r: [0, 0.5, -0.05], grad: [0.85, 1.08] });
  k.box(0.08, 0.03, 0.055, [0.15, 0.445, 0.09], LEATHER, { r: [0, 0.5, -0.05], grad: [1, 1.1] });
  k.ball(0.012, [0.162, 0.43, 0.125], GOLD, { d: 0 });
  // capelet and big pointed hood
  k.lathe([[0.25, 0.55], [0.235, 0.6], [0.19, 0.67], [0.11, 0.73], [0.05, 0.75]], [0, 0, 0], GREEN, { s: [1, 1, 0.86], seg: 10, grad: [0.85, 1.1] });
  k.lathe([[0.258, 0.535], [0.254, 0.575]], [0, 0, 0], U ? GOLD : GREEN_D, { s: [1, 1, 0.86], seg: 10, grad: [1, 1] });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.26; k.cone(0.034, 0.065, [Math.sin(a) * 0.252, 0.54, Math.cos(a) * 0.217], U ? (i % 2 ? GOLD : GREEN) : (i % 2 ? GREEN : GREEN_D), { r: [Math.PI, a, 0], seg: 3, grad: [0.9, 1.05] }); }
  k.bone(BONE.HEAD, NECK, () => {
  k.ell(0.16, 0.165, 0.16, [0, HY + 0.015, -0.025], GREEN, { d: 2, grad: [0.88, 1.1] });
  k.cone(0.09, 0.22, [0, HY + 0.07, -0.12], GREEN, { r: [-2.1, 0, 0], seg: 6 });
  k.ell(0.122, 0.125, 0.1, [0, HY - 0.012, 0.06], SKIN, { d: 2, grad: [0.95, 1.05] });
  face(k, [0, HY - 0.012, 0.06], [0.122, 0.125, 0.1], { ey: 0.008, brow: HAIR, blush: true });
  // the hood's opening: a thick rolled rim around the face, and copper fringe locks
  k.torus(0.128, 0.022, [0, HY - 0.005, 0.088], U ? GOLD : GREEN_D, { seg: 14, ts: 4, s: [1, 1.08, 1] });
  locks(k, [[-0.07, HY + 0.1, 0.105], [-0.03, HY + 0.11, 0.115], [0.015, HY + 0.11, 0.118], [0.06, HY + 0.1, 0.108]], 0.07, 0.026, HAIR, [0.25, -1, 0.35], { curl: 0.01, alt: 0xb06a2a });
  k.sym(() => locks(k, [[0.1, HY + 0.02, 0.07]], 0.11, 0.028, HAIR, [0.1, -1, 0.15]));
  if (U) {
    k.feather([0.1, HY + 0.08, -0.04], [0.26, HY + 0.32, -0.2], 0.12, RED, { t: 0.024, paint: (x, y, z, L) => (Math.abs(x) < 0.008 ? CREAM : y > L * 0.75 ? 0xffb050 : null) });
    k.feather([0.08, HY + 0.08, -0.06], [0.16, HY + 0.3, -0.26], 0.09, WHITE, { t: 0.022, paint: (x) => (Math.abs(x) < 0.007 ? CREAM : null) });
    k.ball(0.03, [0.1, HY + 0.08, -0.04], GOLD, { d: 0 });
  }
  });
  // quiver on the back: a big tooled leather tube with bands, a bundle of arrows
  // with red and white fletching
  k.at([0.1, 0.6, -0.17], [0.35, 0, -0.4], 1, () => {
    k.cyl(0.07, 0.076, 0.36, [0, -0.2, 0], U ? CRIMSON : LEATHER, { seg: 8, grad: [0.85, 1.08] });
    for (const y of [-0.17, 0.0, 0.12]) k.cyl(0.08, 0.08, 0.03, [0, y, 0], U ? GOLD : BROWN, { seg: 8, grad: [1, 1.05] });
    if (U) k.cyl(0.08, 0.08, 0.05, [0, 0.1, 0], GOLD, { seg: 7, grad: [1, 1] });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3, x = Math.sin(a) * 0.035, z = Math.cos(a) * 0.035, h = 0.2 + (i % 3) * 0.025;
      k.limb([x, 0.1, z], [x * 1.4, h, z * 1.4], 0.01, 0.01, CREAM, { seg: 4 });
      k.box(0.05, 0.08, 0.008, [x * 1.4, h, z * 1.4], i % 2 ? WHITE : RED, { r: [0, a, 0] });
      k.box(0.008, 0.08, 0.05, [x * 1.4, h, z * 1.4], i % 2 ? RED : WHITE, { r: [0, a, 0] });
    }
  });
  // longbow: thick limbs bowed back toward the archer (recurved, gilded tips when upgraded).
  // Rig: bow and string on the bow arm (ARM_L), the nocked arrow on the drawing arm (ARM_R)
  const bowH = U ? 0.47 : 0.43, bend = 0.12, pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 4 - 1; pts.push([bowP[0], bowP[1] + t * bowH, bowP[2] + 0.02 - t * t * bend + (U ? Math.pow(Math.abs(t), 5) * 0.09 : 0)]); }
  const R = [draw[0], draw[1], draw[2] - 0.02];
  k.bone(BONE.ARM_L, SHL, () => {
  for (let i = 0; i < 8; i++) {
    const r = 0.034 - Math.abs(i - 3.5) * 0.0028, grip = i === 3 || i === 4;
    const c = grip ? (U ? CRIMSON : RED) : (U && (i === 0 || i === 7) ? GOLD : WOOD);
    k.limb(pts[i], pts[i + 1], r, r, c, { seg: 6, hs: grip ? 3 : 1, paint: grip ? (x, y, z, L) => (Math.floor((y / L) * 3) % 2 ? (U ? GOLD : 0xffd070) : null) : (U ? null : (x, y, z, L) => (y / L < 0.15 ? BROWN : null)) });
  }
  k.ball(0.03, pts[0], GOLD, { d: 1 }); k.ball(0.03, pts[8], GOLD, { d: 1 });
  k.limb(pts[8], R, 0.008, 0.008, CREAM, { seg: 3 });
  k.limb(pts[0], R, 0.008, 0.008, CREAM, { seg: 3 });
  });
  // nocked arrow with a bold head and fletching at the nock
  const tipA = [bowP[0] + 0.01, bowP[1] + 0.02, bowP[2] + 0.2];
  k.bone(BONE.ARM_R, SH, () => {
  k.limb(R, tipA, 0.014, 0.014, CREAM, { seg: 4 });
  const dA = V3(tipA).sub(V3(R)).normalize();
  k.stick(new THREE.ConeGeometry(0.032, 0.09, 4).translate(0, 0.045, 0), tipA, V3(tipA).add(dA).toArray(), U ? GOLD_L : STEEL_L, {});
  const f0 = V3(R).add(dA.clone().multiplyScalar(0.02)).toArray(), f1 = V3(R).add(dA.clone().multiplyScalar(0.1)).toArray();
  k.feather(f0, f1, 0.05, RED, { t: 0.008 });
  k.feather(f0, f1, 0.05, WHITE, { t: 0.008, roll: Math.PI / 2 });
  });
  return k.done();
}

// Griffin: orange-gold lion body, white eagle head with a huge yellow beak,
// big V wings in cream / orange / rust.
// Royal griffin: + gold crown, royal-blue wing tips and saddle cloth, bigger wings.
function griffin(U) {
  const k = makeKit(U ? 39 : 37, [0, 0.43, -0.08]);
  const FUR = U ? 0xf6c24e : 0xeeaa3e, FUR_D = U ? 0xd89838 : 0xcc8430, FEATH = 0xfff8ec, BEAK = 0xffb41e, TAL = 0xf2bc3c, CLAW = 0x8a7a9a;
  const BELLY = U ? 0xfce4a0 : 0xf8d48a, SCALE = U ? 0xe0a032 : 0xd89a2c, EDGE = 0xecd4b8, BEAK_D = 0xe08a10, EDGE2 = 0xf0d2a8, TUFT = U ? GOLD : 0xc0602a;
  // lion body: lighter belly, a soft darker saddle along the spine
  k.ell(0.19, 0.17, 0.3, [0, 0.43, -0.08], FUR, { d: 2, r: [0.1, 0, 0], grad: [0.84, 1.1], paint: (x, y) => (y < -0.1 ? BELLY : y > 0.15 && Math.abs(x) < 0.07 ? FUR_D : null) });
  // lion hind legs with big paws: three toes and pale claws
  k.sym(() => k.bone(BONE.LEG_BR, [0.12, 0.44, -0.25], () => {
    k.ell(0.1, 0.15, 0.14, [0.12, 0.36, -0.25], FUR, { grad: [0.84, 1.08] });
    k.limb([0.13, 0.28, -0.28], [0.14, 0.13, -0.35], 0.075, 0.055, FUR);
    k.limb([0.14, 0.13, -0.35], [0.14, 0.04, -0.29], 0.055, 0.048, FUR_D);
    k.ell(0.066, 0.042, 0.08, [0.14, 0.035, -0.26], FUR_D, { d: 1 });
    for (const t of [-1, 0, 1]) {
      k.ell(0.024, 0.024, 0.03, [0.14 + t * 0.034, 0.026, -0.2], FUR, { d: 0.5 });
      k.cone(0.012, 0.035, [0.14 + t * 0.034, 0.02, -0.175], CLAW, { r: [Math.PI / 2 + 0.4, 0, 0], seg: 4 });
    }
  }));
  // tail: banded shaft ending in a big multi-lock tuft
  k.bone(BONE.TAIL, [0, 0.5, -0.34], () => {
    k.limb([0, 0.5, -0.34], [0, 0.42, -0.52], 0.04, 0.032, FUR);
    k.limb([0, 0.42, -0.52], [0, 0.56, -0.66], 0.032, 0.028, FUR);
    k.ell(0.07, 0.09, 0.07, [0, 0.62, -0.7], TUFT, { r: [-0.6, 0, 0] });
    locks(k, [[0, 0.64, -0.72], [0.03, 0.62, -0.71], [-0.03, 0.62, -0.71], [0.015, 0.59, -0.7], [-0.015, 0.59, -0.7]], 0.1, 0.04, TUFT, [0, 0.25, -1], { var: 0.15, curl: 0.03, alt: U ? GOLD_L : 0xd8743a });
  });
  // white feathered chest: rows of scalloped feather tips; a ruff of long feathers at the neck
  const scallop = (per, ap, c2) => (x, y, z) => {
    const row = Math.floor(y / per), v = y / per - row, u = ((Math.atan2(x, z) / ap) + row * 0.5) % 1;
    return v < 0.35 * (1 - 2 * Math.abs((u < 0 ? u + 1 : u) - 0.5)) + 0.08 ? c2 : null;
  };
  k.ell(0.18, 0.2, 0.18, [0, 0.5, 0.15], FEATH, { d: 2, r: [-0.35, 0, 0], grad: [0.86, 1.06], paint: scallop(0.022, 0.35, EDGE) });
  k.limb([0, 0.55, 0.22], [0, 0.72, 0.32], 0.135, 0.11, FEATH, { seg: 8, hs: 5, paint: scallop(0.04, 0.6, EDGE) });
  // eagle front legs: feathered thighs (trousers), scaled golden shins, three talons and a back toe
  k.sym(() => k.bone(BONE.LEG_FR, [0.11, 0.44, 0.2], () => {
    k.ell(0.085, 0.12, 0.095, [0.11, 0.36, 0.22], FEATH, { r: [0.3, 0, 0], paint: scallop(0.03, 0.6, EDGE) });
    locks(k, [[0.08, 0.28, 0.24], [0.12, 0.27, 0.25], [0.15, 0.28, 0.22]], 0.06, 0.026, FEATH, [0, -1, 0.1], { alt: EDGE });
    k.limb([0.12, 0.3, 0.25], [0.13, 0.06, 0.3], 0.058, 0.046, TAL, { hs: 6, paint: stripes(0.04, SCALE, 1, 0.3) });
    k.ell(0.062, 0.04, 0.068, [0.13, 0.04, 0.32], TAL, { d: 1 });
    for (const t of [-1, 0, 1]) {
      k.limb([0.13 + t * 0.02, 0.04, 0.33], [0.13 + t * 0.045, 0.03, 0.38 - Math.abs(t) * 0.01], 0.018, 0.014, TAL, { seg: 5 });
      k.cone(0.016, 0.05, [0.13 + t * 0.047, 0.032, 0.38 - Math.abs(t) * 0.01], CLAW, { r: [Math.PI / 2 + 0.35, t * 0.3, 0], seg: 4 });
    }
    k.cone(0.014, 0.045, [0.13, 0.04, 0.28], CLAW, { r: [-Math.PI / 2 - 0.3, 0, 0], seg: 4 });
    if (U) k.cyl(0.05, 0.05, 0.03, [0.127, 0.2, 0.278], GOLD, { r: [0.2, 0, 0], seg: 8 });
  }));
  if (U) { // royal saddle cloth with an embroidered border and a sun on each flank
    k.lathe([[0.208, 0.36], [0.2, 0.46], [0.165, 0.56], [0.06, 0.6]], [0, 0, -0.1], ROYAL, { s: [1, 1, 1.2], seg: 10, grad: [0.85, 1.08] });
    k.lathe([[0.215, 0.345], [0.212, 0.395]], [0, 0, -0.1], GOLD, { s: [1, 1, 1.2], seg: 10, grad: [1, 1] });
    k.lathe([[0.214, 0.405], [0.212, 0.42]], [0, 0, -0.1], GOLD_L, { s: [1, 1, 1.2], seg: 20, grad: [1, 1], paint: (x, y, z) => (Math.floor((Math.atan2(x, z) + 9) / 0.314) % 2 ? ROYAL : null) });
    k.sym(() => sunBadge(k, [0.205, 0.47, -0.1], [0, Math.PI / 2, 0], 1.0, 0xff6a5a));
  } else { // a gold collar with a red jewel
    k.torus(0.15, 0.03, [0, 0.47, 0.05], GOLD, { r: [Math.PI / 2 - 0.5, 0, 0], seg: 14 });
    k.ball(0.032, [0, 0.43, 0.2], RED, { d: 1 });
  }
  // big eagle head: white, huge hooked yellow beak with a cere, nostril and gape line,
  // amber eyes under a fierce brow, ear tufts and a crest of layered feathers
  const hy = 0.8, hz = 0.4;
  k.bone(BONE.HEAD, [0, 0.66, 0.29], () => {
  k.ell(0.13, 0.13, 0.15, [0, hy, hz], FEATH, { d: 2, grad: [0.9, 1.06], paint: scallop(0.03, 0.5, EDGE) });
  k.cone(0.072, 0.18, [0, hy - 0.01, hz + 0.09], BEAK, { r: [Math.PI / 2 + 0.12, 0, 0], seg: 8, grad: [0.9, 1.1] });
  k.cone(0.036, 0.08, [0, hy - 0.04, hz + 0.26], BEAK, { r: [Math.PI - 0.35, 0, 0], seg: 6 });
  k.cone(0.03, 0.04, [0, hy - 0.068, hz + 0.285], BEAK_D, { r: [Math.PI - 0.1, 0, 0], seg: 5 }); // hooked tip
  k.cyl(0.076, 0.074, 0.03, [0, hy - 0.01, hz + 0.09], 0xffd04a, { r: [Math.PI / 2 + 0.12, 0, 0], seg: 10 }); // cere
  k.sym(() => {
    k.ell(0.032, 0.036, 0.02, [0.074, hy + 0.025, hz + 0.1], 0xffe8a0, { d: 1, grad: [1, 1], ao: false, r: [0, 0.5, 0] });
    k.ell(0.024, 0.028, 0.012, [0.081, hy + 0.024, hz + 0.111], 0xf08a1a, { d: 0.5, grad: [1, 1], ao: false, r: [0, 0.5, 0] });
    k.ell(0.012, 0.016, 0.008, [0.085, hy + 0.024, hz + 0.118], INK, { d: 0, grad: [1, 1], ao: false });
    k.ball(0.006, [0.08, hy + 0.033, hz + 0.123], 0xffffff, { d: 0, grad: [1, 1], ao: false, noise: 0 });
    k.box(0.085, 0.032, 0.055, [0.07, hy + 0.068, hz + 0.08], U ? GOLD : FUR_D, { r: [0, -0.25, -0.35] });
    k.ell(0.008, 0.006, 0.01, [0.03, hy + 0.005, hz + 0.17], BEAK_D, { d: 0, ao: false }); // nostril
    k.limb([0.05, hy - 0.04, hz + 0.1], [0.022, hy - 0.06, hz + 0.24], 0.006, 0.004, BEAK_D, { seg: 3 }); // gape line
    k.cone(0.03, 0.12, [0.08, hy + 0.08, hz - 0.02], FEATH, { r: [-1.0, 0.3, -0.5], seg: 4 }); // ear tuft
  });
  for (let i = 0; i < 3; i++) k.cone(0.05, 0.24 - Math.abs(i - 1) * 0.04, [(i - 1) * 0.045, hy + 0.06, hz - 0.08], i === 1 ? (U ? ROYAL : FUR) : FEATH, { r: [-1.8 - Math.abs(i - 1) * 0.15, (i - 1) * 0.35, 0], seg: 5 });
  locks(k, [[-0.06, hy - 0.02, hz - 0.1], [0, hy - 0.04, hz - 0.12], [0.06, hy - 0.02, hz - 0.1]], 0.12, 0.034, FEATH, [0, -0.6, -1], { alt: EDGE }); // nape feathers
  if (U) { // a jewelled gold crown
    k.lathe([[0.088, hy + 0.085], [0.094, hy + 0.14]], [0, 0, hz - 0.01], GOLD, { seg: 10, grad: [1, 1] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2; k.cone(0.03, 0.08, [Math.sin(a) * 0.09, hy + 0.13, hz - 0.01 + Math.cos(a) * 0.09], GOLD_L, { seg: 4 });
      k.ball(0.014, [Math.sin(a + 0.63) * 0.097, hy + 0.112, hz - 0.01 + Math.cos(a + 0.63) * 0.097], i % 2 ? 0xff5a6a : 0x6ac0ff, { glow: true, d: 0 });
    }
  }
  });
  // great wings raised in a V so the head stays clear
  k.sym(() => k.bone(BONE.WING_R, [0.12, 0.6, 0.02], () => wing(k, [0.12, 0.6, 0.02], {
    W: [0.26, 0.24, -0.06], T: U ? [0.64, 0.5, -0.26] : [0.58, 0.46, -0.24], len: U ? 0.52 : 0.45, drop: [0.15, -0.25, -1], dropIn: [0.1, -0.9, -0.5],
    n: 8, col: U ? GOLD : 0xf0922c, tip: U ? ROYAL : 0xc8501e, cov: 0xfff0c8, bone: U ? GOLD_L : 0xf8dc90, prim: 4,
  })));
  return k.done();
}

// Swordsman: steel plate, blue tabard and cape with gold crosses, great helm,
// huge blue shield with a gold cross, broad sword.
// Crusader: white surcoat and shield with crimson cross, crimson cape, gold crown and plume.
function swordsman(U) {
  const k = makeKit(U ? 43 : 41);
  const TAB = U ? WHITE : BLUE, CROSS = U ? CRIMSON : GOLD, CAPE = U ? CAPE_R : CAPE_B, HELM = U ? STEEL_L : STEEL;
  const { R, L } = figure(k, {
    legs: STEEL, boots: STEEL_D, torso: STEEL, hips: STEEL_D, upper: STEEL, fore: STEEL_L, hand: STEEL_D, elbow: STEEL_L, knee: U ? GOLD : STEEL_L, cuff: U ? GOLD : STEEL_L,
    rh: [0.27, 0.56, 0.2], lh: [-0.22, 0.46, 0.2], pauldron: STEEL_L, pTrim: U ? GOLD : null, lame: STEEL, stance: 0.105, head: false, armR: 0.066,
    toe: STEEL_L, cuffB: STEEL_L, sole: STEEL_D,
  });
  cape(k, { y0: 0.16, y1: 0.7, r0: 0.26, r1: 0.2, col: CAPE, lin: U ? GOLD : BLUE_L, hem: GOLD, arc: 2.2, emb: U ? GOLD_L : null });
  k.bone(BONE.CLOTH, [0, 0.7, -0.01 - 0.2 * 0.85], () => { // the cross on the cape moves with it
    k.box(0.065, 0.3, 0.03, [0, 0.42, -0.215], GOLD, { r: [0.05, 0, 0] });
    k.box(0.2, 0.065, 0.03, [0, 0.49, -0.212], GOLD, { r: [0.05, 0, 0] });
  });
  // gorget, banded tassets and a sword belt
  k.lathe([[0.15, 0.7], [0.135, 0.735], [0.1, 0.76]], [0, 0, 0], STEEL_L, { s: [1, 1, 0.85], seg: 10, grad: [0.9, 1.12], paint: stripes(0.018, STEEL, 1, 0.3) });
  k.lathe([[0.215, 0.26], [0.185, 0.35], [0.158, 0.44]], [0, 0, 0], STEEL, { s: [1, 1, 0.82], seg: 10, grad: [0.85, 1.08], paint: stripes(0.045, STEEL_D, 1, 0.22) });
  if (U) k.lathe([[0.222, 0.252], [0.219, 0.285]], [0, 0, 0], GOLD, { s: [1, 1, 0.82], seg: 10, grad: [1, 1] });
  belt(k, 0.44, 0.158, 0.045, U ? CRIMSON : LEATHER, GOLD, 0.84);
  // tabard with a bold cross and a gold border
  k.box(0.26, 0.43, 0.03, [0, 0.47, 0.162], TAB, { r: [-0.1, 0, 0], grad: [0.85, 1.06] });
  k.at([0, 0.47, 0.162], [-0.1, 0, 0], 1, () => {
    k.sym(() => k.box(0.018, 0.43, 0.034, [0.122, 0, 0.002], GOLD, { grad: [1, 1.08] }));
    k.box(0.26, 0.022, 0.034, [0, -0.205, 0.002], GOLD, { grad: [1, 1] });
  });
  k.box(0.065, 0.26, 0.02, [0, 0.49, 0.182], CROSS, { r: [-0.1, 0, 0] });
  k.box(0.19, 0.065, 0.02, [0, 0.54, 0.177], CROSS, { r: [-0.1, 0, 0] });
  if (U) {
    k.box(0.27, 0.045, 0.036, [0, 0.27, 0.142], GOLD, { r: [-0.1, 0, 0], grad: [1, 1] });
    k.ball(0.022, [0, 0.54, 0.192], 0xffd0a0, { d: 1 });
  }
  // great helm: bucket with a bold T visor, brow ridge, rivets and breaths
  k.bone(BONE.HEAD, NECK, () => {
  k.lathe([[0, HY - 0.13], [0.135, HY - 0.13], [0.15, HY - 0.07], [0.15, HY + 0.07], [0.13, HY + 0.13], [0, HY + 0.15]], [0, 0, 0], HELM, { seg: 10, grad: [0.8, 1.15] });
  k.box(0.22, 0.036, 0.03, [0, HY + 0.02, 0.145], INK, { grad: [1, 1], ao: false });
  k.box(0.24, 0.026, 0.03, [0, HY + 0.05, 0.146], U ? GOLD : STEEL_L, { grad: [1, 1.1] }); // brow ridge over the slit
  k.box(0.038, 0.12, 0.03, [0, HY - 0.05, 0.146], U ? GOLD : STEEL_D, { grad: [1, 1] });
  k.lathe([[0.152, HY - 0.135], [0.152, HY - 0.105]], [0, 0, 0], U ? GOLD : STEEL_D, { seg: 10, grad: [1, 1] }); // lower rim
  rivets(k, 12, 0.154, HY - 0.12, U ? GOLD_L : STEEL_L, { rr: 0.011 });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.ell(0.008, 0.014, 0.008, [0.06 + j * 0.03, HY - 0.035 - i * 0.03, 0.143 - j * 0.012], INK, { d: 0, ao: false, grad: [1, 1] }); // breaths
  if (U) {
    k.lathe([[0.158, HY + 0.06], [0.158, HY + 0.115]], [0, 0, 0], GOLD, { seg: 10, grad: [1, 1] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2; k.cone(0.032, 0.08, [Math.sin(a) * 0.15, HY + 0.11, Math.cos(a) * 0.15], GOLD_L, { seg: 4 });
      k.ball(0.014, [Math.sin(a + 0.52) * 0.162, HY + 0.088, Math.cos(a + 0.52) * 0.162], i % 2 ? 0xff5060 : 0x60a0ff, { glow: true, d: 0 });
    }
    plume(k, [0, HY + 0.15, -0.03], [WHITE, CRIMSON, WHITE], 1.25);
  } else {
    k.plate([[-0.1, 0], [0.1, 0], [0.06, 0.05], [-0.06, 0.05]], 0.02, [0, HY + 0.13, -0.01], STEEL_L, { r: [0, Math.PI / 2, 0] }); // crest ridge
    plume(k, [0, HY + 0.14, -0.02], [BLUE_L, WHITE, BLUE_L], 1.05);
  }
  });
  // broad sword raised in the right hand, flat facing the camera: fullered blade,
  // ricasso, wrapped grip, quillons with knobs and a jewelled pommel
  k.bone(BONE.ARM_R, SH, () => k.at(R, [0.35, 0, -0.2], U ? 1.38 : 1.25, () => {
    k.box(0.22, 0.04, 0.05, [0, 0.03, 0], GOLD, { grad: [0.95, 1.08] });
    k.sym(() => k.ball(0.026, [0.115, 0.04, 0], GOLD_L, { d: 1 }));
    k.limb([0, -0.08, 0], [0, 0.02, 0], 0.022, 0.022, U ? CRIMSON : LEATHER, { seg: 6, hs: 4, paint: (x, y, z, L) => (Math.floor((y / L) * 5) % 2 ? (U ? GOLD : BROWN) : null) });
    k.ball(0.034, [0, -0.09, 0], U ? 0xff6a5a : GOLD, { d: 1, glow: U });
    k.at([0, 0.05, 0], [0, 0.3, 0], 1, () => {
      k.plate([[-0.046, 0], [0.046, 0], [0.04, 0.48], [0, 0.58], [-0.04, 0.48]], 0.022, [0, 0, 0], STEEL_L, { grad: [0.9, 1.2], paint: (x, y) => (Math.abs(x) < 0.011 && y > 0.06 && y < 0.42 ? STEEL_D : null) });
      k.box(0.07, 0.05, 0.028, [0, 0.025, 0], U ? GOLD : STEEL, { grad: [1, 1.1] }); // ricasso
    });
  }));
  k.bone(BONE.ARM_L, SHL, () => shield(k, [L[0] - 0.04, L[1] + 0.03, L[2] + 0.07], [0.05, -0.35, 0.04], 1.08, U ? WHITE : BLUE, GOLD, 'cross', U ? CRIMSON : GOLD, { gem: U ? 0xff6070 : null, rivet: GOLD_L }));
  return k.done();
}

// Monk: long cream robe, blue scapular, bald head with brown fringe and beard,
// a staff crowned by a big caged golden orb.
// Zealot: crimson robe and pointed hood, gold stole and broad hem, white beard,
// a gold sun-ring staff and a holy flame in the free hand.
function monk(U) {
  const k = makeKit(U ? 59 : 53);
  const ROBE = U ? CRIMSON : CREAM, SCAP = U ? GOLD : BLUE, ROPE = U ? GOLD : 0xd8b070, HAIR = U ? WHITE : BROWN;
  const SX = 0.27, SZ = 0.1;
  // soft vertical folds: every other lathe strip a shade darker
  const folds = (col, n) => { const d = new THREE.Color(col).multiplyScalar(0.9).getHex(); return (x, y, z) => (Math.floor((Math.atan2(x, z) + 9) / ((Math.PI * 2) / n)) % 2 ? d : null); };
  const { L } = figure(k, {
    robe: true, torso: ROBE, hips: ROBE, upper: ROBE, fore: ROBE, hand: SKIN, armR: 0.068, foreR: 0.08, cuff: U ? GOLD : ROBE,
    rh: [SX - 0.035, 0.5, SZ], lh: [-0.2, 0.56, 0.2], head: !U, face: { brow: HAIR, browA: 0.3, blush: true },
  });
  // robe to the ground with folds and a broad hem (CLOTH, hung from the waist)
  k.bone(BONE.CLOTH, [0, 0.5, 0], () => {
    k.lathe([[0.26, 0.0], [0.25, 0.06], [0.205, 0.25], [0.165, 0.42], [0.15, 0.5]], [0, 0, 0], ROBE, { s: [1, 1, 0.88], seg: 14, grad: [0.84, 1.04], paint: folds(ROBE, 16) });
    k.lathe([[0.268, 0.0], [0.264, U ? 0.075 : 0.055]], [0, 0, 0], U ? GOLD : BLUE, { s: [1, 1, 0.88], seg: 14, grad: [1, 1] });
    if (U) k.lathe([[0.262, 0.085], [0.258, 0.105]], [0, 0, 0], GOLD_L, { s: [1, 1, 0.88], seg: 26, grad: [1, 1], paint: folds(CRIMSON, 28) });
    // prayer beads hanging from the cord, ending in a little sun / cross
    for (let i = 0; i < 6; i++) k.ball(0.014, [-0.1 - Math.sin(i * 0.5) * 0.02, 0.42 - i * 0.03, 0.17 - i * 0.004], U ? GOLD_L : BROWN, { d: 0.5 });
    k.box(0.016, 0.06, 0.012, [-0.115, 0.23, 0.17], GOLD, {}); k.box(0.045, 0.016, 0.012, [-0.115, 0.245, 0.17], GOLD, {});
  });
  // rope cord belt: twisted (striped) ring, a knot and two tasselled ends
  k.torus(0.158, 0.016, [0, 0.47, 0], ROPE, { r: [Math.PI / 2, 0, 0], s: [1, 0.86, 1], seg: 24, ts: 4, paint: (x, y) => (Math.floor((Math.atan2(x, y) + 9) / 0.26) % 2 ? new THREE.Color(ROPE).multiplyScalar(0.82).getHex() : null) });
  k.ell(0.028, 0.024, 0.024, [0.06, 0.465, 0.135], ROPE, { d: 0.5 });
  for (const [dx, len] of [[0.055, 0.2], [0.075, 0.16]]) {
    k.limb([dx, 0.46, 0.14], [dx + 0.02, 0.46 - len, 0.16], 0.009, 0.009, ROPE, { seg: 4 });
    k.cone(0.02, 0.05, [dx + 0.02, 0.46 - len - 0.045, 0.16], ROPE, { seg: 5 });
  }
  // scapular / stole down the front and back, with an embroidered band and a cross
  const scap = [[0.27, 0.05], [0.258, 0.09], [0.213, 0.25], [0.173, 0.42], [0.163, 0.5], [0.172, 0.56], [0.2, 0.63], [0.21, 0.69], [0.13, 0.74]];
  const scPaint = U ? stripes(0.08, 0xffe890, 1, 0.18) : (x, y) => (y < 0.1 ? GOLD : null);
  for (const ph of [0, Math.PI]) k.lathe(scap, [0, 0, 0], SCAP, { s: [1, 1, 0.9], seg: 2, phi: ph - 0.3, len: 0.6, grad: [0.85, 1.08], paint: scPaint });
  if (!U) { k.box(0.024, 0.09, 0.012, [0, 0.3, 0.205], GOLD, { r: [-0.22, 0, 0] }); k.box(0.07, 0.022, 0.012, [0, 0.32, 0.2], GOLD, { r: [-0.22, 0, 0] }); }
  if (U) {
    sunBadge(k, [0, 0.6, 0.19], [-0.25, 0, 0], 1.35, 0xff6a5a);
    // raised pointed hood, face, long white beard and moustache, gold rim around the face
    k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.16, 0.165, 0.16, [0, HY + 0.015, -0.025], CRIMSON, { d: 2, grad: [0.88, 1.1] });
    k.cone(0.09, 0.22, [0, HY + 0.08, -0.08], CRIMSON, { r: [-0.6, 0, 0], seg: 6 });
    k.ell(0.122, 0.125, 0.1, [0, HY - 0.012, 0.06], SKIN, { d: 2, grad: [0.95, 1.05] });
    face(k, [0, HY - 0.012, 0.06], [0.122, 0.125, 0.1], { ey: 0.012, brow: WHITE, browA: 0.35, mouth: false });
    k.torus(0.125, 0.026, [0, HY - 0.005, 0.085], GOLD, { seg: 14, ts: 4, s: [1, 1.08, 1] });
    k.ell(0.09, 0.095, 0.055, [0, HY - 0.085, 0.13], WHITE, { d: 1 });
    locks(k, [[-0.06, HY - 0.1, 0.13], [-0.03, HY - 0.11, 0.15], [0, HY - 0.115, 0.155], [0.03, HY - 0.11, 0.15], [0.06, HY - 0.1, 0.13]], 0.13, 0.03, WHITE, [0, -1, 0.25], { var: 0.2, curl: 0.012, alt: CREAM });
    k.sym(() => k.ell(0.045, 0.016, 0.02, [0.03, HY - 0.05, 0.15], WHITE, { d: 0.5, r: [0, 0.3, -0.3] }));
    });
  } else {
    k.torus(0.135, 0.06, [0, 0.725, -0.01], BLUE, { r: [Math.PI / 2 + 0.2, 0, 0], seg: 14, ts: 6 }); // cowl
    k.bone(BONE.HEAD, NECK, () => {
      k.ell(0.142, 0.095, 0.13, [0, HY - 0.012, -0.03], BROWN, { paint: (x, y) => (y > 0.6 ? 0x8a5430 : null) }); // tonsure fringe
      k.ell(0.085, 0.08, 0.055, [0, HY - 0.085, 0.105], BROWN, { d: 1 }); // beard
      locks(k, [[-0.05, HY - 0.1, 0.11], [-0.017, HY - 0.11, 0.125], [0.017, HY - 0.11, 0.125], [0.05, HY - 0.1, 0.11]], 0.08, 0.026, BROWN, [0, -1, 0.3], { var: 0.2, alt: 0x8a5430 });
      k.sym(() => k.ell(0.04, 0.015, 0.018, [0.028, HY - 0.05, 0.135], BROWN, { d: 0.5, r: [0, 0.3, -0.3] }));
    });
  }
  // staff in the right hand (ARM_R); the free hand's holy light rides ARM_L
  const top = U ? 0.86 : 0.88;
  k.bone(BONE.ARM_R, SH, () => {
  k.limb([SX, 0.02, SZ], [SX, top, SZ], 0.028, 0.024, U ? CREAM : WOOD, { seg: 6, grad: [0.85, 1.12], hs: 8, paint: (x, y, z, Lh) => (y > Lh * 0.5 && y < Lh * 0.7 && Math.floor(y / 0.02) % 2 ? (U ? GOLD : LEATHER) : null) });
  k.cyl(0.042, 0.048, 0.07, [SX, top - 0.03, SZ], GOLD, { seg: 8 });
  k.cyl(0.034, 0.03, 0.04, [SX, 0.01, SZ], GOLD, { seg: 8 }); // ferrule
  if (!U) {
    k.ball(0.1, [SX, top + 0.1, SZ], 0xffd050, { glow: true, d: 1 });
    k.torus(0.112, 0.02, [SX, top + 0.1, SZ], GOLD, { r: [0, 0.6, 0], seg: 14 });
    k.torus(0.112, 0.02, [SX, top + 0.1, SZ], GOLD, { r: [0, 0.6 + Math.PI / 2, 0], seg: 14 });
    k.torus(0.112, 0.016, [SX, top + 0.1, SZ], GOLD_L, { r: [Math.PI / 2, 0, 0], seg: 14 });
    k.cone(0.024, 0.06, [SX, top + 0.205, SZ], GOLD_L, { seg: 5 });
    // blue ribbons tied under the orb
    for (const sd of [-1, 1]) k.feather([SX, top - 0.01, SZ], [SX + sd * 0.05, top - 0.17, SZ + 0.03], 0.035, sd > 0 ? BLUE_L : BLUE, { t: 0.01 });
    k.bone(BONE.ARM_L, SHL, () => k.ball(0.055, [L[0], L[1] + 0.08, L[2] + 0.02], 0xffe080, { glow: true, d: 1 }));
  } else {
    const c = [SX, top + 0.12, SZ];
    k.torus(0.105, 0.026, c, GOLD, { seg: 16, grad: [0.95, 1.08] });
    k.torus(0.07, 0.012, c, GOLD_L, { seg: 14 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cone(0.03, 0.065, [c[0] + Math.sin(a) * 0.12, c[1] + Math.cos(a) * 0.12, c[2]], i % 2 ? GOLD : GOLD_L, { r: [0, 0, -a], seg: 3 }); }
    k.ball(0.08, c, 0xffc040, { glow: true, d: 1 });
    k.ball(0.05, [c[0], c[1], c[2] + 0.05], 0xfff4c0, { glow: true, d: 0 });
    k.bone(BONE.ARM_L, SHL, () => {
      k.ball(0.05, [L[0], L[1] + 0.06, L[2] + 0.02], 0xffa030, { glow: true, d: 1 });
      k.cone(0.04, 0.13, [L[0], L[1] + 0.07, L[2] + 0.02], 0xfff0a0, { glow: true, seg: 5 });
      k.sym(() => k.cone(0.024, 0.08, [L[0] + 0.035, L[1] + 0.06, L[2] + 0.02], 0xff7a1a, { glow: true, seg: 4, r: [0, 0, -0.35] }));
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
  const HORSE = 0xfbf8f2, HORSE_D = 0xe4ddd2, MANE = U ? 0xf6e2a8 : 0xf0dcb0, MANE_D = U ? 0xe8c878 : 0xdcc090, HOOF = 0xa07e5c, CAP = U ? ROYAL : BLUE;
  const STRAP = U ? CRIMSON : LEATHER, FIT = U ? GOLD_L : GOLD, HELM = U ? STEEL_L : STEEL;
  k.ell(0.2, 0.2, 0.4, [0, 0.64, -0.03], HORSE, { d: 2, grad: [0.85, 1.06] });
  k.ell(0.18, 0.21, 0.18, [0, 0.68, 0.24], HORSE, {});
  // legs: forearm/gaskin, a knee knob, cannon, feathered fetlock and a banded hoof
  const legsAt = [[0.1, 0.3, 0.12, BONE.LEG_FR], [-0.1, 0.24, -0.04, BONE.LEG_FL], [0.1, -0.3, -0.06, BONE.LEG_BR], [-0.1, -0.28, 0.06, BONE.LEG_BL]];
  for (const [x, z, sw, bn] of legsAt) k.bone(bn, [x, 0.6, z], () => {
    const kn = [x, 0.33, z + sw * 0.5], ft = [x, 0.09, z + sw * 0.95];
    k.limb([x, 0.6, z], kn, 0.08, 0.055, HORSE_D, { seg: 7 });
    k.ell(0.056, 0.05, 0.056, kn, HORSE_D, { d: 0.5 });
    k.limb(kn, [x, 0.06, z + sw], 0.05, 0.044, HORSE_D, { seg: 7 });
    locks(k, [0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2; return [x + Math.sin(a) * 0.04, ft[1] + 0.02, ft[2] + Math.cos(a) * 0.04]; }), 0.07, 0.024, MANE, [0, -1, 0], { out: 0.0, alt: MANE_D });
    k.cyl(0.058, 0.05, 0.075, [x, 0.0, z + sw], HOOF, { seg: 8, ao: false, paint: (px, py) => (py > 0.055 ? 0x8a6a4a : null) });
  });
  // neck, mane of locks, big head with eyes, nostrils, forelock and bridle: HEAD from the withers
  k.bone(BONE.HEAD, [0, 0.76, 0.3], () => {
  k.limb([0, 0.74, 0.3], [0, 1.0, 0.47], 0.12, 0.09, HORSE, { seg: 9 });
  k.limb([0, 0.8, 0.235], [0, 1.07, 0.4], 0.055, 0.042, MANE, { seg: 7 });
  for (let i = 0; i < 6; i++) {
    const t = i / 5, p = [0, 0.8 + t * 0.27, 0.235 + t * 0.165];
    for (const sd of [-1, 1]) locks(k, [[sd * 0.03, p[1], p[2]]], 0.12 - t * 0.03, 0.032, (i + (sd > 0 ? 1 : 0)) % 2 ? MANE : MANE_D, [sd * 0.45, -1, -0.35]);
  }
  k.at([0, 1.02, 0.52], [0.95, 0, 0], 1, () => {
    k.ell(0.082, 0.09, 0.19, [0, 0, 0.09], HORSE, { d: 2 });
    k.ell(0.072, 0.075, 0.08, [0, -0.015, 0.24], HORSE_D, {});
    k.ell(0.064, 0.042, 0.16, [0, 0.06, 0.1], U ? GOLD : STEEL, { grad: [0.85, 1.12] }); // chanfron
    k.ball(0.022, [0, 0.1, 0.06], U ? 0x60a0ff : CAP, { d: 1, glow: U }); // chanfron jewel
    if (U) k.cone(0.034, 0.16, [0, 0.09, 0.05], GOLD_L, { r: [-0.55, 0, 0], seg: 6 });
    k.sym(() => {
      k.cone(0.032, 0.1, [0.05, 0.06, -0.04], HORSE, { r: [-0.5, 0, 0.25], seg: 5 });
      k.cone(0.018, 0.07, [0.052, 0.068, -0.034], 0xf4b0a8, { r: [-0.5, 0, 0.25], seg: 4, ao: false }); // inner ear
      // eye with a white catch-light, nostril
      k.ell(0.02, 0.026, 0.024, [0.072, 0.02, 0.03], INK, { d: 0.5, grad: [1, 1], ao: false });
      k.ball(0.007, [0.088, 0.03, 0.038], 0xffffff, { d: 0, ao: false, noise: 0 });
      k.ell(0.012, 0.016, 0.01, [0.04, -0.02, 0.31], 0xb08a8a, { d: 0, ao: false });
      // bridle: cheek strap, noseband, browband, bit ring
      k.box(0.012, 0.02, 0.2, [0.08, 0.0, 0.12], STRAP, { r: [0.35, 0, 0] });
      k.ball(0.018, [0.075, -0.06, 0.25], FIT, { d: 0.5 });
    });
    k.torus(0.074, 0.011, [0, -0.01, 0.22], STRAP, { r: [0, 0, 0], s: [1, 0.9, 1], seg: 12, ts: 3, arc: Math.PI * 2 });
    k.torus(0.08, 0.011, [0, 0.03, -0.03], STRAP, { r: [0.3, 0, 0], seg: 12, ts: 3 });
    // forelock tumbling over the brow
    locks(k, [[-0.025, 0.07, -0.05], [0.025, 0.07, -0.05], [0, 0.08, -0.04]], 0.09, 0.026, MANE, [0, 0.3, 1], { alt: MANE_D });
  });
  if (U) for (let i = 0; i < 2; i++) k.box(0.15, 0.05, 0.11, [0, 0.87 + i * 0.13, 0.33 + i * 0.09], GOLD, { r: [0.95, 0, 0] }); // gold crinet
  });
  // tail: a flowing tail of locks
  k.bone(BONE.TAIL, [0, 0.72, -0.42], () => {
    k.limb([0, 0.72, -0.42], [0, 0.55, -0.55], 0.06, 0.05, MANE);
    k.limb([0, 0.55, -0.55], [0, 0.28, -0.56], 0.05, 0.03, MANE);
    locks(k, [[0, 0.6, -0.53], [0.03, 0.55, -0.55], [-0.03, 0.55, -0.55], [0.015, 0.48, -0.56], [-0.015, 0.48, -0.56]], 0.24, 0.035, MANE, [0, -1, -0.12], { var: 0.18, curl: 0.03, alt: MANE_D });
  });
  // caparison with folds, an embroidered band, a broad gold hem and flank emblems
  const fold = new THREE.Color(CAP).multiplyScalar(0.88).getHex();
  k.lathe([[0.226, 0.4], [0.216, 0.5], [0.2, 0.66], [0.16, 0.78], [0.06, 0.84]], [0, 0, -0.04], CAP, { s: [1, 1, 2.0], seg: 14, grad: [0.84, 1.08], paint: (x, y, z) => (Math.floor((Math.atan2(x, z) + 9) / (Math.PI / 8)) % 2 ? fold : null) });
  k.lathe([[0.234, U ? 0.37 : 0.38], [0.229, 0.43]], [0, 0, -0.04], GOLD, { s: [1, 1, 2.0], seg: 14, grad: [1, 1] });
  k.lathe([[0.226, 0.445], [0.224, 0.465]], [0, 0, -0.04], U ? GOLD_L : WHITE, { s: [1, 1, 2.0], seg: 30, grad: [1, 1], paint: (x, y, z) => (Math.floor((Math.atan2(x, z) + 9) / (Math.PI / 15)) % 2 ? CAP : null) });
  k.sym(() => {
    if (U) sunBadge(k, [0.218, 0.57, -0.12], [0, Math.PI / 2, 0], 1.7);
    else { k.box(0.03, 0.17, 0.055, [0.218, 0.57, -0.12], GOLD, { r: [0, 0, 0.1] }); k.box(0.03, 0.055, 0.16, [0.215, 0.6, -0.12], GOLD, { r: [0, 0, 0.1] }); }
  });
  // breast collar with a medallion
  k.torus(0.19, 0.016, [0, 0.66, 0.2], STRAP, { r: [Math.PI / 2 - 0.25, 0, 0], s: [1, 1, 0.9], seg: 16, ts: 3, arc: Math.PI });
  k.cyl(0.04, 0.04, 0.02, [0, 0.6, 0.39], FIT, { r: [Math.PI / 2 - 0.3, 0, 0], seg: 10 });
  // saddle: seat, high cantle, pommel, stirrup leathers and irons
  k.box(0.28, 0.06, 0.25, [0, 0.84, -0.04], RED, { grad: [0.92, 1.06] });
  k.box(0.22, 0.09, 0.05, [0, 0.88, -0.15], GOLD, {});
  k.box(0.14, 0.06, 0.04, [0, 0.885, 0.085], GOLD, {});
  k.sym(() => {
    k.box(0.016, 0.24, 0.035, [0.145, 0.72, 0.03], STRAP, { r: [0, 0, 0.12] });
    k.torus(0.03, 0.009, [0.162, 0.59, 0.04], FIT, { seg: 6, ts: 3, r: [0, Math.PI / 2, 0] });
  });
  // rider: RIDER pivoting at the saddle; its arms ARM_R / ARM_L, cape CLOTH
  let H;
  k.at([0, 0.47, -0.03], [0, 0, 0], 0.8, () => k.bone(BONE.RIDER, HIPS, () => {
    H = figure(k, {
      sit: true, legs: U ? GOLD : STEEL, boots: STEEL_D, torso: U ? GOLD : STEEL, hips: CAP, upper: STEEL, fore: U ? GOLD : STEEL, hand: STEEL_D, elbow: STEEL_L,
      pauldron: U ? GOLD : STEEL_L, pTrim: U ? GOLD_L : null, lame: false, rh: [0.2, 0.5, 0.14], lh: [-0.2, 0.5, 0.2], head: false, armR: 0.066, cuff: U ? GOLD_L : STEEL_L, cuffB: STEEL_L,
    });
    cape(k, { y0: 0.36, y1: 0.7, r0: 0.27, r1: 0.2, col: U ? 0x4a74f0 : CAPE_B, lin: GOLD, hem: GOLD, arc: 2.2, emb: U ? GOLD_L : null });
    k.lathe([[0.15, 0.7], [0.135, 0.735], [0.1, 0.76]], [0, 0, 0], STEEL_L, { s: [1, 1, 0.85], seg: 10, grad: [0.9, 1.12], paint: stripes(0.018, STEEL, 1, 0.3) }); // gorget
    k.box(0.25, 0.3, 0.03, [0, 0.55, 0.158], CAP, { r: [-0.1, 0, 0] });
    k.at([0, 0.55, 0.158], [-0.1, 0, 0], 1, () => { k.sym(() => k.box(0.016, 0.3, 0.034, [0.118, 0, 0.002], GOLD, {})); });
    belt(k, 0.44, 0.158, 0.04, STRAP, FIT, 0.84);
    if (U) sunBadge(k, [0, 0.57, 0.178], [-0.1, 0, 0], 1.3);
    else { k.box(0.06, 0.2, 0.02, [0, 0.56, 0.175], GOLD, { r: [-0.1, 0, 0] }); k.box(0.16, 0.06, 0.02, [0, 0.6, 0.172], GOLD, { r: [-0.1, 0, 0] }); }
    // helm: rounded great helm, visor slit under a brow ridge, rivets and breaths
    k.lathe([[0, HY - 0.13], [0.135, HY - 0.13], [0.15, HY - 0.06], [0.15, HY + 0.06], [0.11, HY + 0.13], [0, HY + 0.15]], [0, 0, 0], HELM, { seg: 10, grad: [0.8, 1.15] });
    k.box(0.21, 0.036, 0.03, [0, HY + 0.01, 0.146], INK, { grad: [1, 1], ao: false });
    k.box(0.23, 0.024, 0.03, [0, HY + 0.04, 0.147], U ? GOLD : STEEL_L, { grad: [1, 1.1] });
    k.box(0.034, 0.11, 0.03, [0, HY - 0.06, 0.147], U ? GOLD : STEEL_D, { grad: [1, 1] });
    rivets(k, 10, 0.153, HY - 0.115, U ? GOLD_L : STEEL_L, { rr: 0.012 });
    for (let i = 0; i < 3; i++) k.ell(0.008, 0.013, 0.008, [0.07, HY - 0.035 - i * 0.03, 0.137], INK, { d: 0, ao: false, grad: [1, 1] });
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
  // couched lance, thick, with spiral-painted bands, a vamplate and a big striped pennant
  const a = [rh[0] + 0.03, rh[1] - 0.05, rh[2] - 0.3], b = [rh[0] + 0.1, rh[1] + 0.28, rh[2] + (U ? 1.0 : 0.92)];
  const pt = (t) => a.map((v, j) => v + (b[j] - v) * t);
  k.limb(a, b, 0.042, 0.015, U ? GOLD_L : WHITE, { seg: 8, grad: [0.95, 1.08], hs: 8, paint: (x, y, z, Ln) => (y / Ln > 0.35 && (Math.floor(y / 0.06 + (Math.atan2(x, z) / Math.PI) * 1.5 + 9) % 2) ? (U ? ROYAL : CAP) : null) });
  k.limb(pt(0.02), pt(0.13), 0.046, 0.046, STRAP, { seg: 8, hs: 4, paint: (x, y, z, Ln) => (Math.floor((y / Ln) * 4) % 2 ? FIT : null) }); // grip
  k.stick(new THREE.ConeGeometry(0.085, 0.13, 10).rotateX(Math.PI).translate(0, 0.065, 0), [rh[0] + 0.03, rh[1] - 0.04, rh[2] + 0.03], [rh[0] + 0.033, rh[1] - 0.03, rh[2] + 0.16], U ? GOLD : STEEL_L, {});
  const ang = Math.atan2(b[1] - a[1], b[2] - a[2]);
  const PEN = U ? [[0, 0], [0, 0.17], [0.36, 0.13], [0.24, 0.085], [0.36, 0.04]] : [[0, 0], [0, 0.16], [0.28, 0.12], [0.18, 0.08], [0.28, 0.04]];
  k.plate(PEN, 0.012, pt(0.86), CAP, { r: [-ang + Math.PI / 2, Math.PI / 2 + 0.25, Math.PI], grad: [0.9, 1.08], both: true, paint: (x, y) => (Math.abs(y - 0.085) < 0.022 ? (U ? GOLD : WHITE) : null) });
  });
  k.bone(BONE.ARM_L, toW(SHL), () => shield(k, [lhw[0] - 0.04, lhw[1], lhw[2] + 0.03], [0.05, -0.5, 0.04], 0.85, CAP, GOLD, 'sun', GOLD, { rivet: GOLD_L }));
  return k.done();
}

// Angel: golden armour, long white skirt, golden hair, glowing halo, big white
// wings with gold tips, a flaming sword.
// Archangel: royal-blue skirt with a broad gold hem, double halo, bigger wings
// with gold bands, a larger blazing sword.
function angel(U) {
  const ARM = 0xffc844, SKIRT = U ? ROYAL : WHITE, HAIR = 0xffd868, HAIR_D = 0xf0b840, S = 1.2;
  const k = makeKit(U ? 83 : 79, HIPS.map((v) => v * S));
  let H;
  k.at([0, 0, 0], [0, 0, 0], S, () => {
    H = figure(k, {
      legs: ARM, boots: GOLD, torso: ARM, hips: SKIRT, upper: SKIN, fore: ARM, hand: SKIN, elbow: SKIN, pauldron: ARM, pTrim: U ? WHITE : null, lame: U ? GOLD_L : 0xffe08a,
      rh: [0.26, 0.62, 0.2], lh: [-0.23, 0.4, 0.12], head: false, torsoGrad: [0.86, 1.14], stance: 0.07, cuff: U ? GOLD_L : GOLD, cuffB: GOLD_L, sole: 0xd89a2a,
    });
    // sculpted cuirass: pectoral plates, a centre ridge and a belt with a sun buckle
    k.sym(() => k.ell(0.085, 0.07, 0.04, [0.068, 0.6, 0.128], ARM, { r: [-0.2, 0.25, 0], grad: [0.9, 1.15] }));
    k.box(0.016, 0.16, 0.02, [0, 0.55, 0.15], GOLD_L, { r: [-0.15, 0, 0] });
    belt(k, 0.46, 0.155, 0.045, U ? GOLD_L : BLUE, GOLD, 0.8);
    if (U) sunBadge(k, [0, 0.63, 0.17], [-0.25, 0, 0], 1.0, 0x80c8ff);
    k.bone(BONE.CLOTH, [0, 0.46, 0], () => { // long skirt hung from the waist: folds, hem band, embroidery, pteruges
      const fd = new THREE.Color(SKIRT).multiplyScalar(0.9).getHex();
      k.lathe([[0.215, 0.0], [0.205, 0.1], [0.17, 0.3], [0.15, 0.46]], [0, 0, 0], SKIRT, { s: [1, 1, 0.86], seg: 14, grad: [0.88, 1.05], paint: (x, y, z) => (Math.floor((Math.atan2(x, z) + 9) / (Math.PI / 8)) % 2 ? fd : null) });
      k.lathe([[0.222, 0.0], [0.218, U ? 0.07 : 0.05]], [0, 0, 0], U ? GOLD : BLUE, { s: [1, 1, 0.86], seg: 14, grad: [1, 1] });
      k.lathe([[0.214, U ? 0.085 : 0.065], [0.212, U ? 0.105 : 0.08]], [0, 0, 0], U ? GOLD_L : GOLD, { s: [1, 1, 0.86], seg: 28, grad: [1, 1], paint: (x, y, z) => (Math.floor((Math.atan2(x, z) + 9) / (Math.PI / 14)) % 2 ? SKIRT : null) });
      for (let i = 0; i < 12; i++) { // pteruges: gold-tipped strips over the hips
        const a = (i / 12) * Math.PI * 2 + 0.26, r = 0.165;
        k.box(0.06, 0.12, 0.014, [Math.sin(a) * r, 0.39, Math.cos(a) * r * 0.86], i % 2 ? ARM : 0xffe08a, { r: [0.12, a, 0], grad: [0.9, 1.08], paint: (x, y) => (y < -0.04 ? (U ? WHITE : BLUE) : null) });
      }
    });
    // golden hair with flowing locks, face, circlet with a jewel, halo(s): HEAD
    k.bone(BONE.HEAD, NECK, () => {
    k.ell(0.152, 0.152, 0.152, [0, HY + 0.02, -0.025], HAIR, { d: 2, grad: [0.85, 1.12] });
    k.ell(0.135, 0.17, 0.075, [0, HY - 0.1, -0.085], HAIR, {});
    k.ell(0.125, 0.13, 0.12, [0, HY - 0.005, 0.03], SKIN, { d: 2, grad: [0.95, 1.05] });
    face(k, [0, HY - 0.005, 0.03], [0.125, 0.13, 0.12], { ey: 0.005, iris: 0x3a7ae0, brow: HAIR_D, blush: true, browA: 0.05 });
    // curls framing the face and falling down the back
    k.sym(() => locks(k, [[0.12, HY + 0.02, 0.06], [0.13, HY - 0.04, 0.02], [0.12, HY - 0.1, -0.03]], 0.12, 0.034, HAIR, [0.25, -1, -0.1], { var: 0.2, curl: 0.02, alt: HAIR_D }));
    locks(k, [-0.09, -0.045, 0, 0.045, 0.09].map((x) => [x, HY - 0.12, -0.1]), 0.14, 0.04, HAIR, [0, -1, -0.25], { var: 0.18, alt: HAIR_D });
    locks(k, [[-0.06, HY + 0.13, 0.08], [0, HY + 0.15, 0.08], [0.06, HY + 0.13, 0.08]], 0.07, 0.03, HAIR, [0.3, -0.6, 1], { curl: 0.02, alt: HAIR_D }); // fringe
    k.lathe([[0.156, HY + 0.035], [0.156, HY + 0.07]], [0, 0, -0.02], GOLD, { seg: 10, grad: [1, 1] });
    k.ball(0.02, [0, HY + 0.055, 0.135], U ? 0x80c8ff : 0xff6070, { glow: true, d: 0 });
    k.torus(0.13, 0.024, [0, HY + 0.25, -0.05], 0xffe070, { glow: true, r: [Math.PI / 2 - 0.25, 0, 0], seg: 20, ts: 4 });
    if (U) k.torus(0.18, 0.016, [0, HY + 0.23, -0.06], 0xfff6c0, { glow: true, r: [Math.PI / 2 - 0.25, 0, 0], seg: 22, ts: 3 });
    });
  });
  const rh = H.R.map((v) => v * S);
  // flaming sword raised forward: fullered blade, winged guard, wrapped grip, gem pommel
  k.bone(BONE.ARM_R, SH.map((v) => v * S), () => k.at(rh, [0.45, 0, -0.2], U ? 1.4 : 1.2, () => {
    k.box(0.12, 0.04, 0.05, [0, 0.03, 0], GOLD, {});
    k.sym(() => k.plate([[0, 0], [0.09, 0.07], [0.13, 0.03], [0.1, 0.0], [0.12, -0.03], [0.05, -0.02]], 0.02, [0.04, 0.03, 0], GOLD_L, { grad: [0.95, 1.1] }));
    k.limb([0, -0.08, 0], [0, 0.02, 0], 0.022, 0.022, U ? ROYAL : BLUE_D, { seg: 6, hs: 4, paint: (x, y, z, L) => (Math.floor((y / L) * 5) % 2 ? GOLD : null) });
    k.ball(0.032, [0, -0.09, 0], U ? 0x80c8ff : 0xff6070, { d: 1, glow: true });
    k.plate([[-0.042, 0], [0.042, 0], [0.036, 0.48], [0, 0.58], [-0.036, 0.48]], 0.02, [0, 0.05, 0], 0xfff6d0, { r: [0, 0.3, 0], glow: true, paint: (x, y) => (Math.abs(x) < 0.01 && y < 0.44 ? 0xffd890 : null) });
    for (let i = 0; i < 3; i++) {
      const sd = i % 2 ? 1 : -1;
      k.cone(0.05 - i * 0.006, 0.2, [0, 0.1 + i * 0.15, sd * 0.015], i % 2 ? 0xff7a1a : 0xffb030, { glow: true, r: [sd * 0.3, 0.3, sd * 0.12], seg: 5 });
    }
    k.cone(0.035, 0.18, [0, 0.52, 0], 0xffd050, { glow: true, seg: 5 });
  }));
  // great wings sweeping up from the shoulder blades
  k.sym(() => k.bone(BONE.WING_R, [0.1, 0.86, -0.14], () => wing(k, [0.1, 0.86, -0.14], {
    W: [0.32, 0.24, -0.12], T: U ? [0.74, 0.5, -0.32] : [0.66, 0.44, -0.3], len: U ? 0.72 : 0.6, n: 9,
    col: U ? 0xfff6e0 : 0xf6f4ff, tip: U ? GOLD : 0xffd060, cov: WHITE, bone: U ? GOLD_L : 0xfff4d0,
    drop: [0.08, -0.4, -1], dropIn: [0.05, -1, -0.45], prim: 4, stripe: 0.92, shaft: U ? GOLD_L : 0xfff0c0,
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
