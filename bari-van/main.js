import * as THREE from '../vendor/three.module.js';

// =====================================================================
// Bari Van Run: drive the 9-seater on the Bari → Alberobello → Matera →
// Bari day trip. Sharp turns open the sliding doors and passengers fly out;
// potholes, bumps and crashes pop the rear doors. Pick people back up.
// =====================================================================

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

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

// ------------------------------------------------------------------ trip
const LEGS = [
  { from: 'BARI', to: 'ALBEROBELLO', depart: 8 * 60 + 30, arrive: 9 * 60 + 30, km: 55, stay: '09:30 – 12:00', note: 'Τρούλι, καφές και φωτογραφίες', sky: 'morning' },
  { from: 'ALBEROBELLO', to: 'MATERA', depart: 12 * 60, arrive: 13 * 60 + 15, km: 70, stay: '14:30 – 20:30', note: 'Quiet ride, recharge 😴 · Οι επιβάτες κοιμούνται: προσοχή στις στροφές!', sky: 'noon' },
  { from: 'MATERA', to: 'BARI', depart: 20 * 60 + 30, arrive: 21 * 60 + 30, km: 65, stay: 'Τέλος διαδρομής', note: 'Νυχτερινή επιστροφή. Ανάψτε φώτα.', sky: 'night' },
];

const PEOPLE = [
  { name: 'Δημήτρης', shirt: 0x3a6ea5, hair: 0x2a1a10, lines: ['Πάρε θέση!', 'Έχουμε sync Δευτέρα!', 'Ποιος θα κεράσει τούρτα;!'] },
  { name: 'Παντελής', shirt: 0xb03a2e, hair: 0x1a1008, lines: ['Από το στόμα μου το πήρες!', 'Έψαξες για μαξί;!', 'Pro bonooo!'] },
  { name: 'Ελένη', shirt: 0x7a4fa0, hair: 0x5a3018, lines: ['Εγώ δεν έψαξα!', 'Δεν θέλει πιστωτική!', 'Φουλ ασφάλεια είχαμε!'] },
  { name: 'Αναστασία', shirt: 0xd08a2a, hair: 0x8a5a28, lines: ['Σας έχω χάσει!', 'Δεν διαβάζω 300 μηνύματα!', 'Αααααα!'] },
  { name: 'Νούλας', shirt: 0x2e8a5a, hair: 0x101010, lines: ['Τα βλέπω από το ρολόι!', 'Στο γκαράζ είμαι!', 'Από τον Αύγουστο ρε!'] },
  { name: 'Νίκος', shirt: 0x1f8fb0, hair: 0x2a1a0e, lines: ['Είναι μεγαλύτερο από μια απλή ερώτηση!', 'Για μαξί δεν έψαξα!', 'Θέλουν πιστωτική όμως;!'] },
  { name: 'Κατερίνα', shirt: 0xd04a7a, hair: 0x6a3a1a, lines: ['Σταμάτα το βαν!', 'Θα ζαλιστώ!', 'Πού είναι η βαλίτσα μου;!'] },
];

// ------------------------------------------------------------------ route
// Control points (x, z) in meters. Stops are flagged.
const CTRL = [
  [0, 0], [0, 110], [25, 230], [95, 320], [190, 360], [250, 450], [230, 560], [150, 620], [140, 730],
  [210, 820], [330, 850], [430, 930], [440, 1050], [380, 1140], [420, 1250], [520, 1300], [600, 1380, 'stop'],
  [660, 1490], [790, 1540], [900, 1500], [1010, 1560], [1040, 1690], [960, 1790], [990, 1910], [1120, 1960],
  [1230, 2060], [1200, 2170], [1260, 2240], [1200, 2300], [1270, 2360], [1205, 2420], [1280, 2480], [1340, 2560], [1380, 2660, 'stop'],
  [1430, 2780], [1560, 2830], [1640, 2960], [1610, 3100], [1690, 3230], [1830, 3270], [1890, 3410], [1830, 3540],
  [1720, 3600], [1640, 3720], [1660, 3860, 'stop'],
];
const SP = 2; // sample spacing (m)
const ROAD_W = 8;
const HALF = ROAD_W / 2;

const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
const ROUTE_LEN = curve.getLength();
const N = Math.floor(ROUTE_LEN / SP) + 1;
const pts = curve.getSpacedPoints(N - 1);
const RX = new Float32Array(N), RZ = new Float32Array(N), TX = new Float32Array(N), TZ = new Float32Array(N), K = new Float32Array(N);
for (let i = 0; i < N; i++) { RX[i] = pts[i].x; RZ[i] = pts[i].z; }
for (let i = 0; i < N; i++) {
  const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
  const dx = RX[b] - RX[a], dz = RZ[b] - RZ[a], l = Math.hypot(dx, dz) || 1;
  TX[i] = dx / l; TZ[i] = dz / l;
}
// Signed curvature over a ±5 sample window (positive = turning left).
for (let i = 0; i < N; i++) {
  const a = Math.max(0, i - 5), b = Math.min(N - 1, i + 5);
  const h0 = Math.atan2(TX[a], TZ[a]), h1 = Math.atan2(TX[b], TZ[b]);
  let dh = h1 - h0; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  K[i] = dh / Math.max(1, (b - a) * SP);
}
// Left vector of the route at sample i: (tz, -tx)
const STOP_S = [];
CTRL.forEach((c, ci) => {
  if (c[2] !== 'stop') return;
  let best = 0, bd = Infinity;
  for (let i = 0; i < N; i++) { const d = (RX[i] - c[0]) ** 2 + (RZ[i] - c[1]) ** 2; if (d < bd) { bd = d; best = i; } }
  STOP_S.push(best * SP);
});
STOP_S[STOP_S.length - 1] = (N - 1) * SP - 6;
const LEG_START = [0, STOP_S[0], STOP_S[1]];

function routeAt(s) {
  const f = Math.max(0, Math.min(N - 1.001, s / SP));
  const i = f | 0, t = f - i;
  return {
    x: RX[i] + (RX[i + 1] - RX[i]) * t, z: RZ[i] + (RZ[i + 1] - RZ[i]) * t,
    tx: TX[i], tz: TZ[i], lx: TZ[i], lz: -TX[i], k: K[i], i,
  };
}
function project(x, z, hint = -1) {
  let lo = 0, hi = N - 1;
  if (hint >= 0) { lo = Math.max(0, hint - 60); hi = Math.min(N - 1, hint + 60); }
  let best = lo, bd = Infinity;
  for (let i = lo; i <= hi; i++) { const d = (RX[i] - x) ** 2 + (RZ[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  const dx = x - RX[best], dz = z - RZ[best];
  return { i: best, s: best * SP + dx * TX[best] + dz * TZ[best], d: dx * TZ[best] - dz * TX[best], dist: Math.sqrt(bd) };
}
// Coarse spatial hash of the road for "is this spot clear of the road?" checks.
const HASH = new Map();
const hkey = (x, z) => `${Math.floor(x / 25)},${Math.floor(z / 25)}`;
for (let i = 0; i < N; i += 2) {
  const k = hkey(RX[i], RZ[i]);
  if (!HASH.has(k)) HASH.set(k, []);
  HASH.get(k).push(i);
}
function roadDist(x, z) {
  let bd = Infinity;
  const cx = Math.floor(x / 25), cz = Math.floor(z / 25);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const list = HASH.get(`${cx + a},${cz + b}`);
    if (list) for (const i of list) bd = Math.min(bd, (RX[i] - x) ** 2 + (RZ[i] - z) ** 2);
  }
  return Math.sqrt(bd);
}
function zoneAt(s) {
  if (s < 260 || s > ROUTE_LEN - 340) return 'bari';
  if (Math.abs(s - STOP_S[0]) < 230) return 'alberobello';
  if (s > STOP_S[1] - 320 && s < STOP_S[1] + 150) return 'matera';
  return 'country';
}

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1600);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xa08a60, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d8, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
scene.add(sun, sun.target);
scene.fog = new THREE.Fog(0xbfe0ff, 160, 700);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 78 : 62;
  camera.updateProjectionMatrix();
  $('rotate').hidden = !(isTouch && h > w);
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ textures
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}
const rng0 = mulberry32(7);
const asphaltTex = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 60 + rng0() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(rng0() * w, rng0() * h, 2, 2); }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(20,20,20,0.25)'; g.fillRect(rng0() * w, rng0() * h, 4 + rng0() * 30, 2 + rng0() * 50); }
  g.fillStyle = '#e8e6dc'; g.fillRect(8, 0, 7, h); g.fillRect(w - 15, 0, 7, h);
  g.fillStyle = '#f2efe4'; g.fillRect(w / 2 - 3, 0, 6, h * 0.55);
});
const fieldTex = canvasTex(1024, 1024, (g, w, h) => {
  const cols = ['#b9a061', '#a8984f', '#8e9a52', '#c9b27a', '#9c8f4a', '#7f8c46', '#c2a668'];
  for (let i = 0; i < 60; i++) {
    g.fillStyle = cols[(rng0() * cols.length) | 0];
    g.save(); g.translate(rng0() * w, rng0() * h); g.rotate(rng0() * Math.PI);
    g.fillRect(-180, -110, 360 + rng0() * 200, 220 + rng0() * 140); g.restore();
  }
  for (let i = 0; i < 30000; i++) { g.fillStyle = `rgba(${rng0() < 0.5 ? '60,50,20' : '230,220,170'},0.08)`; g.fillRect(rng0() * w, rng0() * h, 3, 3); }
  g.strokeStyle = 'rgba(200,190,170,0.5)'; g.lineWidth = 3;
  for (let i = 0; i < 26; i++) { g.beginPath(); g.moveTo(rng0() * w, rng0() * h); g.lineTo(rng0() * w, rng0() * h); g.stroke(); }
}, [10, 10]);
function labelTex(text, { bg = '#ffffff', fg = '#1a1a1a', border = '#c01818', w = 512, h = 160, font = 'bold 72px system-ui' } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = border; g.fillRect(0, 0, w, h);
    g.fillStyle = bg; g.fillRect(12, 12, w - 24, h - 24);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

// ------------------------------------------------------------------ world
const world = new THREE.Group();
scene.add(world);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ map: fieldTex }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(900, -0.02, 1900);
ground.receiveShadow = true;
world.add(ground);

