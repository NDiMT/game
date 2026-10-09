import * as THREE from 'three';
import { BONE as RB, ensureRig, tagRange } from './rig.js?v=0.8';

// =====================================================================
// HEX REALMS: Necropolis creatures (procedural, vertex-coloured).
// necroModel(id) -> { body: BufferGeometry, glow: BufferGeometry|null }
// ids: skeleton, zombie, wight, vampire, lich, blackknight, bonedragon
// (upgrade ids such as 'skelwarrior' fall back to their base creature).
// Creatures stand on y = 0, face +Z, and are about 1 unit tall
// (black knight and bone dragon about 1.4).
//
// Round 4 (mobile readability): every creature is built by ONE builder
// with an `up` flag, so the upgrade (units_necro_up.js) keeps exactly the
// same silhouette identity and only grows grander. Chunky proportions,
// heads ~1.35x, bold 2-3 colour blocks per model, light-top / dark-under
// value bands, no micro detail (nothing below ~3 % of model height unless
// it is an identity feature: eye glow, fangs).
//   necroBuild(baseId, up) -> { body, glow }   (shared with units_necro_up.js)
//
// Round 5 (animation rig): every part is tagged with a rig.js bone + pivot
// through k.R(spec, fn): parts added inside fn get spec = [bone, pivot] (pivot
// in pre-scale model units; bake() scales it) or spec = fn(centroid) ->
// [bone, pivot] per triangle (used to split one surface into two bones without
// changing its geometry). k.R calls nest; untagged parts are static (ROOT).
// bake() writes the tags with rig.js tagRange, so body AND glow carry aBone/aPivot.
// =====================================================================

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const C = (h) => new THREE.Color(h);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const grad = (lo, hi, y0, y1) => { const a = C(lo), b = C(hi), t = new THREE.Color(); return (p) => t.copy(a).lerp(b, smooth(y0, y1, p.y)); };
const lerp3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
const mat = (pos = [0, 0, 0], rot = [0, 0, 0], s = 1) =>
  new THREE.Matrix4().compose(new V3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), typeof s === 'number' ? new V3(s, s, s) : new V3(...s));

// ---------------------------------------------------------------- kit
function nkit(seed) {
  const r = rng(seed);
  const B = [], G = [];
  let M = new THREE.Matrix4();
  const stack = [];
  let cur = null;
  const k = {
    r,
    R(spec, fn) { const prev = cur; cur = spec; fn(); cur = prev; },
    T(pos, rot, s, fn) { stack.push(M); M = M.clone().multiply(mat(pos, rot, s)); fn(); M = stack.pop(); },
    add(g, c, o = {}) {
      const ng = g.index ? g.toNonIndexed() : g;
      if (ng.attributes.uv) ng.deleteAttribute('uv');
      if (ng.attributes.normal) ng.deleteAttribute('normal');
      ng.applyMatrix4(M);
      (o.glow ? G : B).push({ g: ng, c, ds: o.ds, sh: o.sh ?? 1, rig: cur });
      return ng;
    },
    box(w, h, d, pos, c, rot = [0, 0, 0], o) { return k.add(new THREE.BoxGeometry(w, h, d).applyMatrix4(mat(pos, rot)), c, o); },
    ball(rad, pos, c, s = [1, 1, 1], det = 1, rot = [0, 0, 0], o) { return k.add(new THREE.IcosahedronGeometry(rad, det).applyMatrix4(mat(pos, rot, s)), c, o); },
    // tapered cylinder from a (radius ra) to b (radius rb)
    limb(a, b, ra, rb, c, seg = 6, o) {
      const va = new V3(...a), vb = new V3(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(rb, ra, len, seg, 1, rb === 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), vb.clone().sub(va).normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      return k.add(g, c, o);
    },
    spike(a, b, rad, c, seg = 5, o) { return k.limb(a, b, rad, 0, c, seg, o); },
    // poly-line of limbs, optional chunky joint balls
    chain(pts, radii, c, seg = 6, joints = false, o) {
      for (let i = 0; i < pts.length - 1; i++) {
        k.limb(pts[i], pts[i + 1], radii[i], radii[i + 1], c, seg, o);
        if (joints && i > 0) k.ball(radii[i] * 1.2, pts[i], c, [1, 1, 1], 0, [0, 0, 0], o);
      }
    },
    torus(R, tube, arc, pos, rot, c, s = 1, rs = 4, ts = 10, o) {
      return k.add(new THREE.TorusGeometry(R, tube, rs, ts, arc).applyMatrix4(mat(pos, rot, s)), c, o);
    },
    // lathe: profile [[radius, y], ...] bottom -> top; jag roughens the first ring (a hem)
    lathe(prof, seg, pos, c, o = {}) {
      const { phi0 = 0, phiLen = TAU, jag = 0, s = 1, rot = [0, 0, 0], wob = 0 } = o;
      const pos3 = [], idx = [], cols = seg + 1;
      for (let i = 0; i < prof.length; i++) for (let j = 0; j < cols; j++) {
        const th = phi0 + (j / seg) * phiLen;
        let [rad, y] = prof[i];
        if (i === 0 && jag) y += (j % 2 ? -jag * (0.6 + 0.4 * r()) : jag * 0.3 * r());
        if (wob) rad *= 1 + (r() - 0.5) * wob;
        pos3.push(rad * Math.sin(th), y, rad * Math.cos(th));
      }
      if (phiLen >= TAU - 1e-6) for (let i = 0; i < prof.length; i++) { const a = i * cols, b = a + seg; for (let q = 0; q < 3; q++) pos3[b * 3 + q] = pos3[a * 3 + q]; }
      for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) {
        const a = i * cols + j, b = a + 1, d = a + cols, cc = d + 1;
        idx.push(a, b, d, b, cc, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3)); g.setIndex(idx);
      g.applyMatrix4(mat(pos, rot, s));
      return k.add(g, c, o);
    },
    // parametric surface f(u,v) -> [x,y,z]
    surf(f, nu, nv, c, o = {}) {
      const p = [], idx = [];
      for (let i = 0; i <= nv; i++) for (let j = 0; j <= nu; j++) p.push(...f(j / nu, i / nv));
      for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
        const a = i * (nu + 1) + j, b = a + 1, d = a + nu + 1, cc = d + 1;
        idx.push(a, d, b, b, d, cc);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx);
      return k.add(g, c, o);
    },
    tris(list, c, o = {}) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(list.flat(2), 3));
      return k.add(g, c, o);
    },
  };
  k.B = B; k.G = G;
  return k;
}

// merge into one geometry: vertex colours with a broad value band (lit top,
// mid body, plum-tinted darker underside, never black) and a light sky lift
const SHADE = C(0x6a5a9a);
function bake(parts, glow, r, scale, top) {
  const pos = [], nor = [], col = [], uv = [];
  const p = new V3(), n = new V3(), t = new THREE.Color();
  const a = new V3(), b = new V3(), c = new V3(), e = new V3(), ctr = new V3();
  const tags = [];
  for (const part of parts) {
    const start = pos.length / 3, perTri = typeof part.rig === 'function';
    const arr = part.g.attributes.position.array;
    const passes = part.ds ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < arr.length; i += 9) {
        a.fromArray(arr, i); b.fromArray(arr, i + 3); c.fromArray(arr, i + 6);
        const tri = pass ? [a, c, b] : [a, b, c];
        n.subVectors(tri[1], tri[0]).cross(e.subVectors(tri[2], tri[0]));
        if (n.lengthSq() < 1e-14) continue;
        n.normalize();
        if (perTri) tags.push([pos.length / 3, 3, ...part.rig(ctr.copy(a).add(b).add(c).multiplyScalar(1 / 3))]);
        const jit = glow ? 1 : 1 + (r() - 0.5) * 0.05;
        for (const v of tri) {
          p.copy(v);
          if (typeof part.c === 'function') t.copy(part.c(p, n)); else t.set(part.c);
          if (!glow) {
            const h = smooth(0.0, top, p.y);
            t.lerp(SHADE, 0.14 * (1 - smooth(0, 0.35 * top, p.y)));         // coloured (lilac) foot shade
            const band = 0.84 + 0.22 * h;                                    // value band: dark-ish under, light top
            const sky = 0.95 + 0.1 * n.y;
            t.multiplyScalar(band * sky * jit * part.sh);
            const l = t.r * 0.3 + t.g * 0.55 + t.b * 0.15;                   // floor: no murk
            if (l < 0.07) { const f = (0.07 - l) / 0.07; t.r += 0.035 * f; t.g += 0.025 * f; t.b += 0.05 * f; }
          }
          pos.push(p.x * scale, p.y * scale, p.z * scale);
          nor.push(n.x, n.y, n.z);
          col.push(t.r, t.g, t.b);
          if (!glow) {
            const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
            if (ay >= ax && ay >= az) uv.push(p.x * scale, p.z * scale);
            else if (ax >= az) uv.push(p.z * scale, p.y * scale);
            else uv.push(p.x * scale, p.y * scale);
          }
        }
      }
    }
    if (part.rig && !perTri && pos.length / 3 > start) tags.push([start, pos.length / 3 - start, ...part.rig]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (!glow) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ensureRig(THREE, geo);
  for (const [st, cnt, bn, pv] of tags) tagRange(THREE, geo, st, cnt, bn, [pv[0] * scale, pv[1] * scale, pv[2] * scale]);
  geo.computeBoundingSphere();
  return geo;
}
const finish = (k, scale = 1, top = 1.1) => ({ body: bake(k.B, false, k.r, scale, top), glow: k.G.length ? bake(k.G, true, k.r, scale, top) : null });

