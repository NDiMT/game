// Appliances and big metal objects built from parts, with HP and damage stages:
//  stage 1 (HP < 80%): handles / knobs / antennas / buttons pop off
//  stage 2 (HP < 55%): doors hang loose on their hinge, screens & windows crack, panels pop off
//  stage 3 (HP < 30%): doors rip off as their own bodies, screens / windows shatter, shelves + contents spill
//  stage 4 (HP = 0)  : everything left pops, sparks + smoke, body crumples into a husk (counts as destroyed)
// Each hit deals at most 36% of max HP, so even the anvil needs several hits.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const STAGE_HP = [1, 0.8, 0.55, 0.3, 0];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _bp = new THREE.Vector3(), _bq = new THREE.Quaternion();

// merge axis-aligned slabs into one dentable, non-indexed geometry
function slabs(list) {
  const geos = list.map(([w, h, d, x, y, z, sw = 1, sh = 1, sd = 1]) => new THREE.BoxGeometry(w, h, d, sw, sh, sd).toNonIndexed().translate(x, y, z));
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
  let o = 0;
  for (const g of geos) {
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  return g;
}
const seg = (len) => Math.max(1, Math.round(len / 0.11));
const closedBox = (W, H, D) => slabs([[W, H, D, 0, 0, 0, seg(W), seg(H), seg(D)]]);
// open-front box (fridge / microwave cavity): back, sides, top, bottom
const openBox = (W, H, D, t) => slabs([
  [W, H, t, 0, 0, -D / 2 + t / 2, seg(W), seg(H), 1],
  [t, H, D, -W / 2 + t / 2, 0, 0, 1, seg(H), seg(D)],
  [t, H, D, W / 2 - t / 2, 0, 0, 1, seg(H), seg(D)],
  [W, t, D, 0, H / 2 - t / 2, 0, seg(W), 1, seg(D)],
  [W, t, D, 0, -H / 2 + t / 2, 0, seg(W), 1, seg(D)],
]);

export function setupAppliances(G, K) {
  const M = G.mats, sfx = G.sfx, scene = G.scene;
  const geoCache = new Map();
  const cg = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
  const box = (w, h, d) => cg(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (r, h, n = 16) => cg(`c${r},${h}`, () => new THREE.CylinderGeometry(r, r, h, n));
  const plane = (w, h, bulge = 0) => cg(`p${w},${h},${bulge}`, () => {
    const g = new THREE.PlaneGeometry(w, h, bulge ? 8 : 1, bulge ? 6 : 1);
    if (bulge) { const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i) / (w / 2), y = a.getY(i) / (h / 2); a.setZ(i, bulge * (1 - 0.5 * (x * x + y * y))); } g.computeVertexNormals(); }
    return g;
  });
  const bottleGeo = G.groups.bottle.mesh.geometry;

  // ---------------------------------------------------------------- part helpers
  // part: { mesh, stage, mode: 'pop' | 'door' | 'glass' | 'crack' | 'spill', hx, hy, hz, mass, w, h }
  function mk(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    m.castShadow = geo.boundingSphere.radius > 0.15; // tiny parts skip the shadow pass (draw calls)
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function addPart(A, mesh, stage, mode, hx, hy, hz, mass = 0.6, extra = {}) {
    A.parts.push({ mesh, stage, mode, hx, hy, hz, mass, done: false, ...extra });
    return mesh;
  }
  function door(A, root, hingeX, y, z, w, h, d, mat, stage, side = -1) {
    const pivot = new THREE.Object3D();
    pivot.position.set(hingeX, y, z);
    root.add(pivot);
    const m = mk(box(w, h, d), mat, -side * w / 2, 0, d / 2, pivot);
    A.parts.push({ mesh: m, pivot, stage, mode: 'door', hx: w / 2, hy: h / 2, hz: Math.max(0.02, d / 2), mass: Math.max(1, w * h * 8), done: false, side, ang: 0, angT: 0, angV: 0, loose: false });
    return m;
  }
  const feet = (A, root, W, H, D, mat) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addPart(A, mk(cyl(0.025, 0.04, 8), mat, sx * (W / 2 - 0.06), -H / 2 - 0.02, sz * (D / 2 - 0.06), root), 4, 'pop', 0.025, 0.02, 0.025, 0.1);
  };

  // ---------------------------------------------------------------- definitions
  const DEF = {
    fridge: { W: 0.7, H: 1.62, D: 0.66, mass: 40, hp: 110, w: 6, size: 2, build(A, root) {
      const { W, H, D } = this;
      const shell = new THREE.Mesh(cg('fridgeShell', () => openBox(W, H, D, 0.04)), M.enamel);
      for (let i = 0; i < 3; i++) {
        const y = -H / 2 + 0.3 + i * 0.36;
        addPart(A, mk(box(W - 0.1, 0.012, D - 0.14), M.glassPart, 0, y, -0.02, root), 3, 'glass', (W - 0.1) / 2, 0.006, (D - 0.14) / 2);
        for (let k = 0; k < 3; k++) addPart(A, mk(bottleGeo, M.bottleMesh, -0.2 + k * 0.17 + rnd(-0.03, 0.03), y + 0.18, 0.02 + rnd(-0.08, 0.08), root), 3, 'spill', 0.07, 0.17, 0.07, 0.45, { what: 'bottle' });
      }
      const dz = D / 2;
      const fd = door(A, root, -W / 2, H / 2 - 0.25, dz, W, 0.48, 0.05, M.enamel, 3);
      addPart(A, mk(box(0.03, 0.26, 0.04), M.chrome, W / 2 - 0.08, -0.05, 0.045, fd), 1, 'pop', 0.015, 0.13, 0.02, 0.2);
      const md = door(A, root, -W / 2, -0.28, dz, W, H - 0.54, 0.05, M.enamel, 3);
      addPart(A, mk(box(0.03, 0.42, 0.04), M.chrome, W / 2 - 0.08, 0.25, 0.045, md), 1, 'pop', 0.015, 0.21, 0.02, 0.25);
      addPart(A, mk(box(W - 0.06, 0.06, 0.02), M.panelDark, 0, -H / 2 + 0.03, dz + 0.012, root), 2, 'pop', W / 2 - 0.03, 0.03, 0.01, 0.4);
      feet(A, root, W, H, D, M.rubber);
      return shell;
    } },
    washer: { W: 0.6, H: 0.85, D: 0.6, mass: 35, hp: 90, w: 5, size: 2, build(A, root) {
      const { W, H, D } = this, dz = D / 2;
      const shell = new THREE.Mesh(cg('washerShell', () => closedBox(W, H, D)), M.enamel);
      mk(cg('drum', () => new THREE.CircleGeometry(0.17, 24)), M.cavity, 0, -0.06, dz + 0.002, root);
      const pv = new THREE.Object3D(); pv.position.set(-0.2, -0.06, dz); root.add(pv);
      const ring = mk(cg('ring', () => new THREE.TorusGeometry(0.175, 0.03, 10, 28)), M.chrome, 0.2, 0, 0.03, pv);
      const disc = mk(cg('disc', () => new THREE.CylinderGeometry(0.155, 0.155, 0.02, 24).rotateX(Math.PI / 2)), M.glassPart, 0, 0, 0, ring);
      A.parts.push({ mesh: ring, pivot: pv, stage: 3, mode: 'door', hx: 0.2, hy: 0.2, hz: 0.04, mass: 2, done: false, side: -1, ang: 0, angT: 0, angV: 0, loose: false, glass: { mesh: disc, w: 0.3, h: 0.3 } });
      const panel = mk(box(W, 0.14, 0.03), M.panelLight, 0, H / 2 - 0.08, dz + 0.012, root);
      addPart(A, panel, 4, 'pop', W / 2, 0.07, 0.015, 0.6);
      for (const x of [0.12, 0.2]) addPart(A, mk(cg('knob', () => new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14).rotateX(Math.PI / 2)), M.chrome, x, 0, 0.025, panel), 1, 'pop', 0.03, 0.03, 0.015, 0.1);
      mk(plane(0.12, 0.05), M.screen, -0.05, 0, 0.016, panel);
      addPart(A, mk(box(0.16, 0.06, 0.03), M.panelLight, -0.19, H / 2 - 0.08, dz + 0.03, root), 2, 'pop', 0.08, 0.03, 0.015, 0.3);
      feet(A, root, W, H, D, M.rubber);
      return shell;
    } },
    crt: { W: 0.62, H: 0.5, D: 0.5, mass: 16, hp: 70, w: 4, size: 1, build(A, root) {
      const { W, H, D } = this, dz = D / 2;
      const shell = new THREE.Mesh(cg('crtShell', () => closedBox(W, H, D)), M.plasticWood);
      const scr = mk(plane(0.42, 0.34, 0.025), M.screen, -0.07, 0.01, dz + 0.004, root);
      A.parts.push({ mesh: scr, stage: 2, mode: 'crack', done: false });
      A.parts.push({ mesh: scr, stage: 3, mode: 'screen', done: false, w: 0.42, h: 0.34 });
      for (const y of [0.1, -0.02]) addPart(A, mk(cg('knob2', () => new THREE.CylinderGeometry(0.028, 0.032, 0.035, 14).rotateX(Math.PI / 2)), M.panelDark, W / 2 - 0.07, y, dz + 0.017, root), 1, 'pop', 0.03, 0.03, 0.017, 0.1);
      addPart(A, mk(box(0.09, 0.16, 0.012), M.grille, W / 2 - 0.07, -0.15, dz + 0.006, root), 3, 'pop', 0.045, 0.08, 0.006, 0.15);
      for (const s of [-1, 1]) {
        const ant = mk(cyl(0.006, 0.42, 6), M.chrome, s * 0.08, H / 2 + 0.17, -0.05, root);
        ant.rotation.z = -s * 0.45;
        addPart(A, ant, 1, 'pop', 0.01, 0.2, 0.01, 0.05);
      }
      addPart(A, mk(box(0.12, 0.02, 0.08), M.panelDark, 0, H / 2 + 0.01, -0.05, root), 2, 'pop', 0.06, 0.01, 0.04, 0.15);
      return shell;
    } },
    flattv: { W: 1.0, H: 0.6, D: 0.05, mass: 10, hp: 55, w: 4, size: 1, base: 0.16, build(A, root) {
      const { W, H, D } = this, dz = D / 2;
      const shell = new THREE.Mesh(cg('flatShell', () => closedBox(W, H, D)), M.panelDark);
      const scr = mk(plane(W - 0.04, H - 0.04), M.screen, 0, 0, dz + 0.002, root);
      A.parts.push({ mesh: scr, stage: 2, mode: 'crack', done: false });
      A.parts.push({ mesh: scr, stage: 3, mode: 'screen', done: false, w: W - 0.04, h: H - 0.04 });
      addPart(A, mk(box(0.06, 0.12, 0.03), M.chrome, 0, -H / 2 - 0.06, -0.01, root), 4, 'pop', 0.03, 0.06, 0.015, 0.3);
      addPart(A, mk(box(0.36, 0.025, 0.2), M.chrome, 0, -H / 2 - 0.135, 0, root), 4, 'pop', 0.18, 0.0125, 0.1, 0.8);
      addPart(A, mk(box(W * 0.6, H * 0.6, 0.02), M.panelDark, 0, 0, -dz - 0.01, root), 2, 'pop', W * 0.3, H * 0.3, 0.01, 0.4);
      return shell;
    } },
    microwave: { W: 0.52, H: 0.3, D: 0.38, mass: 9, hp: 55, w: 3, size: 1, build(A, root) {
      const { W, H, D } = this, dz = D / 2;
      const shell = new THREE.Mesh(cg('mwShell', () => openBox(W, H, D, 0.025)), M.steelBrushed);
      mk(box(W - 0.05, H - 0.05, 0.01), M.cavity, 0, 0, -D / 2 + 0.03, root);
      addPart(A, mk(cg('plate', () => new THREE.CylinderGeometry(0.12, 0.12, 0.01, 24)), M.glassPart, -0.06, -H / 2 + 0.035, 0, root), 3, 'glass', 0.12, 0.005, 0.12);
      const dw = W * 0.7;
      const d = door(A, root, -W / 2, 0, dz, dw, H - 0.02, 0.03, M.panelDark, 3);
      const win = mk(plane(dw * 0.7, (H - 0.02) * 0.62), M.glassDark, -0.02, 0, 0.016, d);
      A.parts.push({ mesh: win, stage: 2, mode: 'crack', done: false, crackMat: M.glassCracked });
      A.parts.find((p) => p.mesh === d).glass = { mesh: win, w: dw * 0.7, h: (H - 0.02) * 0.62 };
      const kp = mk(box(W * 0.28, H - 0.02, 0.03), M.panelDark, W / 2 - W * 0.14, 0, dz + 0.015, root);
      addPart(A, kp, 4, 'pop', W * 0.14, H / 2, 0.015, 0.3);
      for (let i = 0; i < 3; i++) addPart(A, mk(box(0.04, 0.025, 0.01), M.chrome, 0, 0.08 - i * 0.04, 0.02, kp), 1, 'pop', 0.02, 0.012, 0.005, 0.03);
      addPart(A, mk(cg('knob', () => new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14).rotateX(Math.PI / 2)), M.chrome, 0, -0.07, 0.025, kp), 1, 'pop', 0.03, 0.03, 0.015, 0.05);
      return shell;
    } },
    vending: { W: 0.9, H: 1.9, D: 0.75, mass: 70, hp: 140, w: 8, size: 2, build(A, root) {
      const { W, H, D } = this, dz = D / 2;
      const shell = new THREE.Mesh(cg('vendShell', () => closedBox(W, H, D)), M.paint('appl', 0xc8282a));
      mk(box(0.6, 1.3, 0.01), M.cavity, -0.1, 0.1, dz + 0.004, root);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) addPart(A, mk(cg('vcan', () => new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12)), M.paint('can', [0x2a73d6, 0xf0ad1f, 0x2fa462, 0xd8392f][(r + c) % 4]), -0.28 + c * 0.18, 0.62 - r * 0.32, dz - 0.06, root), 3, 'spill', 0.06, 0.1, 0.06, 0.3, { what: 'can' });
      const glass = mk(plane(0.62, 1.32), M.glassPartFlat, -0.1, 0.1, dz + 0.03, root);
      A.parts.push({ mesh: glass, stage: 2, mode: 'crack', done: false, crackMat: M.glassCracked });
      A.parts.push({ mesh: glass, stage: 3, mode: 'screen', done: false, w: 0.62, h: 1.32, tint: 0xd8f2ff });
      const sign = mk(box(W - 0.06, 0.22, 0.03), M.sign, 0, H / 2 - 0.16, dz + 0.015, root);
      addPart(A, sign, 4, 'pop', W / 2 - 0.03, 0.11, 0.015, 1.5);
      const side = mk(box(0.18, 1.0, 0.025), M.panelDark, W / 2 - 0.12, 0.25, dz + 0.012, root);
      addPart(A, side, 2, 'pop', 0.09, 0.5, 0.012, 1);
      for (let i = 0; i < 6; i++) addPart(A, mk(box(0.06, 0.04, 0.015), M.chrome, (i % 2 ? 0.035 : -0.035), 0.3 - ((i / 2) | 0) * 0.08, 0.02, side), 1, 'pop', 0.03, 0.02, 0.008, 0.03);
      addPart(A, mk(box(0.5, 0.12, 0.05), M.panelDark, -0.1, -H / 2 + 0.25, dz + 0.025, root), 3, 'pop', 0.25, 0.06, 0.025, 0.8);
      return shell;
    } },
    cardoor: { W: 0.95, H: 0.95, D: 0.06, mass: 12, hp: 70, w: 3, size: 1, build(A, root) {
      const { W, H, D } = this, dz = D / 2;
      const col = [0x2a73d6, 0xd8392f, 0xf0ad1f, 0x2fa462][(Math.random() * 4) | 0];
      const shell = new THREE.Mesh(cg('doorShell', () => slabs([[W, 0.56, D, 0, -H / 2 + 0.28, 0, 9, 5, 1], [0.05, 0.38, D * 0.6, -W / 2 + 0.1, 0.2, 0, 1, 3, 1], [W - 0.12, 0.04, D * 0.6, 0.03, H / 2 - 0.03, 0, 8, 1, 1]])), M.paint('appl', col));
      const win = mk(plane(W - 0.2, 0.36), M.glassDark, 0.04, 0.2, 0, root);
      A.parts.push({ mesh: win, stage: 2, mode: 'crack', done: false, crackMat: M.glassCracked });
      A.parts.push({ mesh: win, stage: 3, mode: 'screen', done: false, w: W - 0.2, h: 0.36, tint: 0x9fb4c4 });
      addPart(A, mk(box(0.14, 0.03, 0.03), M.chrome, 0.25, -0.05, dz + 0.012, root), 1, 'pop', 0.07, 0.015, 0.015, 0.1);
      const mir = mk(box(0.16, 0.1, 0.06), M.paint('appl', col), -W / 2 + 0.06, 0.04, dz + 0.04, root);
      mk(plane(0.13, 0.08), M.chrome, 0, 0, 0.031, mir);
      addPart(A, mir, 1, 'pop', 0.08, 0.05, 0.03, 0.3);
      addPart(A, mk(box(W - 0.05, 0.03, 0.015), M.chrome, 0, -0.03, dz + 0.007, root), 2, 'pop', W / 2, 0.015, 0.008, 0.2);
      return shell;
    } },
  };

  // ---------------------------------------------------------------- factory
  for (const type in DEF) {
    K[type] = (x, y, z, rotY = 0) => {
      const D = DEF[type];
      const root = new THREE.Group();
      const A = { parts: [] };
      const shell = D.build(A, root);
      shell.geometry = shell.geometry.clone(); // own copy: dents are per object
      shell.castShadow = shell.receiveShadow = true;
      root.add(shell);
      const base = D.base || 0;
      const q = rotY ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY) : null;
      const b = K.mkBody(D.mass, new CANNON.Box(new CANNON.Vec3(D.W / 2, D.H / 2, Math.max(D.D, base ? 0.1 : 0) / 2)), x, y + D.H / 2 + base, z, q, G.pm.metal);
      if (base) b.addShape(new CANNON.Box(new CANNON.Vec3(0.18, base / 2, 0.1)), new CANNON.Vec3(0, -D.H / 2 - base / 2, 0));
      if (base) b.updateMassProperties();
      root.position.set(x, y + D.H / 2 + base, z);
      if (q) root.quaternion.copy(q);
      return K.addItem({
        type: 'appliance', kind: type, mat: 'metal', w: D.w, body: b, mesh: root, shell, parts: A.parts, def: D,
        hp: D.hp, maxHp: D.hp, stage: 0, sizeClass: D.size, dentR: 0.22, dentMax: 0.07, noKnock: true, lastHit: -1, smokeT: 0, husk: false,
      });
    };
  }

  // ---------------------------------------------------------------- damage
  function worldOf(m, pos, quat) { m.updateWorldMatrix(true, false); m.matrixWorld.decompose(pos, quat, _s); }
  function detach(it, p, vx, vy, vz, kick = 2.5) {
    const m = p.mesh;
    if (!m.parent) return;
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    worldOf(m, pos, quat);
    m.removeFromParent();
    const out = _v.set(pos.x - it.body.position.x, 0, pos.z - it.body.position.z);
    const l = out.length() || 1;
    // physics proxies of small parts are padded: thin, very light boxes make the solver unstable
    const hx = Math.max(0.035, p.hx), hy = Math.max(0.035, p.hy), hz = Math.max(0.035, p.hz), mass = Math.max(0.4, p.mass);
    K.spawnPart(it.kind + hx.toFixed(3) + hy.toFixed(3) + hz.toFixed(3), hx, hy, hz, mass, m, pos, quat,
      vx + (out.x / l) * kick + rnd(-1, 1), vy + rnd(1, 3), vz + (out.z / l) * kick + rnd(-1, 1), rnd(5, 8));
  }
  function shatterMesh(it, m, w, h, tint, power) {
    if (!m.parent || !m.visible) return;
    worldOf(m, _bp, _bq);
    const c = new THREE.Color(tint || 0xcfe8ff);
    K.shatterRect(_bp, _bq, w, h, 0.012, it.body.velocity, c, _bp.x + rnd(-0.05, 0.05), _bp.y + rnd(-0.05, 0.05), _bp.z, 0, 0, 1, power);
    m.visible = false;
  }
  function spill(it, p) {
    if (!p.mesh.parent) return;
    worldOf(p.mesh, _bp, _bq);
    p.mesh.visible = false;
    // move the spawn point to just in front of the appliance so it does not start inside the solid body
    const b = it.body;
    const fwd = _v2.set(0, 0, 1).applyQuaternion(_q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w));
    const off = it.def.D / 2 + 0.12;
    const lp = _v.copy(_bp).sub(_s.set(b.position.x, b.position.y, b.position.z));
    const along = lp.dot(fwd);
    const x = _bp.x + fwd.x * (off - along), y = Math.max(0.02, _bp.y - 0.1), z = _bp.z + fwd.z * (off - along);
    G.liveSpawn = true;
    const ni = p.what === 'can' ? K.can(x, y, z) : K.bottle(x, y, z);
    G.liveSpawn = false;
    if (ni) { ni.body.velocity.set(fwd.x * rnd(1.5, 3) + rnd(-1, 1), rnd(0.5, 2.5), fwd.z * rnd(1.5, 3) + rnd(-0.5, 0.5)); ni.body.angularVelocity.set(rnd(-5, 5), rnd(-5, 5), rnd(-5, 5)); }
  }
  function applyStage(it, s, power) {
    const b = it.body;
    for (const p of it.parts) {
      if (p.done || p.stage > s) continue;
      if (p.mode === 'door') {
        if (s >= 3) {
          p.done = true;
          if (p.glass) shatterMesh(it, p.glass.mesh, p.glass.w, p.glass.h, 0xcfe8ff, power);
          for (const q of it.parts) if (!q.done && q.mesh.parent === p.mesh) q.done = true; // handles travel with the door
          detach(it, p, b.velocity.x, b.velocity.y, b.velocity.z, 3);
          sfx.metal(14, 1);
        } else if (!p.loose) { p.loose = true; p.angT = rnd(0.35, 0.7); p.angV = 2.5; }
        if (s === 2 && p.stage === 3) continue;
      }
      if (p.mode === 'door') continue;
      if (p.mode === 'crack') { p.done = true; p.mesh.material = p.crackMat || M.screenCracked; sfx.glassTink(8); continue; }
      p.done = true;
      if (p.mode === 'pop') detach(it, p, b.velocity.x, b.velocity.y, b.velocity.z, 2);
      else if (p.mode === 'screen') { shatterMesh(it, p.mesh, p.w, p.h, p.tint, power); worldOf(p.mesh, _bp, _bq); K.sparks(_bp.x, _bp.y, _bp.z, 10, 0, 0, -1); }
      else if (p.mode === 'glass') { worldOf(p.mesh, _bp, _bq); p.mesh.visible = false; K.glints(_bp.x, _bp.y, _bp.z, 6, 0.2); spillShards(it, p, power); }
      else if (p.mode === 'spill') spill(it, p);
    }
    // doors hanging loose for stage 2
    if (s >= 2) for (const p of it.parts) if (p.mode === 'door' && !p.done && !p.loose) { p.loose = true; p.angT = rnd(0.35, 0.7); p.angV = 2.5; }
    if (s >= 4 && !it.husk) toHusk(it);
  }
  function spillShards(it, p, power) {
    // a glass shelf / plate inside: burst it out of the front as shards
    const b = it.body, fwd = _v2.set(0, 0, 1).applyQuaternion(_q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w));
    worldOf(p.mesh, _bp, _bq);
    _bp.addScaledVector(fwd, it.def.D / 2 + 0.05);
    _q.setFromUnitVectors(_v.set(0, 0, 1), fwd);
    K.shatterRect(_bp, _q, p.hx * 2, Math.max(0.12, p.hz * 1.2), 0.008, b.velocity, new THREE.Color(0xdff4ff), _bp.x, _bp.y, _bp.z, fwd.x, 0.3, fwd.z, power * 0.6);
  }
  function toHusk(it) {
    it.husk = true;
    const g = it.shell.geometry, a = g.attributes.position.array;
    const W = it.def.W, H = it.def.H, D = it.def.D;
    const cx = rnd(-0.3, 0.3) * W, cy = rnd(-0.2, 0.3) * H;
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i], y = a[i + 1], z = a[i + 2];
      const nse = Math.sin(x * 23 + y * 17) * Math.cos(z * 19 - y * 13);
      const k = 1 - 0.07 * (1 + nse) - 0.12 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) * 12);
      a[i] = x * k; a[i + 1] = y * (0.94 + 0.04 * nse); a[i + 2] = z * k;
    }
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    it.shell.material = M.husk;
    const b = it.body;
    K.sparks(b.position.x, b.position.y + 0.1, b.position.z + it.def.D / 2, 16, 0, -0.3, -1);
    K.dust(b.position.x, b.position.y + it.def.H * 0.3, b.position.z, 10, 0.3, 0.3, 0.32, 0.45, 1.2);
    it.smokeT = 3.5;
    sfx.crunch(14); sfx.metal(14, 2);
    if (!it.counted) G.smash(it);
  }
  function damage(it, dmg, power) {
    if (it.husk) return;
    it.hp = Math.max(0, it.hp - Math.min(dmg, it.maxHp * 0.36));
    const f = it.hp / it.maxHp;
    let s = 0;
    while (s < 4 && f <= STAGE_HP[s + 1]) s++;
    if (s > it.stage) { it.stage = s; applyStage(it, s, power); }
  }
  G.applianceHit = (it, h, force, proj, snd) => {
    if (snd && h.v > 1) { it.lastSnd = G.time; sfx.metal(h.v, it.sizeClass); }
    if (force > 3.5 && G.time - it.lastDent > 0.05 && it.dentSum < 0.9) {
      it.lastDent = G.time;
      K.dent(it.shell ? { body: it.body, mesh: it.shell, dentR: it.dentR, dentSum: 0 } : it, h.px, h.py, h.pz, h.nx, h.ny, h.nz, clamp((force - 3) * 0.004, 0.004, it.dentMax));
      it.dentSum += clamp((force - 3) * 0.004, 0.004, it.dentMax);
    }
    if (force > 9) K.sparks(h.px, h.py, h.pz, Math.min(12, (force / 3) | 0), h.nx, h.ny, h.nz);
    if (G.time - it.lastHit < 0.08) return;
    const dmg = (force - 4) * (proj ? 1.5 : 0.6);
    if (dmg > 0) { it.lastHit = G.time; damage(it, dmg, force); }
  };
  G.applianceBlast = (it, f, x, y, z) => damage(it, it.maxHp * 0.36 * clamp(f * 1.5, 0.3, 1), 20);

  // per-frame: dangling doors swing, smoke from husks (called from core.update)
  G.updateAppliances = (dt) => {
    for (const it of G.metals) {
      if (it.type !== 'appliance' || it.dead) continue;
      for (const p of it.parts) {
        if (p.mode !== 'door' || !p.loose || p.done) continue;
        const acc = (p.angT - p.ang) * 30 - p.angV * 3;
        p.angV += acc * dt; p.ang += p.angV * dt;
        p.pivot.rotation.y = p.side * p.ang;
      }
      if (it.smokeT > 0) {
        it.smokeT -= dt;
        if (Math.random() < dt * 14) { const b = it.body; G.dust.emit(b.position.x + rnd(-0.2, 0.2), b.position.y + it.def.H / 2, b.position.z + rnd(-0.1, 0.1), rnd(-0.2, 0.2), rnd(0.6, 1.2), rnd(-0.2, 0.2), rnd(1.5, 2.5), rnd(0.2, 0.35), 0.28, 0.28, 0.3, -0.3, 0.6, 0.6, 0.55, 0, rnd(-1, 1)); }
        if (Math.random() < dt * 4) { const b = it.body; K.sparks(b.position.x + rnd(-0.2, 0.2), b.position.y + rnd(-0.2, 0.3), b.position.z + it.def.D / 2, 4, 0, -0.5, -1); }
      }
    }
  };
}
