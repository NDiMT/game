// =====================================================================
// Hex Realms: shared materials.
// Gives UV-less, vertex-coloured, flat-shaded models a painted look:
//  - object-space planar-projected procedural detail (grain, brush streaks,
//    colour blotches) from ONE shared 256² tileable noise texture, 2 lookups
//  - light, lilac-tinted fake ambient occlusion near y = 0 (never a black band)
//  - lifted darks: dark albedos keep their hue, unlit sides get a coloured fill
//  - warm sunny rim light and colourful sky/ground bounce along the model's up
//  - an emissive hit flash (makeHitMaterial) sharing the same shader program
// Works with Mesh and InstancedMesh, casts/receives shadows normally.
// Call tick(seconds) once per frame to drive the glow pulse.
// =====================================================================

import { ANIM, BONE } from './rig.js';

const shared = { uTime: { value: 0 }, uNoise: { value: null }, T: null };

// ---------------------------------------------------------------- noise texture
// R: fine isotropic grain (stone / plaster)  G: vertical brush/wood streaks
// B: big soft blotches (paint colour variation). All tile seamlessly.
function makeNoiseTexture(THREE) {
  const N = 256, cvs = document.createElement('canvas');
  cvs.width = cvs.height = N;
  const ctx = cvs.getContext('2d'), img = ctx.createImageData(N, N), d = img.data;
  let s = 1337;
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lat = new Float32Array(256 * 256).map(rnd);
  // periodic value noise, period px by py lattice cells over the texture
  const vn = (x, y, px, py, o) => {
    const fx = x / N * px, fy = y / N * py, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const L = (i, j) => lat[((((j % py) + py) % py + o) & 255) * 256 + ((((i % px) + px) % px + o * 7) & 255)];
    const a = L(ix, iy), b = L(ix + 1, iy), c = L(ix, iy + 1), e = L(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
  };
  const fbm = (x, y, px, py, oct, o) => { let v = 0, a = 0.5, t = 0; for (let k = 0; k < oct; k++) { v += a * vn(x, y, px << k, py << k, o + k * 13); t += a; a *= 0.5; } return v / t; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    const grain = fbm(x, y, 16, 16, 4, 3) * 0.7 + rnd() * 0.3;
    const streak = fbm(x, y, 32, 4, 3, 41) * 0.75 + vn(x, y, 64, 8, 77) * 0.25;
    const blot = fbm(x, y, 4, 4, 3, 101);
    const c = (v) => Math.max(0, Math.min(255, Math.round(((v - 0.5) * 1.6 + 0.5) * 255)));
    d[i] = c(grain); d[i + 1] = c(streak); d[i + 2] = c(blot); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 2;
  return tex;
}
export function noiseTexture(THREE) {
  if (!shared.uNoise.value) shared.uNoise.value = makeNoiseTexture(THREE);
  return shared.uNoise.value;
}

// ---------------------------------------------------------------- form normals
// Every model kit (models.js kit/done, the units_* / models_* kits) merges NON-INDEXED parts and
// calls computeVertexNormals(), so the `normal` attribute is a per-face normal, and the material is
// flatShading anyway. At 30-90 px that turns every facet of a head, belly or barrel into its own
// tone. The `formNormal` attribute below is the smooth counterpart the shader blends in.
/**
 * Adds a `formNormal` attribute: smooth, crease-aware vertex normals. Corners that share a
 * position are averaged over the faces around them whose normal is within `creaseDeg` of their
 * own face, so balls / eggs / limbs / lathes / cones with >= 6 sides become smooth volumes, while
 * boxes, roofs, plates, 4-5 sided spikes and gems keep their hard edges. Parts that merely overlap
 * stay separate (they do not share exact vertices). The body material computes this lazily the
 * first time a geometry is drawn; call it at load time to move that one-off cost (~1-5 ms per model).
 * Returns the geometry.
 */
export function addFormNormals(geo, creaseDeg = 66) {
  const P = geo && geo.attributes.position;
  if (!P) return geo;
  const idx = geo.index, nv = P.count, nt = Math.floor((idx ? idx.count : nv) / 3);
  const vi = idx ? (t, c) => idx.getX(t * 3 + c) : (t, c) => t * 3 + c;
  const fn = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
    const ax = P.getX(a), ay = P.getY(a), az = P.getZ(a);
    const ux = P.getX(b) - ax, uy = P.getY(b) - ay, uz = P.getZ(b) - az, wx = P.getX(c) - ax, wy = P.getY(c) - ay, wz = P.getZ(c) - az;
    const x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx, l = Math.hypot(x, y, z) || 1;
    fn[t * 3] = x / l; fn[t * 3 + 1] = y / l; fn[t * 3 + 2] = z / l;
  }
  // triangle corners grouped by quantised position
  const q = 1e4, groups = new Map(), ckey = new Array(nt * 3);
  for (let t = 0; t < nt; t++) for (let c = 0; c < 3; c++) {
    const v = vi(t, c), k = Math.round(P.getX(v) * q) + ',' + Math.round(P.getY(v) * q) + ',' + Math.round(P.getZ(v) * q);
    ckey[t * 3 + c] = k;
    let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(t);
  }
  const cs = Math.cos(creaseDeg * Math.PI / 180), out = new Float32Array(nv * 3);
  for (let t = 0; t < nt; t++) for (let c = 0; c < 3; c++) {
    const g = groups.get(ckey[t * 3 + c]), v = vi(t, c), fx = fn[t * 3], fy = fn[t * 3 + 1], fz = fn[t * 3 + 2];
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < g.length; i++) {
      const o = g[i] * 3, d = fn[o] * fx + fn[o + 1] * fy + fn[o + 2] * fz;
      // indexed geometry shares the vertex between faces: no crease split possible, plain average
      if (idx || d >= cs) { x += fn[o]; y += fn[o + 1]; z += fn[o + 2]; }
    }
    const l = Math.hypot(x, y, z);
    if (l < 1e-4) { x = fx; y = fy; z = fz; } else { x /= l; y /= l; z /= l; }
    out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z;
  }
  const BA = shared.T ? shared.T.BufferAttribute : (P.isInterleavedBufferAttribute ? null : P.constructor);
  if (BA) geo.setAttribute('formNormal', new BA(out, 3));
  return geo;
}
function ensureFormNormals(geo) {
  if (!geo || !geo.attributes || geo.attributes.formNormal || (geo.userData && geo.userData.hxForm)) return;
  geo.userData.hxForm = true;
  try { addFormNormals(geo); } catch (e) { /* the shader falls back to the bulge proxy */ }
}

