// Sky, atmosphere and ambience around the hex planet.
// createAtmosphere(THREE, scene, { R }) -> { update(dt, camera), setFog(on), gradeGLSL }
//
// Draw-call budget: sky dome 1, stars 1, moons 2 + halos 2, atmosphere halo 1, limb haze 1,
// clouds 1 (instanced), birds 1 (instanced), motes 1 = 11 cheap draws, ~14k tris total.

// a colour grade for the bloom composite: call grade(c) on the linear HDR colour
// right after adding bloom and before the soft clamp / tone mapping
export const gradeGLSL = `
vec3 grade(vec3 c) {
  c = max(c, 0.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // lift the darks and mids (multiplicative, so true black stays black and nothing turns grey)
  float lift = 1.0 + 0.2 * (1.0 - smoothstep(0.02, 0.4, l)) * smoothstep(0.0, 0.03, l);
  c *= lift;
  l *= lift;
  // richer colour: stronger in the mids, gentler in the deep shadows and highlights (no neon clipping)
  float sat = 1.1 + 0.14 * smoothstep(0.03, 0.25, l) * (1.0 - smoothstep(0.9, 2.2, l));
  c = max(mix(vec3(l), c, sat), 0.0);
  // coloured shadows: a violet-blue veil instead of black, warm golden light
  float sh = 1.0 - smoothstep(0.0, 0.22, l);
  c += vec3(0.008, 0.004, 0.022) * sh;
  c *= mix(vec3(0.96, 0.99, 1.07), vec3(1.07, 1.01, 0.9), smoothstep(0.1, 0.95, l));
  return c;
}`;

