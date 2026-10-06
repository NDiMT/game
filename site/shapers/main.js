import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

// =====================================================================
// SHAPERS: a modern take on Populous for phones (portrait).
// Sculpt the land, let your people settle flat ground, grow their homes
// into castles, and outlast a rival god.
// =====================================================================

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
const N = 40;            // cells per side
const S = 1;             // cell size (world units)
const HS = 0.5;          // height step
const MAXH = 9;
const WATER_Y = 0.26;
const V = N + 1;         // vertices per side
const TEAM = [
  { name: 'Azure', color: 0x3b82f6, light: 0x93c5fd, dark: 0x1e40af, css: '#3b82f6' },
  { name: 'Crimson', color: 0xef4444, light: 0xfca5a5, dark: 0x991b1b, css: '#ef4444' },
];
const LEVELS = [
  null,
  { name: 'Tent', cap: 6, grow: 0.35 },
  { name: 'Hut', cap: 14, grow: 0.6 },
  { name: 'House', cap: 26, grow: 0.9 },
  { name: 'Castle', cap: 50, grow: 1.4 },
];
const TOOLS = {
  raise:   { cost: 1,   label: 'Raise',   hint: 'Tap land to raise it. Hold to keep raising. Flat ground lets homes grow.' },
  lower:   { cost: 1,   label: 'Lower',   hint: 'Tap to lower land. Sink it below the sea to drown what stands there.' },
  rally:   { cost: 25,  label: 'Rally',   hint: 'Plant a beacon. Your walkers gather there and fight what they meet.' },
  bolt:    { cost: 70,  label: 'Bolt',    hint: 'Lightning: kills walkers and burns a home.' },
  quake:   { cost: 140, label: 'Quake',   hint: 'Earthquake: shakes the land into ruins in a wide area.' },
  volcano: { cost: 320, label: 'Volcano', hint: 'Raise a volcano. Nothing can live on its slopes for a while.' },
};

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('app').prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3f2);
scene.fog = new THREE.Fog(0x9fd3f2, 55, 130);
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 300);
camera.position.set(0, 30, 26);

const hemi = new THREE.HemisphereLight(0xdff2ff, 0x6b5a3a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
sun.position.set(-22, 34, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = false;
controls.minDistance = 12;
controls.maxDistance = 58;
controls.minPolarAngle = 0.45;
controls.maxPolarAngle = 1.12;
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.panSpeed = 1.1;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 52 : 42;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ terrain data
const hgt = new Int8Array(V * V);
const lava = new Float32Array(N * N); // seconds of lava left per cell
const vi = (i, j) => j * V + i;
const ci = (i, j) => j * N + i;
const toX = (i) => (i - N / 2) * S;
const toZ = (j) => (j - N / 2) * S;
const edgeLimit = (i, j) => Math.min(i, j, N - i, N - j);

function valueNoise(rng) {
  const G = 9, grid = [];
  for (let k = 0; k < (G + 1) * (G + 1); k++) grid.push(rng());
  return (x, y) => {
    const gx = x * G, gy = y * G, i = Math.min(G - 1, Math.floor(gx)), j = Math.min(G - 1, Math.floor(gy));
    const fx = gx - i, fy = gy - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = grid[j * (G + 1) + i], b = grid[j * (G + 1) + i + 1], c = grid[(j + 1) * (G + 1) + i], d = grid[(j + 1) * (G + 1) + i + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function relax() {
  // Enforce Populous slopes: neighbouring vertices differ by at most one step.
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const v = hgt[vi(i, j)];
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ni = i + di, nj = j + dj;
            if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
            const n = hgt[vi(ni, nj)];
            if (n > v + 1) { hgt[vi(ni, nj)] = v + 1; changed = true; }
          }
      }
    if (!changed) break;
  }
}

function generateWorld(seed) {
  const rng = mulberry32(seed * 977 + 13);
  const n1 = valueNoise(rng), n2 = valueNoise(rng);
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const x = i / N, y = j / N;
      const dx = x - 0.5, dy = y - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) / 0.5;
      let h = (1 - Math.pow(d, 1.7)) * 6.2 + (n1(x, y) - 0.5) * 6 + (n2(x * 0.7 + 0.15, y * 0.7) - 0.5) * 3 - 0.6;
      h = Math.max(0, Math.min(MAXH, Math.round(h)));
      hgt[vi(i, j)] = Math.min(h, edgeLimit(i, j));
    }
  // Guarantee a little flat plateau at each start corner.
  for (const [cx, cy] of START) {
    for (let j = cy - 3; j <= cy + 3; j++)
      for (let i = cx - 3; i <= cx + 3; i++) {
        const k = vi(i, j), dist = Math.max(Math.abs(i - cx), Math.abs(j - cy));
        hgt[k] = Math.max(hgt[k], Math.min(edgeLimit(i, j), 4 - Math.max(0, dist - 1)));
      }
  }
  relax();
  lava.fill(0);
}

function cellInfo(i, j) {
  const a = hgt[vi(i, j)], b = hgt[vi(i + 1, j)], c = hgt[vi(i, j + 1)], d = hgt[vi(i + 1, j + 1)];
  const min = Math.min(a, b, c, d), max = Math.max(a, b, c, d);
  return { min, max, flat: min === max, land: min > 0, h: min };
}
const isFlatLand = (i, j) => {
  if (i < 0 || j < 0 || i >= N || j >= N) return false;
  const c = cellInfo(i, j);
  return c.flat && c.land && lava[ci(i, j)] <= 0;
};
function heightAt(x, z) {
  const fi = x / S + N / 2, fj = z / S + N / 2;
  const i = Math.max(0, Math.min(N - 1, Math.floor(fi))), j = Math.max(0, Math.min(N - 1, Math.floor(fj)));
  const tx = Math.min(1, Math.max(0, fi - i)), tz = Math.min(1, Math.max(0, fj - j));
  const a = hgt[vi(i, j)], b = hgt[vi(i + 1, j)], c = hgt[vi(i, j + 1)], d = hgt[vi(i + 1, j + 1)];
  return (a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz) * HS;
}
const isWaterAt = (x, z) => heightAt(x, z) < WATER_Y + 0.05;

