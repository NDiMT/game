// Look: procedural textures (generated once, cached), materials, sky/backdrop/ground, lights,
// PMREM environment and a small HDR post pipeline (bloom + ACES + grading).
import * as THREE from 'three';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- noise
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, period, seed = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const P = (a) => ((a % period) + period) % period;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(P(xi), P(yi), seed), b = hash(P(xi + 1), P(yi), seed), c = hash(P(xi), P(yi + 1), seed), d = hash(P(xi + 1), P(yi + 1), seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, period, oct = 4, seed = 1) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, period * f, seed + i); n += a; a *= 0.5; f *= 2; }
  return s / n;
}

// build color / normal / roughness textures from per-pixel functions
function maps(w, h, fn, { normal = 1.5, rough = true, repeat = false } = {}) {
  const col = new Uint8ClampedArray(w * h * 4), H = new Float32Array(w * h), R = new Uint8ClampedArray(w * h * 4);
  const out = { r: 0, g: 0, b: 0, h: 0, ro: 0.8, a: 1 };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    out.a = 1;
    fn(x, y, out);
    const i = y * w + x;
    col[i * 4] = out.r * 255; col[i * 4 + 1] = out.g * 255; col[i * 4 + 2] = out.b * 255; col[i * 4 + 3] = out.a * 255;
    H[i] = out.h;
    R[i * 4] = R[i * 4 + 1] = R[i * 4 + 2] = out.ro * 255; R[i * 4 + 3] = 255;
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.flipY = false;
    t.needsUpdate = true;
    return t;
  };
  const res = { map: tex(col, true) };
  if (normal) {
    const N = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xm = repeat ? (x - 1 + w) % w : Math.max(0, x - 1), xp = repeat ? (x + 1) % w : Math.min(w - 1, x + 1);
      const ym = repeat ? (y - 1 + h) % h : Math.max(0, y - 1), yp = repeat ? (y + 1) % h : Math.min(h - 1, y + 1);
      const dx = (H[y * w + xp] - H[y * w + xm]) * normal, dy = (H[yp * w + x] - H[ym * w + x]) * normal;
      const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
      N[i] = (-dx / l * 0.5 + 0.5) * 255; N[i + 1] = (dy / l * 0.5 + 0.5) * 255; N[i + 2] = (1 / l * 0.5 + 0.5) * 255; N[i + 3] = 255;
    }
    res.normalMap = tex(N, false);
  }
  if (rough) res.roughnessMap = tex(R, false);
  return res;
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
const C = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------- fake glass
// Transparent standard material whose alpha rises with a fresnel term and whose specular (env
// reflections, sun glints) is NOT faded by alpha (premultiplied blending). Cheap, readable anywhere.
export function makeGlass(opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.25, depthWrite: false, premultipliedAlpha: true, envMapIntensity: 1.6, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <premultiplied_alpha_fragment>', '')
      .replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 3.0);
        float ga = clamp(mix(diffuseColor.a, 1.0, fres * 0.85), 0.0, 1.0);
        gl_FragColor = vec4(totalDiffuse * ga + totalSpecular * (1.0 + 2.5 * fres) + totalEmissiveRadiance, ga);`);
  };
  m.customProgramCacheKey = () => 'fakeglass' + (opts.map ? 'm' : '');
  return m;
}

export function buildMaterials(renderer) {
  // bricks: bevelled edges read as mortar joints, speckles, chips; colour comes from instance tint
  const brick = maps(128, 64, (x, y, o) => {
    const ex = Math.min(x, 127 - x) / 6, ey = Math.min(y, 63 - y) / 6, e = clamp(Math.min(ex, ey), 0, 1);
    const n = fbm(x / 16, y / 16, 64, 4, 3), sp = hash(x, y, 7);
    const chip = fbm(x / 9, y / 9, 64, 2, 11) > 0.72 ? 0.25 : 0;
    const v = 0.78 + n * 0.25 - (sp > 0.93 ? 0.18 : 0) - chip * 0.6 - (1 - e) * 0.22;
    o.r = o.g = o.b = clamp(v, 0, 1);
    o.h = e * 0.9 + n * 0.25 - chip;
    o.ro = 0.82 + n * 0.15;
  }, { normal: 3 });
  // crate: planks with grain, frame and diagonal brace, nails
  const crate = maps(256, 256, (x, y, o) => {
    const frame = x < 26 || x > 229 || y < 26 || y > 229;
    const dd = Math.abs((255 - y) - x) / Math.SQRT2, brace = !frame && dd < 14;
    const plank = Math.floor(y / 64), gap = !frame && !brace && y % 64 < 3;
    const gx = brace ? (x + y) * 0.7 : frame && (x < 26 || x > 229) ? y : x;
    const gy = brace ? (x - y) : frame && (x < 26 || x > 229) ? x : y + plank * 37;
    const grain = fbm(gx / 90, gy / 5, 1024, 4, frame ? 5 : brace ? 9 : 2 + plank);
    const ring = Math.sin(gy / 3.2 + grain * 9) * 0.5 + 0.5;
    let v = 0.68 + grain * 0.25 + ring * 0.08;
    if (frame || brace) v *= 0.82;
    if (gap) v *= 0.45;
    const nail = (frame && (Math.hypot((x % 229) - 13, (y % 229) - 13) < 4));
    o.r = clamp(v * 0.95, 0, 1); o.g = clamp(v * 0.68, 0, 1); o.b = clamp(v * 0.42, 0, 1);
    if (nail) { o.r = o.g = o.b = 0.25; }
    o.h = (frame || brace ? 0.8 : 0.4) + ring * 0.15 - (gap ? 0.5 : 0);
    o.ro = 0.72 + grain * 0.2;
  }, { normal: 2.5 });
  const plank = maps(256, 64, (x, y, o) => {
    const grain = fbm(x / 70, y / 4, 1024, 4, 21);
    const ring = Math.sin(y / 2.6 + grain * 10) * 0.5 + 0.5;
    const e = Math.min(y, 63 - y) < 3 ? 0.8 : 1;
    const v = (0.72 + grain * 0.22 + ring * 0.08) * e;
    o.r = clamp(v, 0, 1); o.g = clamp(v * 0.74, 0, 1); o.b = clamp(v * 0.5, 0, 1);
    o.h = ring * 0.3 + grain * 0.2 + (e < 1 ? -0.3 : 0);
    o.ro = 0.7 + grain * 0.2;
  }, { normal: 2 });
  const brushed = maps(256, 256, (x, y, o) => {
    const s = fbm(x / 160, y / 1.2, 512, 3, 31), sc = hash(x >> 3, y, 4) > 0.996 ? 0.25 : 0;
    const v = 0.72 + s * 0.2 + sc;
    o.r = v; o.g = v * 1.01; o.b = v * 1.03;
    o.h = s * 0.3; o.ro = 0.22 + s * 0.2 - sc * 0.4;
  }, { normal: 0.6 });
  // painted metal: scratches + edge wear show bare steel (lower roughness)
  const scratchMask = (x, y, w, h) => {
    let s = 0;
    for (let k = 0; k < 14; k++) {
      const ax = hash(k, 1, 77) * w, ay = hash(k, 2, 77) * h, ang = hash(k, 3, 77) * 6.28, len = 10 + hash(k, 4, 77) * 50;
      const dx = x - ax, dy = y - ay, t = dx * Math.cos(ang) + dy * Math.sin(ang), d = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
      if (t > 0 && t < len && d < 0.8) s = 1;
    }
    return s;
  };
  const paintMaps = (w, h, ribs) => maps(w, h, (x, y, o) => {
    const n = fbm(x / 20, y / 20, 128, 3, 41), sc = scratchMask(x, y, w, h);
    let rib = 0;
    if (ribs) for (const r of [0.04, 0.3, 0.68, 0.94]) rib = Math.max(rib, 1 - Math.abs(y / h - r) * 40);
    const v = 1 - rib * 0.25 - n * 0.06;
    o.r = o.g = o.b = sc ? 0.7 : clamp(v, 0, 1);
    o.a = sc ? 0 : 1; // alpha marks bare metal (used as mix in color only)
    o.h = rib * 0.6 + n * 0.1 - sc * 0.2;
    o.ro = sc ? 0.25 : 0.42 + n * 0.12;
    o.a = 1;
  }, { normal: 2 });
  const barrelPM = paintMaps(128, 256, true), panelPM = paintMaps(128, 128, false);
  const crackTex = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineCap = 'round';
    const cx = w * (0.4 + Math.random() * 0.2), cy = h * (0.4 + Math.random() * 0.2);
    for (let i = 0; i < 13; i++) {
      let x = cx, y = cy, a = (i / 13) * 6.283 + Math.random() * 0.4;
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 9; k++) { a += (Math.random() - 0.5) * 0.5; x += Math.cos(a) * 18; y += Math.sin(a) * 18; g.lineTo(x, y); }
      g.stroke();
    }
    for (let r = 20; r < 120; r += 28 + Math.random() * 20) { g.lineWidth = 1; g.beginPath(); for (let k = 0; k <= 20; k++) { const a = (k / 20) * 6.283, rr = r * (0.8 + Math.random() * 0.4); k ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke(); }
  });
  const glassTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.7);
    const gr = g.createLinearGradient(0, -40, 0, 40);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-90, -26, 180, 14); g.fillRect(-90, 6, 180, 5);
    g.restore();
    g.strokeStyle = 'rgba(235,250,255,1)'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, w - 5, h - 5);
  });
  const grille = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#2a2c30'; g.fillRect(0, 0, w, h); g.fillStyle = '#0c0d0f'; for (let y = 6; y < h; y += 8) for (let x = 6; x < w; x += 8) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } });
  const sign = canvasTex(256, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#ffe2b8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d4202a'; g.font = '900 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('COLD DRINKS', w / 2, h / 2 + 2);
  });
  const veneer = maps(128, 128, (x, y, o) => {
    const grain = fbm(x / 60, y / 3, 512, 4, 61), ring = Math.sin(y / 2 + grain * 12) * 0.5 + 0.5;
    const v = 0.5 + grain * 0.2 + ring * 0.1;
    o.r = v * 0.95; o.g = v * 0.62; o.b = v * 0.36; o.h = ring * 0.2; o.ro = 0.5;
  }, { normal: 1 });

  const M = {
    brick: new THREE.MeshStandardMaterial({ ...brick, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: 0 }),
    crate: new THREE.MeshStandardMaterial({ ...crate, roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ ...plank, roughness: 1 }),
    glass: makeGlass({ map: glassTex, opacity: 0.35 }),
    bottle: makeGlass({ opacity: 0.62, roughness: 0.06, side: THREE.DoubleSide }),
    shard: makeGlass({ opacity: 0.45, side: THREE.DoubleSide, envMapIntensity: 2.2 }),
    glassPart: makeGlass({ opacity: 0.3, color: 0xe4f6ff }),
    glassPartFlat: makeGlass({ map: glassTex, opacity: 0.3, color: 0xe4f6ff }),
    glassDark: makeGlass({ opacity: 0.75, color: 0x1d2a36, envMapIntensity: 2 }),
    glassCracked: makeGlass({ map: crackTex, opacity: 0.55, color: 0x2a3a48, envMapIntensity: 2 }),
    steel: new THREE.MeshStandardMaterial({ ...brushed, metalness: 1, roughness: 1, color: 0xd5dbe2 }),
    steelBrushed: new THREE.MeshStandardMaterial({ ...brushed, metalness: 0.9, roughness: 1, color: 0xc9ced4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x30343b, metalness: 0.9, roughness: 0.35 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8edf2, metalness: 1, roughness: 0.12 }),
    enamel: new THREE.MeshPhysicalMaterial({ color: 0xf3f5f7, roughness: 0.35, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, normalMap: panelPM.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }),
    panelDark: new THREE.MeshPhysicalMaterial({ color: 0x24272c, roughness: 0.45, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    panelLight: new THREE.MeshPhysicalMaterial({ color: 0xdfe3e8, roughness: 0.4, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    plasticWood: new THREE.MeshPhysicalMaterial({ ...veneer, roughness: 1, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.9 }),
    cavity: new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.7 }),
    grille: new THREE.MeshStandardMaterial({ map: grille, roughness: 0.6 }),
    screen: new THREE.MeshPhysicalMaterial({ color: 0x0b1018, roughness: 0.1, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0x0b1a2c, emissiveIntensity: 0.7 }),
    screenCracked: new THREE.MeshPhysicalMaterial({ color: 0x0b1018, roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.2, emissive: 0xffffff, emissiveMap: crackTex, emissiveIntensity: 0.55 }),
    sign: new THREE.MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 1.6, roughness: 0.4 }),
    husk: new THREE.MeshPhysicalMaterial({ color: 0x47423d, roughness: 0.85, metalness: 0.45, normalMap: panelPM.normalMap, clearcoat: 0.2 }),
    ball: new THREE.MeshPhysicalMaterial({ color: 0xff4636, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    bowl: new THREE.MeshPhysicalMaterial({ color: 0x2d52e0, roughness: 0.15, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
    bomb: new THREE.MeshPhysicalMaterial({ color: 0x1d1f24, roughness: 0.45, metalness: 0.4, clearcoat: 0.5 }),
    hole: new THREE.MeshBasicMaterial({ color: 0x080b1c }),
    projBrick: new THREE.MeshStandardMaterial({ ...brick, color: 0xc4573a, roughness: 1 }),
  };
  M.rubble = M.brick;
  M.bottleMesh = M.bottle;
  M.fridgeMats = M.enamel;
  const cache = new Map();
  M.paint = (kind, col) => {
    const key = kind + col;
    let m = cache.get(key);
    if (!m) {
      if (kind === 'barrel') m = new THREE.MeshPhysicalMaterial({ color: col, map: barrelPM.map, normalMap: barrelPM.normalMap, roughnessMap: barrelPM.roughnessMap, roughness: 1, metalness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      else if (kind === 'can') m = new THREE.MeshPhysicalMaterial({ map: canTex(col), metalness: 0.75, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
      else m = new THREE.MeshPhysicalMaterial({ color: col, normalMap: panelPM.normalMap, roughnessMap: panelPM.roughnessMap, roughness: 1, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.12 });
      cache.set(key, m);
    }
    return m;
  };
  M.allPaint = () => [...cache.values()];
  return M;
}
function canTex(col) {
  const hex = '#' + new THREE.Color(col).getHexString();
  return canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.fillRect(0, h * 0.36, w, h * 0.28);
    g.fillStyle = hex; g.font = '900 13px system-ui, sans-serif'; g.textBaseline = 'middle';
    for (let x = 4; x < w; x += 64) g.fillText('FIZZ', x, h / 2 + 1);
    g.fillStyle = '#c3c9d0'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 7, w, 2);
  });
}

// ---------------------------------------------------------------- sprites textures
export function puffTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = w / 2 + (Math.random() - 0.5) * 22, y = h / 2 + (Math.random() - 0.5) * 22, r = 10 + Math.random() * 12;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }, false);
}

// ---------------------------------------------------------------- world: sky, ground, backdrop, lights, env
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FS = `
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uLow; uniform vec3 uSun; uniform vec3 uSunCol; uniform sampler2D uClouds; uniform float uT; uniform float uCloudOn;
uniform float uGlow; uniform float uStars; uniform vec3 uCloudTint;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHor, uTop, pow(smoothstep(-0.02, 0.45, h), 0.75));
  col = mix(col, uLow, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, uSun), 0.0);
  col += uSunCol * (smoothstep(0.9993, 0.9997, s) * 7.0 + (pow(s, 14.0) * 0.28 + pow(s, 4.0) * 0.1 + pow(s, 120.0) * 0.6) * uGlow);
  if (uStars > 0.0 && h > 0.0) {
    vec3 sd = d * 230.0; vec3 id = floor(sd);
    float hs = fract(sin(dot(id, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float st = step(0.9965, hs) * smoothstep(0.42, 0.0, length(fract(sd) - 0.5));
    col += vec3(0.9, 0.95, 1.0) * st * uStars * (0.55 + 0.45 * sin(uT * 3000.0 * hs + hs * 50.0)) * smoothstep(0.02, 0.2, h) * 1.6;
  }
  if (h > 0.0 && uCloudOn > 0.0) {
    float u = atan(d.x, -d.z) / 6.28318 + 0.5 + uT;
    vec4 c = texture2D(uClouds, vec2(u * 2.0, clamp(h * 2.6, 0.0, 1.0)));
    vec3 cc = mix(uHor * 0.85, vec3(1.08, 1.04, 1.0), c.r) * uCloudTint + uSunCol * pow(s, 4.0) * 0.45 * uGlow;
    col = mix(col, cc, c.a * smoothstep(0.0, 0.06, h) * uCloudOn);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function cloudTexture() {
  return canvasTex(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const cx = Math.random() * w, cy = h * (0.15 + Math.random() * 0.5), sc = 0.5 + Math.random();
      for (let k = 0; k < 14; k++) {
        const x = cx + (Math.random() - 0.5) * 120 * sc, y = cy + (Math.random() - 0.5) * 18 * sc, r = (14 + Math.random() * 26) * sc;
        for (const xx of [x, x - w, x + w]) {
          const gr = g.createRadialGradient(xx, y, 0, xx, y, r);
          gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.6, 'rgba(235,240,248,0.25)'); gr.addColorStop(1, 'rgba(220,228,240,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(xx, y, r, 0, 7); g.fill();
        }
      }
    }
  }, false);
}

// base world: sky dome, light rig and bomb flash. Themes (themes.js) recolour it and own ground/backdrop.
export function buildWorld(renderer, scene) {
  const clouds = cloudTexture();
  clouds.wrapS = THREE.RepeatWrapping;
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: C(0x2a7fe6) }, uHor: { value: C(0xd6e9f6) }, uLow: { value: C(0x9fbf8a) }, uSun: { value: new THREE.Vector3(0.45, 0.7, 0.55).normalize() }, uSunCol: { value: C(0xfff0d6) },
      uClouds: { value: clouds }, uT: { value: 0 }, uCloudOn: { value: 1 }, uGlow: { value: 1 }, uStars: { value: 0 }, uCloudTint: { value: C(0xffffff) } },
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  scene.fog = new THREE.Fog(0xcfe2ef, 30, 130);
  const hemi = new THREE.HemisphereLight(0xc4dcff, 0x8a7a62, 0.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2c0, 3.0);
  sun.position.set(0.45, 0.7, 0.55).normalize().multiplyScalar(12);
  sun.target.position.set(0, 0.8, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4.2, right: 4.2, top: 4.4, bottom: -3.4, near: 2, far: 28 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0xa8ccff, 0.9);
  rim.position.set(-5, 4, -7);
  scene.add(rim);
  const flash = new THREE.PointLight(0xffa860, 0, 12, 2);
  scene.add(flash);
  return { sky, skyMat, sun, hemi, rim, flash };
}

