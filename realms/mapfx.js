// =====================================================================
// Hex Realms: adventure-map polish effects (HoMM3 flavour).
//
//   const fx = createMapFx(THREE, scene, { DIRS, radiusOf, posOf });
//
//   fx.showPath(path, todaySteps)   path = [heroCell, ..., goalCell] (cell ids)
//                                   todaySteps = index of the last cell reached today
//                                   (main.js stepsToday). Arrows point along the
//                                   route: green today, red later, a gold day-end
//                                   ring where today's walk stops, a waving green
//                                   flag at a goal reached today, a red cross if not.
//   fx.clearPath()
//   fx.select(position|null, normal?, color?)   glowing animated ring under the hero
//   fx.burst(kind, position, opts?)  'coin' | 'pickup' | 'gem' | 'artifact' | 'flag' |
//                                   'dust' | 'step' | 'magic' | 'level' | 'battle'
//                                   opts: { color, normal, scale }
//   fx.update(dt, camera)           once per frame on the map
//
// Extras (optional hooks):
//   fx.flagMaterial(bodyMat)        derived body material whose pennants wave (vertex shader)
//   fx.setHalos([{ position, normal?, color?, size? }])  pulsing ground glows (artifacts, shrines)
//   fx.setFogEdge(seen, NBR)        soft drifting mist along the fog-of-war frontier
//   fx.dispose()
//
// Cost: path arrows 1 draw, goal markers 2-3, select ring 1, particles 1,
// shock rings <= 6, halos 1, mist 1. Everything is pooled; nothing allocates per frame.
// =====================================================================