// ---------------------------------------------------------------- shader rig (round 5)
// GPU bone deformation from the aBone / aPivot attributes (rig.js contract). Every body / hit / glow /
// ink-hull material carries it; models without the attributes read aBone = 0 (static) through
// material.defaultAttributeValues. Times run on the shared uTime clock (tick()), so a state needs no
// per-frame JS: setAnim() only writes a few per-object uniforms once.
//   uAnimA = (state, t0, prevState, prevT0)    uAnimB = (speed, amp, seed (<0: from world pos), crossfade s)
//   uRigBody = (BODY pivot, flags: +1 has RIDER, +2 has BODY)          uRigRider = (RIDER pivot, figure height)
const RIG_DECL = /* glsl */`
uniform float uTime;
uniform vec4 uAnimA, uAnimB, uRigBody, uRigRider;
attribute float aBone;
attribute vec3 aPivot;
vec3 hxRP;
mat3 hxRR;
float hxSeed, hxS, hxSide, hxWingK, hxFallS, hxPPh;
mat3 hxRx(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 hxRy(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 hxRz(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
// piecewise eased keys: 0 at u=0, V.x at T.x, V.y at T.y, V.z at T.z, V.w at T.w
float hxKf(float u, vec4 T, vec4 V) {
  return V.x * smoothstep(0.0, T.x, u) + (V.y - V.x) * smoothstep(T.x, T.y, u)
       + (V.z - V.y) * smoothstep(T.y, T.z, u) + (V.w - V.z) * smoothstep(T.z, T.w, u);
}
float hxEnv(float u, float a, float b) { return smoothstep(0.0, a, u) * (1.0 - smoothstep(b, 1.0, u)); }
// Pose of bone b in state st after t seconds (speed applied). R: euler radians applied as Ry*Rx*Rz,
// O: offset in figure heights, Q: squash (scale - 1). Conventions: +Z front, +X = the *_R side;
// +R.x tips +Y toward +Z (a hanging limb swings BACK), so forward swings are negative.
// dn = distance from the pivot in ~figure thirds (cloth bends more toward its hem).
void hxPose(int st, float t, int b, float dn, inout vec3 R, inout vec3 O, inout vec3 Q) {
  float T = uTime, ph = hxSeed * 6.2832, sd = hxSide, wI = 1.0;
  bool arm = b == 3 || b == 4, legF = b == 5 || b == 6, legB = b == 7 || b == 8, wing = b == 9 || b == 10;
  if (st == 1) { // WALK: 1.9 steps/s pairs, diagonal gait for quadrupeds
    wI = 0.35;
    float w = 6.2832 * 1.15 * t, sw = sin(w), b2 = 0.5 - 0.5 * cos(2.0 * w);
    if (b == 1) { O.y = 0.04 * b2; R.x = 0.1; R.y = 0.07 * sw; R.z = 0.035 * sw; }
    else if (b == 2) { R.x = -0.06 + 0.07 * sin(2.0 * w + 0.6 + hxPPh); R.y = -0.06 * sw; }
    else if (arm) R.x = -0.5 * sw * sd * (b == 4 ? 0.6 : 1.0);
    else if (legF) R.x = 0.62 * sw * sd;
    else if (legB) R.x = -0.62 * sw * sd;
    else if (wing) R.z = sd * hxWingK * (0.22 + 0.16 * sin(2.0 * w));
    else if (b == 11) { R.y = 0.4 * sw; R.x = -0.08; }
    else if (b == 12) { R.x = dn * (0.2 + 0.06 * sin(2.0 * w - dn)); R.y = dn * 0.06 * sw; }
    else if (b == 13) { O.y = 0.015 * (0.5 - 0.5 * cos(2.0 * w + 1.2)); R.x = 0.03 + 0.03 * sin(2.0 * w + 0.6); }
  } else if (st == 6) { // FLY: big wing beats
    wI = 0.3;
    float w = 6.2832 * 1.3 * t, sw = sin(w);
    if (b == 1) { O.y = 0.06 - 0.05 * cos(w); R.x = 0.18; }
    else if (b == 2) R.x = -0.12 + 0.06 * cos(w);
    else if (arm) R.x = 0.25 + 0.08 * sw;
    else if (legF || legB) R.x = 0.6 + 0.06 * sw;
    else if (wing) R.z = sd * hxWingK * (0.3 + 0.95 * sw);
    else if (b == 11) { R.x = -0.2 + 0.18 * sin(w - 1.0); R.y = 0.15 * sin(0.5 * w); }
    else if (b == 12) R.x = dn * (0.35 + 0.08 * sin(w - dn));
    else if (b == 13) O.y = -0.015 * cos(w);
  } else if (st == 2) { // ATTACK 0.6 s: wind-up 0.15 s, strike by 0.23 s, hold, recover
    float u = t / 0.6;
    wI = 1.0 - hxEnv(u, 0.12, 0.75);
    vec4 K = vec4(0.25, 0.38, 0.55, 1.0);
    if (b == 1) { R.x = hxKf(u, K, vec4(-0.22, 0.32, 0.28, 0.0)); R.y = hxKf(u, K, vec4(0.3, -0.24, -0.2, 0.0));
      O.z = hxKf(u, K, vec4(-0.04, 0.12, 0.1, 0.0)); O.y = hxKf(u, K, vec4(0.03, -0.025, -0.02, 0.0)); }
    else if (b == 2) R.x = hxKf(u, K, vec4(-0.18, 0.2, 0.16, 0.0));
    else if (b == 4 && mod(uRigBody.w, 2.0) > 0.5) { // mounted: couched-lance thrust instead of a chop
      R.x = hxKf(u, K, vec4(-0.45, 0.22, 0.18, 0.0)); O.z = hxKf(u, K, vec4(-0.08, 0.16, 0.13, 0.0)); O.y = hxKf(u, K, vec4(0.04, -0.02, -0.02, 0.0)); }
    else if (b == 4) { R.x = hxKf(u, K, vec4(-1.95, 1.35, 1.15, 0.0)); R.z = sd * hxKf(u, K, vec4(0.35, 0.05, 0.05, 0.0)); }
    else if (b == 3) { R.x = hxKf(u, K, vec4(0.25, -0.6, -0.5, 0.0)); R.z = sd * hxKf(u, K, vec4(0.15, 0.1, 0.1, 0.0)); }
    else if (legF) R.x = sd * hxKf(u, K, vec4(0.1, 0.4, 0.35, 0.0)) + hxKf(u, K, vec4(-0.3, 0.0, 0.0, 0.0));
    else if (legB) R.x = hxKf(u, K, vec4(-0.15, 0.28, 0.22, 0.0));
    else if (wing) R.z = sd * hxWingK * hxKf(u, K, vec4(1.0, -0.5, -0.4, 0.0));
    else if (b == 11) R.y = hxKf(u, K, vec4(0.55, -0.65, -0.45, 0.0));
    else if (b == 12) R.x = dn * hxKf(u, K, vec4(0.1, 0.5, 0.45, 0.0));
    else if (b == 13) { R.x = hxKf(u, K, vec4(-0.22, 0.32, 0.26, 0.0)); R.y = hxKf(u, K, vec4(0.3, -0.25, -0.2, 0.0)); }
  } else if (st == 3) { // HIT 0.4 s: knocked back + squash, head jerk, limbs fling
    float u = t / 0.4;
    wI = 1.0 - hxEnv(u, 0.1, 0.6);
    vec4 K = vec4(0.12, 0.3, 0.6, 1.0);
    if (b == 1) { R.x = hxKf(u, K, vec4(-0.4, -0.3, 0.06, 0.0)); O.z = hxKf(u, K, vec4(-0.09, -0.06, 0.01, 0.0));
      Q = vec3(0.09, -0.15, 0.09) * hxKf(u, K, vec4(1.0, 0.35, -0.15, 0.0)); }
    else if (b == 2) { R.x = hxKf(u, K, vec4(-0.5, -0.1, 0.12, 0.0)); R.z = hxKf(u, K, vec4(0.22, 0.08, -0.04, 0.0)); }
    else if (arm) { R.z = sd * hxKf(u, K, vec4(0.65, 0.4, 0.05, 0.0)); R.x = hxKf(u, K, vec4(0.4, 0.25, 0.0, 0.0)); }
    else if (legF || legB) R.x = hxKf(u, K, vec4(-0.18, -0.1, 0.0, 0.0));
    else if (wing) R.z = sd * hxWingK * hxKf(u, K, vec4(0.8, 0.45, 0.0, 0.0));
    else if (b == 11) R.x = hxKf(u, K, vec4(-0.45, -0.2, 0.05, 0.0));
    else if (b == 12) R.x = dn * hxKf(u, K, vec4(-0.45, -0.2, 0.05, 0.0));
    else if (b == 13) R.x = hxKf(u, K, vec4(-0.5, -0.32, 0.08, 0.0));
  } else if (st == 4) { // DEATH 0.9 s, holds the last pose
    float u = min(t / 0.9, 1.0);
    wI = 1.0 - smoothstep(0.0, 0.2, u);
    vec4 K = vec4(0.22, 0.6, 0.8, 1.0);
    if (b == 16) { R.z = hxFallS * hxKf(u, vec4(0.25, 0.75, 0.87, 1.0), vec4(0.06, 1.45, 1.3, 1.38)); O.y = -0.03 * smoothstep(0.6, 1.0, u); }
    else if (b == 1) { R.x = hxKf(u, K, vec4(-0.28, 0.3, 0.35, 0.35)); Q.y = -0.08 * smoothstep(0.5, 1.0, u); }
    else if (b == 2) { R.x = hxKf(u, K, vec4(-0.4, 0.6, 0.7, 0.65)); R.z = hxFallS * hxKf(u, K, vec4(0.0, 0.3, 0.35, 0.35)); }
    else if (arm) { R.z = sd * hxKf(u, K, vec4(0.55, 1.0, 0.9, 0.95)); R.x = hxKf(u, K, vec4(-0.45, 0.3, 0.4, 0.4)); }
    else if (legF || legB) R.z = sd * hxKf(u, K, vec4(0.05, 0.32, 0.26, 0.28));
    else if (wing) R.z = sd * hxWingK * hxKf(u, K, vec4(0.9, -0.7, -0.6, -0.65));
    else if (b == 11) R.x = hxKf(u, K, vec4(-0.3, 0.5, 0.45, 0.45));
    else if (b == 12) R.x = dn * hxKf(u, K, vec4(-0.3, 0.2, 0.15, 0.15));
    else if (b == 13) R.x = hxKf(u, K, vec4(-0.45, 0.5, 0.6, 0.6));
  } else if (st == 5) { // CAST 0.9 s: arms up, head up, rise
    float u = t / 0.9;
    wI = 1.0 - hxEnv(u, 0.15, 0.75);
    vec4 K = vec4(0.28, 0.7, 0.82, 1.0);
    if (b == 1) { R.x = hxKf(u, K, vec4(-0.12, -0.16, -0.1, 0.0)); O.y = hxKf(u, K, vec4(0.05, 0.07, 0.05, 0.0)); Q.y = hxKf(u, K, vec4(0.05, 0.06, 0.03, 0.0)); }
    else if (b == 2) R.x = hxKf(u, K, vec4(-0.38, -0.42, -0.3, 0.0));
    else if (b == 3) { R.x = hxKf(u, K, vec4(-2.3, -2.55, -2.4, 0.0)); R.z = sd * hxKf(u, K, vec4(0.45, 0.55, 0.5, 0.0)); }
    else if (b == 4) { R.x = hxKf(u, K, vec4(-1.0, -1.15, -1.05, 0.0)); R.z = sd * hxKf(u, K, vec4(0.3, 0.38, 0.32, 0.0)); } // staff / weapon hand: presented forward-up
    else if (wing) R.z = sd * hxWingK * hxKf(u, K, vec4(0.75, 0.85, 0.6, 0.0));
    else if (b == 11) R.x = hxKf(u, K, vec4(-0.3, -0.35, -0.25, 0.0));
    else if (b == 12) R.x = dn * (hxKf(u, K, vec4(0.4, 0.55, 0.4, 0.0)) + 0.12 * hxEnv(u, 0.2, 0.8) * sin(T * 13.0 - dn * 2.0));
    else if (b == 13) R.x = hxKf(u, K, vec4(-0.15, -0.2, -0.12, 0.0));
  } else if (st == 7) { // CHEER 1.2 s: two hops, arms up in a V
    float u = t / 1.2, e = hxEnv(u, 0.1, 0.8), hp = abs(sin(6.2832 * u));
    wI = 1.0 - e;
    if (b == 16) O.y = 0.13 * hp * e; // the whole figure hops (legs too)
    else if (b == 1) { R.x = -0.12 * hp * e; Q.y = 0.07 * (hp - 0.4) * e; }
    else if (b == 2) R.x = -0.32 * e;
    else if (b == 3) { R.z = sd * (2.5 + 0.3 * sin(6.2832 * 2.0 * u)) * e; R.x = -0.3 * e; }
    else if (b == 4) { R.z = sd * 0.5 * e; R.x = (-1.0 - 0.4 * sin(6.2832 * 2.0 * u)) * e; } // weapon shaken in the air
    else if (legF || legB) R.x = 0.35 * hp * e;
    else if (wing) R.z = sd * hxWingK * (0.4 + 0.75 * sin(6.2832 * 3.0 * u)) * e;
    else if (b == 11) R.y = 0.6 * sin(6.2832 * 3.0 * u) * e;
    else if (b == 12) R.x = dn * 0.4 * hp * e;
    else if (b == 13) { R.x = -0.15 * e; O.y = 0.04 * hp * e; }
  }
  if (b == 16) return;
  // idle layer on the global clock: breathing, look-around, sway (also the base layer of other states)
  float w = 6.2832 * T, br = sin(0.45 * w + ph);
  vec3 iR = vec3(0.0), iO = vec3(0.0), iQ = vec3(0.0);
  if (b == 1) { iO.y = 0.012 * br; iQ = vec3(-0.008, 0.02, -0.008) * br; iR.x = 0.025 * sin(0.21 * w + ph * 1.3); iR.y = 0.06 * sin(0.17 * w + ph * 0.7); }
  else if (b == 2) { iR.y = 0.3 * sin(0.23 * w + ph * 1.7 + hxPPh); iR.x = 0.07 * sin(0.45 * w + ph - 0.6 + hxPPh * 1.3); iR.z = 0.04 * sin(0.31 * w + hxPPh * 2.1); }
  else if (arm) { iR.x = 0.09 * sin(0.45 * w + ph + sd); iR.z = sd * 0.05 * (1.0 + br); }
  else if (wing) iR.z = sd * hxWingK * (0.12 + 0.13 * sin(0.5 * w + ph));
  else if (b == 11) { iR.y = 0.3 * sin(0.6 * w + ph); iR.x = 0.05 * sin(0.9 * w + ph); }
  else if (b == 12) { iR.x = dn * (0.08 + 0.05 * sin(0.7 * w + ph - 3.0 * dn)); iR.y = dn * 0.08 * sin(0.9 * w + ph - 4.0 * dn); }
  else if (b == 13) { iO.y = 0.008 * sin(0.45 * w + ph + 0.5); iR.y = 0.05 * sin(0.2 * w + ph); }
  R += iR * wI; O += iO * wI; Q += iQ * wI;
}
// blended (previous -> current state) transform of bone b about piv; applied to hxRP / hxRR
void hxApply(int b, vec3 piv, float dn) {
  vec3 R1 = vec3(0.0), O1 = vec3(0.0), Q1 = vec3(0.0);
  float tc = max(uTime - uAnimA.y, 0.0);
  hxPose(int(uAnimA.x + 0.5), tc * uAnimB.x, b, dn, R1, O1, Q1);
  float f = uAnimB.w > 0.0 ? smoothstep(0.0, uAnimB.w, tc) : 1.0;
  if (f < 1.0) {
    vec3 R0 = vec3(0.0), O0 = vec3(0.0), Q0 = vec3(0.0);
    hxPose(int(uAnimA.z + 0.5), max(uTime - uAnimA.w, 0.0) * uAnimB.x, b, dn, R0, O0, Q0);
    R1 = mix(R0, R1, f); O1 = mix(O0, O1, f); Q1 = mix(Q0, Q1, f);
  }
  float A = uAnimB.y;
  mat3 N = hxRy(R1.y * A) * hxRx(R1.x * A) * hxRz(R1.z * A);
  vec3 sc = 1.0 + Q1 * A;
  hxRP = N * ((hxRP - piv) * sc) + piv + O1 * (A * hxS);
  hxRR = N * hxRR;
}
void hxRig() {
  hxRP = position; hxRR = mat3(1.0);
  int b = int(aBone + 0.5);
  if (b <= 0 || b > 15) return;
  vec3 hxW = modelMatrix[3].xyz;
  #ifdef USE_INSTANCING
    hxW += mat3(modelMatrix) * instanceMatrix[3].xyz;
  #endif
  hxSeed = uAnimB.z >= 0.0 ? uAnimB.z : fract(sin(dot(hxW, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  hxS = max(uRigRider.w, 0.05);
  float dn = clamp(length(position - aPivot) / (0.35 * hxS), 0.0, 1.6);
  hxSide = abs(aPivot.x) > 0.02 ? sign(aPivot.x) : ((b == 4 || b == 6 || b == 8 || b == 10) ? 1.0 : -1.0);
  hxWingK = abs(aPivot.x) > 0.02 ? 1.0 : 0.22; // a centred "wing" pair is a cape: gentle sway, no flap
  hxFallS = hxSeed > 0.5 ? 1.0 : -1.0;
  hxPPh = dot(aPivot, vec3(9.1, 3.7, 7.3)); // per-pivot phase: hydra necks, rows of flags desync
  if (b == 14) { // SPIN: continuous turn about local +Z through the pivot
    mat3 M = hxRz(uTime * 1.4 + hxSeed * 6.2832);
    hxRP = M * (position - aPivot) + aPivot; hxRR = M; return;
  }
  if (b == 15) { // FLAG: travelling wave that bends more toward the free end.
    // Hanging banners (cloth below the pivot, e.g. on walls) sway mostly in their own plane (about Z) so they
    // never swing into the wall; pennants sticking out sideways flap about the pole (Y) with more freedom.
    vec3 fv = position - aPivot;
    float ph = hxSeed * 6.2832 + hxPPh, fd = clamp(length(fv) / 0.3, 0.0, 2.5);
    float hz = clamp(length(fv.xz) / max(length(fv), 1e-4) * 1.4, 0.0, 1.0); // 0 hanging, 1 sideways
    float wv = sin(6.2832 * 0.6 * uTime - 2.4 * fd + ph);
    mat3 M = hxRy(fd * mix(0.03, 0.34, hz) * wv) * hxRz(fd * mix(0.07, 0.05, hz) * sin(6.2832 * 0.5 * uTime - 1.8 * fd + ph + 1.3))
           * hxRx(fd * mix(0.015, 0.06, hz) * sin(6.2832 * 0.8 * uTime + ph));
    hxRP = M * (position - aPivot) + aPivot; hxRR = M;
    if (uRigBody.w >= 2.0) hxApply(1, uRigBody.xyz, 0.0); // a flag carried by a figure (hero banner) follows its BODY
    return;
  }
  if (b == 12 && position.y > aPivot.y + 0.005 && uRigBody.w < 2.0) { // CLOTH rising from its pivot on a prop = flame: flicker
    float ph = hxSeed * 6.2832 + hxPPh, fl = 0.6 * sin(6.2832 * 1.3 * uTime + ph) + 0.4 * sin(6.2832 * 2.1 * uTime + ph * 2.7);
    mat3 M = hxRz(0.1 * sin(6.2832 * 0.8 * uTime + ph)) * hxRx(0.08 * sin(6.2832 * 1.1 * uTime + ph + 1.0));
    hxRP = M * ((position - aPivot) * vec3(1.0 - 0.05 * fl, 1.0 + 0.14 * fl, 1.0 - 0.05 * fl)) + aPivot; hxRR = M; return;
  }
  if (b != 1) hxApply(b, aPivot, dn);
  if ((b == 3 || b == 4) && mod(uRigBody.w, 2.0) > 0.5) hxApply(13, uRigRider.xyz, 0.0);
  if (b <= 4 || (b >= 9 && b <= 13)) hxApply(1, uRigBody.xyz, 0.0);
  int hxSa = int(uAnimA.x + 0.5), hxSb = int(uAnimA.z + 0.5);
  if (hxSa == 4 || hxSb == 4 || hxSa == 7 || hxSb == 7) hxApply(16, vec3(-hxFallS * 0.28 * hxS, 0.0, 0.0), 0.0);
}
`;
const RIG_DEFAULTS = { aBone: [0], aPivot: [0, 0, 0], formNormal: [0, 0, 0] };
// splice the rig into a built-in vertex shader (call AFTER the material's own replacements)
function rigVS(vs) {
  return vs
    .replace('void main() {', RIG_DECL + 'void main() {\nhxRig();')
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = hxRR * objectNormal;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = hxRP;');
}
function rigUniforms(THREE) {
  const V = THREE.Vector4;
  return { uTime: shared.uTime, uAnimA: { value: new V(0, 0, 0, 0) }, uAnimB: { value: new V(1, 1, -1, 0) },
    uRigBody: { value: new V(0, 0.42, 0, 0) }, uRigRider: { value: new V(0, 0.6, 0, 1) } };
}
// the uniforms every un-animated mesh shares: auto IDLE (seed from world position), SPIN, FLAG
function rigBase(THREE) { return shared.rigBase || (shared.rigBase = rigUniforms(THREE)); }
function rigMat(mat) {
  mat.defaultAttributeValues = { ...mat.defaultAttributeValues, ...RIG_DEFAULTS };
  return mat;
}

