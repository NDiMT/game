import * as THREE from 'three';
import { mulberry32, settlementModel, wonderModel, starshipModel, WONDERS, personGeo, planeGeo, satelliteGeo, treeGeos, cloudGeo } from './models.js?v=1.0';
import { createScore } from './music.js?v=1.0';

// =====================================================================
// AEONS: shape a small planet and guide its people from the first fire
// to the stars. Raise and lower the land so settlements can grow, gather
// knowledge, build a wonder in each age, survive fires, plagues, storms,
// rising seas and meteors, and finally launch the Starship.
// =====================================================================

const APP_VERSION = '1.0';
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = Math.random;
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ------------------------------------------------------------------ the ages
const ERAS = [
  { name: 'Stone Age', icon: '🔥', years: [-10000, -3000], need: 220, cost: 80, lvl: 2, desc: 'Your tribe gathers around the fire. Level the land so they can settle and grow.', color: '#d08a4a' },
  { name: 'Bronze Age', icon: '🏺', years: [-3000, -800], need: 900, cost: 150, lvl: 3, desc: 'Farms and metal tools. You can now plant forests and inspire your people.', color: '#d8a85a' },
  { name: 'Classical Age', icon: '🏛️', years: [-800, 500], need: 1300, cost: 220, lvl: 3, desc: 'Temples and philosophers, but also plague. Bless your people to heal them.', color: '#e9e2d2' },
  { name: 'Medieval Age', icon: '🏰', years: [500, 1750], need: 1600, cost: 300, lvl: 3, desc: 'Castles and cathedrals rise. Fires and plagues still roam the land.', color: '#a88ad8' },
  { name: 'Industrial Age', icon: '🏭', years: [1750, 1950], need: 1800, cost: 380, lvl: 4, desc: 'Factories boom. Pollution warms the planet: if its health falls, the seas will rise. Cleanse the skies, plant forests, raise the coasts.', color: '#c8704a' },
  { name: 'Modern Age', icon: '🏙️', years: [1950, 2060], need: 2100, cost: 480, lvl: 4, desc: 'Cities of glass and planes in the sky. Storms and meteors grow dangerous: you can now terraform and deflect.', color: '#5fa8ff' },
  { name: 'Space Age', icon: '🚀', years: [2060, 2200], need: 2400, cost: 650, lvl: 4, desc: 'The final age. Build the Starship and take your people to the stars.', color: '#5ff0ff' },
];
const WONDER_DESC = ['A ring of standing stones to read the sky.', 'A tomb for a god-king, built to last forever.', 'A temple of marble and reason.', 'Spires that reach for heaven.', 'An iron tower: the triumph of engineering.', 'A needle in the clouds, heart of a global network.', 'The ark that will carry your people to the stars.'];
const POWERS = [
  { id: 'raise', name: 'Raise', cost: 1, era: 0, r: 0, hint: 'Tap to raise the land. Hold to keep going. Settlements grow on flat ground.' },
  { id: 'lower', name: 'Lower', cost: 1, era: 0, r: 0, hint: 'Tap to lower the land. Below sea level it floods.' },
  { id: 'rain', name: 'Rain', cost: 30, era: 0, r: 3, hint: 'Rain makes the land fertile for a while and puts out fires.' },
  { id: 'forest', name: 'Forest', cost: 40, era: 1, r: 2, hint: 'Plant a forest: food, clean air and a healthier planet.' },
  { id: 'inspire', name: 'Inspire', cost: 90, era: 1, r: 5, hint: 'A spark of genius: settlements here make triple knowledge for a while.' },
  { id: 'bless', name: 'Bless', cost: 120, era: 2, r: 5, hint: 'Heals plague, calms storms, puts out fires and cheers people up.' },
  { id: 'cleanse', name: 'Cleanse', cost: 180, era: 4, r: 0, hint: 'Scrub the skies: the planet heals. Tap anywhere.' },
  { id: 'terraform', name: 'Terraform', cost: 150, era: 5, r: 2, hint: 'Flatten a whole area to the height of the spot you tap.' },
  { id: 'deflect', name: 'Deflect', cost: 300, era: 5, r: 0, hint: 'Shoot down an incoming meteor. Tap anywhere.' },
];
const PW = Object.fromEntries(POWERS.map((p) => [p.id, p]));
const CAPS = [0, 8, 22, 50, 100];
const PEOPLE_COL = [0x9a6a3a, 0xc8a060, 0xf2ede2, 0x6a4a8a, 0x3a3a4a, 0x3b82f6, 0xe6eef6];
const POLLUTE = [0, 0, 0, 0, 0.016, 0.011, 0.005];

// ------------------------------------------------------------------ the planet: an icosphere of columns
const R = 5, STEP = 0.07, SEA0 = 3, MAXH = 11;
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
const NV = DIRS.length, NF = FACES.length;
const NBR = (() => {
  const s = Array.from({ length: NV }, () => new Set());
  for (const [a, b, c] of FACES) { s[a].add(b).add(c); s[b].add(a).add(c); s[c].add(a).add(b); }
  return s.map((x) => [...x]);
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

// ------------------------------------------------------------------ world state
const h = new Int8Array(NV), tree = new Uint8Array(NV), rain = new Float32Array(NV), burn = new Float32Array(NV), crowd = new Uint8Array(NV);
const G = {
  seed: 1, era: 0, know: 0, mana: 60, health: 100, sea: SEA0, seaVis: SEA0, elapsed: 0, mode: 'menu', started: false,
  settlements: [], walkers: [], wonders: [], stats: { founded: 0, lost: 0, disasters: 0, peak: 0 },
};
let terrainDirty = true, setDirty = true;
const isLand = (v) => h[v] > G.sea;
const radiusOf = (v) => R + h[v] * STEP;
const posOf = (v, extra = 0) => DIRS[v].clone().multiplyScalar(radiusOf(v) + extra);
function sameNeighbours(v) { let n = 0; for (const x of NBR[v]) if (h[x] === h[v]) n++; return n; }
function flatScore(v, self) {
  let n = 0;
  for (const [x] of bfs(v, 2)) if (isLand(x) && h[x] === h[v] && (x === v || !G.settlements.some((s) => s !== self && s.v === x))) n++;
  return n;
}
function levelFor(s) {
  const ring1 = NBR[s.v].filter((x) => h[x] === h[s.v]).length, total = flatScore(s.v, s), all = bfs(s.v, 2).length;
  if (total >= all) return 4;
  if (ring1 === NBR[s.v].length && total >= all - 5) return 3;
  if (ring1 >= NBR[s.v].length - 1) return 2;
  return 1;
}
const canSettle = (v) => isLand(v) && !crowd[v] && burn[v] <= 0 && sameNeighbours(v) >= 4 && Math.abs(DIRS[v].y) < 0.93;
function rebuildCrowd() {
  crowd.fill(0);
  for (const s of [...G.settlements, ...G.wonders]) for (const [x] of bfs(s.v, 2)) crowd[x] = 1;
}
function raiseV(v) {
  if (h[v] >= MAXH) return false;
  h[v]++;
  const q = [v];
  while (q.length) {
    const x = q.pop();
    for (const n of NBR[x]) if (h[n] < h[x] - 1) { h[n] = h[x] - 1; q.push(n); }
  }
  terrainDirty = true;
  return true;
}
function lowerV(v) {
  if (h[v] <= 0) return false;
  h[v]--;
  const q = [v];
  while (q.length) {
    const x = q.pop();
    for (const n of NBR[x]) if (h[n] > h[x] + 1) { h[n] = h[x] + 1; q.push(n); }
  }
  terrainDirty = true;
  return true;
}
function setHeight(v, target) { while (h[v] < target && raiseV(v)); while (h[v] > target && lowerV(v)); }

function generate(seed) {
  const r = mulberry32(seed * 7919 + 11);
  const waves = [];
  for (let k = 0; k < 12; k++) {
    const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    waves.push({ d, f: k < 4 ? 1.2 + r() * 1.6 : 3 + r() * 5, ph: r() * 6.28, a: k < 4 ? 1 : 0.35 });
  }
  const val = DIRS.map((p) => waves.reduce((s, w) => s + w.a * Math.sin(p.dot(w.d) * w.f + w.ph), 0));
  const sorted = [...val].sort((a, b) => a - b), thr = sorted[Math.floor(sorted.length * 0.56)];
  const spread = sorted[sorted.length - 1] - thr;
  for (let v = 0; v < NV; v++) h[v] = clamp(Math.round(SEA0 + 0.5 + ((val[v] - thr) / spread) * 7), 0, 9);
  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    for (let v = 0; v < NV; v++) for (const n of NBR[v]) if (h[n] > h[v] + 1) { h[n] = h[v] + 1; changed = true; }
    if (!changed) break;
  }
  tree.fill(0); rain.fill(0); burn.fill(0);
  for (let v = 0; v < NV; v++) if (h[v] > SEA0 + 1 && h[v] < SEA0 + 5 && Math.abs(DIRS[v].y) < 0.8 && r() < 0.16) for (const [x] of bfs(v, 1)) if (h[x] > SEA0 && r() < 0.7) tree[x] = 1;
  // the cradle: a level clearing on a big landmass, away from the poles
  let best = 0, bestScore = -1;
  for (let v = 0; v < NV; v += 3) {
    if (!(h[v] > SEA0) || Math.abs(DIRS[v].y) > 0.6) continue;
    const land = bfs(v, 4).filter(([x]) => h[x] > SEA0).length;
    if (land > bestScore) { bestScore = land; best = v; }
  }
  for (const [x] of bfs(best, 2)) { setHeight(x, SEA0 + 2); tree[x] = 0; }
  return best;
}

// ------------------------------------------------------------------ renderer, camera, lights
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x05070f, 1);
$('app').prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
const sunDir = new THREE.Vector3(1, 0.3, 0.6).normalize();
const sunU = { value: sunDir }, timeU = { value: 0 };
const sun = new THREE.DirectionalLight(0xfff2dc, 2.6);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0x8aa8ff, 0x1a1a2a, 0.5);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0x3a4a7a, 0.45));
const cam = { theta: 0, phi: 1.2, dist: 23, tTheta: 0, tPhi: 1.2, tDist: 23, vTheta: 0, vPhi: 0, shake: 0, fly: false };
const lookAtP = new THREE.Vector3();
function updateCamera(dt) {
  if (cam.fly) {
    let d = cam.tTheta - cam.theta;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    cam.theta += d * Math.min(1, dt * 3);
    cam.phi += (cam.tPhi - cam.phi) * Math.min(1, dt * 3);
    if (Math.abs(d) < 0.002 && Math.abs(cam.tPhi - cam.phi) < 0.002) cam.fly = false;
  } else {
    cam.theta += cam.vTheta; cam.phi += cam.vPhi;
    cam.vTheta *= 0.9; cam.vPhi *= 0.9;
  }
  cam.phi = clamp(cam.phi, 0.25, Math.PI - 0.25);
  cam.dist += (cam.tDist - cam.dist) * Math.min(1, dt * 6);
  const s = cam.shake ? (rnd() - 0.5) * cam.shake * 0.15 : 0;
  // zoomed in, the camera tilts towards the horizon and looks at the ground instead of the core
  const f = clamp((21 - cam.dist) / 12, 0, 1);
  camera.position.setFromSphericalCoords(cam.dist, Math.min(Math.PI - 0.05, cam.phi + f * 0.42), cam.theta);
  camera.position.x += s; camera.position.y += s;
  lookAtP.setFromSphericalCoords(R * f * 0.95, cam.phi, cam.theta);
  camera.lookAt(lookAtP);
}
function flyTo(v, dist) {
  const sp = new THREE.Spherical().setFromVector3(DIRS[v]);
  cam.tTheta = sp.theta; cam.tPhi = sp.phi; cam.fly = true; cam.vTheta = cam.vPhi = 0;
  if (dist) cam.tDist = dist;
}
function resize() {
  const w = window.innerWidth, hh = window.innerHeight;
  renderer.setSize(w, hh);
  camera.aspect = w / hh;
  camera.fov = w < hh ? 46 : 36;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// stars
{
  const n = 1600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), r = mulberry32(3);
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(150 + r() * 50);
    pos.set([d.x, d.y, d.z], i * 3);
    const c = new THREE.Color().setHSL(0.55 + r() * 0.2, 0.4, 0.6 + r() * 0.4);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true })));
}

