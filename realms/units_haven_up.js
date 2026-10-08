import * as THREE from 'three';

// =====================================================================
// HEX REALMS: upgraded Haven creatures (round 2).
// havenUpModel(id) -> { body, glow } for halberdier, marksman, royalgriffin,
// crusader, zealot, champion, archangel. Kit copied from units_haven.js. Facing +z, base at y = 0.
// Everything is built from a small transform-stack kit, painted with
// vertex colours (part gradients, ground occlusion, slight mottling)
// and merged into one body geometry plus one glow geometry.
// =====================================================================

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UPV = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- palette
const BLUE = 0x3a6ad8, BLUE_D = 0x23409a, BLUE_L = 0x6a96f0;
const GOLD = 0xe8b840, GOLD_D = 0xb07e22, GOLD_L = 0xffe08a;
const STEEL = 0xc4cad6, STEEL_D = 0x7c8494, STEEL_L = 0xe8ecf4;
const SKIN = 0xe9b48e, SKIN_D = 0xc88a66;
const LEATHER = 0x7a4a26, LEATHER_D = 0x4e2e18, WOOD = 0x8a5a32, WOOD_D = 0x5a3a20;
const WHITE = 0xf4f0e6, CREAM = 0xe8dcc0, DARK = 0x3a3446, RED = 0xc23a2a;

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
      parts.push({ g: ng, col: new THREE.Color(col), grad: o.grad ?? [0.8, 1.08], glow: !!o.glow, ao: o.ao ?? true, noise: o.noise ?? 0.06, top: o.top });
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
      let m = pt.grad[0] + (pt.grad[1] - pt.grad[0]) * ((y - y0) / span);
      if (pt.ao && !pt.glow) m *= 0.74 + 0.26 * smooth(0, 0.3, y);
      m *= 1 + (hash3(x + seed, y, z) - 0.5) * 2 * pt.noise;
      let c = pt.col;
      if (pt.top && y > y1 - span * pt.top[1]) c = new THREE.Color(pt.top[0]);
      dst.p.push(x, y, z); dst.c.push(c.r * m, c.g * m, c.b * m);
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
  k.ell(0.036, 0.04, 0.036, Hh.toArray(), c.hand, { d: 0 });
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
      k.ell(0.055, 0.05, 0.095, [st + 0.005, 0.05, 0.035], boots, { d: 1, grad: [0.7, 1.05] });
      k.box(0.1, 0.02, 0.17, [st + 0.005, 0.01, 0.03], DARK, { grad: [1, 1] });
    }
  });
  // pelvis, torso
  k.ell(0.125, 0.08, 0.095, [0, 0.47, 0], o.hips ?? legs);
  k.lathe([[0.105, 0.44], [0.115, 0.52], [0.135, 0.6], [0.16, 0.69], [0.165, 0.75], [0.13, 0.8], [0.05, 0.83]], [0, 0, 0], o.torso, { s: [1, 1, 0.72], grad: o.torsoGrad ?? [0.75, 1.15] });
  if (o.belt) k.lathe([[0.122, 0.5], [0.124, 0.545]], [0, 0, 0], o.belt, { s: [1, 1, 0.76], grad: [1, 1] });
  if (o.skirt) k.lathe([[o.skirt.r1, o.skirt.y1], [o.skirt.r0, o.skirt.y0]], [0, 0, 0], o.skirt.col, { s: [1, 1, 0.8], grad: [0.7, 1.05] });
  // neck & head
  k.limb([0, 0.79, 0], [0, 0.87, 0.01], 0.045, 0.042, o.neck ?? SKIN_D);
  if (o.head !== false) {
    k.ell(0.092, 0.1, 0.095, [0, 0.915, 0.012], o.skin ?? SKIN, { grad: [0.85, 1.05] });
    k.box(0.022, 0.035, 0.03, [0, 0.9, 0.105], o.skin ?? SKIN, { r: [0.3, 0, 0] });
    if (o.eyes !== false) k.sym(() => k.box(0.018, 0.022, 0.01, [0.035, 0.925, 0.098], DARK, { grad: [1, 1] }));
  }
  // shoulders
  if (o.pauldron) k.sym(() => {
    k.ell(0.085, 0.06, 0.085, [0.165, 0.765, 0], o.pauldron, { r: [0, 0, -0.35], grad: [0.75, 1.15] });
    if (o.pTrim) k.torus(0.075, 0.012, [0.17, 0.745, 0], o.pTrim, { r: [Math.PI / 2, 0, -0.35], seg: 10, grad: [1, 1] });
  });
  // arms
  const ac = { upper: o.upper ?? o.torso, fore: o.fore ?? o.upper ?? o.torso, hand: o.hand ?? SKIN, elbow: o.elbow, upperR: o.armR };
  const R = arm(k, [0.17, 0.745, 0], o.rh ?? [0.2, 0.47, 0.08], 1, ac);
  const L = k.with(new THREE.Matrix4().makeScale(-1, 1, 1), () => { o._L = arm(k, [0.17, 0.745, 0], [-(o.lh ?? [-0.2, 0.47, 0.08])[0], (o.lh ?? [-0.2, 0.47, 0.08])[1], (o.lh ?? [-0.2, 0.47, 0.08])[2]], 1, ac); });
  return { R, L: [-o._L[0], o._L[1], o._L[2]] };
}

