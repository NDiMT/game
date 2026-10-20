// SPASE! v2 — renderer, quality tiers, input (hold / aim / flick), camera rig, HUD, prewarm, frame loop.
import * as THREE from 'three';
import { Sprites } from './fx.js';
import { Sfx } from './audio.js';
import { createCore, AMMO_START } from './core.js';
import { SCENES } from './scenes.js';
import { buildMaterials, buildWorld, puffTexture, Post } from './look.js';
import { ThemeManager, THEMES } from './themes.js';

const params = new URLSearchParams(location.search);
const DEV = params.has('dev');
const store = {
  get(k, d) { try { const v = localStorage.getItem('spase.' + k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('spase.' + k, v); } catch (e) { /* private mode */ } },
};
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const $ = (id) => document.getElementById(id);
const now = () => performance.now();

// ---------------------------------------------------------------- renderer + quality tiers
const wrap = $('wrap'), canvas = $('c');
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
// tier 3: post + 2048 shadows + DPR 2 | 2: post, 1024 shadows, DPR 1.6 | 1: no post, DPR 1.3 | 0: no shadows, DPR 1
const TIERS = [
  { post: false, shadow: 0, pr: 1 },
  { post: false, shadow: 1024, pr: 1.3 },
  { post: true, shadow: 1024, pr: 1.6 },
  { post: true, shadow: 2048, pr: 2 },
];
let tier = clamp(+(params.get('q') ?? store.get('tier', 3)), 0, 3);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 0.5, 0.1, 140);
const CAM_POS = new THREE.Vector3(0, 2.3, 8.2), CAM_LOOK = new THREE.Vector3(0, 1.3, 0);
camera.position.copy(CAM_POS);
camera.lookAt(CAM_LOOK);

const BOOT = { t0: now() };
const M = buildMaterials(renderer);
BOOT.mats = now() - BOOT.t0;
const W0 = buildWorld(renderer, scene);
BOOT.world = now() - BOOT.t0 - BOOT.mats;
const post = new Post(renderer);
const puff = puffTexture();
const sprites = {
  dust: new Sprites(scene, 600, { mode: 0, map: puff, order: 7 }),
  fire: new Sprites(scene, 120, { mode: 0, map: puff, additive: true, boost: 2.2, order: 8 }),
  spark: new Sprites(scene, 700, { mode: 1, additive: true, boost: 5, order: 9 }),
  glint: new Sprites(scene, 300, { mode: 2, additive: true, boost: 4, order: 9 }),
};
// ambient particles owned by the environment theme (snow, dust motes, chimney smoke)
const ambient = new Sprites(scene, 500, { mode: 0, map: puff, order: 6 });
const themes = new ThemeManager({ renderer, scene, base: W0, ambient, post });

