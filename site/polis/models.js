import * as THREE from 'three';

// =====================================================================
// Procedural low-poly models for POLIS. Every model has a "body" built
// from vertex-coloured parts and a "glow" of windows and lamps that light
// up at night. Templates are merged once and drawn with instancing.
// =====================================================================

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mergeParts(parts) {
  const pos = [], nor = [], col = [];
  for (const { g, c } of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.computeVertexNormals();
    const p = ng.attributes.position.array, n = ng.attributes.normal.array, cc = new THREE.Color(c);
    for (let k = 0; k < p.length; k += 3) { pos.push(p[k], p[k + 1], p[k + 2]); nor.push(n[k], n[k + 1], n[k + 2]); col.push(cc.r, cc.g, cc.b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
function roofGeo() {
  const P = [
    [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 1, 0],
    [0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 1, 0],
    [-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0], [0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, 0],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
  return g;
}

// A small modelling kit: body parts, glowing parts and smoke points.
function kit(seed) {
  const r = mulberry32(seed);
  const B = [], G = [], smoke = [], spin = [];
  const k = {
    r, B, G, smoke, spin,
    pick: (arr) => arr[(r() * arr.length) | 0],
    box(w, h, d, x, y, z, c, glow = false) { (glow ? G : B).push({ g: new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), c }); },
    cyl(r1, r2, h, x, y, z, c, s = 10, glow = false) { (glow ? G : B).push({ g: new THREE.CylinderGeometry(r1, r2, h, s).translate(x, y + h / 2, z), c }); },
    ring(rad, h, x, y, z, c, s = 16) { G.push({ g: new THREE.CylinderGeometry(rad, rad, h, s, 1, true).translate(x, y + h / 2, z), c }); },
    cone(rad, h, x, y, z, c, s = 8) { B.push({ g: new THREE.ConeGeometry(rad, h, s).translate(x, y + h / 2, z), c }); },
    ball(rad, x, y, z, c, glow = false) { (glow ? G : B).push({ g: new THREE.IcosahedronGeometry(rad, 0).translate(x, y, z), c }); },
    sphere(rad, x, y, z, c) { B.push({ g: new THREE.SphereGeometry(rad, 12, 8).translate(x, y, z), c }); },
    roof(w, h, d, x, y, z, c, ry = 0) { B.push({ g: roofGeo().scale(w, h, d).rotateY(ry).translate(x, y, z), c }); },
    hip(w, h, d, x, y, z, c) { B.push({ g: new THREE.ConeGeometry(0.71, 1, 4).rotateY(Math.PI / 4).scale(w, h, d).translate(x, y + h / 2, z), c }); },
    plane(w, h, x, y, z, ry, c) { G.push({ g: new THREE.PlaneGeometry(w, h).rotateY(ry).translate(x, y, z), c }); },
    tree(x, z, s = 1) {
      k.cyl(0.02 * s, 0.03 * s, 0.12 * s, x, 0, z, 0x6b4a2b, 5);
      k.ball(0.11 * s, x, 0.2 * s, z, k.pick([0x4c9a3a, 0x3f8f3a, 0x5cab45]));
    },
    car(x, z, ry = 0) {
      const c = k.pick([0xe0403a, 0x3b82f6, 0xf5c542, 0xffffff, 0x2d2f36, 0x3fbf5a]);
      B.push({ g: new THREE.BoxGeometry(0.1, 0.05, 0.18).rotateY(ry).translate(x, 0.045, z), c });
      B.push({ g: new THREE.BoxGeometry(0.085, 0.04, 0.09).rotateY(ry).translate(x, 0.09, z), c: 0xdfe7f0 });
    },
    // Windows on all four facades, floor by floor; some lit, some dark.
    windows(w, d, x, z, y0, floors, fh, cols = 3, opts = {}) {
      const lit = opts.lit ?? 0.65, faces = opts.faces ?? [0, 1, 2, 3], wr = opts.wr ?? 0.55, hr = opts.hr ?? 0.5;
      for (let f = 0; f < floors; f++) {
        const y = y0 + f * fh + fh * 0.55;
        for (const face of faces) {
          const along = face % 2 === 0 ? w : d;
          const n = face % 2 === 0 ? cols : Math.max(1, Math.round((cols * d) / w));
          const ww = (along / n) * wr, wh = fh * hr;
          for (let i = 0; i < n; i++) {
            const t = -along / 2 + (along / n) * (i + 0.5);
            const c = r() < lit ? k.pick([0xffd98a, 0xffe7b0, 0xffc870, 0xfff2d0]) : 0x2a3448;
            if (face === 0) k.plane(ww, wh, x + t, y, z + d / 2 + 0.004, 0, c);
            else if (face === 2) k.plane(ww, wh, x - t, y, z - d / 2 - 0.004, Math.PI, c);
            else if (face === 1) k.plane(ww, wh, x + w / 2 + 0.004, y, z - t, Math.PI / 2, c);
            else k.plane(ww, wh, x - w / 2 - 0.004, y, z + t, -Math.PI / 2, c);
          }
        }
      }
    },
    balconies(w, x, z, d, y0, floors, fh, c) {
      for (let f = 1; f < floors; f++) {
        k.box(w * 0.8, 0.02, 0.07, x, y0 + f * fh, z + d / 2 + 0.035, c);
        k.box(w * 0.8, 0.05, 0.01, x, y0 + f * fh + 0.02, z + d / 2 + 0.07, 0xdfe3ea);
      }
    },
  };
  return k;
}
function done(k) {
  return { body: mergeParts(k.B), glow: k.G.length ? mergeParts(k.G) : null, smoke: k.smoke, spin: k.spin };
}

const PAL = {
  wallR: [0xf4e9d8, 0xdfe9f2, 0xf6d9d0, 0xe8f0d8, 0xf2e3c2, 0xe9d6c4], roofR: [0xc0533a, 0x7a5a48, 0x5b6b7a, 0x9a3f3f, 0x4f7a5a, 0x8a6a4a],
  brick: [0xb5654a, 0xa85a44, 0xc27a5a, 0x9a6050], wallC: [0xe9eef5, 0xd8e3f0, 0xf3e6d2, 0xcfd8e2], glass: [0x5fa8e8, 0x4a86c8, 0x6cc0e0, 0x3f6fa8, 0x5a9ab0],
  awning: [0xe55a4f, 0x3fa37a, 0xf2a03d, 0x4a7de0, 0x9a5ad0], wallI: [0xb9b4a8, 0xc7c0ae, 0xa8b0b5, 0xc2b49a], roofI: [0x7a7f87, 0x8a6a50, 0x6f7f74],
  accent: [0xe0a030, 0xd65a3a, 0x3a8ad6, 0x3aa070],
};
const LAWN = 0x6dbb4f, PAVE = 0xb9b6ae, ASPHALT = 0x4a4f5a;

// ------------------------------------------------------------------ zones
function residential(level, v, k) {
  const wall = k.pick(PAL.wallR), rf = k.pick(PAL.roofR);
  if (level === 1) {
    k.box(0.92, 0.015, 0.92, 0, 0, 0, LAWN);
    if (v === 0) { // cottage with fence
      k.box(0.46, 0.3, 0.38, -0.06, 0, -0.08, wall);
      k.roof(0.52, 0.22, 0.44, -0.06, 0.3, -0.08, rf);
      k.box(0.07, 0.18, 0.07, 0.1, 0.36, -0.16, 0x8a7f74);
      k.box(0.1, 0.17, 0.02, -0.06, 0, 0.115, 0x5a3a24);
      k.windows(0.46, 0.38, -0.06, -0.08, 0, 1, 0.3, 2, { faces: [0, 2], lit: 0.5 });
      for (let i = -4; i <= 4; i++) { k.box(0.02, 0.07, 0.02, i * 0.105, 0, 0.44, 0xffffff); k.box(0.02, 0.07, 0.02, 0.44, 0, i * 0.105, 0xffffff); }
      k.box(0.9, 0.012, 0.012, 0, 0.05, 0.44, 0xffffff); k.box(0.012, 0.012, 0.9, 0.44, 0.05, 0, 0xffffff);
      k.tree(0.28, 0.24); k.box(0.1, 0.006, 0.3, -0.06, 0.015, 0.28, PAVE);
    } else if (v === 1) { // bungalow with garage and car
      k.box(0.5, 0.24, 0.4, -0.12, 0, -0.1, wall);
      k.box(0.56, 0.035, 0.46, -0.12, 0.24, -0.1, 0x6b6f78);
      k.box(0.24, 0.2, 0.3, 0.27, 0, -0.15, wall);
      k.box(0.18, 0.15, 0.01, 0.27, 0, 0.005, 0xdfe3ea);
      k.box(0.24, 0.008, 0.36, 0.27, 0.015, 0.2, PAVE);
      k.car(0.27, 0.22);
      k.windows(0.5, 0.4, -0.12, -0.1, 0, 1, 0.24, 3, { faces: [0, 2, 3] });
      k.tree(-0.3, 0.3, 0.9);
    } else if (v === 2) { // two-storey with hip roof and porch
      k.box(0.42, 0.46, 0.38, 0, 0, -0.06, wall);
      k.hip(0.5, 0.2, 0.46, 0, 0.46, -0.06, rf);
      k.box(0.3, 0.02, 0.12, 0, 0.18, 0.19, rf);
      for (const x of [-0.13, 0.13]) k.box(0.02, 0.18, 0.02, x, 0, 0.24, 0xffffff);
      k.windows(0.42, 0.38, 0, -0.06, 0, 2, 0.23, 2);
      k.tree(-0.32, 0.3); k.tree(0.33, -0.3, 0.8);
    } else { // villa with pool
      k.box(0.5, 0.26, 0.28, -0.1, 0, -0.22, wall);
      k.box(0.24, 0.26, 0.3, -0.23, 0, 0.06, wall);
      k.box(0.54, 0.03, 0.32, -0.1, 0.26, -0.22, 0x6b6f78);
      k.box(0.28, 0.03, 0.34, -0.23, 0.26, 0.06, 0x6b6f78);
      k.box(0.36, 0.02, 0.26, 0.2, 0, 0.22, 0xffffff);
      k.box(0.32, 0.022, 0.22, 0.2, 0, 0.22, 0x4fc4f0);
      k.cyl(0.004, 0.004, 0.16, 0.38, 0, 0.0, 0xdddddd, 4); k.cone(0.09, 0.05, 0.38, 0.14, 0.0, k.pick(PAL.awning), 8);
      k.windows(0.5, 0.28, -0.1, -0.22, 0, 1, 0.26, 3, { faces: [0, 2] });
    }
  } else if (level === 2) {
    k.box(0.94, 0.012, 0.94, 0, 0, 0, PAVE);
    if (v === 0) { // row of townhouses
      const n = 3, w = 0.86 / n;
      for (let i = 0; i < n; i++) {
        const x = -0.43 + w * (i + 0.5), h = 0.62 + k.r() * 0.12, c = k.pick(PAL.wallR);
        k.box(w - 0.015, h, 0.5, x, 0, -0.08, c);
        k.roof(w + 0.01, 0.2, 0.56, x, h, -0.08, rf);
        k.box(0.08, 0.17, 0.02, x, 0, 0.18, 0x5a3a24);
        k.box(0.12, 0.04, 0.07, x, 0, 0.22, 0xc9c4ba);
        k.windows(w - 0.015, 0.5, x, -0.08, 0, 3, h / 3, 1, { faces: [0, 2] });
      }
      for (const x of [-0.3, 0, 0.3]) k.tree(x + 0.14, 0.36, 0.7);
    } else if (v === 1) { // brick walk-up with balconies and water tank
      const brick = k.pick(PAL.brick), f = 4, fh = 0.2;
      k.box(0.74, f * fh, 0.56, 0, 0, -0.06, brick);
      k.windows(0.74, 0.56, 0, -0.06, 0, f, fh, 3);
      k.balconies(0.74, 0, -0.06, 0.56, 0, f, fh, 0xd9d4ca);
      k.box(0.78, 0.04, 0.6, 0, f * fh, -0.06, 0x6b6f78);
      for (const [x, z] of [[0.18, -0.2], [0.26, -0.2], [0.18, -0.12], [0.26, -0.12]]) k.box(0.012, 0.1, 0.012, x, f * fh + 0.04, z, 0x5a4a3a);
      k.cyl(0.07, 0.07, 0.12, 0.22, f * fh + 0.14, -0.16, 0x8a6a4a, 10); k.cone(0.075, 0.05, 0.22, f * fh + 0.26, -0.16, 0x5a4a3a, 10);
      k.box(0.16, 0.18, 0.02, 0, 0, 0.225, 0x3a2a1a);
    } else if (v === 2) { // duplex pair with gardens
      for (const x of [-0.22, 0.22]) {
        k.box(0.38, 0.5, 0.4, x, 0, -0.14, wall);
        k.roof(0.42, 0.18, 0.46, x, 0.5, -0.14, rf);
        k.windows(0.38, 0.4, x, -0.14, 0, 2, 0.25, 2);
        k.box(0.36, 0.014, 0.3, x, 0.012, 0.28, LAWN);
        k.tree(x + 0.1, 0.32, 0.8);
      }
      k.box(0.02, 0.06, 0.34, 0, 0, 0.28, 0xffffff);
    } else { // apartment block with ground-floor shop
      const f = 4, fh = 0.19;
      k.box(0.78, f * fh, 0.62, 0, 0, -0.04, wall);
      k.box(0.8, fh, 0.64, 0, 0, -0.04, k.pick(PAL.wallC));
      k.box(0.66, fh * 0.6, 0.01, 0, 0.02, 0.285, 0x7ab8e0, true);
      k.box(0.7, 0.03, 0.12, 0, fh * 0.75, 0.32, k.pick(PAL.awning));
      k.windows(0.78, 0.62, 0, -0.04, fh, f - 1, fh, 3);
      k.balconies(0.78, 0, -0.04, 0.62, fh, f - 1, fh, 0xd9d4ca);
      k.box(0.8, 0.04, 0.64, 0, f * fh, -0.04, 0x6b6f78);
    }
  } else {
    k.box(0.96, 0.012, 0.96, 0, 0, 0, PAVE);
    if (v === 0) { // tower with balconies
      const f = 10 + ((k.r() * 5) | 0), fh = 0.17;
      k.box(0.6, 0.12, 0.6, 0, 0, 0, 0xcfc8bb);
      k.box(0.54, f * fh, 0.54, 0, 0.12, 0, wall);
      k.windows(0.54, 0.54, 0, 0, 0.12, f, fh, 3);
      k.balconies(0.54, 0, 0, 0.54, 0.12, f, fh, 0xe3dfd6);
      k.box(0.58, 0.05, 0.58, 0, 0.12 + f * fh, 0, 0x8a8f96);
      k.box(0.16, 0.1, 0.12, 0.12, 0.17 + f * fh, -0.1, 0xb8bcc2);
      k.cyl(0.008, 0.008, 0.3, -0.15, 0.17 + f * fh, 0.15, 0xdddddd, 4);
      k.box(0.18, 0.22, 0.02, 0, 0, 0.31, 0x3d4250);
    } else if (v === 1) { // slab block
      const f = 7 + ((k.r() * 3) | 0), fh = 0.17;
      k.box(0.88, f * fh, 0.46, 0, 0, -0.08, wall);
      k.windows(0.88, 0.46, 0, -0.08, 0, f, fh, 5);
      for (let i = -2; i <= 2; i++) k.box(0.012, f * fh, 0.02, i * 0.176, 0, 0.155, 0xe3dfd6);
      k.box(0.9, 0.05, 0.48, 0, f * fh, -0.08, 0x8a8f96);
      for (const x of [-0.3, 0, 0.3]) k.box(0.1, 0.08, 0.1, x, f * fh + 0.05, -0.12, 0xb8bcc2);
      k.tree(-0.36, 0.36); k.tree(0.36, 0.36);
    } else if (v === 2) { // stepped tower with roof garden
      const f1 = 8, f2 = 5, fh = 0.17;
      k.box(0.64, f1 * fh, 0.64, 0, 0, 0, wall);
      k.windows(0.64, 0.64, 0, 0, 0, f1, fh, 4);
      k.box(0.66, 0.03, 0.66, 0, f1 * fh, 0, 0x8a8f96);
      k.box(0.6, 0.015, 0.6, 0, f1 * fh + 0.03, 0, LAWN);
      k.box(0.4, f2 * fh, 0.4, -0.1, f1 * fh + 0.03, -0.1, k.pick(PAL.wallR));
      k.windows(0.4, 0.4, -0.1, -0.1, f1 * fh + 0.03, f2, fh, 2);
      k.box(0.42, 0.04, 0.42, -0.1, f1 * fh + 0.03 + f2 * fh, -0.1, 0x8a8f96);
      for (const [x, z] of [[0.2, 0.2], [0.22, -0.18], [-0.2, 0.22]]) { k.cyl(0.015, 0.02, 0.06, x, f1 * fh + 0.03, z, 0x6b4a2b, 5); k.ball(0.06, x, f1 * fh + 0.12, z, 0x4c9a3a); }
    } else { // round tower
      const f = 12 + ((k.r() * 5) | 0), fh = 0.16, rad = 0.3;
      k.cyl(rad + 0.04, rad + 0.04, 0.1, 0, 0, 0, 0xcfc8bb, 18);
      for (let i = 0; i < f; i++) {
        k.cyl(rad, rad, fh * 0.55, 0, 0.1 + i * fh, 0, wall, 18);
        k.ring(rad - 0.005, fh * 0.45, 0, 0.1 + i * fh + fh * 0.55, 0, k.r() < 0.7 ? 0xffd98a : 0x2a3448, 18);
        k.cyl(rad + 0.03, rad + 0.03, 0.012, 0, 0.1 + i * fh + fh - 0.006, 0, 0xe3dfd6, 18);
      }
      k.cyl(rad, rad, 0.04, 0, 0.1 + f * fh, 0, 0x8a8f96, 18);
      k.cyl(0.006, 0.006, 0.35, 0, 0.14 + f * fh, 0, 0xdddddd, 4);
      k.ball(0.02, 0, 0.5 + f * fh, 0, 0xff4040, true);
    }
  }
}
function commercial(level, v, k) {
  const wall = k.pick(PAL.wallC), gl = k.pick(PAL.glass);
  if (level === 1) {
    k.box(0.94, 0.012, 0.94, 0, 0, 0, PAVE);
    if (v === 0) { // corner shop
      k.box(0.7, 0.34, 0.56, 0, 0, -0.1, wall);
      k.box(0.6, 0.18, 0.01, 0, 0.03, 0.185, 0x9fd0f0, true);
      const aw = k.pick(PAL.awning);
      for (let i = 0; i < 6; i++) k.box(0.12, 0.03, 0.16, -0.3 + i * 0.12, 0.24, 0.25, i % 2 ? aw : 0xffffff);
      k.box(0.42, 0.1, 0.03, 0, 0.36, 0.17, aw, true);
      k.box(0.74, 0.03, 0.6, 0, 0.34, -0.1, 0x8a8f96);
      k.windows(0.7, 0.56, 0, -0.1, 0, 1, 0.34, 3, { faces: [1, 3] });
    } else if (v === 1) { // café with terrace
      k.box(0.5, 0.3, 0.42, -0.18, 0, -0.18, k.pick(PAL.brick));
      k.box(0.4, 0.15, 0.01, -0.18, 0.04, 0.035, 0xffd98a, true);
      k.box(0.54, 0.03, 0.46, -0.18, 0.3, -0.18, 0x5a4a3a);
      for (const [x, z] of [[0.2, 0.2], [0.2, -0.15], [-0.1, 0.3], [-0.38, 0.3]]) {
        k.cyl(0.05, 0.05, 0.08, x, 0, z, 0xffffff, 8);
        k.cyl(0.006, 0.006, 0.2, x, 0, z, 0xdddddd, 4);
        k.cone(0.12, 0.06, x, 0.18, z, k.pick(PAL.awning), 8);
      }
    } else if (v === 2) { // gas station
      k.box(0.94, 0.008, 0.94, 0, 0.012, 0, ASPHALT);
      for (const [x, z] of [[-0.25, -0.05], [0.25, -0.05], [-0.25, 0.25], [0.25, 0.25]]) k.box(0.04, 0.28, 0.04, x, 0, z, 0xdfe3ea);
      k.box(0.66, 0.05, 0.46, 0, 0.28, 0.1, 0xffffff);
      k.box(0.67, 0.025, 0.47, 0, 0.29, 0.1, k.pick(PAL.awning), true);
      for (const x of [-0.12, 0.12]) k.box(0.06, 0.12, 0.08, x, 0, 0.1, 0xe0403a);
      k.box(0.4, 0.22, 0.24, 0.18, 0, -0.3, wall);
      k.box(0.3, 0.1, 0.01, 0.18, 0.04, -0.175, 0x9fd0f0, true);
      k.cyl(0.015, 0.015, 0.5, -0.38, 0, -0.38, 0x9aa0a8, 5); k.box(0.12, 0.12, 0.03, -0.38, 0.45, -0.38, 0xf5c542, true);
      k.car(-0.12, 0.3);
    } else { // small office
      const f = 2, fh = 0.22;
      k.box(0.62, f * fh, 0.54, 0, 0, -0.06, wall);
      k.windows(0.62, 0.54, 0, -0.06, 0, f, fh, 3, { wr: 0.75 });
      k.box(0.66, 0.03, 0.58, 0, f * fh, -0.06, 0x8a8f96);
      k.box(0.3, 0.08, 0.02, 0, f * fh - 0.1, 0.215, k.pick(PAL.awning), true);
      k.tree(-0.36, 0.36, 0.8); k.tree(0.36, 0.36, 0.8);
    }
  } else if (level === 2) {
    k.box(0.96, 0.012, 0.96, 0, 0, 0, PAVE);
    if (v === 0) { // office block
      const f = 5 + ((k.r() * 3) | 0), fh = 0.18;
      k.box(0.72, f * fh, 0.62, 0, 0, -0.04, gl);
      for (let i = 0; i <= f; i++) k.box(0.73, 0.03, 0.63, 0, i * fh, -0.04, wall);
      k.windows(0.72, 0.62, 0, -0.04, 0, f, fh, 4, { wr: 0.8, hr: 0.55, lit: 0.55 });
      k.box(0.3, 0.12, 0.3, 0.12, f * fh, -0.1, 0xb8bcc2);
      k.box(0.3, 0.2, 0.02, 0, 0, 0.275, 0x2f3540);
    } else if (v === 1) { // mall with parking
      k.box(0.94, 0.008, 0.38, 0, 0.012, 0.27, ASPHALT);
      for (let i = -3; i <= 3; i++) k.box(0.01, 0.003, 0.16, i * 0.12, 0.02, 0.27, 0xffffff);
      for (const x of [-0.3, -0.06, 0.18, 0.42]) if (k.r() < 0.8) k.car(x, 0.27);
      k.box(0.9, 0.36, 0.5, 0, 0, -0.2, wall);
      k.box(0.3, 0.26, 0.01, 0, 0.02, 0.055, 0x9fd0f0, true);
      k.box(0.4, 0.04, 0.12, 0, 0.3, 0.1, k.pick(PAL.awning));
      k.box(0.5, 0.08, 0.02, 0, 0.38, 0.05, k.pick(PAL.awning), true);
      k.box(0.92, 0.03, 0.52, 0, 0.36, -0.2, 0x8a8f96);
      for (const x of [-0.3, 0.3]) k.box(0.14, 0.08, 0.14, x, 0.39, -0.24, 0xb8bcc2);
    } else if (v === 2) { // hotel with vertical sign
      const f = 6, fh = 0.18;
      k.box(0.6, f * fh, 0.56, 0, 0, -0.06, k.pick([0xe9d6c4, 0xdfe9f2, 0xf3e6d2]));
      k.windows(0.6, 0.56, 0, -0.06, 0, f, fh, 3);
      k.balconies(0.6, 0, -0.06, 0.56, 0, f, fh, 0xffffff);
      k.box(0.08, f * fh * 0.6, 0.04, 0.32, f * fh * 0.35, 0.2, k.pick([0xff4060, 0x40a0ff, 0xffb020]), true);
      k.box(0.64, 0.04, 0.6, 0, f * fh, -0.06, 0x8a8f96);
      k.box(0.4, 0.03, 0.14, 0, 0.18, 0.28, 0x2f3540);
    } else { // bank with columns
      k.box(0.8, 0.06, 0.62, 0, 0, -0.04, 0xe6e1d6);
      k.box(0.7, 0.5, 0.48, 0, 0.06, -0.1, 0xf2ede2);
      for (let i = -2; i <= 2; i++) k.cyl(0.03, 0.03, 0.42, i * 0.15, 0.06, 0.2, 0xffffff, 8);
      k.roof(0.8, 0.14, 0.64, 0, 0.56, -0.04, 0xe6e1d6, 0);
      k.windows(0.7, 0.48, 0, -0.1, 0.06, 2, 0.24, 3, { faces: [1, 3, 2] });
    }
  } else {
    k.box(0.98, 0.012, 0.98, 0, 0, 0, PAVE);
    if (v === 0) { // setback skyscraper with spire
      const t = [[0.74, 6], [0.58, 6], [0.42, 5]], fh = 0.18;
      let y = 0;
      for (const [w, f] of t) {
        k.box(w, f * fh, w, 0, y, 0, gl);
        k.windows(w, w, 0, 0, y, f, fh, Math.round(w * 6), { wr: 0.8, hr: 0.6, lit: 0.5 });
        y += f * fh;
        k.box(w + 0.02, 0.04, w + 0.02, 0, y, 0, 0xdfe5ec);
        y += 0.04;
      }
      k.cyl(0.01, 0.025, 0.6, 0, y, 0, 0xdfe5ec, 6);
      k.ball(0.022, 0, y + 0.62, 0, 0xff4040, true);
    } else if (v === 1) { // glass slab with crown lights
      const f = 16, fh = 0.17;
      k.box(0.7, f * fh, 0.5, 0, 0, -0.04, gl);
      for (let i = -3; i <= 3; i++) k.box(0.015, f * fh, 0.51, i * 0.1, 0, -0.04, 0xdfe5ec);
      k.windows(0.7, 0.5, 0, -0.04, 0, f, fh, 6, { wr: 0.7, hr: 0.6, lit: 0.45 });
      k.box(0.72, 0.18, 0.52, 0, f * fh, -0.04, gl);
      k.box(0.73, 0.04, 0.53, 0, f * fh + 0.14, -0.04, 0x9fe0ff, true);
    } else if (v === 2) { // twin towers with skybridge
      const f = 13, fh = 0.17;
      for (const x of [-0.22, 0.22]) {
        k.box(0.36, f * fh, 0.5, x, 0, 0, gl);
        k.windows(0.36, 0.5, x, 0, 0, f, fh, 2, { wr: 0.75, hr: 0.6, lit: 0.5 });
        k.box(0.38, 0.06, 0.52, x, f * fh, 0, 0xdfe5ec);
        k.cyl(0.008, 0.008, 0.3, x, f * fh + 0.06, 0, 0xdfe5ec, 4);
      }
      k.box(0.1, 0.1, 0.16, 0, f * fh * 0.6, 0, 0xdfe5ec);
      k.box(0.08, 0.05, 0.12, 0, f * fh * 0.6 + 0.03, 0, 0xffd98a, true);
    } else { // cylinder tower with helipad
      const f = 15, fh = 0.17, rad = 0.32;
      k.cyl(rad + 0.04, rad + 0.04, 0.2, 0, 0, 0, 0xdfe5ec, 20);
      k.cyl(rad, rad, f * fh, 0, 0.2, 0, gl, 20);
      for (let i = 0; i < f; i++) k.ring(rad + 0.004, fh * 0.45, 0, 0.2 + i * fh + fh * 0.3, 0, k.r() < 0.55 ? 0xffe7b0 : 0x2a3448, 20);
      k.cyl(rad + 0.06, rad + 0.06, 0.03, 0, 0.2 + f * fh, 0, 0x5a5f68, 20);
      k.cyl(0.14, 0.14, 0.006, 0, 0.23 + f * fh, 0, 0xffffff, 20);
      k.box(0.03, 0.008, 0.14, -0.04, 0.236 + f * fh, 0, 0x5a5f68); k.box(0.03, 0.008, 0.14, 0.04, 0.236 + f * fh, 0, 0x5a5f68); k.box(0.08, 0.008, 0.03, 0, 0.236 + f * fh, 0, 0x5a5f68);
    }
  }
}
function industrial(level, v, k, hitech) {
  const wall = k.pick(PAL.wallI), rf = k.pick(PAL.roofI), ac = k.pick(PAL.accent);
  k.box(0.96, 0.012, 0.96, 0, 0, 0, hitech ? LAWN : 0xa9a49a);
  if (hitech) { // clean high-tech campus
    k.box(0.7, 0.36, 0.42, -0.08, 0, -0.18, k.pick(PAL.glass));
    for (let i = 0; i <= 2; i++) k.box(0.71, 0.025, 0.43, -0.08, i * 0.12, -0.18, 0xffffff);
    k.windows(0.7, 0.42, -0.08, -0.18, 0, 3, 0.12, 5, { wr: 0.85, hr: 0.6, lit: 0.6 });
    k.box(0.34, 0.24, 0.3, 0.26, 0, 0.22, 0xffffff);
    k.windows(0.34, 0.3, 0.26, 0.22, 0, 2, 0.12, 2, { wr: 0.8, lit: 0.6 });
    k.cyl(0.006, 0.006, 0.1, -0.3, 0.36, -0.18, 0xdddddd, 4);
    B_dish(k, -0.3, 0.46, -0.18);
    k.tree(-0.32, 0.3); k.tree(0.0, 0.34, 0.8);
    return;
  }
  if (level === 1) {
    if (v === 0) { // sawtooth workshop with crates
      k.box(0.72, 0.3, 0.56, -0.06, 0, -0.08, wall);
      for (const x of [-0.24, 0, 0.24]) k.roof(0.24, 0.14, 0.56, x - 0.06, 0.3, -0.08, rf, Math.PI / 2);
      k.box(0.24, 0.2, 0.01, -0.06, 0, 0.2, ac);
      for (const [x, z] of [[0.36, 0.3], [0.36, 0.18], [0.24, 0.32]]) k.box(0.09, 0.09, 0.09, x, 0, z, 0xa07a48);
      k.windows(0.72, 0.56, -0.06, -0.08, 0, 1, 0.3, 4, { faces: [1, 3], lit: 0.4 });
    } else if (v === 1) { // storage yard
      for (let i = -4; i <= 4; i++) k.box(0.01, 0.1, 0.01, i * 0.11, 0, 0.45, 0x8a8f96);
      k.box(0.9, 0.08, 0.004, 0, 0.02, 0.45, 0xb8bcc2);
      k.box(0.36, 0.26, 0.3, -0.26, 0, -0.26, wall); k.box(0.38, 0.03, 0.32, -0.26, 0.26, -0.26, rf);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) k.box(0.12, 0.1 + ((a + b) % 2) * 0.1, 0.12, 0.08 + a * 0.13, 0, -0.05 + b * 0.18, k.pick([0x3a8ad6, 0xd65a3a, 0x3aa070, 0xe0a030]));
      k.box(0.06, 0.06, 0.1, -0.2, 0, 0.2, 0xf5c542);
    } else if (v === 2) { // small factory with chimney
      k.box(0.7, 0.36, 0.5, -0.06, 0, -0.06, k.pick(PAL.brick));
      k.box(0.72, 0.03, 0.52, -0.06, 0.36, -0.06, rf);
      k.cyl(0.05, 0.06, 0.6, 0.22, 0.36, -0.2, 0x9a5a44, 8);
      k.smoke.push([0.22, 0.98, -0.2]);
      k.windows(0.7, 0.5, -0.06, -0.06, 0, 1, 0.36, 4, { lit: 0.5 });
      k.box(0.2, 0.2, 0.01, -0.2, 0, 0.195, ac);
    } else { // lumber mill
      k.box(0.6, 0.28, 0.4, -0.12, 0, -0.22, 0x8a6a48);
      k.roof(0.64, 0.14, 0.44, -0.12, 0.28, -0.22, rf);
      for (let i = 0; i < 4; i++) k.cyl(0.04, 0.04, 0.5, 0.18, 0.04 + i * 0.07 - (i > 2 ? 0.07 : 0), 0.2 + (i % 2) * 0.09, 0x9a7448, 8);
      k.box(0.5, 0.02, 0.24, 0.18, 0, 0.24, 0x7a6a50);
      k.windows(0.6, 0.4, -0.12, -0.22, 0, 1, 0.28, 3, { faces: [0, 2], lit: 0.4 });
    }
  } else if (level === 2) {
    if (v === 0) { // warehouse with loading docks and truck
      k.box(0.86, 0.44, 0.56, 0, 0, -0.16, wall);
      k.box(0.88, 0.04, 0.58, 0, 0.44, -0.16, rf);
      for (const x of [-0.28, 0, 0.28]) k.box(0.18, 0.24, 0.01, x, 0, 0.125, ac);
      k.box(0.94, 0.008, 0.3, 0, 0.012, 0.3, ASPHALT);
      k.box(0.14, 0.16, 0.34, -0.28, 0, 0.32, 0xf2f2f2); k.box(0.14, 0.12, 0.1, -0.28, 0, 0.47, 0x3a8ad6);
      k.windows(0.86, 0.56, 0, -0.16, 0, 1, 0.44, 4, { faces: [1, 3, 2], lit: 0.4 });
    } else if (v === 1) { // chemical plant: tanks and pipes
      k.box(0.4, 0.34, 0.36, -0.24, 0, -0.24, wall);
      k.windows(0.4, 0.36, -0.24, -0.24, 0, 2, 0.17, 2, { lit: 0.5 });
      for (const [x, z] of [[0.2, -0.22], [0.2, 0.18], [-0.2, 0.22]]) { k.cyl(0.14, 0.14, 0.32, x, 0, z, 0xdfe3ea, 14); k.cyl(0.145, 0.145, 0.02, x, 0.22, z, ac, 14); }
      k.box(0.6, 0.03, 0.03, 0, 0.26, 0, 0x9aa0a8); k.box(0.03, 0.03, 0.5, 0.02, 0.26, 0, 0x9aa0a8);
      k.cyl(0.03, 0.04, 0.5, -0.36, 0.34, -0.36, 0x9a8f86, 8); k.smoke.push([-0.36, 0.88, -0.36]);
    } else if (v === 2) { // factory with chimney and conveyor
      k.box(0.82, 0.42, 0.68, 0, 0, 0, wall);
      k.box(0.84, 0.04, 0.7, 0, 0.42, 0, rf);
      k.box(0.3, 0.26, 0.01, -0.15, 0, 0.345, ac);
      k.cyl(0.06, 0.07, 0.8, 0.26, 0.42, -0.22, 0x9a8f86, 8);
      k.cyl(0.065, 0.065, 0.06, 0.26, 1.12, -0.22, 0xd65a3a, 8);
      k.smoke.push([0.26, 1.24, -0.22]);
      k.windows(0.82, 0.68, 0, 0, 0, 2, 0.21, 5, { lit: 0.5 });
    } else { // silos
      for (const [x, z] of [[-0.24, -0.2], [0, -0.2], [0.24, -0.2]]) { k.cyl(0.11, 0.11, 0.7, x, 0, z, 0xd8d4cc, 14); k.cone(0.11, 0.1, x, 0.7, z, 0xb8b4ac, 14); }
      k.box(0.7, 0.04, 0.06, 0, 0.6, -0.2, 0x9aa0a8);
      k.box(0.5, 0.3, 0.3, -0.1, 0, 0.24, wall); k.box(0.52, 0.03, 0.32, -0.1, 0.3, 0.24, rf);
      k.windows(0.5, 0.3, -0.1, 0.24, 0, 1, 0.3, 3, { lit: 0.5 });
      k.box(0.14, 0.16, 0.3, 0.32, 0, 0.26, 0xf2f2f2);
    }
  } else {
    if (v === 0) { // heavy factory with two chimneys
      k.box(0.88, 0.56, 0.6, 0, 0, -0.14, wall);
      for (const x of [-0.29, 0, 0.29]) k.roof(0.29, 0.18, 0.6, x, 0.56, -0.14, rf, Math.PI / 2);
      for (const x of [-0.22, 0.1]) { k.cyl(0.06, 0.075, 1.0, x, 0.56, -0.34, 0x9a8f86, 8); k.cyl(0.07, 0.07, 0.06, x, 1.48, -0.34, 0xd65a3a, 8); k.smoke.push([x, 1.62, -0.34]); }
      k.cyl(0.13, 0.13, 0.32, 0.3, 0, 0.3, 0xc9ccd1, 12);
      k.box(0.3, 0.24, 0.01, -0.18, 0, 0.165, ac);
      k.windows(0.88, 0.6, 0, -0.14, 0, 2, 0.28, 5, { lit: 0.5 });
    } else if (v === 1) { // refinery with flare
      for (const [x, z, rr] of [[-0.24, -0.24, 0.16], [0.22, -0.26, 0.13], [-0.26, 0.22, 0.12]]) { k.cyl(rr, rr, 0.24, x, 0, z, 0xe6e1d8, 14); k.cyl(rr + 0.005, rr + 0.005, 0.015, x, 0.24, z, 0x8a8f96, 14); }
      k.cyl(0.05, 0.05, 1.1, 0.24, 0, 0.2, 0xb8bcc2, 8);
      for (let i = 1; i < 5; i++) k.cyl(0.07, 0.07, 0.02, 0.24, i * 0.22, 0.2, 0x8a8f96, 8);
      k.cyl(0.015, 0.015, 0.4, 0.05, 0, 0.32, 0x9aa0a8, 5); k.ball(0.04, 0.05, 0.44, 0.32, 0xff8a2a, true);
      k.box(0.6, 0.03, 0.03, 0, 0.2, 0, 0x9aa0a8); k.box(0.03, 0.03, 0.6, 0, 0.16, 0, 0x9aa0a8);
      k.smoke.push([0.24, 1.15, 0.2]);
    } else if (v === 2) { // steel mill
      k.box(0.92, 0.62, 0.5, 0, 0, -0.22, 0x8a7a6a);
      k.roof(0.94, 0.16, 0.52, 0, 0.62, -0.22, 0x5a4a3a);
      for (const x of [-0.3, 0, 0.3]) { k.cyl(0.05, 0.06, 0.9, x, 0.62, -0.38, 0x7a6a5a, 8); k.smoke.push([x, 1.56, -0.38]); }
      k.box(0.3, 0.3, 0.3, 0.26, 0, 0.26, wall);
      k.box(0.06, 0.06, 0.4, -0.2, 0.3, 0.2, 0x8a8f96);
      k.box(0.3, 0.2, 0.01, -0.2, 0, 0.035, 0xff8a2a, true);
      k.windows(0.92, 0.5, 0, -0.22, 0, 2, 0.3, 6, { faces: [0, 1, 3], lit: 0.5 });
    } else { // big plant with gantry crane
      k.box(0.6, 0.48, 0.6, -0.16, 0, -0.16, wall);
      k.box(0.62, 0.04, 0.62, -0.16, 0.48, -0.16, rf);
      k.windows(0.6, 0.6, -0.16, -0.16, 0, 2, 0.24, 4, { lit: 0.5 });
      for (const z of [-0.3, 0.38]) { k.box(0.04, 0.5, 0.04, 0.38, 0, z, 0xf5c542); }
      k.box(0.06, 0.05, 0.74, 0.38, 0.5, 0.04, 0xf5c542);
      for (let i = 0; i < 3; i++) k.box(0.18, 0.1, 0.12, 0.3, 0, -0.2 + i * 0.18, k.pick([0x3a8ad6, 0xd65a3a, 0x3aa070]));
      k.cyl(0.05, 0.06, 0.7, -0.36, 0.48, -0.36, 0x9a8f86, 8); k.smoke.push([-0.36, 1.22, -0.36]);
    }
  }
}
function B_dish(k, x, y, z) { k.B.push({ g: new THREE.SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4).rotateX(Math.PI * 0.75).translate(x, y, z), c: 0xffffff }); }

export const VARIANTS = 4;
export function zoneTemplate(zone, level, v, hitech = false) {
  const k = kit(zone * 1000 + level * 100 + v * 7 + (hitech ? 55 : 3));
  if (zone === 1) residential(level, v, k);
  else if (zone === 2) commercial(level, v, k);
  else industrial(level, v, k, hitech);
  return done(k);
}

// ------------------------------------------------------------------ civic, utility and landmark structures
export function structModel(type) {
  const k = kit(type.length * 977);
  const plate = (w, h, c = PAVE) => k.box(w - 0.04, 0.012, h - 0.04, 0, 0, 0, c);
  switch (type) {
    case 'coal': {
      plate(2, 2, 0x9a9488);
      k.box(1.0, 0.7, 0.8, -0.35, 0, 0.4, 0xb7b0a4);
      k.windows(1.0, 0.8, -0.35, 0.4, 0, 2, 0.35, 6, { lit: 0.5 });
      k.box(1.04, 0.06, 0.84, -0.35, 0.7, 0.4, 0x7a7f87);
      for (const [x, z] of [[0.55, -0.45], [0.55, 0.3]]) {
        k.cyl(0.16, 0.2, 1.6, x, 0, z, 0xd8d4cc, 12);
        for (let i = 0; i < 3; i++) k.cyl(0.165 - i * 0.012, 0.17 - i * 0.012, 0.12, x, 0.4 + i * 0.45, z, 0xd04a3a, 12);
        k.smoke.push([x, 1.65, z, 1]);
      }
      k.cone(0.42, 0.3, -0.5, 0, -0.5, 0x2e2b2a, 7); k.cone(0.3, 0.22, -0.05, 0, -0.62, 0x3a3634, 7);
      k.box(0.06, 0.06, 0.8, -0.3, 0.3, -0.3, 0x8a8f96);
      break;
    }
    case 'gas': {
      plate(2, 2, 0xa9a49a);
      k.box(0.9, 0.5, 0.7, -0.4, 0, 0.4, 0xdfe3ea);
      k.windows(0.9, 0.7, -0.4, 0.4, 0, 2, 0.25, 5, { lit: 0.5 });
      k.box(0.92, 0.04, 0.72, -0.4, 0.5, 0.4, 0x5a8ad6);
      for (const [x, z] of [[0.4, -0.4], [-0.3, -0.45]]) { k.sphere(0.3, x, 0.42, z, 0xf2f2f2); for (const a of [0, 1.6, 3.2, 4.8]) k.box(0.03, 0.3, 0.03, x + Math.cos(a) * 0.22, 0, z + Math.sin(a) * 0.22, 0x9aa0a8); }
      k.cyl(0.07, 0.08, 1.0, 0.55, 0, 0.5, 0xc0c4ca, 10); k.smoke.push([0.55, 1.05, 0.5]);
      break;
    }
    case 'wind': {
      plate(1, 1, LAWN);
      k.cyl(0.03, 0.06, 1.5, 0, 0, 0, 0xf2f4f7, 10);
      k.box(0.08, 0.08, 0.2, 0, 1.48, 0, 0xf2f4f7);
      k.ball(0.03, 0, 1.6, 0.0, 0xff4040, true);
      const blades = [];
      for (let i = 0; i < 3; i++) blades.push({ g: new THREE.BoxGeometry(0.05, 0.62, 0.012).translate(0, 0.33, 0).rotateZ((i * Math.PI * 2) / 3), c: 0xffffff });
      blades.push({ g: new THREE.SphereGeometry(0.04, 8, 6), c: 0xf2f4f7 });
      k.spin.push({ geo: mergeParts(blades), pos: [0, 1.52, 0.12] });
      break;
    }
    case 'solar': {
      plate(2, 2, 0x7dbb5a);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const x = -0.6 + a * 0.6, z = -0.6 + b * 0.6;
        k.box(0.04, 0.16, 0.04, x, 0.01, z, 0x9aa0a8);
        k.B.push({ g: new THREE.BoxGeometry(0.52, 0.025, 0.44).rotateX(-0.45).translate(x, 0.24, z), c: 0x21407a });
        k.B.push({ g: new THREE.BoxGeometry(0.5, 0.004, 0.42).rotateX(-0.45).translate(x, 0.254, z + 0.006), c: 0x3a6ab8 });
      }
      k.box(0.3, 0.24, 0.2, 0.75, 0.01, 0.8, 0xe9eef5);
      break;
    }
    case 'nuclear': {
      plate(3, 3, 0xb9b6ae);
      const tower = new THREE.LatheGeometry([new THREE.Vector2(0.5, 0), new THREE.Vector2(0.38, 0.6), new THREE.Vector2(0.33, 1.0), new THREE.Vector2(0.37, 1.4)], 20);
      for (const [x, z] of [[-0.75, -0.6], [0.2, -0.75]]) { k.B.push({ g: tower.clone().translate(x, 0, z), c: 0xe6e3dc }); k.smoke.push([x, 1.45, z, 2]); }
      k.cyl(0.38, 0.38, 0.5, 0.6, 0, 0.55, 0xdfe3ea, 20);
      k.B.push({ g: new THREE.SphereGeometry(0.38, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0.6, 0.5, 0.55), c: 0xdfe3ea });
      k.box(1.0, 0.45, 0.6, -0.5, 0, 0.75, 0xc9ccd1);
      k.windows(1.0, 0.6, -0.5, 0.75, 0, 2, 0.22, 6, { lit: 0.6 });
      k.box(0.4, 0.06, 0.4, -0.5, 0.45, 0.75, 0xf5c542);
      for (let i = -6; i <= 6; i++) { k.box(0.015, 0.14, 0.015, i * 0.22, 0, 1.44, 0x9aa0a8); k.box(0.015, 0.14, 0.015, 1.44, 0, i * 0.22, 0x9aa0a8); }
      break;
    }
    case 'pump': {
      plate(1, 1);
      k.box(0.5, 0.26, 0.42, -0.12, 0, 0.1, 0xdfe6ee);
      k.box(0.54, 0.04, 0.46, -0.12, 0.26, 0.1, 0x3a7ac8);
      k.windows(0.5, 0.42, -0.12, 0.1, 0, 1, 0.26, 3, { lit: 0.5 });
      for (const [x, z] of [[0.14, -0.32], [0.38, -0.32], [0.14, -0.08], [0.38, -0.08]]) k.cyl(0.015, 0.015, 0.4, x, 0, z, 0x8a8f96, 5);
      k.cyl(0.08, 0.08, 0.3, 0.26, 0, 0.3, 0x5aa6ea, 10);
      k.box(0.3, 0.05, 0.05, 0.26, 0.1, 0.42, 0x8a8f96);
      break;
    }
    case 'tower': {
      plate(1, 1, LAWN);
      for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) k.cyl(0.02, 0.025, 0.8, x, 0, z, 0x9aa0a8, 6);
      k.cyl(0.32, 0.32, 0.32, 0, 0.8, 0, 0x5aa6ea, 16);
      k.cone(0.33, 0.14, 0, 1.12, 0, 0x3a7ac8, 16);
      k.cyl(0.33, 0.33, 0.03, 0, 0.8, 0, 0xffffff, 16);
      break;
    }
    case 'police': {
      plate(1, 1);
      k.box(0.78, 0.42, 0.56, 0, 0, -0.1, 0xeef2f7);
      k.box(0.8, 0.09, 0.58, 0, 0.32, -0.1, 0x2f5fc0);
      k.box(0.82, 0.04, 0.6, 0, 0.42, -0.1, 0x3a4250);
      k.windows(0.78, 0.56, 0, -0.1, 0, 1, 0.3, 4, { lit: 0.8 });
      k.box(0.2, 0.22, 0.02, 0, 0, 0.19, 0x2f3a4a);
      k.box(0.08, 0.05, 0.05, -0.04, 0.46, -0.1, 0xff3b3b, true); k.box(0.08, 0.05, 0.05, 0.04, 0.46, -0.1, 0x3b6bff, true);
      for (const x of [-0.25, 0.25]) { k.box(0.12, 0.06, 0.22, x, 0, 0.34, 0xffffff); k.box(0.12, 0.04, 0.1, x, 0.06, 0.34, 0x1f3f8a); }
      break;
    }
    case 'fire': {
      plate(1, 1);
      k.box(0.7, 0.42, 0.6, -0.06, 0, -0.06, 0xc8453a);
      for (const x of [-0.24, 0.1]) k.box(0.26, 0.28, 0.02, x, 0, 0.245, 0xe9e4da);
      k.box(0.72, 0.04, 0.62, -0.06, 0.42, -0.06, 0x7a2a24);
      k.windows(0.7, 0.6, -0.06, -0.06, 0.28, 1, 0.14, 4, { faces: [0], lit: 0.8 });
      k.box(0.2, 0.8, 0.2, 0.32, 0, -0.24, 0xd25a48);
      k.roof(0.24, 0.12, 0.24, 0.32, 0.8, -0.24, 0x7a2a24);
      k.box(0.16, 0.12, 0.34, -0.24, 0, 0.42, 0xe0403a);
      break;
    }
    case 'clinic': {
      plate(1, 1);
      k.box(0.74, 0.36, 0.54, 0, 0, -0.1, 0xffffff);
      k.windows(0.74, 0.54, 0, -0.1, 0, 2, 0.18, 4, { lit: 0.8 });
      k.box(0.78, 0.03, 0.58, 0, 0.36, -0.1, 0x9aa0a8);
      k.box(0.2, 0.06, 0.02, 0, 0.42, 0.18, 0xe0403a, true); k.box(0.06, 0.2, 0.02, 0, 0.35, 0.18, 0xe0403a, true);
      k.box(0.3, 0.03, 0.14, 0, 0.18, 0.24, 0xe0403a);
      break;
    }
    case 'hospital': {
      plate(2, 2);
      k.box(1.4, 0.9, 0.7, 0, 0, -0.4, 0xffffff);
      k.windows(1.4, 0.7, 0, -0.4, 0, 5, 0.18, 8, { lit: 0.85 });
      k.box(0.6, 0.5, 0.7, -0.4, 0, 0.35, 0xeef2f7);
      k.windows(0.6, 0.7, -0.4, 0.35, 0, 3, 0.17, 3, { lit: 0.85 });
      k.box(1.44, 0.04, 0.74, 0, 0.9, -0.4, 0x9aa0a8);
      k.cyl(0.26, 0.26, 0.02, 0.2, 0.94, -0.4, 0x3a4250, 18); k.box(0.04, 0.006, 0.2, 0.14, 0.962, -0.4, 0xffffff); k.box(0.04, 0.006, 0.2, 0.26, 0.962, -0.4, 0xffffff); k.box(0.12, 0.006, 0.04, 0.2, 0.962, -0.4, 0xffffff);
      k.box(0.3, 0.1, 0.03, 0.4, 0.72, -0.04, 0xe0403a, true);
      k.box(0.5, 0.008, 0.6, 0.45, 0.012, 0.45, ASPHALT); k.box(0.16, 0.14, 0.3, 0.45, 0, 0.45, 0xffffff); k.box(0.16, 0.03, 0.3, 0.45, 0.14, 0.45, 0xe0403a);
      break;
    }
    case 'school': {
      plate(1, 1);
      k.box(0.82, 0.38, 0.36, 0, 0, -0.24, 0xf2dfb0);
      k.box(0.34, 0.38, 0.5, -0.24, 0, 0.06, 0xf2dfb0);
      k.windows(0.82, 0.36, 0, -0.24, 0, 2, 0.19, 5, { faces: [0, 2], lit: 0.6 });
      k.roof(0.86, 0.16, 0.4, 0, 0.38, -0.24, 0xb0553a);
      k.roof(0.38, 0.16, 0.54, -0.24, 0.38, 0.06, 0xb0553a, Math.PI / 2);
      k.box(0.36, 0.006, 0.32, 0.2, 0.012, 0.2, 0xd9a05a);
      k.cyl(0.012, 0.012, 0.6, 0.38, 0, 0.38, 0xdddddd, 5); k.box(0.16, 0.1, 0.01, 0.46, 0.48, 0.38, 0x3b82f6);
      k.box(0.12, 0.08, 0.04, 0.16, 0, 0.16, 0xe0403a); k.box(0.02, 0.12, 0.02, 0.28, 0, 0.12, 0xf5c542);
      break;
    }
    case 'university': {
      plate(2, 2, LAWN);
      k.box(1.3, 0.5, 0.42, 0, 0, -0.6, 0xd8c8a8);
      k.windows(1.3, 0.42, 0, -0.6, 0, 2, 0.25, 8, { lit: 0.6 });
      k.roof(1.34, 0.2, 0.46, 0, 0.5, -0.6, 0x7a5a48);
      k.box(0.42, 0.5, 1.0, -0.62, 0, 0.1, 0xd8c8a8);
      k.windows(0.42, 1.0, -0.62, 0.1, 0, 2, 0.25, 2, { lit: 0.6 });
      k.roof(0.46, 0.2, 1.04, -0.62, 0.5, 0.1, 0x7a5a48, Math.PI / 2);
      k.box(0.2, 1.1, 0.2, 0.3, 0, -0.3, 0xd8c8a8);
      k.box(0.12, 0.12, 0.01, 0.3, 0.9, -0.195, 0xfff2d0, true);
      k.hip(0.26, 0.3, 0.26, 0.3, 1.1, -0.3, 0x5b6b7a);
      k.box(0.7, 0.006, 0.1, 0.3, 0.015, 0.4, PAVE); k.box(0.1, 0.006, 0.7, 0.3, 0.015, 0.2, PAVE);
      for (const [x, z] of [[0.7, 0.7], [0.0, 0.7], [0.7, 0.1], [-0.2, -0.1]]) k.tree(x, z, 1.2);
      break;
    }
    case 'park': {
      plate(1, 1, LAWN);
      k.box(0.96, 0.016, 0.12, 0, 0.012, 0, 0xe8dcc0); k.box(0.12, 0.016, 0.96, 0, 0.012, 0, 0xe8dcc0);
      k.cyl(0.16, 0.18, 0.06, 0, 0.012, 0, 0xcfc8bb, 12); k.cyl(0.12, 0.12, 0.02, 0, 0.07, 0, 0x5ab4ea, 12);
      k.cyl(0.015, 0.02, 0.12, 0, 0.07, 0, 0xcfc8bb, 6);
      for (const [x, z] of [[-0.3, -0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, 0.3]]) k.tree(x, z, 1.3);
      for (const [x, z] of [[-0.2, 0.08], [0.2, -0.08]]) k.box(0.12, 0.03, 0.04, x, 0.02, z, 0x8a6a48);
      for (const [x, z] of [[0.08, 0.36], [-0.36, -0.08]]) { k.cyl(0.006, 0.006, 0.16, x, 0, z, 0x3a4250, 4); k.ball(0.02, x, 0.17, z, 0xffe7b0, true); }
      break;
    }
    case 'plaza': {
      plate(2, 2, LAWN);
      k.cyl(0.5, 0.5, 0.02, 0.2, 0.012, 0.2, 0x5ab4ea, 24);
      k.cyl(0.52, 0.52, 0.04, 0.2, 0.0, 0.2, 0xcfc8bb, 24);
      k.cyl(0.03, 0.06, 0.25, 0.2, 0.02, 0.2, 0xcfc8bb, 8);
      k.box(1.9, 0.016, 0.14, 0, 0.012, -0.55, 0xe8dcc0); k.box(0.14, 0.016, 1.9, -0.55, 0.012, 0, 0xe8dcc0);
      k.box(0.5, 0.25, 0.3, -0.6, 0, 0.6, 0xf2ede2); k.roof(0.54, 0.15, 0.34, -0.6, 0.25, 0.6, 0x7a5a48);
      for (const [x, z] of [[-0.7, -0.75], [0.7, -0.75], [0.8, 0.8], [-0.2, 0.85], [0.85, 0.1], [-0.8, -0.1], [-0.2, -0.25]]) k.tree(x, z, 1.4);
      for (let i = -3; i <= 3; i++) { k.cyl(0.006, 0.006, 0.18, i * 0.25, 0, -0.45, 0x3a4250, 4); k.ball(0.02, i * 0.25, 0.19, -0.45, 0xffe7b0, true); }
      break;
    }
    case 'bus': {
      k.box(0.96, 0.012, 0.96, 0, 0, 0, PAVE);
      k.box(0.5, 0.02, 0.18, 0, 0.012, 0.3, 0xdfe3ea);
      for (const x of [-0.22, 0.22]) k.box(0.02, 0.24, 0.02, x, 0, 0.36, 0x5a5f68);
      k.box(0.5, 0.02, 0.2, 0, 0.24, 0.3, 0x3a7ac8);
      k.box(0.46, 0.16, 0.01, 0, 0.06, 0.23, 0x9fd0f0);
      k.box(0.6, 0.18, 0.2, 0, 0.02, -0.18, 0xf5c542); k.box(0.58, 0.07, 0.205, 0, 0.12, -0.18, 0x3a4250, true);
      k.cyl(0.01, 0.01, 0.4, 0.38, 0, 0.36, 0x5a5f68, 4); k.box(0.1, 0.1, 0.02, 0.38, 0.36, 0.36, 0x2f6fe0, true);
      break;
    }
    case 'landfill': {
      plate(2, 2, 0x8a7a5a);
      for (const [x, z, s] of [[-0.4, -0.3, 0.5], [0.3, -0.4, 0.4], [0.1, 0.3, 0.45]]) { k.B.push({ g: new THREE.IcosahedronGeometry(s, 0).scale(1, 0.4, 1).translate(x, 0, z), c: 0x6b5a40 }); k.ball(s * 0.25, x + 0.1, s * 0.35, z, 0x7a8a5a); }
      for (let i = -4; i <= 4; i++) { k.box(0.015, 0.14, 0.015, i * 0.22, 0, 0.94, 0x8a8f96); k.box(0.015, 0.14, 0.015, -0.94, 0, i * 0.22, 0x8a8f96); }
      k.box(0.18, 0.16, 0.32, 0.6, 0, 0.6, 0x3aa070); k.box(0.18, 0.1, 0.1, 0.6, 0, 0.8, 0x2a4a3a);
      break;
    }
    case 'recycling': {
      plate(2, 2);
      k.box(1.1, 0.5, 0.8, -0.3, 0, -0.4, 0x7ab87a);
      k.windows(1.1, 0.8, -0.3, -0.4, 0, 2, 0.25, 6, { lit: 0.5 });
      k.roof(1.14, 0.2, 0.84, -0.3, 0.5, -0.4, 0x4a7a4a);
      for (let i = 0; i < 4; i++) k.box(0.18, 0.14, 0.14, -0.6 + i * 0.25, 0, 0.55, [0x3a8ad6, 0xf5c542, 0x3aa070, 0xe0403a][i]);
      k.box(0.12, 0.6, 0.12, 0.6, 0, -0.5, 0x8a8f96);
      k.box(0.06, 0.04, 0.6, 0.45, 0.5, -0.3, 0x8a8f96);
      break;
    }
    case 'cityhall': {
      plate(2, 2);
      k.box(1.5, 0.1, 1.1, 0, 0, -0.2, 0xe6e1d6);
      k.box(1.3, 0.6, 0.8, 0, 0.1, -0.3, 0xf2ede2);
      k.windows(1.3, 0.8, 0, -0.3, 0.1, 2, 0.3, 7, { lit: 0.7 });
      for (let i = -3; i <= 3; i++) k.cyl(0.04, 0.04, 0.55, i * 0.17, 0.1, 0.15, 0xffffff, 10);
      k.roof(1.3, 0.2, 0.32, 0, 0.66, 0.12, 0xe6e1d6);
      k.cyl(0.3, 0.3, 0.3, 0, 0.7, -0.3, 0xf2ede2, 18);
      k.B.push({ g: new THREE.SphereGeometry(0.32, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.0, -0.3), c: 0x6fa8c0 });
      k.cyl(0.01, 0.01, 0.3, 0, 1.3, -0.3, 0xdddddd, 4); k.box(0.12, 0.08, 0.005, 0.06, 1.52, -0.3, 0x3b82f6);
      k.box(1.0, 0.012, 0.5, 0, 0.012, 0.65, 0xe8dcc0);
      for (const x of [-0.6, 0.6]) k.tree(x, 0.7, 1.3);
      break;
    }
    case 'stadium': {
      plate(2, 2, 0xbab3a6);
      k.B.push({ g: new THREE.CylinderGeometry(0.95, 0.82, 0.5, 28, 1, true).translate(0, 0.27, 0), c: 0xe6e9ee });
      k.B.push({ g: new THREE.CylinderGeometry(0.9, 0.76, 0.48, 28, 1, true).scale(-1, 1, 1).translate(0, 0.28, 0), c: 0x3b82f6 });
      k.cyl(0.75, 0.75, 0.04, 0, 0.02, 0, 0x4fb04a, 28);
      k.box(0.9, 0.004, 0.02, 0, 0.065, 0, 0xffffff);
      for (const a of [0.5, 2.1, 3.7, 5.3]) { k.cyl(0.02, 0.02, 1.1, Math.cos(a) * 0.98, 0, Math.sin(a) * 0.98, 0xc9ccd1, 5); k.box(0.16, 0.08, 0.04, Math.cos(a) * 0.98, 1.1, Math.sin(a) * 0.98, 0xfff8e0, true); }
      break;
    }
    case 'landmark': {
      plate(1, 1);
      k.box(0.7, 0.3, 0.7, 0, 0, 0, 0xdfe5ec);
      let y = 0.3;
      for (const [w, h] of [[0.56, 1.4], [0.44, 1.2], [0.32, 1.0], [0.2, 0.6]]) {
        k.box(w, h, w, 0, y, 0, 0x7ab0d8);
        k.windows(w, w, 0, 0, y, Math.round(h / 0.17), 0.17, Math.max(1, Math.round(w * 6)), { wr: 0.8, hr: 0.6, lit: 0.6 });
        y += h;
        k.box(w + 0.04, 0.05, w + 0.04, 0, y, 0, 0xf5c542, true);
        y += 0.05;
      }
      k.cyl(0.01, 0.04, 0.9, 0, y, 0, 0xdfe5ec, 6); k.ball(0.03, 0, y + 0.92, 0, 0xff4040, true);
      break;
    }
    default: plate(1, 1);
  }
  return done(k);
}

