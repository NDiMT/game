import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { DIRS, generateLevel } from './levels.js';

const MAX_LIVES = 3;
const MAX_HINTS = 3;
const CUBE = 0.9;

// ---------- Persistence (best-effort) ----------
const store = {
  get(k, def) {
    try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
  },
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const ui = {
  level: $('level'), lives: $('lives'), left: $('left'),
  hint: $('hint'), hintCount: $('hint-count'), restart: $('restart'), sound: $('sound'),
  overlay: $('overlay'), title: $('ov-title'), text: $('ov-text'), stars: $('ov-stars'), btn: $('ov-btn'),
  toast: $('toast'),
};

// ---------- Three.js setup ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.rotateSpeed = 0.8;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a8, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
camera.add(sun);
sun.position.set(3, 5, 2);
scene.add(camera);

const root = new THREE.Group();
scene.add(root);

// ---------- Arrow textures ----------
function makeTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 8;
  g.strokeRect(4, 4, 120, 120);
  g.fillStyle = '#1d2233';
  g.strokeStyle = '#1d2233';
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Arrow pointing "up" in canvas space, rotated by `rot` quarter turns clockwise.
function arrowTex(rot) {
  return makeTexture((g) => {
    g.translate(64, 64);
    g.rotate((rot * Math.PI) / 2);
    g.lineWidth = 14;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 34); g.lineTo(0, -14); g.stroke();
    g.beginPath(); g.moveTo(0, -40); g.lineTo(26, -8); g.lineTo(-26, -8); g.closePath(); g.fill();
  });
}

const TEX = {
  up: arrowTex(0), right: arrowTex(1), down: arrowTex(2), left: arrowTex(3),
  head: makeTexture((g) => {
    g.beginPath(); g.arc(64, 64, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(64, 64, 10, 0, Math.PI * 2); g.fill();
  }),
  tail: makeTexture(() => {}),
};

// BoxGeometry face order (+x,-x,+y,-y,+z,-z) with the world axes that the
// texture's U (right) and V (up) map to on each face.
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function faceTexture(face, d) {
  const nd = dot(face.n, d);
  if (nd === 1) return TEX.head;
  if (nd === -1) return TEX.tail;
  const du = dot(face.u, d);
  const dv = dot(face.v, d);
  if (dv === 1) return TEX.up;
  if (dv === -1) return TEX.down;
  return du === 1 ? TEX.right : TEX.left;
}

let materialSets = null; // [variant][dir] -> Material[6]
function buildMaterials(color) {
  if (materialSets) materialSets.flat(2).forEach((m) => m.dispose());
  const variants = [
    { color, emissive: 0x000000 },
    { color: 0xffe066, emissive: 0x554400 }, // hint
    { color: 0xff5a5a, emissive: 0x440000 }, // error
  ];
  materialSets = variants.map((v) =>
    DIRS.map((d) => FACES.map((f) => new THREE.MeshLambertMaterial({
      map: faceTexture(f, d), color: v.color, emissive: v.emissive,
    }))));
}
const NORMAL = 0, HINT = 1, ERROR = 2;

const geometry = new THREE.BoxGeometry(CUBE, CUBE, CUBE);

// ---------- Game state ----------
const state = {
  level: store.get('arrow3d.level', 1),
  best: store.get('arrow3d.best', 1),
  muted: store.get('arrow3d.muted', false),
  lives: MAX_LIVES,
  hints: MAX_HINTS,
  grid: new Map(), // "x,y,z" -> cube
  min: [0, 0, 0], max: [0, 0, 0],
  over: false,
};
const anims = [];
const key = (x, y, z) => `${x},${y},${z}`;

function loadLevel(n) {
  state.level = n;
  store.set('arrow3d.level', n);
  state.lives = MAX_LIVES;
  state.hints = MAX_HINTS;
  state.over = false;
  anims.length = 0;
  state.grid.clear();
  while (root.children.length) root.remove(root.children[0]);

  const { cubes, color } = generateLevel(n);
  buildMaterials(color);

  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const c of cubes) {
    [c.x, c.y, c.z].forEach((v, i) => { min[i] = Math.min(min[i], v); max[i] = Math.max(max[i], v); });
  }
  state.min = min; state.max = max;
  const center = min.map((v, i) => (v + max[i]) / 2);
  state.offset = new THREE.Vector3(-center[0], -center[1], -center[2]);
  root.position.copy(state.offset);

  for (const c of cubes) {
    const mesh = new THREE.Mesh(geometry, materialSets[NORMAL][c.dir]);
    mesh.position.set(c.x, c.y, c.z);
    const cube = { ...c, mesh, alive: true };
    mesh.userData.cube = cube;
    root.add(mesh);
    state.grid.set(key(c.x, c.y, c.z), cube);
  }

  const span = Math.max(...max.map((v, i) => v - min[i])) + 1;
  const dist = span * 1.9 + 3.5;
  camera.position.set(dist * 0.62, dist * 0.52, dist * 0.8);
  controls.target.set(0, 0, 0);
  controls.minDistance = span * 0.9 + 1;
  controls.maxDistance = dist * 2.2;
  controls.update();

  hideOverlay();
  updateHud();
}

