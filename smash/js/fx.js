// Rendering helpers: instanced body groups, GPU sprite particles (soft dust / streak sparks / glints),
// pooled kinematic glass shards. Everything is preallocated: no allocations per frame or per spawn.
import * as THREE from 'three';

const WHITE = new THREE.Color(1, 1, 1);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

// One InstancedMesh drawing many physics bodies (one draw call per group).
// A handle is { body, scale: Vector3, color, yo, k } ; yo = intro drop offset, k = shrink factor.
export class IGroup {
  constructor(scene, geo, mat, cap, shadow = true) {
    const m = (this.mesh = new THREE.InstancedMesh(geo, mat, cap));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = shadow;
    m.receiveShadow = true;
    this.cap = cap;
    this.list = [];
    this.colorsDirty = false;
    scene.add(m);
  }
  get full() { return this.list.length >= this.cap; }
  add(h) {
    if (this.list.length >= this.cap) return null;
    h.i = this.list.length;
    h.g = this;
    h.k = 1;
    this.list.push(h);
    this.mesh.setColorAt(h.i, h.color || WHITE);
    this.colorsDirty = true;
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
      this.colorsDirty = true;
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
      const k = h.k;
      _s.set(h.scale.x * k, h.scale.y * k, h.scale.z * k);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = L.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (this.colorsDirty) { mesh.instanceColor.needsUpdate = true; this.colorsDirty = false; }
  }
}

// ---------------------------------------------------------------- GPU sprites
// mode 0: soft textured puff (normal blending), 1: velocity-stretched spark streak, 2: star glint
const SVS = `
attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iCol; attribute vec3 iSz;
varying vec2 vUv; varying vec4 vCol;
void main(){
  vUv = uv; vCol = iCol;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vec2 q = position.xy;
  float s = iSz.x;
  if (iSz.y > 0.0) {
    vec2 d = (modelViewMatrix * vec4(iVel, 0.0)).xy;
    float l = length(d);
    vec2 ax = l > 1e-4 ? d / l : vec2(1.0, 0.0);
    vec2 ay = vec2(-ax.y, ax.x);
    float len = s + l * iSz.y;
    mv.xy += ax * (q.x - 0.3) * len + ay * q.y * s;
  } else {
    float c = cos(iSz.z), sn = sin(iSz.z);
    mv.xy += vec2(c * q.x - sn * q.y, sn * q.x + c * q.y) * s;
  }
  gl_Position = projectionMatrix * mv;
}`;
const SFS = `
uniform sampler2D uMap; uniform float uMode; uniform float uBoost;
varying vec2 vUv; varying vec4 vCol;
void main(){
  vec2 d = vUv - 0.5;
  float a;
  if (uMode < 0.5) {
    a = texture2D(uMap, vUv).a;
  } else if (uMode < 1.5) {
    a = exp(-d.x * d.x * 10.0 - d.y * d.y * 70.0);
  } else {
    vec2 e = abs(d) * 2.0;
    float r = length(e);
    a = max(0.0, 1.0 - r); a = a * a * 0.7;
    a += max(0.0, 1.0 - e.y * 14.0) * max(0.0, 1.0 - e.x) * 0.9;
    a += max(0.0, 1.0 - e.x * 14.0) * max(0.0, 1.0 - e.y) * 0.9;
  }
  a *= vCol.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol.rgb * uBoost, a);
}`;

export class Sprites {
  constructor(scene, max, { mode = 0, additive = false, map = null, boost = 1, order = 6 } = {}) {
    this.max = max;
    this.n = 0;
    const F = (k) => new Float32Array(max * k);
    this.pos = F(3); this.vel = F(3); this.col = F(4); this.sz = F(3);
    this.life = F(1); this.ml = F(1); this.s0 = F(1); this.grow = F(1); this.grav = F(1); this.drag = F(1); this.a0 = F(1); this.spin = F(1);
    const base = new THREE.PlaneGeometry(1, 1);
    const g = (this.geo = new THREE.InstancedBufferGeometry());
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    const mk = (arr, n) => { const a = new THREE.InstancedBufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('iPos', mk(this.pos, 3));
    g.setAttribute('iVel', mk(this.vel, 3));
    g.setAttribute('iCol', mk(this.col, 4));
    g.setAttribute('iSz', mk(this.sz, 3));
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uMode: { value: mode }, uBoost: { value: boost } },
      vertexShader: SVS, fragmentShader: SFS,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
    scene.add(this.mesh);
  }
  // stretch > 0 => streak along velocity; otherwise sprite rotates with `spin`
  emit(x, y, z, vx, vy, vz, life, size, r, g, b, grav = 0, drag = 0, grow = 0, alpha = 1, stretch = 0, spin = 0) {
    let i = this.n;
    if (i >= this.max) i = (Math.random() * this.max) | 0; else this.n++;
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i4] = r; this.col[i4 + 1] = g; this.col[i4 + 2] = b; this.col[i4 + 3] = alpha;
    this.sz[i3] = size; this.sz[i3 + 1] = stretch; this.sz[i3 + 2] = Math.random() * 6.283;
    this.life[i] = this.ml[i] = life;
    this.s0[i] = size; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow; this.a0[i] = alpha; this.spin[i] = spin;
  }
  _copy(d, s) {
    const d3 = d * 3, s3 = s * 3, d4 = d * 4, s4 = s * 4;
    for (let k = 0; k < 3; k++) { this.pos[d3 + k] = this.pos[s3 + k]; this.vel[d3 + k] = this.vel[s3 + k]; this.sz[d3 + k] = this.sz[s3 + k]; }
    for (let k = 0; k < 4; k++) this.col[d4 + k] = this.col[s4 + k];
    this.life[d] = this.life[s]; this.ml[d] = this.ml[s]; this.s0[d] = this.s0[s]; this.grav[d] = this.grav[s];
    this.drag[d] = this.drag[s]; this.grow[d] = this.grow[s]; this.a0[d] = this.a0[s]; this.spin[d] = this.spin[s];
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
      if (P[i3 + 1] < 0.02) { P[i3 + 1] = 0.02; V[i3 + 1] *= -0.3; V[i3] *= 0.6; V[i3 + 2] *= 0.6; }
      const t = this.life[i] / this.ml[i];
      this.col[i * 4 + 3] = this.a0[i] * Math.min(1, t * 1.8) * Math.min(1, (1 - t) * 12 + 0.2);
      this.sz[i3] = this.s0[i] + this.grow[i] * (1 - t);
      this.sz[i3 + 2] += this.spin[i] * dt;
      i++;
    }
    this.n = n;
    const a = this.geo.attributes;
    a.iPos.needsUpdate = a.iVel.needsUpdate = a.iCol.needsUpdate = a.iSz.needsUpdate = true;
    this.geo.instanceCount = n;
  }
}

