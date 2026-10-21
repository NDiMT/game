// DRIFT KICK! v2 main: boot, game flow (shootout / streak), fixed 120 Hz step with interpolation,
// chase camera, post (bloom, flares, speed lines), effects, slow-mo + replay, audio and auto quality tiers.
import * as THREE from 'three';
import { World, DT, RES, EV, R, KZ, SPOT, GX, GY, GD, AX, AZ0, AZ1, SHOT_TIME, attemptStart, rng, keeperPose } from './physics.js';
import { CARS, AI_CAR } from './cars.js';
import { PlanBot } from './bots.js';
import { createStage } from './stage.js';
import { createPost } from './post.js';
import { buildCar, buildBall, buildKeeper, makeMats } from './models.js';
import { Particles, Skids, Trail, Confetti, Flame, Blast } from './fx.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';

const params = new URLSearchParams(location.search);
const MANUAL = params.has('manual');      // test hook: frames are advanced by __drift.tick()
const AUTOBOT = params.has('bot');         // test hook: a bot drives your car
const FORCE_Q = params.has('q') ? +params.get('q') : -1;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => (a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a);

// ------------------------------------------------------------------ save data
const SAVE_KEY = 'driftkick.v1';
const save = { goals: 0, best: 0, car: 0, theme: 'day', muted: false, tut: false, tut2: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (_) { /* private mode */ }
if (!(save.car >= 0 && save.car < CARS.length) || CARS[save.car].unlock > save.goals) save.car = 0;
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) { /* ignore */ } }

// ------------------------------------------------------------------ renderer + quality tiers
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
const isTouch = matchMedia('(pointer: coarse)').matches;
// tier 2 = high (bloom x5, MSAA 4, 2K shadows), 1 = mid (bloom x4, MSAA 2), 0 = low (no post, DOM speed lines)
const Q = { level: 2 };
if (isTouch && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) Q.level = 1;
if (FORCE_Q >= 0) Q.level = clamp(FORCE_Q, 0, 2);

const stage = createStage(renderer, Q.level);
const scene = stage.scene;
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1100);
const post = createPost(renderer);

// ------------------------------------------------------------------ entities
const M = makeMats();
let carModel = null, carIdx = -1;
const flame = new Flame(), aiFlame = new Flame();
function setPlayerCar(i) {
  if (carIdx === i) return;
  if (carModel) { carModel.group.remove(flame.group); scene.remove(carModel.group); carModel.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
  carModel = buildCar(CARS[i], M); carIdx = i;
  carModel.group.rotation.order = 'YXZ';
  flame.attach(carModel);
  scene.add(carModel.group);
}
setPlayerCar(save.car);
const aiModel = buildCar(AI_CAR, M); aiModel.group.rotation.order = 'YXZ'; aiModel.group.visible = false; aiFlame.attach(aiModel); scene.add(aiModel.group);
const ballMesh = buildBall(); scene.add(ballMesh);
const keeper = buildKeeper(0x7a3cf0, 0xff5ab4); scene.add(keeper.group);
// soft contact shadows (ground the car and ball even where the shadow map is coarse)
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
function blob(sx, sz) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.rotation.x = -Math.PI / 2; m.scale.set(sx, sz, 1); m.renderOrder = 2; scene.add(m); return m;
}
const carBlob = blob(2.1, 3.2), ballBlob = blob(2.2, 2.2);

const sparks = new Particles(1000, true), smoke = new Particles(320, false);
scene.add(sparks.points, smoke.points);
const skids = new Skids(900); scene.add(skids.mesh);
const trail = new Trail(30); scene.add(trail.mesh);
const confetti = new Confetti(320); scene.add(confetti.mesh);
const blast = new Blast(); scene.add(blast.mesh);

const world = new World(CARS[save.car], 12345);
const fr = rng(777);           // fx randomness
const gameRand = rng((Date.now() & 0xffff) + 1);
const aiBot = new PlanBot(AI_CAR, rng(4242), { noise: 0.12, samples: 110, anySide: true });
const helpBot = new PlanBot(CARS[0], rng(99), { samples: 110 });

const audio = createAudio();
audio.setMuted(save.muted);

// ------------------------------------------------------------------ game state
const G = {
  state: 'boot', mode: 'shootout', t: 0, time: 0, timeScale: 1, slowT: 0, slowK: 0.22, hitStop: 0, acc: 0, alpha: 0,
  you: [], ai: [], round: 0, sudden: false, streak: 0, diff: 0.1, kicker: 'you', excite: 0.15, shake: 0, hop: 0,
  fov: 60, boostFov: 0, menuCar: save.car, celebrate: false, fw: new Float32Array(10), fwN: 0, lastRes: 0, firstLv: false, lastSlow: false,
  botOn: AUTOBOT, force: null, celebA: 0, planning: false, paused: false, prevState: '', replayT: 0, replayA: 0, replayB: 0, recDiv: 0, flash: 0, gasHint: 0,
};
const inpBot = { steer: 0, throttle: 0, brake: 0, drift: false, jump: false };
const inpIdle = { steer: 0, throttle: 0, brake: 0.7, drift: false, jump: false, hold: true };
const inpPark = { steer: 0, throttle: 0, brake: 0, drift: false, jump: false };

// ------------------------------------------------------------------ replay recording (60 Hz)
const RF = 32, RN = 1600;
const rec = new Float32Array(RF * RN);
let recLen = 0, recTouch = -1, recGoal = -1;
function record() {
  if (recLen >= RN) return;
  const c = world.car, b = world.ball, k = world.keeper, o = recLen * RF;
  rec[o] = c.x; rec[o + 1] = c.y; rec[o + 2] = c.z; rec[o + 3] = c.yaw; rec[o + 4] = c.pitch; rec[o + 5] = c.slip; rec[o + 6] = c.steer;
  rec[o + 7] = c.speed; rec[o + 8] = c.drifting ? 1 : 0; rec[o + 9] = c.level; rec[o + 10] = c.boostT; rec[o + 11] = c.onGround ? 1 : 0;
  rec[o + 12] = b.x; rec[o + 13] = b.y; rec[o + 14] = b.z;
  rec[o + 15] = k.x; rec[o + 16] = k.y; rec[o + 17] = k.roll; rec[o + 18] = k.pose;
  rec[o + 19] = c.vF; rec[o + 20] = c.charge; rec[o + 21] = c.roll; rec[o + 22] = c.steerAngle;
  for (let i = 0; i < 4; i++) rec[o + 23 + i] = c.comp[i];
  rec[o + 27] = c.wAng[0]; rec[o + 28] = c.wAng[2]; rec[o + 29] = c.brake; rec[o + 30] = c.boostLv; rec[o + 31] = c.slipK[2];
  if (recTouch < 0 && world.touched) recTouch = recLen;
  recLen++;
}

