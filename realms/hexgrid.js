// =====================================================================
// ORBIS flat world: the hex grid (agent "flat", v2.0).
//
// A rectangle of pointy-top hexes in "odd-r" offset layout: W columns x H rows, cell id v = row * W + col.
// World space: x to the right, z toward the viewer (south), y up; cell centres sit on y = 0 (heights are added
// by main.js posOf). Neighbour order is fixed: NB6[v * 6 + k] is the cell across edge k (-1 off the map), with
// edge k facing the direction DIR6[k] (angle -60k deg in the x/z plane, counter-clockwise seen from above),
// and corner k of a cell at angle -(60k - 30) deg, so edge k runs from corner k to corner k + 1.
//
//   makeGrid(w, h)          -> grid (see below); MAP_PRESETS = { S, M, L, XL } -> [w, h]
//   grid.dist(a, b)         hex steps between two cells (exact, the A* heuristic and every "how far" check)
//   grid.edge(v)            0 at the centre .. 1 on the border (Chebyshev, normalised)
//   grid.lat(v)             0 south .. 1 north: a mild climate gradient for biomes (replaces the planet's |y|)
//   grid.cellAt(x, z)       the cell under a world point (or -1)
//   regionsVoronoi(grid, seeds, pass?)  -> Int16Array regionOf (nearest seed by walking distance)
//   regionsBands(grid, from, bands, pass?) -> Int16Array regionOf (ring index of the walking distance from `from`)
//   regionGates(grid, regionOf, pass?, per?) -> [{ a, b, v, u }] passable border crossings between regions
// =====================================================================

export const CELL = 0.39;                // centre-to-centre spacing (the planet's neighbour distance)
export const ROW = CELL * Math.sqrt(3) / 2;
export const CORNER_R = CELL / Math.sqrt(3); // centre to corner
// M is about the planet's playable land, XL ~2.5x that
export const MAP_PRESETS = { S: [40, 30], M: [60, 44], L: [76, 56], XL: [96, 70] };
export const MAX_CELLS = MAP_PRESETS.XL[0] * MAP_PRESETS.XL[1];
export const CHUNK_W = 20, CHUNK_H = 16; // render chunks (terrain meshes, flora culling)
export const DIR6 = Array.from({ length: 6 }, (_, k) => [Math.cos((-60 * k) * Math.PI / 180), Math.sin((-60 * k) * Math.PI / 180)]);
export const CORN6 = Array.from({ length: 6 }, (_, k) => [Math.cos(-(60 * k - 30) * Math.PI / 180) * CORNER_R, Math.sin(-(60 * k - 30) * Math.PI / 180) * CORNER_R]);

