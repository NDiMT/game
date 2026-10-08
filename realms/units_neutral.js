import * as THREE from 'three';

// =====================================================================
// HEX REALMS: neutral wild creatures (goblin, wolf, orc, ogre, troll,
// cyclops, hydra). Each model is built from a small procedural kit and
// merged into one vertex-coloured geometry (+ an optional glow geometry
// for eyes). Faces +Z, base at y = 0.
//
//   import { neutralModel } from './units_neutral.js';
//   const { body, glow } = neutralModel('ogre');
// =====================================================================

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UPV = V(0, 1, 0);
const _c = new THREE.Color();
const toCol = (c) => (c instanceof THREE.Color ? c : _c.set(c));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// colour by facing: top / side / under (normal y), for countershading
const byN = (top, side, under, hi = 0.35, lo = -0.35) => {
  const T = new THREE.Color(top), S = new THREE.Color(side), U = new THREE.Color(under);
  return (p, n) => (n.y > hi ? T : n.y < lo ? U : S);
};
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- kit
function nkit(seed) {
  const r = mulberry32(seed);
  const parts = [];
  let M = new THREE.Matrix4();
  const k = {
    r,
    rr: (a, b) => a + r() * (b - a),
    // add a geometry with colour (hex, Color or fn(centroid, normal, faceIndex))
    add(g, col, glow = false, faceCols = null) {
      g = g.index ? g.toNonIndexed() : g;
      g.applyMatrix4(M);
      parts.push({ g, col, glow, faceCols });
      return g;
    },
    // run fn with an extra local transform (position, euler rotation, scale)
    at(p, rot, s, fn) {
      const old = M;
      const L = new THREE.Matrix4().compose(V(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]), 'YXZ')), s == null ? V(1, 1, 1) : typeof s === 'number' ? V(s, s, s) : V(...s));
      M = old.clone().multiply(L);
      fn();
      M = old;
    },
    // run fn with a transform that puts local +Z along dir (and local +Y roughly up)
    aim(p, dir, fn, roll = 0) {
      const old = M;
      const z = V(...dir).normalize();
      const x = new THREE.Vector3().crossVectors(UPV, z); if (x.lengthSq() < 1e-4) x.set(1, 0, 0); x.normalize();
      const y = new THREE.Vector3().crossVectors(z, x);
      const L = new THREE.Matrix4().makeBasis(x, y, z).multiply(new THREE.Matrix4().makeRotationZ(roll)).setPosition(V(...p));
      M = old.clone().multiply(L);
      fn();
      M = old;
    },
    // ellipsoid
    ell(rx, ry, rz, p, col, rot = null, det = 1, glow = false) {
      const g = new THREE.IcosahedronGeometry(1, det).scale(rx, ry, rz);
      if (rot) g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')));
      g.translate(...p);
      return k.add(g, col, glow);
    },
    // rough rock chunk
    rock(rad, p, col, sq = [1, 1, 1], det = 0) {
      const g = new THREE.DodecahedronGeometry(rad, det);
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { const j = 0.85 + ((Math.sin(a[i] * 37.1 + a[i + 1] * 17.3 + a[i + 2] * 11.7 + seed) + 1) * 0.5) * 0.3; a[i] *= j * sq[0]; a[i + 1] *= j * sq[1]; a[i + 2] *= j * sq[2]; }
      g.rotateY(r() * 6).translate(...p);
      return k.add(g, col);
    },
    box(w, h, d, p, col, rot = null) {
      const g = new THREE.BoxGeometry(w, h, d);
      if (rot) g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')));
      g.translate(...p);
      return k.add(g, col);
    },
    // tapered limb from a to b
    limb(a, b, r1, r2, col, seg = 6, caps = true) {
      const va = V(...a), vb = V(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, !caps);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, vb.clone().sub(va).normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      return k.add(g, col);
    },
    // joint ball + limb chain: pts [[x,y,z],...], radii [..]
    chain(pts, rads, col, seg = 6) {
      for (let i = 0; i < pts.length - 1; i++) k.limb(pts[i], pts[i + 1], rads[i], rads[i + 1], col, seg, false);
      for (let i = 0; i < pts.length; i++) k.ell(rads[i], rads[i], rads[i], pts[i], col, null, 0);
    },
    // cone from base a to tip b; flat squashes the cone across one axis
    cone(a, b, rad, col, seg = 5, flat = 1, glow = false) {
      const va = V(...a), vb = V(...b), len = va.distanceTo(vb);
      const g = new THREE.ConeGeometry(rad, len, seg).translate(0, len / 2, 0).scale(1, 1, flat);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, vb.clone().sub(va).normalize()));
      g.translate(...a);
      return k.add(g, col, glow);
    },
    // frustum (skirts, belts)
    frus(rTop, rBot, h, p, col, seg = 8, sz = 1, open = false) {
      const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open).scale(1, 1, sz).translate(p[0], p[1] + h / 2, p[2]);
      return k.add(g, col);
    },
    torus(rad, tube, p, col, rot = [Math.PI / 2, 0, 0], sz = 1, seg = 12) {
      const g = new THREE.TorusGeometry(rad, tube, 4, seg).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ'))).scale(1, 1, sz).translate(...p);
      return k.add(g, col);
    },
    // swept tube with variable radius. rad(t) -> radius, col(t, dir, p) -> colour per face
    tube(pts, rad, col, { seg = 6, n = 10, sx = 1, capEnd = true } = {}) {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(...p)), false, 'catmullrom', 0.5);
      const P = [], T = [];
      for (let i = 0; i <= n; i++) { P.push(curve.getPoint(i / n)); T.push(curve.getTangent(i / n).normalize()); }
      let N = new THREE.Vector3().crossVectors(T[0], Math.abs(T[0].y) > 0.9 ? V(1, 0, 0) : UPV).normalize();
      const rings = [];
      for (let i = 0; i <= n; i++) {
        if (i > 0) N.sub(T[i].clone().multiplyScalar(N.dot(T[i]))).normalize();
        const Bv = new THREE.Vector3().crossVectors(T[i], N);
        const rr = typeof rad === 'function' ? rad(i / n) : rad;
        const ring = [];
        for (let j = 0; j < seg; j++) {
          const a = (j / seg) * Math.PI * 2;
          const d = N.clone().multiplyScalar(Math.cos(a) * sx).add(Bv.clone().multiplyScalar(Math.sin(a)));
          ring.push({ p: P[i].clone().addScaledVector(d, rr), d: d.normalize() });
        }
        rings.push(ring);
      }
      const pos = [], fc = [];
      const cf = typeof col === 'function' ? col : () => col;
      for (let i = 0; i < n; i++) for (let j = 0; j < seg; j++) {
        const j2 = (j + 1) % seg, a = rings[i][j], b = rings[i][j2], c = rings[i + 1][j], d = rings[i + 1][j2];
        const dm = a.d.clone().add(b.d).add(c.d).add(d.d).normalize();
        const cc = new THREE.Color().copy(toCol(cf((i + 0.5) / n, dm, P[i])));
        pos.push(...a.p.toArray(), ...b.p.toArray(), ...c.p.toArray(), ...b.p.toArray(), ...d.p.toArray(), ...c.p.toArray());
        fc.push(cc, cc);
      }
      if (capEnd) {
        const last = rings[n], tip = P[n].clone().addScaledVector(T[n], (typeof rad === 'function' ? rad(1) : rad) * 0.8);
        const cc = new THREE.Color().copy(toCol(cf(1, T[n], P[n])));
        for (let j = 0; j < seg; j++) { pos.push(...last[j].p.toArray(), ...last[(j + 1) % seg].p.toArray(), ...tip.toArray()); fc.push(cc); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      return k.add(g, null, false, fc);
    },
    // glowing eye
    eye(p, rad, col) { k.ell(rad, rad, rad * 0.7, p, col, null, 0, true); },
    // mirror helper: fn(s) for s = +1, -1
    both(fn) { fn(1); fn(-1); },
  };
  k.parts = parts;
  return k;
}