// ---------------------------------------------------------------- body material
const VERT_DECL = /* glsl */`
uniform float uInkC, uInkFlat, uInkProxy, uFormBulge, uViewH;
attribute vec3 formNormal;
varying vec3 vObjPos;
varying vec3 vUpV;
varying vec3 vInkN;
varying vec3 vFormN;
varying float vPx;
void main() {`;
const VERT_BODY = /* glsl */`#include <begin_vertex>
vObjPos = position;
vec4 hxUp = vec4(0.0, 1.0, 0.0, 0.0);
#ifdef USE_INSTANCING
  hxUp = instanceMatrix * hxUp;
#endif
vUpV = normalize((modelViewMatrix * hxUp).xyz);
// form normal: the welded smooth normal (formNormal attribute, or a faceted/bulge mix while it is
// missing) bent a little toward an object-centred "bulge" so the whole figure reads as one lit mass.
// ink-edge normal: the same smooth normal bent further toward the bulge, so the line hugs the silhouette.
{
  vec3 hxP = position - vec3(0.0, uInkC, 0.0);
  vec3 hxB = normalize(hxRR * vec3(hxP.x, hxP.y * uInkFlat, hxP.z) + vec3(0.0, 1e-4, 0.0));
  vec3 hxS = dot(formNormal, formNormal) > 0.25 ? normalize(hxRR * formNormal) : normalize(mix(normalize(objectNormal), hxB, 0.45));
  vec3 hxF = normalize(mix(hxS, hxB, uFormBulge) + vec3(0.0, 1e-5, 0.0));
  vec3 hxN = normalize(mix(hxS, hxB, uInkProxy) + vec3(0.0, 1e-5, 0.0));
  #ifdef USE_INSTANCING
    hxF = mat3(instanceMatrix) * hxF;
    hxN = mat3(instanceMatrix) * hxN;
  #endif
  vFormN = normalize(normalMatrix * hxF);
  vInkN = normalize(normalMatrix * hxN);
}`;
// after <project_vertex>: on-screen pixels per object unit (~ model height in CSS px for a 1-unit creature)
const VERT_PROJ = /* glsl */`#include <project_vertex>
{
  float hxSc = length(modelMatrix[1].xyz);
  #ifdef USE_INSTANCING
    hxSc *= length(instanceMatrix[1].xyz);
  #endif
  float hxD = isPerspectiveMatrix(projectionMatrix) ? max(-mvPosition.z, 1e-3) : 1.0;
  vPx = projectionMatrix[1][1] * 0.5 * uViewH * hxSc / hxD;
}`;

