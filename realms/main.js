import * as THREE from 'three';
import { mulberry32, unitModel } from './models.js?v=1.7';
import { havenModel } from './units_haven.js?v=1.7';
import { necroModel } from './units_necro.js?v=1.7';
import { necroUpModel } from './units_necro_up.js?v=1.7';
import { havenUpModel } from './units_haven_up.js?v=1.7';
import { neutralModel } from './units_neutral.js?v=1.7';
import { townModel, heroModel, flagModel } from './models_towns.js?v=1.7';
import { objectModel } from './models_objects.js?v=1.7';
import { natureModel, FLORA_FOR_TERRAIN, FOREST_BY_BIOME, PEAK_BY_BIOME, biomeOf } from './nature.js?v=1.7';
import { createBattlefield, wallModel, towerModel, gateModel, keepModel, siegeLayout } from './battlefield.js?v=1.7';
import { createTownView } from './town_view.js?v=1.7';
import { createVfx, shotKind, meleeKind } from './vfx.js?v=1.7';
import { createAtmosphere, gradeGLSL } from './atmosphere.js?v=1.7';
import { UNITS, UPGRADES, FACTIONS, NEUTRALS, BUILDINGS, SPELLS, ARTIFACTS, SKILLS, OBJECTS, RES, RES_ICON, START_ARMY, FACTION_START } from './data.js?v=1.7';
// newer factions load guarded, so a missing or broken module never stops the game (it falls back to placeholders)
const [SYLm, INFm, DUNm] = await Promise.allSettled([import('./units_sylvan.js?v=1.7'), import('./units_inferno.js?v=1.7'), import('./units_dungeon.js?v=1.7')]);
const FAC_MODEL = { sylvan: SYLm.value?.sylvanModel, inferno: INFm.value?.infernoModel, dungeon: DUNm.value?.dungeonModel };
import * as BT from './battle.js?v=1.7';
import { makeBodyMaterial, makeGlowMaterial, makeHitMaterial, makeInkHullMaterial, makeBlobShadowMaterial, blobShadowGeometry, setAnim, setRigIdle, ANIM, ANIM_IMPACT, tick as tickMaterials, addFormNormals } from './materials.js?v=1.7';
import { createScore } from './music.js?v=1.7';
import { createSfx } from './sfx.js?v=1.7';
import { unitFit, applyFit } from './unit_fit.js?v=1.7';
import { createMapFx } from './mapfx.js?v=1.7';
import { icon } from './icons.js';
import { initPortraits, portraitImg, preloadPortraits, heroPortraitImg } from './portraits.js?v=1.7';

// =====================================================================
// ORBIS · Five Crowns: a pocket strategy game on a tiny hex planet.
// Five crowns, one tiny world. Lead your heroes across the world, flag
// mines, gather treasure, build your town and recruit its creatures, and
// defeat the rival crowns in turn-based battles on a hex battlefield.
// =====================================================================

const APP_VERSION = '1.7';
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
let rnd = Math.random;
const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return n >>> 0; };

// ------------------------------------------------------------------ the planet: an icosphere of hex columns
const R = 5, STEP = 0.07, SEA = 3;
function icosphere(detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => new THREE.Vector3(...v).normalize());
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 100000 + b : b * 100000 + a;
      if (cache.has(key)) return cache.get(key);
      verts.push(verts[a].clone().add(verts[b]).normalize());
      cache.set(key, verts.length - 1);
      return verts.length - 1;
    };
    const nf = [];
    for (const [a, b, c] of faces) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    faces = nf;
  }
  return { verts, faces };
}
const { verts: DIRS, faces: FACES } = icosphere(4);
const NV = DIRS.length;
const NBR = (() => {
  const s = Array.from({ length: NV }, () => new Set());
  for (const [a, b, c] of FACES) { s[a].add(b).add(c); s[b].add(a).add(c); s[c].add(a).add(b); }
  return s.map((x) => [...x]);
})();
const CORN = FACES.map(([a, b, c]) => DIRS[a].clone().add(DIRS[b]).add(DIRS[c]).normalize());
const CELLS = (() => {
  const around = Array.from({ length: NV }, () => []);
  FACES.forEach((f, i) => { for (const v of f) around[v].push(i); });
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  return around.map((fs, v) => {
    const d = DIRS[v];
    const t1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? Y : X).normalize(), t2 = d.clone().cross(t1);
    const ang = (f) => Math.atan2(CORN[f].dot(t2), CORN[f].dot(t1));
    fs.sort((p, q) => ang(p) - ang(q));
    const nb = fs.map((f, i) => { const g = fs[(i + 1) % fs.length]; return FACES[f].find((x) => x !== v && FACES[g].includes(x)); });
    return { fs, nb };
  });
})();
const YAW = (() => {
  const Y = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), c = new THREE.Vector3();
  return DIRS.map((d, v) => { q.setFromUnitVectors(Y, d).invert(); c.copy(CORN[CELLS[v].fs[0]]).applyQuaternion(q); return Math.atan2(-c.z, c.x); });
})();
function bfs(v, r, pass = null) {
  const out = [[v, 0]], seen = new Set([v]);
  for (let i = 0; i < out.length; i++) {
    const [x, d] = out[i];
    if (d >= r) continue;
    for (const n of NBR[x]) if (!seen.has(n) && (!pass || pass(n))) { seen.add(n); out.push([n, d + 1]); }
  }
  return out;
}

// ------------------------------------------------------------------ terrain
// 0 water, 1 grass, 2 dirt, 3 sand, 4 snow, 5 swamp, 6 rough, 7 lava, 8 mountain, 9 forest
const T = { WATER: 0, GRASS: 1, DIRT: 2, SAND: 3, SNOW: 4, SWAMP: 5, ROUGH: 6, LAVA: 7, MOUNT: 8, FOREST: 9 };
const TER_NAME = ['Water', 'Grass', 'Dirt', 'Sand', 'Snow', 'Swamp', 'Rough', 'Lava', 'Mountains', 'Forest'];
const TER_COST = [0, 100, 100, 150, 150, 175, 125, 100, 0, 0];
const TER_COL = [0x2a5a9a, 0x5aaa3a, 0x9a7a4a, 0xe2cc8a, 0xeef4f8, 0x4a6a3a, 0x9a8a6a, 0x5a3430, 0x7a6e64, 0x3e7e34].map((c) => new THREE.Color(c));
const ROAD_COL = new THREE.Color(0xc8a874);
const ter = new Uint8Array(NV), h = new Int8Array(NV), road = new Uint8Array(NV), seen = new Uint8Array(NV);
const objAt = new Int32Array(NV).fill(-1);
const passable = (v) => ter[v] !== T.WATER && ter[v] !== T.MOUNT && ter[v] !== T.FOREST;
const posOf = (v, lift = 0) => DIRS[v].clone().multiplyScalar(R + h[v] * STEP + lift);
const radiusOf = (v) => R + h[v] * STEP;

function noise3(seed) {
  const r = mulberry32(seed), waves = [];
  for (let i = 0; i < 9; i++) waves.push({ d: new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize(), f: 1.5 + r() * 3.5 * (1 + i * 0.3), p: r() * 6.28, a: 1 / (1 + i * 0.6) });
  return (v) => { let s = 0, t = 0; for (const w of waves) { s += Math.sin(DIRS[v].dot(w.d) * w.f + w.p) * w.a; t += w.a; } return s / t; };
}
function generate(seed) {
  const elev = noise3(seed), moist = noise3(seed + 7), heat = noise3(seed + 13), ridge = noise3(seed + 21);
  for (let v = 0; v < NV; v++) {
    const e = elev(v) + 0.18, lat = Math.abs(DIRS[v].y), m = moist(v), ht = heat(v) - lat * 0.9;
    if (e < -0.12) { ter[v] = T.WATER; h[v] = SEA - 1 - (e < -0.3 ? 1 : 0); continue; }
    h[v] = SEA + 1 + (e > 0.25 ? 1 : 0) + (e > 0.45 ? 1 : 0);
    const rg = Math.abs(ridge(v));
    if (rg < 0.06 && e > 0.05) { ter[v] = T.MOUNT; h[v] = SEA + 4 + (rg < 0.03 ? 1 : 0); continue; }
    if (lat > 0.8 || ht < -0.85) ter[v] = T.SNOW;
    else if (e < -0.04) ter[v] = T.SAND;
    else if (ht > 0.38 && m < -0.1) ter[v] = T.LAVA;
    else if (m > 0.38 && e < 0.2) ter[v] = T.SWAMP;
    else if (m < -0.42) ter[v] = T.DIRT;
    else if (e > 0.42) ter[v] = T.ROUGH;
    else ter[v] = T.GRASS;
    if (ter[v] !== T.LAVA && ter[v] !== T.SAND && m > 0.12 && hash(v * 7 + seed) % 100 < 28 + m * 40) ter[v] = T.FOREST;
  }
}

// ------------------------------------------------------------------ world state
const G = { mode: 'menu', seed: 1, day: 1, players: [], heroes: [], towns: [], objects: [], diff: 1, selHero: -1, over: false };
// player 0 is you; the others are computer lords
function newPlayer(i, fac, ai) { return { i, fac, ai, res: { gold: ai ? 7500 : 10000, wood: 20, ore: 20, gems: 5 }, alive: true, color: FACTIONS[fac].color, css: FACTIONS[fac].css, name: i === 0 ? 'You' : FACTIONS[fac].name }; }
function newHero(p, v, name) {
  return { id: G.heroes.length, p, v, name, lvl: 1, xp: 0, att: 1, def: 1, pow: 1, know: 1, mana: 10, mp: 0, mpMax: 1500, skills: {}, spells: [], arts: [], army: [], visited: [], alive: true, path: null };
}
const heroArmy = (hr) => hr.army.filter((x) => x && x[1] > 0);
const statOf = (hr, k) => hr[k] + hr.arts.reduce((a, id) => a + (ARTIFACTS.find((x) => x.id === id)[k] || 0), 0);
const maxMana = (hr) => statOf(hr, 'know') * 10;
const moveMax = (hr) => Math.round((1500 + hr.arts.reduce((a, id) => a + (ARTIFACTS.find((x) => x.id === id).move || 0), 0)) * (1 + 0.15 * (hr.skills.logistics || 0)));
function addTroops(army, id, n) {
  const slot = army.findIndex((x) => x && x[0] === id);
  if (slot >= 0) { army[slot][1] += n; return true; }
  const free = army.findIndex((x) => !x || x[1] <= 0);
  if (free >= 0) { army[free] = [id, n]; return true; }
  if (army.length < 7) { army.push([id, n]); return true; }
  return false;
}
const xpFor = (lvl) => Math.round(1000 * (Math.pow(1.6, lvl - 1) - 1) / 0.6);

// ------------------------------------------------------------------ renderer, camera, lights
// no canvas MSAA: every view is drawn into post's 4x-MSAA target and only a fullscreen quad reaches the
// canvas, so a multisampled default framebuffer would just cost memory and a resolve per frame
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; // frame() decides when the shadow maps re-render
$('app').prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d1e);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
const sunDir = new THREE.Vector3(0.6, 0.8, 0.4).normalize();
const sun = new THREE.DirectionalLight(0xffe8c4, 2.5);
sun.shadow.radius = 2.5; sun.shadow.intensity = 0.65;
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 30 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x7a6440, 1.05));
scene.add(new THREE.AmbientLight(0x7880b8, 0.4));
// Map camera: (theta, phi, dist) chase a target (tTheta, tPhi, tDist) through a critically damped spring
// (smoothDamp), so every motion is frame-rate independent and velocity-continuous: a retarget (flyTo, follow,
// a grab mid-flight) bends the path instead of kinking it. Input only moves the target:
//  - drag: finger deltas accumulate in dragTheta/dragPhi and are applied once per frame (no lost or doubled events)
//  - fling: on release the target keeps moving at the measured finger speed (rad/s) and decays exponentially
//  - flyTo: target jumps, the spring eases out of rest and into the goal; any touch takes over where the camera is
//  - follow: while a hero walks in view, the target tracks its (smoothly lerped) mesh, never the per-step hex
const cam = { theta: 0, phi: 1.2, dist: 10, tTheta: 0, tPhi: 1.2, tDist: 10, vTheta: 0, vPhi: 0, fly: false, shake: 0,
  sTheta: 0, sPhi: 0, sDist: 0, dragTheta: 0, dragPhi: 0, dragging: false, spin: 0, holdFollow: null, aiFollow: null };
const lookAtP = new THREE.Vector3(), camFocus = new THREE.Vector3(), camRight = new THREE.Vector3(), camTmp = new THREE.Vector3();
const PHI_MIN = 0.12, PHI_MAX = Math.PI - 0.12;
const wrapPi = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
// critically damped spring toward `to` (Game Programming Gems 4, ch. 1.10); stable for any dt; returns [x, v]
function smoothDamp(x, to, v, st, dt) {
  const w = 2 / st, k = w * dt, e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k), c = x - to, tmp = (v + w * c) * dt;
  return [to + (c + tmp) * e, (v - w * tmp) * e];
}
const FLING_DECAY = 7, FLING_MAX = 2.8; // 1/s, rad/s: the longest glide is FLING_MAX / FLING_DECAY = 0.4 rad
function camGrab() {
  // a finger lands: stop flights, flings and follow right where the camera is (plus a hair of its momentum,
  // so a fast flight settles in ~0.1 s instead of stopping dead); no positional jump either way
  cam.fly = false; cam.vTheta = cam.vPhi = 0;
  cam.tTheta = cam.theta + cam.sTheta * 0.04; cam.tPhi = clamp(cam.phi + cam.sPhi * 0.04, PHI_MIN, PHI_MAX);
  if (walking) cam.holdFollow = walking;
  else if (aiRunning) cam.holdFollow = 'ai'; // grabbing the map during the enemy turn hands the camera back for that turn
}
function camSnap(theta, phi) { cam.theta = cam.tTheta = theta; cam.phi = cam.tPhi = phi; cam.sTheta = cam.sPhi = cam.vTheta = cam.vPhi = 0; cam.fly = false; }
const followDir = new THREE.Vector3(), followSp = new THREE.Spherical();
function followTarget() {
  // the hero to keep in frame: ours while it walks (until the player grabs the map), or an enemy walking in sight
  if (cam.dragging) return null;
  if (walking && cam.holdFollow !== walking && walking.hr.p === 0) return heroMeshes.get(walking.hr.id) || null;
  // enemy turn: once the camera has been brought to a visible mover (aiWatch), lock onto whichever enemy hero is
  // stepping in sight and keep tracking its interpolated mesh, also through the short pauses between its steps
  // (so the spring never brakes and restarts per hex). Ends when it is out of sight or the AI turn is over; the
  // camera then simply eases to rest where it is (the target stops moving, nothing snaps).
  if (!aiRunning) { cam.aiFollow = null; if (cam.holdFollow === 'ai') cam.holdFollow = null; return null; }
  if (!aiWatch || cam.holdFollow === 'ai') return null;
  for (const h of G.heroes) if (h.anim && h.alive && h.p !== 0 && (seen[h.anim.from] || seen[h.anim.to])) { cam.aiFollow = h; break; }
  const h = cam.aiFollow;
  if (!h || !h.alive || (!h.anim && !seen[h.v])) { cam.aiFollow = null; return null; }
  return heroMeshes.get(h.id) || null;
}
function updateCamera(dt) {
  let st = 0.05; // spring time while dragging/flinging: tight enough to feel 1:1, loose enough to hide event jitter
  if (cam.dragging) {
    cam.tTheta += cam.dragTheta; cam.tPhi += cam.dragPhi; cam.dragTheta = cam.dragPhi = 0; cam.fly = false;
  } else {
    const fm = followTarget();
    if (fm) {
      followSp.setFromVector3(followDir.copy(fm.position));
      cam.tTheta = cam.theta + wrapPi(followSp.theta - cam.theta); cam.tPhi = followSp.phi; cam.fly = false; cam.vTheta = cam.vPhi = 0;
      st = 0.32;
    } else if (cam.fly) {
      st = 0.3;
      if (Math.abs(wrapPi(cam.tTheta - cam.theta)) < 0.0008 && Math.abs(cam.tPhi - cam.phi) < 0.0008 && Math.abs(cam.sTheta) + Math.abs(cam.sPhi) < 0.01) cam.fly = false;
    } else {
      // fling inertia (rad/s), decaying exponentially with time, plus the title-screen spin
      cam.tTheta += (cam.vTheta + cam.spin) * dt; cam.tPhi += cam.vPhi * dt;
      const k = Math.exp(-FLING_DECAY * dt); cam.vTheta *= k; cam.vPhi *= k;
      if (Math.abs(cam.vTheta) + Math.abs(cam.vPhi) < 1e-3) cam.vTheta = cam.vPhi = 0;
    }
  }
  // the pole clamp acts on the target (a fling into the pole just stops there)
  if (cam.tPhi < PHI_MIN || cam.tPhi > PHI_MAX) { cam.tPhi = clamp(cam.tPhi, PHI_MIN, PHI_MAX); cam.vPhi = 0; }
  // spin along the short way round; keep theta bounded so float precision never drifts
  const dth = wrapPi(cam.tTheta - cam.theta);
  if (Math.abs(cam.theta) > 1000) { const w = cam.theta - wrapPi(cam.theta); cam.theta -= w; }
  cam.tTheta = cam.theta + dth;
  [cam.theta, cam.sTheta] = smoothDamp(cam.theta, cam.tTheta, cam.sTheta, st, dt);
  [cam.phi, cam.sPhi] = smoothDamp(cam.phi, cam.tPhi, cam.sPhi, st, dt);
  cam.phi = clamp(cam.phi, PHI_MIN, PHI_MAX);
  [cam.dist, cam.sDist] = smoothDamp(cam.dist, cam.tDist, cam.sDist, 0.14, dt);
  // close up, the camera tilts toward the horizon like a strategy map
  const f = clamp((16 - cam.dist) / 9, 0, 1);
  const cphi = cam.phi + f * 0.4;
  camera.position.setFromSphericalCoords(cam.dist, cphi, cam.theta);
  if (cam.shake > 0) { camera.position.x += (rnd() - 0.5) * cam.shake * 0.1; cam.shake = Math.max(0, cam.shake - dt * 2); }
  lookAtP.setFromSphericalCoords(R * f * 0.98, cam.phi, cam.theta);
  // 'up' is the local north tangent: continuous even when the tilt carries the camera past a pole
  camera.up.set(-Math.cos(cphi) * Math.sin(cam.theta), Math.sin(cphi), -Math.cos(cphi) * Math.cos(cam.theta));
  camera.lookAt(lookAtP);
  // the shadow-casting sun follows the view so shadows stay crisp near the camera
  // (scratch vectors: this runs every frame, so no allocations)
  const focus = camFocus.copy(lookAtP.lengthSq() > 0.01 ? lookAtP : camera.position).setLength(R);
  const right = camRight.crossVectors(camera.position, UP).normalize();
  sun.position.copy(focus).addScaledVector(camTmp.copy(camera.position).sub(focus).normalize(), 9).addScaledVector(right, 5).addScaledVector(camTmp.copy(focus).normalize(), 6);
  sun.target.position.copy(focus);
}
function flyTo(v, dist) {
  // the spring eases from the current motion into the new goal (no velocity kink if a flight is retargeted)
  const sp = new THREE.Spherical().setFromVector3(DIRS[v]);
  cam.tTheta = cam.theta + wrapPi(sp.theta - cam.theta); cam.tPhi = clamp(sp.phi, PHI_MIN, PHI_MAX); cam.fly = true; cam.vTheta = cam.vPhi = 0;
  if (dist) cam.tDist = dist;
}
function resize() {
  const w = window.innerWidth, hh = window.innerHeight;
  renderer.setSize(w, hh);
  post.setSize(w, hh, renderer.getPixelRatio());
  camera.aspect = w / hh; camera.fov = w < hh ? 50 : 40; camera.updateProjectionMatrix();
  bcam.aspect = w / hh; bcam.fov = w < hh ? 52 : 40; bcam.updateProjectionMatrix();
  if (typeof townView !== 'undefined') townView.resize(w, hh);
}
window.addEventListener('resize', resize);
// ------------------------------------------------------------------ adaptive quality governor
// The render resolution follows the measured frame time: full quality is min(devicePixelRatio, 2) (the old fixed
// setting, so a fast device looks exactly as before) and it steps down by 0.25 to 1.25 when frames run long.
// Anti-pumping: decisions use the median of ~1 s of frames (GC spikes / hitches > 250 ms are ignored), a wide
// band between "too slow" (> 22 ms) and "room to spare" (< 17.5 ms), and every failed step up doubles the wait
// before the next try (8 s .. 5 min). ?q=high / ?q=low pins the level. State: window.__realms.quality().
const QG = (() => {
  const maxPR = Math.min(window.devicePixelRatio || 1, 2), minPR = Math.min(maxPR, 1.25);
  const steps = [];
  for (let p = maxPR; p > minPR + 0.01; p -= 0.25) steps.push(Math.round(p * 100) / 100);
  steps.push(minPR);
  const pin = new URLSearchParams(location.search).get('q');
  const S = { auto: pin !== 'high' && pin !== 'low' && steps.length > 1, level: pin === 'low' ? steps.length - 1 : 0, steps, pr: steps[0], ms: 0, changes: 0, waitUp: 8 };
  const win = new Float32Array(60), sorted = new Float32Array(60);
  let n = 0, k = 0, acc = 0, lastT = 0, lastChange = 0, lastUp = -1e9, holdUp = 0;
  function apply(level) {
    S.level = level; S.pr = steps[level]; S.changes++;
    renderer.setPixelRatio(S.pr);
    camera.userData.pixelRatio = bcam.userData.pixelRatio = S.pr; // star / mote point sizes are in buffer pixels
    // ink lines are clamped in buffer pixels: keep their on-screen width when the buffer shrinks (1.0 at full quality)
    if (typeof inkMat !== 'undefined') { const u = inkMat.userData.uniforms, f = S.pr / maxPR; u.uHullMin.value = Math.max(1, 1.5 * f); u.uHullMax.value = Math.max(1.25, 2.5 * f); }
    resize();
  }
  function reset() { n = 0; k = 0; acc = 0; }
  // called once per drawn frame with the rAF timestamp
  function sample(now) {
    const dt = lastT ? now - lastT : 0; lastT = now;
    if (!S.auto || !dt) return;
    if (dt > 250 || document.hidden) { reset(); return; } // a load / shader compile / tab switch says nothing about the GPU
    win[k] = dt; k = (k + 1) % win.length; if (n < win.length) n++;
    acc += dt;
    if (n < 6 || acc < 1000) return; // judge about once a second, on the last <= 60 frames
    acc = 0;
    const srt = sorted.subarray(0, n); srt.set(win.subarray(0, n)); srt.sort();
    const ms = S.ms = srt[n >> 1];
    if (ms > 22 && S.level < steps.length - 1 && now - lastChange > 1500) {
      // a step up that did not hold: wait twice as long before the next attempt
      if (now - lastUp < 12000) S.waitUp = Math.min(300, S.waitUp * 2);
      holdUp = now + S.waitUp * 1000; lastChange = now;
      apply(Math.min(steps.length - 1, S.level + (ms > 40 ? 2 : 1))); reset();
    } else if (ms < 17.5 && S.level > 0 && now > holdUp && now - lastChange > 4000) {
      lastChange = lastUp = now;
      apply(S.level - 1); reset();
    }
  }
  function state() { return { auto: S.auto, level: S.level, pr: S.pr, maxPR, minPR, steps: steps.slice(), medianMs: Math.round(S.ms * 10) / 10, changes: S.changes, waitUpS: S.waitUp }; }
  // tests: quality.set({ auto: false, level: 0 }) pins full quality, set({ auto: true }) resumes
  state.set = (o = {}) => { if (o.auto !== undefined) S.auto = !!o.auto; if (o.level !== undefined && o.level !== S.level) apply(clamp(o.level | 0, 0, steps.length - 1)); reset(); return state(); };
  return { sample, state, init() { if (S.level) apply(S.level); else camera.userData.pixelRatio = bcam.userData.pixelRatio = S.pr; } };
})();
const atmos = createAtmosphere(THREE, scene, { R });


// ------------------------------------------------------------------ the planet mesh: bevelled hex columns with cliff walls
// the surface itself (textures, bevels, cliffs, roads, fog, water) is built by terrain.js
import { createPlanet } from './terrain.js?v=1.7';
const TERRAIN = createPlanet({ R, STEP, SEA, DIRS, CORN, FACES, CELLS });
const planet = TERRAIN.planet, triCell = TERRAIN.triCell;
planet.castShadow = planet.receiveShadow = true;
scene.add(planet);
const FOG = new THREE.Color(0x10131f);
const tc = new THREE.Color();
function cellColor(v) {
  if (!seen[v]) return tc.copy(FOG).multiplyScalar(0.9 + (hash(v) % 10) / 50);
  tc.copy(road[v] && ter[v] !== T.WATER ? ROAD_COL : TER_COL[ter[v]]);
  if (ter[v] === T.WATER) tc.lerp(new THREE.Color(0x0c2a5a), clamp((SEA - h[v]) / 3, 0, 1));
  if (ter[v] === T.FOREST) tc.multiplyScalar(0.9);
  return tc.multiplyScalar(0.93 + (hash(v * 3) % 1000) / 9000);
}
function rebuildPlanet() { TERRAIN.rebuild(ter, h, road, seen); }
// water: flat hex tiles at sea level with depth colour, shore foam, waves and glints
const water = TERRAIN.water;
water.receiveShadow = true;
scene.add(water);