// ---------------------------------------------------------------- palette
const BONE = 0xfaf0d4, BONE_M = 0xe0cea2, BONE_D = 0xbca47a;
const CRIM = 0xd0283e, CRIM_D = 0x96203a, CRIM_L = 0xf8505a;
const VIO = 0x7c4cbc, VIO_D = 0x56358c, VIO_L = 0xb88ce8;
const PLUM = 0x6a3e86;          // dark-ish interior behind ribs (value contrast, not black)
const SOCK = 0x4c2a5e;          // eye sockets / mouths: small dark accents only
const GOLD = 0xf6c64e, GOLD_D = 0xc88e2c;
const STEEL = 0xa8acc8, STEEL_L = 0xe6e8f4, STEEL_D = 0x74769a;
const GREEN_G = 0x5aff7a, LIME_G = 0xc0ff4a, RED_G = 0xff3a2a, CYAN_G = 0x7aeaff, PURP_G = 0xc070ff;
const GLOW = { glow: true };
const bone = grad(BONE_M, BONE, 0.1, 1.1);
const steel = grad(STEEL_D, STEEL_L, 0.4, 1.3);
const glowEye = (k, pos, r, c) => k.ball(r, pos, c, [1, 1, 0.7], 0, [0, 0, 0], GLOW);

// big, bold skull centred at pos facing +z; s = cranium radius. Few big parts:
// cranium, face block, two dark sockets with glowing eyes, dark grin slot, jaw.
function skull(k, pos, s, eye = GREEN_G, o = {}) {
  const { jawOpen = 0.2, col = BONE, rot = [0, 0, 0], eyeR = 0.24 } = o;
  k.T(pos, rot, 1, () => {
    k.ball(s, [0, 0.12 * s, -0.1 * s], col, [1.02, 1, 1.1], 1);
    k.box(1.42 * s, 0.7 * s, 0.82 * s, [0, -0.3 * s, 0.36 * s], col);                 // face block (cheeks + brow)
    for (const x of [-1, 1]) {
      k.ball(0.33 * s, [x * 0.37 * s, -0.12 * s, 0.72 * s], SOCK, [1, 0.95, 0.45], 0);
      glowEye(k, [x * 0.37 * s, -0.12 * s, 0.8 * s], eyeR * s, eye);
    }
    k.box(0.26 * s, 0.22 * s, 0.1 * s, [0, -0.44 * s, 0.77 * s], SOCK, [0, 0, Math.PI / 4]); // nose
    k.box(1.0 * s, 0.14 * s, 0.1 * s, [0, -0.66 * s, 0.74 * s], SOCK);                    // grin slot
    k.T([0, -0.62 * s, 0.1 * s], [jawOpen, 0, 0], 1, () => k.box(1.16 * s, 0.3 * s, 0.76 * s, [0, -0.2 * s, 0.32 * s], col));
  });
}
// unlit flame: bright core plus a few fat tongues
function flame(k, pos, size, core, mid, n = 5) {
  k.ball(size * 0.5, [pos[0], pos[1] + size * 0.2, pos[2]], core, [1, 1.2, 1], 0, [0, 0, 0], GLOW);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + k.r(), rr = size * 0.4, h = size * (1.0 + k.r() * 0.8);
    const b = [pos[0] + Math.sin(a) * rr, pos[1], pos[2] + Math.cos(a) * rr];
    k.spike(b, [b[0] + Math.sin(a) * rr * 0.4, pos[1] + h, b[2] + Math.cos(a) * rr * 0.4], size * 0.36, i % 2 ? mid : core, 4, GLOW);
  }
}
// torn hem triangles under a surface f(u, v) at v = 1
function ragHem(f, n, depth, r) {
  const tris = [];
  for (let i = 0; i < n; i++) {
    const a = f(i / n, 1), b = f((i + 1) / n, 1), m = f((i + 0.5) / n, 1);
    tris.push([a, b, [m[0], m[1] - depth * (0.6 + 0.4 * r()), m[2]]]);
  }
  return tris;
}

// =====================================================================
// SKELETON (up: Skeleton Warrior)
// identity: big bare skull + white ribcage over a plum core, big sword + round crimson shield
// up: steel-and-gold plumed helm, pauldrons, greaves, gold-rimmed shield, crimson cape, rune blade
// =====================================================================
function skeleton(up) {
  const k = nkit(up ? 111 : 11);
  // legs: chunky bones, big feet
  for (const x of [-1, 1]) k.R([x < 0 ? RB.LEG_FL : RB.LEG_FR, [x * 0.09, 0.46, 0]], () => {
    const hip = [x * 0.09, 0.46, 0], knee = [x * 0.115, 0.25, x < 0 ? 0.05 : -0.01], ank = [x * 0.1, 0.07, x < 0 ? 0.05 : -0.03];
    k.box(0.11, 0.07, 0.19, [ank[0], 0.035, ank[2] + 0.04], up ? steel : BONE_M);
    k.limb(ank, knee, 0.036, 0.042, bone, 5);
    k.limb(knee, hip, 0.044, 0.048, bone, 5);
    if (up) { k.limb(lerp3(ank, knee, 0.05), lerp3(ank, knee, 0.9), 0.058, 0.064, steel, 6); k.ball(0.062, knee, GOLD, [1, 1, 0.9], 0); }
    else k.ball(0.055, knee, BONE_M, [1, 1, 1], 0);
  });
  k.R([RB.BODY, [0, 0.47, 0]], () => {
  // pelvis + crimson loincloth (front and back flaps) / up: crimson tabard skirt with gold hem
  k.ball(0.13, [0, 0.47, 0], BONE_M, [1.1, 0.55, 0.85], 1);
  if (up) k.R([RB.CLOTH, [0, 0.52, 0]], () => {
    k.lathe([[0.2, 0.28], [0.18, 0.4], [0.15, 0.52]], 10, [0, 0, 0], grad(CRIM_D, CRIM_L, 0.28, 0.5), { jag: 0.05, ds: true, phi0: 0.5, phiLen: TAU - 1.0 });
    k.lathe([[0.21, 0.27], [0.205, 0.32]], 10, [0, 0, 0], GOLD, { ds: true, phi0: 0.5, phiLen: TAU - 1.0 });
  }); else k.R([RB.CLOTH, [0, 0.5, 0]], () => {
    k.box(0.17, 0.22, 0.03, [0, 0.36, 0.1], grad(CRIM_D, CRIM, 0.25, 0.47), [-0.12, 0, 0]);
    k.box(0.19, 0.24, 0.03, [0, 0.35, -0.1], grad(CRIM_D, CRIM, 0.25, 0.47), [0.12, 0, 0]);
  });
  k.box(0.3, 0.05, 0.22, [0, 0.5, 0], up ? GOLD_D : 0x9a6038);                          // belt
  // spine, plum chest core, three thick ribs, sternum
  k.limb([0, 0.48, -0.06], [0, 0.88, -0.06], 0.036, 0.036, BONE_M, 5);
  k.ball(0.125, [0, 0.71, -0.02], PLUM, [1.05, 1.2, 0.78], 1);
  for (let i = 0; i < 3; i++) {
    const y = 0.8 - i * 0.085, R = 0.165 - i * 0.012, gap = 0.7, L = TAU - gap, beta = (L + gap / 2) - Math.PI / 2;
    k.add(new THREE.TorusGeometry(R, 0.03, 4, 10, L).rotateX(Math.PI / 2).rotateY(beta).scale(1, 1, 0.82).rotateX(-0.2).translate(0, y, -0.01), BONE);
  }
  k.box(0.055, 0.24, 0.045, [0, 0.72, 0.13], BONE, [-0.12, 0, 0]);
  k.limb([-0.2, 0.87, -0.02], [0.2, 0.87, -0.02], 0.034, 0.034, BONE_M, 5);               // collarbone bar
  if (up) {
    k.lathe([[0.13, 0.62], [0.17, 0.72], [0.17, 0.8]], 8, [0, 0, -0.01], steel, { phi0: -1.0, phiLen: 2.0, ds: true });   // half breastplate (ribs show above)
    k.lathe([[0.175, 0.795], [0.17, 0.82]], 8, [0, 0, -0.01], GOLD, { phi0: -1.0, phiLen: 2.0, ds: true });
    for (const x of [-1, 1]) {
      k.ball(0.1, [x * 0.21, 0.9, 0], steel, [1.1, 0.7, 1.05], 1);
      k.torus(0.095, 0.016, TAU, [x * 0.21, 0.87, 0], [Math.PI / 2, 0, x * 0.25], GOLD, [1.1, 1, 1], 3, 10);
    }
    // crimson cape with a torn hem
    const cape = (u, v) => { const a = (u - 0.5) * 2.3; return [Math.sin(a) * (0.18 + v * 0.1), 0.9 - v * 0.58, -Math.cos(a) * (0.11 + v * 0.06) - 0.07 - v * 0.1]; };
    k.R([RB.CLOTH, [0, 0.9, -0.18]], () => {
      k.surf(cape, 6, 2, grad(CRIM_D, CRIM, 0.3, 0.9), { ds: true });
      k.tris(ragHem(cape, 5, 0.08, k.r), CRIM, { ds: true });
    });
  } else {
    for (const x of [-1, 1]) k.ball(0.058, [x * 0.21, 0.87, 0], BONE_M, [1, 1, 1], 0);
  }
  });
  // sword arm (right, +x)
  const sh = [0.21, 0.87, 0], el = [0.28, 0.67, 0.06], hd = [0.28, 0.64, 0.24];
  k.R([RB.ARM_R, sh], () => {
  k.limb(sh, el, 0.04, 0.036, bone, 5); k.ball(0.046, el, up ? steel : BONE_M, [1, 1, 1], 0);
  k.limb(el, hd, up ? 0.05 : 0.036, up ? 0.054 : 0.032, up ? steel : bone, 5);
  k.ball(0.052, hd, BONE, [1, 1.1, 1], 0);
  k.T(hd, [0.55, 0.1, 0], 1, () => {
    k.limb([0, -0.09, 0], [0, 0.06, 0], 0.024, 0.024, CRIM_D, 5);
    k.ball(0.04, [0, -0.1, 0], up ? GOLD : STEEL_D, [1, 1, 1], 0);
    k.box(0.24, 0.05, 0.07, [0, 0.07, 0], up ? GOLD : STEEL_D);
    const L = up ? 0.6 : 0.5;
    const blade = grad(up ? 0xb4bcd8 : 0xa8aab8, up ? 0xf8faff : 0xe8e4dc, 0.1, L);
    k.box(0.12, L, 0.03, [0, 0.09 + L / 2, 0], blade);
    k.add(new THREE.ConeGeometry(0.085, 0.13, 4).scale(1, 1, 0.3).rotateY(Math.PI / 4).translate(0, 0.09 + L + 0.065, 0), blade);
    if (up) k.box(0.03, L * 0.8, 0.036, [0, 0.09 + L * 0.45, 0], GREEN_G, [0, 0, 0], GLOW);
  });
  });
  // shield arm (left): big round crimson shield with bone (up: gold) rim and boss
  k.R([RB.ARM_L, [-0.21, 0.87, 0]], () => {
  k.limb([-0.21, 0.87, 0], [-0.28, 0.68, 0.05], 0.04, 0.036, bone, 5);
  k.limb([-0.28, 0.68, 0.05], [-0.25, 0.6, 0.18], 0.036, 0.034, up ? steel : bone, 5);
  k.T([-0.27, 0.6, 0.23], [Math.PI / 2, -0.45, 0.12], 1, () => {
    const R = up ? 0.26 : 0.235;
    k.add(new THREE.CylinderGeometry(R, R, 0.045, 10), grad(CRIM_D, CRIM_L, -0.25, 0.25));
    k.add(new THREE.TorusGeometry(R, 0.03, 4, 10).rotateX(Math.PI / 2), up ? GOLD : BONE_M);
    for (const y of [-1, 1]) k.ball(up ? 0.08 : 0.07, [0, y * 0.025, 0], up ? GOLD : BONE, [1, 0.45, 1], 1);
    if (up) { k.box(R * 1.9, 0.05, 0.06, [0, 0, 0], GOLD_D); k.box(0.06, 0.05, R * 1.9, [0, 0, 0], GOLD_D); }
  });
  });
  // neck + BIG skull
  k.R([RB.HEAD, [0, 0.89, -0.04]], () => {
  k.limb([0, 0.87, -0.04], [0, 0.95, -0.01], 0.036, 0.036, BONE_M, 5);
  k.T([0, 1.03, 0.02], [-0.28, -0.1, 0.04], 1, () => {
    skull(k, [0, 0, 0], 0.14, GREEN_G, { jawOpen: 0.35, eyeR: 0.28 });
    if (up) {
      // open-faced steel helm, gold brow band, tall crimson crest
      k.lathe([[0.158, 0.0], [0.16, 0.06], [0.135, 0.13], [0.08, 0.175], [0.0, 0.19]], 10, [0, 0, -0.02], steel, { s: [1, 1, 1.1] });
      k.lathe([[0.165, -0.005], [0.165, 0.045]], 10, [0, 0, -0.02], GOLD, { s: [1, 1, 1.1] });
      for (const x of [-1, 1]) k.box(0.04, 0.16, 0.12, [x * 0.155, -0.06, 0.0], steel, [0, 0, x * 0.08]);
      const crest = (u, v) => [(v - 0.5) * 0.06, 0.17 + Math.sin(u * Math.PI) * 0.16, 0.14 - u * 0.42];
      k.surf(crest, 6, 1, grad(CRIM, CRIM_L, 0.2, 0.35), { ds: true });
      k.tris(ragHem((u, v) => [(v - 0.5) * 0.06, 0.17 + Math.sin(u * Math.PI) * 0.16 * (1 - v), 0.14 - u * 0.42], 4, -0.0, k.r), CRIM);
    }
  });
  });
  return finish(k, 0.9, 1.15);
}

