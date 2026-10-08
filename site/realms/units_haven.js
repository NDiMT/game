import * as THREE from 'three';

// =====================================================================
// HEX REALMS: Haven (castle) creatures.
// havenModel(id) -> { body, glow } for pikeman, archer, griffin,
// swordsman, monk, cavalier, angel. Facing +z, base at y = 0.
// Everything is built from a small transform-stack kit, painted with
// vertex colours (part gradients, ground occlusion, slight mottling)
// and merged into one body geometry plus one glow geometry.
// =====================================================================

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UPV = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- palette
// bright, saturated, sunny: no near-black anywhere (eyes and slits are deep blue/plum)
const BLUE = 0x2f6cf2, BLUE_D = 0x2a52d0, BLUE_L = 0x70a4ff;
const GOLD = 0xf4c23c, GOLD_D = 0xd09a2c, GOLD_L = 0xffe48e;
const STEEL = 0xd6dde8, STEEL_D = 0xa2acc0, STEEL_L = 0xf2f6ff;
const SKIN = 0xf4c09a, SKIN_D = 0xdc9c78;
const LEATHER = 0xa4683a, LEATHER_D = 0x7c4c2a, WOOD = 0xb07a42, WOOD_D = 0x8a5a32;
const WHITE = 0xfaf6ec, CREAM = 0xf0e4c6, DARK = 0x3a3a6a, RED = 0xe8402e;

// ---------------------------------------------------------------- kit
function makeKit(seed) {
  const parts = [];
  const stack = [new THREE.Matrix4()];
  const k = {
    get M() { return stack[stack.length - 1]; },
    // run fn with an extra transform applied to everything it adds
    with(m, fn) { stack.push(k.M.clone().multiply(m)); fn(); stack.pop(); },
    at(p, r = [0, 0, 0], s = 1, fn) { k.with(mat(p, r, s), fn); },
    // run fn twice, the second time mirrored across x = 0
    sym(fn) { fn(1); k.with(new THREE.Matrix4().makeScale(-1, 1, 1), () => fn(-1)); },
    add(g, col, o = {}) {
      let ng = g.index ? g.toNonIndexed() : g;
      ng.deleteAttribute('normal'); ng.deleteAttribute('uv');
      ng.applyMatrix4(k.M);
      if (k.M.determinant() < 0) flip(ng);
      const pr = { col: new THREE.Color(col), grad: o.grad ?? [0.88, 1.08], glow: !!o.glow, ao: o.ao ?? true, noise: o.noise ?? 0.06, top: o.top };
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
  const out = { body: { p: [], c: [] }, glow: { p: [], c: [] } };
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
        m *= 1 + 0.1 * Math.max(0, ny) - 0.05 * Math.max(0, -ny);
        if (pt.ao) { const a = smooth(0, 0.28, y); ao = 0.8 + 0.2 * a; cool = (1 - a) * 0.06; }
      }
      m *= ao * (1 + (hash3(x + seed, y, z) - 0.5) * 2 * pt.noise);
      let c = pt.col;
      if (pt.top && y > y1 - span * pt.top[1]) c = new THREE.Color(pt.top[0]);
      // coloured (blue-violet) shade near the ground instead of black
      dst.p.push(x, y, z); dst.c.push(c.r * m + cool * 0.4, c.g * m + cool * 0.5, c.b * m + cool);
    }
  }
  const build = ({ p, c }, uv) => {
    if (!p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
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
// Two-bone arm reaching from shoulder s to hand h, elbow pushed toward pole.
function arm(k, s, h, side, c) {
  const L1 = 0.2, L2 = 0.19, S = V3(s), H = V3(h);
  let d = S.distanceTo(H); const dir = H.clone().sub(S).normalize();
  d = Math.min(d, L1 + L2 - 0.005);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pole = new THREE.Vector3(side * 0.8, -0.5, -0.6); pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a)).add(pole.multiplyScalar(hh));
  const Hh = S.clone().add(dir.clone().multiplyScalar(d));
  k.limb(s, E.toArray(), c.upperR ?? 0.045, 0.04, c.upper);
  k.ball(c.elbowR ?? 0.042, E.toArray(), c.elbow ?? c.upper, { d: 0 });
  k.limb(E.toArray(), Hh.toArray(), c.foreR ?? 0.04, c.foreR2 ?? 0.034, c.fore);
  k.ell(0.044, 0.048, 0.044, Hh.toArray(), c.hand, { d: 0 });
  return Hh.toArray();
}