// a heater shield in the xy plane, face toward +z
function shield(k, p, r, sc, field, trim, emblem) {
  const outline = [[-0.15, 0.2], [0.15, 0.2], [0.15, 0.04], [0.11, -0.1], [0.0, -0.2], [-0.11, -0.1], [-0.15, 0.04]];
  k.at(p, r, sc, () => {
    k.plate(outline, 0.03, [0, 0, 0], trim, { grad: [0.85, 1.1] });
    k.plate(outline.map(([x, y]) => [x * 0.97, y * 0.97]), 0.012, [0, 0, -0.02], LEATHER, { grad: [0.7, 1.05] });
    k.box(0.03, 0.22, 0.03, [0, 0, -0.035], LEATHER_D, {});
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

// ---------------------------------------------------------------- upgrade extras
const CRIMSON = 0xd23a3a, CRIMSON_D = 0xa02a30, ROYAL = 0x2f5ad8, ROYAL_L = 0x5a8cf8;
const GEM_B = 0x7ad8ff, GEM_R = 0xff6a5a, HOLY = 0xfff0a0;

// a cape hanging behind the shoulders: an outer sheet, a lining (reversed so it
// shows from the front), and a gold hem. Lathe arc centred on -z.
function cape(k, o) {
  const { y0 = 0.22, y1 = 0.8, r0 = 0.27, r1 = 0.15, col = BLUE, lin = GOLD_D, hem = GOLD, arc = 2.3, sz = 0.85, z = -0.01, seg = 7 } = o;
  const prof = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4; prof.push([r0 + (r1 - r0) * Math.pow(t, 1.3), y0 + (y1 - y0) * t]); }
  const phi = Math.PI - arc / 2, at = [0, 0, z];
  k.lathe(prof, at, col, { s: [1, 1, sz], seg, phi, len: arc, grad: [0.8, 1.12] });
  k.lathe(prof.map(([r, y]) => [r * 0.965, y]).reverse(), at, lin, { s: [1, 1, sz], seg, phi, len: arc, grad: [0.85, 1.1] });
  k.lathe([[r0 + 0.006, y0 - 0.005], [r0 * 0.99 + 0.004, y0 + 0.04]], at, hem, { s: [1, 1, sz], seg, phi: phi - 0.02, len: arc + 0.04, grad: [1, 1], ao: false });
  k.lathe([[r0 * 0.99 + 0.004, y0 + 0.04], [r0 + 0.006, y0 - 0.005]].map(([r, y]) => [r * 0.96, y]), at, hem, { s: [1, 1, sz], seg, phi: phi - 0.02, len: arc + 0.04, grad: [1, 1], ao: false });
}

// a gold sunburst medallion facing +z with a glowing gem
function sunBadge(k, p, r, gem = GEM_B, sc = 1) {
  k.at(p, r, sc, () => {
    k.cyl(0.04, 0.04, 0.015, [0, 0, 0], GOLD_L, { r: [Math.PI / 2, 0, 0], seg: 8, grad: [1, 1], ao: false });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cone(0.014, 0.04, [Math.sin(a) * 0.036, Math.cos(a) * 0.036, 0], GOLD, { r: [0, 0, -a], seg: 3, ao: false }); }
    k.ball(0.02, [0, 0, 0.012], gem, { glow: true, d: 0 });
  });
}

// a flowing plume: a chain of cones, two colours
function plume(k, p, n, c1, c2, sc = 1) {
  for (let i = 0; i < n; i++) k.cone(0.045 * sc, (0.2 + i * 0.02) * sc, p, i % 2 ? c2 : c1, { r: [-0.35 - i * 0.32, 0, (i - (n - 1) / 2) * 0.12], seg: 5 });
}

// ---------------------------------------------------------------- creatures
function halberdier() {
  const k = makeKit(13);
  const shaftX = 0.22, shaftZ = 0.13;
  figure(k, {
    legs: STEEL, knee: GOLD, boots: STEEL_D, torso: BLUE, upper: STEEL, fore: STEEL_L, hand: STEEL_D, hips: BLUE_D, elbow: GOLD,
    rh: [shaftX - 0.01, 0.6, shaftZ - 0.02], lh: [shaftX - 0.035, 0.82, shaftZ + 0.01], belt: GOLD, stance: 0.1, armR: 0.05,
  });
  // cape behind
  cape(k, { y0: 0.3, y1: 0.8, r0: 0.25, r1: 0.16, col: BLUE, lin: BLUE_L, hem: GOLD, arc: 2.2 });
  // polished breastplate with gold rims and a sun badge
  k.lathe([[0.13, 0.5], [0.143, 0.58], [0.17, 0.68], [0.172, 0.745], [0.14, 0.795], [0.06, 0.815]], [0, 0, 0.004], STEEL_L, { s: [1, 1, 0.8], grad: [0.78, 1.18] });
  k.lathe([[0.146, 0.79], [0.12, 0.81]], [0, 0, 0.004], GOLD, { s: [1, 1, 0.82], grad: [1, 1] });
  k.lathe([[0.137, 0.495], [0.14, 0.52]], [0, 0, 0.004], GOLD, { s: [1, 1, 0.83], grad: [1, 1] });
  sunBadge(k, [0, 0.66, 0.138], [-0.25, 0, 0], GEM_B, 0.95);
  // blue tassets with gold hem
  k.lathe([[0.17, 0.33], [0.135, 0.5]], [0, 0, 0], BLUE, { s: [1, 1, 0.84], grad: [0.8, 1.1], seg: 10 });
  k.lathe([[0.174, 0.325], [0.171, 0.35]], [0, 0, 0], GOLD, { s: [1, 1, 0.85], grad: [1, 1], seg: 10 });
  // layered gold-trimmed pauldrons
  k.sym(() => {
    k.ell(0.09, 0.062, 0.09, [0.168, 0.775, 0], STEEL_L, { r: [0, 0, -0.42], grad: [0.8, 1.15] });
    k.ell(0.075, 0.05, 0.08, [0.18, 0.735, 0], STEEL, { r: [0, 0, -0.6] });
    k.torus(0.08, 0.012, [0.175, 0.755, 0], GOLD, { r: [Math.PI / 2, 0, -0.42], seg: 10, grad: [1, 1] });
  });
  // morion helmet: upturned brim, tall gold comb, white and red plume
  k.lathe([[0.2, 0.975], [0.175, 0.945], [0.1, 0.952], [0.106, 1.0], [0.082, 1.05], [0.04, 1.072], [0.0, 1.078]], [0, 0, 0.005], STEEL_L, { seg: 10, grad: [0.8, 1.2] });
  k.lathe([[0.204, 0.97], [0.204, 0.985]], [0, 0, 0.005], GOLD, { seg: 10, grad: [1, 1] });
  k.plate([[-0.12, 0], [0.12, 0], [0.09, 0.07], [0.03, 0.1], [-0.05, 0.1], [-0.1, 0.06]], 0.016, [0, 1.02, 0.0], GOLD, { r: [0, Math.PI / 2, 0], grad: [0.85, 1.15] });
  plume(k, [0, 1.07, -0.08], 3, WHITE, CRIMSON, 0.9);
  // grand halberd: gilded shaft bands, crescent axe with gold edge, hook, long spike, tassel
  k.limb([shaftX, 0.02, shaftZ], [shaftX, 1.44, shaftZ], 0.018, 0.016, WOOD, { seg: 5, grad: [0.75, 1.15] });
  for (const y of [0.3, 0.7, 1.0]) k.cyl(0.024, 0.024, 0.03, [shaftX, y, shaftZ], GOLD, { seg: 6, grad: [1, 1] });
  k.limb([shaftX, 1.14, shaftZ], [shaftX, 1.26, shaftZ], 0.027, 0.027, GOLD, { seg: 6 });
  k.at([shaftX + 0.01, 1.12, shaftZ], [0, -0.25, 0], 1, () => {
    k.plate([[0, 0.03], [0.08, -0.01], [0.14, -0.1], [0.2, -0.02], [0.225, 0.09], [0.205, 0.2], [0.15, 0.29], [0.08, 0.18], [0, 0.15]], 0.02, [0, 0, 0], STEEL_L, { grad: [0.8, 1.2] });
    k.plate([[0.19, -0.04], [0.205, -0.02], [0.232, 0.09], [0.213, 0.21], [0.16, 0.3], [0.15, 0.29], [0.2, 0.2], [0.22, 0.09]], 0.026, [0, 0, 0], GOLD_L, { grad: [1, 1], ao: false });
    k.ball(0.02, [0.06, 0.08, 0.012], GEM_B, { glow: true, d: 0 });
  });
  k.cone(0.028, 0.15, [shaftX - 0.01, 1.22, shaftZ], STEEL, { r: [0, -0.25, Math.PI / 2 + 0.35], seg: 4 });
  k.cone(0.034, 0.24, [shaftX, 1.42, shaftZ], STEEL_L, { seg: 4, grad: [0.85, 1.2] });
  k.box(0.045, 0.075, 0.045, [shaftX, 1.1, shaftZ], BLUE, { r: [0, 0.6, 0] });
  k.cone(0.034, 0.1, [shaftX, 1.0, shaftZ], GOLD, { r: [Math.PI, 0, 0], seg: 5 });
  return k.done();
}

function marksman() {
  const k = makeKit(29);
  const GREEN = 0x4ea24a, GREEN_L = 0x7ac860;
  const rhP = [0.07, 0.7, 0.14], lhP = [-0.04, 0.73, 0.33];
  figure(k, {
    legs: LEATHER, boots: 0x8a5a30, torso: GREEN, upper: GREEN_L, fore: LEATHER, hand: SKIN, hips: LEATHER_D,
    rh: rhP, lh: lhP, belt: GOLD, stance: 0.11, pauldron: STEEL_L, pTrim: GOLD,
    skirt: { col: BLUE, r0: 0.14, y0: 0.52, r1: 0.19, y1: 0.31 },
  });
  k.lathe([[0.194, 0.3], [0.19, 0.325]], [0, 0, 0], GOLD, { s: [1, 1, 0.8], seg: 10, grad: [1, 1] });
  // steel cuirass with gold piping over the green doublet
  k.lathe([[0.125, 0.53], [0.14, 0.6], [0.165, 0.68], [0.168, 0.74], [0.13, 0.79]], [0, 0, 0.006], STEEL_L, { s: [1, 1, 0.8], grad: [0.8, 1.15], seg: 8, phi: -1.2, len: 2.4 });
  k.box(0.022, 0.24, 0.02, [0, 0.66, 0.132], GOLD, { r: [-0.2, 0, 0] });
  // long blue cape with gold hem
  cape(k, { y0: 0.18, y1: 0.8, r0: 0.27, r1: 0.16, col: BLUE, lin: GOLD_D, hem: GOLD, arc: 2.1 });
  // wide-brimmed feathered hat
  k.lathe([[0.2, 0.985], [0.19, 0.975], [0.12, 0.985], [0.11, 1.0]], [0, 0, 0], BLUE_D, { seg: 10, grad: [0.85, 1.1] });
  k.lathe([[0.2, 0.985], [0.2, 0.975]], [0, 0, 0], BLUE, { seg: 10 });
  k.lathe([[0.11, 0.98], [0.1, 1.06], [0.07, 1.1], [0.0, 1.11]], [0, 0, -0.005], BLUE, { seg: 8, grad: [0.85, 1.15] });
  k.lathe([[0.113, 0.985], [0.112, 1.005]], [0, 0, -0.005], GOLD, { seg: 8, grad: [1, 1] });
  k.feather([0.08, 1.02, 0.02], [0.03, 1.14, -0.3], 0.09, CRIMSON, { roll: 1.2, t: 0.016 });
  k.feather([0.09, 1.02, 0.0], [0.12, 1.1, -0.27], 0.07, WHITE, { roll: 1.4, t: 0.016 });
  // short beard
  k.ell(0.05, 0.04, 0.035, [0, 0.855, 0.085], 0xa0602a, { d: 1 });
  // bolt quiver on the hip
  k.at([-0.18, 0.47, -0.04], [0.15, 0, 0.2], 1, () => {
    k.cyl(0.04, 0.045, 0.22, [0, -0.1, 0], LEATHER, { seg: 7, grad: [0.8, 1.1] });
    k.cyl(0.048, 0.048, 0.025, [0, 0.11, 0], GOLD, { seg: 7, grad: [1, 1] });
    for (let i = 0; i < 3; i++) k.box(0.012, 0.06, 0.025, [(i - 1) * 0.022, 0.16, 0], i === 1 ? WHITE : CRIMSON, { r: [0, i, 0] });
  });
  // gilded crossbow levelled forward
  const s0 = [rhP[0] - 0.01, rhP[1] - 0.02, rhP[2] - 0.08], s1 = [lhP[0] + 0.03, lhP[1] + 0.02, lhP[2] + 0.12];
  k.limb(s0, s1, 0.028, 0.022, WOOD, { seg: 5, grad: [0.8, 1.15], sz: 1.4 });
  k.limb([s0[0], s0[1] - 0.01, s0[2]], [rhP[0] - 0.005, rhP[1] - 0.07, rhP[2] - 0.02], 0.02, 0.02, WOOD_D, { seg: 4 });
  const nose = V3(s1);
  k.cyl(0.03, 0.03, 0.04, [nose.x, nose.y - 0.02, nose.z - 0.01], GOLD, { seg: 6, r: [Math.PI / 2, 0, 0] });
  // prod: a recurved steel bow across the front
  const P = [];
  for (let i = 0; i <= 8; i++) { const t = i / 4 - 1; P.push([nose.x + t * 0.24, nose.y + 0.005, nose.z - 0.02 - t * t * 0.09 + Math.pow(Math.abs(t), 6) * 0.05]); }
  for (let i = 0; i < 8; i++) k.limb(P[i], P[i + 1], 0.016, 0.016, i === 0 || i === 7 ? GOLD : STEEL_L, { seg: 4 });
  const nut = [s0[0] + (s1[0] - s0[0]) * 0.35, s0[1] + (s1[1] - s0[1]) * 0.35 + 0.02, s0[2] + (s1[2] - s0[2]) * 0.35];
  k.limb(P[0], nut, 0.005, 0.005, CREAM, { seg: 3 });
  k.limb(P[8], nut, 0.005, 0.005, CREAM, { seg: 3 });
  // bolt with a glowing enchanted head
  const bt = [nose.x, nose.y + 0.025, nose.z + 0.07];
  k.limb(nut, bt, 0.008, 0.008, WOOD, { seg: 3 });
  k.stick(new THREE.ConeGeometry(0.018, 0.06, 4).translate(0, 0.03, 0), bt, [bt[0] + (bt[0] - nut[0]) * 0.3, bt[1] + (bt[1] - nut[1]) * 0.3, bt[2] + (bt[2] - nut[2]) * 0.3], GEM_B, { glow: true });
  return k.done();
}

function royalgriffin() {
  const k = makeKit(39);
  const FUR = 0xf0c25a, FUR_D = 0xc08a38, FEATH = 0xfffaf0, BEAK = 0xffc428, TALON = 0xf0c040;
  // lion body + hindquarters
  k.ell(0.175, 0.165, 0.33, [0, 0.44, -0.07], FUR, { r: [0.08, 0, 0], grad: [0.78, 1.15] });
  k.sym(() => {
    k.ell(0.088, 0.145, 0.135, [0.118, 0.375, -0.25], FUR, { grad: [0.8, 1.12] });
    k.limb([0.125, 0.3, -0.28], [0.135, 0.15, -0.36], 0.067, 0.044, FUR);
    k.limb([0.135, 0.15, -0.36], [0.14, 0.03, -0.3], 0.044, 0.037, FUR_D);
    k.ell(0.052, 0.033, 0.07, [0.14, 0.03, -0.27], FUR_D, { d: 0 });
  });
  // royal saddle-cloth: blue with gold hem and fleur badge each side
  k.lathe([[0.19, 0.4], [0.185, 0.5], [0.15, 0.6], [0.06, 0.63]], [0, 0, -0.1], ROYAL, { s: [1, 1, 1.15], seg: 10, grad: [0.8, 1.12] });
  k.lathe([[0.196, 0.385], [0.193, 0.415]], [0, 0, -0.1], GOLD, { s: [1, 1, 1.15], seg: 10, grad: [1, 1] });
  k.sym(() => k.ball(0.022, [0.19, 0.47, -0.1], GEM_R, { glow: true, d: 0 }));
  // long tail with a gold tuft
  k.limb([0, 0.52, -0.37], [0, 0.45, -0.58], 0.033, 0.025, FUR);
  k.limb([0, 0.45, -0.58], [0, 0.62, -0.74], 0.025, 0.018, FUR);
  k.ell(0.05, 0.085, 0.05, [0, 0.68, -0.78], 0xd89a30, { r: [-0.6, 0, 0] });
  k.cone(0.035, 0.11, [0, 0.72, -0.8], GOLD_L, { r: [-0.6, 0, 0], seg: 4 });
  // feathered chest + neck, gold collar with a gem
  k.ell(0.165, 0.185, 0.175, [0, 0.51, 0.17], FEATH, { r: [-0.35, 0, 0], grad: [0.8, 1.08] });
  k.limb([0, 0.55, 0.24], [0, 0.73, 0.37], 0.112, 0.087, FEATH, { seg: 7 });
  k.torus(0.1, 0.022, [0, 0.62, 0.3], GOLD, { r: [Math.PI / 2 - 0.85, 0, 0], seg: 14, ts: 4, grad: [0.9, 1.1] });
  k.ball(0.028, [0, 0.6, 0.41], GEM_B, { glow: true, d: 0 });
  // eagle front legs
  k.sym(() => {
    k.ell(0.078, 0.112, 0.088, [0.1, 0.36, 0.22], FEATH, { r: [0.3, 0, 0] });
    k.torus(0.05, 0.01, [0.112, 0.25, 0.265], GOLD, { r: [Math.PI / 2, 0, 0], seg: 8 });
    k.limb([0.11, 0.3, 0.25], [0.12, 0.05, 0.31], 0.05, 0.036, TALON);
    k.ell(0.04, 0.028, 0.045, [0.12, 0.035, 0.32], TALON, { d: 0 });
    for (let t = -1; t <= 1; t++) k.cone(0.013, 0.075, [0.12 + t * 0.024, 0.03, 0.34], 0x6a5a6a, { r: [Math.PI / 2 + 0.3, t * 0.4, 0], seg: 3 });
  });
  // eagle head, glowing eyes, golden crown of crest feathers
  const hy = 0.8, hz = 0.43;
  k.ell(0.098, 0.103, 0.118, [0, hy, hz], FEATH, { grad: [0.88, 1.1] });
  k.cone(0.05, 0.145, [0, hy - 0.01, hz + 0.08], BEAK, { r: [Math.PI / 2 - 0.15, 0, 0], seg: 5, grad: [0.9, 1.1] });
  k.cone(0.025, 0.062, [0, hy - 0.02, hz + 0.215], BEAK, { r: [Math.PI - 0.3, 0, 0], seg: 4 });
  k.sym(() => {
    k.ball(0.022, [0.062, hy + 0.025, hz + 0.07], 0x8ae8ff, { d: 0, glow: true });
    k.box(0.058, 0.018, 0.035, [0.057, hy + 0.057, hz + 0.065], GOLD, { r: [0, -0.2, -0.3] });
  });
  k.lathe([[0.065, hy + 0.06], [0.068, hy + 0.09]], [0, 0, hz - 0.01], GOLD, { seg: 8, grad: [1, 1] });
  for (let i = 0; i < 5; i++) k.cone(0.016, 0.07, [Math.sin((i - 2) * 0.55) * 0.066, hy + 0.085, hz - 0.01 + Math.cos((i - 2) * 0.55) * 0.066], GOLD_L, { seg: 4 });
  for (let i = 0; i < 5; i++) k.cone(0.03, 0.2 + (i % 2) * 0.04, [(i - 2) * 0.03, hy + 0.04, hz - 0.09], i % 2 ? ROYAL_L : FEATH, { r: [-1.85 - Math.abs(i - 2) * 0.12, (i - 2) * 0.25, 0], seg: 4 });
  // great golden wings, bigger than the base griffin's, with royal blue tips
  k.sym(() => wing(k, [0.11, 0.6, 0.06], { W: [0.34, 0.26, -0.06], T: [0.8, 0.46, -0.26], len: 0.52, drop: [0.1, -0.3, -1], dropIn: [0.1, -0.9, -0.6], n: 11, col: 0xf0b030, tip: ROYAL, cov: 0xfff0c8, bone: GOLD_L, prim: 5 }));
  return k.done();
}

function crusader() {
  const k = makeKit(43);
  const { R, L } = figure(k, {
    legs: STEEL, knee: GOLD, boots: STEEL_D, torso: STEEL, upper: STEEL, fore: STEEL_L, hand: STEEL_D, hips: STEEL_D, elbow: GOLD,
    rh: [0.23, 0.74, 0.16], lh: [-0.2, 0.55, 0.2], belt: GOLD, stance: 0.105, armR: 0.05, head: false,
  });
  // big layered pauldrons with gold rims
  k.sym(() => {
    k.ell(0.1, 0.07, 0.095, [0.17, 0.78, 0], STEEL_L, { r: [0, 0, -0.38], grad: [0.8, 1.15] });
    k.ell(0.085, 0.055, 0.085, [0.19, 0.735, 0], STEEL, { r: [0, 0, -0.6] });
    k.torus(0.088, 0.014, [0.175, 0.76, 0], GOLD, { r: [Math.PI / 2, 0, -0.38], seg: 10, grad: [1, 1] });
    k.cone(0.02, 0.06, [0.2, 0.83, 0], GOLD_L, { r: [0, 0, -0.5], seg: 4 });
  });
  // crimson cape with gold lining
  cape(k, { y0: 0.1, y1: 0.82, r0: 0.3, r1: 0.17, col: CRIMSON, lin: GOLD, hem: GOLD_L, arc: 2.3 });
  // white surcoat front and back with crimson cross and gold border
  for (const z of [1, -1]) {
    k.box(0.21, 0.44, 0.02, [0, 0.52, z * 0.118], WHITE, { r: [z * -0.12, 0, 0], grad: [0.85, 1.08] });
    k.box(0.22, 0.025, 0.026, [0, 0.305, z * 0.144], GOLD, { grad: [1, 1] });
    k.sym(() => k.box(0.02, 0.44, 0.026, [0.105, 0.52, z * 0.12], GOLD, { r: [z * -0.12, 0, 0], grad: [1, 1] }));
  }
  k.box(0.045, 0.24, 0.02, [0, 0.57, 0.138], CRIMSON, { r: [-0.12, 0, 0] });
  k.box(0.15, 0.045, 0.02, [0, 0.62, 0.133], CRIMSON, { r: [-0.12, 0, 0] });
  // great helm with a gold crown, visor slit and white/crimson plume
  k.lathe([[0.0, 0.83], [0.1, 0.83], [0.115, 0.87], [0.115, 0.97], [0.103, 1.02], [0.0, 1.035]], [0, 0, 0.005], STEEL_L, { seg: 10, grad: [0.8, 1.2] });
  k.box(0.17, 0.018, 0.02, [0, 0.935, 0.113], 0x3a3a5a, { grad: [1, 1] });
  k.box(0.024, 0.13, 0.02, [0, 0.9, 0.115], GOLD, { grad: [1, 1] });
  k.lathe([[0.12, 0.985], [0.12, 1.02]], [0, 0, 0.005], GOLD, { seg: 10, grad: [0.95, 1.1] });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.cone(0.02, 0.06, [Math.sin(a) * 0.115, 1.015, 0.005 + Math.cos(a) * 0.115], GOLD_L, { seg: 4 }); }
  k.ball(0.018, [0, 1.0, 0.125], GEM_R, { glow: true, d: 0 });
  plume(k, [0, 1.03, -0.02], 3, WHITE, CRIMSON, 1.1);
  // longsword raised, gilded hilt, a gleaming fuller
  k.at(R, [0.45, 0, -0.15], 1, () => {
    k.box(0.2, 0.028, 0.038, [0, 0.03, 0], GOLD, { grad: [0.9, 1.1] });
    k.sym(() => k.ball(0.02, [0.1, 0.03, 0], GOLD_L, { d: 0 }));
    k.limb([0, -0.07, 0], [0, 0.02, 0], 0.017, 0.017, CRIMSON_D, { seg: 5 });
    k.ball(0.024, [0, -0.08, 0], GEM_R, { d: 0, glow: true });
    k.plate([[-0.03, 0], [0.03, 0], [0.026, 0.5], [0, 0.58], [-0.026, 0.5]], 0.013, [0, 0.045, 0], STEEL_L, { r: [0, Math.PI / 2, 0], grad: [0.85, 1.25] });
    k.box(0.016, 0.42, 0.008, [0, 0.27, 0], 0xd8f0ff, { r: [0, Math.PI / 2, 0], glow: true, s: [1, 1, 1] });
  });
  // white kite shield with crimson cross and gold rim
  shield(k, [L[0] - 0.03, L[1] + 0.02, L[2] + 0.05], [0.05, -0.35, 0.05], 1.12, WHITE, GOLD, 'cross');
  k.at([L[0] - 0.03, L[1] + 0.02, L[2] + 0.05], [0.05, -0.35, 0.05], 1.12, () => {
    k.box(0.03, 0.27, 0.012, [0, 0.015, 0.042], CRIMSON, {});
    k.box(0.17, 0.03, 0.012, [0, 0.07, 0.042], CRIMSON, {});
  });
  return k.done();
}

