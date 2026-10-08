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

const shared = { uTime: { value: 0 }, uNoise: { value: null } };

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

// ---------------------------------------------------------------- body material
const VERT_DECL = /* glsl */`
varying vec3 vObjPos;
varying vec3 vUpV;
void main() {`;
const VERT_BODY = /* glsl */`#include <begin_vertex>
vObjPos = position;
vec4 hxUp = vec4(0.0, 1.0, 0.0, 0.0);
#ifdef USE_INSTANCING
  hxUp = instanceMatrix * hxUp;
#endif
vUpV = normalize((modelViewMatrix * hxUp).xyz);`;

const FRAG_DECL = /* glsl */`
uniform sampler2D uNoise;
uniform float uDetail, uScale, uAO, uAOHeight, uRim, uHemi, uHit, uToe, uLift;
uniform vec3 uRimColor, uSky, uGround, uHitColor, uShade;
varying vec3 vObjPos;
varying vec3 vUpV;
void main() {`;

// after <color_fragment>: diffuseColor holds the vertex colour
const FRAG_COLOR = /* glsl */`#include <color_fragment>
{
  vec3 oN = abs(normalize(cross(dFdx(vObjPos), dFdy(vObjPos)) + 1e-6));
  vec2 puv = (oN.x > oN.y && oN.x > oN.z) ? vObjPos.zy : (oN.y > oN.z ? vObjPos.xz : vObjPos.xy);
  vec3 n1 = texture2D(uNoise, puv * uScale).rgb - 0.5;
  vec3 n2 = texture2D(uNoise, puv * (uScale * 0.21) + vec2(0.37, 0.61)).rgb - 0.5;
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  // lift dark albedos: keep their hue, never let them sink to black
  float toe = 1.0 - smoothstep(0.0, 0.32, lum);
  diffuseColor.rgb += uToe * toe * (diffuseColor.rgb * 1.4 + vec3(0.035, 0.03, 0.045));
  lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  // subtle micro grain + brush streaks, then large painterly blotches
  float d = n1.r * 0.26 + n1.g * 0.24 + n2.b * 0.42 + n2.r * 0.12;
  diffuseColor.rgb *= 1.0 + d * uDetail * (0.55 + 0.45 * smoothstep(0.05, 0.4, lum));
  // warm/cool hue drift and slight saturation wobble, like hand-mixed paint
  diffuseColor.rgb += vec3(0.05, 0.02, -0.035) * n2.g * uDetail * (0.4 + lum);
  diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 1.0 + n2.b * 0.3 * uDetail);
  // light fake AO: a soft, coloured (lilac) dip right at the local ground, not a black band
  float ao = smoothstep(0.0, uAOHeight, vObjPos.y);
  ao = mix(1.0 - uAO, 1.0, ao * ao * (3.0 - 2.0 * ao));
  diffuseColor.rgb *= ao * mix(uShade / max(max(uShade.r, uShade.g), uShade.b), vec3(1.0), ao);
  diffuseColor.rgb = max(diffuseColor.rgb, 0.0);
}`;

const FRAG_EMISSIVE = /* glsl */`#include <emissivemap_fragment>
totalEmissiveRadiance += uHitColor * uHit;`;

// before <opaque_fragment>: coloured fill, bounce and rim on top of the lit colour
const FRAG_OUT = /* glsl */`{
  vec3 hxV = normalize(vViewPosition);
  float up = dot(normal, normalize(vUpV));
  float ndv = clamp(dot(normal, hxV), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.5);
  // sky from above, warm coloured bounce from below (stronger on faces turned down)
  vec3 hemi = mix(uGround * (1.25 - 0.25 * up), uSky, smoothstep(-0.6, 0.9, up));
  outgoingLight += diffuseColor.rgb * hemi * uHemi;
  // shadow lift: whatever the lights left dark gets a soft coloured fill of its own albedo
  float lo = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  float dark = 1.0 - smoothstep(0.0, 0.45, lo / max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.04));
  outgoingLight += diffuseColor.rgb * uShade * uLift * (0.35 + 0.65 * dark);
  // warm sunny rim, brightest on upward-facing edges, faint underneath
  outgoingLight += uRimColor * fres * uRim * (0.35 + 0.65 * clamp(up + 0.4, 0.0, 1.0)) * (0.6 + 0.4 * dot(diffuseColor.rgb, vec3(0.33)));
  outgoingLight += uHitColor * fres * uHit * 1.5;
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
    uRim: { value: o.rim ?? 0.5 },
    uRimColor: { value: new THREE.Color(o.rimColor ?? 0xffcf8a) },
    uHemi: { value: o.hemi ?? 0.2 },
    uSky: { value: new THREE.Color(o.sky ?? 0x9cc6ff) },
    uGround: { value: new THREE.Color(o.ground ?? 0xe0a860) },
    uShade: { value: new THREE.Color(o.shade ?? 0xb4a8f0) },
    uLift: { value: o.lift ?? 0.16 },
    uToe: { value: o.toe ?? 0.35 },
    uHit: { value: o.hit ?? 0 },
    uHitColor: { value: new THREE.Color(o.hitColor ?? 0xff3a2a) },
  };
}

/**
 * Painted body material. opts (all optional):
 *  detail 0.6 (0 = off), scale 2.2 (noise repeats per local unit), ao 0.16, aoHeight 0.22,
 *  rim 0.5, rimColor (warm), hemi 0.2 (sky/bounce), sky, ground (warm bounce colour),
 *  shade (coloured shadow tint), lift 0.16 (shadow fill), toe 0.35 (lifts dark albedos),
 *  roughness 0.8, metalness 0, hit 0, hitColor. Live-tweak via material.userData.uniforms.uDetail.value etc.
 */
export function makeBodyMaterial(THREE, opts = {}) {
  noiseTexture(THREE);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true,
    roughness: opts.roughness ?? 0.8, metalness: opts.metalness ?? 0,
  });
  const u = bodyUniforms(THREE, opts);
  mat.userData.uniforms = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('void main() {', VERT_DECL).replace('#include <begin_vertex>', VERT_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', FRAG_DECL)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE)
      .replace('#include <opaque_fragment>', FRAG_OUT);
  };
  mat.customProgramCacheKey = () => 'hexBody2';
  return mat;
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
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  mat.color.setScalar(opts.intensity ?? 2.2);
  const u = { uTime: shared.uTime, uPulse: { value: opts.pulse ?? 0.25 }, uSpeed: { value: opts.speed ?? 2.2 } };
  mat.userData.uniforms = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying float vPhase;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPhase = dot(position, vec3(5.3, 3.1, 4.7));');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uTime, uPulse, uSpeed;\nvarying float vPhase;\nvoid main() {')
      .replace('#include <opaque_fragment>', `outgoingLight *= 1.0 + uPulse * sin(uTime * uSpeed + vPhase);
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'hexGlow1';
  return mat;
}

/** Advance shared animated uniforms. Call once per frame with seconds. */
export function tick(time) { shared.uTime.value = time; }
