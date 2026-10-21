// DRIFT KICK physics v2: raycast-style toy car (4 sprung wheels, slip-based tyres, weight transfer,
// engine curve, handbrake drift + mini-turbo), a spinning ball with Magnus curl, an AI keeper and
// the attempt judge. Pure JS, deterministic for a given seed, no three.js, no allocation in step().
// World axes: goal line is z = 0, the goal (net) is at z < 0, the pitch runs to +z. y is up.
// Car local frame: +x = left, +y = up, +z = forward. steer input +1 = right.

export const DT = 1 / 120;
export const GX = 6.0;      // post centre |x|
export const GY = 4.0;      // crossbar centre height
export const GD = 2.6;      // net depth
export const PR = 0.16;     // post / bar radius
export const R = 0.95;      // ball radius
export const KZ = 0.85;     // keeper plane
export const SPOT = 13;     // ball spot z (v1: 10)
export const AX = 26;       // arena half width (v1: 21)
export const AZ0 = -5.6;    // wall behind goal
export const AZ1 = 66;      // far wall (v1: 40)
export const SHOT_TIME = 9.5; // seconds to touch the ball (v1: 6)

const BALL_G = 13, CAR_G = 20, KEEP_G = 16;
const BALL_MAX = 46;
const BALL_M = 0.5;                       // car mass is ~3: a 6:1 ratio like Rocket League
const BALL_I = (2 / 3) * BALL_M * R * R;  // hollow sphere
const MAGNUS = 0.022;                     // curl: a = MAGNUS * (spin x v)
const CONTACT_E = 0.55, CONTACT_MU = 0.45;
const HIT_ASSIST = 0.2, HIT_ASSIST_MAX = 12, CURL_ASSIST = 2.2;

export const RES = { NONE: 0, GOAL: 1, SAVE: 2, MISS: 3, TIME: 4 };
export const EV = { HIT: 1, POST: 2, NET: 3, SAVE: 4, BOUNCE: 5, BOOST: 6, LEVEL: 7, JUMP: 8, WALL: 9, LAND: 10, DIVE: 11, DRIFT: 12, CROSS: 13 };
export const LEVEL_T = [0, 0.4, 0.85, 1.35];   // drift charge to reach blue / orange / purple
const BOOST_T = [0, 0.6, 0.95, 1.3];
const BOOST_KICK = [0, 2.5, 4, 5.5];
const BOOST_A = [0, 15, 19, 24];
export const BOOST_TOP = [0, 25, 28, 31];

// where the car starts an attempt: ~40 m behind the ball (v1: 23), off to one side, at rest
export function attemptStart(rand, out) {
  out.x = (rand() - 0.5) * 16;
  out.z = SPOT + 38 + rand() * 4;
  out.yaw = Math.atan2(-out.x * 0.6, SPOT - out.z) + (rand() - 0.5) * 0.3;
  return out;
}

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// tyre grip curves (Pacejka-like): rise to a peak, then fall to a sliding plateau
const gripLat = (a) => Math.sin(1.45 * Math.atan(9 * a));     // peak ~0.21 rad, plateau 0.76
const gripLong = (k) => Math.sin(1.6 * Math.atan(10 * k));    // peak ~0.15, plateau 0.59
const SLOPE_LONG = 16;

const DUMMY = { push() {} };
class Events {
  constructor() { this.n = 0; this.t = new Int8Array(64); this.a = new Float32Array(256); }
  push(t, a, b, c, d) {
    if (this.n >= 64) return;
    const i = this.n++; this.t[i] = t; const k = i * 4;
    this.a[k] = a || 0; this.a[k + 1] = b || 0; this.a[k + 2] = c || 0; this.a[k + 3] = d || 0;
  }
  clear() { this.n = 0; }
}

// ---------------------------------------------------------------- car
// wheel order: FL, FR, RL, RR
export class Car {
  constructor(def) {
    this.wx = new Float32Array(4); this.wz = new Float32Array(4);
    this.comp = new Float32Array(4); this.load = new Float32Array(4); this.contact = new Uint8Array(4);
    this.omega = new Float32Array(4); this.wAng = new Float32Array(4);
    this.slipA = new Float32Array(4); this.slipK = new Float32Array(4);
    this.def = def;
    this.reset(0, 40, Math.PI, 0);
  }
  get def() { return this._def; }
  set def(d) {
    this._def = d;
    const m = d.mass, L = d.hl * 2, W = d.hw * 2, mon = d.shape === 'monster';
    this.m = m;
    this.Iz = m * (L * L + W * W) / 12 * 1.15;
    this.Ip = m * (L * L + 0.5) / 12;
    this.Ir = m * (W * W + 0.5) / 12;
    this.wr = d.wheelR;
    this.lzw = d.hl * 0.64; this.lxw = d.hw + 0.03 + (mon ? 0.1 : 0);
    for (let i = 0; i < 4; i++) { this.wx[i] = (i & 1 ? -1 : 1) * this.lxw; this.wz[i] = (i < 2 ? 1 : -1) * this.lzw; }
    this.cgH = 0.42 + (mon ? 0.18 : 0);
    const sc = mon ? 0.12 : 0.09;             // static compression
    this.k = m * CAR_G / (4 * sc);
    this.cDamp = 2 * 0.5 * Math.sqrt(this.k * m / 4);
    this.rest = mon ? 0.34 : 0.24; this.travel = mon ? 0.3 : 0.21; this.sc = sc;
    this.H0 = this.wr + this.rest - sc;         // hardpoint height above ground at rest (car.y = 0)
    this.mu = d.grip * 0.123;
    this.driftMu = d.driftGrip / d.grip;        // rear lateral grip factor while drifting
    this.vtop = d.maxSpeed * 1.06;
    this.Fdrive = m * d.accel * 0.5;
    this.Iw = 0.05;
    this.cd = 0.006 * m; this.cr = 0.02 * m;
    this.maxSteer = d.turn * 0.21;
  }
  reset(x, z, yaw, speed) {
    this.x = x; this.y = 0; this.z = z;
    this.vx = Math.sin(yaw) * speed; this.vy = 0; this.vz = Math.cos(yaw) * speed;
    this.yaw = yaw; this.yawRate = 0; this.pitch = 0; this.pitchRate = 0; this.roll = 0; this.rollRate = 0;
    this.onGround = true; this.air = 0; this.contacts = 4;
    this.drifting = false; this.driftDir = 0; this.driftT = 0; this.charge = 0; this.level = 0; this.gripRec = 1;
    this.boostT = 0; this.boostLv = 0; this.slip = 0; this.speed = speed; this.vF = speed; this.steer = 0; this.steerAngle = 0;
    this.throttle = 0; this.brake = 0; this.reverse = false; this.rpm = 0;
    this.jumpHeld = false; this.driftHeld = false; this.lastLevel = 0;
    for (let i = 0; i < 4; i++) { this.comp[i] = this.sc; this.load[i] = this.m * CAR_G / 4; this.contact[i] = 1; this.omega[i] = speed / this.wr; this.slipA[i] = 0; this.slipK[i] = 0; }
    this.savePrev();
  }
  savePrev() { this.px = this.x; this.py = this.y; this.pz = this.z; this.pyaw = this.yaw; this.ppitch = this.pitch; this.proll = this.roll; }

