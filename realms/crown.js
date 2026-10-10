// =====================================================================
// ORBIS · Crown Run: the roguelite layer (agent "crown"). Pure data and rules: no DOM, no THREE, so it runs in
// node (dev/crown_test.mjs). Design: dev/CROWN_RUN.md. main.js owns the screens and calls in here for every
// decision: the ante schedule, threat armies, the shop, packs, banner/boss battle modifiers, scoring, meta save.
// =====================================================================
import { UNITS, FACTIONS, UPGRADES, NEUTRALS, SPELLS } from './data.js?v=1.10';
import { armyPower, harm, alive } from './battle.js?v=1.10';

// ---------------------------------------------------------------- balance levers (CROWN_RUN.md §13)
export const TUNE = {
  antes: 8, mvpAntes: 3,
  base: 2000, growth: 2.4, blind: { raid: 1, warlord: 1.5, boss: 2.3 }, stakeStep: 0.08,
  blindDays: { raid: 3, warlord: 5, boss: 7 },
  pay: { raid: 3, warlord: 4, boss: 5 }, unbrokenMax: 3,
  interestPer: 5, interestCap: 5,
  rerollBase: 5, rerollStep: 1,
  price: { common: 4, uncommon: 6, rare: 8, legendary: 12 }, gildedChance: 1 / 15, gildedCost: 3,
  rarityW: { common: 70, uncommon: 25, rare: 5 }, legendaryPack: 0.02,
  voucherCost: 10, scrollCost: 3, upgradeCost: 5, packCost: { war: 4, tome: 3, muster: 4 },
  cardMix: { banner: 70, scroll: 15, upgrade: 15 }, cardSlots: 3, slots: 5,
  musterShare: 0.12, chestSplit: { war: 35, tome: 25, muster: 40 },
  region: { first: 10, band: 8 }, // fallback gates: grid distance from the capital per Ante
};
export const BLINDS = ['raid', 'warlord', 'boss'];
export const BLIND_NAME = { raid: 'Raid', warlord: 'Warlord', boss: 'Crown Boss' };
export const RARITY = { common: { name: 'Common', col: '#b4c2d8' }, uncommon: { name: 'Uncommon', col: '#5bd352' }, rare: { name: 'Rare', col: '#b36bff' }, legendary: { name: 'Legendary', col: '#ffd447' } };
export const META_KEY = 'realms.crown.meta';
export const PLAYER = 0; // the player's side in every battle (main.js always deploys you at the bottom, side 0)

// ---------------------------------------------------------------- seeded randomness
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const rngFor = (run, tag) => mulberry32(hashStr(`${run.seed}|${tag}`));
const pick = (r, arr) => arr[(r() * arr.length) | 0];
const pickW = (r, w) => { const e = Object.entries(w); let k = r() * e.reduce((a, [, x]) => a + x, 0); for (const [id, x] of e) { k -= x; if (k <= 0) return id; } return e[0][0]; };

