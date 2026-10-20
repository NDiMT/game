// Headless gameplay sim: throws at targets until a scene clears; reports throws needed + physics cost.
// Run: node --import ./smash/dev/sim-register.mjs smash/dev/sim.mjs [trials] [policy: balls|mixed]
import * as THREE from 'three';
import { createCore } from '../js/core.js';
import { SCENE_NAMES } from '../js/scenes.js';

const trials = +(process.argv[2] || 3), policy = process.argv[3] || 'mixed';
const m = new THREE.MeshStandardMaterial();
const mats = { brick: m, rubble: m, crate: m, wood: m, glass: m, bottle: m, shard: m, steel: m, dark: m, fridgeMats: m, paint: () => m, ball: m, bowl: m, bomb: m, hole: m, projBrick: m };
const sfx = new Proxy({}, { get: () => () => {} });
const CAM = new THREE.Vector3(0, 2.3, 8.2);
const out = {};
for (const name of SCENE_NAMES) {
  const res = [];
  let physMs = 0, steps = 0, maxStep = 0;
  for (let t = 0; t < trials; t++) {
    const G = createCore({ scene: new THREE.Scene(), mats, sfx });
    G.startScene(name);
    let f = 0;
    while (G.state === 'intro' && f++ < 2000) G.update(1 / 60, { fixed: true, buildPerFrame: 14 });
    let throws = 0, specials = 0;
    while (G.state === 'play' && throws < 80) {
      const live = G.items.filter((it) => !it.dead && !it.counted);
      if (!live.length) break;
      const tg = live[(Math.random() * live.length) | 0].body.position;
      let kind = 'ball';
      if (policy === 'mixed' && throws % 4 === 3) for (const k of ['brick', 'bowling', 'anvil', 'bomb']) if (G.ammo[k] > 0 && Math.random() < 0.5) { kind = k; break; }
      if (kind !== 'ball') specials++;
      const aim = new THREE.Vector3(tg.x + (Math.random() - 0.5) * 0.3, tg.y + (Math.random() - 0.5) * 0.3, tg.z);
      const from = new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.6, 6.5);
      const speed = 21 * G.PROJ[kind].speed;
      const d = aim.clone().sub(from), T = d.length() / speed;
      const vel = d.divideScalar(T); vel.y += 0.5 * 9.82 * T;
      G.throw(kind, from, vel);
      throws++;
      for (let i = 0; i < 75 && G.state === 'play'; i++) {
        G.update(1 / 60, { fixed: true });
        physMs += G.prof.phys; steps++; maxStep = Math.max(maxStep, G.prof.phys);
      }
    }
    res.push({ throws, specials, prog: +G.progress.toFixed(2), cleared: G.state !== 'play' });
  }
  out[name] = res;
  console.log(name.padEnd(11), 'throws', res.map((r) => r.throws + (r.cleared ? '' : '(x ' + r.prog + ')')).join(' '), ' specials', res.map((r) => r.specials).join(' '), ` phys ${(physMs / steps).toFixed(2)}ms/step max ${maxStep.toFixed(1)}`);
}
