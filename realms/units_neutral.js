import * as THREE from 'three';
import { BONE as B, tagRange } from './rig.js?v=0.6';

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
  // current rig bone + pivot (model space, before finish()'s scale) for parts added now
  let cur = { b: B.BODY, p: [0, 0, 0] };
  const k = {
    r,
    // set the default bone (usually BODY + hip pivot) for parts added outside k.bone()
    setBody(p) { cur = { b: B.BODY, p }; },
    // run fn with every part tagged as bone b rotating about pivot p (model space)
    bone(b, p, fn) { const old = cur; cur = { b, p }; fn(); cur = old; },
    rr: (a, b) => a + r() * (b - a),
    // add a geometry with colour (hex, Color or fn(centroid, normal, faceIndex))
    add(g, col, glow = false, faceCols = null) {
      g = g.index ? g.toNonIndexed() : g;
      g.applyMatrix4(M);
      parts.push({ g, col, glow, faceCols, bone: cur.b, pivot: cur.p });
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
    // cheap 8-tri eye / gem (octahedron), squashed in z
    gem(p, rad, col, glow = true, sz = 0.7) {
      const g = new THREE.OctahedronGeometry(rad, 0).scale(1, 1, sz).translate(...p);
      return k.add(g, col, glow);
    },
  };
  k.parts = parts;
  return k;
}

// merge parts -> { body, glow }, with per-face colour, a light fake AO (the shared
// material adds its own), top light, saturation lift, painterly jitter and uv
function finish(k, { ao = 0.3, jitter = 0.03, scale = 1, sat = 1.2 } = {}) {
  if (scale !== 1) for (const part of k.parts) part.g.scale(scale, scale, scale);
  const out = (glow) => {
    const pos = [], nor = [], col = [], uv = [];
    const rnd = mulberry32(97);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const cc = new THREE.Color();
    const ranges = [];
    let any = false;
    for (const part of k.parts) {
      if (!!part.glow !== glow) continue;
      any = true;
      ranges.push({ start: pos.length / 3, part });
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
          // warm sunlit tops, softly cooled undersides (coloured, never black)
          const occ = 0.84 + 0.16 * smooth(0, ao, m.y);
          const top = 1 + 0.12 * Math.max(0, n.y) - 0.07 * Math.max(0, -n.y);
          const j = 1 + (rnd() - 0.5) * 2 * jitter;
          cc.multiplyScalar(occ * top * j);
          if (n.y < -0.3) { cc.r *= 0.96; cc.b *= 1.05; }
          const l = cc.r * 0.3 + cc.g * 0.59 + cc.b * 0.11;
          cc.r = Math.min(1, Math.max(0, l + (cc.r - l) * sat));
          cc.g = Math.min(1, Math.max(0, l + (cc.g - l) * sat));
          cc.b = Math.min(1, Math.max(0, l + (cc.b - l) * sat));
        }
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        for (const v of [a, b, c]) {
          pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); col.push(cc.r, cc.g, cc.b);
          if (ax >= ay && ax >= az) uv.push(v.z, v.y); else if (ay >= az) uv.push(v.x, v.z); else uv.push(v.x, v.y);
        }
      }
      ranges[ranges.length - 1].count = pos.length / 3 - ranges[ranges.length - 1].start;
    }
    if (!any) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (!glow) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    // shader rig: every part carries its bone + pivot (scaled with the model)
    for (const { start, count, part } of ranges) if (count) tagRange(THREE, g, start, count, part.bone, part.pivot.map((v) => v * scale));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };
  return { body: out(false), glow: out(true) };
}

// ---------------------------------------------------------------- palette (sunny, saturated; no near-black)
// Round 4 (phone readability): every creature is built from a few big colour blocks with one
// strong accent, exaggerated identity features (heads ~1.3x, weapons ~1.4x) and no micro-detail.
// Signature colours: goblin acid-lime + violet, wolf slate-blue + snow belly, orc deep green +
// crimson, ogre ruddy tan + royal blue, troll lilac stone + chartreuse moss, cyclops rosy + teal,
// hydra emerald + flame orange.
const LEATHER = 0x9a6438, LEATHER_D = 0x7a4a2a, WOOD = 0xb87e44,
  STEEL = byN(0xf4f8ff, 0xc8d0dc, 0x8e98a8), BONE = 0xf6ecd0, TEETH = 0xfffaea, MOUTH = 0xb02c3c, DARK = 0x4a3442, GOLD = 0xffc83a;