// ---------------------------------------------------------------- fake contact shadows (soft blobs under objects)
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const BLOBS = 260;
const blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.55, fog: false }), BLOBS);
blobs.count = 0; blobs.frustumCulled = false; blobs.renderOrder = 1;
scene.add(blobs);
const _bm = new THREE.Matrix4(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3(), _bq = new THREE.Quaternion();
function updateBlobs() {
  let n = 0;
  const put = (x, z, size, h) => {
    if (n >= BLOBS || h > 0.9) return;
    const k = 1 - h / 0.9, sz = size * (0.6 + 0.4 * k) * k + 0.05;
    _bm.compose(_bp.set(x, 0.016, z), _bq, _bs.set(sz, 1, sz));
    blobs.setMatrixAt(n++, _bm);
  };
  for (const it of G.items) {
    if (it.dead) continue;
    const b = it.body;
    if (b.world && b.aabbNeedsUpdate) b.updateAABB();
    const a = b.aabb;
    if (!b.world) { const r = b.boundingRadius; put(b.position.x, b.position.z, r * 1.4, b.position.y - r + (it.h ? it.h.yo || 0 : it.yo)); continue; }
    put((a.lowerBound.x + a.upperBound.x) / 2, (a.lowerBound.z + a.upperBound.z) / 2, Math.max(a.upperBound.x - a.lowerBound.x, a.upperBound.z - a.lowerBound.z) * 1.15 + 0.08, a.lowerBound.y);
  }
  for (const p of G.projs) if (!p.dead) put(p.body.position.x, p.body.position.z, 0.5, p.body.position.y - 0.2);
  blobs.count = n;
  blobs.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- theme switching (fade through the theme colour)
const fadeEl = document.getElementById('fade');
let transitioning = false;
function tintUI(name) {
  const u = THEMES[name].ui, r = document.documentElement.style;
  r.setProperty('--glass', u.glass); r.setProperty('--accent', u.a2); r.setProperty('--accent2', u.a1); r.setProperty('--bg', u.bg);
  document.body.dataset.theme = name;
}
function goScene(sceneName, themeName) {
  const th = themeName || themes.pickFor(sceneName);
  themes.apply(th);
  tintUI(th);
  for (const k in sprites) sprites[k].n = 0; // the old scene's smoke / sparks don't follow into the new environment
  G.startScene(sceneName);
}

// ---------------------------------------------------------------- core + hooks
const sfx = new Sfx();
sfx.build();
let kind = store.get('kind', 'ball');
const G = createCore({
  scene, mats: M, sfx, sprites,
  hooks: {
    smash: () => {},
    combo: (n, mat) => showCombo(n, mat),
    earn: (k) => earnPop(k),
    cleared: () => { banner(); sfx.fanfare(); vibrate([15, 40, 15]); },
    impact: (k, x, y, z, bomb) => cam.kick(k, x, y, z, bomb),
    flash: (x, y, z) => { W0.flash.position.set(x, y + 0.3, z); flashT = 0.4; },
    ammo: () => ammoUI(),
  },
});
if (!G.PROJ[kind]) kind = 'ball';
G.next = () => {
  if (transitioning) return;
  transitioning = true;
  const n = G.pickNext(), th = themes.pickFor(n);
  fadeEl.style.setProperty('--fade', THEMES[th].ui.bg);
  fadeEl.classList.add('on');
  setTimeout(() => { goScene(n, th); requestAnimationFrame(() => { fadeEl.classList.remove('on'); transitioning = false; }); }, 420);
};
let flashT = 0;
let lastVib = 0;
function vibrate(p) {
  if (!navigator.vibrate || G.rtime - lastVib < 0.08) return;
  lastVib = G.rtime;
  try { navigator.vibrate(p); } catch (e) { /* not allowed */ }
}

// ---------------------------------------------------------------- camera rig: springs + smooth shake
const cam = {
  look: new THREE.Vector3(), lookV: new THREE.Vector3(), lookT: new THREE.Vector3(),
  push: 0, pushV: 0, pushT: 0, shake: 0, fov: 0, fovT: 0, holdT: 0, t: 0,
  kick(k, x, y, z, bomb) {
    this.lookT.set((x - CAM_LOOK.x) * 0.12 * k, (y - CAM_LOOK.y) * 0.08 * k, 0);
    this.pushT = (bomb ? 0.5 : 0.25) * k;
    this.holdT = bomb ? 0.5 : 0.25;
    this.shake = Math.min(1, this.shake + (bomb ? 0.9 : 0.35 * k));
    if (bomb) this.fov = -3;
    vibrate(bomb ? [30, 20, 70] : k > 0.6 ? 26 : 12);
  },
  update(dt) {
    this.t += dt;
    if ((this.holdT -= dt) <= 0) { this.lookT.multiplyScalar(Math.exp(-dt * 3)); this.pushT *= Math.exp(-dt * 3); }
    // critically damped springs (smooth follow, no snapping)
    const k = 60, c = 2 * Math.sqrt(k);
    this.lookV.x += ((this.lookT.x - this.look.x) * k - this.lookV.x * c) * dt;
    this.lookV.y += ((this.lookT.y - this.look.y) * k - this.lookV.y * c) * dt;
    this.look.addScaledVector(this.lookV, dt);
    this.pushV += ((this.pushT - this.push) * k - this.pushV * c) * dt;
    this.push += this.pushV * dt;
    this.shake *= Math.exp(-dt * 5);
    this.fov *= Math.exp(-dt * 4);
    const s = this.shake * this.shake * 0.12, t = this.t;
    const sx = s * (Math.sin(t * 37.1) * 0.6 + Math.sin(t * 61.7) * 0.4), sy = s * (Math.sin(t * 43.3) * 0.6 + Math.sin(t * 71.9) * 0.4);
    camera.position.set(CAM_POS.x + sx + this.look.x * 0.3, CAM_POS.y + sy, CAM_POS.z - this.push);
    camera.lookAt(CAM_LOOK.x + this.look.x, CAM_LOOK.y + this.look.y + sy * 0.5, CAM_LOOK.z);
    camera.rotateZ(s * 0.2 * Math.sin(t * 29));
    const f = baseFov + this.fov;
    if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
  },
};

// ---------------------------------------------------------------- HUD
const numEl = $('num'), progEl = $('progv'), comboEl = $('combo'), comboSub = $('combosub'), bannerEl = $('banner'), hintEl = $('hint');
const WORDS = { glass: ['SHATTER', 'KRSSH', 'TINKLE'], brick: ['CRASH', 'CRUMBLE', 'WHAM'], metal: ['CLANG', 'BONK', 'KLONK'], wood: ['CRACK', 'SNAP', 'THWACK'] };
function showCombo(n, mat) {
  const w = WORDS[mat] || WORDS.brick;
  comboEl.firstChild.textContent = 'x' + n;
  comboSub.textContent = w[(Math.random() * w.length) | 0];
  comboEl.style.setProperty('--s', String(Math.min(1.3, 0.85 + n * 0.035)));
  comboEl.style.setProperty('--r', `${rnd(-6, 6).toFixed(1)}deg`);
  comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop');
}
function banner() {
  comboEl.classList.remove('pop');
  bannerEl.classList.remove('show'); void bannerEl.offsetWidth; bannerEl.classList.add('show');
}
const btns = {};
document.querySelectorAll('#bar button').forEach((b) => {
  btns[b.dataset.k] = b;
  b.addEventListener('click', () => {
    sfx.unlock();
    const k = b.dataset.k;
    if (!G.canThrow(k)) { sfx.empty(); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
    sfx.click();
    setKind(k);
  });
});
function setKind(k) {
  kind = k; store.set('kind', k);
  for (const key in btns) btns[key].classList.toggle('on', key === k);
  held.setKind(k);
}
function ammoUI() {
  for (const k in btns) {
    const b = btns[k], badge = b.querySelector('.badge');
    if (k === 'ball') continue;
    const n = G.ammo[k];
    if (badge.textContent !== String(n)) { badge.textContent = n; badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
    b.classList.toggle('empty', n <= 0);
  }
  if (!G.canThrow(kind)) setKind('ball');
}
// "+1" pop flying from the middle of the screen into the picker slot
const popPool = [...document.querySelectorAll('.earn')];
let popI = 0;
function earnPop(k) {
  const el = popPool[popI++ % popPool.length], b = btns[k];
  el.innerHTML = '+1 ' + b.querySelector('svg').outerHTML;
  const wr = wrap.getBoundingClientRect(), br = b.getBoundingClientRect();
  el.style.setProperty('--tx', `${br.left + br.width / 2 - wr.left - wr.width / 2}px`);
  el.style.setProperty('--ty', `${br.top - wr.top - wr.height * 0.42}px`);
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  sfx.earn();
  setTimeout(() => { b.classList.remove('got'); void b.offsetWidth; b.classList.add('got'); }, 650);
}
const muteBtn = $('bMute');
const setMute = (m) => { sfx.setMuted(m); muteBtn.classList.toggle('muted', m); store.set('mute', m ? '1' : '0'); };
setMute(store.get('mute', '0') === '1');
muteBtn.addEventListener('click', () => { sfx.unlock(); setMute(!sfx.muted); sfx.click(); });
$('bNew').addEventListener('click', () => { sfx.unlock(); sfx.click(); if (G.state === 'play' || G.state === 'cleared') G.next(); });
for (const el of document.querySelectorAll('button')) el.addEventListener('pointerdown', (e) => e.stopPropagation());
let hinted = store.get('hinted', '0') === '1';

// ---------------------------------------------------------------- held projectile + trajectory hint
const held = {
  meshes: {}, cur: null,
  setKind(k) { if (this.cur) this.cur.visible = false; this.cur = this.meshes[k]; },
};
for (const k in G.PROJ) { const m = G.K.projMesh(k); m.visible = false; scene.add(m); held.meshes[k] = m; }
held.cur = held.meshes[kind];
const DOTS = 22;
const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }), DOTS);
dots.count = 0; dots.frustumCulled = false; dots.renderOrder = 10;
scene.add(dots);
const _m4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), groundPl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ndc = new THREE.Vector2(), _aim = new THREE.Vector3(), _from = new THREE.Vector3(), _vel = new THREE.Vector3();
function rayAt(nx, ny) { _ndc.set(nx, ny); ray.setFromCamera(_ndc, camera); return ray.ray; }
function aimPoint(nx, ny, out) {
  const r = rayAt(nx, ny);
  if (!r.intersectPlane(plane, out) || out.y < 0) { if (!r.intersectPlane(groundPl, out)) out.copy(r.direction).multiplyScalar(20).add(r.origin); }
  out.y = Math.min(out.y, 7);
  return out;
}
function heldPoint(nx, ny, out) {
  const r = rayAt(nx, ny);
  out.copy(r.direction).multiplyScalar(2.1).add(r.origin);
  out.y = Math.max(out.y, 0.4);
  return out;
}
// samples: finger history; returns launch velocity into _vel from _from
function computeLaunch(p, t) {
  const r = canvas.getBoundingClientRect();
  const last = p.s[p.s.length - 1];
  let first = p.s[0];
  for (const s of p.s) if (t - s.t <= 110) { first = s; break; }
  const dtm = Math.max(16, last.t - first.t) / 1000;
  const vx = (last.x - first.x) / dtm, vy = (last.y - first.y) / dtm, v = Math.hypot(vx, vy);
  const travel = Math.hypot(last.x - p.x0, last.y - p.y0);
  let ax = last.x, ay = last.y, speed = 21;
  if (!(travel < 14 || v < 220)) {
    ax = clamp(last.x + vx * 0.12, r.left, r.right); ay = clamp(last.y + vy * 0.12, r.top, r.bottom);
    speed = clamp(9 + 6.5 * (v / r.height), 11, 27);
  }
  speed *= G.PROJ[kind].speed;
  heldPoint(((last.x - r.left) / r.width) * 2 - 1, -(((last.y - r.top) / r.height) * 2 - 1), _from);
  aimPoint(((ax - r.left) / r.width) * 2 - 1, -(((ay - r.top) / r.height) * 2 - 1), _aim);
  const d = _vel.copy(_aim).sub(_from), T = Math.max(0.05, d.length() / speed);
  d.divideScalar(T);
  d.y += 0.5 * 9.82 * T;
  return speed;
}
function drawArc() {
  let n = 0;
  for (let i = 1; i <= DOTS; i++) {
    const t = i * 0.045;
    _p.set(_from.x + _vel.x * t, _from.y + _vel.y * t - 4.91 * t * t, _from.z + _vel.z * t);
    if (_p.y < 0 || _p.z < -2.5) break;
    const s = 0.03 * (1 - i / (DOTS + 4));
    _s.set(s, s, s);
    dots.setMatrixAt(n++, _m4.compose(_p, _q, _s));
  }
  dots.count = n;
  dots.instanceMatrix.needsUpdate = true;
}
let ptr = null;
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (ptr) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* synthetic */ }
  const t = now();
  ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, s: [{ x: e.clientX, y: e.clientY, t }] };
  if (!G.canThrow(kind)) setKind('ball');
  held.cur.visible = true;
  computeLaunch(ptr, t);
  held.cur.position.copy(_from);
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  ptr.s.push({ x: e.clientX, y: e.clientY, t: now() });
  if (ptr.s.length > 14) ptr.s.shift();
});
canvas.addEventListener('pointerup', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  ptr.s.push({ x: e.clientX, y: e.clientY, t: now() });
  const speed = computeLaunch(ptr, now());
  ptr = null;
  held.cur.visible = false;
  dots.count = 0;
  const p = G.throw(kind, _from, _vel);
  if (p) {
    sfx.whoosh(speed);
    if (!hinted) { hinted = true; store.set('hinted', '1'); hintEl.classList.remove('show'); }
    if (!G.canThrow(kind)) setKind('ball');
  }
});
canvas.addEventListener('pointercancel', (e) => { if (ptr && e.pointerId === ptr.id) { ptr = null; held.cur.visible = false; dots.count = 0; } });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---------------------------------------------------------------- resize / tiers
let baseFov = 50, W = 0, H = 0;
function applyTier() {
  const T = TIERS[tier];
  const pr = Math.min(DPR, T.pr);
  renderer.setPixelRatio(pr);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = T.shadow > 0;
  W0.sun.castShadow = T.shadow > 0;
  if (T.shadow && W0.sun.shadow.mapSize.x !== T.shadow) { W0.sun.shadow.mapSize.set(T.shadow, T.shadow); if (W0.sun.shadow.map) { W0.sun.shadow.map.dispose(); W0.sun.shadow.map = null; } }
  post.setSize(Math.round(W * pr), Math.round(H * pr), pr < 1.6 ? 4 : 0);
  const sc = 1; // sprite sizes are in world units
  void sc;
}
function resize() {
  const iw = window.innerWidth, ih = window.innerHeight;
  let w = iw, h = ih, framed = false;
  if (iw / ih > 0.66) { h = ih; w = Math.round(Math.min(iw, ih * 0.5)); framed = true; }
  W = w; H = h;
  wrap.style.width = w + 'px';
  wrap.style.height = h + 'px';
  document.body.classList.toggle('framed', framed);
  camera.aspect = w / h;
  baseFov = clamp((2 * Math.atan(1.95 / 8.3 / camera.aspect) * 180) / Math.PI, 46, 66);
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  applyTier();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();
let ema = 1 / 60, perfT = 0, warm = 0;
function adaptQuality(rdt) {
  if (DEV || params.has('q')) return;
  if (warm < 3) { warm += rdt; return; } // ignore the first seconds (prewarm, scene build)
  ema += (rdt - ema) * 0.04;
  perfT += rdt;
  if (perfT > 2 && ema > 1 / 48 && tier > 0) {
    perfT = 0; tier--; store.set('tier', tier); applyTier(); ema = 1 / 60; warm = 1.5;
  } else if (perfT > 2) perfT = 0;
}

// ---------------------------------------------------------------- prewarm: compile every material/effect during the splash
async function prewarm() {
  const grp = new THREE.Group();
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  // one mesh per material (regular + instanced variants) so every shader program exists before play
  const INST = new Set([M.brick, M.crate, M.wood, M.glass, M.bottle, M.shard]);
  const mats = new Set([...Object.values(M).filter((m) => m && m.isMaterial), ...M.allPaint()]);
  let i = 0;
  for (const m of mats) {
    const mesh = new THREE.Mesh(box, m);
    mesh.position.set((i % 10) * 0.12 - 0.6, 1 + Math.floor(i / 10) * 0.12, 5);
    mesh.castShadow = true;
    grp.add(mesh);
    if (!INST.has(m)) { i++; continue; }
    const im = new THREE.InstancedMesh(box, m, 1);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3).fill(1), 3);
    im.setMatrixAt(0, mesh.matrix.compose(mesh.position, mesh.quaternion, mesh.scale));
    im.castShadow = true;
    grp.add(im);
    i++;
  }
  scene.add(grp);
  // make every effect system draw at least once
  sprites.dust.emit(0, 1, 5, 0, 0, 0, 0.05, 0.1, 1, 1, 1);
  sprites.fire.emit(0, 1, 5, 0, 0, 0, 0.05, 0.1, 1, 1, 1);
  sprites.spark.emit(0, 1, 5, 0, 1, 0, 0.05, 0.05, 1, 1, 1, 0, 0, 0, 1, 0.03);
  sprites.glint.emit(0, 1, 5, 0, 0, 0, 0.05, 0.05, 1, 1, 1);
  const sh = G.shards.alloc(); sh.p.set(0, 1, 5); sh.q.identity(); sh.L.makeScale(0.05, 0.05, 0.01); sh.v.set(0, 0, 0); sh.w.set(0, 0, 0); sh.color.set(0xffffff); sh.life = 0.05;
  for (const k in held.meshes) { held.meshes[k].visible = true; held.meshes[k].position.set(rnd(-0.5, 0.5), 1, 5); }
  dots.count = 1;
  W0.flash.intensity = 0.001;
  for (const k in themes.T) themes.T[k].group.visible = true;
  ambient.emit(0, 1, 5, 0, 0, 0, 0.05, 0.1, 1, 1, 1); ambient.update(0);
  blobs.count = 1;
  for (const k in sprites) sprites[k].update(0);
  G.shards.update(0);
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  renderFrame(0);
  for (const k in themes.T) themes.T[k].group.visible = false;
  blobs.count = 0;
  scene.remove(grp);
  for (const k in held.meshes) held.meshes[k].visible = false;
  dots.count = 0;
}

