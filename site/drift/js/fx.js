// Pooled effects: point particles (additive + soft), fading skid marks, ball trail, confetti, boost flame, goal blast.
// Everything is preallocated; update() does no allocation.
import * as THREE from 'three';

const VS = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
varying float vA; varying vec3 vC;
uniform float uScale;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vA = aAlpha; vC = aColor;
}`;
const FS_GLOW = `
varying float vA; varying vec3 vC;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0;
  float a = (1.0 - r); if (a <= 0.0) discard;
  a = a * a * vA;
  gl_FragColor = vec4(vC * a, a);
}`;
const FS_SOFT = `
varying float vA; varying vec3 vC;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0;
  float a = 1.0 - r; if (a <= 0.0) discard;
  a = smoothstep(0.0, 1.0, a) * vA;
  gl_FragColor = vec4(vC, a);
}`;

export class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.next = 0; this.budget = max;
    const f = (k) => new Float32Array(max * k);
    this.p = f(3); this.v = f(3); this.life = f(1); this.ml = f(1); this.s0 = f(1); this.s1 = f(1);
    this.c = f(3); this.drag = f(1); this.grav = f(1); this.a0 = f(1);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(f(3), 3); this.aCol = new THREE.BufferAttribute(f(3), 3);
    this.aSize = new THREE.BufferAttribute(f(1), 1); this.aAlpha = new THREE.BufferAttribute(f(1), 1);
    for (const a of [this.aPos, this.aCol, this.aSize, this.aAlpha]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aColor', this.aCol); g.setAttribute('aSize', this.aSize); g.setAttribute('aAlpha', this.aAlpha);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 15), 200);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } }, vertexShader: VS, fragmentShader: additive ? FS_GLOW : FS_SOFT,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    if (additive) { this.mat.blending = THREE.CustomBlending; this.mat.blendSrc = THREE.OneFactor; this.mat.blendDst = THREE.OneFactor; }
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    this.live = 0;
  }
  // spawn one particle; returns nothing (ring buffer, oldest overwritten)
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, alpha, drag, grav) {
    let i = this.next; this.next = (this.next + 1) % this.budget;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.ml[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b; this.a0[i] = alpha; this.drag[i] = drag; this.grav[i] = grav;
  }
  update(dt) {
    const P = this.aPos.array, C = this.aCol.array, S = this.aSize.array, A = this.aAlpha.array;
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      const L = this.life[i];
      if (L <= 0) { if (A[i] !== 0) { A[i] = 0; S[i] = 0; } continue; }
      const nl = L - dt; this.life[i] = nl;
      if (nl <= 0) { A[i] = 0; S[i] = 0; continue; }
      live++;
      const k = i * 3, dr = Math.max(0, 1 - this.drag[i] * dt);
      this.v[k] *= dr; this.v[k + 1] = this.v[k + 1] * dr - this.grav[i] * dt; this.v[k + 2] *= dr;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (this.p[k + 1] < 0.02) { this.p[k + 1] = 0.02; this.v[k + 1] *= -0.4; }
      const t = 1 - nl / this.ml[i];
      P[k] = this.p[k]; P[k + 1] = this.p[k + 1]; P[k + 2] = this.p[k + 2];
      C[k] = this.c[k]; C[k + 1] = this.c[k + 1]; C[k + 2] = this.c[k + 2];
      S[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      A[i] = this.a0[i] * (t < 0.1 ? t * 10 : 1 - (t - 0.1) / 0.9);
    }
    this.live = live;
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}

// ground skid marks: ring buffer of quads, cleared each attempt
export class Skids {
  constructor(max = 700) {
    this.max = max; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 4 * 3); this.col = new Float32Array(max * 4 * 4);
    const idx = new Uint16Array(max * 6);
    for (let q = 0; q < max; q++) { const v = q * 4, o = q * 6; idx[o] = v; idx[o + 1] = v + 2; idx[o + 2] = v + 1; idx[o + 3] = v + 1; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.aP = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('color', this.aC);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 15), 200);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.last = new Float32Array(4 * 4); // per track: x, z, sideX, sideZ ; valid flag in lastOn
    this.lastOn = new Uint8Array(4);
    this.age = new Float32Array(max).fill(99);
    this.dirty = false; this.fadeAcc = 0;
  }
  // track id, wheel contact x/z, heading sin/cos, strength 0..1
  add(id, x, z, sy, cy, k) {
    const L = this.last, o = id * 4;
    if (!this.lastOn[id]) { L[o] = x; L[o + 1] = z; this.lastOn[id] = 1; return; }
    const dx = x - L[o], dz = z - L[o + 1];
    if (dx * dx + dz * dz < 0.09) return;
    const w = 0.15, ax = cy * w, az = -sy * w; // half width across the car
    const q = this.i; this.i = (this.i + 1) % this.max;
    const p = this.pos, v = q * 12, y = 0.015;
    p[v] = L[o] - ax; p[v + 1] = y; p[v + 2] = L[o + 1] - az;
    p[v + 3] = L[o] + ax; p[v + 4] = y; p[v + 5] = L[o + 1] + az;
    p[v + 6] = x - ax; p[v + 7] = y; p[v + 8] = z - az;
    p[v + 9] = x + ax; p[v + 10] = y; p[v + 11] = z + az;
    this.age[q] = 0;
    const c = this.col, cv = q * 16, a = 0.55 * k;
    for (let j = 0; j < 4; j++) { c[cv + j * 4] = 0.06; c[cv + j * 4 + 1] = 0.07; c[cv + j * 4 + 2] = 0.05; c[cv + j * 4 + 3] = a; }
    L[o] = x; L[o + 1] = z;
    this.dirty = true;
  }
  lift(id) { this.lastOn[id] = 0; }
  clear() { this.pos.fill(0); this.col.fill(0); this.lastOn.fill(0); this.age.fill(99); this.i = 0; this.dirty = true; }
  // marks fade out over ~6 s (alpha stepped 10x a second to keep buffer uploads cheap)
  update(dt = 0) {
    this.fadeAcc += dt;
    if (this.fadeAcc > 0.1) {
      const st = this.fadeAcc; this.fadeAcc = 0;
      const c = this.col;
      for (let q = 0; q < this.max; q++) {
        if (this.age[q] > 50) continue;
        const a0 = this.age[q]; this.age[q] = a0 + st;
        if (a0 + st < 2.5) continue;
        const f = a0 + st > 6.5 ? 0 : 1 - st / Math.max(0.1, 6.5 - a0);
        const cv = q * 16;
        for (let j = 0; j < 4; j++) c[cv + j * 4 + 3] *= f;
        if (f === 0) this.age[q] = 99;
        this.dirty = true;
      }
    }
    if (this.dirty) { this.aP.needsUpdate = true; this.aC.needsUpdate = true; this.dirty = false; }
  }
}

// camera-facing ribbon behind the ball
export class Trail {
  constructor(n = 26) {
    this.n = n; this.pts = new Float32Array(n * 3); this.count = 0; this.acc = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.alpha = new Float32Array(n * 2);
    const idx = new Uint16Array((n - 1) * 6);
    for (let i = 0; i < n - 1; i++) { const v = i * 2, o = i * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v + 1; idx[o + 4] = v + 3; idx[o + 5] = v + 2; }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.aP = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aA = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('aA', this.aA);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.75, 0.9, 1.0) }, uOpacity: { value: 0 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ float a = vA * uOpacity; gl_FragColor = vec4(uColor * a, a); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
    this.opacity = 0;
  }
  reset(x, y, z) { for (let i = 0; i < this.n; i++) { this.pts[i * 3] = x; this.pts[i * 3 + 1] = y; this.pts[i * 3 + 2] = z; } this.opacity = 0; }
  update(dt, x, y, z, speed, cam, width) {
    const P = this.pts, n = this.n;
    for (let i = n - 1; i > 0; i--) { P[i * 3] = P[i * 3 - 3]; P[i * 3 + 1] = P[i * 3 - 2]; P[i * 3 + 2] = P[i * 3 - 1]; }
    P[0] = x; P[1] = y; P[2] = z;
    const target = speed > 13 ? Math.min(1, (speed - 13) / 12) : 0;
    this.opacity += (target - this.opacity) * Math.min(1, dt * (target > this.opacity ? 12 : 3));
    this.mat.uniforms.uOpacity.value = this.opacity;
    this.mesh.visible = this.opacity > 0.01;
    if (!this.mesh.visible) return;
    const cx = cam.x, cy = cam.y, cz = cam.z;
    for (let i = 0; i < n; i++) {
      const a = i === 0 ? 0 : i - 1, b = i === n - 1 ? n - 1 : i + 1;
      let tx = P[b * 3] - P[a * 3], ty = P[b * 3 + 1] - P[a * 3 + 1], tz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = cx - P[i * 3], vy = cy - P[i * 3 + 1], vz = cz - P[i * 3 + 2];
      let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
      const l = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      const f = 1 - i / (n - 1), w = width * f;
      sx = sx / l * w; sy = sy / l * w; sz = sz / l * w;
      const o = i * 6;
      this.pos[o] = P[i * 3] + sx; this.pos[o + 1] = P[i * 3 + 1] + sy; this.pos[o + 2] = P[i * 3 + 2] + sz;
      this.pos[o + 3] = P[i * 3] - sx; this.pos[o + 4] = P[i * 3 + 1] - sy; this.pos[o + 5] = P[i * 3 + 2] - sz;
      this.alpha[i * 2] = this.alpha[i * 2 + 1] = f * f * 0.55;
    }
    this.aP.needsUpdate = true; this.aA.needsUpdate = true;
  }
}

// confetti: instanced tumbling paper
export class Confetti {
  constructor(max = 280) {
    this.max = max;
    const g = new THREE.PlaneGeometry(0.16, 0.26);
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(g, m, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.d = new Float32Array(max * 10); // x y z vx vy vz rx ry spin life
    this.active = 0; this.o = new THREE.Object3D(); this.col = new THREE.Color();
    const pal = [0xff4d6d, 0xffd23f, 0x3ddc97, 0x4cc9f0, 0xb388ff, 0xffffff, 0xff8c42];
    for (let i = 0; i < max; i++) { this.col.setHex(pal[i % pal.length]); this.mesh.setColorAt(i, this.col); }
    this.t = 0;
  }
  burst(x, y, z, n, rand) {
    const d = this.d;
    for (let i = 0; i < Math.min(n, this.max); i++) {
      const o = i * 10;
      d[o] = x + (rand() - 0.5) * 10; d[o + 1] = y + rand() * 3; d[o + 2] = z + (rand() - 0.5) * 3;
      d[o + 3] = (rand() - 0.5) * 9; d[o + 4] = 6 + rand() * 9; d[o + 5] = 3 + rand() * 7;
      d[o + 6] = rand() * 6; d[o + 7] = rand() * 6; d[o + 8] = 3 + rand() * 8; d[o + 9] = 4 + rand() * 2;
    }
    this.mesh.count = Math.min(n, this.max); this.active = this.mesh.count; this.t = 0;
  }
  update(dt) {
    if (!this.active) return;
    const d = this.d, o3 = this.o;
    let alive = 0;
    for (let i = 0; i < this.mesh.count; i++) {
      const o = i * 10;
      if (d[o + 9] > 0) {
        d[o + 9] -= dt; alive++;
        d[o + 3] *= 1 - 1.6 * dt; d[o + 5] *= 1 - 1.6 * dt;
        d[o + 4] = Math.max(-1.6, d[o + 4] - 14 * dt);
        if (d[o + 4] < 0) d[o + 4] *= 1 - 3 * dt;
        d[o] += d[o + 3] * dt + Math.sin(d[o + 6] * 3) * 0.6 * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
        d[o + 6] += d[o + 8] * dt; d[o + 7] += d[o + 8] * 0.7 * dt;
        if (d[o + 1] < 0.03) { d[o + 1] = 0.03; d[o + 4] = 0; d[o + 3] = 0; d[o + 5] = 0; d[o + 8] = 0; }
      }
      o3.position.set(d[o], d[o + 1], d[o + 2]);
      o3.rotation.set(d[o + 6], d[o + 7], 0);
      const s = d[o + 9] > 0 ? Math.min(1, d[o + 9] * 2) : 0;
      o3.scale.set(s, s, s);
      o3.updateMatrix();
      this.mesh.setMatrixAt(i, o3.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!alive) { this.active = 0; this.mesh.count = 0; }
  }
  clear() { this.active = 0; this.mesh.count = 0; }
}

// boost flame: two flickering additive cones behind the exhausts, coloured by the turbo level
export class Flame {
  constructor() {
    const g = new THREE.ConeGeometry(0.11, 1, 12, 6, true); g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2); // tip points -z
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(1, 0.5, 0.1) }, uOn: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform float uTime;
        void main(){ vUv = uv; vec3 p = position; float k = clamp(-p.z, 0.0, 1.0);
          p.xy *= 1.0 + 0.25 * sin(uTime * 60.0 + k * 9.0) * k;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform vec3 uCol; uniform float uOn; uniform float uTime;
        void main(){ float k = 1.0 - vUv.y; float core = pow(abs(dot(vN, vV)), 1.5);
          float fl = 0.75 + 0.25 * sin(uTime * 47.0 + vUv.x * 30.0);
          vec3 c = mix(uCol, vec3(1.0, 0.95, 0.8), core * (1.0 - k)) * (3.0 * (1.0 - k) * core * fl + 0.4 * core);
          float a = uOn * (1.0 - k) * core; gl_FragColor = vec4(c * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, side: THREE.DoubleSide,
    });
    this.group = new THREE.Group();
    this.cones = [];
    for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(g, this.mat); m.frustumCulled = false; m.renderOrder = 7; this.cones.push(m); this.group.add(m); }
    this.on = 0;
  }
  attach(model) {
    model.group.add(this.group);
    for (let i = 0; i < 2; i++) this.cones[i].position.copy(model.exhaust[i]);
  }
  update(dt, time, boosting, level) {
    this.on += ((boosting ? 1 : 0) - this.on) * Math.min(1, dt * (boosting ? 20 : 8));
    this.mat.uniforms.uOn.value = this.on; this.mat.uniforms.uTime.value = time;
    const col = level >= 3 ? [0.8, 0.3, 1.6] : level === 2 ? [1.6, 0.55, 0.1] : [0.35, 0.65, 1.8];
    this.mat.uniforms.uCol.value.setRGB(col[0], col[1], col[2]);
    const len = 0.5 + this.on * (0.9 + level * 0.25);
    for (const c of this.cones) { c.scale.set(0.8 + this.on * 0.6, 0.8 + this.on * 0.6, len); }
    this.group.visible = this.on > 0.02;
  }
}

// goal blast: an expanding shockwave sphere and a ground ring (Rocket-League-style explosion)
export class Blast {
  constructor() {
    const mk = (fs) => new THREE.ShaderMaterial({
      uniforms: { uT: { value: 1 }, uCol: { value: new THREE.Color(1, 0.7, 0.2) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, side: THREE.DoubleSide,
    });
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mk(`uniform float uT; uniform vec3 uCol; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1.0 - abs(dot(vN, vV)); float a = pow(f, 2.5) * (1.0 - uT) * 2.5 + (1.0 - uT) * (1.0 - uT) * 0.6; gl_FragColor = vec4(uCol * a * 2.0, a); }`));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64, 1), mk(`uniform float uT; uniform vec3 uCol; varying vec2 vUv;
      void main(){ float a = (1.0 - uT) * 1.6; gl_FragColor = vec4(mix(vec3(1.0), uCol, 0.5) * a * 2.0, a); }`));
    this.ring.rotation.x = -Math.PI / 2;
    for (const m of [this.sphere, this.ring]) { m.visible = false; m.frustumCulled = false; m.renderOrder = 8; }
    this.t = 1; this.mesh = new THREE.Group(); this.mesh.add(this.sphere, this.ring);
  }
  fire(x, y, z, r, g, b) {
    this.t = 0; this.sphere.position.set(x, y, z); this.ring.position.set(x, 0.05, z);
    this.sphere.material.uniforms.uCol.value.setRGB(r, g, b); this.ring.material.uniforms.uCol.value.setRGB(r, g, b);
  }
  update(dt) {
    if (this.t >= 1) { this.sphere.visible = this.ring.visible = false; return; }
    this.t = Math.min(1, this.t + dt / 1.1);
    const e = 1 - Math.pow(1 - this.t, 3);
    this.sphere.visible = this.ring.visible = true;
    this.sphere.scale.setScalar(0.5 + e * 6);
    this.ring.scale.setScalar(0.5 + e * 15);
    this.sphere.material.uniforms.uT.value = this.t; this.ring.material.uniforms.uT.value = this.t;
  }
}
