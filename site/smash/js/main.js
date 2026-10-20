// SPASE! — a relaxing destruction toy. Three.js rendering + cannon-es physics.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Particles, Shards } from './fx.js';
import { Sfx } from './audio.js';
import { setupThings, GR } from './things.js';
import { SCENES, SCENE_NAMES } from './scenes.js';

const params = new URLSearchParams(location.search);
const DEV = params.has('dev');
const store = {
  get(k, d) { try { const v = localStorage.getItem('spase.' + k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('spase.' + k, v); } catch (e) { /* private mode */ } },
};
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------- renderer / scene
const wrap = document.getElementById('wrap');
const canvas = document.getElementById('c');
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: DPR < 1.5, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 0.5, 0.1, 140);
const CAM_POS = new THREE.Vector3(0, 2.3, 8.2), CAM_LOOK = new THREE.Vector3(0, 1.35, 0);
camera.position.copy(CAM_POS);
camera.lookAt(CAM_LOOK);
const camQ = camera.quaternion.clone();

{
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#5db8ff'); gr.addColorStop(0.45, '#a9dcff'); gr.addColorStop(0.62, '#ffe9d2'); gr.addColorStop(1, '#ffe2c4');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}
scene.fog = new THREE.Fog(0xf6e6d0, 22, 70);

// environment map for glass / metal reflections (generated once)
{
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 top = vec3(0.35,0.62,1.0); vec3 hor = vec3(1.0,0.95,0.88); vec3 gr = vec3(0.45,0.55,0.38); vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.6)) : mix(hor, gr, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }',
  })));
  const box = (w, h, x, y, z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  box(6, 2.5, 2, 6, 6, 5); box(3, 6, -8, 2, 1, 3); box(4, 1.5, 6, 3, -5, 2.5);
  scene.environment = pm.fromScene(env, 0.02).texture;
  scene.environmentIntensity = 0.75;
  pm.dispose();
}

scene.add(new THREE.HemisphereLight(0xe8f5ff, 0xb8a58a, 0.8));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.3);
sun.position.set(3.5, 9, 5.5);
sun.target.position.set(0, 0.8, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4.5, bottom: -3, near: 2, far: 25 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const flashLight = new THREE.PointLight(0xffb060, 0, 14, 2);
scene.add(flashLight);

// ground: grass + a sandy "range" lane + soft hills
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x7dc46c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const lc = document.createElement('canvas');
  lc.width = 64; lc.height = 64;
  const g = lc.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, 'rgba(226,196,146,0)'); gr.addColorStop(0.12, 'rgba(226,196,146,1)'); gr.addColorStop(0.88, 'rgba(226,196,146,1)'); gr.addColorStop(1, 'rgba(226,196,146,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const lt = new THREE.CanvasTexture(lc);
  lt.colorSpace = THREE.SRGBColorSpace;
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 26), new THREE.MeshStandardMaterial({ map: lt, transparent: true, roughness: 1, depthWrite: false }));
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.003, -1);
  lane.receiveShadow = true;
  scene.add(lane);
  const hillMat = [0x8fcf86, 0x7cc47e, 0xa6dc90].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  const hg = new THREE.SphereGeometry(1, 20, 10);
  [[-16, -34, 12, 4], [6, -40, 16, 5.5], [24, -30, 10, 3.5], [-34, -26, 12, 4], [36, -44, 14, 6]].forEach(([x, z, r, h], i) => {
    const m = new THREE.Mesh(hg, hillMat[i % 3]);
    m.position.set(x, 0, z); m.scale.set(r, h, r * 0.7);
    scene.add(m);
  });
}