  step(inp, dt, ev) {
    const d = this._def, m = this.m;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let vf = this.vx * sy + this.vz * cy;     // forward
    let vl = this.vx * cy - this.vz * sy;     // left
    const spd = Math.sqrt(vf * vf + vl * vl);
    const steerIn = clamp(inp.steer || 0, -1, 1);
    const ds = steerIn - this.steer, sr = 7 * dt;
    this.steer += ds > sr ? sr : ds < -sr ? -sr : ds;
    const thr = clamp(inp.throttle || 0, 0, 1), brk = clamp(+inp.brake || 0, 0, 1);
    this.throttle = thr; this.brake = brk;
    const grounded = this.contacts >= 2, prevC = this.contacts;
    const beta = spd > 2 ? Math.atan2(vl, Math.abs(vf)) : 0;   // body slip (velocity left of heading > 0)

    // ---- drift (handbrake + low rear grip) state
    if (inp.drift && !this.driftHeld && grounded && vf > 5) {
      this.drifting = true; this.driftT = 0; this.charge = 0; this.level = 0; this.lastLevel = 0;
      this.driftDir = Math.abs(this.steer) > 0.2 ? Math.sign(this.steer) : Math.abs(this.yawRate) > 0.3 ? -Math.sign(this.yawRate) : 0;
      if (this.driftDir) this.yawRate -= this.driftDir * 0.8; // initiation flick
      ev.push(EV.DRIFT, this.driftDir);
    }
    if (this.drifting && this.driftDir === 0 && Math.abs(this.steer) > 0.3) { this.driftDir = Math.sign(this.steer); this.yawRate -= this.driftDir * 0.8; }
    if (this.drifting && (!inp.drift || spd < 3)) {
      const lv = spd >= 3 ? this.level : 0;
      if (lv > 0) {
        this.boostT = BOOST_T[lv]; this.boostLv = lv;
        this.vx += sy * BOOST_KICK[lv]; this.vz += cy * BOOST_KICK[lv]; vf += BOOST_KICK[lv];
        ev.push(EV.BOOST, lv);
      }
      this.drifting = false; this.driftDir = 0; this.charge = 0; this.level = 0; this.gripRec = 0;
    }
    this.driftHeld = !!inp.drift;
    if (this.drifting) this.driftT += dt;
    if (this.gripRec < 1) this.gripRec = Math.min(1, this.gripRec + dt / 0.35);

    // ---- jump
    if (inp.jump && !this.jumpHeld && grounded) {
      this.vy += d.jump; this.air = 0; ev.push(EV.JUMP, 0);
      this.pitchRate += 0.6;
    }
    this.jumpHeld = !!inp.jump;

    // ---- steering angle (speed sensitive) with a little auto-countersteer
    const lock = this.maxSteer / (1 + Math.max(0, vf) / 14) * (this.drifting ? 1.3 : 1);
    let tgtSteer = -this.steer * lock;
    if (grounded && vf > 4) tgtSteer += clamp(beta, -0.6, 0.6) * (this.drifting ? 0.25 : 0.45);
    const dsa = tgtSteer - this.steerAngle, sar = 5 * dt;
    this.steerAngle += dsa > sar ? sar : dsa < -sar ? -sar : dsa;
    const sn = Math.sin(this.steerAngle), cs = Math.cos(this.steerAngle);

    // ---- engine / brakes
    // forward drive, foot brake, or reverse when (nearly) stopped
    let drive = 0, footBrake = 0;
    const rearV = (this.omega[2] + this.omega[3]) * 0.5 * this.wr;
    if (thr > 0) {
      const u = rearV / (this.vtop * (0.3 + 0.7 * thr));   // analogue pedal: partial gas = lower speed demand
      const curve = u < 0 ? 1 : u < 0.65 ? 0.78 + 0.22 * u / 0.65 : Math.max(0, (1 - u) / 0.35);
      drive = (0.4 + 0.6 * thr) * this.Fdrive * curve * this.wr;
      this.reverse = false;
    } else if (brk > 0) {
      if ((vf > 1.2 && !this.reverse) || inp.hold) footBrake = brk;
      else {
        this.reverse = true;
        const u = -rearV / (this.vtop * 0.3);
        const curve = u < 0 ? 1 : Math.max(0, (1 - u) / 0.4);
        drive = -brk * this.Fdrive * 0.7 * curve * this.wr;
      }
    } else if (vf > 0.5) this.reverse = false;
    this.rpm = clamp(Math.abs(rearV) / this.vtop, 0, 1.1);
    const hand = this.drifting && this.driftT < 0.14 ? 1 : 0;
    const rearMuLat = this.mu * (this.drifting ? this.driftMu : this.driftMu + (1 - this.driftMu) * this.gripRec);

    // ---- suspension (raycast against the flat ground) -> wheel loads
    const sp = Math.sin(this.pitch), cpi = Math.cos(this.pitch), sro = Math.sin(this.roll), cro = Math.cos(this.roll);
    let Fsus = 0, tauP = 0, tauR = 0, nC = 0;
    for (let i = 0; i < 4; i++) {
      const lx = this.wx[i], lz = this.wz[i];
      const hp = this.y + this.H0 + lz * sp + lx * sro;
      const comp = this.rest - (hp - this.wr);
      if (comp <= 0) { this.contact[i] = 0; this.load[i] = 0; this.comp[i] = 0; continue; }
      const cdot = -(this.vy + lz * cpi * this.pitchRate + lx * cro * this.rollRate);
      let F = this.k * comp + this.cDamp * cdot;
      if (comp > this.travel) F += this.k * 14 * (comp - this.travel) + this.cDamp * 3 * Math.max(0, cdot);
      if (F < 0) F = 0;
      this.contact[i] = 1; nC++;
      this.comp[i] = comp > this.travel + 0.04 ? this.travel + 0.04 : comp;
      this.load[i] = F;
      Fsus += F; tauP += F * lz * cpi; tauR += F * lx * cro;
    }
    this.contacts = nC;

    // ---- tyres
    let FF = 0, FL = 0, tauZ = 0;
    const w = this.yawRate;
    for (let i = 0; i < 4; i++) {
      const front = i < 2, lx = this.wx[i], lz = this.wz[i], r = this.wr;
      const vfp = vf - w * lx, vlp = vl + w * lz;
      const s = front ? sn : 0, c = front ? cs : 1;
      const vlong = vlp * s + vfp * c, vlat = vlp * c - vfp * s;
      let om = this.omega[i];
      if (!this.contact[i]) {
        // free wheel in the air: spins down slowly, driven wheels still get torque
        const T = front ? drive * 0.15 : drive * 0.35;
        om += (T / this.Iw) * dt * 0.2; om *= 1 - dt * 0.8;
        if (footBrake > 0 || (hand && !front)) om *= 0.8;
        this.omega[i] = om; this.slipA[i] = 0; this.slipK[i] = 0;
        continue;
      }
      const N = Math.min(this.load[i], m * CAR_G * 1.2);
      const muLat = front ? this.mu : rearMuLat * 1.12;
      const muLong = this.mu * 1.05;
      // longitudinal: wheel spin with an implicit slip-force update (stable at any inertia)
      const Tdrive = drive * (front ? 0.15 : 0.35);
      let Tbrake = footBrake * (front ? 12 : 8) * r + (hand && !front ? 14 * r : 0);
      const den = Math.max(Math.abs(vlong), 2);
      let kap = (om * r - vlong) / den;
      let Fx = muLong * N * gripLong(kap);
      const slope = muLong * N * SLOPE_LONG * r / den;
      const sgn = om > 0.01 ? 1 : om < -0.01 ? -1 : (Tdrive !== 0 ? 0 : (vlong > 0 ? 1 : -1));
      let omN = om + dt * (Tdrive - r * Fx - sgn * Tbrake) / (this.Iw + dt * r * slope);
      if (Tbrake > 0 && om * omN < 0) omN = 0;              // brakes lock, never reverse the wheel
      if (footBrake > 0) {                                    // simple ABS on the foot brake
        const kN = (omN * r - vlong) / den;
        if (kN < -0.16 && vlong > 0) omN = (vlong * 0.84) / r;
      }
      om = omN;
      kap = (om * r - vlong) / den;
      Fx = muLong * N * gripLong(kap);
      // lateral: slip angle on a grip curve, never overshooting in one step at low speed
      const alpha = Math.atan2(vlat, Math.max(Math.abs(vlong), 3));
      // grip curve: past the peak it falls to a sliding plateau; only a drifting rear axle gets the full falloff
      let g = gripLat(alpha < 0 ? -alpha : alpha);
      if (alpha > 0.21 || alpha < -0.21) g = 1 - (1 - g) * (!front && this.drifting ? 1 : 0.3);
      let Fy = -muLat * N * g * (alpha < 0 ? -1 : 1);
      const cap = (m * 0.25) * Math.abs(vlat) / dt * 0.9;
      if (Fy > cap) Fy = cap; else if (Fy < -cap) Fy = -cap;
      // friction circle
      const lim = Math.max(muLat, muLong) * N * 1.02, tot = Math.sqrt(Fx * Fx + Fy * Fy);
      if (tot > lim) { const f = lim / tot; Fx *= f; Fy *= f; }
      this.omega[i] = om; this.slipA[i] = alpha; this.slipK[i] = kap;
      // wheel frame -> body frame
      const fL = Fx * s + Fy * c, fF = Fx * c - Fy * s;
      FF += fF; FL += fL; tauZ += lz * fL - lx * fF;
    }
    for (let i = 0; i < 4; i++) this.wAng[i] += this.omega[i] * dt;

    // ---- arcade assists (keep it fun, never spin out)
    const absB = Math.abs(beta);
    if (grounded && spd > 3) {
      if (!this.drifting) {
        // stability control: pull the heading back onto the velocity, harder once it slides
        tauZ += this.Iz * (beta * 4 + (absB > 0.22 ? (beta - Math.sign(beta) * 0.22) * 14 : 0));
        tauZ -= this.Iz * w * 0.3;
      } else if (this.driftDir) {
        // drift-angle controller: steer into the drift = wider angle / tighter line, countersteer = straighten
        const a = this.steer * this.driftDir;
        const bt = 0.4 + 0.22 * a;
        const err = clamp(bt - beta * this.driftDir, -0.4, 0.4);
        const wt = -this.driftDir * (1.5 + 0.55 * a + 3.2 * err);
        tauZ += this.Iz * (wt - w) * 9;
      }
    }

    // ---- boost thrust (works on the ground and in the air)
    let thrust = 0;
    if (this.boostT > 0) {
      const top = BOOST_TOP[this.boostLv] + (d.maxSpeed - 16);
      thrust = m * BOOST_A[this.boostLv] * clamp((top - vf) / 4, 0, 1);
    }
    // a held powerslide keeps its speed (arcade): part of the scrubbed speed comes back as drive
    if (this.drifting && grounded && thr > 0) thrust += m * 8 * thr * Math.min(1, absB / 0.35) * clamp((this.vtop - vf) / 3, 0, 1);

    // ---- integrate
    const dragK = this.cd * spd + this.cr;
    const aF = (FF + thrust) / m, aL = FL / m;
    this.vx += (aF * sy + aL * cy) * dt - this.vx * dragK / m * dt;
    this.vz += (aF * cy - aL * sy) * dt - this.vz * dragK / m * dt;
    this.vy += (Fsus / m - CAR_G) * dt;
    if (nC === 0) {
      // air control: steer yaws, the body levels itself
      this.yawRate += (-this.steer * 2.0 - this.yawRate) * Math.min(1, dt * 3);
      this.pitchRate += (-this.pitch * 10 - this.pitchRate * 2.5) * dt;
      this.rollRate += (-this.roll * 12 - this.rollRate * 3) * dt;
      this.air += dt;
    } else {
      this.yawRate += tauZ / this.Iz * dt;
      this.pitchRate += (tauP + this.cgH * FF) / this.Ip * dt;
      this.rollRate += (tauR + this.cgH * FL) / this.Ir * dt;
      this.pitchRate *= 1 - dt * 2; this.rollRate *= 1 - dt * 2;
    }
    if (grounded && thr === 0 && brk === 0 && spd < 0.3) { this.vx *= 0.9; this.vz *= 0.9; this.yawRate *= 0.9; }
    this.yaw += this.yawRate * dt;
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2; else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
    this.pitch = clamp(this.pitch + this.pitchRate * dt, -0.6, 0.6);
    this.roll = clamp(this.roll + this.rollRate * dt, -0.5, 0.5);
    const wasAir = prevC === 0 && this.air > 0.08;
    this.y += this.vy * dt;
    if (this.y < -0.25) { this.y = -0.25; if (this.vy < 0) this.vy = 0; }
    this.x += this.vx * dt; this.z += this.vz * dt;
    if (nC > 0 && wasAir) ev.push(EV.LAND, Math.max(0, -this.vy * 3 + 2));
    this.onGround = nC >= 2;
    if (nC > 0) this.air = 0;

    // ---- drift charge
    if (this.drifting && grounded && spd > 6 && absB > 0.12) {
      this.charge += dt * d.chargeRate * (0.8 + 0.7 * Math.min(1, absB / 0.5));
      const lv = this.charge >= LEVEL_T[3] ? 3 : this.charge >= LEVEL_T[2] ? 2 : this.charge >= LEVEL_T[1] ? 1 : 0;
      if (lv !== this.level) { this.level = lv; ev.push(EV.LEVEL, lv); }
    }
    if (this.boostT > 0) { this.boostT -= dt; if (this.boostT <= 0) { this.boostT = 0; this.boostLv = 0; } }

    const s2 = Math.sin(this.yaw), c2 = Math.cos(this.yaw);
    this.vF = this.vx * s2 + this.vz * c2;
    const vL = this.vx * c2 - this.vz * s2;
    this.speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    this.slip = this.speed > 2 ? -Math.atan2(vL, Math.abs(this.vF)) : 0; // + = sliding to the right (v1 sign)
  }
}

