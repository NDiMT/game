// =====================================================================
// HEX REALMS: game data. Factions, creatures, town buildings, spells,
// artifacts, map objects and hero skills.
// =====================================================================

export const RES = ['gold', 'wood', 'ore', 'gems'];
export const RES_ICON = { gold: '🪙', wood: '🪵', ore: '🪨', gems: '💎' };

// creatures: att, def, dmg [min,max], hp, spd, cost (gold + extras), growth per week
// flags: ranged (shots), fly, noRetal, twoRetal, double (strikes twice), drain, undead, regen, breath (hits the hex behind), jousting
export const UNITS = {
  // Haven
  pikeman: { name: 'Pikeman', fac: 'haven', tier: 1, att: 4, def: 5, dmg: [1, 3], hp: 10, spd: 4, cost: { gold: 60 }, grow: 14, col: 0x5a8ad8 },
  archer: { name: 'Archer', fac: 'haven', tier: 2, att: 6, def: 3, dmg: [2, 3], hp: 10, spd: 4, cost: { gold: 100 }, grow: 9, ranged: 12, col: 0x4aa86a },
  griffin: { name: 'Griffin', fac: 'haven', tier: 3, att: 8, def: 8, dmg: [3, 6], hp: 25, spd: 6, cost: { gold: 200 }, grow: 7, fly: true, twoRetal: true, col: 0xd8b04a },
  swordsman: { name: 'Swordsman', fac: 'haven', tier: 4, att: 10, def: 12, dmg: [6, 9], hp: 35, spd: 5, cost: { gold: 300 }, grow: 4, col: 0xb8c0d0 },
  monk: { name: 'Monk', fac: 'haven', tier: 5, att: 12, def: 7, dmg: [10, 12], hp: 30, spd: 5, cost: { gold: 400 }, grow: 3, ranged: 12, col: 0xc89a5a },
  cavalier: { name: 'Cavalier', fac: 'haven', tier: 6, att: 15, def: 15, dmg: [15, 25], hp: 100, spd: 7, cost: { gold: 1000 }, grow: 2, jousting: true, col: 0x3a5ac8 },
  angel: { name: 'Angel', fac: 'haven', tier: 7, att: 20, def: 20, dmg: [50, 50], hp: 200, spd: 12, cost: { gold: 3000, gems: 1 }, grow: 1, fly: true, col: 0xfff0c0 },
  // Necropolis
  skeleton: { name: 'Skeleton', fac: 'necro', tier: 1, att: 5, def: 4, dmg: [1, 3], hp: 6, spd: 4, cost: { gold: 60 }, grow: 12, undead: true, col: 0xe8e2d0 },
  zombie: { name: 'Zombie', fac: 'necro', tier: 2, att: 5, def: 5, dmg: [2, 3], hp: 15, spd: 3, cost: { gold: 100 }, grow: 8, undead: true, col: 0x7a9a6a },
  wight: { name: 'Wight', fac: 'necro', tier: 3, att: 7, def: 7, dmg: [3, 5], hp: 18, spd: 5, cost: { gold: 200 }, grow: 7, fly: true, undead: true, regen: true, col: 0x9ab0c8 },
  vampire: { name: 'Vampire', fac: 'necro', tier: 4, att: 10, def: 9, dmg: [5, 8], hp: 30, spd: 6, cost: { gold: 360 }, grow: 4, fly: true, noRetal: true, drain: true, undead: true, col: 0x8a2a3a },
  lich: { name: 'Lich', fac: 'necro', tier: 5, att: 13, def: 10, dmg: [11, 13], hp: 30, spd: 6, cost: { gold: 550 }, grow: 3, ranged: 12, undead: true, col: 0x6a4a9a },
  blackknight: { name: 'Black Knight', fac: 'necro', tier: 6, att: 16, def: 16, dmg: [15, 30], hp: 120, spd: 7, cost: { gold: 1200 }, grow: 2, undead: true, col: 0x2a2a34 },
  bonedragon: { name: 'Bone Dragon', fac: 'necro', tier: 7, att: 17, def: 15, dmg: [25, 50], hp: 150, spd: 9, cost: { gold: 1800, gems: 1 }, grow: 1, fly: true, undead: true, col: 0xd8d0b8 },
  // Neutrals, guarding the wilds
  goblin: { name: 'Goblin', fac: 'neutral', tier: 1, att: 4, def: 2, dmg: [1, 2], hp: 5, spd: 5, cost: { gold: 40 }, grow: 15, col: 0x7ac04a },
  wolf: { name: 'Wolf', fac: 'neutral', tier: 2, att: 6, def: 4, dmg: [2, 4], hp: 12, spd: 7, cost: { gold: 100 }, grow: 9, double: true, col: 0x8a8a92 },
  orc: { name: 'Orc', fac: 'neutral', tier: 3, att: 8, def: 4, dmg: [2, 5], hp: 15, spd: 4, cost: { gold: 150 }, grow: 7, ranged: 12, col: 0x5a8a3a },
  ogre: { name: 'Ogre', fac: 'neutral', tier: 4, att: 13, def: 7, dmg: [6, 12], hp: 60, spd: 4, cost: { gold: 300 }, grow: 4, col: 0xb08a5a },
  troll: { name: 'Troll', fac: 'neutral', tier: 5, att: 14, def: 7, dmg: [10, 15], hp: 40, spd: 7, cost: { gold: 500 }, grow: 3, regen: true, col: 0x6a8a7a },
  cyclops: { name: 'Cyclops', fac: 'neutral', tier: 6, att: 17, def: 13, dmg: [16, 20], hp: 100, spd: 6, cost: { gold: 900 }, grow: 2, ranged: 8, col: 0xa86a4a },
  hydra: { name: 'Hydra', fac: 'neutral', tier: 7, att: 18, def: 18, dmg: [25, 45], hp: 175, spd: 5, cost: { gold: 2200 }, grow: 1, noRetalTaken: true, col: 0x3a8a6a },
};
// upgraded creatures: recruited from an upgraded dwelling; `up` names the base creature (and its model)
Object.assign(UNITS, {
  halberdier: { name: 'Halberdier', fac: 'haven', tier: 1, up: 'pikeman', att: 6, def: 5, dmg: [2, 3], hp: 10, spd: 5, cost: { gold: 75 }, grow: 14, col: 0x3a6ad8 },
  marksman: { name: 'Marksman', fac: 'haven', tier: 2, up: 'archer', att: 6, def: 3, dmg: [2, 3], hp: 10, spd: 6, cost: { gold: 150 }, grow: 9, ranged: 24, twoShots: true, col: 0x3a8a5a },
  royalgriffin: { name: 'Royal Griffin', fac: 'haven', tier: 3, up: 'griffin', att: 9, def: 9, dmg: [3, 6], hp: 25, spd: 9, cost: { gold: 240 }, grow: 7, fly: true, twoRetal: true, col: 0xe8c050 },
  crusader: { name: 'Crusader', fac: 'haven', tier: 4, up: 'swordsman', att: 12, def: 12, dmg: [7, 10], hp: 35, spd: 6, cost: { gold: 400 }, grow: 4, double: true, col: 0xd8dce8 },
  zealot: { name: 'Zealot', fac: 'haven', tier: 5, up: 'monk', att: 12, def: 10, dmg: [10, 12], hp: 30, spd: 7, cost: { gold: 450 }, grow: 3, ranged: 24, noMeleePenalty: true, col: 0xd8aa5a },
  champion: { name: 'Champion', fac: 'haven', tier: 6, up: 'cavalier', att: 16, def: 16, dmg: [20, 25], hp: 100, spd: 9, cost: { gold: 1200 }, grow: 2, jousting: true, col: 0x2a4ab8 },
  archangel: { name: 'Archangel', fac: 'haven', tier: 7, up: 'angel', att: 30, def: 30, dmg: [50, 50], hp: 250, spd: 18, cost: { gold: 5000, gems: 3 }, grow: 1, fly: true, col: 0xfff4d0 },
  skelwarrior: { name: 'Skeleton Warrior', fac: 'necro', tier: 1, up: 'skeleton', att: 6, def: 6, dmg: [1, 3], hp: 6, spd: 5, cost: { gold: 70 }, grow: 12, undead: true, col: 0xf0ead8 },
  plaguezombie: { name: 'Plague Zombie', fac: 'necro', tier: 2, up: 'zombie', att: 5, def: 5, dmg: [2, 3], hp: 20, spd: 4, cost: { gold: 125 }, grow: 8, undead: true, curse: true, col: 0x6a8a5a },
  wraith: { name: 'Wraith', fac: 'necro', tier: 3, up: 'wight', att: 7, def: 7, dmg: [3, 5], hp: 18, spd: 7, cost: { gold: 230 }, grow: 7, fly: true, undead: true, regen: true, col: 0x8aa0c8 },
  vampirelord: { name: 'Vampire Lord', fac: 'necro', tier: 4, up: 'vampire', att: 10, def: 10, dmg: [5, 8], hp: 40, spd: 9, cost: { gold: 500 }, grow: 4, fly: true, noRetal: true, drain: true, undead: true, col: 0xa82a3a },
  powerlich: { name: 'Power Lich', fac: 'necro', tier: 5, up: 'lich', att: 13, def: 10, dmg: [11, 15], hp: 40, spd: 7, cost: { gold: 600 }, grow: 3, ranged: 24, undead: true, col: 0x8a4ab8 },
  dreadknight: { name: 'Dread Knight', fac: 'necro', tier: 6, up: 'blackknight', att: 18, def: 18, dmg: [15, 30], hp: 120, spd: 9, cost: { gold: 1500 }, grow: 2, undead: true, deathblow: true, col: 0x1a1a24 },
  ghostdragon: { name: 'Ghost Dragon', fac: 'necro', tier: 7, up: 'bonedragon', att: 19, def: 17, dmg: [25, 50], hp: 200, spd: 14, cost: { gold: 3000, gems: 1 }, grow: 1, fly: true, undead: true, col: 0xc8d8e8 },
});
export const UPGRADES = { haven: ['halberdier', 'marksman', 'royalgriffin', 'crusader', 'zealot', 'champion', 'archangel'], necro: ['skelwarrior', 'plaguezombie', 'wraith', 'vampirelord', 'powerlich', 'dreadknight', 'ghostdragon'] };
export const FACTIONS = {
  haven: { name: 'Haven', color: 0x3a7aff, css: '#3a7aff', units: ['pikeman', 'archer', 'griffin', 'swordsman', 'monk', 'cavalier', 'angel'], heroes: ['Sir Aldric', 'Lady Brenna', 'Sir Corvin', 'Dame Elys'] },
  necro: { name: 'Necropolis', color: 0xd83a3a, css: '#d83a3a', units: ['skeleton', 'zombie', 'wight', 'vampire', 'lich', 'blackknight', 'bonedragon'], heroes: ['Vex the Pale', 'Morra', 'Lord Sable', 'Kazrith'] },
};
export const NEUTRALS = ['goblin', 'wolf', 'orc', 'ogre', 'troll', 'cyclops', 'hydra'];

