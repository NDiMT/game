// =====================================================================
// ORBIS · Crown Run: the roguelite layer (agent "crown"), told entirely in Heroes terms. Pure data and rules:
// no DOM, no THREE, so it runs in node (dev/crown_test.mjs). Design: dev/CROWN_RUN.md.
//   - one hero, one full map, permadeath; regions behind Border Guards, each opened by the key its Legendary Hero guards
//   - artifacts in equipment slots (paper doll) drive the battle modifiers; complete ARTIFACT SETS for set bonuses
//   - weekly invasions march on your capital, stronger every week
//   - map sites with choices: Pandora's Box, Witch Hut, Scholar, Shrine, Treasure Chest, Seer's Hut, merchants
// main.js owns the screens and the map; it calls in here for every rule.
// =====================================================================
import { UNITS, FACTIONS, UPGRADES, NEUTRALS, SPELLS, SKILLS } from './data.js?v=2.7';
import { armyPower, harm, alive } from './battle.js?v=2.7';

// ---------------------------------------------------------------- balance levers (CROWN_RUN.md "Balance levers")
export const TUNE = {
  regions: 3, regionsFull: 6,
  guardian: { base: 1500, growth: 2.3, mult: 2.2 },     // Legendary Hero of region r: base · growth^(r−1) · mult
  invasion: { base: 1500, growth: 1.9, mult: 1.45, warnDay: 4, arriveDay: 7 }, // week w: base · growth^(w−1) · mult
  diffStep: 0.08,
  // v2.8 (crown2): artifacts are scarcer and pricier. Merchants sell at value (Black Market ×1.6), buy at half.
  value: { treasure: 800, minor: 2400, major: 6000, relic: 12000 },
  rarityW: { treasure: 58, minor: 31, major: 9, relic: 2 },
  blackMul: 1.6,
  chest: { gold: 1500, xp: 1200, artChance: 0.35 }, pandora: { gold: 4000, xp: 3000, w: { gold: 3, xp: 3, troops: 2, spell: 2, artifact: 1 } },
  mythic: { minDiff: 3, chance: 0.3, chanceHigh: 0.6, highDiff: 6, power: 1.15 }, // a Mythic Legendary Hero may guard the last region
  unlocksPerRun: 1, // meta pacing: at most one new unlock at the end of a run, plus (after a win) the next difficulty tier
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
  haven_seal: { name: 'Seal of the Lightbringer', icon: 'bless', slot: 'misc', rarity: 'major', fac: 'haven', text: 'Haven stacks +2 Defence; Haven fliers heal fully every round.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.fac === 'haven') { u.def += 2; if (u.fly) u.regen = true; } } }) },
  black_grimoire: { name: 'Black Grimoire', icon: 'necromancy', slot: 'misc', rarity: 'major', fac: 'necro', text: 'Necropolis stacks +1 speed and +2 Attack. After each battle won, raise 10% of the slain living foes.',
    mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.fac === 'necro') { u.spd += 1; u.att += 2; } } }), after: (x, res) => { if (res.won) res.raisePct += 0.1; } },

  // ---- v2.8 (crown2): the wider pool. Treasure: small, cheap, specific.
  iron_cap: { name: 'Iron Cap', icon: 'helm', slot: 'head', rarity: 'treasure', stats: { def: 1 }, text: '+1 Defence. Your tier 1 stacks +2 Defence.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier === 1) u.def += 2; } }) },
  bronze_buckler: { name: 'Bronze Buckler', icon: 'shield', slot: 'shield', rarity: 'treasure', text: 'Your stacks take −10% damage from shots.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.d, S) && c.ranged) c.dmg *= 0.9; } }) },
  traveler_boots: { name: "Traveller's Boots", icon: 'boots', slot: 'feet', rarity: 'treasure', text: 'Your tier 1–3 stacks +1 speed.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier <= 3) u.spd += 1; } }) },
  militia_horn: { name: 'Militia Horn', icon: 'banner', slot: 'misc', rarity: 'treasure', text: 'Your tier 1 stacks +2 Attack.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier === 1) u.att += 2; } }) },
  leather_jerkin: { name: 'Leather Jerkin', icon: 'armorer', slot: 'torso', rarity: 'treasure', text: 'Your tier 1–2 creatures +2 hit points.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier <= 2) u.hp += 2; } }) },
  hunting_knife: { name: "Hunter's Knife", icon: 'blade', slot: 'weapon', rarity: 'treasure', stats: { att: 1 }, text: '+1 Attack. Your stacks deal ×1.25 against neutral creatures.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.d?.u.fac === 'neutral') c.dmg *= 1.25; } }) },
  ward_amulet: { name: 'Ward Amulet', icon: 'cloak', slot: 'neck', rarity: 'treasure', text: 'Enemy spells deal −35% damage to your stacks.', mod: ({ S }) => ({ onDamage(c) { if (c.spell && c.side !== S && mine(c.d, S)) c.dmg *= 0.65; } }) },
  spyglass: { name: "Scout's Spyglass", icon: 'scouting', slot: 'misc', rarity: 'treasure', text: 'Your shooters +2 shots.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.ranged) u.ranged += 2; } }) },
  woodcutter_charm: { name: "Woodcutter's Charm", icon: 'wood', slot: 'misc', rarity: 'treasure', text: '+2 wood every day.', daily: () => ({ wood: 2 }) },
  copper_band: { name: 'Copper Band', icon: 'ring', slot: 'ring', rarity: 'treasure', stats: { def: 1 }, text: '+1 Defence. +100 gold every day.', daily: () => ({ gold: 100 }) },
  // Minor: build pieces
  spiked_shield: { name: 'Spiked Shield', icon: 'shield', slot: 'shield', rarity: 'minor', text: 'Your retaliation strikes +2 damage per creature.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.retal) c.dmg += 2 * c.a.count; } }) },
  adept_circlet: { name: 'Circlet of the Adept', icon: 'helm', slot: 'head', rarity: 'minor', stats: { pow: 2 }, text: '+2 Power. Your hero starts every battle with +5 mana.', mod: ({ S }) => ({ onBattleStart(B) { const h = B.heroes[S]; if (h) h.mana = (h.mana || 0) + 5; } }) },
  swift_ring: { name: 'Ring of Swiftness', icon: 'ring', slot: 'ring', rarity: 'minor', text: 'Your stacks with speed 6 or more +1 speed and +1 Attack.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.spd >= 6) { u.spd += 1; u.att += 1; } } }) },
  phoenix_feather: { name: 'Phoenix Feather', icon: 'fly', slot: 'misc', rarity: 'minor', text: 'Your fliers heal their top creature every round.', mod: ({ S }) => ({ onRoundStart(B) { for (const s of alive(B, S)) if (s.u.fly) s.hp = s.u.hp; } }) },
  bandit_mask: { name: "Bandit's Mask", icon: 'gold', slot: 'head', rarity: 'minor', text: 'Each battle won pays 150 gold per enemy stack destroyed.', after: (x, res) => { if (res.won) res.gold += 150 * res.killedStacks; } },
  tower_shield: { name: 'Tower Shield', icon: 'defense', slot: 'shield', rarity: 'minor', text: 'Your stacks take −25% damage from shots.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.d, S) && c.ranged) c.dmg *= 0.75; } }) },
  charge_horn: { name: 'Horn of the Charge', icon: 'movement', slot: 'misc', rarity: 'minor', text: 'Your stacks with speed 7 or more deal ×1.25 damage.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.a.u.spd >= 7) c.dmg *= 1.25; } }) },
  legion_mail: { name: 'Chainmail of the Legion', icon: 'armorer', slot: 'torso', rarity: 'minor', stats: { def: 1 }, text: '+1 Defence. Your tier 1–3 stacks take −12% damage.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.d, S) && c.d.u.tier <= 3) c.dmg *= 0.88; } }) },
  blood_ring: { name: 'Ring of Blood', icon: 'ring', slot: 'ring', rarity: 'minor', text: 'Your tier 1–2 stacks drain life: they heal from the damage they deal.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier <= 2) u.drain = true; } }) },
  sun_amulet: { name: 'Amulet of the Sun', icon: 'bless', slot: 'neck', rarity: 'minor', text: 'Your stacks deal ×1.35 against undead.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.d?.u.undead) c.dmg *= 1.35; } }) },
  trollskin: { name: 'Trollskin Cloak', icon: 'cloak', slot: 'neck', rarity: 'minor', text: 'Your largest stack regenerates: it heals fully every round.',
    mod: ({ S }) => ({ onBattleStart(B) { const s = B.stacks.filter((x) => x.side === S).sort((a, b) => b.count * b.u.hp - a.count * a.u.hp)[0]; if (s) s.u.regen = true; } }) },
  parry_bracer: { name: "Duellist's Bracer", icon: 'defend', slot: 'misc', rarity: 'minor', text: 'Your stacks take −30% damage from retaliation.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.d, S) && c.retal) c.dmg *= 0.7; } }) },
  eagle_lens: { name: 'Eagle-eye Lens', icon: 'archery', slot: 'misc', rarity: 'minor', text: 'Your shooters +2 Attack and fight in melee without penalty.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.ranged) { u.att += 2; u.noMeleePenalty = true; } } }) },
  battle_standard: { name: 'Battle Standard', icon: 'banner', slot: 'misc', rarity: 'minor', stats: { att: 1, morale: 1 }, text: '+1 Attack and +1 Morale.' },
  merchant_scales: { name: "Merchant's Scales", icon: 'market', slot: 'misc', rarity: 'minor', text: 'Merchants buy your artifacts at 75% of their worth instead of half.' },
  prospector_ring: { name: "Prospector's Ring", icon: 'gems', slot: 'ring', rarity: 'minor', text: '+1 ore and +1 gem every day.', daily: () => ({ ore: 1, gems: 1 }) },
  // Major: rule benders and trade-offs
  dragonscale: { name: 'Dragonscale Armour', icon: 'armorer', slot: 'torso', rarity: 'major', text: 'Your stacks take −25% damage from tier 6–7 attackers.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.d, S) && c.a && c.a.u.tier >= 6) c.dmg *= 0.75; } }) },
  giant_slayer: { name: 'Giant-slayer Blade', icon: 'sword', slot: 'weapon', rarity: 'major', text: 'Your stacks deal ×1.5 against tier 5–7 stacks.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.d && c.d.u.tier >= 5) c.dmg *= 1.5; } }) },
  horde_banner: { name: 'Banner of the Horde', icon: 'army', slot: 'misc', rarity: 'major', text: 'Your tier 1–2 stacks deal ×1.5, but your tier 5–7 stacks deal ×0.8.', mod: ({ S }) => ({ onDamage(c) { if (!mine(c.a, S)) return; if (c.a.u.tier <= 2) c.dmg *= 1.5; else if (c.a.u.tier >= 5) c.dmg *= 0.8; } }) },
  thorn_crown: { name: 'Crown of Thorns', icon: 'crown', slot: 'head', rarity: 'major', stats: { att: 5 }, text: '+5 Attack, but your stacks take ×1.2 damage.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.d, S) && !c.spell) c.dmg *= 1.2; } }) },
  mirror_shield: { name: 'Mirror Shield', icon: 'shield', slot: 'shield', rarity: 'major', text: 'Enemy spells deal −50% damage to your stacks, and enemy shots −20%.', mod: ({ S }) => ({ onDamage(c) { if (!mine(c.d, S) || c.side === S) return; if (c.spell) c.dmg *= 0.5; else if (c.ranged) c.dmg *= 0.8; } }) },
  second_wind: { name: 'Horn of the Second Wind', icon: 'morale', slot: 'misc', rarity: 'major', text: 'From round 3 on, your stacks deal ×1.35.', mod: ({ S }) => ({ onDamage(c, B) { if (mine(c.a, S) && B.round >= 3) c.dmg *= 1.35; } }) },
  vanguard_boots: { name: 'Boots of the Vanguard', icon: 'boots', slot: 'feet', rarity: 'major', text: 'Your stacks +2 speed, but −2 Defence.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S) { u.spd += 2; u.def = Math.max(0, u.def - 2); } } }) },
  ruin_grimoire: { name: 'Grimoire of Ruin', icon: 'tome', slot: 'misc', rarity: 'major', text: "Your hero's spells deal ×1.5.", mod: ({ S }) => ({ onDamage(c) { if (c.spell && c.side === S) c.dmg *= 1.5; } }) },
  storm_staff: { name: 'Staff of Storms', icon: 'staff', slot: 'weapon', rarity: 'major', stats: { pow: 3 }, text: '+3 Power. Your spells deal ×1.25.', mod: ({ S }) => ({ onDamage(c) { if (c.spell && c.side === S) c.dmg *= 1.25; } }) },
  soul_amulet: { name: 'Soulbinder Amulet', icon: 'necromancy', slot: 'neck', rarity: 'major', text: 'After each battle won, raise 15% of the slain living foes as skeletons.', after: (x, res) => { if (res.won) res.raisePct += 0.15; } },
  conquest_ring: { name: 'Ring of Conquest', icon: 'ring', slot: 'ring', rarity: 'major', text: 'Your stacks deal +2% per invasion repelled and +6% per Legendary Hero defeated this run.',
    mod: ({ S, run }) => { const m = 1 + 0.02 * run.stats.invasions.length + 0.06 * run.stats.guardians.length; return { onDamage(c) { if (mine(c.a, S)) c.dmg *= m; } }; } },
  twin_axes: { name: 'Twin Axes of Gorr', icon: 'axe', slot: 'weapon', rarity: 'major', text: 'Your tier 1–3 walkers strike twice, at ×0.65 damage per strike.',
    mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier <= 3 && !u.ranged && !u.fly && !u.double) { u.double = true; u.twinAxes = true; } }, onDamage(c) { if (mine(c.a, S) && c.a.u.twinAxes && c.melee && !c.retal) c.dmg *= 0.65; } }) },
  bastion_aegis: { name: 'Aegis of the Bastion', icon: 'defense', slot: 'shield', rarity: 'major', stats: { def: 2 }, text: '+2 Defence. Your stacks take −40% damage while they defend.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.d, S) && c.d.defending) c.dmg *= 0.6; } }) },
  bloodlust_ring: { name: 'Ring of Bloodlust', icon: 'ring', slot: 'ring', rarity: 'major', grows: true, text: 'Your stacks deal +4% per battle won while you wear it (max +40%).',
    mod: ({ S, inst }) => ({ onDamage(c) { if (mine(c.a, S)) c.dmg *= 1 + Math.min(0.4, 0.04 * (inst.n || 0)); } }), after: ({ inst }, res) => { if (res.won) inst.n = (inst.n || 0) + 1; } },
  // Relics: rare, run-defining
  dawn_sword: { name: 'Sword of the Dawn', icon: 'sword', slot: 'weapon', rarity: 'relic', stats: { att: 6 }, text: '+6 Attack. Your stacks deal ×1.25 in rounds 1 and 2.', mod: ({ S }) => ({ onDamage(c, B) { if (mine(c.a, S) && B.round <= 2) c.dmg *= 1.25; } }) },
  damned_armour: { name: 'Armour of the Damned', icon: 'skull', slot: 'torso', rarity: 'relic', text: 'At the start of every round, every enemy stack loses 5% of its creatures.',
    mod: ({ S }) => ({ onRoundStart(B) { burn(B, alive(B, 1 - S), (s) => s.count * 0.05 * s.u.hp, S, 'skull', 'Damned'); } }) },
  angel_wings: { name: 'Angel Feather Wings', icon: 'fly', slot: 'neck', rarity: 'relic', text: 'All your stacks fly; your fliers +2 speed.', mod: ({ S }) => ({ stats(u, i) { if (i.side !== S) return; if (u.fly) u.spd += 2; u.fly = true; } }) },
  inhibition_orb: { name: 'Orb of Inhibition', icon: 'orb', slot: 'misc', rarity: 'relic', text: 'No hero can cast spells in your battles. Your stacks +2 Defence.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S) u.def += 2; }, onRoundStart(B) { B.cast[0] = true; B.cast[1] = true; } }) },
  life_ring: { name: 'Ring of Life Eternal', icon: 'heart', slot: 'ring', rarity: 'relic', text: 'Your stacks heal fully every round.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S) u.regen = true; } }) },
  cornucopia: { name: 'Cornucopia', icon: 'treasure', slot: 'misc', rarity: 'relic', text: '+1,000 gold, +2 wood, +2 ore and +1 gem every day.', daily: () => ({ gold: 1000, wood: 2, ore: 2, gems: 1 }) },
  heavens_helm: { name: 'Helm of Heavenly Light', icon: 'helm', slot: 'head', rarity: 'relic', stats: { att: 4, def: 4, pow: 4, luck: 1, morale: 1 }, text: '+4 Attack, Defence and Power; +1 Luck and Morale.' },
  // the Archmage's Regalia (set)
  archmage_hat: { name: "Archmage's Hat", icon: 'magic', slot: 'head', rarity: 'minor', set: 'archmage', stats: { pow: 2 }, text: '+2 Power. Your spells deal ×1.1.', mod: ({ S }) => ({ onDamage(c) { if (c.spell && c.side === S) c.dmg *= 1.1; } }) },
  magi_robe: { name: 'Robe of the Magi', icon: 'cloak', slot: 'torso', rarity: 'major', set: 'archmage', stats: { def: 1 }, text: '+1 Defence. Your spells deal ×1.3.', mod: ({ S }) => ({ onDamage(c) { if (c.spell && c.side === S) c.dmg *= 1.3; } }) },
  storm_wand: { name: 'Wand of Storms', icon: 'bolt', slot: 'weapon', rarity: 'minor', set: 'archmage', stats: { pow: 1 }, text: '+1 Power. Magic Arrow and Lightning Bolt deal ×1.5.', mod: ({ S }) => ({ onDamage(c) { if (c.side === S && (c.spell === 'arrow' || c.spell === 'bolt')) c.dmg *= 1.5; } }) },
  // the Hellforged Arms (set)
  hellfire_blade: { name: 'Hellfire Blade', icon: 'fireball', slot: 'weapon', rarity: 'major', set: 'hellforged', text: 'Your melee strikes deal ×1.2; ×1.5 against Haven and Sylvan stacks.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.melee) c.dmg *= c.d && (c.d.u.fac === 'haven' || c.d.u.fac === 'sylvan') ? 1.5 : 1.2; } }) },
  brimstone_plate: { name: 'Brimstone Plate', icon: 'armorer', slot: 'torso', rarity: 'minor', set: 'hellforged', text: 'Your stacks take −15% damage in melee.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.d, S) && c.melee) c.dmg *= 0.85; } }) },
  cinder_boots: { name: 'Cinder Boots', icon: 'boots', slot: 'feet', rarity: 'minor', set: 'hellforged', text: 'Your stacks +1 speed; Inferno stacks +2 instead.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S) u.spd += u.fac === 'inferno' ? 2 : 1; } }) },
  // the Titan's Panoply (set)
  titan_helm: { name: "Titan's Helm", icon: 'helm', slot: 'head', rarity: 'minor', set: 'titan', text: 'Your tier 5–7 stacks +3 Defence.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier >= 5) u.def += 3; } }) },
  titan_cuirass: { name: "Titan's Cuirass", icon: 'armorer', slot: 'torso', rarity: 'major', set: 'titan', text: 'Your tier 5–7 creatures +20% hit points.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier >= 5) u.hp = Math.round(u.hp * 1.2); } }) },
  titan_gauntlet: { name: "Titan's Gauntlet", icon: 'attack', slot: 'misc', rarity: 'major', set: 'titan', text: 'Your tier 6–7 stacks +4 Attack.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier >= 6) u.att += 4; } }) },
  // the Gilded Trappings (set)
  coin_ring: { name: 'Ring of the Golden Coin', icon: 'ring', slot: 'ring', rarity: 'treasure', set: 'gilded', text: '+150 gold every day.', daily: () => ({ gold: 150 }) },
  golden_goose: { name: 'Golden Goose', icon: 'gold', slot: 'misc', rarity: 'minor', set: 'gilded', text: '+350 gold every day.', daily: () => ({ gold: 350 }) },
  gilded_ledger: { name: 'Gilded Ledger', icon: 'tome', slot: 'misc', rarity: 'minor', set: 'gilded', text: 'Merchants charge 15% less.' },
  // the Nightstalker's Garb (set)
  shadow_hood: { name: 'Shadow Hood', icon: 'cloak', slot: 'head', rarity: 'minor', set: 'nightstalker', text: 'Your stacks +1 speed.', mod: ({ S }) => ({ stats(u, i) { if (i.side === S) u.spd += 1; } }) },
  venom_dagger: { name: 'Venom Dagger', icon: 'blade', slot: 'weapon', rarity: 'minor', set: 'nightstalker', text: 'Your melee strikes deal ×1.25 against stacks that have not acted yet this round.', mod: ({ S }) => ({ onDamage(c) { if (mine(c.a, S) && c.melee && c.d && !c.d.acted) c.dmg *= 1.25; } }) },
  shadowstep_boots: { name: 'Shadowstep Boots', icon: 'boots', slot: 'feet', rarity: 'major', set: 'nightstalker', text: 'In round 1 your stacks deal ×1.3.', mod: ({ S }) => ({ onDamage(c, B) { if (mine(c.a, S) && B.round === 1) c.dmg *= 1.3; } }) },
};
// damage from outside a strike (an artifact's or a Legendary Hero's effect), one 'mod' event for the renderer
function burn(B, stacks, dmgOf, side, icon, text) {
  const hits = [];
  for (const s of stacks) { if (s.count <= 0) continue; const dmg = Math.max(0, Math.round(dmgOf(s))); if (!dmg) continue; const killed = harm(B, s, dmg, null); hits.push({ s: s.uid, dmg, killed, left: s.count }); if (B.over) break; }
  if (hits.length) B.events.push({ t: 'mod', icon, text, side, hits });
}
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
  archmage: { name: "Archmage's Regalia", icon: 'spellbook', pieces: ['archmage_hat', 'magi_robe', 'storm_wand'], text: 'Your spells deal ×1.5, and your hero starts every battle with +15 mana.',
    mod: ({ S }) => ({ onBattleStart(B) { const h = B.heroes[S]; if (h) h.mana = (h.mana || 0) + 15; }, onDamage(c) { if (c.spell && c.side === S) c.dmg *= 1.5; } }) },
  hellforged: { name: 'Hellforged Arms', icon: 'fireball', pieces: ['hellfire_blade', 'brimstone_plate', 'cinder_boots'], text: 'Hellfire: at the start of every round, every enemy stack burns for 4% of its hit points.',
    mod: ({ S }) => ({ onRoundStart(B) { burn(B, alive(B, 1 - S), (s) => ((s.count - 1) * s.u.hp + s.hp) * 0.04, S, 'fireball', 'Hellfire'); } }) },
  titan: { name: "Titan's Panoply", icon: 'attack', pieces: ['titan_helm', 'titan_cuirass', 'titan_gauntlet'], text: 'Colossus: your tier 5–7 stacks deal ×1.3 and retaliate twice.',
    mod: ({ S }) => ({ stats(u, i) { if (i.side === S && u.tier >= 5) u.twoRetal = true; }, onDamage(c) { if (mine(c.a, S) && c.a.u.tier >= 5) c.dmg *= 1.3; } }) },
  gilded: { name: 'Gilded Trappings', icon: 'gold', pieces: ['coin_ring', 'golden_goose', 'gilded_ledger'], text: 'Midas: +1,000 gold every day, and your stacks deal +1% per 2,000 gold in your treasury (max +30%).',
    daily: () => ({ gold: 1000 }), mod: ({ S, opts }) => ({ onDamage(c) { if (mine(c.a, S)) c.dmg *= 1 + Math.min(0.3, (opts.gold || 0) / 200000); } }) },
  nightstalker: { name: "Nightstalker's Garb", icon: 'cloak', pieces: ['shadow_hood', 'venom_dagger', 'shadowstep_boots'], text: 'Ambush: in round 1 your stacks +2 speed and their strikes cannot be retaliated.',
    mod: ({ S }) => { const was = new Map(); return {
      stats(u, i) { if (i.side === S) { u.spd += 2; was.set(u, !!u.noRetal); u.noRetal = true; } },
      onRoundStart(B) { if (B.round !== 2) return; for (const s of B.stacks) if (s.side === S && was.has(s.u)) { s.u.noRetal = was.get(s.u); s.u.spd = Math.max(1, s.u.spd - 2); } },
    }; } },
};
for (const [id, s] of Object.entries(SETS)) s.id = id;

// ---------------------------------------------------------------- Legendary Heroes (region guardians) with special rules
// rule(T) builds the battle hook for the victim side T (the player). v2.8 (crown2): a pool of 24, drawn per run.
//   tier 1-3: which region band draws them (region r of n draws tier ceil(3r/n)); mythic: only for the last region at
//   higher difficulty (TUNE.mythic). units: the themed army (by tier; buildArmy keeps to the region's tier window).
//   look: the portrait brief for the icons agent. powMul: army power scale (rules that are themselves big buffs get less).
//   lead: a signature stack (a dragon, a devil…) that joins the army whatever the tier window; the rest shares what is left.
const ward = () => false;
const foesOf = (B, T) => alive(B, 1 - T);
export const GUARDIANS = {
  // ---- tier 1 (region 1)
  wall: { name: 'Gorrak the Wall', title: 'Ogre Warlord', icon: 'fort', fac: 'neutral', tier: 1, units: ['goblin', 'orc', 'ogre', 'troll'], powMul: 0.7,
    look: 'a hulking grey-skinned ogre in riveted iron plate behind a tower shield as tall as a door',
    rule: 'Shieldwall: your shooters cannot shoot.', mod: (T) => ({ canShoot(B, s, ok) { return s.side === T && !ward(s) ? false : ok; } }) },
  silence: { name: 'Sorceress Ilvane', title: 'Warlock of Dungeon', icon: 'spellbook', fac: 'dungeon', tier: 1, units: ['troglodyte', 'harpy', 'beholder', 'medusa'],
    look: 'a pale dark-elf sorceress with a finger to her lips, violet runes sealing a floating spellbook',
    rule: 'Silence: your hero cannot cast spells.', mod: (T) => ({ onRoundStart(B) { B.cast[T] = true; } }) },
  gale: { name: 'Windcaller Aelis', title: 'Druid of Sylvan', icon: 'fly', fac: 'sylvan', tier: 1, units: ['centaur', 'woodelf', 'pegasus', 'dendroid'], powMul: 1.15,
    look: 'a young elven druid in green robes, hair whipped by a gale, staff wrapped in swirling leaves',
    rule: 'Gale: your fliers are grounded.', mod: (T) => ({ stats(u, i) { if (i.side === T) u.fly = false; } }) },
  goblin_king: { name: 'Skrag the Goblin King', title: 'Lord of the Warrens', icon: 'crown', fac: 'neutral', tier: 1, units: ['goblin', 'wolf', 'orc'], powMul: 0.75,
    look: 'a scrawny grinning goblin on a throne of junk, oversized dented crown, a crowd of goblins behind',
    rule: 'Swarm: his tier 1–2 stacks are half again as large.', mod: (T) => ({ onBattleStart(B) { for (const s of B.stacks) if (s.side !== T && s.u.tier <= 2) { s.count = Math.round(s.count * 1.5); s.start = s.count; } } }) },
  wolf_mother: { name: 'Fenra Wolfmother', title: 'Huntress of the Wilds', icon: 'movement', fac: 'neutral', tier: 1, units: ['goblin', 'wolf', 'centaur', 'woodelf'],
    look: 'a wild-haired huntress in a wolf-pelt hood, bone spear, a great grey wolf at her side',
    rule: 'Pack Hunt: her stacks deal ×1.3 to a stack already struck this round.',
    mod: (T) => { const hit = new Set(); let rd = 0; return { onDamage(c, B) { if (B.round !== rd) { rd = B.round; hit.clear(); } if (!c.a || c.a.side === T || !c.d || c.d.side !== T) return; if (hit.has(c.d.uid)) c.dmg *= 1.3; else if (!c.preview) hit.add(c.d.uid); } }; } },
  pikemaster: { name: 'Captain Odric Vale', title: 'Pikemaster of Haven', icon: 'defense', fac: 'haven', tier: 1, units: ['pikeman', 'halberdier', 'archer', 'swordsman'],
    look: 'a grizzled human captain in blue-and-silver plate, a long pike planted, a wall of shields behind',
    rule: 'Phalanx: his stacks +4 Defence, and his first-slot stack takes −50% damage.',
    mod: (T) => ({ stats(u, i) { if (i.side !== T) u.def += 4; }, onDamage(c, B) { if (c.d && c.d.side !== T && c.d.slot === firstSlot(B, 1 - T)) c.dmg *= 0.5; } }) },
  bone_tide: { name: 'Mordecai Bonetide', title: 'Gravelord of Necropolis', icon: 'skull', fac: 'necro', tier: 1, units: ['skeleton', 'zombie', 'wight', 'skelwarrior'],
    look: 'a gaunt necromancer in tattered black robes, lantern of green soul-fire, skeleton hands rising from the ground',
    rule: 'Grave Chill: your stacks −1 speed and −1 Attack.', mod: (T) => ({ stats(u, i) { if (i.side === T) { u.spd = Math.max(1, u.spd - 1); u.att = Math.max(0, u.att - 1); } } }) },
  // ---- tier 2 (the middle regions)
  plague: { name: 'Malphas the Plaguebringer', title: 'Pit Lord of Inferno', icon: 'defeat', fac: 'inferno', tier: 2, units: ['familiar', 'demon', 'horneddemon', 'efreet'], powMul: 1.15,
    look: 'a horned pit lord wreathed in sickly green smoke, a rusted scythe, flies around him',
    rule: 'Plague: your first stack starts the battle with 30% fewer creatures.', mod: (T) => ({ onBattleStart(B) {
      const s = B.stacks.filter((x) => x.side === T).sort((a, b) => a.slot - b.slot)[0]; if (!s) return;
      const n = Math.max(1, Math.ceil(s.count * 0.7)), lost = s.count - n; s.count = n;
      if (lost) B.events.push({ t: 'mod', icon: 'defeat', text: `Plague −${lost}`, side: 1 - T, s: s.uid, hits: [{ s: s.uid, dmg: lost * s.u.hp, killed: lost, left: n }] });
    } }) },
  hunger: { name: 'Krug the Endless', title: 'Troll Chieftain', icon: 'hp', fac: 'neutral', tier: 2, units: ['wolf', 'orc', 'ogre', 'troll'], powMul: 1.25,
    look: 'a towering green troll chieftain with a tree-trunk club, wounds visibly closing, tusks and war paint',
    rule: 'Regeneration: his stacks heal fully every round.', mod: (T) => ({ stats(u, i) { if (i.side !== T) u.regen = true; } }) },
  stampede: { name: 'Khazrak Hellrider', title: 'Demon Knight', icon: 'movement', fac: 'inferno', tier: 2, units: ['hellhound', 'cerberus', 'nightmare', 'hellcharger'], powMul: 0.8,
    look: 'a demon knight in black spiked armour astride a flaming nightmare steed, mid-charge',
    rule: 'Stampede: his stacks +3 speed.', mod: (T) => ({ stats(u, i) { if (i.side !== T) u.spd += 3; } }) },
  iron_hide: { name: 'Sir Brannoc Ironhide', title: 'Fallen Paladin', icon: 'armorer', fac: 'haven', tier: 2, units: ['swordsman', 'crusader', 'monk', 'cavalier'], powMul: 1.25,
    look: 'a fallen paladin in scarred plate, cracked holy symbol on his breastplate, arrows broken against it',
    rule: 'Ironhide: his stacks take −50% damage from your shots.', mod: (T) => ({ onDamage(c) { if (c.ranged && c.a?.side === T && c.d?.side !== T) c.dmg *= 0.5; } }) },
  ember_witch: { name: 'Ashka the Emberwitch', title: 'Pyromancer of Inferno', icon: 'fireball', fac: 'inferno', tier: 2, units: ['imp', 'familiar', 'succubus', 'efreet'], spells: ['fireball'], powMul: 0.75,
    look: 'a red-skinned witch with smouldering hair and ember eyes, a ring of fire in her raised palms',
    rule: 'Firestorm: at the start of rounds 2, 4 and 6, fire burns each of your stacks for 6% of its hit points.',
    mod: (T) => ({ onRoundStart(B) { if (B.round % 2 || B.round > 6) return; burn(B, alive(B, T), (s) => ((s.count - 1) * s.u.hp + s.hp) * 0.06, 1 - T, 'fireball', 'Firestorm'); } }) },
  thornqueen: { name: 'Lysara Thornqueen', title: 'Warden of the Briars', icon: 'luck', fac: 'sylvan', tier: 2, units: ['centaurcpt', 'woodelf', 'dendroid', 'dendroidsoldier'], powMul: 0.85,
    look: 'a regal dryad crowned with thorned roses, bark-skinned arms, vines coiling from the ground',
    rule: 'Entangling Roots: your walkers have speed 1 in rounds 1 and 2.',
    mod: (T) => { const sp = new Map(); return {
      stats(u, i) { if (i.side === T && !u.fly) { sp.set(u, u.spd); u.spd = 1; } },
      onRoundStart(B) { if (B.round !== 3) return; for (const s of B.stacks) if (sp.has(s.u)) s.u.spd = sp.get(s.u); },
    }; } },
  beholder_lord: { name: 'Xyloth the Many-Eyed', title: 'Beholder Overseer', icon: 'sorcery', fac: 'dungeon', tier: 2, units: ['troglodyte', 'beholder', 'evileye', 'medusa'], powMul: 1.1,
    look: 'a huge floating beholder with one great central eye and a crown of eyestalks, stony light from its gaze',
    rule: 'Petrifying Gaze: at the start of every round one of your stacks turns to stone and loses its turn.',
    mod: (T) => ({ onRoundStart(B) { const m = alive(B, T); if (!m.length || !foesOf(B, T).length) return; const s = m[(B.rand() * m.length) | 0]; s.acted = true; B.events.push({ t: 'mod', icon: 'sorcery', text: 'Petrified', side: 1 - T, hits: [{ s: s.uid, dmg: 0, killed: 0, left: s.count }] }); } }) },
  cyclops_lord: { name: 'Grumm One-Eye', title: 'Cyclops Warlord', icon: 'attack', fac: 'neutral', tier: 2, units: ['goblin', 'orc', 'ogre'], lead: ['cyclops', 1],
    look: 'a one-eyed cyclops warlord hefting a boulder overhead, rope belt of skulls, crude iron crown',
    rule: 'Boulders: his shooters throw twice per turn.', mod: (T) => ({ stats(u, i) { if (i.side !== T && u.ranged) u.twoShots = true; } }) },
  // ---- tier 3 (the last region)
  lich_queen: { name: 'Vesperine, the Lich Queen', title: 'Necromancer of the Last Crown', icon: 'necromancy', fac: 'necro', tier: 3, units: ['wight', 'vampire', 'lich', 'powerlich', 'blackknight'], powMul: 1.1,
    look: 'a skeletal queen in a tall black-iron crown and violet gown, glowing eye-sockets, a staff topped with a soul gem',
    rule: 'Lifedrinker: her stacks heal half the damage they deal and raise their dead.', mod: (T) => ({ stats(u, i) { if (i.side !== T) u.drain = true; } }) },
  eclipse: { name: 'Shadowmother Zyra', title: 'Dungeon Overlord', icon: 'end', fac: 'dungeon', tier: 3, units: ['harpyhag', 'medusaqueen', 'minotaur', 'manticore', 'blackdragon'], powMul: 1.1,
    look: 'a dark-elf matriarch in obsidian armour before a black sun, shadow tendrils spreading behind her',
    rule: "Eclipse: your hero's Attack and Defence count as 0.", mod: (T) => ({ onBattleStart(B) { const h = B.heroes[T]; if (h) { h.att = 0; h.def = 0; } } }) },
  minotaur_king: { name: 'Asterion the Labyrinth King', title: 'Minotaur Warlord', icon: 'axe', fac: 'dungeon', tier: 3, units: ['troglodyte', 'harpy', 'minotaur', 'minotaurking', 'manticore'],
    look: 'a massive minotaur king with a gold-ringed horn, double-headed labrys, a stone labyrinth behind',
    rule: 'Bloodrage: his stacks gain +1 Attack every time they are struck (up to +10).',
    mod: (T) => { const n = new Map(); return { onDamage(c) { if (c.preview || !c.d || c.d.side === T) return; const k = n.get(c.d.uid) || 0; if (k < 10) { n.set(c.d.uid, k + 1); c.d.u.att += 1; } } }; } },
  hydra_mother: { name: 'Ssylith Hydra-Mother', title: 'Mistress of the Mire', icon: 'hp', fac: 'neutral', tier: 3, units: ['ogre', 'troll', 'cyclops', 'hydra'],
    look: 'a serpent-bodied naga queen coiled in a swamp, three hydra heads rising behind her',
    rule: 'Many Heads: her stacks retaliate twice, at ×1.5 damage.', mod: (T) => ({ stats(u, i) { if (i.side !== T) u.twoRetal = true; }, onDamage(c) { if (c.retal && c.a && c.a.side !== T) c.dmg *= 1.5; } }) },
  stormcaller: { name: 'Elder Thalion Stormcaller', title: 'Archdruid of Sylvan', icon: 'bolt', fac: 'sylvan', tier: 3, units: ['woodelf', 'grandelf', 'silverpegasus', 'unicorn', 'greendragon'], spells: ['bolt', 'slow'], powMul: 1.2,
    look: 'an ancient elf archdruid with a white beard braided with leaves, lightning arcing from an oak staff, storm clouds',
    rule: 'Chain Lightning: at the start of every round lightning strikes your two largest stacks for 8% of their hit points.',
    mod: (T) => ({ onRoundStart(B) { const m = alive(B, T).sort((a, b) => b.count * b.u.hp - a.count * a.u.hp).slice(0, 2); burn(B, m, (s) => ((s.count - 1) * s.u.hp + s.hp) * 0.08, 1 - T, 'bolt', 'Lightning'); } }) },
  // ---- mythic (the last region, at higher difficulty only)
  dragon_mother: { name: 'Vyrmathra the Dragonmother', title: 'Queen of All Dragons', icon: 'fly', fac: 'neutral', tier: 3, mythic: true, units: ['harpy', 'troll', 'manticore', 'scorpicore'], lead: ['greendragon', 1], powMul: 0.7,
    look: 'a colossal ancient dragon with scales shifting through green, gold, red and black, wings spread over a hoard',
    rule: 'Dragonmother: her stacks are immune to your spells, and her tier 7 creatures +50% hit points.',
    mod: (T) => ({ stats(u, i) { if (i.side !== T && u.tier === 7) u.hp = Math.round(u.hp * 1.5); }, onDamage(c) { if (c.spell && c.side === T && c.d && c.d.side !== T) c.dmg = 0; } }) },
  archdevil: { name: "Baal'zareth the Unbound", title: 'Archdevil of the Pit', icon: 'fireball', fac: 'inferno', tier: 3, mythic: true, powMul: 0.85, units: ['horneddemon', 'efreetsultan', 'nightmare', 'hellcharger'], lead: ['devil', 1],
    look: 'a towering archdevil with curling ram horns and burning wings, a gate of hellfire opening behind him',
    rule: 'Hellgate: at the start of every round his weakest stack is restored to full strength.',
    mod: (T) => ({ onRoundStart(B) { if (B.round < 2) return; const s = alive(B, 1 - T).sort((a, b) => a.count / a.start - b.count / b.start)[0]; if (!s || s.count >= s.start) return; const n = s.start - s.count; s.count = s.start; s.hp = s.u.hp; B.events.push({ t: 'mod', icon: 'fireball', text: `Hellgate +${n}`, side: 1 - T, hits: [{ s: s.uid, dmg: 0, killed: 0, left: s.count }] }); } }) },
  seraphine: { name: 'Seraphine the Fallen', title: 'Archangel Unbound', icon: 'bless', fac: 'haven', tier: 3, mythic: true, units: ['crusader', 'monk', 'zealot', 'angel'], lead: ['champion', 2],
    look: 'a fallen archangel with tarnished gold armour and wings half white, half ash-grey, a flaming sword lowered',
    rule: 'Divine Wrath: your hero cannot cast spells, and her stacks heal fully every round.',
    mod: (T) => ({ stats(u, i) { if (i.side !== T) u.regen = true; }, onRoundStart(B) { B.cast[T] = true; } }) },
  dread_king: { name: 'Morvane the Dread King', title: 'Lord of the Endless Night', icon: 'skull', fac: 'necro', tier: 3, mythic: true, units: ['wraith', 'vampirelord', 'powerlich', 'dreadknight'], lead: ['bonedragon', 1],
    look: 'a spectral king in rusted black plate on a ghostly throne, a crown of cold blue fire, mist pouring from his cloak',
    rule: 'Dread: from round 2, your stacks lose 8% of their creatures at the start of every round.',
    mod: (T) => ({ onRoundStart(B) { if (B.round < 2) return; burn(B, alive(B, T), (s) => s.count * 0.08 * s.u.hp, 1 - T, 'skull', 'Dread'); } }) },
};
for (const [id, b] of Object.entries(GUARDIANS)) b.id = id;
// the region band a Legendary Hero is drawn from: region r of n regions draws tier ceil(3r / n)
export const guardianTier = (region, regions) => Math.min(3, Math.max(1, Math.ceil((3 * region) / regions)));

// ---------------------------------------------------------------- hero backgrounds, difficulty, meta
export const BACKGROUNDS = {
  knight: { name: 'Knight-Errant', icon: 'banner', text: 'A sworn sword. No advantages, no flaws.', start: true },
  merchant: { name: 'Merchant Prince', icon: 'gold', text: 'Starts with +5,000 gold; +250 gold every day.', gold: 5000, daily: 250 },
  warlord: { name: 'Warlord', icon: 'army', text: 'Starting army ×1.5, but one Misc slot fewer.', armyMul: 1.5, lockSlots: ['misc3'] },
  exile: { name: 'Exile', icon: 'defeat', text: 'Half the resources and a smaller army, but carries a Major artifact.', resMul: 0.5, armyMul: 0.8, startArt: 'major' },
  scholar: { name: 'Scholar', icon: 'wisdom', text: 'Mage Guild I built, +2 spells and Wisdom; army ×0.8.', armyMul: 0.8 },
  gravecaller: { name: 'Gravecaller', icon: 'necromancy', text: 'Necropolis only. Starts wearing the Bone Cloak.', fac: 'necro', startArt: 'bone_cloak' },
  siegelord: { name: 'Siegelord', icon: 'fort', text: 'Your capital starts with a Fort.', fort: true },
};
for (const [id, o] of Object.entries(BACKGROUNDS)) o.id = id;
export const DIFFS = [null,
  { name: 'Squire', col: '#f4f4f4', text: 'The standard challenge.' },
  { name: 'Knight', col: '#f0453a', text: 'Invasions march a day faster.' },
  { name: 'Baron', col: '#5bd352', text: 'Invasions grow ×1.1 stronger every week.' },
  { name: 'Count', col: '#3a3a44', text: 'Merchants charge 25% more. Mythic Legendary Heroes may guard the last region.' },
  { name: 'Duke', col: '#4aa8ff', text: 'Legendary Heroes lead 20% larger armies.' },
  { name: 'Prince', col: '#b36bff', text: 'Weekly creature growth −25%.' },
  { name: 'King', col: '#ffa52e', text: 'Legendary Heroes follow two rules.' },
  { name: 'Emperor', col: '#ffd447', text: 'Your starting army is halved.' },
];
export const TROPHIES = {
  first_blood: { name: 'First Blood', icon: 'attack', text: 'Repel an invasion.' },
  crowned: { name: 'Crowned', icon: 'victory', text: 'Win a Crown Run.' },
  hoarder: { name: 'Hoarder', icon: 'gold', text: 'Hold 50,000 gold.' },
  full_set: { name: 'Set Collector', icon: 'artifact', text: 'Complete an artifact set.' },
  bone_lord: { name: 'Bone Lord', icon: 'necromancy', text: 'Raise 100 skeletons in one run.' },
  untouchable: { name: 'Untouchable', icon: 'defense', text: 'Repel an invasion with no losses.' },
  big_hit: { name: 'Big Hit', icon: 'damage', text: 'Deal 1,000+ damage in one strike.' },
  collector: { name: 'Collector', icon: 'chest', text: 'Discover 30 entries.' },
  mythslayer: { name: 'Mythslayer', icon: 'skull', text: 'Defeat a Mythic Legendary Hero.' },
  legend_hunter: { name: 'Legend Hunter', icon: 'hero', text: 'Defeat 15 different Legendary Heroes.' },
};
// Glory perks: bought with Glory (each level costs cost × level); most must first be unlocked (UNLOCKS)
export const PERKS = {
  quartermaster: { name: 'Quartermaster', icon: 'gold', text: '+1,000 gold at the start of a run per level.', cost: 40, max: 3, start: true },
  drillmaster: { name: 'Drillmaster', icon: 'army', text: 'Starting army +10% per level.', cost: 70, max: 2 },
  heirloom: { name: 'Heirloom', icon: 'artifact', text: 'Start every run with a Treasure artifact.', cost: 120, max: 1 },
  haggler: { name: 'Haggler', icon: 'market', text: 'Merchants charge 10% less.', cost: 150, max: 1 },
  tactician: { name: 'Tactician', icon: 'attack', text: 'Your hero +1 Attack and +1 Defence per level.', cost: 180, max: 2 },
  lucky_star: { name: 'Lucky Star', icon: 'luck', text: 'Your hero +1 Luck.', cost: 220, max: 1 },
  architect: { name: 'Architect', icon: 'build', text: 'Buildings in your capital cost 10% less gold.', cost: 250, max: 1 },
  treasure_sense: { name: 'Treasure Sense', icon: 'chest', text: 'Major and Relic artifacts turn up 30% more often.', cost: 300, max: 1 },
};
for (const [id, p] of Object.entries(PERKS)) p.id = id;
export const perkCost = (id, lv) => PERKS[id].cost * (lv + 1);

// ---- unlock pacing (v2.8, crown2). Every unlock needs a goal AND enough Renown (all the Glory ever earned; spending
// Glory on perks never lowers it). At most TUNE.unlocksPerRun (1) new unlock at the end of a run, plus the next difficulty
// tier after a win; the rest wait for later runs, lowest Renown first. Expected pacing: dev/CROWN_RUN.md §6 and dev/crown_sim.mjs.
// L = meta.life (lifetime counters), m = meta.
export const UNLOCKS = [
  { kind: 'background', id: 'merchant', renown: 40, goal: 'End a run holding 8,000 gold or more.', ok: (L) => L.maxGold >= 8000 },
  { kind: 'perk', id: 'drillmaster', renown: 80, goal: 'Repel 3 invasions (over all your runs).', ok: (L) => L.invasions >= 3 },
  { kind: 'faction', id: 'necro', renown: 140, goal: 'Defeat 3 Legendary Heroes (over all your runs).', ok: (L) => L.guardians >= 3 },
  { kind: 'background', id: 'warlord', renown: 210, goal: 'Defeat 2 Legendary Heroes in one run.', ok: (L) => L.bestGuardians >= 2 },
  { kind: 'perk', id: 'heirloom', renown: 280, goal: 'Discover 40 different artifacts.', ok: (L, m) => Object.keys(m.collection.seen).length >= 40 },
  { kind: 'faction', id: 'sylvan', renown: 360, goal: 'Reach region 3.', ok: (L) => L.bestRegion >= 3 },
  { kind: 'background', id: 'gravecaller', renown: 440, goal: 'Play 3 runs as Necropolis.', ok: (L) => (L.facRuns.necro || 0) >= 3 },
  { kind: 'perk', id: 'haggler', renown: 520, goal: 'End a run holding 15,000 gold or more.', ok: (L) => L.maxGold >= 15000 },
  { kind: 'background', id: 'siegelord', renown: 600, goal: 'Have your walls hold against an invasion while your hero is away.', ok: (L) => L.wallsHeld >= 1 },
  { kind: 'faction', id: 'inferno', renown: 700, goal: 'Repel 15 invasions (over all your runs).', ok: (L) => L.invasions >= 15 },
  { kind: 'perk', id: 'tactician', renown: 800, goal: 'Defeat 12 Legendary Heroes (over all your runs).', ok: (L) => L.guardians >= 12 },
  { kind: 'background', id: 'exile', renown: 900, goal: 'Complete an artifact set.', ok: (L) => L.sets >= 1 },
  { kind: 'background', id: 'scholar', renown: 1000, goal: 'Win a Crown Run.', ok: (L) => L.wins >= 1 },
  { kind: 'faction', id: 'dungeon', renown: 1150, goal: 'Win 2 Crown Runs.', ok: (L) => L.wins >= 2 },
  { kind: 'perk', id: 'lucky_star', renown: 1300, goal: 'Complete 3 artifact sets (over all your runs).', ok: (L) => L.sets >= 3 },
  { kind: 'perk', id: 'architect', renown: 1450, goal: 'Win a run at Knight difficulty or higher.', ok: (L) => L.bestWinDiff >= 2 },
  { kind: 'perk', id: 'treasure_sense', renown: 1600, goal: 'Defeat a Mythic Legendary Hero.', ok: (L) => L.mythics >= 1 },
];
// difficulty tier n (per faction) needs a win at tier n−1 with that faction, and this much Renown
export const DIFF_RENOWN = [0, 0, 300, 500, 750, 1000, 1300, 1650, 2000];
const unlockName = (u) => (u.kind === 'faction' ? FACTIONS[u.id].name : u.kind === 'background' ? BACKGROUNDS[u.id].name : u.kind === 'perk' ? `${PERKS[u.id].name} (Glory perk)` : u.name);
for (const u of UNLOCKS) { u.name = unlockName(u); if (u.kind === 'background') BACKGROUNDS[u.id].unlock = `${u.goal} Renown ${u.renown}.`; if (u.kind === 'perk') PERKS[u.id].unlock = `${u.goal} Renown ${u.renown}.`; }
export const FAC_UNLOCK = { haven: { text: 'Available from the start.' } };
for (const u of UNLOCKS) if (u.kind === 'faction') FAC_UNLOCK[u.id] = { text: `${u.goal} Renown ${u.renown}.`, goal: u.goal, renown: u.renown };

export const lifeDefault = () => ({ glory: 0, guardians: 0, invasions: 0, sets: 0, wallsHeld: 0, bestRegion: 0, bestGuardians: 0, maxGold: 0, wins: 0, bestWinDiff: 0, mythics: 0, facRuns: {}, wonAt: {} });
export function metaDefault() {
  return { v: 3, glory: 0, runs: 0, wins: 0, best: { score: 0, region: 0 },
    unlocks: { factions: ['haven'], backgrounds: Object.keys(BACKGROUNDS).filter((k) => BACKGROUNDS[k].start), diffs: { haven: 1 }, perks: Object.keys(PERKS).filter((k) => PERKS[k].start) },
    collection: { artifacts: {}, seen: {}, guardians: {}, units: {} }, trophies: [], perks: {}, life: lifeDefault() };
}
// v2 (≤ v2.7) metas unlocked nearly everything in one run. Keep everything the player already has (no re-locking),
// rebuild the lifetime counters as well as the old save allows, and let the new pacing govern what is still locked.
function migrateV2(m) {
  const oldCost = { quartermaster: 30, drillmaster: 40, haggler: 60, heirloom: 50 };
  const L = lifeDefault(), tr = m.trophies || [], diffs = m.unlocks?.diffs || {};
  L.glory = (m.glory || 0) + Object.entries(m.perks || {}).reduce((a, [id, lv]) => a + (oldCost[id] || 0) * lv, 0);
  L.guardians = Object.keys(m.collection?.guardians || {}).length;
  L.bestRegion = m.best?.region || 0; L.wins = m.wins || 0;
  L.bestGuardians = m.wins ? 3 : Math.min(L.guardians, Math.max(0, L.bestRegion - 1));
  if (tr.includes('first_blood')) L.invasions = Math.max(1, Math.min(L.guardians, 3));
  if (tr.includes('full_set')) L.sets = 1;
  if (tr.includes('hoarder')) L.maxGold = 50000;
  for (const [f, d] of Object.entries(diffs)) if (d > 1) { L.wonAt[f] = d - 1; L.bestWinDiff = Math.max(L.bestWinDiff, d - 1); }
  m.life = L; m.unlocks = { ...m.unlocks, perks: Object.keys(oldCost) }; // every v2 perk was on sale: keep them on sale
  m.v = 3; m.migratedFrom = 2;
  return m;
}
export function metaLoad(store) {
  const d = metaDefault();
  let m = store?.get ? store.get(META_KEY, null) : null;
  if (!m || (m.v !== 2 && m.v !== 3)) return d; // (the v1 card-game meta is not carried over)
  if (m.v === 2) m = migrateV2(m);
  return { ...d, ...m, best: { ...d.best, ...m.best }, unlocks: { ...d.unlocks, ...m.unlocks }, collection: { ...d.collection, ...m.collection }, perks: { ...m.perks }, life: { ...lifeDefault(), ...m.life } };
}
export function metaSave(store, meta) { store?.set?.(META_KEY, meta); }
export function discover(meta, kind, id) { if (!meta || !id) return false; const c = meta.collection[kind === 'artifact' ? 'seen' : kind === 'guardian' ? 'guardians' : 'units']; if (c[id]) return false; c[id] = 1; return true; }
export function discoveredCount(meta) { const c = meta.collection; return Object.keys(c.seen).length + Object.keys(c.guardians).length + Object.keys(c.units).length; }
export const perkUnlocked = (meta, id) => !!PERKS[id] && (PERKS[id].start || (meta.unlocks.perks || []).includes(id));
export function buyPerk(meta, id) {
  const P = PERKS[id], lv = meta.perks[id] || 0;
  if (!P || !perkUnlocked(meta, id) || lv >= P.max || meta.glory < perkCost(id, lv)) return false;
  meta.glory -= perkCost(id, lv); meta.perks[id] = lv + 1; return true;
}
const isUnlocked = (meta, u) => (u.kind === 'faction' ? meta.unlocks.factions : u.kind === 'background' ? meta.unlocks.backgrounds : meta.unlocks.perks || []).includes(u.id);
// every unlock still locked, in order, with its progress: { ...entry, goalOk, renownOk, ready }
export function unlockStatus(meta) {
  const L = meta.life || lifeDefault(), out = [];
  for (const u of UNLOCKS) if (!isUnlocked(meta, u)) { const goalOk = !!u.ok(L, meta), renownOk = L.glory >= u.renown; out.push({ ...u, goalOk, renownOk, ready: goalOk && renownOk }); }
  for (const f of meta.unlocks.factions) {
    const n = (meta.unlocks.diffs[f] || 1) + 1; if (n > 8) continue;
    const goalOk = (L.wonAt[f] || 0) >= n - 1, renownOk = L.glory >= DIFF_RENOWN[n];
    out.push({ kind: 'diff', id: n, fac: f, renown: DIFF_RENOWN[n], name: `${DIFFS[n].name} difficulty (${FACTIONS[f].name})`, goal: `Win a run as ${FACTIONS[f].name} at ${DIFFS[n - 1].name}.`, goalOk, renownOk, ready: goalOk && renownOk });
  }
  return out.sort((a, b) => a.renown - b.renown);
}

// ---------------------------------------------------------------- the run
export function newRun({ seed = 1, background = 'knight', diff = 1, fac = 'haven', regions = TUNE.regions, meta = null } = {}) {
  const O = BACKGROUNDS[background] || BACKGROUNDS.knight, perks = meta?.perks || {};
  const run = {
    v: 2, seed, background: O.id, diff, fac: O.fac || fac, regions, region: 1, hero: 0,
    equip: Object.fromEntries(SLOTS.map((s) => [s, null])), locked: O.lockSlots || [], backpack: [],
    guardians: [], keys: [], invasion: null, invasionsBeaten: 0, forge: false, quests: {},
    stats: { guardians: [], invasions: [], stacksKilled: 0, bestHit: 0, raised: 0, setsDone: [], fastGuardian: false, untouched: 0, wallsHeld: 0 },
    over: false, won: false, perks: { ...perks },
    originFx: { armyMul: (O.armyMul || 1) * (1 + 0.1 * (perks.drillmaster || 0)) * (diff >= 8 ? 0.5 : 1), resMul: O.resMul ?? 1, gold: (O.gold || 0) + 1000 * (perks.quartermaster || 0), daily: O.daily || 0, fort: !!O.fort },
  };
  run.guardians = rollGuardians(run);
  const r = rngFor(run, 'second-rule'), rulePool = Object.values(GUARDIANS).filter((g) => !g.mythic && g.tier <= 2).map((g) => g.id);
  run.secondRule = Object.fromEntries(run.guardians.map((g) => [g, pick(r, rulePool.filter((k) => k !== g))]));
  const start = [];
  if (O.startArt) start.push(ARTIFACTS[O.startArt] ? O.startArt : rollArtifact(run, 'start', meta, { rarity: O.startArt }));
  if (perks.heirloom) start.push(rollArtifact(run, 'heirloom', meta, { rarity: 'treasure', exclude: start }));
  for (const id of start) if (id) addArtifact(run, id);
  return run;
}
// the run's Legendary Heroes, seeded by the run: one per region from that region's tier, no repeats, and no two of the
// same faction while the tier still offers another; the last region may draw a Mythic hero at higher difficulty
export function mythicChance(region, regions, diff) {
  const M = TUNE.mythic;
  if (region === regions && diff >= M.minDiff) return diff >= M.highDiff ? M.chanceHigh : M.chance;
  if (regions >= 5 && region >= regions - 1) return 0.2; // the full 6-region map: its deepest regions, at any difficulty
  return 0;
}
export function rollGuardians(run) {
  const r = rngFor(run, 'guardians'), out = [], facs = new Set();
  for (let reg = 1; reg <= run.regions; reg++) {
    const tier = guardianTier(reg, run.regions), myth = r() < mythicChance(reg, run.regions, run.diff);
    let pool = Object.values(GUARDIANS).filter((g) => !out.includes(g.id) && (myth ? g.mythic : !g.mythic && g.tier === tier));
    if (!pool.length) pool = Object.values(GUARDIANS).filter((g) => !out.includes(g.id) && !g.mythic);
    const fresh = pool.filter((g) => !facs.has(g.fac) || g.fac === 'neutral');
    const g = pick(r, fresh.length ? fresh : pool);
    out.push(g.id); facs.add(g.fac);
  }
  return out;
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
  const pk = run.perks || {}; t.att += pk.tactician || 0; t.def += pk.tactician || 0; t.luck += pk.lucky_star || 0; // Glory perks
  return t;
}
const wears = (run, id) => equippedIds(run).includes(id);
export const sellPrice = (id, run = null) => Math.round(TUNE.value[ARTIFACTS[id].rarity] * (run && wears(run, 'merchant_scales') ? 0.75 : 0.5));
export function buyPrice(run, id, black = false) {
  let p = TUNE.value[ARTIFACTS[id].rarity] * (black ? TUNE.blackMul : 1);
  if (run.diff >= 4) p *= 1.25;
  if (run.perks?.haggler) p *= 0.9;
  if (wears(run, 'gilded_ledger')) p *= 0.85;
  return Math.round(p / 50) * 50;
}
// the artifact pool: unlocked factions only, not already owned
export function artifactPool(run, meta, { rarity = null, exclude = [] } = {}) {
  const facs = meta?.unlocks?.factions || ['haven'], own = new Set([...equippedIds(run), ...run.backpack.map((b) => b.id), ...exclude]);
  return Object.values(ARTIFACTS).filter((a) => (!a.fac || facs.includes(a.fac) || a.fac === run.fac) && !own.has(a.id) && (!rarity || a.rarity === rarity));
}
export function rollArtifact(run, tag, meta = null, { rarity = null, rarityW = TUNE.rarityW, exclude = [] } = {}) {
  const r = typeof tag === 'function' ? tag : rngFor(run, `art:${tag}`);
  if (run.perks?.treasure_sense && !rarity) rarityW = { ...rarityW, major: (rarityW.major || 0) * 1.3, relic: (rarityW.relic || 0) * 1.3 };
  const rar = rarity || pickW(r, rarityW);
  let pool = artifactPool(run, meta, { rarity: rar, exclude });
  if (!pool.length) pool = artifactPool(run, meta, { exclude });
  return pool.length ? pick(r, pool).id : null;
}
// region-scaled rarity: deeper regions hold rarer things. v2.8: region 1 is mostly Treasure; Relics stay rare everywhere.
export const rarityFor = (region) => ({ treasure: Math.max(15, 62 - 18 * (region - 1)), minor: 30 + 4 * (region - 1), major: 6 + 7 * (region - 1), relic: region <= 1 ? 1 : 1.5 * (region - 1) });
// an artifact lying on the road (map object) in a region (1-based)
export const roadRarity = (region) => rarityFor(region);

// ---- threats: Legendary Heroes (per region) and the weekly invasions
export function guardianPower(region, diff = 1) { const G = TUNE.guardian; return G.base * Math.pow(G.growth, region - 1) * G.mult * (1 + TUNE.diffStep * (diff - 1)) * (diff >= 5 ? 1.2 : 1); }
export function invasionPower(w, diff = 1) { const I = TUNE.invasion; return I.base * Math.pow(I.growth * (diff >= 3 ? 1.1 : 1), w - 1) * I.mult * (1 + TUNE.diffStep * (diff - 1)); }
export const threatPower = (n, kind = 'guardian', diff = 1) => (kind === 'invasion' ? invasionPower(n, diff) : guardianPower(n, diff));
const unitPow = (id) => armyPower([[id, 1]]);
// an army of P power from a faction's line-up (tier window by level); hero stats fold into the power
// themed: a Legendary Hero's own unit list (any factions); a stack of tier t takes the strongest listed unit of tier ≤ t
// (upgraded at the faction's usual odds), stepping down while the stack would be too thin
const upOf = (id) => { const U = UNITS[id]; if (!U || U.up || !UPGRADES[U.fac]) return null; const i = FACTIONS[U.fac]?.units.indexOf(id); return i >= 0 ? UPGRADES[U.fac][i] : null; };
function buildArmy(r, fac, P, level, nStacks, hero, themed = null) {
  const heroMult = hero ? 1 + (hero.att + hero.def) * 0.05 + hero.pow * 0.03 : 1;
  const maxT = Math.min(7, 2 + level), minT = Math.max(1, level - 1);
  const line = fac === 'neutral' ? NEUTRALS : FACTIONS[fac].units, ups = fac === 'neutral' ? null : UPGRADES[fac];
  const upChance = level >= 6 ? 1 : level >= 3 ? 0.25 * (level - 2) : 0;
  const theme = themed && themed.filter((id) => UNITS[id]).sort((a, b) => UNITS[a].tier - UNITS[b].tier);
  const unitAt = (t, up) => {
    if (!theme?.length) return up ? ups[t - 1] : line[t - 1];
    const fit = theme.filter((id) => UNITS[id].tier <= t), id = fit.length ? fit[fit.length - 1] : theme[0];
    return (up && upOf(id)) || id;
  };
  const tiers = []; for (let i = 0; i < nStacks; i++) tiers.push(Math.round(minT + (maxT - minT) * (nStacks === 1 ? 1 : i / (nStacks - 1))));
  const wsum = tiers.reduce((a, t) => a + 0.6 + t * 0.4, 0), army = [];
  for (let t of tiers) {
    const up = (!!ups || !!theme) && r() < upChance, share = (0.6 + t * 0.4) / wsum * (0.85 + r() * 0.3);
    let id = unitAt(t, up);
    while (t > 1 && share * P / heroMult / unitPow(id) < 0.75) { t--; id = unitAt(t, up); }
    const n = Math.max(1, Math.round(share * P / heroMult / unitPow(id)));
    const same = army.find((x) => x[0] === id); if (same) same[1] += n; else army.push([id, n]);
  }
  return army.slice(0, 7);
}
export function guardianArmy(run, region = run.region) {
  const id = run.guardians[region - 1], Gd = GUARDIANS[id], r = rngFor(run, `guardian:${region}`);
  const fac = Gd.fac === 'neutral' ? 'neutral' : Gd.fac, lvl = region + 1 + (Gd.mythic ? 1 : 0);
  const P = guardianPower(region, run.diff) * (Gd.powMul || 1) * (Gd.mythic ? TUNE.mythic.power : 1);
  const hero = { att: region + 1, def: region + 1, pow: region + 1 + (Gd.spells ? 2 : 0), know: 2 + region, mana: 10 + 5 * region + (Gd.spells ? 10 : 0), skills: {}, spells: [...new Set([...(region >= 3 ? ['arrow', 'bolt'] : ['arrow']), ...(Gd.spells || [])])], luck: 0, morale: 0, name: Gd.name, p: -1 };
  const lead = Gd.lead && UNITS[Gd.lead[0]] ? Gd.lead : null, leadP = lead ? armyPower([lead]) : 0, nSt = Math.min(7, 5 + Math.floor((region - 1) / 2));
  const army = buildArmy(r, fac, Math.max(P * 0.35, P - leadP), lvl, nSt - (lead ? 1 : 0), hero, Gd.units);
  if (lead) { const same = army.find((x) => x[0] === lead[0]); if (same) same[1] += lead[1]; else army.unshift([...lead]); }
  return { army, hero, fac, guardian: id, region, mythic: !!Gd.mythic, power: Math.round(armyPower(army, hero)), target: Math.round(P) };
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
  const killedStacks = B.stacks.filter((s) => s.side !== S && s.count <= 0).length;
  const res = { won, kind, guardian: kind === 'guardian', slainLiving, killedStacks, raisePct: 0, raise: 0, raiseAs: 'skeleton', losses: 0, gold: 0 };
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
// v2.8: a chest holds a trinket only sometimes (TUNE.chest.artChance), else a second purse or a bigger lesson
export function chestChoices(run, objId, meta, ctx = {}) {
  const r = rngFor(run, `chest:${objId}`), reg = ctx.region || run.region;
  const out = [{ kind: 'gold', n: TUNE.chest.gold + 250 * ((r() * 4) | 0) + 500 * (reg - 1) }, { kind: 'xp', n: TUNE.chest.xp + 500 * (reg - 1) }];
  const id = r() < TUNE.chest.artChance ? rollArtifact(run, r, meta, { rarityW: { treasure: 80, minor: 20 } }) : null;
  out.push(id ? { kind: 'artifact', id } : r() < 0.5 ? { kind: 'gold', n: Math.round((TUNE.chest.gold * 1.6 + 600 * (reg - 1)) / 50) * 50 } : { kind: 'xp', n: Math.round((TUNE.chest.xp * 1.6 + 700 * (reg - 1)) / 50) * 50 });
  return out;
}
const pickWOut = (r, w, n) => { const ww = { ...w }, out = []; for (let i = 0; i < n && Object.keys(ww).length; i++) { const k = pickW(r, ww); out.push(k); delete ww[k]; } return out; };
export function pandoraChoices(run, objId, meta, ctx = {}) {
  const r = rngFor(run, `pandora:${objId}`), reg = ctx.region || run.region, out = [];
  for (const k of pickWOut(r, TUNE.pandora.w, 3)) {
    if (k === 'gold') out.push({ kind: 'gold', n: TUNE.pandora.gold * reg });
    if (k === 'xp') out.push({ kind: 'xp', n: TUNE.pandora.xp * reg });
    if (k === 'artifact') { const id = rollArtifact(run, r, meta, { rarityW: rarityFor(reg) }); out.push(id ? { kind: 'artifact', id } : { kind: 'gold', n: TUNE.pandora.gold * reg }); }
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
// the defeated invasion's baggage train: 2 artifacts or the war chest (v2.8: one fewer artifact, and plainer ones)
export function spoilsChoices(run, w, meta) {
  const r = rngFor(run, `spoils:${w}`), out = [];
  for (let i = 0; i < 2; i++) { const id = rollArtifact(run, r, meta, { rarityW: rarityFor(Math.min(3, 1 + Math.floor((w - 1) / 2))), exclude: out.map((c) => c.id) }); if (id) out.push({ kind: 'artifact', id }); }
  out.push({ kind: 'gold', n: 1000 + 500 * w });
  return out;
}
// a Seer's Hut asks for resources and pays with an artifact: a Minor one in region 1, a Major one deeper in
export function seerQuest(run, objId, meta) {
  if (run.quests[objId]) return run.quests[objId];
  const r = rngFor(run, `seer:${objId}`), res = pick(r, ['wood', 'ore', 'gems']), deep = run.region >= 2;
  const q = { need: deep ? { [res]: res === 'gems' ? 10 : 18, gold: 3000 } : { [res]: res === 'gems' ? 6 : 10, gold: 1500 }, reward: rollArtifact(run, r, meta, { rarity: deep ? 'major' : 'minor' }), done: false };
  run.quests[objId] = q; return q;
}
// merchants: the stock rotates every week; the Black Market sells rarer goods at a premium
export function merchantStock(run, objId, day, meta, black = false) {
  const w = week(day), r = rngFor(run, `merchant:${objId}:${w}`), out = [];
  const W = black ? { major: 75, relic: 25 } : { treasure: 50, minor: 42, major: 8 };
  for (let i = 0; i < (black ? 2 : 3); i++) { const id = rollArtifact(run, r, meta, { rarityW: W, exclude: out.map((c) => c.id) }); if (id) out.push({ kind: 'artifact', id, price: buyPrice(run, id, black) }); }
  return out;
}
// the Trading Post: fixed HoMM-style rates (gold per unit)
export const TRADE = { wood: { buy: 250, sell: 100 }, ore: { buy: 250, sell: 100 }, gems: { buy: 500, sell: 250 } };
export const buildDiscount = (run) => Math.min(0.5, equippedIds(run).reduce((a, id) => a + (ARTIFACTS[id].build || 0), 0) + 0.1 * (run.perks?.architect || 0));
export function dailyIncome(run) {
  const t = { gold: run.originFx.daily || 0, wood: 0, ore: 0, gems: 0 };
  const add = (d) => { if (d) for (const k in d) t[k] = (t[k] || 0) + d[k]; };
  for (const id of equippedIds(run)) add(ARTIFACTS[id].daily?.());
  for (const S2 of activeSets(run)) add(S2.daily?.());
  if (run.forge) t.gold += 1000;
  return t;
}
// the Grail (one per run): rebuilt in your capital as the Crown Forge
export const buildsPerDay = (run) => (run.forge ? 2 : 1);
export const growthMul = (run) => (run.forge ? 1.5 : 1) * (run.diff >= 6 ? 0.75 : 1);

// ---- scoring and the end of the run
export function scoreRun(run, { armyPower: ap = 0, gold = 0 } = {}) {
  const rows = [];
  rows.push({ k: 'guardians', label: 'Legendary Heroes defeated', n: run.stats.guardians.reduce((a, g, i) => a + 600 * (i + 1) * (GUARDIANS[g]?.mythic ? 1.5 : 1), 0) });
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
// fold a finished run into the lifetime counters (meta.life)
function noteLife(meta, run, gold) {
  const L = meta.life || (meta.life = lifeDefault());
  L.guardians += run.stats.guardians.length; L.invasions += run.stats.invasions.length; L.sets += run.stats.setsDone.length;
  L.wallsHeld += run.stats.wallsHeld || 0; L.bestRegion = Math.max(L.bestRegion, run.won ? run.regions : run.region);
  L.bestGuardians = Math.max(L.bestGuardians, run.stats.guardians.length); L.maxGold = Math.max(L.maxGold, gold);
  L.mythics += run.stats.guardians.filter((g) => GUARDIANS[g]?.mythic).length;
  L.facRuns[run.fac] = (L.facRuns[run.fac] || 0) + 1;
  if (run.won) { L.wins++; L.bestWinDiff = Math.max(L.bestWinDiff, run.diff); L.wonAt[run.fac] = Math.max(L.wonAt[run.fac] || 0, run.diff); }
}
// grant up to `cap` ready unlocks, lowest Renown first; after a win (wonFac) the next difficulty tier of that faction
// comes on top, when it is ready
export function grantUnlocks(meta, cap, wonFac = null) {
  const out = [], ready = unlockStatus(meta).filter((u) => u.ready);
  const bonus = wonFac && ready.find((u) => u.kind === 'diff' && u.fac === wonFac);
  if (bonus) { ready.splice(ready.indexOf(bonus), 1); ready.unshift(bonus); cap++; }
  for (const u of ready) {
    if (out.length >= cap) break;
    if (u.kind === 'faction') { meta.unlocks.factions.push(u.id); meta.unlocks.diffs[u.id] ||= 1; }
    else if (u.kind === 'background') meta.unlocks.backgrounds.push(u.id);
    else if (u.kind === 'perk') (meta.unlocks.perks ||= []).push(u.id);
    else if (u.kind === 'diff') { if ((meta.unlocks.diffs[u.fac] || 1) + 1 !== u.id) continue; meta.unlocks.diffs[u.fac] = u.id; }
    out.push({ kind: u.kind, id: u.id, fac: u.fac, name: u.name });
  }
  return out;
}
export function endRun(run, meta, { armyPower: ap = 0, gold = 0 } = {}) {
  const S = scoreRun(run, { armyPower: ap, gold }), trophies = [];
  meta.runs++; if (run.won) meta.wins++;
  meta.glory += S.glory;
  const best = S.score > meta.best.score; if (best) meta.best.score = S.score;
  meta.best.region = Math.max(meta.best.region, run.won ? run.regions : run.region);
  for (const g of run.stats.guardians) meta.collection.guardians[g] = 1;
  noteLife(meta, run, gold); meta.life.glory += S.glory;
  const unlocks = grantUnlocks(meta, TUNE.unlocksPerRun, run.won ? run.fac : null);
  const award = (id, ok) => { if (ok && !meta.trophies.includes(id)) { meta.trophies.push(id); trophies.push(id); } };
  award('first_blood', run.invasionsBeaten > 0); award('crowned', run.won); award('hoarder', gold >= 50000); award('full_set', run.stats.setsDone.length > 0);
  award('bone_lord', run.stats.raised >= 100); award('untouchable', run.stats.untouched > 0); award('big_hit', run.stats.bestHit >= 1000); award('collector', discoveredCount(meta) >= 30);
  award('mythslayer', run.stats.guardians.some((g) => GUARDIANS[g]?.mythic)); award('legend_hunter', Object.keys(meta.collection.guardians).length >= 15);
  const next = unlockStatus(meta).slice(0, 2); // what to chase next (the end screen shows it)
  return { ...S, best, unlocks, trophies, next, renown: meta.life.glory };
}
export const artifactText = (id) => ARTIFACTS[id].text;