// ---------------------------------------------------------------- physics
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0), allowSleep: true });
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 8;
world.solver.tolerance = 0.001;
world.quatNormalizeFast = true;
world.quatNormalizeSkip = 2;
const pm = { gen: new CANNON.Material('gen'), metal: new CANNON.Material('metal'), ground: new CANNON.Material('ground'), proj: new CANNON.Material('proj') };
world.defaultContactMaterial.friction = 0.5;
world.defaultContactMaterial.restitution = 0.08;
const cm = (a, b, friction, restitution) => world.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction, restitution }));
cm(pm.gen, pm.gen, 0.55, 0.05);
cm(pm.gen, pm.ground, 0.6, 0.08);
cm(pm.metal, pm.ground, 0.4, 0.32);
cm(pm.metal, pm.gen, 0.4, 0.25);
cm(pm.metal, pm.metal, 0.3, 0.35);
cm(pm.proj, pm.ground, 0.5, 0.3);
cm(pm.proj, pm.gen, 0.4, 0.15);
cm(pm.proj, pm.metal, 0.3, 0.35);
{
  const gb = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: pm.ground, collisionFilterGroup: GR.GROUND, collisionFilterMask: 15 });
  gb.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(gb);
}

// ---------------------------------------------------------------- game state
const sfx = new Sfx();
const G = {
  scene, world, camera, sfx, pm,
  items: [], metals: [], debris: [], projs: [], dying: [], hits: [], breakQ: [], newBodies: [],
  totalW: 0, doneW: 0, count: 0, time: 0, rtime: 0,
};
G.dust = new Particles(scene, 700);
G.spark = new Particles(scene, 700, { additive: true, star: true });
const K = setupThings(G);
G.shards = new Shards(scene, G.mats.shard, 420);

let state = 'intro', stateT = 0, introDur = 1, sceneName = '';
let hitstopT = 0, slowT = 0, slowDur = 0, lastSlow = -10, shakeAmp = 0, flashT = 0;
let combo = 0, lastSmashT = -10;
const recent = [];
let kind = store.get('kind', 'ball');
if (!G.PROJ[kind]) kind = 'ball';

G.hitstop = (s) => { hitstopT = Math.max(hitstopT, s); };
G.shake = (a) => { shakeAmp = Math.min(0.6, Math.max(shakeAmp, a)); };
G.slowmo = (force) => {
  if (!force && G.rtime - lastSlow < 3) return;
  lastSlow = G.rtime; slowDur = force ? 1.0 : 1.1; slowT = slowDur;
};
let lastVib = 0;
G.vibrate = (p) => {
  if (!navigator.vibrate || G.rtime - lastVib < 0.08) return;
  lastVib = G.rtime;
  try { navigator.vibrate(p); } catch (e) { /* not allowed */ }
};
G.flash = (x, y, z) => { flashLight.position.set(x, y + 0.3, z); flashT = 0.35; };

// ---------------------------------------------------------------- UI
const $ = (id) => document.getElementById(id);
const numEl = $('num'), progEl = $('progv'), comboEl = $('combo'), bannerEl = $('banner'), hintEl = $('hint');
let shown = 0;
const WORDS = { glass: ['SHATTER', 'CRASH', 'TINKLE', 'KRSSH'], brick: ['CRASH', 'CRUMBLE', 'BOOM', 'WHAM'], metal: ['CLANG', 'BONK', 'KLONK', 'DOINK'], wood: ['CRACK', 'SNAP', 'THWACK'] };
function showCombo(n, mat) {
  const w = WORDS[mat] || WORDS.brick;
  comboEl.textContent = `x${n} ${w[(Math.random() * w.length) | 0]}`;
  comboEl.style.setProperty('--s', String(Math.min(1.25, 0.85 + n * 0.04)));
  comboEl.style.setProperty('--r', `${rnd(-8, 8).toFixed(1)}deg`);
  comboEl.classList.remove('pop');
  void comboEl.offsetWidth;
  comboEl.classList.add('pop');
}
G.smash = (it) => {
  if (it.counted) return;
  it.counted = true;
  G.doneW += it.w;
  G.count++;
  const t = G.rtime;
  combo = t - lastSmashT < 1.1 ? combo + 1 : 1;
  lastSmashT = t;
  if (combo >= 3) showCombo(combo, it.mat);
  recent.push(t);
  while (recent.length && recent[0] < t - 0.7) recent.shift();
  if (recent.length >= 12) G.slowmo(false);
};