// ------------------------------------------------------------------ bloom
const post = (() => {
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const opts = { type: THREE.HalfFloatType, depthBuffer: false };
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const rtA = new THREE.WebGLRenderTarget(1, 1, opts), rtB = new THREE.WebGLRenderTarget(1, 1, opts);
  const vs = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const bright = new THREE.ShaderMaterial({ uniforms: { tMap: { value: null } }, vertexShader: vs, depthTest: false,
    fragmentShader: 'uniform sampler2D tMap; varying vec2 vUv; void main() { vec3 c = texture2D(tMap, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.9, 1.7, l), 1.0); }' });
  const blur = new THREE.ShaderMaterial({ uniforms: { tMap: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false,
    fragmentShader: 'uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv; void main() { vec3 c = texture2D(tMap, vUv).rgb * 0.227; c += (texture2D(tMap, vUv + uDir * 1.38).rgb + texture2D(tMap, vUv - uDir * 1.38).rgb) * 0.316; c += (texture2D(tMap, vUv + uDir * 3.23).rgb + texture2D(tMap, vUv - uDir * 3.23).rgb) * 0.07; gl_FragColor = vec4(c, 1.0); }' });
  const comp = new THREE.ShaderMaterial({ uniforms: { tScene: { value: null }, tBloom: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uSharp: { value: 0.35 } }, vertexShader: vs, depthTest: false,
    fragmentShader: `uniform sampler2D tScene; uniform sampler2D tBloom; uniform vec2 uTexel; uniform float uSharp; varying vec2 vUv;
      ${gradeGLSL}
      void main() {
        // light adaptive sharpening: small models keep crisp edges on phone screens
        vec3 c0 = texture2D(tScene, vUv).rgb;
        vec3 n4 = texture2D(tScene, vUv + vec2(uTexel.x, 0.0)).rgb + texture2D(tScene, vUv - vec2(uTexel.x, 0.0)).rgb + texture2D(tScene, vUv + vec2(0.0, uTexel.y)).rgb + texture2D(tScene, vUv - vec2(0.0, uTexel.y)).rgb;
        vec3 mn = min(c0, n4 * 0.25), mx = max(c0, n4 * 0.25);
        vec3 c = clamp(c0 + (c0 * 4.0 - n4) * uSharp * 0.25, mn * 0.85, mx * 1.15 + 0.02) + texture2D(tBloom, vUv).rgb * 0.8; c = grade(c); c = c / (1.0 + c * 0.12);
        float v = smoothstep(1.15, 0.35, length(vUv - 0.5)); c *= mix(0.84, 1.0, v);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  let w = 1, hh = 1;
  return {
    setSize(W, H, pr) { w = W * pr; hh = H * pr; rtScene.setSize(w, hh); comp.uniforms.uTexel.value.set(1 / w, 1 / hh); rtA.setSize(w / 2, hh / 2); rtB.setSize(w / 2, hh / 2); },
    render(sc, cm) {
      renderer.setRenderTarget(rtScene); renderer.render(sc, cm);
      const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
      quad.material = bright; bright.uniforms.tMap.value = rtScene.texture; renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
      quad.material = blur;
      for (let i = 0; i < 2; i++) {
        blur.uniforms.tMap.value = rtA.texture; blur.uniforms.uDir.value.set(2 / w, 0); renderer.setRenderTarget(rtB); renderer.render(quadScene, quadCam);
        blur.uniforms.tMap.value = rtB.texture; blur.uniforms.uDir.value.set(0, 2 / hh); renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
      }
      renderer.toneMapping = tm;
      quad.material = comp; comp.uniforms.tScene.value = rtScene.texture; comp.uniforms.tBloom.value = rtA.texture;
      renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
    },
  };
})();

// ------------------------------------------------------------------ meshes for map things
const bodyMat = makeBodyMaterial(THREE);
const glowMat = makeGlowMaterial(THREE);
const townView = createTownView(THREE, renderer, { bodyMat, glowMat });
function townInsets() {
  const r = $('town').getBoundingClientRect();
  const side = innerWidth > innerHeight && r.width < innerWidth * 0.7;
  townView.setInsets(side ? { bottom: 0, right: innerWidth - r.left } : { bottom: Math.max(0, innerHeight - r.top), right: 0 });
}
const geoCache = new Map();
const unitGeoRaw = (id) => { const ff = FAC_MODEL[UNITS[id]?.fac]; if (ff) { const g = ff(id); if (g) return g; } const up = UNITS[id]?.up ? (necroUpModel(id) || havenUpModel(id)) : null; if (up) return up; const base = UNITS[id]?.up || id; return havenModel(base) || necroModel(base) || neutralModel(base) || unitModel(base, UNITS[id].col); };
// perf: the body material otherwise computes the smooth form normals lazily on the first draw (~5-12 ms per creature on
// desktop, several times that on a phone), i.e. inside the first battle frame; do it with the build instead
const unitGeo = (id) => { const m = unitGeoRaw(id); if (m?.body && !m.body.attributes.formNormal) { addFormNormals(m.body); m.body.userData.hxForm = true; } return m; };
// portraits are warmed by the loading screen (prewarm); the rest render on demand
let prewarmed = false;
// every model geometry is built once and shared by all its meshes (map, battle, portraits); never disposed
const cached = (k, f) => { if (!geoCache.has(k)) geoCache.set(k, f()); return geoCache.get(k); };
// keyed by faction + colour, not player index: a second new game in the same session must not reuse the old look
const heroKey = (p) => 'hero' + G.players[p].fac + ':' + G.players[p].color;
const heroGeo = (p) => cached(heroKey(p), () => { const P = G.players[p], m = heroModel(P.fac, P.color); if (m.body) { addFormNormals(m.body); m.body.userData.hxForm = true; } return m; });
// Idle-time geometry warm-up (perf): a creature that is not cached yet costs build + form normals + fits
// (~25-60 ms desktop, ~100-250 ms on a mid phone) the first time it is drawn, so an enemy army of new creatures
// used to stall battle entry. warmGeometryIdle() queues the creatures you are likely to fight next (AI heroes'
// armies, garrisons, map guards, your own faction) and builds ONE model per idle callback, only while the map is
// calm (no battle/town, no walk, no drag, no AI turn). It rescans every ~8 s, so armies the AI recruits later are
// picked up too. Not every faction's full roster: each creature is ~1 MB of geometry. Idempotent; returns the queue length.
const warmQ = [];
let warmBusy = false, warmTimer = 0;
function warmJobs() {
  const ids = [], add = (id) => { if (id && UNITS[id] && !ids.includes(id)) ids.push(id); };
  for (const hr of G.heroes) if (hr.alive && hr.p !== 0) for (const st of hr.army || []) add(st?.[0]); // armies keep null slots
  for (const t of G.towns) for (const st of t.garrison || []) add(st?.[0]);
  for (const o of G.objects) if (o.alive && o.type === 'monster') add(o.unit);
  const myFac = G.players[0]?.fac;
  for (const [id, u] of Object.entries(UNITS)) if (u.fac === myFac) add(id);
  return ids;
}
function warmGeometryIdle(ids = warmJobs()) {
  for (const id of ids) if (!warmQ.includes(id) && !warmed.has(id)) warmQ.push(id);
  G.players.forEach((P, p) => { if (!geoCache.has(heroKey(p)) && !warmQ.includes('hero:' + p)) warmQ.push('hero:' + p); });
  if (!warmBusy && warmQ.length) { warmBusy = true; idleCb(warmStep); }
  else if (!warmBusy && !warmTimer) warmTimer = setTimeout(() => { warmTimer = 0; warmGeometryIdle(); }, 8000);
  return warmQ.length;
}
const warmed = new Set();
const idleCb = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1000 }) : setTimeout(() => f({ didTimeout: true, timeRemaining: () => 0 }), 120));
function warmCalm() { return G.mode === 'map' && !walking && !ptrs.size && !aiRunning && $('loader').hidden; }
function warmStep(dl) {
  // one model per callback (a build cannot be split); wait for real idle time unless the browser says we timed out
  if (!warmQ.length) { warmBusy = false; warmGeometryIdle(); return; }
  if (!warmCalm() || (!dl.didTimeout && dl.timeRemaining() < 3)) { setTimeout(() => idleCb(warmStep), 250); return; }
  const id = warmQ.shift();
  try {
    if (id.startsWith('hero:')) { if (G.players[+id.slice(5)]) heroGeo(+id.slice(5)); }
    else { const g = cached('u' + id, () => unitGeo(id)); unitFit(id, g, 'battle'); unitFit(id, g, 'map'); }
  } catch (e) { console.warn('warm', id, e); }
  warmed.add(id); // tried: a model that throws is not retried every rescan
  if (warmQ.length) idleCb(warmStep); else { warmBusy = false; warmGeometryIdle(); }
}
initPortraits(THREE, renderer, (id) => cached('u' + id, () => unitGeo(id)), { dispose: false });
const heroPic = (hr, size, shape = 'square') => { const P = G.players[hr.p]; return heroPortraitImg(P.fac, P.color, size, 'pt', shape); };
// interactive things (towns, heroes, objects, creatures) get a painted ink outline so they read as figures on the ground
setRigIdle(0.6); // map figures idle gently (battle units set their own amplitude)
const inkMat = makeInkHullMaterial(THREE), blobMat = makeBlobShadowMaterial(THREE), blobGeo = blobShadowGeometry(THREE);
function meshOf(m, ink = true) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(m.body, bodyMat); b.castShadow = true; b.receiveShadow = true; g.add(b);
  if (m.glow) g.add(new THREE.Mesh(m.glow, glowMat));
  if (ink) g.add(new THREE.Mesh(m.body, inkMat));
  return g;
}
// soft contact shadow so a figure sits on the ground (radius in model units)
function addBlob(g, r) { const bl = new THREE.Mesh(blobGeo, blobMat); bl.scale.setScalar(r); bl.userData.blob = true; bl.renderOrder = -1; g.add(bl); return g; }
const BLOB_R = { gold: 0.62, wood: 0.62, ore: 0.62, gems: 0.62, chest: 0.64, artifact: 0.55, campfire: 0.6, stone: 0.55, monster: 0.7 };
const UP = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion();
// stands a group on a cell, local +y along the planet normal
// figures grow a little as the camera pulls back, so they stay readable on a phone (like map icons)
let figK = 1;
function placeOn(obj, v, scale, turn = 0, lift = 0) {
  obj.userData.s0 = scale;
  qa.setFromUnitVectors(UP, DIRS[v]);
  obj.quaternion.copy(qa);
  obj.rotateY(YAW[v] + turn);
  obj.position.copy(DIRS[v]).multiplyScalar(radiusOf(v) + lift);
  obj.scale.setScalar(scale * figK);
}
const world = new THREE.Group(); scene.add(world);
const flora = new THREE.Group(); scene.add(flora);
// forests, mountains and rocks: instanced per model
const pickW = (list, r) => { const tot = list.reduce((x, e) => x + e.w, 0); let k = r * tot; for (const e of list) { k -= e.w; if (k <= 0) return e.key; } return list[0].key; };
const dummy = new THREE.Object3D();
function layoutFlora() {
  // free the old instance-matrix GPU buffers (the shared nature geometries stay cached in nature.js)
  for (const im of flora.children) im.dispose?.();
  flora.clear();
  const lists = new Map();
  const put = (key, v, s, x = 0, z = 0, turn = 0) => {
    if (!lists.has(key)) lists.set(key, { model: natureModel(key), m: [] });
    const t1 = new THREE.Vector3().crossVectors(DIRS[v], Math.abs(DIRS[v].y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)).normalize(), t2 = DIRS[v].clone().cross(t1);
    const p = DIRS[v].clone().multiplyScalar(radiusOf(v)).addScaledVector(t1, x).addScaledVector(t2, z);
    dummy.position.copy(p); dummy.quaternion.setFromUnitVectors(UP, DIRS[v]); dummy.rotateY(turn); dummy.scale.setScalar(s); dummy.updateMatrix();
    lists.get(key).m.push(dummy.matrix.clone());
  };
  for (let v = 0; v < NV; v++) {
    if (!seen[v]) continue;
    const hv = hash(v * 11), rr = (k) => (hash(v * 31 + k * 7) % 1000) / 1000;
    const F = FLORA_FOR_TERRAIN[ter[v]];
    if (ter[v] === T.FOREST || ter[v] === T.MOUNT) {
      const biome = biomeOf(NBR[v].map((n) => ter[n]), Math.abs(DIRS[v].y));
      if (ter[v] === T.FOREST) {
        const n = F.count[0] + (hv % (F.count[1] - F.count[0] + 1));
        for (let i = 0; i < n; i++) { const a = i * 2.1 + hv, d = i ? 0.1 + rr(i) * 0.03 : 0; put(pickW(FOREST_BY_BIOME[biome] || FOREST_BY_BIOME.temperate, rr(i + 9)), v, F.fillScale * (0.85 + rr(i + 3) * 0.3), Math.cos(a) * d, Math.sin(a) * d, a); }
      } else { const keys = PEAK_BY_BIOME[biome] || PEAK_BY_BIOME.temperate; put(keys[hv % keys.length], v, F.fillScale * (0.95 + rr(2) * 0.2), 0, 0, hv); }
      continue;
    }
    if (objAt[v] >= 0 || road[v] || !F || !F.scatter) continue;
    let placed = 0;
    F.scatter.forEach((e, i) => { if (placed >= 2 || rr(i + 20) > e.p) return; if ((e.avoid && NBR[v].some((n) => e.avoid.includes(ter[n]))) || (e.maxLat && Math.abs(DIRS[v].y) > e.maxLat)) return; const a = rr(i + 30) * 6.28, d = 0.05 + rr(i + 40) * 0.07; put(e.key, v, e.s, Math.cos(a) * d, Math.sin(a) * d, a * 3); placed++; });
  }
  for (const { model, m } of lists.values()) {
    const im = new THREE.InstancedMesh(model.body, bodyMat, m.length);
    m.forEach((x, i) => im.setMatrixAt(i, x));
    im.castShadow = true; im.receiveShadow = true;
    flora.add(im);
    if (model.glow) { const ig = new THREE.InstancedMesh(model.glow, glowMat, m.length); m.forEach((x, i) => ig.setMatrixAt(i, x)); flora.add(ig); }
  }
}

// ------------------------------------------------------------------ building the world
function nearestFree(v, ok) { for (const [x] of bfs(v, 12)) if (ok(x)) return x; return -1; }
function connected(a, b) {
  const seenS = new Uint8Array(NV), q = [a]; seenS[a] = 1;
  for (let i = 0; i < q.length; i++) { const x = q[i]; if (x === b) return true; for (const n of NBR[x]) if (!seenS[n] && passable(n)) { seenS[n] = 1; q.push(n); } }
  return false;
}
// carve a walkable track from a to b over anything in the way
function carve(a, b) {
  let x = a;
  for (let i = 0; i < 400 && x !== b; i++) {
    x = NBR[x].reduce((p, n) => (DIRS[n].distanceTo(DIRS[b]) < DIRS[p].distanceTo(DIRS[b]) ? n : p));
    if (!passable(x)) { ter[x] = T.DIRT; h[x] = SEA + 1; }
  }
}
function makeRoad(a, b) {
  const p = findPath(a, b, null, true);
  if (p) for (const x of p) road[x] = 1;
  road[a] = road[b] = 1;
}
function spot(near, minD, maxD, ok = () => true) {
  const c = bfs(near, maxD).filter(([x, d]) => d >= minD && passable(x) && objAt[x] < 0 && !road[x] && NBR[x].every((n) => objAt[n] < 0) && ok(x)).map(([x]) => x);
  return c.length ? c[(rnd() * c.length) | 0] : -1;
}
function addObject(type, v, extra = {}) {
  const o = { id: G.objects.length, type, v, alive: true, owner: -1, ...extra };
  G.objects.push(o); objAt[v] = o.id;
  return o;
}
// a neutral guard: bigger and meaner the further from any capital
function guardFor(v, strength) {
  const tier = clamp(Math.round(strength * 6 + rnd() * 1.5), 0, 6), id = NEUTRALS[tier], u = UNITS[id];
  const n = Math.max(2, Math.round((strength * 2600 + 250) / (u.hp * (u.dmg[0] + u.dmg[1]) / 2 + 20) * (0.7 + rnd() * 0.6) * [0.75, 1, 1.3][G.diff]));
  return { id, n };
}
const TOWN_NAMES = { haven: ['Highcastle', 'Brightwater', 'Stormhold', 'Valemere'], necro: ['Gravenreach', 'Duskmoor', 'Ashfall', 'Wraithgate'],
  sylvan: ['Elderglade', 'Mossvale', 'Silverleaf', 'Thornwood'], inferno: ['Ashenspire', 'Brimstone', 'Cinderhold', 'Pyrewatch'], dungeon: ['Deepvault', 'Shadowmere', 'Gloomhollow', 'Crystalreach'] };
function newTown(v, p, fac, name) {
  return { id: G.towns.length, v, p, fac, name, built: ['d1'], avail: { 1: UNITS[FACTIONS[fac].units[0]].grow }, garrison: [], builtToday: false, spells: [] };
}
function newWorld(seed, diff = 1, myFac = 'haven') {
  Object.assign(G, { seed, day: 1, players: [], heroes: [], towns: [], objects: [], diff, selHero: -1, over: false, mode: 'map', log: [] });
  objAt.fill(-1); road.fill(0); seen.fill(0);
  rnd = mulberry32(seed);
  let a = -1, b = -1;
  for (let tries = 0; tries < 60 && b < 0; tries++) {
    generate(seed + tries * 101);
    const ok = (v) => passable(v) && ter[v] !== T.SNOW && ter[v] !== T.SWAMP && Math.abs(DIRS[v].y) < 0.6 && bfs(v, 2).filter(([x]) => passable(x)).length >= 16;
    const cands = []; for (let v = 0; v < NV; v += 3) if (ok(v)) cands.push(v);
    if (cands.length < 40) continue;
    const ca = cands[(rnd() * cands.length) | 0];
    const cb = cands.reduce((p, x) => (DIRS[x].dot(DIRS[ca]) < DIRS[p].dot(DIRS[ca]) ? x : p));
    if (DIRS[cb].dot(DIRS[ca]) > -0.55) continue;
    a = ca; b = cb;
  }
  // flat grass around each capital
  const settle = (c) => { for (const [x] of bfs(c, 2)) { if (ter[x] === T.WATER || ter[x] === T.MOUNT || ter[x] === T.FOREST) ter[x] = T.GRASS; h[x] = h[c]; } };
  settle(a); settle(b);
  if (!connected(a, b)) carve(a, b);
  // the rival is a different faction; the two neutral towns use the remaining ones
  const others = Object.keys(FACTIONS).filter((f) => f !== myFac).sort(() => rnd() - 0.5);
  G.players = [newPlayer(0, myFac, false), newPlayer(1, others[0], true)];
  const capital = (v, p) => { const t = newTown(v, p, G.players[p].fac, TOWN_NAMES[G.players[p].fac][0]); t.garrison = [[FACTIONS[G.players[p].fac].units[0], 12], [FACTIONS[G.players[p].fac].units[1], 5]]; G.towns.push(t); addObject('town', v, { t: t.id }); return t; };
  capital(a, 0); capital(b, 1);
  // neutral towns half way round the world, each with a strong garrison
  const mids = [];
  for (let v = 0; v < NV; v += 7) {
    if (!passable(v) || Math.abs(DIRS[v].dot(DIRS[a]) - DIRS[v].dot(DIRS[b])) > 0.25 || Math.abs(DIRS[v].y) > 0.7) continue;
    if (mids.some((m) => DIRS[m].dot(DIRS[v]) > 0.2) || bfs(v, 1).filter(([x]) => passable(x)).length < 6) continue;
    mids.push(v); if (mids.length >= 2) break;
  }
  mids.forEach((v, i) => {
    settle(v);
    if (!connected(a, v)) carve(a, v);
    const fac = others[1 + (i % (others.length - 1))];
    const t = newTown(v, -1, fac, TOWN_NAMES[fac][1 + i]);
    const us = FACTIONS[fac].units;
    t.garrison = [[us[0], 30 + G.diff * 10], [us[1], 14], [us[2], 7], [us[3], 3]];
    t.built.push('d2', 'd3');
    G.towns.push(t); addObject('town', v, { t: t.id });
  });
  // heroes beside their capitals
  for (const t of G.towns.filter((x) => x.p >= 0)) {
    const v = NBR[t.v].find((x) => passable(x)) ?? t.v;
    const P = G.players[t.p];
    const hr = newHero(t.p, v, FACTIONS[P.fac].heroes[0]);
    hr.army = START_ARMY[P.fac].map((x) => [...x]);
    const kit = FACTION_START[P.fac] || FACTION_START.haven;
    hr.spells = [kit.spell]; hr.skills[kit.skill] = 1;
    if (t.p === 1) { hr.att += 1; for (const s of hr.army) s[1] = Math.round(s[1] * [0.7, 1, 1.35][G.diff]); }
    hr.mp = moveMax(hr); hr.mana = maxMana(hr);
    G.heroes.push(hr);
  }
  // roads between the capitals and the neutral towns
  for (const m of mids) { makeRoad(a, m); makeRoad(b, m); }
  if (!mids.length) makeRoad(a, b);
  // treasure around each capital: free mines and piles close by, guarded riches further out
  for (const c of [a, b]) {
    for (const type of ['sawmill', 'orepit']) { const v = spot(c, 3, 6); if (v >= 0) addObject(type, v); }
    for (let i = 0; i < 6; i++) { const v = spot(c, 2, 7); if (v >= 0) addObject(['gold', 'wood', 'ore', 'gold', 'chest', 'campfire'][i], v, { amount: 0 }); }
    for (const type of ['goldmine', 'gemmine', 'dwelling', 'arena', 'shrine', 'well', 'windmill', 'library']) {
      const v = spot(c, 7, 13);
      if (v < 0) continue;
      const o = addObject(type, v);
      if (type === 'dwelling') o.unit = NEUTRALS[1 + ((rnd() * 4) | 0)], o.stock = 6;
      if (type === 'shrine') o.spell = ['arrow', 'stoneskin', 'cure', 'haste', 'slow'][(rnd() * 5) | 0];
      guard(v, 0.25 + rnd() * 0.25);
    }
  }
  // the wilds: scattered objects everywhere, guarded harder the farther from home
  const far = (v) => Math.min(...[a, b].map((c) => (1 - DIRS[v].dot(DIRS[c])) / 2));
  const kinds = ['gold', 'wood', 'ore', 'gems', 'chest', 'chest', 'artifact', 'artifact', 'artifact', 'tower', 'stone', 'stables', 'obelisk', 'goldmine', 'gemmine', 'sawmill', 'orepit', 'dwelling', 'shrine', 'well', 'campfire', 'library', 'arena'];
  for (let i = 0, n = 0; i < 900 && n < 120; i++) {
    const v = (rnd() * NV) | 0;
    if (!passable(v) || objAt[v] >= 0 || road[v] || NBR[v].some((x) => objAt[x] >= 0) || far(v) < 0.03) continue;
    const type = kinds[(rnd() * kinds.length) | 0];
    const o = addObject(type, v);
    if (type === 'dwelling') o.unit = NEUTRALS[(rnd() * 5) | 0], o.stock = 5;
    if (type === 'shrine') o.spell = Object.keys(SPELLS)[(rnd() * 8) | 0];
    if (type === 'artifact') o.art = ARTIFACTS[(rnd() * ARTIFACTS.length) | 0].id;
    const valuable = ['artifact', 'goldmine', 'gemmine', 'dwelling', 'tower', 'stone', 'shrine', 'library', 'arena', 'chest'].includes(type);
    if (valuable || rnd() < 0.3) guard(v, clamp(far(v) * 1.6 + rnd() * 0.25 - 0.1, 0.05, 1));
    n++;
  }
  // wandering monsters on the roads
  for (let i = 0; i < 14; i++) { const v = (rnd() * NV) | 0; if (passable(v) && objAt[v] < 0 && far(v) > 0.15 && NBR[v].every((x) => objAt[x] < 0)) { const g = guardFor(v, far(v) * 1.3); addObject('monster', v, { unit: g.id, n: g.n }); } }
  for (const o of G.objects) if (['gold', 'wood', 'ore', 'gems'].includes(o.type)) o.amount = o.type === 'gold' ? 500 + ((rnd() * 6) | 0) * 100 : 3 + ((rnd() * 5) | 0);
  G.selHero = 0;
  revealAll();
}
function guard(v, strength) {
  const n = NBR[v].filter((x) => passable(x) && objAt[x] < 0);
  if (!n.length) return;
  const g = guardFor(v, strength), at = n[(rnd() * n.length) | 0];
  addObject('monster', at, { unit: g.id, n: g.n, guards: v });
}

// ------------------------------------------------------------------ fog of war
const visionOf = (hr) => 5 + 2 * (hr.skills.scouting || 0);
function reveal(v, r) { let ch = false; for (const [x] of bfs(v, r)) if (!seen[x]) { seen[x] = 1; ch = true; } return ch; }
function revealAll() {
  let ch = false;
  for (const hr of G.heroes) if (hr.alive && hr.p === 0) ch = reveal(hr.v, visionOf(hr)) || ch;
  for (const t of G.towns) if (t.p === 0) ch = reveal(t.v, 6) || ch;
  for (const o of G.objects) if (o.alive && o.owner === 0) ch = reveal(o.v, 2) || ch;
  if (ch) worldDirty = true;
}
let worldDirty = true;

// ------------------------------------------------------------------ path finding: A* over the walkable cells
const stepCost = (from, to) => (road[from] && road[to] ? 50 : TER_COST[ter[to]] || 100);
const heroAt = (v) => G.heroes.find((x) => x.alive && x.v === v);
const zoc = (v) => NBR[v].some((n) => { const o = objAt[n] >= 0 ? G.objects[objAt[n]] : null; return o && o.alive && o.type === 'monster'; });
function findPath(from, to, hr, ignore = false) {
  if (from === to) return [from];
  const came = new Map(), g = new Map([[from, 0]]);
  const heur = (v) => DIRS[v].distanceTo(DIRS[to]) * 600;
  const fScore = new Map([[from, heur(from)]]), open = minHeap();
  open.push(fScore.get(from), from);
  let guardSteps = 0;
  while (open.size && guardSteps < 6000) {
    let cur = open.pop();
    if (open.d !== fScore.get(cur)) continue; // a stale entry: this cell was re-queued with a better cost
    guardSteps++;
    if (cur === to) { const p = [cur]; while (came.has(cur)) { cur = came.get(cur); p.unshift(cur); } return p; }
    for (const n of NBR[cur]) {
      if (!passable(n)) continue;
      if (!ignore && n !== to) {
        if (objAt[n] >= 0 && G.objects[objAt[n]].alive) continue;
        const hh = heroAt(n); if (hh && hh !== hr) continue;
      }
      // walking past a monster wakes it: avoid it unless there is no other way
      const ng = g.get(cur) + stepCost(cur, n) + (!ignore && n !== to && zoc(n) && hr ? 4000 : 0);
      if (ng < (g.get(n) ?? Infinity)) { came.set(n, cur); g.set(n, ng); fScore.set(n, ng + heur(n)); open.push(ng + heur(n), n); }
    }
  }
  return null;
}
// how far a hero gets along a path today
function stepsToday(hr, path) {
  let mp = hr.mp, n = 0;
  for (let i = 1; i < path.length; i++) { const c = stepCost(path[i - 1], path[i]); if (mp < c) break; mp -= c; n = i; }
  return n;
}

// ------------------------------------------------------------------ drawing the things on the map
function flagMesh(col) { return meshOf(cached('flag' + col, () => flagModel(col))); }
const ownerCol = (p) => (p >= 0 ? G.players[p].color : 0x9a9aa2);
function objModel(o) {
  if (o.type === 'town') return cached('town' + G.towns[o.t].fac, () => townModel(G.towns[o.t].fac));
  if (o.type === 'monster') return cached('u' + o.unit, () => unitGeo(o.unit));
  return cached('o' + o.type, () => objectModel(o.type));
}
const SCALE = { gold: 0.3, wood: 0.3, ore: 0.3, gems: 0.3, chest: 0.28, artifact: 0.28, town: 0.4, monster: 0.2, goldmine: 0.3, gemmine: 0.3, orepit: 0.3, sawmill: 0.28, dwelling: 0.3, arena: 0.28, tower: 0.24, library: 0.27, stone: 0.24, obelisk: 0.24, shrine: 0.27, well: 0.27, windmill: 0.27, stables: 0.27 };
// the terrain mesh and the flora only depend on the land and the fog: rebuild them only when those changed
// (an enemy picking up gold or flagging a mine used to re-tessellate the whole planet in the middle of the AI turn)
const landSnap = { ter: new Uint8Array(NV), h: new Int8Array(NV), road: new Uint8Array(NV), seen: new Uint8Array(NV), ok: false };
function landChanged() {
  const S = landSnap;
  let same = S.ok;
  for (let v = 0; same && v < NV; v++) if (S.seen[v] !== seen[v] || S.ter[v] !== ter[v] || S.road[v] !== road[v] || S.h[v] !== h[v]) same = false;
  if (same) return false;
  S.ter.set(ter); S.h.set(h); S.road.set(road); S.seen.set(seen); S.ok = true;
  return true;
}
function layoutWorld() {
  worldDirty = false;
  if (landChanged()) { rebuildPlanet(); layoutFlora(); }
  world.clear();
  for (const o of G.objects) {
    if (!o.alive || !seen[o.v]) continue;
    const g = meshOf(objModel(o));
    placeOn(g, o.v, SCALE[o.type] || 0.24, o.type === 'monster' ? (hash(o.id) % 6) : 0);
    if (o.type === 'monster') { applyFit(g, unitFit(o.unit, objModel(o), 'map')); g.userData.s0 = g.scale.x; g.scale.multiplyScalar(figK); }
    if (o.type === 'town') { g.userData.noGrow = true; g.scale.setScalar(g.userData.s0); }
    addBlob(g, o.type === 'monster' ? BLOB_R.monster / (g.scale.x / (SCALE.monster || 0.2)) : BLOB_R[o.type] || 0.66);
    world.add(g);
    const owner = o.type === 'town' ? G.towns[o.t].p : OBJECTS[o.type]?.kind === 'mine' ? o.owner : -2;
    if (owner > -2) { const f = flagMesh(ownerCol(owner)); g.add(f); f.position.set(0.55, 0, 0.45); f.scale.setScalar(o.type === 'town' ? 0.6 : 0.8); }
  }
  layoutHeroes(true);
}
// heroes are persistent so they can walk smoothly
const heroMeshes = new Map();
function layoutHeroes(force = false) {
  for (const hr of G.heroes) {
    let m = heroMeshes.get(hr.id);
    if (!hr.alive || (!seen[hr.v] && hr.p !== 0)) { if (m) { scene.remove(m); heroMeshes.delete(hr.id); } continue; }
    let fresh = false;
    if (!m) {
      m = addBlob(meshOf(heroGeo(hr.p)), 0.5);
      scene.add(m); heroMeshes.set(hr.id, m); fresh = true;
    }
    // a hero in motion is posed by updateWalk / frame(); re-laying it out mid-step (worldDirty → layoutWorld) would pop it
    if (fresh || !(hr.anim || (walking && walking.hr === hr))) standHero(m, hr);
  }
  for (const [id, m] of heroMeshes) if (!G.heroes[id] || !G.heroes[id].alive) { scene.remove(m); heroMeshes.delete(id); }
}
// a standing hero sits on its hex centre but keeps the heading it last walked with (no snap back to the hex's yaw)
const _m4 = new THREE.Matrix4(), _o3 = new THREE.Vector3(), _fw = new THREE.Vector3();
function faceQuat(q, up, fwd) {
  _fw.copy(fwd).projectOnPlane(up); if (_fw.lengthSq() < 1e-10) return q;
  return q.setFromRotationMatrix(_m4.lookAt(_o3, _fw.normalize().negate(), up));
}
function standHero(m, hr) {
  placeOn(m, hr.v, 0.27, hr.face || 0);
  if (m.userData.fwd) faceQuat(m.quaternion, DIRS[hr.v], m.userData.fwd);
}
// pose a hero part-way along a step a→b: kk is the fraction travelled (may go out and back for a bump)
const _qT = new THREE.Quaternion(), _ZF = new THREE.Vector3(0, 0, 1), _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _up = new THREE.Vector3(), _dv = new THREE.Vector3();
function poseStep(m, a, b, kk, dt) {
  _pa.copy(DIRS[a]).multiplyScalar(radiusOf(a)); _pb.copy(DIRS[b]).multiplyScalar(radiusOf(b));
  _dv.copy(DIRS[a]).lerp(DIRS[b], kk).normalize().multiplyScalar(Math.sin(Math.min(1, Math.abs(kk)) * Math.PI) * 0.015); // a little hop
  m.position.copy(_pa).lerp(_pb, kk).add(_dv);
  // turn toward the way we go over ~0.15 s instead of snapping at every hex
  faceQuat(_qT, _up.copy(m.position).normalize(), _dv.copy(_pb).sub(_pa));
  m.quaternion.slerp(_qT, 1 - Math.exp(-dt * 20));
  (m.userData.fwd ||= new THREE.Vector3()).copy(_ZF).applyQuaternion(m.quaternion);
}
// cubic easing over one step: starts at speed s0, ends at speed s1 (1 = the steady walking pace)
const stepEase = (k, s0, s1) => ((s0 + s1 - 2) * k + (3 - 2 * s0 - s1)) * k * k + s0 * k;
// bumping into something: out toward it and back to the start; v0 = entry speed in step-fractions per bump duration
const bumpEase = (k, v0) => { const u = 1 - k; return v0 * k * u * u + 16 * Math.max(0, 0.38 - v0 * 4 / 27) * k * k * u * u; };
// path preview: green dots for today, red for later days, a banner on the goal
const fx = createMapFx(THREE, scene, { DIRS, radiusOf, posOf });
let plan = null;
function showPath(hr, path) {
  plan = path ? { hr: hr.id, path } : null;
  if (!path) { fx.clearPath(); return; }
  fx.showPath(path, stepsToday(hr, path));
}

// ------------------------------------------------------------------ input: drag turns the planet, pinch zooms, tap selects and moves
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickCell(cx, cy) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(planet, false)[0];
  return hit ? triCell[hit.faceIndex] : null;
}
const ptrs = new Map();
let press = null, pinch = null;
const cvs = renderer.domElement;
// taps fire on pointerup (no click, no 300 ms wait: touch-action is none); a press becomes a drag past TAP_SLOP px.
// Map drags only feed cam.dragTheta/dragPhi (applied once per frame); the last ~100 ms of samples give the fling speed.
const TAP_SLOP = 8, TAP_MS = 500, FLING_WIN = 100, FLING_STALE = 60;
const camMode = () => G.mode !== 'battle' && G.mode !== 'town';
const dragK = () => cam.dist / 1800; // radians per CSS px: the ground under the finger moves with it at any zoom
function startPress(e, x, y, moved) {
  press = { id: e.pointerId, x, y, lx: x, ly: y, t: performance.now(), moved, noTap: moved, samples: [] };
}
function camDrag(dx, dy, ts) {
  const k = dragK(), dth = -dx * k, dph = -dy * k;
  cam.dragTheta += dth; cam.dragPhi += dph; cam.dragging = true;
  if (press) { press.samples.push([ts, dth, dph]); while (press.samples.length > 2 && ts - press.samples[0][0] > FLING_WIN) press.samples.shift(); }
}
function camRelease(ts) {
  // fling only if the finger was still moving when it lifted; speed is averaged over the last ~100 ms
  cam.dragging = false;
  const S = press?.samples || [];
  if (!S.length || ts - S[S.length - 1][0] > FLING_STALE) return;
  const t0 = S[0][0], span = Math.max(16, ts - t0) / 1000;
  let a = 0, b = 0; for (const [, x, y] of S) { a += x; b += y; }
  cam.vTheta = clamp(a / span, -FLING_MAX, FLING_MAX); cam.vPhi = clamp(b / span, -FLING_MAX, FLING_MAX);
}
cvs.addEventListener('pointerdown', (e) => {
  try { cvs.setPointerCapture(e.pointerId); } catch {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size > 2) return;
  if (ptrs.size === 2) {
    const [p, q] = [...ptrs.values()];
    pinch = { d: Math.max(1, Math.hypot(p.x - q.x, p.y - q.y)), dist: G.mode === 'battle' ? bview.dist : cam.tDist, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 };
    press = null; if (camMode()) camGrab(); return;
  }
  // touching a gliding map just stops it: that touch is a grab, not a tap (a flight only stops once the finger drags)
  const gliding = Math.abs(cam.vTheta) + Math.abs(cam.vPhi) > 0.25;
  if (gliding && camMode()) camGrab();
  startPress(e, e.clientX, e.clientY, false);
  if (gliding) press.noTap = true;
}, { passive: true });
cvs.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    if (G.mode === 'town') return;
    if (G.mode === 'battle') bview.dist = clamp(pinch.dist * pinch.d / d, 9, 18);
    else {
      cam.tDist = clamp(pinch.dist * pinch.d / d, 6.4, 22);
      // two fingers also pan: the planet follows their midpoint
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      camDrag(mx - pinch.mx, my - pinch.my, e.timeStamp); pinch.mx = mx; pinch.my = my;
    }
    return;
  }
  if (!press || press.id !== e.pointerId) return;
  const dx = e.clientX - press.lx, dy = e.clientY - press.ly;
  press.lx = e.clientX; press.ly = e.clientY;
  if (!press.moved) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) <= TAP_SLOP) return;
    // the press turns into a drag: take over from any flight/follow where the camera is now; the slop itself is not
    // replayed (that would be an 8 px lurch), the planet starts moving with the finger from here
    press.moved = true;
    if (camMode()) camGrab();
    return;
  }
  if (G.mode === 'battle') { bview.yaw = clamp(bview.yaw - dx * 0.004, -0.6, 0.6); return; }
  if (G.mode === 'town') return;
  camDrag(dx, dy, e.timeStamp);
}, { passive: true });
const endPtr = (e) => {
  ptrs.delete(e.pointerId);
  if (pinch && ptrs.size < 2) {
    // lifting one finger of a pinch: the other carries on dragging from where it is (never a tap)
    pinch = null; cam.dragging = false;
    const [id, q] = [...ptrs.entries()][0] || [];
    if (q) startPress({ pointerId: id }, q.x, q.y, true);
    return;
  }
  if (!press || press.id !== e.pointerId) return;
  if (press.moved) { if (camMode()) camRelease(e.timeStamp); }
  else if (!press.noTap && performance.now() - press.t < TAP_MS) { if (G.mode === 'battle') battleTap(e.clientX, e.clientY); else if (G.mode === 'map') mapTap(e.clientX, e.clientY); else if (G.mode === 'town') townTap(e.clientX, e.clientY); }
  press = null; cam.dragging = false;
};
const dropPtrs = () => { ptrs.clear(); press = null; pinch = null; cam.dragging = false; cam.dragTheta = cam.dragPhi = 0; cam.vTheta = cam.vPhi = 0; };
cvs.addEventListener('pointerup', endPtr, { passive: true });
cvs.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); if (!ptrs.size) dropPtrs(); else { press = null; pinch = null; cam.dragging = false; } }, { passive: true });
// a tab switch or app swap mid-gesture never leaves a stuck finger or a fling that resumes later
document.addEventListener('visibilitychange', () => { if (document.hidden) dropPtrs(); });
window.addEventListener('blur', dropPtrs);
cvs.addEventListener('wheel', (e) => {
  e.preventDefault(); if (G.mode === 'town') return;
  if (G.mode === 'battle') bview.dist = clamp(bview.dist * (e.deltaY > 0 ? 1.08 : 0.92), 8, 16);
  else {
    // proportional to the scroll amount, so trackpads (many tiny deltas) zoom as smoothly as a mouse notch
    const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    cam.tDist = clamp(cam.tDist * Math.exp(clamp(dy, -150, 150) * 0.0011), 6.4, 22);
  }
}, { passive: false });

const selHero = () => (G.selHero >= 0 && G.heroes[G.selHero]?.alive && G.heroes[G.selHero].p === 0 ? G.heroes[G.selHero] : null);
function mapTap(cx, cy) {
  if (busy()) return;
  const v = pickCell(cx, cy);
  if (v === null) return;
  const hr = selHero();
  const mine = heroAt(v);
  if (mine && mine.p === 0) { selectHero(mine.id); return; }
  if (!seen[v]) { toast('Unexplored land.'); return; }
  const o = objAt[v] >= 0 && G.objects[objAt[v]].alive ? G.objects[objAt[v]] : null;
  if (o && o.type === 'town' && G.towns[o.t].p === 0 && hr && (!plan || plan.path[plan.path.length - 1] !== v) && DIRS[hr.v].distanceTo(DIRS[v]) > 0.25) { openTown(o.t); return; }
  if (!hr) { if (o) describe(o); return; }
  // second tap on the same goal: go
  if (plan && plan.hr === hr.id && plan.path[plan.path.length - 1] === v) { startWalk(hr, plan.path); return; }
  if (!passable(v) && !o) { toast(`${TER_NAME[ter[v]]}: impassable.`); showPath(hr, null); return; }
  const path = findPath(hr.v, v, hr);
  if (!path) { toast('No way there.'); showPath(hr, null); return; }
  if (hr.route && hr.route[hr.route.length - 1] !== v) { hr.route = null; hr.routeObj = -1; updateHud(); } // a new goal replaces yesterday's march
  showPath(hr, path);
  if (o) describe(o); else { const other = heroAt(v); if (other) toast(`${other.name} (${G.players[other.p].name}) · ${armyWord(heroArmy(other))}`); }
  sfx.click();
}
const SIZE_WORDS = [[5, 'A few'], [10, 'Several'], [20, 'A pack of'], [50, 'Lots of'], [100, 'A horde of'], [250, 'A throng of'], [1e9, 'A legion of']];
const sizeWord = (n) => SIZE_WORDS.find(([m]) => n < m)[1];
function armyWord(army) { const p = BT.armyPower(army); return p < 600 ? 'weak' : p < 2000 ? 'modest' : p < 6000 ? 'strong' : p < 15000 ? 'mighty' : 'overwhelming'; }
function threatWord(o) {
  const hr = selHero(); if (!hr) return '';
  const r = BT.armyPower([[o.unit, o.n]]) / Math.max(1, BT.armyPower(heroArmy(hr), hr));
  return r < 0.3 ? '😴 Effortless' : r < 0.6 ? '🙂 Easy' : r < 1 ? '😐 Fair fight' : r < 1.6 ? '😬 Hard' : '💀 Deadly';
}
function describe(o) {
  if (o.type === 'monster') toast(`${sizeWord(o.n)} ${plural(o.unit)} · ${threatWord(o)}`);
  else if (o.type === 'town') { const t = G.towns[o.t]; toast(`${t.name} (${FACTIONS[t.fac].name}) · ${t.p === 0 ? 'yours' : t.p > 0 ? G.players[t.p].name : 'neutral'}${t.p !== 0 && heroArmy({ army: t.garrison }).length ? ' · guarded' : ''}`); }
  else { const O = OBJECTS[o.type]; toast(`${O.icon} ${O.name}${o.type === 'artifact' ? `: ${ARTIFACTS.find((a) => a.id === o.art).name}` : ''}${O.kind === 'mine' ? ` · ${o.owner === 0 ? 'yours' : o.owner > 0 ? 'enemy' : 'unclaimed'} (+${O.amount} ${RES_ICON[O.res]}/day)` : O.desc ? ` · ${O.desc}` : ''}${o.type === 'shrine' ? `: ${SPELLS[o.spell].name}` : ''}`); }
}
function selectHero(id) {
  G.selHero = id; const hr = G.heroes[id];
  flyTo(hr.v, Math.min(cam.tDist, 10));
  // a route left over from yesterday is shown again: tap its goal (or Continue ▶) to carry on
  showPath(hr, pendingRoute(hr));
  updateHud(); sfx.click();
}
// HoMM-style unfinished march: hr.route = the rest of the path (saved with the hero), hr.routeObj = the object it was
// heading for (-1: a bare hex). Re-checked whenever it is shown or resumed: re-routed if blocked, dropped if the goal is gone.
function pendingRoute(hr, quiet = true) {
  if (!hr || !hr.route || hr.route.length < 2) return null;
  const goal = hr.route[hr.route.length - 1];
  const o = hr.routeObj >= 0 ? G.objects[hr.routeObj] : null;
  const gone = hr.routeObj >= 0 && (!o || !o.alive || o.v !== goal || (OBJECTS[o.type]?.kind === 'mine' && o.owner === hr.p));
  const path = gone ? null : findPath(hr.v, goal, hr);
  if (!path || path.length < 2) { hr.route = null; hr.routeObj = -1; if (!quiet) toast(gone ? 'The goal of that march is gone.' : 'The way there is blocked now.'); updateHud(); return null; }
  hr.route = path; return path;
}
function resumeRoute(hr) {
  if (busy() || !hr) return;
  const path = pendingRoute(hr, false); if (!path) { showPath(hr, null); return; }
  if (DIRS[hr.v].distanceTo(lookDir()) > 0.25) flyTo(hr.v, cam.tDist);
  startWalk(hr, path);
}

// ------------------------------------------------------------------ walking
let walking = null;
const busy = () => !!walking || G.mode !== 'map' || aiRunning;
function startWalk(hr, path) {
  hr.route = null;
  const n = stepsToday(hr, path);
  if (n < 1) { toast('Not enough movement left today. End the turn.'); sfx.deny(); return; }
  walking = { hr, path, i: 0, t: 0, n };
  showPath(hr, null);
}
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function updateWalk(dt) {
  if (!walking) return;
  const W = walking, hr = W.hr, m = heroMeshes.get(hr.id);
  const a = W.path[W.i], b = W.path[W.i + 1];
  // the last step into something: a pickup (unguarded) is walked onto and taken as the hero arrives on its hex;
  // anything else (monster, mine, town, site, another hero) gets a lunge toward it and back to where the hero stands
  const target = W.i + 1 === W.path.length - 1 && blockingAt(b, hr), onto = target && walksOnto(b, hr), bump = target && !onto;
  const start = W.i === 0, stop = onto || W.i + 1 >= W.n || !!lurkerAt(b, W);
  // first/last steps take a little longer and ease in/out, so the hero never starts or stops dead
  const f = 1 + (start ? 0.3 : 0) + (stop ? 0.3 : 0);
  W.t += bump ? dt / BUMP_T : dt * 6 / f;
  if (m) {
    const k = Math.min(1, W.t);
    const kk = bump ? bumpEase(k, start ? 0 : 6 * BUMP_T) : stepEase(k, start ? 0 : f, stop ? 0 : f);
    poseStep(m, a, b, kk, dt);
  }
  if (W.t < 1) return;
  W.t = bump || stop ? 0 : W.t - 1;
  // arrive at b (or back at a after a bump)
  if (target) { walking = null; layoutHeroes(true); interact(hr, b); return; }
  hr.mp -= stepCost(a, b); hr.v = b; W.i++;
  if (reveal(b, visionOf(hr))) worldDirty = true;
  sfx.step({ kind: 'hoof' });
  if (seen[b]) fx.burst('step', posOf(b));
  // a monster next to the path attacks
  const lurker = lurkerAt(b, W);
  if (lurker) { walking = null; layoutHeroes(true); interact(hr, lurker.v); return; }
  if (W.i >= W.n) {
    fx.burst('dust', posOf(hr.v));
    walking = null; layoutHeroes(true);
    if (W.i < W.path.length - 1) { hr.route = W.path.slice(W.i); hr.routeObj = objAt[hr.route[hr.route.length - 1]]; showPath(hr, hr.route); } else { hr.route = null; hr.routeObj = -1; }
    updateHud();
  }
}
const BUMP_T = 0.42;
const lurkerAt = (b, W) => NBR[b].map((n) => (objAt[n] >= 0 ? G.objects[objAt[n]] : null)).find((o) => o && o.alive && o.type === 'monster' && o.v !== W.path[W.path.length - 1]);
// a monster standing next to a mine, chest, site or town guards it
const guardOf = (v) => NBR[v].map((n) => (objAt[n] >= 0 ? G.objects[objAt[n]] : null)).find((g) => g && g.alive && g.type === 'monster');
// pickups the hero steps onto (interact() moves it there); everything else it bumps from the neighbouring hex
function walksOnto(v, hr) {
  const o = objAt[v] >= 0 ? G.objects[objAt[v]] : null, other = heroAt(v);
  return !!(o && o.alive && OBJECTS[o.type]?.kind === 'pickup' && !(other && other !== hr) && !guardOf(v));
}
// things you bump into rather than walk onto
function blockingAt(v, hr) {
  const o = objAt[v] >= 0 ? G.objects[objAt[v]] : null;
  if (o && o.alive) return true;
  const other = heroAt(v); return !!(other && other !== hr);
}

// ------------------------------------------------------------------ visiting things
const P = (hr) => G.players[hr.p];
function gain(p, res, n, v = -1) {
  G.players[p].res[res] += n;
  if (p === 0) floatText(v >= 0 ? posOf(v, 0.2) : null, `+${fmt(n)} ${RES_ICON[res]}`, 'gold');
}
function removeObject(o) { o.alive = false; if (objAt[o.v] === o.id) objAt[o.v] = -1; if (seen[o.v]) worldDirty = true; }
function interact(hr, v) {
  const o = objAt[v] >= 0 && G.objects[objAt[v]].alive ? G.objects[objAt[v]] : null;
  const other = heroAt(v);
  const you = hr.p === 0;
  if (other && other !== hr) {
    if (other.p === hr.p) { if (you) toast(`${other.name} is one of yours.`); return; }
    startBattle(hr, { kind: 'hero', hero: other }); return;
  }
  if (!o) return;
  const O = OBJECTS[o.type], kind = O?.kind;
  // guarded: a monster standing next to a mine, chest, site or town must be beaten first
  if (o.type !== 'monster') {
    const guard = guardOf(v);
    if (guard) {
      const what = o.type === 'town' ? G.towns[o.t].name : (O?.name || o.type);
      if (you) ask(`${unitIcon(guard.unit)} ${what} is guarded`, `<div class="bigpt">${unitIcon(guard.unit, 128)}<div><b>${sizeWord(guard.n)} ${plural(guard.unit)}</b><small>${threatWord(guard)}</small></div></div>Defeat the guards before you can claim it.`, [['⚔️ Fight the guards', () => startBattle(hr, { kind: 'monster', obj: guard })], ['Leave', null]]);
      else startBattle(hr, { kind: 'monster', obj: guard });
      return;
    }
  }
  if (o.type === 'monster') {
    // much weaker monsters may offer to join you, or flee
    const ratio = BT.armyPower(heroArmy(hr), hr) / Math.max(1, BT.armyPower([[o.unit, o.n]]));
    if (you && ratio > 4 && !o.refused && hash(o.id * 13 + G.day) % 100 < 55) {
      const u = UNITS[o.unit], price = Math.round(o.n * u.cost.gold * 0.6), free = ratio > 8;
      ask(`${unitIcon(o.unit)} The ${plural(o.unit)} bow before you`, free ? `${o.n} ${plural(o.unit, o.n)} are so impressed by your army that they offer to join you for free.` : `${o.n} ${plural(o.unit, o.n)} offer to join you for ${fmt(price)} 🪙.`, [
        [free ? '🤝 Accept' : `🤝 Hire for ${fmt(price)}`, free || G.players[0].res.gold >= price ? () => { if (addTroops(hr.army, o.unit, o.n)) { if (!free) G.players[0].res.gold -= price; removeObject(o); sfx.recruit(); toast(`${unitIcon(o.unit)} ${o.n} ${plural(o.unit, o.n)} join ${hr.name}.`); sfx.fanfare(); updateHud(); } else toast('No free slot in your army.'); } : undefined],
        ['⚔️ Fight them', () => startBattle(hr, { kind: 'monster', obj: o })],
        ['Let them flee', () => { removeObject(o); giveXp(hr, 0); toast(`${plural(o.unit)} run for their lives.`); }],
      ]);
      return;
    }
    if (you) ask(`${sizeWord(o.n)} ${plural(o.unit)}`, `<div class="bigpt">${unitIcon(o.unit, 128)}<div><b>${UNITS[o.unit].name}</b><small>${icon('attack', 13)}${UNITS[o.unit].att} ${icon('defense', 13)}${UNITS[o.unit].def} ${icon('hp', 13)}${UNITS[o.unit].hp}${UNITS[o.unit].ranged ? ` ${icon('shots', 13)}` : ''}${UNITS[o.unit].fly ? ` ${icon('fly', 13)}` : ''}</small></div></div>About ${o.n <= 4 ? o.n : `${Math.round(o.n * 0.8)}–${Math.round(o.n * 1.2)}`} of them. ${threatWord(o)}.`, [['⚔️ Fight', () => startBattle(hr, { kind: 'monster', obj: o })], ['Leave', null]]);
    else startBattle(hr, { kind: 'monster', obj: o });
    return;
  }
  if (o.type === 'town') {
    const t = G.towns[o.t];
    if (t.p === hr.p) { if (you) openTown(t.id, hr); else aiVisitTown(hr, t); return; }
    if (heroArmy({ army: t.garrison }).length) {
      if (you) ask(`Siege of ${t.name}`, `The town is defended by ${armyWord(heroArmy({ army: t.garrison }))} troops${t.built.includes('fort') ? ' behind walls' : ''}.`, [['⚔️ Attack', () => startBattle(hr, { kind: 'town', town: t })], ['Leave', null]]);
      else startBattle(hr, { kind: 'town', town: t });
    } else captureTown(hr, t);
    return;
  }
  if (kind === 'pickup') {
    removeObject(o); hr.v = v; layoutHeroes(true);
    if (seen[v]) fx.burst(o.type === 'gems' ? 'gem' : o.type === 'artifact' ? 'artifact' : 'coin', posOf(v));
    if (RES.includes(o.type)) { gain(hr.p, o.type, o.amount, v); if (you) sfx.pickup({ kind: o.type }); }
    else if (o.type === 'campfire') { gain(hr.p, 'gold', 400 + ((rnd() * 3) | 0) * 100, v); const r = ['wood', 'ore', 'gems'][(rnd() * 3) | 0]; gain(hr.p, r, r === 'gems' ? 2 : 4, v); if (you) sfx.coin(); }
    else if (o.type === 'chest') {
      const g = 1000 + ((rnd() * 3) | 0) * 250, xp = g - 500;
      if (you) { sfx.chest(); } if (you) ask('🧰 Treasure Chest', 'You find a chest full of gold. Keep it, or give it to the peasants for their wisdom?', [[`🪙 ${fmt(g)} gold`, () => { gain(0, 'gold', g, v); sfx.coin(); updateHud(); }], [`⭐ ${fmt(xp)} experience`, () => giveXp(hr, xp)]]);
      else gain(hr.p, 'gold', g);
    } else if (o.type === 'artifact') {
      const A = ARTIFACTS.find((x) => x.id === o.art);
      hr.arts.push(A.id); hr.mana = Math.min(maxMana(hr), hr.mana);
      if (you) { showMsg(`${A.icon} ${A.name}`, `${artDesc(A)}`); sfx.artifact(); }
    }
    updateHud(); return;
  }
  if (kind === 'mine') {
    if (o.owner !== hr.p) { o.owner = hr.p; if (seen[v]) worldDirty = true; if (seen[v]) fx.burst('flag', posOf(v), { color: ownerCol(hr.p) }); if (you) { toast(`${O.icon} ${O.name} is yours: +${O.amount} ${RES_ICON[O.res]} every day.`); sfx.flag(); } else if (seen[o.v]) toast(`🚩 ${P(hr).name} took a ${O.name}.`); }
    revealAll(); updateHud(); return;
  }
  if (kind === 'visit') {
    const key = `o${o.id}`;
    if (o.type === 'obelisk') { if (you) { reveal(o.v, 12); worldDirty = true; toast('🗿 The obelisk shows you the land around it.'); } return; }
    if (hr.visited.includes(key)) { if (you) toast(`${O.icon} You have already visited the ${O.name}.`); return; }
    hr.visited.push(key);
    if (o.type === 'arena') {
      if (you) ask('🏟️ Arena', 'Train here to become a better warrior.', [['🗡️ +2 Attack', () => { hr.att += 2; updateHud(); }], ['🛡️ +2 Defence', () => { hr.def += 2; updateHud(); }]]);
      else hr.att += 2;
    } else if (o.type === 'tower') { hr.pow += 1; if (you) toast('🗼 +1 Power'); }
    else if (o.type === 'library') { hr.know += 1; if (you) toast('📚 +1 Knowledge'); }
    else if (o.type === 'stone') { giveXp(hr, 1000); }
    else if (o.type === 'shrine') {
      const S = SPELLS[o.spell];
      if (S.circle >= 3 && !(hr.skills.wisdom >= 2)) { if (you) toast(`⛩️ ${S.name} is too difficult: you need Wisdom.`); hr.visited.pop(); return; }
      if (!hr.spells.includes(o.spell)) hr.spells.push(o.spell);
      if (you) { showMsg(`⛩️ ${S.icon} ${S.name}`, S.desc); sfx.learn(); }
    }
    updateHud(); return;
  }
  if (kind === 'weekly') {
    const key = `w${o.id}:${week()}`;
    if (hr.visited.includes(key)) { if (you) toast(`${O.icon} Come back next week.`); return; }
    hr.visited.push(key);
    if (o.type === 'well') { hr.mana = maxMana(hr); if (you) { toast('⛲ Your mana is restored.'); sfx.mana(); } }
    else if (o.type === 'windmill') { const r = ['wood', 'ore', 'gems'][(rnd() * 3) | 0]; gain(hr.p, r, r === 'gems' ? 2 : 4 + ((rnd() * 3) | 0), v); }
    else if (o.type === 'stables') { hr.mp += 400; if (you) toast('🐴 +400 movement today.'); }
    updateHud(); return;
  }
  if (kind === 'dwelling') {
    const u = UNITS[o.unit];
    if (!o.stock) { if (you) toast(`${O.icon} No ${u.name}s left this week.`); return; }
    if (you) recruitDialog(`🛖 ${u.name} dwelling`, o.unit, o.stock, (n) => { o.stock -= n; return hr; });
    else { const n = Math.min(o.stock, Math.floor(P(hr).res.gold / u.cost.gold)); if (n > 0 && addTroops(hr.army, o.unit, n)) { o.stock -= n; P(hr).res.gold -= n * u.cost.gold; } }
  }
}
const week = () => Math.floor((G.day - 1) / 7) + 1;
const artDesc = (A) => ['att', 'def', 'pow', 'know'].filter((k) => A[k]).map((k) => `+${A[k]} ${{ att: 'Attack', def: 'Defence', pow: 'Power', know: 'Knowledge' }[k]}`).concat(A.move ? [`+${A.move} movement`] : [], A.luck ? ['+1 luck'] : [], A.morale ? ['+1 morale'] : [], A.hp ? ['+1 health'] : []).join(', ');
function captureTown(hr, t) {
  if (seen[t.v]) fx.burst('flag', posOf(t.v), { color: ownerCol(hr.p), scale: 1.6 });
  const was = t.p;
  t.p = hr.p; t.garrison = [];
  worldDirty = true;
  if (hr.p === 0) {
    showMsg(`🏰 ${t.name} is yours!`, `The ${FACTIONS[t.fac].name} town now pays you gold and its dwellings will recruit for you.`); sfx.capture();
    // perf: build the captured faction's town scene in idle time now, not on the first tap into it
    (window.requestIdleCallback || ((f) => setTimeout(f, 400)))(() => { try { townView.prepare(t.fac, t.built); } catch (e) { /* built on open instead */ } }, { timeout: 3000 });
  }
  else if (was === 0) { showMsg(`🔥 ${t.name} has fallen`, `${P(hr).name} captured your town.`); sfx.alarm(); }
  checkEnd();
}

// ------------------------------------------------------------------ experience and levels
function giveXp(hr, n) {
  hr.xp += Math.round(n);
  if (hr.p === 0) floatText(posOf(hr.v, 0.25), `+${fmt(n)} ⭐`, 'blue');
  while (hr.xp >= xpFor(hr.lvl + 1)) levelUp(hr);
  updateHud();
}
const pendingLevels = [];
function levelUp(hr) {
  hr.lvl++;
  const fac = P(hr).fac, w = fac === 'necro' ? [0.25, 0.25, 0.3, 0.2] : [0.35, 0.3, 0.15, 0.2], r = rnd();
  const stat = r < w[0] ? 'att' : r < w[0] + w[1] ? 'def' : r < w[0] + w[1] + w[2] ? 'pow' : 'know';
  hr[stat]++;
  // offer two skills: one you have (to improve) and one new, at most 6 skills of level 3
  const have = Object.keys(hr.skills).filter((k) => hr.skills[k] < 3);
  const fresh = Object.keys(SKILLS).filter((k) => !(k in hr.skills) && (k !== 'necromancy' || fac === 'necro'));
  const opts = [];
  if (have.length) opts.push(have[(rnd() * have.length) | 0]);
  while (opts.length < 2 && fresh.length && Object.keys(hr.skills).length < 6) { const k = fresh.splice((rnd() * fresh.length) | 0, 1)[0]; opts.push(k); }
  while (opts.length < 2 && have.length > 1) { const k = have[(rnd() * have.length) | 0]; if (!opts.includes(k)) opts.push(k); }
  if (hr.p !== 0) { if (opts.length) { const k = opts[(rnd() * opts.length) | 0]; hr.skills[k] = (hr.skills[k] || 0) + 1; } return; }
  pendingLevels.push({ hr, stat, opts });
  if (pendingLevels.length === 1) showLevel();
}
function showLevel() {
  const L = pendingLevels[0];
  if (!L) return;
  const names = { att: 'Attack', def: 'Defence', pow: 'Power', know: 'Knowledge' };
  ask(`${icon('experience', 22)} Level ${L.hr.lvl}!`, `<div class="burst lvl"><span class="rays"></span><span class="medal"><small>Level</small><b>${L.hr.lvl}</b></span></div><p><b>${L.hr.name}</b> grows stronger.</p><p class="chips" style="justify-content:center"><span class="chip">${icon(L.stat, 18)}${names[L.stat]} <em>+1</em></span></p><p class="sec">Choose a skill</p>`, L.opts.map((k) => [`${icon(k, 20)} ${SKILLS[k].name} ${['', 'I', 'II', 'III'][(L.hr.skills[k] || 0) + 1]}`, () => { L.hr.skills[k] = (L.hr.skills[k] || 0) + 1; if (k === 'logistics') L.hr.mp += 150; pendingLevels.shift(); updateHud(); setTimeout(showLevel, 200); }, SKILLS[k].desc, 'choice']), true);
  sfx.levelup();
}

// ------------------------------------------------------------------ battle: a separate little scene
const bscene = new THREE.Scene();
bscene.background = new THREE.Color(0x87a8d8);
bscene.fog = new THREE.Fog(0x87a8d8, 14, 34);
const bcam = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
const bview = { dist: 12.5, yaw: 0 };
{
}
const bSun = new THREE.DirectionalLight(0xfff0d8, 2.4); bSun.position.set(4, 10, 3); bSun.castShadow = true; bSun.shadow.mapSize.set(2048, 2048); bSun.shadow.radius = 2.5; bSun.shadow.intensity = 0.6;
Object.assign(bSun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); bSun.shadow.bias = -0.0005;
const bHemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a3a2a, 0.9), bAmb = new THREE.AmbientLight(0x404a70, 0.3);
bscene.add(bSun, bHemi, bAmb);
let bfield = null;
const HS = 0.5, HW = Math.sqrt(3) * HS, VS = 1.5 * HS;
const hexPos = (c, r) => new THREE.Vector3((c - (BT.COLS - 1) / 2 + (r & 1 ? 0.5 : 0) - 0.25) * HW, 0, (r - (BT.ROWS - 1) / 2) * VS);
const hexGeo = new THREE.CylinderGeometry(HS * 0.95, HS * 0.95, 0.02, 6);
const hexes = new THREE.InstancedMesh(hexGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.26, depthWrite: false }), BT.COLS * BT.ROWS);
hexes.frustumCulled = false; bscene.add(hexes);
for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) { dummy.position.copy(hexPos(c, r)); dummy.quaternion.identity(); dummy.scale.setScalar(1); dummy.updateMatrix(); hexes.setMatrixAt(BT.key(c, r), dummy.matrix); hexes.setColorAt(BT.key(c, r), new THREE.Color(0xffffff)); }
const bstuff = new THREE.Group(); bscene.add(bstuff);
const wallMat = new THREE.MeshStandardMaterial({ color: 0xb8ae9a, roughness: 0.9, flatShading: true });
const activeRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 30).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd84a, toneMapped: false }));
bscene.add(activeRing); activeRing.visible = false;
const vfx = createVfx(THREE, bscene);
// warm everything up behind a loading screen: map + battle shaders, portraits, battlefields, creature fits
function prewarm(onDone) {
  const jobs = [];
  jobs.push(['Painting the world', () => { try { renderer.compile(scene, camera); } catch (e) { /* ok */ } }]);
  // portraits for the creatures you will actually see first: your faction (+ upgrades) and the map guards
  const myFac = G.players[0]?.fac, need = new Set(G.objects.filter((o) => o.alive && o.type === 'monster').map((o) => o.unit));
  for (const [id, u] of Object.entries(UNITS)) if (u.fac === myFac) need.add(id);
  for (const id of need) jobs.push(['Summoning creatures', () => portraitImg(id, 64)]);
  for (const hr of G.heroes.filter((h) => h.p === 0)) jobs.push(['Summoning heroes', () => { heroPic(hr, 40, 'round'); heroPic(hr, 96); }]);
  for (const t of new Set([ter[G.heroes[0]?.v] ?? 1, 1, 2, 3, 4, 5, 6, 7])) jobs.push(['Preparing battlefields', () => createBattlefield(THREE, t, hexPos, BT.COLS, BT.ROWS)]);
  for (const id of need) jobs.push(['Training armies', () => { const g = cached('u' + id, () => unitGeo(id)); unitFit(id, g, 'battle'); unitFit(id, g, 'map'); }]);
  for (const fac of new Set(G.towns.filter((t) => t.p !== 0 && t.built.includes('fort')).map((t) => t.fac))) jobs.push(['Raising walls', () => { cached('wall_' + fac, () => wallModel(fac)); cached('gate_' + fac, () => gateModel(fac)); cached('tower_' + fac, () => towerModel(fac)); cached('keep_' + fac, () => keepModel(fac)); }]);
  // compile every battle program (units, arena ground/grid/decor/water, lava glow) and draw the likely first arena once,
  // so its textures, buffers and shadow programs are on the GPU before the first fight (it used to cost the first
  // battle ~4 frames' worth of stall)
  jobs.push(['Sharpening swords', () => {
    const m = meshOf(cached('upikeman', () => unitGeo('pikeman'))); setAnim(m, ANIM.IDLE);
    const t0 = ter[G.heroes.find((h) => h.p === 0)?.v] ?? 1, fields = [...new Set([t0, 1, 2, 3, 4, 5, 6, 7])].map((t) => createBattlefield(THREE, t, hexPos, BT.COLS, BT.ROWS));
    bscene.add(m); for (const f of fields) bscene.add(f.group);
    try { renderer.compile(bscene, bcam); } catch (e) { /* ok */ }
    for (const f of fields.slice(1)) bscene.remove(f.group);
    try { bcam.position.set(0, 10.75, 10.6); bcam.lookAt(0, 0, -0.15); post.render(bscene, bcam); } catch (e) { /* ok */ }
    bscene.remove(m, fields[0].group);
  }]);
  // perf: the first town open used to build the whole faction scene (env, buildings, ink hulls) and compile its shaders
  // on tap (a multi-second hitch on phones). Build the player's own town now and draw it once behind the loader, so
  // opening it later only toggles the DOM sheet. town_view keeps each faction's environment and building geometry cached.
  const myTown = G.towns.find((t) => t.p === 0);
  if (myTown) {
    jobs.push(['Raising your town', () => { townView.highlight(null); townView.setTown({ fac: myTown.fac, built: myTown.built, name: myTown.name }); }]);
    jobs.push(['Raising your town', () => { townView.update(1 / 60); try { post.render(townView.scene, townView.camera); } catch (e) { /* ok */ } }]);
  }
  const total = jobs.length, el = $('loader');
  el.hidden = false;
  const step = () => {
    const t0 = performance.now();
    // run jobs for ~110 ms per slice, then let the bar repaint
    while (jobs.length && performance.now() - t0 < 110) { const [label, f] = jobs.shift(); $('ld-text').textContent = label + '…'; try { f(); } catch (e) { console.warn('prewarm', e); } }
    $('ld-bar').style.width = `${Math.round(((total - jobs.length) / total) * 100)}%`;
    if (jobs.length) setTimeout(step, 0);
    else { el.classList.add('done'); setTimeout(() => { el.hidden = true; el.classList.remove('done'); }, 350); onDone?.(); }
  };
  setTimeout(step, 30);
}
// scenery around the field
let bpreview = null, BB = null, bctx = null, bmesh = new Map(), banim = [], bwait = 0, bspell = null, bauto = false;
function heroBattle(hr) { return { att: statOf(hr, 'att'), def: statOf(hr, 'def'), pow: statOf(hr, 'pow'), know: statOf(hr, 'know'), mana: hr.mana, skills: hr.skills, spells: hr.spells, luck: hr.arts.includes('clover') ? 1 : 0, morale: hr.arts.includes('banner') ? 1 : 0, name: hr.name, p: hr.p }; }
function splitMonster(o) {
  const k = clamp(Math.round(o.n / 6), 1, 5) + (o.n > 3 ? 1 : 0), parts = Math.min(k, 5, o.n), arr = [];
  for (let i = 0; i < parts; i++) arr.push([o.unit, Math.floor(o.n / parts) + (i < o.n % parts ? 1 : 0)]);
  return arr;
}
function startBattle(hr, foe) {
  const defHero = foe.kind === 'hero' ? foe.hero : null;
  const defArmy = foe.kind === 'monster' ? splitMonster(foe.obj) : foe.kind === 'hero' ? foe.hero.army : foe.town.garrison;
  const defOwner = foe.kind === 'hero' ? foe.hero.p : foe.kind === 'town' ? foe.town.p : -1;
  const playerDefends = defOwner === 0 && hr.p !== 0;
  // the player always fights from the bottom of the screen
  const sides = playerDefends ? [{ hero: defHero, army: defArmy, owner: 0 }, { hero: hr, army: hr.army, owner: hr.p }] : [{ hero: hr, army: hr.army, owner: hr.p }, { hero: defHero, army: defArmy, owner: defOwner }];
  const B = BT.createBattle({ armyA: sides[0].army, heroA: sides[0].hero ? heroBattle(sides[0].hero) : null, armyB: sides[1].army, heroB: sides[1].hero ? heroBattle(sides[1].hero) : null, town: foe.kind === 'town' ? { fort: foe.town.built.includes('fort'), side: playerDefends ? 0 : 1, power: Math.max(2, foe.town.built.length / 2) } : null });
  const ctx = { hr, foe, sides, terrain: ter[foe.kind === 'monster' ? foe.obj.v : hr.v] };
  // a side with no living troops cannot fight: settle it at once. Opening the arena would never end (the enemy AI
  // has no target and never finishes its turn, or the player has nothing to attack).
  if (!BT.alive(B, 0).length || !BT.alive(B, 1).length) { B.over = { winner: BT.alive(B, 0).length ? 0 : 1 }; B.events.length = 0; finishBattle(B, ctx); return; }
  if (sides[0].owner !== 0 && sides[1].owner !== 0) { BT.autoResolve(B); finishBattle(B, ctx); return; }
  enterBattle(B, ctx);
}
// Battle entry is staged behind a curtain that appears on the very tap: models that are not cached yet (another
// faction's creatures, a town's walls, their portraits) are built a few per frame, the arena's shaders compile (in
// parallel where KHR_parallel_shader_compile exists) and its textures upload, and only then is the battle shown.
// The player never stares at a frozen map frame, input stays locked (G.mode) for the whole set-up, and any error
// resolves the fight instead of leaving the game stuck in a half-built battle.
let bprep = null;
const bcurtain = document.createElement('div');
bcurtain.id = 'bcurtain'; bcurtain.hidden = true; bcurtain.innerHTML = icon('attack', 72); document.body.appendChild(bcurtain);
const nextFrame = () => new Promise((res) => requestAnimationFrame(() => res()));
function curtain(on) {
  if (on) { bcurtain.hidden = false; bcurtain.classList.remove('off'); bcurtain.classList.add('on'); return; }
  bcurtain.classList.remove('on'); bcurtain.classList.add('off');
  setTimeout(() => { if (!bcurtain.classList.contains('on')) bcurtain.hidden = true; }, 400);
}
function enterBattle(B, ctx) {
  BB = B; bctx = ctx; banim = []; bwait = 0.6; bspell = null; bauto = false; B.events.length = 0;
  G.mode = 'battle'; showPath(selHero(), null);
  $('hud').hidden = true; curtain(true);
  musicScene('battle'); sfx.battle();
  const job = bprep = { B };
  prepBattle(job).catch((e) => abortBattle(job, e));
}
async function prepBattle(job) {
  const B = job.B, ctx = bctx, live = () => bprep === job && BB === B && G.mode === 'battle';
  // let the curtain paint before any heavy work (its fade and pulse run on the compositor from then on)
  await nextFrame(); await nextFrame();
  if (!live()) return;
  const todo = [() => createBattlefield(THREE, ctx.terrain, hexPos, BT.COLS, BT.ROWS)];
  if (B.walls.size) { const f = ctx.foe.town?.fac; todo.push(() => cached('wall_' + f, () => wallModel(f)), () => cached('gate_' + f, () => gateModel(f)), () => cached('tower_' + f, () => towerModel(f)), () => cached('keep_' + f, () => keepModel(f))); }
  for (const id of new Set(B.stacks.map((s) => s.id))) todo.push(() => unitFit(id, cached('u' + id, () => unitGeo(id)), 'battle'), () => portraitImg(id, 64));
  let t0 = performance.now();
  for (const f of todo) {
    if (performance.now() - t0 > 14) { await nextFrame(); if (!live()) return; t0 = performance.now(); }
    f();
  }
  buildBattleScene(B, ctx);
  // first turn and highlights (this also creates the selection ring, so its program is compiled below too)
  BT.nextStack(B);
  refreshBattle();
  // upload the arena's painted textures and compile every program the battle scene needs before its first frame
  for (const tx of [bfield.ground?.material.map, bfield.ground?.material.emissiveMap, bfield.overlay?.material.map]) if (tx) renderer.initTexture(tx);
  await nextFrame(); if (!live()) return;
  try { await Promise.race([renderer.compileAsync(bscene, bcam), new Promise((res) => setTimeout(res, 2500))]); } catch (e) { console.warn('battle shaders', e); }
  if (!live()) return;
  bprep = null;
  $('battle').hidden = false;
  const hs = ctx.sides.map((sd) => (sd.hero ? sd.hero.name : sd.owner < 0 ? 'Neutrals' : 'Garrison'));
  $('b-title').textContent = `${hs[0]} vs ${hs[1]}`;
  refreshBattle();
  // lift the curtain once the first battle frame is on screen
  await nextFrame(); await nextFrame();
  curtain(false);
}
function abortBattle(job, e) {
  console.error('battle set-up failed', e);
  if (bprep !== job) return;
  bprep = null; curtain(false);
  if (BB !== job.B || G.mode !== 'battle') return;
  // never leave the game locked in a half-built battle: fight it out off screen
  if (!job.B.over) BT.autoResolve(job.B);
  job.B.events.length = 0; banim = [];
  endBattleScreen();
}
function buildBattleScene(B, ctx) {
  if (bfield) bscene.remove(bfield.group);
  bfield = createBattlefield(THREE, ctx.terrain, hexPos, BT.COLS, BT.ROWS);
  bscene.add(bfield.group);
  bscene.background.set(bfield.sky);
  bscene.fog.color.set(bfield.fog.color); bscene.fog.near = bfield.fog.near; bscene.fog.far = bfield.fog.far;
  const L = bfield.lights;
  bSun.color.set(L.sun.color); bSun.intensity = L.sun.intensity;
  bHemi.color.set(L.hemi.sky); bHemi.groundColor.set(L.hemi.ground); bHemi.intensity = L.hemi.intensity;
  bAmb.color.set(L.ambient.color); bAmb.intensity = L.ambient.intensity;
  bHemi.intensity *= 1.15; bHemi.groundColor.lerp(new THREE.Color(0xa08060), 0.4);
  bAmb.intensity += 0.12; bAmb.color.lerp(new THREE.Color(0x9090c8), 0.5);
  vfx.clear(); bstuff.clear(); bmesh.clear();
  const sfac = bctx.foe.town?.fac;
  const lay = B.walls.size ? siegeLayout(hexPos, BT.COLS, BT.ROWS, B.town.side ?? 1) : null;
  if (bfield.keepZone) bfield.keepZone.visible = !lay?.keep;
  bctx.tower = null; bctx.gate = null;
  for (const k of B.obstacles) {
    const c = k % BT.COLS, r = (k / BT.COLS) | 0;
    if (B.walls.has(k)) { const w = meshOf(cached('wall_' + sfac, () => wallModel(sfac))); w.position.copy(hexPos(c, r)); w.rotation.y = lay.wallRotY; bstuff.add(w); continue; }
    const m = meshOf(cached('obs' + ctx.terrain + '_' + (k % 3), () => bfield.obstacleModel(k % 3)), false); m.position.copy(hexPos(c, r)); m.rotation.y = k; bstuff.add(m);
  }
  if (lay) {
    if (B.gate != null) { const g = meshOf(cached('gate_' + sfac, () => gateModel(sfac))); g.position.copy(hexPos(B.gate % BT.COLS, (B.gate / BT.COLS) | 0)); g.rotation.y = lay.wallRotY; bstuff.add(g); bctx.gate = g; }
    lay.towers.forEach((p, i) => { const tw = meshOf(cached('tower_' + sfac, () => towerModel(sfac))); tw.position.copy(p); tw.scale.setScalar(lay.towerScale); tw.rotation.y = lay.wallRotY; bstuff.add(tw); if (i === 0) bctx.tower = tw; });
    if (lay.keep) { const kp = meshOf(cached('keep_' + sfac, () => keepModel(sfac))); kp.position.copy(lay.keep); kp.scale.setScalar(lay.keepScale); bstuff.add(kp); }
  }
  clearPlates(); for (const f of floaters) f.el.remove(); floaters.length = 0;
  for (const s of B.stacks) {
    const m = meshOf(cached('u' + s.id, () => unitGeo(s.id)));
    applyFit(m, unitFit(s.id, cached('u' + s.id, () => unitGeo(s.id)), 'battle'));
    addBlob(m, 0.42 / m.scale.x);
    m.position.copy(hexPos(s.c, s.r)); m.rotation.y = s.side === 0 ? Math.PI : 0;
    bstuff.add(m); bmesh.set(s.uid, m); setAnim(m, ANIM.IDLE, { seed: s.uid * 1.7 });
    bplates.add(makePlate(s));
  }
}
// stack count plates (HoMM-style): small sprites standing on the ground at the front edge of the
// stack's hex. They are depth-tested inside the battle scene, so a creature standing in front of a
// plate hides it, while each plate is pulled a little toward the camera so its own creature's
// feet/chest never swallow it. Fixed screen size (no size attenuation); text is redrawn into a tiny
// canvas only when the shown count changes.
const bplates = new THREE.Group(); bscene.add(bplates);
const bplateMap = new Map();
const PLATE_PX = 15, PLATE_FWD = 0.3, PLATE_BIAS = 0.22;
const plateA = new THREE.Vector3(), plateD = new THREE.Vector3();
function makePlate(s) {
  const cv = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false, fog: false, toneMapped: false }));
  sp.renderOrder = 5; sp.frustumCulled = false; sp.visible = false;
  // x-ray ghost: same texture, no depth test, faint, drawn first so the real plate covers it where visible
  const ghost = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.4, sizeAttenuation: false, fog: false, toneMapped: false }));
  ghost.renderOrder = 4; ghost.frustumCulled = false; ghost.visible = false;
  sp.userData = { cv, tex, side: s.side, n: null, pr: 0, ghost };
  bplateMap.set(s.uid, sp); bplates.add(ghost);
  return sp;
}
function drawPlate(sp, n) {
  const u = sp.userData, pr = Math.min(3, Math.max(1, renderer.getPixelRatio()));
  if (u.n === n && u.pr === pr) return;
  u.n = n; u.pr = pr;
  const txt = n >= 10000 ? `${Math.round(n / 1000)}k` : String(n);
  const h = Math.round(PLATE_PX * pr), cv = u.cv, g = cv.getContext('2d');
  const font = `900 ${Math.round(h * 0.78)}px Nunito, system-ui, sans-serif`;
  g.font = font;
  const w = Math.max(Math.round(h * 1.5), Math.ceil(g.measureText(txt).width + h * 0.75));
  cv.width = w; cv.height = h;
  // the plate: rounded pill, faction-side colour, dark rim
  const lw = Math.max(1, pr), r = h / 2 - lw / 2;
  g.beginPath(); g.roundRect(lw / 2, lw / 2, w - lw, h - lw, r);
  const grd = g.createLinearGradient(0, 0, 0, h);
  if (u.side === 1) { grd.addColorStop(0, '#ff8a72'); grd.addColorStop(1, '#b02a22'); } else { grd.addColorStop(0, '#6a94ff'); grd.addColorStop(1, '#2a4aa8'); }
  g.fillStyle = grd; g.fill(); g.lineWidth = lw; g.strokeStyle = u.side === 1 ? '#4a0a0a' : '#0a1440'; g.stroke();
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = Math.max(2, pr * 1.6); g.strokeStyle = u.side === 1 ? '#4a0a0a' : '#0a1440'; g.strokeText(txt, w / 2, h * 0.54);
  g.fillStyle = '#fff'; g.fillText(txt, w / 2, h * 0.54);
  u.tex.dispose(); u.tex.needsUpdate = true; // canvas size can change: drop the old GPU texture
}
// shown count (what the player has SEEN) -> plate text/visibility
function setPlate(s) {
  const sp = bplateMap.get(s.uid); if (!sp) return;
  if (s.shown > 0) drawPlate(sp, s.shown);
}
// per frame, after the battle camera moved: anchor each plate on the ground in front of its stack
function updatePlates() {
  const B = BB; if (!B) return;
  const pr = Math.min(3, Math.max(1, renderer.getPixelRatio()));
  const sy = (PLATE_PX * 2 * Math.tan(THREE.MathUtils.degToRad(bcam.fov / 2))) / Math.max(1, innerHeight);
  for (const s of B.stacks) {
    const sp = bplateMap.get(s.uid), m = bmesh.get(s.uid); if (!sp) continue;
    const show = !!m && m.visible && !m.userData.dying && s.shown > 0;
    sp.visible = sp.userData.ghost.visible = show; if (!show) continue;
    if (sp.userData.pr !== pr) drawPlate(sp, s.shown);
    const cv = sp.userData.cv; sp.scale.set((sy * cv.width) / cv.height, sy, 1);
    // ground point at the front (camera-facing) edge of the hex, ignoring flight height and hops
    plateD.set(bcam.position.x - m.position.x, 0, bcam.position.z - m.position.z).normalize();
    plateA.set(m.position.x, 0.06, m.position.z).addScaledVector(plateD, PLATE_FWD);
    // slide toward the camera along the view ray: same spot on screen, wins the depth test vs own body
    plateD.subVectors(bcam.position, plateA).normalize();
    sp.position.copy(plateA).addScaledVector(plateD, PLATE_BIAS);
    sp.userData.ghost.position.copy(sp.position); sp.userData.ghost.scale.copy(sp.scale);
  }
}
function clearPlates() {
  for (const sp of bplateMap.values()) { sp.userData.tex.dispose(); sp.material.dispose(); sp.userData.ghost.material.dispose(); }
  bplates.clear(); bplateMap.clear();
}
function refreshBattle() {
  const B = BB; if (!B) return;
  for (const s of B.stacks) {
    // labels show what the player has SEEN: pending attack animations update them on impact
    if (!banim.length || s.shown === undefined) s.shown = s.count;
    setPlate(s);
  }
  // highlight what the active stack can do
  const s = B.active, mineTurn = s && sideOwner(s.side) === 0 && !bauto && !B.over && !banim.length;
  const reach = mineTurn ? BT.reachable(B, s) : new Map();
  const white = new THREE.Color(0x203a10), grn = new THREE.Color(0xe8ffc0), red = new THREE.Color(0xff6a5a), blu = new THREE.Color(0x7ac8ff);
  for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) {
    const k = BT.key(c, r), st = BT.stackAt(B, c, r);
    let col = white;
    if (mineTurn && reach.has(k) && !st) col = grn;
    if (mineTurn && st && st.side !== s.side && (BT.canShoot(B, s) || BT.attackFrom(B, s, st).length || BT.nbrs(st.c, st.r).some(([x, y]) => x === s.c && y === s.r))) col = red;
    if (bspell && st) col = SPELLS[bspell].target === 'ally' ? (st.side === 0 ? blu : white) : st.side === 1 ? red : white;
    hexes.setColorAt(k, col);
    dummy.position.copy(hexPos(c, r)); dummy.quaternion.identity(); dummy.scale.setScalar(col === white ? 0.0001 : 0.92); dummy.updateMatrix(); hexes.setMatrixAt(k, dummy.matrix);
  }
  hexes.instanceColor.needsUpdate = true; hexes.instanceMatrix.needsUpdate = true;
  // the ring stays on the stack whose action is playing and moves on only once the queue has drained
  const rs = banim.length && bactor >= 0 ? B.stacks[bactor] : s;
  if (rs && rs.count > 0) vfx.select(bmesh.get(rs.uid), rs.side === 0 ? 0xffd84a : 0xff5a4a); else vfx.select(null);
  // the turn order strip
  $('b-queue').innerHTML = BT.queue(B, 9).map((x, i) => `<span class="q s${x.side}${i === 0 ? ' now' : ''}">${unitIcon(x.id)}<b>${x.shown ?? x.count}</b></span>`).join('');
  const h0 = B.heroes[0];
  $('b-spell').disabled = !h0 || B.cast[0] || !h0.spells.some((id) => h0.mana >= SPELLS[id].mana) || !mineTurn;
  $('b-spell').innerHTML = `${icon('spellbook', 24)}<small>${h0 ? `Mana ${h0.mana}` : 'Spells'}</small>`;
  $('b-wait').disabled = $('b-def').disabled = !mineTurn;
  $('b-auto').classList.toggle('on', bauto);
  $('b-msg').innerHTML = !s ? '' : mineTurn ? (bspell ? `${icon(bspell, 18)} Choose a target for <b>${SPELLS[bspell].name}</b>` : `<b>${UNITS[s.id].name} ×${s.count}</b> · ${BT.canShoot(B, s) ? `${icon('shots', 16)} ${s.shots} shots · tap an enemy to shoot` : 'tap a green hex to move, a red enemy to attack'}`) : sideOwner(s.side) === 0 ? (bauto ? `${icon('auto', 16)} Auto battle…` : '…') : `Enemy ${UNITS[s.id].name} ×${s.count} is acting…`;
}
const sideOwner = (side) => bctx.sides[side].owner;
// the player may act: their stack's turn, nothing animating, auto off (guards taps and the wait/defend buttons)
function myTurn() { const B = BB, s = B?.active; return !!s && !B.over && !banim.length && !bauto && !s.acted && s.count > 0 && sideOwner(s.side) === 0; }
let bpreviewAt = 0;
function battleTap(cx, cy) {
  const B = BB; if (!myTurn()) return;
  const s = B.active;
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, bcam);
  let best = null, bd = 1e9;
  // tapping a creature's body selects its hex (the ground point behind a tall unit belongs to another hex)
  const groups = B.stacks.filter((st) => st.count > 0 && bmesh.get(st.uid)).map((st) => [st, bmesh.get(st.uid)]);
  const hit = ray.intersectObjects(groups.map(([, g]) => g), true).find((h) => !h.object.userData.blob);
  if (hit) { const g = groups.find(([, gg]) => { let o = hit.object; while (o) { if (o === gg) return true; o = o.parent; } return false; }); if (g) { best = [g[0].c, g[0].r]; bd = 0; } }
  // ground point under the finger: picks the hex, and the attack-from hex when a unit's body was tapped
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) p.copy(hexPos(s.c, s.r));
  if (!best) {
    for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) { const d = hexPos(c, r).distanceTo(p); if (d < bd) { bd = d; best = [c, r]; } }
  }
  if (!best || bd > HS * 1.2) return;
  const [c, r] = best, t = BT.stackAt(B, c, r);
  if (bspell) {
    const S = SPELLS[bspell];
    if (S.target === 'area' || (t && ((S.target === 'enemy' && t.side === 1) || (S.target === 'ally' && t.side === 0)))) {
      BT.castSpell(B, 0, bspell, S.target === 'area' ? null : t, c, r);
      bspell = null; afterAction(); 
    } else sfx.deny();
    return;
  }
  if (t && t.side !== s.side) {
    const shoot = BT.canShoot(B, s);
    if (bpreview !== t.uid) {
      const adj0 = BT.nbrs(t.c, t.r).some(([x, y]) => x === s.c && y === s.r);
      if (!shoot && !adj0 && !BT.attackFrom(B, s, t).length) { toast('Too far to reach this turn.'); sfx.deny(); return; }
      const est = BT.estimate(B, s, t, shoot);
      bpreview = t.uid; bpreviewAt = performance.now(); sfx.click();
      $('b-msg').innerHTML = `${icon(shoot ? 'shots' : 'attack', 16)} ${est.lo === est.hi ? est.lo : `${est.lo}–${est.hi}`} damage · kills ${est.klo === est.khi ? est.klo : `${est.klo}–${est.khi}`} of ${t.count} ${plural(t.id, t.count)} · <b>tap again to strike</b>`;
      return;
    }
    // an accidental double tap must not turn the damage preview straight into a strike
    if (performance.now() - bpreviewAt < 250) return;
    bpreview = null;
    if (shoot) { BT.actShoot(B, s, t); afterAction(); return; }
    const adj = BT.nbrs(t.c, t.r).some(([x, y]) => x === s.c && y === s.r);
    // attack from the reachable neighbour hex closest to where you tapped
    const from = adj ? [s.c, s.r] : BT.attackFrom(B, s, t).sort((a, b) => hexPos(a[0], a[1]).distanceTo(p) - hexPos(b[0], b[1]).distanceTo(p))[0];
    if (!from) { toast('Too far to reach this turn.'); sfx.deny(); return; }
    BT.actAttack(B, s, t, from); afterAction(); return;
  }
  if (!t && BT.reachable(B, s).has(BT.key(c, r)) && !(c === s.c && r === s.r)) { BT.actMove(B, s, c, r); afterAction(); return; }
  sfx.deny();
}
function afterAction(actor = BB.active) { bpreview = null; bactor = actor ? actor.uid : -1; queueEvents(); refreshBattle(); }
function queueEvents() { bpreview = null; banim.push(...BB.events.map((e) => ({ e, t: 0 }))); BB.events.length = 0; }
$('b-wait').addEventListener('click', () => { if (!myTurn()) return; const s = BB.active; bspell = null; BT.actWait(BB, s); BT.nextStack(BB); afterAction(s); sfx.click(); });
$('b-def').addEventListener('click', () => { if (!myTurn()) return; const s = BB.active; bspell = null; BT.actDefend(BB, s); afterAction(s); sfx.defend(); });
$('b-auto').addEventListener('click', () => { bauto = !bauto; bspell = null; refreshBattle(); sfx.click(); });
$('b-quick').addEventListener('click', () => { if (!BB || BB.over) return; BT.autoResolve(BB); BB.events.length = 0; banim = []; endBattleScreen(); });
$('b-spell').addEventListener('click', () => {
  const h0 = BB?.heroes[0]; if (!h0) return;
  ask(`${icon('spellbook', 22)} Spellbook`, `<p class="chips" style="justify-content:center"><span class="chip">${icon('mana', 18)}<em>${h0.mana}</em> mana</span><span class="chip">One spell per round</span></p>`, h0.spells.map((id) => [`${icon(id, 22)} ${SPELLS[id].name} · ${icon('mana', 14)}${SPELLS[id].mana}`, h0.mana >= SPELLS[id].mana ? () => { bspell = id; refreshBattle(); } : undefined, SPELLS[id].desc, 'choice']).concat([['Close', null, '', 'ghost']]));
});
// battle animation: events play one after another
const bfloat = (pos, text, cls) => floatText(pos, text, cls, bcam);
// battle one-shot animations play a bit slower than authored so they read calmly on a phone
const AS = 0.72;
// bactor: the stack whose action is playing (the selection ring stays on it); bclock: battle time for death timing
let bactor = -1, bclock = 0;
const bfTmp = new THREE.Vector3(), bfTmp2 = new THREE.Vector3();
const bpan = (m) => (m ? clamp(m.position.clone().project(bcam).x * 0.6, -1, 1) : 0);
function animateBattle(dt) {
  const B = BB; if (!B) return;
  // gentle idle bob
  // count plates follow their stacks in updatePlates(), run after the camera moves
  bclock += dt;
  stepFacing(dt);
  if (banim.length) {
    const a = banim[0], e = a.e; a.t += dt;
    const done = playEvent(e, a.t);
    if (done) { banim.shift(); if (banim.length) refreshBattle(); else battleDrained(B); }
    return;
  }
  if (B.over) {
    if (!B.cheered) { B.cheered = true; bwait = Math.max(bwait, 1.15); for (const st of B.stacks) if (st.count > 0 && st.side === B.over.winner) { const m = bmesh.get(st.uid); if (m) setAnim(m, ANIM.CHEER, { seed: st.uid, speed: AS }); } }
    if ((bwait -= dt) <= 0) endBattleScreen(); return;
  }
  let s = B.active;
  if (!s || s.acted || s.count <= 0) {
    // normally battleDrained() already advanced the turn; this is the fallback (e.g. auto toggled mid-turn)
    s = BT.nextStack(B); bactor = -1;
    if (B.events.length) queueEvents();
    refreshBattle();
    if (banim.length) return;
  }
  if (!s) return;
  if (sideOwner(s.side) === 0 && !bauto) return;
  if ((bwait -= dt) > 0) return;
  bwait = 0;
  // the AI acts; the turn advances (nextStack) only once its animations have played, so the selection ring,
  // the turn strip and any round/tower events stay in step with what is on screen
  bactor = s.uid;
  if (!B.cast[s.side] && B.heroes[s.side] && rnd() < 0.5) BT.aiCast(B, s.side);
  if (!B.over) BT.aiAct(B, s);
  queueEvents(); refreshBattle();
}
// the event queue just ran dry: settle facings, advance the turn and queue whatever that produced
// (round start, tower shots, gate) so the next stack is highlighted the same frame the last animation ends
function battleDrained(B) {
  for (const st of B.stacks) if (st.count > 0) faceYaw(bmesh.get(st.uid), st.side === 0 ? Math.PI : 0);
  if (!B.over && (!B.active || B.active.acted || B.active.count <= 0)) {
    BT.nextStack(B);
    if (B.events.length) { bactor = -1; queueEvents(); }
  }
  const s = B.active;
  // a short beat before an enemy (or auto) stack moves, so the player sees whose turn it is
  if (!banim.length && !B.over && s && (sideOwner(s.side) !== 0 || bauto)) bwait = Math.max(bwait, bauto ? 0.15 : 0.32);
  refreshBattle();
}
// facing: units turn toward a target yaw (m.userData.yawT) at a capped angular speed instead of snapping
function faceYaw(m, yaw) { if (m) m.userData.yawT = yaw; }
function faceTo(m, x, z) { if (!m) return; const dx = x - m.position.x, dz = z - m.position.z; if (dx * dx + dz * dz > 1e-6) m.userData.yawT = Math.atan2(dx, dz); }
function stepFacing(dt) {
  const k = 1 - Math.exp(-dt * 14), cap = 11 * dt;
  for (const m of bmesh.values()) {
    const y = m.userData.yawT; if (y === undefined || !m.visible) continue;
    let d = y - m.rotation.y; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
    if (Math.abs(d) < 1e-3) { m.rotation.y = y; continue; }
    m.rotation.y += Math.sign(d) * Math.min(Math.abs(d) * k + 0.6 * dt, Math.abs(d), cap);
  }
}
// trapezoid speed profile along a walked path: ease in over RA s, cruise at V hexes/s, ease out over RA s
const WALK_V = 4, WALK_RA = 0.12;
function walkDist(t, n) {
  const T = n / WALK_V + WALK_RA;
  if (t <= 0) return 0; if (t >= T) return n;
  if (t < WALK_RA) return (WALK_V * t * t) / (2 * WALK_RA);
  if (t > T - WALK_RA) return n - (WALK_V * (T - t) * (T - t)) / (2 * WALK_RA);
  return WALK_V * (t - WALK_RA / 2);
}
// the death pose + cry start on the killing blow; the queued 'die' event only times the dissolve from dieAt
function startDeath(m, s) {
  if (!m || m.userData.dieAt !== undefined) return;
  m.userData.dieAt = bclock; m.userData.dying = true;
  setAnim(m, ANIM.DEATH, { speed: AS }); sfx.die({ kind: s?.u?.undead ? 'undead' : '', pan: bpan(m) });
}
function playEvent(e, t) {
  const B = BB, M = (uid) => bmesh.get(uid), S = (uid) => B.stacks[uid];
  if (e.t === 'move') {
    const m = M(e.s); if (!m) return true;
    if (!e.pts) {
      // hex centres computed once; walkers follow a trapezoid speed profile, fliers ease along an arc whose
      // length and height scale with the distance
      const path = e.path && e.path.length > 1 ? e.path : [e.from, e.to];
      e.pts = path.map(([c, r]) => hexPos(c, r)); e.n = e.pts.length - 1;
      if (e.fly) { const dh = e.pts[0].distanceTo(e.pts[e.n]) / HW; e.T = clamp(0.45 + 0.075 * dh, 0.55, 1.05); e.h = Math.min(1.3, 0.45 + 0.12 * dh); }
      else e.T = e.n / WALK_V + WALK_RA;
      setAnim(m, e.fly ? ANIM.FLY : ANIM.WALK); m.userData.busy = true;
      sfx.step({ kind: e.fly ? 'fly' : 'walk', pan: bpan(m) });
      if (e.fly) faceTo(m, e.pts[e.n].x, e.pts[e.n].z);
    }
    const P = e.pts, n = e.n;
    if (e.fly) {
      const u = Math.min(1, t / e.T), k = u * u * (3 - 2 * u);
      m.position.lerpVectors(P[0], P[n], k); m.position.y = Math.sin(u * Math.PI) * e.h;
    } else {
      const sd = walkDist(t, n), i = Math.min(n - 1, Math.floor(sd));
      m.position.lerpVectors(P[i], P[i + 1], sd - i);
      faceYaw(m, Math.atan2(P[i + 1].x - P[i].x, P[i + 1].z - P[i].z));
    }
    if (t < e.T) return false;
    m.position.copy(P[n]); m.userData.busy = false;
    // no idle pose in between when this stack strikes next (walk -> attack crossfades directly)
    const nx = banim[1]?.e;
    if (!(nx && (nx.t === 'hit' || nx.t === 'shot') && nx.a === e.s)) setAnim(m, ANIM.IDLE);
    return true;
  }
  if (e.t === 'hit' || e.t === 'shot') {
    const a = M(e.a), d = M(e.d), sa = S(e.a), sd = S(e.d);
    if (!a || !d) return true;
    const st = e.t === 'shot' && ['lich', 'powerlich', 'monk', 'zealot'].includes(sa.id) ? ANIM.CAST : ANIM.ATTACK, imp = ANIM_IMPACT[st] / AS;
    if (!e.started) {
      e.started = true;
      // turn toward the target (smoothly, see stepFacing); a melee defender squares up to its attacker
      e.home = a.position.clone(); e.dir = new THREE.Vector3().subVectors(d.position, a.position).setY(0).normalize();
      faceTo(a, d.position.x, d.position.z);
      if (e.t === 'hit' && (e.left ?? sd.count) > 0) faceTo(d, a.position.x, a.position.z);
      setAnim(a, st, { speed: AS });
      a.userData.busy = true;
    }
    // the projectile leaves on the release frame of the shot/cast, not when the wind-up starts
    if (e.t === 'shot' && !e.launched && t >= imp) {
      e.launched = true;
      vfx.projectile(shotKind(sa.id), bfTmp.copy(a.position).setY(sa.id === 'cyclops' ? 1.1 : 0.65), bfTmp2.copy(d.position).setY(0.5), () => { e.landed = true; });
      sfx.shoot({ kind: shotKind(sa.id), pan: bpan(a) });
    }
    // melee lunge: peaks exactly on the impact frame and is back home by 2x impact
    if (e.t === 'hit') a.position.copy(e.home).addScaledVector(e.dir, Math.sin(Math.min(1, t / (2 * imp)) * Math.PI) * 0.14);
    if ((e.t === 'shot' ? e.landed || t > imp + 1.5 : t >= imp) && !e.shown) {
      e.shown = true; e.shownAt = t;
      // a killing blow starts the death right on impact (the 'die' event that follows only finishes it)
      if ((e.left ?? sd.count) > 0) setAnim(d, ANIM.HIT, { speed: AS }); else startDeath(d, sd);
      if (e.t === 'hit') { vfx.hit(d.position.clone().setY(0.5), meleeKind(sa.u), { dir: d.position.clone().sub(a.position) }); sfx.hit({ kind: meleeKind(sa.u), pan: bpan(d) }); }
      else sfx.hit({ kind: 'arrow', pan: bpan(d) });
      if (e.lucky) { vfx.sparkle(d.position, 'luck'); sfx.luck(); }
      d.userData.flash = 0.3;
      bfloat(d.position.clone().setY(1), `-${fmt(e.dmg)}${e.killed ? ` (${e.killed}💀)` : ''}${e.lucky ? ' 🍀' : ''}`, sd.side === 0 ? 'red' : 'gold');
      if (e.retal) bfloat(d.position.clone().setY(1.4), 'Retaliation', 'blue');
      sd.shown = e.left ?? sd.count; if (e.aLeft !== undefined) { sa.shown = e.aLeft; setPlate(sa); }
      setPlate(sd);
    }
    if (!e.shown) return false;
    // hold until the defender's flinch has mostly played when it strikes back next; otherwise until the lunge is home
    const nx = banim[1]?.e, retalNext = nx && nx.t === 'hit' && nx.retal && nx.a === e.d;
    const end = e.t === 'shot' ? e.shownAt + 0.22 : retalNext ? imp + 0.4 : Math.max(2 * imp, imp + 0.26);
    if (t >= end) { a.userData.busy = false; if (e.t === 'hit') a.position.copy(e.home); return true; }
    return false;
  }
  if (e.t === 'die') {
    const m = M(e.s); if (!m) return true;
    // the death pose may already be running since the killing blow landed (dieAt): time the dissolve from there
    if (!e.started) { e.started = true; startDeath(m, S(e.s)); }
    const age = bclock - m.userData.dieAt;
    if (age > 0.8 && !e.diss) { e.diss = true; vfx.death(m, { undead: !!S(e.s).u?.undead }); }
    if (age > 1.35 && e.diss) { m.visible = false; return true; }
    return false;
  }
  if (e.t === 'spell') {
    const p = hexPos(e.c, e.r);
    if (!e.started) {
      e.started = true; sfx.cast({ kind: e.id });
      let tg = e.hits.map((hh) => M(hh.s)).filter(Boolean);
      if (!tg.length) { const st = BT.stackAt(B, e.c, e.r); if (st && M(st.uid)) tg = [M(st.uid)]; }
      e.land = vfx.spell(e.id, p, tg, { side: e.side }) || 0.3;
      bfloat(p.clone().setY(1.8), `${SPELLS[e.id].icon} ${SPELLS[e.id].name}`, 'blue');
    }
    if (t >= e.land && !e.shown) {
      e.shown = true; sfx.spell({ kind: e.id });
      for (const hh of e.hits) { const m = M(hh.s); if (!m) continue; if (!hh.heal && (hh.left ?? 1) <= 0) startDeath(m, S(hh.s)); else setAnim(m, hh.heal ? ANIM.CHEER : ANIM.HIT, { speed: AS }); bfloat(m.position.clone().setY(1.1), hh.heal ? `+${hh.heal}` : `-${fmt(hh.dmg)}${hh.killed ? ` (${hh.killed}💀)` : ''}`, hh.heal ? 'green' : 'gold'); m.userData.flash = 0.3; S(hh.s).shown = hh.left ?? S(hh.s).count; setPlate(S(hh.s)); }
    }
    return t > e.land + 0.45;
  }
  if (e.t === 'tower') {
    const m = M(e.s);
    if (!e.started) { e.started = true; sfx.shoot({ kind: 'tower' }); if (m) vfx.projectile('tower', bctx.tower ? bctx.tower.position.clone().setY(2.1 * bctx.tower.scale.y) : new THREE.Vector3(0, 2, -4), m.position.clone().setY(0.5), () => { e.landed = true; }); else e.landed = true; }
    if ((e.landed || t > 1.5) && !e.shown) { e.shown = true; e.shownAt = t; if (S(e.s)) S(e.s).shown = e.left ?? S(e.s).count; if (m) { m.userData.flash = 0.3; if ((e.left ?? 1) <= 0) startDeath(m, S(e.s)); else setAnim(m, ANIM.HIT, { speed: AS }); bfloat(m.position.clone().setY(1.1), `🏹 Tower -${e.dmg}${e.killed ? ` (${e.killed}💀)` : ''}`, 'red'); } refreshBattle(); }
    return e.shown && t > e.shownAt + 0.1;
  }
  if (e.t === 'gate') { if (!e.started) { e.started = true; sfx.gate({ kind: e.broken ? 'broken' : '' }); bfloat(hexPos(e.c, e.r).setY(1.2), e.broken ? '💥 The gate falls!' : `🪵 Gate ${e.hp}`, e.broken ? 'gold' : 'red'); if (e.broken && bctx.gate) bctx.gate.visible = false; } return t > 0.5; }
  if (e.t === 'morale') { if (!e.started) { e.started = true; vfx.sparkle(M(e.s).position, 'morale'); sfx.morale(); setAnim(M(e.s), ANIM.CHEER, { speed: AS }); bfloat(M(e.s).position.clone().setY(1.3), '🎺 Good morale!', 'gold'); } return t > 0.5; }
  if (e.t === 'round') { if (!e.started) { e.started = true; $('b-round').textContent = `Round ${e.round}`; replay($('b-round'), 'pop'); } return true; }
  if (e.t === 'wait' || e.t === 'defend') { if (!e.started) { e.started = true; const m = M(e.s); if (m) bfloat(m.position.clone().setY(1.1), e.t === 'wait' ? '⏳ Wait' : '🛡️ Defend', 'blue'); } return t > 0.25; }
  return true;
}
function endBattleScreen() {
  const B = BB, ctx = bctx;
  BB = null; vfx.clear(); vfx.select(null);
  $('battle').hidden = true; $('hud').hidden = false; clearPlates();
  G.mode = 'map';
  musicScene('map');
  finishBattle(B, ctx);
}
function finishBattle(B, ctx) {
  const winSide = B.over.winner, sides = ctx.sides;
  const lost = [0, 0].map((_, side) => B.stacks.filter((s) => s.side === side).map((s) => [s.id, s.start - s.count]).filter(([, n]) => n > 0));
  const killedHp = [0, 1].map((side) => B.stacks.filter((s) => s.side !== side).reduce((a, s) => a + (s.start - s.count) * s.u.hp, 0));
  // write the survivors back to the armies
  sides.forEach((sd, side) => {
    const stacks = B.stacks.filter((s) => s.side === side);
    if (sd.army === ctx.foe.obj?.army) return;
    for (const s of stacks) if (sd.army[s.slot]) sd.army[s.slot][1] = s.count;
    for (let i = 0; i < sd.army.length; i++) if (sd.army[i] && sd.army[i][1] <= 0) sd.army[i] = null;
    while (sd.army.length && !sd.army[sd.army.length - 1]) sd.army.pop();
    if (sd.hero) sd.hero.mana = B.heroes[side] ? B.heroes[side].mana : sd.hero.mana;
  });
  const win = sides[winSide], lose = sides[1 - winSide];
  // necromancy: the winner raises some of the fallen as skeletons
  if (win.hero && win.hero.skills.necromancy) {
    const dead = B.stacks.filter((s) => s.side !== winSide && !s.u.undead).reduce((a, s) => a + (s.start - s.count), 0);
    const raised = Math.floor(dead * 0.1 * win.hero.skills.necromancy);
    if (raised > 0 && addTroops(win.hero.army, 'skeleton', raised) && win.owner === 0) toast(`💀 Necromancy raises ${raised} skeletons.`);
  }
  if (win.hero) giveXp(win.hero, killedHp[winSide] + (ctx.foe.kind === 'hero' ? 500 : 0));
  // the loser
  if (ctx.foe.kind === 'monster') {
    const o = ctx.foe.obj;
    if (sides[0].owner === ctx.hr.p ? winSide === 0 : winSide === 1) removeObject(o);
    else o.n = B.stacks.filter((s) => s.side === (sides[0].owner === -1 ? 0 : 1)).reduce((a, s) => a + s.count, 0);
  }
  if (lose.hero) {
    lose.hero.alive = false;
    if (win.hero) for (const a of lose.hero.arts) win.hero.arts.push(a);
    if (lose.owner === 0 && G.selHero === lose.hero.id) G.selHero = G.heroes.findIndex((x) => x.alive && x.p === 0);
  }
  if (ctx.foe.kind === 'town' && win.hero !== ctx.hr) ctx.foe.town.garrison = (sides.find((sd) => sd.army === ctx.foe.town.garrison) || {}).army || ctx.foe.town.garrison;
  worldDirty = true; layoutHeroes(true);
  if (sides[0].owner === 0 || sides[1].owner === 0) {
    const me = sides[0].owner === 0 ? 0 : 1, won = winSide === me;
    const list = (arr) => (arr.length ? arr.map(([id, n]) => `${unitIcon(id)} ${n} ${plural(id, n)}`).join('<br>') : 'None');
    showMsg(won ? `${icon('victory', 22)} Victory!` : `${icon('defeat', 22)} Defeat`, `<div class="burst ${won ? 'win' : 'lose'}"><span class="rays"></span>${icon(won ? 'victory' : 'defeat', 64)}</div><div class="cas"><div><b>Your losses</b>${list(lost[me])}</div><div><b>Enemy losses</b>${list(lost[1 - me])}</div></div>${won && sides[me].hero ? `<p class="xp-line">${icon('experience', 18)} +${fmt(killedHp[me])} experience</p>` : ''}${!won && sides[me].hero ? `<p>${sides[me].hero.name} has fallen.</p>` : ''}`, true);
    if (won) { sfx.victory(); musicScene('victory'); } else { sfx.defeat(); musicScene('defeat'); }
  }
  // after the battle summary, so the casualties card comes first
  if (ctx.foe.kind === 'town' && win.hero === ctx.hr) captureTown(ctx.hr, ctx.foe.town);
  checkEnd();
  updateHud();
}

// ------------------------------------------------------------------ towns
const townIncome = (t) => (t.built.includes('hall3') ? 2000 : t.built.includes('hall2') ? 1000 : 500);
const tierUnit = (t, tier) => (t.built.includes(`u${tier}`) ? UPGRADES[t.fac][tier - 1] : FACTIONS[t.fac].units[tier - 1]);
const costText = (c) => RES.filter((r) => c[r]).map((r) => `<span class="nw">${icon(r, 14)}${fmt(c[r])}</span>`).join(' ');
const canPay = (p, c, n = 1) => RES.every((r) => (G.players[p].res[r] || 0) >= (c[r] || 0) * n);
const pay = (p, c, n = 1) => { for (const r of RES) G.players[p].res[r] -= (c[r] || 0) * n; };
const visitorOf = (t) => G.heroes.find((x) => x.alive && x.p === t.p && (x.v === t.v || NBR[t.v].includes(x.v)));
let townOpen = null, townTab = 'build';
function openTown(id, hr) {
  if (G.mode !== 'map' && G.mode !== 'town') return;
  townOpen = id; G.mode = 'town';
  const t = G.towns[id];
  const vis = hr || visitorOf(t);
  if (vis) learnSpells(t, vis);
  $('town').hidden = false; $('hud').hidden = true;
  townView.highlight(null); townView.setTown({ fac: t.fac, built: t.built, name: t.name });
  renderTown(); sfx.town(); townInsets();
  musicScene('town');
}
function closeTown() { renderTown.view = null; townView.highlight(null); $('town').hidden = true; $('hud').hidden = false; townOpen = null; G.mode = 'map'; musicScene('map'); sfx.close(); updateHud(); }
$('t-close').addEventListener('click', closeTown);
for (const b of document.querySelectorAll('#town .tabs2 button')) b.addEventListener('click', () => { townTab = b.dataset.t; renderTown(); sfx.tab(); });
function learnSpells(t, hr) {
  const lv = t.built.includes('mage3') ? 3 : t.built.includes('mage2') ? 2 : t.built.includes('mage1') ? 1 : 0;
  if (!lv) return;
  if (!t.spells.length) { const by = (c) => Object.keys(SPELLS).filter((k) => SPELLS[k].circle === c); t.spells = [...by(1).sort(() => rnd() - 0.5).slice(0, 3), ...by(2), ...by(3)]; }
  const learned = [];
  for (const id of t.spells) {
    const c = SPELLS[id].circle;
    if (c > lv || hr.spells.includes(id)) continue;
    if (c === 2 && !(hr.skills.wisdom >= 1) && hr.lvl < 5) continue;
    if (c === 3 && !(hr.skills.wisdom >= 2)) continue;
    hr.spells.push(id); learned.push(id);
  }
  hr.mana = maxMana(hr);
  if (learned.length && hr.p === 0) toast(`📘 ${hr.name} learns ${learned.map((id) => SPELLS[id].icon + ' ' + SPELLS[id].name).join(', ')}`);
}
function townTap(cx, cy) {
  const id = townView.pick(cx, cy); if (!id) return;
  townView.highlight(id);
  townTab = /^[du]\d$/.test(id) ? 'recruit' : (id === 'tavern' || id === 'market') ? 'more' : id === 'fort' ? 'army' : 'build';
  renderTown(); sfx.click();
}
function renderTown() {
  const t = G.towns[townOpen], Pl = G.players[t.p], vis = visitorOf(t);
  townView.setTown({ fac: t.fac, built: t.built, name: t.name });
  for (const b of document.querySelectorAll('#town .tabs2 button')) b.classList.toggle('on', b.dataset.t === townTab);
  $('t-name').textContent = t.name;
  $('t-sub').innerHTML = `<span>${FACTIONS[t.fac].name}</span><span class="nw">${icon('gold', 14)} +${fmt(townIncome(t))}/day</span>${t.p === 0 ? `<span class="pill${t.builtToday ? ' off' : ''}">${t.builtToday ? 'Built today' : 'Can build'}</span>` : ''}`;
  let html = '';
  if (townTab === 'build') {
    html = BUILDINGS.map((b) => {
      const has = t.built.includes(b.id), reqOk = b.req.every((r) => t.built.includes(r)), can = !has && reqOk && !t.builtToday && canPay(t.p, b.cost);
      const name = b.tier ? `${b.up ? '⬆️ ' : ''}${UNITS[b.up ? UPGRADES[t.fac][b.tier - 1] : FACTIONS[t.fac].units[b.tier - 1]].name} dwelling` : b.name;
      return `<div class="row-b ${has ? 'has' : reqOk ? '' : 'lock'}"><i>${b.tier ? unitIcon(FACTIONS[t.fac].units[b.tier - 1]) : icon(b.id, 30)}</i><div><b>${name}</b>${has ? '<small class="ok">Built</small>' : reqOk ? `<small>${costText(b.cost)}</small>` : `<small class="req">${icon('lock', 13)} Needs ${b.req.map((r) => BUILDINGS.find((x) => x.id === r).name).join(', ')}</small>`}<small class="d">${b.desc}</small></div>${has ? `<span class="done">${icon('check', 18)}</span>` : `<button data-build="${b.id}" ${can ? '' : 'disabled'}>Build</button>`}</div>`;
    }).join('');
  } else if (townTab === 'recruit') {
    const tiers = [...new Set(BUILDINGS.filter((b) => b.tier && t.built.includes(b.id)).map((b) => b.tier))].sort((x, y) => x - y);
    html = tiers.length ? tiers.map((tier) => {
      const id = tierUnit(t, tier), u = UNITS[id], n = t.avail[tier] || 0, max = Math.min(n, ...RES.filter((r) => u.cost[r]).map((r) => Math.floor(Pl.res[r] / u.cost[r])));
      return `<div class="row-b"><i>${unitIcon(id)}</i><div><b>${u.name} <em>${n} available</em></b><small>${costText(u.cost)} <span>each</span></small><small class="stats2"><span>${icon('attack', 13)}${u.att}</span><span>${icon('defense', 13)}${u.def}</span><span>${icon('hp', 13)}${u.hp}</span><span>${icon('damage', 13)}${u.dmg[0]}–${u.dmg[1]}</span><span>${icon('movement', 13)}${u.spd}</span>${u.ranged ? `<span>${icon('shots', 13)}</span>` : ''}${u.fly ? `<span>${icon('fly', 13)}</span>` : ''}</small></div><button data-rec="${tier}" data-n="${max}" ${max > 0 ? '' : 'disabled'}>Recruit<small>×${max}</small></button></div>`;
    }).join('') + '<p class="hint2">Recruits join the hero beside the town, or the garrison.</p>' : '<p class="hint2">Build a dwelling to recruit creatures.</p>';
  } else if (townTab === 'army') {
    const row = (title, army, who) => `<div class="armyrow"><b>${title}</b><div class="slots">${Array.from({ length: 7 }, (_, i) => army[i] && army[i][1] > 0 ? `<button data-move="${who}:${i}">${unitIcon(army[i][0])}<em>${army[i][1]}</em></button>` : '<button disabled></button>').join('')}</div></div>`;
    html = row(`${icon('town', 18)} Garrison`, t.garrison, 'g') + (vis ? row(`${icon('hero', 18)} ${vis.name}`, vis.army, 'h') : '<p class="hint2">No hero beside the town.</p>') + '<p class="hint2">Tap a stack to move it across.</p>';
    // upgrades for troops whose upgraded dwelling stands here
    const ups = [];
    for (const [who, army] of [['g', t.garrison], ['h', vis?.army]]) if (army) army.forEach((st, i) => { if (!st || st[1] <= 0) return; const tier = UNITS[st[0]].tier, upId = UPGRADES[t.fac]?.[tier - 1]; if (UNITS[st[0]].fac === t.fac && !UNITS[st[0]].up && t.built.includes(`u${tier}`) && upId) { const cost = Object.fromEntries(RES.map((r) => [r, Math.max(0, (UNITS[upId].cost[r] || 0) - (UNITS[st[0]].cost[r] || 0))])); ups.push(`<div class="row-b"><i>${unitIcon(st[0])}</i><div><b>${icon('upgrade', 14)} ${st[1]} ${plural(st[0], st[1])} → ${plural(upId, st[1])}</b><small>${costText(Object.fromEntries(RES.map((r) => [r, cost[r] * st[1]])))}</small></div><button data-up="${who}:${i}" ${canPay(t.p, cost, st[1]) ? '' : 'disabled'}>Upgrade</button></div>`); } });
    if (ups.length) html += ups.join('');
  } else if (townTab === 'more') {
    const tav = t.built.includes('tavern'), mk = t.built.includes('market');
    const heroes = G.heroes.filter((x) => x.alive && x.p === t.p).length;
    html = `<div class="row-b ${tav ? '' : 'lock'}"><i>${icon('tavern', 30)}</i><div><b>Tavern</b>${tav ? `<small>Hire a new hero with a few troops.</small><small><span class="nw">${icon('gold', 13)}2,500</span></small>` : `<small class="req">${icon('lock', 13)} Build a Tavern first</small>`}</div><button data-hire="1" ${tav && heroes < 4 && canPay(t.p, { gold: 2500 }) && !heroAt(t.v) ? '' : 'disabled'}>Hire</button></div>`;
    html += `<div class="row-b ${mk ? '' : 'lock'}"><i>${icon('market', 30)}</i><div><b>Marketplace</b>${mk ? '<small>Buy and sell resources, one at a time.</small>' : `<small class="req">${icon('lock', 13)} Build a Marketplace first</small>`}</div></div>`;
    if (mk) for (const r of ['wood', 'ore', 'gems']) { const buy = r === 'gems' ? 500 : 250, sell = r === 'gems' ? 200 : 100; html += `<div class="row-b"><i>${icon(r, 30)}</i><div><b>${r[0].toUpperCase() + r.slice(1)} <em>${fmt(Pl.res[r])} owned</em></b><small><span class="nw">Buy ${icon('gold', 13)}${buy}</span><span class="nw">Sell ${icon('gold', 13)}${sell}</span></small></div><button data-buy="${r}" ${Pl.res.gold >= buy ? '' : 'disabled'}>Buy</button><button data-sell="${r}" ${Pl.res[r] > 0 ? '' : 'disabled'}>Sell</button></div>`; }
  }
  if (t.p !== 0) html = `<p class="hint2">${G.players[t.p]?.name || 'An enemy'} rules this town. Capture it to build and recruit here.</p>`;
  if (renderTown.html !== html) { // unchanged rows keep their DOM (no re-parse, no image re-decode)
    $('t-body').innerHTML = html; renderTown.html = html; renderTown.at = performance.now(); }
  // rows bounce in only when a tab (or town) is opened, not on every purchase
  const view = `${townOpen}:${townTab}`; $('t-body').classList.toggle('fresh', renderTown.view !== view); renderTown.view = view;
  // tab badges: a glowing dot on Build when something can be built today, a count on Recruit when creatures can be hired
  if (t.p === 0) {
    const canB = !t.builtToday && BUILDINGS.some((b) => !t.built.includes(b.id) && b.req.every((r) => t.built.includes(r)) && canPay(t.p, b.cost));
    const recN = BUILDINGS.filter((b) => b.tier && !b.up && t.built.includes(b.id)).reduce((a, b) => { const u = UNITS[tierUnit(t, b.tier)]; return a + Math.max(0, Math.min(t.avail[b.tier] || 0, ...RES.filter((r) => u.cost[r]).map((r) => Math.floor(Pl.res[r] / u.cost[r])))); }, 0);
    for (const b of document.querySelectorAll('#town .tabs2 button')) { b.querySelector('.tb')?.remove(); const n = b.dataset.t === 'build' ? (canB ? '!' : '') : b.dataset.t === 'recruit' ? (recN ? (recN > 99 ? '99+' : String(recN)) : '') : ''; if (n) b.insertAdjacentHTML('beforeend', `<i class="tb">${n}</i>`); }
  } else for (const x of document.querySelectorAll('#town .tabs2 .tb')) x.remove();
  updateRes();
}
$('t-body').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled || (e.detail > 0 && staleTap(renderTown.at))) return;
  const t = G.towns[townOpen], vis = visitorOf(t);
  if (b.dataset.build) { buildIn(t, b.dataset.build); sfx.build(); }
  else if (b.dataset.rec) {
    const tier = +b.dataset.rec, n = +b.dataset.n, id = tierUnit(t, tier);
    if (n <= 0) return;
    const army = vis ? vis.army : t.garrison;
    if (!addTroops(army, id, n) && !(vis && addTroops(t.garrison, id, n))) { toast('No free slot.'); sfx.deny(); return; }
    pay(t.p, UNITS[id].cost, n); t.avail[tier] -= n; sfx.recruit();
    toast(`${unitIcon(id)} ${n} ${plural(id, n)} join ${vis ? vis.name : 'the garrison'}.`);
  } else if (b.dataset.up) {
    const [who, i] = b.dataset.up.split(':'), army = who === 'g' ? t.garrison : vis.army, st = army[i], upId = UPGRADES[t.fac][UNITS[st[0]].tier - 1];
    const cost = Object.fromEntries(RES.map((r) => [r, Math.max(0, (UNITS[upId].cost[r] || 0) - (UNITS[st[0]].cost[r] || 0))]));
    if (canPay(t.p, cost, st[1])) { pay(t.p, cost, st[1]); st[0] = upId; sfx.upgrade(); toast(`⬆️ ${st[1]} ${plural(upId, st[1])}!`); }
  } else if (b.dataset.move) {
    const [who, i] = b.dataset.move.split(':'), from = who === 'g' ? t.garrison : vis.army, to = who === 'g' ? vis?.army : t.garrison;
    if (!to) return;
    if (who === 'h' && heroArmy(vis).length <= 1) { toast('A hero needs at least one stack.'); sfx.deny(); return; }
    const [id, n] = from[i];
    if (addTroops(to, id, n)) { from[i] = null; while (from.length && !from[from.length - 1]) from.pop(); sfx.click(); }
  } else if (b.dataset.hire) {
    const v = NBR[t.v].find((x) => passable(x) && !heroAt(x) && objAt[x] < 0);
    if (v === undefined) return;
    pay(t.p, { gold: 2500 });
    const names = FACTIONS[t.fac].heroes, used = G.heroes.map((x) => x.name);
    const hr = newHero(t.p, v, names.find((n) => !used.includes(n)) || 'Captain');
    const us = FACTIONS[t.fac].units; hr.army = [[us[0], 12], [us[1], 4]];
    hr.mp = moveMax(hr); hr.mana = maxMana(hr);
    G.heroes.push(hr); G.selHero = hr.id; learnSpells(t, hr);
    layoutHeroes(true); toast(`🍺 ${hr.name} joins you.`); sfx.hire();
  } else if (b.dataset.buy) { const r = b.dataset.buy; G.players[t.p].res.gold -= r === 'gems' ? 500 : 250; G.players[t.p].res[r]++; sfx.coin(); }
  else if (b.dataset.sell) { const r = b.dataset.sell; G.players[t.p].res.gold += r === 'gems' ? 200 : 100; G.players[t.p].res[r]--; sfx.coin(); }
  renderTown();
});
function buildIn(t, id) {
  const b = BUILDINGS.find((x) => x.id === id);
  if (t.builtToday || t.built.includes(id) || !b.req.every((r) => t.built.includes(r)) || !canPay(t.p, b.cost)) return false;
  pay(t.p, b.cost); t.built.push(id); t.builtToday = true;
  // a new dwelling comes with its first week of creatures
  if (b.tier) t.avail[b.tier] = (t.avail[b.tier] || 0) + UNITS[tierUnit(t, b.tier)].grow;
  if (id.startsWith('mage')) { const vis = visitorOf(t); if (vis) learnSpells(t, vis); }
  return true;
}

// ------------------------------------------------------------------ the hero sheet
function openHero() {
  const hr = selHero(); if (!hr) return;
  const st = (k, ic, n) => `<div class="st"><i>${ic}</i><b>${statOf(hr, k)}</b><small>${n}</small></div>`;
  const next = xpFor(hr.lvl + 1), prev = xpFor(hr.lvl), pct = (a, b) => clamp((a / Math.max(1, b)) * 100, 0, 100);
  const chips = (arr, none) => (arr.length ? `<div class="chips">${arr.join('')}</div>` : `<p class="none">${none}</p>`);
  showMsg(`${icon('hero', 24)} ${hr.name}`, `<div class="hs-head"><span class="hs-pt">${heroPic(hr, 96)}</span><span class="hs-lv"><small>Level</small><b>${hr.lvl}</b></span><div class="hs-xp"><div class="xpbar"><i style="width:${pct(hr.xp - prev, next - prev)}%"></i></div><small>${icon('experience', 14)} ${fmt(hr.xp)} / ${fmt(next)} experience</small></div></div>
    <div class="stats">${st('att', icon('attack', 24), 'Attack')}${st('def', icon('defense', 24), 'Defence')}${st('pow', icon('power', 24), 'Power')}${st('know', icon('knowledge', 24), 'Knowledge')}</div>
    <div class="meters"><div class="meter"><span>${icon('mana', 16)}</span>Mana<b>${hr.mana}/${maxMana(hr)}</b><i><i style="width:${pct(hr.mana, maxMana(hr))}%"></i></i></div><div class="meter mp"><span>${icon('movement', 16)}</span>Move<b>${fmt(hr.mp)}</b><i><i style="width:${pct(hr.mp, moveMax(hr))}%"></i></i></div></div>
    <h3 class="sec">Army</h3>
    <div class="slots big">${Array.from({ length: 7 }, (_, i) => hr.army[i] && hr.army[i][1] > 0 ? `<span>${unitIcon(hr.army[i][0])}<em>${hr.army[i][1]}</em><small>${UNITS[hr.army[i][0]].name}</small></span>` : '<span class="e"></span>').join('')}</div>
    <h3 class="sec">Skills</h3>${chips(Object.keys(hr.skills).map((k) => `<span class="chip">${icon(k, 18)}${SKILLS[k].name} <em>${['', 'I', 'II', 'III'][hr.skills[k]]}</em></span>`), 'No skills yet')}
    <h3 class="sec">Spells</h3>${chips(hr.spells.map((id) => `<span class="chip">${icon(id, 18)}${SPELLS[id].name}</span>`), 'No spells yet: build a Mage Guild')}
    <h3 class="sec">Artifacts</h3>${chips(hr.arts.map((id) => { const A = ARTIFACTS.find((x) => x.id === id); return `<span class="chip">${icon(id, 18)}${A.name}</span>`; }), 'No artifacts yet')}`, true);
}

// ------------------------------------------------------------------ HUD, messages and dialogs
const UICON = { pikeman: '🔱', archer: '🏹', griffin: '🦅', swordsman: '⚔️', monk: '🧙', cavalier: '🏇', angel: '👼', skeleton: '💀', zombie: '🧟', wight: '👻', vampire: '🧛', lich: '☠️', blackknight: '♞', bonedragon: '🐉', goblin: '👺', wolf: '🐺', orc: '👹', ogre: '🦣', troll: '🧌', cyclops: '👁️', hydra: '🐍' };
const unitIcon = (id, s = 64) => portraitImg(id, s) || UICON[id] || UICON[UNITS[id]?.up] || '❔';
const plural = (id, n = 2) => { const w = UNITS[id].name; if (n === 1) return w; if (/m[ae]n$/.test(w)) return w.replace(/man$/, 'men'); if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies'; if (/(s|x|ch|sh)$/.test(w)) return w + 'es'; return w.replace(/f$/, 'ves').replace(/([^s])$/, '$1s'); };
let toastT = 0;
function toast(msg) { const el = $('toast'); el.innerHTML = msg; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }
// UI juice: a soft ripple from the touch point on chunky buttons (purely visual, removed after it plays)
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest?.('.btn, .fb, .row-b button, .tabs2 button, .hb, .diffs button, .fcard, .slots button');
  if (!b || b.disabled || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = b.getBoundingClientRect(), w = document.createElement('span'), c = document.createElement('i');
  w.className = 'rip'; c.style.left = `${e.clientX - r.left}px`; c.style.top = `${e.clientY - r.top}px`;
  w.appendChild(c); b.appendChild(w); setTimeout(() => w.remove(), 650);
}, { passive: true, capture: true });
// replay a one-shot CSS animation class (e.g. a counter pop)
function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function showMsg(title, html, wide = false) { ask(title, html, [['OK', null]], wide); }
const dialogs = [];
function ask(title, html, buttons, wide = false) {
  dialogs.push({ title, html, buttons, wide });
  if (dialogs.length === 1) renderDialog();
}
function renderDialog() {
  const d = dialogs[0], el = $('dialog'), card = $('dlg-card');
  // perf/feel: the last dialog fades out (compositor-only opacity/transform) instead of vanishing; taps pass through meanwhile
  clearTimeout(renderDialog.t); el.classList.remove('closing');
  if (!d) {
    if (el.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.hidden = true; return; }
    el.classList.add('closing'); renderDialog.t = setTimeout(() => { el.hidden = true; el.classList.remove('closing'); }, 170);
    return;
  }
  if (el.hidden) { card.classList.remove('swap'); el.hidden = false; } else replay(card, 'swap'); // a chained dialog: a quick swap pop
  renderDialog.at = performance.now();
  card.classList.toggle('wide', !!d.wide);
  $('dlg-title').innerHTML = d.title;
  $('dlg-body').innerHTML = d.html;
  // the first button is the primary (gold) one unless a button names its own style (4th entry), e.g. equal choices
  $('dlg-btns').innerHTML = d.buttons.map(([label, fn, sub, cls], i) => `<button class="btn ${cls || (i === 0 ? 'gold' : 'ghost')}" data-i="${i}" ${fn === undefined ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`).join('');
}
// tap guard: a click whose press began before the buttons were (re)built hit stale content (a double tap on OK
// would otherwise answer the NEXT dialog, e.g. pick a level-up skill unseen). Same for the town sheet rows.
let lastDown = 0;
document.addEventListener('pointerdown', () => { lastDown = performance.now(); }, { passive: true, capture: true });
document.addEventListener('touchstart', () => {}, { passive: true }); // lets iOS Safari apply :active press feedback
// (only real pointer clicks: keyboard and programmatic clicks have e.detail === 0)
const staleTap = (builtAt) => builtAt > 0 && lastDown > 0 && lastDown < builtAt;
$('dlg-btns').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if ((e.detail > 0 && staleTap(renderDialog.at)) || $('dialog').classList.contains('closing')) return;
  const d = dialogs.shift(); if (!d) { renderDialog(); return; } const fn = d.buttons[+b.dataset.i]?.[1];
  renderDialog(); sfx.click();
  if (fn) fn();
});
const dialogOpen = () => dialogs.length > 0;
function recruitDialog(title, id, stock, onBuy) {
  const u = UNITS[id], Pl = G.players[0];
  const max = Math.min(stock, ...RES.filter((r) => u.cost[r]).map((r) => Math.floor(Pl.res[r] / u.cost[r])));
  ask(title, `${unitIcon(id)} <b>${u.name}</b> · ${stock} available · ${costText(u.cost)} each`, [[`Hire ${max}`, max > 0 ? () => { const hr = onBuy(max); if (addTroops(hr.army, id, max)) { pay(0, u.cost, max); sfx.coin(); toast(`${unitIcon(id)} ${max} ${plural(id, max)} join ${hr.name}.`); } else toast('No free slot in your army.'); updateHud(); } : undefined], ['Leave', null]]);
}
// floating numbers over the world (or the battlefield)
const floaters = [];
function floatText(pos, text, cls = '', cm = null) {
  const el = document.createElement('div'); el.className = `floater ${cls}`; el.textContent = text; $('floaters').appendChild(el);
  floaters.push({ el, p: pos, t: 0, cm, slot: pos ? 0 : floaters.filter((f) => !f.p).length });
  if (floaters.length > 14) floaters.shift().el.remove();
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.t += dt;
    if (f.t > 1.6) { f.el.remove(); floaters.splice(i, 1); continue; }
    let x = innerWidth / 2, y = innerHeight * 0.4 + f.slot * 34;
    if (f.p) { const v = f.p.clone().project(f.cm || camera); x = (v.x * 0.5 + 0.5) * innerWidth; y = (-v.y * 0.5 + 0.5) * innerHeight; }
    const hw = (f.w ??= f.el.offsetWidth) / 2 + 6; x = clamp(x, hw, innerWidth - hw);
    f.el.style.opacity = String(Math.min(1, (1.6 - f.t) * 2));
    f.el.style.transform = `translate(${x}px, ${y - f.t * 40}px) translate(-50%, -50%) scale(${Math.min(1, 0.6 + f.t * 4)})`;
  }
}
// resource counters pop and throw a floating "+500" / "−250" when a value changes (UI only)
function updateRes() {
  const r = G.players[0]?.res; if (!r) return;
  const resPrev = updateRes.prev || (updateRes.prev = { pl: null });
  const live = resPrev.pl === G.players[0], dl = {};
  for (const k of RES) {
    const el = $(`r-${k}`), d = live ? r[k] - resPrev[k] : 0; dl[k] = d; resPrev[k] = r[k];
    if (!el) continue;
    el.textContent = fmt(r[k]);
    if (d) {
      const s = el.parentElement; replay(s, d > 0 ? 'up' : 'down'); s.classList.remove(d > 0 ? 'down' : 'up');
      const f = document.createElement('i'); f.className = `rdelta ${d > 0 ? 'up' : 'down'}`; f.textContent = `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`;
      s.appendChild(f); setTimeout(() => f.remove(), 1500);
    }
  }
  const dayNew = live && resPrev.day !== G.day; resPrev.day = G.day; resPrev.pl = G.players[0];
  setHTML($('r-day'), `<small>Week ${week()}</small><b>Day ${((G.day - 1) % 7) + 1}</b>`);
  if (dayNew) replay($('r-day'), 'up');
  $('r2-gold').innerHTML = RES.map((k) => `<span class="rc${dl[k] ? (dl[k] > 0 ? ' up' : ' down') : ''}"><i>${icon(k, 22)}</i><b>${fmt(r[k])}</b>${dl[k] ? `<i class="rdelta ${dl[k] > 0 ? 'up' : 'down'}">${dl[k] > 0 ? '+' : '−'}${fmt(Math.abs(dl[k]))}</i>` : ''}</span>`).join('');
}
// perf: HUD rebuilds only when the markup really changed (an innerHTML rebuild re-parses portrait <img>s and restarts the badge animations)
function setHTML(el, html) { if (el && el.__html !== html) { el.innerHTML = html; el.__html = html; } }
function updateHud() {
  if (!G.players.length) return;
  updateRes();
  const mine = G.heroes.filter((x) => x.alive && x.p === 0);
  // UI: faction accent colour, and the End day button glows once no hero can take another step
  document.body.style.setProperty('--fac', FACTIONS[G.players[0].fac]?.css || '#3a7aff');
  const canStep = (x) => NBR[x.v].some((n) => passable(n) && stepCost(x.v, n) <= x.mp);
  $('b-end').classList.toggle('ready', G.mode === 'map' && !mine.some(canStep));
  setHTML($('heroes'), mine.map((hr) => `<button class="hb ${hr.id === G.selHero ? 'on' : ''}${canStep(hr) ? '' : ' spent'}" data-h="${hr.id}" aria-label="${hr.name}"><span class="hb-ic">${heroPic(hr, 40, 'round') || icon('hero', 30)}</span><b>${hr.name.split(' ').pop()}</b><i class="lvb">${hr.lvl}</i><span class="mp"><i style="width:${clamp((hr.mp / moveMax(hr)) * 100, 0, 100)}%"></i></span></button>`).join('') +
    G.towns.filter((t) => t.p === 0).map((t) => `<button class="hb town" data-t="${t.id}" aria-label="${t.name}"><span class="hb-ic">${icon('town', 28)}</span><b>${t.name}</b>${!t.builtToday ? `<em title="Can build today">${icon('build', 13)}</em>` : ''}</button>`).join(''));
  const hr = selHero();
  setHTML($('sel'), hr ? `<span class="sel-who"><span class="sel-pt">${heroPic(hr, 40, 'round') || icon('hero', 24)}<i class="lv">${hr.lvl}</i></span><b>${hr.name}</b></span><span class="st2">${icon('movement', 16)}${fmt(hr.mp)}</span><span class="st2">${icon('mana', 16)}${hr.mana}</span><span class="army">${heroArmy(hr).map(([id, n]) => `<span>${unitIcon(id)}<em>${n}</em></span>`).join('')}</span>${hr.route && canStep(hr) ? '<button class="sel-go" id="b-go" aria-label="Continue the march">Continue ▶</button>' : ''}` : '');
}
// side buttons: tap = select hero / open hero sheet / open town; double tap = fly the camera there
let sideTap = null;
$('heroes').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || busy()) return;
  const key = b.dataset.h ? 'h' + b.dataset.h : 't' + b.dataset.t, now = performance.now();
  if (sideTap && sideTap.key === key && now - sideTap.t < 320) {
    clearTimeout(sideTap.timer); sideTap = null;
    if (b.dataset.h) { const id = +b.dataset.h; if (G.selHero !== id) selectHero(id); flyTo(G.heroes[id].v, 7.5); }
    else flyTo(G.towns[+b.dataset.t].v, 7.5);
    sfx.click(); return;
  }
  if (sideTap) clearTimeout(sideTap.timer);
  const single = () => {
    sideTap = null;
    if (busy()) return; // End Day (or a walk) started during the 300 ms double-tap window
    if (b.dataset.h) { const id = +b.dataset.h; if (G.selHero === id) openHero(); else selectHero(id); }
    if (b.dataset.t) openTown(+b.dataset.t);
  };
  // selecting a different hero is instant (it flies there anyway); actions that open a panel wait for a possible 2nd tap
  if (b.dataset.h && G.selHero !== +b.dataset.h) { single(); sideTap = { key, t: now, timer: 0 }; return; }
  sideTap = { key, t: now, timer: setTimeout(single, 300) };
});
$('b-hero').addEventListener('click', () => { if (!busy()) openHero(); });
$('sel').addEventListener('click', (e) => { if (e.target.closest('#b-go')) { resumeRoute(selHero()); sfx.click(); } });
let endConfirmT = 0;
$('b-end').addEventListener('click', () => {
  if (busy() || G.over) return;
  // only heroes that can actually afford a step into some neighbouring hex
  const left = G.heroes.filter((x) => x.alive && x.p === 0 && NBR[x.v].some((n) => passable(n) && stepCost(x.v, n) <= x.mp));
  // (one live timer: a stale timeout from an earlier day must not cancel today's "tap again")
  if (left.length && !$('b-end').classList.contains('confirm')) { $('b-end').classList.add('confirm'); const marching = left.filter((x) => x.route).length; toast(`${left.length} hero${left.length > 1 ? 'es' : ''} can still move${marching ? ` (${marching === 1 && left.length === 1 ? 'a march is' : `${marching} with a march`} unfinished)` : ''}. Tap again to end the day.`); clearTimeout(endConfirmT); endConfirmT = setTimeout(() => $('b-end').classList.remove('confirm'), 2500); return; }
  clearTimeout(endConfirmT); $('b-end').classList.remove('confirm');
  endTurn();
});
$('b-menu').addEventListener('click', () => { if (busy() && G.mode !== 'map') return; ask('Menu', `<div class="menu-brand">${icon('logo', 76)}<b>ORBIS</b><small>Five Crowns · v${APP_VERSION}</small></div><p>Day ${((G.day - 1) % 7) + 1} of week ${week()}. Your game is saved every morning.</p>`, [['Resume', null], [`${icon('save', 20)} Save & quit to title`, () => { save(); showMenu(); }], [`${icon('music', 20)} Music: ${store.get('realms.music', true) ? 'on' : 'off'}`, () => { store.set('realms.music', !store.get('realms.music', true)); if (store.get('realms.music', true)) score?.start(); else score?.stop(); }]]); });

// ------------------------------------------------------------------ days and weeks
function endTurn() {
  if (G.mode !== 'map' || aiRunning || walking || G.over) return;
  showPath(selHero(), null);
  aiRunning = true; aiGen = runAI(); aiDelay = 0; $('b-end').disabled = true;
  toast('⏳ The enemy is moving…');
  // tomorrow starts a new week: choose its creature now and paint its portrait while the enemy moves,
  // so the "Week of …" card does not render a 3D portrait in the same frame as the new morning
  if (G.day % 7 === 0) {
    const all = Object.values(FACTIONS).flatMap((f) => f.units);
    G.nextWeekOf = all[(rnd() * all.length) | 0];
    try { preloadPortraits([G.nextWeekOf], 64); } catch { /* the card renders it on demand */ }
  }
}
let aiRunning = false, aiGen = null, aiDelay = 0;
// drop an enemy turn in progress (quit to the title, game over, a new game): a stale generator must never
// keep running against the next game, nor leave End Day disabled
function stopAI() {
  aiRunning = false; aiGen = null; aiDelay = 0;
  $('b-end').disabled = false; $('b-end').classList.remove('confirm');
}
function tickAI(dt) {
  if (!aiRunning) return;
  if (G.over || !aiGen) { stopAI(); return; }
  if (G.mode !== 'map' || dialogOpen() || walking) return;
  if ((aiDelay -= dt) > 0) return;
  let r;
  // a bug in one enemy move must not freeze the game with End Day disabled: skip the rest of the enemy turn
  try { r = aiGen.next(); } catch (e) { console.error('AI turn aborted', e); r = { done: true }; }
  aiDelay = r.value || 0.05;
  if (r.done) { stopAI(); if (!G.over) newDay(); }
}
function newDay() {
  G.day++;
  const newWeek = (G.day - 1) % 7 === 0;
  for (const Pl of G.players) {
    if (!Pl.alive) continue;
    let gold = 0; const res = { wood: 0, ore: 0, gems: 0 };
    for (const t of G.towns) if (t.p === Pl.i) gold += townIncome(t);
    for (const o of G.objects) if (o.alive && o.owner === Pl.i) { const O = OBJECTS[o.type]; if (O.res === 'gold') gold += O.amount; else res[O.res] += O.amount; }
    for (const hr of G.heroes) if (hr.alive && hr.p === Pl.i) gold += 250 * (hr.skills.estates || 0);
    Pl.res.gold += gold; for (const k of Object.keys(res)) Pl.res[k] += res[k];
    if (Pl.i === 0 && G.day > 1) floatText(null, `+${fmt(gold)} 🪙${res.wood ? ` +${res.wood} 🪵` : ''}${res.ore ? ` +${res.ore} 🪨` : ''}${res.gems ? ` +${res.gems} 💎` : ''}`, 'gold');
  }
  for (const hr of G.heroes) if (hr.alive) { hr.mp = moveMax(hr); hr.mana = Math.min(maxMana(hr), hr.mana + 1 + Math.floor(statOf(hr, 'know') / 3)); }
  for (const t of G.towns) t.builtToday = false;
  if (newWeek) {
    // each week honours a creature: +5 growth in every town that breeds it
    const all = Object.values(FACTIONS).flatMap((f) => f.units), star = UNITS[G.nextWeekOf] ? G.nextWeekOf : all[(rnd() * all.length) | 0];
    G.weekOf = star; G.nextWeekOf = null;
    for (const t of G.towns) for (const b of BUILDINGS) if (b.tier && !b.up && t.built.includes(b.id)) { const base = FACTIONS[t.fac].units[b.tier - 1]; t.avail[b.tier] = (t.avail[b.tier] || 0) + Math.ceil(UNITS[base].grow * (t.built.includes('fort') ? 1.5 : 1)) + (base === star ? 5 : 0); }
    for (const o of G.objects) if (o.alive && o.type === 'monster') o.n = Math.ceil(o.n * 1.08);
    for (const o of G.objects) if (o.alive && o.type === 'dwelling') o.stock = Math.max(o.stock, 4 + ((rnd() * 4) | 0));
    showMsg(`📅 Week ${week()}: Week of the ${UNITS[G.weekOf].name}`, `${unitIcon(G.weekOf)} ${plural(G.weekOf)} grow by +5 this week. Creatures in your dwellings have multiplied: visit your town to recruit them.`);
  }
  revealAll(); updateHud(); saveSoon();
  const hr = selHero() || G.heroes.find((x) => x.alive && x.p === 0);
  if (hr) selectHero(hr.id);
  if (G.day % 7 === 1) sfx.week(); else sfx.day();
}
function checkEnd() {
  if (G.over) return;
  for (const Pl of G.players) {
    const has = G.towns.some((t) => t.p === Pl.i) || G.heroes.some((x) => x.alive && x.p === Pl.i);
    if (Pl.alive && !has) { Pl.alive = false; if (Pl.i !== 0) toast(`☠️ ${Pl.name} is defeated!`); }
  }
  if (!G.players[0].alive) endGame(false);
  else if (G.players.every((Pl) => Pl.i === 0 || !Pl.alive)) endGame(true);
}
function endGame(won) {
  G.over = true; store.del('realms.save');
  const me = G.players[0], towns = G.towns.filter((t) => t.p === 0).length, heroes = G.heroes.filter((h) => h.alive && h.p === 0);
  const army = heroes.reduce((a, h) => a + heroArmy(h).reduce((x, st) => x + st[1], 0), 0), top = heroes.reduce((a, h) => Math.max(a, h.lvl), 0);
  const body = `<div class="endcard ${won ? 'win' : 'lose'}"><div class="crest2">${icon(won ? 'victory' : 'defeat', 84)}</div>
    <p>${won ? `After <b>${G.day}</b> ${G.day === 1 ? 'day' : 'days'} the whole world is yours. Every rival bows before ${FACTIONS[me.fac].name}.` : 'Your last town and hero are lost. Your crown falls into shadow.'}</p>
    <div class="endstats"><div><b>${G.day}</b><small>Days</small></div><div><b>${towns}</b><small>Towns</small></div><div><b>${fmt(army)}</b><small>Creatures</small></div><div><b>${top || '–'}</b><small>Top level</small></div></div></div>`;
  ask(won ? 'Victory!' : 'Defeat', body, [['Play again', () => showMenu()]], true);
  if (won) for (let i = 0; i < 40; i++) setTimeout(() => { const c = document.createElement('i'); c.className = 'confetti'; c.style.left = `${Math.random() * 100}vw`; c.style.background = `hsl(${Math.random() * 360} 90% 60%)`; c.style.animationDuration = `${1.8 + Math.random() * 1.6}s`; document.body.appendChild(c); setTimeout(() => c.remove(), 4000); }, i * 40);
  won ? sfx.victory() : sfx.defeat(); musicScene(won ? 'victory' : 'defeat');
}

// ------------------------------------------------------------------ the computer lords
function aiVisitTown(hr, t) {
  // take the garrison along, keeping the strongest stacks together
  for (let i = 0; i < t.garrison.length; i++) { const s = t.garrison[i]; if (s && s[1] > 0 && addTroops(hr.army, s[0], s[1])) t.garrison[i] = null; }
  t.garrison = t.garrison.filter(Boolean);
  // upgrade what the town allows
  for (const st of hr.army) {
    if (!st || UNITS[st[0]].up || UNITS[st[0]].fac !== t.fac) continue;
    const tier = UNITS[st[0]].tier, upId = UPGRADES[t.fac][tier - 1];
    if (!t.built.includes(`u${tier}`)) continue;
    const cost = Object.fromEntries(RES.map((r) => [r, Math.max(0, (UNITS[upId].cost[r] || 0) - (UNITS[st[0]].cost[r] || 0))]));
    if (canPay(t.p, cost, st[1])) { pay(t.p, cost, st[1]); st[0] = upId; }
  }
  learnSpells(t, hr);
}
function aiTown(t) {
  const order = ['d2', 'd3', 'fort', 'd4', 'hall2', 'mage1', 'd5', 'u1', 'tavern', 'd6', 'u2', 'u3', 'market', 'hall3', 'u4', 'mage2', 'd7', 'u5', 'u6', 'mage3', 'u7'];
  for (const id of order) if (buildIn(t, id)) break;
  for (let tier = 7; tier >= 1; tier--) {
    if (!t.built.includes(`d${tier}`) || !(t.avail[tier] > 0)) continue;
    const id = tierUnit(t, tier), u = UNITS[id], Pl = G.players[t.p];
    const n = Math.min(t.avail[tier], ...RES.filter((r) => u.cost[r]).map((r) => Math.floor(Pl.res[r] / u.cost[r])));
    if (n > 0 && addTroops(t.garrison, id, n)) { pay(t.p, u.cost, n); t.avail[tier] -= n; }
  }
  const vis = visitorOf(t); if (vis) aiVisitTown(vis, t);
  // a second hero once the town can afford one
  const heroes = G.heroes.filter((x) => x.alive && x.p === t.p).length;
  if (t.built.includes('tavern') && heroes < 2 + (G.diff === 2 ? 1 : 0) && G.players[t.p].res.gold > 5000 && G.day > 6) {
    const v = NBR[t.v].find((x) => passable(x) && !heroAt(x) && objAt[x] < 0);
    if (v !== undefined) {
      pay(t.p, { gold: 2500 });
      const used = G.heroes.map((x) => x.name), hr = newHero(t.p, v, FACTIONS[t.fac].heroes.find((n) => !used.includes(n)) || 'Captain');
      const us = FACTIONS[t.fac].units; hr.army = [[us[0], 14], [us[1], 5]]; hr.mp = moveMax(hr); hr.mana = maxMana(hr);
      if (t.fac === 'necro') hr.skills.necromancy = 1;
      G.heroes.push(hr); aiVisitTown(hr, t);
    }
  }
}
// cheapest cost to every cell (objects and heroes are targets, not roads)
// a binary min-heap of (cost, cell) pairs: the AI and the path finder used to scan the whole open list on every pop,
// an O(n²) walk over the planet (thousands of cells) that showed up as long main-thread tasks on End Day
function minHeap() {
  const D = [], V = [];
  return {
    get size() { return D.length; },
    push(d, v) {
      let i = D.length; D.push(d); V.push(v);
      while (i > 0) { const p = (i - 1) >> 1; if (D[p] <= d) break; D[i] = D[p]; V[i] = V[p]; i = p; }
      D[i] = d; V[i] = v;
    },
    // returns the cell; the cost of the popped entry is left in .d
    pop() {
      const v0 = V[0], d0 = D[0], d = D.pop(), v = V.pop(), n = D.length;
      if (n) {
        let i = 0;
        for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && D[c + 1] < D[c]) c++; if (D[c] >= d) break; D[i] = D[c]; V[i] = V[c]; i = c; }
        D[i] = d; V[i] = v;
      }
      this.d = d0; return v0;
    },
    d: 0,
  };
}
function dijkstra(hr, maxCost) {
  const dist = new Map([[hr.v, 0]]), prev = new Map(), heap = minHeap();
  // where the other heroes stand, looked up once instead of a G.heroes scan per cell
  const others = new Set(); for (const x of G.heroes) if (x.alive && x !== hr) others.add(x.v);
  heap.push(0, hr.v);
  while (heap.size) {
    const v = heap.pop(), d = heap.d;
    if (d > (dist.get(v) ?? Infinity) || d > maxCost) continue;
    if (v !== hr.v && (objAt[v] >= 0 && G.objects[objAt[v]].alive || others.has(v))) continue;
    for (const n of NBR[v]) {
      if (!passable(n)) continue;
      const blockedTarget = (objAt[n] >= 0 && G.objects[objAt[n]].alive) || others.has(n);
      const nd = d + stepCost(v, n) + (!blockedTarget && zoc(n) ? 3000 : 0);
      if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, v); heap.push(nd, n); }
    }
  }
  return { dist, prev };
}
function aiValue(hr, v, power) {
  const o = objAt[v] >= 0 && G.objects[objAt[v]].alive ? G.objects[objAt[v]] : null;
  const other = heroAt(v);
  if (other && other !== hr) { if (other.p === hr.p) return 0; const theirs = BT.armyPower(heroArmy(other), other); return power > theirs * 1.3 ? 70 + theirs / 100 : 0; }
  if (!o) return 0;
  const O = OBJECTS[o.type], kind = O?.kind;
  if (o.type !== 'monster') { const g = NBR[v].map((n) => (objAt[n] >= 0 ? G.objects[objAt[n]] : null)).find((x) => x && x.alive && x.type === 'monster'); if (g && power < BT.armyPower([[g.unit, g.n]]) * 1.6) return 0; }
  if (o.type === 'monster') { const mp = BT.armyPower([[o.unit, o.n]]); if (power < mp * 1.6) return 0; return 6 + mp / 150 + (o.guards !== undefined ? 10 : 0); }
  if (o.type === 'town') {
    const t = G.towns[o.t];
    if (t.p === hr.p) return heroArmy({ army: t.garrison }).length ? 12 + BT.armyPower(t.garrison) / 120 : 0;
    const gp = BT.armyPower(t.garrison) * (t.built.includes('fort') ? 1.3 : 1);
    if (t.p === 0 && G.day < [12, 8, 5][G.diff]) return 0;
    return power > gp * 1.4 ? (t.p === 0 ? 120 : 70) : 0;
  }
  if (kind === 'pickup') return o.type === 'gold' ? o.amount / 80 : o.type === 'chest' ? 14 : o.type === 'artifact' ? 25 : o.type === 'campfire' ? 9 : 7;
  if (kind === 'mine') return o.owner === hr.p ? 0 : (O.res === 'gold' ? 45 : 22) + (o.owner === 0 ? 10 : 0);
  if (kind === 'visit') return hr.visited.includes(`o${o.id}`) || o.type === 'obelisk' ? 0 : o.type === 'shrine' && SPELLS[o.spell].circle === 3 && !(hr.skills.wisdom >= 2) ? 0 : 16;
  if (kind === 'weekly') return hr.visited.includes(`w${o.id}:${week()}`) ? 0 : o.type === 'well' ? (hr.mana < maxMana(hr) * 0.6 ? 8 : 0) : 7;
  if (kind === 'dwelling') return o.stock > 0 && G.players[hr.p].res.gold > UNITS[o.unit].cost.gold * 3 ? 10 : 0;
  return 0;
}
function* aiHero(hr) {
  for (let iter = 0; iter < 16 && hr.alive && hr.mp >= 50 && !G.over; iter++) {
    const power = BT.armyPower(heroArmy(hr), hr);
    const { dist, prev } = dijkstra(hr, hr.mp + 4500);
    // a stronger enemy hero close by: run home to the garrison
    const threat = G.heroes.find((x) => x.alive && x.p !== hr.p && DIRS[x.v].distanceTo(DIRS[hr.v]) < 1.2 && BT.armyPower(heroArmy(x), x) > power * 1.25);
    let best = null, bs = 0;
    for (const [v, d] of dist) {
      if (v === hr.v) continue;
      let val = aiValue(hr, v, power);
      if (threat) { const o = objAt[v] >= 0 ? G.objects[objAt[v]] : null; if (o && o.type === 'town' && G.towns[o.t].p === hr.p) val += 150; else if (DIRS[v].distanceTo(DIRS[threat.v]) < 0.5) val *= 0.2; }
      if (val <= 0) continue;
      const sc = val / (1 + d / 900); if (sc > bs) { bs = sc; best = v; }
    }
    if (best === null) return;
    const path = [best]; while (prev.has(path[0])) path.unshift(prev.get(path[0]));
    // walk as far as today allows, then bump into the target
    let moved = false, flow = false; // flow: the previous shown step runs straight into this one
    for (let i = 1; i < path.length; i++) {
      const last = i === path.length - 1, from = hr.v;
      if (last) {
        // in sight: lunge at the target (or step onto a pickup) before the interaction, like the player's hero
        if ((seen[from] || seen[path[i]]) && heroMeshes.has(hr.id)) {
          yield* aiShow(hr, path[i]);
          hr.anim = walksOnto(path[i], hr) ? { from, to: path[i], t: 0, s0: flow ? 1 : 0, s1: 0 } : { from, to: path[i], t: 0, bump: true, v0: flow ? 1 : 0 };
          while (hr.anim.t < 1 && heroMeshes.has(hr.id)) yield 0.001;
          hr.anim = null;
        }
        interact(hr, path[i]); hr.mp = Math.max(0, hr.mp - 50); moved = true; break;
      }
      const c = stepCost(path[i - 1], path[i]);
      if (hr.mp < c) { hr.mp = 0; break; }
      // in sight: walk it step by step so the player watches the enemy move
      const shown = !!(seen[from] || seen[path[i]]);
      if (shown) yield* aiShow(hr, path[i]); // (before hr.v changes, so a relayout during the pause can't pop the mesh ahead)
      hr.mp -= c; hr.v = path[i]; moved = true;
      if (shown) {
        const nx = path[i + 1];
        const goesOn = nx !== undefined && (i + 1 === path.length - 1 || hr.mp >= stepCost(hr.v, nx)) && !!(seen[hr.v] || seen[nx]);
        hr.anim = { from, to: hr.v, t: 0, s0: flow ? 1 : 0, s1: goesOn ? 1 : 0 }; layoutHeroes(true);
        while (hr.anim.t < 1 && heroMeshes.has(hr.id)) yield 0.001;
        hr.anim = null; layoutHeroes(true);
        flow = goesOn;
        if (cam.fly === false && DIRS[hr.v].distanceTo(lookDir()) > 0.25) flyTo(hr.v, cam.tDist);
      } else flow = false;
    }
    layoutHeroes(true);
    if (!moved) return;
    yield seen[hr.v] ? 0.35 : 0.02;
    if (G.mode === 'battle') yield 0.1;
  }
}
let aiWatch = false;
const AI_STEP_T = 0.42;
// the first time an enemy shows up on the move, fly the camera there and say so
function* aiShow(hr, v) {
  if (aiWatch) return;
  aiWatch = true; flyTo(v, Math.max(cam.tDist, 9)); toast(`👁️ ${hr.name} (${G.players[hr.p].name}) is on the move`); yield 0.6;
}
const lookDir = () => new THREE.Vector3().setFromSphericalCoords(1, cam.phi, cam.theta);
function* runAI() {
  aiWatch = false;
  for (const Pl of G.players) {
    if (G.over) return;
    if (!Pl.ai || !Pl.alive) continue;
    for (const t of G.towns) if (t.p === Pl.i) aiTown(t);
    yield 0.02; // towns and heroes in separate frames
    for (const hr of G.heroes.filter((x) => x.alive && x.p === Pl.i)) {
      if (G.over) return;
      if (!hr.alive) continue;
      // grab the garrison when standing next to home
      for (const t of G.towns) if (t.p === Pl.i && NBR[t.v].includes(hr.v)) aiVisitTown(hr, t);
      yield* aiHero(hr);
      while (G.mode === 'battle' || dialogOpen()) yield 0.2;
    }
  }
}

// ------------------------------------------------------------------ save and load
const pack = (a, off = 48) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i] + off); return s; };
const unpack = (s, a, off = 48) => { for (let i = 0; i < a.length; i++) a[i] = s.charCodeAt(i) - off; };
function save() {
  if (G.over || !G.players.length) return;
  store.set('realms.save', { v: 1, ver: APP_VERSION, seed: G.seed, day: G.day, diff: G.diff, selHero: G.selHero, players: G.players, heroes: G.heroes, towns: G.towns, objects: G.objects, ter: pack(ter), h: pack(h), road: pack(road), seen: pack(seen) });
}
// the morning save serialises the whole world (~100 KB of JSON): run it when the browser is idle,
// not in the same frame as the new day's income, growth, HUD and camera work
let saveQ = 0;
function saveSoon() {
  if (saveQ) return;
  const run = () => { saveQ = 0; save(); };
  saveQ = window.requestIdleCallback ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 200);
}
function load() {
  const s = store.get('realms.save', null);
  if (!s || s.v !== 1) return false;
  Object.assign(G, { seed: s.seed, day: s.day, diff: s.diff, selHero: s.selHero, players: s.players, heroes: s.heroes, towns: s.towns, objects: s.objects, over: false, mode: 'map' });
  unpack(s.ter, ter); unpack(s.h, h); unpack(s.road, road); unpack(s.seen, seen);
  objAt.fill(-1); for (const o of G.objects) if (o.alive) objAt[o.v] = o.id;
  for (const hr of G.heroes) hr.anim = null; // saved mid-step during an enemy turn
  rnd = mulberry32(s.seed + s.day * 977);
  return true;
}

// ------------------------------------------------------------------ sound
let actx = null, score = null, sfxEngine = null;
// sound: sampled orchestra (music.js) and magical effects (sfx.js); legacy sfx.name() calls keep working
const sfx = new Proxy({}, { get: (_, n) => (o) => { if (sfxEngine && store.get('realms.sfx', true)) { try { sfxEngine.play(n, o); } catch (e) { /* never break the game for a sound */ } } } });
function audio() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const sfxBus = actx.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(actx.destination);
    sfxEngine = createSfx(actx, sfxBus);
    const mus = actx.createGain(); mus.gain.value = 0.5; mus.connect(actx.destination);
    score = createScore(actx, mus); musicScene();
    if (store.get('realms.music', true)) score.start();
  } catch { actx = null; }
}
// which piece fits what is on screen now
function musicScene(over) {
  if (!score) return;
  const fac = G.players?.[0]?.fac || store.get('realms.fac', 'haven');
  const town = townOpen != null ? G.towns[townOpen]?.fac : null;
  const sc = over || ($('menu') && !$('menu').hidden ? 'menu' : G.mode === 'battle' ? 'battle' : G.mode === 'town' ? 'town' : 'map');
  score.setScene(sc, sc === 'town' && town ? town : fac);
}
window.addEventListener('pointerdown', () => { audio(); if (actx?.state === 'suspended') actx.resume(); }, { capture: true });

// ------------------------------------------------------------------ menu
function showMenu() {
  G.mode = 'menu'; dialogs.length = 0; renderDialog();
  stopAI(); walking = null; // a quit mid enemy turn / mid walk must not carry over into the next game
  $('menu').hidden = false; $('hud').hidden = true; $('town').hidden = true; $('battle').hidden = true; musicScene('menu');
  const s = store.get('realms.save', null);
  $('m-continue').hidden = !s;
  if (s) $('m-continue').innerHTML = `Continue<small>${s.players?.[0] ? `${FACTIONS[s.players[0].fac]?.name || ''} · ` : ''}Week ${Math.floor((s.day - 1) / 7) + 1}, day ${((s.day - 1) % 7) + 1}</small>`;
  syncSound();
  for (const m of heroMeshes.values()) scene.remove(m); heroMeshes.clear();
}
for (const b of document.querySelectorAll('#menu .diffs button')) b.addEventListener('click', () => { store.set('realms.diff', +b.dataset.d); for (const x of document.querySelectorAll('#menu .diffs button')) x.classList.toggle('on', x === b); sfx.click(); });
for (const x of document.querySelectorAll('#menu .diffs button')) x.classList.toggle('on', +x.dataset.d === store.get('realms.diff', 1));
// title-screen music toggle (the same setting as the in-game menu)
function syncSound() { const on = store.get('realms.music', true); $('m-sound').classList.toggle('off', !on); $('m-sound').querySelector('span').textContent = on ? 'Music on' : 'Music off'; }
$('m-sound').addEventListener('click', () => { const on = !store.get('realms.music', true); store.set('realms.music', on); if (on) score?.start(); else score?.stop(); syncSound(); sfx.click(); });
function play() {
  if (!prewarmed) { prewarmed = true; $('menu').hidden = true; G.mode = 'map'; worldDirty = true; layoutWorld(); prewarm(() => { play(); warmGeometryIdle(); }); return; }
  $('menu').hidden = true; $('hud').hidden = false; G.mode = 'map'; musicScene('map');
  stopAI(); walking = null;
  worldDirty = true; layoutWorld();
  const hr = selHero() || G.heroes.find((x) => x.alive && x.p === 0);
  if (hr) { G.selHero = hr.id; const sp = new THREE.Spherical().setFromVector3(DIRS[hr.v]); camSnap(sp.theta, sp.phi); cam.dist = 20; cam.sDist = 0; cam.tDist = 10; flyTo(hr.v, 10); }
  updateHud();
}
$('m-new').addEventListener('click', () => {
  // an in-game confirmation instead of the browser's confirm() box
  if (store.get('realms.save', null)) { ask('Start a new game?', '<p>Your saved game will be replaced when the new one begins.</p>', [['Start a new game', () => pickFaction()], ['Keep my game', null]]); sfx.click(); return; }
  pickFaction();
});
// faction choice: one card per faction with its crest, colour, creature line-up, description and signature skill and spell.
// Tap a card to select it; tap the selected card again (or the Begin button) to start.
const FAC_CREST = { haven: 'defense', necro: 'necromancy', sylvan: 'luck', inferno: 'fireball', dungeon: 'sorcery' };
function pickFaction() {
  const el = $('factions');
  let sel = FACTIONS[store.get('realms.fac', 'haven')] ? store.get('realms.fac', 'haven') : 'haven';
  const diff = ['Easy', 'Normal', 'Hard'][store.get('realms.diff', 1)] || 'Normal';
  el.innerHTML = `<div class="fp"><header class="fp-head">${icon('logo', 44)}<div><small>New game · ${diff}</small><h2>Choose your crown</h2></div></header><div class="fcards">${Object.entries(FACTIONS).map(([k, f]) => {
    const kit = FACTION_START[k] || FACTION_START.haven;
    return `<button class="fcard${k === sel ? ' on' : ''}" data-f="${k}" style="--fc:${f.css}" aria-pressed="${k === sel}">
    <span class="fc-crest">${icon(FAC_CREST[k] || 'banner', 30)}</span>
    <span class="fc-body"><b class="fc-name">${f.name}</b><small class="fc-desc">${f.desc || ''}</small>
    <span class="fc-sig"><em>Signature</em><span>${icon(kit.skill, 16)}${SKILLS[kit.skill]?.name || ''}</span><span>${icon(kit.spell, 16)}${SPELLS[kit.spell]?.name || ''}</span></span></span>
    <span class="fu">${[0, 3, 6].map((i) => unitIcon(f.units[i], 64)).join('')}</span><span class="fc-check">${icon('check', 16)}</span></button>`;
  }).join('')}</div>
    <footer class="fp-foot"><button class="btn ghost" id="f-back">Back</button><button class="btn gold" id="f-go">Begin as ${FACTIONS[sel].name}</button></footer></div>`;
  el.hidden = false; el.scrollTop = 0; document.body.style.setProperty('--fac', FACTIONS[sel].css);
  const start = (fac) => {
    store.set('realms.fac', fac); el.hidden = true; sfx.click();
    newWorld((Date.now() % 100000) + 1, store.get('realms.diff', 1), fac);
    play(); save();
    const rival = FACTIONS[G.players[1].fac].name;
    setTimeout(() => ask(`${icon('logo', 26)} Your crown`, `<p>You lead the <b style="color:${FACTIONS[fac].css}">${FACTIONS[fac].name}</b>. Defeat the <b style="color:${FACTIONS[G.players[1].fac].css}">${rival}</b> crown to rule the world.</p>
      <ul class="tips"><li>${icon('movement', 22)}<span><b>Tap a hex</b> to plan a route, tap it again to march.</span></li><li>${icon('gold', 22)}<span><b>Flag mines</b> and pick up treasure for income.</span></li><li>${icon('town', 22)}<span><b>Tap your town</b> to build once a day and recruit.</span></li><li>${icon('hero', 22)}<span><b>Tap your hero</b> for the hero sheet. Double-tap either to fly there.</span></li><li>${icon('end', 22)}<span><b>End the day</b> when everyone has moved.</span></li></ul>`, [['Begin', null]], true), 600);
  };
  el.querySelectorAll('.fcard').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.f === sel) { start(sel); return; }
    sel = b.dataset.f; sfx.click();
    el.querySelectorAll('.fcard').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    $('f-go').textContent = `Begin as ${FACTIONS[sel].name}`; document.body.style.setProperty('--fac', FACTIONS[sel].css);
  }));
  $('f-go').addEventListener('click', () => start(sel));
  $('f-back').addEventListener('click', () => { el.hidden = true; });
}
$('m-continue').addEventListener('click', () => { if (load()) play(); });

// ------------------------------------------------------------------ the loop
const clock = new THREE.Clock();
let tt = 0;
const loaderEl = document.getElementById('loader');
// ---- map shadows: shadowMap.autoUpdate is off. The view-following sun moves with the camera, so a moving view
// (or a walking hero, a rebuilt world, a zoom rescale) re-renders the shadow map every frame; a still map only
// refreshes it at ~15 Hz (every 2nd-4th frame) for the heroes' gentle shader idle. Battle and town always update.
const shSun = new THREE.Vector3(), shTgt = new THREE.Vector3();
let shAge = 1, shFr = 9, shMode = '', shKid = null, shN = -1, shFlora = null, shFig = 0;
function mapShadowsDue(dt) {
  shAge += dt; shFr++;
  // idle refresh: ~15 Hz, and at most every other frame on a slow device (where it matters most)
  let due = G.mode !== shMode || (shAge >= 1 / 15 && shFr >= 2) || shFr >= 4 || !!walking || figK !== shFig
    || world.children.length !== shN || world.children[0] !== shKid || flora.children[0] !== shFlora
    || shSun.distanceToSquared(sun.position) > 1e-12 || shTgt.distanceToSquared(sun.target.position) > 1e-12;
  if (!due) for (const h of G.heroes) if (h.anim) { due = true; break; }
  if (!due) return false;
  shMode = G.mode; shAge = 0; shFr = 0; shFig = figK; shN = world.children.length; shKid = world.children[0]; shFlora = flora.children[0];
  shSun.copy(sun.position); shTgt.copy(sun.target.position);
  return true;
}
// ---- back-of-planet culling: map figures beyond the horizon are hidden by the planet anyway, but frustum culling
// keeps them (they sit inside the view cone), so each would still cost its body + ink hull + glow + blob draws.
// Visible cone = the horizon angle seen from the camera + how far a figure up to ~1.5 above the surface peeks over it.
// Only objects this code hid are ever un-hidden (userData.hzCull), so other code may still hide figures itself.
const hzDir = new THREE.Vector3();
function hzOne(g, lim) {
  const p = g.position, back = p.x * hzDir.x + p.y * hzDir.y + p.z * hzDir.z < lim * p.length();
  if (back) { if (g.visible) { g.visible = false; g.userData.hzCull = true; } }
  else if (g.userData.hzCull) { g.visible = true; g.userData.hzCull = false; }
}
function horizonCull() {
  const d = camera.position.length();
  hzDir.copy(camera.position).divideScalar(d);
  const lim = Math.cos(Math.min(Math.PI, Math.acos(Math.min(1, R / d)) + 0.7));
  for (const g of world.children) hzOne(g, lim);
  for (const g of heroMeshes.values()) hzOne(g, lim);
}
function frame(now) {
  // schedule the next frame first: an exception anywhere below (a bad battle setup, an AI move) then costs one
  // frame instead of silently killing the loop and freezing the whole game
  requestAnimationFrame(frame);
  // nothing to draw behind the loading screen: give its time to the warm-up jobs
  if (!loaderEl.hidden && !loaderEl.classList.contains('done')) { clock.getDelta(); return; }
  QG.sample(typeof now === 'number' ? now : performance.now());
  const dt = Math.min(0.05, clock.getDelta());
  tt += dt;
  tickMaterials(tt);
  // ink outlines thin out and soften as the map zooms out, so far views don't turn into uniform dark chips
  const iu = inkMat.userData.uniforms, zk = G.mode === 'battle' ? 1 : clamp((19 - cam.dist) / 8, 0.3, 1);
  iu.uHullW.value = 0.003 * zk; iu.uHullDark.value = 0.15 + (1 - zk) * 0.45;
  if (G.mode === 'battle' && bprep) { /* the battle is being set up behind the curtain (enterBattle): nothing to draw yet */ }
  else if (G.mode === 'battle') {
    animateBattle(dt);
    const s = Math.sin(bview.yaw), c = Math.cos(bview.yaw);
    // a classic three-quarter view: low enough that creatures show their figures, not just helmets
    // never closer than what fits the full grid width on screen (portrait phones)
    const hf = Math.tan(THREE.MathUtils.degToRad(bcam.fov / 2)) * bcam.aspect, d = Math.max(bview.dist, Math.min(18, (BT.COLS * 0.866 * 0.5 + 0.45) / hf / 1.1));
    bcam.position.set(s * d * 0.82, d * 0.86, c * d * 0.82 + 0.4);
    bcam.lookAt(0, 0, -0.15);
    updatePlates();
    for (const m of bmesh.values()) if (m.userData.flash > 0) { m.userData.flash -= dt; m.children[0].material = m.userData.flash > 0 ? hitMat : bodyMat; }
    vfx.update(dt, bcam);
    renderer.shadowMap.needsUpdate = true; // battle figures always animate
    post.render(bscene, bcam);
  } else {
    updateCamera(dt);
    atmos.update(dt, camera);
    if (atmos.objects?.clouds) atmos.objects.clouds.visible = G.mode === 'menu' || cam.dist > 13;
    cam.spin = G.mode === 'menu' ? 0.09 : 0; if (G.mode === 'menu') cam.tDist = 16;
    else {
      updateWalk(dt); tickAI(dt);
      if (worldDirty) { revealAll(); layoutWorld(); }
      const hr = selHero();
      const m = hr && heroMeshes.get(hr.id);
      for (const h of G.heroes) {
        const hm = heroMeshes.get(h.id); if (!hm || !h.alive) continue;
        if (h.anim && h.p !== 0) {
          // enemy hero walking in sight: same eased step / bump / turning as the player's hero (aiHero waits for t = 1)
          const A = h.anim; A.t = Math.min(1, A.t + dt / AI_STEP_T);
          poseStep(hm, A.from, A.to, A.bump ? bumpEase(A.t, A.v0) : stepEase(A.t, A.s0, A.s1), dt);
        }
        const st = (walking && walking.hr === h) || h.anim ? ANIM.WALK : ANIM.IDLE;
        // walk → idle blends over 0.3 s so the stride settles instead of popping into the rest pose
        if (hm.userData.animState !== st) { hm.userData.animState = st; setAnim(hm, st, { seed: h.id * 2.3, fade: st === ANIM.IDLE ? 0.3 : 0.15 }); }
      }
      const nk = clamp(1 + (cam.dist - 9) * 0.045, 1, 1.4);
      if (Math.abs(nk - figK) > 0.01) {
        figK = nk;
        for (const g of [...world.children, ...heroMeshes.values()]) if (g.userData.s0) g.scale.setScalar(g.userData.s0 * (g.userData.noGrow ? 1 : figK));
      }
      fx.select(m ? m.position : null);
      fx.update(dt, camera);
      // map guards get their life from the shader idle (a moving mesh would reseed its animation every frame)
    }
    if (G.mode === 'town') { townInsets(); townView.update(dt); renderer.shadowMap.needsUpdate = true; shMode = 'town'; post.render(townView.scene, townView.camera); }
    else { horizonCull(); if (mapShadowsDue(dt)) renderer.shadowMap.needsUpdate = true; post.render(scene, camera); }
  }
  updateFloaters(dt);
}
const hitMat = makeHitMaterial(THREE);

// first boot: a world spinning behind the title
newWorld(12345, 1);
for (let v = 0; v < NV; v++) seen[v] = 1;
layoutWorld();
resize();
QG.init();
showMenu();
frame();
window.__realms = { battleReady: () => G.mode === 'battle' && !bprep && !!BB, G, BT, newWorld, findPath, startWalk, interact, startBattle, endTurn, openTown, closeTown, buildIn, save, load, play, selectHero, heroArmy, objAt, ter, seen, NBR, passable, get BB() { return BB; }, autoBattle: () => { bauto = true; }, hexScreen: (c, r) => { const v = hexPos(c, r).project(bcam); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; }, aiRunning: () => aiRunning, layoutWorld, cam, flyTo, heroMeshes, get walking() { return walking; } };
// render perf hooks: adaptive-resolution state / control, and the renderer (renderer.info for draw-call counts)
Object.assign(window.__realms, { quality: QG.state, renderer });
// battle test hooks (battle-flow logs / soft-lock runs): fast-forward the battle without rendering
Object.defineProperties(window.__realms, Object.getOwnPropertyDescriptors({ get bmesh() { return bmesh; }, get banim() { return banim; }, bstep: (dt) => { if (!bprep) { animateBattle(dt); vfx.update(dt, bcam); } } }));
// geometry cache: idle warm-up hook + stats (models, triangles, CPU-side MB of vertex data)
Object.assign(window.__realms, { warmGeometryIdle, warmQueue: () => warmQ.length, geoStats: () => { let tris = 0, bytes = 0; for (const m of geoCache.values()) for (const g of [m?.body, m?.glow]) if (g?.attributes?.position) { tris += g.attributes.position.count / 3; for (const a of Object.values(g.attributes)) bytes += a.array.byteLength; } return { models: geoCache.size, tris: Math.round(tris), mb: +(bytes / 1048576).toFixed(1) }; } });
