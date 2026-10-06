import * as THREE from 'three';

// =====================================================================
// TERRACUBE: a modern take on Populous for phones (portrait).
// Voxel island, isometric camera. Sculpt the land, let your people
// settle flat ground, grow their homes into castles, outlast a rival god.
// =====================================================================

const APP_VERSION = '2.1';
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

// ------------------------------------------------------------------ constants
const N = 36;            // cells per side, one voxel column per cell
const MAXH = 6;          // tallest column (blocks)
const WATER_Y = 0.62;
const TEAM = [
  { name: 'Azure', color: 0x3b82f6, light: 0x93c5fd, css: '#3b82f6' },
  { name: 'Crimson', color: 0xe53935, light: 0xfca5a5, css: '#e53935' },
];
const LEVELS = [
  null,
  { name: 'Tent', cap: 6, grow: 0.35 },
  { name: 'Hut', cap: 14, grow: 0.6 },
  { name: 'House', cap: 26, grow: 0.9 },
  { name: 'Castle', cap: 50, grow: 1.4 },
];
const TOOLS = {
  raise:   { cost: 1,   hint: 'Tap a block to raise it. Hold to keep raising. Level ground lets homes grow.' },
  lower:   { cost: 1,   hint: 'Tap a block to dig it down. Sink it into the sea to drown what stands there.' },
  rally:   { cost: 25,  hint: 'Plant a banner. Your walkers march to it and fight what they meet.' },
  bolt:    { cost: 70,  hint: 'Lightning: strikes down walkers and burns a home.' },
  quake:   { cost: 140, hint: 'Earthquake: tears the ground apart in a wide area.' },
  volcano: { cost: 320, hint: 'Raise a volcano. Lava keeps everyone off its slopes for a while.' },
};

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('app').prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d6fae);

const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x705c40, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d8, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// Isometric camera rig: orthographic, fixed elevation, yaw snaps to 90° steps.
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
const EL = Math.atan(1 / Math.SQRT2); // true isometric: 35.26°
const rig = { target: new THREE.Vector3(0, 1, 0), yaw: Math.PI / 4, yawGoal: Math.PI / 4, viewH: 22, viewGoal: 22, shake: 0 };
function updateCamera(dt) {
  rig.yaw += (rig.yawGoal - rig.yaw) * Math.min(1, dt * 9);
  rig.viewH += (rig.viewGoal - rig.viewH) * Math.min(1, dt * 12);
  const half = N / 2 - 2;
  rig.target.x = Math.max(-half, Math.min(half, rig.target.x));
  rig.target.z = Math.max(-half, Math.min(half, rig.target.z));
  const dir = new THREE.Vector3(Math.sin(rig.yaw) * Math.cos(EL), Math.sin(EL), Math.cos(rig.yaw) * Math.cos(EL));
  const sx = rig.shake ? (Math.random() - 0.5) * rig.shake * 0.4 : 0, sy = rig.shake ? (Math.random() - 0.5) * rig.shake * 0.4 : 0;
  camera.position.copy(rig.target).addScaledVector(dir, 120);
  camera.position.x += sx; camera.position.y += sy;
  camera.lookAt(rig.target.x + sx, rig.target.y + sy, rig.target.z);
  const aspect = window.innerWidth / window.innerHeight;
  camera.top = rig.viewH / 2; camera.bottom = -rig.viewH / 2;
  camera.left = -rig.viewH * aspect / 2; camera.right = rig.viewH * aspect / 2;
  camera.updateProjectionMatrix();
}
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ block textures (procedural pixel art)
const TILE = { grassTop: 0, grassSide: 1, dirt: 2, sand: 3, stone: 4, snow: 5, snowSide: 6, lava: 7 };
const atlasTex = (() => {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  const r = mulberry32(42);
  const px = (t, x, y, col) => { g.fillStyle = col; g.fillRect(t * 16 + x, y, 1, 1); };
  const pick = (arr) => arr[(r() * arr.length) | 0];
  const GRASS = ['#6cc24a', '#62b743', '#77cf53', '#5aa83c', '#6cc24a'];
  const DIRT = ['#8a5a32', '#7a4e2a', '#996639', '#80532e', '#6f4625'];
  const SAND = ['#ead9a2', '#e2cf94', '#f0e1b0', '#d9c587'];
  const STONE = ['#8d8d8d', '#7f7f7f', '#999999', '#858585', '#737373'];
  const SNOW = ['#f4f8fb', '#e9f1f7', '#ffffff', '#dfe9f2'];
  const LAVA = ['#ff6a1a', '#ff8f1f', '#ffb42b', '#e8461a', '#ff7a1a'];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      px(TILE.grassTop, x, y, pick(GRASS));
      const drip = 3 + ((x * 7 + 3) % 5 === 0 ? 2 : (x * 5) % 3 === 0 ? 1 : 0);
      px(TILE.grassSide, x, y, y < drip ? pick(GRASS) : pick(DIRT));
      px(TILE.dirt, x, y, pick(DIRT));
      px(TILE.sand, x, y, pick(SAND));
      px(TILE.stone, x, y, pick(STONE));
      px(TILE.snow, x, y, pick(SNOW));
      px(TILE.snowSide, x, y, y < drip ? pick(SNOW) : pick(STONE));
      px(TILE.lava, x, y, pick(LAVA));
    }
  // a few stone cracks and pebbles
  for (let k = 0; k < 6; k++) { const x = (r() * 14) | 0, y = (r() * 14) | 0; px(TILE.stone, x, y, '#5f5f5f'); px(TILE.stone, x + 1, y, '#5f5f5f'); }
  for (let k = 0; k < 5; k++) { const x = (r() * 15) | 0, y = 6 + ((r() * 9) | 0); px(TILE.dirt, x, y, '#a9a9a9'); px(TILE.grassSide, x, y, '#a9a9a9'); }
  // darker rim on every tile so single blocks read clearly
  for (let t = 0; t < 8; t++) {
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(t * 16, 0, 16, 1); g.fillRect(t * 16, 15, 16, 1); g.fillRect(t * 16, 0, 1, 16); g.fillRect(t * 16 + 15, 0, 1, 16);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

// ------------------------------------------------------------------ terrain data
const hgt = new Int8Array(N * N);
const lava = new Float32Array(N * N); // seconds of lava left per cell
const ci = (i, j) => j * N + i;
const inGrid = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
const H = (i, j) => (inGrid(i, j) ? hgt[ci(i, j)] : -1);
const toX = (i) => i - N / 2;
const toZ = (j) => j - N / 2;
const cellOf = (x) => Math.floor(x + N / 2);
const edgeLimit = (i, j) => Math.min(i, j, N - 1 - i, N - 1 - j);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function valueNoise(rng) {
  const G = 8, grid = [];
  for (let k = 0; k < (G + 1) * (G + 1); k++) grid.push(rng());
  return (x, y) => {
    const gx = x * G, gy = y * G, i = Math.min(G - 1, Math.floor(gx)), j = Math.min(G - 1, Math.floor(gy));
    const fx = gx - i, fy = gy - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = grid[j * (G + 1) + i], b = grid[j * (G + 1) + i + 1], c = grid[(j + 1) * (G + 1) + i], d = grid[(j + 1) * (G + 1) + i + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
// Neighbouring columns differ by at most one block, so walkers can climb everywhere.
function relax() {
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const v = hgt[ci(i, j)];
        for (const [di, dj] of N4) {
          const a = i + di, b = j + dj;
          if (!inGrid(a, b)) continue;
          if (hgt[ci(a, b)] > v + 1) { hgt[ci(a, b)] = v + 1; changed = true; }
        }
      }
    if (!changed) break;
  }
}
const START = [[Math.round(N * 0.28), Math.round(N * 0.72)], [Math.round(N * 0.72), Math.round(N * 0.28)]];
function generateWorld(seed) {
  const rng = mulberry32(seed * 977 + 13);
  const n1 = valueNoise(rng), n2 = valueNoise(rng);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N, y = (j + 0.5) / N;
      const d = Math.hypot(x - 0.5, y - 0.5) / 0.5;
      let h = (1 - Math.pow(d, 1.8)) * 4.4 + (n1(x, y) - 0.5) * 5 + (n2(x * 0.7 + 0.15, y * 0.7) - 0.5) * 2.4 - 0.2;
      h = Math.max(0, Math.min(MAXH, Math.round(h)));
      hgt[ci(i, j)] = Math.min(h, edgeLimit(i, j));
    }
  for (const [cx, cy] of START)
    for (let j = cy - 3; j <= cy + 3; j++)
      for (let i = cx - 3; i <= cx + 3; i++) {
        const dist = Math.max(Math.abs(i - cx), Math.abs(j - cy));
        if (dist <= 2) hgt[ci(i, j)] = 2; else hgt[ci(i, j)] = Math.max(hgt[ci(i, j)], 1);
      }
  relax();
  lava.fill(0);
}
const isWaterCell = (i, j) => H(i, j) <= 0;
const isWaterAt = (x, z) => isWaterCell(cellOf(x), cellOf(z));
const groundAt = (x, z) => Math.max(0, H(cellOf(x), cellOf(z)));
const isLand = (i, j) => inGrid(i, j) && hgt[ci(i, j)] > 0 && lava[ci(i, j)] <= 0;

function raiseCell(i, j) {
  if (!inGrid(i, j) || hgt[ci(i, j)] >= Math.min(MAXH, edgeLimit(i, j))) return false;
  hgt[ci(i, j)]++;
  const q = [[i, j]];
  while (q.length) {
    const [a, b] = q.pop();
    const h = hgt[ci(a, b)];
    for (const [di, dj] of N4) {
      const x = a + di, y = b + dj;
      if (!inGrid(x, y)) continue;
      if (hgt[ci(x, y)] < h - 1) { hgt[ci(x, y)] = h - 1; q.push([x, y]); }
    }
  }
  terrainDirty = true;
  return true;
}
function lowerCell(i, j) {
  if (!inGrid(i, j) || hgt[ci(i, j)] <= 0) return false;
  hgt[ci(i, j)]--;
  const q = [[i, j]];
  while (q.length) {
    const [a, b] = q.pop();
    const h = hgt[ci(a, b)];
    for (const [di, dj] of N4) {
      const x = a + di, y = b + dj;
      if (!inGrid(x, y)) continue;
      if (hgt[ci(x, y)] > h + 1) { hgt[ci(x, y)] = h + 1; q.push([x, y]); }
    }
  }
  terrainDirty = true;
  return true;
}

// ------------------------------------------------------------------ voxel mesh
const terrainMat = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true });
const terrain = new THREE.Mesh(new THREE.BufferGeometry(), terrainMat);
terrain.receiveShadow = true;
terrain.castShadow = true;
scene.add(terrain);
let terrainDirty = true;

