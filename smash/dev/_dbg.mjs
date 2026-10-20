import * as THREE from 'three';
import { createCore } from '/home/user/game/smash/js/core.js';
const m = new THREE.MeshStandardMaterial();
const mats = new Proxy({ paint: () => m }, { get: (o, k) => o[k] ?? m });
const sfx = new Proxy({}, { get: () => () => {} });
const G = createCore({ scene: new THREE.Scene(), mats, sfx });
G.startScene('electronics');
while (G.state === 'intro') G.update(1 / 60, { fixed: true });
const ap = G.items.filter((i) => i.type === 'appliance');
let bad = null;
for (let t = 0; t < 8; t++) {
  const it = ap[t % ap.length];
  const tg = it.body.position;
  const from = new THREE.Vector3(0, 1.6, 6.5), aim = new THREE.Vector3(tg.x, tg.y, tg.z);
  const d = aim.clone().sub(from), T = d.length() / 21, vel = d.divideScalar(T); vel.y += 0.5 * 9.82 * T;
  G.throw('ball', from, vel);
  for (let i = 0; i < 75; i++) {
    G.update(1 / 60, { fixed: true });
    for (const a of ap) if (!bad && (a.body.position.y < -0.2 || !Number.isFinite(a.body.position.y))) bad = `${a.kind} y=${a.body.position.y} vel=${a.body.velocity.y.toFixed(1)} t=${t} i=${i} hp=${a.hp} anchored=${a.anchored} mask=${a.body.collisionFilterMask} shapes=${a.body.shapes.length} mass=${a.body.mass} type=${a.body.type} inworld=${!!a.body.world}`;
  }
}
console.log(bad, ap.map((a) => a.kind + ' ' + a.body.position.y.toFixed(2) + ' hp ' + a.hp.toFixed(0)).join(' | '));