// ------------------------------------------------------------------ planet mesh, water, atmosphere
const planetGeo = new THREE.BufferGeometry();
planetGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 9), 3));
planetGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NF * 9), 3));
const planet = new THREE.Mesh(planetGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 }));
scene.add(planet);
const C = (x) => new THREE.Color(x);
const PAL = { deep: C(0x2a3a5a), bed: C(0xb8a070), sand: C(0xe9d6a0), grass: C(0x7cc04a), lush: C(0x5aaa3a), dry: C(0xc8b462), hill: C(0x5f9a3a), rock: C(0x8f8a82), snow: C(0xf4f8fb), ice: C(0xe2eef6), burnt: C(0x3a2e28), brown: C(0x9a8a5a) };
const tc = new THREE.Color();
function faceColor(f) {
  const [a, b, c] = FACES[f];
  const ha = h[a], hb = h[b], hc = h[c], mn = Math.min(ha, hb, hc), mx = Math.max(ha, hb, hc), avg = (ha + hb + hc) / 3;
  const lat = Math.abs(DIRS[a].y + DIRS[b].y + DIRS[c].y) / 3;
  if (burn[a] > 0 || burn[b] > 0 || burn[c] > 0) return tc.copy(PAL.burnt);
  if (mx <= G.sea) return tc.copy(PAL.bed).lerp(PAL.deep, clamp((G.sea - avg) / 4, 0, 1));
  if (lat > 0.88) return tc.copy(PAL.ice);
  if (mn <= G.sea) return tc.copy(PAL.sand);
  const up = avg - G.sea;
  if (up >= 6) return tc.copy(PAL.snow);
  if (up >= 4.5) return tc.copy(PAL.rock).lerp(PAL.snow, lat > 0.6 ? 0.6 : 0);
  let col;
  if (up >= 3) col = tc.copy(PAL.hill).lerp(PAL.rock, (up - 3) / 2);
  else col = tc.copy(lat < 0.25 && mx === mn ? PAL.dry : PAL.grass).lerp(PAL.lush, clamp((rain[a] + rain[b] + rain[c]) / 60, 0, 1));
  if (mn !== mx) col.multiplyScalar(0.92);
  if (G.health < 90) col.lerp(PAL.brown, (1 - G.health / 100) * 0.55);
  if (lat > 0.72) col.lerp(PAL.snow, (lat - 0.72) * 2.5);
  return col;
}
function rebuildPlanet() {
  const p = planetGeo.attributes.position.array, col = planetGeo.attributes.color.array;
  for (let f = 0; f < NF; f++) {
    const c = faceColor(f);
    FACES[f].forEach((v, i) => {
      const r = radiusOf(v), d = DIRS[v], o = f * 9 + i * 3;
      p[o] = d.x * r; p[o + 1] = d.y * r; p[o + 2] = d.z * r;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
    });
  }
  planetGeo.attributes.position.needsUpdate = planetGeo.attributes.color.needsUpdate = true;
  planetGeo.computeVertexNormals();
  planetGeo.computeBoundingSphere();
  updateWaterDepth();
  layoutTrees();
  setDirty = true;
}
// water: a sphere with depth-tinted colour, shoreline foam and sun glints
const waterGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(NV * 3), idx = [];
  DIRS.forEach((d, i) => pos.set([d.x, d.y, d.z], i * 3));
  for (const f of FACES) idx.push(...f);
  waterGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  waterGeo.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(NV), 1));
  waterGeo.setIndex(idx);
}
const waterMat = new THREE.ShaderMaterial({
  transparent: true,
  uniforms: { uSun: sunU, uTime: timeU, uCam: { value: camera.position }, uShallow: { value: C(0x4fd0e0) }, uDeep: { value: C(0x154f9a) }, uR: { value: R } },
  vertexShader: `attribute float aDepth; uniform float uR; varying float vDepth; varying vec3 vN; varying vec3 vW;
    void main() { vDepth = aDepth; vN = normalize(position); vec4 w = modelMatrix * vec4(position * uR, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 uSun; uniform vec3 uCam; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uTime;
    varying float vDepth; varying vec3 vN; varying vec3 vW;
    void main() {
      float d = clamp(vDepth, 0.0, 1.0);
      vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d));
      float foam = smoothstep(0.1, 0.0, vDepth) + smoothstep(0.82, 1.0, sin(uTime * 1.5 - vDepth * 30.0) * 0.5 + 0.5) * smoothstep(0.4, 0.08, vDepth) * 0.7;
      col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.8);
      float lambert = max(dot(vN, uSun), 0.0);
      vec3 V = normalize(uCam - vW), H = normalize(V + uSun);
      float spec = pow(max(dot(vN, H), 0.0), 80.0) * step(0.0, dot(vN, uSun));
      float fres = pow(1.0 - max(dot(V, vN), 0.0), 3.0);
      col = col * (0.12 + 0.95 * lambert) + spec * 0.8 + fres * vec3(0.25, 0.45, 0.7) * (0.2 + lambert);
      gl_FragColor = vec4(col, mix(0.78, 0.94, d));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.renderOrder = 1;
scene.add(water);
function updateWaterDepth() {
  const a = waterGeo.attributes.aDepth.array;
  for (let v = 0; v < NV; v++) a[v] = (G.seaVis + 0.5 - h[v]) * 0.33;
  waterGeo.attributes.aDepth.needsUpdate = true;
}
const atmoColor = new THREE.Color(0x5fa8ff);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 48, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  uniforms: { uSun: sunU, uColor: { value: atmoColor } },
  vertexShader: `varying vec3 vN; varying vec3 vW; void main() { vN = normalize(normalMatrix * normal); vW = normalize((modelMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uSun; uniform vec3 uColor; varying vec3 vN; varying vec3 vW;
    void main() { float i = pow(clamp(0.78 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0); float lit = 0.2 + 0.8 * clamp(dot(vW, uSun) + 0.35, 0.0, 1.0);
      gl_FragColor = vec4(uColor * i * lit * 1.8, 1.0); }`,
}));
scene.add(atmo);

// ------------------------------------------------------------------ materials and instanced things
const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
// fires, windows and neon: muted by day, glowing on the night side
const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, side: THREE.DoubleSide });
glowMat.onBeforeCompile = (s) => {
  s.uniforms.uSun = sunU;
  s.vertexShader = 'varying vec3 vWorldP;\n' + s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
    #ifdef USE_INSTANCING
      vWorldP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    #else
      vWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #endif`);
  s.fragmentShader = 'uniform vec3 uSun; varying vec3 vWorldP;\n' + s.fragmentShader
    .replace('#include <color_fragment>', '#include <color_fragment>\n  float night = smoothstep(0.15, -0.2, dot(normalize(vWorldP), uSun));\n  vec3 glowCol = diffuseColor.rgb;\n  diffuseColor.rgb = mix(glowCol * 0.55, glowCol * 0.15, night);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += glowCol * (0.2 + night * 1.8);');
};
glowMat.customProgramCacheKey = () => 'glow';
function inst(geo, mat, max) { const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; scene.add(m); return m; }
const dummy = new THREE.Object3D();
const UP = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion(), qy = new THREE.Quaternion();
function placeOn(m, n, v, extra = 0, yaw = 0, scale = 1, dir = null) {
  const d = dir || DIRS[v];
  qa.setFromUnitVectors(UP, d);
  qy.setFromAxisAngle(UP, yaw);
  dummy.quaternion.copy(qa).multiply(qy);
  dummy.position.copy(d).multiplyScalar((dir ? 0 : radiusOf(v)) + extra);
  if (dir) dummy.position.copy(dir).multiplyScalar(extra);
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  m.setMatrixAt(n, dummy.matrix);
}
const treeMeshes = treeGeos().map((g) => inst(g, bodyMat, NV));
function layoutTrees() {
  const n = [0, 0];
  for (let v = 0; v < NV; v++) {
    if (!tree[v] || !isLand(v)) continue;
    const k = v % 2, m = treeMeshes[k];
    placeOn(m, n[k]++, v, -0.01, v * 1.7, 0.85 + (v % 5) * 0.08);
    if (k === 0 && v % 3 === 0) placeOn(m, n[k]++, v, -0.01, v, 0.7, null);
  }
  treeMeshes[0].count = n[0]; treeMeshes[1].count = n[1];
  for (const m of treeMeshes) m.instanceMatrix.needsUpdate = true;
}
const templates = {};
for (let e = 0; e < 7; e++) for (let l = 1; l <= 4; l++) {
  const t = settlementModel(e, l);
  templates[`${e}-${l}`] = { body: inst(t.body, bodyMat, 90), glow: t.glow ? inst(t.glow, glowMat, 90) : null, smoke: t.smoke };
}
const people = inst(personGeo(), bodyMat, 240);
people.setColorAt(0, new THREE.Color());
const planes = inst(planeGeo(), bodyMat, 40);
const sats = inst(satelliteGeo(), bodyMat, 16);
const guides = inst(new THREE.OctahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: 0xffa62b }), 600);
const cloudMesh = inst(cloudGeo(), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8090a8, flatShading: true, transparent: true, opacity: 0.82, roughness: 1 }), 24);
const clouds = Array.from({ length: 22 }, (_, i) => ({ dir: new THREE.Vector3(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.8, rnd() * 2 - 1).normalize(), yaw: rnd() * 6, s: 0.7 + rnd() * 0.8, i }));
const cursor = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false }));
cursor.visible = false; cursor.renderOrder = 5;
scene.add(cursor);
let cursorT = 0;
const wonderGroup = new THREE.Group();
scene.add(wonderGroup);

