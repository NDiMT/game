// =====================================================================
// HEX REALMS: tactical combat rules. A battlefield of COLS x ROWS hexes
// (rows offset like bricks), the attacker at the bottom, the defender at
// the top. Pure logic: the renderer reads the state and animates events.
// =====================================================================
import { UNITS, SPELLS } from './data.js';

export const COLS = 7, ROWS = 11;
const rnd = Math.random;
export const key = (c, r) => r * COLS + c;
export const inside = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
// odd rows are shifted right by half a hex
export function nbrs(c, r) {
  const odd = r & 1;
  const d = odd ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  return d.map(([dc, dr]) => [c + dc, r + dr]).filter(([x, y]) => inside(x, y));
}
function cube(c, r) { const x = c - (r - (r & 1)) / 2, z = r; return [x, -x - z, z]; }
export function dist(a, b) { const p = cube(a.c ?? a[0], a.r ?? a[1]), q = cube(b.c ?? b[0], b.r ?? b[1]); return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])); }

// ---- modifiers (Crown Run banners, boss rules, seals). `mods` is a list of hook objects applied in list order
// (banner slot order matters: flat adds before multipliers). With no mods (Free Play) every hook is skipped and
// the rules are exactly the classic ones. Hooks (all optional):
//   stats(u, { side, slot, id }, B)  edit the stack's private copy of its unit stats before it is placed
//   onBattleStart(B)                 after deployment, before round 1
//   onRoundStart(B)                  at the start of every round (round 1 included)
//   onDamage(calc, B)                calc = { a, d, side, dmg, ranged, melee, retal, spell, lucky, preview }: edit calc.dmg
//   onShoot(B, a, d)                 before a shot lands
//   canShoot(B, s, ok) -> bool       may forbid (ok -> false) or allow (rule-breaking) a shot
//   onStackDeath(B, s, killer)       a stack was destroyed (killer: the striking stack, or null)
// Hook code may push { t: 'mod', icon, text, s, side, hits } events for the renderer, and use harm() and B.rand().
const fire = (B, k, ...args) => { for (const m of B.mods) if (m[k]) m[k](...args, B); };
export function createBattle({ armyA, heroA, armyB, heroB, town = false, mods = null, rng = null }) {
  const B = { stacks: [], obstacles: new Set(), round: 1, log: [], events: [], heroes: [heroA || null, heroB || null], cast: [false, false], over: null, town, active: null, queue: [], mods: mods || [], rand: rng || rnd };
  const place = (army, side) => {
    const n = army.length, row = side === 0 ? ROWS - 1 : 0;
    // armies keep empty slots as null (a stack that died mid-army): skip them instead of throwing
    army.forEach((st, i) => {
      const [id, count] = st || [];
      if (!id || count <= 0) return;
      let u = UNITS[id];
      // modded battles give each stack its own copy of the stats, so hooks never touch the shared table
      if (B.mods.length) { u = { ...u, dmg: [...u.dmg] }; fire(B, 'stats', u, { side, slot: i, id }); }
      const c = Math.min(COLS - 1, Math.round(((i + 0.5) / n) * COLS - 0.5));
      const r = row + (u.ranged ? 0 : side === 0 ? -1 : 1) * (i % 2);
      B.stacks.push({ uid: B.stacks.length, id, u, side, count, start: count, hp: u.hp, c, r, shots: u.ranged || 0, retal: 0, fx: {}, waited: false, acted: false, defending: false, slot: i });
    });
  };
  place(armyA, 0); place(armyB, 1);
  // siege: a wall row one row in front of the defenders' two deployment rows, with a 1-hex gate in
  // the middle. The gate is open to the defenders only, until the attackers batter it down.
  B.walls = new Set(); B.gate = null; B.wallRow = null; B.gateHp = 0; B.gateOpen = false;
  if (town && town.fort) {
    const def = town.side ?? 1, row = def === 1 ? 2 : ROWS - 3, gate = (COLS - 1) >> 1;
    for (let c = 0; c < COLS; c++) if (c !== gate) { B.walls.add(key(c, row)); B.obstacles.add(key(c, row)); }
    B.gate = key(gate, row); B.wallRow = row; B.gateHp = 2 + Math.round(town.power || 2);
  }
  // a few rocks and dead trees in the middle rows (never right in front of the gate)
  const nearGate = (c, r) => B.gate != null && nbrs(B.gate % COLS, (B.gate / COLS) | 0).some(([x, y]) => x === c && y === r);
  const nObs = 3 + ((B.rand() * 4) | 0);
  for (let i = 0; i < nObs * 3 && B.obstacles.size - B.walls.size < nObs; i++) {
    const c = (B.rand() * COLS) | 0, r = 3 + ((B.rand() * (ROWS - 6)) | 0);
    if (!B.stacks.some((s) => s.c === c && s.r === r) && !B.walls.has(key(c, r)) && r !== B.wallRow && !nearGate(c, r)) B.obstacles.add(key(c, r));
  }
  if (B.mods.length) fire(B, 'onBattleStart');
  newRound(B);
  return B;
}
export const alive = (B, side) => B.stacks.filter((s) => s.count > 0 && (side === undefined || s.side === side));
export const stackAt = (B, c, r) => B.stacks.find((s) => s.count > 0 && s.c === c && s.r === r);
const hero = (B, side) => B.heroes[side];
// the closed gate stops the attackers (defenders walk through their own gate)
const gateShut = (B, s) => B.gate != null && !B.gateOpen && s.side !== (B.town?.side ?? 1);
const blockedFor = (B, s, c, r) => { const k = key(c, r); if (B.obstacles.has(k) || (k === B.gate && gateShut(B, s))) return true; const o = stackAt(B, c, r); return !!o && o !== s; };
export const isGate = (B, c, r) => B.gate === key(c, r);
export const speedOf = (s) => Math.max(1, Math.round((s.u.spd + (s.fx.haste ? 3 : 0)) * (s.fx.slow ? 0.5 : 1)));