// ---------------------------------------------------------------- banners
// Each banner: name, icon (icons.js name), rarity, cost, tag ('+', '×', 'rule', 'econ', 'build', 'scale', 'copy'),
// text(g) (g = 1 or 1.5 Gilded), combo, mvp (in the MVP pool), fac (only when that faction is unlocked), and its effect:
//   mod(x) -> battle hook object (see battle.js), x = { g, inst, copy, idx, run, opts, S }
//   run hooks: pay (₵ after a Blind won), cap (interest cap), build (gold discount), after (after a battle)
const add = (v, g) => v * g, mul = (m, g) => 1 + (m - 1) * g, pct = (v) => `${Math.round(v * 100)}%`, fx = (m) => `×${+m.toFixed(2)}`;
const mine = (s, S) => s && s.side === S;
const foe = (s, S) => s && s.side !== S;
const firstSlot = (B, S) => Math.min(...B.stacks.filter((s) => s.side === S).map((s) => s.slot));
export const BANNERS = {
  // damage and armies
  war_drum: { name: 'War Drum', icon: 'attack', rarity: 'common', cost: 4, tag: '+', mvp: true, text: (g) => `+${add(1, g)} damage per creature on your melee strikes.`, combo: 'Big tier-1 stacks. Place it left of × banners.',
    mod: ({ g, S }) => ({ onDamage(c) { if (mine(c.a, S) && c.melee) c.dmg += add(1, g) * c.a.count; } }) },
  pike_wall: { name: 'Pike Wall', icon: 'defense', rarity: 'common', cost: 4, tag: 'rule', mvp: true, text: (g) => `Your tier 1–2 stacks +${Math.round(add(4, g))} Defence.`, combo: 'Pikemen tank. Haven Oath.',
    mod: ({ g, S }) => ({ stats(u, i) { if (i.side === S && u.tier <= 2) u.def += Math.round(add(4, g)); } }) },
  vanguard: { name: 'Vanguard', icon: 'army', rarity: 'common', cost: 5, tag: '×', mvp: true, text: (g) => `The stack in your first army slot deals ${fx(mul(1.5, g))} damage.`, combo: 'Army order: put your best stack first.',
    mod: ({ g, S }) => ({ onDamage(c, B) { if (mine(c.a, S) && c.a.slot === firstSlot(B, S)) c.dmg *= mul(1.5, g); } }) },
  executioner: { name: "Executioner's Flag", icon: 'axe', rarity: 'rare', cost: 8, tag: '×', mvp: true, text: (g) => `${fx(mul(2, g))} damage against stacks below half their starting size.`, combo: 'Finish what your archers softened.',
    mod: ({ g, S }) => ({ onDamage(c) { if (c.side === S && foe(c.d, S) && c.d.count < c.d.start / 2) c.dmg *= mul(2, g); } }) },
  last_stand: { name: 'Last Stand', icon: 'hp', rarity: 'uncommon', cost: 6, tag: '×', text: (g) => `While you have one stack left, it deals ${fx(mul(3, g))} damage.`, combo: 'Comeback. Shield Bearer.',
    mod: ({ g, S }) => ({ onDamage(c, B) { if (mine(c.a, S) && alive(B, S).length === 1) c.dmg *= mul(3, g); } }) },
  bloodlust: { name: 'Bloodlust', icon: 'damage', rarity: 'uncommon', cost: 6, tag: 'scale', text: (g) => `Each enemy stack destroyed gives your stacks +${add(2, g)} Attack for the battle.`, combo: 'Snowball with Executioner.',
    mod: ({ g, S }) => ({ onStackDeath(s, k, B) { if (s.side !== S) for (const m of alive(B, S)) m.u.att += add(2, g); } }) },
  iron_oath: { name: 'Iron Oath', icon: 'armorer', rarity: 'uncommon', cost: 6, tag: 'rule', text: () => 'Your stacks retaliate twice per round.', combo: 'Pike Wall, Riposte Pennant.',
    mod: ({ S }) => ({ stats(u, i) { if (i.side === S) u.twoRetal = true; } }) },
  shield_bearer: { name: 'Shield Bearer', icon: 'defense', rarity: 'common', cost: 4, tag: '×', text: (g) => `Your first-slot stack takes −${pct(add(0.35, g) > 0.6 ? 0.6 : add(0.35, g))} damage.`, combo: 'Order: tank first.',
    mod: ({ g, S }) => ({ onDamage(c, B) { if (mine(c.d, S) && c.d.slot === firstSlot(B, S)) c.dmg *= 1 - Math.min(0.6, add(0.35, g)); } }) },
  berserk: { name: 'Berserker Standard', icon: 'offense', rarity: 'rare', cost: 9, tag: '×', text: (g) => `Your stacks deal ${fx(mul(1.6, g))} damage but take ×1.3.`, combo: 'Glass cannon.',
    mod: ({ g, S }) => ({ onDamage(c) { if (c.side === S && c.a) c.dmg *= mul(1.6, g); if (mine(c.d, S)) c.dmg *= 1.3; } }) },
  riposte: { name: 'Riposte Pennant', icon: 'attack', rarity: 'common', cost: 5, tag: '×', text: (g) => `Your retaliation strikes deal ${fx(mul(1.5, g))}.`, combo: 'Iron Oath.',
    mod: ({ g, S }) => ({ onDamage(c) { if (mine(c.a, S) && c.retal) c.dmg *= mul(1.5, g); } }) },
  // ranged
  fletcher: { name: "Fletcher's Banner", icon: 'shots', rarity: 'common', cost: 5, tag: '+', mvp: true, text: (g) => `Your ranged stacks +${Math.round(add(4, g))} shots and +${add(2, g)} damage per creature on shots.`, combo: 'Archers. Put Heavy Volley to its right.',
    mod: ({ g, S }) => ({ stats(u, i) { if (i.side === S && u.ranged) u.ranged += Math.round(add(4, g)); }, onDamage(c) { if (mine(c.a, S) && c.ranged) c.dmg += add(2, g) * c.a.count; } }) },
  heavy_volley: { name: 'Heavy Volley', icon: 'archery', rarity: 'uncommon', cost: 7, tag: '×', mvp: true, text: (g) => `Your shots deal ${fx(mul(1.5, g))} damage.`, combo: "Right of Fletcher's Banner. Mirror it.",
    mod: ({ g, S }) => ({ onDamage(c) { if (mine(c.a, S) && c.ranged) c.dmg *= mul(1.5, g); } }) },
  sky_lances: { name: 'Sky Lances', icon: 'arrow', rarity: 'rare', cost: 8, tag: 'rule', mvp: true, text: () => 'Your ranged stacks may shoot even with an enemy next to them.', combo: 'Shrugs off melee rushes.',
    mod: ({ S }) => ({ canShoot(B, s, ok) { return ok || (s.side === S && s.shots > 0 && alive(B, 1 - S).length > 0); } }) },
  echo_volley: { name: 'Echoing Volley', icon: 'shots', rarity: 'rare', cost: 9, tag: 'rule', text: (g) => `Every shot also hits a second enemy stack for ${pct(add(0.5, g))}.`, combo: 'Heavy Volley counts twice.',
    mod: ({ g, S }) => ({ onShoot(B, a, d) {
      if (!mine(a, S)) return;
      const o = alive(B, 1 - S).filter((x) => x !== d); if (!o.length) return;
      const t = o[(B.rand() * o.length) | 0], dmg = Math.round(a.count * (a.u.dmg[0] + a.u.dmg[1]) / 2 * add(0.5, g));
      const killed = harm(B, t, dmg, a); B.events.push({ t: 'mod', icon: 'shots', text: 'Echo', side: S, hits: [{ s: t.uid, dmg, killed, left: t.count }] });
    } }) },
  falconer: { name: 'Falconer', icon: 'fly', rarity: 'uncommon', cost: 6, tag: '×', text: (g) => `Your shots deal ${fx(mul(2, g))} to fliers.`, combo: 'Anti-dragon.',
    mod: ({ g, S }) => ({ onDamage(c) { if (mine(c.a, S) && c.ranged && c.d?.u.fly) c.dmg *= mul(2, g); } }) },
  // fliers
  gryphon: { name: 'Gryphon Standard', icon: 'fly', rarity: 'uncommon', cost: 6, tag: 'rule', mvp: true, text: () => 'Your fliers attack without retaliation.', combo: 'Griffins, angels. Updraft.',
    mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.fly) u.noRetal = true; } }) },
  sky_lord: { name: 'Sky Lord', icon: 'fly', rarity: 'rare', cost: 8, tag: '×', text: (g) => `Your fliers +3 speed and ${fx(mul(1.4, g))} damage in round 1.`, combo: 'Alpha strike.',
    mod: ({ g, S }) => ({ stats(u, i) { if (i.side === S && u.fly) u.spd += 3; }, onDamage(c, B) { if (mine(c.a, S) && c.a.u.fly && B.round === 1) c.dmg *= mul(1.4, g); } }) },
  updraft: { name: 'Updraft', icon: 'movement', rarity: 'common', cost: 4, tag: 'rule', text: () => 'Your tier 1–3 walkers can fly.', combo: 'Gryphon Standard on pikemen.',
    mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier <= 3 && !u.ranged) u.fly = true; } }) },
  // necromancy
  bone_tally: { name: 'Bone Tally', icon: 'necromancy', rarity: 'rare', cost: 8, tag: 'scale', mvp: true, text: (g) => `After each battle won, raise skeletons: ${pct(add(0.1, g))} of slain living foes, +5% per Blind won (max 40%).`, combo: 'Any faction. War Drum on the skeleton horde.',
    after: ({ g, run }, res) => { if (res.won) res.raise += Math.floor(res.slainLiving * Math.min(0.4, add(0.1, g) + 0.05 * run.stats.blindsWon)); } },
  lich_lantern: { name: 'Lich Lantern', icon: 'mana', rarity: 'rare', cost: 9, tag: 'rule', text: () => 'Raised skeletons come as Skeleton Warriors; your undead heal their top creature every round.', combo: 'Bone Tally.',
    mod: ({ S }) => ({ onRoundStart(B) { for (const s of alive(B, S)) if (s.u.undead) s.hp = s.u.hp; } }), after: (x, res) => { res.raiseAs = 'skelwarrior'; } },
  grave_robber: { name: 'Grave Robber', icon: 'defeat', rarity: 'uncommon', cost: 6, tag: '×', text: (g) => `Your undead deal ×(1 + ${add(0.25, g)} per enemy stack destroyed this battle).`, combo: 'Necro snowball.',
    mod: ({ g, S }) => { let k = 0; return { onBattleStart() { k = 0; }, onStackDeath(s) { if (s.side !== S) k++; }, onDamage(c) { if (mine(c.a, S) && c.a.u.undead) c.dmg *= 1 + add(0.25, g) * k; } }; } },
  phylactery: { name: 'Phylactery', icon: 'artifact', rarity: 'legendary', cost: 12, tag: 'rule', text: () => 'Your stacks cannot drop below 1 creature before round 3.', combo: 'Last Stand insurance.',
    mod: ({ S }) => ({ onDamage(c, B) { if (mine(c.d, S) && B.round < 3 && !c.preview) c.dmg = Math.min(c.dmg, Math.max(0, (c.d.count - 1) * c.d.u.hp + c.d.hp - 1)); } }) },
  // economy
  golden_purse: { name: 'Golden Purse', icon: 'gold', rarity: 'common', cost: 4, tag: 'econ', mvp: true, text: (g) => `+${Math.round(add(2, g))}₵ after each Blind won.`, combo: 'Feeds interest.',
    pay: ({ g }) => Math.round(add(2, g)) },
  treasury: { name: 'Royal Treasury', icon: 'estates', rarity: 'uncommon', cost: 6, tag: 'econ', mvp: true, text: (g) => `Interest cap +${Math.round(add(5, g))}₵.`, combo: 'Golden Purse, Merchant.',
    cap: ({ g }) => Math.round(add(5, g)) },
  miser: { name: "Miser's Banner", icon: 'gold', rarity: 'uncommon', cost: 6, tag: '×', text: (g) => `Your stacks deal ×(1 + ${add(0.03, g).toFixed(3)} per ₵ held), max ×1.6.`, combo: 'Hoard instead of rerolling.',
    mod: ({ g, S, run }) => ({ onDamage(c) { if (c.side === S && c.a) c.dmg *= Math.min(1.6, 1 + add(0.03, g) * run.crowns); } }) },
  mine_charter: { name: 'Mine Charter', icon: 'goldmine', rarity: 'common', cost: 4, tag: 'econ', text: (g) => `Your mines produce +${pct(add(0.5, g))}.`, combo: 'Exploration → gold → army.', mine: ({ g }) => add(0.5, g) },
  bounty: { name: 'Bounty Board', icon: 'chest', rarity: 'common', cost: 5, tag: 'econ', text: () => 'Each map monster beaten pays 1₵ (max 3 a day).', combo: 'Clear the region.', bounty: () => 1 },
  // building
  mason: { name: "Mason's Mark", icon: 'build', rarity: 'uncommon', cost: 6, tag: 'build', mvp: true, text: (g) => `Buildings cost −${pct(Math.min(0.5, add(0.25, g)))} gold.`, combo: 'Masonry Guild voucher.',
    build: ({ g }) => Math.min(0.5, add(0.25, g)) },
  foundry: { name: 'Foundry', icon: 'fort', rarity: 'uncommon', cost: 6, tag: '×', text: (g) => `Your stacks deal +${pct(add(0.02, g))} per building in your capital.`, combo: 'Town building → battle.',
    mod: ({ g, S, opts }) => ({ onDamage(c) { if (c.side === S && c.a) c.dmg *= 1 + add(0.02, g) * (opts.buildings || 0); } }) },
  garrison_flag: { name: 'Garrison Flag', icon: 'recruit', rarity: 'common', cost: 4, tag: 'build', text: (g) => `Recruiting costs −${pct(add(0.15, g))}.`, combo: 'Overflowing Pens.', recruit: ({ g }) => add(0.15, g) },
  fortress: { name: 'Fortress Banner', icon: 'fort', rarity: 'rare', cost: 8, tag: 'build', text: (g) => `If your capital has a Fort, your stacks +${Math.round(add(3, g))} Defence.`, combo: 'Pike Wall.',
    mod: ({ g, S, opts }) => ({ stats(u, i) { if (i.side === S && opts.fort) u.def += Math.round(add(3, g)); } }) },
  // scaling
  trophy_pike: { name: 'Trophy Pike', icon: 'victory', rarity: 'uncommon', cost: 6, tag: 'scale', mvp: true, text: (g, inst) => `Your stacks deal +${pct(add(0.03, g))} per enemy stack destroyed since you raised it${inst ? ` (now +${pct(add(0.03, g) * (inst.n || 0))})` : ''}.`, combo: 'Buy early and keep it.',
    mod: ({ g, S, inst, copy }) => ({ onDamage(c) { if (c.side === S && c.a) c.dmg *= 1 + add(0.03, g) * (inst.n || 0); }, onStackDeath(s) { if (s.side !== S && !copy) inst.n = (inst.n || 0) + 1; } }) },
  veteran: { name: "Veteran's Colours", icon: 'experience', rarity: 'rare', cost: 8, tag: 'scale', text: (g, inst) => `Your stacks +${add(1, g)} Attack and Defence per Boss beaten while held${inst ? ` (now +${add(1, g) * (inst.n || 0)})` : ''}.`, combo: 'Long runs.',
    mod: ({ g, S, inst }) => ({ stats(u, i) { if (i.side === S) { const k = Math.round(add(1, g) * (inst.n || 0)); u.att += k; u.def += k; } } }), after: ({ inst, copy }, res) => { if (res.won && res.kind === 'boss' && !copy) inst.n = (inst.n || 0) + 1; } },
  rising_tide: { name: 'Rising Tide', icon: 'day', rarity: 'uncommon', cost: 6, tag: '×', text: (g) => `Your stacks deal ×(1 + ${add(0.1, g)} × round).`, combo: 'Defensive armies.',
    mod: ({ g, S }) => ({ onDamage(c, B) { if (c.side === S && c.a) c.dmg *= 1 + add(0.1, g) * B.round; } }) },
  // copy and order
  mirror: { name: 'Mirror Banner', icon: 'more', rarity: 'rare', cost: 9, tag: 'copy', mvp: true, text: () => 'Copies the banner to its right.', combo: 'Mirror + Heavy Volley = ×2.25.' },
  echo: { name: 'Echo Standard', icon: 'more', rarity: 'rare', cost: 9, tag: 'copy', text: () => 'Copies your leftmost banner.', combo: 'Chains with Mirror.' },
  herald: { name: 'Crown Herald', icon: 'leadership', rarity: 'rare', cost: 8, tag: '×', mvp: true, text: (g) => `${fx(mul(1.2, g))} damage for each banner to its left.`, combo: 'Put it last.',
    mod: ({ g, S, idx }) => ({ onDamage(c) { if (c.side === S && c.a) c.dmg *= Math.pow(mul(1.2, g), idx); } }) },
  // faction synergy
  haven_oath: { name: 'Haven Oath', icon: 'bless', rarity: 'uncommon', cost: 6, tag: '×', mvp: true, fac: 'haven', text: (g) => `Haven stacks +${Math.round(add(2, g))} Attack and Defence; ${fx(mul(1.25, g))} damage if every stack is Haven.`, combo: 'Pure Haven armies.',
    mod: ({ g, S }) => { let pure = false; return { stats(u, i) { if (i.side === S && u.fac === 'haven') { u.att += Math.round(add(2, g)); u.def += Math.round(add(2, g)); } }, onBattleStart(B) { pure = B.stacks.filter((s) => s.side === S).every((s) => s.u.fac === 'haven'); }, onDamage(c) { if (pure && mine(c.a, S)) c.dmg *= mul(1.25, g); } }; } },
  necro_oath: { name: 'Oath of Dust', icon: 'necromancy', rarity: 'uncommon', cost: 6, tag: '×', fac: 'necro', text: (g) => `Undead stacks +${Math.round(add(2, g))} Attack and Defence; ${fx(mul(1.25, g))} damage if every stack is undead.`, combo: 'Necro.',
    mod: ({ g, S }) => { let pure = false; return { stats(u, i) { if (i.side === S && u.undead) { u.att += Math.round(add(2, g)); u.def += Math.round(add(2, g)); } }, onBattleStart(B) { pure = B.stacks.filter((s) => s.side === S).every((s) => s.u.undead); }, onDamage(c) { if (pure && mine(c.a, S)) c.dmg *= mul(1.25, g); } }; } },
  sylvan_oath: { name: 'Oath of Leaves', icon: 'luck', rarity: 'uncommon', cost: 6, tag: 'rule', fac: 'sylvan', text: (g) => `Sylvan stacks +${Math.round(add(2, g))} Attack; Sylvan shooters +2 shots.`, combo: 'Elves.',
    mod: ({ g, S }) => ({ stats(u, i) { if (i.side === S && u.fac === 'sylvan') { u.att += Math.round(add(2, g)); if (u.ranged) u.ranged += 2; } } }) },
  inferno_oath: { name: 'Oath of Embers', icon: 'fireball', rarity: 'uncommon', cost: 6, tag: 'rule', fac: 'inferno', text: (g) => `Inferno stacks +2 speed and +${Math.round(add(2, g))} Attack.`, combo: 'Inferno rush.',
    mod: ({ g, S }) => ({ stats(u, i) { if (i.side === S && u.fac === 'inferno') { u.spd += 2; u.att += Math.round(add(2, g)); } } }) },
  dungeon_oath: { name: 'Oath of the Deep', icon: 'sorcery', rarity: 'uncommon', cost: 6, tag: '×', fac: 'dungeon', text: (g) => `Dungeon stacks +2 Defence; their first strike each round deals ${fx(mul(1.25, g))}.`, combo: 'Dungeon.',
    mod: ({ g, S }) => { const hit = new Map(); return { stats(u, i) { if (i.side === S && u.fac === 'dungeon') u.def += 2; }, onDamage(c, B) { if (mine(c.a, S) && c.a.u.fac === 'dungeon' && hit.get(c.a.uid) !== B.round) { c.dmg *= mul(1.25, g); if (!c.preview) hit.set(c.a.uid, B.round); } } }; } },
  // legendary
  usurper: { name: "Usurper's Crown", icon: 'victory', rarity: 'legendary', cost: 12, tag: 'rule', text: () => 'The boss rule also applies to the enemy.', combo: 'The Wall against The Wall.' },
};
for (const [id, b] of Object.entries(BANNERS)) b.id = id;
export const MVP_BANNERS = Object.keys(BANNERS).filter((k) => BANNERS[k].mvp);