// ------------------------------------------------------------------ particles (radial gravity)
const PMAX = 1200;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.07, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
points.frustumCulled = false;
scene.add(points);
const parts = [];
const tmpV = new THREE.Vector3();
function emit(p, color, n = 8, out = 0.6, spread = 0.3, life = 1, g = 0.8) {
  const c = new THREE.Color(color), nrm = p.clone().normalize();
  for (let k = 0; k < n; k++) {
    if (parts.length >= PMAX) parts.shift();
    const v = nrm.clone().multiplyScalar(out * (0.5 + rnd())).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(spread));
    parts.push({ p: p.clone(), v, c, life: life * (0.6 + rnd() * 0.6), max: life, g });
  }
}
function updateParticles(dt) {
  for (let k = parts.length - 1; k >= 0; k--) {
    const q = parts[k];
    q.life -= dt;
    if (q.life <= 0) { parts.splice(k, 1); continue; }
    tmpV.copy(q.p).normalize().multiplyScalar(-q.g * dt);
    q.v.add(tmpV);
    q.p.addScaledVector(q.v, dt);
  }
  for (let k = 0; k < PMAX; k++) {
    const q = parts[k];
    if (q) { pPos[k * 3] = q.p.x; pPos[k * 3 + 1] = q.p.y; pPos[k * 3 + 2] = q.p.z; const f = Math.min(1, (q.life / q.max) * 1.6); pCol[k * 3] = q.c.r * f; pCol[k * 3 + 1] = q.c.g * f; pCol[k * 3 + 2] = q.c.b * f; }
    else { pPos[k * 3] = pPos[k * 3 + 1] = pPos[k * 3 + 2] = 0; pCol[k * 3] = pCol[k * 3 + 1] = pCol[k * 3 + 2] = 0; }
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true;
}

// ------------------------------------------------------------------ settlements and people
const capOf = (s) => CAPS[s.level] * (1 + G.era * 0.45);
function fertility(v) {
  let f = 0.6;
  if (NBR[v].some((x) => !isLand(x))) f += 0.3;
  if (rain[v] > 0) f += 0.4;
  if (bfs(v, 2).some(([x]) => tree[x])) f += 0.2;
  f -= Math.abs(DIRS[v].y) * 0.4;
  return Math.max(0.2, f) * (0.6 + G.health / 250);
}
function found(v, pop) {
  const s = { v, pop, level: 1, grow: 0, sick: 0, inspire: 0, cool: 6, fert: fertility(v) };
  for (const [x] of bfs(v, 1)) tree[x] = 0;
  G.settlements.push(s);
  s.level = levelFor(s);
  rebuildCrowd();
  G.stats.founded++;
  setDirty = true; terrainDirty = true;
  return s;
}
function removeSettlement(s, why) {
  G.settlements.splice(G.settlements.indexOf(s), 1);
  G.stats.lost++;
  rebuildCrowd();
  setDirty = true;
  emit(posOf(s.v, 0.05), 0xb8a888, 20, 0.5, 0.4, 1);
  if (why) toast(why);
}
function spawnWalker(v, pop) {
  G.walkers.push({ v, pop, path: [], t: 0, from: v, to: v, think: 0, tries: 0, age: 0 });
}
function findSpot(v) {
  let best = null, bestScore = -1e9;
  for (const [x, d] of bfs(v, 11, isLand)) {
    if (d < 3 || !canSettle(x)) continue;
    const sc = sameNeighbours(x) * 2 + flatScore(x) * 0.6 - d * 0.5 + fertility(x) * 4 + rnd();
    if (sc > bestScore) { bestScore = sc; best = x; }
  }
  return best;
}
function pathTo(a, b) {
  const prev = new Map([[a, -1]]), q = [a];
  for (let i = 0; i < q.length && i < 3000; i++) {
    const x = q[i];
    if (x === b) break;
    for (const n of NBR[x]) if (!prev.has(n) && isLand(n)) { prev.set(n, x); q.push(n); }
  }
  if (!prev.has(b)) return null;
  const path = [];
  for (let x = b; x !== a; x = prev.get(x)) path.push(x);
  return path.reverse();
}
function updateWalkers(dt) {
  for (let i = G.walkers.length - 1; i >= 0; i--) {
    const w = G.walkers[i];
    w.age += dt;
    if (!isLand(w.to) || !isLand(w.from)) { G.walkers.splice(i, 1); emit(posOf(w.from, 0.05), 0xbfe6ff, 10, 0.4, 0.3, 0.8); G.stats.lost++; continue; }
    if (w.t < 1 && w.from !== w.to) { w.t += dt * 0.9; continue; }
    w.from = w.to; w.t = 0;
    if (w.path.length) { w.to = w.path.shift(); continue; }
    // arrived (or idle): settle, or look for a new spot
    if (w.target === w.from && canSettle(w.from)) { found(w.from, w.pop); G.walkers.splice(i, 1); sfx.found(); tip('found', 'A new settlement! Level the land around it so it can grow.'); continue; }
    w.think -= dt;
    if (w.think > 0) continue;
    w.think = 1.5;
    const spot = findSpot(w.from);
    const path = spot !== null ? pathTo(w.from, spot) : null;
    if (path) { w.target = spot; w.path = path; w.to = w.path.shift(); }
    else if (++w.tries > 3 || w.age > 60) {
      // nowhere to go: rejoin the nearest settlement
      const home = nearestSettlement(w.from);
      if (home) home.pop += w.pop;
      G.walkers.splice(i, 1);
    } else { const n = NBR[w.from].filter(isLand); if (n.length) w.to = n[(rnd() * n.length) | 0]; }
  }
}
function nearestSettlement(v) {
  let best = null, bd = 1e9;
  for (const s of G.settlements) { const d = DIRS[s.v].distanceToSquared(DIRS[v]); if (d < bd) { bd = d; best = s; } }
  return best;
}
const totalPop = () => G.settlements.reduce((a, s) => a + s.pop, 0) + G.walkers.reduce((a, w) => a + w.pop, 0);

// ------------------------------------------------------------------ powers
function applyPower(id, v) {
  const p = PW[id];
  if (G.era < p.era) { toast(`${p.name} arrives in the ${ERAS[p.era].name}`); sfx.deny(); return false; }
  if (G.mana < p.cost) { toast('Not enough inspiration ✦'); sfx.deny(); return false; }
  let ok = true;
  const area = p.r ? bfs(v, p.r) : [[v, 0]];
  if (id === 'raise') ok = raiseV(v);
  else if (id === 'lower') ok = lowerV(v);
  else if (id === 'rain') {
    for (const [x] of area) { rain[x] = 45; burn[x] = 0; }
    for (let i = 0; i < 40; i++) { const [x] = area[(rnd() * area.length) | 0]; const q = posOf(x, 0.9); parts.push({ p: q, v: DIRS[x].clone().multiplyScalar(-2.2), c: new THREE.Color(0x9fd4ff), life: 0.45, max: 0.45, g: 0 }); }
    terrainDirty = true;
  } else if (id === 'forest') {
    let n = 0;
    for (const [x] of area) if (isLand(x) && !crowd[x] && h[x] - G.sea < 5) { tree[x] = 1; n++; }
    ok = n > 0;
    if (ok) { G.health = Math.min(100, G.health + 2); layoutTrees(); }
  } else if (id === 'inspire') {
    let n = 0;
    for (const s of G.settlements) if (area.some(([x]) => x === s.v)) { s.inspire = 40; n++; emit(posOf(s.v, 0.2), 0xffe27a, 24, 0.6, 0.4, 1.4, -0.2); }
    ok = n > 0;
    if (!ok) toast('No settlement there to inspire');
  } else if (id === 'bless') {
    for (const [x] of area) burn[x] = 0;
    for (const s of G.settlements) if (area.some(([x]) => x === s.v)) { s.sick = 0; s.pop = Math.min(capOf(s), s.pop * 1.1 + 2); emit(posOf(s.v, 0.2), 0xffffff, 20, 0.6, 0.4, 1.2, -0.2); }
    for (const st of storms) if (st.dir.distanceTo(DIRS[v]) < 0.4) st.life = 0;
    terrainDirty = true;
  } else if (id === 'cleanse') {
    G.health = Math.min(100, G.health + 14);
    for (let i = 0; i < 60; i++) emit(DIRS[(rnd() * NV) | 0].clone().multiplyScalar(R + 0.8), 0x9fffc8, 1, 0.3, 0.2, 1.2, 0);
    terrainDirty = true;
  } else if (id === 'terraform') {
    const target = Math.max(h[v], G.sea + 1);
    for (const [x] of area) setHeight(x, target);
  } else if (id === 'deflect') {
    if (!meteor) { toast('No meteor in the sky'); return false; }
    emit(meteor.pos, 0xffc060, 80, 1.2, 1.2, 1.4, 0); emit(meteor.pos, 0xffffff, 30, 2, 1.5, 0.6, 0);
    scene.remove(meteor.mesh, meteor.ring); meteor = null;
    toast('Meteor destroyed! 🎉'); sfx.boom();
  }
  if (!ok) { if (id === 'raise' || id === 'lower') sfx.deny(); return false; }
  G.mana -= p.cost;
  if (id === 'raise') sfx.raise(); else if (id === 'lower') sfx.lower(); else sfx.power();
  if (id === 'raise' || id === 'lower') emit(posOf(v, 0.02), 0xc8b48a, 6, 0.3, 0.3, 0.6);
  return true;
}

// ------------------------------------------------------------------ disasters
const storms = [];
let meteor = null, disasterT = 45, quakeT = 0;
function nextDisaster() {
  const e = G.era, pool = [];
  if (G.settlements.length < 2) return;
  if (e <= 3 && treeCount() > 10) pool.push('fire');
  if (e >= 1 && e <= 4) pool.push('plague');
  if (e >= 2) pool.push('quake');
  if (e >= 5) pool.push('storm', 'meteor');
  if (!pool.length) return;
  const kind = pool[(rnd() * pool.length) | 0];
  G.stats.disasters++;
  const s = G.settlements[(rnd() * G.settlements.length) | 0];
  if (kind === 'fire') {
    const near = bfs(s.v, 7).map(([x]) => x).filter((x) => tree[x]);
    if (!near.length) return;
    const v = near[(rnd() * near.length) | 0];
    burn[v] = 6; terrainDirty = true;
    alarm('🔥 Wildfire! Rain can put it out.', v);
  } else if (kind === 'plague') {
    s.sick = G.era >= 2 ? 40 : 18;
    alarm(G.era >= 2 ? '☠️ Plague! Bless the town to heal it.' : '☠️ A sickness spreads…', s.v);
  } else if (kind === 'quake') {
    quakeT = 2;
    for (let i = 0; i < 26; i++) { const area = bfs(s.v, 3); const [x] = area[(rnd() * area.length) | 0]; if (rnd() < 0.5) raiseV(x); else lowerV(x); }
    alarm('🌋 Earthquake! Level the land again.', s.v);
    sfx.rumble();
  } else if (kind === 'storm') {
    const axis = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().cross(DIRS[s.v]).normalize();
    const start = DIRS[s.v].clone().applyAxisAngle(axis, -0.9);
    const mesh = new THREE.Group();
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(cloudMesh.geometry, new THREE.MeshStandardMaterial({ color: 0x8a8f9a, flatShading: true, transparent: true, opacity: 0.9 })); const a = (i / 9) * Math.PI * 2; c.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35); c.scale.setScalar(0.7); mesh.add(c); }
    scene.add(mesh);
    storms.push({ dir: start, axis, life: 24, mesh });
    alarm('🌀 Hurricane! Bless it to calm the winds.', s.v);
  } else if (kind === 'meteor') {
    if (meteor) return;
    const target = s.v;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, emissive: 0xff6a2a, emissiveIntensity: 0.6, flatShading: true }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, depthTest: false }));
    ring.renderOrder = 6;
    scene.add(mesh, ring);
    const from = DIRS[target].clone().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.2)).normalize().multiplyScalar(R * 4);
    meteor = { target, from, t: 0, dur: 24, mesh, ring, pos: from.clone() };
    alarm('☄️ Meteor incoming! Use Deflect before it hits.', target);
  }
}
const treeCount = () => { let n = 0; for (let v = 0; v < NV; v++) n += tree[v]; return n; };
function alarm(msg, v) { toast(msg, v); sfx.alarm(); }
function updateDisasters(dt) {
  disasterT -= dt;
  if (disasterT <= 0) { disasterT = Math.max(28, 70 - G.era * 6) + rnd() * 30; if (G.elapsed > 60) nextDisaster(); }
  // fire spreads through forests
  let burning = false;
  for (let v = 0; v < NV; v++) {
    if (burn[v] <= 0) continue;
    burning = true;
    burn[v] -= dt;
    if (rnd() < dt * 6) emit(posOf(v, 0.05), rnd() < 0.6 ? 0xff7a2a : 0x6a6a6a, 1, 0.5, 0.15, 1, -0.3);
    if (rnd() < dt * 0.9) for (const n of NBR[v]) if (tree[n] && burn[n] <= 0 && rnd() < 0.5) { burn[n] = 6; terrainDirty = true; }
    for (const s of G.settlements) if (s.v === v || NBR[s.v].includes(v)) s.pop -= dt * 2;
    if (burn[v] <= 0) { burn[v] = 0; tree[v] = 0; terrainDirty = true; }
  }
  if (burning && rnd() < dt) layoutTrees();
  // plague
  for (const s of G.settlements) {
    if (s.sick <= 0) continue;
    s.sick -= dt;
    s.pop -= s.pop * dt * 0.03;
    if (rnd() < dt * 0.4) emit(posOf(s.v, 0.15), 0x8aff6a, 2, 0.2, 0.2, 1.2, -0.1);
    if (rnd() < dt * 0.08) { const o = G.settlements.find((x) => x !== s && x.sick <= 0 && DIRS[x.v].distanceTo(DIRS[s.v]) < 0.5); if (o) o.sick = s.sick + 5; }
  }
  // storms sweep across the surface
  for (let i = storms.length - 1; i >= 0; i--) {
    const st = storms[i];
    st.life -= dt;
    st.dir.applyAxisAngle(st.axis, dt * 0.07).normalize();
    qa.setFromUnitVectors(UP, st.dir);
    st.mesh.quaternion.copy(qa);
    st.mesh.position.copy(st.dir).multiplyScalar(R + 0.75);
    st.mesh.rotateY(t * 3);
    for (const s of G.settlements) if (DIRS[s.v].distanceTo(st.dir) < 0.13) { s.pop -= s.pop * dt * 0.1; if (rnd() < dt * 2) emit(posOf(s.v, 0.3), 0xdfe9ff, 2, 0.4, 0.4, 0.5); }
    if (rnd() < dt * 1.5) { const fl = new THREE.PointLight(0xcfe0ff, 30, 3); fl.position.copy(st.mesh.position); scene.add(fl); setTimeout(() => scene.remove(fl), 90); }
    if (st.life <= 0) { scene.remove(st.mesh); storms.splice(i, 1); }
  }
  // meteor
  if (meteor) {
    meteor.t += dt;
    const k = meteor.t / meteor.dur, target = DIRS[meteor.target].clone().multiplyScalar(radiusOf(meteor.target));
    meteor.pos.copy(meteor.from).lerp(target, k * k);
    meteor.mesh.position.copy(meteor.pos);
    meteor.mesh.rotation.x += dt * 2;
    if (rnd() < dt * 30) emit(meteor.pos, 0xff8a3a, 1, 0, 0.1, 0.8, 0);
    qa.setFromUnitVectors(new THREE.Vector3(0, 0, 1), DIRS[meteor.target]);
    meteor.ring.quaternion.copy(qa);
    meteor.ring.position.copy(DIRS[meteor.target]).multiplyScalar(radiusOf(meteor.target) + 0.05);
    meteor.ring.material.opacity = 0.5 + 0.5 * Math.sin(t * 8);
    $('meteor').hidden = false;
    $('meteor').textContent = `☄️ Impact in ${Math.ceil(meteor.dur - meteor.t)}s`;
    if (meteor.t >= meteor.dur) impact();
  } else $('meteor').hidden = true;
}
function impact() {
  const v = meteor.target;
  scene.remove(meteor.mesh, meteor.ring);
  meteor = null;
  for (const [x, d] of bfs(v, 3)) { for (let i = 0; i < 4 - d; i++) lowerV(x); burn[x] = d < 2 ? 3 : 0; tree[x] = 0; }
  for (const s of G.settlements.slice()) if (DIRS[s.v].distanceTo(DIRS[v]) < 0.22) removeSettlement(s);
  emit(posOf(v, 0.1), 0xffa040, 120, 2, 1, 1.6, 1.2); emit(posOf(v, 0.1), 0x6a5a4a, 80, 1.2, 1, 2, 0.6);
  quakeT = 3;
  G.health = Math.max(0, G.health - 10);
  toast('☄️ The meteor struck!', v);
  sfx.boom();
}

