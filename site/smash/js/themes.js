// Environment themes: sky, light rig, fog, env map, ground, layered backdrop, props and ambient animation.
// All themes are built during the splash (textures in a Web Worker, geometry merged into a few draw calls
// per theme with vertex colours), so switching themes later is only visibility + uniform changes.
import * as THREE from 'three';
import { generate } from './texgen.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const C = (h) => new THREE.Color(h);
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- textures (worker with main-thread fallback)
class TexFactory {
  constructor() {
    this.pending = new Map(); this.id = 0; this.cache = new Map();
    try {
      this.worker = new Worker(new URL('./texworker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => { const p = this.pending.get(e.data.id); if (p) { this.pending.delete(e.data.id); p.resolve(e.data); } };
      this.worker.onerror = () => { this.worker = null; for (const [, p] of this.pending) p.resolve(generate(p.name, p.w, p.h)); this.pending.clear(); };
    } catch (e) { this.worker = null; }
  }
  raw(name, w, h) {
    if (!this.worker) return Promise.resolve(generate(name, w, h));
    return new Promise((resolve) => { const id = ++this.id; this.pending.set(id, { resolve, name, w, h }); this.worker.postMessage({ id, name, w, h }); });
  }
  get(name, size = 256) {
    const key = name + size;
    if (!this.cache.has(key)) {
      this.cache.set(key, this.raw(name, size, size).then((r) => {
        const tex = (data, srgb) => {
          const t = new THREE.DataTexture(data, r.w, r.h, THREE.RGBAFormat);
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
          t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
          return t;
        };
        return { map: tex(r.col, true), normalMap: tex(r.nor, false), roughnessMap: tex(r.rough, false) };
      }));
    }
    return this.cache.get(key);
  }
  dispose() { if (this.worker) this.worker.terminate(); }
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- batch: many props -> one draw call
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
class Batch {
  constructor() { this.parts = []; }
  add(geo, x, y, z, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    g.applyMatrix4(_m);
    const n = g.attributes.position.count, col = new Float32Array(n * 3), c = color.isColor ? color : C(color);
    const k = o.k ?? 1;
    for (let i = 0; i < n; i++) { col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (o.sway) {
      const sw = new Float32Array(n), pa = g.attributes.position.array, base = o.baseY ?? y, hgt = o.height || 1;
      for (let i = 0; i < n; i++) { const t = clamp((pa[i * 3 + 1] - base) / hgt, 0, 1); sw[i] = o.sway * t * t; }
      g.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
    }
    this.parts.push(g);
    if (geo !== g && !geo.keep) { /* source geometry is a temp unless flagged */ }
    return this;
  }
  box(w, h, d, x, y, z, color, o) { return this.add(G_BOX, x, y, z, color, { ...o, sx: w * (o?.sx ?? 1), sy: h * (o?.sy ?? 1), sz: d * (o?.sz ?? 1) }); }
  build(mat, { shadow = false, receive = true, uv = false, order = 0 } = {}) {
    let n = 0;
    for (const g of this.parts) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Cc = new Float32Array(n * 3);
    const U = uv ? new Float32Array(n * 2) : null, S = this.parts.some((g) => g.attributes.aSway) ? new Float32Array(n) : null;
    let o = 0;
    for (const g of this.parts) {
      const c = g.attributes.position.count;
      P.set(g.attributes.position.array, o * 3);
      if (!g.attributes.normal) g.computeVertexNormals();
      N.set(g.attributes.normal.array, o * 3);
      Cc.set(g.attributes.color.array, o * 3);
      if (U && g.attributes.uv) U.set(g.attributes.uv.array, o * 2);
      if (S && g.attributes.aSway) S.set(g.attributes.aSway.array, o);
      o += c;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    if (U) geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    if (S) geo.setAttribute('aSway', new THREE.BufferAttribute(S, 1));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow; m.receiveShadow = receive; m.renderOrder = order;
    this.parts = [];
    return m;
  }
}
const G_BOX = new THREE.BoxGeometry(1, 1, 1);
const G_CYL = (n = 8) => new THREE.CylinderGeometry(1, 1, 1, n);
const G_CONE = (n = 7) => new THREE.ConeGeometry(1, 1, n);
const G_ICO = new THREE.IcosahedronGeometry(1, 1);
const G_SPH = new THREE.SphereGeometry(1, 12, 8);
// triangular prism (roof): base w along x, height rh, depth d along z, base at y=0
function prism(w, rh, d) {
  const a = [-w / 2, 0], b = [w / 2, 0], c = [0, rh], z0 = -d / 2, z1 = d / 2, P = [];
  const tri = (p, q, r) => P.push(...p, ...q, ...r);
  tri([...a, z1], [...b, z1], [...c, z1]); tri([...a, z0], [...c, z0], [...b, z0]);
  const quad = (p, q, zA, zB) => { tri([...p, zA], [...q, zA], [...q, zB]); tri([...p, zA], [...q, zB], [...p, zB]); };
  quad(b, a, z1, z0); quad(c, b, z1, z0); quad(a, c, z1, z0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}
// silhouette ridge strip (far hills, mesas, mountains, islands) with per-vertex colour (top/bottom)
function ridge(B, { z, x0 = -140, x1 = 140, n = 120, base = 0, f, top, bottom, k = 1, snow = null }) {
  const P = [], Cc = [];
  const ct = C(top), cb = C(bottom ?? top), cs = snow ? C(snow) : null;
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
    const ya = base + f(xa), yb = base + f(xb), bot = -2;
    P.push(xa, bot, z, xb, bot, z, xb, yb, z, xa, bot, z, xb, yb, z, xa, ya, z);
    const col = (y) => { const c = cb.clone().lerp(ct, clamp((y - bot) / (Math.max(ya, yb) - bot + 0.01), 0, 1)); if (cs && y > base + snow.line) c.lerp(cs, 0.85); return c; };
    for (const y of [bot, bot, yb, bot, yb, ya]) { const c = col(y); Cc.push(c.r * k, c.g * k, c.b * k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(P.length).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  B.parts.push(g);
}
const noise1 = (x, s) => Math.sin(x * 0.11 + s) * 0.5 + Math.sin(x * 0.27 + s * 2.1) * 0.3 + Math.sin(x * 0.63 + s * 3.7) * 0.2;

// ---------------------------------------------------------------- shared theme materials (few shader programs)
function makeKit(uTime) {
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const vcGloss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.2 });
  const vcMetal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.8 });
  const sway = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  sway.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'attribute float aSway;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = position.x * 0.35 + position.z * 0.21;
      transformed.x += sin(uTime * 1.6 + ph) * aSway * 0.09 + sin(uTime * 3.7 + ph * 2.0) * aSway * 0.02;
      transformed.z += cos(uTime * 1.2 + ph) * aSway * 0.05;`);
  };
  sway.customProgramCacheKey = () => 'sway';
  const flat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  const sea = new THREE.MeshStandardMaterial({ color: 0x1b5f86, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.4 });
  sea.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\nuniform float uTime;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec2 p = vWP.xz; float t = uTime;
        float dx = sin(p.x * 0.9 + t * 1.3) * 0.12 + sin(p.x * 2.3 - p.y * 1.1 + t * 2.1) * 0.06 + sin(p.x * 6.1 + p.y * 3.3 + t * 3.7) * 0.025;
        float dz = cos(p.y * 0.7 + t * 1.1) * 0.12 + sin(p.y * 2.7 + p.x * 0.9 + t * 1.7) * 0.06 + cos(p.y * 7.3 - p.x * 2.1 + t * 4.1) * 0.025;
        normal = normalize((viewMatrix * vec4(normalize(vec3(dx, 1.0, dz)), 0.0)).xyz); }`);
  };
  sea.customProgramCacheKey = () => 'sea';
  const shaftTex = canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sg = g.createLinearGradient(0, 0, w, 0);
    sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(0.25, 'rgba(0,0,0,0)'); sg.addColorStop(0.75, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = sg; g.fillRect(0, 0, w, h);
  }, false);
  const shaft = new THREE.MeshBasicMaterial({ map: shaftTex, color: 0xffe6c0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const windowTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#0c0c16'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const r = Math.random();
      g.fillStyle = r < 0.45 ? '#141826' : r < 0.75 ? '#ffd28a' : r < 0.9 ? '#9fd4ff' : '#ff9fe0';
      g.globalAlpha = r < 0.45 ? 1 : 0.6 + Math.random() * 0.4;
      g.fillRect(x * 8 + 2, y * 8 + 2, 4, 5);
    }
  });
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  windowTex.anisotropy = 4;
  const windows = new THREE.MeshBasicMaterial({ map: windowTex, vertexColors: true, fog: true });
  const bird = new THREE.MeshBasicMaterial({ color: 0x1d1d26, side: THREE.DoubleSide, fog: true });
  const neon = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  return { vc, vcGloss, vcMetal, sway, flat, sea, shaft, windows, bird, neon };
}

