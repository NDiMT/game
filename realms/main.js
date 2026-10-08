import * as THREE from 'three';
import { mulberry32, unitModel } from './models.js?v=0.2';
import { havenModel } from './units_haven.js?v=0.2';
import { necroModel } from './units_necro.js?v=0.2';
import { neutralModel } from './units_neutral.js?v=0.2';
import { townModel, heroModel, flagModel } from './models_towns.js?v=0.2';
import { objectModel } from './models_objects.js?v=0.2';
import { natureModel, FLORA_FOR_TERRAIN, FOREST_BY_BIOME, PEAK_BY_BIOME, biomeOf } from './nature.js?v=0.2';
import { createBattlefield } from './battlefield.js?v=0.2';
import { createAtmosphere, gradeGLSL } from './atmosphere.js?v=0.2';
import { UNITS, UPGRADES, FACTIONS, NEUTRALS, BUILDINGS, SPELLS, ARTIFACTS, SKILLS, OBJECTS, RES, RES_ICON, START_ARMY } from './data.js?v=0.2';
import * as BT from './battle.js?v=0.2';
import { makeBodyMaterial, makeGlowMaterial, makeHitMaterial, tick as tickMaterials } from './materials.js?v=0.2';
import { createScore } from './music.js?v=0.2';

// =====================================================================
// HEX REALMS: a heroes-and-magic strategy game on a small hex planet.
// Lead your heroes across the world, flag mines, gather treasure, build
// your town and recruit its creatures, and defeat the rival lords in
// turn-based battles on a hex battlefield.
// =====================================================================