// town buildings: one can be built per day
export const BUILDINGS = [
  { id: 'hall2', name: 'Town Hall', icon: '🏛️', cost: { gold: 2500 }, req: [], desc: '+1000 gold per day (instead of 500).' },
  { id: 'hall3', name: 'City Hall', icon: '🏰', cost: { gold: 5000, wood: 5, ore: 5 }, req: ['hall2', 'market'], desc: '+2000 gold per day.' },
  { id: 'fort', name: 'Fort', icon: '🧱', cost: { gold: 2000, wood: 10, ore: 10 }, req: [], desc: 'Walls: town defenders get +30% defence, and creatures grow 50% faster.' },
  { id: 'market', name: 'Marketplace', icon: '⚖️', cost: { gold: 500, wood: 5 }, req: [], desc: 'Trade resources.' },
  { id: 'tavern', name: 'Tavern', icon: '🍺', cost: { gold: 500, wood: 5 }, req: [], desc: 'Hire another hero (2500 gold).' },
  { id: 'mage1', name: 'Mage Guild I', icon: '📘', cost: { gold: 2000, wood: 5, ore: 5 }, req: [], desc: 'Teaches 3 first-circle spells to visiting heroes.' },
  { id: 'mage2', name: 'Mage Guild II', icon: '📗', cost: { gold: 1000, wood: 5, ore: 5, gems: 4 }, req: ['mage1'], desc: 'Teaches 2 second-circle spells.' },
  { id: 'mage3', name: 'Mage Guild III', icon: '📕', cost: { gold: 1000, wood: 5, ore: 5, gems: 6 }, req: ['mage2'], desc: 'Teaches 2 third-circle spells.' },
  { id: 'd1', name: 'Dwelling I', tier: 1, icon: '①', cost: { gold: 500, ore: 5 }, req: [], desc: 'Recruit tier 1 creatures.' },
  { id: 'd2', name: 'Dwelling II', tier: 2, icon: '②', cost: { gold: 1000, wood: 5 }, req: ['d1'], desc: 'Recruit tier 2 creatures.' },
  { id: 'd3', name: 'Dwelling III', tier: 3, icon: '③', cost: { gold: 1000, ore: 5 }, req: ['d1'], desc: 'Recruit tier 3 creatures.' },
  { id: 'd4', name: 'Dwelling IV', tier: 4, icon: '④', cost: { gold: 2000, wood: 5, ore: 5 }, req: ['d2', 'fort'], desc: 'Recruit tier 4 creatures.' },
  { id: 'd5', name: 'Dwelling V', tier: 5, icon: '⑤', cost: { gold: 3000, wood: 5, ore: 5, gems: 2 }, req: ['d3', 'mage1'], desc: 'Recruit tier 5 creatures.' },
  { id: 'd6', name: 'Dwelling VI', tier: 6, icon: '⑥', cost: { gold: 5000, wood: 10, ore: 10, gems: 3 }, req: ['d4'], desc: 'Recruit tier 6 creatures.' },
  { id: 'd7', name: 'Dwelling VII', tier: 7, icon: '⑦', cost: { gold: 15000, wood: 10, ore: 10, gems: 15 }, req: ['d5', 'd6', 'hall2'], desc: 'Recruit the mightiest creatures.' },
];

