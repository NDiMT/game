import * as THREE from 'three';

// =====================================================================
// HEX REALMS: Necropolis creatures (procedural, vertex-coloured).
// necroModel(id) -> { body: BufferGeometry, glow: BufferGeometry|null }
// ids: skeleton, zombie, wight, vampire, lich, blackknight, bonedragon
// (upgrade ids such as 'skelwarrior' fall back to their base creature).
// Creatures stand on y = 0, face +Z, and are about 1 unit tall
// (black knight and bone dragon about 1.4).
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
// vertical colour gradient (model space y)
const grad = (lo, hi, y0, y1) => { const a = C(lo), b = C(hi), t = new THREE.Color(); return (p) => t.copy(a).lerp(b, smooth(y0, y1, p.y)); };
// gradient along z
const gradZ = (back, front, z0, z1) => { const a = C(back), b = C(front), t = new THREE.Color(); return (p) => t.copy(a).lerp(b, smooth(z0, z1, p.z)); };
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
    // run fn inside a local transform
    T(pos, rot, s, fn) { stack.push(M); M = M.clone().multiply(mat(pos, rot, s)); fn(); M = stack.pop(); },
    add(g, c, o = {}) {
      let ng = g.index ? g.toNonIndexed() : g;
      if (ng.attributes.uv) ng.deleteAttribute('uv');
      if (ng.attributes.normal) ng.deleteAttribute('normal');
      ng.applyMatrix4(M);
      (o.glow ? G : B).push({ g: ng, c, ds: o.ds, sh: o.sh ?? 1 });
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
    // poly-line of limbs with tapering radii and optional joint balls
    chain(pts, radii, c, seg = 6, joints = false, o) {
      for (let i = 0; i < pts.length - 1; i++) {
        k.limb(pts[i], pts[i + 1], radii[i], radii[i + 1], c, seg, o);
        if (joints && i > 0) k.ball(radii[i] * 1.25, pts[i], c, [1, 1, 1], 0, [0, 0, 0], o);
      }
    },
    torus(R, tube, arc, pos, rot, c, s = 1, rs = 4, ts = 12, o) {
      return k.add(new THREE.TorusGeometry(R, tube, rs, ts, arc).applyMatrix4(mat(pos, rot, s)), c, o);
    },
    // lathe: profile [[radius, y], ...] bottom -> top; jag roughens the first ring (a hem)
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
    // parametric surface f(u,v) -> [x,y,z], u,v in 0..1
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
    // explicit triangles [[x,y,z]x3, ...]
    tris(list, c, o = {}) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(list.flat(2), 3));
      return k.add(g, c, o);
    },
  };
  k.B = B; k.G = G;
  return k;
}