// ---------------------------------------------------------------- ball
export class Ball {
  constructor() { this.reset(0, SPOT); }
  reset(x, z) { this.x = x; this.y = R; this.z = z; this.vx = 0; this.vy = 0; this.vz = 0; this.wx = 0; this.wy = 0; this.wz = 0; this.savePrev(); }
  savePrev() { this.px = this.x; this.py = this.y; this.pz = this.z; }
}

// ---------------------------------------------------------------- keeper
// A big toy goalie: body capsule + glove bar, rolls (dives) around the z axis.
export class Keeper {
  constructor() { this.setDiff(0.3); this.reset(); }
  setDiff(dd) {
    const d = clamp(dd, 0, 1);
    this.diff = d;
    this.react = 0.27 - 0.1 * d;          // seconds before reacting to a shot
    this.antic = 0.12 + 0.3 * d;          // how much it pre-positions on your approach line
    this.shuffle = 2.4 + 1.8 * d;         // m/s side step
    this.diveMax = 3.3 + 2.0 * d;         // m/s dive
    this.noise = 1.2 - 0.85 * d;          // read error (m) on the crossing point
    this.rollRate = 3.0 + 2.6 * d;
    this.guess = 0.26 - 0.2 * d;          // chance to commit the wrong way on an angled shot
  }
  reset() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.roll = 0; this.pose = 0; this.mode = 0; this.t = 0;
    this.tx = 0; this.reactT = -1; this.side = 0; this.seenTouch = 0; this.px = 0; this.py = 0; this.proll = 0; this.ppose = 0;
    this.predX = 0; this.predY = 0; this.predT = 0; this.wide = false;
    this.update();
  }
  savePrev() { this.px = this.x; this.py = this.y; this.proll = this.roll; this.ppose = this.pose; }
  update() { keeperPose(this.x, this.y, this.roll, this.pose, this); }
}