// =====================================================================
// ZOMBIE (up: Plague Zombie)
// identity: deep forward hunch, huge drooping green head, long reaching arms
// colours: sickly green skin vs plum rags vs slate trousers; crimson wound, lime eyes
// up: bloated belly with glowing boils, violet hood, plague motes, bigger hump
// =====================================================================
function zombie(up) {
  const k = nkit(up ? 223 : 23);
  const SK = grad(0x7ea85a, 0xc4e08e, 0.25, 1.0);
  const RAG = grad(0x9a6e44, 0xd8ac72, 0.35, 0.95), PANTS = grad(0x4e5688, 0x7a84b4, 0.0, 0.5);
  // legs: knock-kneed, right one dragging
  const L = [[-0.12, 0.06, 0.1], [-0.11, 0.26, 0.08], [-0.11, 0.48, 0]];
  const R = [[0.14, 0.06, -0.13], [0.12, 0.25, -0.05], [0.11, 0.48, 0]];
  for (const leg of [L, R]) k.R([leg === L ? RB.LEG_FL : RB.LEG_FR, leg[2]], () => {
    k.box(0.11, 0.07, 0.18, [leg[0][0], 0.035, leg[0][2] + 0.04], 0x8a7a68, [0, leg === L ? 0.2 : -0.3, 0]);
    k.limb(leg[0], leg[1], 0.05, 0.058, leg === R ? SK : PANTS, 6);
    k.limb(leg[1], leg[2], 0.06, 0.075, PANTS, 6);
  });
  k.R([RB.BODY, [0, 0.5, 0]], () => {
  k.ball(0.16, [0, 0.5, 0], PANTS, [1, 0.6, 0.85], 1);
  // hunched torso
  k.T([0, 0.48, 0], [0.62, 0.12, -0.08], 1, () => {
    k.ball(0.2, [0, 0.2, 0], RAG, [1.05, 1.25, 0.9], 1);
    k.ball(up ? 0.21 : 0.18, [0, 0.36, -0.07], RAG, [1.2, 0.95, 0.95], 1);            // hump
    k.lathe([[0.22, -0.02], [0.2, 0.12]], 9, [0, 0, 0], RAG, { jag: 0.07, ds: true, s: [1, 1, 0.9] });   // ragged hem
    if (up) {
      // torn shirt on the hump: rotten skin + big glowing boils (read from behind)
      k.ball(0.12, [0.03, 0.44, -0.14], SK, [1.2, 0.8, 0.7], 1);
      for (const [x, y, z, r0] of [[0.07, 0.48, -0.22, 0.045], [-0.07, 0.42, -0.23, 0.04], [0.12, 0.36, -0.2, 0.035]]) {
        k.ball(r0 * 1.3, [x, y, z], 0x6a9a3a, [1, 1, 0.7], 0);
        k.ball(r0, [x, y, z - 0.015], LIME_G, [1, 1, 0.8], 0, [0, 0, 0], GLOW);
      }
    } else {
      k.ball(0.07, [-0.05, 0.42, -0.15], SK, [1.2, 0.9, 0.7], 0);                          // rip in the shirt
    }
  });
  // bloated belly (up) / crimson wound (base)
  if (up) {
    k.ball(0.22, [0, 0.55, 0.12], SK, [1.05, 0.95, 0.95], 1);
    for (const [x, y, z, r0] of [[0.08, 0.6, 0.31, 0.045], [-0.1, 0.5, 0.29, 0.04], [0.02, 0.46, 0.32, 0.035]]) {
      k.ball(r0 * 1.3, [x, y, z], 0x6a9a3a, [1, 1, 0.7], 0);
      k.ball(r0, [x, y, z + 0.012], LIME_G, [1, 1, 0.8], 0, [0, 0, 0], GLOW);
    }
    k.torus(0.235, 0.022, TAU, [0, 0.47, 0.08], [Math.PI / 2 + 0.2, 0, 0], 0xb89a5a, 1, 3, 10);   // straining rope belt
  } else {
    k.ball(0.07, [0.06, 0.66, 0.2], CRIM, [1, 1.1, 0.5], 1);
  }
  });
  // arms: long, reaching forward
  const shL = [-0.21, 0.8, 0.12], shR = [0.19, 0.83, 0.16];
  k.R([RB.ARM_R, shR], () => k.ball(0.08, shR, RAG, [1, 1, 1], 0)); k.R([RB.ARM_L, shL], () => k.ball(0.08, shL, RAG, [1, 1, 1], 0));
  k.R([RB.ARM_R, shR], () => {
  k.limb(shR, [0.24, 0.76, 0.38], 0.068, 0.058, RAG, 6);
  k.limb([0.24, 0.76, 0.38], [0.24, 0.74, 0.58], 0.05, 0.044, SK, 6);
  k.ball(0.065, [0.24, 0.73, 0.62], SK, [1, 0.7, 1.25], 0);                              // mitten hand
  k.spike([0.24, 0.73, 0.64], [0.25, 0.68, 0.74], 0.045, 0x9ab870, 4);                 // claw wedge
  });
  k.R([RB.ARM_L, shL], () => {
  k.limb(shL, [-0.26, 0.62, 0.32], 0.068, 0.058, RAG, 6);
  k.limb([-0.26, 0.62, 0.32], [-0.22, 0.58, 0.5], 0.05, 0.044, SK, 6);
  k.ball(0.062, [-0.22, 0.56, 0.54], SK, [1, 0.7, 1.25], 0);
  k.spike([-0.22, 0.56, 0.56], [-0.23, 0.5, 0.65], 0.042, 0x9ab870, 4);
  });
  // neck + BIG drooping head thrust forward
  k.R([RB.HEAD, [0, 0.82, 0.14]], () => {
  k.limb([0, 0.82, 0.14], [0.03, 0.84, 0.28], 0.065, 0.058, SK, 6);
  k.T([0.04, 0.85, 0.36], [-0.12, 0.0, 0.14], 1, () => {
    k.ball(0.15, [0, 0.02, 0], SK, [0.95, 1.05, 1.05], 1);
    k.ball(0.1, [0, -0.09, 0.05], SK, [1.05, 0.8, 1], 1);                               // jowls
    for (const x of [-1, 1]) {
      k.ball(0.048, [x * 0.06, 0.03, 0.125], SOCK, [1, 0.9, 0.5], 0);
      glowEye(k, [x * 0.06, 0.03, 0.142], x < 0 ? 0.036 : 0.03, LIME_G);
    }
    k.box(0.1, 0.07, 0.04, [0, -0.09, 0.14], SOCK, [0.3, 0, 0.15]);                     // gaping mouth
    if (up) {
      k.spike([0.0, -0.12, 0.15], [0.01, -0.22, 0.17], 0.02, LIME_G, 4, GLOW);           // bile drool
      // violet rag hood
      k.lathe([[0.175, -0.08], [0.18, 0.03], [0.15, 0.12], [0.08, 0.18], [0, 0.2]], 9, [0, 0, -0.03], grad(VIO_D, VIO, -0.05, 0.2), { phi0: 0.85, phiLen: TAU - 1.7, jag: 0.03 });
    } else {
      k.ball(0.12, [0, 0.08, -0.03], 0x7a6a50, [1.02, 0.55, 1.05], 1);                   // matted hair cap
    }
  });
  });
  if (up) for (const [x, y, z] of [[0.3, 1.0, 0.2], [-0.32, 0.9, 0.1], [0.12, 1.1, -0.1], [-0.18, 1.05, 0.35]]) k.ball(0.03, [x, y, z], LIME_G, [1, 1, 1], 0, [0, 0, 0], GLOW);
  return finish(k, up ? 1.0 : 0.96, 1.0);
}