// ---------------------------------------------------------------- frame loop
const prof = { phys: 0, logic: 0, render: 0, frame: 0, n: 0, acc: { phys: 0, logic: 0, render: 0, frame: 0 } };
function renderFrame(t) {
  if (TIERS[tier].post) post.render(scene, camera, t);
  else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
}
let lastT = now(), shown = 0, started = false;
function frame(tms) {
  requestAnimationFrame(frame);
  const t0 = now();
  renderer.info.reset();
  let rdt = (t0 - lastT) / 1000;
  lastT = t0;
  if (!(rdt > 0)) rdt = 0;
  if (rdt > 0.1) rdt = 0.1; // delta clamp
  if (started) G.update(rdt);
  const t1 = now();
  // held projectile & trajectory preview follow the finger
  if (ptr) {
    computeLaunch(ptr, t0);
    held.cur.position.lerp(_from, 0.6);
    held.cur.rotation.y += rdt * 2;
    drawArc();
  }
  G.sync();
  cam.update(rdt);
  W0.skyMat.uniforms.uT.value += rdt * 0.0015;
  themes.update(rdt);
  ambient.update(rdt);
  updateBlobs();
  // glass catches the light: occasional star glints on intact panes / bottles
  if (started && Math.random() < rdt * 2.5 && G.items.length) {
    const it = G.items[(Math.random() * G.items.length) | 0];
    if (!it.dead && it.mat === 'glass') { const p = it.body.interpolatedPosition, sz = it.size; G.glintAt(p.x + (sz ? (Math.random() - 0.5) * sz.x : 0), p.y + (sz ? (Math.random() - 0.5) * sz.y : 0.08) + (it.h ? it.h.yo || 0 : 0), p.z + 0.03); }
  }
  if (flashT > 0) { flashT -= rdt; W0.flash.intensity = Math.max(0, flashT / 0.4) * 350; } else W0.flash.intensity = 0;
  // HUD
  if (shown < G.count) {
    shown = Math.min(G.count, shown + Math.max(1, Math.ceil((G.count - shown) * rdt * 8)));
    numEl.textContent = shown;
    numEl.classList.remove('tick'); void numEl.offsetWidth; numEl.classList.add('tick');
  }
  progEl.style.transform = `scaleX(${G.progress || 0})`;
  const t2 = now();
  renderFrame(tms / 1000);
  const t3 = now();
  prof.n++;
  prof.acc.phys += G.prof.phys; prof.acc.logic += t2 - t1; prof.acc.render += t3 - t2; prof.acc.frame += t3 - t0;
  if (prof.n >= 30) {
    for (const k in prof.acc) { prof[k] = prof.acc[k] / prof.n; prof.acc[k] = 0; }
    prof.n = 0;
    if (perfEl) perfEl.textContent = `tier ${tier} | frame ${prof.frame.toFixed(1)}ms phys ${prof.phys.toFixed(1)} render ${prof.render.toFixed(1)} | calls ${renderer.info.render.calls} tris ${(renderer.info.render.triangles / 1000).toFixed(0)}k | bodies ${G.world.bodies.length}`;
  }
  adaptQuality(rdt);
}
const perfEl = params.has('perf') ? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'perf' })) : null;

