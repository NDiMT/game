import * as THREE from 'three';
import { mulberry32, unitModel } from './models.js?v=1.10';
import { havenModel } from './units_haven.js?v=1.10';
import { necroModel } from './units_necro.js?v=1.10';
import { necroUpModel } from './units_necro_up.js?v=1.10';
import { havenUpModel } from './units_haven_up.js?v=1.10';
import { neutralModel } from './units_neutral.js?v=1.10';
import { townModel, heroModel, flagModel } from './models_towns.js?v=1.10';
import { objectModel } from './models_objects.js?v=1.10';
import { natureModel, FLORA_FOR_TERRAIN, FOREST_BY_BIOME, PEAK_BY_BIOME, biomeOf } from './nature.js?v=1.10';
import { createBattlefield, wallModel, towerModel, gateModel, keepModel, siegeLayout } from './battlefield.js?v=1.10';
import { createTownView } from './town_view.js?v=1.10';
import { createVfx, shotKind, meleeKind } from './vfx.js?v=1.10';
import { createFlatSky, gradeGLSL } from './atmosphere.js?v=1.10';
import { UNITS, UPGRADES, FACTIONS, NEUTRALS, BUILDINGS, SPELLS, ARTIFACTS, SKILLS, OBJECTS, RES, RES_ICON, START_ARMY, FACTION_START } from './data.js?v=1.10';
// newer factions load guarded, so a missing or broken module never stops the game (it falls back to placeholders)
const [SYLm, INFm, DUNm] = await Promise.allSettled([import('./units_sylvan.js?v=1.10'), import('./units_inferno.js?v=1.10'), import('./units_dungeon.js?v=1.10')]);
// memory: build through the modules' uncached builders (base id + upgraded flag), so main.js's geoCache is the only
// owner of a creature's geometry and trimGeoCache() really frees it (the modules' own caches would pin ~11 MB per roster)
const facBuild = (mod, build, model) => (id) => { const b = mod.value?.[build], u = UNITS[id]; const m = b && u ? b(u.up || id, !!u.up) : null; return m || mod.value?.[model]?.(id) || null; };
const FAC_MODEL = { sylvan: facBuild(SYLm, 'sylvanBuild', 'sylvanModel'), inferno: facBuild(INFm, 'infernoBuild', 'infernoModel'), dungeon: facBuild(DUNm, 'dungeonBuild', 'dungeonModel') };
import * as BT from './battle.js?v=1.10';
import * as CR from './crown.js?v=1.10'; // crown: Crown Run rules and data
import { createCrownUI } from './crown_ui.js?v=1.10'; // crown: Crown Run screens
import { makeBodyMaterial, makeGlowMaterial, makeHitMaterial, makeInkHullMaterial, makeBlobShadowMaterial, blobShadowGeometry, setAnim, setRigIdle, ANIM, ANIM_IMPACT, tick as tickMaterials, addFormNormals } from './materials.js?v=1.10';
import { createScore } from './music.js?v=1.10';
import { createSfx } from './sfx.js?v=1.10';
import { unitFit, applyFit } from './unit_fit.js?v=1.10';
import { createMapFx } from './mapfx.js?v=1.10';
import { icon } from './icons.js';
import { releasePortraitModel, initPortraits, portraitImg, preloadPortraits, heroPortraitImg, portraitAsync, portraitImgLazy, hasPortrait, portraitsPending, heroPortraitId } from './portraits.js?v=1.10';

// =====================================================================
// ORBIS · Five Crowns: a pocket strategy game on a tiny hex planet.
// Five crowns, one tiny world. Lead your heroes across the world, flag
// mines, gather treasure, build your town and recruit its creatures, and
// defeat the rival crowns in turn-based battles on a hex battlefield.
// =====================================================================

const APP_VERSION = '1.10';
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

// ------------------------------------------------------------------ the world: a flat hex map (agent "flat", v2.0)
// The planet (icosphere grid, terrain.js createPlanet, atmosphere.js createAtmosphere) stays in the repo for a future
// decorative globe screen; gameplay runs on the flat grid of hexgrid.js. The abstract grid API the game uses is
// unchanged: cell ids 0..NV-1, NBR[v], posOf(v, lift), plus cellDist(a, b) (hex steps) in place of the old
// DIRS[a].distanceTo(DIRS[b]). The grid can change size per game (MAP_PRESETS S/M/L/XL): every per-cell array is
// allocated for the largest map and NBR is refilled in place, so references to them stay valid.
import { makeGrid, MAP_PRESETS, MAX_CELLS, CELL, regionsVoronoi, regionsBands, regionGates } from './hexgrid.js';
const STEP = 0.07, SEA = 3;
let GRID = makeGrid(...MAP_PRESETS.M);
let NV = GRID.N;
const NBR = GRID.NBR.slice();
const UPV = new THREE.Vector3(0, 1, 0);
// hex steps between two cells (exact): distances, the A* heuristic, AI ranges
const cellDist = (a, b) => GRID.dist(a, b);
// switch the map size (a new world / a loaded save); the terrain meshes, flora and figures rebuild on the next layout
function setGrid(size) {
  const wh = Array.isArray(size) ? size : MAP_PRESETS[size] || MAP_PRESETS.M;
  if (GRID.W === wh[0] && GRID.H === wh[1]) return false;
  GRID = makeGrid(wh[0], wh[1]); NV = GRID.N;
  NBR.length = 0; for (const a of GRID.NBR) NBR.push(a);
  if (typeof TERRAIN !== 'undefined') { TERRAIN.setGrid(GRID); landSnap.ok = false; atmos.setArea?.(GRID.bounds); }
  return true;
}
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
const ter = new Uint8Array(MAX_CELLS), h = new Int8Array(MAX_CELLS), road = new Uint8Array(MAX_CELLS), seen = new Uint8Array(MAX_CELLS);
const objAt = new Int32Array(MAX_CELLS).fill(-1);
const passable = (v) => ter[v] !== T.WATER && ter[v] !== T.MOUNT && ter[v] !== T.FOREST;
const posOf = (v, lift = 0) => new THREE.Vector3(GRID.X[v], h[v] * STEP + lift, GRID.Z[v]);
const radiusOf = (v) => h[v] * STEP; // height of a cell top (the planet's radius, kept as a name)
// map regions for Crown Run gates: markRegions({ seeds | from+bands, wall, per }) fills regionOf[v] and returns the gates
const regionOf = new Int16Array(MAX_CELLS);
function markRegions(o = {}) {
  const pass = o.walkOnly ? passable : null;
  const r = o.seeds ? regionsVoronoi(GRID, o.seeds, pass) : regionsBands(GRID, o.from ?? 0, o.bands || [12, 24, 36], pass);
  regionOf.fill(0); regionOf.set(r);
  const gates = regionGates(GRID, regionOf, passable, o.per || 1);
  if (o.wall) {
    // raise a mountain wall along every region border, except at the gates (kept walkable)
    const keep = new Set(); for (const g of gates) { keep.add(g.v); keep.add(g.u); for (const n of NBR[g.v]) keep.add(n); for (const n of NBR[g.u]) keep.add(n); }
    for (let v = 0; v < NV; v++) {
      if (keep.has(v) || ter[v] === T.WATER || objAt[v] >= 0) continue;
      if (NBR[v].some((n) => regionOf[n] > regionOf[v])) { ter[v] = T.MOUNT; h[v] = SEA + 4; }
    }
    worldDirty = true;
  }
  return gates;
}

// 2D wave noise over the map (same waves as the planet's, in world units)
function noise2(seed) {
  const r = mulberry32(seed), waves = [];
  for (let i = 0; i < 9; i++) { const a = r() * 6.283, z = r() * 2 - 1; waves.push({ dx: Math.cos(a), dz: Math.sin(a), f: (1.5 + r() * 3.5 * (1 + i * 0.3)) / 5.2 * (0.75 + Math.abs(z) * 0.5), p: r() * 6.28, a: 1 / (1 + i * 0.6) }); }
  return (v) => { let s = 0, t = 0; const x = GRID.X[v], z = GRID.Z[v]; for (const w of waves) { s += Math.sin((x * w.dx + z * w.dz) * w.f + w.p) * w.a; t += w.a; } return s / t; };
}
// opts: { size: 'S'|'M'|'L'|'XL'|[w, h], players } (freeplay passes the size; players is a hint, unused for now)
function generate(seed, opts = {}) {
  if (opts.size) setGrid(opts.size);
  const elev = noise2(seed), moist = noise2(seed + 7), heat = noise2(seed + 13), ridge = noise2(seed + 21), rim = noise2(seed + 29);
  const W = GRID.W, H = GRID.H;
  // which sides get a mountain rim (the rest fall away into the sea): one or two of the four
  const rr = mulberry32(seed + 5), sides = [rr() < 0.45, rr() < 0.45, rr() < 0.45, rr() < 0.45];
  for (let v = 0; v < NV; v++) {
    const c = GRID.col[v], rw = GRID.row[v];
    const bd = Math.min(c, W - 1 - c, rw, H - 1 - rw); // cells to the border
    const side = bd === c ? 0 : bd === W - 1 - c ? 1 : bd === rw ? 2 : 3;
    const lat = GRID.lat(v), m = moist(v), ht = heat(v) - 0.42 + (0.5 - lat) * 0.85;
    // coastline: the land falls away over the last ~5 cells, ragged with noise; the outer two rings are open sea
    let e = elev(v) + 0.24 - Math.max(0, (5 - bd + rim(v) * 3) / 5) * 0.75;
    if (bd < 2) e = -1;
    if (e < -0.12) { ter[v] = T.WATER; h[v] = SEA - 1 - (e < -0.3 ? 1 : 0); continue; }
    h[v] = SEA + 1 + (e > 0.25 ? 1 : 0) + (e > 0.45 ? 1 : 0);
    const rg = Math.abs(ridge(v));
    // a broken mountain rim on some sides: peaks and cliffs drop straight into the sea
    if (sides[side] && bd <= 3 && rim(v) > -0.15 + bd * 0.1) { ter[v] = T.MOUNT; h[v] = SEA + 4 + (bd > 2 ? 1 : 0); continue; }
    if (rg < 0.06 && e > 0.05) { ter[v] = T.MOUNT; h[v] = SEA + 4 + (rg < 0.03 ? 1 : 0); continue; }
    if (lat > 0.93 || ht < -0.85) ter[v] = T.SNOW;
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
// freeplay: player colours (flags, heroes, HUD). Each crown takes its faction's colour unless another crown has it.
const PLAYER_COLS = [0x3a7aff, 0xd83a3a, 0x3ac84a, 0xff7a1a, 0xa84ad8, 0x22c4c0, 0xe8c020, 0xff5aa8];
const COL_NAMES = ['Blue', 'Red', 'Green', 'Orange', 'Purple', 'Teal', 'Gold', 'Pink'];
// a crown whose faction colour is taken gets a spare colour first (teal, gold, pink), so no faction colour is misused early
const COL_SPARE = [5, 6, 7, 0, 1, 2, 3, 4].map((i) => PLAYER_COLS[i]);
const colCss = (c) => '#' + c.toString(16).padStart(6, '0');
// difficulty 0 Easy · 1 Normal · 2 Hard · 3 Impossible; byDiff picks from a per-difficulty table (short tables clamp)
const DIFF_NAMES = ['Easy', 'Normal', 'Hard', 'Impossible'];
const byDiff = (arr) => arr[clamp(G.diff | 0, 0, arr.length - 1)];
// starting resources 0 Poor · 1 Normal · 2 Rich
const RES_START = [{ gold: 5000, wood: 10, ore: 10, gems: 2 }, { gold: 10000, wood: 20, ore: 20, gems: 5 }, { gold: 20000, wood: 40, ore: 40, gems: 10 }];
function newPlayer(i, fac, ai, color = FACTIONS[fac].color, resLv = 1) {
  const r = RES_START[resLv] || RES_START[1], aiGold = [0.75, 0.75, 0.9, 1.2][G.diff] ?? 0.75; // AI: 7500 gold on Normal, as before
  return { i, fac, ai, res: { gold: Math.round(r.gold * (ai ? aiGold : 1)), wood: r.wood, ore: r.ore, gems: r.gems }, alive: true, color, css: colCss(color), name: i === 0 ? 'You' : FACTIONS[fac].name };
}
function newHero(p, v, name) {
  return { id: G.heroes.length, p, v, name, lvl: 1, xp: 0, att: 1, def: 1, pow: 1, know: 1, mana: 10, mp: 0, mpMax: 1500, skills: {}, spells: [], arts: [], army: [], visited: [], alive: true, path: null };
}
const heroArmy = (hr) => hr.army.filter((x) => x && x[1] > 0);
const statOf = (hr, k) => hr[k] + hr.arts.reduce((a, id) => a + (ARTIFACTS.find((x) => x.id === id)[k] || 0), 0);
const maxMana = (hr) => statOf(hr, 'know') * 10;
const moveMax = (hr) => Math.round((1500 + hr.arts.reduce((a, id) => a + (ARTIFACTS.find((x) => x.id === id).move || 0), 0)) * (1 + 0.15 * (hr.skills.logistics || 0)));
const ARMY_SLOTS = 7; // up to 7 different creature stacks per hero / garrison
function addTroops(army, id, n) {
  const slot = army.findIndex((x) => x && x[1] > 0 && x[0] === id);
  if (slot >= 0) { army[slot][1] += n; return true; }
  const free = army.findIndex((x, i) => i < ARMY_SLOTS && (!x || x[1] <= 0));
  if (free >= 0) { army[free] = [id, n]; return true; }
  if (army.length < ARMY_SLOTS) { army.push([id, n]); return true; }
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
scene.background = new THREE.Color(0xa8c6e2);
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
// Map camera (flat world): a classic strategy view. The camera looks at a focus point on the ground (x, z) from a
// distance and tilt that follow the zoom (cam.dist keeps the planet's 6.4..22 scale: close up the view tilts toward
// the horizon, far out it looks down more steeply), turned by cam.yaw. Focus, yaw and zoom chase their targets
// (tx, tz, tYaw, tDist) through critically damped springs (smoothDamp), so every motion is frame-rate independent and
// velocity-continuous: a retarget (flyTo, follow, a grab mid-flight) bends the path instead of kinking it.
//  - drag: finger deltas (converted to ground units under the finger) accumulate and are applied once per frame
//  - fling: on release the target keeps gliding at the measured finger speed and decays exponentially
//  - pinch zooms, a two-finger twist turns the view; the focus is clamped to the map
//  - flyTo / follow (our walking hero, an enemy hero walking in sight) as before
const cam = { x: 0, z: 0, y: 0.3, tx: 0, tz: 0, vx: 0, vz: 0, sx: 0, sz: 0, gx: 0, gz: 0, gsx: 0, gsz: 0,
  yaw: 0, tYaw: 0, sYaw: 0, dist: 10, tDist: 10, sDist: 0, fly: false, shake: 0,
  dragX: 0, dragZ: 0, dragYaw: 0, dragging: false, spin: 0, holdFollow: null, aiFollow: null, st: 0.3 };
const lookAtP = new THREE.Vector3(), camFocus = new THREE.Vector3(), camRight = new THREE.Vector3(), camTmp = new THREE.Vector3();
const wrapPi = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
// critically damped spring toward `to` (Game Programming Gems 4, ch. 1.10); stable for any dt; returns [x, v]
function smoothDamp(x, to, v, st, dt) {
  const w = 2 / st, k = w * dt, e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k), c = x - to, tmp = (v + w * c) * dt;
  return [to + (c + tmp) * e, (v - w * tmp) * e];
}
// eye distance from the focus and tilt (radians below the horizon) for a zoom level
const viewDist = (d) => Math.max(1.6, d - 4.6);
const viewPitch = (d) => (G.mode === 'menu' ? 0.2 : 0.5 + 0.55 * (1 - Math.exp(-Math.max(0, d - 6.4) / 3.2)));
const CAM_DEFAULT = 10; // the zoom a new game, a selected hero and a load start at
const FLING_DECAY = 7; // 1/s; the speed cap scales with the zoom (the longest glide is ~0.3 view distances)
const flingMax = () => 2.2 * viewDist(cam.dist);
function camClamp() {
  const b = GRID.bounds, m = 0.4;
  const x = clamp(cam.tx, b.x0 - m, b.x1 + m), z = clamp(cam.tz, b.z0 - m, b.z1 + m);
  if (x !== cam.tx) cam.vx = 0; if (z !== cam.tz) cam.vz = 0;
  cam.tx = x; cam.tz = z;
}
function camGrab() {
  // a finger lands: stop flights, flings and follow right where the camera is (plus a hair of its momentum,
  // so a fast flight settles in ~0.1 s instead of stopping dead); no positional jump either way
  cam.fly = false; cam.vx = cam.vz = 0;
  cam.tx = cam.x + cam.sx * 0.04; cam.tz = cam.z + cam.sz * 0.04; cam.tYaw = cam.yaw; camClamp();
  if (walking) cam.holdFollow = walking;
  else if (aiRunning) cam.holdFollow = 'ai'; // grabbing the map during the enemy turn hands the camera back for that turn
}
function camSnapTo(x, z) { cam.x = cam.tx = cam.gx = x; cam.z = cam.tz = cam.gz = z; cam.sx = cam.sz = cam.gsx = cam.gsz = cam.vx = cam.vz = 0; cam.fly = false; }
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
// ground height under the focus (smoothed in updateCamera), so the view rides over hills and cliffs gently
function groundAt(x, z) { const v = GRID.cellAt(x, z); return v >= 0 ? Math.max(h[v], SEA) * STEP : SEA * STEP; }
function updateCamera(dt) {
  // spring time: 0.05 s under the finger (feels 1:1 but hides uneven touch events), ~0.3 s for flights and follow.
  // It is kept between frames: when a follow or flight ends, the camera finishes its approach at the same pace
  // instead of suddenly closing the remaining lag at drag speed.
  let st = cam.st || 0.3;
  if (cam.dragging) {
    st = 0.05;
    cam.tx += cam.dragX; cam.tz += cam.dragZ; cam.tYaw += cam.dragYaw; cam.dragX = cam.dragZ = cam.dragYaw = 0; cam.fly = false;
  } else {
    const fm = followTarget();
    if (fm) {
      cam.tx = fm.position.x; cam.tz = fm.position.z; cam.fly = false; cam.vx = cam.vz = 0;
      st = 0.32;
    } else if (cam.fly) {
      st = 0.34;
      if (Math.abs(cam.tx - cam.x) < 0.004 && Math.abs(cam.tz - cam.z) < 0.004 && Math.abs(cam.sx) + Math.abs(cam.sz) < 0.05) cam.fly = false;
    } else {
      // fling inertia (world units/s), decaying exponentially with time; the title screen slowly turns the view
      if (cam.vx || cam.vz) st = 0.05;
      cam.tx += cam.vx * dt; cam.tz += cam.vz * dt; cam.tYaw += cam.spin * dt;
      const k = Math.exp(-FLING_DECAY * dt); cam.vx *= k; cam.vz *= k;
      if (Math.abs(cam.vx) + Math.abs(cam.vz) < 1e-3) cam.vx = cam.vz = 0;
    }
  }
  camClamp();
  cam.st = st;
  if (st >= 0.2) {
    // flights and follow go through two springs in a row (target -> goal -> camera): the speed then builds up
    // with no acceleration kick on the first frame, which is what makes a long flight read as a camera move
    [cam.gx, cam.gsx] = smoothDamp(cam.gx, cam.tx, cam.gsx, st * 0.45, dt);
    [cam.gz, cam.gsz] = smoothDamp(cam.gz, cam.tz, cam.gsz, st * 0.45, dt);
    [cam.x, cam.sx] = smoothDamp(cam.x, cam.gx, cam.sx, st * 0.55, dt);
    [cam.z, cam.sz] = smoothDamp(cam.z, cam.gz, cam.sz, st * 0.55, dt);
  } else {
    [cam.x, cam.sx] = smoothDamp(cam.x, cam.tx, cam.sx, st, dt);
    [cam.z, cam.sz] = smoothDamp(cam.z, cam.tz, cam.sz, st, dt);
    // the middle spring rides along with the camera, so switching to a flight/follow starts from its exact motion
    cam.gx = cam.x; cam.gz = cam.z; cam.gsx = cam.sx; cam.gsz = cam.sz;
  }
  if (Math.abs(cam.yaw) > 1000) { const w = cam.yaw - wrapPi(cam.yaw); cam.yaw -= w; cam.tYaw -= w; }
  [cam.yaw, cam.sYaw] = smoothDamp(cam.yaw, cam.tYaw, cam.sYaw, cam.dragging ? 0.06 : 0.2, dt);
  [cam.dist, cam.sDist] = smoothDamp(cam.dist, cam.tDist, cam.sDist, 0.14, dt);
  cam.y += (groundAt(cam.x, cam.z) - cam.y) * (1 - Math.exp(-dt * 3));
  const D = viewDist(cam.dist), pt = viewPitch(cam.dist), cp = Math.cos(pt), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  lookAtP.set(cam.x, cam.y, cam.z);
  camera.position.set(cam.x + sy * cp * D, cam.y + Math.sin(pt) * D, cam.z + cy * cp * D);
  camera.up.set(0, 1, 0);
  camera.lookAt(lookAtP);
  applyShake(camera, dt, 0.014);
  // the shadow-casting sun follows the view (from behind the camera, up and to the right) so figures are front-lit
  // and shadows stay crisp where you look; its box grows with the zoom and leans toward the far part of the view
  const focus = camFocus.copy(lookAtP);
  const S = clamp(Math.round(D * 0.8 * 2) / 2, 3, 9), sc = sun.shadow.camera;
  if (sc.right !== S) { sc.left = sc.bottom = -S; sc.right = sc.top = S; sc.updateProjectionMatrix(); }
  const right = camRight.set(cy, 0, -sy);
  sun.target.position.copy(focus).addScaledVector(camTmp.set(-sy, 0, -cy), S * 0.3);
  sun.position.copy(sun.target.position).addScaledVector(camTmp.set(sy, 0, cy), 7).addScaledVector(right, 5).add(camTmp.set(0, 9, 0));
}
// is a cell far from the middle of the view (more than `n` hex steps from the focus)?
const offView = (v, n = 4) => Math.hypot(GRID.X[v] - cam.tx, GRID.Z[v] - cam.tz) > n * CELL;
// ---- screen shake (feel): "trauma" in 0..1 decays linearly; the offset is trauma² × smooth 2D noise (two sines per
// axis at incommensurate rates: continuous, no per-frame random jitter), applied as a tiny yaw/pitch of the camera
// AFTER its lookAt, so the framing target and the camera springs are never disturbed. cam.shake (legacy) feeds it.
// Off for prefers-reduced-motion. No allocations.
const reduceMo = matchMedia('(prefers-reduced-motion: reduce)');
const shake = { tr: 0, t: 0 };
function addShake(a) { if (!reduceMo.matches) shake.tr = Math.min(1, shake.tr + a); }
function applyShake(c, dt, amp) {
  if (cam.shake > 0) { addShake(Math.min(1, cam.shake * 0.5)); cam.shake = 0; }
  if (shake.tr <= 0) return;
  shake.t += dt; shake.tr = Math.max(0, shake.tr - dt * 2.2);
  const k = shake.tr * shake.tr * amp, t = shake.t * 21;
  c.rotateY((Math.sin(t) + 0.5 * Math.sin(t * 2.31 + 1.3)) * k);
  c.rotateX((Math.sin(t * 1.13 + 2.1) + 0.5 * Math.sin(t * 2.71 + 0.4)) * k);
}
// ---- hit-stop (feel): battle time (animations, rigs, effects) freezes for a few frames on a heavy impact
let hitStop = 0, bTimeK = 1;
function addHitStop(s) { if (!reduceMo.matches) hitStop = Math.max(hitStop, s); }
function flyTo(v, dist) {
  // the spring eases from the current motion into the new goal (no velocity kink if a flight is retargeted)
  cam.tx = GRID.X[v]; cam.tz = GRID.Z[v]; cam.fly = true; cam.vx = cam.vz = 0; camClamp();
  if (dist) cam.tDist = dist;
}
// ------------------------------------------------------------------ resize + screen layout
// Render targets are reallocated only for a real size change. Height-only changes (the mobile address bar / toolbar
// sliding, which fires a burst of resize events) are coalesced into one reallocation 180 ms after they settle; in
// the meantime the canvas is CSS-stretched to the viewport (#app > canvas is 100% x 100%), so nothing flickers.
// Width / orientation / pixel-ratio changes apply at once (and are re-checked 300 ms later: iOS reports the new
// size late on rotation). Sub-3px height wobbles are ignored.
const rsz = { w: 0, h: 0, pr: 0, timer: 0, late: 0 };
function resize(force) {
  const w = window.innerWidth, hh = window.innerHeight, pr = renderer.getPixelRatio();
  lay.dirty = lay.townDirty = true;
  if (force !== true && w === rsz.w && pr === rsz.pr && Math.abs(hh - rsz.h) < 3) return;
  clearTimeout(rsz.timer);
  if (force !== true && rsz.w && w === rsz.w && pr === rsz.pr) { rsz.timer = setTimeout(() => resize(true), 180); return; }
  clearTimeout(rsz.late); rsz.late = setTimeout(resize, 300);
  rsz.w = w; rsz.h = hh; rsz.pr = pr; lay.snapMap = lay.snapBat = true;
  renderer.setSize(w, hh, false);
  post.setSize(w, hh, pr);
  camera.aspect = w / hh; camera.fov = w < hh ? 50 : 40; camera.updateProjectionMatrix();
  bcam.aspect = w / hh; bcam.fov = w < hh ? 52 : 40; bcam.updateProjectionMatrix();
  if (typeof townView !== 'undefined') {
    // the town sheet moves (bottom sheet <-> side sheet) with the orientation: give the view its new insets
    // first, so the snap below lands on the right framing instead of easing out of a squashed one
    if (G.mode === 'town') townInsets();
    townView.resize(w, hh);
  }
}
window.addEventListener('resize', () => resize());
// The free screen area between the HUD bars, measured from the DOM only when something changed (resize, a bar's
// size, a mode switch), never per frame. Layout boxes (offset*) are used, so slide-in transforms don't count.
const lay = { dirty: true, townDirty: true, snapMap: true, snapBat: true, mode: '', sinceMode: 0, mapT: 0, mapB: 0, batT: 0, batB: 0, mapOff: 0, bOffX: 0, bOffY: 0, bD: 0 };
function boxIn(e) {
  if (!e || !e.offsetParent) return null; // hidden
  let t = 0, l = 0;
  for (let x = e; x && x.id !== 'app'; x = x.offsetParent) { t += x.offsetTop; l += x.offsetLeft; }
  return { t, l, w: e.offsetWidth, h: e.offsetHeight, b: t + e.offsetHeight, r: l + e.offsetWidth };
}
function measureLayout() {
  lay.dirty = false;
  const H = rsz.h || innerHeight, q = (s) => document.querySelector(s);
  const rb = boxIn(q('#hud .resbar')), bt = boxIn(q('#hud .bottom'));
  lay.mapT = rb ? rb.b : 0; lay.mapB = bt ? bt.t : H;
  const top = boxIn(q('#battle .btop')), rd = boxIn($('b-round')), btn = boxIn(q('#battle .btns')), msg = boxIn($('b-msg'));
  lay.batT = Math.max(top ? top.b : 0, rd ? rd.b : 0) + 4;
  let B = btn ? btn.t : H;
  // the status scroll stacked above the buttons (portrait): reserve its one-line height, so a message
  // wrapping to two lines doesn't re-frame the camera
  if (msg && btn && msg.t < btn.t - 4) { const cs = getComputedStyle($('b-msg')); B = btn.t - (parseFloat(cs.minHeight) || 38) - (parseFloat(cs.marginBottom) || 0); }
  lay.batB = B - 4;
}
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => { lay.dirty = true; });
  for (const s of ['#hud .resbar', '#hud .bottom', '#battle .btop', '#battle .bbot']) { const e = document.querySelector(s); if (e) ro.observe(e); }
  const tro = new ResizeObserver(() => { lay.townDirty = true; });
  tro.observe($('town'));
}
// map: the camera focus (where the followed / centred hero stands) keeps its place in the composition, but relative
// to the free band between the resource bar and the bottom bar rather than to the whole screen, and the hero's
// figure is kept clear of both bars (close-up landscape views put its head under the top bar otherwise).
// Done with a vertical view offset (fov unchanged), eased; projections and picking follow it automatically.
const mvP = new THREE.Vector3();
function mapViewOffset(dt) {
  if (lay.dirty) measureLayout();
  const H = rsz.h || innerHeight, W = rsz.w || innerWidth, T = lay.mapT, B = lay.mapB;
  let want = 0;
  if (G.mode === 'map' && B - T > H * 0.3) {
    camera.updateMatrixWorld();
    const sy = (p) => (-p.project(camera).y * 0.5 + 0.5) * H - lay.mapOff; // screen y without the current offset
    const feet = sy(mvP.copy(camFocus).setY(camFocus.y + 0.03)), head = sy(mvP.copy(camFocus).setY(camFocus.y + 0.8 * figK)); // hero + banner tip
    want = T + (feet / H) * (B - T) - feet;
    const lo = T + 12 - head, hi = B - 12 - feet;
    want = lo > hi ? (lo + hi) / 2 : clamp(want, lo, hi);
    want = clamp(want, -H * 0.25, H * 0.25);
  }
  const snap = lay.snapMap || lay.sinceMode < 0.5; lay.snapMap = false;
  let o = Math.abs(want - lay.mapOff) < 0.3 || snap ? want : lay.mapOff + (want - lay.mapOff) * (1 - Math.exp(-dt * 6));
  if (Math.abs(o) < 0.5) o = 0;
  const key = `${o.toFixed(2)}:${W}:${H}`;
  lay.mapOff = o; if (key === lay.mapKey) return; lay.mapKey = key;
  if (!o) camera.clearViewOffset(); else camera.setViewOffset(W, H, 0, -o, W, H);
}
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
    // a lone long frame (load, shader compile, tab switch) says nothing about the GPU; a run of them does
    const long = dt > 250, prevLong = S.prevLong; S.prevLong = long;
    if (document.hidden || (long && !prevLong)) return;
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
  state.set = (o = {}) => { if (o.auto !== undefined) S.auto = !!o.auto; if (o.cull !== undefined) hzOn = !!o.cull; if (o.shadowsAlways !== undefined) shAlways = !!o.shadowsAlways; if (o.level !== undefined && o.level !== S.level) apply(clamp(o.level | 0, 0, steps.length - 1)); reset(); return state(); };
  return { sample, state, init() { if (S.level) apply(S.level); else camera.userData.pixelRatio = bcam.userData.pixelRatio = S.pr; } };
})();
const atmos = createFlatSky(THREE, scene, { fogColor: 0xa8c6e2 }); // flat world: daylight sky, horizon haze, clouds, birds


