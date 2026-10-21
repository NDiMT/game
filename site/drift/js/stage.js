// Stadium v2: shader grass (mowed stripes, detail + normal map, wear), crisp line meshes, goal with a
// rippling net, LED ad boards, roofed stands with an animated instanced crowd, floodlight towers,
// procedural sky (clouds + sun by day, stars by night), PMREM environments, a shadow frustum that follows play.
import * as THREE from 'three';
import { GX, GY, GD, PR, AX, AZ0, AZ1, SPOT } from './physics.js?v=2.2';
import { mergeByMaterial } from './util.js?v=2.2';

export const THEMES = {
  day: {
    skyTop: 0x2f7fe6, skyHor: 0xcfe7ff, skyBot: 0x9cc7ea, fog: 0xbdd8f0, fogN: 90, fogF: 300, clouds: 1, sun: 1,
    key: 0xfff0d8, keyI: 3.0, keyPos: [-30, 26, 18], hemiS: 0xcfe6ff, hemiG: 0x707a68, hemiI: 0.85,
    grass: 0xffffff, envI: 0.8, exposure: 1.0, glow: 0.0, stars: 0, boardE: 1.0, standC: 0xdfe5ee, roofC: 0xe9eef5,
    bloom: 0.55, thresh: 1.6, ghost: 0.25,
  },
  night: {
    skyTop: 0x030715, skyHor: 0x16244c, skyBot: 0x0b1226, fog: 0x0a1330, fogN: 80, fogF: 260, clouds: 0.25, sun: 0,
    key: 0xeaf2ff, keyI: 2.6, keyPos: [14, 36, 22], hemiS: 0x4a62a8, hemiG: 0x1a2c16, hemiI: 0.6,
    grass: 0xd2e4cc, envI: 0.6, exposure: 1.1, glow: 1.0, stars: 1, boardE: 1.6, standC: 0x56607a, roofC: 0x3a4357,
    bloom: 0.9, thresh: 1.1, ghost: 0.6,
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
function lcg(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// tiling grass blades: albedo detail + a matching tangent-space normal map
function grassTextures(aniso) {
  const N = 256, rnd = lcg(91);
  const hgt = new Float32Array(N * N);
  // blade strokes into a height field (wrapping)
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * N, y = rnd() * N, len = 3 + rnd() * 6, a = -Math.PI / 2 + (rnd() - 0.5) * 0.9, hh = 0.4 + rnd() * 0.6;
    for (let k = 0; k < len; k++) {
      const px = ((x + Math.cos(a) * k) % N + N) % N | 0, py = ((y + Math.sin(a) * k) % N + N) % N | 0;
      hgt[py * N + px] = Math.max(hgt[py * N + px], hh * (1 - k / len * 0.5));
    }
  }
  const albedo = canvasTex(N, N, (g) => {
    const id = g.createImageData(N, N), d = id.data;
    for (let i = 0; i < N * N; i++) {
      const v = hgt[i], n = rnd();
      d[i * 4] = 205 + v * 40 + n * 14; d[i * 4 + 1] = 225 + v * 30 + n * 10; d[i * 4 + 2] = 200 + v * 30 + n * 10; d[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  }, { aniso, repeat: [1, 1] });
  const normal = canvasTex(N, N, (g) => {
    const id = g.createImageData(N, N), d = id.data;
    const H = (x, y) => hgt[((y + N) % N) * N + ((x + N) % N)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 1.6, dy = (H(x, y + 1) - H(x, y - 1)) * 1.6;
      const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
      d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  }, { aniso, repeat: [1, 1], linear: true });
  return { albedo, normal };
}
// large-scale wear: goal mouth, penalty spot and the run-up lanes
function wearTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const mx = (x) => (x + AX) / (2 * AX) * w, mz = (z) => (z - AZ0) / (AZ1 - AZ0) * h;
    const blob = (x, z, r, a) => { const gr = g.createRadialGradient(mx(x), mz(z), 0, mx(x), mz(z), r / (2 * AX) * w); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
    blob(0, 1.5, 7, 0.55); blob(0, SPOT, 3, 0.45); blob(0, 4, 4, 0.35);
    const rnd = lcg(5);
    for (let i = 0; i < 70; i++) blob((rnd() - 0.5) * 2 * AX, AZ0 + rnd() * (AZ1 - AZ0), 2 + rnd() * 6, 0.12 * rnd());
  }, { linear: true });
}

// LED ad board strip: row 0 = sponsor loop, row 1 = GOAL! flash
function boardTexture() {
  return canvasTex(2048, 128, (g, w, h) => {
    const ads = [['DRIFT KICK', '#ff4d3d', '#fff'], ['TURBO', '#11141f', '#ffd23f'], ['GOAL!', '#2f7cf6', '#fff'], ['MINI CUP', '#ffd23f', '#1b1f2e'], ['SPARKS', '#9b4dff', '#fff'], ['TOY LEAGUE', '#22c97a', '#0d2a1d'], ['NITRO', '#ff8a1f', '#fff'], ['KICK OFF', '#0f1830', '#7cf3ff']];
    const n = ads.length, pw = w / n;
    g.font = '900 40px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const [t, bg, fg] = ads[i];
      g.fillStyle = bg; g.fillRect(i * pw, 0, pw, h / 2);
      g.fillStyle = fg; g.fillText(t, i * pw + pw / 2, h / 4 + 2);
    }
    const gr = g.createLinearGradient(0, h / 2, 0, h); gr.addColorStop(0, '#ffb000'); gr.addColorStop(1, '#ff5a00');
    g.fillStyle = gr; g.fillRect(0, h / 2, w, h / 2);
    g.font = 'italic 900 46px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; g.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) g.fillText('GOAL!', (i + 0.5) * w / 6, h * 0.75 + 2);
  }, { repeat: [1, 1] });
}

function netTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4.5;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.closePath(); g.stroke();
  }, { repeat: [1, 1] });
}

function glowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,250,235,0.8)'); gr.addColorStop(0.45, 'rgba(200,220,255,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
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

// ribbon lines on the pitch: polylines -> one flat triangle mesh
function lineMesh(polys, width, mat) {
  const pos = [], idx = [];
  for (const pts of polys) {
    const n = pts.length, v0 = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = -tz * width / 2, nz = tx * width / 2;
      pos.push(pts[i][0] + nx, 0.012, pts[i][1] + nz, pts[i][0] - nx, 0.012, pts[i][1] - nz);
      if (i < n - 1) { const v = v0 + i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.renderOrder = 1;
  return m;
}
const arc = (cx, cz, r, a0, a1, n = 40) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return p; };
const rectP = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];

// low-poly person for the crowd: body, head and two arms, tagged per part for the vertex animation
function personGeometry() {
  const parts = [];
  const body = new THREE.CylinderGeometry(0.15, 0.21, 0.72, 6, 1); body.translate(0, 0.38, 0); parts.push([body, 0]);
  const head = new THREE.IcosahedronGeometry(0.15, 0); head.translate(0, 0.9, 0); parts.push([head, 1]);
  for (const s of [-1, 1]) { const arm = new THREE.CylinderGeometry(0.05, 0.045, 0.44, 4, 1, true); arm.translate(s * 0.25, 0.44, 0); parts.push([arm, s < 0 ? 2 : 3]); }
  const pos = [], nor = [], part = [];
  for (const [g0, id] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) part.push(id);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  return g;
}

export function createStage(renderer, quality) {
  const scene = new THREE.Scene();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const S = { scene };
  const T = { uTime: { value: 0 } };

  // ---- sky: gradient + fbm clouds + sun disc (HDR, blooms and flares) + twinkling stars
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() },
      stars: { value: 0 }, clouds: { value: 1 }, sun: { value: 1 }, sunDir: { value: new THREE.Vector3(-0.45, 0.42, -0.78).normalize() }, uTime: T.uTime,
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 top, hor, bot, sunDir; uniform float stars, clouds, sun, uTime; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += vn(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return s; }
      void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0), 0.5)) : mix(hor, bot, clamp(-y*4.0,0.0,1.0));
        float sd = max(dot(vP, sunDir), 0.0);
        c += vec3(1.0, 0.85, 0.6) * (pow(sd, 8.0) * 0.25 + pow(sd, 90.0) * 0.6) * sun;
        if (clouds > 0.0 && y > 0.0) {
          vec2 q = vP.xz / (y + 0.12) * 0.9 + vec2(uTime * 0.006, uTime * 0.002);
          float n = fbm(q), n2 = fbm(q * 1.7 + 4.0);
          float cl = smoothstep(0.56, 0.86, n) * smoothstep(0.02, 0.22, y) * clouds;
          vec3 cc = mix(vec3(1.0), hor * 0.85 + 0.12, 0.35 + 0.4 * n2);
          cc += vec3(1.0, 0.9, 0.75) * pow(sd, 6.0) * 0.6 * sun;
          c = mix(c, cc, cl * 0.92);
        }
        c += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.99975, sd) * 14.0 * sun;
        if (stars > 0.0 && y > 0.06) { vec3 q = floor(vP * 300.0); float s = step(0.9968, h(q));
          float tw = 0.6 + 0.4 * sin(uTime * (2.0 + h(q + 3.0) * 4.0) + h(q) * 30.0);
          c += vec3(s * tw) * stars * smoothstep(0.06, 0.4, y) * (1.0 + 2.0 * step(0.9993, h(q + 7.0))); }
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);
  S.skyMat = skyMat;

  // ---- ground + grass
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x2f6a2a, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03; outer.receiveShadow = true;
  scene.add(outer);
  const gt = grassTextures(aniso);
  const PW = 2 * AX + 6, PD = AZ1 - AZ0 + 6, PX0 = -AX - 3, PZ0 = AZ0 - 3;
  gt.albedo.repeat.set(PW / 2.2, PD / 2.2); gt.normal.repeat.set(PW / 2.2, PD / 2.2);
  const wear = wearTexture();
  const grassU = { uWear: { value: wear }, uStripe: { value: 4.0 }, uBase: { value: new THREE.Color(0x4caa3c) } };
  const grassMat = new THREE.MeshStandardMaterial({ map: gt.albedo, normalMap: gt.normal, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.9, metalness: 0, color: 0xffffff });
  grassMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, grassU);
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vWp; uniform sampler2D uWear; uniform float uStripe; uniform vec3 uBase;\n` + sh.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      {
        // mowed stripes across the pitch (anti-aliased) + a faint lengthwise pattern
        float sz = vWp.z / uStripe; float fw = fwidth(sz) + 1e-4;
        float st = smoothstep(0.5 - fw, 0.5 + fw, abs(fract(sz) - 0.5) * 2.0);
        float sx = vWp.x / 8.0; float fx = fwidth(sx) + 1e-4;
        float st2 = smoothstep(0.5 - fx, 0.5 + fx, abs(fract(sx) - 0.5) * 2.0);
        vec3 g = uBase * (0.86 + 0.16 * st) * (0.97 + 0.04 * st2);
        vec2 wuv = vec2((vWp.x + ${AX.toFixed(1)}) / ${(2 * AX).toFixed(1)}, (vWp.z - (${AZ0.toFixed(2)})) / ${(AZ1 - AZ0).toFixed(2)});
        float wr = texture2D(uWear, wuv).r;
        g = mix(g, vec3(0.42, 0.45, 0.24), wr * 0.55);
        diffuseColor.rgb *= g;
      }`);
  };
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), grassMat);
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(PX0 + PW / 2, 0, PZ0 + PD / 2); pitch.receiveShadow = true;
  scene.add(pitch);
  S.grassMat = grassMat;

  // ---- crisp pitch lines (geometry, not texture)
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, emissive: 0xffffff, emissiveIntensity: 0.08, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const TL = AX - 1.2, FL = AZ1 - 1.2, BOX = 18, BW = GX + 10;
  const dA = Math.acos((BOX - SPOT) / 7.5);
  const lines = lineMesh([
    rectP(-TL, 0, TL, FL),
    rectP(-GX - 3.5, 0, GX + 3.5, 5.5),
    rectP(-BW, 0, BW, BOX),
    arc(0, SPOT, 7.5, Math.PI / 2 - dA, Math.PI / 2 + dA),
    arc(0, FL, 9, Math.PI, Math.PI * 2),
    arc(-TL, 0, 1.2, 0, Math.PI / 2, 10), arc(TL, 0, 1.2, Math.PI / 2, Math.PI, 10),
  ], 0.14, lineMat);
  scene.add(lines);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), lineMat); spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.013, SPOT); scene.add(spot);
  const cspot = spot.clone(); cspot.position.z = FL; scene.add(cspot);

  // ---- LED ad boards (scrolling, dot-matrix, flash GOAL!)
  const bt = boardTexture();
  bt.wrapS = THREE.RepeatWrapping;
  const ledU = { uScroll: { value: 0 }, uGoal: { value: 0 }, uTime: T.uTime, uBright: { value: 1 } };
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.1, emissive: 0xffffff, emissiveMap: bt, emissiveIntensity: 1 });
  boardMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, ledU);
    sh.fragmentShader = 'uniform float uScroll, uGoal, uTime, uBright;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `
      {
        vec2 uv = vEmissiveMapUv; uv.x += uScroll;
        vec3 ad = texture2D(emissiveMap, vec2(uv.x, uv.y * 0.5 + 0.5)).rgb;
        vec3 gl = texture2D(emissiveMap, vec2(uv.x * 2.0 - uTime * 0.6, uv.y * 0.5)).rgb * (0.75 + 0.25 * sin(uTime * 18.0));
        vec3 led = mix(ad, gl, uGoal);
        vec2 cell = fract(vEmissiveMapUv * vec2(${(2048 / 8).toFixed(1)} * 3.0, 18.0));
        float dotm = smoothstep(0.5, 0.2, length(cell - 0.5));
        totalEmissiveRadiance *= led * (0.35 + 0.85 * dotm) * uBright;
      }`);
  };
  const boardBack = new THREE.MeshStandardMaterial({ color: 0x1e2230, roughness: 0.8 });
  const bmats = [boardBack, boardBack, boardBack, boardBack, boardMat, boardBack];
  const addBoard = (x, z, len, rotY) => {
    const g = new THREE.BoxGeometry(len, 1.0, 0.3);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 26);
    const m = new THREE.Mesh(g, bmats);
    m.position.set(x, 0.5, z); m.rotation.y = rotY; m.receiveShadow = true;
    scene.add(m);
  };
  addBoard(0, AZ0 - 0.2, AX * 2 + 1, 0);
  addBoard(-AX - 0.2, (AZ0 + AZ1) / 2, AZ1 - AZ0, Math.PI / 2);
  addBoard(AX + 0.2, (AZ0 + AZ1) / 2, AZ1 - AZ0, -Math.PI / 2);
  addBoard(0, AZ1 + 0.2, AX * 2 + 1, Math.PI);
  S.boardMat = boardMat;

  // ---- stands (+ roofs over the long sides)
  const standMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.85 });
  const seatsMat = new THREE.MeshStandardMaterial({ color: 0x2b5fd9, roughness: 0.7 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd5dbe4, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x8e98a8, roughness: 0.45, metalness: 0.75 });
  const stripMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 0 });
  S.standMat = standMat; S.roofMat = roofMat;
  const stands = [];
  const ROWS = 12, STEP = 0.95, RISE = 0.55;
  const structure = new THREE.Group(); scene.add(structure);
  function addStand(cx, cz, rotY, len, roof) {
    const m = new THREE.Mesh(stairs(ROWS, STEP, RISE, len, 1.4), standMat);
    m.position.set(cx, 0, cz); m.rotation.y = rotY; m.receiveShadow = true;
    structure.add(m);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, len), seatsMat); front.position.set(0.15, 0.7, 0); m.add(front);
    // back wall
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.5, len), standMat); back.position.set(ROWS * STEP + 0.25, 4.75, 0); m.add(back);
    if (roof) {
      const depth = ROWS * STEP + 4;
      const r = new THREE.Mesh(new THREE.BoxGeometry(depth, 0.25, len + 2), roofMat);
      r.position.set(ROWS * STEP - depth / 2 + 0.5, 12.6, 0); r.rotation.z = -0.1; r.castShadow = true; m.add(r);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, len), stripMat); strip.position.set(ROWS * STEP - depth + 1.2, 12.05, 0); m.add(strip);
      const nCol = Math.round(len / 12);
      for (let i = 0; i <= nCol; i++) {
        const z = -len / 2 + i * len / nCol;
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.45, 13.5, 0.45), steelMat); col.position.set(ROWS * STEP + 0.6, 6.75, z); m.add(col);
        const truss = new THREE.Mesh(new THREE.BoxGeometry(depth, 0.35, 0.25), steelMat); truss.position.set(ROWS * STEP - depth / 2 + 0.5, 13.1, z); truss.rotation.z = -0.1; m.add(truss);
      }
    }
    stands.push({ m, len, rotY, cx, cz });
    return m;
  }
  addStand(0, AZ0 - 1.6, Math.PI / 2, AX * 2 + 8, false);
  addStand(-AX - 1.6, (AZ0 + AZ1) / 2, Math.PI, AZ1 - AZ0 + 2, true);
  addStand(AX + 1.6, (AZ0 + AZ1) / 2, 0, AZ1 - AZ0 + 2, true);
  addStand(0, AZ1 + 1.6, -Math.PI / 2, AX * 2 + 8, false);
  S.stripMat = stripMat;

  // ---- crowd: instanced people that bob, wave and jump (all in the vertex shader)
  const crowdG = personGeometry();
  const crowdMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const cu = { uTime: T.uTime, uExcite: { value: 0.15 }, uJump: { value: 0 } };
  crowdMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, cu);
    sh.vertexShader = 'attribute float aPhase; attribute float aPart; uniform float uTime, uExcite, uJump; varying float vPart; varying float vSkin;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
       float ph = aPhase; vPart = aPart; vSkin = fract(ph * 7.31);
       float wave = clamp(uExcite * 1.5 - 0.35 + uJump, 0.0, 1.0) * (0.55 + 0.45 * sin(uTime * (5.0 + ph * 3.0) + ph * 12.0));
       float side = aPart > 2.5 ? 1.0 : -1.0;
       float ang = aPart > 1.5 ? side * (0.15 + wave * 2.7) : 0.0;
       float ca = cos(ang), sa = sin(ang);
       objectNormal.xy = mat2(ca, sa, -sa, ca) * objectNormal.xy;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
       if (aPart > 1.5) { vec2 piv = vec2(side * 0.25, 0.64); vec2 d = transformed.xy - piv; transformed.xy = piv + mat2(ca, sa, -sa, ca) * d; }
       float bob = max(0.0, sin(uTime * (6.0 + ph * 4.0) + ph * 40.0));
       float jmp = uJump * max(0.0, sin(uTime * (8.5 + ph * 2.0) + ph * 20.0));
       transformed.y += bob * bob * uExcite * 0.32 + jmp * 0.55 + sin(uTime * 1.7 + ph * 30.0) * 0.03;`);
    sh.fragmentShader = 'varying float vPart; varying float vSkin;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
       if (vPart > 0.5 && vPart < 1.5) diffuseColor.rgb = mix(vec3(0.98, 0.78, 0.62), vec3(0.42, 0.28, 0.19), vSkin);`);
  };
  const order = [];
  const rnd = lcg(7);
  const placements = [];
  for (const st of stands) {
    const cols = Math.floor(st.len / 0.82);
    const c = Math.cos(st.rotY), s = -Math.sin(st.rotY);
    for (let r = 0; r < ROWS; r++) for (let i = 0; i < cols; i++) {
      if (rnd() < 0.06) continue; // a few empty seats
      const along = (i + 0.5) / cols * st.len - st.len / 2 + (rnd() - 0.5) * 0.2;
      const out = r * STEP + STEP * 0.55;
      placements.push([st.cx + out * c + along * Math.sin(st.rotY), 1.4 + r * RISE, st.cz + out * s + along * Math.cos(st.rotY), st.rotY, r, st === stands[3]]);
    }
  }
  // shuffle so a lower quality tier (which draws only the head of the buffer) empties random seats evenly
  for (let i = placements.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = placements[i]; placements[i] = placements[j]; placements[j] = t; }
  const total = placements.length;
  const crowd = new THREE.InstancedMesh(crowdG, crowdMat, total);
  const phase = new Float32Array(total);
  const o = new THREE.Object3D(), col = new THREE.Color();
  const pal = [0xff4d3d, 0xff4d3d, 0xff4d3d, 0xffffff, 0x2f7cf6, 0x2f7cf6, 0xffd23f, 0x1b1f2e, 0xff8fa3, 0x22c97a, 0xf1f1f1, 0x9b4dff];
  for (let k = 0; k < total; k++) {
    const [x, y, z, rotY] = placements[k];
    o.position.set(x, y, z);
    const sc = 0.9 + rnd() * 0.25;
    o.scale.set(sc, sc * (0.92 + rnd() * 0.2), sc);
    o.rotation.set(0, rotY - Math.PI / 2 + (rnd() - 0.5) * 0.5, 0);
    o.updateMatrix();
    crowd.setMatrixAt(k, o.matrix);
    col.setHex(pal[Math.floor(rnd() * pal.length)]).multiplyScalar(0.7 + rnd() * 0.35);
    crowd.setColorAt(k, col);
    phase[k] = rnd();
    order.push(k);
  }
  crowdG.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  crowd.frustumCulled = false;
  scene.add(crowd);
  S.crowd = crowd; S.crowdTotal = total; S.crowdU = cu;

  // ---- floodlight towers
  const glowTex = glowTexture();
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.4, roughness: 0.3 });
  S.lampMat = lampMat;
  const glows = [];
  for (const [x, z] of [[-AX - 16, AZ0 - 10], [AX + 16, AZ0 - 10], [-AX - 16, AZ1 + 8], [AX + 16, AZ1 + 8]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 34, 10), steelMat); pole.position.set(x, 17, z);
    const head = new THREE.Group(); head.position.set(x, 35, z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8, 4.2, 0.6), steelMat);
    head.add(frame);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.2), lampMat); l.position.set(-2.85 + i * 1.9, -1.3 + j * 1.3, 0.38); head.add(l);
    }
    head.lookAt(0, 0, 22);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.6, 1.5, 1.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.set(34, 34, 1); sp.position.set(x, 35, z);
    sp.position.lerp(new THREE.Vector3(0, 0, 22), 0.03);
    glows.push(sp);
    structure.add(pole, head); scene.add(sp);
  }
  S.glows = glows;
  mergeByMaterial(structure);

  // ---- goal
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.1 });
  const goal = new THREE.Group();
  const pg = new THREE.CylinderGeometry(PR, PR, GY + PR, 20);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(pg, postMat); p.position.set(s * GX, (GY + PR) / 2, 0); p.castShadow = true; goal.add(p);
    const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, GY, 6), postMat); bp.position.set(s * GX, GY / 2, -GD); goal.add(bp);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, GD, 6), postMat); tb.rotation.x = Math.PI / 2; tb.position.set(s * GX, GY, -GD / 2); goal.add(tb);
    const gb = tb.clone(); gb.position.y = 0.04; goal.add(gb);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, GX * 2 + PR * 2, 20), postMat);
  bar.rotation.z = Math.PI / 2; bar.position.set(0, GY, 0); bar.castShadow = true; goal.add(bar);
  const bbar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, GX * 2, 6), postMat); bbar.rotation.z = Math.PI / 2; bbar.position.set(0, GY, -GD); goal.add(bbar);
  scene.add(goal);
  // nets
  const nt = netTexture();
  const panels = [];
  function netPanel(w, h, sw, sh, setup) {
    const g = new THREE.PlaneGeometry(w, h, sw, sh);
    const tex = nt.clone(); tex.needsUpdate = true; tex.repeat.set(w / 0.3, h / 0.3); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.8, depthWrite: true }));
    setup(m);
    m.updateMatrixWorld(true);
    scene.add(m);
    const pos = g.attributes.position; pos.setUsage(THREE.DynamicDrawUsage);
    const base = new Float32Array(pos.count * 3), world = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      base[i * 3] = pos.getX(i); base[i * 3 + 1] = pos.getY(i); base[i * 3 + 2] = pos.getZ(i);
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); world[i * 3] = v.x; world[i * 3 + 1] = v.y; world[i * 3 + 2] = v.z;
    }
    panels.push({ m, pos, base, world, sign: 1 });
    return m;
  }
  netPanel(GX * 2, GY, 30, 10, (m) => { m.position.set(0, GY / 2, -GD); });
  netPanel(GD, GY, 7, 10, (m) => { m.position.set(GX, GY / 2, -GD / 2); m.rotation.y = Math.PI / 2; });
  netPanel(GD, GY, 7, 10, (m) => { m.position.set(-GX, GY / 2, -GD / 2); m.rotation.y = -Math.PI / 2; });
  netPanel(GX * 2, GD, 30, 7, (m) => { m.position.set(0, GY, -GD / 2); m.rotation.x = -Math.PI / 2; });
  panels[0].sign = -1; panels[1].sign = 1; panels[2].sign = 1; panels[3].sign = 1;
  // the net hangs: slight sag in the back panel at rest
  for (const p of [panels[0]]) {
    const B = p.base, g = p.m.geometry.parameters;
    for (let i = 0; i < p.pos.count; i++) { const u = B[i * 3] / (g.width / 2), v = B[i * 3 + 1] / (g.height / 2); B[i * 3 + 2] -= 0.18 * (1 - u * u) * (1 - v * v); }
  }
  const rip = { x: 0, y: 0, z: 0, t: 99, a: 0 };
  S.netHit = (x, y, z, strength) => {
    if (rip.t < 0.15 && strength * 0.03 < rip.a) return;
    rip.x = x; rip.y = y; rip.z = z; rip.t = 0; rip.a = Math.min(0.9, 0.14 + strength * 0.035);
  };
  const press = { x: 0, y: 0, z: 0, d: 0 };
  S.netPress = (x, y, z, d) => { press.x = x; press.y = y; press.z = z; press.d = d; };
  let netActive = true;
  function updateNet(dt) {
    rip.t += dt;
    const live = rip.t < 2.8 || press.d > 0.001;
    if (!live && !netActive) return;
    netActive = live;
    const env = rip.a * Math.exp(-rip.t * 2.0);
    for (const p of panels) {
      const P = p.pos.array, B = p.base, W = p.world, gp = p.m.geometry.parameters;
      for (let i = 0; i < p.pos.count; i++) {
        const wx = W[i * 3], wy = W[i * 3 + 1], wz = W[i * 3 + 2];
        const dx = wx - rip.x, dy = wy - rip.y, dz = wz - rip.z;
        const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
        // bulge where the ball hit + a ring that travels out across the mesh
        let d = env * Math.exp(-r2 / 2.4) * Math.cos(r * 3.0 - rip.t * 15) + env * 0.7 * Math.exp(-r2 / 0.9) * Math.exp(-rip.t * 1.2);
        if (press.d > 0) { const ex = wx - press.x, ey = wy - press.y, ez = wz - press.z; d += press.d * Math.exp(-(ex * ex + ey * ey + ez * ez) / 1.1); }
        const u = Math.abs(B[i * 3]) / (gp.width / 2), v = Math.abs(B[i * 3 + 1]) / (gp.height / 2);
        const e = Math.max(0, 1 - Math.pow(Math.max(u, v), 6));
        P[i * 3 + 2] = B[i * 3 + 2] + d * e * p.sign;
      }
      p.pos.needsUpdate = true;
    }
  }

  // ---- lights (the sun's shadow frustum follows the play for crisp shadows on a big pitch)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x446622, 0.9);
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.castShadow = true;
  const sc = key.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 5; sc.far = 120;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  scene.add(hemi, key, key.target);
  S.key = key; S.hemi = hemi;
  const keyOff = new THREE.Vector3();
  const focus = new THREE.Vector3(0, 0, 14);
  S.focus = (x, z) => {
    // snap to a 1 m grid-ish to avoid shimmering
    focus.set(Math.round(x * 2) / 2, 0, Math.round(z * 2) / 2);
    key.target.position.copy(focus); key.position.copy(focus).add(keyOff);
  };
  S.setShadowSize = (n) => {
    key.shadow.mapSize.set(n, n);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    key.castShadow = n > 0;
  };
  S.setShadowSize(quality >= 2 ? 2048 : 1024);

  // ---- environment maps (sky + bright stadium panels + green ground: clearcoat reflections)
  const pm = new THREE.PMREMGenerator(renderer);
  function envFor(th, night) {
    const es = new THREE.Scene();
    const m = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(th.skyTop) }, hor: { value: new THREE.Color(th.skyHor) }, gr: { value: new THREE.Color(night ? 0x0d1f0b : 0x3c7a30) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top, hor, gr; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor * 0.5, gr, clamp(-y * 5.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }',
    }));
    es.add(m);
    // stands ring (dark band) and light panels
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 10, 32, 1, true), new THREE.MeshBasicMaterial({ color: night ? 0x141a2a : 0x8a94a6, side: THREE.BackSide }));
    ring.position.y = 3; es.add(ring);
    const lv = night ? 9 : 3.5;
    const box = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(lv, lv, lv * 0.92) }));
    for (const [x, y, z] of [[-30, 26, -24], [30, 26, -24], [-30, 26, 30], [30, 26, 30]]) { const b = box.clone(); b.position.set(x, y, z); b.lookAt(0, 0, 0); es.add(b); }
    if (!night) { const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 27, 22) })); sun.position.set(-20, 25, -38); es.add(sun); }
    const rt = pm.fromScene(es, 0.02);
    return rt.texture;
  }
  const envs = { day: envFor(THEMES.day, false), night: envFor(THEMES.night, true) };
  pm.dispose();

  S.theme = null;
  S.setTheme = (name) => {
    const th = THEMES[name]; S.theme = name; S.th = th;
    const u = skyMat.uniforms;
    u.top.value.setHex(th.skyTop); u.hor.value.setHex(th.skyHor); u.bot.value.setHex(th.skyBot);
    u.stars.value = th.stars; u.clouds.value = th.clouds; u.sun.value = th.sun;
    u.sunDir.value.set(th.keyPos[0], th.keyPos[1] * 0.75, -Math.abs(th.keyPos[2]) * 1.6).normalize();
    scene.fog = new THREE.Fog(th.fog, th.fogN, th.fogF);
    key.color.setHex(th.key); key.intensity = th.keyI; keyOff.set(th.keyPos[0], th.keyPos[1], th.keyPos[2]);
    S.focus(focus.x, focus.z);
    hemi.color.setHex(th.hemiS); hemi.groundColor.setHex(th.hemiG); hemi.intensity = th.hemiI;
    grassMat.color.setHex(th.grass);
    scene.environment = envs[name]; scene.environmentIntensity = th.envI;
    renderer.toneMappingExposure = th.exposure;
    for (const g of glows) { g.visible = th.glow > 0; }
    lampMat.emissiveIntensity = th.glow > 0 ? 6 : 0.5;
    stripMat.emissiveIntensity = th.glow > 0 ? 4 : 0.2;
    ledU.uBright.value = th.boardE;
    standMat.color.setHex(th.standC); roofMat.color.setHex(th.roofC);
  };

  S.setCrowdFraction = (f) => { crowd.count = Math.max(300, Math.floor(total * f)); };
  let goalT = 0;
  S.goalFlash = (sec) => { goalT = sec; };
  S.update = (dt, time) => {
    T.uTime.value = time;
    ledU.uScroll.value = (ledU.uScroll.value + dt * 0.035) % 1;
    goalT = Math.max(0, goalT - dt);
    const g = goalT > 0 ? 1 : 0;
    ledU.uGoal.value += (g - ledU.uGoal.value) * Math.min(1, dt * 8);
    cu.uJump.value += (g - cu.uJump.value) * Math.min(1, dt * 4);
    updateNet(dt);
  };
  return S;
}
