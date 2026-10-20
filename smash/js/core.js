// Game core: physics world, items, ammo, scene flow and timing. No DOM, no WebGL:
// it also runs in node for tuning / profiling (see dev/sim.mjs).
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Shards, Sprites } from './fx.js';
import { setupThings, GR, PROJ } from './things.js';
import { setupAppliances } from './appliances.js';
import { SCENES, SCENE_NAMES } from './scenes.js';

export const AMMO_START = { brick: 6, bowling: 3, anvil: 1, bomb: 1 };
export const AMMO_CAP = { brick: 12, bowling: 6, anvil: 3, bomb: 3 };
export const CLEAR_AT = 0.85;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const NOOP = () => {};

export function createCore({ scene, mats, sfx, hooks = {}, sprites = null }) {
  const H = { smash: NOOP, combo: NOOP, earn: NOOP, cleared: NOOP, impact: NOOP, flash: NOOP, ammo: NOOP, ...hooks };

  // ---------------------------------------------------------------- physics
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0), allowSleep: true });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 8;
  world.solver.tolerance = 0.001;
  world.quatNormalizeFast = true;
  world.quatNormalizeSkip = 2;
  const pm = { gen: new CANNON.Material('gen'), metal: new CANNON.Material('metal'), ground: new CANNON.Material('ground'), proj: new CANNON.Material('proj'), debris: new CANNON.Material('debris') };
  world.defaultContactMaterial.friction = 0.5;
  world.defaultContactMaterial.restitution = 0.08;
  const cm = (a, b, friction, restitution) => world.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction, restitution }));
  cm(pm.gen, pm.gen, 0.55, 0.05);
  cm(pm.gen, pm.ground, 0.6, 0.08);
  cm(pm.metal, pm.ground, 0.45, 0.3);
  cm(pm.metal, pm.gen, 0.4, 0.25);
  cm(pm.metal, pm.metal, 0.3, 0.35);
  cm(pm.proj, pm.ground, 0.5, 0.3);
  cm(pm.proj, pm.gen, 0.4, 0.15);
  cm(pm.proj, pm.metal, 0.3, 0.35);
  cm(pm.debris, pm.ground, 0.9, 0.05);
  cm(pm.debris, pm.gen, 0.7, 0.05);
  cm(pm.debris, pm.debris, 0.8, 0.02);
  const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: pm.ground, collisionFilterGroup: GR.GROUND, collisionFilterMask: 15 });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);

  // ---------------------------------------------------------------- state
  const G = {
    scene, world, sfx, pm, mats,
    items: [], metals: [], debris: [], projs: [], dying: [], newItems: [],
    totalW: 0, doneW: 0, count: 0, time: 0, rtime: 0,
    state: 'idle', sceneName: '', stateT: 0,
    ammo: { ...AMMO_START },
    hitstopT: 0, slowT: 0, slowDur: 1, lastSlow: -10,
    combo: 0, lastSmashT: -10, comboAward: 0, smashSinceBowl: 0, smashSinceBrick: 0,
    prof: { phys: 0, steps: 0 },
    tune: { sleepLimit: 0.7 },
  };
  const S = sprites || {};
  G.dust = S.dust || { emit: NOOP, update: NOOP };
  G.spark = S.spark || { emit: NOOP, update: NOOP };
  G.glint = S.glint || { emit: NOOP, update: NOOP };
  G.fire = S.fire || { emit: NOOP, update: NOOP };
  G.shards = new Shards(scene, mats.shard, 420);
  G.PROJ = PROJ;
  G.flash = (x, y, z) => H.flash(x, y, z);
  G.impactFx = (k, x, y, z, bomb = false) => {
    G.hitstopT = Math.max(G.hitstopT, bomb ? 0.07 : 0.02 + k * 0.06);
    if (bomb) slowmo(true);
    H.impact(k, x, y, z, bomb);
  };
  const K = setupThings(G);
  setupAppliances(G, K);
  G.K = K;
  G.shards.onGlint = (x, y, z) => G.glintAt(x, y, z);

  function slowmo(force) {
    if (!force && G.rtime - G.lastSlow < 3) return;
    G.lastSlow = G.rtime; G.slowDur = force ? 0.9 : 1.1; G.slowT = G.slowDur;
  }
  const recent = new Float64Array(32);
  let rn = 0;
  G.smash = (it) => {
    if (it.counted) return;
    it.counted = true;
    G.doneW += it.w;
    G.count++;
    const t = G.rtime;
    if (t - G.lastSmashT < 1.1) G.combo++; else { G.combo = 1; G.comboAward = 0; }
    G.lastSmashT = t;
    H.smash(it, G.count);
    if (G.combo >= 3) H.combo(G.combo, it.mat);
    // earn: every 15 smashes -> bowling ball, every 8 -> brick; combo x10 / x20 -> anvil or bomb
    if (++G.smashSinceBowl >= 15) { G.smashSinceBowl = 0; earn('bowling'); }
    if (++G.smashSinceBrick >= 8) { G.smashSinceBrick = 0; earn('brick'); }
    if ((G.combo >= 10 && G.comboAward === 0) || (G.combo >= 20 && G.comboAward === 1)) {
      G.comboAward++;
      earn(Math.random() < 0.5 ? 'bomb' : 'anvil');
    }
    recent[rn++ % 32] = t;
    let c = 0;
    for (let i = 0; i < 32; i++) if (t - recent[i] < 0.7) c++;
    if (c >= 12) slowmo(false);
  };
  function earn(kind) {
    if (G.ammo[kind] >= AMMO_CAP[kind]) return;
    G.ammo[kind]++;
    H.earn(kind);
    H.ammo();
  }

  // ---------------------------------------------------------------- lifetime helpers
  G.killDebris = (d, instant) => {
    if (d.gone) return;
    d.gone = true;
    if (d.body.world) world.removeBody(d.body);
    if (instant) { if (d.h) d.h.g.remove(d.h); G.releaseDebris(d); }
    else G.dying.push({ h: d.h, mesh: d.mesh, t: 0.35, deb: d, proj: null, geo: null, s0: d.mesh ? d.s0 : null });
  };
  G.killProj = (p, instant) => {
    if (p.dead) return;
    p.dead = true;
    if (p.body.world) world.removeBody(p.body);
    if (instant) G.releaseProj(p);
    else G.dying.push({ h: null, mesh: p.mesh, t: 0.35, deb: null, proj: p, geo: null, s0: p.s0 });
  };
  function killItemFade(it) {
    it.dead = true;
    if (it.body.world) world.removeBody(it.body);
    G.dying.push({ h: it.h || null, mesh: it.mesh || null, t: 0.35, deb: null, proj: null, geo: it.shell ? it.shell.geometry : it.mesh ? it.mesh.geometry : null, s0: null });
  }

  // ---------------------------------------------------------------- scenes: plan now, build over frames
  let plan = [], planI = 0, order = [];
  const rec = new Proxy({}, { get: (_, k) => (...a) => { plan.push(k, a); } });
  function nextName() {
    if (!order.length) order = SCENE_NAMES.filter((n) => n !== G.sceneName).sort(() => Math.random() - 0.5);
    let n = order.shift();
    if (n === G.sceneName && order.length) { order.push(n); n = order.shift(); }
    return n;
  }
  function clearAll() {
    for (const it of G.items) if (!it.dead) killItemFade(it);
    for (const d of G.debris) { G.killDebris(d, false); d.inList = false; }
    for (const p of G.projs) { G.killProj(p, false); p.inList = false; }
    G.shards.fadeAll(0.6);
    G.items = []; G.metals = []; G.debris = []; G.projs = []; G.newItems = [];
    G.clearBreaks(); G.hitN = 0;
    G.totalW = 0; G.doneW = 0;
  }
  G.startScene = (name) => {
    if (G.sceneName) clearAll();
    name = SCENES[name] ? name : nextName();
    G.sceneName = name;
    plan = []; planI = 0;
    SCENES[name](rec);
    G.planTotal = plan.length / 2;
    G.state = 'intro'; G.stateT = 0;
    for (const k in AMMO_START) G.ammo[k] = Math.max(G.ammo[k], AMMO_START[k]);
    G.landed = 0;
    H.ammo();
  };
  G.next = () => G.startScene(null);
  const easeOutBounce = (x) => {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  };
  const DROP = 9;
  function setYo(it, y) { if (it.h) it.h.yo = y; else it.yo = y; }
  function updateIntro(rdt, buildPerFrame) {
    G.stateT += rdt;
    // instantiate a slice of the plan each frame (no single-frame spawn spike)
    const end = Math.min(plan.length, planI + buildPerFrame * 2);
    for (; planI < end; planI += 2) {
      const n0 = G.items.length;
      K[plan[planI]](...plan[planI + 1]);
      for (let i = n0; i < G.items.length; i++) {
        const it = G.items[i];
        it.delay = Math.max(it.origin.y * 0.14, G.stateT + 0.02) + Math.random() * 0.05;
        setYo(it, DROP);
      }
    }
    let maxEnd = 0, landed = 0;
    for (const it of G.items) {
      const t = clamp((G.stateT - it.delay) / 0.55, 0, 1);
      setYo(it, DROP * (1 - easeOutBounce(t)));
      if (t >= 0.36) landed++;
      maxEnd = Math.max(maxEnd, it.delay + 0.55);
    }
    if (landed > G.landed + 8) { sfx.land(); G.landed = landed; }
    if (planI >= plan.length && G.stateT >= maxEnd) {
      for (const it of G.items) setYo(it, 0);
      for (const it of G.newItems) { world.addBody(it.body); K.anchor(it); }
      G.newItems = [];
      G.state = 'play'; G.stateT = 0;
    }
  }

  // ---------------------------------------------------------------- throwing
  G.canThrow = (kind) => kind === 'ball' || G.ammo[kind] > 0;
  G.throw = (kind, from, vel) => {
    if (G.state === 'intro' || !G.canThrow(kind)) return null;
    if (kind !== 'ball') { G.ammo[kind]--; H.ammo(); }
    return K.throwProj(kind, from, vel);
  };

  // projectile pass-through for glass: restore pre-contact velocity (slightly slowed)
  world.addEventListener('postStep', () => {
    for (const p of G.projs) if (!p.dead) p.pre.copy(p.body.velocity);
    const B = world.bodies;
    for (let i = 0; i < B.length; i++) {
      const b = B[i], q = b.position, v = b.velocity, w = b.angularVelocity;
      if (!Number.isFinite(q.x + q.y + q.z + v.x + v.y + v.z + w.x + w.y + w.z + b.quaternion.w)) {
        if (G.onNaN) G.onNaN(b);
        q.set(0, -10, 0); v.set(0, 0, 0); w.set(0, 0, 0); b.quaternion.set(0, 0, 0, 1); b.collisionFilterMask = 0;
        b.previousPosition.copy(q); b.interpolatedPosition.copy(q); b.previousQuaternion.set(0, 0, 0, 1); b.interpolatedQuaternion.set(0, 0, 0, 1);
      }
    }
  });
  world.addEventListener('preStep', () => {
    for (const p of G.projs) if (p.pass && !p.dead) { p.pass = false; p.body.velocity.set(p.pre.x * 0.85, p.pre.y * 0.85, p.pre.z * 0.85); }
  });

  // ---------------------------------------------------------------- update
  let frameN = 0;
  const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
  // rdt: real frame delta (seconds, already clamped by caller). Fixed 60 Hz physics with interpolation.
  G.update = (rdt, { buildPerFrame = 14, fixed = false } = {}) => {
    G.rtime += rdt;
    frameN++;
    let ts = 1;
    if (G.hitstopT > 0) { G.hitstopT -= rdt; ts = 0.04; }
    else if (G.slowT > 0) { G.slowT -= rdt; const k = G.slowT / G.slowDur; ts = k > 0.35 ? 0.3 : 0.3 + 0.7 * (1 - k / 0.35); }
    const dt = rdt * ts;
    G.time += dt;
    const t0 = now();
    const s0 = world.stepnumber;
    if (fixed) world.step(1 / 60); else if (dt > 0) world.step(1 / 60, dt, 3);
    G.prof.phys = now() - t0;
    G.prof.steps = world.stepnumber - s0;
    G.processHits();
    G.processBreaks();
    if (G.state === 'intro') updateIntro(rdt, buildPerFrame);

    if (frameN % 6 === 0) {
      let alive = 0;
      for (const it of G.items) {
        if (it.dead) continue;
        G.items[alive++] = it;
        if (G.state === 'intro') continue;
        const b = it.body, p = b.position, o = it.origin;
        if (!Number.isFinite(p.x + p.y + p.z) || p.y < -3 || Math.abs(p.x) > 40 || p.z > 5.2 || p.z < -40) {
          if (b.world) world.removeBody(b);
          it.dead = true;
          if (it.h) it.h.g.remove(it.h);
          if (it.mesh) { scene.remove(it.mesh); (it.shell || it.mesh).geometry.dispose(); }
          if (!it.counted) G.smash(it);
          alive--;
          continue;
        }
        const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
        if (!it.anchored && !it.supportFreed && dx * dx + dy * dy + dz * dz > 0.006) K.freeAbove(it);
        if (it.counted || it.noKnock) continue;
        let knocked = dx * dx + dz * dz > 0.2 || dy < -0.25;
        if (!knocked && it.upright) { const q = b.quaternion; knocked = 1 - 2 * (q.x * q.x + q.z * q.z) < 0.7; }
        if (knocked) G.smash(it);
      }
      G.items.length = alive;
      let m = 0;
      for (const it of G.metals) if (!it.dead) G.metals[m++] = it;
      G.metals.length = m;
    }
    for (const d of G.debris) {
      if (d.gone) continue;
      d.life -= dt;
      if (d.maskT > 0) { d.maskT -= dt; if (d.maskT <= 0) d.body.collisionFilterMask = 15; }
      const p = d.body.position;
      if (d.life <= 0 || !Number.isFinite(p.x + p.y) || p.y < -3 || p.z > 5) G.killDebris(d, false);
    }
    if (frameN % 30 === 0) { let m = 0; for (const d of G.debris) { if (!d.gone) G.debris[m++] = d; else d.inList = false; } G.debris.length = m; }
    for (const p of G.projs) {
      if (p.dead) continue;
      p.age += dt;
      const b = p.body;
      const bad = !Number.isFinite(b.position.x + b.position.y + b.position.z);
      if (bad) { G.killProj(p, true); continue; }
      if (p.kind === 'bomb') {
        if (Math.random() < 0.8) {
          const q = b.interpolatedQuaternion;
          // fuse tip = rotate (0, .27, 0) by q
          const tx = 2 * (q.x * q.y - q.w * q.z) * 0.27, ty = (1 - 2 * (q.x * q.x + q.z * q.z)) * 0.27, tz = 2 * (q.y * q.z + q.w * q.x) * 0.27;
          G.spark.emit(b.interpolatedPosition.x + tx, b.interpolatedPosition.y + ty, b.interpolatedPosition.z + tz, rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1), rnd(0.15, 0.3), rnd(0.015, 0.03), 1, 0.8, 0.3, 3, 1, 0, 1, 0.03);
        }
        if (p.age > p.life) { G.explode(p); continue; }
      } else if (p.age > p.life || b.position.y < -3) { G.killProj(p, false); continue; }
    }
    { let m = 0; for (const p of G.projs) { if (!p.dead) G.projs[m++] = p; else p.inList = false; } G.projs.length = m; }
    for (let i = G.dying.length - 1; i >= 0; i--) {
      const d = G.dying[i];
      d.t -= rdt;
      const k = Math.max(0, d.t / 0.35);
      if (d.h) d.h.k = k;
      if (d.mesh) { if (d.s0) d.mesh.scale.copy(d.s0).multiplyScalar(k); else d.mesh.scale.setScalar(k); }
      if (d.t <= 0) {
        if (d.h) d.h.g.remove(d.h);
        if (d.deb) G.releaseDebris(d.deb);
        else if (d.proj) G.releaseProj(d.proj);
        else if (d.mesh) { scene.remove(d.mesh); if (d.geo) d.geo.dispose(); }
        G.dying[i] = G.dying[G.dying.length - 1];
        G.dying.pop();
      }
    }
    G.updateAppliances(dt);
    G.dust.update(dt); G.spark.update(dt); G.glint.update(dt); G.fire.update(dt);
    G.shards.update(dt);

    G.progress = G.totalW > 0 && G.state !== 'intro' ? Math.min(1, G.doneW / G.totalW / CLEAR_AT) : 0;
    if (G.state === 'play') {
      G.stateT += rdt;
      if (G.progress >= 1) { G.state = 'cleared'; G.stateT = 0; H.cleared(); }
    } else if (G.state === 'cleared') {
      G.stateT += rdt;
      if (G.stateT > 2.0) G.next();
    }
  };
  // sync visuals with bodies (render side)
  G.sync = () => {
    for (const it of G.metals) {
      if (it.dead) continue;
      const p = it.body.interpolatedPosition, q = it.body.interpolatedQuaternion;
      it.mesh.position.set(p.x, p.y + it.yo, p.z);
      it.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
    for (const p of G.projs) {
      if (p.dead) continue;
      const ip = p.body.interpolatedPosition, iq = p.body.interpolatedQuaternion;
      p.mesh.position.set(ip.x, ip.y, ip.z);
      p.mesh.quaternion.set(iq.x, iq.y, iq.z, iq.w);
    }
    for (const d of G.debris) {
      if (d.gone || !d.mesh) continue;
      const ip = d.body.interpolatedPosition, iq = d.body.interpolatedQuaternion;
      d.mesh.position.set(ip.x, ip.y, ip.z);
      d.mesh.quaternion.set(iq.x, iq.y, iq.z, iq.w);
    }
    for (const k in G.groups) G.groups[k].update();
  };
  K.prewarmDebris();
  K.prewarmProj();
  return G;
}