// ------------------------------------------------------------------ the map mesh: bevelled hex columns with cliff walls, in chunks
// the surface itself (textures, bevels, cliffs, roads, fog, water, the open sea) is built by terrain.js
import { createFlatMap } from './terrain.js?v=1.10';
const TERRAIN = createFlatMap({ STEP, SEA });
TERRAIN.setGrid(GRID); atmos.setArea(GRID.bounds);
scene.add(TERRAIN.group);
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
  const comp = new THREE.ShaderMaterial({ uniforms: { tScene: { value: null }, tBloom: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uSharp: { value: 0.35 }, uPlate: { value: 0 } }, vertexShader: vs, depthTest: false,
    fragmentShader: `uniform sampler2D tScene; uniform sampler2D tBloom; uniform vec2 uTexel; uniform float uSharp; uniform float uPlate; varying vec2 vUv;
      ${gradeGLSL}
      void main() {
        // light adaptive sharpening: small models keep crisp edges on phone screens
        vec4 s0 = texture2D(tScene, vUv); vec3 c0 = s0.rgb;
        // battle count plates clear the scene alpha under them (see makePlate): no bloom halo over their pixels
        float pm = clamp(1.0 - s0.a, 0.0, 1.0) * uPlate;
        vec3 n4 = texture2D(tScene, vUv + vec2(uTexel.x, 0.0)).rgb + texture2D(tScene, vUv - vec2(uTexel.x, 0.0)).rgb + texture2D(tScene, vUv + vec2(0.0, uTexel.y)).rgb + texture2D(tScene, vUv - vec2(0.0, uTexel.y)).rgb;
        vec3 mn = min(c0, n4 * 0.25), mx = max(c0, n4 * 0.25);
        vec3 c = clamp(c0 + (c0 * 4.0 - n4) * uSharp * 0.25, mn * 0.85, mx * 1.15 + 0.02) + texture2D(tBloom, vUv).rgb * (0.8 * (1.0 - pm)); c = grade(c); c = c / (1.0 + c * 0.12);
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
      quad.material = comp; comp.uniforms.tScene.value = rtScene.texture; comp.uniforms.uPlate.value = sc === bscene ? 1 : 0; comp.uniforms.tBloom.value = rtA.texture;
      renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
    },
  };
})();

// ------------------------------------------------------------------ meshes for map things
const bodyMat = makeBodyMaterial(THREE);
const glowMat = makeGlowMaterial(THREE);
// perf: three.js keys a material's program on instancing, so a material drawn by both InstancedMesh (flora) and Mesh
// (map figures) objects re-resolved its program (getParameters + program cache key) twice per frame, and so did the
// shared shadow-depth material. Flora gets its own variants (same uniforms, same shader, same look).
const floraBodyMat = bodyMat.userData.rigVariant(bodyMat.userData.rig), floraGlowMat = glowMat.userData.rigVariant(glowMat.userData.rig);
const floraDepthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); // = three's default shadow depth material
const townView = createTownView(THREE, renderer, { bodyMat, glowMat });
// the town sheet's footprint, re-measured only when the sheet or the window changed size (ResizeObserver / resize),
// from its layout box (its slide-in transform doesn't count). Whole px >= 2: town_view reads values <= 1 as fractions.
function townInsets() {
  if (!lay.townDirty) return;
  const r = boxIn($('town')); if (!r) return;
  lay.townDirty = false;
  const W = innerWidth, H = innerHeight, side = W > H && r.w < W * 0.7;
  const px = (v) => { v = Math.round(v); return v < 2 ? 0 : v; };
  townView.setInsets(side ? { bottom: 0, right: px(W - r.l) } : { bottom: px(H - r.t), right: 0 });
}
const geoCache = new Map();
const unitGeoRaw = (id) => { const ff = FAC_MODEL[UNITS[id]?.fac]; if (ff) { const g = ff(id); if (g) return g; } const up = UNITS[id]?.up ? (necroUpModel(id) || havenUpModel(id)) : null; if (up) return up; const base = UNITS[id]?.up || id; return havenModel(base) || necroModel(base) || neutralModel(base) || unitModel(base, UNITS[id].col); };
// perf: the body material otherwise computes the smooth form normals lazily on the first draw (~5-12 ms per creature on
// desktop, several times that on a phone), i.e. inside the first battle frame; do it with the build instead
const unitGeo = (id) => { const m = unitGeoRaw(id); if (m?.body && !m.body.attributes.formNormal) { addFormNormals(m.body); m.body.userData.hxForm = true; } return m; };
// portraits are warmed by the loading screen (prewarm); the rest render on demand
let prewarmed = false;
// every model geometry is built once and shared by all its meshes (map, battle, portraits); freed only by trimGeoCache()
const cached = (k, f) => { if (!geoCache.has(k)) geoCache.set(k, f()); return geoCache.get(k); };
// keyed by faction + colour, not player index: a second new game in the same session must not reuse the old look
const heroKey = (p) => 'hero' + G.players[p].fac + ':' + G.players[p].color;
const heroGeo = (p) => cached(heroKey(p), () => { const P = G.players[p], m = heroModel(P.fac, P.color); if (m.body) { addFormNormals(m.body); m.body.userData.hxForm = true; } return m; });
// Bounded geometry cache (memory): when a game starts or a save is loaded, models the new world can never show are freed
// (CPU arrays + GPU buffers): other factions' creatures, heroes, towns and siege walls left over from earlier games in
// this session. Each creature is ~0.3-1 MB, a faction roster ~11 MB, so trying every faction used to keep ~60 MB alive.
// Kept: every creature of a faction in this world (players and towns, base + upgraded), neutrals, anything in an army,
// garrison or on the map, and the small shared pieces (map objects, flags, battle obstacles).
function trimGeoCache() {
  if (!G.players.length) return 0;
  // rosters: the crowns' factions and the towns they own (what they can recruit); a neutral town's line-up is kept
  // through its garrison and built on demand if it is captured later. Town and siege models: every town on the map.
  const pfacs = new Set([...G.players.map((P) => P.fac), ...G.towns.filter((t) => t.p >= 0).map((t) => t.fac)]);
  const facs = new Set([...pfacs, ...G.towns.map((t) => t.fac)]);
  const units = new Set(), add = (id) => { if (id && UNITS[id]) { units.add(id); if (UNITS[id].up) units.add(UNITS[id].up); } };
  for (const [id, u] of Object.entries(UNITS)) if (!FACTIONS[u.fac] || pfacs.has(u.fac)) add(id);
  for (const hr of G.heroes) for (const st of hr.army || []) add(st?.[0]);
  for (const t of G.towns) for (const st of t.garrison || []) add(st?.[0]);
  for (const o of G.objects) add(o.unit);
  const heroes = new Set(G.players.map((_, p) => heroKey(p)));
  let n = 0;
  for (const [k, m] of [...geoCache]) {
    let keep = true;
    if (k.startsWith('hero')) keep = heroes.has(k);
    else if (k[0] === 'u' && UNITS[k.slice(1)]) keep = units.has(k.slice(1));
    else { const f = /^(?:town|wall_|gate_|tower_|keep_)(\w+)$/.exec(k)?.[1]; if (f && FACTIONS[f]) keep = facs.has(f); }
    if (keep) continue;
    geoCache.delete(k); warmed.delete(k.slice(1)); n++;
    releasePortraitModel(m); m?.body?.dispose(); m?.glow?.dispose();
  }
  try { n += townView.trim?.(pfacs) || 0; } catch (e) { console.warn('town trim', e); } // other factions' town scenes
  return n;
}
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
  // what every town can hire right now (rival towns, and captured towns of another faction): the town recruit rows
  for (const t of G.towns) for (let tier = 1; tier <= 7; tier++) if (t.built.includes(`d${tier}`)) add(tierUnit(t, tier));
  return ids;
}
// Portraits (perf): every <img> size the UI asks for, rendered in the background after the creature's geometry is
// warm. 64 px: turn strip, army rows, town recruit/upgrade rows, toasts, week of the creature; 128 px: the guard /
// monster dialogs (bigpt); hero 40 px round (side buttons, selection bar) and 96 px (hero sheet). A synchronous
// render costs a model framing + MSAA draw + a blocking readPixels (GPU pipeline stall, 70-110 ms measured on arrival
// at a monster); portraitAsync() uses a fenced pixel-pack readback and toBlob, so an idle slice only pays the CPU side.
const ptQ = [];
function portraitJobs(ids) {
  const out = [], push = (id, size, shape = 'square') => { if (!hasPortrait(id, size, shape)) out.push([id, size, shape]); };
  const monsters = new Set(G.objects.filter((o) => o.alive && o.type === 'monster').map((o) => o.unit));
  for (const id of monsters) push(id, 128); // the dialog you see on arrival first
  for (const id of ids) push(id, 64);
  for (const hr of G.heroes) if (hr.alive && hr.p === 0) { const P = G.players[0], hid = heroPortraitId(P.fac, P.color); push(hid, 40, 'round'); push(hid, 96); }
  return out;
}
function warmGeometryIdle(ids = warmJobs()) {
  for (const id of ids) if (!warmQ.includes(id) && !warmed.has(id)) warmQ.push(id);
  G.players.forEach((P, p) => { if (!geoCache.has(heroKey(p)) && !warmQ.includes('hero:' + p)) warmQ.push('hero:' + p); });
  for (const j of portraitJobs(ids)) if (!ptQ.some((q) => q[0] === j[0] && q[1] === j[1] && q[2] === j[2])) ptQ.push(j);
  if (!warmBusy && (warmQ.length || ptQ.length)) { warmBusy = true; idleCb(warmStep); }
  else if (!warmBusy && !warmTimer) warmTimer = setTimeout(() => { warmTimer = 0; warmGeometryIdle(); }, 8000);
  return warmQ.length;
}
const warmed = new Set();
const idleCb = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1000 }) : setTimeout(() => f({ didTimeout: true, timeRemaining: () => 0 }), 120));
function warmCalm() { return G.mode === 'map' && !walking && !ptrs.size && !aiRunning && $('loader').hidden; }
function warmStep(dl) {
  // one model per callback (a build cannot be split); wait for real idle time unless the browser says we timed out
  if (!warmQ.length && !ptQ.length) { warmBusy = false; warmGeometryIdle(); return; }
  if (!warmCalm() || (!dl.didTimeout && dl.timeRemaining() < 3)) { setTimeout(() => idleCb(warmStep), 250); return; }
  if (!warmQ.length) { warmPortraitStep(dl); return; }
  const id = warmQ.shift();
  try {
    if (id.startsWith('hero:')) { if (G.players[+id.slice(5)]) heroGeo(+id.slice(5)); }
    else { const g = cached('u' + id, () => unitGeo(id)); unitFit(id, g, 'battle'); unitFit(id, g, 'map'); }
  } catch (e) { console.warn('warm', id, e); }
  warmed.add(id); // tried: a model that throws is not retried every rescan
  if (warmQ.length || ptQ.length) idleCb(warmStep); else { warmBusy = false; warmGeometryIdle(); }
}
// portraits: start background renders while the idle slice lasts (each costs ~2-6 ms of CPU on desktop: framing + draw
// submission), at most 3 per slice and 3 in flight so readbacks and PNG encodes never pile up
function warmPortraitStep(dl) {
  let n = 0;
  const t0 = performance.now(), budget = dl.didTimeout ? 6 : Math.min(10, dl.timeRemaining() - 2);
  while (ptQ.length && n < 3 && portraitsPending() < 3 && performance.now() - t0 < budget) {
    const [id, size, shape] = ptQ[0];
    // a creature whose geometry is not built yet costs a whole build: give it its own slice
    if (!id.startsWith('hero:') && !geoCache.has('u' + id) && n > 0) break;
    ptQ.shift(); n++;
    try { portraitAsync(id, size, shape); } catch (e) { console.warn('warm portrait', id, e); }
  }
  if (warmQ.length || ptQ.length) (n ? idleCb(warmStep) : setTimeout(() => idleCb(warmStep), 120)); else { warmBusy = false; warmGeometryIdle(); }
}
initPortraits(THREE, renderer, (id) => cached('u' + id, () => unitGeo(id)), { dispose: false });
const heroPic = (hr, size, shape = 'square') => { const P = G.players[hr.p]; return heroPortraitImg(P.fac, P.color, size, 'pt', shape); };
// interactive things (towns, heroes, objects, creatures) get a painted ink outline so they read as figures on the ground
setRigIdle(0.6); // map figures idle gently (battle units set their own amplitude)
const inkMat = makeInkHullMaterial(THREE), blobMat = makeBlobShadowMaterial(THREE), blobGeo = blobShadowGeometry(THREE);
let inkLod = true; // map figures' ink hulls shown (off when zoomed far out)
function meshOf(m, ink = true) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(m.body, bodyMat); b.castShadow = true; b.receiveShadow = true; g.add(b);
  if (m.glow) g.add(new THREE.Mesh(m.glow, glowMat));
  if (ink) { const k = new THREE.Mesh(m.body, inkMat); k.userData.ink = true; g.add(k); }
  return g;
}
// soft contact shadow so a figure sits on the ground (radius in model units)
function addBlob(g, r) { const bl = new THREE.Mesh(blobGeo, blobMat); bl.scale.setScalar(r); bl.userData.blob = true; bl.renderOrder = -1; g.add(bl); return g; }
const BLOB_R = { gold: 0.62, wood: 0.62, ore: 0.62, gems: 0.62, chest: 0.64, artifact: 0.55, campfire: 0.6, stone: 0.55, monster: 0.7 };
const UP = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion();
// stands a group on a cell (local +y up), turned by `turn` around the vertical
// figures grow a little as the camera pulls back, so they stay readable on a phone (like map icons)
let figK = 1;
function placeOn(obj, v, scale, turn = 0, lift = 0) {
  obj.userData.s0 = scale;
  obj.quaternion.identity();
  obj.rotateY(turn);
  obj.position.set(GRID.X[v], radiusOf(v) + lift, GRID.Z[v]);
  obj.scale.setScalar(scale * figK);
}
const world = new THREE.Group(); scene.add(world);
const flora = new THREE.Group(); scene.add(flora);
// forests, mountains and rocks: instanced per model
const dummy = new THREE.Object3D(); // scratch (the battle hex grid uses it too)
const pickW = (list, r) => { const tot = list.reduce((x, e) => x + e.w, 0); let k = r * tot; for (const e of list) { k -= e.w; if (k <= 0) return e.key; } return list[0].key; };
// Flora (flat world): one InstancedMesh (+ glow) per model, holding only the instances of the render chunks in (or
// just around) the view. Each model keeps its instance matrices per chunk; a fog reveal appends the new cells' ones,
// and floraCull() re-packs a model's instance buffer only when the set of chunks in view (or its content) changed,
// so a still or slowly panning view uploads nothing and the GPU never processes forests off screen.
const floraSets = new Map(); // key -> { model, im, ig, cap, per: Map(chunk -> { a: Float32Array, n }), dirty }
const floraDone = new Uint8Array(MAX_CELLS); // cells whose flora is already placed
const floraBig = new THREE.Sphere(new THREE.Vector3(), 1e4);
function floraCell(v, put) {
  const hv = hash(v * 11), rr = (k) => (hash(v * 31 + k * 7) % 1000) / 1000;
  const F = FLORA_FOR_TERRAIN[ter[v]], lat = GRID.lat(v) * 0.9; // north = colder (snowy pines and peaks), no palms there
  if (ter[v] === T.FOREST || ter[v] === T.MOUNT) {
    const biome = biomeOf(NBR[v].map((n) => ter[n]), lat);
    if (ter[v] === T.FOREST) {
      const n = F.count[0] + (hv % (F.count[1] - F.count[0] + 1));
      for (let i = 0; i < n; i++) { const a = i * 2.1 + hv, d = i ? 0.1 + rr(i) * 0.03 : 0; put(pickW(FOREST_BY_BIOME[biome] || FOREST_BY_BIOME.temperate, rr(i + 9)), v, F.fillScale * (0.85 + rr(i + 3) * 0.3), Math.cos(a) * d, Math.sin(a) * d, a); }
    } else { const keys = PEAK_BY_BIOME[biome] || PEAK_BY_BIOME.temperate; put(keys[hv % keys.length], v, F.fillScale * (0.95 + rr(2) * 0.2), 0, 0, hv); }
    return;
  }
  if (objAt[v] >= 0 || road[v] || !F || !F.scatter) return;
  let placed = 0;
  F.scatter.forEach((e, i) => { if (placed >= 2 || rr(i + 20) > e.p) return; if ((e.avoid && NBR[v].some((n) => e.avoid.includes(ter[n]))) || (e.maxLat && lat > e.maxLat)) return; const a = rr(i + 30) * 6.28, d = 0.05 + rr(i + 40) * 0.07; put(e.key, v, e.s, Math.cos(a) * d, Math.sin(a) * d, a * 3); placed++; });
}
// the set for a model (its meshes are (re)allocated by floraPack when the instances outgrow them)
function floraSet(key) {
  let S = floraSets.get(key);
  if (!S) { S = { model: natureModel(key), im: null, ig: null, cap: 0, per: new Map(), dirty: true }; floraSets.set(key, S); }
  return S;
}
function floraAlloc(S, need) {
  const cap = Math.ceil(need * 1.4) + 32;
  for (const o of [S.im, S.ig]) if (o) { flora.remove(o); o.dispose(); }
  const mk = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, cap); im.count = 0; im.visible = false; im.frustumCulled = false; im.boundingSphere = floraBig; return im; };
  S.im = mk(S.model.body, floraBodyMat); S.im.castShadow = true; S.im.receiveShadow = true; S.im.customDepthMaterial = floraDepthMat;
  S.ig = S.model.glow ? mk(S.model.glow, floraGlowMat) : null;
  flora.add(S.im); if (S.ig) flora.add(S.ig);
  S.cap = cap;
}
// chunks in view (frustum, widened a little for shadows cast into it from just outside)
const floraVis = { key: '', chunks: [] }, _frus = new THREE.Frustum(), _fm = new THREE.Matrix4(), _fb = new THREE.Box3();
function floraPack(S) {
  S.dirty = false;
  let n = 0; for (const c of floraVis.chunks) n += S.per.get(c)?.n || 0;
  if (n > S.cap) floraAlloc(S, n);
  if (!S.im) return;
  let o = 0;
  for (const c of floraVis.chunks) { const L = S.per.get(c); if (!L || !L.n) continue; const src = L.a.subarray(0, L.n * 16); S.im.instanceMatrix.array.set(src, o); if (S.ig) S.ig.instanceMatrix.array.set(src, o); o += L.n * 16; }
  for (const m of [S.im, S.ig]) { if (!m) continue; m.count = n; m.visible = n > 0; if (n) { m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, n * 16); m.instanceMatrix.needsUpdate = true; } }
}
let floraOn = true; // A/B switch for perf tests (quality.set({ cull: false }) packs every chunk)
function floraCull() {
  camera.updateMatrixWorld();
  _frus.setFromProjectionMatrix(_fm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const vis = [];
  for (const C of GRID.chunks) {
    _fb.min.set(C.x0 - 0.8, -0.4, C.z0 - 0.8); _fb.max.set(C.x1 + 0.8, 1.6, C.z1 + 0.8);
    // in view and nearer than the far haze (beyond it everything has faded into the sky colour)
    const on = !floraOn || (_frus.intersectsBox(_fb) && _fb.distanceToPoint(camera.position) < atmos.fog.far);
    if (on) vis.push(C.id);
    const ch = TERRAIN.chunks()[C.id]; if (ch) { ch.land.visible = on; ch.water.visible = on && ch.W?.n > 0; }
  }
  const key = vis.join(',');
  const all = key !== floraVis.key;
  if (all) { floraVis.key = key; floraVis.chunks = vis; }
  let packed = false;
  for (const S of floraSets.values()) if (all || S.dirty) { floraPack(S); packed = true; }
  return packed;
}
// cells = the cells that just turned seen (incremental), or nothing for a full rebuild of the flora
function layoutFlora(cells = null) {
  if (!cells) {
    // free the old instance-matrix GPU buffers (the shared nature geometries stay cached in nature.js)
    for (const im of flora.children) im.dispose?.();
    flora.clear(); floraSets.clear(); floraDone.fill(0); floraVis.key = '';
    cells = [];
    for (let v = 0; v < NV; v++) if (seen[v]) cells.push(v);
  }
  let any = false;
  const put = (key, v, s, x = 0, z = 0, turn = 0) => {
    const S = floraSet(key), c = GRID.chunkOf[v];
    let L = S.per.get(c); if (!L) S.per.set(c, (L = { a: new Float32Array(64 * 16), n: 0 }));
    if ((L.n + 1) * 16 > L.a.length) { const b = new Float32Array(L.a.length * 2); b.set(L.a); L.a = b; }
    const e = L.a, o = L.n * 16, cs = Math.cos(turn) * s, sn = Math.sin(turn) * s;
    e[o] = cs; e[o + 1] = 0; e[o + 2] = -sn; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = s; e[o + 6] = 0; e[o + 7] = 0;
    e[o + 8] = sn; e[o + 9] = 0; e[o + 10] = cs; e[o + 11] = 0; e[o + 12] = GRID.X[v] + x; e[o + 13] = radiusOf(v); e[o + 14] = GRID.Z[v] + z; e[o + 15] = 1;
    L.n++; S.dirty = true; any = true;
  };
  for (const v of cells) { if (!seen[v] || floraDone[v]) continue; floraDone[v] = 1; floraCell(v, put); }
  return any;
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
    x = NBR[x].reduce((p, n) => (cellDist(n, b) < cellDist(p, b) ? n : p));
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
  const n = Math.max(2, Math.round((strength * 2600 + 250) / (u.hp * (u.dmg[0] + u.dmg[1]) / 2 + 20) * (0.7 + rnd() * 0.6) * byDiff([0.75, 1, 1.3, 1.45])));
  return { id, n };
}
const TOWN_NAMES = { haven: ['Highcastle', 'Brightwater', 'Stormhold', 'Valemere'], necro: ['Gravenreach', 'Duskmoor', 'Ashfall', 'Wraithgate'],
  sylvan: ['Elderglade', 'Mossvale', 'Silverleaf', 'Thornwood'], inferno: ['Ashenspire', 'Brimstone', 'Cinderhold', 'Pyrewatch'], dungeon: ['Deepvault', 'Shadowmere', 'Gloomhollow', 'Crystalreach'] };
function newTown(v, p, fac, name) {
  return { id: G.towns.length, v, p, fac, name, built: ['d1'], avail: { 1: UNITS[FACTIONS[fac].units[0]].grow }, garrison: [], builtToday: false, spells: [] };
}
// freeplay: grid-agnostic helpers for placing crowns. cellDist works on any grid that keeps posOf (planet: chord length).
// edgeOk(v, m): far enough from the map's "edge" for a town (planet: away from the poles; flat grid: a margin from the border)
// (flat: cellDist is the grid's hex distance, defined with the grid; edgeOk keeps towns off the coastal rim)
const edgeOk = (v, m) => GRID.edge(v) < m + 0.3;
// Free Play map sizes (passed to the terrain generator; the planet grid has one size, so it only stores it for now)
const MAP_SIZES = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Huge' };
// one attempt at the terrain (flat agent: generateWorld({ size, players }) plugs in here)
const genTerrain = (seed, size, players) => generate(seed, { size, players });
// opts (Free Play): { opponents: [{ fac: key|'random', col: index|-1 }], size, res, win: 'conquer'|'capitals', fog, mode }
function newWorld(seed, diff = 1, myFac = 'haven', opts = {}) {
  const opp = (opts.opponents?.length ? opts.opponents : [{ fac: 'random', col: -1 }]).slice(0, 4);
  const N = opp.length + 1;
  Object.assign(G, { seed, day: 1, players: [], heroes: [], towns: [], objects: [], diff, selHero: -1, over: false, mode: 'map', log: [], run: null,
    gameMode: opts.mode || 'free', size: MAP_SIZES[opts.size] ? opts.size : 'M', resLv: opts.res ?? 1, win: opts.win === 'capitals' ? 'capitals' : 'conquer', fog: opts.fog !== false });
  objAt.fill(-1); road.fill(0); seen.fill(0);
  pendingLevels.length = 0; // level-ups queued in a previous game (quit with the dialog open) belong to that game
  rnd = mulberry32(seed);
  // capitals: farthest-point picks over good sites, retried on new terrain until every pair is far apart.
  // need = the fraction of the world's span each pair must keep (2 crowns ~ opposite sides, 5 crowns ~ spread evenly)
  const need0 = [0, 0, 0.8, 0.6, 0.5, 0.42][N]; // (flat rectangle: 4 crowns ~ the corners, 5 ~ corners + centre)
  let caps = null, span = 1, best = null, bestMin = -1;
  for (let tries = 0; tries < 60 && !caps; tries++) {
    genTerrain(seed + tries * 101, G.size, N);
    const ok = (v) => passable(v) && ter[v] !== T.SNOW && ter[v] !== T.SWAMP && edgeOk(v, 0.6) && bfs(v, 2).filter(([x]) => passable(x)).length >= 16;
    const cands = []; for (let v = 0; v < NV; v += 3) if (ok(v)) cands.push(v);
    if (cands.length < 20 * N) continue;
    const c0 = cands[(rnd() * cands.length) | 0], far0 = cands.reduce((p, x) => (cellDist(x, c0) > cellDist(p, c0) ? x : p));
    span = Math.max(1e-6, cands.reduce((m, x) => Math.max(m, cellDist(x, far0)), 0));
    const pick = [far0], md = cands.map((x) => cellDist(x, far0));
    while (pick.length < N) {
      let bi = 0; for (let i = 1; i < cands.length; i++) if (md[i] > md[bi]) bi = i;
      const nv = cands[bi]; pick.push(nv);
      for (let i = 0; i < cands.length; i++) md[i] = Math.min(md[i], cellDist(cands[i], nv));
    }
    let mn = Infinity; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) mn = Math.min(mn, cellDist(pick[i], pick[j]) / span);
    if (mn > bestMin) { bestMin = mn; best = { pick, seed: seed + tries * 101, span }; }
    if (mn >= need0 * Math.pow(0.985, tries)) caps = pick;
  }
  if (!caps) { genTerrain(best.seed, G.size, N); caps = best.pick; span = best.span; } // keep the best spread found
  // who sits where: you take a random capital, the rivals the rest
  for (let i = caps.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [caps[i], caps[j]] = [caps[j], caps[i]]; }
  // flat grass around each capital
  const settle = (c) => { for (const [x] of bfs(c, 2)) { if (ter[x] === T.WATER || ter[x] === T.MOUNT || ter[x] === T.FOREST) ter[x] = T.GRASS; h[x] = h[c]; } };
  for (const c of caps) settle(c);
  for (const c of caps.slice(1)) if (!connected(caps[0], c)) carve(caps[0], c);
  // the crowns: rivals pick a faction (Random prefers one nobody leads yet) and a colour (their faction's unless taken)
  const facs = Object.keys(FACTIONS), used = [myFac], cols = [];
  const takeCol = (want, fac) => { let c = PLAYER_COLS[want] ?? -1; if (c < 0 || cols.includes(c)) c = FACTIONS[fac].color; if (cols.includes(c)) c = COL_SPARE.find((x) => !cols.includes(x)); cols.push(c); return c; };
  G.players = [newPlayer(0, myFac, false, takeCol(opts.myCol ?? -1, myFac), G.resLv)];
  opp.forEach((o, k) => {
    let fac = FACTIONS[o.fac] ? o.fac : null;
    if (!fac) { const free = facs.filter((f) => !used.includes(f)); const pool = free.length ? free : facs; fac = pool[(rnd() * pool.length) | 0]; }
    used.push(fac);
    G.players.push(newPlayer(k + 1, fac, true, takeCol(o.col ?? -1, fac), G.resLv));
  });
  // two crowns of one faction: tell them apart by colour
  for (const Pl of G.players) if (Pl.ai && G.players.filter((x) => x.fac === Pl.fac).length > 1) Pl.name = `${COL_NAMES[PLAYER_COLS.indexOf(Pl.color)] || ''} ${FACTIONS[Pl.fac].name}`.trim();
  const capital = (v, p) => {
    const P = G.players[p], names = TOWN_NAMES[P.fac], nth = G.players.slice(0, p).filter((x) => x.fac === P.fac).length;
    const t = newTown(v, p, P.fac, names[nth % names.length]); t.capOf = p;
    t.garrison = [[FACTIONS[P.fac].units[0], 12], [FACTIONS[P.fac].units[1], 5]]; G.towns.push(t); addObject('town', v, { t: t.id }); return t;
  };
  caps.forEach((v, p) => capital(v, p));
  // neutral towns between neighbouring crowns (closest pairs first: the frontiers), each with a strong garrison
  const pairs = []; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) pairs.push([caps[i], caps[j], cellDist(caps[i], caps[j])]);
  pairs.sort((x, y) => x[2] - y[2]);
  const nMid = N === 2 ? 2 : Math.min(N + 1, 6), mids = [], midCands = [];
  for (let v = 0; v < NV; v += 5) if (passable(v) && objAt[v] < 0 && edgeOk(v, 0.7) && bfs(v, 1).filter(([x]) => passable(x)).length >= 6) midCands.push(v);
  for (let k = 0; mids.length < nMid && k < pairs.length * 2; k++) {
    const [a, b, dab] = pairs[k % pairs.length];
    let bv = -1, bs = Infinity;
    for (const v of midCands) {
      if (objAt[v] >= 0 || mids.some((m) => cellDist(m, v) < span * 0.28)) continue;
      const da = cellDist(v, a), db = cellDist(v, b);
      if (caps.some((c) => cellDist(v, c) < dab * 0.36)) continue; // never on anyone's doorstep
      const sc = Math.abs(da - db) * 2 + da + db;
      if (sc < bs) { bs = sc; bv = v; }
    }
    if (bv >= 0) mids.push(bv);
  }
  const spare = facs.filter((f) => !used.includes(f)).sort(() => rnd() - 0.5);
  mids.forEach((v, i) => {
    settle(v);
    if (!connected(caps[0], v)) carve(caps[0], v);
    const fac = spare.length ? spare[i % spare.length] : facs[(rnd() * facs.length) | 0];
    const nth = G.towns.filter((x) => x.fac === fac).length, names = TOWN_NAMES[fac];
    const t = newTown(v, -1, fac, names[(1 + nth) % names.length]);
    const us = FACTIONS[fac].units;
    t.garrison = [[us[0], 30 + G.diff * 10], [us[1], 14], [us[2], 7], [us[3], 3]];
    t.built.push('d2', 'd3');
    G.towns.push(t); addObject('town', v, { t: t.id });
  });
  // heroes beside their capitals
  for (const t of G.towns.filter((x) => x.p >= 0)) {
    const v = NBR[t.v].find((x) => passable(x)) ?? t.v;
    const P = G.players[t.p];
    const hr = newHero(t.p, v, FACTIONS[P.fac].heroes[G.heroes.filter((x) => G.players[x.p].fac === P.fac).length % FACTIONS[P.fac].heroes.length]);
    hr.army = START_ARMY[P.fac].map((x) => [...x]);
    const kit = FACTION_START[P.fac] || FACTION_START.haven;
    hr.spells = [kit.spell]; hr.skills[kit.skill] = 1;
    if (P.ai) { hr.att += byDiff([1, 1, 1, 2]); for (const s of hr.army) s[1] = Math.round(s[1] * byDiff([0.7, 1, 1.35, 1.6])); }
    hr.mp = moveMax(hr); hr.mana = maxMana(hr);
    G.heroes.push(hr);
  }
  // roads: every capital to its nearest neutral towns (or straight to its nearest rival when there are none)
  for (const c of caps) {
    const near = [...mids].sort((x, y) => cellDist(c, x) - cellDist(c, y)).slice(0, N === 2 ? 2 : 2);
    if (near.length) for (const m of near) makeRoad(c, m);
    else { const o = caps.filter((x) => x !== c).sort((x, y) => cellDist(c, x) - cellDist(c, y))[0]; if (o !== undefined) makeRoad(c, o); }
  }
  // treasure around each capital: free mines and piles close by, guarded riches further out
  for (const c of caps) {
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
  // the wilds: scattered objects everywhere, guarded harder the farther from any home (0 at a capital, 1 at the
  // loneliest spot of this map, so more crowns don't make the in-between land any softer)
  const farRaw = (v) => { let m = Infinity; for (const c of caps) m = Math.min(m, cellDist(v, c)); return (m / span) ** 2; };
  let farMax = 1e-6; for (let v = 0; v < NV; v += 4) if (passable(v)) farMax = Math.max(farMax, farRaw(v));
  const far = (v) => farRaw(v) / farMax;
  const dens = NV / 2562; // object counts follow the grid's size (the planet has 2562 cells)
  const kinds = ['gold', 'wood', 'ore', 'gems', 'chest', 'chest', 'artifact', 'artifact', 'artifact', 'tower', 'stone', 'stables', 'obelisk', 'goldmine', 'gemmine', 'sawmill', 'orepit', 'dwelling', 'shrine', 'well', 'campfire', 'library', 'arena'];
  for (let i = 0, n = 0, nMax = Math.round(120 * dens); i < 900 * dens && n < nMax; i++) {
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
  for (let i = 0; i < Math.round(14 * dens); i++) { const v = (rnd() * NV) | 0; if (passable(v) && objAt[v] < 0 && far(v) > 0.15 && NBR[v].every((x) => objAt[x] < 0)) { const g = guardFor(v, far(v) * 1.3); addObject('monster', v, { unit: g.id, n: g.n }); } }
  for (const o of G.objects) if (['gold', 'wood', 'ore', 'gems'].includes(o.type)) o.amount = o.type === 'gold' ? 500 + ((rnd() * 6) | 0) * 100 : 3 + ((rnd() * 5) | 0);
  G.selHero = 0;
  if (!G.fog) seen.fill(1);
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
  const heur = (v) => cellDist(v, to) * 50; // admissible: no step costs less than a road step (50)
  const fScore = new Map([[from, heur(from)]]), open = minHeap();
  open.push(fScore.get(from), from);
  let guardSteps = 0;
  while (open.size && guardSteps < NV + 4000) {
    let cur = open.pop();
    if (open.d !== fScore.get(cur)) continue; // a stale entry: this cell was re-queued with a better cost
    guardSteps++;
    if (cur === to) { const p = [cur]; while (came.has(cur)) { cur = came.get(cur); p.unshift(cur); } return p; }
    for (const n of NBR[cur]) {
      if (!passable(n) || crownShut(n, hr)) continue;
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
// (an enemy picking up gold or flagging a mine used to re-tessellate the whole planet in the middle of the AI turn).
// A plain fog reveal (cells only ever turning seen, land unchanged) is incremental: the terrain rewrites just the
// touched cells' vertex attributes and fades them in, the flora appends the new cells' instances.
const landSnap = { ter: new Uint8Array(MAX_CELLS), h: new Int8Array(MAX_CELLS), road: new Uint8Array(MAX_CELLS), seen: new Uint8Array(MAX_CELLS), ok: false };
// null: nothing changed; 'full': rebuild; an array: only these cells turned seen
function landChanged() {
  const S = landSnap;
  let full = !S.ok, fresh = null;
  for (let v = 0; !full && v < NV; v++) {
    if (S.ter[v] !== ter[v] || S.road[v] !== road[v] || S.h[v] !== h[v]) full = true;
    else if (S.seen[v] !== seen[v]) { if (seen[v]) (fresh || (fresh = [])).push(v); else full = true; }
  }
  if (full) { S.ter.set(ter); S.h.set(h); S.road.set(road); S.seen.set(seen); S.ok = true; return 'full'; }
  if (fresh) for (const v of fresh) S.seen[v] = seen[v];
  return fresh;
}
// map objects keep their meshes between layouts: only appearing, vanishing or re-flagged objects are touched
const objMeshes = new Map(); // object id -> group (userData.sig: what it shows, userData.flagOwner / flag)
let objMeshesOf = null; // the G.objects array these belong to (a new game / load starts over)
const objSig = (o) => o.v + '|' + o.type + '|' + (o.type === 'town' ? G.towns[o.t].fac : o.type === 'monster' ? o.unit : '');
function dropObjMesh(id) { const g = objMeshes.get(id); if (g) { world.remove(g); objMeshes.delete(id); } } // geometries are shared (cached): nothing to dispose
function setObjFlag(g, o) {
  const owner = o.type === 'town' ? G.towns[o.t].p : OBJECTS[o.type]?.kind === 'mine' ? o.owner : -2;
  if (owner === g.userData.flagOwner) return false;
  if (g.userData.flag) g.remove(g.userData.flag);
  g.userData.flag = null; g.userData.flagOwner = owner;
  if (owner > -2) { const f = flagMesh(ownerCol(owner)); g.add(f); f.position.set(0.55, 0, 0.45); f.scale.setScalar(o.type === 'town' ? 0.6 : 0.8); g.userData.flag = f; }
  return true;
}
function objMeshFor(o) {
  const g = meshOf(objModel(o));
  placeOn(g, o.v, SCALE[o.type] || 0.24, o.type === 'monster' ? (hash(o.id) % 6) : 0);
  if (o.type === 'monster') { applyFit(g, unitFit(o.unit, objModel(o), 'map')); g.userData.s0 = g.scale.x; g.scale.multiplyScalar(figK); }
  if (o.type === 'town') { g.userData.noGrow = true; g.scale.setScalar(g.userData.s0); }
  addBlob(g, o.type === 'monster' ? BLOB_R.monster / (g.scale.x / (SCALE.monster || 0.2)) : BLOB_R[o.type] || 0.66);
  if (!inkLod) for (const c of g.children) if (c.userData.ink) c.visible = false;
  g.userData.sig = objSig(o); g.userData.flagOwner = -3;
  setObjFlag(g, o);
  return g;
}
function layoutWorld() {
  worldDirty = false;
  let changed = false;
  const land = landChanged();
  if (land === 'full') { rebuildPlanet(); layoutFlora(); changed = true; }
  else if (land) { if (!TERRAIN.refog(ter, h, road, seen, land)) rebuildPlanet(); layoutFlora(land); changed = true; }
  if (land) mini.mark(land);
  if (objMeshesOf !== G.objects) { for (const id of [...objMeshes.keys()]) dropObjMesh(id); world.clear(); objMeshesOf = G.objects; changed = true; }
  for (const o of G.objects) {
    let g = objMeshes.get(o.id);
    if (!o.alive || !seen[o.v]) { if (g) { dropObjMesh(o.id); changed = true; } continue; }
    if (g && g.userData.sig !== objSig(o)) { dropObjMesh(o.id); g = null; }
    if (!g) { g = objMeshFor(o); objMeshes.set(o.id, g); world.add(g); changed = true; }
    else if (setObjFlag(g, o)) changed = true;
  }
  for (const id of objMeshes.keys()) if (!G.objects[id]) { dropObjMesh(id); changed = true; }
  if (changed) renderer.shadowMap.needsUpdate = true; // the still-map shadow refresh would catch up anyway; don't wait for it
  layoutHeroes(true);
}
// ------------------------------------------------------------------ minimap (flat world)
// A small 2D canvas in a HUD corner: explored terrain (a base layer redrawn only for cells whose land / fog changed),
// towns, mines and heroes in their owners' colours, and the ground the camera sees. The overlay is redrawn at most
// ~12 times a second and only when the view or a marker moved. Tap (or drag on) it to fly there.
const mini = (() => {
  const el = document.createElement('canvas'); el.id = 'minimap'; el.setAttribute('aria-label', 'Map overview: tap to fly there');
  $('hud').appendChild(el);
  const ctx = el.getContext('2d'), base = document.createElement('canvas'), bctx = base.getContext('2d');
  const M = { el, dirty: true, fresh: null, sig: '', t: 0, w: 0, h: 0, s: 1, pr: 1, gw: 0, gh: 0 };
  const COLS = TER_COL.map((c) => '#' + c.getHexString()), ROADC = '#' + ROAD_COL.getHexString(), FOGC = '#1d2236';
  function size() {
    const land = innerWidth > innerHeight, cw = land ? clamp(innerWidth * 0.17, 120, 190) : clamp(innerWidth * 0.32, 104, 150);
    const gw = GRID.W + 0.5, gh = (GRID.H - 1) * 0.866 + 1, ch = cw * gh / gw, pr = Math.min(2, devicePixelRatio || 1);
    if (Math.abs(cw - M.w) < 0.5 && gw === M.gw && gh === M.gh && pr === M.pr) return false;
    M.w = cw; M.h = ch; M.gw = gw; M.gh = gh; M.pr = pr; M.s = (cw * pr) / gw;
    el.style.width = cw + 'px'; el.style.height = ch + 'px'; document.documentElement.style.setProperty('--mm-h', Math.round(ch + 4) + 'px');
    el.width = base.width = Math.round(cw * pr); el.height = base.height = Math.round(ch * pr);
    M.dirty = true; return true;
  }
  const px = (v) => (GRID.col[v] + 0.5 * (GRID.row[v] & 1) + 0.5) * M.s, py = (v) => (GRID.row[v] * 0.866 + 0.5) * M.s;
  function cell(v) {
    let c = FOGC;
    if (seen[v]) c = road[v] && ter[v] !== T.WATER ? ROADC : COLS[ter[v]];
    bctx.fillStyle = c; bctx.fillRect(px(v) - M.s * 0.5 - 0.3, py(v) - M.s * 0.55, M.s + 0.6, M.s * 1.1);
  }
  function drawBase() {
    if (M.dirty) { bctx.fillStyle = '#1d3d6a'; bctx.fillRect(0, 0, base.width, base.height); for (let v = 0; v < NV; v++) cell(v); M.dirty = false; }
    else if (M.fresh) for (const v of M.fresh) cell(v);
    M.fresh = null;
  }
  const _a = new THREE.Vector3();
  function viewPoly() {
    const pts = [], W = innerWidth, H = innerHeight, D = viewDist(cam.dist) * 2.6;
    for (const [x, y] of [[0, lay.mapT || 0], [W, lay.mapT || 0], [W, lay.mapB || H], [0, lay.mapB || H]]) {
      ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, camera); _gp.constant = -cam.y;
      let p = ray.ray.intersectPlane(_gp, _a);
      if (!p || p.distanceTo(camFocus) > D) { const d = ray.ray.direction; const k = Math.hypot(d.x, d.z) || 1; p = _a.set(camFocus.x + d.x / k * D, 0, camFocus.z + d.z / k * D); }
      pts.push([(p.x / CELL + 0.5) * M.s, (p.z / CELL + 0.5) * M.s]);
    }
    return pts;
  }
  function draw(now, force) {
    if (G.mode !== 'map' || $('hud').hidden) return;
    if (size()) force = true;
    if (!force && now - M.t < 80) return;
    let sig = `${cam.x.toFixed(2)},${cam.z.toFixed(2)},${cam.yaw.toFixed(2)},${cam.dist.toFixed(1)},${M.dirty ? 1 : 0}${M.fresh ? M.fresh.length : 0}`;
    for (const hr of G.heroes) if (hr.alive) sig += ',' + hr.v;
    for (const t of G.towns) sig += ',' + t.p;
    sig += ',' + G.objects.reduce((n, o) => n + (o.owner > -1 ? o.owner + 1 : 0), 0);
    if (!force && sig === M.sig) return;
    M.sig = sig; M.t = now;
    drawBase();
    ctx.drawImage(base, 0, 0);
    const s = M.s, dot = (v, r, fill, line) => { ctx.beginPath(); ctx.arc(px(v), py(v), r, 0, 6.283); ctx.fillStyle = fill; ctx.fill(); if (line) { ctx.lineWidth = Math.max(1, s * 0.35); ctx.strokeStyle = line; ctx.stroke(); } };
    for (const o of G.objects) if (o.alive && seen[o.v] && OBJECTS[o.type]?.kind === 'mine') dot(o.v, Math.max(1.5, s * 0.75), o.owner >= 0 ? G.players[o.owner]?.css || '#999' : '#c9c2b0', 'rgba(0,0,0,0.55)');
    for (const t of G.towns) if (seen[t.v] || t.p === 0) {
      const r = Math.max(3, s * 1.5); ctx.fillStyle = t.p >= 0 ? G.players[t.p]?.css || '#bbb' : '#c8c8cc';
      ctx.fillRect(px(t.v) - r, py(t.v) - r, r * 2, r * 2); ctx.lineWidth = Math.max(1, s * 0.4); ctx.strokeStyle = '#fff8e0'; ctx.strokeRect(px(t.v) - r, py(t.v) - r, r * 2, r * 2);
    }
    for (const hr of G.heroes) if (hr.alive && (hr.p === 0 || seen[hr.v])) dot(hr.v, Math.max(2.4, s * 1.15), G.players[hr.p]?.css || '#fff', hr.p === 0 ? '#ffffff' : '#000000');
    // the ground in view
    const P = viewPoly();
    ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.lineWidth = Math.max(1, M.pr); ctx.strokeStyle = 'rgba(255,246,214,0.95)'; ctx.stroke();
  }
  // tap / drag: fly the view there
  let down = false;
  const go = (e) => {
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) * M.pr / M.s - 0.5, z = (e.clientY - r.top) * M.pr / M.s - 0.5;
    const v = GRID.cellAt(x * CELL, z * CELL);
    if (v >= 0) { cam.holdFollow = walking || (aiRunning ? 'ai' : null); flyTo(v); }
  };
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); down = true; try { el.setPointerCapture(e.pointerId); } catch {} go(e); sfx.click(); }, { passive: true });
  el.addEventListener('pointermove', (e) => { if (down) go(e); }, { passive: true });
  const up = () => { down = false; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  return { draw, mark(cells) { if (cells === 'full') M.dirty = true; else if (cells) M.fresh = M.fresh ? M.fresh.concat(cells) : cells.slice(); }, el };
})();
// heroes are persistent so they can walk smoothly
const heroMeshes = new Map();
function layoutHeroes(force = false) {
  for (const hr of G.heroes) {
    let m = heroMeshes.get(hr.id);
    if (!hr.alive || (!seen[hr.v] && hr.p !== 0)) { if (m) { scene.remove(m); heroMeshes.delete(hr.id); } continue; }
    let fresh = false;
    if (!m) {
      m = addBlob(meshOf(heroGeo(hr.p)), 0.5); if (!inkLod) for (const c of m.children) if (c.userData.ink) c.visible = false;
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
  if (m.userData.fwd) faceQuat(m.quaternion, UP, m.userData.fwd);
}
// pose a hero part-way along a step a→b: kk is the fraction travelled (may go out and back for a bump)
const _qT = new THREE.Quaternion(), _ZF = new THREE.Vector3(0, 0, 1), _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _up = new THREE.Vector3(), _dv = new THREE.Vector3();
function poseStep(m, a, b, kk, dt) {
  _pa.set(GRID.X[a], radiusOf(a), GRID.Z[a]); _pb.set(GRID.X[b], radiusOf(b), GRID.Z[b]);
  _dv.set(0, Math.sin(Math.min(1, Math.abs(kk)) * Math.PI) * 0.015, 0); // a little hop
  m.position.copy(_pa).lerp(_pb, kk).add(_dv);
  // turn toward the way we go through a critically damped spring on the remaining angle (m.userData.turnV = its
  // speed): the turn accelerates out of rest and settles in ~0.25 s, instead of an exponential chase that swung
  // 25-33° in the very first frame of a walk; velocity carries across steps, so mid-route bends stay fluid
  faceQuat(_qT, _up.copy(UP), _dv.copy(_pb).sub(_pa));
  const ang = m.quaternion.angleTo(_qT);
  if (ang > 1e-4 && dt > 0) {
    // (smoothDamp toward 0, inlined: no per-frame array)
    const w = 2 / 0.085, k = w * dt, e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k), tmp = ((m.userData.turnV || 0) + w * ang) * dt;
    const na = (ang + tmp) * e; m.userData.turnV = ((m.userData.turnV || 0) - w * tmp) * e;
    m.quaternion.slerp(_qT, clamp(1 - Math.max(0, na) / ang, 0, 1));
  } else m.userData.turnV = 0;
  (m.userData.fwd ||= new THREE.Vector3()).copy(_ZF).applyQuaternion(m.quaternion);
}
// cubic easing over one step: starts at speed s0, ends at speed s1 (1 = the steady walking pace)
const stepEase = (k, s0, s1) => ((s0 + s1 - 2) * k + (3 - 2 * s0 - s1)) * k * k + s0 * k;
// bumping into something: out toward it and back to the start; v0 = entry speed in step-fractions per bump duration
const bumpEase = (k, v0) => { const u = 1 - k; return v0 * k * u * u + 16 * Math.max(0, 0.38 - v0 * 4 / 27) * k * k * u * u; };
// path preview: green dots for today, red for later days, a banner on the goal
const fx = createMapFx(THREE, scene, { DIRS: null, radiusOf, posOf, flat: true, count: () => NV });
let plan = null;
function showPath(hr, path) {
  plan = path ? { hr: hr.id, path } : null;
  if (!path) { fx.clearPath(); return; }
  fx.showPath(path, stepsToday(hr, path));
}

// ------------------------------------------------------------------ input: drag pans the map, pinch zooms (twist turns), tap selects and moves
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
// exact: a ray against the terrain chunks' triangles (tops, bevels and cliff walls), each mapped back to its cell
function pickCell(cx, cy) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return TERRAIN.pick(ray);
}
// where a screen point meets the ground plane at the focus height (for 1:1 panning); null near/above the horizon
const _gp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _gHit = new THREE.Vector3();
function groundPoint(cx, cy, out) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera); _gp.constant = -cam.y;
  if (!ray.ray.intersectPlane(_gp, out)) return null;
  return out.distanceTo(camFocus) > viewDist(cam.dist) * 3 ? null : out;
}
const ptrs = new Map();
let press = null, pinch = null;
const cvs = renderer.domElement;
// taps fire on pointerup (no click, no 300 ms wait: touch-action is none); a press becomes a drag past TAP_SLOP px.
// Map drags only feed cam.dragX/dragZ (applied once per frame); the last ~100 ms of samples give the fling speed.
const TAP_SLOP = 8, TAP_MS = 500, FLING_WIN = 100, FLING_STALE = 60;
const camMode = () => G.mode !== 'battle' && G.mode !== 'town';
const _gA = new THREE.Vector3(), _gB = new THREE.Vector3();
function startPress(e, x, y, moved) {
  press = { id: e.pointerId, x, y, lx: x, ly: y, t: performance.now(), ts: e.timeStamp, moved, noTap: moved, samples: [] };
}
// the ground under the finger moves with it: the drag is the difference of the two ground points (x, y: where the
// finger is now; dx, dy: how far it moved); near the horizon it falls back to the scale at the focus
function camDrag(dx, dy, ts, x = innerWidth / 2, y = innerHeight / 2) {
  let wx, wz;
  const a = groundPoint(x - dx, y - dy, _gA), b = a && groundPoint(x, y, _gB);
  if (a && b) { wx = a.x - b.x; wz = a.z - b.z; }
  else {
    const fov = THREE.MathUtils.degToRad(camera.fov), k = 2 * viewDist(cam.dist) * Math.tan(fov / 2) / innerHeight, sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), f = k / Math.sin(viewPitch(cam.dist));
    wx = -dx * k * cy + dy * f * -sy; wz = dx * k * sy + dy * f * -cy;
  }
  cam.dragX += wx; cam.dragZ += wz; cam.dragging = true;
  if (press) { press.samples.push([ts, wx, wz]); while (press.samples.length > 2 && ts - press.samples[0][0] > FLING_WIN) press.samples.shift(); }
}
function camRelease(ts) {
  // fling only if the finger was still moving when it lifted; speed is averaged over the last ~100 ms
  cam.dragging = false;
  const S = press?.samples || [];
  if (!S.length || ts - S[S.length - 1][0] > FLING_STALE) return;
  const t0 = S[0][0], span = Math.max(16, ts - t0) / 1000;
  let a = 0, b = 0; for (const [, x, y] of S) { a += x; b += y; }
  const vx = a / span, vz = b / span, sp = Math.hypot(vx, vz), mx = flingMax(), k = sp > mx ? mx / sp : 1;
  cam.vx = vx * k; cam.vz = vz * k;
}
cvs.addEventListener('pointerdown', (e) => {
  try { cvs.setPointerCapture(e.pointerId); } catch {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size > 2) return;
  if (ptrs.size === 2) {
    const [p, q] = [...ptrs.values()];
    pinch = { d: Math.max(1, Math.hypot(p.x - q.x, p.y - q.y)), dist: G.mode === 'battle' ? bview.dist : cam.tDist, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, ang: Math.atan2(q.y - p.y, q.x - p.x), twist: 0 };
    press = null; if (camMode()) camGrab(); return;
  }
  // touching a gliding map just stops it: that touch is a grab, not a tap (a flight only stops once the finger drags)
  const gliding = Math.hypot(cam.vx, cam.vz) > 0.2 * viewDist(cam.dist);
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
      // two fingers also pan (the map follows their midpoint) and turn it: a twist past ~10 degrees starts the turn
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      camDrag(mx - pinch.mx, my - pinch.my, e.timeStamp, mx, my); pinch.mx = mx; pinch.my = my;
      const ang = Math.atan2(b.y - a.y, b.x - a.x), da = wrapPi(ang - pinch.ang); pinch.ang = ang;
      pinch.twist += da;
      if (Math.abs(pinch.twist) > 0.17 || pinch.turning) { if (!pinch.turning) { pinch.turning = true; cam.dragYaw += pinch.twist; } else cam.dragYaw += da; }
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
  camDrag(dx, dy, e.timeStamp, e.clientX, e.clientY);
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
  // the press length from the events' own timestamps: a long frame (battle entry, a heavy dialog) delays the handler,
  // not the finger, so a wall-clock check used to drop real taps
  else if (!press.noTap && e.timeStamp - press.ts < TAP_MS) { if (G.mode === 'battle') battleTap(e.clientX, e.clientY); else if (G.mode === 'map') mapTap(e.clientX, e.clientY); else if (G.mode === 'town') townTap(e.clientX, e.clientY); }
  press = null; cam.dragging = false;
};
const dropPtrs = () => { ptrs.clear(); press = null; pinch = null; cam.dragging = false; cam.dragX = cam.dragZ = cam.dragYaw = 0; cam.vx = cam.vz = 0; };
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
    if (e.shiftKey || e.altKey) { cam.tYaw += clamp(dy, -150, 150) * 0.004; return; } // desktop: shift + wheel turns the view
    cam.tDist = clamp(cam.tDist * Math.exp(clamp(dy, -150, 150) * 0.0011), 6.4, 22);
  }
}, { passive: false });

const selHero = () => (G.selHero >= 0 && G.heroes[G.selHero]?.alive && G.heroes[G.selHero].p === 0 ? G.heroes[G.selHero] : null);
let lastMapTap = { v: -1, t: 0 };
function mapTap(cx, cy) {
  if (busy()) return;
  const v = pickCell(cx, cy);
  if (v === null) return;
  // double tap on one of your towns (even with a hero standing in it): open it for building / recruiting
  const now = performance.now(), dbl = lastMapTap.v === v && now - lastMapTap.t < 450;
  lastMapTap = dbl ? { v: -1, t: 0 } : { v, t: now };
  if (dbl && seen[v] && objAt[v] >= 0) {
    const ot = G.objects[objAt[v]];
    if (ot.alive && ot.type === 'town' && G.towns[ot.t].p === 0) { showPath(selHero(), pendingRoute(selHero())); openTown(ot.t); return; }
  }
  const hr = selHero();
  const mine = heroAt(v);
  if (mine && mine.p === 0) { selectHero(mine.id); return; }
  if (!seen[v]) { toast('Unexplored land.'); return; }
  const o = objAt[v] >= 0 && G.objects[objAt[v]].alive ? G.objects[objAt[v]] : null;
  // your own town: like any goal, tap shows the route and tapping again walks there; arriving opens the town screen
  // (a quick double tap opens it straight away, see above)
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
  else { const O = OBJECTS[o.type]; toast(`${O.icon} ${O.name}${o.type === 'artifact' ? `: ${ARTIFACTS.find((a) => a.id === o.art).name}` : ''}${O.kind === 'mine' ? ` · ${o.owner === 0 ? 'yours' : o.owner > 0 ? (G.players[o.owner]?.name || 'enemy') : 'unclaimed'} (+${O.amount} ${RES_ICON[O.res]}/day)` : O.desc ? ` · ${O.desc}` : ''}${o.type === 'shrine' ? `: ${SPELLS[o.spell].name}` : ''}`); }
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
  if (offView(hr.v)) flyTo(hr.v, cam.tDist);
  startWalk(hr, path);
}

// ------------------------------------------------------------------ walking
let walking = null;
const busy = () => !!walking || G.mode !== 'map' || aiRunning;
function startWalk(hr, path) {
  const n = stepsToday(hr, path);
  if (n < 1) { toast('Not enough movement left today. End the turn.'); sfx.deny(); return; } // (an unfinished march stays stored)
  hr.route = null; hr.routeObj = -1;
  walking = { hr, path, i: 0, t: 0, n };
  // perf: marching on your own town / a fight -> its idle warm-up jobs run now, not on arrival
  if (hr.p === 0) { const e = objAt[path[path.length - 1]], o = e >= 0 ? G.objects[e] : null; if (o?.type === 'town' && G.towns[o.t]?.p === 0) bumpWarm('town'); else if (o?.type === 'monster' || o?.type === 'town') bumpWarm('battle', [o.unit, ...(hr.army || []).map((st) => st?.[0])]); }
  // feel: the route stays drawn while the hero walks it and is consumed underfoot (fx.eatPath in updateWalk);
  // it is only re-drawn if the planned one differs (a resumed march re-routed around something)
  const same = plan && plan.hr === hr.id && plan.path.length === path.length && plan.path.every((v, i) => v === path[i]);
  plan = null;
  if (!same) fx.showPath(path, n);
  updateHud();
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
    let kk = bump ? bumpEase(k, start ? 0 : 6 * BUMP_T) : stepEase(k, start ? 0 : f, stop ? 0 : f);
    // anticipation: setting off, the hero first rocks back a hair (while it turns) before stepping out
    if (start && !bump && !reduceMo.matches) kk -= 0.045 * Math.sin(Math.PI * Math.min(1, k / 0.32));
    poseStep(m, a, b, kk, dt);
    fx.eatPath(W.i + Math.max(0, kk));
  }
  if (W.t < 1) return;
  W.t = bump || stop ? 0 : W.t - 1;
  // arrive at b (or back at a after a bump)
  if (target) { if (onto) hr.mp = Math.max(0, hr.mp - stepCost(a, b)); walking = null; fx.clearPath(); layoutHeroes(true); interact(hr, b); return; } // stepping onto a pickup costs the step like any other
  hr.mp -= stepCost(a, b); hr.v = b; W.i++;
  if (reveal(b, visionOf(hr))) worldDirty = true;
  sfx.step({ kind: 'hoof' });
  if (seen[b]) fx.burst('step', posOf(b));
  // a monster next to the path attacks
  const lurker = lurkerAt(b, W);
  if (lurker) {
    // keep the rest of the march so it can be resumed after the ambush (Continue ▶ / tap the goal again)
    walking = null; fx.clearPath(); layoutHeroes(true);
    if (W.i < W.path.length - 1) { hr.route = W.path.slice(W.i); hr.routeObj = objAt[hr.route[hr.route.length - 1]]; }
    updateHud(); interact(hr, lurker.v); return;
  }
  if (W.i >= W.n) {
    fx.burst('dust', posOf(hr.v));
    walking = null; layoutHeroes(true);
    if (W.i < W.path.length - 1) { hr.route = W.path.slice(W.i); hr.routeObj = objAt[hr.route[hr.route.length - 1]]; showPath(hr, hr.route); } else { hr.route = null; hr.routeObj = -1; fx.clearPath(); }
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
  if (p === 0) { floatText(v >= 0 ? posOf(v, 0.2) : null, `+${fmt(n)} ${RES_ICON[res]}`, 'gold'); if (v >= 0 && n > 0) flyRes(posOf(v, 0.2), res, n); }
}
// feel: picked-up resources fly from the map to their HUD counter (1-4 icons along a short arc, Web Animations on the
// compositor: no per-frame JS), each landing with a soft tick; the counter then pops and counts up (updateRes/tickRes)
const resFly = { gold: 0, wood: 0, ore: 0, gems: 0 }; // performance.now() when the first icon lands on each counter
const _flyV = new THREE.Vector3();
function flyRes(pos, res, n) {
  if (reduceMo.matches || G.mode !== 'map' || $('hud').hidden) return;
  const dst = $(`r-${res}`)?.parentElement?.firstElementChild; if (!dst) return;
  const v = _flyV.copy(pos).project(camera); if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return;
  const x0 = (v.x * 0.5 + 0.5) * innerWidth, y0 = (-v.y * 0.5 + 0.5) * innerHeight;
  const r = dst.getBoundingClientRect(); if (!r.width) return;
  const x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
  const cnt = clamp(Math.floor(Math.log10(Math.max(1, n))), 1, 4), dur = 640, gap = 75, box = $('floaters');
  resFly[res] = performance.now() + dur;
  for (let i = 0; i < cnt; i++) {
    const el = document.createElement('i'); el.className = 'flyres'; el.innerHTML = icon(res, 26); box.appendChild(el);
    const jx = (i - (cnt - 1) / 2) * 22, at = (x, y, sc) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${sc})`;
    const a = el.animate([
      { transform: at(x0, y0, 0.3), opacity: 0, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      { transform: at(x0 + jx, y0 - 34 - i * 4, 1.15), opacity: 1, offset: 0.3, easing: 'cubic-bezier(0.55, 0, 0.85, 0.35)' },
      { transform: at(x1, y1, 0.7), opacity: 0.95 },
    ], { duration: dur, delay: i * gap, fill: 'both' });
    a.onfinish = () => { el.remove(); sfx.tab({ vol: 0.4, pitch: 1.15 + i * 0.09 }); replay(dst.parentElement, 'land'); };
    a.oncancel = () => el.remove();
  }
}
// only that object's mesh goes (shared geometries stay cached); the rest of the world is untouched
function removeObject(o) { o.alive = false; if (objAt[o.v] === o.id) objAt[o.v] = -1; if (objMeshes.has(o.id)) { dropObjMesh(o.id); renderer.shadowMap.needsUpdate = true; } }
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
  if (you && (o.type === 'monster' || o.type === 'town' || guardOf(v))) bumpWarm('battle', [o.type === 'monster' ? o.unit : guardOf(v)?.unit, ...(o.type === 'town' ? (G.towns[o.t].garrison || []).map((st) => st?.[0]) : []), ...(hr.army || []).map((st) => st?.[0])]); // a fight may follow
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
    else if (o.type === 'chest' && G.run && you) { crownPack(CR.chestPack(G.run, o.id), `chest:${o.id}`); sfx.chest(); } // crown: chests hold packs
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
  const nOpt = G.run && hr.p === 0 ? 3 : 2; // crown: Crown Run level-ups offer 3 skills
  while (opts.length < nOpt && fresh.length && Object.keys(hr.skills).length < 6) { const k = fresh.splice((rnd() * fresh.length) | 0, 1)[0]; opts.push(k); }
  while (opts.length < nOpt && have.some((k) => !opts.includes(k))) { const k = have[(rnd() * have.length) | 0]; if (!opts.includes(k)) opts.push(k); }
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
// battle hex highlights: one instanced mesh; every hex has its own colour and alpha (aHexA scales the base
// opacity) and both ease toward their targets in stepHexes(), so highlights fade in/out instead of popping
const HEXN = BT.COLS * BT.ROWS;
const hexA = new THREE.InstancedBufferAttribute(new Float32Array(HEXN), 1); hexGeo.setAttribute('aHexA', hexA);
const hexMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.26, depthWrite: false });
hexMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute float aHexA;\nvarying float vHexA;\nvoid main() {\nvHexA = aHexA;');
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vHexA;\nvoid main() {').replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vHexA;');
};
hexMat.customProgramCacheKey = () => 'hexFade';
const hexes = new THREE.InstancedMesh(hexGeo, hexMat, HEXN);
hexes.frustumCulled = false; bscene.add(hexes);
for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) { dummy.position.copy(hexPos(c, r)); dummy.quaternion.identity(); dummy.scale.setScalar(0.0001); dummy.updateMatrix(); hexes.setMatrixAt(BT.key(c, r), dummy.matrix); hexes.setColorAt(BT.key(c, r), new THREE.Color(0xffffff)); }
const hexT = { col: new Float32Array(HEXN * 3), a: new Float32Array(HEXN), on: new Uint8Array(HEXN), busy: true, snap: true };
function hexTarget(k, col, a) { hexT.col[k * 3] = col.r; hexT.col[k * 3 + 1] = col.g; hexT.col[k * 3 + 2] = col.b; hexT.a[k] = a; hexT.busy = true; }
function stepHexes(dt) {
  if (!hexT.busy) return;
  const C = hexes.instanceColor.array, A = hexA.array, ka = hexT.snap ? 1 : 1 - Math.exp(-dt * 14), kc = hexT.snap ? 1 : 1 - Math.exp(-dt * 18);
  let busy = false, mat = false;
  for (let k = 0; k < HEXN; k++) {
    const ta = hexT.a[k];
    // a hex fading in from nothing takes its new colour at once; otherwise colours blend (green -> red etc.)
    const fresh = A[k] < 0.004;
    for (let j = k * 3; j < k * 3 + 3; j++) { const d = hexT.col[j] - C[j]; if (fresh) C[j] = hexT.col[j]; else if (Math.abs(d) > 0.002) { C[j] += d * kc; busy = true; } else C[j] = hexT.col[j]; }
    const da = ta - A[k]; if (Math.abs(da) > 0.003) { A[k] += da * ka; busy = true; } else A[k] = ta;
    // hexes at zero alpha shrink away so they cost no fill
    const on = A[k] > 0.003 ? 1 : 0;
    if (on !== hexT.on[k]) { hexT.on[k] = on; dummy.position.copy(hexPos(k % BT.COLS, (k / BT.COLS) | 0)); dummy.quaternion.identity(); dummy.scale.setScalar(on ? 0.92 : 0.0001); dummy.updateMatrix(); hexes.setMatrixAt(k, dummy.matrix); mat = true; }
  }
  hexes.instanceColor.needsUpdate = true; hexA.needsUpdate = true; if (mat) hexes.instanceMatrix.needsUpdate = true;
  hexT.busy = busy; hexT.snap = false;
}
// attack-from marker: a gold chevron on the hex the attacker will strike from, pointing at the target
const atkArrow = (() => {
  const s = new THREE.Shape(); const L = HS * 0.62, W = HS * 0.34, N = HS * 0.16;
  s.moveTo(0, L * 0.55); s.lineTo(W, -L * 0.1); s.lineTo(W * 0.42, -L * 0.1); s.lineTo(W * 0.42, -L * 0.5); s.lineTo(-W * 0.42, -L * 0.5); s.lineTo(-W * 0.42, -L * 0.1); s.lineTo(-W, -L * 0.1); s.closePath();
  const g = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); g.translate(0, 0, -N);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd84a).multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  m.renderOrder = 9; m.visible = false; m.userData = { a: 0, ta: 0, t: 0 };
  return m;
})();
bscene.add(atkArrow);
function stepArrow(dt) {
  const u = atkArrow.userData; u.t += dt;
  u.a += (u.ta - u.a) * (1 - Math.exp(-dt * 16)); if (Math.abs(u.ta - u.a) < 0.01) u.a = u.ta;
  atkArrow.visible = u.a > 0.01;
  // a gentle nudge toward the target
  if (atkArrow.visible) { atkArrow.material.opacity = u.a * (0.8 + 0.2 * Math.sin(u.t * 6)); atkArrow.position.copy(u.p0).addScaledVector(u.dir, 0.05 * Math.sin(u.t * 6)).setY(0.04); }
}
function showArrow(from, t) {
  const u = atkArrow.userData;
  if (!from || !t) { u.ta = 0; return; }
  const p0 = hexPos(from[0], from[1]), p1 = hexPos(t.c, t.r), dir = p1.clone().sub(p0).setY(0).normalize();
  // fading in somewhere new: jump there instead of sliding across the field
  u.p0 = p0.addScaledVector(dir, HS * 0.28); u.dir = dir; u.ta = 1;
  atkArrow.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
}
const bstuff = new THREE.Group(); bscene.add(bstuff);
const wallMat = new THREE.MeshStandardMaterial({ color: 0xb8ae9a, roughness: 0.9, flatShading: true });
const activeRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 30).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd84a, toneMapped: false }));
bscene.add(activeRing); activeRing.visible = false;
const vfx = createVfx(THREE, bscene);
// ---- loading: New game / Continue -> playable map.
// Only what the first seconds of play need runs behind the loader: the map's shader programs (compileAsync: in
// parallel where KHR_parallel_shader_compile exists, so the bar keeps moving) and the HUD's hero portraits.
// Everything else (own town, battle programs + arenas, enemy walls) is queued for idle time
// after the loader (postwarm below), most-likely-needed first; a battle or town opened before its job ran still
// builds what it needs itself (prepBattle's curtain, setTown), and bumpWarm('battle') pulls the battle jobs forward
// as soon as a fight is offered (monster / guard / siege dialog).
let loadProf = null; // __realms.prewarmProfile(): [label, ms] per loader and postwarm job (perf checks)
// Compile against a half-float render target like post's: three keys programs on the target (no tone mapping and linear
// output off-screen vs ACES + sRGB on the canvas), and every view is drawn through post into rtScene, so a compile with
// the canvas bound would build variants no frame ever uses while the real ones still compiled on the first draw.
const warmRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
function compileSoon(sc, cm, ms = 6000, target = null) {
  const prev = renderer.getRenderTarget();
  let p;
  renderer.setRenderTarget(warmRT);
  try { p = renderer.compileAsync(sc, cm, target).catch((e) => console.warn('compile', e)); } catch (e) { p = Promise.resolve(); console.warn('compile', e); }
  finally { renderer.setRenderTarget(prev); }
  return Promise.race([p, new Promise((res) => setTimeout(res, ms))]);
}
function prewarm(onDone) {
  loadProf = [];
  const jobs = []; // [label, weight, fn]; fn may return a promise (awaited while the bar creeps on)
  jobs.push(['Shaping the world', 2, () => { if (worldDirty) layoutWorld(); }]);
  jobs.push(['Painting the world', 6, () => compileSoon(scene, camera)]);
  // the HUD's hero buttons (40 px round): rendered with a fenced readback, so waiting for it costs no main-thread stall
  if (G.heroes.some((h) => h.p === 0)) jobs.push(['Summoning heroes', 1, () => { const P = G.players[0]; return portraitAsync(heroPortraitId(P.fac, P.color), 40, 'round'); }]);
  const total = jobs.reduce((a, j) => a + j[1], 0), el = $('loader'), bar = $('ld-bar'), txt = $('ld-text');
  let done = 0, shown = 0;
  const show = (f) => { f = Math.min(1, Math.max(shown, f)); if (f - shown < 0.004 && f < 1) return; shown = f; bar.style.width = `${(f * 100).toFixed(1)}%`; };
  el.hidden = false; show(0.02);
  const yieldNow = () => new Promise((res) => setTimeout(res, 0));
  (async () => {
    await new Promise((res) => setTimeout(res, 30)); // let the loader paint first
    let t0 = performance.now();
    for (const [label, w, f] of jobs) {
      if (txt.textContent !== label + '…') txt.textContent = label + '…';
      const a = performance.now();
      let r = null; try { r = f(); } catch (e) { console.warn('prewarm', label, e); }
      if (r && typeof r.then === 'function') {
        // creep toward this job's end while it runs off the main thread, so the bar never sits still
        const to = (done + w) / total;
        const iv = setInterval(() => show(shown + (to - shown) * 0.12), 100);
        await r.catch(() => {}); clearInterval(iv); t0 = performance.now();
      }
      loadProf.push([label, Math.round(performance.now() - a)]);
      done += w; show(done / total);
      if (performance.now() - t0 > 40) { await yieldNow(); t0 = performance.now(); }
    }
    show(1);
    el.classList.add('done'); setTimeout(() => { el.hidden = true; el.classList.remove('done'); }, 350);
    onDone?.();
    postwarm(postJobs());
  })();
}
// the idle-time remainder of the warm-up, in priority order
// Draw a scene once into the tiny off-screen target (never the canvas: nothing flashes on screen). After compileSoon
// this costs no compile wait where programs link in parallel, and it does what a compile alone cannot: the shadow-pass
// depth programs, and every vertex buffer and texture upload, i.e. what used to make a first battle / town frame hitch.
function drawOffscreen(sc, cm) {
  const prev = renderer.getRenderTarget(), sh = renderer.shadowMap.needsUpdate;
  try { renderer.shadowMap.needsUpdate = true; renderer.setRenderTarget(warmRT); renderer.render(sc, cm); } catch (e) { console.warn('warm draw', e); }
  finally { renderer.setRenderTarget(prev); renderer.shadowMap.needsUpdate = sh; }
}
// Compile a group's programs one top-level child per idle slice, with `target`'s lights and fog: each slice only
// compiles that child's new programs, so a device without parallel shader compile gets a few short hitches instead
// of one long one (and where programs link in parallel, nothing waits at all).
const compileJobs = (k, label, root, cm, target) => root.children.map((c, i) => ({ k, label: `${label}.${i}`, f: () => compileSoon(c, cm, 6000, target) }));
function postJobs() {
  const out = [], add = (k, label, f) => out.push({ k, label, f });
  // battle first: the arena of the hero's own terrain + one creature, compiled piece by piece, then one off-screen draw
  const t0 = ter[G.heroes.find((h) => h.p === 0)?.v] ?? 1, terrs = [...new Set([t0, 1, 2, 3, 4, 5, 6, 7])];
  let a0 = null;
  add('battle', 'arena', () => {
    const m = meshOf(cached('upikeman', () => unitGeo('pikeman'))); setAnim(m, ANIM.IDLE);
    a0 = [createBattlefield(THREE, t0, hexPos, BT.COLS, BT.ROWS).group, m];
    const g = new THREE.Group(); g.children.push(...a0[0].children, m); // a view for compileJobs only (no reparenting)
    return { expand: [...compileJobs('battle', 'arena', g, bcam, bscene), { k: 'battle', label: 'arena draw', f: () => {
      if (G.mode === 'battle') return; // a battle in progress owns bscene
      bscene.add(...a0);
      bcam.position.set(0, 10.75, 10.6); bcam.lookAt(0, 0, -0.15);
      drawOffscreen(bscene, bcam);
      bscene.remove(...a0);
    } }] };
  });
  // the player's own town: geometry, programs piece by piece, one off-screen draw (opening it later is a DOM toggle)
  const myTown = G.towns.find((t) => t.p === 0);
  if (myTown) {
    add('town', 'town', () => {
      if (G.mode !== 'map') return;
      townView.highlight(null); townView.setTown({ fac: myTown.fac, built: myTown.built, name: myTown.name }); townView.update(1 / 60);
      return { expand: [...compileJobs('town', 'town', townView.scene, townView.camera, townView.scene), { k: 'town', label: 'town draw', f: () => { if (G.mode === 'map') drawOffscreen(townView.scene, townView.camera); } }] };
    });
  }
  // creature geometry + fits and every portrait size the UI uses come from warmGeometryIdle (its own idle queue)
  for (const fac of new Set(G.towns.filter((t) => t.p !== 0 && t.built.includes('fort')).map((t) => t.fac))) add('walls', 'walls ' + fac, () => { cached('wall_' + fac, () => wallModel(fac)); cached('gate_' + fac, () => gateModel(fac)); cached('tower_' + fac, () => towerModel(fac)); cached('keep_' + fac, () => keepModel(fac)); });
  // last: the other terrains' arenas (their own decor / water / lava programs). Only where programs link in parallel:
  // without KHR_parallel_shader_compile every compile occupies the GPU queue, and a fight started meanwhile would wait
  // behind compiles it does not need (prepBattle compiles its own arena behind the curtain anyway)
  if (renderer.extensions.has('KHR_parallel_shader_compile')) for (const t of terrs.slice(1)) add('battle2', 'arena ' + t, () => ({ expand: compileJobs('battle2', 'arena ' + t, createBattlefield(THREE, t, hexPos, BT.COLS, BT.ROWS).group, bcam, bscene) }));
  return out;
}
// One job per idle slice, only while the map is calm (warmCalm) and the browser reports idle time (forced by the idle
// timeout only once the first seconds of play are over); urgent (bumped) jobs run at once, calm or not. A job may
// return { expand: [jobs] }: those run next. Creature geometry (warmGeometryIdle) follows when this queue is empty.
const postQ = [];
let postT = 0, postIn = false, postT0 = 0;
function postSchedule(ms) { clearTimeout(postT); postT = setTimeout(() => { postT = 0; if (postQ[0]?.urgent) postRun(null); else idleCb(postRun); }, ms); }
function postwarm(jobs) { postQ.length = 0; postQ.push(...jobs); postT0 = performance.now(); postSchedule(1200); }
async function postRun(dl) {
  if (postIn) return;
  if (!postQ.length) { warmGeometryIdle(); return; }
  const j = postQ[0], forced = dl?.didTimeout && performance.now() - postT0 > 4000;
  if (!j.urgent && (!warmCalm() || (dl && !forced && dl.timeRemaining() < 4))) { postSchedule(250); return; }
  postIn = true; postQ.shift();
  const a = performance.now();
  let r = null;
  try { r = await j.f(); } catch (e) { console.warn('postwarm', j.label, e); }
  if (r?.expand) postQ.unshift(...r.expand.map((x) => Object.assign(x, { urgent: j.urgent })));
  loadProf?.push(['idle:' + j.label, Math.round(performance.now() - a)]);
  postIn = false;
  if (postQ.length) postSchedule(j.urgent ? 0 : 30); else warmGeometryIdle();
}
// bumpWarm('battle', [unit ids]): also the creatures of the fight on offer (geometry, battle fit, 64 px portrait), so
// prepBattle behind the curtain finds them cached instead of building them and reading portraits back synchronously
function bumpWarm(kind, ids = []) {
  const hit = postQ.filter((j) => j.k === kind);
  for (const id of new Set(ids)) {
    if (!id || !UNITS[id] || (geoCache.has('u' + id) && hasPortrait(id, 64)) || postQ.some((j) => j.label === 'foe ' + id)) continue;
    hit.push({ k: kind, label: 'foe ' + id, f: () => { unitFit(id, cached('u' + id, () => unitGeo(id)), 'battle'); return hasPortrait(id, 64) ? null : portraitAsync(id, 64); } });
  }
  if (!hit.length) return;
  for (const j of hit) { j.urgent = true; const i = postQ.indexOf(j); if (i >= 0) postQ.splice(i, 1); }
  postQ.unshift(...hit);
  if (!postIn) postSchedule(0);
}
// scenery around the field
let bpreview = null, BB = null, bctx = null, bmesh = new Map(), banim = [], bwait = 0, bspell = null, bauto = false;
function heroBattle(hr) { return { att: statOf(hr, 'att'), def: statOf(hr, 'def'), pow: statOf(hr, 'pow'), know: statOf(hr, 'know'), mana: hr.mana, skills: hr.skills, spells: hr.spells, luck: hr.arts.includes('clover') ? 1 : 0, morale: hr.arts.includes('banner') ? 1 : 0, name: hr.name, p: hr.p }; }
function splitMonster(o) {
  if (o.army) return o.army.map((st) => [...st]); // crown: a Blind's threat army comes ready-made
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
  const B = BT.createBattle({ armyA: sides[0].army, heroA: sides[0].hero ? heroBattle(sides[0].hero) : null, armyB: sides[1].army, heroB: sides[1].hero ? heroBattle(sides[1].hero) : null, town: foe.kind === 'town' ? { fort: foe.town.built.includes('fort'), side: playerDefends ? 0 : 1, power: Math.max(2, foe.town.built.length / 2) } : null, mods: crownMods({ sides, foe }) });
  const ctx = { hr, foe, sides, terrain: ter[foe.kind === 'monster' ? foe.obj.v : hr.v] };
  // a side with no living troops cannot fight: settle it at once. Opening the arena would never end (the enemy AI
  // has no target and never finishes its turn, or the player has nothing to attack).
  if (!BT.alive(B, 0).length || !BT.alive(B, 1).length) { B.over = { winner: BT.alive(B, 0).length ? 0 : 1 }; B.events.length = 0; finishBattle(B, ctx); return; }
  if (sides[0].owner !== 0 && sides[1].owner !== 0) {
    BT.autoResolve(B); finishBattle(B, ctx);
    // freeplay: rival crowns fighting each other (or a town) are resolved at once; in sight, the clash is shown
    const fv = foe.kind === 'hero' ? foe.hero.v : foe.kind === 'town' ? foe.town.v : foe.obj.v;
    if ((seen[hr.v] || seen[fv]) && (G.fog !== false || foe.kind !== 'monster')) {
      fx.burst('battle', posOf(fv, 0.3));
      if (foe.kind !== 'monster') {
        const foeName = foe.kind === 'hero' ? `${foe.hero.name} (${G.players[foe.hero.p].name})` : foe.town.name, won = B.over.winner === sides.findIndex((sd) => sd.hero === hr);
        toast(`⚔️ ${hr.name} (${G.players[hr.p].name}) ${won ? 'defeats' : 'falls to'} ${foeName}`);
      }
    }
    return;
  }
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
function curtain(on, exit = false) {
  if (on) { bcurtain.hidden = false; bcurtain.classList.toggle('exit', exit); bcurtain.classList.remove('off'); bcurtain.classList.add('on'); return; }
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
  try { await compileSoon(bscene, bcam, 2500); } catch (e) { console.warn('battle shaders', e); } // the off-screen variants post draws with
  if (!live()) return;
  bprep = null;
  $('battle').hidden = false;
  const town = ctx.foe && ctx.foe.kind === 'town' ? ctx.foe.town : null;
  const hs = ctx.sides.map((sd) => (sd.hero ? sd.hero.name : town && sd.army === town.garrison ? town.name : sd.owner < 0 ? 'Neutrals' : 'Garrison'));
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
  // a new field: highlights start from nothing (no fade from the last battle), no stale preview or arrow
  hexT.snap = true; hexT.a.fill(0); hexT.busy = true; bpreview = null; bhover = null; atkArrow.userData.a = atkArrow.userData.ta = 0; atkArrow.visible = false;
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
// canvas only when what it shows changes (count, kill preview, top member's HP).
// Readability: plates draw after the selection ring and particles (renderOrder), and their blending
// clears the scene alpha under them; post.render reads that as a mask and keeps bloom (the ring's and
// glowing creatures' halo) off the plate pixels.
const bplates = new THREE.Group(); bscene.add(bplates);
const bplateMap = new Map();
const PLATE_PX = 15, PLATE_FWD = 0.3, PLATE_BIAS = 0.22;
const plateA = new THREE.Vector3(), plateD = new THREE.Vector3();
// estimated kills shown on a plate while an attack/spell on that stack is being previewed (uid -> text)
const plateEst = new Map();
function plateMat(extra) {
  return new THREE.SpriteMaterial({ transparent: true, depthWrite: false, sizeAttenuation: false, fog: false, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, ...extra });
}
function makePlate(s) {
  const cv = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const sp = new THREE.Sprite(plateMat({ map: tex }));
  sp.renderOrder = 61; sp.frustumCulled = false; sp.visible = false;
  // x-ray ghost: same texture, no depth test, faint, drawn first so the real plate covers it where visible
  const ghost = new THREE.Sprite(plateMat({ map: tex, depthTest: false, opacity: 0.4 }));
  ghost.renderOrder = 60; ghost.frustumCulled = false; ghost.visible = false;
  sp.userData = { cv, tex, side: s.side, sig: '', pr: 0, ghost };
  bplateMap.set(s.uid, sp); bplates.add(ghost);
  return sp;
}
function drawPlate(sp, n, est = '', hpf = 1) {
  const u = sp.userData, pr = Math.min(3, Math.max(1, renderer.getPixelRatio()));
  const hq = hpf >= 0.999 ? 20 : Math.max(1, Math.round(hpf * 20)), sig = `${n}|${pr}|${est}|${hq}`;
  if (u.sig === sig) return;
  u.sig = sig; u.pr = pr;
  const txt = n >= 10000 ? `${Math.round(n / 1000)}k` : String(n);
  const h = Math.round(PLATE_PX * pr), cv = u.cv, g = cv.getContext('2d');
  const font = `900 ${Math.round(h * 0.78)}px Nunito, system-ui, sans-serif`, tfont = `900 ${Math.round(h * 0.74)}px Nunito, system-ui, sans-serif`;
  g.font = font;
  const pw = Math.max(Math.round(h * 1.5), Math.ceil(g.measureText(txt).width + h * 0.75));
  g.font = tfont;
  const tw = est ? Math.ceil(g.measureText(est).width + h * 0.6) : 0;
  // layout (device px, top to bottom): kill-preview tag, pill, HP bar; the space is always reserved so the
  // pill never shifts when a preview or a wound appears
  const pad = Math.round(2 * pr), tagH = Math.round(h * 0.95), barH = Math.round(h * 0.34);
  const w = Math.max(pw, tw) + pad * 2, H = pad + tagH + h + barH + pad;
  cv.width = w; cv.height = H;
  const x0 = (w - pw) / 2, y0 = pad + tagH;
  const dark = u.side === 1 ? '#4a0a0a' : '#0a1440';
  // a soft dark backing keeps the pill readable over bright ground, glows and spell light
  g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 2 * pr; g.shadowOffsetY = 0.5 * pr;
  g.beginPath(); g.roundRect(x0, y0, pw, h, h / 2); g.fillStyle = dark; g.fill(); g.restore();
  // the plate: rounded pill, faction-side colour, dark rim
  const lw = Math.max(1, pr), r = h / 2 - lw / 2;
  g.beginPath(); g.roundRect(x0 + lw / 2, y0 + lw / 2, pw - lw, h - lw, r);
  const grd = g.createLinearGradient(0, y0, 0, y0 + h);
  if (u.side === 1) { grd.addColorStop(0, '#f07a62'); grd.addColorStop(1, '#a0241c'); } else { grd.addColorStop(0, '#5a84f0'); grd.addColorStop(1, '#22409a'); }
  g.fillStyle = grd; g.fill(); g.lineWidth = lw; g.strokeStyle = dark; g.stroke();
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = Math.max(2, pr * 1.6); g.strokeStyle = dark; g.strokeText(txt, w / 2, y0 + h * 0.54);
  g.fillStyle = '#fff'; g.fillText(txt, w / 2, y0 + h * 0.54);
  // top member's HP (only once it is wounded)
  if (hq < 20) {
    const bw = Math.round(pw * 0.8), bx = (w - bw) / 2, by = y0 + h + Math.round(barH * 0.2), bh = Math.max(2, Math.round(barH * 0.62));
    g.beginPath(); g.roundRect(bx, by, bw, bh, bh / 2); g.fillStyle = 'rgba(10,6,4,0.85)'; g.fill();
    const f = hq / 20, fw = Math.max(bh, (bw - 2) * f);
    g.beginPath(); g.roundRect(bx + 1, by + 1, fw, bh - 2, (bh - 2) / 2); g.fillStyle = f > 0.6 ? '#62e04e' : f > 0.3 ? '#ffd23c' : '#ff5a3a'; g.fill();
  }
  // estimated kills of the attack/spell being previewed, red on a dark tag above the pill
  if (est) {
    const tx = (w - tw) / 2, ty = pad, th = tagH - Math.round(h * 0.12);
    g.beginPath(); g.roundRect(tx, ty, tw, th, th / 2.4); g.fillStyle = 'rgba(28,4,4,0.88)'; g.fill(); g.lineWidth = lw; g.strokeStyle = '#ff6a5a'; g.stroke();
    g.font = tfont; g.fillStyle = '#ff6a5a'; g.fillText(est, w / 2, ty + th * 0.54);
  }
  // the sprite's anchor stays on the pill's centre
  sp.center.set(0.5, 1 - (y0 + h / 2) / H); u.ghost.center.copy(sp.center);
  u.H = H;
  u.tex.dispose(); u.tex.needsUpdate = true; // canvas size can change: drop the old GPU texture
}
// shown count (what the player has SEEN) -> plate text/visibility. The HP bar follows the top member's HP
// only once the plate shows the real count (pending hits keep the last seen value).
function setPlate(s) {
  const sp = bplateMap.get(s.uid); if (!sp) return;
  if (s.shown === s.count) s.shownHp = s.count > 0 ? s.hp / s.u.hp : 1;
  const est = plateEst.get(s.uid) || '';
  // a previewed target's plate (with its kill estimate) is the focus: it draws over whatever stands in front of it
  if (sp.material.depthTest !== !est) sp.material.depthTest = !est;
  if (s.shown > 0) drawPlate(sp, s.shown, est, s.shownHp ?? 1);
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
    if (sp.userData.pr !== pr) setPlate(s);
    const cv = sp.userData.cv, k = cv.height / (PLATE_PX * pr); sp.scale.set((sy * k * cv.width) / cv.height, sy * k, 1);
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
  bplates.clear(); bplateMap.clear(); plateEst.clear();
}
// highlight palette (battle hexes)
const HX = { grn: new THREE.Color(0xb6ff7c), red: new THREE.Color(0xff6a5a), blu: new THREE.Color(0x7ac8ff), vio: new THREE.Color(0xd2a0ff), gold: new THREE.Color(0xffd84a) };
const killTxt = (lo, hi) => (lo === hi ? `−${lo}` : `−${lo}…${hi}`);
// stacks of d that a flat hit of dmg would kill (no dice: spell damage)
function killsBy(d, dmg) { const pool = (d.count - 1) * d.u.hp + d.hp; return dmg >= pool ? d.count : Math.max(0, d.count - Math.ceil((pool - dmg) / d.u.hp)); }
const spellValid = (id, t) => { const S = SPELLS[id]; return S.target === 'area' || (!!t && t.count > 0 && ((S.target === 'enemy' && t.side === 1) || (S.target === 'ally' && t.side === 0))); };
function refreshBattle() {
  const B = BB; if (!B) return;
  // highlight what the active stack can do
  const s = B.active, mineTurn = s && sideOwner(s.side) === 0 && !bauto && !B.over && !banim.length;
  // the preview (tap 1 / mouse hover) only lives during the player's own turn, on a live target, in the matching mode
  if (!mineTurn) { bpreview = null; bhover = null; }
  if (bpreview && bpreview.uid >= 0 && !(B.stacks[bpreview.uid]?.count > 0)) bpreview = null;
  if (bpreview && (bpreview.kind === 'spell') !== !!bspell) bpreview = null;
  const pv = bpreview, S = bspell ? SPELLS[bspell] : null, pt = pv && pv.uid >= 0 ? B.stacks[pv.uid] : null;
  // estimated kills on the previewed target's plate (every stack an area spell would hit, own ones included)
  plateEst.clear();
  let pmsg = '';
  if (pv && pv.kind === 'atk' && pt) {
    const est = BT.estimate(B, s, pt, pv.shoot);
    plateEst.set(pt.uid, killTxt(est.klo, est.khi));
    pmsg = `${icon(pv.shoot ? 'shots' : 'attack', 16)} ${est.lo === est.hi ? est.lo : `${est.lo}–${est.hi}`} damage · kills ${est.klo === est.khi ? est.klo : `${est.klo}–${est.khi}`} of ${pt.count} ${plural(pt.id, pt.count)} · <b>${pv.src === 'hover' ? 'click' : 'tap again'} to strike</b>`;
  } else if (pv && pv.kind === 'spell') {
    const dmg = BT.spellDamage ? BT.spellDamage(B, 0, bspell) : 0;
    const hit = S.target === 'area' ? B.stacks.filter((x) => x.count > 0 && BT.dist(x, [pv.c, pv.r]) <= 1) : pt ? [pt] : [];
    let kills = 0;
    if (dmg > 0) for (const x of hit) { const k = killsBy(x, dmg); plateEst.set(x.uid, killTxt(k, k)); if (x.side === 1) kills += k; }
    const own = S.target === 'area' && hit.some((x) => x.side === 0);
    pmsg = `${icon(bspell, 18)} <b>${S.name}</b>${pt ? ` on ${UNITS[pt.id].name} ×${pt.count}` : hit.length ? ` hits ${hit.length} stack${hit.length > 1 ? 's' : ''}` : ''}${dmg ? ` · ${dmg} damage · kills ${kills}` : ''}${own ? ' · <b>hits your troops too!</b>' : ''} · <b>${pv.src === 'hover' ? 'click' : 'tap again'} to cast</b>`;
  }
  for (const st of B.stacks) {
    // labels show what the player has SEEN: pending attack animations update them on impact
    if (!banim.length || st.shown === undefined) st.shown = st.count;
    setPlate(st);
  }
  const reach = mineTurn && !bspell ? BT.reachable(B, s) : null;
  const canHit = new Map();
  const attackable = (st) => { if (!canHit.has(st.uid)) canHit.set(st.uid, BT.canShoot(B, s) || BT.nbrs(st.c, st.r).some(([x, y]) => x === s.c && y === s.r) || BT.attackFrom(B, s, st).length > 0); return canHit.get(st.uid); };
  for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) {
    const k = BT.key(c, r), st = BT.stackAt(B, c, r);
    let col = null, a = 0;
    if (mineTurn && bspell) {
      // spell targeting: every valid target lit (violet for a strike, blue for a blessing); the previewed one, or the
      // blast of an area spell, brighter
      if (S.target === 'area') { col = HX.vio; a = 0.35; if (pv && BT.dist([c, r], [pv.c, pv.r]) <= 1) a = c === pv.c && r === pv.r ? 2.8 : 1.9; }
      else if (spellValid(bspell, st)) { col = S.target === 'ally' ? HX.blu : HX.vio; a = pv && pv.uid === st.uid ? 2.8 : 1.5; }
    } else if (mineTurn) {
      if (reach.has(k) && !st && !(c === s.c && r === s.r)) { col = HX.grn; a = bhover && bhover.k === k ? 2.4 : 1.25; }
      if (st && st.side !== s.side && attackable(st)) { col = HX.red; a = pv && pv.uid === st.uid ? 2.8 : 1.4; }
      // the hex the attacker will strike from
      if (pv && pv.kind === 'atk' && pv.from && pv.from[0] === c && pv.from[1] === r) { col = HX.gold; a = 2.6; }
    }
    if (col) hexTarget(k, col, a); else { hexT.a[k] = 0; hexT.busy = true; }
  }
  showArrow(pv && pv.kind === 'atk' && pv.from ? pv.from : null, pt);
  // the ring stays on the stack whose action is playing and moves on only once the queue has drained
  const rs = banim.length && bactor >= 0 ? B.stacks[bactor] : s;
  if (rs && rs.count > 0) vfx.select(bmesh.get(rs.uid), rs.side === 0 ? 0xffd84a : 0xff5a4a); else vfx.select(null);
  renderQueue(B);
  const h0 = B.heroes[0];
  $('b-spell').disabled = !h0 || B.cast[0] || !h0.spells.some((id) => h0.mana >= SPELLS[id].mana) || !mineTurn;
  $('b-spell').classList.toggle('on', !!bspell);
  $('b-spell').innerHTML = `${icon('spellbook', 24)}<small>${bspell ? 'Cancel' : h0 ? `Mana ${h0.mana}` : 'Spells'}</small>`;
  $('b-wait').disabled = $('b-def').disabled = !mineTurn;
  $('b-auto').classList.toggle('on', bauto);
  $('b-msg').innerHTML = !s ? '' : mineTurn ? (pmsg || (bspell ? `${icon(bspell, 18)} Choose a target for <b>${S.name}</b> · tap elsewhere to cancel` : `<b>${UNITS[s.id].name} ×${s.count}</b> · ${BT.canShoot(B, s) ? `${icon('shots', 16)} ${s.shots} shots · tap an enemy to shoot` : 'tap a green hex to move, a red enemy to attack'}`)) : sideOwner(s.side) === 0 ? (bauto ? `${icon('auto', 16)} Auto battle…` : '…') : `Enemy ${UNITS[s.id].name} ×${s.count} is acting…`;
}
// the turn order strip: icons are keyed by stack and round, so when a stack acts its icon collapses away and the
// rest slide along (CSS width transitions); reorders (waits) slide via FLIP; new ones grow in at the tail
let bqB = null, bqSig = '';
function renderQueue(B) {
  const box = $('b-queue');
  if (bqB !== B) { bqB = B; bqSig = ''; box.textContent = ''; }
  const q = BT.queue(B, 9), L = B.stacks.filter((x) => x.count > 0 && !x.acted).length;
  const items = q.map((x, i) => ({ x, k: `${x.uid}@${B.round + (i >= L ? 1 : 0)}`, n: x.shown ?? x.count, ic: unitIcon(x.id) }));
  // the stack whose action is still playing keeps the head (and its ring) until the queue drains
  const ax = banim.length && bactor >= 0 ? B.stacks[bactor] : null;
  if (ax && ax.acted && (ax.shown ?? ax.count) > 0) { items.unshift({ x: ax, k: `${ax.uid}@${B.round}`, n: ax.shown ?? ax.count, ic: unitIcon(ax.id) }); items.length = Math.min(items.length, 9); }
  const sig = items.map((it) => `${it.k}:${it.n}:${it.ic.length}`).join(',');
  if (sig === bqSig) return;
  const first = !bqSig; bqSig = sig;
  const live = new Map();
  for (const el of box.children) if (!el.classList.contains('gone')) live.set(el.dataset.k, el);
  const keep = new Set(items.map((it) => it.k)), old = new Map();
  if (!first) for (const [k, el] of live) if (keep.has(k)) old.set(el, el.getBoundingClientRect().left);
  for (const [k, el] of live) if (!keep.has(k)) { el.classList.add('gone'); el.classList.remove('now'); setTimeout(() => el.remove(), 360); }
  const fresh = [];
  const order = items.map((it, i) => {
    let el = live.get(it.k);
    if (!el) { el = document.createElement('span'); el.dataset.k = it.k; el.className = `q s${it.x.side}`; if (!first) { el.classList.add('in'); fresh.push(el); } }
    if (el._ic !== it.ic) { el._ic = it.ic; el.innerHTML = `${it.ic}<b></b>`; }
    const b = el.lastElementChild; if (b.textContent !== String(it.n)) b.textContent = it.n;
    el.classList.toggle('now', i === 0);
    return el;
  });
  // live icons in queue order; collapsing ones stay where they were (moving a node would cancel its transition)
  let ref = box.firstElementChild;
  for (const el of order) {
    while (ref && ref.classList.contains('gone')) ref = ref.nextElementSibling;
    if (ref === el) ref = ref.nextElementSibling; else box.insertBefore(el, ref);
  }
  if (first) return;
  // FLIP the icons that changed place
  const moved = [];
  for (const [el, x0] of old) { const dx = x0 - el.getBoundingClientRect().left; if (Math.abs(dx) > 2) { el.style.transition = 'none'; el.style.transform = `translateX(${dx}px)`; moved.push(el); } }
  void box.offsetWidth;
  for (const el of moved) { el.style.transition = ''; el.style.transform = ''; }
  for (const el of fresh) el.classList.remove('in');
}
const sideOwner = (side) => bctx.sides[side].owner;
// the player may act: their stack's turn, nothing animating, auto off (guards taps and the wait/defend buttons)
function myTurn() { const B = BB, s = B?.active; return !!s && !B.over && !banim.length && !bauto && !s.acted && s.count > 0 && sideOwner(s.side) === 0; }
// screen point -> battle hex: tapping a creature's body selects its hex (the ground point behind a tall unit
// belongs to another hex); p is the ground point under the finger (it picks the attack-from side)
function pickHex(cx, cy) {
  const B = BB, s = B.active;
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, bcam);
  let best = null, bd = 1e9;
  const groups = B.stacks.filter((st) => st.count > 0 && bmesh.get(st.uid)).map((st) => [st, bmesh.get(st.uid)]);
  const hit = ray.intersectObjects(groups.map(([, g]) => g), true).find((h) => !h.object.userData.blob);
  if (hit) { const g = groups.find(([, gg]) => { let o = hit.object; while (o) { if (o === gg) return true; o = o.parent; } return false; }); if (g) { best = [g[0].c, g[0].r]; bd = 0; } }
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) p.copy(hexPos(s.c, s.r));
  if (!best) {
    for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) { const d = hexPos(c, r).distanceTo(p); if (d < bd) { bd = d; best = [c, r]; } }
  }
  if (!best || bd > HS * 1.2) return null;
  // the ground hex under the pointer too (a tall body standing in front can cover an empty hex behind it)
  let g = null, gd = 1e9;
  for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) { const d = hexPos(c, r).distanceTo(p); if (d < gd) { gd = d; g = [c, r]; } }
  return { c: best[0], r: best[1], k: BT.key(best[0], best[1]), p, gc: gd <= HS * 1.05 ? g[0] : -1, gr: gd <= HS * 1.05 ? g[1] : -1 };
}
// how the active stack would hit t: shoot, strike from where it stands, or from the reachable neighbour hex
// closest to the pointer
function attackPlan(B, s, t, p) {
  if (BT.canShoot(B, s)) return { shoot: true, from: null };
  if (BT.nbrs(t.c, t.r).some(([x, y]) => x === s.c && y === s.r)) return { shoot: false, from: [s.c, s.r] };
  const fr = BT.attackFrom(B, s, t); if (!fr.length) return null;
  return { shoot: false, from: fr.sort((a, b) => hexPos(a[0], a[1]).distanceTo(p) - hexPos(b[0], b[1]).distanceTo(p))[0] };
}
const sameFrom = (a, b) => (!a && !b) || (!!a && !!b && a[0] === b[0] && a[1] === b[1]);
function cancelSpell() { bspell = null; bpreview = null; sfx.click(); refreshBattle(); }
// the previewed action commits only on a second tap at least this long after the preview appeared (an accidental
// double tap never strikes); a mouse that hovered the target first commits with one click
const PREVIEW_HOLD = 250, HOVER_HOLD = 150;
const previewReady = (pv) => performance.now() - pv.at >= (pv.src === 'hover' ? HOVER_HOLD : PREVIEW_HOLD);
// bhover: the hex under the mouse (desktop only)
let bhover = null;
function battleTap(cx, cy) {
  const B = BB; if (!myTurn()) return;
  const s = B.active, pk = pickHex(cx, cy), now = performance.now();
  if (bspell) {
    // tap 1 on a valid target previews it, tap 2 casts; tapping anything else (or off the field) cancels the spell
    const S = SPELLS[bspell], t = pk && BT.stackAt(B, pk.c, pk.r);
    if (!pk || !spellValid(bspell, t)) { cancelSpell(); return; }
    const uid = S.target === 'area' ? -1 : t.uid, pv = bpreview;
    const same = pv && pv.kind === 'spell' && (uid >= 0 ? pv.uid === uid : pv.c === pk.c && pv.r === pk.r);
    if (!same) { bpreview = { kind: 'spell', uid, c: pk.c, r: pk.r, at: now, src: 'tap' }; sfx.click(); refreshBattle(); return; }
    if (!previewReady(pv)) return;
    BT.castSpell(B, 0, bspell, uid >= 0 ? t : null, pk.c, pk.r);
    bspell = null; afterAction(); return;
  }
  if (!pk) return;
  const { c, r } = pk, t = BT.stackAt(B, c, r);
  if (t && t.side !== s.side) {
    const plan = attackPlan(B, s, t, pk.p);
    if (!plan) {
      // the tap landed on an out-of-reach enemy's body, but the ground under it is an empty hex we can walk to: move there
      if (pk.gc >= 0 && !BT.stackAt(B, pk.gc, pk.gr) && BT.reachable(B, s).has(BT.key(pk.gc, pk.gr))) { bpreview = null; BT.actMove(B, s, pk.gc, pk.gr); afterAction(); return; }
      bpreview = null; refreshBattle(); toast('Too far to reach this turn.'); sfx.deny(); return;
    }
    const pv = bpreview, same = pv && pv.kind === 'atk' && pv.uid === t.uid;
    // tap 1 (or a tap on another side of the target) previews: kills on its plate, the strike-from hex and arrow
    if (!same || !sameFrom(pv.from, plan.from)) { bpreview = { kind: 'atk', uid: t.uid, from: plan.from, shoot: plan.shoot, at: now, src: 'tap' }; sfx.click(); refreshBattle(); return; }
    if (!previewReady(pv)) return;
    bpreview = null;
    if (plan.shoot) { BT.actShoot(B, s, t); afterAction(); return; }
    BT.actAttack(B, s, t, pv.from); afterAction(); return;
  }
  if (!t && BT.reachable(B, s).has(BT.key(c, r)) && !(c === s.c && r === s.r)) { BT.actMove(B, s, c, r); afterAction(); return; }
  if (bpreview) { bpreview = null; refreshBattle(); }
  sfx.deny();
}
// desktop: hovering previews the attack / spell target and lights the hex under the pointer
function battleHover(cx, cy) {
  const B = BB; if (!B || !myTurn()) return;
  const s = B.active, pk = pickHex(cx, cy), t = pk && BT.stackAt(B, pk.c, pk.r), now = performance.now();
  let pv = bpreview && bpreview.src === 'tap' ? bpreview : null;
  if (!pv && pk) {
    const cur = bpreview;
    if (bspell) {
      if (spellValid(bspell, t)) {
        const uid = SPELLS[bspell].target === 'area' ? -1 : t.uid;
        pv = cur && cur.kind === 'spell' && (uid >= 0 ? cur.uid === uid : cur.c === pk.c && cur.r === pk.r) ? cur : { kind: 'spell', uid, c: pk.c, r: pk.r, at: now, src: 'hover' };
      }
    } else if (t && t.side !== s.side) {
      const plan = attackPlan(B, s, t, pk.p);
      if (plan) pv = cur && cur.kind === 'atk' && cur.uid === t.uid && sameFrom(cur.from, plan.from) ? cur : { kind: 'atk', uid: t.uid, from: plan.from, shoot: plan.shoot, at: now, src: 'hover' };
    }
  }
  const hk = pk ? pk.k : -1, changed = pv !== bpreview || (bhover ? bhover.k : -1) !== hk;
  bpreview = pv; bhover = pk;
  if (changed) refreshBattle();
}
{
  let hx = 0, hy = 0, hq = false;
  cvs.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || G.mode !== 'battle' || e.buttons) return;
    hx = e.clientX; hy = e.clientY;
    if (!hq) { hq = true; requestAnimationFrame(() => { hq = false; if (G.mode === 'battle' && BB) battleHover(hx, hy); }); }
  }, { passive: true });
  cvs.addEventListener('pointerleave', () => { if (G.mode !== 'battle' || !BB) return; if (bhover || bpreview?.src === 'hover') { bhover = null; if (bpreview?.src === 'hover') bpreview = null; refreshBattle(); } }, { passive: true });
}
function afterAction(actor = BB.active) { bpreview = null; bactor = actor ? actor.uid : -1; queueEvents(); refreshBattle(); }
function queueEvents() { bpreview = null; banim.push(...BB.events.map((e) => ({ e, t: 0 }))); BB.events.length = 0; }
$('b-wait').addEventListener('click', () => { if (!myTurn()) return; const s = BB.active; bspell = null; BT.actWait(BB, s); BT.nextStack(BB); afterAction(s); sfx.click(); });
$('b-def').addEventListener('click', () => { if (!myTurn()) return; const s = BB.active; bspell = null; BT.actDefend(BB, s); afterAction(s); sfx.defend(); });
// auto on/off mid-animation: whatever is playing finishes; the highlights fade, and an auto stack waits a beat before acting
$('b-auto').addEventListener('click', () => { if (!BB) return; bauto = !bauto; bspell = null; bpreview = null; bhover = null; if (bauto) bwait = Math.max(bwait, 0.2); refreshBattle(); sfx.click(); });
$('b-quick').addEventListener('click', () => { if (!BB || BB.over) return; BT.autoResolve(BB); BB.events.length = 0; banim = []; endBattleScreen(); });
$('b-spell').addEventListener('click', () => {
  const h0 = BB?.heroes[0]; if (!h0) return;
  if (bspell) { cancelSpell(); return; }
  ask(`${icon('spellbook', 22)} Spellbook`, `<p class="chips" style="justify-content:center"><span class="chip">${icon('mana', 18)}<em>${h0.mana}</em> mana</span><span class="chip">One spell per round</span></p>`, h0.spells.map((id) => [`${icon(id, 22)} ${SPELLS[id].name} · ${icon('mana', 14)}${SPELLS[id].mana}`, h0.mana >= SPELLS[id].mana ? () => { if (!myTurn()) return; bspell = id; bpreview = null; refreshBattle(); } : undefined, SPELLS[id].desc, 'choice']).concat([['Close', null, '', 'ghost']]));
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
  stepHexes(dt); stepArrow(dt);
  stepFacing(dt);
  if (banim.length) {
    const a = banim[0], e = a.e; a.t += dt;
    const done = playEvent(e, a.t);
    if (done) { banim.shift(); if (banim.length) refreshBattle(); else battleDrained(B); }
    return;
  }
  if (B.over) {
    if (!B.cheered) { B.cheered = true; bwait = Math.max(bwait, 1.15); bTimeK = 0.35; for (const st of B.stacks) if (st.count > 0 && st.side === B.over.winner) { const m = bmesh.get(st.uid); if (m) setAnim(m, ANIM.CHEER, { seed: st.uid, speed: AS }); } }
    // feel: the decided battle plays its last beat in slow motion (bTimeK), then dips to dark and the map fades back in
    if (bwait < 0.3 && !B.exitFade && !reduceMo.matches && dt > 0) { B.exitFade = true; curtain(true, true); }
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
      // feel: heavy blows (tier 6+ melee, boulders) and killing blows freeze the action for a few frames and shake the view
      const heavy = (e.t === 'hit' && meleeKind(sa.u) === 'heavy') || (e.t === 'shot' && sa.id === 'cyclops'), kill = (e.left ?? sd.count) <= 0;
      if (heavy || kill) { addHitStop(heavy ? 0.055 : 0.04); addShake(heavy ? 0.42 : 0.28); } else if (e.lucky) addShake(0.22);
      bfloat(d.position.clone().setY(1), `-${fmt(e.dmg)}${e.killed ? ` (${e.killed}💀)` : ''}${e.lucky ? ' 🍀' : ''}`, (sd.side === 0 ? 'red' : 'gold') + (heavy || kill || e.lucky ? ' big' : ''));
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
      if (e.hits.some((hh) => !hh.heal && hh.dmg)) addShake(e.id === 'fireball' ? 0.4 : 0.25);
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
  // crown: a banner / boss rule effect (the Plague, Echoing Volley): floaters and hits like a spell, no projectile
  if (e.t === 'mod') {
    if (!e.started) { e.started = true; for (const hh of e.hits || []) { const m = M(hh.s), st = S(hh.s); if (!m || !st) continue; m.userData.flash = 0.3; if ((hh.left ?? 1) <= 0) startDeath(m, st); else setAnim(m, ANIM.HIT, { speed: AS }); bfloat(m.position.clone().setY(1.1), `${e.text} -${fmt(hh.dmg)}${hh.killed ? ` (${hh.killed}💀)` : ''}`, st.side === 0 ? 'red' : 'gold'); st.shown = hh.left ?? st.count; setPlate(st); } }
    return t > 0.5;
  }
  if (e.t === 'gate') { if (!e.started) { e.started = true; sfx.gate({ kind: e.broken ? 'broken' : '' }); if (e.broken) { addShake(0.5); addHitStop(0.05); } bfloat(hexPos(e.c, e.r).setY(1.2), e.broken ? '💥 The gate falls!' : `🪵 Gate ${e.hp}`, e.broken ? 'gold' : 'red'); if (e.broken && bctx.gate) bctx.gate.visible = false; } return t > 0.5; }
  if (e.t === 'morale') { if (!e.started) { e.started = true; vfx.sparkle(M(e.s).position, 'morale'); sfx.morale(); setAnim(M(e.s), ANIM.CHEER, { speed: AS }); bfloat(M(e.s).position.clone().setY(1.3), '🎺 Good morale!', 'gold'); } return t > 0.5; }
  if (e.t === 'round') { if (!e.started) { e.started = true; $('b-round').textContent = `Round ${e.round}`; replay($('b-round'), 'pop'); } return true; }
  if (e.t === 'wait' || e.t === 'defend') { if (!e.started) { e.started = true; const m = M(e.s); if (m) bfloat(m.position.clone().setY(1.1), e.t === 'wait' ? '⏳ Wait' : '🛡️ Defend', 'blue'); } return t > 0.25; }
  return true;
}
function endBattleScreen() {
  const B = BB, ctx = bctx;
  BB = null; vfx.clear(); vfx.select(null);
  $('battle').hidden = true; $('hud').hidden = false; clearPlates();
  for (const f of floaters) f.el.remove(); floaters.length = 0;
  // feel: never a hard cut back to the map. After the slow-mo dip (above) the curtain is already dark; a Quick
  // resolve snaps it dark now. Either way it fades off once the map has drawn a frame or two.
  if (!reduceMo.matches && !bprep) {
    if (!bcurtain.classList.contains('on')) { bcurtain.classList.add('snap'); curtain(true, true); void bcurtain.offsetWidth; bcurtain.classList.remove('snap'); }
    requestAnimationFrame(() => requestAnimationFrame(() => { if (G.mode !== 'battle') curtain(false); }));
  }
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
  crownAfter(B, ctx); // crown: run counters, Bone Tally, a Blind's payout and shop (or the end of the run)
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
  renderTown(); sfx.town(); lay.townDirty = true; townInsets();
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
    const row = (title, army, who) => `<div class="armyrow"><b>${title}</b><div class="slots">${Array.from({ length: Math.max(ARMY_SLOTS, army.length) }, (_, i) => army[i] && army[i][1] > 0 ? `<button data-move="${who}:${i}">${unitIcon(army[i][0])}<em>${army[i][1]}</em></button>` : '<button disabled></button>').join('')}</div></div>`;
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
  pay(t.p, b.cost); t.built.push(id); t.builds = (t.builds || 0) + 1; t.builtToday = !(G.run && t.p === 0 && t.builds < CR.buildsPerDay(G.run));
  if (G.run && t.p === 0 && b.cost.gold && CR.buildDiscount(G.run)) G.players[0].res.gold += Math.round(b.cost.gold * CR.buildDiscount(G.run)); // crown: Mason's Mark
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
    <div class="slots big">${Array.from({ length: Math.max(ARMY_SLOTS, hr.army.length) }, (_, i) => hr.army[i] && hr.army[i][1] > 0 ? `<span>${unitIcon(hr.army[i][0])}<em>${hr.army[i][1]}</em><small>${UNITS[hr.army[i][0]].name}</small></span>` : '<span class="e"></span>').join('')}</div>
    <h3 class="sec">Skills</h3>${chips(Object.keys(hr.skills).map((k) => `<span class="chip">${icon(k, 18)}${SKILLS[k].name} <em>${['', 'I', 'II', 'III'][hr.skills[k]]}</em></span>`), 'No skills yet')}
    <h3 class="sec">Spells</h3>${chips(hr.spells.map((id) => `<span class="chip">${icon(id, 18)}${SPELLS[id].name}</span>`), 'No spells yet: build a Mage Guild')}
    <h3 class="sec">Artifacts</h3>${chips(hr.arts.map((id) => { const A = ARTIFACTS.find((x) => x.id === id); return `<span class="chip">${icon(id, 18)}${A.name}</span>`; }), 'No artifacts yet')}`, true);
}

// ------------------------------------------------------------------ HUD, messages and dialogs
const UICON = { pikeman: '🔱', archer: '🏹', griffin: '🦅', swordsman: '⚔️', monk: '🧙', cavalier: '🏇', angel: '👼', skeleton: '💀', zombie: '🧟', wight: '👻', vampire: '🧛', lich: '☠️', blackknight: '♞', bonedragon: '🐉', goblin: '👺', wolf: '🐺', orc: '👹', ogre: '🦣', troll: '🧌', cyclops: '👁️', hydra: '🐍' };
// lazy: when another size of the portrait is cached (e.g. the 64 px one for a 128 px dialog) it is shown scaled at once
// and the sharp render is swapped in from the background; it only renders synchronously when nothing is cached at all
const unitIcon = (id, s = 64) => portraitImgLazy(id, s) || UICON[id] || UICON[UNITS[id]?.up] || '❔';
const plural = (id, n = 2) => { const w = UNITS[id].name; if (n === 1) return w; if (/m[ae]n$/.test(w)) return w.replace(/man$/, 'men'); if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies'; if (/(s|x|ch|sh)$/.test(w)) return w + 'es'; return w.replace(/f$/, 'ves').replace(/([^s])$/, '$1s'); };
let toastT = 0;
function toast(msg) { const el = $('toast'); el.innerHTML = msg; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }
// UI juice: a soft ripple from the touch point on chunky buttons (purely visual, removed after it plays)
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest?.('.btn, .fb, .row-b button, .tabs2 button, .hb, .diffs button, .fcard, .mode, .opp button, .slots button');
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
const floaters = [], _flV = new THREE.Vector3();
function floatText(pos, text, cls = '', cm = null) {
  const el = document.createElement('div'); el.className = `floater ${cls}`; el.textContent = text; $('floaters').appendChild(el);
  // texts spawned close together (damage, "Retaliation", kills) stack upward instead of landing on each other
  const near = pos ? floaters.filter((f) => f.p && f.t < 0.9 && f.cm === cm && f.p.distanceTo(pos) < 1.2).length : 0;
  floaters.push({ el, p: pos, t: 0, cm, near, slot: pos ? 0 : floaters.filter((f) => !f.p).length });
  if (floaters.length > 14) floaters.shift().el.remove();
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.t += dt;
    if (f.t > 1.6) { f.el.remove(); floaters.splice(i, 1); continue; }
    let x = innerWidth / 2, y = innerHeight * 0.4 + f.slot * 34;
    if (f.p) { const v = _flV.copy(f.p).project(f.cm || camera); x = (v.x * 0.5 + 0.5) * innerWidth; y = (-v.y * 0.5 + 0.5) * innerHeight - f.near * 26; }
    const hw = (f.w ??= f.el.offsetWidth) / 2 + 6; x = clamp(x, hw, innerWidth - hw);
    // feel: pops in with an overshoot (easeOutBack over 0.28 s), rises fast then floats (easeOutCubic), fades at the end
    const t = f.t, up = 1 - Math.pow(1 - Math.min(1, t / 1.2), 3), pu = Math.min(1, t / 0.28) - 1;
    const sc = reduceMo.matches ? 1 : 1 + 2.7 * pu * pu * pu + 1.7 * pu * pu;
    f.el.style.opacity = String(Math.min(1, t * 12, (1.6 - t) * 2.5));
    f.el.style.transform = `translate(${x}px, ${y - up * 46}px) translate(-50%, -50%) scale(${sc})`;
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
    const T = resTick[k];
    if (!d) { if (!T.on || !live) { T.on = false; T.b = T.cur = r[k]; el.textContent = fmt(r[k]); } continue; }
    // the pop, the "+500" and the count-up wait for a resource flying in from the map (flyRes)
    const wait = Math.max(0, resFly[k] - performance.now());
    T.el = el; T.a = T.on ? T.cur : r[k] - d; T.b = r[k]; T.t0 = performance.now() + wait; T.on = true;
    if (reduceMo.matches) { T.on = false; el.textContent = fmt(r[k]); }
    const pop = () => {
      const s = el.parentElement; replay(s, d > 0 ? 'up' : 'down'); s.classList.remove(d > 0 ? 'down' : 'up');
      const f = document.createElement('i'); f.className = `rdelta ${d > 0 ? 'up' : 'down'}`; f.textContent = `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`;
      s.appendChild(f); setTimeout(() => f.remove(), 1500);
    };
    if (wait > 0) setTimeout(pop, wait); else pop();
  }
  const dayNew = live && resPrev.day !== G.day; resPrev.day = G.day; resPrev.pl = G.players[0];
  setHTML($('r-day'), `<small>Week ${week()}</small><b>Day ${((G.day - 1) % 7) + 1}</b>`);
  if (dayNew) replay($('r-day'), 'up');
  $('r2-gold').innerHTML = RES.map((k) => `<span class="rc${dl[k] ? (dl[k] > 0 ? ' up' : ' down') : ''}"><i>${icon(k, 22)}</i><b>${fmt(r[k])}</b>${dl[k] ? `<i class="rdelta ${dl[k] > 0 ? 'up' : 'down'}">${dl[k] > 0 ? '+' : '−'}${fmt(Math.abs(dl[k]))}</i>` : ''}</span>`).join('');
}
// counters count up/down to a new value over ~0.5 s (ease-out) instead of jumping; driven from frame() only while active
const resTick = {}; for (const k of RES) resTick[k] = { on: false, el: null, a: 0, b: 0, cur: 0, t0: 0, txt: -1 };
function tickRes(now) {
  for (let i = 0; i < RES.length; i++) {
    const T = resTick[RES[i]]; if (!T.on) continue;
    const u = clamp((now - T.t0) / 520, 0, 1), e = 1 - (1 - u) * (1 - u) * (1 - u);
    T.cur = T.a + (T.b - T.a) * e;
    const n = u >= 1 ? T.b : Math.round(T.cur);
    if (n !== T.txt && T.el) { T.txt = n; T.el.textContent = fmt(n); }
    if (u >= 1) { T.on = false; T.cur = T.b; }
  }
}
// perf: HUD rebuilds only when the markup really changed (an innerHTML rebuild re-parses portrait <img>s and restarts the badge animations)
function setHTML(el, html) { if (el && el.__html !== html) { el.innerHTML = html; el.__html = html; } }
function updateHud() {
  if (!G.players.length) return;
  updateRes();
  crownHud(); // crown: banner bar + Blind pill
  const mine = G.heroes.filter((x) => x.alive && x.p === 0);
  // UI: faction accent colour, and the End day button glows once no hero can take another step
  document.body.style.setProperty('--fac', FACTIONS[G.players[0].fac]?.css || '#3a7aff');
  const canStep = (x) => NBR[x.v].some((n) => passable(n) && stepCost(x.v, n) <= x.mp);
  $('b-end').classList.toggle('ready', G.mode === 'map' && !mine.some(canStep));
  setHTML($('heroes'), mine.map((hr) => `<button class="hb ${hr.id === G.selHero ? 'on' : ''}${canStep(hr) ? '' : ' spent'}" data-h="${hr.id}" aria-label="${hr.name}"><span class="hb-ic">${heroPic(hr, 40, 'round') || icon('hero', 30)}</span><b>${hr.name.split(' ').pop()}</b><i class="lvb">${hr.lvl}</i><span class="mp"><i style="width:${clamp((hr.mp / moveMax(hr)) * 100, 0, 100)}%"></i></span></button>`).join('') +
    G.towns.filter((t) => t.p === 0).map((t) => `<button class="hb town" data-t="${t.id}" aria-label="${t.name}"><span class="hb-ic">${icon('town', 28)}</span><b>${t.name}</b>${!t.builtToday ? `<em title="Can build today">${icon('build', 13)}</em>` : ''}</button>`).join(''));
  const hr = selHero();
  setHTML($('sel'), hr ? `<span class="sel-who"><span class="sel-pt">${heroPic(hr, 40, 'round') || icon('hero', 24)}<i class="lv">${hr.lvl}</i></span><b>${hr.name}</b></span><span class="st2">${icon('movement', 16)}${fmt(hr.mp)}</span><span class="st2">${icon('mana', 16)}${hr.mana}</span><span class="army">${heroArmy(hr).map(([id, n]) => `<span>${unitIcon(id)}<em>${n}</em></span>`).join('')}</span>${hr.route && canStep(hr) ? '<button class="sel-go" id="b-go" aria-label="Continue the march"><span class="go-t">Continue </span>▶</button>' : ''}` : '');
}
// side buttons act on the first tap (no wait for a possible double tap): hero not selected -> select it (the camera
// follows); the selected hero -> its sheet; town -> open it. A second tap on the same button within 320 ms
// additionally flies the camera in close (hero) or is swallowed (town: already open), so a double tap never acts twice.
let sideTap = null;
$('heroes').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || busy()) return;
  const key = b.dataset.h ? 'h' + b.dataset.h : 't' + b.dataset.t, now = performance.now();
  const dbl = !!sideTap && sideTap.key === key && now - sideTap.t < 320;
  sideTap = dbl ? null : { key, t: now };
  if (b.dataset.h) {
    const id = +b.dataset.h;
    if (dbl) { if (G.selHero !== id) selectHero(id); flyTo(G.heroes[id].v, 7.5); sfx.click(); return; }
    if (G.selHero === id) openHero(); else selectHero(id);
    return;
  }
  if (b.dataset.t && !dbl) openTown(+b.dataset.t);
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
  if (crownDusk()) return; // crown: a Blind due tonight is fought first, then the day ends
  showPath(selHero(), null);
  aiRunning = true; aiGen = runAI(); aiDelay = 0; $('b-end').disabled = true;
  toast(G.players.filter((x) => x.ai && x.alive).length > 1 ? '⏳ The rival crowns are moving…' : '⏳ The enemy is moving…'); dayFx('night');
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
// day/night feel layer (DOM, compositor-only animations): dusk falls while the enemy moves (a soft vignette and the moon
// rising on an arc), then the sun sweeps across with the "Day N" banner; a new week gets a gold "Week N" reveal first
const daycyc = document.createElement('div');
daycyc.id = 'daycyc'; daycyc.innerHTML = '<i class="dc-orb dc-moon"></i><i class="dc-orb"></i><div class="dc-ban"><small></small><b></b></div>'; document.body.appendChild(daycyc);
let dcHide = false;
function dayFx(kind) {
  if (kind === 'night') { clearTimeout(dayFx.t); daycyc.classList.remove('dawn', 'week', 'moonset'); daycyc.classList.add('night'); return; }
  if (daycyc.classList.contains('night')) {
    daycyc.classList.remove('night'); daycyc.classList.add('moonset');
    clearTimeout(dayFx.t); dayFx.t = setTimeout(() => daycyc.classList.remove('moonset'), 1100);
  }
  if (kind !== 'dawn' || reduceMo.matches) return;
  const wk = (G.day - 1) % 7 === 0;
  daycyc.querySelector('small').textContent = wk ? 'A new week dawns' : `Week ${week()}`;
  daycyc.querySelector('b').textContent = wk ? `Week ${week()}` : `Day ${((G.day - 1) % 7) + 1}`;
  daycyc.classList.toggle('week', wk); replay(daycyc, 'dawn');
}
// freeplay: whose turn it is while the computer lords move: one pip per crown in turn order (you first), the one moving lit
const turnbar = document.createElement('div');
turnbar.id = 'turnbar'; turnbar.hidden = true; turnbar.setAttribute('aria-live', 'polite');
$('hud').appendChild(turnbar);
function turnBar(Pl) {
  if (!Pl) { turnbar.hidden = true; return; }
  setHTML(turnbar, `<span class="tq-pips">${G.players.map((x) => `<i class="${x === Pl ? 'on' : ''}${x.alive ? '' : ' out'}" style="--pc:${x.css}"></i>`).join('')}</span><span class="tq-crest" style="--pc:${Pl.css}">${icon(FAC_CREST[Pl.fac] || 'banner', 18)}</span><b style="--pc:${Pl.css}">${Pl.name}</b><small>${Pl.i === 0 ? 'your turn' : 'is moving'}</small>`);
  turnbar.hidden = false;
}
function stopAI() {
  dayFx('off'); turnBar(null);
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
    if (Pl.ai) gold = Math.round(gold * byDiff([1, 1, 1, 1.5])); // Impossible: the computer lords collect half again
    Pl.res.gold += gold; for (const k of Object.keys(res)) Pl.res[k] += res[k];
    if (Pl.i === 0 && G.day > 1) floatText(null, `+${fmt(gold)} 🪙${res.wood ? ` +${res.wood} 🪵` : ''}${res.ore ? ` +${res.ore} 🪨` : ''}${res.gems ? ` +${res.gems} 💎` : ''}`, 'gold');
  }
  for (const hr of G.heroes) if (hr.alive) { hr.mp = moveMax(hr); hr.mana = Math.min(maxMana(hr), hr.mana + 1 + Math.floor(statOf(hr, 'know') / 3)); }
  for (const t of G.towns) { t.builtToday = false; t.builds = 0; }
  if (newWeek && G.run) crownWeek(); // crown: a new Ante opens its region and shows its boss
  if (newWeek) {
    // each week honours a creature: +5 growth in every town that breeds it
    const all = Object.values(FACTIONS).flatMap((f) => f.units), star = UNITS[G.nextWeekOf] ? G.nextWeekOf : all[(rnd() * all.length) | 0];
    G.weekOf = star; G.nextWeekOf = null;
    for (const t of G.towns) for (const b of BUILDINGS) if (b.tier && !b.up && t.built.includes(b.id)) { const base = FACTIONS[t.fac].units[b.tier - 1]; t.avail[b.tier] = (t.avail[b.tier] || 0) + Math.ceil(UNITS[base].grow * (t.built.includes('fort') ? 1.5 : 1) * (G.run && t.p === 0 ? CR.growthMul(G.run) : 1)) + (base === star ? 5 : 0); }
    for (const o of G.objects) if (o.alive && o.type === 'monster') o.n = Math.ceil(o.n * 1.08);
    for (const o of G.objects) if (o.alive && o.type === 'dwelling') o.stock = Math.max(o.stock, 4 + ((rnd() * 4) | 0));
    // (after the "Week N" reveal has played, so the card does not cover it)
    const wkMsg = () => showMsg(`📅 Week ${week()}: Week of the ${UNITS[G.weekOf].name}`, `${unitIcon(G.weekOf)} ${plural(G.weekOf)} grow by +5 this week. Creatures in your dwellings have multiplied: visit your town to recruit them.`);
    // (a tap in that window may already have opened the town or a battle: the card waits until the map is back)
    if (reduceMo.matches) wkMsg(); else { const d0 = G.day, tryMsg = () => { if (G.day !== d0 || G.mode === 'menu' || G.over) return; if (G.mode !== 'map' || walking) { setTimeout(tryMsg, 400); return; } wkMsg(); }; setTimeout(tryMsg, 950); }
  }
  revealAll(); updateHud(); saveSoon();
  const hr = selHero() || G.heroes.find((x) => x.alive && x.p === 0);
  if (hr) selectHero(hr.id);
  if (G.day % 7 === 1) sfx.week(); else sfx.day();
  dayFx('dawn');
}
function checkEnd() {
  if (G.over) return;
  const out = [];
  for (const Pl of G.players) {
    if (!Pl.alive) continue;
    const has = G.towns.some((t) => t.p === Pl.i) || G.heroes.some((x) => x.alive && x.p === Pl.i);
    // freeplay "Capture capitals": a crown whose capital has fallen is out of the game
    const cap = G.towns.find((t) => t.capOf === Pl.i), capLost = G.win === 'capitals' && cap && cap.p !== Pl.i;
    if (!has || capLost) { eliminate(Pl, capLost && has); out.push(Pl); }
  }
  if (!G.players[0].alive) { endGame(false); return; }
  if (G.players.every((Pl) => Pl.i === 0 || !Pl.alive)) { endGame(true); return; }
  const left = G.players.filter((Pl) => Pl.i !== 0 && Pl.alive).length;
  for (const Pl of out) if (Pl.i !== 0) showMsg(`☠️ ${Pl.name} is defeated`, `<p><b style="color:${Pl.css}">${Pl.name}</b> ${G.win === 'capitals' ? 'has lost its capital and' : ''} falls from the game. ${left} rival crown${left === 1 ? '' : 's'} remain${left === 1 ? 's' : ''}.</p>`);
}
// a crown leaves the game: what it still held (capitals mode) goes back to the wilds
function eliminate(Pl, scatter) {
  Pl.alive = false; Pl.outDay = G.day;
  if (scatter) {
    for (const hr of G.heroes) if (hr.alive && hr.p === Pl.i) hr.alive = false;
    for (const t of G.towns) if (t.p === Pl.i) t.p = -1;
    for (const o of G.objects) if (o.owner === Pl.i) o.owner = -1;
    worldDirty = true; layoutHeroes(true);
  }
  if (Pl.i !== 0) toast(`☠️ ${Pl.name} is defeated!`);
}
function endGame(won) {
  G.over = true; turnBar(null); store.del('realms.save');
  const me = G.players[0], towns = G.towns.filter((t) => t.p === 0).length, heroes = G.heroes.filter((h) => h.alive && h.p === 0);
  const army = heroes.reduce((a, h) => a + heroArmy(h).reduce((x, st) => x + st[1], 0), 0), top = heroes.reduce((a, h) => Math.max(a, h.lvl), 0);
  const rivals = G.players.filter((Pl) => Pl.i !== 0), beaten = rivals.filter((Pl) => !Pl.alive).length;
  // the strongest crown still standing (towns, then army) is the one that took the world from you
  const power = (Pl) => G.towns.filter((t) => t.p === Pl.i).length * 1e6 + G.heroes.filter((x) => x.alive && x.p === Pl.i).reduce((a, x) => a + BT.armyPower(heroArmy(x), x), 0);
  const victor = won ? null : rivals.filter((Pl) => Pl.alive).sort((x, y) => power(y) - power(x))[0];
  const roll = `<div class="rivals">${rivals.map((Pl) => `<span class="rv${Pl.alive ? '' : ' out'}" style="--pc:${Pl.css}"><span class="rv-crest">${icon(FAC_CREST[Pl.fac] || 'banner', 18)}</span><b>${Pl.name}</b><small>${Pl.alive ? (Pl === victor ? 'Rules the world' : 'Still standing') : `Fell on day ${Pl.outDay || G.day}`}</small></span>`).join('')}</div>`;
  const why = G.win === 'capitals' ? 'your capital has fallen' : 'your last town and hero are lost';
  const body = `<div class="endcard ${won ? 'win' : 'lose'}"><div class="crest2">${icon(won ? 'victory' : 'defeat', 84)}</div>
    <p>${won ? `After <b>${G.day}</b> ${G.day === 1 ? 'day' : 'days'} the whole world is yours. ${rivals.length > 1 ? `All ${rivals.length} rival crowns bow` : 'Every rival bows'} before ${FACTIONS[me.fac].name}.` : `${why[0].toUpperCase() + why.slice(1)}. ${victor ? `<b style="color:${victor.css}">${victor.name}</b> claims the world.` : 'Your crown falls into shadow.'}`}</p>
    ${rivals.length > 1 || !won ? roll : ''}
    <div class="endstats"><div><b>${G.day}</b><small>Days</small></div><div><b>${beaten}/${rivals.length}</b><small>Rivals out</small></div><div><b>${towns}</b><small>Towns</small></div><div><b>${fmt(army)}</b><small>Creatures</small></div><div><b>${top || '–'}</b><small>Top level</small></div></div></div>`;
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
  if (t.built.includes('tavern') && heroes < 2 + (G.diff >= 2 ? 1 : 0) && G.players[t.p].res.gold > 5000 && G.day > 6) {
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
      if (!passable(n) || crownShut(n, hr)) continue;
      const blockedTarget = (objAt[n] >= 0 && G.objects[objAt[n]].alive) || others.has(n);
      const nd = d + stepCost(v, n) + (!blockedTarget && zoc(n) ? 3000 : 0);
      if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, v); heap.push(nd, n); }
    }
  }
  return { dist, prev };
}
// freeplay: days before the computer lords go for the human; on Easy/Normal each extra rival adds a day, so 1v4 is no rush
const aiGraceDay = (d) => d + (G.diff < 2 ? Math.max(0, G.players.length - 2) : 0);
function aiValue(hr, v, power) {
  const o = objAt[v] >= 0 && G.objects[objAt[v]].alive ? G.objects[objAt[v]] : null;
  const other = heroAt(v);
  if (other && other !== hr) {
    if (other.p === hr.p) return 0;
    // freeplay: the human's heroes are left alone for the first days (later with more rivals on Easy/Normal) and need a clearer edge
    if (other.p === 0 && G.day < aiGraceDay(byDiff([10, 7, 4, 2]))) return 0;
    if (other.p > 0 && G.day < byDiff([6, 4, 3, 2])) return 0;
    const theirs = BT.armyPower(heroArmy(other), other); return power > theirs * (other.p === 0 ? byDiff([1.7, 1.45, 1.3, 1.15]) : 1.3) ? 70 + theirs / 100 : 0;
  }
  if (!o) return 0;
  const O = OBJECTS[o.type], kind = O?.kind;
  if (o.type !== 'monster') { const g = NBR[v].map((n) => (objAt[n] >= 0 ? G.objects[objAt[n]] : null)).find((x) => x && x.alive && x.type === 'monster'); if (g && power < BT.armyPower([[g.unit, g.n]]) * 1.6) return 0; }
  if (o.type === 'monster') { const mp = BT.armyPower([[o.unit, o.n]]); if (power < mp * 1.6) return 0; return 6 + mp / 150 + (o.guards !== undefined ? 10 : 0); }
  if (o.type === 'town') {
    const t = G.towns[o.t];
    if (t.p === hr.p) return heroArmy({ army: t.garrison }).length ? 12 + BT.armyPower(t.garrison) / 120 : 0;
    const gp = BT.armyPower(t.garrison) * (t.built.includes('fort') ? 1.3 : 1);
    if (t.p === 0 && G.day < aiGraceDay(byDiff([14, 10, 6, 3]))) return 0;
    if (t.p > 0 && G.day < byDiff([8, 6, 5, 3])) return 0; // rival crowns don't knock each other out in the first days either
    return power > gp * 1.4 ? (t.p === 0 ? (G.players.length > 2 ? 85 : 120) : 70) : 0;
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
    const threat = G.heroes.find((x) => x.alive && x.p !== hr.p && cellDist(x.v, hr.v) < 16 && BT.armyPower(heroArmy(x), x) > power * 1.25);
    let best = null, bs = 0;
    for (const [v, d] of dist) {
      if (v === hr.v) continue;
      let val = aiValue(hr, v, power);
      if (threat) { const o = objAt[v] >= 0 ? G.objects[objAt[v]] : null; if (o && o.type === 'town' && G.towns[o.t].p === hr.p) val += 150; else if (cellDist(v, threat.v) < 7) val *= 0.2; }
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
        if (cam.fly === false && offView(hr.v)) flyTo(hr.v, cam.tDist);
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
function* runAI() {
  for (const Pl of G.players) {
    if (G.over) return;
    if (!Pl.ai || !Pl.alive) continue;
    aiWatch = false; // each crown's first move in sight gets the camera once
    turnBar(Pl);
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
const SAVE_V = 2; // 2: flat hex map (v2.0); 1: the planet (v1.x), rejected on load
const pack = (a, off = 48) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i] + off); return s; };
const unpack = (s, a, off = 48) => { for (let i = 0; i < a.length; i++) a[i] = s.charCodeAt(i) - off; };
function save() {
  if (G.over || !G.players.length) return;
  // saved mid-walk (Save & quit): the rest of the march is kept as an unfinished route (Continue ▶ after loading)
  const W = walking, rest = W && W.i < W.path.length - 1 ? W.path.slice(W.i) : null, keep = rest && [W.hr.route, W.hr.routeObj];
  if (rest) { W.hr.route = rest; W.hr.routeObj = objAt[rest[rest.length - 1]]; }
  try { store.set('realms.save', { v: SAVE_V, grid: [GRID.W, GRID.H], ver: APP_VERSION, mode: G.gameMode || 'free', size: G.size, resLv: G.resLv, win: G.win, fog: G.fog, seed: G.seed, day: G.day, diff: G.diff, selHero: G.selHero, players: G.players, heroes: G.heroes, towns: G.towns, objects: G.objects, run: G.run || null, ter: pack(ter.subarray(0, NV)), h: pack(h.subarray(0, NV)), road: pack(road.subarray(0, NV)), seen: pack(seen.subarray(0, NV)) }); } finally { if (rest) [W.hr.route, W.hr.routeObj] = keep; }
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
  if (!s) return false;
  // v2 (flat world): v1 saves hold a planet (2562 cells, no grid size) and cannot be mapped onto a flat map
  if (s.v !== SAVE_V || !Array.isArray(s.grid)) { toast('This save is from an older version'); return false; }
  pendingLevels.length = 0;
  setGrid(s.grid);
  Object.assign(G, { seed: s.seed, day: s.day, diff: s.diff, selHero: s.selHero, players: s.players, heroes: s.heroes, towns: s.towns, objects: s.objects, over: false, mode: 'map',
    gameMode: s.mode || 'free', size: s.size || 'M', resLv: s.resLv ?? 1, win: s.win || 'conquer', fog: s.fog !== false, run: s.run ? CR.runLoad(s.run) : null });
  // saves from v1.10 and older: two crowns, the capitals are the starting towns
  for (const Pl of G.players) { if (!Pl.css) Pl.css = colCss(Pl.color); if (!G.towns.some((t) => t.capOf === Pl.i)) { const t = G.towns.find((x) => x.p === Pl.i); if (t && G.win === 'conquer') t.capOf = Pl.i; } }
  ter.fill(0); h.fill(0); road.fill(0); seen.fill(0);
  unpack(s.ter, ter.subarray(0, NV)); unpack(s.h, h.subarray(0, NV)); unpack(s.road, road.subarray(0, NV)); unpack(s.seen, seen.subarray(0, NV));
  objAt.fill(-1); for (const o of G.objects) if (o.alive) objAt[o.v] = o.id;
  for (const hr of G.heroes) hr.anim = null; // saved mid-step during an enemy turn
  rnd = mulberry32(s.seed + s.day * 977);
  return true;
}

// ------------------------------------------------------------------ sound
let actx = null, score = null, sfxEngine = null;
// sound: sampled orchestra (music.js) and magical effects (sfx.js); legacy sfx.name() calls keep working
// (a sound fired while the context is suspended or interrupted would queue up and burst out on resume: skip it)
const sfx = new Proxy({}, { get: (_, n) => (o) => { if (sfxEngine && actx.state === 'running' && store.get('realms.sfx', true)) { try { sfxEngine.play(n, o); } catch (e) { /* never break the game for a sound */ } } } });
function audio() {
  if (actx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    // 'balanced' = a slightly larger hardware buffer: far fewer audio-thread underruns (crackle) on phones while the
    // GPU and main thread are busy, for a few ms of extra latency
    try { actx = new AC({ latencyHint: 'balanced' }); } catch { actx = new AC(); }
    // music bus + sfx bus → master limiter → speakers. Each engine has its own compressor; this one only stops their
    // sum from clipping when a victory sting lands on a full battle score
    const lim = actx.createDynamicsCompressor();
    lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
    lim.connect(actx.destination);
    const sfxBus = actx.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(lim);
    sfxEngine = createSfx(actx, sfxBus);
    const mus = actx.createGain(); mus.gain.value = 0.58; mus.connect(lim); // 0.5 before the mono sample fold (-1.3 dB), restored
    score = createScore(actx, mus); musicScene();
    if (store.get('realms.music', true)) score.start();
    // iOS: a phone call, Siri or an alarm leaves the context 'interrupted' (Safari) or 'suspended'; ask it back as soon
    // as the page is in front again (when the OS refuses, the next tap's wakeAudio retries inside a gesture)
    actx.onstatechange = () => { if (actx.state !== 'running' && actx.state !== 'closed' && !document.hidden) actx.resume().catch(() => {}); };
  } catch { actx = null; }
}
function wakeAudio() {
  audio();
  if (actx && actx.state !== 'running' && actx.state !== 'closed' && !document.hidden) actx.resume().catch(() => {});
}
// decode the chosen faction's battle / town / map samples while the loading screen is up, not at the first battle
function musicWarm() { try { score?.warm?.(G.players?.[0]?.fac); } catch { /* sound is optional */ } }
// which piece fits what is on screen now
function musicScene(over) {
  if (!score) return;
  const fac = G.players?.[0]?.fac || store.get('realms.fac', 'haven');
  const town = townOpen != null ? G.towns[townOpen]?.fac : null;
  const sc = over || ($('menu') && !$('menu').hidden && !$('menu').classList.contains('fading') ? 'menu' : G.mode === 'battle' ? 'battle' : G.mode === 'town' ? 'town' : 'map');
  score.setScene(sc, sc === 'town' && town ? town : fac);
}
// unlock on the first gesture. iOS Safari only counts touchend / click as a gesture for audio (not pointerdown on
// older versions), so listen to all of them; each is a no-op once the context runs
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, wakeAudio, { capture: true, passive: true });
// background: suspend (the music scheduler's timers get throttled there and the clock would run past its queue);
// foreground / back from bfcache: resume
document.addEventListener('visibilitychange', () => {
  if (!actx) return;
  if (document.hidden) { if (actx.state === 'running') actx.suspend().catch(() => {}); } else wakeAudio();
});
window.addEventListener('pageshow', () => { if (actx) wakeAudio(); });

// ------------------------------------------------------------------ menu
// screen-to-screen feel: full-screen layers (title, faction picker) fade out instead of vanishing (CSS .fading);
// taps pass through while they fade. fadeShow cancels a fade still in flight.
function fadeHide(el, ms = 280) {
  if (!el || el.hidden) return;
  clearTimeout(el._fadeT);
  if (reduceMo.matches) { el.hidden = true; el.classList.remove('fading'); return; }
  el.classList.add('fading');
  el._fadeT = setTimeout(() => { el.hidden = true; el.classList.remove('fading'); }, ms);
}
function fadeShow(el) { clearTimeout(el._fadeT); el.classList.remove('fading'); el.hidden = false; }
function showMenu() {
  G.mode = 'menu'; dialogs.length = 0; pendingLevels.length = 0; renderDialog(); // a queued level-up would block every later one (showLevel only runs on the first push)
  stopAI(); walking = null; fx.clearPath(true); fx.select(null, null, undefined, true); // a quit mid enemy turn / mid walk must not carry over into the next game
  fadeShow($('menu')); $('hud').hidden = true; $('town').hidden = true; $('battle').hidden = true; musicScene('menu');
  CUI?.close(true); CUI?.hideTip(); // crown: no run screen survives a quit to the title
  const s = store.get('realms.save', null);
  $('m-continue').hidden = !s;
  if (s) $('m-continue').innerHTML = `Continue<small>${s.mode === 'crown' ? 'Crown Run · ' : `Free Play${(s.players?.length || 2) > 2 ? ` 1v${s.players.length - 1}` : ''} · `}${s.players?.[0] ? `${FACTIONS[s.players[0].fac]?.name || ''} · ` : ''}Week ${Math.floor((s.day - 1) / 7) + 1}, day ${((s.day - 1) % 7) + 1}</small>`;
  syncSound();
  for (const m of heroMeshes.values()) scene.remove(m); heroMeshes.clear();
}
// title-screen music toggle (the same setting as the in-game menu)
function syncSound() { const on = store.get('realms.music', true); $('m-sound').classList.toggle('off', !on); $('m-sound').querySelector('span').textContent = on ? 'Music on' : 'Music off'; }
$('m-sound').addEventListener('click', () => { const on = !store.get('realms.music', true); store.set('realms.music', on); if (on) score?.start(); else score?.stop(); syncSound(); sfx.click(); });
function play() {
  // first play: the loader shows on this very tap; the world layout is its first job (after the loader has painted)
  if (!prewarmed) { prewarmed = true; fadeHide($('menu')); G.mode = 'map'; worldDirty = true; musicWarm(); prewarm(() => { play(); warmGeometryIdle(); }); return; }
  fadeHide($('menu')); $('hud').hidden = false; G.mode = 'map'; musicScene('map');
  stopAI(); walking = null; fx.clearPath(true);
  trimGeoCache(); // a new game / a loaded save: free the models of factions this world no longer has
  worldDirty = true; layoutWorld();
  const hr = selHero() || G.heroes.find((x) => x.alive && x.p === 0);
  if (hr) { G.selHero = hr.id; camSnapTo(GRID.X[hr.v], GRID.Z[hr.v]); cam.yaw = cam.tYaw = cam.sYaw = 0; cam.y = groundAt(cam.x, cam.z); cam.dist = 16; cam.sDist = 0; cam.tDist = CAM_DEFAULT; flyTo(hr.v, CAM_DEFAULT); }
  updateHud();
}
$('m-new').addEventListener('click', () => {
  // an in-game confirmation instead of the browser's confirm() box
  if (store.get('realms.save', null)) { ask('Start a new game?', '<p>Your saved game will be replaced when the new one begins.</p>', [['Start a new game', () => pickFaction()], ['Keep my game', null]]); sfx.click(); return; }
  pickFaction();
});
// Crown Run (the "crown" agent's roguelite): its entry point registers itself as window.CrownRun = { start(), resume(save) }.
// Until it lands, the button explains what is coming.
$('m-crown').addEventListener('click', () => {
  sfx.click();
  if (typeof window.CrownRun?.start === 'function') { window.CrownRun.start(); return; }
  ask(`${icon('victory', 26)} Crown Run`, `<p>A roguelite on a full map: <b>8 Antes</b>, one week each. Every week ends in a <b>Blind</b> battle against a rising threat, up to a Crown Boss with a rule-breaking twist.</p>
    <ul class="tips"><li>${icon('banner', 22)}<span><b>Banners</b>: five slots of rule-breaking passives that combo.</span></li><li>${icon('market', 22)}<span><b>The shop</b> after every Blind: banners, upgrades, scrolls, vouchers.</span></li><li>${icon('chest', 22)}<span><b>Packs</b>: pick one of three from every treasure.</span></li></ul><p class="hint2">Coming soon. Free Play is ready now.</p>`, [['Play Free Play', () => $('m-new').click()], ['Back', null]]);
});
// faction choice: one card per faction with its crest, colour, creature line-up, description and signature skill and spell.
const FAC_CREST = { haven: 'defense', necro: 'necromancy', sylvan: 'luck', inferno: 'fireball', dungeon: 'sorcery' };
// ---- freeplay: the Free Play setup screen (your crown, rivals, map and rules). The last settings are remembered.
const FP_DEF = { size: 'M', res: 1, win: 'conquer', fog: true, opp: [{ fac: 'random', col: -1 }] };
function fpLoad() {
  const s = { ...FP_DEF, ...store.get('realms.fp', {}) };
  if (!MAP_SIZES[s.size]) s.size = 'M';
  s.res = clamp(s.res | 0, 0, 2); s.win = s.win === 'capitals' ? 'capitals' : 'conquer'; s.fog = s.fog !== false;
  s.opp = (Array.isArray(s.opp) && s.opp.length ? s.opp : FP_DEF.opp).slice(0, 4).map((o) => ({ fac: FACTIONS[o?.fac] ? o.fac : 'random', col: Number.isInteger(o?.col) && PLAYER_COLS[o.col] !== undefined ? o.col : -1 }));
  s.diff = clamp(store.get('realms.diff', 1) | 0, 0, 3); // (also the harnesses' knob)
  s.fac = FACTIONS[store.get('realms.fac', 'haven')] ? store.get('realms.fac', 'haven') : 'haven';
  return s;
}
function pickFaction() {
  const el = $('factions'), S = fpLoad();
  const keep = () => { store.set('realms.fp', { size: S.size, res: S.res, win: S.win, fog: S.fog, opp: S.opp }); store.set('realms.diff', S.diff); store.set('realms.fac', S.fac); };
  const facKeys = Object.keys(FACTIONS);
  // the colour each rival will really get (the same rule newWorld uses), so the swatches show the outcome
  const colsNow = () => {
    const taken = [FACTIONS[S.fac].color];
    return S.opp.map((o) => { let c = PLAYER_COLS[o.col] ?? -1; const fac = FACTIONS[o.fac] ? o.fac : null; if (c < 0 || taken.includes(c)) c = fac ? FACTIONS[fac].color : -1; if (c < 0 && !fac) return null; /* Random + Auto: decided at the start */ if (c < 0 || taken.includes(c)) c = COL_SPARE.find((x) => !taken.includes(x) && !S.opp.some((q) => PLAYER_COLS[q.col] === x)) ?? COL_SPARE.find((x) => !taken.includes(x)); taken.push(c); return c; });
  };
  const seg = (key, opts, cur) => `<div class="diffs seg" role="radiogroup" data-k="${key}">${opts.map(([v, label, ic]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}" role="radio" aria-checked="${String(v) === String(cur)}">${ic ? icon(ic, 16) : ''}${label}</button>`).join('')}</div>`;
  const row = (label, html) => `<div class="fs-row"><p class="mlabel">${label}</p>${html}</div>`;
  const oppHTML = () => {
    const cs = colsNow();
    return S.opp.map((o, k) => { const f = FACTIONS[o.fac], css = cs[k] == null ? 'conic-gradient(#3a7aff, #d83a3a, #3ac84a, #e8c020, #a84ad8, #3a7aff)' : colCss(cs[k]);
      return `<div class="opp" style="--pc:${cs[k] == null ? '#8a8aa0' : css}"><span class="opp-n">${k + 1}</span>
        <button class="opp-fac" data-o="${k}" style="--fc:${f ? f.css : '#8a8aa0'}" aria-label="Rival ${k + 1} faction: ${f ? f.name : 'Random'}"><span class="fc-crest mini">${f ? icon(FAC_CREST[o.fac] || 'banner', 18) : '<b class="q">?</b>'}</span><b>${f ? f.name : 'Random'}</b><i class="cyc">▸</i></button>
        <button class="opp-col" data-c="${k}" aria-label="Rival ${k + 1} colour: ${COL_NAMES[PLAYER_COLS.indexOf(cs[k])] || ''}"><i style="background:${css}"></i><small>${o.col < 0 ? 'Auto' : COL_NAMES[o.col]}</small></button></div>`; }).join('');
  };
  const summary = () => `${FACTIONS[S.fac].name} vs ${S.opp.length} rival${S.opp.length > 1 ? 's' : ''}`;
  el.innerHTML = `<div class="fp fs"><header class="fp-head">${icon('logo', 44)}<div><small>Free Play · skirmish</small><h2>Set up your war</h2></div></header>
    <div class="fs-cols">
      <section class="fs-you"><p class="mlabel">Your crown</p><div class="fcards mini">${Object.entries(FACTIONS).map(([k, f]) => {
        const kit = FACTION_START[k] || FACTION_START.haven;
        return `<button class="fcard${k === S.fac ? ' on' : ''}" data-f="${k}" style="--fc:${f.css}" aria-pressed="${k === S.fac}">
        <span class="fc-crest">${icon(FAC_CREST[k] || 'banner', 30)}</span>
        <span class="fc-body"><b class="fc-name">${f.name}</b><small class="fc-desc">${f.desc || ''}</small>
        <span class="fc-sig"><em>Signature</em><span>${icon(kit.skill, 16)}${SKILLS[kit.skill]?.name || ''}</span><span>${icon(kit.spell, 16)}${SPELLS[kit.spell]?.name || ''}</span></span></span>
        <span class="fu">${[0, 3, 6].map((i) => unitIcon(f.units[i], 64)).join('')}</span><span class="fc-check">${icon('check', 16)}</span></button>`;
      }).join('')}</div></section>
      <section class="fs-set">
        ${row('Rival crowns', seg('n', [1, 2, 3, 4].map((n) => [n, `1 v ${n}`]), S.opp.length))}
        <div class="opps" id="fs-opps">${oppHTML()}</div>
        ${row('Map size', seg('size', Object.keys(MAP_SIZES).map((k) => [k, k]), S.size))}
        ${row('Difficulty', seg('diff', [[0, 'Easy', 'luck'], [1, 'Normal', 'attack'], [2, 'Hard', 'fireball'], [3, 'Impossible', 'defeat']], S.diff))}
        ${row('Starting resources', seg('res', [[0, 'Poor', 'wood'], [1, 'Normal', 'gold'], [2, 'Rich', 'gems']], S.res))}
        ${row('Victory', seg('win', [['conquer', 'Conquer all', 'victory'], ['capitals', 'Capitals', 'town']], S.win))}
        ${row('Fog of war', seg('fog', [[1, 'On', 'scouting'], [0, 'Off', 'day']], S.fog ? 1 : 0))}
        <p class="hint2 fs-hint" id="fs-hint"></p>
      </section>
    </div>
    <footer class="fp-foot"><button class="btn ghost" id="f-back">Back</button><button class="btn gold" id="f-go">Begin<small id="f-sum">${summary()}</small></button></footer></div>`;
  fadeShow(el); el.scrollTop = 0; for (const s of el.querySelectorAll('.fs-you, .fs-set')) s.scrollTop = 0;
  document.body.style.setProperty('--fac', FACTIONS[S.fac].css);
  const hint = () => {
    const small = S.opp.length >= 3 && (S.size === 'S' || S.size === 'M') || S.opp.length >= 2 && S.size === 'S';
    $('fs-hint').textContent = `${S.win === 'capitals' ? 'Take every rival capital; a crown that loses its capital is out (so are you).' : 'Win by taking every town and defeating every hero.'} ${small ? `${S.opp.length} rivals on a ${MAP_SIZES[S.size].toLowerCase()} map: expect early clashes (L or XL gives room).` : ''}`.trim();
  };
  const refresh = () => {
    $('fs-opps').innerHTML = oppHTML(); $('f-sum').textContent = summary(); hint(); keep();
  };
  hint();
  const start = () => {
    keep(); fadeHide(el, 320); sfx.click();
    newWorld((Date.now() % 100000) + 1, S.diff, S.fac, { mode: 'free', opponents: S.opp, size: S.size, res: S.res, win: S.win, fog: S.fog });
    play(); save();
    const rivals = G.players.filter((x) => x.ai), fac = S.fac;
    const names = rivals.map((P) => `<b style="color:${P.css}">${P.name}</b>`), list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
    setTimeout(() => ask(`${icon('logo', 26)} Your crown`, `<p>You lead the <b style="color:${FACTIONS[fac].css}">${FACTIONS[fac].name}</b>. ${G.win === 'capitals' ? `Capture the capital${rivals.length > 1 ? 's' : ''} of ${list} and keep your own.` : `Defeat ${rivals.length > 1 ? 'the crowns of ' : 'the '}${list}${rivals.length > 1 ? '' : ' crown'} to rule the world.`}</p>
      <ul class="tips"><li>${icon('movement', 22)}<span><b>Tap a hex</b> to plan a route, tap it again to march.</span></li><li>${icon('gold', 22)}<span><b>Flag mines</b> and pick up treasure for income.</span></li><li>${icon('town', 22)}<span><b>Walk into your town</b> (or double-tap it) to build once a day and recruit.</span></li><li>${icon('hero', 22)}<span><b>Tap your hero</b> for the hero sheet. Double-tap either to fly there.</span></li><li>${icon('end', 22)}<span><b>End the day</b> when everyone has moved.</span></li></ul>`, [['Begin', null]], true), 600);
  };
  el.querySelectorAll('.fcard').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.f === S.fac) return;
    S.fac = b.dataset.f; sfx.click();
    el.querySelectorAll('.fcard').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    document.body.style.setProperty('--fac', FACTIONS[S.fac].css); refresh();
  }));
  el.querySelectorAll('.seg').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const k = g.dataset.k, v = b.dataset.v; sfx.click();
    for (const x of g.querySelectorAll('button')) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }
    if (k === 'n') { const n = +v; while (S.opp.length < n) S.opp.push({ fac: 'random', col: -1 }); S.opp.length = n; }
    else if (k === 'size') S.size = v; else if (k === 'diff') S.diff = +v; else if (k === 'res') S.res = +v; else if (k === 'win') S.win = v; else if (k === 'fog') S.fog = v === '1';
    refresh();
  }));
  // a rival's faction cycles Random → each faction; its colour cycles Auto → each colour nobody else has
  $('fs-opps').addEventListener('click', (e) => {
    const f = e.target.closest('.opp-fac'), c = e.target.closest('.opp-col');
    if (f) { const o = S.opp[+f.dataset.o], seq = ['random', ...facKeys]; o.fac = seq[(seq.indexOf(o.fac) + 1) % seq.length]; }
    else if (c) {
      const k = +c.dataset.c, o = S.opp[k], cs = colsNow(), busy = [FACTIONS[S.fac].color, ...cs.filter((_, i) => i !== k)];
      let i = o.col; do { i = i + 1 >= PLAYER_COLS.length ? -1 : i + 1; } while (i >= 0 && busy.includes(PLAYER_COLS[i]));
      o.col = i;
    } else return;
    sfx.click(); refresh();
  });
  $('f-go').addEventListener('click', start);
  $('f-back').addEventListener('click', () => { keep(); fadeHide(el); sfx.click(); });
}
// Continue resumes the last save, whichever mode it belongs to
$('m-continue').addEventListener('click', () => {
  const s = store.get('realms.save', null);
  if (s?.mode === 'crown' && typeof window.CrownRun?.resume === 'function') { window.CrownRun.resume(s); return; }
  if (load()) play();
});

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
// ---- view culling (flat world): flora chunks outside the view are not packed into the instance buffers (floraCull),
// and whole map figures (towns, objects, heroes: body + ink + glow + blob + flag) outside the view are hidden as one,
// so the renderer skips their subtrees. Only objects this code hid are ever un-hidden (userData.hzCull), so other code
// may still hide figures itself. quality.set({ cull: false }) turns both off for A/B tests.
const _fs = new THREE.Sphere();
function hzOne(g) {
  _fs.center.copy(g.position); _fs.center.y += 0.25; _fs.radius = 0.75 * Math.max(1, g.scale.x * 3);
  const out = !_frus.intersectsSphere(_fs) || _fs.center.distanceTo(camera.position) > atmos.fog.far;
  if (out) { if (g.visible) { g.visible = false; g.userData.hzCull = true; } }
  else if (g.userData.hzCull) { g.visible = true; g.userData.hzCull = false; }
}
let hzOn = true, shAlways = false; // A/B switches for perf tests: __realms.quality.set({ cull, shadowsAlways })
function horizonCull() {
  floraOn = hzOn;
  if (floraCull()) renderer.shadowMap.needsUpdate = true;
  if (!hzOn) { for (const g of world.children) if (g.userData.hzCull) { g.visible = true; g.userData.hzCull = false; } for (const g of heroMeshes.values()) if (g.userData.hzCull) { g.visible = true; g.userData.hzCull = false; } return; }
  for (const g of world.children) hzOne(g);
  for (const g of heroMeshes.values()) hzOne(g);
}
function frame(now) {
  // schedule the next frame first: an exception anywhere below (a bad battle setup, an AI move) then costs one
  // frame instead of silently killing the loop and freezing the whole game
  requestAnimationFrame(frame);
  // nothing to draw behind the loading screen: give its time to the warm-up jobs
  if (!loaderEl.hidden && !loaderEl.classList.contains('done')) { clock.getDelta(); return; }
  QG.sample(typeof now === 'number' ? now : performance.now());
  const dt = Math.min(0.05, clock.getDelta());
  // a screen switch (or the battle leaving its curtain) re-measures the HUD bars and snaps the framing
  const lmode = G.mode + (bprep ? '~' : '');
  if (lmode !== lay.mode) { lay.mode = lmode; lay.dirty = lay.townDirty = true; lay.sinceMode = 0; } else lay.sinceMode += dt;
  // battle time: frozen during a hit-stop, slowed for a beat when the battle is decided (bTimeK eases back to 1)
  let bdt = dt;
  if (G.mode === 'battle') {
    if (hitStop > 0) { hitStop -= dt; bdt = 0; }
    if (bTimeK < 1) { bTimeK = reduceMo.matches ? 1 : Math.min(1, bTimeK + dt * 1.3); bdt *= bTimeK; }
  } else { hitStop = 0; bTimeK = 1; }
  tt += bdt;
  tickMaterials(tt);
  // ink outlines thin out and soften as the map zooms out, so far views don't turn into uniform dark chips
  const iu = inkMat.userData.uniforms, zk = G.mode === 'battle' ? 1 : clamp((19 - cam.dist) / 8, 0.3, 1);
  iu.uHullW.value = 0.003 * zk; iu.uHullDark.value = 0.15 + (1 - zk) * 0.45;
  if (G.mode === 'battle' && bprep) { /* the battle is being set up behind the curtain (enterBattle): nothing to draw yet */ }
  else if (G.mode === 'battle') {
    animateBattle(bdt);
    const s = Math.sin(bview.yaw), c = Math.cos(bview.yaw);
    // a classic three-quarter view: low enough that creatures show their figures, not just helmets
    // never closer than what fits the full grid width on screen (portrait phones)
    frameBattleCam(s, c, dt);
    applyShake(bcam, dt, 0.011);
    updatePlates();
    for (const m of bmesh.values()) if (m.userData.flash > 0) { m.userData.flash -= bdt; m.children[0].material = m.userData.flash > 0 ? hitMat : bodyMat; }
    vfx.update(bdt, bcam);
    renderer.shadowMap.needsUpdate = true; // battle figures always animate
    post.render(bscene, bcam);
  } else {
    updateCamera(dt);
    mapViewOffset(dt);
    if (G.mode !== 'town') atmos.update(dt, camera, camFocus, viewDist(cam.dist), G.mode === 'menu'); // perf: the town screen does not draw the map's sky
    cam.spin = G.mode === 'menu' ? 0.035 : 0; if (G.mode === 'menu') cam.tDist = 12.5;
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
      // LOD (flat world): zoomed far out the ink outlines are hair-thin anyway; dropping them halves the figures' triangles
      const il = cam.dist < 15.5;
      if (il !== inkLod) { inkLod = il; for (const g of [...world.children, ...heroMeshes.values()]) for (const c of g.children) if (c.userData.ink) c.visible = il; }
      const nk = clamp(1 + (cam.dist - 9) * 0.045, 1, 1.4);
      if (Math.abs(nk - figK) > 0.01) {
        figK = nk;
        for (const g of [...world.children, ...heroMeshes.values()]) if (g.userData.s0) g.scale.setScalar(g.userData.s0 * (g.userData.noGrow ? 1 : figK));
      }
      fx.select(m ? m.position : null);
      fx.update(dt, camera);
      mini.draw(performance.now());
      // map guards get their life from the shader idle (a moving mesh would reseed its animation every frame)
    }
    if (G.mode === 'town') { townInsets(); townView.update(dt); renderer.shadowMap.needsUpdate = true; shMode = 'town'; post.render(townView.scene, townView.camera); }
    else { horizonCull(); if (mapShadowsDue(dt) || shAlways) renderer.shadowMap.needsUpdate = true; post.render(scene, camera); }
  }
  updateFloaters(dt); tickRes(performance.now());
  // the day/night layer only belongs over the map (an enemy hero may start a battle at dusk)
  const dh = G.mode !== 'map'; if (dh !== dcHide) { dcHide = dh; daycyc.classList.toggle('off', dh); }
}
// Battle framing: the whole grid (plus the far row's figures) fits the free band between the top bar and the
// bottom buttons, in any orientation / aspect ratio (tall phones, landscape phones, tablets, desktop). The distance
// is solved from the projected grid box; a view offset then centres the grid in that band (bcam.fov stays as it is,
// so the px maths of the count plates and picking still hold). Pinch-zoom can only move out from the fitted view.
const BGRID = (() => {
  // x: the outer creatures' centres sit at 3.25 HW; the outermost hex edge (3.75 HW) may be trimmed a little
  const x = 3.55 * HW, z = ((BT.ROWS - 1) / 2) * VS + HS + 0.08;
  return [[-x, 0, -z], [x, 0, -z], [-x, 1.55, -z], [x, 1.55, -z], [-x, 0, z], [x, 0, z], [-x, 0.7, z], [x, 0.7, z]].map((a) => new THREE.Vector3(...a));
})();
const bfV = new THREE.Vector3(), bfE = [0, 0, 0, 0];
function bcamPlace(s, c, d) {
  bcam.position.set(s * d * 0.82, d * 0.86, c * d * 0.82 + 0.4);
  bcam.lookAt(0, 0, -0.15);
  bcam.updateMatrixWorld(true);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of BGRID) {
    bfV.copy(p).applyMatrix4(bcam.matrixWorldInverse);
    const tx = bfV.x / -bfV.z, ty = bfV.y / -bfV.z;
    x0 = Math.min(x0, tx); x1 = Math.max(x1, tx); y0 = Math.min(y0, ty); y1 = Math.max(y1, ty);
  }
  bfE[0] = x0; bfE[1] = x1; bfE[2] = y0; bfE[3] = y1;
  return bfE;
}
function frameBattleCam(s, c, dt) {
  if (lay.dirty) measureLayout();
  const W = rsz.w || innerWidth, H = rsz.h || innerHeight;
  const T = clamp(lay.batT, 0, H * 0.45), B = clamp(lay.batB, H * 0.55, H);
  const ppt = H / 2 / Math.tan(THREE.MathUtils.degToRad(bcam.fov / 2)); // px per tangent unit
  const avW = W * 0.99, avH = Math.max(H * 0.3, B - T) * 0.97;
  let d = lay.bD || 14;
  for (let i = 0; i < 4; i++) {
    const e = bcamPlace(s, c, d), k = Math.max(((e[1] - e[0]) * ppt) / avW, ((e[3] - e[2]) * ppt) / avH);
    if (Math.abs(k - 1) < 0.002) break;
    d *= k;
  }
  d = clamp(d, 8, 26);
  const want = Math.max(bview.dist, d), snap = lay.snapBat || lay.sinceMode < 0.5 || !lay.bDcur; lay.snapBat = false;
  // ease toward the new fit (a bar changing size), snap on a resize / battle start
  const D = snap ? want : lay.bDcur + (want - lay.bDcur) * (1 - Math.exp(-dt * 8));
  lay.bD = d; lay.bDcur = D;
  const e = bcamPlace(s, c, D);
  // optical centre so that the grid box's middle lands on the band's middle
  const ox = ((e[0] + e[1]) / 2) * ppt, oy = H / 2 - ((T + B) / 2 + ((e[2] + e[3]) / 2) * ppt);
  const k = snap ? 1 : 1 - Math.exp(-dt * 8);
  lay.bOffX += (ox - lay.bOffX) * k; lay.bOffY += (oy - lay.bOffY) * k;
  const v = bcam.view;
  if (!v || !v.enabled || v.fullWidth !== W || v.fullHeight !== H || Math.abs(v.offsetX - lay.bOffX) > 0.05 || Math.abs(v.offsetY - lay.bOffY) > 0.05) bcam.setViewOffset(W, H, lay.bOffX, lay.bOffY, W, H);
}
const hitMat = makeHitMaterial(THREE);

