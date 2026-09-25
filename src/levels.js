// Level generation: builds a voxel shape and assigns each cube an arrow
// direction so the level is always solvable.

export const DIRS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

const PALETTE = [
  0x4f8cff, 0xff7a59, 0x2ec4a6, 0xb07cff, 0xffb938,
  0xef5b8c, 0x3fb5e8, 0x8bc34a, 0xff8f3f, 0x7c8cff,
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

const HANDMADE = [
  () => box(2, 2, 2),
  () => box(3, 2, 2),
  () => box(3, 3, 2),
  () => box(3, 3, 3),
  () => pyramid(5),
  () => box(4, 4, 3),
  () => cross(5, 3),
  () => sphere(2.6),
  () => box(4, 4, 4),
  () => torus(3, 1.3),
  (rng) => blob(90, rng),
  () => pyramid(7),
  () => box(5, 5, 3),
  () => sphere(3.2),
  () => cross(7, 3),
  () => box(5, 5, 5),
];

function proceduralShape(level, rng) {
  const tier = Math.min(level - HANDMADE.length, 10);
  const gens = [
    () => box(4 + Math.floor(rng() * 3), 4 + Math.floor(rng() * 3), 3 + Math.floor(rng() * 3)),
    () => sphere(2.8 + tier * 0.08 + rng() * 0.6),
    () => pyramid(7 + 2 * Math.floor(rng() * 2)),
    () => cross(7, 3 + 2 * Math.floor(rng() * 2)),
    () => torus(3 + rng() * 1.2, 1.3 + rng() * 0.4),
    () => blob(100 + tier * 12, rng),
  ];
  return gens[Math.floor(rng() * gens.length)]();
}

// ---------- Solver-backed direction assignment ----------

// Assign directions by simulating a removal order: at every step pick a
// random cube that has a clear path in some direction and remove it. The
// resulting order is a valid solution, so the level is always solvable.
function assignDirections(coords, rng) {
  const occ = new Set(coords.map((c) => c.join(',')));
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
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
  const result = [];
  while (remaining.length) {
    const options = [];
    for (let i = 0; i < remaining.length; i++)
      for (let d = 0; d < 6; d++) if (clear(remaining[i], d)) options.push([i, d]);
    const [i, d] = options[Math.floor(rng() * options.length)];
    const c = remaining[i];
    result.push({ x: c[0], y: c[1], z: c[2], dir: d });
    occ.delete(c.join(','));
    remaining[i] = remaining[remaining.length - 1];
    remaining.pop();
  }
  return result;
}

export function generateLevel(level) {
  const rng = mulberry32(level * 7919 + 17);
  const shape = level <= HANDMADE.length
    ? HANDMADE[level - 1](rng)
    : proceduralShape(level, rng);
  return {
    cubes: assignDirections(shape, rng),
    color: PALETTE[(level - 1) % PALETTE.length],
  };
}