document.querySelectorAll('#bar button').forEach((b) => {
  b.classList.toggle('on', b.dataset.k === kind);
  b.addEventListener('click', () => {
    sfx.unlock(); sfx.click();
    kind = b.dataset.k; store.set('kind', kind);
    document.querySelectorAll('#bar button').forEach((x) => x.classList.toggle('on', x === b));
  });
});
const muteBtn = $('bMute');
const setMute = (m) => { sfx.setMuted(m); muteBtn.classList.toggle('muted', m); store.set('mute', m ? '1' : '0'); };
setMute(store.get('mute', '0') === '1');
muteBtn.addEventListener('click', () => { sfx.unlock(); setMute(!sfx.muted); sfx.click(); });
$('bNew').addEventListener('click', () => { sfx.unlock(); sfx.click(); if (state === 'play' || state === 'cleared') nextScene(); });
for (const el of document.querySelectorAll('button')) el.addEventListener('pointerdown', (e) => e.stopPropagation());

let hinted = store.get('hinted', '0') === '1';
if (!hinted) setTimeout(() => hintEl.classList.add('show'), 1300);
setTimeout(() => $('splash').classList.add('gone'), 1100);

// ---------------------------------------------------------------- scene management
let order = [];
function nextName() {
  if (!order.length) order = SCENE_NAMES.filter((n) => n !== sceneName).sort(() => Math.random() - 0.5);
  let n = order.shift();
  if (n === sceneName) { order.push(n); n = order.shift(); }
  return n;
}
function clearAll() {
  for (const it of G.items) {
    if (it.dead) continue;
    it.dead = true;
    if (it.body.world) world.removeBody(it.body);
    G.dying.push({ h: it.h, mesh: it.mesh, own: true, t: 0.35 });
  }
  for (const d of G.debris) G.killDebris(d, false);
  for (const p of G.projs) G.killProj(p, false);
  G.shards.fadeAll(0.6);
  for (let i = 0; i < 14 && G.items.length; i++) {
    const it = G.items[(Math.random() * G.items.length) | 0], p = it.body.position;
    K.dust(p.x, p.y, p.z, 3, 0.95, 0.92, 0.86, 0.5, 1.5);
  }
  G.items = []; G.metals = []; G.debris = []; G.projs = []; G.breakQ = []; G.hits.length = 0;
  G.totalW = 0; G.doneW = 0;
}
function buildScene(name) {
  sceneName = name;
  G.newBodies = [];
  SCENES[name](K);
  let maxD = 0;
  for (const it of G.items) {
    it.delay = it.origin.y * 0.16 + Math.random() * 0.06;
    maxD = Math.max(maxD, it.delay);
    setYo(it, 9);
  }
  introDur = maxD + 0.6;
  state = 'intro'; stateT = 0;
}
function setYo(it, y) { if (it.h) it.h.yo = y; else it.yo = y; }
function easeOutBounce(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
let landed = 0;
function updateIntro(dt) {
  stateT += dt;
  let n = 0;
  for (const it of G.items) {
    const t = clamp((stateT - it.delay) / 0.55, 0, 1);
    setYo(it, 9 * (1 - easeOutBounce(t)));
    if (t >= 0.36) n++;
  }
  if (n > landed + 6) { sfx.land(); landed = n; }
  if (stateT >= introDur) {
    for (const it of G.items) setYo(it, 0);
    for (const b of G.newBodies) { world.addBody(b); b.sleep(); }
    G.newBodies = [];
    state = 'play'; stateT = 0; landed = 0;
  }
}
function nextScene(name) {
  clearAll();
  buildScene(name || nextName());
}
G.killDebris = (d, instant) => {
  if (d.gone) return;
  d.gone = true;
  if (d.body.world) world.removeBody(d.body);
  if (instant) d.h.g.remove(d.h);
  else G.dying.push({ h: d.h, t: 0.35 });
};
G.killProj = (p, instant) => {
  if (p.dead) return;
  p.dead = true;
  if (p.body.world) world.removeBody(p.body);
  if (instant) scene.remove(p.mesh);
  else G.dying.push({ mesh: p.mesh, own: false, t: 0.35, s0: p.mesh.scale.clone() });
};

// ---------------------------------------------------------------- input: swipe / flick / tap to throw
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const groundPl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();
let ptr = null, lastThrow = -1;
function aimPoint(nx, ny, out) {
  ray.setFromCamera({ x: nx, y: ny }, camera);
  if (!ray.ray.intersectPlane(plane, out) || out.y < 0) {
    if (!ray.ray.intersectPlane(groundPl, out)) out.copy(ray.ray.direction).multiplyScalar(20).add(ray.ray.origin);
  }
  out.y = Math.min(out.y, 7);
  return out;
}
function doThrow(nx, ny, speed, startNx = 0) {
  if (state === 'intro' || G.rtime - lastThrow < 0.1) return;
  lastThrow = G.rtime;
  const D = G.PROJ[kind];
  speed *= D.speed;
  const from = new THREE.Vector3(CAM_POS.x + clamp(startNx, -1, 1) * 0.45, CAM_POS.y - 0.75, CAM_POS.z - 1.3);
  const aim = aimPoint(nx, ny, _hit);
  const d = aim.clone().sub(from), dist = d.length(), T = dist / speed;
  const vel = d.divideScalar(T);
  vel.y += 0.5 * 9.82 * T;
  K.throwProj(kind, from, vel);
  sfx.whoosh(speed);
  if (!hinted) { hinted = true; store.set('hinted', '1'); hintEl.classList.remove('show'); }
}
function ndc(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1), h: r.height, w: r.width, r };
}
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (ptr) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* synthetic */ }
  ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, s: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  ptr.s.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (ptr.s.length > 12) ptr.s.shift();
});
const endPtr = (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = ptr; ptr = null;
  const now = performance.now();
  p.s.push({ x: e.clientX, y: e.clientY, t: now });
  const last = p.s[p.s.length - 1];
  let first = p.s[0];
  for (const s of p.s) if (now - s.t <= 110) { first = s; break; }
  const dtm = Math.max(16, last.t - first.t) / 1000;
  const vx = (last.x - first.x) / dtm, vy = (last.y - first.y) / dtm, v = Math.hypot(vx, vy);
  const travel = Math.hypot(last.x - p.x0, last.y - p.y0);
  const n0 = ndc({ clientX: p.x0, clientY: p.y0 });
  const r = n0.r;
  if (travel < 14 || v < 220) {
    const n = ndc(e);
    doThrow(n.x, n.y, 21, n.x);
  } else {
    const ax = clamp(last.x + vx * 0.12, r.left, r.right), ay = clamp(last.y + vy * 0.12, r.top, r.bottom);
    const n = ndc({ clientX: ax, clientY: ay });
    const speed = clamp(9 + 6.5 * (v / r.height), 11, 27);
    doThrow(n.x, n.y, speed, n0.x);
  }
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', (e) => { if (ptr && e.pointerId === ptr.id) ptr = null; });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// projectile pass-through for glass: restore pre-contact velocity (slightly slowed)
world.addEventListener('postStep', () => {
  for (const p of G.projs) if (!p.dead) p.pre.copy(p.body.velocity);
  // safety net: a body that went numerically bad is parked below ground and culled by the y < -3 checks
  const B = world.bodies;
  for (let i = 0; i < B.length; i++) {
    const b = B[i], q = b.position, v = b.velocity, w = b.angularVelocity;
    if (!Number.isFinite(q.x + q.y + q.z + v.x + v.y + v.z + w.x + w.y + w.z + b.quaternion.w)) {
      q.set(0, -10, 0); v.set(0, 0, 0); w.set(0, 0, 0); b.quaternion.set(0, 0, 0, 1); b.collisionFilterMask = 0;
      b.previousPosition.copy(q); b.interpolatedPosition.copy(q); b.previousQuaternion.set(0, 0, 0, 1); b.interpolatedQuaternion.set(0, 0, 0, 1);
    }
  }
});
world.addEventListener('preStep', () => {
  for (const p of G.projs) if (p.pass && !p.dead) { p.pass = false; p.body.velocity.set(p.pre.x * 0.85, p.pre.y * 0.85, p.pre.z * 0.85); }
});

// ---------------------------------------------------------------- resize / quality
let qScale = 1, W = 0, H = 0;
function resize() {
  const iw = window.innerWidth, ih = window.innerHeight;
  let w = iw, h = ih, framed = false;
  if (iw / ih > 0.66) { h = ih; w = Math.round(Math.min(iw, ih * 0.5)); framed = true; }
  W = w; H = h;
  wrap.style.width = w + 'px';
  wrap.style.height = h + 'px';
  document.body.classList.toggle('framed', framed);
  const pr = Math.max(0.75, DPR * qScale);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const tanH = 1.95 / 8.3;
  camera.fov = clamp((2 * Math.atan(tanH / camera.aspect) * 180) / Math.PI, 46, 66);
  camera.updateProjectionMatrix();
  const sc = (h * pr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  G.dust.mat.uniforms.uScale.value = sc;
  G.spark.mat.uniforms.uScale.value = sc;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();
let ema = 1 / 60, perfT = 0;
function adaptQuality(rdt) {
  if (DEV) return;
  ema += (rdt - ema) * 0.05;
  perfT += rdt;
  if (perfT > 2.5) {
    perfT = 0;
    if (ema > 1 / 45 && qScale > 0.6) { qScale = Math.max(0.6, qScale - 0.15); resize(); }
    else if (ema > 1 / 40 && renderer.shadowMap.enabled && qScale <= 0.6) { renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  }
}

// ---------------------------------------------------------------- frame loop
let lastT = performance.now(), frameN = 0, shownCount = 0, clearedAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let rdt = (now - lastT) / 1000;
  lastT = now;
  if (!(rdt > 0)) rdt = 0;
  if (rdt > 0.1) rdt = 0.1;
  G.rtime += rdt;
  frameN++;

  let ts = 1;
  if (hitstopT > 0) { hitstopT -= rdt; ts = 0.03; }
  else if (slowT > 0) { slowT -= rdt; const k = slowT / slowDur; ts = k > 0.35 ? 0.3 : 0.3 + 0.7 * (1 - k / 0.35); }
  const dt = rdt * ts;
  G.time += dt;
  if (dt > 0) world.step(1 / 60, dt, 3);
  G.processHits();
  G.processBreaks();

  if (state === 'intro') updateIntro(rdt);

  // items: knock-over detection, out-of-bounds
  if (frameN % 6 === 0) {
    let alive = 0;
    for (const it of G.items) {
      if (it.dead) continue;
      G.items[alive++] = it;
      if (state === 'intro') continue;
      const b = it.body, p = b.position, o = it.origin;
      if (!Number.isFinite(p.x + p.y + p.z) || p.y < -3 || Math.abs(p.x) > 40 || p.z > 5.2 || p.z < -40) { if (b.world) world.removeBody(b); it.dead = true; if (it.h) it.h.g.remove(it.h); if (it.mesh) { scene.remove(it.mesh); it.mesh.geometry.dispose(); } if (!it.counted) G.smash(it); alive--; continue; }
      if (it.counted) continue;
      const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
      let knocked = dx * dx + dz * dz > 0.2 || dy < -0.25;
      if (!knocked && it.upright) { const q = b.quaternion; const upY = 1 - 2 * (q.x * q.x + q.z * q.z); knocked = upY < 0.7; }
      if (knocked) G.smash(it);
    }
    G.items.length = alive;
    G.metals = G.metals.filter((m) => !m.dead);
  }
  // debris & projectiles lifetime
  for (const d of G.debris) {
    if (d.gone) continue;
    d.life -= dt;
    if (d.life <= 0 || !Number.isFinite(d.body.position.x + d.body.position.y) || d.body.position.y < -3 || d.body.position.z > 5) G.killDebris(d, false);
  }
  if (frameN % 30 === 0) G.debris = G.debris.filter((d) => !d.gone);
  for (const p of G.projs) {
    if (p.dead) continue;
    p.age += dt;
    const b = p.body;
    if (p.kind === 'bomb') {
      const q = b.interpolatedQuaternion, tip = new THREE.Vector3(0, 0.27, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
      if (Math.random() < 0.8) G.spark.emit(b.interpolatedPosition.x + tip.x, b.interpolatedPosition.y + tip.y, b.interpolatedPosition.z + tip.z, rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1), rnd(0.15, 0.3), rnd(0.05, 0.1), 1, 0.8, 0.3, 3, 1, 0, 1);
      if (!Number.isFinite(b.position.x + b.position.y + b.position.z)) { G.killProj(p, true); continue; }
      if (p.age > p.life) { G.explode(p); continue; }
    } else { const bad = !Number.isFinite(b.position.x + b.position.y + b.position.z); if (bad || p.age > p.life || b.position.y < -3) { G.killProj(p, bad); continue; } }
    const ip = b.interpolatedPosition, iq = b.interpolatedQuaternion;
    p.mesh.position.set(ip.x, ip.y, ip.z);
    p.mesh.quaternion.set(iq.x, iq.y, iq.z, iq.w);
  }
  if (frameN % 30 === 0) G.projs = G.projs.filter((p) => !p.dead);
  // dying (shrinking) handles & meshes
  for (let i = G.dying.length - 1; i >= 0; i--) {
    const d = G.dying[i];
    d.t -= rdt;
    const k = Math.max(0, d.t / 0.35);
    if (d.h) d.h.k = k;
    if (d.mesh) { if (d.s0) d.mesh.scale.copy(d.s0).multiplyScalar(k); else d.mesh.scale.setScalar(k); }
    if (d.t <= 0) {
      if (d.h) d.h.g.remove(d.h);
      if (d.mesh) { scene.remove(d.mesh); if (d.own) d.mesh.geometry.dispose(); }
      G.dying.splice(i, 1);
    }
  }
  // metal meshes follow bodies
  for (const it of G.metals) {
    if (it.dead) continue;
    const p = it.body.interpolatedPosition, q = it.body.interpolatedQuaternion;
    it.mesh.position.set(p.x, p.y + it.yo, p.z);
    it.mesh.quaternion.set(q.x, q.y, q.z, q.w);
  }
  for (const k in G.groups) G.groups[k].update();
  G.dust.update(dt);
  G.spark.update(dt);
  G.shards.update(dt);

  // flash light
  if (flashT > 0) { flashT -= rdt; flashLight.intensity = Math.max(0, flashT / 0.35) * 600; } else flashLight.intensity = 0;

  // camera shake (real time, not slowed)
  shakeAmp *= Math.exp(-rdt * 9);
  if (shakeAmp > 0.002) {
    camera.position.set(CAM_POS.x + rnd(-1, 1) * shakeAmp * 0.3, CAM_POS.y + rnd(-1, 1) * shakeAmp * 0.3, CAM_POS.z);
    camera.quaternion.copy(camQ).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(-1, 1) * shakeAmp * 0.03, rnd(-1, 1) * shakeAmp * 0.03, rnd(-1, 1) * shakeAmp * 0.05)));
  } else { camera.position.copy(CAM_POS); camera.quaternion.copy(camQ); }

  // HUD
  if (shown < G.count) {
    shown = Math.min(G.count, shown + Math.max(1, Math.ceil((G.count - shown) * rdt * 8)));
    if (shown !== shownCount) { shownCount = shown; numEl.textContent = shown; numEl.classList.remove('tick'); void numEl.offsetWidth; numEl.classList.add('tick'); }
  }
  const prog = G.totalW > 0 ? Math.min(1, G.doneW / G.totalW / 0.8) : 0;
  progEl.style.transform = `scaleX(${state === 'intro' ? 0 : prog})`;

  if (state === 'play') {
    stateT += rdt;
    if (prog >= 1) {
      state = 'cleared'; clearedAt = G.rtime; comboEl.classList.remove('pop');
      bannerEl.classList.remove('show'); void bannerEl.offsetWidth; bannerEl.classList.add('show');
      sfx.fanfare();
      G.vibrate([15, 40, 15]);
    }
  } else if (state === 'cleared' && G.rtime - clearedAt > 2.0) {
    nextScene();
  }

  renderer.render(scene, camera);
  adaptQuality(rdt);
}

buildScene(SCENES[params.get('scene')] ? params.get('scene') : 'wall');
requestAnimationFrame(frame);

if (DEV) {
  window.__G = {
    G, K, throwAt: (nx, ny, speed = 21) => doThrow(nx, ny, speed, nx), setKind: (k) => { kind = k; },
    scene: (n) => nextScene(n), get state() { return state; }, world,
    stats: () => ({ bodies: world.bodies.length, items: G.items.length, debris: G.debris.filter((d) => !d.gone).length, shards: G.shards.list.length, projs: G.projs.filter((p) => !p.dead).length, count: G.count, prog: G.totalW ? G.doneW / G.totalW : 0, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, state, scene: sceneName }),
  };
}