// ------------------------------------------------------------------ app lifecycle: backgrounding and WebGL context loss
// A good moment to write the save: on the map or in a town sheet, not mid-walk, mid-battle or mid enemy turn (those
// are settled by the regular saves; a save there would let a reload undo a battle or replay half an AI turn).
const safeToSave = () => (G.mode === 'map' || G.mode === 'town') && !walking && !aiRunning && !bprep && !G.over && G.players.length > 0 && $('loader').hidden;
// Backgrounding (phones): save while we still can (the OS may kill a hidden tab), silence the audio and drop the time
// spent away. rAF stops by itself while hidden, which stops the render loop, the AI and every animation.
let audioPaused = false;
function onHide() {
  try { if (safeToSave()) save(); } catch (e) { console.warn('save on hide', e); }
  if (actx && actx.state === 'running') { audioPaused = true; actx.suspend().catch(() => {}); }
}
function onShow() {
  clock.getDelta(); // the first frame back gets a normal dt, not the minutes spent away (frame() clamps it too)
  if (audioPaused && actx) { audioPaused = false; actx.resume().catch(() => {}); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) onHide(); else onShow(); });
window.addEventListener('pagehide', onHide); // iOS Safari: the reliable "going away" signal
window.addEventListener('pageshow', (e) => { if (e.persisted) onShow(); });
// WebGL context loss: iOS Safari and Android Chrome drop the context of a backgrounded tab or under memory pressure.
// three.js calls preventDefault (so the browser may restore it) and, on restore, rebuilds its GL state; every geometry,
// texture, render target (post targets, shadow maps, portrait targets) and program the game keeps is re-uploaded or
// recompiled lazily on its next use, so nothing has to be rebuilt by hand and the game state is untouched. Portraits
// are 2D images (independent of GL); the ones requested while the context was gone are not cached (portraits.js), so
// they render again once it is back.
let glLost = 0, glEpoch = 0;
// three's compileAsync polls program.isReady() every 10 ms: while the context is lost that never becomes true, and
// after a restore it throws (the new GL state has no program for those materials), an uncaught error in a timer.
// Same contract, but it settles as soon as the context is lost or replaced (the programs then compile on first draw).
renderer.compileAsync = function compileAsyncSafe(sc, cm, target = null) {
  if (renderer.getContext().isContextLost()) return Promise.resolve(sc);
  const mats = renderer.compile(sc, cm, target), ep = glEpoch;
  return new Promise((resolve) => {
    const check = () => {
      if (ep !== glEpoch || renderer.getContext().isContextLost()) { resolve(sc); return; }
      for (const m of mats) { const pr = renderer.properties.get(m).currentProgram; if (!pr || pr.isReady()) mats.delete(m); }
      if (!mats.size) resolve(sc); else setTimeout(check, 10);
    };
    if (renderer.extensions.get('KHR_parallel_shader_compile') !== null) check(); else setTimeout(check, 10);
  });
};
cvs.addEventListener('webglcontextlost', (e) => {
  glEpoch++;
  e.preventDefault(); glLost = performance.now();
  try { if (safeToSave()) save(); } catch (err) { /* ignore */ } // in case the browser gives up and reloads the tab
}, false);
cvs.addEventListener('webglcontextrestored', () => {
  glLost = 0; glEpoch++;
  renderer.shadowMap.needsUpdate = true;
  resize(); // re-sizes the post-processing targets on the new context
  clock.getDelta();
}, false);