// spells: circle (mage guild level), mana cost, target (enemy, ally, all-enemies, area)
// upgraded dwellings
for (let t = 1; t <= 7; t++) BUILDINGS.push({ id: `u${t}`, tier: t, up: true, name: `Upgraded Dwelling ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][t - 1]}`, icon: '⬆️', cost: { gold: [1000, 1000, 1500, 2000, 3000, 6000, 20000][t - 1], wood: t > 1 ? 5 : 0, ore: 5, gems: t >= 5 ? t - 2 : 0 }, req: [`d${t}`, ...(t >= 4 ? ['mage1'] : []), ...(t >= 6 ? ['hall2'] : [])], desc: 'Recruit the upgraded creature and upgrade your troops here.' });
export const SPELLS = {
  arrow: { name: 'Magic Arrow', icon: '🏹', circle: 1, mana: 5, target: 'enemy', desc: 'Deals 10 + 10×Power damage.' },
  bless: { name: 'Bless', icon: '✨', circle: 1, mana: 5, target: 'ally', desc: 'The stack always deals maximum damage for 3 rounds.' },
  stoneskin: { name: 'Stone Skin', icon: '🪨', circle: 1, mana: 5, target: 'ally', desc: '+4 defence for 3 rounds.' },
  cure: { name: 'Cure', icon: '💚', circle: 1, mana: 6, target: 'ally', desc: 'Heals 10 + 5×Power hit points and removes curses.' },
  haste: { name: 'Haste', icon: '💨', circle: 2, mana: 6, target: 'ally', desc: '+3 speed for 3 rounds.' },
  slow: { name: 'Slow', icon: '🐌', circle: 2, mana: 6, target: 'enemy', desc: 'Halves speed for 3 rounds.' },
  bolt: { name: 'Lightning', icon: '⚡', circle: 3, mana: 10, target: 'enemy', desc: 'Deals 10 + 25×Power damage.' },
  fireball: { name: 'Fireball', icon: '🔥', circle: 3, mana: 15, target: 'area', desc: 'Deals 15 + 10×Power damage to a hex and its neighbours.' },
};

