// =====================================================================
// World generation: Crown Run regions and the world validator (agent "mapgen").
//
// Pure grid code (no THREE, no game state): main.js passes a context
//   W = { grid, NBR, ter, h, road, objAt, objects, passable(v), T, SEA }
// so the same functions serve the generator, the in-game test hook (__realms.validateWorld) and node checks.
//
//   crownRegions(W, { from, bands, per, rival, protect }) -> { regionOf, gates, wall, filled, pockets }
//       bands of walking distance from `from`, a one-cell mountain wall on every band border, gates chosen at
//       natural chokepoints, then region membership by actual walking connectivity (see the function).
//   roadGap(W, x, z)   distance from a world point to the painted road (cobbles + verge) of the nearby road cells
//   validateWorld(W, o) -> { ok, errors: [...], stats }
// =====================================================================

// the painted road (terrain.js writeCell + its shader): a disc at each road cell's centre, and a ribbon from the
// centre to the middle of every edge shared with another road cell. Verge included (shader mask m >= 0.2).
// (terrain r4: the wider roads, verge mask m >= 0.08, cobbles m >= 0.32; half width = (1 - m) * 0.09 on a straight)
export const ROAD_DISC = 0.17, ROAD_HALF = 0.085;
// the cobbles alone (mask m >= 0.32): what an object must never cover
export const COBBLE_DISC = 0.12, COBBLE_HALF = 0.062;

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}
// distance from (x, z) to the road paint of road cell c (negative inside); cobbles = the narrower cobble band only
export function roadCellGap(W, c, x, z, cobbles = false) {
  const { grid, NBR, road } = W, X = grid.X, Z = grid.Z;
  const disc = cobbles ? COBBLE_DISC : ROAD_DISC, half = cobbles ? COBBLE_HALF : ROAD_HALF;
  let g = Math.hypot(x - X[c], z - Z[c]) - disc;
  for (const n of NBR[c]) if (road[n] && W.ter[n] !== 0) g = Math.min(g, segDist(x, z, X[c], Z[c], (X[c] + X[n]) / 2, (Z[c] + Z[n]) / 2) - half);
  return g;
}
// distance from a point inside cell v (offset by up to a cell) to the nearest road paint around it
export function roadGap(W, v, x, z, cobbles = false) {
  const { NBR, road } = W;
  let g = Infinity;
  const look = (c) => { if (road[c] && W.ter[c] !== 0) g = Math.min(g, roadCellGap(W, c, x, z, cobbles)); };
  look(v); for (const n of NBR[v]) { look(n); for (const m of NBR[n]) look(m); }
  return g;
}

// breadth-first walking distance from sources over `ok` cells (-1 = not reached)
function flood(N, NBR, sources, ok, d = new Int32Array(N).fill(-1)) {
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (const s of sources) if (s >= 0 && d[s] < 0) { d[s] = 0; q[qt++] = s; }
  while (qh < qt) { const x = q[qh++]; for (const n of NBR[x]) if (d[n] < 0 && ok(n)) { d[n] = d[x] + 1; q[qt++] = n; } }
  return d;
}