// ------------------------------------------------------------------ view state (what gets drawn)
const V = {
  cx: 0, cy: 0, cz: 0, yaw: 0, pitch: 0, roll: 0, slip: 0, steer: 0, steerA: 0, speed: 0, vF: 0, drifting: false, level: 0, boostT: 0, boostLv: 0, onGround: true, charge: 0,
  comp: new Float32Array(4), wAngF: 0, wAngR: 0, brake: 0, spin: 0,
  bx: 0, by: R, bz: SPOT, kx: 0, ky: 0, kroll: 0, kpose: 0,
};
const KP = { b0x: 0, b0y: 0, b1x: 0, b1y: 0, a0x: 0, a0y: 0, a1x: 0, a1y: 0 };
function viewLive(a) {
  const c = world.car, b = world.ball, k = world.keeper;
  V.cx = lerp(c.px, c.x, a); V.cy = lerp(c.py, c.y, a); V.cz = lerp(c.pz, c.z, a);
  V.yaw = c.pyaw + wrapA(c.yaw - c.pyaw) * a; V.pitch = lerp(c.ppitch, c.pitch, a); V.roll = lerp(c.proll, c.roll, a);
  V.slip = c.slip; V.steer = c.steer; V.steerA = c.steerAngle; V.speed = c.speed; V.vF = c.vF;
  V.drifting = c.drifting; V.level = c.level; V.boostT = c.boostT; V.boostLv = c.boostLv; V.onGround = c.onGround; V.charge = c.charge;
  for (let i = 0; i < 4; i++) V.comp[i] = c.comp[i];
  V.wAngF = c.wAng[0]; V.wAngR = c.wAng[2]; V.brake = c.brake; V.spin = c.slipK[2];
  V.bx = lerp(b.px, b.x, a); V.by = lerp(b.py, b.y, a); V.bz = lerp(b.pz, b.z, a);
  V.kx = lerp(k.px, k.x, a); V.ky = lerp(k.py, k.y, a); V.kroll = lerp(k.proll, k.roll, a); V.kpose = lerp(k.ppose, k.pose, a);
}
function viewReplay(f) {
  const i = Math.min(recLen - 2, Math.max(0, Math.floor(f))), t = f - i, o = i * RF, p = o + RF;
  const L = (j) => lerp(rec[o + j], rec[p + j], t);
  V.cx = L(0); V.cy = L(1); V.cz = L(2); V.yaw = rec[o + 3] + wrapA(rec[p + 3] - rec[o + 3]) * t; V.pitch = L(4); V.slip = L(5); V.steer = L(6);
  V.speed = L(7); V.drifting = rec[o + 8] > 0.5; V.level = rec[o + 9]; V.boostT = rec[o + 10]; V.onGround = rec[o + 11] > 0.5;
  V.bx = L(12); V.by = L(13); V.bz = L(14); V.kx = L(15); V.ky = L(16); V.kroll = L(17); V.kpose = L(18); V.vF = L(19); V.charge = L(20);
  V.roll = L(21); V.steerA = L(22); for (let k = 0; k < 4; k++) V.comp[k] = L(23 + k);
  V.wAngF = L(27); V.wAngR = L(28); V.brake = L(29); V.boostLv = rec[o + 30]; V.spin = L(31);
}
function viewParked() {
  V.cx = 0; V.cy = 0; V.cz = SPOT + 4.4; V.yaw = G.time * 0.45; V.pitch = 0; V.roll = 0; V.slip = 0; V.steer = Math.sin(G.time) * 0.5; V.steerA = Math.sin(G.time * 0.8) * 0.35;
  V.speed = 0; V.vF = 0; V.drifting = false; V.boostT = 0; V.level = 0; V.brake = 0; V.spin = 0;
  const sc = carModel ? carModel.sc : 0.09;
  for (let i = 0; i < 4; i++) V.comp[i] = sc + Math.sin(G.time * 2 + i) * 0.006;
  V.bx = 0; V.by = R; V.bz = SPOT; V.kx = Math.sin(G.time * 0.8) * 0.6; V.ky = 0; V.kroll = Math.sin(G.time * 0.8) * 0.05; V.kpose = 0;
}

// ------------------------------------------------------------------ UI
const ui = createUI({
  unlock: () => audio.unlock(),
  click: () => audio.click(),
  tap: () => {},
  key: (k) => {
    if (k === 'pause') { if (G.state === 'paused') resume(); else if (inGame()) pause(); }
    if (k === 'enter' && G.state === 'menu') startGame('shootout');
  },
  tapToSkip: () => trySkip(),
});
ui.on('bPlay', () => startGame('shootout'));
ui.on('bStreak', () => startGame('streak'));
ui.on('cPrev', () => pickCar(-1));
ui.on('cNext', () => pickCar(1));
ui.on('bTheme', () => { save.theme = save.theme === 'day' ? 'night' : 'day'; applyTheme(); persist(); });
const toggleMute = () => { save.muted = !save.muted; audio.setMuted(save.muted); ui.sound(save.muted); persist(); };
ui.on('bSnd', toggleMute);
ui.on('bMute', toggleMute);
ui.on('bPause', () => pause());
ui.on('bResume', () => resume());
ui.on('bQuit', () => { ui.overlay('pause', false); G.paused = false; toMenu(); });
ui.on('bAgain', () => { ui.overlay('result', false); startGame(G.mode); });
ui.on('bMenu', () => { ui.overlay('result', false); toMenu(); });
ui.on('bTut', () => { ui.overlay('tut', false); save.tut2 = true; persist(); if (G.state === 'tut') beginIntro(); });
ui.on('bHow', () => { if (G.state === 'menu') ui.overlay('tut', true); });
ui.theme(save.theme); ui.sound(save.muted);