// Standing (or seated) heroic figure, ~1.03 tall with helmet. Returns hand positions.
function figure(k, o) {
  const legs = o.legs, boots = o.boots ?? LEATHER_D;
  // legs
  k.sym((s) => {
    if (o.sit) {
      k.limb([0.08, 0.45, 0], [0.15, 0.42, 0.2], 0.06, 0.05, legs);
      k.limb([0.15, 0.42, 0.2], [0.17, 0.18, 0.12], 0.048, 0.04, legs);
      k.ball(0.052, [0.15, 0.42, 0.2], o.knee ?? legs, { d: 0 });
      k.ell(0.05, 0.05, 0.09, [0.17, 0.15, 0.16], boots, { d: 0 });
    } else {
      const st = o.stance ?? 0.09;
      k.limb([0.075, 0.46, 0], [st, 0.25, 0.02], 0.062, 0.05, legs);
      k.limb([st, 0.25, 0.02], [st + 0.005, 0.07, 0], 0.05, 0.04, legs);
      if (o.knee) k.ball(0.052, [st, 0.255, 0.035], o.knee, { d: 0 });
      k.ell(0.062, 0.058, 0.105, [st + 0.005, 0.055, 0.04], boots, { d: 1, grad: [0.8, 1.1] });
      k.box(0.11, 0.022, 0.18, [st + 0.005, 0.011, 0.035], LEATHER_D, { grad: [1, 1], ao: false });
    }
  });
  // pelvis, torso
  k.ell(0.125, 0.08, 0.095, [0, 0.47, 0], o.hips ?? legs);
  k.lathe([[0.105, 0.44], [0.112, 0.52], [0.14, 0.6], [0.178, 0.69], [0.185, 0.75], [0.145, 0.8], [0.05, 0.835]], [0, 0, 0], o.torso, { s: [1, 1, 0.74], grad: o.torsoGrad ?? [0.8, 1.15] });
  if (o.belt) k.lathe([[0.122, 0.5], [0.124, 0.545]], [0, 0, 0], o.belt, { s: [1, 1, 0.76], grad: [1, 1] });
  if (o.skirt) k.lathe([[o.skirt.r1, o.skirt.y1], [o.skirt.r0, o.skirt.y0]], [0, 0, 0], o.skirt.col, { s: [1, 1, 0.8], grad: [0.7, 1.05] });
  // neck & head
  k.limb([0, 0.79, 0], [0, 0.87, 0.01], 0.045, 0.042, o.neck ?? SKIN_D);
  if (o.head !== false) {
    k.ell(0.1, 0.108, 0.1, [0, 0.92, 0.012], o.skin ?? SKIN, { grad: [0.9, 1.06] });
    k.box(0.024, 0.038, 0.032, [0, 0.905, 0.112], o.skin ?? SKIN, { r: [0.3, 0, 0] });
    if (o.eyes !== false) k.sym(() => k.box(0.02, 0.024, 0.01, [0.038, 0.93, 0.104], DARK, { grad: [1, 1] }));
  }
  // shoulders
  if (o.pauldron) k.sym(() => {
    k.ell(0.1, 0.07, 0.1, [0.185, 0.77, 0], o.pauldron, { r: [0, 0, -0.35], grad: [0.8, 1.15] });
    if (o.pTrim) k.torus(0.088, 0.014, [0.19, 0.748, 0], o.pTrim, { r: [Math.PI / 2, 0, -0.35], seg: 10, grad: [1, 1] });
  });
  // arms
  const ac = { upper: o.upper ?? o.torso, fore: o.fore ?? o.upper ?? o.torso, hand: o.hand ?? SKIN, elbow: o.elbow, upperR: o.armR };
  const R = arm(k, [0.185, 0.745, 0], o.rh ?? [0.2, 0.47, 0.08], 1, ac);
  const L = k.with(new THREE.Matrix4().makeScale(-1, 1, 1), () => { o._L = arm(k, [0.185, 0.745, 0], [-(o.lh ?? [-0.2, 0.47, 0.08])[0], (o.lh ?? [-0.2, 0.47, 0.08])[1], (o.lh ?? [-0.2, 0.47, 0.08])[2]], 1, ac); });
  return { R, L: [-o._L[0], o._L[1], o._L[2]] };
}

// a heater shield in the xy plane, face toward +z
function shield(k, p, r, sc, field, trim, emblem) {
  const outline = [[-0.15, 0.2], [0.15, 0.2], [0.15, 0.04], [0.11, -0.1], [0.0, -0.2], [-0.11, -0.1], [-0.15, 0.04]];
  k.at(p, r, sc, () => {
    k.plate(outline, 0.03, [0, 0, 0], trim, { grad: [0.85, 1.1] });
    k.plate(outline.map(([x, y]) => [x * 0.97, y * 0.97]), 0.012, [0, 0, -0.02], 0xc08a50, { grad: [0.9, 1.05] });
    k.box(0.03, 0.22, 0.03, [0, 0, -0.035], LEATHER, {});
    k.plate(outline.map(([x, y]) => [x * 0.84, y * 0.86 + 0.01]), 0.03, [0, 0, 0.012], field, { grad: [0.8, 1.15] });
    if (emblem === 'cross') {
      k.box(0.045, 0.3, 0.02, [0, 0.015, 0.03], trim, { grad: [0.9, 1.1] });
      k.box(0.2, 0.045, 0.02, [0, 0.07, 0.03], trim, { grad: [1, 1] });
    } else if (emblem === 'sun') {
      k.cyl(0.055, 0.055, 0.02, [0, 0.03, 0.03], trim, { r: [Math.PI / 2, 0, 0], seg: 8 });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cone(0.022, 0.06, [Math.sin(a) * 0.055, 0.03 + Math.cos(a) * 0.055, 0.03], trim, { r: [0, 0, -a], seg: 3 }); }
    }
  });
}

// a big feathered wing: a solid two-layer fan from the arm (shoulder -> wrist -> tip)
// to a scalloped trailing edge in three colour bands, plus loose primaries at the tip.
// W and T are wrist and tip offsets from the shoulder; D is the way the feathers hang.
const smoothU = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
function wing(k, sh, o) {
  const { W, T, len = 0.42, n = 10, col = WHITE, tip = GOLD_L, cov = WHITE, drop = [0, -1, -0.35], dropIn = drop, th = 0.012, prim = 4, bone = cov } = o;
  const S = V3(sh), wrist = S.clone().add(V3(W)), tipP = S.clone().add(V3(T));
  k.limb(S.toArray(), wrist.toArray(), 0.04, 0.03, bone, { seg: 5 });
  k.limb(wrist.toArray(), tipP.toArray(), 0.03, 0.016, bone, { seg: 5 });
  const D = V3(drop).normalize(), Din = V3(dropIn).normalize(), E = tipP.clone().sub(wrist).normalize();
  const tipDir = E.clone().multiplyScalar(0.75).add(D.clone().multiplyScalar(0.35)).normalize();
  const roots = [], ends = [], dirs = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = smoothU((t - 0.4) / 0.6);
    const root = t < 0.4 ? S.clone().lerp(wrist, t / 0.4) : wrist.clone().lerp(tipP, (t - 0.4) / 0.6);
    const dir = (t < 0.4 ? Din.clone().lerp(D, t / 0.4) : D.clone()).lerp(tipDir, u).normalize();
    const L = len * (t < 0.4 ? 0.55 + 0.45 * (t / 0.4) : 1 - 0.55 * u) * (i % 2 ? 0.84 : 1);
    roots.push(root); dirs.push(dir); ends.push(root.clone().add(dir.clone().multiplyScalar(L)));
  }
  const bands = [[0, 0.4, cov, [1.08, 1.0]], [0.4, 0.78, col, [1.04, 0.94]], [0.78, 1, tip, [1, 1]]];
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
    k.add(g, c, { grad: gr, noise: 0.05 });
  }
  // loose primaries fanning past the tip like fingers
  for (let j = 0; j < prim; j++) {
    const i = n - j * 2, r0 = roots[Math.max(0, i)].clone();
    const dir = dirs[Math.max(0, i)].clone().lerp(E, 0.25 - j * 0.05).normalize();
    k.feather(r0.toArray(), r0.clone().add(dir.multiplyScalar(len * (0.7 + j * 0.1))).toArray(), 0.075, tip, { grad: [0.95, 1.1], t: 0.016 });
  }
}

