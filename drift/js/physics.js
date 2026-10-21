// DRIFT KICK physics: arcade car, Rocket-League-ish ball, AI keeper, attempt judge.
// Pure JS, deterministic for a given seed, no three.js, no allocation inside step().
// World axes: goal line is z = 0, the goal (net) is at z < 0, the pitch runs to +z. y is up.

export const DT = 1 / 120;
export const GX = 6.0;      // post centre |x|
export const GY = 4.0;      // crossbar centre height
export const GD = 2.6;      // net depth
export const PR = 0.16;     // post / bar radius
export const R = 0.95;      // ball radius
export const KZ = 0.85;     // keeper plane
export const SPOT = 10;     // penalty spot z
export const AX = 21;       // arena half width
export const AZ0 = -5.6;    // wall behind goal
export const AZ1 = 40;      // far wall
export const SHOT_TIME = 6; // seconds to touch the ball

const BALL_G = 13, CAR_G = 22, KEEP_G = 16;
const BALL_MAX = 44;

export const RES = { NONE: 0, GOAL: 1, SAVE: 2, MISS: 3, TIME: 4 };
export const EV = { HIT: 1, POST: 2, NET: 3, SAVE: 4, BOUNCE: 5, BOOST: 6, LEVEL: 7, JUMP: 8, WALL: 9, LAND: 10, DIVE: 11, DRIFT: 12, CROSS: 13 };
export const LEVEL_T = [0, 0.4, 0.85, 1.4];      // drift time to reach blue / orange / purple
const BOOST_T = [0, 0.6, 0.95, 1.3];
const BOOST_KICK = [0, 3, 5, 7];
export const BOOST_TOP = [0, 25, 28, 31];

