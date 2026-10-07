import * as THREE from 'three';

// =====================================================================
// TERRACUBE: a modern take on Populous for phones (portrait).
// Raise and lower the corners of the land, as in the original, so your
// people find flat ground. Homes grow from tents into castles on flat
// plots. Rally your walkers, knight a champion, and bring disasters down
// on the Crimson god until none of their followers remain.
// =====================================================================

const APP_VERSION = '3.0';
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
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
function valueNoise(rng, G = 8) {
  const grid = [];
  for (let k = 0; k < (G + 1) * (G + 1); k++) grid.push(rng());
  return (x, y) => {
    const gx = x * G, gy = y * G, i = Math.min(G - 1, Math.floor(gx)), j = Math.min(G - 1, Math.floor(gy));
    const fx = gx - i, fy = gy - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = grid[j * (G + 1) + i], b = grid[j * (G + 1) + i + 1], c = grid[(j + 1) * (G + 1) + i], d = grid[(j + 1) * (G + 1) + i + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------ rules & content
const N = 40;              // tiles per side
const V = N + 1;           // corners per side
const HS = 0.5;            // height of one step
const MAXH = 8;
const WATER_Y = 0.24;
const MAX_WORLD = 8;
const TEAM = [
  { name: 'Azure', color: 0x3b82f6, light: 0x9cc3ff, css: '#3b82f6' },
  { name: 'Crimson', color: 0xe0403a, light: 0xffa49c, css: '#e0403a' },
];
// Homes grow with the flat land around them: a full 5×5 plot makes a castle.
const LEVELS = [
  null,
  { name: 'Tent', cap: 5, grow: 0.3 },
  { name: 'Hut', cap: 10, grow: 0.45 },
  { name: 'House', cap: 18, grow: 0.65 },
  { name: 'Manor', cap: 30, grow: 0.9 },
  { name: 'Castle', cap: 50, grow: 1.25 },
];
const POWERS = [
  { id: 'raise', name: 'Raise', cost: 1, world: 1, hint: 'Tap a corner of the land to raise it. Hold to keep going. Works near your people.' },
  { id: 'lower', name: 'Lower', cost: 1, world: 1, hint: 'Tap a corner to lower it. Sink land into the sea, or break the ground under enemy homes.' },
  { id: 'banner', name: 'Banner', cost: 5, world: 1, hint: 'Move your banner. In Gather mode your people march to it and band together.' },
  { id: 'swamp', name: 'Swamp', cost: 60, world: 1, hint: 'Turn flat land into swamp. Any walker who wades in drowns.' },
  { id: 'knight', name: 'Knight', cost: 150, world: 2, hint: 'Your strongest walker becomes a Knight who hunts down and burns enemy homes.' },
  { id: 'quake', name: 'Quake', cost: 180, world: 3, hint: 'Earthquake: tears the land apart in a wide area.' },
  { id: 'volcano', name: 'Volcano', cost: 320, world: 4, hint: 'Raise a volcano. Lava keeps everyone off its slopes for a while.' },
  { id: 'flood', name: 'Flood', cost: 450, world: 5, hint: 'The sea rises one step everywhere. Every lowland drowns.' },
  { id: 'armageddon', name: 'Armageddon', cost: 700, world: 6, hint: 'Every soul leaves home for one last battle at the heart of the island.' },
];
const PW = Object.fromEntries(POWERS.map((p) => [p.id, p]));
const BIOMES = [
  { name: 'Meadow', sky: ['#8fd0ff', '#e6f5ff'], seabed: 0xc7b27e, beach: 0xecdba3, low: 0x9bd25c, mid: 0x7fc24b, high: 0x62a13c, slope: 0x6f9f40, rock: 0x9b968c, peak: 0xf3f6f9,
    strata: [0x8a6a40, 0x6b4f30, 0x4f3a24], shallow: 0x62dce8, deep: 0x1b6db8, trees: ['pine', 'round'], tuft: 0x8fd060, grow: 1, sun: 0xfff0d8, hemi: [0xe2f2ff, 0x6b5a3a] },
  { name: 'Desert', sky: ['#ffcf8a', '#fff1d6'], seabed: 0xd9c08a, beach: 0xf3e2b2, low: 0xead08f, mid: 0xdfbb79, high: 0xd0a566, slope: 0xc99a5c, rock: 0xb8774a, peak: 0xe2a771,
    strata: [0xc58f55, 0xa66f3e, 0x86562e], shallow: 0x55e2cf, deep: 0x178bb0, trees: ['cactus', 'palm'], tuft: 0xb7ad62, grow: 0.85, sun: 0xffe2b8, hemi: [0xfff0d8, 0x8a6a3a] },
  { name: 'Tundra', sky: ['#b5cde3', '#f1f6fb'], seabed: 0x9aa7ad, beach: 0xd8dfe4, low: 0xb4c2a3, mid: 0xe4ecf1, high: 0xf3f7fa, slope: 0xc6d1d8, rock: 0x7d8a95, peak: 0xffffff,
    strata: [0x707a84, 0x5a636c, 0x485058], shallow: 0x8fd6ea, deep: 0x285e8e, trees: ['snowpine', 'snowpine'], tuft: 0xdbe5ec, grow: 0.9, sun: 0xeef5ff, hemi: [0xeef6ff, 0x6a7280] },
  { name: 'Inferno', sky: ['#2c1414', '#7a3420'], seabed: 0x3a2a24, beach: 0x6e5649, low: 0x76675c, mid: 0x65574e, high: 0x544841, slope: 0x5a4c44, rock: 0x3f3633, peak: 0x2f2927,
    strata: [0x3a2a24, 0x2c201c, 0x1f1714], shallow: 0xffb347, deep: 0xc2321a, trees: ['dead', 'dead'], tuft: 0x8c6a4e, grow: 0.85, sun: 0xffc69c, hemi: [0xffd2b0, 0x40221a], lavaSea: true },
];
const biomeFor = (w) => BIOMES[Math.floor((w - 1) / 2) % BIOMES.length];

// ------------------------------------------------------------------ renderer, lights, isometric camera
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('app').prepend(renderer.domElement);

const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xe2f2ff, 0x6b5a3a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const timeU = { value: 0 };

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
const EL = Math.atan(1 / Math.SQRT2); // true isometric elevation
const rig = { target: new THREE.Vector3(0, 1, 0), yaw: Math.PI / 4, yawGoal: Math.PI / 4, viewH: 20, viewGoal: 20, shake: 0 };
function updateCamera(dt) {
  rig.yaw += (rig.yawGoal - rig.yaw) * Math.min(1, dt * 9);
  rig.viewH += (rig.viewGoal - rig.viewH) * Math.min(1, dt * 12);
  const half = N / 2 - 2;
  rig.target.x = clamp(rig.target.x, -half, half);
  rig.target.z = clamp(rig.target.z, -half, half);
  const dir = new THREE.Vector3(Math.sin(rig.yaw) * Math.cos(EL), Math.sin(EL), Math.cos(rig.yaw) * Math.cos(EL));
  const sx = rig.shake ? (Math.random() - 0.5) * rig.shake * 0.4 : 0, sy = rig.shake ? (Math.random() - 0.5) * rig.shake * 0.4 : 0;
  camera.position.copy(rig.target).addScaledVector(dir, 120);
  camera.position.x += sx; camera.position.y += sy;
  camera.lookAt(rig.target.x + sx, rig.target.y + sy, rig.target.z);
  const aspect = window.innerWidth / window.innerHeight;
  camera.top = rig.viewH / 2; camera.bottom = -rig.viewH / 2;
  camera.left = (-rig.viewH * aspect) / 2; camera.right = (rig.viewH * aspect) / 2;
  camera.updateProjectionMatrix();
}
function resize() { renderer.setSize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ land data (corner heightmap, as in Populous)
const hgt = new Int8Array(V * V);
const swamp = new Uint8Array(N * N);
const lava = new Float32Array(N * N);
const vi = (i, j) => j * V + i;
const ti = (i, j) => j * N + i;
const inTiles = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
const inVerts = (i, j) => i >= 0 && j >= 0 && i <= N && j <= N;
const vEdge = (i, j) => Math.min(i, j, N - i, N - j);
const toX = (i) => i - N / 2;
const toZ = (j) => j - N / 2;
const tileOf = (x) => Math.floor(x + N / 2);
const vertOf = (x) => Math.round(x + N / 2);
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const START = [[11, 29], [29, 11]];
let biome = BIOMES[0];

function corners(i, j) { return [hgt[vi(i, j)], hgt[vi(i + 1, j)], hgt[vi(i, j + 1)], hgt[vi(i + 1, j + 1)]]; }
function tileInfo(i, j) {
  const [a, b, c, d] = corners(i, j);
  const min = Math.min(a, b, c, d), max = Math.max(a, b, c, d);
  return { a, b, c, d, min, max, flat: min === max };
}
const splitAD = (a, b, c, d) => a === d && b !== c;
function isFlatLand(i, j) {
  if (!inTiles(i, j)) return false;
  const t = tileInfo(i, j);
  return t.flat && t.min > 0 && !swamp[ti(i, j)] && lava[ti(i, j)] <= 0;
}
// Exact height on the two triangles of a tile.
function heightAt(x, z) {
  const fx = x + N / 2, fz = z + N / 2;
  const i = clamp(Math.floor(fx), 0, N - 1), j = clamp(Math.floor(fz), 0, N - 1);
  const tx = clamp(fx - i, 0, 1), tz = clamp(fz - j, 0, 1);
  const [a, b, c, d] = corners(i, j);
  let h;
  if (splitAD(a, b, c, d)) h = tz >= tx ? a + (d - c) * tx + (c - a) * tz : a + (b - a) * tx + (d - b) * tz;
  else h = tx + tz <= 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  return h * HS;
}
const outside = (x, z) => Math.abs(x) > N / 2 - 0.05 || Math.abs(z) > N / 2 - 0.05;
const isWaterAt = (x, z) => outside(x, z) || heightAt(x, z) < WATER_Y + 0.02;

function clearAround(i, j) {
  for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) if (inTiles(i + di, j + dj)) swamp[ti(i + di, j + dj)] = 0;
}
// Neighbouring corners never differ by more than one step: raising pulls the land up with it.
function raiseVertex(i, j) {
  if (!inVerts(i, j) || hgt[vi(i, j)] >= Math.min(MAXH, vEdge(i, j))) return false;
  hgt[vi(i, j)]++;
  clearAround(i, j);
  const q = [[i, j]];
  while (q.length) {
    const [a, b] = q.pop();
    const h = hgt[vi(a, b)];
    for (const [di, dj] of N8) {
      const x = a + di, y = b + dj;
      if (!inVerts(x, y)) continue;
      if (hgt[vi(x, y)] < h - 1) { hgt[vi(x, y)] = h - 1; clearAround(x, y); q.push([x, y]); }
    }
  }
  terrainDirty = true;
  return true;
}
function lowerVertex(i, j) {
  if (!inVerts(i, j) || hgt[vi(i, j)] <= 0) return false;
  hgt[vi(i, j)]--;
  clearAround(i, j);
  const q = [[i, j]];
  while (q.length) {
    const [a, b] = q.pop();
    const h = hgt[vi(a, b)];
    for (const [di, dj] of N8) {
      const x = a + di, y = b + dj;
      if (!inVerts(x, y)) continue;
      if (hgt[vi(x, y)] > h + 1) { hgt[vi(x, y)] = h + 1; clearAround(x, y); q.push([x, y]); }
    }
  }
  terrainDirty = true;
  return true;
}
function generateWorld(seed) {
  const rng = mulberry32(seed * 977 + 13);
  const n1 = valueNoise(rng), n2 = valueNoise(rng, 5);
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const x = i / N, y = j / N;
      const d = Math.hypot(x - 0.5, y - 0.5) / 0.5;
      let h = (1 - Math.pow(d, 1.8)) * 6.2 + (n1(x, y) - 0.5) * 7 + (n2(x, y) - 0.5) * 3 - 0.4;
      hgt[vi(i, j)] = clamp(Math.round(h), 0, Math.min(MAXH, vEdge(i, j)));
    }
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const v = hgt[vi(i, j)];
        for (const [di, dj] of N8) {
          const a = i + di, b = j + dj;
          if (inVerts(a, b) && hgt[vi(a, b)] > v + 1) { hgt[vi(a, b)] = v + 1; changed = true; }
        }
      }
    if (!changed) break;
  }
  swamp.fill(0); lava.fill(0);
  // A small level clearing at each start (4×4 tiles at height 2).
  for (const [cx, cy] of START)
    for (let j = cy - 2; j <= cy + 2; j++)
      for (let i = cx - 2; i <= cx + 2; i++) {
        while (hgt[vi(i, j)] < 2 && raiseVertex(i, j));
        while (hgt[vi(i, j)] > 2 && lowerVertex(i, j));
      }
}

