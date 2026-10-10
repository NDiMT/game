import * as THREE from 'three';
import { BONE as B, tagRange } from './rig.js?v=1.9';

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
// R7 colour helpers: banded / spotted variants of a colour (or colour fn), for fur, scales, wood grain
const banded = (base, mul, test) => {
  const t = new THREE.Color(), bf = typeof base === 'function' ? base : () => base;
  return (p, n, f) => { t.copy(toCol(bf(p, n, f))); if (test(p, n, f)) t.multiplyScalar(mul); return t; };
};
const tint = (base, col, test) => {
  const t = new THREE.Color(), c = new THREE.Color(col), bf = typeof base === 'function' ? base : () => base;
  return (p, n, f) => (test(p, n, f) ? c : t.copy(toCol(bf(p, n, f))));
};
const hash3 = (p, s = 1) => { const h = Math.sin(p.x * 127.1 * s + p.y * 311.7 * s + p.z * 74.7 * s) * 43758.5453; return h - Math.floor(h); };
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
      // R7: big bodies / heads get a finer sphere so they look sculpted, not faceted
      if (det === 1 && Math.max(rx, ry, rz) >= 0.17) det = 2;
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
    limb(a, b, r1, r2, col, seg = 8, caps = true) {
      const va = V(...a), vb = V(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, !caps);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, vb.clone().sub(va).normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      return k.add(g, col);
    },
    // joint ball + limb chain: pts [[x,y,z],...], radii [..]
    chain(pts, rads, col, seg = 8) {
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
    tube(pts, rad, col, { seg = 8, n = 10, sx = 1, capEnd = true } = {}) {
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
    // R7 face kit: a white eyeball, a glowing iris and a dark pupil (round or slit), facing local +Z
    eyeW(p, rad, iris, { white = 0xfffbea, pupil = DARK, slit = false, sz = 0.55 } = {}) {
      k.ell(rad, rad * 0.86, rad * sz, p, white, null, 1);
      k.ell(rad * 0.62, rad * 0.62, rad * 0.3, [p[0], p[1], p[2] + rad * sz * 0.72], iris, null, 0, true);
      k.ell(rad * (slit ? 0.14 : 0.27), rad * (slit ? 0.5 : 0.27), rad * 0.1, [p[0], p[1], p[2] + rad * sz * 0.97], pupil, null, 0);
    },
    // a row of n teeth / claws / spines from a to b, each pointing along dir
    row(a, b, n, dir, len, rad, col, seg = 3, alt = 0.7) {
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        const l = len * (i % 2 ? alt : 1);
        k.cone(p, [p[0] + dir[0] * l, p[1] + dir[1] * l, p[2] + dir[2] * l], rad, col, seg);
      }
    },
    // a strap / rope along pts
    strap(pts, rad, col, seg = 4) { return k.tube(pts, rad, col, { seg, n: Math.max(3, (pts.length - 1) * 3), capEnd: false }); },
  };
  k.parts = parts;
  return k;
}

// merge parts -> { body, glow }, with per-face colour, a light fake AO (the shared
// material adds its own), top light, saturation lift, painterly jitter and uv
function finish(k, { ao = 0.3, jitter = 0.03, scale = 1, sat = 1.2 } = {}) {
  if (scale !== 1) for (const part of k.parts) part.g.scale(scale, scale, scale);
  const out = (glow) => {
    // typed output sized for the worst case (no degenerate triangles), trimmed at the end
    let cap = 0; for (const part of k.parts) if (!!part.glow === glow) cap += part.g.attributes.position.array.length;
    const pos = new Float32Array(cap), nor = new Float32Array(cap), col = new Float32Array(cap), uv = new Float32Array(glow ? 0 : (cap / 3) * 2);
    let nv = 0;
    const rnd = mulberry32(97);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const cc = new THREE.Color();
    const ranges = [];
    let any = false;
    for (const part of k.parts) {
      if (!!part.glow !== glow) continue;
      any = true;
      ranges.push({ start: nv, part });
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
          const o3 = nv * 3, o2 = nv * 2; nv++;
          pos[o3] = v.x; pos[o3 + 1] = v.y; pos[o3 + 2] = v.z; nor[o3] = n.x; nor[o3 + 1] = n.y; nor[o3 + 2] = n.z; col[o3] = cc.r; col[o3 + 1] = cc.g; col[o3 + 2] = cc.b;
          if (glow) continue;
          if (ax >= ay && ax >= az) { uv[o2] = v.z; uv[o2 + 1] = v.y; } else if (ay >= az) { uv[o2] = v.x; uv[o2 + 1] = v.z; } else { uv[o2] = v.x; uv[o2 + 1] = v.y; }
        }
      }
      ranges[ranges.length - 1].count = nv - ranges[ranges.length - 1].start;
    }
    if (!any) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, nv * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor.slice(0, nv * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(col.slice(0, nv * 3), 3));
    if (!glow) g.setAttribute('uv', new THREE.BufferAttribute(uv.slice(0, nv * 2), 2));
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
  // R7: warty mottled skin, white-and-gold eyes, mean brows, snaggle teeth, ear ring, patched tunic,
  // rope belt with pouch + dagger, wrapped spear, studded sun shield, toe claws
  const SK = banded(byN(0xe0fa64, 0xb8e63e, 0x84b42c), 0.9, (p) => hash3(p, 3) > 0.8), SKD = byN(0xc4ec4a, 0xa0d034, 0x7aa82a);
  const RAG = banded(byN(0x9a78f4, 0x6c4cd0, 0x45329a), 0.86, (p) => Math.sin(p.y * 70) > 0.55);
  const NAIL = 0xf4f0c8, ROPE = 0xc89a5a;
  const NECK = [0, 0.62, 0.03];
  k.setBody([0, 0.32, 0]);
  k.both((s) => {
    // short bowed legs + big bare feet with three claws
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.08, 0.32, -0.01], () => {
      k.chain([[s * 0.08, 0.32, -0.01], [s * 0.12, 0.17, 0.05], [s * 0.1, 0.05, 0.0]], [0.055, 0.045, 0.04], SKD);
      k.ell(0.07, 0.045, 0.11, [s * 0.105, 0.04, 0.05], SK, [0, s * -0.2, 0], 0);
      k.row([s * 0.075, 0.03, 0.15], [s * 0.135, 0.03, 0.14], 3, [0, -0.15, 1], 0.045, 0.014, NAIL);
      k.frus(0.05, 0.055, 0.035, [s * 0.11, 0.16, 0.04], LEATHER_D, 7); // knee wrap
    });
    k.bone(B.HEAD, NECK, () => {
      // HUGE flat ears swept out and up: the goblin silhouette, pink inside, a gold ring in one
      k.at([s * 0.13, 0.76, 0.03], [0, s * 0.25, s * 0.38], 1, () => {
        k.cone([0, 0, 0], [s * 0.42, 0.09, -0.03], 0.11, SK, 5, 0.3);
        k.cone([s * 0.04, 0.0, 0.02], [s * 0.32, 0.075, 0.0], 0.065, 0xff9a9a, 4, 0.2);
        k.cone([s * 0.2, 0.06, 0.0], [s * 0.26, 0.11, -0.02], 0.03, SK, 3, 0.4); // notch
        if (s > 0) k.torus(0.03, 0.009, [s * 0.3, 0.035, 0.0], GOLD, [0, 0, 0], 1, 8);
      });
      // big yellow eyes with white rims and slit pupils, mean slanted brows
      k.eyeW([s * 0.068, 0.772, 0.2], 0.05, 0xfff04a, { slit: true });
      k.box(0.1, 0.028, 0.045, [s * 0.072, 0.83, 0.21], 0x7aac28, [0.35, 0, s * 0.38]);
      k.ell(0.012, 0.012, 0.01, [s * 0.016, 0.682, 0.36], 0x6a9a24, null, 0); // nostril
      // snaggle teeth over the lower lip, warts
      k.cone([s * 0.045, 0.652, 0.232], [s * 0.05, 0.7, 0.245], 0.016, TEETH, 4);
      k.ell(0.018, 0.018, 0.014, [s * 0.13, 0.8 - s * 0.03, 0.17], 0xa8d83a, null, 0);
    });
  });
  // violet tunic with a jagged hem and a stitched patch
  k.frus(0.13, 0.2, 0.22, [0, 0.2, 0], RAG, 9);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.25; k.cone([Math.sin(a) * 0.16, 0.24, Math.cos(a) * 0.16], [Math.sin(a) * 0.21, 0.12 - (i % 2) * 0.03, Math.cos(a) * 0.21], 0.06, i % 2 ? 0x5a3cb4 : 0x4a30a0, 3, 0.45); }
  k.box(0.08, 0.07, 0.02, [0.06, 0.3, 0.16], 0xc8a8ff, [0.15, 0, 0.2]);
  for (let i = 0; i < 3; i++) k.box(0.008, 0.03, 0.01, [0.03 + i * 0.03, 0.335 + i * 0.006, 0.172], 0x4a30a0, [0.15, 0, 0.2]);
  // rope belt, gold buckle, pouch and a crude dagger
  k.torus(0.135, 0.03, [0, 0.43, 0], ROPE, undefined, 1, 10);
  k.box(0.07, 0.06, 0.03, [0, 0.43, 0.145], GOLD);
  k.box(0.03, 0.025, 0.035, [0, 0.43, 0.15], 0xb88a20);
  k.ell(0.05, 0.055, 0.035, [0.13, 0.37, 0.06], LEATHER, null, 1);
  k.box(0.06, 0.02, 0.04, [0.13, 0.415, 0.065], LEATHER_D);
  k.limb([-0.12, 0.45, 0.1], [-0.12, 0.4, 0.11], 0.012, 0.012, LEATHER_D, 5);
  k.box(0.05, 0.012, 0.02, [-0.12, 0.395, 0.11], 0x8a8a9a);
  k.cone([-0.12, 0.39, 0.11], [-0.13, 0.26, 0.12], 0.02, STEEL, 4, 0.35);
  // stubby hunched torso + a leather strap across the chest
  k.ell(0.15, 0.15, 0.13, [0, 0.52, 0.0], RAG, [0.3, 0, 0]);
  k.strap([[0.12, 0.64, 0.02], [0.05, 0.56, 0.135], [-0.06, 0.48, 0.13], [-0.13, 0.44, 0.05]], 0.016, LEATHER_D);
  // tooth necklace
  k.torus(0.09, 0.012, [0, 0.62, 0.05], ROPE, [Math.PI / 2 + 0.5, 0, 0], 1, 10);
  k.row([-0.05, 0.585, 0.115], [0.05, 0.585, 0.115], 3, [0, -1, 0.15], 0.04, 0.013, BONE);
  // head: BIG, long hooked nose, wide white grin
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.19, 0.165, 0.17, [0, 0.76, 0.07], SK, null, 1);
    k.ell(0.14, 0.07, 0.11, [0, 0.67, 0.12], SK, [0.2, 0, 0], 1);
    k.tube([[0, 0.76, 0.22], [0, 0.73, 0.32], [0, 0.67, 0.37]], (t) => 0.045 * (1 - t) + 0.01, 0xc8f050, { seg: 6, n: 5 });
    k.box(0.17, 0.045, 0.04, [0, 0.665, 0.215], MOUTH, [0.15, 0, 0]);
    k.box(0.15, 0.022, 0.03, [0, 0.675, 0.228], TEETH, [0.15, 0, 0]);
    for (let i = 0; i < 4; i++) k.box(0.004, 0.022, 0.032, [-0.045 + i * 0.03, 0.675, 0.229], 0xd8cfb0, [0.15, 0, 0]);
    k.box(0.16, 0.018, 0.04, [0, 0.645, 0.225], 0x9cc83a, [0.15, 0, 0]); // lower lip
    // flame-red hair: five spiky locks in two reds
    for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.04; k.cone([x, 0.87 - Math.abs(i - 2) * 0.012, 0.02 - Math.abs(i - 2) * 0.02], [x * 2.1, 1.02 - Math.abs(i - 2) * 0.035, -0.09 - Math.abs(i - 2) * 0.02], 0.05, i % 2 ? 0xd8401e : 0xf05a2a, 4); }
    k.cone([0, 0.85, -0.04], [0, 0.9, -0.2], 0.05, 0xc8381a, 4);
  });
  // spear arm (-x = right): wrapped shaft, broad leaf blade with a fuller, binding, red tassel + feathers
  k.bone(B.ARM_R, [-0.13, 0.57, 0.0], () => {
    k.chain([[-0.13, 0.57, 0.0], [-0.2, 0.47, 0.07], [-0.21, 0.48, 0.19]], [0.045, 0.04, 0.04], SKD);
    k.limb([-0.203, 0.474, 0.1], [-0.207, 0.478, 0.165], 0.05, 0.047, LEATHER_D, 8); // bracer
    k.ell(0.05, 0.05, 0.05, [-0.21, 0.48, 0.2], SK, null, 1);
    k.limb([-0.215, 0.0, 0.15], [-0.21, 1.02, 0.25], 0.024, 0.024, banded(WOOD, 0.85, (p) => Math.sin(p.y * 60) > 0.6), 6);
    for (const y of [0.42, 0.54]) k.limb([-0.214, y, 0.2], [-0.214, y + 0.03, 0.2], 0.03, 0.03, 0xe8443a, 6);
    k.limb([-0.211, 0.96, 0.244], [-0.21, 1.0, 0.248], 0.032, 0.028, ROPE, 6);
    k.cone([-0.21, 1.0, 0.25], [-0.208, 1.26, 0.27], 0.085, STEEL, 4, 0.35);
    k.cone([-0.21, 1.03, 0.25], [-0.208, 1.22, 0.268], 0.03, 0x9aa4b8, 4, 0.5); // fuller
    k.cone([-0.21, 0.99, 0.25], [-0.17, 0.85, 0.28], 0.04, 0xf04a30, 3, 0.5);
    k.cone([-0.21, 0.99, 0.25], [-0.24, 0.84, 0.27], 0.03, 0xffd040, 3, 0.4);
  });
  // shield arm (+x = left): big round shield, red face with a yellow sun, leather rim + iron studs
  k.bone(B.ARM_L, [0.13, 0.57, 0.0], () => {
    k.chain([[0.13, 0.57, 0.0], [0.2, 0.46, 0.06], [0.18, 0.43, 0.15]], [0.045, 0.04, 0.04], SKD);
    k.at([0.19, 0.42, 0.2], [0.15, 0.5, 0], 1, () => {
      k.add(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 14).rotateX(Math.PI / 2), (p, n) => (n.z > 0.5 ? 0xe8443a : n.z < -0.5 ? (Math.sin(p.x * 60) > 0 ? 0xa87438 : 0x8a5a2c) : 0xd8a050));
      k.torus(0.19, 0.016, [0, 0, 0.01], LEATHER, [0, 0, 0], 1, 14);
      k.add(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 10).rotateX(Math.PI / 2).translate(0, 0, 0.022), 0xffd040);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cone([Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.024], [Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.024], 0.026, 0xffd040, 3, 0.25); }
      k.ell(0.035, 0.035, 0.025, [0, 0, 0.032], 0xffb020, null, 1);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.4; k.ell(0.013, 0.013, 0.01, [Math.cos(a) * 0.172, Math.sin(a) * 0.172, 0.026], 0xd8dce8, null, 0); }
    });
  });
  return finish(k);
}