function applyTheme() {
  stage.setTheme(save.theme); ui.theme(save.theme);
  const th = stage.th;
  post.bloom = th.bloom; post.ghost = th.ghost; post.materials[0].uniforms.uThresh.value = th.thresh;
}
function pickCar(d) {
  G.menuCar = (G.menuCar + d + CARS.length) % CARS.length;
  ui.carCard(G.menuCar, save.goals);
  setPlayerCar(G.menuCar);
  if (CARS[G.menuCar].unlock <= save.goals) { save.car = G.menuCar; persist(); }
}
function inGame() { return ['intro', 'play', 'after', 'replay', 'aiIntro', 'aiPlay', 'aiAfter'].includes(G.state); }
function pause() { if (!inGame()) return; G.prevState = G.state; G.state = 'paused'; ui.overlay('pause', true); audio.silence(); ui.resetInput(); }
function resume() { if (G.state !== 'paused') return; ui.overlay('pause', false); G.state = G.prevState; }
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ------------------------------------------------------------------ flow
function toMenu() {
  G.state = 'menu'; G.t = 0;
  ui.showHud(false); ui.showMenu(true); ui.tag(false); ui.skip(false); ui.hideBanner();
  G.menuCar = save.car; setPlayerCar(save.car); ui.carCard(G.menuCar, save.goals); ui.menuStats(save.goals, save.best);
  carModel.group.visible = true; aiModel.group.visible = false;
  world.ball.reset(0, SPOT); world.keeper.reset(); world.keeper.update();
  skids.clear(); sparks.clear(); smoke.clear(); confetti.clear(); trail.reset(0, R, SPOT);
  G.excite = 0.2; audio.crowd(0.035); audio.silence();
}
function startGame(mode) {
  if (CARS[G.menuCar].unlock > save.goals) return;
  save.car = G.menuCar; persist();
  G.mode = mode; G.you = []; G.ai = []; G.round = 0; G.sudden = false; G.streak = 0;
  ui.showMenu(false);
  ui.showHud(true, mode === 'streak');
  ui.dots(G.you, G.ai); ui.streak(0, save.best);
  audio.crowd(0.06);
  startPlayerKick();
}
function playerDiff() {
  if (G.mode === 'streak') return Math.min(0.6, 0.08 + 0.045 * G.streak);
  return G.sudden ? Math.min(0.6, 0.44 + 0.04 * (G.round - 5)) : 0.1 + 0.08 * G.round;
}
const SP = { x: 0, z: 0, yaw: 0 };
function resetFx() { skids.clear(); sparks.clear(); smoke.clear(); confetti.clear(); trail.reset(0, R, SPOT); G.celebrate = false; G.fwN = 0; G.celebA = 0; G.lastSlow = false; G.slowT = 0; G.gasHint = 0; }
function startPlayerKick() {
  G.kicker = 'you';
  world.car.def = CARS[save.car];
  attemptStart(gameRand, SP);
  G.diff = playerDiff();
  world.setup(SP.x, SP.z, SP.yaw, G.diff);
  keeper.jersey.color.setHex(0x7a3cf0); keeper.trim.color.setHex(0xff5ab4);
  carModel.group.visible = true; aiModel.group.visible = false;
  resetFx(); recLen = 0; recTouch = -1; recGoal = -1; G.recDiv = 0;
  ui.el.hud.classList.remove('watch');
  ui.resetInput(); audio.crowd(0.06); G.excite = 0.2;
  if (G.mode === 'streak') ui.round(`KEEPER LV ${1 + Math.round(G.diff * 10)}`);
  else ui.round(G.sudden ? 'SUDDEN DEATH' : `ROUND ${G.round + 1} / 5`);
  if (G.botOn) { helpBot.setCar(CARS[save.car]); helpBot.reset(world); }
  if (!save.tut2 && !AUTOBOT) { G.state = 'tut'; ui.overlay('tut', true); placeIntroCam(); return; }
  beginIntro();
}
function beginIntro() {
  G.state = 'intro'; G.t = 0;
  const txt = G.mode === 'streak' ? (G.streak ? `STREAK ${G.streak}` : 'STREAK') : (G.sudden ? 'SUDDEN DEATH' : `ROUND ${G.round + 1}`);
  ui.banner(txt, G.mode === 'streak' ? 'score to keep it going' : 'your penalty', 'info');
  placeIntroCam();
}
function startAiKick() {
  G.kicker = 'ai';
  world.car.def = AI_CAR;
  attemptStart(gameRand, SP);
  world.setup(SP.x, SP.z, SP.yaw, 0.12);
  const pc = CARS[save.car];
  keeper.jersey.color.setHex(pc.color); keeper.trim.color.setHex(0xffffff);
  carModel.group.visible = false; aiModel.group.visible = true;
  resetFx(); recLen = 0; recTouch = -1; recGoal = -1;
  aiBot.begin(world, { anySide: true, refine: 40 }); G.planning = true; audio.crowd(0.06);
  ui.el.hud.classList.add('watch');
  G.state = 'aiIntro'; G.t = 0;
  ui.banner('RIVAL SHOOTS', 'you keep goal', 'info');
  ui.round(G.sudden ? 'SUDDEN DEATH' : `ROUND ${G.round + 1} / 5`);
  placeIntroCam();
}
function decided() {
  const ys = G.you.filter(Boolean).length, as = G.ai.filter(Boolean).length;
  if (!G.sudden) {
    const yr = 5 - G.you.length, ar = 5 - G.ai.length;
    if (ys > as + ar) return 'you';
    if (as > ys + yr) return 'ai';
    if (G.you.length === 5 && G.ai.length === 5) {
      if (ys === as) { G.sudden = true; return null; }
      return ys > as ? 'you' : 'ai';
    }
    return null;
  }
  if (G.you.length === G.ai.length) { if (ys !== as) return ys > as ? 'you' : 'ai'; }
  return null;
}
function nextAfterPlayer() {
  ui.hideBanner(); ui.tag(false); ui.skip(false);
  if (G.mode === 'streak') {
    if (G.lastRes === RES.GOAL) { startPlayerKick(); return; }
    finish();
    return;
  }
  const d = decided();
  if (d) { finish(d); return; }
  startAiKick();
}
function nextAfterAi() {
  ui.hideBanner(); ui.skip(false);
  G.round++;
  const d = decided();
  if (d) { finish(d); return; }
  startPlayerKick();
}
function finish(winner) {
  G.state = 'final'; G.t = 0;
  ui.el.hud.classList.add('watch');
  G.kicker = 'you'; carModel.group.visible = true; aiModel.group.visible = false;
  world.ball.reset(0, SPOT); world.keeper.reset(); resetFx(); ui.tag(false); ui.skip(false);
  audio.silence();
  if (G.mode === 'streak') {
    const nb = G.streak > save.best;
    if (nb) { save.best = G.streak; persist(); }
    ui.resultCard(nb && G.streak > 0 ? 'NEW BEST!' : 'STREAK OVER', `${G.streak}<small>GOALS IN A ROW</small>`, `Best streak: ${save.best}. Drift longer for a purple boost!`);
    if (nb && G.streak > 0) { audio.roar(true); confettiAt(0, 3, 6); }
  } else {
    const ys = G.you.filter(Boolean).length, as = G.ai.filter(Boolean).length;
    const win = winner === 'you';
    ui.resultCard(win ? 'YOU WIN!' : 'RIVAL WINS', `${ys} : ${as}<small>${G.sudden ? 'AFTER SUDDEN DEATH' : 'PENALTY SHOOTOUT'}</small>`, win ? 'Champions of the toy league!' : 'So close. Drift, boost and curl it into the corners!');
    if (win) { audio.roar(true); confettiAt(0, 3, 6); audio.whistle(true); } else audio.groan();
  }
  setTimeout(() => { if (G.state === 'final') ui.overlay('result', true); }, 900);
}