export function createMapFx(THREE, scene, { DIRS, radiusOf, posOf }) {
  const root = new THREE.Group(); root.name = 'mapfx'; scene.add(root);
  const T = { value: 0 };                      // shared time uniform
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3(), _x = new THREE.Vector3();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), UPV = new THREE.Vector3(0, 1, 0);
  const col = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));

  // premultiplied blend: frag outputs (rgb*a, a*(1-add)) so one material does
  // both soft alpha and additive glow without washing out bright grass.
  const PREMUL = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, premultipliedAlpha: true };

  // orient an object lying on the surface: local +y = normal, local +z = fwd (projected)
  function basis(n, fwd, out) {
    _n.copy(n).normalize();
    _w.copy(fwd).addScaledVector(_n, -fwd.dot(_n));
    if (_w.lengthSq() < 1e-8) { _w.set(1, 0, 0).addScaledVector(_n, -_n.x); if (_w.lengthSq() < 1e-6) _w.set(0, 0, 1).addScaledVector(_n, -_n.z); }
    _w.normalize();
    _x.crossVectors(_n, _w);
    return out.makeBasis(_x, _n, _w);
  }
  const cellPos = (v, lift) => DIRS[v].clone().multiplyScalar(radiusOf(v) + lift);

  // ------------------------------------------------------------ ring shader (select ring, halos, shock waves, goal/day rings)
  const RING_VS = /* glsl */`
    varying vec2 vUv; varying vec4 vInst;
    #ifdef INST
    attribute vec4 aCol;
    #endif
    void main() {
      vUv = uv;
      #ifdef INST
        vInst = aCol;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      #else
        vInst = vec4(1.0, 1.0, 1.0, 0.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #endif
    }`;
  const RING_FS = /* glsl */`
    uniform float uTime, uR0, uW, uDash, uSpin, uFill, uAlpha, uPulse, uAdd, uCore;
    uniform vec3 uColor;
    varying vec2 vUv; varying vec4 vInst;
    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p) * 2.0, a = atan(p.y, p.x);
      float ph = vInst.w;
      float pulse = 1.0 + uPulse * sin(uTime * 3.2 + ph);
      vec3 c = uColor * vInst.rgb;
      // main ring: bright core + soft halo
      float d = (r - uR0) / uW;
      float ring = exp(-d * d * 2.2);
      float halo = exp(-d * d * 0.18) * 0.45;
      // rotating dashed outer ring
      float dash = 0.0;
      if (uDash > 0.5) {
        float s = sin(a * uDash + uTime * uSpin + ph);
        float dr = (r - min(uR0 + uW * 1.9, 0.94)) / (uW * 0.55);
        dash = smoothstep(0.15, 0.7, s) * exp(-dr * dr * 2.0) * 0.9;
      }
      float fill = uFill * smoothstep(uR0 + uW, 0.0, r) * (0.65 + 0.35 * sin(uTime * 2.0 + r * 9.0 - ph));
      float edge = smoothstep(1.0, 0.9, r);
      float al = clamp((ring + halo + dash + fill) * pulse, 0.0, 1.0) * edge * uAlpha;
      vec3 rgb = mix(c, vec3(1.0), clamp(ring * uCore, 0.0, 1.0)) * (1.0 + ring * 0.6);
      gl_FragColor = vec4(rgb * al, al * (1.0 - uAdd));
      #include <colorspace_fragment>
    }`;
  function ringMat(o = {}, inst = false) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: T, uR0: { value: o.r0 ?? 0.62 }, uW: { value: o.w ?? 0.07 }, uDash: { value: o.dash ?? 0 }, uSpin: { value: o.spin ?? 1.2 },
        uFill: { value: o.fill ?? 0.15 }, uAlpha: { value: o.alpha ?? 1 }, uPulse: { value: o.pulse ?? 0.12 }, uAdd: { value: o.add ?? 0.5 },
        uCore: { value: o.core ?? 0.55 }, uColor: { value: col(o.color ?? 0xffffff) },
      },
      defines: inst ? { INST: '' } : {},
      vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, ...PREMUL,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
  }
  const quadGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);   // lies in XZ, faces +Y

  // ------------------------------------------------------------ path arrows ("footprints")
  // a flat chevron arrow pointing +Z, with a deeper-tone outline for contrast on grass
  function arrowGeo() {
    const shape = (s) => {
      const sh = new THREE.Shape();
      // tail notch, shaft, head — HoMM3-ish fat arrow, ~0.2 long
      const P = [[0, -0.1], [0.045, -0.085], [0.045, 0.0], [0.085, 0.0], [0, 0.1], [-0.085, 0.0], [-0.045, 0.0], [-0.045, -0.085]];
      P.forEach(([x, y], i) => (i ? sh.lineTo(x * s, y * s) : sh.moveTo(x * s, y * s)));
      return sh;
    };
    const parts = [[shape(1.32), 0.0, 0], [shape(1.0), 0.002, 1]];
    const pos = [], tone = [], uv = [];
    for (const [sh, y, t] of parts) {
      const g = new THREE.ShapeGeometry(sh).toNonIndexed();
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        // shape is in XY (y forward) -> lay into XZ, z forward, y up; flip winding
        pos.push(p.getX(i), y, p.getY(i));
        tone.push(t);
        uv.push(p.getX(i) / 0.11, p.getY(i) / 0.13);
      }
      g.dispose();
    }
    // fix winding to face +Y
    for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) { const a = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = a; }
    for (let i = 0; i < tone.length; i += 3) { const a = tone[i + 1]; tone[i + 1] = tone[i + 2]; tone[i + 2] = a; }
    for (let i = 0; i < uv.length; i += 6) for (let k = 0; k < 2; k++) { const a = uv[i + 2 + k]; uv[i + 2 + k] = uv[i + 4 + k]; uv[i + 4 + k] = a; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(tone, 1));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }
  const MAXA = 256;
  const aGeo = arrowGeo();
  const aCol = new THREE.InstancedBufferAttribute(new Float32Array(MAXA * 4), 4);   // rgb + index along path
  aGeo.setAttribute('aCol', aCol);
  const arrowMat = new THREE.ShaderMaterial({
    uniforms: { uTime: T, uStart: { value: -10 } },
    vertexShader: /* glsl */`
      attribute float aTone; attribute vec4 aCol;
      uniform float uTime, uStart;
      varying float vTone, vGlow, vA; varying vec3 vCol; varying vec2 vUv;
      void main() {
        float idx = aCol.w;
        // pop in one after another when a route is drawn
        float k = clamp((uTime - uStart) * 14.0 - idx * 0.6, 0.0, 1.0);
        float pop = k * (1.0 + 0.35 * sin(k * 3.14159));
        // a light travelling along the route, toward the goal
        float m = fract(idx * 0.11 - uTime * 0.55);
        vGlow = pow(1.0 - m, 6.0);
        vec3 p = position * pop;
        p.y += vGlow * 0.006;
        vTone = aTone; vCol = aCol.rgb; vA = k; vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vTone, vGlow, vA; varying vec3 vCol; varying vec2 vUv;
      void main() {
        vec3 rim = vCol * vec3(0.42, 0.48, 0.52) + vec3(0.04, 0.05, 0.08);    // deep, saturated, never black
        float sheen = 1.0 + 0.25 * (1.0 - abs(vUv.x));
        vec3 fill = vCol * sheen * (1.05 + vGlow * 0.9) + vec3(vGlow * 0.25);
        vec3 c = mix(rim, fill, vTone);
        gl_FragColor = vec4(c * vA, vA);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, ...PREMUL,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const arrows = new THREE.InstancedMesh(aGeo, arrowMat, MAXA);
  arrows.count = 0; arrows.frustumCulled = false; arrows.renderOrder = 2; root.add(arrows);

  // goal: waving green flag (reachable today) or red cross (later)
  function buildGeo(parts) {   // parts: [geometry, color(hex), shade fn?]
    const pos = [], cols = [], wav = [];
    for (const [g0, c, opt = {}] of parts) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      const p = g.attributes.position, cc = new THREE.Color(c);
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        const y = p.getY(i), sh = opt.grad ? 0.78 + 0.32 * THREE.MathUtils.clamp((y - opt.grad[0]) / (opt.grad[1] - opt.grad[0]), 0, 1) : 1;
        cols.push(cc.r * sh, cc.g * sh, cc.b * sh);
        wav.push(opt.wave ? Math.max(0, p.getX(i)) : 0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setAttribute('aWave', new THREE.Float32BufferAttribute(wav, 1));
    g.computeVertexNormals();
    return g;
  }
  const flagGeo = buildGeo([
    [new THREE.CylinderGeometry(0.008, 0.011, 0.26, 6).translate(0, 0.13, 0), 0xf3e6c4, { grad: [0, 0.26] }],
    [new THREE.SphereGeometry(0.016, 8, 6).translate(0, 0.265, 0), 0xffd24a],
    [new THREE.PlaneGeometry(0.15, 0.085, 8, 2).translate(0.075, 0.205, 0), 0x3cff5a, { wave: true, grad: [0.16, 0.25] }],
    [new THREE.CylinderGeometry(0.035, 0.045, 0.014, 10).translate(0, 0.007, 0), 0xd6c8a6, { grad: [0, 0.014] }],
  ]);
  const crossGeo = buildGeo([
    [new THREE.BoxGeometry(0.2, 0.035, 0.05).rotateY(Math.PI / 4).translate(0, 0.02, 0), 0xff4a3a, { grad: [0, 0.04] }],
    [new THREE.BoxGeometry(0.2, 0.035, 0.05).rotateY(-Math.PI / 4).translate(0, 0.021, 0), 0xff5a46, { grad: [0, 0.04] }],
  ]);
  function waveBasic(extra = {}) {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false, ...extra });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = T;
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'attribute float aWave; uniform float uTime; varying float vShade;\nvoid main() {')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float wv = sin(uTime * 7.0 - aWave * 55.0);
          transformed.z += wv * aWave * 0.35;
          transformed.y -= aWave * aWave * 0.6;
          vShade = 1.0 + 0.22 * cos(uTime * 7.0 - aWave * 55.0) * step(0.001, aWave);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'varying float vShade;\nvoid main() {')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vShade;');
    };
    m.customProgramCacheKey = () => 'mapfxWave';
    return m;
  }
  const markMat = waveBasic();
  const goalFlag = new THREE.Mesh(flagGeo, markMat); goalFlag.visible = false; goalFlag.renderOrder = 3; root.add(goalFlag);
  const goalCross = new THREE.Mesh(crossGeo, markMat); goalCross.visible = false; goalCross.renderOrder = 3; root.add(goalCross);
  const goalRing = new THREE.Mesh(quadGeo, ringMat({ r0: 0.6, w: 0.09, dash: 8, spin: -2.0, fill: 0.2, pulse: 0.2, add: 0.55 }));
  goalRing.visible = false; goalRing.renderOrder = 2; root.add(goalRing);
  const dayRing = new THREE.Mesh(quadGeo, ringMat({ color: 0xffd040, r0: 0.55, w: 0.1, dash: 6, spin: 1.6, fill: 0.28, pulse: 0.25, add: 0.5 }));
  dayRing.visible = false; dayRing.renderOrder = 2; root.add(dayRing);

  const GREEN = new THREE.Color(0x52f05a), RED = new THREE.Color(0xff4a3c), GOLD = new THREE.Color(0xffd040);
  let goalBob = null;
  function showPath(path, todaySteps = 0) {
    if (!path || path.length < 2) { clearPath(); return; }
    const last = path.length - 1, today = Math.max(0, Math.min(todaySteps | 0, last));
    let n = 0;
    for (let i = 1; i < last && n < MAXA; i++) {
      const v = path[i];
      _v.copy(posOf(path[i + 1])).sub(posOf(path[i - 1]));  // smooth heading through the cell
      basis(DIRS[v], _v, _m);
      _m.setPosition(cellPos(v, 0.014));
      arrows.setMatrixAt(n, _m);
      const c = i === today && today < last ? GOLD : i <= today ? GREEN : RED;
      aCol.setXYZW(n, c.r, c.g, c.b, i);
      n++;
    }
    arrows.count = n; arrows.instanceMatrix.needsUpdate = true; aCol.needsUpdate = true;
    arrowMat.uniforms.uStart.value = T.value;

    const g = path[last], reach = today >= last;
    _v.copy(posOf(g)).sub(posOf(path[last - 1]));
    const flag = reach ? goalFlag : goalCross;
    (reach ? goalCross : goalFlag).visible = false;
    basis(DIRS[g], _v, _m); _m.setPosition(cellPos(g, 0.006));
    _m.decompose(flag.position, flag.quaternion, flag.scale);
    if (reach) flag.rotateY(-0.9);   // pennant reads side-on
    flag.visible = true;
    goalBob = { obj: flag, base: flag.position.clone(), n: DIRS[g].clone(), t0: T.value };
    placeFlat(goalRing, cellPos(g, 0.01), DIRS[g], 0.34);
    goalRing.material.uniforms.uColor.value.copy(reach ? GREEN : RED);
    goalRing.visible = true;
    if (today > 0 && today < last) { placeFlat(dayRing, cellPos(path[today], 0.012), DIRS[path[today]], 0.3); dayRing.visible = true; }
    else dayRing.visible = false;
  }
  function clearPath() {
    arrows.count = 0; goalFlag.visible = goalCross.visible = goalRing.visible = dayRing.visible = false; goalBob = null;
  }
  function placeFlat(obj, p, n, s) {
    obj.position.copy(p);
    obj.quaternion.setFromUnitVectors(UPV, _n.copy(n).normalize());
    obj.scale.setScalar(s);
  }

  // ------------------------------------------------------------ selection ring
  const selMat = ringMat({ color: 0xffd65a, r0: 0.56, w: 0.075, dash: 10, spin: 1.4, fill: 0.22, pulse: 0.16, add: 0.6, core: 0.6 });
  const selRing = new THREE.Mesh(quadGeo, selMat); selRing.visible = false; selRing.renderOrder = 2; root.add(selRing);
  const selGlint = new THREE.Mesh(quadGeo, ringMat({ color: 0xfff2b0, r0: 0.86, w: 0.035, dash: 3, spin: -2.6, fill: 0, pulse: 0.3, add: 0.8, alpha: 0.85 }));
  selRing.add(selGlint);
  function select(position, normal, color) {
    if (!position) { selRing.visible = false; return; }
    if (color !== undefined) selMat.uniforms.uColor.value.set(color);
    placeFlat(selRing, position, normal || _v.copy(position), 0.42);
    selRing.position.addScaledVector(_n, 0.012);
    selRing.visible = true;
  }

  // ------------------------------------------------------------ particle atlas (puff, star, coin, confetti) 256x64
  function atlas() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    // 0 soft puff
    let rg = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.45, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    // 1 four-point sparkle with glow
    g.save(); g.translate(96, 32);
    rg = g.createRadialGradient(0, 0, 0, 0, 0, 22); rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(-32, -32, 64, 64);
    g.fillStyle = '#fff';
    for (const [sx, sy] of [[30, 3.2], [3.2, 30], [14, 2], [2, 14]]) {
      g.beginPath(); g.moveTo(-sx, 0); g.quadraticCurveTo(0, 0, 0, -sy); g.quadraticCurveTo(0, 0, sx, 0); g.quadraticCurveTo(0, 0, 0, sy); g.quadraticCurveTo(0, 0, -sx, 0); g.fill();
      g.rotate(Math.PI / 4);
    }
    g.restore();
    // 2 gold coin (painted, used with white tint)
    g.save(); g.translate(160, 32);
    g.fillStyle = '#b8761c'; g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
    rg = g.createRadialGradient(-8, -9, 2, 0, 0, 24); rg.addColorStop(0, '#fff6c0'); rg.addColorStop(0.35, '#ffd848'); rg.addColorStop(1, '#e09a20');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(190,120,30,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,230,0.95)'; g.beginPath(); g.ellipse(-8, -10, 7, 3.5, -0.6, 0, Math.PI * 2); g.fill();
    g.restore();
    // 3 confetti / leaf diamond
    g.save(); g.translate(224, 32);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -26); g.lineTo(14, 0); g.lineTo(0, 26); g.lineTo(-14, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-2, -18, 4, 36);
    g.restore();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  const atlasTex = atlas();

  // billboard quad material shared by particles and mist
  const BB_VS = /* glsl */`
    attribute vec3 iPos; attribute vec4 iCol; attribute vec4 iSz;
    uniform float uTime;
    varying vec2 vUv; varying vec4 vCol; varying float vAdd;
    void main() {
      vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
      float size = iSz.x, rot = iSz.y, cell = floor(iSz.w), add = fract(iSz.w) * 2.0;
      #ifdef MIST
        float ph = iSz.y;
        rot = ph + uTime * 0.08 * (fract(ph) - 0.5);
        size *= 1.0 + 0.12 * sin(uTime * 0.7 + ph * 3.0);
        mv.xy += vec2(sin(uTime * 0.35 + ph), cos(uTime * 0.29 + ph * 1.7)) * 0.05;
      #endif
      vec2 q = position.xy * vec2(iSz.z, 1.0);
      float c = cos(rot), s = sin(rot);
      mv.xy += mat2(c, s, -s, c) * q * size;
      vUv = vec2((position.x + 0.5 + cell) * 0.25, position.y + 0.5);
      vCol = iCol; vAdd = add;
      #ifdef MIST
        vCol.a *= 0.75 + 0.25 * sin(uTime * 0.9 + ph * 5.0);
      #endif
      gl_Position = projectionMatrix * mv;
    }`;
  const BB_FS = /* glsl */`
    uniform sampler2D uMap;
    varying vec2 vUv; varying vec4 vCol; varying float vAdd;
    void main() {
      vec4 t = texture2D(uMap, vUv);
      float a = t.a * vCol.a;
      if (a < 0.003) discard;
      gl_FragColor = vec4(t.rgb * vCol.rgb * a, a * (1.0 - vAdd));
      #include <colorspace_fragment>
    }`;
  function bbMesh(max, defines = {}) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const iPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const iCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const iSz = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', iPos); g.setAttribute('iCol', iCol); g.setAttribute('iSz', iSz);
    g.instanceCount = 0;
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uMap: { value: atlasTex }, uTime: T }, defines, vertexShader: BB_VS, fragmentShader: BB_FS,
      transparent: true, depthWrite: false, ...PREMUL,
    }));
    m.frustumCulled = false;
    return { mesh: m, g, iPos, iCol, iSz };
  }

  // ------------------------------------------------------------ particles (CPU sim, one draw)
  const MAXP = 600;
  const PB = bbMesh(MAXP); PB.mesh.renderOrder = 5; root.add(PB.mesh);
  // per particle: pos3 vel3 nrm3 life max size grow r g b a0 cell add grav drag spin rot squashSpin
  const STR = 23, P = new Float32Array(MAXP * STR); let np = 0;
  function emit(p, vel, n, life, size, grow, c, a0, cell, add, grav, drag, spin, flip) {
    if (np >= MAXP) return;
    const o = np++ * STR;
    P[o] = p.x; P[o + 1] = p.y; P[o + 2] = p.z;
    P[o + 3] = vel.x; P[o + 4] = vel.y; P[o + 5] = vel.z;
    P[o + 6] = n.x; P[o + 7] = n.y; P[o + 8] = n.z;
    P[o + 9] = 0; P[o + 10] = life; P[o + 11] = size; P[o + 12] = grow;
    P[o + 13] = c.r; P[o + 14] = c.g; P[o + 15] = c.b; P[o + 16] = a0;
    P[o + 17] = cell + add * 0.5; P[o + 18] = grav; P[o + 19] = drag; P[o + 20] = spin; P[o + 21] = flip; P[o + 22] = rnd() * 6.283;
  }
  // shock rings pool
  const SHOCK = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(quadGeo, ringMat({ r0: 0.7, w: 0.08, fill: 0.0, pulse: 0, add: 0.6 }));
    m.visible = false; m.renderOrder = 4; root.add(m); SHOCK.push({ m, t: 0, life: 1, s0: 0.1, s1: 1 });
  }
  function shock(p, n, color, s0, s1, life, w = 0.08, add = 0.6) {
    const s = SHOCK.find((x) => !x.m.visible) || SHOCK.reduce((a, b) => (a.t / a.life > b.t / b.life ? a : b));
    s.t = 0; s.life = life; s.s0 = s0; s.s1 = s1;
    placeFlat(s.m, _v.copy(p).addScaledVector(_n.copy(n).normalize(), 0.015), n, s0);
    const u = s.m.material.uniforms; u.uColor.value.copy(color); u.uW.value = w; u.uAdd.value = add;
    s.m.visible = true;
  }

  const rnd = Math.random;
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), V = new THREE.Vector3(), C = new THREE.Color();
  function tangents(n) {
    tA.set(0, 1, 0); if (Math.abs(n.y) > 0.9) tA.set(1, 0, 0);
    tA.crossVectors(n, tA).normalize(); tB.crossVectors(n, tA);
  }
  // random direction: horizontal spread h, upward u (in units/s)
  function dirv(n, h, u0, u1) {
    const a = rnd() * Math.PI * 2, r = h * (0.35 + 0.65 * rnd());
    return V.copy(tA).multiplyScalar(Math.cos(a) * r).addScaledVector(tB, Math.sin(a) * r).addScaledVector(n, u0 + (u1 - u0) * rnd());
  }
  const PAL = {
    gold: [0xffe070, 0xffc030, 0xfff4b8],
    pickup: [0xffffff, 0xa8f0ff, 0xffe680],
    gem: [0xff5a8a, 0x5ae0ff, 0x8aff7a, 0xffe050, 0xc080ff],
    magic: [0x7ab8ff, 0xc08aff, 0xe0f4ff],
    dust: [0xe6d2a8, 0xd8c098, 0xf0e2c0],
  };
  const pick = (a) => C.set(a[(rnd() * a.length) | 0]);

  function burst(kind, position, opts = {}) {
    if (!position) return;
    const p = position.clone ? position : new THREE.Vector3(...position);
    const n = (opts.normal ? _n.copy(opts.normal) : _n.copy(p)).normalize().clone();
    const S = opts.scale ?? 1;
    tangents(n);
    const at = (lift) => _w.copy(p).addScaledVector(n, lift * S);
    switch (kind) {
      case 'coin': case 'gold': {
        for (let i = 0; i < 12; i++) emit(at(0.06), dirv(n, 0.55 * S, 1.0 * S, 1.7 * S), n, 0.9 + rnd() * 0.35, 0.075 * S, 0, C.setRGB(1.15, 1.1, 1.0), 1, 2, 0.05, 3.2 * S, 0.4, (rnd() - 0.5) * 4, 10 + rnd() * 8);
        for (let i = 0; i < 18; i++) emit(at(0.08 + rnd() * 0.12), dirv(n, 0.6 * S, 0.2 * S, 0.9 * S), n, 0.5 + rnd() * 0.5, 0.06 * S, -0.03, pick(PAL.gold).multiplyScalar(1.8), 1, 1, 0.9, 0.4, 2.0, (rnd() - 0.5) * 6, 0);
        shock(p, n, C.set(0xffd040), 0.05 * S, 0.5 * S, 0.5, 0.07);
        break;
      }
      case 'gem': case 'pickup': case 'artifact': {
        const pal = kind === 'gem' ? PAL.gem : kind === 'artifact' ? PAL.gold : PAL.pickup;
        const cnt = kind === 'artifact' ? 36 : 24;
        for (let i = 0; i < cnt; i++) emit(at(0.05 + rnd() * 0.1), dirv(n, 0.7 * S, 0.3 * S, 1.3 * S), n, 0.6 + rnd() * 0.6, (0.05 + rnd() * 0.05) * S, -0.04, pick(pal).multiplyScalar(2.0), 1, 1, 0.9, 0.6, 2.2, (rnd() - 0.5) * 5, 0);
        if (kind === 'artifact') for (let i = 0; i < 3; i++) emit(at(0.12), V.copy(n).multiplyScalar(0.05), n, 0.7 + i * 0.15, 0.22 * S * (1 + i * 0.4), 0.2, C.set(0xfff0b0).multiplyScalar(1.6), 0.8, 1, 1, 0, 0, 0.6 * (i - 1), 0);
        shock(p, n, C.set(pal[0]), 0.05 * S, 0.55 * S, 0.55, 0.06);
        break;
      }
      case 'flag': case 'capture': {
        const c0 = col(opts.color ?? 0xff4040);
        shock(p, n, c0, 0.08 * S, 1.0 * S, 0.8, 0.09, 0.4);
        shock(p, n, C.set(0xffe070), 0.04 * S, 0.7 * S, 0.6, 0.05, 0.7);
        for (let i = 0; i < 28; i++) {
          const c = i % 3 === 2 ? C.set(0xffe070) : C.copy(c0).multiplyScalar(1.15);
          emit(at(0.1), dirv(n, 0.7 * S, 1.0 * S, 1.9 * S), n, 1.0 + rnd() * 0.5, (0.04 + rnd() * 0.025) * S, 0, c, 1, 3, 0.15, 1.9 * S, 1.6, (rnd() - 0.5) * 10, 8 + rnd() * 10);
        }
        for (let i = 0; i < 12; i++) emit(at(0.15 + rnd() * 0.2), dirv(n, 0.3 * S, 0.3 * S, 0.8 * S), n, 0.6 + rnd() * 0.4, 0.07 * S, -0.04, C.set(0xfff4c0).multiplyScalar(2), 1, 1, 1, 0.2, 1.5, (rnd() - 0.5) * 4, 0);
        break;
      }
      case 'dust': case 'step': {
        const big = kind === 'dust', cnt = big ? 12 : 5;
        for (let i = 0; i < cnt; i++) {
          const a = (i / cnt) * Math.PI * 2 + rnd() * 0.4, sp = (big ? 0.45 : 0.22) * S * (0.7 + rnd() * 0.5);
          V.copy(tA).multiplyScalar(Math.cos(a) * sp).addScaledVector(tB, Math.sin(a) * sp).addScaledVector(n, (0.08 + rnd() * 0.12) * S);
          emit(at(0.025), V, n, (big ? 0.75 : 0.5) + rnd() * 0.3, (big ? 0.09 : 0.06) * S, (big ? 0.22 : 0.12) * S, pick(PAL.dust), big ? 0.7 : 0.5, 0, 0, 0, 3.0, (rnd() - 0.5) * 1.5, 0);
        }
        if (big) shock(p, n, C.set(0xf0dcb0), 0.06 * S, 0.45 * S, 0.45, 0.1, 0.1);
        break;
      }
      case 'magic': case 'level': {
        const pal = kind === 'level' ? PAL.gold : PAL.magic;
        for (let i = 0; i < 30; i++) {
          const a = rnd() * Math.PI * 2, r = (0.08 + rnd() * 0.12) * S;
          const sp = V.copy(tA).multiplyScalar(Math.cos(a) * r).addScaledVector(tB, Math.sin(a) * r);
          const pos = _x.copy(at(0.03 + rnd() * 0.1)).add(sp);
          emit(pos, sp.multiplyScalar(0.6).addScaledVector(n, (0.5 + rnd() * 0.7) * S), n, 0.8 + rnd() * 0.6, (0.045 + rnd() * 0.04) * S, -0.02, pick(pal).multiplyScalar(2.0), 1, 1, 0.9, -0.15, 0.8, (rnd() - 0.5) * 5, 0);
        }
        shock(p, n, C.set(pal[0]), 0.05 * S, 0.6 * S, 0.7, 0.07);
        break;
      }
      case 'battle': {
        shock(p, n, C.set(0xffa040), 0.05 * S, 0.7 * S, 0.5, 0.08);
        for (let i = 0; i < 20; i++) emit(at(0.08), dirv(n, 0.9 * S, 0.3 * S, 1.0 * S), n, 0.4 + rnd() * 0.3, 0.05 * S, -0.04, C.set(i % 2 ? 0xffe0a0 : 0xffffff).multiplyScalar(2), 1, 1, 1, 0.8, 3, (rnd() - 0.5) * 6, 0);
        break;
      }
      default: return burst('pickup', p, opts);
    }
  }

  function updateParticles(dt) {
    let w = 0;
    const ip = PB.iPos.array, ic = PB.iCol.array, is = PB.iSz.array;
    for (let i = 0; i < np; i++) {
      const o = i * STR;
      const t = (P[o + 9] += dt), life = P[o + 10];
      if (t >= life) continue;
      // integrate: gravity toward the planet along the burst normal, drag
      const g = P[o + 18], dr = Math.max(0, 1 - P[o + 19] * dt);
      P[o + 3] = (P[o + 3] - P[o + 6] * g * dt) * dr; P[o + 4] = (P[o + 4] - P[o + 7] * g * dt) * dr; P[o + 5] = (P[o + 5] - P[o + 8] * g * dt) * dr;
      P[o] += P[o + 3] * dt; P[o + 1] += P[o + 4] * dt; P[o + 2] += P[o + 5] * dt;
      if (w !== i) P.copyWithin(w * STR, o, o + STR);
      const q = w * STR, k = t / life;
      ip[w * 3] = P[q]; ip[w * 3 + 1] = P[q + 1]; ip[w * 3 + 2] = P[q + 2];
      // fade in fast, out smoothly; sparkles twinkle
      const cell = Math.floor(P[q + 17]);
      let a = P[q + 16] * Math.min(1, t * 18) * (1 - k * k);
      if (cell === 1) a *= 0.75 + 0.25 * Math.sin(t * 40 + i);
      ic[w * 4] = P[q + 13]; ic[w * 4 + 1] = P[q + 14]; ic[w * 4 + 2] = P[q + 15]; ic[w * 4 + 3] = a;
      const flip = P[q + 21];
      is[w * 4] = Math.max(0.001, P[q + 11] + P[q + 12] * t);
      is[w * 4 + 1] = P[q + 20] * t + P[q + 22];
      is[w * 4 + 2] = flip ? Math.max(0.15, Math.abs(Math.cos(t * flip))) : 1;
      is[w * 4 + 3] = P[q + 17];
      w++;
    }
    np = w;
    PB.g.instanceCount = np;
    if (np) PB.iPos.needsUpdate = PB.iCol.needsUpdate = PB.iSz.needsUpdate = true;
    for (const s of SHOCK) {
      if (!s.m.visible) continue;
      s.t += dt; const k = s.t / s.life;
      if (k >= 1) { s.m.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3);
      s.m.scale.setScalar(s.s0 + (s.s1 - s.s0) * e);
      s.m.material.uniforms.uAlpha.value = (1 - k) * (1 - k) * Math.min(1, k * 12);
    }
  }

  // ------------------------------------------------------------ ground halos (artifacts, shrines, wells...)
  const MAXH = 96;
  const hGeo = quadGeo.clone();
  const hCol = new THREE.InstancedBufferAttribute(new Float32Array(MAXH * 4), 4); hGeo.setAttribute('aCol', hCol);
  const halos = new THREE.InstancedMesh(hGeo, ringMat({ r0: 0.5, w: 0.12, dash: 0, fill: 0.55, pulse: 0.35, add: 0.75, core: 0.3, alpha: 0.85 }, true), MAXH);
  halos.count = 0; halos.frustumCulled = false; halos.renderOrder = 1; root.add(halos);
  function setHalos(list = []) {
    let n = 0;
    for (const h of list) {
      if (n >= MAXH) break;
      const p = h.position, nn = _v.copy(h.normal || p).normalize();
      _q.setFromUnitVectors(UPV, nn);
      _m.compose(_w.copy(p).addScaledVector(nn, 0.01), _q, _x.setScalar(h.size ?? 0.42));
      halos.setMatrixAt(n, _m);
      C.set(h.color ?? 0xffd860);
      hCol.setXYZW(n, C.r, C.g, C.b, n * 1.7);
      n++;
    }
    halos.count = n; halos.instanceMatrix.needsUpdate = true; hCol.needsUpdate = true;
  }

  // ------------------------------------------------------------ fog-of-war edge mist
  const MAXM = 1600;
  const MB = bbMesh(MAXM, { MIST: '' }); MB.mesh.renderOrder = 1; root.add(MB.mesh);
  const MIST_COL = new THREE.Color(0xd8d4f0);
  function setFogEdge(seen, NBR) {
    let n = 0;
    if (seen && NBR) {
      for (let v = 0; v < DIRS.length && n < MAXM; v++) {
        if (seen[v]) continue;
        let edge = 0;
        for (const u of NBR[v]) if (seen[u]) { edge++; }
        if (!edge) continue;
        // one puff on the frontier cell, nudged a touch toward the seen side, lifted
        _v.copy(DIRS[v]);
        for (const u of NBR[v]) if (seen[u]) _v.addScaledVector(DIRS[u], 0.12 / edge);
        _v.normalize();
        const r = radiusOf(v) + 0.07, h = (v * 2654435761) >>> 0;
        MB.iPos.setXYZ(n, _v.x * r, _v.y * r, _v.z * r);
        const a = 0.42 + (edge > 2 ? 0.12 : 0);
        MB.iCol.setXYZW(n, MIST_COL.r, MIST_COL.g, MIST_COL.b, a);
        MB.iSz.setXYZW(n, 0.48 + (h % 100) / 100 * 0.22, (h % 6283) / 1000, 1.0 + ((h >> 8) % 40) / 100, 0);
        n++;
      }
    }
    MB.g.instanceCount = n;
    MB.iPos.needsUpdate = MB.iCol.needsUpdate = MB.iSz.needsUpdate = true;
  }

  // ------------------------------------------------------------ banner wave for the game's own flags
  const waveCache = new WeakMap();
  function flagMaterial(base) {
    if (waveCache.has(base)) return waveCache.get(base);
    // Material.copy JSON-clones userData (which holds textures): keep it out of the clone
    const ud = base.userData; base.userData = {};
    const m = base.clone();
    base.userData = ud; m.userData = ud;
    const prev = base.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(base, sh, r);
      sh.uniforms.uWaveT = T;
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'uniform float uWaveT;\nvoid main() {')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // pennant cloth: flagModel puts the pole at x=0 and the cloth at x>0, y in ~0.6..1.0
          float wf = smoothstep(0.02, 0.6, position.x) * smoothstep(0.55, 0.68, position.y);
          vec3 wp = vec3(modelMatrix[3]);
          float ph = dot(wp, vec3(3.1, 2.3, 1.7));
          transformed.z += sin(uWaveT * 4.2 - position.x * 9.0 + ph) * 0.07 * wf;
          transformed.y += sin(uWaveT * 3.1 - position.x * 7.0 + ph) * 0.025 * wf;
        }`);
    };
    const key = base.customProgramCacheKey ? base.customProgramCacheKey() : 'std';
    m.customProgramCacheKey = () => key + '+mapfxWave';
    waveCache.set(base, m);
    return m;
  }

  // ------------------------------------------------------------ frame
  function update(dt, camera) {
    T.value += dt;
    updateParticles(dt);
    if (goalBob) {
      const k = T.value - goalBob.t0;
      const drop = Math.max(0, 1 - k * 4); // drops in, then bobs gently
      goalBob.obj.position.copy(goalBob.base).addScaledVector(goalBob.n, drop * drop * 0.25 + (goalBob.obj === goalCross ? Math.abs(Math.sin(T.value * 3)) * 0.015 : 0));
    }
    if (camera && MB.g.instanceCount) {
      // thin the mist when zoomed far out so the planet silhouette stays crisp
      const d = camera.position.length();
      MB.mesh.material.uniforms.uTime.value = T.value;
      MB.mesh.visible = d < 30;
    }
  }

  function dispose() {
    scene.remove(root);
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    atlasTex.dispose();
  }

  return { showPath, clearPath, select, burst, update, flagMaterial, setHalos, setFogEdge, dispose, root };
}