// Raising/lowering keeps slopes at one step, cascading like the original.
function raiseVertex(i, j) {
  if (hgt[vi(i, j)] >= Math.min(MAXH, edgeLimit(i, j))) return false;
  hgt[vi(i, j)]++;
  const q = [[i, j]];
  while (q.length) {
    const [ci2, cj] = q.pop();
    const h = hgt[vi(ci2, cj)];
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ni = ci2 + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const k = vi(ni, nj);
        if (hgt[k] < h - 1) { hgt[k] = h - 1; q.push([ni, nj]); }
      }
  }
  terrainDirty = true;
  return true;
}
function lowerVertex(i, j) {
  if (hgt[vi(i, j)] <= 0) return false;
  hgt[vi(i, j)]--;
  const q = [[i, j]];
  while (q.length) {
    const [ci2, cj] = q.pop();
    const h = hgt[vi(ci2, cj)];
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ni = ci2 + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const k = vi(ni, nj);
        if (hgt[k] > h + 1) { hgt[k] = h + 1; q.push([ni, nj]); }
      }
  }
  terrainDirty = true;
  return true;
}

// ------------------------------------------------------------------ terrain mesh
const terrainGeo = new THREE.BufferGeometry();
const tPos = new Float32Array(N * N * 6 * 3), tCol = new Float32Array(N * N * 6 * 3);
terrainGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 }));
terrain.receiveShadow = true;
terrain.castShadow = true;
scene.add(terrain);
let terrainDirty = true;

const C = (hex) => new THREE.Color(hex);
const PAL = {
  seabed: C(0xb59a62), beach: C(0xe6d39a), grassA: C(0x8cc152), grassB: C(0x7db544), grassC: C(0x6aa83a),
  slope: C(0x5b8a36), slopeHigh: C(0x7c7a5c), rock: C(0x8f8a80), rockDark: C(0x75716a), snow: C(0xf3f6f8),
  lava: C(0xff5a1f), lavaDark: C(0x3a1a12),
};
const tmpC = new THREE.Color();
function cellColor(i, j, t) {
  const c = cellInfo(i, j);
  const L = lava[ci(i, j)];
  if (L > 0) return tmpC.copy(PAL.lavaDark).lerp(PAL.lava, 0.55 + 0.45 * Math.sin(t * 5 + i * 1.7 + j * 2.3) * Math.min(1, L / 6));
  if (c.max <= 0) return tmpC.copy(PAL.seabed);
  if (c.min === 0) return tmpC.copy(PAL.beach);
  const check = ((i + j) & 1) ? 1.03 : 0.97;
  if (c.flat) {
    if (c.h >= 8) return tmpC.copy(PAL.snow);
    if (c.h >= 6) return tmpC.copy(PAL.slopeHigh).multiplyScalar(check * 1.05);
    const g = c.h <= 2 ? PAL.grassA : c.h <= 4 ? PAL.grassB : PAL.grassC;
    return tmpC.copy(g).multiplyScalar(check);
  }
  if (c.max >= 8) return tmpC.copy(PAL.snow).lerp(PAL.rock, 0.35);
  if (c.max >= 6) return tmpC.copy(((i * 7 + j * 3) & 3) ? PAL.rock : PAL.rockDark);
  return tmpC.copy(PAL.slope).lerp(PAL.slopeHigh, Math.max(0, (c.max - 2) / 4));
}
function rebuildTerrain(t) {
  let p = 0;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x0 = toX(i), x1 = toX(i + 1), z0 = toZ(j), z1 = toZ(j + 1);
      const a = hgt[vi(i, j)] * HS, b = hgt[vi(i + 1, j)] * HS, c = hgt[vi(i, j + 1)] * HS, d = hgt[vi(i + 1, j + 1)] * HS;
      const col = cellColor(i, j, t);
      const verts = [x0, a, z0, x0, c, z1, x1, b, z0, x1, b, z0, x0, c, z1, x1, d, z1];
      for (let k = 0; k < 6; k++) {
        tPos[p] = verts[k * 3]; tPos[p + 1] = verts[k * 3 + 1]; tPos[p + 2] = verts[k * 3 + 2];
        tCol[p] = col.r; tCol[p + 1] = col.g; tCol[p + 2] = col.b;
        p += 3;
      }
    }
  terrainGeo.attributes.position.needsUpdate = true;
  terrainGeo.attributes.color.needsUpdate = true;
  terrainGeo.computeBoundingSphere();
  terrainGeo.computeBoundingBox();
  layoutTrees();
}

// Ocean: gently animated low-poly water
const WSEG = 70, WSIZE = 110;
const waterGeo = new THREE.PlaneGeometry(WSIZE, WSIZE, WSEG, WSEG).rotateX(-Math.PI / 2);
const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: 0x2c8fd6, transparent: true, opacity: 0.82, roughness: 0.18, metalness: 0.15, flatShading: true }));
water.position.y = WATER_Y;
water.receiveShadow = true;
scene.add(water);
const waterBase = waterGeo.attributes.position.array.slice();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a5f93 }));
floor.position.y = -0.6;
scene.add(floor);
function animateWater(t) {
  const a = waterGeo.attributes.position.array;
  for (let k = 0; k < a.length; k += 3) {
    const x = waterBase[k], z = waterBase[k + 2];
    a[k + 1] = Math.sin(x * 0.55 + t * 1.3) * 0.05 + Math.cos(z * 0.6 + t * 1.1) * 0.05;
  }
  waterGeo.attributes.position.needsUpdate = true;
}

// Clouds
const clouds = new THREE.Group();
{
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
  const r = mulberry32(3);
  for (let k = 0; k < 9; k++) {
    const g = new THREE.Group();
    for (let m = 0; m < 4; m++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + r() * 1.4, 0), mat);
      s.position.set(m * 1.6 - 2.4, r() * 0.6, r() * 1.2);
      g.add(s);
    }
    g.position.set((r() - 0.5) * 70, 14 + r() * 5, (r() - 0.5) * 70);
    g.userData.speed = 0.4 + r() * 0.5;
    clouds.add(g);
  }
  scene.add(clouds);
}