// merge parts -> { body, glow }, with per-face colour, fake AO, top light, painterly jitter, uv
function finish(k, { ao = 0.25, jitter = 0.07, scale = 1 } = {}) {
  if (scale !== 1) for (const part of k.parts) part.g.scale(scale, scale, scale);
  const out = (glow) => {
    const pos = [], nor = [], col = [], uv = [];
    const rnd = mulberry32(97);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const cc = new THREE.Color();
    let any = false;
    for (const part of k.parts) {
      if (!!part.glow !== glow) continue;
      any = true;
      const p = part.g.attributes.position.array;
      for (let i = 0, f = 0; i < p.length; i += 9, f++) {
        a.fromArray(p, i); b.fromArray(p, i + 3); c.fromArray(p, i + 6);
        n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
        if (n.lengthSq() < 1e-14) continue;
        n.normalize();
        m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        if (part.faceCols) cc.copy(part.faceCols[f]);
        else if (typeof part.col === 'function') cc.copy(toCol(part.col(m, n, f)));
        else cc.copy(toCol(part.col));
        if (!glow) {
          const occ = 0.55 + 0.45 * smooth(0, ao, m.y);
          const top = 1 + 0.1 * Math.max(0, n.y) - 0.12 * Math.max(0, -n.y);
          const j = 1 + (rnd() - 0.5) * 2 * jitter;
          cc.multiplyScalar(occ * top * j);
        }
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        for (const v of [a, b, c]) {
          pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); col.push(cc.r, cc.g, cc.b);
          if (ax >= ay && ax >= az) uv.push(v.z, v.y); else if (ay >= az) uv.push(v.x, v.z); else uv.push(v.x, v.y);
        }
      }
    }
    if (!any) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (!glow) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };
  return { body: out(false), glow: out(true) };
}

// ---------------------------------------------------------------- palette
const LEATHER = 0x6a4428, LEATHER_D = 0x4a2e1a, WOOD = 0x8a5e34, WOOD_D = 0x5e3c20, IRON = 0x8e949e, IRON_D = 0x5a5e68, BONE = 0xeee2c0, TEETH = 0xfff6dc, MOUTH = 0x5a1414, BLACK = 0x1e1a1a, FUR = 0x7a5a3c;

