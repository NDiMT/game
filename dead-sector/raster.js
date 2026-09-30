// Tiny software 3D renderer used once at startup to pre-render weapon view
// models: boxes and cylinders in view space, z-buffered triangles with
// interpolated normals, a three-light rig with specular and rim light,
// 2x supersampling, then posterize + outline for a crisp pixel-art finish.

export function vec(x, y, z) { return [x, y, z]; }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---- 3x4 transforms ----
export function mat(pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const [rx, ry, rz] = rot;
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Ry * Rx * Rz
  const r = [
    [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx],
    [cx * sz, cx * cz, -sx],
    [-sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx],
  ];
  return { r: r.map((row) => row.map((v, j) => v * scale[j])), t: pos };
}
export function mul(a, b) {
  const r = [0, 1, 2].map((i) => [0, 1, 2].map((j) => a.r[i][0] * b.r[0][j] + a.r[i][1] * b.r[1][j] + a.r[i][2] * b.r[2][j]));
  const t = [0, 1, 2].map((i) => a.r[i][0] * b.t[0] + a.r[i][1] * b.t[1] + a.r[i][2] * b.t[2] + a.t[i]);
  return { r, t };
}
const apply = (m, p) => [0, 1, 2].map((i) => m.r[i][0] * p[0] + m.r[i][1] * p[1] + m.r[i][2] * p[2] + m.t[i]);
const applyN = (m, n) => norm([0, 1, 2].map((i) => m.r[i][0] * n[0] + m.r[i][1] * n[1] + m.r[i][2] * n[2]));

// ---- Scene ----
export class Scene {
  constructor() { this.tris = []; this.stack = [mat()]; }
  get m() { return this.stack[this.stack.length - 1]; }
  push(m) { this.stack.push(mul(this.m, m)); return this; }
  pop() { this.stack.pop(); return this; }
  group(m, fn) { this.push(m); fn(); this.pop(); }

  tri(a, b, c, na, nb, nc, mtl) {
    const m = this.m;
    this.tris.push({
      p: [apply(m, a), apply(m, b), apply(m, c)],
      n: [applyN(m, na), applyN(m, nb), applyN(m, nc)],
      mtl,
    });
  }
  quad(a, b, c, d, n, mtl) { this.tri(a, b, c, n, n, n, mtl); this.tri(a, c, d, n, n, n, mtl); }

  // Box centered at c with size s. Optional bevel shrinks the top face for a chamfered look.
  box(c, s, mtl, { bevel = 0 } = {}) {
    const [x, y, z] = c, [w, h, d] = s.map((v) => v / 2);
    const b = bevel;
    const p = (sx, sy, sz, top) => [x + sx * (w - (top ? b : 0)), y + sy * h, z + sz * (d - (top ? b : 0))];
    const faces = [
      [[p(-1, 1, -1, 1), p(1, 1, -1, 1), p(1, 1, 1, 1), p(-1, 1, 1, 1)], [0, 1, 0]],
      [[p(-1, -1, 1), p(1, -1, 1), p(1, -1, -1), p(-1, -1, -1)], [0, -1, 0]],
      [[p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1, 1), p(-1, 1, -1, 1)], [0, 0, -1]],
      [[p(1, -1, 1), p(-1, -1, 1), p(-1, 1, 1, 1), p(1, 1, 1, 1)], [0, 0, 1]],
      [[p(-1, -1, 1), p(-1, -1, -1), p(-1, 1, -1, 1), p(-1, 1, 1, 1)], [-1, 0, 0]],
      [[p(1, -1, -1), p(1, -1, 1), p(1, 1, 1, 1), p(1, 1, -1, 1)], [1, 0, 0]],
    ];
    for (const [q, n] of faces) {
      let nn = n;
      if (b && n[1] === 0) nn = norm([n[0], 0.5, n[2]]); // bevelled sides catch light
      this.quad(q[0], q[1], q[2], q[3], nn, mtl);
    }
  }

  // Cylinder along +z from z0 to z1 (radius r0 at z0, r1 at z1), centered at (x, y).
  cyl(x, y, z0, z1, r0, r1, mtl, { seg = 20, caps = true, capMtl = mtl } = {}) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const slope = (r0 - r1) / Math.max(1e-6, z1 - z0);
      const n0 = norm([c0, s0, slope]), n1 = norm([c1, s1, slope]);
      const A = [x + c0 * r0, y + s0 * r0, z0], B = [x + c1 * r0, y + s1 * r0, z0];
      const C = [x + c1 * r1, y + s1 * r1, z1], D = [x + c0 * r1, y + s0 * r1, z1];
      this.tri(A, B, C, n0, n1, n1, mtl);
      this.tri(A, C, D, n0, n1, n0, mtl);
      if (caps) {
        this.tri([x, y, z1], D, C, [0, 0, 1], [0, 0, 1], [0, 0, 1], capMtl);
        this.tri([x, y, z0], B, A, [0, 0, -1], [0, 0, -1], [0, 0, -1], capMtl);
      }
    }
  }

  // Sphere (used for knuckles and fingertips).
  ball(c, r, mtl, seg = 10) {
    for (let i = 0; i < seg; i++)
      for (let j = 0; j < seg; j++) {
        const pt = (u, v) => {
          const th = (u / seg) * Math.PI * 2, ph = (v / seg) * Math.PI;
          return [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)];
        };
        const a = pt(i, j), b = pt(i + 1, j), cc = pt(i + 1, j + 1), d = pt(i, j + 1);
        const P = (n) => [c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r];
        this.tri(P(a), P(b), P(cc), a, b, cc, mtl);
        this.tri(P(a), P(cc), P(d), a, cc, d, mtl);
      }
  }
}

