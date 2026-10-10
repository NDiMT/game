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
  r.stats.guardians.push('wall'); ok(C.takeKey(r) === 'key' && r.region === 2, 'the key opens region 2');
  r.stats.guardians.push('plague'); C.takeKey(r); r.stats.guardians.push('lich_queen'); ok(C.takeKey(r) === 'crown' && r.won && r.over, 'the last tent holds the Crown: the run is won');
}

// ---- 10. sites with choices, merchants, save/load, meta
{
  const r = run0(), meta = C.metaDefault(), ctx = { known: ['bless'], skills: { leadership: 1 } };
  const pc = C.pandoraChoices(r, 12, meta, ctx); ok(pc.length === 3 && JSON.stringify(pc) === JSON.stringify(C.pandoraChoices(C.runLoad(C.runSave(r)), 12, meta, ctx)), `Pandora's Box: ${pc.map((c) => c.kind + ':' + (c.id || c.n)).join(', ')} (seeded)`);
  ok(C.chestChoices(r, 3, meta).map((c) => c.kind).join() === 'gold,xp,artifact', 'Treasure Chest: gold, experience or an artifact');
  ok(C.witchChoices(r, 5, ctx).length === 3 && C.shrineChoices(r, 5, ctx).every((c) => c.id !== 'bless'), 'Witch Hut 3 skills, Shrine 3 unknown spells');
  const st = C.merchantStock(r, 9, 3, meta), st2 = C.merchantStock(r, 9, 9, meta); ok(st.length === 4 && st.every((x) => x.price > 0) && JSON.stringify(st) !== JSON.stringify(st2), `Artifact Merchant stock rotates weekly (${st.map((x) => x.id + ' ' + x.price).join(', ')})`);
  ok(C.merchantStock(r, 9, 3, meta, true).every((x) => ['major', 'relic'].includes(C.ARTIFACTS[x.id].rarity)), 'Black Market: Major and Relic only');
  const q = C.seerQuest(r, 4, meta); ok(q.need.gold && q.reward && C.ARTIFACTS[q.reward].rarity === 'major', `Seer's Hut: bring ${JSON.stringify(q.need)} for ${q.reward}`);
  C.addArtifact(r, 'endless_purse'); ok(C.dailyIncome(r).gold === 500, 'Endless Purse: +500 gold a day');
  const w = run0(); w.stats.guardians = ['wall', 'plague', 'lich_queen']; w.won = true; w.over = true; w.stats.invasions = [1, 2]; w.invasionsBeaten = 2; w.stats.setsDone = ['warlord'];
  const m2 = C.metaDefault(), E = C.endRun(w, m2, { armyPower: 20000, gold: 12000 });
  ok(m2.unlocks.factions.includes('necro') && m2.unlocks.factions.includes('dungeon') && E.score > 0 && m2.glory === E.glory, `end of run: score ${E.score}, glory ${E.glory}, unlocks ${E.unlocks.map((u) => u.name).join(', ')}`);
  const store = { m: {}, get(k, d) { return k in this.m ? JSON.parse(this.m[k]) : d; }, set(k, v) { this.m[k] = JSON.stringify(v); } };
  C.metaSave(store, m2); ok(C.metaLoad(store).unlocks.factions.includes('necro') && Object.keys(store.m)[0] === 'realms.crown.meta', 'meta save in its own key');
  const ex = run0({ background: 'exile' }); ok(C.equippedIds(ex).length === 1 && C.ARTIFACTS[C.equippedIds(ex)[0]].rarity === 'major', 'Exile starts with a Major artifact');
}

console.log(`\n${n - fails}/${n} passed`);
if (fails) process.exit(1);