// ---------------------------------------------------------------- goblin
function goblin() {
  const k = nkit(11);
  const SK = byN(0x8ad44e, 0x6eb43a, 0x4a8a2a), SKD = 0x4f8c2c, RAG = byN(0x9a6e3e, 0x7e5530, 0x5a3a20);
  k.both((s) => {
    // bent legs + big feet
    k.chain([[s * 0.075, 0.34, -0.02], [s * 0.11, 0.2, 0.07], [s * 0.095, 0.06, -0.01]], [0.042, 0.034, 0.03], SKD);
    k.ell(0.055, 0.035, 0.1, [s * 0.1, 0.035, 0.04], LEATHER_D, [0, s * -0.2, 0]);
    k.cone([s * 0.1, 0.03, 0.12], [s * 0.1, 0.05, 0.17], 0.02, SKD, 4);
    // ears: huge, flat, pointing out and back
    k.at([s * 0.1, 0.71, 0.04], [0, s * 0.35, s * 0.25], 1, () => {
      k.cone([0, 0, 0], [s * 0.3, 0.05, 0], 0.075, SK, 4, 0.3);
      k.cone([s * 0.02, 0, 0.012], [s * 0.24, 0.045, 0.012], 0.045, 0xd88a7a, 4, 0.2);
    });
    // eyes
    k.eye([s * 0.048, 0.715, 0.165], 0.026, 0xffe23a);
    k.ell(0.04, 0.015, 0.02, [s * 0.05, 0.75, 0.16], 0x2e4a1a, [0, 0, s * -0.35]);
  });
  // ragged tunic + belt
  k.frus(0.11, 0.165, 0.2, [0, 0.24, 0], RAG, 7);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.2; k.cone([Math.sin(a) * 0.14, 0.27, Math.cos(a) * 0.14], [Math.sin(a) * 0.17, 0.18, Math.cos(a) * 0.17], 0.04, 0x6a4626, 3, 0.4); }
  k.torus(0.125, 0.018, [0, 0.43, 0], LEATHER_D);
  k.box(0.04, 0.035, 0.02, [0, 0.43, 0.13], 0xc8a040);
  // hunched torso
  k.ell(0.13, 0.15, 0.11, [0, 0.52, 0.0], RAG, [0.35, 0, 0]);
  k.ell(0.09, 0.07, 0.07, [0, 0.6, 0.06], SK, [0.35, 0, 0]);
  // head: big
  k.ell(0.13, 0.115, 0.125, [0, 0.7, 0.07], SK);
  k.ell(0.1, 0.05, 0.08, [0, 0.635, 0.11], SK, [0.2, 0, 0]);
  k.cone([0, 0.7, 0.17], [0, 0.65, 0.29], 0.032, 0x7ac446, 5);
  // grin with teeth
  k.box(0.12, 0.02, 0.03, [0, 0.638, 0.17], MOUTH);
  k.both((s) => k.cone([s * 0.035, 0.633, 0.18], [s * 0.035, 0.66, 0.19], 0.012, TEETH, 3));
  // hair tuft
  k.cone([0, 0.8, 0.02], [0, 0.88, -0.08], 0.045, 0x2a2018, 4);
  // spear arm (-x)
  k.chain([[-0.12, 0.58, 0.0], [-0.19, 0.47, 0.06], [-0.2, 0.47, 0.18]], [0.036, 0.03, 0.03], SKD);
  k.ell(0.035, 0.035, 0.035, [-0.2, 0.47, 0.19], SK);
  k.limb([-0.205, 0.0, 0.14], [-0.2, 1.0, 0.24], 0.014, 0.014, WOOD, 5);
  k.cone([-0.2, 1.0, 0.24], [-0.199, 1.15, 0.255], 0.035, byN(0xd0d6de, 0x9aa0aa, 0x6a707a), 4, 0.4);
  k.torus(0.02, 0.008, [-0.2, 0.98, 0.237], 0xc03a2a, [Math.PI / 2, 0, 0], 1, 6);
  k.cone([-0.2, 0.97, 0.236], [-0.16, 0.88, 0.26], 0.02, 0xd84a30, 3, 0.4);
  k.cone([-0.2, 0.97, 0.236], [-0.24, 0.9, 0.22], 0.018, 0xf0d050, 3, 0.4);
  // shield arm (+x): small round wooden shield
  k.chain([[0.12, 0.58, 0.0], [0.19, 0.46, 0.05], [0.16, 0.42, 0.15]], [0.036, 0.03, 0.03], SKD);
  k.at([0.17, 0.44, 0.19], [0.15, 0.5, 0], 1, () => {
    const g = new THREE.CylinderGeometry(0.13, 0.13, 0.025, 9).rotateX(Math.PI / 2);
    k.add(g, (p, n) => (Math.abs(n.z) > 0.5 ? (Math.floor((p.x + 1) * 22) % 2 ? 0x9a6a38 : 0x845a2e) : 0x5a3a20));
    k.ell(0.035, 0.035, 0.02, [0, 0, 0.015], IRON);
    k.box(0.27, 0.02, 0.01, [0, 0.05, 0.014], IRON_D, [0, 0, 0.3]);
  });
  return finish(k);
}