// ---- Materials ----
export const M = {
  gunmetal: { c: [70, 76, 88], spec: 0.9, shin: 46, rough: 0.07 },
  blued: { c: [46, 54, 72], spec: 1.0, shin: 60, rough: 0.05 },
  steel: { c: [120, 126, 136], spec: 1.1, shin: 70, rough: 0.05 },
  polymer: { c: [34, 36, 40], spec: 0.28, shin: 14, rough: 0.12 },
  wood: { c: [118, 66, 32], spec: 0.25, shin: 16, rough: 0.18, grain: true },
  olive: { c: [78, 90, 56], spec: 0.35, shin: 18, rough: 0.12 },
  cloth: { c: [52, 58, 44], spec: 0.05, shin: 6, rough: 0.2 },
  leather: { c: [40, 34, 28], spec: 0.35, shin: 18, rough: 0.14 },
  plate: { c: [88, 96, 104], spec: 0.8, shin: 34, rough: 0.08 },
  brass: { c: [196, 150, 60], spec: 1.2, shin: 50, rough: 0.05 },
  red: { c: [170, 30, 24], spec: 0.6, shin: 30, rough: 0.05 },
  hazard: { c: [210, 168, 30], spec: 0.3, shin: 12, rough: 0.1 },
  black: { c: [12, 12, 14], spec: 0.2, shin: 10, rough: 0.05 },
  sciblue: { c: [70, 86, 116], spec: 0.9, shin: 40, rough: 0.06 },
  glowBlue: { emit: [120, 210, 255] },
  glowWhite: { emit: [235, 250, 255] },
  glowRed: { emit: [255, 60, 40] },
  glowGreen: { emit: [90, 255, 140] },
  tritium: { emit: [180, 255, 170] },
};