const FRAG_DECL = /* glsl */`
uniform sampler2D uNoise;
uniform float uDetail, uScale, uAO, uAOHeight, uRim, uHemi, uHit, uToe, uLift, uSat, uCon, uInk, uInkW, uInkDark;
uniform float uForm, uFormSmall, uSmallLo, uSmallHi, uDetailSmall, uTop, uGrad, uGradH;
uniform vec3 uRimColor, uSky, uGround, uHitColor, uShade, uInkTint, uTopColor, uShadowTint;
uniform float uShadowK;
varying vec3 vObjPos;
varying vec3 vUpV;
varying vec3 vInkN;
varying vec3 vFormN;
varying float vPx;
void main() {`;

// replaces <lights_physical_pars_fragment>: 3-band painterly diffuse for every direct light
// (light side / mid / shadow side, wrapped, soft steps), blended with plain wrapped Lambert
const FRAG_BAND_DECL = /* glsl */`
uniform float uBand, uBandSmall, uWrap, uBandLo, uBandHi, uBandMid, uBandSoft;
uniform float uSunRef;
float hxSmallL = 0.0;
float hxLit = 0.0; // how much direct (sun) light reached this pixel after bands and shadows, ~0..1
float hxBand(float x) {
  float w = clamp((x + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  float s = uBandMid * smoothstep(uBandLo - uBandSoft, uBandLo + uBandSoft, w)
          + (1.0 - uBandMid) * smoothstep(uBandHi - uBandSoft, uBandHi + uBandSoft, w);
  s *= 0.9 + 0.1 * w; // a whisper of gradient inside the light band
  return mix(w, s, clamp(uBand + uBandSmall * hxSmallL, 0.0, 1.0));
}
vec3 hxIrr(float x, vec3 lc) {
  float b = hxBand(x);
  hxLit += b * dot(lc, vec3(0.2126, 0.7152, 0.0722)) / uSunRef;
  return b * lc;
}
`;
const BAND_FROM = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;';
const BAND_TO = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = hxIrr( dot( geometryNormal, directLight.direction ), directLight.color );';

