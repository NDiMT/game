// Crown Run engine + battle modifier tests. Run: node realms/dev/crown_test.mjs
import * as BT from '../battle.js?v=1.10';
import * as C from '../crown.js?v=1.10';
import { UNITS } from '../data.js?v=1.10';
import { UNITS as BUNITS } from '../data.js'; // the instance battle.js imports

let fails = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const run0 = (o = {}) => C.newRun({ seed: 7, ...o });
const wearing = (ids, o = {}) => { const r = run0(o); for (const id of ids) { const where = C.addArtifact(r, id); if (where === 'backpack') throw new Error('slot clash in test: ' + id); } return r; };
const fight = (armyA, armyB, mods, seed = 1, heroA = null, heroB = null) => { const B = BT.createBattle({ armyA, armyB, heroA, heroB, mods, rng: C.mulberry32(seed) }); BT.autoResolve(B); return B; };
const fightLog = (armyA, armyB, mods, seed) => { const B = BT.createBattle({ armyA, armyB, mods, rng: C.mulberry32(seed) }); const log = []; for (let i = 0; i < 600 && !B.over; i++) { const s = BT.nextStack(B); if (!s) break; BT.aiAct(B, s); log.push(...B.events); B.events.length = 0; } return { B, log }; };
const hero0 = () => ({ att: 0, def: 0, pow: 0, know: 0, mana: 0, skills: {}, spells: [], luck: 0, morale: 0 });
const est = (A, D, ids, ranged = false) => { const B = BT.createBattle({ armyA: A, armyB: D, heroA: hero0(), mods: C.battleMods(wearing(ids)), rng: C.mulberry32(1) }); return BT.estimate(B, B.stacks[0], B.stacks[1], ranged); };
const alive0 = (B) => BT.alive(B, 0).reduce((a, s) => a + s.count, 0);

// ---- 1. no mods = the classic rules
{
  const A = [['pikeman', 30], ['archer', 12], ['griffin', 4]], D = [['orc', 20], ['wolf', 14], ['ogre', 4]];
  const b1 = fight(A, D, null, 3), b2 = fight(A, D, [], 3);
  ok(b1.stacks.every((s) => s.u === BUNITS[s.id]), 'no mods: stacks share the UNITS table (Free Play untouched)');
  ok(JSON.stringify(b1.stacks.map((s) => s.count)) === JSON.stringify(b2.stacks.map((s) => s.count)) && b1.over.winner === b2.over.winner, 'seeded battles are deterministic');
  const m = fight(A, D, C.battleMods(run0()), 3);
  ok(m.stacks.every((s) => s.u !== BUNITS[s.id] && s.u.att === UNITS[s.id].att), 'a run with no artifacts: private stat copies, same numbers');
}

// ---- 2. equipment: slots, backpack, swap, sets
{
  const r = run0();
  ok(C.addArtifact(r, 'centaur_axe') === 'weapon' && C.addArtifact(r, 'judgement') === 'backpack', 'second weapon goes to the backpack');
  ok(C.equip(r, 0) === 'weapon' && r.equip.weapon.id === 'judgement' && r.backpack[0].id === 'centaur_axe', 'equip from the backpack swaps the weapon');
  C.addArtifact(r, 'talon_ring'); C.addArtifact(r, 'vitality_ring'); ok(r.equip.ring1 && r.equip.ring2 && C.addArtifact(r, 'iron_oath') === 'backpack', 'two ring slots');
  ok(C.unequip(r, 'ring2') && !r.equip.ring2, 'unequip to the backpack');
  const w = run0({ background: 'warlord' }); C.addArtifact(w, 'clover'); C.addArtifact(w, 'valor_badge'); ok(C.addArtifact(w, 'tempest_orb') === 'backpack', 'Warlord background: one Misc slot fewer');
  const s = wearing(['war_drum', 'vanguard_standard']); ok(!C.activeSets(s).length, 'two of three pieces: no set bonus');
  C.addArtifact(s, 'executioner_axe'); ok(C.activeSets(s)[0]?.id === 'warlord' && s.stats.setsDone.includes('warlord'), "Warlord's Regalia completes");
}

