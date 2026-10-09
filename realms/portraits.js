// =====================================================================
// Hex Realms: creature and hero portraits for the UI ("card art").
// Renders the real 3D models live into small cached images:
//  - 3/4 hero-shot camera auto-framed on the bust (humanoids: head + chest,
//    riders: the rider, beasts: head + forequarters) from the rig tags
//    (aBone / aPivot, see rig.js); untagged models fall back to a top crop.
//  - three-point studio light: warm key, cool back rim, soft cool fill
//    (+ a faction/player-coloured kicker from behind on the other side).
//  - faction-coloured radial backdrop centred behind the head, soft light
//    rays, sparkles (larger sizes), silhouette halo, vignette, the bust
//    fading into the backdrop at the bottom.
//  - a thin gold inner frame painted into the image; upgraded creatures get
//    a gold star with a glint (top-left); heroes get a player-colour plate.
//  - supersampled: drawn at 2x the output resolution (MSAA x4) and
//    downsampled in the composite pass, so it stays crisp at 48-128 px.
//
//   initPortraits(THREE, renderer, modelFn, opts?)  once, after the renderer exists
//   portrait(id, size = 64, shape = 'square')        -> dataURL (cached) | ''
//   portraitImg(id, size = 64, cls = 'pt')          -> '<img ...>' HTML | ''
//   heroPortrait(fac, color, size = 64, shape)       -> dataURL (cached) | ''
//   heroPortraitImg(fac, color, size = 64, cls = 'pt hero', shape = 'square') -> '<img>' | ''
//   preloadPortraits(ids, size)   warms the cache in idle time
//   clearPortraits()
//
// ids: every key of data.js UNITS, plus heroes 'hero:<fac>' or 'hero:<fac>:<rrggbb>'.
// shape: 'square' (rounded-square gold frame, the default) or 'round' (gold ring,
// transparent corners: for circular sockets such as the hero buttons).
// opts: { dispose = true, scale = 1 (x devicePixelRatio, max 2), ss = 2 (supersampling) }
//
// Cost per (id, size, shape), rendered once: one model build (shared between
// sizes through a small LRU), one MSAA render at 2x, one composite pass on the
// game's own renderer (no extra WebGL context), one 8-bit readback, one PNG encode.
// =====================================================================
import { UNITS } from './data.js?v=1.6';
import { heroModel } from './models_towns.js?v=1.6';
import { makeBodyMaterial, makeGlowMaterial } from './materials.js?v=1.6';
import { BONE } from './rig.js?v=1.6';

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const css = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0').slice(-6);

// backdrop palettes (sRGB): inner glow behind the head, mid, outer edge, halo
// around the silhouette, ray colour, kicker light (back light on the left side)
const PAL = {
  haven: { inner: 0xfff2c0, mid: 0x5c9ced, outer: 0x1f3f94, halo: 0xfff8dc, ray: 0xfff0b0, kick: 0x8ab8ff },
  necro: { inner: 0xd6f7b4, mid: 0x7a54c0, outer: 0x2e1a5e, halo: 0xe0ffc8, ray: 0xc8ffa8, kick: 0x9cff8a },
  sylvan: { inner: 0xfaf3b8, mid: 0x5eb64c, outer: 0x1c5a2e, halo: 0xfffbd8, ray: 0xfff2a0, kick: 0xc8ff8a },
  inferno: { inner: 0xffe7a0, mid: 0xec6a2a, outer: 0x781c16, halo: 0xfff0c0, ray: 0xffd070, kick: 0xff7a3a },
  dungeon: { inner: 0xe8d0ff, mid: 0x8a50d4, outer: 0x261a62, halo: 0xd8fff8, ray: 0x9af0ea, kick: 0x5ae8e0 },
  neutral: { inner: 0xffe8b4, mid: 0xb88e56, outer: 0x56391e, halo: 0xfff2d0, ray: 0xffe0a0, kick: 0xffc880 },
};
// upgraded creatures: a golden heart in the backdrop, more rays
const UPGLOW = 0xfff6c8;