// ---------------------------------------------------------------- reusable props
function pine(B, x, z, s, col = 0x2f6b3f, snow = false) {
  B.add(G_CYL(6), x, 0.35 * s, z, 0x5a3d28, { sx: 0.12 * s, sy: 0.7 * s, sz: 0.12 * s, sway: 0.1, baseY: 0, height: 4 * s });
  for (let i = 0; i < 3; i++) {
    const y = (0.9 + i * 0.75) * s, r = (1.1 - i * 0.28) * s, h = 1.3 * s;
    B.add(G_CONE(8), x, y + h / 2, z, col, { sx: r, sy: h, sz: r, ry: rnd(0, 3), sway: 1, baseY: 0, height: 4 * s });
    if (snow) B.add(G_CONE(8), x, y + h * 0.72, z, 0xf4f8ff, { sx: r * 0.55, sy: h * 0.45, sz: r * 0.55, sway: 1, baseY: 0, height: 4 * s });
  }
}
function roundTree(B, x, z, s, col = 0x4f8f3a) {
  B.add(G_CYL(7), x, 0.9 * s, z, 0x6b4a32, { sx: 0.16 * s, sy: 1.8 * s, sz: 0.16 * s, sway: 0.15, baseY: 0, height: 3.5 * s });
  for (let i = 0; i < 6; i++) {
    const c = C(col).offsetHSL(rnd(-0.02, 0.02), 0, rnd(-0.06, 0.06));
    B.add(G_ICO, x + rnd(-0.6, 0.6) * s, (2.2 + rnd(-0.2, 0.7)) * s, z + rnd(-0.5, 0.5) * s, c, { sx: rnd(0.6, 0.95) * s, sy: rnd(0.55, 0.85) * s, sz: rnd(0.6, 0.95) * s, sway: 1, baseY: 0, height: 3.5 * s });
  }
}
function palm(B, x, z, s, lean = 0.25) {
  let px = x, py = 0;
  const segs = 7, dir = Math.sign(lean) || 1;
  for (let i = 0; i < segs; i++) {
    const t = i / segs, nx = x + dir * Math.abs(lean) * 3 * s * (t + 1 / segs) ** 2, ny = (i + 1) * 0.65 * s;
    B.add(G_CYL(6), (px + nx) / 2, (py + ny) / 2, z, i % 2 ? 0x7a5a3a : 0x8a6a46, { sx: 0.13 * s * (1 - t * 0.3), sy: 0.68 * s, sz: 0.13 * s * (1 - t * 0.3), rz: -Math.atan2(nx - px, ny - py), sway: 1, baseY: 0, height: segs * 0.65 * s });
    px = nx; py = ny;
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.283 + rnd(-0.2, 0.2), len = rnd(1.6, 2.2) * s;
    B.add(G_BOX, px + Math.cos(a) * len * 0.45, py - 0.15 * s, z + Math.sin(a) * len * 0.45, i % 2 ? 0x3f8a3a : 0x2f7a35, { sx: len, sy: 0.04 * s, sz: 0.38 * s, ry: -a, rz: -0.32, sway: 1.4, baseY: 0, height: segs * 0.65 * s });
  }
  B.add(G_SPH, px, py, z, 0x6a4a2a, { sx: 0.22 * s, sy: 0.18 * s, sz: 0.22 * s, sway: 1, baseY: 0, height: segs * 0.65 * s });
}
function house(B, x, z, w, h, d, wall, roof, trim, glass = 0x2a3c55, lit = 0) {
  B.box(w, h, d, x, h / 2, z, wall);
  B.add(prism(w + 0.5, h * 0.45, d + 0.5), x, h, z, roof);
  B.box(0.5, 1.2, 0.5, x + w * 0.28, h + h * 0.3, z - d * 0.1, 0x8a5a4a);
  const rows = h > 4 ? 2 : 1;
  for (let r = 0; r < rows; r++) for (let i = 0; i < 3; i++) {
    const wx = x - w / 3 + (i * w) / 3, wy = 1.3 + r * 2.4;
    if (r === 0 && i === 1) { B.box(1.0, 2.0, 0.08, wx, 1.0, z + d / 2 + 0.04, 0x8a4b2f); B.box(1.2, 2.15, 0.05, wx, 1.05, z + d / 2 + 0.02, trim); continue; }
    B.box(1.15, 1.35, 0.06, wx, wy, z + d / 2 + 0.03, trim);
    B.box(0.95, 1.15, 0.08, wx, wy, z + d / 2 + 0.05, glass, { k: lit ? lit : 1 });
    B.box(0.06, 1.15, 0.1, wx, wy, z + d / 2 + 0.07, trim);
  }
}
function car(B, x, z, col, ry = 0, rust = false) {
  const c = rust ? C(col).lerp(C(0x7a3a1a), 0.6) : col;
  B.box(2.0, 0.55, 0.95, x, 0.55, z, c, { ry });
  B.box(1.1, 0.45, 0.85, x - 0.1 * Math.cos(ry), 1.02, z + 0.1 * Math.sin(ry), c, { ry });
  for (const [ox, oz] of [[-0.65, 0.48], [0.65, 0.48], [-0.65, -0.48], [0.65, -0.48]]) {
    const rx = ox * Math.cos(ry) + oz * Math.sin(ry), rz = -ox * Math.sin(ry) + oz * Math.cos(ry);
    B.add(G_CYL(10), x + rx, 0.3, z + rz, 0x1a1a1a, { sx: 0.3, sy: 0.18, sz: 0.3, rx: Math.PI / 2, ry });
  }
}