// ------------------------------------------------------------------ results of a kick
function goalFx() {
  const b = world.ball;
  const col = G.kicker === 'ai' ? [1, 0.35, 0.75] : LVC[Math.max(1, world.car.boostLv || 2)];
  blast.fire(b.x, Math.max(1.2, b.y), Math.min(-0.5, b.z), col[0] * 1.6, col[1] * 1.6, col[2] * 1.6);
  stage.goalFlash(G.kicker === 'ai' ? 1.5 : 4);
  G.flash = 1;
  for (let j = 0; j < 140; j++) {
    const u = fr() * 2 - 1, an = fr() * Math.PI * 2, rr = Math.sqrt(1 - u * u), s = 6 + fr() * 10;
    sparks.emit(b.x, Math.max(1, b.y), b.z, rr * Math.cos(an) * s, Math.abs(u) * s + 2, rr * Math.sin(an) * s + 3, 0.5 + fr() * 0.6, 0.7, 0.1, col[0], col[1], col[2], 1, 2.5, 6);
  }
}
function onPlayerResult() {
  const r = world.result; G.lastRes = r; G.state = 'after'; G.t = 0;
  const kmh = Math.round(world.shotSpeed * 3.6);
  if (r === RES.GOAL) {
    G.slowT = 0.9; G.slowK = 0.22; G.excite = 1;
    const curl = Math.abs(world.shotSpin) > 8 ? ' · CURLER!' : '';
    ui.banner('GOAL!', `${kmh} km/h${curl}`, ''); ui.flash();
    audio.roar(true); audio.crowd(0.12);
    goalFx();
    confettiAt(world.ball.x * 0.5, 2.5, 1);
    G.celebrate = true; G.fwN = 0;
    for (let i = 0; i < 8; i++) G.fw[G.fwN++] = 0.4 + i * 0.28 + fr() * 0.2;
    save.goals++;
    const unlocked = CARS.find((c) => c.unlock === save.goals);
    if (unlocked) setTimeout(() => { ui.toast(`NEW CAR UNLOCKED: ${unlocked.name.toUpperCase()}!`, true, 2600); audio.unlockFx(); }, 900);
    persist();
  } else if (r === RES.SAVE) {
    G.excite = 0.45; ui.banner('SAVED!', world.shotSpeed < 24 ? 'boost it harder!' : 'curl it into the corner', 'save'); audio.groan();
  } else if (r === RES.MISS) {
    G.excite = 0.3; ui.banner(world.post ? 'POST!' : 'MISS', world.post ? 'so close' : 'wide of the goal', 'miss'); audio.groan();
  } else {
    G.excite = 0.25; ui.banner('TOO SLOW!', `hit the ball within ${Math.round(SHOT_TIME)} s`, 'miss'); audio.whistle(false);
  }
  if (G.mode === 'streak') {
    if (r === RES.GOAL) { G.streak++; ui.streak(G.streak, Math.max(save.best, G.streak)); }
  } else {
    G.you.push(r === RES.GOAL); ui.dots(G.you, G.ai);
  }
}
function onAiResult() {
  const r = world.result; G.state = 'aiAfter'; G.t = 0;
  if (r === RES.GOAL) { ui.banner('RIVAL SCORES', '', 'miss'); audio.groan(); G.excite = 0.35; goalFx(); }
  else if (r === RES.SAVE) { ui.banner('SAVED!', 'what a stop!', 'save'); audio.roar(false); G.excite = 0.9; confettiAt(world.ball.x, 2, 0.4); }
  else { ui.banner('RIVAL MISSES!', '', 'save'); audio.roar(false); G.excite = 0.7; }
  G.ai.push(r === RES.GOAL); ui.dots(G.you, G.ai);
}
function confettiAt(x, y, k) { confetti.burst(x, y, -1, Math.floor(320 * k), fr); }

function trySkip() {
  if (G.state === 'replay') { G.replayT = 1e9; return true; }
  if (G.state === 'aiPlay') { fastForward(); return true; }
  if (G.state === 'aiAfter' && G.t > 0.4) { nextAfterAi(); return true; }
  if (G.state === 'after' && G.t > 0.6 && G.lastRes !== RES.GOAL) { nextAfterPlayer(); return true; }
  if (G.state === 'after' && G.lastRes === RES.GOAL && G.t > 1.2) { G.t = 99; return true; }
  return false;
}
function fastForward() {
  if (G.planning) { while (!aiBot.work(50)) { /* finish planning */ } G.planning = false; }
  let n = 0;
  while (!world.result && n++ < 2600) { aiBot.drive(world, inpBot); world.step(inpBot); world.ev.clear(); }
  for (let i = 0; i < 60; i++) { world.step(inpIdle); world.ev.clear(); }
  sparks.clear(); smoke.clear(); trail.reset(world.ball.x, world.ball.y, world.ball.z);
  world.car.savePrev(); world.ball.savePrev(); world.keeper.savePrev();
  onAiResult();
}

// ------------------------------------------------------------------ physics events -> fx + audio
const LVC = [[1, 0.85, 0.5], [0.12, 0.45, 1], [1, 0.36, 0.02], [0.68, 0.16, 1]];
function handleEvents() {
  const ev = world.ev;
  for (let i = 0; i < ev.n; i++) {
    const t = ev.t[i], k = i * 4, a = ev.a[k], b = ev.a[k + 1], c = ev.a[k + 2], d = ev.a[k + 3];
    switch (t) {
      case EV.HIT: {
        audio.thump(a);
        const n = Math.min(46, 8 + a * 1.4) | 0;
        for (let j = 0; j < n; j++) sparks.emit(b, c, d, (fr() - 0.5) * 14, fr() * 8, (fr() - 0.5) * 14, 0.25 + fr() * 0.25, 0.5, 0.05, 1, 0.9, 0.6, 1, 3, 10);
        G.shake = Math.min(1, G.shake + a / 28);
        if (a > 16 && G.state === 'play') G.hitStop = 0.08;
        if (G.state === 'play' || G.state === 'aiPlay') audio.crowd(0.1);
        break;
      }
      case EV.POST: audio.post(a); G.shake = Math.min(1, G.shake + 0.5); for (let j = 0; j < 24; j++) sparks.emit(b, c, d, (fr() - 0.5) * 10, fr() * 6, (fr() - 0.5) * 10, 0.4, 0.4, 0.05, 1, 1, 0.8, 1, 2, 12); if (G.state === 'play') ui.toast('CLANG!'); break;
      case EV.NET: stage.netHit(b, c, d, a); audio.net(a); break;
      case EV.SAVE: audio.save(); for (let j = 0; j < 16; j++) sparks.emit(b, c, d, (fr() - 0.5) * 8, fr() * 5, fr() * 6, 0.35, 0.6, 0.1, 1, 1, 0.5, 0.9, 2, 8); break;
      case EV.BOUNCE: audio.bounce(a); for (let j = 0; j < 6; j++) smoke.emit(b + (fr() - 0.5), 0.2, c + (fr() - 0.5), (fr() - 0.5) * 2, 0.6, (fr() - 0.5) * 2, 0.7, 0.6, 1.6, 0.85, 0.9, 0.8, 0.25, 2, 0); break;
      case EV.BOOST: {
        audio.boost(a); G.boostFov = 1; G.shake = Math.min(1, G.shake + 0.25);
        const col = LVC[a | 0];
        const c0 = world.car, sy = Math.sin(c0.yaw), cy = Math.cos(c0.yaw);
        for (let j = 0; j < 46; j++) {
          const an = fr() * Math.PI * 2, s = 5 + fr() * 5;
          sparks.emit(c0.x - sy * 1.2, 0.5, c0.z - cy * 1.2, Math.cos(an) * s - sy * 4, fr() * 3, Math.sin(an) * s - cy * 4, 0.35 + fr() * 0.2, 0.5, 0.08, col[0], col[1], col[2], 0.8, 4, 2);
        }
        if (G.state === 'play') ui.flash();
        break;
      }
      case EV.LEVEL: audio.level(a); if (a === 1 && !G.firstLv && G.kicker === 'you') { G.firstLv = true; ui.toast('LET GO OF DRIFT TO BOOST!', false, 1800); } break;
      case EV.JUMP: audio.jump(); break;
      case EV.LAND: if (a > 3) audio.land(a); break;
      case EV.WALL: if (a > 3) audio.wall(a); break;
      case EV.DRIFT: G.hop = 1; break;
      case EV.DIVE: if (G.state === 'play' || G.state === 'aiPlay') audio.crowd(0.13); break;
      default: break;
    }
  }
  ev.clear();
}
const fwCol = new THREE.Color();