// ---------------------------------------------------------------- wolf
function wolf() {
  const k = nkit(21);
  // saturated slate-blue back, cool blue flanks, snow-white belly + chest ruff: a strong value split
  // R7: brindled fur bands on the back, layered neck ruff + cheek tufts, amber eyes with dark rims and
  // pupils, brow ridges, rows of teeth + tongue, toe claws, elbow tufts and a tufted tail
  const furTest = (p, n) => n.y > 0.15 && Math.sin(p.z * 46 + Math.sin(p.x * 30) * 1.5) > 0.45;
  const FURC = banded(byN(0x40548c, 0x7c90c0, 0xf0f2f8, 0.3, -0.2), 0.84, furTest);
  const LEG = byN(0x6a80b0, 0x7a8cba, 0xe4e8f0);
  const BACK = 0x34447a, SNOW = 0xf4f6fa, CLAW = 0xf2eee0, PAW = 0x5a6a96;
  k.setBody([0, 0.45, 0.0]);
  k.ell(0.21, 0.22, 0.26, [0, 0.47, 0.18], FURC, [-0.15, 0, 0], 1);
  k.ell(0.17, 0.16, 0.25, [0, 0.47, -0.1], FURC, [0.05, 0, 0], 1);
  k.ell(0.18, 0.18, 0.17, [0, 0.48, -0.3], FURC, null, 1);
  // five raised hackles along the spine, big to small
  for (let i = 0; i < 5; i++) { const z = 0.3 - i * 0.12; k.cone([0, 0.62 - i * 0.015, z], [0, 0.75 - i * 0.03, z - 0.12], 0.085 - i * 0.01, i % 2 ? 0x2c3a6c : BACK, 4, 0.5); }
  // snow-white chest ruff, layered tufts around the neck
  k.ell(0.17, 0.19, 0.15, [0, 0.5, 0.38], byN(0x8a9ccc, SNOW, SNOW, 0.6, -0.2), [0.5, 0, 0]);
  for (let i = 0; i < 7; i++) { const a = -1.3 + i * 0.43; k.cone([Math.sin(a) * 0.15, 0.52 + Math.cos(a) * 0.1, 0.36], [Math.sin(a) * 0.23, 0.48 + Math.cos(a) * 0.15, 0.26], 0.06, Math.cos(a) > 0.3 ? 0x5a6ea4 : 0xdce4f4, 4, 0.5); }
  k.row([-0.07, 0.36, 0.44], [0.07, 0.36, 0.44], 3, [0, -1, -0.3], 0.1, 0.045, SNOW, 4);
  k.both((s) => {
    k.cone([s * 0.09, 0.42, 0.44], [s * 0.21, 0.36, 0.36], 0.08, SNOW, 4, 0.5);
    // chunky legs, big paws with four claws, a fur tuft at each elbow (+x = the wolf's left)
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.13, 0.38, 0.27], () => {
      k.chain([[s * 0.13, 0.36, 0.27], [s * 0.14, 0.18, 0.3], [s * 0.135, 0.05, 0.34]], [0.075, 0.055, 0.045], LEG);
      k.cone([s * 0.14, 0.3, 0.24], [s * 0.15, 0.18, 0.17], 0.04, 0x5a6ea4, 4, 0.5);
      k.ell(0.065, 0.042, 0.085, [s * 0.135, 0.038, 0.38], PAW, null, 1);
      k.row([s * 0.105, 0.03, 0.45], [s * 0.165, 0.03, 0.45], 4, [0, -0.35, 1], 0.04, 0.011, CLAW);
    });
    k.ell(0.1, 0.16, 0.13, [s * 0.11, 0.42, -0.28], FURC, null, 1);
    k.bone(s > 0 ? B.LEG_BL : B.LEG_BR, [s * 0.125, 0.36, -0.26], () => {
      k.chain([[s * 0.125, 0.33, -0.25], [s * 0.135, 0.22, -0.2], [s * 0.125, 0.12, -0.36], [s * 0.125, 0.04, -0.33]], [0.075, 0.055, 0.045, 0.04], LEG);
      k.cone([s * 0.13, 0.2, -0.24], [s * 0.135, 0.12, -0.3], 0.035, 0x5a6ea4, 4, 0.5);
      k.ell(0.06, 0.04, 0.08, [s * 0.125, 0.038, -0.3], PAW, null, 1);
      k.row([s * 0.1, 0.03, -0.24], [s * 0.15, 0.03, -0.24], 3, [0, -0.35, 1], 0.035, 0.01, CLAW);
    });
  });
  // head: big, long snout, open snarling jaw, tall ears
  k.bone(B.HEAD, [0, 0.52, 0.42], () => k.at([0, 0.56, 0.52], [0.2, 0, 0], 1.38, () => {
    k.ell(0.12, 0.105, 0.12, [0, 0.02, 0], FURC, null, 2);
    k.limb([0, 0.0, 0.06], [0, -0.015, 0.28], 0.07, 0.045, byN(0x45588e, 0x8a9cc8, SNOW), 8);
    k.box(0.04, 0.02, 0.18, [0, 0.045, 0.16], 0x3a4c84, [0.12, 0, 0]); // dark bridge stripe
    k.ell(0.04, 0.032, 0.03, [0, -0.005, 0.29], DARK, null, 1);
    // lower jaw, open, red mouth with a pink tongue, rows of white teeth + one big pair of fangs
    k.limb([0, -0.06, 0.04], [0, -0.115, 0.22], 0.05, 0.032, byN(0x8a9cc8, 0xdce2f0, SNOW), 8);
    k.ell(0.045, 0.024, 0.1, [0, -0.05, 0.15], MOUTH, [0.2, 0, 0], 1);
    k.ell(0.028, 0.01, 0.07, [0, -0.06, 0.15], 0xf47a8c, [0.25, 0, 0], 1);
    k.both((s) => {
      k.cone([s * 0.036, -0.02, 0.23], [s * 0.034, -0.09, 0.235], 0.018, TEETH, 4);
      k.row([s * 0.04, -0.025, 0.2], [s * 0.045, -0.02, 0.09], 3, [0, -1, 0], 0.025, 0.008, TEETH);
      k.row([s * 0.033, -0.09, 0.19], [s * 0.04, -0.065, 0.09], 3, [0, 1, 0], 0.022, 0.008, TEETH);
      k.cone([s * 0.03, -0.1, 0.21], [s * 0.03, -0.05, 0.215], 0.012, TEETH, 3);
      k.ell(0.008, 0.006, 0.006, [s * 0.016, -0.0, 0.314], 0x2a2236, null, 0); // nostril
      // tall pricked ears with pink inside and fur tufts
      k.cone([s * 0.065, 0.07, -0.02], [s * 0.115, 0.28, -0.08], 0.065, BACK, 4, 0.45);
      k.cone([s * 0.067, 0.085, 0.0], [s * 0.108, 0.23, -0.055], 0.038, 0xf4a4a4, 4, 0.3);
      k.cone([s * 0.07, 0.08, 0.01], [s * 0.1, 0.16, 0.0], 0.022, 0xe8eef8, 3, 0.4);
      // cheek ruff tufts
      k.cone([s * 0.08, -0.02, 0.02], [s * 0.17, -0.08, -0.07], 0.05, 0xc4d0ea, 4, 0.5);
      k.cone([s * 0.09, 0.03, -0.02], [s * 0.17, 0.02, -0.1], 0.04, 0x7c90c0, 4, 0.5);
      // amber eyes: a dark rim, glowing iris, black-ish pupil; a heavy angled brow
      k.ell(0.034, 0.028, 0.02, [s * 0.056, 0.045, 0.088], 0x2c3660, null, 1);
      k.eye([s * 0.055, 0.045, 0.095], 0.028, 0xffd02a);
      k.ell(0.009, 0.016, 0.004, [s * 0.056, 0.045, 0.116], 0x2a2236, null, 0);
      k.box(0.07, 0.022, 0.04, [s * 0.058, 0.074, 0.095], BACK, [0.35, 0, s * 0.3]);
    });
  }));
  // big bushy tail sweeping back and up, white tip with fur tufts
  const tc = (t, d) => (t > 0.78 ? SNOW : d.y > 0.15 ? (Math.sin(t * 30) > 0.3 ? 0x34447a : 0x40548c) : 0x7c90c0);
  k.bone(B.TAIL, [0, 0.55, -0.42], () => {
    k.tube([[0, 0.55, -0.42], [0, 0.56, -0.6], [0.05, 0.5, -0.78], [0.1, 0.56, -0.92]], (t) => 0.05 + Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.85) * 0.1, tc, { seg: 8, n: 10 });
    for (let i = 0; i < 4; i++) { const a = i * 1.6; k.cone([0.08 + Math.cos(a) * 0.04, 0.55 + Math.sin(a) * 0.04, -0.86], [0.12 + Math.cos(a) * 0.08, 0.57 + Math.sin(a) * 0.08, -1.0], 0.04, i % 2 ? SNOW : 0xe4eaf6, 4, 0.5); }
    k.cone([0.01, 0.62, -0.62], [0.03, 0.66, -0.76], 0.05, 0x34447a, 4, 0.5);
  });
  return finish(k);
}