// ---------------------------------------------------------------- bosses: rule(T) builds the hook for victim side T
const ward = (s) => s.u.seal === 'ward';
export const BOSSES = {
  wall: { name: 'The Wall', icon: 'fort', fac: 'neutral', mvp: true, text: 'Your ranged stacks cannot shoot.', rule: (T) => ({ canShoot(B, s, ok) { return s.side === T && !ward(s) ? false : ok; } }) },
  plague: { name: 'The Plague', icon: 'defeat', fac: 'inferno', mvp: true, text: 'Your first stack starts with 30% fewer creatures.', rule: (T) => ({ onBattleStart(B) {
    const s = B.stacks.filter((x) => x.side === T && !ward(x)).sort((a, b) => a.slot - b.slot)[0]; if (!s) return;
    const n = Math.max(1, Math.ceil(s.count * 0.7)), lost = s.count - n; s.count = n;
    if (lost) B.events.push({ t: 'mod', icon: 'defeat', text: `Plague −${lost}`, side: 1 - T, s: s.uid, hits: [{ s: s.uid, dmg: lost * s.u.hp, killed: lost, left: n }] });
  } }) },
  lich_queen: { name: 'The Lich Queen', icon: 'necromancy', fac: 'necro', mvp: true, unlocks: 'necro', text: 'Enemy stacks drain life: they heal half the damage they deal and raise their dead.', rule: (T) => ({ stats(u, i) { if (i.side !== T) u.drain = true; } }) },
  silence: { name: 'The Silence', icon: 'spellbook', fac: 'dungeon', text: 'Your hero cannot cast spells.', rule: (T) => ({ onRoundStart(B) { B.cast[T] = true; } }) },
  chain: { name: 'The Chain', icon: 'lock', fac: 'haven', text: 'Your leftmost banner is disabled.', chain: true, rule: () => ({}) },
  hunger: { name: 'The Hunger', icon: 'hp', fac: 'neutral', text: 'Enemy stacks regenerate fully every round.', rule: (T) => ({ stats(u, i) { if (i.side !== T) u.regen = true; } }) },
  gale: { name: 'The Gale', icon: 'fly', fac: 'sylvan', text: 'Your fliers are grounded.', rule: (T) => ({ stats(u, i) { if (i.side === T && u.seal !== 'ward') u.fly = false; } }) },
  eclipse: { name: 'The Eclipse', icon: 'night', fac: 'dungeon', text: "Your hero's Attack and Defence count as 0.", rule: (T) => ({ onBattleStart(B) { const h = B.heroes[T]; if (h) { h.att = 0; h.def = 0; } } }) },
  stampede: { name: 'The Stampede', icon: 'movement', fac: 'inferno', text: 'Enemy stacks +3 speed.', rule: (T) => ({ stats(u, i) { if (i.side !== T) u.spd += 3; } }) },
  iron_hide: { name: 'The Iron Hide', icon: 'armorer', fac: 'haven', text: 'Enemy stacks take −50% damage from your shots.', rule: (T) => ({ onDamage(c) { if (c.ranged && c.a?.side === T && c.d?.side !== T && !ward(c.a)) c.dmg *= 0.5; } }) },
  duel: { name: 'The Duel', icon: 'attack', fac: 'neutral', impl: false, text: 'Only your 3 largest stacks may fight.', rule: () => ({}) },
  usurper: { name: 'The Usurper', icon: 'victory', fac: 'any', final: true, text: 'Two rules at once.', rule: () => ({}) },
};
for (const [id, b] of Object.entries(BOSSES)) b.id = id;
export const MVP_BOSSES = ['wall', 'plague', 'lich_queen'];
const icn = { night: 'end' }; // icon aliases for names icons.js lacks
for (const b of Object.values(BOSSES)) b.icon = icn[b.icon] || b.icon;