// where the car starts an attempt: ~19 m behind the ball, off to one side, roughly facing it
export function attemptStart(rand, out) {
  out.x = (rand() - 0.5) * 10;
  out.z = SPOT + 23;
  out.yaw = Math.atan2(-out.x * 0.7, SPOT - out.z) + (rand() - 0.5) * 0.25;
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
export class Car {
  constructor(def) { this.def = def; this.reset(0, 26, Math.PI, 6); }
  reset(x, z, yaw, speed) {
    this.x = x; this.y = 0; this.z = z;
    this.vx = Math.sin(yaw) * speed; this.vy = 0; this.vz = Math.cos(yaw) * speed;
    this.yaw = yaw; this.yawRate = 0; this.pitch = 0; this.onGround = true; this.air = 0;
    this.drifting = false; this.driftDir = 0; this.charge = 0; this.level = 0;
    this.boostT = 0; this.boostLv = 0; this.slip = 0; this.speed = speed; this.steer = 0;
    this.jumpHeld = false; this.driftHeld = false; this.lastLevel = 0;
    this.savePrev();
  }
  savePrev() { this.px = this.x; this.py = this.y; this.pz = this.z; this.pyaw = this.yaw; this.ppitch = this.pitch; }
  step(inp, dt, ev) {
    const d = this.def;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let vF = this.vx * sy + this.vz * cy;
    let vS = -this.vx * cy + this.vz * sy;
    const steer = clamp(inp.steer, -1, 1);
    this.steer += (steer - this.steer) * Math.min(1, dt * 14);

    // ---- drift state
    if (inp.drift && !this.driftHeld && this.onGround && vF > 4) {
      this.drifting = true; this.driftDir = Math.abs(steer) > 0.25 ? Math.sign(steer) : 0; this.charge = 0; this.level = 0; this.lastLevel = 0;
      ev.push(EV.DRIFT, this.driftDir);
    }
    if (this.drifting && this.driftDir === 0 && Math.abs(steer) > 0.3) this.driftDir = Math.sign(steer);
    if (this.drifting && (!inp.drift || vF < 2.5)) {
      // release -> mini-turbo
      const lv = vF >= 2.5 ? this.level : 0;
      if (lv > 0) { this.boostT = BOOST_T[lv]; this.boostLv = lv; vF += BOOST_KICK[lv]; ev.push(EV.BOOST, lv); }
      this.drifting = false; this.driftDir = 0; this.charge = 0; this.level = 0;
    }
    this.driftHeld = !!inp.drift;

    // ---- jump
    if (inp.jump && !this.jumpHeld && this.onGround) {
      this.vy = d.jump; this.onGround = false; this.air = 0; ev.push(EV.JUMP, 0);
    }
    this.jumpHeld = !!inp.jump;

    // ---- longitudinal
    const boosting = this.boostT > 0;
    const top = boosting ? BOOST_TOP[this.boostLv] + (d.maxSpeed - 16) : d.maxSpeed;
    if (this.onGround) {
      if (inp.brake) {
        vF -= (vF > 0 ? 34 : 9) * dt; if (vF < -6) vF = -6;
      } else if (vF < top) {
        const k = vF / top;
        vF += (boosting ? 48 : d.accel) * (1 - k * k * 0.85) * dt;
        if (vF > top) vF = top;
      } else {
        vF -= (boosting ? 2 : 9) * dt;
      }
      if (this.drifting) vF -= 2.2 * dt;
      // lateral grip; a drift turns most of the scrubbed slide back into forward speed
      const g = this.drifting ? d.driftGrip : d.grip;
      const keep = Math.exp(-g * dt);
      const lost = vS * (1 - keep);
      vS -= lost;
      vF += Math.abs(lost) * (this.drifting ? 0.55 : 0.25);
    } else if (boosting) {
      vF += 20 * dt; if (vF > top) vF = top;
    }

    // ---- yaw
    const spd = Math.abs(vF);
    const sf = Math.min(1, spd / 4) * (vF < -0.5 ? -1 : 1);
    let tgt;
    if (this.drifting && this.driftDir !== 0) {
      const a = steer * this.driftDir; // +1 tighter, -1 wider
      tgt = -this.driftDir * d.turn * (0.62 + 0.4 * a) * Math.abs(sf);
    } else if (this.drifting) {
      tgt = -steer * d.turn * 1.1 * sf;
    } else {
      tgt = -steer * d.turn * sf * (1 - 0.32 * Math.min(1, spd / d.maxSpeed));
    }
    if (!this.onGround) tgt *= 0.45;
    const yr = this.drifting ? 7 : 12;
    this.yawRate += (tgt - this.yawRate) * Math.min(1, dt * yr);
    this.yaw += this.yawRate * dt;
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2; else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;

    // ---- drift charge
    if (this.drifting && this.driftDir !== 0 && this.onGround && vF > 6) {
      const a = steer * this.driftDir;
      this.charge += dt * d.chargeRate * (0.75 + 0.5 * (a > 0 ? a : 0));
      const lv = this.charge >= LEVEL_T[3] ? 3 : this.charge >= LEVEL_T[2] ? 2 : this.charge >= LEVEL_T[1] ? 1 : 0;
      if (lv !== this.level) { this.level = lv; ev.push(EV.LEVEL, lv); }
    }
    if (this.boostT > 0) { this.boostT -= dt; if (this.boostT <= 0) { this.boostT = 0; this.boostLv = 0; } }

    // recompose in the (old) heading frame
    this.vx = sy * vF - cy * vS;
    this.vz = cy * vF + sy * vS;
    this.slip = Math.atan2(vS, Math.max(1, Math.abs(vF)));

    // ---- vertical
    if (!this.onGround) {
      this.air += dt;
      this.vy -= CAR_G * dt;
      this.y += this.vy * dt;
      const tp = clamp(this.vy * 0.055, -0.18, 0.34);
      this.pitch += (tp - this.pitch) * Math.min(1, dt * 10);
      if (this.y <= 0) {
        this.y = 0; ev.push(EV.LAND, -this.vy); this.vy = 0; this.onGround = true;
      }
    } else {
      this.pitch += (0 - this.pitch) * Math.min(1, dt * 12);
    }
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
  }
}

// ---------------------------------------------------------------- ball
export class Ball {
  constructor() { this.reset(0, SPOT); }
  reset(x, z) { this.x = x; this.y = R; this.z = z; this.vx = 0; this.vy = 0; this.vz = 0; this.savePrev(); }
  savePrev() { this.px = this.x; this.py = this.y; this.pz = this.z; }
}

// ---------------------------------------------------------------- keeper
// A big toy goalie: body capsule + glove bar, rolls (dives) around the z axis.
export class Keeper {
  constructor() { this.setDiff(0.3); this.reset(); }
  setDiff(dd) {
    const d = clamp(dd, 0, 1);
    this.diff = d;
    this.react = 0.26 - 0.13 * d;         // seconds before reacting to a shot
    this.antic = 0.1 + 0.3 * d;           // how much it pre-positions on your approach line
    this.shuffle = 2.4 + 2.0 * d;         // m/s side step
    this.diveMax = 4.6 + 2.8 * d;         // m/s dive
    this.noise = 1.15 - 0.85 * d;         // read error (m) on the crossing point
    this.rollRate = 3.6 + 3.0 * d;
    this.guess = 0.24 - 0.2 * d;          // chance to commit the wrong way on an angled shot
  }
  reset() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.roll = 0; this.pose = 0; this.mode = 0; this.t = 0;
    this.tx = 0; this.reactT = -1; this.side = 0; this.seenTouch = 0; this.px = 0; this.py = 0; this.proll = 0;
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
  // gloves: spread at the shoulders when standing, overhead when diving
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
    this.inp = { steer: 0, drift: false, jump: false, brake: false };
    this.setup(0, 26, Math.PI, 0.3);
  }
  setup(cx, cz, yaw, diff) {
    this.car.reset(cx, cz, yaw, 9);
    this.ball.reset(0, SPOT);
    this.keeper.reset(); this.keeper.setDiff(diff);
    this.t = 0; this.touched = 0; this.touchT = -1; this.keeperT = -1; this.post = false;
    this.result = RES.NONE; this.resultT = -1; this.crossed = false; this.shotSpeed = 0; this.restT = 0; this.awayT = 0;
    this.ev.clear();
  }
  // one fixed step
  step(inp) {
    const dt = DT, car = this.car, b = this.ball, k = this.keeper, ev = this.ev;
    car.savePrev(); b.savePrev(); k.savePrev();
    this.t += dt;
    car.step(inp, dt, ev);
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

  // ---- ball
  ballStep(dt) {
    const b = this.ball, ev = this.ev;
    b.vy -= BALL_G * dt;
    const dr = 1 - 0.045 * dt; b.vx *= dr; b.vy *= dr; b.vz *= dr;
    let s2 = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
    if (s2 > BALL_MAX * BALL_MAX) { const f = BALL_MAX / Math.sqrt(s2); b.vx *= f; b.vy *= f; b.vz *= f; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    // ground
    if (b.y < R) {
      b.y = R;
      if (b.vy < 0) {
        const imp = -b.vy;
        if (imp > 1.8) { b.vy = imp * 0.6; b.vx *= 0.94; b.vz *= 0.94; if (imp > 3) ev.push(EV.BOUNCE, imp, b.x, b.z); }
        else b.vy = 0;
      }
      if (b.vy === 0) {
        const hs = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
        if (hs > 0) { const f = Math.max(0, hs - 1.6 * dt) / hs; b.vx *= f; b.vz *= f; }
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
    // keeper
    const k = this.keeper;
    const kvx = k.vx, kvy = k.vy;
    let jk = this.ballSeg(k.b0x, k.b0y, KZ, k.b1x, k.b1y, KZ, 0.55, 0.35, 0.2, kvx, kvy, 0);
    jk += this.ballSeg(k.a0x, k.a0y, KZ, k.a1x, k.a1y, KZ, 0.32, 0.35, 0.2, kvx, kvy, 0);
    if (jk > 0.5) {
      if (b.vz < 2.5) b.vz = 2.5 + Math.abs(b.vz) * 0.15; // parry out
      if (this.keeperT < 0) { this.keeperT = this.t; }
      ev.push(EV.SAVE, jk, b.x, b.y, b.z);
      if (!emit && this.keeperT < 0) this.keeperT = this.t;
    }
    // posts + crossbar
    let j = 0;
    j = this.ballSeg(GX, 0, 0, GX, GY, 0, PR, 0.7, 0.05, 0, 0, 0); if (j > 2) { this.post = true; ev.push(EV.POST, j, GX, b.y, 0); }
    j = this.ballSeg(-GX, 0, 0, -GX, GY, 0, PR, 0.7, 0.05, 0, 0, 0); if (j > 2) { this.post = true; ev.push(EV.POST, j, -GX, b.y, 0); }
    j = this.ballSeg(-GX, GY, 0, GX, GY, 0, PR, 0.7, 0.05, 0, 0, 0); if (j > 2) { this.post = true; ev.push(EV.POST, j, b.x, GY, 0); }
    // nets: soft, swallow the ball
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
  // axis-aligned rectangle panel: plane coordinate c on `axis`, extents on the two other axes
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
    return this.resolve(nx, ny, nz, e, fr, 0, 0, 0);
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

  // ---- car vs ball (oriented box vs sphere, impulse + Rocket-League-style push)
  carBall() {
    const car = this.car, b = this.ball, d = car.def;
    const sy = Math.sin(car.yaw), cy = Math.cos(car.yaw), sp = Math.sin(car.pitch), cp = Math.cos(car.pitch);
    const fx = sy * cp, fy = sp, fz = cy * cp;
    const ux = -sy * sp, uy = cp, uz = -cy * sp;
    const rx = -cy, rz = sy;
    const ch = d.hh + 0.16;
    const cx = car.x + ux * ch, cyy = car.y + uy * ch, cz = car.z + uz * ch;
    const dx = b.x - cx, dy = b.y - cyy, dz = b.z - cz;
    const lx = dx * rx + dz * rz, ly = dx * ux + dy * uy + dz * uz, lz = dx * fx + dy * fy + dz * fz;
    if (Math.abs(lx) > d.hw + R || Math.abs(ly) > d.hh + R || Math.abs(lz) > d.hl + R) return;
    let qx = clamp(lx, -d.hw, d.hw), qy = clamp(ly, -d.hh, d.hh), qz = clamp(lz, -d.hl, d.hl);
    let nlx = lx - qx, nly = ly - qy, nlz = lz - qz;
    let dist = Math.sqrt(nlx * nlx + nly * nly + nlz * nlz), pen;
    if (dist < 1e-4) { // centre inside the box: push out along the shallowest axis
      const px = d.hw - Math.abs(lx), py = d.hh - Math.abs(ly), pz = d.hl - Math.abs(lz);
      nlx = nly = nlz = 0;
      if (pz <= px && pz <= py) { nlz = lz >= 0 ? 1 : -1; pen = R + pz; qz = nlz * d.hl; }
      else if (px <= py) { nlx = lx >= 0 ? 1 : -1; pen = R + px; qx = nlx * d.hw; }
      else { nly = ly >= 0 ? 1 : -1; pen = R + py; qy = nly * d.hh; }
    } else {
      if (dist >= R) return;
      pen = R - dist; nlx /= dist; nly /= dist; nlz /= dist;
    }
    // world normal + contact point
    const nx = nlx * rx + nly * ux + nlz * fx, ny = nly * uy + nlz * fy, nz = nlx * rz + nly * uz + nlz * fz;
    const qwx = cx + qx * rx + qy * ux + qz * fx, qwy = cyy + qy * uy + qz * fy, qwz = cz + qx * rz + qy * uz + qz * fz;
    // separate (ball takes most of it)
    b.x += nx * pen * 0.9; b.y += ny * pen * 0.9; b.z += nz * pen * 0.9;
    car.x -= nx * pen * 0.1; car.z -= nz * pen * 0.1;
    // velocity of the car at the contact point
    const wy = car.yawRate, ox = qwx - car.x, oz = qwz - car.z;
    const cvx = car.vx + wy * oz, cvy = car.vy, cvz = car.vz - wy * ox;
    const rvx = b.vx - cvx, rvy = b.vy - cvy, rvz = b.vz - cvz;
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (vn >= -0.2) return true;
    const mb = 1, mc = d.mass, e = 0.5;
    const j = -(1 + e) * vn / (1 / mb + 1 / mc);
    b.vx += j * nx; b.vy += j * ny; b.vz += j * nz;
    // RL-style extra shove from the car centre through the ball (flattened), scales with closing speed
    let hx = b.x - car.x, hy = (b.y - car.y - 0.5) * 0.35, hz = b.z - car.z;
    const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1; hx /= hl; hy /= hl; hz /= hl;
    const bonus = Math.min(14, -vn * 0.3);
    b.vx += hx * bonus; b.vy += hy * bonus + Math.max(0, -vn) * 0.04; b.vz += hz * bonus;
    // air chip: hitting it while airborne (nose up) scoops the ball for a lofted shot
    if (!car.onGround) b.vy += 1.5 + Math.max(0, -vn) * 0.2;
    car.vx -= j * nx / mc; car.vz -= j * nz / mc; if (!car.onGround) car.vy -= j * ny / mc;
    if (b.y < R) { b.y = R; if (b.vy < 0) b.vy = -b.vy * 0.6; } // never shove it into the ground
    const pow = -vn;
    if (!this.touched) { this.touchT = this.t; }
    this.touched++;
    this.shotSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
    this.ev.push(EV.HIT, pow, qwx, qwy, qwz);
    return true;
  }

  // ---- keeper brain + body
  keeperStep(dt) {
    const k = this.keeper, b = this.ball, car = this.car;
    if (k.mode === 0 || k.mode === 1) {
      // 0 = set, 1 = side-stepping to a read
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
        if (tl < 16 && tow > 0.3 && b.z > 1) {
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
    } else if (k.mode === 2) {
      // dive
      k.t += dt;
      k.vy -= KEEP_G * dt;
      k.x += k.vx * dt; k.y += k.vy * dt;
      const tr = k.side * 1.38;
      const st = k.rollRate * dt;
      k.roll += clamp(tr - k.roll, -st, st);
      k.pose += (1 - k.pose) * Math.min(1, dt * 10);
      if (k.y <= 0 && k.vy < 0) { k.y = 0; k.vy = 0; k.mode = 3; k.t = 0; this.ev.push(EV.LAND, 3, k.x, 0, KZ); }
    } else if (k.mode === 3) {
      // on the floor
      k.t += dt;
      k.vx *= Math.exp(-6 * dt); k.x += k.vx * dt;
      if (k.t > 1.1) { k.mode = 4; k.t = 0; }
    } else {
      // get up
      k.t += dt; k.vx = 0;
      k.roll += (0 - k.roll) * Math.min(1, dt * 5); k.pose += (0 - k.pose) * Math.min(1, dt * 5);
      if (k.t > 0.6) { k.mode = 0; k.tx = k.x; }
    }
    const lim = GX + 1.2;
    if (k.x > lim) { k.x = lim; k.vx = 0; } else if (k.x < -lim) { k.x = -lim; k.vx = 0; }
    k.update();
  }
  // ballistic look-ahead of the ball to the keeper plane (with ground bounces), then commit
  keeperPlan() {
    const k = this.keeper, b = this.ball;
    let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz, t = 0;
    const h = 1 / 60;
    if (vz > -1) { k.mode = 0; return; }
    while (t < 2 && z > KZ) {
      vy -= BALL_G * h; x += vx * h; y += vy * h; z += vz * h; t += h;
      if (y < R) { y = R; vy = -vy > 1.8 ? -vy * 0.6 : 0; }
    }
    if (z > KZ) { k.mode = 0; return; }
    const n = (this.rand() + this.rand() + this.rand() - 1.5) * k.noise;
    x += n; y += n * 0.3;
    k.predX = x; k.predY = y; k.predT = t;
    k.wide = Math.abs(x) > GX + R * 0.6 || y > GY + R * 0.7;
    if (k.wide) { k.mode = 1; k.tx = clamp(x, -2.5, 2.5) * 0.5; return; }
    if (Math.abs(x) > 1.6 && this.rand() < k.guess) { x = -x * 0.7; k.predX = x; } // wrong-footed
    const dx = x - k.x;
    if (Math.abs(dx) < 1.05 && y < 2.7) { k.mode = 1; k.tx = x; return; }
    // dive
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
    // rolling away / dead ball
    if (b.vz > 0.5 && b.z > 1.5) this.awayT += dt; else this.awayT = 0;
    const s2 = b.vx * b.vx + b.vz * b.vz + b.vy * b.vy;
    if (s2 < 1.5 && b.z > 0.5) this.restT += dt; else this.restT = 0;
    if (this.awayT > 0.6 || this.restT > 0.6) { this.finish(this.keeperT >= 0 ? RES.SAVE : RES.MISS); return; }
    if (since > 3.2 || this.t > SHOT_TIME + 3) this.finish(this.keeperT >= 0 ? RES.SAVE : RES.MISS);
  }
  finish(r) { this.result = r; this.resultT = this.t; }
}