// ---------------------------------------------------------------- creatures
function pikeman() {
  const k = makeKit(11);
  const shaftX = 0.215, shaftZ = 0.13;
  const { R, L } = figure(k, {
    legs: BLUE, boots: LEATHER, torso: BLUE, upper: BLUE_L, fore: BLUE, hand: SKIN, hips: BLUE_D,
    rh: [shaftX - 0.01, 0.6, shaftZ - 0.02], lh: [shaftX - 0.035, 0.82, shaftZ + 0.01], belt: LEATHER, stance: 0.1,
  });
  // puffed, gold-slashed upper sleeves
  k.sym(() => { k.ell(0.07, 0.075, 0.07, [0.2, 0.7, 0], BLUE_L, { r: [0, 0, -0.3] }); k.box(0.022, 0.1, 0.14, [0.215, 0.7, 0], GOLD, { r: [0, 0, -0.3], grad: [1, 1] }); });
  // breastplate (bright polished steel), tassets, gold edging
  k.lathe([[0.13, 0.5], [0.15, 0.58], [0.188, 0.68], [0.194, 0.745], [0.158, 0.8], [0.06, 0.83]], [0, 0, 0.004], STEEL, { s: [1, 1, 0.8], grad: [0.82, 1.2] });
  k.lathe([[0.168, 0.34], [0.14, 0.5]], [0, 0, 0], STEEL, { s: [1, 1, 0.84], grad: [0.85, 1.1], seg: 8 });
  k.lathe([[0.172, 0.334], [0.17, 0.352]], [0, 0, 0], GOLD, { s: [1, 1, 0.85], grad: [1, 1] });
  k.box(0.022, 0.24, 0.02, [0, 0.66, 0.145], GOLD, { r: [-0.25, 0, 0] });
  // red sash across the chest: a bright accent readable at small size
  k.box(0.05, 0.42, 0.335, [0, 0.64, 0.0], RED, { r: [0, 0, 0.75], s: [1, 1, 0.96], grad: [0.9, 1.1] });
  k.sym(() => k.ell(0.09, 0.064, 0.09, [0.185, 0.778, 0], STEEL_L, { r: [0, 0, -0.4] }));
  // kettle helm: dome + wide brim + plume
  k.lathe([[0.215, 0.935], [0.21, 0.95], [0.112, 0.958], [0.115, 1.0], [0.09, 1.05], [0.045, 1.072], [0.0, 1.078]], [0, 0, 0.005], STEEL, { seg: 10, grad: [0.85, 1.2] });
  k.lathe([[0.218, 0.93], [0.218, 0.946]], [0, 0, 0.005], GOLD, { seg: 10, grad: [1, 1] });
  k.box(0.014, 0.12, 0.22, [0, 1.0, 0.005], GOLD_L, { grad: [0.9, 1.1] }); // comb ridge
  k.cone(0.045, 0.2, [0, 1.05, -0.06], RED, { r: [-1.05, 0, 0], seg: 5 });
  k.cone(0.035, 0.16, [0, 1.06, -0.05], WHITE, { r: [-0.75, 0, 0], seg: 5 });
  // halberd: shaft, big axe blade, back spike, top point, pennant
  k.limb([shaftX, 0.02, shaftZ], [shaftX, 1.44, shaftZ], 0.021, 0.018, WOOD, { seg: 5, grad: [0.85, 1.15] });
  k.limb([shaftX, 1.15, shaftZ], [shaftX, 1.24, shaftZ], 0.028, 0.028, GOLD, { seg: 6 });
  k.plate([[0, 0.03], [0.08, 0.0], [0.14, -0.09], [0.19, 0.0], [0.205, 0.09], [0.19, 0.18], [0.14, 0.26], [0.08, 0.17], [0, 0.14]], 0.022, [shaftX + 0.01, 1.12, shaftZ], STEEL_L, { r: [0, -0.25, 0], grad: [0.85, 1.2] });
  k.cone(0.028, 0.15, [shaftX - 0.01, 1.2, shaftZ], STEEL, { r: [0, -0.25, Math.PI / 2 + 0.3], seg: 4 });
  k.cone(0.035, 0.24, [shaftX, 1.42, shaftZ], STEEL_L, { seg: 4, grad: [0.85, 1.2] });
  k.plate([[0, 0], [0, 0.13], [0.22, 0.1], [0.15, 0.065], [0.22, 0.03]], 0.008, [shaftX, 0.98, shaftZ], BLUE, { r: [0, 0.6, 0], grad: [0.9, 1.1], both: true });
  k.plate([[0, 0.125], [0.0, 0.14], [0.225, 0.108], [0.22, 0.1]], 0.01, [shaftX, 0.98, shaftZ], GOLD, { r: [0, 0.6, 0], both: true });
  k.cone(0.034, 0.08, [shaftX, 0.95, shaftZ], GOLD, { r: [Math.PI, 0, 0], seg: 5 });
  return k.done();
}