// =====================================================================
// WIGHT (up: Wraith)
// identity: floating teardrop shroud ending in a green ghost-wisp, big hood with
// green eyes, wide sleeves with long bone claws. Pale lavender-white (lightest necro)
// up: taller, torn cloak wings, bone crown, huge scythe with glowing edge, soul-fire hand
// =====================================================================
function wight(up) {
  const k = nkit(up ? 337 : 37);
  const S = up ? 1.06 : 1;
  const SHROUD = grad(up ? 0x6e54a8 : 0x8a74c4, up ? 0xe4dcf8 : 0xf2eefc, 0.15, 0.95);
  const BP = [0, 0.55, 0];                                                                  // floating: body pivot mid-shroud
  k.R([RB.BODY, BP], () => {
  // shroud: teardrop, hem lifted, jagged
  k.lathe([[0.17, 0.2], [0.25, 0.32], [0.25, 0.48], [0.21, 0.64], [0.16, 0.78], [0.1, 0.86]].map(([r0, y]) => [r0 * S, y]), 10, [0, 0, -0.02], SHROUD, { jag: 0.09, s: [1, 1, 0.9], wob: 0.08 });
  });
  // ghost wisp tail: fat glowing cone curling back and down + a few tongues
  k.R([RB.CLOTH, [0, 0.3, -0.02]], () => {
  k.T([0, 0.25, -0.04], [0.7, 0, 0], 1, () => {
    k.add(new THREE.ConeGeometry(0.14, 0.34, 6).rotateX(Math.PI).translate(0, -0.15, 0), up ? 0x4affa0 : 0x7affb8, GLOW);
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.4, rad = 0.16;
    k.spike([Math.sin(a) * rad, 0.24, Math.cos(a) * rad * 0.85], [Math.sin(a) * rad * 0.6, 0.06 + k.r() * 0.05, Math.cos(a) * rad * 0.5 - 0.06], 0.045, 0x5affa8, 4, GLOW);
  }
  });
  // shoulder mantle
  k.R([RB.BODY, BP], () => {
  k.lathe([[0.25 * S, 0.66], [0.2 * S, 0.78], [0.11, 0.87]], 10, [0, 0, -0.02], SHROUD, { jag: 0.07, wob: 0.08 });
  if (up) {
    // torn cloak spread behind like wings
    for (const x of [-1, 1]) k.R([RB.CLOTH, [x * 0.16, 0.86, -0.1]], () => {
      const f = (u, v) => [x * (0.16 + u * 0.36), 0.86 - v * (0.5 + u * 0.15) + u * 0.12, -0.1 - u * 0.1 - v * 0.05];
      k.surf(f, 3, 2, grad(VIO_D, VIO_L, 0.3, 1.0), { ds: true });
      k.tris(ragHem(f, 3, 0.1, k.r), VIO_D, { ds: true });
    });
  }
  });
  // big hood, dark face, big green eyes
  k.R([RB.HEAD, [0, 0.84, -0.01]], () => k.T([0, 0.95, 0.0], [-0.22, 0, 0], 1, () => {
    k.lathe([[0.18, -0.12], [0.185, 0.0], [0.155, 0.12], [0.08, 0.2], [0.0, 0.23]], 10, [0, 0, -0.02], SHROUD, { phi0: 0.75, phiLen: TAU - 1.5 });
    k.spike([0, 0.17, -0.1], [0, 0.18, -0.34], 0.07, up ? 0xc8b8ec : 0xe8e4f8, 5);         // hood tip trailing back
    k.ball(0.14, [0, -0.02, -0.02], 0x3e2c64, [1, 1.05, 1], 1);                             // face void
    for (const x of [-1, 1]) glowEye(k, [x * 0.058, 0.0, 0.115], 0.04, GREEN_G);
    if (up) for (let i = 0; i < 5; i++) {                                                   // bone crown
      const a = (i / 4 - 0.5) * 2.0;
      k.spike([Math.sin(a) * 0.15, 0.1, Math.cos(a) * 0.13 - 0.02], [Math.sin(a) * 0.2, 0.26 - Math.abs(i - 2) * 0.03, Math.cos(a) * 0.16 - 0.04], 0.03, BONE, 4);
    }
  }));
  // sleeves + long bone claws
  const claws = (w, dir) => {
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.45;
      k.spike(w, [w[0] + Math.sin(a) * 0.08 * dir, w[1] - 0.02 - Math.abs(i - 1) * 0.02, w[2] + 0.15], 0.022, BONE, 4);
    }
  };
  // left: reaching forward
  k.R([RB.ARM_L, [-0.18, 0.8, 0.0]], () => {
  k.limb([-0.18, 0.8, 0.0], [-0.27, 0.66, 0.2], 0.06, 0.075, SHROUD, 6);
  k.lathe([[0.1, 0], [0.065, 0.12]], 7, [-0.28, 0.62, 0.3], SHROUD, { rot: [-1.9, 0.4, 0], jag: 0.04, ds: true });
  k.ball(0.035, [-0.29, 0.63, 0.3], BONE, [1, 1, 1], 0);
  claws([-0.29, 0.63, 0.31], -1);
  if (up) flame(k, [-0.3, 0.68, 0.38], 0.08, 0xaaffb0, 0x2ad860, 5);
  });
  // right: claw (base) / great scythe (up)
  k.R([RB.ARM_R, [0.18, 0.8, 0.0]], () => {
  k.limb([0.18, 0.8, 0.0], [0.27, 0.64, 0.14], 0.06, 0.075, SHROUD, 6);
  k.lathe([[0.1, 0], [0.065, 0.12]], 7, [0.29, 0.6, 0.22], SHROUD, { rot: [-1.6, -0.3, 0], jag: 0.04, ds: true });
  k.ball(0.035, [0.3, 0.6, 0.24], BONE, [1, 1, 1], 0);
  if (!up) claws([0.3, 0.6, 0.25], 1);
  else k.T([0.3, 0.6, 0.25], [-0.3, 0, 0.12], 1, () => {
    k.limb([0, -0.5, 0], [0, 0.66, 0], 0.026, 0.024, grad(0x6a4a6a, 0xb0a0a0, -0.4, 0.6), 5);
    k.box(0.06, 0.07, 0.06, [0, 0.64, 0], STEEL_D);
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6, a = t * 1.9; pts.push([-Math.sin(a) * 0.38, 0.66 + (1 - Math.cos(a)) * 0.13 - t * 0.16, -0.04 + Math.cos(a) * 0.04]); }
    const blade = [], edge = [];
    for (let i = 0; i < 6; i++) {
      const w0 = 0.14 * (1 - i / 7), w1 = 0.14 * (1 - (i + 1) / 7), a = pts[i], b = pts[i + 1];
      const a2 = [a[0], a[1] - w0, a[2]], b2 = [b[0], b[1] - w1, b[2]];
      blade.push([a, a2, b], [b, a2, b2]);
      edge.push([[a2[0], a2[1], a2[2] + 0.006], [a2[0], a2[1] + 0.025, a2[2] + 0.006], [b2[0], b2[1], b2[2] + 0.006]]);
    }
    k.tris(blade, grad(0xc8d4ec, 0xf4f8ff, 0.5, 0.75), { ds: true });
    k.tris(edge, 0x5affa0, { glow: true, ds: true });
  });
  });
  return finish(k, 1.0, 1.0);
}