export function createAtmosphere(THREE, scene, opts = {}) {
  const R = opts.R ?? 5;
  const V3 = THREE.Vector3;
  const rand = mulberry32(opts.seed ?? 7);
  const uTime = { value: 0 };
  const sunDir = new V3(0.6, 0.8, 0.4).normalize();
  const uSun = { value: sunDir };

  // ------------------------------------------------------------ sky group (follows the camera, no parallax)
  const sky = new THREE.Group();
  sky.name = 'atmos-sky';
  scene.add(sky);

  // nebula dome: baked once into a small equirect canvas, then drawn with a plain texture lookup
  const domeTex = new THREE.CanvasTexture(bakeNebula(512, 256, rand));
  domeTex.colorSpace = THREE.SRGBColorSpace;
  domeTex.mapping = THREE.UVMapping;
  domeTex.wrapS = THREE.RepeatWrapping;
  // the dome shader adds a screen-anchored sun peeking over the planet's limb: a warm disc, a wide glow and slow god-rays
  const uVis = { value: new V3(0, 1, 0) }, uVR = { value: new V3(1, 0, 0) }, uVU = { value: new V3(0, 0, 1) };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.ShaderMaterial({
    uniforms: { tMap: { value: domeTex }, uVis, uVR, uVU, uTime },
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vD; void main() { vUv = uv; vD = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tMap; uniform vec3 uVis; uniform vec3 uVR; uniform vec3 uVU; uniform float uTime;
      varying vec2 vUv; varying vec3 vD;
      void main() {
        vec3 d = normalize(vD);
        vec3 c = texture2D(tMap, vUv).rgb;
        float cs = dot(d, uVis);
        float ang = acos(clamp(cs, -1.0, 1.0));
        // sun: small hot disc, a gold corona and a broad rosy-amber wash that warms the whole quadrant
        float disc = smoothstep(0.022, 0.012, ang) * 1.2;
        float corona = exp(-ang * 26.0) * 0.6 + exp(-ang * 8.0) * 0.18;
        float wash = exp(-ang * 2.5) * 0.035;
        // god-rays: angular streaks around the sun that slowly turn and breathe
        vec3 t = d - uVis * cs;
        float a = atan(dot(t, uVU), dot(t, uVR));
        float r1 = 0.5 + 0.5 * sin(a * 9.0 + uTime * 0.05) * sin(a * 14.0 - uTime * 0.035 + 1.7);
        float r2 = 0.5 + 0.5 * sin(a * 23.0 + uTime * 0.02 + 0.6);
        float rays = (r1 * r1 * r1 * 0.8 + r2 * r2 * r2 * r2 * 0.35) * (0.8 + 0.2 * sin(uTime * 0.3));
        rays *= exp(-ang * 10.0) * smoothstep(0.02, 0.07, ang) * 0.2;
        c += vec3(1.0, 0.93, 0.78) * disc + vec3(1.0, 0.74, 0.42) * corona + vec3(0.9, 0.5, 0.55) * wash
           + vec3(1.0, 0.82, 0.55) * rays;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  sky.add(dome);

  // twinkling stars: one Points draw, twinkle done on the GPU
  {
    const N = 1600;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), dat = new Float32Array(N * 2);
    const tints = [[1, 1, 1], [0.75, 0.85, 1], [1, 0.9, 0.72], [1, 0.78, 0.9], [0.7, 1, 0.95]];
    const v = new V3();
    for (let i = 0; i < N; i++) {
      // more stars near the galactic band
      do { v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
      v.normalize();
      if (rand() < 0.45) { v.addScaledVector(BAND_N, -v.dot(BAND_N) * (0.75 + rand() * 0.25)).normalize(); }
      v.multiplyScalar(140);
      pos.set([v.x, v.y, v.z], i * 3);
      const big = rand();
      const t = tints[(rand() * tints.length) | 0];
      const b = big > 0.985 ? 2.6 : big > 0.9 ? 1.4 : 0.55 + rand() * 0.5;
      col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
      dat[i * 2] = big > 0.985 ? 5.5 + rand() * 2 : big > 0.9 ? 2.8 + rand() : 1.3 + rand() * 1.1; // size in px (@1x)
      dat[i * 2 + 1] = rand() * 100; // twinkle phase
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aDat', new THREE.BufferAttribute(dat, 2));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime, uPR: { value: 1 } },
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: false,
      vertexShader: `attribute vec2 aDat; attribute vec3 color; uniform float uTime; uniform float uPR; varying vec3 vC; varying float vBig;
        void main() {
          float tw = 0.55 + 0.45 * sin(uTime * (1.3 + fract(aDat.y) * 2.6) + aDat.y) * sin(uTime * 0.7 + aDat.y * 3.1);
          vC = color * tw; vBig = step(4.0, aDat.x);
          gl_PointSize = aDat.x * uPR * (0.85 + 0.3 * tw);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `varying vec3 vC; varying float vBig;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0; float r = length(p);
          float a = exp(-r * r * 6.0);
          float spike = vBig * (exp(-abs(p.x) * 14.0) + exp(-abs(p.y) * 14.0)) * (1.0 - r) * 0.8;
          float i = a + max(spike, 0.0);
          if (i < 0.01) discard;
          gl_FragColor = vec4(vC * i, 1.0);
        }`,
    });
    const stars = new THREE.Points(g, m);
    stars.renderOrder = -9; stars.frustumCulled = false;
    sky.add(stars);
    sky.userData.starMat = m;
  }

  // two moons: a big pale one with craters and a small amber one; crescent-lit, with a soft halo
  const moons = new THREE.Group();
  sky.add(moons);
  const moonLight = new V3(0.9, 0.25, 0.35).normalize();
  const moonGeo = new THREE.SphereGeometry(1, 32, 20);
  const haloTex = new THREE.CanvasTexture(radialTex(128));
  const mkMoon = (dir, dist, size, base, accent, haloCol, spin) => {
    const tex = new THREE.CanvasTexture(moonCanvas(256, 128, base, accent, rand));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: tex }, uL: { value: moonLight } },
      depthWrite: false,
      vertexShader: `varying vec2 vUv; varying vec3 vN; void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D tMap; uniform vec3 uL; varying vec2 vUv; varying vec3 vN;
        void main() { vec3 t = texture2D(tMap, vUv).rgb; t = t * t; // sRGB-ish to linear
          float d = dot(normalize(vN), uL);
          float lit = smoothstep(-0.12, 0.45, d);
          vec3 c = t * (lit * 1.35 + 0.05) + vec3(0.02, 0.03, 0.07);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const m = new THREE.Mesh(moonGeo, mat);
    m.position.copy(dir).normalize().multiplyScalar(dist);
    m.scale.setScalar(size);
    m.rotation.set(rand() * 6, rand() * 6, 0.3);
    m.renderOrder = -8; m.frustumCulled = false; m.userData.spin = spin;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: haloCol, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    halo.position.copy(m.position); halo.scale.setScalar(size * 4.2);
    halo.renderOrder = -7; halo.frustumCulled = false;
    moons.add(m, halo);
    return m;
  };
  const moonA = mkMoon(new V3(-0.55, 0.42, -0.72), 115, 10, [205, 212, 235], [150, 160, 200], new THREE.Color(0.22, 0.3, 0.5), 0.004);
  const moonB = mkMoon(new V3(0.75, -0.18, 0.62), 120, 3.6, [240, 170, 110], [180, 100, 80], new THREE.Color(0.35, 0.18, 0.08), -0.01);

  // ------------------------------------------------------------ atmosphere: outer halo (analytic ray / sphere glow)
  const Rp = R + 0.25, Ra = R * 1.34;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(Ra, 64, 32), new THREE.ShaderMaterial({
    uniforms: { uSun, uVis, uRp: { value: Rp }, uRa: { value: Ra } },
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uSun; uniform vec3 uVis; uniform float uRp; uniform float uRa; varying vec3 vW;
      void main() {
        vec3 rd = normalize(vW - cameraPosition);
        float t = max(-dot(cameraPosition, rd), 0.0);
        vec3 cp = cameraPosition + rd * t;
        float b = length(cp);
        float x = clamp((b - uRp) / (uRa - uRp), 0.0, 1.0);
        float g = (1.0 - x) * (0.3 * exp(-x * 2.2) + 0.7 * exp(-x * 8.0));
        float s = dot(cp / max(b, 0.001), uSun);
        // azure-cyan rim on the day side, magenta-violet on the night side, white-hot right at the limb
        vec3 day = mix(vec3(0.22, 0.5, 1.25), vec3(0.62, 0.9, 1.35), exp(-x * 9.0));
        vec3 dusk = mix(vec3(0.32, 0.16, 0.7), vec3(0.55, 0.35, 0.95), exp(-x * 9.0));
        vec3 c = mix(dusk, day, smoothstep(-0.6, 0.4, s));
        c += vec3(1.0, 0.5, 0.35) * exp(-abs(s + 0.05) * 6.0) * 0.3 * exp(-x * 5.0); // warm terminator band
        // sunrise: the limb nearest the sun blazes gold-pink
        float sa = acos(clamp(dot(rd, uVis), -1.0, 1.0));
        c += vec3(1.25, 0.66, 0.36) * (exp(-sa * 5.0) * 0.9 + exp(-sa * 1.6) * 0.15) * exp(-x * 5.0);
        gl_FragColor = vec4(c * g * 0.7, 1.0);
      }`,
  }));
  halo.renderOrder = 5;
  scene.add(halo);

  // limb haze over the terrain (aerial perspective near the horizon); toggled by setFog
  const haze = new THREE.Mesh(new THREE.SphereGeometry(R + 0.72, 64, 32), new THREE.ShaderMaterial({
    uniforms: { uSun, uK: { value: 1 }, uRp: { value: R + 0.25 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vW; varying vec3 vN; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uSun; uniform float uK; uniform float uRp; varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 v = normalize(cameraPosition - vW);
        float f = 1.0 - abs(dot(vN, v));
        float t = max(dot(cameraPosition, v), 0.0);
        float b = length(cameraPosition - v * t);           // closest approach of the view ray
        f *= 1.0 - smoothstep(uRp - 0.15, uRp + 0.3, b);    // only over the ground, never a glassy edge
        float s = smoothstep(-0.4, 0.6, dot(vN, uSun));
        vec3 c = mix(vec3(0.26, 0.16, 0.5), vec3(0.36, 0.64, 1.05), s);
        gl_FragColor = vec4(c * pow(f, 5.0) * 0.26 * uK, 1.0);
      }`,
  }));
  haze.renderOrder = 6;
  scene.add(haze);

  // ------------------------------------------------------------ clouds: instanced low-poly puffs orbiting at ~R+1.2
  const NC = 18;
  const cloudGeo = cloudGeometry(THREE, rand);
  const cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
    emissive: new THREE.Color(0xa6aee6), emissiveIntensity: 0.5 });
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, NC);
  clouds.frustumCulled = false;
  clouds.castShadow = false;
  clouds.name = 'atmos-clouds';
  scene.add(clouds);
  const cl = [];
  for (let i = 0; i < NC; i++) {
    const lat = (rand() * 2 - 1) * 1.1;
    cl.push({ lat, lon: rand() * Math.PI * 2, spd: (0.012 + rand() * 0.02) * (rand() < 0.15 ? -1 : 1),
      alt: R + 1.1 + rand() * 0.35, yaw: rand() * 6.28, s: 0.45 + rand() * 0.4, sy: 0.75 + rand() * 0.35, fade: 1, bob: rand() * 6 });
  }

  // ------------------------------------------------------------ birds: a few V flocks of flapping gulls
  const flocks = [];
  for (let f = 0; f < 3; f++) {
    const axis = new V3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    const start = new V3(rand() - 0.5, rand() - 0.5, rand() - 0.5).cross(axis).normalize();
    flocks.push({ axis, start, a: rand() * 6.28, spd: 0.07 + rand() * 0.04, alt: R + 0.75 + rand() * 0.25, n: 5 });
  }
  const NB = flocks.reduce((s, f) => s + f.n, 0);
  const birdMat = new THREE.MeshLambertMaterial({ color: 0xf2eee6, side: THREE.DoubleSide, emissive: 0x3a3a50 });
  birdMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float fl = sin(uTime * 13.0 + float(gl_InstanceID) * 1.9);
       transformed.y += fl * abs(position.x) * 0.9 - abs(position.x) * 0.15;`);
  };
  const birds = new THREE.InstancedMesh(birdGeometry(THREE), birdMat, NB);
  birds.frustumCulled = false;
  scene.add(birds);

  // ------------------------------------------------------------ magic motes: drifting sparkles near the surface (GPU-animated)
  let motes;
  {
    const N = 140;
    const dir = new Float32Array(N * 3), dat = new Float32Array(N * 4), col = new Float32Array(N * 3);
    const pal = [[2.4, 1.8, 0.6], [0.7, 2.0, 2.3], [2.2, 0.9, 2.0], [1.3, 2.2, 1.0]];
    const v = new V3();
    for (let i = 0; i < N; i++) {
      do { v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
      v.normalize(); dir.set([v.x, v.y, v.z], i * 3);
      dat.set([R + 0.35 + rand() * 1.1, rand() * 100, 0.6 + rand() * 0.8, (rand() - 0.5) * 0.12], i * 4); // radius, phase, size, drift speed
      const p = pal[(rand() * pal.length) | 0];
      col.set(p, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aDat', new THREE.BufferAttribute(dat, 4));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.boundingSphere = new THREE.Sphere(new V3(), R + 2);
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime, uPR: { value: 1 }, uScale: { value: 400 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: `attribute vec4 aDat; attribute vec3 color; uniform float uTime; uniform float uPR; uniform float uScale; varying vec3 vC;
        void main() {
          float a = uTime * aDat.w + aDat.y;
          vec3 d = position; float c = cos(a), s = sin(a);
          d = vec3(d.x * c - d.z * s, d.y, d.x * s + d.z * c);
          vec3 tng = normalize(cross(d, vec3(0.3, 1.0, 0.2)));
          d = normalize(d + tng * sin(uTime * 0.4 + aDat.y) * 0.06);
          float r = aDat.x + sin(uTime * 0.6 + aDat.y * 1.7) * 0.18;
          vec4 mv = modelViewMatrix * vec4(d * r, 1.0);
          float tw = 0.5 + 0.5 * sin(uTime * 3.0 + aDat.y * 5.0);
          float life = smoothstep(0.0, 0.3, sin(uTime * 0.25 + aDat.y)); // motes fade in and out
          vC = color * (0.35 + tw * 0.9) * life;
          gl_PointSize = aDat.z * uPR * uScale * 0.05 / -mv.z * (0.7 + tw * 0.5);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying vec3 vC; void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p);
          float i = exp(-r2 * 5.0) + exp(-r2 * 40.0); if (i < 0.02) discard; gl_FragColor = vec4(vC * i, 1.0); }`,
    });
    motes = new THREE.Points(g, m);
    motes.renderOrder = 7;
    scene.add(motes);
  }

  // ------------------------------------------------------------ per-frame
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), p = new V3(), up = new V3(), fw = new V3(), sd = new V3();
  const ndc = new V3(), right = new V3(), Y = new V3(0, 1, 0), camDir = new V3(), qy = new THREE.Quaternion(), tmp = new V3(), tmp2 = new V3();
  let fogOn = true, hazeK = 1;

  function update(dt, camera) {
    uTime.value += dt;
    const pr = (camera.userData.pixelRatio) || (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    sky.userData.starMat.uniforms.uPR.value = pr;
    motes.material.uniforms.uPR.value = pr;
    // point size in screen px per world unit at distance 1
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    motes.material.uniforms.uScale.value = vh / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov || 45) / 2));

    sky.position.copy(camera.position);
    moons.rotation.y += dt * 0.004;
    moonA.rotation.y += dt * moonA.userData.spin; moonB.rotation.y += dt * moonB.userData.spin;

    // light direction for the halo: like the game's view-following sun (front, up and to the right of the camera)
    camDir.copy(camera.position).normalize();
    right.crossVectors(camera.position, Y);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const camUp = sd.crossVectors(right, camDir).normalize();
    uSun.value.copy(camDir).multiplyScalar(0.55).addScaledVector(right, 0.55).addScaledVector(camUp, 0.6).normalize();

    // the visible sun: anchored near the top-right of the screen, so it always peeks over the limb / horizon
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    const cR = tmp.set(e[0], e[1], e[2]).normalize(), cU = tmp2.set(e[4], e[5], e[6]).normalize();
    const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov || 45) / 2), tx = ty * (camera.aspect || 1);
    uVis.value.set(-e[8], -e[9], -e[10]).normalize().addScaledVector(cR, tx * 0.32).addScaledVector(cU, ty * 0.8).normalize();
    uVR.value.copy(cR); uVU.value.copy(cU);

    // haze eases in / out
    hazeK += ((fogOn ? 1 : 0) - hazeK) * Math.min(1, dt * 3);
    haze.material.uniforms.uK.value = hazeK;
    haze.visible = hazeK > 0.01;

    // clouds: orbit, and shrink away when they would block the view (close to the camera or centre of the screen)
    const camDist = camera.position.length();
    const near = THREE.MathUtils.clamp((16 - camDist) / 7, 0, 1); // 0 when far, 1 when zoomed in
    for (let i = 0; i < NC; i++) {
      const c = cl[i];
      c.lon += c.spd * dt;
      const cy = Math.cos(c.lat);
      p.set(Math.cos(c.lon) * cy, Math.sin(c.lat), Math.sin(c.lon) * cy);
      up.copy(p);
      p.multiplyScalar(c.alt + Math.sin(uTime.value * 0.3 + c.bob) * 0.04);
      // view occlusion
      const dCam = p.distanceTo(camera.position);
      ndc.copy(p).project(camera);
      const centre = Math.hypot(ndc.x * 0.8, ndc.y);
      const facing = up.dot(camDir);
      let want = 1;
      want *= THREE.MathUtils.smoothstep(dCam, 2.6, 4.6);                       // too close to the lens
      // a cloud over the visible face of the planet would hide the map: only let it live on the rim ring
      // (where it frames the limb) or right up at the horizon line at the top of a tilted close view
      const limb = R / camDist;
      if (facing > limb - 0.05 && ndc.z < 1) {
        const ring = 1 - THREE.MathUtils.smoothstep(facing, limb + 0.04, limb + 0.16 - near * 0.08);
        const horizon = THREE.MathUtils.smoothstep(ndc.y, 0.62, 0.8);
        const offscreen = THREE.MathUtils.smoothstep(Math.abs(ndc.x), 0.95, 1.1);
        want *= Math.max(ring, horizon, offscreen) * (1 - 0.5 * (1 - THREE.MathUtils.smoothstep(centre, 0.3, 0.7)));
      }
      c.fade += (want - c.fade) * Math.min(1, dt * 2.5);
      const s = c.s * (0.15 + 0.85 * c.fade) * (c.fade < 0.03 ? 0 : 1);
      q.setFromUnitVectors(Y, up);
      q.multiply(qy.setFromAxisAngle(Y, c.yaw));
      sc.set(s, s * c.sy, s);
      mtx.compose(p, q, sc);
      clouds.setMatrixAt(i, mtx);
    }
    clouds.instanceMatrix.needsUpdate = true;

    // birds
    let k = 0;
    for (const f of flocks) {
      f.a += f.spd * dt;
      up.copy(f.start).applyAxisAngle(f.axis, f.a);
      fw.crossVectors(f.axis, up).normalize();
      sd.crossVectors(up, fw).normalize();
      for (let i = 0; i < f.n; i++) {
        const row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? 1 : -1);
        const wob = Math.sin(uTime.value * 1.3 + i * 2.1) * 0.02;
        p.copy(up).multiplyScalar(f.alt + wob + row * 0.01)
          .addScaledVector(fw, -row * 0.16).addScaledVector(sd, side * row * 0.14);
        const n = sc.copy(p).normalize();
        tmp2.copy(fw).addScaledVector(n, -n.dot(fw)).normalize();
        mtx.makeBasis(tmp.crossVectors(n, tmp2).normalize(), n, tmp2);
        mtx.setPosition(p);
        birds.setMatrixAt(k++, mtx.scale(ndc.set(0.6, 0.6, 0.6)));
      }
    }
    birds.instanceMatrix.needsUpdate = true;
  }

  function setFog(on) { fogOn = !!on; }

  return { update, setFog, gradeGLSL, objects: { sky, halo, haze, clouds, birds, motes } };
}

// ============================================================ helpers

const BAND_N = { x: 0.32, y: 0.86, z: -0.4 };
{ const l = Math.hypot(BAND_N.x, BAND_N.y, BAND_N.z); BAND_N.x /= l; BAND_N.y /= l; BAND_N.z /= l; }

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// fast 3D value noise with a permutation table
function makeNoise(rand) {
  const P = new Uint8Array(512), G = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; G[i] = rand(); }
  for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const h = (x, y, z) => G[P[P[P[x & 255] + (y & 255)] + (z & 255)]];
  const noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let fx = x - xi, fy = y - yi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const a = h(xi, yi, zi), b = h(xi + 1, yi, zi), c = h(xi, yi + 1, zi), d = h(xi + 1, yi + 1, zi);
    const e = h(xi, yi, zi + 1), f = h(xi + 1, yi, zi + 1), g = h(xi, yi + 1, zi + 1), k = h(xi + 1, yi + 1, zi + 1);
    const x1 = a + (b - a) * fx, x2 = c + (d - c) * fx, x3 = e + (f - e) * fx, x4 = g + (k - g) * fx;
    const y1 = x1 + (x2 - x1) * fy, y2 = x3 + (x4 - x3) * fy;
    return y1 + (y2 - y1) * fz;
  };
  const fbm = (x, y, z, o) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += noise(x * f, y * f, z * f) * a; f *= 2.03; a *= 0.5; } return s; };
  return { noise, fbm };
}

// equirect nebula: a luminous twilight-blue / violet sky, a tilted milky band with soft dust lanes,
// and big glowing magenta / teal / gold / azure nebula clouds with bright cores
function bakeNebula(W, H, rand) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H), D = img.data;
  const { fbm } = makeNoise(rand);
  const glowDir = [-0.5, 0.35, -0.75];
  const blobs = [
    { d: norm([0.7, 0.3, -0.6]), c: [0.95, 0.22, 0.75], w: 3.2 },   // rose-magenta
    { d: norm([-0.8, -0.2, 0.5]), c: [0.12, 0.7, 0.85], w: 3.0 },   // teal
    { d: norm([0.1, -0.7, 0.7]), c: [0.95, 0.55, 0.2], w: 4.0 },    // gold
    { d: norm([-0.3, 0.75, 0.55]), c: [0.3, 0.42, 1.0], w: 3.4 },   // azure
    { d: norm([0.2, 0.1, 0.95]), c: [0.62, 0.3, 1.0], w: 3.6 },     // violet
    { d: norm([-0.6, -0.7, -0.4]), c: [0.85, 0.3, 0.55], w: 3.6 },  // pink
  ];
  for (let j = 0; j < H; j++) {
    const th = (j + 0.5) / H * Math.PI;           // 0 at top
    const sy = Math.cos(th), sr = Math.sin(th);
    for (let i = 0; i < W; i++) {
      // match three.js SphereGeometry UVs: u = phi / 2PI, x = -cos(phi) sin(theta), z = sin(phi) sin(theta)
      const ph = (i + 0.5) / W * Math.PI * 2;
      const x = -Math.cos(ph) * sr, y = sy, z = Math.sin(ph) * sr;
      const n1 = fbm(x * 2.2 + 3.1, y * 2.2, z * 2.2, 4);
      const n2 = fbm(x * 5 + 11, y * 5 + 7, z * 5, 3);
      const n3 = fbm(x * 1.1 + 5, y * 1.1 + 2, z * 1.1 + 9, 3);
      const bandD = x * BAND_N.x + y * BAND_N.y + z * BAND_N.z;
      const band = Math.exp(-bandD * bandD * 7) * (0.4 + n1 * 1.1);
      const dust = Math.max(0, n2 - 0.5) * 2.0 * Math.exp(-bandD * bandD * 30);
      // twilight base: royal blue above, indigo-violet below, never black
      const up = y * 0.5 + 0.5;
      let r = 0.008 + 0.014 * (1 - up), g = 0.016 + 0.012 * up, b = 0.075 + 0.03 * up;
      // big soft colour wash (violet <-> deep teal)
      const w1 = n3 * n3, w2 = (1 - n3) * (1 - n3);
      r += w1 * 0.025; g += w1 * 0.004 + w2 * 0.016; b += w1 * 0.035 + w2 * 0.03;
      const w = n1 * n1 * n1;
      r += w * 0.03; g += w * 0.008; b += w * 0.05;
      // the milky band: luminous lavender-blue core, rosy fringes, soft dust lanes
      const bandC = band * band;
      r += bandC * (0.07 + 0.07 * n2); g += bandC * (0.07 + 0.03 * n2); b += bandC * 0.16;
      r *= 1 - dust * 0.35; g *= 1 - dust * 0.4; b *= 1 - dust * 0.3;
      // coloured nebula clouds with brighter cores
      for (const bl of blobs) {
        const dd = 1 - (x * bl.d[0] + y * bl.d[1] + z * bl.d[2]);
        const m = Math.max(0, n1 * 1.8 - 0.42);
        const k = Math.exp(-dd * bl.w * 1.7) * (m * m * m * (0.5 + n2) * 1.7 + Math.exp(-dd * bl.w * 4) * 0.05);
        r += bl.c[0] * k; g += bl.c[1] * k; b += bl.c[2] * k;
      }
      // a soft glow behind the big moon
      const gd = 1 - (x * glowDir[0] + y * glowDir[1] + z * glowDir[2]);
      const gk = Math.exp(-gd * 6) * 0.06;
      r += gk * 0.7; g += gk * 0.85; b += gk * 1.1;
      const o = (j * W + i) * 4;
      D[o] = toS(r); D[o + 1] = toS(g); D[o + 2] = toS(b); D[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function toS(v) { v = Math.max(0, v); return Math.min(255, Math.round(Math.pow(v, 1 / 2.2) * 255)); }

function moonCanvas(W, H, base, accent, rand) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = `rgb(${base})`; c.fillRect(0, 0, W, H);
  // maria
  for (let i = 0; i < 9; i++) {
    const x = rand() * W, y = H * (0.2 + rand() * 0.6), r = 12 + rand() * 30;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${accent},0.55)`); g.addColorStop(1, `rgba(${accent},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // craters: dark floor, bright rim
  for (let i = 0; i < 70; i++) {
    const x = rand() * W, y = H * (0.1 + rand() * 0.8), r = 1.5 + Math.pow(rand(), 3) * 12;
    c.fillStyle = 'rgba(40,40,70,0.28)'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.32)'; c.lineWidth = Math.max(1, r * 0.25);
    c.beginPath(); c.arc(x - r * 0.15, y - r * 0.15, r, 2.4, 5.6); c.stroke();
  }
  return cv;
}

function radialTex(S) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  return cv;
}

// a puffy cloud: 6-8 squashed icosahedron blobs, white tops and blue-grey bellies
function cloudGeometry(THREE, rand) {
  const parts = [];
  const nb = 7;
  for (let i = 0; i < nb; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const t = (i / (nb - 1)) * 2 - 1;
    const r = 0.24 + (1 - Math.abs(t)) * 0.24 + rand() * 0.08;
    g.scale(r * 1.15, r * 0.85, r);
    g.translate(t * 0.78 + (rand() - 0.5) * 0.1, (1 - Math.abs(t)) * 0.14 + r * 0.3, (rand() - 0.5) * 0.42);
    parts.push(g);
  }
  // flat-ish bottom
  let count = 0; for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      let y = a[i + 1];
      if (y < 0.05) y = 0.05 + (y - 0.05) * 0.25;
      pos[o] = a[i]; pos[o + 1] = y; pos[o + 2] = a[i + 2];
      const k = Math.min(1, Math.max(0, (y - 0.02) / 0.5));
      col[o] = 0.8 + 0.2 * k; col[o + 1] = 0.79 + 0.2 * k; col[o + 2] = 0.97 + 0.0 * k; // lilac bellies, warm white tops
      o += 3;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.translate(0, -0.12, 0);
  geo.scale(0.75, 0.75, 0.75);
  return geo;
}

// a gull: thin body + two swept wings (flap is done in the vertex shader by |x|)
function birdGeometry(THREE) {
  const v = [
    // left wing
    0, 0, 0.05, -0.22, 0.02, -0.04, 0, 0, -0.06,
    // right wing
    0, 0, 0.05, 0, 0, -0.06, 0.22, 0.02, -0.04,
    // body
    0, 0.01, 0.1, -0.015, 0, -0.09, 0.015, 0, -0.09,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  return g;
}