// ---------------------------------------------------------------- wolf
function wolf() {
  const k = nkit(21);
  const FURC = byN(0x5a5852, 0xa8a49c, 0xeae4d6, 0.3, -0.25);
  const LEG = byN(0x8a867e, 0x96928a, 0xd0cabe);
  // body: deep chest, tucked waist, haunch
  k.ell(0.16, 0.2, 0.24, [0, 0.47, 0.2], FURC, [-0.15, 0, 0]);
  k.ell(0.12, 0.13, 0.24, [0, 0.47, -0.1], FURC, [0.05, 0, 0]);
  k.ell(0.14, 0.16, 0.17, [0, 0.47, -0.32], FURC);
  // raised hackles along the spine
  for (let i = 0; i < 7; i++) { const z = 0.3 - i * 0.09, y = 0.64 - Math.abs(z - 0.05) * 0.18; k.cone([0, y - 0.04, z], [0, y + 0.06 - i * 0.006, z - 0.07], 0.045 - i * 0.003, 0x45423e, 4, 0.5); }
  // neck ruff
  k.ell(0.16, 0.17, 0.15, [0, 0.52, 0.38], FURC, [0.5, 0, 0]);
  k.both((s) => {
    for (let i = 0; i < 3; i++) k.cone([s * 0.1, 0.47 + i * 0.07, 0.4], [s * 0.21, 0.44 + i * 0.08, 0.3], 0.05, i === 0 ? 0xeae4d6 : 0x9a968e, 4, 0.5);
    // front leg
    k.ell(0.07, 0.13, 0.09, [s * 0.1, 0.4, 0.25], FURC, [0.3, 0, 0], 0);
    k.chain([[s * 0.11, 0.33, 0.29], [s * 0.115, 0.18, 0.31], [s * 0.11, 0.05, 0.35]], [0.055, 0.04, 0.033], LEG);
    k.ell(0.045, 0.032, 0.065, [s * 0.11, 0.032, 0.38], 0x5a5e66);
    // hind leg
    k.ell(0.08, 0.15, 0.12, [s * 0.085, 0.42, -0.3], FURC);
    k.chain([[s * 0.1, 0.34, -0.27], [s * 0.11, 0.23, -0.22], [s * 0.1, 0.13, -0.38], [s * 0.1, 0.04, -0.35]], [0.06, 0.045, 0.035, 0.03], LEG);
    k.ell(0.045, 0.032, 0.065, [s * 0.1, 0.032, -0.32], 0x5a5e66);
  });
  // head: lowered, snarling
  k.at([0, 0.53, 0.53], [0.25, 0, 0], 1.08, () => {
    k.ell(0.11, 0.095, 0.11, [0, 0.02, 0], FURC);
    // muzzle
    k.limb([0, 0.0, 0.07], [0, -0.01, 0.24], 0.06, 0.04, byN(0x5a5852, 0x9a968e, 0xe0dace), 6);
    k.ell(0.03, 0.025, 0.022, [0, 0.0, 0.25], BLACK);
    // wrinkled snarl
    for (let i = 0; i < 3; i++) k.box(0.075 - i * 0.012, 0.006, 0.01, [0, 0.038 - i * 0.004, 0.11 + i * 0.035], 0x3a3632);
    // open jaw
    k.limb([0, -0.05, 0.05], [0, -0.1, 0.2], 0.045, 0.028, byN(0x9a968e, 0xd8d2c6, 0xe8e2d4), 6);
    k.ell(0.04, 0.02, 0.08, [0, -0.045, 0.14], MOUTH, [0.2, 0, 0]);
    k.ell(0.02, 0.008, 0.04, [0, -0.06, 0.17], 0xc84a5a, [0.3, 0, 0]);
    k.both((s) => {
      k.cone([s * 0.032, -0.025, 0.2], [s * 0.03, -0.075, 0.205], 0.012, TEETH, 4);
      k.cone([s * 0.03, -0.085, 0.17], [s * 0.028, -0.04, 0.18], 0.011, TEETH, 4);
      k.cone([s * 0.04, -0.03, 0.12], [s * 0.04, -0.06, 0.12], 0.008, TEETH, 3);
      // ears: pinned back a bit
      k.cone([s * 0.06, 0.08, -0.02], [s * 0.1, 0.2, -0.08], 0.04, byN(0x4a4640, 0x6a665e, 0x3a3632), 4, 0.45);
      k.eye([s * 0.048, 0.04, 0.085], 0.019, 0xffc828);
      k.box(0.05, 0.012, 0.02, [s * 0.045, 0.065, 0.09], 0x2e323a, [0, 0, s * -0.4]);
    });
  });
  // bushy tail
  const tc = (t, d) => (t > 0.8 ? 0xf0ece4 : d.y > 0.2 ? 0x5a5852 : 0xa8a49c);
  k.tube([[0, 0.53, -0.42], [0, 0.46, -0.58], [0.04, 0.34, -0.72], [0.1, 0.24, -0.78]], (t) => 0.035 + Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.85) * 0.07, tc, { seg: 6, n: 9 });
  return finish(k);
}

