// Crown Run engine + battle modifier tests. Run: node realms/dev/crown_test.mjs
import * as BT from '../battle.js?v=1.10';
import * as C from '../crown.js?v=1.10';
import { UNITS } from '../data.js?v=1.10';
import { UNITS as BUNITS } from '../data.js'; // the instance battle.js imports

let fails = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const run0 = (o = {}) => C.newRun({ seed: 7, ...o });
const withBanners = (ids, o = {}) => { const r = run0(o); for (const id of ids) r.banners.push(typeof id === 'string' ? { id, gilded: false, n: 0 } : id); r.slots = 9; return r; };
const fight = (armyA, armyB, mods, seed = 1, heroA = null, heroB = null) => {
  const B = BT.createBattle({ armyA, armyB, heroA, heroB, mods, rng: C.mulberry32(seed) });
  BT.autoResolve(B); return B;
};
const evs = [];
const fightLog = (armyA, armyB, mods, seed) => { const B = BT.createBattle({ armyA, armyB, mods, rng: C.mulberry32(seed) }); const log = []; for (let i = 0; i < 600 && !B.over; i++) { const s = BT.nextStack(B); if (!s) break; BT.aiAct(B, s); log.push(...B.events); B.events.length = 0; } return { B, log }; };
const alive0 = (B) => BT.alive(B, 0).reduce((a, s) => a + s.count, 0);

// ---- 1. no mods = the classic rules: shared unit table, same seed -> same battle
{
  const A = [['pikeman', 30], ['archer', 12], ['griffin', 4]], D = [['orc', 20], ['wolf', 14], ['ogre', 4]];
  const b1 = fight(A, D, null, 3), b2 = fight(A, D, [], 3);
  ok(b1.stacks.every((s) => s.u === BUNITS[s.id]), 'no mods: stacks share the UNITS table (Free Play untouched)');
  ok(JSON.stringify(b1.stacks.map((s) => s.count)) === JSON.stringify(b2.stacks.map((s) => s.count)) && b1.over.winner === b2.over.winner, 'seeded battles are deterministic');
  const m = fight(A, D, C.battleMods(run0()), 3);
  ok(m.stacks.every((s) => s.u !== UNITS[s.id] && s.u.att === UNITS[s.id].att), 'run with no banners: private stat copies, same numbers');
}

// ---- 2. War Drum: +1 damage per creature on melee (estimate shows it, battle uses it)
{
  const A = [['pikeman', 40]], D = [['ogre', 10]];
  const est = (mods) => { const B = BT.createBattle({ armyA: A, armyB: D, mods, rng: C.mulberry32(1) }); return BT.estimate(B, B.stacks[0], B.stacks[1], false); };
  const e0 = est(C.battleMods(run0())), e1 = est(C.battleMods(withBanners(['war_drum'])));
  ok(e1.lo - e0.lo === 40 && e1.hi - e0.hi === 40, `War Drum adds 40 damage for 40 pikemen (${e0.lo}-${e0.hi} -> ${e1.lo}-${e1.hi})`);
  const g = est(C.battleMods(withBanners([{ id: 'war_drum', gilded: true, n: 0 }])));
  ok(g.lo - e0.lo === 60, 'Gilded War Drum adds ×1.5 (60)');
}

// ---- 3. order matters: [+] then [×] beats [×] then [+]; Herald counts banners on its left
{
  const A = [['pikeman', 40]], D = [['ogre', 10]];
  const est = (ids) => { const B = BT.createBattle({ armyA: A, armyB: D, mods: C.battleMods(withBanners(ids)), rng: C.mulberry32(1) }); return BT.estimate(B, B.stacks[0], B.stacks[1], false).hi; };
  const left = est(['war_drum', 'vanguard']), right = est(['vanguard', 'war_drum']);
  ok(left > right, `War Drum left of Vanguard: ${left} > ${right}`);
  const h0 = est(['herald']), h2 = est(['pike_wall', 'golden_purse', 'herald']);
  ok(Math.abs(h2 / h0 - 1.44) < 0.03, `Crown Herald with 2 banners to its left ×1.44 (${h0} -> ${h2})`);
}

// ---- 4. Mirror copies the banner to its right: Mirror + Heavy Volley = ×2.25 on shots
{
  const A = [['archer', 20]], D = [['ogre', 10]];
  const est = (ids) => { const B = BT.createBattle({ armyA: A, armyB: D, mods: C.battleMods(withBanners(ids)), rng: C.mulberry32(1) }); return BT.estimate(B, B.stacks[0], B.stacks[1], true).hi; };
  const base = est([]), hv = est(['heavy_volley']), mir = est(['mirror', 'heavy_volley']), wrong = est(['heavy_volley', 'mirror']);
  ok(Math.abs(hv / base - 1.5) < 0.02 && Math.abs(mir / base - 2.25) < 0.03, `Heavy Volley ×1.5, Mirror+Heavy ×2.25 (${base}/${hv}/${mir})`);
  ok(wrong === hv, 'Mirror with nothing to its right copies nothing');
}