// ------------------------------------------------------------------ terrain mesh: flat-shaded tiles, soft grid, baked occlusion
const gridTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(0,0,0,0.075)';
  g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64); g.fillRect(0, 62, 64, 2); g.fillRect(62, 0, 2, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
})();
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: gridTex, flatShading: true, roughness: 0.92, metalness: 0 });
const terrain = new THREE.Mesh(new THREE.BufferGeometry(), terrainMat);
terrain.receiveShadow = true;
terrain.castShadow = true;
scene.add(terrain);
{
  const n = N * N * 6;
  terrain.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  terrain.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  terrain.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
}
let terrainDirty = true;
const PAL = {};
function setPalette() {
  for (const k of ['seabed', 'beach', 'low', 'mid', 'high', 'slope', 'rock', 'peak']) PAL[k] = new THREE.Color(biome[k]);
  PAL.swamp = new THREE.Color(0x56602c); PAL.swampB = new THREE.Color(0x6d7a35);
  PAL.lava = new THREE.Color(0xff7a1a); PAL.lavaD = new THREE.Color(0x4a1a0e);
}
const tc = new THREE.Color();
function tileColor(i, j, t) {
  const T = tileInfo(i, j);
  const L = lava[ti(i, j)];
  if (L > 0) return tc.copy(PAL.lavaD).lerp(PAL.lava, 0.55 + 0.45 * Math.sin(t * 4 + i * 1.7 + j * 2.3));
  if (swamp[ti(i, j)]) return tc.copy(((i * 3 + j * 5) & 1) ? PAL.swamp : PAL.swampB);
  if (T.max === 0) return tc.copy(PAL.seabed);
  if (T.min === 0) return tc.copy(PAL.beach);
  const hv = T.flat ? T.min : (T.min + T.max) / 2;
  if (T.flat) {
    const base = hv <= 2 ? PAL.low : hv <= 4 ? PAL.mid : hv <= 6 ? PAL.high : PAL.peak;
    return tc.copy(base).multiplyScalar(((i + j) & 1) ? 1.03 : 0.97);
  }
  if (T.max >= 8) return tc.copy(PAL.peak).lerp(PAL.rock, 0.3);
  if (T.max >= 6) return tc.copy(PAL.rock).multiplyScalar(((i * 7 + j * 3) & 3) ? 1 : 0.9);
  return tc.copy(PAL.slope).lerp(PAL.rock, clamp((T.max - 3) / 4, 0, 0.6));
}
const ao = new Float32Array(V * V);
function rebuildTerrain(t = 0) {
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      let s = 0, n = 0;
      for (const [di, dj] of N8) if (inVerts(i + di, j + dj)) { s += hgt[vi(i + di, j + dj)]; n++; }
      const h = hgt[vi(i, j)];
      ao[vi(i, j)] = clamp(1 + (h - s / n) * 0.22, 0.68, 1.1) * (1 + h * 0.012);
    }
  const pos = terrain.geometry.attributes.position.array, col = terrain.geometry.attributes.color.array, uv = terrain.geometry.attributes.uv.array;
  let p = 0, u = 0;
  const put = (ii, jj, ux, uz, c) => {
    pos[p] = toX(ii); pos[p + 1] = hgt[vi(ii, jj)] * HS; pos[p + 2] = toZ(jj);
    const k = ao[vi(ii, jj)];
    col[p] = c.r * k; col[p + 1] = c.g * k; col[p + 2] = c.b * k;
    uv[u] = ux; uv[u + 1] = uz;
    p += 3; u += 2;
  };
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const c = tileColor(i, j, t).clone();
      const [a, b, cc, d] = corners(i, j);
      if (splitAD(a, b, cc, d)) {
        put(i, j, 0, 0, c); put(i, j + 1, 0, 1, c); put(i + 1, j + 1, 1, 1, c);
        put(i, j, 0, 0, c); put(i + 1, j + 1, 1, 1, c); put(i + 1, j, 1, 0, c);
      } else {
        put(i, j, 0, 0, c); put(i, j + 1, 0, 1, c); put(i + 1, j, 1, 0, c);
        put(i + 1, j, 1, 0, c); put(i, j + 1, 0, 1, c); put(i + 1, j + 1, 1, 1, c);
      }
    }
  const g = terrain.geometry;
  g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.uv.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere(); g.computeBoundingBox();
  updateWaterDepth();
  propsDirty = true;
}