// ---------------------------------------------------------------- orc
function orc() {
  const k = nkit(31);
  const SK = byN(0x78a848, 0x5a8a3a, 0x3e6a28), SKD = 0x4e7a32;
  const PANTS = byN(0x6a5a44, 0x54463a, 0x3a3028);
  k.both((s) => {
    // legs + boots
    k.chain([[s * 0.1, 0.46, 0], [s * 0.14, 0.26, 0.06], [s * 0.14, 0.08, 0.0]], [0.07, 0.055, 0.05], PANTS);
    k.ell(0.065, 0.06, 0.11, [s * 0.14, 0.06, 0.04], LEATHER_D);
    k.frus(0.06, 0.07, 0.06, [s * 0.14, 0.1, 0.01], LEATHER, 7);
    // pecs
    k.ell(0.1, 0.07, 0.06, [s * 0.085, 0.72, 0.11], SK, [0.2, 0, 0]);
    // tusks
    k.cone([s * 0.045, 0.835, 0.15], [s * 0.065, 0.92, 0.18], 0.017, BONE, 5);
    // ears
    k.cone([s * 0.09, 0.9, 0.04], [s * 0.18, 0.95, -0.02], 0.03, SK, 4, 0.4);
    k.eye([s * 0.04, 0.9, 0.145], 0.017, 0xff3a1a);
  });
  // kilt with leather strips + belt
  k.frus(0.16, 0.2, 0.16, [0, 0.36, 0], PANTS, 8);
  for (let i = 0; i < 6; i++) { const a = -1.1 + i * 0.44; k.box(0.07, 0.17, 0.02, [Math.sin(a) * 0.19, 0.36, Math.cos(a) * 0.19], i % 2 ? LEATHER : 0x7a3a28, [0.15, a, 0]); }
  k.torus(0.165, 0.025, [0, 0.52, 0], LEATHER_D, undefined, 0.85);
  k.ell(0.04, 0.04, 0.02, [0, 0.52, 0.145], 0xc8c8d0);
  // torso: V-shaped and broad
  k.ell(0.15, 0.13, 0.12, [0, 0.56, 0.02], SK);
  k.ell(0.24, 0.17, 0.15, [0, 0.72, 0.0], SK);
  k.ell(0.15, 0.08, 0.12, [0, 0.82, -0.03], SK);
  // chest strap + quiver on back
  k.box(0.06, 0.48, 0.03, [0, 0.67, 0.13], LEATHER_D, [0, 0, 0.75]);
  k.at([0.08, 0.72, -0.15], [0.25, 0, -0.45], 1, () => {
    k.frus(0.05, 0.045, 0.3, [0, -0.15, 0], LEATHER, 7);
    for (let i = 0; i < 4; i++) { const x = (i % 2 - 0.5) * 0.04, z = ((i >> 1) - 0.5) * 0.04; k.limb([x, 0.1, z], [x, 0.22, z], 0.006, 0.006, WOOD, 3); k.cone([x, 0.19, z], [x, 0.26, z], 0.02, 0xc83a2a, 3, 0.3); }
  });
  // spiked iron pauldron (right / -x)
  k.ell(0.11, 0.08, 0.11, [-0.23, 0.84, 0], byN(0xb0b6c0, 0x7e848e, 0x4e525a), null, 1);
  k.cone([-0.25, 0.88, 0.03], [-0.33, 1.0, 0.03], 0.03, 0xd8dce4, 5);
  k.cone([-0.2, 0.9, -0.05], [-0.25, 1.01, -0.09], 0.025, 0xd8dce4, 5);
  k.ell(0.08, 0.06, 0.08, [0.23, 0.82, 0], LEATHER);
  // head: thrust forward, heavy jaw
  k.ell(0.1, 0.1, 0.1, [0, 0.9, 0.06], SK);
  k.box(0.15, 0.07, 0.1, [0, 0.83, 0.1], SK);
  k.box(0.17, 0.035, 0.05, [0, 0.935, 0.13], 0x3e6a28, [0.25, 0, 0]);
  k.cone([0, 0.89, 0.15], [0, 0.875, 0.19], 0.025, SK, 4);
  // mohawk
  for (let i = 0; i < 5; i++) k.cone([0, 0.97 - Math.abs(i - 1) * 0.01, 0.11 - i * 0.05], [0, 1.08 - i * 0.012, 0.06 - i * 0.065], 0.03, 0x1e1a18, 4, 0.5);
  // left arm (+x): holds the bow out front
  k.chain([[0.25, 0.78, 0], [0.31, 0.62, 0.12], [0.27, 0.6, 0.3]], [0.06, 0.05, 0.045], SK);
  k.ell(0.045, 0.05, 0.045, [0.27, 0.6, 0.32], SKD);
  k.frus(0.05, 0.05, 0.08, [0.29, 0.57, 0.22], LEATHER, 6);
  const BOW = (t) => (t > 0.45 && t < 0.55 ? 0x3a2414 : WOOD);
  k.tube([[0.25, 0.18, 0.24], [0.26, 0.3, 0.33], [0.27, 0.6, 0.36], [0.26, 0.9, 0.33], [0.25, 1.02, 0.24]], (t) => 0.02 - Math.abs(t - 0.5) * 0.016, BOW, { seg: 5, n: 12 });
  k.limb([0.25, 0.19, 0.24], [0.25, 1.01, 0.24], 0.004, 0.004, 0xe8e0c8, 3);
  // right arm (-x): war axe raised
  k.chain([[-0.27, 0.78, 0], [-0.33, 0.6, 0.06], [-0.3, 0.72, 0.2]], [0.06, 0.05, 0.045], SK);
  k.ell(0.045, 0.05, 0.045, [-0.3, 0.72, 0.21], SKD);
  k.limb([-0.3, 0.55, 0.18], [-0.3, 1.08, 0.26], 0.018, 0.016, WOOD_D, 5);
  k.at([-0.3, 1.0, 0.25], [-0.15, 0, 0], 1, () => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.05); sh.lineTo(-0.1, 0.09); sh.quadraticCurveTo(-0.2, 0.08, -0.22, 0.15); sh.quadraticCurveTo(-0.26, 0.0, -0.22, -0.15); sh.quadraticCurveTo(-0.2, -0.07, -0.1, -0.08); sh.lineTo(0, -0.05); sh.lineTo(0.05, 0); sh.lineTo(0, 0.05);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -0.012);
    k.add(g, (p, n) => (Math.abs(n.z) < 0.5 ? 0xe8ecf2 : p.x < -0.5 ? 0xc0c6d0 : 0x7e848e));
  });
  return finish(k);
}