function topTile(i, j) {
  const h = H(i, j);
  if (lava[ci(i, j)] > 0) return TILE.lava;
  if (h <= 0) return TILE.sand;
  if (h >= 6) return TILE.snow;
  if (h === 5) return TILE.stone;
  if (h === 1 && N4.some(([a, b]) => H(i + a, j + b) === 0)) return TILE.sand;
  return TILE.grassTop;
}
function sideTile(top, layer, h) {
  if (layer === h - 1) {
    if (top === TILE.grassTop) return TILE.grassSide;
    if (top === TILE.snow) return TILE.snowSide;
    if (top === TILE.lava) return TILE.stone;
    return top;
  }
  if (top === TILE.sand && layer >= h - 2) return TILE.sand;
  return layer >= 3 ? TILE.stone : TILE.dirt;
}
function rebuildTerrain() {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const EPS = 0.002;
  const quad = (corners, n, tile, shades, tint = 1) => {
    // corners: [[x,y,z,u,v] x4], counter-clockwise seen from outside
    const base = pos.length / 3;
    const u0 = tile / 8 + EPS, u1 = (tile + 1) / 8 - EPS;
    for (let k = 0; k < 4; k++) {
      const c = corners[k];
      pos.push(c[0], c[1], c[2]);
      nor.push(n[0], n[1], n[2]);
      uv.push(u0 + (u1 - u0) * c[3], c[4] < 0.5 ? 0.01 : 0.99);
      const s = shades[k] * tint;
      col.push(s, s, tint < 1 ? Math.min(1, s * 1.1) : s);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const h = hgt[ci(i, j)];
      const x0 = toX(i), x1 = x0 + 1, z0 = toZ(j), z1 = z0 + 1, y = h;
      const tt = topTile(i, j);
      // ambient occlusion on top corners: darker where taller columns surround it
      const hi = (a, b) => (H(a, b) > h ? 1 : 0);
      const ao = (s1, s2, c) => (s1 && s2 ? 0.55 : 1 - (s1 + s2 + c) * 0.14);
      const aoA = ao(hi(i - 1, j), hi(i, j - 1), hi(i - 1, j - 1));
      const aoB = ao(hi(i - 1, j), hi(i, j + 1), hi(i - 1, j + 1));
      const aoC = ao(hi(i + 1, j), hi(i, j + 1), hi(i + 1, j + 1));
      const aoD = ao(hi(i + 1, j), hi(i, j - 1), hi(i + 1, j - 1));
      const tint = h <= 0 ? 0.78 : 1;
      quad([[x0, y, z0, 0, 1], [x0, y, z1, 0, 0], [x1, y, z1, 1, 0], [x1, y, z0, 1, 1]], [0, 1, 0], tt, [aoA, aoB, aoC, aoD], tint);
      // sides, one quad per exposed block layer, darker toward the base
      const sides = [
        { n: [1, 0, 0], nb: H(i + 1, j), c: (y0, y1) => [[x1, y0, z1, 0, 0], [x1, y0, z0, 1, 0], [x1, y1, z0, 1, 1], [x1, y1, z1, 0, 1]] },
        { n: [-1, 0, 0], nb: H(i - 1, j), c: (y0, y1) => [[x0, y0, z0, 0, 0], [x0, y0, z1, 1, 0], [x0, y1, z1, 1, 1], [x0, y1, z0, 0, 1]] },
        { n: [0, 0, 1], nb: H(i, j + 1), c: (y0, y1) => [[x0, y0, z1, 0, 0], [x1, y0, z1, 1, 0], [x1, y1, z1, 1, 1], [x0, y1, z1, 0, 1]] },
        { n: [0, 0, -1], nb: H(i, j - 1), c: (y0, y1) => [[x1, y0, z0, 0, 0], [x0, y0, z0, 1, 0], [x0, y1, z0, 1, 1], [x1, y1, z0, 0, 1]] },
      ];
      for (const s of sides) {
        const from = Math.max(s.nb, -1);
        if (from >= h) continue;
        const span = h - from;
        for (let layer = from; layer < h; layer++) {
          const b = 0.6 + 0.4 * ((layer - from) / span), t = 0.6 + 0.4 * ((layer + 1 - from) / span);
          const tile = layer < 0 ? TILE.sand : sideTile(tt, layer, h);
          quad(s.c(layer, layer + 1), s.n, tile, [b, b, t, t], tint);
        }
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  terrain.geometry.dispose();
  terrain.geometry = geo;
  layoutTrees();
}

// Sea: a translucent sheet with a soft bob, plus a deep floor around the island.
const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ color: 0x2a8fe0, transparent: true, opacity: 0.72 }));
water.position.y = WATER_Y;
scene.add(water);
const seaFloor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8a7a55 }));
seaFloor.position.y = -1;
scene.add(seaFloor);
// little foam cubes along the shore
const FOAM_MAX = 400;
const foam = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), new THREE.MeshBasicMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.8 }), FOAM_MAX);
scene.add(foam);
const foamSpots = [];
function layoutFoam() {
  foamSpots.length = 0;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (H(i, j) !== 0) continue;
      for (const [a, b] of N4) if (H(i + a, j + b) >= 1 && foamSpots.length < FOAM_MAX) foamSpots.push({ x: toX(i) + 0.5 + a * 0.42, z: toZ(j) + 0.5 + b * 0.42, p: Math.random() * 6, a, b });
    }
}

