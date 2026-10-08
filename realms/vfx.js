// vfx.js: pooled, cheap battle effects for Hex Realms.
//
//   const vfx = createVfx(THREE, bscene);
//   vfx.projectile(kind, from, to, onHit) -> flight time (s)
//       kind: 'arrow' | 'holy' | 'death' | 'boulder' | 'tower' | 'magic' | 'fireball'
//   vfx.hit(pos, kind)        kind: 'melee' | 'heavy' | 'arrow' | 'holy' | 'death' | 'rock' | 'fire' | 'magic' | 'lucky'
//   vfx.death(mesh, opts)     dissolves the unit group into motes, shrinks it, hides it (≈0.55 s). opts: { undead }
//   vfx.spell(id, pos, targets, opts) -> time (s) until the spell lands. opts: { side } (caster side, 0 = bottom)
//   vfx.sparkle(pos, color)   color: 'morale' | 'luck' | hex number | THREE.Color
//   vfx.select(target, color) persistent glow ring under a stack (Object3D or Vector3); select(null) hides it
//   vfx.update(dt, camera?)   call once per frame while the battle is shown
//   vfx.clear()               kill every effect (battle exit); dead meshes are restored to their old scale
//
// Everything renders in ~6 draw calls: two point pools (additive + alpha), one additive streak buffer,
// plus a handful of pooled decals / sprites / light columns that are only visible while in use.
// Textures: one 256² atlas, one 256² rune circle, two 128² gradients. No external assets.

export const SHOT_KIND = { lich: 'death', powerlich: 'death', monk: 'holy', zealot: 'holy', cyclops: 'boulder' };
export const shotKind = (unitId) => SHOT_KIND[unitId] || 'arrow';
export const meleeKind = (u) => (u && u.tier >= 6 ? 'heavy' : 'melee');