function archer() {
  const k = makeKit(23);
  const bowP = [-0.13, 0.7, 0.33];
  const { R, L } = figure(k, {
    legs: 0x8a6a40, boots: LEATHER, torso: 0x4caa3c, upper: 0x4caa3c, fore: LEATHER, hand: SKIN, hips: LEATHER_D,
    rh: [0.03, 0.8, 0.12], lh: bowP, belt: GOLD, stance: 0.11, eyes: false,
    skirt: { col: BLUE, r0: 0.15, y0: 0.52, r1: 0.2, y1: 0.31 },
  });
  // blue tabard panel with gold trim, front and back
  for (const z of [1, -1]) {
    k.box(0.19, 0.28, 0.02, [0, 0.66, z * 0.125], BLUE, { r: [z * -0.18, 0, 0] });
    k.box(0.21, 0.028, 0.026, [0, 0.53, z * 0.138], GOLD, { r: [z * -0.18, 0, 0], grad: [1, 1] });
  }
  k.box(0.07, 0.07, 0.02, [0, 0.67, 0.148], GOLD_L, { r: [-0.18, 0, Math.PI / 4] });
  // hood + shoulder cape (royal blue, gold hem) with a red feather
  k.ell(0.124, 0.13, 0.124, [0, 0.935, -0.014], BLUE, { grad: [0.85, 1.15] });
  k.cone(0.065, 0.15, [0, 0.99, -0.08], BLUE, { r: [-2.1, 0, 0], seg: 5 });
  k.lathe([[0.25, 0.65], [0.23, 0.7], [0.16, 0.785], [0.07, 0.85]], [0, 0, -0.01], BLUE, { s: [1, 1, 0.84], grad: [0.85, 1.12], seg: 10 });
  k.lathe([[0.254, 0.636], [0.252, 0.654]], [0, 0, -0.01], GOLD, { s: [1, 1, 0.85], seg: 10, grad: [1, 1] });
  k.feather([0.09, 0.98, -0.02], [0.2, 1.17, -0.12], 0.06, RED, { t: 0.014 });
  // face again in front of the hood
  k.ell(0.084, 0.09, 0.064, [0, 0.915, 0.058], SKIN, { grad: [0.9, 1.05] });
  k.sym(() => k.box(0.02, 0.024, 0.01, [0.034, 0.93, 0.118], DARK, { grad: [1, 1] }));
  k.box(0.024, 0.038, 0.03, [0, 0.902, 0.124], SKIN, { r: [0.3, 0, 0] });
  // quiver on the back with bright fletchings
  k.at([0.08, 0.66, -0.15], [0.35, 0, -0.35], 1, () => {
    k.cyl(0.05, 0.056, 0.36, [0, -0.18, 0], 0xb8743c, { seg: 7, grad: [0.85, 1.1] });
    k.cyl(0.058, 0.058, 0.032, [0, 0.1, 0], GOLD, { seg: 7, grad: [1, 1] });
    k.cyl(0.058, 0.058, 0.026, [0, -0.12, 0], GOLD, { seg: 7, grad: [1, 1] });
    for (let i = 0; i < 5; i++) k.box(0.014, 0.085, 0.034, [Math.sin(i * 1.3) * 0.028, 0.21, Math.cos(i * 1.3) * 0.028], i % 2 ? WHITE : RED, { r: [0, i, 0] });
  });
  // longbow: an arc in the yz plane bowed toward +z, string pulled back to the right hand
  const bowH = 0.58, bend = 0.13;
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8 * 2 - 1; pts.push([bowP[0] + t * t * 0.0, bowP[1] + t * bowH, bowP[2] + (1 - t * t) * bend - bend * 0.8 + Math.abs(t) * t * 0]); }
  for (let i = 0; i < 8; i++) k.limb(pts[i], pts[i + 1], 0.021 - Math.abs(i - 3.5) * 0.0018, 0.021 - Math.abs(i - 3.5) * 0.0018, i === 3 || i === 4 ? RED : WOOD, { seg: 5 });
  k.ball(0.022, pts[0], GOLD, { d: 0 }); k.ball(0.022, pts[8], GOLD, { d: 0 });
  const top = pts[8], bot = pts[0], draw = [R[0], R[1], R[2] - 0.02];
  k.limb(top, draw, 0.005, 0.005, CREAM, { seg: 3 });
  k.limb(bot, draw, 0.005, 0.005, CREAM, { seg: 3 });
  // nocked arrow
  k.limb(draw, [bowP[0] + 0.01, bowP[1] + 0.02, bowP[2] + 0.2], 0.01, 0.01, CREAM, { seg: 3 });
  k.cone(0.018, 0.05, [bowP[0] + 0.01, bowP[1] + 0.02, bowP[2] + 0.2], STEEL, { r: [Math.PI / 2 - 0.6, Math.atan2(bowP[0] - draw[0], 1), 0], seg: 4 });
  return k.done();
}

function griffin() {
  const k = makeKit(37);
  const FUR = 0xeab04a, FUR_D = 0xc2843a, FEATH = 0xfffaf0, BEAK = 0xffc82a, TALON = 0xf4c050, CLAW = 0x7a6a8a;
  // lion body + hindquarters
  k.ell(0.17, 0.16, 0.32, [0, 0.43, -0.07], FUR, { r: [0.08, 0, 0], grad: [0.68, 1.15] });
  k.sym(() => {
    k.ell(0.085, 0.14, 0.13, [0.115, 0.37, -0.25], FUR, { grad: [0.72, 1.12] });
    k.limb([0.125, 0.3, -0.28], [0.135, 0.15, -0.36], 0.065, 0.042, FUR);
    k.limb([0.135, 0.15, -0.36], [0.14, 0.03, -0.3], 0.042, 0.036, FUR_D);
    k.ell(0.05, 0.032, 0.068, [0.14, 0.03, -0.27], FUR_D, { d: 0 });
  });
  // tail with a dark tuft
  k.limb([0, 0.5, -0.36], [0, 0.44, -0.56], 0.032, 0.024, FUR);
  k.limb([0, 0.44, -0.56], [0, 0.58, -0.7], 0.024, 0.018, FUR);
  k.ell(0.05, 0.08, 0.05, [0, 0.63, -0.73], 0xb86a2a, { r: [-0.6, 0, 0] });
  // feathered chest + neck
  k.ell(0.16, 0.18, 0.17, [0, 0.5, 0.17], FEATH, { r: [-0.35, 0, 0], grad: [0.7, 1.08] });
  k.limb([0, 0.55, 0.24], [0, 0.72, 0.36], 0.11, 0.085, FEATH, { seg: 7 });
  // eagle front legs: feathered thighs, golden scaly shins, black talons
  k.sym(() => {
    k.ell(0.075, 0.11, 0.085, [0.1, 0.36, 0.22], FEATH, { r: [0.3, 0, 0] });
    k.limb([0.11, 0.3, 0.25], [0.12, 0.05, 0.31], 0.05, 0.036, TALON);
    k.ell(0.04, 0.028, 0.045, [0.12, 0.035, 0.32], TALON, { d: 0 });
    for (let t = -1; t <= 1; t++) k.cone(0.014, 0.075, [0.12 + t * 0.024, 0.03, 0.34], CLAW, { r: [Math.PI / 2 + 0.3, t * 0.4, 0], seg: 3 });
  });
  // eagle head with golden hooked beak and fierce brows
  const hy = 0.79, hz = 0.42;
  k.ell(0.095, 0.1, 0.115, [0, hy, hz], FEATH, { grad: [0.85, 1.1] });
  k.cone(0.048, 0.14, [0, hy - 0.01, hz + 0.08], BEAK, { r: [Math.PI / 2 - 0.15, 0, 0], seg: 5, grad: [0.9, 1.1] });
  k.cone(0.024, 0.06, [0, hy - 0.02, hz + 0.21], BEAK, { r: [Math.PI - 0.3, 0, 0], seg: 4 });
  k.sym(() => {
    k.ball(0.021, [0.06, hy + 0.025, hz + 0.07], 0xffc030, { d: 0 });
    k.ball(0.013, [0.072, hy + 0.028, hz + 0.087], DARK, { d: 0 });
    k.box(0.06, 0.02, 0.04, [0.055, hy + 0.055, hz + 0.065], 0xd89a3a, { r: [0, -0.2, -0.3] });
  });
  for (let i = 0; i < 5; i++) k.cone(0.032, 0.2 - Math.abs(i - 2) * 0.03, [(i - 2) * 0.03, hy + 0.05, hz - 0.08], i % 2 ? GOLD : FEATH, { r: [-1.75 - Math.abs(i - 2) * 0.12, (i - 2) * 0.25, 0], seg: 4 });
  // golden collar where feathers meet fur
  k.torus(0.14, 0.022, [0, 0.47, 0.06], GOLD, { r: [Math.PI / 2 - 0.5, 0, 0], seg: 12 });
  // great wings raised up and back so the head stays clear
  k.sym(() => wing(k, [0.11, 0.58, 0.06], { W: [0.32, 0.25, -0.06], T: [0.72, 0.42, -0.26], len: 0.46, drop: [0.1, -0.3, -1], dropIn: [0.1, -0.9, -0.6], n: 10, col: 0xe89a34, tip: 0xb85a22, cov: 0xfff0c4, bone: 0xf8dc90, prim: 4 }));
  return k.done();
}