// ---------------------------------------------------------------- vouchers, packs, seals, origins, stakes
export const VOUCHERS = {
  masonry: { name: 'Masonry Guild', icon: 'build', mvp: true, text: 'Your towns may build twice per day.' },
  standard: { name: 'Standard Bearer', icon: 'banner', mvp: true, text: '+1 banner slot.' },
  pens: { name: 'Overflowing Pens', icon: 'dwelling', mvp: true, text: 'Weekly dwelling growth +50%.' },
  clearance: { name: 'Clearance', icon: 'market', mvp: true, text: 'Shop prices −25%.' },
  surplus: { name: 'Surplus', icon: 'auto', mvp: true, text: 'Rerolls cost 2₵ less.' },
  seed_money: { name: 'Seed Money', icon: 'estates', mvp: true, text: 'Interest cap +5₵.' },
  war_college: { name: 'War College', icon: 'wisdom', text: 'Level-ups offer 4 skills.' },
  cartographer: { name: 'Cartographer', icon: 'scouting', text: '+2 vision.' },
  blacksmith: { name: 'Blacksmith', icon: 'upgrade', text: 'Unit upgrades in the shop −50%.' },
  tithe: { name: 'Tithe', icon: 'town', text: '+1₵ per town you own at each payout.' },
  crystal: { name: 'Crystal Ball', icon: 'sorcery', text: 'Packs offer 4 choices.' },
  recruiter: { name: 'Recruiter', icon: 'recruit', text: 'Map dwellings restock +50%.' },
};
for (const [id, v] of Object.entries(VOUCHERS)) v.id = id;
export const PACKS = {
  war: { name: 'War Chest', icon: 'chest', text: 'Pick 1 of 3 banners.', col: '#ffd447' },
  tome: { name: 'Tome', icon: 'spellbook', text: 'Pick 1 of 3 spells to learn for good.', col: '#8fd8ff' },
  muster: { name: 'Muster', icon: 'recruit', text: 'Pick 1 of 3 creature stacks.', col: '#ff8a6a' },
};
export const SEALS = {
  gold: { name: 'Gold Seal', icon: 'gold', text: '+1₵ when this stack destroys an enemy stack in a Blind.' },
  iron: { name: 'Iron Seal', icon: 'armorer', text: 'This stack takes −20% damage.' },
  swift: { name: 'Swift Seal', icon: 'haste', text: '+2 speed.' },
  red: { name: 'Red Seal', icon: 'attack', text: 'This stack retaliates twice.' },
  ward: { name: 'Ward Seal', icon: 'bless', text: 'Boss rules ignore this stack.' },
};
export const ORIGINS = {
  banneret: { name: 'Banneret', icon: 'banner', text: 'The standard run. No changes.', start: true },
  merchant: { name: 'Merchant', icon: 'gold', text: 'Start with 8₵. Interest cap +5₵.', start: true, crowns: 8, cap: 5 },
  warband: { name: 'Warband', icon: 'army', text: 'Starting army ×1.5, but only 4 banner slots.', start: true, armyMul: 1.5, slots: -1 },
  pauper: { name: 'Pauper', icon: 'defeat', text: 'Start with nothing and half the resources, but 6 banner slots.', start: true, resMul: 0.5, slots: 1 },
  scholar: { name: 'Scholar', icon: 'wisdom', text: 'Mage Guild I built, +2 spells, Wisdom I; army ×0.8.', armyMul: 0.8, unlock: 'Win a run.' },
  gravecaller: { name: 'Gravecaller', icon: 'necromancy', text: 'Necropolis only. Starts with Bone Tally.', fac: 'necro', banner: 'bone_tally', unlock: 'Unlock Necropolis.' },
  siegelord: { name: 'Siegelord', icon: 'fort', text: 'Capital starts with a Fort. The first Raid is weaker.', fort: true, unlock: 'Beat The Wall.' },
};
for (const [id, o] of Object.entries(ORIGINS)) o.id = id;
export const STAKES = [null,
  { name: 'White', col: '#f4f4f4', text: 'The base game.' },
  { name: 'Red', col: '#f0453a', text: 'Raids pay no base Crowns.' },
  { name: 'Green', col: '#5bd352', text: 'Threats grow ×1.1 faster per Ante.' },
  { name: 'Black', col: '#3a3a44', text: '30% of shop banners are Tattered (cannot be sold).' },
  { name: 'Blue', col: '#4aa8ff', text: 'The Crown Boss comes at the end of day 6.' },
  { name: 'Purple', col: '#b36bff', text: 'Shop prices +1₵.' },
  { name: 'Orange', col: '#ffa52e', text: 'Interest cap −2₵.' },
  { name: 'Gold', col: '#ffd447', text: 'Bosses have two rules.' },
];
export const FAC_UNLOCK = {
  haven: { text: 'Available from the start.' },
  necro: { text: 'Beat The Lich Queen.' },
  sylvan: { text: 'Win a Crown Run.' },
  inferno: { text: 'Beat a Crown Boss in 3 rounds or fewer.' },
  dungeon: { text: 'Hold 5 banners at once.' },
};
export const TROPHIES = {
  first_blood: { name: 'First Blood', icon: 'attack', text: 'Win a Blind.' },
  crowned: { name: 'Crowned', icon: 'victory', text: 'Win a Crown Run.' },
  hoarder: { name: 'Hoarder', icon: 'gold', text: 'Hold 25₵.' },
  full_banner: { name: 'Full Banner', icon: 'banner', text: 'Hold 5 banners at once.' },
  bone_lord: { name: 'Bone Lord', icon: 'necromancy', text: 'Raise 100 skeletons in one run.' },
  untouchable: { name: 'Untouchable', icon: 'defense', text: 'Win a Blind with no losses.' },
  big_hit: { name: 'Big Hit', icon: 'damage', text: 'Deal 1000+ damage in one strike.' },
  collector: { name: 'Collector', icon: 'chest', text: 'Discover 30 entries.' },
};
export const PERKS = {
  quartermaster: { name: 'Quartermaster', icon: 'gold', text: '+2₵ at run start.', cost: 30, max: 2 },
  drillmaster: { name: 'Drillmaster', icon: 'army', text: 'Starting army +10%.', cost: 40, max: 2 },
  haggler: { name: 'Haggler', icon: 'market', text: 'The first reroll of each shop is free.', cost: 60, max: 1 },
  scout: { name: 'Scout', icon: 'scouting', text: '+1 hero vision.', cost: 25, max: 1 },
};