// Road ribbon (+ gravel shoulder underneath)
function ribbon(half, y, mat, vScale) {
  const pos = new Float32Array(N * 2 * 3), uv = new Float32Array(N * 2 * 2), idx = [];
  for (let i = 0; i < N; i++) {
    const lx = TZ[i], lz = -TX[i];
    pos.set([RX[i] + lx * half, y, RZ[i] + lz * half, RX[i] - lx * half, y, RZ[i] - lz * half], i * 6);
    uv.set([0, (i * SP) / vScale, 1, (i * SP) / vScale], i * 4);
    if (i < N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } // counter-clockwise seen from above
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}
world.add(ribbon(HALF + 1.4, 0.01, new THREE.MeshLambertMaterial({ color: 0x9a8c72 }), 10));
world.add(ribbon(HALF, 0.03, new THREE.MeshLambertMaterial({ map: asphaltTex }), 14));

// Instancing helper
const dummy = new THREE.Object3D();
function instanced(geo, mat, items, { shadow = false, colors = null } = {}) {
  if (!items.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.y || 0, it.z);
    dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    dummy.scale.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (colors) m.setColorAt(i, new THREE.Color(colors(it, i)));
  });
  m.castShadow = shadow;
  m.receiveShadow = true;
  world.add(m);
  return m;
}

// Which side of the road the Adriatic sits on near each end of the trip:
// the side whose patch stays clearest of the route.
const SEA = [120, ROUTE_LEN - 150].map((s0) => {
  const p = routeAt(s0);
  let bestSide = 1, bestScore = -1;
  for (const side of [-1, 1]) {
    let clear = 0;
    for (let a = -4; a <= 4; a++) for (let b = 1; b <= 8; b++) {
      const x = p.x + p.lx * side * (40 + b * 70) + p.tx * a * 90, z = p.z + p.lz * side * (40 + b * 70) + p.tz * a * 90;
      if (roadDist(x, z) > 40) clear++;
    }
    if (clear > bestScore) { bestScore = clear; bestSide = side; }
  }
  return { s0, side: bestSide };
});
const seaSideAt = (s) => (s < ROUTE_LEN / 2 ? SEA[0].side : SEA[1].side);
const R = mulberry32(2026);
const olives = [], walls = [], trulli = [], houses = [], baris = [], palms = [], lamps = [], chevrons = [], rocks = [];
for (let s = 10; s < ROUTE_LEN - 10; s += 6) {
  const p = routeAt(s);
  const zone = zoneAt(s);
  for (const side of [-1, 1]) {
    if (zone === 'country') {
      // dry-stone walls
      if (R() < 0.75) walls.push({ x: p.x + p.lx * side * (HALF + 3.2), z: p.z + p.lz * side * (HALF + 3.2), ry: Math.atan2(p.tx, p.tz), sx: 0.55, sy: 0.7 + R() * 0.3, sz: 6.4 });
      // olive groves
      for (let k = 0; k < 2; k++) {
        const off = HALF + 8 + R() * 70;
        const x = p.x + p.lx * side * off + (R() - 0.5) * 6, z = p.z + p.lz * side * off + (R() - 0.5) * 6;
        if (R() < 0.5 && roadDist(x, z) > HALF + 6) olives.push({ x, z, s: 0.8 + R() * 0.6, ry: R() * 6 });
      }
      if (R() < 0.08) { const off = HALF + 5 + R() * 30; rocks.push({ x: p.x + p.lx * side * off, z: p.z + p.lz * side * off, s: 0.6 + R() * 1.5, ry: R() * 6 }); }
    } else if (zone === 'alberobello') {
      for (let k = 0; k < 3; k++) {
        const off = HALF + 9 + R() * 45;
        const x = p.x + p.lx * side * off + (R() - 0.5) * 4, z = p.z + p.lz * side * off + (R() - 0.5) * 4;
        if (roadDist(x, z) > HALF + 8) trulli.push({ x, z, s: 0.8 + R() * 0.5, ry: R() * 6 });
      }
      if (R() < 0.3) lamps.push({ x: p.x + p.lx * side * (HALF + 1.6), z: p.z + p.lz * side * (HALF + 1.6) });
    } else if (zone === 'matera') {
      // Sassi: stone houses stepping up the hillside on the left, ravine edge on the right
      if (side > 0) for (let k = 0; k < 4; k++) {
        const off = HALF + 9 + R() * 70;
        const x = p.x + p.lx * off + (R() - 0.5) * 5, z = p.z + p.lz * off + (R() - 0.5) * 5;
        if (roadDist(x, z) > HALF + 8) {
          const h = 3 + R() * 4;
          houses.push({ x, z, y: (off - HALF - 9) * 0.32 + h / 2, sx: 3 + R() * 4, sy: h, sz: 3 + R() * 4, ry: Math.atan2(p.tx, p.tz) + (R() - 0.5) * 0.4 });
        }
      } else if (R() < 0.6) rocks.push({ x: p.x - p.lx * (HALF + 4 + R() * 8), z: p.z - p.lz * (HALF + 4 + R() * 8), s: 1 + R() * 2, ry: R() * 6 });
      if (R() < 0.3) lamps.push({ x: p.x + p.lx * side * (HALF + 1.6), z: p.z + p.lz * side * (HALF + 1.6) });
    } else if (zone === 'bari') {
      // Old-town blocks on the right; the Adriatic on the left near the seafront.
      const land = -seaSideAt(s);
      if (side === land) for (let k = 0; k < 2; k++) {
        const off = HALF + 9 + R() * 50;
        const x = p.x + p.lx * land * off, z = p.z + p.lz * land * off;
        if (roadDist(x, z) > HALF + 9) { const h = 6 + R() * 14; baris.push({ x, z, y: h / 2, sx: 6 + R() * 8, sy: h, sz: 6 + R() * 8, ry: Math.atan2(p.tx, p.tz) }); }
      } else if (R() < 0.5) palms.push({ x: p.x + p.lx * side * (HALF + 3), z: p.z + p.lz * side * (HALF + 3), s: 0.9 + R() * 0.4 });
      if (R() < 0.45) lamps.push({ x: p.x + p.lx * side * (HALF + 1.6), z: p.z + p.lz * side * (HALF + 1.6) });
    }
  }
  // Chevron warnings on the outside of sharp curves
  if (Math.abs(p.k) > 1 / 55 && Math.round(s) % 18 < 6) {
    const side = p.k > 0 ? -1 : 1; // outside of the turn
    chevrons.push({ x: p.x + p.lx * side * (HALF + 2.2), z: p.z + p.lz * side * (HALF + 2.2), ry: Math.atan2(p.tx, p.tz) + Math.PI, dir: p.k > 0 ? 1 : -1 });
  }
}

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
instanced(new THREE.CylinderGeometry(0.22, 0.35, 2.2, 6).translate(0, 1.1, 0), lam(0x5a4632), olives, { shadow: true });
instanced(new THREE.IcosahedronGeometry(1.9, 0).scale(1.2, 0.8, 1.2).translate(0, 2.9, 0), lam(0x7d8a5a), olives, { shadow: true });
instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), lam(0xc8bca0), walls);
instanced(new THREE.DodecahedronGeometry(1, 0), lam(0xb8ad94), rocks, { shadow: true });
// Trulli: whitewashed drum, grey stone cone, white pinnacle
instanced(new THREE.CylinderGeometry(2.4, 2.5, 2.6, 10).translate(0, 1.3, 0), lam(0xf4f1e8), trulli, { shadow: true });
instanced(new THREE.ConeGeometry(2.55, 3.4, 10).translate(0, 4.3, 0), lam(0x6e6e70), trulli, { shadow: true });
instanced(new THREE.SphereGeometry(0.35, 8, 6).translate(0, 6.15, 0), lam(0xffffff), trulli);
instanced(new THREE.BoxGeometry(0.9, 1.6, 0.1).translate(0, 0.8, 2.48), lam(0x5a3a22), trulli);
// Matera sassi (tufa stone)
instanced(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), houses, { shadow: true, colors: () => ['#d8c39a', '#cdb68a', '#e0cfa8', '#c4ab7e'][(R() * 4) | 0] });
instanced(new THREE.BoxGeometry(0.9, 1.3, 0.05), lam(0x2a2018), houses.map((h) => ({ ...h, y: h.y - h.sy / 2 + 0.9, sx: 1, sy: 1, sz: 1, z: h.z + Math.cos(h.ry) * (h.sz / 2 + 0.03), x: h.x + Math.sin(h.ry) * (h.sz / 2 + 0.03) })));
// Bari blocks
instanced(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), baris, { shadow: true, colors: () => ['#efe2c4', '#e6d2a6', '#f3e9d4', '#dcc7a0', '#e9d9c0'][(R() * 5) | 0] });
instanced(new THREE.CylinderGeometry(0.18, 0.28, 7, 6).translate(0, 3.5, 0), lam(0x8a6a44), palms);
instanced(new THREE.ConeGeometry(2.4, 1.6, 7).translate(0, 7.3, 0), lam(0x3f7a3a), palms);
instanced(new THREE.CylinderGeometry(0.07, 0.09, 5, 5).translate(0, 2.5, 0), lam(0x3a3a3c), lamps);
const lampHeads = instanced(new THREE.SphereGeometry(0.28, 8, 6).translate(0, 5.1, 0), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), lamps);
// Chevron boards
const chevTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#ffd21a'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#111'; g.beginPath(); g.moveTo(30, 14); g.lineTo(92, 64); g.lineTo(30, 114); g.lineTo(50, 114); g.lineTo(112, 64); g.lineTo(50, 14); g.fill();
});
for (const c of chevrons) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), lam(0x444444));
  post.position.set(c.x, 0.6, c.z); world.add(post);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshLambertMaterial({ map: chevTex, side: THREE.DoubleSide }));
  board.position.set(c.x, 1.5, c.z);
  board.rotation.y = c.ry;
  if (c.dir > 0) board.scale.x = -1; // texture points right; mirror it for left-hand bends
  world.add(board);
}
// Sea patches near Bari
for (const { s0, side } of SEA) {
  const p = routeAt(s0);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 1400), new THREE.MeshPhongMaterial({ color: 0x1f6fa8, shininess: 80, specular: 0x88bbdd }));
  sea.rotation.x = -Math.PI / 2;
  sea.rotation.z = Math.atan2(p.tx, p.tz);
  sea.position.set(p.x + p.lx * side * 480, 0.0, p.z + p.lz * side * 480);
  world.add(sea);
}
// Town boards, landmarks
function townSign(s, text) {
  const p = routeAt(s);
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), new THREE.MeshLambertMaterial({ map: labelTex(text), side: THREE.DoubleSide }));
  board.position.y = 2.4;
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), lam(0x555555)); p1.position.set(-1.5, 1.2, 0);
  const p2 = p1.clone(); p2.position.x = 1.5;
  g.add(board, p1, p2);
  g.position.set(p.x - p.lx * (HALF + 2.5), 0, p.z - p.lz * (HALF + 2.5));
  g.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI;
  world.add(g);
}
townSign(STOP_S[0] - 230, 'ALBEROBELLO');
townSign(STOP_S[1] - 320, 'MATERA');
townSign(ROUTE_LEN - 340, 'BARI');
{
  // Matera cathedral on top of the sassi
  const p = routeAt(STOP_S[1] - 60);
  const cx = p.x + p.lx * 70, cz = p.z + p.lz * 70;
  const base = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 20), lam(0xdcc79e)); base.position.set(cx, 22, cz);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 22, 4), lam(0xd4be92)); tower.position.set(cx + 8, 28, cz - 6);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 5, 4), lam(0x8a6a4a)); roof.position.set(cx + 8, 41.5, cz - 6); roof.rotation.y = Math.PI / 4;
  for (const m of [base, tower, roof]) { m.castShadow = true; world.add(m); }
  // Bari: Castello Svevo
  const b = routeAt(60);
  const kx = b.x - b.lx * 40, kz = b.z - b.lz * 40;
  const keep = new THREE.Mesh(new THREE.BoxGeometry(26, 10, 26), lam(0xcbb894)); keep.position.set(kx, 5, kz); world.add(keep);
  for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 6), lam(0xc2ad86)); t.position.set(kx + a * 13, 7, kz + c * 13); world.add(t);
  }
}
// Stop markers (painted bay + banner)
const stopMarkers = STOP_S.map((s, i) => {
  const p = routeAt(s);
  const g = new THREE.Group();
  const arch = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), new THREE.MeshBasicMaterial({ map: labelTex(`STOP · ${LEGS[i].to}`, { bg: '#16a34a', fg: '#fff', border: '#0d5c2a', w: 1024, h: 160, font: 'bold 80px system-ui' }), side: THREE.DoubleSide }));
  arch.position.y = 5.2;
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.8, 0.25), lam(0x2a2a2a)); p1.position.set(-4.6, 2.9, 0);
  const p2 = p1.clone(); p2.position.x = 4.6;
  g.add(arch, p1, p2);
  g.position.set(p.x, 0, p.z);
  g.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI;
  world.add(g);
  return g;
});

