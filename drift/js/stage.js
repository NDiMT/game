// Stadium: pitch, goal + rippling net, boards, stands with an instanced crowd, floodlights, sky, lights, themes.
import * as THREE from 'three';
import { GX, GY, GD, PR, AX, AZ0, AZ1, SPOT } from './physics.js';

export const THEMES = {
  day: {
    skyTop: 0x3f8ef0, skyHor: 0xd4ecff, skyBot: 0x9cc7ea, fog: 0xc3dcf2, fogN: 70, fogF: 230,
    key: 0xfff0d8, keyI: 2.7, keyPos: [-14, 30, 22], hemiS: 0xcfe6ff, hemiG: 0x55803a, hemiI: 0.9,
    grass: 0xffffff, envI: 0.75, exposure: 1.0, glow: 0.0, stars: 0, boardE: 0.25, standC: 0xdfe5ee, roofC: 0x8a96a8,
  },
  night: {
    skyTop: 0x040817, skyHor: 0x1a2a56, skyBot: 0x0b1226, fog: 0x0d1631, fogN: 60, fogF: 200,
    key: 0xeaf2ff, keyI: 2.5, keyPos: [10, 32, 16], hemiS: 0x3d5390, hemiG: 0x14260f, hemiI: 0.42,
    grass: 0xd6e6d0, envI: 0.5, exposure: 1.12, glow: 1.0, stars: 1, boardE: 1.0, standC: 0x5a6378, roofC: 0x2a3140,
  },
};

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso || 1;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}

// pitch canvas covers x in [-24, 24], z in [-8, 42]
const PX0 = -24, PZ0 = -8, PW = 48, PD = 50;
function pitchTexture(aniso) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const mx = (x) => (x - PX0) / PW * w, mz = (z) => (z - PZ0) / PD * h;
    // mowing bands across the pitch
    for (let i = 0; i < 26; i++) {
      g.fillStyle = i % 2 ? '#4fa63d' : '#5cb848';
      g.fillRect(0, mz(-8 + i * 2.5), w, mz(2.5) - mz(0) + 1);
    }
    // grain
    const id = g.getImageData(0, 0, w, h), d = id.data;
    let s = 1234567;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const n = ((s >> 16) & 255) / 255 - 0.5;
      d[i] += n * 18; d[i + 1] += n * 22; d[i + 2] += n * 10;
    }
    g.putImageData(id, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.92)'; g.fillStyle = 'rgba(255,255,255,0.92)';
    g.lineWidth = 0.13 / PW * w;
    const rect = (x0, z0, x1, z1) => g.strokeRect(mx(x0), mz(z0), mx(x1) - mx(x0), mz(z1) - mz(z0));
    g.beginPath(); g.moveTo(mx(-AX), mz(0)); g.lineTo(mx(AX), mz(0)); g.stroke();
    rect(-GX - 3.5, 0, GX + 3.5, 4.2);      // six-yard box
    rect(-GX - 9, 0, GX + 9, SPOT + 4);     // penalty box
    g.beginPath(); g.arc(mx(0), mz(SPOT), 0.22 / PW * w, 0, Math.PI * 2); g.fill();
    // the D
    g.beginPath();
    const rr = 7, a = Math.acos(4 / rr);
    g.ellipse(mx(0), mz(SPOT), rr / PW * w, rr / PD * h, 0, Math.PI / 2 - a, Math.PI / 2 + a); g.stroke();
    // touchlines
    rect(-AX + 0.5, -0.0, AX - 0.5, AZ1 - 0.5);
    // halfway hint
    g.beginPath(); g.arc(mx(0), mz(AZ1 + 2), 9 / PW * w, Math.PI, 0); g.stroke();
  }, { aniso });
}

function boardTexture() {
  return canvasTex(1024, 64, (g, w, h) => {
    const ads = [['DRIFT KICK', '#ff4d3d', '#fff'], ['TURBO', '#1b1f2e', '#ffd23f'], ['GOAL!', '#2f7cf6', '#fff'], ['MINI CUP', '#ffd23f', '#1b1f2e'], ['SPARKS', '#9b4dff', '#fff'], ['TOY LEAGUE', '#22c97a', '#0d2a1d']];
    const n = 6, pw = w / n;
    g.font = '900 38px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const [t, bg, fg] = ads[i];
      g.fillStyle = bg; g.fillRect(i * pw, 0, pw, h);
      g.fillStyle = fg; g.fillText(t, i * pw + pw / 2, h / 2 + 2);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(i * pw, 0, 3, h);
    }
  }, { repeat: [1, 1] });
}

function netTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.closePath(); g.stroke();
  }, { repeat: [1, 1] });
}

function glowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,250,235,0.75)'); gr.addColorStop(0.5, 'rgba(200,220,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

function stairs(rows, step, rise, len, base) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  for (let i = 0; i < rows; i++) { s.lineTo(i * step, base + i * rise); s.lineTo((i + 1) * step, base + i * rise); }
  s.lineTo(rows * step, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return g;
}

export function createStage(renderer, quality) {
  const scene = new THREE.Scene();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const S = { scene };

  // ---- sky
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, stars: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 top, hor, bot; uniform float stars; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(hor, bot, clamp(-y*4.0,0.0,1.0));
        if (stars > 0.0 && y > 0.08) { vec3 q = floor(vP * 260.0); float s = step(0.9965, h(q)); c += vec3(s) * stars * smoothstep(0.08, 0.4, y) * 0.9; }
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  // ---- clouds (day only)
  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 22 + Math.random() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
    const a = -Math.PI / 2 + (i / 9 - 0.5) * 3.4 + Math.random() * 0.2, d = 260 + Math.random() * 60;
    sp.position.set(Math.cos(a) * d, 55 + Math.random() * 70, 15 + Math.sin(a) * d);
    sp.scale.set(120 + Math.random() * 80, 50 + Math.random() * 30, 1);
    sp.renderOrder = -9; scene.add(sp); clouds.push(sp);
  }

  // ---- ground
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x3f8a33, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true;
  const grassMat = new THREE.MeshStandardMaterial({ map: pitchTexture(aniso), roughness: 0.92, metalness: 0 });
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), grassMat);
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(PX0 + PW / 2, 0, PZ0 + PD / 2); pitch.receiveShadow = true;
  scene.add(outer, pitch);
  S.grassMat = grassMat;

  // ---- boards around the arena
  const bt = boardTexture();
  const boardMat = new THREE.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.5 });
  const boardBack = new THREE.MeshStandardMaterial({ color: 0x232733, roughness: 0.8 });
  const mats = [boardBack, boardBack, boardBack, boardBack, boardMat, boardBack];
  const addBoard = (x, z, len, rotY) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.95, 0.25), mats);
    m.position.set(x, 0.475, z); m.rotation.y = rotY; m.receiveShadow = true;
    const tex = m.material[4].map; tex.repeat.x = len / 24; tex.wrapS = THREE.RepeatWrapping;
    scene.add(m);
  };
  addBoard(0, AZ0 - 0.2, AX * 2 + 1, 0);
  addBoard(-AX - 0.2, (AZ0 + AZ1) / 2, AZ1 - AZ0, Math.PI / 2);
  addBoard(AX + 0.2, (AZ0 + AZ1) / 2, AZ1 - AZ0, -Math.PI / 2);
  addBoard(0, AZ1 + 0.2, AX * 2 + 1, Math.PI);
  S.boardMat = boardMat;

  // ---- stands
  const standMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.85 });
  const seatsMat = new THREE.MeshStandardMaterial({ color: 0x2b5fd9, roughness: 0.7 });
  S.standMat = standMat;
  const stands = [];
  const ROWS = 12, STEP = 0.95, RISE = 0.55;
  function addStand(cx, cz, rotY, len) {
    const g = stairs(ROWS, STEP, RISE, len, 1.2);
    const m = new THREE.Mesh(g, standMat);
    m.position.set(cx, 0, cz); m.rotation.y = rotY; m.receiveShadow = true;
    scene.add(m);
    // coloured seat strip on the front face
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, len), seatsMat); front.position.set(0.15, 0.6, 0); m.add(front);
    stands.push({ m, len, rotY, cx, cz });
    return m;
  }
  addStand(0, AZ0 - 1.4, Math.PI / 2, AX * 2 + 6);           // behind the goal, rising away (-z)
  addStand(-AX - 1.4, 17, Math.PI, AZ1 - AZ0 + 2);             // left side, rising to -x
  addStand(AX + 1.4, 17, 0, AZ1 - AZ0 + 2);                    // right side
  addStand(0, AZ1 + 1.4, -Math.PI / 2, AX * 2 + 6);             // far end


  // ---- crowd (instanced capsules that bounce in the vertex shader)
  const crowdG = new THREE.CapsuleGeometry(0.24, 0.42, 2, 6);
  crowdG.translate(0, 0.45, 0);
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const cu = { uTime: { value: 0 }, uExcite: { value: 0.15 } };
  crowdMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = cu.uTime; sh.uniforms.uExcite = cu.uExcite;
    sh.vertexShader = 'attribute float aPhase;\nuniform float uTime; uniform float uExcite;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float ph = aPhase;
       float j = max(0.0, sin(uTime * (7.0 + ph * 5.0) + ph * 40.0));
       transformed.y += j * j * uExcite * 0.75 + sin(uTime * 1.7 + ph * 30.0) * 0.04;
       transformed.x += sin(uTime * 2.3 + ph * 17.0) * 0.05 * (0.4 + uExcite);`);
  };
  const perStand = [];
  for (const st of stands) {
    const cols = Math.floor(st.len / 0.78);
    perStand.push(cols * ROWS);
  }
  const total = perStand.reduce((a, b) => a + b, 0);
  const crowd = new THREE.InstancedMesh(crowdG, crowdMat, total);
  const phase = new Float32Array(total);
  const o = new THREE.Object3D(), col = new THREE.Color();
  const pal = [0xff4d3d, 0xff4d3d, 0xffffff, 0x2f7cf6, 0xffd23f, 0x1b1f2e, 0x2f7cf6, 0xff8fa3, 0x22c97a, 0xf1f1f1];
  let k = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const order = [];
  for (const st of stands) {
    const cols = Math.floor(st.len / 0.78);
    const c = Math.cos(st.rotY), s = -Math.sin(st.rotY);
    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < cols; i++) {
        const along = (i + 0.5) / cols * st.len - st.len / 2 + (rnd() - 0.5) * 0.2;
        const out = r * STEP + STEP * 0.55;
        // local stand frame: +x is "out" (away from pitch), z is along
        const lx = out, lz = along;
        o.position.set(st.cx + lx * c + lz * Math.sin(st.rotY), 1.2 + r * RISE, st.cz + lx * s + lz * Math.cos(st.rotY));
        const sc = 0.85 + rnd() * 0.3;
        o.scale.set(sc, sc * (0.9 + rnd() * 0.25), sc);
        o.rotation.set(0, rnd() * 6, 0);
        o.updateMatrix();
        crowd.setMatrixAt(k, o.matrix);
        col.setHex(pal[Math.floor(rnd() * pal.length)]).multiplyScalar(0.75 + rnd() * 0.35);
        crowd.setColorAt(k, col);
        phase[k] = rnd();
        order.push(k);
        k++;
      }
    }
  }
  crowdG.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  crowd.frustumCulled = false;
  scene.add(crowd);
  S.crowd = crowd; S.crowdTotal = total; S.crowdU = cu;

  // ---- floodlights
  const glowTex = glowTexture();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.5, metalness: 0.7 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.4, roughness: 0.3 });
  S.lampMat = lampMat;
  const glows = [];
  for (const [x, z] of [[-AX - 9, AZ0 - 6], [AX + 9, AZ0 - 6], [-AX - 9, AZ1 + 4], [AX + 9, AZ1 + 4]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 26, 10), poleMat); pole.position.set(x, 13, z);
    const head = new THREE.Group(); head.position.set(x, 27, z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 0.5), poleMat);
    head.add(frame);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.2), lampMat); l.position.set(-2 + i * 2, -0.75 + j * 1.5, 0.3); head.add(l);
    }
    head.lookAt(0, 0, 14);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff4dd, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.set(26, 26, 1); sp.position.set(x, 27, z);
    glows.push(sp);
    scene.add(pole, head, sp);
  }
  S.glows = glows;

  // ---- goal
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1 });
  const goal = new THREE.Group();
  const pg = new THREE.CylinderGeometry(PR, PR, GY + PR, 16);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(pg, postMat); p.position.set(s * GX, (GY + PR) / 2, 0); p.castShadow = true; goal.add(p);
    const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, GY, 6), postMat); bp.position.set(s * GX, GY / 2, -GD); goal.add(bp);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, GD, 6), postMat); tb.rotation.x = Math.PI / 2; tb.position.set(s * GX, GY, -GD / 2); goal.add(tb);
    const gb = tb.clone(); gb.position.y = 0.04; goal.add(gb);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, GX * 2 + PR * 2, 16), postMat);
  bar.rotation.z = Math.PI / 2; bar.position.set(0, GY, 0); bar.castShadow = true; goal.add(bar);
  const bbar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, GX * 2, 6), postMat); bbar.rotation.z = Math.PI / 2; bbar.position.set(0, GY, -GD); goal.add(bbar);
  scene.add(goal);
  // nets
  const nt = netTexture();
  const panels = [];
  function netPanel(w, h, sw, sh, nx, ny, nz, setup) {
    const g = new THREE.PlaneGeometry(w, h, sw, sh);
    const tex = nt.clone(); tex.needsUpdate = true; tex.repeat.set(w / 0.3, h / 0.3); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.8, depthWrite: true }));
    setup(m);
    m.updateMatrixWorld(true);
    scene.add(m);
    const pos = g.attributes.position; pos.setUsage(THREE.DynamicDrawUsage);
    // world coords of each vertex, kept for the ripple
    const base = new Float32Array(pos.count * 3), world = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      base[i * 3] = pos.getX(i); base[i * 3 + 1] = pos.getY(i); base[i * 3 + 2] = pos.getZ(i);
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); world[i * 3] = v.x; world[i * 3 + 1] = v.y; world[i * 3 + 2] = v.z;
    }
    // local normal direction for an outward bulge (in local z)
    panels.push({ m, pos, base, world, n: [nx, ny, nz], sign: 1 });
    m.castShadow = false; m.receiveShadow = false;
    return m;
  }
  netPanel(GX * 2, GY, 24, 8, 0, 0, -1, (m) => { m.position.set(0, GY / 2, -GD); });
  netPanel(GD, GY, 6, 8, 1, 0, 0, (m) => { m.position.set(GX, GY / 2, -GD / 2); m.rotation.y = Math.PI / 2; });
  netPanel(GD, GY, 6, 8, -1, 0, 0, (m) => { m.position.set(-GX, GY / 2, -GD / 2); m.rotation.y = -Math.PI / 2; });
  netPanel(GX * 2, GD, 24, 6, 0, 1, 0, (m) => { m.position.set(0, GY, -GD / 2); m.rotation.x = -Math.PI / 2; });
  // panel local +z vs outward normal sign
  panels[0].sign = -1; panels[1].sign = 1; panels[2].sign = 1; panels[3].sign = 1;
  const rip = { x: 0, y: 0, z: 0, t: 99, a: 0 };
  S.netHit = (x, y, z, strength) => {
    if (rip.t < 0.15 && strength * 0.03 < rip.a) return;
    rip.x = x; rip.y = y; rip.z = z; rip.t = 0; rip.a = Math.min(0.75, 0.12 + strength * 0.03);
  };
  // the ball pressing into the net (persistent bulge)
  const press = { x: 0, y: 0, z: 0, d: 0 };
  S.netPress = (x, y, z, d) => { press.x = x; press.y = y; press.z = z; press.d = d; };
  let netActive = true;
  function updateNet(dt) {
    rip.t += dt;
    const live = rip.t < 2.5 || press.d > 0.001;
    if (!live && !netActive) return;
    netActive = live;
    const env = rip.a * Math.exp(-rip.t * 2.2);
    for (const p of panels) {
      const P = p.pos.array, B = p.base, W = p.world;
      for (let i = 0; i < p.pos.count; i++) {
        const wx = W[i * 3], wy = W[i * 3 + 1], wz = W[i * 3 + 2];
        const dx = wx - rip.x, dy = wy - rip.y, dz = wz - rip.z;
        const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
        let d = env * Math.exp(-r2 / 2.2) * Math.cos(r * 3.2 - rip.t * 16) + env * 0.5 * Math.exp(-r2 / 0.8);
        if (press.d > 0) { const ex = wx - press.x, ey = wy - press.y, ez = wz - press.z; d += press.d * Math.exp(-(ex * ex + ey * ey + ez * ez) / 1.1); }
        // edges are tied to the frame
        const e = edgeFade(p, i);
        P[i * 3 + 2] = B[i * 3 + 2] + d * e * p.sign;
      }
      p.pos.needsUpdate = true;
    }
  }
  function edgeFade(p, i) {
    const B = p.base, g = p.m.geometry.parameters;
    const u = Math.abs(B[i * 3]) / (g.width / 2), v = Math.abs(B[i * 3 + 1]) / (g.height / 2);
    return Math.max(0, 1 - Math.pow(Math.max(u, v), 6));
  }

  // ---- lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x446622, 0.9);
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.castShadow = true;
  const sc = key.shadow.camera;
  sc.left = -24; sc.right = 24; sc.top = 26; sc.bottom = -26; sc.near = 5; sc.far = 90;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  key.target.position.set(0, 0, 12);
  scene.add(hemi, key, key.target);
  S.key = key; S.hemi = hemi;
  S.setShadowSize = (n) => {
    key.shadow.mapSize.set(n, n);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
  };
  S.setShadowSize(quality >= 2 ? 2048 : 1024);

  // ---- environment maps (generated from a tiny scene per theme)
  const pm = new THREE.PMREMGenerator(renderer);
  function envFor(th) {
    const es = new THREE.Scene();
    const m = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), skyMat.clone());
    m.material.uniforms.top.value.setHex(th.skyTop); m.material.uniforms.hor.value.setHex(th.skyHor); m.material.uniforms.bot.value.setHex(0x3c6b30);
    m.material.uniforms.stars.value = 0;
    es.add(m);
    const box = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(th === THEMES.night ? 6 : 3, th === THEMES.night ? 6 : 3, th === THEMES.night ? 5.5 : 3) }));
    for (const [x, y, z] of [[-30, 25, -20], [30, 25, -20], [0, 30, 35], [-30, 22, 30]]) { const b = box.clone(); b.position.set(x, y, z); b.lookAt(0, 0, 0); es.add(b); }
    const rt = pm.fromScene(es, 0.03);
    return rt.texture;
  }
  const envs = { day: envFor(THEMES.day), night: envFor(THEMES.night) };
  pm.dispose();

  S.theme = null;
  S.setTheme = (name) => {
    const th = THEMES[name]; S.theme = name;
    skyMat.uniforms.top.value.setHex(th.skyTop); skyMat.uniforms.hor.value.setHex(th.skyHor); skyMat.uniforms.bot.value.setHex(th.skyBot);
    skyMat.uniforms.stars.value = th.stars;
    scene.fog = new THREE.Fog(th.fog, th.fogN, th.fogF);
    key.color.setHex(th.key); key.intensity = th.keyI; key.position.set(th.keyPos[0], th.keyPos[1], th.keyPos[2] + 12);
    hemi.color.setHex(th.hemiS); hemi.groundColor.setHex(th.hemiG); hemi.intensity = th.hemiI;
    grassMat.color.setHex(th.grass);
    scene.environment = envs[name]; scene.environmentIntensity = th.envI;
    renderer.toneMappingExposure = th.exposure;
    for (const g of glows) g.material.opacity = th.glow * 0.95;
    for (const g of glows) g.visible = th.glow > 0;
    for (const c of clouds) c.visible = th.glow === 0;
    lampMat.emissiveIntensity = th.glow > 0 ? 3.2 : 0.5;
    boardMat.emissiveIntensity = th.boardE * 0.6;
    standMat.color.setHex(th.standC);
  };

  S.setCrowdFraction = (f) => { crowd.count = Math.max(200, Math.floor(total * f)); };
  S.update = (dt, time) => { cu.uTime.value = time; updateNet(dt); };
  return S;
}