function newRound(B) {
  for (const s of B.stacks) {
    s.acted = false; s.waited = false; s.defending = false; s.retal = 0; s.morale = false;
    for (const k of Object.keys(s.fx)) if (--s.fx[k] <= 0) delete s.fx[k];
    // trolls and wights heal at the start of each round
    if (s.count > 0 && s.u.regen) s.hp = s.u.hp;
  }
  B.cast = [false, false];
  // the town's arrow tower shoots at an attacker every round
  if (B.town && B.town.fort && B.round > 1) {
    const def = B.town.side ?? 1, foes = B.stacks.filter((s) => s.count > 0 && s.side !== def);
    // attackers on foot next to the closed gate batter it; it gives way after a few blows
    if (B.gate != null && !B.gateOpen) {
      const gc = B.gate % COLS, gr = (B.gate / COLS) | 0;
      const rams = foes.filter((s) => !s.u.fly && nbrs(gc, gr).some(([x, y]) => x === s.c && y === s.r)).length;
      if (rams) { B.gateHp = Math.max(0, B.gateHp - rams); B.events.push({ t: 'gate', hp: B.gateHp, broken: B.gateHp <= 0, c: gc, r: gr }); if (B.gateHp <= 0) B.gateOpen = true; }
    }
    if (foes.length) { const t = foes[(B.rand() * foes.length) | 0], dmg = 10 + (B.town.power || 3) * 6; const killed = hurt(B, t, dmg); B.events.push({ t: 'tower', s: t.uid, dmg, killed, side: def, left: t.count }); if (t.count <= 0) died(B, t, null); checkOver(B); }
  }
  if (B.mods.length) { fire(B, 'onRoundStart'); checkOver(B); }
}
// the next stack to act: fastest first, those who waited go last (slowest first)
export function nextStack(B) {
  let live = alive(B).filter((s) => !s.acted);
  if (!live.length) { B.round++; newRound(B); B.events.push({ t: 'round', round: B.round }); live = alive(B); }
  const fresh = live.filter((s) => !s.waited).sort((a, b) => speedOf(b) - speedOf(a) || a.side - b.side);
  const waiting = live.filter((s) => s.waited).sort((a, b) => speedOf(a) - speedOf(b));
  B.active = fresh[0] || waiting[0] || null;
  return B.active;
}
export function queue(B, n = 8) {
  const live = alive(B).filter((s) => !s.acted);
  const fresh = live.filter((s) => !s.waited).sort((a, b) => speedOf(b) - speedOf(a) || a.side - b.side);
  const waiting = live.filter((s) => s.waited).sort((a, b) => speedOf(a) - speedOf(b));
  const nextR = alive(B).slice().sort((a, b) => speedOf(b) - speedOf(a) || a.side - b.side);
  return [...fresh, ...waiting, ...nextR].slice(0, n);
}