// after <color_fragment>: diffuseColor holds the vertex colour
const FRAG_COLOR = /* glsl */`#include <color_fragment>
// 1 when the model is small on screen (<= uSmallLo px per unit), 0 when big (>= uSmallHi)
float hxSmall = 1.0 - smoothstep(uSmallLo, uSmallHi, vPx);
hxSmallL = hxSmall;
{
  float hxDet = uDetail * mix(1.0, uDetailSmall, hxSmall);
  vec3 oN = abs(normalize(cross(dFdx(vObjPos), dFdy(vObjPos)) + 1e-6));
  vec2 puv = (oN.x > oN.y && oN.x > oN.z) ? vObjPos.zy : (oN.y > oN.z ? vObjPos.xz : vObjPos.xy);
  vec3 n1 = texture2D(uNoise, puv * uScale).rgb - 0.5;
  vec3 n2 = texture2D(uNoise, puv * (uScale * 0.21) + vec2(0.37, 0.61)).rgb - 0.5;
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  // lift dark albedos: keep their hue, never let them sink to black
  float toe = 1.0 - smoothstep(0.0, 0.32, lum);
  diffuseColor.rgb += uToe * toe * (diffuseColor.rgb * 1.4 + vec3(0.035, 0.03, 0.045));
  lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  // subtle micro grain + brush streaks (faded out when small: it only adds noise), then large painterly blotches
  float d = (n1.r * 0.26 + n1.g * 0.24) * (1.0 - 0.6 * hxSmall) + n2.b * 0.42 + n2.r * 0.12;
  diffuseColor.rgb *= 1.0 + d * hxDet * (0.55 + 0.45 * smoothstep(0.05, 0.4, lum));
  // warm/cool hue drift and slight saturation wobble, like hand-mixed paint
  diffuseColor.rgb += vec3(0.05, 0.02, -0.035) * n2.g * hxDet * (0.4 + lum);
  diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 1.0 + n2.b * 0.3 * hxDet);
  // value bands: a gentle light-top / darker-underside ramp over the model height
  float gy = smoothstep(0.0, uGradH, vObjPos.y);
  diffuseColor.rgb *= 1.0 + uGrad * (gy - 0.55);
  // light fake AO: a soft, coloured (lilac) dip right at the local ground, not a black band
  float ao = smoothstep(0.0, uAOHeight, vObjPos.y);
  ao = mix(1.0 - uAO, 1.0, ao * ao * (3.0 - 2.0 * ao));
  diffuseColor.rgb *= ao * mix(uShade / max(max(uShade.r, uShade.g), uShade.b), vec3(1.0), ao);
  // figure pop: a little more saturation and local value contrast than the ground
  lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, uSat);
  diffuseColor.rgb *= 1.0 + uCon * (lum - 0.38);
  diffuseColor.rgb = max(diffuseColor.rgb, 0.0);
}`;

// after <normal_fragment_begin>: blend the faceted normal with the smooth form normal.
// Hard edges keep their crispness because there the form normal equals the face normal.
const FRAG_NORMAL = /* glsl */`#include <normal_fragment_begin>
normal = normalize(mix(normal, normalize(vFormN), clamp(mix(uForm, uFormSmall, hxSmall), 0.0, 1.0)));
// smooth normals can turn away from the camera on thin parts and silhouettes: keep them facing the
// viewer a little, or the rim / fresnel terms flare into white slivers along edges
{
  vec3 hxVv = normalize(vViewPosition);
  float hxNv = dot(normal, hxVv);
  if (hxNv < 0.12) normal = normalize(normal + hxVv * (0.12 - hxNv));
}`;

const FRAG_EMISSIVE = /* glsl */`#include <emissivemap_fragment>
totalEmissiveRadiance += uHitColor * uHit;`;

// before <opaque_fragment>: coloured fill, bounce, top light and rim on top of the lit colour
const FRAG_OUT = /* glsl */`{
  vec3 hxV = normalize(vViewPosition);
  float up = dot(normal, normalize(vUpV));
  float ndv = clamp(dot(normal, hxV), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.5);
  // sky from above, warm coloured bounce from below (stronger on faces turned down)
  vec3 hemi = mix(uGround * (1.25 - 0.25 * up), uSky, smoothstep(-0.6, 0.9, up));
  outgoingLight += diffuseColor.rgb * hemi * uHemi;
  // soft coloured shadow side: where the sun does not reach, cool the light toward lilac-blue (a hue shift, not black)
  float hxSh = 1.0 - smoothstep(0.08, 0.6, hxLit);
  outgoingLight *= mix(vec3(1.0), uShadowTint, uShadowK * (1.0 + 0.4 * hxSmall) * hxSh);
  // top light: heads, helmets, roofs and lids are the brightest planes seen from the high camera
  outgoingLight += diffuseColor.rgb * uTopColor * uTop * (1.0 + 0.5 * hxSmall) * smoothstep(0.3, 0.95, up);
  // shadow lift: whatever the lights left dark gets a soft coloured fill of its own albedo
  float lo = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  float dark = 1.0 - smoothstep(0.0, 0.45, lo / max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.04));
  outgoingLight += diffuseColor.rgb * uShade * uLift * (0.35 + 0.65 * dark);
  // warm sunny rim, brightest on upward-facing edges, faint underneath
  outgoingLight += uRimColor * fres * uRim * (0.35 + 0.65 * clamp(up + 0.4, 0.0, 1.0)) * (0.6 + 0.4 * dot(diffuseColor.rgb, vec3(0.33)));
  outgoingLight += uHitColor * fres * uHit * 1.5;
  // ink edge: painted silhouette line. Smooth (bent) normal decides where the line sits,
  // the shading normal sharpens it on grazing facets; crisp smoothstep, coloured, never black.
  if (uInk > 0.0) {
    float sv = abs(dot(normalize(vInkN), hxV));
    float e = 1.0 - (sv * 0.5 + ndv * 0.5);
    float ink = smoothstep(1.0 - uInkW, 1.0 - uInkW * 0.6, e);
    vec3 alb = diffuseColor.rgb;
    float al = dot(alb, vec3(0.2126, 0.7152, 0.0722));
    vec3 hue = alb / max(max(alb.r, max(alb.g, alb.b)), 0.05);
    vec3 inkCol = (hue * 0.55 + uInkTint * 0.45) * uInkDark * (0.75 + 0.5 * al);
    outgoingLight = mix(outgoingLight, inkCol, clamp(ink * uInk * 1.6, 0.0, 1.0));
  }
}
#include <opaque_fragment>`;

