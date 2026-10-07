import * as THREE from 'three';
import { mulberry32, zoneTemplate, structModel, VARIANTS, treeGeos, carGeo, poleGeo, lampGeos } from './models.js?v=2.0';

// =====================================================================
// POLIS 2: a pocket city builder for phones (portrait), in the spirit of
// SimCity 2000. Roads and avenues, power lines and water pipes, zones that
// grow with land value, commuter traffic, health, education, garbage,
// budgets per department, ordinances, loans, disasters, day and night.
// =====================================================================

const APP_VERSION = '2.0';
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
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
const rnd = Math.random;

// ------------------------------------------------------------------ rules
const N = 40, NN = N * N;
const idx = (x, y) => y * N + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const wx = (x) => x - N / 2 + 0.5;
const wz = (y) => y - N / 2 + 0.5;
const D4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const R = 1, C = 2, I = 3;
const ZONE_NAME = [null, 'Residential', 'Commercial', 'Industrial'];
const ZONE_COL = [null, 0x52c45a, 0x3f95ee, 0xf0b93a];
const LEVEL_NAME = [null, ['Vacant lot', 'Houses', 'Apartments', 'High-rise'], ['Vacant lot', 'Shops', 'Offices', 'Skyscraper'], ['Vacant lot', 'Workshops', 'Factory', 'Heavy industry']];
const CAP = [null, [0, 8, 32, 120], [0, 6, 24, 80], [0, 10, 28, 60]];
const UTIL_USE = [0, 2, 5, 12];
const ROAD_CAP = [0, 140, 380];
const STRUCT = {
  coal: { name: 'Coal plant', w: 2, h: 2, power: 1600, upkeep: 30, pol: [0.8, 7] },
  gas: { name: 'Gas plant', w: 2, h: 2, power: 1400, upkeep: 45, pol: [0.35, 5] },
  wind: { name: 'Wind turbine', w: 1, h: 1, power: 160, upkeep: 4 },
  solar: { name: 'Solar farm', w: 2, h: 2, power: 1000, upkeep: 60 },
  nuclear: { name: 'Nuclear plant', w: 3, h: 3, power: 5000, upkeep: 160, pol: [0.05, 3] },
  pump: { name: 'Water pump', w: 1, h: 1, water: 1600, upkeep: 12, powered: true },
  tower: { name: 'Water tower', w: 1, h: 1, water: 500, upkeep: 6 },
  police: { name: 'Police station', w: 1, h: 1, radius: 9, kind: 'police', dept: 'police', upkeep: 20, powered: true },
  fire: { name: 'Fire station', w: 1, h: 1, radius: 9, kind: 'fire', dept: 'fire', upkeep: 20, powered: true },
  clinic: { name: 'Clinic', w: 1, h: 1, radius: 7, kind: 'health', dept: 'health', upkeep: 15, powered: true },
  hospital: { name: 'Hospital', w: 2, h: 2, radius: 13, kind: 'health', dept: 'health', upkeep: 90, powered: true },
  school: { name: 'School', w: 1, h: 1, radius: 8, kind: 'edu', dept: 'education', upkeep: 20, powered: true },
  university: { name: 'University', w: 2, h: 2, radius: 15, kind: 'edu', dept: 'education', upkeep: 120, powered: true, boost: 1.3 },
  bus: { name: 'Bus stop', w: 1, h: 1, radius: 5, kind: 'transit', dept: 'transport', upkeep: 8 },
  park: { name: 'Park', w: 1, h: 1, radius: 4, kind: 'park', upkeep: 2 },
  plaza: { name: 'Plaza', w: 2, h: 2, radius: 7, kind: 'park', upkeep: 15, boost: 1.3 },
  landfill: { name: 'Landfill', w: 2, h: 2, radius: 16, kind: 'garbage', garbage: 2600, upkeep: 12, pol: [0.35, 4] },
  recycling: { name: 'Recycling center', w: 2, h: 2, radius: 14, kind: 'garbage', garbage: 2200, upkeep: 50, pol: [0.08, 3], powered: true },
  cityhall: { name: 'City hall', w: 2, h: 2, radius: 10, kind: 'civic', upkeep: 40, powered: true },
  stadium: { name: 'Stadium', w: 2, h: 2, radius: 12, kind: 'civic', upkeep: 90, powered: true },
  landmark: { name: 'Landmark tower', w: 1, h: 1, radius: 14, kind: 'civic', upkeep: 60, powered: true },
};
const TOOLS = [
  { id: 'inspect', name: 'Look', cost: 0, hint: 'Drag to move. Tap anything to see how it is doing and what it needs.' },
  { id: 'road', name: 'Road', cost: 10, cat: 'roads', hint: 'Drag to lay a street. Over water it becomes a bridge (×3).' },
  { id: 'avenue', name: 'Avenue', cost: 25, cat: 'roads', pop: 800, hint: 'Four lanes: almost three times the traffic of a street. Drag over a street to upgrade.' },
  { id: 'bulldoze', name: 'Bulldoze', cost: 5, cat: 'roads', hint: 'Drag to clear. In the underground view it removes pipes.' },
  { id: 'res', name: 'Homes', cost: 5, zone: R, cat: 'zones', hint: 'Zone homes. They need a road, power and jobs they can reach by road.' },
  { id: 'com', name: 'Shops', cost: 5, zone: C, cat: 'zones', hint: 'Zone shops and offices: jobs that need customers nearby.' },
  { id: 'ind', name: 'Industry', cost: 5, zone: I, cat: 'zones', hint: 'Zone industry: many jobs, lots of pollution. Educated cities get clean high-tech.' },
  { id: 'dezone', name: 'Dezone', cost: 2, cat: 'zones', hint: 'Drag to remove zoning and whatever grew on it.' },
  { id: 'line', name: 'Power line', cost: 4, cat: 'power', hint: 'Drag power lines from plants to your zones. Zones pass power on to each other, even across a street.' },
  { id: 'coal', name: 'Coal', cost: 3000, struct: 'coal', cat: 'power', hint: 'Cheap, strong and filthy.' },
  { id: 'wind', name: 'Wind', cost: 400, struct: 'wind', cat: 'power', hint: 'A little clean power. Great for a start.' },
  { id: 'gas', name: 'Gas', cost: 4500, struct: 'gas', cat: 'power', pop: 1000, hint: 'Cleaner than coal, pricier to run.' },
  { id: 'solar', name: 'Solar', cost: 6000, struct: 'solar', cat: 'power', pop: 2000, hint: 'Clean power, no pollution.' },
  { id: 'nuclear', name: 'Nuclear', cost: 16000, struct: 'nuclear', cat: 'power', pop: 10000, hint: 'Huge clean power. Keep the fire department funded…' },
  { id: 'pipe', name: 'Pipe', cost: 3, cat: 'water', hint: 'Underground view. Drag pipes: each pipe waters 2 tiles around it.' },
  { id: 'pump', name: 'Pump', cost: 500, struct: 'pump', cat: 'water', hint: 'Place beside fresh water, then connect pipes to it. Needs power.' },
  { id: 'tower', name: 'Water tower', cost: 350, struct: 'tower', cat: 'water', pop: 400, hint: 'Stores a little water anywhere. Connect pipes to it.' },
  { id: 'police', name: 'Police', cost: 600, struct: 'police', cat: 'services', hint: 'Cuts crime in a wide radius.' },
  { id: 'fire', name: 'Fire dept', cost: 600, struct: 'fire', cat: 'services', hint: 'Prevents fires and puts them out.' },
  { id: 'clinic', name: 'Clinic', cost: 500, struct: 'clinic', cat: 'services', hint: 'Health care nearby. Healthy people live in taller homes.' },
  { id: 'hospital', name: 'Hospital', cost: 4000, struct: 'hospital', cat: 'services', pop: 2500, hint: 'Health care across a whole district.' },
  { id: 'school', name: 'School', cost: 900, struct: 'school', cat: 'services', pop: 200, hint: 'Education: needed for high-rises and high-tech industry.' },
  { id: 'university', name: 'University', cost: 7000, struct: 'university', cat: 'services', pop: 3000, hint: 'Big education boost across the city.' },
  { id: 'bus', name: 'Bus stop', cost: 150, struct: 'bus', cat: 'services', hint: 'Takes cars off the road around it.' },
  { id: 'park', name: 'Park', cost: 150, struct: 'park', cat: 'city', hint: 'Raises land value nearby.' },
  { id: 'plaza', name: 'Plaza', cost: 1500, struct: 'plaza', cat: 'city', pop: 1000, hint: 'A grand park: big land value boost.' },
  { id: 'landfill', name: 'Landfill', cost: 800, struct: 'landfill', cat: 'city', hint: 'Collects garbage in a wide radius. Smelly.' },
  { id: 'recycling', name: 'Recycling', cost: 3000, struct: 'recycling', cat: 'city', pop: 2000, hint: 'Clean garbage handling.' },
  { id: 'cityhall', name: 'City hall', cost: 5000, struct: 'cityhall', cat: 'city', pop: 1500, hint: 'Raises approval and land value around it.' },
  { id: 'stadium', name: 'Stadium', cost: 9000, struct: 'stadium', cat: 'city', pop: 6000, hint: 'Citizens love it. Boosts commerce.' },
  { id: 'landmark', name: 'Landmark', cost: 20000, struct: 'landmark', cat: 'city', pop: 12000, hint: 'The pride of the skyline.' },
];
const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
const CATS = [
  { id: 'roads', name: 'Roads', icon: 'road' }, { id: 'zones', name: 'Zones', icon: 'res' }, { id: 'power', name: 'Power', icon: 'line' },
  { id: 'water', name: 'Water', icon: 'pipe' }, { id: 'services', name: 'Services', icon: 'police' }, { id: 'city', name: 'City', icon: 'park' },
];
const ORDINANCES = [
  { id: 'watch', name: 'Neighbourhood watch', desc: 'Crime −15%', base: 10, per: 6 },
  { id: 'smoke', name: 'Smoke detectors', desc: 'Fire risk −50%', base: 8, per: 4 },
  { id: 'clinics', name: 'Free clinics', desc: 'Health +15%, approval +2', base: 15, per: 8 },
  { id: 'reading', name: 'Reading campaign', desc: 'Education +15%', base: 10, per: 6 },
  { id: 'recycle', name: 'Recycling program', desc: 'Garbage −30%', base: 12, per: 6 },
  { id: 'carpool', name: 'Carpooling', desc: 'Traffic −15%', base: 6, per: 4 },
  { id: 'clean', name: 'Pollution controls', desc: 'Industry pollution −35%, industry demand −10%', base: 15, per: 6 },
  { id: 'tourism', name: 'Tourism promotion', desc: 'Commerce demand +15%', base: 15, per: 6 },
  { id: 'parking', name: 'Parking fines', desc: 'Earns money, approval −3', base: -5, per: -10 },
  { id: 'gambling', name: 'Legal gambling', desc: 'Earns money, crime +10%', base: -10, per: -14 },
];
const DEPTS = [['police', 'Police'], ['fire', 'Fire'], ['health', 'Health'], ['education', 'Education'], ['transport', 'Transport']];
const MILESTONES = [[0, 'Hamlet'], [120, 'Village'], [600, 'Town'], [2000, 'City'], [6000, 'Capital'], [15000, 'Metropolis'], [30000, 'Megalopolis']];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CITY_NAMES = ['Neapolis', 'Nova Arcadia', 'Lumen Bay', 'Riverton', 'Kalypso', 'Port Helios', 'Elmsford', 'Marisol', 'Aurelia', 'Thessa', 'Brightwater', 'Ostia Nova'];

// ------------------------------------------------------------------ city state
const LAYERS = ['terrain', 'road', 'zone', 'level', 'variant', 'tree', 'pline', 'pipe', 'hitech'];
const city = {
  seed: 1, name: 'Neapolis', funds: 25000, month: 0, rank: 0, approval: 60, dayT: 0.3, disasters: true,
  tax: { r: 9, c: 9, i: 9 }, fund: { police: 100, fire: 100, health: 100, education: 100, transport: 100 },
  loans: [], ord: {}, history: [], news: [], structs: [],
};
for (const k of LAYERS) city[k] = new Uint8Array(NN);
const occ = new Int16Array(NN).fill(-1);
const power = new Uint8Array(NN), water = new Uint8Array(NN), pipeLive = new Uint8Array(NN), nearRoad = new Int32Array(NN).fill(-1);
const lv = new Float32Array(NN), pol = new Float32Array(NN), crime = new Float32Array(NN), trash = new Uint8Array(NN), jobless = new Uint8Array(NN);
const traffic = new Float32Array(NN), cong = new Float32Array(NN), commute = new Float32Array(NN), rad = new Float32Array(NN);
const cov = { police: new Float32Array(NN), fire: new Float32Array(NN), health: new Float32Array(NN), edu: new Float32Array(NN), park: new Float32Array(NN), transit: new Float32Array(NN), garbage: new Float32Array(NN), civic: new Float32Array(NN) };
const burn = new Float32Array(NN), unhappy = new Uint8Array(NN), anim = new Float32Array(NN).fill(1), distLand = new Uint8Array(NN);
const stats = { pop: 0, jobsC: 0, jobsI: 0, dem: { r: 0.7, c: 0.5, i: 0.8 }, income: 0, expense: 0, powerCap: 0, powerUse: 0, waterCap: 0, waterUse: 0, garbage: 0, garbageCap: 0, avgCong: 0, factors: {} };