// collider endpoints of the keeper (body capsule b0-b1, glove bar a0-a1) for a given pose, written into out
export function keeperPose(x, y, roll, P, out) {
  const piv = 1.1 - 0.45 * Math.abs(Math.sin(roll));
  const c = Math.cos(-roll), s = Math.sin(-roll);
  const ox = x, oy = y + piv;
  let lx = 0, ly = 0.6 - 1.1; out.b0x = ox + lx * c - ly * s; out.b0y = oy + lx * s + ly * c;
  ly = 1.95 - 1.1; out.b1x = ox + lx * c - ly * s; out.b1y = oy + lx * s + ly * c;
  const ax = 1.0 * (1 - P) + 0.25 * P, ay0 = 1.85 * (1 - P) + 2.15 * P, ay1 = 1.85 * (1 - P) + 2.8 * P;
  lx = -ax * (1 - P); ly = ay0 - 1.1; out.a0x = ox + lx * c - ly * s; out.a0y = oy + lx * s + ly * c;
  lx = ax * (1 - P); ly = ay1 - 1.1; out.a1x = ox + lx * c - ly * s; out.a1y = oy + lx * s + ly * c;
}

// ---------------------------------------------------------------- world
export class World {
  constructor(carDef, seed = 1) {
    this.car = new Car(carDef);
    this.ball = new Ball();
    this.keeper = new Keeper();
    this.ev = new Events();
    this.rand = rng(seed);
    this.inp = { steer: 0, throttle: 0, brake: 0, drift: false, jump: false };
    this.cb = { nx: 0, ny: 0, nz: 0 };
    this.setup(0, 50, Math.PI, 0.3);
  }
  setup(cx, cz, yaw, diff, speed = 0) {
    this.car.reset(cx, cz, yaw, speed);
    this.ball.reset(0, SPOT);
    this.keeper.reset(); this.keeper.setDiff(diff);
    this.t = 0; this.touched = 0; this.touchT = -1; this.keeperT = -1; this.post = false;
    this.result = RES.NONE; this.resultT = -1; this.crossed = false; this.shotSpeed = 0; this.shotSpin = 0; this.restT = 0; this.awayT = 0;
    this.ev.clear();
  }
  step(inp) {
    const dt = DT, car = this.car, b = this.ball, k = this.keeper;
    car.savePrev(); b.savePrev(); k.savePrev();
    this.t += dt;
    car.step(inp, dt, this.ev);
    this.carStatic(car);
    this.keeperStep(dt);
    this.ballStep(dt);
    if (this.carBall()) this.ballFrame(false);
    if (b.y < R) { b.y = R; if (b.vy < 0) b.vy = -b.vy * 0.5; }
    this.judge(dt);
  }