// ------------------------------------------------------------------ simulation
function simulate(dt) {
  G.elapsed += dt;
  let pop = 0, know = 0, poll = 0;
  for (const s of G.settlements.slice()) {
    if (!isLand(s.v)) { removeSettlement(s, '🌊 A settlement was swallowed by the sea!'); continue; }
    if (s.pop < 0.5) { removeSettlement(s, 'A settlement has died out.'); continue; }
    s.cool -= dt; s.inspire = Math.max(0, s.inspire - dt);
    s.check = (s.check || 0) - dt;
    if (s.check <= 0) { s.check = 0.6; const l = levelFor(s); if (l !== s.level) { if (l > s.level) { emit(posOf(s.v, 0.2), 0xfff3c4, 20, 0.5, 0.4, 1, -0.1); sfx.grow(); } s.level = l; s.grow = 0; setDirty = true; } s.fert = fertility(s.v); }
    const cap = capOf(s);
    if (s.sick <= 0) s.pop = Math.min(cap, s.pop + (s.pop * 0.045 * s.fert + 0.25) * dt);
    if (s.pop >= cap * 0.98 && s.cool <= 0 && G.walkers.length < 40 && G.settlements.length < 60) {
      s.cool = 8;
      spawnWalker(s.v, s.pop * 0.4);
      s.pop *= 0.6;
    }
    pop += s.pop;
    know += s.pop * (s.inspire > 0 ? 3 : 1) * (0.7 + s.level * 0.15);
    if (s.inspire > 0 && rnd() < dt * 3) emit(posOf(s.v, 0.15), 0xffe27a, 1, 0.4, 0.2, 1, -0.1);
  }
  pop += G.walkers.reduce((a, w) => a + w.pop, 0);
  // knowledge grows with the square root of the people: a bigger world helps, but not linearly
  G.know += (pop > 0 ? (know / pop) * Math.sqrt(pop) * 0.07 * (1 + G.era * 0.35) : 0) * dt;
  G.mana = Math.min(999, G.mana + (0.8 + Math.sqrt(pop) * 0.22) * dt);
  G.stats.peak = Math.max(G.stats.peak, pop);
  // the planet's health: pollution against forests and time
  poll = Math.sqrt(pop) * POLLUTE[G.era];
  const before = G.health;
  G.health = clamp(G.health + (0.05 + treeCount() * 0.0012 - poll) * dt, 0, 100);
  const seaTarget = SEA0 + (G.health < 70) + (G.health < 45) + (G.health < 25);
  if (seaTarget !== G.sea) {
    const rising = seaTarget > G.sea;
    G.sea = seaTarget;
    terrainDirty = true;
    toast(rising ? '🌊 The ice caps are melting: the seas are rising! Raise your coasts.' : '🌊 The seas are retreating.');
    if (rising) sfx.rumble();
  }
  if (Math.floor(before / 10) !== Math.floor(G.health / 10) && G.health < before && G.health < 80) tip(`h${Math.floor(G.health / 10)}`, `🌍 Planet health ${Math.round(G.health)}%: plant forests and cleanse the skies.`, true);
  for (let v = 0; v < NV; v++) if (rain[v] > 0) { rain[v] -= dt; if (rain[v] <= 0) terrainDirty = true; }
  updateWalkers(dt);
  updateDisasters(dt);
  if (G.know >= ERAS[G.era].need && !tips[`ready${G.era}`]) tip(`ready${G.era}`, `💡 Your people are ready to build the ${WONDERS[G.era]}! Tap the goal above.`, true);
  if (G.started && G.elapsed > 5 && totalPop() < 1) endGame(false, 'Your people are gone.');
  if (G.health <= 0) endGame(false, 'The planet has died.');
}

