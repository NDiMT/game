import * as THREE from 'three';

// =====================================================================
// POLIS: a pocket city builder for phones (portrait), in the spirit of
// SimCity. Lay roads, zone homes, shops and industry, keep the power and
// water flowing, fund services, balance the budget and grow a hamlet
// into a metropolis. The city saves itself.
// =====================================================================

const APP_VERSION = '1.0';
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
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
function valueNoise(rng, G = 6) {
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
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const money = (n) => `${n < 0 ? '-' : ''}$${fmt(Math.abs(n))}`;

// ------------------------------------------------------------------ rules
const N = 32;
const NN = N * N;
const idx = (x, y) => y * N + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const wx = (x) => x - N / 2 + 0.5;
const wz = (y) => y - N / 2 + 0.5;
const D4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const R = 1, C = 2, I = 3;
const ZONE_NAME = [null, 'Residential', 'Commercial', 'Industrial'];
const ZONE_COL = [null, 0x52c45a, 0x3f95ee, 0xf0b93a];
const LEVEL_NAME = [
  null,
  ['Vacant lot', 'Cottages', 'Townhouses', 'Apartment tower'],
  ['Vacant lot', 'Corner shop', 'Office block', 'Skyscraper'],
  ['Vacant lot', 'Workshop', 'Warehouse', 'Factory'],
];
const CAP = [null, [0, 8, 30, 110], [0, 6, 22, 70], [0, 10, 26, 55]];
const UTIL_USE = [0, 2, 5, 12];
const STRUCT = {
  coal: { name: 'Coal power plant', w: 2, h: 2, power: 1600, upkeep: 30 },
  solar: { name: 'Solar farm', w: 2, h: 2, power: 1100, upkeep: 70 },
  pump: { name: 'Water pump', w: 1, h: 1, water: 1500, upkeep: 12 },
  police: { name: 'Police station', w: 1, h: 1, radius: 8, upkeep: 25 },
  fire: { name: 'Fire station', w: 1, h: 1, radius: 8, upkeep: 25 },
  school: { name: 'School', w: 1, h: 1, radius: 9, upkeep: 35 },
  park: { name: 'Park', w: 1, h: 1, radius: 4, upkeep: 2 },
  stadium: { name: 'Stadium', w: 2, h: 2, radius: 12, upkeep: 90 },
};
const TOOLS = [
  { id: 'inspect', name: 'Look', cost: 0, hint: 'Drag to move around. Tap anything to see how it is doing.' },
  { id: 'road', name: 'Road', cost: 10, hint: 'Drag to lay a road. Over water it becomes a bridge (×3 cost).' },
  { id: 'res', name: 'Homes', cost: 5, zone: R, hint: 'Drag to zone homes. They need a road nearby and power to grow.' },
  { id: 'com', name: 'Shops', cost: 5, zone: C, hint: 'Drag to zone shops and offices. They give your people jobs.' },
  { id: 'ind', name: 'Industry', cost: 5, zone: I, hint: 'Drag to zone industry: lots of jobs, but it pollutes. Keep it away from homes.' },
  { id: 'coal', name: 'Coal plant', cost: 3000, struct: 'coal', hint: 'Power for the city. Place it touching a road or zone: power flows through them. Dirty!' },
  { id: 'pump', name: 'Water', cost: 500, struct: 'pump', hint: 'Place next to water and touching a road. Water flows through roads and zones; buildings need it to grow.' },
  { id: 'park', name: 'Park', cost: 150, struct: 'park', hint: 'Parks raise land value around them.' },
  { id: 'police', name: 'Police', cost: 600, struct: 'police', hint: 'Cuts crime in a wide radius.' },
  { id: 'fire', name: 'Fire dept', cost: 600, struct: 'fire', hint: 'Prevents fires and puts them out quickly.' },
  { id: 'school', name: 'School', cost: 900, struct: 'school', pop: 600, hint: 'Educated citizens: needed for apartment towers and skyscrapers.' },
  { id: 'solar', name: 'Solar farm', cost: 6000, struct: 'solar', pop: 2000, hint: 'Clean power: no pollution.' },
  { id: 'stadium', name: 'Stadium', cost: 9000, struct: 'stadium', pop: 6000, hint: 'A landmark: big land value boost across the city.' },
  { id: 'bulldoze', name: 'Bulldoze', cost: 5, hint: 'Drag to clear roads, buildings, zones and trees.' },
];
const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
const MILESTONES = [[0, 'Hamlet'], [120, 'Village'], [600, 'Town'], [2000, 'City'], [6000, 'Capital'], [15000, 'Metropolis']];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CITY_NAMES = ['Neapolis', 'Nova Arcadia', 'Lumen Bay', 'Riverton', 'Kalypso', 'Port Helios', 'Elmsford', 'Marisol', 'Aurelia', 'Thessa', 'Brightwater', 'Ostia Nova'];

// ------------------------------------------------------------------ city state
const city = {
  seed: 1, name: 'Neapolis', funds: 20000, tax: 9, month: 0, rank: 0,
  terrain: new Uint8Array(NN), // 0 land, 1 water
  road: new Uint8Array(NN), zone: new Uint8Array(NN), level: new Uint8Array(NN),
  variant: new Uint8Array(NN), tree: new Uint8Array(NN), structs: [],
};
const occ = new Int16Array(NN).fill(-1);
const power = new Uint8Array(NN), water = new Uint8Array(NN), access = new Uint8Array(NN);
const lv = new Float32Array(NN), pol = new Float32Array(NN), crime = new Float32Array(NN);
const cov = { police: new Float32Array(NN), fire: new Float32Array(NN), school: new Float32Array(NN), park: new Float32Array(NN), stadium: new Float32Array(NN) };
const burn = new Float32Array(NN), unhappy = new Uint8Array(NN), anim = new Float32Array(NN).fill(1);
const distLand = new Uint8Array(NN);
const stats = { pop: 0, jobsC: 0, jobsI: 0, dem: { r: 0.7, c: 0.5, i: 0.8 }, income: 0, expense: 0, powerCap: 0, powerUse: 0, waterCap: 0, waterUse: 0 };

function rebuildOcc() {
  occ.fill(-1);
  city.structs.forEach((s, k) => { for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) occ[idx(x, y)] = k; });
}
function generateMap(seed) {
  const r = mulberry32(seed * 131 + 7);
  const t = city.terrain;
  t.fill(0);
  // a meandering river from one edge to the other
  const vertical = r() < 0.5;
  let c = 6 + r() * (N - 12), drift = 0;
  for (let a = 0; a < N; a++) {
    drift = clamp(drift + (r() - 0.5) * 0.5, -0.6, 0.6);
    c = clamp(c + drift, 3, N - 5);
    const w = 2 + (r() < 0.25 ? 1 : 0);
    for (let k = 0; k < w; k++) { const b = Math.round(c) + k; if (vertical) t[idx(b, a)] = 1; else t[idx(a, b)] = 1; }
  }
  // a lake
  const lx = r() < 0.5 ? 5 : N - 6, ly = r() < 0.5 ? 5 : N - 6, lr = 2 + r() * 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - lx, y - ly) < lr + r() * 0.8) t[idx(x, y)] = 1;
  // forests
  const n = valueNoise(r);
  city.tree.fill(0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!t[idx(x, y)] && n(x / N, y / N) > 0.62 && r() < 0.75) city.tree[idx(x, y)] = 1;
  for (let k = 0; k < NN; k++) city.variant[k] = (r() * 255) | 0;
}
function computeDistLand() {
  const q = [];
  for (let k = 0; k < NN; k++) { distLand[k] = city.terrain[k] ? 255 : 0; if (!city.terrain[k]) q.push(k); }
  while (q.length) {
    const k = q.shift(), x = k % N, y = (k / N) | 0;
    for (const [dx, dy] of D4) {
      const a = x + dx, b = y + dy;
      if (inside(a, b) && distLand[idx(a, b)] > distLand[k] + 1) { distLand[idx(a, b)] = distLand[k] + 1; q.push(idx(a, b)); }
    }
  }
}

// ------------------------------------------------------------------ renderer and isometric camera
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
scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x5a6a4a, 1.2));
const sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const timeU = { value: 0 };

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
const EL = Math.atan(1 / Math.SQRT2);
const rig = { target: new THREE.Vector3(0, 0, 0), yaw: Math.PI / 4, yawGoal: Math.PI / 4, viewH: 18, viewGoal: 18 };
function updateCamera(dt) {
  rig.yaw += (rig.yawGoal - rig.yaw) * Math.min(1, dt * 9);
  rig.viewH += (rig.viewGoal - rig.viewH) * Math.min(1, dt * 12);
  const half = N / 2 - 1;
  rig.target.x = clamp(rig.target.x, -half, half);
  rig.target.z = clamp(rig.target.z, -half, half);
  const dir = new THREE.Vector3(Math.sin(rig.yaw) * Math.cos(EL), Math.sin(EL), Math.cos(rig.yaw) * Math.cos(EL));
  camera.position.copy(rig.target).addScaledVector(dir, 120);
  camera.lookAt(rig.target);
  const aspect = window.innerWidth / window.innerHeight;
  camera.top = rig.viewH / 2; camera.bottom = -rig.viewH / 2;
  camera.left = (-rig.viewH * aspect) / 2; camera.right = (rig.viewH * aspect) / 2;
  camera.updateProjectionMatrix();
}
function resize() { renderer.setSize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ geometry helpers
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
const box = (p, w, h, d, x, y, z, c) => p.push({ g: new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), c });
const roof = (p, w, h, d, x, y, z, c, ry = 0) => p.push({ g: roofGeo().scale(w, h, d).rotateY(ry).translate(x, y, z), c });
const cyl = (p, r1, r2, h, x, y, z, c, s = 10) => p.push({ g: new THREE.CylinderGeometry(r1, r2, h, s).translate(x, y + h / 2, z), c });
const cone = (p, r, h, x, y, z, c, s = 8) => p.push({ g: new THREE.ConeGeometry(r, h, s).translate(x, y + h / 2, z), c });
// Window bands: a slightly larger dark box wrapped round each floor.
function floors(p, w, d, x, z, y0, n, fh, glass) { for (let k = 0; k < n; k++) box(p, w + 0.012, fh * 0.42, d + 0.012, x, y0 + k * fh + fh * 0.3, z, glass); }
const pickC = (r, arr) => arr[(r() * arr.length) | 0];

