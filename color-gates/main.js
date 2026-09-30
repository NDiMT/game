import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { DIRS, COLORS, GATE_SIZE, generateLevel } from './levels.js';

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
  level: $('level'), left: $('left'),
  gate: $('gate'), queue: $('queue'), gateCount: $('gate-count'),
  tray: $('tray'),
  hint: $('hint'), hintCount: $('hint-count'), restart: $('restart'), sound: $('sound'),
  overlay: $('overlay'), title: $('ov-title'), text: $('ov-text'), stars: $('ov-stars'), btn: $('ov-btn'),
  toast: $('toast'),
};

// ---------- Symbols (shared by canvas textures and DOM) ----------
function symbolPath(symbol, cx, cy, r) {
  const p = new Path2D();
  const poly = (n, rot, rr = r) => {
    for (let i = 0; i < n; i++) {
      const a = rot + (i * Math.PI * 2) / n;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i ? p.lineTo(x, y) : p.moveTo(x, y);
    }
    p.closePath();
  };
  switch (symbol) {
    case 'circle': p.arc(cx, cy, r * 0.85, 0, Math.PI * 2); break;
    case 'square': p.rect(cx - r * 0.75, cy - r * 0.75, r * 1.5, r * 1.5); break;
    case 'triangle': poly(3, -Math.PI / 2, r * 1.05); break;
    case 'diamond': poly(4, -Math.PI / 2); break;
    case 'plus': {
      const w = r * 0.36;
      p.rect(cx - w, cy - r, w * 2, r * 2);
      p.rect(cx - r, cy - w, r * 2, w * 2);
      break;
    }
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      p.closePath();
      break;
  }
  return p;
}