// =====================================================================
// VAMPIRE (up: Vampire Lord)
// identity: huge bat-wing cape held out by both arms (wide triangle silhouette),
// tall flared collar, big pale head with dark-violet slicked hair, red eyes, fangs
// colours: violet cape outside / crimson inside, crimson waistcoat, pale face
// up: wider cape with gold hem, gold crown, white mane, gold epaulettes and belt
// =====================================================================
function vampire(up) {
  const k = nkit(up ? 441 : 41);
  const PALE = 0xf4ecf6, HAIR = up ? 0xf4f0f8 : 0x40305e;
  const CLOTH = grad(VIO_D, VIO, 0.2, 0.95), BOOT = grad(0x4a3668, 0x6a5290, 0.0, 0.3);
  // legs + boots
  for (const x of [-1, 1]) k.R([x < 0 ? RB.LEG_FL : RB.LEG_FR, [x * 0.085, 0.5, 0]], () => {
    const ank = [x * 0.085, 0.07, x < 0 ? 0.06 : -0.03];
    k.box(0.09, 0.07, 0.18, [ank[0], 0.035, ank[2] + 0.04], 0x4a3668);
    k.limb(ank, [x * 0.09, 0.28, ank[2] * 0.5], 0.05, 0.054, BOOT, 6);
    k.limb([x * 0.09, 0.28, ank[2] * 0.5], [x * 0.085, 0.5, 0], 0.046, 0.056, CLOTH, 6);
    if (up) k.lathe([[0.06, 0.25], [0.066, 0.3]], 6, [x * 0.09, 0, ank[2] * 0.5], GOLD_D);
  });
  // coat skirt
  k.R([RB.CLOTH, [0, 0.58, 0]], () => k.lathe([[0.19, 0.3], [0.16, 0.48], [0.14, 0.6]], 10, [0, 0, -0.01], CLOTH, { phi0: 0.6, phiLen: TAU - 1.2, ds: true, jag: 0.04 }));
  // torso: violet doublet + big crimson waistcoat block
  k.R([RB.BODY, [0, 0.5, 0]], () => {
  k.ball(0.16, [0, 0.7, 0], CLOTH, [1, 1.3, 0.78], 1);
  k.box(0.16, 0.3, 0.06, [0, 0.66, 0.09], grad(CRIM_D, CRIM_L, 0.52, 0.82), [-0.08, 0, 0]);
  k.box(0.3, 0.05, 0.2, [0, 0.54, 0.0], up ? GOLD : 0x4a3668);
  k.spike([0, 0.86, 0.08], [0, 0.74, 0.13], 0.045, 0xffffff, 5);                             // jabot
  });
  // arms raised, holding the cape out like wings
  for (const x of [-1, 1]) k.R([x < 0 ? RB.ARM_L : RB.ARM_R, [x * 0.18, 0.83, 0]], () => {
    const shd = [x * 0.18, 0.83, 0], elb = [x * 0.33, 0.86, 0.06], hnd = [x * (up ? 0.47 : 0.44), 0.98, 0.1];
    k.ball(0.065, shd, CLOTH, [1, 0.85, 1], 0);
    if (up) { k.ball(0.075, [x * 0.2, 0.87, 0], GOLD, [1.2, 0.5, 1.1], 1); }
    k.limb(shd, elb, 0.048, 0.042, CLOTH, 6);
    k.limb(elb, hnd, 0.042, 0.036, CLOTH, 6);
    k.ball(0.042, hnd, PALE, [1, 1.2, 1], 0);
  });
  // neck + BIG head
  k.R([RB.HEAD, [0, 0.86, 0]], () => {
  k.limb([0, 0.85, 0], [0, 0.93, 0.01], 0.05, 0.048, PALE, 6);
  k.T([0, 1.03, 0.02], [-0.2, 0, 0], 1, () => {
    k.ball(0.125, [0, 0, 0], PALE, [0.9, 1.08, 1], 1);
    k.spike([0, -0.05, 0.08], [0, -0.14, 0.11], 0.05, PALE, 5);                               // pointed chin
    k.ball(0.13, [0, 0.05, -0.035], HAIR, [0.96, 0.9, 1.0], 1);                             // slicked hair / mane
    k.spike([0, 0.1, 0.07], [0, 0.04, 0.135], 0.05, HAIR, 4);                                // widow's peak
    k.spike([0, 0.06, -0.1], [0, -0.06, -0.17], up ? 0.1 : 0.07, HAIR, 5);
    for (const x of [-1, 1]) {
      k.spike([x * 0.1, 0.0, 0.0], [x * 0.19, 0.08, -0.05], 0.035, PALE, 4);                // pointed ears
      k.box(0.07, 0.018, 0.03, [x * 0.045, 0.045, 0.11], 0x4a2a5a, [0, 0, x * 0.4]);       // brows
      glowEye(k, [x * 0.045, 0.015, 0.11], 0.026, RED_G);
      k.spike([x * 0.022, -0.07, 0.105], [x * 0.022, -0.115, 0.108], 0.012, 0xffffff, 3);   // fangs
    }
    k.box(0.07, 0.02, 0.02, [0, -0.065, 0.11], 0x9a1a2a);
    if (up) {                                                                                 // gold crown
      k.lathe([[0.112, 0.08], [0.118, 0.12]], 8, [0, 0, -0.01], GOLD);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; k.spike([Math.sin(a) * 0.115, 0.115, Math.cos(a) * 0.115 - 0.01], [Math.sin(a) * 0.13, 0.2 + (i === 0 ? 0.04 : 0), Math.cos(a) * 0.13 - 0.01], 0.03, GOLD, 4); }
      k.ball(0.022, [0, 0.115, 0.115], RED_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
    }
  });
  });
  // tall flared collar: violet outside, crimson inside
  const collar = (inset) => (u, v) => {
    const a = (u - 0.5) * 3.4, rad = (0.12 + v * 0.1 - inset) * (1 + Math.abs(u - 0.5) * 0.3);
    return [Math.sin(a) * rad, 0.84 + v * (up ? 0.36 : 0.3) + Math.abs(u - 0.5) * 0.08 * v, -Math.cos(a) * rad * 0.9 - 0.03];
  };
  k.R([RB.BODY, [0, 0.5, 0]], () => {
    k.surf(collar(0), 6, 1, up ? CRIM : VIO_D, { ds: true });
    k.surf(collar(0.008), 6, 1, up ? GOLD : CRIM, { ds: true });
  });
  // bat-wing cape: from the shoulders out to the raised hands, scalloped hem
  const SPAN = up ? 0.5 : 0.46, NS = 3;
  const cape = (inset) => (u, v) => {
    const s = u - 0.5, as = Math.abs(s) * 2;                                                  // 0 centre .. 1 hand
    const scallop = 1 - 0.2 * Math.sin(Math.PI * ((as * NS) % 1)) * smooth(0.55, 1, v);
    const vv = v * scallop;
    const x = Math.sign(s) * (0.12 + as * (SPAN - 0.12));
    const yTop = 0.86 + as * as * 0.12, yBot = 0.08 + as * as * 0.5;
    const y = yTop + (yBot - yTop) * vv;
    const z = -0.06 - (1 - as) * 0.12 * (0.4 + vv) + as * 0.1 + inset;
    return [x, y, z];
  };
  // the two cape halves are the bat wings (split per triangle, geometry unchanged);
  // shared pivot at the nape so the halves stay joined at the top
  const wingOf = (ctr) => [ctr.x < 0 ? RB.WING_L : RB.WING_R, [0, 0.86, -0.12]];
  k.R(wingOf, () => {
  k.surf(cape(0), 12, 3, grad(up ? CRIM_D : VIO_D, up ? CRIM_L : VIO_L, 0.1, 1.0), { ds: true });
  k.surf(cape(0.012), 12, 3, grad(up ? VIO_D : CRIM_D, up ? VIO : CRIM_L, 0.1, 0.9), { ds: true });
  if (up) {                                                                                   // gold hem
    const f = cape(-0.006), hem = [], n = 12;
    for (let i = 0; i < n; i++) { const a = f(i / n, 1), b = f((i + 1) / n, 1), a2 = f(i / n, 0.9), b2 = f((i + 1) / n, 0.9); hem.push([a, b, a2], [b, b2, a2]); }
    k.tris(hem, GOLD, { ds: true });
  }
  });
  return finish(k, 1.0, 1.1);
}