const PAL = {
  wallR: [0xf4e9d8, 0xdfe9f2, 0xf6d9d0, 0xe8f0d8, 0xf2e3c2], roofR: [0xc0533a, 0x7a5a48, 0x5b6b7a, 0x9a3f3f, 0x4f7a5a],
  wallC: [0xe9eef5, 0xd8e3f0, 0xf3e6d2, 0xcfd8e2], glass: [0x5fa8e8, 0x4a86c8, 0x6cc0e0, 0x3f6fa8], awning: [0xe55a4f, 0x3fa37a, 0xf2a03d, 0x4a7de0],
  wallI: [0xb9b4a8, 0xc7c0ae, 0xa8b0b5, 0xc2b49a], roofI: [0x7a7f87, 0x8a6a50, 0x6f7f74], accent: [0xe0a030, 0xd65a3a, 0x3a8ad6],
};
function zoneTemplate(zone, level, v) {
  const r = mulberry32(zone * 1000 + level * 100 + v * 7 + 3);
  const p = [];
  const chimneys = [];
  if (zone === R) {
    const wall = pickC(r, PAL.wallR), rf = pickC(r, PAL.roofR);
    if (level === 1) {
      box(p, 0.6, 0.02, 0.6, 0, 0, 0.05, 0x6dbb4f);
      box(p, 0.46, 0.3, 0.38, -0.05, 0, -0.06, wall);
      roof(p, 0.52, 0.22, 0.44, -0.05, 0.3, -0.06, rf);
      box(p, 0.1, 0.17, 0.02, -0.05, 0, 0.14, 0x5a3a24);
      box(p, 0.09, 0.08, 0.02, 0.1, 0.12, 0.14, 0xbfe3ff);
      box(p, 0.08, 0.16, 0.08, 0.12, 0.34, -0.12, 0x8a7f74);
      cone(p, 0.09, 0.22, 0.24, 0, 0.22, 0x3d9848, 7); cyl(p, 0.02, 0.02, 0.06, 0.24, 0, 0.22, 0x6b4a2b, 5);
    } else if (level === 2) {
      const n = 2 + (v % 2);
      const w = 0.84 / n;
      for (let k = 0; k < n; k++) {
        const x = -0.42 + w * (k + 0.5), h = 0.48 + r() * 0.12, c = k % 2 ? wall : pickC(r, PAL.wallR);
        box(p, w - 0.02, h, 0.5, x, 0, -0.04, c);
        floors(p, w - 0.02, 0.5, x, -0.04, 0, 2, h / 2, 0x9cc7ea);
        roof(p, w + 0.02, 0.2, 0.56, x, h, -0.04, rf);
        box(p, 0.08, 0.16, 0.02, x, 0, 0.22, 0x5a3a24);
      }
    } else {
      const h = 1.3 + r() * 0.9, n = Math.round(h / 0.22);
      box(p, 0.72, 0.12, 0.72, 0, 0, 0, 0xcfc8bb);
      box(p, 0.62, h, 0.62, 0, 0.12, 0, wall);
      floors(p, 0.62, 0.62, 0, 0, 0.12, n, h / n, 0x6fa3d0);
      box(p, 0.66, 0.05, 0.66, 0, 0.12 + h, 0, 0x8a8f96);
      box(p, 0.18, 0.12, 0.14, 0.14, 0.17 + h, -0.1, 0xb8bcc2);
      box(p, 0.16, 0.2, 0.02, 0, 0, 0.37, 0x3d4250);
    }
  } else if (zone === C) {
    const wall = pickC(r, PAL.wallC), gl = pickC(r, PAL.glass);
    if (level === 1) {
      box(p, 0.7, 0.36, 0.56, 0, 0, -0.04, wall);
      box(p, 0.62, 0.18, 0.02, 0, 0.04, 0.25, gl);
      box(p, 0.72, 0.04, 0.16, 0, 0.26, 0.3, pickC(r, PAL.awning));
      box(p, 0.4, 0.12, 0.04, 0, 0.36, 0.18, pickC(r, PAL.awning));
      box(p, 0.74, 0.03, 0.6, 0, 0.36, -0.04, 0x8a8f96);
    } else if (level === 2) {
      const h = 0.8 + r() * 0.4, n = Math.round(h / 0.2);
      box(p, 0.76, h, 0.66, 0, 0, 0, wall);
      floors(p, 0.76, 0.66, 0, 0, 0, n, h / n, gl);
      box(p, 0.5, 0.1, 0.4, 0, h, 0, 0x9aa0a8);
      box(p, 0.3, 0.2, 0.02, 0, 0, 0.34, 0x2f3540);
    } else {
      const h1 = 1.4 + r() * 0.8, h2 = 0.7 + r() * 0.8;
      box(p, 0.74, 0.18, 0.74, 0, 0, 0, 0xd5d9df);
      box(p, 0.64, h1, 0.64, 0, 0.18, 0, gl);
      for (let k = 0; k < Math.round(h1 / 0.18); k++) box(p, 0.652, 0.025, 0.652, 0, 0.18 + k * 0.18, 0, 0xe6ecf2);
      box(p, 0.46, h2, 0.46, 0, 0.18 + h1, 0, gl);
      for (let k = 0; k < Math.round(h2 / 0.18); k++) box(p, 0.472, 0.025, 0.472, 0, 0.18 + h1 + k * 0.18, 0, 0xe6ecf2);
      cyl(p, 0.015, 0.015, 0.4, 0, 0.18 + h1 + h2, 0, 0xdde3ea, 6);
      box(p, 0.22, 0.12, 0.02, 0, 0.03, 0.38, pickC(r, PAL.awning));
    }
  } else {
    const wall = pickC(r, PAL.wallI), rf = pickC(r, PAL.roofI), ac = pickC(r, PAL.accent);
    if (level === 1) {
      box(p, 0.76, 0.32, 0.6, 0, 0, -0.03, wall);
      for (const x of [-0.19, 0.19]) roof(p, 0.38, 0.16, 0.6, x, 0.32, -0.03, rf, Math.PI / 2);
      box(p, 0.26, 0.22, 0.02, 0, 0, 0.275, ac);
      box(p, 0.16, 0.1, 0.16, 0.28, 0, 0.32, 0x8a6a40);
    } else if (level === 2) {
      box(p, 0.82, 0.42, 0.72, 0, 0, 0, wall);
      box(p, 0.84, 0.04, 0.74, 0, 0.42, 0, rf);
      box(p, 0.3, 0.26, 0.02, -0.15, 0, 0.37, ac);
      cyl(p, 0.06, 0.07, 0.8, 0.26, 0.42, -0.22, 0x9a8f86, 8);
      cyl(p, 0.065, 0.065, 0.06, 0.26, 1.12, -0.22, 0xd65a3a, 8);
      chimneys.push([0.26, 1.24, -0.22]);
    } else {
      box(p, 0.86, 0.56, 0.6, 0, 0, -0.1, wall);
      for (const x of [-0.29, 0, 0.29]) roof(p, 0.29, 0.18, 0.6, x, 0.56, -0.1, rf, Math.PI / 2);
      for (const x of [-0.22, 0.1]) { cyl(p, 0.06, 0.075, 1.0, x, 0.56, -0.28, 0x9a8f86, 8); cyl(p, 0.07, 0.07, 0.06, x, 1.48, -0.28, 0xd65a3a, 8); chimneys.push([x, 1.6, -0.28]); }
      cyl(p, 0.14, 0.14, 0.34, 0.28, 0, 0.3, 0xc9ccd1, 12);
      box(p, 0.3, 0.24, 0.02, -0.18, 0, 0.21, ac);
    }
  }
  const geo = mergeParts(p);
  geo.userData.chimneys = chimneys;
  return geo;
}
function structGeo(type) {
  const p = [];
  if (type === 'coal') {
    box(p, 1.9, 0.04, 1.9, 0, 0, 0, 0x9a9488);
    box(p, 1.1, 0.7, 0.8, -0.3, 0, 0.35, 0xb7b0a4);
    floors(p, 1.1, 0.8, -0.3, 0.35, 0, 2, 0.35, 0x6d7a88);
    box(p, 1.14, 0.06, 0.84, -0.3, 0.7, 0.35, 0x7a7f87);
    for (const [x, z] of [[0.55, -0.45], [0.55, 0.25]]) {
      cyl(p, 0.16, 0.2, 1.6, x, 0, z, 0xd8d4cc, 12);
      for (let k = 0; k < 3; k++) cyl(p, 0.165 - k * 0.012, 0.17 - k * 0.012, 0.12, x, 0.4 + k * 0.45, z, 0xd04a3a, 12);
    }
    cone(p, 0.42, 0.3, -0.5, 0, -0.5, 0x2e2b2a, 7);
    cone(p, 0.3, 0.22, -0.05, 0, -0.62, 0x3a3634, 7);
  } else if (type === 'solar') {
    box(p, 1.9, 0.03, 1.9, 0, 0, 0, 0x7dbb5a);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const x = -0.6 + a * 0.6, z = -0.6 + b * 0.6;
      box(p, 0.04, 0.16, 0.04, x, 0.03, z, 0x9aa0a8);
      p.push({ g: new THREE.BoxGeometry(0.5, 0.03, 0.42).rotateX(-0.45).translate(x, 0.24, z), c: 0x21407a });
    }
    box(p, 0.3, 0.24, 0.2, 0.75, 0.03, 0.8, 0xe9eef5);
  } else if (type === 'pump') {
    box(p, 0.5, 0.26, 0.42, -0.12, 0, 0.1, 0xdfe6ee);
    box(p, 0.54, 0.04, 0.46, -0.12, 0.26, 0.1, 0x3a7ac8);
    for (const [x, z] of [[0.14, -0.3], [0.38, -0.3], [0.14, -0.06], [0.38, -0.06]]) cyl(p, 0.015, 0.015, 0.5, x, 0, z, 0x8a8f96, 5);
    cyl(p, 0.18, 0.18, 0.28, 0.26, 0.5, -0.18, 0x5aa6ea, 12);
    cone(p, 0.19, 0.1, 0.26, 0.78, -0.18, 0x3a7ac8, 12);
  } else if (type === 'police') {
    box(p, 0.78, 0.4, 0.6, 0, 0, -0.06, 0xeef2f7);
    box(p, 0.8, 0.08, 0.62, 0, 0.32, -0.06, 0x2f5fc0);
    box(p, 0.82, 0.04, 0.64, 0, 0.4, -0.06, 0x3a4250);
    box(p, 0.2, 0.24, 0.02, 0, 0, 0.25, 0x2f3a4a);
    box(p, 0.08, 0.05, 0.05, -0.04, 0.44, -0.06, 0xff3b3b);
    box(p, 0.08, 0.05, 0.05, 0.04, 0.44, -0.06, 0x3b6bff);
    box(p, 0.3, 0.1, 0.18, 0.2, 0, 0.36, 0x1f3f8a);
  } else if (type === 'fire') {
    box(p, 0.7, 0.42, 0.62, -0.06, 0, -0.04, 0xc8453a);
    for (const x of [-0.24, 0.1]) box(p, 0.26, 0.28, 0.02, x, 0, 0.27, 0xe9e4da);
    box(p, 0.72, 0.04, 0.64, -0.06, 0.42, -0.04, 0x7a2a24);
    box(p, 0.2, 0.8, 0.2, 0.3, 0, -0.22, 0xd25a48);
    roof(p, 0.24, 0.12, 0.24, 0.3, 0.8, -0.22, 0x7a2a24);
  } else if (type === 'school') {
    box(p, 0.82, 0.38, 0.36, 0, 0, -0.2, 0xf2dfb0);
    box(p, 0.34, 0.38, 0.5, -0.24, 0, 0.1, 0xf2dfb0);
    floors(p, 0.82, 0.36, 0, -0.2, 0, 1, 0.38, 0x8cc0ea);
    roof(p, 0.86, 0.16, 0.4, 0, 0.38, -0.2, 0xb0553a);
    roof(p, 0.38, 0.16, 0.54, -0.24, 0.38, 0.1, 0xb0553a, Math.PI / 2);
    box(p, 0.36, 0.02, 0.32, 0.2, 0, 0.2, 0xd9a05a);
    cyl(p, 0.012, 0.012, 0.6, 0.38, 0, 0.36, 0xdddddd, 5);
    box(p, 0.16, 0.1, 0.01, 0.46, 0.48, 0.36, 0x3b82f6);
  } else if (type === 'park') {
    box(p, 0.96, 0.03, 0.96, 0, 0, 0, 0x6cc24a);
    box(p, 0.96, 0.035, 0.14, 0, 0, 0, 0xe8dcc0);
    box(p, 0.14, 0.035, 0.96, 0, 0, 0, 0xe8dcc0);
    cyl(p, 0.16, 0.18, 0.06, 0, 0.03, 0, 0xcfc8bb, 12);
    cyl(p, 0.12, 0.12, 0.02, 0, 0.09, 0, 0x5ab4ea, 12);
    for (const [x, z] of [[-0.3, -0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, 0.3]]) {
      cyl(p, 0.025, 0.03, 0.12, x, 0.03, z, 0x6b4a2b, 5);
      p.push({ g: new THREE.IcosahedronGeometry(0.13, 0).translate(x, 0.24, z), c: 0x3f9a40 });
    }
  } else if (type === 'stadium') {
    box(p, 1.95, 0.03, 1.95, 0, 0, 0, 0xbab3a6);
    p.push({ g: new THREE.CylinderGeometry(0.95, 0.82, 0.5, 28, 1, true).translate(0, 0.28, 0), c: 0xe6e9ee });
    p.push({ g: new THREE.CylinderGeometry(0.9, 0.78, 0.48, 28, 1, true).scale(-1, 1, 1).translate(0, 0.29, 0), c: 0x3b82f6 });
    cyl(p, 0.75, 0.75, 0.04, 0, 0.03, 0, 0x4fb04a, 28);
    box(p, 0.9, 0.005, 0.02, 0, 0.07, 0, 0xffffff);
    for (const a of [0.5, 2.1, 3.7, 5.3]) cyl(p, 0.02, 0.02, 0.95, Math.cos(a) * 0.98, 0, Math.sin(a) * 0.98, 0xc9ccd1, 5);
  }
  return mergeParts(p);
}