const APP_VERSION = '0.2';
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
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('app').prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d1e);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
const sunDir = new THREE.Vector3(0.6, 0.8, 0.4).normalize();
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 30 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x3a3020, 0.8));
scene.add(new THREE.AmbientLight(0x404a70, 0.35));
const cam = { theta: 0, phi: 1.2, dist: 10, tTheta: 0, tPhi: 1.2, tDist: 10, vTheta: 0, vPhi: 0, fly: false, shake: 0 };
const lookAtP = new THREE.Vector3();
function updateCamera(dt) {
  if (cam.fly) {
    let d = cam.tTheta - cam.theta;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    cam.theta += d * Math.min(1, dt * 4);
    cam.phi += (cam.tPhi - cam.phi) * Math.min(1, dt * 4);
    if (Math.abs(d) < 0.001 && Math.abs(cam.tPhi - cam.phi) < 0.001) cam.fly = false;
  } else {
    cam.theta += cam.vTheta; cam.phi += cam.vPhi;
    cam.vTheta *= 0.88; cam.vPhi *= 0.88;
  }
  cam.phi = clamp(cam.phi, 0.12, Math.PI - 0.12);
  cam.dist += (cam.tDist - cam.dist) * Math.min(1, dt * 6);
  // close up, the camera tilts toward the horizon like a strategy map
  const f = clamp((16 - cam.dist) / 9, 0, 1);
  camera.position.setFromSphericalCoords(cam.dist, cam.phi + f * 0.5, cam.theta);
  if (cam.shake > 0) { camera.position.x += (rnd() - 0.5) * cam.shake * 0.1; cam.shake = Math.max(0, cam.shake - dt * 2); }
  lookAtP.setFromSphericalCoords(R * f * 0.98, cam.phi, cam.theta);
  camera.up.set(0, 1, 0);
  camera.lookAt(lookAtP);
  // the shadow-casting sun follows the view so shadows stay crisp near the camera
  const focus = lookAtP.lengthSq() > 0.01 ? lookAtP.clone().setLength(R) : camera.position.clone().setLength(R);
  const right = new THREE.Vector3().crossVectors(camera.position, UP).normalize();
  sun.position.copy(focus).addScaledVector(camera.position.clone().sub(focus).normalize(), 9).addScaledVector(right, 5).addScaledVector(focus.clone().normalize(), 6);
  sun.target.position.copy(focus);
}
function flyTo(v, dist) {
  const sp = new THREE.Spherical().setFromVector3(DIRS[v]);
  cam.tTheta = sp.theta; cam.tPhi = sp.phi; cam.fly = true; cam.vTheta = cam.vPhi = 0;
  if (dist) cam.tDist = dist;
}
function resize() {
  const w = window.innerWidth, hh = window.innerHeight;
  renderer.setSize(w, hh);
  post.setSize(w, hh, renderer.getPixelRatio());
  camera.aspect = w / hh; camera.fov = w < hh ? 50 : 40; camera.updateProjectionMatrix();
  bcam.aspect = w / hh; bcam.fov = w < hh ? 52 : 40; bcam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
const atmos = createAtmosphere(THREE, scene, { R });


// ------------------------------------------------------------------ the planet mesh: bevelled hex columns with cliff walls
// the surface itself (textures, bevels, cliffs, roads, fog, water) is built by terrain.js
import { createPlanet } from './terrain.js?v=0.2';
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
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 48, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  vertexShader: 'varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec3 vN; void main() { float i = pow(clamp(0.8 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0); gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * i * 1.6, 1.0); }',
}));
scene.add(atmo);

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
  const comp = new THREE.ShaderMaterial({ uniforms: { tScene: { value: null }, tBloom: { value: null } }, vertexShader: vs, depthTest: false,
    fragmentShader: `uniform sampler2D tScene; uniform sampler2D tBloom; varying vec2 vUv;
      ${gradeGLSL}
      void main() { vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * 0.8; c = grade(c); c = c / (1.0 + c * 0.12);
        float v = smoothstep(1.15, 0.35, length(vUv - 0.5)); c *= mix(0.72, 1.0, v);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  let w = 1, hh = 1;
  return {
    setSize(W, H, pr) { w = W * pr; hh = H * pr; rtScene.setSize(w, hh); rtA.setSize(w / 2, hh / 2); rtB.setSize(w / 2, hh / 2); },
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
const geoCache = new Map();
const unitGeo = (id) => { const base = UNITS[id]?.up || id; return havenModel(base) || necroModel(base) || neutralModel(base) || unitModel(base, UNITS[id].col); };
const cached = (k, f) => { if (!geoCache.has(k)) geoCache.set(k, f()); return geoCache.get(k); };
function meshOf(m) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(m.body, bodyMat); b.castShadow = true; b.receiveShadow = true; g.add(b);
  if (m.glow) g.add(new THREE.Mesh(m.glow, glowMat));
  return g;
}
const UP = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion();
// stands a group on a cell, local +y along the planet normal
function placeOn(obj, v, scale, turn = 0, lift = 0) {
  qa.setFromUnitVectors(UP, DIRS[v]);
  obj.quaternion.copy(qa);
  obj.rotateY(YAW[v] + turn);
  obj.position.copy(DIRS[v]).multiplyScalar(radiusOf(v) + lift);
  obj.scale.setScalar(scale);
}
const world = new THREE.Group(); scene.add(world);
const flora = new THREE.Group(); scene.add(flora);
// forests, mountains and rocks: instanced per model
const pickW = (list, r) => { const tot = list.reduce((x, e) => x + e.w, 0); let k = r * tot; for (const e of list) { k -= e.w; if (k <= 0) return e.key; } return list[0].key; };
const dummy = new THREE.Object3D();
function layoutFlora() {
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
    F.scatter.forEach((e, i) => { if (placed >= 2 || rr(i + 20) > e.p) return; const a = rr(i + 30) * 6.28, d = 0.05 + rr(i + 40) * 0.07; put(e.key, v, e.s, Math.cos(a) * d, Math.sin(a) * d, a * 3); placed++; });
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
const TOWN_NAMES = { haven: ['Highcastle', 'Brightwater', 'Stormhold', 'Valemere'], necro: ['Gravenreach', 'Duskmoor', 'Ashfall', 'Wraithgate'] };
function newTown(v, p, fac, name) {
  return { id: G.towns.length, v, p, fac, name, built: ['d1'], avail: { 1: UNITS[FACTIONS[fac].units[0]].grow }, garrison: [], builtToday: false, spells: [] };
}
function newWorld(seed, diff = 1) {
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
  G.players = [newPlayer(0, 'haven', false), newPlayer(1, 'necro', true)];
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
    const fac = i % 2 ? 'haven' : 'necro';
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
    hr.spells = P.fac === 'haven' ? ['bless'] : ['arrow'];
    if (P.fac === 'necro') hr.skills.necromancy = 1; else hr.skills.leadership = 1;
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
  const open = new Map([[from, 0]]), came = new Map(), g = new Map([[from, 0]]);
  const heur = (v) => DIRS[v].distanceTo(DIRS[to]) * 600;
  const fScore = new Map([[from, heur(from)]]);
  let guardSteps = 0;
  while (open.size && guardSteps++ < 6000) {
    let cur = -1, best = Infinity;
    for (const [v] of open) { const f = fScore.get(v); if (f < best) { best = f; cur = v; } }
    if (cur === to) { const p = [cur]; while (came.has(cur)) { cur = came.get(cur); p.unshift(cur); } return p; }
    open.delete(cur);
    for (const n of NBR[cur]) {
      if (!passable(n)) continue;
      if (!ignore && n !== to) {
        if (objAt[n] >= 0 && G.objects[objAt[n]].alive) continue;
        const hh = heroAt(n); if (hh && hh !== hr) continue;
      }
      // walking past a monster wakes it: avoid it unless there is no other way
      const ng = g.get(cur) + stepCost(cur, n) + (!ignore && n !== to && zoc(n) && hr ? 4000 : 0);
      if (ng < (g.get(n) ?? Infinity)) { came.set(n, cur); g.set(n, ng); fScore.set(n, ng + heur(n)); open.set(n, 1); }
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
const SCALE = { town: 0.4, monster: 0.2, goldmine: 0.3, gemmine: 0.3, orepit: 0.3, sawmill: 0.28, dwelling: 0.3, arena: 0.28, tower: 0.24, library: 0.27, stone: 0.24, obelisk: 0.24, shrine: 0.27, well: 0.27, windmill: 0.27, stables: 0.27 };
function layoutWorld() {
  worldDirty = false;
  rebuildPlanet();
  layoutFlora();
  world.clear();
  for (const o of G.objects) {
    if (!o.alive || !seen[o.v]) continue;
    const g = meshOf(objModel(o));
    placeOn(g, o.v, SCALE[o.type] || 0.24, o.type === 'monster' ? (hash(o.id) % 6) : 0);
    if (o.type === 'monster') g.userData.bob = o.id;
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
    if (!m) {
      m = meshOf(cached('hero' + hr.p, () => heroModel(G.players[hr.p].fac, G.players[hr.p].color)));
      scene.add(m); heroMeshes.set(hr.id, m);
    }
    if (!hr.anim || force) placeOn(m, hr.v, 0.22, hr.face || 0);
  }
  for (const [id, m] of heroMeshes) if (!G.heroes[id] || !G.heroes[id].alive) { scene.remove(m); heroMeshes.delete(id); }
}
// path preview: green dots for today, red for later days, a banner on the goal
const dotGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10);
const dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), 200);
dots.count = 0; dots.frustumCulled = false; scene.add(dots);
const goalMark = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe27a, toneMapped: false }));
goalMark.visible = false; scene.add(goalMark);
const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9ad8ff, toneMapped: false }));
scene.add(selRing);
let plan = null;
function showPath(hr, path) {
  plan = path ? { hr: hr.id, path } : null;
  if (!path) { dots.count = 0; goalMark.visible = false; return; }
  const today = stepsToday(hr, path);
  let n = 0;
  const green = new THREE.Color(0x6aff6a), red = new THREE.Color(0xff5a4a);
  for (let i = 1; i < path.length && n < 200; i++) {
    placeOn(dummy, path[i], 1, 0, 0.012); dummy.updateMatrix();
    dots.setMatrixAt(n, dummy.matrix); dots.setColorAt(n++, i <= today ? green : red);
  }
  dots.count = n; dots.instanceMatrix.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
  placeOn(goalMark, path[path.length - 1], 1, 0, 0.02); goalMark.visible = true;
  goalMark.material.color.set(today >= path.length - 1 ? 0x6aff6a : 0xff7a5a);
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
cvs.addEventListener('pointerdown', (e) => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [p, q] = [...ptrs.values()]; pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), dist: G.mode === 'battle' ? bview.dist : cam.tDist }; press = null; return; }
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false };
});
cvs.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (G.mode === 'battle') bview.dist = clamp(pinch.dist * pinch.d / d, 9, 18);
    else cam.tDist = clamp(pinch.dist * pinch.d / d, 6.4, 22);
    return;
  }
  if (!press || press.id !== e.pointerId) return;
  const dx = e.clientX - press.lx, dy = e.clientY - press.ly;
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true;
  press.lx = e.clientX; press.ly = e.clientY;
  if (!press.moved) return;
  if (G.mode === 'battle') { bview.yaw = clamp(bview.yaw - dx * 0.004, -0.6, 0.6); return; }
  const k = cam.dist / 900;
  cam.vTheta = -dx * k * 0.5; cam.vPhi = -dy * k * 0.5; cam.fly = false;
});
const endPtr = (e) => {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (!press || press.id !== e.pointerId) return;
  if (!press.moved && performance.now() - press.t < 500) { if (G.mode === 'battle') battleTap(e.clientX, e.clientY); else if (G.mode === 'map') mapTap(e.clientX, e.clientY); }
  press = null;
};
cvs.addEventListener('pointerup', endPtr);
cvs.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); press = null; pinch = null; });
cvs.addEventListener('wheel', (e) => { e.preventDefault(); if (G.mode === 'battle') bview.dist = clamp(bview.dist * (e.deltaY > 0 ? 1.08 : 0.92), 8, 16); else cam.tDist = clamp(cam.tDist * (e.deltaY > 0 ? 1.1 : 0.9), 6.4, 22); }, { passive: false });

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
  // a route left over from yesterday is shown again: tap its goal to carry on
  showPath(hr, hr.route && hr.route[0] === hr.v && findPath(hr.v, hr.route[hr.route.length - 1], hr) ? findPath(hr.v, hr.route[hr.route.length - 1], hr) : null);
  updateHud(); sfx.click();
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
  const target = W.i + 1 === W.path.length - 1 && blockingAt(b, hr);
  W.t += dt * 6;
  if (m) {
    const k = Math.min(1, W.t), kk = target ? Math.min(k, 0.45) : k;
    tmpA.copy(posOf(a)); tmpB.copy(posOf(b));
    m.position.copy(tmpA.lerp(tmpB, kk)).add(DIRS[a].clone().lerp(DIRS[b], kk).normalize().multiplyScalar(Math.sin(kk * Math.PI) * 0.015));
    qa.setFromUnitVectors(UP, m.position.clone().normalize()); m.quaternion.copy(qa);
    // face the way we walk
    const fwd = tmpB.copy(posOf(b)).sub(posOf(a)), up = m.position.clone().normalize();
    m.lookAt(m.position.clone().add(fwd)); m.up.copy(up);
    const look = new THREE.Matrix4().lookAt(new THREE.Vector3(), fwd.clone().projectOnPlane(up).normalize().negate(), up);
    m.quaternion.setFromRotationMatrix(look);
  }
  if (W.t < 1) return;
  W.t = 0;
  // arrive at b
  if (target) { walking = null; layoutHeroes(true); interact(hr, b); return; }
  hr.mp -= stepCost(a, b); hr.v = b; W.i++;
  if (reveal(b, visionOf(hr))) worldDirty = true;
  sfx.step();
  // a monster next to the path attacks
  const lurker = NBR[b].map((n) => (objAt[n] >= 0 ? G.objects[objAt[n]] : null)).find((o) => o && o.alive && o.type === 'monster' && o.v !== W.path[W.path.length - 1]);
  if (lurker) { walking = null; layoutHeroes(true); interact(hr, lurker.v); return; }
  if (W.i >= W.n) {
    walking = null; layoutHeroes(true);
    if (W.i < W.path.length - 1) { hr.route = W.path.slice(W.i); showPath(hr, hr.route); } else hr.route = null;
    updateHud();
  }
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
function removeObject(o) { o.alive = false; if (objAt[o.v] === o.id) objAt[o.v] = -1; worldDirty = true; }
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
  if (o.type === 'monster') {
    // much weaker monsters may offer to join you, or flee
    const ratio = BT.armyPower(heroArmy(hr), hr) / Math.max(1, BT.armyPower([[o.unit, o.n]]));
    if (you && ratio > 4 && !o.refused && hash(o.id * 13 + G.day) % 100 < 55) {
      const u = UNITS[o.unit], price = Math.round(o.n * u.cost.gold * 0.6), free = ratio > 8;
      ask(`${unitIcon(o.unit)} The ${plural(o.unit)} bow before you`, free ? `${o.n} ${plural(o.unit, o.n)} are so impressed by your army that they offer to join you for free.` : `${o.n} ${plural(o.unit, o.n)} offer to join you for ${fmt(price)} 🪙.`, [
        [free ? '🤝 Accept' : `🤝 Hire for ${fmt(price)}`, free || G.players[0].res.gold >= price ? () => { if (addTroops(hr.army, o.unit, o.n)) { if (!free) G.players[0].res.gold -= price; removeObject(o); toast(`${unitIcon(o.unit)} ${o.n} ${plural(o.unit, o.n)} join ${hr.name}.`); sfx.fanfare(); updateHud(); } else toast('No free slot in your army.'); } : undefined],
        ['⚔️ Fight them', () => startBattle(hr, { kind: 'monster', obj: o })],
        ['Let them flee', () => { removeObject(o); giveXp(hr, 0); toast(`${plural(o.unit)} run for their lives.`); }],
      ]);
      return;
    }
    if (you) ask(`${sizeWord(o.n)} ${plural(o.unit)}`, `${unitIcon(o.unit)} About ${o.n <= 4 ? o.n : `${Math.round(o.n * 0.8)}–${Math.round(o.n * 1.2)}`} of them. ${threatWord(o)}.`, [['⚔️ Fight', () => startBattle(hr, { kind: 'monster', obj: o })], ['Leave', null]]);
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
    if (RES.includes(o.type)) { gain(hr.p, o.type, o.amount, v); if (you) sfx.coin(); }
    else if (o.type === 'campfire') { gain(hr.p, 'gold', 400 + ((rnd() * 3) | 0) * 100, v); const r = ['wood', 'ore', 'gems'][(rnd() * 3) | 0]; gain(hr.p, r, r === 'gems' ? 2 : 4, v); if (you) sfx.coin(); }
    else if (o.type === 'chest') {
      const g = 1000 + ((rnd() * 3) | 0) * 250, xp = g - 500;
      if (you) ask('🧰 Treasure Chest', 'You find a chest full of gold. Keep it, or give it to the peasants for their wisdom?', [[`🪙 ${fmt(g)} gold`, () => { gain(0, 'gold', g, v); sfx.coin(); updateHud(); }], [`⭐ ${fmt(xp)} experience`, () => giveXp(hr, xp)]]);
      else gain(hr.p, 'gold', g);
    } else if (o.type === 'artifact') {
      const A = ARTIFACTS.find((x) => x.id === o.art);
      hr.arts.push(A.id); hr.mana = Math.min(maxMana(hr), hr.mana);
      if (you) { showMsg(`${A.icon} ${A.name}`, `${artDesc(A)}`); sfx.fanfare(); }
    }
    updateHud(); return;
  }
  if (kind === 'mine') {
    if (o.owner !== hr.p) { o.owner = hr.p; worldDirty = true; if (you) { toast(`${O.icon} ${O.name} is yours: +${O.amount} ${RES_ICON[O.res]} every day.`); sfx.flag(); } else if (seen[o.v]) toast(`🚩 ${P(hr).name} took a ${O.name}.`); }
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
      if (you) { showMsg(`⛩️ ${S.icon} ${S.name}`, S.desc); sfx.magic(); }
    }
    updateHud(); return;
  }
  if (kind === 'weekly') {
    const key = `w${o.id}:${week()}`;
    if (hr.visited.includes(key)) { if (you) toast(`${O.icon} Come back next week.`); return; }
    hr.visited.push(key);
    if (o.type === 'well') { hr.mana = maxMana(hr); if (you) { toast('⛲ Your mana is restored.'); sfx.magic(); } }
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
  const was = t.p;
  t.p = hr.p; t.garrison = [];
  worldDirty = true;
  if (hr.p === 0) { showMsg(`🏰 ${t.name} is yours!`, `The ${FACTIONS[t.fac].name} town now pays you gold and its dwellings will recruit for you.`); sfx.fanfare(); }
  else if (was === 0) { showMsg(`🔥 ${t.name} has fallen`, `${P(hr).name} captured your town.`); sfx.deny(); }
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
  const names = { att: '🗡️ Attack', def: '🛡️ Defence', pow: '🔮 Power', know: '📘 Knowledge' };
  ask(`⭐ ${L.hr.name} reaches level ${L.hr.lvl}`, `${names[L.stat]} +1. Choose a skill:`, L.opts.map((k) => [`${SKILLS[k].icon} ${SKILLS[k].name} ${['', 'I', 'II', 'III'][(L.hr.skills[k] || 0) + 1]}`, () => { L.hr.skills[k] = (L.hr.skills[k] || 0) + 1; if (k === 'logistics') L.hr.mp += 150; pendingLevels.shift(); updateHud(); setTimeout(showLevel, 200); }, SKILLS[k].desc]), true);
  sfx.fanfare();
}

// ------------------------------------------------------------------ battle: a separate little scene
const bscene = new THREE.Scene();
bscene.background = new THREE.Color(0x87a8d8);
bscene.fog = new THREE.Fog(0x87a8d8, 14, 34);
const bcam = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
const bview = { dist: 12.5, yaw: 0 };
{
}
const bSun = new THREE.DirectionalLight(0xfff0d8, 2.4); bSun.position.set(4, 10, 3); bSun.castShadow = true; bSun.shadow.mapSize.set(2048, 2048);
Object.assign(bSun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); bSun.shadow.bias = -0.0005;
const bHemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a3a2a, 0.9), bAmb = new THREE.AmbientLight(0x404a70, 0.3);
bscene.add(bSun, bHemi, bAmb);
let bfield = null;
const HS = 0.5, HW = Math.sqrt(3) * HS, VS = 1.5 * HS;
const hexPos = (c, r) => new THREE.Vector3((c - (BT.COLS - 1) / 2 + (r & 1 ? 0.5 : 0) - 0.25) * HW, 0, (r - (BT.ROWS - 1) / 2) * VS);
const hexGeo = new THREE.CylinderGeometry(HS * 0.95, HS * 0.95, 0.02, 6);
const hexes = new THREE.InstancedMesh(hexGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false }), BT.COLS * BT.ROWS);
hexes.frustumCulled = false; bscene.add(hexes);
for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) { dummy.position.copy(hexPos(c, r)); dummy.quaternion.identity(); dummy.scale.setScalar(1); dummy.updateMatrix(); hexes.setMatrixAt(BT.key(c, r), dummy.matrix); hexes.setColorAt(BT.key(c, r), new THREE.Color(0xffffff)); }
const bstuff = new THREE.Group(); bscene.add(bstuff);
const wallMat = new THREE.MeshStandardMaterial({ color: 0xb8ae9a, roughness: 0.9, flatShading: true });
const activeRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 30).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd84a, toneMapped: false }));
bscene.add(activeRing);
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
  if (sides[0].owner !== 0 && sides[1].owner !== 0) { BT.autoResolve(B); finishBattle(B, ctx); return; }
  enterBattle(B, ctx);
}
function enterBattle(B, ctx) {
  BB = B; bctx = ctx; banim = []; bwait = 0.6; bspell = null; bauto = false; B.events.length = 0;
  G.mode = 'battle'; showPath(selHero(), null);
  if (bfield) bscene.remove(bfield.group);
  bfield = createBattlefield(THREE, ctx.terrain, hexPos, BT.COLS, BT.ROWS);
  bscene.add(bfield.group);
  bscene.background.set(bfield.sky);
  bscene.fog.color.set(bfield.fog.color); bscene.fog.near = bfield.fog.near; bscene.fog.far = bfield.fog.far;
  const L = bfield.lights;
  bSun.color.set(L.sun.color); bSun.intensity = L.sun.intensity;
  bHemi.color.set(L.hemi.sky); bHemi.groundColor.set(L.hemi.ground); bHemi.intensity = L.hemi.intensity;
  bAmb.color.set(L.ambient.color); bAmb.intensity = L.ambient.intensity;
  bstuff.clear(); bmesh.clear();
  for (const k of B.obstacles) {
    const c = k % BT.COLS, r = (k / BT.COLS) | 0;
    if (B.walls.has(k)) { const w = new THREE.Mesh(cached('wallgeo', () => { const g = new THREE.BoxGeometry(HW * 1.02, 0.7, 0.5); g.translate(0, 0.35, 0); return g; }), wallMat); w.castShadow = w.receiveShadow = true; w.position.copy(hexPos(c, r)); bstuff.add(w); for (const dx of [-0.3, 0, 0.3]) { const m = new THREE.Mesh(cached('merlon', () => new THREE.BoxGeometry(0.18, 0.18, 0.5).translate(0, 0.79, 0)), wallMat); m.position.copy(hexPos(c, r)).add(new THREE.Vector3(dx, 0, 0)); bstuff.add(m); } continue; }
    const m = meshOf(cached('obs' + ctx.terrain + '_' + (k % 3), () => bfield.obstacleModel(k % 3))); m.position.copy(hexPos(c, r)); m.rotation.y = k; bstuff.add(m);
  }
  if (B.walls.size) { const tw = new THREE.Mesh(cached('towergeo', () => { const g = new THREE.CylinderGeometry(0.45, 0.55, 2, 10); g.translate(0, 1, 0); return g; }), wallMat); tw.castShadow = true; const tr = (B.town.side ?? 1) === 1 ? 0 : BT.ROWS - 1; tw.position.copy(hexPos(BT.COLS - 1, tr)).add(new THREE.Vector3(1.1, 0, 0)); bstuff.add(tw); const roof = new THREE.Mesh(cached('towerroof', () => new THREE.ConeGeometry(0.6, 0.8, 10).translate(0, 2.4, 0)), new THREE.MeshStandardMaterial({ color: G.towns.find((t) => t === bctx.foe.town)?.fac === 'necro' ? 0x6a2a3a : 0x3a6ad8, flatShading: true })); roof.position.copy(tw.position); bstuff.add(roof); bctx.tower = tw; }
  $('blabels').innerHTML = ''; for (const f of floaters) f.el.remove(); floaters.length = 0;
  for (const s of B.stacks) {
    const m = meshOf(cached('u' + s.id, () => unitGeo(s.id)));
    m.scale.setScalar(0.72 * (s.u.tier >= 6 ? 1.1 : 1) * (s.u.up ? 1.08 : 1));
    m.position.copy(hexPos(s.c, s.r)); m.rotation.y = s.side === 0 ? Math.PI : 0;
    bstuff.add(m); bmesh.set(s.uid, m);
    const lab = document.createElement('div'); lab.className = `blab s${s.side}`; lab.id = `bl${s.uid}`; $('blabels').appendChild(lab);
  }
  $('battle').hidden = false; $('hud').hidden = true;
  const hs = ctx.sides.map((sd) => (sd.hero ? sd.hero.name : sd.owner < 0 ? 'Neutrals' : 'Garrison'));
  $('b-title').textContent = `${hs[0]} vs ${hs[1]}`;
  score?.setEra(3);
  BT.nextStack(B);
  refreshBattle();
  sfx.alarm();
}
function refreshBattle() {
  const B = BB; if (!B) return;
  for (const s of B.stacks) {
    const lab = $(`bl${s.uid}`); if (!lab) continue;
    lab.textContent = s.count > 0 ? s.count : '';
    lab.hidden = s.count <= 0;
  }
  // highlight what the active stack can do
  const s = B.active, mineTurn = s && sideOwner(s.side) === 0 && !bauto && !B.over && !banim.length;
  const reach = mineTurn ? BT.reachable(B, s) : new Map();
  const white = new THREE.Color(0x203a10), grn = new THREE.Color(0xc8ff9a), red = new THREE.Color(0xff6a5a), blu = new THREE.Color(0x7ac8ff);
  for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) {
    const k = BT.key(c, r), st = BT.stackAt(B, c, r);
    let col = white;
    if (mineTurn && reach.has(k) && !st) col = grn;
    if (mineTurn && st && st.side !== s.side && (BT.canShoot(B, s) || BT.attackFrom(B, s, st).length || BT.nbrs(st.c, st.r).some(([x, y]) => x === s.c && y === s.r))) col = red;
    if (bspell && st) col = SPELLS[bspell].target === 'ally' ? (st.side === 0 ? blu : white) : st.side === 1 ? red : white;
    hexes.setColorAt(k, col);
    dummy.position.copy(hexPos(c, r)); dummy.quaternion.identity(); dummy.scale.setScalar(col === white ? 0.0001 : 1); dummy.updateMatrix(); hexes.setMatrixAt(k, dummy.matrix);
  }
  hexes.instanceColor.needsUpdate = true; hexes.instanceMatrix.needsUpdate = true;
  if (s) { activeRing.position.copy(hexPos(s.c, s.r)).setY(0.03); activeRing.visible = true; activeRing.material.color.set(s.side === 0 ? 0xffd84a : 0xff5a4a); } else activeRing.visible = false;
  // the turn order strip
  $('b-queue').innerHTML = BT.queue(B, 9).map((x, i) => `<span class="q s${x.side}${i === 0 ? ' now' : ''}">${unitIcon(x.id)}<b>${x.count}</b></span>`).join('');
  const h0 = B.heroes[0];
  $('b-spell').disabled = !h0 || B.cast[0] || !h0.spells.some((id) => h0.mana >= SPELLS[id].mana) || !mineTurn;
  $('b-spell').textContent = h0 ? `🔮 ${h0.mana}` : '🔮';
  $('b-wait').disabled = $('b-def').disabled = !mineTurn;
  $('b-auto').classList.toggle('on', bauto);
  $('b-msg').textContent = !s ? '' : mineTurn ? (bspell ? `${SPELLS[bspell].icon} Choose a target for ${SPELLS[bspell].name}` : `${UNITS[s.id].name} (${s.count}) · ${BT.canShoot(B, s) ? `🏹 ${s.shots} shots · tap an enemy to shoot` : 'tap a green hex to move or a red enemy to attack'}`) : sideOwner(s.side) === 0 ? 'Auto battle…' : `Enemy ${UNITS[s.id].name} (${s.count})…`;
}
const sideOwner = (side) => bctx.sides[side].owner;
function battleTap(cx, cy) {
  const B = BB; if (!B || banim.length || B.over) return;
  const s = B.active; if (!s || sideOwner(s.side) !== 0 || bauto) return;
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, bcam);
  const p = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p);
  let best = null, bd = 1e9;
  for (let r = 0; r < BT.ROWS; r++) for (let c = 0; c < BT.COLS; c++) { const d = hexPos(c, r).distanceTo(p); if (d < bd) { bd = d; best = [c, r]; } }
  if (!best || bd > HS * 1.2) return;
  const [c, r] = best, t = BT.stackAt(B, c, r);
  if (bspell) {
    const S = SPELLS[bspell];
    if (S.target === 'area' || (t && ((S.target === 'enemy' && t.side === 1) || (S.target === 'ally' && t.side === 0)))) {
      BT.castSpell(B, 0, bspell, S.target === 'area' ? null : t, c, r);
      bspell = null; afterAction(); sfx.magic();
    } else sfx.deny();
    return;
  }
  if (t && t.side !== s.side) {
    const shoot = BT.canShoot(B, s);
    if (bpreview !== t.uid) {
      const adj0 = BT.nbrs(t.c, t.r).some(([x, y]) => x === s.c && y === s.r);
      if (!shoot && !adj0 && !BT.attackFrom(B, s, t).length) { toast('Too far to reach this turn.'); sfx.deny(); return; }
      const est = BT.estimate(B, s, t, shoot);
      bpreview = t.uid; sfx.click();
      $('b-msg').innerHTML = `${shoot ? '🏹' : '⚔️'} ${est.lo === est.hi ? est.lo : `${est.lo}–${est.hi}`} damage · kills ${est.klo === est.khi ? est.klo : `${est.klo}–${est.khi}`} of ${t.count} ${plural(t.id, t.count)} · <b>tap again</b>`;
      return;
    }
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
function afterAction() { bpreview = null; queueEvents(); refreshBattle(); }
function queueEvents() { bpreview = null; banim.push(...BB.events.map((e) => ({ e, t: 0 }))); BB.events.length = 0; }
$('b-wait').addEventListener('click', () => { const s = BB?.active; if (!s || banim.length) return; BT.actWait(BB, s); BT.nextStack(BB); afterAction(); sfx.click(); });
$('b-def').addEventListener('click', () => { const s = BB?.active; if (!s || banim.length) return; BT.actDefend(BB, s); afterAction(); sfx.click(); });
$('b-auto').addEventListener('click', () => { bauto = !bauto; bspell = null; refreshBattle(); sfx.click(); });
$('b-quick').addEventListener('click', () => { if (!BB || BB.over) return; BT.autoResolve(BB); BB.events.length = 0; banim = []; endBattleScreen(); });
$('b-spell').addEventListener('click', () => {
  const h0 = BB?.heroes[0]; if (!h0) return;
  ask('🔮 Spellbook', `Mana ${h0.mana}. One spell per round.`, h0.spells.map((id) => [`${SPELLS[id].icon} ${SPELLS[id].name} · ${SPELLS[id].mana}`, h0.mana >= SPELLS[id].mana ? () => { bspell = id; refreshBattle(); } : null, SPELLS[id].desc]).concat([['Close', null]]));
});
// battle animation: events play one after another
const bfloat = (pos, text, cls) => floatText(pos, text, cls, bcam);
function animateBattle(dt) {
  const B = BB; if (!B) return;
  // gentle idle bob
  for (const s of B.stacks) { const m = bmesh.get(s.uid); if (m && s.count > 0 && !m.userData.busy) m.position.y = Math.abs(Math.sin(performance.now() / 400 + s.uid)) * 0.03; }
  // labels follow their stacks
  for (const s of B.stacks) { const m = bmesh.get(s.uid), lab = $(`bl${s.uid}`); if (!m || !lab) continue; const v = m.position.clone().setY(0.05).project(bcam); lab.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px)`; }
  if (banim.length) {
    const a = banim[0], e = a.e; a.t += dt;
    const done = playEvent(e, a.t);
    if (done) { banim.shift(); refreshBattle(); }
    return;
  }
  if (B.over) { if ((bwait -= dt) <= 0) endBattleScreen(); return; }
  const s = B.active && !B.active.acted && B.active.count > 0 ? B.active : BT.nextStack(B);
  if (!s) return;
  if (sideOwner(s.side) === 0 && !bauto) return;
  if ((bwait -= dt) > 0) return;
  bwait = bauto ? 0.25 : 0.45;
  if (!B.cast[s.side] && B.heroes[s.side] && rnd() < 0.5) BT.aiCast(B, s.side);
  if (!B.over) BT.aiAct(B, s);
  if (!B.over) BT.nextStack(B);
  queueEvents(); refreshBattle();
}
function playEvent(e, t) {
  const B = BB, M = (uid) => bmesh.get(uid), S = (uid) => B.stacks[uid];
  if (e.t === 'move') {
    const m = M(e.s), path = e.path && e.path.length > 1 ? e.path : [e.from, e.to], per = e.fly ? 0.5 : 0.16, total = e.fly ? 0.55 : per * (path.length - 1);
    const k = Math.min(1, t / total), seg = k * (path.length - 1), i = Math.min(path.length - 2, Math.floor(seg)), f = seg - i;
    const p = hexPos(...path[i]).lerp(hexPos(...path[i + 1]), f);
    if (e.fly) p.y = Math.sin(k * Math.PI) * 1.2;
    m.position.copy(p); m.userData.busy = k < 1;
    const dir = hexPos(...path[i + 1]).sub(hexPos(...path[i]));
    if (dir.lengthSq() > 0.001) m.rotation.y = Math.atan2(dir.x, dir.z);
    if (k >= 1) m.rotation.y = S(e.s).side === 0 ? Math.PI : 0;
    if (t === 0 || (t < 0.02)) sfx.step();
    return k >= 1;
  }
  if (e.t === 'hit' || e.t === 'shot') {
    const a = M(e.a), d = M(e.d), sa = S(e.a), sd = S(e.d);
    const dur = e.t === 'shot' ? 0.6 : 0.45;
    if (!e.started) {
      e.started = true;
      const dir = d.position.clone().sub(a.position); a.rotation.y = Math.atan2(dir.x, dir.z);
      if (e.t === 'shot') { const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: sa.id === 'lich' ? 0x9a6aff : sa.id === 'monk' ? 0xffe27a : 0xffffff, toneMapped: false })); bstuff.add(ball); e.ball = ball; sfx.shoot(); }
      else sfx.hit();
    }
    if (e.t === 'hit') { const k = Math.sin(Math.min(1, t / 0.3) * Math.PI) * 0.25; const dir = d.position.clone().sub(a.position).setY(0).normalize(); a.userData.busy = true; a.position.copy(hexPos(sa.c, sa.r)).addScaledVector(dir, k); }
    if (e.ball) { const k = Math.min(1, t / 0.45); e.ball.position.copy(a.position).lerp(d.position, k).setY(0.5 + Math.sin(k * Math.PI) * 1.0); if (k >= 1 && e.ball.parent) bstuff.remove(e.ball); }
    if (t >= (e.t === 'shot' ? 0.45 : 0.18) && !e.shown) {
      e.shown = true;
      d.userData.flash = 0.3;
      bfloat(d.position.clone().setY(1), `-${fmt(e.dmg)}${e.killed ? ` (${e.killed}💀)` : ''}${e.lucky ? ' 🍀' : ''}`, sd.side === 0 ? 'red' : 'gold');
      if (e.retal) bfloat(d.position.clone().setY(1.4), 'Retaliation', 'blue');
      const lab = $(`bl${sd.uid}`); if (lab) lab.textContent = sd.count > 0 ? sd.count : '';
    }
    if (t >= dur) { a.userData.busy = false; if (sa.count > 0) a.position.copy(hexPos(sa.c, sa.r)); a.rotation.y = sa.side === 0 ? Math.PI : 0; return true; }
    return false;
  }
  if (e.t === 'die') { const m = M(e.s); if (!e.started) { e.started = true; sfx.die(); } m.position.y = -t * 0.8; m.rotation.z = t * 1.5; if (t > 0.5) { m.visible = false; return true; } return false; }
  if (e.t === 'spell') {
    if (!e.started) {
      e.started = true; sfx.magic();
      const p = hexPos(e.c, e.r);
      const col = { arrow: 0xffe27a, bolt: 0x9ad8ff, fireball: 0xff6a2a, cure: 0x6aff8a, bless: 0xffe27a, stoneskin: 0xb8b0a0, haste: 0x9affff, slow: 0x9a7aff }[e.id];
      const fx = new THREE.Mesh(new THREE.SphereGeometry(e.id === 'fireball' ? 1.2 : 0.5, 16, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, toneMapped: false }));
      fx.position.copy(p).setY(0.5); bstuff.add(fx); e.fx = fx;
      bfloat(p.clone().setY(1.8), `${SPELLS[e.id].icon} ${SPELLS[e.id].name}`, 'blue');
      for (const hh of e.hits) { const m = M(hh.s); if (!m) continue; bfloat(m.position.clone().setY(1.1), hh.heal ? `+${hh.heal}` : `-${fmt(hh.dmg)}${hh.killed ? ` (${hh.killed}💀)` : ''}`, hh.heal ? 'green' : 'gold'); m.userData.flash = 0.3; }
    }
    e.fx.scale.setScalar(1 + t * 1.5); e.fx.material.opacity = Math.max(0, 0.7 - t);
    if (t > 0.7) { bstuff.remove(e.fx); return true; }
    return false;
  }
  if (e.t === 'tower') {
    const m = M(e.s);
    if (!e.started) { e.started = true; sfx.shoot(); e.ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })); bstuff.add(e.ball); }
    const from = bctx.tower ? bctx.tower.position.clone().setY(2) : new THREE.Vector3(0, 2, -4), k = Math.min(1, t / 0.5);
    if (m) e.ball.position.copy(from).lerp(m.position.clone().setY(0.5), k).setY(from.y * (1 - k) + 0.5 * k + Math.sin(k * Math.PI) * 0.8);
    if (k >= 1 && !e.shown) { e.shown = true; bstuff.remove(e.ball); if (m) { m.userData.flash = 0.3; bfloat(m.position.clone().setY(1.1), `🏹 Tower -${e.dmg}${e.killed ? ` (${e.killed}💀)` : ''}`, 'red'); } refreshBattle(); }
    return t > 0.65;
  }
  if (e.t === 'morale') { if (!e.started) { e.started = true; bfloat(M(e.s).position.clone().setY(1.3), '🎺 Good morale!', 'gold'); } return t > 0.5; }
  if (e.t === 'round') { if (!e.started) { e.started = true; $('b-round').textContent = `Round ${e.round}`; } return true; }
  if (e.t === 'wait' || e.t === 'defend') { if (!e.started) { e.started = true; const m = M(e.s); if (m) bfloat(m.position.clone().setY(1.1), e.t === 'wait' ? '⏳ Wait' : '🛡️ Defend', 'blue'); } return t > 0.25; }
  return true;
}
function endBattleScreen() {
  const B = BB, ctx = bctx;
  BB = null;
  $('battle').hidden = true; $('hud').hidden = false; $('blabels').innerHTML = '';
  G.mode = 'map';
  score?.setEra(2);
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
  if (ctx.foe.kind === 'town' && win.hero === ctx.hr) captureTown(ctx.hr, ctx.foe.town);
  if (ctx.foe.kind === 'town' && win.hero !== ctx.hr) ctx.foe.town.garrison = (sides.find((sd) => sd.army === ctx.foe.town.garrison) || {}).army || ctx.foe.town.garrison;
  worldDirty = true; layoutHeroes(true);
  if (sides[0].owner === 0 || sides[1].owner === 0) {
    const me = sides[0].owner === 0 ? 0 : 1, won = winSide === me;
    const list = (arr) => (arr.length ? arr.map(([id, n]) => `${unitIcon(id)} ${n} ${plural(id, n)}`).join('<br>') : 'None');
    showMsg(won ? '🏆 Victory!' : '💀 Defeat', `<div class="cas"><div><b>Your losses</b>${list(lost[me])}</div><div><b>Enemy losses</b>${list(lost[1 - me])}</div></div>${won && sides[me].hero ? `<p>⭐ +${fmt(killedHp[me])} experience</p>` : ''}${!won && sides[me].hero ? `<p>${sides[me].hero.name} has fallen.</p>` : ''}`, true);
    won ? sfx.fanfare() : sfx.deny();
  }
  checkEnd();
  updateHud();
}