function bodyUniforms(THREE, o) {
  return {
    uNoise: shared.uNoise,
    uTime: shared.uTime,
    uDetail: { value: o.detail ?? 0.6 },
    uScale: { value: o.scale ?? 2.2 },
    uAO: { value: o.ao ?? 0.16 },
    uAOHeight: { value: o.aoHeight ?? 0.22 },
    uRim: { value: o.rim ?? 0.6 },
    uRimColor: { value: new THREE.Color(o.rimColor ?? 0xffcf8a) },
    uHemi: { value: o.hemi ?? 0.2 },
    uSky: { value: new THREE.Color(o.sky ?? 0x9cc6ff) },
    uGround: { value: new THREE.Color(o.ground ?? 0xe0a860) },
    uShade: { value: new THREE.Color(o.shade ?? 0xb4a8f0) },
    uLift: { value: o.lift ?? 0.24 },
    uToe: { value: o.toe ?? 0.45 },
    uHit: { value: o.hit ?? 0 },
    uSat: { value: o.sat ?? 1.1 },
    uCon: { value: o.contrast ?? 0.22 },
    uInk: { value: o.ink ?? 0.5 },
    uInkW: { value: o.inkWidth ?? 0.3 },
    uInkDark: { value: o.inkDark ?? 0.16 },
    uInkTint: { value: new THREE.Color(o.inkTint ?? 0x5a3070) },
    uInkC: { value: o.inkCenter ?? 0.4 },
    uInkFlat: { value: o.inkFlat ?? 0.6 },
    uInkProxy: { value: o.inkProxy ?? 0.45 },
    uHitColor: { value: new THREE.Color(o.hitColor ?? 0xff3a2a) },
    // round 4: forms, bands, top light, size adaptivity
    uForm: { value: o.form ?? 0.55 },
    uFormSmall: { value: o.formSmall ?? o.form ?? 0.85 },
    uFormBulge: { value: o.formBulge ?? 0.18 },
    uSmallLo: { value: (o.smallPx ?? [70, 260])[0] },
    uSmallHi: { value: (o.smallPx ?? [70, 260])[1] },
    uDetailSmall: { value: o.detailSmall ?? 0.5 },
    uBand: { value: o.band ?? 0.7 },
    uBandSmall: { value: o.bandSmall ?? 0.25 },
    uWrap: { value: o.wrap ?? 0.3 },
    uBandLo: { value: o.bandLo ?? 0.28 },
    uBandHi: { value: o.bandHi ?? 0.64 },
    uBandMid: { value: o.bandMid ?? 0.5 },
    uBandSoft: { value: o.bandSoft ?? 0.07 },
    uTop: { value: o.top ?? 0.14 },
    uTopColor: { value: new THREE.Color(o.topColor ?? 0xfff0d4) },
    uGrad: { value: o.grad ?? 0.08 },
    uGradH: { value: o.gradH ?? 1.0 },
    uShadowTint: { value: new THREE.Color(o.shadowTint ?? 0x9c96e6) },
    uShadowK: { value: o.shadowK ?? 0.5 },
    uSunRef: { value: o.sunRef ?? 2.2 },
    uViewH: { value: 800 },
  };
}

/**
 * Painted body material. opts (all optional):
 *  detail 0.6 (0 = off), scale 2.2 (noise repeats per local unit), ao 0.16, aoHeight 0.22,
 *  rim 0.6, rimColor (warm), hemi 0.2 (sky/bounce), sky, ground (warm bounce colour),
 *  shade (coloured shadow tint), lift 0.24 (shadow fill), toe 0.45 (lifts dark albedos),
 *  roughness 0.8, metalness 0, hit 0, hitColor,
 *  sat 1.1 (albedo saturation), contrast 0.22 (albedo value contrast),
 *  ink 0.5 (painted silhouette edge strength, 0 = off), inkWidth 0.3, inkDark 0.16, inkTint (deep violet),
 *  inkCenter 0.4 / inkFlat 0.6 / inkProxy 0.45 (shape of the smooth "bulge" normal used for the edge).
 * Round 4 (small-size readability; "small" = model on screen <= smallPx[0] px per local unit, "big" >= smallPx[1]):
 *  form 0.55 / formSmall 0.85 (blend of the faceted normal toward the smooth crease-aware form normal; 0 = old faceted look
 *    and no formNormal attribute is computed), formBulge 0.18 (form normal bent toward an object-centred bulge),
 *  smallPx [70, 260], detailSmall 0.5 (noise detail multiplier when small),
 *  band 0.7 / bandSmall +0.25 (how much the direct light snaps to 3 painterly bands vs smooth wrapped Lambert),
 *  wrap 0.3, bandLo 0.28 / bandHi 0.64 (band thresholds on the wrapped N.L), bandMid 0.5 (mid band level), bandSoft 0.07,
 *  shadowTint (lilac-blue) / shadowK 0.5 (hue-shifted multiplier on the side the sun misses; +40% when small), sunRef 2.2 (sun luminance that counts as fully lit),
 *  top 0.28 / topColor (warm white boost on upward-facing planes), grad 0.08 / gradH 1.0 (light-top value ramp over the height).
 * Live-tweak via material.userData.uniforms.uDetail.value etc.
 */
export function makeBodyMaterial(THREE, opts = {}) {
  noiseTexture(THREE);
  shared.T = THREE;
  const u = bodyUniforms(THREE, opts);
  const vp = new THREE.Vector4();
  // A = the rig uniform set: the shared auto-idle one, or a per-object one (setAnim makes variants that share `u`)
  const build = (A) => {
    const mat = rigMat(new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true,
      roughness: opts.roughness ?? 0.8, metalness: opts.metalness ?? 0,
    }));
    mat.userData.uniforms = u;
    mat.userData.rig = A;
    mat.userData.rigVariant = build;
    mat.onBeforeRender = (renderer, scene, camera, geometry) => {
      if (u.uForm.value > 0 || u.uFormSmall.value > 0) ensureFormNormals(geometry);
      renderer.getCurrentViewport(vp);
      u.uViewH.value = Math.max(1, vp.w / (renderer.getPixelRatio() || 1));
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u, A);
      sh.vertexShader = rigVS(sh.vertexShader
        .replace('void main() {', VERT_DECL)
        .replace('#include <begin_vertex>', VERT_BODY)
        .replace('#include <project_vertex>', VERT_PROJ));
      const pars = THREE.ShaderChunk.lights_physical_pars_fragment;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <lights_physical_pars_fragment>', FRAG_BAND_DECL + (pars.includes(BAND_FROM) ? pars.replace(BAND_FROM, BAND_TO) : pars))
        .replace('void main() {', FRAG_DECL)
        .replace('#include <color_fragment>', FRAG_COLOR)
        .replace('#include <normal_fragment_begin>', FRAG_NORMAL)
        .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE)
        .replace('#include <opaque_fragment>', FRAG_OUT);
    };
    mat.customProgramCacheKey = () => 'hexBody5';
    return mat;
  };
  return build(rigBase(THREE));
}
/** Drop-in battle hit material: same look as the body material plus a red emissive flash. */
export function makeHitMaterial(THREE, opts = {}) {
  return makeBodyMaterial(THREE, { hit: 0.9, ...opts });
}

/** Set the flash strength (0..1+) of a body/hit material, e.g. fading over time. */
export function setHit(mat, k) {
  if (mat.userData.uniforms) mat.userData.uniforms.uHit.value = k;
}

