// =====================================================================
// ORBIS · Crown Run: the roguelite layer (agent "crown"), told entirely in Heroes terms. Pure data and rules:
// no DOM, no THREE, so it runs in node (dev/crown_test.mjs). Design: dev/CROWN_RUN.md.
//   - one hero, one full map, permadeath; regions behind Border Guards, each opened by the key its Legendary Hero guards
//   - artifacts in equipment slots (paper doll) drive the battle modifiers; complete ARTIFACT SETS for set bonuses
//   - weekly invasions march on your capital, stronger every week
//   - map sites with choices: Pandora's Box, Witch Hut, Scholar, Shrine, Treasure Chest, Seer's Hut, merchants
// main.js owns the screens and the map; it calls in here for every rule.
// =====================================================================
import { UNITS, FACTIONS, UPGRADES, NEUTRALS, SPELLS, SKILLS } from './data.js?v=2.6';
import { armyPower, harm, alive } from './battle.js?v=2.6';

// ---------------------------------------------------------------- balance levers (CROWN_RUN.md "Balance levers")
export const TUNE = {
  regions: 3, regionsFull: 6,
  guardian: { base: 1500, growth: 2.3, mult: 2.2 },     // Legendary Hero of region r: base · growth^(r−1) · mult
  invasion: { base: 1500, growth: 1.9, mult: 1.45, warnDay: 4, arriveDay: 7 }, // week w: base · growth^(w−1) · mult
  diffStep: 0.08,
  value: { treasure: 600, minor: 1800, major: 4500, relic: 9000 }, // gold; merchants sell at value, buy at half
  rarityW: { treasure: 50, minor: 33, major: 14, relic: 3 },
  chest: { gold: 1500, xp: 1200 }, pandora: { gold: 4000, xp: 3000 },
  musterShare: 0.12,
};
export const RARITY = { treasure: { name: 'Treasure', col: '#b4c2d8' }, minor: { name: 'Minor', col: '#5bd352' }, major: { name: 'Major', col: '#b36bff' }, relic: { name: 'Relic', col: '#ffd447' } };
export const META_KEY = 'realms.crown.meta';
export const PLAYER = 0; // the player's side in every battle (main.js always deploys you at the bottom, side 0)

// ---------------------------------------------------------------- seeded randomness
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const rngFor = (run, tag) => mulberry32(hashStr(`${run.seed}|${tag}`));
const pick = (r, arr) => arr[(r() * arr.length) | 0];
const pickW = (r, w) => { const e = Object.entries(w); let k = r() * e.reduce((a, [, x]) => a + x, 0); for (const [id, x] of e) { k -= x; if (k <= 0) return id; } return e[0][0]; };
const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------------------------------------------------------- equipment slots (the paper doll)
export const SLOTS = ['head', 'neck', 'torso', 'weapon', 'shield', 'feet', 'ring1', 'ring2', 'misc1', 'misc2', 'misc3'];
export const SLOT_NAME = { head: 'Head', neck: 'Neck', torso: 'Torso', weapon: 'Weapon', shield: 'Shield', feet: 'Feet', ring1: 'Ring', ring2: 'Ring', misc1: 'Misc', misc2: 'Misc', misc3: 'Misc' };
const slotKind = (s) => s.replace(/\d$/, '');