// merge into one geometry with painterly shading baked into vertex colours
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
        const jit = glow ? 1 : 1 + (r() - 0.5) * 0.1;
        for (const v of tri) {
          p.copy(v);
          if (typeof part.c === 'function') t.copy(part.c(p, n)); else t.set(part.c);
          if (!glow) {
            const ao = 0.58 + 0.42 * smooth(-0.02, 0.32, p.y);
            const sky = 0.9 + 0.16 * n.y;
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

// ---------------------------------------------------------------- palette
const CRIM = 0x8a1a2a, CRIM_D = 0x4a0c16, CRIM_L = 0xb8303a;
const BONE = 0xeee2c2, BONE_M = 0xc8b890, BONE_D = 0x8a7a5a, VOID = 0x120a0c;
const GREEN = 0x6aff6a, GREEN_G = 0x3aff7a, PURP_G = 0xb05aff, RED_G = 0xff2a1a, ICE_G = 0x7ae8ff;
const IRON = 0x3a3a44, IRON_D = 0x1c1c24, IRON_L = 0x6a6a7a, RUST = 0x8a4a26, RUST_D = 0x5a2a14, GOLD = 0xd8a840, GOLD_D = 0x8a6420;
const GLOW = { glow: true };
const bone = grad(BONE_M, BONE, 0, 1.1);

// a stylised skull centred at pos, facing +z, size s (cranium radius)
function skull(k, pos, s, eye = GREEN, o = {}) {
  const { jawOpen = 0.15, col = BONE, dark = VOID, eyeSize = 0.22 } = o;
  k.T(pos, o.rot || [0, 0, 0], 1, () => {
    k.ball(s, [0, 0.1 * s, -0.1 * s], col, [1, 1.02, 1.12], 1);
    k.box(1.3 * s, 0.55 * s, 0.7 * s, [0, -0.35 * s, 0.38 * s], col);         // maxilla
    k.box(1.55 * s, 0.22 * s, 0.4 * s, [0, 0.12 * s, 0.62 * s], col);          // brow ridge
    for (const x of [-1, 1]) {
      k.ball(0.3 * s, [x * 0.36 * s, -0.08 * s, 0.7 * s], dark, [1, 0.95, 0.5], 0);
      k.ball(eyeSize * s, [x * 0.36 * s, -0.08 * s, 0.78 * s], eye, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
      k.box(0.22 * s, 0.3 * s, 0.5 * s, [x * 0.62 * s, -0.25 * s, 0.35 * s], col); // cheekbone
    }
    k.box(0.22 * s, 0.24 * s, 0.1 * s, [0, -0.38 * s, 0.75 * s], dark, [0, 0, Math.PI / 4]); // nose
    k.box(0.95 * s, 0.14 * s, 0.12 * s, [0, -0.66 * s, 0.68 * s], 0xfaf2da);           // upper teeth
    k.T([0, -0.62 * s, 0.1 * s], [jawOpen, 0, 0], 1, () => {
      k.box(1.1 * s, 0.26 * s, 0.75 * s, [0, -0.22 * s, 0.32 * s], col);
      k.box(0.85 * s, 0.12 * s, 0.1 * s, [0, -0.06 * s, 0.66 * s], 0xfaf2da);
    });
  });
}
// unlit flame cluster: bright core plus tongues of varying height (reads on unlit material)
function flame(k, pos, size, core, mid, n = 6) {
  k.ball(size * 0.45, [pos[0], pos[1] + size * 0.2, pos[2]], core, [1, 1.2, 1], 0, [0, 0, 0], GLOW);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + k.r(), rr = size * 0.4, h = size * (0.9 + k.r() * 0.9);
    const b = [pos[0] + Math.sin(a) * rr, pos[1], pos[2] + Math.cos(a) * rr];
    k.spike(b, [b[0] + Math.sin(a) * rr * 0.4, pos[1] + h, b[2] + Math.cos(a) * rr * 0.4], size * 0.32, i % 2 ? mid : core, 4, GLOW);
  }
}
const glowEye = (k, pos, r, c) => k.ball(r, pos, c, [1, 1, 0.7], 0, [0, 0, 0], GLOW);

// =====================================================================
// SKELETON: bones, rusty sword, tattered shield
// =====================================================================
function skeleton() {
  const k = nkit(11);
  const J = BONE_M;
  // legs
  for (const x of [-1, 1]) {
    const ank = [x * 0.1, 0.06, x < 0 ? 0.05 : -0.04], knee = [x * 0.115, 0.29, x < 0 ? 0.08 : 0.02], hip = [x * 0.085, 0.5, 0];
    k.box(0.075, 0.045, 0.15, [ank[0], 0.022, ank[2] + 0.04], BONE_M);
    k.limb(ank, knee, 0.024, 0.03, bone);
    k.ball(0.04, knee, J, [1, 1, 1], 0);
    k.limb(knee, hip, 0.032, 0.036, bone);
  }
  // pelvis + tattered crimson loincloth
  k.ball(0.13, [0, 0.52, 0], BONE_M, [1, 0.5, 0.7], 1);
  k.lathe([[0.17, 0.3], [0.15, 0.42], [0.135, 0.56]], 10, [0, 0, 0], grad(CRIM_D, CRIM, 0.3, 0.56), { jag: 0.06, ds: true, phi0: 0.5, phiLen: TAU - 1.0 });
  k.box(0.3, 0.035, 0.22, [0, 0.555, 0], 0x4a2a1a); // belt
  k.box(0.05, 0.05, 0.03, [0.03, 0.555, 0.11], RUST);
  // spine + ribcage
  k.chain([[0, 0.55, -0.03], [0, 0.68, -0.05], [0, 0.8, -0.04], [0, 0.92, -0.02]], [0.026, 0.026, 0.028, 0.024], BONE_M, 6, true);
  const ribs = [[0.83, 0.13], [0.76, 0.135], [0.69, 0.12], [0.63, 0.095]];
  for (const [y, R] of ribs) {
    const gap = 0.75, L = TAU - gap, beta = (L + gap / 2) - Math.PI / 2;
    const g = new THREE.TorusGeometry(R, 0.018, 3, 12, L).rotateX(Math.PI / 2).rotateY(beta).scale(1, 1, 0.8).rotateX(-0.25).translate(0, y, 0.0);
    k.add(g, BONE);
  }
  k.box(0.035, 0.2, 0.03, [0, 0.75, 0.105], BONE, [-0.15, 0, 0]); // sternum
  // shoulders
  k.limb([-0.16, 0.9, -0.01], [0.16, 0.9, -0.01], 0.022, 0.022, BONE_M);
  // sword arm (right, +x): raised, sword forward
  k.ball(0.042, [0.17, 0.9, 0], J, [1, 1, 1], 0);
  k.limb([0.17, 0.9, 0], [0.24, 0.72, 0.04], 0.026, 0.022, bone);
  k.ball(0.03, [0.24, 0.72, 0.04], J, [1, 1, 1], 0);
  k.limb([0.24, 0.72, 0.04], [0.25, 0.72, 0.22], 0.022, 0.018, bone);
  k.ball(0.035, [0.25, 0.72, 0.24], BONE, [1, 1.1, 1], 0);
  k.T([0.25, 0.72, 0.24], [0.45, 0.1, 0], 1, () => {
    k.limb([0, -0.08, 0], [0, 0.06, 0], 0.017, 0.017, 0x3a2418, 5);       // grip
    k.ball(0.025, [0, -0.09, 0], RUST_D, [1, 1, 1], 0);                     // pommel
    k.box(0.17, 0.03, 0.04, [0, 0.065, 0], RUST);                            // guard
    const blade = (p) => C(RUST).lerp(C(0x9a8a7a), 0.35 + 0.35 * Math.sin(p.x * 70 + p.y * 40) * Math.sin(p.z * 50));
    k.box(0.055, 0.42, 0.016, [0, 0.29, 0], blade);
    k.box(0.02, 0.38, 0.02, [0, 0.27, 0], RUST_D);                           // fuller
    k.add(new THREE.ConeGeometry(0.039, 0.08, 4).scale(1, 1, 0.3).rotateY(Math.PI / 4).translate(0, 0.54, 0), blade);
    k.box(0.02, 0.04, 0.02, [0.03, 0.36, 0], RUST_D);                        // notch
  });
  // shield arm (left)
  k.ball(0.042, [-0.17, 0.9, 0], J, [1, 1, 1], 0);
  k.limb([-0.17, 0.9, 0], [-0.24, 0.72, 0.03], 0.026, 0.022, bone);
  k.limb([-0.24, 0.72, 0.03], [-0.22, 0.62, 0.17], 0.022, 0.018, bone);
  k.T([-0.23, 0.6, 0.21], [Math.PI / 2, -0.35, 0.15], 1, () => {
    const wood = (p) => C(0x6a4428).lerp(C(0x3a2414), 0.5 + 0.5 * Math.sin(p.x * 60 + (p.x > 0 ? 1 : 0)));
    k.add(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 12, 1, false, 1.1, TAU - 0.95), wood);  // broken wedge
    k.add(new THREE.TorusGeometry(0.19, 0.016, 3, 12, TAU - 0.95).rotateX(Math.PI / 2).rotateY(1.1 - Math.PI / 2 + 0.0).translate(0, 0, 0), RUST);
    k.ball(0.05, [0, -0.03, 0], RUST, [1, 0.5, 1], 1);                     // boss
    k.box(0.36, 0.035, 0.07, [0.0, -0.02, 0.04], CRIM, [0, 0.0, 0]);        // faded crimson band
    k.box(0.06, 0.035, 0.3, [0.02, -0.021, -0.02], CRIM, [0, 0, 0]);
    k.box(0.04, 0.04, 0.03, [-0.1, -0.03, -0.09], RUST_D);                  // rivet
    k.box(0.04, 0.04, 0.03, [0.11, -0.03, 0.06], RUST_D);
  });
  // neck + skull
  k.limb([0, 0.92, -0.02], [0, 0.99, 0.0], 0.022, 0.022, BONE_M);
  skull(k, [0, 1.06, 0.01], 0.1, GREEN, { jawOpen: 0.3, rot: [0.1, -0.12, 0.05] });
  // a few tufts of rag on shoulders
  k.box(0.08, 0.05, 0.1, [-0.17, 0.94, 0], CRIM_D, [0, 0, 0.3]);
  return finish(k, 0.9);
}

// =====================================================================
// ZOMBIE: rotting, hunched, ragged clothes, arms reaching
// =====================================================================
function zombie() {
  const k = nkit(23);
  const SK = grad(0x5a6a42, 0x9aaa78, 0.3, 1.0), SK_D = 0x4a5a36, CLOTH = ((g) => (p) => g(p).multiplyScalar(Math.sin(p.x * 31 + p.y * 17) * Math.sin(p.z * 23 - p.y * 29) > 0.35 ? 0.55 : 1))(grad(0x3e3628, 0x7a6e52, 0.3, 0.9)), PANTS = grad(0x2a2620, 0x4e4434, 0, 0.5);
  // legs: knock-kneed, one dragging
  const L = [[-0.11, 0.05, 0.1], [-0.08, 0.27, 0.07], [-0.1, 0.48, 0]];
  const R = [[0.13, 0.05, -0.12], [0.1, 0.25, -0.05], [0.1, 0.48, 0]];
  for (const leg of [L, R]) {
    k.box(0.09, 0.06, 0.16, [leg[0][0], 0.03, leg[0][2] + 0.04], 0x2a2018, [0, leg === L ? 0.2 : -0.3, 0]);
    k.limb(leg[0], leg[1], 0.042, 0.05, leg === R ? SK : PANTS);
    k.limb(leg[1], leg[2], 0.05, 0.065, PANTS);
  }
  k.lathe([[0.08, 0.17], [0.06, 0.3]], 7, [0.1, 0, -0.06], PANTS, { jag: 0.05, ds: true }); // torn trouser cuff
  // hips
  k.ball(0.14, [0, 0.5, 0], PANTS, [1, 0.6, 0.85], 1);
  // hunched torso (tilted forward)
  k.T([0, 0.5, 0], [0.55, 0.15, -0.08], 1, () => {
    k.ball(0.17, [0, 0.22, 0], CLOTH, [1.05, 1.25, 0.85], 1);
    k.ball(0.15, [0, 0.36, -0.05], CLOTH, [1.2, 0.9, 0.9], 1);  // hunch
    // wound in belly with ribs showing
    k.ball(0.08, [0.05, 0.2, 0.13], CRIM_D, [1, 1.1, 0.5], 1);
    for (const y of [0.17, 0.22, 0.27]) k.limb([0.0, y, 0.15], [0.11, y + 0.01, 0.13], 0.011, 0.011, BONE, 4);
    // ragged shirt hem
    k.lathe([[0.2, 0.0], [0.18, 0.12]], 12, [0, 0, 0], CLOTH, { jag: 0.07, ds: true, s: [1, 1, 0.85] });
    // rope belt
    k.torus(0.17, 0.014, TAU, [0, 0.09, 0], [Math.PI / 2, 0, 0], 0x6a5a3a, [1, 0.85, 1], 3, 12);
  });
  // shoulders / hump
  const shL = [-0.2, 0.8, 0.12], shR = [0.18, 0.84, 0.16];
  // right arm reaching forward
  k.ball(0.065, shR, CLOTH, [1, 1, 1], 0);
  k.limb(shR, [0.22, 0.76, 0.36], 0.055, 0.045, CLOTH);
  k.lathe([[0.065, -0.04], [0.05, 0.04]], 7, [0.22, 0.76, 0.36], CLOTH, { jag: 0.03, ds: true, rot: [Math.PI / 2 - 0.15, 0, 0] });
  k.limb([0.22, 0.76, 0.36], [0.22, 0.74, 0.55], 0.04, 0.034, SK);
  k.ball(0.045, [0.22, 0.735, 0.58], SK, [1, 0.7, 1.2], 0);
  for (let i = 0; i < 4; i++) k.spike([0.19 + i * 0.022, 0.735, 0.6], [0.19 + i * 0.024, 0.7, 0.67], 0.011, SK_D, 4);
  // left arm reaching, lower and limp
  k.ball(0.065, shL, CLOTH, [1, 1, 1], 0);
  k.limb(shL, [-0.24, 0.62, 0.3], 0.055, 0.045, CLOTH);
  k.limb([-0.24, 0.62, 0.3], [-0.2, 0.6, 0.48], 0.04, 0.03, (p) => C(0x9aaa78));
  k.limb([-0.22, 0.61, 0.4], [-0.19, 0.6, 0.5], 0.016, 0.016, BONE, 4);  // exposed bone
  k.ball(0.042, [-0.19, 0.59, 0.51], SK, [1, 0.7, 1.2], 0);
  for (let i = 0; i < 4; i++) k.spike([-0.215 + i * 0.02, 0.585, 0.53], [-0.22 + i * 0.024, 0.53, 0.58], 0.01, SK_D, 4);
  // neck + drooping head, thrust forward
  k.limb([0, 0.84, 0.15], [0.03, 0.85, 0.27], 0.055, 0.048, SK);
  k.T([0.04, 0.86, 0.32], [0.1, 0.0, 0.12], 1, () => {
    k.ball(0.115, [0, 0.02, 0], SK, [0.95, 1.05, 1.05], 1);
    k.ball(0.08, [0, -0.07, 0.04], SK, [1, 0.8, 1], 1);                // jowl
    for (const x of [-1, 1]) {
      k.ball(0.035, [x * 0.045, 0.03, 0.095], VOID, [1, 0.9, 0.6], 0);
      glowEye(k, [x * 0.045, 0.03, 0.11], x < 0 ? 0.016 : 0.013, 0xc8ff3a);
    }
    k.box(0.07, 0.05, 0.03, [0, -0.07, 0.11], VOID, [0.3, 0, 0.2]);    // gaping mouth
    k.box(0.06, 0.015, 0.02, [0, -0.05, 0.117], 0xd8d0a0);             // teeth
    k.ball(0.03, [0.06, 0.08, 0.06], CRIM_D, [1, 1, 0.5], 0);           // rot patch
    k.ball(0.1, [0, 0.07, -0.02], 0x2a2418, [1.02, 0.6, 1.05], 1);      // hair cap
    for (let i = 0; i < 4; i++) k.spike([-0.06 + i * 0.04, 0.12, -0.04], [-0.08 + i * 0.05, 0.19, -0.09 - k.r() * 0.05], 0.015, 0x2a2418, 4);
  });
  return finish(k, 1.0);
}

// =====================================================================
// WIGHT: hooded wraith, pale spectral blue, glowing eyes, scythe
// =====================================================================
function wight() {
  const k = nkit(37);
  const ROBE = (p) => C(0x10224a).lerp(C(0x8ab8e8), smooth(0.08, 0.95, p.y)).lerp(C(0xdcecff), smooth(0.85, 1.1, p.y) * 0.4);
  // flowing robe, hem jagged and lifted off the ground
  k.lathe([[0.2, 0.12], [0.25, 0.26], [0.23, 0.45], [0.18, 0.65], [0.14, 0.8], [0.08, 0.86]], 14, [0, 0, -0.02], ROBE, { jag: 0.09, ds: true, s: [1, 1, 0.9], wob: 0.12 });
  // inner dark
  k.lathe([[0.17, 0.14], [0.19, 0.3]], 10, [0, 0, -0.02], 0x0a1020, { ds: true });
  // spectral wisps trailing below (glow)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3, rad = 0.12 + k.r() * 0.06;
    k.spike([Math.sin(a) * rad, 0.2, Math.cos(a) * rad * 0.9], [Math.sin(a) * rad * 0.7, 0.0 + k.r() * 0.05, Math.cos(a) * rad * 0.6 - 0.05], 0.03, 0x2a6aa0, 4, GLOW);
  }
  k.spike([0, 0.25, -0.05], [0, -0.0, -0.22], 0.08, 0x1e4a7a, 5, GLOW);
  // tattered shoulder mantle
  k.lathe([[0.22, 0.66], [0.17, 0.78], [0.1, 0.86]], 12, [0, 0, -0.02], ROBE, { jag: 0.06, ds: true, wob: 0.1 });
  // hood
  k.T([0, 0.94, 0.0], [0.15, 0, 0], 1, () => {
    k.lathe([[0.15, -0.1], [0.155, 0.0], [0.13, 0.1], [0.07, 0.17], [0.0, 0.21]], 12, [0, 0, -0.02], ROBE, { phi0: 0.7, phiLen: TAU - 1.4, ds: true });
    k.spike([0, 0.15, -0.08], [0, 0.18, -0.26], 0.06, 0x9ab8d8, 5);   // hood tip trailing back
    k.ball(0.115, [0, -0.01, -0.02], 0x04060c, [1, 1.05, 1], 1);        // face void
    glowEye(k, [-0.045, 0.0, 0.085], 0.024, ICE_G);
    glowEye(k, [0.045, 0.0, 0.085], 0.024, ICE_G);
    k.ball(0.01, [0, -0.05, 0.09], 0x2a8ab8, [3, 1, 1], 0, [0, 0, 0], GLOW); // ghostly mouth glow
  });
  // arms: billowing sleeves, skeletal pale claws
  const CLAW = 0xd8f0ff;
  // left arm reaches forward, claws spread
  k.lathe([[0.075, 0], [0.05, 0.22]], 8, [-0.2, 0.62, 0.22], ROBE, { rot: [-1.9, 0.5, 0], jag: 0.04, ds: true });
  k.limb([-0.17, 0.78, 0.0], [-0.24, 0.65, 0.2], 0.05, 0.06, ROBE);
  for (let i = 0; i < 4; i++) {
    const a = -0.5 + i * 0.33;
    k.chain([[-0.24, 0.63, 0.25], [-0.24 + Math.sin(a) * 0.07, 0.63 + Math.cos(a) * 0.02, 0.33], [-0.24 + Math.sin(a) * 0.11, 0.6 - i * 0.012, 0.4]], [0.012, 0.009, 0.002], CLAW, 4);
  }
  // right arm holds scythe
  k.limb([0.17, 0.78, 0.0], [0.26, 0.6, 0.12], 0.05, 0.065, ROBE);
  k.ball(0.04, [0.27, 0.56, 0.15], CLAW, [1, 1, 1], 0);
  k.T([0.28, 0.56, 0.16], [0.15, 0, 0.12], 1, () => {
    k.limb([0, -0.48, 0], [0, 0.62, 0], 0.017, 0.015, grad(0x1a1a24, 0x4a4a5a, 0, 1.2), 5);
    k.box(0.04, 0.05, 0.04, [0, 0.6, 0], IRON_D);
    // curved blade
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, a = t * 1.9; pts.push([-Math.sin(a) * 0.33, 0.62 + (1 - Math.cos(a)) * 0.12 - t * 0.14, -0.05 + Math.cos(a) * 0.05]); }
    const tri = [];
    for (let i = 0; i < 8; i++) {
      const w0 = 0.07 * (1 - i / 8), w1 = 0.07 * (1 - (i + 1) / 8);
      const a = pts[i], b = pts[i + 1];
      const a2 = [a[0], a[1] - w0, a[2]], b2 = [b[0], b[1] - w1, b[2]];
      tri.push([a, a2, b], [b, a2, b2]);
    }
    k.tris(tri, (p) => C(0x9ab8d0).lerp(C(0x3a4a5a), smooth(0.48, 0.66, p.y)), { ds: true });
    // glowing cutting edge
    const edge = [];
    for (let i = 0; i < 8; i++) {
      const w0 = 0.07 * (1 - i / 8), w1 = 0.07 * (1 - (i + 1) / 8), a = pts[i], b = pts[i + 1];
      edge.push([[a[0], a[1] - w0, a[2] + 0.004], [a[0], a[1] - w0 + 0.012, a[2] + 0.004], [b[0], b[1] - w1, b[2] + 0.004]]);
    }
    k.tris(edge, 0x3aa8e0, { glow: true, ds: true });
  });
  // spectral chain hanging from the waist
  for (let i = 0; i < 5; i++) k.torus(0.022, 0.006, TAU, [-0.12 + i * 0.012, 0.48 - i * 0.045, 0.17 - i * 0.01], [0, i % 2 ? Math.PI / 2 : 0, 0], 0x5a6a80, 1, 3, 6);
  return finish(k, 1.0);
}