// ---- Rendering ----
const LIGHTS = [
  { d: norm([-0.55, 0.75, -0.35]), c: 1.05 }, // key: upper left, slightly behind the camera
  { d: norm([0.7, 0.2, -0.3]), c: 0.35 },    // fill from the right
  { d: norm([0.2, 0.5, 0.9]), c: 0.45 },     // rim from beyond the gun
];

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function render(scene, w, h, { focal = 1.25, cx = 0.5, cy = 0.5 } = {}) {
  const SS = 2;
  const W = w * SS, H = h * SS;
  const f = focal * W;
  const zb = new Float32Array(W * H).fill(Infinity);
  const col = new Float32Array(W * H * 3);
  const cov = new Uint8Array(W * H);

  for (const t of scene.tris) {
    const [a, b, c] = t.p;
    if (a[2] < 0.03 || b[2] < 0.03 || c[2] < 0.03) continue;
    const pr = (p) => [W * cx + (f * p[0]) / p[2], H * cy - (f * p[1]) / p[2], p[2]];
    const A = pr(a), B = pr(b), C = pr(c);
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (Math.abs(area) < 1e-6) continue;
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const mtl = t.mtl;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        let w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
        let w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
        let w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        // perspective-correct weights
        const iz = w0 / A[2] + w1 / B[2] + w2 / C[2];
        const z = 1 / iz;
        const i = y * W + x;
        if (z >= zb[i]) continue;
        zb[i] = z;
        cov[i] = 1;
        w0 = (w0 / A[2]) * z; w1 = (w1 / B[2]) * z; w2 = (w2 / C[2]) * z;
        let rgb;
        if (mtl.emit) rgb = mtl.emit;
        else {
          let n = norm([
            t.n[0][0] * w0 + t.n[1][0] * w1 + t.n[2][0] * w2,
            t.n[0][1] * w0 + t.n[1][1] * w1 + t.n[2][1] * w2,
            t.n[0][2] * w0 + t.n[1][2] * w1 + t.n[2][2] * w2,
          ]);
          const P = [a[0] * w0 + b[0] * w1 + c[0] * w2, a[1] * w0 + b[1] * w1 + c[1] * w2, z];
          const V = norm([-P[0], -P[1], -P[2]]);
          if (dot(n, V) < 0) n = [-n[0], -n[1], -n[2]];
          const grit = 1 + (hash(x >> 1, y >> 1) - 0.5) * mtl.rough * 2;
          let base = mtl.c;
          if (mtl.grain) {
            const gv = Math.sin(P[2] * 900 + Math.sin(P[0] * 400) * 2) * 0.12;
            base = base.map((v) => v * (1 + gv));
          }
          let dr = 0.16, sp = 0;
          for (const L of LIGHTS) {
            const nd = dot(n, L.d);
            if (nd > 0) dr += nd * L.c;
            const R = sub([2 * nd * n[0], 2 * nd * n[1], 2 * nd * n[2]], L.d);
            const rv = dot(R, V);
            if (rv > 0 && nd > 0) sp += Math.pow(rv, mtl.shin) * mtl.spec * L.c;
          }
          const rim = Math.pow(1 - Math.max(0, dot(n, V)), 3) * 0.35;
          rgb = base.map((v) => v * (dr * grit) + 255 * sp * 0.85 + 90 * rim);
        }
        col[i * 3] = rgb[0]; col[i * 3 + 1] = rgb[1]; col[i * 3 + 2] = rgb[2];
      }
  }

  // Downsample 2x2 -> 1 with coverage-weighted alpha.
  const out = new ImageData(w, h);
  const d = out.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const i = (y * SS + sy) * W + x * SS + sx;
          if (!cov[i]) continue;
          r += col[i * 3]; g += col[i * 3 + 1]; b += col[i * 3 + 2]; n++;
        }
      const o = (y * w + x) * 4;
      if (n < 2) continue;
      d[o] = Math.min(255, r / n); d[o + 1] = Math.min(255, g / n); d[o + 2] = Math.min(255, b / n); d[o + 3] = 255;
    }
  return out;
}

// Posterize and outline an ImageData in place; returns a canvas.
export function toPixelCanvas(img, { levels = 12, outline = [8, 8, 10] } = {}) {
  const { width: w, height: h, data: p } = img;
  const q = 255 / levels;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    p[i] = Math.round(p[i] / q) * q; p[i + 1] = Math.round(p[i + 1] / q) * q; p[i + 2] = Math.round(p[i + 2] / q) * q;
  }
  const src = new Uint8ClampedArray(p);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3]) continue;
      if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) { p[i] = outline[0]; p[i + 1] = outline[1]; p[i + 2] = outline[2]; p[i + 3] = 255; }
    }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

export { norm, cross, sub, dot };