// artifacts: picked up on the map, they boost the hero forever
export const ARTIFACTS = [
  { id: 'sword', name: 'Centaur Axe', icon: '🪓', att: 2 },
  { id: 'shield', name: 'Lion Shield', icon: '🛡️', def: 2 },
  { id: 'staff', name: 'Staff of Embers', icon: '🪄', pow: 2 },
  { id: 'tome', name: 'Tome of Lore', icon: '📖', know: 2 },
  { id: 'boots', name: 'Boots of Speed', icon: '👢', move: 300 },
  { id: 'ring', name: 'Ring of Vitality', icon: '💍', hp: 1 },
  { id: 'helm', name: 'Helm of Command', icon: '⛑️', att: 1, def: 1, pow: 1, know: 1 },
  { id: 'cloak', name: 'Cloak of Shadows', icon: '🧥', def: 3 },
  { id: 'blade', name: 'Sword of Judgement', icon: '⚔️', att: 4 },
  { id: 'orb', name: 'Orb of Tempest', icon: '🔮', pow: 3 },
  { id: 'clover', name: 'Four-leaf Clover', icon: '🍀', luck: 1 },
  { id: 'banner', name: 'Banner of Valor', icon: '🚩', morale: 1 },
];

// secondary skills offered on level up
export const SKILLS = {
  logistics: { name: 'Logistics', icon: '🐎', desc: '+15% movement on the map per level.' },
  offense: { name: 'Offense', icon: '🗡️', desc: '+10% melee damage per level.' },
  archery: { name: 'Archery', icon: '🏹', desc: '+15% ranged damage per level.' },
  armorer: { name: 'Armorer', icon: '🛡️', desc: '−8% damage taken per level.' },
  wisdom: { name: 'Wisdom', icon: '📜', desc: 'Learn spells of higher circles (II at level 1, III at level 2).' },
  sorcery: { name: 'Sorcery', icon: '🔮', desc: '+15% spell damage per level.' },
  leadership: { name: 'Leadership', icon: '🎺', desc: '+1 morale per level: a chance to act twice.' },
  luck: { name: 'Luck', icon: '🍀', desc: '+1 luck per level: a chance to deal double damage.' },
  scouting: { name: 'Scouting', icon: '🔭', desc: '+2 vision radius per level.' },
  estates: { name: 'Estates', icon: '💰', desc: '+250 gold per day per level.' },
  necromancy: { name: 'Necromancy', icon: '💀', desc: 'Raise 10% of slain enemies as skeletons per level.' },
};

