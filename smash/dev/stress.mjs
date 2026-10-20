// Physics stress test: 60 throws of every kind per scene, then checks for tunnelling and floating sleepers.
// Run: node --import ./smash/dev/sim-register.mjs smash/dev/stress.mjs [throwsPerScene]
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createCore } from '../js/core.js';
import { SCENE_NAMES } from '../js/scenes.js';

const N = +(process.argv[2] || 60);
const m = new THREE.MeshStandardMaterial();
const mats = new Proxy({ paint: () => m }, { get: (o, k) => o[k] ?? m });
const sfx = new Proxy({}, { get: () => () => {} });
const KINDS = ['ball', 'brick', 'bowling', 'anvil', 'bomb'];
const tot = { throws: 0, below: 0, floating: 0, nan: 0, snapped: 0, clamped: 0, woke: 0, steps: 0, ms: 0, maxMs: 0 };
function floating(G) {
  const B = G.world.bodies.filter((b) => b.type !== CANNON.Body.STATIC);
  let n = 0;
  for (const b of B) {
    if (b.sleepState !== CANNON.Body.SLEEPING) continue;
    b.updateAABB();
    const a = b.aabb, bot = a.lowerBound.y;
    if (bot < 0.05) continue;
    const ok = B.some((o) => { if (o === b) return false; o.updateAABB(); const c = o.aabb; return c.upperBound.y > bot - 0.06 && c.lowerBound.y < bot && c.lowerBound.x < a.upperBound.x && c.upperBound.x > a.lowerBound.x && c.lowerBound.z < a.upperBound.z && c.upperBound.z > a.lowerBound.z; });
    if (!ok) n++;
  }
  return n;
}
const below = (G) => G.world.bodies.filter((b) => b.type === CANNON.Body.DYNAMIC && b.collisionFilterMask !== 0 && b.position.y < 0).length;
for (const name of SCENE_NAMES.filter((n) => !process.argv[3] || process.argv[3].split(',').includes(n))) {
  const G = createCore({ scene: new THREE.Scene(), mats, sfx });
  G.startScene(name);
  while (G.state === 'intro') G.update(1 / 60, { fixed: true });
  G.next = () => {}; // stay on this scene
  let maxBelow = 0, smax = 0, sumMs = 0, nst = 0, over8 = 0;
  for (let t = 0; t < N; t++) {
    const kind = KINDS[t % KINDS.length];
    G.ammo[kind] = 9;
    if (G.state !== 'play') G.state = 'play';
    const x = (Math.random() - 0.5) * 3, y = Math.random() * 2, z = (Math.random() - 0.5) * 1.2;
    const from = new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.6, 6.5), aim = new THREE.Vector3(x, y, z);
    const sp = (15 + Math.random() * 12) * G.PROJ[kind].speed;
    const d = aim.clone().sub(from), T = d.length() / sp, vel = d.divideScalar(T); vel.y += 0.5 * 9.82 * T;
    G.throw(kind, from, vel);
    for (let i = 0; i < 25; i++) {
      G.update(1 / 60, { fixed: true });
      tot.steps++; tot.ms += G.prof.phys; tot.maxMs = Math.max(tot.maxMs, G.prof.phys); smax = Math.max(smax, G.prof.phys); sumMs += G.prof.phys; nst++; if (G.prof.phys > 8) over8++;
      maxBelow = Math.max(maxBelow, below(G));
    }
  }
  for (let i = 0; i < 240; i++) G.update(1 / 60, { fixed: true }); // settle 4 s
  const fl = floating(G), bl = below(G);
  tot.throws += N; tot.below += bl; tot.floating += fl; tot.nan += G.guard.nan; tot.snapped += G.guard.snapped; tot.clamped += G.guard.clamped; tot.woke += G.guard.woke;
  console.log(name.padEnd(11), `throws ${N}  bodies ${G.world.bodies.length}  belowGround(end) ${bl} (max during ${maxBelow})  floatingSleepers ${fl}  nanParked ${G.guard.nan}  snapped ${G.guard.snapped}  velClamped ${G.guard.clamped}  supportWakes ${G.guard.woke}  phys avg ${(sumMs / nst).toFixed(2)}ms max ${smax.toFixed(1)}ms frames>8ms ${over8}`);
}
console.log('TOTAL', JSON.stringify({ ...tot, msPerStep: +(tot.ms / tot.steps).toFixed(3), maxMs: +tot.maxMs.toFixed(1) }));