// ------------------------------------------------------------------ trees (voxel)
const TREE_MAX = 240;
const treeSpots = [];
const trunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.5, 0.18).translate(0, 0.25, 0), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), TREE_MAX);
const leafMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.56, 0.5, 0.56).translate(0, 0.66, 0), new THREE.MeshLambertMaterial({ color: 0x2f8a36 }), TREE_MAX);
const leafTop = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.22, 0.32).translate(0, 1.0, 0), new THREE.MeshLambertMaterial({ color: 0x3fa443 }), TREE_MAX);
trunkMesh.castShadow = leafMesh.castShadow = leafTop.castShadow = true;
scene.add(trunkMesh, leafMesh, leafTop);
const dummy = new THREE.Object3D();
function plantTrees(seed) {
  treeSpots.length = 0;
  const r = mulberry32(seed + 77);
  for (let k = 0; k < TREE_MAX; k++) {
    const i = 1 + ((r() * (N - 2)) | 0), j = 1 + ((r() * (N - 2)) | 0);
    treeSpots.push({ i, j, ox: (r() - 0.5) * 0.4, oz: (r() - 0.5) * 0.4, s: 0.75 + r() * 0.5, cleared: false });
  }
}
function layoutTrees() {
  let n = 0;
  for (const t of treeSpots) {
    if (t.cleared) continue;
    const h = H(t.i, t.j);
    if (h <= 0 || h >= 5 || lava[ci(t.i, t.j)] > 0 || buildingAt(t.i, t.j) || topTile(t.i, t.j) === TILE.sand) continue;
    dummy.position.set(toX(t.i) + 0.5 + t.ox, h, toZ(t.j) + 0.5 + t.oz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(t.s);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(n, dummy.matrix);
    leafMesh.setMatrixAt(n, dummy.matrix);
    leafTop.setMatrixAt(n, dummy.matrix);
    n++;
  }
  trunkMesh.count = leafMesh.count = leafTop.count = n;
  trunkMesh.instanceMatrix.needsUpdate = leafMesh.instanceMatrix.needsUpdate = leafTop.instanceMatrix.needsUpdate = true;
  layoutFoam();
}

// ------------------------------------------------------------------ models (blocky)
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const MAT = {
  wall: lam(0xf1e6cf), wallDark: lam(0xd9c9a6), plank: lam(0xa0703f), stone: lam(0xb4aea2), stoneDark: lam(0x8a8478),
  wood: lam(0x6b4a2b), skin: lam(0xf0c39a), door: lam(0x4a3020), dark: lam(0x2b2b33),
  glass: lam(0xffe08a, { emissive: 0xffb84a, emissiveIntensity: 0.5 }),
  team: TEAM.map((t) => lam(t.color)), teamLight: TEAM.map((t) => lam(t.light)),
};
const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const PYR = new THREE.ConeGeometry(0.71, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const FLAG = new THREE.BoxGeometry(0.26, 0.16, 0.03).translate(0.13, 0, 0);
function blk(mat, x, y, z, sx, sy, sz, geo = BOX) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function flagOn(g, team, x, y, z, h) {
  g.add(blk(MAT.wood, x, y, z, 0.04, h, 0.04));
  const f = new THREE.Mesh(FLAG, MAT.team[team]);
  f.position.set(x, y + h - 0.09, z);
  f.userData.flag = true;
  g.add(f);
}
function buildingModel(level, team) {
  const g = new THREE.Group();
  const T = MAT.team[team];
  if (level === 1) {
    g.add(blk(MAT.teamLight[team], 0, 0, 0, 0.62, 0.5, 0.62, PYR));
    g.add(blk(MAT.door, 0, 0, 0.2, 0.14, 0.22, 0.06));
    flagOn(g, team, 0, 0.42, 0, 0.3);
  } else if (level === 2) {
    g.add(blk(MAT.plank, 0, 0, 0, 0.62, 0.4, 0.56));
    g.add(blk(T, 0, 0.4, 0, 0.74, 0.34, 0.68, PYR));
    g.add(blk(MAT.door, 0, 0, 0.27, 0.16, 0.26, 0.04));
    g.add(blk(MAT.glass, 0.2, 0.16, 0.27, 0.11, 0.11, 0.04));
  } else if (level === 3) {
    g.add(blk(MAT.wall, -0.1, 0, 0, 0.66, 0.52, 0.66));
    g.add(blk(MAT.wood, -0.1, 0.52, 0, 0.7, 0.06, 0.7));
    g.add(blk(T, -0.1, 0.58, 0, 0.74, 0.36, 0.74, PYR));
    g.add(blk(MAT.wallDark, 0.32, 0, 0.16, 0.3, 0.36, 0.3));
    g.add(blk(T, 0.32, 0.36, 0.16, 0.36, 0.22, 0.36, PYR));
    g.add(blk(MAT.stoneDark, -0.3, 0.6, -0.18, 0.12, 0.34, 0.12));
    g.add(blk(MAT.door, -0.1, 0, 0.34, 0.16, 0.3, 0.03));
    for (const x of [-0.3, 0.1]) g.add(blk(MAT.glass, x, 0.26, 0.34, 0.12, 0.12, 0.03));
    flagOn(g, team, 0.32, 0.58, 0.16, 0.32);
  } else {
    g.add(blk(MAT.stone, 0, 0, 0, 1.5, 0.5, 1.5));
    for (const [x, z] of [[-0.66, -0.66], [0.66, -0.66], [-0.66, 0.66], [0.66, 0.66]]) {
      g.add(blk(MAT.stone, x, 0, z, 0.36, 0.95, 0.36));
      for (const [a, b] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) g.add(blk(MAT.stone, x + a, 0.95, z + b, 0.1, 0.12, 0.1));
      g.add(blk(T, x, 1.07, z, 0.3, 0.3, 0.3, PYR));
    }
    for (let k = -2; k <= 2; k++) for (const [a, b] of [[k * 0.25, -0.73], [k * 0.25, 0.73], [-0.73, k * 0.25], [0.73, k * 0.25]]) g.add(blk(MAT.stone, a, 0.5, b, 0.1, 0.1, 0.1));
    g.add(blk(MAT.stoneDark, 0, 0.5, 0, 0.8, 0.72, 0.8));
    g.add(blk(T, 0, 1.22, 0, 0.95, 0.5, 0.95, PYR));
    g.add(blk(MAT.door, 0, 0, 0.76, 0.28, 0.36, 0.04));
    for (const x of [-0.2, 0.2]) g.add(blk(MAT.glass, x, 0.82, 0.41, 0.12, 0.14, 0.02));
    flagOn(g, team, 0, 1.66, 0, 0.5);
  }
  return g;
}
function walkerModel(team) {
  const g = new THREE.Group();
  g.add(blk(MAT.team[team], 0, 0.1, 0, 0.17, 0.18, 0.11));
  g.add(blk(MAT.skin, 0, 0.28, 0, 0.14, 0.14, 0.14));
  g.add(blk(MAT.wood, 0, 0.4, 0, 0.15, 0.04, 0.15));
  const legL = blk(MAT.dark, -0.045, 0, 0, 0.06, 0.1, 0.07), legR = blk(MAT.dark, 0.045, 0, 0, 0.06, 0.1, 0.07);
  g.add(legL, legR);
  g.userData.legs = [legL, legR];
  return g;
}

// ------------------------------------------------------------------ particles (square points read as voxel chips)
const PMAX = 600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);
const parts = [];
function emit(x, y, z, color, n = 8, spread = 1, up = 2, life = 1) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    if (parts.length >= PMAX) parts.shift();
    parts.push({ x, y, z, vx: (Math.random() - 0.5) * spread, vy: up * (0.5 + Math.random() * 0.8), vz: (Math.random() - 0.5) * spread, life: life * (0.6 + Math.random() * 0.6), max: life, c });
  }
}
function updateParticles(dt) {
  for (let k = parts.length - 1; k >= 0; k--) {
    const p = parts[k];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(k, 1); continue; }
    p.vy -= 3 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  for (let k = 0; k < PMAX; k++) {
    const p = parts[k];
    if (p) {
      pPos[k * 3] = p.x; pPos[k * 3 + 1] = p.y; pPos[k * 3 + 2] = p.z;
      const f = Math.min(1, (p.life / p.max) * 1.5);
      pCol[k * 3] = p.c.r * f + (1 - f) * 0.6; pCol[k * 3 + 1] = p.c.g * f + (1 - f) * 0.6; pCol[k * 3 + 2] = p.c.b * f + (1 - f) * 0.6;
    } else pPos[k * 3 + 1] = -100;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

const bolts = [];
function lightning(x, y, z) {
  const pts = [];
  const px = x + (Math.random() - 0.5) * 2, pz = z + (Math.random() - 0.5) * 2;
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    pts.push(new THREE.Vector3(px + (x - px) * t + (Math.random() - 0.5) * (1 - t) * 1.4, 18 * (1 - t) + y * t, pz + (z - pz) * t + (Math.random() - 0.5) * (1 - t) * 1.4));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf2f8ff }));
  const glow = new THREE.PointLight(0xbfe0ff, 120, 18, 1.6);
  glow.position.set(x, y + 1.5, z);
  scene.add(line, glow);
  bolts.push({ line, glow, t: 0.35 });
}