// =====================================================================
// VAMPIRE: noble, high-collared bat-wing cape, pale, red eyes
// =====================================================================
function vampire() {
  const k = nkit(41);
  const PALE = 0xdcd8e4, BLACK = 0x18121c, CLOTH = grad(0x140e18, 0x2e2034, 0.2, 0.9);
  // legs: slender, black boots
  for (const x of [-1, 1]) {
    const ank = [x * 0.08, 0.06, x < 0 ? 0.06 : -0.03];
    k.box(0.07, 0.05, 0.16, [ank[0], 0.025, ank[2] + 0.04], 0x0c0a10);
    k.limb(ank, [x * 0.085, 0.27, ank[2] * 0.5], 0.042, 0.045, grad(0x0c0a10, 0x2a2430, 0.05, 0.28));
    k.limb([x * 0.085, 0.27, ank[2] * 0.5], [x * 0.08, 0.5, 0], 0.035, 0.048, CLOTH);
  }
  // coat with tails
  k.lathe([[0.17, 0.32], [0.15, 0.5], [0.13, 0.6]], 12, [0, 0, -0.01], CLOTH, { phi0: 0.55, phiLen: TAU - 1.1, ds: true, jag: 0.03 });
  // torso: doublet + crimson waistcoat + gold buttons
  k.ball(0.15, [0, 0.7, 0], CLOTH, [1, 1.35, 0.75], 1);
  k.box(0.13, 0.26, 0.05, [0, 0.66, 0.085], grad(CRIM_D, CRIM_L, 0.55, 0.8), [-0.08, 0, 0]);
  for (let i = 0; i < 3; i++) k.ball(0.011, [0, 0.6 + i * 0.06, 0.115], GOLD, [1, 1, 1], 0);
  k.box(0.27, 0.035, 0.18, [0, 0.55, 0.0], 0x0c0a10);
  k.box(0.045, 0.04, 0.02, [0, 0.55, 0.09], GOLD);
  k.spike([0, 0.86, 0.07], [0, 0.76, 0.11], 0.035, 0xf0ecf4, 5);  // jabot
  // arms
  k.ball(0.06, [-0.18, 0.84, 0], CLOTH, [1, 0.8, 1], 0); k.ball(0.06, [0.18, 0.84, 0], CLOTH, [1, 0.8, 1], 0);
  // left arm: raised, holding cape edge out like a wing, clawed hand
  k.limb([-0.18, 0.84, 0], [-0.33, 0.85, 0.08], 0.04, 0.035, CLOTH);
  k.limb([-0.33, 0.85, 0.08], [-0.42, 0.98, 0.12], 0.035, 0.03, CLOTH);
  k.ball(0.03, [-0.43, 1.0, 0.13], PALE, [1, 1.2, 1], 0);
  for (let i = 0; i < 3; i++) k.spike([-0.44 + i * 0.015, 1.02, 0.14], [-0.46 + i * 0.02, 1.08, 0.16], 0.008, PALE, 4);
  // right arm: rapier pointed forward
  k.limb([0.18, 0.84, 0], [0.24, 0.68, 0.08], 0.04, 0.035, CLOTH);
  k.limb([0.24, 0.68, 0.08], [0.24, 0.62, 0.24], 0.035, 0.03, CLOTH);
  k.ball(0.03, [0.24, 0.62, 0.26], PALE, [1, 1, 1.1], 0);
  k.T([0.24, 0.62, 0.27], [1.25, 0, 0], 1, () => {
    k.torus(0.04, 0.007, Math.PI, [0, 0.0, 0.0], [0, Math.PI / 2, 0], GOLD, 1, 3, 8);
    k.box(0.09, 0.015, 0.015, [0, 0.03, 0], GOLD);
    k.limb([0, 0.03, 0], [0, 0.5, 0], 0.009, 0.003, 0xe0e4ee, 4);
  });
  // neck, head
  k.limb([0, 0.86, 0], [0, 0.93, 0.01], 0.04, 0.038, PALE);
  k.T([0, 1.0, 0.02], [0.05, 0, 0], 1, () => {
    k.ball(0.095, [0, 0, 0], PALE, [0.9, 1.1, 1], 1);
    k.ball(0.06, [0, -0.06, 0.03], PALE, [0.9, 0.8, 1], 0);                     // jaw/chin
    k.spike([0, -0.03, 0.08], [0, -0.1, 0.1], 0.03, PALE, 4);                   // pointed chin
    k.ball(0.1, [0, 0.03, -0.015], BLACK, [0.95, 0.95, 1.05], 1);               // slicked hair
    k.spike([0, 0.08, 0.06], [0, 0.03, 0.105], 0.04, BLACK, 4);                 // widow's peak
    k.spike([0, 0.06, -0.08], [0, -0.02, -0.12], 0.06, BLACK, 5);
    for (const x of [-1, 1]) {
      k.spike([x * 0.08, 0.0, -0.0], [x * 0.14, 0.06, -0.04], 0.025, PALE, 4); // pointed ears
      k.box(0.05, 0.012, 0.02, [x * 0.035, 0.035, 0.085], BLACK, [0, 0, x * 0.35]); // brows
      glowEye(k, [x * 0.035, 0.012, 0.085], 0.018, RED_G);
      k.spike([x * 0.015, -0.055, 0.085], [x * 0.015, -0.085, 0.085], 0.006, 0xffffff, 3);  // fangs
    }
    k.box(0.04, 0.008, 0.01, [0, -0.05, 0.09], 0x7a1020);
  });
  // high collar: flares behind head, crimson inside
  const collar = (inner) => (u, v) => {
    const a = (u - 0.5) * 3.4, rad = (0.1 + v * 0.07 + (inner ? -0.006 : 0)) * (1 + Math.abs(u - 0.5) * 0.3);
    return [Math.sin(a) * rad, 0.86 + v * 0.26 + Math.abs(u - 0.5) * 0.08 * v, -Math.cos(a) * rad * 0.9 - 0.02];
  };
  k.surf(collar(false), 8, 2, 0x0e0a12, { ds: true });
  k.surf(collar(true), 8, 2, CRIM, { ds: true });
  // bat-wing cape: spreads to the sides, scalloped between ribs
  const NR = 6;
  const cape = (inset) => (u, v) => {
    const s = u - 0.5, as = Math.abs(s);
    const a = s * 3.6;
    const scallop = 1 - 0.22 * Math.sin(Math.PI * ((u * NR) % 1)) * smooth(0.6, 1, v) * (as > 0.05 ? 1 : 0);
    const vv = v * scallop;
    const rad = (0.15 + vv * 0.32 + as * 0.25 * vv) - inset;
    const y = 0.86 - vv * 0.72 + as * as * 1.1 * (0.4 + vv * 0.5);
    return [Math.sin(a) * rad * 1.15, y, -Math.cos(a) * rad * 0.75 - 0.03];
  };
  k.surf(cape(0), 18, 5, gradZ(0x0a080c, 0x2a1828, -0.4, 0.1), { ds: true });
  k.surf(cape(0.012), 18, 5, grad(CRIM_D, CRIM, 0.2, 0.9), { ds: true });
  // cape ribs (bat-wing bones)
  for (let i = 0; i <= NR; i++) {
    if (i === NR / 2) continue;
    const u = i / NR, pts = [];
    const f = cape(-0.004);
    for (let v = 0; v <= 1.0001; v += 0.34) pts.push(f(u, v));
    k.chain(pts, [0.012, 0.01, 0.008, 0.004], 0x0a080c, 4);
  }
  return finish(k, 1.0);
}