// optional per-creature tweaks of the automatic framing (ids are base ids; upgrades share them)
// az: camera azimuth (+ sees the creature's right / weapon side), el: elevation,
// zoom (>1 = tighter), dx/dy: shift of the subject in frame units (+ = right/up)
const FRAME = {
  swordsman: { az: -0.5 }, crusader: { az: -0.5 },
  monk: { az: -0.5 }, zealot: { az: -0.5 },
  lich: { az: -0.55 }, powerlich: { az: -0.55 },
  dwarf: { az: -0.5 }, battledwarf: { az: -0.5 },
  beholder: { el: 0.12 }, evileye: { el: 0.12 },
  dendroid: { zoom: 0.72 }, dendroidsoldier: { zoom: 0.72 },
  minotaur: { az: -0.5 }, minotaurking: { az: -0.5 },
  skeleton: { az: -0.5 }, skelwarrior: { az: -0.5 },
  zombie: { az: 0.2, el: -0.04 }, plaguezombie: { az: 0.2, el: -0.04 },
  troll: { az: 0.25, el: -0.06 }, ogre: { az: 0.35, el: 0.0 },
  centaur: { az: -0.7, zoom: 0.85 }, centaurcpt: { az: -0.7, zoom: 0.85 },
  blackknight: { az: -0.8 }, dreadknight: { az: -0.8 },
};

let T = null, R = null, modelOf = null, OPTS = {};
let scene, cam, bodyMat, glowMat, keyL, fillL, rimL, kickL, hemiL, quadScene, quadCam, comp, rtScene, rtOut;
const cache = new Map();
const geoLRU = new Map();