// ------------------------------------------------------------------ fixed-step simulation (120 Hz)
function stepSim(simDt, driver) {
  G.acc += simDt;
  let n = 0;
  while (G.acc >= DT && n < 12) {
    let inp;
    if (driver === 'player') { inp = G.force ? G.force : G.botOn ? (helpBot.drive(world, inpBot), inpBot) : ui.readInput(); if (inp !== ui.input) ui.reflect(inp); }
    else if (driver === 'ai') inp = (aiBot.drive(world, inpBot), inpBot);
    else if (driver === 'park') inp = inpPark;
    else inp = inpIdle;
    world.step(inp);
    handleEvents();
    if ((G.recDiv = (G.recDiv + 1) & 1) === 0) record();
    G.acc -= DT; n++;
  }
  if (n >= 12) G.acc = 0;
  G.alpha = G.acc / DT;
}

// ------------------------------------------------------------------ camera rig
const cam = { p: new THREE.Vector3(0, 6, 60), l: new THREE.Vector3(0, 1, 10), tp: new THREE.Vector3() };
function portrait() { return camera.aspect < 0.85; }
function camTo(px, py, pz, lx, ly, lz, kp, kl, dt) {
  const a = 1 - Math.exp(-kp * dt), b = 1 - Math.exp(-kl * dt);
  cam.p.x += (px - cam.p.x) * a; cam.p.y += (py - cam.p.y) * a; cam.p.z += (pz - cam.p.z) * a;
  cam.l.x += (lx - cam.l.x) * b; cam.l.y += (ly - cam.l.y) * b; cam.l.z += (lz - cam.l.z) * b;
}
// chase cam: sits behind the car along a blend of its heading/velocity and the line to the goal,
// and looks at a point between the car and the goal, so both stay framed on the approach
const chaseDir = { dx: 0, dz: 1, gk: 0 };
function chaseTarget(out) {
  const sy = Math.sin(V.yaw), cy = Math.cos(V.yaw);
  let dx = sy, dz = cy;
  if (V.speed > 2 && V.vF > -1) {
    const c = world.car, vl = Math.hypot(c.vx, c.vz) || 1;
    dx = sy * 0.6 + c.vx / vl * 0.4; dz = cy * 0.6 + c.vz / vl * 0.4;
  } else if (V.vF <= -1) { dx = sy; dz = cy; }
  // goal pull: stronger while the goal is ahead
  const gx = 0 - V.cx, gz = -1 - V.cz, gl = Math.hypot(gx, gz) || 1;
  const ahead = (gx * dx + gz * dz) / (gl * (Math.hypot(dx, dz) || 1));
  const gk = clamp(ahead, 0, 1) * 0.32;
  dx = dx * (1 - gk) + gx / gl * gk; dz = dz * (1 - gk) + gz / gl * gk;
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  chaseDir.dx = dx; chaseDir.dz = dz; chaseDir.gk = clamp(ahead, 0, 1);
  const P = portrait(), far = clamp((gl - 10) / 40, 0, 1);
  const dist = (P ? 7.5 : 6.6) + far * 0.9 + Math.min(1.5, V.speed * 0.04), h = (P ? 3.4 : 2.8) + far * 0.7;
  out.set(V.cx - dx * dist, V.cy + h, V.cz - dz * dist);
  out.x = clamp(out.x, -AX - 4, AX + 4); out.z = clamp(out.z, AZ0 + 1, AZ1 + 6);
  return chaseDir;
}
function chaseLook(dx, dz, P) {
  // between the car (weighted) and the goal mouth
  const k = 0.22 * chaseDir.gk;
  const lx = V.cx + dx * 4.5, lz = V.cz + dz * 4.5;
  return [lerp(lx, 0, k), (P ? 0.2 : 0.7) + chaseDir.gk * 0.5, lerp(lz, 0, k)];
}
function placeIntroCam() {
  const sy = Math.sin(world.car.yaw), cy = Math.cos(world.car.yaw);
  cam.p.set(world.car.x - sy * 4 + cy * 10, 8, world.car.z - cy * 4 - sy * 10 + 4);
  cam.l.set(world.car.x * 0.5, 1, lerp(world.car.z, world.ball.z, 0.4));
}
function updateCamera(dt) {
  const s = G.state, P = portrait();
  if (s === 'menu' || s === 'final' || s === 'boot') {
    const a = G.time * 0.22;
    const r = P ? 8.8 : 7.4;
    camTo(V.cx + Math.sin(a) * r, P ? 2.5 : 2.1, V.cz + Math.cos(a) * r, V.cx, P ? 0.15 : 0.6, V.cz, 3, 4, dt);
  } else if (s === 'replay') {
    const side = recTouch >= 0 && rec[recTouch * RF] > 0 ? -1 : 1;
    camTo(side * 13, 3.0, clamp(V.bz + 6, 4, 22), V.bx * 0.6, 1.3, V.bz - 1.5, 3, 6, dt);
  } else if (s === 'aiIntro' || s === 'aiPlay' || s === 'aiAfter') {
    if (!world.touched) {
      const { dx, dz } = chaseTarget(cam.tp);
      const [lx, ly, lz] = chaseLook(dx, dz, P);
      camTo(cam.tp.x, cam.tp.y + 1.5, cam.tp.z, lx, ly, lz, 4, 6, dt);
    } else camTo(V.bx * 0.4, P ? 6.5 : 5, clamp(V.bz + 14, 10, 34), V.bx * 0.8, 1.2, Math.min(V.bz, 4) - 2, 2.2, 6, dt);
  } else if (s === 'after' && G.lastRes === RES.GOAL && G.t > 1.0) {
    if (G.celebA === 0) { G.celebA = (world.ball.x > 0 ? -1 : 1) * 0.75; const r = P ? 17 : 14; cam.p.set(Math.sin(G.celebA) * r, 4.4, -1 + Math.cos(G.celebA) * r); cam.l.set(0, 1.8, -1); }
    const a = G.celebA + (G.t - 1.0) * 0.12 * Math.sign(-G.celebA), r = P ? 17 : 14;
    camTo(Math.sin(a) * r, 4.4, -1 + Math.cos(a) * r, 0, 1.8, -1, 2, 3, dt);
  } else if (s === 'tut' || s === 'intro') {
    const { dx, dz } = chaseTarget(cam.tp);
    const k = s === 'intro' ? clamp(G.t * 2.2, 0.6, 4) : 1;
    const [lx, ly, lz] = chaseLook(dx, dz, P);
    camTo(cam.tp.x, cam.tp.y, cam.tp.z, lx, ly, lz, k, k * 1.4, dt);
  } else {
    const { dx, dz } = chaseTarget(cam.tp);
    if (world.touched) {
      camTo(cam.tp.x, cam.tp.y + 0.6, cam.tp.z, V.bx, Math.max(1, V.by * 0.8), V.bz, 4, 7, dt);
    } else {
      const [lx, ly, lz] = chaseLook(dx, dz, P);
      camTo(cam.tp.x, cam.tp.y, cam.tp.z, lx, ly, lz, 6.5, 9, dt);
    }
  }
  G.shake = Math.max(0, G.shake - dt * 2.2);
  const sh = G.shake * G.shake * 0.35, tt = G.time * 37;
  camera.position.set(cam.p.x + Math.sin(tt) * sh, cam.p.y + Math.sin(tt * 1.3 + 1) * sh, cam.p.z + Math.cos(tt * 0.9) * sh);
  camera.lookAt(cam.l);
  const base = P ? 72 : 55;
  G.boostFov = Math.max(0, G.boostFov - dt * 1.2);
  const play = s === 'play' || s === 'intro';
  const want = base + (play ? Math.min(8, V.speed * 0.2) + (V.boostT > 0 ? 7 : 0) + G.boostFov * 4 : 0);
  G.fov += (want - G.fov) * Math.min(1, dt * 4);
  if (Math.abs(camera.fov - G.fov) > 0.01) { camera.fov = G.fov; camera.updateProjectionMatrix(); }
}