// ------------------------------------------------------------------ towns
const townIncome = (t) => (t.built.includes('hall3') ? 2000 : t.built.includes('hall2') ? 1000 : 500);
const tierUnit = (t, tier) => (t.built.includes(`u${tier}`) ? UPGRADES[t.fac][tier - 1] : FACTIONS[t.fac].units[tier - 1]);
const costText = (c) => RES.filter((r) => c[r]).map((r) => `${RES_ICON[r]}${fmt(c[r])}`).join(' ');
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
  flyTo(t.v, 8);
  renderTown(); sfx.click();
  score?.setEra(1);
}
function closeTown() { $('town').hidden = true; $('hud').hidden = false; townOpen = null; G.mode = 'map'; score?.setEra(2); updateHud(); }
$('t-close').addEventListener('click', closeTown);
for (const b of document.querySelectorAll('#town .tabs2 button')) b.addEventListener('click', () => { townTab = b.dataset.t; renderTown(); sfx.click(); });
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
function renderTown() {
  const t = G.towns[townOpen], Pl = G.players[t.p], vis = visitorOf(t);
  for (const b of document.querySelectorAll('#town .tabs2 button')) b.classList.toggle('on', b.dataset.t === townTab);
  $('t-name').textContent = t.name;
  $('t-sub').innerHTML = `${FACTIONS[t.fac].name} · 🪙 +${fmt(townIncome(t))}/day · ${t.builtToday ? '🔨 built today' : '🔨 you can build today'}`;
  let html = '';
  if (townTab === 'build') {
    html = BUILDINGS.map((b) => {
      const has = t.built.includes(b.id), reqOk = b.req.every((r) => t.built.includes(r)), can = !has && reqOk && !t.builtToday && canPay(t.p, b.cost);
      const name = b.tier ? `${b.up ? '⬆️ ' : ''}${UNITS[b.up ? UPGRADES[t.fac][b.tier - 1] : FACTIONS[t.fac].units[b.tier - 1]].name} dwelling` : b.name;
      return `<div class="row-b ${has ? 'has' : reqOk ? '' : 'lock'}"><i>${b.tier ? unitIcon(FACTIONS[t.fac].units[b.tier - 1]) : b.icon}</i><div><b>${name}</b><small>${has ? '✓ Built' : reqOk ? costText(b.cost) : `Needs ${b.req.map((r) => BUILDINGS.find((x) => x.id === r).name).join(', ')}`}</small><small class="d">${b.desc}</small></div>${has ? '' : `<button data-build="${b.id}" ${can ? '' : 'disabled'}>Build</button>`}</div>`;
    }).join('');
  } else if (townTab === 'recruit') {
    const tiers = BUILDINGS.filter((b) => b.tier && t.built.includes(b.id)).map((b) => b.tier);
    html = tiers.length ? tiers.map((tier) => {
      const id = tierUnit(t, tier), u = UNITS[id], n = t.avail[tier] || 0, max = Math.min(n, ...RES.filter((r) => u.cost[r]).map((r) => Math.floor(Pl.res[r] / u.cost[r])));
      return `<div class="row-b"><i>${unitIcon(id)}</i><div><b>${u.name} <em>×${n}</em></b><small>${costText(u.cost)} · ⚔️${u.att} 🛡️${u.def} ❤️${u.hp} 💥${u.dmg[0]}–${u.dmg[1]} 👟${u.spd}${u.ranged ? ' 🏹' : ''}${u.fly ? ' 🪽' : ''}</small></div><button data-rec="${tier}" data-n="${max}" ${max > 0 ? '' : 'disabled'}>Buy ${max}</button></div>`;
    }).join('') + '<p class="hint2">Recruits join the hero beside the town, or the garrison.</p>' : '<p class="hint2">Build a dwelling to recruit creatures.</p>';
  } else if (townTab === 'army') {
    const row = (title, army, who) => `<div class="armyrow"><b>${title}</b><div class="slots">${Array.from({ length: 7 }, (_, i) => army[i] && army[i][1] > 0 ? `<button data-move="${who}:${i}">${unitIcon(army[i][0])}<em>${army[i][1]}</em></button>` : '<button disabled></button>').join('')}</div></div>`;
    html = row('🏰 Garrison', t.garrison, 'g') + (vis ? row(`🐎 ${vis.name}`, vis.army, 'h') : '<p class="hint2">No hero beside the town.</p>') + '<p class="hint2">Tap a stack to move it across.</p>';
    // upgrades for troops whose upgraded dwelling stands here
    const ups = [];
    for (const [who, army] of [['g', t.garrison], ['h', vis?.army]]) if (army) army.forEach((st, i) => { if (!st || st[1] <= 0) return; const tier = UNITS[st[0]].tier, upId = UPGRADES[t.fac]?.[tier - 1]; if (UNITS[st[0]].fac === t.fac && !UNITS[st[0]].up && t.built.includes(`u${tier}`) && upId) { const cost = Object.fromEntries(RES.map((r) => [r, Math.max(0, (UNITS[upId].cost[r] || 0) - (UNITS[st[0]].cost[r] || 0))])); ups.push(`<div class="row-b"><i>${unitIcon(st[0])}</i><div><b>${st[1]} ${plural(st[0], st[1])} → ${UNITS[upId].name}</b><small>${costText(Object.fromEntries(RES.map((r) => [r, cost[r] * st[1]])))}</small></div><button data-up="${who}:${i}" ${canPay(t.p, cost, st[1]) ? '' : 'disabled'}>Upgrade</button></div>`); } });
    if (ups.length) html += ups.join('');
  } else if (townTab === 'more') {
    const tav = t.built.includes('tavern'), mk = t.built.includes('market');
    const heroes = G.heroes.filter((x) => x.alive && x.p === t.p).length;
    html = `<div class="row-b ${tav ? '' : 'lock'}"><i>🍺</i><div><b>Tavern</b><small>${tav ? 'Hire a new hero with a few troops (2500 gold).' : 'Build a Tavern first.'}</small></div><button data-hire="1" ${tav && heroes < 4 && canPay(t.p, { gold: 2500 }) && !heroAt(t.v) ? '' : 'disabled'}>Hire</button></div>`;
    html += `<div class="row-b ${mk ? '' : 'lock'}"><i>⚖️</i><div><b>Marketplace</b><small>${mk ? 'Buy and sell resources.' : 'Build a Marketplace first.'}</small></div></div>`;
    if (mk) for (const r of ['wood', 'ore', 'gems']) { const buy = r === 'gems' ? 500 : 250, sell = r === 'gems' ? 200 : 100; html += `<div class="row-b"><i>${RES_ICON[r]}</i><div><b>${r[0].toUpperCase() + r.slice(1)}</b><small>Buy 1 for ${buy} 🪙 · sell 1 for ${sell} 🪙</small></div><button data-buy="${r}" ${Pl.res.gold >= buy ? '' : 'disabled'}>Buy</button><button data-sell="${r}" ${Pl.res[r] > 0 ? '' : 'disabled'}>Sell</button></div>`; }
  }
  $('t-body').innerHTML = html;
  updateRes();
}
$('t-body').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const t = G.towns[townOpen], vis = visitorOf(t);
  if (b.dataset.build) { buildIn(t, b.dataset.build); sfx.build(); }
  else if (b.dataset.rec) {
    const tier = +b.dataset.rec, n = +b.dataset.n, id = tierUnit(t, tier);
    if (n <= 0) return;
    const army = vis ? vis.army : t.garrison;
    if (!addTroops(army, id, n) && !(vis && addTroops(t.garrison, id, n))) { toast('No free slot.'); sfx.deny(); return; }
    pay(t.p, UNITS[id].cost, n); t.avail[tier] -= n; sfx.coin();
    toast(`${unitIcon(id)} ${n} ${plural(id, n)} join ${vis ? vis.name : 'the garrison'}.`);
  } else if (b.dataset.up) {
    const [who, i] = b.dataset.up.split(':'), army = who === 'g' ? t.garrison : vis.army, st = army[i], upId = UPGRADES[t.fac][UNITS[st[0]].tier - 1];
    const cost = Object.fromEntries(RES.map((r) => [r, Math.max(0, (UNITS[upId].cost[r] || 0) - (UNITS[st[0]].cost[r] || 0))]));
    if (canPay(t.p, cost, st[1])) { pay(t.p, cost, st[1]); st[0] = upId; sfx.fanfare(); toast(`⬆️ ${st[1]} ${plural(upId, st[1])}!`); }
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
    layoutHeroes(true); toast(`🍺 ${hr.name} joins you.`); sfx.fanfare();
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
  const next = xpFor(hr.lvl + 1), prev = xpFor(hr.lvl);
  showMsg(`🐎 ${hr.name}`, `<p class="sub">Level ${hr.lvl} · ⭐ ${fmt(hr.xp)} / ${fmt(next)}</p><div class="xpbar"><i style="width:${((hr.xp - prev) / (next - prev)) * 100}%"></i></div>
    <div class="stats">${st('att', '🗡️', 'Attack')}${st('def', '🛡️', 'Defence')}${st('pow', '🔮', 'Power')}${st('know', '📘', 'Knowledge')}</div>
    <p class="sub">🔮 Mana ${hr.mana}/${maxMana(hr)} · 🐎 ${hr.mp}/${moveMax(hr)}</p>
    <div class="slots big">${Array.from({ length: 7 }, (_, i) => hr.army[i] && hr.army[i][1] > 0 ? `<span>${unitIcon(hr.army[i][0])}<em>${hr.army[i][1]}</em><small>${UNITS[hr.army[i][0]].name}</small></span>` : '<span class="e"></span>').join('')}</div>
    <p class="sub">${Object.keys(hr.skills).map((k) => `${SKILLS[k].icon} ${SKILLS[k].name} ${['', 'I', 'II', 'III'][hr.skills[k]]}`).join(' · ') || 'No skills yet'}</p>
    <p class="sub">${hr.spells.map((id) => `${SPELLS[id].icon} ${SPELLS[id].name}`).join(' · ') || 'No spells'}</p>
    <p class="sub">${hr.arts.map((id) => { const A = ARTIFACTS.find((x) => x.id === id); return `${A.icon} ${A.name}`; }).join(' · ') || 'No artifacts'}</p>`, true);
}

