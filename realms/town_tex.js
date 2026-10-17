// =====================================================================
// HEX REALMS: town-screen surface textures (round 4).
// Small procedural greyscale patterns, generated once and shared by every town:
//   atlas  RGBA 128 px: R rough stone bricks, G roof tiles / shingles, B wood planks
//   ground RGBA 128 px: R grass / ash tufts, G ashlar / flagstones
// tagTownTex(geo, fac) gives each triangle of a building an `aTex` id (0 = plain paint) from its colour (the faction
// palette below) and its slope; townMaterial() wraps the painted body material so it multiplies the albedo with the
// pattern, projected per face (rows always horizontal, so bricks and tiles line up on any wall or roof).
// The look stays painted: the pattern only modulates the value (+-25%) and fades out when a building is small on screen.
// =====================================================================

const N = 256; // pattern space (px); the textures are baked at R px
const R = 128;
const cache = new Map();
const fract = (x) => x - Math.floor(x);
const h2 = (i, j, s = 0) => { // integer hash (much cheaper than sin-hash on phones)
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
function vn(x, y, s, per) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const w = (i, j) => h2(((i % per) + per) % per, ((j % per) + per) % per, s);
  const a = w(ix, iy), b = w(ix + 1, iy), c = w(ix, iy + 1), d = w(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// tileable fbm (period = per cells at the base octave)
const fbm = (x, y, s, per) => (vn(x, y, s, per) * 0.55 + vn(x * 2, y * 2, s + 3, per * 2) * 0.3 + vn(x * 4, y * 4, s + 7, per * 4) * 0.15);

// each pattern: (x, y) in px [0, N) -> 0..1 (0.5 = unchanged albedo)
function bricks(x, y) {
  const rows = 8, rh = N / rows, row = Math.floor(y / rh), bw = N / 4;
  const xo = x + (row % 2) * bw * 0.5, col = Math.floor(xo / bw) % 4;
  const fx = xo - Math.floor(xo / bw) * bw, fy = y - row * rh;
  const ex = Math.min(fx, bw - fx), ey = Math.min(fy, rh - fy), e = Math.min(ex, ey);
  const tone = 0.5 + (h2(col, row, 1) - 0.5) * 0.32;
  if (e < 2.4) return 0.2; // mortar joint
  let v = tone + (fbm(x / 16, y / 16, 2, 16) - 0.5) * 0.22;
  if (fy < 3.5) v += 0.1 * (1 - fy / 3.5); // lit top bevel
  if (rh - fy < 3) v -= 0.12; // shadowed underside
  if (e < 3.2) v -= 0.08;
  return v;
}
function tiles(x, y) {
  // overlapping rows of round-bottomed tiles: dark gap under each row's lip, light towards the lip
  const rows = 8, rh = N / rows, row = Math.floor(y / rh), tw = N / 8;
  const xo = x + (row % 2) * tw * 0.5, col = Math.floor(xo / tw);
  const fx = (xo - col * tw) / tw - 0.5, fy = (y - row * rh) / rh; // fy 0 = top (under the row above), 1 = lip
  const lip = 0.78 + 0.22 * Math.sqrt(Math.max(0, 1 - (fx * 2) ** 2)); // rounded bottom edge
  if (fy > lip) return 0.2 + (fy - lip) * 0.6; // shadow under the lip, on the row below
  let v = 0.34 + fy * 0.34 + (h2(col, row, 4) - 0.5) * 0.18;
  if (Math.abs(fx) > 0.46) v -= 0.16; // seam between tiles
  v += (fbm(x / 12, y / 12, 5, 21) - 0.5) * 0.12;
  return v;
}
function planks(x, y) {
  const n = 8, pw = N / n, i = Math.floor(x / pw), fx = x - i * pw;
  const off = h2(i, 0, 7) * N, j = Math.floor((y + off) / (N / 2)), fy = (y + off) % (N / 2);
  if (fx < 2.2 || fy < 2) return 0.18; // gaps and end joints
  let v = 0.5 + (h2(i, j, 8) - 0.5) * 0.26;
  v += Math.sin((y / N) * 6.283 * 3 + vn(x / 6, y / 40, 9, 64) * 5 + i) * 0.06; // grain
  v += (vn(x / 2, y / 24, 11, 128) - 0.5) * 0.14;
  if (fx < 4) v -= 0.08; // board edge
  if (fx > pw - 3) v += 0.05;
  return v;
}
function ashlar(x, y) {
  const rows = 4, rh = N / rows, row = Math.floor(y / rh), bw = N / 2;
  const xo = x + (row % 2) * bw * 0.5 + (row === 3 ? bw * 0.25 : 0), col = Math.floor(xo / bw) % 2;
  const fx = xo - Math.floor(xo / bw) * bw, fy = y - row * rh, e = Math.min(fx, bw - fx, fy, rh - fy);
  if (e < 2) return 0.28;
  let v = 0.5 + (h2(col, row, 13) - 0.5) * 0.14 + (fbm(x / 22, y / 22, 14, 12) - 0.5) * 0.16;
  if (fy < 3) v += 0.06;
  return v;
}
function grass(x, y) {
  // soft tufts: blotchy mid-scale variation plus fine short blade strokes
  let v = 0.5 + (fbm(x / 32, y / 32, 21, 8) - 0.5) * 0.4;
  const cx = Math.floor(x / 8), cy = Math.floor(y / 8);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const gx = cx + dx, gy = cy + dy, px = (gx + h2(gx, gy, 22)) * 8, py = (gy + h2(gx, gy, 23)) * 8;
    let ddx = x - px; ddx -= Math.round(ddx / N) * N;
    let ddy = y - py; ddy -= Math.round(ddy / N) * N;
    const d = Math.hypot(ddx * 1.6, ddy * 0.7);
    if (d < 4) v += (h2(gx, gy, 24) < 0.5 ? 0.13 : -0.13) * (1 - d / 4);
  }
  return v;
}

function bake(T, fns) {
  const data = new Uint8Array(R * R * 4), ch = fns.length, sc = N / R;
  const raw = fns.map(() => new Float32Array(R * R));
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) fns.forEach((f, c) => { raw[c][y * R + x] = f((x + 0.5) * sc, (y + 0.5) * sc); });
  // normalise every channel to a 0.5 mean, so the average albedo is kept
  raw.forEach((a, c) => {
    let m = 0; for (let i = 0; i < a.length; i++) m += a[i]; m /= a.length;
    for (let i = 0; i < a.length; i++) data[i * 4 + c] = Math.max(0, Math.min(255, Math.round((a[i] - m + 0.5) * 255)));
  });
  for (let c = ch; c < 4; c++) for (let i = 0; i < R * R; i++) data[i * 4 + c] = c === 3 ? 255 : 128;
  const t = new T.DataTexture(data, R, R, T.RGBAFormat);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
// (no pattern in the alpha channel: alpha is the one channel drivers / uploads may treat specially)
export function townAtlas(T) { if (!cache.has('atlas')) cache.set('atlas', bake(T, [bricks, tiles, planks])); return cache.get('atlas'); }
export function groundTex(T) { if (!cache.has('ground')) cache.set('ground', bake(T, [grass, ashlar])); return cache.get('ground'); }

/** a small tileable cobblestone canvas (for the painted town floor), cached: stones in `cols`, joints in `joint` */
export function cobbleCanvas(cols, joint, size = 96) {
  const key = 'cob:' + cols.join() + joint;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), D = img.data;
  const cell = size / 6, pts = [];
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) pts.push([(i + 0.2 + h2(i, j, 31) * 0.6) * cell, (j + 0.2 + h2(i, j, 32) * 0.6) * cell, h2(i, j, 33)]);
  const rgb = cols.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const jr = [parseInt(joint.slice(1, 3), 16), parseInt(joint.slice(3, 5), 16), parseInt(joint.slice(5, 7), 16)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let d1 = 1e9, d2 = 1e9, best = 0;
    for (let k = 0; k < pts.length; k++) {
      let dx = x - pts[k][0], dy = y - pts[k][1];
      dx -= Math.round(dx / size) * size; dy -= Math.round(dy / size) * size;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d;
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1), s = rgb[Math.floor(pts[best][2] * rgb.length) % rgb.length];
    const k = 0.62 + 0.38 * (edge < 1.4 ? 0 : Math.min(1, (edge - 1.4) / 2.5)), lit = 0.94 + 0.08 * Math.min(1, edge / 9);
    const o = (y * size + x) * 4;
    for (let q = 0; q < 3; q++) D[o + q] = Math.round(jr[q] + (s[q] * lit - jr[q]) * k);
    D[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

// ------------------------------------------------------------------ which pattern goes where
// faction palette colour -> texture id (1 bricks, 2 tiles, 3 planks, 4 ashlar); colours listed as 0 stay plain
const TEXPAL = {
  haven: { 0xf4efe2: 4, 0xe9e1cf: 1, 0xd9cfb8: 0, 0xc9cfe4: 1, 0x3b74ec: 2, 0x2f62d6: 2, 0x5b8ff8: 2, 0xffc63a: 0, 0xe0a428: 0, 0x2f63e6: 0, 0xe0412f: 2,
    0xffffff: 0, 0xb07a44: 3, 0x8a5a34: 3, 0xfcf4e2: 4, 0xe2cfa2: 0, 0xd8ccb4: 4, 0x86c650: 0, 0xeac862: 2, 0xc89a40: 2, 0xdfe6f0: 0, 0x5fae3c: 0 },
  necro: { 0x948aaa: 1, 0xb2a6c2: 1, 0x7a6e92: 1, 0xccc0d8: 0, 0x62528a: 2, 0x7a68a4: 2, 0xf4ead2: 0, 0xcdbd9c: 0, 0xd8283e: 0, 0xa41e32: 0,
    0x6c6484: 0, 0x8a6a52: 3, 0x6c523f: 3, 0x8e8576: 0, 0x968ca0: 4, 0x8a7258: 0, 0x86a862: 0, 0x4a3c5e: 3 },
  sylvan: { 0xb27a42: 3, 0xcc955a: 3, 0x956034: 3, 0xe2b070: 3, 0xf0ca8e: 3, 0xb27c48: 3, 0x9a6a3e: 3, 0xe8e0c8: 1, 0xd2c9aa: 1, 0x8fcc52: 0, 0x6cb240: 0,
    0x45b845: 2, 0x76cc4e: 2, 0x34a040: 2, 0xffc63a: 0, 0xe0a428: 0, 0x58bf3e: 0, 0x80d452: 0, 0x2fb84a: 0, 0xf6f3ea: 4, 0xd8b07e: 0, 0xeadcb0: 0, 0xd9d0b0: 4,
    0xf2d462: 2, 0xe8483a: 0, 0xe6b02c: 0 },
  inferno: { 0xd8705a: 1, 0xc25e4a: 1, 0xe8876a: 1, 0x8e4250: 1, 0xa8505a: 1, 0xf2ac6a: 0, 0xb8282e: 2, 0x962234: 2, 0xe0442e: 2, 0xffc23a: 0, 0xe39a2a: 0,
    0xf6e4c0: 0, 0xd2b08a: 0, 0xa8705e: 0, 0xe0302a: 0, 0xb27462: 4, 0xd49a72: 0, 0xff6ab4: 0, 0xb04a78: 0, 0xb06a44: 3, 0x8a4a34: 3 },
  dungeon: { 0xcdbcf0: 1, 0xb6a2e2: 1, 0xf0e8ff: 0, 0x9474d4: 1, 0x8a56ea: 2, 0x7848d8: 2, 0x9c6cf2: 2, 0x2fc8be: 0, 0x1fa49e: 0, 0xffc63a: 0, 0x8e96e2: 0,
    0xaeb6f4: 0, 0x7c80d6: 0, 0x7656b4: 3, 0x9a7aa8: 3, 0x7a5c94: 3, 0xa84ad8: 0, 0xe85cb6: 0, 0x36c6c0: 0, 0xf4eadc: 0, 0xb9acd6: 4, 0xd0c4e8: 0, 0xd2ccd8: 4 },
};
const palCache = new Map();
function palette(key, map) {
  // vertex colours are linear (THREE.Color converts sRGB hex on input), so the palette is linearised too
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  if (!palCache.has(key)) palCache.set(key, Object.entries(map).map(([h, id]) => { const v = +h; return [lin(((v >> 16) & 255) / 255), lin(((v >> 8) & 255) / 255), lin((v & 255) / 255), id]; }));
  return palCache.get(key);
}
/** register an extra colour -> id table (e.g. the environment's cottages) under `key` */
export function texPalette(key, map) { palCache.delete(key); TEXPAL[key] = map; }

/**
 * Tag a merged, non-indexed body geometry with a per-vertex `aTex` id. Returns the geometry (converted to
 * non-indexed when needed). Small triangles (props, trims) and plain colours stay 0.
 */
export function tagTownTex(geo, key) {
  if (!geo || !geo.attributes.color) return geo;
  if (geo.index) geo = geo.toNonIndexed();
  const pal = palette(key, TEXPAL[key] || {});
  const P = geo.attributes.position.array, Cc = geo.attributes.color.array, n = P.length / 9;
  const A = new Float32Array(n * 3);
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2];
    const vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1], vz = P[o + 8] - P[o + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx, cl = Math.hypot(cx, cy, cz);
    const area = cl / 2;
    if (area < 0.004) continue;
    const ny = Math.abs(cy / cl);
    const r = (Cc[o] + Cc[o + 3] + Cc[o + 6]) / 3, g = (Cc[o + 1] + Cc[o + 4] + Cc[o + 7]) / 3, b = (Cc[o + 2] + Cc[o + 5] + Cc[o + 8]) / 3;
    let best = 0, bd = 0.13;
    for (const [pr, pg, pb, id] of pal) {
      const k = Math.min(1.5, Math.max(0.55, (r * pr + g * pg + b * pb) / (pr * pr + pg * pg + pb * pb + 1e-6)));
      const d = Math.hypot(r - k * pr, g - k * pg, b - k * pb) / (Math.hypot(r, g, b) + 0.05);
      if (d < bd) { bd = d; best = id; }
    }
    if (!best) continue;
    let id = best;
    if (ny > 0.93) id = id === 3 ? 3 : id === 2 ? 0 : (area > 0.03 ? 4 : 0); // flat tops: flagstones / boards, never tiles
    else if (ny < 0.3 && id === 2) id = 0; // roof colour on an upright face: cloth or trim, keep it plain
    A[t * 3] = A[t * 3 + 1] = A[t * 3 + 2] = id;
  }
  geo.setAttribute('aTex', new geo.attributes.position.constructor(A, 1)); // (a THREE.BufferAttribute; no THREE import here)
  return geo;
}