// ---- 3. artifacts change damage: War Drum adds, order of slots matters for + before ×
{
  const A = [['pikeman', 40]], D = [['ogre', 10]];
  const e0 = est(A, D, []), e1 = est(A, D, ['war_drum']);
  ok(e1.lo - e0.lo === 40 && e1.hi - e0.hi === 40, `War Drum adds 40 damage for 40 pikemen (${e0.lo}-${e0.hi} -> ${e1.lo}-${e1.hi})`);
  const v = est(A, D, ['war_drum', 'vanguard_standard']); ok(Math.abs(v.hi - Math.round((e0.hi + 40) * 1.5)) <= 1, `Vanguard Standard multiplies after the drum (${v.hi})`);
  const st = est(A, D, ['judgement']); ok(st.hi > e0.hi, `Sword of Judgement +4 Attack via the hero (${e0.hi} -> ${st.hi})`);
}

// ---- 4. Sharpshooter's Kit: pieces add up, the set lets shooters fire point-blank and ricochet
{
  const A = [['archer', 20]], D = [['ogre', 10]];
  const base = est(A, D, [], true).hi, bow = est(A, D, ['sharpshooter_bow'], true).hi;
  ok(Math.abs(bow / base - 1.5) < 0.03, `Sharpshooter's Bow ×1.5 (${base} -> ${bow})`);
  const r = wearing(['plenty_quiver', 'sharpshooter_bow', 'elven_bowstring']);
  const B = BT.createBattle({ armyA: [['archer', 10]], armyB: [['goblin', 5], ['wolf', 3]], mods: C.battleMods(r), rng: C.mulberry32(1) });
  const a = B.stacks[0], g = B.stacks[1]; g.c = a.c; g.r = a.r - 1;
  const B2 = BT.createBattle({ armyA: [['archer', 10]], armyB: [['goblin', 5]], rng: C.mulberry32(1) }); B2.stacks[1].c = B2.stacks[0].c; B2.stacks[1].r = B2.stacks[0].r - 1;
  ok(BT.canShoot(B, a) && !BT.canShoot(B2, B2.stacks[0]), 'set bonus: shoot with an enemy adjacent (rule break)');
  BT.actShoot(B, a, g); ok(B.events.some((e) => e.t === 'mod' && e.text === 'Ricochet'), 'set bonus: every shot ricochets');
}

// ---- 5. Legendary Heroes' rules
{
  const A = [['archer', 30], ['pikeman', 20]], D = [['ogre', 6], ['orc', 10]];
  const free = fightLog(A, D, C.battleMods(run0()), 5), wall = fightLog(A, D, C.battleMods(run0(), { guardian: 'wall' }), 5);
  const shots = (L) => L.log.filter((e) => e.t === 'shot' && L.B.stacks[e.a].side === 0).length;
  ok(shots(free) > 0 && shots(wall) === 0, `Gorrak the Wall: your shots ${shots(free)} -> ${shots(wall)}`);
  const P = BT.createBattle({ armyA: [['pikeman', 30], ['archer', 10]], armyB: [['goblin', 5]], mods: C.battleMods(run0(), { guardian: 'plague' }), rng: C.mulberry32(1) });
  ok(P.stacks[0].count === 21, `Malphas's Plague: 30 pikemen -> ${P.stacks[0].count}`);
  const L = BT.createBattle({ armyA: [['pikeman', 5]], armyB: [['skeleton', 5]], mods: C.battleMods(run0(), { guardian: 'lich_queen' }), rng: C.mulberry32(1) });
  ok(L.stacks[1].u.drain && !L.stacks[0].u.drain, "the Lich Queen's army drains life");
  const U = wearing(['usurper_crown']); const UB = BT.createBattle({ armyA: [['pikeman', 5]], armyB: [['skeleton', 5]], mods: C.battleMods(U, { guardian: 'lich_queen' }), rng: C.mulberry32(1) });
  ok(UB.stacks[0].u.drain, "Usurper's Crown: the rule binds both sides");
}

// ---- 6. Wings of the Griffin: no retaliation against fliers
{
  const go = (r) => { const B = BT.createBattle({ armyA: [['griffin', 8]], armyB: [['ogre', 6]], mods: C.battleMods(r), rng: C.mulberry32(2) }); const g = B.stacks[0], o = B.stacks[1]; o.c = g.c; o.r = g.r - 1; BT.actAttack(B, g, o, null); return B.events.filter((e) => e.retal).length; };
  ok(go(run0()) === 1 && go(wearing(['griffin_cape', 'feathered_boots', 'talon_ring'])) === 0, 'Wings of the Griffin: fliers attack without retaliation');
}