// First occupied cell along the cube's arrow, or null if the path is clear.
function blockerOf(cube) {
  const [dx, dy, dz] = DIRS[cube.dir];
  let { x, y, z } = cube;
  const { min, max } = state;
  for (let steps = 1; ; steps++) {
    x += dx; y += dy; z += dz;
    if (x < min[0] || y < min[1] || z < min[2] || x > max[0] || y > max[1] || z > max[2]) return null;
    const hit = state.grid.get(key(x, y, z));
    if (hit) return { cube: hit, steps };
  }
}

function tapCube(cube) {
  if (state.over || !cube.alive) return;
  const block = blockerOf(cube);
  if (!block) {
    cube.alive = false;
    state.grid.delete(key(cube.x, cube.y, cube.z));
    cube.mesh.material = materialSets[NORMAL][cube.dir];
    flyAway(cube);
    sfx.whoosh();
    updateHud();
    if (state.grid.size === 0) {
      state.over = true;
      setTimeout(win, 650);
    }
  } else {
    bump(cube, block);
    sfx.thud();
    state.lives--;
    updateHud(true);
    if (state.lives <= 0) {
      state.over = true;
      setTimeout(lose, 700);
    }
  }
}

// ---------- Animations ----------
function flyAway(cube) {
  const d = new THREE.Vector3(...DIRS[cube.dir]);
  const start = cube.mesh.position.clone();
  anims.push({
    t: 0, dur: 0.7,
    step(t) {
      const e = t * t * 1.6 + t * 0.4;
      cube.mesh.position.copy(start).addScaledVector(d, e * 22);
      const s = 1 - Math.max(0, (t - 0.6) / 0.4);
      cube.mesh.scale.setScalar(Math.max(s, 0.001));
    },
    done() { root.remove(cube.mesh); },
  });
}

function bump(cube, block) {
  const d = new THREE.Vector3(...DIRS[cube.dir]);
  const start = new THREE.Vector3(cube.x, cube.y, cube.z);
  const reach = block.steps - 1 + 0.12;
  const mats = (c, v) => { if (c.alive) c.mesh.material = materialSets[v][c.dir]; };
  mats(cube, ERROR); mats(block.cube, ERROR);
  anims.push({
    t: 0, dur: 0.35 + reach * 0.05,
    step(t) {
      const k = t < 0.5 ? (t / 0.5) ** 2 : 1 - ((t - 0.5) / 0.5);
      cube.mesh.position.copy(start).addScaledVector(d, k * reach);
    },
    done() {
      cube.mesh.position.copy(start);
      setTimeout(() => { mats(cube, NORMAL); mats(block.cube, NORMAL); }, 250);
    },
  });
  shake();
}

function shake() {
  const base = state.offset;
  anims.push({
    t: 0, dur: 0.3,
    step(t) {
      const a = (1 - t) * 0.12;
      root.position.set(base.x + Math.sin(t * 60) * a, base.y, base.z + Math.cos(t * 50) * a);
    },
    done() { root.position.copy(base); },
  });
}

function pulse(cube) {
  cube.mesh.material = materialSets[HINT][cube.dir];
  anims.push({
    t: 0, dur: 1.6,
    step(t) {
      if (!cube.alive) return;
      cube.mesh.scale.setScalar(1 + Math.sin(t * Math.PI * 4) * 0.12);
    },
    done() {
      if (!cube.alive) return;
      cube.mesh.scale.setScalar(1);
      cube.mesh.material = materialSets[NORMAL][cube.dir];
    },
  });
}