// ---------------------------------------------------------------- ogre
function ogre() {
  const k = nkit(41);
  const SK = byN(0xdcae7c, 0xc08e5e, 0x8e6440), SKD = 0xa87850, BELLY = byN(0xe8c094, 0xe0b488, 0xb08a60);
  const HIDE = byN(0x8a6438, 0x6e4c2a, 0x4a3018);
  k.both((s) => {
    // stumpy legs + big feet
    k.chain([[s * 0.14, 0.38, 0], [s * 0.17, 0.2, 0.05], [s * 0.16, 0.07, 0.01]], [0.1, 0.08, 0.07], SK);
    k.ell(0.09, 0.06, 0.13, [s * 0.165, 0.055, 0.05], SK);
    for (let i = -1; i <= 1; i++) k.ell(0.022, 0.018, 0.02, [s * 0.165 + i * 0.045, 0.04, 0.175], 0xe8d8b8, null, 0);
    // shoulders
    k.ell(0.14, 0.12, 0.13, [s * 0.3, 0.98, -0.04], SK);
    // tiny eyes, ears
    k.eye([s * 0.045, 1.08, 0.215], 0.017, 0xffa020);
    k.ell(0.04, 0.05, 0.02, [s * 0.13, 1.07, 0.1], SK, [0, s * 0.5, 0]);
    // underbite teeth
    k.cone([s * 0.05, 1.0, 0.24], [s * 0.055, 1.05, 0.25], 0.017, TEETH, 4);
  });
  // loincloth of hide with front flap
  k.frus(0.27, 0.3, 0.16, [0, 0.34, 0], HIDE, 9);
  k.box(0.2, 0.22, 0.03, [0, 0.27, 0.27], HIDE, [0.15, 0, 0]);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; k.cone([Math.sin(a) * 0.27, 0.37, Math.cos(a) * 0.27], [Math.sin(a) * 0.31, 0.3, Math.cos(a) * 0.31], 0.05, 0xcab08a, 3, 0.5); }
  // huge belly + chest
  k.ell(0.31, 0.3, 0.29, [0, 0.62, 0.06], BELLY);
  k.ell(0.02, 0.02, 0.01, [0, 0.58, 0.345], 0x8e6440, null, 0);
  k.torus(0.27, 0.025, [0, 0.42, 0.04], 0x9a8a5a, [Math.PI / 2 - 0.1, 0, 0], 1.05);
  k.ell(0.33, 0.2, 0.22, [0, 0.9, -0.04], SK);
  // fur pelt over the left shoulder
  k.ell(0.2, 0.1, 0.2, [0.22, 1.0, -0.04], byN(0x6a4a2c, 0x5a3c22, 0x3a2614), [0, 0, -0.35]);
  k.box(0.08, 0.5, 0.03, [0.05, 0.82, 0.17], 0x5a3c22, [0.2, 0, -0.75]);
  // head: small, low, forward
  k.ell(0.13, 0.13, 0.12, [0, 1.08, 0.12], SK);
  k.box(0.2, 0.08, 0.13, [0, 1.0, 0.16], SK);
  k.ell(0.045, 0.04, 0.05, [0, 1.06, 0.245], 0xd09068);
  k.box(0.17, 0.025, 0.04, [0, 1.115, 0.21], SKD, [0.3, 0, 0]);
  k.cone([0, 1.2, 0.08], [0.02, 1.27, 0.0], 0.012, 0x3a2a1a, 3);
  k.cone([0.03, 1.2, 0.07], [0.07, 1.25, -0.02], 0.01, 0x3a2a1a, 3);
  k.torus(0.025, 0.007, [-0.135, 1.03, 0.1], 0xf0c040, [0, Math.PI / 2, 0], 1, 8);
  // left arm hangs, huge fist
  k.chain([[0.33, 0.95, -0.02], [0.43, 0.68, 0.04], [0.42, 0.44, 0.12]], [0.09, 0.075, 0.065], SK);
  k.ell(0.085, 0.08, 0.085, [0.42, 0.4, 0.14], SKD);
  // right arm: spiked club over the shoulder
  k.chain([[-0.33, 0.95, -0.02], [-0.45, 0.72, 0.1], [-0.33, 0.82, 0.27]], [0.09, 0.075, 0.065], SK);
  k.ell(0.085, 0.08, 0.085, [-0.32, 0.83, 0.29], SKD);
  const a = V(-0.33, 0.76, 0.36), b = V(-0.5, 1.3, -0.32), d = b.clone().sub(a).normalize();
  k.limb(a.toArray(), b.toArray(), 0.04, 0.12, byN(0x9a6a3a, 0x7a5030, 0x5a3a20), 7);
  k.ell(0.12, 0.12, 0.12, b.toArray(), byN(0x9a6a3a, 0x7a5030, 0x5a3a20), null, 1);
  for (let i = 0; i < 9; i++) {
    const t = 0.55 + (i % 3) * 0.17 + 0.05, ang = i * 2.39;
    const c = a.clone().lerp(b, Math.min(1, t)); const rr = 0.04 + 0.08 * t;
    const side = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d));
    const base = c.clone().addScaledVector(side, rr * 0.8);
    k.cone(base.toArray(), base.clone().addScaledVector(side, 0.07).toArray(), 0.018, 0xc8c0b0, 4);
  }
  return finish(k);
}

// ---------------------------------------------------------------- troll
function troll() {
  const k = nkit(51);
  const SK = byN(0x7aa840, 0x6e8a72, 0x44524a, 0.45, -0.3);
  const SKL = byN(0x76a042, 0x6a8670, 0x44524a);
  const ROCK = byN(0x7a9c3c, 0x8a8a84, 0x5a5a56, 0.4, -0.2);
  k.both((s) => {
    // long bent legs, big flat clawed feet
    k.chain([[s * 0.1, 0.5, -0.06], [s * 0.15, 0.3, 0.08], [s * 0.13, 0.07, -0.03]], [0.06, 0.045, 0.04], SKL);
    k.ell(0.07, 0.04, 0.12, [s * 0.14, 0.04, 0.03], SKL);
    for (let i = -1; i <= 1; i++) k.cone([s * 0.14 + i * 0.035, 0.03, 0.13], [s * 0.14 + i * 0.04, 0.02, 0.19], 0.014, 0x2a2a24, 3);
    k.rock(0.06, [s * 0.16, 0.32, 0.1], ROCK);
    // very long arms dragging near the ground
    k.chain([[s * 0.22, 0.88, 0.06], [s * 0.37, 0.6, 0.0], [s * 0.33, 0.26, 0.2]], [0.065, 0.06, 0.05], SKL);
    k.rock(0.075, [s * 0.25, 0.94, 0.02], ROCK, [1.2, 0.9, 1]);
    k.rock(0.06, [s * 0.37, 0.44, 0.1], ROCK);
    k.ell(0.075, 0.085, 0.07, [s * 0.33, 0.19, 0.23], SKL);
    for (let i = -1; i <= 1; i++) k.cone([s * (0.33 + i * 0.03), 0.14, 0.26], [s * (0.33 + i * 0.035), 0.05, 0.3], 0.014, 0x2a2a24, 3);
    // droopy long ears, eyes
    k.cone([s * 0.07, 0.86, 0.22], [s * 0.2, 0.8, 0.16], 0.03, SKL, 4, 0.4);
    k.eye([s * 0.04, 0.88, 0.32], 0.016, 0xd8ff3a);
    // tusks
    k.cone([s * 0.04, 0.79, 0.33], [s * 0.05, 0.84, 0.36], 0.012, BONE, 4);
  });
  // loin wrap of leaves/hide
  k.frus(0.13, 0.17, 0.12, [0, 0.42, -0.02], byN(0x4a5a2a, 0x3e4a24, 0x2a321a), 7);
  // hunched torso
  k.ell(0.14, 0.14, 0.12, [0, 0.58, -0.02], SK);
  k.ell(0.2, 0.17, 0.17, [0, 0.78, 0.06], SK, [0.5, 0, 0]);
  // rocky back ridge
  for (let i = 0; i < 5; i++) k.rock(0.07 - i * 0.008, [k.rr(-0.05, 0.05), 0.92 - i * 0.09, -0.06 - i * 0.03 + (i === 0 ? 0.02 : 0)], ROCK, [1, 0.8, 1]);
  k.rock(0.06, [0.1, 0.78, -0.12], ROCK);
  k.rock(0.05, [-0.11, 0.7, -0.1], ROCK);
  // head: low, forward, big drooping nose
  k.ell(0.105, 0.095, 0.11, [0, 0.88, 0.25], SK);
  k.box(0.11, 0.05, 0.08, [0, 0.8, 0.3], SKL);
  k.cone([0, 0.88, 0.33], [0, 0.77, 0.45], 0.045, 0x8a9a74, 5);
  k.box(0.13, 0.025, 0.04, [0, 0.905, 0.32], 0x3a4236, [0.3, 0, 0]);
  // mossy hair
  for (let i = 0; i < 6; i++) { const a = -1.2 + i * 0.48; k.cone([Math.sin(a) * 0.05, 0.95, 0.22 - Math.cos(a) * 0.04], [Math.sin(a) * 0.1, 0.9, 0.08 - Math.cos(a) * 0.06], 0.035, i % 2 ? 0x5a8a2a : 0x4a7020, 3, 0.5); }
  return finish(k);
}

