// Rendering helpers: instanced body groups, GPU point particles, kinematic glass shards.
import * as THREE from 'three';

const WHITE = new THREE.Color(1, 1, 1);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

// One InstancedMesh drawing many physics bodies (one draw call per group).
// A handle is { body, scale: Vector3, color?, yo?, k? } ; yo = extra y offset (intro drop), k = shrink factor.
export class IGroup {
  constructor(scene, geo, mat, cap, shadow = true) {
    const m = (this.mesh = new THREE.InstancedMesh(geo, mat, cap));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = shadow;
    m.receiveShadow = true;
    this.cap = cap;
    this.list = [];
    scene.add(m);
  }
  get full() { return this.list.length >= this.cap; }
  add(h) {
    if (this.list.length >= this.cap) return null;
    h.i = this.list.length;
    h.g = this;
    this.list.push(h);
    this.mesh.setColorAt(h.i, h.color || WHITE);
    this.mesh.instanceColor.needsUpdate = true;
    return h;
  }
  remove(h) {
    const i = h.i;
    if (i == null || i < 0 || this.list[i] !== h) return;
    const last = this.list.pop();
    if (last !== h) {
      this.list[i] = last;
      last.i = i;
      this.mesh.setColorAt(i, last.color || WHITE);
      this.mesh.instanceColor.needsUpdate = true;
    }
    h.i = -1;
  }
  update() {
    const L = this.list, mesh = this.mesh;
    for (let i = 0; i < L.length; i++) {
      const h = L[i], b = h.body;
      const p = b.interpolatedPosition, q = b.interpolatedQuaternion;
      _p.set(p.x, p.y + (h.yo || 0), p.z);
      _q.set(q.x, q.y, q.z, q.w);
      const k = h.k === undefined ? 1 : h.k;
      _s.set(h.scale.x * k, h.scale.y * k, h.scale.z * k);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = L.length;
    mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (const h of this.list) h.i = -1; this.list.length = 0; }
}

// ---------------------------------------------------------------- particles
const PVS = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
uniform float uScale;
varying float vA; varying vec3 vC;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vA = aAlpha; vC = aColor;
}`;
const PFS = `
uniform float uStar;
varying float vA; varying vec3 vC;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float a = (1.0 - r); a *= a;
  if (uStar > 0.5) {
    a += 0.8 * max(0.0, 1.0 - abs(d.x) * 16.0) * (1.0 - r) + 0.8 * max(0.0, 1.0 - abs(d.y) * 16.0) * (1.0 - r);
  } else {
    a = smoothstep(1.0, 0.35, r);
  }
  gl_FragColor = vec4(vC, a * vA);
}`;

export class Particles {
  constructor(scene, max, { additive = false, star = false } = {}) {
    this.max = max;
    this.n = 0;
    const F = (k) => new Float32Array(max * k);
    this.pos = F(3); this.col = F(3); this.alpha = F(1); this.size = F(1);
    this.vel = F(3); this.life = F(1); this.ml = F(1); this.s0 = F(1); this.grow = F(1);
    this.grav = F(1); this.drag = F(1); this.a0 = F(1);
    const g = (this.geo = new THREE.BufferGeometry());
    const mk = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', mk(this.pos, 3));
    g.setAttribute('aColor', mk(this.col, 3));
    g.setAttribute('aAlpha', mk(this.alpha, 1));
    g.setAttribute('aSize', mk(this.size, 1));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 }, uStar: { value: star ? 1 : 0 } },
      vertexShader: PVS, fragmentShader: PFS,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, size, r, g, b, grav = 0, drag = 0, grow = 0, alpha = 1) {
    let i = this.n;
    if (i >= this.max) i = (Math.random() * this.max) | 0; else this.n++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.life[i] = this.ml[i] = life;
    this.size[i] = this.s0[i] = size;
    this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
    this.alpha[i] = this.a0[i] = alpha;
  }
  _copy(d, s) {
    const d3 = d * 3, s3 = s * 3;
    for (let k = 0; k < 3; k++) { this.pos[d3 + k] = this.pos[s3 + k]; this.vel[d3 + k] = this.vel[s3 + k]; this.col[d3 + k] = this.col[s3 + k]; }
    this.life[d] = this.life[s]; this.ml[d] = this.ml[s]; this.size[d] = this.size[s]; this.s0[d] = this.s0[s];
    this.grav[d] = this.grav[s]; this.drag[d] = this.drag[s]; this.grow[d] = this.grow[s];
    this.alpha[d] = this.alpha[s]; this.a0[d] = this.a0[s];
  }
  update(dt) {
    let n = this.n;
    const P = this.pos, V = this.vel;
    for (let i = 0; i < n;) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { n--; if (i !== n) this._copy(i, n); continue; }
      const i3 = i * 3, dr = Math.max(0, 1 - this.drag[i] * dt);
      V[i3] *= dr; V[i3 + 1] = V[i3 + 1] * dr - this.grav[i] * dt; V[i3 + 2] *= dr;
      P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      if (P[i3 + 1] < 0.02) { P[i3 + 1] = 0.02; V[i3 + 1] *= -0.3; V[i3] *= 0.7; V[i3 + 2] *= 0.7; }
      const t = this.life[i] / this.ml[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 1.6);
      this.size[i] = this.s0[i] + this.grow[i] * (1 - t);
      i++;
    }
    this.n = n;
    const g = this.geo.attributes;
    g.position.needsUpdate = g.aColor.needsUpdate = g.aAlpha.needsUpdate = g.aSize.needsUpdate = true;
    this.geo.setDrawRange(0, n);
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

// ---------------------------------------------------------------- glass shards
// Shards are not physics bodies: simple ballistic kinematics + ground bounce (cheap, hundreds at once).
// Each shard is a unit triangular prism deformed by an affine matrix L (any triangle shape, one InstancedMesh).
function prismGeometry() {
  const v = [[-1 / 3, -1 / 3], [2 / 3, -1 / 3], [-1 / 3, 2 / 3]];
  const pos = [];
  const P = (a, z) => pos.push(v[a][0], v[a][1], z);
  P(0, 0.5); P(1, 0.5); P(2, 0.5);
  P(0, -0.5); P(2, -0.5); P(1, -0.5);
  for (let i = 0; i < 3; i++) {
    const a = i, b = (i + 1) % 3;
    P(a, -0.5); P(b, -0.5); P(b, 0.5);
    P(a, -0.5); P(b, 0.5); P(a, 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const _dq = new THREE.Quaternion(), _ax = new THREE.Vector3(), _n = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0), ZAX = new THREE.Vector3(0, 0, 1);

export class Shards {
  constructor(scene, mat, max) {
    this.max = max;
    this.list = [];
    this.mesh = new THREE.InstancedMesh(prismGeometry(), mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
    this.dirty = true;
  }
  // p: Vector3 world centroid, q: Quaternion, L: Matrix4 (local affine), v: Vector3 velocity, w: Vector3 angular velocity
  spawn(p, q, L, v, w, color, life) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ p: p.clone(), q: q.clone(), L, v: v.clone(), w: w.clone(), color, life, rest: false, tq: null });
    this.dirty = true;
  }
  fadeAll(t) { for (const s of this.list) s.life = Math.min(s.life, t * (0.6 + Math.random() * 0.4)); }
  push(x, y, z, R, power) {
    for (const s of this.list) {
      const dx = s.p.x - x, dy = s.p.y - y, dz = s.p.z - z, d = Math.hypot(dx, dy, dz);
      if (d < R && d > 1e-3) {
        const f = (1 - d / R) * power / d;
        s.v.x += dx * f; s.v.y += dy * f + 2 * (1 - d / R); s.v.z += dz * f;
        s.rest = false; s.tq = null; s.w.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
      }
    }
  }
  update(dt) {
    const L = this.list;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const s = L[i];
      s.life -= dt;
      if (s.life <= 0) { this.dirty = true; continue; }
      if (!s.rest) {
        s.v.y -= 9.82 * dt;
        s.p.addScaledVector(s.v, dt);
        const wl = s.w.length();
        if (wl > 1e-4) { _ax.copy(s.w).divideScalar(wl); _dq.setFromAxisAngle(_ax, wl * dt); s.q.premultiply(_dq); }
        if (s.p.y < 0.012) {
          s.p.y = 0.012;
          if (s.v.y < 0) s.v.y = -s.v.y * 0.25;
          s.v.x *= 0.55; s.v.z *= 0.55; s.w.multiplyScalar(0.4);
          if (!s.tq) { _n.copy(ZAX).applyQuaternion(s.q); s.tq = new THREE.Quaternion().setFromUnitVectors(_n, _n.y >= 0 ? UP : DOWN).multiply(s.q); }
          if (s.v.lengthSq() < 0.25) { s.rest = true; s.v.set(0, 0, 0); }
        }
      } else if (s.tq) {
        s.q.slerp(s.tq, Math.min(1, dt * 10));
      }
      if (w !== i) L[w] = s;
      w++;
    }
    L.length = w;
    const mesh = this.mesh;
    for (let i = 0; i < w; i++) {
      const s = L[i];
      const k = s.life < 0.4 ? s.life / 0.4 : 1;
      _s.set(k, k, k);
      _m.compose(s.p, s.q, _s).multiply(s.L);
      mesh.setMatrixAt(i, _m);
      if (this.dirty) mesh.setColorAt(i, s.color);
    }
    if (this.dirty) { mesh.instanceColor.needsUpdate = true; this.dirty = false; }
    mesh.count = w;
    mesh.instanceMatrix.needsUpdate = true;
  }
}
