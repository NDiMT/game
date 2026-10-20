import * as THREE from 'three';
import { createCore } from '/home/user/game/smash/js/core.js';
const name = process.argv[2] || 'wall';
const m = new THREE.MeshStandardMaterial();
const mats = { brick: m, rubble: m, crate: m, wood: m, glass: m, bottle: m, shard: m, steel: m, dark: m, fridgeMats: m, paint: () => m, ball: m, bowl: m, bomb: m, hole: m, projBrick: m };
const sfx = new Proxy({}, { get: () => () => {} });
const G = createCore({ scene: new THREE.Scene(), mats, sfx });
G.startScene(name);
while (G.state === 'intro') G.update(1 / 60, { fixed: true });
// settle check: run 3 s with no throws
for (let i = 0; i < 180; i++) G.update(1 / 60, { fixed: true });
console.log('idle 3s prog', G.progress.toFixed(2), 'count', G.count);
for (let t = 0; t < 6 && G.state === 'play'; t++) {
  const live = G.items.filter((it) => !it.dead && !it.counted);
  const tg = live[(Math.random() * live.length) | 0].body.position;
  const from = new THREE.Vector3(0, 1.6, 6.5), aim = new THREE.Vector3(tg.x, tg.y, tg.z);
  const d = aim.clone().sub(from), T = d.length() / 21, vel = d.divideScalar(T); vel.y += 0.5 * 9.82 * T;
  G.throw('ball', from, vel);
  const c0 = G.count;
  let awake = 0;
  for (let i = 0; i < 75; i++) G.update(1 / 60, { fixed: true });
  for (const it of G.items) if (!it.dead && it.body.sleepState === 0) awake++;
  console.log('throw', t, 'at', tg.x.toFixed(2), tg.y.toFixed(2), 'prog', G.progress.toFixed(2), '+', G.count - c0, 'awake', awake, 'state', G.state);
}