// ------------------------------------------------------------------ the diorama: strata walls, water box and a soft shadow
const diorama = new THREE.Group();
scene.add(diorama);
function buildDiorama() {
  diorama.clear();
  const bands = [[0, -0.5, biome.seabed], [-0.5, -1.3, biome.strata[0]], [-1.3, -2.2, biome.strata[1]], [-2.2, -3.2, biome.strata[2]]];
  for (const [top, bot, c] of bands) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(N, top - bot - 0.01, N), new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 }));
    m.position.y = (top + bot) / 2 - 0.006;
    m.receiveShadow = true;
    diorama.add(m);
  }
  const wMat = new THREE.MeshBasicMaterial({ color: biome.deep, transparent: true, opacity: 0.55, depthWrite: false });
  for (const [x, z, ry] of [[0, N / 2, 0], [0, -N / 2, Math.PI], [N / 2, 0, Math.PI / 2], [-N / 2, 0, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(N, WATER_Y), wMat);
    w.position.set(x, WATER_Y / 2, z); w.rotation.y = ry;
    diorama.add(w);
  }
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const g = sc.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  rg.addColorStop(0, 'rgba(0,0,0,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(N * 1.7, N * 1.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.position.y = -4.2;
  diorama.add(shadow);
}

// ------------------------------------------------------------------ water: depth colour, shore foam, sparkle
const WSEG = N * 2;
const waterGeo = new THREE.PlaneGeometry(N, N, WSEG, WSEG).rotateX(-Math.PI / 2);
waterGeo.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array((WSEG + 1) * (WSEG + 1)), 1));
const waterMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: timeU, uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uLava: { value: 0 } },
  vertexShader: `
    attribute float aDepth;
    uniform float uTime;
    varying float vDepth; varying vec2 vXZ;
    void main() {
      vDepth = aDepth; vXZ = position.xz;
      vec3 p = position;
      p.y += (sin(p.x * 1.3 + uTime * 1.4) + cos(p.z * 1.1 + uTime * 1.2)) * 0.016 * clamp(aDepth * 4.0, 0.0, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 uShallow; uniform vec3 uDeep; uniform float uTime; uniform float uLava;
    varying float vDepth; varying vec2 vXZ;
    void main() {
      if (vDepth < 0.0) discard;
      float d = clamp(vDepth / 1.3, 0.0, 1.0);
      vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d));
      float shore = smoothstep(0.14, 0.0, vDepth);
      float band = smoothstep(0.78, 1.0, sin(uTime * 1.7 - vDepth * 26.0) * 0.5 + 0.5) * smoothstep(0.5, 0.12, vDepth);
      float foam = max(shore, band * 0.75);
      float sp = pow(max(0.0, sin(vXZ.x * 2.3 + uTime * 1.1) * sin(vXZ.y * 2.9 - uTime * 0.9)), 28.0);
      vec3 foamCol = mix(vec3(1.0, 0.99, 0.95), vec3(1.0, 0.85, 0.4), uLava);
      col = mix(col, foamCol, foam * 0.85) + sp * 0.3;
      float a = mix(0.62, 0.9, smoothstep(0.0, 1.0, d));
      gl_FragColor = vec4(col, max(a, foam * 0.9));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.y = WATER_Y;
water.renderOrder = 2;
scene.add(water);
function updateWaterDepth() {
  const pos = waterGeo.attributes.position.array, dep = waterGeo.attributes.aDepth.array;
  for (let k = 0; k < dep.length; k++) {
    const x = clamp(pos[k * 3], -N / 2 + 0.001, N / 2 - 0.001), z = clamp(pos[k * 3 + 2], -N / 2 + 0.001, N / 2 - 0.001);
    dep[k] = WATER_Y - heightAt(x, z);
  }
  waterGeo.attributes.aDepth.needsUpdate = true;
}

// ------------------------------------------------------------------ props: trees, rocks and tufts (instanced, swaying)
function mergeParts(parts) {
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
  return geo;
}
const cyl = (r1, r2, h, s, y = 0, x = 0, z = 0) => new THREE.CylinderGeometry(r1, r2, h, s).translate(x, y + h / 2, z);
const cone = (r, h, s, y = 0, x = 0, z = 0) => new THREE.ConeGeometry(r, h, s).translate(x, y + h / 2, z);
const PROP_GEO = {
  pine: mergeParts([{ g: cyl(0.05, 0.07, 0.3, 5), c: 0x6b4a2b }, { g: cone(0.32, 0.5, 7, 0.2), c: 0x2f7d3a }, { g: cone(0.25, 0.42, 7, 0.45), c: 0x358a40 }, { g: cone(0.16, 0.32, 7, 0.7), c: 0x3d9848 }]),
  round: mergeParts([{ g: cyl(0.05, 0.07, 0.36, 5), c: 0x7a5232 }, { g: new THREE.IcosahedronGeometry(0.3, 0).translate(0, 0.58, 0), c: 0x4c9a3a }, { g: new THREE.IcosahedronGeometry(0.2, 0).translate(0.13, 0.78, 0.06), c: 0x5cab45 }]),
  cactus: mergeParts([{ g: cyl(0.075, 0.085, 0.62, 7), c: 0x3f8a46 }, { g: cyl(0.045, 0.045, 0.22, 6, 0.3, 0.15), c: 0x47964e }, { g: new THREE.BoxGeometry(0.14, 0.06, 0.06).translate(0.08, 0.3, 0), c: 0x47964e }, { g: cyl(0.04, 0.04, 0.18, 6, 0.2, -0.14), c: 0x47964e }, { g: new THREE.BoxGeometry(0.12, 0.05, 0.05).translate(-0.07, 0.2, 0), c: 0x47964e }]),
  palm: mergeParts([{ g: cyl(0.04, 0.065, 0.85, 6), c: 0x9a7448 }, { g: cone(0.5, 0.16, 7, 0.78), c: 0x4f9d3c }, { g: new THREE.IcosahedronGeometry(0.06, 0).translate(0.05, 0.8, 0.04), c: 0x6b4a2b }]),
  snowpine: mergeParts([{ g: cyl(0.05, 0.07, 0.28, 5), c: 0x5a3f28 }, { g: cone(0.33, 0.5, 7, 0.2), c: 0x2a5a40 }, { g: cone(0.25, 0.42, 7, 0.45), c: 0x2f6648 }, { g: cone(0.15, 0.25, 7, 0.75), c: 0xf4f8fb }]),
  dead: mergeParts([{ g: cyl(0.035, 0.07, 0.65, 5), c: 0x2e2420 }, { g: cyl(0.015, 0.03, 0.32, 4).rotateZ(0.8).translate(0.1, 0.38, 0), c: 0x2e2420 }, { g: cyl(0.015, 0.03, 0.26, 4).rotateZ(-0.9).translate(-0.08, 0.3, 0), c: 0x2e2420 }]),
  rock: mergeParts([{ g: new THREE.DodecahedronGeometry(0.2, 0).scale(1, 0.7, 1).translate(0, 0.08, 0), c: 0xffffff }, { g: new THREE.DodecahedronGeometry(0.12, 0).scale(1, 0.8, 1).translate(0.17, 0.05, 0.05), c: 0xeeeeee }]),
  tuft: mergeParts([{ g: cone(0.05, 0.2, 4, 0, 0, 0).rotateZ(0.2), c: 0xffffff }, { g: cone(0.045, 0.16, 4, 0, 0.06, 0.03).rotateZ(-0.25), c: 0xf2f2f2 }, { g: cone(0.04, 0.14, 4, 0, -0.05, -0.04), c: 0xe8e8e8 }]),
};
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
const swayMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
swayMat.onBeforeCompile = (s) => {
  s.uniforms.uTime = timeU;
  s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
      float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9;
    #else
      float ph = 0.0;
    #endif
    float sw = sin(uTime * 1.7 + ph) * 0.05 * max(position.y, 0.0);
    transformed.x += sw; transformed.z += sw * 0.6;`);
};
swayMat.customProgramCacheKey = () => 'sway';
const PROP_MAX = { pine: 220, round: 220, cactus: 220, palm: 220, snowpine: 220, dead: 220, rock: 140, tuft: 520 };
const propMesh = {};
for (const k of Object.keys(PROP_GEO)) {
  const m = new THREE.InstancedMesh(PROP_GEO[k], k === 'rock' ? propMat : swayMat, PROP_MAX[k]);
  m.castShadow = k !== 'tuft';
  m.receiveShadow = true;
  m.count = 0;
  m.setColorAt(0, new THREE.Color(1, 1, 1));
  scene.add(m);
  propMesh[k] = m;
}
const propSpots = [];
let propsDirty = true;
function plantProps(seed) {
  propSpots.length = 0;
  const r = mulberry32(seed + 77);
  const add = (type, n) => { for (let k = 0; k < n; k++) propSpots.push({ type, i: (r() * N) | 0, j: (r() * N) | 0, ox: 0.2 + r() * 0.6, oz: 0.2 + r() * 0.6, s: 0.75 + r() * 0.55, v: r() < 0.5 ? 0 : 1, tint: 0.82 + r() * 0.3, ry: r() * 6.28 }); };
  add('tree', 210); add('rock', 130); add('tuft', 480);
}
const dummy = new THREE.Object3D();
const tmpCol = new THREE.Color();
function layoutProps() {
  const blocked = new Uint8Array(N * N);
  for (const b of buildings) {
    const r = b.level >= 4 ? 2 : 1;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (inTiles(b.i + di, b.j + dj)) blocked[ti(b.i + di, b.j + dj)] = 1;
  }
  const cnt = {};
  for (const k of Object.keys(propMesh)) cnt[k] = 0;
  for (const s of propSpots) {
    const T = tileInfo(s.i, s.j), k2 = ti(s.i, s.j);
    if (T.min <= 0 || lava[k2] > 0 || swamp[k2]) continue;
    let kind;
    if (s.type === 'tree') { if (T.max >= 7 || blocked[k2]) continue; kind = biome.trees[s.v]; }
    else if (s.type === 'rock') { if (T.flat && T.max < 5) continue; kind = 'rock'; }
    else { if (!T.flat || T.max > 4 || blocked[k2]) continue; kind = 'tuft'; }
    const m = propMesh[kind];
    if (cnt[kind] >= PROP_MAX[kind]) continue;
    const x = toX(s.i) + s.ox, z = toZ(s.j) + s.oz;
    dummy.position.set(x, heightAt(x, z) - 0.02, z);
    dummy.rotation.set(0, s.ry, 0);
    dummy.scale.setScalar(s.s * (kind === 'tuft' ? 0.9 : 1));
    dummy.updateMatrix();
    m.setMatrixAt(cnt[kind], dummy.matrix);
    if (kind === 'rock') tmpCol.set(biome.rock).multiplyScalar(s.tint * 1.15);
    else if (kind === 'tuft') tmpCol.set(biome.tuft).multiplyScalar(s.tint);
    else tmpCol.setScalar(s.tint);
    m.setColorAt(cnt[kind], tmpCol);
    cnt[kind]++;
  }
  for (const k of Object.keys(propMesh)) {
    const m = propMesh[k];
    m.count = cnt[k];
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  layoutGuides();
}

// ------------------------------------------------------------------ models
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });
const M = {
  plaster: std(0xf2e8d5), plasterB: std(0xe3d3b4), wood: std(0x8a5a33), woodD: std(0x5e3b20), thatch: std(0xd8b25a),
  stone: std(0xcfc7b8), stoneD: std(0x9a9183), door: std(0x4a2e1a), glass: std(0xffe3a0, { emissive: 0xffb84a, emissiveIntensity: 0.7 }),
  gold: std(0xf2c14e, { metalness: 0.6, roughness: 0.35 }), steel: std(0xd5dbe3, { metalness: 0.65, roughness: 0.3 }),
  skin: std(0xf0c39a), hair: std(0x4a3020), dark: std(0x2b2b33),
  team: TEAM.map((t) => std(t.color, { roughness: 0.6 })), teamL: TEAM.map((t) => std(t.light)),
};
function roofGeo() {
  const P = [
    [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 1, 0],
    [0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 1, 0],
    [-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0], [0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, 0],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
  g.computeVertexNormals();
  return g;
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), cyl: new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0),
  cone: new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0), cone6: new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0),
  roof: roofGeo(), pyr: new THREE.ConeGeometry(0.71, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), ball: new THREE.SphereGeometry(1, 10, 8),
  flag: new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0), torus: new THREE.TorusGeometry(1, 0.25, 6, 14),
};
function mk(geo, mat, x, y, z, sx, sy, sz, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function flagOn(g, team, x, y, z, h, w = 0.24) {
  g.add(mk(GEO.cyl, M.woodD, x, y, z, 0.015, h, 0.015));
  const f = mk(GEO.flag, M.team[team], x, y + h - 0.08, z, w, 0.14, 0.015);
  f.userData.flag = true;
  g.add(f);
}
function buildingModel(level, team) {
  const g = new THREE.Group();
  const T = M.team[team];
  if (level === 1) {
    g.add(mk(GEO.cone6, M.teamL[team], 0, 0, 0, 0.34, 0.5, 0.34));
    g.add(mk(GEO.box, M.door, 0, 0, 0.24, 0.12, 0.2, 0.06));
    flagOn(g, team, 0, 0.42, 0, 0.26);
  } else if (level === 2) {
    g.add(mk(GEO.cyl, M.wood, 0, 0, 0, 0.27, 0.3, 0.27));
    g.add(mk(GEO.cone, M.thatch, 0, 0.3, 0, 0.38, 0.34, 0.38));
    g.add(mk(GEO.box, M.door, 0, 0, 0.25, 0.12, 0.22, 0.05));
    g.add(mk(GEO.box, T, 0, 0.27, 0, 0.56, 0.04, 0.56));
    flagOn(g, team, 0, 0.6, 0, 0.22, 0.18);
  } else if (level === 3) {
    g.add(mk(GEO.box, M.plaster, 0, 0, 0, 0.66, 0.42, 0.52));
    g.add(mk(GEO.box, M.woodD, 0, 0.4, 0, 0.7, 0.04, 0.56));
    g.add(mk(GEO.roof, T, 0, 0.42, 0, 0.78, 0.34, 0.64));
    g.add(mk(GEO.box, M.stoneD, 0.2, 0.5, -0.12, 0.11, 0.32, 0.11));
    g.add(mk(GEO.box, M.door, -0.12, 0, 0.27, 0.13, 0.25, 0.03));
    for (const x of [0.14, -0.28]) g.add(mk(GEO.box, M.glass, x, 0.17, 0.27, 0.1, 0.1, 0.03));
    g.userData.chimney = new THREE.Vector3(0.2, 0.86, -0.12);
  } else if (level === 4) {
    g.add(mk(GEO.box, M.plaster, -0.08, 0, -0.05, 0.86, 0.5, 0.56));
    g.add(mk(GEO.roof, T, -0.08, 0.5, -0.05, 0.96, 0.38, 0.68));
    g.add(mk(GEO.box, M.plasterB, 0.36, 0, 0.36, 0.44, 0.4, 0.42));
    g.add(mk(GEO.roof, T, 0.36, 0.4, 0.36, 0.5, 0.28, 0.5, Math.PI / 2));
    g.add(mk(GEO.cyl, M.stone, -0.5, 0, -0.32, 0.15, 0.95, 0.15));
    g.add(mk(GEO.cone, T, -0.5, 0.95, -0.32, 0.2, 0.34, 0.2));
    g.add(mk(GEO.box, M.door, -0.08, 0, 0.24, 0.16, 0.3, 0.03));
    for (const x of [-0.36, 0.2]) g.add(mk(GEO.box, M.glass, x, 0.22, 0.24, 0.11, 0.12, 0.03));
    g.add(mk(GEO.box, M.glass, 0.36, 0.18, 0.58, 0.12, 0.12, 0.03));
    g.add(mk(GEO.box, M.stoneD, 0.12, 0.6, -0.2, 0.11, 0.38, 0.11));
    flagOn(g, team, -0.5, 1.25, -0.32, 0.32);
    g.userData.chimney = new THREE.Vector3(0.12, 1.0, -0.2);
  } else {
    const W = 0.95;
    for (const [x, z, sx, sz] of [[0, -W, 2 * W, 0.18], [0, W, 2 * W, 0.18], [-W, 0, 0.18, 2 * W], [W, 0, 0.18, 2 * W]]) {
      g.add(mk(GEO.box, M.stone, x, 0, z, sx, 0.5, sz));
      const n = 6;
      for (let k = 0; k < n; k++) {
        const t = -1 + (2 * k + 1) / n;
        g.add(mk(GEO.box, M.stone, x + (sx > sz ? t * W : 0), 0.5, z + (sz > sx ? t * W : 0), 0.12, 0.1, 0.12));
      }
    }
    for (const [x, z] of [[-W, -W], [W, -W], [-W, W], [W, W]]) {
      g.add(mk(GEO.cyl, M.stone, x, 0, z, 0.25, 0.85, 0.25));
      g.add(mk(GEO.cone, T, x, 0.85, z, 0.3, 0.42, 0.3));
    }
    g.add(mk(GEO.box, M.stoneD, 0, 0, -0.15, 0.85, 1.0, 0.8));
    g.add(mk(GEO.pyr, T, 0, 1.0, -0.15, 1.2, 0.55, 1.15));
    g.add(mk(GEO.box, M.door, 0, 0, W + 0.02, 0.36, 0.38, 0.06));
    g.add(mk(GEO.box, M.door, 0, 0, 0.26, 0.2, 0.32, 0.02));
    for (const x of [-0.22, 0.22]) g.add(mk(GEO.box, M.glass, x, 0.62, 0.26, 0.1, 0.14, 0.02));
    flagOn(g, team, 0, 1.5, -0.15, 0.5, 0.32);
    for (const [x, z] of [[-W, W], [W, W]]) flagOn(g, team, x, 1.24, z, 0.26, 0.18);
    g.userData.chimney = new THREE.Vector3(0.3, 1.0, -0.4);
  }
  return g;
}
function walkerModel(team, kind = 'walker') {
  const g = new THREE.Group();
  const legs = [mk(GEO.box, M.dark, -0.04, 0, 0, 0.05, 0.1, 0.06), mk(GEO.box, M.dark, 0.04, 0, 0, 0.05, 0.1, 0.06)];
  g.add(...legs);
  if (kind === 'knight') {
    g.add(mk(GEO.cyl, M.steel, 0, 0.09, 0, 0.1, 0.22, 0.09));
    g.add(mk(GEO.ball, M.steel, 0, 0.36, 0, 0.08, 0.08, 0.08));
    g.add(mk(GEO.box, M.dark, 0, 0.35, 0.065, 0.1, 0.02, 0.02));
    g.add(mk(GEO.cone, M.team[team], 0, 0.42, -0.02, 0.03, 0.14, 0.06));
    g.add(mk(GEO.box, M.team[team], 0, 0.1, -0.09, 0.18, 0.2, 0.02));
    const sword = mk(GEO.box, M.steel, 0.13, 0.12, 0.04, 0.025, 0.3, 0.025);
    g.add(sword);
    g.add(mk(GEO.box, M.gold, 0.13, 0.17, 0.04, 0.08, 0.02, 0.03));
  } else {
    g.add(mk(GEO.cyl, M.team[team], 0, 0.09, 0, 0.075, 0.19, 0.075));
    g.add(mk(GEO.ball, M.skin, 0, 0.34, 0, 0.065, 0.065, 0.065));
    g.add(mk(GEO.ball, M.hair, 0, 0.37, -0.01, 0.068, 0.04, 0.068));
    if (kind === 'leader') { flagOn(g, team, 0, 0.1, -0.08, 0.5, 0.2); g.add(mk(GEO.cyl, M.gold, 0, 0.4, 0, 0.05, 0.04, 0.05)); }
  }
  g.userData.legs = legs;
  return g;
}
function bannerModel(team) {
  const g = new THREE.Group();
  g.add(mk(GEO.cyl, M.stone, 0, 0, 0, 0.18, 0.1, 0.18));
  g.add(mk(GEO.cyl, M.gold, 0, 0.1, 0, 0.03, 1.3, 0.03));
  const ring = mk(GEO.torus, M.gold, 0, 1.52, 0, 0.11, 0.11, 0.11);
  g.add(ring);
  g.add(mk(GEO.box, M.gold, 0, 1.3, 0, 0.32, 0.04, 0.04));
  const f = mk(GEO.flag, M.team[team], 0.02, 1.08, 0, 0.42, 0.28, 0.02);
  f.userData.flag = true;
  g.add(f);
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: TEAM[team].light, transparent: true, opacity: 0.5, depthWrite: false }));
  glow.position.y = 0.05;
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

