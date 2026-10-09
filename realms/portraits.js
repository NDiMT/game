// =====================================================================
// Hex Realms: creature and hero portraits for the UI.
// Renders the real 3D models (3/4 view, studio light, faction-coloured
// radial backdrop, soft light halo, vignette) into small cached images.
//
//   initPortraits(THREE, renderer, modelFn, opts?)  once, after the renderer exists
//   portrait(id, size = 64)      -> dataURL string (cached) | '' if not initialised
//   portraitImg(id, size = 64, cls = 'pt') -> '<img ...>' HTML string | '' if not ready
//   preloadPortraits(ids, size)  warms the cache in idle time (optional)
//
// ids: every key of data.js UNITS (upgraded ones get the base model, a richer
// backdrop and a gold chevron), plus heroes: 'hero:haven', 'hero:necro',
// optionally with a banner colour: 'hero:haven:3a7aff'.
//
// Cost: one off-screen render at the output size (MSAA) + one composite pass
// on the game's own renderer (no extra WebGL context), one 8-bit readback,
// one toDataURL. Each (id, size) pair is rendered once, on first request.
// =====================================================================
import { UNITS } from './data.js?v=1.3';
import { heroModel } from './models_towns.js?v=1.3';
import { makeBodyMaterial, makeGlowMaterial } from './materials.js?v=1.3';

// backdrop palettes, sRGB 0..1: inner glow, mid, outer, halo (light behind the silhouette)
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const PAL = {
  haven: { inner: 0xfff0b8, mid: 0x6aa8f0, outer: 0x2a56b0, halo: 0xfff6d8, rim: 0xffe2a0 },
  necro: { inner: 0xc8f5a0, mid: 0x8a5ac8, outer: 0x3e2468, halo: 0xd8ffc0, rim: 0xb8ff9a },
  neutral: { inner: 0xffe6a8, mid: 0xc09a5a, outer: 0x6e5232, halo: 0xfff0c8, rim: 0xffd8a0 },
};
const PAL_UP = {
  haven: { inner: 0xfff8d0, mid: 0xf0c860, outer: 0x2a56b0, halo: 0xffffff, rim: 0xffe8a8 },
  necro: { inner: 0xe0ffb8, mid: 0x6ac870, outer: 0x4a2478, halo: 0xeaffd8, rim: 0xc8ffa8 },
};

// framing per id. crop: fraction of model height (from the top) to fit, front: keep
// only the front part (fraction of depth from the back) for long beasts, az: camera
// azimuth (rad, + = viewer sees the creature's right side), el: elevation, pad: margin.
const FRAME_DEFAULT = { crop: 0.68, front: 0, az: 0.62, el: 0.2, pad: 0.1, dy: 0, q: 0.04 };
const FRAME = {
  // haven
  pikeman: { crop: 0.72, q: 0.03 }, griffin: { crop: 0.8, front: 0.3 }, cavalier: { crop: 0.66, front: 0.2, q: 0.03 }, angel: { crop: 0.78, az: 0.35, q: 0.05 },
  // necro
  zombie: { crop: 0.7 }, wight: { crop: 0.7 }, blackknight: { crop: 0.62, front: 0.25 }, bonedragon: { crop: 0.85, front: 0.3, q: 0.04 },
  // neutral
  goblin: { crop: 0.7 }, wolf: { crop: 0.9, front: 0.4, az: 0.85 }, ogre: { crop: 0.6 }, troll: { crop: 0.6 },
  cyclops: { crop: 0.55 }, hydra: { crop: 0.7, front: 0.1 },
  // heroes (mounted, with a banner): the rider
  hero: { crop: 0.5, front: 0.25, q: 0.08, pad: 0.1 },
};

let T = null, R = null, modelOf = null, OPTS = {};
let scene, cam, bodyMat, glowMat, keyL, fillL, rimL, quadScene, quadCam, comp, rtScene, rtOut;
const cache = new Map();