// =====================================================================
// LICH (up: Power Lich)
// identity: violet robe bell, BIG crowned skull, bone pauldrons, tall staff with a
// green orb, green fireball in the other hand. Signature: saturated violet + gold
// up: floats over a green soul pyre, gold trims, flared gold collar, tall crown,
// gold crescent staff with a bigger orb, orbiting motes
// =====================================================================
function lich(up) {
  const k = nkit(up ? 553 : 53);
  const ROBE = grad(0x56348c, 0xa47ae0, 0.0, 0.85);
  const lift = up ? 0.1 : 0;
  if (up) { flame(k, [0, 0.0, 0], 0.16, 0x9aff9a, 0x2ad860, 6); }                          // pyre: static (ROOT)
  k.T([0, lift, 0], [0, 0, 0], 1, () => {
    k.R([RB.BODY, [0, 0.3 + lift, 0]], () => {
    // robe bell with a crimson hem and front panel
    k.lathe([[0.3, 0.04], [0.27, 0.14], [0.21, 0.42], [0.17, 0.62], [0.2, 0.78], [0.1, 0.88]], 10, [0, 0, 0], ROBE, { jag: 0.05, wob: 0.06, ds: true });
    k.lathe([[0.31, 0.02], [0.285, 0.12]], 10, [0, 0, 0], up ? GOLD : CRIM, { ds: true, jag: 0.05 });
    k.box(0.13, 0.62, 0.05, [0, 0.36, 0.2], grad(CRIM_D, CRIM_L, 0.05, 0.65), [-0.13, 0, 0]);
    if (up) { k.box(0.17, 0.05, 0.06, [0, 0.66, 0.15], GOLD, [-0.13, 0, 0]); k.ball(0.04, [0, 0.66, 0.19], GREEN_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW); }
    // bone pauldrons with spikes
    for (const x of [-1, 1]) {
      k.ball(0.1, [x * 0.2, 0.82, -0.01], ROBE, [1.1, 0.75, 1], 1);
      k.ball(0.075, [x * 0.22, 0.88, 0.0], BONE, [1, 0.85, 1], 1);
      k.spike([x * 0.25, 0.9, -0.02], [x * (up ? 0.42 : 0.38), up ? 1.08 : 1.02, -0.06], 0.035, BONE_M, 5);
    }
    // high collar behind the head
    k.lathe([[0.13, 0.84], [up ? 0.22 : 0.18, up ? 1.12 : 1.04]], 6, [0, 0, -0.02], up ? grad(GOLD_D, GOLD, 0.84, 1.1) : grad(0x5a3a8a, 0xb88ce8, 0.84, 1.05), { phi0: Math.PI / 2 + 0.3, phiLen: Math.PI - 0.6, ds: true });
    });
    k.R([RB.ARM_L, [-0.2, 0.82 + lift, 0]], () => {
    // left arm: wide sleeve, bone hand, green fireball
    k.limb([-0.2, 0.82, 0], [-0.29, 0.7, 0.12], 0.07, 0.09, ROBE, 6);
    k.lathe([[0.11, 0], [0.07, 0.14]], 7, [-0.31, 0.66, 0.2], ROBE, { rot: [-2.0, 0.5, 0], ds: true, jag: 0.03 });
    k.ball(0.04, [-0.33, 0.7, 0.24], BONE, [1, 1.2, 1], 0);
    flame(k, [-0.34, 0.75, 0.28], up ? 0.12 : 0.09, 0xb0ffa0, 0x2ad860, 5);
    });
    // right arm holds the staff
    k.R([RB.ARM_R, [0.2, 0.82 + lift, 0]], () => {
    k.limb([0.2, 0.82, 0], [0.28, 0.66, 0.1], 0.07, 0.09, ROBE, 6);
    k.lathe([[0.11, 0], [0.07, 0.14]], 7, [0.3, 0.6, 0.13], ROBE, { rot: [Math.PI, 0, 0], ds: true, jag: 0.03 });
    k.ball(0.045, [0.31, 0.6, 0.16], BONE, [1, 1.2, 1], 0);
    const sx = 0.31, sz = 0.16, top = up ? 1.2 : 1.12;
    k.limb([sx, -lift + 0.0, sz], [sx, top, sz], 0.026, 0.03, grad(0x7a5240, 0xb08a5a, 0, 1.2), 5);
    if (up) {
      k.torus(0.11, 0.025, Math.PI * 1.3, [sx, top + 0.09, sz], [0, 0, -Math.PI * 0.15 - Math.PI], GOLD, 1, 4, 8);   // gold crescent
      k.ball(0.085, [sx, top + 0.11, sz], GREEN_G, [1, 1, 1], 1, [0, 0, 0], GLOW);
      k.torus(0.16, 0.012, TAU, [sx, top + 0.11, sz], [Math.PI / 2 - 0.3, 0, 0.3], PURP_G, 1, 3, 10, GLOW);
    } else {
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; k.spike([sx, top - 0.02, sz], [sx + Math.sin(a) * 0.07, top + 0.12, sz + Math.cos(a) * 0.07], 0.022, BONE_M, 4); }
      k.ball(0.07, [sx, top + 0.08, sz], GREEN_G, [1, 1, 1], 1, [0, 0, 0], GLOW);
    }
    });
    // neck + BIG skull with gold crown
    k.R([RB.HEAD, [0, 0.86 + lift, 0]], () => {
    k.limb([0, 0.85, 0], [0, 0.93, 0.01], 0.04, 0.04, BONE_M, 5);
    k.T([0, 1.02, 0.03], [-0.3, 0.1, 0], 1, () => {
      skull(k, [0, 0, 0], 0.125, GREEN_G, { jawOpen: 0.3, eyeR: 0.28 });
      k.lathe([[0.13, 0.06], [0.135, 0.11]], 8, [0, 0, -0.015], grad(GOLD_D, GOLD, 0.06, 0.11));
      const n = up ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, h = (i === 0 ? 0.13 : 0.08) * (up ? 1.4 : 1);
        k.spike([Math.sin(a) * 0.13, 0.1, Math.cos(a) * 0.13 - 0.015], [Math.sin(a) * 0.15, 0.1 + h, Math.cos(a) * 0.15 - 0.015], 0.03, GOLD, 4);
      }
      k.ball(0.026, [0, 0.085, 0.13], GREEN_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
    });
    });
  });
  if (up) for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; k.ball(0.035, [Math.sin(a) * 0.38, 0.45 + i * 0.12, Math.cos(a) * 0.3], i === 1 ? PURP_G : GREEN_G, [1, 1, 1], 0, [0, 0, 0], GLOW); }
  return finish(k, up ? 0.9 : 0.92, 1.1);
}