// map objects. kind: pickup (vanishes), mine (flagged, daily income), visit (once per hero), weekly (once per week), dwelling
export const OBJECTS = {
  gold: { kind: 'pickup', name: 'Gold', icon: '🪙' },
  wood: { kind: 'pickup', name: 'Wood', icon: '🪵' },
  ore: { kind: 'pickup', name: 'Ore', icon: '🪨' },
  gems: { kind: 'pickup', name: 'Gems', icon: '💎' },
  chest: { kind: 'pickup', name: 'Treasure Chest', icon: '🧰' },
  artifact: { kind: 'pickup', name: 'Artifact', icon: '✨' },
  campfire: { kind: 'pickup', name: 'Campfire', icon: '🔥' },
  goldmine: { kind: 'mine', name: 'Gold Mine', icon: '⛏️', res: 'gold', amount: 1000 },
  sawmill: { kind: 'mine', name: 'Sawmill', icon: '🪚', res: 'wood', amount: 2 },
  orepit: { kind: 'mine', name: 'Ore Pit', icon: '⛰️', res: 'ore', amount: 2 },
  gemmine: { kind: 'mine', name: 'Crystal Cavern', icon: '💠', res: 'gems', amount: 1 },
  arena: { kind: 'visit', name: 'Arena', icon: '🏟️', desc: '+2 Attack or +2 Defence' },
  tower: { kind: 'visit', name: 'Star Tower', icon: '🗼', desc: '+1 Power' },
  library: { kind: 'visit', name: 'Library of Lore', icon: '📚', desc: '+1 Knowledge' },
  stone: { kind: 'visit', name: 'Learning Stone', icon: '🗿', desc: '+1000 experience' },
  shrine: { kind: 'visit', name: 'Shrine of Magic', icon: '⛩️', desc: 'Learn a spell' },
  well: { kind: 'weekly', name: 'Magic Well', icon: '⛲', desc: 'Restores all mana' },
  windmill: { kind: 'weekly', name: 'Windmill', icon: '🌬️', desc: 'A few resources every week' },
  stables: { kind: 'weekly', name: 'Stables', icon: '🐴', desc: '+400 movement today' },
  dwelling: { kind: 'dwelling', name: 'Wild Dwelling', icon: '🛖', desc: 'Hire neutral creatures' },
  obelisk: { kind: 'visit', name: 'Obelisk', icon: '🗿', desc: 'Reveals the land around it' },
};

export const START_ARMY = {
  haven: [['pikeman', 24], ['archer', 9], ['griffin', 3]],
  necro: [['skeleton', 28], ['zombie', 10], ['wight', 3]],
};