// ---------------------------------------------------------------- orc
function orc() {
  const k = nkit(31);
  // deep green skin + crimson/red-brown leather; a big bow and a crimson mohawk are the identity
  // R7: eyes with yellowed whites, heavy brow + scar, flat nose, lower teeth, ear rings; layered leather
  // vest with stitched plates, studded strip kilt, bandolier, bone necklace, riveted pauldron with a lame,
  // studded bracers, fur-cuffed boots; bow with horn nocks + grip wrap; full quiver with fletched arrows
  const SK = byN(0x5cb03c, 0x3e8c30, 0x2c6c28), SKD = byN(0x4c9c34, 0x3a802c, 0x2c6626);
  const PANTS = byN(0x8a4630, 0x6e3424, 0x52281c);
  const ARM = byN(0xd04a2c, 0xa03424, 0x70261c), ARMD = byN(0xb03c26, 0x86301e, 0x5e2218);
  const FUR = 0xd8c4a0, STUD = 0xe8ecf4;
  const NECK = [0, 0.84, 0.04];
  k.setBody([0, 0.46, 0]);
  k.both((s) => {
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.1, 0.46, 0], () => {
      k.chain([[s * 0.1, 0.46, 0], [s * 0.14, 0.26, 0.06], [s * 0.14, 0.09, 0.0]], [0.08, 0.065, 0.06], PANTS);
      k.ell(0.075, 0.07, 0.12, [s * 0.14, 0.065, 0.04], LEATHER_D, null, 1);
      k.ell(0.06, 0.035, 0.05, [s * 0.14, 0.055, 0.13], 0x6a3e24, null, 1); // toe cap
      k.torus(0.07, 0.03, [s * 0.14, 0.14, 0.01], FUR, undefined, 1, 10); // fur cuff
      k.ell(0.05, 0.05, 0.035, [s * 0.145, 0.27, 0.11], LEATHER, null, 1); // knee pad
    });
    k.bone(B.HEAD, NECK, () => {
      // big upturned tusks
      k.cone([s * 0.06, 0.84, 0.19], [s * 0.095, 0.99, 0.22], 0.03, BONE, 5);
      // pointed ears with two gold rings
      k.cone([s * 0.11, 0.93, 0.05], [s * 0.25, 1.0, -0.02], 0.045, SK, 4, 0.4);
      k.torus(0.018, 0.006, [s * 0.17, 0.945, 0.02], GOLD, [0, 0, 0], 1, 8);
      if (s < 0) k.torus(0.016, 0.006, [s * 0.2, 0.96, 0.0], GOLD, [0, 0, 0], 1, 8);
      // yellowed eyes with glowing red irises, angled heavy brows
      k.eyeW([s * 0.052, 0.935, 0.198], 0.032, 0xff4a1a, { white: 0xfff0c0 });
      k.box(0.09, 0.03, 0.05, [s * 0.058, 0.975, 0.2], SKD, [0.3, 0, s * 0.35]);
      k.ell(0.011, 0.009, 0.008, [s * 0.018, 0.885, 0.262], 0x2a5a22, null, 0); // nostril
    });
  });
  // crimson kilt + studded hanging strips + belt with a skull buckle and pouches
  k.frus(0.17, 0.22, 0.18, [0, 0.34, 0], ARM, 10);
  for (let i = 0; i < 7; i++) {
    const a = -1.35 + i * 0.45, x = Math.sin(a) * 0.205, z = Math.cos(a) * 0.205;
    k.box(0.07, 0.17, 0.025, [x, 0.3, z], i % 2 ? ARMD : 0x6e3424, [-0.12, a, 0]);
    k.ell(0.012, 0.012, 0.008, [x * 1.06, 0.25, z * 1.06], STUD, null, 0);
  }
  k.torus(0.17, 0.034, [0, 0.52, 0], LEATHER_D, undefined, 0.85, 12);
  k.ell(0.045, 0.045, 0.03, [0, 0.52, 0.165], BONE, null, 1);
  k.box(0.05, 0.02, 0.02, [0, 0.49, 0.17], BONE);
  k.both((s) => k.ell(0.009, 0.009, 0.006, [s * 0.016, 0.525, 0.192], DARK, null, 0));
  k.box(0.07, 0.08, 0.04, [0.15, 0.47, 0.08], LEATHER, [0, 0.5, 0]);
  k.box(0.06, 0.07, 0.035, [-0.16, 0.47, 0.05], LEATHER, [0, -0.6, 0]);
  // V-shaped torso: crimson leather vest with stitched plates under broad green shoulders
  k.ell(0.17, 0.14, 0.13, [0, 0.58, 0.02], ARM, null, 1);
  for (let i = 0; i < 2; i++) k.box(0.2 - i * 0.03, 0.05, 0.03, [0, 0.56 + i * 0.055, 0.13 - i * 0.005], i ? ARM : ARMD, [-0.15, 0, 0]);
  k.ell(0.26, 0.18, 0.16, [0, 0.74, 0.0], SK, null, 1);
  k.both((s) => k.ell(0.1, 0.07, 0.04, [s * 0.09, 0.75, 0.13], SKD, [0, s * 0.3, 0], 1)); // pecs
  // bandolier from the right shoulder to the left hip, with studs; a bone-and-tooth necklace
  k.strap([[-0.2, 0.86, 0.04], [-0.08, 0.76, 0.16], [0.08, 0.62, 0.15], [0.17, 0.52, 0.06]], 0.022, LEATHER_D);
  for (let i = 0; i < 4; i++) k.ell(0.013, 0.013, 0.01, [-0.13 + i * 0.075, 0.8 - i * 0.065, 0.165 - Math.abs(i - 1.5) * 0.02], STUD, null, 0);
  k.torus(0.1, 0.01, [0, 0.83, 0.06], LEATHER_D, [Math.PI / 2 + 0.45, 0, 0], 1, 12);
  k.row([-0.07, 0.795, 0.135], [0.07, 0.795, 0.135], 5, [0, -1, 0.2], 0.045, 0.013, BONE);
  // quiver on the back: banded leather, five fletched arrows
  k.at([0.08, 0.76, -0.17], [0.25, 0, -0.45], 1, () => {
    k.frus(0.065, 0.06, 0.32, [0, -0.17, 0], LEATHER, 8);
    for (const y of [-0.15, 0.1]) k.frus(0.069, 0.069, 0.03, [0, y, 0], 0x7a3a20, 8);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.022, z = (i % 2) * 0.02 - 0.01;
      k.limb([x, 0.1, z], [x * 1.3, 0.2, z], 0.007, 0.007, WOOD, 4);
      k.cone([x * 1.3, 0.16, z], [x * 1.35, 0.27, z], 0.03, i === 2 ? 0xffe04a : i % 2 ? 0xffffff : 0xe8342a, 3, 0.35);
    }
  });
  // spiked steel pauldron (-x) with a lame below, rivets and a strap
  k.ell(0.14, 0.1, 0.14, [-0.25, 0.86, 0], STEEL, null, 2);
  k.ell(0.12, 0.06, 0.12, [-0.27, 0.79, 0.0], byN(0xdfe6f2, 0xaab4c4, 0x8e98a8), [0, 0, 0.3], 1);
  for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.6; k.ell(0.012, 0.012, 0.012, [-0.25 + Math.sin(a) * 0.04, 0.92, Math.cos(a) * 0.12], GOLD, null, 0); }
  k.cone([-0.27, 0.9, 0.02], [-0.38, 1.08, 0.03], 0.045, 0xfafcff, 5);
  k.cone([-0.2, 0.92, -0.06], [-0.25, 1.08, -0.1], 0.04, 0xfafcff, 5);
  k.cone([-0.3, 0.88, 0.09], [-0.38, 0.98, 0.15], 0.03, 0xfafcff, 4);
  // head: BIG, thrust forward, heavy jaw, red war-paint band across the eyes
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.15, 0.14, 0.14, [0, 0.93, 0.07], SK, null, 2);
    k.box(0.21, 0.1, 0.13, [0, 0.84, 0.12], SK);
    k.box(0.24, 0.05, 0.07, [0, 0.985, 0.17], SKD, [0.25, 0, 0]);
    k.box(0.21, 0.035, 0.03, [0, 0.93, 0.18], 0xe8342a, [0.1, 0, 0]);
    k.box(0.012, 0.09, 0.012, [0.085, 0.95, 0.205], 0xb8e0a0, [0.1, 0, 0.5]); // scar over the left eye
    k.ell(0.045, 0.035, 0.035, [0, 0.895, 0.23], SKD, null, 1); // flat broad nose
    k.box(0.11, 0.025, 0.03, [0, 0.82, 0.19], MOUTH);
    k.row([-0.04, 0.81, 0.2], [0.04, 0.81, 0.2], 4, [0, 1, 0.1], 0.02, 0.008, TEETH);
    k.box(0.12, 0.02, 0.03, [0, 0.8, 0.192], SKD); // lower lip
    // tall crimson mohawk in two layers, bound with a gold ring at the back
    for (let i = 0; i < 5; i++) k.cone([0, 1.03 - Math.abs(i - 1) * 0.015, 0.12 - i * 0.06], [0, 1.22 - Math.abs(i - 1.2) * 0.03, 0.07 - i * 0.08], 0.05, i % 2 ? 0xd0281e : 0xf04030, 4, 0.5);
    for (let i = 0; i < 3; i++) k.cone([0, 1.01, 0.08 - i * 0.07], [0, 1.12, 0.03 - i * 0.08], 0.04, 0x9a1a14, 4, 0.7);
    k.cone([0, 0.97, -0.08], [0, 0.82, -0.14], 0.035, 0xd0281e, 4, 0.6); // braid
    k.torus(0.022, 0.008, [0, 0.91, -0.11], GOLD, [0.3, 0, 0], 1, 8);
  });
  // bow arm (+x = left): a big bow held out front-right
  k.bone(B.ARM_L, [0.27, 0.8, 0], () => {
    k.chain([[0.27, 0.8, 0], [0.34, 0.64, 0.13], [0.3, 0.62, 0.31]], [0.075, 0.062, 0.055], SK);
    k.limb([0.33, 0.64, 0.17], [0.31, 0.625, 0.27], 0.066, 0.06, LEATHER, 8); // bracer
    k.row([0.37, 0.64, 0.18], [0.355, 0.63, 0.26], 3, [1, 0, 0], 0.025, 0.01, STUD, 4);
    k.ell(0.055, 0.06, 0.055, [0.3, 0.62, 0.33], SKD, null, 1);
    const BOW = (t) => (t > 0.43 && t < 0.57 ? (Math.sin(t * 200) > 0 ? 0xffc83a : 0xd89a28) : (t < 0.2 || t > 0.8) ? 0x7a4422 : 0x9a5a2e);
    k.tube([[0.28, 0.12, 0.24], [0.29, 0.3, 0.36], [0.3, 0.62, 0.4], [0.29, 0.94, 0.36], [0.28, 1.12, 0.24]], (t) => 0.036 - Math.abs(t - 0.5) * 0.03, BOW, { seg: 6, n: 16 });
    k.cone([0.28, 1.11, 0.245], [0.27, 1.17, 0.2], 0.018, BONE, 4);
    k.cone([0.28, 0.13, 0.245], [0.27, 0.07, 0.2], 0.018, BONE, 4);
    k.limb([0.28, 0.13, 0.24], [0.28, 1.11, 0.24], 0.007, 0.007, 0xf8f0d8, 3);
  });
  // draw arm (-x = right): hand at the string with a nocked, fletched arrow
  k.bone(B.ARM_R, [-0.28, 0.8, 0], () => {
    k.chain([[-0.28, 0.8, 0], [-0.25, 0.64, 0.14], [-0.02, 0.64, 0.24]], [0.075, 0.062, 0.055], SK);
    k.limb([-0.2, 0.64, 0.18], [-0.08, 0.64, 0.22], 0.064, 0.058, LEATHER, 8); // bracer
    k.ell(0.055, 0.055, 0.055, [0.0, 0.64, 0.25], SKD, null, 1);
    k.limb([-0.02, 0.64, 0.25], [0.44, 0.64, 0.42], 0.012, 0.012, WOOD, 5);
    k.cone([0.42, 0.64, 0.415], [0.52, 0.64, 0.45], 0.03, STEEL, 4, 0.4);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; k.cone([0.07, 0.64 + Math.sin(a) * 0.005, 0.28], [-0.05, 0.64 + Math.sin(a) * 0.03, 0.235 + Math.cos(a) * 0.03], 0.02, i ? 0xf8f0e0 : 0xe8342a, 3, 0.3); }
  });
  return finish(k);
}

