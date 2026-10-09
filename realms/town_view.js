// =====================================================================
// HEX REALMS: the town screen (HoMM3 style).
// A fixed, slightly elevated panoramic camera looks over a painted valley
// where the town's buildings stand in fixed slots.
//
//   import { createTownView, TOWN_SLOTS, slotOf } from './town_view.js';
//   const tv = createTownView(THREE, renderer);
//   tv.setTown({ fac: 'haven', built: ['d1', 'fort'], name: 'Rivermoot' });
//   tv.resize(innerWidth, innerHeight);          // + tv.setInsets({ bottom: 0.45 })
//   each frame: tv.update(dt); render(tv.scene, tv.camera)
//   tap:        const id = tv.pick(e.clientX, e.clientY); tv.highlight(id);
//
// Building models come from haven_town.js / necro_town.js (loaded with a
// guarded dynamic import, so a missing or broken file falls back to a
// placeholder house). Everything else is procedural.
// =====================================================================

const Q = new URL(import.meta.url).search; // keep the caller's ?v= cache key so shared modules stay shared
const rel = (p) => new URL(p + Q, import.meta.url).href;
const [MATm, HAVm, NECm] = await Promise.allSettled([import(rel('./materials.js')), import(rel('./haven_town.js')), import(rel('./necro_town.js'))]);
const MAT = MATm.status === 'fulfilled' ? MATm.value : null;
const MODEL_FN = { haven: HAVm.value?.havenTownBuilding ?? null, necro: NECm.value?.necroTownBuilding ?? null };
if (HAVm.status === 'rejected') console.warn('town_view: haven_town.js unavailable, using placeholders', HAVm.reason);
if (NECm.status === 'rejected') console.warn('town_view: necro_town.js unavailable, using placeholders', NECm.reason);