// ------------------------------------------------------------------ corridors (terrain r4)
// chokeAt: v is a local chokepoint when the open cells around it form two or more separate runs (walking through v
// is the only short way between them): nothing that stands still (an object, a guard) should stand there.
export function chokeAt(W, v, open) {
  const NB6 = W.grid.NB6; let runs = 0, any = 0;
  for (let k = 0; k < 6; k++) {
    const a = NB6[v * 6 + k], b = NB6[v * 6 + (k + 5) % 6], oa = a >= 0 && open(a), ob = b >= 0 && open(b);
    if (oa) any++; if (oa && !ob) runs++;
  }
  return any < 6 && runs >= 2;
}
// widenRoads: every road step x -> y gets a second lane. The two cells beside the step (the common neighbours of x
// and y) must not both be rock / forest: the better of the two (forest before rock, never water, never the map's rim,
// never a cell `keep` protects) is cleared to x's ground at x's height. Returns the cells cleared.
export function widenRoads(W, keep = () => false) {
  const { grid, ter, h, road, T } = W, NB6 = grid.NB6, N = grid.N, pass = W.passable, out = [];
  const plain = (t) => (t === T.GRASS || t === T.DIRT || t === T.SAND || t === T.SNOW || t === T.ROUGH || t === T.SWAMP || t === T.LAVA ? t : T.GRASS);
  const clearable = (c) => c >= 0 && (ter[c] === T.FOREST || ter[c] === T.MOUNT) && grid.edge(c) < 0.9 && !keep(c);
  for (let x = 0; x < N; x++) {
    if (!road[x] || !pass(x)) continue;
    for (let k = 0; k < 6; k++) {
      const y = NB6[x * 6 + k]; if (y < 0 || !road[y] || !pass(y)) continue;
      const a = NB6[x * 6 + (k + 1) % 6], b = NB6[x * 6 + (k + 5) % 6];
      if ((a >= 0 && pass(a)) || (b >= 0 && pass(b))) continue;
      const cs = [a, b].filter(clearable).sort((p, q) => (ter[p] === T.FOREST ? 0 : 1) - (ter[q] === T.FOREST ? 0 : 1) || grid.edge(p) - grid.edge(q));
      if (!cs.length) continue;
      const c = cs[0]; ter[c] = plain(ter[x]); h[c] = h[x]; out.push(c);
    }
  }
  return out;
}
// fillPockets: walkable land nobody can walk to (cut off from the starts by rock, forest, water or a standing object)
// and holding nothing (`held`: an object or a hero stands there) becomes scenery: forest, or rock on sand / lava.
// walk(v): the cells the flood may cross (objects that can be fought or taken count as crossable or not, as the
// caller decides). Returns the number of cells filled.
export function fillPockets(W, starts, walk, held) {
  const { grid, NBR, ter, h, T, SEA } = W, N = grid.N, pass = W.passable;
  const s0 = []; for (const v of starts) { s0.push(v); for (const n of NBR[v]) if (walk(n)) s0.push(n); }
  const d = flood(N, NBR, s0, walk), comp = new Uint8Array(N); let filled = 0;
  const reached = (v) => d[v] >= 0 || (held(v) && NBR[v].some((n) => d[n] >= 0));
  for (let v = 0; v < N; v++) {
    if (comp[v] || !pass(v) || reached(v)) continue;
    const q = [v]; comp[v] = 1; let busy = false;
    for (let i = 0; i < q.length; i++) { const x = q[i]; if (held(x)) busy = true; for (const n of NBR[x]) if (!comp[n] && pass(n) && !reached(n)) { comp[n] = 1; q.push(n); } }
    if (busy) continue;
    for (const x of q) { if (ter[x] === T.SAND || ter[x] === T.LAVA) { ter[x] = T.MOUNT; h[x] = Math.max(h[x], SEA + 4); } else ter[x] = T.FOREST; filled++; }
  }
  return filled;
}