// =====================================================================
// LICH: skeletal sorcerer, robes, crown, skull staff
// =====================================================================
function lich() {
  const k = nkit(53);
  const ROBE = (p) => C(0x0e0814).lerp(C(0x4a2a6a), smooth(0.0, 0.75, p.y));
  // robe
  k.lathe([[0.27, 0.0], [0.24, 0.15], [0.19, 0.42], [0.15, 0.62], [0.17, 0.78], [0.08, 0.86]], 14, [0, 0, 0], ROBE, { jag: 0.05, wob: 0.08, ds: true });
  k.lathe([[0.275, 0.03], [0.255, 0.1]], 14, [0, 0, 0], grad(CRIM_D, CRIM, 0.02, 0.1), { ds: true });                    // crimson hem band
  k.box(0.08, 0.6, 0.04, [0, 0.33, 0.2], grad(CRIM_D, CRIM, 0, 0.6), [-0.12, 0, 0]);                                      // front panel
  for (let i = 0; i < 3; i++) k.ball(0.018, [0, 0.18 + i * 0.16, 0.225 - i * 0.02], GOLD, [1, 1, 0.6], 0);
  // open chest showing ribs
  k.ball(0.11, [0, 0.72, 0.07], VOID, [0.9, 1, 0.6], 1);
  for (let i = 0; i < 3; i++) k.torus(0.075 - i * 0.008, 0.009, Math.PI * 0.9, [0, 0.77 - i * 0.045, 0.1], [Math.PI / 2 + 0.1, 0, Math.PI * 0.05], BONE, [1, 0.6, 1], 3, 8);
  k.box(0.02, 0.14, 0.02, [0, 0.72, 0.13], BONE);
  // bone mantle: big shoulder pauldrons with spikes
  for (const x of [-1, 1]) {
    k.ball(0.09, [x * 0.19, 0.82, -0.01], grad(0x2a1838, 0x5a3a7a, 0.7, 0.9), [1.1, 0.7, 1], 1);
    k.ball(0.055, [x * 0.21, 0.88, 0.0], BONE, [1, 0.8, 1], 1);   // skull pauldron
    k.ball(0.014, [x * 0.2, 0.88, 0.05], GREEN_G, [1, 1, 1], 0, [0, 0, 0], GLOW);
    k.spike([x * 0.24, 0.88, -0.03], [x * 0.38, 1.02, -0.06], 0.025, BONE_M, 5);
    k.spike([x * 0.19, 0.89, -0.05], [x * 0.25, 1.06, -0.1], 0.02, BONE_M, 5);
  }
  // high collar behind head
  k.lathe([[0.12, 0.84], [0.17, 1.05]], 8, [0, 0, -0.02], (p) => C(0x1a0e24).lerp(C(0x6a3a8a), smooth(0.84, 1.05, p.y)), { phi0: Math.PI / 2 + 0.3, phiLen: Math.PI - 0.6, ds: true, jag: 0.0 });
  // left arm: sleeve, raised hand casting green fire
  k.lathe([[0.09, 0], [0.05, 0.22]], 8, [-0.29, 0.66, 0.13], ROBE, { rot: [-2.0, 0.6, 0], ds: true, jag: 0.03 });
  k.limb([-0.2, 0.82, 0], [-0.28, 0.7, 0.1], 0.06, 0.08, ROBE);
  k.limb([-0.31, 0.66, 0.16], [-0.33, 0.72, 0.25], 0.015, 0.014, BONE, 4);
  for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.4; k.chain([[-0.33, 0.73, 0.26], [-0.33 + Math.sin(a) * 0.04, 0.78, 0.29], [-0.33 + Math.sin(a) * 0.06, 0.82, 0.28]], [0.008, 0.006, 0.002], BONE, 4); }
  flame(k, [-0.33, 0.82, 0.29], 0.07, 0x9aff8a, 0x1ac84a, 7);
  // right arm holds staff
  k.limb([0.2, 0.82, 0], [0.27, 0.66, 0.1], 0.06, 0.08, ROBE);
  k.lathe([[0.09, 0], [0.05, 0.16]], 8, [0.29, 0.6, 0.12], ROBE, { rot: [Math.PI, 0, 0], ds: true, jag: 0.03 });
  k.ball(0.035, [0.3, 0.6, 0.15], BONE, [1, 1.2, 1], 0);
  // staff: gnarled
  const sx = 0.31, sz = 0.16;
  const pts = []; for (let i = 0; i <= 6; i++) pts.push([sx + Math.sin(i * 2.1) * 0.012, 0.0 + i * 0.18, sz + Math.cos(i * 1.7) * 0.012]);
  k.chain(pts, [0.016, 0.018, 0.016, 0.018, 0.017, 0.019, 0.022], grad(0x1a1010, 0x3a2a24, 0, 1.2), 5);
  // claw holding the skull
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; k.chain([[sx, 1.06, sz], [sx + Math.sin(a) * 0.06, 1.1, sz + Math.cos(a) * 0.07], [sx + Math.sin(a) * 0.05, 1.19, sz + Math.cos(a) * 0.06]], [0.012, 0.01, 0.003], 0x2a1e1a, 4); }
  skull(k, [sx, 1.17, sz + 0.01], 0.07, GREEN_G, { jawOpen: 0.4, eyeSize: 0.3 });
  k.torus(0.12, 0.008, TAU, [sx, 1.17, sz], [Math.PI / 2 - 0.3, 0, 0.3], PURP_G, 1, 3, 16, GLOW);
  k.torus(0.15, 0.006, TAU, [sx, 1.17, sz], [Math.PI / 2 + 0.4, 0, -0.4], 0x7a3ad0, 1, 3, 16, GLOW);
  for (let i = 0; i < 3; i++) k.spike([sx - 0.04 + i * 0.04, 1.2, sz - 0.04], [sx - 0.06 + i * 0.06, 1.3 + (i === 1 ? 0.06 : 0), sz - 0.08], 0.02, 0x6a3ac8, 4, GLOW); // purple flames
  // neck + skull with crown
  k.limb([0, 0.85, 0], [0, 0.92, 0.01], 0.03, 0.03, BONE_M);
  skull(k, [0, 0.99, 0.02], 0.09, GREEN_G, { jawOpen: 0.25, rot: [0.05, 0.1, 0] });
  k.T([0, 1.06, 0.0], [-0.08, 0, 0], 1, () => {
    k.lathe([[0.096, 0], [0.1, 0.04]], 10, [0, 0, 0], grad(GOLD_D, GOLD, 0, 0.04), { ds: true });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU, h = i === 0 ? 0.11 : 0.07;
      k.spike([Math.sin(a) * 0.098, 0.03, Math.cos(a) * 0.098], [Math.sin(a) * 0.115, 0.03 + h, Math.cos(a) * 0.115], 0.016, GOLD, 4);
    }
    k.ball(0.018, [0, 0.03, 0.105], 0x3aff6a, [1, 1, 0.6], 0, [0, 0, 0], GLOW);
  });
  return finish(k, 0.92);
}