// ---------------------------------------------------------------- boot
setKind(kind);
ammoUI();
requestAnimationFrame(frame);
const splashStart = now();
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
themes.buildAll(nextFrame).then(() => { BOOT.themes = now() - splashStart; return prewarm(); }).then(() => {
  BOOT.prewarm = now() - splashStart;
  const first = SCENES[params.get('scene')] ? params.get('scene') : 'wall';
  const th = THEMES[params.get('theme')] ? params.get('theme') : null;
  const wait = Math.max(0, 1100 - (now() - splashStart));
  setTimeout(() => {
    goScene(first, th);
    started = true;
    $('splash').classList.add('gone');
    if (!hinted) setTimeout(() => hintEl.classList.add('show'), 900);
  }, wait);
});

if (DEV) {
  window.__G = {
    G, world: G.world, renderer, prof, BOOT,
    get state() { return G.state; },
    setKind: (k) => { if (G.canThrow(k)) setKind(k); else setKind('ball'); },
    // throw from the bottom-centre "hand" at screen point (nx, ny) like a tap
    throwAt: (nx, ny, speed = 21) => {
      heldPoint(nx * 0.5, -0.7, _from); aimPoint(nx, ny, _aim);
      const d = _vel.copy(_aim).sub(_from), T = d.length() / (speed * G.PROJ[kind].speed); d.divideScalar(T); d.y += 0.5 * 9.82 * T;
      const p = G.throw(kind, _from, _vel);
      if (p && !G.canThrow(kind)) setKind('ball');
      return !!p;
    },
    scene: (n, th) => goScene(n, th),
    themes: () => Object.keys(THEMES),
    get theme() { return themes.cur; },
    stats: () => ({ bodies: G.world.bodies.length, items: G.items.length, debris: G.debris.filter((d) => !d.gone).length, shards: G.shards.live, projs: G.projs.filter((p) => !p.dead).length, count: G.count, prog: +(G.progress || 0).toFixed(2), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, state: G.state, scene: G.sceneName, theme: themes.cur, ammo: { ...G.ammo }, tier, guard: { ...G.guard } }),
  };
}
void AMMO_START;