// ---------------------------------------------------------------- birds (instanced, flapping)
function makeBirds(group, mat, n, { cx = 0, cy = 9, cz = -25, r = 12, spread = 6, speed = 0.25, size = 0.35 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, -0.6, 0.12, 0, 0, 0, -0.12, 0, 0, 0.12, 0.6, 0.12, 0, 0, 0, -0.12], 3));
  g.computeVertexNormals();
  const im = new THREE.InstancedMesh(g, mat, n);
  im.frustumCulled = false;
  group.add(im);
  const B = [];
  for (let i = 0; i < n; i++) B.push({ a: rnd(0, 6.28), r: r + rnd(-spread, spread), y: cy + rnd(-2, 2), sp: speed * rnd(0.7, 1.3), ph: rnd(0, 6), s: size * rnd(0.8, 1.2) });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return (t, dt) => {
    for (let i = 0; i < n; i++) {
      const b = B[i];
      b.a += b.sp * dt * (i % 3 ? 1 : -1) * 0.4;
      p.set(cx + Math.cos(b.a) * b.r, b.y + Math.sin(t * 0.5 + b.ph) * 0.6, cz + Math.sin(b.a) * b.r * 0.5);
      q.setFromAxisAngle(UP, -b.a + (i % 3 ? 0 : Math.PI));
      const f = Math.sin(t * 9 + b.ph);
      s.set(b.s, b.s * (0.3 + f * 0.9), b.s);
      im.setMatrixAt(i, m.compose(p, q, s));
    }
    im.instanceMatrix.needsUpdate = true;
  };
}

// ---------------------------------------------------------------- theme definitions
// sky: top/hor/low colours, sun dir+colour, glow size, clouds (+tint), stars; light: key/hemi/rim; post: exposure/bloom
export const THEMES = {
  backyard: {
    label: 'Sunny backyard',
    ui: { glass: 'rgba(22,52,92,.36)', a1: '#ffc23d', a2: '#ff6a3d', bg: '#8cc4ee' },
    sky: { top: 0x2a7fe6, hor: 0xd6e9f6, low: 0x9fbf8a, sun: [0.45, 0.7, 0.55], sunCol: 0xfff0d6, glow: 1, clouds: 1, cloudTint: 0xffffff, stars: 0 },
    fog: [0xcfe2ef, 30, 130],
    light: { key: 0xfff0dc, keyI: 3.1, keyDir: [0.45, 0.7, 0.55], hemiS: 0xbcd8ff, hemiG: 0x7f9a5a, hemiI: 0.5, rim: 0xcfe0ff, rimI: 0.6, env: 0.6, expo: 0.9, bloom: 0.45, thr: 1.2 },
    env: [[0xffffff, 2, [-6, 3, 5]], [0x9ccc7a, 0.6, [0, -6, 0]]],
    textures: ['grass', 'patio'],
  },
  canyon: {
    label: 'Golden-hour canyon scrapyard',
    ui: { glass: 'rgba(80,30,18,.42)', a1: '#ffd36b', a2: '#ff5a2a', bg: '#f0a070' },
    sky: { top: 0x3a5fa8, hor: 0xffa060, low: 0xc06a3e, sun: [0.8, 0.12, -0.55], sunCol: 0xffb060, glow: 1.8, clouds: 0.7, cloudTint: 0xffb59a, stars: 0 },
    fog: [0xe9a271, 22, 115],
    light: { key: 0xffb46a, keyI: 3.4, keyDir: [0.82, 0.32, 0.45], hemiS: 0xffb98a, hemiG: 0x5a3a28, hemiI: 0.45, rim: 0xff7a4a, rimI: 1.0, env: 0.6, expo: 0.92, bloom: 0.6, thr: 1.1 },
    env: [[0xffc48a, 2.2, [7, 1.5, -3]], [0x6a86c8, 0.8, [-6, 4, 4]]],
    textures: ['sand', 'cracked', 'rock'],
  },
  neon: {
    label: 'Neon rooftop at night',
    ui: { glass: 'rgba(30,10,60,.5)', a1: '#5ef0ff', a2: '#ff3cac', bg: '#1a1238' },
    sky: { top: 0x03041a, hor: 0x2a1652, low: 0x140a26, sun: [-0.35, 0.55, -0.75], sunCol: 0xc8d8ff, glow: 0.35, clouds: 0, cloudTint: 0x404060, stars: 1 },
    fog: [0x1d1240, 18, 95],
    light: { key: 0xa8b8ff, keyI: 1.5, keyDir: [-0.35, 0.8, 0.45], hemiS: 0x5a3aa0, hemiG: 0x10101a, hemiI: 0.55, rim: 0xff3cac, rimI: 1.6, env: 1.1, expo: 1.05, bloom: 1.05, thr: 0.85 },
    env: [[0xff3cac, 3, [-5, 2, 4]], [0x3cf0ff, 3, [6, 2, 3]], [0x8a5cff, 1.2, [0, 3, -8]]],
    textures: ['wetroof'],
  },
  snow: {
    label: 'Snowy mountain cabin',
    ui: { glass: 'rgba(30,60,100,.38)', a1: '#bfe8ff', a2: '#ff6a3d', bg: '#cfdff0' },
    sky: { top: 0x5f93d0, hor: 0xe7eef6, low: 0xdfe6ee, sun: [0.4, 0.5, 0.6], sunCol: 0xfff4ea, glow: 0.9, clouds: 1, cloudTint: 0xf0f4ff, stars: 0 },
    fog: [0xe2e9f2, 16, 88],
    light: { key: 0xfff4ea, keyI: 2.7, keyDir: [0.4, 0.55, 0.6], hemiS: 0xcfe0ff, hemiG: 0xdfe6ef, hemiI: 0.6, rim: 0xbcd4ff, rimI: 0.7, env: 0.65, expo: 0.82, bloom: 0.5, thr: 1.2 },
    env: [[0xffffff, 2.2, [-6, 3, 5]], [0xeef4ff, 1.2, [0, -6, 0]]],
    textures: ['snow', 'deck'],
  },
  warehouse: {
    label: 'Industrial warehouse',
    ui: { glass: 'rgba(30,34,40,.5)', a1: '#ffd23d', a2: '#ff8a2a', bg: '#6a7078' },
    sky: { top: 0x8a9098, hor: 0x8a9098, low: 0x6a6e74, sun: [-0.3, 0.9, -0.3], sunCol: 0xffffff, glow: 0, clouds: 0, cloudTint: 0xffffff, stars: 0, hidden: true },
    fog: [0x7a7f87, 12, 48],
    light: { key: 0xfff2dc, keyI: 2.6, keyDir: [-0.35, 0.88, 0.32], hemiS: 0xa4adb8, hemiG: 0x55504a, hemiI: 0.75, rim: 0x9fc0ff, rimI: 0.45, env: 0.7, expo: 0.95, bloom: 0.75, thr: 1.0 },
    env: [[0xfff4e0, 4, [-2, 6, -1]], [0xfff4e0, 3, [3, 6, 2]], [0x707680, 0.6, [0, 0, -8]]],
    textures: ['floor', 'corrugated'],
  },
  beach: {
    label: 'Tropical beach at sunset',
    ui: { glass: 'rgba(70,30,70,.4)', a1: '#ffd36b', a2: '#ff4f6a', bg: '#f39a7a' },
    sky: { top: 0x2b3a7c, hor: 0xff9455, low: 0xff7a50, sun: [0.18, 0.06, -0.98], sunCol: 0xffa050, glow: 2.4, clouds: 0.8, cloudTint: 0xff9ac0, stars: 0.15 },
    fog: [0xf3a07c, 30, 140],
    light: { key: 0xffa66a, keyI: 2.8, keyDir: [0.55, 0.36, -0.6], hemiS: 0xffb08a, hemiG: 0x7a5a6a, hemiI: 0.75, rim: 0xb090ff, rimI: 0.6, env: 0.7, expo: 0.95, bloom: 0.85, thr: 1.0 },
    env: [[0xffb070, 1.5, [-6, 3, 5]], [0x7f6ac8, 0.8, [6, 4, 4]]],
    textures: ['sand', 'deck'],
  },
};
// which themes suit which scene (kitchen -> backyard, electronics -> scrapyard / industrial, ...)
export const SCENE_THEMES = {
  wall: ['backyard', 'canyon', 'neon', 'beach', 'snow'],
  greenhouse: ['backyard', 'snow', 'beach'],
  crates: ['warehouse', 'canyon', 'snow', 'beach'],
  shelf: ['warehouse', 'backyard', 'neon'],
  junk: ['canyon', 'warehouse'],
  kitchen: ['backyard'],
  electronics: ['canyon', 'warehouse', 'neon'],
  glassrack: ['neon', 'warehouse', 'backyard'],
  fair: ['beach', 'backyard', 'neon', 'canyon'],
};