// ---------------------------------------------------------------- meta save (its own store key)
export function metaDefault() {
  return { v: 1, glory: 0, runs: 0, wins: 0, best: { score: 0, ante: 0 }, unlocks: { factions: ['haven'], origins: Object.keys(ORIGINS).filter((k) => ORIGINS[k].start), stakes: { haven: 1 } },
    collection: { banners: {}, seen: {}, bosses: {}, units: {} }, trophies: [], perks: {} };
}
export function metaLoad(store) {
  const d = metaDefault(), m = store?.get ? store.get(META_KEY, null) : null;
  if (!m || m.v !== 1) return d;
  return { ...d, ...m, best: { ...d.best, ...m.best }, unlocks: { ...d.unlocks, ...m.unlocks }, collection: { ...d.collection, ...m.collection }, perks: { ...m.perks } };
}
export function metaSave(store, meta) { store?.set?.(META_KEY, meta); }
// the Collection: anything shown in a shop or pack, or fought, is discovered
export function discover(meta, kind, id) { if (!meta || !id) return false; const c = meta.collection[kind === 'banner' ? 'seen' : kind === 'boss' ? 'bosses' : 'units']; if (c[id]) return false; c[id] = 1; return true; }
export function discoveredCount(meta) { const c = meta.collection; return Object.keys(c.seen).length + Object.keys(c.bosses).length + Object.keys(c.units).length; }
export function buyPerk(meta, id) {
  const P = PERKS[id], lv = meta.perks[id] || 0;
  if (!P || lv >= P.max || meta.glory < P.cost) return false;
  meta.glory -= P.cost; meta.perks[id] = lv + 1; return true;
}

// ---------------------------------------------------------------- the run
export function newRun({ seed = 1, origin = 'banneret', stake = 1, fac = 'haven', antes = TUNE.mvpAntes, meta = null } = {}) {
  const O = ORIGINS[origin] || ORIGINS.banneret, perks = meta?.perks || {};
  const run = {
    v: 1, seed, origin: O.id, stake, fac: O.fac || fac, antes, ante: 1, blind: 0, crowns: (O.crowns || 0) + 2 * (perks.quartermaster || 0),
    slots: TUNE.slots + (O.slots || 0), banners: [], vouchers: [], bosses: [], voucherOffer: [], shop: null,
    stats: { blindsWon: 0, bossesBeaten: [], stacksKilled: 0, bestHit: 0, raised: 0, rerolls: 0, maxBanners: 0, fastBoss: false, untouched: 0, blindLog: [] },
    over: false, won: false, perks: { ...perks },
    originFx: { armyMul: (O.armyMul || 1) * (1 + 0.1 * (perks.drillmaster || 0)), resMul: O.resMul ?? 1, fort: !!O.fort, vision: perks.scout || 0, zeroCrowns: origin === 'pauper' },
  };
  if (origin === 'pauper') run.crowns = 0;
  // bosses: the MVP plays a fixed line-up (The Lich Queen last, so beating the run's final boss unlocks Necropolis);
  // the full game rolls them from the pool and ends with The Usurper
  const r = rngFor(run, 'bosses');
  if (antes <= MVP_BOSSES.length) run.bosses = MVP_BOSSES.slice(0, antes);
  else {
    const pool = Object.keys(BOSSES).filter((k) => BOSSES[k].impl !== false && !BOSSES[k].final);
    const bag = pool.filter((k) => k !== 'lich_queen').sort(() => r() - 0.5);
    for (let a = 1; a <= antes; a++) run.bosses.push(a === antes ? 'usurper' : a === 3 ? 'lich_queen' : bag.pop() || 'wall');
    run.usurperRules = pool.filter((k) => !BOSSES[k].chain).sort(() => r() - 0.5).slice(0, 2);
  }
  rollVoucher(run);
  if (O.banner) run.banners.push({ id: O.banner, gilded: false, n: 0 });
  return run;
}
export const runSave = (run) => JSON.parse(JSON.stringify(run));
export function runLoad(o) { if (!o || o.v !== 1 || !Array.isArray(o.banners)) return null; return o; }
const has = (run, v) => run.vouchers.includes(v);
export const slotCount = (run) => run.slots + (has(run, 'standard') ? 1 : 0);
function rollVoucher(run) {
  const r = rngFor(run, `voucher:${run.ante}`), pool = Object.keys(VOUCHERS).filter((k) => VOUCHERS[k].mvp && !run.vouchers.includes(k));
  run.voucherOffer = pool.length ? pick(r, pool) : null;
}

// ---- the schedule: three Blinds per Ante (week), each at the end of its day
export function blindDay(run, kind) { return kind === 'boss' && run.stake >= 5 ? 6 : TUNE.blindDays[kind]; }
export function nextBlind(run) {
  if (run.over) return null;
  const kind = BLINDS[run.blind];
  return { ante: run.ante, kind, day: (run.ante - 1) * 7 + blindDay(run, kind), boss: kind === 'boss' ? run.bosses[run.ante - 1] : null };
}
// called when the player ends a day: the Blind fought at this dusk, if any
export function blindDue(run, day) { const n = nextBlind(run); return n && day >= n.day ? n : null; }
export function daysLeft(run, day) { const n = nextBlind(run); return n ? n.day - day : 0; }
// the region gate: cells of region > ante cannot be entered (regionOf from the flat map, else distance bands)
export function regionByDistance(d) { return d < TUNE.region.first ? 1 : 1 + Math.ceil((d - TUNE.region.first + 1) / TUNE.region.band); }
export const regionOpen = (run, region) => region <= run.ante;