// Cursor: a wireframe block outline, plus a ring for area spells.
const cursor = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true }));
cursor.visible = false;
scene.add(cursor);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
ring.visible = false;
scene.add(ring);
let cursorT = 0;

// ------------------------------------------------------------------ game state
let world = 1, mode = 'menu', tool = 'raise', elapsed = 0;
let buildings = [], walkers = [], beacons = [null, null];
const mana = [40, 40];
const stats = { built: 0, castles: 0, kills: 0, lost: 0 };

const buildingAt = (i, j) => buildings.find((b) => b.i === i && b.j === j) || null;
function buildingNear(i, j, r, except) {
  for (const b of buildings) if (b !== except && Math.max(Math.abs(b.i - i), Math.abs(b.j - j)) <= r) return b;
  return null;
}
function flatScore(i, j, r) {
  const h = H(i, j);
  let n = 0;
  for (let dj = -r; dj <= r; dj++)
    for (let di = -r; di <= r; di++) if (isLand(i + di, j + dj) && H(i + di, j + dj) === h) n++;
  return n;
}
const canSettle = (i, j) => isLand(i, j) && !buildingNear(i, j, 1) && flatScore(i, j, 1) >= 4;
function levelFor(b) {
  const s1 = flatScore(b.i, b.j, 1);
  if (s1 >= 9) return flatScore(b.i, b.j, 2) >= 25 && !buildingNear(b.i, b.j, 2, b) ? 4 : 3;
  return s1 >= 6 ? 2 : 1;
}
const bx = (b) => toX(b.i) + 0.5, bz = (b) => toZ(b.j) + 0.5;

function addBuilding(i, j, team, pop) {
  const b = { i, j, team, pop, level: 0, mesh: null, check: 0 };
  for (const t of treeSpots) if (t.i === i && t.j === j) t.cleared = true;
  buildings.push(b);
  setLevel(b, levelFor(b));
  if (team === 0) stats.built++;
  terrainDirty = true;
  return b;
}
function setLevel(b, level) {
  if (b.level === level && b.mesh) return;
  const up = level > b.level && b.level > 0;
  b.level = level;
  if (b.mesh) scene.remove(b.mesh);
  b.mesh = buildingModel(level, b.team);
  b.mesh.position.set(bx(b), H(b.i, b.j), bz(b));
  b.mesh.rotation.y = ((b.i * 7 + b.j * 3) % 4) * Math.PI / 2;
  scene.add(b.mesh);
  if (up) {
    emit(bx(b), H(b.i, b.j) + 0.8, bz(b), TEAM[b.team].light, 18, 1.6, 2.5, 1.1);
    if (b.team === 0) { sfx.build(level); if (level === 4) { stats.castles++; toast('A castle rises!'); } }
  }
}
function removeBuilding(b, spill = true) {
  scene.remove(b.mesh);
  buildings.splice(buildings.indexOf(b), 1);
  emit(bx(b), Math.max(0, H(b.i, b.j)) + 0.3, bz(b), 0xb8a888, 14, 1.4, 1.6, 0.9);
  if (spill && b.pop >= 1 && !isWaterCell(b.i, b.j)) addWalker(b.team, bx(b), bz(b), Math.floor(b.pop));
  terrainDirty = true;
}
function addWalker(team, x, z, strength) {
  const w = { team, x, z, y: groundAt(x, z), s: Math.max(1, strength), mesh: walkerModel(team), tx: x, tz: z, target: null, think: 0, anim: Math.random() * 6, dead: false };
  w.mesh.position.set(x, w.y, z);
  scene.add(w.mesh);
  walkers.push(w);
  return w;
}
function killWalker(w) { w.dead = true; scene.remove(w.mesh); }
function teamPop(team) {
  let p = 0;
  for (const b of buildings) if (b.team === team) p += b.pop;
  for (const w of walkers) if (w.team === team && !w.dead) p += w.s;
  return p;
}

function newGame(n) {
  world = n;
  for (const b of buildings) scene.remove(b.mesh);
  for (const w of walkers) scene.remove(w.mesh);
  for (const bc of beacons) if (bc) scene.remove(bc.mesh);
  buildings = []; walkers = []; beacons = [null, null];
  mana[0] = 40; mana[1] = 40 + world * 15;
  elapsed = 0;
  Object.assign(stats, { built: 0, castles: 0, kills: 0, lost: 0 });
  generateWorld(n);
  plantTrees(n);
  START.forEach(([si, sj], team) => {
    for (let k = 0; k < 4; k++) addWalker(team, toX(si) + 0.5 + (k % 2) * 0.6 - 0.3, toZ(sj) + 0.5 + Math.floor(k / 2) * 0.6 - 0.3, 5);
  });
  terrainDirty = true;
  $('world').textContent = `World ${world}`;
  setTool('raise');
}
function focusHome() {
  const [si, sj] = START[0];
  rig.target.set(toX(si), 1.5, toZ(sj));
  snapYaw();
  rig.viewGoal = 18;
}

// ------------------------------------------------------------------ powers
function applyTool(team, kind, x, z, fromAI = false) {
  const cost = TOOLS[kind].cost;
  if (mana[team] < cost) { if (!fromAI) { toast('Not enough mana'); sfx.deny(); } return false; }
  const i = cellOf(x), j = cellOf(z);
  let ok = true;
  if (kind === 'raise') ok = raiseCell(i, j);
  else if (kind === 'lower') ok = lowerCell(i, j);
  else if (kind === 'rally') {
    if (isWaterAt(x, z)) ok = false;
    else placeBeacon(team, toX(i) + 0.5, toZ(j) + 0.5);
  } else if (kind === 'bolt') {
    const y = groundAt(x, z);
    lightning(x, y, z);
    for (const w of walkers) if (!w.dead && Math.hypot(w.x - x, w.z - z) < 1.6) { killWalker(w); if (w.team !== team && team === 0) stats.kills += w.s; }
    for (const b of buildings.slice()) if (Math.hypot(bx(b) - x, bz(b) - z) < 1.4) { b.pop -= 25; if (b.pop <= 0) removeBuilding(b, false); }
    emit(x, y + 0.3, z, 0xffe9a0, 24, 3, 3, 0.8);
    rig.shake = Math.max(rig.shake, 0.3);
    sfx.bolt();
  } else if (kind === 'quake') {
    const r = mulberry32((Date.now() & 0xffff) + i * 31);
    for (let k = 0; k < 30; k++) {
      const a = r() * Math.PI * 2, d = r() * 4.2;
      const a2 = Math.round(i + Math.cos(a) * d), b2 = Math.round(j + Math.sin(a) * d);
      if (r() < 0.5) raiseCell(a2, b2); else lowerCell(a2, b2);
    }
    for (let k = 0; k < 5; k++) emit(x + (Math.random() - 0.5) * 6, groundAt(x, z) + 0.2, z + (Math.random() - 0.5) * 6, 0x9b7a52, 10, 2, 1.5, 1);
    rig.shake = Math.max(rig.shake, 1.3);
    sfx.quake();
  } else if (kind === 'volcano') {
    const h0 = Math.max(1, H(i, j));
    for (let dj = -4; dj <= 4; dj++)
      for (let di = -4; di <= 4; di++) {
        const a = i + di, b = j + dj, d = Math.hypot(di, dj);
        if (!inGrid(a, b) || d > 4.3) continue;
        const target = Math.min(MAXH, edgeLimit(a, b), Math.round(h0 + 3.6 - d));
        while (H(a, b) < target && raiseCell(a, b));
      }
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) if (inGrid(i + di, j + dj) && Math.hypot(di, dj) < 2.6) lava[ci(i + di, j + dj)] = 22;
    for (const w of walkers) if (!w.dead && Math.hypot(w.x - x, w.z - z) < 3.5) killWalker(w);
    emit(x, groundAt(x, z) + 1, z, 0xff6a2a, 60, 3, 5, 1.6);
    rig.shake = Math.max(rig.shake, 1.7);
    sfx.volcano();
  }
  if (!ok) { if (!fromAI && (kind === 'raise' || kind === 'lower')) sfx.deny(); return false; }
  mana[team] -= cost;
  if (!fromAI) {
    if (kind === 'raise') sfx.raise(); else if (kind === 'lower') sfx.lower(); else if (kind === 'rally') sfx.rally();
    if (kind === 'raise' || kind === 'lower') emit(toX(i) + 0.5, Math.max(0, H(i, j)) + 0.1, toZ(j) + 0.5, 0x9a6a3c, 8, 1.2, 1.4, 0.6);
  }
  return true;
}
function placeBeacon(team, x, z) {
  if (beacons[team]) scene.remove(beacons[team].mesh);
  const g = new THREE.Group();
  g.add(blk(MAT.stone, 0, 0, 0, 0.4, 0.16, 0.4));
  g.add(blk(MAT.wood, 0, 0.16, 0, 0.08, 1.3, 0.08));
  g.add(blk(MAT.team[team], 0.2, 1.1, 0, 0.4, 0.3, 0.04));
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshLambertMaterial({ color: TEAM[team].light, emissive: TEAM[team].color, emissiveIntensity: 1.2 }));
  top.position.y = 1.56;
  g.add(top);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 12, 0.5).translate(0, 6, 0), new THREE.MeshBasicMaterial({ color: TEAM[team].light, transparent: true, opacity: 0.16, depthWrite: false }));
  g.add(beam);
  g.position.set(x, groundAt(x, z), z);
  scene.add(g);
  beacons[team] = { x, z, mesh: g, top, t: team === 1 ? 30 : Infinity };
  for (const w of walkers) if (w.team === team) { w.target = null; w.think = 0; }
}