// ---------------------------------------------------------------- goblin
function goblin() {
  const k = nkit(11);
  // acid-lime skin (brighter than any grass), violet tunic, red hair + red/yellow shield as the accent
  const SK = byN(0xe0fa64, 0xb8e63e, 0x84b42c), SKD = byN(0xc4ec4a, 0xa0d034, 0x7aa82a);
  const RAG = byN(0x9a78f4, 0x6c4cd0, 0x45329a);
  const NECK = [0, 0.62, 0.03];
  k.setBody([0, 0.32, 0]);
  k.both((s) => {
    // short bowed legs + big bare feet
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.08, 0.32, -0.01], () => {
      k.chain([[s * 0.08, 0.32, -0.01], [s * 0.12, 0.17, 0.05], [s * 0.1, 0.05, 0.0]], [0.055, 0.045, 0.04], SKD);
      k.ell(0.07, 0.045, 0.11, [s * 0.105, 0.04, 0.05], SK, [0, s * -0.2, 0], 0);
    });
    k.bone(B.HEAD, NECK, () => {
      // HUGE flat ears swept out and up: the goblin silhouette, pink inside
      k.at([s * 0.13, 0.76, 0.03], [0, s * 0.25, s * 0.38], 1, () => {
        k.cone([0, 0, 0], [s * 0.42, 0.09, -0.03], 0.11, SK, 4, 0.3);
        k.cone([s * 0.04, 0.0, 0.02], [s * 0.32, 0.075, 0.0], 0.065, 0xff9a9a, 4, 0.2);
      });
      // big glowing yellow eyes
      k.eye([s * 0.065, 0.77, 0.205], 0.042, 0xfff04a);
    });
  });
  // violet tunic with a jagged hem
  k.frus(0.13, 0.2, 0.22, [0, 0.2, 0], RAG, 7);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.25; k.cone([Math.sin(a) * 0.16, 0.24, Math.cos(a) * 0.16], [Math.sin(a) * 0.21, 0.12, Math.cos(a) * 0.21], 0.06, 0x5a3cb4, 3, 0.45); }
  k.torus(0.135, 0.03, [0, 0.43, 0], LEATHER_D, undefined, 1, 8);
  k.box(0.07, 0.06, 0.03, [0, 0.43, 0.145], GOLD);
  // stubby hunched torso
  k.ell(0.15, 0.15, 0.13, [0, 0.52, 0.0], RAG, [0.3, 0, 0]);
  // head: BIG, long hooked nose, wide white grin
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.19, 0.165, 0.17, [0, 0.76, 0.07], SK, null, 1);
    k.ell(0.14, 0.07, 0.11, [0, 0.67, 0.12], SK, [0.2, 0, 0], 0);
    k.tube([[0, 0.76, 0.22], [0, 0.73, 0.32], [0, 0.67, 0.37]], (t) => 0.045 * (1 - t) + 0.01, 0xc8f050, { seg: 5, n: 4 });
    k.box(0.17, 0.045, 0.04, [0, 0.665, 0.215], MOUTH, [0.15, 0, 0]);
    k.box(0.15, 0.022, 0.03, [0, 0.675, 0.228], TEETH, [0.15, 0, 0]);
    k.box(0.2, 0.035, 0.05, [0, 0.82, 0.2], 0x8ac030, [0.35, 0, 0]);
    // flame-red hair tuft
    for (let i = 0; i < 3; i++) k.cone([(i - 1) * 0.05, 0.88, 0.02], [(i - 1) * 0.1, 1.02 - Math.abs(i - 1) * 0.04, -0.09], 0.055, 0xf05a2a, 4);
  });
  // spear arm (-x = right): fat shaft, broad leaf blade, red tassel
  k.bone(B.ARM_R, [-0.13, 0.57, 0.0], () => {
    k.chain([[-0.13, 0.57, 0.0], [-0.2, 0.47, 0.07], [-0.21, 0.48, 0.19]], [0.045, 0.04, 0.04], SKD);
    k.ell(0.05, 0.05, 0.05, [-0.21, 0.48, 0.2], SK, null, 0);
    k.limb([-0.215, 0.0, 0.15], [-0.21, 1.02, 0.25], 0.024, 0.024, WOOD, 5);
    k.cone([-0.21, 1.0, 0.25], [-0.208, 1.26, 0.27], 0.085, STEEL, 4, 0.35);
    k.cone([-0.21, 0.99, 0.25], [-0.17, 0.85, 0.28], 0.04, 0xf04a30, 3, 0.5);
  });
  // shield arm (+x = left): big round shield, red face with a yellow sun
  k.bone(B.ARM_L, [0.13, 0.57, 0.0], () => {
    k.chain([[0.13, 0.57, 0.0], [0.2, 0.46, 0.06], [0.18, 0.43, 0.15]], [0.045, 0.04, 0.04], SKD);
    k.at([0.19, 0.42, 0.2], [0.15, 0.5, 0], 1, () => {
      k.add(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 10).rotateX(Math.PI / 2), (p, n) => (n.z > 0.5 ? 0xe8443a : n.z < -0.5 ? 0xa87438 : 0xd8a050));
      k.add(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 8).rotateX(Math.PI / 2).translate(0, 0, 0.022), 0xffd040);
    });
  });
  return finish(k);
}