// ------------------------------------------------------------------ obstacles
const OB = mulberry32(99);
const potholes = [], bumps = [], cones = [];
for (let s = 60; s < ROUTE_LEN - 40; s += 55 + OB() * 90) {
  const zone = zoneAt(s);
  if (STOP_S.some((x) => Math.abs(x - s) < 30)) continue;
  if (zone !== 'country' && OB() < 0.55) { bumps.push({ s, hit: false }); continue; }
  potholes.push({ s, d: (OB() < 0.6 ? -1 : 1) * (0.6 + OB() * 1.6), r: 0.7 + OB() * 0.5, hit: false });
}
const potMat = new THREE.MeshLambertMaterial({ color: 0x111113 });
const potRim = new THREE.MeshLambertMaterial({ color: 0x8a8478 });
for (const p of potholes) {
  const a = routeAt(p.s);
  const rim = new THREE.Mesh(new THREE.RingGeometry(p.r, p.r + 0.18, 14), potRim);
  const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 14), potMat);
  for (const [mesh, y] of [[rim, 0.046], [m, 0.047]]) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.atan2(a.tx, a.tz);
    mesh.scale.set(1, 1.35, 1);
    mesh.position.set(a.x + a.lx * p.d, y, a.z + a.lz * p.d);
    world.add(mesh);
  }
}
const bumpTex = canvasTex(256, 32, (g) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#111' : '#f2c21a'; g.fillRect(i * 16, 0, 16, 32); } });
for (const b of bumps) {
  const a = routeAt(b.s);
  const m = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W, 0.12, 0.7), new THREE.MeshLambertMaterial({ map: bumpTex }));
  m.position.set(a.x, 0.06, a.z);
  m.rotation.y = Math.atan2(a.tx, a.tz);
  world.add(m);
}
// Roadworks: cones blocking the right lane
const coneGeo = new THREE.ConeGeometry(0.28, 0.75, 10).translate(0, 0.375, 0);
const coneMat = lam(0xff6a10);
for (const s0 of [ROUTE_LEN * 0.18, ROUTE_LEN * 0.47, ROUTE_LEN * 0.8]) {
  for (let k = 0; k < 7; k++) {
    const s = s0 + k * 4, a = routeAt(s);
    const d = -1.2 - (k === 0 || k === 6 ? 0 : 0.8);
    const m = new THREE.Mesh(coneGeo, coneMat);
    m.position.set(a.x + a.lx * d, 0, a.z + a.lz * d);
    m.castShadow = true;
    world.add(m);
    cones.push({ s, d, mesh: m, hit: false });
  }
}

// ------------------------------------------------------------------ vehicles
function box(w, h, l, color, x = 0, y = 0, z = 0, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat || new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
const glass = new THREE.MeshPhongMaterial({ color: 0x1b2430, shininess: 90, specular: 0x8899aa });
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14).rotateZ(Math.PI / 2);
const wheelMat = lam(0x161616), hubMat = lam(0xb8bcc2);

function makeWheel() {
  const w = new THREE.Group();
  w.add(new THREE.Mesh(wheelGeo, wheelMat));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8).rotateZ(Math.PI / 2), hubMat);
  w.add(hub);
  return w;
}