// ---------------------------------------------------------------- artifacts
// Each: name, icon (icons.js), slot ('head'|'neck'|'torso'|'weapon'|'shield'|'feet'|'ring'|'misc'), rarity,
// text, stats { att, def, pow, luck, morale } (hero, in battle), set (id), fac (only offered once unlocked), and effects:
//   mod(x) -> battle hook object (battle.js), x = { S, run, opts, inst }
//   after(x, res) after a battle of the run hero; daily(x) -> { gold, wood, ore } at dawn; build -> gold discount
const mine = (s, S) => s && s.side === S;
const foe = (s, S) => s && s.side !== S;
const firstSlot = (B, S) => Math.min(...B.stacks.filter((s) => s.side === S).map((s) => s.slot));
export const ARTIFACTS = {
  // plain stats (treasure / minor)
  centaur_axe: { name: 'Centaur Axe', icon: 'axe', slot: 'weapon', rarity: 'treasure', stats: { att: 2 }, text: '+2 Attack.' },
  lion_shield: { name: 'Lion Shield', icon: 'defense', slot: 'shield', rarity: 'treasure', stats: { def: 2 }, text: '+2 Defence.' },
  staff_embers: { name: 'Staff of Embers', icon: 'power', slot: 'weapon', rarity: 'minor', stats: { pow: 2 }, text: '+2 Power.' },
  helm_command: { name: 'Helm of Command', icon: 'hero', slot: 'head', rarity: 'minor', stats: { att: 1, def: 1, pow: 1 }, text: '+1 Attack, Defence and Power.' },
  shadow_cloak: { name: 'Cloak of Shadows', icon: 'cloak', slot: 'neck', rarity: 'minor', stats: { def: 3 }, text: '+3 Defence.' },
  judgement: { name: 'Sword of Judgement', icon: 'attack', slot: 'weapon', rarity: 'major', stats: { att: 4 }, text: '+4 Attack.' },
  tempest_orb: { name: 'Orb of Tempest', icon: 'sorcery', slot: 'misc', rarity: 'minor', stats: { pow: 3 }, text: '+3 Power.' },
  clover: { name: 'Four-leaf Clover', icon: 'luck', slot: 'misc', rarity: 'treasure', stats: { luck: 1 }, text: '+1 Luck.' },
  valor_badge: { name: 'Badge of Valor', icon: 'morale', slot: 'misc', rarity: 'treasure', stats: { morale: 1 }, text: '+1 Morale.' },
  vitality_ring: { name: 'Ring of Vitality', icon: 'ring', slot: 'ring', rarity: 'treasure', text: 'Your creatures +1 hit point.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S) u.hp += 1; } }) },
  speed_boots: { name: 'Boots of Speed', icon: 'movement', slot: 'feet', rarity: 'minor', text: 'Your stacks +1 speed.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S) u.spd += 1; } }) },
  pike_pauldron: { name: "Pikeman's Pauldron", icon: 'armorer', slot: 'torso', rarity: 'treasure', text: 'Your tier 1–2 stacks +4 Defence.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier <= 2) u.def += 4; } }) },
  // the Warlord's Regalia (set)
  war_drum: { name: 'War Drum', icon: 'attack', slot: 'misc', rarity: 'minor', set: 'warlord', text: '+1 damage per creature on your melee strikes.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.melee) c.dmg += c.a.count; } }) },
  vanguard_standard: { name: 'Vanguard Standard', icon: 'army', slot: 'misc', rarity: 'minor', set: 'warlord', text: 'The stack in your first army slot deals ×1.5 damage.', mod: ({ S }) => ({ onDamage(c, B) { if (mine(c.a, S) && c.a.slot === firstSlot(B, S)) c.dmg *= 1.5; } }) },
  executioner_axe: { name: "Executioner's Axe", icon: 'axe', slot: 'weapon', rarity: 'major', set: 'warlord', text: '×2 damage against stacks below half their starting size.', mod: ({ S }) => ({ onDamage(c) { if (c.side === S && foe(c.d, S) && c.d.count < c.d.start / 2) c.dmg *= 2; } }) },
  // the Sentinel's Armour (set, Haven)
  sentinel_helm: { name: "Sentinel's Helm", icon: 'hero', slot: 'head', rarity: 'minor', set: 'sentinel', stats: { def: 1 }, text: '+1 Defence. Haven stacks +1 Attack.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.fac === 'haven') u.att += 1; } }) },
  sentinel_plate: { name: "Sentinel's Breastplate", icon: 'armorer', slot: 'torso', rarity: 'major', set: 'sentinel', text: 'Your stacks take −15% damage.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.d, S)) c.dmg *= 0.85; } }) },
  sentinel_shield: { name: "Sentinel's Tower Shield", icon: 'defense', slot: 'shield', rarity: 'minor', set: 'sentinel', text: 'Your first-slot stack takes −35% damage.', mod: ({ S }) => ({ onDamage(c, B) { if (mine(c.d, S) && c.d.slot === firstSlot(B, S)) c.dmg *= 0.65; } }) },
  // the Sharpshooter's Kit (set)
  plenty_quiver: { name: 'Quiver of Plenty', icon: 'shots', slot: 'misc', rarity: 'minor', set: 'sharpshooter', text: 'Your shooters +4 shots and +2 damage per creature on shots.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.ranged) u.ranged += 4; }, onDamage(c) { if (mine(c.a, S) && c.ranged) c.dmg += 2 * c.a.count; } }) },
  sharpshooter_bow: { name: "Sharpshooter's Bow", icon: 'archery', slot: 'weapon', rarity: 'major', set: 'sharpshooter', text: 'Your shots deal ×1.5 damage.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.ranged) c.dmg *= 1.5; } }) },
  elven_bowstring: { name: 'Elven Bowstring', icon: 'arrow', slot: 'misc', rarity: 'minor', set: 'sharpshooter', text: 'Your shots deal ×2 to fliers.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.ranged && c.d?.u.fly) c.dmg *= 2; } }) },
  // the Wings of the Griffin (set)
  griffin_cape: { name: 'Griffin-feather Cape', icon: 'fly', slot: 'neck', rarity: 'minor', set: 'wings', text: 'Your fliers +3 speed.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.fly) u.spd += 3; } }) },
  feathered_boots: { name: 'Feathered Boots', icon: 'movement', slot: 'feet', rarity: 'minor', set: 'wings', text: 'Your fliers deal ×1.4 damage in round 1.', mod: ({ S }) => ({ onDamage(c, B) { if (mine(c.a, S) && c.a.u.fly && B.round === 1) c.dmg *= 1.4; } }) },
  talon_ring: { name: 'Talon Ring', icon: 'ring', slot: 'ring', rarity: 'treasure', set: 'wings', text: 'Your fliers +2 Attack.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.fly) u.att += 2; } }) },
  // the Cloak of the Undead King (set)
  bone_cloak: { name: 'Bone Cloak', icon: 'necromancy', slot: 'neck', rarity: 'minor', set: 'undead', text: 'After each battle won, raise 10% of the slain living foes as skeletons.', after: (x, res) => { if (res.won) res.raisePct += 0.1; } },
  skull_helm: { name: 'Skull Helm', icon: 'defeat', slot: 'head', rarity: 'minor', set: 'undead', text: 'Your undead +2 Attack and Defence.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.undead) { u.att += 2; u.def += 2; } } }) },
  vampire_ring: { name: "Vampire's Ring", icon: 'ring', slot: 'ring', rarity: 'major', set: 'undead', text: 'Your undead heal their top creature every round.', mod: ({ S }) => ({ onRoundStart(B) { for (const s of alive(B, S)) if (s.u.undead) s.hp = s.u.hp; } }) },
  // singles
  last_stand: { name: 'Heart of the Last Stand', icon: 'hp', slot: 'neck', rarity: 'major', text: 'While you have one stack left, it deals ×3 damage.', mod: ({ S }) => ({ onDamage(c, B) { if (mine(c.a, S) && alive(B, S).length === 1) c.dmg *= 3; } }) },
  berserker_helm: { name: "Berserker's Helm", icon: 'offense', slot: 'head', rarity: 'major', text: 'Your stacks deal ×1.6 damage but take ×1.3.', mod: ({ S }) => ({ onDamage(c) { if (c.side === S && c.a) c.dmg *= 1.6; if (mine(c.d, S)) c.dmg *= 1.3; } }) },
  riposte_bracer: { name: 'Riposte Bracer', icon: 'defend', slot: 'misc', rarity: 'treasure', text: 'Your retaliation strikes deal ×1.5.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.retal) c.dmg *= 1.5; } }) },
  iron_oath: { name: 'Ring of the Iron Oath', icon: 'ring', slot: 'ring', rarity: 'minor', text: 'Your stacks retaliate twice per round.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S) u.twoRetal = true; } }) },
  trophy_necklace: { name: 'Necklace of Trophies', icon: 'victory', slot: 'neck', rarity: 'minor', text: 'Your stacks deal +3% per enemy stack destroyed while you wear it.', grows: true,
    mod: ({ S, inst }) => ({ onDamage(c) { if (c.side === S && c.a) c.dmg *= 1 + 0.03 * (inst.n || 0); }, onStackDeath(s) { if (s.side !== S) inst.n = (inst.n || 0) + 1; } }) },
  veteran_medal: { name: "Veteran's Medal", icon: 'experience', slot: 'misc', rarity: 'major', text: 'Your stacks +1 Attack and Defence per Legendary Hero defeated while you wear it.', grows: true,
    mod: ({ S, inst }) => ({ stats(u, i) { if (i.side === S) { u.att += inst.n || 0; u.def += inst.n || 0; } } }), after: ({ inst }, res) => { if (res.won && res.guardian) inst.n = (inst.n || 0) + 1; } },
  hourglass: { name: 'Hourglass of the Long Battle', icon: 'wait', slot: 'misc', rarity: 'minor', text: 'Your stacks deal ×(1 + 0.1 × round).', mod: ({ S }) => ({ onDamage(c, B) { if (c.side === S && c.a) c.dmg *= 1 + 0.1 * B.round; } }) },
  sky_lances: { name: 'Bracers of the Sky Lances', icon: 'arrow', slot: 'misc', rarity: 'major', text: 'Your shooters may shoot even with an enemy next to them.', mod: ({ S }) => ({ canShoot(B, s, ok) { return ok || (s.side === S && s.shots > 0 && alive(B, 1 - S).length > 0); } }) },
  crown_command: { name: 'Crown of Command', icon: 'victory', slot: 'head', rarity: 'relic', text: 'Your stacks deal ×1.05 per artifact you wear.', mod: ({ S, run }) => { const n = equippedIds(run).length; return { onDamage(c) { if (c.side === S && c.a) c.dmg *= Math.pow(1.05, n); } }; } },
  phylactery: { name: 'Phylactery', icon: 'artifact', slot: 'neck', rarity: 'relic', text: 'Your stacks cannot drop below 1 creature before round 3.', mod: ({ S }) => ({ onDamage(c, B) { if (mine(c.d, S) && B.round < 3 && !c.preview) c.dmg = Math.min(c.dmg, Math.max(0, (c.d.count - 1) * c.d.u.hp + c.d.hp - 1)); } }) },
  usurper_crown: { name: "Usurper's Crown", icon: 'victory', slot: 'head', rarity: 'relic', text: "A Legendary Hero's special rule also binds his own army." },
  miser_ring: { name: "Miser's Ring", icon: 'ring', slot: 'ring', rarity: 'minor', text: 'Your stacks deal +1% per 1,000 gold in your treasury (max +40%).', mod: ({ S, opts }) => ({ onDamage(c) { if (c.side === S && c.a) c.dmg *= 1 + Math.min(0.4, (opts.gold || 0) / 100000); } }) },
  // economy and building (map effects)
  endless_purse: { name: 'Endless Purse of Gold', icon: 'gold', slot: 'misc', rarity: 'minor', text: '+500 gold every day.', daily: () => ({ gold: 500 }) },
  endless_sack: { name: 'Endless Cart of Ore', icon: 'ore', slot: 'misc', rarity: 'treasure', text: '+1 wood and +1 ore every day.', daily: () => ({ wood: 1, ore: 1 }) },
  mason_hammer: { name: "Mason's Hammer", icon: 'build', slot: 'weapon', rarity: 'treasure', text: 'Buildings cost 25% less gold.', build: 0.25 },
  builders_crown: { name: "Builder's Circlet", icon: 'fort', slot: 'head', rarity: 'minor', text: 'Your stacks deal +2% per building in your capital.', mod: ({ S, opts }) => ({ onDamage(c) { if (c.side === S && c.a) c.dmg *= 1 + 0.02 * (opts.buildings || 0); } }) },
  fortress_shield: { name: 'Shield of the Fortress', icon: 'fort', slot: 'shield', rarity: 'major', text: 'If your capital has a Fort, your stacks +3 Defence.', mod: ({ S, opts }) => ({ stats(u, i) { if (i.side === S && opts.fort) u.def += 3; } }) },
  // faction relics (offered once the faction is unlocked)
  sylvan_leaf: { name: 'Leaf of the World Tree', icon: 'luck', slot: 'misc', rarity: 'major', fac: 'sylvan', text: 'Sylvan stacks +2 Attack; Sylvan shooters +2 shots.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.fac === 'sylvan') { u.att += 2; if (u.ranged) u.ranged += 2; } } }) },
  inferno_brand: { name: 'Brand of the Pit', icon: 'fireball', slot: 'misc', rarity: 'major', fac: 'inferno', text: 'Inferno stacks +2 speed and +2 Attack.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.fac === 'inferno') { u.spd += 2; u.att += 2; } } }) },
  dungeon_eye: { name: 'Eye of the Deep', icon: 'sorcery', slot: 'misc', rarity: 'major', fac: 'dungeon', text: 'Dungeon stacks +2 Defence and ×1.25 on their first strike each round.',
    mod: ({ S }) => { const hit = new Map(); return { stats(u, i) { if (i.side === S && u.fac === 'dungeon') u.def += 2; }, onDamage(c, B) { if (mine(c.a, S) && c.a.u.fac === 'dungeon' && hit.get(c.a.uid) !== B.round) { c.dmg *= 1.25; if (!c.preview) hit.set(c.a.uid, B.round); } } }; } },
};
for (const [id, a] of Object.entries(ARTIFACTS)) a.id = id;

// artifact sets (HoMM3 combination artifacts): wear every piece for the set bonus
export const SETS = {
  warlord: { name: "Warlord's Regalia", icon: 'army', pieces: ['war_drum', 'vanguard_standard', 'executioner_axe'], text: 'Bloodlust: each enemy stack destroyed gives your stacks +2 Attack for the battle.',
    mod: ({ S }) => ({ onStackDeath(s, k, B) { if (s.side !== S) for (const m of alive(B, S)) m.u.att += 2; } }) },
  sentinel: { name: "Sentinel's Armour", icon: 'defense', pieces: ['sentinel_helm', 'sentinel_plate', 'sentinel_shield'], text: 'Haven stacks +2 Attack and Defence and retaliate twice; ×1.25 damage if every stack is Haven.',
    mod: ({ S }) => { let pure = false; return { stats(u, i) { if (i.side === S && u.fac === 'haven') { u.att += 2; u.def += 2; u.twoRetal = true; } }, onBattleStart(B) { pure = B.stacks.filter((s) => s.side === S).every((s) => s.u.fac === 'haven'); }, onDamage(c) { if (pure && mine(c.a, S)) c.dmg *= 1.25; } }; } },
  sharpshooter: { name: "Sharpshooter's Kit", icon: 'archery', pieces: ['plenty_quiver', 'sharpshooter_bow', 'elven_bowstring'], text: 'Your shooters may shoot with an enemy next to them, and every shot also hits a second enemy stack for 50%.',
    mod: ({ S }) => ({
      canShoot(B, s, ok) { return ok || (s.side === S && s.shots > 0 && alive(B, 1 - S).length > 0); },
      onShoot(B, a, d) {
        if (!mine(a, S)) return;
        const o = alive(B, 1 - S).filter((x) => x !== d); if (!o.length) return;
        const t = o[(B.rand() * o.length) | 0], dmg = Math.round(a.count * (a.u.dmg[0] + a.u.dmg[1]) / 2 * 0.5);
        const killed = harm(B, t, dmg, a); B.events.push({ t: 'mod', icon: 'shots', text: 'Ricochet', side: S, hits: [{ s: t.uid, dmg, killed, left: t.count }] });
      },
    }) },
  wings: { name: 'Wings of the Griffin', icon: 'fly', pieces: ['griffin_cape', 'feathered_boots', 'talon_ring'], text: 'Your fliers attack without retaliation, and your tier 1–3 walkers take wing.',
    mod: ({ S }) => ({ stats(u, i) { if (i.side !== S) return; if (u.tier <= 3 && !u.ranged) u.fly = true; if (u.fly) u.noRetal = true; } }) },
  undead: { name: 'Cloak of the Undead King', icon: 'necromancy', pieces: ['bone_cloak', 'skull_helm', 'vampire_ring'], text: 'Raise 25% of the slain (+5% per Legendary Hero defeated) as Skeleton Warriors; your undead deal ×1.25.',
    mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.a.u.undead) c.dmg *= 1.25; } }), after: ({ run }, res) => { if (res.won) { res.raisePct += 0.15 + 0.05 * run.stats.guardians.length; res.raiseAs = 'skelwarrior'; } } },
};
for (const [id, s] of Object.entries(SETS)) s.id = id;

// ---------------------------------------------------------------- Legendary Heroes (region guardians) with special rules
// rule(T) builds the battle hook for the victim side T (the player)
const ward = () => false;
export const GUARDIANS = {
  wall: { name: 'Gorrak the Wall', title: 'Ogre Warlord', icon: 'fort', fac: 'neutral', mvp: true, rule: 'Shieldwall: your shooters cannot shoot.', mod: (T) => ({ canShoot(B, s, ok) { return s.side === T && !ward(s) ? false : ok; } }) },
  plague: { name: 'Malphas the Plaguebringer', title: 'Pit Lord of Inferno', icon: 'defeat', fac: 'inferno', mvp: true, rule: 'Plague: your first stack starts the battle with 30% fewer creatures.', mod: (T) => ({ onBattleStart(B) {
    const s = B.stacks.filter((x) => x.side === T).sort((a, b) => a.slot - b.slot)[0]; if (!s) return;
    const n = Math.max(1, Math.ceil(s.count * 0.7)), lost = s.count - n; s.count = n;
    if (lost) B.events.push({ t: 'mod', icon: 'defeat', text: `Plague −${lost}`, side: 1 - T, s: s.uid, hits: [{ s: s.uid, dmg: lost * s.u.hp, killed: lost, left: n }] });
  } }) },
  lich_queen: { name: 'Vesperine, the Lich Queen', title: 'Necromancer of the Last Crown', icon: 'necromancy', fac: 'necro', mvp: true, unlocks: 'necro', rule: 'Lifedrinker: her stacks heal half the damage they deal and raise their dead.', mod: (T) => ({ stats(u, i) { if (i.side !== T) u.drain = true; } }) },
  silence: { name: 'Sorceress Ilvane', title: 'Warlock of Dungeon', icon: 'spellbook', fac: 'dungeon', rule: 'Silence: your hero cannot cast spells.', mod: (T) => ({ onRoundStart(B) { B.cast[T] = true; } }) },
  hunger: { name: 'Krug the Endless', title: 'Troll Chieftain', icon: 'hp', fac: 'neutral', rule: 'Regeneration: his stacks heal fully every round.', mod: (T) => ({ stats(u, i) { if (i.side !== T) u.regen = true; } }) },
  gale: { name: 'Windcaller Aelis', title: 'Druid of Sylvan', icon: 'fly', fac: 'sylvan', rule: 'Gale: your fliers are grounded.', mod: (T) => ({ stats(u, i) { if (i.side === T) u.fly = false; } }) },
  eclipse: { name: 'Shadowmother Zyra', title: 'Dungeon Overlord', icon: 'end', fac: 'dungeon', rule: "Eclipse: your hero's Attack and Defence count as 0.", mod: (T) => ({ onBattleStart(B) { const h = B.heroes[T]; if (h) { h.att = 0; h.def = 0; } } }) },
  stampede: { name: 'Khazrak Hellrider', title: 'Demon Knight', icon: 'movement', fac: 'inferno', rule: 'Stampede: his stacks +3 speed.', mod: (T) => ({ stats(u, i) { if (i.side !== T) u.spd += 3; } }) },
  iron_hide: { name: 'Sir Brannoc Ironhide', title: 'Fallen Paladin', icon: 'armorer', fac: 'haven', rule: 'Ironhide: his stacks take −50% damage from your shots.', mod: (T) => ({ onDamage(c) { if (c.ranged && c.a?.side === T && c.d?.side !== T) c.dmg *= 0.5; } }) },
};
for (const [id, b] of Object.entries(GUARDIANS)) b.id = id;
export const MVP_GUARDIANS = ['wall', 'plague', 'lich_queen'];

// ---------------------------------------------------------------- hero backgrounds, difficulty, meta
export const BACKGROUNDS = {
  knight: { name: 'Knight-Errant', icon: 'banner', text: 'A sworn sword. No advantages, no flaws.', start: true },
  merchant: { name: 'Merchant Prince', icon: 'gold', text: 'Starts with +5,000 gold; +250 gold every day.', start: true, gold: 5000, daily: 250 },
  warlord: { name: 'Warlord', icon: 'army', text: 'Starting army ×1.5, but one Misc slot fewer.', start: true, armyMul: 1.5, lockSlots: ['misc3'] },
  exile: { name: 'Exile', icon: 'defeat', text: 'Half the resources and a smaller army, but carries a Major artifact.', start: true, resMul: 0.5, armyMul: 0.8, startArt: 'major' },
  scholar: { name: 'Scholar', icon: 'wisdom', text: 'Mage Guild I built, +2 spells and Wisdom; army ×0.8.', armyMul: 0.8, unlock: 'Win a Crown Run.' },
  gravecaller: { name: 'Gravecaller', icon: 'necromancy', text: 'Necropolis only. Starts wearing the Bone Cloak.', fac: 'necro', startArt: 'bone_cloak', unlock: 'Unlock Necropolis.' },
  siegelord: { name: 'Siegelord', icon: 'fort', text: 'Your capital starts with a Fort.', fort: true, unlock: 'Defeat Gorrak the Wall.' },
};
for (const [id, o] of Object.entries(BACKGROUNDS)) o.id = id;
export const DIFFS = [null,
  { name: 'Squire', col: '#f4f4f4', text: 'The standard challenge.' },
  { name: 'Knight', col: '#f0453a', text: 'Invasions march a day faster.' },
  { name: 'Baron', col: '#5bd352', text: 'Invasions grow ×1.1 stronger every week.' },
  { name: 'Count', col: '#3a3a44', text: 'Merchants charge 25% more.' },
  { name: 'Duke', col: '#4aa8ff', text: 'Legendary Heroes lead 20% larger armies.' },
  { name: 'Prince', col: '#b36bff', text: 'Weekly creature growth −25%.' },
  { name: 'King', col: '#ffa52e', text: 'Legendary Heroes follow two rules.' },
  { name: 'Emperor', col: '#ffd447', text: 'Your starting army is halved.' },
];
export const FAC_UNLOCK = {
  haven: { text: 'Available from the start.' },
  necro: { text: 'Defeat Vesperine, the Lich Queen.' },
  sylvan: { text: 'Win a Crown Run.' },
  inferno: { text: 'Defeat a Legendary Hero in 3 rounds or fewer.' },
  dungeon: { text: 'Complete an artifact set.' },
};
export const TROPHIES = {
  first_blood: { name: 'First Blood', icon: 'attack', text: 'Repel an invasion.' },
  crowned: { name: 'Crowned', icon: 'victory', text: 'Win a Crown Run.' },
  hoarder: { name: 'Hoarder', icon: 'gold', text: 'Hold 50,000 gold.' },
  full_set: { name: 'Set Collector', icon: 'artifact', text: 'Complete an artifact set.' },
  bone_lord: { name: 'Bone Lord', icon: 'necromancy', text: 'Raise 100 skeletons in one run.' },
  untouchable: { name: 'Untouchable', icon: 'defense', text: 'Repel an invasion with no losses.' },
  big_hit: { name: 'Big Hit', icon: 'damage', text: 'Deal 1,000+ damage in one strike.' },
  collector: { name: 'Collector', icon: 'chest', text: 'Discover 30 entries.' },
};
export const PERKS = {
  quartermaster: { name: 'Quartermaster', icon: 'gold', text: '+1,500 gold at the start of a run.', cost: 30, max: 2 },
  drillmaster: { name: 'Drillmaster', icon: 'army', text: 'Starting army +10%.', cost: 40, max: 2 },
  haggler: { name: 'Haggler', icon: 'market', text: 'Merchants charge 10% less.', cost: 60, max: 1 },
  heirloom: { name: 'Heirloom', icon: 'artifact', text: 'Start every run with a Treasure artifact.', cost: 50, max: 1 },
};

export function metaDefault() {
  return { v: 2, glory: 0, runs: 0, wins: 0, best: { score: 0, region: 0 }, unlocks: { factions: ['haven'], backgrounds: Object.keys(BACKGROUNDS).filter((k) => BACKGROUNDS[k].start), diffs: { haven: 1 } },
    collection: { artifacts: {}, seen: {}, guardians: {}, units: {} }, trophies: [], perks: {} };
}
export function metaLoad(store) {
  const d = metaDefault(), m = store?.get ? store.get(META_KEY, null) : null;
  if (!m || m.v !== 2) return d; // (the v1 card-game meta is not carried over)
  return { ...d, ...m, best: { ...d.best, ...m.best }, unlocks: { ...d.unlocks, ...m.unlocks }, collection: { ...d.collection, ...m.collection }, perks: { ...m.perks } };
}
export function metaSave(store, meta) { store?.set?.(META_KEY, meta); }
export function discover(meta, kind, id) { if (!meta || !id) return false; const c = meta.collection[kind === 'artifact' ? 'seen' : kind === 'guardian' ? 'guardians' : 'units']; if (c[id]) return false; c[id] = 1; return true; }
export function discoveredCount(meta) { const c = meta.collection; return Object.keys(c.seen).length + Object.keys(c.guardians).length + Object.keys(c.units).length; }
export function buyPerk(meta, id) {
  const P = PERKS[id], lv = meta.perks[id] || 0;
  if (!P || lv >= P.max || meta.glory < P.cost) return false;
  meta.glory -= P.cost; meta.perks[id] = lv + 1; return true;
}

// ---------------------------------------------------------------- the run
export function newRun({ seed = 1, background = 'knight', diff = 1, fac = 'haven', regions = TUNE.regions, meta = null } = {}) {
  const O = BACKGROUNDS[background] || BACKGROUNDS.knight, perks = meta?.perks || {};
  const run = {
    v: 2, seed, background: O.id, diff, fac: O.fac || fac, regions, region: 1, hero: 0,
    equip: Object.fromEntries(SLOTS.map((s) => [s, null])), locked: O.lockSlots || [], backpack: [],
    guardians: [], keys: [], invasion: null, invasionsBeaten: 0, forge: false, quests: {},
    stats: { guardians: [], invasions: [], stacksKilled: 0, bestHit: 0, raised: 0, setsDone: [], fastGuardian: false, untouched: 0 },
    over: false, won: false, perks: { ...perks },
    originFx: { armyMul: (O.armyMul || 1) * (1 + 0.1 * (perks.drillmaster || 0)) * (diff >= 8 ? 0.5 : 1), resMul: O.resMul ?? 1, gold: (O.gold || 0) + 1500 * (perks.quartermaster || 0), daily: O.daily || 0, fort: !!O.fort },
  };
  const r = rngFor(run, 'guardians');
  if (regions <= MVP_GUARDIANS.length) run.guardians = MVP_GUARDIANS.slice(0, regions);
  else { const bag = shuffle(r, Object.keys(GUARDIANS).filter((k) => k !== 'lich_queen')); for (let i = 1; i <= regions; i++) run.guardians.push(i === regions ? 'lich_queen' : bag.pop()); }
  run.secondRule = Object.fromEntries(run.guardians.map((g) => [g, pick(r, MVP_GUARDIANS.filter((k) => k !== g))]));
  const start = [];
  if (O.startArt) start.push(ARTIFACTS[O.startArt] ? O.startArt : rollArtifact(run, 'start', meta, { rarity: O.startArt }));
  if (perks.heirloom) start.push(rollArtifact(run, 'heirloom', meta, { rarity: 'treasure', exclude: start }));
  for (const id of start) if (id) addArtifact(run, id);
  return run;
}
export const runSave = (run) => JSON.parse(JSON.stringify(run));
export function runLoad(o) { if (!o || o.v !== 2 || !o.equip) return null; return o; }
export const week = (day) => Math.floor((day - 1) / 7) + 1;
export const regionOpen = (run, region) => region <= run.region;
export function regionByDistance(d, first = 10, band = 8) { return d < first ? 1 : 1 + Math.ceil((d - first + 1) / band); }

// ---- equipment
export const equippedIds = (run) => SLOTS.map((s) => run.equip[s]?.id).filter(Boolean);
export const slotsFor = (run, id) => { const k = ARTIFACTS[id]?.slot; return SLOTS.filter((s) => slotKind(s) === k && !run.locked.includes(s)); };
export function addArtifact(run, id, meta = null) {
  if (!ARTIFACTS[id]) return null;
  const inst = { id, n: 0 };
  const free = slotsFor(run, id).find((s) => !run.equip[s]);
  if (free) run.equip[free] = inst; else run.backpack.push(inst);
  if (meta) { meta.collection.artifacts[id] = (meta.collection.artifacts[id] || 0) + 1; discover(meta, 'artifact', id); }
  noteSets(run);
  return free || 'backpack';
}
// equip from the backpack (index) into a slot (or the first fitting one; an occupied slot swaps back into the backpack)
export function equip(run, bi, slot = null) {
  const inst = run.backpack[bi]; if (!inst) return false;
  const ok = slotsFor(run, inst.id); if (!ok.length) return false;
  const s = slot && ok.includes(slot) ? slot : ok.find((x) => !run.equip[x]) || ok[0];
  const old = run.equip[s];
  run.backpack.splice(bi, 1); run.equip[s] = inst; if (old) run.backpack.push(old);
  noteSets(run); return s;
}
export function unequip(run, slot) { const inst = run.equip[slot]; if (!inst) return false; run.equip[slot] = null; run.backpack.push(inst); return true; }
export function setProgress(run) {
  const on = new Set(equippedIds(run));
  return Object.values(SETS).map((S) => ({ set: S, have: S.pieces.filter((p) => on.has(p)).length, need: S.pieces.length, active: S.pieces.every((p) => on.has(p)) }));
}
export const activeSets = (run) => setProgress(run).filter((x) => x.active).map((x) => x.set);
function noteSets(run) { for (const S of activeSets(run)) if (!run.stats.setsDone.includes(S.id)) run.stats.setsDone.push(S.id); }
export function heroStats(run) {
  const t = { att: 0, def: 0, pow: 0, luck: 0, morale: 0 };
  for (const id of equippedIds(run)) for (const [k, v] of Object.entries(ARTIFACTS[id].stats || {})) t[k] += v;
  return t;
}
export const sellPrice = (id) => Math.round(TUNE.value[ARTIFACTS[id].rarity] / 2);
export function buyPrice(run, id, black = false) {
  let p = TUNE.value[ARTIFACTS[id].rarity] * (black ? 1.5 : 1);
  if (run.diff >= 4) p *= 1.25;
  if (run.perks?.haggler) p *= 0.9;
  return Math.round(p / 50) * 50;
}
// the artifact pool: unlocked factions only, not already owned
export function artifactPool(run, meta, { rarity = null, exclude = [] } = {}) {
  const facs = meta?.unlocks?.factions || ['haven'], own = new Set([...equippedIds(run), ...run.backpack.map((b) => b.id), ...exclude]);
  return Object.values(ARTIFACTS).filter((a) => (!a.fac || facs.includes(a.fac) || a.fac === run.fac) && !own.has(a.id) && (!rarity || a.rarity === rarity));
}
export function rollArtifact(run, tag, meta = null, { rarity = null, rarityW = TUNE.rarityW, exclude = [] } = {}) {
  const r = typeof tag === 'function' ? tag : rngFor(run, `art:${tag}`);
  const rar = rarity || pickW(r, rarityW);
  let pool = artifactPool(run, meta, { rarity: rar, exclude });
  if (!pool.length) pool = artifactPool(run, meta, { exclude });
  return pool.length ? pick(r, pool).id : null;
}
// region-scaled rarity: deeper regions hold rarer things
const rarityFor = (region) => ({ treasure: Math.max(10, 50 - 15 * (region - 1)), minor: 33, major: 14 + 6 * (region - 1), relic: 3 + 2 * (region - 1) });

// ---- threats: Legendary Heroes (per region) and the weekly invasions
export function guardianPower(region, diff = 1) { const G = TUNE.guardian; return G.base * Math.pow(G.growth, region - 1) * G.mult * (1 + TUNE.diffStep * (diff - 1)) * (diff >= 5 ? 1.2 : 1); }
export function invasionPower(w, diff = 1) { const I = TUNE.invasion; return I.base * Math.pow(I.growth * (diff >= 3 ? 1.1 : 1), w - 1) * I.mult * (1 + TUNE.diffStep * (diff - 1)); }
export const threatPower = (n, kind = 'guardian', diff = 1) => (kind === 'invasion' ? invasionPower(n, diff) : guardianPower(n, diff));
const unitPow = (id) => armyPower([[id, 1]]);
// an army of P power from a faction's line-up (tier window by level); hero stats fold into the power
function buildArmy(r, fac, P, level, nStacks, hero) {
  const heroMult = hero ? 1 + (hero.att + hero.def) * 0.05 + hero.pow * 0.03 : 1;
  const maxT = Math.min(7, 2 + level), minT = Math.max(1, level - 1);
  const line = fac === 'neutral' ? NEUTRALS : FACTIONS[fac].units, ups = fac === 'neutral' ? null : UPGRADES[fac];
  const upChance = level >= 6 ? 1 : level >= 3 ? 0.25 * (level - 2) : 0;
  const tiers = []; for (let i = 0; i < nStacks; i++) tiers.push(Math.round(minT + (maxT - minT) * (nStacks === 1 ? 1 : i / (nStacks - 1))));
  const wsum = tiers.reduce((a, t) => a + 0.6 + t * 0.4, 0), army = [];
  for (let t of tiers) {
    const up = !!ups && r() < upChance, share = (0.6 + t * 0.4) / wsum * (0.85 + r() * 0.3);
    let id = up ? ups[t - 1] : line[t - 1];
    while (t > 1 && share * P / heroMult / unitPow(id) < 0.75) { t--; id = up ? ups[t - 1] : line[t - 1]; }
    const n = Math.max(1, Math.round(share * P / heroMult / unitPow(id)));
    const same = army.find((x) => x[0] === id); if (same) same[1] += n; else army.push([id, n]);
  }
  return army;
}
export function guardianArmy(run, region = run.region) {
  const id = run.guardians[region - 1], Gd = GUARDIANS[id], r = rngFor(run, `guardian:${region}`);
  const fac = Gd.fac === 'neutral' ? 'neutral' : Gd.fac, P = guardianPower(region, run.diff);
  const hero = { att: region + 1, def: region + 1, pow: region + 1, know: 2 + region, mana: 10 + 5 * region, skills: {}, spells: region >= 3 ? ['arrow', 'bolt'] : ['arrow'], luck: 0, morale: 0, name: Gd.name, p: -1 };
  const army = buildArmy(r, fac, P, region + 1, Math.min(7, 5 + Math.floor((region - 1) / 2)), hero);
  return { army, hero, fac, guardian: id, region, power: Math.round(armyPower(army, hero)), target: Math.round(P) };
}
// whose banner the invasions fly: the rival crown's faction (falls back to the next guardian's)
export function invasionArmy(run, w, fac = null) {
  const r = rngFor(run, `invasion:${w}`), P = invasionPower(w, run.diff);
  const f = fac || GUARDIANS[run.guardians[Math.min(run.region, run.regions) - 1]]?.fac || 'neutral';
  const ff = f === 'neutral' || !FACTIONS[f] ? 'neutral' : f;
  const hero = { att: w, def: w, pow: w, know: 2 + w, mana: 10 + 5 * w, skills: {}, spells: w >= 3 ? ['arrow'] : [], luck: 0, morale: 0, name: `${FACTIONS[ff]?.name || 'Wild'} Marshal`, p: -1 };
  const army = buildArmy(r, ff, P, Math.min(7, w + 1), Math.min(7, 3 + Math.floor(w / 2)), hero);
  return { army, hero, fac: ff, week: w, power: Math.round(armyPower(army, hero)), target: Math.round(P) };
}
// invasion schedule: warned on day 4 of the week, at your walls at the end of day 7 (Knight difficulty: day 6)
export function invasionDue(run, day) {
  const w = week(day), d = ((day - 1) % 7) + 1;
  return { week: w, warn: d === TUNE.invasion.warnDay, arrive: (w - 1) * 7 + TUNE.invasion.arriveDay - (run.diff >= 2 ? 1 : 0) };
}
export function directionWord(dx, dz) { const a = Math.atan2(-dz, dx) * 180 / Math.PI; return a > -45 && a <= 45 ? 'east' : a > 45 && a <= 135 ? 'north' : a <= -45 && a > -135 ? 'south' : 'west'; }

// ---- battle modifiers for createBattle({ mods }): artifacts (slot order), set bonuses, the Legendary Hero's rule(s),
// the enemy hero, then the run tracker. opts: { guardian: id | null, enemyHero, buildings, fort, gold }
export function battleMods(run, opts = {}) {
  const S = PLAYER, mods = [], x0 = { run, opts, S };
  const st = heroStats(run);
  if (Object.values(st).some(Boolean)) mods.push({ id: 'equip-stats', onBattleStart(B) { const h = B.heroes[S]; if (!h) return; h.att += st.att; h.def += st.def; h.pow += st.pow; h.luck = (h.luck || 0) + st.luck; h.morale = (h.morale || 0) + st.morale; } });
  for (const s of SLOTS) { const inst = run.equip[s]; const A = inst && ARTIFACTS[inst.id]; if (A?.mod) { const m = A.mod({ ...x0, inst }); m.id = A.id; mods.push(m); } }
  for (const S2 of activeSets(run)) if (S2.mod) { const m = S2.mod(x0); m.id = 'set:' + S2.id; mods.push(m); }
  if (opts.enemyHero) { const h = opts.enemyHero; mods.unshift({ id: 'enemyHero', onBattleStart(B) { if (!B.heroes[1 - S]) B.heroes[1 - S] = { ...h, skills: { ...h.skills }, spells: [...h.spells] }; } }); }
  if (opts.guardian && GUARDIANS[opts.guardian]) {
    const rules = [opts.guardian]; if (run.diff >= 7 && run.secondRule?.[opts.guardian]) rules.push(run.secondRule[opts.guardian]);
    const both = equippedIds(run).includes('usurper_crown');
    for (const id of rules) { const m = GUARDIANS[id].mod(S); m.id = 'rule:' + id; mods.push(m); if (both) { const e = GUARDIANS[id].mod(1 - S); e.id = 'rule2:' + id; mods.push(e); } }
  }
  mods.push(tracker(S));
  return mods;
}
function tracker(S) {
  return {
    id: 'tracker',
    onBattleStart(B) { B.crown = { stacksKilled: 0, bestHit: 0 }; },
    onDamage(c, B) { if (!c.preview && c.side === S && B.crown) B.crown.bestHit = Math.max(B.crown.bestHit, Math.round(c.dmg)); },
    onStackDeath(s, k, B) { if (s.side !== S && B.crown) B.crown.stacksKilled++; },
  };
}
// after any battle of the run hero. kind: 'invasion' | 'guardian' | null. Returns { raise, raiseAs, ... } for main.js.
export function afterBattle(run, B, { won, kind = null } = {}) {
  const S = PLAYER;
  const slainLiving = B.stacks.filter((s) => s.side !== S && !s.u.undead).reduce((a, s) => a + (s.start - s.count), 0);
  const res = { won, kind, guardian: kind === 'guardian', slainLiving, raisePct: 0, raise: 0, raiseAs: 'skeleton', losses: 0 };
  for (const s of SLOTS) { const inst = run.equip[s], A = inst && ARTIFACTS[inst.id]; if (A?.after) A.after({ run, inst }, res); }
  for (const S2 of activeSets(run)) if (S2.after) S2.after({ run }, res);
  res.raise = Math.floor(slainLiving * Math.min(0.5, res.raisePct));
  const c = B.crown || { stacksKilled: 0, bestHit: 0 };
  run.stats.stacksKilled += c.stacksKilled; run.stats.bestHit = Math.max(run.stats.bestHit, c.bestHit); run.stats.raised += res.raise;
  res.losses = B.stacks.filter((s) => s.side === S).reduce((a, s) => a + s.start - s.count, 0);
  if (!won) { run.over = true; run.won = false; return res; }
  if (kind === 'invasion') { run.invasionsBeaten++; run.stats.invasions.push(run.invasion?.week || 0); if (!res.losses) run.stats.untouched++; run.invasion = null; }
  if (kind === 'guardian') { const id = run.guardians[run.region - 1]; run.stats.guardians.push(id); if (B.round <= 3) run.stats.fastGuardian = true; }
  return res;
}
// the key from the Keymaster's Tent opens the next region; the last region's tent holds the Crown itself
export function takeKey(run) {
  if (!run.stats.guardians.includes(run.guardians[run.region - 1])) return 'guarded';
  if (run.region >= run.regions) { run.over = true; run.won = true; return 'crown'; }
  run.keys.push(run.region); run.region++; return 'key';
}

// ---- map sites with choices (1 of 3 where natural). Every offer is seeded by the site id, so a reload offers the same.
// ctx: { known: [spells], skills: { id: lvl }, fac, region }
export function chestChoices(run, objId, meta, ctx = {}) {
  const r = rngFor(run, `chest:${objId}`), reg = ctx.region || run.region;
  return [
    { kind: 'gold', n: TUNE.chest.gold + 250 * ((r() * 4) | 0) + 500 * (reg - 1) },
    { kind: 'xp', n: TUNE.chest.xp + 500 * (reg - 1) },
    { kind: 'artifact', id: rollArtifact(run, r, meta, { rarityW: { treasure: 70, minor: 30 } }) },
  ].filter((c) => c.kind !== 'artifact' || c.id);
}
export function pandoraChoices(run, objId, meta, ctx = {}) {
  const r = rngFor(run, `pandora:${objId}`), reg = ctx.region || run.region, out = [];
  const pool = shuffle(r, ['gold', 'xp', 'artifact', 'troops', 'spell']).slice(0, 3);
  for (const k of pool) {
    if (k === 'gold') out.push({ kind: 'gold', n: TUNE.pandora.gold * reg });
    if (k === 'xp') out.push({ kind: 'xp', n: TUNE.pandora.xp * reg });
    if (k === 'artifact') { const id = rollArtifact(run, r, meta, { rarityW: rarityFor(reg + 1) }); if (id) out.push({ kind: 'artifact', id }); }
    if (k === 'spell') { const fresh = Object.keys(SPELLS).filter((s) => !(ctx.known || []).includes(s)); if (fresh.length) out.push({ kind: 'spell', id: pick(r, fresh) }); else out.push({ kind: 'gold', n: TUNE.pandora.gold * reg }); }
    if (k === 'troops') out.push(troopOffer(run, r, reg, ctx.fac || run.fac));
  }
  return out;
}
function troopOffer(run, r, reg, fac) {
  const P = invasionPower(Math.max(1, reg), run.diff) * TUNE.musterShare * 1.5;
  const maxT = Math.min(7, 2 + reg), minT = Math.max(1, reg - 1), t = minT + ((r() * (maxT - minT + 1)) | 0);
  const id = r() < 0.3 ? NEUTRALS[Math.min(6, t - 1)] : reg >= 3 && r() < 0.35 ? UPGRADES[fac][t - 1] : FACTIONS[fac].units[t - 1];
  return { kind: 'troops', id, n: Math.max(1, Math.round(P / unitPow(id))) };
}
export function witchChoices(run, objId, ctx = {}) {
  const r = rngFor(run, `witch:${objId}`), sk = ctx.skills || {};
  const pool = Object.keys(SKILLS).filter((k) => (sk[k] || 0) < 3 && (k !== 'necromancy' || run.fac === 'necro') && ((k in sk) || Object.keys(sk).length < 6));
  return shuffle(r, pool).slice(0, 3).map((id) => ({ kind: 'skill', id, lvl: (sk[id] || 0) + 1 }));
}
export function shrineChoices(run, objId, ctx = {}) {
  const r = rngFor(run, `shrine:${objId}`), fresh = Object.keys(SPELLS).filter((s) => !(ctx.known || []).includes(s));
  return shuffle(r, fresh.length ? fresh : Object.keys(SPELLS)).slice(0, 3).map((id) => ({ kind: 'spell', id }));
}
export function scholarChoices(run, objId, ctx = {}) {
  const r = rngFor(run, `scholar:${objId}`), stat = pick(r, ['att', 'def', 'pow', 'know']);
  return [{ kind: 'stat', id: stat, n: 2 }, ...witchChoices(run, `s${objId}`, ctx).slice(0, 1), ...shrineChoices(run, `s${objId}`, ctx).slice(0, 1)];
}
// the defeated invasion's baggage train: pick 1 of 3 artifacts
export function spoilsChoices(run, w, meta) {
  const r = rngFor(run, `spoils:${w}`), out = [];
  for (let i = 0; i < 3; i++) { const id = rollArtifact(run, r, meta, { rarityW: rarityFor(Math.min(4, 1 + Math.floor(w / 2))), exclude: out.map((c) => c.id) }); if (id) out.push({ kind: 'artifact', id }); }
  return out;
}
// a Seer's Hut asks for resources and pays with a Major artifact
export function seerQuest(run, objId, meta) {
  if (run.quests[objId]) return run.quests[objId];
  const r = rngFor(run, `seer:${objId}`), res = pick(r, ['wood', 'ore', 'gems']);
  const q = { need: { [res]: res === 'gems' ? 8 : 15, gold: 2000 }, reward: rollArtifact(run, r, meta, { rarity: 'major' }), done: false };
  run.quests[objId] = q; return q;
}
// merchants: the stock rotates every week; the Black Market sells rarer goods at a premium
export function merchantStock(run, objId, day, meta, black = false) {
  const w = week(day), r = rngFor(run, `merchant:${objId}:${w}`), out = [];
  const W = black ? { major: 60, relic: 40 } : { treasure: 40, minor: 45, major: 15 };
  for (let i = 0; i < (black ? 2 : 4); i++) { const id = rollArtifact(run, r, meta, { rarityW: W, exclude: out.map((c) => c.id) }); if (id) out.push({ kind: 'artifact', id, price: buyPrice(run, id, black) }); }
  return out;
}
// the Trading Post: fixed HoMM-style rates (gold per unit)
export const TRADE = { wood: { buy: 250, sell: 100 }, ore: { buy: 250, sell: 100 }, gems: { buy: 500, sell: 250 } };
export const buildDiscount = (run) => Math.min(0.5, equippedIds(run).reduce((a, id) => a + (ARTIFACTS[id].build || 0), 0));
export function dailyIncome(run) {
  const t = { gold: run.originFx.daily || 0, wood: 0, ore: 0 };
  for (const id of equippedIds(run)) { const d = ARTIFACTS[id].daily?.(); if (d) for (const k in d) t[k] += d[k]; }
  if (run.forge) t.gold += 1000;
  return t;
}
// the Grail (one per run): rebuilt in your capital as the Crown Forge
export const buildsPerDay = (run) => (run.forge ? 2 : 1);
export const growthMul = (run) => (run.forge ? 1.5 : 1) * (run.diff >= 6 ? 0.75 : 1);

// ---- scoring and the end of the run
export function scoreRun(run, { armyPower: ap = 0, gold = 0 } = {}) {
  const rows = [];
  rows.push({ k: 'guardians', label: 'Legendary Heroes defeated', n: run.stats.guardians.reduce((a, g, i) => a + 600 * (i + 1), 0) });
  rows.push({ k: 'invasions', label: 'Invasions repelled', n: run.stats.invasions.reduce((a, w) => a + 200 * Math.max(1, w), 0) });
  rows.push({ k: 'sets', label: 'Artifact sets completed', n: 300 * run.stats.setsDone.length });
  rows.push({ k: 'treasury', label: 'Gold in the treasury', n: Math.floor(gold / 100) });
  rows.push({ k: 'army', label: 'Army strength', n: Math.floor(ap / 50) });
  if (run.won) rows.push({ k: 'win', label: 'The Crown is yours', n: 1500 });
  const sub = rows.reduce((a, r) => a + r.n, 0), mult = 1 + 0.25 * (run.diff - 1);
  const score = Math.round(sub * mult);
  const glory = Math.floor(score / 100) + 5 * run.stats.guardians.length + (run.won ? 20 : 0);
  return { rows, sub, mult, score, glory };
}
export function endRun(run, meta, { armyPower: ap = 0, gold = 0 } = {}) {
  const S = scoreRun(run, { armyPower: ap, gold }), unlocks = [], trophies = [];
  meta.runs++; if (run.won) meta.wins++;
  meta.glory += S.glory;
  const best = S.score > meta.best.score; if (best) meta.best.score = S.score;
  meta.best.region = Math.max(meta.best.region, run.region);
  for (const g of run.stats.guardians) meta.collection.guardians[g] = 1;
  const unlockFac = (f) => { if (!meta.unlocks.factions.includes(f)) { meta.unlocks.factions.push(f); unlocks.push({ kind: 'faction', id: f, name: FACTIONS[f].name }); } };
  const unlockBg = (o) => { if (!meta.unlocks.backgrounds.includes(o)) { meta.unlocks.backgrounds.push(o); unlocks.push({ kind: 'background', id: o, name: BACKGROUNDS[o].name }); } };
  if (run.stats.guardians.includes('lich_queen')) { unlockFac('necro'); unlockBg('gravecaller'); }
  if (run.won) { unlockFac('sylvan'); unlockBg('scholar'); const st = meta.unlocks.diffs[run.fac] || 1; if (run.diff >= st && run.diff < 8) { meta.unlocks.diffs[run.fac] = run.diff + 1; unlocks.push({ kind: 'diff', id: run.diff + 1, name: `${DIFFS[run.diff + 1].name} difficulty` }); } }
  if (run.stats.fastGuardian) unlockFac('inferno');
  if (run.stats.setsDone.length) unlockFac('dungeon');
  if (run.stats.guardians.includes('wall')) unlockBg('siegelord');
  const award = (id, ok) => { if (ok && !meta.trophies.includes(id)) { meta.trophies.push(id); trophies.push(id); } };
  award('first_blood', run.invasionsBeaten > 0); award('crowned', run.won); award('hoarder', gold >= 50000); award('full_set', run.stats.setsDone.length > 0);
  award('bone_lord', run.stats.raised >= 100); award('untouchable', run.stats.untouched > 0); award('big_hit', run.stats.bestHit >= 1000); award('collector', discoveredCount(meta) >= 30);
  return { ...S, best, unlocks, trophies };
}
export const artifactText = (id) => ARTIFACTS[id].text;