// ---------------------------------------------------------------- ogre
function ogre() {
  const k = nkit(41);
  // ruddy tan skin + royal-blue cloth with red trim; a HUGE dark club studded with white spikes
  // R7: eyes with whites, bushy brows, nostrils + gold nose ring, lips + lower teeth, warts; navel,
  // chest hair, belt with a big buckle, trophy skull + pouch, patched loincloth with red hem stripes,
  // fur-trimmed mantle, studded wrist bands, knuckles, toes; club with iron bands, grip wrap, grain
  const SK = byN(0xf4b698, 0xdc8e72, 0xaa6650), SKD = byN(0xe6a084, 0xc87c62, 0x9c5c48);
  const BELLY = byN(0xf6c0a0, 0xe8a284, 0xb27660);
  const HIDE = byN(0x4a86e8, 0x2e5cc8, 0x22428e);
  const CLUB = banded(byN(0x8a5630, 0x6e4224, 0x52321c), 0.84, (p) => Math.sin(p.x * 50 + p.y * 30) > 0.5);
  const HAIR = 0x6a3420, NAIL = 0xf8e8d0, FUR = 0xe8d8b8, IRON = byN(0xd0d4dc, 0x9aa0ac, 0x7a808c);
  const NECK = [0, 1.0, 0.06];
  k.setBody([0, 0.38, 0]);
  k.both((s) => {
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.14, 0.38, 0], () => {
      k.chain([[s * 0.14, 0.38, 0], [s * 0.17, 0.2, 0.05], [s * 0.16, 0.08, 0.01]], [0.11, 0.09, 0.08], SK);
      k.ell(0.1, 0.07, 0.14, [s * 0.165, 0.06, 0.05], SKD, null, 1);
      for (let i = 0; i < 3; i++) { const x = s * (0.13 + i * 0.035); k.ell(0.028, 0.026, 0.03, [x, 0.035, 0.175], SK, null, 1); k.ell(0.016, 0.01, 0.012, [x, 0.05, 0.198], NAIL, null, 0); }
      k.frus(0.085, 0.09, 0.05, [s * 0.16, 0.13, 0.01], LEATHER_D, 8); // ankle wrap
    });
    k.ell(0.15, 0.13, 0.14, [s * 0.31, 0.98, -0.04], SK, null, 1);
    k.bone(B.HEAD, NECK, () => {
      // little mean eyes (white + glowing pupil) under bushy brows, big underbite tusks
      k.eyeW([s * 0.07, 1.18, 0.283], 0.036, 0xffb020, { white: 0xfff4e0 });
      k.cone([s * 0.03, 1.215, 0.3], [s * 0.13, 1.235, 0.27], 0.03, HAIR, 4, 0.5);
      k.cone([s * 0.08, 1.22, 0.3], [s * 0.15, 1.2, 0.26], 0.025, HAIR, 4, 0.5);
      k.cone([s * 0.08, 1.05, 0.3], [s * 0.09, 1.17, 0.32], 0.034, TEETH, 5);
      // cauliflower ears with a gold stud
      k.ell(0.06, 0.08, 0.04, [s * 0.2, 1.17, 0.1], SKD, [0, s * 0.5, 0], 1);
      k.ell(0.03, 0.04, 0.02, [s * 0.215, 1.17, 0.12], 0xc87060, [0, s * 0.5, 0], 0);
      k.ell(0.009, 0.006, 0.006, [s * 0.025, 1.12, 0.37], 0x8a3a30, null, 0); // nostril
      k.ell(0.02, 0.02, 0.015, [s * 0.15, 1.25 - s * 0.05, 0.22], 0xd88a6a, null, 0); // wart
    });
  });
  // blue loincloth with a front flap, red hem stripes and a patch
  k.frus(0.28, 0.31, 0.18, [0, 0.32, 0], HIDE, 12);
  k.box(0.22, 0.24, 0.04, [0, 0.27, 0.28], HIDE, [0.15, 0, 0]);
  k.box(0.225, 0.03, 0.045, [0, 0.175, 0.265], 0xe03a2a, [0.15, 0, 0]);
  k.box(0.225, 0.015, 0.045, [0, 0.21, 0.27], 0xffc83a, [0.15, 0, 0]);
  k.box(0.07, 0.06, 0.02, [-0.05, 0.3, 0.3], 0x7aa8f4, [0.15, 0, 0.2]);
  k.torus(0.285, 0.035, [0, 0.33, 0], 0xe03a2a, [Math.PI / 2, 0, 0], 1, 14);
  // huge belly + chest, navel, chest hair
  k.ell(0.32, 0.3, 0.3, [0, 0.62, 0.06], BELLY, null, 1);
  k.ell(0.022, 0.03, 0.015, [0, 0.58, 0.355], 0xb2705a, null, 0);
  k.torus(0.28, 0.034, [0, 0.42, 0.04], 0xd8342a, [Math.PI / 2 - 0.1, 0, 0], 1.05, 14);
  // belt buckle, trophy skull and a pouch
  k.box(0.12, 0.1, 0.04, [0, 0.43, 0.33], GOLD, [-0.1, 0, 0]);
  k.box(0.07, 0.05, 0.03, [0, 0.43, 0.345], 0xb88a20, [-0.1, 0, 0]);
  k.ell(0.065, 0.06, 0.06, [-0.24, 0.32, 0.2], BONE, null, 1);
  k.box(0.07, 0.03, 0.05, [-0.24, 0.27, 0.215], BONE);
  k.both((s) => k.ell(0.016, 0.018, 0.01, [-0.24 + s * 0.024, 0.33, 0.255], DARK, null, 0));
  k.ell(0.07, 0.08, 0.05, [0.26, 0.33, 0.18], LEATHER, null, 1);
  k.box(0.08, 0.025, 0.06, [0.26, 0.4, 0.185], LEATHER_D);
  k.ell(0.34, 0.2, 0.22, [0, 0.9, -0.04], SK, null, 1);
  for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.045; k.cone([x, 0.86 - Math.abs(i - 2) * 0.02, 0.15], [x * 1.2, 0.8 - Math.abs(i - 2) * 0.02, 0.18], 0.025, 0xa85a3a, 3, 0.4); }
  // blue cloth mantle over one shoulder with fur trim, a gold clasp + red sash
  k.ell(0.22, 0.11, 0.21, [0.22, 1.0, -0.04], HIDE, [0, 0, -0.35], 1);
  for (let i = 0; i < 7; i++) { const a = i * 0.9 - 0.3; k.cone([0.22 + Math.cos(a) * 0.2, 0.95 - Math.max(0, Math.cos(a)) * 0.07, -0.04 + Math.sin(a) * 0.19], [0.22 + Math.cos(a) * 0.25, 0.86 - Math.max(0, Math.cos(a)) * 0.08, -0.04 + Math.sin(a) * 0.23], 0.04, FUR, 4, 0.5); }
  k.ell(0.05, 0.05, 0.03, [0.12, 0.98, 0.17], GOLD, null, 1);
  k.ell(0.025, 0.025, 0.02, [0.12, 0.98, 0.195], 0xe03a2a, null, 0);
  k.box(0.1, 0.5, 0.04, [0.05, 0.82, 0.18], 0xd8342a, [0.2, 0, -0.75]);
  k.box(0.1, 0.02, 0.045, [0.05, 0.82, 0.185], 0xffc83a, [0.2, 0, -0.75]);
  // head: bigger than before, low and forward
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.2, 0.19, 0.18, [0, 1.17, 0.12], SK, null, 2);
    k.box(0.3, 0.12, 0.18, [0, 1.06, 0.18], SK);
    k.box(0.2, 0.035, 0.03, [0, 1.07, 0.275], MOUTH);
    k.row([-0.05, 1.065, 0.285], [0.05, 1.065, 0.285], 4, [0, 1, 0.1], 0.025, 0.011, TEETH);
    k.box(0.22, 0.025, 0.04, [0, 1.045, 0.275], SKD); // fat lower lip
    k.ell(0.07, 0.065, 0.07, [0, 1.14, 0.31], 0xf0a07a, null, 1);
    k.torus(0.025, 0.007, [0, 1.095, 0.345], GOLD, [0, 0, 0], 1, 8); // nose ring
    k.box(0.3, 0.05, 0.07, [0, 1.22, 0.26], SKD, [0.3, 0, 0]);
    // dark top-knot with a gold band
    k.cone([0, 1.32, 0.08], [0, 1.52, 0.0], 0.075, HAIR, 6);
    k.cone([0, 1.42, 0.02], [0.05, 1.55, -0.08], 0.035, 0x8a4428, 4);
    k.torus(0.056, 0.018, [0, 1.36, 0.06], GOLD, [Math.PI / 2, 0, 0], 1, 10);
  });
  // left arm (+x) hangs, huge fist with knuckles and a studded wrist band
  k.bone(B.ARM_L, [0.34, 0.95, -0.02], () => {
    k.chain([[0.34, 0.95, -0.02], [0.45, 0.68, 0.04], [0.43, 0.44, 0.12]], [0.1, 0.085, 0.075], SK);
    k.frus(0.085, 0.085, 0.08, [0.432, 0.45, 0.115], LEATHER_D, 10);
    k.row([0.375, 0.49, 0.18], [0.49, 0.49, 0.17], 3, [0, 0, 1], 0.02, 0.012, 0xe8ecf4, 4);
    k.ell(0.11, 0.1, 0.11, [0.43, 0.39, 0.14], SKD, null, 1);
    for (let i = 0; i < 4; i++) k.ell(0.028, 0.025, 0.03, [0.385 + i * 0.03, 0.35, 0.235], SK, null, 1);
  });
  // right arm (-x): the HUGE spiked club over the shoulder
  k.bone(B.ARM_R, [-0.34, 0.95, -0.02], () => {
    k.chain([[-0.34, 0.95, -0.02], [-0.46, 0.72, 0.1], [-0.34, 0.82, 0.27]], [0.1, 0.085, 0.075], SK);
    k.limb([-0.41, 0.77, 0.18], [-0.37, 0.8, 0.24], 0.085, 0.08, LEATHER_D, 10);
    k.ell(0.1, 0.1, 0.1, [-0.33, 0.83, 0.29], SKD, null, 1);
    const a = V(-0.33, 0.74, 0.4), b = V(-0.55, 1.36, -0.36), d = b.clone().sub(a).normalize();
    k.limb(a.toArray(), b.toArray(), 0.05, 0.16, CLUB, 10);
    k.ell(0.165, 0.165, 0.165, b.toArray(), CLUB, null, 1);
    // grip wrap near the handle, two iron bands on the head
    for (let i = 0; i < 3; i++) { const t0 = 0.02 + i * 0.05, p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t0 + 0.03); k.limb(p0.toArray(), p1.toArray(), 0.062 + t0 * 0.11, 0.062 + t0 * 0.11, i % 2 ? 0xb87a4a : 0xe8d8b0, 10); }
    for (const t0 of [0.55, 0.8]) { const p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t0 + 0.04); k.limb(p0.toArray(), p1.toArray(), 0.06 + t0 * 0.11, 0.06 + (t0 + 0.04) * 0.11, IRON, 10); }
    for (let i = 0; i < 6; i++) {
      const t = 0.62 + (i % 2) * 0.24, ang = i * 2.1;
      const c = a.clone().lerp(b, t); const rr = 0.05 + 0.11 * t;
      const side = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d));
      const base = c.clone().addScaledVector(side, rr * 0.8);
      k.cone(base.toArray(), base.clone().addScaledVector(side, 0.12).toArray(), 0.035, 0xf8f0e0, 5);
    }
    k.cone(b.clone().addScaledVector(d, 0.12).toArray(), b.clone().addScaledVector(d, 0.25).toArray(), 0.04, 0xf8f0e0, 5);
  });
  return finish(k);
}