// ------------------------------------------------------------------ HUD, messages and dialogs
const UICON = { pikeman: '🔱', archer: '🏹', griffin: '🦅', swordsman: '⚔️', monk: '🧙', cavalier: '🏇', angel: '👼', skeleton: '💀', zombie: '🧟', wight: '👻', vampire: '🧛', lich: '☠️', blackknight: '♞', bonedragon: '🐉', goblin: '👺', wolf: '🐺', orc: '👹', ogre: '🦣', troll: '🧌', cyclops: '👁️', hydra: '🐍' };
const unitIcon = (id) => UICON[id] || UICON[UNITS[id]?.up] || '❔';
const plural = (id, n = 2) => (n === 1 ? UNITS[id].name : UNITS[id].name.replace(/man$/, 'men').replace(/f$/, 'ves').replace(/([^s])$/, '$1s'));
let toastT = 0;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }
function showMsg(title, html, wide = false) { ask(title, html, [['OK', null]], wide); }
const dialogs = [];
function ask(title, html, buttons, wide = false) {
  dialogs.push({ title, html, buttons, wide });
  if (dialogs.length === 1) renderDialog();
}
function renderDialog() {
  const d = dialogs[0];
  if (!d) { $('dialog').hidden = true; return; }
  $('dialog').hidden = false;
  $('dlg-card').classList.toggle('wide', !!d.wide);
  $('dlg-title').innerHTML = d.title;
  $('dlg-body').innerHTML = d.html;
  $('dlg-btns').innerHTML = d.buttons.map(([label, fn, sub], i) => `<button class="btn ${i === 0 && d.buttons.length > 1 ? 'gold' : i === 0 ? 'gold' : 'ghost'}" data-i="${i}" ${fn === undefined ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`).join('');
}
$('dlg-btns').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const d = dialogs.shift(); const fn = d.buttons[+b.dataset.i][1];
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
    f.el.style.opacity = String(Math.min(1, (1.6 - f.t) * 2));
    f.el.style.transform = `translate(${x}px, ${y - f.t * 40}px) translate(-50%, -50%) scale(${Math.min(1, 0.6 + f.t * 4)})`;
  }
}
function updateRes() {
  const r = G.players[0]?.res; if (!r) return;
  for (const k of RES) { const el = $(`r-${k}`); if (el) el.textContent = fmt(r[k]); }
  $('r-day').textContent = `Day ${((G.day - 1) % 7) + 1} · Week ${week()}`;
  $('r2-gold').textContent = RES.map((k) => `${RES_ICON[k]} ${fmt(r[k])}`).join('   ');
}
function updateHud() {
  if (!G.players.length) return;
  updateRes();
  const mine = G.heroes.filter((x) => x.alive && x.p === 0);
  $('heroes').innerHTML = mine.map((hr) => `<button class="hb ${hr.id === G.selHero ? 'on' : ''}" data-h="${hr.id}"><i>🐎</i><b>${hr.name.split(' ').pop()}</b><span class="mp"><i style="width:${(hr.mp / moveMax(hr)) * 100}%"></i></span></button>`).join('') +
    G.towns.filter((t) => t.p === 0).map((t) => `<button class="hb town" data-t="${t.id}"><i>🏰</i><b>${t.name}</b>${!t.builtToday ? '<em>🔨</em>' : ''}</button>`).join('');
  const hr = selHero();
  $('sel').innerHTML = hr ? `<b>${hr.name}</b> · Lv ${hr.lvl} · 🐎 ${fmt(hr.mp)} · 🔮 ${hr.mana} · ${heroArmy(hr).map(([id, n]) => `${unitIcon(id)}${n}`).join(' ')}` : '';
}
$('heroes').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || busy()) return;
  if (b.dataset.h) { const id = +b.dataset.h; if (G.selHero === id) openHero(); else selectHero(id); }
  if (b.dataset.t) openTown(+b.dataset.t);
});
$('b-hero').addEventListener('click', () => { if (!busy()) openHero(); });
$('b-end').addEventListener('click', () => {
  if (busy()) return;
  const left = G.heroes.filter((x) => x.alive && x.p === 0 && x.mp >= 100);
  if (left.length && !$('b-end').classList.contains('confirm')) { $('b-end').classList.add('confirm'); toast(`${left.length} hero${left.length > 1 ? 'es' : ''} can still move. Tap again to end the day.`); setTimeout(() => $('b-end').classList.remove('confirm'), 2500); return; }
  $('b-end').classList.remove('confirm');
  endTurn();
});
$('b-menu').addEventListener('click', () => { if (busy() && G.mode !== 'map') return; ask('☰ Menu', `Hex Realms ${APP_VERSION}`, [['Resume', null], ['💾 Save & quit', () => { save(); showMenu(); }], [`🎵 Music: ${store.get('realms.music', true) ? 'on' : 'off'}`, () => { store.set('realms.music', !store.get('realms.music', true)); if (store.get('realms.music', true)) score?.start(); else score?.stop(); }]]); });