// =====================================================================
// BLACK KNIGHT: dark plate on a black horse, red eye slits, big blade
// =====================================================================
function blackknight() {
  const k = nkit(67);
  const HORSE = grad(0x0c0a10, 0x2a2632, 0.2, 1.0), STL = grad(IRON_D, IRON_L, 0.6, 1.4), BARD = (p) => C(CRIM_D).lerp(C(CRIM), smooth(0.35, 0.75, p.y));
  // horse legs: jointed with hooves, left fore raised mid-stride
  const legs = [
    [[-0.12, 0.6, 0.33], [-0.13, 0.4, 0.47], [-0.12, 0.2, 0.47]],
    [[0.12, 0.6, 0.33], [0.13, 0.3, 0.35], [0.12, 0.05, 0.36]],
    [[-0.12, 0.62, -0.33], [-0.13, 0.32, -0.42], [-0.12, 0.05, -0.38]],
    [[0.12, 0.62, -0.33], [0.13, 0.32, -0.38], [0.12, 0.05, -0.3]],
  ];
  for (const [top, knee, hoof] of legs) {
    k.limb(top, knee, 0.085, 0.048, HORSE, 7);
    k.ball(0.045, knee, 0x1a1820, [1, 1, 1], 0);
    k.limb(knee, hoof, 0.042, 0.036, HORSE);
    k.limb([hoof[0], hoof[1] - 0.05, hoof[2]], [hoof[0], hoof[1] + 0.03, hoof[2]], 0.055, 0.045, 0x3a3a44, 6);   // hoof
    k.lathe([[0.06, hoof[1] + 0.01], [0.042, hoof[1] + 0.1]], 6, [hoof[0], 0, hoof[2]], 0x0a080c, { jag: 0.03, ds: true }); // feathering
  }
  // horse body
  k.ball(0.22, [0, 0.66, 0], HORSE, [0.9, 0.85, 2.2], 1);
  // caparison (crimson barding cloth) with jagged hem and gold trim
  k.lathe([[0.25, 0.38], [0.245, 0.56], [0.21, 0.76]], 18, [0, 0, -0.01], BARD, { s: [1, 1, 2.15], jag: 0.05, ds: true });
  k.lathe([[0.252, 0.62], [0.248, 0.66]], 18, [0, 0, -0.01], GOLD_D, { s: [1, 1, 2.15] });
  for (const x of [-1, 1]) {
    k.ball(0.065, [x * 0.25, 0.52, 0.0], 0xd8c8a0, [0.3, 1, 0.85], 1);  // skull emblem
    for (const y of [-1, 1]) k.ball(0.014, [x * 0.265, 0.53, y * 0.025], VOID, [1, 1, 1], 0);
  }
  // neck + head with chanfron
  k.limb([0, 0.72, 0.36], [0, 1.04, 0.6], 0.13, 0.085, HORSE, 7);
  k.lathe([[0.13, 0.0], [0.095, 0.3]], 8, [0, 0.74, 0.38], STL, { rot: [0.64, 0, 0], ds: true, phi0: -1.9, phiLen: 3.8 });  // crinet
  k.T([0, 1.06, 0.64], [-1.0, 0, 0], 1, () => {
    k.ball(0.085, [0, 0, 0], HORSE, [0.85, 1, 1], 1);
    k.box(0.12, 0.28, 0.11, [0, -0.15, 0.0], HORSE);                                 // muzzle
    k.box(0.14, 0.27, 0.04, [0, -0.11, 0.06], STL);                                  // chanfron plate
    k.spike([0, 0.0, 0.08], [0, 0.07, 0.22], 0.026, IRON_L, 4);                      // horn spike
    for (const x of [-1, 1]) {
      glowEye(k, [x * 0.07, -0.03, 0.03], 0.024, RED_G);
      k.spike([x * 0.04, 0.06, -0.03], [x * 0.065, 0.16, -0.06], 0.024, 0x1a1820, 4); // ears
      glowEye(k, [x * 0.035, -0.29, 0.03], 0.014, 0xff5a1a);                         // nostril embers
    }
  });
  // mane of dark crimson flame-spikes
  for (let i = 0; i < 7; i++) {
    const t = i / 6, base = [0, 0.84 + t * 0.26, 0.33 + t * 0.24];
    k.spike(base, [0, base[1] + 0.09, base[2] - 0.14], 0.04, i % 2 ? CRIM : 0x1a0a10, 4);
  }
  // tail
  k.chain([[0, 0.7, -0.46], [0, 0.62, -0.62], [0, 0.42, -0.7], [0, 0.2, -0.68]], [0.05, 0.065, 0.05, 0.0], 0x0e0a10, 5);
  k.spike([0, 0.5, -0.66], [0, 0.32, -0.78], 0.035, CRIM_D, 4);
  // saddle
  k.box(0.3, 0.06, 0.3, [0, 0.83, -0.05], 0x2a1a14);
  k.box(0.24, 0.1, 0.04, [0, 0.86, -0.19], 0x2a1a14);
  // rider legs (plate)
  for (const x of [-1, 1]) {
    k.limb([x * 0.1, 0.88, -0.03], [x * 0.21, 0.78, 0.12], 0.05, 0.045, STL);
    k.ball(0.045, [x * 0.21, 0.78, 0.13], IRON_L, [1, 1, 1], 0);
    k.limb([x * 0.21, 0.78, 0.12], [x * 0.22, 0.52, 0.06], 0.04, 0.035, STL);
    k.box(0.07, 0.05, 0.14, [x * 0.22, 0.5, 0.09], IRON_D);
  }
  // torso: breastplate, crimson tabard, spiked pauldrons
  k.ball(0.16, [0, 1.06, 0], STL, [1, 1.15, 0.75], 1);
  k.lathe([[0.15, 0.88], [0.13, 1.0]], 10, [0, 0, 0], IRON_D);
  k.box(0.13, 0.28, 0.03, [0, 0.95, 0.12], grad(CRIM_D, CRIM, 0.8, 1.1), [-0.1, 0, 0]);
  k.box(0.13, 0.03, 0.035, [0, 1.03, 0.125], GOLD_D, [-0.1, 0, 0]);
  k.box(0.04, 0.12, 0.035, [0, 1.06, 0.125], GOLD_D, [-0.1, 0, 0]);
  for (const x of [-1, 1]) {
    k.ball(0.09, [x * 0.17, 1.15, 0], STL, [1.1, 0.75, 1], 1);
    k.ball(0.075, [x * 0.19, 1.1, 0], IRON_D, [1.15, 0.7, 1.05], 1);
    k.spike([x * 0.2, 1.18, 0], [x * 0.32, 1.32, -0.02], 0.03, IRON_L, 5);
    k.spike([x * 0.15, 1.2, -0.02], [x * 0.18, 1.34, -0.06], 0.022, IRON_L, 5);
  }
  // cape
  const cape = (u, v) => { const a = (u - 0.5) * 2.4; return [Math.sin(a) * (0.16 + v * 0.1), 1.15 - v * 0.42 + Math.abs(u - 0.5) * 0.1, -Math.cos(a) * (0.12 + v * 0.08) - 0.06 - v * 0.14]; };
  k.surf(cape, 8, 3, grad(CRIM_D, CRIM, 0.7, 1.1), { ds: true });
  k.tris([[cape(0, 1), cape(0.25, 1), [cape(0.12, 1)[0], cape(0.12, 1)[1] - 0.08, cape(0.12, 1)[2]]], [cape(0.5, 1), cape(0.75, 1), [cape(0.62, 1)[0], cape(0.62, 1)[1] - 0.1, cape(0.62, 1)[2]]]], CRIM_D, { ds: true });
  // left arm with reins
  k.limb([-0.19, 1.12, 0], [-0.2, 0.96, 0.12], 0.045, 0.04, STL);
  k.limb([-0.2, 0.96, 0.12], [-0.08, 0.92, 0.25], 0.04, 0.035, STL);
  k.ball(0.04, [-0.07, 0.92, 0.27], IRON_D, [1, 1, 1], 0);
  k.limb([-0.07, 0.92, 0.27], [-0.06, 0.96, 0.5], 0.006, 0.006, 0x2a1a14, 3);
  // right arm raising greatsword
  k.limb([0.19, 1.12, 0], [0.27, 1.0, 0.1], 0.045, 0.04, STL);
  k.limb([0.27, 1.0, 0.1], [0.26, 1.05, 0.25], 0.04, 0.035, STL);
  k.ball(0.042, [0.26, 1.05, 0.27], IRON_D, [1, 1, 1], 0);
  k.T([0.26, 1.05, 0.27], [0.95, 0, -0.1], 1, () => {
    k.limb([0, -0.12, 0], [0, 0.07, 0], 0.016, 0.016, 0x2a1a14, 5);
    k.ball(0.03, [0, -0.13, 0], GOLD_D, [1, 1, 1], 0);
    k.box(0.22, 0.035, 0.05, [0, 0.07, 0], IRON_L);
    k.spike([0.1, 0.07, 0], [0.13, 0.13, 0], 0.02, IRON_L, 4); k.spike([-0.1, 0.07, 0], [-0.13, 0.13, 0], 0.02, IRON_L, 4);
    const BL = (p) => C(0x2a2a34).lerp(C(0x8a8a9a), 0.5 + 0.5 * Math.sin(p.y * 9));
    k.box(0.085, 0.62, 0.022, [0, 0.4, 0], BL);
    k.add(new THREE.ConeGeometry(0.06, 0.13, 4).scale(1, 1, 0.26).rotateY(Math.PI / 4).translate(0, 0.775, 0), BL);
    k.box(0.016, 0.52, 0.03, [0, 0.38, 0], RED_G, [0, 0, 0], GLOW);                   // runes
  });
  // great helm with glowing eye slits and horns
  k.T([0, 1.27, 0.01], [0, 0, 0], 1, () => {
    k.lathe([[0.09, -0.07], [0.095, 0.03], [0.085, 0.09], [0.04, 0.13]], 10, [0, 0, 0], STL);
    k.box(0.14, 0.12, 0.03, [0, -0.0, 0.085], IRON_D);                                 // visor
    k.box(0.12, 0.018, 0.02, [0, 0.022, 0.1], RED_G, [0, 0, 0], GLOW);                // eye slit
    k.box(0.016, 0.06, 0.02, [0, -0.02, 0.1], 0x8a1010, [0, 0, 0], GLOW);
    k.box(0.02, 0.12, 0.2, [0, 0.1, 0.0], CRIM, [0, 0, 0]);                           // crest
    for (const x of [-1, 1]) k.chain([[x * 0.08, 0.04, 0], [x * 0.15, 0.1, -0.02], [x * 0.17, 0.2, -0.06]], [0.025, 0.017, 0.0], BONE_M, 5);
  });
  return finish(k, 1.0);
}