// ---------------------------------------------------------------- glow material
/** Unlit HDR vertex-colour glow that slowly pulses (phase varies over the model). */
export function makeGlowMaterial(THREE, opts = {}) {
  shared.T = THREE;
  const u = { uTime: shared.uTime, uPulse: { value: opts.pulse ?? 0.25 }, uSpeed: { value: opts.speed ?? 2.2 } };
  const build = (A) => {
    const mat = rigMat(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    mat.color.setScalar(opts.intensity ?? 2.2);
    mat.userData.uniforms = u;
    mat.userData.rig = A;
    mat.userData.rigVariant = build;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u, A);
      sh.vertexShader = rigVS(sh.vertexShader
        .replace('void main() {', 'varying float vPhase;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPhase = dot(position, vec3(5.3, 3.1, 4.7));'));
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform float uTime, uPulse, uSpeed;\nvarying float vPhase;\nvoid main() {')
        .replace('#include <opaque_fragment>', `outgoingLight *= 1.0 + uPulse * sin(uTime * uSpeed + vPhase);
#include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'hexGlow2';
    return mat;
  };
  return build(rigBase(THREE));
}

// ---------------------------------------------------------------- animation API (round 5)
export { ANIM, BONE };
/** One-shot state lengths in seconds at speed 1. Non-DEATH one-shots fall back to IDLE by themselves; DEATH holds. */
export const ANIM_DUR = { [ANIM.ATTACK]: 0.6, [ANIM.HIT]: 0.4, [ANIM.DEATH]: 0.9, [ANIM.CAST]: 0.9, [ANIM.CHEER]: 1.2 };
/** Seconds (speed 1) from the start of a state to its "contact" frame: the strike lands / the spell leaves the hands. */
export const ANIM_IMPACT = { [ANIM.ATTACK]: 0.23, [ANIM.CAST]: 0.3, [ANIM.HIT]: 0.05, [ANIM.DEATH]: 0.65 };

/** Shadow-pass material that deforms like the body (setAnim assigns one per object as customDepthMaterial). */
export function makeRigDepthMaterial(THREE, A) {
  shared.T = THREE;
  A = A || rigBase(THREE);
  const mat = rigMat(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  mat.userData.rig = A;
  mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, A); sh.vertexShader = rigVS(sh.vertexShader); };
  mat.customProgramCacheKey = () => 'hexRigDepth1';
  return mat;
}

/**
 * Rig facts of a geometry, cached on geo.userData.hxRig: { body: [x,y,z] | null, rider: [x,y,z] | null, height, bones: Set }.
 * BODY / RIDER pivots come from the first vertex tagged with that bone. null when the geometry has no aBone.
 */
export function rigInfo(geo) {
  if (!geo || !geo.attributes) return null;
  if (geo.userData.hxRig !== undefined) return geo.userData.hxRig;
  const B = geo.attributes.aBone, P = geo.attributes.aPivot, pos = geo.attributes.position;
  if (!B || !P) return (geo.userData.hxRig = null);
  let body = null, rider = null, h = 0;
  const bones = new Set();
  for (let i = 0; i < B.count; i++) {
    const b = Math.round(B.getX(i)); bones.add(b);
    if (b === BONE.BODY && !body) body = [P.getX(i), P.getY(i), P.getZ(i)];
    if (b === BONE.RIDER && !rider) rider = [P.getX(i), P.getY(i), P.getZ(i)];
  }
  for (let i = 0; i < pos.count; i++) h = Math.max(h, pos.getY(i));
  return (geo.userData.hxRig = { body, rider, height: h || 1, bones });
}

function objSeed(obj) { let x = (obj.id * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; return ((x ^ (x >>> 13)) >>> 0) / 4294967296; }

function installRig(obj) {
  const THREE = shared.T;
  const A = rigUniforms(THREE);
  const a = { A, state: ANIM.IDLE, t0: shared.uTime.value, speed: 1, mats: new Map(), meshes: [], depth: makeRigDepthMaterial(THREE, A) };
  // pivots: first geometry in the group that has a BODY (else the first rigged one) speaks for the group
  let info = null;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const ri = rigInfo(o.geometry);
    if (ri && (!info || (!info.body && ri.body))) info = ri;
  });
  if (info) {
    const h = info.height;
    const bp = info.body || [0, h * 0.42, 0], rp = info.rider || [bp[0], bp[1] + h * 0.2, bp[2]];
    A.uRigBody.value.set(bp[0], bp[1], bp[2], (info.rider ? 1 : 0) + (info.body ? 2 : 0));
    A.uRigRider.value.set(rp[0], rp[1], rp[2], h);
  }
  obj.traverse((o) => {
    if (!o.isMesh || Object.getOwnPropertyDescriptor(o, 'material')?.get) return;
    let base = o.material;
    // the mesh keeps answering with a per-object variant of whatever shared material is assigned
    // (main.js may swap bodyMat <-> hitMat freely); non-rig materials pass through unchanged
    Object.defineProperty(o, 'material', {
      configurable: true, enumerable: true,
      get() {
        const f = base && base.userData && base.userData.rigVariant;
        if (!f || base.userData.rig === A) return base;
        let v = a.mats.get(base);
        if (!v) a.mats.set(base, (v = f(A)));
        return v;
      },
      set(m) { base = m; },
    });
    o.userData.hxBaseMat = () => base;
    if (o.customDepthMaterial === undefined) { o.customDepthMaterial = a.depth; o.userData.hxDepth = true; }
    a.meshes.push(o);
  });
  obj.userData.anim = a;
  return a;
}

/** The state an object is effectively in now (finished one-shots report IDLE, DEATH stays DEATH). */
export function getAnim(obj) {
  const a = obj && obj.userData.anim;
  if (!a) return { state: ANIM.IDLE, t: 0, done: true, dur: Infinity };
  const t = (shared.uTime.value - a.t0) * a.speed, d = ANIM_DUR[a.state];
  const done = d !== undefined && t >= d;
  return { state: done && a.state !== ANIM.DEATH ? ANIM.IDLE : a.state, t, done, dur: d === undefined ? Infinity : d / a.speed };
}

/**
 * Play an animation state on a model group (or a single mesh). Installs per-object rig uniforms the first time.
 * state: ANIM.* . opts: speed 1, amp 1 (pose scale), seed (0..1, default stable per object), fade 0.12 s crossfade,
 * restart (default: one-shots restart, loops already running just continue).
 * Returns the state's duration in seconds (Infinity for IDLE / WALK / FLY). Requires tick() to be called every frame.
 */
export function setAnim(obj, state, opts = {}) {
  if (!obj || !shared.T) return 0;
  const a = obj.userData.anim || installRig(obj);
  const now = shared.uTime.value, cur = getAnim(obj), oneShot = ANIM_DUR[state] !== undefined;
  const speed = opts.speed ?? a.speed ?? 1;
  const B = a.A.uAnimB.value;
  B.x = speed; B.y = opts.amp ?? B.y; B.z = opts.seed ?? (B.z >= 0 ? B.z : objSeed(obj)); B.w = opts.fade ?? 0.12;
  if (!(opts.restart ?? oneShot) && cur.state === state) { a.speed = speed; return cur.dur; }
  a.A.uAnimA.value.set(state, now, a.state, a.t0);
  a.state = state; a.t0 = now; a.speed = speed;
  return oneShot ? ANIM_DUR[state] / speed : Infinity;
}

/** Remove the per-object rig: meshes get their shared materials back (auto-idle again). */
export function clearAnim(obj) {
  const a = obj && obj.userData.anim;
  if (!a) return;
  for (const o of a.meshes) {
    const base = o.userData.hxBaseMat();
    Object.defineProperty(o, 'material', { value: base, writable: true, configurable: true, enumerable: true });
    if (o.userData.hxDepth) { o.customDepthMaterial = undefined; delete o.userData.hxDepth; }
    delete o.userData.hxBaseMat;
  }
  for (const m of a.mats.values()) m.dispose();
  a.depth.dispose();
  delete obj.userData.anim;
}

/** Strength of the automatic idle every rigged model without setAnim gets (map figures, portraits). 0 = still. */
export function setRigIdle(k = 1) { if (shared.rigBase) shared.rigBase.uAnimB.value.y = k; else if (shared.T) rigBase(shared.T).uAnimB.value.y = k; }

/** Advance shared animated uniforms. Call once per frame with seconds. */
export function tick(time) { shared.uTime.value = time; }

// ---------------------------------------------------------------- contact (blob) shadow
let _blobTex = null;
function blobTexture(THREE) {
  if (_blobTex) return _blobTex;
  const N = 128, cvs = document.createElement('canvas');
  cvs.width = cvs.height = N;
  const ctx = cvs.getContext('2d'), img = ctx.createImageData(N, N), d = img.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x + 0.5) / N * 2 - 1, dy = (y + 0.5) / N * 2 - 1, r = Math.sqrt(dx * dx + dy * dy);
    // soft core that eases to exactly 0 at the unit radius (gaussian-ish, no hard rim)
    const t = Math.min(1, Math.max(0, (1 - r) / 0.8)), a = t * t * (3 - 2 * t);
    const i = (y * N + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = Math.round(Math.pow(a, 0.7) * 255); d[i + 3] = 255; // alphaMap reads .g
  }
  ctx.putImageData(img, 0, 0);
  _blobTex = new THREE.CanvasTexture(cvs);
  _blobTex.colorSpace = THREE.NoColorSpace;
  return _blobTex;
}

/**
 * Soft contact shadow for map objects / heroes / towns: warm dark plum-brown, ~0.65 opacity over a
 * wide core (so it reads at map zoom), fading to 0 at radius 1. Transparent, no depth write, polygon offset against the ground.
 * opts: color (0x3a2028), opacity (0.65). One shared material is fine for every blob.
 */
export function makeBlobShadowMaterial(THREE, opts = {}) {
  const mat = new THREE.MeshBasicMaterial({
    color: opts.color ?? 0x3a2028, alphaMap: blobTexture(THREE), transparent: true,
    opacity: opts.opacity ?? 0.65, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    toneMapped: false, fog: true,
  });
  return mat;
}

/** Unit-radius quad in the XZ plane at y = 0.002 (normal +Y). Scale the mesh to the footprint radius. */
export function blobShadowGeometry(THREE) {
  return new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2).translate(0, 0.002, 0);
}

// ---------------------------------------------------------------- ink hull (crisp silhouette line)
/**
 * Optional second pass for a crisp, HoMM-style painted outline: draw the SAME body geometry again
 * with this material (BackSide "inverted hull"). The line colour is the model's own vertex colour,
 * darkened and tinted deep violet (never black). Works with Mesh and InstancedMesh. No lighting, no shadows.
 * Line width (round 4): scales with the object's on-screen size, in DEVICE pixels:
 *   px = clamp(sizeK * (pixels per local unit of the object) * width / 0.003, minPx, maxPx)
 * so a ~40 css-px creature gets a ~1.5-2 px line and big / close figures cap at ~3 px. `width` (uHullW) stays a
 * multiplier around its 0.003 default, so main.js's per-zoom uHullW = 0.003 * zk keeps working (clamped to minPx).
 * The push never moves toward the camera (only sideways / away), so the hull of double-sided capes, flags and
 * leaves cannot poke through the front sheet as dark patches.
 * opts: width 0.003, sizeK 0.018, minPx 1.5, maxPx 3, fixed false (true = old constant-angle width: width is then
 * view-angle units), dark 0.15, tint (0x4a2860), bulge 0.55 (how much the push follows a smooth object-centred
 * direction instead of the surface normal: fewer cracks), center 0.4 (object-space height of that centre),
 * push 0.0008 (depth push away from the camera, fraction of view distance).
 */
export function makeInkHullMaterial(THREE, opts = {}) {
  shared.T = THREE;
  const u = {
    uHullW: { value: opts.width ?? 0.003 },
    uHullDark: { value: opts.dark ?? 0.15 },
    uHullTint: { value: new THREE.Color(opts.tint ?? 0x4a2860) },
    uHullBulge: { value: opts.bulge ?? 0.55 },
    uHullC: { value: opts.center ?? 0.4 },
    uHullPush: { value: opts.push ?? 0.0008 },
    uHullK: { value: opts.sizeK ?? 0.018 },
    uHullMin: { value: opts.minPx ?? 1.5 },
    uHullMax: { value: opts.maxPx ?? 2.5 },
    uHullFixed: { value: opts.fixed ? 1 : 0 },
    uHullVH: { value: 1000 },
  };
  const vp = new THREE.Vector4();
  const build = (A) => {
  const mat = rigMat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  mat.userData.uniforms = u;
  mat.userData.rig = A;
  mat.userData.rigVariant = build;
  mat.onBeforeRender = (renderer) => { renderer.getCurrentViewport(vp); u.uHullVH.value = Math.max(1, vp.w); };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, A);
    sh.vertexShader = rigVS(sh.vertexShader
      .replace('void main() {', 'uniform float uHullW, uHullBulge, uHullC, uHullPush, uHullK, uHullMin, uHullMax, uHullFixed, uHullVH;\nattribute vec3 formNormal;\nvoid main() {')
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec3 hxP = position - vec3(0.0, uHullC, 0.0);
  vec3 hxB = normalize(hxRR * vec3(hxP.x, hxP.y * 0.6, hxP.z) + vec3(0.0, 1e-4, 0.0));
  // push along the smooth form normal when the body material has computed it (fewer cracks at hard corners)
  vec3 hxS = dot(formNormal, formNormal) > 0.25 ? normalize(hxRR * formNormal) : normalize(hxRR * normal);
  vec3 hxN = normalize(mix(hxS, hxB, uHullBulge));
  float hxSc = length(modelMatrix[1].xyz);
  #ifdef USE_INSTANCING
    hxN = mat3(instanceMatrix) * hxN;
    hxSc *= length(instanceMatrix[1].xyz);
  #endif
  hxN = normalize(normalMatrix * hxN);
  // never push toward the camera: thin double-sided sheets would show the hull through their front
  vec3 hxC = normalize(-mvPosition.xyz);
  hxN -= hxC * max(dot(hxN, hxC), 0.0);
  float hxD = max(-mvPosition.z, 0.1);
  if (uHullFixed > 0.5) {
    mvPosition.xyz += hxN * uHullW * hxD;
  } else {
    // device px per view unit at this depth, and the object's on-screen size in px per local unit
    float hxPpu = projectionMatrix[1][1] * 0.5 * uHullVH / (isPerspectiveMatrix(projectionMatrix) ? hxD : 1.0);
    float hxPx = clamp(uHullK * hxSc * hxPpu * (uHullW / 0.003), uHullMin, uHullMax);
    mvPosition.xyz += hxN * (hxPx / hxPpu);
  }
  // push the hull a little away from the camera so thin parts (capes, flags, leaves) never show it in front
  mvPosition.xyz += normalize(mvPosition.xyz) * uHullPush * hxD;
  gl_Position = projectionMatrix * mvPosition;
}`));
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uHullDark;\nuniform vec3 uHullTint;\nvoid main() {')
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 alb = diffuseColor.rgb;
  vec3 hue = alb / max(max(alb.r, max(alb.g, alb.b)), 0.05);
  float al = dot(alb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = (hue * 0.5 + uHullTint * 0.5) * uHullDark * (0.8 + 0.4 * al);
}`);
  };
  mat.customProgramCacheKey = () => 'hexInkHull5';
  return mat;
  };
  return build(rigBase(THREE));
}