// ---------------------------------------------------------------- troll
function troll() {
  const k = nkit(51);
  // lilac cave-stone hide (no longer blue like the wolf) + a big chartreuse-moss hump; long dragging arms
  // R7: lichen-spotted hide, pale eyes with glowing irises, warty nostrilled nose, jagged teeth, bone ear
  // ring; mushrooms + moss tufts on the hump, hanging moss strands, rope belt with a bone fetish and
  // hanging strips, a tooth necklace, four claws per hand, toe claws, knobbly stone knees/elbows
  const lichen = (p) => hash3(p, 2.3) > 0.9;
  const SK = tint(byN(0xc4b0d8, 0x9c86b8, 0x6e5c8a, 0.45, -0.3), 0xb4c488, lichen);
  const SKL = tint(byN(0xb4a0cc, 0x8e78ac, 0x6e5c8a), 0xa4b47e, lichen);
  const MOSS = banded(byN(0xb8f04a, 0x8ac436, 0x5e8a2c, 0.3, -0.3), 0.85, (p) => hash3(p, 4) > 0.7);
  const ROCK = byN(0xb0e84a, 0x9a90a4, 0x766c80, 0.4, -0.2);
  const CLAW = 0xf8f0d8, ROPE = 0xb8945a;
  const NECK = [0, 0.86, 0.18];
  k.setBody([0, 0.5, -0.04]);
  k.both((s) => {
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.11, 0.5, -0.06], () => {
      k.chain([[s * 0.11, 0.5, -0.06], [s * 0.16, 0.3, 0.08], [s * 0.14, 0.08, -0.03]], [0.075, 0.06, 0.055], SKL);
      k.rock(0.045, [s * 0.165, 0.31, 0.12], ROCK); // stony knee
      k.ell(0.09, 0.05, 0.13, [s * 0.15, 0.045, 0.03], SKL, null, 1);
      k.row([s * 0.11, 0.03, 0.15], [s * 0.19, 0.03, 0.14], 3, [0, -0.2, 1], 0.05, 0.016, CLAW, 4);
    });
    // very long thick arms dragging near the ground, huge hands with four big claws + a thumb claw
    const ARM = [s > 0 ? B.ARM_L : B.ARM_R, [s * 0.24, 0.88, 0.06]];
    k.bone(...ARM, () => {
      k.chain([[s * 0.24, 0.88, 0.06], [s * 0.4, 0.6, 0.0], [s * 0.36, 0.26, 0.2]], [0.095, 0.085, 0.075], SKL);
      k.rock(0.05, [s * 0.43, 0.6, -0.04], ROCK); // stony elbow
      // moss strands hanging from the forearm
      for (let i = 0; i < 2; i++) k.cone([s * (0.4 - i * 0.02), 0.5 - i * 0.12, 0.02 + i * 0.06], [s * (0.43 - i * 0.02), 0.36 - i * 0.12, 0.0 + i * 0.06], 0.03, 0x8ac436, 3, 0.5);
      k.ell(0.115, 0.12, 0.11, [s * 0.36, 0.18, 0.24], SK, null, 1);
      for (let i = 0; i < 4; i++) k.cone([s * (0.29 + i * 0.045), 0.12, 0.3 + Math.abs(i - 1.5) * -0.01], [s * (0.29 + i * 0.05), 0.02, 0.38], 0.024, CLAW, 4);
      k.cone([s * 0.27, 0.18, 0.28], [s * 0.22, 0.12, 0.36], 0.022, CLAW, 4);
    });
    k.rock(0.085, [s * 0.27, 0.97, 0.02], ROCK, [1.2, 0.9, 1]);
    // droopy long ears (bone ring in one), pale eyes with glowing irises, one big lower tusk
    k.bone(B.HEAD, NECK, () => {
      k.cone([s * 0.1, 0.9, 0.22], [s * 0.3, 0.85, 0.13], 0.05, SKL, 5, 0.4);
      if (s > 0) k.torus(0.025, 0.008, [s * 0.25, 0.85, 0.15], BONE, [0, 0.4, 0], 1, 8);
      k.eyeW([s * 0.058, 0.925, 0.378], 0.032, 0xeaff40, { white: 0xf6f0c8, slit: true });
      k.cone([s * 0.05, 0.8, 0.37], [s * 0.065, 0.89, 0.41], 0.022, BONE, 5);
      k.ell(0.013, 0.01, 0.01, [s * 0.025, 0.8, 0.49], 0x5a4a72, null, 0); // nostril
    });
  });
  // brown loin wrap, rope belt, bone fetish and hanging strips
  k.frus(0.15, 0.19, 0.14, [0, 0.4, -0.02], byN(0x9a6a3c, 0x7a5030, 0x5a3a22), 9);
  k.torus(0.155, 0.02, [0, 0.535, -0.02], ROPE, undefined, 1, 10);
  for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6; k.box(0.06, 0.16, 0.02, [Math.sin(a) * 0.19, 0.38, -0.02 + Math.cos(a) * 0.19], i % 2 ? 0x8a5a30 : 0x6a4426, [-0.15, a, 0]); }
  k.limb([0.1, 0.52, 0.12], [0.11, 0.36, 0.16], 0.012, 0.012, BONE, 5);
  k.ell(0.035, 0.032, 0.03, [0.11, 0.34, 0.165], BONE, null, 1);
  k.both((s) => k.ell(0.008, 0.008, 0.005, [0.11 + s * 0.013, 0.345, 0.193], DARK, null, 0));
  // hunched torso
  k.ell(0.16, 0.15, 0.14, [0, 0.58, -0.02], SK, null, 1);
  k.ell(0.24, 0.2, 0.2, [0, 0.79, 0.06], SK, [0.5, 0, 0], 1);
  // tooth necklace
  k.torus(0.13, 0.012, [0, 0.8, 0.17], ROPE, [Math.PI / 2 + 0.9, 0, 0], 1, 12);
  k.row([-0.08, 0.74, 0.25], [0.08, 0.74, 0.25], 5, [0, -1, 0.3], 0.05, 0.013, BONE);
  // the mossy hump: one big bright cap over the back, stones poking out, tufts and mushrooms
  k.ell(0.17, 0.1, 0.16, [0, 0.95, -0.07], MOSS, [0.4, 0, 0], 1);
  k.rock(0.09, [0.06, 1.0, -0.04], ROCK, [1, 0.9, 1]);
  k.rock(0.08, [-0.08, 0.92, -0.16], ROCK, [1, 0.9, 1]);
  k.rock(0.07, [0.02, 0.8, -0.22], ROCK);
  for (let i = 0; i < 5; i++) { const a = i * 1.25; k.cone([Math.sin(a) * 0.12, 0.98, -0.07 + Math.cos(a) * 0.1], [Math.sin(a) * 0.18, 1.0, -0.09 + Math.cos(a) * 0.15], 0.035, i % 2 ? 0xc8f860 : 0x9ad840, 3, 0.5); }
  for (const [x, z, h, r] of [[-0.07, -0.02, 0.08, 0.045], [-0.11, -0.08, 0.06, 0.035], [0.1, -0.1, 0.05, 0.03]]) {
    k.limb([x, 0.98, z], [x, 0.98 + h, z], 0.012, 0.014, 0xf6ead0, 5);
    k.ell(r, r * 0.6, r, [x, 0.98 + h, z], byN(0xff7a3a, 0xe0502a, 0xf6ead0), null, 1);
    k.ell(r * 0.25, r * 0.15, r * 0.25, [x + r * 0.3, 0.98 + h + r * 0.45, z], 0xfff8e8, null, 0);
  }
  // head: big, low, forward, huge drooping warty nose
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.14, 0.12, 0.14, [0, 0.92, 0.27], SK, null, 2);
    k.box(0.16, 0.07, 0.11, [0, 0.82, 0.33], SKL);
    k.box(0.12, 0.022, 0.03, [0, 0.815, 0.385], MOUTH);
    k.row([-0.045, 0.808, 0.395], [0.045, 0.808, 0.395], 4, [0, 1, 0.1], 0.025, 0.009, TEETH, 3, 0.6);
    k.row([-0.035, 0.826, 0.395], [0.035, 0.826, 0.395], 3, [0, -1, 0.1], 0.018, 0.008, TEETH);
    k.cone([0, 0.93, 0.37], [0, 0.78, 0.53], 0.07, 0xd4c4e4, 7);
    k.ell(0.02, 0.02, 0.018, [0.03, 0.86, 0.46], 0xc0acd8, null, 0);
    k.ell(0.015, 0.015, 0.013, [-0.025, 0.89, 0.42], 0xc0acd8, null, 0);
    k.box(0.2, 0.04, 0.06, [0, 0.96, 0.36], 0x6e5c8a, [0.3, 0, 0]);
    // mossy hair
    for (let i = 0; i < 6; i++) { const a = -1.1 + i * 0.44; k.cone([Math.sin(a) * 0.06, 1.0, 0.24 - Math.cos(a) * 0.04], [Math.sin(a) * 0.14, 0.97 - (i % 2) * 0.03, 0.06 - Math.cos(a) * 0.06], 0.05, i % 2 ? 0x9ad840 : 0x7ab830, 3, 0.5); }
  });
  return finish(k);
}

