import * as THREE from 'three';
import { BONE as RB, ensureRig, tagRange } from './rig.js?v=1.6';

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
//
// Round 7 (detail): a secondary layer on every creature (teeth, brows, sockets with hot
// pupils, trims, rivets, wraps, sigils, folds, claws, veins) and smoother 8-16 segment
// forms. Kit additions: lathe `fold` (cloth folds), per-triangle colour `tc` (rune /
// embroidery bands), k.wraps / k.studs / k.teeth, sigil(), surfBand(). Small balls drop
// facets automatically to stay in budget (~3-5k tris, mounted / dragons ~5.5-6k).
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
      (o.glow ? G : B).push({ g: ng, c, ds: o.ds, sh: o.sh ?? 1, rig: cur, tc: o.tc });
      return ng;
    },
    box(w, h, d, pos, c, rot = [0, 0, 0], o) { return k.add(new THREE.BoxGeometry(w, h, d).applyMatrix4(mat(pos, rot)), c, o); },
    ball(rad, pos, c, s = [1, 1, 1], det = 1, rot = [0, 0, 0], o) {
      const rs = rad * Math.max(...(typeof s === 'number' ? [s] : s));                    // budget: small balls get fewer facets
      if (det > 1 && rs < 0.06) det = 1; if (det > 0 && rs < 0.028) det = 0;
      return k.add(new THREE.IcosahedronGeometry(rad, det).applyMatrix4(mat(pos, rot, s)), c, o); },
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
      const { phi0 = 0, phiLen = TAU, jag = 0, s = 1, rot = [0, 0, 0], wob = 0, fold = null } = o;
      const pos3 = [], idx = [], cols = seg + 1;
      for (let i = 0; i < prof.length; i++) for (let j = 0; j < cols; j++) {
        const th = phi0 + (j / seg) * phiLen;
        let [rad, y] = prof[i];
        if (i === 0 && jag) y += (j % 2 ? -jag * (0.6 + 0.4 * r()) : jag * 0.3 * r());
        if (wob) rad *= 1 + (r() - 0.5) * wob;
        if (fold) rad *= 1 + fold[1] * Math.sin(fold[0] * th + (fold[3] || 0)) * (1 + ((fold[2] ?? 1) - 1) * i / Math.max(1, prof.length - 1));   // cloth folds
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
    // n leather / metal wraps (tori) around the segment a -> b
    wraps(a, b, n, R, tube, c, o) {
      const va = new V3(...a), vb = new V3(...b), q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), vb.clone().sub(va).normalize());
      for (let i = 0; i < n; i++) { const p = va.clone().lerp(vb, n > 1 ? i / (n - 1) : 0.5); k.add(new THREE.CylinderGeometry(R + tube * 0.6, R + tube * 0.6, tube * 2.2, 8, 1, true).rotateX(Math.PI / 2).applyQuaternion(q).translate(p.x, p.y, p.z), typeof c === 'function' || !Array.isArray(c) ? c : c[i % c.length], o); }
    },
    studs(pts, rad, c, o) { for (const p of pts) k.add(new THREE.OctahedronGeometry(rad, 0).translate(...p), c, o); },
    // a row of teeth (spikes) from the line a -> b, each pointing along dir
    teeth(a, b, n, len, rad, dir, c, o) {
      for (let i = 0; i < n; i++) { const p = lerp3(a, b, n > 1 ? i / (n - 1) : 0.5), L = len * (i === 0 || i === n - 1 ? 1.3 : 0.8 + 0.25 * ((i * 7) % 3) / 2); k.spike(p, [p[0] + dir[0] * L, p[1] + dir[1] * L, p[2] + dir[2] * L], rad, c, 4, o); }
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
  const tags = [], tcc = new THREE.Color();
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
        if (perTri || part.tc) ctr.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        if (perTri) tags.push([pos.length / 3, 3, ...part.rig(ctr)]);
        if (part.tc) tcc.copy(part.tc(ctr, n));
        const jit = glow ? 1 : 1 + (r() - 0.5) * 0.05;
        for (const v of tri) {
          p.copy(v);
          if (part.tc) t.copy(tcc); else if (typeof part.c === 'function') t.copy(part.c(p, n)); else t.set(part.c);
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
const GLOW_GOLD = 0xffe070;
const GREEN_G = 0x5aff7a, LIME_G = 0xc0ff4a, RED_G = 0xff3a2a, CYAN_G = 0x7aeaff, PURP_G = 0xc070ff;
const GLOW = { glow: true };
const bone = grad(BONE_M, BONE, 0.1, 1.1);
const steel = grad(STEEL_D, STEEL_L, 0.4, 1.3);
const glowEye = (k, pos, r, c) => k.ball(r, pos, c, [1, 1, 0.7], 0, [0, 0, 0], GLOW);

// big, bold skull centred at pos facing +z; s = cranium radius. Big parts first
// (cranium, face block, dark sockets with glowing eyes, jaw) and, round 7, a
// secondary layer: brow ridge, cheekbones, nose hole, two rows of teeth, a crack.
const BONE_W = 0xfffaf0;
function skull(k, pos, s, eye = GREEN_G, o = {}) {
  const { jawOpen = 0.2, col = BONE, rot = [0, 0, 0], eyeR = 0.24, crack = true } = o;
  k.T(pos, rot, 1, () => {
    k.ball(s, [0, 0.12 * s, -0.1 * s], col, [1.02, 1, 1.1], 2);                         // cranium (smooth)
    k.box(1.42 * s, 0.7 * s, 0.82 * s, [0, -0.3 * s, 0.36 * s], col);                 // face block (cheeks + brow)
    for (const x of [-1, 1]) {
      k.box(0.62 * s, 0.14 * s, 0.2 * s, [x * 0.36 * s, 0.2 * s, 0.74 * s], col, [0.1, 0, -x * 0.22]);   // brow ridge (frown)
      k.ball(0.22 * s, [x * 0.58 * s, -0.42 * s, 0.6 * s], col, [1, 0.8, 1], 0);                       // cheekbone
      k.ball(0.33 * s, [x * 0.37 * s, -0.12 * s, 0.72 * s], SOCK, [1, 0.95, 0.45], 1);
      glowEye(k, [x * 0.37 * s, -0.12 * s, 0.8 * s], eyeR * s, eye);
      glowEye(k, [x * 0.37 * s, -0.12 * s, 0.86 * s], eyeR * 0.42 * s, 0xf4fff0);              // hot pupil
      k.box(0.09 * s, 0.24 * s, 0.1 * s, [x * 0.055 * s, -0.43 * s, 0.77 * s], SOCK, [0, 0, x * 0.45]);   // nose hole
    }
    k.box(0.92 * s, 0.17 * s, 0.1 * s, [0, -0.64 * s, 0.74 * s], SOCK);                       // grin slot
    for (let i = 0; i < 6; i++) k.box(0.12 * s, 0.15 * s, 0.07 * s, [(-0.36 + i * 0.144) * s, -0.6 * s, 0.79 * s], BONE_W);   // upper teeth
    k.T([0, -0.62 * s, 0.1 * s], [jawOpen, 0, 0], 1, () => {
      k.box(1.16 * s, 0.3 * s, 0.76 * s, [0, -0.2 * s, 0.32 * s], col);
      k.ball(0.2 * s, [0, -0.3 * s, 0.66 * s], col, [1.4, 0.8, 0.8], 0);                    // chin
      for (let i = 0; i < 5; i++) k.box(0.12 * s, 0.13 * s, 0.07 * s, [(-0.29 + i * 0.145) * s, -0.01 * s, 0.64 * s], BONE_W);   // lower teeth
    });
    if (crack) k.chain([[-0.42 * s, 0.86 * s, 0.38 * s], [-0.28 * s, 0.72 * s, 0.62 * s], [-0.36 * s, 0.56 * s, 0.76 * s], [-0.22 * s, 0.42 * s, 0.84 * s]], [0.035 * s, 0.035 * s, 0.03 * s, 0.02 * s], SOCK, 4);
  });
}
// small flat bone skull emblem (faction sigil) facing +z, turned by ry; s = radius
function sigil(k, pos, s, ry = 0, col = BONE, eye = null, rx = 0) {
  k.T(pos, [rx, ry, 0], 1, () => {
    k.ball(s, [0, 0.15 * s, 0], col, [1, 0.95, 0.35], 1);
    k.box(1.0 * s, 0.55 * s, 0.32 * s, [0, -0.45 * s, 0], col);
    for (const x of [-1, 1]) k.ball(0.28 * s, [x * 0.36 * s, -0.05 * s, 0.28 * s], SOCK, [1, 1, 0.45], 0);
    k.box(0.64 * s, 0.1 * s, 0.1 * s, [0, -0.52 * s, 0.15 * s], SOCK);
    if (eye) for (const x of [-1, 1]) k.ball(0.16 * s, [x * 0.36 * s, -0.05 * s, 0.36 * s], eye, [1, 1, 0.45], 0, [0, 0, 0], GLOW);
  });
}
// unlit flame: bright core plus a few fat tongues
function flame(k, pos, size, core, mid, n = 5) {
  k.ball(size * 0.5, [pos[0], pos[1] + size * 0.2, pos[2]], core, [1, 1.2, 1], 1, [0, 0, 0], GLOW);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + k.r(), rr = size * 0.4, h = size * (1.0 + k.r() * 0.8);
    const b = [pos[0] + Math.sin(a) * rr, pos[1], pos[2] + Math.cos(a) * rr];
    k.spike(b, [b[0] + Math.sin(a) * rr * 0.4, pos[1] + h, b[2] + Math.cos(a) * rr * 0.4], size * 0.36, i % 2 ? mid : core, 5, GLOW);
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
// thin trim strip along the v = 1 edge (or any v) of a surface f(u, v): quads between v0 and v1
function surfBand(f, n, v0, v1, u0 = 0, u1 = 1) {
  const t = [];
  for (let i = 0; i < n; i++) {
    const ua = u0 + (u1 - u0) * i / n, ub = u0 + (u1 - u0) * (i + 1) / n;
    const a = f(ua, v0), b = f(ub, v0), a2 = f(ua, v1), b2 = f(ub, v1);
    t.push([a, b, a2], [b, b2, a2]);
  }
  return t;
}
// alternating per-triangle colour around the Y axis (embroidery / rune bands on lathes)
const bandTC = (n, c1, c2, cx = 0, cz = 0) => { const A = C(c1), Bc = C(c2); return (p) => ((Math.floor(((Math.atan2(p.x - cx, p.z - cz) / TAU) + 1) * n) % 2) ? A : Bc); };

// =====================================================================
// SKELETON (up: Skeleton Warrior)
// identity: big bare skull + white ribcage over a plum core, big sword + round crimson shield
// up: steel-and-gold plumed helm, pauldrons, greaves, gold-rimmed shield, crimson cape, rune blade
// round 7: toe bones, knee caps, twin forearm bones, vertebrae, floating ribs, buckled belt
// + pouch + bone charm, wrapped grip / fuller / bevelled edges, crossed-bones shield sigil
// with rivets and a skull boss, helm rivets + layered crest, cape skull sigil
// =====================================================================
function skeleton(up) {
  const k = nkit(up ? 111 : 11);
  const LEATHER = 0x8a5232;
  // legs: chunky bones, toe bones / sabatons
  for (const x of [-1, 1]) k.R([x < 0 ? RB.LEG_FL : RB.LEG_FR, [x * 0.09, 0.46, 0]], () => {
    const hip = [x * 0.09, 0.46, 0], knee = [x * 0.115, 0.25, x < 0 ? 0.05 : -0.01], ank = [x * 0.1, 0.07, x < 0 ? 0.05 : -0.03];
    k.box(0.11, 0.06, 0.13, [ank[0], 0.03, ank[2] + 0.02], up ? steel : BONE_M);
    if (up) {
      k.box(0.112, 0.052, 0.08, [ank[0], 0.026, ank[2] + 0.12], steel, [0.15, 0, 0]);           // sabaton toe
      k.box(0.116, 0.018, 0.02, [ank[0], 0.05, ank[2] + 0.085], GOLD);
    } else for (const dx of [-0.033, 0, 0.033]) {
      const tp = [ank[0] + dx * 1.25, 0.02, ank[2] + 0.15];
      k.limb([ank[0] + dx, 0.035, ank[2] + 0.07], tp, 0.018, 0.015, BONE, 5);
      k.ball(0.019, tp, BONE_M, [1, 0.8, 1.2], 0);
    }
    k.ball(0.04, ank, BONE_M, [1, 1, 1], 0);
    k.limb(ank, knee, 0.036, 0.042, bone, 8);
    k.limb(knee, hip, 0.044, 0.048, bone, 8);
    k.ball(0.05, hip, BONE_M, [1, 1, 1], 0);
    if (up) {
      k.limb(lerp3(ank, knee, 0.05), lerp3(ank, knee, 0.9), 0.058, 0.064, steel, 8);
      k.ball(0.064, knee, GOLD, [1, 1, 0.9], 1);
      k.studs([0.35, 0.65].map((t) => { const p = lerp3(ank, knee, t); return [p[0], p[1], p[2] + 0.06]; }), 0.013, GOLD);
    } else {
      k.ball(0.055, knee, BONE_M, [1, 1, 1], 1);
      k.ball(0.03, [knee[0], knee[1] + 0.01, knee[2] + 0.045], BONE, [1, 1.1, 0.7], 0);         // kneecap
    }
  });
  k.R([RB.BODY, [0, 0.47, 0]], () => {
  // pelvis + crimson loincloth (front and back flaps) / up: crimson tabard skirt with gold hem
  k.ball(0.13, [0, 0.47, 0], BONE_M, [1.1, 0.55, 0.85], 1);
  if (up) k.R([RB.CLOTH, [0, 0.52, 0]], () => {
    k.lathe([[0.2, 0.28], [0.19, 0.34], [0.18, 0.4], [0.15, 0.52]], 14, [0, 0, 0], grad(CRIM_D, CRIM_L, 0.28, 0.5), { jag: 0.05, ds: true, phi0: 0.5, phiLen: TAU - 1.0, fold: [7, 0.06, 0.3] });
    k.lathe([[0.21, 0.27], [0.205, 0.32]], 14, [0, 0, 0], GOLD, { ds: true, phi0: 0.5, phiLen: TAU - 1.0, fold: [7, 0.06] });
    k.lathe([[0.2, 0.355], [0.196, 0.37]], 14, [0, 0, 0], GOLD_D, { ds: true, phi0: 0.5, phiLen: TAU - 1.0, fold: [7, 0.06] });
  }); else k.R([RB.CLOTH, [0, 0.5, 0]], () => {
    const CL = grad(CRIM_D, CRIM, 0.25, 0.47);
    k.box(0.17, 0.22, 0.03, [0, 0.36, 0.1], CL, [-0.12, 0, 0]);
    k.box(0.19, 0.24, 0.03, [0, 0.35, -0.1], CL, [0.12, 0, 0]);
    k.box(0.172, 0.022, 0.034, [0, 0.3, 0.093], BONE_M, [-0.12, 0, 0]);                       // embroidered band
    k.tris([[[-0.085, 0.25, 0.088], [-0.03, 0.25, 0.088], [-0.06, 0.205, 0.083]], [[0.0, 0.25, 0.088], [0.06, 0.25, 0.088], [0.035, 0.2, 0.082]]], CRIM_D, { ds: true });   // torn hem
  });
  k.box(0.3, 0.05, 0.22, [0, 0.5, 0], up ? GOLD_D : 0x9a6038);                          // belt
  k.box(0.065, 0.06, 0.02, [0, 0.5, 0.115], up ? GOLD : 0xd8a040);                        // buckle
  k.box(0.03, 0.026, 0.01, [0, 0.5, 0.126], up ? GOLD_D : 0x6a3a22);
  k.box(0.07, 0.085, 0.05, [-0.14, 0.45, 0.07], LEATHER, [0, 0.5, 0]);                    // pouch
  k.box(0.074, 0.03, 0.054, [-0.14, 0.48, 0.071], 0xa86a40, [0, 0.5, 0]);
  k.limb([0.15, 0.48, 0.06], [0.16, 0.41, 0.08], 0.008, 0.008, 0x6a3a22, 4);              // bone charm
  k.ball(0.022, [0.16, 0.4, 0.085], BONE, [1, 1.2, 0.8], 0);
  // spine with vertebrae, plum chest core, three thick ribs + floating ribs, sternum
  k.limb([0, 0.48, -0.06], [0, 0.88, -0.06], 0.036, 0.036, BONE_M, 6);
  for (let y = 0.53; y < 0.87; y += 0.065) k.ball(0.03, [0, y, -0.085], BONE, [1.2, 0.7, 1], 0);
  k.ball(0.125, [0, 0.71, -0.02], PLUM, [1.05, 1.2, 0.78], 1);
  for (let i = 0; i < 3; i++) {
    const y = 0.8 - i * 0.085, R = 0.165 - i * 0.012, gap = 0.7, L = TAU - gap, beta = (L + gap / 2) - Math.PI / 2;
    k.add(new THREE.TorusGeometry(R, 0.03, 4, 12, L).rotateX(Math.PI / 2).rotateY(beta).scale(1, 1, 0.82).rotateX(-0.2).translate(0, y, -0.01), BONE);
  }
  { const R = 0.12, gap = 1.6, L = TAU - gap, beta = (L + gap / 2) - Math.PI / 2;               // floating ribs
    k.add(new THREE.TorusGeometry(R, 0.02, 4, 12, L).rotateX(Math.PI / 2).rotateY(beta).scale(1, 1, 0.8).rotateX(-0.2).translate(0, 0.565, -0.02), BONE_M); }
  k.box(0.055, 0.24, 0.045, [0, 0.72, 0.13], BONE, [-0.12, 0, 0]);
  k.ball(0.03, [0, 0.6, 0.145], BONE_M, [1, 1.3, 0.8], 0);                                    // xiphoid
  k.limb([-0.2, 0.87, -0.02], [0.2, 0.87, -0.02], 0.034, 0.034, BONE_M, 6);               // collarbone bar
  if (up) {
    k.lathe([[0.13, 0.62], [0.17, 0.72], [0.17, 0.8]], 10, [0, 0, -0.01], steel, { phi0: -1.0, phiLen: 2.0, ds: true });   // half breastplate (ribs show above)
    k.lathe([[0.175, 0.795], [0.17, 0.82]], 10, [0, 0, -0.01], GOLD, { phi0: -1.0, phiLen: 2.0, ds: true });
    k.lathe([[0.132, 0.615], [0.14, 0.64]], 10, [0, 0, -0.01], GOLD_D, { phi0: -1.0, phiLen: 2.0, ds: true });
    k.box(0.025, 0.17, 0.02, [0, 0.715, 0.165], GOLD, [-0.18, 0, 0]);                          // centre ridge
    k.studs([[-0.11, 0.78, 0.12], [0.11, 0.78, 0.12], [-0.1, 0.66, 0.1], [0.1, 0.66, 0.1]], 0.012, GOLD);
    for (const x of [-1, 1]) {
      k.ball(0.1, [x * 0.21, 0.9, 0], steel, [1.1, 0.7, 1.05], 1);
      k.ball(0.085, [x * 0.235, 0.85, 0], steel, [1.1, 0.6, 1.05], 0);                        // second lame
      k.torus(0.095, 0.016, TAU, [x * 0.21, 0.87, 0], [Math.PI / 2, 0, x * 0.25], GOLD, [1.1, 1, 1], 3, 12);
      k.studs([[x * 0.21, 0.96, 0.06], [x * 0.25, 0.94, -0.05]], 0.012, GOLD);
    }
    // crimson cape with a torn hem, gold edge and a bone skull sigil
    const cape = (u, v) => { const a = (u - 0.5) * 2.3; return [Math.sin(a) * (0.18 + v * 0.1), 0.9 - v * 0.58, -Math.cos(a) * (0.11 + v * 0.06) - 0.07 - v * 0.1]; };
    const capeO = (u, v) => { const p = cape(u, v); return [p[0], p[1], p[2] - 0.006]; };
    k.R([RB.CLOTH, [0, 0.9, -0.18]], () => {
      k.surf(cape, 8, 4, grad(CRIM_D, CRIM, 0.3, 0.9), { ds: true });
      k.tris(ragHem(cape, 6, 0.08, k.r), CRIM, { ds: true });
      k.tris(surfBand(capeO, 8, 0.0, 0.06), GOLD, { ds: true });
      for (const u of [0.02, 0.98]) k.tris(surfBand((t, w) => capeO(u + (w - 0.5) * 0.04, t), 4, 0, 1), GOLD_D, { ds: true });
      sigil(k, [0, 0.69, -0.25], 0.055, Math.PI, BONE);
    });
  } else {
    for (const x of [-1, 1]) k.ball(0.058, [x * 0.21, 0.87, 0], BONE_M, [1, 1, 1], 1);
  }
  });
  // sword arm (right, +x)
  const sh = [0.21, 0.87, 0], el = [0.28, 0.67, 0.06], hd = [0.28, 0.64, 0.24];
  k.R([RB.ARM_R, sh], () => {
  k.limb(sh, el, 0.04, 0.036, bone, 8); k.ball(0.046, el, up ? steel : BONE_M, [1, 1, 1], 1);
  if (up) {
    k.limb(el, hd, 0.05, 0.054, steel, 8);
    k.wraps(lerp3(el, hd, 0.8), lerp3(el, hd, 0.86), 1, 0.056, 0.012, GOLD);
  } else for (const dx of [-0.014, 0.014]) k.limb([el[0] + dx, el[1], el[2]], [hd[0] + dx, hd[1], hd[2] - 0.02], 0.02, 0.018, bone, 5);   // radius + ulna
  k.ball(0.052, hd, BONE, [1, 1.1, 1], 1);
  for (const dy of [-0.03, 0.0, 0.03]) k.ball(0.02, [hd[0] - 0.035, hd[1] + dy + 0.01, hd[2] + 0.03], BONE_M, [1, 0.8, 1], 0);   // knuckles
  k.T(hd, [0.55, 0.1, 0], 1, () => {
    k.limb([0, -0.09, 0], [0, 0.06, 0], 0.024, 0.024, CRIM_D, 6);
    k.wraps([0, -0.075, 0], [0, 0.045, 0], 4, 0.026, 0.008, 0x5a2a20);
    k.ball(0.04, [0, -0.1, 0], up ? GOLD : STEEL_D, [1, 1, 1], 1);
    k.box(0.24, 0.05, 0.07, [0, 0.07, 0], up ? GOLD : STEEL_D);
    for (const x of [-1, 1]) k.ball(0.03, [x * 0.125, 0.075, 0], up ? GOLD : STEEL, [1, 1, 1], 0);   // quillon knobs
    k.box(0.05, 0.06, 0.075, [0, 0.11, 0], up ? GOLD_D : STEEL_D);                                    // ricasso block
    const L = up ? 0.6 : 0.5;
    const blade = grad(up ? 0xb4bcd8 : 0xa8aab8, up ? 0xf8faff : 0xe8e4dc, 0.1, L);
    k.box(0.12, L, 0.03, [0, 0.09 + L / 2, 0], blade);
    k.add(new THREE.ConeGeometry(0.085, 0.13, 4).scale(1, 1, 0.3).rotateY(Math.PI / 4).translate(0, 0.09 + L + 0.065, 0), blade);
    for (const x of [-1, 1]) k.box(0.014, L * 0.98, 0.034, [x * 0.054, 0.09 + L / 2, 0], up ? 0xf8faff : 0xf2efe8);   // bevelled edges
    if (up) k.box(0.03, L * 0.8, 0.036, [0, 0.09 + L * 0.45, 0], GREEN_G, [0, 0, 0], GLOW);
    else {
      k.box(0.026, L * 0.72, 0.036, [0, 0.09 + L * 0.42, 0], 0x7c7e96);                        // fuller
      k.box(0.03, 0.04, 0.036, [0.06, 0.09 + L * 0.66, 0], 0x8a6a5a, [0, 0, 0.6]);            // nick
    }
  });
  });
  // shield arm (left): big round crimson shield with bone (up: gold) rim and skull boss
  k.R([RB.ARM_L, [-0.21, 0.87, 0]], () => {
  k.limb([-0.21, 0.87, 0], [-0.28, 0.68, 0.05], 0.04, 0.036, bone, 8);
  k.ball(0.044, [-0.28, 0.68, 0.05], up ? steel : BONE_M, [1, 1, 1], 0);
  k.limb([-0.28, 0.68, 0.05], [-0.25, 0.6, 0.18], 0.036, 0.034, up ? steel : bone, 8);
  k.T([-0.27, 0.6, 0.23], [Math.PI / 2, -0.45, 0.12], 1, () => {
    const R = up ? 0.26 : 0.235;
    k.add(new THREE.CylinderGeometry(R, R, 0.045, 16), grad(CRIM_D, CRIM_L, -0.25, 0.25));
    k.add(new THREE.CylinderGeometry(R * 0.72, R * 0.72, 0.05, 16), grad(CRIM, CRIM_L, -0.25, 0.25));   // raised inner field
    k.add(new THREE.TorusGeometry(R, 0.03, 4, 16).rotateX(Math.PI / 2), up ? GOLD : BONE_M);
    const N = 10, riv = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU; riv.push([Math.sin(a) * R * 0.86, 0.026, Math.cos(a) * R * 0.86]); }
    k.studs(riv, 0.016, up ? GOLD : BONE);
    if (up) { k.box(R * 1.9, 0.05, 0.06, [0, 0.004, 0], GOLD_D); k.box(0.06, 0.05, R * 1.9, [0, 0.004, 0], GOLD_D); }
    else for (const a of [0.75, -0.75]) {                                                       // crossed bones sigil
      k.T([0, 0.03, 0], [0, a, 0], 1, () => {
        k.box(0.035, 0.016, R * 1.3, [0, 0, 0], BONE);
        for (const z of [-1, 1]) for (const x of [-1, 1]) k.ball(0.022, [x * 0.016, 0, z * R * 0.66], BONE, [1, 0.6, 1], 0);
      });
    }
    // boss = bone skull (front, +y)
    k.ball(up ? 0.08 : 0.07, [0, 0.025, 0], up ? GOLD : BONE, [1, 0.5, 1], 1);
    k.ball(0.02, [-0.026, 0.06, -0.008], SOCK, [1, 0.5, 1], 0); k.ball(0.02, [0.026, 0.06, -0.008], SOCK, [1, 0.5, 1], 0);
    k.box(0.05, 0.012, 0.012, [0, 0.058, 0.035], SOCK);
    k.ball(up ? 0.08 : 0.07, [0, -0.025, 0], up ? GOLD : BONE, [1, 0.45, 1], 0);
    for (const x of [-1, 1]) k.box(0.04, 0.02, R * 1.5, [x * 0.07, -0.032, 0], LEATHER);         // straps (back)
  });
  });
  // neck + BIG skull
  k.R([RB.HEAD, [0, 0.89, -0.04]], () => {
  k.limb([0, 0.87, -0.04], [0, 0.95, -0.01], 0.036, 0.036, BONE_M, 6);
  k.ball(0.03, [0, 0.91, -0.06], BONE, [1.2, 0.6, 1], 0);
  k.T([0, 1.03, 0.02], [-0.28, -0.1, 0.04], 1, () => {
    skull(k, [0, 0, 0], 0.14, GREEN_G, { jawOpen: 0.35, eyeR: 0.28, crack: !up });
    if (up) {
      // open-faced steel helm, gold brow band with rivets, cheek guards, tall layered crimson crest
      k.lathe([[0.158, 0.0], [0.16, 0.06], [0.135, 0.13], [0.08, 0.175], [0.0, 0.19]], 14, [0, 0, -0.02], steel, { s: [1, 1, 1.1] });
      k.lathe([[0.165, -0.005], [0.165, 0.045]], 14, [0, 0, -0.02], GOLD, { s: [1, 1, 1.1] });
      const riv = []; for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 3.6; riv.push([Math.sin(a) * 0.17, 0.02, Math.cos(a) * 0.17 * 1.1 - 0.02]); }
      k.studs(riv, 0.011, GOLD_D);
      k.box(0.02, 0.12, 0.3, [0, 0.13, -0.03], GOLD_D, [0.2, 0, 0]);                               // comb ridge base
      for (const x of [-1, 1]) {
        k.box(0.04, 0.16, 0.12, [x * 0.155, -0.06, 0.0], steel, [0, 0, x * 0.08]);
        k.studs([[x * 0.178, -0.02, 0.03], [x * 0.172, -0.1, 0.03]], 0.011, GOLD);
      }
      const crest = (u, v) => [(v - 0.5) * 0.06, 0.17 + Math.sin(u * Math.PI) * 0.16, 0.14 - u * 0.42];
      k.surf(crest, 8, 1, grad(CRIM, CRIM_L, 0.2, 0.35), { ds: true });
      k.tris(ragHem((u, v) => [(v - 0.5) * 0.06, 0.17 + Math.sin(u * Math.PI) * 0.16 * (1 - v), 0.14 - u * 0.42], 4, -0.0, k.r), CRIM);
      const crest2 = (u, v) => [(v - 0.5) * 0.04, 0.2 + Math.sin(u * Math.PI) * 0.12, 0.1 - u * 0.36];
      k.surf(crest2, 6, 1, 0xffb0a8, { ds: true });
      for (let i = 0; i < 4; i++) { const p = crest(0.7 + i * 0.09, 0.5); k.spike(p, [p[0], p[1] - 0.04 - i * 0.02, p[2] - 0.12], 0.02, i % 2 ? CRIM_L : CRIM, 4); }   // tufts
    }
  });
  });
  return finish(k, 0.9, 1.15);
}

// =====================================================================
// ZOMBIE (up: Plague Zombie)
// identity: deep forward hunch, huge drooping green head, long reaching arms
// colours: sickly green skin vs tan rags vs slate trousers; crimson wound, lime eyes
// up: bloated belly with glowing boils, violet hood, plague motes, bigger hump
// round 7: brow + droopy lids, nose, ears (one torn), teeth, forehead stitches, hair
// strands; torn shirt with exposed ribs, patches with stitches, rope belt, rag strips;
// torn sleeves with elbow bone, clawed fingers, patched trousers, shoe + bare toes;
// up: boil rims, belly stitches, bandaged forearm, hood seams
// =====================================================================
function zombie(up) {
  const k = nkit(up ? 223 : 23);
  const SK = grad(0x7ea85a, 0xc4e08e, 0.25, 1.0), SKD = 0x6a9048, NAIL = 0x9ab870, STITCH = 0x4a3048;
  const RAG = grad(0x9a6e44, 0xd8ac72, 0.35, 0.95), RAGD = 0x8a6038, PANTS = grad(0x4e5688, 0x7a84b4, 0.0, 0.5);
  const ROPE = 0xb89a5a;
  // legs: knock-kneed, right one dragging
  const L = [[-0.12, 0.06, 0.1], [-0.11, 0.26, 0.08], [-0.11, 0.48, 0]];
  const R = [[0.14, 0.06, -0.13], [0.12, 0.25, -0.05], [0.11, 0.48, 0]];
  for (const leg of [L, R]) k.R([leg === L ? RB.LEG_FL : RB.LEG_FR, leg[2]], () => {
    const left = leg === L, ry = left ? 0.2 : -0.3;
    if (left) {                                                                                 // worn shoe with a sole
      k.box(0.11, 0.06, 0.18, [leg[0][0], 0.04, leg[0][2] + 0.04], 0x8a7a68, [0, ry, 0]);
      k.box(0.115, 0.02, 0.19, [leg[0][0], 0.01, leg[0][2] + 0.04], 0x5e4e44, [0, ry, 0]);
    } else {                                                                                    // bare rotting foot + toes
      k.box(0.1, 0.06, 0.15, [leg[0][0], 0.03, leg[0][2] + 0.03], SK, [0, ry, 0]);
      for (let i = 0; i < 3; i++) k.ball(0.022, [leg[0][0] - 0.06 + i * 0.03 + 0.03, 0.022, leg[0][2] + 0.11 - i * 0.012], SK, [1, 0.8, 1.2], 0);
    }
    k.limb(leg[0], leg[1], 0.05, 0.058, left ? PANTS : SK, 8);
    k.limb(leg[1], leg[2], 0.06, 0.075, PANTS, 8);
    if (left) k.lathe([[0.066, -0.02], [0.06, 0.03]], 8, leg[0], 0x5a6294, { jag: 0.025, ds: true, s: 1, rot: [0, 0, 0], phi0: 0, phiLen: TAU });   // ragged cuff
    else {
      k.lathe([[0.07, -0.02], [0.064, 0.03]], 8, leg[1], 0x5a6294, { jag: 0.03, ds: true });              // torn trouser leg
      k.ball(0.04, [leg[1][0], leg[1][1] + 0.05, leg[1][2] + 0.055], SK, [1, 1, 0.5], 0);              // knee hole
    }
    if (left) {                                                                                 // patch with stitches
      k.box(0.07, 0.08, 0.02, [leg[1][0] - 0.01, leg[1][1] + 0.11, leg[1][2] + 0.06], 0x9a6a9a, [-0.2, 0.2, 0]);
      for (let i = 0; i < 3; i++) k.box(0.012, 0.03, 0.01, [leg[1][0] - 0.045, leg[1][1] + 0.08 + i * 0.03, leg[1][2] + 0.07], STITCH, [-0.2, 0.2, 0]);
    }
  });
  k.R([RB.BODY, [0, 0.5, 0]], () => {
  k.ball(0.16, [0, 0.5, 0], PANTS, [1, 0.6, 0.85], 1);
  // rope belt: knot and a dangling end
  if (!up) {
    k.torus(0.165, 0.016, TAU, [0, 0.53, 0.0], [Math.PI / 2 + 0.15, 0, 0], ROPE, [1, 0.9, 1], 3, 14);
    k.ball(0.028, [0.05, 0.51, 0.15], ROPE, [1.2, 1, 0.8], 0);
    k.chain([[0.05, 0.5, 0.15], [0.07, 0.42, 0.17], [0.06, 0.36, 0.17]], [0.012, 0.011, 0.008], ROPE, 4);
  }
  // hunched torso
  k.T([0, 0.48, 0], [0.62, 0.12, -0.08], 1, () => {
    k.ball(0.2, [0, 0.2, 0], RAG, [1.05, 1.25, 0.9], 2);
    k.ball(up ? 0.21 : 0.18, [0, 0.36, -0.07], RAG, [1.2, 0.95, 0.95], 1);            // hump
    k.lathe([[0.22, -0.02], [0.215, 0.05], [0.2, 0.12]], 12, [0, 0, 0], RAG, { jag: 0.07, ds: true, s: [1, 1, 0.9], fold: [5, 0.06] });   // ragged hem
    // hanging rag strips
    for (const [a, l] of [[0.6, 0.12], [2.4, 0.1], [3.6, 0.14], [5.2, 0.09]]) {
      const p = [Math.sin(a) * 0.2, 0.0, Math.cos(a) * 0.18];
      k.box(0.05, l, 0.012, [p[0], -l / 2, p[2]], RAGD, [0, a, 0.1]);
    }
    // torn shirt on the left flank: rotten skin with three bare ribs
    k.ball(0.085, [-0.17, 0.22, 0.07], SK, [0.6, 1, 0.9], 1);
    for (let i = 0; i < 3; i++) k.limb([-0.21, 0.17 + i * 0.05, 0.02], [-0.17, 0.16 + i * 0.05, 0.14], 0.013, 0.011, BONE_M, 4);
    // patch on the back with cross stitches
    k.T([0.1, 0.26, -0.19], [0.3, -0.5 + Math.PI, 0], 1, () => {
      k.box(0.11, 0.11, 0.03, [0, 0, 0], 0x7a84b4);
      for (let i = 0; i < 4; i++) for (const sy of [-1, 1]) k.box(0.01, 0.03, 0.012, [-0.045 + i * 0.03, sy * 0.055, 0.012], STITCH, [0, 0, 0.5]);
    });
    if (up) {
      // torn shirt on the hump: rotten skin + big glowing boils (read from behind)
      k.ball(0.12, [0.03, 0.44, -0.14], SK, [1.2, 0.8, 0.7], 1);
      for (const [x, y, z, r0] of [[0.07, 0.48, -0.22, 0.045], [-0.07, 0.42, -0.23, 0.04], [0.12, 0.36, -0.2, 0.035], [-0.02, 0.52, -0.18, 0.028]]) {
        k.ball(r0 * 1.35, [x, y, z], 0x6a9a3a, [1, 1, 0.7], 1);
        k.torus(r0 * 1.15, r0 * 0.25, TAU, [x, y, z - r0 * 0.3], [0, 0, 0], 0xa8c860, [1, 1, 1], 3, 8);       // inflamed rim
        k.ball(r0, [x, y, z - 0.015], LIME_G, [1, 1, 0.8], 0, [0, 0, 0], GLOW);
      }
    } else {
      k.ball(0.07, [-0.05, 0.42, -0.15], SK, [1.2, 0.9, 0.7], 0);                          // rip in the shirt
    }
  });
  // bloated belly (up) / crimson wound (base)
  if (up) {
    k.ball(0.22, [0, 0.55, 0.12], SK, [1.05, 0.95, 0.95], 2);
    k.chain([[-0.12, 0.66, 0.27], [-0.02, 0.6, 0.33], [0.1, 0.52, 0.31]], [0.008, 0.008, 0.008], STITCH, 4);   // belly scar
    for (let i = 0; i < 4; i++) { const p = lerp3([-0.1, 0.65, 0.29], [0.08, 0.53, 0.32], i / 3); k.box(0.008, 0.04, 0.01, [p[0], p[1], p[2] + 0.01], STITCH, [0, 0, 0.9]); }
    for (const [x, y, z, r0] of [[0.08, 0.6, 0.31, 0.045], [-0.1, 0.5, 0.29, 0.04], [0.02, 0.46, 0.32, 0.035], [0.15, 0.48, 0.25, 0.028]]) {
      k.ball(r0 * 1.35, [x, y, z], 0x6a9a3a, [1, 1, 0.7], 1);
      k.ball(r0, [x, y, z + 0.012], LIME_G, [1, 1, 0.8], 0, [0, 0, 0], GLOW);
    }
    k.torus(0.235, 0.022, TAU, [0, 0.47, 0.08], [Math.PI / 2 + 0.2, 0, 0], ROPE, 1, 3, 14);   // straining rope belt
    k.ball(0.03, [-0.08, 0.47, 0.3], ROPE, [1.2, 1, 0.8], 0);
  } else {
    k.ball(0.07, [0.06, 0.66, 0.2], CRIM, [1, 1.1, 0.5], 1);
    k.ball(0.04, [0.06, 0.66, 0.225], CRIM_D, [1, 1.2, 0.5], 0);
    for (let i = 0; i < 3; i++) k.box(0.01, 0.05, 0.01, [0.0 + i * 0.05, 0.6 + (i % 2) * 0.13, 0.22], STITCH, [0.3, 0, 1.2]);
  }
  });
  // arms: long, reaching forward
  const shL = [-0.21, 0.8, 0.12], shR = [0.19, 0.83, 0.16];
  const hand = (wr, tip, dx) => {
    k.ball(0.062, wr, SK, [1, 0.7, 1.25], 1);                                                   // palm
    for (let i = 0; i < 3; i++) {                                                               // clawed fingers
      const s = (i - 1) * 0.035, b = [wr[0] + s, wr[1] - 0.005, wr[2] + 0.05], m = [b[0] + s * 0.4, tip[1] + 0.02, tip[2] - 0.03 + (i === 1 ? 0.02 : 0)], t = [m[0] + s * 0.2, tip[1] - 0.015, m[2] + 0.05];
      k.limb(b, m, 0.018, 0.015, SK, 5); k.spike(m, t, 0.014, NAIL, 4);
    }
    k.spike([wr[0] - dx * 0.05, wr[1], wr[2] + 0.02], [wr[0] - dx * 0.08, wr[1] - 0.03, wr[2] + 0.07], 0.016, SK, 4);   // thumb
  };
  const sleeve = (a, el) => {                                                                 // torn sleeve end + tatters
    k.wraps(lerp3(a, el, 0.86), lerp3(a, el, 0.96), 1, 0.064, 0.016, RAGD);
    for (const dx of [-0.03, 0.02]) k.spike([el[0] + dx, el[1] - 0.03, el[2] - 0.03], [el[0] + dx * 1.3, el[1] - 0.12, el[2] - 0.04], 0.022, RAGD, 3);
  };
  k.R([RB.ARM_R, shR], () => k.ball(0.08, shR, RAG, [1, 1, 1], 1)); k.R([RB.ARM_L, shL], () => k.ball(0.08, shL, RAG, [1, 1, 1], 1));
  k.R([RB.ARM_R, shR], () => {
  const el = [0.24, 0.76, 0.38];
  k.limb(shR, el, 0.068, 0.058, RAG, 8);
  sleeve(shR, el);
  k.limb(el, [0.24, 0.74, 0.58], 0.05, 0.044, SK, 8);
  k.ball(0.035, [el[0] + 0.02, el[1] - 0.03, el[2] - 0.01], BONE, [1, 1, 1], 0);                     // elbow bone
  for (let i = 0; i < 3; i++) k.box(0.01, 0.035, 0.01, [0.24 + 0.045, 0.75, 0.43 + i * 0.04], STITCH, [0, 0, 0.3]);
  hand([0.24, 0.73, 0.62], [0.25, 0.68, 0.74], 1);
  });
  k.R([RB.ARM_L, shL], () => {
  const el = [-0.26, 0.62, 0.32];
  k.limb(shL, el, 0.068, 0.058, RAG, 8);
  sleeve(shL, el);
  k.limb(el, [-0.22, 0.58, 0.5], 0.05, 0.044, SK, 8);
  if (up) k.wraps([-0.25, 0.61, 0.36], [-0.225, 0.585, 0.46], 4, 0.052, 0.012, [0xece2c8, 0xd8c8a0]);   // bandages
  else k.ball(0.03, [el[0] - 0.03, el[1] - 0.02, el[2] - 0.01], BONE, [1, 1, 1], 0);
  hand([-0.22, 0.56, 0.54], [-0.23, 0.5, 0.65], -1);
  });
  // neck + BIG drooping head thrust forward
  k.R([RB.HEAD, [0, 0.82, 0.14]], () => {
  k.limb([0, 0.82, 0.14], [0.03, 0.84, 0.28], 0.065, 0.058, SK, 8);
  k.T([0.04, 0.85, 0.36], [-0.12, 0.0, 0.14], 1, () => {
    k.ball(0.15, [0, 0.02, 0], SK, [0.95, 1.05, 1.05], 2);
    k.ball(0.1, [0, -0.09, 0.05], SK, [1.05, 0.8, 1], 1);                               // jowls
    k.box(0.2, 0.035, 0.05, [0, 0.075, 0.125], SKD, [0.3, 0, -0.12]);                   // heavy brow
    for (const x of [-1, 1]) {
      k.ball(0.048, [x * 0.06, 0.03, 0.125], SOCK, [1, 0.9, 0.5], 1);
      glowEye(k, [x * 0.06, 0.03, 0.142], x < 0 ? 0.036 : 0.03, LIME_G);
      glowEye(k, [x * 0.06, 0.03, 0.158], x < 0 ? 0.014 : 0.012, 0xf8ffe0);
      k.box(0.07, 0.022, 0.03, [x * 0.06, 0.058 - (x > 0 ? 0.008 : 0), 0.14], SK, [0, 0, x * -0.25]);   // droopy lid
      // ears: left whole, right torn
      k.ball(x < 0 ? 0.04 : 0.03, [x * 0.142, 0.0, -0.01], SK, [0.45, 1, 0.8], 1);
    }
    k.spike([0, 0.03, 0.14], [0.005, -0.03, 0.17], 0.022, SKD, 5);                      // nose
    k.box(0.1, 0.07, 0.04, [0, -0.09, 0.14], SOCK, [0.3, 0, 0.15]);                     // gaping mouth
    for (const [x, h] of [[-0.03, 0.03], [-0.005, 0.022], [0.025, 0.028]]) k.box(0.018, h, 0.012, [x, -0.06 - h / 2, 0.155], 0xe8dca0, [0.3, 0, 0.15]);   // rotten teeth
    k.box(0.09, 0.016, 0.03, [0.006, -0.128, 0.152], SKD, [0.3, 0, 0.15]);                // lower lip
    // forehead stitches
    k.limb([-0.09, 0.14, 0.09], [0.06, 0.13, 0.11], 0.007, 0.007, STITCH, 3);
    for (let i = 0; i < 5; i++) k.box(0.008, 0.03, 0.01, [-0.08 + i * 0.035, 0.135, 0.105], STITCH, [0.4, 0, 0]);
    if (up) {
      k.spike([0.0, -0.12, 0.15], [0.01, -0.22, 0.17], 0.02, LIME_G, 4, GLOW);           // bile drool
      // violet rag hood with a seam, a patch and a rim
      const HPR = [[0.175, -0.08], [0.18, 0.03], [0.15, 0.12], [0.08, 0.18], [0, 0.2]];
      k.lathe(HPR, 12, [0, 0, -0.03], grad(VIO_D, VIO, -0.05, 0.2), { phi0: 0.85, phiLen: TAU - 1.7, jag: 0.03 });
      for (const ph of [0.85, TAU - 0.85]) {
        const pts = HPR.slice(0, 4).map(([r0, y]) => [Math.sin(ph) * (r0 + 0.008), y, Math.cos(ph) * (r0 + 0.008) - 0.03]);
        k.chain(pts, [0.016, 0.016, 0.014, 0.01], VIO_L, 4);                                     // rim
      }
      k.chain([[0, 0.205, -0.03], [0, 0.17, -0.12], [0, 0.07, -0.2], [0, -0.06, -0.2]], [0.008, 0.008, 0.008, 0.008], 0x3e2a5a, 3);   // seam
      k.box(0.07, 0.07, 0.02, [0.11, 0.08, -0.12], 0x9a6e44, [0.3, 2.3, 0]);
    } else {
      k.ball(0.12, [0, 0.08, -0.03], 0x7a6a50, [1.02, 0.55, 1.05], 1);                   // matted hair cap
      for (const [x, z, l] of [[-0.11, -0.02, 0.12], [-0.06, -0.1, 0.14], [0.04, -0.12, 0.11], [0.1, -0.05, 0.13], [0.12, 0.04, 0.08]])
        k.spike([x, 0.08, z], [x * 1.3, 0.08 - l, z * 1.3], 0.02, 0x6a5a42, 4);          // strands
    }
  });
  });
  if (up) k.R([RB.BODY, [0, 0.5, 0]], () => { for (const [x, y, z] of [[0.3, 1.0, 0.2], [-0.32, 0.9, 0.1], [0.12, 1.1, -0.1], [-0.18, 1.05, 0.35]]) k.ball(0.03, [x, y, z], LIME_G, [1, 1, 1], 0, [0, 0, 0], GLOW); });   // plague motes
  return finish(k, up ? 1.0 : 0.96, 1.0);
}

// =====================================================================
// WIGHT (up: Wraith)
// identity: floating teardrop shroud ending in a green ghost-wisp, big hood with
// green eyes, wide sleeves with long bone claws. Pale lavender-white (lightest necro)
// up: taller, torn cloak wings, bone crown, huge scythe with glowing edge, soul-fire hand
// round 7: cloth folds, violet rune hem band, rope girdle with a skull charm, hood rim +
// lining, bony jaw glimpsed under the hood, hot pupils, sleeve trims, jointed claws,
// a broken shackle; up: ribbed cloak wings, ringed crown, wrapped snath + skull socket
// =====================================================================
function wight(up) {
  const k = nkit(up ? 337 : 37);
  const S = up ? 1.06 : 1;
  const SHROUD = grad(up ? 0x6e54a8 : 0x8a74c4, up ? 0xe4dcf8 : 0xf2eefc, 0.15, 0.95);
  const TRIM = up ? VIO_D : VIO, TRIM2 = up ? 0xc8b8ec : VIO_L;
  const FOLD = [7, 0.07, 0.4];
  const BP = [0, 0.55, 0];                                                                  // floating: body pivot mid-shroud
  const PROF = [[0.17, 0.2], [0.25, 0.32], [0.25, 0.48], [0.21, 0.64], [0.16, 0.78], [0.1, 0.86]].map(([r0, y]) => [r0 * S, y]);
  k.R([RB.BODY, BP], () => {
  // shroud: teardrop with folds, hem lifted, jagged
  k.lathe(PROF, 14, [0, 0, -0.02], SHROUD, { jag: 0.09, s: [1, 1, 0.9], wob: 0.04, fold: FOLD });
  // rune band above the hem: violet with pale glyph blocks
  k.lathe([[0.226 * S, 0.27], [0.245 * S, 0.3], [0.252 * S, 0.33]], 14, [0, 0, -0.02], 0, { s: [1.02, 1, 0.92], fold: [7, 0.07, 0.95], tc: bandTC(14, TRIM, TRIM2, 0, -0.02) });
  // rope girdle with a knot, two cords and a little skull charm
  k.torus(0.218 * S, 0.016, TAU, [0, 0.6, -0.02], [Math.PI / 2, 0, 0], 0xc8b890, [1, 0.92, 1], 3, 16);
  k.ball(0.03, [0.03, 0.59, 0.19], 0xc8b890, [1.2, 1, 0.8], 0);
  k.chain([[0.03, 0.58, 0.19], [0.05, 0.5, 0.21], [0.05, 0.44, 0.22]], [0.01, 0.01, 0.008], 0xb8a880, 4);
  k.chain([[0.02, 0.58, 0.19], [-0.01, 0.48, 0.21]], [0.01, 0.008], 0xb8a880, 4);
  sigil(k, [0.05, 0.415, 0.225], 0.032, 0.1, BONE, GREEN_G);
  });
  // ghost wisp tail: fat glowing cone curling back and down + tongues
  k.R([RB.CLOTH, [0, 0.3, -0.02]], () => {
  k.T([0, 0.25, -0.04], [0.7, 0, 0], 1, () => {
    k.add(new THREE.ConeGeometry(0.14, 0.34, 8).rotateX(Math.PI).translate(0, -0.15, 0), up ? 0x4affa0 : 0x7affb8, GLOW);
    k.add(new THREE.ConeGeometry(0.07, 0.26, 6).rotateX(Math.PI).translate(0, -0.15, 0.03), 0xd8ffe8, GLOW);   // hot core
  });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.4, rad = 0.16;
    k.spike([Math.sin(a) * rad, 0.24, Math.cos(a) * rad * 0.85], [Math.sin(a) * rad * 0.6, 0.06 + k.r() * 0.05, Math.cos(a) * rad * 0.5 - 0.06], 0.045, i % 2 ? 0x5affa8 : 0x9affc8, 4, GLOW);
  }
  });
  // shoulder mantle
  k.R([RB.BODY, BP], () => {
  k.lathe([[0.25 * S, 0.66], [0.2 * S, 0.78], [0.11, 0.87]], 14, [0, 0, -0.02], SHROUD, { jag: 0.07, wob: 0.04, fold: [9, 0.06] });
  k.lathe([[0.245 * S, 0.65], [0.252 * S, 0.68]], 14, [0, 0, -0.02], TRIM, { jag: 0.05, ds: true, fold: [9, 0.06] });
  if (up) {
    // torn cloak spread behind like wings, with bony ribs
    for (const x of [-1, 1]) k.R([RB.CLOTH, [x * 0.16, 0.86, -0.1]], () => {
      const f = (u, v) => [x * (0.16 + u * 0.36), 0.86 - v * (0.5 + u * 0.15) + u * 0.12, -0.1 - u * 0.1 - v * 0.05];
      k.surf(f, 6, 3, grad(VIO_D, VIO_L, 0.3, 1.0), { ds: true });
      k.tris(ragHem(f, 6, 0.1, k.r), VIO_D, { ds: true });
      const off = (p) => [p[0], p[1], p[2] - 0.012];
      k.chain([0, 0.33, 0.66, 1].map((u) => off(f(u, 0))), [0.02, 0.018, 0.014, 0.01], BONE_M, 4);   // top bone
      for (const u of [0.45, 0.95]) k.chain([0, 0.5, 0.95].map((v) => off(f(u * (0.4 + 0.6 * v), v))), [0.012, 0.01, 0.004], BONE_D, 4);
    });
  }
  });
  // big hood with rim + lining, dark face with a bony jaw, big green eyes
  k.R([RB.HEAD, [0, 0.84, -0.01]], () => k.T([0, 0.95, 0.0], [-0.22, 0, 0], 1, () => {
    const HP = [[0.18, -0.12], [0.185, 0.0], [0.155, 0.12], [0.08, 0.2], [0.0, 0.23]];
    k.lathe(HP, 14, [0, 0, -0.02], SHROUD, { phi0: 0.75, phiLen: TAU - 1.5, fold: [5, 0.04, 0.2] });
    k.lathe(HP.map(([r0, y]) => [r0 * 0.92, y - 0.005]), 10, [0, 0, -0.02], 0x5a4488, { phi0: 0.75, phiLen: TAU - 1.5, ds: true });   // lining
    for (const ph of [0.75, TAU - 0.75]) k.chain(HP.slice(0, 4).map(([r0, y]) => [Math.sin(ph) * r0, y, Math.cos(ph) * r0 - 0.02]), [0.02, 0.02, 0.018, 0.012], TRIM, 5);   // rim
    k.spike([0, 0.17, -0.1], [0, 0.18, -0.34], 0.07, up ? 0xc8b8ec : 0xe8e4f8, 6);         // hood tip trailing back
    k.ball(0.14, [0, -0.02, -0.02], 0x3e2c64, [1, 1.05, 1], 1);                             // face void
    for (const x of [-1, 1]) { glowEye(k, [x * 0.058, 0.0, 0.115], 0.04, GREEN_G); glowEye(k, [x * 0.058, 0.0, 0.13], 0.016, 0xeaffea); }
    k.box(0.1, 0.035, 0.04, [0, -0.085, 0.1], BONE_M, [0.2, 0, 0]);                          // bony jaw in the dark
    for (let i = 0; i < 4; i++) k.box(0.014, 0.018, 0.01, [-0.03 + i * 0.02, -0.066, 0.118], BONE_W, [0.2, 0, 0]);
    if (up) {                                                                                 // bone crown on a ring
      k.torus(0.155, 0.014, TAU - 1.7, [0, 0.1, -0.02], [Math.PI / 2, 0, Math.PI / 2 + 0.85], BONE_M, [1, 0.9, 1], 3, 12);   // open at the face
      for (let i = 0; i < 5; i++) {
        const a = (i / 4 - 0.5) * 2.0, b = [Math.sin(a) * 0.15, 0.1, Math.cos(a) * 0.13 - 0.02], t = [Math.sin(a) * 0.2, 0.26 - Math.abs(i - 2) * 0.03, Math.cos(a) * 0.16 - 0.04];
        k.spike(b, t, 0.03, BONE, 5);
        k.wraps(lerp3(b, t, 0.2), lerp3(b, t, 0.4), 2, 0.024, 0.006, BONE_D);
      }
      k.ball(0.022, [0, 0.11, 0.13], GREEN_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
    }
  }));
  // sleeves + long jointed bone claws
  const claws = (w, dir) => {
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.36, m = [w[0] + Math.sin(a) * 0.05 * dir, w[1] - 0.005, w[2] + 0.075], t = [w[0] + Math.sin(a) * 0.09 * dir, w[1] - 0.04 - Math.abs(i - 1.5) * 0.015, w[2] + 0.16];
      k.limb(w, m, 0.016, 0.014, BONE, 4); k.ball(0.017, m, BONE_M, [1, 1, 1], 0); k.spike(m, t, 0.014, BONE, 4);
    }
  };
  const sleeve = (pos, rot) => {
    k.lathe([[0.1, 0], [0.085, 0.06], [0.065, 0.12]], 10, pos, SHROUD, { rot, jag: 0.04, ds: true, fold: [5, 0.08] });
    k.lathe([[0.104, 0.0], [0.1, 0.03]], 10, pos, TRIM, { rot, jag: 0.03, ds: true, fold: [5, 0.08] });
  };
  // left: reaching forward, broken shackle on the wrist
  k.R([RB.ARM_L, [-0.18, 0.8, 0.0]], () => {
  k.limb([-0.18, 0.8, 0.0], [-0.27, 0.66, 0.2], 0.06, 0.075, SHROUD, 8);
  sleeve([-0.28, 0.62, 0.3], [-1.9, 0.4, 0]);
  k.ball(0.035, [-0.29, 0.63, 0.3], BONE, [1, 1, 1], 0);
  k.wraps([-0.29, 0.635, 0.28], [-0.29, 0.635, 0.3], 1, 0.042, 0.012, STEEL_D);
  k.torus(0.02, 0.007, TAU, [-0.31, 0.6, 0.29], [0, 0.6, 0], STEEL, 1, 3, 8); k.torus(0.02, 0.007, TAU, [-0.315, 0.565, 0.29], [0, -0.6, 0], STEEL, 1, 3, 8);
  claws([-0.29, 0.63, 0.31], -1);
  if (up) flame(k, [-0.3, 0.68, 0.38], 0.08, 0xaaffb0, 0x2ad860, 5);
  });
  // right: claw (base) / great scythe (up)
  k.R([RB.ARM_R, [0.18, 0.8, 0.0]], () => {
  k.limb([0.18, 0.8, 0.0], [0.27, 0.64, 0.14], 0.06, 0.075, SHROUD, 8);
  sleeve([0.29, 0.6, 0.22], [-1.6, -0.3, 0]);
  k.ball(0.035, [0.3, 0.6, 0.24], BONE, [1, 1, 1], 0);
  if (!up) claws([0.3, 0.6, 0.25], 1);
  else k.T([0.3, 0.6, 0.25], [-0.3, 0, 0.12], 1, () => {
    const SN = grad(0x6a4a6a, 0xb0a0a0, -0.4, 0.6);
    k.limb([0, -0.5, 0], [0, 0.66, 0], 0.026, 0.024, SN, 6);
    k.wraps([0, -0.06, 0], [0, 0.08, 0], 4, 0.03, 0.009, [0x8a5a8a, 0x5a3a5a]);             // grip wraps
    k.wraps([0, 0.3, 0], [0, 0.36, 0], 2, 0.03, 0.008, [0x8a5a8a, 0x5a3a5a]);
    k.wraps([0, -0.42, 0], [0, -0.46, 0], 2, 0.03, 0.008, STEEL_D);
    k.spike([0, -0.5, 0], [0, -0.58, 0], 0.024, STEEL, 5);                                     // butt spike
    k.limb([0, 0.3, 0], [0.09, 0.33, 0.0], 0.014, 0.014, SN, 4);                                // nib handle
    k.box(0.06, 0.07, 0.06, [0, 0.64, 0], STEEL_D);
    sigil(k, [0.0, 0.66, 0.035], 0.04, 0, BONE, GREEN_G);                                       // skull socket
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, a = t * 1.9; pts.push([-Math.sin(a) * 0.38, 0.66 + (1 - Math.cos(a)) * 0.13 - t * 0.16, -0.04 + Math.cos(a) * 0.04]); }
    const blade = [], edge = [], spine = [];
    for (let i = 0; i < 8; i++) {
      const w0 = 0.14 * (1 - i / 9), w1 = 0.14 * (1 - (i + 1) / 9), a = pts[i], b = pts[i + 1];
      const a2 = [a[0], a[1] - w0, a[2]], b2 = [b[0], b[1] - w1, b[2]];
      blade.push([a, a2, b], [b, a2, b2]);
      edge.push([[a2[0], a2[1], a2[2] + 0.006], [a2[0], a2[1] + 0.025, a2[2] + 0.006], [b2[0], b2[1], b2[2] + 0.006]], [[b2[0], b2[1], b2[2] + 0.006], [a2[0], a2[1] + 0.025, a2[2] + 0.006], [b2[0], b2[1] + 0.025 * (1 - (i + 1) / 9), b2[2] + 0.006]]);
      spine.push([[a[0], a[1], a[2] + 0.007], [a[0], a[1] - 0.02, a[2] + 0.007], [b[0], b[1], b[2] + 0.007]]);
    }
    k.tris(blade, grad(0xc8d4ec, 0xf4f8ff, 0.5, 0.75), { ds: true });
    k.tris(spine, STEEL_D, { ds: true });
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
// round 7: eye whites + red irises, nose, cheekbones, lips, swept hair locks; collar
// trim, lace jabot with a ruby, gold-buttoned waistcoat with lapels, buckled belt, coat
// tails trim, lace cuffs + clawed fingers, folded boot cuffs; cape bat-wing ribs inside
// and out + hem trim. Cape back is now one continuous sheet (no centre crease/notch).
// =====================================================================
function vampire(up) {
  const k = nkit(up ? 441 : 41);
  const PALE = 0xf4ecf6, PALE_D = 0xd8c8e0, HAIR = up ? 0xf4f0f8 : 0x40305e, HAIR_L = up ? 0xd8d0ec : 0x5a4682;
  const CLOTH = grad(VIO_D, VIO, 0.2, 0.95), BOOT = grad(0x4a3668, 0x6a5290, 0.0, 0.3);
  const TRIM = up ? GOLD : VIO_L;
  // legs + boots with folded cuffs, heels and buckles
  for (const x of [-1, 1]) k.R([x < 0 ? RB.LEG_FL : RB.LEG_FR, [x * 0.085, 0.5, 0]], () => {
    const ank = [x * 0.085, 0.07, x < 0 ? 0.06 : -0.03], kn = [x * 0.09, 0.28, ank[2] * 0.5];
    k.box(0.09, 0.06, 0.18, [ank[0], 0.04, ank[2] + 0.04], 0x4a3668);
    k.box(0.07, 0.04, 0.05, [ank[0], 0.02, ank[2] - 0.03], 0x3a2a54);                           // heel
    k.box(0.094, 0.018, 0.185, [ank[0], 0.009, ank[2] + 0.04], 0x3a2a54);                      // sole
    k.limb(ank, kn, 0.05, 0.054, BOOT, 8);
    k.lathe([[0.066, -0.035], [0.07, 0.01], [0.06, 0.025]], 8, kn, 0x5e4884, { ds: true });    // folded cuff
    k.box(0.03, 0.025, 0.012, [ank[0], 0.1, ank[2] + 0.05], up ? GOLD : STEEL, [-0.2, 0, 0]);  // buckle
    k.limb(kn, [x * 0.085, 0.5, 0], 0.046, 0.056, CLOTH, 8);
    if (up) k.lathe([[0.072, 0.0], [0.074, 0.02]], 8, kn, GOLD_D);
  });
  // coat skirt / tails with a trim band
  k.R([RB.CLOTH, [0, 0.58, 0]], () => {
    k.lathe([[0.19, 0.3], [0.175, 0.39], [0.16, 0.48], [0.14, 0.6]], 14, [0, 0, -0.01], CLOTH, { phi0: 0.6, phiLen: TAU - 1.2, ds: true, jag: 0.04, fold: [6, 0.06, 0.3] });
    k.lathe([[0.196, 0.3], [0.19, 0.33]], 14, [0, 0, -0.01], TRIM, { phi0: 0.6, phiLen: TAU - 1.2, ds: true, fold: [6, 0.06] });
  });
  // torso: violet doublet + crimson waistcoat with lapels and gold buttons
  k.R([RB.BODY, [0, 0.5, 0]], () => {
  k.ball(0.16, [0, 0.7, 0], CLOTH, [1, 1.3, 0.78], 2);
  k.box(0.16, 0.3, 0.06, [0, 0.66, 0.09], grad(CRIM_D, CRIM_L, 0.52, 0.82), [-0.08, 0, 0]);
  for (const x of [-1, 1]) k.box(0.03, 0.3, 0.02, [x * 0.085, 0.67, 0.105], VIO_D, [-0.08, 0, x * -0.12]);   // lapels
  k.studs([0.58, 0.64, 0.7, 0.76].map((y) => [0, y, 0.122 + (y - 0.66) * 0.08]), 0.013, GOLD);
  k.box(0.3, 0.05, 0.2, [0, 0.54, 0.0], up ? GOLD : 0x4a3668);
  k.box(0.06, 0.055, 0.02, [0, 0.54, 0.104], up ? GOLD_D : GOLD);                               // belt buckle
  k.box(0.026, 0.024, 0.01, [0, 0.54, 0.114], up ? CRIM : 0x4a3668);
  // lace jabot: three layered ruffles + ruby brooch
  for (let i = 0; i < 3; i++) k.spike([0, 0.86 - i * 0.035, 0.08 + i * 0.012], [0, 0.74 - i * 0.03, 0.13 + i * 0.008], 0.045 - i * 0.008, i % 2 ? 0xe8e0f0 : 0xffffff, 6);
  k.ball(0.02, [0, 0.84, 0.13], RED_G, [1, 1.2, 0.6], 1, [0, 0, 0], GLOW);
  k.torus(0.022, 0.006, TAU, [0, 0.84, 0.125], [0, 0, 0], GOLD, 1, 3, 8);
  });
  // arms raised, holding the cape out like wings; lace cuffs + clawed fingers
  for (const x of [-1, 1]) k.R([x < 0 ? RB.ARM_L : RB.ARM_R, [x * 0.18, 0.83, 0]], () => {
    const shd = [x * 0.18, 0.83, 0], elb = [x * 0.33, 0.86, 0.06], hnd = [x * (up ? 0.47 : 0.44), 0.98, 0.1];
    k.ball(0.065, shd, CLOTH, [1, 0.85, 1], 1);
    if (up) {
      k.ball(0.075, [x * 0.2, 0.87, 0], GOLD, [1.2, 0.5, 1.1], 1);
      for (let i = 0; i < 4; i++) k.spike([x * (0.15 + i * 0.03), 0.85, 0.05 - i * 0.02], [x * (0.17 + i * 0.035), 0.78, 0.05 - i * 0.02], 0.009, GOLD_D, 3);   // fringe
    }
    k.limb(shd, elb, 0.048, 0.042, CLOTH, 8);
    k.limb(elb, hnd, 0.042, 0.036, CLOTH, 8);
    k.wraps(lerp3(elb, hnd, 0.78), lerp3(elb, hnd, 0.86), 2, 0.046, 0.01, TRIM);
    k.lathe([[0.03, 0], [0.058, 0.05]], 8, lerp3(elb, hnd, 0.86), 0xffffff, { rot: [0, 0, -x * 0.9], jag: 0.02, ds: true });   // lace cuff
    k.ball(0.042, hnd, PALE, [1, 1.2, 1], 1);
    for (let i = 0; i < 3; i++) { const b = [hnd[0] + x * 0.02, hnd[1] + 0.03, hnd[2] - 0.02 + i * 0.022]; k.spike(b, [b[0] + x * 0.05, b[1] + 0.05, b[2] - 0.01], 0.013, i === 1 ? PALE : PALE_D, 4); }
  });
  // neck + BIG head
  k.R([RB.HEAD, [0, 0.86, 0]], () => {
  k.limb([0, 0.85, 0], [0, 0.93, 0.01], 0.05, 0.048, PALE, 8);
  k.T([0, 1.03, 0.02], [-0.2, 0, 0], 1, () => {
    k.ball(0.125, [0, 0, 0], PALE, [0.9, 1.08, 1], 2);
    k.spike([0, -0.05, 0.08], [0, -0.14, 0.11], 0.05, PALE, 6);                               // pointed chin
    k.ball(0.13, [0, 0.05, -0.035], HAIR, [0.96, 0.9, 1.0], 2);                             // slicked hair / mane
    k.spike([0, 0.1, 0.07], [0, 0.04, 0.135], 0.05, HAIR, 4);                                // widow's peak
    k.spike([0, 0.06, -0.1], [0, -0.06, -0.17], up ? 0.1 : 0.07, HAIR, 6);
    // swept-back locks
    for (let i = 0; i < (up ? 7 : 5); i++) {
      const a = (i / ((up ? 7 : 5) - 1) - 0.5) * 2.6, b = [Math.sin(a) * 0.11, 0.1, Math.cos(a) * 0.06 - 0.03];
      k.spike(b, [Math.sin(a) * 0.15, up ? -0.1 : -0.02, -0.15 - Math.abs(Math.cos(a)) * 0.04], up ? 0.04 : 0.03, i % 2 ? HAIR_L : HAIR, 4);
    }
    for (const x of [-1, 1]) {
      k.spike([x * 0.1, 0.0, 0.0], [x * 0.19, 0.08, -0.05], 0.035, PALE, 5);                // pointed ears
      k.box(0.07, 0.018, 0.03, [x * 0.045, 0.048, 0.11], 0x4a2a5a, [0, 0, x * 0.4]);       // brows
      k.ball(0.028, [x * 0.045, 0.015, 0.104], 0xfff4f4, [1.25, 0.75, 0.5], 1);             // eye white
      glowEye(k, [x * 0.043, 0.015, 0.115], 0.019, RED_G);                                   // iris
      glowEye(k, [x * 0.043, 0.015, 0.122], 0.007, 0xffe0c0);
      k.ball(0.03, [x * 0.07, -0.03, 0.085], PALE_D, [1, 0.6, 0.6], 0);                      // cheekbone shadow
      k.spike([x * 0.022, -0.07, 0.105], [x * 0.022, -0.118, 0.108], 0.012, 0xffffff, 3);   // fangs
    }
    k.spike([0, 0.02, 0.11], [0, -0.03, 0.14], 0.018, PALE, 4);                              // nose
    k.box(0.07, 0.02, 0.02, [0, -0.065, 0.11], 0x9a1a2a);                                    // lips
    k.box(0.05, 0.012, 0.016, [0, -0.08, 0.108], 0xc03040);
    if (up) {                                                                                 // gold crown
      k.lathe([[0.112, 0.08], [0.118, 0.12]], 10, [0, 0, -0.01], GOLD);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; k.spike([Math.sin(a) * 0.115, 0.115, Math.cos(a) * 0.115 - 0.01], [Math.sin(a) * 0.13, 0.2 + (i === 0 ? 0.04 : 0), Math.cos(a) * 0.13 - 0.01], 0.03, GOLD, 4); }
      k.ball(0.022, [0, 0.115, 0.115], RED_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
    }
  });
  });
  // tall flared collar: violet outside, crimson inside, trimmed rim
  const collar = (inset) => (u, v) => {
    const a = (u - 0.5) * 3.4, rad = (0.12 + v * 0.1 - inset) * (1 + Math.abs(u - 0.5) * 0.3);
    return [Math.sin(a) * rad, 0.84 + v * (up ? 0.36 : 0.3) + Math.abs(u - 0.5) * 0.08 * v, -Math.cos(a) * rad * 0.9 - 0.03];
  };
  k.R([RB.BODY, [0, 0.5, 0]], () => {
    k.surf(collar(0), 10, 2, up ? CRIM : VIO_D, { ds: true });
    k.surf(collar(0.008), 10, 2, up ? GOLD : CRIM, { ds: true });
    k.tris(surfBand(collar(-0.004), 10, 0.9, 1.0), TRIM, { ds: true });
  });
  // bat-wing cape: from the shoulders out to the raised hands, scalloped hem.
  // Round 7: the centre wraps smoothly round the back (x eases from 0), so the two
  // halves form one continuous sheet: no crease or ink notch down the middle.
  const SPAN = up ? 0.5 : 0.46, NS = 3, A0 = 0.22;
  const cape = (inset) => (u, v) => {
    const s = u - 0.5, as = Math.abs(s) * 2, sg = s < 0 ? -1 : 1;                             // 0 centre .. 1 hand
    const scallop = 1 - 0.2 * Math.sin(Math.PI * ((as * NS) % 1)) * smooth(0.55, 1, v);
    const vv = v * scallop;
    const x = sg * (as < A0 ? 0.12 * Math.sin((as / A0) * Math.PI / 2) : 0.12 + ((as - A0) / (1 - A0)) * (SPAN - 0.12));
    const yTop = 0.86 + as * as * 0.12, yBot = 0.08 + as * as * 0.5;
    const y = yTop + (yBot - yTop) * vv;
    const z = -0.06 - (1 - as) * 0.15 * (0.5 + vv) + as * 0.1 + inset;               // centre bows clear of the coat tails
    return [x, y, z];
  };
  // the two cape halves are the bat wings (split per triangle, geometry unchanged);
  // shared pivot at the nape so the halves stay joined at the top
  const wingOf = (ctr) => [ctr.x < 0 ? RB.WING_L : RB.WING_R, [0, 0.86, -0.12]];
  k.R(wingOf, () => {
  // colour fades toward the hem by the sheet's own v (not world y), so the long centre
  // panel doesn't turn into a dark wedge from behind
  const capeCol = (lo, hi) => { const A = C(lo), Bc = C(hi), t = new THREE.Color(); return (p) => {
    const as = Math.min(1, Math.abs(p.x) / SPAN), yT = 0.86 + as * as * 0.12, yB = 0.08 + as * as * 0.5;
    return t.copy(Bc).lerp(A, 0.85 * smooth(0.05, 1.0, (yT - p.y) / (yT - yB))); }; };
  k.surf(cape(0), 16, 4, capeCol(up ? CRIM_D : VIO_D, up ? CRIM_L : VIO_L), { ds: true });
  k.surf(cape(0.012), 16, 4, capeCol(up ? VIO_D : CRIM_D, up ? VIO : CRIM_L), { ds: true });
  k.tris(surfBand(cape(-0.006), 16, 0.92, 1.0), up ? GOLD : VIO_L, { ds: true });            // hem trim
  if (up) k.tris(surfBand(cape(-0.006), 16, 0.8, 0.84), GOLD_D, { ds: true });
  // bat-wing ribs: from the raised hands down to each scallop point, outside and inside
  for (const sg of [-1, 1]) for (const [inset, col] of [[-0.01, up ? CRIM_D : VIO_D], [0.022, up ? VIO_D : CRIM_D]]) {
    for (const as of [1 / 3, 2 / 3, 1]) {
      const u = 0.5 + sg * as / 2, f = cape(inset);
      const pts = [0.1, 0.4, 0.7, 0.92].map((v) => f(u, v));
      k.chain(pts, [0.011, 0.01, 0.008, 0.004], col, 4);
    }
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
// round 7: robe folds, rune hem band, gold-edged front panel with glyphs, sash with a
// skull buckle + hanging bead cords, skull pendant, ridged pauldrons, sleeve trims, bone
// fingers, wrapped staff with bone rings + a little skull under the orb, crown gems
// =====================================================================
function lich(up) {
  const k = nkit(up ? 553 : 53);
  const ROBE = grad(0x56348c, 0xa47ae0, 0.0, 0.85);
  const TRIM = up ? GOLD : CRIM;
  const lift = up ? 0.1 : 0;
  if (up) { flame(k, [0, 0.0, 0], 0.16, 0x9aff9a, 0x2ad860, 6); }                          // pyre: static (ROOT)
  k.T([0, lift, 0], [0, 0, 0], 1, () => {
    k.R([RB.BODY, [0, 0.3 + lift, 0]], () => {
    // robe bell with folds, a hem, a rune band and a front panel
    k.lathe([[0.3, 0.04], [0.285, 0.1], [0.27, 0.14], [0.24, 0.28], [0.21, 0.42], [0.17, 0.62], [0.2, 0.78], [0.1, 0.88]], 16, [0, 0, 0], ROBE, { jag: 0.05, wob: 0.03, fold: [8, 0.055, 0.15] });
    k.lathe([[0.31, 0.02], [0.3, 0.07], [0.285, 0.12]], 16, [0, 0, 0], TRIM, { jag: 0.05, fold: [8, 0.055, 0.9] });
    k.lathe([[0.282, 0.13], [0.27, 0.17]], 16, [0, 0, 0], 0, { ds: true, fold: [8, 0.055, 1], tc: bandTC(16, up ? GOLD_D : GOLD, up ? VIO_D : 0x3e2466) });
    k.box(0.13, 0.62, 0.05, [0, 0.36, 0.2], grad(CRIM_D, CRIM_L, 0.05, 0.65), [-0.13, 0, 0]);
    for (const x of [-1, 1]) k.box(0.018, 0.62, 0.056, [x * 0.07, 0.36, 0.2], GOLD, [-0.13, 0, 0]);     // panel edges
    for (const y of [0.18, 0.32, 0.46]) {                                                                 // glyphs
      const z = 0.2 + 0.03 + (0.36 - y) * Math.tan(0.13);
      k.box(0.05, 0.012, 0.01, [0, y, z], up ? GLOW_GOLD : GOLD, [-0.13, 0, 0], up ? GLOW : undefined);
      k.box(0.012, 0.05, 0.01, [0, y, z], up ? GLOW_GOLD : GOLD, [-0.13, 0, 0], up ? GLOW : undefined);
      k.box(0.03, 0.03, 0.01, [0, y, z], up ? GLOW_GOLD : GOLD, [-0.13, 0, Math.PI / 4], up ? GLOW : undefined);
    }
    if (up) { k.box(0.17, 0.05, 0.06, [0, 0.66, 0.15], GOLD, [-0.13, 0, 0]); k.ball(0.04, [0, 0.66, 0.19], GREEN_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW); }
    // sash with a skull buckle and bead cords
    k.torus(0.178, 0.022, TAU, [0, 0.6, 0.0], [Math.PI / 2 + 0.05, 0, 0], up ? GOLD_D : 0x8a2a40, [1, 0.92, 1], 4, 16);
    sigil(k, [0.0, 0.6, 0.17], 0.04, 0, up ? GOLD : BONE, null, -0.1);
    for (const x of [-0.05, 0.06]) for (let i = 0; i < 4; i++) k.studs([[x + i * 0.004, 0.555 - i * 0.04, 0.2 + i * 0.006]], 0.016, i === 3 ? (up ? GOLD : CRIM) : BONE);
    // skull pendant on a gold chain
    k.torus(0.08, 0.007, Math.PI * 0.8, [0, 0.82, 0.1], [0.5, 0, Math.PI * 1.1], GOLD, 1, 3, 10);
    sigil(k, [0, 0.73, 0.18], 0.035, 0, BONE, GREEN_G, -0.3);
    // ridged bone pauldrons with spikes
    for (const x of [-1, 1]) {
      k.ball(0.1, [x * 0.2, 0.82, -0.01], ROBE, [1.1, 0.75, 1], 1);
      k.ball(0.075, [x * 0.22, 0.88, 0.0], BONE, [1, 0.85, 1], 1);
      k.torus(0.07, 0.012, TAU, [x * 0.22, 0.865, 0.0], [Math.PI / 2, 0, x * 0.2], BONE_D, 1, 3, 12);
      k.ball(0.05, [x * 0.24, 0.8, 0.0], BONE_M, [1, 0.7, 1], 1);                                  // lower lame
      const b = [x * 0.25, 0.9, -0.02], t = [x * (up ? 0.42 : 0.38), up ? 1.08 : 1.02, -0.06];
      k.spike(b, t, 0.035, BONE_M, 6);
      k.wraps(lerp3(b, t, 0.15), lerp3(b, t, 0.45), 3, 0.03, 0.006, BONE_D);
      k.spike([x * 0.2, 0.9, 0.05], [x * 0.28, 0.98, 0.09], 0.02, BONE_M, 4);
    }
    // high collar behind the head
    k.lathe([[0.13, 0.84], [up ? 0.22 : 0.18, up ? 1.12 : 1.04]], 8, [0, 0, -0.02], up ? grad(GOLD_D, GOLD, 0.84, 1.1) : grad(0x5a3a8a, 0xb88ce8, 0.84, 1.05), { phi0: Math.PI / 2 + 0.3, phiLen: Math.PI - 0.6, ds: true });
    k.lathe([[up ? 0.218 : 0.178, up ? 1.1 : 1.025], [up ? 0.226 : 0.186, up ? 1.13 : 1.05]], 8, [0, 0, -0.02], up ? GOLD_D : GOLD, { phi0: Math.PI / 2 + 0.3, phiLen: Math.PI - 0.6, ds: true });
    });
    const sleeve = (pos, rot) => {
      k.lathe([[0.11, 0], [0.09, 0.07], [0.07, 0.14]], 10, pos, ROBE, { rot, ds: true, jag: 0.03, fold: [5, 0.07] });
      k.lathe([[0.114, -0.005], [0.108, 0.03]], 10, pos, TRIM, { rot, ds: true, fold: [5, 0.07] });
    };
    const fingers = (b, dir) => { for (let i = 0; i < 3; i++) { const p = [b[0] + (i - 1) * 0.018, b[1], b[2]]; k.limb(p, [p[0] + dir[0], p[1] + dir[1], p[2] + dir[2]], 0.01, 0.008, BONE, 4); } };
    k.R([RB.ARM_L, [-0.2, 0.82 + lift, 0]], () => {
    // left arm: wide sleeve, bone hand, green fireball
    k.limb([-0.2, 0.82, 0], [-0.29, 0.7, 0.12], 0.07, 0.09, ROBE, 8);
    sleeve([-0.31, 0.66, 0.2], [-2.0, 0.5, 0]);
    k.ball(0.04, [-0.33, 0.7, 0.24], BONE, [1, 1.2, 1], 1);
    fingers([-0.33, 0.72, 0.26], [0, 0.04, 0.04]);
    flame(k, [-0.34, 0.75, 0.28], up ? 0.12 : 0.09, 0xb0ffa0, 0x2ad860, 5);
    });
    // right arm holds the staff
    k.R([RB.ARM_R, [0.2, 0.82 + lift, 0]], () => {
    k.limb([0.2, 0.82, 0], [0.28, 0.66, 0.1], 0.07, 0.09, ROBE, 8);
    sleeve([0.3, 0.6, 0.13], [Math.PI, 0, 0]);
    k.ball(0.045, [0.31, 0.6, 0.16], BONE, [1, 1.2, 1], 1);
    for (const dy of [-0.025, 0, 0.025]) k.ball(0.014, [0.31, 0.6 + dy, 0.19], BONE_M, [1, 1, 1], 0);   // knuckles
    const sx = 0.31, sz = 0.16, top = up ? 1.2 : 1.12;
    k.limb([sx, -lift + 0.0, sz], [sx, top, sz], 0.026, 0.03, grad(0x7a5240, 0xb08a5a, 0, 1.2), 6);
    k.wraps([sx, 0.66, sz], [sx, 0.8, sz], 5, 0.031, 0.008, [0x5a3a2a, 0x8a5a3a]);              // grip wraps
    k.wraps([sx, 0.3, sz], [sx, 0.34, sz], 2, 0.032, 0.008, up ? GOLD : BONE_M);                // bone / gold rings
    k.wraps([sx, top - 0.08, sz], [sx, top - 0.04, sz], 2, 0.036, 0.009, up ? GOLD : BONE_M);
    k.spike([sx, -lift + 0.04, sz], [sx, -lift - 0.01, sz], 0.03, up ? GOLD_D : STEEL_D, 5);    // ferrule
    if (up) {
      k.torus(0.11, 0.025, Math.PI * 1.3, [sx, top + 0.09, sz], [0, 0, -Math.PI * 0.15 - Math.PI], GOLD, 1, 5, 12);   // gold crescent
      k.ball(0.085, [sx, top + 0.11, sz], GREEN_G, [1, 1, 1], 2, [0, 0, 0], GLOW);
      k.ball(0.04, [sx, top + 0.11, sz + 0.03], 0xe8ffe8, [1, 1, 1], 1, [0, 0, 0], GLOW);
      k.torus(0.16, 0.012, TAU, [sx, top + 0.11, sz], [Math.PI / 2 - 0.3, 0, 0.3], PURP_G, 1, 3, 14, GLOW);
      sigil(k, [sx, top - 0.01, sz + 0.03], 0.04, 0, BONE, GREEN_G);
    } else {
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; k.spike([sx, top - 0.02, sz], [sx + Math.sin(a) * 0.07, top + 0.12, sz + Math.cos(a) * 0.07], 0.022, BONE_M, 4); }
      k.ball(0.07, [sx, top + 0.08, sz], GREEN_G, [1, 1, 1], 2, [0, 0, 0], GLOW);
      k.ball(0.032, [sx, top + 0.08, sz + 0.03], 0xe8ffe8, [1, 1, 1], 1, [0, 0, 0], GLOW);
      sigil(k, [sx, top - 0.06, sz + 0.03], 0.035, 0, BONE, GREEN_G);
    }
    });
    // neck + BIG skull with gold crown
    k.R([RB.HEAD, [0, 0.86 + lift, 0]], () => {
    k.limb([0, 0.85, 0], [0, 0.93, 0.01], 0.04, 0.04, BONE_M, 6);
    k.T([0, 1.02, 0.03], [-0.3, 0.1, 0], 1, () => {
      skull(k, [0, 0, 0], 0.125, GREEN_G, { jawOpen: 0.3, eyeR: 0.28 });
      k.lathe([[0.13, 0.06], [0.135, 0.11]], 12, [0, 0, -0.015], grad(GOLD_D, GOLD, 0.06, 0.11));
      const n = up ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, h = (i === 0 ? 0.13 : 0.08) * (up ? 1.4 : 1);
        k.spike([Math.sin(a) * 0.13, 0.1, Math.cos(a) * 0.13 - 0.015], [Math.sin(a) * 0.15, 0.1 + h, Math.cos(a) * 0.15 - 0.015], 0.03, GOLD, 5);
        if (i) k.ball(0.012, [Math.sin(a) * 0.138, 0.085, Math.cos(a) * 0.138 - 0.015], i % 2 ? CRIM_L : PURP_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);   // gems
      }
      k.ball(0.026, [0, 0.085, 0.13], GREEN_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
    });
    });
  });
  if (up) k.R([RB.BODY, [0, 0.4, 0]], () => { for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; k.ball(0.035, [Math.sin(a) * 0.38, 0.45 + i * 0.12, Math.cos(a) * 0.3], i === 1 ? PURP_G : GREEN_G, [1, 1, 1], 0, [0, 0, 0], GLOW); } });   // motes
  return finish(k, up ? 0.9 : 0.92, 1.1);
}

// =====================================================================
// BLACK KNIGHT (up: Dread Knight)
// identity: rider on a big barded horse with a long raised lance and pennant,
// horned great helm with a red slit, crimson cape + caparison, green flame mane.
// horse: deep violet-grey (never black), lighter on top
// up: skull chanfron + bone horn, gold trims, huge spiked pauldrons, green hoof-fire,
// gold vamplate and a bigger forked pennant
// round 7: sculpted horse head (muzzle, nostrils, cheeks, brow), bridle + bit + reins,
// ridged chanfron with rivets and eye guards, laminated crinet, studded caparison with
// gold dag hem + skull sigils, fetlock feathering, saddle with cantle + stirrups;
// rider: gorget, layered pauldrons, couters, gauntlets, tassets, belt + sheathed sword,
// tabard skull sigil, helm ridge + rivets + breaths, cape trim + sigil, wrapped lance,
// forked pennant
// =====================================================================
function blackknight(up) {
  const k = nkit(up ? 667 : 67);
  const HORSE = grad(0x4a3e6c, 0x8072aa, 0.15, 1.05), BARD = grad(CRIM_D, CRIM_L, 0.35, 0.8);
  const HD = 0x3e3460, STRAP = 0x6a3a2a;
  const ARM = up ? grad(0x5e5684, 0xc4bce0, 0.6, 1.45) : steel, ARMD = up ? 0x5e5684 : STEEL_D;
  const TRIM = up ? GOLD : STEEL_L;
  // horse legs: chunky, left fore raised mid-stride; fetlock feathering + shod hooves
  const legs = [
    [[-0.12, 0.58, 0.33], [-0.13, 0.4, 0.47], [-0.12, 0.22, 0.47]],
    [[0.12, 0.58, 0.33], [0.13, 0.3, 0.35], [0.12, 0.06, 0.36]],
    [[-0.12, 0.6, -0.33], [-0.13, 0.32, -0.42], [-0.12, 0.06, -0.38]],
    [[0.12, 0.6, -0.33], [0.13, 0.32, -0.38], [0.12, 0.06, -0.3]],
  ];
  const LEGB = [RB.LEG_FL, RB.LEG_FR, RB.LEG_BL, RB.LEG_BR];
  legs.forEach(([top, knee, hoof], li) => k.R([LEGB[li], top], () => {
    k.limb(top, knee, 0.095, 0.06, HORSE, 8);
    k.ball(0.062, knee, HORSE, [1, 1, 1], 0);
    k.limb(knee, hoof, 0.055, 0.05, HORSE, 8);
    k.limb([hoof[0], hoof[1] - 0.06, hoof[2]], [hoof[0], hoof[1] + 0.04, hoof[2]], 0.07, 0.058, up ? GOLD_D : 0x5a5070, 8);
    k.wraps([hoof[0], hoof[1] - 0.055, hoof[2]], [hoof[0], hoof[1] - 0.05, hoof[2]], 1, 0.07, 0.01, up ? GOLD : STEEL);   // shoe rim
    k.lathe([[0.074, 0.01], [0.054, 0.09]], 7, hoof, 0x9a8cc0, { jag: 0.035, ds: true });                     // feathering
    if (up) k.lathe([[0.085, hoof[1] + 0.02], [0.05, hoof[1] + 0.15]], 6, [hoof[0], 0, hoof[2]], 0x7affa0, { jag: 0.04, ds: true, glow: true });
  }));
  // body + crimson caparison + gold trim + studs + dag hem
  k.R([RB.BODY, [0, 0.62, 0]], () => {
  k.ball(0.23, [0, 0.66, 0], HORSE, [0.92, 0.88, 2.15], 2);
  k.lathe([[0.26, 0.36], [0.258, 0.46], [0.255, 0.56], [0.22, 0.78]], 16, [0, 0, -0.01], BARD, { s: [1, 1, 2.1], jag: 0.05, ds: true, fold: [12, 0.025] });
  k.lathe([[0.262, 0.6], [0.258, 0.65]], 16, [0, 0, -0.01], GOLD, { s: [1, 1, 2.1] });
  k.lathe([[0.264, 0.36], [0.262, 0.39]], 16, [0, 0, -0.01], GOLD_D, { s: [1, 1, 2.1], jag: 0.05, ds: true, fold: [12, 0.025] });   // hem trim
  { const st = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; st.push([Math.sin(a) * 0.268, 0.625, Math.cos(a) * 0.268 * 2.1 - 0.01]); } k.studs(st, 0.014, GOLD_D); }
  for (const x of [-1, 1]) sigil(k, [x * 0.262, 0.5, 0.0], 0.075, x * Math.PI / 2, BONE, up ? GREEN_G : null);    // skull emblem
  });
  // neck + head (+ flame mane) on HEAD, pivot at the neck root
  k.R([RB.HEAD, [0, 0.74, 0.34]], () => {
  k.limb([0, 0.72, 0.36], [0, 1.04, 0.6], 0.14, 0.09, HORSE, 10);
  // laminated crinet
  k.lathe([[0.14, 0.0], [0.1, 0.3]], 8, [0, 0.74, 0.38], ARM, { rot: [0.64, 0, 0], ds: true, phi0: -1.9, phiLen: 3.8 });
  for (const h of [0.07, 0.15, 0.23]) { const r0 = 0.14 - h * 0.133; k.lathe([[r0 + 0.008, h], [r0 + 0.004, h + 0.025]], 8, [0, 0.74, 0.38], up ? GOLD : ARMD, { rot: [0.64, 0, 0], ds: true, phi0: -1.9, phiLen: 3.8 }); }
  k.T([0, 1.06, 0.64], [-1.0, 0, 0], 1, () => {
    k.ball(0.095, [0, 0, 0], HORSE, [0.85, 1, 1], 2);
    k.box(0.14, 0.3, 0.13, [0, -0.15, 0.0], HORSE);
    k.ball(0.085, [0, -0.29, 0.0], HORSE, [0.85, 0.8, 0.95], 1);                                // muzzle
    for (const x of [-1, 1]) {
      k.ball(0.06, [x * 0.045, -0.06, -0.025], HORSE, [0.7, 1.1, 1], 0);                        // cheeks
      k.ball(0.022, [x * 0.04, -0.34, 0.045], SOCK, [1, 1.3, 0.6], 0);                          // nostrils
      k.box(0.02, 0.2, 0.02, [x * 0.075, -0.16, 0.0], STRAP);                                    // cheek strap
      k.torus(0.03, 0.008, TAU, [x * 0.078, -0.27, -0.01], [0, Math.PI / 2, 0], up ? GOLD : STEEL, 1, 3, 8);   // bit ring
    }
    k.box(0.16, 0.025, 0.15, [0, -0.22, 0.0], STRAP);                                            // noseband
    k.box(0.16, 0.025, 0.12, [0, 0.02, -0.02], STRAP);                                           // browband
    k.box(0.1, 0.03, 0.04, [0, -0.33, -0.03], HD);                                               // mouth line
    k.box(0.16, 0.3, 0.05, [0, -0.11, 0.065], up ? BONE : STEEL);                             // chanfron (up: skull)
    k.box(0.03, 0.3, 0.02, [0, -0.11, 0.092], up ? BONE_M : STEEL_L);                           // centre ridge
    if (up) {
      for (const x of [-1, 1]) k.ball(0.03, [x * 0.04, -0.06, 0.09], SOCK, [1, 1.2, 0.5], 0);
      for (let i = 0; i < 5; i++) k.box(0.022, 0.03, 0.02, [-0.06 + i * 0.03, -0.25, 0.09], BONE_W);   // skull teeth
      k.spike([0, 0.02, 0.09], [0, 0.1, 0.3], 0.035, BONE, 6);                               // bone horn
      k.wraps([0, 0.03, 0.12], [0, 0.06, 0.2], 3, 0.028, 0.006, BONE_D);
      for (const x of [-1, 1]) k.chain([[x * 0.06, 0.05, -0.02], [x * 0.12, 0.12, -0.04], [x * 0.13, 0.21, -0.1]], [0.028, 0.018, 0], BONE_M, 5);
    } else k.studs([[-0.055, 0.0, 0.092], [0.055, 0.0, 0.092], [-0.055, -0.22, 0.092], [0.055, -0.22, 0.092]], 0.012, STEEL_L);
    for (const x of [-1, 1]) {
      k.torus(0.036, 0.01, TAU, [x * 0.082, -0.03, 0.035], [0, x * 1.2, 0], up ? GOLD : STEEL_D, 1, 3, 8);   // eye guard
      glowEye(k, [x * 0.08, -0.03, 0.04], 0.03, RED_G);
      k.box(0.05, 0.02, 0.04, [x * 0.07, 0.01, 0.05], HD, [0, 0, x * 0.3]);                      // brow
      if (!up) { k.spike([x * 0.045, 0.06, -0.03], [x * 0.07, 0.17, -0.06], 0.03, 0x4a3e6c, 5); k.spike([x * 0.047, 0.07, -0.02], [x * 0.066, 0.14, -0.045], 0.016, 0x8a5a7a, 3); }
    }
    k.spike([0, 0.06, 0.05], [0, 0.0, 0.14], 0.03, 0x3ae87a, 4, GLOW);                          // forelock flame
  });
  // reins from the bit rings back over the withers
  for (const x of [-1, 1]) k.limb([x * 0.078, 0.914, 0.867], [x * 0.06, 0.96, 0.46], 0.008, 0.008, STRAP, 4);
  // mane of green ghost-fire
  for (let i = 0; i < 6; i++) {
    const t = i / 5, base = [0, 0.86 + t * 0.24, 0.33 + t * 0.24];
    k.spike(base, [0, base[1] + 0.13, base[2] - 0.17], 0.055, i % 2 ? 0x9aff9a : 0x3ae87a, 5, GLOW);
  }
  });
  k.R([RB.TAIL, [0, 0.7, -0.46]], () => {
    k.chain([[0, 0.7, -0.46], [0, 0.6, -0.62], [0, 0.38, -0.7]], [0.055, 0.07, 0.04], 0x5a4e7c, 8);
    k.spike([0, 0.62, -0.6], [0, 0.32, -0.82], 0.06, 0x5aff8a, 5, GLOW);
    k.spike([0.03, 0.6, -0.62], [0.06, 0.36, -0.76], 0.035, 0x9aff9a, 4, GLOW);
    k.spike([-0.03, 0.6, -0.62], [-0.06, 0.38, -0.78], 0.035, 0x3ae87a, 4, GLOW);
  });
  // saddle: blanket, seat, pommel, cantle
  k.R([RB.BODY, [0, 0.62, 0]], () => {
    k.box(0.36, 0.03, 0.4, [0, 0.83, -0.05], up ? CRIM_D : 0x6a5290);
    k.box(0.37, 0.012, 0.41, [0, 0.818, -0.05], TRIM);
    k.box(0.32, 0.07, 0.32, [0, 0.86, -0.05], 0x8a5236);
    k.box(0.2, 0.1, 0.05, [0, 0.92, -0.2], 0x7a4428, [-0.2, 0, 0]);                              // cantle
    k.box(0.12, 0.08, 0.05, [0, 0.91, 0.1], 0x7a4428, [0.2, 0, 0]);                             // pommel
  });
  const RP = [0, 0.9, -0.03];                                                                  // rider pivot: seat
  k.R([RB.RIDER, RP], () => {
  for (const x of [-1, 1]) {
    k.limb([x * 0.1, 0.9, -0.03], [x * 0.22, 0.79, 0.12], 0.06, 0.055, ARM, 8);
    k.ball(0.05, [x * 0.22, 0.79, 0.12], ARM, [1, 1, 1], 0);                                    // knee cop
    k.spike([x * 0.22, 0.8, 0.15], [x * 0.23, 0.82, 0.21], 0.025, TRIM, 4);
    k.limb([x * 0.22, 0.79, 0.12], [x * 0.23, 0.53, 0.06], 0.05, 0.045, ARM, 8);
    k.box(0.08, 0.06, 0.15, [x * 0.23, 0.51, 0.09], STEEL_D);
    k.torus(0.05, 0.01, TAU, [x * 0.235, 0.49, 0.09], [0, Math.PI / 2, 0], STEEL, [1, 0.8, 1.2], 3, 10);   // stirrup
    k.box(0.02, 0.32, 0.02, [x * 0.2, 0.66, 0.02], STRAP, [-0.4, 0, x * 0.23]);                  // stirrup leather
  }
  // torso: breastplate + tassets + belt + crimson tabard with a sigil + layered pauldrons
  k.ball(0.17, [0, 1.07, 0], ARM, [1, 1.15, 0.78], 2);
  k.box(0.025, 0.2, 0.02, [0, 1.12, 0.128], TRIM, [-0.25, 0, 0]);                              // breast ridge
  k.lathe([[0.17, 0.9], [0.165, 0.96]], 12, [0, 0, -0.01], ARMD, { ds: true, s: [1, 1, 0.85] });   // tassets
  k.torus(0.155, 0.016, TAU, [0, 0.97, -0.005], [Math.PI / 2, 0, 0], STRAP, [1, 0.82, 1], 3, 14);   // belt
  k.box(0.04, 0.035, 0.016, [0.0, 0.97, 0.13], up ? GOLD : STEEL_L);
  k.box(0.15, 0.3, 0.04, [0, 0.97, 0.13], grad(CRIM_D, CRIM, 0.82, 1.12), [-0.1, 0, 0]);
  k.box(0.15, 0.04, 0.045, [0, 1.06, 0.14], GOLD, [-0.1, 0, 0]);
  for (const x of [-1, 1]) k.box(0.012, 0.3, 0.046, [x * 0.075, 0.97, 0.13], GOLD_D, [-0.1, 0, 0]);
  sigil(k, [0, 0.96, 0.16], 0.04, 0, BONE, null, -0.1);
  // sheathed sword at the left hip
  k.limb([-0.17, 0.96, 0.08], [-0.2, 0.62, -0.12], 0.024, 0.02, 0x4a3448, 6);
  k.spike([-0.2, 0.62, -0.12], [-0.205, 0.59, -0.14], 0.02, TRIM, 4);
  k.box(0.12, 0.022, 0.03, [-0.165, 0.99, 0.1], TRIM, [0.5, 0, 0]);
  k.limb([-0.165, 0.99, 0.1], [-0.16, 1.06, 0.14], 0.014, 0.014, STRAP, 4);
  k.ball(0.022, [-0.158, 1.07, 0.145], TRIM, [1, 1, 1], 0);
  k.lathe([[0.1, 1.17], [0.085, 1.22]], 12, [0, 0, 0], ARM, { ds: true });                     // gorget
  for (const x of [-1, 1]) {
    const pr = up ? 0.12 : 0.1;
    k.ball(pr, [x * 0.19, 1.15, 0], ARM, [1.15, 0.75, 1.05], 2);
    k.ball(pr * 0.85, [x * 0.215, 1.1, 0], ARM, [1.15, 0.6, 1.05], 0);                          // second lame
    k.torus(pr * 0.95, 0.016, TAU, [x * 0.19, 1.12, 0], [Math.PI / 2, 0, x * 0.25], up ? GOLD : STEEL_D, [1.15, 1, 1], 3, 12);
    k.studs([[x * 0.19, 1.22, 0.07], [x * 0.24, 1.2, -0.06]], 0.012, TRIM);
    k.spike([x * 0.22, 1.19, 0], [x * (up ? 0.38 : 0.33), up ? 1.36 : 1.3, -0.02], up ? 0.045 : 0.035, up ? BONE : STEEL_L, 6);
    if (up) { k.spike([x * 0.2, 1.2, 0.06], [x * 0.3, 1.3, 0.1], 0.03, BONE, 5); k.spike([x * 0.2, 1.2, -0.06], [x * 0.3, 1.3, -0.12], 0.03, BONE, 5); }
  }
  // crimson cape with trim and a bone sigil
  const cape = (u, v) => { const a = (u - 0.5) * 2.4; return [Math.sin(a) * (0.18 + v * 0.1), 1.16 - v * 0.44 + Math.abs(u - 0.5) * 0.1, -Math.cos(a) * (0.13 + v * 0.08) - 0.06 - v * 0.16]; };
  const capeO = (u, v) => { const p = cape(u, v); return [p[0], p[1], p[2] - 0.006]; };
  k.surf(cape, 8, 4, grad(CRIM_D, CRIM_L, 0.7, 1.1), { ds: true });
  k.tris(ragHem(cape, 6, 0.08, k.r), CRIM, { ds: true });
  k.tris(surfBand(capeO, 8, 0.0, 0.07), up ? GOLD : CRIM_D, { ds: true });
  sigil(k, cape(0.5, 0.45).map((q, i) => q + (i === 2 ? -0.012 : 0)), 0.05, Math.PI, BONE, null, -0.4);
  });
  // left arm on the reins: couter + gauntlet
  k.R([RB.ARM_L, [-0.2, 1.12, 0]], () => {
  k.limb([-0.2, 1.12, 0], [-0.21, 0.97, 0.13], 0.052, 0.046, ARM, 8);
  k.ball(0.05, [-0.21, 0.97, 0.13], ARM, [1, 1, 1], 1);
  k.limb([-0.21, 0.97, 0.13], [-0.09, 0.93, 0.26], 0.046, 0.04, ARM, 8);
  k.lathe([[0.04, 0], [0.055, 0.05]], 8, [-0.12, 0.94, 0.23], ARMD, { rot: [Math.PI / 2, -1.2, 0], ds: true });   // gauntlet cuff
  k.ball(0.048, [-0.08, 0.93, 0.28], STEEL_D, [1, 1, 1], 1);
  for (const x of [-1, 1]) k.limb([-0.08, 0.93, 0.28], [x * 0.06, 0.96, 0.46], 0.008, 0.008, STRAP, 4);   // reins to the withers
  });
  // right arm: long lance raised forward-up, forked pennant near the tip
  k.R([RB.ARM_R, [0.2, 1.12, 0]], () => {
  k.limb([0.2, 1.12, 0], [0.27, 0.98, 0.08], 0.052, 0.046, ARM, 8);
  k.ball(0.05, [0.27, 0.98, 0.08], ARM, [1, 1, 1], 1);
  k.limb([0.27, 0.98, 0.08], [0.27, 1.0, 0.22], 0.046, 0.04, ARM, 8);
  k.lathe([[0.04, 0], [0.055, 0.05]], 8, [0.27, 1.0, 0.18], ARMD, { rot: [Math.PI / 2, 0, 0], ds: true });
  k.ball(0.05, [0.27, 1.0, 0.24], STEEL_D, [1, 1, 1], 1);
  const L0 = [0.27, 0.72, -0.2], L1 = [0.29, 1.78, 0.62];
  const at = (t) => lerp3(L0, L1, t);
  k.limb(L0, at(0.86), 0.044, 0.03, grad(BONE_D, BONE, 0.7, 1.6), 6);
  k.wraps(at(0.17), at(0.27), 4, 0.046, 0.01, [0x6a3a2a, 0x4a2a20]);                            // grip
  k.add(new THREE.ConeGeometry(0.09, 0.16, 8, 1, true).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(...L1).sub(new V3(...L0)).normalize())).translate(...at(0.38)), up ? GOLD : STEEL, { ds: true });   // vamplate
  for (const t of [0.5, 0.6, 0.7]) k.wraps(at(t), at(t + 0.02), 1, 0.038, 0.008, up ? GOLD : CRIM_D);   // painted bands
  k.spike(at(0.84), L1, 0.06, STEEL_L, 6);                                                     // steel tip
  k.wraps(at(0.84), at(0.85), 1, 0.06, 0.012, up ? GOLD : STEEL_D);
  { const p0 = at(0.66), p1 = at(0.83), w = up ? 0.38 : 0.3;                                   // forked pennant streaming back
    const mid = lerp3(p0, p1, 0.5), tA = [p1[0] + 0.02, p1[1] - 0.04, p1[2] - w], tB = [p0[0] + 0.02, p0[1] - 0.1, p0[2] - w * 0.95], notch = [mid[0] + 0.02, mid[1] - 0.06, mid[2] - w * 0.6];
    k.tris([[p0, p1, notch], [p1, tA, notch], [p0, notch, tB]], grad(CRIM, CRIM_L, 1.3, 1.6), { ds: true });
    const bA = lerp3(p1, tA, 0.3), bB = lerp3(p0, tB, 0.3);
    k.tris([[lerp3(p0, p1, 0.1), lerp3(p0, p1, 0.9), [(bA[0] + bB[0]) / 2 + 0.003, (bA[1] + bB[1]) / 2, (bA[2] + bB[2]) / 2]]], up ? GOLD : BONE, { ds: true });   // field stripe
    if (up) k.tris([[at(0.58), p0, [tB[0], tB[1] - 0.1, tB[2] + 0.06]]], GOLD, { ds: true }); }
  });
  // great helm: horns, ridge, rivets, breaths + red eye slit (part of the rider)
  k.R([RB.RIDER, RP], () => k.T([0, 1.29, 0.01], [0, 0, 0], 1, () => {
    k.lathe([[0.115, -0.09], [0.12, 0.04], [0.105, 0.11], [0.05, 0.16]], 12, [0, 0, 0], ARM);
    k.box(0.18, 0.15, 0.04, [0, -0.01, 0.1], up ? 0x5e5684 : STEEL_D);
    k.box(0.16, 0.03, 0.03, [0, 0.025, 0.12], RED_G, [0, 0, 0], GLOW);
    k.box(0.19, 0.02, 0.05, [0, 0.0, 0.11], up ? GOLD_D : STEEL);                              // slit lip
    k.box(0.022, 0.2, 0.05, [0, 0.03, 0.105], up ? GOLD : STEEL_L);                             // face ridge
    k.box(0.02, 0.05, 0.25, [0, 0.13, -0.01], TRIM, [0.35, 0, 0]);                             // crown ridge
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.studs([[0.045 + j * 0.03, -0.035 - i * 0.022, 0.122]], 0.01, SOCK);   // breaths
    k.studs([[-0.11, -0.06, 0.06], [0.11, -0.06, 0.06], [-0.12, 0.02, 0.04], [0.12, 0.02, 0.04], [-0.07, -0.08, 0.1], [0.07, -0.08, 0.1]], 0.011, TRIM);
    if (up) k.box(0.18, 0.035, 0.045, [0, 0.075, 0.1], GOLD);
    for (const x of [-1, 1]) {
      const hp = [[x * 0.1, 0.05, 0], [x * 0.19, 0.12, -0.02], [x * 0.21, up ? 0.26 : 0.23, -0.07]];
      k.chain(hp, [0.034, 0.022, 0.0], BONE_M, 6);
      k.wraps(lerp3(hp[0], hp[1], 0.3), lerp3(hp[0], hp[1], 0.9), 3, 0.03, 0.006, BONE_D);
    }
    const crest = (u, v) => [(v - 0.5) * 0.05, 0.14 + Math.sin(u * Math.PI) * 0.12, 0.1 - u * 0.4];
    k.surf(crest, 8, 1, grad(CRIM, CRIM_L, 0.15, 0.3), { ds: true });
    for (let i = 0; i < 3; i++) { const p = crest(0.75 + i * 0.1, 0.5); k.spike(p, [p[0], p[1] - 0.05 - i * 0.02, p[2] - 0.1], 0.018, i % 2 ? CRIM_L : CRIM, 4); }
  }));
  return finish(k, 1.0, 1.4);
}

// =====================================================================
// BONE DRAGON (up: Ghost Dragon)
// identity: huge raised bone wings with big crimson membranes, thick ribcage over a
// plum core with green soul-fire, big horned skull, chunky spine and legs
// up: pale spectral cyan bone, glowing teal membranes, cyan heart, horn crown, wisps
// round 7: a real dragon skull (domed cranium, frowning brow ridges, deep eye sockets
// with glowing eyes, long flat snout with nostrils + side fenestrae, cheek arches, two
// rows of teeth in an open jaw, ridged swept-back horns); vertebra discs and a dorsal
// spike on every joint, six ribs + sternum keel, tail spade, toe claws + spurs,
// knuckled wing fingers with membrane veins
// =====================================================================
function bonedragon(up) {
  const k = nkit(up ? 779 : 79);
  const BN = up ? grad(0xa8d4e8, 0xeefaff, 0.2, 1.3) : grad(BONE_M, BONE, 0.2, 1.3);
  const BJ = up ? 0xc4e4f2 : BONE_M, BW = up ? 0xf4fcff : BONE, BD = up ? 0x8ab8d0 : BONE_D;
  const TOOTH = up ? 0xffffff : BONE_W, CLAW = up ? 0x6a9ab8 : 0x9a7a5a;
  const MEM = up ? grad(0x1a8aac, 0x5ad4e8, 0.6, 1.4) : grad(0x9a2848, 0xe0566e, 0.55, 1.35);
  const VEIN = up ? 0x9af4ff : 0x7a1838;
  const FIRE = up ? [0xc8f8ff, 0x3ac8f0] : [0xaaffa0, 0x2ad85a];
  const EYE = up ? CYAN_G : GREEN_G, MAW = up ? 0x2a5a8a : PLUM;
  // spine: tail tip -> skull
  const spine = [[0, 0.24, -1.0], [0, 0.34, -0.8], [0, 0.48, -0.6], [0, 0.62, -0.4], [0, 0.72, -0.18], [0, 0.76, 0.06], [0, 0.82, 0.26], [0, 1.0, 0.4], [0, 1.16, 0.48]];
  const rad = [0.02, 0.04, 0.055, 0.065, 0.07, 0.07, 0.065, 0.058, 0.05];
  // rig: tail = spine[0..3] (pivot at its root), body = spine[3..6], neck + skull = HEAD
  const TP = [RB.TAIL, spine[3]], BP = [RB.BODY, [0, 0.66, -0.1]], HP = [RB.HEAD, spine[6]];
  k.R(TP, () => k.chain(spine.slice(0, 4), rad.slice(0, 4), BN, 8, false));
  k.R(BP, () => k.chain(spine.slice(3, 7), rad.slice(3, 7), BN, 8, false));
  k.R(HP, () => k.chain(spine.slice(6), rad.slice(6), BN, 8, false));
  // vertebra disc + dorsal spike on every joint (bigger on even ones)
  for (let i = 1; i < spine.length - 1; i++) k.R(i < 4 ? TP : i < 6 ? BP : HP, () => {
    const p = spine[i], big = i % 2 === 0, d = new V3(...spine[i + 1]).sub(new V3(...spine[i - 1])).normalize();
    k.ball(rad[i] * (big ? 1.45 : 1.25), p, BW, [1, 0.9, 1], big ? 1 : 0);
    k.wraps([p[0] - d.x * 0.01, p[1] - d.y * 0.01, p[2] - d.z * 0.01], [p[0] + d.x * 0.01, p[1] + d.y * 0.01, p[2] + d.z * 0.01], 1, rad[i] * 1.2, rad[i] * 0.25, BD);
    k.spike(p, [p[0], p[1] + (big ? 0.07 : 0.045) + rad[i] * 1.4, p[2] - 0.05], rad[i] * (big ? 0.75 : 0.55), BJ, 5);
  });
  k.R(TP, () => {                                                                              // tail spade
    k.spike([0, 0.24, -0.98], [0, 0.3, -1.2], 0.06, BJ, 5);
    for (const x of [-1, 1]) k.spike([0, 0.25, -1.0], [x * 0.09, 0.26, -1.1], 0.03, BJ, 4);
    for (let i = 0; i < 3; i++) { const p = lerp3(spine[0], spine[2], 0.3 + i * 0.25); for (const x of [-1, 1]) k.spike(p, [p[0] + x * 0.07, p[1] - 0.01, p[2] - 0.03], 0.016, BD, 4); }
  });
  k.R(BP, () => {
  // plum core + six ribs (open at the bottom) + sternum keel + soul fire
  k.ball(0.17, [0, 0.55, -0.02], up ? 0x3a6a9a : PLUM, [0.85, 0.9, 1.6], 2);
  for (let i = 0; i < 6; i++) {
    const t = i / 5, z = -0.24 + t * 0.4, R = 0.17 + Math.sin(t * Math.PI) * 0.07, gap = 1.1 + (1 - Math.sin(t * Math.PI)) * 0.5, L = TAU - gap;
    const beta = 1.5 * Math.PI - L - gap / 2;
    k.add(new THREE.TorusGeometry(R, i % 2 ? 0.024 : 0.03, 4, 11, L).rotateZ(beta).scale(0.95, 1.12, 1).rotateX(0.25).translate(0, 0.76 - R * 1.08, z), BW);
  }
  k.chain([[0, 0.38, -0.12], [0, 0.34, 0.04], [0, 0.4, 0.2]], [0.022, 0.03, 0.02], BJ, 6);       // sternum keel
  flame(k, [0, 0.42, 0.0], 0.15, FIRE[0], FIRE[1], 6);
  if (up) k.ball(0.07, [0, 0.58, 0.06], CYAN_G, [1, 1.1, 1.3], 1, [0, 0, 0], GLOW);
  k.ball(0.11, [0, 0.66, -0.32], BJ, [1.5, 0.8, 1], 2);                                       // pelvis
  for (const x of [-1, 1]) k.ball(0.04, [x * 0.12, 0.66, -0.36], SOCK, [0.6, 1, 1], 0);        // hip sockets
  });
  // legs: chunky, toe claws + spur
  const foot = (ank, ft, dz) => {
    k.box(0.1, 0.045, 0.1, [ft[0], 0.025, ft[2] + 0.02], BJ);
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * 0.035, b = [ft[0] + dx, 0.03, ft[2] + 0.06], m = [ft[0] + dx * 1.4, 0.03, ft[2] + 0.11];
      k.limb(b, m, 0.016, 0.014, BN, 4);
      k.spike(m, [m[0] + dx * 0.3, 0.0, m[2] + 0.06], 0.014, CLAW, 4);
    }
    k.spike([ft[0], 0.04, ft[2] - 0.03], [ft[0], 0.02, ft[2] - 0.08 - dz], 0.014, CLAW, 4);    // spur
  };
  for (const x of [-1, 1]) {
    const hip = [x * 0.13, 0.62, -0.32], knee = [x * 0.21, 0.38, -0.18], ank = [x * 0.19, 0.13, -0.32], ft = [x * 0.19, 0.04, -0.24];
    k.R([x < 0 ? RB.LEG_BL : RB.LEG_BR, hip], () => {
    k.limb(hip, knee, 0.065, 0.05, BN, 8); k.ball(0.055, knee, BJ, [1, 1, 1], 1);
    k.spike([knee[0], knee[1], knee[2] + 0.03], [knee[0] + x * 0.02, knee[1] + 0.02, knee[2] + 0.1], 0.02, BD, 4);
    k.limb(knee, ank, 0.045, 0.036, BN, 8); k.ball(0.036, ank, BJ, [1, 1, 1], 0); k.limb(ank, ft, 0.036, 0.03, BN, 6);
    foot(ank, ft, 0.02);
    });
    const sh = [x * 0.15, 0.72, 0.2], el = [x * 0.23, 0.42, 0.14], wr = [x * 0.21, 0.13, 0.3], ff = [x * 0.21, 0.04, 0.36];
    k.R([x < 0 ? RB.LEG_FL : RB.LEG_FR, sh], () => {
    k.ball(0.06, sh, BJ, [1, 1, 1], 1);
    k.limb(sh, el, 0.058, 0.046, BN, 8); k.ball(0.05, el, BJ, [1, 1, 1], 1);
    k.spike([el[0], el[1], el[2] - 0.03], [el[0] + x * 0.02, el[1] + 0.03, el[2] - 0.1], 0.018, BD, 4);
    k.limb(el, wr, 0.042, 0.034, BN, 8); k.ball(0.032, wr, BJ, [1, 1, 1], 0); k.limb(wr, ff, 0.034, 0.03, BN, 6);
    foot(wr, ff, 0);
    });
  }
  // wings: thick bone arm + 3 knuckled fingers, big membranes with veins and scalloped edge
  const S = up ? 1.08 : 1;
  for (const x of [-1, 1]) k.R([x < 0 ? RB.WING_L : RB.WING_R, [x * 0.1, 0.8, 0.15]], () => {
    const root = [x * 0.1, 0.8, 0.15], elbow = [x * 0.42 * S, 1.08 * S, 0.1], wrist = [x * 0.68 * S, 1.3 * S, 0.0];
    const tips = [[x * 0.98 * S, 1.12 * S, -0.16], [x * 0.9 * S, 0.82, -0.28], [x * 0.64 * S, 0.62, -0.34]];
    k.limb(root, elbow, 0.055, 0.045, BN, 8); k.ball(0.055, elbow, BJ, [1, 1, 1], 1);
    k.limb(elbow, wrist, 0.045, 0.038, BN, 8); k.ball(0.05, wrist, BJ, [1, 1, 1], 1);
    k.spike(elbow, [elbow[0] - x * 0.02, elbow[1] + 0.04, elbow[2] - 0.08], 0.022, BD, 4);      // elbow spur
    k.spike(wrist, [x * 0.66 * S, 1.52 * S, -0.04], 0.04, BJ, 5);                              // thumb claw
    k.spike([x * 0.66 * S, 1.5 * S, -0.04], [x * 0.62 * S, 1.56 * S, 0.0], 0.018, CLAW, 4);
    for (const t of tips) {
      const kn = lerp3(wrist, t, 0.5);
      k.limb(wrist, kn, 0.03, 0.022, BN, 6); k.ball(0.024, kn, BJ, [1, 1, 1], 0); k.limb(kn, t, 0.022, 0.01, BN, 5);
      k.spike(t, [t[0] + x * 0.02, t[1] - 0.06, t[2] - 0.02], 0.012, CLAW, 4);                   // finger-tip talon
    }
    const back = [x * 0.12, 0.72, -0.24];
    const anchors = [tips[0], tips[1], tips[2], back], mem = [];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      const mid = lerp3(lerp3(a, b, 0.5), wrist, i === 1 ? 0.3 : 0.12);                        // scalloped edge
      const qa = lerp3(lerp3(a, b, 0.25), wrist, 0.06), qb = lerp3(lerp3(a, b, 0.75), wrist, 0.06);   // finer scallops
      mem.push([wrist, lerp3(a, wrist, 0.05), qa], [wrist, qa, mid], [wrist, mid, qb], [wrist, qb, lerp3(b, wrist, 0.05)]);
      // veins: from the wrist into each panel, slightly proud of the membrane on both sides
      for (const side of [-1, 1]) {
        const v0 = lerp3(wrist, mid, 0.15), v1 = lerp3(wrist, mid, 0.85), off = 0.008 * side;
        k.limb([v0[0], v0[1], v0[2] + off], [v1[0], v1[1], v1[2] + off], 0.008, 0.003, VEIN, 3, up ? GLOW : undefined);
      }
    }
    mem.push([wrist, back, elbow], [elbow, back, root]);
    k.tris(mem, MEM, { ds: true });
    if (up) {                                                                                  // glowing trailing edge wisps
      for (let i = 0; i < 3; i++) { const a = anchors[i], b = anchors[i + 1], m = lerp3(lerp3(a, b, 0.5), wrist, i === 1 ? 0.3 : 0.12); k.spike(m, [m[0] + x * 0.02, m[1] - 0.16, m[2] - 0.1], 0.03, 0x8af0ff, 3, GLOW); }
    }
  });
  // BIG dragon skull (local: +z snout, +y up; then scaled 1.55)
  k.R(HP, () => k.T([0, 1.22, 0.6], [0.18, 0, 0], 1.55, () => {
    // cranium + occipital point
    k.ball(0.085, [0, 0.012, -0.02], BW, [1.05, 0.85, 1.15], 2);
    k.spike([0, 0.03, -0.07], [0, 0.02, -0.17], 0.045, BJ, 6);
    // long, flat upper snout (flattened tapered cylinder) with a nasal ridge
    k.T([0, -0.005, 0.06], [0, 0, 0], [1, 0.62, 1], () => k.limb([0, 0, 0], [0, -0.03, 0.26], 0.072, 0.042, BW, 10));
    k.ball(0.04, [0, -0.02, 0.31], BW, [1.05, 0.6, 1], 1);                                     // snout tip
    k.limb([0, 0.028, 0.12], [0, 0.01, 0.3], 0.007, 0.006, BD, 4);                              // nasal suture
    for (let i = 0; i < 3; i++) k.spike([0, 0.035 - i * 0.008, 0.09 + i * 0.07], [0, 0.06 - i * 0.008, 0.06 + i * 0.07], 0.016, BJ, 4);
    // eye sockets (deep, dark) + glowing eyes with hot pupils, under frowning brow ridges
    for (const x of [-1, 1]) {
      k.ball(0.044, [x * 0.06, 0.028, 0.072], SOCK, [0.85, 0.95, 1.2], 1);
      glowEye(k, [x * 0.066, 0.032, 0.11], 0.027, EYE);
      glowEye(k, [x * 0.07, 0.034, 0.128], 0.012, 0xf4fff4);
      k.limb([x * 0.022, 0.068, 0.13], [x * 0.095, 0.07, 0.02], 0.016, 0.028, BW, 6);         // brow ridge
      k.spike([x * 0.09, 0.055, 0.02], [x * 0.12, 0.07, -0.03], 0.02, BJ, 4);
      k.ball(0.018, [x * 0.034, -0.01, 0.3], SOCK, [0.8, 0.7, 1.2], 0);                        // nostril
      k.ball(0.026, [x * 0.043, 0.004, 0.185], SOCK, [0.55, 0.6, 1.8], 1);                   // fenestra
      k.limb([x * 0.075, -0.02, 0.07], [x * 0.078, -0.045, -0.04], 0.018, 0.016, BJ, 5);      // cheek arch
      // upper teeth along the snout edge, longer fangs at the front
      const ut = [];
      for (let i = 0; i < 6; i++) {
        const z = 0.29 - i * 0.04, f = (z - 0.06) / 0.26, w = 0.072 - (0.072 - 0.042) * f, cy = -0.005 - 0.03 * f;
        const p = [x * w * 0.78, cy - w * 0.62 * 0.62, z];
        k.spike(p, [p[0], p[1] - (i === 0 ? 0.05 : i === 3 ? 0.04 : 0.026), p[2] + 0.004], i === 0 ? 0.011 : 0.008, TOOTH, 4);
      }
      // swept-back ridged horns + cheek spikes
      const hp = [[x * 0.055, 0.055, -0.03], [x * 0.12, 0.11, -0.1], [x * 0.155, 0.125, -0.22], [x * 0.15, 0.09, -0.32]];
      k.chain(hp, [0.034, 0.026, 0.016, 0], BJ, 7);
      for (let j = 0; j < 4; j++) { const p = lerp3(hp[j < 2 ? 0 : 1], hp[j < 2 ? 1 : 2], (j % 2) * 0.5 + 0.3); k.wraps(p, lerp3(p, hp[2], 0.04), 1, 0.03 - j * 0.004, 0.006, BD); }
      k.spike([x * 0.08, -0.03, -0.01], [x * 0.14, -0.06, -0.09], 0.016, BJ, 4);
      if (up) k.spike([x * 0.04, 0.07, -0.02], [x * 0.07, 0.2, -0.1], 0.025, BJ, 5);
    }
    // dark maw interior + soul-fire
    k.ball(0.05, [0, -0.045, 0.13], MAW, [0.8, 0.45, 1.6], 1);
    // lower jaw: open, two rami joined at the chin, lower teeth
    k.T([0, -0.04, 0.0], [0.55, 0, 0], 1, () => {
      for (const x of [-1, 1]) {
        k.limb([x * 0.062, 0.0, -0.01], [x * 0.03, -0.012, 0.26], 0.024, 0.017, BJ, 6);
        for (let i = 0; i < 4; i++) { const z = 0.08 + i * 0.05, p = [x * (0.06 - z * 0.11), 0.008, z]; k.spike(p, [p[0], p[1] + (i === 3 ? 0.04 : 0.025), p[2]], i === 3 ? 0.01 : 0.008, TOOTH, 4); }
      }
      k.ball(0.028, [0, -0.012, 0.26], BJ, [1.3, 0.7, 1], 1);                                    // chin
      k.box(0.07, 0.008, 0.18, [0, -0.012, 0.13], MAW);                                         // mouth floor
    });
    k.ball(0.045, [0, -0.07, 0.14], EYE, [1, 0.5, 1.6], 1, [0, 0, 0], GLOW);
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