function zealot() {
  const k = makeKit(59);
  const ROBE = 0xf6efe0, ROBE_D = 0xd8c8a4;
  const staff = [0.23, 0, 0.12];
  const { R, L } = figure(k, {
    legs: ROBE_D, boots: LEATHER, torso: ROBE, upper: CRIMSON, fore: ROBE, hand: SKIN, hips: ROBE,
    rh: [staff[0] - 0.012, 0.74, staff[2]], lh: [-0.17, 0.74, 0.24], belt: GOLD, head: false,
  });
  // flared robe to the ground, crimson outer layer, broad gold hem
  k.lathe([[0.235, 0.0], [0.22, 0.06], [0.18, 0.25], [0.145, 0.44], [0.13, 0.52]], [0, 0, 0], ROBE, { s: [1, 1, 0.88], seg: 10, grad: [0.82, 1.05] });
  k.lathe([[0.242, 0.0], [0.236, 0.05]], [0, 0, 0], GOLD, { s: [1, 1, 0.88], seg: 10, grad: [1, 1] });
  const scap = [[0.246, 0.04], [0.23, 0.09], [0.19, 0.25], [0.155, 0.44], [0.145, 0.52], [0.148, 0.6], [0.175, 0.69], [0.18, 0.75], [0.12, 0.81]];
  for (const ph of [0, Math.PI]) {
    k.lathe(scap, [0, 0, 0], CRIMSON, { s: [1, 1, 0.84], seg: 3, phi: ph - 0.42, len: 0.84, grad: [0.8, 1.1] });
    k.lathe([[0.252, 0.04], [0.248, 0.08]], [0, 0, 0], GOLD, { s: [1, 1, 0.85], seg: 3, phi: ph - 0.44, len: 0.88, grad: [1, 1] });
  }
  // gold stole down the front with sun badges
  k.sym(() => k.box(0.03, 0.42, 0.016, [0.055, 0.5, 0.152], GOLD, { r: [-0.08, 0, 0.0], grad: [0.95, 1.1] }));
  sunBadge(k, [0, 0.66, 0.14], [-0.25, 0, 0], GEM_R, 1.0);
  // short gold-hemmed mantle on the shoulders
  k.lathe([[0.23, 0.66], [0.2, 0.72], [0.14, 0.79], [0.07, 0.83]], [0, 0, 0], CRIMSON, { s: [1, 1, 0.82], grad: [0.85, 1.1], seg: 10 });
  k.lathe([[0.234, 0.65], [0.232, 0.67]], [0, 0, 0], GOLD, { s: [1, 1, 0.83], seg: 10, grad: [1, 1] });
  // raised pointed hood, face and white beard in front
  k.ell(0.118, 0.125, 0.118, [0, 0.93, -0.015], CRIMSON, { grad: [0.85, 1.15] });
  k.cone(0.07, 0.18, [0, 0.99, -0.06], CRIMSON, { r: [-0.55, 0, 0], seg: 5 });
  k.torus(0.088, 0.016, [0, 0.92, 0.07], GOLD, { seg: 12, ts: 4, s: [1, 1.12, 1], grad: [0.95, 1.1] });
  k.ell(0.078, 0.085, 0.06, [0, 0.912, 0.055], SKIN, { grad: [0.88, 1.05] });
  k.sym(() => k.box(0.018, 0.02, 0.01, [0.032, 0.925, 0.111], DARK, { grad: [1, 1] }));
  k.box(0.022, 0.035, 0.03, [0, 0.9, 0.117], SKIN, { r: [0.3, 0, 0] });
  k.ell(0.06, 0.07, 0.045, [0, 0.845, 0.085], 0xf2ede0, { d: 1 });
  // tall staff topped by a gold sun ring around a blazing orb
  const top = 1.42;
  k.limb([staff[0], 0.02, staff[2]], [staff[0], top - 0.08, staff[2]], 0.019, 0.016, 0xf0e2c0, { seg: 5, grad: [0.85, 1.15] });
  for (const y of [0.5, 0.95]) k.cyl(0.026, 0.026, 0.03, [staff[0], y, staff[2]], GOLD, { seg: 6 });
  k.cyl(0.032, 0.04, 0.06, [staff[0], top - 0.11, staff[2]], GOLD, { seg: 6 });
  k.torus(0.1, 0.014, [staff[0], top + 0.04, staff[2]], GOLD, { seg: 16, ts: 4, grad: [0.95, 1.1] });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cone(0.018, 0.07, [staff[0] + Math.sin(a) * 0.11, top + 0.04 + Math.cos(a) * 0.11, staff[2]], GOLD_L, { r: [0, 0, -a], seg: 3 }); }
  k.ball(0.07, [staff[0], top + 0.04, staff[2]], 0xffcf50, { glow: true, d: 1 });
  k.ball(0.04, [staff[0], top + 0.04, staff[2] + 0.04], 0xfff4c0, { glow: true, d: 0 });
  for (let i = 0; i < 6; i++) { const a = i * 1.05; k.ball(0.014, [staff[0] + Math.sin(a) * 0.17, top - 0.02 + (i % 3) * 0.05, staff[2] + Math.cos(a) * 0.17], 0xffe890, { glow: true, d: 0 }); }
  // a burning holy flame in the raised left hand
  k.ball(0.04, [L[0], L[1] + 0.07, L[2] + 0.02], 0xffb040, { glow: true, d: 0 });
  k.cone(0.03, 0.1, [L[0], L[1] + 0.08, L[2] + 0.02], 0xfff0a0, { glow: true, seg: 4 });
  return k.done();
}