// ---- 5. The Wall (boss): your archers never shoot; Sky Lances lets archers shoot point-blank
{
  const A = [['archer', 30], ['pikeman', 20]], D = [['ogre', 6], ['orc', 10]];
  const free = fightLog(A, D, C.battleMods(run0()), 5), wall = fightLog(A, D, C.battleMods(run0(), { boss: 'wall' }), 5);
  const shots = (L) => L.log.filter((e) => e.t === 'shot' && L.B.stacks[e.a].side === 0).length;
  ok(shots(free) > 0 && shots(wall) === 0, `The Wall: your shots ${shots(free)} -> ${shots(wall)}`);
  const B = BT.createBattle({ armyA: [['archer', 10]], armyB: [['goblin', 5]], mods: C.battleMods(withBanners(['sky_lances'])), rng: C.mulberry32(1) });
  const a = B.stacks[0], g = B.stacks[1]; g.c = a.c; g.r = a.r - 1;
  const B2 = BT.createBattle({ armyA: [['archer', 10]], armyB: [['goblin', 5]], rng: C.mulberry32(1) }); B2.stacks[1].c = B2.stacks[0].c; B2.stacks[1].r = B2.stacks[0].r - 1;
  ok(BT.adjacentEnemy(B, a) && BT.canShoot(B, a) && !BT.canShoot(B2, B2.stacks[0]), 'Sky Lances: shooting with an enemy adjacent (rule break)');
  const both = BT.createBattle({ armyA: [['archer', 10]], armyB: [['goblin', 5]], mods: C.battleMods(withBanners(['sky_lances']), { boss: 'wall' }), rng: C.mulberry32(1) });
  ok(!BT.canShoot(both, both.stacks[0]), 'boss rules apply after banners: The Wall beats Sky Lances');
}

// ---- 6. The Plague: first stack loses 30% before round 1; the Ward Seal ignores it
{
  const A = [['pikeman', 30], ['archer', 10]], D = [['goblin', 5]];
  const B = BT.createBattle({ armyA: A, armyB: D, mods: C.battleMods(run0(), { boss: 'plague' }), rng: C.mulberry32(1) });
  ok(B.stacks[0].count === 21 && B.stacks[1].count === 10, `The Plague: 30 pikemen -> ${B.stacks[0].count}`);
  const W = BT.createBattle({ armyA: A, armyB: D, mods: C.battleMods(run0(), { boss: 'plague', seals: ['ward'] }), rng: C.mulberry32(1) });
  ok(W.stacks[0].count === 30 && W.stacks[1].count === 7, 'Ward Seal on slot 1: the Plague hits the next stack');
}

// ---- 7. Gryphon Standard: griffins take no retaliation
{
  const run = (mods) => { const B = BT.createBattle({ armyA: [['griffin', 8]], armyB: [['ogre', 6]], mods, rng: C.mulberry32(2) }); const g = B.stacks[0], o = B.stacks[1]; o.c = g.c; o.r = g.r - 1; BT.actAttack(B, g, o, null); return B.events.filter((e) => e.retal).length; };
  ok(run(C.battleMods(run0())) === 1 && run(C.battleMods(withBanners(['gryphon']))) === 0, 'Gryphon Standard: no retaliation against fliers');
}

// ---- 8. banners change a battle outcome deterministically (same seed, same armies)
{
  const A = [['pikeman', 26], ['archer', 10], ['griffin', 4]], D = [['orc', 22], ['wolf', 14], ['ogre', 4]];
  let flips = 0, tried = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const a = fight(A, D, C.battleMods(run0()), seed), b = fight(A, D, C.battleMods(withBanners(['war_drum', 'fletcher', 'heavy_volley', 'vanguard', 'herald'])), seed);
    tried++; if (a.over.winner === 1 && b.over.winner === 0) flips++;
    if (seed === 1) ok(alive0(b) >= alive0(a), `seed 1: survivors ${alive0(a)} -> ${alive0(b)} with 5 banners`);
  }
  ok(flips > 0, `banners flip lost battles into wins (${flips}/${tried} seeds)`);
  const w1 = fight(A, D, C.battleMods(withBanners(['war_drum', 'herald'])), 9), w2 = fight(A, D, C.battleMods(withBanners(['war_drum', 'herald'])), 9);
  ok(JSON.stringify(w1.stacks.map((s) => s.count)) === JSON.stringify(w2.stacks.map((s) => s.count)), 'modded battles replay identically');
}