// ------------------------------------------------------------------ slots
const S = (x, z, ry = 0, s = 1) => ({ x, z, ry, s });
// one entry per slot; upgrades share their base's slot
const SLOT_POS = {
  fort: S(0, -5.1),
  hall: S(0, -2.6),
  d7: S(-3.4, -2.8, 0.18),
  mage: S(3.4, -2.6, -0.18),
  d6: S(-4.5, 0.05, 0.25),
  d5: S(-2.2, 0.15, 0.08),
  d4: S(2.2, 0.15, -0.08),
  tavern: S(4.5, 0.05, -0.25),
  market: S(-3.35, 2.75, 0.2),
  d1: S(-1.12, 2.8, 0.06),
  d2: S(1.12, 2.8, -0.06),
  d3: S(3.35, 2.75, -0.2),
};
export const BUILDING_IDS = ['village', 'hall2', 'hall3', 'fort', 'market', 'tavern', 'mage1', 'mage2', 'mage3',
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'];
/** slot key for a building id: village/hall2/hall3 -> 'hall', mage1..3 -> 'mage', uN -> 'dN' */
export function slotOf(id) {
  if (id === 'village' || id === 'hall2' || id === 'hall3') return 'hall';
  if (/^mage\d$/.test(id)) return 'mage';
  if (/^[du]\d$/.test(id)) return 'd' + id[1];
  return id;
}
/** id -> { x, z, ry, s } in town-view units (+z towards the camera) */
export const TOWN_SLOTS = Object.fromEntries(BUILDING_IDS.map((id) => [id, SLOT_POS[slotOf(id)]]));
// expected footprint [w, d, h] per id (the contract)
const DIMS = {
  village: [2.4, 2.4, 2.6], hall2: [2.4, 2.4, 3.0], hall3: [2.4, 2.4, 3.5], fort: [9, 1.2, 2.5],
  market: [2, 2, 1.7], tavern: [1.8, 1.8, 1.9], mage1: [1.6, 1.6, 2.5], mage2: [1.6, 1.6, 3.3], mage3: [1.6, 1.6, 4.2],
  d1: [1.8, 1.8, 1.9], d2: [1.8, 1.8, 2.3], d3: [1.8, 1.8, 2.5], d4: [2, 2, 2.4], d5: [2, 2, 2.7], d6: [2.4, 2.4, 2.8], d7: [2.8, 2.8, 4.5],
};
for (let t = 1; t <= 7; t++) { const d = DIMS['d' + t]; DIMS['u' + t] = [d[0], d[1], d[2] * 1.15]; }
// glow multipliers per building (faction:id or id); 1 = the shared glow material
const GLOW_SCALE = { 'haven:u7': 0.5, 'haven:d7': 0.7, 'haven:mage3': 0.8 };
const SLOT_MAXH = { fort: 2.5, hall: 3.5, mage: 4.2, market: 1.8, tavern: 2, d1: 2.2, d2: 2.6, d3: 2.9, d4: 2.8, d5: 3.1, d6: 3.2, d7: 4.5 };
const SLOT_DIM = (k) => { const id = k === 'hall' ? 'hall3' : k === 'mage' ? 'mage3' : k; return DIMS[id]; };

// which id stands in each slot for a given built list
function resolveSlots(built) {
  const has = (id) => built.includes(id);
  const out = { hall: has('hall3') ? 'hall3' : has('hall2') ? 'hall2' : 'village' };
  const m = has('mage3') ? 'mage3' : has('mage2') ? 'mage2' : has('mage1') ? 'mage1' : null;
  if (m) out.mage = m;
  for (const id of ['fort', 'market', 'tavern']) if (has(id)) out[id] = id;
  for (let t = 1; t <= 7; t++) { const u = 'u' + t, d = 'd' + t; if (has(u)) out[d] = u; else if (has(d)) out[d] = d; }
  return out;
}

// ------------------------------------------------------------------ small math helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function rng32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash2 = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
function vnoise(x, z, s = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, oct = 3, s = 0) { let v = 0, a = 0.5, t = 0; for (let k = 0; k < oct; k++) { v += a * vnoise(x, z, s + k * 17); t += a; a *= 0.5; x *= 2.03; z *= 2.03; } return v / t; }

// ------------------------------------------------------------------ palettes
const PAL = {
  haven: {
    zenith: 0x3d7de0, mid: 0x7fb6f2, horizon: 0xdcEEF8, below: 0xb8d8c8, sunCol: 0xfff0c0, fog: 0xcfe2ee, fogNear: 70, fogFar: 1150,
    sunDir: [-0.55, 0.62, 0.55], sun: 0xfff0d2, sunI: 2.7, hemiSky: 0xd0e4ff, hemiGround: 0x768b57, hemiI: 1.05, amb: 0xfff8f0, ambI: 0.28,
    // round 3: calm backdrop (~30% less saturated, ~10% darker) so the buildings are the figures
    grass: [0x74a05e, 0x94b870, 0xaab87e, 0x5f8a52], bank: 0xd2c69c, field: [0xd0c080, 0xa2c774, 0xbea176, 0xc8c48c],
    mtn: [0x6e9a78, 0x8a9cc0, 0xf4f6ff], hill: 0x65945a,
    water: [0x2a78c8, 0x5fc0e8, 0xbfe8ff], waterSky: 0xd6ecff, waterGlow: 0,
    path: '#d8c8a2', pathEdge: '#b49a72', stone: ['#ccbc98', '#e4d8bc', '#bcaa86'], pad: 'rgba(84,96,58,0.24)',
    dots: ['rgba(240,226,150,0.55)', 'rgba(244,240,226,0.5)', 'rgba(220,170,180,0.45)', 'rgba(96,130,70,0.4)'],
    cloud: 0xffffff, cloudShade: [196, 210, 232], dust: 0xe0d0a8, smoke: 0xeeeef4, birds: 0x4a5470, banner: [0x2a5ad8, 0xf0c040],
    tree: 'round', stars: 0,
  },
  necro: {
    // a luminous lavender / rose dusk: eerie but bright, never murky
    zenith: 0x5c52ac, mid: 0xa690d0, horizon: 0xfac8c4, below: 0xc0b6b8, sunCol: 0xffd8ec, fog: 0xd8c8cc, fogNear: 90, fogFar: 950,
    sunDir: [0.55, 0.5, 0.5], sun: 0xffdcc0, sunI: 3.1, hemiSky: 0xc2bae6, hemiGround: 0x8a8670, hemiI: 0.95, amb: 0xc4bcd6, ambI: 0.26,
    // round 3: ash-grey / olive / bone ground, so the violet buildings stand out against it
    grass: [0xa8a492, 0x949a7c, 0xd0c8b2, 0x9a909a], bank: 0xb8ac94, field: [0x9a9298, 0x8e9676, 0xa89c8a, 0x928c9c],
    mtn: [0x837a98, 0x9a92ae, 0xe4dcec], hill: 0x8e8c82,
    water: [0x2a7c88, 0x56c0a8, 0xbaf8dc], waterSky: 0xb49ad4, waterGlow: 0.35,
    path: '#d8d0c0', pathEdge: '#a69c8a', stone: ['#bcb4a2', '#e6e0d2', '#aaa292'], pad: 'rgba(70,66,54,0.2)',
    dots: ['rgba(170,140,184,0.45)', 'rgba(140,152,118,0.45)', 'rgba(170,240,200,0.4)', 'rgba(236,228,214,0.5)'],
    cloud: 0xfff0f8, cloudShade: [210, 170, 210], dust: 0xd0c0d4, smoke: 0xd8cce8, birds: 0x5a4870, banner: [0xc8183c, 0xf2e6c8],
    tree: 'dead', stars: 1,
    groundTune: { shade: 0x8ea8a0, lift: 0.1, toe: 0.2, detail: 0.75 }, sceneryTune: { shade: 0xa898d0, lift: 0.18, toe: 0.4 },
  },
};
// river centre line (shared, the valley shape is the same)
const RIVER = [[-300, -200], [-150, -80], [-60, -26], [-22, -14.5], [0, -13.2], [20, -14.6], [48, -22], [110, -40], [300, -150]];

// ------------------------------------------------------------------ the view
export function createTownView(THREE, renderer, opts = {}) {
  const T = THREE, V3 = T.Vector3;
  const col = (h) => new T.Color(h);
  const disposables = new Set();
  const keep = (x) => { if (x) disposables.add(x); return x; };
  const uTime = { value: 0 };

  const scene = new T.Scene();
  scene.name = 'town-view';
  const camera = new T.PerspectiveCamera(40, 1, 0.5, 4000);

  // materials
  const bodyMat = opts.bodyMat || keep(MAT ? MAT.makeBodyMaterial(T) : new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }));
  const glowMat = opts.glowMat || keep(MAT ? MAT.makeGlowMaterial(T) : new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  const groundMat = keep(MAT ? MAT.makeBodyMaterial(T, { ao: 0, detail: 0.9, scale: 0.32, rim: 0, hemi: 0.06, sat: 0.86, contrast: 0.12, ink: 0 }) : new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  const sceneryMat = keep(MAT ? MAT.makeBodyMaterial(T, { ao: 0.3, aoHeight: 0.4, rim: 0.3, sat: 0.95 }) : new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }));
  if (!MAT && !opts.glowMat) glowMat.color.setScalar(2.2);
  for (const m of [groundMat, sceneryMat]) m.userData.baseDetail = m.userData.uniforms?.uDetail.value;

  // lights
  const sun = new T.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 90 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  sun.target.position.set(0, 0, -1);
  const hemi = new T.HemisphereLight(0xffffff, 0x444444, 1);
  const amb = new T.AmbientLight(0xffffff, 0.3);
  scene.add(sun, sun.target, hemi, amb);
  scene.fog = new T.Fog(0xffffff, 60, 1000);

  // ---------------------------------------------------------------- geometry kit
  function paintGeo(g, c, jitter = 0.06, r = Math.random) {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const p = g.attributes.position, n = p.count, arr = new Float32Array(n * 3);
    g.computeBoundingBox();
    const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
    const fn = typeof c === 'function' ? c : null;
    const a = fn ? null : col(Array.isArray(c) ? c[0] : c), b = fn ? null : col(Array.isArray(c) ? c[1] : c), tmp = new T.Color();
    for (let i = 0; i < n; i += 3) {
      const j = 1 + (r() - 0.5) * jitter; // per-face jitter
      for (let k = i; k < i + 3; k++) {
        if (fn) fn(p.getX(k), p.getY(k), p.getZ(k), tmp);
        else tmp.copy(a).lerp(b, (p.getY(k) - y0) / (y1 - y0 || 1));
        arr[k * 3] = tmp.r * j; arr[k * 3 + 1] = tmp.g * j; arr[k * 3 + 2] = tmp.b * j;
      }
    }
    g.setAttribute('color', new T.BufferAttribute(arr, 3));
    return g;
  }
  function mergeGeos(list) {
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), cc = new Float32Array(n * 3);
    let o = 0;
    for (const g of list) { pos.set(g.attributes.position.array, o * 3); cc.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(cc, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
  function kit(seed) {
    const r = rng32(seed), B = [], G = [];
    return {
      r, B, G,
      add(g, c, glow = false, jit = 0.07) { (glow ? G : B).push(paintGeo(g, c, glow ? 0 : jit, r)); },
      box(w, h, d, x, y, z, c, ry = 0, glow = false) { this.add(new T.BoxGeometry(w, h, d).translate(0, h / 2, 0).rotateY(ry).translate(x, y, z), c, glow); },
      cyl(r1, r2, h, x, y, z, c, seg = 8) { this.add(new T.CylinderGeometry(r1, r2, h, seg).translate(x, y + h / 2, z), c); },
      cone(rad, h, x, y, z, c, seg = 8, ry = 0) { this.add(new T.ConeGeometry(rad, h, seg).rotateY(ry).translate(x, y + h / 2, z), c); },
      // a gable roof, ridge along local x, then turned by ry
      roof(w, h, d, x, y, z, c, ry = 0) {
        const hw = w / 2, hd = d / 2;
        const P = [-hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0, hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, -hw, h, 0, hw, h, 0,
          -hw, 0, -hd, -hw, 0, hd, -hw, h, 0, hw, 0, hd, hw, 0, -hd, hw, h, 0];
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
        this.add(g.rotateY(ry).translate(x, y, z), c);
      },
      body() { return B.length ? mergeGeos(B) : null; },
      glow() { return G.length ? mergeGeos(G) : null; },
    };
  }
  // per-building glow strength: big emissive faces (the angel portal) would bloom out the screen at full power
  const glowMats = new Map();
  const glowMatFor = (sc) => {
    if (!sc || sc === 1) return glowMat;
    if (!glowMats.has(sc)) {
      const m = keep(MAT ? MAT.makeGlowMaterial(T, { intensity: glowMat.color.r * sc }) : glowMat.clone());
      if (!MAT) m.color.copy(glowMat.color).multiplyScalar(sc);
      glowMats.set(sc, m);
    }
    return glowMats.get(sc);
  };
  const meshOf = (m, castShadow = true, gScale = 1) => {
    const g = new T.Group();
    if (m.body) { const b = new T.Mesh(m.body, bodyMat); b.castShadow = castShadow; b.receiveShadow = true; g.add(b); }
    if (m.glow) g.add(new T.Mesh(m.glow, glowMatFor(gScale)));
    return g;
  };

  // ---------------------------------------------------------------- canvas textures
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = keep(new T.CanvasTexture(c));
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  function cloudTexture(shade, wispy, seed) {
    const r = rng32(seed);
    return canvasTex(512, 256, (g, w, h) => {
      const n = wispy ? 26 : 34;
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
        const t = i / n, x = w * (0.12 + 0.76 * t + (r() - 0.5) * 0.1);
        const hump = Math.sin(t * Math.PI);
        const y = h * (wispy ? 0.6 - hump * 0.12 : 0.72 - hump * (0.25 + r() * 0.15)) + (r() - 0.5) * 18;
        const rad = (wispy ? 30 : 40 + hump * 50) * (0.6 + r() * 0.6);
        const gr = g.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad);
        if (pass === 0) { gr.addColorStop(0, `rgba(${shade[0]},${shade[1]},${shade[2]},0.9)`); gr.addColorStop(1, `rgba(${shade[0]},${shade[1]},${shade[2]},0)`); g.fillStyle = gr; g.save(); if (wispy) { g.translate(x, y); g.scale(2.2, 0.45); g.translate(-x, -y); } g.beginPath(); g.arc(x, y + rad * 0.25, rad, 0, 7); g.fill(); g.restore(); }
        else { gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.save(); if (wispy) { g.translate(x, y); g.scale(2.2, 0.4); g.translate(-x, -y); } g.beginPath(); g.arc(x, y - rad * 0.12, rad * 0.85, 0, 7); g.fill(); g.restore(); }
      }
    });
  }
  const softTex = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const mistTex = canvasTex(256, 128, (g, w, h) => {
    const r = rng32(99);
    for (let i = 0; i < 40; i++) {
      const x = w * (0.25 + r() * 0.5), y = h * (0.5 + (r() - 0.5) * 0.2), rad = 10 + r() * 16;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(2.4, 0.7); g.translate(-x, -y); g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.restore();
    }
    // fade every edge to zero so the sprite never shows a rectangle
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.6, 'rgba(0,0,0,0.8)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.setTransform(1, 0, 0, h / w, 0, 0); g.fillStyle = m; g.fillRect(0, 0, w, w);
  });

  // ---------------------------------------------------------------- particles (dust, smoke, sparkles)
  function makeParticles(cap, additive) {
    const geo = new T.BufferGeometry();
    const P = new Float32Array(cap * 3), Sz = new Float32Array(cap), A = new Float32Array(cap), C = new Float32Array(cap * 3);
    const mk = (arr, n) => { const a = new T.BufferAttribute(arr, n); a.setUsage(T.DynamicDrawUsage); return a; };
    geo.setAttribute('position', mk(P, 3)); geo.setAttribute('aSize', mk(Sz, 1)); geo.setAttribute('aAlpha', mk(A, 1)); geo.setAttribute('aCol', mk(C, 3));
    const mat = new T.ShaderMaterial({
      uniforms: { uH: { value: 800 } }, transparent: true, depthWrite: false,
      blending: additive ? T.AdditiveBlending : T.NormalBlending,
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aCol; varying float vA; varying vec3 vC; uniform float uH;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * projectionMatrix[1][1] * uH * 0.5 / max(0.1, -mv.z); vA = aAlpha; vC = aCol; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(${additive ? '0.0' : '0.3'}, 1.0, r)) * vA; if (a < 0.004) discard;
  gl_FragColor = vec4(vC, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    });
    keep(geo); keep(mat);
    const pts = new T.Points(geo, mat);
    pts.frustumCulled = false; pts.renderOrder = 5;
    const list = [];
    return {
      pts, mat,
      spawn(p) { if (list.length < cap) list.push({ vx: 0, vy: 0, vz: 0, drag: 0.6, grav: 0, s0: 0.5, s1: 1, a: 1, age: 0, life: 1, c: col(0xffffff), ...p }); },
      clear() { list.length = 0; },
      update(dt) {
        let n = 0;
        for (let i = list.length - 1; i >= 0; i--) {
          const q = list[i]; q.age += dt;
          if (q.age >= q.life) { list[i] = list[list.length - 1]; list.pop(); continue; }
          const k = Math.exp(-q.drag * dt);
          q.vx *= k; q.vz *= k; q.vy = q.vy * k + q.grav * dt;
          q.x += (q.vx + (q.wind || 0)) * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        }
        for (const q of list) {
          const t = q.age / q.life;
          P[n * 3] = q.x; P[n * 3 + 1] = q.y; P[n * 3 + 2] = q.z;
          Sz[n] = lerp(q.s0, q.s1, Math.sqrt(t));
          A[n] = q.a * Math.min(1, t * 6) * (1 - t) * (q.twinkle ? 0.6 + 0.4 * Math.sin(q.age * 9 + q.x * 7) : 1);
          C[n * 3] = q.c.r; C[n * 3 + 1] = q.c.g; C[n * 3 + 2] = q.c.b; n++;
        }
        for (const k of ['position', 'aSize', 'aAlpha', 'aCol']) geo.attributes[k].needsUpdate = true;
        geo.setDrawRange(0, n);
      },
    };
  }
  const soft = makeParticles(700, false);
  const glowP = makeParticles(260, true);
  scene.add(soft.pts, glowP.pts);

  // ---------------------------------------------------------------- environment per faction
  const envs = {};
  function riverInfo() {
    const curve = new T.CatmullRomCurve3(RIVER.map(([x, z]) => new V3(x, 0, z)), false, 'centripetal');
    const pts = curve.getSpacedPoints(900);
    return { curve, pts };
  }
  const RIV = riverInfo();
  const riverWidth = (x, z) => 3.4 + smooth(25, 200, Math.hypot(x, z)) * 9;
  function riverDist(x, z) {
    let best = Infinity;
    const pts = RIV.pts;
    let bi = 0;
    for (let i = 0; i < pts.length; i += 12) { const p = pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bi = i; } }
    for (let i = Math.max(0, bi - 12); i < Math.min(pts.length, bi + 13); i++) { const p = pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) best = d; }
    return Math.sqrt(best);
  }
  // flat ground under the town, rolling hills around, river valley behind
  function flatD(x, z) { const dz = z < -0.8 ? (z + 0.8) / 8.2 : (z + 0.8) / 15; return Math.hypot(x / 10.5, dz); }
  function groundH(x, z, fac) {
    const d = flatD(x, z), out = smooth(1.0, 1.7, d), r = Math.hypot(x, z + 4);
    let h = out * (Math.max(fbm(x * 0.05, z * 0.05, 3, 3) - 0.38, -0.1) * 7);
    h += out * smooth(-24, -80, z) * (1.5 + fbm(x * 0.028 + 7, z * 0.028, 3, 9) * 9);
    h += smooth(90, 330, r) * (4 + fbm(x * 0.011, z * 0.011, 3, 21) * 26);
    h *= 1 - smooth(6, 20, z) * smooth(16, 4, Math.abs(x)) * 0.85; // keep the foreground low
    if (fac === 'necro') h += out * (fbm(x * 0.2, z * 0.2, 2, 5) - 0.5) * 0.6;
    const rd = riverDist(x, z), rw = riverWidth(x, z) / 2;
    h = lerp(-1.25, h, smooth(rw * 0.75, rw + 2.6, rd));
    return h;
  }

  function buildEnv(fac) {
    const P = PAL[fac], env = { fac, group: new T.Group(), updaters: [] };
    const G = env.group;
    const R = rng32(fac === 'haven' ? 11 : 23);
    // ----- sky dome
    {
      const mat = keep(new T.ShaderMaterial({
        uniforms: { zen: { value: col(P.zenith) }, mid: { value: col(P.mid) }, hor: { value: col(P.horizon) }, bel: { value: col(P.below) }, sc: { value: col(P.sunCol) }, sd: { value: new V3(...P.sunDir).normalize() }, st: { value: P.stars }, uTime },
        side: T.BackSide, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
        fragmentShader: `uniform vec3 zen, mid, hor, bel, sc, sd; uniform float st, uTime; varying vec3 vD;
float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
void main() { vec3 d = normalize(vD); float y = d.y;
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, y)); c = mix(c, zen, smoothstep(0.18, 0.75, y));
  c = mix(c, bel, smoothstep(0.0, -0.08, y));
  float s = max(dot(d, normalize(sd)), 0.0);
  c += sc * (pow(s, 6.0) * 0.28 + pow(s, 60.0) * 0.5);
  c += hor * 0.25 * (1.0 - smoothstep(0.0, 0.12, abs(y)));
  if (st > 0.5) { vec2 g = vec2(atan(d.x, d.z) * 180.0, y * 260.0); vec2 id = floor(g); float h = h21(id);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + h * 40.0);
    c += vec3(0.9, 0.95, 1.0) * step(0.985, h) * smoothstep(0.12, 0.45, y) * tw * (1.0 - smoothstep(0.08, 0.25, length(fract(g) - 0.5))) * 1.6; }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
      }));
      const dome = new T.Mesh(keep(new T.SphereGeometry(1800, 40, 20)), mat);
      dome.renderOrder = -10; dome.frustumCulled = false;
      env.dome = dome; G.add(dome);
    }
    // ----- clouds (sprites)
    {
      const texA = cloudTexture(P.cloudShade, fac === 'necro', fac === 'haven' ? 5 : 6), texB = cloudTexture(P.cloudShade, fac === 'necro', fac === 'haven' ? 8 : 9);
      const clouds = [];
      const n = fac === 'haven' ? 11 : 9;
      for (let i = 0; i < n; i++) {
        const m = keep(new T.SpriteMaterial({ map: i % 2 ? texA : texB, color: col(P.cloud), transparent: true, depthWrite: false, fog: false, opacity: fac === 'haven' ? 0.95 : 0.7 }));
        const s = new T.Sprite(m);
        const ang = (i / n - 0.5) * 2.4 + (R() - 0.5) * 0.25, dist = 900 + R() * 400;
        const w = (fac === 'haven' ? 260 : 380) * (0.7 + R() * 0.6);
        s.scale.set(w, w * (fac === 'haven' ? 0.5 : 0.32), 1);
        s.position.set(Math.sin(ang) * dist, 70 + R() * 150 + (fac === 'necro' ? 30 : 0), 20 - Math.cos(ang) * dist);
        s.renderOrder = -9; clouds.push({ s, sp: 2 + R() * 3 });
        G.add(s);
      }
      env.updaters.push((dt) => { for (const c of clouds) { c.s.position.x += c.sp * dt; if (c.s.position.x > 1300) c.s.position.x -= 2600; } });
      if (fac === 'necro') {
        // a big pale moon with a halo
        const moonTex = canvasTex(256, 256, (g, w) => {
          let gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
          gr.addColorStop(0, 'rgba(230,255,235,1)'); gr.addColorStop(0.22, 'rgba(225,250,230,1)'); gr.addColorStop(0.25, 'rgba(200,255,220,0.5)'); gr.addColorStop(0.5, 'rgba(170,240,200,0.14)'); gr.addColorStop(1, 'rgba(160,220,200,0)');
          g.fillStyle = gr; g.fillRect(0, 0, w, w);
          g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(150,190,170,0.35)';
          for (const [x, y, r] of [[0.45, 0.42, 0.05], [0.56, 0.55, 0.035], [0.5, 0.6, 0.025], [0.42, 0.53, 0.02]]) { g.beginPath(); g.arc(x * w, y * w, r * w, 0, 7); g.fill(); }
        });
        const moon = new T.Sprite(keep(new T.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, color: col(0xffffff) })));
        moon.material.color.setScalar(1.6);
        const md = new V3(0.28, 0.13, -1).normalize();
        moon.position.copy(md).multiplyScalar(1500).add(new V3(0, 0, 20)); moon.scale.set(420, 420, 1); moon.renderOrder = -9.5;
        G.add(moon);
      }
    }
    // ----- ground (polar grid: fine near the town, coarse far away)
    {
      const radii = [];
      for (let k = 0; k <= 40; k++) radii.push(k * 0.8);
      while (radii[radii.length - 1] < 420) radii.push(radii[radii.length - 1] * 1.075);
      const N = 168, cx = 0, cz = -2;
      const pos = [], cols = [], idx = [];
      const c = new T.Color(), g0 = col(P.grass[0]), g1 = col(P.grass[1]), g2 = col(P.grass[2]), g3 = col(P.grass[3]), bank = col(P.bank), hill = col(P.hill);
      const fields = P.field.map(col);
      for (let k = 0; k < radii.length; k++) for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + (k % 2) * (Math.PI / N), rr = radii[k];
        const x = cx + Math.sin(a) * rr, z = cz + Math.cos(a) * rr;
        const y = groundH(x, z, fac);
        pos.push(x, y, z);
        // colour
        const n1 = fbm(x * 0.09, z * 0.09, 3, 1), n2 = fbm(x * 0.35, z * 0.35, 2, 2);
        if (fac === 'necro') {
          // sage-grey moor, violet heather patches, pale ash drifts
          const n3 = fbm(x * 0.16 + 31, z * 0.16, 3, 7);
          c.copy(g0).lerp(g1, smooth(0.45, 0.75, n1) * 0.75).lerp(g3, smooth(0.5, 0.7, n3) * 0.5).lerp(g2, smooth(0.64, 0.86, n2) * 0.4);
        } else c.copy(g0).lerp(g1, smooth(0.35, 0.7, n1)).lerp(g3, smooth(0.55, 0.2, n1) * 0.6).lerp(g2, smooth(0.6, 0.85, n2) * 0.35);
        if (y > 4) c.lerp(hill, smooth(4, 20, y) * 0.5);
        // patchwork fields on the left hills (haven) / heather moor (necro)
        if (x < -14 && z < -18 && z > -110 && x > -140) {
          const u = x * 0.8 + z * 0.6, v = -x * 0.6 + z * 0.8, fi = Math.floor(u / 9) * 7 + Math.floor(v / 7);
          const f = fields[Math.floor(hash2(fi, 3, 1) * fields.length)];
          c.lerp(f, 0.75 * smooth(-14, -22, x) * smooth(-18, -24, z));
        }
        const rd = riverDist(x, z), rw = riverWidth(x, z) / 2;
        c.lerp(bank, smooth(rw + 2.8, rw + 0.6, rd) * 0.85);
        c.multiplyScalar(fac === 'necro' ? 0.92 + n2 * 0.14 : 0.95 + n2 * 0.1);
        cols.push(c.r, c.g, c.b);
      }
      for (let k = 0; k < radii.length - 1; k++) for (let i = 0; i < N; i++) {
        const a = k * N + i, b = k * N + ((i + 1) % N), cc = (k + 1) * N + i, d = (k + 1) * N + ((i + 1) % N);
        if (k % 2 === 0) idx.push(a, cc, b, b, cc, d); else idx.push(a, cc, d, a, d, b);
      }
      const geo = keep(new T.BufferGeometry());
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      const ground = new T.Mesh(geo, groundMat);
      ground.receiveShadow = true; ground.name = 'ground';
      G.add(ground);
    }
    // ----- the painted town floor: paths and building lots, redrawn for the built slots only
    {
      const X0 = -11, Z0 = -9.5, W = 22, PX = 512 / W;
      const cv = document.createElement('canvas'); cv.width = cv.height = 512;
      const tex = keep(new T.CanvasTexture(cv)); tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const lay = document.createElement('canvas'); lay.width = lay.height = 512;
      env.floorKey = null;
      env.drawFloor = (keys) => {
        const key = keys.slice().sort().join(',');
        if (key === env.floorKey) return;
        env.floorKey = key;
        const g = cv.getContext('2d'), L = lay.getContext('2d');
        g.clearRect(0, 0, 512, 512); L.clearRect(0, 0, 512, 512); L.globalCompositeOperation = 'source-over';
        const tx = (x) => (x - X0) * PX, tz = (z) => (z - Z0) * PX;
        const r = rng32(5);
        const has = (k) => keys.includes(k);
        // lots under the built slots
        for (const k of keys) {
          if (k === 'fort' || !SLOT_POS[k]) continue;
          const s = SLOT_POS[k], d = SLOT_DIM(k);
          const rad = Math.max(d[0], d[1]) * 0.66 * PX;
          const gr = g.createRadialGradient(tx(s.x), tz(s.z), rad * 0.3, tx(s.x), tz(s.z), rad);
          gr.addColorStop(0, P.pad); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(tx(s.x), tz(s.z), rad, 0, 7); g.fill();
        }
        // roads: the entry road to the hall plaza, then a branch to each built slot only
        const roads = [[[0, 12], [0.1, 6], [-0.03, 3.6], [0, 1.4], [0, -1.0]]];
        const MID = ['d6', 'd5', 'd4', 'tavern'], FRONT = ['market', 'd1', 'd2', 'd3'], BACK = ['d7', 'mage'];
        for (const side of [-1, 1]) {
          // middle row: the street at z 1.5 runs out to the furthest built house on this side
          const mx = Math.max(0, ...MID.filter((k) => has(k) && Math.sign(SLOT_POS[k].x) === side).map((k) => Math.abs(SLOT_POS[k].x)));
          if (mx) roads.push([[0, 1.45], [side * mx * 0.5, 1.5], [side * mx, 1.55], [side * mx, 1.0]]);
          for (const k of MID) if (has(k) && Math.sign(SLOT_POS[k].x) === side && Math.abs(SLOT_POS[k].x) < mx) roads.push([[SLOT_POS[k].x, 1.5], [SLOT_POS[k].x, 1.0]]);
          // back row: the street at z -1.15 from the plaza
          const bx = Math.max(0, ...BACK.filter((k) => has(k) && Math.sign(SLOT_POS[k].x) === side).map((k) => Math.abs(SLOT_POS[k].x)));
          if (bx) roads.push([[0, -1.1], [side * bx * 0.5, -1.15], [side * bx, -1.2], [side * bx, -1.6]]);
        }
        // front row: short walks from the entry road to each front door
        for (const k of FRONT) if (has(k)) { const s = SLOT_POS[k]; roads.push([[0, 4.5], [s.x * 0.55, 4.45], [s.x, 4.15], [s.x, 3.6]]); }
        if (has('fort')) roads.push([[0, -3.6], [0, -4.7]]);
        const stroke = (ctx, w, style, blur = 0) => {
          ctx.strokeStyle = style; ctx.lineWidth = w * PX; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.shadowColor = style; ctx.shadowBlur = blur;
          for (const rd of roads) { ctx.beginPath(); rd.forEach(([x, z], i) => (i ? ctx.lineTo(tx(x), tz(z)) : ctx.moveTo(tx(x), tz(z)))); ctx.stroke(); }
          ctx.shadowBlur = 0;
        };
        stroke(L, 1.2, P.pathEdge, 8);
        L.fillStyle = P.pathEdge; L.beginPath(); L.ellipse(tx(0), tz(-0.95), 1.6 * PX, 1.05 * PX, 0, 0, 7); L.fill();
        stroke(L, 0.8, P.path);
        L.fillStyle = P.path; L.beginPath(); L.ellipse(tx(0), tz(-0.95), 1.3 * PX, 0.82 * PX, 0, 0, 7); L.fill();
        L.globalCompositeOperation = 'source-atop';
        for (let i = 0; i < 4200; i++) {
          const x = r() * 512, y = r() * 512, s = 2 + r() * 3.2;
          L.fillStyle = P.stone[(r() * 3) | 0]; L.globalAlpha = 0.3 + r() * 0.3;
          L.beginPath(); L.ellipse(x, y, s, s * (0.6 + r() * 0.3), r() * 3, 0, 7); L.fill();
        }
        L.globalAlpha = 1;
        g.drawImage(lay, 0, 0);
        // flowers / tufts (haven) - heather, pale sage tufts and green glimmers (necro)
        // round 3: a sparse, muted sprinkle (was 650 bright dots: read as confetti)
        const dots = P.dots;
        for (let i = 0; i < 190; i++) {
          const x = r() * 512, y = r() * 512;
          g.fillStyle = dots[(r() * dots.length) | 0];
          g.beginPath(); g.arc(x, y, 1 + r() * 1.4, 0, 7); g.fill();
        }
        tex.needsUpdate = true;
      };
      const m = keep(new T.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      const plane = new T.Mesh(keep(new T.PlaneGeometry(W, W).rotateX(-Math.PI / 2).translate(X0 + W / 2, 0.015, Z0 + W / 2)), m);
      plane.receiveShadow = true; plane.renderOrder = 1;
      G.add(plane);
    }
    // ----- the river
    {
      const pts = RIV.curve.getSpacedPoints(500);
      const pos = [], uv = [], idx = [];
      let along = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
        const tx = q.x - o.x, tz = q.z - o.z, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
        const w = riverWidth(p.x, p.z) / 2 + 0.9;
        if (i) along += p.distanceTo(pts[i - 1]);
        pos.push(p.x + nx * w, -0.38, p.z + nz * w, p.x - nx * w, -0.38, p.z - nz * w);
        uv.push(along, 0, along, 1);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const geo = keep(new T.BufferGeometry());
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const mat = keep(new T.ShaderMaterial({
        uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { deep: { value: col(P.water[0]) }, shal: { value: col(P.water[1]) }, foam: { value: col(P.water[2]) }, sky: { value: col(P.waterSky) }, glow: { value: P.waterGlow } }]),
        fog: true, side: T.DoubleSide,
        vertexShader: `varying vec2 vUv; varying vec3 vW;
#include <fog_pars_vertex>
void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
        fragmentShader: `uniform vec3 deep, shal, foam, sky; uniform float glow, uTime; varying vec2 vUv; varying vec3 vW;
#include <fog_pars_fragment>
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float e = min(vUv.y, 1.0 - vUv.y) * 2.0;
  vec3 c = mix(shal, deep, smoothstep(0.1, 0.8, e));
  float fl = vn(vec2(vUv.x * 0.35 - uTime * 0.5, vUv.y * 5.0)) * 0.6 + vn(vec2(vUv.x * 1.1 - uTime * 0.9, vUv.y * 11.0)) * 0.4;
  vec3 vd = normalize(cameraPosition - vW);
  float fres = pow(1.0 - clamp(vd.y, 0.0, 1.0), 2.0);
  c = mix(c, sky, 0.25 + fres * 0.55);
  c += (fl - 0.5) * 0.12 * (1.0 + glow * 2.0) * shal;
  float sp = pow(vn(vW.xz * 2.2 + vec2(uTime * 0.6, -uTime * 0.25)) * vn(vW.xz * 3.1 - vec2(uTime * 0.4, uTime * 0.5)), 5.0);
  c += vec3(1.0, 0.98, 0.9) * sp * 5.0 * (1.0 - glow * 0.6);
  float fo = smoothstep(0.32, 0.0, e + (vn(vec2(vUv.x * 1.5 - uTime * 0.3, vUv.y * 9.0)) - 0.5) * 0.25);
  c = mix(c, foam, fo * 0.75);
  c += shal * glow * 0.4 * (0.6 + 0.4 * sin(uTime * 1.3 + vUv.x * 0.2));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
      }));
      mat.uniforms.uTime = uTime;
      const river = new T.Mesh(geo, mat);
      river.receiveShadow = false;
      G.add(river);
    }
    // ----- distant mountains (ring heightfield)
    {
      const N = 220, J = 7, pos = [], cols = [], idx = [];
      const base = col(P.mtn[0]), midc = col(P.mtn[1]), top = col(P.mtn[2]), c = new T.Color();
      for (let j = 0; j <= J; j++) for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2, t = j / J;
        const rr = 470 + t * 260 + (vnoise(i * 0.3, j, 4) - 0.5) * 40;
        const ridge = Math.pow(Math.max(0, fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, 4, fac === 'haven' ? 31 : 37) - 0.25), 1.25);
        const front = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (1 - smooth(0.75, 1, t) * 0.6);
        const spike = fac === 'necro' ? Math.pow(vnoise(i * 0.9, j * 1.3, 8), 3) * 50 : Math.pow(vnoise(i * 0.7, j * 1.1, 8), 2) * 30;
        const y = -6 + front * (30 + ridge * 230 + spike * front);
        const x = Math.sin(a) * rr, z = -4 + Math.cos(a) * rr;
        pos.push(x, y, z);
        const hn = clamp(y / 150, 0, 1);
        c.copy(base).lerp(midc, smooth(0.08, 0.4, hn));
        if (fac === 'haven') c.lerp(top, smooth(0.5, 0.62, hn + (vnoise(i * 1.7, j * 2.3, 2) - 0.5) * 0.15));
        else c.lerp(top, smooth(0.45, 0.8, hn) * 0.7);
        cols.push(c.r, c.g, c.b);
      }
      for (let j = 0; j < J; j++) for (let i = 0; i < N; i++) {
        const a = j * N + i, b = j * N + ((i + 1) % N), cc = (j + 1) * N + i, d = (j + 1) * N + ((i + 1) % N);
        idx.push(a, cc, b, b, cc, d);
      }
      const geo = keep(new T.BufferGeometry());
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      const m = new T.Mesh(geo, groundMat);
      G.add(m);
    }
    // ----- trees (instanced)
    {
      const trees = { round: [], pine: [], dead: [] };
      const blocked = (x, z) => {
        if (flatD(x, z) < 1.12) return true;
        if (z > 2 && Math.abs(x) < 8 + (z - 2) * 0.55) return true; // keep the view to the town clear
        if (riverDist(x, z) < riverWidth(x, z) / 2 + 1.6) return true;
        for (const [px, pz, pr] of env.keepOut || []) if (Math.hypot(x - px, z - pz) < pr) return true;
        return false;
      };
      env.keepOut = fac === 'haven' ? [[-14.5, -9, 4], [12, -8, 3], [15, -4.5, 2.5], [-12.5, 3.5, 2.5]] : [[-14.5, -9, 4], [12.5, -8, 3], [-12, 3, 3], [13, 2, 3]];
      const clusters = [];
      for (let i = 0; i < 26; i++) { const a = (R() - 0.5) * Math.PI * 1.7, d = 30 + R() * 110; clusters.push([Math.sin(a) * d * 1.2, -Math.cos(a) * d * 0.9 - 2, 3 + R() * 9]); }
      clusters.push([-13, -2, 4], [13, -2, 5], [-18, -20, 4], [20, -22, 5], [-18, 6, 4], [18, 8, 5]);
      for (const [cx, cz, cr] of clusters) {
        const n = Math.round(cr * (fac === 'haven' ? 2.6 : 1.4));
        for (let k = 0; k < n; k++) {
          const a = R() * 7, d = Math.sqrt(R()) * cr, x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
          if (blocked(x, z)) continue;
          const y = groundH(x, z, fac), s = (1.1 + R() * 0.9) * (1 + smooth(40, 140, Math.hypot(x, z)) * 1.2);
          const kind = fac === 'haven' ? (R() < 0.35 || y > 8 ? 'pine' : 'round') : (R() < 0.62 ? 'dead' : 'pine');
          trees[kind].push([x, y - 0.05, z, s, R() * 7, R()]);
        }
      }
      // scattered singles near the town
      for (let i = 0; i < 40; i++) {
        const x = (R() - 0.5) * 50, z = -R() * 30 + 8;
        if (z < -8 && Math.abs(x) < 14) continue;
        if (blocked(x, z)) continue;
        const kind = fac === 'haven' ? (R() < 0.3 ? 'pine' : 'round') : (R() < 0.75 ? 'dead' : 'pine');
        trees[kind].push([x, groundH(x, z, fac) - 0.05, z, 1 + R() * 0.8, R() * 7, R()]);
      }
      const geos = {
        round: (() => {
          const k = kit(3);
          k.cyl(0.07, 0.12, 0.7, 0, 0, 0, [0x7a5232, 0x9a6a3e], 6);
          const crown = fac === 'haven' ? [0x4c8a44, 0x98c070] : [0x8a9478, 0xb0b8a0];
          for (const [x, y, z, r] of [[0, 1.0, 0, 0.55], [0.28, 1.25, 0.08, 0.38], [-0.24, 1.2, -0.1, 0.4], [0.02, 1.45, -0.02, 0.33]])
            k.add(new T.IcosahedronGeometry(r, 0).translate(x, y, z), (px, py, pz, c) => c.set(crown[0]).lerp(col(crown[1]), clamp((py - 0.55) / 1.25 + px * 0.15 + pz * 0.25, 0, 1)));
          return k.body();
        })(),
        pine: (() => {
          const k = kit(4);
          k.cyl(0.06, 0.1, 0.5, 0, 0, 0, [0x6a4a2e, 0x8a5e38], 5);
          const pc = fac === 'haven' ? [0x3e6e50, 0x7eae78] : [0x6a6878, 0x9c98a8];
          for (const [y, r, h] of [[0.35, 0.55, 0.8], [0.75, 0.42, 0.7], [1.1, 0.3, 0.65]]) k.cone(r, h, 0, y, 0, pc, 7);
          return k.body();
        })(),
        dead: (() => {
          const k = kit(5);
          const tc = [0x8e7e88, 0xcabcc0];
          const limb = (a, b, r) => {
            const va = new V3(...a), vb = new V3(...b), len = va.distanceTo(vb);
            const g = new T.CylinderGeometry(r * 0.6, r, len, 5);
            g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new V3(0, 1, 0), vb.clone().sub(va).normalize()));
            g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
            k.add(g, tc);
          };
          limb([0, 0, 0], [0.05, 0.9, 0], 0.11); limb([0.05, 0.9, 0], [-0.08, 1.5, 0.05], 0.07);
          limb([0.05, 0.75, 0], [0.5, 1.15, 0.1], 0.05); limb([0.5, 1.15, 0.1], [0.75, 1.2, -0.05], 0.03);
          limb([0.0, 1.0, 0], [-0.45, 1.35, -0.15], 0.045); limb([-0.45, 1.35, -0.15], [-0.6, 1.62, -0.1], 0.03);
          limb([-0.08, 1.5, 0.05], [0.2, 1.8, 0.1], 0.03); limb([0.05, 0.55, 0], [0.1, 0.8, 0.4], 0.035);
          return k.body();
        })(),
      };
      const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new V3(), p = new V3(), tint = new T.Color();
      for (const kind of Object.keys(trees)) {
        const list = trees[kind];
        if (!list.length) continue;
        keep(geos[kind]);
        const im = new T.InstancedMesh(geos[kind], bodyMat, list.length);
        list.forEach(([x, y, z, s, rot, v], i) => {
          q.setFromAxisAngle(new V3(0, 1, 0), rot); p.set(x, y, z); sc.set(s, s * (0.9 + v * 0.25), s);
          im.setMatrixAt(i, m4.compose(p, q, sc));
          tint.setRGB(0.9 + v * 0.2, 0.92 + ((v * 7) % 1) * 0.16, 0.9 + ((v * 13) % 1) * 0.12);
          im.setColorAt(i, tint);
        });
        im.castShadow = true; im.receiveShadow = true;
        G.add(im);
      }
      for (const k of Object.keys(geos)) if (!trees[k].length) geos[k].dispose();
    }
    // ----- scenery: cottages, windmill / ruined tower, banners, graves, rocks
    const smokers = [];
    {
      const k = kit(fac === 'haven' ? 41 : 43);
      const at = (x, z) => groundH(x, z, fac);
      const H = fac === 'haven';
      const wall = H ? [0xe8dcc0, 0xfff6e0] : [0xa69cb4, 0xd0c6da];
      const roofC = H ? [0xc85a3a, 0xe8804a] : [0x7a5c96, 0xa486c0];
      const cottage = (x, z, ry, s = 1) => {
        const y = at(x, z) - 0.1;
        const tr = (dx, dz) => [x + (dx * Math.cos(ry) + dz * Math.sin(ry)) * s, z + (-dx * Math.sin(ry) + dz * Math.cos(ry)) * s];
        k.box(1.3 * s, 0.85 * s, 0.95 * s, x, y, z, wall, ry);
        k.roof(1.45 * s, 0.7 * s, 1.15 * s, x, y + 0.85 * s, z, roofC, ry);
        const [cx2, cz2] = tr(0.38, -0.15);
        k.box(0.2 * s, 0.6 * s, 0.2 * s, cx2, y + 0.95 * s, cz2, H ? [0x9a6a5a, 0xb88a70] : [0x8a8098, 0xb0a6bc], ry);
        const [dx2, dz2] = tr(-0.15, 0.48);
        k.box(0.28 * s, 0.48 * s, 0.04 * s, dx2, y, dz2, H ? 0x8a5a32 : 0x7a5a78, ry);
        const [wx, wz] = tr(0.3, 0.48);
        k.box(0.22 * s, 0.22 * s, 0.04 * s, wx, y + 0.4 * s, wz, H ? 0xffd070 : 0x9affc0, ry, true);
        smokers.push([cx2, y + 1.6 * s, cz2]);
      };
      if (H) {
        cottage(12, -8, -0.4); cottage(15, -4.5, -0.8, 0.85); cottage(-12.5, 3.5, 0.6, 0.9); cottage(-17, -5, 0.3, 0.8);
        // windmill on the left hill
        const wx = -14.5, wz = -9, wy = at(wx, wz) - 0.2;
        k.add(new T.CylinderGeometry(0.55, 0.85, 3, 8).translate(wx, wy + 1.5, wz), [0xe6dcc8, 0xfff8ea]);
        k.add(new T.ConeGeometry(0.75, 1.0, 8).translate(wx, wy + 3.5, wz), [0xb8502e, 0xe07848]);
        k.box(0.35, 0.6, 0.05, wx, wy, wz + 0.78, 0x7a5030);
        const blades = kit(7);
        blades.add(new T.CylinderGeometry(0.12, 0.12, 0.3, 8).rotateX(Math.PI / 2), 0x6a4a30);
        for (let b = 0; b < 4; b++) {
          const a = (b / 4) * Math.PI * 2;
          blades.add(new T.BoxGeometry(0.08, 1.9, 0.05).translate(0, 1.0, 0.05).rotateZ(a), 0x8a6040);
          blades.add(new T.BoxGeometry(0.48, 1.55, 0.02).translate(0.26, 1.15, 0.08).rotateZ(a), [0xf2ead8, 0xfffaf0]);
        }
        const bm = new T.Mesh(keep(blades.body()), sceneryMat); bm.castShadow = true;
        bm.position.set(wx, wy + 2.85, wz + 0.85); bm.rotation.y = 0.25;
        G.add(bm);
        env.updaters.push((dt) => { bm.rotation.z -= dt * 0.7; });
        // rocks
        for (let i = 0; i < 14; i++) { const x = (R() - 0.5) * 40, z = -R() * 20 + 6; if (flatD(x, z) < 1.1 || (z > 2 && Math.abs(x) < 9)) continue; k.add(new T.IcosahedronGeometry(0.3 + R() * 0.5, 0).scale(1, 0.6, 1).translate(x, at(x, z), z), [0x9a948a, 0xd0ccc0]); }
        // hay bales by the fields
        for (const [x, z] of [[-16, -16], [-18, -19], [-21, -15]]) k.add(new T.CylinderGeometry(0.4, 0.4, 0.5, 10).rotateZ(Math.PI / 2).translate(x, at(x, z) + 0.35, z), [0xd8b050, 0xf0d070]);
      } else {
        cottage(12.5, -8, -0.4); cottage(-12, 3, 0.5, 0.9);
        // ruined watch tower with a green-lit window
        const wx = -14.5, wz = -9, wy = at(wx, wz) - 0.3;
        k.add(new T.CylinderGeometry(0.85, 1.05, 3.4, 9).translate(wx, wy + 1.7, wz), [0x968ca8, 0xc4bad2]);
        for (let i = 0; i < 9; i += 1) { if (i === 3 || i === 6) continue; const a = (i / 9) * Math.PI * 2; k.box(0.4, 0.3 + R() * 0.6, 0.3, wx + Math.sin(a) * 0.8, wy + 3.4, wz + Math.cos(a) * 0.8, [0xaaa0ba, 0xccc2d8], a); }
        k.box(0.25, 0.42, 0.05, wx, wy + 2.1, wz + 0.98, 0x9affb8, 0, true);
        k.box(0.22, 0.34, 0.05, wx + 0.5, wy + 1.0, wz + 0.86, 0x9affb8, 0.5, true);
        // graveyards
        const graves = [[-9, 8, 3], [9, 9, 3], [-17, -2, 3], [16, -2, 3], [7, -11, 2.5], [-7, -11, 2.5]];
        for (const [gx, gz, gr] of graves) for (let i = 0; i < 9; i++) {
          const x = gx + (R() - 0.5) * gr * 2, z = gz + (R() - 0.5) * gr * 1.4;
          if (flatD(x, z) < 1.05 || riverDist(x, z) < 4) continue;
          const y = at(x, z), ry = (R() - 0.5) * 0.6, lean = (R() - 0.5) * 0.3;
          if (R() < 0.7) {
            const g = new T.BoxGeometry(0.34, 0.5, 0.1).translate(0, 0.25, 0); const top = new T.CylinderGeometry(0.17, 0.17, 0.1, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.5, 0);
            for (const q of [g, top]) k.add(q.rotateZ(lean).rotateY(ry).translate(x, y - 0.12, z), [0xa8a2b8, 0xe0dae8]);
          } else {
            k.add(new T.BoxGeometry(0.08, 0.78, 0.08).translate(0, 0.35, 0).rotateZ(lean).rotateY(ry).translate(x, y - 0.12, z), [0xa8a2b8, 0xd8d2e2]);
            k.add(new T.BoxGeometry(0.38, 0.08, 0.08).translate(0, 0.5, 0).rotateZ(lean).rotateY(ry).translate(x, y - 0.12, z), [0xc0bacc, 0xd8d2e2]);
          }
        }
        // a broken bone fence along the foreground, every post sunk to the lowest ground under it
        const lowAt = (x, z, r = 0.25) => Math.min(at(x, z), at(x - r, z - r), at(x + r, z - r), at(x - r, z + r), at(x + r, z + r));
        let prev = null;
        for (let i = 0; i < 16; i++) {
          const x = -8 + i * 1.1 + (R() - 0.5) * 0.2, z = 7.6 + Math.sin(i) * 0.3;
          if (Math.abs(x) < 1.2) { prev = null; continue; } // gap for the road
          if (R() < 0.2) { prev = null; continue; }
          const y = lowAt(x, z) - 0.18, ph = 0.75 + R() * 0.3;
          k.box(0.11, ph, 0.11, x, y, z, [0xb8ac9c, 0xf0e8d8], R() * 0.3);
          k.add(new T.SphereGeometry(0.08, 6, 4).scale(1, 0.85, 1).translate(x, y + ph + 0.05, z), [0xe8e0d0, 0xfff8ec]);
          if (prev) { const [px2, py2, pz2] = prev, L2 = Math.hypot(x - px2, z - pz2), ang = Math.atan2(z - pz2, x - px2);
            for (const hh of [0.38, 0.62]) k.add(new T.BoxGeometry(L2, 0.06, 0.05).rotateY(-ang).translate((x + px2) / 2, (y + py2) / 2 + hh, (z + pz2) / 2), [0xc8bcaa, 0xe8dece]); }
          prev = [x, y, z];
        }
        // lanterns: bone posts with a skull and a green witch-light, along the road and round the plaza
        env.lanterns = [];
        for (const [x, z, s2] of [[-1.0, -0.2, 0.9], [1.0, -0.2, 0.9], [-0.75, 5.0, 1], [0.75, 5.0, 1], [-6.3, -1.0, 1], [6.3, -1.0, 1], [-4.9, 4.6, 0.95], [4.9, 4.6, 0.95]]) {
          const y = lowAt(x, z, 0.15) - 0.1, h = 1.45 * s2;
          k.cyl(0.05, 0.08, h, x, y, z, [0xb4a898, 0xf0e6d4], 6);
          k.cyl(0.13, 0.16, 0.12, x, y, z, [0x9a8ea8, 0xb8aec4], 7);
          k.add(new T.SphereGeometry(0.11, 7, 5).scale(1, 0.9, 1.05).translate(x, y + h + 0.06, z), [0xe8dfcc, 0xfffaf0]);
          k.box(0.05, 0.035, 0.02, x - 0.045, y + h + 0.06, z + 0.105, 0x6a5a7a); k.box(0.05, 0.035, 0.02, x + 0.045, y + h + 0.06, z + 0.105, 0x6a5a7a);
          // crossbar + hanging lantern
          const sx = x < 0 ? 1 : -1;
          k.box(0.32, 0.04, 0.04, x + sx * 0.14, y + h - 0.18, z, [0xc8bcaa, 0xe8dece]);
          k.box(0.17, 0.05, 0.17, x + sx * 0.28, y + h - 0.3, z, 0x8a7e96);
          k.box(0.12, 0.2, 0.12, x + sx * 0.28, y + h - 0.5, z, 0x9affc0, 0, true);
          k.box(0.17, 0.04, 0.17, x + sx * 0.28, y + h - 0.54, z, 0x8a7e96);
          env.lanterns.push([x + sx * 0.28, y + h - 0.4, z]);
        }
        for (let i = 0; i < 14; i++) { const x = (R() - 0.5) * 40, z = -R() * 20 + 6; if (flatD(x, z) < 1.1 || (z > 2 && Math.abs(x) < 9)) continue; k.add(new T.IcosahedronGeometry(0.3 + R() * 0.5, 0).scale(1, 0.6, 1).translate(x, at(x, z), z), [0x9c96ac, 0xc8c2d6]); }
      }
      // banner poles along the main road and by the lots
      const flags = kit(9), wave = [];
      const banner = (x, z, h = 2.6, side = 1) => {
        const y = at(x, z);
        k.cyl(0.04, 0.05, h, x, y, z, H ? [0xb08a50, 0xe8c070] : [0xb0a4a0, 0xe8dccc], 6);
        k.add(new T.SphereGeometry(0.08, 6, 4).translate(x, y + h + 0.04, z), H ? 0xf8d050 : 0xd8d0c0);
        // cloth: a strip of quads hanging from the top, extending along +x
        const L = 0.75, Hh = 1.0, nx = 6, ny = 3;
        const g = new T.PlaneGeometry(L, Hh, nx, ny).translate(L / 2, -Hh / 2, 0);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const u = p.getX(i) / L; p.setY(i, p.getY(i) - u * u * 0.25 + (u > 0.9 ? Math.abs(p.getY(i) + Hh / 2) * 0.6 * (u - 0.9) * 10 * 0.3 : 0)); }
        g.scale(side, 1, 1).translate(x + 0.04 * side, y + h - 0.05, z);
        const ng = paintGeo(g, (px, py, pz, c) => { const u = Math.abs(px - x) / L; c.set(P.banner[0]); if (Math.abs(py - (y + h - 0.5)) < 0.1 || u > 0.85) c.set(P.banner[1]); });
        const n = ng.attributes.position.count, wv = new Float32Array(n), ph = new Float32Array(n);
        for (let i = 0; i < n; i++) { wv[i] = Math.abs(ng.attributes.position.getX(i) - x) / L; ph[i] = x * 1.7 + z; }
        ng.setAttribute('aWave', new T.BufferAttribute(wv, 1)); ng.setAttribute('aPhase', new T.BufferAttribute(ph, 1));
        wave.push(ng);
      };
      banner(-6.3, 1.7, 2.4, -1); banner(6.3, 1.7, 2.4, 1);
      banner(-5.7, 4.0, 2.2, -1); banner(5.7, 4.0, 2.2, 1);
      // merge flags with wave attributes
      {
        let n = 0; for (const g of wave) n += g.attributes.position.count;
        const pos = new Float32Array(n * 3), cc = new Float32Array(n * 3), wv = new Float32Array(n), ph = new Float32Array(n);
        let o = 0;
        for (const g of wave) { pos.set(g.attributes.position.array, o * 3); cc.set(g.attributes.color.array, o * 3); wv.set(g.attributes.aWave.array, o); ph.set(g.attributes.aPhase.array, o); o += g.attributes.position.count; g.dispose(); }
        const geo = keep(new T.BufferGeometry());
        geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(cc, 3));
        geo.setAttribute('aWave', new T.BufferAttribute(wv, 1)); geo.setAttribute('aPhase', new T.BufferAttribute(ph, 1));
        geo.computeVertexNormals();
        const fm = keep(new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: T.DoubleSide, roughness: 0.9 }));
        fm.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = uTime;
          sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute float aWave; attribute float aPhase; uniform float uTime;\nvoid main() {')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
float wv = sin(uTime * 3.2 - aWave * 4.0 + aPhase) * 0.16 + sin(uTime * 5.1 - aWave * 7.0 + aPhase * 1.3) * 0.05;
transformed.z += wv * aWave; transformed.y += abs(wv) * aWave * 0.15;`);
        };
        fm.customProgramCacheKey = () => 'townFlag1';
        const fmesh = new T.Mesh(geo, fm); fmesh.castShadow = true;
        G.add(fmesh);
      }
      flags.B.length = 0;
      const sm = new T.Mesh(keep(k.body()), sceneryMat); sm.castShadow = true; sm.receiveShadow = true;
      G.add(sm);
      const gg = k.glow(); if (gg) G.add(new T.Mesh(keep(gg), glowMat));
    }
    // ----- ambient life: chimney smoke, wisps, mist, birds / bats
    {
      let acc = 0;
      const smokeC = col(P.smoke);
      env.updaters.push((dt) => {
        acc += dt;
        while (acc > 0.18) {
          acc -= 0.18;
          const s = smokers[(Math.random() * smokers.length) | 0];
          if (s) soft.spawn({ x: s[0] + (Math.random() - 0.5) * 0.1, y: s[1], z: s[2], vy: 0.45, vx: 0.1, wind: 0.18, drag: 0.2, s0: 0.35, s1: 1.6, a: H() ? 0.5 : 0.45, life: 3.5, c: smokeC });
        }
      });
      const H = () => fac === 'haven';
      if (fac === 'necro') {
        // green will-o'-wisps drifting over the moor and graves
        const wc = col(0x8affb0);
        let wacc = 0;
        env.updaters.push((dt) => {
          wacc += dt;
          while (wacc > 0.25) {
            wacc -= 0.25;
            const a = Math.random() * Math.PI * 2, d = 7 + Math.random() * 14;
            const x = Math.sin(a) * d * 1.2, z = -2 + Math.cos(a) * d * 0.8;
            if (z > 3 && Math.abs(x) < 7) continue;
            glowP.spawn({ x, y: groundH(x, z, 'necro') + 0.3 + Math.random() * 1.2, z, vx: (Math.random() - 0.5) * 0.4, vy: 0.12, vz: (Math.random() - 0.5) * 0.4, drag: 0.1, s0: 0.25, s1: 0.2, a: 0.9, life: 4 + Math.random() * 3, c: wc, twinkle: true });
          }
        });
        // lantern halos and rising motes
        const haloMat = keep(new T.SpriteMaterial({ map: softTex, color: col(0x6effa8), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.5, fog: false }));
        const halos = (env.lanterns || []).map(([x, y, z], i) => { const h = new T.Sprite(haloMat); h.position.set(x, y, z + 0.02); h.scale.setScalar(0.8); h.renderOrder = 4; G.add(h); return [h, i * 1.7]; });
        let lacc = 0;
        const lc = col(0xb0ffd0);
        env.updaters.push((dt, t) => {
          for (const [h, ph] of halos) h.scale.setScalar(0.75 + 0.08 * Math.sin(t * 3.1 + ph) + 0.04 * Math.sin(t * 7.3 + ph * 2));
          lacc += dt;
          while (lacc > 0.3) { lacc -= 0.3; const L = env.lanterns[(Math.random() * env.lanterns.length) | 0]; if (L) glowP.spawn({ x: L[0] + (Math.random() - 0.5) * 0.2, y: L[1], z: L[2], vx: (Math.random() - 0.5) * 0.15, vy: 0.25 + Math.random() * 0.2, drag: 0.4, s0: 0.1, s1: 0.04, a: 0.9, life: 1.8 + Math.random(), c: lc, twinkle: true }); }
        });
        // low mist banks
        const mists = [];
        for (let i = 0; i < 16; i++) {
          const m = keep(new T.SpriteMaterial({ map: mistTex, color: col(0xf4e8ff), transparent: true, depthWrite: false, opacity: 0.3 }));
          const s = new T.Sprite(m);
          let x, z;
          do { x = (R() - 0.5) * 80; z = -R() * 50 - 2; } while (Math.abs(x) < 11 && z > -10);
          s.position.set(x, groundH(x, z, fac) + 0.9 + R() * 0.6, z);
          const w = 10 + R() * 14; s.scale.set(w, w * 0.32, 1);
          mists.push({ s, sp: 0.15 + R() * 0.25, x0: x });
          G.add(s);
        }
        env.updaters.push((dt, t) => { for (const m of mists) { m.s.position.x = m.x0 + Math.sin(t * m.sp * 0.3 + m.x0) * 2.5; m.s.material.opacity = 0.24 + 0.08 * Math.sin(t * 0.4 + m.x0); } });
      } else {
        // butterflies / pollen sparkles over the meadow
        const pc = col(0xfff4c0);
        let pacc = 0;
        env.updaters.push((dt) => {
          pacc += dt;
          while (pacc > 0.35) { pacc -= 0.35; const x = (Math.random() - 0.5) * 24, z = (Math.random() - 0.5) * 18 - 2; glowP.spawn({ x, y: 0.3 + Math.random() * 1.5, z, vx: (Math.random() - 0.5) * 0.3, vy: 0.08, drag: 0.1, s0: 0.08, s1: 0.06, a: 0.7, life: 3, c: pc, twinkle: true }); }
        });
      }
      // birds (haven) / bats (necro): instanced wings, flapped on the CPU
      const NB = fac === 'haven' ? 9 : 12;
      const wing = new T.BufferGeometry();
      wing.setAttribute('position', new T.Float32BufferAttribute(fac === 'haven'
        ? [0, 0, 0.12, 0.62, 0, -0.06, 0, 0, -0.14, 0.62, 0, -0.06, 0.32, 0, 0.02, 0, 0, 0.12]
        : [0, 0, 0.1, 0.5, 0.0, 0.05, 0.25, 0, -0.08, 0.5, 0, 0.05, 0.42, 0, -0.14, 0.25, 0, -0.08, 0.25, 0, -0.08, 0, 0, -0.1, 0, 0, 0.1], 3));
      wing.computeVertexNormals(); keep(wing);
      const wm = keep(new T.MeshBasicMaterial({ color: col(P.birds), side: T.DoubleSide }));
      const im = new T.InstancedMesh(wing, wm, NB * 2); im.frustumCulled = false;
      G.add(im);
      const birds = Array.from({ length: NB }, (_, i) => ({ cx: (R() - 0.5) * (fac === 'haven' ? 26 : 30), cz: -10 - R() * 30, r: 5 + R() * 9, h: (fac === 'haven' ? 14 : 12) + R() * 10, sp: (0.18 + R() * 0.15) * (R() < 0.5 ? -1 : 1) * (fac === 'necro' ? 1.8 : 1), ph: R() * 7, s: fac === 'haven' ? 0.9 + R() * 0.4 : 0.7 + R() * 0.3 }));
      const m4 = new T.Matrix4(), q = new T.Quaternion(), qa = new T.Quaternion(), e = new T.Euler(), p = new V3(), sc = new V3();
      env.updaters.push((dt, t) => {
        birds.forEach((b, i) => {
          const a = b.ph + t * b.sp;
          p.set(b.cx + Math.cos(a) * b.r, b.h + Math.sin(t * 0.7 + b.ph) * 0.8 + (fac === 'necro' ? Math.sin(t * 5 + b.ph) * 0.3 : 0), b.cz + Math.sin(a) * b.r * 0.6);
          const heading = Math.atan2(-Math.sin(a) * b.sp, Math.cos(a) * b.sp * 0.6) ;
          const flapping = fac === 'necro' || Math.sin(t * 0.5 + b.ph) > -0.2;
          const flap = flapping ? Math.sin(t * (fac === 'haven' ? 7 : 13) + b.ph * 3) * 0.65 : 0.12;
          q.setFromEuler(e.set(0, heading, -Math.sign(b.sp) * 0.25));
          for (let w = 0; w < 2; w++) {
            qa.setFromEuler(e.set(0, 0, (w ? -1 : 1) * flap)).premultiply(q);
            sc.set(w ? -b.s : b.s, b.s, b.s);
            im.setMatrixAt(i * 2 + w, m4.compose(p, qa, sc));
          }
        });
        im.instanceMatrix.needsUpdate = true;
      });
    }
    return env;
  }

  // ---------------------------------------------------------------- buildings
  const geoCache = new Map(); // fac:id -> { body, glow }
  function normalise(m, id) {
    // guard against models built at the wrong scale (e.g. map-sized towns)
    if (!m.body) return { m, s: 1 };
    m.body.computeBoundingBox();
    const bb = m.body.boundingBox, w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), d = DIMS[id] || [2, 2, 2];
    const want = Math.max(d[0], d[1]), r = w / want;
    return { m, s: r < 0.55 || r > 1.6 ? 1 / r : 1 };
  }
  function placeholder(fac, id) {
    const k = kit(id.length * 31 + id.charCodeAt(id.length - 1));
    const [w, d, h] = DIMS[id] || [2, 2, 2];
    const H = fac === 'haven';
    const wall = H ? [0xd8d0c4, 0xfaf6ee] : [0x7a7090, 0xa49ab8];
    const roof = H ? [0x2a5ad8, 0x5a8af0] : [0x4a3a5a, 0x6e5a80];
    const trim = H ? 0xf0c040 : 0x8affb0;
    if (id === 'fort') {
      k.box(w, h * 0.7, d * 0.7, 0, 0, 0, wall);
      for (let i = 0; i < 15; i++) k.box(0.32, 0.3, d * 0.72, -w / 2 + 0.3 + i * ((w - 0.6) / 14), h * 0.7, 0, wall);
      for (const x of [-w / 2, w / 2, -1.1, 1.1]) { k.cyl(0.55, 0.6, h * (Math.abs(x) < 2 ? 1.05 : 0.95), x, 0, 0, wall, 8); k.cone(0.7, 0.9, x, h * (Math.abs(x) < 2 ? 1.05 : 0.95), 0, roof, 8); }
      k.box(1.2, 1.3, 0.1, 0, 0, d * 0.36, H ? 0x7a5030 : 0x3e3248);
    } else if (/^mage/.test(id)) {
      k.cyl(w * 0.36, w * 0.45, h * 0.72, 0, 0, 0, wall, 8);
      k.cone(w * 0.48, h * 0.3, 0, h * 0.7, 0, roof, 8);
      k.box(0.18, 0.3, 0.05, 0, h * 0.45, w * 0.4, trim, 0, true);
    } else {
      const bh = h * 0.55;
      k.box(w * 0.82, bh, d * 0.7, 0, 0, 0, wall);
      k.roof(w * 0.92, h - bh, d * 0.85, 0, bh, 0, roof);
      k.box(w * 0.22, bh * 0.55, 0.05, 0, 0, d * 0.355, H ? 0x7a5030 : 0x3e3248);
      k.box(w * 0.16, w * 0.14, 0.05, -w * 0.25, bh * 0.55, d * 0.355, trim, 0, true);
      k.box(w * 0.16, w * 0.14, 0.05, w * 0.25, bh * 0.55, d * 0.355, trim, 0, true);
      if (/^u/.test(id) || id === 'hall3' || id === 'hall2') { k.cyl(0.03, 0.03, 0.7, 0, h - 0.05, 0, 0x8a7050, 5); k.box(0.4, 0.25, 0.02, 0.2, h + 0.35, 0, H ? 0x3a6ae0 : 0xb02040); }
    }
    return { body: k.body(), glow: k.glow() };
  }
  function buildingModel(fac, id) {
    const key = fac + ':' + id;
    if (geoCache.has(key)) return geoCache.get(key);
    let m = null;
    const fn = MODEL_FN[fac];
    if (fn) { try { m = fn(id); } catch (e) { console.warn('town_view: model failed', fac, id, e); m = null; } }
    if (!m || !m.body) m = placeholder(fac, id);
    const out = normalise(m, id);
    geoCache.set(key, out);
    return out;
  }

  const town = new T.Group(); town.name = 'buildings'; scene.add(town);
  const slots = {}; // slotKey -> { id, group, anim }
  const pickables = [];
  let cur = { fac: null, name: null };
  let activeEnv = null;

  const inkMat = MAT?.makeInkHullMaterial ? keep(MAT.makeInkHullMaterial(T, { width: 0.0016, dark: 0.26, center: 1.0, push: 0.0006 })) : null;
  const blobMat = MAT?.makeBlobShadowMaterial ? keep(MAT.makeBlobShadowMaterial(T, { opacity: 0.32 })) : null;
  const blobGeo = blobMat ? keep(MAT.blobShadowGeometry(T)) : null;
  function makeBuilding(fac, id, k) {
    const { m, s } = buildingModel(fac, id);
    const g = meshOf(m, true, GLOW_SCALE[fac + ':' + id] ?? GLOW_SCALE[id] ?? 1);
    const sp = SLOT_POS[k];
    const inner = new T.Group(); inner.add(...g.children);
    inner.scale.setScalar(s * sp.s);
    g.add(inner);
    g.position.set(sp.x, 0, sp.z); g.rotation.y = sp.ry;
    g.userData = { id, slot: k, h: (DIMS[id] || [0, 0, 3])[2] * s * sp.s };
    for (const c of inner.children) { c.userData.bid = id; if (c.material === bodyMat) pickables.push(c); }
    // round 3 figure/ground: a crisp painted ink outline + a soft contact shadow so each building sits ON the ground
    if (inkMat) for (const c of [...inner.children]) if (c.material === bodyMat) { const h = new T.Mesh(c.geometry, inkMat); h.castShadow = h.receiveShadow = false; h.userData.ink = true; inner.add(h); }
    if (blobMat) {
      const d = SLOT_DIM(k) || [2, 2, 2], bl = new T.Mesh(blobGeo, blobMat);
      bl.scale.set(d[0] * (k === 'fort' ? 0.58 : 0.7), 1, d[1] * (k === 'fort' ? 0.9 : 0.7)); bl.position.y = 0.03; bl.renderOrder = 2; bl.userData.blob = true;
      g.add(bl);
    }
    return g;
  }
  function removeBuilding(g) {
    town.remove(g);
    for (const c of g.children[0]?.children || []) { const i = pickables.indexOf(c); if (i >= 0) pickables.splice(i, 1); }
  }
  function dustBurst(k, n, strong = 1) {
    const sp = SLOT_POS[k], d = SLOT_DIM(k), dc = col(PAL[cur.fac]?.dust ?? 0xd8c8a0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rx = d[0] * 0.55, rz = d[1] * 0.55;
      const ex = Math.cos(a), ez = Math.sin(a);
      const x = sp.x + ex * rx * (k === 'fort' ? 1 : 0.9 + Math.random() * 0.2), z = sp.z + ez * rz;
      soft.spawn({ x, y: 0.1 + Math.random() * 0.3, z, vx: ex * (1 + Math.random() * 2) * strong, vy: 0.4 + Math.random() * 0.9, vz: ez * (1 + Math.random() * 2) * strong, drag: 2.2, s0: 0.5 + Math.random() * 0.4, s1: 1.4 + Math.random() * 1.2, a: 0.75, life: 1.2 + Math.random() * 0.9, c: dc });
    }
  }
  function sparkle(k) {
    const sp = SLOT_POS[k], d = SLOT_DIM(k), gc = col(0xffe08a);
    for (let i = 0; i < 26; i++) glowP.spawn({ x: sp.x + (Math.random() - 0.5) * d[0], y: 0.4 + Math.random() * d[2], z: sp.z + (Math.random() - 0.5) * d[1], vy: 0.6 + Math.random(), drag: 1, s0: 0.22, s1: 0.05, a: 1, life: 1 + Math.random(), c: gc, twinkle: true });
  }

  function applyEnv(fac) {
    const P = PAL[fac];
    if (!envs[fac]) envs[fac] = buildEnv(fac);
    for (const f of Object.keys(envs)) { if (envs[f].group.parent && f !== fac) scene.remove(envs[f].group); }
    if (!envs[fac].group.parent) scene.add(envs[fac].group);
    activeEnv = envs[fac];
    sun.color.set(P.sun); sun.intensity = P.sunI;
    sun.position.copy(new V3(...P.sunDir).normalize().multiplyScalar(45)).add(sun.target.position);
    hemi.color.set(P.hemiSky); hemi.groundColor.set(P.hemiGround); hemi.intensity = P.hemiI;
    amb.color.set(P.amb); amb.intensity = P.ambI;
    scene.fog.color.set(P.fog); scene.fog.near = P.fogNear; scene.fog.far = P.fogFar;
    scene.background = col(P.horizon);
    // per-faction tuning of the town's own painted materials (the shared building material is left alone)
    for (const [m, o] of [[groundMat, P.groundTune], [sceneryMat, P.sceneryTune]]) {
      const u = m.userData?.uniforms; if (!u) continue;
      u.uShade.value.set(o?.shade ?? 0xb4a8f0); u.uLift.value = o?.lift ?? 0.24; u.uToe.value = o?.toe ?? 0.45; u.uDetail.value = o?.detail ?? m.userData.baseDetail;
    }
  }

  function setTown({ fac, built = [], name = '' } = {}) {
    if (!PAL[fac]) fac = 'haven';
    const same = cur.fac === fac && cur.name === name;
    if (cur.fac !== fac) applyEnv(fac);
    const want = resolveSlots(built);
    for (const k of Object.keys(SLOT_POS)) {
      const id = want[k] || null, s = slots[k];
      if ((s?.id || null) === id && cur.fac === fac) continue;
      const animate = same && !!id;
      if (s) {
        if (animate || (same && !id)) { s.group.userData.anim = { t: 0, dur: 0.7, sink: true }; sinking.push(s.group); }
        else removeBuilding(s.group);
        delete slots[k];
      }
      if (!id) continue;
      const g = makeBuilding(fac, id, k);
      town.add(g);
      slots[k] = { id, group: g };
      if (animate) { g.userData.anim = { t: 0, dur: 1.9, delay: s ? 0.45 : 0 }; g.position.y = -g.userData.h * 1.05; dustBurst(k, 18, 0.8); }
    }
    activeEnv?.drawFloor?.(Object.keys(want));
    const snap = !same;
    cur = { fac, name };
    setFocus(Object.keys(want).map((k) => [k, want[k]]), snap);
    if (hl.slot) highlight(hl.id);
  }
  const sinking = [];

  // ---------------------------------------------------------------- highlight
  const ringMat = keep(new T.MeshBasicMaterial({ color: col(0xffd860), transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ringMat.color.multiplyScalar(1.6);
  const ring = new T.Mesh(keep(new T.RingGeometry(0.86, 1, 56).rotateX(-Math.PI / 2)), ringMat);
  ring.renderOrder = 3; ring.visible = false;
  const ghostMat = keep(new T.MeshBasicMaterial({ color: col(0xffe7a0), transparent: true, opacity: 0.18, depthWrite: false }));
  const ghost = new T.Mesh(keep(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), ghostMat);
  ghost.visible = false;
  const markMat = keep(new T.MeshBasicMaterial({ color: col(0xffd040), toneMapped: false }));
  markMat.color.multiplyScalar(1.5);
  const marker = new T.Mesh(keep(new T.ConeGeometry(0.32, 0.62, 4).rotateX(Math.PI).translate(0, 0.31, 0)), markMat);
  marker.visible = false;
  scene.add(ring, ghost, marker);
  const hl = { id: null, slot: null, t: 0 };
  function highlight(id) {
    const k = id ? slotOf(id) : null;
    if (!k || !SLOT_POS[k]) { hl.id = hl.slot = null; ring.visible = ghost.visible = marker.visible = false; if (focus.extra) { focus.extra = null; aim(); } return; }
    hl.id = id; hl.slot = k;
    const sp = SLOT_POS[k], d = SLOT_DIM(k);
    ring.position.set(sp.x, 0.06, sp.z); ring.rotation.y = sp.ry;
    ring.scale.set(d[0] * 0.66, 1, d[1] * (k === 'fort' ? 1.4 : 0.66));
    ring.visible = true;
    ghost.visible = !slots[k];
    if (ghost.visible) { ghost.position.set(sp.x, 0, sp.z); ghost.rotation.y = sp.ry; ghost.scale.set(d[0] * 0.8, SLOT_MAXH[k] * 0.8, d[1] * 0.8); }
    // keep a highlighted empty lot in view
    const ex = ghost.visible ? [sp.x, sp.z, d[0], d[1], SLOT_MAXH[k]] : null;
    if (String(ex) !== String(focus.extra)) { focus.extra = ex; if (shot.cur) aim(); }
    let top = SLOT_MAXH[k] * 0.8;
    if (slots[k]) { const g = slots[k].group, y = g.position.y; g.position.y = 0; box.setFromObject(g); g.position.y = y; if (isFinite(box.max.y)) top = box.max.y; }
    hl.top = top + 0.35;
    marker.position.set(sp.x, hl.top, k === 'fort' ? sp.z + 0.5 : sp.z); marker.visible = true;
  }

  // ---------------------------------------------------------------- camera framing
  // The camera fits the BUILT buildings (plus a minimum area round the hall), so a young town
  // fills the screen above the bottom sheet and the view eases outwards as the town grows.
  const insets = { top: 0, bottom: 0.45, left: 0, right: 0 };
  const view = { w: 1, h: 1 };
  const PITCH = 0.06; // the view axis is nearly level; an off-axis frustum keeps verticals upright
  const MIN_BOX = [-2.9, 2.9, -3.9, 3.8]; // x0, x1, z0, z1 (hall + front lots)
  const focus = { boxes: [], extra: null };
  const shot = { cur: null, want: null };
  function setInsets(o = {}) {
    let ch = false;
    for (const k of Object.keys(o)) if (insets[k] !== o[k]) { insets[k] = o[k]; ch = true; }
    if (ch) { aim(); if (!shot.cur) shot.cur = cloneShot(shot.want); applyShot(); }
  }
  const px = (v, total) => (v <= 1 ? v * total : v);
  // boxes [x, z, w, d, h] for the built slots
  function setFocus(pairs, snap) {
    const boxes = [];
    for (const [k, id] of pairs) {
      const sp = SLOT_POS[k]; if (!sp) continue;
      const d = DIMS[id] || SLOT_DIM(k);
      boxes.push([sp.x, sp.z, d[0], d[1], Math.min(SLOT_MAXH[k] * 1.05, d[2] * 1.05)]);
    }
    focus.boxes = boxes;
    aim();
    if (snap || !shot.cur) shot.cur = cloneShot(shot.want);
    applyShot();
  }
  const cloneShot = (s) => ({ pos: s.pos.clone(), L: s.L, R: s.R, T: s.T, B: s.B });
  // compute the wanted shot: camera position + off-axis frustum (tangents)
  function aim() {
    const { w, h } = view;
    const vw = Math.max(1, w - px(insets.left, w) - px(insets.right, w)), vh = Math.max(1, h - px(insets.top, h) - px(insets.bottom, h));
    const A = vw / vh;
    let [bx0, bx1, bz0, bz1] = MIN_BOX;
    const fb = focus.extra ? [...focus.boxes, focus.extra] : focus.boxes;
    for (const [x, z, bw, bd] of fb) { bx0 = Math.min(bx0, x - bw / 2); bx1 = Math.max(bx1, x + bw / 2); bz0 = Math.min(bz0, z - bd / 2); bz1 = Math.max(bz1, z + bd / 2); }
    // portrait screens look down more steeply so the town's depth fills the tall view
    const elev = lerp(0.4, 0.3, smooth(0.8, 1.9, A));
    const span = Math.max(bx1 - bx0, (bz1 - bz0) * 0.9);
    const dist = clamp(span * 1.7, 11.5, 23);
    const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    const pos = new V3(cx, 0.9 + Math.sin(elev) * dist, cz + Math.cos(elev) * dist);
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(pos.x, pos.y - Math.sin(PITCH), pos.z - Math.cos(PITCH));
    camera.updateMatrixWorld(true);
    const inv = camera.matrixWorldInverse, v = new V3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const boxes = [[0, 0, 0, 0, 0], ...fb];
    boxes[0] = [cx, cz, bx1 - bx0, bz1 - bz0, 1.2];
    for (const [x, z, bw, bd, bh] of boxes) {
      for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) for (const sy of [0, 1]) {
        v.set(x + sx * bw, sy * bh, z + sz * bd).applyMatrix4(inv);
        const tx = v.x / -v.z, ty = v.y / -v.z;
        x0 = Math.min(x0, tx); x1 = Math.max(x1, tx); y0 = Math.min(y0, ty); y1 = Math.max(y1, ty);
      }
    }
    const horizon = Math.tan(PITCH);
    const padX = (x1 - x0) * 0.03, padY = (y1 - y0) * 0.05;
    x0 -= padX; x1 += padX;
    let yb = y0 - padY, yt = y1 + padY * 1.4;
    if ((x1 - x0) / (yt - yb) > A) {
      // too wide for the view: extra height, mostly to the sky side (but not far past the horizon), the rest to the foreground
      let extra = (x1 - x0) / A - (yt - yb);
      const up = Math.min(extra * 0.72, Math.max(0, horizon + 0.3 - yt));
      yt += up; extra -= up; yb -= extra;
    } else {
      // too tall: widen symmetrically, capped on very wide screens (then show more sky and foreground)
      const need = (yt - yb) * A - (x1 - x0), cap = Math.max(0, 2.1 - (x1 - x0));
      const add = Math.min(need, cap); x0 -= add / 2; x1 += add / 2;
      const rest = (x1 - x0) / A - (yt - yb); if (rest > 0) { yt += rest * 0.5; yb -= rest * 0.5; }
    }
    const k = vh / (yt - yb); // px per tan unit
    shot.want = { pos, L: x0 - px(insets.left, w) / k, R: x1 + px(insets.right, w) / k, T: yt + px(insets.top, h) / k, B: yb - px(insets.bottom, h) / k };
  }
  function applyShot() {
    const s = shot.cur; if (!s) return;
    camera.position.copy(s.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(s.pos.x, s.pos.y - Math.sin(PITCH), s.pos.z - Math.cos(PITCH));
    camera.updateMatrixWorld(true);
    const n = camera.near;
    camera.projectionMatrix.makePerspective(s.L * n, s.R * n, s.T * n, s.B * n, n, camera.far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const ph = renderer.getPixelRatio() * view.h;
    soft.mat.uniforms.uH.value = ph; glowP.mat.uniforms.uH.value = ph;
    for (const e of Object.values(envs)) e.dome.position.copy(camera.position);
  }
  function easeShot(dt) {
    const a = shot.cur, b = shot.want; if (!a || !b) return;
    const d = Math.abs(a.L - b.L) + Math.abs(a.R - b.R) + Math.abs(a.T - b.T) + Math.abs(a.B - b.B) + a.pos.distanceTo(b.pos) * 0.05;
    if (d < 1e-5) return;
    const t = 1 - Math.exp(-dt * 2.6);
    a.pos.lerp(b.pos, t); a.L = lerp(a.L, b.L, t); a.R = lerp(a.R, b.R, t); a.T = lerp(a.T, b.T, t); a.B = lerp(a.B, b.B, t);
    applyShot();
  }
  camera.updateProjectionMatrix = () => applyShot();
  function resize(w, h) {
    const nw = w || view.w, nh = h || view.h, ch = nw !== view.w || nh !== view.h;
    view.w = nw; view.h = nh;
    camera.aspect = view.w / view.h;
    aim();
    if (!shot.cur || ch) shot.cur = cloneShot(shot.want); // a real resize snaps; inset changes ease
    applyShot();
  }

  // ---------------------------------------------------------------- picking
  const ray = new T.Raycaster(), ndc = new T.Vector2(), box = new T.Box3(), hitP = new V3();
  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld();
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables, false);
    if (hits.length) return hits[0].object.userData.bid;
    // forgiving: the nearest slot box (padded) the ray passes through
    let best = null, bd = Infinity;
    for (const k of Object.keys(slots)) {
      const g = slots[k].group;
      box.setFromObject(g).expandByScalar(0.25);
      if (ray.ray.intersectBox(box, hitP)) { const d = hitP.distanceTo(ray.ray.origin); if (d < bd) { bd = d; best = slots[k].id; } }
    }
    if (best) return best;
    // last resort: nearest slot centre on screen within 34px
    let bp = 34;
    for (const k of Object.keys(slots)) {
      const sp = SLOT_POS[k];
      const v = new V3(sp.x, SLOT_MAXH[k] * 0.4, sp.z).project(camera);
      const sx = r.left + (v.x * 0.5 + 0.5) * r.width, sy = r.top + (-v.y * 0.5 + 0.5) * r.height;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d < bp) { bp = d; best = slots[k].id; }
    }
    return best;
  }
  /** screen position (client px) of a slot's top, for labels/tooltips */
  function slotScreen(id) {
    const k = slotOf(id), sp = SLOT_POS[k]; if (!sp) return null;
    const r = renderer.domElement.getBoundingClientRect();
    const v = new V3(sp.x, SLOT_MAXH[k], sp.z).project(camera);
    return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height];
  }

  // ---------------------------------------------------------------- update
  let time = 0;
  function update(dt) {
    dt = Math.min(dt || 0, 0.1);
    time += dt; uTime.value = time;
    if (activeEnv) for (const f of activeEnv.updaters) f(dt, time);
    // rising buildings
    for (const k of Object.keys(slots)) {
      const g = slots[k].group, a = g.userData.anim;
      if (!a) continue;
      if (a.delay > 0) { a.delay -= dt; continue; }
      a.t += dt / a.dur;
      const t = Math.min(1, a.t), e = 1 - Math.pow(1 - t, 3);
      const H = g.userData.h;
      g.position.y = -H * 1.05 * (1 - e) + Math.sin(t * Math.PI) * 0.06;
      const sh = (1 - t) * 0.04;
      g.position.x = SLOT_POS[k].x + Math.sin(time * 47) * sh;
      g.position.z = SLOT_POS[k].z + Math.cos(time * 39) * sh;
      if (Math.random() < dt * 40 * (1 - t)) dustBurst(k, 2, 0.6);
      if (t >= 1) { g.position.set(SLOT_POS[k].x, 0, SLOT_POS[k].z); delete g.userData.anim; dustBurst(k, 22, 1.2); sparkle(k); }
    }
    for (let i = sinking.length - 1; i >= 0; i--) {
      const g = sinking[i], a = g.userData.anim;
      a.t += dt / a.dur;
      const t = Math.min(1, a.t);
      g.position.y = -g.userData.h * 1.05 * t * t;
      if (Math.random() < dt * 30) dustBurst(g.userData.slot, 2, 0.5);
      if (t >= 1) { removeBuilding(g); sinking.splice(i, 1); }
    }
    // highlight pulse
    if (ring.visible) { hl.t += dt; ringMat.opacity = 0.55 + 0.35 * Math.sin(hl.t * 4.5); ring.scale.y = 1; const s = 1 + Math.sin(hl.t * 4.5) * 0.03; ring.scale.x = SLOT_DIM(hl.slot)[0] * 0.66 * s; ring.scale.z = SLOT_DIM(hl.slot)[1] * (hl.slot === 'fort' ? 1.4 : 0.66) * s; ghostMat.opacity = 0.12 + 0.08 * Math.sin(hl.t * 4.5); marker.position.y = hl.top + Math.abs(Math.sin(hl.t * 3.2)) * 0.35; marker.rotation.y = hl.t * 1.5; }
    easeShot(dt);
    soft.update(dt); glowP.update(dt);
  }

  function dispose() {
    for (const k of Object.keys(slots)) removeBuilding(slots[k].group);
    for (const g of sinking) removeBuilding(g);
    sinking.length = 0;
    for (const m of geoCache.values()) { m.m.body?.dispose(); m.m.glow?.dispose(); }
    geoCache.clear();
    for (const e of Object.values(envs)) e.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && !disposables.has(o.geometry)) o.geometry.dispose(); });
    for (const d of disposables) d.dispose?.();
    disposables.clear();
    scene.clear();
  }

  resize(renderer.domElement.clientWidth || 412, renderer.domElement.clientHeight || 860);
  return { scene, camera, setTown, update, resize, pick, highlight, dispose, setInsets, slotScreen, get slots() { return Object.fromEntries(Object.entries(slots).map(([k, s]) => [k, s.id])); } };
}