// ---- threat armies
export function threatPower(ante, kind, stake = 1) {
  return TUNE.base * Math.pow(TUNE.growth, ante - 1) * TUNE.blind[kind] * (1 + TUNE.stakeStep * (stake - 1)) * (stake >= 3 ? Math.pow(1.1, ante - 1) : 1);
}
const unitPow = (id) => armyPower([[id, 1]]);
export function threatFaction(run, ante, kind) {
  const b = BOSSES[run.bosses[ante - 1]];
  if (kind === 'raid') return ante === 1 ? 'neutral' : b?.fac === 'neutral' || b?.fac === 'any' ? 'neutral' : b.fac;
  return b && b.fac !== 'any' ? b.fac : 'neutral';
}
export function threatArmy(run, ante = run.ante, kind = BLINDS[run.blind]) {
  const r = rngFor(run, `threat:${ante}:${kind}`), fac = threatFaction(run, ante, kind);
  const boss = kind === 'boss' ? run.bosses[ante - 1] : null;
  let P = threatPower(ante, kind, run.stake);
  if (run.origin === 'siegelord' && ante === 1 && kind === 'raid') P *= 0.8;
  const hero = kind === 'raid' ? null : { att: ante + (boss ? 1 : 0), def: ante + (boss ? 1 : 0), pow: ante + (boss ? 1 : 0), know: 2 + ante, mana: 10 + 5 * ante, skills: {}, spells: boss ? (ante >= 3 ? ['arrow', 'bolt'] : ['arrow']) : [], luck: 0, morale: 0, name: boss ? BOSSES[boss].name : `${FACTIONS[fac]?.name || 'Wild'} Warlord`, p: -1 };
  const heroMult = hero ? 1 + (hero.att + hero.def) * 0.05 + hero.pow * 0.03 : 1;
  const nStacks = Math.min(7, { raid: 3, warlord: 4, boss: 5 }[kind] + Math.floor((ante - 1) / 2));
  const maxT = Math.min(7, 2 + ante + (boss ? 1 : 0)), minT = Math.max(1, ante - 1);
  const line = fac === 'neutral' ? NEUTRALS : FACTIONS[fac].units, ups = fac === 'neutral' ? null : UPGRADES[fac];
  const upChance = ante >= 6 ? 1 : ante >= 3 ? 0.25 * (ante - 2) : 0;
  const tiers = []; for (let i = 0; i < nStacks; i++) tiers.push(Math.round(minT + (maxT - minT) * (nStacks === 1 ? 1 : i / (nStacks - 1))));
  const wsum = tiers.reduce((a, t) => a + 0.6 + t * 0.4, 0), army = [];
  for (let t of tiers) {
    const up = !!ups && r() < upChance, share = (0.6 + t * 0.4) / wsum * (0.85 + r() * 0.3);
    // a stack's share too small for even one creature of its tier steps down a tier (no lone overshooting giant)
    let id = up ? ups[t - 1] : line[t - 1];
    while (t > 1 && share * P / heroMult / unitPow(id) < 0.75) { t--; id = up ? ups[t - 1] : line[t - 1]; }
    const n = Math.max(1, Math.round(share * P / heroMult / unitPow(id)));
    const same = army.find((x) => x[0] === id); if (same) same[1] += n; else army.push([id, n]);
  }
  // shooters at the back of the line-up do not matter here: battle.js deploys by slot
  return { army, hero, fac, kind, ante, boss, power: Math.round(armyPower(army, hero)), target: Math.round(P) };
}

// ---- banners in play: resolve copies (Mirror copies its right neighbour, Echo the leftmost), left to right
export function resolveBanners(run, { skipLeftmost = false } = {}) {
  const list = run.banners.map((b, i) => ({ inst: b, idx: i }));
  const out = [];
  const resolve = (i, depth) => {
    const b = list[i]; if (!b || depth > 6) return null;
    if (b.inst.id === 'mirror') return resolve(i + 1, depth + 1);
    if (b.inst.id === 'echo') return i === 0 ? null : resolve(0, depth + 1);
    return b.inst;
  };
  list.forEach(({ inst, idx }) => {
    if (skipLeftmost && idx === 0) return;
    const src = resolve(idx, 0);
    if (!src) return;
    out.push({ def: BANNERS[src.id], inst: src, copy: src !== inst, idx, g: src.gilded ? 1.5 : 1, at: inst });
  });
  return out;
}
const runSum = (run, key, extra = {}) => resolveBanners(run).reduce((a, x) => a + (x.def[key] ? x.def[key]({ ...x, run, ...extra }) : 0), 0);
export const buildDiscount = (run) => Math.min(0.5, runSum(run, 'build'));
export const recruitDiscount = (run) => Math.min(0.5, runSum(run, 'recruit'));
export const mineBonus = (run) => runSum(run, 'mine');
export const buildsPerDay = (run) => (has(run, 'masonry') ? 2 : 1);
export const growthMul = (run) => (has(run, 'pens') ? 1.5 : 1);

// ---- battle modifiers for createBattle({ mods }): banners (slot order), seals, the boss rule, then the run tracker
// opts: { boss: bossId | null, seals: [seal per army slot], buildings, fort, blind: kind | null }
export function battleMods(run, opts = {}) {
  const S = PLAYER, mods = [], bossId = opts.boss || null, B0 = bossId ? BOSSES[bossId] : null;
  const ctxBase = { run, opts, S };
  for (const x of resolveBanners(run, { skipLeftmost: !!B0?.chain })) {
    if (!x.def.mod) continue;
    const m = x.def.mod({ ...ctxBase, g: x.g, inst: x.inst, copy: x.copy, idx: x.idx });
    if (m) { m.id = x.def.id; mods.push(m); }
  }
  if (opts.seals && opts.seals.some(Boolean)) mods.push(sealMod(opts.seals, S));
  if (B0) {
    const rules = bossId === 'usurper' ? (run.usurperRules || []) : [bossId];
    if (run.stake >= 8 && bossId !== 'usurper') rules.push(Object.keys(BOSSES).find((k) => k !== bossId && BOSSES[k].mvp) || 'wall');
    const both = run.banners.some((b) => b.id === 'usurper');
    for (const id of rules) { const m = BOSSES[id].rule(S); m.id = 'boss:' + id; mods.push(m); if (both) { const e = BOSSES[id].rule(1 - S); e.id = 'boss2:' + id; mods.push(e); } }
  }
  mods.push(tracker(S));
  return mods;
}
function sealMod(seals, S) {
  return {
    id: 'seals',
    stats(u, i) { if (i.side !== S || !seals[i.slot]) return; u.seal = seals[i.slot]; if (u.seal === 'swift') u.spd += 2; if (u.seal === 'red') u.twoRetal = true; },
    onDamage(c) { if (mine(c.d, S) && c.d.u.seal === 'iron') c.dmg *= 0.8; },
    onStackDeath(s, k, B) { if (s.side !== S && k && k.side === S && k.u.seal === 'gold') B.crown.goldSeals++; },
  };
}
// last in the list: sees the final damage of every strike (best hit) and counts destroyed stacks
function tracker(S) {
  return {
    id: 'tracker',
    onBattleStart(B) { B.crown = { goldSeals: 0, stacksKilled: 0, bestHit: 0 }; },
    onDamage(c, B) { if (!c.preview && c.side === S && B.crown) B.crown.bestHit = Math.max(B.crown.bestHit, Math.round(c.dmg)); },
    onStackDeath(s, k, B) { if (s.side !== S && B.crown) B.crown.stacksKilled++; },
  };
}
// after any battle of the run hero: run counters, banner after-effects (Bone Tally), the Blind's bookkeeping.
// Returns { raise, raiseAs, goldSeals } for main.js to apply (add skeletons, pay seals).
export function afterBattle(run, B, { won, kind = null } = {}) {
  const S = PLAYER;
  const slainLiving = B.stacks.filter((s) => s.side !== S && !s.u.undead).reduce((a, s) => a + (s.start - s.count), 0);
  const res = { won, kind, slainLiving, raise: 0, raiseAs: 'skeleton', goldSeals: kind && won ? B.crown?.goldSeals || 0 : 0, unbroken: 0, losses: 0 };
  for (const x of resolveBanners(run)) if (x.def.after) x.def.after({ ...x, run }, res);
  const c = B.crown || { stacksKilled: 0, bestHit: 0 };
  run.stats.stacksKilled += c.stacksKilled; run.stats.bestHit = Math.max(run.stats.bestHit, c.bestHit); run.stats.raised += res.raise;
  const mineSt = B.stacks.filter((s) => s.side === S);
  res.unbroken = mineSt.filter((s) => s.count === s.start).length; res.losses = mineSt.reduce((a, s) => a + s.start - s.count, 0);
  if (kind) {
    run.stats.blindLog.push({ ante: run.ante, kind, won, rounds: B.round, losses: res.losses });
    if (!won) { run.over = true; run.won = false; }
    else {
      run.stats.blindsWon++; if (!res.losses) run.stats.untouched++;
      if (kind === 'boss') { run.stats.bossesBeaten.push(run.bosses[run.ante - 1]); if (B.round <= 3) run.stats.fastBoss = true; }
    }
  }
  return res;
}