// ---------------------------------------------------------------- cyclops
function cyclops() {
  const k = nkit(61);
  const SK = byN(0xd88a5c, 0xb86c44, 0x7e4428), SKD = 0x9a5434;
  const HIDE = byN(0x8a5a30, 0x6a4422, 0x4a2c14);
  k.both((s) => {
    k.chain([[s * 0.13, 0.62, 0], [s * 0.17, 0.35, 0.07], [s * 0.15, 0.09, 0.0]], [0.1, 0.075, 0.06], SK);
    k.ell(0.075, 0.055, 0.13, [s * 0.155, 0.055, 0.05], SK);
    k.frus(0.07, 0.075, 0.05, [s * 0.15, 0.1, 0.0], LEATHER_D, 7);
    k.box(0.12, 0.02, 0.12, [s * 0.155, 0.005, 0.05], LEATHER_D);
    // pecs
    k.ell(0.13, 0.09, 0.08, [s * 0.11, 1.04, 0.13], SK, [0.2, 0, 0]);
    k.ell(0.13, 0.11, 0.12, [s * 0.3, 1.13, -0.02], SK);
    // ears
    k.ell(0.03, 0.05, 0.02, [s * 0.14, 1.32, 0.03], SK, [0, s * 0.4, 0]);
    // tusks
    k.cone([s * 0.05, 1.2, 0.15], [s * 0.06, 1.25, 0.17], 0.015, TEETH, 4);
  });
  // loincloth, belt with gold buckle
  k.frus(0.2, 0.23, 0.18, [0, 0.55, 0], HIDE, 8);
  k.box(0.2, 0.28, 0.03, [0, 0.42, 0.21], HIDE, [0.1, 0, 0]);
  k.box(0.18, 0.24, 0.03, [0, 0.45, -0.2], HIDE, [-0.1, 0, 0]);
  k.torus(0.2, 0.03, [0, 0.72, 0], LEATHER_D, undefined, 0.85, 12);
  k.box(0.08, 0.07, 0.03, [0, 0.72, 0.18], 0xe8b840);
  // torso
  k.ell(0.2, 0.17, 0.15, [0, 0.82, 0.02], SK);
  k.ell(0.3, 0.2, 0.19, [0, 1.04, 0.0], SK);
  // shoulder strap
  k.box(0.07, 0.62, 0.03, [0, 0.98, 0.17], LEATHER_D, [0.05, 0, -0.65]);
  k.box(0.07, 0.62, 0.03, [0, 0.98, -0.18], LEATHER_D, [-0.05, 0, -0.65]);
  // head
  k.ell(0.15, 0.15, 0.14, [0, 1.3, 0.05], SK);
  k.box(0.2, 0.08, 0.12, [0, 1.2, 0.09], SK);
  k.box(0.14, 0.02, 0.03, [0, 1.19, 0.155], MOUTH);
  // the eye: white ball, glowing iris, black pupil, heavy brow
  k.ell(0.085, 0.075, 0.06, [0, 1.32, 0.15], 0xfff8ec);
  k.eye([0, 1.32, 0.2], 0.045, 0xff9a1a);
  k.ell(0.02, 0.03, 0.01, [0, 1.32, 0.235], BLACK, null, 0);
  k.box(0.22, 0.04, 0.06, [0, 1.395, 0.17], SKD, [0.35, 0, 0]);
  // horn
  k.tube([[0, 1.43, 0.06], [0, 1.52, 0.04], [0, 1.57, -0.04]], (t) => 0.04 * (1 - t) + 0.004, (t) => (t > 0.6 ? 0xf4ead0 : 0xb8a888), { seg: 5, n: 5 });
  // left arm: forward, open hand
  k.chain([[0.32, 1.12, -0.02], [0.42, 0.88, 0.08], [0.37, 0.72, 0.28]], [0.09, 0.075, 0.06], SK);
  k.ell(0.07, 0.07, 0.08, [0.36, 0.7, 0.31], SKD);
  k.frus(0.07, 0.07, 0.1, [0.39, 0.77, 0.21], LEATHER, 7);
  // right arm: raises a boulder over the shoulder
  k.chain([[-0.32, 1.12, -0.02], [-0.45, 1.25, 0.06], [-0.4, 1.46, 0.0]], [0.09, 0.075, 0.065], SK);
  k.ell(0.07, 0.07, 0.07, [-0.39, 1.5, 0.0], SKD);
  k.rock(0.17, [-0.34, 1.6, -0.08], byN(0x7a9a4a, 0x9a968e, 0x5e5a56, 0.45, -0.3), [1, 0.9, 1], 1);
  return finish(k, { scale: 0.92 });
}