function swordsman() {
  const k = makeKit(41);
  const { R, L } = figure(k, {
    legs: STEEL, knee: GOLD, boots: STEEL_D, torso: STEEL, upper: STEEL, fore: STEEL, hand: STEEL_D, hips: STEEL_D, elbow: STEEL_L,
    rh: [0.23, 0.72, 0.16], lh: [-0.2, 0.55, 0.2], belt: LEATHER, pauldron: STEEL_L, pTrim: GOLD, stance: 0.105, armR: 0.052, head: false,
  });
  // royal-blue cape from the shoulders, gold hem and a big gold cross: the back view reads at a glance
  k.lathe([[0.2, 0.1], [0.205, 0.3], [0.2, 0.55], [0.205, 0.72], [0.15, 0.81]], [0, 0, -0.01], BLUE, { s: [1.05, 1, 0.82], seg: 6, phi: Math.PI - 1.15, len: 2.3, grad: [0.85, 1.12], both: true });
  k.lathe([[0.21, 0.09], [0.21, 0.13]], [0, 0, -0.01], GOLD, { s: [1.05, 1, 0.83], seg: 6, phi: Math.PI - 1.17, len: 2.34, both: true });
  k.box(0.05, 0.36, 0.02, [0, 0.47, -0.178], GOLD, { r: [0.03, 0, 0] });
  k.box(0.22, 0.05, 0.02, [0, 0.58, -0.176], GOLD, { r: [0.03, 0, 0] });
  // tabard front and back with gold trim and cross
  for (const z of [1, -1]) {
    k.box(0.2, 0.42, 0.02, [0, 0.52, z * 0.118], BLUE, { r: [z * -0.12, 0, 0], grad: [0.65, 1.1] });
    k.box(0.21, 0.025, 0.025, [0, 0.315, z * 0.143], GOLD, { grad: [1, 1] });
  }
  k.box(0.035, 0.2, 0.02, [0, 0.58, 0.137], GOLD, { r: [-0.12, 0, 0] });
  k.box(0.13, 0.035, 0.02, [0, 0.63, 0.13], GOLD, { r: [-0.12, 0, 0] });
  // great helm with visor slit, gold cross and a blue plume
  k.lathe([[0.0, 0.83], [0.1, 0.83], [0.112, 0.87], [0.112, 0.97], [0.1, 1.02], [0.0, 1.03]], [0, 0, 0.005], STEEL, { seg: 9, grad: [0.75, 1.2] });
  k.box(0.17, 0.02, 0.02, [0, 0.935, 0.112], DARK, { grad: [1, 1] });
  k.box(0.022, 0.12, 0.02, [0, 0.9, 0.112], GOLD, { grad: [1, 1] });
  k.lathe([[0.115, 0.95], [0.115, 0.965]], [0, 0, 0.005], GOLD, { seg: 9, grad: [1, 1] });
  k.cyl(0.03, 0.03, 0.04, [0, 1.02, 0], GOLD, { seg: 6 });
  k.cone(0.055, 0.26, [0, 1.04, -0.01], WHITE, { r: [-0.45, 0, 0], seg: 5 });
  k.cone(0.05, 0.24, [0, 1.04, -0.03], BLUE_L, { r: [-0.9, 0, 0], seg: 5 });
  k.cone(0.045, 0.22, [0, 1.03, -0.05], RED, { r: [-1.3, 0, 0], seg: 5 });
  // arming sword raised in the right hand
  k.at(R, [0.45, 0, -0.15], 1, () => {
    k.box(0.2, 0.03, 0.04, [0, 0.03, 0], GOLD, { grad: [0.9, 1.1] });
    k.limb([0, -0.07, 0], [0, 0.02, 0], 0.018, 0.018, LEATHER, { seg: 5 });
    k.ball(0.026, [0, -0.08, 0], GOLD, { d: 0 });
    k.plate([[-0.032, 0], [0.032, 0], [0.028, 0.5], [0, 0.57], [-0.028, 0.5]], 0.014, [0, 0.045, 0], STEEL_L, { r: [0, Math.PI / 2, 0], grad: [0.9, 1.25] });
    k.box(0.006, 0.4, 0.016, [0, 0.27, 0], 0xb8c8ff, { r: [0, Math.PI / 2, 0] }); // fuller
  });
  // shield on the left arm
  shield(k, [L[0] - 0.03, L[1] + 0.02, L[2] + 0.05], [0.05, -0.35, 0.05], 1.2, BLUE, GOLD, 'cross');
  return k.done();
}