// ---------------------------------------------------------------- wolf
function wolf() {
  const k = nkit(21);
  // saturated slate-blue back, cool blue flanks, snow-white belly + chest ruff: a strong value split
  const FURC = byN(0x40548c, 0x7c90c0, 0xf0f2f8, 0.3, -0.2);
  const LEG = byN(0x6a80b0, 0x7a8cba, 0xe4e8f0);
  const BACK = 0x34447a, SNOW = 0xf4f6fa;
  k.setBody([0, 0.45, 0.0]);
  k.ell(0.21, 0.22, 0.26, [0, 0.47, 0.18], FURC, [-0.15, 0, 0], 1);
  k.ell(0.17, 0.16, 0.25, [0, 0.47, -0.1], FURC, [0.05, 0, 0], 1);
  k.ell(0.18, 0.18, 0.17, [0, 0.48, -0.3], FURC, null, 1);
  // three big raised hackles along the spine
  for (let i = 0; i < 3; i++) { const z = 0.28 - i * 0.16; k.cone([0, 0.6 - i * 0.02, z], [0, 0.74 - i * 0.03, z - 0.12], 0.085 - i * 0.012, BACK, 4, 0.5); }
  // snow-white chest ruff
  k.ell(0.17, 0.19, 0.15, [0, 0.5, 0.38], byN(0x8a9ccc, SNOW, SNOW, 0.6, -0.2), [0.5, 0, 0]);
  k.both((s) => {
    k.cone([s * 0.09, 0.42, 0.44], [s * 0.21, 0.36, 0.36], 0.08, SNOW, 4, 0.5);
    // chunky legs, big paws (+x = the wolf's left)
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.13, 0.38, 0.27], () => {
      k.chain([[s * 0.13, 0.36, 0.27], [s * 0.14, 0.18, 0.3], [s * 0.135, 0.05, 0.34]], [0.075, 0.055, 0.045], LEG);
      k.ell(0.06, 0.04, 0.08, [s * 0.135, 0.038, 0.38], 0x5a6a96, null, 0);
    });
    k.ell(0.1, 0.16, 0.13, [s * 0.11, 0.42, -0.28], FURC, null, 1);
    k.bone(s > 0 ? B.LEG_BL : B.LEG_BR, [s * 0.125, 0.36, -0.26], () => {
      k.chain([[s * 0.125, 0.33, -0.25], [s * 0.135, 0.22, -0.2], [s * 0.125, 0.12, -0.36], [s * 0.125, 0.04, -0.33]], [0.075, 0.055, 0.045, 0.04], LEG);
      k.ell(0.06, 0.04, 0.08, [s * 0.125, 0.038, -0.3], 0x5a6a96, null, 0);
    });
  });
  // head: big, long snout, open snarling jaw, tall ears
  k.bone(B.HEAD, [0, 0.52, 0.42], () => k.at([0, 0.56, 0.52], [0.2, 0, 0], 1.38, () => {
    k.ell(0.12, 0.105, 0.12, [0, 0.02, 0], FURC, null, 1);
    k.limb([0, 0.0, 0.06], [0, -0.015, 0.28], 0.07, 0.045, byN(0x45588e, 0x8a9cc8, SNOW), 6);
    k.ell(0.04, 0.032, 0.03, [0, -0.005, 0.29], DARK, null, 0);
    // lower jaw, open, red mouth, one big pair of white fangs
    k.limb([0, -0.06, 0.04], [0, -0.115, 0.22], 0.05, 0.032, byN(0x8a9cc8, 0xdce2f0, SNOW), 6);
    k.ell(0.045, 0.024, 0.1, [0, -0.05, 0.15], MOUTH, [0.2, 0, 0], 0);
    k.both((s) => {
      k.cone([s * 0.036, -0.02, 0.23], [s * 0.034, -0.09, 0.235], 0.018, TEETH, 4);
      // tall pricked ears, pink inside
      k.cone([s * 0.065, 0.07, -0.02], [s * 0.115, 0.28, -0.08], 0.065, BACK, 4, 0.45);
      k.cone([s * 0.067, 0.085, 0.0], [s * 0.108, 0.23, -0.055], 0.038, 0xf4a4a4, 4, 0.3);
      k.eye([s * 0.055, 0.045, 0.095], 0.028, 0xffd02a);
    });
    k.box(0.13, 0.025, 0.04, [0, 0.075, 0.095], BACK, [0.35, 0, 0]);
  }));
  // big bushy tail sweeping back and up, white tip
  const tc = (t, d) => (t > 0.78 ? SNOW : d.y > 0.15 ? 0x40548c : 0x7c90c0);
  k.bone(B.TAIL, [0, 0.55, -0.42], () => k.tube([[0, 0.55, -0.42], [0, 0.56, -0.6], [0.05, 0.5, -0.78], [0.1, 0.56, -0.92]], (t) => 0.05 + Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.85) * 0.1, tc, { seg: 6, n: 8 }));
  return finish(k);
}

