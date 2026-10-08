import * as THREE from 'three';

// =====================================================================
// HEX REALMS: upgraded Necropolis creatures (procedural, vertex-coloured).
// necroUpModel(id) -> { body: BufferGeometry, glow: BufferGeometry|null } | null
// ids: skelwarrior, plaguezombie, wraith, vampirelord, powerlich, dreadknight, ghostdragon
// Same size / orientation as the base creatures in units_necro.js:
// stand on y = 0, face +Z, about 1 unit tall (dread knight / ghost dragon about 1.4-1.5).
// Palette: ivory bone, violet, crimson, gold, glowing greens; ghost dragon pale cyan.
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
const grad3 = (lo, mid, hi, y0, y1, y2) => { const a = C(lo), b = C(mid), c = C(hi), t = new THREE.Color(); return (p) => (p.y < y1 ? t.copy(a).lerp(b, smooth(y0, y1, p.y)) : t.copy(b).lerp(c, smooth(y1, y2, p.y))); };
const gradZ = (back, front, z0, z1) => { const a = C(back), b = C(front), t = new THREE.Color(); return (p) => t.copy(a).lerp(b, smooth(z0, z1, p.z)); };
const lerp3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
const mat = (pos = [0, 0, 0], rot = [0, 0, 0], s = 1) =>
  new THREE.Matrix4().compose(new V3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), typeof s === 'number' ? new V3(s, s, s) : new V3(...s));