// Trees (instanced pines + round trees)
const TREE_MAX = 260;
const treeSpots = [];
const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 5).translate(0, 0.15, 0), new THREE.MeshStandardMaterial({ color: 0x6b4a2b, flatShading: true }), TREE_MAX);
const crownMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.24, 0.55, 6).translate(0, 0.55, 0), new THREE.MeshStandardMaterial({ color: 0x2f7d3a, flatShading: true, roughness: 0.9 }), TREE_MAX);
trunkMesh.castShadow = crownMesh.castShadow = true;
scene.add(trunkMesh, crownMesh);
const dummy = new THREE.Object3D();
function plantTrees(seed) {
  treeSpots.length = 0;
  const r = mulberry32(seed + 77);
  for (let k = 0; k < TREE_MAX; k++) treeSpots.push({ x: (r() - 0.5) * (N - 4) * S, z: (r() - 0.5) * (N - 4) * S, s: 0.75 + r() * 0.6, ry: r() * 6, cleared: false });
}
function layoutTrees() {
  let n = 0;
  for (const t of treeSpots) {
    if (t.cleared) continue;
    const i = Math.floor(t.x / S + N / 2), j = Math.floor(t.z / S + N / 2);
    if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const c = cellInfo(i, j);
    if (!c.land || c.max >= 7 || lava[ci(i, j)] > 0 || buildingAt(i, j)) continue;
    dummy.position.set(t.x, heightAt(t.x, t.z), t.z);
    dummy.rotation.set(0, t.ry, 0);
    dummy.scale.setScalar(t.s);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(n, dummy.matrix);
    crownMesh.setMatrixAt(n, dummy.matrix);
    n++;
  }
  trunkMesh.count = crownMesh.count = n;
  trunkMesh.instanceMatrix.needsUpdate = crownMesh.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ models
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, ...extra });
const MAT = {
  wall: std(0xf1e6cf), wallDark: std(0xd9c9a6), stone: std(0xb8b2a6), stoneDark: std(0x8f897e), wood: std(0x7a5232),
  skin: std(0xf0c39a), door: std(0x4a3020), glass: std(0xffe9a8, { emissive: 0xffc860, emissiveIntensity: 0.4 }),
  team: TEAM.map((t) => std(t.color, { roughness: 0.55 })), teamLight: TEAM.map((t) => std(t.light)),
};
const G = {
  tent: new THREE.ConeGeometry(0.34, 0.55, 6).translate(0, 0.275, 0),
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  roof4: new THREE.ConeGeometry(0.72, 0.42, 4).rotateY(Math.PI / 4).translate(0, 0.21, 0),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0),
  cone8: new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0),
  body: new THREE.CylinderGeometry(0.075, 0.1, 0.26, 7).translate(0, 0.13, 0),
  head: new THREE.SphereGeometry(0.075, 8, 6).translate(0, 0.33, 0),
  flag: new THREE.PlaneGeometry(0.3, 0.18).translate(0.15, 0, 0),
};
function part(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function flagOn(g, team, x, y, z, h = 0.6) {
  g.add(part(G.cyl, MAT.wood, x, y, z, 0.015, h, 0.015));
  const f = new THREE.Mesh(G.flag, new THREE.MeshStandardMaterial({ color: TEAM[team].color, side: THREE.DoubleSide, flatShading: true }));
  f.position.set(x, y + h - 0.1, z);
  f.castShadow = true;
  f.userData.flag = true;
  g.add(f);
  return f;
}
function buildingModel(level, team) {
  const g = new THREE.Group();
  const T = MAT.team[team];
  if (level === 1) {
    g.add(part(G.tent, MAT.teamLight[team], 0, 0, 0));
    g.add(part(G.box, MAT.door, 0, 0, 0.27, 0.12, 0.2, 0.04));
    flagOn(g, team, 0, 0.5, 0, 0.3);
  } else if (level === 2) {
    g.add(part(G.box, MAT.wall, 0, 0, 0, 0.62, 0.38, 0.55));
    g.add(part(G.roof4, T, 0, 0.38, 0, 0.75, 1, 0.68));
    g.add(part(G.box, MAT.door, 0, 0, 0.28, 0.14, 0.24, 0.03));
    g.add(part(G.box, MAT.glass, 0.2, 0.17, 0.28, 0.1, 0.1, 0.03));
  } else if (level === 3) {
    g.add(part(G.box, MAT.wall, -0.08, 0, 0, 0.72, 0.5, 0.62));
    g.add(part(G.roof4, T, -0.08, 0.5, 0, 0.85, 1.15, 0.78));
    g.add(part(G.box, MAT.wallDark, 0.33, 0, 0.12, 0.32, 0.36, 0.34));
    g.add(part(G.roof4, T, 0.33, 0.36, 0.12, 0.4, 0.8, 0.4));
    g.add(part(G.box, MAT.stoneDark, -0.3, 0.5, -0.15, 0.1, 0.32, 0.1));
    g.add(part(G.box, MAT.door, -0.08, 0, 0.32, 0.15, 0.28, 0.03));
    for (const x of [-0.3, 0.14]) g.add(part(G.box, MAT.glass, x, 0.24, 0.32, 0.12, 0.12, 0.03));
    flagOn(g, team, 0.33, 0.62, 0.12, 0.35);
  } else {
    const s = 1.6;
    g.add(part(G.box, MAT.stone, 0, 0, 0, 1.25 * s / 1.6 * 1.3, 0.42, 1.25 * s / 1.6 * 1.3));
    for (const [x, z] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) {
      g.add(part(G.cyl, MAT.stone, x, 0, z, 0.2, 0.75, 0.2));
      g.add(part(G.cone8, T, x, 0.75, z, 0.24, 0.32, 0.24));
    }
    g.add(part(G.box, MAT.stoneDark, 0, 0.42, 0, 0.7, 0.62, 0.7));
    g.add(part(G.cone8, T, 0, 1.04, 0, 0.48, 0.42, 0.48));
    g.add(part(G.box, MAT.door, 0, 0, 0.82, 0.24, 0.3, 0.04));
    for (const x of [-0.18, 0.18]) g.add(part(G.box, MAT.glass, x, 0.66, 0.36, 0.1, 0.12, 0.02));
    flagOn(g, team, 0, 1.4, 0, 0.55);
  }
  return g;
}
function walkerModel(team) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(G.body, MAT.team[team]); body.castShadow = true;
  const head = new THREE.Mesh(G.head, MAT.skin); head.castShadow = true;
  g.add(body, head);
  return g;
}

