// Procedural scene layouts. Everything is centred on x = 0, z = 0, ground at y = 0, about 3.5 m wide.
import { BL, BH, BD, BOTTLE_H, CAN_H, BARREL_H, GLASS_TINTS, PAINT } from './things.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (a) => a[(Math.random() * a.length) | 0];
const chance = (p) => Math.random() < p;

function cut(segs, a, b) {
  const out = [];
  for (const [s, e] of segs) {
    if (s < a) out.push([s, Math.min(e, a)]);
    if (e > b) out.push([Math.max(s, b), e]);
  }
  return out.filter((q) => q[1] - q[0] > 0.02);
}

// running-bond brick wall with optional window holes (glass pane + wooden lintel)
function brickWall(K, { cols, rows, z = 0, x0 = -(cols * BL) / 2, windows = [], y0 = 0 }) {
  const xR = x0 + cols * BL;
  for (let row = 0; row < rows; row++) {
    const xs = [x0];
    for (let x = x0 + (row % 2 ? BL / 2 : BL); x < xR - 1e-6; x += BL) xs.push(x);
    xs.push(xR);
    let segs = [];
    for (let i = 0; i < xs.length - 1; i++) segs.push([xs[i], xs[i + 1]]);
    for (const w of windows) {
      if (row >= w.r0 && row < w.r1) segs = cut(segs, w.x0, w.x1);
      if (row === w.r1) segs = cut(segs, w.x0 - 0.12, w.x1 + 0.12);
    }
    for (const [s, e] of segs) if (e - s > 0.06) K.brick((s + e) / 2, y0 + row * BH, z, e - s);
  }
  for (const w of windows) {
    K.pane((w.x0 + w.x1) / 2, y0 + w.r0 * BH, z, w.x1 - w.x0 - 0.02, (w.r1 - w.r0) * BH - 0.01, { tint: w.tint });
    if (w.r1 < rows) K.board((w.x0 + w.x1) / 2, y0 + w.r1 * BH, z, w.x1 - w.x0 + 0.24, BD, BH);
  }
}

function bottlesRow(K, xa, xb, y, z, step = 0.2, pCan = 0.25) {
  for (let x = xa + step / 2; x <= xb - step / 2 + 1e-6; x += step) {
    if (chance(pCan)) K.can(x, y, z); else K.bottle(x, y, z);
  }
}
function canPyramid(K, x, y, z, base) {
  const s = 0.138;
  for (let r = 0; r < base; r++) {
    const n = base - r;
    for (let i = 0; i < n; i++) K.can(x + (i - (n - 1) / 2) * s, y + r * (CAN_H + 0.002), z);
  }
}