// ---- 7. artifacts flip seeded battles deterministically
{
  const A = [['pikeman', 26], ['archer', 10], ['griffin', 4]], D = [['orc', 22], ['wolf', 14], ['ogre', 4]], kit = ['war_drum', 'vanguard_standard', 'executioner_axe', 'plenty_quiver', 'pike_pauldron'];
  let flips = 0;
  for (let seed = 1; seed <= 30; seed++) { const a = fight(A, D, C.battleMods(run0()), seed), b = fight(A, D, C.battleMods(wearing(kit)), seed); if (a.over.winner === 1 && b.over.winner === 0) flips++; }
  ok(flips > 0, `artifacts turn lost battles into wins (${flips}/30 seeds)`);
  const w1 = fight(A, D, C.battleMods(wearing(kit)), 9), w2 = fight(A, D, C.battleMods(wearing(kit)), 9);
  ok(JSON.stringify(w1.stacks.map((s) => s.count)) === JSON.stringify(w2.stacks.map((s) => s.count)), 'modded battles replay identically');
}

// ---- 8. after a battle: Necklace of Trophies grows, Bone Cloak raises, the Undead King set raises more
{
  const r = wearing(['trophy_necklace']); C.addArtifact(r, 'skull_helm'); C.addArtifact(r, 'vampire_ring');
  const B = fight([['pikeman', 60], ['griffin', 8]], [['goblin', 20], ['wolf', 6]], C.battleMods(r), 4);
  const res = C.afterBattle(r, B, { won: B.over.winner === 0 });
  ok(r.equip.neck.n === 2 && r.stats.stacksKilled === 2, `Necklace of Trophies counter = ${r.equip.neck.n}`);
  ok(res.raise === 0, 'no Bone Cloak: nobody raised');
  const u = wearing(['bone_cloak', 'skull_helm', 'vampire_ring']); const B2 = fight([['pikeman', 60], ['griffin', 8]], [['goblin', 20], ['wolf', 6]], C.battleMods(u), 4); const r2 = C.afterBattle(u, B2, { won: true });
  ok(r2.raiseAs === 'skelwarrior' && r2.raise === Math.floor(r2.slainLiving * 0.25), `Cloak of the Undead King raises ${r2.raise} Skeleton Warriors of ${r2.slainLiving}`);
}

// ---- 9. threats, keys, invasions
{
  const r = run0();
  const g = [1, 2, 3].map((reg) => C.guardianArmy(r, reg)); ok(g.every((x, i) => Math.abs(x.power / x.target - 1) < 0.35 && (i === 0 || x.power > g[i - 1].power)), `Legendary armies ${g.map((x) => x.power).join(' < ')}`);
  const inv = [1, 2, 3, 4].map((w) => C.invasionArmy(r, w)); ok(inv.every((x, i) => i === 0 || x.power > inv[i - 1].power), `invasions escalate ${inv.map((x) => x.power).join(' < ')}`);
  ok(C.invasionDue(r, 4).warn && !C.invasionDue(r, 5).warn && C.invasionDue(r, 4).arrive === 7, 'invasion warned on day 4, at the walls on day 7');
  ok(C.takeKey(r) === 'guarded', "the Keymaster's Tent is guarded until its Legendary Hero falls");
  r.stats.guardians.push(r.guardians[0]); ok(C.takeKey(r) === 'key' && r.region === 2, 'the key opens region 2');
  r.stats.guardians.push(r.guardians[1]); C.takeKey(r); r.stats.guardians.push(r.guardians[2]); ok(C.takeKey(r) === 'crown' && r.won && r.over, 'the last tent holds the Crown: the run is won');
}