// ------------------------------------------------------------------ drawing the view state
const q1 = new THREE.Quaternion(), axis = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
let lbx = 0, lbz = SPOT;
function curModel() { return G.kicker === 'ai' && G.state !== 'menu' && G.state !== 'final' ? aiModel : carModel; }
function drawWorld(dt) {
  const model = curModel();
  const g = model.group;
  g.position.set(V.cx, V.cy, V.cz);
  g.rotation.set(-V.pitch, V.yaw, V.roll);
  G.hop = Math.max(0, G.hop - dt * 5);
  // body: a touch of extra pitch / roll so the weight transfer reads on a phone screen
  model.shell.position.y = Math.sin(G.hop * Math.PI) * 0.12;
  model.shell.rotation.x = -V.pitch * 0.6;
  model.shell.rotation.z = V.roll * 0.7;
  for (let i = 0; i < 4; i++) {
    const w = model.wheels[i];
    w.steer.position.y = model.wheelR + (V.comp[i] - model.sc) * 1.4 - (V.cy < -0.01 ? 0 : 0);
    w.spin.rotation.x = i < 2 ? V.wAngF : V.wAngR;
    if (i < 2) w.steer.rotation.y = V.steerA;
  }
  model.setBrake(V.brake);
  carBlob.position.set(V.cx, 0.02, V.cz); carBlob.rotation.z = V.yaw;
  carBlob.material.opacity = clamp(0.85 - V.cy * 0.5, 0.15, 0.85);
  // ball: rolls with its travel + spins with its vertical spin (curl reads visually)
  ballMesh.position.set(V.bx, V.by, V.bz);
  const dx = V.bx - lbx, dz = V.bz - lbz, dl = Math.sqrt(dx * dx + dz * dz);
  if (dl > 1e-4 && dl < 3) { axis.set(dz / dl, 0, -dx / dl); q1.setFromAxisAngle(axis, dl / R); ballMesh.quaternion.premultiply(q1); }
  if (G.state !== 'replay') { q1.setFromAxisAngle(yAxis, world.ball.wy * dt * (G.slowT > 0 ? G.slowK : 1)); ballMesh.quaternion.premultiply(q1); }
  lbx = V.bx; lbz = V.bz;
  ballBlob.position.set(V.bx, 0.02, V.bz);
  const bs = 1.9 + (V.by - R) * 0.25; ballBlob.scale.set(bs, bs, 1);
  ballBlob.material.opacity = clamp(0.8 - (V.by - R) * 0.15, 0.1, 0.8);
  keeperPose(V.kx, V.ky, V.kroll, V.kpose, KP);
  keeper.pose(KP.b0x, KP.b0y, KP.b1x, KP.b1y, KP.a0x, KP.a0y, KP.a1x, KP.a1y, KZ);
  stage.focus(lerp(V.cx, V.bx, 0.5), lerp(V.cz, V.bz, 0.5));
}