// Crown Run regions.
//  1. band[v] = which of `bands` the walking distance from `from` falls in (bands.length + 1 bands; the last one is
//     the rival crown's homeland).
//  2. Wall: every passable cell with a passable neighbour of a higher band turns to mountain. Any walk from band a
//     into a higher band must step on such a cell, so the wall is closed. A protected cell (a town, a hero) is never
//     walled: its higher-band neighbours are walled instead.
//  3. Open cells (passable, not wall) now form band-pure pockets. Stage 0 = the pocket of `from`. For each border
//     k -> k+1 the gates are wall cells touching stage k and an unreached pocket: the best one opens the largest
//     next-band pocket (the rival capital's first) at a natural chokepoint (rock, forest or water around), `per`
//     gates spread apart, plus one for every other big pocket of the next band. Stage k+1 = everything the gates of
//     border k open. A gate cell is a one-cell gap in the wall: the Border Guard stands in it.
//  4. regionOf = the stage a cell is first reached at (so every region k cell is reachable with gates < k open and
//     none of region k+1 is reachable without gate k). Pockets no gate reaches are filled with forest (scenery,
//     never a sealed walkable section); impassable cells take the region of the nearest reached cell.
export function crownRegions(W, { from, bands, per = 2, rival = -1, protect = () => false }) {
  const { grid, NBR, ter, h, T, SEA } = W, N = grid.N, pass0 = W.passable;
  const nat = new Uint8Array(N); for (let v = 0; v < N; v++) nat[v] = pass0(v) ? 0 : 1; // natural rock / forest / water
  const top = bands.length; // rival band index
  const d = flood(N, NBR, [from], pass0), band = new Int16Array(N);
  for (let v = 0; v < N; v++) { const dd = d[v] >= 0 ? d[v] : grid.dist(v, from); let k = 0; while (k < top && dd >= bands[k]) k++; band[v] = k; }
  // 2. the wall
  const wall = new Uint8Array(N);
  for (let v = 0; v < N; v++) {
    if (!pass0(v)) continue;
    const hi = NBR[v].filter((n) => pass0(n) && band[n] > band[v]);
    if (!hi.length) continue;
    if (!protect(v)) wall[v] = 1; else for (const n of hi) if (!protect(n)) wall[n] = 1;
  }
  const open = (v) => pass0(v) && !wall[v];
  // pockets of open cells
  const comp = new Int32Array(N).fill(-1), compSize = [], compBand = [], compW = [];
  for (let v = 0; v < N; v++) {
    if (comp[v] >= 0 || !open(v)) continue;
    const id = compSize.length, q = [v]; comp[v] = id;
    for (let i = 0; i < q.length; i++) for (const n of NBR[q[i]]) if (comp[n] < 0 && open(n)) { comp[n] = id; q.push(n); }
    let w = q.length; for (const x of q) if (protect(x)) w += 400; if (q.includes(rival)) w += 4000;
    compSize.push(q.length); compBand.push(band[v]); compW.push(w);
  }
  // 3. stages and gates
  const stage = new Int16Array(N).fill(-1), gates = [];
  const reachComp = (id, k) => { for (let v = 0; v < N; v++) if (comp[v] === id && stage[v] < 0) stage[v] = k; };
  if (comp[from] >= 0) reachComp(comp[from], 0); else stage[from] = 0;
  const choke = (v) => { let c = 0; for (const n of NBR[v]) { if (nat[n]) c += 2; for (const m of NBR[n]) if (nat[m]) c++; } return c; };
  for (let k = 0; k < top; k++) {
    const cand = [];
    for (let v = 0; v < N; v++) {
      if (!wall[v] || !pass0(v) || protect(v) || grid.edge(v) > 0.9) continue;
      if (!NBR[v].some((n) => stage[n] === k && open(n)) || NBR[v].some((n) => open(n) && stage[n] >= 0 && stage[n] !== k)) continue;
      const outs = [...new Set(NBR[v].filter((n) => open(n) && stage[n] < 0).map((n) => comp[n]))];
      if (!outs.some((c) => compBand[c] === k + 1)) continue;
      cand.push({ v, outs });
    }
    if (!cand.length) continue;
    const taken = new Set(), chosen = [];
    const gain = (c) => c.outs.filter((o) => !taken.has(o)).reduce((a, o) => a + (compBand[o] === k + 1 ? compW[o] : compW[o] * 0.25), 0);
    const pick = (minGain, apart) => {
      let best = null, bs = -Infinity;
      for (const c of cand) {
        const gn = gain(c); if (gn < minGain) continue;
        if (chosen.some((g) => grid.dist(g, c.v) < apart)) continue;
        const s = Math.min(gn, 300) + choke(c.v) * 5 + (W.road[c.v] ? 20 : 0) - grid.edge(c.v) * 40;
        if (s > bs) { bs = s; best = c; }
      }
      return best;
    };
    // the main gate, then up to per-1 more into the same land (spread apart), then one into each other big pocket
    const g0 = pick(1, 0); if (!g0) continue;
    chosen.push(g0.v); g0.outs.forEach((o) => taken.add(o));
    const main = new Set(g0.outs);
    for (let i = 1; i < per; i++) {
      let best = null, bs = -Infinity;
      for (const c of cand) {
        if (!c.outs.some((o) => main.has(o)) || chosen.some((g) => grid.dist(g, c.v) < 9)) continue;
        const s = choke(c.v) * 5 + (W.road[c.v] ? 20 : 0) - grid.edge(c.v) * 40 + Math.min(...chosen.map((g) => grid.dist(g, c.v)));
        if (s > bs) { bs = s; best = c; }
      }
      if (!best) break;
      chosen.push(best.v); best.outs.forEach((o) => taken.add(o));
    }
    for (let i = 0; i < 4; i++) { const c = pick(12, 4); if (!c) break; chosen.push(c.v); c.outs.forEach((o) => taken.add(o)); }
    for (const v of chosen) {
      wall[v] = 0; stage[v] = k;
      const outs = NBR[v].filter((n) => pass0(n) && !wall[n] && stage[n] < 0);
      for (const n of outs) reachComp(comp[n], k + 1);
      gates.push({ a: k, b: k + 1, v, u: outs.find((n) => band[n] === k + 1) ?? outs[0] });
    }
  }
  // late gates: a pocket still unreached that holds a town / hero or is big enough to matter gets a gate from
  // whichever reached stage touches it (it then belongs to the next region after that one)
  for (let changed = true; changed;) {
    changed = false;
    for (let v = 0; v < N && !changed; v++) {
      if (!wall[v] || !pass0(v) || protect(v) || grid.edge(v) > 0.9) continue;
      const ins = NBR[v].filter((n) => open(n) && stage[n] >= 0), outs = [...new Set(NBR[v].filter((n) => open(n) && stage[n] < 0).map((n) => comp[n]))];
      if (!ins.length || !outs.length) continue;
      const k = stage[ins[0]];
      if (k >= top || ins.some((n) => stage[n] !== k) || !outs.some((c) => compW[c] >= 25)) continue;
      wall[v] = 0; stage[v] = k;
      for (const c of outs) reachComp(c, k + 1);
      const u = NBR[v].find((n) => open(n) && stage[n] === k + 1);
      gates.push({ a: k, b: k + 1, v, u, late: true }); changed = true;
    }
  }
  // raise the wall
  for (let v = 0; v < N; v++) if (wall[v]) { ter[v] = T.MOUNT; h[v] = SEA + 4; }
  // 4. pockets no gate reaches: forest (the land keeps its height); everything else takes the nearest region
  let filled = 0; const pockets = [];
  for (let id = 0; id < compSize.length; id++) {
    let any = -1; for (let v = 0; v < N && any < 0; v++) if (comp[v] === id && stage[v] < 0) any = v;
    if (any < 0) continue;
    pockets.push({ size: compSize[id], band: compBand[id], v: any });
    for (let v = 0; v < N; v++) if (comp[v] === id && stage[v] < 0 && !protect(v)) { ter[v] = ter[v] === T.SAND || ter[v] === T.LAVA ? T.MOUNT : T.FOREST; if (ter[v] === T.MOUNT) h[v] = Math.max(h[v], SEA + 4); filled++; }
  }
  const regionOf = new Int16Array(N);
  const src = []; for (let v = 0; v < N; v++) if (stage[v] >= 0) src.push(v);
  const near = new Int32Array(N).fill(-1), q = [...src]; for (const v of src) near[v] = stage[v];
  for (let i = 0; i < q.length; i++) for (const n of NBR[q[i]]) if (near[n] < 0) { near[n] = near[q[i]]; q.push(n); }
  for (let v = 0; v < N; v++) regionOf[v] = Math.max(0, near[v]);
  return { regionOf, gates, wall, filled, pockets, band };
}