// ------------------------------------------------------------------ particles: soft round sprites
const PMAX = 900;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const dotTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.8)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const pMat = new THREE.PointsMaterial({ size: 8, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: false });
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
points.renderOrder = 3;
scene.add(points);
const parts = [];
function emit(x, y, z, color, n = 8, spread = 1, up = 2, life = 1, grav = 2.2) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    if (parts.length >= PMAX) parts.shift();
    parts.push({ x, y, z, vx: (Math.random() - 0.5) * spread, vy: up * (0.5 + Math.random() * 0.8), vz: (Math.random() - 0.5) * spread, life: life * (0.6 + Math.random() * 0.6), max: life, c, grav });
  }
}
function updateParticles(dt) {
  for (let k = parts.length - 1; k >= 0; k--) {
    const p = parts[k];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(k, 1); continue; }
    p.vy -= p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  for (let k = 0; k < PMAX; k++) {
    const p = parts[k];
    if (p) {
      pPos[k * 3] = p.x; pPos[k * 3 + 1] = p.y; pPos[k * 3 + 2] = p.z;
      const f = Math.min(1, (p.life / p.max) * 1.6);
      pCol[k * 3] = p.c.r * f; pCol[k * 3 + 1] = p.c.g * f; pCol[k * 3 + 2] = p.c.b * f;
    } else { pPos[k * 3 + 1] = -100; }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
  pMat.size = 5.5 * renderer.getPixelRatio() * (20 / rig.viewH);
}

// Cursor: a marker on the chosen corner, or a ring for area powers.
const cursor = new THREE.Group();
{
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, depthTest: false });
  cursor.add(new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 24).rotateX(-Math.PI / 2), mat));
  cursor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6).translate(0, 0.35, 0), mat));
  cursor.userData.mat = mat;
  cursor.visible = false;
  cursor.renderOrder = 5;
  scene.add(cursor);
}
const areaRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, depthTest: false }));
areaRing.visible = false;
areaRing.renderOrder = 5;
scene.add(areaRing);
let cursorT = 0;

// Guides: little orange markers on tiles that need levelling around your homes.
const GUIDE_MAX = 400;
const guides = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.09, 0).scale(1, 0.6, 1), new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0.9 }), GUIDE_MAX);
guides.count = 0;
guides.renderOrder = 4;
scene.add(guides);
function layoutGuides() {
  let n = 0;
  if (mode === 'play' && (tool === 'raise' || tool === 'lower')) {
    for (const b of buildings) {
      if (b.team !== 0 || b.level >= 5) continue;
      const h = tileInfo(b.i, b.j).min;
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          const i = b.i + di, j = b.j + dj;
          if (!inTiles(i, j) || n >= GUIDE_MAX) continue;
          const T = tileInfo(i, j);
          const other = buildings.some((o) => o !== b && o.i === i && o.j === j);
          if (other || (T.flat && T.min === h && !swamp[ti(i, j)])) continue;
          dummy.position.set(toX(i) + 0.5, Math.max(heightAt(toX(i) + 0.5, toZ(j) + 0.5), WATER_Y) + 0.14, toZ(j) + 0.5);
          dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
          guides.setMatrixAt(n++, dummy.matrix);
        }
    }
  }
  guides.count = n;
  guides.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ game state
let world = 1, mode = 'menu', tool = 'raise', elapsed = 0, armageddon = false;
let buildings = [], walkers = [];
const banners = [null, null];
const modes = ['settle', 'settle'];
const mana = [40, 40];
const stats = { built: 0, castles: 0, kills: 0, lost: 0 };
const tips = {};

function buildingNear(i, j, r, except) {
  for (const b of buildings) if (b !== except && Math.max(Math.abs(b.i - i), Math.abs(b.j - j)) <= r) return b;
  return null;
}
function flatScore(i, j, r, self) {
  const h = tileInfo(i, j).min;
  let n = 0;
  for (let dj = -r; dj <= r; dj++)
    for (let di = -r; di <= r; di++) {
      const a = i + di, c = j + dj;
      if (!isFlatLand(a, c) || tileInfo(a, c).min !== h) continue;
      if (buildings.some((o) => o !== self && o.i === a && o.j === c)) continue;
      n++;
    }
  return n;
}
// Each home keeps its own plot: no two homes closer than three tiles.
const canSettle = (i, j) => isFlatLand(i, j) && !buildingNear(i, j, 2) && flatScore(i, j, 1) >= 4;
function levelFor(b) {
  const s1 = flatScore(b.i, b.j, 1, b), s2 = flatScore(b.i, b.j, 2, b);
  if (s2 >= 25) return 5;
  if (s1 >= 9 && s2 >= 17) return 4;
  if (s1 >= 9) return 3;
  if (s1 >= 6) return 2;
  return 1;
}
const bx = (b) => toX(b.i) + 0.5, bz = (b) => toZ(b.j) + 0.5, by = (b) => tileInfo(b.i, b.j).min * HS;

function addBuilding(i, j, team, pop) {
  const b = { i, j, team, pop, level: 0, mesh: null, check: 0, grow: 0, smoke: Math.random() * 2 };
  buildings.push(b);
  setLevel(b, levelFor(b));
  if (team === 0) stats.built++;
  propsDirty = true;
  return b;
}
function setLevel(b, level) {
  if (b.level === level && b.mesh) return;
  const up = level > b.level && b.level > 0;
  b.level = level;
  if (b.mesh) scene.remove(b.mesh);
  b.mesh = buildingModel(level, b.team);
  b.mesh.position.set(bx(b), by(b), bz(b));
  b.mesh.rotation.y = ((b.i * 7 + b.j * 3) % 4) * Math.PI / 2;
  b.grow = 0;
  scene.add(b.mesh);
  propsDirty = true;
  if (up) {
    emit(bx(b), by(b) + 0.8, bz(b), TEAM[b.team].light, 22, 1.8, 2.6, 1.1);
    if (b.team === 0) {
      sfx.build(level);
      if (level === 5) { stats.castles++; toast('A castle rises! 🏰'); }
      else if (level === 3) tip('house', 'Level all 25 tiles around a home for a castle');
    }
  }
}
function removeBuilding(b, spill = true) {
  scene.remove(b.mesh);
  buildings.splice(buildings.indexOf(b), 1);
  emit(bx(b), Math.max(by(b), WATER_Y) + 0.3, bz(b), 0xc9b89a, 16, 1.5, 1.6, 0.9);
  if (spill && b.pop >= 1 && !isWaterAt(bx(b), bz(b))) addWalker(b.team, bx(b), bz(b), Math.floor(b.pop));
  propsDirty = true;
}
function addWalker(team, x, z, strength, kind = 'walker') {
  const w = { team, x, z, y: heightAt(x, z), s: Math.max(1, strength), kind, mesh: walkerModel(team, kind), tx: x, tz: z, target: null, think: 0, anim: Math.random() * 6, dead: false };
  w.mesh.position.set(x, w.y, z);
  scene.add(w.mesh);
  walkers.push(w);
  return w;
}
function setKind(w, kind) {
  w.kind = kind;
  scene.remove(w.mesh);
  w.mesh = walkerModel(w.team, kind);
  scene.add(w.mesh);
}
function killWalker(w) { w.dead = true; scene.remove(w.mesh); }
function teamPop(team) {
  let p = 0;
  for (const b of buildings) if (b.team === team) p += b.pop;
  for (const w of walkers) if (w.team === team && !w.dead) p += w.s;
  return p;
}
function placeBanner(team, x, z) {
  if (!banners[team]) { banners[team] = { x, z, mesh: bannerModel(team) }; scene.add(banners[team].mesh); }
  Object.assign(banners[team], { x, z });
  banners[team].mesh.position.set(x, heightAt(x, z), z);
  for (const w of walkers) if (w.team === team && w.target?.kind === 'gather') w.think = 0;
}

function newGame(n) {
  world = n;
  biome = biomeFor(n);
  setPalette();
  for (const b of buildings) scene.remove(b.mesh);
  for (const w of walkers) scene.remove(w.mesh);
  buildings = []; walkers = [];
  mana[0] = 40; mana[1] = 40 + n * 20;
  modes[0] = modes[1] = 'settle';
  armageddon = false; elapsed = 0;
  Object.assign(stats, { built: 0, castles: 0, kills: 0, lost: 0 });
  generateWorld(n);
  plantProps(n);
  buildDiorama();
  waterMat.uniforms.uShallow.value.set(biome.shallow);
  waterMat.uniforms.uDeep.value.set(biome.deep);
  waterMat.uniforms.uLava.value = biome.lavaSea ? 1 : 0;
  sun.color.set(biome.sun);
  hemi.color.set(biome.hemi[0]); hemi.groundColor.set(biome.hemi[1]);
  document.body.style.setProperty('--sky1', biome.sky[0]);
  document.body.style.setProperty('--sky2', biome.sky[1]);
  START.forEach(([si, sj], team) => {
    for (let k = 0; k < 4; k++) addWalker(team, toX(si) + (k % 2) * 0.7 - 0.35, toZ(sj) + Math.floor(k / 2) * 0.7 - 0.35, 5);
    placeBanner(team, toX(si) + (team ? -2.5 : 3.5), toZ(sj) + (team ? 3.5 : -2.5));
  });
  terrainDirty = true;
  $('world').textContent = `World ${n}`;
  $('biome').textContent = biome.name;
  buildPowerBar();
  setTool('raise');
  setMode('settle');
}
function focusHome() {
  const own = buildings.filter((b) => b.team === 0);
  const [si, sj] = START[0];
  const t = own.length ? own.reduce((a, b) => (b.level > a.level ? b : a)) : null;
  rig.target.set(t ? bx(t) : toX(si), 1.2, t ? bz(t) : toZ(sj));
  snapYaw();
  rig.viewGoal = 18;
}