// ---------------------------------------------------------------- kit
function nkit(seed) {
  const r = rng(seed);
  const B = [], G = [];
  let M = new THREE.Matrix4();
  const stack = [];
  const k = {
    r,
    rr: (a, b) => a + (b - a) * r(),
    T(pos, rot, s, fn) { stack.push(M); M = M.clone().multiply(mat(pos, rot, s)); fn(); M = stack.pop(); },
    add(g, c, o = {}) {
      const ng = g.index ? g.toNonIndexed() : g;
      if (ng.attributes.uv) ng.deleteAttribute('uv');
      if (ng.attributes.normal) ng.deleteAttribute('normal');
      ng.applyMatrix4(M);
      (o.glow ? G : B).push({ g: ng, c, ds: o.ds, sh: o.sh ?? 1 });
      return ng;
    },
    box(w, h, d, pos, c, rot = [0, 0, 0], o) { return k.add(new THREE.BoxGeometry(w, h, d).applyMatrix4(mat(pos, rot)), c, o); },
    ball(rad, pos, c, s = [1, 1, 1], det = 1, rot = [0, 0, 0], o) { return k.add(new THREE.IcosahedronGeometry(rad, det).applyMatrix4(mat(pos, rot, s)), c, o); },
    limb(a, b, ra, rb, c, seg = 6, o) {
      const va = new V3(...a), vb = new V3(...b), len = va.distanceTo(vb);
      const g = new THREE.CylinderGeometry(rb, ra, len, seg, 1, rb === 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), vb.clone().sub(va).normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      return k.add(g, c, o);
    },
    spike(a, b, rad, c, seg = 5, o) { return k.limb(a, b, rad, 0, c, seg, o); },
    chain(pts, radii, c, seg = 6, joints = false, o) {
      for (let i = 0; i < pts.length - 1; i++) {
        k.limb(pts[i], pts[i + 1], radii[i], radii[i + 1], c, seg, o);
        if (joints && i > 0) k.ball(radii[i] * 1.25, pts[i], c, [1, 1, 1], 0, [0, 0, 0], o);
      }
    },
    torus(R, tube, arc, pos, rot, c, s = 1, rs = 4, ts = 12, o) {
      return k.add(new THREE.TorusGeometry(R, tube, rs, ts, arc).applyMatrix4(mat(pos, rot, s)), c, o);
    },
    lathe(prof, seg, pos, c, o = {}) {
      const { phi0 = 0, phiLen = TAU, jag = 0, s = 1, rot = [0, 0, 0], ds = false, wob = 0 } = o;
      const pos3 = [], idx = [];
      const cols = seg + 1;
      for (let i = 0; i < prof.length; i++) {
        for (let j = 0; j < cols; j++) {
          const th = phi0 + (j / seg) * phiLen;
          let [rad, y] = prof[i];
          if (i === 0 && jag) y += (j % 2 ? -jag * (0.5 + r()) : jag * 0.6 * r());
          if (wob) rad *= 1 + (r() - 0.5) * wob;
          pos3.push(rad * Math.sin(th), y, rad * Math.cos(th));
        }
      }
      if (phiLen >= TAU - 1e-6) for (let i = 0; i < prof.length; i++) { const a = i * cols, b = a + seg; pos3[b * 3] = pos3[a * 3]; pos3[b * 3 + 1] = pos3[a * 3 + 1]; pos3[b * 3 + 2] = pos3[a * 3 + 2]; }
      for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) {
        const a = i * cols + j, b = a + 1, d = a + cols, cc = d + 1;
        idx.push(a, b, d, b, cc, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3)); g.setIndex(idx);
      g.applyMatrix4(mat(pos, rot, s));
      return k.add(g, c, { ...o, ds });
    },
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

// merge into one geometry; soft coloured (violet) ambient occlusion, sky lift on top faces
const SHADE = C(0x6a5a9a);
function bake(parts, glow, r, scale) {
  const pos = [], nor = [], col = [], uv = [];
  const p = new V3(), n = new V3(), t = new THREE.Color();
  const a = new V3(), b = new V3(), c = new V3(), e = new V3();
  for (const part of parts) {
    const arr = part.g.attributes.position.array;
    const passes = part.ds ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < arr.length; i += 9) {
        a.fromArray(arr, i); b.fromArray(arr, i + 3); c.fromArray(arr, i + 6);
        const tri = pass ? [a, c, b] : [a, b, c];
        n.subVectors(tri[1], tri[0]).cross(e.subVectors(tri[2], tri[0]));
        if (n.lengthSq() < 1e-14) continue;
        n.normalize();
        const jit = glow ? 1 : 1 + (r() - 0.5) * 0.08;
        for (const v of tri) {
          p.copy(v);
          if (typeof part.c === 'function') t.copy(part.c(p, n)); else t.set(part.c);
          if (!glow) {
            const lit = smooth(-0.02, 0.34, p.y);
            t.lerp(SHADE, 0.16 * (1 - lit));
            const ao = 0.8 + 0.2 * lit;
            const sky = 0.94 + 0.12 * n.y;
            t.multiplyScalar(ao * sky * jit * part.sh);
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
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (!glow) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  return geo;
}
const finish = (k, scale = 1) => ({ body: bake(k.B, false, k.r, scale), glow: k.G.length ? bake(k.G, true, k.r, scale) : null });

// ---------------------------------------------------------------- palette (bright)
const CRIM = 0xc8283c, CRIM_D = 0x8a1a30, CRIM_L = 0xf04a50;
const BONE = 0xfaf0d6, BONE_M = 0xdccca4, BONE_D = 0xb0a07a, VOID = 0x3a2050;
const GREEN_G = 0x3aff7a, GREEN = 0x7aff6a, LIME_G = 0xc8ff3a, PURP_G = 0xb05aff, RED_G = 0xff3a2a, CYAN_G = 0x6ae8ff;
const STEEL = 0x9aa0b8, STEEL_L = 0xd8dcea, STEEL_D = 0x6a6a88, GOLD = 0xf0c050, GOLD_D = 0xb8862a;
const VIO = 0x7a4ab0, VIO_L = 0xb88ae0, VIO_D = 0x4a2a78;
const GLOW = { glow: true };
const bone = grad(BONE_M, BONE, 0, 1.1);
const steel = grad(STEEL_D, STEEL_L, 0.3, 1.2);

function skull(k, pos, s, eye = GREEN_G, o = {}) {
  const { jawOpen = 0.15, col = BONE, dark = VOID, eyeSize = 0.22 } = o;
  k.T(pos, o.rot || [0, 0, 0], 1, () => {
    k.ball(s, [0, 0.1 * s, -0.1 * s], col, [1, 1.02, 1.12], 1);
    k.box(1.3 * s, 0.55 * s, 0.7 * s, [0, -0.35 * s, 0.38 * s], col);
    k.box(1.55 * s, 0.22 * s, 0.4 * s, [0, 0.12 * s, 0.62 * s], col);
    for (const x of [-1, 1]) {
      k.ball(0.3 * s, [x * 0.36 * s, -0.08 * s, 0.7 * s], dark, [1, 0.95, 0.5], 0);
      k.ball(eyeSize * s, [x * 0.36 * s, -0.08 * s, 0.78 * s], eye, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
      k.box(0.22 * s, 0.3 * s, 0.5 * s, [x * 0.62 * s, -0.25 * s, 0.35 * s], col);
    }
    k.box(0.22 * s, 0.24 * s, 0.1 * s, [0, -0.38 * s, 0.75 * s], dark, [0, 0, Math.PI / 4]);
    k.box(0.95 * s, 0.14 * s, 0.12 * s, [0, -0.66 * s, 0.68 * s], 0xfffaea);
    k.T([0, -0.62 * s, 0.1 * s], [jawOpen, 0, 0], 1, () => {
      k.box(1.1 * s, 0.26 * s, 0.75 * s, [0, -0.22 * s, 0.32 * s], col);
      k.box(0.85 * s, 0.12 * s, 0.1 * s, [0, -0.06 * s, 0.66 * s], 0xfffaea);
    });
  });
}
function flame(k, pos, size, core, mid, n = 6) {
  k.ball(size * 0.45, [pos[0], pos[1] + size * 0.2, pos[2]], core, [1, 1.2, 1], 0, [0, 0, 0], GLOW);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + k.r(), rr = size * 0.4, h = size * (0.9 + k.r() * 0.9);
    const b = [pos[0] + Math.sin(a) * rr, pos[1], pos[2] + Math.cos(a) * rr];
    k.spike(b, [b[0] + Math.sin(a) * rr * 0.4, pos[1] + h, b[2] + Math.cos(a) * rr * 0.4], size * 0.32, i % 2 ? mid : core, 4, GLOW);
  }
}
const glowEye = (k, pos, r, c) => k.ball(r, pos, c, [1, 1, 0.7], 0, [0, 0, 0], GLOW);
// flat jagged-edged cloth panel hanging from a top edge (u across, v down), torn hem
function ragHem(f, n, depth, r) {
  const tris = [];
  for (let i = 0; i < n; i++) {
    const a = f(i / n, 1), b = f((i + 1) / n, 1), m = f((i + 0.5) / n, 1);
    tris.push([a, b, [m[0], m[1] - depth * (0.5 + r()), m[2]]]);
  }
  return tris;
}

// =====================================================================
// SKELETON WARRIOR: armoured skeleton, plumed helm, steel longsword, crimson shield
// =====================================================================
function skelwarrior() {
  const k = nkit(111);
  const J = BONE_M;
  const TAB = grad(CRIM_D, CRIM_L, 0.3, 0.6);
  // legs with steel greaves and gold knee cops
  for (const x of [-1, 1]) {
    const ank = [x * 0.1, 0.06, x < 0 ? 0.06 : -0.04], knee = [x * 0.115, 0.29, x < 0 ? 0.08 : 0.02], hip = [x * 0.085, 0.5, 0];
    k.box(0.085, 0.05, 0.17, [ank[0], 0.025, ank[2] + 0.04], steel);              // sabaton
    k.limb(ank, knee, 0.026, 0.032, bone);
    k.limb(lerp3(ank, knee, 0.1), lerp3(ank, knee, 0.85), 0.04, 0.046, steel, 7);   // greave
    k.ball(0.045, knee, GOLD, [1, 1, 0.9], 0);
    k.limb(knee, hip, 0.034, 0.038, bone);
  }
  // pelvis + crimson tabard skirt with gold hem
  k.ball(0.13, [0, 0.52, 0], BONE_M, [1, 0.5, 0.7], 1);
  k.lathe([[0.19, 0.3], [0.17, 0.42], [0.145, 0.57]], 12, [0, 0, 0], TAB, { jag: 0.05, ds: true, phi0: 0.45, phiLen: TAU - 0.9 });
  k.lathe([[0.183, 0.33], [0.178, 0.36]], 12, [0, 0, 0], GOLD, { ds: true, phi0: 0.45, phiLen: TAU - 0.9 });
  k.box(0.32, 0.045, 0.24, [0, 0.565, 0], 0x7a4a2a);                                // belt
  k.box(0.06, 0.06, 0.03, [0, 0.565, 0.12], GOLD);
  // spine + ribs (visible at the sides) and a steel breastplate
  k.chain([[0, 0.55, -0.03], [0, 0.68, -0.05], [0, 0.8, -0.04], [0, 0.92, -0.02]], [0.026, 0.026, 0.028, 0.024], BONE_M, 6, true);
  for (const [y, R] of [[0.83, 0.13], [0.76, 0.135], [0.69, 0.12], [0.63, 0.095]]) {
    const gap = 0.75, L = TAU - gap, beta = (L + gap / 2) - Math.PI / 2;
    k.add(new THREE.TorusGeometry(R, 0.018, 3, 12, L).rotateX(Math.PI / 2).rotateY(beta).scale(1, 1, 0.8).rotateX(-0.25).translate(0, y, 0.0), BONE);
  }
  k.lathe([[0.1, 0.64], [0.14, 0.72], [0.15, 0.82], [0.12, 0.9]], 10, [0, 0, -0.005], steel, { phi0: -1.15, phiLen: 2.3, ds: true, s: [1, 1, 0.92] });
  k.lathe([[0.122, 0.895], [0.115, 0.915]], 10, [0, 0, -0.005], GOLD, { phi0: -1.15, phiLen: 2.3, ds: true, s: [1, 1, 0.92] });
  k.ball(0.035, [0, 0.79, 0.13], GOLD, [1, 1.1, 0.5], 0);                          // chest boss
  k.ball(0.014, [0, 0.79, 0.148], GREEN_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
  // crimson cape behind, torn hem
  const cape = (u, v) => { const a = (u - 0.5) * 2.3; return [Math.sin(a) * (0.16 + v * 0.1), 0.93 - v * 0.6, -Math.cos(a) * (0.1 + v * 0.06) - 0.05 - v * 0.1]; };
  k.surf(cape, 8, 3, grad(CRIM, CRIM_L, 0.3, 0.9), { ds: true });
  k.tris(ragHem(cape, 6, 0.07, k.r), CRIM, { ds: true });
  // shoulders + pauldrons
  k.limb([-0.16, 0.9, -0.01], [0.16, 0.9, -0.01], 0.022, 0.022, BONE_M);
  for (const x of [-1, 1]) {
    k.ball(0.075, [x * 0.18, 0.93, 0], steel, [1.1, 0.7, 1], 1);
    k.torus(0.07, 0.01, TAU, [x * 0.18, 0.905, 0], [Math.PI / 2, 0, x * 0.25], GOLD, [1.1, 1, 1], 3, 10);
    k.spike([x * 0.21, 0.96, 0], [x * 0.3, 1.04, -0.02], 0.022, BONE, 4);
  }
  // sword arm (right, +x)
  k.limb([0.18, 0.9, 0], [0.24, 0.72, 0.04], 0.026, 0.022, bone);
  k.ball(0.04, [0.24, 0.72, 0.04], steel, [1, 1, 1], 0);                            // elbow cop
  k.limb([0.24, 0.72, 0.04], [0.25, 0.72, 0.22], 0.03, 0.036, steel);               // vambrace
  k.ball(0.037, [0.25, 0.72, 0.24], STEEL_L, [1, 1.1, 1], 0);
  k.T([0.25, 0.72, 0.24], [0.45, 0.1, 0], 1, () => {
    k.limb([0, -0.08, 0], [0, 0.06, 0], 0.017, 0.017, 0x6a3a22, 5);
    k.ball(0.028, [0, -0.095, 0], GOLD, [1, 1, 1], 0);
    k.box(0.2, 0.03, 0.04, [0, 0.065, 0], GOLD);
    for (const x of [-1, 1]) k.spike([x * 0.09, 0.065, 0], [x * 0.12, 0.11, 0], 0.017, GOLD, 4);
    const blade = (p) => C(0xb8c0d4).lerp(C(0xf8faff), smooth(0.08, 0.6, p.y));
    k.box(0.06, 0.5, 0.016, [0, 0.33, 0], blade);
    k.add(new THREE.ConeGeometry(0.043, 0.1, 4).scale(1, 1, 0.3).rotateY(Math.PI / 4).translate(0, 0.63, 0), blade);
    k.box(0.016, 0.4, 0.022, [0, 0.3, 0], GREEN_G, [0, 0, 0], GLOW);                 // rune fuller
  });
  // shield arm (left): round crimson shield with gold rim and bone skull
  k.limb([-0.18, 0.9, 0], [-0.24, 0.72, 0.03], 0.026, 0.022, bone);
  k.limb([-0.24, 0.72, 0.03], [-0.22, 0.62, 0.17], 0.03, 0.034, steel);
  k.T([-0.24, 0.62, 0.22], [Math.PI / 2, -0.4, 0.15], 1, () => {
    k.add(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 14), grad(CRIM_D, CRIM_L, -0.2, 0.25));
    k.add(new THREE.TorusGeometry(0.22, 0.02, 3, 14).rotateX(Math.PI / 2), GOLD);
    k.box(0.4, 0.034, 0.05, [0, -0.002, 0], GOLD_D);
    k.box(0.05, 0.034, 0.4, [0, -0.002, 0], GOLD_D);
    k.T([0, -0.03, 0], [Math.PI / 2, Math.PI, 0], 1, () => skull(k, [0, 0, 0.0], 0.07, GREEN_G, { jawOpen: 0.1 }));
  });
  // neck + skull + helm with crimson plume
  k.limb([0, 0.92, -0.02], [0, 0.99, 0.0], 0.022, 0.022, BONE_M);
  k.T([0, 1.06, 0.01], [0.1, -0.12, 0.05], 1, () => {
    skull(k, [0, 0, 0], 0.1, GREEN_G, { jawOpen: 0.3 });
    k.lathe([[0.122, 0.03], [0.125, 0.08], [0.105, 0.14], [0.06, 0.18], [0.0, 0.195]], 12, [0, 0, -0.012], steel, { s: [1, 1, 1.12] });
    k.lathe([[0.127, 0.025], [0.127, 0.055]], 12, [0, 0, -0.012], GOLD, { s: [1, 1, 1.12] });
    k.box(0.025, 0.11, 0.025, [0, 0.0, 0.135], STEEL_L);                              // nasal
    for (const x of [-1, 1]) k.box(0.025, 0.12, 0.09, [x * 0.12, -0.03, 0.03], steel, [0, 0, x * 0.1]);
    for (let i = 0; i < 6; i++) {
      const t = i / 5, z = 0.1 - t * 0.26, y = 0.19 - t * t * 0.06;
      k.spike([0, y, z], [0, y + 0.14 - t * 0.04, z - 0.1], 0.03, i % 2 ? CRIM : CRIM_L, 4);
    }
  });
  return finish(k, 0.9);
}

// =====================================================================
// PLAGUE ZOMBIE: bloated, glowing boils, violet rag hood, plague flies
// =====================================================================
function plaguezombie() {
  const k = nkit(223);
  const SK = grad(0x8aa060, 0xd0e098, 0.2, 1.0), SK_D = 0x6a8048;
  const RAG = ((g) => (p) => g(p).multiplyScalar(Math.sin(p.x * 31 + p.y * 17) * Math.sin(p.z * 23 - p.y * 29) > 0.35 ? 0.78 : 1))(grad(VIO_D, VIO_L, 0.3, 1.0));
  const PANTS = grad(0x6a5a44, 0x9a8466, 0, 0.5);
  // legs: wide stance under the bulk
  const L = [[-0.15, 0.05, 0.08], [-0.13, 0.25, 0.06], [-0.12, 0.44, 0]];
  const R = [[0.16, 0.05, -0.1], [0.14, 0.24, -0.04], [0.12, 0.44, 0]];
  for (const leg of [L, R]) {
    k.box(0.11, 0.06, 0.18, [leg[0][0], 0.03, leg[0][2] + 0.04], SK_D, [0, leg === L ? 0.2 : -0.3, 0]);
    k.limb(leg[0], leg[1], 0.05, 0.062, SK);
    k.limb(leg[1], leg[2], 0.062, 0.08, PANTS);
  }
  k.lathe([[0.09, 0.18], [0.07, 0.3]], 7, [-0.13, 0, 0.06], PANTS, { jag: 0.05, ds: true });
  // bloated belly (swollen, bursting with green boils)
  k.ball(0.25, [0, 0.58, 0.04], SK, [1.05, 1.0, 1.0], 1);
  k.lathe([[0.27, 0.42], [0.26, 0.52]], 14, [0, 0, 0.03], PANTS, { jag: 0.05, ds: true });     // waist rag
  k.torus(0.235, 0.016, TAU, [0, 0.5, 0.03], [Math.PI / 2, 0, 0], 0x9a7a4a, 1, 3, 14);        // rope belt, straining
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + (i / 8) * 2.6 + k.rr(-0.15, 0.15), y = 0.5 + k.rr(0, 0.22), rr = 0.25 * Math.sqrt(1 - Math.pow((y - 0.58) / 0.27, 2));
    const pz = [Math.sin(a) * rr * 1.03, y, Math.cos(a) * rr + 0.04];
    const s = k.rr(0.022, 0.04);
    k.ball(s * 1.3, pz, 0x9aa848, [1, 1, 1], 0);
    k.ball(s, [pz[0] * 1.03, y, pz[2] * 1.03 + 0.005], i % 3 ? LIME_G : GREEN_G, [1, 1, 1], 0, [0, 0, 0], GLOW);
  }
  // stitched wound
  k.box(0.012, 0.16, 0.012, [0.09, 0.62, 0.28], CRIM_D, [0.1, 0, 0.3]);
  for (let i = 0; i < 4; i++) k.box(0.05, 0.008, 0.008, [0.095 - i * 0.017, 0.56 + i * 0.04, 0.285], 0x4a3a2a, [0, 0, 0.3]);
  // hunched upper body under a violet rag cloak
  k.T([0, 0.62, -0.02], [0.4, 0.1, -0.06], 1, () => {
    k.ball(0.2, [0, 0.2, -0.05], RAG, [1.2, 0.95, 0.95], 1);
    k.lathe([[0.27, -0.05], [0.25, 0.1], [0.2, 0.25], [0.12, 0.33]], 12, [0, 0, -0.05], RAG, { jag: 0.08, ds: true, wob: 0.15, phi0: 0.9, phiLen: TAU - 1.8 });
  });
  // shoulders + arms (one huge reaching arm, one dragging a chained shackle)
  const shL = [-0.25, 0.86, 0.04], shR = [0.24, 0.88, 0.08];
  k.ball(0.08, shR, RAG, [1, 1, 1], 0);
  k.limb(shR, [0.3, 0.78, 0.3], 0.07, 0.055, RAG);
  k.lathe([[0.08, -0.04], [0.06, 0.05]], 7, [0.3, 0.78, 0.3], RAG, { jag: 0.04, ds: true, rot: [Math.PI / 2 - 0.15, 0, 0] });
  k.limb([0.3, 0.78, 0.3], [0.3, 0.75, 0.52], 0.05, 0.042, SK);
  k.ball(0.058, [0.3, 0.745, 0.56], SK, [1, 0.7, 1.2], 0);
  for (let i = 0; i < 4; i++) k.spike([0.265 + i * 0.024, 0.745, 0.59], [0.26 + i * 0.028, 0.7, 0.67], 0.013, SK_D, 4);
  k.ball(0.07, shL, RAG, [1, 1, 1], 0);
  k.limb(shL, [-0.3, 0.6, 0.18], 0.065, 0.05, RAG);
  k.limb([-0.3, 0.6, 0.18], [-0.3, 0.4, 0.26], 0.048, 0.04, SK);
  k.ball(0.052, [-0.3, 0.37, 0.27], SK, [1, 1.2, 1], 0);
  k.lathe([[0.06, 0.42], [0.06, 0.48]], 8, [-0.3, 0, 0.245], 0x8a8a9a, { ds: true });        // iron shackle
  for (let i = 0; i < 5; i++) k.torus(0.022, 0.007, TAU, [-0.3 - i * 0.012, 0.4 - i * 0.075, 0.24 - i * 0.03], [0.2, i % 2 ? Math.PI / 2 : 0, 0], 0x9a9aaa, 1, 3, 6);
  k.ball(0.06, [-0.36, 0.05, 0.1], 0x8a8a9a, [1, 0.8, 1], 0);                               // chain weight
  // neck + head thrust forward, hood
  k.limb([0, 0.86, 0.12], [0.02, 0.88, 0.26], 0.07, 0.06, SK);
  k.T([0.03, 0.9, 0.32], [0.12, 0.0, 0.14], 1, () => {
    k.ball(0.125, [0, 0.02, 0], SK, [0.95, 1.05, 1.05], 1);
    k.ball(0.09, [0, -0.08, 0.04], SK, [1.05, 0.8, 1], 1);
    for (const x of [-1, 1]) {
      k.ball(0.036, [x * 0.048, 0.03, 0.105], VOID, [1, 0.9, 0.6], 0);
      glowEye(k, [x * 0.048, 0.03, 0.12], x < 0 ? 0.02 : 0.016, LIME_G);
    }
    k.box(0.08, 0.05, 0.03, [0, -0.08, 0.12], VOID, [0.3, 0, 0.2]);
    k.box(0.07, 0.015, 0.02, [0, -0.06, 0.128], 0xe8e0b0);
    k.ball(0.03, [0.07, 0.09, 0.07], GREEN_G, [1, 1, 0.5], 0, [0, 0, 0], GLOW);            // boil on scalp
    // drool of green bile
    k.spike([0.01, -0.1, 0.13], [0.02, -0.2, 0.15], 0.012, GREEN_G, 4, GLOW);
    // hood
    k.lathe([[0.145, -0.08], [0.15, 0.04], [0.12, 0.13], [0.06, 0.18], [0.0, 0.19]], 10, [0, 0, -0.03], RAG, { phi0: 0.75, phiLen: TAU - 1.5, ds: true });
    k.spike([0, 0.14, -0.1], [0.02, 0.1, -0.28], 0.055, RAG, 5);
  });
  // plague miasma: green motes and buzzing flies around
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + k.r(), rad = 0.3 + k.r() * 0.15, y = 0.45 + k.r() * 0.7;
    k.ball(0.012 + k.r() * 0.01, [Math.sin(a) * rad, y, Math.cos(a) * rad * 0.9 + 0.05], i % 2 ? LIME_G : GREEN_G, [1, 1, 1], 0, [0, 0, 0], GLOW);
  }
  for (let i = 0; i < 6; i++) {
    const a = k.r() * TAU, y = 0.95 + k.r() * 0.2;
    const p = [Math.sin(a) * 0.2 + 0.03, y, Math.cos(a) * 0.15 + 0.3];
    k.ball(0.009, p, 0x4a3a5a, [1.4, 0.8, 1], 0);
    k.box(0.03, 0.004, 0.012, [p[0], p[1] + 0.008, p[2]], 0xe8f0ff, [0, a, 0.3]);
  }
  return finish(k, 1.0);
}

// =====================================================================
// WRAITH: towering spectral reaper, lavender shroud, bone crown, green soul-fire
// =====================================================================
function wraith() {
  const k = nkit(337);
  const ROBE = (p) => C(0x5a4aa0).lerp(C(0xa8b8f0), smooth(0.08, 0.85, p.y)).lerp(C(0xeef2ff), smooth(0.8, 1.15, p.y) * 0.5);
  const IN = 0x4a3a8a;
  // long robe hovering, jagged hem
  k.lathe([[0.22, 0.14], [0.27, 0.28], [0.25, 0.48], [0.2, 0.68], [0.16, 0.84], [0.09, 0.92]], 14, [0, 0, -0.02], ROBE, { jag: 0.1, ds: true, s: [1, 1, 0.9], wob: 0.12 });
  k.lathe([[0.19, 0.16], [0.21, 0.32]], 10, [0, 0, -0.02], IN, { ds: true });
  // spectral tail and wisps (glow green/teal)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.3, rad = 0.13 + k.r() * 0.07;
    k.spike([Math.sin(a) * rad, 0.22, Math.cos(a) * rad * 0.9], [Math.sin(a) * rad * 0.7, 0.0 + k.r() * 0.05, Math.cos(a) * rad * 0.6 - 0.06], 0.032, i % 2 ? 0x2ad08a : 0x3a9ad0, 4, GLOW);
  }
  k.spike([0, 0.3, -0.05], [0, 0.02, -0.28], 0.09, 0x2a8ab0, 5, GLOW);
  // tattered cloak spread behind like wings
  for (const x of [-1, 1]) {
    const f = (u, v) => { const a = x * (0.4 + u * 1.3); return [Math.sin(a) * (0.2 + u * 0.18 + v * 0.06), 0.95 + u * 0.12 - v * (0.62 - u * 0.15), -Math.cos(a) * (0.12 + v * 0.06) - 0.06 - u * 0.06]; };
    k.surf(f, 5, 3, (p) => C(0x6a5ab0).lerp(C(0xc8d0f8), smooth(0.4, 1.05, p.y)), { ds: true });
    k.tris(ragHem(f, 5, 0.1, k.r), 0x6a5ab0, { ds: true });
  }
  // shoulder mantle of bone plates
  k.lathe([[0.24, 0.72], [0.19, 0.84], [0.11, 0.93]], 12, [0, 0, -0.02], ROBE, { jag: 0.06, ds: true, wob: 0.1 });
  for (const x of [-1, 1]) {
    k.ball(0.07, [x * 0.19, 0.88, -0.01], BONE, [1.1, 0.6, 1], 1);
    k.spike([x * 0.22, 0.9, -0.02], [x * 0.33, 1.02, -0.06], 0.022, BONE_M, 4);
  }
  // hood + crown of bone spikes
  k.T([0, 1.02, 0.0], [0.15, 0, 0], 1, () => {
    k.lathe([[0.16, -0.11], [0.165, 0.0], [0.14, 0.11], [0.08, 0.19], [0.0, 0.23]], 12, [0, 0, -0.02], ROBE, { phi0: 0.7, phiLen: TAU - 1.4, ds: true });
    k.spike([0, 0.16, -0.09], [0, 0.18, -0.3], 0.065, 0xb0c0f0, 5);
    k.ball(0.12, [0, -0.01, -0.02], VOID, [1, 1.05, 1], 1);
    glowEye(k, [-0.048, 0.0, 0.09], 0.028, GREEN_G);
    glowEye(k, [0.048, 0.0, 0.09], 0.028, GREEN_G);
    k.ball(0.012, [0, -0.055, 0.095], 0x2ad08a, [3, 1, 1], 0, [0, 0, 0], GLOW);
    k.lathe([[0.15, 0.1], [0.15, 0.135]], 10, [0, 0, -0.02], GOLD, { ds: true });
    for (let i = 0; i < 7; i++) {
      const a = -1.3 + (i / 6) * 2.6, h = i === 3 ? 0.16 : 0.09 + (1 - Math.abs(i - 3) / 3) * 0.04;
      k.spike([Math.sin(a) * 0.15, 0.13, Math.cos(a) * 0.15 - 0.02], [Math.sin(a) * 0.19, 0.13 + h, Math.cos(a) * 0.19 - 0.04], 0.018, BONE, 4);
    }
    k.ball(0.02, [0, 0.12, 0.135], GREEN_G, [1, 1.3, 0.6], 0, [0, 0, 0], GLOW);
  });
  // left arm: reaching claw wreathed in green soul-fire
  const CLAW = 0xf0f4ff;
  k.limb([-0.18, 0.84, 0.0], [-0.27, 0.7, 0.22], 0.055, 0.07, ROBE);
  k.lathe([[0.085, 0], [0.055, 0.22]], 8, [-0.22, 0.66, 0.24], ROBE, { rot: [-1.9, 0.5, 0], jag: 0.04, ds: true });
  for (let i = 0; i < 4; i++) {
    const a = -0.5 + i * 0.33;
    k.chain([[-0.27, 0.68, 0.27], [-0.27 + Math.sin(a) * 0.08, 0.7, 0.36], [-0.27 + Math.sin(a) * 0.12, 0.66 - i * 0.012, 0.43]], [0.013, 0.01, 0.002], CLAW, 4);
  }
  flame(k, [-0.27, 0.7, 0.4], 0.07, 0xb0ff9a, 0x2ad06a, 6);
  // right arm: great scythe
  k.limb([0.18, 0.84, 0.0], [0.28, 0.64, 0.12], 0.055, 0.07, ROBE);
  k.ball(0.042, [0.29, 0.6, 0.15], CLAW, [1, 1, 1], 0);
  k.T([0.3, 0.6, 0.16], [0.15, 0, 0.12], 1, () => {
    k.limb([0, -0.55, 0], [0, 0.72, 0], 0.019, 0.017, grad(0x6a4a8a, 0xa88ac8, -0.5, 0.7), 5);
    for (const y of [-0.2, 0.25]) k.lathe([[0.025, y], [0.025, y + 0.04]], 6, [0, 0, 0], GOLD);
    k.box(0.05, 0.06, 0.05, [0, 0.7, 0], GOLD);
    skull(k, [0, 0.77, 0.02], 0.035, GREEN_G);
    const pts = [];
    for (let i = 0; i <= 9; i++) { const t = i / 9, a = t * 2.0; pts.push([-Math.sin(a) * 0.42, 0.72 + (1 - Math.cos(a)) * 0.15 - t * 0.18, -0.05 + Math.cos(a) * 0.05]); }
    const tri = [], edge = [];
    for (let i = 0; i < 9; i++) {
      const w0 = 0.09 * (1 - i / 9), w1 = 0.09 * (1 - (i + 1) / 9), a = pts[i], b = pts[i + 1];
      const a2 = [a[0], a[1] - w0, a[2]], b2 = [b[0], b[1] - w1, b[2]];
      tri.push([a, a2, b], [b, a2, b2]);
      edge.push([[a2[0], a2[1], a2[2] + 0.004], [a2[0], a2[1] + 0.015, a2[2] + 0.004], [b2[0], b2[1], b2[2] + 0.004]]);
    }
    k.tris(tri, (p) => C(0xe0e8f8).lerp(C(0x9aa0c8), smooth(0.56, 0.8, p.y)), { ds: true });
    k.tris(edge, GREEN_G, { glow: true, ds: true });
  });
  // spectral chains
  for (const x of [-1, 1]) for (let i = 0; i < 5; i++) k.torus(0.022, 0.006, TAU, [x * (0.14 + i * 0.012), 0.5 - i * 0.05, 0.18 - i * 0.012], [0, i % 2 ? Math.PI / 2 : 0, 0], 0xa8b0d0, 1, 3, 6);
  return finish(k, 1.0);
}

// =====================================================================
// VAMPIRE LORD: crimson-and-gold noble, white mane, crown, vast bat cape
// =====================================================================
function vampirelord() {
  const k = nkit(441);
  const PALE = 0xece6f4, HAIR = 0xf4f0f8, COAT = grad(0x4a2a5a, 0x8a4a8a, 0.2, 0.95), BOOT = grad(0x3a2238, 0x6a3a5a, 0.05, 0.28);
  for (const x of [-1, 1]) {
    const ank = [x * 0.08, 0.06, x < 0 ? 0.06 : -0.03];
    k.box(0.075, 0.055, 0.17, [ank[0], 0.027, ank[2] + 0.04], 0x3a2238);
    k.limb(ank, [x * 0.085, 0.29, ank[2] * 0.5], 0.045, 0.05, BOOT);
    k.lathe([[0.055, 0.25], [0.06, 0.3]], 8, [x * 0.085, 0, ank[2] * 0.5], GOLD_D);           // boot cuff
    k.limb([x * 0.085, 0.29, ank[2] * 0.5], [x * 0.08, 0.5, 0], 0.037, 0.05, COAT);
  }
  // long coat with tails, gold hem
  k.lathe([[0.19, 0.26], [0.16, 0.48], [0.135, 0.6]], 12, [0, 0, -0.01], COAT, { phi0: 0.5, phiLen: TAU - 1.0, ds: true, jag: 0.03 });
  k.lathe([[0.188, 0.27], [0.183, 0.3]], 12, [0, 0, -0.01], GOLD, { phi0: 0.5, phiLen: TAU - 1.0, ds: true });
  // torso: plum doublet, crimson waistcoat with gold embroidery
  k.ball(0.155, [0, 0.71, 0], COAT, [1, 1.35, 0.78], 1);
  k.box(0.14, 0.27, 0.05, [0, 0.67, 0.09], grad(CRIM_D, CRIM_L, 0.55, 0.82), [-0.08, 0, 0]);
  for (let i = 0; i < 4; i++) k.ball(0.012, [0, 0.58 + i * 0.055, 0.12], GOLD, [1, 1, 1], 0);
  for (const x of [-1, 1]) k.box(0.012, 0.25, 0.012, [x * 0.065, 0.67, 0.116], GOLD, [-0.08, 0, 0]);
  k.box(0.28, 0.04, 0.19, [0, 0.55, 0.0], GOLD_D);
  k.box(0.05, 0.045, 0.02, [0, 0.55, 0.095], RED_G, [0, 0, 0], GLOW);
  k.spike([0, 0.87, 0.07], [0, 0.76, 0.115], 0.04, 0xffffff, 5);                             // jabot
  k.ball(0.022, [0, 0.86, 0.1], RED_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);                     // ruby brooch
  // gold epaulettes
  for (const x of [-1, 1]) {
    k.ball(0.07, [x * 0.19, 0.85, 0], COAT, [1, 0.8, 1], 0);
    k.ball(0.06, [x * 0.2, 0.88, 0], GOLD, [1.2, 0.45, 1.1], 1);
    for (let i = 0; i < 4; i++) k.limb([x * (0.2 + i * 0.012), 0.86, -0.03 + i * 0.02], [x * (0.21 + i * 0.012), 0.8, -0.03 + i * 0.02], 0.006, 0.006, GOLD, 3);
  }
  // left arm raised, clawed hand spreading the cape
  k.limb([-0.19, 0.85, 0], [-0.35, 0.87, 0.08], 0.042, 0.037, COAT);
  k.limb([-0.35, 0.87, 0.08], [-0.45, 1.01, 0.12], 0.037, 0.032, COAT);
  k.lathe([[0.045, 0], [0.04, 0.04]], 8, [-0.45, 1.0, 0.12], 0xffffff, { rot: [0, 0, 0.6], ds: true, jag: 0.015 });  // lace cuff
  k.ball(0.032, [-0.47, 1.04, 0.13], PALE, [1, 1.2, 1], 0);
  for (let i = 0; i < 3; i++) k.spike([-0.48 + i * 0.016, 1.06, 0.14], [-0.5 + i * 0.022, 1.13, 0.16], 0.009, PALE, 4);
  // right arm: gold-hilted longsword thrust forward
  k.limb([0.19, 0.85, 0], [0.25, 0.68, 0.08], 0.042, 0.037, COAT);
  k.limb([0.25, 0.68, 0.08], [0.25, 0.62, 0.24], 0.037, 0.032, COAT);
  k.ball(0.032, [0.25, 0.62, 0.26], PALE, [1, 1, 1.1], 0);
  k.T([0.25, 0.62, 0.27], [1.2, 0, 0], 1, () => {
    k.torus(0.045, 0.008, Math.PI, [0, 0.0, 0.0], [0, Math.PI / 2, 0], GOLD, 1, 3, 8);
    k.box(0.12, 0.018, 0.018, [0, 0.03, 0], GOLD);
    k.ball(0.012, [0, 0.03, 0.012], RED_G, [1, 1, 1], 0, [0, 0, 0], GLOW);
    k.box(0.024, 0.52, 0.007, [0, 0.3, 0], (p) => C(0xc8d0e0).lerp(C(0xffffff), smooth(0.05, 0.5, p.y)));
    k.spike([0, 0.56, 0], [0, 0.62, 0], 0.013, 0xffffff, 4);
  });
  // head: pale, white swept-back mane, gold crown, red eyes
  k.limb([0, 0.87, 0], [0, 0.94, 0.01], 0.042, 0.04, PALE);
  k.T([0, 1.01, 0.02], [0.05, 0, 0], 1, () => {
    k.ball(0.098, [0, 0, 0], PALE, [0.9, 1.1, 1], 1);
    k.ball(0.06, [0, -0.06, 0.03], PALE, [0.9, 0.8, 1], 0);
    k.spike([0, -0.03, 0.08], [0, -0.1, 0.1], 0.03, PALE, 4);
    k.ball(0.104, [0, 0.035, -0.02], HAIR, [0.95, 0.92, 1.05], 1);
    k.spike([0, 0.08, 0.06], [0, 0.03, 0.108], 0.04, HAIR, 4);
    for (let i = 0; i < 5; i++) { const x = -0.06 + i * 0.03; k.spike([x, 0.06, -0.06], [x * 1.4, -0.06 - (i % 2) * 0.04, -0.17], 0.035, i % 2 ? 0xe0dce8 : HAIR, 4); }
    for (const x of [-1, 1]) {
      k.spike([x * 0.08, 0.0, -0.0], [x * 0.15, 0.07, -0.04], 0.026, PALE, 4);
      k.box(0.05, 0.012, 0.02, [x * 0.035, 0.035, 0.088], 0x8a7a9a, [0, 0, x * 0.35]);
      glowEye(k, [x * 0.035, 0.012, 0.088], 0.02, RED_G);
      k.spike([x * 0.015, -0.055, 0.087], [x * 0.015, -0.09, 0.087], 0.007, 0xffffff, 3);
    }
    k.box(0.04, 0.008, 0.01, [0, -0.05, 0.092], 0xb01a30);
    // crown
    k.lathe([[0.1, 0.06], [0.104, 0.095]], 10, [0, 0, -0.01], grad(GOLD_D, GOLD, 0.06, 0.1), { ds: true, s: [0.95, 1, 1.05] });
    for (let i = 0; i < 5; i++) {
      const a = -1.0 + (i / 4) * 2.0, h = i === 2 ? 0.09 : 0.055;
      k.spike([Math.sin(a) * 0.1, 0.09, Math.cos(a) * 0.1 - 0.01], [Math.sin(a) * 0.115, 0.09 + h, Math.cos(a) * 0.115 - 0.02], 0.015, GOLD, 4);
    }
    k.ball(0.018, [0, 0.085, 0.1], RED_G, [1, 1.2, 0.6], 0, [0, 0, 0], GLOW);
  });
  // tall collar: plum outside, crimson inside, gold edge
  const collar = (inner) => (u, v) => {
    const a = (u - 0.5) * 3.4, rad = (0.11 + v * 0.09 + (inner ? -0.006 : 0)) * (1 + Math.abs(u - 0.5) * 0.3);
    return [Math.sin(a) * rad, 0.87 + v * 0.3 + Math.abs(u - 0.5) * 0.1 * v, -Math.cos(a) * rad * 0.9 - 0.02];
  };
  k.surf(collar(false), 8, 2, 0x5a2a5a, { ds: true });
  k.surf(collar(true), 8, 2, CRIM_L, { ds: true });
  { const top = []; for (let i = 0; i <= 8; i++) top.push(collar(false)(i / 8, 1)); k.chain(top, top.map(() => 0.008), GOLD, 3); }
  // vast bat-wing cape
  const NR = 6;
  const cape = (inset) => (u, v) => {
    const s = u - 0.5, as = Math.abs(s), a = s * 3.8;
    const scallop = 1 - 0.24 * Math.sin(Math.PI * ((u * NR) % 1)) * smooth(0.6, 1, v) * (as > 0.05 ? 1 : 0);
    const vv = v * scallop;
    const rad = (0.16 + vv * 0.38 + as * 0.32 * vv) - inset;
    const y = 0.88 - vv * 0.76 + as * as * 1.3 * (0.4 + vv * 0.5);
    return [Math.sin(a) * rad * 1.2, y, -Math.cos(a) * rad * 0.75 - 0.03];
  };
  k.surf(cape(0), 18, 5, gradZ(0x4a1e4a, 0x7a3a6a, -0.45, 0.1), { ds: true });
  k.surf(cape(0.012), 18, 5, grad(CRIM, CRIM_L, 0.2, 0.9), { ds: true });
  for (let i = 0; i <= NR; i++) {
    if (i === NR / 2) continue;
    const u = i / NR, pts = [], f = cape(-0.004);
    for (let v = 0; v <= 1.0001; v += 0.34) pts.push(f(u, v));
    k.chain(pts, [0.013, 0.011, 0.008, 0.004], GOLD_D, 4);
  }
  return finish(k, 1.0);
}

// =====================================================================
// POWER LICH: floating archlich, violet+gold robes, tall crown, orb staff, soul-fire
// =====================================================================
function powerlich() {
  const k = nkit(553);
  const ROBE = (p) => C(0x4a2a7a).lerp(C(0xa070d8), smooth(0.05, 0.85, p.y));
  // soul-fire pyre it hovers over
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; k.spike([Math.sin(a) * 0.2, 0.0, Math.cos(a) * 0.2], [Math.sin(a) * 0.26, 0.12 + (i % 2) * 0.08, Math.cos(a) * 0.26], 0.05, i % 2 ? 0xb0ff9a : 0x2ad06a, 4, GLOW); }
  k.ball(0.16, [0, 0.06, 0], 0x3aff8a, [1.2, 0.35, 1.2], 1, [0, 0, 0], GLOW);
  // robe (hem lifted off the ground), gold trims
  k.lathe([[0.3, 0.1], [0.26, 0.24], [0.2, 0.48], [0.16, 0.66], [0.18, 0.8], [0.08, 0.88]], 14, [0, 0, 0], ROBE, { jag: 0.06, wob: 0.08, ds: true });
  k.lathe([[0.302, 0.12], [0.28, 0.2]], 14, [0, 0, 0], grad(GOLD_D, GOLD, 0.12, 0.2), { ds: true });
  k.box(0.1, 0.62, 0.04, [0, 0.42, 0.2], grad(CRIM_D, CRIM_L, 0.1, 0.7), [-0.13, 0, 0]);
  for (const x of [-1, 1]) k.box(0.014, 0.62, 0.045, [x * 0.05, 0.42, 0.2], GOLD, [-0.13, 0, 0]);
  for (let i = 0; i < 3; i++) k.ball(0.022, [0, 0.26 + i * 0.15, 0.24 - i * 0.022], i === 1 ? GREEN_G : GOLD, [1, 1, 0.6], 0, [0, 0, 0], i === 1 ? GLOW : undefined);
  // open chest with ribs and a glowing phylactery heart
  k.ball(0.115, [0, 0.74, 0.07], VOID, [0.9, 1, 0.6], 1);
  k.ball(0.04, [0, 0.73, 0.1], GREEN_G, [1, 1.2, 0.7], 1, [0, 0, 0], GLOW);
  for (let i = 0; i < 3; i++) k.torus(0.078 - i * 0.008, 0.009, Math.PI * 0.9, [0, 0.79 - i * 0.045, 0.105], [Math.PI / 2 + 0.1, 0, Math.PI * 0.05], BONE, [1, 0.6, 1], 3, 8);
  k.box(0.02, 0.14, 0.02, [0, 0.74, 0.135], BONE);
  // grand pauldrons: skulls with horn spikes, gold rims
  for (const x of [-1, 1]) {
    k.ball(0.1, [x * 0.2, 0.84, -0.01], grad(VIO_D, VIO_L, 0.75, 0.92), [1.15, 0.7, 1], 1);
    k.torus(0.095, 0.012, TAU, [x * 0.2, 0.815, -0.01], [Math.PI / 2, 0, x * 0.2], GOLD, [1.15, 1, 1], 3, 12);
    k.ball(0.05, [x * 0.22, 0.91, 0.02], BONE, [1, 0.9, 1.05], 0);
    for (const e of [-1, 1]) k.ball(0.011, [x * 0.22 + e * 0.018, 0.91, 0.068], GREEN_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
    k.spike([x * 0.25, 0.9, -0.04], [x * 0.42, 1.06, -0.08], 0.03, BONE, 5);
    k.spike([x * 0.2, 0.92, -0.07], [x * 0.27, 1.12, -0.12], 0.024, BONE, 5);
  }
  // grand flared collar
  k.lathe([[0.13, 0.86], [0.22, 1.14]], 10, [0, 0, -0.02], (p) => C(0x5a3a8a).lerp(C(0xc090f0), smooth(0.86, 1.14, p.y)), { phi0: Math.PI / 2 + 0.25, phiLen: Math.PI - 0.5, ds: true });
  { const top = []; for (let i = 0; i <= 8; i++) { const th = Math.PI / 2 + 0.25 + (i / 8) * (Math.PI - 0.5); top.push([0.22 * Math.sin(th), 1.14, 0.22 * Math.cos(th) - 0.02]); } k.chain(top, top.map(() => 0.01), GOLD, 3); }
  // left arm: raised, conjuring a big green fireball
  k.lathe([[0.1, 0], [0.055, 0.24]], 8, [-0.3, 0.68, 0.14], ROBE, { rot: [-2.0, 0.6, 0], ds: true, jag: 0.03 });
  k.limb([-0.21, 0.84, 0], [-0.29, 0.72, 0.1], 0.065, 0.09, ROBE);
  k.limb([-0.32, 0.68, 0.17], [-0.34, 0.75, 0.26], 0.016, 0.015, BONE, 4);
  for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.4; k.chain([[-0.34, 0.76, 0.27], [-0.34 + Math.sin(a) * 0.045, 0.81, 0.3], [-0.34 + Math.sin(a) * 0.065, 0.86, 0.29]], [0.009, 0.007, 0.002], BONE, 4); }
  flame(k, [-0.34, 0.86, 0.3], 0.1, 0xc0ffaa, 0x2ad06a, 8);
  k.torus(0.1, 0.006, TAU, [-0.34, 0.9, 0.3], [Math.PI / 2 - 0.2, 0, 0.3], PURP_G, 1, 3, 14, GLOW);
  // right arm holds orb staff
  k.limb([0.21, 0.84, 0], [0.28, 0.68, 0.1], 0.065, 0.09, ROBE);
  k.lathe([[0.1, 0], [0.055, 0.16]], 8, [0.3, 0.62, 0.12], ROBE, { rot: [Math.PI, 0, 0], ds: true, jag: 0.03 });
  k.ball(0.036, [0.31, 0.62, 0.15], BONE, [1, 1.2, 1], 0);
  const sx = 0.32, sz = 0.16;
  k.limb([sx, 0.02, sz], [sx, 1.2, sz], 0.018, 0.022, grad(0x5a3a2a, 0x9a7a5a, 0, 1.2), 5);
  for (const y of [0.3, 0.62, 0.95]) k.lathe([[0.026, y], [0.026, y + 0.035]], 6, [sx, 0, sz], GOLD);
  // staff head: gold crescent cradling a green orb, skull below, rings
  k.ball(0.04, [sx, 1.2, sz], GOLD, [1, 0.7, 1], 0);
  k.torus(0.1, 0.014, Math.PI * 1.3, [sx, 1.33, sz], [0, 0, -Math.PI * 0.15 - Math.PI / 2 + Math.PI * 0.5 + Math.PI], GOLD, 1, 3, 12);
  k.spike([sx - 0.09, 1.38, sz], [sx - 0.12, 1.46, sz], 0.016, GOLD, 4);
  k.spike([sx + 0.09, 1.38, sz], [sx + 0.12, 1.46, sz], 0.016, GOLD, 4);
  k.ball(0.065, [sx, 1.33, sz], 0x6aff9a, [1, 1, 1], 1, [0, 0, 0], GLOW);
  k.ball(0.035, [sx, 1.34, sz + 0.02], 0xeaffe0, [1, 1, 1], 0, [0, 0, 0], GLOW);
  k.torus(0.13, 0.007, TAU, [sx, 1.33, sz], [Math.PI / 2 - 0.4, 0, 0.4], PURP_G, 1, 3, 16, GLOW);
  k.torus(0.155, 0.006, TAU, [sx, 1.33, sz], [Math.PI / 2 + 0.5, 0, -0.5], GREEN_G, 1, 3, 16, GLOW);
  // orbiting rune motes around the body
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.4; k.box(0.03, 0.04, 0.008, [Math.sin(a) * 0.36, 0.55 + Math.sin(a * 2) * 0.08, Math.cos(a) * 0.36], i % 2 ? PURP_G : GREEN_G, [0, a, 0.4], GLOW); }
  // skull with tall gold crown
  k.limb([0, 0.87, 0], [0, 0.94, 0.01], 0.03, 0.03, BONE_M);
  skull(k, [0, 1.01, 0.02], 0.095, GREEN_G, { jawOpen: 0.3, rot: [0.05, 0.1, 0] });
  k.T([0, 1.08, 0.0], [-0.08, 0, 0], 1, () => {
    k.lathe([[0.1, 0], [0.106, 0.05]], 10, [0, 0, 0], grad(GOLD_D, GOLD, 0, 0.05), { ds: true });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU, front = Math.cos(a), h = 0.09 + 0.1 * Math.max(0, front) * Math.max(0, front);
      k.spike([Math.sin(a) * 0.103, 0.04, Math.cos(a) * 0.103], [Math.sin(a) * 0.13, 0.04 + h, Math.cos(a) * 0.13], 0.018, GOLD, 4);
    }
    k.ball(0.022, [0, 0.04, 0.112], GREEN_G, [1, 1.3, 0.6], 0, [0, 0, 0], GLOW);
    for (const x of [-1, 1]) k.ball(0.012, [x * 0.07, 0.03, 0.085], PURP_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
  });
  return finish(k, 0.9);
}