// ------------------------------------------------------------------ wonders and the ages
function bestSettlement() { return G.settlements.reduce((a, s) => (!a || s.level > a.level || (s.level === a.level && s.pop > a.pop) ? s : a), null); }
function wonderReady() {
  const e = ERAS[G.era], best = bestSettlement();
  return { know: G.know >= e.need, mana: G.mana >= e.cost, level: !!best && best.level >= e.lvl, best };
}
function buildWonder() {
  const r = wonderReady(), e = ERAS[G.era];
  if (!r.know || !r.mana || !r.level) { sfx.deny(); return; }
  G.mana -= e.cost;
  // the wonder stands on flat ground two steps from the town
  const s = r.best;
  const spots = bfs(s.v, 2).filter(([x, d]) => d === 2 && isLand(x) && h[x] === h[s.v]).map(([x]) => x);
  const v = spots.length ? spots[0] : NBR[s.v][0];
  const w = { era: G.era, v };
  G.wonders.push(w);
  for (const [x] of bfs(v, 1)) tree[x] = 0;
  rebuildCrowd(); layoutWonders();
  flyTo(v, 11);
  emit(posOf(v, 0.3), 0xffe27a, 80, 1, 0.8, 1.8, -0.2);
  sfx.fanfare();
  $('goal-sheet').hidden = true;
  if (G.era === 6) { launch(w); return; }
  G.era++;
  G.know = 0;
  setDirty = true; terrainDirty = true;
  score?.setEra(G.era);
  showEra();
  save();
}
function layoutWonders() {
  wonderGroup.clear();
  for (const w of G.wonders) {
    const m = wonderModel(w.era);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(m.body, bodyMat));
    if (m.glow) g.add(new THREE.Mesh(m.glow, glowMat));
    if (w.era === 6) { const ship = starshipModel(); const sg = new THREE.Group(); sg.add(new THREE.Mesh(ship.body, bodyMat)); if (ship.glow) sg.add(new THREE.Mesh(ship.glow, glowMat)); g.add(sg); w.ship = sg; }
    qa.setFromUnitVectors(UP, DIRS[w.v]);
    g.quaternion.copy(qa);
    g.position.copy(DIRS[w.v]).multiplyScalar(radiusOf(w.v));
    g.scale.setScalar(1.4);
    wonderGroup.add(g);
    w.group = g;
  }
}
let launching = null;
function launch(w) {
  G.mode = 'launch';
  launching = { w, t: 0 };
  toast('🚀 Ignition! Your people head for the stars.');
}
function updateLaunch(dt) {
  if (!launching) return;
  const L = launching;
  L.t += dt;
  const ship = L.w.ship;
  const lift = L.t < 1.5 ? 0 : Math.pow(L.t - 1.5, 2) * 0.35;
  ship.position.set(0, lift, 0);
  const base = new THREE.Vector3(0, lift, 0).applyMatrix4(L.w.group.matrixWorld);
  emit(base, rnd() < 0.5 ? 0xffb040 : 0xffffff, 6, -0.6, 0.4, 0.8, 0);
  if (L.t < 2) cam.shake = 0.6;
  cam.tDist = 11 + L.t * 2.5;
  if (L.t > 7.5) { launching = null; endGame(true); }
}
function showEra() {
  const e = ERAS[G.era];
  G.mode = 'banner';
  $('era-icon').textContent = e.icon;
  $('era-name').textContent = e.name;
  $('era-desc').textContent = e.desc;
  const unlocked = POWERS.filter((p) => p.era === G.era).map((p) => p.name);
  $('era-unlock').innerHTML = unlocked.length ? `New powers: <b>${unlocked.join(', ')}</b>` : '';
  $('era-wonder').innerHTML = `Next wonder: <b>${WONDERS[G.era]}</b>`;
  document.body.style.setProperty('--era', e.color);
  $('era').hidden = false;
  buildPowers();
  updateHud();
}
$('era-ok').addEventListener('click', () => { $('era').hidden = true; G.mode = 'play'; });