// per-frame emitters driven by the view state
function emitFx(dt, live) {
  const sy = Math.sin(V.yaw), cy = Math.cos(V.yaw);
  const model = curModel();
  const drifting = V.drifting && V.onGround && V.speed > 5;
  const sliding = V.onGround && Math.abs(V.slip) > 0.2 && V.speed > 6;
  const spinning = V.onGround && Math.abs(V.spin) > 0.25 && V.speed < 14;
  for (let i = 0; i < 2; i++) {
    const r = model.rear[i];
    const wx = V.cx + r.x * cy + r.z * sy, wz = V.cz - r.x * sy + r.z * cy;
    if (drifting || sliding || spinning) {
      skids.add(i, wx, wz, sy, cy, drifting ? 1 : 0.65);
      if (fr() < dt * (drifting ? 30 : 18)) smoke.emit(wx, 0.25, wz, -sy * 2 + (fr() - 0.5) * 2, 0.5 + fr() * 0.6, -cy * 2 + (fr() - 0.5) * 2, 0.9 + fr() * 0.7, 0.55, 2.8, 0.92, 0.93, 0.95, 0.3, 1.2, -0.25);
      // grass / dirt kick-up
      if (fr() < dt * (spinning ? 40 : 22)) {
        const dirt = fr() < 0.35, s = 2 + fr() * 3;
        smoke.emit(wx, 0.1, wz, -sy * s + (fr() - 0.5) * 2, 1.5 + fr() * 2.5, -cy * s + (fr() - 0.5) * 2, 0.5 + fr() * 0.4, 0.14, 0.1, dirt ? 0.32 : 0.22, dirt ? 0.24 : 0.5, dirt ? 0.14 : 0.15, 0.95, 0.5, 9);
      }
    } else skids.lift(i);
    if (drifting) {
      const col = LVC[V.level], n = (dt * (V.level ? 70 : 30)) + fr();
      for (let j = 0; j < n; j++) {
        const s = 2 + fr() * 4;
        sparks.emit(wx, 0.1, wz, -sy * s + (fr() - 0.5) * 3 + cy * (i ? -1 : 1) * fr() * 2, 1 + fr() * 3, -cy * s + (fr() - 0.5) * 3, 0.18 + fr() * 0.22, V.level ? 0.5 : 0.26, 0.05, col[0], col[1], col[2], 1, 2, 9);
      }
      if (V.level) sparks.emit(wx, 0.28, wz, 0, 0, 0, 0.05, 0.9 + V.level * 0.25 + fr() * 0.3, 0.6, col[0], col[1], col[2], 0.9, 0, 0);
    }
  }
  // boost: flame cones + a few hot embers
  const fl = model === carModel ? flame : aiFlame;
  fl.update(dt, G.time, V.boostT > 0, V.boostLv || 1);
  if (V.boostT > 0) {
    for (let e = 0; e < 2; e++) {
      const ex = model.exhaust[e];
      const wx = V.cx + ex.x * cy + ex.z * sy, wy = V.cy + ex.y, wz = V.cz - ex.x * sy + ex.z * cy;
      const n = dt * 40 + fr();
      for (let j = 0; j < n; j++) {
        const s = 6 + fr() * 6, hot = fr();
        sparks.emit(wx, wy, wz, -sy * s + (fr() - 0.5), (fr() - 0.2) * 1.5, -cy * s + (fr() - 0.5), 0.1 + fr() * 0.12, 0.45, 0.08, 1, 0.42 + hot * 0.4, 0.08 + hot * 0.2, 0.7, 1, -2);
      }
    }
  }
  // fireworks
  if (G.celebrate) {
    for (let i = 0; i < G.fwN; i++) {
      if (G.fw[i] > 0 && G.t >= G.fw[i]) {
        G.fw[i] = -1;
        const x = (fr() - 0.5) * 30, y = 15 + fr() * 8, z = -14 - fr() * 8;
        const c = fwCol.setHSL(fr(), 0.9, 0.6);
        for (let j = 0; j < 90; j++) {
          const u = fr() * 2 - 1, an = fr() * Math.PI * 2, rr = Math.sqrt(1 - u * u), s = 7 + fr() * 3;
          sparks.emit(x, y, z, rr * Math.cos(an) * s, u * s, rr * Math.sin(an) * s, 1.2 + fr() * 0.6, 1.0, 0.2, c.r * 1.5, c.g * 1.5, c.b * 1.5, 1, 1.5, 4);
        }
        audio.firework();
      }
    }
  }
  if (live) trail.update(dt, V.bx, V.by, V.bz, Math.hypot(world.ball.vx, world.ball.vy, world.ball.vz), camera.position, 0.55);
}

// last-moment slow motion: a fast shot about to meet the keeper / the goal line
function slowMoCheck() {
  if (G.lastSlow || !world.touched || G.state !== 'play') return;
  const b = world.ball;
  if (b.vz < -12 && b.z < 5.5 && b.z > 1.4 && Math.abs(b.x) < GX + 1.5 && b.y < GY + 1.2) {
    G.lastSlow = true; G.slowT = 0.42; G.slowK = 0.28;
  }
}

// ------------------------------------------------------------------ per-frame update
function frame(dt, draw = true) {
  G.time += dt;
  if (draw) renderer.info.reset();
  monitor(dt);
  let simDt = dt * G.timeScale;
  if (G.hitStop > 0) { G.hitStop -= dt; simDt = dt * 0.06; }
  else if (G.slowT > 0) { G.slowT -= dt; simDt = dt * G.slowK; }
  const s = G.state;
  let live = true;
  if (s === 'menu' || s === 'final' || s === 'boot' || s === 'tut') {
    if (s !== 'tut') viewParked(); else viewLive(1);
    live = false;
  } else if (s === 'paused') {
    live = false;
  } else if (s === 'intro') {
    G.t += dt;
    viewLive(1);
    if (G.t > 1.15) { G.state = 'play'; G.t = 0; G.goT = 0.7; ui.banner('GO!', 'hold GAS', 'info'); audio.whistle(false); }
  } else if (s === 'play') {
    G.t += dt;
    if (G.goT > 0 && (G.goT -= dt) <= 0) ui.hideBanner();
    stepSim(simDt, 'player');
    viewLive(G.alpha);
    slowMoCheck();
    // nudge if the player has not touched the gas yet
    if (!world.touched && world.car.speed < 0.5 && G.t > 2.2 && !G.gasHint) { G.gasHint = 1; ui.toast('HOLD GAS TO DRIVE!', false, 1800); }
    if (world.result) onPlayerResult();
  } else if (s === 'after') {
    G.t += dt;
    stepSim(simDt, 'idle');
    viewLive(G.alpha);
    if (G.lastRes === RES.GOAL && recGoal < 0) recGoal = recLen;
    if (G.lastRes === RES.GOAL) {
      if (G.t > 3.0 && recTouch >= 0) startReplay();
    } else if (G.t > 2.1) nextAfterPlayer();
  } else if (s === 'replay') {
    G.replayT += dt * 0.5 * 60;
    const f = G.replayA + G.replayT;
    if (f >= G.replayB) { nextAfterPlayer(); } else viewReplay(f);
    live = false;
  } else if (s === 'aiIntro') {
    G.t += dt;
    if (G.planning) { const t0 = performance.now(); while (performance.now() - t0 < (MANUAL ? 1e9 : 6)) { if (aiBot.work(1)) { G.planning = false; break; } } }
    viewLive(1);
    if (G.t > 1.3 && !G.planning) { G.state = 'aiPlay'; G.t = 0; ui.hideBanner(); ui.skip(true); audio.whistle(false); }
  } else if (s === 'aiPlay') {
    G.t += dt;
    stepSim(simDt, 'ai');
    viewLive(G.alpha);
    if (world.result) onAiResult();
  } else if (s === 'aiAfter') {
    G.t += dt;
    stepSim(simDt, 'idle');
    viewLive(G.alpha);
    if (G.t > 2.0) nextAfterAi();
  }
  if (s === 'after' && G.celebrate) G.excite = Math.max(G.excite, 0.9);
  G.excite = Math.max(0.12, G.excite - dt * 0.12);
  stage.crowdU.uExcite.value += (G.excite - stage.crowdU.uExcite.value) * Math.min(1, dt * 3);

  let lines = 0;
  if (s !== 'paused') {
    drawWorld(dt);
    if (s !== 'menu' && s !== 'final' && s !== 'boot') emitFx(dt, live);
    if (s === 'replay') { const f = G.replayA + G.replayT; trail.update(dt, V.bx, V.by, V.bz, f > recTouch && f < recGoal + 10 ? 30 : 0, camera.position, 0.55); }
    const fxDt = G.slowT > 0 ? dt * 0.3 : dt;
    sparks.update(fxDt); smoke.update(fxDt); confetti.update(dt); skids.update(dt); blast.update(fxDt);
    stage.update(dt, G.time);
    const b = world.ball;
    stage.netPress(b.x, b.y, b.z, b.z < -GD + R + 0.3 && Math.abs(b.x) < GX ? 0.25 : 0);
    updateCamera(dt);
    if (s === 'play' || s === 'aiPlay') lines = clamp((V.speed - 19) / 9, 0, 1) * 0.8 + (V.boostT > 0 ? 0.25 : 0);
  }
  G.flash = Math.max(0, G.flash - dt * 2.2);
  post.flash = G.flash * G.flash * 0.6;
  post.lines += (lines - post.lines) * Math.min(1, dt * 6);
  // HUD + audio
  if (s === 'play' || s === 'intro') {
    const c = world.car;
    ui.hud(ui.input.steer, c.speed, c.charge, c.level, c.boostT > 0, s === 'intro' ? SHOT_TIME : (world.touched ? 0 : SHOT_TIME - world.t), c.rpm, c.reverse, post.enabled ? 0 : post.lines * 0.8);
    audio.drive(c.speed, c.throttle, c.drifting ? Math.max(0.35, Math.abs(c.slip)) : Math.max(Math.abs(c.slip), Math.abs(c.slipK[2]) * 0.6), c.boostT > 0 ? 1 : 0, s === 'play');
  } else if (s === 'aiPlay') {
    const c = world.car; audio.drive(c.speed, 1, c.drifting ? 0.4 : c.slip, c.boostT > 0 ? 1 : 0, true);
  } else if (s === 'after' || s === 'aiAfter') {
    const c = world.car; audio.drive(c.speed, 0, c.slip, 0, true);
  } else audio.silence();
  const h = renderer.domElement.height;
  const sc = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  sparks.mat.uniforms.uScale.value = sc; smoke.mat.uniforms.uScale.value = sc;
  if (draw) post.render(scene, camera, G.time);
}