// ------------------------------------------------------------------ particles
const PMAX = 600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true });
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
    p.vy -= 2.2 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  for (let k = 0; k < PMAX; k++) {
    const p = parts[k];
    if (p) {
      pPos[k * 3] = p.x; pPos[k * 3 + 1] = p.y; pPos[k * 3 + 2] = p.z;
      const f = Math.min(1, p.life / p.max * 1.5);
      pCol[k * 3] = p.c.r * f + (1 - f) * 0.6; pCol[k * 3 + 1] = p.c.g * f + (1 - f) * 0.6; pCol[k * 3 + 2] = p.c.b * f + (1 - f) * 0.6;
    } else pPos[k * 3 + 1] = -100;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

// Lightning bolts
const bolts = [];
function lightning(x, y, z) {
  const pts = [];
  let px = x + (Math.random() - 0.5) * 2, pz = z + (Math.random() - 0.5) * 2;
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    pts.push(new THREE.Vector3(px + (x - px) * t + (Math.random() - 0.5) * (1 - t) * 1.4, 16 * (1 - t) + y * t, pz + (z - pz) * t + (Math.random() - 0.5) * (1 - t) * 1.4));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf2f8ff }));
  const glow = new THREE.PointLight(0xbfe0ff, 120, 18, 1.6);
  glow.position.set(x, y + 1.5, z);
  scene.add(line, glow);
  bolts.push({ line, glow, t: 0.35 });
}

// Cursor ring
const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
ring.visible = false;
scene.add(ring);
let ringT = 0;

// ------------------------------------------------------------------ game state
const START = [[Math.round(N * 0.27), Math.round(N * 0.72)], [Math.round(N * 0.73), Math.round(N * 0.28)]];
let world = 1, mode = 'menu', tool = 'raise', elapsed = 0;
let buildings = [], walkers = [], beacons = [null, null];
const mana = [40, 40];
const stats = { built: 0, castles: 0, kills: 0, lost: 0 };

function buildingAt(i, j) {
  for (const b of buildings) if (b.i === i && b.j === j) return b;
  return null;
}
function buildingNear(i, j, r, except) {
  for (const b of buildings) if (b !== except && Math.max(Math.abs(b.i - i), Math.abs(b.j - j)) <= r) return b;
  return null;
}
function canSettle(i, j) {
  if (!isFlatLand(i, j)) return false;
  return !buildingNear(i, j, 1);
}
function flatScore(i, j, r) {
  const h = cellInfo(i, j).h;
  let n = 0;
  for (let dj = -r; dj <= r; dj++)
    for (let di = -r; di <= r; di++) {
      const a = i + di, b = j + dj;
      if (isFlatLand(a, b) && cellInfo(a, b).h === h) n++;
    }
  return n;
}
function levelFor(b) {
  const s1 = flatScore(b.i, b.j, 1);
  if (s1 >= 9) {
    const s2 = flatScore(b.i, b.j, 2);
    if (s2 >= 23 && !buildingNear(b.i, b.j, 2, b)) return 4;
    return 3;
  }
  if (s1 >= 6) return 2;
  return 1;
}

function addBuilding(i, j, team, pop) {
  const b = { i, j, team, pop, level: 0, mesh: null, grow: 0, check: 0 };
  for (const t of treeSpots) if (Math.floor(t.x / S + N / 2) === i && Math.floor(t.z / S + N / 2) === j) t.cleared = true;
  buildings.push(b);
  setLevel(b, levelFor(b));
  stats.built += team === 0 ? 1 : 0;
  terrainDirty = true;
  return b;
}
function setLevel(b, level) {
  if (b.level === level && b.mesh) return;
  const up = level > b.level && b.level > 0;
  b.level = level;
  if (b.mesh) scene.remove(b.mesh);
  b.mesh = buildingModel(level, b.team);
  b.mesh.position.set(toX(b.i + 0.5), cellInfo(b.i, b.j).h * HS, toZ(b.j + 0.5));
  b.mesh.rotation.y = ((b.i * 7 + b.j * 3) % 4) * Math.PI / 2;
  b.mesh.userData.pop = 0;
  scene.add(b.mesh);
  if (up) {
    emit(b.mesh.position.x, b.mesh.position.y + 0.6, b.mesh.position.z, TEAM[b.team].light, 18, 1.6, 2.5, 1.1);
    if (b.team === 0) { sfx.build(level); if (level === 4) { stats.castles++; toast('A castle rises! 🏰'); } }
  }
}
function removeBuilding(b, spill = true) {
  scene.remove(b.mesh);
  buildings.splice(buildings.indexOf(b), 1);
  const x = toX(b.i + 0.5), z = toZ(b.j + 0.5);
  emit(x, heightAt(x, z) + 0.3, z, 0xb8a888, 14, 1.4, 1.6, 0.9);
  if (spill && b.pop >= 1 && !isWaterAt(x, z)) addWalker(b.team, x, z, Math.floor(b.pop));
  terrainDirty = true;
}
function addWalker(team, x, z, strength) {
  const w = { team, x, z, s: Math.max(1, strength), mesh: walkerModel(team), tx: x, tz: z, target: null, think: 0, anim: Math.random() * 6, dead: false };
  w.mesh.position.set(x, heightAt(x, z), z);
  scene.add(w.mesh);
  walkers.push(w);
  return w;
}
function killWalker(w) {
  w.dead = true;
  scene.remove(w.mesh);
}
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
    for (let k = 0; k < 4; k++) addWalker(team, toX(si + 0.5) + (k % 2) * 0.6 - 0.3, toZ(sj + 0.5) + Math.floor(k / 2) * 0.6 - 0.3, 5);
  });
  terrainDirty = true;
  const [si, sj] = START[0];
  controls.target.set(toX(si), 1.5, toZ(sj));
  camera.position.set(toX(si) + 2, 24, toZ(sj) + 20);
  controls.update();
  setTool('raise');
  $('world').textContent = `World ${world}`;
}