// ------------------------------------------------------------------ ground, river and diorama
const gridTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(0,0,0,0.06)';
  g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64); g.fillRect(0, 62, 64, 2); g.fillRect(62, 0, 2, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
})();
const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: gridTex, flatShading: true, roughness: 0.95 });
const ground = new THREE.Mesh(new THREE.BufferGeometry(), groundMat);
ground.receiveShadow = true;
scene.add(ground);
const BED = -0.34;
function buildGround() {
  const pos = [], col = [], uv = [];
  const quad = (a, b, c2, d, color, u = true) => {
    for (const v of [a, b, c2, a, c2, d]) pos.push(...v);
    const cc = new THREE.Color(color);
    for (let k = 0; k < 6; k++) col.push(cc.r, cc.g, cc.b);
    const U = u ? [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]] : [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]];
    for (const q of U) uv.push(...q);
  };
  const g1 = new THREE.Color(0x86c45a), g2 = new THREE.Color(0x7dbb52);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const k = idx(x, y), x0 = x - N / 2, z0 = y - N / 2, x1 = x0 + 1, z1 = z0 + 1;
      if (city.terrain[k]) { quad([x0, BED, z0], [x0, BED, z1], [x1, BED, z1], [x1, BED, z0], 0xc9b98a, false); continue; }
      const c = ((x + y) & 1 ? g1 : g2).clone().multiplyScalar(0.96 + ((city.variant[k] & 7) / 7) * 0.06);
      quad([x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], c);
      // banks down to the river bed and around the edge of the board
      const side = (nx, ny, a, b) => {
        const outside = !inside(nx, ny);
        if (!outside && !city.terrain[idx(nx, ny)]) return;
        const low = outside ? -0.6 : BED;
        quad([a[0], 0, a[1]], [a[0], low, a[1]], [b[0], low, b[1]], [b[0], 0, b[1]], 0x9a7a4e, false);
      };
      side(x, y + 1, [x0, z1], [x1, z1]);
      side(x + 1, y, [x1, z1], [x1, z0]);
      side(x, y - 1, [x1, z0], [x0, z0]);
      side(x - 1, y, [x0, z0], [x0, z1]);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  ground.geometry.dispose();
  ground.geometry = geo;
  updateWaterDepth();
}
{
  const bands = [[-0.6, -1.3, 0x8a6a40], [-1.3, -2.1, 0x6b4f30], [-2.1, -3, 0x4f3a24]];
  for (const [top, bot, c] of bands) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(N, top - bot, N), new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 }));
    m.position.y = (top + bot) / 2;
    scene.add(m);
  }
  const bed = new THREE.Mesh(new THREE.BoxGeometry(N, 0.26, N), new THREE.MeshStandardMaterial({ color: 0xa08a5c, roughness: 1 }));
  bed.position.y = -0.6 + 0.13 - 0.001;
  scene.add(bed);
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const g = sc.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  rg.addColorStop(0, 'rgba(0,0,0,0.32)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(N * 1.7, N * 1.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.position.y = -4;
  scene.add(shadow);
}
const WATER_Y = -0.08;
const WSEG = N * 2;
const waterGeo = new THREE.PlaneGeometry(N, N, WSEG, WSEG).rotateX(-Math.PI / 2);
waterGeo.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array((WSEG + 1) * (WSEG + 1)), 1));
const waterMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: timeU, uShallow: { value: new THREE.Color(0x63d6e4) }, uDeep: { value: new THREE.Color(0x2275c2) } },
  vertexShader: `
    attribute float aDepth; varying float vDepth; varying vec2 vXZ;
    void main() { vDepth = aDepth; vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform vec3 uShallow; uniform vec3 uDeep; uniform float uTime;
    varying float vDepth; varying vec2 vXZ;
    void main() {
      float d = clamp(vDepth, 0.0, 1.0);
      vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d));
      float shore = smoothstep(0.12, 0.0, vDepth);
      float band = smoothstep(0.8, 1.0, sin(uTime * 1.6 - vDepth * 22.0) * 0.5 + 0.5) * smoothstep(0.5, 0.1, vDepth);
      float foam = max(shore, band * 0.7);
      float sp = pow(max(0.0, sin(vXZ.x * 2.3 + uTime * 1.1) * sin(vXZ.y * 2.9 - uTime * 0.9)), 28.0);
      col = mix(col, vec3(1.0, 0.99, 0.95), foam * 0.85) + sp * 0.3;
      gl_FragColor = vec4(col, mix(0.7, 0.9, d));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.position.y = WATER_Y;
waterMesh.renderOrder = 2;
scene.add(waterMesh);
function updateWaterDepth() {
  const pos = waterGeo.attributes.position.array, dep = waterGeo.attributes.aDepth.array;
  for (let k = 0; k < dep.length; k++) {
    const x = pos[k * 3] + N / 2, z = pos[k * 3 + 2] + N / 2;
    let d = 9;
    for (const [ox, oz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
      const tx = Math.floor(x + ox), tz = Math.floor(z + oz);
      if (!inside(tx, tz)) continue;
      const t = idx(tx, tz);
      d = Math.min(d, city.terrain[t] ? (distLand[t] - 1) * 0.45 + 0.15 : 0);
    }
    dep[k] = d === 9 ? 0.6 : d;
  }
  waterGeo.attributes.aDepth.needsUpdate = true;
}

// ------------------------------------------------------------------ instanced layers
const lambert = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78 });
function inst(geo, mat, max, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.count = 0;
  m.frustumCulled = false; // instance bounds change constantly
  m.castShadow = shadow; m.receiveShadow = true;
  scene.add(m);
  return m;
}
const tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const zoneMesh = inst(tileGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false }), NN, false);
zoneMesh.setColorAt(0, new THREE.Color());
const roadMesh = inst(new THREE.BoxGeometry(1, 0.05, 1).translate(0, 0.025, 0), new THREE.MeshStandardMaterial({ color: 0x454a57, roughness: 0.9 }), NN, false);
const curbMesh = inst(new THREE.BoxGeometry(1, 0.055, 0.08).translate(0, 0.0275, 0), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.9 }), NN * 4, false);
const dashMesh = inst(new THREE.BoxGeometry(0.05, 0.01, 0.26).translate(0, 0.055, 0), new THREE.MeshBasicMaterial({ color: 0xf6f2e2 }), NN * 4, false);
const pillarMesh = inst(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8).translate(0, -0.2, 0), new THREE.MeshStandardMaterial({ color: 0xb8b4ac }), NN, true);
const treeGeo = mergeParts([
  { g: new THREE.CylinderGeometry(0.035, 0.05, 0.2, 5).translate(0, 0.1, 0), c: 0x6b4a2b },
  { g: new THREE.IcosahedronGeometry(0.2, 0).translate(0, 0.32, 0), c: 0x4c9a3a },
  { g: new THREE.IcosahedronGeometry(0.13, 0).translate(0.1, 0.46, 0.04), c: 0x5cab45 },
]);
const pineGeo = mergeParts([
  { g: new THREE.CylinderGeometry(0.035, 0.05, 0.16, 5).translate(0, 0.08, 0), c: 0x6b4a2b },
  { g: new THREE.ConeGeometry(0.2, 0.34, 7).translate(0, 0.3, 0), c: 0x2f7d3a },
  { g: new THREE.ConeGeometry(0.14, 0.26, 7).translate(0, 0.5, 0), c: 0x3d9848 },
]);
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
const treeMeshes = [inst(treeGeo, swayMat, NN * 2), inst(pineGeo, swayMat, NN * 2)];
const templates = {};
const VARIANTS = 3;
for (let z = 1; z <= 3; z++) for (let l = 1; l <= 3; l++) for (let v = 0; v < VARIANTS; v++) {
  const geo = zoneTemplate(z, l, v);
  templates[`${z}-${l}-${v}`] = { mesh: inst(geo, lambert, 420), chimneys: geo.userData.chimneys };
}
const STRUCT_GEO = {};
for (const k of Object.keys(STRUCT)) STRUCT_GEO[k] = structGeo(k);
const structGroup = new THREE.Group();
scene.add(structGroup);
const markerMesh = inst(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0xffd23f }), NN, false);
markerMesh.setColorAt(0, new THREE.Color());
const overlayMesh = inst(tileGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.62, depthWrite: false }), NN, false);
overlayMesh.setColorAt(0, new THREE.Color());
overlayMesh.renderOrder = 4;
const previewMesh = inst(tileGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false, depthTest: false }), NN, false);
previewMesh.setColorAt(0, new THREE.Color());
previewMesh.renderOrder = 6;
const carGeo = mergeParts([
  { g: new THREE.BoxGeometry(0.12, 0.06, 0.22).translate(0, 0.07, 0), c: 0xffffff },
  { g: new THREE.BoxGeometry(0.1, 0.05, 0.11).translate(0, 0.125, -0.01), c: 0xdfe7f0 },
]);
const carMesh = inst(carGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5 }), 200, false);
carMesh.setColorAt(0, new THREE.Color());

const dummy = new THREE.Object3D();
const tc = new THREE.Color();
let layersDirty = true, buildingsDirty = true, structsDirty = true;

function roadDirs(x, y) { const out = []; for (const [dx, dy] of D4) if (inside(x + dx, y + dy) && city.road[idx(x + dx, y + dy)]) out.push([dx, dy]); return out; }
function layoutLayers() {
  let nz = 0, nr = 0, nc = 0, nd = 0, np = 0;
  const nt = [0, 0];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const k = idx(x, y);
      if (city.zone[k] && !city.road[k]) {
        dummy.position.set(wx(x), 0.012, wz(y)); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.94, 1, 0.94); dummy.updateMatrix();
        zoneMesh.setMatrixAt(nz, dummy.matrix);
        zoneMesh.setColorAt(nz, tc.set(ZONE_COL[city.zone[k]]).multiplyScalar(city.level[k] ? 0.75 : 1));
        nz++;
      }
      if (city.road[k]) {
        const dirs = roadDirs(x, y);
        dummy.position.set(wx(x), 0, wz(y)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        roadMesh.setMatrixAt(nr++, dummy.matrix);
        if (city.terrain[k]) { dummy.position.set(wx(x), 0, wz(y)); dummy.updateMatrix(); pillarMesh.setMatrixAt(np++, dummy.matrix); }
        for (const [dx, dy] of D4) {
          const has = dirs.some(([a, b]) => a === dx && b === dy);
          if (!has) {
            dummy.position.set(wx(x) + dx * 0.46, 0, wz(y) + dy * 0.46);
            dummy.rotation.set(0, dx ? Math.PI / 2 : 0, 0); dummy.updateMatrix();
            curbMesh.setMatrixAt(nc++, dummy.matrix);
          } else if (dirs.length <= 2) {
            dummy.position.set(wx(x) + dx * 0.25, 0, wz(y) + dy * 0.25);
            dummy.rotation.set(0, dx ? Math.PI / 2 : 0, 0); dummy.updateMatrix();
            dashMesh.setMatrixAt(nd++, dummy.matrix);
          }
        }
      }
      if (city.tree[k] && !city.road[k] && !city.level[k] && occ[k] < 0 && !city.terrain[k]) {
        const v = city.variant[k];
        for (let t = 0; t < 1 + (v & 1); t++) {
          const kind = (v >> (2 + t)) & 1;
          dummy.position.set(wx(x) + (((v >> t) & 3) / 3 - 0.5) * 0.5, 0, wz(y) + (((v >> (t + 3)) & 3) / 3 - 0.5) * 0.5);
          dummy.rotation.set(0, v * 0.1 + t, 0); dummy.scale.setScalar(0.8 + ((v >> 5) & 3) * 0.12); dummy.updateMatrix();
          treeMeshes[kind].setMatrixAt(nt[kind]++, dummy.matrix);
        }
      }
    }
  zoneMesh.count = nz; roadMesh.count = nr; curbMesh.count = nc; dashMesh.count = nd; pillarMesh.count = np;
  treeMeshes[0].count = nt[0]; treeMeshes[1].count = nt[1];
  for (const m of [zoneMesh, roadMesh, curbMesh, dashMesh, pillarMesh, ...treeMeshes]) m.instanceMatrix.needsUpdate = true;
  if (zoneMesh.instanceColor) zoneMesh.instanceColor.needsUpdate = true;
}
function facing(x, y) {
  for (const [dx, dy, ry] of [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]]) if (inside(x + dx, y + dy) && city.road[idx(x + dx, y + dy)]) return ry;
  return 0;
}
let animating = false;
const chimneyList = [], structChimneys = [];
function layoutBuildings() {
  const counts = {};
  for (const k of Object.keys(templates)) counts[k] = 0;
  chimneyList.length = 0;
  animating = false;
  for (let k = 0; k < NN; k++) {
    const L = city.level[k];
    if (!L || city.road[k]) continue;
    const key = `${city.zone[k]}-${L}-${city.variant[k] % VARIANTS}`;
    const t = templates[key];
    if (!t || counts[key] >= 420) continue;
    const x = k % N, y = (k / N) | 0, a = anim[k];
    if (a < 1) animating = true;
    const e = 1 - Math.pow(1 - a, 3);
    dummy.position.set(wx(x), 0, wz(y));
    dummy.rotation.set(0, facing(x, y), 0);
    dummy.scale.set(1, Math.max(0.05, e), 1);
    dummy.updateMatrix();
    t.mesh.setMatrixAt(counts[key]++, dummy.matrix);
    for (const c of t.chimneys) chimneyList.push({ k, v: new THREE.Vector3(...c).applyEuler(dummy.rotation).add(dummy.position) });
  }
  for (const key of Object.keys(templates)) { const m = templates[key].mesh; m.count = counts[key]; m.instanceMatrix.needsUpdate = true; }
}
function layoutStructs() {
  structGroup.clear();
  structChimneys.length = 0;
  for (const s of city.structs) {
    const m = new THREE.Mesh(STRUCT_GEO[s.type], lambert);
    m.castShadow = m.receiveShadow = true;
    m.position.set(wx(s.x) + (s.w - 1) / 2, 0, wz(s.y) + (s.h - 1) / 2);
    structGroup.add(m);
    if (s.type === 'coal') for (const [x, z] of [[0.55, -0.45], [0.55, 0.25]]) structChimneys.push({ k: -1, v: new THREE.Vector3(x, 1.65, z).add(m.position), big: true });
  }
}
function layoutMarkers() {
  let n = 0;
  for (let k = 0; k < NN; k++) {
    const need = (city.level[k] || occ[k] >= 0) && !(occ[k] >= 0 && ['coal', 'solar', 'park'].includes(city.structs[occ[k]].type));
    if (!need) continue;
    let c = null;
    if (!power[k]) c = 0xffd23f; else if (city.level[k] >= 1 && !water[k] && stats.waterCap > 0) c = 0x4fb4ff;
    if (!c) continue;
    const x = k % N, y = (k / N) | 0;
    const h = city.level[k] === 3 ? 2.6 : city.level[k] === 2 ? 1.3 : 0.9;
    dummy.position.set(wx(x), h, wz(y)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
    markerMesh.setMatrixAt(n, dummy.matrix); markerMesh.setColorAt(n, tc.set(c)); n++;
  }
  markerMesh.count = n;
  markerMesh.instanceMatrix.needsUpdate = true;
  if (markerMesh.instanceColor) markerMesh.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------ overlays
let overlay = 'none';
const OVERLAYS = {
  none: { name: 'None' },
  power: { name: 'Power', legend: 'Yellow: powered · Red: no power' },
  water: { name: 'Water', legend: 'Blue: water · Red: dry' },
  value: { name: 'Land value', legend: 'Red: low · Green: high' },
  pollution: { name: 'Pollution', legend: 'Clear: clean · Brown: polluted' },
  crime: { name: 'Crime', legend: 'Clear: safe · Red: dangerous' },
  services: { name: 'Services', legend: 'Police, fire and school coverage' },
};
const lowC = new THREE.Color(0xe0403a), midC = new THREE.Color(0xf5c542), hiC = new THREE.Color(0x3fbf5a);
function ramp(v) { return v < 0.5 ? tc.copy(lowC).lerp(midC, v * 2) : tc.copy(midC).lerp(hiC, (v - 0.5) * 2); }
function layoutOverlay() {
  let n = 0;
  if (overlay !== 'none') {
    for (let k = 0; k < NN; k++) {
      if (city.terrain[k] && !city.road[k]) continue;
      const conductive = city.road[k] || city.zone[k] || occ[k] >= 0;
      let c = null;
      if (overlay === 'power') { if (conductive) c = power[k] ? tc.set(0xffd23f) : tc.set(0xe0403a); }
      else if (overlay === 'water') { if (conductive) c = water[k] ? tc.set(0x3f9bff) : tc.set(0xe0403a); }
      else if (overlay === 'value') c = ramp(lv[k]);
      else if (overlay === 'pollution') { if (pol[k] > 0.04) c = tc.set(0xffffff).lerp(new THREE.Color(0x6b3f1a), clamp(pol[k] * 1.4, 0, 1)); }
      else if (overlay === 'crime') { if (crime[k] > 0.04) c = tc.set(0xffffff).lerp(new THREE.Color(0xc0262a), clamp(crime[k] * 1.6, 0, 1)); }
      else if (overlay === 'services') { const s = Math.max(cov.police[k], cov.fire[k], cov.school[k]); if (s > 0) c = tc.setRGB(0.3, 0.55, 1).lerp(new THREE.Color(0xffffff), 1 - s); }
      if (!c) continue;
      const x = k % N, y = (k / N) | 0;
      dummy.position.set(wx(x), 0.09, wz(y)); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.98, 1, 0.98); dummy.updateMatrix();
      overlayMesh.setMatrixAt(n, dummy.matrix); overlayMesh.setColorAt(n, c); n++;
    }
  }
  overlayMesh.count = n;
  overlayMesh.instanceMatrix.needsUpdate = true;
  if (overlayMesh.instanceColor) overlayMesh.instanceColor.needsUpdate = true;
  zoneMesh.visible = overlay === 'none';
}

// ------------------------------------------------------------------ particles
const PMAX = 700;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const dotTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.75)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const pMat = new THREE.PointsMaterial({ size: 8, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: false });
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
points.renderOrder = 3;
scene.add(points);
const parts = [];
function emit(x, y, z, color, n = 6, spread = 0.6, up = 1.5, life = 1, grav = 1.5, size = 1) {
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
    } else pPos[k * 3 + 1] = -100;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
  pMat.size = 6 * renderer.getPixelRatio() * (18 / rig.viewH);
}

// ------------------------------------------------------------------ simulation
function computeAccess() {
  const dist = new Uint8Array(NN).fill(255), q = [];
  for (let k = 0; k < NN; k++) if (city.road[k]) { dist[k] = 0; q.push(k); }
  while (q.length) {
    const k = q.shift(), x = k % N, y = (k / N) | 0;
    if (dist[k] >= 3) continue;
    for (const [dx, dy] of D4) {
      const a = x + dx, b = y + dy;
      if (inside(a, b) && dist[idx(a, b)] > dist[k] + 1) { dist[idx(a, b)] = dist[k] + 1; q.push(idx(a, b)); }
    }
  }
  for (let k = 0; k < NN; k++) access[k] = dist[k] <= 3 ? 1 : 0;
}
function utilUse(k) {
  if (city.level[k]) return UTIL_USE[city.level[k]];
  if (occ[k] >= 0) { const t = city.structs[occ[k]].type; return t === 'park' ? 0 : 1; }
  return 0;
}
// Power and water flow out from their sources through roads, zones and buildings.
function flow(out, kinds, capKey) {
  out.fill(0);
  let cap = 0, used = 0;
  const seen = new Uint8Array(NN), q = [];
  city.structs.forEach((s, si) => {
    if (!kinds.includes(s.type)) return;
    if (s.type === 'pump' && !nearWater(s)) return;
    cap += STRUCT[s.type][capKey];
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) { seen[idx(x, y)] = 1; out[idx(x, y)] = 1; q.push(idx(x, y)); }
  });
  while (q.length) {
    const k = q.shift(), x = k % N, y = (k / N) | 0;
    for (const [dx, dy] of D4) {
      const a = x + dx, b = y + dy;
      if (!inside(a, b)) continue;
      const j = idx(a, b);
      if (seen[j]) continue;
      if (!(city.road[j] || city.zone[j] || occ[j] >= 0)) continue;
      seen[j] = 1;
      const need = utilUse(j);
      if (used + need <= cap) { used += need; out[j] = 1; q.push(j); }
      else if (!need) q.push(j);
    }
  }
  return [cap, used];
}
function linked(s) {
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    if (!inside(x, y) || (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
    const k = idx(x, y);
    if (city.road[k] || city.zone[k] || (occ[k] >= 0 && city.structs[occ[k]] !== s)) return true;
  }
  return false;
}
function nearWater(s) {
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) if (inside(x, y) && city.terrain[idx(x, y)] && !city.road[idx(x, y)]) return true;
  return false;
}
function computeCoverage() {
  for (const a of Object.values(cov)) a.fill(0);
  for (const s of city.structs) {
    const arr = cov[s.type];
    if (!arr) continue;
    const r = STRUCT[s.type].radius, cx = s.x + (s.w - 1) / 2, cy = s.y + (s.h - 1) / 2;
    const ok = s.type === 'park' || power[idx(s.x, s.y)];
    if (!ok) continue;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(N - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(N - 1, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) arr[idx(x, y)] = Math.max(arr[idx(x, y)], 1 - d / (r + 1));
      }
  }
}
function computeEnvironment() {
  pol.fill(0);
  const addPol = (cx, cy, amt, r) => {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(N - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(N - 1, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) pol[idx(x, y)] += amt * (1 - d / (r + 1));
      }
  };
  for (let k = 0; k < NN; k++) if (city.zone[k] === I && city.level[k]) addPol(k % N, (k / N) | 0, 0.09 * city.level[k], 3 + city.level[k]);
  for (const s of city.structs) if (s.type === 'coal') addPol(s.x + 0.5, s.y + 0.5, 0.75, 7);
  for (let k = 0; k < NN; k++) { if (city.tree[k] && !city.level[k]) pol[k] *= 0.8; pol[k] = clamp(pol[k], 0, 1); }
  for (let k = 0; k < NN; k++) {
    const dense = city.level[k] && city.zone[k] !== I ? 0.1 + city.level[k] * 0.12 : city.zone[k] ? 0.08 : 0;
    crime[k] = clamp(dense * 0.6 + (stats.pop > 2000 ? 0.08 : 0) - cov.police[k] * 0.75, 0, 1);
  }
  for (let k = 0; k < NN; k++) {
    let v = 0.38 + cov.park[k] * 0.3 + cov.police[k] * 0.1 + cov.school[k] * 0.12 + cov.stadium[k] * 0.25 + (city.tree[k] ? 0.05 : 0);
    if (city.terrain[k] === 0 && distLand[k] === 0) { const near = waterNear(k); if (near) v += 0.12; }
    v -= pol[k] * 0.7 + crime[k] * 0.25;
    lv[k] = clamp(v, 0, 1);
  }
}
function waterNear(k) {
  const x = k % N, y = (k / N) | 0;
  for (let b = y - 2; b <= y + 2; b++) for (let a = x - 2; a <= x + 2; a++) if (inside(a, b) && city.terrain[idx(a, b)]) return true;
  return false;
}
function computeTotals() {
  let pop = 0, jc = 0, ji = 0;
  for (let k = 0; k < NN; k++) {
    const L = city.level[k];
    if (!L) continue;
    const z = city.zone[k];
    if (z === R) pop += CAP[R][L]; else if (z === C) jc += CAP[C][L]; else if (z === I) ji += CAP[I][L];
  }
  Object.assign(stats, { pop, jobsC: jc, jobsI: ji });
  const tm = 1 - (city.tax - 9) / 14;
  stats.dem.r = clamp(((jc + ji) * 1.15 + 70 - pop) / (pop * 0.25 + 90), -1, 1) * tm;
  stats.dem.c = clamp((pop * 0.33 - jc + 14) / (pop * 0.12 + 30), -1, 1) * tm;
  stats.dem.i = clamp((pop * 0.45 - ji + 24) / (pop * 0.15 + 30), -1, 1) * tm;
  stats.dem.r = clamp(stats.dem.r, -1, 1); stats.dem.c = clamp(stats.dem.c, -1, 1); stats.dem.i = clamp(stats.dem.i, -1, 1);
}
function recompute() {
  rebuildOcc();
  computeAccess();
  [stats.powerCap, stats.powerUse] = flow(power, ['coal', 'solar'], 'power');
  [stats.waterCap, stats.waterUse] = flow(water, ['pump'], 'water');
  computeCoverage();
  computeTotals();
  computeEnvironment();
}
const rnd = Math.random;
function grow() {
  const order = [];
  for (let k = 0; k < NN; k++) if (city.zone[k] && !city.road[k]) order.push(k);
  for (let i = order.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  let changed = 0, abandoned = 0;
  for (const k of order) {
    const z = city.zone[k], L = city.level[k];
    const dem = z === R ? stats.dem.r : z === C ? stats.dem.c : stats.dem.i;
    const ok = access[k] && power[k];
    if (burn[k] > 0) continue;
    if (!L) {
      if (ok && dem > 0 && rnd() < 0.3 * dem * (0.5 + lv[k])) { city.level[k] = 1; city.variant[k] = (rnd() * 255) | 0; anim[k] = 0; changed++; }
      continue;
    }
    if (!ok) {
      unhappy[k]++;
      if (unhappy[k] >= 4) { city.level[k]--; unhappy[k] = 0; abandoned++; changed++; }
      continue;
    }
    unhappy[k] = 0;
    let maxL = 1;
    if (water[k] && lv[k] >= 0.3) maxL = 2;
    if (water[k] && lv[k] >= 0.5 && stats.pop >= 1200 && (z !== R || cov.school[k] > 0) && (z !== C || stats.pop >= 1500)) maxL = 3;
    if (z === R && pol[k] > 0.55) maxL = Math.min(maxL, 1);
    if (L < maxL && dem > 0.05 && rnd() < 0.1 * dem * (0.5 + lv[k])) { city.level[k]++; anim[k] = 0; changed++; }
    else if (L > maxL && rnd() < 0.08) { city.level[k]--; changed++; }
    else if (dem < -0.45 && rnd() < 0.03) { city.level[k]--; changed++; }
  }
  if (changed) buildingsDirty = layersDirty = true;
  return abandoned;
}
function fires() {
  for (let k = 0; k < NN; k++) {
    if (burn[k] > 0) {
      burn[k] -= 1 + cov.fire[k] * 3;
      const x = k % N, y = (k / N) | 0;
      if (rnd() < 0.22 * (1 - cov.fire[k])) {
        const [dx, dy] = D4[(rnd() * 4) | 0];
        const j = idx(clamp(x + dx, 0, N - 1), clamp(y + dy, 0, N - 1));
        if (city.level[j] && burn[j] <= 0) burn[j] = 5;
      }
      if (burn[k] <= 0) {
        burn[k] = 0;
        if (cov.fire[k] < 0.15) { city.level[k] = 0; buildingsDirty = layersDirty = true; }
      }
    } else if (city.level[k] && rnd() < 0.00035 * (city.zone[k] === I ? 3 : 1) * (1 - cov.fire[k] * 0.9)) {
      burn[k] = 5;
      advise(`Fire in the ${ZONE_NAME[city.zone[k]].toLowerCase()} district!`, true, k);
      sfx.alarm();
    }
  }
}
function finances() {
  let roads = 0, upkeep = 0;
  for (let k = 0; k < NN; k++) if (city.road[k]) roads += city.terrain[k] ? 1.5 : 0.5;
  for (const s of city.structs) upkeep += STRUCT[s.type].upkeep;
  const income = (stats.pop * 0.55 + (stats.jobsC + stats.jobsI) * 0.45) * (city.tax / 100) * 2.4;
  stats.income = Math.round(income);
  stats.expense = Math.round(roads + upkeep);
  city.funds += stats.income - stats.expense;
}
let adviceT = 0, lastAdvice = '';
function advise(msg, urgent = false, k = -1) {
  if (msg === lastAdvice && !urgent) return;
  lastAdvice = msg;
  toast(msg, k);
}
function adviceTick() {
  adviceT--;
  if (adviceT > 0) return;
  adviceT = 6;
  const hasRoad = city.road.some((v) => v), hasZone = city.zone.some((v) => v);
  const plants = city.structs.some((s) => s.type === 'coal' || s.type === 'solar');
  let unpowered = 0, dry = 0, emptyR = 0;
  for (let k = 0; k < NN; k++) {
    if (city.zone[k] && !power[k]) unpowered++;
    if (city.level[k] && !water[k]) dry++;
    if (city.zone[k] === R && !city.level[k]) emptyR++;
  }
  let avgCrime = 0, n = 0;
  for (let k = 0; k < NN; k++) if (city.level[k]) { avgCrime += crime[k]; n++; }
  avgCrime /= Math.max(1, n);
  if (!hasRoad) return advise('Start with a road, then zone homes beside it.');
  if (!hasZone) return advise('Zone some homes next to your road.');
  if (!plants) return advise('Your zones need power: build a coal plant.');
  if (unpowered > 3 && stats.powerUse === 0) return advise('Your power plant is not connected: link it to your roads.');
  if (unpowered > 3 && stats.powerUse >= stats.powerCap - 10) return advise('Brownout! Build another power plant.');
  if (unpowered > 3) return advise('Some zones have no power: connect them with roads.');
  if (city.funds < 0) return advise('We are in debt! Raise taxes or cut services.');
  if (stats.pop > 80 && !stats.waterCap) return advise('Buildings need water to grow: place a pump by the river.');
  if (dry > 3 && stats.waterUse >= stats.waterCap - 10) return advise('Water shortage: build another pump.');
  if (stats.dem.r > 0.5 && emptyR < 3) return advise('People want to move in: zone more homes.');
  if (stats.dem.i > 0.5) return advise('Industry wants to grow: zone more industry.');
  if (stats.dem.c > 0.5) return advise('Shops want to open: zone more commercial.');
  if (avgCrime > 0.3 && !city.structs.some((s) => s.type === 'police')) return advise('Crime is rising: build a police station.');
  if (stats.pop > 300 && !city.structs.some((s) => s.type === 'fire')) return advise('No fire department yet: one fire could spread fast.');
  if (stats.pop >= 600 && !city.structs.some((s) => s.type === 'school')) return advise('Build a school: towers need educated citizens.');
  if (stats.pop >= 1200 && !city.structs.some((s) => s.type === 'park')) return advise('Parks raise land value so buildings can grow taller.');
}
function monthTick() {
  recompute();
  grow();
  fires();
  finances();
  city.month++;
  const before = city.rank;
  while (city.rank < MILESTONES.length - 1 && stats.pop >= MILESTONES[city.rank + 1][0]) city.rank++;
  if (city.rank > before) {
    const name = MILESTONES[city.rank][1];
    const unlocked = TOOLS.filter((t) => t.pop && t.pop <= stats.pop && t.pop > MILESTONES[before][0]).map((t) => t.name);
    showMilestone(name, unlocked);
  }
  adviceTick();
  layersDirty = true; buildingsDirty = true;
  if (city.month % 6 === 0) save();
}

// ------------------------------------------------------------------ building actions
function rectCells(a, b) {
  const out = [];
  for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) out.push([x, y]);
  return out;
}
function lineCells(a, b) {
  // An L-shaped road: along the longer axis first, then the shorter one.
  const out = [];
  const dx = b[0] - a[0], dy = b[1] - a[1], sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
  if (Math.abs(dx) >= Math.abs(dy)) {
    for (let i = 0; i <= Math.abs(dx); i++) out.push([a[0] + i * sx, a[1]]);
    for (let j = 1; j <= Math.abs(dy); j++) out.push([b[0], a[1] + j * sy]);
  } else {
    for (let j = 0; j <= Math.abs(dy); j++) out.push([a[0], a[1] + j * sy]);
    for (let i = 1; i <= Math.abs(dx); i++) out.push([a[0] + i * sx, b[1]]);
  }
  return out;
}
function structFootprint(type, x, y) {
  const s = STRUCT[type];
  const fx = clamp(x - Math.floor((s.w - 1) / 2), 0, N - s.w), fy = clamp(y - Math.floor((s.h - 1) / 2), 0, N - s.h);
  return { x: fx, y: fy, w: s.w, h: s.h };
}
// Returns { cells: [[x,y,ok]], cost } for the current tool between two tiles.
function plan(toolId, a, b) {
  const t = TOOL[toolId];
  const cells = [];
  let cost = 0;
  if (toolId === 'road') {
    for (const [x, y] of lineCells(a, b)) {
      const k = idx(x, y);
      const ok = occ[k] < 0 && !city.level[k];
      if (ok && !city.road[k]) cost += t.cost * (city.terrain[k] ? 3 : 1);
      cells.push([x, y, ok]);
    }
  } else if (t.zone) {
    for (const [x, y] of rectCells(a, b)) {
      const k = idx(x, y);
      const ok = !city.terrain[k] && !city.road[k] && occ[k] < 0 && (!city.level[k] || city.zone[k] === t.zone);
      if (ok && city.zone[k] !== t.zone) cost += t.cost;
      cells.push([x, y, ok]);
    }
  } else if (toolId === 'bulldoze') {
    for (const [x, y] of rectCells(a, b)) {
      const k = idx(x, y);
      const any = city.road[k] || city.zone[k] || city.tree[k] || occ[k] >= 0;
      if (any) cost += city.level[k] || occ[k] >= 0 ? t.cost * 2 : city.road[k] || city.zone[k] ? t.cost : 1;
      cells.push([x, y, !!any]);
    }
  } else if (t.struct) {
    const f = structFootprint(t.struct, b[0], b[1]);
    let ok = true;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
      const k = idx(x, y);
      if (city.terrain[k] || city.road[k] || occ[k] >= 0 || city.level[k]) ok = false;
    }
    if (t.struct === 'pump' && ok && !nearWater(f)) ok = false;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) cells.push([x, y, ok]);
    cost = t.cost;
    return { cells, cost, footprint: f, ok };
  }
  return { cells, cost };
}
function lockedTool(t) { return t.pop && stats.pop < t.pop && !(city.unlocked || []).includes(t.id); }
function commit(toolId, a, b) {
  const t = TOOL[toolId];
  if (lockedTool(t)) { toast(`${t.name} unlocks at ${fmt(t.pop)} people`); sfx.deny(); return; }
  const p = plan(toolId, a, b);
  if (p.cost > city.funds) { toast('Not enough money'); sfx.deny(); return; }
  if (t.struct && !p.ok) { toast(t.struct === 'pump' ? 'Pumps go right next to water' : 'Needs clear dry land'); sfx.deny(); return; }
  let did = false;
  for (const [x, y, ok] of p.cells) {
    if (!ok) continue;
    const k = idx(x, y);
    if (toolId === 'road') { if (!city.road[k]) { city.road[k] = 1; city.zone[k] = 0; city.tree[k] = 0; did = true; } }
    else if (t.zone) { if (city.zone[k] !== t.zone) { city.zone[k] = t.zone; city.level[k] = 0; city.tree[k] = 0; did = true; } }
    else if (toolId === 'bulldoze') {
      if (occ[k] >= 0) { city.structs.splice(occ[k], 1); rebuildOcc(); structsDirty = true; }
      city.road[k] = 0; city.zone[k] = 0; city.level[k] = 0; city.tree[k] = 0; burn[k] = 0; did = true;
      emit(wx(x), 0.2, wz(y), 0xb8a888, 6, 0.8, 1.2, 0.7);
    }
  }
  if (t.struct) {
    const f = p.footprint;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) { const k = idx(x, y); city.zone[k] = 0; city.tree[k] = 0; }
    city.structs.push({ type: t.struct, ...f });
    if ((t.struct === 'coal' || t.struct === 'solar' || t.struct === 'pump') && !linked(f)) setTimeout(() => toast('Connect it with a road so it can reach the city'), 300);
    structsDirty = true; did = true;
    emit(wx(f.x) + (f.w - 1) / 2, 0.5, wz(f.y) + (f.h - 1) / 2, 0xfff3c4, 20, 1.6, 2, 1);
  }
  if (!did) return;
  city.funds -= p.cost;
  recompute();
  layersDirty = buildingsDirty = true;
  if (toolId === 'bulldoze') sfx.bulldoze(); else if (toolId === 'road') sfx.road(); else if (t.zone) sfx.zone(); else sfx.build();
  showCost(p.cost);
  updateHud();
}

// ------------------------------------------------------------------ input
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function tileAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane0, p)) return null;
  const x = Math.floor(p.x + N / 2), y = Math.floor(p.z + N / 2);
  return inside(x, y) ? [x, y] : null;
}
const ptrs = new Map();
let gesture = null, press = null, tool = 'inspect', mode = 'menu', speed = 1;
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => {
  try { cvs.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) {
    const t = tileAt(e.clientX, e.clientY);
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, start: t, end: t, paint: tool !== 'inspect' && mode === 'play' && !!t };
    if (press.paint) showPreview();
  } else { if (press) { press = null; clearPreview(); } }
  gesture = null;
});
cvs.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const prev = { x: p.x, y: p.y };
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1 && press) {
    if (!press.moved && Math.hypot(p.x - press.x, p.y - press.y) < 8) return;
    press.moved = true;
    if (press.paint) {
      const t = tileAt(p.x, p.y);
      if (t && (t[0] !== press.end[0] || t[1] !== press.end[1])) { press.end = t; showPreview(); }
    } else panBy(p.x - prev.x, p.y - prev.y);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (gesture) {
      rig.viewGoal = clamp(rig.viewGoal * (gesture.dist / dist), 6, 40);
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
  const pr = press;
  press = null;
  clearPreview();
  if (mode !== 'play') return;
  if (pr.paint) commit(tool, pr.start, pr.end);
  else if (!pr.moved && performance.now() - pr.t < 450) { const t = tileAt(pr.x, pr.y); if (t) inspect(t); }
}
cvs.addEventListener('pointerup', endPtr);
cvs.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); press = null; gesture = null; clearPreview(); });
cvs.addEventListener('wheel', (e) => { e.preventDefault(); rig.viewGoal = clamp(rig.viewGoal * (e.deltaY > 0 ? 1.12 : 0.89), 6, 40); }, { passive: false });
function panBy(dx, dy) {
  const ppw = rig.viewH / window.innerHeight;
  const rx = Math.cos(rig.yaw), rz = -Math.sin(rig.yaw), fx = -Math.sin(rig.yaw), fz = -Math.cos(rig.yaw);
  rig.target.x += -rx * dx * ppw + (fx * dy * ppw) / Math.sin(EL);
  rig.target.z += -rz * dx * ppw + (fz * dy * ppw) / Math.sin(EL);
}
function snapYaw() { rig.yawGoal = Math.round((rig.yawGoal - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4; }
function rotate(dir) { rig.yawGoal += (dir * Math.PI) / 2; snapYaw(); sfx.click(); }
function showPreview() {
  if (!press?.paint) return;
  const p = plan(tool, press.start, press.end);
  let n = 0;
  for (const [x, y, ok] of p.cells) {
    dummy.position.set(wx(x), 0.1, wz(y)); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.96, 1, 0.96); dummy.updateMatrix();
    previewMesh.setMatrixAt(n, dummy.matrix);
    previewMesh.setColorAt(n, tc.set(!ok ? 0xe0403a : tool === 'bulldoze' ? 0xff8a3a : TOOL[tool].zone ? ZONE_COL[TOOL[tool].zone] : 0xffffff));
    n++;
  }
  previewMesh.count = n;
  previewMesh.instanceMatrix.needsUpdate = true;
  if (previewMesh.instanceColor) previewMesh.instanceColor.needsUpdate = true;
  const tip = $('costtip');
  tip.hidden = false;
  tip.textContent = p.cost ? money(p.cost) : tool === 'bulldoze' ? 'Nothing to clear' : '';
  tip.classList.toggle('bad', p.cost > city.funds || (TOOL[tool].struct && !p.ok));
  if (!p.cost && tool !== 'bulldoze') tip.hidden = true;
}
function clearPreview() { previewMesh.count = 0; $('costtip').hidden = true; }

// ------------------------------------------------------------------ inspect card
let inspected = -1;
function inspect([x, y]) {
  const k = idx(x, y);
  inspected = k;
  const yes = (b) => (b ? '<b class="ok">✓</b>' : '<b class="no">✗</b>');
  const bar = (label, v, good = true) => `<div class="meter"><span>${label}</span><i><em style="width:${Math.round(v * 100)}%;background:${good ? (v > 0.5 ? '#3fbf5a' : v > 0.25 ? '#f5c542' : '#e0403a') : (v > 0.5 ? '#e0403a' : v > 0.25 ? '#f5c542' : '#3fbf5a')}"></em></i></div>`;
  let title = 'Open land', sub = '', body = '';
  if (city.terrain[k] && !city.road[k]) { title = 'River'; sub = 'Pumps placed beside water supply the city.'; }
  else if (occ[k] >= 0) {
    const s = city.structs[occ[k]], d = STRUCT[s.type];
    title = d.name;
    sub = d.power ? `Supplies ${fmt(d.power)} power units · city uses ${fmt(stats.powerUse)}/${fmt(stats.powerCap)}`
      : d.water ? `Pumps ${fmt(d.water)} units · city uses ${fmt(stats.waterUse)}/${fmt(stats.waterCap)}`
      : `Covers a radius of ${d.radius} tiles`;
    body = `<div class="row"><span>Upkeep</span><b>${money(d.upkeep)}/mo</b></div><div class="row"><span>Powered</span>${s.type === 'park' || d.power ? '<b class="ok">–</b>' : yes(power[k])}</div>`;
    if (s.type === 'pump' && !nearWater(s)) body += '<p class="warn">Not next to water!</p>';
    if ((d.power || d.water) && !linked(s)) body += '<p class="warn">Not connected: it must touch a road or zone.</p>';
  } else if (city.road[k]) { title = city.terrain[k] ? 'Bridge' : 'Road'; sub = 'Roads carry power, water and traffic.'; }
  else if (city.zone[k]) {
    const z = city.zone[k], L = city.level[k];
    title = LEVEL_NAME[z][L];
    sub = `${ZONE_NAME[z]} · level ${L}/3`;
    const cap = CAP[z][L];
    body = `<div class="row"><span>${z === R ? 'Residents' : 'Jobs'}</span><b>${fmt(cap)}</b></div>
      <div class="row"><span>Road</span>${yes(access[k])}<span>Power</span>${yes(power[k])}<span>Water</span>${yes(water[k])}</div>
      ${bar('Land value', lv[k])}${bar('Pollution', pol[k], false)}${bar('Crime', crime[k], false)}`;
    const why = [];
    if (!access[k]) why.push('needs a road within 3 tiles');
    if (!power[k]) why.push('needs power');
    if (L >= 1 && !water[k]) why.push('needs water to grow');
    if (L >= 1 && lv[k] < 0.3) why.push('land value too low to grow');
    if (L === 2 && z === R && !cov.school[k]) why.push('needs a school nearby for a tower');
    if (L === 2 && stats.pop < 1200) why.push(`towers come at ${fmt(1200)} people`);
    if (burn[k] > 0) why.unshift('ON FIRE!');
    if (why.length) body += `<p class="warn">${why.join(' · ')}</p>`;
  } else if (city.tree[k]) { title = 'Woods'; sub = 'Trees soak up a little pollution.'; }
  $('info-title').textContent = title;
  $('info-sub').textContent = sub;
  $('info-body').innerHTML = body;
  $('info').hidden = false;
  sfx.click();
}
$('info-close').addEventListener('click', () => { $('info').hidden = true; inspected = -1; });

// ------------------------------------------------------------------ cars
const cars = [];
const carColors = [0xe0403a, 0x3b82f6, 0xf5c542, 0xffffff, 0x2d2f36, 0x3fbf5a, 0xff8a3a, 0x9aa4b2];
function spawnCar() {
  const roads = [];
  for (let k = 0; k < NN; k++) if (city.road[k]) roads.push(k);
  if (roads.length < 2) return;
  const k = roads[(rnd() * roads.length) | 0], x = k % N, y = (k / N) | 0;
  const dirs = roadDirs(x, y);
  if (!dirs.length) return;
  const [dx, dy] = dirs[(rnd() * dirs.length) | 0];
  cars.push({ x, y, dx, dy, t: rnd(), sp: 0.9 + rnd() * 0.5, col: carColors[(rnd() * carColors.length) | 0] });
}
function updateCars(dt) {
  const want = Math.min(180, Math.floor(stats.pop / 22 + (stats.jobsC + stats.jobsI) / 40));
  if (cars.length < want && rnd() < 0.3) spawnCar();
  if (cars.length > want) cars.pop();
  let n = 0;
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (!city.road[idx(c.x, c.y)]) { cars.splice(i, 1); continue; }
    c.t += c.sp * dt * (speed ? Math.min(speed, 2) : 0);
    if (c.t >= 1) {
      const nx = c.x + c.dx, ny = c.y + c.dy;
      if (!inside(nx, ny) || !city.road[idx(nx, ny)]) { c.dx = -c.dx; c.dy = -c.dy; c.t = 0; continue; }
      c.x = nx; c.y = ny; c.t -= 1;
      const dirs = roadDirs(nx, ny).filter(([a, b]) => !(a === -c.dx && b === -c.dy));
      if (dirs.length) [c.dx, c.dy] = dirs[(rnd() * dirs.length) | 0];
      else { c.dx = -c.dx; c.dy = -c.dy; }
    }
    // travel from this tile's centre towards the next, keeping to the right
    const px = wx(c.x) + c.dx * (c.t - 0.5) * 1, pz = wz(c.y) + c.dy * (c.t - 0.5) * 1;
    const ox = -c.dy * 0.14, oz = c.dx * 0.14;
    dummy.position.set(px + ox, 0.03, pz + oz);
    dummy.rotation.set(0, Math.atan2(c.dx, c.dy), 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    carMesh.setMatrixAt(n, dummy.matrix);
    carMesh.setColorAt(n, tc.set(c.col));
    n++;
  }
  carMesh.count = n;
  carMesh.instanceMatrix.needsUpdate = true;
  if (carMesh.instanceColor) carMesh.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------ icons
const ICON = {
  inspect: '<path d="M11 16V6.5a2 2 0 0 1 4 0V15m0-3.5a2 2 0 0 1 4 0V15m0-2a2 2 0 0 1 4 0v4c0 6-3.5 10-9 10-3.5 0-5.5-1.5-7.5-4.5L4.4 19a2 2 0 0 1 3.2-2.4L11 20" fill="#fff4e0" stroke="#3a2a1a" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
  road: '<path d="M10 3h12l6 26H4Z" fill="#454a57"/><path d="M16 5v4m0 4v4m0 4v4" stroke="#f6f2e2" stroke-width="2" stroke-linecap="round"/><path d="M10 3 4 29m18-26 6 26" stroke="#c9ccd1" stroke-width="1.6"/>',
  res: '<path d="M4 15 16 5l12 10v13H4Z" fill="#52c45a"/><path d="M2 16 16 4l14 12" fill="none" stroke="#2a7a30" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><path d="M13 28v-7h6v7" fill="#fff"/>',
  com: '<path d="M4 12h24v16H4Z" fill="#3f95ee"/><path d="M3 6h26l-2 7H5Z" fill="#e55a4f"/><path d="M7 16h8v6H7Z" fill="#cfe8ff"/><path d="M18 16h6v12h-6Z" fill="#fff"/>',
  ind: '<path d="M3 28V15l7 4v-4l7 4v-4l7 4V6h5v22Z" fill="#f0b93a"/><path d="M24 6h5" stroke="#b07a10" stroke-width="2"/><circle cx="25" cy="3" r="2" fill="#c7c0ae"/>',
  coal: '<path d="M3 28V16h10v12Z" fill="#b7b0a4"/><path d="M16 28 18 8h6l2 20Z" fill="#e6e1d8"/><path d="M17.4 14h7.2M17 20h8" stroke="#d04a3a" stroke-width="2.4"/><circle cx="21" cy="5" r="3" fill="#9aa0a8"/><circle cx="25" cy="3" r="2" fill="#c0c5cc"/>',
  pump: '<path d="M16 3c5 7 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8 8-15Z" fill="#4fb4ff"/><path d="M12 19a4 4 0 0 0 4 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  park: '<circle cx="16" cy="12" r="9" fill="#3fbf5a"/><circle cx="11" cy="9" r="3" fill="#6fe07a"/><path d="M16 18v11" stroke="#7a5232" stroke-width="3" stroke-linecap="round"/><path d="M8 29h16" stroke="#2a7a30" stroke-width="2.4" stroke-linecap="round"/>',
  police: '<path d="M16 3 27 7v8c0 7-5 12-11 14C10 27 5 22 5 15V7Z" fill="#2f5fc0"/><path d="m16 9 2 4 4.5.6-3.3 3 .9 4.4-4.1-2.3-4.1 2.3.9-4.4-3.3-3 4.5-.6Z" fill="#ffd23f"/>',
  fire: '<path d="M16 2c1 6 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 4-10 1 3 2 4 3 4 0-4 0-7 2-11Z" fill="#ff6a2a"/><path d="M16 15c3 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2-5 4-8Z" fill="#ffd23f"/>',
  school: '<path d="M16 5 30 12l-14 7-14-7Z" fill="#3a3f50"/><path d="M8 15v7c0 2 4 4 8 4s8-2 8-4v-7l-8 4Z" fill="#545a70"/><path d="M28 12v9" stroke="#f5c542" stroke-width="2"/><circle cx="28" cy="22" r="1.8" fill="#f5c542"/>',
  solar: '<path d="M4 10h24l-3 12H7Z" fill="#21407a"/><path d="M10.5 10 9 22m7-12v12m5.5-12L23 22M5.5 16h21" stroke="#7fb2ff" stroke-width="1.2"/><path d="M16 22v6m-5 0h10" stroke="#9aa0a8" stroke-width="2.4" stroke-linecap="round"/><circle cx="26" cy="5" r="3" fill="#ffd23f"/>',
  stadium: '<ellipse cx="16" cy="18" rx="14" ry="9" fill="#e6e9ee"/><ellipse cx="16" cy="18" rx="10" ry="6" fill="#4fb04a"/><path d="M16 12v12" stroke="#fff" stroke-width="1.2"/><circle cx="16" cy="18" r="2" fill="none" stroke="#fff" stroke-width="1.2"/>',
  bulldoze: '<path d="M3 20h17v-7h5l4 7v4H3Z" fill="#f5b50f"/><path d="M3 24h26" stroke="#3a2a1a" stroke-width="2"/><circle cx="8" cy="26" r="2.6" fill="#3a3f50"/><circle cx="22" cy="26" r="2.6" fill="#3a3f50"/><path d="M2 9l6 0 2 8" fill="none" stroke="#9aa0a8" stroke-width="2.4" stroke-linejoin="round"/>',
  coin: '<circle cx="16" cy="16" r="13" fill="#f5c542"/><circle cx="16" cy="16" r="9.5" fill="none" stroke="#b07a10" stroke-width="1.6"/><path d="M19.5 11.5c-1-1-2.2-1.5-3.5-1.5-2 0-3.5 1-3.5 2.8 0 4 7.2 2.2 7.2 6.2 0 1.8-1.6 3-3.7 3-1.5 0-2.8-.5-3.8-1.6M16 8v16" fill="none" stroke="#7a4f00" stroke-width="2" stroke-linecap="round"/>',
  people: '<circle cx="11" cy="10" r="4.5" fill="#f0c39a"/><path d="M3 27c0-6 3.5-10 8-10s8 4 8 10Z" fill="#3b82f6"/><circle cx="22" cy="12" r="4" fill="#e8b48a"/><path d="M16 28c.5-5 3-8.5 6-8.5 4 0 7 3.5 7 8.5Z" fill="#52c45a"/>',
  pause: '<rect x="8" y="6" width="5.5" height="20" rx="1.5" fill="currentColor"/><rect x="18.5" y="6" width="5.5" height="20" rx="1.5" fill="currentColor"/>',
  play: '<path d="M10 6v20l16-10Z" fill="currentColor"/>',
  fast: '<path d="M4 7v18l12-9Zm12 0v18l12-9Z" fill="currentColor"/>',
  layers: '<path d="m16 4 13 7-13 7-13-7Z" fill="currentColor"/><path d="m3 16 13 7 13-7M3 21l13 7 13-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
  budget: '<rect x="3" y="8" width="26" height="18" rx="3" fill="currentColor"/><path d="M3 13h26" stroke="#1c2b4d" stroke-width="2.4"/><circle cx="22.5" cy="19.5" r="2.5" fill="#1c2b4d"/>',
  menu: '<path d="M6 9h20M6 16h20M6 23h20" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
  rotl: '<path d="M8 14a9 9 0 1 1 2.6 8.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="m3 9 5 7 6-5Z" fill="currentColor"/>',
  rotr: '<path d="M24 14a9 9 0 1 0-2.6 8.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="m29 9-5 7-6-5Z" fill="currentColor"/>',
  lock: '<rect x="8" y="14" width="16" height="13" rx="2.5" fill="currentColor"/><path d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="3"/>',
  sound: '<path d="M5 12h5l7-6v20l-7-6H5Z" fill="currentColor"/><path d="M21 11a6 6 0 0 1 0 10m3-14a11 11 0 0 1 0 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  muted: '<path d="M5 12h5l7-6v20l-7-6H5Z" fill="currentColor"/><path d="m21 12 7 8m0-8-7 8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  close: '<path d="m8 8 16 16M24 8 8 24" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>',
};
const svg = (name) => `<svg viewBox="0 0 32 32" aria-hidden="true">${ICON[name]}</svg>`;
function paintIcons(root = document) { for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = svg(el.dataset.icon); }
paintIcons();

// ------------------------------------------------------------------ UI
function buildToolbar() {
  $('tools').innerHTML = TOOLS.map((t) => {
    const locked = lockedTool(t);
    return `<button class="tool${locked ? ' locked' : ''}" data-tool="${t.id}" aria-label="${t.name}">
      <i class="ic" data-icon="${locked ? 'lock' : t.id}"></i><span>${t.name}</span><em>${locked ? `${fmt(t.pop)} 👤` : t.cost ? money(t.cost) : 'Free'}</em></button>`;
  }).join('');
  paintIcons($('tools'));
  for (const b of document.querySelectorAll('.tool')) b.addEventListener('click', () => setTool(b.dataset.tool));
  setTool(tool, true);
}
function setTool(id, quiet = false) {
  const t = TOOL[id];
  if (lockedTool(t)) { toast(`${t.name} unlocks at ${fmt(t.pop)} people`); sfx.deny(); return; }
  tool = id;
  for (const b of document.querySelectorAll('.tool')) b.classList.toggle('active', b.dataset.tool === id);
  $('hint').textContent = t.hint;
  if (!quiet) sfx.click();
  if (id !== 'inspect') $('info').hidden = true;
}
let toastTimer = 0, toastTile = -1;
function toast(msg, k = -1) {
  const t = $('toast');
  t.textContent = msg; toastTile = k;
  t.classList.toggle('go', k >= 0);
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
$('toast').addEventListener('click', () => { if (toastTile >= 0) { rig.target.set(wx(toastTile % N), 0, wz((toastTile / N) | 0)); rig.viewGoal = Math.min(rig.viewGoal, 14); } });
function showCost(c) {
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = `-${money(c)}`;
  $('app').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
function dateStr(m = city.month) { return `${MONTHS[m % 12]} ${2000 + Math.floor(m / 12)}`; }
function updateHud() {
  $('funds').textContent = money(city.funds);
  $('funds').classList.toggle('neg', city.funds < 0);
  const net = stats.income - stats.expense;
  $('delta').textContent = `${net >= 0 ? '+' : ''}${money(net)}/mo`;
  $('delta').classList.toggle('neg', net < 0);
  $('pop').textContent = fmt(stats.pop);
  $('date').textContent = dateStr();
  for (const [id, v] of [['dr', stats.dem.r], ['dc', stats.dem.c], ['di', stats.dem.i]]) {
    const el = $(id);
    el.style.height = `${Math.abs(v) * 50}%`;
    el.style.bottom = v >= 0 ? '50%' : `${50 - Math.abs(v) * 50}%`;
    el.classList.toggle('neg', v < 0);
  }
  $('rank').textContent = MILESTONES[city.rank][1];
  const next = MILESTONES[city.rank + 1];
  $('next').textContent = next ? `${fmt(next[0] - stats.pop)} to ${next[1]}` : 'Top of the world';
  for (const b of document.querySelectorAll('.tool')) {
    const t = TOOL[b.dataset.tool];
    b.classList.toggle('poor', t.cost > city.funds);
    if (b.classList.contains('locked') && !lockedTool(t)) { buildToolbar(); break; }
  }
  $('cityname').textContent = city.name;
}
function setSpeed(s) {
  speed = s;
  for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('active', +b.dataset.speed === s);
}
for (const b of document.querySelectorAll('[data-speed]')) b.addEventListener('click', () => { setSpeed(+b.dataset.speed); sfx.click(); });
$('rot-l').addEventListener('click', () => rotate(-1));
$('rot-r').addEventListener('click', () => rotate(1));

// layers sheet
$('b-layers').addEventListener('click', () => {
  $('layers-list').innerHTML = Object.entries(OVERLAYS).map(([k, o]) => `<button class="opt${overlay === k ? ' active' : ''}" data-ov="${k}">${o.name}</button>`).join('');
  for (const b of document.querySelectorAll('[data-ov]')) b.addEventListener('click', () => { setOverlay(b.dataset.ov); $('layers').hidden = true; });
  $('layers').hidden = false;
  sfx.click();
});
function setOverlay(k) {
  overlay = k;
  $('legend').hidden = k === 'none';
  $('legend').innerHTML = k === 'none' ? '' : `<b>${OVERLAYS[k].name}</b> ${OVERLAYS[k].legend} <button id="legend-x" aria-label="Hide overlay">${svg('close')}</button>`;
  if (k !== 'none') $('legend-x').addEventListener('click', () => setOverlay('none'));
  layoutOverlay();
}
// budget sheet
function renderBudget() {
  let roads = 0;
  for (let k = 0; k < NN; k++) if (city.road[k]) roads += city.terrain[k] ? 1.5 : 0.5;
  const groups = {};
  for (const s of city.structs) groups[s.type] = (groups[s.type] || 0) + STRUCT[s.type].upkeep;
  const rows = [['Taxes', stats.income, true], ['Roads', -Math.round(roads)], ...Object.entries(groups).map(([k, v]) => [`${STRUCT[k].name}s`, -v])];
  $('budget-rows').innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b class="${v >= 0 ? 'ok' : 'no'}">${v >= 0 ? '+' : ''}${money(v)}</b></div>`).join('')
    + `<div class="row total"><span>Per month</span><b class="${stats.income - stats.expense >= 0 ? 'ok' : 'no'}">${money(stats.income - stats.expense)}</b></div>`;
  $('tax').value = city.tax;
  $('tax-val').textContent = `${city.tax}%`;
  $('tax-note').textContent = city.tax > 12 ? 'High taxes scare people and businesses away.' : city.tax < 6 ? 'Low taxes attract people but earn little.' : 'A fair rate. Demand is healthy.';
}
$('b-budget').addEventListener('click', () => { renderBudget(); $('budget').hidden = false; sfx.click(); });
$('tax').addEventListener('input', (e) => { city.tax = +e.target.value; computeTotals(); renderBudget(); updateHud(); });
for (const id of ['budget', 'layers']) $(`${id}-close`).addEventListener('click', () => { $(id).hidden = true; });
// menu
$('b-menu').addEventListener('click', () => { save(); showMenu(); });
function showMilestone(name, unlocked) {
  $('ms-title').textContent = name;
  $('ms-text').textContent = `${city.name} is now a ${name.toLowerCase()} of ${fmt(stats.pop)} people!`;
  $('ms-unlock').innerHTML = unlocked.length ? `Unlocked: <b>${unlocked.join(', ')}</b>` : '';
  $('milestone').hidden = false;
  sfx.fanfare();
  buildToolbar();
}
$('ms-ok').addEventListener('click', () => { $('milestone').hidden = true; });