// ---------------------------------------------------------------- builders
function ground(kit, tex, rep, w, h, x, z, y = 0, tint = 0xffffff, rough = 1) {
  const mat = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap, roughness: rough, color: tint });
  mat.map = tex.map.clone(); mat.normalMap = tex.normalMap.clone(); mat.roughnessMap = tex.roughnessMap.clone();
  for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) { t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

const BUILD = {
  backyard(T, kit, tex) {
    const g = T.group;
    g.add(ground(kit, tex.grass, [60, 60], 300, 300, 0, 0, 0, 0xd0e6b8));
    g.add(ground(kit, tex.patio, [5, 5.7], 7, 8, 0, 0.6, 0.004, 0xffffff));
    const B = new Batch(), S = new Batch(), F = new Batch();
    // stone edging around the patio
    for (let x = -3.5; x <= 3.5; x += 0.5) B.box(0.48, 0.1, 0.22, x, 0.05, -3.45, 0xb8b0a2);
    // picket fence
    for (let x = -14; x <= 14; x += 0.2) { B.box(0.1, 1.0, 0.035, x, 0.5, -5.2, 0xf4f1ea); B.add(G_CONE(4), x, 1.06, -5.2, 0xf4f1ea, { sx: 0.07, sy: 0.12, sz: 0.03, ry: Math.PI / 4 }); }
    B.box(28, 0.07, 0.04, 0, 0.3, -5.24, 0xe8e4dc); B.box(28, 0.07, 0.04, 0, 0.78, -5.24, 0xe8e4dc);
    // houses
    house(B, -8, -17, 6, 4.8, 5, 0xf1d9a8, 0x7a4a3a, 0xffffff);
    house(B, 1.5, -21, 7, 5.2, 5, 0xbfd6e8, 0x4a5568, 0xffffff);
    house(B, 10, -18, 6, 4.4, 5, 0xf3b9a8, 0x6a3a32, 0xfff8f0);
    B.box(2.4, 2.0, 2.0, -3.6, 1.0, -8.0, 0x9a6a4a); B.add(prism(2.7, 0.8, 2.3), -3.6, 2.0, -8.0, 0x5a3a2a); // shed
    B.box(0.12, 1.1, 0.12, 2.9, 0.55, -4.6, 0x6a6a6a); B.box(0.45, 0.3, 0.6, 2.9, 1.2, -4.6, 0xd8392f); // mailbox
    // garden: hedges, flowers
    for (let x = -13; x <= 13; x += 0.9) S.add(G_ICO, x + rnd(-0.2, 0.2), 0.45, -5.6 + rnd(-0.1, 0.1), C(0x3f7f3a).offsetHSL(0, 0, rnd(-0.05, 0.05)), { sx: 0.6, sy: 0.5, sz: 0.45, sway: 0.25, baseY: 0, height: 1 });
    for (let i = 0; i < 80; i++) B.add(G_SPH, rnd(-11, 11), 0.95 + rnd(-0.1, 0.25), -5.55 + rnd(-0.3, 0.2), [0xff6a8a, 0xffd23d, 0xffffff, 0xb070ff][i % 4], { sx: 0.07, sy: 0.07, sz: 0.07 });
    roundTree(S, -5.2, -10, 1.3); roundTree(S, 5.6, -11, 1.45, 0x5a9a3a); roundTree(S, 13, -16, 1.5); roundTree(S, -13, -17, 1.4, 0x5a9a3a);
    for (let i = 0; i < 14; i++) roundTree(S, rnd(-30, 30), rnd(-26, -40), rnd(1.2, 2), 0x4f8a45);
    ridge(F, { z: -90, base: 4, f: (x) => 9 * noise1(x, 1) + 4, top: 0x9fc0c8, bottom: 0xaac7cc });
    ridge(F, { z: -65, base: 1, f: (x) => 6 * noise1(x, 4) + 3, top: 0x86b294, bottom: 0x93b9a0 });
    g.add(B.build(kit.vc, { shadow: true }), S.build(kit.sway), F.build(kit.flat, { receive: false, order: -5 }));
    T.tick = makeBirds(g, kit.bird, 8, { cy: 11, cz: -30, r: 14 });
  },
  canyon(T, kit, tex) {
    const g = T.group;
    g.add(ground(kit, tex.sand, [50, 50], 300, 300, 0, 0, 0, 0xffe0c0));
    g.add(ground(kit, tex.cracked, [4, 4.6], 7, 8, 0, 0.6, 0.004, 0xffe4cc));
    const B = new Batch(), S = new Batch(), F = new Batch();
    // scrap piles: rusty cars, tyres, drums
    car(B, -4.5, -6.5, 0x3a6aa0, 0.3, true); car(B, 4.8, -7.5, 0xb04030, -0.5, true); car(B, -1.5, -9.5, 0x7a8a40, 1.2, true);
    car(B, 4.6, -7.4, 0x6a5040, -0.3, true); // stacked
    for (let i = 0; i < 12; i++) B.add(new THREE.TorusGeometry(0.32, 0.12, 6, 12), rnd(-6, 6), 0.12 + (i % 3) * 0.24, -5 - rnd(0, 4), 0x1d1b1a, { rx: Math.PI / 2 });
    for (let i = 0; i < 6; i++) B.add(G_CYL(10), rnd(-6, 6), 0.45, -4.6 - rnd(0, 3), C(0x8a4a24).offsetHSL(0, 0, rnd(-0.1, 0.05)), { sx: 0.3, sy: 0.9, sz: 0.3, rz: i % 3 ? 0 : Math.PI / 2 });
    // windpump
    for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) B.box(0.08, 7, 0.08, 7.5 + ox * 0.6, 3.5, -12 + oz * 0.6, 0x5a4a3a, { rz: ox * -0.08, rx: oz * 0.08 });
    B.box(0.6, 0.1, 0.6, 7.5, 7, -12, 0x5a4a3a);
    // telephone poles with wires
    for (let i = 0; i < 5; i++) { const x = -14 + i * 7; B.box(0.18, 7, 0.18, x, 3.5, -16, 0x4a3828); B.box(1.6, 0.12, 0.12, x, 6.6, -16, 0x4a3828); }
    B.box(30, 0.02, 0.02, 0, 6.3, -16, 0x222222); B.box(30, 0.02, 0.02, 0, 6.45, -16.05, 0x222222);
    // cacti
    for (let i = 0; i < 9; i++) {
      const x = (i % 2 ? 1 : -1) * rnd(5, 16), z = -rnd(6, 22), h = rnd(1.6, 3.2), c = C(0x4f7a3a).offsetHSL(0, 0, rnd(-0.05, 0.05));
      S.add(G_CYL(8), x, h / 2, z, c, { sx: 0.25, sy: h, sz: 0.25, sway: 0.05, baseY: 0, height: h });
      S.add(G_SPH, x, h, z, c, { sx: 0.25, sy: 0.25, sz: 0.25 });
      S.add(G_CYL(8), x + 0.45, h * 0.55, z, c, { sx: 0.16, sy: h * 0.4, sz: 0.16 }); S.add(G_BOX, x + 0.25, h * 0.35, z, c, { sx: 0.45, sy: 0.25, sz: 0.25 });
    }
    // near rock formations (lit) and far mesas (silhouettes)
    const R = new Batch();
    for (let i = 0; i < 7; i++) { const x = (i % 2 ? 1 : -1) * rnd(7, 18), z = -rnd(14, 30), s = rnd(2, 4.5); R.add(G_ICO, x, s * 0.5, z, C(0xb8643a).offsetHSL(0, 0, rnd(-0.06, 0.04)), { sx: s * 1.3, sy: s, sz: s, ry: rnd(0, 3) }); }
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const mesa = (x) => { const v = noise1(x, 3); return v > 0.15 ? 14 + noise1(x * 0.3, 8) * 3 : v > -0.1 ? 6 + v * 20 : 2; };
    ridge(F, { z: -95, base: 0, f: (x) => mesa(x) * 1.2, top: 0xc8705a, bottom: 0xe0905a, n: 220 });
    ridge(F, { z: -60, base: 0, f: (x) => mesa(x + 40) * 0.8, top: 0xa04a2a, bottom: 0xc8683a, n: 200 });
    ridge(F, { z: -38, base: 0, f: (x) => Math.max(0, mesa(x - 30) * 0.45 - 1), top: 0x8a3a20, bottom: 0xb05a30, n: 180 });
    g.add(B.build(kit.vc, { shadow: true }), S.build(kit.sway), R.build(rockMat), F.build(kit.flat, { receive: false, order: -5 }));
    // spinning windpump fan
    const fan = new Batch();
    for (let i = 0; i < 12; i++) fan.box(0.08, 1.1, 0.02, Math.cos((i / 12) * 6.283) * 0.55, Math.sin((i / 12) * 6.283) * 0.55, 0, 0xd8d0c0, { rz: (i / 12) * 6.283 + Math.PI / 2 });
    const fanM = fan.build(kit.vcMetal);
    fanM.position.set(7.5, 7.3, -11.6);
    g.add(fanM);
    const birds = makeBirds(g, kit.bird, 5, { cy: 13, cz: -28, r: 9, size: 0.6, speed: 0.15 });
    T.tick = (t, dt) => { fanM.rotation.z -= dt * 1.4; birds(t, dt); if (Math.random() < dt * 25) T.motes(rnd(-4, 4), rnd(0.2, 3), rnd(-3, 3), 0.9, 0.7, 0.5); };
  },
  neon(T, kit, tex) {
    const g = T.group;
    g.add(ground(kit, tex.wetroof, [40, 40], 120, 120, 0, 0, 0, 0xb8b4c8, 1));
    const B = new Batch(), N = new Batch(), F = new Batch(), W = new Batch();
    // painted helipad marks
    for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.283; B.box(0.42, 0.006, 0.12, Math.cos(a) * 3.0, 0.004, 0.6 + Math.sin(a) * 3.0, 0xd8c040, { ry: -a + Math.PI / 2 }); }
    // parapet + railing
    B.box(30, 0.9, 0.3, 0, 0.45, -4.0, 0x3a3644); B.box(30, 0.08, 0.36, 0, 0.92, -4.0, 0x55506a);
    for (let x = -14; x <= 14; x += 1.2) B.box(0.05, 0.8, 0.05, x, 1.3, -4.0, 0x6a6a7a);
    B.box(30, 0.05, 0.05, 0, 1.7, -4.0, 0x7a7a8a);
    // AC units, vents, water tower, antenna
    for (const [x, z] of [[-4.6, -2.4], [-4.6, -1.0], [4.4, -2.6]]) { B.box(1.1, 0.8, 0.8, x, 0.4, z, 0x8a8e98); B.add(G_CYL(16), x, 0.81, z, 0x2a2c34, { sx: 0.32, sy: 0.04, sz: 0.32 }); }
    for (const [x, z] of [[3.6, -3.4], [-3.4, -3.5]]) B.add(G_CYL(10), x, 0.5, z, 0x6a6e78, { sx: 0.18, sy: 1, sz: 0.18 });
    for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) B.box(0.1, 3, 0.1, -6.5 + ox, 1.5, -6.5 + oz, 0x4a4a52);
    B.add(G_CYL(14), -6.5, 4.2, -6.5, 0x6a4a3a, { sx: 1.3, sy: 2.4, sz: 1.3 }); B.add(G_CONE(14), -6.5, 5.8, -6.5, 0x4a3a32, { sx: 1.4, sy: 0.8, sz: 1.4 });
    B.box(0.12, 8, 0.12, 6.8, 4, -7, 0x8a8a96); B.box(1.4, 0.05, 0.05, 6.8, 6.5, -7, 0x8a8a96);
    // neon signs (HDR vertex colours -> bloom)
    const sign = (txtFn, x, y, z, s, col) => txtFn(N, x, y, z, s, col);
    const bar = (Bt, x, y, z, w, h, col, k = 3) => Bt.box(w, h, 0.04, x, y, z, col, { k });
    // "OPEN" style sign made of bars + a heart + arrows
    const neonA = 0xff3cac, neonB = 0x3cf0ff, neonC = 0xffd23d;
    void sign;
    B.box(4.2, 1.7, 0.12, 4.6, 2.6, -6.2, 0x15121c); // sign backing
    for (let i = 0; i < 4; i++) { bar(N, 3.2 + i * 0.95, 2.6, -6.12, 0.08, 1.0, neonA); bar(N, 3.2 + i * 0.95 + 0.35, 3.1, -6.12, 0.7, 0.08, neonA); bar(N, 3.2 + i * 0.95 + 0.35, 2.1, -6.12, 0.7, 0.08, neonA); }
    bar(N, 4.6, 3.55, -6.1, 4.0, 0.06, neonB); bar(N, 4.6, 1.65, -6.1, 4.0, 0.06, neonB);
    B.box(2.6, 1.2, 0.12, -3.6, 3.6, -9, 0x15121c);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI; bar(N, -3.6 + Math.cos(a) * 0.45 - 0.45, 3.8 + Math.sin(a) * 0.3, -8.92, 0.1, 0.1, neonA, 4); bar(N, -3.6 + Math.cos(a) * 0.45 + 0.45, 3.8 + Math.sin(a) * 0.3, -8.92, 0.1, 0.1, neonA, 4); }
    for (let i = 0; i < 10; i++) bar(N, -3.6 - 0.9 + i * 0.1, 3.75 - Math.abs(i - 4.5) * 0.16, -8.92, 0.1, 0.1, neonA, 4);
    bar(N, -3.6, 3.05, -8.9, 2.2, 0.06, neonC);
    const red = new Batch();
    red.add(G_SPH, 6.8, 8.1, -7, 0xff2020, { sx: 0.12, sy: 0.12, sz: 0.12, k: 5 });
    // skyline: buildings with lit windows (one map, uv scaled per face)
    const bld = (x, z, w, h, d, col) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const uv = geo.attributes.uv, nrm = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) { const sx = Math.abs(nrm.getX(i)) > 0.5 ? d : w; uv.setXY(i, uv.getX(i) * sx / 12, uv.getY(i) * h / 12); }
      W.add(geo, x, h / 2, z, col);
    };
    for (let i = 0; i < 14; i++) { const z = -rnd(22, 34), x = (i % 2 ? 1 : -1) * rnd(3, 22), w = rnd(4, 7); bld(x, z, w, rnd(5, 11), rnd(4, 6), C(0xb8b0d8).multiplyScalar(rnd(0.8, 1.2))); }
    for (let i = 0; i < 24; i++) { const z = -rnd(45, 75), x = rnd(-45, 45), w = rnd(5, 10); bld(x, z, w, rnd(10, 26), rnd(5, 8), C(0x8a80c0).multiplyScalar(rnd(0.6, 1))); }
    ridge(F, { z: -95, base: 0, f: (x) => (Math.floor(Math.abs(noise1(x * 3, 2)) * 6) * 6 + 8), top: 0x2a1a4a, bottom: 0x24183e, n: 260 });
    g.add(B.build(kit.vcGloss, { shadow: true }), N.build(kit.neon, { receive: false }), red.build(kit.flat), W.build(kit.windows, { receive: false, uv: true, order: -3 }), F.build(kit.flat, { receive: false, order: -5 }));
    const neonMesh = g.children[g.children.length - 4], redMesh = g.children[g.children.length - 3];
    T.tick = (t) => {
      const fl = Math.random() < 0.03 ? 0.3 : 1;
      kit.neon.color.setScalar((0.85 + Math.sin(t * 7) * 0.05) * fl);
      redMesh.visible = Math.sin(t * 3) > 0.2;
      void neonMesh;
    };
  },
  snow(T, kit, tex) {
    const g = T.group;
    g.add(ground(kit, tex.snow, [40, 40], 300, 300, 0, 0, 0, 0xffffff));
    g.add(ground(kit, tex.deck, [2, 2.4], 7, 8, 0, 0.6, 0.012, 0xd8d0c8));
    const B = new Batch(), S = new Batch(), F = new Batch(), L = new Batch();
    // deck dusted with snow edges
    for (let x = -3.5; x <= 3.5; x += 0.7) B.add(G_SPH, x, 0.02, -3.45, 0xffffff, { sx: 0.5, sy: 0.08, sz: 0.25 });
    // log cabin
    const cx = 3.4, cz = -8.5, cw = 6, ch = 3.4, cd = 4.5;
    for (let i = 0; i < 12; i++) { const y = 0.15 + i * 0.28; B.add(G_CYL(8), cx, y, cz + cd / 2, C(0x7a4e2e).offsetHSL(0, 0, rnd(-0.04, 0.04)), { sx: 0.16, sy: cw + 0.4, sz: 0.16, rz: Math.PI / 2 }); B.add(G_CYL(8), cx - cw / 2, y, cz, 0x6a4428, { sx: 0.16, sy: cd + 0.3, sz: 0.16, rx: Math.PI / 2 }); }
    B.box(cw - 0.1, ch, cd - 0.1, cx, ch / 2, cz, 0x5a3a22);
    B.add(prism(cw + 1, 1.9, cd + 1), cx, ch, cz, 0x4a3020);
    B.add(prism(cw + 1.1, 1.95, cd + 1.05), cx, ch + 0.08, cz, 0xf4f8ff, { sy: 1 });
    B.box(0.8, 2.4, 0.8, cx + 1.6, ch + 1.6, cz - 0.6, 0x7a7068);
    B.box(0.95, 0.15, 0.95, cx + 1.6, ch + 2.85, cz - 0.6, 0xf4f8ff);
    for (const wx of [cx - 1.6, cx + 1.4]) { B.box(1.1, 1.0, 0.08, wx, 1.6, cz + cd / 2 + 0.12, 0x3a2414); L.box(0.9, 0.8, 0.06, wx, 1.6, cz + cd / 2 + 0.16, 0xffb060, { k: 2.2 }); }
    B.box(1.0, 2.0, 0.08, cx - 0.1, 1.0, cz + cd / 2 + 0.12, 0x4a2a18);
    // snowman
    B.add(G_SPH, -2.6, 0.45, -4.8, 0xf8faff, { sx: 0.5, sy: 0.45, sz: 0.5 }); B.add(G_SPH, -2.6, 1.05, -4.8, 0xf8faff, { sx: 0.36, sy: 0.34, sz: 0.36 }); B.add(G_SPH, -2.6, 1.52, -4.8, 0xf8faff, { sx: 0.25, sy: 0.25, sz: 0.25 });
    B.add(G_CONE(6), -2.6, 1.52, -4.5, 0xff7a20, { sx: 0.05, sy: 0.3, sz: 0.05, rx: Math.PI / 2 });
    B.box(0.5, 0.06, 0.5, -2.6, 1.74, -4.8, 0x1a1a1a); B.box(0.32, 0.3, 0.32, -2.6, 1.9, -4.8, 0x1a1a1a);
    B.box(0.6, 0.08, 0.1, -2.6, 1.3, -4.6, 0xd8392f);
    // fence posts with snow caps
    for (let x = -12; x <= 12; x += 1.5) { B.box(0.14, 1.0, 0.14, x, 0.5, -4.4, 0x6a4a32); B.box(0.18, 0.08, 0.18, x, 1.03, -4.4, 0xf8faff); }
    B.box(24, 0.08, 0.06, 0, 0.75, -4.4, 0x6a4a32);
    for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1; pine(S, side * rnd(4.5, 22), -rnd(6, 30), rnd(0.9, 1.8), C(0x24503a).offsetHSL(0, 0, rnd(-0.03, 0.03)), true); }
    ridge(F, { z: -100, base: 0, f: (x) => 30 * Math.max(0, noise1(x * 0.6, 5)) + 6, top: 0xb8c8dc, bottom: 0xc8d4e2, snow: { line: 18, color: 0xffffff }, n: 160 });
    ridge(F, { z: -70, base: 0, f: (x) => 18 * Math.max(0, noise1(x * 0.8, 9)) + 4, top: 0x7f96b2, bottom: 0xb0c0d0, snow: { line: 12 }, n: 160 });
    ridge(F, { z: -45, base: 0, f: (x) => 6 * Math.max(0, noise1(x * 1.3, 2)) + 1.5, top: 0x4a6a62, bottom: 0x9ab0b8, n: 140 });
    g.add(B.build(kit.vc, { shadow: true }), L.build(kit.flat), S.build(kit.sway), F.build(kit.flat, { receive: false, order: -5 }));
    const chim = [cx + 1.6, ch + 3.0, cz - 0.6];
    T.tick = (t, dt) => {
      if (Math.random() < dt * 40) T.snowflake();
      if (Math.random() < dt * 4) T.smoke(chim[0] + rnd(-0.1, 0.1), chim[1], chim[2]);
    };
  },
  warehouse(T, kit, tex) {
    const g = T.group;
    g.add(ground(kit, tex.floor, [8, 8], 32, 32, 0, -4, 0, 0xffffff, 1));
    const wall = new THREE.MeshStandardMaterial({ map: tex.corrugated.map.clone(), normalMap: tex.corrugated.normalMap.clone(), roughnessMap: tex.corrugated.roughnessMap.clone(), roughness: 1, color: 0xb8c0c8 });
    for (const t of [wall.map, wall.normalMap, wall.roughnessMap]) { t.repeat.set(6, 2); t.needsUpdate = true; }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(36, 14), wall); back.position.set(0, 7, -10); back.receiveShadow = true; g.add(back);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), wall); side.position.set(s * 9, 7, 2); side.rotation.y = -s * Math.PI / 2; g.add(side); }
    const B = new Batch(), L = new Batch(), Y = new Batch();
    // safety lines on the floor
    for (const x of [-3.2, 3.2]) Y.box(0.12, 0.006, 9, x, 0.003, 0.4, 0xf2c21a);
    for (let i = -10; i < 10; i++) Y.box(0.5, 0.006, 0.16, i * 0.9, 0.003, -3.6, i % 2 ? 0x1a1a1a : 0xf2c21a, { ry: 0.6 });
    // roof, beams, skylights
    B.box(36, 0.3, 26, 0, 12, 0, 0x4a4e56);
    for (let z = -9; z <= 4; z += 3.2) { B.box(36, 0.4, 0.3, 0, 11.6, z, 0x3a3e46); }
    for (let x = -8; x <= 8; x += 4) L.box(1.8, 0.05, 9, x, 11.82, -3, 0xfff6e0, { k: 3 });
    // big roller door + pallet racks + boxes + forklift
    B.box(6, 6.5, 0.15, 0, 3.25, -9.9, 0x8a9098); for (let y = 0.2; y < 6.5; y += 0.25) B.box(5.9, 0.04, 0.02, 0, y, -9.8, 0x6a7078);
    for (const rx of [-6.6, 6.6]) for (let i = 0; i < 2; i++) {
      const x = rx + (i - 0.5) * 2.6 * Math.sign(rx);
      for (const dz of [-0.6, 0.6]) for (const dx of [-1.2, 1.2]) B.box(0.1, 6, 0.1, x + dx, 3, -8.4 + dz, 0xe86a1a);
      for (const y of [0.15, 2.0, 3.9]) { B.box(2.5, 0.12, 0.08, x, y, -7.8, 0x2a5ab0); B.box(2.5, 0.12, 0.08, x, y, -9.0, 0x2a5ab0);
        for (let k = 0; k < 3; k++) if (Math.random() < 0.85) B.box(0.7, rnd(0.6, 1.1), 1.0, x - 0.8 + k * 0.8, y + 0.5, -8.4, C(0xb8875a).offsetHSL(0, 0, rnd(-0.08, 0.05))); }
    }
    for (let i = 0; i < 4; i++) { B.box(1.2, 0.14, 1.0, -4.6, 0.07 + i * 0.15, -5.6, 0xa8845a); }
    B.box(1.1, 0.9, 1.0, 4.8, 0.85, -5.5, C(0xb8875a)); B.box(1.2, 0.14, 1.0, 4.8, 0.32, -5.5, 0xa8845a);
    // forklift
    B.box(1.2, 0.9, 2.0, 5.4, 0.75, -2.0, 0xf2c21a); B.box(1.0, 1.1, 0.9, 5.4, 1.75, -2.4, 0x2a2a2a); B.box(1.0, 0.08, 0.9, 5.4, 2.3, -2.2, 0xf2c21a);
    B.box(0.08, 2.4, 0.08, 4.95, 1.2, -0.9, 0x3a3a3a); B.box(0.08, 2.4, 0.08, 5.85, 1.2, -0.9, 0x3a3a3a); B.box(0.12, 0.05, 1.0, 5.1, 0.1, -0.4, 0x3a3a3a); B.box(0.12, 0.05, 1.0, 5.7, 0.1, -0.4, 0x3a3a3a);
    for (const [ox, oz] of [[-0.6, -0.7], [0.6, -0.7], [-0.6, 0.7], [0.6, 0.7]]) B.add(G_CYL(12), 5.4 + ox, 0.25, -2.0 + oz, 0x111111, { sx: 0.25, sy: 0.2, sz: 0.25, rz: Math.PI / 2 });
    // hanging lamps
    for (const [x, z] of [[-3, -1], [3, -1], [0, -6], [-6, -5], [6, -5]]) { B.box(0.02, 3, 0.02, x, 9.5, z, 0x222222); B.add(G_CONE(12), x, 7.9, z, 0x2a3a4a, { sx: 0.45, sy: 0.35, sz: 0.45 }); L.add(G_CYL(12), x, 7.72, z, 0xfff0d0, { sx: 0.32, sy: 0.02, sz: 0.32, k: 4 }); }
    g.add(B.build(kit.vcMetal, { shadow: true }), Y.build(kit.vc), L.build(kit.flat));
    // light shafts from the skylights
    const shafts = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 13), kit.shaft);
      m.position.set(-6 + i * 4 + 1.6, 5.5, -3 + rnd(-1, 1));
      m.rotation.set(0, rnd(-0.2, 0.2), 0.32);
      m.renderOrder = 6;
      g.add(m); shafts.push(m);
    }
    T.tick = (t, dt) => {
      kit.shaft.opacity = 0.16 + Math.sin(t * 0.6) * 0.03;
      if (Math.random() < dt * 30) T.motes(rnd(-6, 6), rnd(0.3, 7), rnd(-6, 2), 1, 0.92, 0.75);
    };
  },
  beach(T, kit, tex) {
    const g = T.group;
    g.add(ground(kit, tex.sand, [40, 20], 300, 60, 0, 20, 0, 0xfff0e0));
    g.add(ground(kit, tex.deck, [2, 2.4], 7, 8, 0, 0.6, 0.012, 0xffe8d8));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 220, 1, 1), kit.sea);
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.05, -120);
    g.add(sea);
    const B = new Batch(), S = new Batch(), F = new Batch();
    // wet sand + foam line
    B.box(300, 0.01, 2.2, 0, 0.004, -9.2, 0xc8a07a); B.box(300, 0.012, 0.25, 0, 0.012, -10.2, 0xffffff, { k: 1.3 });
    // umbrella, loungers, lifeguard tower, ball
    B.box(0.06, 2.3, 0.06, -4.6, 1.15, -5.6, 0xeeeeee);
    for (let i = 0; i < 8; i++) B.add(G_CONE(3), -4.6, 2.3, -5.6, i % 2 ? 0xff4f6a : 0xffffff, { sx: 1.4, sy: 0.5, sz: 1.4, ry: (i / 8) * 6.283 });
    for (const x of [-5.8, -3.4]) { B.box(0.7, 0.1, 1.9, x, 0.35, -5.2, 0xf4f0e8, { rx: 0.05 }); B.box(0.7, 0.1, 0.7, x, 0.62, -6.05, 0xf4f0e8, { rx: 0.7 }); }
    for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) B.box(0.12, 3.0, 0.12, 5.8 + ox, 1.5, -7 + oz, 0xf4f0e8);
    B.box(2.0, 1.2, 1.9, 5.8, 3.6, -7, 0xff5a3a); B.add(prism(2.4, 0.6, 2.2), 5.8, 4.2, -7, 0xf4f0e8);
    B.box(0.1, 2.6, 0.1, 5.8, 3.5, -8.4, 0xe0e0e0, { rx: -0.35 });
    // palms
    palm(S, -6.2, -7.5, 1.2, 0.35); palm(S, 7.6, -9, 1.35, -0.3); palm(S, -11, -12, 1.5, 0.2); palm(S, 12, -14, 1.4, -0.25); palm(S, 3.6, -14, 1.1, 0.15);
    // distant islands and boats
    ridge(F, { z: -150, x0: -160, x1: -40, base: -1, f: (x) => Math.max(0, 9 * (1 - ((x + 100) / 60) ** 2)), top: 0x6a4a7a, bottom: 0x8a5a7a });
    ridge(F, { z: -130, x0: 40, x1: 110, base: -1, f: (x) => Math.max(0, 6 * (1 - ((x - 75) / 35) ** 2)), top: 0x5a3a6a, bottom: 0x7a4a6a });
    F.box(3, 0.6, 1, 20, 0.2, -60, 0x2a1a2a); F.add(prism(0.1, 3, 2), 20.2, 0.5, -60, 0xfff0e0, { ry: Math.PI / 2 });
    g.add(B.build(kit.vc, { shadow: true }), S.build(kit.sway), F.build(kit.flat, { receive: false, order: -5 }));
    T.tick = makeBirds(g, kit.bird, 7, { cy: 8, cz: -24, r: 12, size: 0.45, speed: 0.2 });
  },
};