function makeVan() {
  const van = new THREE.Group();
  const body = new THREE.Group();
  van.add(body);
  const white = new THREE.MeshPhongMaterial({ color: 0xf4f5f6, shininess: 60, specular: 0x666666 });
  body.add(box(1.95, 1.0, 4.9, 0, 0, 0.85, 0, white));          // lower body
  body.add(box(1.92, 0.9, 3.9, 0, 0, 1.78, -0.45, white));      // cabin
  const hood = box(1.9, 0.5, 1.0, 0, 0, 1.45, 1.95, white); hood.rotation.x = -0.32; body.add(hood);
  const wind = box(1.8, 0.75, 0.08, 0, 0, 1.75, 1.6, glass); wind.rotation.x = -0.55; body.add(wind);
  body.add(box(1.94, 0.55, 3.3, 0, 0, 1.86, -0.55, glass));     // side window band
  body.add(box(1.97, 0.12, 4.92, 0, 0, 0.62, 0, lam(0x1f4fa0))); // livery stripe
  body.add(box(1.98, 0.32, 0.3, 0, 0, 0.5, 2.38, lam(0x2a2a2a))); // bumper
  body.add(box(1.98, 0.3, 0.3, 0, 0, 0.5, -2.38, lam(0x2a2a2a)));
  for (const sx of [-0.7, 0.7]) {
    body.add(box(0.36, 0.16, 0.06, 0, sx, 0.98, 2.46, new THREE.MeshBasicMaterial({ color: 0xfff6d8 })));
    body.add(box(0.22, 0.36, 0.06, 0, sx * 1.15, 1.05, -2.46, new THREE.MeshBasicMaterial({ color: 0xc81818 })));
    body.add(box(0.08, 0.2, 0.26, 0, sx * 1.48, 1.55, 1.1, lam(0x222222)));
  }
  // Sliding doors (both sides) and rear barn doors
  const doors = {};
  for (const side of [-1, 1]) {
    const d = new THREE.Group();
    d.add(box(0.06, 1.55, 1.25, 0, 0, 0, 0, white));
    d.add(box(0.07, 0.5, 1.0, 0, 0, 0.42, 0, glass));
    d.position.set(side * 1.0, 1.25, 0.25);
    body.add(d);
    doors[side] = { mesh: d, t: 0, open: 0, side, home: d.position.clone() };
  }
  const rear = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * 0.97, 1.25, -2.47);
    const leaf = box(0.96, 1.6, 0.06, 0, -side * 0.48, 0, 0, white);
    leaf.add(box(0.7, 0.5, 0.07, 0, 0, 0.4, 0, glass));
    hinge.add(leaf);
    body.add(hinge);
    rear.push({ hinge, side });
  }
  doors.rear = { leaves: rear, t: 0 };
  // Wheels
  const wheels = [];
  for (const [x, z, front] of [[-0.88, 1.6, true], [0.88, 1.6, true], [-0.88, -1.55, false], [0.88, -1.55, false]]) {
    const w = makeWheel();
    w.position.set(x, 0.36, z);
    van.add(w);
    wheels.push({ w, front });
  }
  // Headlights for the night leg
  const lights = [];
  for (const sx of [-0.6, 0.6]) {
    const l = new THREE.SpotLight(0xfff2d0, 0, 70, 0.5, 0.5, 1.2);
    l.position.set(sx, 1.0, 2.4);
    l.target.position.set(sx * 2, 0, 20);
    van.add(l, l.target);
    lights.push(l);
  }
  van.userData = { body, doors, wheels, lights };
  return van;
}
const van = makeVan();
scene.add(van);

const CAR_TYPES = [
  { kind: 'fiat', len: 3.6, w: 1.65, colors: [0xd62828, 0x2a9d8f, 0xf4f1de, 0x264653, 0xe9c46a, 0x8ecae6] },
  { kind: 'ape', len: 2.9, w: 1.4, colors: [0xf2c94c, 0x5aa9e6, 0x8bc34a] },
  { kind: 'bus', len: 10, w: 2.4, colors: [0x2f6db5, 0xf08c2a] },
];
function makeCar(type, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x555555 });
  if (type.kind === 'fiat') {
    g.add(box(1.65, 0.7, 3.6, 0, 0, 0.65, 0, paint));
    const top = box(1.45, 0.62, 2.0, 0, 0, 1.3, -0.15, paint); g.add(top);
    g.add(box(1.47, 0.42, 1.7, 0, 0, 1.32, -0.15, glass));
    for (const sx of [-0.55, 0.55]) g.add(box(0.3, 0.2, 0.05, 0, sx, 0.75, 1.81, new THREE.MeshBasicMaterial({ color: 0xfff6d8 })));
    for (const [x, z] of [[-0.75, 1.15], [0.75, 1.15], [-0.75, -1.15], [0.75, -1.15]]) { const w = makeWheel(); w.scale.setScalar(0.85); w.position.set(x, 0.31, z); g.add(w); }
  } else if (type.kind === 'ape') {
    g.add(box(1.25, 1.35, 1.2, 0, 0, 1.0, 0.75, paint));
    g.add(box(1.15, 0.5, 0.06, 0, 0, 1.35, 1.36, glass));
    g.add(box(1.4, 0.5, 1.6, 0, 0, 0.75, -0.7, lam(0x6b5a3a)));
    for (let i = 0; i < 6; i++) g.add(box(0.35, 0.35, 0.35, 0, -0.4 + (i % 3) * 0.4, 1.17, -0.4 - (i > 2 ? 0.5 : 0), lam(0xe0702a))); // crates of tomatoes
    const fw = makeWheel(); fw.scale.setScalar(0.7); fw.position.set(0, 0.25, 1.1); g.add(fw);
    for (const x of [-0.62, 0.62]) { const w = makeWheel(); w.scale.setScalar(0.7); w.position.set(x, 0.25, -0.9); g.add(w); }
  } else {
    g.add(box(2.4, 2.6, 10, 0, 0, 1.65, 0, paint));
    g.add(box(2.42, 0.9, 8.8, 0, 0, 2.15, -0.3, glass));
    g.add(box(2.2, 1.2, 0.06, 0, 0, 2.0, 5.01, glass));
    for (const [x, z] of [[-1.05, 3.6], [1.05, 3.6], [-1.05, -3.4], [1.05, -3.4]]) { const w = makeWheel(); w.scale.setScalar(1.3); w.position.set(x, 0.47, z); g.add(w); }
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(g);
  return g;
}

// Traffic: a pool of cars kept around the van. Right-hand traffic: d < 0 is our lane.
const traffic = [];
const TR = mulberry32(5);
function spawnCar(car, ahead) {
  const r = TR();
  const type = r < 0.62 ? CAR_TYPES[0] : r < 0.88 ? CAR_TYPES[1] : CAR_TYPES[2];
  if (car?.mesh) scene.remove(car.mesh);
  const oncoming = TR() < 0.55;
  const c = car || {};
  Object.assign(c, {
    type, oncoming,
    mesh: makeCar(type, type.colors[(TR() * type.colors.length) | 0]),
    s: Math.min(ROUTE_LEN - 20, van.userData.s + ahead),
    d: oncoming ? 1.9 : -1.9,
    v: type.kind === 'ape' ? 6 + TR() * 2 : type.kind === 'bus' ? 9 + TR() * 3 : 10 + TR() * 6,
    knocked: 0, spin: 0, hit: false,
  });
  return c;
}

// ------------------------------------------------------------------ people
function makePerson(p) {
  const g = new THREE.Group();
  const shirt = lam(p.shirt), skin = lam(0xe0b08a), pants = lam(0x2a3248);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), shirt); torso.position.y = 1.15; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin); head.position.y = 1.72; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(p.hair)); hair.position.y = 1.75; g.add(hair);
  const legs = [], arms = [];
  for (const x of [-0.11, 0.11]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 3, 6), pants); leg.position.set(x, 0.45, 0); g.add(leg); legs.push(leg);
  }
  for (const x of [-0.33, 0.33]) {
    const arm = new THREE.Group(); arm.position.set(x, 1.4, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.45, 3, 6), shirt); a.position.y = -0.3; arm.add(a);
    g.add(arm); arms.push(arm);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  // name tag
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(p.name, { bg: '#ffffff', border: '#' + p.shirt.toString(16).padStart(6, '0'), w: 512, h: 128, font: 'bold 64px system-ui' }), depthTest: false }));
  tag.scale.set(1.6, 0.4, 1); tag.position.y = 2.4;
  g.add(tag);
  g.userData = { arms, legs, tag };
  g.visible = false;
  scene.add(g);
  return g;
}

// ------------------------------------------------------------------ state
let mode = 'menu';
let leg = 0;
const V = van.userData;
const state = {
  x: 0, z: 2, h: 0, v: 0, steer: 0, steerTarget: 0, yawRate: 0, aLat: 0, strain: 0, doorCd: 0,
  bounce: 0, bounceV: 0, roll: 0, pitch: 0, shake: 0, idx: 0, s: 0, d: 0, offRoad: false,
  clock: LEGS[0].depart, legTime: 0,
};
V.s = 0;
const riders = PEOPLE.map((p) => ({ ...p, state: 'in', mesh: makePerson(p), pos: new THREE.Vector3(), vel: new THREE.Vector3(), ang: new THREE.Vector3(), t: 0, ejections: 0 }));
const debris = [];
const stats = { ejections: 0, crashes: 0, potholes: 0, maxG: 0, taxis: 0, legs: [] };