function monk() {
  const k = makeKit(53);
  const ROBE = 0xf6eedc, ROBE_D = 0xdcc8a0;
  const staff = [0.22, 0, 0.12];
  const { R, L } = figure(k, {
    legs: ROBE_D, boots: LEATHER, torso: ROBE, upper: ROBE, fore: ROBE, hand: SKIN, hips: ROBE,
    rh: [staff[0] - 0.012, 0.72, staff[2]], lh: [-0.17, 0.7, 0.22], belt: GOLD, armR: 0.055,
  });
  // long flared robe to the ground with gold hem
  k.lathe([[0.235, 0.0], [0.225, 0.06], [0.18, 0.25], [0.145, 0.44], [0.13, 0.52]], [0, 0, 0], ROBE, { s: [1, 1, 0.88], seg: 10, grad: [0.85, 1.05] });
  k.lathe([[0.242, 0.0], [0.238, 0.035]], [0, 0, 0], GOLD, { s: [1, 1, 0.88], seg: 10, grad: [1, 1] });
  // blue scapular with gold trim down the front and back, following the robe
  const scap = [[0.246, 0.035], [0.234, 0.08], [0.19, 0.25], [0.155, 0.44], [0.142, 0.52], [0.152, 0.6], [0.19, 0.69], [0.196, 0.75], [0.13, 0.815]];
  for (const ph of [0, Math.PI]) {
    k.lathe(scap, [0, 0, 0], BLUE, { s: [1, 1, 0.84], seg: 2, phi: ph - 0.3, len: 0.6, grad: [0.7, 1.1] });
    k.lathe([[0.252, 0.035], [0.248, 0.07]], [0, 0, 0], GOLD, { s: [1, 1, 0.85], seg: 2, phi: ph - 0.32, len: 0.64, grad: [1, 1] });
  }
  // gold sun medallions on chest and back
  for (const z of [1, -1]) {
    k.cyl(0.05, 0.05, 0.02, [0, 0.64, z * 0.14], GOLD, { r: [Math.PI / 2 * z - z * 0.25, 0, 0], seg: 8 });
    k.cyl(0.026, 0.026, 0.024, [0, 0.64, z * 0.142], GOLD_L, { r: [Math.PI / 2 * z - z * 0.25, 0, 0], seg: 6 });
  }
  // cowl (hood down) around the neck, blue lined
  k.torus(0.11, 0.05, [0, 0.815, -0.01], BLUE, { r: [Math.PI / 2 + 0.25, 0, 0], seg: 10, ts: 5, s: [1.1, 1, 1] });
  // tonsure: bald top with a ring of hair, short beard
  k.ell(0.098, 0.075, 0.076, [0, 0.905, -0.03], 0xa0663a, {});
  k.ell(0.066, 0.06, 0.05, [0, 0.855, 0.075], 0xa0663a, { d: 1 });
  // staff with a gold cage and a glowing orb
  k.limb([staff[0], 0.02, staff[2]], [staff[0], 1.2, staff[2]], 0.022, 0.018, WOOD, { seg: 5, grad: [0.85, 1.15] });
  k.cyl(0.03, 0.035, 0.05, [staff[0], 1.17, staff[2]], GOLD, { seg: 6 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    k.limb([staff[0], 1.21, staff[2]], [staff[0] + Math.sin(a) * 0.075, 1.3, staff[2] + Math.cos(a) * 0.075], 0.008, 0.008, GOLD, { seg: 3 });
    k.limb([staff[0] + Math.sin(a) * 0.075, 1.3, staff[2] + Math.cos(a) * 0.075], [staff[0] + Math.sin(a) * 0.03, 1.4, staff[2] + Math.cos(a) * 0.03], 0.008, 0.008, GOLD, { seg: 3 });
  }
  k.ball(0.08, [staff[0], 1.31, staff[2]], 0xffd050, { glow: true, d: 1 });
  for (let i = 0; i < 4; i++) { const a = i * 1.7; k.ball(0.014, [staff[0] + Math.sin(a) * 0.12, 1.28 + i * 0.03, staff[2] + Math.cos(a) * 0.12], 0xffe890, { glow: true, d: 0 }); }
  // a small blessing glow in the raised left hand
  k.ball(0.04, [L[0], L[1] + 0.07, L[2] + 0.02], 0xffe080, { glow: true, d: 1 });
  return k.done();
}

function cavalier() {
  const k = makeKit(67);
  const HORSE = 0xfbf8f2, HORSE_D = 0xe2dcd2, MANE = 0xf4e2b4, HOOF = 0x9a7a5a;
  // horse body
  k.ell(0.17, 0.18, 0.4, [0, 0.66, -0.02], HORSE, { grad: [0.75, 1.1] });
  k.ell(0.16, 0.19, 0.17, [0, 0.7, 0.25], HORSE, {});
  // legs: front ones striding a little
  const legsAt = [[0.1, 0.3, 0.12], [-0.1, 0.24, -0.04], [0.1, -0.3, -0.06], [-0.1, -0.28, 0.06]];
  for (const [x, z, sw] of legsAt) {
    k.limb([x, 0.62, z], [x, 0.34, z + sw * 0.5], 0.07, 0.045, HORSE_D);
    k.limb([x, 0.34, z + sw * 0.5], [x, 0.06, z + sw], 0.035, 0.03, HORSE_D);
    k.cyl(0.045, 0.04, 0.07, [x, 0.0, z + sw], HOOF, { seg: 6, ao: false });
    k.cyl(0.044, 0.044, 0.04, [x, 0.065, z + sw], MANE, { seg: 6 }); // fetlock feathering
  }
  // neck, head, ears, chanfron
  k.limb([0, 0.74, 0.3], [0, 1.0, 0.48], 0.11, 0.08, HORSE, { seg: 7 });
  k.at([0, 1.02, 0.53], [0.9, 0, 0], 1, () => {
    k.ell(0.065, 0.075, 0.17, [0, 0, 0.08], HORSE, {});
    k.ell(0.058, 0.062, 0.07, [0, -0.012, 0.22], HORSE_D, {});
    k.ell(0.05, 0.035, 0.13, [0, 0.045, 0.1], STEEL, { grad: [0.8, 1.2] }); // chanfron
    k.box(0.02, 0.02, 0.2, [0, 0.07, 0.1], GOLD, {});
    k.cone(0.02, 0.09, [0, 0.07, 0.03], GOLD, { r: [-0.7, 0, 0], seg: 4 }); // spike
    k.sym(() => { k.cone(0.025, 0.08, [0.045, 0.05, -0.04], HORSE, { r: [-0.5, 0, 0.25], seg: 4 }); k.ball(0.016, [0.068, 0.02, 0.08], DARK, { d: 0 }); });
  });
  // mane and tail
  for (let i = 0; i < 5; i++) { const t = i / 4; k.box(0.03, 0.08, 0.07, [0, 0.86 + t * 0.2, 0.33 + t * 0.17 - 0.06], MANE, { r: [0.7, 0, 0] }); }
  k.limb([0, 0.74, -0.4], [0, 0.55, -0.52], 0.05, 0.04, MANE);
  k.limb([0, 0.55, -0.52], [0, 0.25, -0.52], 0.045, 0.02, MANE);
  // caparison: blue barding draped over the body, gold hem, plus a gold-fringed saddle
  k.lathe([[0.215, 0.42], [0.205, 0.5], [0.19, 0.68], [0.15, 0.8], [0.06, 0.85]], [0, 0, -0.04], BLUE, { s: [1, 1, 2.05], seg: 10, grad: [0.8, 1.12] });
  for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2; k.cone(0.03, 0.06, [Math.sin(a) * 0.222, 0.36, -0.04 + Math.cos(a) * 0.222 * 2.05], i % 2 ? GOLD : WHITE, { r: [Math.PI, 0, 0], seg: 3 }); } // dagged hem
  k.lathe([[0.222, 0.405], [0.218, 0.44]], [0, 0, -0.04], GOLD, { s: [1, 1, 2.05], seg: 10, grad: [1, 1] });
  k.sym(() => { // gold cross on each flank
    k.box(0.02, 0.13, 0.035, [0.205, 0.6, -0.12], GOLD, { r: [0, 0, 0.12] });
    k.box(0.02, 0.035, 0.11, [0.2, 0.63, -0.12], GOLD, { r: [0, 0, 0.12] });
  });
  k.box(0.25, 0.05, 0.23, [0, 0.85, -0.04], RED, { grad: [0.9, 1.1] });
  k.box(0.21, 0.085, 0.045, [0, 0.89, -0.15], GOLD, {}); // cantle
  // rider, seated, at 0.8 scale
  let H;
  k.at([0, 0.5, -0.03], [0, 0, 0], 0.82, () => {
    H = figure(k, {
      sit: true, legs: STEEL, knee: STEEL_L, boots: STEEL_D, torso: STEEL, upper: STEEL, fore: STEEL, hand: STEEL_D, hips: BLUE_D, elbow: STEEL_L,
      rh: [0.19, 0.6, 0.12], lh: [-0.17, 0.6, 0.18], pauldron: STEEL_L, pTrim: GOLD, armR: 0.052, head: false,
    });
    // short blue cape over the horse's croup
    k.lathe([[0.22, 0.42], [0.2, 0.6], [0.2, 0.72], [0.15, 0.81]], [0, 0, -0.01], BLUE, { s: [1.05, 1, 0.85], seg: 5, phi: Math.PI - 1.1, len: 2.2, grad: [0.85, 1.12], both: true });
    k.lathe([[0.225, 0.4], [0.225, 0.44]], [0, 0, -0.01], GOLD, { s: [1.05, 1, 0.86], seg: 5, phi: Math.PI - 1.12, len: 2.24, both: true });
    k.box(0.2, 0.32, 0.02, [0, 0.6, 0.118], BLUE, { r: [-0.1, 0, 0] });
    k.box(0.035, 0.18, 0.02, [0, 0.62, 0.13], GOLD, { r: [-0.1, 0, 0] });
    k.box(0.12, 0.035, 0.02, [0, 0.66, 0.127], GOLD, { r: [-0.1, 0, 0] });
    // sallet-style helm with visor and tall plume
    k.lathe([[0.0, 0.83], [0.1, 0.83], [0.112, 0.88], [0.112, 0.96], [0.08, 1.02], [0.0, 1.04]], [0, 0, 0.005], STEEL, { seg: 9, grad: [0.75, 1.2] });
    k.box(0.16, 0.02, 0.02, [0, 0.93, 0.11], DARK, { grad: [1, 1] });
    k.lathe([[0.115, 0.95], [0.115, 0.965]], [0, 0, 0.005], GOLD, { seg: 9, grad: [1, 1] });
    k.cone(0.06, 0.3, [0, 1.0, -0.03], WHITE, { r: [-0.45, 0, 0], seg: 5 });
    k.cone(0.055, 0.28, [0, 1.01, -0.05], BLUE_L, { r: [-0.95, 0, 0], seg: 5 });
    k.cone(0.05, 0.24, [0, 1.0, -0.07], RED, { r: [-1.35, 0, 0], seg: 5 });
  });
  const toW = (p) => [p[0] * 0.82, 0.5 + p[1] * 0.82, -0.03 + p[2] * 0.82];
  const rh = toW(H.R), lhw = toW(H.L);
  // couched lance with vamplate and pennant
  const a = [rh[0] + 0.03, rh[1] - 0.06, rh[2] - 0.3], b = [rh[0] + 0.1, rh[1] + 0.3, rh[2] + 0.92];
  k.limb(a, b, 0.034, 0.012, WHITE, { seg: 6, grad: [0.95, 1.1] });
  k.stick(new THREE.ConeGeometry(0.065, 0.12, 7).rotateX(Math.PI).translate(0, 0.06, 0), [rh[0] + 0.03, rh[1] - 0.04, rh[2] + 0.03], [rh[0] + 0.033, rh[1] - 0.03, rh[2] + 0.15], STEEL_L, {});
  for (let i = 0; i < 3; i++) { const t = 0.4 + i * 0.12; k.limb(a.map((v, j) => v + (b[j] - v) * t), a.map((v, j) => v + (b[j] - v) * (t + 0.03)), 0.019, 0.017, BLUE, { seg: 6 }); }
  const pt = (t) => a.map((v, j) => v + (b[j] - v) * t);
  const p0 = pt(0.78), p1 = pt(0.9);
  k.plate([[0, 0], [0, 0.14], [0.22, 0.1], [0.14, 0.07], [0.22, 0.035]], 0.008, p1, BLUE, { r: [-Math.atan2(b[1] - a[1], b[2] - a[2]) + Math.PI / 2, Math.PI / 2 + 0.25, Math.PI], grad: [0.9, 1.1], both: true });
  k.cone(0.015, 0.06, pt(1), STEEL_L, { r: [Math.PI / 2 - Math.atan2(b[1] - a[1], b[2] - a[2]), 0, 0], seg: 4 });
  // kite shield on the left
  shield(k, [lhw[0] - 0.04, lhw[1], lhw[2] + 0.02], [0.05, -0.5, 0.04], 0.9, BLUE, GOLD, 'sun');
  return k.done();
}