// ---------------------------------------------------------------- orc
function orc() {
  const k = nkit(31);
  // deep green skin + crimson/red-brown leather; a big bow and a crimson mohawk are the identity
  const SK = byN(0x5cb03c, 0x3e8c30, 0x2c6c28), SKD = byN(0x4c9c34, 0x3a802c, 0x2c6626);
  const PANTS = byN(0x8a4630, 0x6e3424, 0x52281c);
  const ARM = byN(0xd04a2c, 0xa03424, 0x70261c);
  const NECK = [0, 0.84, 0.04];
  k.setBody([0, 0.46, 0]);
  k.both((s) => {
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.1, 0.46, 0], () => {
      k.chain([[s * 0.1, 0.46, 0], [s * 0.14, 0.26, 0.06], [s * 0.14, 0.09, 0.0]], [0.08, 0.065, 0.06], PANTS);
      k.ell(0.075, 0.07, 0.12, [s * 0.14, 0.065, 0.04], LEATHER_D, null, 0);
    });
    k.bone(B.HEAD, NECK, () => {
      // big upturned tusks
      k.cone([s * 0.06, 0.84, 0.19], [s * 0.095, 0.99, 0.22], 0.03, BONE, 4);
      // pointed ears
      k.cone([s * 0.11, 0.93, 0.05], [s * 0.25, 1.0, -0.02], 0.045, SK, 4, 0.4);
      k.eye([s * 0.05, 0.935, 0.19], 0.026, 0xff4a1a);
    });
  });
  // crimson kilt + belt
  k.frus(0.17, 0.22, 0.18, [0, 0.34, 0], ARM, 8);
  k.torus(0.17, 0.034, [0, 0.52, 0], LEATHER_D, undefined, 0.85, 10);
  // V-shaped torso: crimson leather vest under broad green shoulders
  k.ell(0.17, 0.14, 0.13, [0, 0.58, 0.02], ARM, null, 1);
  k.ell(0.26, 0.18, 0.16, [0, 0.74, 0.0], SK, null, 1);
  // quiver on the back: one chunky shape with three big fletchings
  k.at([0.08, 0.76, -0.17], [0.25, 0, -0.45], 1, () => {
    k.frus(0.065, 0.06, 0.32, [0, -0.17, 0], LEATHER, 6);
    for (let i = 0; i < 3; i++) k.cone([(i - 1) * 0.04, 0.12, 0], [(i - 1) * 0.05, 0.25, 0], 0.035, i === 1 ? 0xffe04a : 0xe8342a, 3, 0.35);
  });
  // spiked steel pauldron (-x)
  k.ell(0.14, 0.1, 0.14, [-0.25, 0.86, 0], STEEL, null, 1);
  k.cone([-0.27, 0.9, 0.02], [-0.38, 1.08, 0.03], 0.045, 0xfafcff, 4);
  k.cone([-0.2, 0.92, -0.06], [-0.25, 1.08, -0.1], 0.04, 0xfafcff, 4);
  // head: BIG, thrust forward, heavy jaw, red war-paint band across the eyes
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.15, 0.14, 0.14, [0, 0.93, 0.07], SK, null, 1);
    k.box(0.21, 0.1, 0.13, [0, 0.84, 0.12], SK);
    k.box(0.24, 0.05, 0.07, [0, 0.985, 0.17], SKD, [0.25, 0, 0]);
    k.box(0.21, 0.035, 0.03, [0, 0.93, 0.18], 0xe8342a, [0.1, 0, 0]);
    k.box(0.11, 0.025, 0.03, [0, 0.82, 0.19], MOUTH);
    // tall crimson mohawk
    for (let i = 0; i < 4; i++) k.cone([0, 1.03 - Math.abs(i - 1) * 0.015, 0.12 - i * 0.07], [0, 1.22 - Math.abs(i - 1.2) * 0.03, 0.07 - i * 0.09], 0.05, i % 2 ? 0xd0281e : 0xf04030, 4, 0.5);
  });
  // bow arm (+x = left): a big bow held out front-right
  k.bone(B.ARM_L, [0.27, 0.8, 0], () => {
    k.chain([[0.27, 0.8, 0], [0.34, 0.64, 0.13], [0.3, 0.62, 0.31]], [0.075, 0.062, 0.055], SK);
    k.ell(0.055, 0.06, 0.055, [0.3, 0.62, 0.33], SKD, null, 0);
    const BOW = (t) => (t > 0.43 && t < 0.57 ? 0xffc83a : 0x9a5a2e);
    k.tube([[0.28, 0.12, 0.24], [0.29, 0.3, 0.36], [0.3, 0.62, 0.4], [0.29, 0.94, 0.36], [0.28, 1.12, 0.24]], (t) => 0.036 - Math.abs(t - 0.5) * 0.03, BOW, { seg: 5, n: 10 });
    k.limb([0.28, 0.13, 0.24], [0.28, 1.11, 0.24], 0.007, 0.007, 0xf8f0d8, 3);
  });
  // draw arm (-x = right): hand at the string with a nocked arrow
  k.bone(B.ARM_R, [-0.28, 0.8, 0], () => {
    k.chain([[-0.28, 0.8, 0], [-0.25, 0.64, 0.14], [-0.02, 0.64, 0.24]], [0.075, 0.062, 0.055], SK);
    k.ell(0.055, 0.055, 0.055, [0.0, 0.64, 0.25], SKD, null, 0);
    k.limb([-0.02, 0.64, 0.25], [0.44, 0.64, 0.42], 0.012, 0.012, WOOD, 4);
    k.cone([0.42, 0.64, 0.415], [0.52, 0.64, 0.45], 0.03, STEEL, 4, 0.4);
    k.cone([0.06, 0.64, 0.28], [-0.06, 0.64, 0.235], 0.035, 0xe8342a, 3, 0.3);
  });
  return finish(k);
}

