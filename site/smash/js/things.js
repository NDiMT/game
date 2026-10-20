// Breakable things: factories, materials, impact handling and the three break styles
// (glass shatters, bricks crumble, metal dents) plus wood splinters, projectiles and bombs.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { IGroup } from './fx.js';

export const GR = { GROUND: 1, TARGET: 2, PROJ: 4, DEBRIS: 8 };
const ALL = 15;
export const BL = 0.34, BH = 0.17, BD = 0.17;
export const BOTTLE_H = 0.34, CAN_H = 0.2, BARREL_H = 0.86;
const BOTTLE_R = 0.07, CAN_R = 0.064, BARREL_R = 0.28, PANE_T = 0.035;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _cv = new CANNON.Vec3();

function ctex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const hex = (c) => '#' + new THREE.Color(c).getHexString();

export const GLASS_TINTS = [0xc4f1ff, 0xd2ffe9, 0xe6e0ff, 0xfff1c9, 0xffd6e6];
export const BOTTLE_TINTS = [0x45b064, 0xb0662a, 0xe2f6ff, 0x4f86e0, 0x3f9c55];
export const PAINT = [0xe8453c, 0x2f7fe0, 0xf2b630, 0x38b26a, 0xef7d2d, 0x8a5cd6];

export function setupThings(G) {
  const { scene, world, sfx } = G;
  const K = {};

  // ------------------------------------------------------------ textures & materials
  const brickTex = ctex(64, 32, (g, w, h) => {
    g.fillStyle = '#ececec'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const c = (190 + Math.random() * 65) | 0; g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  });
  const crateTex = ctex(128, 128, (g, w, h) => {
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#c88a49' : '#d59a56'; g.fillRect(0, (i * h) / 4, w, h / 4); g.fillStyle = 'rgba(90,50,20,0.5)'; g.fillRect(0, (i * h) / 4, w, 2); }
    g.strokeStyle = '#8b5a2b'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 14; g.beginPath(); g.moveTo(14, h - 14); g.lineTo(w - 14, 14); g.stroke();
    g.fillStyle = '#4a3420'; for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  });
  const plankTex = ctex(128, 32, (g, w, h) => {
    g.fillStyle = '#d9a46a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,70,30,0.35)'; g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) { g.beginPath(); const y = 3 + i * 4.3 + Math.random() * 2; g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.07 + i) * 1.5); g.stroke(); }
    g.strokeStyle = 'rgba(80,45,15,0.4)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  });
  const barrelTex = (col) => ctex(64, 128, (g, w, h) => {
    g.fillStyle = hex(col); g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (const y of [0.04, 0.3, 0.68, 0.94]) g.fillRect(0, y * h - 3, w, 6);
    g.fillStyle = 'rgba(255,255,255,0.18)'; for (const y of [0.3, 0.68]) g.fillRect(0, y * h - 5, w, 2);
  });
  const canTex = (col) => ctex(64, 64, (g, w, h) => {
    g.fillStyle = hex(col); g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.fillRect(0, h * 0.38, w, h * 0.24);
    g.fillStyle = hex(col); g.fillRect(0, h * 0.46, w, h * 0.08);
    g.fillStyle = '#b8bec6'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
  });
  const fridgeTex = ctex(64, 128, (g, w, h) => {
    g.fillStyle = '#f2f4f6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c6ccd2'; g.fillRect(0, h * 0.36, w, 2);
    g.fillStyle = '#9aa3ad'; g.fillRect(w * 0.8, h * 0.12, 4, h * 0.18); g.fillRect(w * 0.8, h * 0.42, 4, h * 0.25);
  });

  const glassTex = ctex(128, 128, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.7);
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(-60, -30, 120, 9); g.fillRect(-60, -12, 120, 3);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(-60, 26, 120, 5);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
  const M = (G.mats = {
    brick: new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.92 }),
    crate: new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ map: glassTex, color: 0xffffff, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.62, envMapIntensity: 2.6, depthWrite: false }),
    bottle: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.78, envMapIntensity: 2.2, depthWrite: false }),
    shard: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.62, envMapIntensity: 2.6, depthWrite: false, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc5cdd6, metalness: 0.95, roughness: 0.27 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x353a42, metalness: 0.85, roughness: 0.32 }),
    fridge: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.22 }),
    fridgeFront: new THREE.MeshStandardMaterial({ map: fridgeTex, metalness: 0.3, roughness: 0.22 }),
  });
  const paintCache = new Map();
  const paint = (kind, col) => {
    const key = kind + col;
    if (!paintCache.has(key)) {
      let m;
      if (kind === 'barrel') m = new THREE.MeshStandardMaterial({ map: barrelTex(col), metalness: 0.55, roughness: 0.35 });
      else if (kind === 'can') m = new THREE.MeshStandardMaterial({ map: canTex(col), metalness: 0.7, roughness: 0.25 });
      else m = new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.3 });
      paintCache.set(key, m);
    }
    return paintCache.get(key);
  };

  // ------------------------------------------------------------ geometry & instanced groups
  const box = new THREE.BoxGeometry(1, 1, 1);
  const chunkGeo = new THREE.DodecahedronGeometry(0.62, 0);
  const bottleGeo = (() => {
    const prof = [[0, 0], [0.064, 0], [0.07, 0.012], [0.07, 0.19], [0.058, 0.235], [0.03, 0.268], [0.023, 0.29], [0.023, 0.325], [0.027, 0.332], [0.02, 0.34], [0, 0.34]];
    const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y - BOTTLE_H / 2)), 12);
    return g;
  })();
  const Gp = (G.groups = {
    brick: new IGroup(scene, box, M.brick, 320),
    chunk: new IGroup(scene, chunkGeo, M.brick, 140),
    crate: new IGroup(scene, box, M.crate, 40),
    plank: new IGroup(scene, box, M.wood, 150),
    pane: new IGroup(scene, box, M.glass, 48, false),
    bottle: new IGroup(scene, bottleGeo, M.bottle, 90, false),
  });
  Gp.pane.mesh.renderOrder = 2;
  Gp.bottle.mesh.renderOrder = 3;

  // ------------------------------------------------------------ physics bodies
  function mkBody(mass, shape, x, y, z, q, mat = G.pm.gen, group = GR.TARGET) {
    const b = new CANNON.Body({
      mass, material: mat, collisionFilterGroup: group, collisionFilterMask: ALL,
      allowSleep: true, sleepSpeedLimit: 0.3, sleepTimeLimit: 0.4, linearDamping: 0.04, angularDamping: 0.12,
    });
    if (shape) b.addShape(shape);
    b.position.set(x, y, z);
    if (q) b.quaternion.set(q.x, q.y, q.z, q.w);
    syncInterp(b);
    return b;
  }
  function syncInterp(b) {
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); b.initPosition.copy(b.position);
    b.previousQuaternion.copy(b.quaternion); b.interpolatedQuaternion.copy(b.quaternion); b.initQuaternion.copy(b.quaternion);
  }
  K.mkBody = mkBody;

  function addItem(it) {
    const b = it.body;
    b.item = it;
    b.addEventListener('collide', G.onCollide);
    it.origin = new THREE.Vector3(b.position.x, b.position.y, b.position.z);
    it.dead = false; it.counted = false; it.pending = false; it.lastSnd = -1; it.lastDent = -1; it.dentSum = 0; it.yo = 0;
    G.items.push(it);
    G.totalW += it.w;
    G.newBodies.push(b);
    if (it.mesh) { G.metals.push(it); scene.add(it.mesh); }
    return it;
  }
  const qY = (a) => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const tint = (c, j = 0.06) => new THREE.Color(c).multiplyScalar(1 - j + Math.random() * 2 * j);

  // ------------------------------------------------------------ factories (y = bottom unless noted)
  K.brick = (x, y, z, len = BL, rotY = 0) => {
    const col = new THREE.Color().setHSL(0.02 + Math.random() * 0.035, 0.55 + Math.random() * 0.2, 0.4 + Math.random() * 0.1);
    const h = Gp.brick.add({ scale: new THREE.Vector3(len * 0.965, BH * 0.93, BD * 0.97), color: col });
    if (!h) return null;
    const b = mkBody(2 * (len / BL), new CANNON.Box(new CANNON.Vec3(len / 2, BH / 2, BD / 2)), x, y + BH / 2, z, rotY ? qY(rotY) : null);
    h.body = b;
    return addItem({ type: 'brick', mat: 'brick', w: 1, body: b, h, color: col, size: new THREE.Vector3(len, BH, BD) });
  };
  K.pane = (x, y, z, w, hgt, o = {}) => {
    const col = new THREE.Color(o.tint ?? GLASS_TINTS[0]);
    const h = Gp.pane.add({ scale: new THREE.Vector3(w, hgt, PANE_T), color: col });
    if (!h) return null;
    const q = new THREE.Quaternion();
    if (o.flat) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    if (o.rotY) q.premultiply(qY(o.rotY));
    const cy = o.flat ? y + PANE_T / 2 : y + hgt / 2;
    const b = mkBody(clamp(w * hgt * 5, 0.8, 6), new CANNON.Box(new CANNON.Vec3(w / 2, hgt / 2, PANE_T / 2)), x, cy, z, q);
    h.body = b;
    return addItem({ type: 'pane', mat: 'glass', w: 3, body: b, h, color: col, size: new THREE.Vector3(w, hgt, PANE_T) });
  };
  K.bottle = (x, y, z, tintIdx) => {
    const col = new THREE.Color(tintIdx == null ? pick(BOTTLE_TINTS) : BOTTLE_TINTS[tintIdx % BOTTLE_TINTS.length]);
    const h = Gp.bottle.add({ scale: new THREE.Vector3(1, 1, 1), color: col });
    if (!h) return null;
    const b = mkBody(0.45, new CANNON.Cylinder(BOTTLE_R, BOTTLE_R, BOTTLE_H, 8), x, y + BOTTLE_H / 2, z, qY(Math.random() * 6));
    h.body = b;
    return addItem({ type: 'bottle', mat: 'glass', w: 1.5, body: b, h, color: col, upright: true });
  };
  K.crate = (x, y, z, s = 0.5, rotY = 0) => {
    const col = tint(0xffffff, 0.08);
    const h = Gp.crate.add({ scale: new THREE.Vector3(s, s, s), color: col });
    if (!h) return null;
    const b = mkBody(5 * (s / 0.5) ** 2, new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)), x, y + s / 2, z, rotY ? qY(rotY) : null);
    h.body = b;
    return addItem({ type: 'crate', mat: 'wood', w: 3, body: b, h, color: col, size: new THREE.Vector3(s, s, s) });
  };
  K.board = (x, y, z, len, depth, thick = 0.05, rotY = 0) => {
    const col = tint(0xffffff, 0.08);
    const h = Gp.plank.add({ scale: new THREE.Vector3(len, thick, depth), color: col });
    if (!h) return null;
    const b = mkBody(Math.max(1, len * 1.6), new CANNON.Box(new CANNON.Vec3(len / 2, thick / 2, depth / 2)), x, y + thick / 2, z, rotY ? qY(rotY) : null);
    h.body = b;
    return addItem({ type: 'board', mat: 'wood', w: 1, body: b, h, color: col, size: new THREE.Vector3(len, thick, depth) });
  };
  function metalItem(type, size, w, mass, shape, geo, mat, x, y, z, q, dentR, dentMax, extra = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const b = mkBody(mass, shape, x, y, z, q, G.pm.metal);
    mesh.position.set(x, y, z);
    return addItem({ type, mat: 'metal', w, body: b, mesh, sizeClass: size, dentR, dentMax, upright: true, ...extra });
  }
  K.barrel = (x, y, z, col = pick(PAINT)) => {
    const sideM = paint('barrel', col), capM = paint('flat', col);
    const geo = new THREE.CylinderGeometry(BARREL_R, BARREL_R, BARREL_H, 20, 6);
    return metalItem('barrel', 2, 3, 14, new CANNON.Cylinder(BARREL_R, BARREL_R, BARREL_H, 12), geo, [sideM, capM, capM], x, y + BARREL_H / 2, z, qY(Math.random() * 6), 0.24, 0.11);
  };
  K.can = (x, y, z, col = pick(PAINT)) => {
    const geo = new THREE.CylinderGeometry(CAN_R, CAN_R, CAN_H, 14, 4);
    return metalItem('can', 0, 1, 0.3, new CANNON.Cylinder(CAN_R, CAN_R, CAN_H, 8), geo, [paint('can', col), M.steel, M.steel], x, y + CAN_H / 2, z, qY(Math.random() * 6), 0.09, 0.035);
  };
  K.sheet = (x, y, z, w, hgt, col = pick(PAINT), rotY = 0) => {
    const geo = new THREE.BoxGeometry(w, hgt, 0.05, 12, 9, 1);
    return metalItem('sheet', 1, 3, 9, new CANNON.Box(new CANNON.Vec3(w / 2, hgt / 2, 0.025)), geo, paint('flat', col), x, y + hgt / 2, z, rotY ? qY(rotY) : null, 0.28, 0.14);
  };
  K.fridge = (x, y, z, rotY = 0) => {
    const geo = new THREE.BoxGeometry(0.64, 1.5, 0.6, 5, 10, 5);
    const mats = [M.fridge, M.fridge, M.fridge, M.fridge, M.fridgeFront, M.fridge];
    return metalItem('fridge', 2, 4, 30, new CANNON.Box(new CANNON.Vec3(0.32, 0.75, 0.3)), geo, mats, x, y + 0.75, z, rotY ? qY(rotY) : null, 0.3, 0.13);
  };
  K.pipe = (x, yCenter, z, len = 1.1, rotY = 0) => {
    const geo = new THREE.CylinderGeometry(0.08, 0.08, len, 12, 6).rotateZ(Math.PI / 2);
    const b = mkBody(5, null, x, yCenter, z, rotY ? qY(rotY) : null, G.pm.metal);
    b.addShape(new CANNON.Cylinder(0.08, 0.08, len, 8), new CANNON.Vec3(), new CANNON.Quaternion().setFromEuler(0, 0, Math.PI / 2));
    b.angularDamping = 0.4;
    const mesh = new THREE.Mesh(geo, M.steel);
    mesh.castShadow = mesh.receiveShadow = true;
    return addItem({ type: 'pipe', mat: 'metal', w: 2, body: b, mesh, sizeClass: 1, dentR: 0.14, dentMax: 0.04 });
  };

  // ------------------------------------------------------------ removal, waking
  function wakeNear(p, r) {
    const r2 = r * r;
    for (const it of G.items) {
      if (it.dead) continue;
      const b = it.body;
      if (b.sleepState === CANNON.Body.SLEEPING) {
        const dx = b.position.x - p.x, dy = b.position.y - p.y, dz = b.position.z - p.z;
        if (dx * dx + dy * dy + dz * dz < r2) b.wakeUp();
      }
    }
  }
  K.wakeNear = wakeNear;
  function removeItem(it, wakeR = 0.8) {
    if (it.dead) return;
    it.dead = true;
    const b = it.body;
    if (b.world) world.removeBody(b);
    if (it.h) it.h.g.remove(it.h);
    if (it.mesh) { scene.remove(it.mesh); it.mesh.geometry.dispose(); }
    wakeNear(b.position, wakeR);
    if (!it.counted) G.smash(it);
  }

  // ------------------------------------------------------------ debris (real bodies, short-lived, capped)
  function addDebris(group, shape, mass, x, y, z, q, scale, color, vx, vy, vz, life, kind) {
    if (group.full) {
      const idx = G.debris.findIndex((d) => d.h.g === group && !d.gone);
      if (idx < 0) return;
      G.killDebris(G.debris[idx], true);
    }
    const h = group.add({ scale, color });
    if (!h) return;
    const b = mkBody(mass, shape, x, y, z, q, G.pm.gen, GR.DEBRIS);
    b.velocity.set(vx, vy, vz);
    b.angularVelocity.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
    b.sleepSpeedLimit = 0.5;
    b.linearDamping = 0.08;
    h.body = b;
    const d = { body: b, h, life, kind, lastSnd: -1 };
    b.deb = d;
    b.addEventListener('collide', G.onCollide);
    world.addBody(b);
    G.debris.push(d);
  }

  // ------------------------------------------------------------ particles helpers
  const dust = (x, y, z, n, r, g, b, size = 0.35, spread = 1) => {
    for (let i = 0; i < n; i++) G.dust.emit(x + rnd(-0.1, 0.1) * spread, y + rnd(-0.05, 0.1), z + rnd(-0.1, 0.1) * spread, rnd(-1, 1) * spread, rnd(0.1, 1.2), rnd(-1, 1) * spread, rnd(0.7, 1.4), size * rnd(0.6, 1.1), r, g, b, -0.4, 2.5, size * 1.6, 0.55);
  };
  const sparkle = (x, y, z, n, spread = 0.5) => {
    for (let i = 0; i < n; i++) {
      const c = Math.random();
      G.spark.emit(x + rnd(-spread, spread), y + rnd(-spread, spread), z + rnd(-0.1, 0.1), rnd(-2, 2), rnd(-0.5, 2.5), rnd(-1, 2), rnd(0.25, 0.7), rnd(0.06, 0.14), 0.75 + c * 0.25, 0.9 + c * 0.1, 1, 3, 1.5, 0, 1);
    }
  };
  const sparks = (x, y, z, n, nx, ny, nz) => {
    for (let i = 0; i < n; i++) G.spark.emit(x, y, z, -nx * rnd(1, 4) + rnd(-2.5, 2.5), -ny * rnd(1, 4) + rnd(0, 3), -nz * rnd(1, 4) + rnd(-2.5, 2.5), rnd(0.2, 0.45), rnd(0.04, 0.08), 1, rnd(0.55, 0.85), 0.25, 9, 0.5, 0, 1);
  };
  K.dust = dust;

  // ------------------------------------------------------------ GLASS: panes shatter into triangular shards
  const _L = () => new THREE.Matrix4();
  function triL(ax, ay, bx, by, cx, cy, t) {
    let e1x = bx - ax, e1y = by - ay, e2x = cx - ax, e2y = cy - ay;
    if (e1x * e2y - e1y * e2x < 0) { [e1x, e2x] = [e2x, e1x]; [e1y, e2y] = [e2y, e1y]; }
    return _L().set(e1x, e2x, 0, 0, e1y, e2y, 0, 0, 0, 0, t, 0, 0, 0, 0, 1);
  }
  function shatterPane(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body, w = it.size.x, hh = it.size.y, t = it.size.z;
    const bq = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const inv = _q2.copy(bq).invert();
    const lp = _v.set(px - b.position.x, py - b.position.y, pz - b.position.z).applyQuaternion(inv);
    const ix = clamp(lp.x, -w * 0.45, w * 0.45), iy = clamp(lp.y, -hh * 0.45, hh * 0.45);
    // rays: 4 corners + random spokes, rings at fractions of the distance to the border
    const ang = [];
    for (const [cx, cy] of [[w / 2, hh / 2], [-w / 2, hh / 2], [-w / 2, -hh / 2], [w / 2, -hh / 2]]) ang.push(Math.atan2(cy - iy, cx - ix));
    const nr = 5 + ((Math.random() * 4) | 0), base = Math.random() * 6.283;
    for (let k = 0; k < nr; k++) ang.push(base + (k * 6.283) / nr + rnd(-0.25, 0.25));
    const A = ang.map((a) => ((a % 6.2832) + 6.2832) % 6.2832).sort((a, b2) => a - b2);
    const rings = [rnd(0.12, 0.22), rnd(0.38, 0.55), 1];
    const P = A.map((a) => {
      const cx = Math.cos(a), cy = Math.sin(a);
      const tx = cx > 1e-6 ? (w / 2 - ix) / cx : cx < -1e-6 ? (-w / 2 - ix) / cx : 1e9;
      const ty = cy > 1e-6 ? (hh / 2 - iy) / cy : cy < -1e-6 ? (-hh / 2 - iy) / cy : 1e9;
      const D = Math.min(tx, ty);
      return rings.map((f, k) => { const ff = k < 2 ? f * rnd(0.85, 1.15) : 1; return [ix + cx * D * ff, iy + cy * D * ff]; });
    });
    const tris = [];
    const n = A.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tris.push([[ix, iy], P[i][0], P[j][0]]);
      for (let k = 0; k < 2; k++) {
        const a = P[i][k], bb = P[j][k], c = P[j][k + 1], d = P[i][k + 1];
        if (Math.random() < 0.5) { tris.push([a, bb, c]); tris.push([a, c, d]); } else { tris.push([a, bb, d]); tris.push([bb, c, d]); }
      }
    }
    const bv = b.velocity, pw = Math.min(power, 30);
    const dlen = Math.hypot(dx, dy, dz) || 1;
    for (const [a, bb, c] of tris) {
      const gx = (a[0] + bb[0] + c[0]) / 3, gy = (a[1] + bb[1] + c[1]) / 3;
      const area = Math.abs((bb[0] - a[0]) * (c[1] - a[1]) - (bb[1] - a[1]) * (c[0] - a[0])) / 2;
      if (area < 0.0004) continue;
      const L = triL(a[0] - gx, a[1] - gy, bb[0] - gx, bb[1] - gy, c[0] - gx, c[1] - gy, t);
      const wp = _v2.set(gx, gy, 0).applyQuaternion(bq).add(_v3.set(b.position.x, b.position.y, b.position.z));
      const dist = Math.hypot(gx - ix, gy - iy);
      const f = (pw * 0.35 * rnd(0.4, 1)) / (1 + dist * 4);
      const vel = new THREE.Vector3(bv.x + (dx / dlen) * f + rnd(-1, 1) * (0.4 + f * 0.25), bv.y + (dy / dlen) * f + rnd(-0.5, 1.5) * (0.3 + f * 0.2), bv.z + (dz / dlen) * f + rnd(-1, 1) * (0.4 + f * 0.25));
      const spin = (2 + f) * 2;
      G.shards.spawn(wp, bq, L, vel, new THREE.Vector3(rnd(-spin, spin), rnd(-spin, spin), rnd(-spin, spin)), it.color, rnd(2.2, 3.8));
    }
    const ip = _v2.set(ix, iy, 0).applyQuaternion(bq).add(_v3.set(b.position.x, b.position.y, b.position.z));
    sparkle(ip.x, ip.y, ip.z, 16, 0.12);
    sparkle(b.position.x, b.position.y, b.position.z, 10, Math.max(w, hh) * 0.4);
    sfx.glassBreak(power);
    removeItem(it, Math.max(w, hh) * 0.6 + 0.3);
  }
  function shatterBottle(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body, bq = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const n = 16 + ((Math.random() * 8) | 0), pw = Math.min(power, 25), dl = Math.hypot(dx, dy, dz) || 1;
    for (let i = 0; i < n; i++) {
      const th = Math.random() * 6.283, yy = rnd(-BOTTLE_H / 2, BOTTLE_H * 0.3);
      const r = yy > 0.03 ? 0.04 : BOTTLE_R;
      const nrm = new THREE.Vector3(Math.cos(th), 0, Math.sin(th)).applyQuaternion(bq);
      const wp = new THREE.Vector3(Math.cos(th) * r, yy, Math.sin(th) * r).applyQuaternion(bq).add(_v3.set(b.position.x, b.position.y, b.position.z));
      const s = rnd(0.03, 0.075);
      const L = triL(0, 0, s, rnd(-0.3, 0.3) * s, rnd(0, 0.6) * s, s, 0.006);
      L.elements[12] = 0; // no translation
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm).multiply(_q2.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.283));
      const out = rnd(1, 2.5) + pw * 0.08;
      const vel = new THREE.Vector3(nrm.x * out + (dx / dl) * pw * 0.12, rnd(0.5, 2.5) + (dy / dl) * pw * 0.1, nrm.z * out + (dz / dl) * pw * 0.12);
      G.shards.spawn(wp, q, L, vel, new THREE.Vector3(rnd(-20, 20), rnd(-20, 20), rnd(-20, 20)), it.color, rnd(2, 3.5));
    }
    sparkle(b.position.x, b.position.y, b.position.z, 10, 0.12);
    sfx.glassBreak(power * 0.7);
    removeItem(it, 0.5);
  }

  // ------------------------------------------------------------ BRICK: crumbles into 3-6 chunks + dust
  function crumbleBrick(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body, s = it.size, bq = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const nx = s.x > 0.25 ? 2 + (Math.random() < 0.5 ? 1 : 0) : 1, ny = Math.random() < 0.6 ? 2 : 1;
    const cw = s.x / nx, ch = s.y / ny, dl = Math.hypot(dx, dy, dz) || 1, pw = Math.min(power, 40);
    const col = it.color.clone().multiplyScalar(0.92);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const ox = -s.x / 2 + cw * (i + 0.5), oy = -s.y / 2 + ch * (j + 0.5);
      const wp = _v.set(ox, oy, 0).applyQuaternion(bq);
      const sx = cw * rnd(0.8, 1), sy = ch * rnd(0.8, 1), sz = s.z * rnd(0.75, 0.95);
      const f = pw * 0.12 * rnd(0.3, 1);
      addDebris(Gp.chunk, new CANNON.Box(new CANNON.Vec3(sx * 0.42, sy * 0.42, sz * 0.42)), Math.max(0.25, 2 * (cw * ch) / (BL * BH)),
        b.position.x + wp.x, b.position.y + wp.y, b.position.z + wp.z, _q2.copy(bq).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(-0.4, 0.4)))),
        new THREE.Vector3(sx, sy, sz), col, b.velocity.x + (dx / dl) * f + wp.x * 8 * rnd(0.3, 1), b.velocity.y + (dy / dl) * f + rnd(0.5, 2.5), b.velocity.z + (dz / dl) * f + wp.z * 8, rnd(4, 6.5), 'chunk');
    }
    dust(b.position.x, b.position.y, b.position.z, 9, 0.83, 0.62, 0.5, 0.32);
    dust(b.position.x, b.position.y, b.position.z, 4, 0.95, 0.86, 0.76, 0.22, 0.6);
    sfx.crumble(power);
    removeItem(it, 0.6);
  }

  // ------------------------------------------------------------ WOOD: crates splinter into planks, boards snap
  function splinterCrate(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body, s = it.size.x, bq = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const dl = Math.hypot(dx, dy, dz) || 1, pw = Math.min(power, 35);
    for (const f of faces) for (const half of [-1, 1]) {
      if (Math.random() < 0.35) continue;
      const nrm = new THREE.Vector3(...f);
      const tang = Math.abs(f[1]) ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const off = nrm.clone().multiplyScalar(s / 2 - 0.02).addScaledVector(tang, (half * s) / 4);
      const lq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
      const wq = bq.clone().multiply(lq);
      const wp = off.applyQuaternion(bq);
      const wn = nrm.applyQuaternion(bq);
      const out = rnd(1, 3) + pw * 0.06;
      addDebris(Gp.plank, new CANNON.Box(new CANNON.Vec3(s * 0.45, s * 0.21, 0.02)), 0.5, b.position.x + wp.x, b.position.y + wp.y, b.position.z + wp.z, wq,
        new THREE.Vector3(s * 0.96, s * 0.46, 0.04), new THREE.Color(0xe0b080).multiplyScalar(rnd(0.85, 1)),
        b.velocity.x + wn.x * out + (dx / dl) * pw * 0.1, b.velocity.y + wn.y * out + rnd(1, 3), b.velocity.z + wn.z * out + (dz / dl) * pw * 0.1, rnd(4, 6), 'plank');
    }
    dust(b.position.x, b.position.y, b.position.z, 8, 0.86, 0.72, 0.52, 0.35, 1.3);
    splinters(b.position.x, b.position.y, b.position.z, 14);
    sfx.splinter(power);
    removeItem(it, s + 0.3);
  }
  function splinters(x, y, z, n) {
    for (let i = 0; i < n; i++) G.dust.emit(x, y, z, rnd(-3, 3), rnd(0, 4), rnd(-3, 3), rnd(0.5, 1), rnd(0.03, 0.06), 0.62, 0.42, 0.22, 9, 0.5, 0, 1);
  }
  function snapBoard(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body, s = it.size, bq = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const lp = _v.set(px - b.position.x, py - b.position.y, pz - b.position.z).applyQuaternion(_q2.copy(bq).invert());
    const cut = clamp(lp.x, -s.x / 2 + 0.2, s.x / 2 - 0.2);
    const dl = Math.hypot(dx, dy, dz) || 1, pw = Math.min(power, 35);
    for (const [a, c] of [[-s.x / 2, cut], [cut, s.x / 2]]) {
      const len = c - a, mid = (a + c) / 2;
      if (len < 0.08) continue;
      const wp = new THREE.Vector3(mid, 0, 0).applyQuaternion(bq);
      const sgn = Math.sign(mid - cut) || 1;
      const tw = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sgn * 0.15));
      addDebris(Gp.plank, new CANNON.Box(new CANNON.Vec3(len / 2, s.y / 2, s.z / 2)), Math.max(0.5, len * 1.6), b.position.x + wp.x, b.position.y + wp.y, b.position.z + wp.z, bq.clone().multiply(tw),
        new THREE.Vector3(len, s.y, s.z), it.h.color, b.velocity.x + (dx / dl) * pw * 0.08, b.velocity.y + (dy / dl) * pw * 0.08 + 1, b.velocity.z + (dz / dl) * pw * 0.08, rnd(5, 7), 'plank');
    }
    const cp = new THREE.Vector3(cut, 0, 0).applyQuaternion(bq);
    splinters(b.position.x + cp.x, b.position.y + cp.y, b.position.z + cp.z, 12);
    sfx.splinter(power);
    removeItem(it, s.x / 2 + 0.3);
  }

  // ------------------------------------------------------------ METAL: dents (vertex displacement), cans crumple
  function dent(it, px, py, pz, nx, ny, nz, depth) {
    const b = it.body, g = it.mesh.geometry, a = g.attributes.position.array;
    const inv = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).invert();
    const lp = _v.set(px - b.position.x, py - b.position.y, pz - b.position.z).applyQuaternion(inv);
    const ln = _v2.set(nx, ny, nz).applyQuaternion(inv);
    const R = it.dentR, R2 = R * R;
    let moved = false;
    for (let i = 0; i < a.length; i += 3) {
      const ddx = a[i] - lp.x, ddy = a[i + 1] - lp.y, ddz = a[i + 2] - lp.z;
      const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
      if (d2 < R2) {
        const f = 1 - Math.sqrt(d2) / R, s = depth * f * f * (3 - 2 * f);
        a[i] += ln.x * s; a[i + 1] += ln.y * s; a[i + 2] += ln.z * s;
        moved = true;
      }
    }
    if (moved) { g.attributes.position.needsUpdate = true; g.computeVertexNormals(); }
    it.dentSum += depth;
  }
  function crumpleCan(it, power, dx, dy, dz) {
    if (it.crumpled) return;
    it.crumpled = true;
    const g = it.mesh.geometry, a = g.attributes.position.array, sq = rnd(0.45, 0.62);
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i], y = a[i + 1], z = a[i + 2];
      const nse = Math.sin(x * 61 + y * 37) * Math.cos(z * 53 - y * 29);
      const rs = 1 + 0.22 * nse + (y > 0 ? 0.08 : 0.04);
      a[i] = x * rs; a[i + 2] = z * rs; a[i + 1] = y * sq + nse * 0.012;
    }
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    const b = it.body;
    if (b.removeShape) {
      b.removeShape(b.shapes[0]);
      b.addShape(new CANNON.Cylinder(CAN_R * 1.15, CAN_R * 1.15, CAN_H * sq, 8));
      b.updateMassProperties();
    }
    const dl = Math.hypot(dx, dy, dz) || 1, pw = Math.min(power, 30) * 0.15;
    b.velocity.x += (dx / dl) * pw; b.velocity.y += 1.5 + Math.random() * 2; b.velocity.z += (dz / dl) * pw;
    b.angularVelocity.set(rnd(-15, 15), rnd(-15, 15), rnd(-15, 15));
    sfx.crunch(power);
    if (!it.counted) G.smash(it);
  }

  // ------------------------------------------------------------ collisions
  G.onCollide = function (e) {
    const self = e.target, other = e.body, c = e.contact;
    const v = Math.abs(c.getImpactVelocityAlongNormal());
    if (!(v >= 0.7) || v > 200) return;
    const isI = c.bi === self, r = isI ? c.ri : c.rj, s = isI ? -1 : 1;
    if (self.proj && other.item && other.item.mat === 'glass') self.proj.pass = true;
    G.hits.push({ body: self, other, v, px: self.position.x + r.x, py: self.position.y + r.y, pz: self.position.z + r.z, nx: c.ni.x * s, ny: c.ni.y * s, nz: c.ni.z * s });
  };

  function queueBreak(it, h, power) {
    if (it.pending || it.dead) return;
    it.pending = true;
    G.breakQ.push({ it, px: h.px, py: h.py, pz: h.pz, dx: h.nx, dy: h.ny, dz: h.nz, power });
  }
  K.queueBreak = queueBreak;

  function impact(it, h) {
    const o = h.other, om = o.type === CANNON.Body.STATIC ? 0 : o.mass;
    const force = om > 0 ? h.v * Math.sqrt(Math.min(om, 40) / 2) : h.v * 0.8;
    const isProj = !!o.proj;
    const snd = G.time - it.lastSnd > 0.07;
    switch (it.type) {
      case 'pane':
        if (h.v > 2.0 || (isProj && h.v > 1.2)) queueBreak(it, h, Math.max(force, h.v * 2));
        else if (snd && h.v > 1) { it.lastSnd = G.time; sfx.glassTink(h.v); }
        return;
      case 'bottle':
        if (h.v > 2.4 || (isProj && h.v > 1.2)) queueBreak(it, h, Math.max(force, h.v * 2));
        else if (snd && h.v > 1) { it.lastSnd = G.time; sfx.glassTink(h.v * 0.7); }
        return;
      case 'brick':
        if (force > 11 && Math.random() < (force - 9) / 5) queueBreak(it, h, force);
        else if (snd && h.v > 1.2) { it.lastSnd = G.time; sfx.brick(h.v); }
        return;
      case 'crate':
        if (force > 13 && Math.random() < (force - 11) / 6) queueBreak(it, h, force);
        else if (snd && h.v > 1.2) { it.lastSnd = G.time; sfx.wood(h.v); }
        return;
      case 'board':
        if (force > 17 && it.size.x > 0.6) queueBreak(it, h, force);
        else if (snd && h.v > 1.2) { it.lastSnd = G.time; sfx.wood(h.v); }
        return;
    }
    if (it.mat === 'metal') {
      if (snd && h.v > 1) { it.lastSnd = G.time; sfx.metal(h.v * (om > 0 ? 1 : 0.7), it.sizeClass); }
      if (it.type === 'can' && force > 7) { crumpleCan(it, force, -h.nx, -h.ny, -h.nz); return; }
      if (force > 3.5 && G.time - it.lastDent > 0.04 && it.dentSum < 0.6) {
        it.lastDent = G.time;
        dent(it, h.px, h.py, h.pz, h.nx, h.ny, h.nz, clamp((force - 3) * 0.006, 0.006, it.dentMax));
        if (it.dentSum > 0.15 && !it.counted) G.smash(it);
      }
      if (force > 9) sparks(h.px, h.py, h.pz, Math.min(14, (force / 3) | 0), h.nx, h.ny, h.nz);
    }
  }
  function debHit(d, h) {
    if (h.v < 2.2 || G.time - d.lastSnd < 0.1) return;
    d.lastSnd = G.time;
    if (d.kind === 'chunk') sfx.brick(h.v * 0.45); else sfx.wood(h.v * 0.5);
  }
  function projHit(p, h) {
    if (p.dead) return;
    if (p.kind === 'bomb') { if (p.age > 0.03) G.explode(p); return; }
    const oit = h.other.item;
    const heavy = p.mass * h.v;
    if (oit && !p.hit && h.v > 5) {
      p.hit = true;
      if (heavy > 60) {
        G.hitstop(Math.min(0.09, 0.025 + heavy / 6000));
        G.shake(Math.min(0.32, heavy / 1000));
        G.vibrate(heavy > 400 ? 28 : 14);
      }
    }
    if (G.time - p.lastSnd > 0.08 && h.v > 1.5 && !(oit && oit.mat === 'glass')) {
      p.lastSnd = G.time;
      if (p.kind === 'brick') sfx.brick(h.v);
      else if (p.kind === 'anvil') { sfx.metal(h.v, 2); sfx.thud(h.v, true); }
      else sfx.thud(h.v, p.kind === 'bowling');
    }
  }
  G.processHits = () => {
    const H = G.hits;
    for (let i = 0; i < H.length; i++) {
      const h = H[i], b = h.body;
      if (b.proj) projHit(b.proj, h);
      else if (b.item) { if (!b.item.dead) impact(b.item, h); }
      else if (b.deb) debHit(b.deb, h);
    }
    H.length = 0;
  };
  G.processBreaks = () => {
    const Q = G.breakQ;
    let n = 0;
    while (Q.length && n < 9) {
      const e = Q.shift(), it = e.it;
      if (it.dead) continue;
      n++;
      const f = { pane: shatterPane, bottle: shatterBottle, brick: crumbleBrick, crate: splinterCrate, board: snapBoard }[it.type];
      if (f) f(it, e.px, e.py, e.pz, e.dx, e.dy, e.dz, e.power);
    }
  };

  // ------------------------------------------------------------ projectiles
  const PROJ = {
    ball: { mass: 6, speed: 1, shape: () => new CANNON.Sphere(0.2) },
    brick: { mass: 2.5, speed: 1, shape: () => new CANNON.Box(new CANNON.Vec3(BL / 2, BH / 2, BD / 2)) },
    bowling: { mass: 11, speed: 0.92, shape: () => new CANNON.Sphere(0.22) },
    anvil: { mass: 45, speed: 0.8 },
    bomb: { mass: 4, speed: 1, shape: () => new CANNON.Sphere(0.18) },
  };
  G.PROJ = PROJ;
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xff4a3d, roughness: 0.35, metalness: 0.05 });
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x2b4fd8, roughness: 0.12, metalness: 0.1, envMapIntensity: 1.6 });
  const bombMat = new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.4, metalness: 0.3 });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0a0f2a });
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const holeGeo = new THREE.CircleGeometry(0.028, 10);
  const fuseGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.12, 6);
  const projBrickMat = new THREE.MeshStandardMaterial({ map: brickTex, color: 0xc4573a, roughness: 0.9 });
  function projMesh(kind) {
    let m;
    if (kind === 'ball') { m = new THREE.Mesh(sphere, ballMat); m.scale.setScalar(0.2); }
    else if (kind === 'bowling') {
      m = new THREE.Group();
      const s = new THREE.Mesh(sphere, bowlMat); s.scale.setScalar(0.22); m.add(s);
      [[0, 0.07], [0.05, 0.11], [-0.05, 0.11]].forEach(([x, y]) => { const hm = new THREE.Mesh(holeGeo, holeMat); const p = new THREE.Vector3(x, y, 0.2).normalize().multiplyScalar(0.2205); hm.position.copy(p); hm.lookAt(p.clone().multiplyScalar(2)); m.add(hm); });
    } else if (kind === 'brick') { m = new THREE.Mesh(box, projBrickMat); m.scale.set(BL, BH, BD); }
    else if (kind === 'anvil') {
      m = new THREE.Group();
      const add = (sx, sy, sz, x, y) => { const b = new THREE.Mesh(box, M.dark); b.scale.set(sx, sy, sz); b.position.set(x, y, 0); b.castShadow = true; m.add(b); };
      add(0.5, 0.1, 0.28, 0, -0.13); add(0.26, 0.14, 0.18, 0, -0.01); add(0.56, 0.14, 0.26, 0.04, 0.13);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 10), M.dark); horn.rotation.z = Math.PI / 2; horn.position.set(-0.37, 0.15, 0); m.add(horn);
    } else {
      m = new THREE.Group();
      const s = new THREE.Mesh(sphere, bombMat); s.scale.setScalar(0.18); s.castShadow = true; m.add(s);
      const f = new THREE.Mesh(fuseGeo, M.steel); f.position.y = 0.2; m.add(f);
    }
    m.castShadow = true;
    return m;
  }
  function anvilBody(b) {
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.25, 0.05, 0.14)), new CANNON.Vec3(0, -0.13, 0));
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.13, 0.07, 0.09)), new CANNON.Vec3(0, -0.01, 0));
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.3, 0.07, 0.13)), new CANNON.Vec3(-0.02, 0.13, 0));
  }
  K.throwProj = (kind, from, vel) => {
    const D = PROJ[kind];
    if (G.projs.filter((p) => !p.dead).length >= 8) { const old = G.projs.find((p) => !p.dead); if (old) G.killProj(old); }
    const b = mkBody(D.mass, D.shape ? D.shape() : null, from.x, from.y, from.z, null, G.pm.proj, GR.PROJ);
    if (kind === 'anvil') { anvilBody(b); b.updateMassProperties(); }
    b.velocity.set(vel.x, vel.y, vel.z);
    const sp = vel.length();
    b.angularVelocity.set(-sp * (kind === 'anvil' ? 0.15 : 0.45) + rnd(-2, 2), rnd(-3, 3), rnd(-2, 2));
    b.linearDamping = 0.01;
    b.sleepSpeedLimit = 0.4;
    const mesh = projMesh(kind);
    mesh.position.copy(from);
    scene.add(mesh);
    const p = { kind, body: b, mesh, mass: D.mass, age: 0, life: kind === 'bomb' ? 2.6 : 7, hit: false, lastSnd: -1, dead: false, pre: new CANNON.Vec3().copy(b.velocity), pass: false };
    b.proj = p;
    b.addEventListener('collide', G.onCollide);
    world.addBody(b);
    G.projs.push(p);
    return p;
  };

  // ------------------------------------------------------------ BOMB
  G.explode = (p) => {
    if (p.dead) return;
    const c = p.body.position, x = c.x, y = c.y, z = c.z;
    G.killProj(p, true);
    if (!Number.isFinite(x + y + z)) return;
    const R = 3.2;
    let brk = 0;
    for (const it of G.items) {
      if (it.dead) continue;
      const b = it.body, dx = b.position.x - x, dy = b.position.y - y, dz = b.position.z - z, d = Math.hypot(dx, dy, dz);
      if (!(d <= R)) continue;
      const f = 1 - d / R, inv = 1 / Math.max(d, 0.05);
      const dv = 15 * f * Math.min(1, Math.sqrt(6 / b.mass));
      b.wakeUp();
      b.velocity.x += dx * inv * dv; b.velocity.y += dy * inv * dv + 3 * f; b.velocity.z += dz * inv * dv * (dz > 0 ? 0.3 : 1);
      b.angularVelocity.x += rnd(-8, 8) * f; b.angularVelocity.y += rnd(-8, 8) * f; b.angularVelocity.z += rnd(-8, 8) * f;
      const h = { px: x + dx * 0.8, py: y + dy * 0.8, pz: z + dz * 0.8, nx: dx * inv, ny: dy * inv, nz: dz * inv };
      if (it.mat === 'glass' && d < 2.6) queueBreak(it, h, 25 * f + 6);
      else if (it.type === 'brick' && d < 1.4 && brk < 16 && Math.random() < 0.85) { brk++; queueBreak(it, h, 30 * f + 8); }
      else if (it.type === 'crate' && d < 1.7) queueBreak(it, h, 25);
      else if (it.type === 'board' && d < 1.2) queueBreak(it, h, 25);
      else if (it.type === 'can' && d < 1.6) crumpleCan(it, 20, h.nx, h.ny, h.nz);
      else if (it.mat === 'metal' && it.mesh) {
        const r0 = it.type === 'barrel' ? BARREL_R : 0.3;
        dent(it, b.position.x - h.nx * r0, b.position.y - h.ny * r0, b.position.z - h.nz * r0, h.nx, h.ny, h.nz, it.dentMax * f * 1.4);
        if (!it.counted && f > 0.3) G.smash(it);
      }
    }
    for (const d of G.debris) {
      const b = d.body, dx = b.position.x - x, dy = b.position.y - y, dz = b.position.z - z, dd = Math.hypot(dx, dy, dz);
      if (dd < R && b.world) { const f = (1 - dd / R) * 12 / Math.max(dd, 0.05); b.wakeUp(); b.velocity.x += dx * f; b.velocity.y += dy * f + 3; b.velocity.z += dz * f * (dz > 0 ? 0.3 : 1); }
    }
    for (const q of G.projs) {
      if (q.dead) continue;
      const b = q.body, dx = b.position.x - x, dy = b.position.y - y, dz = b.position.z - z, dd = Math.hypot(dx, dy, dz);
      if (dd < R) { const f = (1 - dd / R) * 10 / Math.max(dd, 0.05) * Math.min(1, 6 / q.mass); b.wakeUp(); b.velocity.x += dx * f; b.velocity.y += dy * f + 2; b.velocity.z += dz * f; }
    }
    G.shards.push(x, y, z, R, 10);
    // fx
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * 6.283, e = rnd(-0.3, 1.2), s = rnd(2, 9);
      G.spark.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 1, Math.sin(a) * Math.cos(e) * s, rnd(0.25, 0.6), rnd(0.12, 0.3), 1, rnd(0.45, 0.85), rnd(0.1, 0.3), 4, 3, 0.1, 1);
    }
    for (let i = 0; i < 26; i++) G.dust.emit(x + rnd(-0.3, 0.3), y + rnd(0, 0.4), z + rnd(-0.3, 0.3), rnd(-2.5, 2.5), rnd(0.5, 3), rnd(-2.5, 2.5), rnd(1, 2), rnd(0.5, 0.9), 0.42, 0.4, 0.4, -0.6, 2.2, 1.4, 0.7);
    G.flash(x, y, z);
    sfx.boom();
    G.shake(0.55);
    G.hitstop(0.06);
    G.slowmo(true);
    G.vibrate([30, 20, 70]);
  };

  return K;
}