// ---- payout after a Blind won: base + unbroken + banners + interest (on the Crowns held before this payout)
export function interestCap(run) {
  return Math.max(0, TUNE.interestCap + runSum(run, 'cap') + (has(run, 'seed_money') ? 5 : 0) + (ORIGINS[run.origin]?.cap || 0) - (run.stake >= 7 ? 2 : 0));
}
export function payout(run, kind, { unbroken = 0, goldSeals = 0, towns = 0 } = {}) {
  const lines = [];
  const base = kind === 'raid' && run.stake >= 2 ? 0 : TUNE.pay[kind];
  lines.push({ k: 'blind', label: `${BLIND_NAME[kind]} defeated`, n: base });
  const ub = Math.min(TUNE.unbrokenMax, unbroken); if (ub) lines.push({ k: 'unbroken', label: `Unbroken stacks ×${ub}`, n: ub });
  for (const x of resolveBanners(run)) if (x.def.pay) lines.push({ k: 'banner', id: x.def.id, label: x.def.name + (x.copy ? ' (copy)' : ''), n: x.def.pay({ ...x, run }) });
  if (goldSeals) lines.push({ k: 'seal', label: `Gold Seals ×${goldSeals}`, n: goldSeals });
  if (has(run, 'tithe') && towns) lines.push({ k: 'tithe', label: `Tithe ×${towns}`, n: towns });
  const it = Math.min(interestCap(run), Math.floor(run.crowns / TUNE.interestPer)); if (it) lines.push({ k: 'interest', label: `Interest (1 per ${TUNE.interestPer}₵, max ${interestCap(run)})`, n: it });
  const total = lines.reduce((a, l) => a + l.n, 0);
  return { lines, total };
}
// a won Blind moves the schedule on: the Boss closes the Ante (the next region opens, a new voucher is offered)
export function advanceBlind(run) {
  const was = BLINDS[run.blind];
  run.blind++;
  if (run.blind >= BLINDS.length) {
    run.blind = 0; run.ante++;
    if (run.ante > run.antes) { run.over = true; run.won = true; run.ante = run.antes; run.blind = BLINDS.length - 1; }
    else rollVoucher(run);
  }
  return was;
}

// ---- the shop
const priceOf = (run, base) => { let p = base; if (has(run, 'clearance')) p = Math.max(1, Math.floor(p * 0.75)); if (run.stake >= 6) p += 1; return p; };
export const sellValue = (inst) => (inst.tattered ? 0 : Math.max(1, Math.floor((BANNERS[inst.id].cost + (inst.gilded ? TUNE.gildedCost : 0)) / 2)));
export function rerollCost(run) {
  const n = run.shop?.rerolls || 0;
  if (n === 0 && run.perks?.haggler) return 0;
  return Math.max(0, TUNE.rerollBase + TUNE.rerollStep * n - (has(run, 'surplus') ? 2 : 0));
}
// banners the run may be offered: MVP pool (or all implemented), unlocked factions only, not already held
export function bannerPool(run, meta, { legendary = false } = {}) {
  const facs = meta?.unlocks?.factions || ['haven'];
  return Object.values(BANNERS).filter((b) => (run.antes > TUNE.mvpAntes || b.mvp) && (!b.fac || facs.includes(b.fac) || b.fac === run.fac) && !run.banners.some((x) => x.id === b.id) && (legendary || b.rarity !== 'legendary'));
}
function rollBanner(run, r, meta, { legendary = false, exclude = [] } = {}) {
  let rar = legendary && r() < TUNE.legendaryPack ? 'legendary' : pickW(r, TUNE.rarityW);
  let pool = bannerPool(run, meta, { legendary }).filter((b) => !exclude.includes(b.id));
  if (!pool.length) return null;
  const want = pool.filter((b) => b.rarity === rar);
  const b = pick(r, want.length ? want : pool), gilded = r() < TUNE.gildedChance;
  return { kind: 'banner', id: b.id, gilded, tattered: run.stake >= 4 && r() < 0.3, price: priceOf(run, b.cost + (gilded ? TUNE.gildedCost : 0)) };
}
// ctx: { known: [spell ids the hero knows], army: hero army ([id, n, seal?] per slot) }
function rollCard(run, r, meta, ctx, exclude) {
  const kind = pickW(r, TUNE.cardMix);
  if (kind === 'scroll') {
    const pool = Object.keys(SPELLS).filter((s) => !(ctx.known || []).includes(s) && !exclude.includes(s));
    if (pool.length) { const id = pick(r, pool); return { kind: 'scroll', id, price: priceOf(run, TUNE.scrollCost) }; }
  }
  if (kind === 'upgrade') {
    const slots = (ctx.army || []).map((st, i) => [st, i]).filter(([st]) => st && st[1] > 0 && !UNITS[st[0]].up && upgradeOf(st[0]) && !exclude.includes(st[0]));
    if (slots.length) { const [st, i] = pick(r, slots); return { kind: 'upgrade', id: st[0], to: upgradeOf(st[0]), slot: i, price: priceOf(run, has(run, 'blacksmith') ? Math.ceil(TUNE.upgradeCost / 2) : TUNE.upgradeCost) }; }
  }
  return rollBanner(run, r, meta, { exclude });
}
export function upgradeOf(id) { const u = UNITS[id]; if (!u || u.up || !UPGRADES[u.fac]) return null; const i = FACTIONS[u.fac].units.indexOf(id); return i >= 0 ? UPGRADES[u.fac][i] : null; }
function rollCards(run, meta, ctx) {
  const r = rngFor(run, `shop:${run.ante}:${run.blind}:${run.shop.rerolls}`), cards = [];
  for (let i = 0; i < TUNE.cardSlots; i++) { const c = rollCard(run, r, meta, ctx, cards.map((x) => x.id)); if (c) cards.push(c); }
  return cards;
}
// the shop that opens after the Blind just won (call after advanceBlind: keyed on the schedule position)
export function genShop(run, meta = null, ctx = {}) {
  run.shop = { rerolls: 0, cards: [], pack: null, voucher: null, key: `${run.ante}:${run.blind}` };
  run.shop.cards = rollCards(run, meta, ctx);
  const pk = ['war', 'muster', 'tome'][run.stats.blindsWon % 3];
  run.shop.pack = { kind: 'pack', id: pk, price: priceOf(run, TUNE.packCost[pk]) };
  if (run.voucherOffer && !has(run, run.voucherOffer)) run.shop.voucher = { kind: 'voucher', id: run.voucherOffer, price: priceOf(run, TUNE.voucherCost) };
  if (meta) for (const c of run.shop.cards) if (c.kind === 'banner') discover(meta, 'banner', c.id);
  return run.shop;
}
export function reroll(run, meta = null, ctx = {}) {
  const cost = rerollCost(run);
  if (!run.shop || run.crowns < cost) return false;
  run.crowns -= cost; run.shop.rerolls++; run.stats.rerolls++;
  run.shop.cards = rollCards(run, meta, ctx);
  if (meta) for (const c of run.shop.cards) if (c.kind === 'banner') discover(meta, 'banner', c.id);
  return true;
}
export function addBanner(run, item, meta = null) {
  if (run.banners.length >= slotCount(run)) return false;
  run.banners.push({ id: item.id, gilded: !!item.gilded, tattered: !!item.tattered, n: 0 });
  run.stats.maxBanners = Math.max(run.stats.maxBanners, run.banners.length);
  if (meta) { meta.collection.banners[item.id] = (meta.collection.banners[item.id] || 0) + 1; discover(meta, 'banner', item.id); }
  return true;
}
// buy: where = 'card' (index i), 'pack', 'voucher'. Returns { ok, reason, item } (main.js applies scrolls,
// upgrades and opens packs; banners and vouchers are applied here)
export function buy(run, where, i = 0, meta = null) {
  const S = run.shop; if (!S) return { ok: false, reason: 'closed' };
  const item = where === 'card' ? S.cards[i] : S[where];
  if (!item || item.sold) return { ok: false, reason: 'gone' };
  if (run.crowns < item.price) return { ok: false, reason: 'crowns' };
  if (item.kind === 'banner' && run.banners.length >= slotCount(run)) return { ok: false, reason: 'full' };
  run.crowns -= item.price; item.sold = true;
  if (item.kind === 'banner') addBanner(run, item, meta);
  if (item.kind === 'voucher') { run.vouchers.push(item.id); run.voucherOffer = null; }
  return { ok: true, item };
}
export function sell(run, idx) {
  const b = run.banners[idx]; if (!b || b.tattered) return 0;
  const v = sellValue(b); run.banners.splice(idx, 1); run.crowns += v; return v;
}
export function moveBanner(run, from, to) {
  if (from === to || from < 0 || from >= run.banners.length) return false;
  const [b] = run.banners.splice(from, 1); run.banners.splice(Math.max(0, Math.min(run.banners.length, to)), 0, b); return true;
}