function resetLeg(i) {
  leg = i;
  const s0 = LEG_START[i] + (i === 0 ? 4 : 10);
  const p = routeAt(s0);
  state.x = p.x + p.lx * -1.9; state.z = p.z + p.lz * -1.9;
  state.h = Math.atan2(p.tx, p.tz);
  state.v = 0; state.strain = 0; state.idx = p.i; state.s = s0; state.d = -1.9; state.clock = LEGS[i].depart; state.legTime = 0;
  for (const r of riders) { r.state = 'in'; r.mesh.visible = false; }
  for (const c of traffic) scene.remove(c.mesh);
  traffic.length = 0;
  V.s = s0;
  for (let k = 0; k < 9; k++) traffic.push(spawnCar(null, 60 + k * 70 + TR() * 40));
  applySky(LEGS[i].sky);
  updateHudStatic();
}

// ------------------------------------------------------------------ sky / time of day
const SKIES = {
  morning: { bg: 0xbfe0ff, fog: [180, 760], hemi: [0xd8ecff, 0xb09a68, 1.05], sun: [0xffe8c8, 2.3], dir: [-60, 70, 40], lamps: false },
  noon: { bg: 0xa8d4ff, fog: [200, 800], hemi: [0xcfe8ff, 0xa89a70, 1.15], sun: [0xffffff, 2.7], dir: [20, 110, 10], lamps: false },
  night: { bg: 0x0a1022, fog: [40, 260], hemi: [0x2a3a6a, 0x101018, 0.35], sun: [0x8aa0ff, 0.35], dir: [60, 80, -30], lamps: true },
};
function applySky(name) {
  const k = SKIES[name];
  scene.background = new THREE.Color(k.bg);
  scene.fog.color.setHex(k.bg); scene.fog.near = k.fog[0]; scene.fog.far = k.fog[1];
  hemi.color.setHex(k.hemi[0]); hemi.groundColor.setHex(k.hemi[1]); hemi.intensity = k.hemi[2];
  sun.color.setHex(k.sun[0]); sun.intensity = k.sun[1];
  sun.userData.dir = k.dir;
  for (const l of V.lights) l.intensity = k.lamps ? 60 : 0;
  if (lampHeads) lampHeads.material.color.setHex(k.lamps ? 0xffe7a0 : 0xd8d0c0);
  document.body.classList.toggle('night', name === 'night');
}

// ------------------------------------------------------------------ input
const keys = new Set();
const input = { left: false, right: false, gas: false, brake: false, wheel: 0, wheelHeld: false };
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyH') horn();
  if (e.code === 'Enter' && !$('card').hidden) $('card-btn').click();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
function bindHold(id, key) {
  const el = $(id);
  const on = (e) => { input[key] = true; el.classList.add('down'); e.preventDefault(); };
  const off = (e) => { input[key] = false; el.classList.remove('down'); e.preventDefault(); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}
bindHold('b-gas', 'gas'); bindHold('b-brake', 'brake');
// Steering wheel: grab anywhere on it and rotate around its center (±135°); it springs back on release.
const WHEEL_MAX = 135;
{
  const el = $('wheel');
  let start = 0, startAngle = 0, id = null;
  const angleOf = (e) => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  el.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    try { el.setPointerCapture(id); } catch { /* synthetic or already released pointer */ }
    start = angleOf(e); startAngle = input.wheel * WHEEL_MAX;
    input.wheelHeld = true; el.classList.add('held');
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    let d = angleOf(e) - start;
    d = ((d + 540) % 360) - 180;
    const a = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, startAngle + d));
    input.wheel = a / WHEEL_MAX;
    start = angleOf(e); startAngle = a; // accumulate so the wheel can turn past ±180° of thumb travel
  });
  const up = (e) => { if (e.pointerId !== id) return; id = null; input.wheelHeld = false; el.classList.remove('held'); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
$('b-horn').addEventListener('pointerdown', (e) => { horn(); e.preventDefault(); });
// Optional tilt steering
let tilt = null;
$('b-tilt').addEventListener('click', async () => {
  if (tilt !== null) { tilt = null; $('b-tilt').classList.remove('on'); return; }
  try { if (typeof DeviceOrientationEvent?.requestPermission === 'function') await DeviceOrientationEvent.requestPermission(); } catch { /* denied */ }
  tilt = 0;
  $('b-tilt').classList.add('on');
});
window.addEventListener('deviceorientation', (e) => {
  if (tilt === null) return;
  const landscapeSign = (screen.orientation?.angle ?? window.orientation ?? 90) === 270 || window.orientation === -90 ? -1 : 1;
  tilt = Math.max(-1, Math.min(1, ((e.beta || 0) * landscapeSign) / 25));
});

// ------------------------------------------------------------------ sound
const sfx = (() => {
  let ac = null, engine = null, engineGain = null, filt = null, screech = null, screechGain = null, noiseBuf = null, master = null;
  const init = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = store.get('van.muted', false) ? 0 : 0.6; master.connect(ac.destination);
      engine = ac.createOscillator(); engine.type = 'sawtooth';
      filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400;
      engineGain = ac.createGain(); engineGain.gain.value = 0.05;
      engine.connect(filt).connect(engineGain).connect(master); engine.start();
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      screech = ac.createBufferSource(); screech.buffer = noiseBuf; screech.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 6;
      screechGain = ac.createGain(); screechGain.gain.value = 0;
      screech.connect(bp).connect(screechGain).connect(master); screech.start();
    } catch { ac = null; }
  };
  const burst = (dur, f, vol, type = 'lowpass') => {
    if (!ac) return;
    const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur);
  };
  const tone = (f0, f1, dur, type, vol, vib = 0) => {
    if (!ac) return;
    const t = ac.currentTime, o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 9; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  return {
    init,
    update(v, lat) {
      if (!ac) return;
      engine.frequency.setTargetAtTime(38 + Math.abs(v) * 3.2, ac.currentTime, 0.08);
      filt.frequency.setTargetAtTime(300 + Math.abs(v) * 40, ac.currentTime, 0.1);
      screechGain.gain.setTargetAtTime(Math.min(0.25, Math.max(0, (Math.abs(lat) - 6) * 0.05)), ac.currentTime, 0.05);
    },
    scream: () => tone(700 + Math.random() * 300, 300, 0.9, 'triangle', 0.18, 40),
    door: () => burst(0.25, 900, 0.5),
    thump: (k = 1) => { burst(0.18, 220, 0.7 * k); tone(90, 45, 0.2, 'sine', 0.4 * k); },
    crash: () => { burst(0.6, 1500, 0.9); tone(120, 40, 0.5, 'square', 0.25); },
    horn: () => { tone(415, 410, 0.45, 'square', 0.12); tone(523, 520, 0.45, 'square', 0.1); },
    baa: () => tone(380, 330, 0.5, 'sawtooth', 0.12, 25),
    ding: () => [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, f, 0.25, 'sine', 0.15), i * 90)),
    mute(on) { if (master) master.gain.value = on ? 0 : 0.6; },
  };
})();
function horn() { sfx.horn(); }

// ------------------------------------------------------------------ events
let toastT = 0;
function toast(msg, ms = 1800) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
const bubbles = [];
function shout(rider, text) {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = `${rider.name}: ${text}`;
  $('bubbles').appendChild(el);
  bubbles.push({ el, rider, t: 2.2 });
}

const vForward = () => new THREE.Vector3(Math.sin(state.h), 0, Math.cos(state.h));
const vRight = () => new THREE.Vector3(-Math.cos(state.h), 0, Math.sin(state.h));

function eject(dir, how = 'side') {
  const inside = riders.filter((r) => r.state === 'in');
  if (!inside.length) return false;
  const r = inside[(Math.random() * inside.length) | 0];
  r.state = 'flying';
  r.ejections++; stats.ejections++;
  const f = vForward(), right = vRight();
  const sideVec = right.clone().multiplyScalar(dir);
  const base = new THREE.Vector3(state.x, 1.2, state.z);
  if (how === 'side') base.add(sideVec.clone().multiplyScalar(1.2)).add(f.clone().multiplyScalar(0.3));
  else base.add(f.clone().multiplyScalar(-2.6));
  r.pos.copy(base);
  const vel = f.clone().multiplyScalar(state.v * 0.85);
  if (how === 'side') vel.add(sideVec.multiplyScalar(5 + Math.abs(state.aLat) * 0.35));
  else vel.add(f.clone().multiplyScalar(-4));
  vel.y = 4 + Math.random() * 3;
  r.vel.copy(vel);
  r.ang.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12);
  r.mesh.visible = true;
  r.mesh.position.copy(r.pos);
  sfx.scream();
  shout(r, r.lines[(Math.random() * r.lines.length) | 0]);
  updateHudStatic();
  return true;
}

function openSideDoor(side) {
  const d = V.doors[side];
  d.t = 1.4;
  sfx.door();
}
function openRear() { V.doors.rear.t = 1.2; sfx.door(); }