// ------------------------------------------------------------------ powers
function applyTool(team, kind, x, z, fromAI = false) {
  const cost = TOOLS[kind].cost;
  if (mana[team] < cost) { if (!fromAI) { toast('Not enough mana'); sfx.deny(); } return false; }
  const i = Math.round(x / S + N / 2), j = Math.round(z / S + N / 2);
  const cI = Math.floor(x / S + N / 2), cJ = Math.floor(z / S + N / 2);
  let ok = true;
  if (kind === 'raise') ok = i > 0 && j > 0 && i < N && j < N && raiseVertex(i, j);
  else if (kind === 'lower') ok = i > 0 && j > 0 && i < N && j < N && lowerVertex(i, j);
  else if (kind === 'rally') {
    if (isWaterAt(x, z)) ok = false;
    else placeBeacon(team, x, z);
  } else if (kind === 'bolt') {
    const y = heightAt(x, z);
    lightning(x, y, z);
    for (const w of walkers) if (!w.dead && Math.hypot(w.x - x, w.z - z) < 1.6) { killWalker(w); if (w.team !== team) stats.kills += team === 0 ? w.s : 0; }
    for (const b of buildings.slice()) if (Math.hypot(toX(b.i + 0.5) - x, toZ(b.j + 0.5) - z) < 1.4) { b.pop -= 25; if (b.pop <= 0) removeBuilding(b, false); }
    emit(x, y + 0.3, z, 0xffe9a0, 24, 3, 3, 0.8);
    shake = Math.max(shake, 0.25);
    sfx.bolt();
  } else if (kind === 'quake') {
    const r = mulberry32((Date.now() & 0xffff) + i * 31);
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2, d = r() * 4.2;
      const vi2 = Math.round(i + Math.cos(a) * d), vj2 = Math.round(j + Math.sin(a) * d);
      if (vi2 <= 0 || vj2 <= 0 || vi2 >= N || vj2 >= N) continue;
      if (r() < 0.5) raiseVertex(vi2, vj2); else lowerVertex(vi2, vj2);
    }
    for (let k = 0; k < 4; k++) emit(x + (Math.random() - 0.5) * 6, heightAt(x, z) + 0.2, z + (Math.random() - 0.5) * 6, 0xa08a66, 10, 2, 1.5, 1);
    shake = Math.max(shake, 1.2);
    sfx.quake();
  } else if (kind === 'volcano') {
    for (let dj = -4; dj <= 4; dj++)
      for (let di = -4; di <= 4; di++) {
        const a = i + di, b = j + dj, d = Math.hypot(di, dj);
        if (a <= 0 || b <= 0 || a >= N || b >= N || d > 4.2) continue;
        const target = Math.min(MAXH, edgeLimit(a, b), Math.round(hgt[vi(i, j)] + 4 - d));
        while (hgt[vi(a, b)] < target && raiseVertex(a, b));
      }
    for (let dj = -3; dj < 3; dj++)
      for (let di = -3; di < 3; di++) {
        const a = cI + di, b = cJ + dj;
        if (a >= 0 && b >= 0 && a < N && b < N && Math.hypot(di + 0.5, dj + 0.5) < 3.3) lava[ci(a, b)] = 22;
      }
    for (const w of walkers) if (!w.dead && Math.hypot(w.x - x, w.z - z) < 3.5) killWalker(w);
    emit(x, heightAt(x, z) + 1, z, 0xff6a2a, 60, 3, 5, 1.6);
    shake = Math.max(shake, 1.6);
    sfx.volcano();
  }
  if (!ok) { if (!fromAI && (kind === 'raise' || kind === 'lower')) sfx.deny(); return false; }
  mana[team] -= cost;
  if (!fromAI) {
    if (kind === 'raise') sfx.raise(); else if (kind === 'lower') sfx.lower(); else if (kind === 'rally') sfx.rally();
    if (kind === 'raise' || kind === 'lower') emit(toX(i), hgt[vi(i, j)] * HS + 0.1, toZ(j), 0xc8b48a, 6, 1, 1.2, 0.6);
  }
  return true;
}
function placeBeacon(team, x, z) {
  if (beacons[team]) scene.remove(beacons[team].mesh);
  const g = new THREE.Group();
  g.add(part(G.box, MAT.stone, 0, 0, 0, 0.36, 0.14, 0.36));
  g.add(part(G.box, MAT.team[team], 0, 0.14, 0, 0.14, 1.1, 0.14));
  const top = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ color: TEAM[team].light, emissive: TEAM[team].color, emissiveIntensity: 1.2, flatShading: true }));
  top.position.y = 1.45;
  g.add(top);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 12, 1, true).translate(0, 4.5, 0), new THREE.MeshBasicMaterial({ color: TEAM[team].light, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  g.add(beam);
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  beacons[team] = { x, z, mesh: g, top, t: team === 1 ? 30 : Infinity };
  for (const w of walkers) if (w.team === team) { w.target = null; w.think = 0; }
}

// ------------------------------------------------------------------ simulation
let shake = 0, tick = 0;
function simulate(dt) {
  elapsed += dt;
  // Mana from population (the rival god scales with the world number).
  for (let t = 0; t < 2; t++) {
    let pop = 0;
    for (const b of buildings) if (b.team === t) pop += b.pop;
    mana[t] = Math.min(999, mana[t] + dt * (0.6 + pop * 0.045) * (t === 1 ? 0.85 + world * 0.12 : 1));
  }
  // Lava cools
  let lavaLeft = false;
  for (let k = 0; k < lava.length; k++) if (lava[k] > 0) { lava[k] -= dt; lavaLeft = true; if (lava[k] <= 0) terrainDirty = true; }
  if (lavaLeft) { lavaColorT += dt; if (lavaColorT > 0.12) { lavaColorT = 0; terrainDirty = true; } if (Math.random() < dt * 6) smokeFromLava(); }

  // Buildings: grow, check land, release walkers
  for (const b of buildings.slice()) {
    b.check -= dt;
    if (b.check <= 0) {
      b.check = 0.5;
      if (!isFlatLand(b.i, b.j)) { removeBuilding(b, true); continue; }
      setLevel(b, levelFor(b));
    }
    const L = LEVELS[b.level];
    b.pop = Math.min(L.cap, b.pop + L.grow * dt);
    if (b.pop >= L.cap - 0.01) {
      b.pop = L.cap * 0.5;
      const x = toX(b.i + 0.5), z = toZ(b.j + 0.5);
      addWalker(b.team, x + (Math.random() - 0.5) * 0.6, z + 0.55, Math.floor(L.cap * 0.5));
      emit(x, heightAt(x, z) + 0.8, z, TEAM[b.team].light, 6, 0.6, 1.5, 0.8);
    }
    if (Math.random() < dt * 0.4 * (b.level)) {
      const x = toX(b.i + 0.5), z = toZ(b.j + 0.5);
      emit(x, heightAt(x, z) + 0.9, z, 0xfff3c4, 1, 0.2, 1.4, 1.2); // mana sparkle
    }
  }

  // Walkers
  const alive = walkers.filter((w) => !w.dead);
  for (const w of alive) {
    if (isWaterAt(w.x, w.z)) { killWalker(w); emit(w.x, WATER_Y + 0.1, w.z, 0xbfe6ff, 8, 1, 1.5, 0.6); continue; }
    w.think -= dt;
    if (w.think <= 0) { w.think = 0.9 + Math.random() * 0.6; decide(w, alive); }
    const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const slope = Math.abs(heightAt(w.x + dx / d * 0.3, w.z + dz / d * 0.3) - heightAt(w.x, w.z));
      const sp = (w.target?.kind === 'beacon' ? 1.6 : 1.15) / (1 + slope * 2);
      const step = Math.min(d, sp * dt);
      const nx = w.x + (dx / d) * step, nz = w.z + (dz / d) * step;
      if (isWaterAt(nx, nz)) { w.target = null; w.think = 0; w.tx = w.x; w.tz = w.z; }
      else { w.x = nx; w.z = nz; }
      w.mesh.rotation.y = Math.atan2(dx, dz);
    } else if (w.target) arrive(w);
  }
  // Fights and merges
  for (let a = 0; a < alive.length; a++) {
    const w = alive[a];
    if (w.dead) continue;
    for (let b = a + 1; b < alive.length; b++) {
      const o = alive[b];
      if (o.dead) continue;
      const d = Math.hypot(w.x - o.x, w.z - o.z);
      if (d > 0.42) continue;
      if (o.team === w.team) {
        if (w.target?.kind !== 'settle' && o.target?.kind !== 'settle') { w.s += o.s; killWalker(o); }
      } else {
        const big = w.s >= o.s ? w : o, small = big === w ? o : w;
        big.s = Math.max(1, big.s - small.s);
        killWalker(small);
        if (small.team === 1) stats.kills += small.s;
        emit((w.x + o.x) / 2, heightAt(w.x, w.z) + 0.4, (w.z + o.z) / 2, 0xffffff, 10, 1.4, 2, 0.5);
        sfx.clash();
      }
    }
  }
  walkers = walkers.filter((w) => !w.dead);

  // Beacons time out for the AI
  for (let t = 0; t < 2; t++) {
    const bc = beacons[t];
    if (!bc) continue;
    bc.t -= dt;
    bc.top.rotation.y += dt * 2;
    bc.mesh.position.y = heightAt(bc.x, bc.z);
    if (bc.t <= 0) { scene.remove(bc.mesh); beacons[t] = null; }
  }

  aiThink(dt);

  // Win / lose
  if (elapsed > 3) {
    const p0 = teamPop(0), p1 = teamPop(1);
    if (p1 <= 0) endGame(true);
    else if (p0 <= 0) endGame(false);
  }
}
let lavaColorT = 0;
function smokeFromLava() {
  const k = Math.floor(Math.random() * lava.length);
  if (lava[k] <= 0) return;
  const i = k % N, j = Math.floor(k / N);
  emit(toX(i + 0.5), cellInfo(i, j).max * HS + 0.2, toZ(j + 0.5), Math.random() < 0.5 ? 0xff8a3a : 0x5a5450, 2, 0.4, 2, 1.4);
}