// ---------------------------------------------------------------- post: HDR -> bloom -> ACES + grade
const FS_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
export class Post {
  constructor(renderer) {
    this.r = renderer;
    const opt = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.a4 = new THREE.WebGLRenderTarget(4, 4, opt); this.b4 = new THREE.WebGLRenderTarget(4, 4, opt);
    this.a8 = new THREE.WebGLRenderTarget(4, 4, opt); this.b8 = new THREE.WebGLRenderTarget(4, 4, opt);
    const mk = (fs, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: FS_VS, fragmentShader: fs, depthTest: false, depthWrite: false, toneMapped: false });
    this.bright = mk(`uniform sampler2D t; uniform vec2 px; uniform float thr; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv + px * vec2(-1.0,-1.0)).rgb + texture2D(t, vUv + px * vec2(1.0,-1.0)).rgb + texture2D(t, vUv + px * vec2(-1.0,1.0)).rgb + texture2D(t, vUv + px * vec2(1.0,1.0)).rgb;
      c *= 0.25; float l = max(c.r, max(c.g, c.b)); float k = clamp((l - thr) / max(l, 1e-4), 0.0, 1.0); gl_FragColor = vec4(min(c * k, vec3(24.0)), 1.0); }`, { t: { value: null }, px: { value: new THREE.Vector2() }, thr: { value: 1.0 } });
    this.blur = mk(`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227;
      c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * 0.316;
      c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * 0.070;
      gl_FragColor = vec4(c, 1.0); }`, { t: { value: null }, dir: { value: new THREE.Vector2() } });
    this.copy = mk(`uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.0); }`, { t: { value: null } });
    this.comp = mk(`uniform sampler2D t; uniform sampler2D b4; uniform sampler2D b8; uniform float bloom; uniform float expo; uniform float time; varying vec2 vUv;
      vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){ const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
        const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
        c = I * (c / 0.6); c = RRTAndODTFit(c); return clamp(O * c, 0.0, 1.0); }
      vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec3 c = texture2D(t, vUv).rgb;
        c += (texture2D(b4, vUv).rgb * 0.55 + texture2D(b8, vUv).rgb * 0.75) * bloom;
        c = aces(c * expo);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, 1.07);
        c += vec3(0.012, 0.004, -0.01) * smoothstep(0.4, 1.0, l) + vec3(-0.006, 0.0, 0.012) * (1.0 - smoothstep(0.0, 0.35, l));
        c = srgb(clamp(c, 0.0, 1.0));
        c += (fract(sin(dot(gl_FragCoord.xy + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`, { t: { value: null }, b4: { value: null }, b8: { value: null }, bloom: { value: 0.65 }, expo: { value: 0.88 }, time: { value: 0 } });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copy);
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene();
    this.qs.add(this.quad);
    this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h, samples) {
    this.rtScene.setSize(w, h);
    if (this.rtScene.samples !== samples) { this.rtScene.samples = samples; this.rtScene.dispose(); }
    const w4 = Math.max(1, w >> 2), h4 = Math.max(1, h >> 2), w8 = Math.max(1, w >> 3), h8 = Math.max(1, h >> 3);
    this.a4.setSize(w4, h4); this.b4.setSize(w4, h4); this.a8.setSize(w8, h8); this.b8.setSize(w8, h8);
    this.w = w; this.h = h;
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.qc); }
  render(scene, camera, t) {
    const r = this.r;
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);
    this.bright.uniforms.t.value = this.rtScene.texture;
    this.bright.uniforms.px.value.set(1 / this.w, 1 / this.h);
    this.pass(this.bright, this.a4);
    this.blur.uniforms.t.value = this.a4.texture; this.blur.uniforms.dir.value.set(1 / this.a4.width, 0); this.pass(this.blur, this.b4);
    this.blur.uniforms.t.value = this.b4.texture; this.blur.uniforms.dir.value.set(0, 1 / this.a4.height); this.pass(this.blur, this.a4);
    this.copy.uniforms.t.value = this.a4.texture; this.pass(this.copy, this.a8);
    this.blur.uniforms.t.value = this.a8.texture; this.blur.uniforms.dir.value.set(1 / this.a8.width, 0); this.pass(this.blur, this.b8);
    this.blur.uniforms.t.value = this.b8.texture; this.blur.uniforms.dir.value.set(0, 1 / this.a8.height); this.pass(this.blur, this.a8);
    const u = this.comp.uniforms;
    u.t.value = this.rtScene.texture; u.b4.value = this.a4.texture; u.b8.value = this.a8.texture; u.time.value = t % 100;
    this.pass(this.comp, null);
  }
}