function startReplay() {
  ui.hideBanner();
  const a = Math.max(0, recTouch - 50), b = Math.min(recLen - 1, (recGoal > 0 ? recGoal : recLen) + 40);
  if (b - a < 20) { nextAfterPlayer(); return; }
  G.state = 'replay'; G.replayA = a; G.replayB = b; G.replayT = 0;
  G.celebrate = false; sparks.clear(); smoke.clear(); confetti.clear();
  ui.tag(true); ui.skip(true);
  trail.reset(rec[a * RF + 12], rec[a * RF + 13], rec[a * RF + 14]);
  const side = rec[recTouch * RF] > 0 ? -1 : 1;
  cam.p.set(side * 13, 3.0, 14); cam.l.set(rec[a * RF + 12], 1.2, rec[a * RF + 14]);
}

// ------------------------------------------------------------------ quality + resize
const QM = { t: 0, acc: 0, n: 0 };
function applyQuality() {
  const dpr = Math.min(window.devicePixelRatio || 1, [1, 1.5, 2][Q.level]);
  renderer.setPixelRatio(dpr);
  stage.setShadowSize([1024, 1024, 2048][Q.level]);
  renderer.shadowMap.type = Q.level === 0 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  stage.setCrowdFraction([0.62, 0.82, 1][Q.level]);
  sparks.budget = [500, 800, 1000][Q.level]; sparks.next %= sparks.budget;
  smoke.budget = [160, 240, 320][Q.level]; smoke.next %= smoke.budget;
  post.setTier(Q.level);
  ui.el.lines.style.display = post.enabled ? 'none' : '';
  resize();
}
function monitor(dt) {
  if (MANUAL || FORCE_Q >= 0 || G.state === 'boot' || G.state === 'paused' || dt <= 0) return;
  QM.t += dt; if (QM.t < 3) return;
  QM.acc += dt; QM.n++;
  if (QM.n >= 90) {
    const avg = QM.acc / QM.n;
    if (avg > 1 / 48 && Q.level > 0) { Q.level--; applyQuality(); QM.t = 0; }
    QM.acc = 0; QM.n = 0;
  }
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const pr = renderer.getPixelRatio();
  post.setSize(Math.floor(w * pr), Math.floor(h * pr));
  camera.aspect = w / h; camera.updateProjectionMatrix();
  ui.relayout();
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ boot: prewarm shaders behind the splash
function prewarm() {
  for (let i = 0; i < 20; i++) { sparks.emit(0, 1, SPOT, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0); smoke.emit(0, 1, SPOT, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0.5, 0, 0); }
  sparks.update(0.016); smoke.update(0.016);
  confetti.burst(0, 2, 5, 20, fr); confetti.update(0.016);
  trail.mesh.visible = true; trail.mat.uniforms.uOpacity.value = 0.5;
  skids.add(0, 0, 20, 0, 1, 1); skids.add(0, 0, 21, 0, 1, 1); skids.update(0);
  blast.fire(0, 1, 5, 1, 1, 1); blast.update(0.1);
  flame.group.visible = true; aiFlame.group.visible = true; flame.on = aiFlame.on = 1;
  aiModel.group.visible = true;
  post.prewarm();
  for (const th of ['night', 'day']) { save.theme = th; applyTheme(); renderer.compile(scene, camera); post.render(scene, camera, 0); }
  aiModel.group.visible = false; flame.on = aiFlame.on = 0; flame.update(1, 0, false, 1); aiFlame.update(1, 0, false, 1);
  blast.t = 1; blast.update(0);
  sparks.clear(); smoke.clear(); confetti.clear(); skids.clear(); trail.reset(0, R, SPOT);
}
const theme0 = save.theme;
applyQuality();
G.fov = portrait() ? 72 : 55; camera.fov = G.fov; camera.updateProjectionMatrix();
viewParked(); drawWorld(0); updateCamera(0.016);
prewarm();
save.theme = theme0; applyTheme();
toMenu();
frame(0.016);
setTimeout(() => ui.el.splash.classList.add('off'), MANUAL ? 0 : 250);

let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - lastT) / 1000; lastT = now;
  if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
  frame(dt);
}
if (!MANUAL) requestAnimationFrame(loop);

// test / debug hooks (used by the headless screenshot script)
window.__drift = {
  G, world, V, ui, save, Q, aiBot, post,
  tick(sec, step = 1 / 60) { const n = Math.round(sec / step); for (let i = 0; i < n; i++) frame(step, false); frame(0, true); },
  render() { frame(0, true); },
  start: startGame, toMenu, setTheme: (t) => { save.theme = t; applyTheme(); },
  skipTut() { save.tut2 = true; ui.overlay('tut', false); if (G.state === 'tut') beginIntro(); },
  drive(steer, drift, jump, throttle = 1, brake = 0) { G.botOn = false; G.force = steer === null ? null : { steer, throttle, brake, drift: !!drift, jump: !!jump }; },
  bot(on) { G.botOn = on; if (on) { helpBot.setCar(CARS[save.car]); helpBot.reset(world); } },
  info() { return { state: G.state, t: G.t, res: world.result, drifting: world.car.drifting, level: world.car.level, boost: world.car.boostT, touched: world.touched, carZ: world.car.z, speed: world.car.speed, ballZ: world.ball.z, q: Q.level, post: post.enabled, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; },
};