// ------------------------------------------------------------------ save / load / new city
function save() {
  if (!city.road.some((v) => v) && !city.structs.length) return;
  store.set('polis.save', {
    v: 1, seed: city.seed, name: city.name, funds: city.funds, tax: city.tax, month: city.month, rank: city.rank,
    terrain: Array.from(city.terrain), road: Array.from(city.road), zone: Array.from(city.zone), level: Array.from(city.level),
    variant: Array.from(city.variant), tree: Array.from(city.tree), structs: city.structs,
  });
}
function load() {
  const s = store.get('polis.save', null);
  if (!s || s.v !== 1) return false;
  Object.assign(city, { seed: s.seed, name: s.name, funds: s.funds, tax: s.tax, month: s.month, rank: s.rank, structs: s.structs });
  for (const k of ['terrain', 'road', 'zone', 'level', 'variant', 'tree']) city[k].set(s[k]);
  return true;
}
function resetWorld() {
  burn.fill(0); unhappy.fill(0); anim.fill(1); cars.length = 0;
  computeDistLand();
  buildGround();
  recompute();
  layersDirty = buildingsDirty = structsDirty = true;
  rig.target.set(0, 0, 0); rig.viewGoal = 18;
  buildToolbar();
  setOverlay('none');
  updateHud();
}
function newCity() {
  const seed = (Date.now() % 100000) + 1;
  Object.assign(city, { seed, name: CITY_NAMES[seed % CITY_NAMES.length], funds: 20000, tax: 9, month: 0, rank: 0, structs: [] });
  city.road.fill(0); city.zone.fill(0); city.level.fill(0);
  generateMap(seed);
  resetWorld();
}
function showMenu() {
  mode = 'menu';
  document.body.classList.add('in-menu');
  const s = store.get('polis.save', null);
  $('continue').hidden = !s;
  if (s) $('continue').innerHTML = `Continue <small>${s.name} · ${dateStr(s.month)}</small>`;
  $('newcity').classList.toggle('green', !s);
  $('newcity').classList.toggle('stone', !!s);
  $('menu').hidden = false;
}
function play() {
  sfx.init();
  $('menu').hidden = true;
  document.body.classList.remove('in-menu');
  mode = 'play';
  setSpeed(1);
  setTool('inspect', true);
  if (city.month === 0 && !city.road.some((v) => v)) setTimeout(() => toast('Welcome, Mayor! Pick Road and drag to build your first street.'), 500);
}
$('continue').addEventListener('click', () => { if (load()) resetWorld(); play(); });
$('newcity').addEventListener('click', () => {
  if (store.get('polis.save', null) && !confirm('Start a new city? Your current city will be replaced.')) return;
  store.del('polis.save');
  newCity(); play();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') save(); });

// ------------------------------------------------------------------ sound
const sfx = (() => {
  let ac = null, master = null, noiseBuf = null;
  const init = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = store.get('polis.muted', false) ? 0 : 0.5; master.connect(ac.destination);
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
    click: () => tone(880, 880, 0.04, 'sine', 0.05),
    deny: () => tone(200, 150, 0.14, 'triangle', 0.08),
    road: () => { noise(0.12, 600, 0.2); tone(140, 110, 0.1, 'triangle', 0.08); },
    zone: () => [523, 659].forEach((f, i) => tone(f, f, 0.12, 'sine', 0.06, i * 0.06)),
    build: () => { noise(0.2, 400, 0.3); [392, 523, 659].forEach((f, i) => tone(f, f, 0.15, 'triangle', 0.07, 0.05 + i * 0.07)); },
    bulldoze: () => { noise(0.35, 300, 0.4); tone(90, 60, 0.3, 'sawtooth', 0.05); },
    alarm: () => [0, 0.3, 0.6].forEach((d) => tone(880, 660, 0.25, 'square', 0.04, d)),
    fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.35, 'triangle', 0.1, i * 0.12)),
    mute(on) { if (master) master.gain.value = on ? 0 : 0.5; },
  };
})();
function syncMute() { $('b-mute').innerHTML = `<i class="ic">${svg(store.get('polis.muted', false) ? 'muted' : 'sound')}</i>`; }
$('b-mute').addEventListener('click', () => { const m = !store.get('polis.muted', false); store.set('polis.muted', m); sfx.mute(m); syncMute(); });
syncMute();

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let monthT = 0, hudT = 0, t = 0;
const MONTH_SECONDS = 3;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  timeU.value = t;
  if (mode === 'play' && speed > 0) {
    monthT += dt * speed;
    if (monthT >= MONTH_SECONDS) { monthT = 0; monthTick(); updateHud(); if (!$('info').hidden && inspected >= 0) inspect([inspected % N, (inspected / N) | 0]); }
  } else if (mode === 'menu') rig.yawGoal += dt * 0.08;
  updateCamera(dt);
  if (structsDirty) { structsDirty = false; layoutStructs(); buildingsDirty = true; }
  if (layersDirty) { layersDirty = false; layoutLayers(); layoutMarkers(); layoutOverlay(); }
  if (buildingsDirty || animating) {
    buildingsDirty = false;
    for (let k = 0; k < NN; k++) if (anim[k] < 1) anim[k] = Math.min(1, anim[k] + dt * 1.6);
    layoutBuildings();
  }
  markerMesh.position.y = Math.sin(t * 3) * 0.06;
  // smoke and fire
  for (const c of [...chimneyList, ...structChimneys]) if (rnd() < dt * (c.big ? 5 : 1.6)) emit(c.v.x, c.v.y, c.v.z, c.big ? 0xb8b8b8 : 0xd8d8d8, 1, 0.15, 0.5, c.big ? 2.6 : 1.8, -0.12);
  for (let k = 0; k < NN; k++) if (burn[k] > 0 && rnd() < dt * 12) emit(wx(k % N) + (rnd() - 0.5) * 0.6, 0.3 + rnd() * 0.5, wz((k / N) | 0) + (rnd() - 0.5) * 0.6, rnd() < 0.6 ? 0xff7a1a : 0x555555, 1, 0.3, 1.4, 0.9, -0.2);
  updateCars(dt);
  updateParticles(dt);
  sun.position.set(rig.target.x - 14, 26, rig.target.z + 10);
  sun.target.position.copy(rig.target);
  hudT -= dt;
  if (hudT <= 0 && mode === 'play') { hudT = 0.5; updateHud(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
if (!load()) newCity(); else resetWorld();
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
$('update').addEventListener('click', () => { save(); location.reload(); });
checkForUpdate();
setInterval(checkForUpdate, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });

// Exposed for automated testing.
window.__polis = {
  city, stats, monthTick, commit, recompute, setTool, setOverlay, newCity, play, save, load, rig, power, water, lv, pol, crime,
  get mode() { return mode; }, plan, inspect,
};