// ---- 10. sites with choices, merchants, save/load, meta
{
  const r = run0(), meta = C.metaDefault(), ctx = { known: ['bless'], skills: { leadership: 1 } };
  const pc = C.pandoraChoices(r, 12, meta, ctx); ok(pc.length === 3 && JSON.stringify(pc) === JSON.stringify(C.pandoraChoices(C.runLoad(C.runSave(r)), 12, meta, ctx)), `Pandora's Box: ${pc.map((c) => c.kind + ':' + (c.id || c.n)).join(', ')} (seeded)`);
  const chests = Array.from({ length: 200 }, (_, i) => C.chestChoices(r, i, meta)), artChests = chests.filter((ch) => ch.some((c) => c.kind === 'artifact')).length;
  ok(chests.every((ch) => ch.length === 3 && ch[0].kind === 'gold' && ch[1].kind === 'xp') && artChests > 40 && artChests < 100, `Treasure Chest: gold, experience, and a trinket only sometimes (${artChests}/200)`);
  ok(C.witchChoices(r, 5, ctx).length === 3 && C.shrineChoices(r, 5, ctx).every((c) => c.id !== 'bless'), 'Witch Hut 3 skills, Shrine 3 unknown spells');
  const st = C.merchantStock(r, 9, 3, meta), st2 = C.merchantStock(r, 9, 9, meta); ok(st.length === 3 && st.every((x) => x.price > 0) && JSON.stringify(st) !== JSON.stringify(st2), `Artifact Merchant stock rotates weekly (${st.map((x) => x.id + ' ' + x.price).join(', ')})`);
  ok(C.merchantStock(r, 9, 3, meta, true).every((x) => ['major', 'relic'].includes(C.ARTIFACTS[x.id].rarity)), 'Black Market: Major and Relic only');
  const q = C.seerQuest(r, 4, meta); ok(q.need.gold && q.reward && C.ARTIFACTS[q.reward].rarity === 'minor', `Seer's Hut (region 1): bring ${JSON.stringify(q.need)} for ${q.reward}`);
  const r2 = run0(); r2.region = 2; ok(C.ARTIFACTS[C.seerQuest(r2, 4, meta).reward].rarity === 'major', "Seer's Hut deeper in: a Major artifact");
  C.addArtifact(r, 'endless_purse'); ok(C.dailyIncome(r).gold === 500, 'Endless Purse: +500 gold a day');
  const w = run0(); w.stats.guardians = [...w.guardians]; w.won = true; w.over = true; w.stats.invasions = [1, 2]; w.invasionsBeaten = 2; w.stats.setsDone = ['warlord'];
  const m2 = C.metaDefault(), E = C.endRun(w, m2, { armyPower: 20000, gold: 12000 });
  ok(m2.unlocks.factions.length === 1 && E.unlocks.length <= 2 && E.score > 0 && m2.glory === E.glory && m2.life.glory === E.glory, `a first run, even won, unlocks little: score ${E.score}, glory ${E.glory}, unlocks [${E.unlocks.map((u) => u.name).join(', ')}]`);
  const store = { m: {}, get(k, d) { return k in this.m ? JSON.parse(this.m[k]) : d; }, set(k, v) { this.m[k] = JSON.stringify(v); } };
  C.metaSave(store, m2); const back = C.metaLoad(store); ok(back.v === 3 && back.life.wins === 1 && back.unlocks.backgrounds.join() === m2.unlocks.backgrounds.join() && Object.keys(store.m)[0] === 'realms.crown.meta', 'meta save (v3) in its own key');
  const ex = run0({ background: 'exile' }); ok(C.equippedIds(ex).length === 1 && C.ARTIFACTS[C.equippedIds(ex)[0]].rarity === 'major', 'Exile starts with a Major artifact');
}

// ---- 11. v2.8 (crown2): the Legendary Hero pool, drawn per run
{
  const G = Object.values(C.GUARDIANS), by = (f) => G.filter(f).length;
  ok(G.length >= 20 && by((g) => g.mythic) >= 3 && new Set(G.map((g) => g.fac)).size === 6, `${G.length} Legendary Heroes, ${by((g) => g.mythic)} mythic, factions ${[...new Set(G.map((g) => g.fac))].join('/')}`);
  ok(G.every((g) => g.rule && g.look && g.units?.length >= 3 && g.units.every((u) => UNITS[u]) && typeof g.mod(0) === 'object'), 'every hero: a rule, a look, a themed army of real units');
  const runs = Array.from({ length: 60 }, (_, i) => C.newRun({ seed: 100 + i }));
  ok(runs.every((r) => new Set(r.guardians).size === r.regions && r.guardians.every((g, i) => !C.GUARDIANS[g].mythic && C.GUARDIANS[g].tier === i + 1)), 'Squire: one hero per region from its tier, no repeats, no mythics');
  const first = new Set(runs.map((r) => r.guardians[0])), lines = new Set(runs.map((r) => r.guardians.join()));
  ok(first.size >= 6 && lines.size >= 40, `runs differ: ${first.size} region-1 heroes, ${lines.size}/60 distinct line-ups`);
  ok(JSON.stringify(C.newRun({ seed: 5 }).guardians) === JSON.stringify(C.newRun({ seed: 5 }).guardians), 'seeded: the same seed draws the same heroes');
  const hi = Array.from({ length: 100 }, (_, i) => C.newRun({ seed: 300 + i, diff: 6 })), myth = hi.filter((r) => C.GUARDIANS[r.guardians[2]].mythic).length;
  ok(myth > 35 && myth < 85 && hi.every((r) => !C.GUARDIANS[r.guardians[0]].mythic && !C.GUARDIANS[r.guardians[1]].mythic), `Prince: a Mythic hero guards the last region in ${myth}/100 runs, never earlier`);
  let bad = 0, worst = 0;
  for (const r of runs.slice(0, 20)) for (let reg = 1; reg <= 3; reg++) { const a = C.guardianArmy(r, reg); worst = Math.max(worst, Math.abs(a.power / a.target - 1)); if (!a.army.length || a.army.some(([u, k]) => !UNITS[u] || !(k > 0))) bad++; }
  ok(!bad && worst < 0.6, `themed armies are valid and on target (worst ±${Math.round(worst * 100)}%)`);
  let crash = 0;
  for (const g of G) try { const r = run0(); fight([['pikeman', 40], ['archer', 15], ['griffin', 6], ['swordsman', 5]], C.guardianArmy({ ...r, guardians: [g.id, g.id, g.id] }, 2).army, C.battleMods(r, { guardian: g.id }), 3); } catch (e) { crash++; console.log('  rule crash', g.id, e.message); }
  ok(!crash, 'every Legendary Hero rule plays out a full battle');
}