function rebuildOcc() {
  occ.fill(-1);
  city.structs.forEach((s, k) => { for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) occ[idx(x, y)] = k; });
}
function generateMap(seed) {
  const r = mulberry32(seed * 131 + 7);
  const t = city.terrain;
  t.fill(0);
  const vertical = r() < 0.5;
  let c = 8 + r() * (N - 16), drift = 0;
  for (let a = 0; a < N; a++) {
    drift = clamp(drift + (r() - 0.5) * 0.5, -0.6, 0.6);
    c = clamp(c + drift, 4, N - 6);
    const w = 2 + (r() < 0.3 ? 1 : 0);
    for (let k = 0; k < w; k++) { const b = Math.round(c) + k; if (vertical) t[idx(b, a)] = 1; else t[idx(a, b)] = 1; }
  }
  const lx = r() < 0.5 ? 6 : N - 7, ly = r() < 0.5 ? 6 : N - 7, lr = 2.5 + r() * 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - lx, y - ly) < lr + r() * 0.8) t[idx(x, y)] = 1;
  const n = valueNoise(r);
  city.tree.fill(0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!t[idx(x, y)] && n(x / N, y / N) > 0.6 && r() < 0.75) city.tree[idx(x, y)] = 1;
  for (let k = 0; k < NN; k++) city.variant[k] = (r() * 255) | 0;
}
function computeDistLand() {
  const q = [];
  for (let k = 0; k < NN; k++) { distLand[k] = city.terrain[k] ? 255 : 0; if (!city.terrain[k]) q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % N, y = (k / N) | 0;
    for (const [dx, dy] of D4) {
      const a = x + dx, b = y + dy;
      if (inside(a, b) && distLand[idx(a, b)] > distLand[k] + 1) { distLand[idx(a, b)] = distLand[k] + 1; q.push(idx(a, b)); }
    }
  }
}

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
const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x5a6a4a, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const timeU = { value: 0 }, nightU = { value: 0 };

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
const EL = Math.atan(1 / Math.SQRT2);
const rig = { target: new THREE.Vector3(0, 0, 0), yaw: Math.PI / 4, yawGoal: Math.PI / 4, viewH: 18, viewGoal: 18, shake: 0 };
function updateCamera(dt) {
  rig.yaw += (rig.yawGoal - rig.yaw) * Math.min(1, dt * 9);
  rig.viewH += (rig.viewGoal - rig.viewH) * Math.min(1, dt * 12);
  const half = N / 2 - 1;
  rig.target.x = clamp(rig.target.x, -half, half);
  rig.target.z = clamp(rig.target.z, -half, half);
  const dir = new THREE.Vector3(Math.sin(rig.yaw) * Math.cos(EL), Math.sin(EL), Math.cos(rig.yaw) * Math.cos(EL));
  const sx = rig.shake ? (rnd() - 0.5) * rig.shake * 0.5 : 0, sy = rig.shake ? (rnd() - 0.5) * rig.shake * 0.5 : 0;
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

// ------------------------------------------------------------------ materials
const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78 });
// Windows and lamps: glassy by day, glowing in their own colour by night.
const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1, side: THREE.DoubleSide });
glowMat.onBeforeCompile = (s) => {
  s.uniforms.uNight = nightU;
  s.fragmentShader = 'uniform float uNight;\n' + s.fragmentShader
    .replace('#include <color_fragment>', '#include <color_fragment>\n  vec3 glowCol = diffuseColor.rgb;\n  diffuseColor.rgb = mix(vec3(0.42, 0.56, 0.70), glowCol * 0.25, uNight);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += glowCol * uNight * 1.5;');
};
glowMat.customProgramCacheKey = () => 'glow';
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