// ---- 9. Trophy Pike scales with kills; Bone Tally raises skeletons; run tracker
{
  const r = withBanners(['trophy_pike', 'bone_tally']);
  const B = fight([['pikeman', 60], ['griffin', 8]], [['goblin', 20], ['wolf', 6]], C.battleMods(r), 4);
  const res = C.afterBattle(r, B, { won: B.over.winner === 0 });
  ok(r.banners[0].n === 2 && r.stats.stacksKilled === 2, `Trophy Pike counter = ${r.banners[0].n}`);
  ok(res.raise === Math.floor(res.slainLiving * 0.1) && res.raise > 0, `Bone Tally raises ${res.raise} of ${res.slainLiving}`);
  ok(r.stats.bestHit > 0, `best strike tracked (${r.stats.bestHit})`);
}

// ---- 10. schedule, threats, payout, shop, save/load, meta
{
  const r = run0();
  ok(C.nextBlind(r).day === 3 && C.blindDue(r, 2) === null && C.blindDue(r, 3).kind === 'raid', 'Raid at the end of day 3');
  const powers = [];
  for (let a = 1; a <= 3; a++) for (const k of C.BLINDS) { const t = C.threatArmy(r, a, k); powers.push(t.power); ok(Math.abs(t.power / t.target - 1) < 0.35, `threat A${a} ${k}: power ${t.power} ~ target ${t.target} (${t.army.map(([id, n]) => n + ' ' + id).join(', ')})`); }
  ok(powers.every((p, i) => (i % 3 === 0 || p > powers[i - 1]) && (i < 3 || p > powers[i - 3])), 'threat rises within each Ante and from Ante to Ante');
  r.crowns = 23; r.banners.push({ id: 'golden_purse', gilded: false, n: 0 });
  const p = C.payout(r, 'raid', { unbroken: 5 });
  ok(p.total === 3 + 3 + 2 + 4, `payout raid: ${p.lines.map((l) => l.label + ' ' + l.n).join(' | ')}`);
  r.crowns = 100; ok(C.payout(r, 'boss').lines.find((l) => l.k === 'interest').n === 5, 'interest capped at 5');
  r.banners.push({ id: 'treasury', gilded: false, n: 0 }); ok(C.interestCap(r) === 10, 'Royal Treasury: cap 10');
  const meta = C.metaDefault();
  C.advanceBlind(r);
  const s1 = JSON.stringify(C.genShop(r, meta, { known: ['bless'], army: [['pikeman', 10], ['archer', 5]] }));
  const copy = C.runLoad(C.runSave(r)); const s2 = JSON.stringify(C.genShop(copy, meta, { known: ['bless'], army: [['pikeman', 10], ['archer', 5]] }));
  ok(s1 === s2, 'seeded shop: identical after save/load');
  const c0 = r.crowns; C.reroll(r, meta, {}); ok(r.crowns === c0 - 5 && C.rerollCost(r) === 6, 'reroll 5₵, then 6₵');
  const bi = r.shop.cards.findIndex((c) => c.kind === 'banner');
  if (bi >= 0) { const nb = r.banners.length; const b = C.buy(r, 'card', bi, meta); ok(b.ok && r.banners.length === nb + 1, `bought ${b.item.id}`); }
  const sv = C.sell(r, 0); ok(sv === 2, 'sell Golden Purse for 2₵');
  r.banners = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; C.moveBanner(r, 0, 2); ok(r.banners.map((b) => b.id).join('') === 'bca', 'reorder banners');
  const pk = C.openPack(r, 'war', 'chest:5', meta), pk2 = C.openPack(r, 'war', 'chest:5', meta);
  ok(pk.choices.length === 3 && JSON.stringify(pk) === JSON.stringify(pk2), `War Chest: ${pk.choices.map((c) => c.id).join(', ')}`);
  const mu = C.openPack(r, 'muster', 'chest:6', meta); ok(mu.choices.every((c) => UNITS[c.id] && c.n > 0), `Muster: ${mu.choices.map((c) => c.n + ' ' + c.id + (c.seal ? '+' + c.seal : '')).join(', ')}`);
  // run end: beating the Lich Queen unlocks Necropolis
  const w = run0(); w.stats.bossesBeaten = ['wall', 'plague', 'lich_queen']; w.stats.blindsWon = 9; w.won = true; w.over = true;
  for (let a = 1; a <= 3; a++) for (const k of C.BLINDS) w.stats.blindLog.push({ ante: a, kind: k, won: true });
  const m2 = C.metaDefault(), E = C.endRun(w, m2, { armyPower: 20000 });
  ok(m2.unlocks.factions.includes('necro') && E.unlocks.some((u) => u.id === 'necro') && E.score > 0 && m2.glory === E.glory, `end of run: score ${E.score}, glory ${E.glory}, unlocks ${E.unlocks.map((u) => u.name).join(', ')}`);
  const store = { m: {}, get(k, d) { return k in this.m ? JSON.parse(this.m[k]) : d; }, set(k, v) { this.m[k] = JSON.stringify(v); } };
  C.metaSave(store, m2); ok(C.metaLoad(store).unlocks.factions.includes('necro') && Object.keys(store.m)[0] === 'realms.crown.meta', 'meta save in its own key');
}

console.log(`\n${n - fails}/${n} passed`);
if (fails) process.exit(1);