// ------------------------------------------------------------------ days and weeks
function endTurn() {
  if (G.mode !== 'map' || aiRunning || walking) return;
  showPath(selHero(), null);
  aiRunning = true; aiGen = runAI(); $('b-end').disabled = true;
  toast('⏳ The enemy is moving…');
}
let aiRunning = false, aiGen = null, aiDelay = 0;
function tickAI(dt) {
  if (!aiRunning || G.mode !== 'map' || dialogOpen() || walking) return;
  if ((aiDelay -= dt) > 0) return;
  const r = aiGen.next();
  aiDelay = r.value || 0.05;
  if (r.done) { aiRunning = false; $('b-end').disabled = false; newDay(); }
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
    const all = [...FACTIONS.haven.units, ...FACTIONS.necro.units], star = all[(rnd() * all.length) | 0];
    G.weekOf = star;
    for (const t of G.towns) for (const b of BUILDINGS) if (b.tier && !b.up && t.built.includes(b.id)) { const base = FACTIONS[t.fac].units[b.tier - 1]; t.avail[b.tier] = (t.avail[b.tier] || 0) + Math.ceil(UNITS[base].grow * (t.built.includes('fort') ? 1.5 : 1)) + (base === star ? 5 : 0); }
    for (const o of G.objects) if (o.alive && o.type === 'monster') o.n = Math.ceil(o.n * 1.08);
    for (const o of G.objects) if (o.alive && o.type === 'dwelling') o.stock = Math.max(o.stock, 4 + ((rnd() * 4) | 0));
    showMsg(`📅 Week ${week()}: Week of the ${UNITS[G.weekOf].name}`, `${unitIcon(G.weekOf)} ${plural(G.weekOf)} grow by +5 this week. Creatures in your dwellings have multiplied: visit your town to recruit them.`);
  }
  revealAll(); updateHud(); save();
  const hr = selHero() || G.heroes.find((x) => x.alive && x.p === 0);
  if (hr) selectHero(hr.id);
  sfx.day();
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
  ask(won ? '👑 Victory!' : '💀 Defeat', won ? `You rule the whole world after ${G.day} days. All rival lords are defeated.` : 'Your last town and hero are lost.', [['New game', () => showMenu()]]);
  won ? sfx.fanfare() : sfx.deny();
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
function dijkstra(hr, maxCost) {
  const dist = new Map([[hr.v, 0]]), prev = new Map(), heap = [[0, hr.v]];
  while (heap.length) {
    let bi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
    const [d, v] = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
    if (d > (dist.get(v) ?? Infinity) || d > maxCost) continue;
    if (v !== hr.v && (objAt[v] >= 0 && G.objects[objAt[v]].alive || (heroAt(v) && heroAt(v) !== hr))) continue;
    for (const n of NBR[v]) {
      if (!passable(n)) continue;
      const blockedTarget = (objAt[n] >= 0 && G.objects[objAt[n]].alive) || (heroAt(n) && heroAt(n) !== hr);
      const nd = d + stepCost(v, n) + (!blockedTarget && zoc(n) ? 3000 : 0);
      if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, v); heap.push([nd, n]); }
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
    let moved = false;
    for (let i = 1; i < path.length; i++) {
      const last = i === path.length - 1;
      if (last) { interact(hr, path[i]); hr.mp = Math.max(0, hr.mp - 50); moved = true; break; }
      const c = stepCost(path[i - 1], path[i]);
      if (hr.mp < c) { hr.mp = 0; break; }
      hr.mp -= c; hr.v = path[i]; moved = true;
      if (seen[hr.v]) { layoutHeroes(true); }
    }
    layoutHeroes(true);
    if (!moved) return;
    yield seen[hr.v] ? 0.3 : 0.02;
    if (G.mode === 'battle') yield 0.1;
  }
}
function* runAI() {
  for (const Pl of G.players) {
    if (!Pl.ai || !Pl.alive) continue;
    for (const t of G.towns) if (t.p === Pl.i) aiTown(t);
    for (const hr of G.heroes.filter((x) => x.alive && x.p === Pl.i)) {
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
function load() {
  const s = store.get('realms.save', null);
  if (!s || s.v !== 1) return false;
  Object.assign(G, { seed: s.seed, day: s.day, diff: s.diff, selHero: s.selHero, players: s.players, heroes: s.heroes, towns: s.towns, objects: s.objects, over: false, mode: 'map' });
  unpack(s.ter, ter); unpack(s.h, h); unpack(s.road, road); unpack(s.seen, seen);
  objAt.fill(-1); for (const o of G.objects) if (o.alive) objAt[o.v] = o.id;
  rnd = mulberry32(s.seed + s.day * 977);
  return true;
}

// ------------------------------------------------------------------ sound
let actx = null, master = null, score = null;
const sfx = new Proxy({}, { get: (_, name) => () => playSfx(name) });
function audio() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
    const mus = actx.createGain(); mus.gain.value = 0.55; mus.connect(actx.destination);
    score = createScore(actx, mus); score.setEra(2);
    if (store.get('realms.music', true)) score.start();
  } catch { actx = null; }
}
function tone(f, t, dur, type = 'sine', vol = 0.2, slide = 0) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noiseBurst(t, dur, f, vol = 0.2, type = 'bandpass') {
  const b = actx.createBuffer(1, Math.floor(actx.sampleRate * dur), actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = actx.createBufferSource(), fl = actx.createBiquadFilter(), g = actx.createGain();
  s.buffer = b; fl.type = type; fl.frequency.value = f; g.gain.value = vol;
  s.connect(fl).connect(g).connect(master); s.start(t);
}
function playSfx(name) {
  if (!actx || !store.get('realms.sfx', true)) return;
  const t = actx.currentTime;
  switch (name) {
    case 'click': tone(880, t, 0.05, 'triangle', 0.08); break;
    case 'deny': tone(220, t, 0.15, 'square', 0.06, 0.7); break;
    case 'coin': tone(1320, t, 0.08, 'triangle', 0.12); tone(1760, t + 0.07, 0.12, 'triangle', 0.1); break;
    case 'step': noiseBurst(t, 0.06, 600, 0.05, 'lowpass'); break;
    case 'flag': tone(523, t, 0.12, 'triangle', 0.12); tone(784, t + 0.1, 0.2, 'triangle', 0.12); break;
    case 'build': noiseBurst(t, 0.1, 400, 0.15); noiseBurst(t + 0.15, 0.1, 400, 0.15); tone(330, t + 0.3, 0.3, 'triangle', 0.1); break;
    case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, 0.35, 'triangle', 0.12)); break;
    case 'magic': for (let i = 0; i < 6; i++) tone(900 + i * 220, t + i * 0.04, 0.3, 'sine', 0.06); break;
    case 'hit': noiseBurst(t, 0.12, 1200, 0.25); tone(140, t, 0.12, 'square', 0.08, 0.5); break;
    case 'shoot': noiseBurst(t, 0.15, 3000, 0.12, 'highpass'); break;
    case 'die': tone(300, t, 0.4, 'sawtooth', 0.06, 0.3); break;
    case 'alarm': tone(392, t, 0.2, 'sawtooth', 0.07); tone(523, t + 0.18, 0.3, 'sawtooth', 0.07); break;
    case 'day': tone(392, t, 0.4, 'sine', 0.1); tone(587, t + 0.2, 0.5, 'sine', 0.1); break;
  }
}
window.addEventListener('pointerdown', () => { audio(); if (actx?.state === 'suspended') actx.resume(); }, { capture: true });