  // ---- car vs arena, goal frame and keeper (2D, two circles along the car axis)
  carStatic(car) {
    const r = 0.66, sy = Math.sin(car.yaw), cy = Math.cos(car.yaw);
    for (let i = -1; i <= 1; i += 2) {
      const ox = sy * 0.5 * i, oz = cy * 0.5 * i;
      this._cx = car.x + ox; this._cz = car.z + oz;
      this.pushCircle(car, r, GX, 0, GX, -GD, 0);
      this.pushCircle(car, r, -GX, 0, -GX, -GD, 0);
      this.pushCircle(car, r, -GX, -GD, GX, -GD, 0);
      this.pushCircle(car, r, GX, 0, GX, 0, PR);
      this.pushCircle(car, r, -GX, 0, -GX, 0, PR);
      if (this.keeper.y < 1.2) this.pushCircle(car, r, this.keeper.b0x, KZ, this.keeper.b0x, KZ, 0.55);
      car.x = this._cx - ox; car.z = this._cz - oz;
    }
    const m = 1.0;
    if (car.x > AX - m) { car.x = AX - m; if (car.vx > 0) { this.ev.push(EV.WALL, car.vx); car.vx *= -0.3; } }
    if (car.x < -AX + m) { car.x = -AX + m; if (car.vx < 0) { this.ev.push(EV.WALL, -car.vx); car.vx *= -0.3; } }
    if (car.z > AZ1 - m) { car.z = AZ1 - m; if (car.vz > 0) { this.ev.push(EV.WALL, car.vz); car.vz *= -0.3; } }
    if (car.z < AZ0 + m) { car.z = AZ0 + m; if (car.vz < 0) { this.ev.push(EV.WALL, -car.vz); car.vz *= -0.3; } }
  }
  pushCircle(car, r, ax, az, bx, bz, rr) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    let t = L2 > 0 ? ((this._cx - ax) * dx + (this._cz - az) * dz) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    let nx = this._cx - (ax + dx * t), nz = this._cz - (az + dz * t);
    const d2 = nx * nx + nz * nz, rs = r + rr;
    if (d2 >= rs * rs) return;
    const d = Math.sqrt(d2) || 1e-4; nx /= d; nz /= d;
    this._cx += nx * (rs - d); this._cz += nz * (rs - d);
    const vn = car.vx * nx + car.vz * nz;
    if (vn < 0) { car.vx -= vn * 1.25 * nx; car.vz -= vn * 1.25 * nz; if (vn < -4) this.ev.push(EV.WALL, -vn); }
  }

  // ---- ball: gravity, drag, Magnus curl, bounce + rolling friction with spin, walls, frame
  ballStep(dt) {
    const b = this.ball, ev = this.ev;
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
    // Magnus: a = k * (w x v)
    b.vx += MAGNUS * (b.wy * b.vz - b.wz * b.vy) * dt;
    b.vy += MAGNUS * (b.wz * b.vx - b.wx * b.vz) * dt * 0.5;
    b.vz += MAGNUS * (b.wx * b.vy - b.wy * b.vx) * dt;
    b.vy -= BALL_G * dt;
    const dr = 1 - (0.03 + 0.0012 * sp) * dt; b.vx *= dr; b.vy *= dr; b.vz *= dr;
    const sd = 1 - 0.35 * dt; b.wx *= sd; b.wy *= sd; b.wz *= sd;
    if (sp > BALL_MAX) { const f = BALL_MAX / sp; b.vx *= f; b.vy *= f; b.vz *= f; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    // ground
    if (b.y < R) {
      b.y = R;
      let jn = 0;
      if (b.vy < 0) {
        const imp = -b.vy;
        if (imp > 1.6) { b.vy = imp * 0.58; jn = imp * 1.58 * BALL_M; if (imp > 3) ev.push(EV.BOUNCE, imp, b.x, b.z); }
        else { b.vy = 0; jn = imp * BALL_M; }
      }
      // friction at the contact point drives the spin towards rolling (and spin kicks on bounces)
      const cvx = b.vx + R * b.wz, cvz = b.vz - R * b.wx;
      const cv = Math.sqrt(cvx * cvx + cvz * cvz);
      if (cv > 1e-4) {
        const K = 1 / BALL_M + R * R / BALL_I;
        let j = cv / K;
        const jmax = 0.5 * (jn + BALL_M * BALL_G * dt * 4);
        if (j > jmax) j = jmax;
        const jx = -cvx / cv * j, jz = -cvz / cv * j;
        b.vx += jx / BALL_M; b.vz += jz / BALL_M;
        b.wx += (-R * jz) / BALL_I; b.wz += (R * jx) / BALL_I;
      }
      if (b.vy === 0) {
        // rolling resistance on grass + the pitch damps vertical spin
        const hs = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
        if (hs > 0) { const f = Math.max(0, hs - 1.3 * dt) / hs; b.vx *= f; b.vz *= f; }
        b.wy *= 1 - 2.5 * dt;
      }
    }
    // arena walls
    if (b.x > AX - R) { b.x = AX - R; if (b.vx > 0) { b.vx *= -0.55; ev.push(EV.WALL, -b.vx); } }
    if (b.x < -AX + R) { b.x = -AX + R; if (b.vx < 0) { b.vx *= -0.55; ev.push(EV.WALL, b.vx); } }
    if (b.z > AZ1 - R) { b.z = AZ1 - R; if (b.vz > 0) { b.vz *= -0.55; ev.push(EV.WALL, -b.vz); } }
    if (b.z < AZ0 + R) { b.z = AZ0 + R; if (b.vz < 0) { b.vz *= -0.55; ev.push(EV.WALL, b.vz); } }
    this.ballFrame(true);
  }
  // posts, bar, nets and keeper (ev = emit events)
  ballFrame(emit) {
    const b = this.ball, ev = emit ? this.ev : DUMMY;
    const k = this.keeper;
    const kvx = k.vx, kvy = k.vy;
    let jk = this.ballSeg(k.b0x, k.b0y, KZ, k.b1x, k.b1y, KZ, 0.55, 0.35, 0.2, kvx, kvy, 0);
    jk += this.ballSeg(k.a0x, k.a0y, KZ, k.a1x, k.a1y, KZ, 0.32, 0.35, 0.2, kvx, kvy, 0);
    if (jk > 0.5) {
      if (b.vz < 2.5) b.vz = 2.5 + Math.abs(b.vz) * 0.15; // parry out
      b.wx *= 0.3; b.wy *= 0.3; b.wz *= 0.3;
      if (this.keeperT < 0) this.keeperT = this.t;
      ev.push(EV.SAVE, jk, b.x, b.y, b.z);
    }
    let j = 0;
    j = this.ballSeg(GX, 0, 0, GX, GY, 0, PR, 0.7, 0.05, 0, 0, 0); if (j > 2) { this.post = true; ev.push(EV.POST, j, GX, b.y, 0); }
    j = this.ballSeg(-GX, 0, 0, -GX, GY, 0, PR, 0.7, 0.05, 0, 0, 0); if (j > 2) { this.post = true; ev.push(EV.POST, j, -GX, b.y, 0); }
    j = this.ballSeg(-GX, GY, 0, GX, GY, 0, PR, 0.7, 0.05, 0, 0, 0); if (j > 2) { this.post = true; ev.push(EV.POST, j, b.x, GY, 0); }
    // nets: soft, swallow the ball (and kill its spin)
    j = this.ballRect(2, -GD, -GX, GX, 0, GY, 0.12, 0.45); if (j > 1) ev.push(EV.NET, j, b.x, b.y, -GD);
    j = this.ballRect(0, GX, -GD, 0, 0, GY, 0.15, 0.4); if (j > 1) ev.push(EV.NET, j, GX, b.y, b.z);
    j = this.ballRect(0, -GX, -GD, 0, 0, GY, 0.15, 0.4); if (j > 1) ev.push(EV.NET, j, -GX, b.y, b.z);
    j = this.ballRect(1, GY, -GX, GX, -GD, 0, 0.2, 0.4); if (j > 1) ev.push(EV.NET, j, b.x, GY, b.z);
  }
  ballSeg(ax, ay, az, bx, by, bz, r, e, fr, svx, svy, svz) {
    const b = this.ball;
    const dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz;
    let t = L2 > 0 ? ((b.x - ax) * dx + (b.y - ay) * dy + (b.z - az) * dz) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    let nx = b.x - (ax + dx * t), ny = b.y - (ay + dy * t), nz = b.z - (az + dz * t);
    const d2 = nx * nx + ny * ny + nz * nz, rr = R + r;
    if (d2 >= rr * rr) return 0;
    const d = Math.sqrt(d2) || 1e-4; nx /= d; ny /= d; nz /= d;
    const pen = rr - d; b.x += nx * pen; b.y += ny * pen; b.z += nz * pen;
    return this.resolve(nx, ny, nz, e, fr, svx, svy, svz);
  }
  ballRect(axis, c, u0, u1, v0, v1, e, fr) {
    const b = this.ball;
    let qx, qy, qz;
    if (axis === 2) { qz = c; qx = clamp(b.x, u0, u1); qy = clamp(b.y, v0, v1); }
    else if (axis === 0) { qx = c; qz = clamp(b.z, u0, u1); qy = clamp(b.y, v0, v1); }
    else { qy = c; qx = clamp(b.x, u0, u1); qz = clamp(b.z, v0, v1); }
    let nx = b.x - qx, ny = b.y - qy, nz = b.z - qz;
    const d2 = nx * nx + ny * ny + nz * nz;
    if (d2 >= R * R) return 0;
    const d = Math.sqrt(d2);
    if (d < 1e-4) { nx = axis === 0 ? 1 : 0; ny = axis === 1 ? 1 : 0; nz = axis === 2 ? 1 : 0; }
    else { nx /= d; ny /= d; nz /= d; }
    const pen = R - d; b.x += nx * pen; b.y += ny * pen; b.z += nz * pen;
    const j = this.resolve(nx, ny, nz, e, fr, 0, 0, 0);
    if (j > 0) { b.wx *= 0.5; b.wy *= 0.5; b.wz *= 0.5; }
    return j;
  }
  resolve(nx, ny, nz, e, fr, svx, svy, svz) {
    const b = this.ball;
    const rx = b.vx - svx, ry = b.vy - svy, rz = b.vz - svz;
    const vn = rx * nx + ry * ny + rz * nz;
    if (vn >= 0) return 0;
    const jn = -(1 + e) * vn;
    const tx = rx - vn * nx, ty = ry - vn * ny, tz = rz - vn * nz;
    b.vx += jn * nx - tx * fr; b.vy += jn * ny - ty * fr; b.vz += jn * nz - tz * fr;
    return jn;
  }

  // ---- car vs ball: oriented box vs sphere with a real two-body impulse (normal + friction -> spin),
  // plus a small Rocket-League-style assist through the car centre and a curl assist on the spin.
  carBall() {
    const car = this.car, b = this.ball, d = car.def;
    const sy = Math.sin(car.yaw), cy = Math.cos(car.yaw);
    const sa = -Math.sin(car.pitch), ca = Math.cos(car.pitch), sc = Math.sin(car.roll), cc = Math.cos(car.roll);
    // basis of Ry(yaw) * Rx(-pitch) * Rz(roll)
    const Xx = cy * cc + sy * sa * sc, Xy = ca * sc, Xz = -sy * cc + cy * sa * sc;   // left
    const Yx = -cy * sc + sy * sa * cc, Yy = ca * cc, Yz = sy * sc + cy * sa * cc;  // up
    const Zx = sy * ca, Zy = -sa, Zz = cy * ca;                                      // forward
    const ch = d.hh + 0.2 + (d.shape === 'monster' ? 0.3 : 0);
    const cx = car.x + Yx * ch, cyy = car.y + Yy * ch, cz = car.z + Yz * ch;
    const dx = b.x - cx, dy = b.y - cyy, dz = b.z - cz;
    const hw = d.hw, hh = d.hh, hl = d.hl;
    const lx = dx * Xx + dy * Xy + dz * Xz, ly = dx * Yx + dy * Yy + dz * Yz, lz = dx * Zx + dy * Zy + dz * Zz;
    if (Math.abs(lx) > hw + R || Math.abs(ly) > hh + R || Math.abs(lz) > hl + R) return false;
    let qx = clamp(lx, -hw, hw), qy = clamp(ly, -hh, hh), qz = clamp(lz, -hl, hl);
    let nlx = lx - qx, nly = ly - qy, nlz = lz - qz;
    let dist = Math.sqrt(nlx * nlx + nly * nly + nlz * nlz), pen;
    if (dist < 1e-4) {
      const px = hw - Math.abs(lx), py = hh - Math.abs(ly), pz = hl - Math.abs(lz);
      nlx = nly = nlz = 0;
      if (pz <= px && pz <= py) { nlz = lz >= 0 ? 1 : -1; pen = R + pz; qz = nlz * hl; }
      else if (px <= py) { nlx = lx >= 0 ? 1 : -1; pen = R + px; qx = nlx * hw; }
      else { nly = ly >= 0 ? 1 : -1; pen = R + py; qy = nly * hh; }
    } else {
      if (dist >= R) return false;
      pen = R - dist; nlx /= dist; nly /= dist; nlz /= dist;
    }
    const nx = nlx * Xx + nly * Yx + nlz * Zx, ny = nlx * Xy + nly * Yy + nlz * Zy, nz = nlx * Xz + nly * Yz + nlz * Zz;
    const qwx = cx + qx * Xx + qy * Yx + qz * Zx, qwy = cyy + qx * Xy + qy * Yy + qz * Zy, qwz = cz + qx * Xz + qy * Yz + qz * Zz;
    // separate: the light ball takes most of it, never into the ground
    b.x += nx * pen * 0.88; b.y += ny * pen * 0.88; b.z += nz * pen * 0.88;
    car.x -= nx * pen * 0.12; car.z -= nz * pen * 0.12;
    if (b.y < R) b.y = R;
    // velocity of the car at the contact point (yaw, pitch and roll rates)
    const rx = qwx - car.x, ry = qwy - (car.y + car.cgH), rz = qwz - car.z;
    const ox = -car.pitchRate * Xx + car.rollRate * Zx, oy = car.yawRate - car.pitchRate * Xy + car.rollRate * Zy, oz = -car.pitchRate * Xz + car.rollRate * Zz;
    const cvx = car.vx + oy * rz - oz * ry, cvy = car.vy + oz * rx - ox * rz, cvz = car.vz + ox * ry - oy * rx;
    const rvx = b.vx - cvx, rvy = b.vy - cvy, rvz = b.vz - cvz;
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (vn >= -0.2) return true;
    const mc = car.m, rn = rz * nx - rx * nz;
    const K = 1 / BALL_M + 1 / mc + rn * rn / car.Iz;
    const jn = -(1 + CONTACT_E) * vn / K;
    b.vx += jn * nx / BALL_M; b.vy += jn * ny / BALL_M; b.vz += jn * nz / BALL_M;
    car.vx -= jn * nx / mc; car.vz -= jn * nz / mc; if (!car.onGround || ny < 0) car.vy -= jn * ny / mc;
    car.yawRate -= rn * jn / car.Iz;
    // friction: tangential slip at the contact (ball surface vs car) -> ball spin
    const bsx = b.vx + (b.wy * -nz * R - b.wz * -ny * R), bsy = b.vy + (b.wz * -nx * R - b.wx * -nz * R), bsz = b.vz + (b.wx * -ny * R - b.wy * -nx * R);
    let tx = bsx - cvx, ty = bsy - cvy, tz = bsz - cvz;
    const tn = tx * nx + ty * ny + tz * nz; tx -= tn * nx; ty -= tn * ny; tz -= tn * nz;
    const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
    let spinY = 0;
    if (vt > 1e-3) {
      const Kt = 1 / BALL_M + R * R / BALL_I + 1 / mc;
      const jt = Math.min(CONTACT_MU * jn, vt / Kt);
      const Jx = -tx / vt * jt, Jy = -ty / vt * jt, Jz = -tz / vt * jt;
      b.vx += Jx / BALL_M; b.vy += Jy / BALL_M; b.vz += Jz / BALL_M;
      const rbx = -nx * R, rby = -ny * R, rbz = -nz * R;
      b.wx += (rby * Jz - rbz * Jy) / BALL_I;
      spinY = (rbz * Jx - rbx * Jz) / BALL_I;
      b.wz += (rbx * Jy - rby * Jx) / BALL_I;
      b.wy += spinY * (1 + CURL_ASSIST);           // curl assist: drifted, glancing hits bend more
    }
    // assist: a shove from the car centre through the ball (flattened), scales with closing speed
    let hx = b.x - car.x, hy = (b.y - car.y - 0.5) * 0.35, hz = b.z - car.z;
    const hl2 = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1; hx /= hl2; hy /= hl2; hz /= hl2;
    const bonus = Math.min(HIT_ASSIST_MAX, -vn * HIT_ASSIST);
    b.vx += hx * bonus; b.vy += hy * bonus + Math.max(0, -vn) * 0.03; b.vz += hz * bonus;
    if (!car.onGround) b.vy += 1.2 + Math.max(0, -vn) * 0.15;   // air chip
    if (b.y <= R + 0.01 && b.vy < 0) b.vy = -b.vy * 0.5;
    if (!this.touched) this.touchT = this.t;
    this.touched++;
    this.shotSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
    this.shotSpin = b.wy;
    this.ev.push(EV.HIT, -vn, qwx, qwy, qwz);
    return true;
  }

  // ---- keeper brain + body
  keeperStep(dt) {
    const k = this.keeper, b = this.ball, car = this.car;
    if (k.mode === 0 || k.mode === 1) {
      if (this.touched > k.seenTouch) {
        k.seenTouch = this.touched;
        k.reactT = k.react * (0.85 + 0.3 * this.rand());
      }
      if (k.reactT >= 0) {
        k.reactT -= dt;
        if (k.reactT < 0) { this.keeperPlan(); if (k.mode === 2) { k.update(); return; } }
      } else if (!this.touched) {
        // read the approach: where would the ball go if the car hit it now?
        const tbx = b.x - car.x, tbz = b.z - car.z, tl = Math.sqrt(tbx * tbx + tbz * tbz) || 1;
        const sp = car.speed || 1;
        const tow = (car.vx * tbx + car.vz * tbz) / (sp * tl);
        let aim = 0;
        if (tl < 20 && tow > 0.3 && b.z > 1 && sp > 3) {
          const ax = tbx / tl * 0.6 + car.vx / sp * 0.4, az = tbz / tl * 0.6 + car.vz / sp * 0.4;
          if (az < -0.15) aim = b.x + ax * (-(b.z) / az);
        }
        k.tx = clamp(aim * k.antic, -0.9, 0.9);
      }
      const dx = k.tx - k.x;
      const vmax = k.mode === 1 ? k.shuffle * 1.5 : k.shuffle;
      const want = clamp(dx * 6, -vmax, vmax);
      k.vx += (want - k.vx) * Math.min(1, dt * 14);
      k.x += k.vx * dt;
      k.vy = 0; k.y = 0;
      k.roll += (clamp(k.vx * 0.03, -0.12, 0.12) - k.roll) * Math.min(1, dt * 8);
      k.pose += ((k.mode === 1 ? 0.25 : 0) - k.pose) * Math.min(1, dt * 8);
      // re-plan while side-stepping if the ball keeps bending
      if (k.mode === 1 && this.touched && ((this.t * 120) | 0) % 12 === 0 && b.vz < -3 && b.z > 2.5) this.keeperPlan(true);
    } else if (k.mode === 2) {
      k.t += dt;
      k.vy -= KEEP_G * dt;
      k.x += k.vx * dt; k.y += k.vy * dt;
      const tr = k.side * 1.38;
      const st = k.rollRate * dt;
      k.roll += clamp(tr - k.roll, -st, st);
      k.pose += (1 - k.pose) * Math.min(1, dt * 10);
      if (k.y <= 0 && k.vy < 0) { k.y = 0; k.vy = 0; k.mode = 3; k.t = 0; this.ev.push(EV.LAND, 3, k.x, 0, KZ); }
    } else if (k.mode === 3) {
      k.t += dt;
      k.vx *= Math.exp(-6 * dt); k.x += k.vx * dt;
      if (k.t > 1.1) { k.mode = 4; k.t = 0; }
    } else {
      k.t += dt; k.vx = 0;
      k.roll += (0 - k.roll) * Math.min(1, dt * 5); k.pose += (0 - k.pose) * Math.min(1, dt * 5);
      if (k.t > 0.6) { k.mode = 0; k.tx = k.x; }
    }
    const lim = GX + 1.2;
    if (k.x > lim) { k.x = lim; k.vx = 0; } else if (k.x < -lim) { k.x = -lim; k.vx = 0; }
    k.update();
  }
  // look-ahead of the ball to the keeper plane (ballistic + bounces; the keeper does NOT read the curl),
  // then commit to a side step or a dive
  keeperPlan(quiet) {
    const k = this.keeper, b = this.ball;
    let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz, t = 0;
    const h = 1 / 60;
    if (vz > -1) { if (!quiet) k.mode = 0; return; }
    while (t < 2.5 && z > KZ) {
      vy -= BALL_G * h; x += vx * h; y += vy * h; z += vz * h; t += h;
      if (y < R) { y = R; vy = -vy > 1.6 ? -vy * 0.58 : 0; }
    }
    if (z > KZ) { if (!quiet) k.mode = 0; return; }
    const bs = Math.sqrt(vx * vx + vz * vz);
    if (quiet) {
      // small correction only (bigger when the ball is slow and easy to read), no new dive decision
      if ((Math.abs(x - k.x) < 1.6 || t > 0.7) && y < 2.7) k.tx = clamp(x, -GX, GX);
      return;
    }
    // slow balls are easy reads: less error, and the keeper simply walks across
    const n = (this.rand() + this.rand() + this.rand() - 1.5) * k.noise * clamp(bs / 22, 0.25, 1);
    x += n; y += n * 0.3;
    k.predX = x; k.predY = y; k.predT = t;
    k.wide = Math.abs(x) > GX + R * 0.6 || y > GY + R * 0.7;
    if (k.wide) { k.mode = 1; k.tx = clamp(x, -2.5, 2.5) * 0.5; return; }
    if (Math.abs(x) > 1.6 && this.rand() < k.guess) { x = -x * 0.7; k.predX = x; }
    const dx = x - k.x;
    if ((Math.abs(dx) < 1.05 || Math.abs(dx) < k.shuffle * 1.5 * (t - 0.25)) && y < 2.7) { k.mode = 1; k.tx = clamp(x, -GX, GX); return; }
    k.mode = 2; k.t = 0; k.side = dx > 0 ? 1 : -1;
    const need = Math.max(0, Math.abs(dx) - 1.5);
    k.vx = k.side * clamp(need / Math.max(0.12, t) + 1.5, 2.5, k.diveMax);
    k.vy = clamp(1.6 + (y - 1.0) * 2.4, 1.6, 6.6);
    this.ev.push(EV.DIVE, k.side, k.x, 0, KZ);
  }

  // ---- attempt result
  judge(dt) {
    const b = this.ball;
    if (this.result) return;
    if (!this.crossed && b.z < 0) { this.crossed = true; }
    if (b.z < -R && Math.abs(b.x) < GX - PR && b.y < GY) { this.finish(RES.GOAL); this.ev.push(EV.CROSS, 1, b.x, b.y, b.z); return; }
    if (b.z < -0.3 && (Math.abs(b.x) > GX + PR || b.y > GY + PR)) { this.finish(this.keeperT >= 0 ? RES.SAVE : RES.MISS); return; }
    if (!this.touched) { if (this.t >= SHOT_TIME) this.finish(RES.TIME); return; }
    const since = this.t - this.touchT;
    if (this.keeperT >= 0 && this.t - this.keeperT > 1.0) { this.finish(RES.SAVE); return; }
    if (b.vz > 0.5 && b.z > 1.5) this.awayT += dt; else this.awayT = 0;
    const s2 = b.vx * b.vx + b.vz * b.vz + b.vy * b.vy;
    if (s2 < 1.5 && b.z > 0.5) this.restT += dt; else this.restT = 0;
    if (this.awayT > 0.6 || this.restT > 0.6) { this.finish(this.keeperT >= 0 ? RES.SAVE : RES.MISS); return; }
    if (since > 3.5 || this.t > SHOT_TIME + 3.5) this.finish(this.keeperT >= 0 ? RES.SAVE : RES.MISS);
  }
  finish(r) { this.result = r; this.resultT = this.t; }
}