function decide(w, alive) {
  const i = Math.floor(w.x / S + N / 2), j = Math.floor(w.z / S + N / 2);
  // Rally beacon wins
  const bc = beacons[w.team];
  if (bc) { w.target = { kind: 'beacon' }; w.tx = bc.x + (Math.random() - 0.5) * 1.2; w.tz = bc.z + (Math.random() - 0.5) * 1.2; return; }
  // Attack a weaker enemy home or walker nearby
  let best = null, bestD = 7;
  for (const b of buildings) {
    if (b.team === w.team || b.pop > w.s * 1.3) continue;
    const d = Math.hypot(toX(b.i + 0.5) - w.x, toZ(b.j + 0.5) - w.z);
    if (d < bestD) { bestD = d; best = { kind: 'attack', b }; }
  }
  if (!best) for (const o of alive) {
    if (o.team === w.team || o.dead || o.s >= w.s) continue;
    const d = Math.hypot(o.x - w.x, o.z - w.z);
    if (d < Math.min(bestD, 5)) { bestD = d; best = { kind: 'chase', o }; }
  }
  if (best) {
    w.target = best;
    if (best.kind === 'attack') { w.tx = toX(best.b.i + 0.5); w.tz = toZ(best.b.j + 0.5); }
    else { w.tx = best.o.x; w.tz = best.o.z; }
    return;
  }
  // Settle on the best flat land nearby
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
  if (pick) { w.target = pick; w.tx = toX(pick.i + 0.5); w.tz = toZ(pick.j + 0.5); return; }
  // Wander uphill-ish toward land
  w.target = null;
  for (let k = 0; k < 6; k++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
    const tx = w.x + Math.cos(a) * r, tz = w.z + Math.sin(a) * r;
    if (!isWaterAt(tx, tz) && Math.abs(tx) < N / 2 - 1 && Math.abs(tz) < N / 2 - 1) { w.tx = tx; w.tz = tz; break; }
  }
}

function arrive(w) {
  const t = w.target;
  w.target = null;
  if (t.kind === 'settle') {
    if (canSettle(t.i, t.j)) {
      addBuilding(t.i, t.j, w.team, w.s);
      killWalker(w);
      if (w.team === 0) sfx.build(1);
    }
  } else if (t.kind === 'attack') {
    const b = t.b;
    if (!buildings.includes(b)) return;
    if (w.s > b.pop) {
      const left = Math.max(1, Math.floor(w.s - b.pop));
      const lost = b.team === 0;
      removeBuilding(b, false);
      if (lost) { stats.lost++; toast('A home was overrun!'); }
      else stats.kills += Math.floor(b.pop);
      addBuilding(b.i, b.j, w.team, left);
      killWalker(w);
      sfx.clash();
    } else {
      b.pop -= w.s;
      killWalker(w);
    }
  }
}