// =====================================================================
// DREAD KNIGHT: violet-steel plate on an armoured nightmare with green flame mane
// =====================================================================
function dreadknight() {
  const k = nkit(667);
  const HORSE = grad(0x4a3e5e, 0x7a6e92, 0.2, 1.0), PLATE = grad(0x5a5a78, 0xc0c4d8, 0.4, 1.45);
  const BARD = (p) => C(CRIM_D).lerp(C(CRIM_L), smooth(0.35, 0.78, p.y));
  const legs = [
    [[-0.12, 0.6, 0.33], [-0.13, 0.42, 0.5], [-0.12, 0.24, 0.5]],
    [[0.12, 0.6, 0.33], [0.13, 0.3, 0.35], [0.12, 0.05, 0.36]],
    [[-0.12, 0.62, -0.33], [-0.13, 0.32, -0.42], [-0.12, 0.05, -0.38]],
    [[0.12, 0.62, -0.33], [0.13, 0.32, -0.38], [0.12, 0.05, -0.3]],
  ];
  for (const [top, knee, hoof] of legs) {
    k.limb(top, knee, 0.09, 0.05, HORSE, 7);
    k.ball(0.05, knee, PLATE, [1, 1, 1], 0);
    k.limb(knee, hoof, 0.045, 0.04, HORSE);
    k.limb(lerp3(knee, hoof, 0.15), lerp3(knee, hoof, 0.8), 0.052, 0.048, PLATE, 6);       // greave
    k.limb([hoof[0], hoof[1] - 0.05, hoof[2]], [hoof[0], hoof[1] + 0.03, hoof[2]], 0.058, 0.046, 0x8a8aa0, 6);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; k.spike([hoof[0] + Math.sin(a) * 0.04, hoof[1] + 0.02, hoof[2] + Math.cos(a) * 0.04], [hoof[0] + Math.sin(a) * 0.06, hoof[1] + 0.1 + (i % 2) * 0.04, hoof[2] + Math.cos(a) * 0.06 - 0.03], 0.02, i % 2 ? GREEN_G : 0x9aff8a, 3, GLOW); }
  }
  // horse body, crimson caparison, plate crupper
  k.ball(0.23, [0, 0.67, 0], HORSE, [0.9, 0.85, 2.2], 1);
  k.lathe([[0.255, 0.38], [0.25, 0.56], [0.215, 0.77]], 18, [0, 0, -0.01], BARD, { s: [1, 1, 2.15], jag: 0.05, ds: true });
  k.lathe([[0.258, 0.62], [0.254, 0.67]], 18, [0, 0, -0.01], GOLD, { s: [1, 1, 2.15] });
  k.lathe([[0.23, 0.72], [0.17, 0.86], [0.06, 0.9]], 10, [0, 0, -0.33], PLATE, { s: [1, 1, 0.9] });   // crupper plate
  for (const x of [-1, 1]) {
    k.ball(0.075, [x * 0.255, 0.52, 0.0], BONE, [0.3, 1, 0.85], 1);
    for (const y of [-1, 1]) k.ball(0.015, [x * 0.272, 0.535, y * 0.028], GREEN_G, [1, 1, 1], 0, [0, 0, 0], GLOW);
  }
  // neck with crinet plates + head with skull chanfron
  k.limb([0, 0.73, 0.36], [0, 1.06, 0.6], 0.135, 0.088, HORSE, 7);
  k.lathe([[0.135, 0.0], [0.1, 0.32]], 8, [0, 0.75, 0.38], PLATE, { rot: [0.64, 0, 0], ds: true, phi0: -1.9, phiLen: 3.8 });
  for (let i = 0; i < 4; i++) k.lathe([[0.138 - i * 0.01, i * 0.08], [0.13 - i * 0.01, i * 0.08 + 0.015]], 8, [0, 0.75, 0.38], GOLD, { rot: [0.64, 0, 0], ds: true, phi0: -1.9, phiLen: 3.8 });
  k.T([0, 1.08, 0.64], [-1.0, 0, 0], 1, () => {
    k.ball(0.088, [0, 0, 0], HORSE, [0.85, 1, 1], 1);
    k.box(0.12, 0.28, 0.11, [0, -0.15, 0.0], HORSE);
    k.box(0.145, 0.28, 0.045, [0, -0.11, 0.06], PLATE);
    k.box(0.15, 0.02, 0.05, [0, -0.04, 0.065], GOLD);
    k.spike([0, 0.0, 0.08], [0, 0.1, 0.27], 0.03, BONE, 5);                               // unicorn horn of bone
    for (const x of [-1, 1]) {
      glowEye(k, [x * 0.072, -0.03, 0.03], 0.026, GREEN_G);
      k.chain([[x * 0.05, 0.05, -0.02], [x * 0.11, 0.12, -0.04], [x * 0.12, 0.2, -0.1]], [0.022, 0.014, 0], BONE_M, 4);   // ram horns
      glowEye(k, [x * 0.035, -0.29, 0.03], 0.016, LIME_G);
    }
  });
  // mane and tail of green ghost-fire
  for (let i = 0; i < 8; i++) {
    const t = i / 7, base = [0, 0.86 + t * 0.26, 0.33 + t * 0.25];
    k.spike(base, [0, base[1] + 0.1 + (i % 2) * 0.05, base[2] - 0.16], 0.045, i % 2 ? 0x9aff8a : GREEN_G, 4, GLOW);
  }
  for (let i = 0; i < 5; i++) {
    const t = i / 4, b = [0, 0.7 - t * 0.12, -0.46 - t * 0.12];
    k.spike(b, [k.rr(-0.05, 0.05), b[1] - 0.18 - t * 0.12, b[2] - 0.2], 0.05 - t * 0.006, i % 2 ? 0x9aff8a : GREEN_G, 4, GLOW);
  }
  // saddle
  k.box(0.31, 0.06, 0.3, [0, 0.84, -0.05], 0x7a3a2a);
  k.box(0.25, 0.12, 0.04, [0, 0.88, -0.19], 0x7a3a2a);
  k.box(0.26, 0.02, 0.045, [0, 0.94, -0.19], GOLD);
  // rider legs
  for (const x of [-1, 1]) {
    k.limb([x * 0.1, 0.89, -0.03], [x * 0.22, 0.79, 0.12], 0.055, 0.048, PLATE);
    k.ball(0.05, [x * 0.22, 0.79, 0.13], GOLD, [1, 1, 1], 0);
    k.limb([x * 0.22, 0.79, 0.12], [x * 0.23, 0.52, 0.06], 0.045, 0.038, PLATE);
    k.box(0.075, 0.055, 0.15, [x * 0.23, 0.5, 0.09], PLATE);
  }
  // torso: breastplate with bone skull, gold trims, huge spiked pauldrons
  k.ball(0.17, [0, 1.08, 0], PLATE, [1, 1.15, 0.78], 1);
  k.lathe([[0.16, 0.89], [0.14, 1.0]], 10, [0, 0, 0], grad(CRIM_D, CRIM, 0.89, 1.0));
  k.box(0.14, 0.26, 0.03, [0, 0.96, 0.13], grad(CRIM, CRIM_L, 0.85, 1.1), [-0.1, 0, 0]);
  k.box(0.15, 0.02, 0.035, [0, 0.84, 0.125], GOLD, [-0.1, 0, 0]);
  k.ball(0.045, [0, 1.1, 0.135], BONE, [1, 1, 0.6], 0);
  for (const e of [-1, 1]) k.ball(0.011, [e * 0.017, 1.105, 0.16], GREEN_G, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
  for (const x of [-1, 1]) {
    k.ball(0.1, [x * 0.18, 1.18, 0], PLATE, [1.15, 0.78, 1.05], 1);
    k.ball(0.085, [x * 0.2, 1.13, 0], grad(0x6a6a88, 0xa8acc0, 1.05, 1.2), [1.2, 0.72, 1.1], 1);
    k.torus(0.095, 0.012, TAU, [x * 0.19, 1.12, 0], [Math.PI / 2, 0, x * 0.3], GOLD, [1.2, 1.1, 1], 3, 12);
    k.spike([x * 0.21, 1.22, 0], [x * 0.36, 1.38, -0.02], 0.034, BONE, 5);
    k.spike([x * 0.16, 1.24, -0.02], [x * 0.2, 1.4, -0.07], 0.026, BONE, 5);
    k.spike([x * 0.26, 1.17, -0.03], [x * 0.37, 1.22, -0.1], 0.024, BONE, 5);
  }
  // great crimson cape, torn hem
  const cape = (u, v) => { const a = (u - 0.5) * 2.6; return [Math.sin(a) * (0.18 + v * 0.14), 1.18 - v * 0.5 + Math.abs(u - 0.5) * 0.1, -Math.cos(a) * (0.13 + v * 0.1) - 0.06 - v * 0.2]; };
  k.surf(cape, 10, 3, grad(CRIM, CRIM_L, 0.7, 1.15), { ds: true });
  k.tris(ragHem(cape, 7, 0.09, k.r), CRIM, { ds: true });
  // left arm with reins
  k.limb([-0.2, 1.14, 0], [-0.21, 0.98, 0.12], 0.05, 0.044, PLATE);
  k.limb([-0.21, 0.98, 0.12], [-0.08, 0.93, 0.25], 0.044, 0.04, PLATE);
  k.ball(0.045, [-0.07, 0.93, 0.27], STEEL_D, [1, 1, 1], 0);
  k.limb([-0.07, 0.93, 0.27], [-0.06, 0.97, 0.5], 0.006, 0.006, GOLD_D, 3);
  // right arm: huge runic scythe-sword (glaive) raised
  k.limb([0.2, 1.14, 0], [0.28, 1.02, 0.1], 0.05, 0.044, PLATE);
  k.limb([0.28, 1.02, 0.1], [0.27, 1.07, 0.25], 0.044, 0.04, PLATE);
  k.ball(0.046, [0.27, 1.07, 0.27], STEEL_D, [1, 1, 1], 0);
  k.T([0.27, 1.07, 0.27], [0.9, 0, -0.12], 1, () => {
    k.limb([0, -0.16, 0], [0, 0.08, 0], 0.018, 0.018, 0x6a3a2a, 5);
    k.ball(0.035, [0, -0.17, 0], GOLD, [1, 1, 1], 0);
    k.ball(0.016, [0, -0.17, 0.03], GREEN_G, [1, 1, 1], 0, [0, 0, 0], GLOW);
    k.box(0.26, 0.04, 0.055, [0, 0.08, 0], GOLD);
    k.spike([0.12, 0.08, 0], [0.17, 0.16, 0], 0.022, GOLD, 4); k.spike([-0.12, 0.08, 0], [-0.17, 0.16, 0], 0.022, GOLD, 4);
    const BL = (p) => C(0x8a90a8).lerp(C(0xeef0ff), smooth(0.1, 0.8, p.y));
    k.box(0.1, 0.72, 0.024, [0, 0.46, 0], BL);
    k.add(new THREE.ConeGeometry(0.07, 0.16, 4).scale(1, 1, 0.26).rotateY(Math.PI / 4).translate(0, 0.9, 0), BL);
    for (let i = 0; i < 3; i++) k.spike([0.05, 0.3 + i * 0.18, 0], [0.1, 0.36 + i * 0.18, 0], 0.025, BL, 3);         // serrations
    k.box(0.018, 0.62, 0.032, [0, 0.44, 0], GREEN_G, [0, 0, 0], GLOW);
  });
  // horned great helm, green eye slit, crimson crest
  k.T([0, 1.3, 0.01], [0, 0, 0], 1, () => {
    k.lathe([[0.095, -0.08], [0.1, 0.03], [0.09, 0.1], [0.04, 0.145]], 10, [0, 0, 0], PLATE);
    k.lathe([[0.101, -0.02], [0.101, 0.005]], 10, [0, 0, 0], GOLD);
    k.box(0.15, 0.13, 0.035, [0, -0.01, 0.088], grad(0x6a6a88, 0xa8acc0, -0.08, 0.05));
    k.box(0.13, 0.02, 0.02, [0, 0.022, 0.106], GREEN_G, [0, 0, 0], GLOW);
    k.box(0.018, 0.065, 0.02, [0, -0.025, 0.106], 0x2ad06a, [0, 0, 0], GLOW);
    for (let i = 0; i < 5; i++) k.spike([0, 0.12 - i * 0.02, 0.04 - i * 0.05], [0, 0.22 - i * 0.025, -0.02 - i * 0.07], 0.03, i % 2 ? CRIM : CRIM_L, 4);
    for (const x of [-1, 1]) k.chain([[x * 0.08, 0.04, 0], [x * 0.17, 0.08, -0.02], [x * 0.22, 0.18, 0.02], [x * 0.2, 0.28, 0.08]], [0.03, 0.024, 0.014, 0.0], BONE_M, 5);
  });
  return finish(k, 1.0);
}

