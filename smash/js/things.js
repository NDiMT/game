// Breakable things: factories, impact handling and the break styles
// (glass shatters, bricks crumble, metal dents, wood splinters), projectiles and the bomb.
// Hot paths (hits, breaks, debris, shards, projectiles) use pools / ring buffers: no per-hit allocations.
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
const UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();

export const GLASS_TINTS = [0xbfeeff, 0xc9ffe6, 0xdcd6ff, 0xfff0c4, 0xffd3e4];
export const BOTTLE_TINTS = [0x3faa5e, 0xb06424, 0xdff4ff, 0x4a82e0, 0x2f8f4a];
export const PAINT = [0xd8392f, 0x2a73d6, 0xf0ad1f, 0x2fa462, 0xe8722a, 0x7d55cf];

// projectile definitions. budget = how many bricks one throw may crumble directly
export const PROJ = {
  ball: { mass: 5, speed: 1, r: 0.2, budget: 2 },
  brick: { mass: 2.5, speed: 1, budget: 1 },
  bowling: { mass: 9, speed: 0.92, r: 0.22, budget: 4 },
  anvil: { mass: 22, speed: 0.75, budget: 5 },
  bomb: { mass: 4, speed: 1, r: 0.18, budget: 0 },
};

export function setupThings(G) {
  const { scene, world, sfx } = G;
  const M = G.mats;
  const K = {};

  // ------------------------------------------------------------ geometry & instanced groups
  const box = new THREE.BoxGeometry(1, 1, 1);
  const chunkGeo = new THREE.DodecahedronGeometry(0.62, 0);
  const prof = [[0, 0], [0.064, 0], [0.07, 0.012], [0.07, 0.19], [0.058, 0.235], [0.03, 0.268], [0.023, 0.29], [0.023, 0.325], [0.027, 0.332], [0.02, 0.34], [0, 0.34]];
  const bottleGeo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y - BOTTLE_H / 2)), 14);
  const Gp = (G.groups = {
    brick: new IGroup(scene, box, M.brick, 320),
    chunk: new IGroup(scene, chunkGeo, M.rubble || M.brick, 140),
    crate: new IGroup(scene, box, M.crate, 40),
    plank: new IGroup(scene, box, M.wood, 150),
    pane: new IGroup(scene, box, M.glass, 48, false),
    bottle: new IGroup(scene, bottleGeo, M.bottle, 90, false),
  });
  Gp.pane.mesh.renderOrder = 2;
  Gp.bottle.mesh.renderOrder = 3;
  // metal geometry templates (cloned per item so each can dent independently)
  const TPL = {
    barrel: new THREE.CylinderGeometry(BARREL_R, BARREL_R, BARREL_H, 24, 8),
    can: new THREE.CylinderGeometry(CAN_R, CAN_R, CAN_H, 16, 4),
  };
  const pipeTpl = new Map();

  // ------------------------------------------------------------ physics bodies
  function mkBody(mass, shape, x, y, z, q, mat = G.pm.gen, group = GR.TARGET) {
    const b = new CANNON.Body({
      mass, material: mat, collisionFilterGroup: group, collisionFilterMask: ALL,
      allowSleep: true, sleepSpeedLimit: G.tune.sleepLimit, sleepTimeLimit: 0.5, linearDamping: 0.04, angularDamping: 0.12,
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
  K.syncInterp = syncInterp;

  function addItem(it) {
    const b = it.body;
    b.item = it;
    b.addEventListener('collide', G.onCollide);
    it.origin = new THREE.Vector3(b.position.x, b.position.y, b.position.z);
    it.dead = false; it.counted = false; it.pending = false; it.lastSnd = -1; it.lastDent = -1; it.dentSum = 0; it.yo = 0;
    G.items.push(it);
    if (G.liveSpawn) {
      // spilled contents (bottles from a fridge, cans from a vending machine): live, loose, bonus value
      it.w = 0; it.anchored = false;
      world.addBody(b);
    } else {
      G.totalW += it.w;
      G.newItems.push(it);
    }
    if (it.mesh) { G.metals.push(it); scene.add(it.mesh); }
    return it;
  }
  K.mkBody = mkBody; K.addItem = addItem;
  const qY = (a) => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const tint = (c, j = 0.06) => new THREE.Color(c).multiplyScalar(1 - j + Math.random() * 2 * j);

  // ------------------------------------------------------------ factories (y = bottom)
  K.brick = (x, y, z, len = BL, rotY = 0) => {
    const col = new THREE.Color().setHSL(0.02 + Math.random() * 0.035, 0.5 + Math.random() * 0.22, 0.4 + Math.random() * 0.1);
    const h = Gp.brick.add({ scale: new THREE.Vector3(len * 0.97, BH * 0.94, BD * 0.97), color: col, yo: 0 });
    if (!h) return null;
    const b = mkBody(2 * (len / BL), new CANNON.Box(new CANNON.Vec3(len / 2, BH / 2, BD / 2)), x, y + BH / 2, z, rotY ? qY(rotY) : null);
    h.body = b;
    return addItem({ type: 'brick', mat: 'brick', w: 1, body: b, h, color: col, size: new THREE.Vector3(len, BH, BD) });
  };
  K.pane = (x, y, z, w, hgt, o = {}) => {
    const col = new THREE.Color(o.tint ?? GLASS_TINTS[0]);
    const h = Gp.pane.add({ scale: new THREE.Vector3(w, hgt, PANE_T), color: col, yo: 0 });
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
    const h = Gp.bottle.add({ scale: new THREE.Vector3(1, 1, 1), color: col, yo: 0 });
    if (!h) return null;
    const b = mkBody(0.45, new CANNON.Cylinder(BOTTLE_R, BOTTLE_R, BOTTLE_H, 8), x, y + BOTTLE_H / 2, z, qY(Math.random() * 6));
    h.body = b;
    return addItem({ type: 'bottle', mat: 'glass', w: 1.5, body: b, h, color: col, upright: true });
  };
  K.crate = (x, y, z, s = 0.5, rotY = 0) => {
    const col = tint(0xffffff, 0.08);
    const h = Gp.crate.add({ scale: new THREE.Vector3(s, s, s), color: col, yo: 0 });
    if (!h) return null;
    const b = mkBody(8 * (s / 0.5) ** 2, new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)), x, y + s / 2, z, rotY ? qY(rotY) : null);
    h.body = b;
    return addItem({ type: 'crate', mat: 'wood', w: 3, body: b, h, color: col, size: new THREE.Vector3(s, s, s) });
  };
  K.board = (x, y, z, len, depth, thick = 0.05, rotY = 0, heavy = false) => {
    const col = tint(0xffffff, 0.08);
    const h = Gp.plank.add({ scale: new THREE.Vector3(len, thick, depth), color: col, yo: 0 });
    if (!h) return null;
    const b = mkBody(Math.max(2, len * (heavy ? 12 : 5)), new CANNON.Box(new CANNON.Vec3(len / 2, thick / 2, depth / 2)), x, y + thick / 2, z, rotY ? qY(rotY) : null);
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
  K.barrel = (x, y, z, col = pick(PAINT)) => metalItem('barrel', 2, 3, 12, new CANNON.Cylinder(BARREL_R, BARREL_R, BARREL_H, 12), TPL.barrel.clone(), M.paint('barrel', col), x, y + BARREL_H / 2, z, qY(Math.random() * 6), 0.24, 0.11);
  K.can = (x, y, z, col = pick(PAINT)) => metalItem('can', 0, 1, 0.3, new CANNON.Cylinder(CAN_R, CAN_R, CAN_H, 8), TPL.can.clone(), M.paint('can', col), x, y + CAN_H / 2, z, qY(Math.random() * 6), 0.09, 0.035);
  K.pipe = (x, yCenter, z, len = 1.1, rotY = 0) => {
    if (!pipeTpl.has(len)) pipeTpl.set(len, new THREE.CylinderGeometry(0.08, 0.08, len, 14, 6).rotateZ(Math.PI / 2));
    const b = mkBody(5, null, x, yCenter, z, rotY ? qY(rotY) : null, G.pm.metal);
    b.addShape(new CANNON.Cylinder(0.08, 0.08, len, 8), new CANNON.Vec3(), new CANNON.Quaternion().setFromEuler(0, 0, Math.PI / 2));
    b.angularDamping = 0.4;
    const mesh = new THREE.Mesh(pipeTpl.get(len).clone(), M.steel);
    mesh.castShadow = mesh.receiveShadow = true;
    return addItem({ type: 'pipe', mat: 'metal', w: 2, body: b, mesh, sizeClass: 1, dentR: 0.14, dentMax: 0.04 });
  };

  // ------------------------------------------------------------ removal, waking
  // anchored = asleep with allowSleep off: behaves like a glued, static part of the structure until
  // it is hit (release) or loses its support. Keeps structures standing; only what you hit comes down.
  function release(it) {
    if (!it.anchored || it.dead) return;
    it.anchored = false;
    const b = it.body;
    b.allowSleep = true;
    if (b.world) b.wakeUp();
  }
  K.release = release;
  K.anchor = (it) => {
    const b = it.body;
    b.updateAABB();
    const l = b.aabb.lowerBound, u = b.aabb.upperBound;
    it.box = { lx: l.x, ly: l.y, lz: l.z, ux: u.x, uy: u.y, uz: u.z };
    b.sleep();
    b.allowSleep = false;
    it.anchored = true;
    it.supportFreed = false;
  };
  function freeAbove(it) {
    if (it.supportFreed || !it.box) return;
    it.supportFreed = true;
    const a = it.box, I = G.items;
    for (let i = 0; i < I.length; i++) {
      const o = I[i];
      if (o.dead || !o.anchored || o === it) continue;
      const c = o.box;
      if (c.ly > a.uy - 0.06 && c.ly < a.uy + 0.06 && c.lx < a.ux - 0.01 && c.ux > a.lx + 0.01 && c.lz < a.uz - 0.01 && c.uz > a.lz + 0.01) release(o);
    }
  }
  K.freeAbove = freeAbove;

  // Support check: no sleeping (or anchored) body may hang in the air. A body counts as supported when
  // its AABB bottom touches the ground or the top of another body that overlaps it in x/z.
  const SUP = [];
  function aabbOf(b) { if (b.aabbNeedsUpdate) b.updateAABB(); return b.aabb; }
  K.checkSupport = () => {
    const B = world.bodies;
    SUP.length = 0;
    for (let i = 0; i < B.length; i++) if (B[i].type !== CANNON.Body.STATIC) SUP.push(B[i]);
    let woke = 0;
    for (let i = 0; i < SUP.length; i++) {
      const b = SUP[i];
      if (b.sleepState !== CANNON.Body.SLEEPING) continue;
      const a = aabbOf(b), bot = a.lowerBound.y;
      if (bot < 0.05) continue;
      let ok = false;
      for (let j = 0; j < SUP.length && !ok; j++) {
        if (j === i) continue;
        const c = aabbOf(SUP[j]);
        if (c.upperBound.y > bot - 0.06 && c.lowerBound.y < bot - 0.005 &&
          c.lowerBound.x < a.upperBound.x - 0.015 && c.upperBound.x > a.lowerBound.x + 0.015 &&
          c.lowerBound.z < a.upperBound.z - 0.015 && c.upperBound.z > a.lowerBound.z + 0.015) ok = true;
      }
      if (!ok) {
        woke++;
        if (b.item && b.item.anchored) release(b.item);
        else b.wakeUp();
      }
    }
    return woke;
  };
  function wakeNear(x, y, z, r) {
    const r2 = r * r, I = G.items;
    for (let i = 0; i < I.length; i++) {
      const it = I[i];
      if (it.dead || it.anchored) continue;
      const b = it.body;
      if (b.sleepState === CANNON.Body.SLEEPING && b.world) {
        const dx = b.position.x - x, dy = b.position.y - y, dz = b.position.z - z;
        if (dx * dx + dy * dy + dz * dz < r2) b.wakeUp();
      }
    }
  }
  function removeItem(it, wakeR = 0.8) {
    if (it.dead) return;
    it.dead = true;
    const b = it.body;
    if (b.world) world.removeBody(b);
    if (it.h) it.h.g.remove(it.h);
    if (it.mesh) { scene.remove(it.mesh); (it.shell || it.mesh).geometry.dispose(); }
    it.anchored = false;
    freeAbove(it);
    wakeNear(b.position.x, b.position.y, b.position.z, wakeR);
    G.supportDirty = true;
    if (!it.counted) G.smash(it);
  }
  K.removeItem = removeItem;
  K.wakeNear = wakeNear;

  // ------------------------------------------------------------ debris: pooled bodies keyed by box size
  const dpool = new Map();
  G.debris = [];
  function getDebris(key, hx, hy, hz, mass) {
    let arr = dpool.get(key);
    if (!arr) dpool.set(key, (arr = []));
    if (arr.length) return arr.pop();
    const b = mkBody(mass, new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), 0, -50, 0, null, G.pm.debris || G.pm.gen, GR.DEBRIS);
    b.sleepSpeedLimit = 0.6;
    b.sleepTimeLimit = 0.6;
    b.linearDamping = 0.08;
    b.angularDamping = 0.25;
    const d = { body: b, key, h: { body: b, scale: new THREE.Vector3(), color: new THREE.Color(), yo: 0, k: 1, i: -1 }, life: 0, kind: '', lastSnd: -1, gone: true };
    b.deb = d;
    b.addEventListener('collide', G.onCollide);
    return d;
  }
  K.prewarmDebris = () => {
    // pre-create the common rubble / plank bodies so the first big smash allocates nothing
    const tmp = [];
    for (const [nx, ny] of [[2, 1], [2, 2], [3, 1], [3, 2]]) for (let i = 0; i < 12; i++) tmp.push(getDebrisFor('chunk', BL / nx, BH / ny, BD));
    for (const s of [0.42, 0.52]) for (let i = 0; i < 12; i++) tmp.push(getDebrisFor('plank', s, 0, 0));
    for (const d of tmp) dpool.get(d.key).push(d);
  };
  function getDebrisFor(kind, a, b, c) {
    if (kind === 'chunk') {
      const hx = Math.max(0.035, a * 0.42), hy = Math.max(0.035, b * 0.42), hz = Math.max(0.035, c * 0.38);
      return getDebris('c' + hx.toFixed(3) + ',' + hy.toFixed(3), hx, hy, hz, Math.max(0.25, (2 * a * b) / (BL * BH)));
    }
    if (kind === 'plank') return getDebris('p' + a.toFixed(2), a * 0.45, a * 0.21, 0.03, 0.5);
    return getDebris('b' + a.toFixed(2) + ',' + b.toFixed(3) + ',' + c.toFixed(3), a / 2, Math.max(0.03, b / 2), Math.max(0.03, c / 2), Math.max(0.5, a * 1.6));
  }
  function spawnDebris(d, group, x, y, z, q, sx, sy, sz, color, vx, vy, vz, life, kind) {
    if (group.full) {
      const D = G.debris;
      for (let i = 0; i < D.length; i++) if (!D[i].gone && D[i].h.g === group) { G.killDebris(D[i], true); break; }
      if (group.full) { dpool.get(d.key).push(d); return; }
    }
    const b = d.body;
    b.position.set(x, Math.max(y, 0.045), z);
    b.quaternion.set(q.x, q.y, q.z, q.w);
    syncInterp(b);
    b.velocity.set(vx, vy, vz);
    b.angularVelocity.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
    b.force.setZero(); b.torque.setZero();
    b.collisionFilterMask = ALL;
    d.h.scale.set(sx, sy, sz);
    d.h.color.copy(color);
    d.h.k = 1; d.h.yo = 0;
    group.add(d.h);
    d.life = life; d.kind = kind; d.gone = false; d.lastSnd = -1;
    world.addBody(b);
    b.wakeUp();
    if (!d.inList) { d.inList = true; G.debris.push(d); }
  }
  G.releaseDebris = (d) => {
    if (d.mesh) { scene.remove(d.mesh); d.mesh = null; }
    const arr = dpool.get(d.key);
    if (arr && arr.length < 60) arr.push(d);
  };
  // detached appliance parts: pooled bodies keyed by part, the part's own mesh as visual; capped at 36
  K.spawnPart = (key, hx, hy, hz, mass, mesh, pos, quat, vx, vy, vz, life, kind = 'part') => {
    let live = 0, oldest = null;
    for (const d of G.debris) if (!d.gone && d.mesh) { live++; if (!oldest) oldest = d; }
    if (live >= 36 && oldest) G.killDebris(oldest, true);
    const d = getDebris('m' + key, hx, hy, hz, mass);
    d.h = null;
    const b = d.body;
    b.position.set(pos.x, Math.max(pos.y, hy + 0.01), pos.z);
    b.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    syncInterp(b);
    b.velocity.set(vx, vy, vz);
    b.angularVelocity.set(rnd(-7, 7), rnd(-7, 7), rnd(-7, 7));
    b.force.setZero(); b.torque.setZero();
    // ignore the parent object (and other parts) for a moment: parts spawn touching the body they left
    b.collisionFilterMask = GR.GROUND | GR.PROJ;
    d.maskT = 0.3;
    b.material = G.pm.metal;
    d.mesh = mesh;
    d.s0 = d.s0 || new THREE.Vector3();
    d.s0.copy(mesh.scale);
    mesh.position.copy(pos); mesh.quaternion.copy(quat);
    scene.add(mesh);
    d.life = life; d.kind = kind; d.gone = false; d.lastSnd = -1;
    world.addBody(b);
    b.wakeUp();
    if (!d.inList) { d.inList = true; G.debris.push(d); }
    return d;
  };
  K.dent = (...a) => dent(...a);
  K.sparks = (...a) => sparks(...a);

  // ------------------------------------------------------------ particle helpers
  const dust = (x, y, z, n, r, g, b, size = 0.35, spread = 1) => {
    for (let i = 0; i < n; i++) G.dust.emit(x + rnd(-0.1, 0.1) * spread, y + rnd(-0.05, 0.1), z + rnd(-0.1, 0.1) * spread, rnd(-1, 1) * spread, rnd(0.1, 1.1), rnd(-1, 1) * spread, rnd(0.8, 1.6), size * rnd(0.6, 1.1), r, g, b, -0.35, 2.5, size * 1.8, 0.6, 0, rnd(-1, 1));
  };
  const glints = (x, y, z, n, spread = 0.5) => {
    for (let i = 0; i < n; i++) G.glint.emit(x + rnd(-spread, spread), y + rnd(-spread, spread), z + rnd(-0.1, 0.1), rnd(-1.5, 1.5), rnd(-0.5, 2), rnd(-1, 1.5), rnd(0.25, 0.6), rnd(0.08, 0.2), 0.85, 0.95, 1, 2.5, 1.5, 0, 1, 0, rnd(-3, 3));
  };
  const sparks = (x, y, z, n, nx, ny, nz) => {
    for (let i = 0; i < n; i++) G.spark.emit(x, y, z, -nx * rnd(1, 4) + rnd(-3, 3), -ny * rnd(1, 4) + rnd(0, 3.5), -nz * rnd(1, 4) + rnd(-3, 3), rnd(0.2, 0.5), rnd(0.02, 0.035), 1, rnd(0.55, 0.8), 0.25, 9, 0.6, 0, 1, 0.025);
  };
  const splinters = (x, y, z, n) => {
    for (let i = 0; i < n; i++) G.spark.emit(x, y, z, rnd(-3, 3), rnd(0, 4), rnd(-3, 3), rnd(0.4, 0.8), rnd(0.015, 0.025), 0.35, 0.22, 0.1, 9, 0.5, 0, 1, 0.02);
  };
  K.dust = dust; K.glints = glints;
  G.glintAt = (x, y, z) => G.glint.emit(x, y, z, 0, 0.2, 0, rnd(0.15, 0.3), rnd(0.06, 0.12), 0.9, 0.97, 1, 0, 0, 0, 0.9, 0, rnd(-4, 4));

  // ------------------------------------------------------------ GLASS: panes shatter into triangular shards
  const ANG = new Float32Array(16), PX = new Float32Array(16 * 3), PY = new Float32Array(16 * 3);
  function shard(cx, cy, ax, ay, bx, by, ccx, ccy, t, bq, bp, bv, ix, iy, dx, dy, dz, dl, pw, color) {
    // triangle (a,b,c) given relative to centroid (cx,cy) in pane space
    let e1x = bx - ax, e1y = by - ay, e2x = ccx - ax, e2y = ccy - ay;
    if (e1x * e2y - e1y * e2x < 0) { let s = e1x; e1x = e2x; e2x = s; s = e1y; e1y = e2y; e2y = s; }
    if (Math.abs(e1x * e2y - e1y * e2x) < 0.0008) return;
    const s = G.shards.alloc();
    s.L.set(e1x, e2x, 0, 0, e1y, e2y, 0, 0, 0, 0, t, 0, 0, 0, 0, 1);
    s.p.set(cx, cy, 0).applyQuaternion(bq).add(bp);
    s.q.copy(bq);
    const dist = Math.hypot(cx - ix, cy - iy);
    const f = (pw * 0.35 * rnd(0.4, 1)) / (1 + dist * 4);
    s.v.set(bv.x + (dx / dl) * f + rnd(-1, 1) * (0.4 + f * 0.25), bv.y + (dy / dl) * f + rnd(-0.5, 1.5) * (0.3 + f * 0.2), bv.z + (dz / dl) * f + rnd(-1, 1) * (0.4 + f * 0.25));
    const spin = (2 + f) * 2;
    s.w.set(rnd(-spin, spin), rnd(-spin, spin), rnd(-spin, spin));
    s.color.copy(color);
    s.life = rnd(2.4, 4);
  }
  // shatter any glass rectangle (w x hh x t, centred at bp with rotation bq) into triangular shards
  function shatterRect(bp, bq, w, hh, t, bv, color, px, py, pz, dx, dy, dz, power) {
    const lp = _v.set(px, py, pz).sub(bp).applyQuaternion(_q2.copy(bq).invert());
    const ix = clamp(lp.x, -w * 0.45, w * 0.45), iy = clamp(lp.y, -hh * 0.45, hh * 0.45);
    let n = 0;
    ANG[n++] = Math.atan2(hh / 2 - iy, w / 2 - ix); ANG[n++] = Math.atan2(hh / 2 - iy, -w / 2 - ix);
    ANG[n++] = Math.atan2(-hh / 2 - iy, -w / 2 - ix); ANG[n++] = Math.atan2(-hh / 2 - iy, w / 2 - ix);
    const nr = (w * hh < 0.08 ? 3 : 5) + ((Math.random() * 4) | 0), base = Math.random() * 6.283;
    for (let k = 0; k < nr; k++) ANG[n++] = base + (k * 6.283) / nr + rnd(-0.25, 0.25);
    for (let i = 0; i < n; i++) ANG[i] = ((ANG[i] % 6.2832) + 6.2832) % 6.2832;
    const A = ANG.subarray(0, n).sort();
    const r0 = rnd(0.12, 0.22), r1 = rnd(0.38, 0.55);
    for (let i = 0; i < n; i++) {
      const cx = Math.cos(A[i]), cy = Math.sin(A[i]);
      const tx = cx > 1e-6 ? (w / 2 - ix) / cx : cx < -1e-6 ? (-w / 2 - ix) / cx : 1e9;
      const ty = cy > 1e-6 ? (hh / 2 - iy) / cy : cy < -1e-6 ? (-hh / 2 - iy) / cy : 1e9;
      const D = Math.min(tx, ty);
      const f0 = r0 * rnd(0.85, 1.15), f1 = r1 * rnd(0.85, 1.15);
      PX[i * 3] = ix + cx * D * f0; PY[i * 3] = iy + cy * D * f0;
      PX[i * 3 + 1] = ix + cx * D * f1; PY[i * 3 + 1] = iy + cy * D * f1;
      PX[i * 3 + 2] = ix + cx * D; PY[i * 3 + 2] = iy + cy * D;
    }
    const pw = Math.min(power, 30), dl = Math.hypot(dx, dy, dz) || 1;
    const tri = (ax, ay, bx, by, cx, cy) => {
      const gx = (ax + bx + cx) / 3, gy = (ay + by + cy) / 3;
      shard(gx, gy, ax - gx, ay - gy, bx - gx, by - gy, cx - gx, cy - gy, t, bq, bp, bv, ix, iy, dx, dy, dz, dl, pw, color);
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tri(ix, iy, PX[i * 3], PY[i * 3], PX[j * 3], PY[j * 3]);
      for (let k = 0; k < 2; k++) {
        const a = i * 3 + k, bb = j * 3 + k, c = j * 3 + k + 1, d = i * 3 + k + 1;
        if (Math.random() < 0.5) { tri(PX[a], PY[a], PX[bb], PY[bb], PX[c], PY[c]); tri(PX[a], PY[a], PX[c], PY[c], PX[d], PY[d]); }
        else { tri(PX[a], PY[a], PX[bb], PY[bb], PX[d], PY[d]); tri(PX[bb], PY[bb], PX[c], PY[c], PX[d], PY[d]); }
      }
    }
    const ip = _v.set(ix, iy, 0).applyQuaternion(bq).add(bp);
    glints(ip.x, ip.y, ip.z, 12, 0.1);
    glints(bp.x, bp.y, bp.z, 6, Math.max(w, hh) * 0.4);
    dust(ip.x, ip.y, ip.z, 2, 0.92, 0.97, 1, 0.22, 0.8);
    sfx.glassBreak(power);
  }
  K.shatterRect = shatterRect;
  const _bp = new THREE.Vector3(), _bq = new THREE.Quaternion();
  function shatterPane(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body;
    _bq.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    _bp.set(b.position.x, b.position.y, b.position.z);
    shatterRect(_bp, _bq, it.size.x, it.size.y, it.size.z, b.velocity, it.color, px, py, pz, dx, dy, dz, power);
    removeItem(it, Math.max(it.size.x, it.size.y) * 0.6 + 0.3);
  }
  function shatterBottle(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body, bq = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const n = 16 + ((Math.random() * 8) | 0), pw = Math.min(power, 25), dl = Math.hypot(dx, dy, dz) || 1;
    for (let i = 0; i < n; i++) {
      const th = Math.random() * 6.283, yy = rnd(-BOTTLE_H / 2, BOTTLE_H * 0.3);
      const r = yy > 0.03 ? 0.04 : BOTTLE_R;
      const nrm = _v.set(Math.cos(th), 0, Math.sin(th)).applyQuaternion(bq);
      const s = G.shards.alloc();
      s.p.set(Math.cos(th) * r, yy, Math.sin(th) * r).applyQuaternion(bq);
      s.p.x += b.position.x; s.p.y += b.position.y; s.p.z += b.position.z;
      const sz = rnd(0.03, 0.075);
      let e1x = sz, e1y = rnd(-0.3, 0.3) * sz, e2x = rnd(0, 0.6) * sz, e2y = sz;
      s.L.set(e1x, e2x, 0, 0, e1y, e2y, 0, 0, 0, 0, 0.006, 0, 0, 0, 0, 1);
      s.q.setFromUnitVectors(ZAX, nrm).multiply(_q2.setFromAxisAngle(ZAX, Math.random() * 6.283));
      const out = rnd(1, 2.5) + pw * 0.08;
      s.v.set(nrm.x * out + (dx / dl) * pw * 0.12, rnd(0.5, 2.5) + (dy / dl) * pw * 0.1, nrm.z * out + (dz / dl) * pw * 0.12);
      s.w.set(rnd(-20, 20), rnd(-20, 20), rnd(-20, 20));
      s.color.copy(it.color);
      s.life = rnd(2, 3.5);
    }
    glints(b.position.x, b.position.y, b.position.z, 8, 0.12);
    sfx.bottle(power);
    removeItem(it, 0.5);
  }

  // ------------------------------------------------------------ BRICK: crumbles into 2-6 chunks + dust
  function crumbleBrick(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body, s = it.size, bq = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const nx = s.x > 0.25 ? 2 + (Math.random() < 0.5 ? 1 : 0) : 1, ny = Math.random() < 0.6 ? 2 : 1;
    const cw = s.x / nx, ch = s.y / ny, dl = Math.hypot(dx, dy, dz) || 1, pw = Math.min(power, 40);
    _c.copy(it.color).multiplyScalar(0.92);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const ox = -s.x / 2 + cw * (i + 0.5), oy = -s.y / 2 + ch * (j + 0.5);
      const wp = _v.set(ox, oy, 0).applyQuaternion(bq);
      const f = pw * 0.12 * rnd(0.3, 1);
      _e.set(rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(-0.4, 0.4));
      _q2.copy(bq).multiply(_q3.setFromEuler(_e));
      const d = getDebrisFor('chunk', cw, ch, s.z);
      spawnDebris(d, Gp.chunk, b.position.x + wp.x, b.position.y + wp.y, b.position.z + wp.z, _q2,
        cw * rnd(0.85, 1), ch * rnd(0.85, 1), s.z * rnd(0.75, 0.95), _c,
        b.velocity.x + (dx / dl) * f + wp.x * 8 * rnd(0.3, 1), b.velocity.y + (dy / dl) * f + rnd(0.5, 2.5), b.velocity.z + (dz / dl) * f + wp.z * 8, rnd(4, 6.5), 'chunk');
    }
    dust(b.position.x, b.position.y, b.position.z, 8, 0.8, 0.6, 0.48, 0.34);
    dust(b.position.x, b.position.y, b.position.z, 4, 0.93, 0.85, 0.75, 0.24, 0.6);
    sfx.crumble(power);
    removeItem(it, 0.6);
  }

  // ------------------------------------------------------------ WOOD: crates splinter into planks, boards snap
  const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const _nrm = new THREE.Vector3(), _tang = new THREE.Vector3(), _off = new THREE.Vector3();
  const PLANK_COL = new THREE.Color(0xe7b98a);
  function splinterCrate(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body, s = it.size.x, bq = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const dl = Math.hypot(dx, dy, dz) || 1, pw = Math.min(power, 35);
    for (const f of FACES) for (let half = -1; half <= 1; half += 2) {
      if (Math.random() < 0.35) continue;
      _nrm.set(f[0], f[1], f[2]);
      if (f[1]) _tang.set(0, 0, 1); else _tang.set(0, 1, 0);
      _off.copy(_nrm).multiplyScalar(s / 2 - 0.02).addScaledVector(_tang, (half * s) / 4).applyQuaternion(bq);
      _q2.setFromUnitVectors(ZAX, _nrm);
      _q3.copy(bq).multiply(_q2);
      _nrm.applyQuaternion(bq);
      const out = rnd(1, 3) + pw * 0.06;
      _c.copy(PLANK_COL).multiplyScalar(rnd(0.85, 1));
      const d = getDebrisFor('plank', s, 0, 0);
      spawnDebris(d, Gp.plank, b.position.x + _off.x, b.position.y + _off.y, b.position.z + _off.z, _q3, s * 0.96, s * 0.46, 0.04, _c,
        b.velocity.x + _nrm.x * out + (dx / dl) * pw * 0.1, b.velocity.y + _nrm.y * out + rnd(1, 3), b.velocity.z + _nrm.z * out + (dz / dl) * pw * 0.1, rnd(4, 6), 'plank');
    }
    dust(b.position.x, b.position.y, b.position.z, 7, 0.82, 0.68, 0.5, 0.36, 1.3);
    splinters(b.position.x, b.position.y, b.position.z, 16);
    sfx.splinter(power);
    removeItem(it, s + 0.3);
  }
  function snapBoard(it, px, py, pz, dx, dy, dz, power) {
    const b = it.body, s = it.size, bq = _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const lp = _v.set(px - b.position.x, py - b.position.y, pz - b.position.z).applyQuaternion(_q2.copy(bq).invert());
    const cut = Math.round(clamp(lp.x, -s.x / 2 + 0.2, s.x / 2 - 0.2) * 5) / 5;
    const dl = Math.hypot(dx, dy, dz) || 1, pw = Math.min(power, 35);
    for (let side = 0; side < 2; side++) {
      const a = side ? cut : -s.x / 2, c = side ? s.x / 2 : cut;
      const len = c - a, mid = (a + c) / 2;
      if (len < 0.08) continue;
      const wp = _v.set(mid, 0, 0).applyQuaternion(bq);
      _e.set(0, 0, (side ? 1 : -1) * 0.15);
      _q2.copy(bq).multiply(_q3.setFromEuler(_e));
      const d = getDebrisFor('board', len, s.y, s.z);
      spawnDebris(d, Gp.plank, b.position.x + wp.x, b.position.y + wp.y, b.position.z + wp.z, _q2, len, s.y, s.z, it.h.color,
        b.velocity.x + (dx / dl) * pw * 0.08, b.velocity.y + (dy / dl) * pw * 0.08 + 1, b.velocity.z + (dz / dl) * pw * 0.08, rnd(5, 7), 'plank');
    }
    const cp = _v.set(cut, 0, 0).applyQuaternion(bq);
    splinters(b.position.x + cp.x, b.position.y + cp.y, b.position.z + cp.z, 14);
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
    release(it);
    b.wakeUp();
    b.velocity.x += (dx / dl) * pw; b.velocity.y += 1.5 + Math.random() * 2; b.velocity.z += (dz / dl) * pw;
    b.angularVelocity.set(rnd(-15, 15), rnd(-15, 15), rnd(-15, 15));
    sfx.crunch(power);
    if (!it.counted) G.smash(it);
  }

  // ------------------------------------------------------------ collisions -> ring buffer of hits
  const HMAX = 256;
  G.hitBuf = [];
  for (let i = 0; i < HMAX; i++) G.hitBuf.push({ body: null, other: null, v: 0, px: 0, py: 0, pz: 0, nx: 0, ny: 0, nz: 0 });
  G.hitN = 0;
  G.onCollide = function (e) {
    const self = e.target, other = e.body, c = e.contact;
    const v = Math.abs(c.getImpactVelocityAlongNormal());
    if (!(v >= 0.7) || v > 200 || G.hitN >= HMAX) return;
    const isI = c.bi === self, r = isI ? c.ri : c.rj, s = isI ? -1 : 1;
    const si = self.item;
    if (si && si.anchored && (other.proj || (v > 2.5 && other.type !== CANNON.Body.STATIC && other.sleepState !== CANNON.Body.SLEEPING))) {
      // released inside the narrowphase: the solver of this very step already treats it as dynamic
      si.anchored = false; self.allowSleep = true; self.wakeUpAfterNarrowphase = true;
    }
    if (self.proj && other.item && other.item.mat === 'glass') self.proj.pass = true;
    const h = G.hitBuf[G.hitN++];
    h.body = self; h.other = other; h.v = v;
    h.px = self.position.x + r.x; h.py = self.position.y + r.y; h.pz = self.position.z + r.z;
    h.nx = c.ni.x * s; h.ny = c.ni.y * s; h.nz = c.ni.z * s;
  };

  // break queue: fixed ring
  const QMAX = 128;
  const BQ = [];
  for (let i = 0; i < QMAX; i++) BQ.push({ it: null, px: 0, py: 0, pz: 0, dx: 0, dy: 0, dz: 0, power: 0 });
  let qh = 0, qn = 0;
  function queueBreak(it, px, py, pz, nx, ny, nz, power) {
    if (it.pending || it.dead || qn >= QMAX) return;
    it.pending = true;
    const e = BQ[(qh + qn++) % QMAX];
    e.it = it; e.px = px; e.py = py; e.pz = pz; e.dx = nx; e.dy = ny; e.dz = nz; e.power = power;
  }
  G.clearBreaks = () => { for (let i = 0; i < qn; i++) BQ[(qh + i) % QMAX].it = null; qn = 0; };

  function impact(it, h) {
    const o = h.other, om = o.type === CANNON.Body.STATIC ? 0 : o.mass;
    const force = om > 0 ? h.v * Math.sqrt(Math.min(om, 24) / 2) : h.v * 0.8;
    const p = o.proj;
    const snd = G.time - it.lastSnd > 0.07;
    switch (it.type) {
      case 'pane':
        if (h.v > 2.0 || (p && h.v > 1.2)) queueBreak(it, h.px, h.py, h.pz, h.nx, h.ny, h.nz, Math.max(force, h.v * 2));
        else if (snd && h.v > 1) { it.lastSnd = G.time; sfx.glassTink(h.v); }
        return;
      case 'bottle':
        if (h.v > 2.4 || (p && h.v > 1.2)) queueBreak(it, h.px, h.py, h.pz, h.nx, h.ny, h.nz, Math.max(force, h.v * 2));
        else if (snd && h.v > 1) { it.lastSnd = G.time; sfx.glassTink(h.v * 0.7); }
        return;
      case 'brick':
        if (p ? force > 11 && p.budget > 0 : force > 15 && Math.random() < 0.35) {
          if (p) p.budget--;
          queueBreak(it, h.px, h.py, h.pz, h.nx, h.ny, h.nz, force);
        } else if (snd && h.v > 1.2) { it.lastSnd = G.time; sfx.brick(h.v); }
        return;
      case 'crate':
        if (force > 13 && (p ? p.budget > 0 : Math.random() < 0.3)) { if (p) p.budget -= 2; queueBreak(it, h.px, h.py, h.pz, h.nx, h.ny, h.nz, force); }
        else if (snd && h.v > 1.2) { it.lastSnd = G.time; sfx.wood(h.v); }
        return;
      case 'board':
        if (force > 17 && it.size.x > 0.6 && p) queueBreak(it, h.px, h.py, h.pz, h.nx, h.ny, h.nz, force);
        else if (snd && h.v > 1.2) { it.lastSnd = G.time; sfx.wood(h.v); }
        return;
    }
    if (it.type === 'appliance') { G.applianceHit(it, h, force, p, snd); return; }
    if (it.mat === 'metal') {
      if (snd && h.v > 1) { it.lastSnd = G.time; sfx.metal(h.v * (om > 0 ? 1 : 0.7), it.sizeClass); }
      if (it.type === 'can' && force > 7) { crumpleCan(it, force, -h.nx, -h.ny, -h.nz); return; }
      if (force > 3.5 && G.time - it.lastDent > 0.04 && it.dentSum < 0.6) {
        it.lastDent = G.time;
        dent(it, h.px, h.py, h.pz, h.nx, h.ny, h.nz, clamp((force - 3) * 0.006, 0.006, it.dentMax));
        if (it.dentSum > 0.08 && !it.counted) G.smash(it);
      }
      if (force > 9) sparks(h.px, h.py, h.pz, Math.min(14, (force / 3) | 0), h.nx, h.ny, h.nz);
    }
  }
  function debHit(d, h) {
    if (d.gone || h.v < 2.2 || G.time - d.lastSnd < 0.1) return;
    d.lastSnd = G.time;
    if (d.kind === 'chunk') sfx.brick(h.v * 0.45); else if (d.kind === 'part') sfx.metal(h.v * 0.6, 0); else sfx.wood(h.v * 0.5);
  }
  function projHit(p, h) {
    if (p.dead) return;
    if (p.kind === 'bomb') { if (p.age > 0.03) G.explode(p); return; }
    const oit = h.other.item;
    const heavy = p.mass * h.v;
    if (oit && !p.hit && h.v > 5) {
      p.hit = true;
      if (heavy > 60) G.impactFx(Math.min(1, heavy / 600), h.px, h.py, h.pz);
    }
    if (G.time - p.lastSnd > 0.08 && h.v > 1.5 && !(oit && oit.mat === 'glass')) {
      p.lastSnd = G.time;
      if (p.kind === 'brick') sfx.brick(h.v);
      else if (p.kind === 'anvil') { sfx.metal(h.v, 2); sfx.thud(h.v, true); }
      else sfx.thud(h.v, p.kind === 'bowling');
    }
  }
  G.processHits = () => {
    const H = G.hitBuf, n = G.hitN;
    for (let i = 0; i < n; i++) {
      const h = H[i], b = h.body;
      if (b.proj) projHit(b.proj, h);
      else if (b.item) { if (!b.item.dead) impact(b.item, h); }
      else if (b.deb) debHit(b.deb, h);
      h.body = h.other = null;
    }
    G.hitN = 0;
  };
  const BREAK = { pane: shatterPane, bottle: shatterBottle, brick: crumbleBrick, crate: splinterCrate, board: snapBoard };
  G.processBreaks = (maxN = 6) => {
    let n = 0;
    while (qn > 0 && n < maxN) {
      const e = BQ[qh];
      qh = (qh + 1) % QMAX; qn--;
      const it = e.it;
      e.it = null;
      if (!it || it.dead) continue;
      n++;
      const f = BREAK[it.type];
      if (f) f(it, e.px, e.py, e.pz, e.dx, e.dy, e.dz, e.power);
    }
  };

  // ------------------------------------------------------------ projectiles (pooled per kind)
  const sphere = new THREE.SphereGeometry(1, 28, 18);
  const holeGeo = new THREE.CircleGeometry(0.028, 12);
  const fuseGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8);
  const hornGeo = new THREE.ConeGeometry(0.11, 0.26, 12);
  K.projMesh = (kind) => {
    let m;
    if (kind === 'ball') { m = new THREE.Mesh(sphere, M.ball); m.scale.setScalar(0.2); }
    else if (kind === 'bowling') {
      m = new THREE.Group();
      const s = new THREE.Mesh(sphere, M.bowl); s.scale.setScalar(0.22); s.castShadow = true; m.add(s);
      [[0, 0.07], [0.05, 0.11], [-0.05, 0.11]].forEach(([x, y]) => { const hm = new THREE.Mesh(holeGeo, M.hole); const p = new THREE.Vector3(x, y, 0.2).normalize().multiplyScalar(0.2205); hm.position.copy(p); hm.lookAt(p.clone().multiplyScalar(2)); m.add(hm); });
    } else if (kind === 'brick') { m = new THREE.Mesh(box, M.projBrick); m.scale.set(BL, BH, BD); }
    else if (kind === 'anvil') {
      m = new THREE.Group();
      const add = (sx, sy, sz, x, y) => { const b = new THREE.Mesh(box, M.dark); b.scale.set(sx, sy, sz); b.position.set(x, y, 0); b.castShadow = true; m.add(b); };
      add(0.5, 0.1, 0.28, 0, -0.13); add(0.26, 0.14, 0.18, 0, -0.01); add(0.56, 0.14, 0.26, 0.04, 0.13);
      const horn = new THREE.Mesh(hornGeo, M.dark); horn.rotation.z = Math.PI / 2; horn.position.set(-0.37, 0.15, 0); horn.castShadow = true; m.add(horn);
    } else {
      m = new THREE.Group();
      const s = new THREE.Mesh(sphere, M.bomb); s.scale.setScalar(0.18); s.castShadow = true; m.add(s);
      const f = new THREE.Mesh(fuseGeo, M.steel); f.position.y = 0.2; m.add(f);
    }
    m.castShadow = true;
    return m;
  };
  const ppool = { ball: [], brick: [], bowling: [], anvil: [], bomb: [] };
  function makeProj(kind) {
    const D = PROJ[kind];
    const b = mkBody(D.mass, null, 0, -50, 0, null, G.pm.proj, GR.PROJ);
    if (kind === 'anvil') {
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.25, 0.05, 0.14)), new CANNON.Vec3(0, -0.13, 0));
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.13, 0.07, 0.09)), new CANNON.Vec3(0, -0.01, 0));
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.3, 0.07, 0.13)), new CANNON.Vec3(-0.02, 0.13, 0));
      b.updateMassProperties();
    } else if (kind === 'brick') b.addShape(new CANNON.Box(new CANNON.Vec3(BL / 2, BH / 2, BD / 2)));
    else b.addShape(new CANNON.Sphere(D.r));
    b.linearDamping = 0.01;
    b.sleepSpeedLimit = 0.3;
    b.sleepTimeLimit = 0.6;
    const mesh = K.projMesh(kind);
    const p = { kind, body: b, mesh, mass: D.mass, age: 0, life: 0, hit: false, lastSnd: -1, dead: true, pre: new CANNON.Vec3(), pass: false, budget: 0, s0: mesh.scale.clone() };
    b.proj = p;
    b.addEventListener('collide', G.onCollide);
    return p;
  }
  K.prewarmProj = () => { for (const k in ppool) for (let i = 0; i < 3; i++) ppool[k].push(makeProj(k)); };
  G.releaseProj = (p) => { scene.remove(p.mesh); p.mesh.scale.copy(p.s0); ppool[p.kind].push(p); };
  K.throwProj = (kind, from, vel) => {
    let live = 0, old = null;
    for (const q of G.projs) if (!q.dead) { live++; if (!old) old = q; }
    if (live >= 8 && old) G.killProj(old, false);
    const p = ppool[kind].pop() || makeProj(kind);
    const b = p.body;
    b.position.set(from.x, from.y, from.z);
    b.quaternion.set(0, 0, 0, 1);
    syncInterp(b);
    b.velocity.set(vel.x, vel.y, vel.z);
    b.force.setZero(); b.torque.setZero();
    const sp = vel.length();
    b.angularVelocity.set(-sp * (kind === 'anvil' ? 0.15 : 0.45) + rnd(-2, 2), rnd(-3, 3), rnd(-2, 2));
    b.collisionFilterMask = ALL;
    p.mesh.position.copy(from);
    p.mesh.quaternion.identity();
    p.mesh.scale.copy(p.s0);
    scene.add(p.mesh);
    p.age = 0; p.life = kind === 'bomb' ? 2.4 : 7; p.hit = false; p.lastSnd = -1; p.dead = false; p.pass = false;
    p.pre.copy(b.velocity); p.budget = PROJ[kind].budget;
    world.addBody(b);
    b.wakeUp();
    if (!p.inList) { p.inList = true; G.projs.push(p); }
    return p;
  };

  // ------------------------------------------------------------ BOMB (strong, but local)
  G.explode = (p) => {
    if (p.dead) return;
    const c = p.body.position, x = c.x, y = c.y, z = c.z;
    G.killProj(p, true);
    if (!Number.isFinite(x + y + z)) return;
    const R = 2.0;
    let brk = 0;
    const I = G.items;
    for (let i = 0; i < I.length; i++) {
      const it = I[i];
      if (it.dead || !it.body.world) continue;
      const b = it.body, dx = b.position.x - x, dy = b.position.y - y, dz = b.position.z - z, d = Math.hypot(dx, dy, dz);
      if (!(d <= R)) continue;
      const f = 1 - d / R, inv = 1 / Math.max(d, 0.05);
      const dv = 8.5 * f * Math.min(1, Math.sqrt(6 / b.mass));
      release(it);
      b.wakeUp();
      b.velocity.x += dx * inv * dv; b.velocity.y += dy * inv * dv + 2.5 * f; b.velocity.z += dz * inv * dv * (dz > 0 ? 0.3 : 1);
      b.angularVelocity.x += rnd(-6, 6) * f; b.angularVelocity.y += rnd(-6, 6) * f; b.angularVelocity.z += rnd(-6, 6) * f;
      const nx = dx * inv, ny = dy * inv, nz = dz * inv, hx = x + dx * 0.8, hy = y + dy * 0.8, hz = z + dz * 0.8;
      if (it.mat === 'glass' && d < 1.4) queueBreak(it, hx, hy, hz, nx, ny, nz, 20 * f + 6);
      else if (it.type === 'brick' && d < 0.8 && brk < 6) { brk++; queueBreak(it, hx, hy, hz, nx, ny, nz, 25 * f + 8); }
      else if (it.type === 'crate' && d < 0.95) queueBreak(it, hx, hy, hz, nx, ny, nz, 25);
      else if (it.type === 'can' && d < 1.0) crumpleCan(it, 20, nx, ny, nz);
      else if (it.type === 'appliance') G.applianceBlast(it, f, x, y, z);
      else if (it.mat === 'metal' && it.mesh) {
        const r0 = it.type === 'barrel' ? BARREL_R : 0.3;
        dent(it, b.position.x - nx * r0, b.position.y - ny * r0, b.position.z - nz * r0, nx, ny, nz, it.dentMax * f * 1.3);
        if (!it.counted && f > 0.35) G.smash(it);
      }
    }
    for (const d of G.debris) {
      if (d.gone) continue;
      const b = d.body, dx = b.position.x - x, dy = b.position.y - y, dz = b.position.z - z, dd = Math.hypot(dx, dy, dz);
      if (dd < R) { const f = ((1 - dd / R) * 8) / Math.max(dd, 0.05); b.wakeUp(); b.velocity.x += dx * f; b.velocity.y += dy * f + 2.5; b.velocity.z += dz * f * (dz > 0 ? 0.3 : 1); }
    }
    for (const q of G.projs) {
      if (q.dead) continue;
      const b = q.body, dx = b.position.x - x, dy = b.position.y - y, dz = b.position.z - z, dd = Math.hypot(dx, dy, dz);
      if (dd < R) { const f = (((1 - dd / R) * 8) / Math.max(dd, 0.05)) * Math.min(1, 6 / q.mass); b.wakeUp(); b.velocity.x += dx * f; b.velocity.y += dy * f + 2; b.velocity.z += dz * f; }
    }
    G.shards.push(x, y, z, R, 8);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * 6.283, e = rnd(-0.3, 1.2), s = rnd(3, 11);
      G.spark.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 1, Math.sin(a) * Math.cos(e) * s, rnd(0.25, 0.6), rnd(0.03, 0.06), 1, rnd(0.5, 0.8), rnd(0.15, 0.3), 5, 2.5, 0, 1, 0.035);
    }
    for (let i = 0; i < 10; i++) G.fire.emit(x + rnd(-0.2, 0.2), y + rnd(-0.1, 0.3), z + rnd(-0.2, 0.2), rnd(-2, 2), rnd(0.5, 2.5), rnd(-2, 2), rnd(0.2, 0.4), rnd(0.3, 0.55), 1, rnd(0.4, 0.6), 0.15, -1, 3, 0.5, 0.8, 0, rnd(-2, 2));
    for (let i = 0; i < 12; i++) G.dust.emit(x + rnd(-0.3, 0.3), y + rnd(0, 0.4), z + rnd(-0.3, 0.3), rnd(-1.5, 1.5), rnd(0.5, 2), rnd(-1.5, 1.5), rnd(1.2, 2), rnd(0.35, 0.6), 0.3, 0.29, 0.3, -0.5, 2.2, 0.9, 0.55, 0, rnd(-1, 1));
    G.flash(x, y, z);
    sfx.boom();
    G.impactFx(1, x, y, z, true);
  };

  return K;
}