// ------------------------------------------------------------------ input: drag turns the planet, pinch zooms, tap uses a power
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickVertex(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(planet, false)[0];
  if (!hit) return null;
  const f = FACES[hit.faceIndex];
  let best = f[0], bd = 1e9;
  for (const v of f) { const d = posOf(v).distanceToSquared(hit.point); if (d < bd) { bd = d; best = v; } }
  return best;
}
const ptrs = new Map();
let press = null, gesture = null, repeatT = 0, tool = 'raise';
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => {
  try { cvs.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, repeating: false, multi: false };
  else if (press) press.multi = true;
  gesture = null; cam.fly = false;
});
cvs.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    if (press && !press.moved && Math.hypot(p.x - press.x, p.y - press.y) < 10) return;
    if (press) press.moved = true;
    const k = (cam.dist / 16) * 0.0055;
    cam.vTheta = -dx * k; cam.vPhi = -dy * k;
    cam.theta += cam.vTheta; cam.phi += cam.vPhi;
    cam.vTheta *= 0.5; cam.vPhi *= 0.5;
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (gesture) cam.tDist = cam.dist = clamp(cam.dist * (gesture / dist), 7.6, 26);
    gesture = dist;
  }
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) gesture = null;
  if (!press || e.pointerId !== press.id) return;
  if (!press.moved && !press.repeating && !press.multi && performance.now() - press.t < 450 && G.mode === 'play') useAt(press.x, press.y);
  press = null;
}
cvs.addEventListener('pointerup', endPtr);
cvs.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); press = null; gesture = null; });
cvs.addEventListener('wheel', (e) => { e.preventDefault(); cam.tDist = clamp(cam.tDist * (e.deltaY > 0 ? 1.1 : 0.9), 7.6, 26); }, { passive: false });
function useAt(cx, cy) {
  const v = pickVertex(cx, cy);
  if (v === null) return;
  const ok = applyPower(tool, v);
  const p = PW[tool];
  qa.setFromUnitVectors(new THREE.Vector3(0, 0, 1), DIRS[v]);
  cursor.quaternion.copy(qa);
  cursor.position.copy(DIRS[v]).multiplyScalar(radiusOf(v) + 0.04);
  cursor.scale.setScalar(p.r ? 0.2 + p.r * 0.33 : 0.13);
  cursor.material.color.set(ok ? 0xffffff : 0xff6b6b);
  cursor.visible = true; cursorT = 0.7;
  updateHud();
}
function pressRepeat(dt) {
  if (!press || press.moved || press.multi || !(tool === 'raise' || tool === 'lower')) return;
  if (performance.now() - press.t < 380) return;
  press.repeating = true;
  repeatT -= dt;
  if (repeatT <= 0) { repeatT = 0.15; useAt(press.x, press.y); }
}