// ------------------------------------------------------------------ rival god
let aiT = 0, aiSpellT = 8;
function aiThink(dt) {
  aiT -= dt; aiSpellT -= dt;
  if (aiT > 0) return;
  aiT = Math.max(0.35, 1.2 - world * 0.12);
  const mine = buildings.filter((b) => b.team === 1);
  // Flatten around its own homes so they grow
  if (mine.length && mana[1] > 4) {
    const b = mine[(Math.random() * mine.length) | 0];
    const h = cellInfo(b.i, b.j).h;
    for (let k = 0; k < 2 + Math.floor(world / 2); k++) {
      const vi2 = b.i - 1 + Math.floor(Math.random() * 4), vj2 = b.j - 1 + Math.floor(Math.random() * 4);
      if (vi2 <= 0 || vj2 <= 0 || vi2 >= N || vj2 >= N) continue;
      const cur = hgt[vi(vi2, vj2)];
      // Never sculpt the vertices under its own home.
      if ((vi2 === b.i || vi2 === b.i + 1) && (vj2 === b.j || vj2 === b.j + 1)) continue;
      if (cur < h) applyTool(1, 'raise', toX(vi2), toZ(vj2), true);
      else if (cur > h) applyTool(1, 'lower', toX(vi2), toZ(vj2), true);
    }
  }
  // Attack waves and spells
  const p0 = teamPop(0), p1 = teamPop(1);
  const targets = buildings.filter((b) => b.team === 0).sort((a, b) => b.level - a.level || b.pop - a.pop);
  if (!beacons[1] && targets.length && p1 > p0 * 1.35 && mana[1] > 60 && Math.random() < 0.25) {
    const t = targets[0];
    applyTool(1, 'rally', toX(t.i + 0.5), toZ(t.j + 0.5), true);
    toast('The Crimson god rallies an attack!');
  }
  if (aiSpellT <= 0 && targets.length) {
    aiSpellT = Math.max(9, 26 - world * 3) + Math.random() * 8;
    const t = targets[0];
    const x = toX(t.i + 0.5), z = toZ(t.j + 0.5);
    if (world >= 3 && mana[1] > TOOLS.volcano.cost + 60 && Math.random() < 0.25) { applyTool(1, 'volcano', x + 1.5, z, true); toast('A volcano erupts in your lands!'); }
    else if (world >= 2 && mana[1] > TOOLS.quake.cost + 30 && Math.random() < 0.5) { applyTool(1, 'quake', x, z, true); toast('Earthquake!'); }
    else if (mana[1] > TOOLS.bolt.cost + 20) { applyTool(1, 'bolt', x, z, true); }
  }
}

// ------------------------------------------------------------------ input
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickGround(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(terrain, false)[0];
  if (hit) return hit.point;
  const p = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y), p)) return p;
  return null;
}
const pointers = new Map();
let press = null, repeatT = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1 && mode === 'play') press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, repeating: false };
  else press = null;
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 9) press.moved = true;
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (!press || e.pointerId !== press.id) return;
  const quick = performance.now() - press.t < 450;
  if (!press.moved && !press.repeating && quick) useToolAt(press.x, press.y);
  press = null;
};
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); press = null; });

function useToolAt(cx, cy) {
  const p = pickGround(cx, cy);
  if (!p) return;
  if (Math.abs(p.x) > N / 2 * S || Math.abs(p.z) > N / 2 * S) return;
  const ok = applyTool(0, tool, p.x, p.z);
  ring.visible = true; ringT = 0.5;
  ring.position.set(tool === 'raise' || tool === 'lower' ? toX(Math.round(p.x / S + N / 2)) : p.x, heightAt(p.x, p.z) + 0.06, tool === 'raise' || tool === 'lower' ? toZ(Math.round(p.z / S + N / 2)) : p.z);
  ring.material.color.set(ok ? 0xffffff : 0xff6b6b);
  const big = tool === 'quake' ? 4 : tool === 'volcano' ? 3.5 : tool === 'bolt' ? 1.6 : 1;
  ring.scale.setScalar(big);
  updateHud();
}
function pressRepeat(dt) {
  if (!press || press.moved || !(tool === 'raise' || tool === 'lower')) return;
  if (performance.now() - press.t < 380) return;
  press.repeating = true;
  repeatT -= dt;
  if (repeatT <= 0) { repeatT = 0.14; useToolAt(press.x, press.y); }
}

window.addEventListener('keydown', (e) => {
  const map = { Digit1: 'raise', Digit2: 'lower', Digit3: 'rally', Digit4: 'bolt', Digit5: 'quake', Digit6: 'volcano' };
  if (map[e.code]) setTool(map[e.code]);
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});

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
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function updateHud() {
  const p0 = Math.round(teamPop(0)), p1 = Math.round(teamPop(1));
  $('pop0').textContent = p0; $('pop1').textContent = p1;
  $('balance').style.width = `${(p0 / Math.max(1, p0 + p1)) * 100}%`;
  $('mana-fill').style.width = `${Math.min(100, (mana[0] / 400) * 100)}%`;
  $('mana').textContent = Math.floor(mana[0]);
  for (const b of document.querySelectorAll('.tool')) b.classList.toggle('poor', mana[0] < TOOLS[b.dataset.tool].cost);
  const homes = buildings.filter((b) => b.team === 0);
  $('homes').textContent = `${homes.length} homes · ${homes.filter((b) => b.level === 4).length} castles`;
}
function togglePause() {
  if (mode === 'play') { mode = 'pause'; $('pause').hidden = false; }
  else if (mode === 'pause') { mode = 'play'; $('pause').hidden = true; }
}
$('b-pause').addEventListener('click', togglePause);
$('resume').addEventListener('click', togglePause);
$('quit').addEventListener('click', () => { $('pause').hidden = true; showMenu(); });