export function makeGrid(w, h) {
  w = Math.max(8, w | 0); h = Math.max(8, h | 0);
  const N = w * h;
  const X = new Float32Array(N), Z = new Float32Array(N), col = new Int16Array(N), row = new Int16Array(N), CQ = new Int16Array(N);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const v = r * w + c;
    X[v] = (c + 0.5 * (r & 1)) * CELL; Z[v] = r * ROW; col[v] = c; row[v] = r;
    CQ[v] = c - ((r - (r & 1)) >> 1); // cube q (cube r = row)
  }
  const at = (c, r) => (c >= 0 && r >= 0 && c < w && r < h ? r * w + c : -1);
  const cellAt = (x, z) => {
    // nearest centre among the candidates around the rounded row
    const r0 = Math.round(z / ROW);
    let best = -1, bd = Infinity;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const c0 = Math.round(x / CELL - 0.5 * (r & 1));
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const v = at(c, r); if (v < 0) continue;
        const d = (X[v] - x) ** 2 + (Z[v] - z) ** 2;
        if (d < bd) { bd = d; best = v; }
      }
    }
    return bd <= CELL * CELL ? best : -1;
  };
  const NB6 = new Int32Array(N * 6).fill(-1);
  for (let v = 0; v < N; v++) for (let k = 0; k < 6; k++) {
    const x = X[v] + DIR6[k][0] * CELL, z = Z[v] + DIR6[k][1] * CELL;
    const r = Math.round(z / ROW), c = Math.round(x / CELL - 0.5 * (r & 1));
    NB6[v * 6 + k] = at(c, r);
  }
  const NBR = [];
  for (let v = 0; v < N; v++) { const a = []; for (let k = 0; k < 6; k++) { const n = NB6[v * 6 + k]; if (n >= 0) a.push(n); } NBR.push(a); }
  const dist = (a, b) => { const dq = CQ[a] - CQ[b], dr = row[a] - row[b]; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) >> 1; };
  const edge = (v) => Math.max(Math.abs(2 * col[v] / (w - 1) - 1), Math.abs(2 * row[v] / (h - 1) - 1));
  const lat = (v) => 1 - row[v] / (h - 1);
  // render chunks
  const CW = Math.ceil(w / CHUNK_W), CHn = Math.ceil(h / CHUNK_H), chunkOf = new Int16Array(N), chunks = [];
  for (let j = 0; j < CHn; j++) for (let i = 0; i < CW; i++) chunks.push({ id: chunks.length, cells: [], x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
  for (let v = 0; v < N; v++) {
    const k = Math.floor(row[v] / CHUNK_H) * CW + Math.floor(col[v] / CHUNK_W), C = chunks[k];
    chunkOf[v] = k; C.cells.push(v);
    C.x0 = Math.min(C.x0, X[v] - CELL); C.x1 = Math.max(C.x1, X[v] + CELL); C.z0 = Math.min(C.z0, Z[v] - CELL); C.z1 = Math.max(C.z1, Z[v] + CELL);
  }
  const bounds = { x0: 0, x1: (w - 0.5) * CELL, z0: 0, z1: (h - 1) * ROW };
  return { W: w, H: h, N, X, Z, col, row, NB6, NBR, at, cellAt, dist, edge, lat, chunkOf, chunks, bounds, cx: (bounds.x0 + bounds.x1) / 2, cz: (bounds.z0 + bounds.z1) / 2 };
}

// ------------------------------------------------------------------ regions (Crown Run gates)
// walking distance over `pass` (default: every cell) from several sources at once
function multiBfs(grid, sources, pass) {
  const N = grid.N, d = new Int32Array(N).fill(-1), owner = new Int16Array(N).fill(-1), q = new Int32Array(N);
  let qh = 0, qt = 0;
  sources.forEach((s, i) => { if (s >= 0 && d[s] < 0) { d[s] = 0; owner[s] = i; q[qt++] = s; } });
  while (qh < qt) {
    const x = q[qh++];
    for (const n of grid.NBR[x]) if (d[n] < 0 && (!pass || pass(n))) { d[n] = d[x] + 1; owner[n] = owner[x]; q[qt++] = n; }
  }
  return { d, owner };
}
// Voronoi zones: each cell joins the seed it is closest to on foot (unreachable cells: the nearest seed as the crow flies)
export function regionsVoronoi(grid, seeds, pass = null) {
  const { owner } = multiBfs(grid, seeds, pass), out = new Int16Array(grid.N);
  for (let v = 0; v < grid.N; v++) {
    if (owner[v] >= 0) { out[v] = owner[v]; continue; }
    let bi = 0, bd = Infinity; seeds.forEach((s, i) => { const dd = grid.dist(v, s); if (dd < bd) { bd = dd; bi = i; } }); out[v] = bi;
  }
  return out;
}
// distance bands: region k = cells whose walking distance from `from` lies in [bands[k-1], bands[k]) (last band open)
export function regionsBands(grid, from, bands, pass = null) {
  const { d } = multiBfs(grid, [from], pass), out = new Int16Array(grid.N);
  for (let v = 0; v < grid.N; v++) {
    const dd = d[v] >= 0 ? d[v] : grid.dist(v, from);
    let k = 0; while (k < bands.length && dd >= bands[k]) k++;
    out[v] = k;
  }
  return out;
}
// border crossings: for every pair of touching regions, up to `per` passable cell pairs (v in a, u in b) spread
// along their shared border (farthest-point picks)
export function regionGates(grid, regionOf, pass = null, per = 1) {
  const pairs = new Map();
  for (let v = 0; v < grid.N; v++) {
    if (pass && !pass(v)) continue;
    for (const u of grid.NBR[v]) {
      const a = regionOf[v], b = regionOf[u];
      if (a >= b || (pass && !pass(u))) continue;
      const key = a * 4096 + b;
      if (!pairs.has(key)) pairs.set(key, []);
      pairs.get(key).push([v, u]);
    }
  }
  const gates = [];
  for (const [key, list] of pairs) {
    const a = Math.floor(key / 4096), b = key % 4096;
    const pick = [list[(list.length / 2) | 0]];
    while (pick.length < per && pick.length < list.length) {
      let best = null, bd = -1;
      for (const e of list) { const dd = Math.min(...pick.map((p) => grid.dist(p[0], e[0]))); if (dd > bd) { bd = dd; best = e; } }
      if (!best || bd < 3) break; pick.push(best);
    }
    for (const [v, u] of pick) gates.push({ a, b, v, u });
  }
  return gates;
}

// ------------------------------------------------------------------ the old planet grid (kept for a future decorative globe screen)
// icosphere(THREE, detail) -> { verts: unit Vector3[], faces: [a, b, c][] } (detail 4: the v1.x planet's 2562 cells)
export function icosphere(THREE, detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => new THREE.Vector3(...v).normalize());
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 100000 + b : b * 100000 + a;
      if (cache.has(key)) return cache.get(key);
      verts.push(verts[a].clone().add(verts[b]).normalize());
      cache.set(key, verts.length - 1);
      return verts.length - 1;
    };
    const nf = [];
    for (const [a, b, c] of faces) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    faces = nf;
  }
  return { verts, faces };
}
