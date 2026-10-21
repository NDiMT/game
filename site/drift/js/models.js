// Procedural toy models: cars (extruded side profiles), the ball, the big goalie.
import * as THREE from 'three';
import { R } from './physics.js';

function roundedProfile(pts, rad) {
  // pts: [[z,y], ...] closed polygon; corners rounded by quadratic curves
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const r = Array.isArray(rad) ? rad[i] : rad;
    const d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const r0 = Math.min(r, d0 / 2), r2 = Math.min(r, d2 / 2);
    const a = [p1[0] + (p0[0] - p1[0]) / d0 * r0, p1[1] + (p0[1] - p1[1]) / d0 * r0];
    const b = [p1[0] + (p2[0] - p1[0]) / d2 * r2, p1[1] + (p2[1] - p1[1]) / d2 * r2];
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}
function extrude(shape, width, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  g.rotateY(-Math.PI / 2);
  g.translate((width - bevel * 2) / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

// side profiles in (z forward, y up), car spans z in [-1, 1] before scaling by hl
const BODY = {
  hatch: { body: [[-1, 0.22], [1, 0.22], [1.04, 0.5], [0.55, 0.66], [-0.9, 0.7], [-1.04, 0.52]], cab: [[-0.82, 0.62], [0.42, 0.62], [0.1, 1.1], [-0.7, 1.12]], r: 0.16 },
  wedge: { body: [[-1, 0.2], [1, 0.2], [1.06, 0.34], [0.2, 0.6], [-1.0, 0.64]], cab: [[-0.62, 0.55], [0.38, 0.52], [-0.05, 0.92], [-0.55, 0.92]], r: 0.1, wing: true },
  van: { body: [[-1, 0.24], [1, 0.24], [1.02, 0.62], [0.78, 0.8], [-1.0, 0.82]], cab: [[-0.95, 0.74], [0.72, 0.74], [0.5, 1.28], [-0.95, 1.3]], r: 0.18 },
  racer: { body: [[-1, 0.18], [1, 0.18], [1.08, 0.3], [0.35, 0.5], [-1.02, 0.56]], cab: [[-0.5, 0.48], [0.3, 0.46], [-0.02, 0.82], [-0.42, 0.82]], r: 0.09, wing: true },
  monster: { body: [[-1, 0.5], [1, 0.5], [1.04, 0.8], [0.5, 0.92], [-0.95, 0.96], [-1.04, 0.8]], cab: [[-0.75, 0.9], [0.38, 0.9], [0.1, 1.36], [-0.62, 1.38]], r: 0.16 },
};

export function makeMats(env) {
  return {
    tire: new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.85, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0f1a2a, roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 }),
    head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 1.6 }),
    tail: new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1010, emissiveIntensity: 1.2 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.6, metalness: 0.3 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.18, metalness: 1 }),
  };
}