// =====================================================================
// BLACK KNIGHT (up: Dread Knight)
// identity: rider on a big barded horse with a long raised lance and pennant,
// horned great helm with a red slit, crimson cape + caparison, green flame mane.
// horse: deep violet-grey (never black), lighter on top
// up: skull chanfron + bone horn, gold trims, huge spiked pauldrons, green hoof-fire,
// gold vamplate and a bigger forked pennant
// =====================================================================
function blackknight(up) {
  const k = nkit(up ? 667 : 67);
  const HORSE = grad(0x4a3e6c, 0x8072aa, 0.15, 1.05), BARD = grad(CRIM_D, CRIM_L, 0.35, 0.8);
  const ARM = up ? grad(0x5e5684, 0xc4bce0, 0.6, 1.45) : steel;
  // horse legs: chunky, left fore raised mid-stride
  const legs = [
    [[-0.12, 0.58, 0.33], [-0.13, 0.4, 0.47], [-0.12, 0.22, 0.47]],
    [[0.12, 0.58, 0.33], [0.13, 0.3, 0.35], [0.12, 0.06, 0.36]],
    [[-0.12, 0.6, -0.33], [-0.13, 0.32, -0.42], [-0.12, 0.06, -0.38]],
    [[0.12, 0.6, -0.33], [0.13, 0.32, -0.38], [0.12, 0.06, -0.3]],
  ];
  const LEGB = [RB.LEG_FL, RB.LEG_FR, RB.LEG_BL, RB.LEG_BR];
  legs.forEach(([top, knee, hoof], li) => k.R([LEGB[li], top], () => {
    k.limb(top, knee, 0.095, 0.06, HORSE, 6);
    k.limb(knee, hoof, 0.055, 0.05, HORSE, 6);
    k.limb([hoof[0], hoof[1] - 0.06, hoof[2]], [hoof[0], hoof[1] + 0.04, hoof[2]], 0.07, 0.058, up ? GOLD_D : STEEL_D, 6);
    if (up) k.lathe([[0.085, hoof[1] + 0.02], [0.05, hoof[1] + 0.15]], 5, [hoof[0], 0, hoof[2]], 0x7affa0, { jag: 0.04, ds: true, glow: true });
  }));
  // body + crimson caparison + gold trim
  k.R([RB.BODY, [0, 0.62, 0]], () => {
  k.ball(0.23, [0, 0.66, 0], HORSE, [0.92, 0.88, 2.15], 1);
  k.lathe([[0.26, 0.36], [0.255, 0.56], [0.22, 0.78]], 12, [0, 0, -0.01], BARD, { s: [1, 1, 2.1], jag: 0.05, ds: true });
  k.lathe([[0.262, 0.6], [0.258, 0.65]], 12, [0, 0, -0.01], GOLD, { s: [1, 1, 2.1] });
  for (const x of [-1, 1]) k.ball(0.075, [x * 0.26, 0.5, 0.0], BONE, [0.3, 1, 0.85], 1);     // bone skull emblem
  });
  // neck + head (+ flame mane) on HEAD, pivot at the neck root
  k.R([RB.HEAD, [0, 0.74, 0.34]], () => {
  k.limb([0, 0.72, 0.36], [0, 1.04, 0.6], 0.14, 0.09, HORSE, 6);
  k.lathe([[0.14, 0.0], [0.1, 0.3]], 6, [0, 0.74, 0.38], ARM, { rot: [0.64, 0, 0], ds: true, phi0: -1.9, phiLen: 3.8 });   // crinet
  k.T([0, 1.06, 0.64], [-1.0, 0, 0], 1, () => {
    k.ball(0.095, [0, 0, 0], HORSE, [0.85, 1, 1], 1);
    k.box(0.14, 0.3, 0.13, [0, -0.15, 0.0], HORSE);
    k.box(0.16, 0.3, 0.05, [0, -0.11, 0.065], up ? BONE : STEEL);                             // chanfron (up: skull)
    if (up) {
      k.spike([0, 0.02, 0.09], [0, 0.1, 0.3], 0.035, BONE, 5);                               // bone horn
      for (const x of [-1, 1]) k.chain([[x * 0.06, 0.05, -0.02], [x * 0.12, 0.12, -0.04], [x * 0.13, 0.21, -0.1]], [0.028, 0.018, 0], BONE_M, 4);
    }
    for (const x of [-1, 1]) {
      glowEye(k, [x * 0.08, -0.03, 0.04], 0.03, RED_G);
      if (!up) k.spike([x * 0.045, 0.06, -0.03], [x * 0.07, 0.17, -0.06], 0.03, 0x4a3e6c, 4);
    }
  });
  // mane + tail of green ghost-fire
  for (let i = 0; i < 5; i++) {
    const t = i / 4, base = [0, 0.86 + t * 0.24, 0.33 + t * 0.24];
    k.spike(base, [0, base[1] + 0.13, base[2] - 0.17], 0.055, i % 2 ? 0x9aff9a : 0x3ae87a, 4, GLOW);
  }
  });
  k.R([RB.TAIL, [0, 0.7, -0.46]], () => {
    k.chain([[0, 0.7, -0.46], [0, 0.6, -0.62], [0, 0.38, -0.7]], [0.055, 0.07, 0.04], 0x5a4e7c, 5);
    k.spike([0, 0.62, -0.6], [0, 0.32, -0.82], 0.06, 0x5aff8a, 4, GLOW);
  });
  // saddle + rider legs
  k.R([RB.BODY, [0, 0.62, 0]], () => k.box(0.32, 0.07, 0.32, [0, 0.84, -0.05], 0x8a5236));
  const RP = [0, 0.9, -0.03];                                                                  // rider pivot: seat
  k.R([RB.RIDER, RP], () => {
  for (const x of [-1, 1]) {
    k.limb([x * 0.1, 0.9, -0.03], [x * 0.22, 0.79, 0.12], 0.06, 0.055, ARM, 6);
    k.limb([x * 0.22, 0.79, 0.12], [x * 0.23, 0.53, 0.06], 0.05, 0.045, ARM, 6);
    k.box(0.08, 0.06, 0.15, [x * 0.23, 0.51, 0.09], STEEL_D);
  }
  // torso: breastplate + crimson tabard + big pauldrons
  k.ball(0.17, [0, 1.07, 0], ARM, [1, 1.15, 0.78], 1);
  k.box(0.15, 0.3, 0.04, [0, 0.97, 0.13], grad(CRIM_D, CRIM, 0.82, 1.12), [-0.1, 0, 0]);
  k.box(0.15, 0.04, 0.045, [0, 1.06, 0.14], GOLD, [-0.1, 0, 0]);
  for (const x of [-1, 1]) {
    const pr = up ? 0.12 : 0.1;
    k.ball(pr, [x * 0.19, 1.15, 0], ARM, [1.15, 0.75, 1.05], 1);
    if (up) k.torus(pr * 0.95, 0.016, TAU, [x * 0.19, 1.12, 0], [Math.PI / 2, 0, x * 0.25], GOLD, [1.15, 1, 1], 3, 10);
    k.spike([x * 0.22, 1.19, 0], [x * (up ? 0.38 : 0.33), up ? 1.36 : 1.3, -0.02], up ? 0.045 : 0.035, up ? BONE : STEEL_L, 5);
  }
  // crimson cape
  const cape = (u, v) => { const a = (u - 0.5) * 2.4; return [Math.sin(a) * (0.18 + v * 0.1), 1.16 - v * 0.44 + Math.abs(u - 0.5) * 0.1, -Math.cos(a) * (0.13 + v * 0.08) - 0.06 - v * 0.16]; };
  k.surf(cape, 6, 2, grad(CRIM_D, CRIM_L, 0.7, 1.1), { ds: true });
  k.tris(ragHem(cape, 4, 0.08, k.r), CRIM, { ds: true });
  });
  // left arm on the reins
  k.R([RB.ARM_L, [-0.2, 1.12, 0]], () => {
  k.limb([-0.2, 1.12, 0], [-0.21, 0.97, 0.13], 0.052, 0.046, ARM, 6);
  k.limb([-0.21, 0.97, 0.13], [-0.09, 0.93, 0.26], 0.046, 0.04, ARM, 6);
  k.ball(0.048, [-0.08, 0.93, 0.28], STEEL_D, [1, 1, 1], 0);
  });
  // right arm: long lance raised forward-up, pennant near the tip
  k.R([RB.ARM_R, [0.2, 1.12, 0]], () => {
  k.limb([0.2, 1.12, 0], [0.27, 0.98, 0.08], 0.052, 0.046, ARM, 6);
  k.limb([0.27, 0.98, 0.08], [0.27, 1.0, 0.22], 0.046, 0.04, ARM, 6);
  k.ball(0.05, [0.27, 1.0, 0.24], STEEL_D, [1, 1, 1], 0);
  const L0 = [0.27, 0.72, -0.2], L1 = [0.29, 1.78, 0.62];
  const at = (t) => lerp3(L0, L1, t);
  k.limb(L0, at(0.86), 0.044, 0.03, grad(BONE_D, BONE, 0.7, 1.6), 5);
  if (up) k.add(new THREE.ConeGeometry(0.09, 0.16, 6, 1, true).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(...L1).sub(new V3(...L0)).normalize())).translate(...at(0.43)), up ? GOLD : STEEL, { ds: true });   // vamplate
  k.spike(at(0.84), L1, 0.06, STEEL_L, 5);                                                     // steel tip
  { const p0 = at(0.7), p1 = at(0.83), w = up ? 0.36 : 0.28;                                   // pennant streaming back
    const tail = [p0[0] + 0.02, (p0[1] + p1[1]) / 2 - 0.08, (p0[2] + p1[2]) / 2 - w];
    k.tris([[p0, p1, tail]], grad(CRIM, CRIM_L, 1.3, 1.6), { ds: true });
    if (up) k.tris([[at(0.62), p0, [tail[0], tail[1] - 0.1, tail[2] + 0.06]]], GOLD, { ds: true }); }
  });
  // great helm: horns + red eye slit (part of the rider)
  k.R([RB.RIDER, RP], () => k.T([0, 1.29, 0.01], [0, 0, 0], 1, () => {
    k.lathe([[0.115, -0.09], [0.12, 0.04], [0.105, 0.11], [0.05, 0.16]], 8, [0, 0, 0], ARM);
    k.box(0.18, 0.15, 0.04, [0, -0.01, 0.1], up ? 0x5e5684 : STEEL_D);
    k.box(0.16, 0.03, 0.03, [0, 0.025, 0.12], RED_G, [0, 0, 0], GLOW);
    if (up) k.box(0.18, 0.035, 0.045, [0, 0.075, 0.1], GOLD);
    for (const x of [-1, 1]) k.chain([[x * 0.1, 0.05, 0], [x * 0.19, 0.12, -0.02], [x * 0.21, up ? 0.26 : 0.23, -0.07]], [0.034, 0.022, 0.0], BONE_M, 5);
    const crest = (u, v) => [(v - 0.5) * 0.05, 0.14 + Math.sin(u * Math.PI) * 0.12, 0.1 - u * 0.4];
    k.surf(crest, 5, 1, grad(CRIM, CRIM_L, 0.15, 0.3), { ds: true });
  }));
  return finish(k, 1.0, 1.4);
}

