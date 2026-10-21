// Headless tuning sim for DRIFT KICK physics (car, ball, keeper) + tunnelling checks.
// Run: node drift/dev/sim.mjs [trials=300] [diff=0.3]
import { World, RES, GX, GY, GD, PR, R, KZ, DT, rng, attemptStart } from '../js/physics.js';
import { CARS } from '../js/cars.js';
import { StraightBot, RandomBot, PlanBot } from '../js/bots.js';


const DA = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = +(DA[0] || 300);
const DIFFS = DA[1] ? [+DA[1]] : [0.1, 0.3, 0.5, 0.7];
const NAMES = ['-', 'goal', 'save', 'miss', 'time'];

const SP = { x: 0, z: 0, yaw: 0 };
function startPos(rand) { attemptStart(rand, SP); return [SP.x, SP.z, SP.yaw]; }

let tunnels = 0, worstPen = 0; const tk = {};
const T = (k) => { tunnels++; tk[k] = (tk[k] || 0) + 1; };
function checks(w, prev) {
  const b = w.ball, c = w.car;
  if (b.y < R - 0.02) T('ground');
  // posts
  for (const sx of [-GX, GX]) {
    const dx = b.x - sx, dz = b.z; const yy = Math.min(Math.max(b.y, 0), GY);
    const d = Math.hypot(dx, dz, b.y - yy); const pen = R + PR - d; if (pen > worstPen) worstPen = pen;
  }
  // nets: side switches across a panel inside its extent = tunnel
  if (prev) {
    const inX = Math.abs(b.x) < GX && Math.abs(prev.x) < GX, inY = b.y < GY && prev.y < GY;
    if (inX && inY && (prev.z + GD) * (b.z + GD) < 0) T('back');
    const inZ = b.z < 0 && b.z > -GD && prev.z < 0 && prev.z > -GD;
    if (inZ && inY && ((Math.abs(prev.x) - GX) * (Math.abs(b.x) - GX) < 0)) T('side');
    if (inZ && inX && (prev.y - GY) * (b.y - GY) < 0) T('roof');
    if ((prev.z > 0) !== (b.z > 0) && b.y < GY - R && Math.abs(b.x) < GX - R && Math.abs(b.x - w.keeper.x) < 0.2 && w.keeper.mode === 0) { /* ok, through keeper gap */ }
  }
  if (c.y < -0.01) T('car');
}

function run(bot, diff, label, opts = {}) {
  const res = [0, 0, 0, 0, 0];
  let spd = 0, hits = 0, lv = 0, boosted = 0, cross = 0, planSc = 0;
  const rand = rng(1234);
  const w = new World(car, 99);
  const inp = { steer: 0, drift: false, jump: false, brake: false };
  const prev = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < N; i++) {
    const [x, z, yaw] = startPos(rand);
    w.rand = rng(1000 + i);
    w.setup(x, z, yaw, diff);
    bot.reset(w, opts);
    if (bot.score !== undefined) planSc += bot.score;
    let maxLv = 0, boostAtHit = false;
    prev.x = w.ball.x; prev.y = w.ball.y; prev.z = w.ball.z;
    let n = 0;
    while (!w.result && n++ < 2000) {
      bot.drive(w, inp);
      const wasT = w.touched;
      w.step(inp); w.ev.clear();
      if (w.car.level > maxLv) maxLv = w.car.level;
      if (!wasT && w.touched) { boostAtHit = w.car.boostT > 0; }
      checks(w, prev);
      prev.x = w.ball.x; prev.y = w.ball.y; prev.z = w.ball.z;
    }
    res[w.result]++;
    if (w.touched) { hits++; spd += w.shotSpeed; }
    lv += maxLv; if (boostAtHit) boosted++;
    if (opts.trace && i < opts.trace) console.log(`  #${i} ${NAMES[w.result]} shot ${w.shotSpeed.toFixed(1)} lv${maxLv} boost${boostAtHit ? 1 : 0} kx ${w.keeper.x.toFixed(2)} pred ${w.keeper.predX.toFixed(2)} ball x ${w.ball.x.toFixed(2)} y ${w.ball.y.toFixed(2)} t ${w.t.toFixed(2)} touchT ${w.touchT.toFixed(2)}`);
  }
  const pc = (v) => (100 * v / N).toFixed(0).padStart(3) + '%';
  console.log(`${label.padEnd(22)} d=${diff.toFixed(2)}  goal ${pc(res[1])} save ${pc(res[2])} miss ${pc(res[3])} time ${pc(res[4])} | shot ${(spd / Math.max(1, hits)).toFixed(1)} m/s, avg lv ${(lv / N).toFixed(2)}, boosted ${pc(boosted)}, plan ${(planSc / N).toFixed(1)}`);
  return res;
}

const t0 = performance.now();
const r = rng(7);
const car = CARS[+(process.argv.find((a) => a.startsWith('--car='))?.slice(6) || 0)];
for (const d of DIFFS) {
  run(new StraightBot(), d, 'straight slow');
  run(new PlanBot(car, rng(11)), d, 'drift-boost corner');
  run(new PlanBot(car, rng(12), { drift: false }), d, 'no-drift corner');
  run(new PlanBot(car, rng(13), { noise: 0.25 }), d, 'drift (sloppy)');
  run(new PlanBot(car, rng(15), { drift: false, txRange: 5, noise: 0.15 }), d, 'random aim, no drift');
  run(new PlanBot(car, rng(16), { txRange: 5, noise: 0.15 }), d, 'random aim + drift');
  run(new RandomBot(r), d, 'random wander');
  run(new PlanBot(car, rng(14), { noise: 0.12, samples: 90, anySide: true }), d, 'AI kicker');
  console.log('');
}
const ms = performance.now() - t0;
console.log(`tunnels: ${tunnels} ${JSON.stringify(tk)}, worst post penetration: ${worstPen.toFixed(3)} m, ${ms.toFixed(0)} ms total`);