function champion() {
  const k = makeKit(71);
  const HORSE = 0xf6f2ea, HORSE_D = 0xd2cec6, MANE = 0xf0e4c4, HOOF = 0x6a5a50;
  // horse body
  k.ell(0.18, 0.185, 0.41, [0, 0.67, -0.02], HORSE, { grad: [0.8, 1.1] });
  k.ell(0.165, 0.195, 0.175, [0, 0.71, 0.25], HORSE, {});
  const legsAt = [[0.1, 0.3, 0.12], [-0.1, 0.24, -0.04], [0.1, -0.3, -0.06], [-0.1, -0.28, 0.06]];
  for (const [x, z, sw] of legsAt) {
    k.limb([x, 0.62, z], [x, 0.34, z + sw * 0.5], 0.072, 0.047, HORSE_D);
    k.limb([x, 0.34, z + sw * 0.5], [x, 0.06, z + sw], 0.036, 0.031, HORSE_D);
    k.cyl(0.047, 0.042, 0.07, [x, 0.0, z + sw], HOOF, { seg: 6, ao: false });
    k.cyl(0.046, 0.046, 0.04, [x, 0.065, z + sw], GOLD, { seg: 6 });
  }
  // armoured neck (gold crinet plates) and head with chanfron, horn and plume
  k.limb([0, 0.74, 0.3], [0, 1.0, 0.48], 0.115, 0.083, HORSE, { seg: 7 });
  for (let i = 0; i < 4; i++) { const t = i / 3; k.box(0.13 - t * 0.02, 0.03, 0.08, [0, 0.86 + t * 0.17, 0.3 + t * 0.12], i % 2 ? GOLD : STEEL_L, { r: [0.95, 0, 0] }); }
  k.at([0, 1.03, 0.53], [0.9, 0, 0], 1, () => {
    k.ell(0.067, 0.077, 0.172, [0, 0, 0.08], HORSE, {});
    k.ell(0.06, 0.064, 0.072, [0, -0.012, 0.22], HORSE_D, {});
    k.ell(0.056, 0.04, 0.15, [0, 0.045, 0.1], STEEL_L, { grad: [0.85, 1.2] });
    k.box(0.024, 0.022, 0.21, [0, 0.08, 0.1], GOLD, {});
    k.cone(0.022, 0.13, [0, 0.08, 0.06], GOLD_L, { r: [-0.55, 0, 0], seg: 4 });
    k.ball(0.02, [0, 0.085, 0.16], GEM_B, { glow: true, d: 0 });
    k.sym(() => { k.cone(0.026, 0.08, [0.047, 0.05, -0.04], HORSE, { r: [-0.5, 0, 0.25], seg: 4 }); k.ball(0.014, [0.07, 0.02, 0.08], DARK, { d: 0 }); });
  });
  plume(k, [0, 1.12, 0.47], 2, CRIMSON, WHITE, 0.75);
  // mane and tail
  for (let i = 0; i < 5; i++) { const t = i / 4; k.box(0.03, 0.08, 0.07, [0, 0.88 + t * 0.2, 0.32 + t * 0.17 - 0.06], MANE, { r: [0.7, 0, 0] }); }
  k.limb([0, 0.74, -0.41], [0, 0.55, -0.54], 0.052, 0.042, MANE);
  k.limb([0, 0.55, -0.54], [0, 0.22, -0.54], 0.047, 0.02, MANE);
  // royal caparison: long blue barding, wide gold hem, gold fleurs, steel peytral
  k.lathe([[0.235, 0.34], [0.222, 0.44], [0.2, 0.66], [0.155, 0.8], [0.06, 0.86]], [0, 0, -0.04], ROYAL, { s: [1, 1, 2.05], seg: 12, grad: [0.72, 1.12] });
  k.lathe([[0.242, 0.32], [0.237, 0.37]], [0, 0, -0.04], GOLD, { s: [1, 1, 2.05], seg: 12, grad: [1, 1] });
  k.sym(() => {
    sunBadge(k, [0.225, 0.56, -0.12], [0, Math.PI / 2, 0], GEM_B, 1.3);
  });
  k.lathe([[0.17, 0.5], [0.18, 0.6], [0.165, 0.72], [0.12, 0.8]], [0, 0, 0.29], STEEL_L, { seg: 8, phi: -1.2, len: 2.4, grad: [0.8, 1.15] });
  k.lathe([[0.172, 0.49], [0.174, 0.52]], [0, 0, 0.29], GOLD, { seg: 8, phi: -1.2, len: 2.4, grad: [1, 1] });
  k.box(0.25, 0.05, 0.23, [0, 0.86, -0.04], CRIMSON, { grad: [0.85, 1.1] });
  k.box(0.21, 0.09, 0.04, [0, 0.9, -0.15], GOLD_D, {});
  // rider in gilded plate
  let H;
  k.at([0, 0.5, -0.03], [0, 0, 0], 0.84, () => {
    H = figure(k, {
      sit: true, legs: STEEL, knee: GOLD, boots: STEEL_D, torso: STEEL_L, upper: STEEL, fore: STEEL, hand: STEEL_D, hips: ROYAL, elbow: GOLD,
      rh: [0.19, 0.6, 0.12], lh: [-0.17, 0.6, 0.18], armR: 0.05, head: false,
    });
    k.sym(() => {
      k.ell(0.1, 0.07, 0.095, [0.17, 0.78, 0], GOLD, { r: [0, 0, -0.38], grad: [0.85, 1.15] });
      k.torus(0.088, 0.013, [0.175, 0.76, 0], GOLD_L, { r: [Math.PI / 2, 0, -0.38], seg: 10, grad: [1, 1] });
    });
    cape(k, { y0: 0.4, y1: 0.82, r0: 0.28, r1: 0.17, col: ROYAL, lin: GOLD, hem: GOLD_L, arc: 2.2, z: -0.03 });
    k.box(0.2, 0.32, 0.02, [0, 0.6, 0.12], ROYAL, { r: [-0.1, 0, 0] });
    sunBadge(k, [0, 0.64, 0.135], [-0.1, 0, 0], GEM_B, 1.0);
    // crowned helm with a tall plume
    k.lathe([[0.0, 0.83], [0.1, 0.83], [0.114, 0.88], [0.114, 0.96], [0.084, 1.02], [0.0, 1.04]], [0, 0, 0.005], STEEL_L, { seg: 10, grad: [0.8, 1.2] });
    k.box(0.16, 0.02, 0.02, [0, 0.93, 0.112], 0x3a3a5a, { grad: [1, 1] });
    k.lathe([[0.118, 0.95], [0.118, 0.985]], [0, 0, 0.005], GOLD, { seg: 10, grad: [1, 1] });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.cone(0.02, 0.055, [Math.sin(a) * 0.112, 0.98, 0.005 + Math.cos(a) * 0.112], GOLD_L, { seg: 4 }); }
    plume(k, [0, 1.02, -0.03], 3, WHITE, ROYAL_L, 1.2);
  });
  const toW = (p) => [p[0] * 0.84, 0.5 + p[1] * 0.84, -0.03 + p[2] * 0.84];
  const rh = toW(H.R), lhw = toW(H.L);
  // grand lance with gold spiral bands and a long swallowtail pennant
  const a = [rh[0] + 0.03, rh[1] - 0.06, rh[2] - 0.3], b = [rh[0] + 0.1, rh[1] + 0.32, rh[2] + 1.0];
  k.limb(a, b, 0.034, 0.01, WHITE, { seg: 6, grad: [0.9, 1.1] });
  k.stick(new THREE.ConeGeometry(0.075, 0.13, 8).rotateX(Math.PI).translate(0, 0.065, 0), [rh[0] + 0.03, rh[1] - 0.04, rh[2] + 0.03], [rh[0] + 0.033, rh[1] - 0.03, rh[2] + 0.16], GOLD, {});
  const pt = (t) => a.map((v, j) => v + (b[j] - v) * t);
  for (let i = 0; i < 4; i++) { const t = 0.38 + i * 0.1; k.limb(pt(t), pt(t + 0.03), 0.024 - i * 0.002, 0.022 - i * 0.002, i % 2 ? GOLD : ROYAL, { seg: 6 }); }
  const p1 = pt(0.88);
  k.plate([[0, 0], [0, 0.13], [0.26, 0.11], [0.17, 0.065], [0.26, 0.02]], 0.008, p1, ROYAL, { r: [-Math.atan2(b[1] - a[1], b[2] - a[2]) + Math.PI / 2, Math.PI / 2 + 0.25, Math.PI], grad: [0.85, 1.1] });
  k.cone(0.017, 0.08, pt(1), GOLD_L, { r: [Math.PI / 2 - Math.atan2(b[1] - a[1], b[2] - a[2]), 0, 0], seg: 4 });
  // gold-rimmed shield with the sun
  shield(k, [lhw[0] - 0.04, lhw[1], lhw[2] + 0.02], [0.05, -0.5, 0.04], 0.98, ROYAL, GOLD, 'sun');
  return k.done();
}