// ------------------------------------------------------------------ influence: you shape the land only where your people are
function influenced(team, x, z) {
  for (const b of buildings) if (b.team === team && Math.max(Math.abs(bx(b) - x), Math.abs(bz(b) - z)) <= 5.5 + b.level * 0.5) return true;
  for (const w of walkers) if (w.team === team && !w.dead && Math.hypot(w.x - x, w.z - z) <= 3.5) return true;
  const bn = banners[team];
  return bn && Math.hypot(bn.x - x, bn.z - z) <= 4;
}

// ------------------------------------------------------------------ powers
function applyPower(team, id, x, z, fromAI = false) {
  const pw = PW[id];
  const say = (m) => { if (!fromAI) { toast(m); sfx.deny(); } return false; };
  if (world < pw.world) return say(`Unlocks on World ${pw.world}`);
  if (mana[team] < pw.cost) return say('Not enough mana');
  const vi0 = vertOf(x), vj0 = vertOf(z), i = tileOf(x), j = tileOf(z);
  let ok = true;
  if (id === 'raise' || id === 'lower') {
    if (!influenced(team, toX(vi0), toZ(vj0))) return say('Too far from your people');
    ok = id === 'raise' ? raiseVertex(vi0, vj0) : lowerVertex(vi0, vj0);
    if (!ok) { if (!fromAI) sfx.deny(); return false; }
  } else if (id === 'banner') {
    if (isWaterAt(x, z)) return say('Banners need dry land');
    placeBanner(team, toX(i) + 0.5, toZ(j) + 0.5);
  } else if (id === 'swamp') {
    let n = 0;
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) {
        const a = i + di, c = j + dj;
        if (Math.hypot(di, dj) > 2.1 || !isFlatLand(a, c) || buildings.some((b) => b.i === a && b.j === c)) continue;
        swamp[ti(a, c)] = 1; n++;
      }
    if (!n) return say('Swamps need flat land');
    for (let k = 0; k < 5; k++) emit(x + (Math.random() - 0.5) * 3, heightAt(x, z) + 0.1, z + (Math.random() - 0.5) * 3, 0x9fbf4a, 6, 0.6, 1.2, 0.9);
    terrainDirty = true;
    sfx.swamp();
  } else if (id === 'knight') {
    const cand = walkers.filter((w) => w.team === team && !w.dead && w.kind !== 'knight').sort((a, b) => (b.kind === 'leader') - (a.kind === 'leader') || b.s - a.s)[0];
    if (!cand || cand.s < 3) return say('You need a walker to knight (try Gather)');
    setKind(cand, 'knight');
    cand.s = Math.round(cand.s * 1.5 + 8);
    cand.think = 0;
    emit(cand.x, cand.y + 0.4, cand.z, 0xffe9a0, 30, 1.6, 3, 1.2);
    if (!fromAI) { sfx.knight(); toast('A Knight rides out!'); }
  } else if (id === 'quake') {
    const r = mulberry32((Date.now() & 0xffff) + vi0 * 31);
    for (let k = 0; k < 34; k++) {
      const a = r() * Math.PI * 2, d = r() * 4.5;
      const a2 = Math.round(vi0 + Math.cos(a) * d), b2 = Math.round(vj0 + Math.sin(a) * d);
      if (r() < 0.5) raiseVertex(a2, b2); else lowerVertex(a2, b2);
    }
    for (let k = 0; k < 6; k++) emit(x + (Math.random() - 0.5) * 7, heightAt(x, z) + 0.2, z + (Math.random() - 0.5) * 7, 0xa88a62, 10, 2, 1.5, 1);
    rig.shake = Math.max(rig.shake, 1.3);
    sfx.quake();
  } else if (id === 'volcano') {
    const h0 = Math.max(1, hgt[vi(clamp(vi0, 0, N), clamp(vj0, 0, N))]);
    for (let dj = -5; dj <= 5; dj++)
      for (let di = -5; di <= 5; di++) {
        const a = vi0 + di, c = vj0 + dj, d = Math.hypot(di, dj);
        if (!inVerts(a, c) || d > 5) continue;
        const target = Math.min(MAXH, vEdge(a, c), Math.round(h0 + 4.5 - d));
        while (hgt[vi(a, c)] < target && raiseVertex(a, c));
      }
    for (let dj = -3; dj < 3; dj++)
      for (let di = -3; di < 3; di++) if (inTiles(vi0 + di, vj0 + dj) && Math.hypot(di + 0.5, dj + 0.5) < 2.8) lava[ti(vi0 + di, vj0 + dj)] = 25;
    for (const w of walkers) if (!w.dead && Math.hypot(w.x - x, w.z - z) < 3.5) killWalker(w);
    emit(x, heightAt(x, z) + 1, z, 0xff6a2a, 70, 3, 5, 1.6);
    rig.shake = Math.max(rig.shake, 1.8);
    sfx.volcano();
  } else if (id === 'flood') {
    for (let k = 0; k < hgt.length; k++) if (hgt[k] > 0) hgt[k]--;
    swamp.fill(0);
    terrainDirty = true;
    for (let k = 0; k < 14; k++) emit((Math.random() - 0.5) * N * 0.8, WATER_Y + 0.1, (Math.random() - 0.5) * N * 0.8, 0xcfeeff, 10, 1.5, 2, 1);
    rig.shake = Math.max(rig.shake, 0.8);
    sfx.flood();
    toast(team === 0 ? 'The seas rise!' : 'The Crimson god floods the world!');
  } else if (id === 'armageddon') {
    armageddon = true;
    for (const b of buildings.slice()) removeBuilding(b, true);
    for (let t = 0; t < 2; t++) placeBanner(t, 0.5, 0.5);
    for (const w of walkers) w.think = 0;
    rig.shake = Math.max(rig.shake, 1.5);
    sfx.armageddon();
    toast('ARMAGEDDON: the final battle begins!');
  }
  mana[team] -= pw.cost;
  if (!fromAI) {
    if (id === 'raise') sfx.raise(); else if (id === 'lower') sfx.lower(); else if (id === 'banner') sfx.rally();
    if (id === 'raise' || id === 'lower') emit(toX(vi0), hgt[vi(vi0, vj0)] * HS + 0.05, toZ(vj0), 0xb59870, 8, 1.2, 1.3, 0.6);
  }
  return true;
}

// ------------------------------------------------------------------ simulation
let lavaT = 0;
function simulate(dt) {
  elapsed += dt;
  for (let t = 0; t < 2; t++) {
    let pop = 0;
    for (const b of buildings) if (b.team === t) pop += b.pop;
    mana[t] = Math.min(999, mana[t] + dt * (0.5 + pop * 0.04) * (t === 1 ? 0.8 + world * 0.1 : 1));
  }
  let lavaLeft = false;
  for (let k = 0; k < lava.length; k++) if (lava[k] > 0) { lava[k] -= dt; lavaLeft = true; if (lava[k] <= 0) terrainDirty = true; }
  if (lavaLeft) {
    lavaT += dt;
    if (lavaT > 0.15) { lavaT = 0; terrainDirty = true; }
    if (Math.random() < dt * 10) {
      const k = (Math.random() * lava.length) | 0;
      if (lava[k] > 0) emit(toX(k % N) + 0.5, tileInfo(k % N, (k / N) | 0).max * HS + 0.1, toZ((k / N) | 0) + 0.5, Math.random() < 0.6 ? 0xff8a3a : 0x5a5450, 2, 0.4, 2, 1.4, 0.5);
    }
  }
  if (Math.random() < dt * 3) {
    const k = (Math.random() * swamp.length) | 0;
    if (swamp[k]) emit(toX(k % N) + 0.5, tileInfo(k % N, (k / N) | 0).min * HS + 0.05, toZ((k / N) | 0) + 0.5, 0xb7d36a, 1, 0.1, 0.6, 0.8, 0.2);
  }

  const growMul = biome.grow;
  for (const b of buildings.slice()) {
    b.check -= dt;
    if (b.check <= 0) {
      b.check = 0.5;
      if (!isFlatLand(b.i, b.j)) { removeBuilding(b, !isWaterAt(bx(b), bz(b)) && lava[ti(b.i, b.j)] <= 0); if (b.team === 0) { stats.lost++; } continue; }
      setLevel(b, levelFor(b));
    }
    const L = LEVELS[b.level];
    b.pop = Math.min(L.cap, b.pop + L.grow * dt * growMul);
    if (b.pop >= L.cap - 0.01) {
      b.pop = L.cap * 0.5;
      addWalker(b.team, bx(b) + (Math.random() - 0.5) * 0.6, bz(b) + 0.6, Math.floor(L.cap * 0.5));
      emit(bx(b), by(b) + 0.8, bz(b), TEAM[b.team].light, 8, 0.6, 1.5, 0.8);
    }
    b.smoke -= dt;
    if (b.mesh.userData.chimney && b.smoke <= 0) {
      b.smoke = 0.5 + Math.random() * 0.6;
      const c = b.mesh.userData.chimney.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), b.mesh.rotation.y);
      emit(bx(b) + c.x, by(b) + c.y, bz(b) + c.z, 0xd8d8d8, 1, 0.15, 0.6, 1.8, -0.1);
    }
  }

  const alive = walkers.filter((w) => !w.dead);
  for (const w of alive) {
    const ci = tileOf(w.x), cj = tileOf(w.z);
    if (isWaterAt(w.x, w.z)) { killWalker(w); emit(w.x, WATER_Y + 0.1, w.z, biome.lavaSea ? 0xffa040 : 0xcfeeff, 10, 1, 1.5, 0.6); continue; }
    if (inTiles(ci, cj) && lava[ti(ci, cj)] > 0) { killWalker(w); emit(w.x, w.y + 0.2, w.z, 0xff7a1a, 10, 1, 1.5, 0.6); continue; }
    if (inTiles(ci, cj) && swamp[ti(ci, cj)] && w.kind !== 'knight') { killWalker(w); emit(w.x, w.y + 0.1, w.z, 0x9fbf4a, 10, 0.8, 1.4, 0.7); if (w.team === 1) stats.kills += w.s; continue; }
    w.think -= dt;
    if (w.think <= 0) { w.think = 0.8 + Math.random() * 0.6; decide(w, alive); }
    const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const slope = Math.abs(heightAt(w.x + (dx / d) * 0.3, w.z + (dz / d) * 0.3) - heightAt(w.x, w.z));
      const base = w.kind === 'knight' ? 1.7 : w.target?.kind === 'gather' || armageddon ? 1.5 : 1.1;
      const step = Math.min(d, (base / (1 + slope * 2)) * dt);
      const nx = w.x + (dx / d) * step, nz = w.z + (dz / d) * step;
      if (isWaterAt(nx, nz)) { w.target = null; w.think = 0; w.tx = w.x; w.tz = w.z; }
      else { w.x = nx; w.z = nz; }
      w.mesh.rotation.y = Math.atan2(dx, dz);
    } else if (w.target) arrive(w);
  }
  // meetings: friends merge, foes fight
  for (let a = 0; a < alive.length; a++) {
    const w = alive[a];
    if (w.dead) continue;
    for (let b = a + 1; b < alive.length; b++) {
      const o = alive[b];
      if (o.dead || Math.hypot(w.x - o.x, w.z - o.z) > 0.42) continue;
      if (o.team === w.team) {
        if (w.kind === 'knight' || o.kind === 'knight') continue;
        if (w.target?.kind === 'settle' || o.target?.kind === 'settle') continue;
        const keep = o.kind === 'leader' ? o : w, gone = keep === o ? w : o;
        keep.s += gone.s; killWalker(gone);
      } else {
        const pw = (u) => u.s * (u.kind === 'knight' ? 2 : 1);
        const big = pw(w) >= pw(o) ? w : o, small = big === w ? o : w;
        big.s = Math.max(1, Math.round(big.s - pw(small) / (big.kind === 'knight' ? 2 : 1)));
        killWalker(small);
        if (small.team === 1) stats.kills += small.s;
        emit((w.x + o.x) / 2, w.y + 0.35, (w.z + o.z) / 2, 0xffffff, 12, 1.4, 2, 0.5);
        sfx.clash();
      }
    }
  }
  walkers = walkers.filter((w) => !w.dead);
  for (const bn of banners) if (bn) bn.mesh.position.y = heightAt(bn.x, bn.z);

  aiThink(dt);
  if (elapsed > 3) {
    if (teamPop(1) <= 0) endGame(true);
    else if (teamPop(0) <= 0) endGame(false);
  }
}