export function initPortraits(THREE, renderer, modelFn, opts = {}) {
  T = THREE; R = renderer; modelOf = modelFn; OPTS = { dispose: true, ss: 2, ...opts };
  scene = new T.Scene();
  cam = new T.PerspectiveCamera(26, 1, 0.05, 50);
  bodyMat = makeBodyMaterial(T, { ao: 0.2, rim: 0.4, rimColor: 0xbfe0ff, hemi: 0.14, contrast: 0.28, sat: 1.15 });
  glowMat = makeGlowMaterial(T, { pulse: 0 });
  keyL = new T.DirectionalLight(0xffe2b8, 1.9);   // warm key, upper front-left
  fillL = new T.DirectionalLight(0xbcd2ff, 0.4); // soft cool fill, front-right, low
  rimL = new T.DirectionalLight(0xa8dcff, 2.8);   // cool rim, behind-right
  kickL = new T.DirectionalLight(0xffffff, 1.4);  // coloured kicker, behind-left (faction / player colour)
  hemiL = new T.HemisphereLight(0xeaf0ff, 0x7a6248, 0.55);
  scene.add(keyL, fillL, rimL, kickL, keyL.target, fillL.target, rimL.target, kickL.target, hemiL);
  quadScene = new T.Scene();
  quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  comp = new T.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      tMap: { value: null }, uPx: { value: 1 / 128 }, uExp: { value: 0.85 }, uOut: { value: 64 },
      uInner: { value: new T.Vector3() }, uMid: { value: new T.Vector3() }, uOuter: { value: new T.Vector3() },
      uHalo: { value: new T.Vector3() }, uRay: { value: new T.Vector3() },
      uFocus: { value: new T.Vector2(0.5, 0.62) }, uRays: { value: 0.3 }, uSpark: { value: 0.5 }, uSeed: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tMap; uniform float uPx, uExp, uOut, uRays, uSpark, uSeed;
      uniform vec3 uInner, uMid, uOuter, uHalo, uRay; uniform vec2 uFocus;
      varying vec2 vUv;
      vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
      vec3 aces(vec3 c){
        const mat3 iM = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
        const mat3 oM = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
        c *= uExp / 0.6; c = iM * c; c = RRTAndODTFit(c); c = oM * c; return clamp(c, 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
      void main(){
        // one bilinear tap at the output pixel centre = a 2x2 box over the 2x source
        vec4 s = texture2D(tMap, vUv);
        vec2 p = vUv - uFocus;
        float r = length(p * vec2(1.0, 1.08));
        // backdrop: radial glow centred behind the head
        vec3 bg = mix(uInner, uMid, smoothstep(0.0, 0.42, r));
        bg = mix(bg, uOuter, smoothstep(0.3, 0.95, r));
        // soft god-rays fanning out from behind the head
        float a = atan(p.y, p.x);
        float ray = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(a * 9.0 + uSeed * 1.7)) * 0.6
                  + smoothstep(0.62, 1.0, 0.5 + 0.5 * sin(a * 14.0 - 1.3 + uSeed * 3.1)) * 0.4;
        ray *= smoothstep(0.04, 0.22, r) * (1.0 - smoothstep(0.3, 0.9, r));
        bg = mix(bg, uRay, clamp(ray * uRays, 0.0, 1.0));
        // sparkles: one per grid cell at most, small 4-point stars
        vec2 g = vUv * 9.0, id = floor(g), f = fract(g) - 0.5;
        float hs = hash(id);
        vec2 o = vec2(hash(id + 7.3), hash(id + 3.1)) - 0.5;
        vec2 d = (f - o * 0.6) * uOut / 9.0;  // in output pixels
        float star = max(0.0, 1.0 - abs(d.x) * 0.9 - abs(d.y) * 4.0) + max(0.0, 1.0 - abs(d.y) * 0.9 - abs(d.x) * 4.0);
        star = clamp(star, 0.0, 1.0) * step(0.62, hs) * (0.4 + 0.6 * hash(id + 1.9));
        star *= smoothstep(0.08, 0.3, r);
        bg += uHalo * star * uSpark;
        // halo hugging the silhouette (helps it read at 32-48 px)
        float h = 0.0;
        for (int i = 0; i < 12; i++) {
          float an = float(i) * 0.5236;
          vec2 dd = vec2(cos(an), sin(an));
          h += texture2D(tMap, vUv + dd * uPx * 4.0).a + texture2D(tMap, vUv + dd * uPx * 9.0).a * 0.6;
        }
        h = clamp(h / 12.0, 0.0, 1.0);
        bg = mix(bg, uHalo, h * 0.5);
        // vignette (coloured, never black)
        vec2 q = vUv - 0.5;
        float v = smoothstep(0.36, 0.78, length(q));
        bg *= mix(1.0, 0.66, v);
        vec3 c = s.a > 0.001 ? toSRGB(aces(s.rgb / s.a)) : vec3(0.0);
        c *= mix(1.0, 0.85, v);
        // the bust melts into the backdrop at the very bottom
        float fb = 1.0 - smoothstep(0.0, 0.17, vUv.y);
        c = mix(c, bg * 0.92, fb * 0.6);
        gl_FragColor = vec4(mix(bg, c, s.a), 1.0);
      }`,
  });
  quadScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), comp));
}

const facOf = (id) => (id.startsWith('hero:') ? id.split(':')[1] : UNITS[id]?.fac) || 'neutral';

function geometryFor(id) {
  if (geoLRU.has(id)) { const m = geoLRU.get(id); geoLRU.delete(id); geoLRU.set(id, m); return m; }
  let m;
  if (id.startsWith('hero:')) { const [, fac, col] = id.split(':'); m = heroModel(fac, col ? parseInt(col, 16) : undefined); }
  else m = modelOf(id);
  if (!m || !m.body) return m;
  geoLRU.set(id, m);
  while (geoLRU.size > 4) {
    const [k, old] = geoLRU.entries().next().value; geoLRU.delete(k);
    if (OPTS.dispose) { old.body.dispose(); old.glow?.dispose(); }
  }
  return m;
}

// ------------------------------------------------------------------ automatic framing
// Picks the vertices that make up the "bust" from the rig bones and a focus
// point (the face). Returns { pts: Vector3[], focus: Vector3, az, el }.
function bust(geo) {
  const P = geo.attributes.position.array, n = P.length / 3;
  const B = geo.attributes.aBone?.array, V = geo.attributes.aPivot?.array;
  const step = Math.max(1, Math.floor(n / 1500));
  const V3 = (i) => new T.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  let yMax = -Infinity, yMin = Infinity;
  for (let i = 0; i < n; i++) { const y = P[i * 3 + 1]; if (y > yMax) yMax = y; if (y < yMin) yMin = y; }
  // untagged: the top of the model
  if (!B) {
    const cut = yMax - (yMax - yMin) * 0.68, pts = [];
    for (let i = 0; i < n; i += step) if (P[i * 3 + 1] >= cut) pts.push(V3(i));
    const top = []; for (const p of pts) if (p.y > yMax - (yMax - yMin) * 0.25) top.push(p);
    return { pts, focus: centroid(top.length ? top : pts), az: 0.55, el: 0.1 };
  }
  const st = {};
  for (let i = 0; i < n; i++) {
    const b = B[i] | 0, y = P[i * 3 + 1];
    const s = st[b] || (st[b] = { n: 0, y0: Infinity, y1: -Infinity, pv: V ? [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]] : [0, 0, 0] });
    s.n++; if (y < s.y0) s.y0 = y; if (y > s.y1) s.y1 = y;
  }
  const has = (b) => (st[b]?.n || 0) > 0;
  const pick = (ok) => { const out = []; for (let i = 0; i < n; i += step) if (ok(B[i] | 0, P[i * 3], P[i * 3 + 1], P[i * 3 + 2])) out.push(V3(i)); return out; };
  const qy = (bone, t) => { const ys = []; for (let i = 0; i < n; i += step) if ((B[i] | 0) === bone) ys.push(P[i * 3 + 1]); ys.sort((a, b) => a - b); return ys[Math.round(t * (ys.length - 1))]; };
  const ARMS = (b) => b === BONE.ARM_L || b === BONE.ARM_R;

  // 1) mounted (cavalier, black knight, centaur, heroes): the rider
  if (has(BONE.RIDER)) {
    const pivY = st[BONE.RIDER].pv[1], top = qy(BONE.RIDER, 0.985);
    const cut = pivY + (top - pivY) * 0.22;
    const pts = pick((b, x, y) => b === BONE.RIDER && y >= cut); // arms carry lances: let them run off
    const head = pick((b, x, y) => b === BONE.RIDER && y >= top - (top - pivY) * 0.3);
    // the mount's head and neck (HEAD below the saddle) would hide the rider: drawn without them
    const hideMount = has(BONE.HEAD) && st[BONE.HEAD].pv[1] < pivY;
    return { pts, focus: centroid(head), az: 0.85, el: 0.12, hide: hideMount ? [BONE.HEAD] : null };
  }
  const quad = has(BONE.LEG_BL) || has(BONE.LEG_BR);
  const hasHead = has(BONE.HEAD), headPv = hasHead ? st[BONE.HEAD].pv : null;
  // 2) beasts (quadrupeds, dragons, hydra): head + forequarters
  if (hasHead && (quad || (headPv[2] > 0.18 && !has(BONE.ARM_L) && !has(BONE.ARM_R)))) {
    const bz = st[BONE.BODY]?.pv[2] ?? 0, by = st[BONE.BODY]?.pv[1] ?? 0;
    const headPts = pick((b) => b === BONE.HEAD);
    // the face: the head-bone vertices furthest out along the neck (forward + up)
    const sc = headPts.map((p) => p.z + p.y * 0.6).sort((a, b) => a - b), thr = sc[Math.floor(sc.length * 0.6)];
    const face = headPts.filter((p) => p.z + p.y * 0.6 >= thr);
    const pts = headPts.concat(pick((b, x, y, z) => b === BONE.BODY && z >= bz && y >= by - 0.05));
    return { pts, focus: centroid(face), az: 0.72, el: 0.12, beast: true };
  }
  // 3) humanoids (incl. legless spirits, medusa, efreet): head + chest
  if (hasHead && (has(BONE.ARM_L) || has(BONE.ARM_R) || has(BONE.LEG_FL))) {
    const neck = headPv[1], top = qy(BONE.HEAD, 0.97), hH = Math.max(0.12, top - neck);
    const cut = neck - Math.min(hH * 1.0, (neck - (st[BONE.BODY]?.pv[1] ?? neck - hH)) * 0.85);
    const keep = (b) => b === BONE.HEAD || b === BONE.BODY || ARMS(b) || b === BONE.CLOTH;
    const pts = pick((b, x, y) => keep(b) && y >= cut);
    const face = pick((b, x, y) => b === BONE.HEAD && y <= neck + hH * 0.85);
    return { pts, focus: centroid(face.length ? face : pts), az: 0.5, el: 0.06 };
  }
  // 4) anything else (beholder...): the whole figure, a bit from above
  const pts = pick((b, x, y) => b !== BONE.ROOT && y >= yMin + (yMax - yMin) * 0.15);
  const top = pts.filter((p) => p.y > yMax - (yMax - yMin) * 0.45);
  return { pts, focus: centroid(top.length ? top : pts), az: 0.45, el: 0.16 };
}

// a view of `g` without the triangles whose first vertex belongs to one of `bones`.
// It shares g's attribute buffers (never dispose it: that would free g's buffers too).
const views = new WeakMap();
function without(g, bones) {
  const B = g.attributes.aBone?.array;
  if (!B) return g;
  if (views.has(g)) return views.get(g);
  const src = g.index ? g.index.array : null, n = src ? src.length : g.attributes.position.count, keep = [];
  for (let i = 0; i + 2 < n; i += 3) { const a = src ? src[i] : i; if (!bones.includes(B[a] | 0)) keep.push(a, src ? src[i + 1] : i + 1, src ? src[i + 2] : i + 2); }
  const h = new T.BufferGeometry();
  for (const k in g.attributes) h.setAttribute(k, g.attributes[k]);
  h.setIndex(keep);
  views.set(g, h);
  return h;
}

function centroid(pts) { const c = new T.Vector3(); for (const p of pts) c.add(p); return pts.length ? c.divideScalar(pts.length) : c; }

// fit the camera: bust box fills the width, its top just under the frame,
// whatever lies below runs off the bottom edge (card-art crop)
function frameCamera(b, f) {
  const az = f.az ?? b.az, el = f.el ?? b.el;
  const dir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const right = new T.Vector3(0, 1, 0).cross(dir).normalize(), up = dir.clone().cross(right).normalize();
  const tanH = Math.tan(T.MathUtils.degToRad(cam.fov / 2));
  const padX = b.beast ? 0.16 : 0.12, padTop = b.beast ? 0.14 : 0.1, q = 0.035;
  const qa = (a, t) => a[Math.min(a.length - 1, Math.max(0, Math.round(t * (a.length - 1))))];
  const c = centroid(b.pts);
  let D = 3, box;
  const project = () => {
    const eye = c.clone().addScaledVector(dir, D), xs = [], ys = [];
    const pr = (p) => { const d = p.clone().sub(eye), depth = -d.dot(dir); return [d.dot(right) / depth, d.dot(up) / depth]; };
    for (const p of b.pts) { const [x, y] = pr(p); xs.push(x); ys.push(y); }
    xs.sort((a1, b1) => a1 - b1); ys.sort((a1, b1) => a1 - b1);
    const fp = pr(b.focus);
    return { xa: qa(xs, q), xb: qa(xs, 1 - q), ya: qa(ys, q), yb: qa(ys, 1 - q * 0.3), fx: fp[0], fy: fp[1] };
  };
  for (let pass = 0; pass < 4; pass++) {
    box = project();
    // horizontal: between the bust centre and the face; vertical: the box top under the frame
    const wf = b.beast ? 0.65 : 0.4, cx = (box.xa + box.xb) / 2 * (1 - wf) + box.fx * wf;
    const halfW = Math.max(cx - box.xa, box.xb - cx), hgt = box.yb - box.ya;
    const ext = Math.max(halfW / (1 - padX), hgt / (2 - padTop)) / (f.zoom || 1);
    const k = ext / tanH; // >1: too big -> move back
    const ty = box.yb - (1 - padTop) * tanH * k;   // target screen-y of the view centre (before rescale)
    c.addScaledVector(right, (cx - (f.dx || 0) * tanH * k) * D).addScaledVector(up, (ty - (f.dy || 0) * tanH * k) * D);
    D *= k;
  }
  cam.position.copy(c).addScaledVector(dir, D);
  cam.up.set(0, 1, 0);
  cam.lookAt(c);
  cam.near = D * 0.1; cam.far = D * 5; cam.updateProjectionMatrix();
  // lights relative to the view so every portrait is lit the same way
  const L = (l, x, y, z) => { l.position.copy(c).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(dir, z); l.target.position.copy(c); };
  L(keyL, -2.2, 2.6, 2.6); L(fillL, 3, -0.3, 2); L(rimL, 2.4, 1.6, -2.6); L(kickL, -2.6, 0.8, -2.4);
  // where the face lands in the image (uv), for the backdrop glow
  const fp = b.focus.clone().project(cam);
  return new T.Vector2(T.MathUtils.clamp(fp.x * 0.5 + 0.5, 0.25, 0.75), T.MathUtils.clamp(fp.y * 0.5 + 0.5, 0.4, 0.82));
}

// ------------------------------------------------------------------ render
function renderPortrait(id, size, shape) {
  const pr = Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) * (OPTS.scale ?? 1));
  const N = Math.max(16, Math.round(size * pr)), S = N * (OPTS.ss || 2);
  if (!rtScene) {
    rtScene = new T.WebGLRenderTarget(S, S, { type: T.HalfFloatType, samples: 4, depthBuffer: true });
    rtOut = new T.WebGLRenderTarget(N, N, { depthBuffer: false });
  }
  if (rtScene.width !== S) rtScene.setSize(S, S);
  if (rtOut.width !== N) rtOut.setSize(N, N);
  const fac = facOf(id), isHero = id.startsWith('hero:'), U = UNITS[id], isUp = !!U?.up;
  const pal = PAL[fac] || PAL.neutral;
  const heroCol = isHero && id.split(':')[2] ? parseInt(id.split(':')[2], 16) : null;
  const f = FRAME[id] || (U?.up && FRAME[U.up]) || {};
  const t0 = performance.now();
  const m = geometryFor(id);
  if (!m || !m.body) return '';
  const t1 = performance.now();
  const b = bust(m.body);
  const view = (g) => (g && b.hide ? without(g, b.hide) : g);
  const meshes = [new T.Mesh(view(m.body), bodyMat)];
  if (m.glow) meshes.push(new T.Mesh(view(m.glow), glowMat));
  meshes.forEach((x) => { x.frustumCulled = false; scene.add(x); });
  kickL.color.setRGB(...hex(heroCol ?? pal.kick));
  const focus = frameCamera(b, shape === 'round' ? { ...f, zoom: (f.zoom || 1) * 1.18 } : f);
  const t2 = performance.now();

  // save renderer state
  const prevRT = R.getRenderTarget(), prevAuto = R.autoClear, prevCC = R.getClearColor(new T.Color()), prevCA = R.getClearAlpha();
  const prevSM = R.shadowMap.autoUpdate; R.shadowMap.autoUpdate = false;
  R.autoClear = true; R.setClearColor(0x000000, 0);
  R.setRenderTarget(rtScene); R.clear(); R.render(scene, cam);
  const u = comp.uniforms;
  u.tMap.value = rtScene.texture; u.uPx.value = 1 / S; u.uOut.value = N; u.uFocus.value.copy(focus);
  u.uInner.value.set(...hex(isUp ? UPGLOW : pal.inner)); u.uMid.value.set(...hex(pal.mid));
  u.uOuter.value.set(...hex(pal.outer)); u.uHalo.value.set(...hex(pal.halo)); u.uRay.value.set(...hex(isUp ? 0xffe68a : pal.ray));
  u.uRays.value = isUp || isHero ? 0.42 : 0.26;
  u.uSpark.value = T.MathUtils.clamp((N - 56) / 90, 0, 1) * (isUp || isHero ? 0.75 : 0.45);
  let seed = 0; for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 997; u.uSeed.value = seed * 0.37;
  R.setRenderTarget(rtOut); R.render(quadScene, quadCam);
  const px = new Uint8Array(N * N * 4);
  R.readRenderTargetPixels(rtOut, 0, 0, N, N, px);
  const t3 = performance.now();
  R.setRenderTarget(prevRT); R.autoClear = prevAuto; R.setClearColor(prevCC, prevCA); R.shadowMap.autoUpdate = prevSM;
  meshes.forEach((x) => scene.remove(x));

  // to a 2D canvas (flip rows), then the frame and marks
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), row = N * 4;
  for (let y = 0; y < N; y++) img.data.set(px.subarray((N - 1 - y) * row, (N - y) * row), y * row);
  ctx.putImageData(img, 0, 0);
  decorate(ctx, N, shape, { up: isUp, heroCol: isHero ? (heroCol ?? null) : undefined, pal });
  const url = cv.toDataURL('image/png');
  if (OPTS.profile) (globalThis.__portraitProfile ||= []).push({ id, N, model: t1 - t0, frame: t2 - t1, gpu: t3 - t2, encode: performance.now() - t3 });
  return url;
}

// ------------------------------------------------------------------ frame, star, hero plate
function framePath(ctx, N, shape, inset) {
  ctx.beginPath();
  if (shape === 'round') { ctx.arc(N / 2, N / 2, N / 2 - inset, 0, Math.PI * 2); return; }
  const r = Math.max(1, N * 0.15 - inset * 0.8), a = inset, b = N - inset;
  ctx.moveTo(a + r, a); ctx.arcTo(b, a, b, b, r); ctx.arcTo(b, b, a, b, r); ctx.arcTo(a, b, a, a, r); ctx.arcTo(a, a, b, a, r); ctx.closePath();
}

function decorate(ctx, N, shape, o) {
  const s = N / 64;
  ctx.save();
  if (shape === 'round') { // transparent corners
    ctx.globalCompositeOperation = 'destination-in'; framePath(ctx, N, shape, 0); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  }
  // hero: a player-colour plate along the bottom, inside the frame
  if (o.heroCol !== undefined) {
    const col = o.heroCol ?? 0xc8a050, hgt = N * 0.15, y0 = N - hgt;
    ctx.save(); framePath(ctx, N, shape, 0); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, N);
    g.addColorStop(0, shade(col, 1.25)); g.addColorStop(0.45, css(col)); g.addColorStop(1, shade(col, 0.55));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, y0 + hgt * 0.35); ctx.quadraticCurveTo(N / 2, y0 - hgt * 0.25, N, y0 + hgt * 0.35); ctx.lineTo(N, N); ctx.lineTo(0, N); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = Math.max(1, 1.2 * s);
    ctx.beginPath(); ctx.moveTo(0, y0 + hgt * 0.35); ctx.quadraticCurveTo(N / 2, y0 - hgt * 0.25, N, y0 + hgt * 0.35); ctx.stroke();
    // a gold boss in the middle
    const gx = N / 2, gy = y0 + hgt * 0.1, gr = Math.max(1.5, 2.6 * s);
    const gg = ctx.createRadialGradient(gx - gr * 0.3, gy - gr * 0.3, 0, gx, gy, gr);
    gg.addColorStop(0, '#fffbe0'); gg.addColorStop(0.5, '#f2c550'); gg.addColorStop(1, '#8a5a1a');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // darken the margin outside the gold frame a touch so the frame reads
  const inset = Math.max(1, N * 0.045), lw = Math.max(1, N * 0.026);
  ctx.save(); framePath(ctx, N, shape, 0); framePath2(ctx, N, shape, inset); ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.fill('evenodd'); ctx.restore();
  // the gold frame: dark keyline, gold gradient, light inner hairline
  framePath(ctx, N, shape, inset);
  ctx.strokeStyle = 'rgba(48,24,6,0.55)'; ctx.lineWidth = lw + Math.max(1, N * 0.016); ctx.stroke();
  const g = ctx.createLinearGradient(0, 0, N * 0.3, N);
  g.addColorStop(0, '#fff4c0'); g.addColorStop(0.25, '#f2c550'); g.addColorStop(0.55, '#b07a24'); g.addColorStop(0.8, '#f6d070'); g.addColorStop(1, '#9a6420');
  ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.stroke();
  if (N >= 80) { framePath(ctx, N, shape, inset + lw * 0.9); ctx.strokeStyle = 'rgba(255,240,190,0.35)'; ctx.lineWidth = Math.max(0.75, N * 0.006); ctx.stroke(); }
  if (o.up) star(ctx, N, shape === 'round' ? N * 0.2 : inset + N * 0.12, shape === 'round' ? N * 0.2 : inset + N * 0.12);
  ctx.restore();
}
function framePath2(ctx, N, shape, inset) { // appends a second sub-path (for evenodd fills)
  if (shape === 'round') { ctx.moveTo(N - inset, N / 2); ctx.arc(N / 2, N / 2, N / 2 - inset, 0, Math.PI * 2); return; }
  const r = Math.max(1, N * 0.15 - inset * 0.8), a = inset, b = N - inset;
  ctx.moveTo(a + r, a); ctx.arcTo(b, a, b, b, r); ctx.arcTo(b, b, a, b, r); ctx.arcTo(a, b, a, a, r); ctx.arcTo(a, a, b, a, r); ctx.closePath();
}
function shade(h, k) { const [r, g, b] = hex(h).map((v) => Math.round(Math.min(1, v * k) * 255)); return `rgb(${r},${g},${b})`; }

// gold five-point star with a white glint: marks upgraded creatures
function star(ctx, N, cx, cy) {
  const R1 = Math.max(3.2, N * 0.095), R2 = R1 * 0.48;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R2 : R1; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(70,34,6,0.75)'; ctx.lineWidth = Math.max(1.2, R1 * 0.32); ctx.stroke();
  const g = ctx.createRadialGradient(cx - R1 * 0.25, cy - R1 * 0.35, 0, cx, cy, R1);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, '#ffd64a'); g.addColorStop(1, '#d08a1a');
  ctx.fillStyle = g; ctx.fill();
  // glint: thin 4-point sparkle on the upper-right tip
  const gx = cx + R1 * 0.55, gy = cy - R1 * 0.55, L = R1 * 0.95, w = Math.max(0.6, R1 * 0.13);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.moveTo(gx - L, gy); ctx.lineTo(gx, gy - w); ctx.lineTo(gx + L, gy); ctx.lineTo(gx, gy + w); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(gx, gy - L); ctx.lineTo(gx + w, gy); ctx.lineTo(gx, gy + L); ctx.lineTo(gx - w, gy); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ public API
/** Cached dataURL of the portrait of `id` at `size` CSS px (rendered at device pixel ratio, max 2x). */
export function portrait(id, size = 64, shape = 'square') {
  if (!R || !id) return '';
  const key = id + '@' + size + (shape === 'round' ? 'r' : '');
  let u = cache.get(key);
  if (u === undefined) {
    try { u = renderPortrait(id, size, shape); } catch (e) { console.warn('portrait', id, e); u = ''; }
    cache.set(key, u);
  }
  return u;
}

/** '<img>' HTML for templates; '' when portraits are unavailable (fall back to the emoji). */
export function portraitImg(id, size = 64, cls = 'pt') {
  const u = portrait(id, size);
  if (!u) return '';
  const name = id.startsWith('hero:') ? 'Hero' : (UNITS[id]?.name || id);
  return `<img class="${cls}" src="${u}" width="${size}" height="${size}" alt="${name}" draggable="false">`;
}

const heroId = (fac, color) => {
  const c = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
  return `hero:${fac}` + (Number.isFinite(c) ? ':' + (c >>> 0).toString(16).padStart(6, '0') : '');
};
/** Cached dataURL of a hero bust (the faction's hero model, banner in `color`). */
export function heroPortrait(fac, color, size = 64, shape = 'square') { return portrait(heroId(fac, color), size, shape); }

/** '<img>' HTML of a hero bust: faction backdrop, player-colour plate. color: 0xrrggbb or '#rrggbb'. */
export function heroPortraitImg(fac, color, size = 64, cls = 'pt hero', shape = 'square') {
  const u = heroPortrait(fac, color, size, shape);
  if (!u) return '';
  return `<img class="${cls}" src="${u}" width="${size}" height="${size}" alt="Hero" draggable="false">`;
}

/** Warm the cache a few portraits at a time when the browser is idle. Hero ids: 'hero:<fac>:<rrggbb>'. */
export function preloadPortraits(ids, size = 64) {
  const todo = ids.filter((id) => !cache.has(id + '@' + size));
  const idle = globalThis.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 50));
  const run = (dl) => { while (todo.length && dl.timeRemaining() > 4) portrait(todo.shift(), size); if (todo.length) idle(run); };
  if (todo.length) idle(run);
}

/** Drop cached images (e.g. after a device-pixel-ratio change). */
export function clearPortraits() {
  cache.clear();
  if (OPTS.dispose) for (const m of geoLRU.values()) { m.body.dispose(); m.glow?.dispose(); }
  geoLRU.clear();
}