function spawnDebris(kind, pos, vel) {
  let mesh;
  if (kind === 'suitcase') {
    mesh = new THREE.Group();
    mesh.add(box(0.5, 0.7, 0.25, [0x8a2be2, 0xd04040, 0x2a8a8a, 0xe0a020][(Math.random() * 4) | 0]));
    mesh.add(box(0.2, 0.06, 0.06, 0x222222, 0, 0.38, 0));
  } else if (kind === 'sheep') {
    mesh = new THREE.Group();
    mesh.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8).scale(1.3, 0.9, 1), lam(0xf4f1e6)), { castShadow: true }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lam(0x2a2a2a)); head.position.set(0, 0.15, 0.7); mesh.add(head);
  } else mesh = pos.mesh;
  if (kind !== 'cone') { scene.add(mesh); mesh.position.copy(pos); }
  debris.push({ mesh, vel, ang: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10), life: kind === 'cone' ? 1e9 : 8 });
}

// Sheep crossing (leg 2)
const flock = [];
{
  const s0 = STOP_S[0] + (STOP_S[1] - STOP_S[0]) * 0.45;
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const wool = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8).scale(1.3, 0.9, 1), lam(0xf4f1e6)); wool.position.y = 0.75; wool.castShadow = true; g.add(wool);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lam(0x2a2a2a)); head.position.set(0, 0.9, 0.7); g.add(head);
    for (const [x, z] of [[-0.3, 0.35], [0.3, 0.35], [-0.3, -0.35], [0.3, -0.35]]) { const l = box(0.1, 0.45, 0.1, 0x2a2a2a, x, 0.22, z); g.add(l); }
    scene.add(g);
    flock.push({ mesh: g, s: s0 + (i % 3) * 2.2 + Math.random(), d: -7 - Math.floor(i / 3) * 1.6 - Math.random(), speed: 0.9 + Math.random() * 0.3, gone: false });
  }
}

// ------------------------------------------------------------------ simulation
const WHEELBASE = 3.0, MAX_V = 26, GRIP = 11;
function step(dt) {
  const L = LEGS[leg];
  const sleepy = leg === 1;
  // input
  let steer = 0;
  if (input.left || keys.has('ArrowLeft') || keys.has('KeyA')) steer -= 1;
  if (input.right || keys.has('ArrowRight') || keys.has('KeyD')) steer += 1;
  if (tilt !== null && tilt !== 0) steer = Math.abs(tilt) < 0.05 ? 0 : tilt;
  if (input.wheelHeld || Math.abs(input.wheel) > 0.02) steer = Math.sign(input.wheel) * Math.pow(Math.abs(input.wheel), 1.25);
  const gas = input.gas || keys.has('ArrowUp') || keys.has('KeyW');
  const brake = input.brake || keys.has('ArrowDown') || keys.has('KeyS') || keys.has('Space');
  state.steer += (steer - state.steer) * Math.min(1, dt * (steer === 0 ? 6 : 4));

  // longitudinal
  const prevV = state.v;
  if (gas) state.v += (state.v < 0 ? 9 : 5.2 * (1 - state.v / MAX_V)) * dt;
  if (brake) state.v -= (state.v > 0.5 ? 10 : 3.5) * dt;
  if (!gas && !brake) state.v -= Math.sign(state.v) * Math.min(Math.abs(state.v), 1.3 * dt);
  state.v = Math.max(-6, Math.min(MAX_V, state.v));
  if (state.offRoad && Math.abs(state.v) > 11) state.v -= Math.sign(state.v) * 9 * dt;
  const accel = (state.v - prevV) / dt;

  // lateral (kinematic bicycle with a grip limit)
  const maxSteer = 0.55 / (1 + Math.abs(state.v) * 0.075);
  let yaw = (state.v * Math.tan(state.steer * maxSteer)) / WHEELBASE;
  const aLat = state.v * yaw;
  if (Math.abs(aLat) > GRIP) yaw *= GRIP / Math.abs(aLat); // understeer when over the limit
  state.yawRate = yaw;
  state.aLat = state.v * yaw;
  stats.maxG = Math.max(stats.maxG, Math.abs(state.aLat) / 9.81);
  state.h -= yaw * dt;
  state.x += Math.sin(state.h) * state.v * dt;
  state.z += Math.cos(state.h) * state.v * dt;

  // route position
  const pr = project(state.x, state.z, state.idx);
  state.idx = pr.i; state.s = pr.s; state.d = pr.d; V.s = pr.s;
  state.offRoad = Math.abs(pr.d) > HALF + 0.6;
  if (pr.dist > 70) {
    const p = routeAt(state.s);
    state.x = p.x - p.lx * 1.9; state.z = p.z - p.lz * 1.9; state.h = Math.atan2(p.tx, p.tz); state.v = 0;
    toast('Το GPS σε έστειλε σε χωράφι 🌾 Πίσω στον δρόμο!');
  }

  // door strain from cornering (sleeping passengers slide more)
  const limit = sleepy ? 6.2 : 7.2;
  const g = Math.abs(state.aLat);
  if (g > limit) state.strain += (g - limit) * dt * 0.55;
  else state.strain = Math.max(0, state.strain - dt * 0.6);
  if (state.offRoad && Math.abs(state.v) > 9) { state.strain += dt * 0.35; if (Math.random() < dt * 6) jolt(0.25); }
  state.doorCd = Math.max(0, state.doorCd - dt);
  if (state.strain >= 1 && state.doorCd <= 0) {
    const outward = state.yawRate > 0 ? -1 : 1; // turning right throws people to the left (eject: +1 = van's right)
    openSideDoor(-outward); // door meshes are keyed by local x, where +x is the van's left
    eject(outward, 'side');
    state.strain = 0.25; state.doorCd = 1.2;
  }
  // hard braking pops the rear doors and the luggage
  if (accel < -8.5 && prevV > 13 && V.doors.rear.t <= 0) {
    openRear();
    const f = vForward();
    spawnDebris('suitcase', new THREE.Vector3(state.x, 1.3, state.z).add(f.clone().multiplyScalar(-2.7)), f.clone().multiplyScalar(state.v * 0.5 - 3).setY(3));
    toast('Πετάχτηκε μια βαλίτσα από πίσω 🧳');
  }

  // potholes and speed bumps
  for (const p of potholes) {
    if (p.hit || Math.abs(p.s - state.s) > 1.4) continue;
    if (Math.abs(p.d - state.d) < p.r + 0.7) {
      p.hit = true; stats.potholes++;
      const k = Math.min(1.2, Math.abs(state.v) / 18);
      jolt(k);
      state.strain += 0.45 * k;
      if (k > 0.9) { openRear(); if (Math.random() < 0.5) eject(0, 'rear'); else toast('Λακκούβα! Άνοιξαν οι πίσω πόρτες 🕳️'); }
      else toast('Λακκούβα! 🕳️', 900);
    }
  }
  for (const b of bumps) {
    if (b.hit || Math.abs(b.s - state.s) > 1.2) continue;
    b.hit = true;
    const k = Math.min(1.3, Math.abs(state.v) / 13);
    jolt(k);
    if (k > 0.9) { openRear(); state.strain += 0.5; if (Math.random() < 0.5) eject(0, 'rear'); else toast('Σαμαράκι στα 90; 😬'); }
  }
  // cones
  for (const c of cones) {
    if (c.hit || Math.abs(c.s - state.s) > 2.6 || Math.abs(c.d - state.d) > 1.3) continue;
    c.hit = true;
    jolt(0.3); state.strain += 0.2;
    const f = vForward();
    spawnDebris('cone', c, f.clone().multiplyScalar(state.v * 0.8).add(new THREE.Vector3(0, 5, 0)));
    sfx.thump(0.6);
  }
  // sheep
  for (const sh of flock) {
    if (sh.gone) continue;
    if (leg === 1) sh.d += sh.speed * dt * 0.7;
    if (sh.d > 9) sh.d = -9;
    const p = routeAt(sh.s);
    sh.mesh.position.set(p.x + p.lx * sh.d, Math.abs(Math.sin(performance.now() / 150 + sh.s)) * 0.08, p.z + p.lz * sh.d);
    sh.mesh.rotation.y = Math.atan2(p.lx, p.lz);
    if (Math.abs(sh.s - state.s) < 2.8 && Math.abs(sh.d - state.d) < 1.6 && Math.abs(state.v) > 2) {
      sh.gone = true; scene.remove(sh.mesh);
      spawnDebris('sheep', sh.mesh.position.clone().setY(0.8), vForward().multiplyScalar(state.v * 0.7).setY(6));
      state.v *= 0.55; jolt(0.7); state.strain += 0.5; sfx.baa();
      toast('Μπεεεε! 🐑');
    }
  }
  // traffic
  for (const c of traffic) {
    if (c.knocked > 0) c.knocked -= dt;
    else c.s += (c.oncoming ? -c.v : c.v) * dt;
    const p = routeAt(c.s);
    c.mesh.position.set(p.x + p.lx * c.d, 0, p.z + p.lz * c.d);
    c.mesh.rotation.y = Math.atan2(p.tx, p.tz) + (c.oncoming ? Math.PI : 0) + c.spin;
    if (c.knocked > 0) c.spin += dt * 6 * Math.sign(c.d);
    const ds = Math.abs(c.s - state.s), dd = Math.abs(c.d - state.d);
    if (!c.hit && ds < (c.type.len + 4.9) / 2 && dd < (c.type.w + 1.95) / 2) {
      c.hit = true; c.knocked = 1.2; stats.crashes++;
      const rel = Math.abs(state.v - (c.oncoming ? -c.v : c.v));
      state.v *= 0.25; jolt(1.2); state.shake = 1;
      sfx.crash();
      toast(c.type.kind === 'ape' ? 'Τράκαρες ένα Ape με ντομάτες! 🍅' : c.type.kind === 'bus' ? 'Τράκαρες λεωφορείο! 🚌' : 'Μπαμ! Fiat 💥');
      if (rel > 6) { openSideDoor(state.d > c.d ? 1 : -1); eject(state.d > c.d ? -1 : 1, 'side'); }
    }
    // recycle cars far behind or past the stop
    const behind = c.oncoming ? state.s - c.s > 60 : state.s - c.s > 120;
    if (behind || c.s < 2 || c.s > ROUTE_LEN - 10) spawnCar(c, 220 + TR() * 260);
  }

  // stranded riders: fly, land, get up, wait, board when the van stops nearby
  for (const r of riders) {
    if (r.state === 'flying') {
      r.vel.y -= 18 * dt;
      r.pos.addScaledVector(r.vel, dt);
      r.mesh.rotation.x += r.ang.x * dt; r.mesh.rotation.y += r.ang.y * dt; r.mesh.rotation.z += r.ang.z * dt;
      if (r.pos.y < 0.25) {
        r.pos.y = 0.25;
        r.vel.y *= -0.35; r.vel.x *= 0.6; r.vel.z *= 0.6; r.ang.multiplyScalar(0.6);
        if (Math.hypot(r.vel.x, r.vel.z) < 0.8 && Math.abs(r.vel.y) < 1) { r.state = 'down'; r.t = 0.8; }
      }
      r.mesh.position.copy(r.pos).setY(r.pos.y - 0.25);
    } else if (r.state === 'down') {
      r.t -= dt;
      r.mesh.rotation.x *= 0.9; r.mesh.rotation.z *= 0.9;
      if (r.t <= 0) { r.state = 'waiting'; r.mesh.rotation.set(0, 0, 0); r.pos.y = 0.25; }
    } else if (r.state === 'waiting') {
      const wave = Math.sin(performance.now() / 160) * 0.8;
      r.mesh.userData.arms[1].rotation.z = 2.6 + wave * 0.4;
      r.mesh.lookAt(state.x, 0, state.z);
      r.mesh.position.set(r.pos.x, 0, r.pos.z);
      const dist = Math.hypot(r.pos.x - state.x, r.pos.z - state.z);
      if (dist < 7 && Math.abs(state.v) < 3) { r.state = 'boarding'; r.t = 0; }
    } else if (r.state === 'boarding') {
      r.t += dt;
      const tx = state.x, tz = state.z;
      r.pos.x += (tx - r.pos.x) * Math.min(1, dt * 3); r.pos.z += (tz - r.pos.z) * Math.min(1, dt * 3);
      r.mesh.position.set(r.pos.x, Math.abs(Math.sin(r.t * 12)) * 0.2, r.pos.z);
      r.mesh.userData.legs[0].rotation.x = Math.sin(r.t * 14) * 0.7; r.mesh.userData.legs[1].rotation.x = -Math.sin(r.t * 14) * 0.7;
      if (r.t > 0.7) { r.state = 'in'; r.mesh.visible = false; r.mesh.userData.arms[1].rotation.z = 0; sfx.ding(); toast(`${r.name} ξανανέβηκε 👍`); updateHudStatic(); }
    }
  }

  // debris physics
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.vel.y -= 18 * dt;
    d.mesh.position.addScaledVector(d.vel, dt);
    d.mesh.rotation.x += d.ang.x * dt; d.mesh.rotation.y += d.ang.y * dt; d.mesh.rotation.z += d.ang.z * dt;
    if (d.mesh.position.y < 0.2) { d.mesh.position.y = 0.2; d.vel.multiplyScalar(0.5); d.vel.y = Math.abs(d.vel.y) * 0.3; d.ang.multiplyScalar(0.5); }
    d.life -= dt;
    if (d.life <= 0) { scene.remove(d.mesh); debris.splice(i, 1); }
  }

  // body motion
  state.bounceV += (-state.bounce * 160 - state.bounceV * 9) * dt;
  state.bounce += state.bounceV * dt;
  state.roll += ((state.aLat / 9.81) * 0.07 - state.roll) * Math.min(1, dt * 6);
  state.pitch += ((-accel / 9.81) * 0.05 - state.pitch) * Math.min(1, dt * 5);
  state.shake = Math.max(0, state.shake - dt * 2);

  // clock
  const legLen = (leg < 2 ? STOP_S[leg] : ROUTE_LEN) - LEG_START[leg];
  const minutesPerSecond = (L.arrive - L.depart) / (legLen / 17);
  state.legTime += dt;
  state.clock = L.depart + state.legTime * minutesPerSecond;

  // arrival
  const stopS = STOP_S[leg];
  if (state.s > stopS - 8 && (Math.abs(state.v) < 4 || state.s > stopS + 40)) arrive();
  else if (state.s > stopS - 60 && state.s < stopS - 8 && Math.abs(state.v) > 12 && !step.warned) { step.warned = true; toast('Φρένο, φτάνουμε στη στάση! 🛑'); }

  sfx.update(state.v, state.aLat);
}
function jolt(k) { state.bounceV += 4 * k; state.shake = Math.max(state.shake, 0.4 * k); sfx.thump(Math.min(1, k)); }