// ---------------------------------------------------------------- manager
export class ThemeManager {
  constructor({ renderer, scene, base, ambient, post }) {
    Object.assign(this, { renderer, scene, base, ambient, post });
    this.uTime = { value: 0 };
    this.kit = makeKit(this.uTime);
    this.tex = new TexFactory();
    this.T = {};
    this.cur = null;
    this.last = null;
  }
  // build every theme (textures off-thread, geometry here, env maps), all before play
  async buildAll(onStep) {
    const names = Object.keys(THEMES);
    const texNames = [...new Set(names.flatMap((n) => THEMES[n].textures))];
    const texP = Object.fromEntries(texNames.map((n) => [n, this.tex.get(n, 256)]));
    const pm = new THREE.PMREMGenerator(this.renderer);
    for (const name of names) {
      const def = THEMES[name];
      const tex = {};
      for (const t of def.textures) tex[t] = await texP[t];
      const T = { name, def, group: new THREE.Group(), tick: null };
      T.motes = (x, y, z, r, g, b) => this.ambient.emit(x, y, z, rnd(-0.05, 0.05), rnd(-0.02, 0.06), rnd(-0.05, 0.05), rnd(3, 6), rnd(0.012, 0.03), r, g, b, 0, 0.1, 0, 0.8);
      T.snowflake = () => this.ambient.emit(rnd(-5, 5), rnd(4, 7), rnd(-6, 4), rnd(-0.3, 0.3), -rnd(0.4, 0.8), rnd(-0.2, 0.2), rnd(6, 9), rnd(0.025, 0.05), 1, 1, 1, 0, 0.05, 0, 0.95);
      T.smoke = (x, y, z) => this.ambient.emit(x, y, z, rnd(-0.1, 0.2), rnd(0.4, 0.7), rnd(-0.1, 0.1), rnd(3, 5), rnd(0.3, 0.5), 0.75, 0.75, 0.78, -0.05, 0.2, 1.4, 0.5);
      BUILD[name](T, this.kit, tex);
      T.group.visible = false;
      this.scene.add(T.group);
      T.env = this.envMap(pm, def);
      this.T[name] = T;
      if (onStep) await onStep(name);
    }
    pm.dispose();
  }
  envMap(pm, def) {
    const env = new THREE.Scene();
    const m = this.base.skyMat.clone();
    m.uniforms = THREE.UniformsUtils.clone(this.base.skyMat.uniforms);
    this.setSky(m.uniforms, def.sky, false);
    m.uniforms.uCloudOn.value = 0;
    env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), m));
    const sb = (c, i, p, w = 6, h = 2.5) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(i), side: THREE.DoubleSide })); q.position.set(...p); q.lookAt(0, 0, 0); env.add(q); };
    const sd = new THREE.Vector3(...def.sky.sun).normalize().multiplyScalar(8);
    if (!def.sky.hidden) sb(def.sky.sunCol, 12 * Math.max(0.3, def.sky.glow), sd.toArray(), 2, 2);
    for (const [c, i, p] of def.env) sb(c, i, p);
    const rt = pm.fromScene(env, 0.03);
    return rt.texture;
  }
  setSky(u, s, clouds = true) {
    u.uTop.value.set(s.top); u.uHor.value.set(s.hor); u.uLow.value.set(s.low);
    u.uSun.value.set(...s.sun).normalize(); u.uSunCol.value.set(s.sunCol);
    if (u.uGlow) u.uGlow.value = s.glow;
    if (u.uStars) u.uStars.value = s.stars;
    if (u.uCloudTint) u.uCloudTint.value.set(s.cloudTint);
    u.uCloudOn.value = clouds ? s.clouds : 0;
  }
  pickFor(sceneName) {
    const list = SCENE_THEMES[sceneName] || Object.keys(THEMES);
    const opts = list.filter((n) => n !== this.cur) ;
    return (opts.length ? opts : list)[(Math.random() * (opts.length || list.length)) | 0];
  }
  apply(name) {
    const T = this.T[name];
    if (!T) return null;
    if (this.cur && this.T[this.cur]) this.T[this.cur].group.visible = false;
    this.cur = name;
    T.group.visible = true;
    const d = T.def, L = d.light, b = this.base;
    this.setSky(b.skyMat.uniforms, d.sky, true);
    b.sky.visible = !d.sky.hidden;
    this.scene.fog.color.set(d.fog[0]); this.scene.fog.near = d.fog[1]; this.scene.fog.far = d.fog[2];
    this.scene.environment = T.env;
    this.scene.environmentIntensity = L.env;
    b.sun.color.set(L.key); b.sun.intensity = L.keyI;
    b.sun.position.set(...L.keyDir).normalize().multiplyScalar(12);
    b.hemi.color.set(L.hemiS); b.hemi.groundColor.set(L.hemiG); b.hemi.intensity = L.hemiI;
    b.rim.color.set(L.rim); b.rim.intensity = L.rimI;
    this.post.comp.uniforms.expo.value = L.expo;
    this.post.comp.uniforms.bloom.value = L.bloom;
    this.post.bright.uniforms.thr.value = L.thr;
    this.renderer.toneMappingExposure = L.expo;
    this.ambient.n = 0;
    return d;
  }
  update(dt) {
    this.uTime.value += dt;
    const T = this.T[this.cur];
    if (T && T.tick) T.tick(this.uTime.value, dt);
  }
}