// ------------------------------------------------------------------ rendering per frame
function layoutSettlements(dt) {
  const counts = {};
  for (const k of Object.keys(templates)) counts[k] = 0;
  const smoke = [];
  for (const s of G.settlements) {
    s.grow = Math.min(1, s.grow + dt * 1.5);
    const key = `${G.era}-${s.level}`, tp = templates[key];
    const n = counts[key]++;
    const sc = 0.6 + 0.4 * (1 - Math.pow(1 - s.grow, 3));
    placeOn(tp.body, n, s.v, -0.005, s.v * 0.7, sc);
    if (tp.glow) tp.glow.setMatrixAt(n, dummy.matrix);
    if (G.era === 4 && rnd() < dt * s.level) for (const sp of tp.smoke) smoke.push(new THREE.Vector3(...sp).applyMatrix4(dummy.matrix));
  }
  for (const [k, tp] of Object.entries(templates)) {
    tp.body.count = counts[k]; tp.body.instanceMatrix.needsUpdate = true;
    if (tp.glow) { tp.glow.count = counts[k]; tp.glow.instanceMatrix.needsUpdate = true; }
  }
  for (const p of smoke) emit(p, 0x9a9a9a, 1, 0.25, 0.08, 2, -0.05);
}
const pColor = new THREE.Color();
function layoutPeople() {
  let n = 0;
  pColor.set(PEOPLE_COL[G.era]);
  for (const w of G.walkers) {
    if (n >= 240) break;
    const a = DIRS[w.from], b = DIRS[w.to], tt = Math.min(1, w.t);
    const dir = a.clone().lerp(b, tt).normalize();
    const r = R + (h[w.from] * (1 - tt) + h[w.to] * tt) * STEP;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    placeOn(people, n, 0, r, yaw, 1 + Math.min(1, Math.log10(1 + w.pop) * 0.4), dir);
    people.setColorAt(n++, pColor);
  }
  people.count = n;
  people.instanceMatrix.needsUpdate = true;
  if (people.instanceColor) people.instanceColor.needsUpdate = true;
}
const flights = [];
function layoutPlanes(dt) {
  if (G.era >= 5 && G.settlements.length > 2 && flights.length < Math.min(24, G.settlements.length) && rnd() < dt) {
    const a = G.settlements[(rnd() * G.settlements.length) | 0], b = G.settlements[(rnd() * G.settlements.length) | 0];
    if (a !== b) flights.push({ a: DIRS[a.v].clone(), b: DIRS[b.v].clone(), t: 0, dur: 6 + DIRS[a.v].distanceTo(DIRS[b.v]) * 10 });
  }
  let n = 0;
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];
    f.t += dt / f.dur;
    if (f.t >= 1 || G.era < 5) { flights.splice(i, 1); continue; }
    const alt = (k) => R + 0.6 + Math.sin(Math.PI * k) * 0.9;
    const p = f.a.clone().lerp(f.b, f.t).normalize(), q = f.a.clone().lerp(f.b, Math.min(1, f.t + 0.01)).normalize();
    dummy.position.copy(p).multiplyScalar(alt(f.t));
    dummy.up.copy(p);
    dummy.lookAt(q.multiplyScalar(alt(f.t + 0.01)));
    dummy.scale.setScalar(1.6);
    dummy.updateMatrix();
    planes.setMatrixAt(n++, dummy.matrix);
  }
  dummy.up.set(0, 1, 0);
  planes.count = n;
  planes.instanceMatrix.needsUpdate = true;
  let s = 0;
  if (G.era >= 6) for (let i = 0; i < 10; i++) {
    const ax = new THREE.Vector3(Math.sin(i * 2.3), Math.cos(i * 1.7), Math.sin(i * 0.9)).normalize();
    const p = new THREE.Vector3(ax.y, -ax.x, 0.3).normalize().applyAxisAngle(ax, t * (0.15 + i * 0.02)).multiplyScalar(R + 1.8 + (i % 3) * 0.3);
    dummy.position.copy(p); dummy.rotation.set(t * 0.3 + i, t * 0.2, 0); dummy.scale.setScalar(1.5); dummy.updateMatrix();
    sats.setMatrixAt(s++, dummy.matrix);
  }
  sats.count = s;
  sats.instanceMatrix.needsUpdate = true;
}
function layoutClouds() {
  let n = 0;
  const grey = clamp((90 - G.health) / 60, 0, 0.75);
  cloudMesh.material.color.setRGB(1 - grey * 0.5, 1 - grey * 0.52, 1 - grey * 0.55);
  for (const c of clouds) {
    const d = c.dir.clone().applyAxisAngle(UP, t * 0.02 * (0.6 + (c.i % 3) * 0.2));
    placeOn(cloudMesh, n++, 0, R + 1.1 + (c.i % 4) * 0.08, c.yaw, c.s, d);
  }
  cloudMesh.count = n;
  cloudMesh.instanceMatrix.needsUpdate = true;
}
function layoutGuides() {
  let n = 0;
  if (G.mode === 'play' && (tool === 'raise' || tool === 'lower' || tool === 'terraform')) {
    for (const s of G.settlements) {
      if (s.level >= 4) continue;
      for (const [x] of bfs(s.v, 2)) {
        if (n >= 600 || x === s.v || !isLand(x) || h[x] === h[s.v]) continue;
        placeOn(guides, n++, x, 0.06, 0, 1);
      }
    }
  }
  guides.count = n;
  guides.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ UI
const ICON = { raise: '⛰️', lower: '🕳️', rain: '🌧️', forest: '🌲', inspire: '💡', bless: '✨', cleanse: '🍃', terraform: '🏗️', deflect: '🛡️' };
function buildPowers() {
  $('powers').innerHTML = POWERS.map((p) => {
    const locked = G.era < p.era;
    return `<button class="power${locked ? ' locked' : ''}${p.id === tool ? ' active' : ''}" data-p="${p.id}" aria-label="${p.name}"><i>${locked ? '🔒' : ICON[p.id]}</i><span>${p.name}</span><em>${locked ? ERAS[p.era].icon : `✦${p.cost}`}</em></button>`;
  }).join('');
  for (const b of document.querySelectorAll('.power')) b.addEventListener('click', () => setTool(b.dataset.p));
}
function setTool(id) {
  const p = PW[id];
  if (G.era < p.era) { toast(`${p.name} arrives in the ${ERAS[p.era].name}`); sfx.deny(); return; }
  tool = id;
  for (const b of document.querySelectorAll('.power')) b.classList.toggle('active', b.dataset.p === id);
  $('hint').textContent = p.hint;
  sfx.click();
  layoutGuides();
}
let toastTimer = 0, toastV = -1;
function toast(msg, v = -1) {
  const el = $('toast');
  el.textContent = msg; toastV = v;
  el.classList.toggle('go', v >= 0);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}
$('toast').addEventListener('click', () => { if (toastV >= 0) flyTo(toastV, 11); });
const tips = {};
function tip(key, msg, force = false) { if (tips[key]) return; tips[key] = true; if (force || G.era === 0) setTimeout(() => toast(msg), 400); }
function yearStr() {
  const e = ERAS[G.era], f = clamp(G.know / e.need, 0, 1), y = Math.round(e.years[0] + (e.years[1] - e.years[0]) * f);
  return y < 0 ? `${fmt(-y)} BCE` : `${y} CE`;
}
function updateHud() {
  const e = ERAS[G.era];
  $('era-chip').textContent = e.icon;
  $('era-label').textContent = e.name;
  $('year').textContent = yearStr();
  $('pop').textContent = fmt(totalPop());
  $('health').textContent = `${Math.round(G.health)}%`;
  $('health').className = G.health > 70 ? 'ok' : G.health > 40 ? 'mid' : 'no';
  $('mana').textContent = Math.floor(G.mana);
  $('mana-fill').style.height = `${Math.min(100, (G.mana / 700) * 100)}%`;
  const r = wonderReady(), f = clamp(G.know / e.need, 0, 1);
  $('goal-name').textContent = WONDERS[G.era];
  $('goal-fill').style.width = `${f * 100}%`;
  $('goal-pct').textContent = r.know && r.mana && r.level ? 'BUILD' : `${Math.floor(f * 100)}%`;
  $('goal').classList.toggle('ready', r.know && r.mana && r.level);
  for (const b of document.querySelectorAll('.power')) b.classList.toggle('poor', G.mana < PW[b.dataset.p].cost);
  if (!$('goal-sheet').hidden) renderGoal();
}
function renderGoal() {
  const e = ERAS[G.era], r = wonderReady();
  const row = (ok, text) => `<li class="${ok ? 'ok' : ''}"><b>${ok ? '✓' : '·'}</b>${text}</li>`;
  $('gs-title').textContent = WONDERS[G.era];
  $('gs-desc').textContent = WONDER_DESC[G.era] + (G.era === 6 ? ' Building it wins the game.' : ` Building it begins the ${ERAS[G.era + 1].name}.`);
  $('gs-list').innerHTML = row(r.know, `Knowledge ${fmt(Math.min(G.know, e.need))} / ${fmt(e.need)}`) + row(r.mana, `Inspiration ✦${fmt(Math.min(G.mana, e.cost))} / ${e.cost}`) + row(r.level, `A settlement of size ${e.lvl} (best: ${r.best ? r.best.level : 0}). Level the land around a town!`);
  $('gs-build').disabled = !(r.know && r.mana && r.level);
}
$('goal').addEventListener('click', () => { renderGoal(); $('goal-sheet').hidden = false; sfx.click(); });
$('gs-close').addEventListener('click', () => { $('goal-sheet').hidden = true; });
$('gs-build').addEventListener('click', buildWonder);
$('b-home').addEventListener('click', () => { const s = bestSettlement(); if (s) flyTo(s.v, 11); sfx.click(); });
$('b-menu').addEventListener('click', () => { $('opt-music').checked = store.get('aeons.music', true); $('opt-sfx').checked = store.get('aeons.sfx', true); $('pause').hidden = false; if (G.mode === 'play') G.mode = 'pause'; sfx.click(); });
$('pause-close').addEventListener('click', () => { $('pause').hidden = true; if (G.mode === 'pause') G.mode = 'play'; });
$('to-title').addEventListener('click', () => { save(); $('pause').hidden = true; showMenu(); });

function endGame(won, why = '') {
  if (G.mode === 'end') return;
  G.mode = 'end';
  store.del('aeons.save');
  const mins = G.elapsed / 60, stars = won ? (mins < 30 ? 3 : mins < 45 ? 2 : 1) : 0;
  $('end-title').textContent = won ? 'To the stars!' : 'Extinction';
  $('end').classList.toggle('lose', !won);
  $('end-stars').innerHTML = [1, 2, 3].map((k) => `<span class="${k <= stars ? 'on' : ''}">★</span>`).join('');
  $('end-text').textContent = won ? 'Your people leave their cradle world behind, carrying ten thousand years of history.' : why;
  $('end-stats').innerHTML = [['Time', `${Math.floor(mins)}:${String(Math.floor(G.elapsed % 60)).padStart(2, '0')}`], ['Ages', `${G.era + (won ? 1 : 0)} / 7`], ['Peak population', fmt(G.stats.peak)], ['Settlements founded', G.stats.founded]]
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('end').hidden = false;
  if (won) sfx.fanfare(); else sfx.deny();
}
$('end-again').addEventListener('click', () => { $('end').hidden = true; newWorld(); play(); });

// ------------------------------------------------------------------ save / load
const pack = (a, off = 0) => { let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i] + 48 + off); return s; };
const unpack = (s, a, off = 0) => { for (let i = 0; i < a.length; i++) a[i] = (s.charCodeAt(i) || 48) - 48 - off; };
function save() {
  if (G.mode === 'end' || !G.started) return;
  store.set('aeons.save', {
    v: 1, seed: G.seed, era: G.era, know: G.know, mana: G.mana, health: G.health, sea: G.sea, elapsed: G.elapsed, stats: G.stats, tips,
    h: pack(h), tree: pack(tree),
    settlements: G.settlements.map((s) => [s.v, Math.round(s.pop)]), walkers: G.walkers.map((w) => [w.from, Math.round(w.pop)]), wonders: G.wonders.map((w) => [w.era, w.v]),
  });
}
function load() {
  const s = store.get('aeons.save', null);
  if (!s || s.v !== 1) return false;
  Object.assign(G, { seed: s.seed, era: s.era, know: s.know, mana: s.mana, health: s.health, sea: s.sea, seaVis: s.sea, elapsed: s.elapsed, stats: s.stats, started: true });
  Object.assign(tips, s.tips || {});
  unpack(s.h, h); unpack(s.tree, tree);
  rain.fill(0); burn.fill(0);
  G.settlements = []; G.walkers = []; G.wonders = s.wonders.map(([era, v]) => ({ era, v }));
  rebuildCrowd();
  for (const [v, pop] of s.settlements) { const st = { v, pop, level: 1, grow: 1, sick: 0, inspire: 0, cool: 6, fert: 1 }; G.settlements.push(st); }
  for (const st of G.settlements) st.level = levelFor(st);
  for (const [v, pop] of s.walkers) spawnWalker(v, pop);
  rebuildCrowd();
  return true;
}
function resetScene() {
  for (const st of storms) scene.remove(st.mesh);
  storms.length = 0;
  if (meteor) { scene.remove(meteor.mesh, meteor.ring); meteor = null; }
  flights.length = 0; parts.length = 0; launching = null;
  terrainDirty = true; setDirty = true;
  layoutWonders();
  buildPowers();
  setTool('raise');
  document.body.style.setProperty('--era', ERAS[G.era].color);
  score?.setEra(G.era);
  const s = bestSettlement();
  if (s) { const sp = new THREE.Spherical().setFromVector3(DIRS[s.v]); cam.theta = cam.tTheta = sp.theta; cam.phi = cam.tPhi = sp.phi; }
  cam.dist = cam.tDist = 14;
  sunAng = Math.atan2(Math.cos(cam.theta), Math.sin(cam.theta)) - 0.5;
}
function newWorld() {
  const seed = (Date.now() % 100000) + 1;
  Object.assign(G, { seed, era: 0, know: 0, mana: 60, health: 100, sea: SEA0, seaVis: SEA0, elapsed: 0, started: true, settlements: [], walkers: [], wonders: [], stats: { founded: 0, lost: 0, disasters: 0, peak: 0 } });
  for (const k of Object.keys(tips)) delete tips[k];
  disasterT = 70;
  const start = generate(seed);
  rebuildCrowd();
  found(start, 6);
  G.stats.founded = 0;
  spawnWalker(NBR[start][0], 3);
  resetScene();
}
function showMenu() {
  G.mode = 'menu';
  document.body.classList.add('in-menu');
  const s = store.get('aeons.save', null);
  $('continue').hidden = !s;
  if (s) $('continue').innerHTML = `Continue <small>${ERAS[s.era].icon} ${ERAS[s.era].name}</small>`;
  $('newworld').classList.toggle('stone', !!s);
  $('menu').hidden = false;
}
function play() {
  sfx.init();
  $('menu').hidden = true;
  document.body.classList.remove('in-menu');
  G.mode = 'play';
  cam.tDist = 14;
  sunAng = Math.atan2(Math.cos(cam.theta), Math.sin(cam.theta)) - 0.5;
  if (G.era === 0 && G.elapsed < 1) { showEra(); setTimeout(() => toast('Tap Raise or Lower to level the ground. Your tribe settles on flat land.'), 900); }
}
$('continue').addEventListener('click', () => { if (load()) resetScene(); play(); });
$('newworld').addEventListener('click', () => {
  if (store.get('aeons.save', null) && !confirm('Start a new world? Your current world will be lost.')) return;
  store.del('aeons.save');
  newWorld(); play();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); sfx.suspend(document.hidden); });