// ---------------------------------------------------------------- ogre
function ogre() {
  const k = nkit(41);
  // ruddy tan skin + royal-blue cloth with red trim; a HUGE dark club studded with white spikes
  const SK = byN(0xf4b698, 0xdc8e72, 0xaa6650), SKD = byN(0xe6a084, 0xc87c62, 0x9c5c48);
  const BELLY = byN(0xf6c0a0, 0xe8a284, 0xb27660);
  const HIDE = byN(0x4a86e8, 0x2e5cc8, 0x22428e);
  const CLUB = byN(0x8a5630, 0x6e4224, 0x52321c);
  const NECK = [0, 1.0, 0.06];
  k.setBody([0, 0.38, 0]);
  k.both((s) => {
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.14, 0.38, 0], () => {
      k.chain([[s * 0.14, 0.38, 0], [s * 0.17, 0.2, 0.05], [s * 0.16, 0.08, 0.01]], [0.11, 0.09, 0.08], SK);
      k.ell(0.1, 0.07, 0.14, [s * 0.165, 0.06, 0.05], SKD, null, 0);
    });
    k.ell(0.15, 0.13, 0.14, [s * 0.31, 0.98, -0.04], SK, null, 1);
    k.bone(B.HEAD, NECK, () => {
      // little mean glowing eyes under a heavy brow, big underbite tusks
      k.eye([s * 0.07, 1.18, 0.28], 0.03, 0xffb020);
      k.cone([s * 0.08, 1.05, 0.3], [s * 0.09, 1.17, 0.32], 0.034, TEETH, 4);
      // cauliflower ears
      k.ell(0.06, 0.08, 0.04, [s * 0.2, 1.17, 0.1], SKD, [0, s * 0.5, 0], 0);
    });
  });
  // blue loincloth with a front flap and a red hem
  k.frus(0.28, 0.31, 0.18, [0, 0.32, 0], HIDE, 9);
  k.box(0.22, 0.24, 0.04, [0, 0.27, 0.28], HIDE, [0.15, 0, 0]);
  k.torus(0.285, 0.035, [0, 0.33, 0], 0xe03a2a, [Math.PI / 2, 0, 0], 1, 12);
  // huge belly + chest
  k.ell(0.32, 0.3, 0.3, [0, 0.62, 0.06], BELLY, null, 1);
  k.torus(0.28, 0.034, [0, 0.42, 0.04], 0xd8342a, [Math.PI / 2 - 0.1, 0, 0], 1.05, 12);
  k.ell(0.34, 0.2, 0.22, [0, 0.9, -0.04], SK, null, 1);
  // blue cloth mantle over one shoulder with a gold clasp + red sash
  k.ell(0.22, 0.11, 0.21, [0.22, 1.0, -0.04], HIDE, [0, 0, -0.35], 1);
  k.ell(0.05, 0.05, 0.03, [0.12, 0.98, 0.17], GOLD, null, 0);
  k.box(0.1, 0.5, 0.04, [0.05, 0.82, 0.18], 0xd8342a, [0.2, 0, -0.75]);
  // head: bigger than before, low and forward
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.2, 0.19, 0.18, [0, 1.17, 0.12], SK, null, 1);
    k.box(0.3, 0.12, 0.18, [0, 1.06, 0.18], SK);
    k.box(0.2, 0.035, 0.03, [0, 1.07, 0.275], MOUTH);
    k.ell(0.07, 0.065, 0.07, [0, 1.14, 0.31], 0xf0a07a, null, 0);
    k.box(0.3, 0.05, 0.07, [0, 1.22, 0.26], SKD, [0.3, 0, 0]);
    // dark top-knot with a gold band
    k.cone([0, 1.32, 0.08], [0, 1.52, 0.0], 0.075, 0x6a3420, 5);
    k.torus(0.056, 0.018, [0, 1.36, 0.06], GOLD, [Math.PI / 2, 0, 0], 1, 8);
  });
  // left arm (+x) hangs, huge fist
  k.bone(B.ARM_L, [0.34, 0.95, -0.02], () => {
    k.chain([[0.34, 0.95, -0.02], [0.45, 0.68, 0.04], [0.43, 0.44, 0.12]], [0.1, 0.085, 0.075], SK);
    k.ell(0.11, 0.1, 0.11, [0.43, 0.39, 0.14], SKD, null, 1);
  });
  // right arm (-x): the HUGE spiked club over the shoulder
  k.bone(B.ARM_R, [-0.34, 0.95, -0.02], () => {
    k.chain([[-0.34, 0.95, -0.02], [-0.46, 0.72, 0.1], [-0.34, 0.82, 0.27]], [0.1, 0.085, 0.075], SK);
    k.ell(0.1, 0.1, 0.1, [-0.33, 0.83, 0.29], SKD, null, 0);
    const a = V(-0.33, 0.74, 0.4), b = V(-0.55, 1.36, -0.36), d = b.clone().sub(a).normalize();
    k.limb(a.toArray(), b.toArray(), 0.05, 0.16, CLUB, 7);
    k.ell(0.165, 0.165, 0.165, b.toArray(), CLUB, null, 1);
    for (let i = 0; i < 6; i++) {
      const t = 0.62 + (i % 2) * 0.24, ang = i * 2.1;
      const c = a.clone().lerp(b, t); const rr = 0.05 + 0.11 * t;
      const side = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d));
      const base = c.clone().addScaledVector(side, rr * 0.8);
      k.cone(base.toArray(), base.clone().addScaledVector(side, 0.12).toArray(), 0.035, 0xf8f0e0, 4);
    }
  });
  return finish(k);
}