// ---- 12. v2.8: the artifact pool and sets
{
  const A = Object.values(C.ARTIFACTS), kinds = new Set(['head', 'neck', 'torso', 'weapon', 'shield', 'feet', 'ring', 'misc']);
  ok(A.length >= 100 && A.every((a) => kinds.has(a.slot) && C.RARITY[a.rarity] && a.text), `${A.length} artifacts, every one with a slot, a rarity and a text`);
  ok(Object.keys(C.SETS).length >= 8 && Object.values(C.SETS).every((S) => S.pieces.every((p) => C.ARTIFACTS[p]?.set === S.id)), `${Object.keys(C.SETS).length} sets, pieces point back at their set`);
  ok(Object.values(C.SETS).every((S) => { const r = run0(); for (const p of S.pieces) if (C.addArtifact(r, p) === 'backpack') return false; return C.activeSets(r).some((x) => x.id === S.id); }), 'every set can be worn whole');
  let crash = 0;
  for (const a of A) try { const r = run0(); C.addArtifact(r, a.id); const B = fight([['pikeman', 30], ['archer', 12], ['griffin', 5]], [['orc', 18], ['wolf', 10], ['skeleton', 12]], C.battleMods(r, { gold: 9000, buildings: 6, fort: true }), 2, hero0(), hero0()); C.afterBattle(r, B, { won: B.over?.winner === 0 }); } catch (e) { crash++; console.log('  artifact crash', a.id, e.message); }
  for (const S of Object.values(C.SETS)) try { const r = run0(); for (const p of S.pieces) C.addArtifact(r, p); fight([['pikeman', 30], ['archer', 12], ['griffin', 5]], [['orc', 18], ['wolf', 10]], C.battleMods(r, { gold: 9000 }), 2, hero0(), hero0()); } catch (e) { crash++; console.log('  set crash', S.id, e.message); }
  ok(!crash, 'every artifact and every set bonus plays out a full battle');
  const r1 = C.rarityFor(1), tot = Object.values(r1).reduce((a, b) => a + b, 0);
  ok((r1.major + r1.relic) / tot < 0.09 && C.rarityFor(3).major > r1.major * 2, `region 1: Major+Relic ${Math.round((r1.major + r1.relic) / tot * 100)}% (region 3: ${Math.round((C.rarityFor(3).major + C.rarityFor(3).relic) / Object.values(C.rarityFor(3)).reduce((a, b) => a + b, 0) * 100)}%)`);
  const r = run0(), meta = C.metaDefault(), boxes = Array.from({ length: 300 }, (_, i) => C.pandoraChoices(r, i, meta, { region: 1 }));
  const artBox = boxes.filter((b) => b.some((c) => c.kind === 'artifact')).length, goldXp = boxes.flat().filter((c) => c.kind === 'gold' || c.kind === 'xp').length / boxes.flat().length;
  ok(artBox < 120 && goldXp > 0.45, `Pandora's Box leans to gold/xp (${Math.round(goldXp * 100)}%), an artifact in ${artBox}/300`);
  ok(C.buyPrice(r, 'judgement') === 6000 && C.buyPrice(r, 'judgement', true) === 9600 && C.sellPrice('judgement') === 3000, 'merchants: Major 6,000, Black Market ×1.6, buy back at half');
  const sp = C.spoilsChoices(r, 1, meta); ok(sp.length === 3 && sp.filter((c) => c.kind === 'artifact').length === 2 && sp[2].kind === 'gold', 'spoils of war: 2 artifacts or the war chest');
  const g = wearing(['coin_ring', 'golden_goose', 'gilded_ledger']); ok(C.dailyIncome(g).gold === 1500 && C.buyPrice(g, 'judgement') === 5100, 'Gilded Trappings: set income +1,000/day, ledger −15%');
}