// first boot: a world spinning behind the title
newWorld(12345, 1);
for (let v = 0; v < NV; v++) seen[v] = 1;
layoutWorld();
camSnapTo(GRID.cx, GRID.cz + 3); cam.dist = cam.tDist = 12.5; // the title looks across the middle of the map
resize();
QG.init();
showMenu();
// title (perf): the menu takes taps at once and the spinning world fades in when its shader programs are compiled
// (in parallel where KHR_parallel_shader_compile exists), instead of the very first frame blocking the page on them.
{
  const cv = renderer.domElement;
  let go = false;
  const start = () => {
    if (go) return; go = true;
    requestAnimationFrame(() => { cv.style.transition = 'opacity 0.6s'; cv.style.opacity = ''; setTimeout(() => { cv.style.transition = ''; }, 700); });
    warmPicker();
    frame();
  };
  cv.style.opacity = '0';
  compileSoon(scene, camera, 4000).then(start);
}
// the faction picker shows three creature portraits per faction: render them in the title's idle time (off-thread
// readback), so tapping New game does not render 15 portraits synchronously
function warmPicker() {
  const ids = [...new Set(Object.values(FACTIONS).flatMap((f) => [0, 3, 6].map((i) => f.units?.[i])))].filter((id) => id && UNITS[id]);
  const next = () => {
    if (G.mode !== 'menu') return;
    while (ids.length && hasPortrait(ids[0], 64)) ids.shift();
    if (!ids.length) return;
    idleCb((dl) => { if (G.mode !== 'menu' || (!dl.didTimeout && dl.timeRemaining() < 3)) { setTimeout(next, 200); return; } portraitAsync(ids.shift(), 64).finally(next); });
  };
  setTimeout(next, 600);
}
window.__realms = { battleReady: () => G.mode === 'battle' && !bprep && !!BB, G, BT, newWorld, findPath, startWalk, interact, startBattle, endTurn, openTown, closeTown, buildIn, save, load, play, selectHero, heroArmy, objAt, ter, seen, NBR, passable, get BB() { return BB; }, autoBattle: () => { bauto = true; }, hexScreen: (c, r) => { const v = hexPos(c, r).project(bcam); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; }, aiRunning: () => aiRunning, layoutWorld, cam, flyTo, heroMeshes, get walking() { return walking; } };

