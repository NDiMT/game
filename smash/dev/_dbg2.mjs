import * as THREE from 'three';
import { createCore } from '/home/user/game/smash/js/core.js';
const m = new THREE.MeshStandardMaterial();
const mats = new Proxy({ paint: () => m }, { get: (o, k) => o[k] ?? m });
const sfx = new Proxy({}, { get: () => () => {} });
for (let trial = 0; trial < 4; trial++) {
const G = createCore({ scene: new THREE.Scene(), mats, sfx });
G.startScene('electronics');
while (G.state === 'intro') G.update(1 / 60, { fixed: true });
let nanLog = [];
G.world.addEventListener('preStep', () => { if (nanLog.length) return; for (const b of G.world.bodies) { if (!Number.isFinite(b.velocity.x + b.angularVelocity.x + b.position.x)) { nanLog.push('PRE-INTEGRATE NaN ' + (b.item ? b.item.kind || b.item.type : b.deb ? 'deb ' + b.deb.key : b.proj ? 'proj' : '?') + ' inertia ' + JSON.stringify(b.invInertiaSolve) + ' mass ' + b.mass + ' contacts ' + G.world.contacts.filter(c => c.bi === b || c.bj === b).map(c => { const o = c.bi === b ? c.bj : c.bi; return (o.item ? o.item.kind || o.item.type : o.deb ? 'deb ' + o.deb.key : o.proj ? 'proj' : 'ground') + ' ni' + JSON.stringify(c.ni) + ' ri' + JSON.stringify(c.ri); }).join(' ; ')); break; } } });
const ap = G.items.filter((i) => i.type === 'appliance');
const log = [];
for (let t = 0; t < 10 && G.state === 'play'; t++) {
  const live = G.items.filter((it) => !it.dead && !it.counted);
  const tg = live[(Math.random() * live.length) | 0].body.position;
  const from = new THREE.Vector3(0, 1.6, 6.5), aim = new THREE.Vector3(tg.x, tg.y, tg.z);
  const d = aim.clone().sub(from), T = d.length() / 21, vel = d.divideScalar(T); vel.y += 0.5 * 9.82 * T;
  G.throw('ball', from, vel);
  for (let i = 0; i < 75; i++) {
    const prev = ap.map((a) => [a.body.position.x, a.body.position.y, a.body.position.z, a.dead, a.counted]);
    G.update(1 / 60, { fixed: true });
    ap.forEach((a, k) => { if (!prev[k][4] && a.counted) log.push(`${a.kind} counted t${t} i${i} hp=${a.hp.toFixed(0)} husk=${a.husk} dead=${a.dead} pos=${prev[k].slice(0,3).map(v=>v.toFixed(2))} -> ${[a.body.position.x,a.body.position.y,a.body.position.z].map(v=>v.toFixed(2))}`); });
  }
}
console.log(log.join('\n')); console.log(nanLog.join('\n'));
}
