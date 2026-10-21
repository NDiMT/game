// Scripted drivers. They write into an input object {steer, throttle, brake, drift}.
// Used by the headless tuning sim, the in-game AI rival and the ?bot test hook.
import { GX, GY, World, RES } from './physics.js?v=2.2';

const wrap = (a) => (a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// heading error to a point (positive = target is to the left)
function headErr(car, tx, tz) { return wrap(Math.atan2(tx - car.x, tz - car.z) - car.yaw); }

// Drive straight at the ball centre at part throttle, no drift (the "slow straight shot").
export class StraightBot {
  constructor(throttle = 0.6) { this.thr = throttle; }
  reset() {}
  drive(w, inp) {
    const c = w.car, b = w.ball;
    inp.steer = clamp(-headErr(c, b.x, b.z) * 3, -1, 1);
    inp.throttle = this.thr; inp.brake = 0; inp.drift = false;
  }
}

// Random approach: wandering steer, random drift taps, loosely towards the ball.
export class RandomBot {
  constructor(rand) { this.rand = rand; }
  reset() {
    const r = this.rand;
    this.ph = r() * 6; this.f = 0.6 + r() * 1.8; this.amp = r() * 1.2; this.bias = (r() - 0.5) * 6;
    this.dOn = 1 + r() * 3.5; this.dLen = r() * 1.6; this.home = 0.6 + r() * 2;
    this.thr = 0.65 + r() * 0.35;
  }
  drive(w, inp) {
    const c = w.car, b = w.ball, t = w.t;
    const toward = -headErr(c, b.x + this.bias, b.z) * this.home;
    inp.steer = clamp(toward + Math.sin(t * this.f * 3 + this.ph) * this.amp, -1, 1);
    inp.throttle = this.thr; inp.brake = 0;
    inp.drift = t > this.dOn && t < this.dOn + this.dLen;
  }
}

// Skilled planner. A manoeuvre is: drive (full gas) to a set-up point beside/behind the ball, powerslide
// for a while (steer into it / countersteer), release for the mini-turbo, then strike the ball at an
// offset. It tries many manoeuvres in a private copy of the world, follows the ball until it crosses
// the goal line (so curl counts) and keeps the one that best finds the chosen spot, then drives it.
// noise > 0 perturbs the chosen plan (sloppy execution). drift=false plans without drifting.
const NP = 6;
export class PlanBot {
  constructor(carDef, rand, opts = {}) {
    this.sim = new World(carDef, 1);
    this.rand = rand;
    this.drift = opts.drift !== false;
    this.noise = opts.noise || 0;
    this.samples = opts.samples || 140;
    this.txRange = opts.txRange || 0; // aim anywhere in [-txRange, txRange] instead of a corner
    this.p = new Float32Array(NP); this.best = new Float32Array(NP); this.q = new Float32Array(NP);
    this.inp = { steer: 0, throttle: 0, brake: 0, drift: false };
    this.score = 0; this.phase = 0; this.phaseT = 0;
  }
  setCar(def) { this.sim.car.def = def; }
  reset(w, opts = {}) { this.begin(w, opts); while (!this.work(1000)) { /* plan */ } this.phase = 0; }
  begin(w, opts = {}) {
    const r = this.rand;
    this.w = w;
    this.side = opts.side || (w.car.x > 1 ? -1 : w.car.x < -1 ? 1 : (r() < 0.5 ? -1 : 1));
    if (opts.anySide && r() < 0.35) this.side = -this.side;
    this.tx = this.side * (GX - 1.3 - r() * 0.7);
    if (this.txRange) this.tx = (r() * 2 - 1) * this.txRange;
    this.sim.car.def = w.car.def;
    this.bestS = -1e9; this.it = 0; this.done = false; this.phase = 0;
    this.refine = opts.refine != null ? opts.refine : 60;
  }
  work(n) {
    if (this.done) return true;
    const r = this.rand, p = this.p, q = this.q, best = this.best, w = this.w;
    const total = this.samples + this.refine;
    for (let k = 0; k < n && this.it < total; k++, this.it++) {
      if (this.it < this.samples) {
        this.sample(p);
        const sc = this.evaluate(w, p);
        if (sc > this.bestS) { this.bestS = sc; best.set(p); }
      } else {
        const i = this.it - this.samples;
        const kk = 0.3 * (1 - i / (this.refine + 10));
        for (let j = 0; j < NP; j++) q[j] = best[j] + (r() - 0.5) * kk * (j === 0 ? 2 : 1);
        this.fix(q);
        const sc = this.evaluate(w, q);
        if (sc > this.bestS) { this.bestS = sc; best.set(q); }
      }
    }
    if (this.it < total) return false;
    this.score = this.bestS;
    if (this.noise > 0) { for (let j = 0; j < NP; j++) best[j] += (r() - 0.5) * this.noise * (j === 5 ? 1.6 : 0.6); this.fix(best); }
    this.done = true; this.phase = 0;
    return true;
  }
  sample(p) {
    const r = this.rand;
    p[0] = (r() * 2 - 1);                                // set-up point: lateral offset (x8 m)
    p[1] = r();                                          // set-up point: distance behind the ball (6..16 m)
    p[2] = this.drift && r() > 0.12 ? 0.45 + r() * 1.2 : 0; // powerslide duration (0 = none)
    p[3] = r() < 0.5 ? -1 : 1;                           // slide direction
    p[4] = r() * 2 - 1;                                  // slide steer (into / counter)
    p[5] = (r() * 2 - 1) * 1.1;                          // strike aim offset
    this.fix(p);
  }
  fix(p) {
    p[0] = clamp(p[0], -1, 1); p[1] = clamp(p[1], 0, 1);
    p[2] = this.drift && p[2] >= 0.3 ? Math.min(1.8, p[2]) : 0;
    p[3] = p[3] < 0 ? -1 : 1; p[4] = clamp(p[4], -1, 1); p[5] = clamp(p[5], -1.4, 1.4);
  }
  // closed-loop controller for plan p; phase state lives on the bot (one world at a time)
  control(w, p, inp) {
    const c = w.car, b = w.ball;
    inp.brake = 0; inp.throttle = 1;
    if (this.phase === 0) {
      const wx = b.x + p[0] * 11, wz = b.z + 8 + p[1] * 14;
      const dx = wx - c.x, dz = wz - c.z;
      const passed = (c.z - b.z) < 8 + p[1] * 14 - 1.5;
      if (dx * dx + dz * dz < 9 || passed || w.t > 6) { this.phase = p[2] > 0 ? 1 : 2; this.phaseT = w.t; }
      else { inp.steer = clamp(-headErr(c, wx, wz) * 2.5, -1, 1); inp.drift = false; return; }
    }
    if (this.phase === 1) {
      const t = w.t - this.phaseT;
      if (t < p[2]) {
        // flick into the slide, then steer the slide so the nose comes round to the strike point
        inp.drift = true;
        if (t < 0.08) inp.steer = p[3];
        else {
          let dx = b.x - c.x, dz = b.z - c.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          inp.steer = clamp(-headErr(c, b.x - dz * p[5], b.z + dx * p[5]) * 2 + p[4] * 0.6, -1, 1);
        }
        return;
      }
      this.phase = 2;
    }
    // strike: pursue a point beside the ball centre (perpendicular to the car->ball line)
    inp.drift = false;
    let dx = b.x - c.x, dz = b.z - c.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const tx = b.x - dz * p[5], tz = b.z + dx * p[5];
    inp.steer = clamp(-headErr(c, tx, tz) * 3, -1, 1);
  }
  evaluate(w, p) {
    const s = this.sim, inp = this.inp;
    s.setup(w.car.x, w.car.z, w.car.yaw, 0, w.car.speed);
    s.keeper.x = 40; s.keeper.update(); // keep the keeper out of the planning copy
    this.phase = 0;
    let boosted = false, lv = 0;
    for (let n = 0; n < 1140; n++) {
      this.control(s, p, inp);
      s.keeper.x = 40;
      s.step(inp); s.ev.clear();
      if (s.car.level > lv) lv = s.car.level;
      if (s.touched) { boosted = s.car.boostT > 0; break; }
      if (s.car.z < s.ball.z - 4) return -100;
    }
    if (!s.touched) return -100;
    const b = s.ball, tHit = s.t;
    if (b.vz > -3) return -50;
    // follow the ball (with its curl) to the goal line
    inp.steer = 0; inp.throttle = 0; inp.drift = false;
    for (let n = 0; n < 240 && b.z > 0 && !s.result; n++) { s.keeper.x = 40; s.step(inp); s.ev.clear(); }
    if (b.z > 0.5) return -40;
    const xc = b.x, yc = b.y;
    let sc = -Math.abs(xc - this.tx) * 2.2 + s.shotSpeed * 0.12;
    if (yc > GY - 1.3) sc -= (yc - (GY - 1.3)) * 3;
    if (this.drift) sc += boosted ? 1 + lv * 0.6 : -4;
    sc -= tHit * 0.25;
    this.phase = 0;
    return sc;
  }
  drive(w, inp) { this.control(w, this.best, inp); }
}