// hexes a stack can reach this turn: walkers go round obstacles and stacks, flyers go anywhere in range
export function reachable(B, s) {
  const out = new Map([[key(s.c, s.r), 0]]), sp = speedOf(s);
  const blocked = (c, r) => blockedFor(B, s, c, r);
  if (s.u.fly) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const d = dist(s, [c, r]); if (d <= sp && !blocked(c, r)) out.set(key(c, r), d); }
    return out;
  }
  const q = [[s.c, s.r, 0]];
  for (let i = 0; i < q.length; i++) {
    const [c, r, d] = q[i];
    if (d >= sp) continue;
    for (const [x, y] of nbrs(c, r)) { const k = key(x, y); if (out.has(k) || blocked(x, y)) continue; out.set(k, d + 1); q.push([x, y, d + 1]); }
  }
  return out;
}
export const adjacentEnemy = (B, s) => nbrs(s.c, s.r).some(([x, y]) => { const o = stackAt(B, x, y); return o && o.side !== s.side; });
export function canShoot(B, s) {
  let ok = s.shots > 0 && !adjacentEnemy(B, s);
  if (B.mods?.length) for (const m of B.mods) if (m.canShoot) ok = !!m.canShoot(B, s, ok);
  return ok;
}
// run the damage hooks over a computed hit (also for previews: calc.preview, where hooks must not roll dice or keep state)
function modDamage(B, calc) { for (const m of B.mods) if (m.onDamage) m.onDamage(calc, B); return calc.dmg; }