// ---------------------------------------------------------------- troll
function troll() {
  const k = nkit(51);
  // lilac cave-stone hide (no longer blue like the wolf) + a big chartreuse-moss hump; long dragging arms
  const SK = byN(0xc4b0d8, 0x9c86b8, 0x6e5c8a, 0.45, -0.3);
  const SKL = byN(0xb4a0cc, 0x8e78ac, 0x6e5c8a);
  const MOSS = byN(0xb8f04a, 0x8ac436, 0x5e8a2c, 0.3, -0.3);
  const ROCK = byN(0xb0e84a, 0x9a90a4, 0x766c80, 0.4, -0.2);
  const CLAW = 0xf8f0d8;
  const NECK = [0, 0.86, 0.18];
  k.setBody([0, 0.5, -0.04]);
  k.both((s) => {
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.11, 0.5, -0.06], () => {
      k.chain([[s * 0.11, 0.5, -0.06], [s * 0.16, 0.3, 0.08], [s * 0.14, 0.08, -0.03]], [0.075, 0.06, 0.055], SKL);
      k.ell(0.09, 0.05, 0.13, [s * 0.15, 0.045, 0.03], SKL, null, 0);
    });
    // very long thick arms dragging near the ground, huge hands with two big claws
    // (part order kept as before so the merged geometry is byte-identical)
    const ARM = [s > 0 ? B.ARM_L : B.ARM_R, [s * 0.24, 0.88, 0.06]];
    k.bone(...ARM, () => k.chain([[s * 0.24, 0.88, 0.06], [s * 0.4, 0.6, 0.0], [s * 0.36, 0.26, 0.2]], [0.095, 0.085, 0.075], SKL));
    k.rock(0.085, [s * 0.27, 0.97, 0.02], ROCK, [1.2, 0.9, 1]);
    k.bone(...ARM, () => {
      k.ell(0.115, 0.12, 0.11, [s * 0.36, 0.18, 0.24], SK, null, 1);
      for (let i = 0; i < 2; i++) k.cone([s * (0.33 + i * 0.07), 0.12, 0.3], [s * (0.33 + i * 0.08), 0.02, 0.38], 0.03, CLAW, 4);
    });
    // droopy long ears, glowing eyes, one big lower tusk
    k.bone(B.HEAD, NECK, () => {
      k.cone([s * 0.1, 0.9, 0.22], [s * 0.3, 0.85, 0.13], 0.05, SKL, 4, 0.4);
      k.eye([s * 0.055, 0.925, 0.355], 0.026, 0xeaff40);
      k.cone([s * 0.05, 0.8, 0.37], [s * 0.065, 0.89, 0.41], 0.022, BONE, 4);
    });
  });
  // brown loin wrap
  k.frus(0.15, 0.19, 0.14, [0, 0.4, -0.02], byN(0x9a6a3c, 0x7a5030, 0x5a3a22), 7);
  // hunched torso
  k.ell(0.16, 0.15, 0.14, [0, 0.58, -0.02], SK, null, 1);
  k.ell(0.24, 0.2, 0.2, [0, 0.79, 0.06], SK, [0.5, 0, 0], 1);
  // the mossy hump: one big bright cap over the back, plus a few stones poking out
  k.ell(0.17, 0.1, 0.16, [0, 0.95, -0.07], MOSS, [0.4, 0, 0], 1);
  k.rock(0.09, [0.06, 1.0, -0.04], ROCK, [1, 0.9, 1]);
  k.rock(0.08, [-0.08, 0.92, -0.16], ROCK, [1, 0.9, 1]);
  k.rock(0.07, [0.02, 0.8, -0.22], ROCK);
  // head: big, low, forward, huge drooping nose
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.14, 0.12, 0.14, [0, 0.92, 0.27], SK, null, 1);
    k.box(0.16, 0.07, 0.11, [0, 0.82, 0.33], SKL);
    k.box(0.12, 0.022, 0.03, [0, 0.815, 0.385], MOUTH);
    k.cone([0, 0.93, 0.37], [0, 0.78, 0.53], 0.07, 0xd4c4e4, 5);
    k.box(0.2, 0.04, 0.06, [0, 0.96, 0.36], 0x6e5c8a, [0.3, 0, 0]);
    // mossy hair
    for (let i = 0; i < 4; i++) { const a = -1.0 + i * 0.66; k.cone([Math.sin(a) * 0.06, 1.0, 0.24 - Math.cos(a) * 0.04], [Math.sin(a) * 0.13, 0.98, 0.08 - Math.cos(a) * 0.06], 0.055, i % 2 ? 0x9ad840 : 0x7ab830, 3, 0.5); }
  });
  return finish(k);
}