// ------------------------------------------------------------------ small shared pieces
export function treeGeos() {
  return [
    mergeParts([{ g: new THREE.CylinderGeometry(0.035, 0.05, 0.2, 5).translate(0, 0.1, 0), c: 0x6b4a2b }, { g: new THREE.IcosahedronGeometry(0.2, 0).translate(0, 0.32, 0), c: 0x4c9a3a }, { g: new THREE.IcosahedronGeometry(0.13, 0).translate(0.1, 0.46, 0.04), c: 0x5cab45 }]),
    mergeParts([{ g: new THREE.CylinderGeometry(0.035, 0.05, 0.16, 5).translate(0, 0.08, 0), c: 0x6b4a2b }, { g: new THREE.ConeGeometry(0.2, 0.34, 7).translate(0, 0.3, 0), c: 0x2f7d3a }, { g: new THREE.ConeGeometry(0.14, 0.26, 7).translate(0, 0.5, 0), c: 0x3d9848 }]),
  ];
}
export function carGeo() {
  return mergeParts([
    { g: new THREE.BoxGeometry(0.11, 0.055, 0.21).translate(0, 0.065, 0), c: 0xffffff },
    { g: new THREE.BoxGeometry(0.095, 0.045, 0.1).translate(0, 0.115, -0.01), c: 0xcfd8e2 },
    { g: new THREE.BoxGeometry(0.12, 0.03, 0.04).translate(0, 0.04, 0.07), c: 0x2a2a2a },
    { g: new THREE.BoxGeometry(0.12, 0.03, 0.04).translate(0, 0.04, -0.07), c: 0x2a2a2a },
  ]);
}
export function poleGeo() {
  return mergeParts([
    { g: new THREE.CylinderGeometry(0.018, 0.024, 0.62, 6).translate(0, 0.31, 0), c: 0x7a5a3a },
    { g: new THREE.BoxGeometry(0.24, 0.02, 0.02).translate(0, 0.58, 0), c: 0x6a4a2a },
    { g: new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6).translate(-0.1, 0.605, 0), c: 0xdfe3ea },
    { g: new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6).translate(0.1, 0.605, 0), c: 0xdfe3ea },
  ]);
}
export function lampGeos() {
  return {
    body: mergeParts([{ g: new THREE.CylinderGeometry(0.008, 0.012, 0.32, 5).translate(0, 0.16, 0), c: 0x4a4f5a }, { g: new THREE.BoxGeometry(0.012, 0.012, 0.1).translate(0, 0.32, 0.045), c: 0x4a4f5a }]),
    head: mergeParts([{ g: new THREE.BoxGeometry(0.06, 0.025, 0.07).translate(0, 0.305, 0.09), c: 0xffe7b0 }, { g: new THREE.CircleGeometry(0.14, 12).rotateX(-Math.PI / 2).translate(0, -0.035, 0.12), c: 0xc8a050 }]),
  };
}