// ------------------------------------------------------------------ stops & summary
const fmt = (m) => { m = Math.round(m); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
function arrive() {
  if (mode !== 'drive') return;
  mode = 'card';
  step.warned = false;
  const L = LEGS[leg];
  const late = Math.max(0, Math.round(state.clock - L.arrive));
  const left = riders.filter((r) => r.state !== 'in');
  stats.taxis += left.length;
  const legEj = riders.reduce((a, r) => a + r.ejections, 0) - stats.legs.reduce((a, l) => a + l.ej, 0);
  const stars = 3 - (late > 10 ? 1 : 0) - (left.length ? 1 : 0) - (legEj > 3 ? 1 : 0);
  stats.legs.push({ to: L.to, late, left: left.length, ej: legEj, stars: Math.max(0, stars) });
  sfx.ding();
  $('card-title').textContent = L.to;
  $('card-sub').textContent = `Άφιξη ${fmt(state.clock)} · στόχος ${fmt(L.arrive)}${late ? ` · ${late}′ καθυστέρηση` : ' · στην ώρα σου 👌'}`;
  $('card-stars').textContent = '★'.repeat(Math.max(0, stars)) + '☆'.repeat(3 - Math.max(0, stars));
  const lines = [];
  lines.push(`<div><span>Πετάχτηκαν</span><b>${legEj}</b></div>`);
  lines.push(`<div><span>Έμειναν στον δρόμο</span><b>${left.length}</b></div>`);
  lines.push(`<div><span>Max G</span><b>${stats.maxG.toFixed(1)}</b></div>`);
  lines.push(`<div><span>Τρακαρίσματα</span><b>${stats.crashes}</b></div>`);
  $('card-stats').innerHTML = lines.join('');
  $('card-note').textContent = left.length
    ? `${left.map((r) => r.name).join(', ')} ήρθαν με ταξί (€35 ο καθένας 💸).`
    : leg < 2 ? `Πρόγραμμα: ${L.stay} · ${L.note}` : 'Όλοι σπίτι! Ποιος κερνάει τούρτα; 🎂';
  const last = leg === LEGS.length - 1;
  $('card-btn').textContent = last ? 'Σύνοψη ταξιδιού' : `Συνέχεια → ${LEGS[leg + 1].to}`;
  $('card-next').textContent = last ? '' : `Αναχώρηση ${fmt(LEGS[leg + 1].depart)} · ${LEGS[leg + 1].note}`;
  $('card').hidden = false;
}
$('card-btn').addEventListener('click', () => {
  $('card').hidden = true;
  if (leg < LEGS.length - 1) { resetLeg(leg + 1); mode = 'drive'; toast(`${LEGS[leg].from} → ${LEGS[leg].to} · ${LEGS[leg].km} km`, 2600); }
  else finish();
});
function finish() {
  mode = 'end';
  const total = stats.legs.reduce((a, l) => a + l.stars, 0);
  const champ = riders.slice().sort((a, b) => b.ejections - a.ejections)[0];
  $('end-stars').textContent = `${total} / 9 ★`;
  $('end-stats').innerHTML = [
    ['Πετάχτηκαν συνολικά', stats.ejections], ['Ταξί για όσους ξεχάστηκαν', stats.taxis],
    ['Λακκούβες', stats.potholes], ['Τρακαρίσματα', stats.crashes], ['Max G', stats.maxG.toFixed(1)],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('end-champ').textContent = champ.ejections ? `🏆 Πρωταθλητής πτήσεων: ${champ.name} (×${champ.ejections})` : '🏆 Κανείς δεν πετάχτηκε. Είσαι ο πιο βαρετός οδηγός της Απουλίας.';
  const best = store.get('van.best', 0);
  if (total > best) store.set('van.best', total);
  $('end').hidden = false;
}
$('end-btn').addEventListener('click', () => location.reload());

// ------------------------------------------------------------------ HUD
const chips = $('chips');
function updateHudStatic() {
  const L = LEGS[leg];
  $('leg').textContent = `${L.from} → ${L.to}`;
  chips.innerHTML = riders.map((r) => `<span class="chip ${r.state === 'in' ? '' : 'out'}" style="--c:#${r.shirt.toString(16).padStart(6, '0')}">${r.name}</span>`).join('');
}
const mini = $('minimap'), mctx = mini.getContext('2d');
function drawMinimap() {
  const W = mini.width, H = mini.height, sc = 0.22;
  const fx = Math.sin(state.h), fz = Math.cos(state.h), rx = -fz, rz = fx;
  // Heading-up map: forward is up, the van's right is right.
  const toMap = (x, z) => { const dx = x - state.x, dz = z - state.z; return [W / 2 + (dx * rx + dz * rz) * sc, H / 2 - (dx * fx + dz * fz) * sc]; };
  mctx.clearRect(0, 0, W, H);
  mctx.strokeStyle = 'rgba(255,255,255,0.85)'; mctx.lineWidth = 3; mctx.lineJoin = 'round';
  mctx.beginPath();
  const i0 = Math.max(0, state.idx - 250);
  for (let i = i0; i < Math.min(N, state.idx + 600); i += 4) {
    const [x, y] = toMap(RX[i], RZ[i]);
    i === i0 ? mctx.moveTo(x, y) : mctx.lineTo(x, y);
  }
  mctx.stroke();
  const sp = routeAt(STOP_S[leg]);
  const [sx, sy] = toMap(sp.x, sp.z);
  mctx.fillStyle = '#22c55e'; mctx.beginPath(); mctx.arc(sx, sy, 5, 0, 7); mctx.fill();
  mctx.fillStyle = '#ff4d4d';
  for (const r of riders) if (r.state === 'waiting' || r.state === 'down' || r.state === 'flying') { const [x, y] = toMap(r.pos.x, r.pos.z); mctx.beginPath(); mctx.arc(x, y, 4, 0, 7); mctx.fill(); }
  mctx.fillStyle = '#ffd21a';
  mctx.beginPath(); mctx.moveTo(W / 2, H / 2 - 7); mctx.lineTo(W / 2 + 5, H / 2 + 5); mctx.lineTo(W / 2 - 5, H / 2 + 5); mctx.fill();
}
function updateHud() {
  const L = LEGS[leg];
  $('clock').textContent = fmt(state.clock);
  $('clock').classList.toggle('late', state.clock > L.arrive);
  $('target').textContent = `στόχος ${fmt(L.arrive)}`;
  const legLen = STOP_S[leg] - LEG_START[leg];
  const remain = Math.max(0, (STOP_S[leg] - state.s) / legLen) * L.km;
  $('dist').textContent = `${remain.toFixed(1)} km`;
  $('speed').textContent = Math.round(Math.abs(state.v) * 3.6);
  const g = Math.abs(state.aLat) / 9.81;
  $('gfill').style.width = `${Math.min(100, state.strain * 100)}%`;
  $('gval').textContent = `${g.toFixed(1)} G`;
  $('gbar').classList.toggle('hot', state.strain > 0.5);
  const waiting = riders.filter((r) => r.state === 'waiting');
  $('pickup').hidden = !waiting.length;
  if (waiting.length) {
    const near = waiting.map((r) => ({ r, d: Math.hypot(r.pos.x - state.x, r.pos.z - state.z) })).sort((a, b) => a.d - b.d)[0];
    $('pickup').textContent = `${near.r.name} περιμένει ${Math.round(near.d)} m μακριά · σταμάτα δίπλα του`;
  }
  drawMinimap();
}

// ------------------------------------------------------------------ render loop
const camPos = new THREE.Vector3(0, 6, -10), camLook = new THREE.Vector3();
const tmp = new THREE.Vector3();
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'drive') {
    acc += dt;
    while (acc > 1 / 120) { step(1 / 120); acc -= 1 / 120; if (mode !== 'drive') break; }
    updateHud();
  } else if (mode === 'menu') {
    state.h += dt * 0.15; // idle camera orbit on the title screen
  }

  // steering wheel: spring back to center when released; mirror keyboard/tilt steering
  if (!input.wheelHeld) {
    input.wheel *= Math.exp(-dt * 7);
    if (Math.abs(input.wheel) < 0.002) input.wheel = 0;
  }
  const shown = input.wheelHeld || Math.abs(input.wheel) > 0.02 ? input.wheel : state.steer;
  $('wheel').style.transform = `rotate(${(shown * WHEEL_MAX).toFixed(1)}deg)`;
  $('wheel').setAttribute('aria-valuenow', Math.round(shown * WHEEL_MAX));

  // van transform
  van.position.set(state.x, 0, state.z);
  van.rotation.y = state.h;
  V.body.position.y = state.bounce;
  V.body.rotation.z = state.roll;
  V.body.rotation.x = state.pitch;
  for (const w of V.wheels) {
    w.w.children[0].rotation.x += (state.v * dt) / 0.36;
    w.w.children[1].rotation.x = w.w.children[0].rotation.x;
    if (w.front) w.w.rotation.y = -state.steer * 0.45;
  }
  for (const side of [-1, 1]) {
    const d = V.doors[side];
    d.t = Math.max(0, d.t - dt);
    const target = d.t > 0 ? 1 : 0;
    d.open += (target - d.open) * Math.min(1, dt * 8);
    d.mesh.position.set(d.home.x + side * 0.14 * Math.min(1, d.open * 3), d.home.y, d.home.z - 1.15 * d.open);
  }
  V.doors.rear.t = Math.max(0, V.doors.rear.t - dt);
  for (const lf of V.doors.rear.leaves) {
    const target = V.doors.rear.t > 0 ? lf.side * 1.6 : 0;
    lf.hinge.rotation.y += (target - lf.hinge.rotation.y) * Math.min(1, dt * 9);
  }

  // chase camera
  const f = tmp.set(Math.sin(state.h), 0, Math.cos(state.h));
  const portrait = window.innerHeight > window.innerWidth;
  const back = mode === 'menu' ? 14 : portrait ? 11 : 9.5, up = mode === 'menu' ? 5 : portrait ? 5.2 : 3.9;
  const want = new THREE.Vector3(state.x - f.x * back, up, state.z - f.z * back);
  camPos.lerp(want, Math.min(1, dt * 4));
  const shake = state.shake * 0.4;
  camera.position.set(camPos.x + (Math.random() - 0.5) * shake, camPos.y + (Math.random() - 0.5) * shake, camPos.z);
  camLook.lerp(new THREE.Vector3(state.x + f.x * 7, 1.4, state.z + f.z * 7), Math.min(1, dt * 6));
  camera.lookAt(camLook);

  // sun follows the van for crisp shadows
  const sd = sun.userData.dir || [-60, 70, 40];
  sun.position.set(state.x + sd[0], sd[1], state.z + sd[2]);
  sun.target.position.set(state.x, 0, state.z);

  // speech bubbles
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.t -= dt;
    tmp.copy(b.rider.mesh.position).setY(b.rider.mesh.position.y + 2.6).project(camera);
    b.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * window.innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -100%)`;
    b.el.style.opacity = tmp.z < 1 ? Math.min(1, b.t) : 0;
    if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ start
$('start').addEventListener('click', async () => {
  sfx.init();
  if (isTouch) {
    try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* ignore */ }
    try { await screen.orientation?.lock?.('landscape'); } catch { /* ignore */ }
  }
  $('menu').hidden = true;
  resetLeg(0);
  mode = 'drive';
  toast(`${LEGS[0].from} → ${LEGS[0].to} · ${LEGS[0].km} km · Πάτα γκάζι!`, 2600);
});
$('b-mute').addEventListener('click', () => {
  const m = !store.get('van.muted', false);
  store.set('van.muted', m); sfx.mute(m);
  $('b-mute').textContent = m ? '🔇' : '🔊';
});
$('b-mute').textContent = store.get('van.muted', false) ? '🔇' : '🔊';
$('roster').innerHTML = `<b>Οδηγός:</b> εσύ · <b>Επιβάτες:</b> ${PEOPLE.map((p) => p.name).join(', ')}`;
const best = store.get('van.best', 0);
if (best) $('menu-best').textContent = `Καλύτερο: ${best} / 9 ★`;

resize();
resetLeg(0);
mode = 'menu';
requestAnimationFrame(frame);

// Exposed for automated testing.
window.__van = { scene, camera, renderer, state, riders, stats, traffic, potholes, routeAt, K, SP, get mode() { return mode; }, set mode(m) { mode = m; }, eject, arrive, resetLeg, STOP_S, ROUTE_LEN, step };