// =====================================================================
// BONE DRAGON: ribcage, bony wings with tattered membrane, horned skull
// =====================================================================
function bonedragon() {
  const k = nkit(79);
  const B1 = grad(BONE_M, BONE, 0.2, 1.3), MEM = (p) => C(0x2a0c14).lerp(C(0x6a1a2a), smooth(0.5, 1.3, p.y));
  // spine curve from tail tip to skull
  const spine = [[0, 0.22, -1.05], [0, 0.3, -0.85], [0, 0.42, -0.65], [0, 0.56, -0.45], [0, 0.66, -0.28], [0, 0.73, -0.08], [0, 0.76, 0.12], [0, 0.8, 0.28], [0, 0.97, 0.4], [0, 1.12, 0.44], [0, 1.24, 0.56]];
  const rad = [0.012, 0.025, 0.035, 0.045, 0.05, 0.05, 0.05, 0.048, 0.042, 0.038, 0.035];
  k.chain(spine, rad, B1, 6, false);
  for (let i = 1; i < spine.length; i++) {
    const p = spine[i];
    k.ball(rad[i] * 1.5, p, BONE, [1, 0.9, 1], 0);
    if (i < spine.length - 1) {
      const q = spine[i + 1], h = 0.04 + rad[i] * 1.2;
      k.spike(p, [p[0], p[1] + h, p[2] - 0.02 + (q[2] - p[2]) * 0.2], rad[i] * 0.7, BONE_M, 4);   // dorsal spines
    }
  }
  k.spike([0, 0.22, -1.03], [0, 0.26, -1.22], 0.04, BONE_M, 4);                                   // tail blade
  for (const x of [-1, 1]) k.spike([0, 0.24, -1.05], [x * 0.08, 0.24, -1.13], 0.02, BONE_M, 4);
  // ribcage (vertical hoops open at the bottom) with soul fire inside
  for (let i = 0; i < 6; i++) {
    const z = -0.22 + i * 0.085, R = 0.17 + Math.sin((i / 5) * Math.PI) * 0.06, gap = 1.1, L = TAU - gap;
    const beta = 1.5 * Math.PI - L - gap / 2;
    const g = new THREE.TorusGeometry(R, 0.017, 3, 10, L).rotateZ(beta).scale(0.95, 1.15, 1).rotateX(0.25).translate(0, 0.74 - R * 1.1, z);
    k.add(g, BONE);
  }
  k.chain([[0, 0.38, -0.22], [0, 0.35, 0.05], [0, 0.42, 0.25]], [0.018, 0.022, 0.016], BONE_M, 5);  // sternum
  flame(k, [0, 0.4, -0.08], 0.14, 0x9aff8a, 0x1ab84a, 6);
  flame(k, [0, 0.42, 0.12], 0.13, 0x9aff8a, 0x1ab84a, 5);
  // pelvis
  k.ball(0.09, [0, 0.64, -0.3], BONE_M, [1.6, 0.8, 1], 1);
  // legs: hind
  for (const x of [-1, 1]) {
    const hip = [x * 0.13, 0.62, -0.3], knee = [x * 0.2, 0.38, -0.16], ank = [x * 0.18, 0.12, -0.32], foot = [x * 0.18, 0.03, -0.24];
    k.ball(0.05, hip, BONE_M, [1, 1, 1], 0);
    k.limb(hip, knee, 0.045, 0.035, B1); k.ball(0.04, knee, BONE_M, [1, 1, 1], 0);
    k.limb(knee, ank, 0.032, 0.025, B1); k.ball(0.03, ank, BONE_M, [1, 1, 1], 0);
    k.limb(ank, foot, 0.025, 0.02, B1);
    for (const a of [-0.4, 0, 0.4]) k.chain([foot, [foot[0] + Math.sin(a) * 0.06, 0.03, foot[2] + 0.07], [foot[0] + Math.sin(a) * 0.08, 0.0, foot[2] + 0.12]], [0.015, 0.012, 0], BONE_M, 3);
    // front legs
    const sh = [x * 0.15, 0.7, 0.2], el = [x * 0.22, 0.42, 0.14], wr = [x * 0.2, 0.12, 0.3], ft = [x * 0.2, 0.03, 0.36];
    k.ball(0.045, sh, BONE_M, [1, 1, 1], 0);
    k.limb(sh, el, 0.04, 0.032, B1); k.ball(0.035, el, BONE_M, [1, 1, 1], 0);
    k.limb(el, wr, 0.03, 0.022, B1);
    k.limb(wr, ft, 0.022, 0.018, B1);
    for (const a of [-0.4, 0, 0.4]) k.chain([ft, [ft[0] + Math.sin(a) * 0.05, 0.03, ft[2] + 0.06], [ft[0] + Math.sin(a) * 0.07, 0.0, ft[2] + 0.1]], [0.013, 0.01, 0], BONE_M, 3);
  }
  // wings: bony frame + tattered membrane, raised and swept back
  for (const x of [-1, 1]) {
    const root = [x * 0.1, 0.8, 0.15], elbow = [x * 0.42, 1.12, 0.02], wrist = [x * 0.66, 1.32, -0.12];
    const tips = [[x * 0.98, 1.18, -0.38], [x * 0.92, 0.9, -0.5], [x * 0.72, 0.7, -0.52], [x * 0.48, 0.6, -0.45]];
    k.ball(0.045, root, BONE_M, [1, 1, 1], 0);
    k.limb(root, elbow, 0.04, 0.032, B1); k.ball(0.04, elbow, BONE_M, [1, 1, 1], 0);
    k.limb(elbow, wrist, 0.03, 0.026, B1); k.ball(0.035, wrist, BONE_M, [1, 1, 1], 0);
    k.spike(wrist, [x * 0.7, 1.45, -0.05], 0.025, BONE_M, 4);                                 // thumb claw
    for (const t of tips) k.limb(wrist, t, 0.02, 0.008, B1, 5);
    // membrane panels, each torn: inner edge stops short and ragged
    const mem = [], back = [x * 0.12, 0.72, -0.2];
    const anchors = [tips[0], tips[1], tips[2], tips[3], back];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      // ragged edge: notch toward wrist
      const mid = lerp(lerp(a, b, 0.5), wrist, 0.18 + k.r() * 0.22);
      const a2 = lerp(a, wrist, 0.08), b2 = lerp(b, wrist, 0.08);
      mem.push([wrist, a2, mid], [wrist, mid, b2]);
      if (i === 1) mem.push([lerp(a2, mid, 0.5), mid, lerp(mid, b2, 0.4)]);
    }
    mem.push([wrist, back, elbow], [elbow, back, root]);
    k.tris(mem, MEM, { ds: true });
  }
  // skull: long horned dragon skull
  k.T([0, 1.27, 0.66], [0.35, 0, 0], 1.25, () => {
    k.ball(0.09, [0, 0.0, 0], BONE, [1, 0.85, 1.1], 1);                          // cranium
    k.box(0.12, 0.08, 0.22, [0, -0.01, 0.15], BONE, [0.05, 0, 0]);               // snout
    k.box(0.1, 0.05, 0.08, [0, -0.0, 0.28], BONE_M, [0.1, 0, 0]);
    k.box(0.16, 0.04, 0.08, [0, 0.05, 0.05], BONE_M);                             // brow
    for (const x of [-1, 1]) {
      k.ball(0.032, [x * 0.055, 0.02, 0.07], VOID, [1, 1, 0.8], 0);
      glowEye(k, [x * 0.06, 0.02, 0.09], 0.024, GREEN_G);
      k.chain([[x * 0.06, 0.05, -0.03], [x * 0.12, 0.12, -0.1], [x * 0.14, 0.13, -0.22], [x * 0.12, 0.08, -0.3]], [0.03, 0.022, 0.012, 0], BONE_M, 5);  // horns
      k.spike([x * 0.08, -0.03, -0.05], [x * 0.16, -0.06, -0.12], 0.018, BONE_M, 4);   // cheek spikes
      for (let i = 0; i < 4; i++) k.spike([x * 0.045, -0.05, 0.08 + i * 0.06], [x * 0.045, -0.09, 0.09 + i * 0.06], 0.009, 0xfaf4e0, 3);  // upper teeth
    }
    k.T([0, -0.05, 0.0], [0.45, 0, 0], 1, () => {                                // open jaw
      k.box(0.11, 0.035, 0.3, [0, -0.02, 0.15], BONE_M);
      for (const x of [-1, 1]) for (let i = 0; i < 3; i++) k.spike([x * 0.04, 0, 0.12 + i * 0.07], [x * 0.04, 0.04, 0.12 + i * 0.07], 0.008, 0xfaf4e0, 3);
    });
    k.ball(0.04, [0, -0.07, 0.12], GREEN_G, [1, 0.5, 1.6], 0, [0, 0, 0], GLOW);    // green breath glow in maw
  });
  return finish(k, 0.92);
}

const BUILD = { skeleton, zombie, wight, vampire, lich, blackknight, bonedragon };
const ALIAS = { skelwarrior: 'skeleton', plaguezombie: 'zombie', wraith: 'wight', vampirelord: 'vampire', powerlich: 'lich', dreadknight: 'blackknight', ghostdragon: 'bonedragon' };
export const NECRO_IDS = Object.keys(BUILD);
export function necroModel(id) {
  const base = BUILD[id] ? id : ALIAS[id];
  return base ? BUILD[base]() : null;
}