function endGame(won) {
  if (mode !== 'play') return;
  mode = 'end';
  const best = store.get('shapers.world', 1);
  if (won && world + 1 > best) store.set('shapers.world', world + 1);
  $('end-title').textContent = won ? 'Victory' : 'Defeat';
  $('end-text').textContent = won ? `The Crimson god has no followers left on World ${world}.` : `Your people are gone. The Crimson god rules World ${world}.`;
  const m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60).toString().padStart(2, '0');
  $('end-stats').innerHTML = [['Time', `${m}:${s}`], ['Homes built', stats.built], ['Castles', stats.castles], ['Enemies felled', Math.round(stats.kills)]]
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('end-next').hidden = !won;
  $('end-next').textContent = `World ${world + 1} →`;
  $('end').hidden = false;
  won ? sfx.win() : sfx.lose();
}
$('end-next').addEventListener('click', () => { $('end').hidden = true; startWorld(world + 1); });
$('end-retry').addEventListener('click', () => { $('end').hidden = true; startWorld(world); });

function showMenu() {
  mode = 'menu';
  const best = store.get('shapers.world', 1);
  $('worlds').innerHTML = Array.from({ length: Math.max(3, best) }, (_, k) => k + 1)
    .map((n) => `<button class="world-btn" data-w="${n}" ${n > best ? 'disabled' : ''}>${n}</button>`).join('');
  for (const b of document.querySelectorAll('.world-btn')) b.addEventListener('click', () => startWorld(+b.dataset.w));
  $('menu').hidden = false;
}
function startWorld(n) {
  sfx.init();
  $('menu').hidden = true;
  newGame(n);
  mode = 'play';
  toast(n === 1 ? 'Flatten land near your people so they can build.' : `World ${n}: the Crimson god grows bolder.`);
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
    raise: () => { tone(160, 260, 0.12, 'triangle', 0.18); noise(0.1, 600, 0.15); },
    lower: () => { tone(220, 120, 0.12, 'triangle', 0.18); noise(0.1, 400, 0.15); },
    deny: () => tone(180, 140, 0.12, 'square', 0.06),
    click: () => tone(900, 900, 0.04, 'sine', 0.06),
    rally: () => [523, 784].forEach((f, i) => tone(f, f, 0.3, 'sine', 0.12, i * 0.1)),
    build: (lvl) => [392, 494, 587, 784].slice(0, lvl + 1).forEach((f, i) => tone(f, f, 0.18, 'sine', 0.1, i * 0.07)),
    clash: () => { noise(0.08, 3000, 0.12, 'highpass'); tone(600, 300, 0.06, 'square', 0.04); },
    bolt: () => { noise(0.5, 4000, 0.5, 'highpass'); tone(90, 40, 0.5, 'sawtooth', 0.2); },
    quake: () => { noise(1.6, 180, 0.9); tone(50, 30, 1.4, 'sine', 0.5); },
    volcano: () => { noise(2, 260, 1); tone(70, 28, 1.8, 'sawtooth', 0.3); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.4, 'triangle', 0.14, i * 0.14)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.5, 'triangle', 0.14, i * 0.2)),
    mute(on) { if (master) master.gain.value = on ? 0 : 0.5; },
  };
})();
$('b-mute').addEventListener('click', () => {
  const m = !store.get('shapers.muted', false);
  store.set('shapers.muted', m); sfx.mute(m);
  $('b-mute').textContent = m ? '🔇' : '🔊';
});
$('b-mute').textContent = store.get('shapers.muted', false) ? '🔇' : '🔊';

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let hudT = 0, t = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  if (mode === 'play') {
    simulate(dt);
    pressRepeat(dt);
  } else if (mode === 'menu') {
    controls.target.lerp(new THREE.Vector3(0, 1, 0), 0.02);
    const a = t * 0.08;
    camera.position.lerp(new THREE.Vector3(Math.sin(a) * 34, 26, Math.cos(a) * 34), 0.02);
  }
  // keep the camera over the island
  controls.target.x = Math.max(-N / 2, Math.min(N / 2, controls.target.x));
  controls.target.z = Math.max(-N / 2, Math.min(N / 2, controls.target.z));
  controls.target.y = 1.2;
  controls.update();
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * shake * 0.3;
    shake = Math.max(0, shake - dt * 1.6);
  }
  if (terrainDirty) { terrainDirty = false; rebuildTerrain(t); for (const b of buildings) if (b.mesh) b.mesh.position.y = cellInfo(b.i, b.j).h * HS; }

  // animate walkers & flags
  for (const w of walkers) {
    w.anim += dt * 10;
    const moving = Math.hypot(w.tx - w.x, w.tz - w.z) > 0.05;
    w.mesh.position.set(w.x, heightAt(w.x, w.z) + (moving ? Math.abs(Math.sin(w.anim)) * 0.05 : 0), w.z);
    const sc = 1 + Math.min(1.2, Math.log10(1 + w.s) * 0.55);
    w.mesh.scale.setScalar(sc);
  }
  for (const b of buildings) b.mesh.traverse((m) => { if (m.userData.flag) m.rotation.y = Math.sin(t * 3 + b.i) * 0.35; });
  for (const c of clouds.children) { c.position.x += c.userData.speed * dt; if (c.position.x > 45) c.position.x = -45; }
  for (let k = bolts.length - 1; k >= 0; k--) {
    const b = bolts[k];
    b.t -= dt;
    b.glow.intensity = Math.max(0, b.t) * 340;
    b.line.visible = Math.random() < 0.8;
    if (b.t <= 0) { scene.remove(b.line, b.glow); bolts.splice(k, 1); }
  }
  if (ring.visible) { ringT -= dt; ring.material.opacity = Math.max(0, ringT * 1.8); if (ringT <= 0) ring.visible = false; }
  animateWater(t);
  updateParticles(dt);
  sun.position.set(controls.target.x - 22, 34, controls.target.z + 14);
  sun.target.position.copy(controls.target);
  sun.target.updateMatrixWorld();
  hudT -= dt;
  if (hudT <= 0 && mode === 'play') { hudT = 0.2; updateHud(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
newGame(1);
showMenu();
requestAnimationFrame(frame);

// Exposed for automated testing.
window.__shapers = {
  get state() { return { mode, world, buildings, walkers, mana, stats, tool, elapsed }; },
  simulate, applyTool, startWorld, setTool, teamPop, camera, controls, hgt, toX, toZ, N, useToolAt, endGame,
};

// ------------------------------------------------------------------ version check
const APP_VERSION = '1.0';
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