function nearestEnemy(w, maxD, weakerOnly) {
  let best = null, bd = maxD;
  for (const b of buildings) {
    if (b.team === w.team || (weakerOnly && b.pop > w.s * 1.2)) continue;
    const d = Math.hypot(bx(b) - w.x, bz(b) - w.z);
    if (d < bd) { bd = d; best = { kind: 'attack', b }; }
  }
  for (const o of walkers) {
    if (o.team === w.team || o.dead || (weakerOnly && o.s >= w.s)) continue;
    const d = Math.hypot(o.x - w.x, o.z - w.z) * 0.9;
    if (d < bd) { bd = d; best = { kind: 'chase', o }; }
  }
  return best;
}
function goTo(w, target) {
  w.target = target;
  if (target.kind === 'attack') { w.tx = bx(target.b); w.tz = bz(target.b); }
  else if (target.kind === 'chase') { w.tx = target.o.x; w.tz = target.o.z; }
}
function decide(w) {
  const i = tileOf(w.x), j = tileOf(w.z);
  const m = armageddon ? 'fight' : modes[w.team];
  if (w.kind === 'knight') {
    const t = nearestEnemy(w, 99, false);
    if (t) return goTo(w, t);
  } else if (armageddon) {
    const t = nearestEnemy(w, 6, false);
    if (t) return goTo(w, t);
    w.target = { kind: 'gather' }; w.tx = 0.5 + (Math.random() - 0.5); w.tz = 0.5 + (Math.random() - 0.5);
    return;
  } else if (m === 'gather') {
    const bn = banners[w.team];
    if (bn) {
      w.target = { kind: 'gather' };
      w.tx = bn.x + (Math.random() - 0.5) * 0.3; w.tz = bn.z + (Math.random() - 0.5) * 0.3;
      if (Math.hypot(bn.x - w.x, bn.z - w.z) < 0.6 && w.kind === 'walker' && !walkers.some((o) => o.team === w.team && o.kind === 'leader' && !o.dead)) setKind(w, 'leader');
      return;
    }
  } else if (m === 'fight') {
    const t = nearestEnemy(w, 99, false);
    if (t) return goTo(w, t);
  }
  const near = nearestEnemy(w, 5, true);
  if (near) return goTo(w, near);
  if (w.target?.kind === 'settle' && canSettle(w.target.i, w.target.j)) return;
  let pick = null, ps = -Infinity;
  const R = 8;
  for (let dj = -R; dj <= R; dj++)
    for (let di = -R; di <= R; di++) {
      const a = i + di, c = j + dj;
      if (!canSettle(a, c)) continue;
      const sc = flatScore(a, c, 2) * 0.6 - Math.hypot(di, dj) * 0.4 + Math.random() * 0.6;
      if (sc > ps) { ps = sc; pick = { kind: 'settle', i: a, j: c }; }
    }
  if (pick) { w.target = pick; w.tx = toX(pick.i) + 0.5; w.tz = toZ(pick.j) + 0.5; return; }
  w.target = null;
  for (let k = 0; k < 8; k++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
    const tx = w.x + Math.cos(a) * r, tz = w.z + Math.sin(a) * r;
    if (!isWaterAt(tx, tz)) { w.tx = tx; w.tz = tz; break; }
  }
}
function arrive(w) {
  const t = w.target;
  w.target = null;
  if (t.kind === 'settle') {
    if (canSettle(t.i, t.j)) {
      addBuilding(t.i, t.j, w.team, w.s);
      killWalker(w);
      if (w.team === 0) { sfx.build(1); tip('settle', 'Your people settle on flat land. Flatten more around them!'); }
    }
  } else if (t.kind === 'attack') {
    const b = t.b;
    if (!buildings.includes(b)) return;
    const power = w.s * (w.kind === 'knight' ? 2 : 1);
    if (power > b.pop) {
      const lost = b.team === 0;
      removeBuilding(b, false);
      if (lost) { stats.lost++; toast('One of your homes fell!'); } else stats.kills += Math.floor(b.pop);
      if (w.kind === 'knight') {
        w.s = Math.max(1, Math.round(w.s - b.pop / 4));
        for (let k = 0; k < 3; k++) emit(bx(b), by(b) + 0.4, bz(b), k ? 0xff8a3a : 0x555555, 14, 1.2, 2.5, 1.3, 0.3);
      } else {
        addBuilding(b.i, b.j, w.team, Math.max(1, Math.floor(w.s - b.pop)));
        killWalker(w);
      }
      sfx.clash();
    } else { b.pop -= power; killWalker(w); }
  }
}

// ------------------------------------------------------------------ the rival god
let aiT = 0, aiSpellT = 10, aiModeT = 0;
function aiThink(dt) {
  aiT -= dt; aiSpellT -= dt; aiModeT -= dt;
  if (aiT > 0) return;
  aiT = Math.max(0.3, 1.1 - world * 0.1);
  const mine = buildings.filter((b) => b.team === 1);
  // Level the plots around its own homes so they grow.
  if (mine.length && mana[1] > 3) {
    const b = mine[(Math.random() * mine.length) | 0];
    const h = tileInfo(b.i, b.j).min;
    for (let k = 0; k < 2 + Math.floor(world / 2); k++) {
      const a = b.i - 2 + Math.floor(Math.random() * 6), c = b.j - 2 + Math.floor(Math.random() * 6);
      if (!inVerts(a, c) || (a >= b.i && a <= b.i + 1 && c >= b.j && c <= b.j + 1)) continue;
      const cur = hgt[vi(a, c)];
      if (cur < h) applyPower(1, 'raise', toX(a), toZ(c), true);
      else if (cur > h) applyPower(1, 'lower', toX(a), toZ(c), true);
    }
  }
  const theirs = buildings.filter((b) => b.team === 0).sort((a, b) => b.level - a.level || b.pop - a.pop);
  // Break the ground under player homes inside its reach.
  if (world >= 2 && Math.random() < 0.05 * world && mana[1] > 20) {
    const t = theirs.find((b) => influenced(1, bx(b), bz(b)));
    if (t) applyPower(1, 'lower', toX(t.i + (Math.random() < 0.5 ? 0 : 1)), toZ(t.j + (Math.random() < 0.5 ? 0 : 1)), true);
  }
  const p0 = teamPop(0), p1 = teamPop(1);
  if (aiModeT <= 0) {
    aiModeT = 12;
    modes[1] = p1 > p0 * 1.3 ? 'fight' : 'settle';
    if (modes[1] === 'fight') toast('The Crimson army marches!');
  }
  if (aiSpellT > 0 || !theirs.length) return;
  aiSpellT = Math.max(8, 26 - world * 2.5) + Math.random() * 8;
  const t = theirs[0], x = bx(t), z = bz(t);
  const can = (id) => world >= PW[id].world && mana[1] > PW[id].cost + 30;
  if (can('armageddon') && p1 > p0 * 1.4) applyPower(1, 'armageddon', 0, 0, true);
  else if (can('flood') && p1 > p0 && Math.random() < 0.3) applyPower(1, 'flood', 0, 0, true);
  else if (can('volcano') && Math.random() < 0.35) { applyPower(1, 'volcano', x + 1, z, true); toast('A volcano erupts in your lands!'); }
  else if (can('quake') && Math.random() < 0.5) { applyPower(1, 'quake', x, z, true); toast('Earthquake!'); }
  else if (can('knight') && Math.random() < 0.5) { if (applyPower(1, 'knight', 0, 0, true)) toast('A Crimson Knight rides out!'); }
  else if (world >= 2 && can('swamp')) {
    const prey = walkers.find((w) => w.team === 0 && !w.dead);
    if (prey) applyPower(1, 'swamp', prey.tx, prey.tz, true);
  }
}