// ------------------------------------------------------------------ simulation
let lavaT = 0;
function simulate(dt) {
  elapsed += dt;
  for (let t = 0; t < 2; t++) {
    let pop = 0;
    for (const b of buildings) if (b.team === t) pop += b.pop;
    mana[t] = Math.min(999, mana[t] + dt * (0.6 + pop * 0.045) * (t === 1 ? 0.85 + world * 0.12 : 1));
  }
  let lavaLeft = false;
  for (let k = 0; k < lava.length; k++) if (lava[k] > 0) { lava[k] -= dt; lavaLeft = true; if (lava[k] <= 0) terrainDirty = true; }
  if (lavaLeft && Math.random() < dt * 8) {
    const k = (Math.random() * lava.length) | 0;
    if (lava[k] > 0) emit(toX(k % N) + 0.5, hgt[k] + 0.1, toZ((k / N) | 0) + 0.5, Math.random() < 0.5 ? 0xff8a3a : 0x5a5450, 2, 0.4, 2, 1.4);
  }

  for (const b of buildings.slice()) {
    b.check -= dt;
    if (b.check <= 0) {
      b.check = 0.5;
      if (!isLand(b.i, b.j)) { removeBuilding(b, !isWaterCell(b.i, b.j) && lava[ci(b.i, b.j)] <= 0); continue; }
      setLevel(b, levelFor(b));
    }
    const L = LEVELS[b.level];
    b.pop = Math.min(L.cap, b.pop + L.grow * dt);
    if (b.pop >= L.cap - 0.01) {
      b.pop = L.cap * 0.5;
      addWalker(b.team, bx(b) + (Math.random() - 0.5) * 0.6, bz(b) + 0.55, Math.floor(L.cap * 0.5));
      emit(bx(b), H(b.i, b.j) + 0.8, bz(b), TEAM[b.team].light, 6, 0.6, 1.5, 0.8);
    }
    if (Math.random() < dt * 0.4 * b.level) emit(bx(b), H(b.i, b.j) + 1, bz(b), 0xfff3c4, 1, 0.2, 1.4, 1.2);
  }

  const alive = walkers.filter((w) => !w.dead);
  for (const w of alive) {
    if (isWaterAt(w.x, w.z)) { killWalker(w); emit(w.x, WATER_Y + 0.1, w.z, 0xbfe6ff, 8, 1, 1.5, 0.6); continue; }
    if (lava[ci(cellOf(w.x), cellOf(w.z))] > 0) { killWalker(w); emit(w.x, w.y + 0.2, w.z, 0xff7a1a, 8, 1, 1.5, 0.6); continue; }
    w.think -= dt;
    if (w.think <= 0) { w.think = 0.9 + Math.random() * 0.6; decide(w, alive); }
    const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const climb = Math.abs(groundAt(w.x + dx / d * 0.4, w.z + dz / d * 0.4) - groundAt(w.x, w.z));
      const sp = (w.target?.kind === 'beacon' ? 1.6 : 1.15) / (1 + climb * 0.8);
      const step = Math.min(d, sp * dt);
      const nx = w.x + (dx / d) * step, nz = w.z + (dz / d) * step;
      if (isWaterAt(nx, nz) || lava[ci(cellOf(nx), cellOf(nz))] > 0) { w.target = null; w.think = 0; w.tx = w.x; w.tz = w.z; }
      else { w.x = nx; w.z = nz; }
      w.mesh.rotation.y = Math.atan2(dx, dz);
    } else if (w.target) arrive(w);
  }
  for (let a = 0; a < alive.length; a++) {
    const w = alive[a];
    if (w.dead) continue;
    for (let b = a + 1; b < alive.length; b++) {
      const o = alive[b];
      if (o.dead || Math.hypot(w.x - o.x, w.z - o.z) > 0.42) continue;
      if (o.team === w.team) {
        if (w.target?.kind !== 'settle' && o.target?.kind !== 'settle') { w.s += o.s; killWalker(o); }
      } else {
        const big = w.s >= o.s ? w : o, small = big === w ? o : w;
        big.s = Math.max(1, big.s - small.s);
        killWalker(small);
        if (small.team === 1) stats.kills += small.s;
        emit((w.x + o.x) / 2, w.y + 0.4, (w.z + o.z) / 2, 0xffffff, 10, 1.4, 2, 0.5);
        sfx.clash();
      }
    }
  }
  walkers = walkers.filter((w) => !w.dead);

  for (let t = 0; t < 2; t++) {
    const bc = beacons[t];
    if (!bc) continue;
    bc.t -= dt;
    bc.top.rotation.y += dt * 2;
    bc.mesh.position.y = groundAt(bc.x, bc.z);
    if (bc.t <= 0 || isWaterAt(bc.x, bc.z)) { scene.remove(bc.mesh); beacons[t] = null; }
  }

  aiThink(dt);

  if (elapsed > 3) {
    if (teamPop(1) <= 0) endGame(true);
    else if (teamPop(0) <= 0) endGame(false);
  }
}