// =====================================================================
// BONE DRAGON (up: Ghost Dragon)
// identity: huge raised bone wings with big crimson membranes, thick ribcage over a
// plum core with green soul-fire, big horned skull, chunky spine and legs
// up: pale spectral cyan bone, glowing teal membranes, cyan heart, horn crown, wisps
// =====================================================================
function bonedragon(up) {
  const k = nkit(up ? 779 : 79);
  const BN = up ? grad(0xa8d4e8, 0xeefaff, 0.2, 1.3) : grad(BONE_M, BONE, 0.2, 1.3);
  const BJ = up ? 0xc4e4f2 : BONE_M, BW = up ? 0xf4fcff : BONE;
  const MEM = up ? grad(0x1a8aac, 0x5ad4e8, 0.6, 1.4) : grad(0x9a2848, 0xe0566e, 0.55, 1.35);
  const FIRE = up ? [0xc8f8ff, 0x3ac8f0] : [0xaaffa0, 0x2ad85a];
  // spine: tail tip -> skull
  const spine = [[0, 0.24, -1.0], [0, 0.34, -0.8], [0, 0.48, -0.6], [0, 0.62, -0.4], [0, 0.72, -0.18], [0, 0.76, 0.06], [0, 0.82, 0.26], [0, 1.0, 0.4], [0, 1.16, 0.48]];
  const rad = [0.02, 0.04, 0.055, 0.065, 0.07, 0.07, 0.065, 0.058, 0.05];
  // rig: tail = spine[0..3] (pivot at its root), body = spine[3..6], neck + skull = HEAD
  const TP = [RB.TAIL, spine[3]], BP = [RB.BODY, [0, 0.66, -0.1]], HP = [RB.HEAD, spine[6]];
  k.R(TP, () => k.chain(spine.slice(0, 4), rad.slice(0, 4), BN, 6, false));
  k.R(BP, () => k.chain(spine.slice(3, 7), rad.slice(3, 7), BN, 6, false));
  k.R(HP, () => k.chain(spine.slice(6), rad.slice(6), BN, 6, false));
  for (let i = 2; i < spine.length - 1; i += 2) k.R(i < 4 ? TP : BP, () => {
    const p = spine[i];
    k.ball(rad[i] * 1.45, p, BW, [1, 0.9, 1], 0);
    k.spike(p, [p[0], p[1] + 0.07 + rad[i] * 1.4, p[2] - 0.05], rad[i] * 0.75, BJ, 4);
  });
  k.R(TP, () => k.spike([0, 0.24, -0.98], [0, 0.3, -1.2], 0.06, BJ, 4));                    // tail blade
  k.R(BP, () => {
  // plum core + thick ribs (open at the bottom) + soul fire
  k.ball(0.17, [0, 0.55, -0.02], up ? 0x3a6a9a : PLUM, [0.85, 0.9, 1.6], 1);
  for (let i = 0; i < 4; i++) {
    const z = -0.2 + i * 0.12, R = 0.19 + Math.sin((i / 3) * Math.PI) * 0.05, gap = 1.1, L = TAU - gap;
    const beta = 1.5 * Math.PI - L - gap / 2;
    k.add(new THREE.TorusGeometry(R, 0.032, 4, 9, L).rotateZ(beta).scale(0.95, 1.12, 1).rotateX(0.25).translate(0, 0.76 - R * 1.08, z), BW);
  }
  flame(k, [0, 0.42, 0.0], 0.15, FIRE[0], FIRE[1], 5);
  if (up) k.ball(0.07, [0, 0.58, 0.06], CYAN_G, [1, 1.1, 1.3], 1, [0, 0, 0], GLOW);
  k.ball(0.11, [0, 0.66, -0.32], BJ, [1.5, 0.8, 1], 1);                                       // pelvis
  });
  // legs: chunky, three toe claws as one wedge each
  for (const x of [-1, 1]) {
    const hip = [x * 0.13, 0.62, -0.32], knee = [x * 0.21, 0.38, -0.18], ank = [x * 0.19, 0.13, -0.32], foot = [x * 0.19, 0.04, -0.24];
    k.R([x < 0 ? RB.LEG_BL : RB.LEG_BR, hip], () => {
    k.limb(hip, knee, 0.065, 0.05, BN, 6); k.ball(0.055, knee, BJ, [1, 1, 1], 0);
    k.limb(knee, ank, 0.045, 0.036, BN, 6); k.limb(ank, foot, 0.036, 0.03, BN, 5);
    k.box(0.11, 0.05, 0.14, [foot[0], 0.025, foot[2] + 0.05], BJ);
    });
    const sh = [x * 0.15, 0.72, 0.2], el = [x * 0.23, 0.42, 0.14], wr = [x * 0.21, 0.13, 0.3], ft = [x * 0.21, 0.04, 0.36];
    k.R([x < 0 ? RB.LEG_FL : RB.LEG_FR, sh], () => {
    k.limb(sh, el, 0.058, 0.046, BN, 6); k.ball(0.05, el, BJ, [1, 1, 1], 0);
    k.limb(el, wr, 0.042, 0.034, BN, 6); k.limb(wr, ft, 0.034, 0.03, BN, 5);
    k.box(0.1, 0.05, 0.13, [ft[0], 0.025, ft[2] + 0.05], BJ);
    });
  }
  // wings: thick bone arm + 3 fingers, big membranes with a couple of bold tears
  const S = up ? 1.08 : 1;
  for (const x of [-1, 1]) k.R([x < 0 ? RB.WING_L : RB.WING_R, [x * 0.1, 0.8, 0.15]], () => {
    const root = [x * 0.1, 0.8, 0.15], elbow = [x * 0.42 * S, 1.08 * S, 0.1], wrist = [x * 0.68 * S, 1.3 * S, 0.0];
    const tips = [[x * 0.98 * S, 1.12 * S, -0.16], [x * 0.9 * S, 0.82, -0.28], [x * 0.64 * S, 0.62, -0.34]];
    k.limb(root, elbow, 0.055, 0.045, BN, 6); k.ball(0.055, elbow, BJ, [1, 1, 1], 0);
    k.limb(elbow, wrist, 0.045, 0.038, BN, 6); k.ball(0.05, wrist, BJ, [1, 1, 1], 0);
    k.spike(wrist, [x * 0.66 * S, 1.52 * S, -0.04], 0.04, BJ, 4);                              // thumb claw
    for (const t of tips) k.limb(wrist, t, 0.03, 0.012, BN, 5);
    const back = [x * 0.12, 0.72, -0.24];
    const anchors = [tips[0], tips[1], tips[2], back], mem = [];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      const mid = lerp3(lerp3(a, b, 0.5), wrist, i === 1 ? 0.3 : 0.12);                        // scalloped edge
      mem.push([wrist, lerp3(a, wrist, 0.05), mid], [wrist, mid, lerp3(b, wrist, 0.05)]);
    }
    mem.push([wrist, back, elbow], [elbow, back, root]);
    k.tris(mem, MEM, { ds: true });
    if (up) {                                                                                  // glowing trailing edge wisps
      for (let i = 0; i < 2; i++) { const a = anchors[i], b = anchors[i + 1], m = lerp3(lerp3(a, b, 0.5), wrist, i === 1 ? 0.3 : 0.12); k.spike(m, [m[0] + x * 0.02, m[1] - 0.16, m[2] - 0.1], 0.03, 0x8af0ff, 3, GLOW); }
    }
  });
  // BIG horned skull, open maw with fire glow
  k.R(HP, () => k.T([0, 1.22, 0.6], [0.35, 0, 0], 1.55, () => {
    k.ball(0.095, [0, 0.0, 0], BW, [1, 0.85, 1.1], 1);
    k.limb([0, 0.0, 0.04], [0, -0.03, 0.3], 0.075, 0.045, BW, 5);                              // snout
    k.box(0.17, 0.05, 0.1, [0, 0.05, 0.06], BJ);                                               // brow
    for (const x of [-1, 1]) {
      k.ball(0.036, [x * 0.058, 0.02, 0.08], SOCK, [1, 1, 0.7], 0);
      glowEye(k, [x * 0.062, 0.02, 0.1], 0.03, up ? CYAN_G : GREEN_G);
      k.chain([[x * 0.06, 0.05, -0.03], [x * 0.13, 0.13, -0.1], [x * 0.15, 0.14, -0.24]], [0.035, 0.025, 0], BJ, 5);   // horns
      if (up) k.spike([x * 0.04, 0.07, -0.02], [x * 0.07, 0.2, -0.1], 0.025, BJ, 4);
    }
    k.T([0, -0.05, 0.0], [0.45, 0, 0], 1, () => k.box(0.12, 0.04, 0.3, [0, -0.02, 0.15], BJ)); // open jaw
    k.ball(0.045, [0, -0.07, 0.13], up ? CYAN_G : GREEN_G, [1, 0.5, 1.6], 0, [0, 0, 0], GLOW);
  }));
  return finish(k, 0.92, 1.35);
}

const BUILD = { skeleton, zombie, wight, vampire, lich, blackknight, bonedragon };
const ALIAS = { skelwarrior: 'skeleton', plaguezombie: 'zombie', wraith: 'wight', vampirelord: 'vampire', powerlich: 'lich', dreadknight: 'blackknight', ghostdragon: 'bonedragon' };
export const NECRO_IDS = Object.keys(BUILD);
/** Shared builder: base creature id (or upgrade id) + upgrade flag. Used by units_necro_up.js. */
export function necroBuild(id, up = false) {
  const base = BUILD[id] ? id : ALIAS[id];
  return base ? BUILD[base](!!up) : null;
}
export function necroModel(id) {
  const base = BUILD[id] ? id : ALIAS[id];
  return base ? BUILD[base](false) : null;
}