/**
 * Wrap a painted body material (materials.js makeBodyMaterial) so it multiplies the albedo with the town patterns.
 * opts: k (strength, 0.5), scale (pattern repeats per local unit, 0.85), def (id used where aTex is 0/missing: 0 = plain,
 * 5 = grass from the ground texture), gscale (ground pattern repeats per unit).
 */
export function townMaterial(T, mat, opts = {}) {
  const U = {
    uTownTex: { value: null }, uTownTex2: { value: null }, // baked on the first compile (keeps them off the boot path)
    uTexK: { value: opts.k ?? 0.5 }, uTexScale: { value: opts.scale ?? 0.85 }, uTexDef: { value: opts.def ?? 0 }, uTex2Scale: { value: opts.gscale ?? 0.6 },
  };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    U.uTownTex.value ||= townAtlas(T); U.uTownTex2.value ||= groundTex(T);
    Object.assign(sh.uniforms, U);
    if (!sh.vertexShader.includes('vObjPos = position;') || !sh.fragmentShader.includes('hxSmallL = hxSmall;')) return; // materials.js changed: plain look
    sh.vertexShader = 'attribute float aTex;\nvarying float vTexId;\n' + sh.vertexShader.replace('vObjPos = position;', 'vObjPos = position;\nvTexId = aTex;');
    sh.fragmentShader = 'uniform sampler2D uTownTex, uTownTex2;\nuniform float uTexK, uTexScale, uTexDef, uTex2Scale;\nvarying float vTexId;\n' + sh.fragmentShader.replace('hxSmallL = hxSmall;', `hxSmallL = hxSmall;
{
  float tid = vTexId > 0.5 ? floor(vTexId + 0.5) : uTexDef;
  vec3 tN = cross(dFdx(vObjPos), dFdy(vObjPos));
  tN /= max(length(tN), 1e-9);
  float tHl = length(tN.xz);
  vec2 tHd = tN.xz / max(tHl, 1e-4);
  vec2 tuv = abs(tN.y) > 0.93 ? vObjPos.xz : vec2(dot(vObjPos.xz, vec2(-tHd.y, tHd.x)), -vObjPos.y / max(tHl, 0.35)); // texture rows run top-down
  vec3 tA = texture2D(uTownTex, tuv * uTexScale).rgb;
  vec2 tG = texture2D(uTownTex2, tuv * (tid > 4.5 ? uTex2Scale : uTexScale)).rg;
  float tP = tid < 0.5 ? 0.5 : tid < 1.5 ? tA.r : tid < 2.5 ? tA.g : tid < 3.5 ? tA.b : tid < 4.5 ? tG.g : tG.r;
  diffuseColor.rgb *= 1.0 + (tP - 0.5) * 2.0 * uTexK * (1.0 - 0.25 * hxSmall);
}`);
  };
  const key = mat.customProgramCacheKey?.() || '';
  mat.customProgramCacheKey = () => key + '|town1';
  mat.userData.townU = U;
  mat.needsUpdate = true;
  return mat;
}
