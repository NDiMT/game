// Procedural toy models: sculpted cars with sprung, steering wheels; the football; the big goalie.
import * as THREE from 'three';
import { R } from './physics.js?v=2.2';
import { mergeByMaterial } from './util.js?v=2.2';

// ---------------------------------------------------------------- cars
// Body = a finely segmented box sculpted vertex by vertex: side profile (hood / deck heights), plan-view
// rounding, tumblehome, rounded nose and tail, and wheel arches cut into the sills. The greenhouse is a
// second sculpted box (tinted glass) with a painted roof cap.
const SHAPES = {
  // t: -1 rear .. +1 front; top = shoulder height along t; cab = [rear t, front t, roof y, rear slope, front slope]
  hatch: { bot: 0.2, top: [[-1, 0.6], [-0.85, 0.7], [0.25, 0.7], [0.55, 0.64], [1, 0.5]], cab: [-0.86, 0.3, 1.1, 0.12, 0.38], tum: 0.82, nose: 0.5, spoiler: 'duck' },
  wedge: { bot: 0.18, top: [[-1, 0.6], [-0.7, 0.64], [0.1, 0.56], [1, 0.34]], cab: [-0.62, 0.12, 0.93, 0.28, 0.4], tum: 0.76, nose: 0.7, spoiler: 'wing' },
  van: { bot: 0.22, top: [[-1, 0.8], [0.6, 0.8], [0.85, 0.72], [1, 0.58]], cab: [-0.97, 0.6, 1.36, 0.04, 0.22], tum: 0.92, nose: 0.4, spoiler: 'none' },
  racer: { bot: 0.16, top: [[-1, 0.52], [-0.6, 0.55], [0.2, 0.42], [1, 0.28]], cab: [-0.55, 0.0, 0.82, 0.25, 0.33], tum: 0.66, nose: 0.75, spoiler: 'wing' },
  monster: { bot: 0.55, top: [[-1, 0.95], [0.4, 0.98], [0.75, 0.9], [1, 0.8]], cab: [-0.62, 0.38, 1.45, 0.1, 0.3], tum: 0.84, nose: 0.45, spoiler: 'bar' },
};
function lerpTable(tab, t) {
  if (t <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (t <= tab[i][0]) { const a = tab[i - 1], b = tab[i], k = (t - a[0]) / (b[0] - a[0]); const s = k * k * (3 - 2 * k); return a[1] + (b[1] - a[1]) * s; }
  return tab[tab.length - 1][1];
}
function sculptBody(spec, L, W, arches, archR) {
  const g = new THREE.BoxGeometry(1, 1, 1, 12, 7, 30);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) + 0.5, t = p.getZ(i) * 2; // u,t in [-1,1], v in [0,1]
    const top = lerpTable(spec.top, t), bot = spec.bot;
    let y = bot + v * (top - bot);
    // plan view: rounded corners at the nose and tail
    const e = Math.max(0, Math.abs(t) - 0.72) / 0.28;
    let hw = W / 2 * Math.sqrt(Math.max(0, 1 - e * e * 0.55));
    // cross-section: tuck the sill under and roll the shoulder in
    const sh = Math.max(0, (v - 0.55) / 0.45), sl = Math.max(0, (0.25 - v) / 0.25);
    hw *= 1 - 0.13 * sh * sh - 0.08 * sl * sl;
    let x = u * hw;
    // nose / tail: round the top edge back in profile
    let z = t * L / 2;
    const end = Math.abs(t) > 0.999 ? 1 : 0;
    if (end) z -= Math.sign(t) * (v * v) * (t > 0 ? spec.nose : 0.25) * 0.35;
    z -= Math.sign(t) * Math.pow(Math.max(0, Math.abs(u) - 0.6) / 0.4, 2) * 0.06 * (Math.abs(t) > 0.9 ? 1 : 0);
    // wheel arches cut into the lower body
    for (const az of arches) {
      const dz = z - az, ry = archR * archR - dz * dz;
      if (ry > 0) { const yA = archR * 0.92 + Math.sqrt(ry) * 0.62 + 0.02; if (y < yA && Math.abs(u) > 0.5) y = Math.max(y, Math.min(yA, top - 0.05)); }
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
function sculptCab(spec, L, W) {
  const [tr, tf, roof, sr, sf] = spec.cab;
  const g = new THREE.BoxGeometry(1, 1, 1, 6, 4, 10);
  const p = g.attributes.position;
  const z0 = tr * L / 2, z1 = tf * L / 2;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) + 0.5, k = p.getZ(i) + 0.5; // k 0 rear .. 1 front
    const base = Math.max(lerpTable(spec.top, tr), lerpTable(spec.top, tf)) - 0.06;
    const y = base + v * (roof - base);
    // windscreen and rear glass lean in towards the roof
    const zr = z0 + v * sr * L / 2, zf = z1 - v * sf * L / 2;
    let z = zr + k * (zf - zr);
    const hw = W / 2 * (spec.tum + (1 - spec.tum) * (1 - v)) * (0.98 - 0.06 * Math.pow(Math.abs(k - 0.5) * 2, 4) * v);
    // round the roof edges
    const ru = Math.abs(u), rv = v;
    let yy = y; if (rv > 0.99) yy -= Math.pow(Math.max(0, ru - 0.55) / 0.45, 2) * 0.06;
    p.setXYZ(i, u * hw, yy, z);
  }
  g.computeVertexNormals();
  return g;
}
function tyreGeometry(r, w) {
  const pts = [], n = 10, rr = Math.min(0.09, w * 0.3);
  pts.push(new THREE.Vector2(r * 0.6, -w / 2));
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI / 2; pts.push(new THREE.Vector2(r - rr + Math.cos(a) * rr, -w / 2 + rr + Math.sin(a) * rr)); }
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push(new THREE.Vector2(r - rr + Math.cos(a) * rr, w / 2 - rr + Math.sin(a) * rr)); }
  pts.push(new THREE.Vector2(r * 0.6, w / 2));
  const g = new THREE.LatheGeometry(pts, 28);
  g.rotateZ(Math.PI / 2);
  return g;
}
// tread texture shared by all tyres
let treadTex = null;
function getTread() {
  if (treadTex) return treadTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d');
  g.fillStyle = '#3a3c42'; g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#16171b'; for (let i = 0; i < 8; i++) { g.fillRect(i * 8, 0, 3, 7); g.fillRect(i * 8 + 4, 9, 3, 7); }
  treadTex = new THREE.CanvasTexture(c); treadTex.wrapS = treadTex.wrapT = THREE.RepeatWrapping; treadTex.repeat.set(1, 6); treadTex.colorSpace = THREE.SRGBColorSpace;
  return treadTex;
}