// ---- 13. v2.8: meta pacing and the v2 migration
{
  const m = C.metaDefault();
  ok(m.unlocks.factions.join() === 'haven' && m.unlocks.backgrounds.join() === 'knight' && m.unlocks.perks.join() === 'quartermaster', 'a fresh meta: Haven, the Knight-Errant, one perk');
  const mm = C.metaDefault(); mm.glory = 1000; ok(!C.buyPerk(mm, 'haggler') && C.buyPerk(mm, 'quartermaster') && C.buyPerk(mm, 'quartermaster') && mm.glory === 1000 - 40 - 80, 'quartermaster: 40 then 80 Glory; haggler stays locked');
  // a big won run on a rich meta still unlocks at most 2
  const rich = C.metaDefault(); rich.life.glory = 5000; rich.life.guardians = 50; rich.life.invasions = 50; rich.life.wins = 5; rich.life.sets = 5; rich.life.maxGold = 60000; rich.life.bestRegion = 3; rich.life.bestGuardians = 3; rich.life.wallsHeld = 2; rich.life.facRuns.necro = 4;
  const w = run0(); w.won = true; w.over = true; w.stats.guardians = [...w.guardians];
  const E = C.endRun(w, rich, { armyPower: 20000, gold: 12000 });
  const l = run0(); l.over = true; const E2 = C.endRun(l, rich, {});
  ok(E.unlocks.length === 2 && E2.unlocks.length === 1, `cap: a win unlocks ${E.unlocks.length} (${E.unlocks.map((u) => u.name).join(', ')}), a loss ${E2.unlocks.length} (${E2.unlocks.map((u) => u.name).join(', ')})`);
  // the v2 migration keeps everything
  const v2 = { v: 2, glory: 35, runs: 2, wins: 1, best: { score: 7000, region: 3 }, unlocks: { factions: ['haven', 'necro', 'sylvan', 'dungeon'], backgrounds: ['knight', 'merchant', 'warlord', 'exile', 'scholar', 'gravecaller', 'siegelord'], diffs: { haven: 2 } }, collection: { artifacts: {}, seen: { clover: 1 }, guardians: { wall: 1, plague: 1, lich_queen: 1 }, units: {} }, trophies: ['first_blood', 'crowned', 'full_set'], perks: { haggler: 1 } };
  const st = { m: { 'realms.crown.meta': JSON.stringify(v2) }, get(k, d) { return k in this.m ? JSON.parse(this.m[k]) : d; }, set(k, v) { this.m[k] = JSON.stringify(v); } };
  const M = C.metaLoad(st);
  ok(M.v === 3 && M.unlocks.factions.length === 4 && M.unlocks.backgrounds.length === 7 && M.unlocks.diffs.haven === 2 && M.perks.haggler === 1 && M.glory === 35, 'v2 meta migrates: every unlock, perk and the Glory kept');
  ok(M.life.glory === 95 && M.life.guardians === 3 && M.life.wins === 1 && M.life.sets === 1 && M.life.wonAt.haven === 1 && C.perkUnlocked(M, 'drillmaster') && !C.perkUnlocked(M, 'tactician'), `v2 meta: lifetime counters rebuilt (Renown ${M.life.glory}), old perks stay on sale, new ones locked`);
  const nx = C.unlockStatus(M); ok(nx.length && nx.every((u) => !(u.kind === 'faction' && M.unlocks.factions.includes(u.id))), `migrated: still locked ${nx.map((u) => u.name).join(', ')}`);
}

console.log(`\n${n - fails}/${n} passed`);
if (fails) process.exit(1);