// =====================================================================
// GHOST DRAGON: spectral pale-cyan bone dragon, luminous wing membranes
// =====================================================================
function ghostdragon() {
  const k = nkit(779);
  const B1 = grad(0x7ab4d4, 0xd8f2fc, 0.15, 1.3), BJ = 0xa8d4ea, BW = 0xdcf2fc;
  const MEM = (p) => C(0x1a5a7a).lerp(C(0x4ab0d0), smooth(0.5, 1.35, p.y));   // glow membranes (translucent look)
  const spine = [[0, 0.24, -1.12], [0, 0.32, -0.9], [0, 0.44, -0.68], [0, 0.57, -0.46], [0, 0.67, -0.28], [0, 0.74, -0.08], [0, 0.77, 0.12], [0, 0.81, 0.28], [0, 0.98, 0.4], [0, 1.13, 0.45], [0, 1.25, 0.57]];
  const rad = [0.012, 0.025, 0.035, 0.045, 0.05, 0.052, 0.052, 0.05, 0.044, 0.04, 0.036];
  k.chain(spine, rad, B1, 6, false);
  for (let i = 1; i < spine.length; i++) {
    const p = spine[i];
    k.ball(rad[i] * 1.5, p, BW, [1, 0.9, 1], 0);
    if (i < spine.length - 1) {
      const q = spine[i + 1], h = 0.06 + rad[i] * 1.5;
      k.spike(p, [p[0], p[1] + h, p[2] - 0.02 + (q[2] - p[2]) * 0.2], rad[i] * 0.7, BJ, 4);
      k.spike([p[0], p[1] + 0.02, p[2]], [p[0], p[1] + h * 1.5, p[2] - 0.06], rad[i] * 0.35, 0x3ab0d8, 3, GLOW);   // spectral dorsal fin
    }
  }
  k.spike([0, 0.24, -1.1], [0, 0.28, -1.3], 0.045, BJ, 4);
  for (const x of [-1, 1]) k.spike([0, 0.25, -1.12], [x * 0.1, 0.25, -1.2], 0.022, BJ, 4);
  // ghostly vapour trailing from the tail
  for (let i = 0; i < 6; i++) { const p = spine[i]; k.spike([p[0], p[1] - 0.02, p[2]], [k.rr(-0.06, 0.06), p[1] - 0.18 - k.r() * 0.08, p[2] - 0.12], 0.03, i % 2 ? 0x3ab0d8 : 0x2a8ab8, 3, GLOW); }
  // ribcage + cyan soul-fire
  for (let i = 0; i < 6; i++) {
    const z = -0.22 + i * 0.085, R = 0.18 + Math.sin((i / 5) * Math.PI) * 0.065, gap = 1.1, L = TAU - gap;
    const beta = 1.5 * Math.PI - L - gap / 2;
    k.add(new THREE.TorusGeometry(R, 0.018, 3, 10, L).rotateZ(beta).scale(0.95, 1.15, 1).rotateX(0.25).translate(0, 0.75 - R * 1.1, z), BW);
  }
  k.chain([[0, 0.38, -0.22], [0, 0.35, 0.05], [0, 0.42, 0.25]], [0.018, 0.022, 0.016], BJ, 5);
  flame(k, [0, 0.4, -0.08], 0.15, 0xd8faff, 0x3ac0f0, 6);
  flame(k, [0, 0.42, 0.12], 0.14, 0xd8faff, 0x3ac0f0, 5);
  k.ball(0.09, [0, 0.55, 0.02], 0x6ae0ff, [1.1, 1.2, 1.6], 1, [0, 0, 0], GLOW);   // spectral heart
  k.ball(0.09, [0, 0.65, -0.3], BJ, [1.6, 0.8, 1], 1);
  for (const x of [-1, 1]) {
    const hip = [x * 0.13, 0.63, -0.3], knee = [x * 0.21, 0.38, -0.16], ank = [x * 0.19, 0.12, -0.32], foot = [x * 0.19, 0.03, -0.24];
    k.ball(0.052, hip, BJ, [1, 1, 1], 0);
    k.limb(hip, knee, 0.047, 0.036, B1); k.ball(0.042, knee, BJ, [1, 1, 1], 0);
    k.limb(knee, ank, 0.033, 0.026, B1); k.ball(0.03, ank, BJ, [1, 1, 1], 0);
    k.limb(ank, foot, 0.026, 0.02, B1);
    for (const a of [-0.4, 0, 0.4]) k.chain([foot, [foot[0] + Math.sin(a) * 0.06, 0.03, foot[2] + 0.07], [foot[0] + Math.sin(a) * 0.08, 0.0, foot[2] + 0.12]], [0.016, 0.012, 0], BJ, 3);
    const sh = [x * 0.15, 0.71, 0.2], el = [x * 0.23, 0.42, 0.14], wr = [x * 0.21, 0.12, 0.3], ft = [x * 0.21, 0.03, 0.36];
    k.ball(0.047, sh, BJ, [1, 1, 1], 0);
    k.limb(sh, el, 0.042, 0.033, B1); k.ball(0.036, el, BJ, [1, 1, 1], 0);
    k.limb(el, wr, 0.031, 0.023, B1);
    k.limb(wr, ft, 0.023, 0.018, B1);
    for (const a of [-0.4, 0, 0.4]) k.chain([ft, [ft[0] + Math.sin(a) * 0.05, 0.03, ft[2] + 0.06], [ft[0] + Math.sin(a) * 0.07, 0.0, ft[2] + 0.1]], [0.014, 0.01, 0], BJ, 3);
  }
  // wings: larger, raised high, luminous torn membranes
  for (const x of [-1, 1]) {
    const root = [x * 0.1, 0.81, 0.15], elbow = [x * 0.46, 1.2, 0.02], wrist = [x * 0.72, 1.45, -0.12];
    const tips = [[x * 1.1, 1.32, -0.38], [x * 1.04, 1.0, -0.52], [x * 0.82, 0.74, -0.56], [x * 0.52, 0.62, -0.47]];
    k.ball(0.048, root, BJ, [1, 1, 1], 0);
    k.limb(root, elbow, 0.042, 0.034, B1); k.ball(0.042, elbow, BJ, [1, 1, 1], 0);
    k.limb(elbow, wrist, 0.032, 0.027, B1); k.ball(0.037, wrist, BJ, [1, 1, 1], 0);
    k.spike(wrist, [x * 0.76, 1.6, -0.05], 0.026, BJ, 4);
    for (const t of tips) k.limb(wrist, t, 0.021, 0.008, B1, 5);
    const mem = [], back = [x * 0.12, 0.73, -0.2];
    const anchors = [tips[0], tips[1], tips[2], tips[3], back];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      const mid = lerp3(lerp3(a, b, 0.5), wrist, 0.15 + k.r() * 0.2);
      const a2 = lerp3(a, wrist, 0.06), b2 = lerp3(b, wrist, 0.06);
      mem.push([wrist, a2, mid], [wrist, mid, b2]);
    }
    mem.push([wrist, back, elbow], [elbow, back, root]);
    k.tris(mem, MEM, { ds: true, glow: true });
    // wispy streamers off the wing tips
    for (const t of tips.slice(0, 3)) k.spike(t, [t[0] + x * 0.06, t[1] - 0.16, t[2] - 0.1], 0.02, 0x6ad8f8, 3, GLOW);
  }
  // skull: crowned with a fan of horns, open maw breathing cyan
  k.T([0, 1.28, 0.67], [0.35, 0, 0], 1.32, () => {
    k.ball(0.09, [0, 0.0, 0], BW, [1, 0.85, 1.1], 1);
    k.box(0.12, 0.08, 0.22, [0, -0.01, 0.15], BW, [0.05, 0, 0]);
    k.box(0.1, 0.05, 0.08, [0, -0.0, 0.28], BJ, [0.1, 0, 0]);
    k.box(0.16, 0.04, 0.08, [0, 0.05, 0.05], BJ);
    for (const x of [-1, 1]) {
      k.ball(0.032, [x * 0.055, 0.02, 0.07], 0x2a6a8a, [1, 1, 0.8], 0);
      glowEye(k, [x * 0.06, 0.02, 0.09], 0.028, CYAN_G);
      k.chain([[x * 0.06, 0.05, -0.03], [x * 0.13, 0.13, -0.1], [x * 0.15, 0.15, -0.24], [x * 0.12, 0.1, -0.34]], [0.032, 0.024, 0.013, 0], BJ, 5);
      k.chain([[x * 0.03, 0.07, -0.04], [x * 0.06, 0.16, -0.12], [x * 0.05, 0.2, -0.22]], [0.02, 0.012, 0], BJ, 4);
      k.spike([x * 0.08, -0.03, -0.05], [x * 0.18, -0.07, -0.13], 0.02, BJ, 4);
      for (let i = 0; i < 4; i++) k.spike([x * 0.045, -0.05, 0.08 + i * 0.06], [x * 0.045, -0.09, 0.09 + i * 0.06], 0.009, 0xffffff, 3);
    }
    k.T([0, -0.05, 0.0], [0.5, 0, 0], 1, () => {
      k.box(0.11, 0.035, 0.3, [0, -0.02, 0.15], BJ);
      for (const x of [-1, 1]) for (let i = 0; i < 3; i++) k.spike([x * 0.04, 0, 0.12 + i * 0.07], [x * 0.04, 0.04, 0.12 + i * 0.07], 0.008, 0xffffff, 3);
    });
    k.ball(0.045, [0, -0.08, 0.14], CYAN_G, [1, 0.6, 1.7], 0, [0, 0, 0], GLOW);
    k.spike([0, -0.09, 0.2], [0, -0.16, 0.42], 0.04, 0x8af0ff, 4, GLOW);           // spectral breath wisp
  });
  return finish(k, 0.92);
}

const BUILD = { skelwarrior, plaguezombie, wraith, vampirelord, powerlich, dreadknight, ghostdragon };
export const NECRO_UP_IDS = Object.keys(BUILD);
export function necroUpModel(id) {
  return BUILD[id] ? BUILD[id]() : null;
}