export function makeMats() {
  return {
    tire: new THREE.MeshStandardMaterial({ color: 0x555860, roughness: 0.88, metalness: 0, map: getTread() }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1c2b44, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.55, metalness: 0.3 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6ebf2, roughness: 0.12, metalness: 1 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, clearcoat: 1, emissive: 0xfff3d0, emissiveIntensity: 2.4 }),
  };
}

export function buildCar(def, M) {
  const g = new THREE.Group();
  const spec = SHAPES[def.shape] || SHAPES.hatch;
  const L = def.hl * 2.1, W = def.hw * 2 + 0.04, mon = def.shape === 'monster';
  const paint = new THREE.MeshPhysicalMaterial({ color: def.color, roughness: 0.3, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
  const accent = new THREE.MeshPhysicalMaterial({ color: def.accent, roughness: 0.35, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const rimM = new THREE.MeshStandardMaterial({ color: def.rim, roughness: 0.2, metalness: 0.9 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 1.6, roughness: 0.3 });
  const wr = def.wheelR, ww = mon ? 0.44 : 0.3;
  const wz = def.hl * 0.64, wx = def.hw + 0.03 + (mon ? 0.1 : 0);
  const shell = new THREE.Group();
  const body = new THREE.Mesh(sculptBody(spec, L, W, [wz, -wz], wr + 0.07), paint);
  const cab = new THREE.Mesh(sculptCab(spec, L, W * 0.98), M.glass);
  shell.add(body, cab);
  // roof cap (paint / accent) sitting on the greenhouse
  const [tr, tf, roofY, sr, sf] = spec.cab;
  const rz0 = (tr + sr) * L / 2, rz1 = (tf - sf) * L / 2;
  const roofG = new THREE.CapsuleGeometry(0.5, 1, 4, 10); roofG.rotateX(Math.PI / 2);
  const roof = new THREE.Mesh(roofG, def.shape === 'van' ? paint : accent);
  roof.scale.set(W * spec.tum * 0.96, 0.07, Math.abs(rz1 - rz0) * 0.5);
  roof.position.set(0, roofY - 0.01, (rz0 + rz1) / 2);
  shell.add(roof);
  // stripes on the bonnet for the sporty ones
  if (def.shape === 'wedge' || def.shape === 'racer') {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, L * 0.42), accent);
    st.position.set(0, lerpTable(spec.top, 0.55) + 0.005, L * 0.28); st.rotation.x = Math.atan2(lerpTable(spec.top, 0.2) - lerpTable(spec.top, 0.9), L * 0.35); shell.add(st);
  }
  // lights: glowing headlights, taillight bar (brightens when braking)
  const zF = L / 2, zR = -L / 2;
  const hy = lerpTable(spec.top, 0.95) - 0.08, ty = lerpTable(spec.top, -0.95) - 0.1;
  const headG = new THREE.CapsuleGeometry(0.075, 0.16, 4, 10); headG.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(headG, M.lens); h.position.set(s * (W / 2 - 0.2), hy, zF - 0.06 - (spec.nose * 0.05)); h.scale.z = 0.6; shell.add(h);
  }
  const tl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.78, 0.07, 0.05), tail); tl.position.set(0, ty, zR + 0.03); shell.add(tl);
  // grille + bumpers + diffuser
  const grille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.5, 0.1, 0.05), M.dark); grille.position.set(0, spec.bot + 0.14, zF - 0.02); shell.add(grille);
  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.08, 0.14), M.dark); bumpF.position.set(0, spec.bot + 0.03, zF - 0.06); shell.add(bumpF);
  const bumpR = bumpF.clone(); bumpR.position.z = zR + 0.06; shell.add(bumpR);
  // mirrors
  for (const s of [-1, 1]) {
    const mr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.1), paint);
    mr.position.set(s * (W / 2 + 0.03), lerpTable(spec.top, tf) + 0.06, tf * L / 2 - 0.12); shell.add(mr);
  }
  // spoilers
  if (spec.spoiler === 'wing') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.04, 0.32), accent);
    const wy = lerpTable(spec.top, -0.9) + 0.26;
    wing.position.set(0, wy, -L * 0.43); wing.rotation.x = -0.12;
    const ep = new THREE.BoxGeometry(0.03, 0.14, 0.34);
    const e1 = new THREE.Mesh(ep, accent); e1.position.set(-W * 0.49, wy + 0.03, -L * 0.43);
    const e2 = e1.clone(); e2.position.x = W * 0.49;
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.1), M.dark); s1.position.set(-0.32, wy - 0.13, -L * 0.42);
    const s2 = s1.clone(); s2.position.x = 0.32; shell.add(wing, e1, e2, s1, s2);
  } else if (spec.spoiler === 'duck') {
    const duck = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.05, 0.16), accent);
    duck.position.set(0, lerpTable(spec.top, -0.9) + 0.03, -L * 0.45); duck.rotation.x = -0.35; shell.add(duck);
  } else if (spec.spoiler === 'bar') {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, W * 0.8, 10), M.chrome); bar.rotation.z = Math.PI / 2; bar.position.set(0, roofY + 0.12, -0.1); shell.add(bar);
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.lens); l.position.set(s * 0.22, roofY + 0.2, -0.1); shell.add(l); }
  }
  // exhausts
  for (const s of [-1, 1]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), M.chrome); ex.rotation.x = Math.PI / 2; ex.position.set(s * 0.28, spec.bot + 0.08, zR - 0.02); shell.add(ex);
  }
  shell.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  mergeByMaterial(shell);
  g.add(shell);
  // wheels: lathe tyre with rounded sidewalls + 5-spoke rim + hub
  const tg = tyreGeometry(wr, ww);
  const rimG = new THREE.CylinderGeometry(wr * 0.6, wr * 0.6, ww * 0.7, 18, 1, true); rimG.rotateZ(Math.PI / 2);
  const dishG = new THREE.CylinderGeometry(wr * 0.6, wr * 0.6, 0.02, 18); dishG.rotateZ(Math.PI / 2);
  const spokeG = new THREE.BoxGeometry(0.03, wr * 0.55, 0.07); spokeG.translate(0, wr * 0.28, 0);
  const hubG = new THREE.CylinderGeometry(wr * 0.14, wr * 0.14, 0.06, 10); hubG.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[wx, wz], [-wx, wz], [wx, -wz], [-wx, -wz]]) { // FL, FR, RL, RR (local +x = left)
    const steer = new THREE.Group(); steer.position.set(x, wr, z);
    const spin = new THREE.Group();
    const t = new THREE.Mesh(tg, M.tire); t.castShadow = true;
    const out = Math.sign(x) * (ww * 0.32);
    const rim = new THREE.Mesh(rimG, rimM);
    const dish = new THREE.Mesh(dishG, rimM); dish.position.x = out;
    const hub = new THREE.Mesh(hubG, M.chrome); hub.position.x = out + Math.sign(x) * 0.02;
    spin.add(t, rim, dish, hub);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(spokeG, rimM); sp.position.x = out + Math.sign(x) * 0.015; sp.rotation.x = k * Math.PI * 2 / 5; spin.add(sp); }
    mergeByMaterial(spin);
    steer.add(spin);
    g.add(steer); wheels.push({ steer, spin, x, z });
  }
  return {
    group: g, shell, wheels, wheelR: wr, paint, tail, sc: mon ? 0.12 : 0.09,
    exhaust: [new THREE.Vector3(-0.28, spec.bot + 0.08, zR - 0.12), new THREE.Vector3(0.28, spec.bot + 0.08, zR - 0.12)],
    rear: [new THREE.Vector3(wx, 0.05, -wz), new THREE.Vector3(-wx, 0.05, -wz)],
    front: [new THREE.Vector3(wx, 0.05, wz), new THREE.Vector3(-wx, 0.05, wz)],
    setBrake(b) { tail.emissiveIntensity = 1.4 + b * 4; },
  };
}