export function initPortraits(THREE, renderer, modelFn, opts = {}) {
  T = THREE; R = renderer; modelOf = modelFn; OPTS = { dispose: true, ...opts };
  scene = new T.Scene();
  cam = new T.PerspectiveCamera(24, 1, 0.05, 50);
  bodyMat = makeBodyMaterial(T, { ao: 0.25, rim: 0.55, hemi: 0.18 });
  glowMat = makeGlowMaterial(T, { pulse: 0 });
  // studio light: warm key from upper front-left, cool soft fill, coloured back rim
  keyL = new T.DirectionalLight(0xfff2dc, 2.6);
  fillL = new T.DirectionalLight(0xc8dcff, 0.9);
  rimL = new T.DirectionalLight(0xffffff, 2.2);
  scene.add(keyL, fillL, rimL, keyL.target, fillL.target, rimL.target, new T.HemisphereLight(0xeaf2ff, 0x8a6a4a, 1.25));
  quadScene = new T.Scene();
  quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  comp = new T.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      tMap: { value: null }, uPx: { value: 1 / 64 }, uExp: { value: 1.15 },
      uInner: { value: new T.Vector3() }, uMid: { value: new T.Vector3() }, uOuter: { value: new T.Vector3() }, uHalo: { value: new T.Vector3() },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tMap; uniform float uPx, uExp;
      uniform vec3 uInner, uMid, uOuter, uHalo;
      varying vec2 vUv;
      vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
      vec3 aces(vec3 c){
        const mat3 iM = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
        const mat3 oM = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
        c *= uExp / 0.6; c = iM * c; c = RRTAndODTFit(c); c = oM * c; return clamp(c, 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
      void main(){
        vec4 s = texture2D(tMap, vUv);
        // backdrop: radial gradient centred a little above the middle
        vec2 p = vUv - vec2(0.5, 0.56);
        float r = length(p * vec2(1.0, 1.05));
        vec3 bg = mix(uInner, uMid, smoothstep(0.0, 0.36, r));
        bg = mix(bg, uOuter, smoothstep(0.3, 0.78, r));
        // soft light halo hugging the silhouette (helps it read at 32 px)
        float h = 0.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 0.5236;
          vec2 o = vec2(cos(a), sin(a));
          h += texture2D(tMap, vUv + o * uPx * 2.5).a + texture2D(tMap, vUv + o * uPx * 5.5).a * 0.6;
        }
        h = clamp(h / 12.0, 0.0, 1.0);
        bg = mix(bg, uHalo, h * 0.55);
        // vignette (coloured, never black)
        vec2 q = vUv - 0.5;
        float v = smoothstep(0.42, 0.78, length(q));
        bg *= mix(1.0, 0.72, v);
        vec3 c = s.a > 0.001 ? toSRGB(aces(s.rgb / s.a)) : vec3(0.0);
        c *= mix(1.0, 0.86, v);
        gl_FragColor = vec4(mix(bg, c, s.a), 1.0);
      }`,
  });
  quadScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), comp));
}

const facOf = (id) => (id.startsWith('hero:') ? id.split(':')[1] : UNITS[id]?.fac) || 'neutral';

function geometryFor(id) {
  if (id.startsWith('hero:')) {
    const [, fac, col] = id.split(':');
    return heroModel(fac, col ? parseInt(col, 16) : undefined);
  }
  return modelOf(id);
}

// world-space points (body vertices) -> camera placement that fits them tightly
function frameCamera(geo, f) {
  const pos = geo.attributes.position.array, n = pos.length / 3;
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) { const y = pos[i * 3 + 1], z = pos[i * 3 + 2]; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const yCut = y1 - (y1 - y0) * f.crop, zCut = z0 + (z1 - z0) * f.front;
  const dir = new T.Vector3(Math.sin(f.az) * Math.cos(f.el), Math.sin(f.el), Math.cos(f.az) * Math.cos(f.el));
  const right = new T.Vector3(0, 1, 0).cross(dir).normalize(), up = dir.clone().cross(right).normalize();
  const step = Math.max(1, Math.floor(n / 1500)), pts = [];
  for (let i = 0; i < n; i += step) { const y = pos[i * 3 + 1], z = pos[i * 3 + 2]; if (y >= yCut && z >= zCut) pts.push(new T.Vector3(pos[i * 3], y, z)); }
  if (!pts.length) for (let i = 0; i < n; i += step) pts.push(new T.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  // centre on the extents in screen axes, then solve the distance (two passes for perspective)
  const tanH = Math.tan(T.MathUtils.degToRad(cam.fov / 2)) * (1 - f.pad);
  const c = new T.Vector3(); for (const p of pts) c.add(p); c.divideScalar(pts.length);
  // fit on vertex quantiles, not extremes: thin props (pikes, staffs, banners,
  // wing tips) may run off the frame so the face stays big
  const qa = (a, t) => a[Math.min(a.length - 1, Math.max(0, Math.round(t * (a.length - 1))))];
  let D = 3;
  for (let pass = 0; pass < 3; pass++) {
    const xs = [], ys = [];
    const eye = c.clone().addScaledVector(dir, D);
    for (const p of pts) {
      const d = p.clone().sub(eye), depth = -d.dot(dir);
      xs.push(d.dot(right) / depth); ys.push(d.dot(up) / depth);
    }
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
    const xa = qa(xs, f.q), xb = qa(xs, 1 - f.q), ya = qa(ys, f.q * 2), yb = qa(ys, 1 - f.q * 0.25);
    // shift the target so the projected box is centred, then rescale distance
    const sx = (xa + xb) / 2, sy = (ya + yb) / 2 + f.dy * (yb - ya);
    c.addScaledVector(right, sx * D).addScaledVector(up, sy * D);
    const ext = Math.max(xb - xa, yb - ya) / 2;
    D *= ext / tanH;
  }
  cam.position.copy(c).addScaledVector(dir, D);
  cam.up.set(0, 1, 0);
  cam.lookAt(c);
  cam.near = D * 0.2; cam.far = D * 4; cam.updateProjectionMatrix();
  // lights relative to the view so every portrait is lit the same way
  const L = (l, x, y, z) => { l.position.copy(c).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(dir, z); l.target.position.copy(c); };
  L(keyL, -2, 3, 3); L(fillL, 3, 0.5, 2); L(rimL, 1.5, 2, -3);
}

function renderPortrait(id, size) {
  const pr = Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) * (OPTS.scale ?? 1));
  const N = Math.max(16, Math.round(size * pr));
  if (!rtScene) {
    rtScene = new T.WebGLRenderTarget(N, N, { type: T.HalfFloatType, samples: 4, depthBuffer: true });
    rtOut = new T.WebGLRenderTarget(N, N, { depthBuffer: false });
  }
  if (rtScene.width !== N) { rtScene.setSize(N, N); rtOut.setSize(N, N); }
  const fac = facOf(id), isUp = !!UNITS[id]?.up, isHero = id.startsWith('hero:');
  const pal = (isUp && PAL_UP[fac]) || PAL[fac] || PAL.neutral;
  const f = { ...FRAME_DEFAULT, ...(FRAME[isHero ? 'hero' : (UNITS[id]?.up || id)] || {}) };
  const m = geometryFor(id);
  if (!m || !m.body) return '';
  const meshes = [new T.Mesh(m.body, bodyMat)];
  if (m.glow) meshes.push(new T.Mesh(m.glow, glowMat));
  meshes.forEach((x) => scene.add(x));
  rimL.color.setRGB(...hex(pal.rim));
  frameCamera(m.body, f);

  // save renderer state
  const prevRT = R.getRenderTarget(), prevAuto = R.autoClear, prevCC = R.getClearColor(new T.Color()), prevCA = R.getClearAlpha();
  const prevSM = R.shadowMap.autoUpdate; R.shadowMap.autoUpdate = false;
  R.autoClear = true; R.setClearColor(0x000000, 0);
  R.setRenderTarget(rtScene); R.clear(); R.render(scene, cam);
  comp.uniforms.tMap.value = rtScene.texture; comp.uniforms.uPx.value = 1 / N;
  comp.uniforms.uInner.value.set(...hex(pal.inner)); comp.uniforms.uMid.value.set(...hex(pal.mid));
  comp.uniforms.uOuter.value.set(...hex(pal.outer)); comp.uniforms.uHalo.value.set(...hex(pal.halo));
  R.setRenderTarget(rtOut); R.render(quadScene, quadCam);
  const px = new Uint8Array(N * N * 4);
  R.readRenderTargetPixels(rtOut, 0, 0, N, N, px);
  R.setRenderTarget(prevRT); R.autoClear = prevAuto; R.setClearColor(prevCC, prevCA); R.shadowMap.autoUpdate = prevSM;

  meshes.forEach((x) => scene.remove(x));
  if (OPTS.dispose) { m.body.dispose(); m.glow?.dispose(); }

  // to a 2D canvas (flip rows), add the upgrade chevron, encode
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), row = N * 4;
  for (let y = 0; y < N; y++) img.data.set(px.subarray((N - 1 - y) * row, (N - y) * row), y * row);
  ctx.putImageData(img, 0, 0);
  if (isUp) chevron(ctx, N);
  return cv.toDataURL('image/png');
}

// small gold double chevron, top-left, marks upgraded creatures
function chevron(ctx, N) {
  const s = N / 64, x = 4 * s, y = 4 * s;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const path = (dy) => { ctx.moveTo(x, y + 7 * s + dy); ctx.lineTo(x + 5 * s, y + 2 * s + dy); ctx.lineTo(x + 10 * s, y + 7 * s + dy); };
  ctx.beginPath(); path(0); path(5 * s);
  ctx.strokeStyle = 'rgba(70,40,10,0.55)'; ctx.lineWidth = 4.2 * s; ctx.stroke();
  ctx.strokeStyle = '#ffd34a'; ctx.lineWidth = 2.4 * s; ctx.stroke();
  ctx.restore();
}

/** Cached dataURL of the portrait of `id` at `size` CSS px (rendered at device pixel ratio, max 2x). */
export function portrait(id, size = 64) {
  if (!R || !id) return '';
  const key = id + '@' + size;
  let u = cache.get(key);
  if (u === undefined) {
    try { u = renderPortrait(id, size); } catch (e) { console.warn('portrait', id, e); u = ''; }
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

/** Warm the cache a few portraits at a time when the browser is idle. */
export function preloadPortraits(ids, size = 64) {
  const todo = ids.filter((id) => !cache.has(id + '@' + size));
  const idle = globalThis.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 50));
  const run = (dl) => { while (todo.length && dl.timeRemaining() > 4) portrait(todo.shift(), size); if (todo.length) idle(run); };
  if (todo.length) idle(run);
}

/** Drop cached images (e.g. after a device-pixel-ratio change). */
export function clearPortraits() { cache.clear(); }