const TAU = Math.PI * 2;
const rand = Math.random;
const rr = (a, b) => a + (b - a) * rand();
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ------------------------------------------------------------------ canvas textures
function canvasTex(THREE, size, draw, flipY = false) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(cv); t.flipY = flipY; t.needsUpdate = true;
  return t;
}
function radial(g, x, y, r, stops) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
// 2×2 atlas of 128² tiles: 0 soft glow, 1 four-point star, 2 smoke puff, 3 shaded shard
function makeAtlas(THREE) {
  return canvasTex(THREE, 256, (g) => {
    // 0 glow
    radial(g, 64, 64, 62, [[0, 1], [0.15, 0.9], [0.4, 0.38], [0.7, 0.09], [1, 0]]);
    // 1 star
    g.save(); g.translate(192, 64);
    radial(g, 0, 0, 30, [[0, 1], [0.4, 0.5], [1, 0]]);
    const spike = (len, wid, rot, a) => {
      g.save(); g.rotate(rot); g.scale(1, wid / len);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, len);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.35, `rgba(255,255,255,${a * 0.45})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, len, 0, TAU); g.fill(); g.restore();
    };
    spike(62, 7, 0, 1); spike(62, 7, Math.PI / 2, 1); spike(36, 5, Math.PI / 4, 0.7); spike(36, 5, -Math.PI / 4, 0.7);
    g.restore();
    // 2 smoke puff (seeded blobs)
    let s = 7; const sr = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 14; i++) {
      const a = sr() * TAU, d = sr() * 26, r = 20 + sr() * 18;
      radial(g, 64 + Math.cos(a) * d, 192 + Math.sin(a) * d, r, [[0, 0.32], [0.55, 0.16], [1, 0]]);
    }
    // 3 shard: an irregular faceted chip with baked light
    g.save(); g.translate(192, 192);
    const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + sr() * 0.5; pts.push([Math.cos(a) * (34 + sr() * 18), Math.sin(a) * (34 + sr() * 18)]); }
    for (let i = 0; i < 6; i++) {
      const p = pts[i], q = pts[(i + 1) % 6], mid = Math.atan2(p[1] + q[1], p[0] + q[0]);
      const l = 0.62 + 0.38 * Math.max(0, Math.cos(mid + 2.3)); const v = Math.round(255 * l);
      g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.closePath(); g.fill();
    }
    g.restore();
  });
}
function makeRune(THREE) {
  return canvasTex(THREE, 256, (g, S) => {
    const c = S / 2; g.translate(c, c);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8; g.lineCap = 'round';
    const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); };
    ring(118, 4); ring(106, 2.5); ring(52, 3); ring(40, 1.5);
    // runes between the outer rings
    for (let i = 0; i < 18; i++) {
      g.save(); g.rotate((i / 18) * TAU); g.lineWidth = 2.5; g.beginPath();
      const k = i % 4;
      if (k === 0) { g.moveTo(-4, -109); g.lineTo(0, -115); g.lineTo(4, -109); }
      else if (k === 1) { g.moveTo(0, -108); g.lineTo(0, -116); g.moveTo(-4, -112); g.lineTo(4, -112); }
      else if (k === 2) { g.arc(0, -112, 3.5, 0, TAU); }
      else { g.moveTo(-4, -115); g.lineTo(4, -109); g.moveTo(-4, -109); g.lineTo(4, -115); }
      g.stroke(); g.restore();
    }
    // hexagram
    g.lineWidth = 3;
    for (const off of [0, Math.PI]) {
      g.beginPath();
      for (let i = 0; i <= 3; i++) { const a = off - Math.PI / 2 + (i / 3) * TAU; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 104, Math.sin(a) * 104); }
      g.stroke();
    }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * 104, Math.sin(a) * 104, 5, 0, TAU); g.fill(); }
    // soft inner fill so it reads as glowing ground
    g.shadowBlur = 0;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 120); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0.0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 120, 0, TAU); g.fill();
  });
}
const makeRing = (THREE) => canvasTex(THREE, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 63);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.82, 'rgba(255,255,255,1)'); gr.addColorStop(0.9, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const makeGlow = (THREE) => canvasTex(THREE, 128, (g) => radial(g, 64, 64, 63, [[0, 1], [0.12, 0.85], [0.35, 0.35], [0.65, 0.08], [1, 0]]));

// ------------------------------------------------------------------ shaders
const PT_VS = `
attribute vec4 aCol; attribute vec3 aMisc; uniform float uScale;
varying vec4 vCol; varying vec2 vTile; varying float vRot;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aMisc.x * uScale / max(0.1, -mv.z);
  vCol = aCol; vTile = vec2(mod(aMisc.y, 2.0), floor(aMisc.y * 0.5)); vRot = aMisc.z;
  if (aCol.a <= 0.003) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }
}`;
const PT_FS = `
uniform sampler2D map; varying vec4 vCol; varying vec2 vTile; varying float vRot;
void main() {
  vec2 p = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  if (abs(p.x) > 0.5 || abs(p.y) > 0.5) discard;
  vec2 uv = ((p + 0.5) * 0.96 + 0.02 + vTile) * 0.5;
  vec4 t = texture2D(map, uv);
  vec3 col = vCol.rgb * t.rgb;
#ifdef ADD
  float m = max(col.r, max(col.g, col.b));
  col = mix(col, vec3(m * 1.05), pow(max(t.a, 0.0), 6.0) * 0.3);
#endif
  gl_FragColor = vec4(col, vCol.a * t.a);
}`;
const ST_VS = `
attribute vec4 aCol; attribute float aV; varying vec4 vCol; varying float vV;
void main() { vCol = aCol; vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ST_FS = `
varying vec4 vCol; varying float vV;
void main() {
  float e = clamp(1.0 - vV * vV, 0.0, 1.0); float a = vCol.a * e * e;
  float m = max(vCol.r, max(vCol.g, vCol.b));
  vec3 col = mix(vCol.rgb, vec3(m * 1.05), pow(e, 8.0) * 0.3);
  gl_FragColor = vec4(col, a);
}`;
const COL_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const COL_FS = `
uniform vec3 uCol; uniform float uA; uniform float uT; varying vec2 vUv;
void main() {
  float v = clamp(vUv.y, 0.0, 1.0);
  float a = pow(1.0 - v, 1.6) * smoothstep(0.0, 0.08, v) + 0.25 * pow(1.0 - v, 6.0);
  float rays = 0.55 + 0.45 * sin(vUv.x * 6.2832 * 7.0 + uT * 3.0) * sin(vUv.x * 6.2832 * 3.0 - uT * 2.0 + v * 4.0);
  gl_FragColor = vec4(uCol * (0.8 + 0.6 * rays), uA * a * (0.55 + 0.45 * rays));
}`;

// ------------------------------------------------------------------ factory
export function createVfx(THREE, scene) {
  const V3 = THREE.Vector3;
  const root = new THREE.Group(); root.name = 'vfx'; scene.add(root);
  const camPos = new V3(0, 12.5, 7.3);
  const tmpV2 = new THREE.Vector2();
  const atlas = makeAtlas(THREE), runeTex = makeRune(THREE), ringTex = makeRing(THREE), glowTex = makeGlow(THREE);
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3();

  // ---------------- point pools
  function pointPool(n, additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), misc = new Float32Array(n * 3);
    const dyn = (arr, k) => new THREE.BufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', dyn(pos, 3)); geo.setAttribute('aCol', dyn(col, 4)); geo.setAttribute('aMisc', dyn(misc, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: atlas }, uScale: { value: 800 } }, vertexShader: PT_VS, fragmentShader: PT_FS,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, defines: additive ? { ADD: 1 } : {},
    });
    const obj = new THREE.Points(geo, mat); obj.frustumCulled = false; obj.renderOrder = additive ? 12 : 11;
    obj.onBeforeRender = (r, s, cam) => {
      const rt = r.getRenderTarget(); const h = rt ? rt.height : r.getDrawingBufferSize(tmpV2).y;
      mat.uniforms.uScale.value = h * 0.5 * cam.projectionMatrix.elements[5];
      camPos.setFromMatrixPosition(cam.matrixWorld);
    };
    root.add(obj);
    const F = () => new Float32Array(n);
    return { n, obj, geo, pos, col, misc, cur: 0, P: new Float32Array(n * 3), V: new Float32Array(n * 3), C: new Float32Array(n * 3), T: new Float32Array(n * 3),
      age: F(), max: F(), s0: F(), s1: F(), a0: F(), tile: F(), rot: F(), rv: F(), drag: F(), g: F(), fin: F(), ak: F(), ap: F(), floor: F(), live: 0 };
  }
  const ADD = pointPool(1600, true), ALP = pointPool(500, false);

  function slot(S) {
    for (let k = 0; k < S.n; k++) { const i = (S.cur + k) % S.n; if (S.max[i] === 0) { S.cur = (i + 1) % S.n; return i; } }
    const i = S.cur; S.cur = (S.cur + 1) % S.n; return i;
  }
  // o: { p, v, c:[r,g,b], life, s0, s1, a, tile, rot, rv, drag, g, fin, ap, at (attractor V3), ak, floor }
  function emit(S, p, o) {
    const i = slot(S), i3 = i * 3;
    S.P[i3] = p.x; S.P[i3 + 1] = p.y; S.P[i3 + 2] = p.z;
    const v = o.v; S.V[i3] = v ? v.x : 0; S.V[i3 + 1] = v ? v.y : 0; S.V[i3 + 2] = v ? v.z : 0;
    const c = o.c; S.C[i3] = c[0]; S.C[i3 + 1] = c[1]; S.C[i3 + 2] = c[2];
    S.age[i] = 0; S.max[i] = o.life || 0.5; S.s0[i] = o.s0 ?? 0.2; S.s1[i] = o.s1 ?? S.s0[i]; S.a0[i] = o.a ?? 1;
    S.tile[i] = o.tile || 0; S.rot[i] = o.rot ?? rand() * TAU; S.rv[i] = o.rv || 0; S.drag[i] = o.drag || 0; S.g[i] = o.g || 0;
    S.fin[i] = o.fin || 0; S.ap[i] = o.ap || 1; S.ak[i] = o.ak || 0; S.floor[i] = o.floor ? 1 : 0;
    if (o.at) { S.T[i3] = o.at.x; S.T[i3 + 1] = o.at.y; S.T[i3 + 2] = o.at.z; }
    return i;
  }
  function stepPool(S, dt) {
    let live = 0;
    for (let i = 0; i < S.n; i++) {
      const i3 = i * 3, i4 = i * 4;
      if (S.max[i] === 0) { if (S.col[i4 + 3] !== 0) S.col[i4 + 3] = 0; continue; }
      S.age[i] += dt;
      const k = S.age[i] / S.max[i];
      if (k >= 1) { S.max[i] = 0; S.col[i4 + 3] = 0; continue; }
      live++;
      const dr = Math.max(0, 1 - S.drag[i] * dt);
      let vx = S.V[i3] * dr, vy = S.V[i3 + 1] * dr - S.g[i] * dt, vz = S.V[i3 + 2] * dr;
      if (S.ak[i]) { const ak = S.ak[i] * dt; vx += (S.T[i3] - S.P[i3]) * ak; vy += (S.T[i3 + 1] - S.P[i3 + 1]) * ak; vz += (S.T[i3 + 2] - S.P[i3 + 2]) * ak; }
      let px = S.P[i3] + vx * dt, py = S.P[i3 + 1] + vy * dt, pz = S.P[i3 + 2] + vz * dt;
      if (S.floor[i] && py < 0.03) { py = 0.03; vy = Math.abs(vy) * 0.3; vx *= 0.55; vz *= 0.55; S.rv[i] *= 0.5; }
      S.V[i3] = vx; S.V[i3 + 1] = vy; S.V[i3 + 2] = vz; S.P[i3] = px; S.P[i3 + 1] = py; S.P[i3 + 2] = pz;
      S.rot[i] += S.rv[i] * dt;
      const fin = S.fin[i], a = S.a0[i] * (fin > 0 && k < fin ? k / fin : 1) * Math.pow(1 - (fin > 0 && k < fin ? 0 : (k - fin) / (1 - fin)), S.ap[i]);
      const ke = 1 - (1 - k) * (1 - k);
      S.pos[i3] = px; S.pos[i3 + 1] = py; S.pos[i3 + 2] = pz;
      S.col[i4] = S.C[i3]; S.col[i4 + 1] = S.C[i3 + 1]; S.col[i4 + 2] = S.C[i3 + 2]; S.col[i4 + 3] = a;
      S.misc[i3] = S.s0[i] + (S.s1[i] - S.s0[i]) * ke; S.misc[i3 + 1] = S.tile[i]; S.misc[i3 + 2] = S.rot[i];
    }
    S.live = live;
    const at = S.geo.attributes; at.position.needsUpdate = at.aCol.needsUpdate = at.aMisc.needsUpdate = true;
  }

  // ---------------- streaks: camera-facing quads, sparks (velocity-stretched) or fixed segments
  const SN = 700;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(SN * 12), sCol = new Float32Array(SN * 16), sV = new Float32Array(SN * 4), sIdx = new Uint16Array(SN * 6);
  for (let i = 0; i < SN; i++) { sV.set([-1, 1, -1, 1], i * 4); sIdx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6); }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute('aCol', new THREE.BufferAttribute(sCol, 4).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute('aV', new THREE.BufferAttribute(sV, 1));
  sGeo.setIndex(new THREE.BufferAttribute(sIdx, 1));
  const sMat = new THREE.ShaderMaterial({ vertexShader: ST_VS, fragmentShader: ST_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const sMesh = new THREE.Mesh(sGeo, sMat); sMesh.frustumCulled = false; sMesh.renderOrder = 13; root.add(sMesh);
  const ST = { A: new Float32Array(SN * 3), B: new Float32Array(SN * 3), V: new Float32Array(SN * 3), C: new Float32Array(SN * 3),
    age: new Float32Array(SN), max: new Float32Array(SN), w0: new Float32Array(SN), w1: new Float32Array(SN), a0: new Float32Array(SN),
    len: new Float32Array(SN), g: new Float32Array(SN), drag: new Float32Array(SN), tail: new Float32Array(SN), ak: new Float32Array(SN), T: new Float32Array(SN * 3), cur: 0 };
  function sslot() {
    for (let k = 0; k < SN; k++) { const i = (ST.cur + k) % SN; if (ST.max[i] === 0) { ST.cur = (i + 1) % SN; return i; } }
    const i = ST.cur; ST.cur = (ST.cur + 1) % SN; return i;
  }
  // spark: head at p moving with v; drawn from p - v*len to p
  function spark(p, v, o) {
    const i = sslot(), i3 = i * 3;
    ST.B[i3] = p.x; ST.B[i3 + 1] = p.y; ST.B[i3 + 2] = p.z; ST.V[i3] = v.x; ST.V[i3 + 1] = v.y; ST.V[i3 + 2] = v.z;
    ST.len[i] = o.len ?? 0.05; ST.C.set(o.c, i3); ST.age[i] = 0; ST.max[i] = o.life || 0.4; ST.w0[i] = o.w ?? 0.04; ST.w1[i] = o.w1 ?? ST.w0[i] * 0.3;
    ST.a0[i] = o.a ?? 1; ST.g[i] = o.g || 0; ST.drag[i] = o.drag || 0; ST.tail[i] = 0; ST.ak[i] = o.ak || 0;
    if (o.at) { ST.T[i3] = o.at.x; ST.T[i3 + 1] = o.at.y; ST.T[i3 + 2] = o.at.z; }
  }
  // fixed segment a→b (tail alpha factor `tail`)
  function seg(a, b, o) {
    const i = sslot(), i3 = i * 3;
    ST.A[i3] = a.x; ST.A[i3 + 1] = a.y; ST.A[i3 + 2] = a.z; ST.B[i3] = b.x; ST.B[i3 + 1] = b.y; ST.B[i3 + 2] = b.z;
    ST.V[i3] = ST.V[i3 + 1] = ST.V[i3 + 2] = 0; ST.len[i] = -1; ST.C.set(o.c, i3); ST.age[i] = 0; ST.max[i] = o.life || 0.2;
    ST.w0[i] = o.w ?? 0.05; ST.w1[i] = o.w1 ?? ST.w0[i]; ST.a0[i] = o.a ?? 1; ST.g[i] = 0; ST.drag[i] = 0; ST.tail[i] = o.tail ?? 1; ST.ak[i] = 0;
  }
  function stepStreaks(dt) {
    for (let i = 0; i < SN; i++) {
      const i3 = i * 3, o12 = i * 12, o16 = i * 16;
      if (ST.max[i] === 0) { if (sCol[o16 + 3] !== 0) { for (let j = 0; j < 4; j++) sCol[o16 + j * 4 + 3] = 0; sPos.fill(0, o12, o12 + 12); } continue; }
      ST.age[i] += dt; const k = ST.age[i] / ST.max[i];
      if (k >= 1) { ST.max[i] = 0; for (let j = 0; j < 4; j++) sCol[o16 + j * 4 + 3] = 0; sPos.fill(0, o12, o12 + 12); continue; }
      if (ST.len[i] >= 0) {
        const dr = Math.max(0, 1 - ST.drag[i] * dt);
        ST.V[i3] *= dr; ST.V[i3 + 1] = ST.V[i3 + 1] * dr - ST.g[i] * dt; ST.V[i3 + 2] *= dr;
        if (ST.ak[i]) { const ak = ST.ak[i] * dt; for (let j = 0; j < 3; j++) ST.V[i3 + j] += (ST.T[i3 + j] - ST.B[i3 + j]) * ak; }
        for (let j = 0; j < 3; j++) { ST.B[i3 + j] += ST.V[i3 + j] * dt; ST.A[i3 + j] = ST.B[i3 + j] - ST.V[i3 + j] * ST.len[i]; }
      }
      _a.set(ST.A[i3], ST.A[i3 + 1], ST.A[i3 + 2]); _b.set(ST.B[i3], ST.B[i3 + 1], ST.B[i3 + 2]);
      _c.subVectors(_b, _a); _d.addVectors(_a, _b).multiplyScalar(0.5).sub(camPos).negate();
      _c.cross(_d); const l = _c.length();
      const w = (ST.w0[i] + (ST.w1[i] - ST.w0[i]) * k) * 0.5;
      if (l < 1e-6) _c.set(w, 0, 0); else _c.multiplyScalar(w / l);
      sPos[o12] = _a.x - _c.x; sPos[o12 + 1] = _a.y - _c.y; sPos[o12 + 2] = _a.z - _c.z;
      sPos[o12 + 3] = _a.x + _c.x; sPos[o12 + 4] = _a.y + _c.y; sPos[o12 + 5] = _a.z + _c.z;
      sPos[o12 + 6] = _b.x - _c.x; sPos[o12 + 7] = _b.y - _c.y; sPos[o12 + 8] = _b.z - _c.z;
      sPos[o12 + 9] = _b.x + _c.x; sPos[o12 + 10] = _b.y + _c.y; sPos[o12 + 11] = _b.z + _c.z;
      const a = ST.a0[i] * (1 - k) * (k < 0.08 ? k / 0.08 * 0.5 + 0.5 : 1), at = a * ST.tail[i];
      for (let j = 0; j < 4; j++) { const o = o16 + j * 4; sCol[o] = ST.C[i3]; sCol[o + 1] = ST.C[i3 + 1]; sCol[o + 2] = ST.C[i3 + 2]; sCol[o + 3] = j < 2 ? at : a; }
    }
    sGeo.attributes.position.needsUpdate = sGeo.attributes.aCol.needsUpdate = true;
  }

  // ---------------- decals (flat on the ground, or at any height), pooled meshes
  const planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const decals = [];
  for (let i = 0; i < 18; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.Mesh(planeGeo, mat); m.visible = false; m.renderOrder = 10; m.frustumCulled = false; root.add(m);
    decals.push({ m, mat, max: 0, age: 0 });
  }
  // o: { tex:'ring'|'rune'|'glow', c:[r,g,b], s0, s1, life, a, fin, rv, y0, y1, follow, alpha:true for normal blending }
  function decal(p, o) {
    let d = decals.find((x) => x.max === 0) || decals.reduce((x, y) => (x.age / x.max > y.age / y.max ? x : y));
    d.max = o.life || 0.6; d.age = 0; d.o = o; d.px = p.x; d.pz = p.z;
    d.mat.map = o.tex === 'rune' ? runeTex : o.tex === 'glow' ? glowTex : ringTex;
    d.mat.blending = o.alpha ? THREE.NormalBlending : THREE.AdditiveBlending;
    d.mat.color.setRGB(o.c[0], o.c[1], o.c[2]); d.m.rotation.y = rand() * TAU; d.m.visible = true;
    d.m.position.set(p.x, o.y0 ?? 0.05, p.z); d.m.scale.setScalar(o.s0 ?? 1);
    d.mat.opacity = 0;
  }
  function stepDecals(dt) {
    for (const d of decals) {
      if (d.max === 0) continue;
      d.age += dt; const k = d.age / d.max, o = d.o;
      if (k >= 1) { d.max = 0; d.m.visible = false; continue; }
      const ke = 1 - Math.pow(1 - k, 3);
      if (o.follow) { d.px = o.follow.position.x; d.pz = o.follow.position.z; }
      const y = o.y1 !== undefined ? (o.y0 ?? 0.05) + (o.y1 - (o.y0 ?? 0.05)) * ke : o.y0 ?? 0.05;
      d.m.position.set(d.px, y, d.pz);
      d.m.scale.setScalar((o.s0 ?? 1) + ((o.s1 ?? o.s0 ?? 1) - (o.s0 ?? 1)) * ke);
      d.m.rotation.y += (o.rv || 0) * dt;
      const fin = o.fin ?? 0.1;
      d.mat.opacity = (o.a ?? 1) * (k < fin ? k / fin : Math.pow(1 - (k - fin) / (1 - fin), o.ap ?? 1.4));
    }
  }

  // ---------------- big billboard flashes (beyond point-size limits)
  const flashes = [];
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const s = new THREE.Sprite(mat); s.visible = false; s.renderOrder = 14; s.frustumCulled = false; root.add(s);
    flashes.push({ s, mat, max: 0, age: 0 });
  }
  function flash(p, c, s0, s1, life, a = 1) {
    const f = flashes.find((x) => x.max === 0) || flashes[0];
    f.max = life; f.age = 0; f.s0 = s0; f.s1 = s1; f.a = a; f.s.position.copy(p); f.mat.color.setRGB(c[0], c[1], c[2]); f.s.visible = true; f.s.scale.setScalar(s0); f.mat.opacity = a;
  }
  function stepFlashes(dt) {
    for (const f of flashes) {
      if (f.max === 0) continue;
      f.age += dt; const k = f.age / f.max;
      if (k >= 1) { f.max = 0; f.s.visible = false; continue; }
      f.s.scale.setScalar(f.s0 + (f.s1 - f.s0) * (1 - (1 - k) * (1 - k)));
      f.mat.opacity = f.a * Math.pow(1 - k, 1.6);
    }
  }

  // ---------------- light columns (bless, cure)
  const colGeo = new THREE.CylinderGeometry(0.42, 0.5, 3.2, 24, 1, true).translate(0, 1.6, 0);
  const columns = [];
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 0 }, uT: { value: 0 } }, vertexShader: COL_VS, fragmentShader: COL_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(colGeo, mat); m.visible = false; m.renderOrder = 12; m.frustumCulled = false; root.add(m);
    columns.push({ m, mat, max: 0, age: 0 });
  }
  function column(p, c, life, follow, w = 1) {
    const col = columns.find((x) => x.max === 0) || columns[0];
    col.max = life; col.age = 0; col.follow = follow; col.m.position.set(p.x, 0, p.z); col.m.scale.set(w, 1, w);
    col.mat.uniforms.uCol.value.setRGB(c[0], c[1], c[2]); col.m.visible = true;
  }
  function stepColumns(dt) {
    for (const c of columns) {
      if (c.max === 0) continue;
      c.age += dt; const k = c.age / c.max;
      if (k >= 1) { c.max = 0; c.m.visible = false; continue; }
      if (c.follow) c.m.position.set(c.follow.position.x, 0, c.follow.position.z);
      c.mat.uniforms.uT.value += dt;
      c.mat.uniforms.uA.value = (k < 0.18 ? k / 0.18 : Math.pow(1 - (k - 0.18) / 0.82, 1.3)) * 0.9;
      c.m.scale.y = 0.55 + 0.45 * Math.min(1, k / 0.25);
    }
  }

  // ---------------- projectile meshes: arrows and boulders
  const arrowGeo = (() => {
    const parts = [];
    const add = (g, col) => { g = g.toNonIndexed(); const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(col, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); parts.push(g); };
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5).rotateX(Math.PI / 2), [0.78, 0.55, 0.3]);
    add(new THREE.ConeGeometry(0.035, 0.1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.29), [0.92, 0.94, 1.0]);
    add(new THREE.PlaneGeometry(0.07, 0.13).rotateX(-Math.PI / 2).translate(0, 0, -0.2), [1, 0.95, 0.88]);
    add(new THREE.PlaneGeometry(0.13, 0.07).rotateY(Math.PI / 2).translate(0, 0, -0.2), [1, 0.4, 0.32]);
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); G.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return G;
  })();
  const arrowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const magicArrowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.6, 2.8), toneMapped: false, side: THREE.DoubleSide });
  const boulderGeo = (() => {
    const g = new THREE.IcosahedronGeometry(0.25, 1), p = g.attributes.position, c = new Float32Array(p.count * 3);
    const h = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.82 + 0.3 * h(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50));
      p.setXYZ(i, x * k, y * k * 0.9, z * k);
      const l = 0.62 + 0.25 * h(Math.round(x * 20) + 3, Math.round(y * 20), 1) + y * 0.6;
      c.set([l * 0.95, l * 0.86, l * 0.74], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
    return g;
  })();
  const boulderMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  const meshPool = { arrow: [], boulder: [] };
  const getMesh = (type) => {
    let m = meshPool[type].find((x) => !x.visible);
    if (!m) { m = new THREE.Mesh(type === 'boulder' ? boulderGeo : arrowGeo, type === 'boulder' ? boulderMat : arrowMat); if (type === 'boulder') m.castShadow = true; root.add(m); meshPool[type].push(m); }
    m.visible = true; m.scale.setScalar(1); return m;
  };

  // ---------------- timers: after(delay, fn), during(duration, fn(k, dt, age))
  const tasks = [];
  const after = (delay, fn) => tasks.push({ t: -delay, dur: 0, fn, once: true });
  const during = (dur, fn, delay = 0) => tasks.push({ t: -delay, dur, fn });
  function stepTasks(dt) {
    for (let i = tasks.length - 1; i >= 0; i--) {
      const T = tasks[i]; T.t += dt;
      if (T.t < 0) continue;
      if (T.once) { tasks.splice(i, 1); T.fn(); continue; }
      const k = Math.min(1, T.t / T.dur); T.fn(k, dt, T.t);
      if (k >= 1) tasks.splice(i, 1);
    }
  }
  // accumulate fractional emission counts so rates are frame-rate independent
  const rate = (T, perSec, dt, key = 'acc') => { T[key] = (T[key] || 0) + perSec * dt; const n = Math.floor(T[key]); T[key] -= n; return n; };

  // ---------------- helpers
  const vec = (x, y, z) => new V3(x, y, z);
  const posOf = (t) => (t && t.isObject3D ? t.position : t);
  const randDir = (out, up = 0) => { const a = rand() * TAU, z = rr(-1, 1) * (1 - up) + up * rand(); const r = Math.sqrt(1 - z * z); return out.set(Math.cos(a) * r, Math.abs(z) * (up ? 1 : Math.sign(z) || 1), Math.sin(a) * r); };
  const COLORS = {
    gold: [2.4, 1.8, 0.7], white: [2.2, 2.1, 1.9], spark: [2.6, 1.6, 0.6], holy: [2.2, 1.6, 0.6], death: [0.3, 1.6, 0.5], deathHalo: [1.1, 0.25, 1.8],
    magic: [0.6, 1.4, 2.8], fire: [2.2, 0.8, 0.2], ember: [3.0, 1.4, 0.4], green: [0.7, 2.4, 1.0], cyan: [0.6, 2.2, 2.6], purple: [1.4, 0.55, 2.4],
    dust: [0.86, 0.76, 0.6], rock: [0.78, 0.7, 0.6], smoke: [0.7, 0.64, 0.66],
  };
  const glowPt = (p, c, s0, s1, life, a = 1, v) => emit(ADD, p, { c, s0, s1, life, a, v, tile: 0 });
  function sparks(p, n, c, o = {}) {
    for (let i = 0; i < n; i++) {
      randDir(_a, o.up ?? 0.4).multiplyScalar(rr(o.min ?? 2, o.max ?? 5));
      if (o.dir) _a.addScaledVector(o.dir, rr(0.5, 1) * (o.push ?? 2));
      spark(p, _a, { c, life: rr(0.18, o.life ?? 0.35), w: o.w ?? 0.045, len: o.len ?? 0.045, g: o.g ?? 7, drag: o.drag ?? 2.5, a: o.a ?? 1 });
    }
  }
  function dust(p, n, c = COLORS.dust, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU, r = rr(0.05, o.r ?? 0.3), sp = rr(0.4, o.sp ?? 1.2);
      emit(ALP, vec(p.x + Math.cos(a) * r, 0.08 + rand() * 0.1, p.z + Math.sin(a) * r), { v: vec(Math.cos(a) * sp, rr(0.2, 0.7), Math.sin(a) * sp), c, s0: o.s0 ?? 0.25, s1: o.s1 ?? 0.75,
        life: rr(0.5, o.life ?? 0.9), a: o.a ?? 0.5, tile: 2, drag: 3, g: -0.15, rv: rr(-1, 1), fin: 0.1 });
    }
  }
  function stars(p, n, c, o = {}) {
    for (let i = 0; i < n; i++) {
      randDir(_a, o.up ?? 0.3).multiplyScalar(rr(o.min ?? 0.5, o.max ?? 2));
      emit(ADD, p, { v: _a, c, s0: rr(0.12, o.size ?? 0.26), s1: 0.02, life: rr(0.35, o.life ?? 0.7), tile: 1, rv: rr(-3, 3), drag: o.drag ?? 2.5, g: o.g ?? -0.5, a: o.a ?? 1 });
    }
  }

  // ---------------- impacts
  function hit(pos, kind = 'melee', opts = {}) {
    const p = vec(pos.x, pos.y || 0.5, pos.z), ground = vec(pos.x, 0, pos.z);
    const dir = opts.dir ? opts.dir.clone().setY(0).normalize() : null;
    if (kind === 'melee' || kind === 'heavy' || kind === 'lucky') {
      const big = kind !== 'melee' ? 1.5 : 1;
      glowPt(p, COLORS.white, 0.5 * big, 1.1 * big, 0.14);
      glowPt(p, COLORS.spark, 0.9 * big, 1.4 * big, 0.22, 0.55);
      emit(ADD, p, { c: [2.4, 2.0, 1.4], s0: 1.0 * big, s1: 0.6 * big, life: 0.16, tile: 1, rot: rand() * TAU });
      sparks(p, Math.round(12 * big), COLORS.spark, { dir, push: 2.5, min: 2.5, max: 5.5 * big });
      dust(ground, Math.round(4 * big), COLORS.dust, { sp: 1.2 * big });
      if (kind !== 'melee') { decal(ground, { tex: 'ring', c: [1.4, 1.0, 0.6], s0: 0.4, s1: 2.0, life: 0.4, a: 0.9, fin: 0.05 }); flash(p, [1.6, 1.1, 0.6], 1.0, 2.2, 0.22, 0.5); }
      if (kind === 'lucky') sparkle(ground, 'luck');
      return;
    }
    if (kind === 'arrow') {
      glowPt(p, COLORS.white, 0.35, 0.8, 0.12);
      sparks(p, 7, [2.4, 2.0, 1.4], { dir, push: 1.5, min: 1.5, max: 3.5, w: 0.035 });
      dust(ground, 2, COLORS.dust, { s1: 0.5 });
      return;
    }
    if (kind === 'fire') {
      glowPt(p, COLORS.ember, 0.6, 1.4, 0.25); flash(p, [2, 0.9, 0.3], 0.6, 1.8, 0.25, 0.6);
      sparks(p, 14, COLORS.ember, { min: 2, max: 5, g: 5 });
      for (let i = 0; i < 8; i++) emit(ADD, p, { v: randDir(_a, 0.5).multiplyScalar(rr(0.5, 1.5)), c: COLORS.fire, s0: 0.35, s1: 0.7, life: rr(0.3, 0.5), tile: 2, g: -1.5, drag: 3, a: 0.8 });
      return;
    }
    if (kind === 'holy') {
      glowPt(p, COLORS.holy, 0.8, 1.8, 0.3); flash(p, [2.2, 1.8, 1.0], 0.8, 2.6, 0.3, 0.8);
      stars(p, 18, COLORS.gold, { max: 2.6, size: 0.3 });
      decal(ground, { tex: 'ring', c: [2.0, 1.6, 0.7], s0: 0.3, s1: 1.9, life: 0.45, a: 0.9, fin: 0.05 });
      return;
    }
    if (kind === 'death') {
      glowPt(p, COLORS.death, 0.7, 1.5, 0.3); glowPt(p, COLORS.deathHalo, 1.2, 2.0, 0.4, 0.6);
      for (let i = 0; i < 14; i++) emit(ADD, p, { v: randDir(_a, 0.3).multiplyScalar(rr(0.8, 2.4)), c: rand() < 0.5 ? COLORS.death : COLORS.deathHalo, s0: rr(0.12, 0.22), s1: 0.02, life: rr(0.4, 0.8), drag: 2.5, g: -1.2 });
      for (let i = 0; i < 5; i++) emit(ALP, vec(p.x + rr(-0.2, 0.2), p.y, p.z + rr(-0.2, 0.2)), { v: vec(rr(-0.3, 0.3), rr(0.5, 1.0), rr(-0.3, 0.3)), c: [0.62, 0.5, 0.78], s0: 0.3, s1: 0.8, life: rr(0.6, 0.9), a: 0.4, tile: 2, drag: 1.5, fin: 0.15, rv: rr(-1, 1) });
      decal(ground, { tex: 'ring', c: [0.9, 0.5, 1.8], s0: 0.3, s1: 1.7, life: 0.45, a: 0.9, fin: 0.05 });
      return;
    }
    if (kind === 'magic') {
      glowPt(p, COLORS.magic, 0.8, 1.7, 0.28); flash(p, [1.0, 1.6, 2.6], 0.8, 2.4, 0.28, 0.8);
      sparks(p, 16, [1.2, 2.0, 3.0], { min: 2, max: 5, g: 2, w: 0.04 });
      stars(p, 10, [1.4, 2.0, 3.0], { max: 2 });
      decal(ground, { tex: 'ring', c: [0.8, 1.5, 2.6], s0: 0.3, s1: 1.8, life: 0.4, a: 0.9, fin: 0.05 });
      return;
    }
    if (kind === 'rock') {
      glowPt(p, [1.4, 1.2, 1.0], 0.6, 1.2, 0.12, 0.7);
      for (let i = 0; i < 14; i++) emit(ALP, p, { v: randDir(_a, 0.6).multiplyScalar(rr(1.5, 4)), c: COLORS.rock.map((x) => x * rr(0.8, 1.15)), s0: rr(0.1, 0.2), life: rr(0.6, 0.9), tile: 3, g: 9, rv: rr(-8, 8), floor: true, ap: 0.4 });
      dust(ground, 9, COLORS.dust, { r: 0.4, sp: 2.2, s1: 1.1, a: 0.55, life: 1.1 });
      decal(ground, { tex: 'ring', c: [1.0, 0.85, 0.65], s0: 0.4, s1: 2.4, life: 0.45, a: 0.7, fin: 0.05 });
      decal(ground, { tex: 'glow', c: [0.45, 0.36, 0.26], s0: 0.9, s1: 1.1, life: 1.6, a: 0.35, fin: 0.05, alpha: true });
      return;
    }
    hit(pos, 'melee', opts);
  }

  // ---------------- projectiles
  const shots = [];
  const PROJ = {
    arrow: { dur: (d) => clamp(d / 16, 0.22, 0.5), arc: 0.12, mesh: 'arrow', hit: 'arrow', scale: 1.3 },
    tower: { dur: (d) => clamp(d / 14, 0.3, 0.6), arc: 0.15, mesh: 'arrow', hit: 'fire', scale: 1.8 },
    holy: { dur: (d) => clamp(d / 11, 0.3, 0.6), arc: 0.05, hit: 'holy' },
    death: { dur: (d) => clamp(d / 11, 0.3, 0.6), arc: 0.06, hit: 'death' },
    boulder: { dur: (d) => clamp(d / 9, 0.45, 0.75), arc: 0.35, mesh: 'boulder', hit: 'rock' },
    magic: { dur: (d) => clamp(d / 13, 0.3, 0.55), arc: 0.0, mesh: 'arrow', hit: 'magic', glowArrow: true, scale: 1.3 },
    fireball: { dur: () => 0.45, arc: 0.1, hit: null },
  };
  function projectile(kind, from, to, onHit) {
    const P = PROJ[kind] || PROJ.arrow;
    const a = vec(from.x, from.y ?? 0.5, from.z), b = vec(to.x, to.y ?? 0.5, to.z), d = a.distanceTo(b);
    const s = { kind, P, a, b, dur: P.dur(d), arc: d * P.arc, t: 0, onHit, prev: a.clone(), cur: a.clone(), dist: d, spin: vec(rr(-12, 12), rr(-12, 12), rr(-12, 12)) };
    if (P.mesh) { s.mesh = getMesh(P.mesh); s.mesh.position.copy(a); if (P.scale) s.mesh.scale.setScalar(P.scale); s.mesh.material = P.mesh === 'boulder' ? boulderMat : P.glowArrow ? magicArrowMat : arrowMat; }
    shots.push(s);
    // muzzle: a small burst at the shooter
    if (kind === 'holy') { glowPt(a, COLORS.holy, 0.5, 1.2, 0.25); stars(a, 6, COLORS.gold, { max: 1.2 }); }
    else if (kind === 'death') { glowPt(a, COLORS.deathHalo, 0.6, 1.2, 0.25); }
    else if (kind === 'magic') { glowPt(a, COLORS.magic, 0.6, 1.2, 0.2); }
    else if (kind === 'boulder') dust(vec(a.x, 0, a.z), 4, COLORS.dust);
    return s.dur;
  }
  const pathAt = (s, k, out) => out.lerpVectors(s.a, s.b, k).setY(s.a.y + (s.b.y - s.a.y) * k + s.arc * 4 * k * (1 - k));
  function stepShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      s.prev.copy(s.cur); pathAt(s, k, s.cur);
      const p = s.cur, kind = s.kind;
      if (s.mesh) {
        s.mesh.position.copy(p);
        if (kind === 'boulder') { s.mesh.rotation.x += s.spin.x * dt; s.mesh.rotation.y += s.spin.y * dt; }
        else s.mesh.lookAt(pathAt(s, Math.min(1, k + 0.02), _b).addScaledVector(_c.subVectors(s.b, s.a).normalize(), k >= 0.98 ? 1 : 0));
      }
      const moved = s.prev.distanceTo(p) > 1e-4;
      if (kind === 'arrow' && moved) seg(s.prev, p, { c: [1.6, 1.5, 1.25], w: 0.05, w1: 0.0, life: 0.2, a: 0.5 });
      else if (kind === 'tower') {
        if (moved) seg(s.prev, p, { c: COLORS.fire, w: 0.12, w1: 0.02, life: 0.3, a: 0.8 });
        glowPt(p, COLORS.ember, 0.4, 0.2, 0.12, 0.9);
        if (rand() < 0.6) spark(p, randDir(_a, 0.5).multiplyScalar(rr(0.5, 1.5)), { c: COLORS.ember, life: 0.35, w: 0.03, len: 0.06, g: 2 });
      } else if (kind === 'holy') {
        glowPt(p, COLORS.holy, 0.55, 0.35, 0.1);
        glowPt(p, [1.4, 1.0, 0.45], 1.1, 0.7, 0.08, 0.45);
        if (moved) seg(s.prev, p, { c: [1.6, 1.1, 0.3], w: 0.2, w1: 0.02, life: 0.35, a: 0.6 });
        for (let j = rate(s, 50, dt); j > 0; j--) emit(ADD, p, { v: randDir(_a, 0).multiplyScalar(rr(0.2, 0.7)), c: COLORS.gold, s0: rr(0.12, 0.22), s1: 0.02, life: rr(0.4, 0.6), tile: 1, rv: rr(-3, 3), drag: 1.5 });
      } else if (kind === 'death') {
        glowPt(p, [1.0, 0.35, 1.9], 0.5, 0.3, 0.1);
        glowPt(p, [0.45, 0.1, 0.9], 1.0, 0.6, 0.1, 0.7);
        if (moved) seg(s.prev, p, { c: [0.8, 0.3, 1.6], w: 0.16, w1: 0.02, life: 0.3, a: 0.7 });
        const ang = s.t * 26;
        _c.subVectors(s.b, s.a).normalize(); _d.set(-_c.z, 0, _c.x);
        for (const sg of [1, -1]) emit(ADD, _a.copy(p).addScaledVector(_d, Math.cos(ang) * 0.18 * sg).setY(p.y + Math.sin(ang) * 0.18 * sg), { c: sg > 0 ? COLORS.death : COLORS.deathHalo, s0: 0.16, s1: 0.03, life: 0.3 });
        for (let j = rate(s, 30, dt); j > 0; j--) emit(ALP, p, { v: vec(rr(-0.2, 0.2), rr(0.2, 0.5), rr(-0.2, 0.2)), c: [0.55, 0.35, 0.75], s0: 0.2, s1: 0.55, life: 0.5, a: 0.35, tile: 2, rv: rr(-1, 1) });
      } else if (kind === 'boulder') {
        for (let j = rate(s, 22, dt); j > 0; j--) emit(ALP, p, { v: vec(rr(-0.2, 0.2), rr(0, 0.3), rr(-0.2, 0.2)), c: COLORS.dust, s0: 0.18, s1: 0.45, life: 0.45, a: 0.35, tile: 2, rv: rr(-1, 1) });
      } else if (kind === 'magic') {
        glowPt(p, COLORS.magic, 0.6, 0.3, 0.1);
        if (moved) seg(s.prev, p, { c: [0.35, 0.9, 2.4], w: 0.18, w1: 0.02, life: 0.3, a: 0.8 });
        for (let j = rate(s, 40, dt); j > 0; j--) emit(ADD, p, { v: randDir(_a, 0).multiplyScalar(rr(0.2, 0.8)), c: [1.2, 1.9, 3.0], s0: rr(0.1, 0.18), s1: 0.02, life: 0.45, tile: 1, rv: rr(-3, 3), drag: 1.5 });
      } else if (kind === 'fireball') {
        glowPt(p, [2.4, 1.4, 0.5], 0.75, 0.5, 0.08);
        glowPt(p, COLORS.fire, 1.3, 0.8, 0.1, 0.7);
        if (moved) seg(s.prev, p, { c: COLORS.fire, w: 0.4, w1: 0.05, life: 0.3, a: 0.7 });
        for (let j = rate(s, 70, dt); j > 0; j--) emit(ADD, _a.copy(p).add(randDir(_b).multiplyScalar(0.12)), { v: vec(rr(-0.3, 0.3), rr(0.2, 0.8), rr(-0.3, 0.3)), c: rand() < 0.5 ? COLORS.fire : [2.0, 0.55, 0.15], s0: rr(0.3, 0.5), s1: 0.1, life: rr(0.25, 0.45), tile: 2, rv: rr(-2, 2) });
        for (let j = rate(s, 14, dt, 'acc2'); j > 0; j--) emit(ALP, p, { v: vec(0, 0.4, 0), c: COLORS.smoke, s0: 0.3, s1: 0.8, life: 0.6, a: 0.3, tile: 2, fin: 0.3, rv: rr(-1, 1) });
      }
      if (k >= 1) {
        shots.splice(i, 1);
        if (s.mesh) s.mesh.visible = false;
        if (s.P.hit) hit(s.b, s.P.hit, { dir: _c.subVectors(s.b, s.a) });
        if (s.onHit) s.onHit();
      }
    }
  }

  // ---------------- death: dissolve into the unit's own colours
  const dying = [];
  function death(mesh, opts = {}) {
    if (!mesh) return 0.55;
    mesh.updateMatrixWorld(true);
    const srcs = []; mesh.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) srcs.push(o); });
    const base = vec(mesh.position.x, 0, mesh.position.z), sc = mesh.scale.x || 1;
    const undead = !!opts.undead;
    for (let i = 0; i < 110 && srcs.length; i++) {
      const src = srcs[rand() < 0.85 ? 0 : (rand() * srcs.length) | 0], g = src.geometry, pa = g.attributes.position, ca = g.attributes.color;
      const j = (rand() * pa.count) | 0;
      _a.fromBufferAttribute(pa, j).applyMatrix4(src.matrixWorld);
      const c = ca ? [ca.getX(j), ca.getY(j), ca.getZ(j)] : [0.8, 0.8, 0.8];
      const m = Math.max(c[0], c[1], c[2], 0.05), boost = 1.5 / m * 0.6 + 0.5;
      const cc = [Math.min(2.2, c[0] * boost + 0.2), Math.min(2.2, c[1] * boost + 0.2), Math.min(2.2, c[2] * boost + 0.2)];
      _b.subVectors(_a, base).setY(0).normalize().multiplyScalar(rr(0.2, 0.7));
      emit(ADD, _a, { v: vec(_b.x + rr(-0.2, 0.2), rr(0.3, 1.4), _b.z + rr(-0.2, 0.2)), c: cc, s0: rr(0.07, 0.13) * sc, s1: 0.02, life: rr(0.55, 1.1), drag: 1.8, g: -1.4, fin: 0.12, tile: rand() < 0.25 ? 1 : 0, rv: rr(-4, 4) });
    }
    // a soft poof at the feet
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rand() * 0.5;
      emit(ALP, vec(base.x + Math.cos(a) * 0.15, rr(0.1, 0.45), base.z + Math.sin(a) * 0.15), { v: vec(Math.cos(a) * rr(0.8, 1.4), rr(0.2, 0.7), Math.sin(a) * rr(0.8, 1.4)), c: undead ? [0.75, 0.85, 0.78] : [0.92, 0.88, 0.95], s0: 0.3, s1: 0.9, life: rr(0.6, 0.9), a: 0.35, tile: 2, drag: 3, fin: 0.1, rv: rr(-1, 1) });
    }
    decal(base, { tex: 'glow', c: undead ? [0.5, 1.4, 0.8] : [1.4, 1.3, 1.0], s0: 1.4, s1: 1.8, life: 0.6, a: 0.7, fin: 0.1 });
    // a little soul rising
    const soul = { p: vec(base.x, 0.6, base.z), ph: rand() * TAU };
    const sc1 = undead ? [0.8, 2.2, 1.2] : [2.2, 2.0, 1.5];
    during(1.0, (k, dt, age) => {
      _a.copy(soul.p);
      soul.p.set(base.x + Math.sin(age * 7 + soul.ph) * 0.12, 0.6 + age * 1.4, base.z + Math.cos(age * 7 + soul.ph) * 0.12);
      const fade = 1 - k;
      glowPt(soul.p, sc1, 0.35 * fade + 0.05, 0.1, 0.08, fade);
      seg(_a, soul.p, { c: sc1, w: 0.12 * fade, w1: 0, life: 0.3, a: 0.6 * fade });
    }, 0.15);
    dying.push({ mesh, t: 0, s: mesh.scale.clone(), y0: mesh.position.y });
    return 0.55;
  }
  function stepDying(dt) {
    for (let i = dying.length - 1; i >= 0; i--) {
      const D = dying[i]; D.t += dt; const k = Math.min(1, D.t / 0.55), m = D.mesh;
      const xz = 1 + 0.25 * Math.sin(Math.min(1, k * 1.6) * Math.PI) - 0.7 * k * k;
      m.scale.set(D.s.x * xz, D.s.y * Math.pow(1 - k, 1.2) + 0.0001, D.s.z * xz);
      m.position.y = D.y0 - 0.05 * k;
      if (k >= 1) { m.visible = false; m.scale.copy(D.s); m.position.y = D.y0; dying.splice(i, 1); }
    }
  }

  // ---------------- sparkles (morale, luck)
  function sparkle(pos, color = 'morale') {
    const c = color === 'luck' ? [1.0, 2.6, 0.9] : color === 'morale' ? [2.6, 2.0, 0.7] : (() => { const C = color.isColor ? color : new THREE.Color(color); return [C.r * 2.2, C.g * 2.2, C.b * 2.2]; })();
    const c2 = color === 'luck' ? [2.4, 2.4, 1.0] : [2.6, 2.4, 1.8];
    const b = vec(pos.x, 0, pos.z);
    decal(b, { tex: 'ring', c: c.map((x) => x * 0.7), s0: 0.4, s1: 1.5, life: 0.6, a: 0.9, fin: 0.1 });
    during(0.6, (k, dt, age) => {
      for (let j = 0; j < 2; j++) {
        const a = age * 13 + j * Math.PI, r = 0.5 - k * 0.2;
        emit(ADD, vec(b.x + Math.cos(a) * r, 0.1 + k * 1.3, b.z + Math.sin(a) * r), { v: vec(0, 0.3, 0), c: j ? c : c2, s0: 0.24, s1: 0.03, life: 0.5, tile: 1, rv: 3 });
      }
    });
    after(0.6, () => { const top = vec(b.x, 1.45, b.z); stars(top, 18, c, { min: 1, max: 2.6, size: 0.3, g: 1.5, up: 0 }); glowPt(top, c, 0.45, 1.0, 0.3, 0.6); });
  }

  // ---------------- spells
  function lightning(a, b, w, life, branches = true) {
    const n = 10, pts = [];
    _c.subVectors(b, a);
    for (let i = 0; i <= n; i++) {
      const t = i / n, env = Math.sin(t * Math.PI) * 0.45;
      pts.push(vec(a.x + _c.x * t + rr(-1, 1) * env, a.y + _c.y * t, a.z + _c.z * t + rr(-1, 1) * env));
    }
    for (let i = 0; i < n; i++) {
      seg(pts[i], pts[i + 1], { c: [1.6, 2.0, 3.0], w, life, a: 1 });
      seg(pts[i], pts[i + 1], { c: [0.7, 1.0, 2.6], w: w * 4, life: life * 1.3, a: 0.35 });
    }
    if (branches) for (let i = 2; i < n - 1; i++) if (rand() < 0.35) {
      const s = pts[i], e = vec(s.x + rr(-1.2, 1.2), s.y - rr(0.8, 1.8), s.z + rr(-1.2, 1.2));
      const m = vec((s.x + e.x) / 2 + rr(-0.25, 0.25), (s.y + e.y) / 2, (s.z + e.z) / 2 + rr(-0.25, 0.25));
      seg(s, m, { c: [1.8, 2.2, 3.2], w: w * 0.5, life, a: 0.8 }); seg(m, e, { c: [1.8, 2.2, 3.2], w: w * 0.4, life, a: 0.6, tail: 1 });
    }
  }
  function spell(id, pos, targets = [], opts = {}) {
    const side = opts.side ?? 0, sdir = side === 0 ? 1 : -1;
    const ts = (targets.length ? targets : [pos]).map((t) => ({ o: t && t.isObject3D ? t : null, p: posOf(t) }));
    const T0 = ts[0], tp = vec(T0.p.x, 0, T0.p.z), body = vec(tp.x, 0.5, tp.z), center = vec(pos.x, 0, pos.z);
    const follow = T0.o;
    if (id === 'arrow') {
      decal(tp, { tex: 'rune', c: [0.6, 1.2, 2.2], s0: 1.0, s1: 1.25, life: 0.9, a: 0.9, rv: 2, fin: 0.15 });
      return projectile('magic', vec(tp.x * 0.4, 4.2, tp.z + 4.5 * sdir), body);
    }
    if (id === 'bolt') {
      decal(tp, { tex: 'rune', c: [0.6, 0.9, 2.4], s0: 1.4, s1: 1.1, life: 0.5, a: 0.9, rv: -3, fin: 0.3 });
      for (let i = 0; i < 6; i++) emit(ADD, vec(tp.x + rr(-0.4, 0.4), rr(0.1, 0.5), tp.z + rr(-0.4, 0.4)), { v: vec(0, rr(1, 2), 0), c: [1.0, 1.6, 3.0], s0: 0.12, s1: 0.02, life: 0.25, tile: 1 });
      const top = vec(tp.x + rr(-1, 1), 9, tp.z + rr(-1.5, -0.5));
      const strike = (w) => lightning(top, vec(tp.x, 0.35, tp.z), w, 0.13);
      after(0.12, () => {
        strike(0.13);
        flash(vec(tp.x, 0.5, tp.z), [0.7, 1.1, 2.4], 1.3, 3.2, 0.32, 0.7);
        flash(vec(top.x, 6, top.z), [1.0, 1.3, 2.2], 4, 9, 0.3, 0.45);
        sparks(vec(tp.x, 0.35, tp.z), 26, [1.8, 2.3, 3.2], { min: 2.5, max: 6.5, up: 0.5, g: 6 });
        decal(tp, { tex: 'ring', c: [1.0, 1.4, 2.8], s0: 0.4, s1: 2.8, life: 0.45, a: 1, fin: 0.04 });
        decal(tp, { tex: 'glow', c: [0.36, 0.3, 0.3], s0: 1.2, s1: 1.4, life: 2.0, a: 0.4, fin: 0.03, alpha: true });
        dust(tp, 7, COLORS.dust, { r: 0.4, sp: 2, s1: 1.0 });
      });
      after(0.22, () => strike(0.1));
      after(0.32, () => lightning(top, vec(tp.x, 0.35, tp.z), 0.07, 0.12, false));
      // crackle around the target afterwards
      during(0.5, () => {
        if (rand() < 0.5) return;
        const a = vec(tp.x + rr(-0.35, 0.35), rr(0.1, 1.0), tp.z + rr(-0.35, 0.35)), b = a.clone().add(randDir(_a).multiplyScalar(0.25));
        seg(a, b, { c: [1.6, 2.2, 3.2], w: 0.035, life: 0.08 });
      }, 0.15);
      return 0.12;
    }
    if (id === 'fireball') {
      const from = vec(center.x * 0.5 + rr(-0.5, 0.5), 5.5, center.z + 5 * sdir);
      const d = projectile('fireball', from, vec(center.x, 0.3, center.z), () => {
        const c = vec(center.x, 0.35, center.z);
        flash(c, [1.8, 0.6, 0.12], 1.4, 4.0, 0.35, 0.7);
        for (let i = 0; i < 14; i++) { const a = rand() * TAU, sp = rr(0.5, 3.5); emit(ADD, c, { v: vec(Math.cos(a) * sp, rr(0.3, 2.0), Math.sin(a) * sp), c: [1.6, 0.75, 0.18], s0: rr(0.5, 0.8), s1: 1.2, life: rr(0.2, 0.35), tile: 2, drag: 4, g: -1, rv: rr(-2, 2) }); }
        for (let i = 0; i < 30; i++) { const a = rand() * TAU, sp = rr(1, 4.5); emit(ADD, c, { v: vec(Math.cos(a) * sp, rr(0.2, 1.8), Math.sin(a) * sp), c: [1.3, 0.38, 0.07], s0: rr(0.45, 0.7), s1: 1.4, life: rr(0.4, 0.65), tile: 2, drag: 4, g: -1.5, rv: rr(-2, 2), ap: 1.3 }); }
        for (let i = 0; i < 22; i++) { const a = rand() * TAU, sp = rr(1, 4); emit(ADD, c, { v: vec(Math.cos(a) * sp, rr(0.5, 2.0), Math.sin(a) * sp), c: [0.9, 0.2, 0.05], s0: rr(0.5, 0.8), s1: 1.6, life: rr(0.6, 0.9), tile: 2, drag: 4, g: -1.8, rv: rr(-2, 2), fin: 0.15 }); }
        for (let i = 0; i < 18; i++) { const a = rand() * TAU, sp = rr(0.5, 2.5); emit(ALP, vec(c.x + Math.cos(a) * 0.4, rr(0.3, 0.8), c.z + Math.sin(a) * 0.4), { v: vec(Math.cos(a) * sp, rr(0.6, 1.6), Math.sin(a) * sp), c: COLORS.smoke.map((x) => x * rr(0.9, 1.1)), s0: 0.5, s1: 1.6, life: rr(0.9, 1.4), a: 0.4, tile: 2, drag: 2.5, fin: 0.35, rv: rr(-1, 1) }); }
        sparks(c, 30, COLORS.ember, { min: 3, max: 7, up: 0.6, g: 6, life: 0.6, w: 0.05, len: 0.05 });
        decal(center, { tex: 'ring', c: [2.4, 1.0, 0.3], s0: 0.6, s1: 3.6, life: 0.5, a: 1, fin: 0.04 });
        decal(center, { tex: 'glow', c: [1.4, 0.45, 0.1], s0: 3.2, s1: 3.6, life: 0.7, a: 0.8, fin: 0.05 });
        decal(center, { tex: 'glow', c: [0.3, 0.2, 0.14], s0: 2.6, s1: 2.8, life: 2.6, a: 0.45, fin: 0.03, alpha: true });
        for (const t of ts) if (t.o) glowPt(vec(t.p.x, 0.5, t.p.z), COLORS.ember, 0.6, 1.2, 0.25, 0.8);
      });
      decal(center, { tex: 'rune', c: [2.2, 0.9, 0.3], s0: 2.6, s1: 2.9, life: d + 0.2, a: 0.8, rv: 1.5, fin: 0.3 });
      return d;
    }
    if (id === 'bless') {
      column(tp, [1.8, 1.2, 0.35], 1.1, follow);
      decal(tp, { tex: 'rune', c: [2.0, 1.5, 0.5], s0: 1.2, s1: 1.35, life: 1.1, a: 0.9, rv: 1.2, fin: 0.2, follow });
      during(0.9, (k, dt) => {
        for (let j = 0; j < 2; j++) { const a = rand() * TAU, r = rr(0.1, 0.45); emit(ADD, vec(tp.x + Math.cos(a) * r, rr(0, 0.6), tp.z + Math.sin(a) * r), { v: vec(0, rr(0.8, 1.8), 0), c: rand() < 0.5 ? COLORS.gold : [2.6, 2.4, 1.8], s0: rr(0.12, 0.24), s1: 0.02, life: rr(0.5, 0.8), tile: 1, rv: rr(-3, 3), drag: 0.5 }); }
      });
      after(0.3, () => { glowPt(body, COLORS.holy, 0.8, 1.6, 0.3, 0.8); decal(tp, { tex: 'ring', c: [2.0, 1.6, 0.6], y0: 1.25, y1: 1.15, s0: 0.25, s1: 0.5, life: 0.9, a: 1, fin: 0.2, follow }); });
      return 0.3;
    }
    if (id === 'cure') {
      column(tp, [0.6, 2.2, 0.9], 1.0, follow, 0.9);
      decal(tp, { tex: 'ring', c: [0.6, 2.0, 0.8], s0: 0.3, s1: 1.6, life: 0.6, a: 1, fin: 0.05 });
      decal(tp, { tex: 'glow', c: [0.4, 1.4, 0.6], s0: 1.4, s1: 1.4, life: 1.0, a: 0.6, fin: 0.2, follow });
      during(0.85, (k, dt) => {
        for (let j = 0; j < 2; j++) { const a = rand() * TAU, r = rr(0.05, 0.45); emit(ADD, vec(tp.x + Math.cos(a) * r, rr(0, 0.5), tp.z + Math.sin(a) * r), { v: vec(0, rr(0.6, 1.5), 0), c: rand() < 0.6 ? COLORS.green : [1.8, 2.6, 1.6], s0: rr(0.1, 0.22), s1: 0.03, life: rr(0.5, 0.9), tile: rand() < 0.5 ? 1 : 0, rot: rand() < 0.5 ? 0 : Math.PI / 4, drag: 0.5 }); }
      });
      after(0.3, () => glowPt(body, COLORS.green, 0.9, 1.6, 0.35, 0.8));
      return 0.3;
    }
    if (id === 'stoneskin') {
      const at = vec(tp.x, 0.5, tp.z);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + rr(-0.2, 0.2), r = rr(1.0, 1.5);
        const p = vec(tp.x + Math.cos(a) * r, rr(0.1, 1.2), tp.z + Math.sin(a) * r);
        emit(ALP, p, { v: vec(-Math.sin(a) * 2.5, rr(1, 2), Math.cos(a) * 2.5), c: [0.8, 0.72, 0.6].map((x) => x * rr(0.85, 1.15)), s0: rr(0.14, 0.24), s1: 0.1, life: 0.45, tile: 3, at, ak: 40, drag: 7, rv: rr(-6, 6), fin: 0.15, ap: 0.5 });
      }
      decal(tp, { tex: 'rune', c: [1.3, 1.1, 0.75], s0: 1.4, s1: 1.1, life: 0.7, a: 0.7, rv: -2, fin: 0.2 });
      after(0.38, () => {
        flash(at, [1.6, 1.4, 1.0], 0.8, 2.0, 0.3, 0.6);
        stars(at, 14, [2.0, 1.7, 1.2], { min: 0.6, max: 1.8, size: 0.24 });
        dust(tp, 8, [0.82, 0.76, 0.68], { r: 0.4, sp: 1.6, s1: 0.9 });
        decal(tp, { tex: 'ring', c: [1.4, 1.2, 0.85], s0: 0.5, s1: 1.8, life: 0.45, a: 0.9, fin: 0.05 });
      });
      return 0.38;
    }
    if (id === 'haste') {
      decal(tp, { tex: 'ring', c: [0.6, 2.0, 2.4], s0: 0.4, s1: 1.9, life: 0.5, a: 1, fin: 0.05 });
      decal(tp, { tex: 'rune', c: [0.5, 1.6, 2.0], s0: 1.2, s1: 1.2, life: 0.9, a: 0.7, rv: 9, fin: 0.15, follow });
      during(0.7, (k, dt, age) => {
        for (let j = 0; j < 2; j++) {
          const a = rand() * TAU, y = rr(0.1, 1.1), r = 0.5;
          const ax = vec(tp.x, y + 0.4, tp.z);
          spark(vec(tp.x + Math.cos(a) * r, y, tp.z + Math.sin(a) * r), vec(-Math.sin(a) * 5, 1.2, Math.cos(a) * 5), { c: COLORS.cyan, life: rr(0.3, 0.45), w: 0.05, w1: 0.01, len: 0.06, at: ax, ak: 50, drag: 0.5, a: 0.9 });
        }
        if (rand() < 0.4) emit(ADD, vec(tp.x + rr(-0.4, 0.4), rr(0.1, 1), tp.z + rr(-0.4, 0.4)), { v: vec(0, 1, 0), c: [1.6, 2.6, 2.6], s0: 0.16, s1: 0.02, life: 0.4, tile: 1, rv: 4 });
      });
      return 0.25;
    }
    if (id === 'slow') {
      decal(tp, { tex: 'rune', c: [1.2, 0.5, 2.2], s0: 1.6, s1: 1.4, life: 1.3, a: 0.9, rv: -0.6, fin: 0.15, follow });
      // three rings press the target down, one after another
      decal(tp, { tex: 'ring', c: [1.3, 0.55, 2.4], y0: 1.5, y1: 0.06, s0: 1.2, s1: 0.75, life: 0.45, a: 0.9, fin: 0.2, ap: 0.6, follow });
      after(0.15, () => decal(tp, { tex: 'ring', c: [1.3, 0.55, 2.4], y0: 1.5, y1: 0.06, s0: 1.2, s1: 0.75, life: 0.45, a: 0.9, fin: 0.2, ap: 0.6, follow }));
      after(0.3, () => decal(tp, { tex: 'ring', c: [1.3, 0.55, 2.4], y0: 1.5, y1: 0.06, s0: 1.2, s1: 0.75, life: 0.45, a: 0.9, fin: 0.2, ap: 0.6, follow }));
      during(0.8, (k, dt) => {
        if (rand() < 0.6) emit(ADD, vec(tp.x + rr(-0.45, 0.45), rr(1.2, 1.7), tp.z + rr(-0.45, 0.45)), { v: vec(0, -0.5, 0), c: rand() < 0.5 ? COLORS.purple : [1.8, 1.2, 2.6], s0: rr(0.1, 0.2), s1: 0.05, life: rr(0.5, 0.7), g: 3, floor: true, fin: 0.1 });
      });
      after(0.45, () => dust(tp, 6, [0.78, 0.72, 0.8], { r: 0.4, sp: 1.2 }));
      return 0.3;
    }
    return 0.2;
  }

  // ---------------- selection ring
  const selMatR = new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const selMatG = selMatR.clone(); selMatG.map = ringTex;
  const selRune = new THREE.Mesh(planeGeo, selMatR), selGlow = new THREE.Mesh(planeGeo, selMatG);
  selRune.renderOrder = selGlow.renderOrder = 10; selRune.visible = selGlow.visible = false; root.add(selRune, selGlow);
  const sel = { target: null, c: [2, 1.6, 0.5], t: 0, acc: 0 };
  function select(target, color = 0xffd84a) {
    sel.target = target || null;
    const C = color && color.isColor ? color : new THREE.Color(color);
    sel.c = [C.r * 1.8, C.g * 1.8, C.b * 1.8];
    selMatR.color.setRGB(sel.c[0] * 0.75, sel.c[1] * 0.75, sel.c[2] * 0.75); selMatG.color.setRGB(sel.c[0], sel.c[1], sel.c[2]);
    selRune.visible = selGlow.visible = !!target;
  }
  function stepSelect(dt) {
    if (!sel.target) return;
    const p = posOf(sel.target); sel.t += dt;
    selRune.position.set(p.x, 0.045, p.z); selGlow.position.set(p.x, 0.05, p.z);
    selRune.rotation.y += dt * 0.7; selRune.scale.setScalar(0.98);
    const pu = Math.sin(sel.t * 4);
    selGlow.scale.setScalar(0.98 + 0.05 * pu); selMatG.opacity = 0.75 + 0.25 * pu; selMatR.opacity = 0.9;
    for (let j = rate(sel, 7, dt); j > 0; j--) { const a = rand() * TAU; emit(ADD, vec(p.x + Math.cos(a) * 0.4, 0.06, p.z + Math.sin(a) * 0.4), { v: vec(0, rr(0.3, 0.6), 0), c: sel.c, s0: rr(0.07, 0.12), s1: 0.02, life: rr(0.7, 1.1), fin: 0.2 }); }
  }

  function update(dt, camera) {
    dt = Math.min(dt, 0.05);
    if (camera) camPos.setFromMatrixPosition(camera.matrixWorld);
    stepTasks(dt); stepShots(dt); stepDying(dt); stepSelect(dt);
    stepPool(ADD, dt); stepPool(ALP, dt); stepStreaks(dt); stepDecals(dt); stepFlashes(dt); stepColumns(dt);
  }
  function clear() {
    tasks.length = 0;
    for (const s of shots) if (s.mesh) s.mesh.visible = false; shots.length = 0;
    for (const D of dying) { D.mesh.scale.copy(D.s); D.mesh.position.y = D.y0; } dying.length = 0;
    for (const S of [ADD, ALP]) { S.max.fill(0); S.col.fill(0); S.geo.attributes.aCol.needsUpdate = true; }
    ST.max.fill(0); sCol.fill(0); sGeo.attributes.aCol.needsUpdate = true;
    for (const d of decals) { d.max = 0; d.m.visible = false; }
    for (const f of flashes) { f.max = 0; f.s.visible = false; }
    for (const c of columns) { c.max = 0; c.m.visible = false; }
  }
  const busy = () => shots.length > 0 || dying.length > 0;
  return { _dbg: { ST, sPos, sCol }, projectile, hit, death, spell, sparkle, select, update, clear, busy, root, stats: () => ({ add: ADD.live, alpha: ALP.live, shots: shots.length }) };
}
