// Car roster: handling stats (used by physics) + look (used by render). Pure data.
// stats bars are 1..5 for the menu.
export const CARS = [
  {
    id: 'pebble', name: 'Pebble', unlock: 0, shape: 'hatch',
    color: 0xff4436, accent: 0xfff1e0, rim: 0xd8dde6,
    maxSpeed: 16, accel: 22, turn: 2.7, grip: 11, driftGrip: 5.6, chargeRate: 1.0, mass: 3.0,
    hl: 1.0, hw: 0.64, hh: 0.36, wheelR: 0.36,
    bars: { speed: 3, power: 3, drift: 3 },
  },
  {
    id: 'bolt', name: 'Bolt', unlock: 3, shape: 'wedge',
    color: 0xffbf1a, accent: 0x1b1d24, rim: 0x2a2d35,
    maxSpeed: 17.6, accel: 24, turn: 2.55, grip: 11, driftGrip: 5.0, chargeRate: 0.95, mass: 2.8,
    hl: 1.05, hw: 0.64, hh: 0.31, wheelR: 0.34,
    bars: { speed: 5, power: 3, drift: 2 },
  },
  {
    id: 'brick', name: 'Brick', unlock: 8, shape: 'van',
    color: 0x2f7cf6, accent: 0xffffff, rim: 0xe8ecf2,
    maxSpeed: 15.2, accel: 20, turn: 2.45, grip: 12, driftGrip: 6.2, chargeRate: 0.95, mass: 4.2,
    hl: 1.08, hw: 0.7, hh: 0.46, wheelR: 0.38,
    bars: { speed: 2, power: 5, drift: 2 },
  },
  {
    id: 'comet', name: 'Comet', unlock: 15, shape: 'racer',
    color: 0x9b4dff, accent: 0x7cf3ff, rim: 0x16181e,
    maxSpeed: 17, accel: 23, turn: 3.0, grip: 11, driftGrip: 4.8, chargeRate: 1.3, mass: 2.8,
    hl: 1.06, hw: 0.66, hh: 0.3, wheelR: 0.33,
    bars: { speed: 4, power: 2, drift: 5 },
  },
  {
    id: 'stomper', name: 'Stomper', unlock: 25, shape: 'monster',
    color: 0x22c97a, accent: 0xffe14a, rim: 0x1d2026,
    maxSpeed: 15.8, accel: 22, turn: 2.6, grip: 10, driftGrip: 5.6, chargeRate: 1.05, mass: 3.6,
    hl: 1.0, hw: 0.68, hh: 0.4, wheelR: 0.5,
    bars: { speed: 3, power: 4, drift: 3 },
  },
];

// opponent (AI team) car look
export const AI_CAR = { ...CARS[0], id: 'ai', name: 'Rival', color: 0x2b3140, accent: 0xff5ab4, rim: 0xff5ab4, shape: 'wedge' };