// ------------------------------------------------------------------ input: drag pans, pinch zooms, twist turns, tap acts
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);
function pick(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(terrain, false)[0];
  let p = hit ? hit.point : null;
  if (!p || p.y < WATER_Y) {
    const q = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(waterPlane, q) && (!p || q.distanceTo(camera.position) < p.distanceTo(camera.position))) p = q;
  }
  if (!p || outside(p.x, p.z)) return null;
  return p;
}
const ptrs = new Map();
let gesture = null, press = null, repeatT = 0;
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => {
  try { cvs.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, repeating: false, multi: false };
  else if (press) press.multi = true;
  gesture = null;
});
cvs.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const prev = { x: p.x, y: p.y };
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    if (press && !press.moved && Math.hypot(p.x - press.x, p.y - press.y) < 10) return;
    if (press) press.moved = true;
    panBy(p.x - prev.x, p.y - prev.y);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (gesture) {
      rig.viewGoal = clamp(rig.viewGoal * (gesture.dist / dist), 9, 44);
      rig.viewH = rig.viewGoal;
      let da = ang - gesture.ang;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      rig.yawGoal += da; rig.yaw = rig.yawGoal;
      panBy(mid.x - gesture.mid.x, mid.y - gesture.mid.y);
    }
    gesture = { dist, ang, mid };
  }
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2 && gesture) { gesture = null; snapYaw(); }
  if (!press || e.pointerId !== press.id) return;
  if (!press.moved && !press.repeating && !press.multi && performance.now() - press.t < 450 && mode === 'play') useToolAt(press.x, press.y);
  press = null;
}
cvs.addEventListener('pointerup', endPtr);
cvs.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); press = null; gesture = null; });
cvs.addEventListener('wheel', (e) => { e.preventDefault(); rig.viewGoal = clamp(rig.viewGoal * (e.deltaY > 0 ? 1.12 : 0.89), 9, 44); }, { passive: false });
function panBy(dx, dy) {
  const ppw = rig.viewH / window.innerHeight;
  const rx = Math.cos(rig.yaw), rz = -Math.sin(rig.yaw), fx = -Math.sin(rig.yaw), fz = -Math.cos(rig.yaw);
  rig.target.x += -rx * dx * ppw + (fx * dy * ppw) / Math.sin(EL);
  rig.target.z += -rz * dx * ppw + (fz * dy * ppw) / Math.sin(EL);
}
function snapYaw() { rig.yawGoal = Math.round((rig.yawGoal - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4; }
function rotate(dir) { rig.yawGoal += (dir * Math.PI) / 2; snapYaw(); sfx.click(); }

function useToolAt(cx, cy) {
  const p = pick(cx, cy);
  if (!p) return;
  const sculpt = tool === 'raise' || tool === 'lower';
  const ok = applyPower(0, tool, p.x, p.z);
  const col = ok ? 0xffffff : 0xff6b6b;
  if (sculpt) {
    const a = vertOf(p.x), b = vertOf(p.z);
    cursor.position.set(toX(a), hgt[vi(clamp(a, 0, N), clamp(b, 0, N))] * HS + 0.02, toZ(b));
    cursor.userData.mat.color.set(col); cursor.visible = true; areaRing.visible = false;
  } else if (tool !== 'knight' && tool !== 'flood' && tool !== 'armageddon') {
    const r = { banner: 0.6, swamp: 2.2, quake: 4.5, volcano: 5 }[tool] || 1;
    areaRing.scale.setScalar(r); areaRing.position.set(p.x, Math.max(heightAt(p.x, p.z), WATER_Y) + 0.06, p.z);
    areaRing.material.color.set(col); areaRing.visible = true; cursor.visible = false;
  }
  cursorT = 0.7;
  updateHud();
}
function pressRepeat(dt) {
  if (!press || press.moved || press.multi || !(tool === 'raise' || tool === 'lower')) return;
  if (performance.now() - press.t < 380) return;
  press.repeating = true;
  repeatT -= dt;
  if (repeatT <= 0) { repeatT = 0.16; useToolAt(press.x, press.y); }
}
window.addEventListener('keydown', (e) => {
  const k = Number(e.key);
  if (k >= 1 && k <= POWERS.length) setTool(POWERS[k - 1].id);
  if (e.code === 'KeyQ') rotate(-1);
  if (e.code === 'KeyE') rotate(1);
  if (e.code === 'KeyS') setMode('settle');
  if (e.code === 'KeyG') setMode('gather');
  if (e.code === 'KeyF') setMode('fight');
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});

// ------------------------------------------------------------------ icons
const ICON = {
  raise: '<path d="M2 28 11 15l5 6 5-9 9 16Z" fill="#6cc04a" stroke="#2f6b1f" stroke-width="1.5" stroke-linejoin="round"/><path d="m16 2 6 7h-4v6h-4V9h-4Z" fill="#ffd54a" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/>',
  lower: '<path d="M2 15h28v14H2Z" fill="#9b6a3c"/><path d="M2 15h28v4H2Z" fill="#6cc04a"/><ellipse cx="16" cy="18.5" rx="8" ry="3.2" fill="#3a2414"/><path d="m16 16-6-7h4V2h4v7h4Z" fill="#ffd54a" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/>',
  banner: '<path d="M9 5v24" stroke="#c99a2e" stroke-width="3" stroke-linecap="round"/><path d="M10 6h15l-4 5 4 5H10Z" fill="#3b82f6"/><circle cx="9" cy="5" r="3" fill="none" stroke="#ffd54a" stroke-width="2"/>',
  swamp: '<ellipse cx="16" cy="23" rx="13" ry="6" fill="#56662c"/><ellipse cx="16" cy="22" rx="10" ry="4" fill="#7d8f3a"/><circle cx="11" cy="14" r="2.6" fill="none" stroke="#c4e07a" stroke-width="1.6"/><circle cx="19" cy="8" r="3.2" fill="none" stroke="#c4e07a" stroke-width="1.6"/><circle cx="22" cy="16" r="1.9" fill="none" stroke="#c4e07a" stroke-width="1.6"/>',
  knight: '<path d="M8 29V15a8 8 0 0 1 16 0v14Z" fill="#d5dbe3" stroke="#59616b" stroke-width="1.5"/><path d="M11 17h10v3H11Z" fill="#2b2f36"/><path d="M16 7c2-4 6-5 9-4-1 3-5 5-9 5Z" fill="#3b82f6"/><path d="M16 21v8" stroke="#59616b" stroke-width="1.5"/>',
  quake: '<path d="M2 12h28v17H2Z" fill="#a8743f"/><path d="M2 12h28v4H2Z" fill="#6cc04a"/><path d="m15 12 3 5-4 4 3 4-2 4" fill="none" stroke="#2a1708" stroke-width="2.4" stroke-linejoin="round"/><path d="m5 7 3 2m19-2-3 2M11 4l1 3m9-3-1 3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  volcano: '<path d="m3 29 9-16h8l9 16Z" fill="#6b5d55"/><path d="M12 13h8l-2 5-2-2-2 3Z" fill="#ff7a1a"/><circle cx="13" cy="7" r="2.6" fill="#ffb347"/><circle cx="19.5" cy="5" r="2" fill="#ff7a1a"/><circle cx="16" cy="9.5" r="1.6" fill="#ffd54a"/>',
  flood: '<path d="M2 12q3.5-4 7 0t7 0 7 0 7 0v17H2Z" fill="#3aa0e8"/><path d="M2 19q3.5-4 7 0t7 0 7 0 7 0v10H2Z" fill="#1e6fb8"/><path d="M2 12q3.5-4 7 0t7 0 7 0 7 0" fill="none" stroke="#bfe9ff" stroke-width="1.6"/>',
  armageddon: '<circle cx="16" cy="16" r="14" fill="#7a1d1d"/><path d="m8 6 15 15M24 6 9 21" stroke="#e8edf3" stroke-width="3" stroke-linecap="round"/><path d="m19 24 4-4m-10 4-4-4" stroke="#f2c14e" stroke-width="3" stroke-linecap="round"/>',
  settle: '<path d="M5 15 16 6l11 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M8 14v13h16V14L16 8Z" fill="currentColor"/><path d="M14 27v-7h4v7" fill="#1d2a44"/>',
  gather: '<path d="M9 4v25" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M10 5h15l-4 5 4 5H10Z" fill="currentColor"/>',
  fight: '<path d="M25 4 12 17M8 12l12 12M11 21l-6 6" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
  person: '<circle cx="16" cy="9" r="5.5" fill="#f0c39a"/><path d="M6 30c0-8 4.5-12 10-12s10 4 10 12Z" fill="currentColor"/>',
  castle: '<path d="M4 29V11h4v3h3v-3h4v3h2v-3h4v3h3v-3h4v18Z" fill="#e2d9c6" stroke="#5c5346" stroke-width="1.4" stroke-linejoin="round"/><path d="M13 29v-6a3 3 0 0 1 6 0v6Z" fill="#5c3a20"/>',
  mana: '<path d="m16 2 11 10-11 18L5 12Z" fill="#7fe3ff"/><path d="m16 2 11 10H5Z" fill="#d2f6ff"/><path d="M16 30 27 12H16Z" fill="#2bb3e6"/>',
  lock: '<rect x="8" y="14" width="16" height="13" rx="2.5" fill="currentColor"/><path d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="3"/>',
  sound: '<path d="M5 12h5l7-6v20l-7-6H5Z" fill="currentColor"/><path d="M21 11a6 6 0 0 1 0 10m3-14a11 11 0 0 1 0 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  muted: '<path d="M5 12h5l7-6v20l-7-6H5Z" fill="currentColor"/><path d="m21 12 7 8m0-8-7 8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  pause: '<rect x="8" y="6" width="5.5" height="20" rx="1.5" fill="currentColor"/><rect x="18.5" y="6" width="5.5" height="20" rx="1.5" fill="currentColor"/>',
  rotl: '<path d="M8 14a9 9 0 1 1 2.6 8.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="m3 9 5 7 6-5Z" fill="currentColor"/>',
  rotr: '<path d="M24 14a9 9 0 1 0-2.6 8.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="m29 9-5 7-6-5Z" fill="currentColor"/>',
  home: '<path d="M4 15 16 5l12 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M8 14v14h6v-7h4v7h6V14L16 8Z" fill="currentColor"/>',
  star: '<path d="m16 3 3.9 8.3 9.1 1.1-6.7 6.2 1.8 9L16 23l-8.1 4.6 1.8-9L3 12.4l9.1-1.1Z" fill="currentColor"/>',
};
const svg = (name) => `<svg viewBox="0 0 32 32" aria-hidden="true">${ICON[name]}</svg>`;
function paintIcons(root = document) { for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = svg(el.dataset.icon); }
paintIcons();

// ------------------------------------------------------------------ voxel logo
const GLYPHS = {
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
};
function drawVoxelLogo(canvas, text, cssWidth) {
  const lines = text.split('\n').map((line) => {
    const cols = [];
    for (const [k, ch] of [...line].entries()) {
      if (k) cols.push('.......');
      for (let x = 0; x < 5; x++) cols.push(GLYPHS[ch].map((r) => r[x]).join(''));
    }
    return cols;
  });
  const W = Math.max(...lines.map((l) => l.length)), GAP = 2, R = lines.length * 7 + (lines.length - 1) * GAP;
  const grid = Array.from({ length: R }, () => new Array(W).fill(false));
  lines.forEach((cols, li) => {
    const off = Math.floor((W - cols.length) / 2);
    cols.forEach((col, x) => { for (let y = 0; y < 7; y++) grid[li * (7 + GAP) + y][off + x] = col[y] === '#'; });
  });
  const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < R && grid[y][x];
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cell = Math.floor((cssWidth * dpr) / (W + 3));
  const depth = Math.round(cell * 0.45), pad = Math.round(cell * 0.5);
  canvas.width = W * cell + depth + pad * 2;
  canvas.height = R * cell + depth + pad * 2 + Math.round(cell * 0.5);
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  const g = canvas.getContext('2d');
  const ox = pad, oy = pad + depth;
  const line = Math.max(1, Math.round(dpr));
  g.fillStyle = 'rgba(0,0,0,0.28)';
  for (let x = 0; x < W; x++) for (let y = 0; y < R; y++) if (filled(x, y)) g.fillRect(ox + x * cell + depth * 0.6, oy + y * cell + cell * 0.5, cell, cell);
  for (let y = 0; y < R; y++)
    for (let x = W - 1; x >= 0; x--) {
      if (!filled(x, y)) continue;
      const px = ox + x * cell, py = oy + y * cell, top = !filled(x, y - 1);
      if (!filled(x + 1, y)) {
        g.fillStyle = '#9a6a35';
        g.beginPath(); g.moveTo(px + cell, py); g.lineTo(px + cell + depth, py - depth); g.lineTo(px + cell + depth, py + cell - depth); g.lineTo(px + cell, py + cell); g.closePath(); g.fill();
        if (top) { g.fillStyle = '#4f9a33'; g.beginPath(); g.moveTo(px + cell, py); g.lineTo(px + cell + depth, py - depth); g.lineTo(px + cell + depth, py - depth + cell * 0.25); g.lineTo(px + cell, py + cell * 0.25); g.fill(); }
      }
      if (top) {
        const tg = g.createLinearGradient(0, py - depth, 0, py);
        tg.addColorStop(0, '#a6ec74'); tg.addColorStop(1, '#79cf4c');
        g.fillStyle = tg;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + depth, py - depth); g.lineTo(px + cell + depth, py - depth); g.lineTo(px + cell, py); g.closePath(); g.fill();
      }
      const fg = g.createLinearGradient(0, py, 0, py + cell);
      fg.addColorStop(0, '#f4d398'); fg.addColorStop(1, '#d9a764');
      g.fillStyle = fg; g.fillRect(px, py, cell, cell);
      if (top) { g.fillStyle = '#6cc04a'; g.fillRect(px, py, cell, Math.round(cell * 0.25)); }
      g.strokeStyle = 'rgba(70,40,10,0.45)'; g.lineWidth = line;
      g.strokeRect(px + line / 2, py + line / 2, cell - line, cell - line);
    }
}
function layoutLogo() { const c = $('logo'); if (c) drawVoxelLogo(c, 'TERRA\nCUBE', Math.min(320, window.innerWidth - 48)); }
layoutLogo();
window.addEventListener('resize', layoutLogo);

// ------------------------------------------------------------------ UI
function buildPowerBar() {
  $('powers').innerHTML = POWERS.map((p) => {
    const locked = world < p.world;
    return `<button class="power${locked ? ' locked' : ''}" data-tool="${p.id}" aria-label="${p.name}">
      <i data-icon="${locked ? 'lock' : p.id}" class="ic"></i><span>${p.name}</span><em>${locked ? `World ${p.world}` : `✦${p.cost}`}</em></button>`;
  }).join('');
  paintIcons($('powers'));
  for (const b of document.querySelectorAll('.power')) b.addEventListener('click', () => { setTool(b.dataset.tool); sfx.click(); });
}
function setTool(t) {
  if (world < PW[t].world) { toast(`${PW[t].name} unlocks on World ${PW[t].world}`); return; }
  tool = t;
  for (const b of document.querySelectorAll('.power')) b.classList.toggle('active', b.dataset.tool === t);
  $('hint').textContent = PW[t].hint;
  if (t === 'knight' || t === 'flood' || t === 'armageddon') $('hint').textContent += ' Tap anywhere on the land to cast.';
  layoutGuides();
}
function setMode(m) {
  modes[0] = m;
  for (const b of document.querySelectorAll('.mode')) b.classList.toggle('active', b.dataset.mode === m);
  for (const w of walkers) if (w.team === 0) w.think = Math.min(w.think, 0.2);
}
for (const b of document.querySelectorAll('.mode')) b.addEventListener('click', () => {
  setMode(b.dataset.mode); sfx.click();
  if (b.dataset.mode === 'gather') toast('Gather at the banner!');
  if (b.dataset.mode === 'fight') toast('To arms!');
});
let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function tip(key, msg) { if (world === 1 && !tips[key]) { tips[key] = true; setTimeout(() => toast(msg), 600); } }
function updateHud() {
  const p0 = Math.round(teamPop(0)), p1 = Math.round(teamPop(1));
  $('pop0').textContent = p0; $('pop1').textContent = p1;
  $('tug-fill').style.width = `${(p0 / Math.max(1, p0 + p1)) * 100}%`;
  $('mana-fill').style.height = `${Math.min(100, (mana[0] / 450) * 100)}%`;
  $('mana').textContent = Math.floor(mana[0]);
  for (const b of document.querySelectorAll('.power')) b.classList.toggle('poor', mana[0] < PW[b.dataset.tool].cost);
  $('castles').textContent = buildings.filter((b) => b.team === 0 && b.level === 5).length;
}
function togglePause() {
  if (mode === 'play') { mode = 'pause'; $('pause').hidden = false; }
  else if (mode === 'pause') { mode = 'play'; $('pause').hidden = true; }
}
$('b-pause').addEventListener('click', () => { sfx.click(); togglePause(); });
$('resume').addEventListener('click', togglePause);
$('quit').addEventListener('click', () => { $('pause').hidden = true; showMenu(); });
$('rot-l').addEventListener('click', () => rotate(-1));
$('rot-r').addEventListener('click', () => rotate(1));
$('b-home').addEventListener('click', () => { sfx.click(); focusHome(); });

// progress: unlocked world and best stars per world
function progress() {
  const p = store.get('terracube.progress', null);
  if (p) return p;
  return { unlocked: clamp(store.get('shapers.world', 1), 1, MAX_WORLD), stars: {} };
}
function endGame(won) {
  if (mode !== 'play') return;
  mode = 'end';
  const p = progress();
  const stars = won ? (elapsed < 300 ? 3 : elapsed < 540 ? 2 : 1) : 0;
  if (won) {
    p.unlocked = Math.max(p.unlocked, Math.min(MAX_WORLD, world + 1));
    p.stars[world] = Math.max(p.stars[world] || 0, stars);
    store.set('terracube.progress', p);
  }
  $('end-title').textContent = won ? 'Victory!' : 'Defeat';
  $('end').classList.toggle('lose', !won);
  $('end-stars').innerHTML = [1, 2, 3].map((k) => `<i data-icon="star" class="ic star${k <= stars ? ' on' : ''}"></i>`).join('');
  paintIcons($('end-stars'));
  $('end-text').textContent = won ? `The Crimson god has no followers left on World ${world}.` : `Your people are gone. The Crimson god rules World ${world}.`;
  const m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60).toString().padStart(2, '0');
  $('end-stats').innerHTML = [['Time', `${m}:${s}`], ['Homes built', stats.built], ['Castles', stats.castles], ['Foes felled', Math.round(stats.kills)]]
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('end-next').hidden = !won || world >= MAX_WORLD;
  $('end-next').textContent = `World ${world + 1} ▶`;
  $('end').hidden = false;
  won ? sfx.win() : sfx.lose();
}
$('end-next').addEventListener('click', () => { $('end').hidden = true; startWorld(world + 1); });
$('end-retry').addEventListener('click', () => { $('end').hidden = true; startWorld(world); });
$('end-menu').addEventListener('click', () => { $('end').hidden = true; showMenu(); });