function angel() {
  const k = makeKit(79);
  const ARM = 0xffc844, ROBE = 0xffffff, HAIR = 0xffd868;
  let H;
  k.at([0, 0, 0], [0, 0, 0], 1.22, () => {
    H = figure(k, {
      legs: ARM, boots: GOLD, torso: ARM, upper: SKIN, fore: ARM, hand: SKIN, hips: ROBE, elbow: SKIN,
      rh: [0.24, 0.86, 0.22], lh: [-0.21, 0.5, 0.12], pauldron: ARM, head: false, pTrim: WHITE, belt: BLUE, torsoGrad: [0.8, 1.25], stance: 0.07,
    });
    // long white skirt flowing to the ground with blue and gold hems; golden sandals peek out in front
    k.lathe([[0.19, 0.0], [0.18, 0.1], [0.145, 0.3], [0.125, 0.52]], [0, 0, 0], ROBE, { s: [1, 1, 0.85], seg: 10, grad: [0.9, 1.05] });
    k.lathe([[0.196, 0.0], [0.192, 0.045]], [0, 0, 0], BLUE, { s: [1, 1, 0.86], seg: 10, grad: [1, 1] });
    k.lathe([[0.194, 0.045], [0.19, 0.06]], [0, 0, 0], GOLD, { s: [1, 1, 0.86], seg: 10, grad: [1, 1] });
    k.sym(() => k.ell(0.05, 0.035, 0.07, [0.07, 0.03, 0.14], GOLD, { d: 1 }));
    k.lathe([[0.15, 0.25], [0.142, 0.4], [0.13, 0.5]], [0, 0, 0], ARM, { s: [1, 1, 0.9], seg: 10, phi: -0.9, len: 1.8, grad: [0.8, 1.15] }); // front plates
    // golden hair and a circlet
    k.ell(0.1, 0.11, 0.1, [0, 0.94, -0.02], HAIR, { grad: [0.75, 1.15] });
    k.ell(0.09, 0.14, 0.05, [0, 0.82, -0.07], HAIR, {});
    k.lathe([[0.097, 0.945], [0.097, 0.96]], [0, 0, 0.01], GOLD, { seg: 9, grad: [1, 1] });
    k.ell(0.088, 0.098, 0.092, [0, 0.912, 0.015], SKIN, { grad: [0.85, 1.05] });
    k.box(0.02, 0.032, 0.03, [0, 0.9, 0.105], SKIN, { r: [0.3, 0, 0] });
    k.sym(() => k.box(0.017, 0.02, 0.01, [0.032, 0.915, 0.103], 0x3a5ab8, { grad: [1, 1] }));
    // halo
    k.torus(0.11, 0.014, [0, 1.12, -0.03], 0xffe070, { glow: true, r: [Math.PI / 2 - 0.2, 0, 0], seg: 16, ts: 3 });
  });
  const toW = (p) => [p[0] * 1.22, p[1] * 1.22, p[2] * 1.22];
  const rh = toW(H.R);
  // flaming sword raised forward
  k.at(rh, [0.6, 0, -0.25], 1.15, () => {
    k.box(0.17, 0.028, 0.04, [0, 0.03, 0], GOLD, {});
    k.cone(0.03, 0.05, [0.085, 0.03, 0], GOLD, { r: [0, 0, -Math.PI / 2], seg: 4 });
    k.cone(0.03, 0.05, [-0.085, 0.03, 0], GOLD, { r: [0, 0, Math.PI / 2], seg: 4 });
    k.limb([0, -0.07, 0], [0, 0.02, 0], 0.017, 0.017, BLUE_D, { seg: 5 });
    k.ball(0.024, [0, -0.08, 0], GOLD, { d: 0 });
    k.plate([[-0.028, 0], [0.028, 0], [0.024, 0.48], [0, 0.56], [-0.024, 0.48]], 0.014, [0, 0.045, 0], 0xfff6d0, { r: [0, Math.PI / 2, 0], glow: true });
    // flames licking up the blade
    for (let i = 0; i < 6; i++) {
      const y = 0.08 + i * 0.075, sd = i % 2 ? 1 : -1;
      k.cone(0.03 - i * 0.002, 0.13 + (i % 3) * 0.03, [0, y, sd * 0.012], i % 2 ? 0xff7a1a : 0xffb030, { glow: true, r: [sd * 0.35, 0, sd * 0.15], seg: 4 });
    }
    k.cone(0.025, 0.16, [0, 0.52, 0], 0xffd050, { glow: true, seg: 4 });
  });
  // great wings sweeping up from the shoulder blades
  k.sym(() => wing(k, [0.08, 0.92, -0.12], { W: [0.34, 0.28, -0.14], T: [0.74, 0.56, -0.32], len: 0.66, n: 12, col: 0xf6f4ff, tip: 0xffd060, cov: 0xffffff, bone: 0xfff4d0, drop: [0.05, -0.35, -1], dropIn: [0.05, -1, -0.45], prim: 4 }));
  return k.done();
}

const BUILDERS = { pikeman, archer, griffin, swordsman, monk, cavalier, angel };
export const HAVEN_IDS = Object.keys(BUILDERS);
export function havenModel(id) {
  const f = BUILDERS[id];
  return f ? f() : null;
}