// ------------------------------------------------------------------ menu
function showMenu() {
  G.mode = 'menu'; dialogs.length = 0; renderDialog();
  $('menu').hidden = false; $('hud').hidden = true; $('town').hidden = true; $('battle').hidden = true;
  const s = store.get('realms.save', null);
  $('m-continue').hidden = !s;
  if (s) $('m-continue').innerHTML = `Continue<small>Day ${s.day}</small>`;
  for (const m of heroMeshes.values()) scene.remove(m); heroMeshes.clear();
}
for (const b of document.querySelectorAll('#menu .diffs button')) b.addEventListener('click', () => { store.set('realms.diff', +b.dataset.d); for (const x of document.querySelectorAll('#menu .diffs button')) x.classList.toggle('on', x === b); sfx.click(); });
for (const x of document.querySelectorAll('#menu .diffs button')) x.classList.toggle('on', +x.dataset.d === store.get('realms.diff', 1));
function play() {
  $('menu').hidden = true; $('hud').hidden = false; G.mode = 'map';
  worldDirty = true; layoutWorld();
  const hr = selHero() || G.heroes.find((x) => x.alive && x.p === 0);
  if (hr) { G.selHero = hr.id; const sp = new THREE.Spherical().setFromVector3(DIRS[hr.v]); cam.theta = sp.theta; cam.phi = sp.phi; cam.dist = 20; cam.tDist = 10; flyTo(hr.v, 10); }
  updateHud();
}
$('m-new').addEventListener('click', () => {
  if (store.get('realms.save', null) && !confirm('Start a new game? Your saved game will be lost.')) return;
  newWorld((Date.now() % 100000) + 1, store.get('realms.diff', 1));
  play(); save();
  setTimeout(() => showMsg('🏰 Your realm', 'Tap a hex to plan a route, tap it again to march. Flag mines, gather treasure, build your town every day and recruit its creatures. Defeat the Necropolis lord to win.<br><br>🐎 Tap your hero to see his sheet · 🏰 tap your town to build and recruit · ⏭ end the day when you are done.', true), 600);
});
$('m-continue').addEventListener('click', () => { if (load()) play(); });