function archangel() {
  const k = makeKit(83);
  const ARM = 0xf6c84c, ROBE = 0xfdfbf4, HAIR = 0xfad672;
  const S = 1.3, Y0 = 0.06;
  let H;
  k.at([0, Y0, 0], [0, 0, 0], S, () => {
    H = figure(k, {
      legs: ARM, boots: GOLD, torso: ARM, upper: SKIN, fore: ARM, hand: SKIN, hips: ROBE, elbow: GOLD_L,
      rh: [0.24, 0.88, 0.22], lh: [-0.21, 0.52, 0.14], head: false, belt: ROYAL, torsoGrad: [0.8, 1.25], stance: 0.07,
    });
    // winged pauldrons
    k.sym(() => {
      k.ell(0.095, 0.065, 0.09, [0.168, 0.775, 0], ARM, { r: [0, 0, -0.38], grad: [0.85, 1.2] });
      k.torus(0.085, 0.012, [0.172, 0.755, 0], WHITE, { r: [Math.PI / 2, 0, -0.38], seg: 10, grad: [1, 1] });
      for (let i = 0; i < 3; i++) k.feather([0.2, 0.78, -0.01], [0.3 + i * 0.015, 0.83 + i * 0.03, -0.04 - i * 0.03], 0.04, i ? WHITE : GOLD_L, { t: 0.012 });
    });
    // white skirt with royal-blue and gold hems, gold front plates
    k.lathe([[0.18, 0.02], [0.172, 0.1], [0.145, 0.3], [0.125, 0.52]], [0, 0, 0], ROBE, { s: [1, 1, 0.86], seg: 10, grad: [0.88, 1.05] });
    k.lathe([[0.186, 0.0], [0.18, 0.06]], [0, 0, 0], ROYAL, { s: [1, 1, 0.87], seg: 10, grad: [1, 1] });
    k.lathe([[0.19, 0.055], [0.186, 0.075]], [0, 0, 0], GOLD, { s: [1, 1, 0.87], seg: 10, grad: [1, 1] });
    k.lathe([[0.155, 0.22], [0.144, 0.4], [0.13, 0.5]], [0, 0, 0], ARM, { s: [1, 1, 0.9], seg: 10, phi: -0.9, len: 1.8, grad: [0.85, 1.15] });
    // royal sash across the chest and a sun-gem breastplate
    k.limb([0.15, 0.76, 0.04], [-0.12, 0.52, 0.1], 0.025, 0.025, ROYAL, { seg: 4, sz: 0.5 });
    sunBadge(k, [0, 0.68, 0.122], [-0.2, 0, 0], GEM_B, 1.1);
    // long golden hair, winged circlet
    k.ell(0.102, 0.112, 0.102, [0, 0.94, -0.02], HAIR, { grad: [0.85, 1.15] });
    k.ell(0.1, 0.17, 0.055, [0, 0.8, -0.07], HAIR, {});
    k.lathe([[0.1, 0.945], [0.1, 0.965]], [0, 0, 0.01], GOLD, { seg: 9, grad: [1, 1] });
    k.sym(() => { for (let i = 0; i < 3; i++) k.feather([0.09, 0.96, 0.0], [0.15 + i * 0.01, 1.02 + i * 0.03, -0.06 - i * 0.025], 0.035, i % 2 ? WHITE : GOLD_L, { t: 0.01 }); });
    k.ball(0.014, [0, 0.957, 0.106], GEM_B, { glow: true, d: 0 });
    k.ell(0.088, 0.098, 0.092, [0, 0.912, 0.015], SKIN, { grad: [0.88, 1.05] });
    k.box(0.02, 0.032, 0.03, [0, 0.9, 0.105], SKIN, { r: [0.3, 0, 0] });
    k.sym(() => k.box(0.017, 0.02, 0.01, [0.032, 0.915, 0.103], 0x3a6ad8, { grad: [1, 1] }));
    // double halo
    k.torus(0.11, 0.012, [0, 1.13, -0.04], 0xffe070, { glow: true, r: [Math.PI / 2 - 0.2, 0, 0], seg: 18, ts: 3 });
    k.torus(0.075, 0.007, [0, 1.15, -0.035], 0xfff6c0, { glow: true, r: [Math.PI / 2 - 0.2, 0, 0], seg: 14, ts: 3 });
  });
  const toW = (p) => [p[0] * S, Y0 + p[1] * S, p[2] * S];
  const rh = toW(H.R);
  // holy greatsword wreathed in white-gold flame
  k.at(rh, [0.6, 0, -0.25], 1.25, () => {
    k.box(0.21, 0.03, 0.045, [0, 0.03, 0], GOLD, {});
    k.sym(() => k.feather([0.03, 0.03, 0], [0.15, 0.09, 0], 0.045, GOLD_L, { t: 0.014 }));
    k.limb([0, -0.08, 0], [0, 0.02, 0], 0.018, 0.018, ROYAL, { seg: 5 });
    k.ball(0.026, [0, -0.09, 0], GEM_B, { d: 0, glow: true });
    k.plate([[-0.032, 0], [0.032, 0], [0.027, 0.52], [0, 0.61], [-0.027, 0.52]], 0.015, [0, 0.045, 0], 0xfff8e0, { r: [0, Math.PI / 2, 0], glow: true });
    for (let i = 0; i < 7; i++) {
      const y = 0.08 + i * 0.072, sd = i % 2 ? 1 : -1;
      k.cone(0.03 - i * 0.002, 0.13 + (i % 3) * 0.03, [0, y, sd * 0.013], i % 2 ? 0xffc040 : 0xfff0a0, { glow: true, r: [sd * 0.35, 0, sd * 0.15], seg: 4 });
    }
    k.cone(0.026, 0.18, [0, 0.57, 0], 0xffffff, { glow: true, seg: 4 });
  });
  // a small glowing orb of light in the open left hand
  const lh = toW(H.L);
  k.ball(0.04, [lh[0], lh[1] + 0.06, lh[2] + 0.03], 0xfff4c0, { glow: true, d: 1 });
  // huge wings: more and longer feathers than the angel, gold banding, gold-rimmed tips
  k.sym(() => wing(k, [0.08, 1.04, -0.13], { W: [0.36, 0.3, -0.15], T: [0.82, 0.62, -0.36], len: 0.76, n: 14, col: 0xfff6e2, tip: 0xffd45a, cov: 0xffffff, bone: GOLD_L, drop: [0.05, -0.35, -1], dropIn: [0.05, -1, -0.45], prim: 5 }));
  return k.done();
}

const BUILDERS = { halberdier, marksman, royalgriffin, crusader, zealot, champion, archangel };
export const HAVEN_UP_IDS = Object.keys(BUILDERS);
// Returns a fresh { body, glow } for an upgraded Haven creature id, or null for any other id.
export function havenUpModel(id) {
  const f = BUILDERS[id];
  return f ? f() : null;
}