// ---------------------------------------------------------------- cyclops
function cyclops() {
  const k = nkit(61);
  // rosy skin + deep teal hide; ONE HUGE EYE and a mossy boulder held overhead
  // R7: the eye gets lids, lashes, a dark iris ring, a highlight and red veins; nose, teeth row + lip,
  // gold ear rings, a braided ponytail; fur-trimmed loincloth with a gold hem, skull buckle, studded
  // strap, tooth necklace, gold armlets, wrist wraps, sandal straps, toes, fingers, moss on the boulder
  const SK = byN(0xfaae96, 0xe28672, 0xb25e50), SKD = byN(0xec9a84, 0xcc7262, 0xa45648);
  const HIDE = banded(byN(0x2ea8a8, 0x1e8288, 0x166068), 0.85, (p) => Math.sin(p.y * 80) > 0.6);
  const ROCK = tint(byN(0x9ad85a, 0xc4beb4, 0x948e86, 0.45, -0.3), 0x7ab840, (p, n) => n.y > 0 && hash3(p, 5) > 0.75);
  const FUR = 0xead8b4, HAIR = 0x8a3a24, NAIL = 0xf8e8d0;
  const NECK = [0, 1.16, 0.02];
  k.setBody([0, 0.62, 0]);
  k.both((s) => {
    k.bone(s > 0 ? B.LEG_FL : B.LEG_FR, [s * 0.14, 0.62, 0], () => {
      k.chain([[s * 0.14, 0.62, 0], [s * 0.17, 0.35, 0.07], [s * 0.15, 0.09, 0.0]], [0.11, 0.085, 0.07], SK);
      k.ell(0.085, 0.06, 0.14, [s * 0.155, 0.06, 0.05], SKD, null, 1);
      for (let i = 0; i < 3; i++) { const x = s * (0.12 + i * 0.03); k.ell(0.022, 0.02, 0.025, [x, 0.03, 0.18], SK, null, 0); k.ell(0.013, 0.008, 0.01, [x, 0.042, 0.198], NAIL, null, 0); }
      k.frus(0.08, 0.085, 0.06, [s * 0.15, 0.1, 0.0], LEATHER_D, 9);
      // criss-cross sandal straps up the shin
      for (let i = 0; i < 2; i++) k.torus(0.078 - i * 0.004, 0.012, [s * (0.155 + i * 0.008), 0.2 + i * 0.09, 0.03], LEATHER_D, [Math.PI / 2 + (i ? 0.3 : -0.3), 0, 0], 1, 10);
    });
    k.ell(0.14, 0.12, 0.13, [s * 0.31, 1.13, -0.02], SK, null, 1);
    k.bone(B.HEAD, NECK, () => {
      k.ell(0.035, 0.06, 0.025, [s * 0.18, 1.34, 0.03], SK, [0, s * 0.4, 0], 1);
      k.torus(0.02, 0.007, [s * 0.19, 1.28, 0.04], GOLD, [0, s * 0.4, 0], 1, 8);
      k.cone([s * 0.06, 1.18, 0.19], [s * 0.075, 1.26, 0.21], 0.024, TEETH, 5);
      k.ell(0.01, 0.008, 0.008, [s * 0.02, 1.235, 0.31], 0x9a4a3c, null, 0); // nostril
    });
  });
  // teal loincloth with front/back flaps (CLOTH, hanging from the belt), belt with a big gold buckle
  k.frus(0.21, 0.24, 0.2, [0, 0.53, 0], HIDE, 10);
  k.bone(B.CLOTH, [0, 0.58, 0.22], () => {
    k.box(0.22, 0.3, 0.04, [0, 0.42, 0.22], HIDE, [0.1, 0, 0]);
    k.box(0.225, 0.03, 0.045, [0, 0.29, 0.207], GOLD, [0.1, 0, 0]);
    for (let i = 0; i < 3; i++) k.box(0.03, 0.03, 0.045, [(i - 1) * 0.06, 0.4, 0.245], 0x7af0e0, [0.1, 0, Math.PI / 4]);
  });
  k.bone(B.CLOTH, [0, 0.58, -0.21], () => {
    k.box(0.2, 0.26, 0.04, [0, 0.45, -0.21], HIDE, [-0.1, 0, 0]);
    k.box(0.205, 0.03, 0.045, [0, 0.335, -0.198], GOLD, [-0.1, 0, 0]);
  });
  // fur trim along the top of the loincloth
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; k.cone([Math.sin(a) * 0.215, 0.69, Math.cos(a) * 0.19], [Math.sin(a) * 0.26, 0.6, Math.cos(a) * 0.23], 0.045, i % 2 ? FUR : 0xf6ead0, 4, 0.5); }
  k.torus(0.21, 0.04, [0, 0.72, 0], LEATHER_D, undefined, 0.85, 12);
  k.box(0.11, 0.1, 0.04, [0, 0.72, 0.19], GOLD);
  k.ell(0.032, 0.035, 0.02, [0, 0.725, 0.215], BONE, null, 1);
  k.both((s) => k.ell(0.008, 0.009, 0.005, [s * 0.012, 0.73, 0.234], DARK, null, 0));
  // torso: pecs, navel, one bold studded teal strap, tooth necklace
  k.ell(0.21, 0.17, 0.16, [0, 0.82, 0.02], SK, null, 1);
  k.ell(0.015, 0.02, 0.01, [0, 0.8, 0.178], 0xb25e50, null, 0);
  k.ell(0.31, 0.21, 0.2, [0, 1.04, 0.0], SK, null, 1);
  k.both((s) => k.ell(0.12, 0.08, 0.05, [s * 0.11, 1.0, 0.15], SKD, [0, s * 0.3, 0], 1));
  k.box(0.11, 0.66, 0.04, [0, 0.98, 0.17], HIDE, [0.05, 0, -0.65]);
  for (let i = 0; i < 5; i++) { const t = (i - 2) * 0.12; k.ell(0.015, 0.015, 0.012, [Math.sin(0.65) * t * 1.0, 0.98 + Math.cos(0.65) * t, 0.2 - Math.abs(t) * 0.12], GOLD, null, 0); }
  k.torus(0.14, 0.012, [0, 1.12, 0.07], LEATHER_D, [Math.PI / 2 + 0.55, 0, 0], 1, 12);
  k.row([-0.1, 1.06, 0.18], [0.1, 1.06, 0.18], 5, [0, -1, 0.2], 0.06, 0.018, TEETH, 4);
  // head: big, with THE EYE filling the face
  k.bone(B.HEAD, NECK, () => {
    k.ell(0.2, 0.19, 0.18, [0, 1.32, 0.05], SK, null, 2);
    k.box(0.26, 0.09, 0.15, [0, 1.19, 0.11], SK);
    k.box(0.18, 0.028, 0.03, [0, 1.18, 0.19], MOUTH);
    k.row([-0.05, 1.188, 0.2], [0.05, 1.188, 0.2], 4, [0, -1, 0.1], 0.016, 0.009, TEETH);
    k.box(0.19, 0.02, 0.035, [0, 1.162, 0.19], SKD); // lower lip
    k.ell(0.05, 0.035, 0.045, [0, 1.235, 0.28], SKD, null, 1); // nose
    k.ell(0.165, 0.145, 0.09, [0, 1.35, 0.22], 0xfffcf4, null, 2);
    // red veins on the white
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; k.box(0.05, 0.006, 0.006, [Math.cos(a) * 0.125, 1.35 + Math.sin(a) * 0.11, 0.285 - 0.03], 0xf06a6a, [0, -Math.cos(a) * 0.6, a]); }
    k.torus(0.088, 0.012, [0, 1.35, 0.3], 0xb8500e, [0, 0, 0], 1, 14); // dark iris ring
    k.eye([0, 1.35, 0.28], 0.09, 0xffa21a);
    k.ell(0.04, 0.058, 0.014, [0, 1.35, 0.345], DARK, null, 1);
    k.ell(0.016, 0.016, 0.008, [0.03, 1.39, 0.348], 0xffffff, null, 0, true); // highlight
    // heavy lids, lashes, the big brow
    k.ell(0.165, 0.07, 0.11, [0, 1.47, 0.22], SKD, [-0.25, 0, 0], 1);
    k.ell(0.17, 0.045, 0.1, [0, 1.225, 0.21], SK, [0.2, 0, 0], 1);
    for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.06; k.cone([x, 1.43 - Math.abs(i - 2) * 0.02, 0.3], [x * 1.25, 1.47 - Math.abs(i - 2) * 0.02, 0.35], 0.012, 0x6a3a30, 3); }
    k.box(0.38, 0.06, 0.09, [0, 1.52, 0.24], SKD, [0.35, 0, 0]);
    // horn with ridges
    k.tube([[0, 1.49, 0.06], [0, 1.61, 0.03], [0, 1.68, -0.07]], (t) => 0.06 * (1 - t) + 0.006, (t) => (t > 0.55 ? 0xfff4dc : Math.sin(t * 40) > 0 ? 0xd8c49c : 0xc0aa80), { seg: 6, n: 8 });
    // braided ponytail with gold bands
    k.tube([[0, 1.45, -0.1], [0, 1.36, -0.18], [0, 1.2, -0.2], [0, 1.06, -0.18]], (t) => 0.04 - t * 0.02, (t) => (Math.sin(t * 36) > 0 ? HAIR : 0xa84a2c), { seg: 6, n: 10 });
    for (const y of [1.33, 1.16]) k.torus(0.035, 0.01, [0, y, -0.195], GOLD, [Math.PI / 2 + 0.2, 0, 0], 1, 8);
  });
  // left arm (+x): forward, big open hand with fingers, gold armlet and wrist wrap
  k.bone(B.ARM_L, [0.33, 1.12, -0.02], () => {
    k.chain([[0.33, 1.12, -0.02], [0.43, 0.88, 0.08], [0.38, 0.72, 0.28]], [0.1, 0.085, 0.07], SK);
    k.torus(0.095, 0.018, [0.39, 0.98, 0.04], GOLD, [Math.PI / 2, 0, -0.4], 1, 12);
    k.limb([0.405, 0.78, 0.18], [0.39, 0.745, 0.24], 0.074, 0.07, LEATHER_D, 10);
    k.ell(0.09, 0.09, 0.1, [0.37, 0.7, 0.31], SKD, null, 1);
    for (let i = 0; i < 4; i++) k.limb([0.32 + i * 0.035, 0.66, 0.37], [0.32 + i * 0.037, 0.6, 0.42], 0.022, 0.018, SK, 6);
    k.limb([0.3, 0.71, 0.32], [0.26, 0.69, 0.38], 0.024, 0.02, SK, 6);
  });
  // right arm (-x): raises a BIG mossy boulder overhead (boulder rides on ARM_R)
  k.bone(B.ARM_R, [-0.33, 1.12, -0.02], () => {
    k.chain([[-0.33, 1.12, -0.02], [-0.46, 1.26, 0.06], [-0.4, 1.48, 0.0]], [0.1, 0.085, 0.075], SK);
    k.torus(0.09, 0.018, [-0.4, 1.2, 0.03], GOLD, [Math.PI / 2, 0, 0.9], 1, 12);
    k.limb([-0.44, 1.36, 0.04], [-0.42, 1.43, 0.01], 0.078, 0.076, LEATHER_D, 10);
    k.ell(0.09, 0.09, 0.09, [-0.38, 1.52, 0.0], SKD, null, 1);
    k.rock(0.24, [-0.3, 1.68, -0.08], ROCK, [1, 0.88, 1], 1);
    k.rock(0.07, [-0.12, 1.75, -0.02], ROCK, [1, 0.8, 1]);
    for (let i = 0; i < 4; i++) { const a = i * 1.5; k.cone([-0.3 + Math.cos(a) * 0.12, 1.86, -0.08 + Math.sin(a) * 0.1], [-0.3 + Math.cos(a) * 0.18, 1.9, -0.08 + Math.sin(a) * 0.16], 0.03, 0x8ad84a, 3, 0.5); }
  });
  return finish(k, { scale: 0.92 });
}