// ------------------------------------------------------------------ the validator
// o: { caps: [cell], crown: { regions, gates: [{a, v}], from, rival } | null, flora: [{x, z, r, v, key}],
//      objR: (o) -> footprint radius, reach: Uint8Array (ensureReachable's flood), margin }
export function validateWorld(W, o = {}) {
  const { grid, NBR, ter, road, objAt, objects } = W, N = grid.N, pass = W.passable, errors = [];
  const err = (kind, v, msg) => { if (errors.length < 400) errors.push({ kind, v, msg }); };
  const stats = { roads: 0, objects: 0, flora: 0, gates: 0 };
  const alive = (x) => (objAt[x] >= 0 && objects[objAt[x]]?.alive ? objects[objAt[x]] : null);
  // where an object may stand on a road: a town at a road's end, a wandering monster, a Border Guard in its gate,
  // an invasion army on the march
  const roadOk = (ob) => ob.type === 'town' || (ob.type === 'monster' && !ob.guards && !ob.guardian) || /^border\d/.test(ob.type) || !!ob.invasion;
  // 1. objects reachable (ensureReachable's definition: one neighbour, or the cell, in its flood)
  if (o.reach) for (const ob of objects) {
    if (!ob.alive) continue; stats.objects++;
    if (!pass(ob.v)) err('object-impassable', ob.v, `${ob.type} on impassable terrain`);
    if (!o.reach[ob.v] && !NBR[ob.v].some((n) => o.reach[n])) err('object-unreachable', ob.v, `${ob.type} cannot be reached`);
  }
  // 2. roads: walkable, nothing standing on them, no prop or object footprint over the painted road
  for (let v = 0; v < N; v++) {
    if (!road[v]) continue; stats.roads++;
    if (!pass(v)) err('road-impassable', v, `road on terrain ${ter[v]}`);
    const ob = alive(v); if (ob && !roadOk(ob)) err('road-object', v, `${ob.type}${ob.guards != null ? ' (guard)' : ''} on a road`);
  }
  const margin = o.margin ?? 0.012;
  if (o.flora) for (const f of o.flora) {
    stats.flora++;
    if (road[f.v]) { err('road-flora', f.v, `${f.key} on a road cell`); continue; }
    const g = roadGap(W, f.v, f.x, f.z);
    if (g < f.r + margin) err('road-prop', f.v, `${f.key} overlaps the road by ${(f.r + margin - g).toFixed(3)}`);
  }
  if (o.objR) for (const ob of objects) {
    if (!ob.alive || road[ob.v] || roadOk(ob)) continue;
    const r = o.objR(ob), g = roadGap(W, ob.v, grid.X[ob.v], grid.Z[ob.v], true);
    if (g < r) err('road-object-overlap', ob.v, `${ob.type} covers the road by ${(r - g).toFixed(3)}`);
  }
  // 1b. (terrain r4) the walk itself, from the start cells with every gate open (a Border Guard is fought, never
  // walked around): monsters can be fought and Border Guards opened, every other object stands in the way.
  //  - every object, every hero and every town is on (or beside) that walk
  //  - towns and enemy heroes stay reachable even with every monster left standing as a wall (a single wandering
  //    monster or guard never seals the way to a town or a crown)
  //  - a walkable pocket cut off from the start (by rock, forest, water or a standing object) must be empty
  if (o.starts?.length) {
    const fightable = (ob) => ob.type === 'monster' || /^border\d/.test(ob.type);
    const walkFight = (x) => pass(x) && (!alive(x) || fightable(alive(x)));
    const walkWall = (x) => pass(x) && (!alive(x) || /^border\d/.test(alive(x).type));
    const from = (ok) => { const s = []; for (const v of o.starts) { s.push(v); for (const n of NBR[v]) if (ok(n)) s.push(n); } return flood(N, NBR, s, ok); };
    const dF = from(walkFight), dW = from(walkWall), dP = from(pass);
    const near = (d, v) => d[v] >= 0 || NBR[v].some((n) => d[n] >= 0);
    for (const ob of objects) {
      if (!ob.alive) continue;
      if (!near(dF, ob.v)) err('walk-unreachable', ob.v, `${ob.type} cannot be walked to from the start`);
      else if (ob.type === 'town' && !near(dW, ob.v)) err('town-sealed', ob.v, 'town sealed off by a monster');
    }
    for (const hr of o.heroes || []) {
      if (!near(dF, hr.v)) err('hero-unreachable', hr.v, `hero of player ${hr.p} cannot be reached`);
      else if (hr.p !== 0 && !near(dW, hr.v)) err('hero-sealed', hr.v, `hero of player ${hr.p} sealed off by a monster`);
    }
    for (const t of o.towns || []) if (!near(dF, t.v)) err('town-unreachable', t.v, `town of player ${t.p} cannot be reached`);
    // cut-off pockets of walkable land (by terrain, or behind a standing object): empty ones are tolerated (counted)
    const comp = new Int32Array(N).fill(-1); stats.pockets = 0; stats.pocketCells = 0;
    const heroAt = new Set((o.heroes || []).map((x) => x.v));
    for (let v = 0; v < N; v++) {
      if (comp[v] >= 0 || !pass(v) || dF[v] >= 0 || (alive(v) && near(dF, v))) continue;
      const q = [v]; comp[v] = v; let held = -1;
      for (let i = 0; i < q.length; i++) {
        const x = q[i]; if (alive(x) || heroAt.has(x)) held = x;
        for (const n of NBR[x]) if (comp[n] < 0 && pass(n) && dF[n] < 0 && !(alive(n) && near(dF, n))) { comp[n] = v; q.push(n); }
      }
      if (held >= 0) err('pocket-held', held, `a cut-off pocket of ${q.length} walkable cell(s) holds ${alive(held)?.type || 'a hero'}`);
      else { stats.pockets++; stats.pocketCells += q.length; }
    }
    stats.cutOff = 0; for (let v = 0; v < N; v++) if (pass(v) && dP[v] < 0) stats.cutOff++;
  }
  // 2b. (terrain r4) roads connect every town: one road network (towns stand at road ends)
  const towns = o.towns || [];
  if (towns.length > 1) {
    const onRoad = (x) => road[x] && pass(x);
    const d = flood(N, NBR, [towns[0].v], onRoad);
    for (const t of towns.slice(1)) if (d[t.v] < 0) err('road-town', t.v, `town of player ${t.p} not on the road network of the first town`);
  }
  // 3. capitals connected (Free Play: on foot through walkable land; towns and objects can be passed)
  const caps = o.caps || [];
  if (caps.length > 1 && !o.crown) {
    const d = flood(N, NBR, [caps[0]], pass);
    for (const c of caps.slice(1)) if (d[c] < 0) err('capitals', c, 'capital not connected to the first one');
  }
  // 4. Crown Run regions: for every stage k (regions 0..k open, Border Guards of borders >= k standing)
  const C = o.crown;
  if (C) {
    const R = C.regions, regionOf = C.regionOf, gateAt = new Int16Array(N).fill(-1);
    for (const g of C.gates) { gateAt[g.v] = g.a; stats.gates++; }
    for (let a = 0; a < R; a++) {
      const gs = C.gates.filter((g) => g.a === a);
      if (!gs.length) err('gate-missing', -1, `no gate on border ${a} -> ${a + 1}`);
      for (const g of gs) {
        const ob = alive(g.v);
        if (!ob || ob.type !== `border${a + 1}`) err('gate-guard', g.v, `gate ${a} -> ${a + 1} has no Border Guard`);
        if (regionOf[g.v] !== a) err('gate-region', g.v, `gate cell in region ${regionOf[g.v]}, not ${a}`);
        if (!NBR[g.v].some((n) => pass(n) && regionOf[n] === a + 1 && gateAt[n] < 0)) err('gate-out', g.v, `gate ${a} opens on no region ${a + 1} cell`);
        if (!NBR[g.v].some((n) => pass(n) && regionOf[n] === a && gateAt[n] < 0)) err('gate-in', g.v, `gate ${a} has no region ${a} side`);
        const flank = NBR[g.v].filter((n) => !pass(n)).length; if (flank < 2) err('gate-flank', g.v, 'gate not in a pass (fewer than 2 impassable flanks)');
      }
    }
    for (let k = 0; k <= R; k++) {
      const shut = (v) => gateAt[v] >= k;
      // (a) walls closed: from the capital, with gates >= k shut, no cell of a region > k (whatever regionOf says)
      const dA = flood(N, NBR, [C.from], (v) => pass(v) && !shut(v));
      let leak = -1; for (let v = 0; v < N; v++) if (dA[v] >= 0 && regionOf[v] > k) { leak = v; break; }
      if (leak >= 0) err('wall-leak', leak, `region ${regionOf[leak]} reachable at stage ${k} (gates >= ${k} shut)`);
      // (b) every region k cell reachable using regions <= k and gates < k
      const dB = flood(N, NBR, [C.from], (v) => pass(v) && regionOf[v] <= k && !shut(v));
      let miss = 0, mv = -1; for (let v = 0; v < N; v++) if (pass(v) && regionOf[v] === k && gateAt[v] < 0 && dB[v] < 0 && !alive(v)?.invasion) { miss++; mv = v; }
      if (miss) err('region-cut', mv, `${miss} cell(s) of region ${k} not reachable through regions <= ${k}`);
    }
    // objects belong to the region they are reached from (a gate's guard to the region it opens from)
    for (const ob of objects) if (ob.alive && pass(ob.v) && ob.guards != null) {
      const t = objects.find((x) => x.v === ob.guards && x.alive);
      if (t && regionOf[t.v] !== regionOf[ob.v]) err('guard-region', ob.v, `guard in region ${regionOf[ob.v]}, its ${t.type} in ${regionOf[t.v]}`);
    }
  }
  return { ok: errors.length === 0, errors, stats };
}