// Small inline SVG version for the gates and the tray.
const SVG_SYMBOL = {
  circle: '<circle cx="12" cy="12" r="7"/>',
  square: '<rect x="5.5" y="5.5" width="13" height="13"/>',
  triangle: '<path d="M12 4 L20.5 19 L3.5 19 Z"/>',
  diamond: '<path d="M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z"/>',
  plus: '<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/>',
  star: '<path d="M12 3.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z"/>',
};
const svgSymbol = (c) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${SVG_SYMBOL[COLORS[c].symbol]}</svg>`;

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

scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6f99, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
camera.add(sun);
sun.position.set(3, 5, 2);
scene.add(camera);

const root = new THREE.Group();
scene.add(root);

// ---------- Textures ----------
function makeTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.16)';
  g.lineWidth = 8;
  g.strokeRect(4, 4, 120, 120);
  g.fillStyle = '#1b1d33';
  g.strokeStyle = '#1b1d33';
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

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

const ARROWS = { up: arrowTex(0), right: arrowTex(1), down: arrowTex(2), left: arrowTex(3) };
const symbolTex = {};
function headTex(color) {
  const s = COLORS[color].symbol;
  return (symbolTex[s] ??= makeTexture((g) => g.fill(symbolPath(s, 64, 64, 34))));
}

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

// Arrows on the four side faces; the color's symbol on the front and back.
function faceTexture(face, d, color) {
  if (Math.abs(dot(face.n, d)) === 1) return headTex(color);
  const dv = dot(face.v, d);
  if (dv === 1) return ARROWS.up;
  if (dv === -1) return ARROWS.down;
  return dot(face.u, d) === 1 ? ARROWS.right : ARROWS.left;
}

const NORMAL = 0, HINT = 1, ERROR = 2;
const materialCache = new Map();
function materials(color, dir, variant = NORMAL) {
  const k = `${color}|${dir}|${variant}`;
  if (!materialCache.has(k)) {
    const emissive = [0x000000, 0x5a5a5a, 0x550000][variant];
    const tint = variant === ERROR ? 0xff7070 : COLORS[color].hex;
    materialCache.set(k, FACES.map((f) => new THREE.MeshLambertMaterial({
      map: faceTexture(f, DIRS[dir], color), color: tint, emissive,
    })));
  }
  return materialCache.get(k);
}

const geometry = new THREE.BoxGeometry(CUBE, CUBE, CUBE);

// ---------- Game state ----------
const state = {
  level: store.get('gates.level', 1),
  muted: store.get('gates.muted', false),
  grid: new Map(), // "x,y,z" -> cube
  min: [0, 0, 0], max: [0, 0, 0],
  gates: [], gateIndex: 0, gateFill: 0,
  tray: [], traySize: 5, peakTray: 0,
  hints: MAX_HINTS,
  over: false,
  offset: new THREE.Vector3(),
};
const anims = [];
const key = (x, y, z) => `${x},${y},${z}`;
const activeColor = () => state.gates[state.gateIndex];

function loadLevel(n) {
  state.level = n;
  store.set('gates.level', n);
  state.over = false;
  state.hints = MAX_HINTS;
  anims.length = 0;
  state.grid.clear();
  while (root.children.length) root.remove(root.children[0]);

  const lvl = generateLevel(n);
  state.gates = lvl.gates;
  state.gateIndex = 0;
  state.gateFill = 0;
  state.tray = [];
  state.traySize = lvl.tray;
  state.peakTray = 0;

  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const c of lvl.cubes)
    [c.x, c.y, c.z].forEach((v, i) => { min[i] = Math.min(min[i], v); max[i] = Math.max(max[i], v); });
  state.min = min; state.max = max;
  const center = min.map((v, i) => (v + max[i]) / 2);
  state.offset.set(-center[0], -center[1], -center[2]);
  root.position.copy(state.offset);

  for (const c of lvl.cubes) {
    const mesh = new THREE.Mesh(geometry, materials(c.color, c.dir));
    mesh.position.set(c.x, c.y, c.z);
    const cube = { ...c, mesh, alive: true };
    mesh.userData.cube = cube;
    root.add(mesh);
    state.grid.set(key(c.x, c.y, c.z), cube);
  }

  const span = Math.max(...max.map((v, i) => v - min[i])) + 1;
  const aspect = window.innerWidth / window.innerHeight;
  // Portrait screens have a narrow horizontal FOV, so back the camera off.
  const dist = (span * 1.9 + 4) * Math.max(1, Math.sqrt(0.9 / aspect));
  camera.position.set(dist * 0.62, dist * 0.52, dist * 0.8);
  controls.target.set(0, 0, 0);
  controls.minDistance = span * 0.9 + 1;
  controls.maxDistance = dist * 2.2;
  controls.update();

  hideOverlay();
  render({ arrived: true });
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

const freeCubes = () => [...state.grid.values()].filter((c) => !blockerOf(c));

function tapCube(cube) {
  if (state.over || !cube.alive) return;
  const block = blockerOf(cube);
  if (block) {
    bump(cube, block);
    sfx.thud();
    return;
  }

  const toGate = cube.color === activeColor();
  if (!toGate && state.tray.length >= state.traySize) {
    // No room left: the cube bounces back and the level is lost.
    bump(cube, null);
    sfx.thud();
    endLose('Η ουρά γέμισε. Δεν υπήρχε θέση για άλλον κύβο.');
    return;
  }

  cube.alive = false;
  state.grid.delete(key(cube.x, cube.y, cube.z));
  cube.mesh.material = materials(cube.color, cube.dir);
  flyAway(cube);

  if (toGate) {
    state.gateFill++;
    sfx.whoosh();
  } else {
    state.tray.push(cube.color);
    state.peakTray = Math.max(state.peakTray, state.tray.length);
    sfx.tray();
  }
  resolveGates();
}

// Close full gates, bring in the next one and pull matching cubes from the tray.
function resolveGates() {
  let arrived = false;
  while (state.gateFill >= GATE_SIZE) {
    state.gateIndex++;
    state.gateFill = 0;
    arrived = true;
    if (state.gateIndex >= state.gates.length) break;
    const c = activeColor();
    for (let i = 0; i < state.tray.length && state.gateFill < GATE_SIZE;) {
      if (state.tray[i] === c) { state.tray.splice(i, 1); state.gateFill++; } else i++;
    }
  }
  if (arrived) setTimeout(() => sfx.gate(), 120);
  render({ arrived });

  if (state.gateIndex >= state.gates.length) {
    state.over = true;
    setTimeout(win, 700);
    return;
  }
  // Stuck: tray is full and no free cube matches the open gate.
  if (state.tray.length >= state.traySize && !freeCubes().some((c) => c.color === activeColor())) {
    setTimeout(() => endLose('Η ουρά γέμισε και κανένας ελεύθερος κύβος δεν ταιριάζει με την πύλη.'), 500);
    state.over = true;
  }
}

// ---------- Animations ----------
function flyAway(cube) {
  const d = new THREE.Vector3(...DIRS[cube.dir]);
  const start = cube.mesh.position.clone();
  anims.push({
    t: 0, dur: 0.6,
    step(t) {
      cube.mesh.position.copy(start).addScaledVector(d, (t * t * 1.6 + t * 0.4) * 18);
      cube.mesh.scale.setScalar(Math.max(1 - Math.max(0, (t - 0.5) / 0.5), 0.001));
    },
    done() { root.remove(cube.mesh); },
  });
}

function bump(cube, block) {
  const d = new THREE.Vector3(...DIRS[cube.dir]);
  const start = new THREE.Vector3(cube.x, cube.y, cube.z);
  const reach = block ? block.steps - 1 + 0.12 : 0.5;
  const set = (c, v) => { if (c.alive) c.mesh.material = materials(c.color, c.dir, v); };
  set(cube, ERROR);
  if (block) set(block.cube, ERROR);
  anims.push({
    t: 0, dur: 0.35 + reach * 0.05,
    step(t) {
      const k = t < 0.5 ? (t / 0.5) ** 2 : 1 - (t - 0.5) / 0.5;
      cube.mesh.position.copy(start).addScaledVector(d, k * reach);
    },
    done() {
      cube.mesh.position.copy(start);
      setTimeout(() => { set(cube, NORMAL); if (block) set(block.cube, NORMAL); }, 250);
    },
  });
  const base = state.offset;
  anims.push({
    t: 0, dur: 0.3,
    step(t) {
      const a = (1 - t) * 0.1;
      root.position.set(base.x + Math.sin(t * 60) * a, base.y, base.z + Math.cos(t * 50) * a);
    },
    done() { root.position.copy(base); },
  });
}

function pulse(cube) {
  cube.mesh.material = materials(cube.color, cube.dir, HINT);
  anims.push({
    t: 0, dur: 1.6,
    step(t) { if (cube.alive) cube.mesh.scale.setScalar(1 + Math.sin(t * Math.PI * 4) * 0.12); },
    done() {
      if (!cube.alive) return;
      cube.mesh.scale.setScalar(1);
      cube.mesh.material = materials(cube.color, cube.dir);
    },
  });
}

// ---------- Hints ----------
function useHint() {
  if (state.over || state.hints <= 0) return;
  const camDir = camera.position.clone().normalize();
  const matching = freeCubes().filter((c) => c.color === activeColor());
  if (!matching.length) {
    toast('Κανένας ελεύθερος κύβος δεν ταιριάζει με την πύλη. Βάλε κάποιον στην ουρά.');
    return;
  }
  // Pick the one facing the camera so the hint is visible.
  const score = (c) => c.mesh.getWorldPosition(new THREE.Vector3()).dot(camDir);
  const best = matching.reduce((a, b) => (score(b) > score(a) ? b : a));
  state.hints--;
  pulse(best);
  sfx.gate();
  render();
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

// ---------- HUD ----------
function render({ arrived = false } = {}) {
  ui.level.textContent = `Επίπεδο ${state.level}`;
  ui.left.textContent = `${state.grid.size} κύβοι`;
  ui.hintCount.textContent = state.hints;
  ui.hint.disabled = state.hints <= 0;
  ui.sound.textContent = state.muted ? '🔇' : '🔊';

  const total = state.gates.length;
  const done = Math.min(state.gateIndex, total);
  ui.gateCount.textContent = `Πύλη ${Math.min(done + 1, total)}/${total}`;

  const c = activeColor();
  if (c === undefined) {
    ui.gate.innerHTML = '<div class="gate-done">✓</div>';
  } else {
    const slots = Array.from({ length: GATE_SIZE }, (_, i) =>
      `<span class="slot${i < state.gateFill ? ' filled' : ''}"></span>`).join('');
    ui.gate.innerHTML = `
      <div class="gate-card${arrived ? ' arrive' : ''}" style="--c:${COLORS[c].css}" aria-label="Ανοιχτή πύλη: ${COLORS[c].name}">
        <div class="gate-symbol">${svgSymbol(c)}</div>
        <div class="gate-slots">${slots}</div>
      </div>`;
  }
  ui.queue.innerHTML = state.gates.slice(state.gateIndex + 1, state.gateIndex + 4)
    .map((q) => `<div class="queue-chip" style="--c:${COLORS[q].css}">${svgSymbol(q)}</div>`).join('');

  ui.tray.innerHTML = Array.from({ length: state.traySize }, (_, i) => {
    const t = state.tray[i];
    return t === undefined
      ? '<div class="tray-slot"></div>'
      : `<div class="tray-slot full" style="--c:${COLORS[t].css}">${svgSymbol(t)}</div>`;
  }).join('');
  ui.tray.classList.toggle('danger', state.tray.length >= state.traySize - 1);
}

let toastTimer = 0;
function toast(msg, ms = 3000) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
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
  store.set('gates.level', next);
  sfx.win();
  const stars = state.peakTray <= 1 ? 3 : state.peakTray <= 3 ? 2 : 1;
  showOverlay({
    title: 'Μπράβο!',
    text: `Γέμισες όλες τις πύλες. Η ουρά έφτασε μέχρι ${state.peakTray}/${state.traySize}.`,
    stars,
    button: 'Επόμενο επίπεδο',
    action: () => loadLevel(next),
  });
}

function endLose(text) {
  state.over = true;
  setTimeout(() => showOverlay({
    title: 'Κόλλησες',
    text,
    button: 'Ξανά',
    action: () => loadLevel(state.level),
  }), 350);
}

ui.hint.addEventListener('click', useHint);
ui.restart.addEventListener('click', () => loadLevel(state.level));
ui.sound.addEventListener('click', () => {
  state.muted = !state.muted;
  store.set('gates.muted', state.muted);
  render();
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
  const tone = (freq, to, dur, type = 'sine', vol = 0.14, delay = 0) => {
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
    whoosh: () => tone(520 + Math.random() * 120, 1500, 0.16, 'triangle', 0.12),
    tray: () => tone(300, 220, 0.14, 'triangle', 0.12),
    thud: () => tone(150, 60, 0.22, 'square', 0.1),
    gate: () => [660, 880].forEach((f, i) => tone(f, f, 0.18, 'sine', 0.1, i * 0.07)),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.35, 'sine', 0.12, i * 0.09)),
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
if (!store.get('gates.seenHelp', false)) {
  toast('Στείλε κάθε κύβο στην πύλη του χρώματός του. Ό,τι δεν ταιριάζει πάει στην ουρά. Αν γεμίσει η ουρά, χάνεις.', 6000);
  store.set('gates.seenHelp', true);
}

// Exposed for automated testing.
window.__game = { state, loadLevel, tapCube, blockerOf, freeCubes };