function showMenu() {
  mode = 'menu';
  document.body.classList.add('in-menu');
  const p = progress();
  $('worlds').innerHTML = Array.from({ length: MAX_WORLD }, (_, k) => k + 1).map((n) => {
    const b = biomeFor(n), locked = n > p.unlocked, st = p.stars[n] || 0;
    return `<button class="world-btn${locked ? ' locked' : ''}" data-w="${n}" ${locked ? 'disabled' : ''} style="--c1:${b.sky[0]};--c2:${b.sky[1]}">
      <b>${locked ? '' : n}</b>${locked ? '<i data-icon="lock" class="ic"></i>' : ''}<small>${b.name}</small>
      <span class="mini-stars">${[1, 2, 3].map((k) => `<i data-icon="star" class="ic${k <= st ? ' on' : ''}"></i>`).join('')}</span></button>`;
  }).join('');
  paintIcons($('worlds'));
  for (const b of document.querySelectorAll('.world-btn')) b.addEventListener('click', () => startWorld(+b.dataset.w));
  $('menu').hidden = false;
}
function startWorld(n) {
  sfx.init();
  $('menu').hidden = true;
  document.body.classList.remove('in-menu');
  newGame(n);
  focusHome();
  mode = 'play';
  setTool('raise');
  if (n === 1) setTimeout(() => toast('Tap the corners of the land to level it'), 400);
  else toast(`World ${n} · ${biome.name}: the Crimson god grows bolder`);
}
$('play').addEventListener('click', () => startWorld(progress().unlocked));

// ------------------------------------------------------------------ sound
const sfx = (() => {
  let ac = null, master = null, noiseBuf = null;
  const init = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = store.get('terracube.muted', false) ? 0 : 0.5; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; }
  };
  const tone = (f0, f1, dur, type, vol, delay = 0) => {
    if (!ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  const noise = (dur, f, vol, type = 'lowpass', delay = 0) => {
    if (!ac) return;
    const t = ac.currentTime + delay, s = ac.createBufferSource(); s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur);
  };
  return {
    init,
    raise: () => { tone(220, 330, 0.1, 'triangle', 0.12); noise(0.08, 900, 0.12); },
    lower: () => { tone(260, 160, 0.1, 'triangle', 0.12); noise(0.1, 500, 0.14); },
    deny: () => tone(170, 140, 0.12, 'triangle', 0.08),
    click: () => tone(880, 880, 0.04, 'sine', 0.05),
    rally: () => [523, 784].forEach((f, i) => tone(f, f, 0.25, 'triangle', 0.1, i * 0.1)),
    build: (lvl) => [392, 494, 587, 698, 784].slice(0, lvl + 1).forEach((f, i) => tone(f, f, 0.2, 'sine', 0.09, i * 0.07)),
    clash: () => { noise(0.07, 3200, 0.1, 'highpass'); tone(700, 350, 0.05, 'square', 0.03); },
    swamp: () => [0, 0.12, 0.25].forEach((d) => tone(120, 260, 0.12, 'sine', 0.12, d)),
    knight: () => [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.22, 'sawtooth', 0.05, i * 0.1)),
    quake: () => { noise(1.6, 180, 0.9); tone(50, 30, 1.4, 'sine', 0.5); },
    volcano: () => { noise(2, 260, 1); tone(70, 28, 1.8, 'sawtooth', 0.3); },
    flood: () => { noise(2.2, 700, 0.5); noise(2.2, 300, 0.6, 'lowpass', 0.3); },
    armageddon: () => [0, 0.35, 0.7, 1.05].forEach((d) => { noise(0.3, 150, 0.8, 'lowpass', d); tone(70, 50, 0.3, 'sine', 0.4, d); }),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.4, 'triangle', 0.12, i * 0.14)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.5, 'triangle', 0.12, i * 0.2)),
    mute(on) { if (master) master.gain.value = on ? 0 : 0.5; },
  };
})();
function syncMute() {
  const m = store.get('terracube.muted', false);
  $('b-mute').innerHTML = `<i class="ic">${svg(m ? 'muted' : 'sound')}</i>`;
}
$('b-mute').addEventListener('click', () => {
  const m = !store.get('terracube.muted', false);
  store.set('terracube.muted', m); sfx.mute(m); syncMute();
});
syncMute();

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
const MENU_TARGET = new THREE.Vector3(0, 1, 0);
let hudT = 0, guideT = 0, t = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  timeU.value = t;
  if (mode === 'play') { simulate(dt); pressRepeat(dt); }
  else if (mode === 'menu') { rig.yawGoal += dt * 0.1; rig.target.lerp(MENU_TARGET, 0.03); rig.viewGoal = 40; }
  if (rig.shake > 0) rig.shake = Math.max(0, rig.shake - dt * 1.6);
  updateCamera(dt);
  if (terrainDirty) {
    terrainDirty = false;
    rebuildTerrain(t);
    for (const b of buildings) b.mesh.position.y = by(b);
  }
  if (propsDirty) { propsDirty = false; layoutProps(); }
  guideT -= dt;
  if (guideT <= 0) { guideT = 0.5; layoutGuides(); }

  for (const w of walkers) {
    w.anim += dt * 12;
    const moving = Math.hypot(w.tx - w.x, w.tz - w.z) > 0.05;
    const g = heightAt(w.x, w.z);
    w.y += (g - w.y) * Math.min(1, dt * 12);
    w.mesh.position.set(w.x, w.y + (moving ? Math.abs(Math.sin(w.anim)) * 0.035 : 0), w.z);
    const [l, r] = w.mesh.userData.legs;
    l.position.z = moving ? Math.sin(w.anim) * 0.04 : 0; r.position.z = -l.position.z;
    w.mesh.scale.setScalar((w.kind === 'knight' ? 1.4 : 1) * (1 + Math.min(1, Math.log10(1 + w.s) * 0.4)));
  }
  for (const b of buildings) {
    if (b.grow < 1) { b.grow = Math.min(1, b.grow + dt * 3); const e = 1 - Math.pow(1 - b.grow, 3); b.mesh.scale.set(1, 0.2 + 0.8 * e, 1); }
    b.mesh.traverse((m) => { if (m.userData.flag) m.rotation.y = Math.sin(t * 3 + b.i) * 0.35; });
  }
  for (const bn of banners) if (bn) {
    bn.mesh.traverse((m) => { if (m.userData.flag) m.rotation.y = Math.sin(t * 2.5) * 0.4; });
    const gl = bn.mesh.userData.glow;
    gl.material.opacity = 0.3 + 0.25 * Math.sin(t * 3);
    gl.scale.setScalar(1 + 0.15 * Math.sin(t * 3));
  }
  if (cursorT > 0) {
    cursorT -= dt;
    const o = Math.max(0, cursorT * 1.6);
    cursor.userData.mat.opacity = o; areaRing.material.opacity = o;
    if (cursorT <= 0) cursor.visible = areaRing.visible = false;
  }
  updateParticles(dt);
  sun.position.set(rig.target.x - 16, 30, rig.target.z + 12);
  sun.target.position.copy(rig.target);
  hudT -= dt;
  if (hudT <= 0 && mode === 'play') { hudT = 0.2; updateHud(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
newGame(1);
showMenu();
requestAnimationFrame(frame);

// ------------------------------------------------------------------ version check
async function checkForUpdate() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { version } = await r.json();
    if (version && version !== APP_VERSION) $('update').hidden = false;
  } catch { /* offline: try again later */ }
}
$('update').addEventListener('click', () => location.reload());
checkForUpdate();
setInterval(checkForUpdate, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });

// Exposed for automated testing.
window.__terracube = {
  get state() { return { mode, world, buildings, walkers, mana, stats, tool, elapsed, modes, banners, armageddon }; },
  simulate, applyPower, startWorld, setTool, setMode, teamPop, rig, hgt, swamp, toX, toZ, N, useToolAt, endGame, rotate, pick,
  raiseVertex, lowerVertex, levelFor, drawVoxelLogo, tileInfo, influenced,
};