// ---------------------------------------------------------------- cyclops
function cyclops() {
  const k = nkit(61);
  // rosy skin + deep teal hide; ONE HUGE EYE and a mossy boulder held overhead
  const SK = byN(0xfaae96, 0xe28672, 0xb25e50), SKD = byN(0xec9a84, 0xcc7262, 0xa45648);
  const HIDE = byN(0x2ea8a8, 0x1e8288, 0x166068);
  const ROCK = byN(0x9ad85a, 0xc4beb4, 0x948e86, 0.45, -0.3);
  const NECK = [0, 1.16, 0.02];
  k.setBody([0, 0.62, 0]);
  k.both((s) => {
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.14, 0.62, 0], () => {
      k.chain([[s * 0.14, 0.62, 0], [s * 0.17, 0.35, 0.07], [s * 0.15, 0.09, 0.0]], [0.11, 0.085, 0.07], SK);
      k.ell(0.085, 0.06, 0.14, [s * 0.155, 0.06, 0.05], SKD, null, 0);
      k.frus(0.08, 0.085, 0.06, [s * 0.15, 0.1, 0.0], LEATHER_D, 7);
    });
    k.ell(0.14, 0.12, 0.13, [s * 0.31, 1.13, -0.02], SK, null, 1);
    k.bone(B.HEAD, NECK, () => {
      k.ell(0.035, 0.06, 0.025, [s * 0.18, 1.34, 0.03], SK, [0, s * 0.4, 0], 0);
      k.cone([s * 0.06, 1.18, 0.19], [s * 0.075, 1.26, 0.21], 0.024, TEETH, 4);
    });
  });
  // teal loincloth with front/back flaps (CLOTH, hanging from the belt), belt with a big gold buckle
  k.frus(0.21, 0.24, 0.2, [0, 0.53, 0], HIDE, 8);
  k.bone(B.CLOTH, [0, 0.58, 0.22], () => k.box(0.22, 0.3, 0.04, [0, 0.42, 0.22], HIDE, [0.1, 0, 0]));
  k.bone(B.CLOTH, [0, 0.58, -0.21], () => k.box(0.2, 0.26, 0.04, [0, 0.45, -0.21], HIDE, [-0.1, 0, 0]));
  k.torus(0.21, 0.04, [0, 0.72, 0], LEATHER_D, undefined, 0.85, 10);
  k.box(0.11, 0.1, 0.04, [0, 0.72, 0.19], GOLD);
  // torso + one bold teal strap
  k.ell(0.21, 0.17, 0.16, [0, 0.82, 0.02], SK, null, 1);
  k.ell(0.31, 0.21, 0.2, [0, 1.04, 0.0], SK, null, 1);
  k.box(0.11, 0.66, 0.04, [0, 0.98, 0.17], HIDE, [0.05, 0, -0.65]);
  // head: big, with THE EYE filling the face
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.2, 0.19, 0.18, [0, 1.32, 0.05], SK, null, 1);
    k.box(0.26, 0.09, 0.15, [0, 1.19, 0.11], SK);
    k.box(0.18, 0.028, 0.03, [0, 1.18, 0.19], MOUTH);
    k.ell(0.165, 0.145, 0.09, [0, 1.35, 0.22], 0xfffcf4, null, 1);
    k.eye([0, 1.35, 0.28], 0.09, 0xffa21a);
    k.ell(0.04, 0.058, 0.014, [0, 1.35, 0.345], DARK, null, 0);
    k.box(0.38, 0.06, 0.09, [0, 1.5, 0.24], SKD, [0.35, 0, 0]);
    // horn
    k.tube([[0, 1.49, 0.06], [0, 1.61, 0.03], [0, 1.68, -0.07]], (t) => 0.06 * (1 - t) + 0.006, (t) => (t > 0.55 ? 0xfff4dc : 0xd8c49c), { seg: 5, n: 4 });
  });
  // left arm (+x): forward, big open hand
  k.bone(B.ARM_L, [0.33, 1.12, -0.02], () => {
    k.chain([[0.33, 1.12, -0.02], [0.43, 0.88, 0.08], [0.38, 0.72, 0.28]], [0.1, 0.085, 0.07], SK);
    k.ell(0.09, 0.09, 0.1, [0.37, 0.7, 0.31], SKD, null, 0);
  });
  // right arm (-x): raises a BIG mossy boulder overhead (boulder rides on ARM_R)
  k.bone(B.ARM_R, [-0.33, 1.12, -0.02], () => {
    k.chain([[-0.33, 1.12, -0.02], [-0.46, 1.26, 0.06], [-0.4, 1.48, 0.0]], [0.1, 0.085, 0.075], SK);
    k.ell(0.09, 0.09, 0.09, [-0.38, 1.52, 0.0], SKD, null, 0);
    k.rock(0.24, [-0.3, 1.68, -0.08], ROCK, [1, 0.88, 1], 1);
  });
  return finish(k, { scale: 0.92 });
}

