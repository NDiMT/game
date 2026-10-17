// Crown Run meta-progression simulation (agent crown2, v2.8). Run: node realms/dev/crown_sim.mjs [players=400] [runs=30]
// A simple player model plays N runs against the real scoring and unlock rules (crown.js endRun / unlockStatus):
//   - per region: 1–2 weekly invasions (each survived with p_inv), then the Legendary Hero (beaten with p_boss)
//   - the odds grow with experience (runs played), unlocked perks, and fall with difficulty
//   - the player always plays the newest unlocked faction for a while, at the highest difficulty unlocked for it,
//     and buys the cheapest affordable perk after every run
// It prints one typical player's 30-run table and, over many players, when each unlock lands (median / 10th–90th pct).
import * as C from '../crown.js';

const P = +(process.argv[2] || 400), N = +(process.argv[3] || 30);
const rng = C.mulberry32;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function playRun(meta, k, r) {
  const facs = meta.unlocks.factions, fac = facs[facs.length - 1 - (k % 3 === 0 && facs.length > 1 ? 1 : 0)];
  const diff = meta.unlocks.diffs[fac] || 1;
  const perkLv = Object.values(meta.perks).reduce((a, b) => a + b, 0);
  const skill = clamp(0.46 + 0.015 * k + 0.01 * perkLv, 0, 0.88) - 0.06 * (diff - 1);
  const run = C.newRun({ seed: 1 + ((r() * 1e9) | 0), diff, fac, meta });
  let alive = true, week = 0, invasions = 0;
  for (let reg = 1; reg <= run.regions && alive; reg++) {
    run.region = reg;
    const weeks = r() < 0.5 ? 1 : 2;
    for (let i = 0; i < weeks && alive; i++) { week++; if (r() < clamp(skill + 0.3 - 0.04 * reg, 0.3, 0.97)) { run.stats.invasions.push(week); invasions++; if (r() < 0.08) run.stats.wallsHeld++; } else alive = false; }
    if (!alive) break;
    if (r() < clamp(skill + 0.08 - 0.12 * (reg - 1), 0.1, 0.92)) run.stats.guardians.push(run.guardians[reg - 1]); else alive = false;
  }
  run.won = alive; run.over = true;
  if (r() < 0.02 + 0.05 * (run.region - 1) + (run.won ? 0.05 : 0)) run.stats.setsDone.push('warlord');
  // artifacts seen this run (sites, merchants, spoils): ~6 + 5 per region reached, drawn from the whole pool
  const ids = Object.keys(C.ARTIFACTS); for (let i = 0; i < 6 + 5 * run.region; i++) C.discover(meta, 'artifact', ids[(r() * ids.length) | 0]);
  const gold = Math.round((2500 + 3500 * run.region + (run.won ? 4000 : 0)) * (0.5 + r()));
  const ap = C.guardianPower(Math.min(3, run.region), diff) * (0.6 + 0.4 * r());
  const res = C.endRun(run, meta, { armyPower: ap, gold });
  // buy the cheapest perk level on sale
  for (;;) { const c = Object.keys(C.PERKS).filter((id) => C.perkUnlocked(meta, id) && (meta.perks[id] || 0) < C.PERKS[id].max).sort((a, b) => C.perkCost(a, meta.perks[a] || 0) - C.perkCost(b, meta.perks[b] || 0))[0]; if (!c || !C.buyPerk(meta, c)) break; }
  return { k, fac, diff, region: run.region, won: run.won, glory: res.glory, renown: meta.life.glory, unlocks: res.unlocks.map((u) => u.name) };
}

const players = [];
for (let p = 0; p < P; p++) { const r = rng(7919 * (p + 1)), meta = C.metaDefault(), rows = []; for (let k = 1; k <= N; k++) rows.push(playRun(meta, k, r)); players.push({ rows, meta }); }

// the typical player: the one whose total unlock count by run N is the median
const count = (pl) => pl.rows.reduce((a, x) => a + x.unlocks.length, 0);
const sorted = players.slice().sort((a, b) => count(a) - count(b)), typ = sorted[sorted.length >> 1];
console.log(`Typical player (median unlocks by run ${N}): ${count(typ)} unlocks\n`);
console.log('| Run | Faction | Tier | Reached | Glory | Renown | Unlocked this run |');
console.log('|---|---|---|---|---|---|---|');
for (const x of typ.rows) console.log(`| ${x.k} | ${x.fac} | ${x.diff} | ${x.won ? 'won' : `region ${x.region}`} | ${x.glory} | ${x.renown} | ${x.unlocks.join(', ') || '–'} |`);

// when each unlock lands, over all players
const when = new Map();
for (const pl of players) for (const x of pl.rows) for (const u of x.unlocks) { if (!when.has(u)) when.set(u, []); when.get(u).push(x.k); }
const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(q * a.length))];
console.log(`\nOver ${P} players × ${N} runs: the run on which each unlock lands (median, 10th–90th percentile, share of players who got it)\n`);
console.log('| Unlock | Median run | 10–90% | Got it by run ' + N + ' |');
console.log('|---|---|---|---|');
const rows = [...when.entries()].map(([u, a]) => [u, a.sort((x, y) => x - y)]).sort((a, b) => pct(a[1], 0.5) - pct(b[1], 0.5));
for (const [u, a] of rows) console.log(`| ${u} | ${pct(a, 0.5)} | ${pct(a, 0.1)}–${pct(a, 0.9)} | ${Math.round((a.length / P) * 100)}% |`);
const per = Array.from({ length: N }, (_, i) => players.reduce((a, pl) => a + pl.rows[i].unlocks.length, 0) / P);
const multi = players.reduce((a, pl) => a + pl.rows.filter((x) => x.unlocks.length >= 2).length, 0) / (P * N);
const zero = players.reduce((a, pl) => a + pl.rows.filter((x) => !x.unlocks.length).length, 0) / (P * N);
console.log(`\nUnlocks per run (mean over players): ${per.map((x) => x.toFixed(2)).join(' ')}`);
console.log(`Runs with 0 unlocks: ${Math.round(zero * 100)}%, with 2: ${Math.round(multi * 100)}%. Mean wins by run ${N}: ${(players.reduce((a, pl) => a + pl.meta.wins, 0) / P).toFixed(1)}; mean Renown: ${Math.round(players.reduce((a, pl) => a + pl.meta.life.glory, 0) / P)}`);
const cum = [5, 10, 15, 20, 25, 30].filter((k) => k <= N).map((k) => `${k}: ${(players.reduce((a, pl) => a + pl.rows.slice(0, k).reduce((b, x) => b + x.unlocks.length, 0), 0) / P).toFixed(1)}`);
console.log(`Cumulative unlocks by run (mean): ${cum.join(' · ')}  (core content: ${C.UNLOCKS.length} unlocks + difficulty tiers)`);