function decide(w, alive) {
  const i = cellOf(w.x), j = cellOf(w.z);
  const bc = beacons[w.team];
  if (bc) { w.target = { kind: 'beacon' }; w.tx = bc.x + (Math.random() - 0.5) * 1.2; w.tz = bc.z + (Math.random() - 0.5) * 1.2; return; }
  let best = null, bestD = 7;
  for (const b of buildings) {
    if (b.team === w.team || b.pop > w.s * 1.3) continue;
    const d = Math.hypot(bx(b) - w.x, bz(b) - w.z);
    if (d < bestD) { bestD = d; best = { kind: 'attack', b }; }
  }
  if (!best) for (const o of alive) {
    if (o.team === w.team || o.dead || o.s >= w.s) continue;
    const d = Math.hypot(o.x - w.x, o.z - w.z);
    if (d < Math.min(bestD, 5)) { bestD = d; best = { kind: 'chase', o }; }
  }
  if (best) {
    w.target = best;
    if (best.kind === 'attack') { w.tx = bx(best.b); w.tz = bz(best.b); } else { w.tx = best.o.x; w.tz = best.o.z; }
    return;
  }
  if (w.target?.kind === 'settle' && canSettle(w.target.i, w.target.j)) return;
  let pick = null, pickScore = -Infinity;
  const R = 7;
  for (let dj = -R; dj <= R; dj++)
    for (let di = -R; di <= R; di++) {
      const a = i + di, b = j + dj;
      if (!canSettle(a, b)) continue;
      const sc = flatScore(a, b, 1) * 1.2 - Math.hypot(di, dj) * 0.35 + Math.random() * 0.5;
      if (sc > pickScore) { pickScore = sc; pick = { kind: 'settle', i: a, j: b }; }
    }
  if (pick) { w.target = pick; w.tx = toX(pick.i) + 0.5; w.tz = toZ(pick.j) + 0.5; return; }
  w.target = null;
  for (let k = 0; k < 6; k++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
    const tx = w.x + Math.cos(a) * r, tz = w.z + Math.sin(a) * r;
    if (!isWaterAt(tx, tz)) { w.tx = tx; w.tz = tz; break; }
  }
}
function arrive(w) {
  const t = w.target;
  w.target = null;
  if (t.kind === 'settle') {
    if (canSettle(t.i, t.j)) { addBuilding(t.i, t.j, w.team, w.s); killWalker(w); if (w.team === 0) sfx.build(1); }
  } else if (t.kind === 'attack') {
    const b = t.b;
    if (!buildings.includes(b)) return;
    if (w.s > b.pop) {
      const left = Math.max(1, Math.floor(w.s - b.pop));
      const lost = b.team === 0;
      removeBuilding(b, false);
      if (lost) { stats.lost++; toast('A home was overrun!'); } else stats.kills += Math.floor(b.pop);
      addBuilding(b.i, b.j, w.team, left);
      killWalker(w);
      sfx.clash();
    } else { b.pop -= w.s; killWalker(w); }
  }
}

// ------------------------------------------------------------------ rival god
let aiT = 0, aiSpellT = 8;
function aiThink(dt) {
  aiT -= dt; aiSpellT -= dt;
  if (aiT > 0) return;
  aiT = Math.max(0.35, 1.2 - world * 0.12);
  const mine = buildings.filter((b) => b.team === 1);
  if (mine.length && mana[1] > 4) {
    const b = mine[(Math.random() * mine.length) | 0];
    const h = H(b.i, b.j);
    for (let k = 0; k < 2 + Math.floor(world / 2); k++) {
      const a = b.i - 2 + Math.floor(Math.random() * 5), c = b.j - 2 + Math.floor(Math.random() * 5);
      if (!inGrid(a, c) || (a === b.i && c === b.j)) continue;
      const cur = H(a, c);
      if (cur < h) applyTool(1, 'raise', toX(a) + 0.5, toZ(c) + 0.5, true);
      else if (cur > h) applyTool(1, 'lower', toX(a) + 0.5, toZ(c) + 0.5, true);
    }
  }
  const p0 = teamPop(0), p1 = teamPop(1);
  const targets = buildings.filter((b) => b.team === 0).sort((a, b) => b.level - a.level || b.pop - a.pop);
  if (!beacons[1] && targets.length && p1 > p0 * 1.35 && mana[1] > 60 && Math.random() < 0.25) {
    applyTool(1, 'rally', bx(targets[0]), bz(targets[0]), true);
    toast('The Crimson god rallies an attack!');
  }
  if (aiSpellT <= 0 && targets.length) {
    aiSpellT = Math.max(9, 26 - world * 3) + Math.random() * 8;
    const x = bx(targets[0]), z = bz(targets[0]);
    if (world >= 3 && mana[1] > TOOLS.volcano.cost + 60 && Math.random() < 0.25) { applyTool(1, 'volcano', x + 1.5, z, true); toast('A volcano erupts in your lands!'); }
    else if (world >= 2 && mana[1] > TOOLS.quake.cost + 30 && Math.random() < 0.5) { applyTool(1, 'quake', x, z, true); toast('Earthquake!'); }
    else if (mana[1] > TOOLS.bolt.cost + 20) applyTool(1, 'bolt', x, z, true);
  }
}