// ---------------------------------------------------------------- ball
// Classic football: truncated-icosahedron panels computed per pixel from the object-space normal
// (12 pentagons on the icosahedron vertices, 20 hexagons on the dodecahedron vertices), with seams.
export function buildBall() {
  const geo = new THREE.SphereGeometry(R, 48, 32);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18, sheen: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vObjN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vObjN = normalize(position);');
    const phi = (1 + Math.sqrt(5)) / 2, ip = 1 / phi;
    const ico = [], dod = [];
    for (const [a, b] of [[1, phi], [-1, phi], [1, -phi], [-1, -phi]]) ico.push([0, a, b], [a, b, 0], [b, 0, a]);
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) dod.push([x, y, z]);
    for (const [a, b] of [[ip, phi], [-ip, phi], [ip, -phi], [-ip, -phi]]) dod.push([0, a, b], [a, b, 0], [b, 0, a]);
    const v3 = (c) => { const l = Math.hypot(...c); return `vec3(${(c[0] / l).toFixed(5)},${(c[1] / l).toFixed(5)},${(c[2] / l).toFixed(5)})`; };
    sh.fragmentShader = `varying vec3 vObjN;
      const vec3 PC[12] = vec3[12](${ico.map(v3).join(',')});
      const vec3 HC[20] = vec3[20](${dod.map(v3).join(',')});
      ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 n = normalize(vObjN);
        float b1 = -2.0, b2 = -2.0; float isP = 0.0;
        for (int i = 0; i < 12; i++) { float d = dot(n, PC[i]) * 0.9744; if (d > b1) { b2 = b1; b1 = d; isP = 1.0; } else if (d > b2) b2 = d; }
        for (int i = 0; i < 20; i++) { float d = dot(n, HC[i]); if (d > b1) { b2 = b1; b1 = d; isP = 0.0; } else if (d > b2) b2 = d; }
        float fw = fwidth(b1 - b2) * 1.2 + 1e-4;
        float seam = 1.0 - smoothstep(0.004, 0.004 + fw, b1 - b2);
        vec3 pc = mix(vec3(0.93, 0.94, 0.96), vec3(0.06, 0.07, 0.1), isP);
        diffuseColor.rgb = mix(pc, vec3(0.25, 0.27, 0.3), seam * 0.85);
      }`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n');
  };
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  return m;
}