// ---- packs: pick 1 of 3 (Crystal Ball: 4). tag makes it deterministic (a map chest: `chest:${objectId}`)
export function chestPack(run, objId) { return pickW(rngFor(run, `chestkind:${objId}`), TUNE.chestSplit); }
export function openPack(run, kind, tag, meta = null, ctx = {}) {
  const r = rngFor(run, `pack:${kind}:${tag}`), n = has(run, 'crystal') ? 4 : 3, choices = [];
  if (kind === 'war') for (let i = 0; i < n; i++) { const b = rollBanner(run, r, meta, { legendary: true, exclude: choices.map((c) => c.id) }); if (b) choices.push({ ...b, price: 0 }); }
  if (kind === 'tome') {
    const pool = Object.keys(SPELLS), fresh = pool.filter((s) => !(ctx.known || []).includes(s)), src = fresh.length >= n ? fresh : pool;
    const bag = src.slice(); for (let i = 0; i < n && bag.length; i++) choices.push({ kind: 'spell', id: bag.splice((r() * bag.length) | 0, 1)[0] });
  }
  if (kind === 'muster') {
    const nb = nextBlind(run) || { ante: run.ante, kind: 'boss' }, P = threatPower(nb.ante, nb.kind, run.stake) * TUNE.musterShare;
    const maxT = Math.min(7, 2 + run.ante), minT = Math.max(1, run.ante - 1), line = FACTIONS[run.fac].units, ups = UPGRADES[run.fac];
    const used = [];
    for (let i = 0; i < n; i++) {
      let t = minT + ((r() * (maxT - minT + 1)) | 0), id = run.ante >= 3 && r() < 0.35 ? ups[t - 1] : line[t - 1];
      if (r() < 0.25) id = NEUTRALS[Math.min(6, t - 1)];
      if (used.includes(id)) id = line[Math.max(0, t - 2)];
      used.push(id);
      const cnt = Math.max(1, Math.round(P / unitPow(id) * (0.85 + r() * 0.3)));
      choices.push({ kind: 'unit', id, n: cnt, seal: r() < 0.25 ? pick(r, Object.keys(SEALS)) : null });
    }
  }
  if (meta) for (const c of choices) discover(meta, c.kind === 'banner' ? 'banner' : 'unit', c.kind === 'spell' ? null : c.id);
  return { kind, tag, choices };
}

// ---- scoring and the end of the run
export function scoreRun(run, { armyPower: ap = 0 } = {}) {
  const rows = [];
  const bl = run.stats.blindLog.filter((b) => b.won).reduce((a, b) => a + { raid: 100, warlord: 200, boss: 400 }[b.kind] * b.ante, 0);
  rows.push({ k: 'blinds', label: 'Blinds won', n: bl });
  rows.push({ k: 'crowns', label: 'Crowns held', n: 5 * run.crowns });
  rows.push({ k: 'army', label: 'Army strength', n: Math.floor(ap / 50) });
  if (run.won) rows.push({ k: 'win', label: 'Crowned!', n: 1000 });
  const sub = rows.reduce((a, r) => a + r.n, 0), mult = 1 + 0.25 * (run.stake - 1);
  const score = Math.round(sub * mult);
  const glory = Math.floor(score / 150) + 5 * run.stats.bossesBeaten.length + (run.won ? 20 : 0);
  return { rows, sub, mult, score, glory };
}
// merges the run into the meta save: Glory, best score, unlocks (factions, origins, stakes), trophies
export function endRun(run, meta, { armyPower: ap = 0 } = {}) {
  const S = scoreRun(run, { armyPower: ap }), unlocks = [], trophies = [];
  meta.runs++; if (run.won) meta.wins++;
  meta.glory += S.glory;
  const best = S.score > meta.best.score; if (best) meta.best.score = S.score;
  meta.best.ante = Math.max(meta.best.ante, run.won ? run.antes : run.ante);
  for (const b of run.stats.bossesBeaten) meta.collection.bosses[b] = 1;
  const unlockFac = (f) => { if (!meta.unlocks.factions.includes(f)) { meta.unlocks.factions.push(f); unlocks.push({ kind: 'faction', id: f, name: FACTIONS[f].name }); } };
  const unlockOrigin = (o) => { if (!meta.unlocks.origins.includes(o)) { meta.unlocks.origins.push(o); unlocks.push({ kind: 'origin', id: o, name: ORIGINS[o].name }); } };
  if (run.stats.bossesBeaten.includes('lich_queen')) { unlockFac('necro'); unlockOrigin('gravecaller'); }
  if (run.won) { unlockFac('sylvan'); unlockOrigin('scholar'); const st = meta.unlocks.stakes[run.fac] || 1; if (run.stake >= st && run.stake < 8) { meta.unlocks.stakes[run.fac] = run.stake + 1; unlocks.push({ kind: 'stake', id: run.stake + 1, name: `${STAKES[run.stake + 1].name} Stake` }); } }
  if (run.stats.fastBoss) unlockFac('inferno');
  if (run.stats.maxBanners >= 5) unlockFac('dungeon');
  if (run.stats.bossesBeaten.includes('wall')) unlockOrigin('siegelord');
  const award = (id, ok) => { if (ok && !meta.trophies.includes(id)) { meta.trophies.push(id); trophies.push(id); } };
  award('first_blood', run.stats.blindsWon > 0); award('crowned', run.won); award('hoarder', run.crowns >= 25); award('full_banner', run.stats.maxBanners >= 5);
  award('bone_lord', run.stats.raised >= 100); award('untouchable', run.stats.untouched > 0); award('big_hit', run.stats.bestHit >= 1000); award('collector', discoveredCount(meta) >= 30);
  return { ...S, best, unlocks, trophies };
}

// ---- tooltip text (with the Gilded numbers and live counters)
export function bannerText(inst) { const b = BANNERS[inst.id || inst]; return b.text(inst.gilded ? 1.5 : 1, inst.id ? inst : null); }
export function bossText(id) { return BOSSES[id].text; }