// ---------------------------------------------------------------- hydra
function hydra() {
  const k = nkit(71);
  const SC = [0x2e7a52, 0x3a8a5e, 0x24684a];
  const scales = (p, n, f) => (n.y < -0.35 ? (Math.floor(p.z * 14) % 2 ? 0xe8d48a : 0xd4be72) : SC[f % 3]);
  // body
  k.ell(0.34, 0.26, 0.5, [0, 0.4, -0.14], scales, null, 2);
  k.ell(0.27, 0.22, 0.2, [0, 0.47, 0.2], scales, [-0.3, 0, 0], 1);
  // dorsal spikes
  for (let i = 0; i < 8; i++) { const z = 0.25 - i * 0.12, y = 0.62 - Math.pow(Math.abs(z + 0.1) / 0.5, 2) * 0.12; k.cone([0, y - 0.03, z], [0, y + 0.1 - Math.abs(i - 3) * 0.008, z - 0.08], 0.05, (p, n) => (p.y > y + 0.03 ? 0xf08a2a : 0xb84a2a), 4, 0.4); }
  k.both((s) => {
    for (const [z, fz] of [[0.18, 0.3], [-0.42, -0.36]]) {
      k.ell(0.1, 0.12, 0.12, [s * 0.25, 0.36, z], scales, null, 0);
      k.chain([[s * 0.28, 0.32, z], [s * 0.36, 0.2, z + 0.06], [s * 0.34, 0.06, fz]], [0.085, 0.07, 0.06], byN(0x2e7a52, 0x2a6e4a, 0x1e5038));
      k.ell(0.08, 0.04, 0.09, [s * 0.34, 0.04, fz + 0.04], 0x24684a, null, 0);
      for (let i = -1; i <= 1; i++) k.cone([s * 0.37 + i * 0.04, 0.03, fz + 0.1], [s * 0.37 + i * 0.05, 0.02, fz + 0.17], 0.015, BONE, 3);
    }
  });
  // tail curling to the side
  const tailc = (t, d) => (d.y < -0.4 ? 0xd4be72 : SC[Math.floor(t * 12) % 3]);
  k.tube([[0, 0.36, -0.55], [0, 0.22, -0.8], [0.14, 0.1, -1.0], [0.36, 0.06, -1.04], [0.5, 0.05, -0.92]], (t) => 0.16 * (1 - t) + 0.015, tailc, { seg: 7, n: 12 });
  for (let i = 0; i < 4; i++) { const z = -0.62 - i * 0.1; k.cone([0.02 * i, 0.34 - i * 0.07, z], [0.02 * i, 0.4 - i * 0.07, z - 0.07], 0.035, 0xb84a2a, 4, 0.4); }
  // five necks and heads
  const neckc = (t, d) => (d.z > 0.55 && d.y < 0.7 ? (Math.floor(t * 10) % 2 ? 0xead890 : 0xd2bc70) : SC[Math.floor(t * 9 + (d.x > 0 ? 1 : 0)) % 3]);
  const heads = [
    { b: [-0.24, 0.48, 0.22], m: [-0.5, 0.75, 0.25], t: [-0.55, 0.9, 0.48] },
    { b: [-0.12, 0.55, 0.25], m: [-0.22, 0.95, 0.2], t: [-0.27, 1.12, 0.48] },
    { b: [0, 0.58, 0.27], m: [0, 1.05, 0.25], t: [0, 1.28, 0.42] },
    { b: [0.12, 0.55, 0.25], m: [0.22, 0.95, 0.2], t: [0.27, 1.12, 0.48] },
    { b: [0.24, 0.48, 0.22], m: [0.5, 0.75, 0.25], t: [0.55, 0.9, 0.48] },
  ];
  heads.forEach((h, i) => {
    const mid2 = [(h.m[0] + h.t[0]) / 2, h.t[1] - 0.04, (h.m[2] + h.t[2]) / 2 - 0.08];
    k.tube([h.b, h.m, mid2, h.t], (t) => 0.09 - t * 0.04, neckc, { seg: 6, n: 8, capEnd: false });
    const dir = [h.t[0] * 0.5, -0.35, 1];
    k.aim(h.t, dir, () => k.at([0, 0, 0], null, 1.25, () => {
      const HC = byN(0x3a9a66, 0x2e7a52, 0xe0cc80, 0.3, -0.4);
      k.ell(0.075, 0.065, 0.09, [0, 0.01, 0.0], HC);
      k.limb([0, 0.02, 0.05], [0, 0.0, 0.18], 0.055, 0.03, HC, 6);
      // lower jaw, open
      k.limb([0, -0.04, 0.03], [0, -0.09, 0.15], 0.04, 0.02, byN(0x2e7a52, 0xd2bc70, 0xe0cc80), 5);
      k.ell(0.035, 0.015, 0.06, [0, -0.04, 0.1], MOUTH, [0.35, 0, 0], 0);
      k.both((s) => {
        k.cone([s * 0.03, -0.01, 0.15], [s * 0.03, -0.05, 0.155], 0.009, TEETH, 3);
        k.cone([s * 0.025, -0.075, 0.13], [s * 0.025, -0.04, 0.135], 0.008, TEETH, 3);
        k.eye([s * 0.048, 0.04, 0.06], 0.017, i === 2 ? 0xff5a2a : 0xffd02a);
        // horns / crest
        k.cone([s * 0.04, 0.05, -0.02], [s * 0.08, 0.1, -0.14], 0.022, 0xf0e2b8, 4);
        k.cone([s * 0.06, -0.01, -0.03], [s * 0.13, -0.01, -0.1], 0.025, 0xc85a2a, 3, 0.4);
      });
      k.box(0.11, 0.015, 0.03, [0, 0.07, 0.07], 0x1e5a3a, [0.3, 0, 0]);
    }));
  });
  return finish(k);
}

const BUILD = { goblin, wolf, orc, ogre, troll, cyclops, hydra };
const CACHE = new Map();
// neutralModel(id) -> { body, glow } for 'goblin','wolf','orc','ogre','troll','cyclops','hydra'; null for unknown ids
export function neutralModel(id) {
  if (!BUILD[id]) return null;
  if (!CACHE.has(id)) CACHE.set(id, BUILD[id]());
  return CACHE.get(id);
}
export const NEUTRAL_IDS = Object.keys(BUILD);