setInterval(() => { if (G.mode === 'play') save(); }, 20000);

// ------------------------------------------------------------------ sound
let score = null;
const sfx = (() => {
  let ac = null, master = null, musicOut = null, noise = null;
  const levels = () => { if (!ac) return; master.gain.value = store.get('aeons.sfx', true) ? 0.45 : 0; musicOut.gain.value = store.get('aeons.music', true) ? 1 : 0; };
  const init = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.connect(ac.destination);
      musicOut = ac.createGain(); musicOut.connect(ac.destination);
      levels();
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      score = createScore(ac, musicOut);
      score.setEra(G.era);
      score.start();
    } catch { ac = null; }
  };
  const tone = (f0, f1, dur, type, vol, delay = 0) => {
    if (!ac) return;
    const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const hiss = (dur, f, vol, type = 'lowpass') => {
    if (!ac) return;
    const t0 = ac.currentTime, s = ac.createBufferSource(); s.buffer = noise;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(fl).connect(g).connect(master); s.start(t0, Math.random()); s.stop(t0 + dur);
  };
  return {
    init,
    click: () => tone(880, 880, 0.04, 'sine', 0.05),
    deny: () => tone(200, 150, 0.14, 'triangle', 0.08),
    raise: () => { tone(220, 330, 0.1, 'triangle', 0.1); hiss(0.08, 900, 0.1); },
    lower: () => { tone(260, 160, 0.1, 'triangle', 0.1); hiss(0.1, 500, 0.12); },
    power: () => { hiss(0.6, 2400, 0.15, 'bandpass'); [523, 784, 1047].forEach((f, i) => tone(f, f, 0.3, 'sine', 0.06, i * 0.06)); },
    found: () => [392, 523].forEach((f, i) => tone(f, f, 0.2, 'sine', 0.07, i * 0.08)),
    grow: () => [523, 659, 784].forEach((f, i) => tone(f, f, 0.18, 'sine', 0.05, i * 0.06)),
    alarm: () => [0, 0.25, 0.5].forEach((d) => tone(740, 560, 0.2, 'triangle', 0.06, d)),
    rumble: () => { hiss(1.6, 160, 0.7); tone(48, 30, 1.4, 'sine', 0.4); },
    boom: () => { hiss(1.4, 300, 0.9); tone(70, 30, 1.2, 'sawtooth', 0.25); },
    fanfare: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.45, 'triangle', 0.09, i * 0.13)),
    music(on) { store.set('aeons.music', on); if (!score) return; levels(); },
    effects(on) { store.set('aeons.sfx', on); levels(); },
    suspend(on) { if (!ac) return; if (on) ac.suspend(); else ac.resume(); },
  };
})();
$('opt-music').addEventListener('change', (e) => { sfx.init(); sfx.music(e.target.checked); });
$('opt-sfx').addEventListener('change', (e) => { sfx.effects(e.target.checked); });

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let t = 0, hudT = 0, guideT = 0, sunAng = 0.6;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  timeU.value = t;
  if (G.mode === 'play') { simulate(dt); pressRepeat(dt); }
  if (G.mode === 'launch') updateLaunch(dt);
  if (G.mode === 'menu') { cam.theta += dt * 0.06; cam.tDist = 23; }
  // the sun circles the planet: a day lasts two minutes
  sunAng += dt * (Math.PI * 2) / 150;
  sunDir.set(Math.cos(sunAng), 0.25, Math.sin(sunAng)).normalize();
  sun.position.copy(sunDir).multiplyScalar(30);
  if (quakeT > 0) { quakeT -= dt; cam.shake = quakeT; } else if (G.mode !== 'launch') cam.shake = 0;
  updateCamera(dt);
  waterMat.uniforms.uCam.value.copy(camera.position);
  if (Math.abs(G.seaVis - G.sea) > 0.001) { G.seaVis += Math.sign(G.sea - G.seaVis) * Math.min(Math.abs(G.sea - G.seaVis), dt * 0.4); terrainDirty = true; }
  water.scale.setScalar(1 + ((G.seaVis + 0.5) * STEP) / R);
  if (terrainDirty) { terrainDirty = false; rebuildPlanet(); for (const w of G.wonders) if (w.group) w.group.position.copy(DIRS[w.v]).multiplyScalar(radiusOf(w.v)); }
  atmoColor.set(0x5fa8ff).lerp(new THREE.Color(0xc89a6a), clamp((80 - G.health) / 80, 0, 0.8));
  layoutSettlements(dt);
  layoutPeople();
  layoutPlanes(dt);
  layoutClouds();
  guideT -= dt;
  if (guideT <= 0) { guideT = 0.4; layoutGuides(); }
  if (cursorT > 0) { cursorT -= dt; cursor.material.opacity = Math.max(0, cursorT * 1.6); if (cursorT <= 0) cursor.visible = false; }
  updateParticles(dt);
  hudT -= dt;
  if (hudT <= 0 && (G.mode === 'play' || G.mode === 'pause')) { hudT = 0.25; updateHud(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
if (!load()) newWorld(); else resetScene();
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

// Exposed for automated testing.
window.__aeons = { G, h, tree, simulate, applyPower, buildWonder, wonderReady, raiseV, lowerV, bfs, NBR, DIRS, levelFor, flyTo, cam, newWorld, play, setTool, nextDisaster, get meteor() { return meteor; } };
