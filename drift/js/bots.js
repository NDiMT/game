// Scripted drivers. They write into an input object {steer, drift, jump, brake}.
// Used by the headless tuning sim and by the AI team's penalties.
import { R, GX, GY, World, RES } from './physics.js';

const wrap = (a) => (a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// heading error to a point (positive = target is to the left)
function headErr(car, tx, tz) { return wrap(Math.atan2(tx - car.x, tz - car.z) - car.yaw); }
function velErr(car, tx, tz) {
  if (car.speed < 1) return headErr(car, tx, tz);
  return wrap(Math.atan2(tx - car.x, tz - car.z) - Math.atan2(car.vx, car.vz));
}

// Drive straight at the ball centre, no drift (the "slow straight shot").
export class StraightBot {
  reset() {}
  drive(w, inp) {
    const c = w.car, b = w.ball;
    inp.steer = clamp(-headErr(c, b.x, b.z) * 3, -1, 1);
    inp.drift = false; inp.jump = false; inp.brake = false;
  }
}

// Random approach: wandering steer, random drift taps / jumps, loosely towards the ball.
export class RandomBot {
  constructor(rand) { this.rand = rand; }
  reset() {
    const r = this.rand;
    this.ph = r() * 6; this.f = 0.6 + r() * 1.8; this.amp = r() * 1.2; this.bias = (r() - 0.5) * 6;
    this.dOn = r() * 2.5; this.dLen = r() * 1.6; this.jAt = r() < 0.25 ? r() * 2 : -1; this.home = 0.6 + r() * 2;
  }
  drive(w, inp) {
    const c = w.car, b = w.ball, t = w.t;
    const toward = -headErr(c, b.x + this.bias, b.z) * this.home;
    inp.steer = clamp(toward + Math.sin(t * this.f * 3 + this.ph) * this.amp, -1, 1);
    inp.drift = t > this.dOn && t < this.dOn + this.dLen;
    inp.jump = this.jAt > 0 && t > this.jAt && t < this.jAt + 0.1;
    inp.brake = false;
  }
}

// Skilled planner: it tries many open-loop manoeuvres (swing, drift, release, aim offset) in a private
// copy of the world, keeps the one whose shot best finds the chosen corner, then drives it.
// noise > 0 perturbs the chosen plan (sloppy execution). drift=false plans without drifting.
const NP = 6;
export class PlanBot {
  constructor(carDef, rand, opts = {}) {
    this.sim = new World(carDef, 1);
    this.rand = rand;
    this.drift = opts.drift !== false;
    this.noise = opts.noise || 0;
    this.samples = opts.samples || 140;
    this.p = new Float32Array(NP); this.best = new Float32Array(NP); this.q = new Float32Array(NP);
    this.inp = { steer: 0, drift: false, jump: false, brake: false };
    this.score = 0;
  }
  setCar(def) { this.sim.car.def = def; }
  // plan from the freshly set-up world w
  reset(w, opts = {}) {
    const r = this.rand;
    this.side = opts.side || (w.car.x > 1 ? -1 : w.car.x < -1 ? 1 : (r() < 0.5 ? -1 : 1));
    if (opts.anySide && r() < 0.35) this.side = -this.side;
    this.tx = this.side * (GX - 1.35 - r() * 0.7);
    this.sim.car.def = w.car.def;
    let bestS = -1e9;
    const p = this.p, q = this.q, best = this.best;
    for (let i = 0; i < this.samples; i++) {
      this.sample(p);
      const sc = this.evaluate(w, p);
      if (sc > bestS) { bestS = sc; best.set(p); }
    }
    // local refinement
    for (let i = 0; i < 70; i++) {
      const k = 0.25 * (1 - i / 80);
      for (let j = 0; j < NP; j++) q[j] = best[j] + (r() - 0.5) * k * (j === 2 ? 1.5 : 1);
      this.fix(q);
      const sc = this.evaluate(w, q);
      if (sc > bestS) { bestS = sc; best.set(q); }
    }
    this.score = bestS;
    if (this.noise > 0) { for (let j = 0; j < NP; j++) best[j] += (r() - 0.5) * this.noise * (j === 5 ? 1.6 : 0.5); this.fix(best); }
  }
  sample(p) {
    const r = this.rand;
    p[0] = r() * 0.7;                       // swing duration
    p[1] = (r() * 2 - 1);                   // swing steer
    p[2] = this.drift ? 0.5 + r() * 1.2 : 0; // drift duration
    p[3] = r() < 0.5 ? -1 : 1;              // drift direction
    p[4] = r() * 2 - 1;                     // drift steer (tight/wide)
    p[5] = (r() * 2 - 1) * 1.1;             // strike aim offset
    this.fix(p);
  }
  fix(p) {
    p[0] = Math.min(0.9, Math.max(0, p[0])); p[1] = Math.min(1, Math.max(-1, p[1]));
    p[2] = this.drift ? Math.min(1.9, Math.max(0.35, p[2])) : 0;
    p[3] = p[3] < 0 ? -1 : 1; p[4] = Math.min(1, Math.max(-1, p[4])); p[5] = Math.min(1.4, Math.max(-1.4, p[5]));
  }
  control(w, p, inp) {
    const c = w.car, b = w.ball, t = w.t;
    inp.jump = false; inp.brake = false;
    if (t < p[0]) { inp.steer = p[1]; inp.drift = false; return; }
    if (t < p[0] + p[2]) {
      inp.drift = true;
      inp.steer = t < p[0] + 0.05 ? p[3] : p[3] * p[4];
      return;
    }
    // strike: pursue a point beside the ball centre (perpendicular to the car->ball line)
    inp.drift = false;
    let dx = b.x - c.x, dz = b.z - c.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const tx = b.x - dz * p[5], tz = b.z + dx * p[5];
    inp.steer = clamp(-headErr(c, tx, tz) * 3, -1, 1);
  }
  evaluate(w, p) {
    const s = this.sim, inp = this.inp;
    s.setup(w.car.x, w.car.z, w.car.yaw, 0);
    s.keeper.x = 40; s.keeper.update(); // keep the keeper out of the planning copy
    let boosted = false, lv = 0;
    for (let n = 0; n < 720; n++) {
      this.control(s, p, inp);
      s.keeper.x = 40;
      s.step(inp); s.ev.clear();
      if (s.car.level > lv) lv = s.car.level;
      if (s.touched) { boosted = s.car.boostT > 0; break; }
    }
    if (!s.touched) return -100;
    const b = s.ball;
    if (b.vz > -3) return -50;
    const tt = b.z / -b.vz, xc = b.x + b.vx * tt;
    const yc = b.y + b.vy * tt - 6 * tt * tt;
    let sc = -Math.abs(xc - this.tx) * 2.2 + Math.sqrt(b.vx * b.vx + b.vz * b.vz) * 0.12;
    if (yc > GY - 1.3) sc -= (yc - (GY - 1.3)) * 3;
    if (this.drift) sc += boosted ? 1 + lv * 0.6 : -4;
    sc -= s.t * 0.3;
    return sc;
  }
  drive(w, inp) { this.control(w, this.best, inp); }
}