// ---------- Hints ----------
function useHint() {
  if (state.over || state.hints <= 0) return;
  // Prefer a free cube that faces the camera so the hint is visible.
  const camDir = camera.position.clone().normalize();
  let best = null, bestScore = -Infinity;
  for (const cube of state.grid.values()) {
    if (blockerOf(cube)) continue;
    const p = cube.mesh.getWorldPosition(new THREE.Vector3());
    const score = p.dot(camDir);
    if (score > bestScore) { bestScore = score; best = cube; }
  }
  if (!best) return;
  state.hints--;
  pulse(best);
  sfx.chime(0.4);
  updateHud();
}

// ---------- Input: tap vs. drag ----------
const raycaster = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 450;
  down = null;
  if (moved > 8 || !quick) return;
  const ndc = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(root.children, false)
    .filter((h) => h.object.userData.cube?.alive);
  if (hits.length) tapCube(hits[0].object.userData.cube);
});

// ---------- HUD / overlays ----------
function updateHud(hurt = false) {
  ui.level.textContent = `Επίπεδο ${state.level}`;
  ui.lives.innerHTML = Array.from({ length: MAX_LIVES }, (_, i) =>
    `<span class="heart${i < state.lives ? '' : ' lost'}">♥</span>`).join('');
  if (hurt) { ui.lives.classList.remove('hurt'); void ui.lives.offsetWidth; ui.lives.classList.add('hurt'); }
  ui.left.textContent = `${state.grid.size} κύβοι`;
  ui.hintCount.textContent = state.hints;
  ui.hint.disabled = state.hints <= 0;
  ui.sound.textContent = state.muted ? '🔇' : '🔊';
}

let overlayAction = null;
function showOverlay({ title, text, stars = null, button, action }) {
  ui.title.textContent = title;
  ui.text.textContent = text;
  ui.stars.innerHTML = stars === null ? '' :
    [0, 1, 2].map((i) => `<span class="star${i < stars ? ' on' : ''}">★</span>`).join('');
  ui.btn.textContent = button;
  overlayAction = action;
  ui.overlay.classList.add('show');
}
function hideOverlay() { ui.overlay.classList.remove('show'); }
ui.btn.addEventListener('click', () => overlayAction?.());

function win() {
  const next = state.level + 1;
  state.best = Math.max(state.best, next);
  store.set('arrow3d.best', state.best);
  store.set('arrow3d.level', next);
  sfx.chime(1);
  showOverlay({
    title: 'Τέλεια!',
    text: `Ολοκλήρωσες το επίπεδο ${state.level}.`,
    stars: state.lives,
    button: 'Επόμενο επίπεδο',
    action: () => loadLevel(next),
  });
}

function lose() {
  showOverlay({
    title: 'Τέλος ζωών',
    text: 'Κάποια βέλη ήταν μπλοκαρισμένα. Δοκίμασε πάλι!',
    button: 'Ξανά',
    action: () => loadLevel(state.level),
  });
}

ui.hint.addEventListener('click', useHint);
ui.restart.addEventListener('click', () => loadLevel(state.level));
ui.sound.addEventListener('click', () => {
  state.muted = !state.muted;
  store.set('arrow3d.muted', state.muted);
  updateHud();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'h') useHint();
  if (e.key === 'r') loadLevel(state.level);
  if (e.key === 'Enter' && ui.overlay.classList.contains('show')) overlayAction?.();
});

// ---------- Sound (WebAudio, no assets) ----------
const sfx = (() => {
  let ctx = null;
  const ac = () => {
    if (state.muted) return null;
    try { ctx ??= new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (freq, to, dur, type = 'sine', vol = 0.15, delay = 0) => {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  };
  return {
    whoosh: () => tone(420 + Math.random() * 120, 1400, 0.18, 'triangle', 0.12),
    thud: () => tone(160, 60, 0.25, 'square', 0.12),
    chime: (len) => [523, 659, 784, 1047].slice(0, len >= 1 ? 4 : 2)
      .forEach((f, i) => tone(f, f * 1.01, 0.35, 'sine', 0.12, i * 0.09)),
  };
})();

// ---------- Loop ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.t += dt;
    const t = Math.min(a.t / a.dur, 1);
    a.step(t);
    if (t >= 1) { anims.splice(i, 1); a.done?.(); }
  }
  controls.update();
  renderer.render(scene, camera);
});

loadLevel(state.level);
if (!store.get('arrow3d.seenHelp', false)) {
  ui.toast.classList.add('show');
  setTimeout(() => ui.toast.classList.remove('show'), 5000);
  store.set('arrow3d.seenHelp', true);
}

// Exposed for automated testing.
window.__game = { state, loadLevel, tapCube, blockerOf };