// ------------------------------------------------------------------ input: drag pans, pinch zooms, twist turns, tap acts
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(terrain, false)[0];
  if (!hit) return null;
  // Step slightly into the block that was hit, so side taps pick that column.
  const n = hit.face.normal;
  const x = hit.point.x - n.x * 0.01, z = hit.point.z - n.z * 0.01;
  return { x, z, i: cellOf(x), j: cellOf(z) };
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
      rig.viewGoal = Math.max(9, Math.min(40, rig.viewGoal * (gesture.dist / dist)));
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
cvs.addEventListener('wheel', (e) => { e.preventDefault(); rig.viewGoal = Math.max(9, Math.min(40, rig.viewGoal * (e.deltaY > 0 ? 1.12 : 0.89))); }, { passive: false });
function panBy(dx, dy) {
  const ppw = rig.viewH / window.innerHeight;
  const rx = Math.cos(rig.yaw), rz = -Math.sin(rig.yaw), fx = -Math.sin(rig.yaw), fz = -Math.cos(rig.yaw);
  rig.target.x += -rx * dx * ppw + fx * dy * ppw / Math.sin(EL);
  rig.target.z += -rz * dx * ppw + fz * dy * ppw / Math.sin(EL);
}
function snapYaw() { rig.yawGoal = Math.round((rig.yawGoal - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4; }
function rotate(dir) { rig.yawGoal += dir * Math.PI / 2; snapYaw(); sfx.click(); }

function useToolAt(cx, cy) {
  const p = pick(cx, cy);
  if (!p || !inGrid(p.i, p.j)) return;
  const sculpt = tool === 'raise' || tool === 'lower';
  const ok = applyTool(0, tool, sculpt ? toX(p.i) + 0.5 : p.x, sculpt ? toZ(p.j) + 0.5 : p.z);
  const col = ok ? 0xffffff : 0xff6b6b;
  if (sculpt || tool === 'rally') {
    cursor.position.set(toX(p.i) + 0.5, Math.max(0, H(p.i, p.j)) - 0.5, toZ(p.j) + 0.5);
    cursor.material.color.set(col); cursor.visible = true; ring.visible = false;
  } else {
    const r = tool === 'quake' ? 4.2 : tool === 'volcano' ? 3.5 : 1.6;
    ring.scale.setScalar(r); ring.position.set(p.x, groundAt(p.x, p.z) + 0.08, p.z);
    ring.material.color.set(col); ring.visible = true; cursor.visible = false;
  }
  cursorT = 0.6;
  updateHud();
}
function pressRepeat(dt) {
  if (!press || press.moved || press.multi || !(tool === 'raise' || tool === 'lower')) return;
  if (performance.now() - press.t < 380) return;
  press.repeating = true;
  repeatT -= dt;
  if (repeatT <= 0) { repeatT = 0.15; useToolAt(press.x, press.y); }
}
window.addEventListener('keydown', (e) => {
  const map = { Digit1: 'raise', Digit2: 'lower', Digit3: 'rally', Digit4: 'bolt', Digit5: 'quake', Digit6: 'volcano' };
  if (map[e.code]) setTool(map[e.code]);
  if (e.code === 'KeyQ') rotate(-1);
  if (e.code === 'KeyE') rotate(1);
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});

// ------------------------------------------------------------------ pixel-art icons
const PIX = {
  k: '#1b1a1f', w: '#ffffff', l: '#d6d6d6', g: '#5fbf3a', G: '#3d8a26', d: '#8b5a2b', D: '#5e3b1a', s: '#9a9a9a', S: '#6b6b6b',
  y: '#ffd23f', Y: '#e8a400', o: '#ff7a1a', r: '#e53935', R: '#9b1c1c', b: '#3b82f6', B: '#1e40af', c: '#7fe3ff', C: '#2bb3e6',
  n: '#6b4a2b', f: '#f0c39a', h: '#5a3a1e',
};
const ICONS = {
  raise: ['.....yy.....', '....yyyy....', '...yyyYyy...', '.....yY.....', '.gggggggggg.', '.gGggggggGg.', '.GGGGGGGGGG.', '.dddddddddd.', '.dDdddddDdd.', '.ddddDddddd.', '.DdddddddDd.', '.DDDDDDDDDD.'],
  lower: ['.....yY.....', '.....yY.....', '...yyyyyy...', '....yyYy....', '.....yY.....', '.gggkkkkggg.', '.GGGkkkkGGG.', '.ddddkkdddd.', '.dDdddddDdd.', '.ddddDddddd.', '.DdddddddDd.', '.DDDDDDDDDD.'],
  rally: ['..nbbbbbb...', '..nbbbbbbbb.', '..nbbwwbbbb.', '..nbbwwbbbb.', '..nbbbbbbbb.', '..nbbbbbb...', '..n.........', '..n.........', '..n.........', '.sss........', 'sssss.......', 'SSSSS.......'],
  bolt: ['......yyyy..', '.....yyyY...', '....yyyY....', '...yyyY.....', '..yyyyyyyy..', '......yyY...', '.....yyY....', '....yyY.....', '...yyY......', '..yyY.......', '..yY........', '.Y..........'],
  quake: ['............', '.s.......s..', '..s.....s...', 'ggggGk.ggggg', 'GGGGkkGGGGGG', 'ddddkddddddd', 'dddkkddDdddd', 'dDdkdddddddd', 'ddkkddddDddd', 'dddkdDdddddd', 'DDDkDDDDDDDD', '............'],
  volcano: ['....o..o....', '...oyo.o....', '....oyo.....', '.....yo.....', '....SoRS....', '...SSRoSS...', '...SSoRSS...', '..SSSRoSSS..', '..SSoSSSSS..', '.SSoSSSSSSS.', 'SSSSSSSSSSSS', 'SSSSSSSSSSSS'],
  mana: ['............', '....cccc....', '...cwwcCc...', '..cwcccCCc..', '.ccccccCCCc.', '.CcccccCCCC.', '..CccccCCC..', '...CcccCC...', '....CcCC....', '.....CC.....', '............', '............'],
  person: ['....hhhh....', '...hhhhhh...', '....ffff....', '....fkfk....', '....ffff....', '..bbbbbbbb..', '..bbbbbbbb..', '..fbbbbbbf..', '..fbbbbbbf..', '....BBBB....', '....B..B....', '....k..k....'],
  house: ['............', '.....bb.....', '....bbbb....', '...bbbbbb...', '..bbbbbbbb..', '.bbbbbbbbbb.', '..wwwwwwww..', '..wnnwwccw..', '..wnnwwccw..', '..wnnwwwww..', '..wnnwwwww..', '..DDDDDDDD..'],
  castle: ['.s.s....s.s.', '.sss....sss.', '.sss.ss.sss.', '.ssssssssss.', '.sSssssssSs.', '.ssssbbssss.', '.ssssbbssss.', '.ssssssssss.', '.sssskkssss.', '.sssskkssss.', '.SSSSkkSSSS.', '............'],
};
function pixelIcon(name, remap = {}) {
  const c = document.createElement('canvas');
  c.width = 12; c.height = 12;
  const g = c.getContext('2d');
  ICONS[name].forEach((row, y) => {
    for (let x = 0; x < 12; x++) {
      const ch = remap[row[x]] || row[x];
      if (!ch || ch === '.' || !PIX[ch]) continue;
      g.fillStyle = PIX[ch]; g.fillRect(x, y, 1, 1);
    }
  });
  return c.toDataURL();
}
for (const img of document.querySelectorAll('img[data-icon]')) {
  const remap = img.dataset.team === '1' ? { b: 'r', B: 'R' } : {};
  img.src = pixelIcon(img.dataset.icon, remap);
}


// ------------------------------------------------------------------ voxel logo
// Each pixel of a 5×7 bitmap font becomes a grass-topped block drawn in oblique 3D.
const GLYPHS = {
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
};
function drawVoxelLogo(canvas, text, cssWidth) {
  // Lay out each line as columns of a 7-row bitmap, centre the lines, stack them with a gap.
  const lines = text.split('\n').map((line) => {
    const cols = [];
    for (const [k, ch] of [...line].entries()) {
      if (k) cols.push('.......');
      const g = GLYPHS[ch];
      for (let x = 0; x < 5; x++) cols.push(g.map((r) => r[x]).join(''));
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
  const depth = Math.round(cell * 0.45);
  const pad = Math.round(cell * 0.4);
  canvas.width = W * cell + depth + pad * 2;
  canvas.height = R * cell + depth + pad * 2 + Math.round(cell * 0.5);
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  const g = canvas.getContext('2d');
  const rng = mulberry32(7);
  const sub = Math.max(1, Math.round(cell / 6)); // texture pixel size
  const noisy = (x0, y0, w, h, palette) => {
    for (let y = 0; y < h; y += sub)
      for (let x = 0; x < w; x += sub) { g.fillStyle = palette[(rng() * palette.length) | 0]; g.fillRect(x0 + x, y0 + y, Math.min(sub, w - x), Math.min(sub, h - y)); }
  };
  const GRASS = ['#7ad451', '#6cc24a', '#86e05c', '#62b743'], GRASS_D = ['#58a63a', '#4f9a33', '#5fae3f'];
  const DIRT = ['#8a5a32', '#7a4e2a', '#996639', '#80532e'], DIRT_D = ['#5e3b1a', '#674221', '#55361a'];
  const ox = pad, oy = pad + depth;
  // drop shadow
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = 0; x < W; x++) for (let y = 0; y < R; y++) if (filled(x, y)) g.fillRect(ox + x * cell + depth * 0.5, oy + y * cell + cell * 0.45, cell, cell);
  // back-to-front: right columns first so left blocks overlap their side faces, bottom rows last
  for (let y = 0; y < R; y++)
    for (let x = W - 1; x >= 0; x--) {
      if (!filled(x, y)) continue;
      const px = ox + x * cell, py = oy + y * cell;
      const topOpen = !filled(x, y - 1);
      if (!filled(x + 1, y)) { // right face
        g.save();
        g.beginPath(); g.moveTo(px + cell, py); g.lineTo(px + cell + depth, py - depth); g.lineTo(px + cell + depth, py + cell - depth); g.lineTo(px + cell, py + cell); g.closePath(); g.clip();
        noisy(px + cell, py - depth, depth, cell + depth, DIRT_D);
        if (topOpen) { g.fillStyle = GRASS_D[0]; g.beginPath(); g.moveTo(px + cell, py); g.lineTo(px + cell + depth, py - depth); g.lineTo(px + cell + depth, py - depth + cell * 0.3); g.lineTo(px + cell, py + cell * 0.3); g.fill(); }
        g.restore();
      }
      if (topOpen) { // top face
        g.save();
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + depth, py - depth); g.lineTo(px + cell + depth, py - depth); g.lineTo(px + cell, py); g.closePath(); g.clip();
        noisy(px, py - depth, cell + depth, depth, GRASS);
        g.restore();
      }
      // front face: dirt, with a grass fringe when the block is exposed on top
      noisy(px, py, cell, cell, DIRT);
      if (topOpen) {
        noisy(px, py, cell, Math.round(cell * 0.28), GRASS);
        for (let k = 0; k < cell; k += sub) if (rng() < 0.45) { g.fillStyle = GRASS[1]; g.fillRect(px + k, py + Math.round(cell * 0.28), sub, sub); }
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, dpr * 0.75);
      g.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
    }
}
function layoutLogo() {
  const c = $('logo');
  if (c) drawVoxelLogo(c, 'TERRA\nCUBE', Math.min(330, window.innerWidth - 40));
}
layoutLogo();
window.addEventListener('resize', layoutLogo);

// ------------------------------------------------------------------ UI
function setTool(t) {
  tool = t;
  for (const b of document.querySelectorAll('.tool')) b.classList.toggle('active', b.dataset.tool === t);
  $('hint').textContent = TOOLS[t].hint;
}
for (const b of document.querySelectorAll('.tool')) {
  b.addEventListener('click', () => { setTool(b.dataset.tool); sfx.click(); });
  b.querySelector('.cost').textContent = TOOLS[b.dataset.tool].cost;
}
let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function updateHud() {
  const p0 = Math.round(teamPop(0)), p1 = Math.round(teamPop(1));
  $('pop0').textContent = p0; $('pop1').textContent = p1;
  $('balance').style.width = `${(p0 / Math.max(1, p0 + p1)) * 100}%`;
  $('mana-fill').style.height = `${Math.min(100, (mana[0] / 400) * 100)}%`;
  $('mana').textContent = Math.floor(mana[0]);
  for (const b of document.querySelectorAll('.tool')) b.classList.toggle('poor', mana[0] < TOOLS[b.dataset.tool].cost);
  const homes = buildings.filter((b) => b.team === 0);
  $('homes').textContent = homes.length;
  $('castles').textContent = homes.filter((b) => b.level === 4).length;
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

function endGame(won) {
  if (mode !== 'play') return;
  mode = 'end';
  const best = store.get('shapers.world', 1);
  if (won && world + 1 > best) store.set('shapers.world', world + 1);
  $('end-title').textContent = won ? 'Victory!' : 'Defeat';
  $('end').classList.toggle('lose', !won);
  $('end-text').textContent = won ? `The Crimson god has no followers left on World ${world}.` : `Your people are gone. The Crimson god rules World ${world}.`;
  const m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60).toString().padStart(2, '0');
  $('end-stats').innerHTML = [['Time', `${m}:${s}`], ['Homes built', stats.built], ['Castles', stats.castles], ['Foes felled', Math.round(stats.kills)]]
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('end-next').hidden = !won;
  $('end-next').textContent = `World ${world + 1}  ▶`;
  $('end').hidden = false;
  won ? sfx.win() : sfx.lose();
}
$('end-next').addEventListener('click', () => { $('end').hidden = true; startWorld(world + 1); });
$('end-retry').addEventListener('click', () => { $('end').hidden = true; startWorld(world); });

function showMenu() {
  mode = 'menu';
  document.body.classList.add('in-menu');
  const best = store.get('shapers.world', 1);
  $('worlds').innerHTML = Array.from({ length: Math.max(5, best) }, (_, k) => k + 1)
    .map((n) => `<button class="world-btn" data-w="${n}" ${n > best ? 'disabled' : ''}>${n > best ? '🔒' : n}</button>`).join('');
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
  toast(n === 1 ? 'Level the ground near your people!' : `World ${n}: the Crimson god grows bolder`);
}
$('play').addEventListener('click', () => startWorld(store.get('shapers.world', 1)));

// ------------------------------------------------------------------ sound
const sfx = (() => {
  let ac = null, master = null, noiseBuf = null;
  const init = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = store.get('shapers.muted', false) ? 0 : 0.5; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; }
  };
  const tone = (f0, f1, dur, type, vol, delay = 0) => {
    if (!ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  const noise = (dur, f, vol, type = 'lowpass') => {
    if (!ac) return;
    const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur);
  };
  return {
    init,
    raise: () => { tone(180, 300, 0.09, 'square', 0.07); noise(0.08, 900, 0.18); },
    lower: () => { tone(240, 120, 0.09, 'square', 0.07); noise(0.1, 500, 0.2); },
    deny: () => tone(160, 130, 0.12, 'square', 0.06),
    click: () => tone(880, 880, 0.04, 'square', 0.04),
    rally: () => [523, 784].forEach((f, i) => tone(f, f, 0.22, 'square', 0.06, i * 0.1)),
    build: (lvl) => [392, 494, 587, 784].slice(0, lvl + 1).forEach((f, i) => tone(f, f, 0.14, 'square', 0.05, i * 0.07)),
    clash: () => { noise(0.08, 3000, 0.12, 'highpass'); tone(600, 300, 0.06, 'square', 0.04); },
    bolt: () => { noise(0.5, 4000, 0.5, 'highpass'); tone(90, 40, 0.5, 'sawtooth', 0.2); },
    quake: () => { noise(1.6, 180, 0.9); tone(50, 30, 1.4, 'sine', 0.5); },
    volcano: () => { noise(2, 260, 1); tone(70, 28, 1.8, 'sawtooth', 0.3); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.3, 'square', 0.07, i * 0.13)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.4, 'square', 0.07, i * 0.2)),
    mute(on) { if (master) master.gain.value = on ? 0 : 0.5; },
  };
})();
function syncMute() { $('b-mute').classList.toggle('off', store.get('shapers.muted', false)); }
$('b-mute').addEventListener('click', () => {
  const m = !store.get('shapers.muted', false);
  store.set('shapers.muted', m); sfx.mute(m); syncMute();
});
syncMute();

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
const MENU_TARGET = new THREE.Vector3(0, 1, 0);
let hudT = 0, t = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  if (mode === 'play') { simulate(dt); pressRepeat(dt); }
  else if (mode === 'menu') { rig.yawGoal += dt * 0.12; rig.target.lerp(MENU_TARGET, 0.03); rig.viewGoal = 34; }
  if (rig.shake > 0) rig.shake = Math.max(0, rig.shake - dt * 1.6);
  updateCamera(dt);
  if (terrainDirty) { terrainDirty = false; rebuildTerrain(); for (const b of buildings) b.mesh.position.y = H(b.i, b.j); }
  if (lava.some((v) => v > 0)) { lavaT += dt; if (lavaT > 0.3) { lavaT = 0; atlasShimmer(); } }

  for (const w of walkers) {
    w.anim += dt * 12;
    const moving = Math.hypot(w.tx - w.x, w.tz - w.z) > 0.05;
    const g = groundAt(w.x, w.z);
    w.y += (g - w.y) * Math.min(1, dt * 10);
    w.mesh.position.set(w.x, w.y + (moving ? Math.abs(Math.sin(w.anim)) * 0.04 : 0), w.z);
    const [l, r] = w.mesh.userData.legs;
    l.position.z = moving ? Math.sin(w.anim) * 0.04 : 0; r.position.z = -l.position.z;
    w.mesh.scale.setScalar(1 + Math.min(1.2, Math.log10(1 + w.s) * 0.5));
  }
  for (const b of buildings) b.mesh.traverse((m) => { if (m.userData.flag) m.rotation.y = Math.sin(t * 3 + b.i) * 0.35; });
  for (let k = bolts.length - 1; k >= 0; k--) {
    const b = bolts[k];
    b.t -= dt;
    b.glow.intensity = Math.max(0, b.t) * 340;
    b.line.visible = Math.random() < 0.8;
    if (b.t <= 0) { scene.remove(b.line, b.glow); bolts.splice(k, 1); }
  }
  if (cursorT > 0) {
    cursorT -= dt;
    const o = Math.max(0, cursorT * 1.7);
    cursor.material.opacity = o; ring.material.opacity = o;
    if (cursorT <= 0) cursor.visible = ring.visible = false;
  }
  water.position.y = WATER_Y + Math.sin(t * 1.2) * 0.025;
  for (let k = 0; k < foamSpots.length; k++) {
    const f = foamSpots[k], s = 0.6 + 0.4 * Math.sin(t * 2 + f.p);
    dummy.position.set(f.x + f.a * 0.06 * Math.sin(t * 1.5 + f.p), WATER_Y + 0.03, f.z + f.b * 0.06 * Math.sin(t * 1.5 + f.p));
    dummy.rotation.set(0, 0, 0); dummy.scale.set(s, 1, s); dummy.updateMatrix();
    foam.setMatrixAt(k, dummy.matrix);
  }
  foam.count = foamSpots.length;
  foam.instanceMatrix.needsUpdate = true;
  updateParticles(dt);
  sun.position.set(rig.target.x - 18, 30, rig.target.z + 10);
  sun.target.position.copy(rig.target);
  hudT -= dt;
  if (hudT <= 0 && mode === 'play') { hudT = 0.2; updateHud(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// Lava flickers by repainting a few pixels of its atlas tile.
function atlasShimmer() {
  const g = atlasTex.image.getContext('2d');
  const LAVA = ['#ff6a1a', '#ff8f1f', '#ffb42b', '#e8461a', '#ff7a1a', '#ffd04a'];
  for (let k = 0; k < 40; k++) { g.fillStyle = LAVA[(Math.random() * LAVA.length) | 0]; g.fillRect(TILE.lava * 16 + 1 + ((Math.random() * 14) | 0), 1 + ((Math.random() * 14) | 0), 1, 1); }
  atlasTex.needsUpdate = true;
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
window.__terracube = window.__shapers = {
  get state() { return { mode, world, buildings, walkers, mana, stats, tool, elapsed }; },
  simulate, applyTool, startWorld, drawVoxelLogo, drawVoxelLogo, setTool, teamPop, camera, rig, hgt, toX, toZ, N, useToolAt, endGame, rotate, pick,
};