export function buildCar(def, M) {
  const g = new THREE.Group();
  const spec = BODY[def.shape] || BODY.hatch;
  const L = def.hl, W = def.hw * 2;
  const paint = new THREE.MeshPhysicalMaterial({ color: def.color, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12 });
  const accent = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.4, metalness: 0.1 });
  const rimM = new THREE.MeshStandardMaterial({ color: def.rim, roughness: 0.25, metalness: 0.8 });
  const sc = (p) => p.map(([z, y]) => [z * L, y]);
  const body = new THREE.Mesh(extrude(roundedProfile(sc(spec.body), spec.r), W, 0.09), paint);
  const cab = new THREE.Mesh(extrude(roundedProfile(sc(spec.cab), 0.1), W * 0.84, 0.06), M.glass);
  // roof cap in paint
  const roofY = Math.max(...spec.cab.map((p) => p[1]));
  const cabZ = spec.cab.filter((p) => p[1] > roofY - 0.05).map((p) => p[0] * L);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.07, Math.abs(cabZ[0] - cabZ[1]) + 0.1), def.shape === 'van' ? paint : accent);
  roof.position.set(0, roofY + 0.01, (cabZ[0] + cabZ[1]) / 2);
  const shell = new THREE.Group(); shell.add(body, cab, roof);
  if (def.shape === 'van') { const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.12, L * 1.7), accent); band.position.y = 0.55; shell.add(band); }
  // lights
  const zMax = Math.max(...spec.body.map((p) => p[0])) * L + 0.07, zMin = Math.min(...spec.body.map((p) => p[0])) * L - 0.07;
  const fz = zMax, fy = (spec.body[1][1] + spec.body[2][1]) / 2 + 0.04;
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.06), M.head); h.position.set(s * (W / 2 - 0.2), fy, fz); shell.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.05), M.tail); t.position.set(s * (W / 2 - 0.2), fy + 0.08, zMin); shell.add(t);
  }
  // bumpers
  const bump = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.1, 0.12), M.dark); bump.position.set(0, spec.body[0][1] + 0.02, zMax - 0.03); shell.add(bump);
  const bump2 = bump.clone(); bump2.position.z = zMin + 0.03; shell.add(bump2);
  if (spec.wing) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(W * 0.95, 0.05, 0.3), accent);
    wing.position.set(0, spec.body[spec.body.length - 1][1] + 0.26, -L * 0.88);
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.12), M.dark); s1.position.set(-0.35, wing.position.y - 0.13, wing.position.z);
    const s2 = s1.clone(); s2.position.x = 0.35; shell.add(wing, s1, s2);
  }
  if (def.shape === 'monster') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.08, 0.08), M.chrome); bar.position.set(0, 1.45, -0.1); shell.add(bar);
  }
  shell.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.add(shell);
  // wheels
  const wr = def.wheelR, ww = def.shape === 'monster' ? 0.42 : 0.3;
  const tg = new THREE.CylinderGeometry(wr, wr, ww, 22); tg.rotateZ(Math.PI / 2);
  const rg = new THREE.CylinderGeometry(wr * 0.62, wr * 0.62, ww + 0.02, 14); rg.rotateZ(Math.PI / 2);
  const hg = new THREE.CylinderGeometry(wr * 0.2, wr * 0.2, ww + 0.05, 8); hg.rotateZ(Math.PI / 2);
  const wheels = [];
  const wz = L * 0.64, wx = W / 2 + 0.03 + (def.shape === 'monster' ? 0.1 : 0);
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const steer = new THREE.Group(); steer.position.set(x, wr, z);
    const spin = new THREE.Group();
    const t = new THREE.Mesh(tg, M.tire); t.castShadow = true;
    const r = new THREE.Mesh(rg, rimM); const h = new THREE.Mesh(hg, M.chrome);
    // spokes so spin reads
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.03, wr * 1.1, 0.07), rimM); sp.rotation.x = k * Math.PI / 3; spin.add(sp); }
    spin.add(t, r, h); steer.add(spin);
    g.add(steer); wheels.push({ steer, spin });
  }
  shell.position.y = def.shape === 'monster' ? 0.12 : 0.05;
  return {
    group: g, shell, wheels, wheelR: wr, paint,
    exhaust: [new THREE.Vector3(-0.3, 0.32 + shell.position.y, -L - 0.12), new THREE.Vector3(0.3, 0.32 + shell.position.y, -L - 0.12)],
    rear: [new THREE.Vector3(-wx, 0.05, -wz), new THREE.Vector3(wx, 0.05, -wz)],
  };
}

// soccer-style ball: per-face colours on a subdivided icosahedron (12 pentagons)
export function buildBall() {
  const geo = new THREE.IcosahedronGeometry(R, 7);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const phi = (1 + Math.sqrt(5)) / 2;
  const centers = [];
  for (const [a, b] of [[1, phi], [-1, phi], [1, -phi], [-1, -phi]]) { centers.push([0, a, b], [a, b, 0], [b, 0, a]); }
  for (const c of centers) { const l = Math.hypot(...c); c[0] /= l; c[1] /= l; c[2] /= l; }
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    A.fromBufferAttribute(pos, i); B.fromBufferAttribute(pos, i + 1); C.fromBufferAttribute(pos, i + 2);
    A.add(B).add(C).normalize();
    let best = -1;
    for (const c of centers) best = Math.max(best, A.x * c[0] + A.y * c[1] + A.z * c[2]);
    // pentagon patches + a thin seam ring around them
    let r = 0.96, gg = 0.97, bb = 0.95;
    if (best > 0.958) { r = 0.09; gg = 0.1; bb = 0.14; }
    else if (best > 0.948) { r = 0.6; gg = 0.64; bb = 0.7; }
    for (let k = 0; k < 3; k++) { cols[(i + k) * 3] = r; cols[(i + k) * 3 + 1] = gg; cols[(i + k) * 3 + 2] = bb; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.deleteAttribute('normal');
  const g2 = geo; g2.computeVertexNormals();
  // smooth normals: on a sphere the normal is the position
  const n = g2.attributes.normal;
  for (let i = 0; i < pos.count; i++) { A.fromBufferAttribute(pos, i).normalize(); n.setXYZ(i, A.x, A.y, A.z); }
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const m = new THREE.Mesh(g2, mat); m.castShadow = true;
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