// damage: HoMM style, attack vs defence decides the multiplier
function rollDamage(B, a, d, { ranged = false, melee = false, retal = false } = {}) {
  let lucky = false;
  const ha = hero(B, a.side), hd = hero(B, d.side);
  const A = a.u.att + (ha ? ha.att : 0), D = d.u.def + (hd ? hd.def : 0) + (d.fx.stoneskin ? 4 : 0) + (d.defending ? Math.ceil(d.u.def * 0.3) : 0) + (B.town && d.side === (B.town.side ?? 1) && B.town.fort ? Math.ceil(d.u.def * 0.3) : 0);
  let per = a.fx.bless ? a.u.dmg[1] : a.u.dmg[0] + B.rand() * (a.u.dmg[1] - a.u.dmg[0] + 1) | 0;
  if (a.fx.bless) per = a.u.dmg[1];
  let dmg = per * a.count;
  dmg *= A >= D ? Math.min(4, 1 + 0.05 * (A - D)) : Math.max(0.3, 1 - 0.025 * (D - A));
  if (ha) {
    if (ranged) dmg *= 1 + 0.15 * (ha.skills.archery || 0);
    else dmg *= 1 + 0.1 * (ha.skills.offense || 0);
  }
  if (hd) dmg *= 1 - 0.08 * (hd.skills.armorer || 0);
  if (melee && a.u.ranged && !a.u.noMeleePenalty) dmg *= 0.5;
  if (a.fx.curse) dmg *= 0.8;
  // dread knights sometimes strike a death blow
  if (a.u.deathblow && B.rand() < 0.2) { dmg *= 2; lucky = true; }
  if (a.u.jousting && a.moved) dmg *= 1 + 0.05 * a.moved;
  // luck: a chance of double damage
  const luck = ha ? (ha.skills.luck || 0) + (ha.luck || 0) : 0;
  if (luck > 0 && B.rand() < luck * 0.0417) { dmg *= 2; lucky = true; }
  if (B.mods.length) { const calc = { a, d, side: a.side, dmg, ranged, melee, retal, spell: null, lucky, preview: false }; dmg = modDamage(B, calc); lucky = calc.lucky; }
  return { dmg: Math.max(1, Math.round(dmg)), lucky };
}
function hurt(B, d, dmg) {
  const before = d.count;
  let total = (d.count - 1) * d.u.hp + d.hp - dmg;
  if (total <= 0) { d.count = 0; d.hp = 0; }
  else { d.count = Math.ceil(total / d.u.hp); d.hp = total - (d.count - 1) * d.u.hp; }
  return before - d.count;
}
// harm: damage from outside a strike (a hook's effect); returns creatures killed. The caller pushes the event.
export function harm(B, s, dmg, killer = null) { const k = hurt(B, s, Math.max(0, Math.round(dmg))); if (s.count <= 0) died(B, s, killer); checkOver(B); return k; }
function died(B, s, killer) { B.events.push({ t: 'die', s: s.uid }); if (B.mods.length) fire(B, 'onStackDeath', s, killer); }
function strike(B, a, d, opts) {
  const { dmg, lucky } = rollDamage(B, a, d, opts);
  const killed = hurt(B, d, dmg);
  const ev = { t: opts.ranged ? 'shot' : 'hit', a: a.uid, d: d.uid, dmg, killed, lucky, retal: !!opts.retal, left: d.count };
  B.events.push(ev);
  // vampires drain life and raise their dead
  if (a.u.curse && d.count > 0 && B.rand() < 0.3) d.fx.curse = 3;
  if (a.u.drain && dmg > 0 && a.count > 0) {
    let heal = Math.round(dmg * 0.5);
    while (heal > 0 && a.count < a.start) { const need = a.u.hp - a.hp; if (heal >= need) { heal -= need; a.count++; a.hp = a.u.hp; } else { a.hp += heal; heal = 0; } }
    if (heal > 0) a.hp = Math.min(a.u.hp, a.hp + heal);
    ev.aLeft = a.count;
  }
  if (d.count <= 0) died(B, d, a);
}
export function moveTo(B, s, c, r) {
  const d = dist(s, [c, r]);
  B.events.push({ t: 'move', s: s.uid, from: [s.c, s.r], to: [c, r], fly: !!s.u.fly, path: s.u.fly ? null : pathTo(B, s, c, r) });
  s.c = c; s.r = r; s.moved = d;
}
function pathTo(B, s, c, r) {
  const prev = new Map([[key(s.c, s.r), null]]), q = [[s.c, s.r]];
  const blocked = (x, y) => blockedFor(B, s, x, y);
  for (let i = 0; i < q.length; i++) {
    const [x0, y0] = q[i];
    if (x0 === c && y0 === r) break;
    for (const [x, y] of nbrs(x0, y0)) { const k = key(x, y); if (prev.has(k) || blocked(x, y)) continue; prev.set(k, [x0, y0]); q.push([x, y]); }
  }
  const path = []; let cur = [c, r];
  while (cur) { path.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
  return path;
}
export function melee(B, a, d) {
  strike(B, a, d, { melee: true });
  // the defender strikes back once per round (griffins twice), unless the attacker allows no retaliation
  const canRetal = (x, y) => y.count > 0 && !x.u.noRetal && (y.retal < (y.u.twoRetal ? 2 : 1));
  if (canRetal(a, d)) { d.retal++; strike(B, d, a, { melee: true, retal: true }); }
  // wolves bite twice
  if (a.u.double && a.count > 0 && d.count > 0) { strike(B, a, d, { melee: true }); if (canRetal(a, d)) { d.retal++; strike(B, d, a, { melee: true, retal: true }); } }
}
export function shoot(B, a, d) {
  a.shots--;
  if (B.mods.length) fire(B, 'onShoot', a, d);
  if (d.count <= 0 || a.count <= 0) return;
  strike(B, a, d, { ranged: true });
  // marksmen loose two arrows
  if (a.u.twoShots && d.count > 0 && a.count > 0 && a.shots > 0) { a.shots--; strike(B, a, d, { ranged: true }); }
}

// ---- actions taken by the active stack
// what an attack would do, without dice: for the preview before you commit
export function estimate(B, a, d, ranged) {
  const ha = B.heroes[a.side], hd = B.heroes[d.side];
  const A = a.u.att + (ha ? ha.att : 0), D = d.u.def + (hd ? hd.def : 0) + (d.fx.stoneskin ? 4 : 0) + (d.defending ? Math.ceil(d.u.def * 0.3) : 0);
  let m = A >= D ? Math.min(4, 1 + 0.05 * (A - D)) : Math.max(0.3, 1 - 0.025 * (D - A));
  if (ha) m *= ranged ? 1 + 0.15 * (ha.skills.archery || 0) : 1 + 0.1 * (ha.skills.offense || 0);
  if (hd) m *= 1 - 0.08 * (hd.skills.armorer || 0);
  if (!ranged && a.u.ranged && !a.u.noMeleePenalty) m *= 0.5;
  if (a.fx.curse) m *= 0.8;
  const hits = (ranged && a.u.twoShots) || (!ranged && a.u.double) ? 2 : 1;
  let lo0 = (a.fx.bless ? a.u.dmg[1] : a.u.dmg[0]) * a.count * m, hi0 = a.u.dmg[1] * a.count * m;
  if (B.mods.length) { const c = (dmg) => modDamage(B, { a, d, side: a.side, dmg, ranged: !!ranged, melee: !ranged, retal: false, spell: null, lucky: false, preview: true }); lo0 = c(lo0); hi0 = c(hi0); }
  const lo = Math.max(1, Math.round(lo0)) * hits, hi = Math.max(1, Math.round(hi0)) * hits;
  const pool = (d.count - 1) * d.u.hp + d.hp, kills = (x) => Math.min(d.count, x >= pool ? d.count : d.count - Math.ceil((pool - x) / d.u.hp));
  return { lo, hi, klo: kills(lo), khi: kills(hi) };
}
export function actMove(B, s, c, r) { moveTo(B, s, c, r); endTurn(B, s); }
export function actAttack(B, s, target, from) {
  if (from && (from[0] !== s.c || from[1] !== s.r)) moveTo(B, s, from[0], from[1]); else s.moved = 0;
  melee(B, s, target); endTurn(B, s);
}
export function actShoot(B, s, target) { shoot(B, s, target); endTurn(B, s); }
export function actWait(B, s) { s.waited = true; B.events.push({ t: 'wait', s: s.uid }); }
export function actDefend(B, s) { s.defending = true; B.events.push({ t: 'defend', s: s.uid }); endTurn(B, s); }
function endTurn(B, s) {
  s.acted = true; s.moved = 0;
  // good morale: a chance to act again at once
  const h = hero(B, s.side), m = h ? (h.skills.leadership || 0) + (h.morale || 0) : 0;
  if (m > 0 && s.count > 0 && !s.morale && B.rand() < m * 0.0417) { s.acted = false; s.morale = true; B.events.push({ t: 'morale', s: s.uid }); }
  checkOver(B);
}
function checkOver(B) {
  if (B.over) return;
  if (!alive(B, 0).length) B.over = { winner: 1 };
  else if (!alive(B, 1).length) B.over = { winner: 0 };
}
export function retreat(B, side) { B.over = { winner: 1 - side, fled: side }; }

// the hexes from which a stack can hit a target, nearest first
export function attackFrom(B, s, t) {
  const reach = reachable(B, s);
  return nbrs(t.c, t.r).filter(([x, y]) => reach.has(key(x, y))).sort((p, q) => reach.get(key(p[0], p[1])) - reach.get(key(q[0], q[1])));
}

// ---- spells cast by a hero, once per round
export function spellPower(B, side) { const h = hero(B, side); return h ? h.pow : 0; }
// damage a strike spell would deal (no dice), for the targeting preview; keep in step with castSpell below
export function spellDamage(B, side, id) {
  const h = hero(B, side); if (!h) return 0;
  const p = h.pow, base = id === 'arrow' ? 10 + 10 * p : id === 'bolt' ? 10 + 25 * p : id === 'fireball' ? 15 + 10 * p : 0;
  const dmg = base * (1 + 0.15 * (h.skills.sorcery || 0));
  return Math.round(B.mods.length && base ? modDamage(B, { a: null, d: null, side, dmg, ranged: false, melee: false, retal: false, spell: id, lucky: false, preview: true }) : dmg);
}
export function castSpell(B, side, id, target, c, r) {
  const h = hero(B, side), S = SPELLS[id];
  if (!h || B.cast[side] || h.mana < S.mana) return false;
  h.mana -= S.mana; B.cast[side] = true;
  const p = h.pow, boost = 1 + 0.15 * (h.skills.sorcery || 0);
  const ev = { t: 'spell', id, side, c: target ? target.c : c, r: target ? target.r : r, hits: [] };
  B.events.push(ev);
  const zap = (s, base) => { let dmg = base * boost; if (B.mods.length) dmg = modDamage(B, { a: null, d: s, side, dmg, ranged: false, melee: false, retal: false, spell: id, lucky: false, preview: false }); dmg = Math.max(0, Math.round(dmg)); const killed = hurt(B, s, dmg); ev.hits.push({ s: s.uid, dmg, killed, left: s.count }); if (s.count <= 0) died(B, s, null); };
  if (id === 'arrow') zap(target, 10 + 10 * p);
  else if (id === 'bolt') zap(target, 10 + 25 * p);
  else if (id === 'fireball') { for (const s of alive(B)) if (dist(s, [c, r]) <= 1) zap(s, 15 + 10 * p); }
  else if (id === 'cure') { let heal = 10 + 5 * p; target.hp = Math.min(target.u.hp, target.hp + heal); delete target.fx.slow; ev.hits.push({ s: target.uid, heal, left: target.count }); }
  else if (id === 'bless') target.fx.bless = 3;
  else if (id === 'stoneskin') target.fx.stoneskin = 3;
  else if (id === 'haste') target.fx.haste = 3;
  else if (id === 'slow') target.fx.slow = 3;
  checkOver(B);
  return true;
}

// ---- the AI: shooters shoot the most dangerous target, others charge the best target they can reach
const threat = (s) => s.count * ((s.u.dmg[0] + s.u.dmg[1]) / 2) * (s.u.ranged ? 1.4 : 1);
export function aiCast(B, side) {
  const h = hero(B, side);
  if (!h || B.cast[side]) return false;
  const known = h.spells.filter((id) => h.mana >= SPELLS[id].mana);
  if (!known.length) return false;
  const foes = alive(B, 1 - side).sort((a, b) => threat(b) - threat(a)), mine = alive(B, side).sort((a, b) => threat(b) - threat(a));
  for (const id of ['bolt', 'fireball', 'arrow', 'bless', 'haste', 'slow', 'stoneskin']) {
    if (!known.includes(id)) continue;
    const S = SPELLS[id];
    if (S.target === 'enemy') { const t = id === 'slow' ? foes.find((f) => !f.fx.slow && !f.u.ranged) : foes[0]; if (t) return castSpell(B, side, id, t); }
    if (S.target === 'area') { const t = foes[0]; if (t && !mine.some((m) => dist(m, t) <= 1)) return castSpell(B, side, id, null, t.c, t.r); }
    if (S.target === 'ally') { const t = mine.find((m) => !m.fx[id]); if (t && B.rand() < 0.6) return castSpell(B, side, id, t); }
  }
  return false;
}
export function aiAct(B, s) {
  const foes = alive(B, 1 - s.side);
  if (!foes.length) return;
  if (canShoot(B, s)) { const t = foes.slice().sort((a, b) => threat(b) - threat(a))[0]; actShoot(B, s, t); return; }
  // melee: the best target in reach (most damage dealt, killers first), else walk toward the nearest
  let best = null, bestScore = -1e9;
  for (const t of foes) {
    const from = attackFrom(B, s, t);
    if (!from.length && !nbrs(t.c, t.r).some(([x, y]) => x === s.c && y === s.r)) continue;
    const here = nbrs(t.c, t.r).some(([x, y]) => x === s.c && y === s.r);
    const sc = threat(t) / (t.count * t.u.hp) * 10 + (t.u.ranged ? 6 : 0) + (here ? 2 : 0) - t.u.def * 0.1;
    if (sc > bestScore) { bestScore = sc; best = { t, from: here ? [s.c, s.r] : from[0] }; }
  }
  if (best) { actAttack(B, s, best.t, best.from); return; }
  // shooters with no arrows left, or nothing in reach: close in (ranged stacks hang back)
  // (unless a rule forbids this stack to shoot at all: then it marches like a walker)
  if (s.u.ranged && s.shots > 0 && !(B.mods.length && !adjacentEnemy(B, s) && !canShoot(B, s))) { actDefend(B, s); return; }
  const reach = reachable(B, s);
  let goal = foes.slice().sort((a, b) => dist(s, a) - dist(s, b))[0];
  // besiegers on foot head for the gate while it is shut and the defenders are behind the wall
  if (gateShut(B, s) && !s.u.fly) {
    const behind = (t) => (B.town.side ?? 1) === 1 ? t.r < B.wallRow : t.r > B.wallRow;
    if (behind(goal)) goal = [B.gate % COLS, (B.gate / COLS) | 0];
  }
  let bk = null, bd = 1e9;
  for (const k of reach.keys()) { const c = k % COLS, r = (k / COLS) | 0, d = dist([c, r], goal); if (d < bd) { bd = d; bk = [c, r]; } }
  if (bk && (bk[0] !== s.c || bk[1] !== s.r)) actMove(B, s, bk[0], bk[1]); else actDefend(B, s);
}
// quick combat: play the whole fight with the AI on both sides
export function autoResolve(B, maxSteps = 600) {
  for (let i = 0; i < maxSteps && !B.over; i++) {
    const s = nextStack(B);
    if (!s) break;
    if (!B.cast[s.side] && B.rand() < 0.5) aiCast(B, s.side);
    if (B.over) break;
    aiAct(B, s);
  }
  if (!B.over) B.over = { winner: alive(B, 0).reduce((a, s) => a + s.count * s.u.hp, 0) >= alive(B, 1).reduce((a, s) => a + s.count * s.u.hp, 0) ? 0 : 1 };
  return B.over;
}
// rough strength of an army, for the AI and for the "how dangerous is this" hint
export function armyPower(army, h) {
  let p = 0;
  for (const st of army) { if (!st) continue; const [id, n] = st; if (!(id && n > 0)) continue; const u = UNITS[id]; p += n * u.hp * ((u.dmg[0] + u.dmg[1]) / 2) * (1 + (u.att + u.def) * 0.03) * (u.ranged ? 1.25 : 1) * (u.fly ? 1.1 : 1); }
  if (h) p *= 1 + (h.att + h.def) * 0.05 + h.pow * 0.03;
  return p;
}