// the big toy goalie; posed every frame from the physics collider endpoints
export function buildKeeper(color, accent) {
  const g = new THREE.Group();
  const jersey = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const trim = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c49b, roughness: 0.6 });
  const glove = new THREE.MeshStandardMaterial({ color: 0xfff35c, roughness: 0.45 });
  const black = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.35, 6, 14), jersey);
  const num = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 16), trim); num.position.set(0, 0.25, 0.53);
  body.add(num);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), skin); head.position.y = 1.22;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), trim); cap.position.y = 1.28;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 14, 1, false, -Math.PI / 2, Math.PI), trim); brim.position.set(0, 1.3, 0.3); brim.scale.z = 1.3;
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), black); e1.position.set(-0.14, 1.26, 0.38);
  const e2 = e1.clone(); e2.position.x = 0.14;
  body.add(head, cap, brim, e1, e2);
  const legG = new THREE.CapsuleGeometry(0.2, 0.45, 4, 8);
  const l1 = new THREE.Mesh(legG, black); l1.position.set(-0.24, -1.05, 0); const l2 = l1.clone(); l2.position.x = 0.24;
  body.add(l1, l2);
  const gl0 = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), glove), gl1 = gl0.clone();
  gl0.scale.set(1, 1.1, 0.75); gl1.scale.copy(gl0.scale);
  const armG = new THREE.CylinderGeometry(0.13, 0.13, 1, 8); armG.translate(0, 0.5, 0);
  const arm0 = new THREE.Mesh(armG, jersey), arm1 = new THREE.Mesh(armG, jersey);
  g.add(body, gl0, gl1, arm0, arm1);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
  const sh = new THREE.Vector3();
  function placeArm(arm, sx, sy, gx, gy, z) {
    arm.position.set(sx, sy, z);
    tmp.set(gx - sx, gy - sy, 0); const l = tmp.length() || 0.01; tmp.divideScalar(l);
    arm.quaternion.setFromUnitVectors(up, tmp);
    arm.scale.set(1, Math.max(0.05, l - 0.2), 1);
  }
  return {
    group: g, jersey, trim,
    // pose from collider endpoints (world x/y in the keeper plane z)
    pose(b0x, b0y, b1x, b1y, a0x, a0y, a1x, a1y, z) {
      const cx = (b0x + b1x) / 2, cy = (b0y + b1y) / 2;
      body.position.set(cx, cy, z);
      tmp.set(b1x - b0x, b1y - b0y, 0).normalize();
      q.setFromUnitVectors(up, tmp); body.quaternion.copy(q);
      gl0.position.set(a0x, a0y, z + 0.08); gl1.position.set(a1x, a1y, z + 0.08);
      // shoulders: near the top of the body axis
      sh.set(b1x - b0x, b1y - b0y, 0).multiplyScalar(0.85);
      const px = -tmp.y * 0.45, py = tmp.x * 0.45;
      placeArm(arm0, b0x + sh.x + px, b0y + sh.y + py, a0x, a0y, z + 0.04);
      placeArm(arm1, b0x + sh.x - px, b0y + sh.y - py, a1x, a1y, z + 0.04);
    },
  };
}