// ---------------------------------------------------------------- hydra
function hydra() {
  const k = nkit(71);
  // emerald scales, cream belly, flame-orange spines + frills; five BIG necks fanned wide
  const SC = byN(0x34c890, 0x1ea078, 0xf4e098, 0.25, -0.35);
  const BEL = 0xf4e098;
  const SPIKE = (y0) => (p) => (p.y > y0 ? 0xffb436 : 0xf0602e);
  k.setBody([0, 0.36, -0.1]);
  k.ell(0.36, 0.27, 0.5, [0, 0.4, -0.14], SC, null, 1);
  k.ell(0.29, 0.24, 0.21, [0, 0.47, 0.2], SC, [-0.3, 0, 0], 1);
  for (let i = 0; i < 4; i++) { const z = 0.12 - i * 0.2, y = 0.62 - Math.pow(Math.abs(z + 0.1) / 0.5, 2) * 0.12; k.cone([0, y - 0.04, z], [0, y + 0.16 - Math.abs(i - 1.5) * 0.02, z - 0.12], 0.085, SPIKE(y + 0.05), 4, 0.4); }
  const LEGC = byN(0x30b88a, 0x1e966e, 0x16785a);
  k.both((s) => {
    for (const [z, fz] of [[0.18, 0.3], [-0.42, -0.36]]) {
      const bone = z > 0 ? (s > 0 ? B.LEG_FL : B.LEG_FR) : (s > 0 ? B.LEG_BL : B.LEG_BR);
      k.bone(bone, [s * 0.28, 0.34, z], () => {
        k.limb([s * 0.28, 0.34, z], [s * 0.37, 0.2, z + 0.06], 0.11, 0.085, LEGC, 6, false);
        k.ell(0.085, 0.085, 0.085, [s * 0.37, 0.2, z + 0.06], LEGC, null, 0);
        k.limb([s * 0.37, 0.2, z + 0.06], [s * 0.35, 0.05, fz], 0.085, 0.075, LEGC, 6, false);
        k.ell(0.1, 0.055, 0.12, [s * 0.35, 0.045, fz + 0.05], 0x2a9a64, null, 0);
      });
    }
  });
  // thick tail curling to the side
  const tailc = (t, d) => (d.y < -0.4 ? BEL : d.y > 0.3 ? 0x34c890 : 0x1ea078);
  k.bone(B.TAIL, [0, 0.36, -0.55], () => k.tube([[0, 0.36, -0.55], [0, 0.2, -0.78], [0.12, 0.08, -0.94], [0.3, 0.05, -0.98], [0.42, 0.04, -0.88]], (t) => 0.17 * (1 - t) + 0.02, tailc, { seg: 6, n: 9 }));
  // five thick necks, big heads
  const neckc = (t, d) => (d.y < -0.45 ? BEL : d.y > 0.2 ? 0x34c890 : 0x1ea078);
  const heads = [
    { b: [-0.24, 0.48, 0.22], m: [-0.56, 0.8, 0.22], t: [-0.66, 1.02, 0.42] },
    { b: [-0.12, 0.55, 0.25], m: [-0.3, 1.04, 0.18], t: [-0.36, 1.3, 0.4] },
    { b: [0, 0.58, 0.27], m: [0, 1.18, 0.2], t: [0, 1.5, 0.36] },
    { b: [0.12, 0.55, 0.25], m: [0.3, 1.04, 0.18], t: [0.36, 1.3, 0.4] },
    { b: [0.24, 0.48, 0.22], m: [0.56, 0.8, 0.22], t: [0.66, 1.02, 0.42] },
  ];
  const HC = byN(0x3ed09a, 0x1ea078, 0xf4e098, 0.3, -0.4);
  const JAW = byN(0x1ea078, 0xecd282, 0xf4e098);
  // each neck + its head is one HEAD bone pivoting at that neck's base
  heads.forEach((h, i) => k.bone(B.HEAD, h.b, () => {
    const mid2 = [(h.m[0] + h.t[0]) / 2, h.t[1] - 0.04, (h.m[2] + h.t[2]) / 2 - 0.08];
    k.tube([h.b, h.m, mid2, h.t], (t) => 0.12 - t * 0.045, neckc, { seg: 6, n: 6, capEnd: false });
    const dir = [h.t[0] * 0.6, -0.2, 1];
    k.aim(h.t, dir, () => k.at([0, 0, 0], null, 1.95, () => {
      k.ell(0.075, 0.065, 0.09, [0, 0.01, 0.0], HC, null, 1);
      k.limb([0, 0.02, 0.05], [0, 0.0, 0.18], 0.055, 0.032, HC, 6);
      // lower jaw, open red mouth
      k.limb([0, -0.04, 0.03], [0, -0.09, 0.15], 0.04, 0.022, JAW, 5, false);
      k.ell(0.036, 0.016, 0.06, [0, -0.04, 0.1], MOUTH, [0.35, 0, 0], 0);
      k.both((s) => {
        k.gem([s * 0.048, 0.042, 0.062], 0.024, i === 2 ? 0xff5a2a : 0xffd82a);
        // big orange cheek frill + backswept golden horn
        k.cone([s * 0.05, 0.05, -0.02], [s * 0.09, 0.11, -0.14], 0.026, 0xffc04a, 4);
        k.cone([s * 0.06, -0.01, -0.03], [s * 0.17, -0.0, -0.12], 0.045, 0xff7a30, 3, 0.4);
      });
    }));
  }));
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