// ---------------------------------------------------------------- glass shards
// Not physics bodies: ballistic kinematics + ground bounce. Each shard is a unit triangular prism
// deformed by an affine matrix L (any triangle shape in one InstancedMesh). Fixed ring pool.
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
    this.pool = [];
    for (let i = 0; i < max; i++) {
      this.pool.push({ p: new THREE.Vector3(), q: new THREE.Quaternion(), L: new THREE.Matrix4(), v: new THREE.Vector3(), w: new THREE.Vector3(), tq: new THREE.Quaternion(), hasTq: false, color: new THREE.Color(), life: 0, rest: false });
    }
    this.head = 0;
    this.live = 0;
    this.mesh = new THREE.InstancedMesh(prismGeometry(), mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
    this.onGlint = null;
  }
  // returns a pooled shard (oldest one is recycled when full); caller fills p, q, L, v, w, color, life
  alloc() {
    const s = this.pool[this.head];
    this.head = (this.head + 1) % this.max;
    s.rest = false; s.hasTq = false;
    return s;
  }
  fadeAll(t) { for (const s of this.pool) if (s.life > 0) s.life = Math.min(s.life, t * (0.6 + Math.random() * 0.4)); }
  push(x, y, z, R, power) {
    for (const s of this.pool) {
      if (s.life <= 0) continue;
      const dx = s.p.x - x, dy = s.p.y - y, dz = s.p.z - z, d = Math.hypot(dx, dy, dz);
      if (d < R && d > 1e-3) {
        const f = ((1 - d / R) * power) / d;
        s.v.x += dx * f; s.v.y += dy * f + 2 * (1 - d / R); s.v.z += dz * f;
        s.rest = false; s.hasTq = false;
        s.w.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
      }
    }
  }
  update(dt) {
    const mesh = this.mesh, pool = this.pool;
    let w = 0;
    for (let j = 0; j < this.max; j++) {
      const s = pool[(this.head + j) % this.max]; // oldest first
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) continue;
      if (!s.rest) {
        s.v.y -= 9.82 * dt;
        s.p.addScaledVector(s.v, dt);
        const wl = s.w.length();
        if (wl > 1e-4) { _ax.copy(s.w).divideScalar(wl); _dq.setFromAxisAngle(_ax, wl * dt); s.q.premultiply(_dq); }
        if (s.p.y < 0.012) {
          s.p.y = 0.012;
          if (s.v.y < 0) s.v.y = -s.v.y * 0.25;
          s.v.x *= 0.55; s.v.z *= 0.55; s.w.multiplyScalar(0.4);
          if (!s.hasTq) { _n.copy(ZAX).applyQuaternion(s.q); s.tq.setFromUnitVectors(_n, _n.y >= 0 ? UP : DOWN).multiply(s.q); s.hasTq = true; }
          if (s.v.lengthSq() < 0.25) { s.rest = true; s.v.set(0, 0, 0); }
        } else if (this.onGlint && Math.random() < dt * 1.5) this.onGlint(s.p.x, s.p.y, s.p.z);
      } else if (s.hasTq) {
        s.q.slerp(s.tq, Math.min(1, dt * 10));
      }
      const k = s.life < 0.4 ? s.life / 0.4 : 1;
      _s.set(k, k, k);
      _m.compose(s.p, s.q, _s).multiply(s.L);
      mesh.setMatrixAt(w, _m);
      mesh.setColorAt(w, s.color);
      w++;
    }
    this.live = w;
    mesh.count = w;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }
}
