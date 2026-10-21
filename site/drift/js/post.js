// Post: HDR scene target (MSAA) -> dual-filter bloom -> composite with ACES tone mapping, lens ghosts
// (screen-space flares that follow any bright light: floodlights at night, the sun by day), speed lines,
// vignette and a goal flash. Tier 0 bypasses all of it and renders straight to the canvas.
import * as THREE from 'three';

const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// 1st pass: soft-knee threshold + 4-tap downsample
const BRIGHT_FS = `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh, uKnee;
varying vec2 vUv;
vec3 pick(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main(){
  vec3 c = (pick(vec2(-1.0,-1.0)) + pick(vec2(1.0,-1.0)) + pick(vec2(-1.0,1.0)) + pick(vec2(1.0,1.0))) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
  float w = max(soft, br - uThresh) / max(br, 1e-4);
  gl_FragColor = vec4(min(c * w, vec3(40.0)), 1.0);
}`;
// dual-kawase down / up
const DOWN_FS = `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec2 h = uTexel;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv - h).rgb; s += texture2D(tSrc, vUv + h).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb; s += texture2D(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;
const UP_FS = `
uniform sampler2D tSrc, tBase; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec2 h = uTexel;
  vec3 s = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture2D(tBase, vUv).rgb * 0.7, 1.0);
}`;
const COMP_FS = `
uniform sampler2D tScene, tBloom, tGhost; uniform float uBloom, uGhost, uLines, uTime, uFlash, uVig, uAspect;
uniform vec3 uFlashCol;
varying vec2 vUv;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  c += texture2D(tBloom, vUv).rgb * uBloom;
  // lens ghosts: the low bloom mip mirrored through the centre at a few scales, tinted
  if (uGhost > 0.0) {
    vec2 g = vec2(1.0) - vUv; vec2 d = (vec2(0.5) - g);
    vec3 gh = vec3(0.0);
    gh += texture2D(tGhost, g + d * 0.0).rgb * vec3(0.9, 0.6, 1.0) * 0.5;
    gh += texture2D(tGhost, g + d * 0.45).rgb * vec3(0.5, 0.8, 1.0) * 0.6;
    gh += texture2D(tGhost, g + d * 0.75).rgb * vec3(1.0, 0.75, 0.4) * 0.45;
    gh += texture2D(tGhost, g - d * 0.6).rgb * vec3(0.6, 1.0, 0.7) * 0.35;
    // halo ring
    vec2 hv = normalize(vec2(0.5) - vUv + 1e-5) * 0.32;
    vec2 hd = (vUv - vec2(0.5)); hd.x *= uAspect;
    float hw = smoothstep(0.0, 0.5, length(hd));
    gh += texture2D(tGhost, vUv + hv).rgb * vec3(0.7, 0.85, 1.0) * 0.4 * hw;
    c += gh * uGhost;
  }
  // speed lines: radial streaks at the screen edges
  if (uLines > 0.0) {
    vec2 p = vUv - vec2(0.5, 0.47); p.x *= uAspect;
    float a = atan(p.y, p.x), r = length(p);
    float cell = floor(a * 38.0);
    float on = step(0.72, h1(cell * 7.13 + floor(uTime * 12.0 + h1(cell) * 9.0)));
    float streak = on * smoothstep(0.32, 0.62, r) * (0.5 + 0.5 * h1(cell + 3.1));
    float thin = 1.0 - smoothstep(0.0, 0.45, abs(fract(a * 38.0) - 0.5));
    c += vec3(0.9, 0.95, 1.0) * streak * thin * uLines * 0.7;
  }
  // vignette + goal flash (in HDR, before tone mapping)
  vec2 v = vUv - 0.5; v.x *= uAspect * 0.8;
  c *= 1.0 - uVig * smoothstep(0.35, 0.95, length(v));
  c += uFlashCol * uFlash;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createPost(renderer) {
  const P = { enabled: false, bloom: 0.9, ghost: 0, lines: 0, flash: 0, flashCol: new THREE.Color(1, 0.9, 0.6), vig: 0.35, levels: 4 };
  const caps = renderer.capabilities;
  const ext = renderer.extensions;
  P.supported = caps.isWebGL2 && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'));
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quad.frustumCulled = false; scene.add(quad);
  const mk = (fs, uni) => new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms: uni, depthTest: false, depthWrite: false, toneMapped: false });
  const mBright = mk(BRIGHT_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1.0 }, uKnee: { value: 0.5 } });
  const mDown = mk(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const mUp = mk(UP_FS, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const mComp = new THREE.ShaderMaterial({
    vertexShader: QUAD_VS, fragmentShader: COMP_FS, depthTest: false, depthWrite: false,
    uniforms: {
      tScene: { value: null }, tBloom: { value: null }, tGhost: { value: null }, uBloom: { value: 1 }, uGhost: { value: 0 }, uLines: { value: 0 },
      uTime: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: P.flashCol }, uVig: { value: 0.35 }, uAspect: { value: 1 },
    },
  });
  P.materials = [mBright, mDown, mUp, mComp];
  let sceneRT = null, mips = [], ups = [], w = 0, h = 0, samples = 4;
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  function dispose() { if (sceneRT) sceneRT.dispose(); for (const m of mips) m.dispose(); for (const m of ups) m.dispose(); sceneRT = null; mips = []; ups = []; }
  function build() {
    dispose();
    if (!P.enabled || !w) return;
    sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false });
    let mw = Math.max(1, w >> 1), mh = Math.max(1, h >> 1);
    for (let i = 0; i < P.levels; i++) {
      mips.push(new THREE.WebGLRenderTarget(mw, mh, rtOpts));
      if (i < P.levels - 1) ups.push(new THREE.WebGLRenderTarget(mw, mh, rtOpts));
      mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1);
    }
  }
  P.setSize = (pw, ph) => { if (pw === w && ph === h && (sceneRT || !P.enabled)) return; w = pw; h = ph; build(); };
  P.setTier = (tier) => {
    const en = P.supported && tier > 0;
    const lv = tier >= 2 ? 5 : 4, sm = tier >= 2 ? 4 : 2;
    if (en !== P.enabled || lv !== P.levels || sm !== samples) { P.enabled = en; P.levels = lv; samples = sm; build(); }
  };
  function pass(mat, src, dst, texelFrom) {
    quad.material = mat;
    mat.uniforms.tSrc.value = src.texture;
    mat.uniforms.uTexel.value.set(1 / texelFrom.width, 1 / texelFrom.height);
    renderer.setRenderTarget(dst);
    renderer.render(scene, cam);
  }
  P.render = (sceneIn, camera, time) => {
    if (!P.enabled || !sceneRT) { renderer.setRenderTarget(null); renderer.render(sceneIn, camera); return; }
    renderer.setRenderTarget(sceneRT);
    renderer.render(sceneIn, camera);
    // bright pass -> mip0, then down the chain, then back up (additive tent)
    pass(mBright, sceneRT, mips[0], sceneRT);
    for (let i = 1; i < mips.length; i++) pass(mDown, mips[i - 1], mips[i], mips[i - 1]);
    let src = mips[mips.length - 1];
    for (let i = mips.length - 2; i >= 0; i--) {
      // tent-upsample the level below and add this level's mip
      quad.material = mUp; mUp.uniforms.tSrc.value = src.texture; mUp.uniforms.tBase.value = mips[i].texture;
      mUp.uniforms.uTexel.value.set(0.5 / src.width, 0.5 / src.height);
      renderer.setRenderTarget(ups[i]); renderer.render(scene, cam);
      src = ups[i];
    }
    const u = mComp.uniforms;
    u.tScene.value = sceneRT.texture; u.tBloom.value = src.texture; u.tGhost.value = mips[Math.min(2, mips.length - 1)].texture;
    u.uBloom.value = P.bloom; u.uGhost.value = P.ghost; u.uLines.value = P.lines; u.uTime.value = time; u.uFlash.value = P.flash; u.uVig.value = P.vig;
    u.uAspect.value = w / h;
    quad.material = mComp; renderer.setRenderTarget(null); renderer.render(scene, cam);
  };
  // compile every post program up front (shader prewarm)
  P.prewarm = () => { for (const m of P.materials) { quad.material = m; renderer.compile(scene, cam); } };
  return P;
}