export const SCENES = {
  // brick wall with glass windows
  wall(K) {
    const cols = 9, rows = irnd(11, 13), xL = (-cols * BL) / 2;
    const tint = pick(GLASS_TINTS);
    const wins = chance(0.5)
      ? [{ x0: xL + 3 * BL, x1: xL + 6 * BL, r0: 3, r1: 7, tint }]
      : [{ x0: xL + 1 * BL, x1: xL + 4 * BL, r0: irnd(2, 4), r1: 0, tint }, { x0: xL + 5 * BL, x1: xL + 8 * BL, r0: irnd(2, 4), r1: 0, tint }];
    for (const w of wins) if (!w.r1) w.r1 = w.r0 + irnd(3, 4);
    brickWall(K, { cols, rows, windows: wins });
    const top = rows * BH;
    const n = irnd(3, 5);
    for (let i = 0; i < n; i++) {
      const x = xL + 0.25 + (i + 0.5) * ((cols * BL - 0.5) / n) + rnd(-0.08, 0.08);
      if (chance(0.7)) K.bottle(x, top, 0); else K.can(x, top, 0);
    }
  },

  // glass greenhouse on a brick footing
  greenhouse(K) {
    const ph = rnd(1.0, 1.25), depth = 1.3, zF = 0.35, zB = zF - depth, pw = 0.98;
    const tint = pick(GLASS_TINTS);
    brickWall(K, { cols: 9, rows: 1, z: zF });
    brickWall(K, { cols: 9, rows: 1, z: zB });
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 1.0;
      K.pane(x, BH, zF, pw, ph, { tint });
      K.pane(x, BH, zB, pw, ph, { tint });
    }
    for (const sx of [-1, 1]) {
      K.board(sx * 1.43, 0, (zF + zB) / 2, depth - 0.2, 0.12, BH, Math.PI / 2);
      K.pane(sx * 1.43, BH, (zF + zB) / 2, depth - 0.24, ph, { rotY: Math.PI / 2, tint });
    }
    for (let i = 0; i < 3; i++) K.pane((i - 1) * 1.0, BH + ph, (zF + zB) / 2, pw, depth + 0.06, { flat: true, tint });
    // plants on a crate inside
    K.crate(0, 0, (zF + zB) / 2, 0.45);
    bottlesRow(K, -0.2, 0.2, 0.45, (zF + zB) / 2, 0.2, 0);
    if (chance(0.6)) { K.crate(-0.8, 0, (zF + zB) / 2, 0.4); K.bottle(-0.8, 0.4, (zF + zB) / 2); }
  },

  // crate pyramid with barrels and cans
  crates(K) {
    const rows = irnd(3, 4), s = 0.52, g = 0.015;
    for (let r = 0; r < rows; r++) {
      const n = rows - r;
      for (let i = 0; i < n; i++) K.crate((i - (n - 1) / 2) * (s + g), r * s, 0, s);
    }
    canPyramid(K, 0, rows * s, 0, 3);
    const bx = (rows * (s + g)) / 2 + 0.34;
    for (const sx of [-1, 1]) {
      K.barrel(sx * bx, 0, 0.05);
      if (chance(0.5)) { K.can(sx * bx - 0.08, BARREL_H, 0.05); K.can(sx * bx + 0.08, BARREL_H, 0.05); }
      else K.bottle(sx * bx, BARREL_H, 0.05);
    }
    if (rows === 3) { K.pane(0, 0, 0.75, 0.9, 0.6, { tint: pick(GLASS_TINTS) }); }
  },

  // kitchen shelf full of bottles
  shelf(K) {
    const cs = 0.4, bt = 0.05, L = 3.3, levels = irnd(3, 4), xs = [-1.45, 0, 1.45];
    let y = 0;
    for (let lv = 0; lv < levels; lv++) {
      for (const x of xs) K.crate(x, y, 0, cs);
      y += cs;
      K.board(0, y, 0, L, 0.44, bt);
      y += bt;
      if (lv < levels - 1) { bottlesRow(K, -1.25, -0.2, y, 0); bottlesRow(K, 0.2, 1.25, y, 0); }
      else bottlesRow(K, -1.6, 1.6, y, 0, 0.2, 0.2);
    }
  },

  // junkyard: barrels, a wrecked-to-be fridge, a car door, pipes, cans
  junk(K) {
    const xs = [-0.62, 0, 0.62];
    for (const x of xs) K.barrel(x, 0, -0.55);
    K.board(0, BARREL_H, -0.55, 1.9, 0.5, 0.05);
    canPyramid(K, 0, BARREL_H + 0.05, -0.55, 4);
    const fx = chance(0.5) ? 1 : -1;
    K.fridge(fx * 1.4, 0, -0.15, -fx * 0.2);
    K.cardoor(-fx * 1.3, 0, 0.35, fx * 0.25);
    const pz = 0.9;
    for (let i = 0; i < 3; i++) K.pipe(0, 0.08, pz + (i - 1) * 0.165, 1.1);
    for (let i = 0; i < 2; i++) K.pipe(0, 0.22, pz + (i - 0.5) * 0.165, 1.1);
  },

  // kitchen: fridge, washing machine, a counter with a microwave, bottles, a window
  kitchen(K) {
    const flip = chance(0.5) ? -1 : 1;
    K.pane(0.75 * flip, 0, -0.8, 1.5, 1.3, { tint: pick(GLASS_TINTS) });
    K.fridge(-1.35 * flip, 0, -0.1);
    K.washer(-0.5 * flip, 0, -0.05);
    for (const x of [0.02, 1.62]) for (let r = 0; r < 4; r++) { K.brick(x * flip - BD / 2, r * BH, 0, BL, Math.PI / 2); K.brick(x * flip + BD / 2, r * BH, 0, BL, Math.PI / 2); }
    K.board(0.82 * flip, 4 * BH, 0, 1.95, 0.56, 0.05);
    const ty = 4 * BH + 0.05;
    K.microwave(0.5 * flip, ty, -0.05);
    for (let i = 0; i < 4; i++) K.bottle((1.05 + i * 0.17) * flip, ty, -0.1 + (i % 2) * 0.16);
    canPyramid(K, 1.4 * flip, ty, 0.15, 2);
  },

  // electronics yard: vending machine, a stack of old TVs, a flat TV, a microwave
  electronics(K) {
    const flip = chance(0.5) ? -1 : 1;
    K.vending(-1.3 * flip, 0, -0.25);
    K.crt(-0.35 * flip, 0, 0.05, rnd(-0.15, 0.15));
    K.crt(0.3 * flip, 0, 0.0, rnd(-0.15, 0.15));
    K.crt(-0.02 * flip, 0.5, 0.0, rnd(-0.1, 0.1));
    K.microwave(-0.02 * flip, 1.0, 0.0);
    K.flattv(1.28 * flip, 0, 0.1, -flip * 0.2);
    for (let i = 0; i < 4; i++) K.can((0.6 + i * 0.15) * flip, 0, 0.7);
    canPyramid(K, -0.4 * flip, 0, 0.75, 3);
  },

  // glass rack: brick pillars, boards, rows of coloured panes
  glassrack(K) {
    const levels = irnd(3, 4), ph = 3 * BH, bt = 0.05, xs = [-1.5, 0, 1.5];
    let y = 0;
    for (let lv = 0; lv < levels; lv++) {
      for (const x of xs) for (let k = 0; k < 3; k++) K.brick(x, y + k * BH, 0, BL, Math.PI / 2);
      for (const bay of [[-1.41, -0.09], [0.09, 1.41]]) {
        const n = 2, w = (bay[1] - bay[0]) / n;
        for (let i = 0; i < n; i++) K.pane(bay[0] + w * (i + 0.5), y, 0, w - 0.03, ph - 0.03, { tint: pick(GLASS_TINTS) });
      }
      y += ph;
      K.board(0, y, 0, 3.35, BL, bt);
      y += bt;
    }
    bottlesRow(K, -1.5, 1.5, y, 0, 0.25, 0.3);
  },

  // fairground table: bottles and a can pyramid, shop windows behind
  fair(K) {
    for (const x of [-1.2, 1.2]) for (let r = 0; r < 4; r++) { K.brick(x - BD / 2 - 0.001, r * BH, 0, BL, Math.PI / 2); K.brick(x + BD / 2 + 0.001, r * BH, 0, BL, Math.PI / 2); }
    const ty = 4 * BH;
    K.board(0, ty, 0, 3.0, 0.5, 0.06);
    const y = ty + 0.06;
    bottlesRow(K, -1.45, -0.35, y, 0.12, 0.18, 0.15);
    bottlesRow(K, 0.35, 1.45, y, 0.12, 0.18, 0.15);
    bottlesRow(K, -1.45, -0.35, y, -0.12, 0.18, 0.4);
    bottlesRow(K, 0.35, 1.45, y, -0.12, 0.18, 0.4);
    K.crate(0, y, 0, 0.42);
    canPyramid(K, 0, y + 0.42, 0, 3);
    const tint = pick(GLASS_TINTS);
    K.pane(-0.85, 0, -1.0, 1.5, 1.7, { tint });
    K.pane(0.85, 0, -1.0, 1.5, 1.7, { tint });
  },
};

export const SCENE_NAMES = Object.keys(SCENES);