// ------------------------------------------------------------------ Crown Run (agent "crown"): the roguelite loop on top of the map game.
// Rules and data: crown.js; screens: crown_ui.js; design: dev/CROWN_RUN.md. G.run holds the run (saved with the game);
// the meta progression (unlocks, Collection, Glory) lives in its own store key (CR.META_KEY).
// (var: updateHud may run before this point of the module has been evaluated; crownHud waits for CUI)
var cmeta = null, CUI = null;
const crownMeta = () => (cmeta ||= CR.metaLoad(store));
const saveMeta = () => { if (cmeta) CR.metaSave(store, cmeta); };
CUI = createCrownUI({ icon, unitIcon, sfx, onChange: (k) => { if (k === 'meta') saveMeta(); else if (G.run) crownHud(); } });
CUI.mountHud($('hud'));
const runHero = () => (G.run ? G.heroes[G.run.hero] : null);
// region gates: your heroes stay inside the regions this Ante has opened; the rival crown keeps to its homeland (the last band)
function crownShut(v, hr) {
  const R = G.run; if (!R || !hr || !R.regions) return false;
  return hr.p === 0 ? regionOf[v] >= R.ante : regionOf[v] < R.antes;
}
function crownHud() {
  if (!CUI) return;
  const R = G.run;
  CUI.renderHud(R && !R.over ? R : null, G.day, { onPill: () => { const nb = CR.nextBlind(R); CUI.bossPreview(R, G.day, { threat: nb ? CR.threatArmy(R) : null }); } });
}
function crownMods(ctx) {
  const R = G.run, hr = runHero();
  if (!R || R.over || !hr || ctx.sides[0].hero !== hr) return null;
  const bl = ctx.foe.obj?.blind || null, cap = G.towns.find((t) => t.p === 0);
  return CR.battleMods(R, { boss: bl?.kind === 'boss' ? bl.boss : null, enemyHero: bl?.hero || null, seals: hr.army.map((st) => st?.[2] || null), buildings: cap ? cap.built.length : 0, fort: !!cap?.built.includes('fort') });
}
// after every battle of the run hero: counters, Bone Tally, and for a Blind the payout, the shop or the end of the run
function crownAfter(B, ctx) {
  const R = G.run, hr = runHero();
  if (!R || R.over || !hr || ctx.sides[0].hero !== hr) return;
  const won = B.over.winner === 0, bl = ctx.foe.obj?.blind || null;
  const res = CR.afterBattle(R, B, { won, kind: bl?.kind || null });
  for (const s of B.stacks) CR.discover(crownMeta(), 'unit', UNITS[s.id]?.up || s.id);
  if (res.raise > 0 && hr.alive && addTroops(hr.army, res.raiseAs, res.raise)) toast(`${icon('necromancy', 18)} Bone Tally raises ${res.raise} ${plural(res.raiseAs, res.raise)}.`);
  if (bl) CR.discover(crownMeta(), 'boss', bl.boss && won ? bl.boss : null);
  if (!won || !hr.alive) { R.over = true; R.won = false; afterDialogs(crownEnd); return; }
  if (!bl) { crownHud(); return; }
  const p = CR.payout(R, bl.kind, { unbroken: res.unbroken, goldSeals: res.goldSeals, towns: G.towns.filter((t) => t.p === 0).length });
  R.crowns += p.total;
  CR.advanceBlind(R);
  saveMeta();
  if (R.over) { afterDialogs(crownEnd); return; }
  CR.genShop(R, crownMeta(), crownCtx());
  afterDialogs(() => crownShop(p));
}
// the casualties card comes first; the run's screens wait until it (and any level-up) is closed
function afterDialogs(f) { const go = () => { if (dialogOpen() || G.mode === 'battle') { setTimeout(go, 250); return; } f(); }; setTimeout(go, 300); }
const crownCtx = () => { const hr = runHero(); return { known: hr?.spells || [], army: hr?.army || [] }; };
function crownShop(payout = null) {
  const R = G.run; crownHud();
  CUI.shop(R, { payout, meta: crownMeta(), ctx: crownCtx, apply: crownApply, onDone: () => { saveMeta(); crownHud(); updateHud(); save(); if (G.crownResume) { const f = G.crownResume; G.crownResume = null; f(); } } });
}
// shop goods that touch the game: scrolls teach a spell, upgrades turn a stack into its upgraded creature, packs open
async function crownApply(item, buy) {
  const R = G.run, hr = runHero(); if (!hr) return false;
  if (item.kind === 'scroll') { buy(); if (!hr.spells.includes(item.id)) hr.spells.push(item.id); sfx.learn(); return true; }
  if (item.kind === 'upgrade') {
    const i = hr.army.findIndex((st) => st && st[0] === item.id && st[1] > 0); if (i < 0) { toast('That stack is gone.'); return false; }
    buy(); const n = hr.army[i][1], j = hr.army.findIndex((st) => st && st[0] === item.to && st[1] > 0);
    if (j >= 0) { hr.army[j][1] += n; hr.army[i] = null; } else hr.army[i][0] = item.to;
    sfx.upgrade(); updateHud(); return true;
  }
  if (item.kind === 'pack') { buy(); crownPack(item.id, `shop:${R.ante}:${R.blind}:${R.stats.rerolls}:${R.crowns}`, () => crownShop(null)); return false; }
  return false;
}
// pick 1 of 3: banners go into a free slot, spells are learnt for good, creatures join the run hero
function crownPack(kind, tag, then = null) {
  const R = G.run, hr = runHero();
  const pk = CR.openPack(R, kind, tag, crownMeta(), crownCtx());
  CUI.pack(R, pk, {
    onPick: (c) => {
      if (c.kind === 'banner') { if (!CR.addBanner(R, c, crownMeta())) { toast('Your banner slots are full: skip, or sell one in the shop.'); return false; } }
      else if (c.kind === 'spell') { if (hr.spells.includes(c.id)) hr.mana += 5; else hr.spells.push(c.id); }
      else if (c.kind === 'unit') { if (!addTroops(hr.army, c.id, c.n)) { toast('No free slot in your army.'); return false; } if (c.seal) { const st = hr.army.find((x) => x && x[0] === c.id); if (st) st[2] = c.seal; } }
      saveMeta(); return true;
    },
    onSkip: () => { R.crowns += 1; },
    onDone: () => { crownHud(); updateHud(); then?.(); },
  });
}
// dusk: a Blind due tonight is fought before the night falls (endTurn calls this first; true = it took over)
function crownDusk() {
  const R = G.run; if (!R || R.over || G.over) return false;
  const hr = runHero();
  if (!hr || !hr.alive) { R.over = true; crownEnd(); return true; }
  const nb = CR.blindDue(R, G.day); if (!nb) return false;
  const T = CR.threatArmy(R);
  if (nb.kind === 'boss') CR.discover(crownMeta(), 'boss', nb.boss);
  G.crownResume = () => endTurn();
  CUI.blindIntro(R, nb, T, { onFight: () => {
    const n = T.army.reduce((a, s) => a + s[1], 0);
    startBattle(hr, { kind: 'monster', obj: { id: -1, v: hr.v, unit: T.army[0][0], n, army: T.army, alive: true, blind: { kind: nb.kind, boss: nb.boss, hero: T.hero } } });
  } });
  return true;
}
function crownEnd() {
  const R = G.run; if (!R || G.over && R.ended) return;
  R.over = true; R.ended = true; G.over = true; stopAI();
  const hr = runHero(), meta = crownMeta();
  const res = CR.endRun(R, meta, { armyPower: hr && hr.alive ? BT.armyPower(heroArmy(hr), heroBattle(hr)) : 0 });
  saveMeta(); store.del('realms.save'); crownHud();
  CUI.endScreen(R, res, meta, { onNew: () => crownStart(), onCollection: () => CUI.collection(meta, { onClose: () => showMenu() }), onTitle: () => showMenu() });
}
// a new run: origin and stake, then a full map with the Ante regions banded out from your capital
function crownStart() {
  const meta = crownMeta();
  const go = () => { fadeHide($('menu')); CUI.originPick(meta, { onStart: crownNew, onBack: () => fadeShow($('menu')), onCollection: () => CUI.collection(meta, { onClose: () => fadeShow($('menu')) }) }); };
  if (store.get('realms.save', null) && G.mode === 'menu') { ask('Start a Crown Run?', '<p>Your saved game will be replaced when the run begins.</p>', [['Start the run', go], ['Keep my game', null]]); return; }
  go();
}
function crownNew({ origin, stake, fac }) {
  const seed = (Date.now() % 100000) + 1, meta = crownMeta();
  newWorld(seed, 1, fac, { mode: 'crown', opponents: [{ fac: 'random', col: -1 }], size: 'M', res: 1, fog: true, win: 'conquer' });
  const R = CR.newRun({ seed, origin, stake, fac, meta });
  const hr = G.heroes.find((x) => x.p === 0), cap = G.towns.find((t) => t.p === 0), riv = G.towns.find((t) => t.p === 1);
  R.hero = hr.id;
  for (const st of hr.army) if (st) st[1] = Math.max(1, Math.round(st[1] * R.originFx.armyMul));
  for (const k of RES) G.players[0].res[k] = Math.round(G.players[0].res[k] * R.originFx.resMul);
  if (R.originFx.fort && !cap.built.includes('fort')) cap.built.push('fort');
  // the Ante regions: bands of walking distance from your capital up to the rival's homeland (the last band)
  const D = Math.max(12, cellSteps(cap.v, riv ? riv.v : cap.v));
  R.regions = { from: cap.v, bands: Array.from({ length: R.antes }, (_, i) => Math.round(D * (0.3 + 0.5 * i / Math.max(1, R.antes - 1)) * 0.95)) };
  markRegions({ from: R.regions.from, bands: R.regions.bands, wall: true, per: 2 });
  G.run = R;
  play(); save(); crownHud();
  setTimeout(() => CUI.bossPreview(R, G.day, { threat: CR.threatArmy(R) }), 900);
}
// hex steps between two cells (the region bands are in steps)
function cellSteps(a, b) { let d = 0; const seen0 = new Set([a]); let fr = [a]; while (fr.length && d < 400) { if (fr.includes(b)) return d; const nx = []; for (const v of fr) for (const n of NBR[v]) if (!seen0.has(n)) { seen0.add(n); nx.push(n); } fr = nx; d++; } return d; }
function crownResume() {
  if (!load()) return;
  const R = G.run;
  if (R?.regions) markRegions({ from: R.regions.from, bands: R.regions.bands, wall: false }); // regionOf is not saved (the walls are, in ter)
  play(); crownHud();
  if (R?.shop) crownShop(null);
}
// a new week = a new Ante (the Boss Blind already moved run.ante on): its region is open, its boss is shown
function crownWeek() {
  const R = G.run; if (!R || R.over) return;
  toast(`${icon('victory', 18)} Ante ${R.ante}: a new region opens beyond the Crown Gate.`);
  afterDialogs(() => { if (G.run === R && !R.over && G.mode === 'map') CUI.bossPreview(R, G.day, { threat: CR.threatArmy(R) }); });
}
window.CrownRun = { start: crownStart, resume: crownResume };
// test hooks (crown bot / node-free checks)
Object.assign(window.__realms, { crown: { CR, get CUI() { return CUI; }, UNITS, meta: crownMeta, regionOf, get run() { return G.run; } } });
// render perf hooks: adaptive-resolution state / control, and the renderer (renderer.info for draw-call counts)
Object.assign(window.__realms, { quality: QG.state, renderer });
// flat world (agent "flat"): grid + regions API for other modes / tests. GRID changes with the map size, so it is a getter.
Object.defineProperties(window.__realms, Object.getOwnPropertyDescriptors({ get GRID() { return GRID; }, get NV() { return NV; }, cellDist, posOf, setGrid, generate, makeGrid, MAP_PRESETS, markRegions, regionOf, regionsVoronoi, regionsBands, regionGates, pickCell, mini, h, road, TERRAIN, floraStats: () => { let n = 0, sets = 0; for (const S of floraSets.values()) { if (S.im?.count) { sets++; n += S.im.count; } } return { sets, drawn: n, chunks: floraVis.chunks.length }; } }));
Object.assign(window.__realms, { prewarmProfile: () => loadProf, postQueue: () => postQ.map((j) => j.label), bumpWarm });
// battle test hooks (battle-flow logs / soft-lock runs): fast-forward the battle without rendering
Object.defineProperties(window.__realms, Object.getOwnPropertyDescriptors({ get bmesh() { return bmesh; }, get banim() { return banim; }, bstep: (dt) => { if (!bprep) { animateBattle(dt); vfx.update(dt, bcam); } } }));
// geometry cache: idle warm-up hook + stats (models, triangles, CPU-side MB of vertex data)
Object.assign(window.__realms, { trimGeoCache, memStats: () => ({ geoCache: geoCache.size, floaters: floaters.length, heroMeshes: heroMeshes.size, plates: bplateMap.size, bstuff: bstuff.children.length, world: world.children.length, flora: flora.children.length, townScene: townView.scene.children.length, glLost: !!glLost }) });
Object.assign(window.__realms, { warmGeometryIdle, warmQueue: () => warmQ.length + ptQ.length, portraitQueue: () => ptQ.length + portraitsPending(), geoStats: () => { let tris = 0, bytes = 0; for (const m of geoCache.values()) for (const g of [m?.body, m?.glow]) if (g?.attributes?.position) { tris += g.attributes.position.count / 3; for (const a of Object.values(g.attributes)) bytes += a.array.byteLength; } return { models: geoCache.size, tris: Math.round(tris), mb: +(bytes / 1048576).toFixed(1) }; } });