// ------------------------------------------------------------------ the loop
const clock = new THREE.Clock();
let tt = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  tt += dt;
  tickMaterials(tt);
  if (G.mode === 'battle') {
    animateBattle(dt);
    const s = Math.sin(bview.yaw), c = Math.cos(bview.yaw);
    bcam.position.set(s * bview.dist * 0.55, bview.dist, c * bview.dist * 0.55 + 0.4);
    bcam.lookAt(0, 0, 0.2);
    for (const m of bmesh.values()) if (m.userData.flash > 0) { m.userData.flash -= dt; m.children[0].material = m.userData.flash > 0 ? hitMat : bodyMat; }
    post.render(bscene, bcam);
  } else {
    updateCamera(dt);
    atmos.update(dt, camera);
    if (G.mode === 'menu') { cam.vTheta = 0.0015; cam.tDist = 16; }
    else {
      updateWalk(dt); tickAI(dt);
      if (worldDirty) { revealAll(); layoutWorld(); }
      const hr = selHero();
      const m = hr && heroMeshes.get(hr.id);
      selRing.visible = !!m;
      if (m) { selRing.position.copy(m.position).addScaledVector(m.position.clone().normalize(), 0.01); selRing.quaternion.setFromUnitVectors(UP, m.position.clone().normalize()); }
      for (const g of world.children) if (g.userData.bob !== undefined) g.children[0].position.y = Math.abs(Math.sin(tt * 2 + g.userData.bob)) * 0.15;
    }
    post.render(scene, camera);
  }
  updateFloaters(dt);
  requestAnimationFrame(frame);
}
const hitMat = makeHitMaterial(THREE);

// first boot: a world spinning behind the title
newWorld(12345, 1);
for (let v = 0; v < NV; v++) seen[v] = 1;
layoutWorld();
resize();
showMenu();
frame();
window.__realms = { G, BT, newWorld, findPath, startWalk, interact, startBattle, endTurn, openTown, closeTown, buildIn, save, load, play, selectHero, heroArmy, objAt, ter, seen, NBR, passable, get BB() { return BB; }, autoBattle: () => { bauto = true; }, hexScreen: (c, r) => { const v = hexPos(c, r).project(bcam); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; }, aiRunning: () => aiRunning, layoutWorld };