// ------------------------------------------------------------------ ground, river, diorama
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
    for (const q of u ? [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]] : [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]]) uv.push(...q);
  };
  const g1 = new THREE.Color(0x86c45a), g2 = new THREE.Color(0x7dbb52);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const k = idx(x, y), x0 = x - N / 2, z0 = y - N / 2, x1 = x0 + 1, z1 = z0 + 1;
      if (city.terrain[k]) { quad([x0, BED, z0], [x0, BED, z1], [x1, BED, z1], [x1, BED, z0], 0xc9b98a, false); continue; }
      const c = ((x + y) & 1 ? g1 : g2).clone().multiplyScalar(0.96 + ((city.variant[k] & 7) / 7) * 0.06);
      quad([x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], c);
      const side = (nx, ny, a, b) => {
        const out = !inside(nx, ny);
        if (!out && !city.terrain[idx(nx, ny)]) return;
        const low = out ? -0.6 : BED;
        quad([a[0], 0, a[1]], [a[0], low, a[1]], [b[0], low, b[1]], [b[0], 0, b[1]], 0x9a7a4e, false);
      };
      side(x, y + 1, [x0, z1], [x1, z1]); side(x + 1, y, [x1, z1], [x1, z0]); side(x, y - 1, [x1, z0], [x0, z0]); side(x - 1, y, [x0, z0], [x0, z1]);
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
  for (const [top, bot, c] of [[-0.6, -1.3, 0x8a6a40], [-1.3, -2.1, 0x6b4f30], [-2.1, -3, 0x4f3a24]]) {
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
const WATER_Y = -0.08, WSEG = N * 2;
const waterGeo = new THREE.PlaneGeometry(N, N, WSEG, WSEG).rotateX(-Math.PI / 2);
waterGeo.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array((WSEG + 1) * (WSEG + 1)), 1));
const waterMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: timeU, uNight: nightU, uShallow: { value: new THREE.Color(0x63d6e4) }, uDeep: { value: new THREE.Color(0x2275c2) } },
  vertexShader: `attribute float aDepth; varying float vDepth; varying vec2 vXZ;
    void main() { vDepth = aDepth; vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uShallow; uniform vec3 uDeep; uniform float uTime; uniform float uNight;
    varying float vDepth; varying vec2 vXZ;
    void main() {
      float d = clamp(vDepth, 0.0, 1.0);
      vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d));
      float shore = smoothstep(0.12, 0.0, vDepth);
      float band = smoothstep(0.8, 1.0, sin(uTime * 1.6 - vDepth * 22.0) * 0.5 + 0.5) * smoothstep(0.5, 0.1, vDepth);
      float foam = max(shore, band * 0.7);
      float sp = pow(max(0.0, sin(vXZ.x * 2.3 + uTime * 1.1) * sin(vXZ.y * 2.9 - uTime * 0.9)), 28.0);
      col = mix(col, vec3(1.0, 0.99, 0.95), foam * 0.85) + sp * 0.3;
      col *= mix(1.0, 0.35, uNight);
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
const dummy = new THREE.Object3D();
const tc = new THREE.Color();
function inst(geo, mat, max, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.count = 0;
  m.frustumCulled = false; // instance bounds change constantly
  m.castShadow = shadow; m.receiveShadow = true;
  scene.add(m);
  return m;
}
function instColored(geo, mat, max, shadow = false) { const m = inst(geo, mat, max, shadow); m.setColorAt(0, new THREE.Color()); return m; }
const tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const zoneMesh = instColored(tileGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false }), NN);
const roadMat = new THREE.MeshStandardMaterial({ color: 0x454a57, roughness: 0.9 });
const roadMesh = inst(new THREE.BoxGeometry(1, 0.05, 1).translate(0, 0.025, 0), roadMat, NN, false);
const avenueMesh = inst(new THREE.BoxGeometry(1, 0.05, 1).translate(0, 0.025, 0), new THREE.MeshStandardMaterial({ color: 0x3a3e48, roughness: 0.9 }), NN, false);
const medianMesh = inst(new THREE.BoxGeometry(0.1, 0.07, 1).translate(0, 0.035, 0), new THREE.MeshStandardMaterial({ color: 0x6aa84a, roughness: 1 }), NN, false);
const curbMesh = inst(new THREE.BoxGeometry(1, 0.055, 0.08).translate(0, 0.0275, 0), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.9 }), NN * 4, false);
const dashMesh = inst(new THREE.BoxGeometry(0.04, 0.01, 0.24).translate(0, 0.055, 0), new THREE.MeshBasicMaterial({ color: 0xf6f2e2 }), NN * 8, false);
const pillarMesh = inst(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8).translate(0, -0.2, 0), new THREE.MeshStandardMaterial({ color: 0xb8b4ac }), NN, true);
const lamps = lampGeos();
const lampBody = inst(lamps.body, bodyMat, NN, false);
const lampHead = inst(lamps.head, glowMat, NN, false);
const poleMesh = inst(poleGeo(), bodyMat, NN, true);
const wireMesh = inst(new THREE.CylinderGeometry(0.004, 0.004, 1, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a2a2a }), NN * 4, false);
const pipeMesh = instColored(new THREE.CylinderGeometry(0.07, 0.07, 1, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }), NN * 4);
const jointMesh = instColored(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }), NN);
const treeMeshes = treeGeos().map((g) => inst(g, swayMat, NN * 2));
const templates = {};
function tpl(key, make) {
  if (!templates[key]) {
    const t = make();
    templates[key] = { body: inst(t.body, bodyMat, 360), glow: t.glow ? inst(t.glow, glowMat, 360, false) : null, smoke: t.smoke };
  }
  return templates[key];
}
for (let z = 1; z <= 3; z++) for (let l = 1; l <= 3; l++) for (let v = 0; v < VARIANTS; v++) tpl(`${z}-${l}-${v}`, () => zoneTemplate(z, l, v));
for (let v = 0; v < VARIANTS; v++) tpl(`3-3-${v}-h`, () => zoneTemplate(3, 3, v, true));
const STRUCT_MODEL = {};
for (const k of Object.keys(STRUCT)) STRUCT_MODEL[k] = structModel(k);
const structGroup = new THREE.Group();
scene.add(structGroup);
const markerMesh = instColored(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), NN);
const overlayMesh = instColored(tileGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.62, depthWrite: false }), NN);
overlayMesh.renderOrder = 4;
const previewMesh = instColored(tileGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false, depthTest: false }), NN);
previewMesh.renderOrder = 6;
const carMesh = instColored(carGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5 }), 260);
let layersDirty = true, buildingsDirty = true, structsDirty = true;
let underground = false;

const isRoad = (x, y) => inside(x, y) && city.road[idx(x, y)] > 0;
function roadDirs(x, y) { const out = []; for (const [dx, dy] of D4) if (isRoad(x + dx, y + dy)) out.push([dx, dy]); return out; }
function put(m, n, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
  m.setMatrixAt(n, dummy.matrix);
}
function polePos(x, y) { return city.road[idx(x, y)] ? [wx(x) + 0.4, wz(y) + 0.4] : [wx(x), wz(y)]; }
function layoutLayers() {
  const n = { zone: 0, road: 0, ave: 0, med: 0, curb: 0, dash: 0, pil: 0, lamp: 0, pole: 0, wire: 0, pipe: 0, joint: 0 };
  const nt = [0, 0];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const k = idx(x, y);
      if (city.zone[k] && !city.road[k]) {
        put(zoneMesh, n.zone, wx(x), 0.012, wz(y), 0, 0.94, 1, 0.94);
        zoneMesh.setColorAt(n.zone++, tc.set(ZONE_COL[city.zone[k]]).multiplyScalar(city.level[k] ? 0.75 : 1));
      }
      const rt = city.road[k];
      if (rt) {
        const dirs = roadDirs(x, y);
        put(rt === 2 ? avenueMesh : roadMesh, rt === 2 ? n.ave++ : n.road++, wx(x), 0, wz(y));
        if (city.terrain[k]) put(pillarMesh, n.pil++, wx(x), 0, wz(y));
        const straightX = dirs.length && dirs.every(([a]) => a !== 0), straightZ = dirs.length && dirs.every(([, b]) => b !== 0);
        if (rt === 2 && (straightX || straightZ)) put(medianMesh, n.med++, wx(x), 0, wz(y), straightX ? Math.PI / 2 : 0);
        for (const [dx, dy] of D4) {
          const has = dirs.some(([a, b]) => a === dx && b === dy);
          if (!has) put(curbMesh, n.curb++, wx(x) + dx * 0.46, 0, wz(y) + dy * 0.46, dx ? Math.PI / 2 : 0);
          else if (dirs.length <= 2) {
            for (const o of rt === 2 ? [-0.22, 0.22] : [0]) put(dashMesh, n.dash++, wx(x) + dx * 0.25 + (dy ? o : 0), 0, wz(y) + dy * 0.25 + (dx ? o : 0), dx ? Math.PI / 2 : 0);
          }
        }
        if (!city.terrain[k] && (x + y) % 2 === 0) {
          // a street lamp on the kerb, leaning over the road
          const alongX = dirs.some(([a]) => a !== 0);
          const side = alongX ? [0, 0.43] : [0.43, 0];
          const ry = alongX ? Math.PI : -Math.PI / 2;
          put(lampBody, n.lamp, wx(x) + side[0], 0.05, wz(y) + side[1], ry);
          put(lampHead, n.lamp++, wx(x) + side[0], 0.05, wz(y) + side[1], ry);
        }
      }
      if (city.pline[k]) {
        const [px, pz] = polePos(x, y);
        put(poleMesh, n.pole++, px, 0, pz);
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          if (!inside(x + dx, y + dy) || !city.pline[idx(x + dx, y + dy)]) continue;
          const [qx, qz] = polePos(x + dx, y + dy);
          const len = Math.hypot(qx - px, qz - pz), ry = Math.atan2(qx - px, qz - pz);
          for (const o of [-0.1, 0.1]) put(wireMesh, n.wire++, (px + qx) / 2 + Math.cos(ry) * o, 0.6, (pz + qz) / 2 - Math.sin(ry) * o, ry, 1, 1, len);
        }
      }
      if (city.pipe[k]) {
        const c = pipeLive[k] ? 0x3f9bff : 0x8a8f96;
        put(jointMesh, n.joint, wx(x), 0.1, wz(y)); jointMesh.setColorAt(n.joint++, tc.set(c));
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          if (!inside(x + dx, y + dy) || !city.pipe[idx(x + dx, y + dy)]) continue;
          put(pipeMesh, n.pipe, wx(x) + dx * 0.5, 0.1, wz(y) + dy * 0.5, dx ? Math.PI / 2 : 0);
          pipeMesh.setColorAt(n.pipe++, tc.set(c));
        }
      }
      if (city.tree[k] && !city.road[k] && !city.level[k] && occ[k] < 0 && !city.terrain[k] && !city.zone[k]) {
        const v = city.variant[k];
        for (let t = 0; t < 1 + (v & 1); t++) {
          const kind = (v >> (2 + t)) & 1, s = 0.8 + ((v >> 5) & 3) * 0.12;
          put(treeMeshes[kind], nt[kind]++, wx(x) + (((v >> t) & 3) / 3 - 0.5) * 0.5, 0, wz(y) + (((v >> (t + 3)) & 3) / 3 - 0.5) * 0.5, v * 0.1 + t, s, s, s);
        }
      }
    }
  zoneMesh.count = n.zone; roadMesh.count = n.road; avenueMesh.count = n.ave; medianMesh.count = n.med; curbMesh.count = n.curb; dashMesh.count = n.dash; pillarMesh.count = n.pil;
  lampBody.count = lampHead.count = n.lamp; poleMesh.count = n.pole; wireMesh.count = n.wire; pipeMesh.count = n.pipe; jointMesh.count = n.joint;
  treeMeshes[0].count = nt[0]; treeMeshes[1].count = nt[1];
  for (const m of [zoneMesh, roadMesh, avenueMesh, medianMesh, curbMesh, dashMesh, pillarMesh, lampBody, lampHead, poleMesh, wireMesh, pipeMesh, jointMesh, ...treeMeshes]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}
function facing(x, y) {
  for (const [dx, dy, ry] of [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]]) if (isRoad(x + dx, y + dy)) return ry;
  return ((x * 7 + y * 3) % 4) * Math.PI / 2;
}
let animating = false;
const smokeList = [];
function layoutBuildings() {
  const counts = new Map();
  smokeList.length = 0;
  animating = false;
  for (let k = 0; k < NN; k++) {
    const L = city.level[k];
    if (!L || city.road[k]) continue;
    const z = city.zone[k], v = city.variant[k] % VARIANTS;
    const key = z === I && L === 3 && city.hitech[k] ? `3-3-${v}-h` : `${z}-${L}-${v}`;
    const t = templates[key];
    const c = counts.get(key) || 0;
    if (!t || c >= 360) continue;
    const x = k % N, y = (k / N) | 0, a = anim[k];
    if (a < 1) animating = true;
    const e = 1 - Math.pow(1 - a, 3);
    dummy.position.set(wx(x), 0, wz(y)); dummy.rotation.set(0, facing(x, y), 0); dummy.scale.set(1, Math.max(0.05, e), 1); dummy.updateMatrix();
    t.body.setMatrixAt(c, dummy.matrix);
    if (t.glow) t.glow.setMatrixAt(c, dummy.matrix);
    counts.set(key, c + 1);
    if (a >= 1) for (const s of t.smoke) smokeList.push({ k, v: new THREE.Vector3(s[0], s[1], s[2]).applyEuler(dummy.rotation).add(dummy.position) });
  }
  for (const [key, t] of Object.entries(templates)) {
    const c = counts.get(key) || 0;
    t.body.count = c; t.body.instanceMatrix.needsUpdate = true;
    if (t.glow) { t.glow.count = c; t.glow.instanceMatrix.needsUpdate = true; }
  }
}
const structSmoke = [];
function layoutStructs() {
  structGroup.clear();
  structSmoke.length = 0;
  for (const s of city.structs) {
    const m = STRUCT_MODEL[s.type];
    const g = new THREE.Group();
    g.position.set(wx(s.x) + (s.w - 1) / 2, 0, wz(s.y) + (s.h - 1) / 2);
    const body = new THREE.Mesh(m.body, bodyMat); body.castShadow = body.receiveShadow = true; g.add(body);
    if (m.glow) g.add(new THREE.Mesh(m.glow, glowMat));
    for (const sp of m.spin) { const b = new THREE.Mesh(sp.geo, bodyMat); b.position.set(...sp.pos); b.castShadow = true; b.userData.spin = true; g.add(b); }
    structGroup.add(g);
    for (const p of m.smoke) structSmoke.push({ s, v: new THREE.Vector3(p[0], p[1], p[2]).add(g.position), big: p[3] || 1 });
  }
}
function layoutMarkers() {
  let n = 0;
  for (let k = 0; k < NN; k++) {
    let c = null;
    const L = city.level[k];
    if (L) {
      if (!power[k]) c = 0xffd23f;
      else if (!water[k] && stats.waterCap > 0 && city.month > 3) c = 0x4fb4ff;
      else if (trash[k] > 4) c = 0x9a7a4a;
      else if (city.zone[k] === R && jobless[k]) c = 0xff8a3a;
    } else if (occ[k] >= 0) {
      const s = city.structs[occ[k]];
      if (s.x === k % N && s.y === ((k / N) | 0) && STRUCT[s.type].powered && !power[k]) c = 0xffd23f;
    }
    if (!c) continue;
    const h = L === 3 ? 2.8 : L === 2 ? 1.4 : 1.0;
    put(markerMesh, n, wx(k % N), h, wz((k / N) | 0)); markerMesh.setColorAt(n++, tc.set(c));
  }
  markerMesh.count = n;
  markerMesh.instanceMatrix.needsUpdate = true;
  if (markerMesh.instanceColor) markerMesh.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------ overlays and the underground view
let overlay = 'none';
const OVERLAYS = {
  none: { name: 'None' },
  power: { name: 'Power', legend: 'Yellow: powered · Red: no power' },
  water: { name: 'Water', legend: 'Underground: pipes, watered land in light blue' },
  traffic: { name: 'Traffic', legend: 'Green: free · Red: jammed' },
  value: { name: 'Land value', legend: 'Red: low · Green: high' },
  pollution: { name: 'Pollution', legend: 'Brown: polluted' },
  crime: { name: 'Crime', legend: 'Red: dangerous' },
  health: { name: 'Health', legend: 'Pink: clinics and hospitals reach' },
  education: { name: 'Education', legend: 'Purple: schools and university reach' },
  garbage: { name: 'Garbage', legend: 'Green: collected · Brown: piling up' },
  services: { name: 'Police & fire', legend: 'Blue: police and fire coverage' },
};
const lowC = new THREE.Color(0xe0403a), midC = new THREE.Color(0xf5c542), hiC = new THREE.Color(0x3fbf5a), white = new THREE.Color(0xffffff);
function ramp(v) { return v < 0.5 ? tc.copy(lowC).lerp(midC, v * 2) : tc.copy(midC).lerp(hiC, (v - 0.5) * 2); }
function tint(v, hex) { return tc.copy(white).lerp(new THREE.Color(hex), clamp(v, 0, 1)); }
function layoutOverlay() {
  let n = 0;
  const ov = underground ? 'water' : overlay;
  if (ov !== 'none') {
    for (let k = 0; k < NN; k++) {
      if (city.terrain[k] && !city.road[k] && !city.pline[k] && !city.pipe[k]) continue;
      const conductive = city.pline[k] || city.zone[k] || occ[k] >= 0;
      const dev = city.level[k] > 0;
      let c = null;
      if (ov === 'power') { if (conductive) c = power[k] ? tc.set(0xffd23f) : tc.set(0xe0403a); }
      else if (ov === 'water') { if (water[k]) c = tc.set(0x8fd0ff); else if (dev) c = tc.set(0xe0603a); }
      else if (ov === 'traffic') { if (city.road[k]) c = ramp(1 - clamp(cong[k] / 1.4, 0, 1)); }
      else if (ov === 'value') c = ramp(lv[k]);
      else if (ov === 'pollution') { if (pol[k] > 0.04) c = tint(pol[k] * 1.4, 0x6b3f1a); }
      else if (ov === 'crime') { if (crime[k] > 0.04) c = tint(crime[k] * 1.6, 0xc0262a); }
      else if (ov === 'health') { if (cov.health[k] > 0) c = tint(cov.health[k] * 1.3, 0xe04a8a); }
      else if (ov === 'education') { if (cov.edu[k] > 0) c = tint(cov.edu[k] * 1.3, 0x7a4ae0); }
      else if (ov === 'garbage') { if (dev) c = trash[k] > 2 ? tc.set(0x8a5a2a) : cov.garbage[k] > 0 ? tc.set(0x6ad07a) : tc.set(0xe0a03a); }
      else if (ov === 'services') { const s = Math.max(cov.police[k], cov.fire[k]); if (s > 0) c = tint(s * 1.3, 0x2f6fe0); }
      if (!c) continue;
      put(overlayMesh, n, wx(k % N), underground ? 0.02 : 0.09, wz((k / N) | 0), 0, 0.98, 1, 0.98);
      overlayMesh.setColorAt(n++, c);
    }
  }
  overlayMesh.count = n;
  overlayMesh.instanceMatrix.needsUpdate = true;
  if (overlayMesh.instanceColor) overlayMesh.instanceColor.needsUpdate = true;
  zoneMesh.visible = ov === 'none';
}
function setUnderground(on) {
  if (underground === on) return;
  underground = on;
  for (const t of Object.values(templates)) { t.body.visible = !on; if (t.glow) t.glow.visible = !on; }
  for (const m of [...treeMeshes, carMesh, lampBody, lampHead, poleMesh, wireMesh, markerMesh, dashMesh, medianMesh]) m.visible = !on;
  structGroup.visible = !on;
  pipeMesh.visible = jointMesh.visible = on;
  groundMat.color.set(on ? 0x8a6a4a : 0xffffff);
  roadMat.color.set(on ? 0x2a2d35 : 0x454a57);
  layoutOverlay();
  $('underground').hidden = !on;
}
pipeMesh.visible = jointMesh.visible = false;

// ------------------------------------------------------------------ particles
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
function emit(x, y, z, color, n = 6, spread = 0.6, up = 1.5, life = 1, grav = 1.5) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    if (parts.length >= PMAX) parts.shift();
    parts.push({ x, y, z, vx: (rnd() - 0.5) * spread, vy: up * (0.5 + rnd() * 0.8), vz: (rnd() - 0.5) * spread, life: life * (0.6 + rnd() * 0.6), max: life, c, grav });
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
const fundMul = (dept) => (dept ? clamp(city.fund[dept] / 100, 0, 1.5) : 1);
function computeAccess() {
  const dist = new Uint8Array(NN).fill(255), q = [];
  nearRoad.fill(-1);
  for (let k = 0; k < NN; k++) if (city.road[k]) { dist[k] = 0; nearRoad[k] = k; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % N, y = (k / N) | 0;
    if (dist[k] >= 3) continue;
    for (const [dx, dy] of D4) {
      const a = x + dx, b = y + dy;
      if (inside(a, b) && dist[idx(a, b)] > dist[k] + 1) { dist[idx(a, b)] = dist[k] + 1; nearRoad[idx(a, b)] = nearRoad[k]; q.push(idx(a, b)); }
    }
  }
}
function utilUse(k) {
  if (city.level[k]) return UTIL_USE[city.level[k]];
  if (occ[k] >= 0) { const s = city.structs[occ[k]]; return STRUCT[s.type].powered && s.x === k % N && s.y === ((k / N) | 0) ? 3 : 0; }
  return 0;
}
function nearWater(s) {
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) if (inside(x, y) && city.terrain[idx(x, y)] && !city.road[idx(x, y)]) return true;
  return false;
}
// Power flows from plants through power lines, zones (touching each other) and buildings.
function flowPower() {
  power.fill(0);
  let cap = 0, used = 0;
  const seen = new Uint8Array(NN), q = [];
  for (const s of city.structs) {
    if (!STRUCT[s.type].power) continue;
    cap += STRUCT[s.type].power;
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) { seen[idx(x, y)] = 1; power[idx(x, y)] = 1; q.push(idx(x, y)); }
  }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % N, y = (k / N) | 0;
    for (const [dx, dy] of D4) {
      const a = x + dx, b = y + dy;
      if (!inside(a, b)) continue;
      let j = idx(a, b);
      // Power crosses a single street between blocks, like cables under the kerb.
      if (city.road[j] && !city.pline[j] && (city.zone[k] || occ[k] >= 0)) {
        const a2 = a + dx, b2 = b + dy;
        if (!inside(a2, b2)) continue;
        const j2 = idx(a2, b2);
        if (!(city.zone[j2] || occ[j2] >= 0)) continue;
        power[j] = 1;
        j = j2;
      }
      if (seen[j] || !(city.pline[j] || city.zone[j] || occ[j] >= 0)) continue;
      seen[j] = 1;
      const need = utilUse(j);
      if (used + need <= cap) { used += need; power[j] = 1; q.push(j); }
    }
  }
  for (const s of city.structs) {
    let on = false;
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) on ||= !!power[idx(x, y)];
    if (on) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) power[idx(x, y)] = 1;
  }
  stats.powerCap = cap; stats.powerUse = used;
}
// Water flows from pumps and towers through pipes; each live pipe waters land within 2 tiles.
function flowWater() {
  water.fill(0); pipeLive.fill(0);
  let cap = 0, used = 0;
  const q = [];
  for (const s of city.structs) {
    const d = STRUCT[s.type];
    if (!d.water) continue;
    if (s.type === 'pump' && (!nearWater(s) || !power[idx(s.x, s.y)])) continue;
    cap += d.water;
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) water[idx(x, y)] = 1;
    for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
      if (!inside(x, y)) continue;
      const k = idx(x, y);
      if (city.pipe[k] && !pipeLive[k]) { pipeLive[k] = 1; q.push(k); }
    }
  }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % N, y = (k / N) | 0;
    for (let b = y - 2; b <= y + 2; b++) for (let a = x - 2; a <= x + 2; a++) {
      if (!inside(a, b)) continue;
      const j = idx(a, b);
      if (water[j]) continue;
      const need = city.level[j] ? UTIL_USE[city.level[j]] : 0;
      if (used + need <= cap) { used += need; water[j] = 1; }
    }
    for (const [dx, dy] of D4) {
      const a = x + dx, b = y + dy;
      if (inside(a, b) && city.pipe[idx(a, b)] && !pipeLive[idx(a, b)]) { pipeLive[idx(a, b)] = 1; q.push(idx(a, b)); }
    }
  }
  stats.waterCap = cap; stats.waterUse = used;
}
function computeCoverage() {
  for (const a of Object.values(cov)) a.fill(0);
  let gProd = 0, gCap = 0;
  for (let k = 0; k < NN; k++) if (city.level[k]) gProd += city.level[k] * 3;
  if (city.ord.recycle) gProd *= 0.7;
  for (const s of city.structs) if (STRUCT[s.type].garbage && (!STRUCT[s.type].powered || power[idx(s.x, s.y)])) gCap += STRUCT[s.type].garbage;
  stats.garbage = Math.round(gProd); stats.garbageCap = gCap;
  const gScale = gProd > 0 ? clamp(gCap / gProd, 0, 1) : 1;
  for (const s of city.structs) {
    const d = STRUCT[s.type];
    if (!d.kind) continue;
    if (d.powered && !power[idx(s.x, s.y)]) continue;
    const arr = cov[d.kind];
    const r = d.radius * (d.kind === 'garbage' ? Math.sqrt(gScale) : 1);
    const strength = (d.boost || 1) * fundMul(d.dept);
    const cx = s.x + (s.w - 1) / 2, cy = s.y + (s.h - 1) / 2;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(N - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(N - 1, Math.ceil(cx + r)); x++) {
        const dd = Math.hypot(x - cx, y - cy);
        if (dd <= r) arr[idx(x, y)] = Math.max(arr[idx(x, y)], clamp((1 - dd / (r + 1)) * strength, 0, 1));
      }
  }
  if (city.ord.clinics) for (let k = 0; k < NN; k++) cov.health[k] = clamp(cov.health[k] + 0.15, 0, 1);
  if (city.ord.reading) for (let k = 0; k < NN; k++) cov.edu[k] = clamp(cov.edu[k] + 0.15, 0, 1);
}
// Commuters drive from home to the nearest jobs along the road network.
function computeTraffic() {
  traffic.fill(0); jobless.fill(0); commute.fill(0);
  const INF = 1e9, dist = new Float64Array(NN).fill(INF), next = new Int32Array(NN).fill(-1), q = [];
  for (let k = 0; k < NN; k++) {
    if (!city.road[k]) continue;
    const x = k % N, y = (k / N) | 0;
    let job = false;
    for (let b = y - 1; b <= y + 1 && !job; b++) for (let a = x - 1; a <= x + 1; a++) if (inside(a, b) && city.level[idx(a, b)] && city.zone[idx(a, b)] !== R) { job = true; break; }
    if (job) { dist[k] = 0; q.push(k); }
  }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % N, y = (k / N) | 0;
    for (const [dx, dy] of D4) {
      const a = x + dx, b = y + dy;
      if (!isRoad(a, b)) continue;
      const j = idx(a, b);
      if (dist[j] > dist[k] + 1) { dist[j] = dist[k] + 1; next[j] = k; q.push(j); }
    }
  }
  const carpool = city.ord.carpool ? 0.85 : 1;
  for (let k = 0; k < NN; k++) {
    if (city.zone[k] !== R || !city.level[k]) continue;
    const r0 = nearRoad[k];
    if (r0 < 0 || dist[r0] >= INF) { jobless[k] = 1; continue; }
    const trips = CAP[R][city.level[k]] * 0.6 * (1 - cov.transit[k] * 0.45) * carpool;
    let r = r0, steps = 0;
    while (r >= 0 && steps++ < 120) { traffic[r] += trips; r = next[r]; }
  }
  let sum = 0, n = 0;
  const tm = clamp(city.fund.transport / 100, 0.5, 1.3);
  cong.fill(0);
  for (let k = 0; k < NN; k++) if (city.road[k]) { cong[k] = traffic[k] / (ROAD_CAP[city.road[k]] * tm); sum += cong[k]; n++; }
  stats.avgCong = n ? sum / n : 0;
  // commute time grows with jams along the way
  for (let k = 0; k < NN; k++) {
    if (city.zone[k] !== R || !city.level[k] || jobless[k]) continue;
    let r = nearRoad[k], t = 1, steps = 0;
    while (r >= 0 && steps++ < 120) { t += 1 + Math.max(0, cong[r] - 0.6) * 2.5; r = next[r]; }
    commute[k] = t;
  }
}
function waterNear(k) {
  const x = k % N, y = (k / N) | 0;
  for (let b = y - 2; b <= y + 2; b++) for (let a = x - 2; a <= x + 2; a++) if (inside(a, b) && city.terrain[idx(a, b)]) return true;
  return false;
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
  const iMul = city.ord.clean ? 0.65 : 1;
  for (let k = 0; k < NN; k++) {
    if (city.zone[k] === I && city.level[k]) addPol(k % N, (k / N) | 0, (city.hitech[k] ? 0.02 : 0.09 * city.level[k]) * iMul, 3 + city.level[k]);
    if (city.road[k] && cong[k] > 0.3) addPol(k % N, (k / N) | 0, Math.min(cong[k], 2) * 0.06, 1.5);
  }
  for (const s of city.structs) { const p = STRUCT[s.type].pol; if (p) addPol(s.x + (s.w - 1) / 2, s.y + (s.h - 1) / 2, p[0], p[1]); }
  for (let k = 0; k < NN; k++) { if (city.tree[k] && !city.level[k]) pol[k] *= 0.8; pol[k] = clamp(pol[k] + rad[k] * 0.6, 0, 1); }
  for (let k = 0; k < NN; k++) {
    const dense = city.level[k] && city.zone[k] !== I ? 0.1 + city.level[k] * 0.12 : city.zone[k] ? 0.08 : 0;
    let c = dense * 0.6 + (stats.pop > 2000 ? 0.08 : 0) + (jobless[k] ? 0.08 : 0) + (city.ord.gambling ? 0.08 : 0);
    if (city.ord.watch) c *= 0.85;
    crime[k] = clamp(c - cov.police[k] * 0.8, 0, 1);
  }
  for (let k = 0; k < NN; k++) {
    let v = 0.44 + cov.park[k] * 0.3 + cov.police[k] * 0.08 + cov.edu[k] * 0.1 + cov.health[k] * 0.08 + cov.civic[k] * 0.22 + (city.tree[k] ? 0.05 : 0);
    if (!city.terrain[k] && waterNear(k)) v += 0.12;
    const r0 = nearRoad[k];
    if (r0 >= 0 && r0 !== k) v -= Math.max(0, cong[r0] - 0.7) * 0.2;
    v -= pol[k] * 0.7 + crime[k] * 0.25 + (trash[k] > 4 ? 0.2 : 0);
    lv[k] = clamp(v, 0, 1);
  }
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
  const tm = (t) => 1 - (t - 9) / 14;
  const civic = city.structs.some((s) => s.type === 'stadium' || s.type === 'landmark') ? 0.08 : 0;
  stats.dem.r = clamp(clamp(((jc + ji) * 1.15 + 70 - pop) / (pop * 0.25 + 90), -1, 1) * tm(city.tax.r) * (0.6 + city.approval / 125), -1, 1);
  stats.dem.c = clamp(clamp((pop * 0.33 - jc + 14) / (pop * 0.12 + 30), -1, 1) * tm(city.tax.c) + (city.ord.tourism ? 0.15 : 0) + civic, -1, 1);
  stats.dem.i = clamp(clamp((pop * 0.45 - ji + 24) / (pop * 0.15 + 30), -1, 1) * tm(city.tax.i) - (city.ord.clean ? 0.1 : 0), -1, 1);
}
function computeApproval() {
  let n = 0, police = 0, health = 0, edu = 0, p = 0, cr = 0, noUtil = 0, garb = 0, jl = 0, com = 0;
  for (let k = 0; k < NN; k++) {
    if (city.zone[k] !== R || !city.level[k]) continue;
    n++; police += cov.police[k]; health += cov.health[k]; edu += cov.edu[k]; p += pol[k]; cr += crime[k];
    if (!power[k] || !water[k]) noUtil++;
    if (trash[k] > 4) garb++;
    if (jobless[k]) jl++;
    com += clamp((commute[k] - 12) / 25, 0, 1);
  }
  const f = {};
  const avgTax = (city.tax.r + city.tax.c + city.tax.i) / 3;
  f.Taxes = -(avgTax - 9) * 3.5;
  if (n) {
    f.Safety = (police / n) * 12 - (cr / n) * 28;
    f.Health = (health / n) * 10;
    f.Schools = (edu / n) * 10;
    f.Pollution = -(p / n) * 28;
    f.Utilities = -(noUtil / n) * 18;
    f.Garbage = -(garb / n) * 14;
    f.Jobs = -(jl / n) * 16;
    f.Commute = -(com / n) * 12;
  }
  const has = (t) => city.structs.some((s) => s.type === t);
  f.Landmarks = (has('cityhall') ? 7 : 0) + (has('stadium') ? 4 : 0) + (has('landmark') ? 4 : 0) + (has('park') || has('plaza') ? 2 : 0);
  f.Policies = (city.ord.clinics ? 2 : 0) - (city.ord.parking ? 3 : 0) - (city.ord.gambling ? 2 : 0);
  if (city.funds < 0) f.Debt = -8;
  let a = 62;
  for (const v of Object.values(f)) a += v;
  stats.factors = f;
  city.approval = clamp(city.approval * 0.6 + clamp(a, 0, 100) * 0.4, 0, 100);
}
function recompute() {
  rebuildOcc();
  computeAccess();
  flowPower();
  flowWater();
  computeCoverage();
  computeTraffic();
  computeTotals();
  computeEnvironment();
}
function grow() {
  const order = [];
  for (let k = 0; k < NN; k++) if (city.zone[k] && !city.road[k]) order.push(k);
  for (let i = order.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  let changed = 0;
  for (const k of order) {
    const z = city.zone[k], L = city.level[k];
    const dem = z === R ? stats.dem.r : z === C ? stats.dem.c : stats.dem.i;
    const ok = nearRoad[k] >= 0 && power[k] && rad[k] < 0.2;
    if (burn[k] > 0) continue;
    if (L && cov.garbage[k] <= 0) trash[k] = Math.min(12, trash[k] + 1); else trash[k] = 0;
    if (!L) {
      if (ok && dem > 0 && rnd() < 0.3 * dem * (0.5 + lv[k])) { city.level[k] = 1; city.variant[k] = (rnd() * 255) | 0; anim[k] = 0; changed++; }
      continue;
    }
    if (!ok || (z === R && jobless[k] && rnd() < 0.3) || trash[k] > 9) {
      unhappy[k]++;
      if (unhappy[k] >= 4) { city.level[k]--; unhappy[k] = 0; changed++; }
      continue;
    }
    unhappy[k] = 0;
    let maxL = 1;
    if (water[k] && lv[k] >= 0.3 && trash[k] <= 4) maxL = 2;
    if (maxL === 2 && lv[k] >= 0.5 && stats.pop >= 1200) {
      if (z === R && cov.edu[k] >= 0.2 && cov.health[k] >= 0.1 && !jobless[k] && commute[k] < 40) maxL = 3;
      if (z === C && stats.pop >= 1500) maxL = 3;
      if (z === I) maxL = 3;
    }
    if (z === R && pol[k] > 0.55) maxL = Math.min(maxL, 1);
    if (L < maxL && dem > 0.05 && rnd() < 0.1 * dem * (0.5 + lv[k])) {
      city.level[k]++; anim[k] = 0; changed++;
      if (z === I && city.level[k] === 3) city.hitech[k] = cov.edu[k] >= 0.4 ? 1 : 0;
    } else if (L > maxL && rnd() < 0.08) { city.level[k]--; changed++; }
    else if (dem < -0.45 && rnd() < 0.03) { city.level[k]--; changed++; }
  }
  if (changed) buildingsDirty = layersDirty = true;
}
function ignite(k, quiet = false) {
  if (!city.level[k] || burn[k] > 0) return;
  burn[k] = 5;
  if (!quiet) { advise(`Fire in the ${ZONE_NAME[city.zone[k]].toLowerCase()} district!`, true, k); sfx.alarm(); news('Firefighters battle a blaze downtown'); }
}
function fires() {
  const risk = city.ord.smoke ? 0.5 : 1;
  for (let k = 0; k < NN; k++) {
    if (burn[k] > 0) {
      burn[k] -= 1 + cov.fire[k] * 3;
      const x = k % N, y = (k / N) | 0;
      if (rnd() < 0.22 * (1 - cov.fire[k])) {
        const [dx, dy] = D4[(rnd() * 4) | 0];
        const j = idx(clamp(x + dx, 0, N - 1), clamp(y + dy, 0, N - 1));
        if (city.level[j] && burn[j] <= 0) burn[j] = 5;
      }
      if (burn[k] <= 0) { burn[k] = 0; if (cov.fire[k] < 0.15) { city.level[k] = 0; buildingsDirty = layersDirty = true; } }
    } else if (city.disasters && city.level[k] && rnd() < 0.0003 * risk * (city.zone[k] === I ? 3 : 1) * (1 - cov.fire[k] * 0.9)) ignite(k);
  }
}
function finances() {
  let roads = 0, upkeep = 0;
  for (let k = 0; k < NN; k++) { if (city.road[k]) roads += (city.road[k] === 2 ? 1.2 : 0.5) * (city.terrain[k] ? 3 : 1); if (city.pline[k]) roads += 0.1; if (city.pipe[k]) roads += 0.1; }
  roads *= fundMul('transport');
  for (const s of city.structs) upkeep += STRUCT[s.type].upkeep * fundMul(STRUCT[s.type].dept);
  let ords = 0;
  for (const o of ORDINANCES) if (city.ord[o.id]) ords += o.base + (o.per * stats.pop) / 1000;
  const k = 3.2 / 100;
  const income = stats.pop * 0.55 * city.tax.r * k + stats.jobsC * 0.45 * city.tax.c * k + stats.jobsI * 0.45 * city.tax.i * k;
  let loans = 0;
  for (const l of city.loans) { loans += l.pay; l.left--; }
  city.loans = city.loans.filter((l) => l.left > 0);
  stats.income = Math.round(income);
  stats.lines = { roads: Math.round(roads), services: Math.round(upkeep), ords: Math.round(ords), loans: Math.round(loans) };
  stats.expense = Math.round(roads + upkeep + ords + loans);
  city.funds += stats.income - stats.expense;
}
let adviceT = 0, lastAdvice = '';
function advise(msg, urgent = false, k = -1) { if (msg === lastAdvice && !urgent) return; lastAdvice = msg; toast(msg, k); }
function news(text) { city.news.unshift({ m: city.month, text }); city.news.length = Math.min(city.news.length, 30); }
function adviceTick() {
  if (--adviceT > 0) return;
  adviceT = 6;
  const any = (arr) => arr.some((v) => v);
  const has = (t) => city.structs.some((s) => s.type === t);
  const plants = city.structs.some((s) => STRUCT[s.type].power);
  let unpowered = 0, dry = 0, emptyR = 0, jl = 0, devR = 0;
  for (let k = 0; k < NN; k++) {
    if (city.zone[k] && !power[k]) unpowered++;
    if (city.level[k] && !water[k]) dry++;
    if (city.zone[k] === R && !city.level[k]) emptyR++;
    if (city.zone[k] === R && city.level[k]) { devR++; if (jobless[k]) jl++; }
  }
  if (!any(city.road)) return advise('Start with a road, then zone homes beside it.');
  if (!any(city.zone)) return advise('Zone some homes, shops and industry along your road.');
  if (!plants) return advise('Your zones need power: build a wind turbine or a coal plant.');
  if (unpowered > 3 && stats.powerUse === 0) return advise('Run power lines from your plant to your zones.');
  if (unpowered > 3 && stats.powerUse >= stats.powerCap - 12) return advise('Brownout! Build another power plant.');
  if (unpowered > 3) return advise('Some zones have no power: connect them with power lines.');
  if (city.funds < 0) return advise('We are in debt! Raise taxes, cut budgets or take a loan.');
  if (stats.pop > 60 && !stats.waterCap) return advise('Buildings need water to grow: build a pump by the river and lay pipes.');
  if (dry > 4 && stats.waterUse >= stats.waterCap - 12) return advise('Water shortage: build another pump or water tower.');
  if (dry > 4) return advise('Some buildings are dry: extend your pipes under them.');
  if (devR > 6 && jl > devR * 0.3) return advise('Residents cannot reach any jobs: connect homes to shops or industry by road.');
  if (stats.garbage > 60 && !stats.garbageCap) return advise('Garbage is piling up: build a landfill.');
  if (stats.garbageCap && stats.garbage > stats.garbageCap * 1.05) return advise('Garbage overflow: build another landfill or recycling.');
  if (stats.avgCong > 0.9) return advise('Traffic jams! Upgrade busy streets to avenues or add bus stops.');
  if (stats.dem.r > 0.5 && emptyR < 3) return advise('People want to move in: zone more homes.');
  if (stats.dem.i > 0.5) return advise('Industry wants to grow: zone more industry.');
  if (stats.dem.c > 0.5) return advise('Shops want to open: zone more commercial.');
  if (stats.pop > 300 && !has('police')) return advise('Crime is coming: build a police station.');
  if (stats.pop > 300 && !has('fire')) return advise('No fire department: one fire could spread fast.');
  if (stats.pop > 400 && !has('school')) return advise('Build a school: high-rises need educated citizens.');
  if (stats.pop > 400 && !has('clinic') && !has('hospital')) return advise('Build a clinic: healthy citizens live in taller homes.');
  if (city.approval < 35) return advise(`Your approval is ${Math.round(city.approval)}%. Check the stats to see why.`);
}
function monthTick() {
  recompute();
  grow();
  fires();
  randomDisasters();
  finances();
  computeApproval();
  for (let k = 0; k < NN; k++) if (rad[k] > 0) rad[k] *= 0.985;
  city.month++;
  const before = city.rank;
  while (city.rank < MILESTONES.length - 1 && stats.pop >= MILESTONES[city.rank + 1][0]) city.rank++;
  if (city.rank > before) {
    const name = MILESTONES[city.rank][1];
    const unlocked = TOOLS.filter((t) => t.pop && t.pop <= stats.pop && t.pop > MILESTONES[before][0]).map((t) => t.name);
    showMilestone(name, unlocked);
    news(`${city.name} becomes a ${name.toLowerCase()}!`);
  }
  if (city.month % 12 === 0) {
    const pick = (arr) => arr[(rnd() * arr.length) | 0];
    const opts = [];
    if (stats.dem.r > 0.3) opts.push('Housing shortage as newcomers flood in', 'Rents soar: “we need more homes!”');
    if (stats.avgCong > 0.8) opts.push('Commuters fume in daily gridlock', 'Traffic study: city streets at breaking point');
    if (city.approval > 70) opts.push('Poll: residents love their mayor', 'Mayor tipped for re-election landslide');
    if (city.approval < 40) opts.push('Poll: the mayor’s approval sinks', 'Protesters gather outside city hall');
    if (stats.dem.i > 0.4) opts.push('Factories look for land to expand');
    if (stats.dem.c > 0.4) opts.push('Shop owners demand new retail space');
    if (city.funds < 0) opts.push('City in the red: auditors worried');
    if (stats.garbageCap && stats.garbage > stats.garbageCap) opts.push('Trash piles up on city streets');
    if (!opts.length) opts.push('A quiet year at city hall', `${city.name} celebrates its founding day`, 'Local team wins the regional cup', 'Farmers market draws record crowds', 'New bakery opens to long queues');
    news(pick(opts));
  }
  city.history.push([stats.pop, Math.round(city.funds), Math.round(city.approval)]);
  if (city.history.length > 360) city.history.shift();
  adviceTick();
  layersDirty = buildingsDirty = true;
  if (city.month % 6 === 0) save();
}

// ------------------------------------------------------------------ disasters
let tornado = null, quakeT = 0;
function randomDisasters() {
  if (!city.disasters || stats.pop < 400) return;
  if (rnd() < 0.0025) startTornado();
  else if (rnd() < 0.0012) earthquake();
  const nuke = city.structs.find((s) => s.type === 'nuclear');
  if (nuke && city.fund.fire < 70 && rnd() < 0.003) meltdown(nuke);
}
const tornadoMesh = (() => {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, transparent: true, opacity: 0.55, flatShading: true, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15 + i * 0.22, 0.08 + i * 0.2, 0.7, 10, 1, true), mat); c.position.y = 0.35 + i * 0.65; g.add(c); }
  g.visible = false;
  scene.add(g);
  return g;
})();
function startTornado() {
  const side = (rnd() * 4) | 0;
  const p = [[-N / 2, (rnd() - 0.5) * N], [N / 2, (rnd() - 0.5) * N], [(rnd() - 0.5) * N, -N / 2], [(rnd() - 0.5) * N, N / 2]][side];
  const ang = Math.atan2(-p[1] + (rnd() - 0.5) * 10, -p[0] + (rnd() - 0.5) * 10);
  tornado = { x: p[0], z: p[1], dx: Math.cos(ang), dz: Math.sin(ang), t: 0 };
  tornadoMesh.visible = true;
  advise('Tornado! Take cover!', true, idx(clamp(Math.floor(p[0] + N / 2), 0, N - 1), clamp(Math.floor(p[1] + N / 2), 0, N - 1)));
  news('Tornado tears through the city');
  sfx.alarm();
}
function updateTornado(dt) {
  if (!tornado) return;
  tornado.t += dt;
  tornado.x += tornado.dx * dt * 2.2 + Math.sin(tornado.t * 2) * dt;
  tornado.z += tornado.dz * dt * 2.2 + Math.cos(tornado.t * 1.7) * dt;
  tornadoMesh.position.set(tornado.x, 0, tornado.z);
  tornadoMesh.rotation.y += dt * 9;
  const x = Math.floor(tornado.x + N / 2), y = Math.floor(tornado.z + N / 2);
  if (inside(x, y)) {
    const k = idx(x, y);
    if (city.level[k] || city.tree[k] || city.pline[k]) { city.level[k] = 0; city.tree[k] = 0; city.pline[k] = 0; layersDirty = buildingsDirty = true; emit(wx(x), 0.4, wz(y), 0x8a7a6a, 10, 1.6, 2, 1); }
  }
  emit(tornado.x, 0.2, tornado.z, 0x9aa0a8, 2, 1.4, 1, 0.8, -0.5);
  if (tornado.t > 22 || Math.abs(tornado.x) > N / 2 + 3 || Math.abs(tornado.z) > N / 2 + 3) { tornado = null; tornadoMesh.visible = false; recompute(); }
}
function earthquake() {
  quakeT = 2.5;
  advise('Earthquake!', true);
  news('Earthquake rocks the city');
  sfx.quake();
  for (let k = 0; k < NN; k++) {
    if (city.level[k] && rnd() < 0.04) { city.level[k] = Math.max(0, city.level[k] - 1); emit(wx(k % N), 0.3, wz((k / N) | 0), 0xb8a888, 8, 1, 1.4, 1); }
    if (city.pline[k] && rnd() < 0.05) city.pline[k] = 0;
  }
  for (let n = 0; n < 6; n++) ignite((rnd() * NN) | 0, true);
  layersDirty = buildingsDirty = true;
  recompute();
}
function meltdown(s) {
  const cx = s.x + 1, cy = s.y + 1;
  city.structs.splice(city.structs.indexOf(s), 1);
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) if (inside(x, y) && Math.hypot(x - cx, y - cy) <= 4) { const k = idx(x, y); rad[k] = 1; ignite(k, true); }
  structsDirty = layersDirty = buildingsDirty = true;
  advise('NUCLEAR MELTDOWN! The area is contaminated.', true, idx(cx, cy));
  news('Meltdown! Officials blame budget cuts');
  sfx.alarm();
  for (let i = 0; i < 6; i++) emit(wx(cx), 1, wz(cy), 0xbfff80, 20, 3, 3, 2, 0.4);
  recompute();
}

// ------------------------------------------------------------------ building actions
function rectCells(a, b) {
  const out = [];
  for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) out.push([x, y]);
  return out;
}
function lineCells(a, b) {
  // An L-shaped run: along the longer axis first, then the shorter one.
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
  return { x: clamp(x - Math.floor((s.w - 1) / 2), 0, N - s.w), y: clamp(y - Math.floor((s.h - 1) / 2), 0, N - s.h), w: s.w, h: s.h };
}
function plan(toolId, a, b) {
  const t = TOOL[toolId];
  const cells = [];
  let cost = 0;
  const free = (k) => occ[k] < 0 && !city.level[k];
  if (toolId === 'road' || toolId === 'avenue') {
    const want = toolId === 'avenue' ? 2 : 1;
    for (const [x, y] of lineCells(a, b)) {
      const k = idx(x, y);
      const ok = free(k);
      if (ok && city.road[k] < want) cost += (t.cost - (city.road[k] ? TOOL.road.cost : 0)) * (city.terrain[k] ? 3 : 1);
      cells.push([x, y, ok]);
    }
  } else if (toolId === 'line' || toolId === 'pipe') {
    const key = toolId === 'line' ? 'pline' : 'pipe';
    for (const [x, y] of lineCells(a, b)) {
      const k = idx(x, y);
      const ok = toolId === 'pipe' ? true : occ[k] < 0 && !city.zone[k];
      if (ok && !city[key][k]) cost += t.cost * (city.terrain[k] ? 3 : 1);
      cells.push([x, y, ok]);
    }
  } else if (t.zone) {
    for (const [x, y] of rectCells(a, b)) {
      const k = idx(x, y);
      const ok = !city.terrain[k] && !city.road[k] && occ[k] < 0 && !city.pline[k] && (!city.level[k] || city.zone[k] === t.zone);
      if (ok && city.zone[k] !== t.zone) cost += t.cost;
      cells.push([x, y, ok]);
    }
  } else if (toolId === 'dezone') {
    for (const [x, y] of rectCells(a, b)) { const k = idx(x, y); const ok = !!city.zone[k]; if (ok) cost += t.cost * (1 + city.level[k]); cells.push([x, y, ok]); }
  } else if (toolId === 'bulldoze') {
    for (const [x, y] of rectCells(a, b)) {
      const k = idx(x, y);
      const any = underground ? city.pipe[k] : city.road[k] || city.zone[k] || city.tree[k] || occ[k] >= 0 || city.pline[k];
      if (any) cost += city.level[k] || occ[k] >= 0 ? t.cost * 2 : city.tree[k] && !city.road[k] ? 1 : t.cost;
      cells.push([x, y, !!any]);
    }
  } else if (t.struct) {
    const f = structFootprint(t.struct, b[0], b[1]);
    let ok = true;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) { const k = idx(x, y); if (city.terrain[k] || city.road[k] || occ[k] >= 0 || city.level[k] || rad[k] > 0.2) ok = false; }
    if (t.struct === 'pump' && ok && !nearWater(f)) ok = false;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) cells.push([x, y, ok]);
    return { cells, cost: t.cost, footprint: f, ok };
  }
  return { cells, cost };
}
const lockedTool = (t) => t.pop && stats.pop < t.pop;
function touchesGrid(s) {
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    if (!inside(x, y) || (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
    const k = idx(x, y);
    if (city.pline[k] || city.zone[k] || (occ[k] >= 0 && city.structs[occ[k]] !== s)) return true;
  }
  return false;
}
function commit(toolId, a, b) {
  const t = TOOL[toolId];
  if (lockedTool(t)) { toast(`${t.name} unlocks at ${fmt(t.pop)} people`); sfx.deny(); return false; }
  const p = plan(toolId, a, b);
  if (p.cost > city.funds) { toast('Not enough money'); sfx.deny(); return false; }
  if (t.struct && !p.ok) { toast(t.struct === 'pump' ? 'Pumps go right beside fresh water' : 'Needs clear dry land'); sfx.deny(); return false; }
  let did = false;
  for (const [x, y, ok] of p.cells) {
    if (!ok) continue;
    const k = idx(x, y);
    if (toolId === 'road' || toolId === 'avenue') { const want = toolId === 'avenue' ? 2 : 1; if (city.road[k] < want) { city.road[k] = want; city.zone[k] = 0; city.tree[k] = 0; did = true; } }
    else if (toolId === 'line') { if (!city.pline[k]) { city.pline[k] = 1; city.tree[k] = 0; did = true; } }
    else if (toolId === 'pipe') { if (!city.pipe[k]) { city.pipe[k] = 1; did = true; } }
    else if (t.zone) { if (city.zone[k] !== t.zone) { city.zone[k] = t.zone; city.level[k] = 0; city.tree[k] = 0; did = true; } }
    else if (toolId === 'dezone') { city.zone[k] = 0; city.level[k] = 0; did = true; }
    else if (toolId === 'bulldoze') {
      if (underground) { city.pipe[k] = 0; did = true; continue; }
      if (occ[k] >= 0) { city.structs.splice(occ[k], 1); rebuildOcc(); structsDirty = true; }
      city.road[k] = 0; city.zone[k] = 0; city.level[k] = 0; city.tree[k] = 0; city.pline[k] = 0; burn[k] = 0; did = true;
      emit(wx(x), 0.2, wz(y), 0xb8a888, 6, 0.8, 1.2, 0.7);
    }
  }
  if (t.struct) {
    const f = p.footprint;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) { const k = idx(x, y); city.zone[k] = 0; city.tree[k] = 0; city.pline[k] = 0; }
    const s = { type: t.struct, ...f };
    city.structs.push(s);
    structsDirty = true; did = true;
    emit(wx(f.x) + (f.w - 1) / 2, 0.5, wz(f.y) + (f.h - 1) / 2, 0xfff3c4, 20, 1.6, 2, 1);
    rebuildOcc();
    if (STRUCT[s.type].power && !touchesGrid(s)) setTimeout(() => toast('Run power lines from it to your zones'), 300);
    else if (STRUCT[s.type].water) setTimeout(() => toast('Lay pipes from it under your buildings'), 300);
    else if (STRUCT[s.type].powered && !touchesGrid(s)) setTimeout(() => toast('It needs power: connect it with a power line'), 300);
  }
  if (!did) return false;
  city.funds -= p.cost;
  recompute();
  layersDirty = buildingsDirty = true;
  if (toolId === 'bulldoze' || toolId === 'dezone') sfx.bulldoze(); else if (['road', 'avenue', 'line', 'pipe'].includes(toolId)) sfx.road(); else if (t.zone) sfx.zone(); else sfx.build();
  showCost(p.cost);
  updateHud();
  return true;
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
let gesture = null, press = null, tool = 'inspect', mode = 'menu', speed = 1, cat = 'roads';
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => {
  try { cvs.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) {
    const t = tileAt(e.clientX, e.clientY);
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, start: t, end: t, paint: tool !== 'inspect' && mode === 'play' && !!t };
    if (press.paint) showPreview();
  } else if (press) { press = null; clearPreview(); }
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
      rig.viewGoal = clamp(rig.viewGoal * (gesture.dist / dist), 6, 46);
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
cvs.addEventListener('wheel', (e) => { e.preventDefault(); rig.viewGoal = clamp(rig.viewGoal * (e.deltaY > 0 ? 1.12 : 0.89), 6, 46); }, { passive: false });
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
  const t = TOOL[tool];
  const okCol = tool === 'bulldoze' || tool === 'dezone' ? 0xff8a3a : t.zone ? ZONE_COL[t.zone] : tool === 'line' ? 0xffd23f : tool === 'pipe' ? 0x3f9bff : 0xffffff;
  for (const [x, y, ok] of p.cells) {
    put(previewMesh, n, wx(x), 0.12, wz(y), 0, 0.96, 1, 0.96);
    previewMesh.setColorAt(n++, tc.set(ok ? okCol : 0xe0403a));
  }
  previewMesh.count = n;
  previewMesh.instanceMatrix.needsUpdate = true;
  if (previewMesh.instanceColor) previewMesh.instanceColor.needsUpdate = true;
  const tip = $('costtip');
  tip.hidden = !p.cost && tool !== 'bulldoze';
  tip.textContent = p.cost ? money(p.cost) : 'Nothing to clear';
  tip.classList.toggle('bad', p.cost > city.funds || (t.struct && !p.ok));
}
function clearPreview() { previewMesh.count = 0; $('costtip').hidden = true; }

// ------------------------------------------------------------------ inspect card
let inspected = -1;
function inspect([x, y]) {
  const k = idx(x, y);
  inspected = k;
  const yes = (b) => (b ? '<b class="ok">✓</b>' : '<b class="no">✗</b>');
  const bar = (label, v, good = true) => {
    const g = good ? v : 1 - v;
    return `<div class="meter"><span>${label}</span><i><em style="width:${Math.round(v * 100)}%;background:${g > 0.5 ? '#3fbf5a' : g > 0.25 ? '#f5c542' : '#e0403a'}"></em></i></div>`;
  };
  let title = 'Open land', sub = '', body = '';
  if (occ[k] >= 0) {
    const s = city.structs[occ[k]], d = STRUCT[s.type];
    title = d.name;
    sub = d.power ? `Makes ${fmt(d.power)} MW · city uses ${fmt(stats.powerUse)} of ${fmt(stats.powerCap)}`
      : d.water ? `Supplies ${fmt(d.water)} · city uses ${fmt(stats.waterUse)} of ${fmt(stats.waterCap)}`
      : d.garbage ? `Handles ${fmt(d.garbage)} t · city makes ${fmt(stats.garbage)} of ${fmt(stats.garbageCap)}`
      : `Serves a radius of ${d.radius} tiles`;
    body = `<div class="row"><span>Upkeep</span><b>${money(d.upkeep * fundMul(d.dept))}/mo</b>${d.powered ? `<span>Power</span>${yes(power[k])}` : ''}</div>`;
    if (s.type === 'pump' && !nearWater(s)) body += '<p class="warn">Not beside water!</p>';
    if (d.power && !touchesGrid(s)) body += '<p class="warn">Not connected: run power lines to your zones.</p>';
    if (d.water && !pipeLive.some((v) => v)) body += '<p class="warn">No pipes connected yet.</p>';
  } else if (city.road[k]) {
    title = city.terrain[k] ? (city.road[k] === 2 ? 'Avenue bridge' : 'Bridge') : city.road[k] === 2 ? 'Avenue' : 'Street';
    sub = `Traffic at ${Math.round(cong[k] * 100)}% of capacity`;
    body = bar('Congestion', clamp(cong[k], 0, 1), false) + (city.pline[k] ? '<p>A power line runs along it.</p>' : '') + (city.pipe[k] ? '<p>A water pipe runs underneath.</p>' : '');
  } else if (city.zone[k]) {
    const z = city.zone[k], L = city.level[k];
    title = z === I && L === 3 && city.hitech[k] ? 'High-tech campus' : LEVEL_NAME[z][L];
    sub = `${ZONE_NAME[z]} · level ${L}/3`;
    body = `<div class="row"><span>${z === R ? 'Residents' : 'Jobs'}</span><b>${fmt(CAP[z][L])}</b>${z === R && L ? `<span>Commute</span><b>${jobless[k] ? '—' : `${Math.round(commute[k] * 2)} min`}</b>` : ''}</div>
      <div class="row"><span>Road</span>${yes(nearRoad[k] >= 0)}<span>Power</span>${yes(power[k])}<span>Water</span>${yes(water[k])}</div>
      ${bar('Land value', lv[k])}${bar('Pollution', pol[k], false)}${bar('Crime', crime[k], false)}${z === R ? bar('Health', cov.health[k]) + bar('Education', cov.edu[k]) : ''}`;
    const why = [];
    if (burn[k] > 0) why.push('ON FIRE!');
    if (nearRoad[k] < 0) why.push('needs a road within 3 tiles');
    if (!power[k]) why.push('needs power (power lines)');
    if (L >= 1 && !water[k]) why.push('needs water (pipes) to grow');
    if (z === R && L && jobless[k]) why.push('no jobs reachable by road');
    if (trash[k] > 4) why.push('garbage is piling up');
    if (L >= 1 && lv[k] < 0.3) why.push('land value too low');
    if (L === 2 && stats.pop < 1200) why.push(`high-rises come at ${fmt(1200)} people`);
    if (L === 2 && z === R && cov.edu[k] < 0.2) why.push('needs a school nearby');
    if (L === 2 && z === R && cov.health[k] < 0.1) why.push('needs a clinic nearby');
    if (rad[k] > 0.2) why.push('radioactive!');
    if (why.length) body += `<p class="warn">${why.join(' · ')}</p>`;
  } else if (city.pline[k]) { title = 'Power line'; sub = power[k] ? 'Live' : 'Dead: not connected to a plant'; }
  else if (city.terrain[k]) { title = 'River'; sub = 'Pumps beside fresh water supply the city.'; }
  else if (city.tree[k]) { title = 'Woods'; sub = 'Trees soak up a little pollution.'; }
  if (city.pipe[k] && !city.road[k]) sub += ' · pipe below';
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
  for (let tries = 0; tries < 20; tries++) {
    const k = (rnd() * NN) | 0;
    if (!city.road[k] || rnd() > 0.15 + cong[k]) continue;
    const x = k % N, y = (k / N) | 0, dirs = roadDirs(x, y);
    if (!dirs.length) return;
    const [dx, dy] = dirs[(rnd() * dirs.length) | 0];
    cars.push({ x, y, dx, dy, t: rnd(), sp: 0.9 + rnd() * 0.5, col: carColors[(rnd() * carColors.length) | 0], lane: rnd() < 0.5 ? 0 : 1 });
    return;
  }
}
function updateCars(dt) {
  let total = 0;
  for (let k = 0; k < NN; k++) total += traffic[k];
  const want = Math.min(250, Math.floor(total / 60) + Math.floor(stats.jobsC / 30));
  if (cars.length < want && rnd() < 0.5) spawnCar();
  if (cars.length > want) cars.pop();
  let n = 0;
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    const k = idx(c.x, c.y);
    if (!city.road[k]) { cars.splice(i, 1); continue; }
    c.t += (c.sp * dt * (speed ? Math.min(speed, 2) : 0)) / (1 + Math.max(0, cong[k] - 0.5) * 2);
    if (c.t >= 1) {
      const nx = c.x + c.dx, ny = c.y + c.dy;
      if (!isRoad(nx, ny)) { c.dx = -c.dx; c.dy = -c.dy; c.t = 0; continue; }
      c.x = nx; c.y = ny; c.t -= 1;
      const dirs = roadDirs(nx, ny).filter(([a, b]) => !(a === -c.dx && b === -c.dy));
      if (dirs.length) [c.dx, c.dy] = dirs[(rnd() * dirs.length) | 0]; else { c.dx = -c.dx; c.dy = -c.dy; }
    }
    const lane = city.road[idx(c.x, c.y)] === 2 ? (c.lane ? 0.32 : 0.16) : 0.14;
    const px = wx(c.x) + c.dx * (c.t - 0.5), pz = wz(c.y) + c.dy * (c.t - 0.5);
    put(carMesh, n, px - c.dy * lane, 0.03, pz + c.dx * lane, Math.atan2(c.dx, c.dy));
    carMesh.setColorAt(n++, tc.set(c.col));
  }
  carMesh.count = n;
  carMesh.instanceMatrix.needsUpdate = true;
  if (carMesh.instanceColor) carMesh.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------ day and night
const SKY = [[-1, '#0e1630', '#04070f'], [-0.08, '#1d2a52', '#0b1020'], [0.05, '#ffb98a', '#7a6aa8'], [0.2, '#ffe2c0', '#8fcaf5'], [1, '#eaf6ff', '#8fcaf5']];
const lerpHex = (a, b, t) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
let skyT = 0;
function updateDay(dt) {
  if (mode === 'play') city.dayT = (city.dayT + (dt * speed) / 150) % 1;
  const ang = city.dayT * Math.PI * 2;
  const elev = Math.sin(ang);
  const day = clamp((elev + 0.08) / 0.3, 0, 1);
  nightU.value = 1 - clamp((elev + 0.02) / 0.22, 0, 1);
  sun.intensity = 0.15 + 2.3 * day;
  sun.color.set(elev < 0.25 ? 0xffc896 : 0xfff2dc);
  hemi.intensity = 0.35 + 0.85 * day;
  hemi.color.set(day > 0.5 ? 0xe8f4ff : 0x8a9ac8);
  sun.position.set(rig.target.x + Math.cos(ang) * 22, 6 + Math.max(elev, 0.15) * 26, rig.target.z + 12);
  sun.target.position.copy(rig.target);
  skyT -= dt;
  if (skyT <= 0) {
    skyT = 0.4;
    let i = 0;
    while (i < SKY.length - 2 && elev > SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[i + 1], t = clamp((elev - a[0]) / (b[0] - a[0]), 0, 1);
    document.body.style.setProperty('--sky1', lerpHex(a[1], b[1], t));
    document.body.style.setProperty('--sky2', lerpHex(a[2], b[2], t));
    $('clock').textContent = elev > 0.05 ? '☀️' : elev > -0.08 ? '🌇' : '🌙';
  }
}

// ------------------------------------------------------------------ icons
const ICON = {
  inspect: '<path d="M11 16V6.5a2 2 0 0 1 4 0V15m0-3.5a2 2 0 0 1 4 0V15m0-2a2 2 0 0 1 4 0v4c0 6-3.5 10-9 10-3.5 0-5.5-1.5-7.5-4.5L4.4 19a2 2 0 0 1 3.2-2.4L11 20" fill="#fff4e0" stroke="#3a2a1a" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
  road: '<path d="M10 3h12l6 26H4Z" fill="#454a57"/><path d="M16 5v4m0 4v4m0 4v4" stroke="#f6f2e2" stroke-width="2" stroke-linecap="round"/><path d="M10 3 4 29m18-26 6 26" stroke="#c9ccd1" stroke-width="1.6"/>',
  avenue: '<path d="M8 3h16l6 26H2Z" fill="#3a3e48"/><path d="M16 4v25" stroke="#6aa84a" stroke-width="3"/><path d="M11 6v4m-1 5v4m-1 5v4M21 6v4m1 5v4m1 5v4" stroke="#f6f2e2" stroke-width="1.6" stroke-linecap="round"/>',
  bulldoze: '<path d="M3 20h17v-7h5l4 7v4H3Z" fill="#f5b50f"/><path d="M3 24h26" stroke="#3a2a1a" stroke-width="2"/><circle cx="8" cy="26" r="2.6" fill="#3a3f50"/><circle cx="22" cy="26" r="2.6" fill="#3a3f50"/><path d="M2 9h6l2 8" fill="none" stroke="#9aa0a8" stroke-width="2.4" stroke-linejoin="round"/>',
  res: '<path d="M4 15 16 5l12 10v13H4Z" fill="#52c45a"/><path d="M2 16 16 4l14 12" fill="none" stroke="#2a7a30" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><path d="M13 28v-7h6v7" fill="#fff"/>',
  com: '<path d="M4 12h24v16H4Z" fill="#3f95ee"/><path d="M3 6h26l-2 7H5Z" fill="#e55a4f"/><path d="M7 16h8v6H7Z" fill="#cfe8ff"/><path d="M18 16h6v12h-6Z" fill="#fff"/>',
  ind: '<path d="M3 28V15l7 4v-4l7 4v-4l7 4V6h5v22Z" fill="#f0b93a"/><circle cx="25" cy="3" r="2" fill="#c7c0ae"/>',
  dezone: '<rect x="5" y="5" width="22" height="22" rx="3" fill="none" stroke="#9aa0a8" stroke-width="2.6" stroke-dasharray="4 3"/><path d="m11 11 10 10m0-10L11 21" stroke="#ff8f88" stroke-width="3" stroke-linecap="round"/>',
  line: '<path d="M8 29V5m16 24V5M3 8h10M19 8h10" stroke="#8a6a4a" stroke-width="2.4" stroke-linecap="round"/><path d="M4 8q12 6 24 0" fill="none" stroke="#2a2a2a" stroke-width="1.4"/><path d="m17 12-4 7h4l-3 7 7-9h-4l3-5Z" fill="#ffd23f"/>',
  coal: '<path d="M3 28V16h10v12Z" fill="#b7b0a4"/><path d="M16 28 18 8h6l2 20Z" fill="#e6e1d8"/><path d="M17.4 14h7.2M17 20h8" stroke="#d04a3a" stroke-width="2.4"/><circle cx="21" cy="5" r="3" fill="#9aa0a8"/><circle cx="25" cy="3" r="2" fill="#c0c5cc"/>',
  wind: '<path d="M16 14v15" stroke="#e6e9ee" stroke-width="2.6"/><path d="M16 13 15 2l3 11Zm0 0 10 6-11-4Zm0 0-9 7 8-8Z" fill="#fff" stroke="#9aa0a8" stroke-width=".8"/><circle cx="16" cy="13" r="1.8" fill="#9aa0a8"/>',
  gas: '<circle cx="11" cy="17" r="7" fill="#f2f2f2" stroke="#9aa0a8" stroke-width="1.4"/><circle cx="23" cy="20" r="5" fill="#f2f2f2" stroke="#9aa0a8" stroke-width="1.4"/><path d="M24 4c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7Z" fill="#4fb4ff"/>',
  solar: '<path d="M4 10h24l-3 12H7Z" fill="#21407a"/><path d="M10.5 10 9 22m7-12v12m5.5-12L23 22M5.5 16h21" stroke="#7fb2ff" stroke-width="1.2"/><path d="M16 22v6m-5 0h10" stroke="#9aa0a8" stroke-width="2.4" stroke-linecap="round"/><circle cx="26" cy="5" r="3" fill="#ffd23f"/>',
  nuclear: '<path d="M4 29c2-8 2-14 0-20h10c-2 6-2 12 0 20Z" fill="#e6e3dc" stroke="#9aa0a8" stroke-width="1.2"/><circle cx="23" cy="20" r="7" fill="#f5c542"/><path d="M23 20 20 15h6Zm0 0-6 1 3 5Zm0 0 3 5 3-5Z" fill="#2a2a2a"/><circle cx="23" cy="20" r="1.4" fill="#f5c542"/>',
  pipe: '<path d="M3 12h14a5 5 0 0 1 5 5v12" fill="none" stroke="#3f9bff" stroke-width="6"/><path d="M3 9v6m15 12h8" stroke="#2a6fc0" stroke-width="2.6" stroke-linecap="round"/><path d="M27 4c2 3 3 4.5 3 6a3 3 0 0 1-6 0c0-1.5 1-3 3-6Z" fill="#4fb4ff"/>',
  pump: '<path d="M16 3c5 7 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8 8-15Z" fill="#4fb4ff"/><path d="M12 19a4 4 0 0 0 4 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  tower: '<path d="M10 29 13 16m9 13-3-13" stroke="#9aa0a8" stroke-width="2.2"/><path d="M8 8h16v8H8Z" fill="#5aa6ea"/><path d="m7 8 9-5 9 5Z" fill="#3a7ac8"/>',
  police: '<path d="M16 3 27 7v8c0 7-5 12-11 14C10 27 5 22 5 15V7Z" fill="#2f5fc0"/><path d="m16 9 2 4 4.5.6-3.3 3 .9 4.4-4.1-2.3-4.1 2.3.9-4.4-3.3-3 4.5-.6Z" fill="#ffd23f"/>',
  fire: '<path d="M16 2c1 6 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 4-10 1 3 2 4 3 4 0-4 0-7 2-11Z" fill="#ff6a2a"/><path d="M16 15c3 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2-5 4-8Z" fill="#ffd23f"/>',
  clinic: '<rect x="4" y="4" width="24" height="24" rx="6" fill="#fff"/><path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5Z" fill="#e0403a"/>',
  hospital: '<path d="M3 29V9h26v20Z" fill="#fff"/><path d="M13 12h6v4h4v5h-4v4h-6v-4H9v-5h4Z" fill="#e0403a"/><path d="M3 9h26" stroke="#9aa0a8" stroke-width="2"/>',
  school: '<path d="M16 5 30 12l-14 7-14-7Z" fill="#3a3f50"/><path d="M8 15v7c0 2 4 4 8 4s8-2 8-4v-7l-8 4Z" fill="#545a70"/><path d="M28 12v9" stroke="#f5c542" stroke-width="2"/><circle cx="28" cy="22" r="1.8" fill="#f5c542"/>',
  university: '<path d="M3 12 16 4l13 8Z" fill="#7a5a48"/><path d="M5 13h22v14H5Z" fill="#d8c8a8"/><path d="M8 15v10m4-10v10m4-10v10m4-10v10m4-10v10" stroke="#fff" stroke-width="2"/><path d="M3 28h26" stroke="#7a5a48" stroke-width="2.4"/>',
  bus: '<rect x="5" y="5" width="22" height="20" rx="4" fill="#f5c542"/><path d="M8 9h16v7H8Z" fill="#3a4250"/><circle cx="10" cy="26" r="2.6" fill="#3a3f50"/><circle cx="22" cy="26" r="2.6" fill="#3a3f50"/>',
  park: '<circle cx="16" cy="12" r="9" fill="#3fbf5a"/><circle cx="11" cy="9" r="3" fill="#6fe07a"/><path d="M16 18v11" stroke="#7a5232" stroke-width="3" stroke-linecap="round"/><path d="M8 29h16" stroke="#2a7a30" stroke-width="2.4" stroke-linecap="round"/>',
  plaza: '<circle cx="9" cy="10" r="6" fill="#3fbf5a"/><circle cx="23" cy="10" r="6" fill="#3fbf5a"/><ellipse cx="16" cy="23" rx="10" ry="5" fill="#5ab4ea" stroke="#cfc8bb" stroke-width="2"/><path d="M16 23v-6" stroke="#cfc8bb" stroke-width="2"/>',
  landfill: '<path d="M2 28c3-8 7-12 11-12s5 3 7 3 5-3 10 9Z" fill="#7a6a4a"/><path d="m9 14 2-6 3 4m4-6 3 5" stroke="#5a4a30" stroke-width="2" fill="none"/><circle cx="24" cy="10" r="2" fill="#7a8a5a"/>',
  recycling: '<path d="m16 4 5 8h-4l3 5-7-1Z" fill="#3fbf5a"/><path d="m27 22-4 8-2-4-6 1 4-6Z" fill="#3fbf5a"/><path d="m5 22 4 7 3-3 4 4-6-12Z" fill="#3fbf5a"/>',
  cityhall: '<path d="M3 12 16 5l13 7Z" fill="#e6e1d6"/><path d="M5 12h22v14H5Z" fill="#f2ede2"/><path d="M8 14v10m5-10v10m6-10v10m5-10v10" stroke="#c9c2b2" stroke-width="2"/><path d="M3 27h26" stroke="#9a9488" stroke-width="2.4"/><circle cx="16" cy="9" r="2" fill="#6fa8c0"/>',
  stadium: '<ellipse cx="16" cy="18" rx="14" ry="9" fill="#e6e9ee"/><ellipse cx="16" cy="18" rx="10" ry="6" fill="#4fb04a"/><path d="M16 12v12" stroke="#fff" stroke-width="1.2"/>',
  landmark: '<path d="M13 29V12h6v17Z" fill="#7ab0d8"/><path d="M14.5 12V6h3v6Z" fill="#7ab0d8"/><path d="M16 1v5" stroke="#dfe5ec" stroke-width="1.6"/><path d="M10 29h12" stroke="#5a8ab8" stroke-width="2.4"/>',
  coin: '<circle cx="16" cy="16" r="13" fill="#f5c542"/><circle cx="16" cy="16" r="9.5" fill="none" stroke="#b07a10" stroke-width="1.6"/><path d="M19.5 11.5c-1-1-2.2-1.5-3.5-1.5-2 0-3.5 1-3.5 2.8 0 4 7.2 2.2 7.2 6.2 0 1.8-1.6 3-3.7 3-1.5 0-2.8-.5-3.8-1.6M16 8v16" fill="none" stroke="#7a4f00" stroke-width="2" stroke-linecap="round"/>',
  people: '<circle cx="11" cy="10" r="4.5" fill="#f0c39a"/><path d="M3 27c0-6 3.5-10 8-10s8 4 8 10Z" fill="#3b82f6"/><circle cx="22" cy="12" r="4" fill="#e8b48a"/><path d="M16 28c.5-5 3-8.5 6-8.5 4 0 7 3.5 7 8.5Z" fill="#52c45a"/>',
  pause: '<rect x="8" y="6" width="5.5" height="20" rx="1.5" fill="currentColor"/><rect x="18.5" y="6" width="5.5" height="20" rx="1.5" fill="currentColor"/>',
  play: '<path d="M10 6v20l16-10Z" fill="currentColor"/>',
  fast: '<path d="M4 7v18l12-9Zm12 0v18l12-9Z" fill="currentColor"/>',
  layers: '<path d="m16 4 13 7-13 7-13-7Z" fill="currentColor"/><path d="m3 16 13 7 13-7M3 21l13 7 13-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
  budget: '<rect x="3" y="8" width="26" height="18" rx="3" fill="currentColor"/><path d="M3 13h26" stroke="#1c2b4d" stroke-width="2.4"/><circle cx="22.5" cy="19.5" r="2.5" fill="#1c2b4d"/>',
  stats: '<path d="M5 27V17m7 10V9m7 18v-7m7 7V5" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
  menu: '<path d="M6 9h20M6 16h20M6 23h20" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
  rotl: '<path d="M8 14a9 9 0 1 1 2.6 8.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="m3 9 5 7 6-5Z" fill="currentColor"/>',
  rotr: '<path d="M24 14a9 9 0 1 0-2.6 8.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="m29 9-5 7-6-5Z" fill="currentColor"/>',
  lock: '<rect x="8" y="14" width="16" height="13" rx="2.5" fill="currentColor"/><path d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="3"/>',
  sound: '<path d="M5 12h5l7-6v20l-7-6H5Z" fill="currentColor"/><path d="M21 11a6 6 0 0 1 0 10m3-14a11 11 0 0 1 0 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  muted: '<path d="M5 12h5l7-6v20l-7-6H5Z" fill="currentColor"/><path d="m21 12 7 8m0-8-7 8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  close: '<path d="m8 8 16 16M24 8 8 24" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>',
  smile: '<circle cx="16" cy="16" r="13" fill="#f5c542"/><circle cx="11.5" cy="13" r="1.8" fill="#5a3a00"/><circle cx="20.5" cy="13" r="1.8" fill="#5a3a00"/><path d="M10 19c3 4 9 4 12 0" fill="none" stroke="#5a3a00" stroke-width="2.2" stroke-linecap="round"/>',
};
const svg = (name) => `<svg viewBox="0 0 32 32" aria-hidden="true">${ICON[name] || ''}</svg>`;
function paintIcons(root = document) { for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = svg(el.dataset.icon); }
paintIcons();

// ------------------------------------------------------------------ UI: toolbar
function buildCats() {
  $('cats').innerHTML = `<button class="cat look${tool === 'inspect' ? ' active' : ''}" data-cat="look"><i class="ic" data-icon="inspect"></i><span>Look</span></button>`
    + CATS.map((c) => `<button class="cat${c.id === cat && tool !== 'inspect' ? ' active' : ''}" data-cat="${c.id}"><i class="ic" data-icon="${c.icon}"></i><span>${c.name}</span></button>`).join('');
  paintIcons($('cats'));
  for (const b of document.querySelectorAll('.cat')) b.addEventListener('click', () => {
    sfx.click();
    if (b.dataset.cat === 'look') { setTool('inspect', true); return; }
    cat = b.dataset.cat;
    buildToolbar();
    const first = TOOLS.find((t) => t.cat === cat && !lockedTool(t));
    if (first && (tool === 'inspect' || TOOL[tool].cat !== cat)) setTool(first.id, true); else buildCats();
  });
}
function buildToolbar() {
  $('tools').innerHTML = TOOLS.filter((t) => t.cat === cat).map((t) => {
    const locked = lockedTool(t);
    return `<button class="tool${locked ? ' locked' : ''}${t.id === tool ? ' active' : ''}" data-tool="${t.id}" aria-label="${t.name}">
      <i class="ic" data-icon="${locked ? 'lock' : t.id}"></i><span>${t.name}</span><em>${locked ? `${fmt(t.pop)} 👤` : t.cost ? money(t.cost) : 'Free'}</em></button>`;
  }).join('');
  paintIcons($('tools'));
  for (const b of document.querySelectorAll('.tool')) b.addEventListener('click', () => setTool(b.dataset.tool));
}
function setTool(id, quiet = false) {
  const t = TOOL[id];
  if (lockedTool(t)) { toast(`${t.name} unlocks at ${fmt(t.pop)} people`); sfx.deny(); return; }
  tool = id;
  if (t.cat && t.cat !== cat) { cat = t.cat; buildToolbar(); }
  for (const b of document.querySelectorAll('.tool')) b.classList.toggle('active', b.dataset.tool === id);
  $('hint').textContent = t.hint;
  $('dock').classList.toggle('looking', id === 'inspect');
  if (!quiet) sfx.click();
  if (id !== 'inspect') $('info').hidden = true;
  setUnderground(id === 'pipe' || overlay === 'water' || (underground && (id === 'bulldoze' || id === 'pump' || id === 'tower')));
  buildCats();
}
$('underground').addEventListener('click', () => { overlay = 'none'; if (tool === 'pipe') setTool('inspect', true); setUnderground(false); });

// ------------------------------------------------------------------ UI: hud and toasts
let toastTimer = 0, toastTile = -1;
function toast(msg, k = -1) {
  const t = $('toast');
  t.textContent = msg; toastTile = k;
  t.classList.toggle('go', k >= 0);
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
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
const dateStr = (m = city.month) => `${MONTHS[m % 12]} ${2000 + Math.floor(m / 12)}`;
function updateHud() {
  $('funds').textContent = money(city.funds);
  $('funds').classList.toggle('neg', city.funds < 0);
  const net = stats.income - stats.expense;
  $('delta').textContent = `${net >= 0 ? '+' : ''}${money(net)}/mo`;
  $('delta').classList.toggle('neg', net < 0);
  $('pop').textContent = fmt(stats.pop);
  $('cityname').textContent = city.name;
  $('date').textContent = dateStr();
  for (const [id, v] of [['dr', stats.dem.r], ['dc', stats.dem.c], ['di', stats.dem.i]]) {
    const el = $(id);
    el.style.height = `${Math.abs(v) * 50}%`;
    el.style.bottom = v >= 0 ? '50%' : `${50 - Math.abs(v) * 50}%`;
    el.classList.toggle('neg', v < 0);
  }
  $('approval').textContent = `${Math.round(city.approval)}%`;
  $('approval').className = city.approval >= 60 ? 'ok' : city.approval >= 40 ? 'mid' : 'no';
  $('rank').textContent = MILESTONES[city.rank][1];
  const next = MILESTONES[city.rank + 1];
  $('next').textContent = next ? `${fmt(next[0] - stats.pop)} to ${next[1]}` : 'Top of the world';
  for (const b of document.querySelectorAll('.tool')) {
    const t = TOOL[b.dataset.tool];
    b.classList.toggle('poor', t.cost > city.funds);
    if (b.classList.contains('locked') && !lockedTool(t)) { buildToolbar(); break; }
  }
}
function setSpeed(s) { speed = s; for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('active', +b.dataset.speed === s); }
for (const b of document.querySelectorAll('[data-speed]')) b.addEventListener('click', () => { setSpeed(+b.dataset.speed); sfx.click(); });
$('rot-l').addEventListener('click', () => rotate(-1));
$('rot-r').addEventListener('click', () => rotate(1));

// ------------------------------------------------------------------ sheets
function openSheet(id) { for (const s of ['budget', 'layers', 'stats', 'pause']) $(s).hidden = s !== id; sfx.click(); }
for (const id of ['budget', 'layers', 'stats', 'pause']) $(`${id}-close`).addEventListener('click', () => { $(id).hidden = true; });
$('b-layers').addEventListener('click', () => {
  $('layers-list').innerHTML = Object.entries(OVERLAYS).map(([k, o]) => `<button class="opt${overlay === k ? ' active' : ''}" data-ov="${k}">${o.name}</button>`).join('');
  for (const b of document.querySelectorAll('[data-ov]')) b.addEventListener('click', () => { setOverlay(b.dataset.ov); $('layers').hidden = true; });
  openSheet('layers');
});
function setOverlay(k) {
  overlay = k;
  setUnderground(k === 'water' || tool === 'pipe');
  const showLegend = k !== 'none' && k !== 'water';
  $('legend').hidden = !showLegend;
  $('legend').innerHTML = showLegend ? `<b>${OVERLAYS[k].name}</b> ${OVERLAYS[k].legend} <button id="legend-x" aria-label="Hide overlay">${svg('close')}</button>` : '';
  if (showLegend) $('legend-x').addEventListener('click', () => setOverlay('none'));
  layoutOverlay();
}
let budgetTab = 'money';
function renderBudget() {
  for (const b of document.querySelectorAll('[data-btab]')) b.classList.toggle('active', b.dataset.btab === budgetTab);
  const el = $('budget-body');
  if (budgetTab === 'money') {
    const L = stats.lines || { roads: 0, services: 0, ords: 0, loans: 0 };
    const owed = city.loans.reduce((a, l) => a + l.pay * l.left, 0);
    el.innerHTML = `
      <h4>Taxes</h4>
      ${['r', 'c', 'i'].map((z) => `<div class="slider"><label>${{ r: 'Residential', c: 'Commercial', i: 'Industrial' }[z]} <b id="tv-${z}">${city.tax[z]}%</b></label><input type="range" min="0" max="20" value="${city.tax[z]}" data-tax="${z}" /></div>`).join('')}
      <h4>Departments</h4>
      ${DEPTS.map(([d, n]) => `<div class="slider"><label>${n} <b id="fv-${d}">${city.fund[d]}%</b></label><input type="range" min="0" max="150" step="10" value="${city.fund[d]}" data-fund="${d}" /></div>`).join('')}
      <h4>Last month</h4>
      <div class="rows">
        <div class="row"><span>Taxes</span><b class="ok">+${money(stats.income)}</b></div>
        <div class="row"><span>Roads, lines and pipes</span><b class="no">-${money(L.roads)}</b></div>
        <div class="row"><span>Services and utilities</span><b class="no">-${money(L.services)}</b></div>
        <div class="row"><span>Policies</span><b class="${L.ords > 0 ? 'no' : 'ok'}">${L.ords > 0 ? '-' : '+'}${money(Math.abs(L.ords))}</b></div>
        <div class="row"><span>Loan payments</span><b class="no">-${money(L.loans)}</b></div>
        <div class="row total"><span>Net</span><b class="${stats.income - stats.expense >= 0 ? 'ok' : 'no'}">${money(stats.income - stats.expense)}</b></div>
      </div>
      <h4>Loans</h4>
      <p class="fine">${city.loans.length ? `${city.loans.length} loan(s), ${money(owed)} still owed.` : 'No loans.'} A $10,000 loan costs $105 a month for 10 years.</p>
      <button id="take-loan" class="btn stone" ${city.loans.length >= 3 ? 'disabled' : ''}>Take a $10,000 loan</button>`;
    for (const r of el.querySelectorAll('[data-tax]')) r.addEventListener('input', (e) => { city.tax[r.dataset.tax] = +e.target.value; $(`tv-${r.dataset.tax}`).textContent = `${e.target.value}%`; computeTotals(); updateHud(); });
    for (const r of el.querySelectorAll('[data-fund]')) r.addEventListener('input', (e) => { city.fund[r.dataset.fund] = +e.target.value; $(`fv-${r.dataset.fund}`).textContent = `${e.target.value}%`; });
    $('take-loan').addEventListener('click', () => { if (city.loans.length >= 3) return; city.loans.push({ pay: 105, left: 120 }); city.funds += 10000; news('City takes out a $10,000 loan'); sfx.build(); renderBudget(); updateHud(); });
  } else {
    el.innerHTML = '<p class="fine">Policies cost (or earn) money every month, scaled by population.</p>' + ORDINANCES.map((o) => {
      const c = o.base + (o.per * stats.pop) / 1000;
      return `<label class="ord"><input type="checkbox" data-ord="${o.id}" ${city.ord[o.id] ? 'checked' : ''}/><span><b>${o.name}</b><small>${o.desc}</small></span><em class="${c > 0 ? 'no' : 'ok'}">${c > 0 ? '-' : '+'}${money(Math.abs(c))}/mo</em></label>`;
    }).join('');
    for (const c of el.querySelectorAll('[data-ord]')) c.addEventListener('change', () => { city.ord[c.dataset.ord] = c.checked; sfx.click(); recompute(); layersDirty = true; });
  }
}
for (const b of document.querySelectorAll('[data-btab]')) b.addEventListener('click', () => { budgetTab = b.dataset.btab; renderBudget(); sfx.click(); });
$('b-budget').addEventListener('click', () => { renderBudget(); openSheet('budget'); });
function renderStats() {
  $('st-approval').textContent = `${Math.round(city.approval)}%`;
  $('st-factors').innerHTML = Object.entries(stats.factors).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, b) => a[1] - b[1])
    .map(([k, v]) => `<div class="row"><span>${k}</span><b class="${v >= 0 ? 'ok' : 'no'}">${v >= 0 ? '+' : ''}${v.toFixed(0)}</b></div>`).join('') || '<p class="fine">Build a city first!</p>';
  const util = (u, c) => `${fmt(u)} / ${fmt(c)}`;
  $('st-util').innerHTML = `<div class="row"><span>Power</span><b>${util(stats.powerUse, stats.powerCap)}</b></div><div class="row"><span>Water</span><b>${util(stats.waterUse, stats.waterCap)}</b></div><div class="row"><span>Garbage</span><b>${util(stats.garbage, stats.garbageCap)}</b></div><div class="row"><span>Jobs</span><b>${fmt(stats.jobsC + stats.jobsI)}</b></div><div class="row"><span>Traffic</span><b>${Math.round(stats.avgCong * 100)}%</b></div>`;
  drawGraph($('graph-pop'), 0, '#6ee07a', 'Population');
  drawGraph($('graph-funds'), 1, '#ffd060', 'Funds');
  $('st-news').innerHTML = city.news.slice(0, 10).map((n) => `<li><small>${dateStr(n.m)}</small>${n.text}</li>`).join('') || '<li>No news yet.</li>';
}
function drawGraph(canvas, col, color, label) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 90;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);
  const data = city.history.map((d) => d[col]);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '700 11px Nunito, sans-serif';
  if (data.length < 2) { g.fillText(`${label}: not enough history yet`, 8, 18); return; }
  const min = Math.min(0, ...data), max = Math.max(1, ...data);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
  for (let i = 0; i <= 3; i++) { g.beginPath(); g.moveTo(0, 6 + (i * (h - 12)) / 3); g.lineTo(w, 6 + (i * (h - 12)) / 3); g.stroke(); }
  g.beginPath();
  data.forEach((v, i) => { const x = (i / (data.length - 1)) * w, y = h - 6 - ((v - min) / (max - min)) * (h - 12); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.strokeStyle = color; g.lineWidth = 2.4; g.stroke();
  g.fillText(`${label}: ${col === 1 ? money(data[data.length - 1]) : fmt(data[data.length - 1])}`, 8, 16);
}
$('b-stats').addEventListener('click', () => { openSheet('stats'); renderStats(); });
$('b-menu').addEventListener('click', () => { $('dis-toggle').checked = city.disasters; $('dis-meltdown').hidden = !city.structs.some((s) => s.type === 'nuclear'); openSheet('pause'); });
$('dis-toggle').addEventListener('change', (e) => { city.disasters = e.target.checked; });
$('dis-fire').addEventListener('click', () => { const dev = []; for (let k = 0; k < NN; k++) if (city.level[k]) dev.push(k); if (dev.length) ignite(dev[(rnd() * dev.length) | 0]); $('pause').hidden = true; });
$('dis-tornado').addEventListener('click', () => { startTornado(); $('pause').hidden = true; });
$('dis-quake').addEventListener('click', () => { earthquake(); $('pause').hidden = true; });
$('dis-meltdown').addEventListener('click', () => { const s = city.structs.find((x) => x.type === 'nuclear'); if (s) meltdown(s); $('pause').hidden = true; });
$('to-title').addEventListener('click', () => { save(); $('pause').hidden = true; showMenu(); });
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
const pack = (a) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i] + 48); return s; };
const unpack = (s, a) => { for (let i = 0; i < a.length; i++) a[i] = (s.charCodeAt(i) || 48) - 48; };
const META = ['seed', 'name', 'funds', 'month', 'rank', 'approval', 'dayT', 'disasters', 'tax', 'fund', 'loans', 'ord', 'history', 'news'];
function save() {
  if (!city.road.some((v) => v) && !city.structs.length) return;
  const out = { v: 2, n: N };
  for (const k of META) out[k] = city[k];
  out.structs = city.structs.map(({ type, x, y, w, h }) => ({ type, x, y, w, h }));
  for (const k of LAYERS) out[k] = k === 'variant' ? Array.from(city[k]) : pack(city[k]);
  store.set('polis.save', out);
}
function load() {
  const s = store.get('polis.save', null);
  if (!s) return false;
  if (s.v === 1) return migrateV1(s);
  if (s.v !== 2 || s.n !== N) return false;
  for (const k of META) if (s[k] !== undefined) city[k] = s[k];
  city.structs = s.structs;
  for (const k of LAYERS) { if (k === 'variant') city[k].set(s[k]); else unpack(s[k], city[k]); }
  return true;
}
// Cities from version 1 (32×32, power and water through roads) move into the
// middle of the new map, with power lines and pipes laid along their roads.
function migrateV1(s) {
  const M = 32, off = (N - M) / 2;
  generateMap(s.seed);
  for (const k of ['road', 'zone', 'level', 'pline', 'pipe', 'hitech']) city[k].fill(0);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const j = y * M + x, k = idx(x + off, y + off);
    city.terrain[k] = s.terrain[j]; city.road[k] = s.road[j]; city.zone[k] = s.zone[j]; city.level[k] = s.level[j];
    city.variant[k] = s.variant[j]; city.tree[k] = s.tree[j]; city.pline[k] = s.road[j]; city.pipe[k] = s.road[j];
  }
  Object.assign(city, { seed: s.seed, name: s.name, funds: s.funds, month: s.month, rank: s.rank, tax: { r: s.tax, c: s.tax, i: s.tax } });
  city.structs = s.structs.map((t) => ({ type: t.type, x: t.x + off, y: t.y + off, w: t.w, h: t.h }));
  setTimeout(() => toast('Polis 2: power lines and pipes were laid along your roads.'), 1500);
  return true;
}
function resetWorld() {
  burn.fill(0); unhappy.fill(0); anim.fill(1); trash.fill(0); rad.fill(0); cars.length = 0;
  computeDistLand();
  buildGround();
  recompute();
  computeApproval();
  layersDirty = buildingsDirty = structsDirty = true;
  rig.target.set(0, 0, 0); rig.viewGoal = 18;
  buildCats(); buildToolbar();
  setOverlay('none');
  updateHud();
}
function newCity() {
  const seed = (Date.now() % 100000) + 1;
  Object.assign(city, { seed, name: CITY_NAMES[seed % CITY_NAMES.length], funds: 25000, month: 0, rank: 0, approval: 60, dayT: 0.3, structs: [], loans: [], ord: {}, history: [], news: [], tax: { r: 9, c: 9, i: 9 }, fund: { police: 100, fire: 100, health: 100, education: 100, transport: 100 } });
  for (const k of ['road', 'zone', 'level', 'pline', 'pipe', 'hitech']) city[k].fill(0);
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
  if (city.month === 0 && !city.road.some((v) => v)) setTimeout(() => toast('Welcome, Mayor! Open Roads and drag to build your first street.'), 500);
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
    quake: () => { noise(2, 160, 0.9); tone(45, 30, 1.8, 'sine', 0.5); },
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
  updateDay(dt);
  updateTornado(dt);
  if (quakeT > 0) { quakeT -= dt; rig.shake = quakeT; } else rig.shake = 0;
  updateCamera(dt);
  if (structsDirty) { structsDirty = false; layoutStructs(); buildingsDirty = true; }
  if (layersDirty) { layersDirty = false; layoutLayers(); layoutMarkers(); layoutOverlay(); }
  if (buildingsDirty || animating) {
    buildingsDirty = false;
    for (let k = 0; k < NN; k++) if (anim[k] < 1) anim[k] = Math.min(1, anim[k] + dt * 1.6);
    layoutBuildings();
  }
  markerMesh.position.y = Math.sin(t * 3) * 0.06;
  zoneMesh.material.opacity = 0.45 * (1 - nightU.value * 0.6);
  overlayMesh.material.opacity = 0.62 * (1 - nightU.value * 0.35);
  for (const g of structGroup.children) for (const c of g.children) if (c.userData.spin) c.rotation.z += dt * 3;
  if (!underground) {
    for (const c of smokeList) if (rnd() < dt * (1.4 + (city.level[c.k] || 0) * 0.4)) emit(c.v.x, c.v.y, c.v.z, 0xd0d0d0, 1, 0.15, 0.5, 1.8, -0.12);
    for (const c of structSmoke) if (rnd() < dt * (c.big === 2 ? 7 : 4)) emit(c.v.x, c.v.y, c.v.z, c.big === 2 ? 0xf4f6f8 : 0xb8b8b8, 1, c.big === 2 ? 0.5 : 0.15, 0.6, c.big === 2 ? 2.4 : 2.6, -0.15);
    for (let k = 0; k < NN; k++) if (burn[k] > 0 && rnd() < dt * 12) emit(wx(k % N) + (rnd() - 0.5) * 0.6, 0.3 + rnd() * 0.5, wz((k / N) | 0) + (rnd() - 0.5) * 0.6, rnd() < 0.6 ? 0xff7a1a : 0x555555, 1, 0.3, 1.4, 0.9, -0.2);
  }
  updateCars(dt);
  updateParticles(dt);
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
  city, stats, monthTick, commit, recompute, setTool, setOverlay, newCity, play, save, load, rig, power, water, lv, pol, crime, cong, jobless, nightU,
  get mode() { return mode; }, plan, inspect, startTornado, earthquake, setUnderground, renderStats, renderBudget,
};
