// Color Gates levels: a voxel shape, an arrow per cube, a color per cube and
// the order in which colored gates arrive. Every level is solvable.

export const DIRS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export const GATE_SIZE = 3;

// Each color also has a symbol so colors are never the only cue.
export const COLORS = [
  { hex: 0xff5d5d, css: '#ff5d5d', symbol: 'circle', name: 'κόκκινο' },
  { hex: 0x4d8dff, css: '#4d8dff', symbol: 'square', name: 'μπλε' },
  { hex: 0xffd23f, css: '#ffd23f', symbol: 'triangle', name: 'κίτρινο' },
  { hex: 0x3ccf7a, css: '#3ccf7a', symbol: 'diamond', name: 'πράσινο' },
  { hex: 0xb36bff, css: '#b36bff', symbol: 'plus', name: 'μωβ' },
  { hex: 0xff9a3c, css: '#ff9a3c', symbol: 'star', name: 'πορτοκαλί' },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Shapes ----------

function box(a, b, c) {
  const out = [];
  for (let x = 0; x < a; x++)
    for (let y = 0; y < b; y++)
      for (let z = 0; z < c; z++) out.push([x, y, z]);
  return out;
}

function pyramid(base) {
  const out = [];
  for (let y = 0; base - 2 * y > 0; y++) {
    const s = base - 2 * y;
    for (let x = 0; x < s; x++)
      for (let z = 0; z < s; z++) out.push([x + y, y, z + y]);
  }
  return out;
}

function sphere(r) {
  const out = [];
  const R = Math.ceil(r);
  for (let x = -R; x <= R; x++)
    for (let y = -R; y <= R; y++)
      for (let z = -R; z <= R; z++)
        if (x * x + y * y + z * z <= r * r) out.push([x, y, z]);
  return out;
}

function cross(n, t) {
  const set = new Set();
  const h = (n - 1) / 2;
  const th = (t - 1) / 2;
  for (let a = -h; a <= h; a++)
    for (let b = -th; b <= th; b++)
      for (let c = -th; c <= th; c++) {
        set.add(`${a},${b},${c}`);
        set.add(`${b},${a},${c}`);
        set.add(`${b},${c},${a}`);
      }
  return [...set].map((k) => k.split(',').map(Number));
}

function torus(R, r) {
  const out = [];
  const M = Math.ceil(R + r);
  const H = Math.ceil(r);
  for (let x = -M; x <= M; x++)
    for (let y = -H; y <= H; y++)
      for (let z = -M; z <= M; z++) {
        const q = Math.hypot(x, z) - R;
        if (q * q + y * y <= r * r) out.push([x, y, z]);
      }
  return out;
}

function blob(count, rng) {
  const set = new Set(['0,0,0']);
  const list = [[0, 0, 0]];
  while (list.length < count) {
    const [x, y, z] = list[Math.floor(rng() * list.length)];
    const [dx, dy, dz] = DIRS[Math.floor(rng() * 6)];
    const p = [x + dx, y + dy, z + dz];
    const k = p.join(',');
    if (!set.has(k)) { set.add(k); list.push(p); }
  }
  return list;
}

// [shape, number of colors, holding tray slots]
const HANDMADE = [
  [() => box(2, 2, 3), 2, 5],
  [() => box(3, 3, 2), 2, 5],
  [() => box(3, 3, 3), 3, 5],
  [() => pyramid(5), 3, 5],
  [() => box(4, 4, 3), 4, 5],
  [() => cross(5, 3), 4, 5],
  [() => sphere(2.6), 4, 5],
  [() => box(4, 4, 4), 5, 5],
  [() => torus(3, 1.3), 5, 5],
  [(rng) => blob(90, rng), 5, 5],
  [() => pyramid(7), 5, 4],
  [() => sphere(3.2), 6, 5],
  [() => box(5, 5, 4), 6, 5],
  [() => cross(7, 3), 6, 4],
];

function proceduralLevel(level, rng) {
  const tier = Math.min(level - HANDMADE.length, 10);
  const gens = [
    () => box(4 + Math.floor(rng() * 2), 4 + Math.floor(rng() * 2), 3 + Math.floor(rng() * 3)),
    () => sphere(2.8 + tier * 0.06 + rng() * 0.5),
    () => pyramid(7),
    () => cross(7, 3),
    () => torus(3 + rng(), 1.3 + rng() * 0.3),
    () => blob(90 + tier * 10, rng),
  ];
  const make = gens[Math.floor(rng() * gens.length)];
  return [make, 6, rng() < 0.5 ? 4 : 5];
}

// ---------- Solvable assignment ----------

// Simulate a removal order: at each step pick a random cube with a clear
// path in some direction, give it that arrow and remove it. The order is a
// valid solution for the arrows alone.
function removalOrder(coords, rng) {
  const occ = new Set(coords.map((c) => c.join(',')));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const c of coords)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], c[i]);
      max[i] = Math.max(max[i], c[i]);
    }
  const clear = (c, d) => {
    let [x, y, z] = c;
    const [dx, dy, dz] = DIRS[d];
    for (;;) {
      x += dx; y += dy; z += dz;
      if (x < min[0] || y < min[1] || z < min[2] || x > max[0] || y > max[1] || z > max[2]) return true;
      if (occ.has(`${x},${y},${z}`)) return false;
    }
  };
  const remaining = coords.slice();
  const order = [];
  while (remaining.length) {
    const options = [];
    for (let i = 0; i < remaining.length; i++)
      for (let d = 0; d < 6; d++) if (clear(remaining[i], d)) options.push([i, d]);
    const [i, d] = options[Math.floor(rng() * options.length)];
    const c = remaining[i];
    order.push({ x: c[0], y: c[1], z: c[2], dir: d });
    occ.delete(c.join(','));
    remaining[i] = remaining[remaining.length - 1];
    remaining.pop();
  }
  return order;
}

export function generateLevel(level) {
  const rng = mulberry32(level * 104729 + 3);
  const [make, colorCount, tray] = level <= HANDMADE.length
    ? HANDMADE[level - 1]
    : proceduralLevel(level, rng);
  const order = removalOrder(make(rng), rng);

  // Drop the last cubes of the order so the count fills whole gates.
  // Removing cubes only frees paths, so the order stays valid.
  order.length -= order.length % GATE_SIZE;

  // Every block of GATE_SIZE cubes in the order becomes one gate of a single
  // color, so following the order solves the level with an empty tray.
  const gates = [];
  let prev = -1;
  for (let g = 0; g < order.length / GATE_SIZE; g++) {
    let c;
    do { c = Math.floor(rng() * colorCount); } while (c === prev && colorCount > 1);
    prev = c;
    gates.push(c);
    for (let k = 0; k < GATE_SIZE; k++) order[g * GATE_SIZE + k].color = c;
  }

  return { cubes: order, gates, tray, colorCount };
}