// ---------------------------------------------------------------- hydra
function hydra() {
  const k = nkit(71);
  // emerald scales, cream belly, flame-orange spines + frills; five BIG necks fanned wide
  // R7: scale bands on the body, legs, necks and tail, ribbed belly plates; heads with brow ridges,
  // slit pupils, nostrils, rows of teeth (a forked tongue on the middle head); dorsal fins down each
  // neck, tail spines and a spade tip, three cream claws per foot
  const scaleT = (p) => Math.sin(p.x * 38 + Math.sin(p.z * 32) * 2) * Math.sin(p.z * 38) > 0.25;
  const SC = banded(byN(0x34c890, 0x1ea078, 0xf4e098, 0.25, -0.35), 0.86, (p, n) => n.y > -0.35 && scaleT(p));
  const BEL = 0xf4e098, BELD = 0xd8bc72, CLAW = 0xfff4dc;
  const SPIKE = (y0) => (p) => (p.y > y0 ? 0xffb436 : 0xf0602e);
  k.setBody([0, 0.36, -0.1]);
  k.ell(0.36, 0.27, 0.5, [0, 0.4, -0.14], (p, n) => (n.y < -0.35 ? (Math.sin(p.z * 40) > 0 ? BEL : BELD) : SC(p, n)), null, 1);
  k.ell(0.29, 0.24, 0.21, [0, 0.47, 0.2], SC, [-0.3, 0, 0], 1);
  for (let i = 0; i < 4; i++) {
    const z = 0.12 - i * 0.2, y = 0.62 - Math.pow(Math.abs(z + 0.1) / 0.5, 2) * 0.12;
    k.cone([0, y - 0.04, z], [0, y + 0.16 - Math.abs(i - 1.5) * 0.02, z - 0.12], 0.085, SPIKE(y + 0.05), 4, 0.4);
    k.both((s) => k.cone([s * 0.1, y - 0.06, z - 0.04], [s * 0.14, y + 0.03, z - 0.12], 0.04, 0xf0602e, 3, 0.4));
  }
  const LEGC = banded(byN(0x30b88a, 0x1e966e, 0x16785a), 0.86, (p) => Math.sin(p.y * 70) > 0.4);
  k.both((s) => {
    for (const [z, fz] of [[0.18, 0.3], [-0.42, -0.36]]) {
      const bone = z > 0 ? (s > 0 ? B.LEG_FL : B.LEG_FR) : (s > 0 ? B.LEG_BL : B.LEG_BR);
      k.bone(bone, [s * 0.28, 0.34, z], () => {
        k.limb([s * 0.28, 0.34, z], [s * 0.37, 0.2, z + 0.06], 0.11, 0.085, LEGC, 8, false);
        k.ell(0.085, 0.085, 0.085, [s * 0.37, 0.2, z + 0.06], LEGC, null, 1);
        k.cone([s * 0.4, 0.22, z + 0.04], [s * 0.47, 0.25, z - 0.04], 0.03, 0xf0602e, 3, 0.4); // elbow spur
        k.limb([s * 0.37, 0.2, z + 0.06], [s * 0.35, 0.05, fz], 0.085, 0.075, LEGC, 8, false);
        k.ell(0.1, 0.055, 0.12, [s * 0.35, 0.045, fz + 0.05], 0x2a9a64, null, 1);
        k.row([s * 0.3, 0.035, fz + 0.15], [s * 0.4, 0.035, fz + 0.15], 3, [0, -0.3, 1], 0.06, 0.018, CLAW, 4);
      });
    }
  });
  // thick tail curling to the side with orange spines and a spade tip
  const tailc = (t, d) => (d.y < -0.4 ? (Math.sin(t * 50) > 0 ? BEL : BELD) : d.y > 0.3 ? (Math.sin(t * 50) > 0 ? 0x34c890 : 0x2cb080) : 0x1ea078);
  k.bone(B.TAIL, [0, 0.36, -0.55], () => {
    const tp = [[0, 0.36, -0.55], [0, 0.2, -0.78], [0.12, 0.08, -0.94], [0.3, 0.05, -0.98], [0.42, 0.04, -0.88]];
    k.tube(tp, (t) => 0.17 * (1 - t) + 0.02, tailc, { seg: 8, n: 14 });
    const cur = new THREE.CatmullRomCurve3(tp.map((p) => V(...p)), false, 'catmullrom', 0.5);
    for (let i = 0; i < 4; i++) { const t = 0.12 + i * 0.2, p = cur.getPoint(t), r = 0.17 * (1 - t) + 0.02; k.cone([p.x, p.y + r * 0.8, p.z], [p.x, p.y + r * 0.8 + 0.1 - i * 0.015, p.z - 0.05], 0.035, 0xff9a36, 3, 0.4); }
    k.cone([0.4, 0.04, -0.9], [0.52, 0.05, -0.8], 0.07, 0xf0602e, 4, 0.3);
  });
  // five thick necks, big heads
  const neckc = (t, d) => (d.y < -0.45 ? (Math.sin(t * 60) > 0 ? BEL : BELD) : d.y > 0.2 ? (Math.sin(t * 60) > 0 ? 0x34c890 : 0x2cb484) : 0x1ea078);
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
    const np = [h.b, h.m, mid2, h.t];
    k.tube(np, (t) => 0.12 - t * 0.045, neckc, { seg: 8, n: 10, capEnd: false });
    // small dorsal fins on the back of the neck
    const cur = new THREE.CatmullRomCurve3(np.map((p) => V(...p)), false, 'catmullrom', 0.5);
    for (let j = 0; j < 3; j++) {
      const t = 0.3 + j * 0.2, p = cur.getPoint(t), tg = cur.getTangent(t);
      const back = V(-tg.x, 0, -tg.z).normalize().multiplyScalar(-1); // away from the front
      const up = V(0, 1, 0).addScaledVector(V(0, 0, -1), 0.6).normalize(), r = 0.12 - t * 0.045;
      const b0 = p.clone().addScaledVector(up, r * 0.85);
      k.cone(b0.toArray(), b0.clone().addScaledVector(up, 0.08).addScaledVector(back, 0.0).add(V(0, 0, -0.04)).toArray(), 0.03, 0xffa03a, 3, 0.4);
    }
    const dir = [h.t[0] * 0.6, -0.2, 1];
    k.aim(h.t, dir, () => k.at([0, 0, 0], null, 1.95, () => {
      k.ell(0.075, 0.065, 0.09, [0, 0.01, 0.0], HC, null, 2);
      k.limb([0, 0.02, 0.05], [0, 0.0, 0.18], 0.055, 0.032, HC, 8);
      // lower jaw, open red mouth, rows of teeth
      k.limb([0, -0.04, 0.03], [0, -0.09, 0.15], 0.04, 0.022, JAW, 8, false);
      k.ell(0.036, 0.016, 0.06, [0, -0.04, 0.1], MOUTH, [0.35, 0, 0], 1);
      if (i === 2) { k.cone([0, -0.05, 0.1], [0.012, -0.075, 0.22], 0.008, 0xff5a7a, 3); k.cone([0, -0.05, 0.1], [-0.012, -0.075, 0.22], 0.008, 0xff5a7a, 3); }
      k.both((s) => {
        k.gem([s * 0.048, 0.042, 0.062], 0.024, i === 2 ? 0xff5a2a : 0xffd82a);
        k.ell(0.004, 0.014, 0.004, [s * 0.05, 0.043, 0.078], 0x2a2a3a, [0, s * 0.5, 0], 0); // slit pupil
        k.cone([s * 0.03, 0.06, 0.04], [s * 0.065, 0.075, 0.09], 0.016, 0x18906a, 3, 0.5); // brow ridge
        k.ell(0.006, 0.005, 0.005, [s * 0.016, 0.018, 0.18], 0x14583e, null, 0); // nostril
        k.row([s * 0.03, -0.012, 0.16], [s * 0.04, -0.015, 0.06], 4, [0, -1, 0], 0.022, 0.006, TEETH);
        k.row([s * 0.022, -0.07, 0.13], [s * 0.03, -0.055, 0.06], 3, [0, 1, 0], 0.018, 0.006, TEETH);
        // big orange cheek frill + backswept golden horn with a second horn
        k.cone([s * 0.05, 0.05, -0.02], [s * 0.09, 0.11, -0.14], 0.026, 0xffc04a, 5);
        k.cone([s * 0.03, 0.06, -0.01], [s * 0.045, 0.12, -0.08], 0.014, 0xffd87a, 4);
        k.cone([s * 0.06, -0.01, -0.03], [s * 0.17, -0.0, -0.12], 0.045, 0xff7a30, 3, 0.4);
        k.cone([s * 0.055, -0.03, -0.02], [s * 0.14, -0.06, -0.1], 0.03, 0xf0602e, 3, 0.4);
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
